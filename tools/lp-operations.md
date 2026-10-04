# 悩み別LPの更新・計測

## ページを更新する

本文は `lp/content.json`、構成は `tools/generate-consultation-lps.mjs`、表示は `assets/consultation-lp.css`、フォームは `assets/consultation-lp.js`。

本文変更後は `node tools/generate-consultation-lps.mjs` を実行し、生成されたHTMLもコミットする。公開済みの体験談にない事実を加えず、カルテの架空見本と実績を区別する。

## LPごとの申込を確認する

既存の解析トラッカーに `lp_theme` と `page_version: concern-lp-v1` を付けて送る。

| イベント | 意味 |
| --- | --- |
| lp_landing | LPを開いた |
| lp_cta_click | ページ内申込ボタンを押した（locationで場所を区別） |
| lp_form_view | フォームの見出しが見えた |
| lp_form_start | 入力を始めた |
| lp_contact_input | 連絡先を入力した（値は送らない） |
| lp_application_success | 既存受付APIが成功した |
| lp_validation_error / lp_submit_error | 入力不足 / 送信失敗 |

申込件数は `lp_application_success` を主指標にする。既存の完了イベントと足し合わせない。完了画面の広告計測は既存の送信印を使い、直接アクセスや再読込を成果にしない。ローカル、プレビュー、自動検証、`?check=1` は計測対象外。

LPテーマは `parent-care` / `inheritance` / `distant-home` / `belongings` / `difficult-property` / `sell-rent-keep`。申込通知には `source: lp/テーマ` と日本語の相談テーマ、希望連絡方法を含める。住所・連絡先・相談内容は受付APIにのみ送信し、解析イベントには含めない。

## 受付後の業務指標

以下は電話・メールでの対応結果なので、アクセス解析から自動推定せず、担当者が既存の相談管理へ記録する。集計時には氏名・住所を含めない。

| 項目 | 定義 |
| --- | --- |
| 申込件数 | LPからAPI受付が成功した件数 |
| 連絡が取れた相談件数 | 対象地域の物件について、希望連絡方法で双方向の確認ができた件数 |
| 次の相談へ進んだ件数 | 結果の説明、現地確認、売却・賃貸・保有の相談日時が決まった件数 |
| 対応時間 | 初回確認・資料取得・カルテ作成・結果説明に使った時間の合計 |

受付日、LPテーマ、連絡確認日、次の相談日、対応分数を記録し、月ごとに比較する。比較相談LPは必要に応じてカルテ作成となるため、作成件数と相談件数を混同しない。広告は未設定。開始前に検索量・費用と、遠方LPの県外配信を確認する。

## 検証

`node --test tests/*.test.cjs` と `node _tools/check-public-facts.mjs` を実行する。ブラウザの送信検証はローカルの模擬APIで行う。本番で架空の相談を送らない。
