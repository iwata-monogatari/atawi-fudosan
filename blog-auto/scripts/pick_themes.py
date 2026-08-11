#!/usr/bin/env python3
"""次に書くテーマを選ぶ。既出記事と主題が重複するものは自動で skipped にする。

使い方:
    python blog-auto/scripts/pick_themes.py            # 2本選ぶ（既定）
    python blog-auto/scripts/pick_themes.py --count 1  # 1本だけ

出力: 選ばれたテーマのJSON（1行1テーマ）。呼び出し側はこれを読んで執筆する。
themes.json は書き換えない（公開が終わってから mark_published.py で更新する）。
"""
import argparse
import glob
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
THEMES = os.path.join(ROOT, "blog-auto", "themes.json")

# 既出と判定するしきい値。この本数以上ヒットしたら「主題として既出」とみなす。
# 1〜2本のヒットは、別テーマの記事内で言及されているだけのことが多いので通す。
OVERLAP_LIMIT = 3


def load_corpus():
    """公開済み記事の本文をまとめて読む。"""
    corpus = {}
    for path in glob.glob(os.path.join(ROOT, "blog", "*", "index.html")):
        slug = os.path.basename(os.path.dirname(path))
        with io.open(path, encoding="utf-8") as f:
            corpus[slug] = f.read()
    return corpus


def overlap_count(word, corpus):
    """その語を含む既出記事の本数。"""
    return sum(1 for html in corpus.values() if word in html)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=2)
    args = parser.parse_args()

    with io.open(THEMES, encoding="utf-8") as f:
        data = json.load(f)
    corpus = load_corpus()

    picked = []
    for theme in data["themes"]:
        if len(picked) >= args.count:
            break
        if theme.get("status") != "pending":
            continue

        # 既出チェック: check_words の過半数が既出しきい値を超えていたら見送る
        hits = [(w, overlap_count(w, corpus)) for w in theme.get("check_words", [])]
        heavy = [w for w, n in hits if n >= OVERLAP_LIMIT]
        if hits and len(heavy) > len(hits) / 2:
            theme["_skip_reason"] = "既出多数: " + ", ".join(
                "%s(%d本)" % (w, n) for w, n in hits
            )
            print(
                "SKIP %s / %s" % (theme["id"], theme["_skip_reason"]),
                file=sys.stderr,
            )
            continue

        theme["_overlap"] = {w: n for w, n in hits}
        picked.append(theme)

    if not picked:
        print("ERROR: 書けるテーマがありません。themes.json を追加してください。", file=sys.stderr)
        return 1

    for theme in picked:
        print(json.dumps(theme, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
