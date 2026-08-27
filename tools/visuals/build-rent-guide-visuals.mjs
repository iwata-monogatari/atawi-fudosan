#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROLES, SHAPES } from "./generate-pictograms.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const DEFAULT_INPUT = resolve(REPO_ROOT, "rent-guide-data/pages.json");
const DEFAULT_OUTPUT = resolve(REPO_ROOT, "rent/column");
const MAX_SVG_BYTES = 12 * 1024;

const PAGE_VISUALS = {
  "mitsuke-owner-rental-readiness": [
    ["物件の現在地", "貸せる状態かを事実から確認", "house", "search"],
    ["安全と修繕", "雨漏り・設備・残置物を先に確認", "shield", "vacant-house"],
    ["募集前の整理", "資料と現地確認を一覧にする", "checklist", "document"],
    ["貸すか比較", "売る・保留も同じ条件で比べる", "route-split", "house"]
  ],
  "mitsuke-owner-rent-setting-cashflow": [
    ["家賃と手取り", "収入と毎月費用を分ける", "coins", "calculator"],
    ["空室と突発費", "空室期間と故障費用を見込む", "clock", "vacant-house"],
    ["三つの収支案", "楽観・標準・慎重で試算する", "calculator", "documents"],
    ["投資上限", "回収期間と将来計画で決める", "route-split", "coins"]
  ],
  "mitsuke-owner-property-management-comparison": [
    ["管理の仕事", "集金・連絡・点検を一覧にする", "checklist", "house"],
    ["緊急対応", "故障や近隣連絡の負担を確認", "phone", "shield"],
    ["役割を決める", "自分と委託先の範囲を分ける", "handshake", "checklist"],
    ["管理方式", "費用だけでなく時間でも比較", "route-split", "family"]
  ],
  "mitsuke-owner-tenant-criteria-contract": [
    ["募集条件", "駐車・庭・ペットの事実を整理", "family", "house"],
    ["条件の食違い", "曖昧な約束を契約へ残さない", "document", "shield"],
    ["質問をそろえる", "入居前の確認事項を言葉にする", "checklist", "dialogue"],
    ["契約条件", "家の使い方と期間を選ぶ", "route-split", "key"]
  ],
  "mitsuke-owner-repair-maintenance-plan": [
    ["建物の状態", "劣化と未確認を部位別に見る", "vacant-house", "search"],
    ["修繕の優先度", "安全に関わる不具合を先にする", "shield", "house"],
    ["見積を比較", "範囲と工期をそろえて確認", "checklist", "calculator"],
    ["維持計画", "入居前と入居後を時間軸に置く", "clock", "route-split"]
  ],
  "mitsuke-detached-rental-search-guide": [
    ["住所と生活圏", "通勤・通学・買物を地図で確認", "pin", "house"],
    ["防災と経路", "区域だけでなく移動経路も見る", "shield", "road"],
    ["現地で確認", "異なる時間帯に周辺を歩く", "search", "checklist"],
    ["候補を比較", "必須条件と希望条件を分ける", "route-split", "family"]
  ],
  "mitsuke-detached-rental-viewing-checklist": [
    ["建物と設備", "部屋ごとに状態を確かめる", "house", "search"],
    ["見えない不具合", "臭い・漏水・作動状態を質問", "shield", "vacant-house"],
    ["内見メモ", "写真と質問を同じ順で残す", "documents", "checklist"],
    ["申込判断", "未確認を仲介へ戻して選ぶ", "handshake", "route-split"]
  ],
  "mitsuke-detached-rental-contract-checks": [
    ["契約の全体像", "期間・費用・特約を読み分ける", "document", "search"],
    ["特約と負担", "修繕・退去条件を曖昧にしない", "shield", "document"],
    ["書面で質問", "口頭説明を確認事項へ戻す", "checklist", "documents"],
    ["契約期間", "普通借家と定期借家を確認", "route-split", "clock"]
  ],
  "mitsuke-detached-rental-living-rules": [
    ["暮らしの分担", "庭・ごみ・自治会の担当を知る", "family", "house"],
    ["設備トラブル", "異常時の連絡順を間違えない", "phone", "shield"],
    ["早めに連絡", "状況と写真を管理先へ伝える", "phone", "checklist"],
    ["解決の順番", "自分で直す前に契約を確認", "handshake", "route-split"]
  ],
  "mitsuke-detached-rental-moveout-guide": [
    ["退去予告", "契約の期限と連絡先を確認", "clock", "document"],
    ["原状回復", "負担範囲を自己判断で決めない", "shield", "house"],
    ["返却前確認", "庭・荷物・鍵を一覧で整える", "checklist", "key"],
    ["引渡し", "記録を残して貸主へ返す", "handshake", "route-split"]
  ]
};

