#!/usr/bin/env python3
"""ブログ記事に「執筆：大石浩之」の署名と、著者 Person を正本に揃えた Article JSON-LD を適用する。

AI推薦対策 A-2.9。冪等(何度実行しても同じ結果)。既存の本文・デザインは変えず、次だけを行う。
  1. 署名ブロック <p class="author-signature"> を1つ追加(著者カードがあればその直前、
     なければ共通CTA(data-common-karte-cta)の直前、それも無ければ「参考にした公式情報」見出しの直前)。
  2. JSON-LD の BlogPosting を ["BlogPosting","Article"] にし、author を
     Person「大石浩之」(@id=https://oishi-hiroyuki.org/#person)に統一。
     旧 @id(https://fudosan.atawi.link/#oishi)の Person ノードは @id を付け替えて1人に束ねる。

使い方:
  python blog-auto/scripts/apply_author.py            # blog/*/index.html すべて
  python blog-auto/scripts/apply_author.py blog/20261007-xxx/index.html   # 指定のみ
  python blog-auto/scripts/apply_author.py --check    # 未適用の記事を列挙(変更しない)
新しい記事は「直近の記事をコピー」して作るため署名は引き継がれるが、
公開前に validate.py が署名と著者 Person を検査する。
"""
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

SIGNATURE_TEXT = "執筆：大石浩之（宅地建物取引士・代表取締役）"
SIGNATURE_HTML = (
    '<p class="author-signature" style="margin:28px 0 12px;font-size:15px;line-height:1.7">'
    "<strong>" + SIGNATURE_TEXT + "</strong>"
    ' <a href="https://oishi-hiroyuki.org/profile" rel="author">著者プロフィール</a></p>'
)
PERSON_ID = "https://oishi-hiroyuki.org/#person"
OLD_PERSON_ID = "https://fudosan.atawi.link/#oishi"
ORG_ID = "https://www.fujigaoka-service.co.jp/#organization"
LDJSON = re.compile(r'(<script type="application/ld\+json">)(.*?)(</script>)', re.S)


def person_node(extra=None):
    node = {
        "@type": "Person",
        "@id": PERSON_ID,
        "name": "大石浩之",
        "alternateName": "大石ひろゆき",
        "jobTitle": "代表取締役／宅地建物取引士",
        "url": "https://oishi-hiroyuki.org/",
        "worksFor": {"@id": ORG_ID},
    }
    if extra:
        for k, v in extra.items():
            node.setdefault(k, v)
    return node


def fix_blogposting(node):
    ty = node.get("@type")
    types = ty if isinstance(ty, list) else [ty]
    if "BlogPosting" not in types:
        return False
    changed = False
    if "Article" not in types:
        node["@type"] = ["BlogPosting", "Article"]
        changed = True
    want = person_node()
    author = node.get("author")
    if isinstance(author, dict) and author.get("@id") == PERSON_ID and author.get("name"):
        pass
    elif isinstance(author, dict) and set(author) == {"@id"}:
        # 参照のみ(旧 #oishi)。参照先 Person ノードを fix_person が付け替える。
        if author["@id"] != PERSON_ID:
            node["author"] = {"@id": PERSON_ID}
            changed = True
    else:
        node["author"] = want
        changed = True
    return changed


def fix_person(node):
    """旧 #oishi の Person ノード、または名前が大石浩之の独立 Person ノードを1人に束ねる。"""
    if node.get("@type") != "Person" or node.get("name") != "大石浩之":
        return False
    before = json.dumps(node, sort_keys=True, ensure_ascii=False)
    node["@id"] = PERSON_ID
    node["alternateName"] = "大石ひろゆき"
    node["jobTitle"] = "代表取締役／宅地建物取引士"
    node.setdefault("url", "https://oishi-hiroyuki.org/")
    node["worksFor"] = {"@id": ORG_ID}
    return json.dumps(node, sort_keys=True, ensure_ascii=False) != before


