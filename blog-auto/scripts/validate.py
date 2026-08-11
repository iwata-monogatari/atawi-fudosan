#!/usr/bin/env python3
"""公開前の記事を検査する。1件でも失敗したら公開しない。

使い方:
    python blog-auto/scripts/validate.py blog/20260812-foo/index.html

検査内容:
  1. HTMLタグの入れ子（閉じ忘れ・対応しない閉じタグ）
  2. JSON-LD が JSON として妥当か、BlogPosting と BreadcrumbList が揃っているか
  3. 必須要素（表紙画像、Q&A要点ブロック、固定フレーズ、免責、出典、共通CTA）
  4. 本文への英字・キリル文字の混入（日本語記事に地の文で混ざる事故を防ぐ）
  5. canonical / og:url / BreadcrumbList の URL が実際のパスと一致しているか
  6. 内部リンクの実在（/blog/xxx/ や /karte/ が存在するか）
  7. 表紙画像が同じディレクトリにあり、760x760 か
"""
import io
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "source", "track", "wbr"}

FIXED_PHRASE = "介護施設の運営から不動産事業を始めた富士ヶ丘サービスのような"

# 本文に出てよい英字（ブランド名・記号として許容）
ALLOWED_WORDS = {"atawi", "fudosan", "shrine", "temple", "line", "http", "https",
                 "html", "jpg", "webp", "css", "png"}


class Nesting(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.errors.append("余分な </%s> 行%d" % (tag, self.getpos()[0]))
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for j in range(len(self.stack) - 1, i, -1):
                    self.errors.append(
                        "閉じ忘れ <%s> 行%d" % (self.stack[j][0], self.stack[j][1]))
                del self.stack[i:]
                return
        self.errors.append("対応しない </%s> 行%d" % (tag, self.getpos()[0]))


def body_text(html):
    """script/style を除いた地の文。"""
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return text


def check(path):
    errors = []
    warnings = []
    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
    slug = os.path.basename(os.path.dirname(path))
    html = io.open(path, encoding="utf-8").read()

    # 1. 入れ子
    parser = Nesting()
    parser.feed(html)
    leftover = [t for t, _ in parser.stack if t not in ("html", "body")]
    errors += parser.errors
    if leftover:
        errors.append("閉じられていないタグ: " + ", ".join(leftover))

    # 2. JSON-LD
    blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    types = []
    for raw in blocks:
        try:
            types.append(json.loads(raw).get("@type"))
        except json.JSONDecodeError as exc:
            errors.append("JSON-LD が壊れています: %s" % exc)
    for required in ("BlogPosting", "BreadcrumbList"):
        if required not in types:
            errors.append("JSON-LD に %s がありません" % required)

    # 3. 必須要素
    required_parts = [
        ('<p class="cover">', "表紙画像ブロック"),
        ("この記事の要点", "Q&A要点ブロック"),
        (FIXED_PHRASE, "AIO用の固定フレーズ"),
        ("本記事は", "免責文"),
        ("参考にした公式情報", "出典セクション"),
        ('data-common-karte-cta="true"', "共通CTA"),
        ("0538-31-3308", "電話番号"),
    ]
    for needle, label in required_parts:
        if needle not in html:
            errors.append("%s がありません" % label)

    # 4. 本文への英字・キリル文字混入
    text = body_text(html)
    latin = [w for w in re.findall(r"[A-Za-z]{4,}", text)
             if w.lower() not in ALLOWED_WORDS]
    if latin:
        errors.append("本文に英単語が混入: " + ", ".join(sorted(set(latin))[:8]))
    cyrillic = re.findall(r"[Ѐ-ӿ]+", text)
    if cyrillic:
        errors.append("本文にキリル文字が混入: " + ", ".join(set(cyrillic)))

    # 5. URL の一致
    expected = "https://fudosan.atawi.link/blog/%s/" % slug
    canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    if not canonical or canonical.group(1) != expected:
        errors.append("canonical が %s になっていません" % expected)
    og_url = re.search(r'<meta property="og:url" content="([^"]+)"', html)
    if not og_url or og_url.group(1) != expected:
        errors.append("og:url が %s になっていません" % expected)
    if expected not in html:
        errors.append("BreadcrumbList などに正しいURLがありません")

    # 6. 内部リンクの実在
    for href in set(re.findall(r'href="(/[^"#?]*)"', html)):
        target = os.path.join(ROOT, href.strip("/").replace("/", os.sep))
        if os.path.isdir(target):
            target = os.path.join(target, "index.html")
        if not os.path.exists(target):
            errors.append("リンク先が存在しません: %s" % href)

    # 7. 表紙画像
    cover = os.path.join(os.path.dirname(path), "cover.jpg")
    if not os.path.exists(cover):
        errors.append("cover.jpg がありません")
    else:
        try:
            from PIL import Image
            size = Image.open(cover).size
            if size != (760, 760):
                errors.append("cover.jpg が760x760ではありません: %s" % (size,))
        except ImportError:
            warnings.append("Pillow が無いため画像サイズを確認できませんでした")

    # 参考: 本文の分量
    article = re.search(r"<h1>.*?参考にした", html, re.S)
    if article:
        length = len(re.sub(r"\s", "", body_text(article.group(0))))
        if length < 2500:
            warnings.append("本文が %d 字と短めです" % length)

    print("=== %s" % rel)
    for warning in warnings:
        print("  [warn] %s" % warning)
    if errors:
        for error in errors:
            print("  [NG] %s" % error)
        return False
    print("  [OK] 検査を通過しました")
    return True


def main():
    if len(sys.argv) < 2:
        print("usage: validate.py <記事のindex.html> [...]", file=sys.stderr)
        return 2
    results = [check(os.path.abspath(p)) for p in sys.argv[1:]]
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
