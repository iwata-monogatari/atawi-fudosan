# 申込・問い合わせの通知メール設定手順

> 2026-08-06 設定実施: Resendアカウント作成・atawi.linkドメイン認証(Auto configureでDNS 3件追加済み)・
> Pages環境変数 RESEND_API_KEY 登録済み。
>
> 2026-08-09 戸建て賃貸フォーム(/api/rent-inquiry)を追加し、本番で送信テスト実施。
> 差出人 `rent@atawi.link` のまま fudosan@fujigaoka-service.co.jp への着信を確認済み。
> ドメイン認証がatawi.link全体にかかっているため、環境変数 RENT_MAIL_FROM の設定は不要。
> 件名を `【戸建て賃貸】ご用件／所在地` としてあるので、実家カルテ申込と受信箱で混ざらない。

申込・問い合わせの通知を **fudosan@fujigaoka-service.co.jp** に届けるための設定です。
コード側（/api/karte-apply と /api/rent-inquiry）はこのリポジトリで管理され、
サイトと一緒に自動デプロイされます。両者は RESEND_API_KEY と MAIL_TO を共用し、
件名と差出人だけ分けています。設定は下の3ステップだけです（所要 約15分）。

## 現在の動作

- 送信に失敗した場合: 502を返し、申込者にはLINE・電話への案内が出ます。
  （2026-08-29に旧Worker `atawi-fudosan-karte-api` への転送を廃止しました。
  転送先は送信失敗時も `ok:true` を返しうるため、「受付完了」の裏でメールが
  消える危険がありました。いまは失敗が申込者にも記録にも必ず現れます）
- 設定完了後: Resend経由で fudosan@fujigaoka-service.co.jp に通知メールが届きます。
  メールに返信するとそのまま申込者に返信できます（Reply-To設定済み）。
- どちらも失敗した場合のみ、申込者に「LINE・電話でご連絡ください」と案内が出ます。
  申込内容は常に Cloudflare Pages の Functions ログにも記録されます。

## ステップ1: Resend アカウントとドメイン認証

1. https://resend.com で無料アカウントを作成（無料枠: 100通/日で十分）
2. ダッシュボード → **Domains** → **Add Domain** → `atawi.link` を入力
3. 表示される DNSレコード3件（MX / TXT(SPF) / TXT(DKIM)）を控える
4. Cloudflare ダッシュボード → atawi.link のゾーン → **DNS** → 3件をそのまま追加
   （Proxy は「DNS only」のままにする）
5. Resend に戻り **Verify** を押して「Verified」になるのを確認

## ステップ2: APIキー発行

1. Resend ダッシュボード → **API Keys** → **Create API Key**
2. 権限は「Sending access」だけでOK。キー（re_ で始まる文字列）をコピー

## ステップ3: Cloudflare Pages に環境変数を設定

1. Cloudflare ダッシュボード → **Workers & Pages** → Pages プロジェクト（atawi-fudosan）
2. **Settings** → **Environment variables** → Production に追加:
   - 変数名: `RESEND_API_KEY` / 値: ステップ2のキー / **Encrypt（Secret）にする**
3. 保存後、**Deployments** から最新デプロイの「Retry deployment」（または次回のgit pushで反映）

## 動作確認

1. https://fudosan.atawi.link/karte/ から自分でテスト申込（住所欄に「テスト」と書く）
2. fudosan@fujigaoka-service.co.jp の受信箱を確認
3. 届かない場合: Pages プロジェクト → 対象デプロイ → **Functions** タブのログで
   `karte-apply` の行を確認（resend error の内容が出ます）

## 任意の追加設定（環境変数で変更可能）

| 変数 | 既定値 | 用途 |
|---|---|---|
| `MAIL_TO` | fudosan@fujigaoka-service.co.jp | 通知先の変更・追加 |
| `MAIL_FROM` | ふじがおか実家カルテ申込 &lt;karte@atawi.link&gt; | 差出人 |

## 補足（2026-08-05 調査の経緯）

- 旧Worker `atawi-fudosan-karte-api` のソースコードはどのリポジトリにもなく、
  メール送信の失敗が「受付完了」の裏で見えなくなっていた
  → **2026-08-29 に転送を廃止**（このPR）。Worker本体の削除は転送廃止の反映後
- atawi.link には SPF/DKIM が未設定で、Gmail宛の送信はほぼ届かない状態だった
  （ステップ1のドメイン認証でこれも解消される）
- 恒久的には旧Workerの廃止を推奨（このFunctionが安定稼働したら不要）
