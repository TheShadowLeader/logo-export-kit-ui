/**
 * Engine conventions ported 1:1 from logo-export-kit/scripts/process_logos.py
 * (detection, recolor, bg extraction, folder + file naming). The Python
 * pipeline stays the source of truth for the CLI; dimensions.json is the
 * shared contract between both front-ends.
 */
import dims from "./dimensions.json";

export const DIMENSIONS = dims as unknown as {
  social: Record<string, { profile: { size: [number, number]; notes?: string } }>;
  favicon: { ico_sizes: number[]; png_sizes: Record<string, [number, number]>; include_svg?: boolean };
  web: { widths: number[]; include_svg?: boolean };
  print: { png_width: number; min_dpi: number; include_jpg?: boolean; jpg_quality?: number };
  safe_zone: { profile_logo_scale: number };
};

export const ORI = ["mark", "horizontal", "stacked", "type"] as const;
export type Orientation = (typeof ORI)[number];
const NEG = ["negative", "neg", "reverse", "reversed", "dark", "inverted"];

export type Detected = {
  file: File;
  name: string;
  svg: string;
  orientation: Orientation | null;
  negative: boolean;
};

export function detect(name: string): { orientation: Orientation | null; negative: boolean } {
  const nm = name.toLowerCase().replace(/\.svg$/, "").replace(/_/g, "-");
  const orientation = ORI.find((o) => nm.includes(o)) ?? null;
  const negative = NEG.some((k) => nm.includes(k));
  return { orientation, negative };
}

