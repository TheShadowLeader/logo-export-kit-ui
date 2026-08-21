/**
 * Browser-side rendering: the visitor's browser is the same engine class as
 * the kit's headless-Chrome fallback renderer, so canvas output matches the
 * CLI. CMYK is the one server round-trip (api/cmyk.py, Pillow).
 */
import { zipSync } from "fflate";
import type { Job } from "./engine";

const svgUrl = (svg: string) => URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("SVG failed to load"));
    im.src = url;
  });
}

async function canvasFor(job: Job): Promise<HTMLCanvasElement> {
  const url = svgUrl(job.svg!);
  try {
    const im = await loadImage(url);
    const iw = im.naturalWidth || 100, ih = im.naturalHeight || 100;
    const c = document.createElement("canvas");
    if (job.fit) {
      // s2p_fit port: center logo at `scale` inside the canvas, optional bg.
      const cw = job.width!, ch = job.height!;
      c.width = cw; c.height = ch;
      const ctx = c.getContext("2d")!;
      if (job.bg) { ctx.fillStyle = job.bg; ctx.fillRect(0, 0, cw, ch); }
      const s = Math.min((cw * (job.scale ?? 1)) / iw, (ch * (job.scale ?? 1)) / ih);
      const lw = Math.round(iw * s), lh = Math.round(ih * s);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, Math.round((cw - lw) / 2), Math.round((ch - lh) / 2), lw, lh);
    } else {
      const w = job.width!, h = job.height ?? Math.round(w * (ih / iw));
      c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;
      if (job.bg) { ctx.fillStyle = job.bg; ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, 0, 0, w, h);
    }
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBytes(c: HTMLCanvasElement, type: "image/png" | "image/jpeg", q?: number): Promise<Uint8Array> {
  return new Promise((res, rej) =>
    c.toBlob(
      (b) => (b ? b.arrayBuffer().then((ab) => res(new Uint8Array(ab))) : rej(new Error("toBlob failed"))),
      type, q
    )
  );
}

/** ICO container with embedded PNG entries (16/32/48). */
async function buildIco(svg: string, sizes: number[]): Promise<Uint8Array> {
  const pngs: Uint8Array[] = [];
  for (const s of sizes) {
    const c = await canvasFor({ path: "", kind: "png", svg, width: s, height: s, bg: null, label: "" });
    pngs.push(await canvasBytes(c, "image/png"));
  }
  const headerLen = 6 + 16 * sizes.length;
  const total = headerLen + pngs.reduce((a, p) => a + p.length, 0);
  const buf = new Uint8Array(total);
  const dv = new DataView(buf.buffer);
  dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, sizes.length, true);
  let off = headerLen;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    buf[e] = s === 256 ? 0 : s; buf[e + 1] = s === 256 ? 0 : s;
    buf[e + 2] = 0; buf[e + 3] = 0;
    dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true);
    dv.setUint32(e + 8, pngs[i].length, true); dv.setUint32(e + 12, off, true);
    buf.set(pngs[i], off); off += pngs[i].length;
  });
  return buf;
}

export type Produced = { path: string; bytes: Uint8Array; label: string; kind: Job["kind"]; previewUrl?: string };

/** Render every job; CMYK jobs call the API with the already-rendered print PNG. */
export async function produceAll(
  jobs: Job[],
  icoSizes: number[],
  onProgress: (done: number, total: number, current: string) => void
): Promise<{ files: Produced[]; warnings: string[] }> {
  const files: Produced[] = [];
  const warnings: string[] = [];
  const pngCache = new Map<string, Uint8Array>();
  let done = 0;

  for (const job of jobs) {
    onProgress(done, jobs.length, job.path.split("/").pop()!);
    try {
      if (job.kind === "svg") {
        files.push({ path: job.path, bytes: new TextEncoder().encode(job.svg!), label: job.label, kind: job.kind });
      } else if (job.kind === "ico") {
        files.push({ path: job.path, bytes: await buildIco(job.svg!, icoSizes), label: job.label, kind: job.kind });
      } else if (job.kind === "png" || job.kind === "jpg") {
        const c = await canvasFor(job);
        const bytes = await canvasBytes(c, job.kind === "png" ? "image/png" : "image/jpeg", 0.95);
        if (job.kind === "png") pngCache.set(job.path, bytes);
        const preview = c.width <= 1600 ? c : downscale(c, 800);
        files.push({ path: job.path, bytes, label: job.label, kind: job.kind, previewUrl: preview.toDataURL("image/png") });
      } else {
        // cmyk-tif / cmyk-jpg — server conversion of the cached print PNG
        const src = pngCache.get(job.srcPath!);
        if (!src) throw new Error("print PNG missing for CMYK");
        const fmt = job.kind === "cmyk-tif" ? "tif" : "jpg";
        const r = await fetch(`/api/cmyk?fmt=${fmt}`, { method: "POST", body: new Blob([src as BlobPart]), headers: { "content-type": "image/png" } });
        if (!r.ok) throw new Error(`CMYK API ${r.status}`);
        files.push({ path: job.path, bytes: new Uint8Array(await r.arrayBuffer()), label: job.label, kind: job.kind });
      }
    } catch (e) {
      warnings.push(`${job.path.split("/").pop()}: ${(e as Error).message}`);
    }
    done++;
  }
  onProgress(jobs.length, jobs.length, "done");
  return { files, warnings };
}

function downscale(c: HTMLCanvasElement, w: number): HTMLCanvasElement {
  const s = w / c.width;
  const d = document.createElement("canvas");
  d.width = w; d.height = Math.round(c.height * s);
  const ctx = d.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(c, 0, 0, d.width, d.height);
  return d;
}

export function makeZip(files: Produced[]): Uint8Array {
  const tree: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  for (const f of files) {
    // PNG/JPG/TIF are already compressed — store instead of deflate.
    tree[f.path] = f.kind === "svg" ? f.bytes : [f.bytes, { level: 0 }];
  }
  return zipSync(tree as Parameters<typeof zipSync>[0]);
}
