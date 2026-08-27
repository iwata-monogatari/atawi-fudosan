#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
export const ROLES = ["fact", "risk", "action", "choice"];
export const BACKGROUNDS = {
  sky: "#E9F5FC",
  "sky-2": "#F2F9FE",
  paper: "#F6FAFD",
  "yellow-soft": "#FFF7D9"
};
export const BADGES = new Set(["search", "attention", "step-1", "pause-ok", "fact", "check"]);

const stroke = (body) => `<g class="line" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
const fill = (body, className = "blue") => `<g class="${className}">${body}</g>`;

// All shapes are original geometric primitives in a 128 x 128 local coordinate space.
// Keep details legible when the completed icon is rendered at 64 px.
export const SHAPES = {
  house: () => `${fill('<path d="M18 60 64 22l46 38v52H18z"/>', "blue-soft")}${stroke('<path d="M12 62 64 18l52 44M23 57v57h82V57M52 114V78h24v36"/>')}`,
  "vacant-house": () => `${fill('<path d="M18 60 64 22l46 38v52H18z"/>', "blue-soft")}${stroke('<path d="M12 62 64 18l52 44M23 57v57h82V57M45 82h14m10 0h14M43 98l42-30"/>')}`,
  document: () => `${fill('<path d="M28 12h48l24 24v80H28z"/>', "paper-fill")}${stroke('<path d="M28 12h48l24 24v80H28zM76 12v25h24M43 58h40M43 76h40M43 94h27"/>')}`,
  documents: () => `${fill('<path d="M34 16h58v88H34z"/>', "paper-fill")}${stroke('<path d="M22 31V9h58M22 9v83h12M34 16h58l14 14v86H34zM92 16v15h14M50 55h40M50 75h40M50 95h28"/>')}`,
  registry: () => `${fill('<rect x="20" y="12" width="88" height="104" rx="8"/>', "paper-fill")}${stroke('<rect x="20" y="12" width="88" height="104" rx="8"/><path d="M40 38h48M40 58h48M40 78h30"/><circle cx="83" cy="91" r="13"/><path d="m74 91 6 6 12-15"/>')}`,
  shield: () => `${fill('<path d="M64 10c18 13 32 15 44 17v32c0 31-18 49-44 59-26-10-44-28-44-59V27c12-2 26-4 44-17z"/>', "blue-soft")}${stroke('<path d="M64 10c18 13 32 15 44 17v32c0 31-18 49-44 59-26-10-44-28-44-59V27c12-2 26-4 44-17z"/><path d="m43 64 14 14 29-34"/>')}`,
  key: () => `${fill('<circle cx="40" cy="47" r="25"/>', "yellow")}${stroke('<circle cx="40" cy="47" r="25"/><path d="m58 65 52 52M84 91l13-13M96 103l13-13"/>')}`,
  checklist: () => `${fill('<rect x="22" y="12" width="84" height="104" rx="10"/>', "paper-fill")}${stroke('<rect x="22" y="12" width="84" height="104" rx="10"/><path d="m37 42 7 7 13-16m10 11h22M37 72l7 7 13-16m10 11h22M37 102l7 7 13-16m10 11h22"/>')}`,
  dialogue: () => `${fill('<path d="M12 22h78v58H46L25 99V80H12z"/>', "blue-soft")}${stroke('<path d="M12 22h78v58H46L25 99V80H12zM39 45h25M39 59h35"/><path d="M75 47h41v49H99l-16 15V96h-8"/>')}`,
  "route-split": () => `${stroke('<path d="M64 112V70M64 70 31 37M64 70l33-33M31 37v-18M31 37H13M97 37v-18M97 37h18"/>')}${fill('<circle cx="64" cy="112" r="10"/><circle cx="13" cy="37" r="10"/><circle cx="115" cy="37" r="10"/>', "yellow")}`,
  family: () => `${fill('<circle cx="64" cy="30" r="16"/><circle cx="28" cy="46" r="13"/><circle cx="100" cy="46" r="13"/>', "blue-soft")}${stroke('<circle cx="64" cy="30" r="16"/><circle cx="28" cy="46" r="13"/><circle cx="100" cy="46" r="13"/><path d="M35 112V87c0-18 12-31 29-31s29 13 29 31v25M7 108V83c0-14 9-24 21-24 7 0 13 3 17 9M121 108V83c0-14-9-24-21-24-7 0-13 3-17 9"/>')}`,
  link: () => `${stroke('<path d="M51 82 37 96c-12 12-31 12-43 0s-12-31 0-43l23-23c12-12 31-12 43 0 4 4 7 9 8 14M77 46l14-14c12-12 31-12 43 0s12 31 0 43l-23 23c-12 12-31 12-43 0-4-4-7-9-8-14M38 64h52"/>')}`,
  search: () => `${fill('<circle cx="51" cy="51" r="35"/>', "blue-soft")}${stroke('<circle cx="51" cy="51" r="35"/><path d="m76 76 38 38"/>')}`,
  road: () => `${fill('<path d="M42 8h44l26 112H16z"/>', "blue-soft")}${stroke('<path d="M42 8h44l26 112H16zM64 15v19m0 19v19m0 19v22"/>')}`,
  boundary: () => `${fill('<path d="m20 31 72-18 18 82-73 20z"/>', "blue-soft")}${stroke('<path d="m20 31 72-18 18 82-73 20zM22 30l-9-8m79-9 8-10m10 92 10 7m-83 13-6 10M27 63l74-18M36 96l74-19"/>')}`,
  calculator: () => `${fill('<rect x="23" y="8" width="82" height="112" rx="12"/>', "paper-fill")}${stroke('<rect x="23" y="8" width="82" height="112" rx="12"/><rect x="38" y="23" width="52" height="25" rx="4"/><path d="M42 68h4m18 0h4m18 0h4M42 88h4m18 0h4m18 0h4M42 108h4m18 0h4m18 0h4"/>')}`,
  clock: () => `${fill('<circle cx="64" cy="66" r="49"/>', "blue-soft")}${stroke('<circle cx="64" cy="66" r="49"/><path d="M64 37v31l23 14M47 8h34"/>')}`,
  phone: () => `${fill('<rect x="32" y="7" width="64" height="114" rx="13"/>', "paper-fill")}${stroke('<rect x="32" y="7" width="64" height="114" rx="13"/><path d="M52 22h24M58 105h12"/>')}`,
  pin: () => `${fill('<path d="M64 119S24 78 24 49a40 40 0 1 1 80 0c0 29-40 70-40 70z"/>', "blue-soft")}${stroke('<path d="M64 119S24 78 24 49a40 40 0 1 1 80 0c0 29-40 70-40 70z"/><circle cx="64" cy="49" r="14"/>')}`,
  handshake: () => `${fill('<path d="m10 48 25-21 27 15 17-8 39 32-37 43-23-15-16 9-32-31z"/>', "blue-soft")}${stroke('<path d="m8 48 28-23 27 17 16-9 41 33-38 44-24-16-17 9L8 72zM36 25l-9-13M79 33l14-21M48 72l20-16 29 25M41 103l17-18m7 19 14-15"/>')}`,
  coins: () => `${fill('<ellipse cx="64" cy="30" rx="43" ry="17"/><path d="M21 30v58c0 10 19 18 43 18s43-8 43-18V30z"/>', "yellow")}${stroke('<ellipse cx="64" cy="30" rx="43" ry="17"/><path d="M21 30v58c0 10 19 18 43 18s43-8 43-18V30M21 50c0 10 19 18 43 18s43-8 43-18M21 69c0 10 19 18 43 18s43-8 43-18"/>')}`
};

function parseArgs(argv) {
  const out = { input: resolve(HERE, "sample-pages.json"), output: resolve(REPO_ROOT, "assets/visuals/pictograms"), check: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--input") out.input = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--out") out.output = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--check") out.check = true;
    else if (argv[i] === "--help" || argv[i] === "-h") out.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return out;
}

function help() {
  return `Usage: node tools/visuals/generate-pictograms.mjs [options]\n\n` +
    `  --input <file>  Page JSON (default: tools/visuals/sample-pages.json)\n` +
    `  --out <dir>     Output root (default: assets/visuals/pictograms)\n` +
    `  --check         Validate only; do not write files\n`;
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}

function hashInt(value) {
  return Number.parseInt(createHash("sha256").update(value).digest("hex").slice(0, 8), 16);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validatePages(pages) {
  assert(Array.isArray(pages), "JSON root must be an array");
  const ids = new Set();
  for (const [index, page] of pages.entries()) {
    const at = `pages[${index}]`;
    assert(page && typeof page === "object", `${at} must be an object`);
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.page_id || ""), `${at}.page_id must be a lowercase kebab-case id`);
    assert(!ids.has(page.page_id), `${at}.page_id is duplicated: ${page.page_id}`);
    ids.add(page.page_id);
    assert(typeof page.title === "string" && page.title.trim(), `${at}.title is required`);
    assert(Array.isArray(page.pictograms) && page.pictograms.length === 4, `${at}.pictograms must contain exactly four items`);
    const foundRoles = new Set();
    for (const [pIndex, icon] of page.pictograms.entries()) {
      const iconAt = `${at}.pictograms[${pIndex}]`;
      assert(ROLES.includes(icon.role), `${iconAt}.role must be one of ${ROLES.join(", ")}`);
      assert(!foundRoles.has(icon.role), `${at} has duplicate role: ${icon.role}`);
      foundRoles.add(icon.role);
      assert(typeof icon.label === "string" && icon.label.trim(), `${iconAt}.label is required`);
      assert(icon.label.length <= 60, `${iconAt}.label must be 60 characters or fewer`);
      assert(Object.hasOwn(SHAPES, icon.primary), `${iconAt}.primary is unknown: ${icon.primary}`);
      assert(Object.hasOwn(SHAPES, icon.secondary), `${iconAt}.secondary is unknown: ${icon.secondary}`);
      assert(BADGES.has(icon.badge), `${iconAt}.badge is unknown: ${icon.badge}`);
      assert(Object.hasOwn(BACKGROUNDS, icon.background), `${iconAt}.background is unknown: ${icon.background}`);
      assert(typeof icon.alt === "string" && icon.alt.length <= 120, `${iconAt}.alt must be a string of 120 characters or fewer`);
    }
    assert(ROLES.every((role) => foundRoles.has(role)), `${at} must contain all four roles`);
  }
}

function badgeSvg(name) {
  const shell = '<circle cx="207" cy="49" r="27" class="badge-shell"/>';
  const map = {
    search: '<circle cx="202" cy="44" r="9"/><path d="m209 51 11 11"/>',
    attention: '<path d="M207 31v21M207 63v1"/>',
    "step-1": '<path d="M203 39h7v23M202 62h12"/>',
    "pause-ok": '<path d="M200 39v20M213 39v20"/>',
    fact: '<path d="m194 50 8 8 18-21"/>',
    check: '<path d="m194 50 8 8 18-21"/>'
  };
  return `${shell}<g class="badge-mark" fill="none" stroke-linecap="round" stroke-linejoin="round">${map[name]}</g>`;
}

function decorativeMarks(seed) {
  const side = seed % 2 === 0 ? 1 : -1;
  const x = side === 1 ? 222 : 34;
  const y = 184 + (seed % 4) * 5;
  return `<g class="decor" aria-hidden="true"><circle cx="${x}" cy="${y}" r="8"/><circle cx="${x + side * -18}" cy="${y + 18}" r="4"/><path d="M${x - 10} ${y - 24}h20M${x} ${y - 34}v20"/></g>`;
}

export function renderSvg(page, icon) {
  const visualKey = `${page.page_id}:${icon.role}:${icon.primary}:${icon.secondary}:${icon.badge}:${icon.background}`;
  const seed = hashInt(visualKey);
  const visualId = createHash("sha256").update(visualKey).digest("hex").slice(0, 16);
  const primaryX = 38 + (seed % 7);
  const primaryY = 43 + ((seed >> 3) % 5);
  const secondaryX = 151 + ((seed >> 5) % 6);
  const secondaryY = 145 + ((seed >> 8) % 5);
  const accessible = icon.alt.trim().length > 0;
  const title = accessible ? `<title id="title">${xml(icon.alt)}</title>` : "";
  const aria = accessible ? 'role="img" aria-labelledby="title"' : 'aria-hidden="true"';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" data-visual-id="${visualId}" ${aria}>\n` +
    `${title}\n` +
    `<style>.line{stroke:#14344A;stroke-width:8}.blue{fill:#2E9BD4}.blue-soft{fill:#A9DBF3}.yellow{fill:#FFE100}.paper-fill{fill:#FFF;stroke:none}.badge-shell{fill:#FFE100}.badge-mark{stroke:#14344A;stroke-width:7}.decor{fill:#F2B705;stroke:#16709F;stroke-width:5;stroke-linecap:round}.secondary-disc{fill:#FFF;stroke:#CDE2F0;stroke-width:5}</style>\n` +
    `<rect x="4" y="4" width="248" height="248" rx="48" fill="${BACKGROUNDS[icon.background]}"/>\n` +
    `<path d="M28 218C72 198 109 223 144 210c31-11 50-38 84-31" fill="none" stroke="#CDE2F0" stroke-width="8" stroke-linecap="round"/>\n` +
    `<g transform="translate(${primaryX} ${primaryY}) scale(1.18)">${SHAPES[icon.primary]()}</g>\n` +
    `<circle cx="190" cy="188" r="48" class="secondary-disc"/>\n` +
    `<g transform="translate(${secondaryX} ${secondaryY}) scale(.61)">${SHAPES[icon.secondary]()}</g>\n` +
    `${badgeSvg(icon.badge)}\n${decorativeMarks(seed)}\n</svg>\n`;
}

