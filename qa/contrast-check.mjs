// Contrast gate for the two themes — reads app/globals.css (the truth, no copied
// values), resolves var() chains per theme, alpha-blends rgba over its backdrop and
// asserts WCAG ratios for every text pair the UI actually renders.
// Run: node qa/contrast-check.mjs   (exit 1 on any failure)
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const block = (sel) => {
  const m = css.match(new RegExp(`(?:^|\\n)${sel.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no ${sel} block`);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[k] = v.trim();
  return out;
};
const root = block(":root"), dark = block(".dark");
const themes = { light: root, dark: { ...root, ...dark } };

const parse = (v) => {
  v = v.trim();
  let m;
  if ((m = v.match(/^#([0-9a-f]{6})$/i))) return [1, 3, 5].map((i) => parseInt(m[1].slice(i - 1, i + 1), 16)).concat(1);
  if ((m = v.match(/^#([0-9a-f]{3})$/i))) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  if ((m = v.match(/^rgba?\(([^)]+)\)$/))) { const [r, g, b, a = 1] = m[1].split(",").map(Number); return [r, g, b, a]; }
  throw new Error(`unparsable color ${v}`);
};
const resolve = (t, name) => { let v = t[name], m; while ((m = v?.match(/^var\(--([\w-]+)\)$/))) v = t[m[1]]; if (!v) throw new Error(`no --${name}`); return parse(v); };
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (fg, bg) => { const [a, b] = [lum(fg), lum(bg)]; return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };

// [foreground, backdrop stack (outermost first), min ratio, where it shows]
const PAIRS = [
  ["ink", ["bg"], 4.5, "body text"],
  ["ink-2", ["bg"], 4.5, "tagline / eyebrows"],
  ["ink-3", ["bg"], 3, "env label / notes (de-emphasised meta)"],
  ["ink-bright", ["bg", "surface"], 4.5, "headings on panels"],
  ["ink-2", ["bg", "surface"], 4.5, "labels / chip names / tree files on panels"],
  ["ink-3", ["bg", "surface"], 3, "tree meta / tile labels on panels"],
  ["ink", ["bg", "surface", "field"], 4.5, "input + select text on the tinted field"],
  ["ink-3", ["bg", "surface", "field"], 3, "placeholder on the tinted field"],
  ["well-ink", ["bg", "well"], 4.5, "drop-zone title on the dark well"],
  ["well-ink-2", ["bg", "well"], 4.5, "drop-zone hint on the dark well"],
  ["well-ink-3", ["bg", "well"], 3, "drop-zone filename examples"],
  ["moonmist", ["island"], 4.5, "island text"],
  ["dir", ["bg", "surface"], 4.5, "tree folder names (12px)"],
  ["warn", ["bg", "warn-bg"], 4.5, "warnbox text"],
  ["midnight", ["sunrise"], 3, "primary HoverButton label on sunrise (site spec — UI component threshold)"],
  ["ink-bright", ["bg"], 4.5, "ghost HoverButton label at rest"],
  ["hb-over", ["bg", "hb-dot"], 3, "ghost HoverButton overlay label on the flood (UI component)"],
  ["ink", ["bg", "sunrise-soft"], 4.5, "toggle chip text when selected"],
];

let fail = 0;
for (const [name, t] of Object.entries(themes)) {
  console.log(`\n${name.toUpperCase()}`);
  for (const [fg, stack, min, where] of PAIRS) {
    let bg = resolve(t, stack[0]);
    for (const s of stack.slice(1)) bg = over(resolve(t, s), bg);
    const f = over(resolve(t, fg), bg);
    const r = ratio(f, bg);
    const ok = r >= min;
    if (!ok) fail++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)} ≥ ${min}  --${fg} on ${stack.join("›")}  (${where})`);
  }
}
console.log(fail ? `\n${fail} pair(s) FAIL` : "\nall pairs pass");
process.exit(fail ? 1 : 0);
