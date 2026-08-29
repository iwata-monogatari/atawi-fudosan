# 新規記事の追加ルール（WRITING-SPEC.mdの追補）

新規記事は既存記事の作り直しと違い、旧本文が無いのでゼロから書く。
基本の数値仕様（本文10,000〜11,500字・5見出し・挿絵3枚）は`WRITING-SPEC.md`と同じ。
以下は新規記事だけに追加されるルール。

## 出典（最重要・厳守）

素材ファイルの `verifiedSources` に、この記事用に**私が事前に実在確認済みの出典**を
入れてある。**sourcesにはこのリストのURLだけを使うこと。新しいURLを書かない・
推測しない・「〜省の案内による」のような出典元不明の言い回しで濁さない。**
verifiedSourcesが記事の主張をすべてカバーしない場合は、カバーできる範囲の主張に
絞って書くか、「詳細は専門家・窓口へ確認」で止めること。

`sources` の形式は `[{"url":"...","title":"..."}]`。verifiedSourcesの値をそのまま使う。

## ピクトグラム（4件・pictogramPlanとして書く）

既存記事のように仕上がったSVGパスを書くのではなく、**生成前のプラン**を書く。
`pictograms` ではなく `pictogramPlan` というキー名で、4件を書くこと
（fact→risk→action→choiceの順、この順番を守る）。

```json
"pictogramPlan": [
  {"primary":"document","secondary":"calculator","alt":"...を示すピクトグラム","title":"短い見出し","body":"1文の説明"},
  {"primary":"shield","secondary":"vacant-house","alt":"...","title":"...","body":"..."},
  {"primary":"registry","secondary":"checklist","alt":"...","title":"...","body":"..."},
  {"primary":"route-split","secondary":"handshake","alt":"...","title":"...","body":"..."}
]
```

`primary`/`secondary` は次のいずれかから、記事の内容に合うものを選ぶ:
`house, vacant-house, document, documents, registry, shield, key, checklist,
dialogue, route-split, family, link, search, road, boundary, calculator,
clock, phone, pin, handshake, coins`

## hero画像

素材ファイルの `heroPlan.fallbackSrc` と `heroPlan.alt` をそのまま使う。
`hero` キーは `{"src":"hero.webp","fallbackSrc":<heroPlan.fallbackSrcの値>,"alt":<heroPlan.altの値>}`
の形にする（既存記事と同じ形式）。

## その他のキー

- `published` と `modified` はどちらも "2026-08-29" にする。
- `cluster` は `category` から適当な英語スラッグ風の短い文字列を自分で付けてよい
  （例: "money", "legal-process"）。
- `ctaLabel` は「無料で実家カルテを申し込む」など、既存記事と同じトーンで自分で書く。
- `scopeNote` は「この記事は一般的な制度・手続きの説明であり、個別の税務・法務判断は
  専門家にご確認ください」の趣旨で自分で書く。
- `relatedLinks` は空配列 `[]` でよい（後で人手でリンクを足す）。
- `faqs` は4〜6件。

## 書かないこと

- 具体的な税額・手数料額・補助金額の断定。verifiedSourcesに幅や計算式があれば
  それは書いてよいが、「〇〇円になります」と言い切らない。
- 磐田市・袋井市・森町以外の自治体固有の制度（浜松市・掛川市の記事を除く）。
- 存在確認できない窓口名・部署名。「市の◯◯を担当する窓口」のように一般化する。