const ROLE_STYLE = {
  fact: { accent: "#FFE100", background: "#131418" },
  risk: { accent: "#FF7A66", background: "#171113" },
  action: { accent: "#FFE100", background: "#131418" },
  choice: { accent: "#FFE100", background: "#0B0B0D" }
};

const ALLOWED_COLORS = new Set(["#0B0B0D", "#131418", "#171113", "#1A1C21", "#F3F4F6", "#A5ACB6", "#767D88", "#FFE100", "#FF7A66"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

function numberFromHash(value) {
  return Number.parseInt(sha(value).slice(0, 8), 16);
}

function badge(role, accent) {
  const marks = {
    fact: '<circle cx="202" cy="43" r="9"/><path d="m209 50 11 11"/>',
    risk: '<path d="M207 31v21M207 63v1"/>',
    action: '<path d="M202 39h8v23M201 62h14"/>',
    choice: '<path d="M197 39v21M216 39v21"/>'
  };
  return `<circle cx="207" cy="48" r="27" fill="${accent}"/><g fill="none" stroke="#0B0B0D" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${marks[role]}</g>`;
}

function render(page, item) {
  const key = `${page.slug}:${item.role}:${item.primary}:${item.secondary}:${item.label}`;
  const digest = sha(key);
  const seed = numberFromHash(key);
  const style = ROLE_STYLE[item.role];
  const primaryX = 35 + seed % 9;
  const primaryY = 45 + (seed >>> 4) % 7;
  const secondaryX = 151 + (seed >>> 8) % 7;
  const secondaryY = 147 + (seed >>> 12) % 6;
  const stripeX = 18 + (seed >>> 16) % 48;
  const riskClass = item.role === "risk" ? "risk" : "standard";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" data-visual-id="${digest.slice(0, 16)}" role="img" aria-labelledby="title">\n` +
    `<title id="title">${xml(item.caption)}</title>\n` +
    `<style>.line{stroke:#F3F4F6;stroke-width:8}.blue{fill:${style.accent}}.blue-soft{fill:${item.role === "risk" ? "#FF7A66" : "#A5ACB6"}}.yellow{fill:${style.accent}}.paper-fill{fill:#1A1C21;stroke:none}.secondary-disc{fill:#0B0B0D;stroke:#767D88;stroke-width:4}.grid-line{stroke:#767D88;stroke-width:2;opacity:.28}</style>\n` +
    `<rect x="4" y="4" width="248" height="248" fill="${style.background}" stroke="#767D88" stroke-width="2"/>\n` +
    `<g class="grid-line" aria-hidden="true"><path d="M16 211h224M16 226h224"/><path d="M${stripeX} 16v22M${stripeX + 12} 16v12"/></g>\n` +
    `<rect x="16" y="16" width="44" height="4" fill="${style.accent}"/>\n` +
    `<g class="${riskClass}" transform="translate(${primaryX} ${primaryY}) scale(1.16)">${SHAPES[item.primary]()}</g>\n` +
    `<rect x="142" y="140" width="96" height="96" class="secondary-disc"/>\n` +
    `<g transform="translate(${secondaryX} ${secondaryY}) scale(.61)">${SHAPES[item.secondary]()}</g>\n` +
    `${badge(item.role, style.accent)}\n` +
    `<g fill="${style.accent}" aria-hidden="true"><circle cx="${211 - seed % 16}" cy="${194 + seed % 14}" r="5"/><rect x="${194 - seed % 11}" y="${211 - seed % 9}" width="18" height="3"/></g>\n` +
    `</svg>\n`;
}

function validateSvg(svg, expectedRole) {
  assert(Buffer.byteLength(svg) <= MAX_SVG_BYTES, `SVG exceeds ${MAX_SVG_BYTES} bytes`);
  assert(/viewBox="0 0 256 256"/.test(svg), "SVG viewBox must be 0 0 256 256");
  assert(!/<script\b/i.test(svg), "SVG contains script");
  assert(!/<foreignObject\b/i.test(svg), "SVG contains foreignObject");
  assert(!/\b(?:href|src)\s*=/i.test(svg), "SVG contains an external reference attribute");
  assert(!/url\s*\(/i.test(svg), "SVG contains a CSS url reference");
  assert(!/data:/i.test(svg), "SVG contains an embedded data URI");
  assert(!/<(?:image|use|font|iframe)\b/i.test(svg), "SVG contains a forbidden element");
  const colors = [...svg.matchAll(/#[0-9A-Fa-f]{6}/g)].map((match) => match[0].toUpperCase());
  for (const color of colors) assert(ALLOWED_COLORS.has(color), `SVG uses an unapproved color: ${color}`);
  if (expectedRole !== "risk") assert(!svg.includes("#FF7A66"), "Red may only appear in risk pictograms");
  if (expectedRole === "risk") assert(svg.includes("#FF7A66"), "Risk pictogram must include red");
}

function parseArgs(argv) {
  const options = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") options.input = resolve(process.cwd(), argv[++index]);
    else if (arg === "--out") options.output = resolve(process.cwd(), argv[++index]);
    else if (arg === "--check") options.check = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function adapt(root) {
  assert(root && Array.isArray(root.pages), "Input must contain a pages array");
  assert(root.pages.length === 10, `Expected 10 pages; received ${root.pages.length}`);
  const slugs = new Set();
  return root.pages.map((page, pageIndex) => {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug || ""), `pages[${pageIndex}].slug is invalid`);
    assert(!slugs.has(page.slug), `Duplicate slug: ${page.slug}`);
    slugs.add(page.slug);
    assert(typeof page.title === "string" && page.title.trim(), `pages[${pageIndex}].title is required`);
    const plan = PAGE_VISUALS[page.slug];
    assert(Array.isArray(plan) && plan.length === 4, `No four-item visual plan for ${page.slug}`);
    return {
      slug: page.slug,
      title: page.title,
      pictograms: plan.map(([label, caption, primary, secondary], index) => {
        assert(Object.hasOwn(SHAPES, primary), `Unknown primary shape ${primary} for ${page.slug}`);
        assert(Object.hasOwn(SHAPES, secondary), `Unknown secondary shape ${secondary} for ${page.slug}`);
        return { role: ROLES[index], key: `${page.slug}-${ROLES[index]}`, label, caption, primary, secondary };
      })
    };
  });
}

async function build(options) {
  const root = JSON.parse(await readFile(options.input, "utf8"));
  const pages = adapt(root);
  const items = [];
  for (const page of pages) {
    for (const [index, pictogram] of page.pictograms.entries()) {
      const filename = `pictogram-${String(index + 1).padStart(2, "0")}.svg`;
      const svg = render(page, pictogram);
      validateSvg(svg, pictogram.role);
      items.push({ page, pictogram, filename, svg, bytes: Buffer.byteLength(svg), sha256: sha(svg) });
    }
  }
  assert(items.length === 40, `Expected 40 SVGs; received ${items.length}`);
  assert(new Set(items.map((item) => item.pictogram.key)).size === 40, "Pictogram keys are not unique");
  assert(new Set(items.map((item) => item.sha256)).size === 40, "Generated SVG SHA-256 values are not unique");
  for (const role of ROLES) assert(items.filter((item) => item.pictogram.role === role).length === 10, `Role ${role} must appear 10 times`);

  if (!options.check) {
    for (const item of items) {
      const imageDir = resolve(options.output, item.page.slug, "images");
      await mkdir(imageDir, { recursive: true });
      await writeFile(resolve(imageDir, item.filename), item.svg, "utf8");
    }
  }

  const manifest = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: relative(REPO_ROOT, options.input).replaceAll("\\", "/"),
    theme: "rent-dark",
    page_count: pages.length,
    pictogram_count: items.length,
    unique_sha256_count: new Set(items.map((item) => item.sha256)).size,
    role_order: ROLES,
    pages: pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      images: items.filter((item) => item.page.slug === page.slug).map((item) => ({
        role: item.pictogram.role,
        key: item.pictogram.key,
        label: item.pictogram.label,
        caption: item.pictogram.caption,
        primary: item.pictogram.primary,
        secondary: item.pictogram.secondary,
        src: `/rent/column/${page.slug}/images/${item.filename}`,
        bytes: item.bytes,
        sha256: item.sha256
      }))
    }))
  };

  if (!options.check) {
    await writeFile(resolve(options.output, "visuals-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const diskHashes = [];
    for (const item of items) {
      const target = resolve(options.output, item.page.slug, "images", item.filename);
      const diskSvg = await readFile(target, "utf8");
      validateSvg(diskSvg, item.pictogram.role);
      const diskHash = sha(diskSvg);
      assert(diskHash === item.sha256, `Disk hash mismatch: ${target}`);
      diskHashes.push(diskHash);
    }
    assert(diskHashes.length === 40 && new Set(diskHashes).size === 40, "Disk verification did not find 40 unique SVGs");
  }
  return manifest;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node tools/visuals/build-rent-guide-visuals.mjs [--input <pages.json>] [--out <rent/column>] [--check]\n");
    return;
  }
  const manifest = await build(options);
  process.stdout.write(`${options.check ? "Validated" : "Generated and verified"} ${manifest.page_count} pages / ${manifest.pictogram_count} SVGs / ${manifest.unique_sha256_count} unique SHA-256 hashes.\n`);
}

main().catch((error) => {
  process.stderr.write(`Rent guide visual build failed: ${error.message}\n`);
  process.exitCode = 1;
});
