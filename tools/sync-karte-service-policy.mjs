import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { karteServicePolicy as policy } from '../_tools/karte-service-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copy = policy.copy;
const faqAnswers = new Map([
  ['実家カルテはなぜ無料なのですか？', '相談の入口で費用を理由に問題を先送りしないためです。' + copy.pricing + copy.freeServices + copy.noSaleCondition],
  ['後から費用が発生しますか？', copy.pricing + copy.freeServices + copy.externalCosts + copy.noSaleCondition],
  ['売却査定や境界確定もできますか？', '価格の目安の整理と、必要な現地確認・訪問査定は無料です。境界確定・登記・法的判断・建物検査などの専門家業務は、当社の確認・整理とは区別します。' + copy.pricing + copy.externalCosts],
]);

const files = ['index.html', 'karte/index.html', 'faq/index.html'];
for (const file of files) {
  const target = path.join(root, file);
  let html = fs.readFileSync(target, 'utf8');
  for (const key of ['pricing', 'freeServices', 'externalCosts', 'noSaleCondition']) {
    const pattern = new RegExp(`(<p data-karte-policy="${key}">)(?:<strong>)?[\\s\\S]*?(?:<\\/strong>)?(<\\/p>)`, 'g');
    if (!pattern.test(html)) throw new Error(`${file}: missing policy slot ${key}`);
    pattern.lastIndex = 0;
    html = html.replace(pattern, (_, open, close) => open + (key === 'pricing' && file !== 'faq/index.html' ? `<strong>${copy[key]}</strong>` : copy[key]) + close);
  }
  if (file === 'faq/index.html') {
    html = html.replace(/(<details class="faq-item"><summary>)(.*?)(<\/summary><p>)([\s\S]*?)(<\/p><\/details>)/g,
      (all, open, q, mid, answer, close) => faqAnswers.has(q) ? open + q + mid + faqAnswers.get(q) + close : all);
  }
  html = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (all, open, text, close) => {
    const schema = JSON.parse(text);
    if (schema['@type'] === 'Service') {
      schema.description = '物件に合わせて価格の目安・確認点・次の対応をまとめたPDFを、メールまたはLINEでお渡しする無料の実家カルテ。' + copy.pricing + copy.delivery;
      if (schema.offers?.price !== '0') throw new Error('Expected free Karte offer');
      schema.offers.description = '無料の実家カルテ作成・相談サービス。' + copy.pricing + copy.freeServices + copy.necessaryChecks;
    } else if (schema['@type'] === 'FAQPage' && file === 'faq/index.html') {
      for (const item of schema.mainEntity) if (faqAnswers.has(item.name)) item.acceptedAnswer.text = faqAnswers.get(item.name);
    } else return all;
    return open + JSON.stringify(schema) + close;
  });
  fs.writeFileSync(target, html, 'utf8');
}
console.log(`karte-service-policy: synchronized ${files.length} pages`);
