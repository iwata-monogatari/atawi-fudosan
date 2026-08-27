#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSvg, ROLES, SHAPES } from "./generate-pictograms.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const DEFAULT_INPUT = resolve(REPO_ROOT, "jikka-guide-data/pages.json");
const DEFAULT_OUTPUT = resolve(REPO_ROOT, "jikka-guide");

// The content architecture uses 40 controlled suffixes (four per cluster).
// Map each semantic suffix to original geometric primitives. This is explicit,
// reviewable, and stable when the build is rerun.
const SEMANTIC_SHAPES = {
  "balance-view": ["route-split", "house"],
  "local-pin": ["pin", "house"],
  "map-pin-home": ["pin", "house"],
  "neighbor-tree": ["house", "boundary"],
  "people-table": ["dialogue", "family"],
  "person-check": ["family", "checklist"],
  "pin-number": ["pin", "document"],
  "registry-house": ["registry", "house"],
  "local-person": ["family", "pin"],
  "road-ruler": ["road", "boundary"],
  "shared-file": ["documents", "family"],
  "shield-home": ["shield", "house"],
  "stacked-land": ["boundary", "documents"],
  "stamp-document": ["registry", "document"],
  "three-arrows": ["route-split", "family"],
  "truck-route": ["route-split", "house"],
  "warning-match": ["link", "shield"],
  "route-next": ["route-split", "checklist"],
  "local-expert": ["handshake", "pin"],
  "layer-map": ["boundary", "pin"],
  "key-home": ["key", "house"],
  "boundary-pin": ["boundary", "pin"],
  "box-search": ["search", "documents"],
  "building-before": ["vacant-house", "checklist"],
  "calculator-home": ["calculator", "house"],
  "calendar-deadline": ["clock", "checklist"],
  "calendar-eye": ["clock", "search"],
  "calendar-next": ["clock", "route-split"],
  "camera-list": ["checklist", "search"],
  "cloud-share": ["phone", "documents"],
  "document-search": ["document", "search"],
  "expert-route": ["handshake", "route-split"],
  "fact-sheet": ["document", "checklist"],
  "family-check": ["family", "checklist"],
  "family-tree": ["family", "link"],
  "field-house": ["boundary", "house"],
  "folder-list": ["documents", "checklist"],
  "heart-clock": ["clock", "family"],
  "water-alert": ["shield", "vacant-house"],
  "zoning-map": ["boundary", "road"]
};

const ROLE_STYLE = {
  fact: { badge: "search", background: "sky" },
  risk: { badge: "attention", background: "yellow-soft" },
  action: { badge: "step-1", background: "paper" },
  choice: { badge: "pause-ok", background: "sky-2" }
};

