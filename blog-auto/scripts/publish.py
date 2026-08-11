#!/usr/bin/env python3
"""検査を通った記事を一覧ページへ載せ、themes.json を published に更新する。

使い方:
    python blog-auto/scripts/publish.py <slug> <テーマID> "<一覧に出すタイトル>" "<一覧に出す説明>"

git の commit / push はこのスクリプトでは行わない（呼び出し側で行う）。
一覧ページ blog/index.html の該当年月ブロックの先頭に <li> を1件挿入する。
年月ブロックが無ければ新しく作る。
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INDEX = os.path.join(ROOT, "blog", "index.html")
THEMES = os.path.join(ROOT, "blog-auto", "themes.json")


def japanese_date(slug):
    """20260812-foo → (2026年8月, 2026年8月12日)"""
    match = re.match(r"(\d{4})(\d{2})(\d{2})-", slug)
    if not match:
        raise SystemExit("slug の形式が YYYYMMDD-name ではありません: %s" % slug)
    year, month, day = (int(x) for x in match.groups())
    return "%d年%d月" % (year, month), "%d年%d月%d日" % (year, month, day)


def add_to_index(slug, title, desc):
    month_label, date_label = japanese_date(slug)
    html = io.open(INDEX, encoding="utf-8").read()

    if 'href="/blog/%s/"' % slug in html:
        print("一覧には既に載っています: %s" % slug)
        return

    entry = (
        '    <li>\n'
        '      <img class="thumb" src="/blog/{slug}/cover.jpg" alt="" loading="lazy">\n'
        '      <div>\n'
        '        <p class="e-date">{date}</p>\n'
        '        <p class="e-title"><a href="/blog/{slug}/">{title}</a></p>\n'
        '        <p class="e-desc">{desc}</p>\n'
        '      </div>\n'
        '    </li>\n'
    ).format(slug=slug, date=date_label, title=title, desc=desc)

    header = '<h2 class="ym">%s</h2>' % month_label
    if header in html:
        # その年月ブロックの <ul class="entries"> 直後に差し込む
        pos = html.index(header)
        ul = html.index('<ul class="entries">', pos) + len('<ul class="entries">')
        html = html[:ul] + "\n" + entry + html[ul:]
    else:
        # 年月ブロックごと新設し、最初の既存ブロックの前に置く
        block = '  %s\n  <ul class="entries">\n%s  </ul>\n\n' % (header, entry)
        anchor = re.search(r'  <h2 class="ym">', html)
        if not anchor:
            raise SystemExit("一覧ページの構造が想定と異なります")
        html = html[:anchor.start()] + block + html[anchor.start():]

    io.open(INDEX, "w", encoding="utf-8", newline="").write(html)
    print("一覧に追加しました: %s" % slug)


def mark_published(theme_id, slug):
    data = json.load(io.open(THEMES, encoding="utf-8"))
    for theme in data["themes"]:
        if theme.get("id") == theme_id:
            theme["status"] = "published"
            theme["published_slug"] = slug
            break
    else:
        print("警告: themes.json に %s が見つかりません" % theme_id, file=sys.stderr)
        return
    io.open(THEMES, "w", encoding="utf-8", newline="").write(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("themes.json を更新しました: %s → published" % theme_id)


def main():
    if len(sys.argv) != 5:
        print(__doc__, file=sys.stderr)
        return 2
    _, slug, theme_id, title, desc = sys.argv
    add_to_index(slug, title, desc)
    mark_published(theme_id, slug)
    return 0


if __name__ == "__main__":
    sys.exit(main())