/* ── color helpers (port of get_hexes / lum / extract_bg) ── */
function getHexes(svg: string): Set<string> {
  const out = new Set<string>();
  for (const m of svg.matchAll(/#([0-9a-fA-F]{6})\b/g)) out.add("#" + m[1].toUpperCase());
  for (const m of svg.matchAll(/#([0-9a-fA-F]{3})\b(?![0-9a-fA-F])/g)) {
    const c = m[1].toUpperCase();
    out.add(`#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`);
  }
  return out;
}

function lum(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Color present in horizontal but not in mark = wordmark color = profile bg. */
export function extractBg(horizSvg: string, markSvg: string): string | null {
  const hc = getHexes(horizSvg), mc = getHexes(markSvg);
  const unique = [...hc].filter((c) => !mc.has(c));
  if (!unique.length) return null;
  if (unique.length === 1) return unique[0];
  const avg = [...mc].reduce((s, c) => s + lum(c), 0) / Math.max(mc.size, 1);
  return unique.reduce((a, b) => (Math.abs(lum(a) - avg) > Math.abs(lum(b) - avg) ? a : b));
}

/* ── recolor (port of recolor()) ── */
const NAMED =
  "black|white|red|green|blue|gray|grey|silver|maroon|yellow|olive|lime|aqua|teal|navy|fuchsia|purple|orange|gold|indigo|violet|pink|brown|tan|beige|ivory|khaki|salmon|coral|tomato|orchid|plum|turquoise|cyan|magenta|crimson|lavender|azure|snow|linen";

export function recolor(svg: string, tgt: string): string {
  let r = svg;
  r = r.replace(/(?<!url\()#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, tgt);
  r = r.replace(/rgba?\s*\([^)]+\)/g, tgt);
  r = r.replace(/((?:fill|stroke))\s*=\s*(["'])([^"']+)\2/g, (m, a, q, v) => {
    const lv = v.trim().toLowerCase();
    if (["none", "transparent", "currentcolor", "inherit"].includes(lv) || lv.startsWith("url(")) return m;
    if (new RegExp(`^(${NAMED})$`, "i").test(v.trim())) return `${a}=${q}${tgt}${q}`;
    return m;
  });
  r = r.replace(/((?:fill|stroke|color|background(?:-color)?)\s*):\s*([^;}'"]+)/g, (m, p, v) => {
    const lv = v.trim().toLowerCase();
    if (["none", "transparent", "currentcolor", "inherit"].includes(lv) || lv.startsWith("url(")) return m;
    if (new RegExp(`^(${NAMED})$`, "i").test(v.trim())) return `${p}:${tgt}`;
    return m;
  });
  return r;
}

export type Variants = { "full-color": string; black: string; white: string };
export const genVars = (svg: string): Variants => ({
  "full-color": svg,
  black: recolor(svg, "#000000"),
  white: recolor(svg, "#FFFFFF"),
});

/** viewBox/width/height parse (port of dims()). */
export function svgDims(svg: string): [number, number] {
  const vb = svg.match(/viewBox=["']([^"']+)["']/);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/);
    if (p.length === 4) return [parseFloat(p[2]), parseFloat(p[3])];
  }
  const w = svg.match(/\bwidth=["']([0-9.]+)/), h = svg.match(/\bheight=["']([0-9.]+)/);
  if (w && h) return [parseFloat(w[1]), parseFloat(h[1])];
  return [100, 100];
}

/* ── logical package model (folder tree + jobs), naming 1:1 with Python ── */
export type Job = {
  path: string;                 // full path inside the zip, incl. {Client}_Logos/
  kind: "svg" | "png" | "jpg" | "ico" | "cmyk-tif" | "cmyk-jpg";
  svg?: string;                 // source svg for raster/svg jobs
  width?: number; height?: number;
  bg?: string | null;           // canvas bg (social composites)
  scale?: number;               // safe-zone scale for composites
  fit?: boolean;                // s2p_fit-style centering composite
  srcPath?: string;             // for cmyk jobs: the print png job path it converts
  label: string;                // human detail line for the tree
};

export type Av = Partial<Record<Orientation, Partial<Record<"positive" | "negative", Variants>>>>;

export function buildJobs(
  av: Av,
  client: string,
  opts: {
    safeZone: number;
    pbg: string; nbg: string;
    social: boolean; favicon: boolean; print: boolean; cmyk: boolean; bw: boolean;
  }
): { jobs: Job[]; warnings: string[] } {
  const root = `${client.replace(/[^\w-]+/g, "_") || "Client"}_Logos`;
  const jobs: Job[] = [];
  const warnings: string[] = [];
  const cmykName = { "full-color": "Full_Color", black: "Black", white: "White" } as const;
  const colorsOf = (v: Variants) =>
    (opts.bw ? (Object.keys(v) as (keyof Variants)[]) : (["full-color"] as (keyof Variants)[]));

  // Social (mark on brand bg, safe-zone scaled)
  if (opts.social) {
    let mk: string | undefined;
    for (const o of ["mark", "stacked", "horizontal", "type"] as Orientation[]) {
      const c = av[o]?.positive?.["full-color"];
      if (c) { mk = c; break; }
    }
    if (!mk) warnings.push("No mark for social profiles");
    else
      for (const [pl, pc] of Object.entries(DIMENSIONS.social)) {
        const [w, h] = pc.profile.size;
        for (const [pol, bg] of [["Positive", opts.pbg], ["Negative", opts.nbg]] as const) {
          jobs.push({
            path: `${root}/Social/${pl}/${pol}/${pl}_Profile_${w}x${h}.png`,
            kind: "png", svg: mk, width: w, height: h, bg, scale: opts.safeZone, fit: true,
            label: `${w}×${h} · on ${bg}`,
          });
        }
      }
  }

  // Favicon (mark, else stacked)
  if (opts.favicon) {
    const sv = av.mark?.positive?.["full-color"] ?? av.stacked?.positive?.["full-color"];
    if (!sv) warnings.push("No mark for favicon");
    else {
      const fd = `${root}/Web/Favicon`;
      for (const [fn, [w, h]] of Object.entries(DIMENSIONS.favicon.png_sizes)) {
        jobs.push({
          path: `${fd}/${fn}`, kind: "png", svg: sv, width: w, height: h,
          fit: w > 48, scale: 0.85, bg: null, label: `${w}×${h}`,
        });
      }
      jobs.push({ path: `${fd}/favicon.ico`, kind: "ico", svg: sv, label: DIMENSIONS.favicon.ico_sizes.join("+") + "px" });
      if (DIMENSIONS.favicon.include_svg !== false)
        jobs.push({ path: `${fd}/icon.svg`, kind: "svg", svg: sv, label: "vector" });
    }
  }

  // Web (all orientations × colors × pos/neg)
  for (const [o, pols] of Object.entries(av) as [Orientation, NonNullable<Av[Orientation]>][]) {
    const of = `Logo_${o[0].toUpperCase()}${o.slice(1)}`;
    const h2 = Object.keys(pols).length > 1 && o !== "mark";
    for (const [pol, vars] of Object.entries(pols) as ["positive" | "negative", Variants][]) {
      const base = h2 ? `${root}/Web/${of}/${pol[0].toUpperCase()}${pol.slice(1)}` : `${root}/Web/${of}`;
      for (const color of colorsOf(vars)) {
        const sv = vars[color];
        const fo = `${base}/${cmykName[color]}`;
        const pre = h2 ? `${o}_${pol}_${color}` : `${o}_${color}`;
        for (const w of DIMENSIONS.web.widths) {
          const [sw, sh] = svgDims(sv);
          jobs.push({ path: `${fo}/${pre}_${w}px.png`, kind: "png", svg: sv, width: w, height: Math.round(w * (sh / sw)), bg: null, label: `${w}px · transparent` });
        }
        if (DIMENSIONS.web.include_svg !== false)
          jobs.push({ path: `${fo}/${pre}.svg`, kind: "svg", svg: sv, label: "vector" });
      }
    }
  }

  // Print (full-color + black; SVG + PNG + JPG + CMYK)
  if (opts.print) {
    const pw = DIMENSIONS.print.png_width, dpi = DIMENSIONS.print.min_dpi;
    for (const [o, pols] of Object.entries(av) as [Orientation, NonNullable<Av[Orientation]>][]) {
      const of = `Logo_${o[0].toUpperCase()}${o.slice(1)}`;
      const h2 = Object.keys(pols).length > 1 && o !== "mark";
      for (const [pol, vars] of Object.entries(pols) as ["positive" | "negative", Variants][]) {
        for (const color of ["full-color", "black"] as const) {
          if (!opts.bw && color === "black") continue;
          const sv = vars[color];
          const fo = h2
            ? `${root}/Print/${of}/${pol[0].toUpperCase()}${pol.slice(1)}/${cmykName[color]}`
            : `${root}/Print/${of}/${cmykName[color]}`;
          const pre = h2 ? `${o}_${pol}_${color}` : `${o}_${color}`;
          const [sw, sh] = svgDims(sv);
          const hh = Math.round(pw * (sh / sw));
          jobs.push({ path: `${fo}/${pre}_print.svg`, kind: "svg", svg: sv, label: "vector master" });
          const pngPath = `${fo}/${pre}_print_${pw}x${hh}_${dpi}dpi.png`;
          jobs.push({ path: pngPath, kind: "png", svg: sv, width: pw, height: hh, bg: null, label: `${pw}×${hh} · ${dpi}dpi RGB` });
          if (DIMENSIONS.print.include_jpg !== false)
            jobs.push({ path: `${fo}/${pre}_print_${pw}x${hh}_${dpi}dpi.jpg`, kind: "jpg", svg: sv, width: pw, height: hh, bg: "#FFFFFF", label: `${pw}×${hh} · ${dpi}dpi RGB, white bg` });
          if (opts.cmyk) {
            jobs.push({ path: `${fo}/${pre}_print_${pw}x${hh}_${dpi}dpi_CMYK.tif`, kind: "cmyk-tif", srcPath: pngPath, label: `${pw}×${hh} · 300dpi CMYK TIFF` });
            jobs.push({ path: `${fo}/${pre}_print_${pw}x${hh}_${dpi}dpi_CMYK.jpg`, kind: "cmyk-jpg", srcPath: pngPath, label: `${pw}×${hh} · 300dpi CMYK JPEG` });
          }
        }
      }
    }
  }

  return { jobs, warnings };
}