// Roles are also keyed by the controlled semantic suffix, not merely by array
// position. The position assertion below catches accidentally reordered data.
const ROLE_SUFFIXES = {
  fact: new Set(["box-search", "calendar-deadline", "calendar-eye", "local-pin", "map-pin-home", "people-table", "person-check", "pin-number", "road-ruler", "three-arrows"]),
  risk: new Set(["balance-view", "boundary-pin", "calculator-home", "camera-list", "family-check", "family-tree", "key-home", "layer-map", "shield-home", "stacked-land"]),
  action: new Set(["building-before", "cloud-share", "document-search", "field-house", "heart-clock", "registry-house", "shared-file", "stamp-document", "water-alert", "zoning-map"]),
  choice: new Set(["calendar-next", "expert-route", "fact-sheet", "folder-list", "local-expert", "local-person", "neighbor-tree", "route-next", "truck-route", "warning-match"])
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function getSuffix(slug, key) {
  const prefix = `${slug}-`;
  assert(key.startsWith(prefix), `Pictogram key must start with page slug: ${key}`);
  const suffix = key.slice(prefix.length);
  assert(Object.hasOwn(SEMANTIC_SHAPES, suffix), `No semantic shape mapping for suffix: ${suffix}`);
  return suffix;
}

function getRole(suffix) {
  const roles = ROLES.filter((role) => ROLE_SUFFIXES[role].has(suffix));
  assert(roles.length === 1, `Semantic suffix must map to exactly one role: ${suffix}`);
  return roles[0];
}

function adapt(root) {
  assert(root && typeof root === "object", "Input root must be an object");
  assert(root.page_count === 100, `Declared page_count must be 100; received ${root.page_count}`);
  assert(Array.isArray(root.pages) && root.pages.length === 100, `pages must contain 100 items; received ${root.pages?.length}`);
  const slugs = new Set();
  const keys = new Set();
  const pages = root.pages.map((sourcePage, pageIndex) => {
    const at = `pages[${pageIndex}]`;
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourcePage.slug || ""), `${at}.slug must be lowercase kebab-case`);
    assert(!slugs.has(sourcePage.slug), `${at}.slug is duplicated: ${sourcePage.slug}`);
    slugs.add(sourcePage.slug);
    assert(typeof sourcePage.title === "string" && sourcePage.title.trim(), `${at}.title is required`);
    assert(Array.isArray(sourcePage.pictograms) && sourcePage.pictograms.length === 4, `${at}.pictograms must contain four items`);

    const pictograms = sourcePage.pictograms.map((sourceIcon, iconIndex) => {
      const iconAt = `${at}.pictograms[${iconIndex}]`;
      assert(typeof sourceIcon.key === "string", `${iconAt}.key is required`);
      assert(!keys.has(sourceIcon.key), `${iconAt}.key is duplicated: ${sourceIcon.key}`);
      keys.add(sourceIcon.key);
      assert(typeof sourceIcon.label === "string" && sourceIcon.label.trim(), `${iconAt}.label is required`);
      assert(typeof sourceIcon.caption === "string" && sourceIcon.caption.trim(), `${iconAt}.caption is required`);
      assert(sourceIcon.caption.length <= 120, `${iconAt}.caption must be 120 characters or fewer`);
      const suffix = getSuffix(sourcePage.slug, sourceIcon.key);
      const role = getRole(suffix);
      assert(role === ROLES[iconIndex], `${iconAt} is out of role order: key maps to ${role}, expected ${ROLES[iconIndex]}`);
      const [primary, secondary] = SEMANTIC_SHAPES[suffix];
      assert(Object.hasOwn(SHAPES, primary) && Object.hasOwn(SHAPES, secondary), `${iconAt} maps to an unavailable shape`);
      return {
        role,
        label: sourceIcon.label,
        alt: sourceIcon.caption,
        primary,
        secondary,
        suffix,
        source_key: sourceIcon.key,
        ...ROLE_STYLE[role]
      };
    });

    return {
      page_no: sourcePage.id,
      page_id: sourcePage.slug,
      slug: sourcePage.slug,
      title: sourcePage.title,
      cluster: sourcePage.cluster,
      pictograms
    };
  });
  assert(keys.size === 400, `Expected 400 unique source keys; received ${keys.size}`);
  return pages;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function build(options) {
  const inputRoot = JSON.parse(await readFile(options.input, "utf8"));
  const pages = adapt(inputRoot);
  const prepared = [];

  for (const page of pages) {
    const files = [];
    for (const [index, icon] of page.pictograms.entries()) {
      const filename = `pictogram-${String(index + 1).padStart(2, "0")}.svg`;
      const svg = renderSvg(page, icon);
      files.push({
        filename,
        target: resolve(options.output, page.slug, "images", filename),
        svg,
        sha256: sha256(svg),
        bytes: Buffer.byteLength(svg),
        icon
      });
    }
    prepared.push({ page, files });
  }

  const allFiles = prepared.flatMap((entry) => entry.files);
  assert(prepared.length === 100, `Expected 100 prepared pages; received ${prepared.length}`);
  assert(allFiles.length === 400, `Expected 400 prepared SVGs; received ${allFiles.length}`);
  const uniqueHashes = new Set(allFiles.map((file) => file.sha256));
  assert(uniqueHashes.size === 400, `SHA duplicate detected before write: ${400 - uniqueHashes.size} duplicate(s)`);

  if (!options.check) {
    for (const entry of prepared) {
      const imageDir = resolve(options.output, entry.page.slug, "images");
      await mkdir(imageDir, { recursive: true });
      for (const file of entry.files) await writeFile(file.target, file.svg, "utf8");
    }
  }

  const manifest = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: relative(REPO_ROOT, options.input).replaceAll("\\", "/"),
    page_count: prepared.length,
    pictogram_count: allFiles.length,
    unique_sha256_count: uniqueHashes.size,
    role_order: ROLES,
    pages: prepared.map(({ page, files }) => ({
      id: page.page_no,
      slug: page.slug,
      cluster: page.cluster,
      title: page.title,
      images: files.map((file, index) => ({
        role: ROLES[index],
        key: file.icon.source_key,
        label: file.icon.label,
        alt: file.icon.alt,
        semantic_suffix: file.icon.suffix,
        primary: file.icon.primary,
        secondary: file.icon.secondary,
        badge: file.icon.badge,
        background: file.icon.background,
        src: `/jikka-guide/${page.slug}/images/${file.filename}`,
        bytes: file.bytes,
        sha256: file.sha256
      }))
    }))
  };

  if (!options.check) {
    const manifestPath = resolve(options.output, "pictograms-manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    // Verify the bytes actually present on disk, rather than trusting prepared data.
    const diskHashes = [];
    for (const entry of prepared) {
      for (const file of entry.files) diskHashes.push(sha256(await readFile(file.target)));
    }
    assert(diskHashes.length === 400, `Disk verification expected 400 files; received ${diskHashes.length}`);
    assert(new Set(diskHashes).size === 400, "SHA duplicate detected after write");
    assert(diskHashes.every((hash, index) => hash === allFiles[index].sha256), "Disk verification hash mismatch");
  }

  return manifest;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node tools/visuals/build-jikka-guide-pictograms.mjs [--input <pages.json>] [--out <jikka-guide>] [--check]\n");
    return;
  }
  const manifest = await build(options);
  const action = options.check ? "Validated" : "Generated and verified";
  process.stdout.write(`${action} ${manifest.page_count} pages / ${manifest.pictogram_count} SVGs / ${manifest.unique_sha256_count} unique SHA-256 hashes.\n`);
}

main().catch((error) => {
  process.stderr.write(`Jikka guide pictogram build failed: ${error.message}\n`);
  process.exitCode = 1;
});
