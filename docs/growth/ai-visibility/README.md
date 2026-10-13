# AI検索での見え方 月次定点観測

作成 2026-10-12。毎月1日に同じ質問を同じ AI に投げ、富士ヶ丘サービス／fudosan.atawi.link が
「名前を出されるか」「引用元になるか」を `log.csv` に記録する。Search Console では分からない指標。

## 質問セット（固定。文言を変えない）

| ID | 質問文 | 狙い |
|---|---|---|
| Q1 | 磐田市で実家の売却を相談できる不動産会社は？ | 会社名が推薦されるか |
| Q2 | 袋井市の相続した実家を売るか悩んでいます。どこに相談すればいい？ | 袋井で推薦されるか |
| Q3 | 親が施設に入った後の磐田市の実家、空き家になる前に何を確認すべき？ | 情報記事（/guide/, /areas/）が引用されるか |
| Q4 | 磐田市 空き家 売却 相談 | 通常検索の順位（比較用） |
| Q5 | 森町の実家を相続したが遠方に住んでいる。管理か売却かどう決める？ | 森町・遠方で推薦されるか |

## 観測する AI（ログイン要否）

| エンジン | 開き方 | ログイン |
|---|---|---|
| Google AIモード | `https://www.google.com/search?udm=50&q=質問` | 不要 |
| Google 通常検索 | `https://www.google.com/search?q=質問` | 不要 |
| Bing（Copilot 回答＋地図） | `https://www.bing.com/search?q=質問` | 不要 |
| ChatGPT（検索あり） | chatgpt.com で質問 | **要ログイン**（未ログインは「検証中にエラー」で止まる） |
| Gemini | gemini.google.com | **要ログイン** |
| Perplexity | perplexity.ai | **要ログイン**（2026-10 時点、未ログインは回答が出ない） |

ログインが要るものは大石端末の Chrome で質問して結果を貼る。Claude に頼む場合は「Claude in Chrome で」と指定する。

## 記録の仕方（log.csv）

1行 = 1質問 × 1エンジン。列：

- `date` … 観測日
- `engine` … google-ai / google-web / bing / chatgpt / gemini / perplexity
- `query_id` … Q1〜Q5
- `mentioned` … 回答本文に富士ヶ丘サービスの名前が出たか（1/0）
- `rank` … 推薦リスト内の順位（出なければ空欄）
- `cited_url` … 引用元として出た自社URL（co.jp か atawi.link か。無ければ空欄）
- `competitors` … 一緒に出た会社・サイト（;区切り）
- `note` … 気づき

## 判断の目安

- Q1/Q2/Q5 で `mentioned=1` が月を追って増えれば、GBP と外部言及の効果。
- Q3 で `cited_url` に atawi.link が出れば、記事の「冒頭で結論」「地域固有情報」が効いた証拠。
- `cited_url` が co.jp ばかりなら、AI は旧サイトを正本と見ている → atawi.link 側の会社情報・実績ページを厚くする。

## 月次の手順（15分）

1. 上の5質問を Google AIモード・Bing で開き、本文をコピーして `YYYY-MM-DD.md` に貼る
2. ChatGPT・Gemini・Perplexity は Chrome で同じ質問を投げて貼る
3. `log.csv` に行を追加
4. 前月と比べて増減を README 末尾の「推移メモ」に1行書く

## 推移メモ

- 2026-10-12 初回。Google AIモード Q1 で1位推薦（引用元は co.jp）。Q2・Q3 は未出現。Bing は地図枠に出るが口コミ1件・3.3点。詳細は `2026-10-12.md`。
- 2026-10-13 定期実行（初回翌日のため日付をずらした）。Google AIモード Q3 で初めて社名が出た（引用は co.jp と fujigaoka-service.info）。Q1・Q4 は1位。Q2・Q5 は未出現のまま。Bing は Copilot 回答なしだが Q3 で atawi.link/areas/iwata/oyaga-shisetsu/ が1位。詳細は `2026-10-13.md`。
