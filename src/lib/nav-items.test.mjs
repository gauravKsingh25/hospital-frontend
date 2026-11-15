// Run with `npm run test:unit`. Lab testing and messages are labelled
// "Coming soon" (Docs/superpowers/specs/2026-11-15-doctor-page-and-involvement-design.md):
// a badge only — both screens keep working underneath — and on exactly those
// two items, so a badge never lands on a screen that is finished.
import assert from "node:assert/strict";
import { test } from "node:test";

import { NAV_ITEMS } from "../components/app-shell/nav-items.ts";

test("lab and messages are marked coming soon, and nothing else is", () => {
  const marked = NAV_ITEMS.filter((item) => item.comingSoon).map((item) => item.labelKey);
  assert.deepEqual(marked.sort(), ["diagnostics", "messages"]);
  for (const item of NAV_ITEMS.filter((entry) => entry.comingSoon)) {
    assert.equal(item.comingSoon, true);
  }
});
