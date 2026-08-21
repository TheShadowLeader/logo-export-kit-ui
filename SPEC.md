# Logo Export Kit — UI spec (v2, amendments folded in 21-08-2026)

**Status: APPROVED with amendments — building.** One engine, two front-ends; the CLI skill stays the CLI skill.

## Vanja's amendments (all in)

1. **CMYK print output — engine-level, not UI-only.** DONE in the skill itself first: `process_logos.py` now emits `_CMYK.tif` (LZW) + `_CMYK.jpg` at 300dpi per print variant (ICC-converted where a profile exists, macOS Generic CMYK by default; `print.cmyk_icc` config override; `"cmyk": false` to disable). SKILL.md documents it; installed skill copy synced.
2. **Hosted on a URL + shared via GitHub.** Repo: `github.com/TheShadowLeader/logo-export-kit-ui` (private — flip public anytime), deployed on Vercel.
3. **LBP integration later** — confirmed out of v1, architecture keeps the export logic in `lib/` so the portal can import it later.
4. **Safe zone / export margin: YES** — the engine already had it for social profiles (logo scaled to 79% of canvas so circular crops don't clip). Now exposed: **`--safe-zone 0.5–1.0` CLI flag** + a UI slider (default 0.79) with a live circle-crop preview on the social tiles.
5. **Folder-structure preview: YES** — dedicated tree panel mirroring the exact output structure (Social/Web/Favicon/Print, pos/neg, color subfolders) with per-file detail (name, dimensions, format, weight), plus the visual preview grid.

## Architecture (the one real decision, made)

- **Rendering happens in the browser.** The kit's own fallback renderer is headless Chrome — the visitor's browser is the same engine, so canvas rasterization gives identical output with zero server dependencies, and the preview grid IS the render (instant, free). SVG recolor (black/white/brand) is DOM manipulation, zip is client-side (`fflate`).
- **CMYK is the one server piece:** a small Python function on Vercel (`api/cmyk.py`, Pillow-only — pure wheels, no cairo needed) receives the browser-rendered 4000px print PNGs and returns CMYK TIFF+JPEG. Hosted conversion is profile-less (naive, fine for flat logo color — print shops re-profile anyway); the CLI skill uses ICC locally. Documented in-app.
- **Shared contract:** `references/dimensions.json` vendored from the kit (single source of sizes/naming); folder + filename conventions ported 1:1 from the Python engine.

## Screen (top to bottom)

1. **Drop zone** — 1–7 SVGs; auto-detect orientation (mark/horizontal/stacked/type) + positive/negative from filenames; correctable detection chips per file.
2. **Options** — client name · brand colors (auto-extracted from horizontal SVG, override/add via pickers) · **safe-zone slider 0.5–1.0** (live circular-crop preview) · toggles: B&W / social backgrounds / favicon / print / **CMYK**.
3. **Generate** — renders everything client-side; CMYK via the API when enabled.
4. **Folder tree panel** — the exact output structure with per-file details.
5. **Preview grid** — every file as a tile, grouped by section; social tiles show the circle-crop mask.
6. **Download all** → `{Client}_Logos.zip`; per-tile single-file download.

## Out of scope (v1)
Auth · LBP integration (later) · client-facing polish pass (internal tool first).

## QA gate
Playwright: upload fixtures → generate → assert tree + zip contents + a CMYK response. Standard protocol.
