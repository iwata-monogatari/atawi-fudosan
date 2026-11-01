# 物件住所の必須条件（2026-11-01、ユーザー指定）

- 不動産の相談・調査・査定申込では、物件所在地を番地・地番まで必須にする。市町村・町名だけ、番地空欄、不明、丁目だけの申込を受け付けない。
- ブログ本文、FAQ、JSON-LD、LINE案内、生成用データ・テンプレートを同じ条件にする。過去記事や過去の作業記録を雛形にして受付条件を戻さない。
- 番地・地番が不明な方には、固定資産税の課税明細書や登記書類で確認する案内を入れる。
- 入力欄の課税明細書案内は `_tools/property-address-help.mjs` を共通原稿とし、`node _tools/build-property-address-help.mjs` で全12フォームへ反映する。土地の所在・地番、枝番、宛先住所・家屋番号との違いの説明を維持する。LP再生成も同じ原稿を使う。
- 課税明細書の見本図 `assets/property-tax-statement-example.svg` は架空の記載例。所在地・地番の印、代替テキスト、拡大リンクを維持し、実在する個人の課税資料を使わない。
- 600px以下では `assets/property-tax-statement-example-mobile.svg` をpictureで表示する。スマホ用の2欄を大きくした図と通常図の切替を維持し、変更時は320〜390px幅で文字・矢印・横はみ出しを確認する。
- 拡大リンクは `assets/property-tax-statement-example.html` を別タブで開く。見本図の上に「見終わったらこのタブを閉じると、入力途中のフォームに戻れます。」を表示し、入力途中のフォームを再読込・移動させない。共通原稿とLP再生成でこの導線を維持する。
- フォームの必須属性・共通ブラウザ検証・両APIの検証を維持する。`assets/property-address-core.mjs` が共通判定の生成元。変更後は `node _tools/build-property-address.mjs`。
- 家族用の非送信メモや地域の対応可否チェックは住所申込フォームではない。ただし実際の申込には番地・地番が必要と明記する。
- ブログ作成、部分更新、全ページ再生成の後、push 前に必ず次を実行する。失敗したら原因を直す。検査の除外・削除や直接アップロードで回避しない。

```sh
node _tools/check-property-address-policy.mjs
node --test tests/*.test.cjs
```

- 公開経路は GitHub main → Cloudflare Pages。Cloudflare の build command でも上記2検査を実行する。異常時は公開を止め、直前の正常な公開版を維持する。
- 検査対象には新規記事も含む。`docs/`（過去の作業記録）・`tests/`（意図的な異常値）等の除外を、公開原稿や生成元の置き場として使わない。
- 他者の未commitやブログ更新を上書きせず、公開直前に最新 main を照合し、必要な自差分だけ通常の fast-forward push で反映する。
