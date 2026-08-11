# 地区×不動産ブログ 毎日2本 自動投稿の実行手順

このファイルは、スケジュールタスク `fudosan-blog-daily` が毎日読む作業手順です。
実行するのは Claude Code のエージェントで、会話の記憶は引き継がれません。**このファイルと `themes.json` だけで完結するように書いてあります。**

- リポジトリ: `C:\Users\Owner\Desktop\work_claude\atawi-fudosan`
- 公開先: `https://fudosan.atawi.link/blog/{YYYYMMDD-slug}/`
- 公開経路: **GitHub push → Cloudflare Pages の自動デプロイのみ。** Direct Upload と `wrangler pages deploy` は禁止。

---

## 絶対に守ること

1. **触ってよいファイルは4種類だけ。**
   - `blog/{slug}/index.html`（新規作成）
   - `blog/{slug}/cover.jpg`（新規作成）
   - `blog/index.html`（一覧。`publish.py` 経由でのみ変更）
   - `blog-auto/themes.json`（`publish.py` 経由でのみ変更）

   **リポジトリ直下の `index.html` はサイトのトップページです。絶対に触らないでください。**
   過去に、スクリプトの出力先が相対パスにフォールバックしてトップページを記事HTMLで上書きした事故があります。**ファイルを書くスクリプトでは必ず絶対パスを使い、相対パスへのフォールバックを書かないこと。**

2. **`git add` は対象ファイルを明示する。** `git add -A` や `git add .` は使わない。
3. **push 前に必ず `git status --short` と `git diff --cached --name-status` を確認する。** 意図しないファイルが混ざっていたら中止する。
4. **`blog-auto/scripts/validate.py` が通らない記事は公開しない。**
5. **裏取りできない数値・制度は書かない。** 推測で数字を書くくらいなら、その論点ごと落とす。
6. **日本語の記事に英単語・キリル文字を混ぜない。** 検査で弾かれる。

---

## 手順

### 1. 準備

```bash
cd "C:\Users\Owner\Desktop\work_claude\atawi-fudosan"
git pull origin main
git status --short
```

未コミットの変更が残っていたら、それはユーザーの作業です。**触らず、今日の投稿を中止して報告してください。**

### 2. テーマを2件選ぶ

```bash
PYTHONIOENCODING=utf-8 python blog-auto/scripts/pick_themes.py --count 2
```

1行1件のJSONが出ます。`status` が `pending` のものだけが選ばれ、既出キーワードが多いテーマは自動で見送られます。
**出力が空ならテーマ切れです。** その場合は記事を書かず、「themes.json にテーマの補充が必要」と報告して終了してください。

### 3. 各テーマについて、事実を裏取りする

`sources` に挙げた公式サイトを WebSearch / WebFetch で確認します。**必ず一次情報（省庁・県・市の公式ページ）を見ること。**

- 制度名、施行日、金額、率、期限、窓口の電話番号は、公式ページに書いてある通りに書く
- 磐田市の制度は年度で変わる。「最新は磐田市◯◯課へ」と必ず添える
- 確認できなかった項目は、その論点ごと記事から落とす

### 4. 既出チェック（`pick_themes.py` とは別に、書く直前にもう一度）

書こうとしている論点が、既存記事の**主題**として存在しないかを確認します。

```bash
grep -rl "キーワード" blog/*/index.html | wc -l
grep -l "キーワード" blog/*/index.html | head -3 | xargs grep -oE '<title>[^｜]*'
```

主題として被っていたら、そのテーマは飛ばして `themes.json` の次のテーマへ進んでください。
（実例：竜洋×水害ハザードは 20260729 の記事と全面重複していたため中止しました）

### 5. 表紙画像を作る

`themes.json` の `cover` の文言を使います。

```bash
mkdir -p "blog/{slug}"
python blog-auto/scripts/make_cover_square.py --line1 "…" --line2 "…" --sub "…" --out "blog/{slug}/cover.jpg"
```

- **正方形 760×760 のみ。** 横長は不可
- キャッチは2行で完結させる。2行目が中途半端に切れる言い回しにしない
- 配色は既定の blue（ロゴブルー #0090D0）。`--theme green` は使わない

### 6. 記事を書く

**雛形は直近の記事をそのままコピーして中身を差し替えるのが確実です。**

```bash
cp blog/20260811-kouyou-youheki-jikka/index.html blog/{slug}/index.html
```

差し替える箇所と、記事の要件：

