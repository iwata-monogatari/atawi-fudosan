# 実家カルテ申込の通知メール設定手順

申込フォームの通知を **fudosan@fujigaoka-service.co.jp** に届けるための設定です。
コード側（/api/karte-apply）はこのリポジトリで管理され、サイトと一緒に自動デプロイされます。
残りは下の3ステップだけです（所要 約15分）。

## 現在の動作

- 未設定の間: 申込は従来どおり旧Worker（atawi-fudosan-karte-api）へ転送されます（現状と同じ動き）。
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
| `FALLBACK_API` | 旧WorkerのURL | 転送先の変更 |

## 補足（2026-08-05 調査の経緯）

- 旧Worker `atawi-fudosan-karte-api` のソースコードはどのリポジトリにもなく、
  メール送信の失敗が「受付完了」の裏で見えなくなっていた
- atawi.link には SPF/DKIM が未設定で、Gmail宛の送信はほぼ届かない状態だった
  （ステップ1のドメイン認証でこれも解消される）
- 恒久的には旧Workerの廃止を推奨（このFunctionが安定稼働したら不要）