def process_json(raw):
    data = json.loads(raw)
    changed = False
    nodes = data.get("@graph", [data]) if isinstance(data, dict) else data
    has_article = False
    for n in nodes:
        if not isinstance(n, dict):
            continue
        ty = n.get("@type")
        types = ty if isinstance(ty, list) else [ty]
        if "BlogPosting" in types:
            has_article = True
            changed |= fix_blogposting(n)
    if not has_article:
        return None, False
    # BlogPosting が author を @id 参照にしている場合、同ブロック内の Person ノードを付け替える。
    has_person_node = False
    for n in nodes:
        if isinstance(n, dict) and n.get("@type") == "Person" and n.get("name") == "大石浩之":
            has_person_node = True
            changed |= fix_person(n)
    # 参照のみで Person ノードが同ブロックに無い場合は、ノードを追加して参照を解決可能にする。
    for n in nodes:
        if isinstance(n, dict) and "BlogPosting" in (n["@type"] if isinstance(n.get("@type"), list) else [n.get("@type")]):
            a = n.get("author")
            if isinstance(a, dict) and set(a) == {"@id"} and not has_person_node and "@graph" in data:
                data["@graph"].append(person_node())
                changed = True
                has_person_node = True
    return data, changed


def dump_like(original, data):
    spaced = ('", "' in original) or ('": "' in original)
    if spaced:
        return json.dumps(data, ensure_ascii=False)
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def apply(html):
    changed = False
    # --- JSON-LD ---
    def sub(m):
        nonlocal changed
        raw = m.group(2)
        try:
            data, ch = process_json(raw)
        except Exception:
            return m.group(0)
        if data is None or not ch:
            return m.group(0)
        changed = True
        return m.group(1) + dump_like(raw, data) + m.group(3)

    html = LDJSON.sub(sub, html)
    # --- 署名 ---
    if SIGNATURE_TEXT not in html:
        nl = "\r\n" if "\r\n" in html else "\n"
        body_start = html.find("<body")
        anchor = html.find('<div class="author-card"', body_start if body_start > 0 else 0)
        if anchor < 0:
            idx = html.find('data-common-karte-cta="true"')
            anchor = html.rfind("<", 0, idx) if idx >= 0 else -1
        if anchor < 0:
            # 共通CTAを持たない旧記事は「参考にした公式情報」見出しの直前
            m = re.search(r"<h2[^>]*>参考にした", html)
            anchor = m.start() if m else -1
        if anchor >= 0:
            html = html[:anchor] + SIGNATURE_HTML + html[anchor:]
            changed = True
    return html, changed


def is_applied(html):
    if SIGNATURE_TEXT not in html:
        return False
    for m in LDJSON.finditer(html):
        try:
            d = json.loads(m.group(2))
        except Exception:
            continue
        for n in (d.get("@graph", [d]) if isinstance(d, dict) else d):
            ty = n.get("@type") if isinstance(n, dict) else None
            if ty and "BlogPosting" in (ty if isinstance(ty, list) else [ty]):
                a = n.get("author")
                if "Article" not in (ty if isinstance(ty, list) else []):
                    return False
                if not (isinstance(a, dict) and a.get("@id") == PERSON_ID):
                    return False
    return True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv
    paths = args or sorted(glob.glob(os.path.join(ROOT, "blog", "*", "index.html")))
    n = 0
    for p in paths:
        p = os.path.abspath(p)
        raw = open(p, "rb").read().decode("utf-8")
        if check:
            if not is_applied(raw):
                print("未適用:", os.path.relpath(p, ROOT))
                n += 1
            continue
        new, ch = apply(raw)
        if ch:
            open(p, "wb").write(new.encode("utf-8"))
            n += 1
    print(("未適用 %d 件" if check else "更新 %d 件") % n)


if __name__ == "__main__":
    main()
