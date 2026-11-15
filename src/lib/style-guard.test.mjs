// Run with `npm run test:unit`. Keeps the Frost and slate restyle consistent
// (Docs/superpowers/specs/2026-11-15-app-restyle-frost-and-slate-design.md).
//
// Every folder in SWEPT has been moved onto the shared look, and this test
// stops it drifting back:
//   1. no hand-rolled bordered boxes: a section is a <Panel>. A genuine
//      inline box (a token chip, a bed tile) ends its line with
//      `// restyle: inline` or `{/* restyle: inline */}`;
//   2. no raw Tailwind palette colours: colours come from the theme tokens;
//   3. no ad-hoc <h1>: page titles go through <PageHeader> (a centred
//      state page, like "no permission", marks its <h1> `restyle: inline`);
//   4. no new animation: the only motion is the shadcn enter/exit fades.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// The whole app. Swept group by group (shell and auth, reception, clinical,
// lab and billing, admin and platform); every screen is on the shared look now.
const SWEPT = ["src/app", "src/features", "src/components"];

/** Files that define the look itself, so they may use what the rules forbid. */
const EXEMPT = [
  "src/components/ui/",
  "src/components/panel.tsx",
  "src/components/page-header.tsx",
];

const BOX = /\brounded-(lg|xl|2xl)\b[^"'`]*\bborder\b(?!-)|\bborder\b(?!-)[^"'`]*\brounded-(lg|xl|2xl)\b/;
const PALETTE =
  /\b(bg|text|border)-(gray|slate|zinc|neutral|stone|red|green|amber|blue|yellow|emerald|teal|sky|orange|rose)-\d{2,3}\b/;
const INLINE_OK = /restyle: inline/;
const ANIMATE = /\banimate-(?!in\b|out\b|none\b)[a-z-]+/;

function tsxUnder(dir) {
  // A SWEPT entry may be a single file. A path that does not exist throws
  // (statSync), so a typo cannot silently exempt a folder.
  if (!statSync(join(ROOT, dir)).isDirectory()) return dir.endsWith(".tsx") ? [dir] : [];
  const out = [];
  const entries = readdirSync(join(ROOT, dir));
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...tsxUnder(rel));
    else if (name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

function sweptFiles() {
  const files = new Set(SWEPT.flatMap(tsxUnder));
  return [...files]
    .map((f) => relative(ROOT, join(ROOT, f)).split(sep).join("/"))
    .filter((f) => !EXEMPT.some((e) => f.startsWith(e)));
}

function offences(rule) {
  const found = [];
  for (const file of sweptFiles()) {
    const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
    lines.forEach((line, i) => {
      const why = rule(line);
      if (why) found.push(`${file}:${i + 1} ${why}: ${line.trim().slice(0, 110)}`);
    });
  }
  return found;
}

test("swept screens use Panel, not hand-rolled bordered boxes", () => {
  const found = offences((line) => BOX.test(line) && !INLINE_OK.test(line) && "box");
  assert.deepEqual(found, []);
});

test("swept screens use theme colours, not raw palette classes", () => {
  assert.deepEqual(offences((line) => PALETTE.test(line) && "palette"), []);
});

test("swept screens put page titles in PageHeader", () => {
  assert.deepEqual(offences((line) => /<h1[\s>]/.test(line) && !INLINE_OK.test(line) && "h1"), []);
});

test("swept screens add no animation", () => {
  assert.deepEqual(offences((line) => ANIMATE.test(line) && "animation"), []);
});

test("chip tones follow frost and slate and keep the terminals distinct", () => {
  const chip = readFileSync(join(ROOT, "src/components/status-chip.tsx"), "utf8");
  assert.match(chip, /AWAITING_RESULTS:\s*"[^"]*s-lab/);
  assert.match(chip, /PENDING_CLEARANCE:\s*"[^"]*s-bill/);
  assert.match(chip, /IN_CONSULTATION:\s*"[^"]*s-doc/);
  assert.match(chip, /REGISTERED:\s*"[^"]*s-wait/);
  assert.match(chip, /DECEASED:\s*"[^"]*bg-foreground/);
  assert.match(chip, /LAMA:\s*"[^"]*critical/);
  assert.match(chip, /REFERRED_OUT:\s*"[^"]*info/);
  assert.match(chip, /COMPLETED:\s*"[^"]*success/);
});

test("print stays white with black ink: no screen tints or panel shadow", () => {
  const PRINT = ["src/app/(print)", "src/features/billing/print"];
  const TINT = /\b(bg-band|bg-muted|bg-accent|bg-s-[a-z-]+|shadow-panel)\b/;
  const found = [];
  for (const file of PRINT.flatMap(tsxUnder)) {
    readFileSync(join(ROOT, file), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (TINT.test(line)) found.push(`${file}:${i + 1}: ${line.trim().slice(0, 110)}`);
      });
  }
  assert.deepEqual(found, []);
});

test("focus rings stay visible: no faint ring on the shared controls", () => {
  const found = [];
  for (const file of tsxUnder("src/components/ui")) {
    readFileSync(join(ROOT, file), "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const m of line.matchAll(/focus-visible[^\s"]*:ring-ring\/(\d+)/g)) {
          if (Number(m[1]) < 50) found.push(`${file}:${i + 1}: ring-ring/${m[1]}`);
        }
      });
  }
  assert.deepEqual(found, []);
});

test("printed documents keep bold section headings", () => {
  const PRINTED = ["src/app/(print)", "src/features/billing/print", "src/features/chart/printed-summary.tsx"];
  const found = [];
  for (const file of PRINTED.flatMap(tsxUnder)) {
    readFileSync(join(ROOT, file), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/<h[1-3][\s>]/.test(line) && /\bfont-medium\b/.test(line)) found.push(`${file}:${i + 1}`);
      });
  }
  assert.deepEqual(found, []);
});
