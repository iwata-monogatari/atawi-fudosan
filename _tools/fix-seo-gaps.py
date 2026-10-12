#!/usr/bin/env python3
"""2026-10-12 SEO/AIO 診断で見つかった「抜け」を冪等に埋める保守スクリプト。

  1. sitemap-core.xml の .html 付きURL → 拡張子なし（Cloudflare Pages が 308 で拡張子なしへ寄せるため、
     canonical と og:url も同じURLに揃える。実ファイル名は変えない）
  2. guide/*/index.html の Article に datePublished（git 初回追加日）と image（og:image）を補う
  3. shindan/*/index.html に og:image が無ければサイト共通 og-image.png を入れる
  4. areas/<市>/<悩み>/index.html に Article（著者・発行者は共通 @id 参照）を追加
  5. JSON-LD 内の電話番号を +81 形式に統一（Organization ブロックと同じ表記）

使い方: python _tools/fix-seo-gaps.py [--dry-run]
"""
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ORIGIN = "https://fudosan.atawi.link"
ORG_ID = "https://www.fujigaoka-service.co.jp/#organization"
PERSON_ID = "https://oishi-hiroyuki.org/#person"
TODAY = "2026-10-12"
DRY = "--dry-run" in sys.argv
changed = []


def rd(p):
    return open(os.path.join(ROOT, p), "rb").read().decode("utf-8")


def wr(p, s, before):
    if s == before:
        return
    changed.append(p)
    if not DRY:
        open(os.path.join(ROOT, p), "wb").write(s.encode("utf-8"))


def first_add_date(p):
    out = subprocess.run(["git", "log", "--diff-filter=A", "--format=%as", "--", p],
                         cwd=ROOT, capture_output=True, text=True).stdout.split()
    return out[-1] if out else TODAY


def meta(src, pat):
    m = re.search(pat, src)
    return m.group(1) if m else None


# 1. sitemap .html → 拡張子なし
sm = rd("sitemap-core.xml")
html_urls = re.findall(r"<loc>(https://fudosan\.atawi\.link/[^<]+)\.html</loc>", sm)
new_sm = re.sub(r"(<loc>https://fudosan\.atawi\.link/[^<]+)\.html</loc>", r"\1</loc>", sm)
wr("sitemap-core.xml", new_sm, sm)
for u in html_urls:
    rel = u[len(ORIGIN) + 1:] + ".html"
    if not os.path.exists(os.path.join(ROOT, rel)):
        print("missing file:", rel)
        continue
    s = rd(rel)
    t = s.replace(f'rel="canonical" href="{u}.html"', f'rel="canonical" href="{u}"')
    t = t.replace(f'property="og:url" content="{u}.html"', f'property="og:url" content="{u}"')
    wr(rel, t, s)

# 1b. 内部リンクも拡張子なしへ（.html のままだと 308 を挟み、監査で孤立URL扱いになる）
all_html = subprocess.run(["git", "ls-files", "--", "*.html"], cwd=ROOT, capture_output=True, text=True).stdout.split()
all_html = [p for p in all_html if not p.startswith((".claude/", "tools/", "docs/", "tests/", "_tools/", "assets/"))]
# 2回目以降の実行でも効くよう、サイトマップの「拡張子なしで実体が X.html」のURLを対象にする
clean_urls = [u for u in re.findall(r"<loc>(https://fudosan\.atawi\.link/[^<]+)</loc>", rd("sitemap-core.xml"))
              if not u.endswith("/") and os.path.exists(os.path.join(ROOT, u[len(ORIGIN) + 1:] + ".html"))]
for u in clean_urls:
    path = u[len(ORIGIN):]            # /souzoku/okuyami/touki
    base = path.rsplit("/", 1)[1]     # touki
    dirn = path.rsplit("/", 1)[0].lstrip("/")  # souzoku/okuyami
    for rel in all_html:
        s = rd(rel)
        t = s.replace(f'href="{u}.html"', f'href="{u}"').replace(f'href="{path}.html"', f'href="{path}"')
        if rel.rsplit("/", 1)[0] == dirn:
            t = re.sub(r'href="(?:\./)?' + re.escape(base) + r'\.html"', f'href="{base}"', t)
        wr(rel, t, s)

# 2. guide Article: datePublished / image
for rel in sorted(glob.glob(os.path.join(ROOT, "guide", "*", "index.html"))):
    rel = os.path.relpath(rel, ROOT).replace(os.sep, "/")
    s = rd(rel)
    og = meta(s, r'property="og:image" content="([^"]+)"')

    def fix(m):
        raw = m.group(2)
        if '"@type":"Article"' not in raw.replace(" ", ""):
            return m.group(0)
        d = json.loads(raw)
        if d.get("@type") != "Article":
            return m.group(0)
        d.setdefault("datePublished", first_add_date(rel))
        if og:
            d.setdefault("image", og)
        if isinstance(d.get("author"), dict) and d["author"].get("name") == "大石浩之":
            d["author"].setdefault("@id", PERSON_ID)
        if isinstance(d.get("publisher"), dict):
            d["publisher"].setdefault("@id", ORG_ID)
        return m.group(1) + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + m.group(3)

    t = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)', fix, s, flags=re.S)
    wr(rel, t, s)

# 3. shindan og:image
for rel in sorted(glob.glob(os.path.join(ROOT, "shindan", "*", "index.html"))):
    rel = os.path.relpath(rel, ROOT).replace(os.sep, "/")
    s = rd(rel)
    if 'property="og:image"' in s:
        continue
    anchor = re.search(r'<meta property="og:url"[^>]*>', s) or re.search(r'<link rel="canonical"[^>]*>', s)
    if not anchor:
        continue
    tag = f'<meta property="og:image" content="{ORIGIN}/og-image.png">'
    t = s[:anchor.end()] + "\n" + tag + s[anchor.end():]
    wr(rel, t, s)

# 4. areas/<city>/<issue>/ Article
for rel in sorted(glob.glob(os.path.join(ROOT, "areas", "*", "*", "index.html"))):
    rel = os.path.relpath(rel, ROOT).replace(os.sep, "/")
    if rel.startswith("areas/check/"):
        continue
    s = rd(rel)
    if '"@type":"Article"' in s or '"@type": "Article"' in s:
        continue
    url = meta(s, r'rel="canonical" href="([^"]+)"')
    title = meta(s, r'property="og:title" content="([^"]*)"') or meta(s, r"<title>([^<]*)</title>")
    desc = meta(s, r'name="description" content="([^"]*)"') or ""
    og = meta(s, r'property="og:image" content="([^"]+)"')
    if not (url and title):
        continue
    art = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": desc,
        "url": url,
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "datePublished": first_add_date(rel),
        "dateModified": TODAY,
        "inLanguage": "ja",
        "author": {"@id": PERSON_ID},
        "publisher": {"@id": ORG_ID},
    }
    if og:
        art["image"] = og
    tag = '<script type="application/ld+json">' + json.dumps(art, ensure_ascii=False, separators=(",", ":")) + "</script>"
    t = s.replace("</head>", tag + "\n</head>", 1)
    wr(rel, t, s)

# 5. 電話番号表記（JSON-LD 内のみ）
for rel in subprocess.run(["git", "grep", "-l", '"telephone":"0538-31-3308"', "--", "*.html"],
                          cwd=ROOT, capture_output=True, text=True).stdout.split():
    s = rd(rel)
    t = s.replace('"telephone":"0538-31-3308"', '"telephone":"+81-538-31-3308"')
    wr(rel, t, s)

print(("dry-run " if DRY else "") + f"changed {len(changed)} files")
for p in changed:
    print(" ", p)
