"use client";

/**
 * Logo Export Kit — web front-end. One engine, two front-ends: conventions
 * (detection, recolor, naming, sizes) are 1:1 with scripts/process_logos.py;
 * rendering happens in this browser (same engine class as the CLI's
 * headless-Chrome fallback), CMYK via api/cmyk.py on Vercel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildJobs, detect, DIMENSIONS, extractBg, genVars, ORI,
  type Av, type Detected, type Job, type Orientation,
} from "@/lib/engine";
import { makeZip, produceAll, type Produced } from "@/lib/render";
import Logo from "@/components/Logo";
import ThemeSwitch from "@/components/ThemeSwitch";

type Row = Detected & { id: number };

const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [client, setClient] = useState("");
  const [pbg, setPbg] = useState("#000000");
  const [nbg, setNbg] = useState("#FFFFFF");
  const [bgAuto, setBgAuto] = useState({ p: true, n: true });
  const [pbgSrc, setPbgSrc] = useState("fallback");
  const [nbgSrc, setNbgSrc] = useState("fallback");
  const [safeZone, setSafeZone] = useState(DIMENSIONS.safe_zone?.profile_logo_scale ?? 0.79);
  const [opts, setOpts] = useState({ bw: true, social: true, favicon: true, print: true, cmyk: true });
  const [dragOn, setDragOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ d: number; t: number; cur: string } | null>(null);
  const [produced, setProduced] = useState<Produced[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const idRef = useRef(1);
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const next: Row[] = [];
    for (const f of Array.from(list)) {
      if (!f.name.toLowerCase().endsWith(".svg")) continue;
      const svg = await f.text();
      next.push({ id: idRef.current++, file: f, name: f.name, svg, ...detect(f.name) });
    }
    if (next.length) setRows((r) => [...r, ...next]);
  }, []);

  // av model from rows (chip overrides included)
  const av: Av = useMemo(() => {
    const out: Av = {};
    for (const r of rows) {
      if (!r.orientation) continue;
      const o = r.orientation;
      out[o] = out[o] ?? {};
      const pol = o === "mark" ? "positive" : r.negative ? "negative" : "positive";
      (out[o] as NonNullable<Av[Orientation]>)[pol] = genVars(r.svg);
    }
    return out;
  }, [rows]);

  // brand backgrounds: auto-extract from horizontal vs mark, unless overridden
  useEffect(() => {
    const mark = av.mark?.positive?.["full-color"];
    if (bgAuto.p) {
      const h = av.horizontal?.positive?.["full-color"];
      const c = h && mark ? extractBg(h, mark) : null;
      setPbg(c ?? "#000000");
      setPbgSrc(c ? "extracted from horizontal" : "fallback #000000");
    }
    if (bgAuto.n) {
      const h = av.horizontal?.negative?.["full-color"];
      const c = h && mark ? extractBg(h, mark) : null;
      setNbg(c ?? "#FFFFFF");
      setNbgSrc(c ? "extracted from horizontal negative" : "fallback #FFFFFF");
    }
  }, [av, bgAuto]);

  const markSvg = useMemo(() => {
    for (const o of ["mark", "stacked", "horizontal", "type"] as Orientation[]) {
      const c = av[o]?.positive?.["full-color"];
      if (c) return c;
    }
    return null;
  }, [av]);

  const canGenerate = rows.some((r) => r.orientation) && !busy;

  const generate = async () => {
    setBusy(true);
    setProduced([]); setWarnings([]); setZipUrl(null);
    try {
      const { jobs, warnings: w1 } = buildJobs(av, client || "Client", { safeZone, pbg, nbg, ...opts });
      const { files, warnings: w2 } = await produceAll(jobs, DIMENSIONS.favicon.ico_sizes, (d, t, cur) =>
        setProgress({ d, t, cur })
      );
      setProduced(files);
      setWarnings([...w1, ...w2]);
      const zip = makeZip(files);
      const ab = new ArrayBuffer(zip.length);
      new Uint8Array(ab).set(zip);
      setZipUrl(URL.createObjectURL(new Blob([ab], { type: "application/zip" })));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const rootName = `${(client || "Client").replace(/[^\w-]+/g, "_")}_Logos`;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="brandlink" href="https://theshadowlegacy.com" target="_blank" rel="noopener noreferrer" aria-label="The Shadow Legacy">
            <Logo />
          </a>
          <span className="toolname">Logo Export Kit</span>
          <span className="tagline">Drop the masters. Leave with the whole package.</span>
          <span className="spacer" />
          <span className="env">Internal · The Shadow Legacy</span>
          <ThemeSwitch />
        </div>
      </header>

      <main className="wrap">
        {/* ── 1 · Upload ── */}
        <section>
          <p className="eyebrow">01 · Logos</p>
          <h2>The masters</h2>
          <div style={{ height: 14 }} />
          <div
            className={`drop${dragOn ? " on" : ""}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOn(true); }}
            onDragLeave={() => setDragOn(false)}
            onDrop={(e) => { e.preventDefault(); setDragOn(false); void addFiles(e.dataTransfer.files); }}
            data-testid="dropzone"
          >
            <b>Drop 1–7 SVG masters here</b>
            <p className="hint">
              {"or click to browse — orientation + negative auto-detected from filenames: "}
              <code>mark.svg · horizontal-positive.svg · stacked-negative.svg · type.svg</code>
            </p>
            <input
              ref={fileInput} type="file" accept=".svg" multiple hidden
              onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {rows.length > 0 && (
            <>
              <div style={{ height: 14 }} />
              <div className="chips">
                {rows.map((r) => (
                  <div key={r.id} className={`chip${r.orientation ? "" : " undetected"}`}>
                    <span className="fname" title={r.name}>{r.name}</span>
                    <select
                      value={r.orientation ?? ""}
                      onChange={(e) =>
                        setRows((rs) => rs.map((x) => x.id === r.id
                          ? { ...x, orientation: (e.target.value || null) as Orientation | null }
                          : x))
                      }
                    >
                      <option value="">— orientation —</option>
                      {ORI.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {r.orientation !== "mark" && (
                      <label className="neg">
                        <input
                          type="checkbox" checked={r.negative}
                          onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, negative: e.target.checked } : x))}
                        />
                        {"negative"}
                      </label>
                    )}
                    <span className="x" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>✕</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── 2 · Options ── */}
        <section>
          <p className="eyebrow">02 · Options</p>
          <h2>Client, colours, margins</h2>
          <div style={{ height: 14 }} />
          <div className="options">
            <div className="opt">
              <label>Client name</label>
              <input
                type="text" placeholder="Client name — drives every folder and filename" value={client}
                onChange={(e) => setClient(e.target.value)} data-testid="client-name"
              />
            </div>
            <div className="opt">
              <label>Profile bg · positive</label>
              <div className="colorrow">
                <input type="color" value={pbg} onChange={(e) => { setPbg(e.target.value); setBgAuto((b) => ({ ...b, p: false })); setPbgSrc("manual"); }} />
                <span className="hex">{pbg}</span>
              </div>
              <div className="src">{pbgSrc}</div>
            </div>
            <div className="opt">
              <label>Profile bg · negative</label>
              <div className="colorrow">
                <input type="color" value={nbg} onChange={(e) => { setNbg(e.target.value); setBgAuto((b) => ({ ...b, n: false })); setNbgSrc("manual"); }} />
                <span className="hex">{nbg}</span>
              </div>
              <div className="src">{nbgSrc}</div>
            </div>
            <div className="opt">
              <label>Safe zone (export margin)</label>
              <div className="slider-row">
                <input
                  type="range" min={0.5} max={1} step={0.01} value={safeZone}
                  onChange={(e) => setSafeZone(parseFloat(e.target.value))} data-testid="safe-zone"
                />
                <span className="val">{Math.round(safeZone * 100)}%</span>
              </div>
              <div style={{ height: 8 }} />
              <div className="szprev">
                <div className="disc" style={{ background: pbg }}>
                  {markSvg && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={svgDataUri(markSvg)} alt="" style={{ width: `${safeZone * 100}%`, height: `${safeZone * 100}%`, objectFit: "contain" }} />
                  )}
                </div>
                <span className="note">circular-crop preview — logo scaled inside the canvas so profile circles never clip it</span>
              </div>
            </div>
            <div className="opt">
              <label>Outputs</label>
              <div className="togglerow">
                {(
                  [["bw", "B&W versions"], ["social", "Social profiles"], ["favicon", "Favicon"], ["print", "Print"], ["cmyk", "CMYK (print)"]] as const
                ).map(([k, lbl]) => (
                  <label key={k}>
                    <input
                      type="checkbox" checked={opts[k]}
                      onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3 · Generate ── */}
        <section>
          <div className="genrow">
            <button className="btn" disabled={!canGenerate} onClick={() => void generate()} data-testid="generate">
              {busy ? "Rendering…" : "Generate the package"}
            </button>
            {zipUrl && (
              <a className="btn ghost" href={zipUrl} download={`${rootName}.zip`} data-testid="download-zip">
                {"Download "}{rootName}{".zip"}
              </a>
            )}
            {progress && (
              <span className="progress">
                {progress.d}{"/"}{progress.t}{" · "}{progress.cur}
              </span>
            )}
            {!busy && produced.length > 0 && (
              <span className="progress" data-testid="done-count">
                {produced.length}{" files ready"}
              </span>
            )}
          </div>
          {warnings.length > 0 && (
            <>
              <div style={{ height: 12 }} />
              <div className="warnbox">
                {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            </>
          )}
        </section>

        {/* ── 4 · Structure + previews ── */}
        {produced.length > 0 && (
          <section className="results" data-testid="results">
            <Tree files={produced} root={rootName} />
            <Grid files={produced} root={rootName} />
          </section>
        )}
      </main>

      <footer className="foot">
        <div className="wrap">
          <span>
            {"© "}{new Date().getFullYear()}{" "}
            <a href="https://theshadowlegacy.com" target="_blank" rel="noopener noreferrer">The Shadow Legacy</a>
            {" — one engine, two front-ends. The CLI skill and this tool share every convention."}
          </span>
          <span className="spacer" />
          <code>hosted CMYK is profile-less · the CLI applies ICC locally</code>
        </div>
      </footer>
    </>
  );
}

/* ── Folder tree with per-file details ── */
function Tree({ files, root }: { files: Produced[]; root: string }) {
  type Node = { dirs: Map<string, Node>; files: { name: string; label: string; size: number; path: string }[] };
  const mk = (): Node => ({ dirs: new Map(), files: [] });
  const tree = useMemo(() => {
    const t = mk();
    for (const f of files) {
      const parts = f.path.split("/");
      let cur = t;
      for (const d of parts.slice(0, -1)) {
        if (!cur.dirs.has(d)) cur.dirs.set(d, mk());
        cur = cur.dirs.get(d)!;
      }
      cur.files.push({ name: parts[parts.length - 1], label: f.label, size: f.bytes.length, path: f.path });
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const fmt = (n: number) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

  const Render = ({ node }: { node: Node }) => (
    <div className="indent">
      {[...node.dirs.entries()].map(([d, n]) => (
        <div key={d}>
          <span className="dir">▸ {d}/</span>
          <Render node={n} />
        </div>
      ))}
      {node.files.map((f) => (
        <div key={f.path}>
          <span className="file" title={f.label}>{f.name}</span>
          <span className="meta">
            {f.label}{" · "}{fmt(f.size)}
          </span>
        </div>
      ))}
    </div>
  );

  const total = files.reduce((a, f) => a + f.bytes.length, 0);
  return (
    <div className="tree" data-testid="tree">
      <span className="dir">▾ {root}/</span>
      <Render node={tree.dirs.get(root) ?? tree} />
      <div style={{ marginTop: 10, color: "var(--ink-3)" }}>
        {files.length}{" files · "}{fmt(total)}
      </div>
    </div>
  );
}

/* ── Preview grid grouped by section ── */
function Grid({ files, root }: { files: Produced[]; root: string }) {
  const sections: [string, (p: string) => boolean][] = [
    ["Social", (p) => p.startsWith(`${root}/Social/`)],
    ["Favicon", (p) => p.startsWith(`${root}/Web/Favicon/`)],
    ["Web", (p) => p.startsWith(`${root}/Web/`) && !p.startsWith(`${root}/Web/Favicon/`)],
    ["Print", (p) => p.startsWith(`${root}/Print/`)],
  ];
  const dl = (f: Produced) => {
    const ab = new ArrayBuffer(f.bytes.length);
    new Uint8Array(ab).set(f.bytes);
    const url = URL.createObjectURL(new Blob([ab]));
    const a = document.createElement("a");
    a.href = url; a.download = f.path.split("/").pop()!;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  return (
    <div className="grid">
      {sections.map(([name, match]) => {
        const fs = files.filter((f) => match(f.path));
        if (!fs.length) return null;
        return (
          <FragmentSection key={name} name={name} fs={fs} circle={name === "Social"} dl={dl} />
        );
      })}
    </div>
  );
}

function FragmentSection({ name, fs, circle, dl }: { name: string; fs: Produced[]; circle: boolean; dl: (f: Produced) => void }) {
  return (
    <>
      <div className="gsec">
        <p className="eyebrow">{name}{" · "}{fs.length}{" files"}</p>
      </div>
      {fs.map((f) => (
        <div key={f.path} className={`tile${f.previewUrl ? "" : " doc"}`}>
          <div className={`im${circle ? " circle" : ""}`}>
            {f.previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={f.previewUrl} alt={f.path} loading="lazy" />
            ) : (
              <span>{f.path.split(".").pop()!.toUpperCase()}</span>
            )}
          </div>
          <div className="cap">
            <div className="nm">{f.path.split("/").pop()}</div>
            <div className="lb">
              {f.label}
              {" · "}
              <a onClick={(e) => { e.preventDefault(); dl(f); }} href="#dl">download</a>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
