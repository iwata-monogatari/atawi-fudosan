#!/usr/bin/env python3
"""Googleビジネスプロフィール(GBP)の週次投稿の下書きを、直近のブログ記事から作る。

GBP の「最新情報」投稿は本文 1,500 文字まで・リンク1本。AI検索と Google マップの両方に
「この会社は毎週、磐田・袋井の実家・空き家の情報を出している」と見せるのが目的。
投稿自体は GBP の管理画面(business.google.com)から人が貼り付ける。自動投稿はしない。

使い方:
  python -X utf8 _tools/gbp-weekly-post.py            # 直近7日の記事から下書きを docs/growth/gbp/ に出す
  python -X utf8 _tools/gbp-weekly-post.py --days 14   # 期間を変える
  python -X utf8 _tools/gbp-weekly-post.py --print     # ファイルに書かず画面に出す
"""
import datetime as dt
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ORIGIN = "https://fudosan.atawi.link"
OUT_DIR = os.path.join(ROOT, "docs", "growth", "gbp")
GBP_LIMIT = 1500


def arg(name, default):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default


def meta(src, pat):
    m = re.search(pat, src)
    return m.group(1) if m else ""


def recent_posts(days):
    today = dt.date.today()
    posts = []
    # 未コミットの下書きディレクトリ(まだ公開されていない)は除く
    tracked = set(subprocess.run(["git", "ls-files", "--", "blog/*/index.html"], cwd=ROOT,
                                 capture_output=True, text=True).stdout.split())
    for d in sorted(glob.glob(os.path.join(ROOT, "blog", "2*", "index.html"))):
        slug = os.path.basename(os.path.dirname(d))
        if f"blog/{slug}/index.html" not in tracked:
            continue
        try:
            day = dt.date(int(slug[:4]), int(slug[4:6]), int(slug[6:8]))
        except ValueError:
            continue
        if (today - day).days > days or day > today:
            continue
        s = open(d, encoding="utf-8").read()
        title = meta(s, r'<meta property="og:title" content="([^"]*)"') or meta(s, r"<title>([^<|｜]*)")
        title = re.sub(r"｜.*$", "", title).strip()
        desc = meta(s, r'<meta name="description" content="([^"]*)"')
        posts.append({"date": day, "slug": slug, "title": title, "desc": desc, "url": f"{ORIGIN}/blog/{slug}/"})
    return posts


def pick(posts, n=3):
    # 地名入り(磐田・袋井・森町)の記事を優先。GBP はローカル検索なので地名が効く。
    def score(p):
        s = 0
        for w in ("磐田", "袋井", "森町", "掛川"):
            if w in p["title"] or w in p["desc"]:
                s += 2
        for w in ("実家", "空き家", "相続", "施設"):
            if w in p["title"]:
                s += 1
        return (s, p["date"])
    return sorted(posts, key=score, reverse=True)[:n]


def draft(posts, week_label):
    lead = posts[0]
    lines = [
        f"【今週の実家・空き家メモ｜{week_label}】",
        "",
        f"■ {lead['title']}",
        lead["desc"],
        "",
    ]
    for p in posts[1:]:
        lines.append(f"■ {p['title']}")
        short = re.split(r"[。]", p["desc"])[0]
        lines.append(short + "。" if short else "")
        lines.append("")
    lines += [
        "磐田市・袋井市・森町の実家・空き家について、売るかどうか決める前の整理を無料で行っています（ふじがおか実家カルテ）。",
        "親の施設入居、相続登記が終わっていない、荷物が残ったまま、県外にお住まい——そのままの状態でご相談ください。",
        "",
        "▼ 記事の続きはこちら",
        lead["url"],
    ]
    body = "\n".join(lines)
    while len(body) > GBP_LIMIT and len(posts) > 1:
        posts = posts[:-1]
        return draft(posts, week_label)
    return body


def main():
    days = int(arg("--days", "7"))
    posts = recent_posts(days)
    if not posts:
        print(f"直近{days}日に記事がありません")
        return
    chosen = pick(posts)
    today = dt.date.today()
    week_label = f"{today.year}年{today.month}月第{(today.day - 1) // 7 + 1}週"
    body = draft(chosen, week_label)
    checklist = "\n".join([
        "",
        "---",
        "## 投稿手順（約5分）",
        "1. business.google.com → 富士ヶ丘サービス → 「最新情報を追加」",
        "2. 上の本文を貼り付け（1,500文字以内。現在 %d 文字）" % len(body),
        "3. 写真：記事の cover.jpg（%s/blog/%s/cover.jpg）か、事務所・現地の写真を1枚" % (ORIGIN, chosen[0]["slug"]),
        "4. ボタン：「詳細」→ リンク先は本文末尾のURL",
        "5. 投稿後、口コミに未返信があればその場で返信（docs/growth/gbp-playbook.md の返信テンプレ）",
        "",
        "## 今週の候補記事（スコア順）",
    ] + [f"- {p['date']} {p['title']} — {p['url']}" for p in posts])
    text = f"# GBP 週次投稿 下書き {today.isoformat()}\n\n```\n{body}\n```\n{checklist}\n"
    if "--print" in sys.argv:
        print(text)
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{today.isoformat()}-post.md")
    open(out, "w", encoding="utf-8", newline="\n").write(text)
    print("wrote", os.path.relpath(out, ROOT), f"({len(body)} 文字)")


if __name__ == "__main__":
    main()
