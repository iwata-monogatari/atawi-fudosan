# 実家ガイド 記事データ仕様（2026-08-29 改定）

作り直しの執筆者向け。1記事＝1つのJSONオブジェクトを
`jikka-guide/data/rebuilt/<slug>.json` に書く。

## 満たすべき数値

| 項目 | 値 |
|---|---|
| 本文 | **10,000〜11,500字**（狙い10,800前後） |
| 見出し（sections） | **5件**。1章あたり **2,000〜2,300字** |
| 挿絵（figure） | **3枚**。第1章・第3章・第5章に1枚ずつ |

本文字数＝`lead` ＋ 各sectionの `intro`/`paragraphs`/`checklist`/`table`本文。
見出し文と図解の中身は字数に含まれない。

11,725字を超えると挿絵が4枚必要になる。**11,500字を超えないこと。**

自己検証：`node _tools/check-rebuilt.mjs <slug>`（合格すると「○ 新仕様を満たしています」）。
合格するまで直すこと。

## ページのキー

```
slug, title, description, lead, summary, searchIntent, category,
published, modified, cluster, heroSrc, hero, pictograms,
sections, faqs, ctaLabel, fieldNotes, scopeNote, sources, relatedLinks
```

- `keep.*`（素材ファイル内）の値は**そのまま引き継ぐ**：published / modified / cluster /
  heroSrc / hero / pictograms / ctaLabel / scopeNote / **sources** / relatedLinks
- `modified` だけは `"2026-08-29"` に更新する。
- `sources` は**既存の検証済みURLのみ**。新しいURLを作らない・推測しない。
- `title` / `description` / `searchIntent` / `category` は素材の値を土台にする。
  titleは検索意図に合っていれば変えなくてよい。

## sectionのキー

```
heading, intro, paragraphs, checklist, table, figure
```

- `heading` … 章見出し。素材の `newOutline`（5件）を土台に、内容に合わせて調整してよい。
- `intro` … その章の要点1〜2文（太字リード扱い）
- `paragraphs` … 段落の配列。1章あたり**7〜9段落**が目安
- `checklist` … 任意。確認項目の配列
- `table` … 任意。`{caption, headers:[...], rows:[[...],[...]]}`
- `figure` … 第1・3・5章のみ（下記）

## 図解 figure の3タイプ

第1章＝`flow`、第3章＝`relation`、第5章＝`matrix` を基本とする。
内容に合わないときは入れ替えてよいが、**3枚とも同じtypeにはしない**。
`tone` は省略（既定）/ `"warm"`（注意・強調）/ `"plain"`（弱め）の3段階。

### flow — 順番のある工程
```json
{"type":"flow","title":"…","caption":"…","note":"…",
 "steps":[{"label":"0〜3日","title":"…","body":"…","tone":"warm"}]}
```
`label` は2文字以内なら丸バッジ、3文字以上は角バッジ。4〜6ステップが収まりよい。

### relation — 中心の対象と、関わる立場・権限の関係
```json
{"type":"relation","title":"…","caption":"…","note":"…",
 "center":{"title":"実家の土地と建物","body":"…"},
 "nodes":[{"relation":"決められる","title":"登記名義人本人","body":"…","tone":"warm"}]}
```
`relation` は接続線の上に出る短いラベル（4〜6字）。nodesは3〜4件。

### matrix — 2軸で選択肢を仕分ける
```json
{"type":"matrix","title":"…","caption":"…","axisNote":"横軸＝… ／ 縦軸＝…",
 "columns":[{"label":"…"},{"label":"…"}],
 "rows":[{"label":"…","cells":[{"title":"…","body":"…","tone":"warm"}]}],
 "note":"…"}
```
2×2（columns2件 × rows2件）が基本。cellsの数はcolumnsと同数。

図解は装飾ではなく、**本文にある判断の構造そのもの**を描く。
`caption` は図の読み方を説明する2〜3文。

## faqs / fieldNotes

```json
"faqs":[{"question":"…","answer":"…"}]              // 4〜6件
"fieldNotes":{"keyPoints":[…], "pitfalls":[…], …}   // 素材の構造を踏襲
```

## 書き方の約束

1. **旧記事の文をそのまま使わない。** 全記事横断の重複検査があり、同じ文が
   複数記事に出ると検証で落ちる。素材の旧本文は「何を扱う記事か」を知るための
   参考であって、写す対象ではない。章構成も文体も作り直す。
2. **水増ししない。** 2,000字は「言い換えを重ねる」ではなく「具体を足す」で埋める。
   手続きの順番、必要な書類の名前、窓口、費用の幅、判断の分岐、失敗例。
3. **地域を具体で書く。** 磐田市・袋井市・森町・掛川市・浜松市の一部が商圏。
   市の窓口名、地区の実情（掛塚の細街路、池田の堤防、匂坂の農振農用地、
   笠原の茶園など）、遠州の気候（冬の空っ風、台風）を使える場面では使う。
   ただし**確認できない固有名詞や数字は書かない**。
4. **法令を断定しない。** 「原則として」「〜の取扱いがあります」「適用の可否は
   税理士へ」で止める。税額・補助金額・期限の断定は避ける。
5. **同じ言い回しを1記事内で繰り返さない。** 30字級の同一フレーズが同一記事に
   5回以上出ると検証で落ちる。
6. **売り込みにしない。** 記事は判断材料の整理。CTAは `ctaLabel` と共通CTAが
   受け持つので、本文で契約を促さない。
