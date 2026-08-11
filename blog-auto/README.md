# blog-auto — 地区×不動産ブログの毎日2本 自動投稿

磐田市の地区ごとの土地事情をテーマにしたブログ記事を、**毎日2本、自動で生成して公開する**仕組みです。
2026-08-11 に構築しました。

## 何が動いているか

Claude Code のスケジュールタスク `fudosan-blog-daily` が毎日決まった時刻に起動し、
[`daily-post.md`](daily-post.md) の手順どおりに記事を2本書いて GitHub へ push します。
Cloudflare Pages が自動デプロイし、`https://fudosan.atawi.link/blog/` に載ります。

```
themes.json（テーマの在庫）
   ↓ pick_themes.py が2件選ぶ（既出と重複するものは自動で見送り）
一次情報を WebSearch / WebFetch で裏取り
   ↓
make_cover_square.py が表紙画像（760×760）を作る
   ↓
記事HTMLを書く（直近の記事を雛形にする）
   ↓ validate.py が検査（1件でもNGなら公開しない）
publish.py が一覧ページに載せ、themes.json を published にする
   ↓
git push → Cloudflare Pages が自動デプロイ
```

## ファイル

| ファイル | 役割 |
|---|---|
| `themes.json` | テーマの在庫。地区×論点で18本ぶん。既出62本と重複しない切り口だけを入れてある |
| `daily-post.md` | 毎日の作業手順。スケジュールタスクが読む本体 |
| `scripts/pick_themes.py` | 次に書く2件を選ぶ。既出キーワードが多いテーマは自動で見送る |
| `scripts/make_cover_square.py` | 表紙バナー（760×760・ロゴブルー）を生成 |
| `scripts/validate.py` | 公開前の検査。7種類の不具合を見る |
| `scripts/publish.py` | 一覧ページへの追加と `themes.json` の更新 |

## 検査（validate.py）が見ているもの

1. HTMLタグの入れ子
2. JSON-LD が壊れていないか、BlogPosting と BreadcrumbList が揃っているか
3. 必須要素（表紙、Q&A要点ブロック、固定フレーズ、免責、出典、共通CTA、電話番号）
4. 本文への英単語・キリル文字の混入
5. canonical / og:url / パンくずのURLが実際のパスと一致しているか
6. 内部リンクの実在
7. 表紙画像があり 760×760 か

**1件でもNGが出れば公開されません。**

## テーマの補充

`themes.json` の `pending` が尽きると、記事を書かずに「テーマの補充が必要」と報告して終了します。
補充するときは、**必ず既出チェックをしてから**追加してください。

```bash
grep -rl "キーワード" blog/*/index.html | wc -l
```

3本以上ヒットする語は、その論点が既に厚いので主題にしない方が無難です。

## 手動で1回だけ走らせたいとき

Claude Code で `/schedule` からタスクを選んで実行するか、`daily-post.md` の手順を上から実行します。

## 止めたいとき

Claude Code で `/schedule` を開き、`fudosan-blog-daily` を無効化するか削除します。

## 注意

- **スケジュールタスクはアプリが起動している間だけ動きます。** アプリを閉じている時刻に実行予定が来た場合は、次回起動時に実行されます。
- **リポジトリ直下の `index.html` はサイトのトップページです。** 記事の作業で触ってはいけません。構築時に、テスト用スクリプトの出力先が相対パスにフォールバックしてトップページを上書きする事故がありました（未コミットのため復元済み）。`daily-post.md` にも同じ注意を書いてあります。
- 記事の内容は毎回、省庁・県・市の一次情報で裏取りしています。それでも**制度は年度で変わる**ため、公開後に気になる記述があれば直してください。修正も GitHub 経由で行います。
