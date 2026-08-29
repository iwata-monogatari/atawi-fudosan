# 実家ガイド生成

`data/pages.mjs` の構造化データから、ハブと詳細ページを生成します。生成済みHTMLを直接編集せず、データまたはテンプレートを直してください。

```powershell
node _tools/adapt-jikka-guide-data.mjs
node tools/visuals/generate-pictograms.mjs --input jikka-guide-data/pictograms.input.generated.json --out assets/visuals/pictograms
node _tools/build-jikka-guide.mjs
node _tools/validate-jikka-guide.mjs --expected=100 --strict-assets
```

別データを試す場合は、リポジトリルートからのパスを環境変数で指定できます。

```powershell
$env:JIKKA_GUIDE_DATA = 'jikka-guide-data/pages.mjs'
node _tools/build-jikka-guide.mjs
```

環境変数は3つあります。

| 変数 | 効果 |
| --- | --- |
| `JIKKA_GUIDE_DATA` | 読み込むデータセットを差し替える。validate 側でも同じ指定で章データを上書きできる |
| `JIKKA_GUIDE_PARTIAL=1` | 記事ページだけを書き出す。ハブ、`generated-pages.json`、`sitemap-core.xml` は更新しない。1記事だけ試すときに必ず付ける |
| `JIKKA_GUIDE_LEGACY=1` | 記事仕様の改定前（14章・挿絵なし）のデータをそのまま生成する。移行が終わるまでの退避用 |

## 本文中の図解（section.figure）

`section.figure = { type, title, caption, ... }` を書くと、章末にインラインSVGの図解が入ります。写真ではなく記事ごとに固有の図として生成するため、追加のアセットは不要です。実装済みの type は次の3種類です。

- `flow`… 手順フロー。`steps: [{ label, title, body, tone }]`
- `relation`… 関係図。`center: { title, body }` と `nodes: [{ relation, title, body, tone }]`
- `matrix`… 判断マトリクス。`axisNote`、`columns: [{ label }]`、`rows: [{ label, cells: [{ title, body, tone }] }]`

`tone` は省略時が標準色、`warm` が注意色、`plain` が控えめな色です。配色は `assets/guide.css` の `.gf-*` クラスで定義しているので、SVG側に色を直接書かないでください。

## 1ページの必須項目

- 英小文字・数字・ハイフンのみの一意な `slug`
- title、description、lead、summary、category、公開日、更新日
- `hero.webp` と具体的なalt。生成前のサンプル確認だけは `fallbackSrc` を指定可能
- 意味の異なるピクトグラム4点。それぞれsrc、alt、title、body
- sections は5〜6章（2,000字に見出し1つ）。本文は空白を除き10,000字以上14,000字以下
- 本文中の図解（`section.figure`）を3枚以上。3,350字に1枚の密度で判定する
- FAQ 2件以上
- 官公庁・自治体などの公式出典1件以上と確認日
- 次に読むページへの内部リンク

検証は文字数、h1、canonical、Article・FAQPage構造化データ、CTA三経路、出典、hero.webp、ピクトグラム4点、alt、画像ファイルの存在を確認します。`--strict-assets` を付けない場合だけ、画像欠損は警告扱いです。

企画JSONの各項目はアダプターが完成データへ変換します。`heroSrc` は任意で、ページから見た相対パス（通常は `hero.webp`）または `/assets/visuals/heroes/<cluster>.webp` のようなサイトルート絶対パスを指定できます。未指定時はページ固有の `hero.webp` を使い、初回だけ10クラスター別の既存写真風素材をフォールバックとして配置します。配置済みの画像は上書きしません。

公開前には本文の事実確認、公式リンクの疎通確認、PC・スマートフォンでの表示確認を別途行ってください。