function exampleHtml(page) {
  const cards = ROLES.map((role, index) => {
    const item = page.pictograms.find((icon) => icon.role === role);
    const filename = `${String(index + 1).padStart(2, "0")}-${role}.svg`;
    return `  <li class="fga-pictogram-card" data-role="${role}">\n` +
      `    <img class="fga-pictogram" src="./${page.page_id}/${filename}" width="128" height="128" alt="${xml(item.alt)}"${item.alt ? "" : ' aria-hidden="true"'} loading="lazy" decoding="async">\n` +
      `    <p class="fga-pictogram-card__label">${xml(item.label)}</p>\n  </li>`;
  }).join("\n");
  return `<!-- Copy the stylesheet link into the page head. Adjust the relative path for the target page. -->\n` +
    `<link rel="stylesheet" href="../pictograms.css">\n` +
    `<ul class="fga-pictogram-grid" aria-label="${xml(page.title)}の確認ポイント">\n${cards}\n</ul>\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(help());
    return;
  }
  const pages = JSON.parse(await readFile(options.input, "utf8"));
  validatePages(pages);
  if (options.check) {
    process.stdout.write(`Validated ${pages.length} pages / ${pages.length * 4} pictograms.\n`);
    return;
  }

  await mkdir(options.output, { recursive: true });
  const generated = [];
  for (const page of pages) {
    const pageDir = resolve(options.output, page.page_id);
    await mkdir(pageDir, { recursive: true });
    for (const [index, role] of ROLES.entries()) {
      const icon = page.pictograms.find((item) => item.role === role);
      const filename = `${String(index + 1).padStart(2, "0")}-${role}.svg`;
      const svg = renderSvg(page, icon);
      await writeFile(resolve(pageDir, filename), svg, "utf8");
      generated.push({
        page_id: page.page_id,
        role,
        label: icon.label,
        alt: icon.alt,
        primary: icon.primary,
        secondary: icon.secondary,
        badge: icon.badge,
        background: icon.background,
        file: `${page.page_id}/${filename}`,
        bytes: Buffer.byteLength(svg),
        sha256: createHash("sha256").update(svg).digest("hex")
      });
    }
  }

  const byHash = new Map();
  for (const item of generated) {
    const group = byHash.get(item.sha256) || [];
    group.push(item);
    byHash.set(item.sha256, group);
  }
  const duplicates = [...byHash.values()].filter((group) => group.length > 1);
  assert(duplicates.length === 0, "Generated duplicate SVG files; change the page visual definitions");
  const manifest = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: relative(REPO_ROOT, options.input).replaceAll("\\", "/"),
    pages: pages.length,
    pictograms: generated.length,
    items: generated
  };
  await writeFile(resolve(options.output, "manifest.generated.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(resolve(options.output, "example.generated.html"), exampleHtml(pages[0]), "utf8");
  process.stdout.write(`Generated ${generated.length} pictograms for ${pages.length} pages in ${options.output}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Pictogram generation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
