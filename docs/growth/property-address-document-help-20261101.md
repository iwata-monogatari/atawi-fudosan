# 入力欄の課税明細書案内（2026-11-01）

全12申込フォームの住所・番地欄直下に、課税明細書の土地一覧から所在・地番を確認する3手順と枝番の例を常時表示する。通知書の宛先住所や家屋番号との取り違え、自治体ごとの欄名の差、書類を確認できない場合の市町の担当窓口も案内する。必須条件や送信処理は変更しない。

共通原稿は `_tools/property-address-help.mjs`。静的フォームは `node _tools/build-property-address-help.mjs`、LPは既存のLP生成から反映。公開前検査で共通原稿との差異を検出し、既存の12フォーム検査で案内の削除も検出する。

参照した自治体資料（2026-11-01取得）：
- 袋井市「固定資産税・都市計画税 納税通知書をご覧ください」 https://www.city.fukuroi.shizuoka.jp/soshiki/7/2/koteishisan/1422535327198.html
- 袋井市「納税通知書・課税明細書の見方」令和8年度 https://www.city.fukuroi.shizuoka.jp/material/files/group/21/notu_mikata_R8-1.pdf
- 磐田市「固定資産税・都市計画税の概要」納税通知書の見方 https://www.city.iwata.shizuoka.jp/_res/projects/default_project/_page_/001/001/408/2024062601.pdf

番地・地番を確認するための説明に限定し、税額や納税義務、証明書の発行可否を判断しない。実際の納税資料・個人情報は使用していない。
