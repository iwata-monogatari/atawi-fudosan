# FGA pictogram generator

ページデータJSONから、各ページ4枚（`fact` / `risk` / `action` / `choice`）の軽量なSVGピクトグラムを生成します。外部パッケージやフォントは不要です。

## 実行

リポジトリのルートで次を実行します。

```sh
node tools/visuals/generate-pictograms.mjs \
  --input tools/visuals/sample-pages.json \
  --out assets/visuals/pictograms
```

Windows PowerShellでは改行せず同じ引数を渡せます。

```powershell
node tools/visuals/generate-pictograms.mjs --input tools/visuals/sample-pages.json --out assets/visuals/pictograms
```

`--check` を付けると書き込みをせず、入力検証だけを行います。生成先にはページ別SVG、`manifest.generated.json`、埋め込み例の `example.generated.html` が作成されます。

## 入力ルール

- ルートはページオブジェクトの配列
- `page_id` は英小文字・数字・ハイフンのみで一意
- `pictograms` は4件ちょうど
- roleは `fact`、`risk`、`action`、`choice` を各1件
- `primary` と `secondary` はスクリプト内の `SHAPES` に登録された名前
- `badge` と `background` も許可リストから選択
- ピクトが見出しラベルと同じ意味なら `alt` は空文字を推奨

新しい図形を増やす場合は、`SHAPES` に固定SVG断片を追加してください。入力値をSVGとして直接挿入しない設計なので、JSON由来のスクリプト混入を防げます。

登録済みの図形は次のとおりです。

`house`, `vacant-house`, `document`, `documents`, `registry`, `shield`,
`key`, `checklist`, `dialogue`, `route-split`, `family`, `link`, `search`,
`road`, `boundary`, `calculator`, `clock`, `phone`, `pin`, `handshake`, `coins`

登録済みbadgeは `search`, `attention`, `step-1`, `pause-ok`, `fact`, `check`、背景は `sky`, `sky-2`, `paper`, `yellow-soft` です。

HTMLでは `assets/visuals/pictograms.css` を読み込み、生成された `example.generated.html` の構造を利用します。

## 実家ガイド100ページの一括生成

`jikka-guide-data/pages.json` の `key` / `label` / `caption` 形式は専用アダプターで変換します。

```powershell
node tools/visuals/build-jikka-guide-pictograms.mjs --check
node tools/visuals/build-jikka-guide-pictograms.mjs
```

出力は `/jikka-guide/<slug>/images/pictogram-01.svg`〜`04.svg` です。role、図形、badge、背景色はslug付きkeyの意味suffixから決定的に割り当て、入力の並び順も同時に検証します。`jikka-guide/pictograms-manifest.json` に各画像のrole、alt、意味部品、参照URL、容量、SHA-256を記録します。ビルドは100ページ、400ファイル、400件の一意なSHA-256を前後2回検証し、一つでも条件を満たさなければ失敗します。