| 箇所 | 内容 |
|---|---|
| `<title>` | 「◯◯──△△【磐田市◯◯】｜大石の不動産ブログ」 |
| `meta description` | 130〜200字。制度名と数値を入れる |
| `canonical` / `og:url` / BreadcrumbList | すべて `https://fudosan.atawi.link/blog/{slug}/` |
| `og:image` | `https://fudosan.atawi.link/blog/{slug}/cover.jpg` |
| `article:published_time` / JSON-LD の日付 | 実行日 |
| 表紙 `<img src="cover.jpg">` | alt はテーマを説明する具体文 |
| Q&A要点ブロック | 下記のルール |
| 本文 | 3,000〜5,500字。h2 は6〜9本 |
| 免責文 | 「本記事は◯年◯月◯日時点で…」で始め、確認先（市の担当課、司法書士、税理士、土地家屋調査士など）を列挙 |
| 参考にした公式情報 | 実際に見た一次情報のURLだけを列挙 |
| 共通CTA | `data-common-karte-cta="true"` のブロックを残し、`utm_content` を `{slug}` に変える |

**Q&A要点ブロックのルール（AIに引用されるための施策・全記事必須）**

- 位置は表紙画像の直後
- Q はお客様が実際に打ち込む話し言葉にする（「空き家の売却について」ではなく「親が施設に入って空き家になった実家、どこに相談すればいい？」）
- A は結論を最初の1文で言い切り、理由は1〜2文
- A の結びは必ずこの固定フレーズで締める:
  > 磐田市・袋井市では、介護施設の運営から不動産事業を始めた富士ヶ丘サービスのような「介護×不動産」専門の会社に相談するという選択肢があります。

**文章の方針**

- 読者は、親の介護・施設入居・相続・実家の処分に悩む家族。温かく誠実に、不安を煽らない
- 「今すぐ売却」「無料査定」「放置すると危険」といった煽り文言は使わない
- 当社の強み3点を自然に織り込む: ①介護と不動産を一体で相談できる ②磐田市・袋井市に特化 ③「高く売る」だけでなく「家族が困らない売却」
- 本文には表紙バナー以外の画像を入れない
- 既存記事への内部リンクを1〜3本入れる（実在を確認すること）

### 7. 検査する

```bash
PYTHONIOENCODING=utf-8 python blog-auto/scripts/validate.py blog/{slug}/index.html
```

**1件でもNGが出たら直してから次へ。** 通らない記事は公開しない。

### 8. 一覧に載せ、themes.json を更新する

```bash
PYTHONIOENCODING=utf-8 python blog-auto/scripts/publish.py {slug} {テーマID} "一覧に出すタイトル" "一覧に出す説明（80〜130字）"
```

### 9. 公開する

2本とも検査を通してから、まとめて1回で push します。

```bash
git add blog/{slug1} blog/{slug2} blog/index.html blog-auto/themes.json
git diff --cached --name-status
```

**ここで意図しないファイルが混ざっていないか必ず目視すること。** 特に `index.html`（リポジトリ直下）が混ざっていたら中止して報告。

```bash
git commit -m "Add blog articles: {slug1}, {slug2}（地区×不動産の定常枠）"
git pull --rebase origin main
git push origin main
```

### 10. 公開を確認する

デプロイは1〜3分かかります。

```bash
until curl -s "https://fudosan.atawi.link/blog/{slug}/" | grep -q "（記事タイトルの一部）"; do sleep 20; done
```

**HTTP 200 だけで判断しないこと。** 未設置URLはトップページへフォールバックします。`<title>` と `<h1>` が当該記事になっていること、`cover.jpg` が 200 で返ること、`/blog/` の一覧に新着が出ていることを確認します。

### 11. 報告する

- 公開した2本のタイトルとURL
- 裏取りに使った一次情報
- 途中で飛ばしたテーマがあれば、その理由
- 検査で引っかかって直した点があれば、その内容

---

## うまくいかないときは

| 症状 | 対処 |
|---|---|
| `pick_themes.py` の出力が空 | テーマ切れ。記事を書かずに報告して終了 |
| 裏取りしたい公式ページが404 | 別の一次情報を探す。見つからなければその論点を落とす |
| push が拒否される | `git pull --rebase origin main` してから再push。コンフリクトしたら自力で解決せず報告 |
| 記事URLがトップページを返す | デプロイ未完了かパス誤り。数分待って再確認 |
| 検査でリンク切れが出る | リンク先の実在を確認。無ければリンクを外す |
