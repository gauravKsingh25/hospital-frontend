// Run with `npm run test:unit`. The app's look is a set of tokens in
// globals.css (Frost and slate, Docs/superpowers/specs/2026-11-15-app-restyle-
// frost-and-slate-design.md). This pins the values and, more importantly,
// that every text colour stays readable on the ground it sits on: a restyle
// must never trade a misread dose for a softer grey.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

function rootToken(name) {
  const m = rootBlock.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(m, `--${name} is defined in :root`);
  return m[1].trim();
}

function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `${hex} is a 6-digit hex colour`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("frost and slate tokens", () => {
  assert.equal(rootToken("background"), "#f7f9fa");
  assert.equal(rootToken("card"), "#ffffff");
  assert.equal(rootToken("sidebar"), "#f0f4f5");
  assert.equal(rootToken("muted"), "#ecf0f2");
  assert.equal(rootToken("band"), "#f4f7f8");
  assert.equal(rootToken("foreground"), "#1f3038");
  assert.equal(rootToken("muted-foreground"), "#5b6b72");
  assert.equal(rootToken("border"), "#dbe2e5");
  assert.equal(rootToken("border-soft"), "#e9eef0");
  assert.equal(rootToken("primary"), "#0d7480");
  assert.equal(rootToken("ring"), "#0d7480");
  assert.equal(rootToken("accent"), "#dcefed");
  assert.equal(rootToken("accent-foreground"), "#0d5a63");
  assert.equal(rootToken("success"), "#1a7a50"); // spec #1f8a5b fails AA on white
  assert.equal(rootToken("radius"), "0.75rem");
  assert.equal(rootToken("tap-target"), "2.75rem");
});

test("body ink is AAA on every ground", () => {
  for (const g of ["background", "card", "sidebar", "band", "muted"]) {
    const ratio = contrast(rootToken("foreground"), rootToken(g));
    assert.ok(ratio >= 7, `foreground on ${g}: ${ratio.toFixed(2)}`);
  }
});

test("every text pair is at least AA", () => {
  const pairs = [
    ["muted-foreground", "background"],
    ["muted-foreground", "card"],
    ["muted-foreground", "muted"],
    ["muted-foreground", "band"],
    ["primary-foreground", "primary"],
    ["primary", "card"],
    ["accent-foreground", "accent"],
    ["critical", "card"],
    ["critical-foreground", "critical"],
    ["caution-foreground", "caution"],
    ["success-foreground", "success"],
    ["success", "card"],
    ["info-foreground", "info"],
    ["info", "card"],
    ["s-wait", "s-wait-bg"],
    ["s-doc", "s-doc-bg"],
    ["s-lab", "s-lab-bg"],
    ["s-bill", "s-bill-bg"],
  ];
  for (const [fg, bg] of pairs) {
    const ratio = contrast(rootToken(fg), rootToken(bg));
    assert.ok(ratio >= 4.5, `${fg} on ${bg}: ${ratio.toFixed(2)}`);
  }
});

test("fonts: Instrument Sans + Devanagari stack, DM Mono for numbers", () => {
  // Self-hosted from the repo: a build must never depend on Google Fonts
  // answering (its `/l/font?kit=` addresses break Turbopack with a 500).
  assert.doesNotMatch(layout, /from\s+["']next\/font\/google["']/);
  for (const file of [
    "InstrumentSans.woff2",
    "DMMono-Regular.woff2",
    "DMMono-Medium.woff2",
    "NotoSansDevanagari.woff2",
  ]) {
    assert.ok(layout.includes(`./fonts/${file}`), `layout loads ${file}`);
    assert.ok(existsSync(new URL(`../app/fonts/${file}`, import.meta.url)), `${file} is committed`);
  }
  assert.doesNotMatch(layout, /\bInter\b/);
  assert.match(css, /--font-sans:\s*var\(--font-latin\),\s*var\(--font-devanagari\)/);
  assert.match(css, /--font-mono:\s*var\(--font-dm-mono\)/);
  assert.match(css, /\.tabular\s*\{[^}]*font-family:\s*var\(--font-mono\)/);
});

test("no keyframes added to the theme", () => {
  assert.doesNotMatch(css, /@keyframes/);
});

test("mono numbers keep Hindi in Noto and have the rupee sign", () => {
  // `.tabular` holds translated words too ("बकाया", a doctor's name), so the
  // mono stack must fall through to Devanagari, not to a system font.
  assert.match(css, /--font-mono:\s*var\(--font-dm-mono\),\s*var\(--font-devanagari\)/);
  // ₹ (U+20B9) is not in DM Mono at all, so it comes from that same
  // Devanagari fallback — `scripts/build-fonts.py` keeps U+20B9 in its subset.
  assert.match(
    readFileSync(new URL("../../scripts/build-fonts.py", import.meta.url), "utf8"),
    /DEVANAGARI = \([^)]*U\+20B9/,
  );
});
