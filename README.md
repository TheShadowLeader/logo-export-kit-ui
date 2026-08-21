# Logo Export Kit — UI

**Live:** https://logoexport.theshadowlegacy.com (alias https://logo-export-kit-ui.vercel.app) · internal Shadow Legacy tool

Drop 1–7 SVG logo masters → set client name, brand colors, safe zone → get the
complete client-ready package: social profiles (brand-color backgrounds,
circle-safe), web sizes, favicon set (`.ico` included), print masters with
**CMYK TIFF + JPEG**, all named and organized — downloaded as one zip.

## One engine, two front-ends

This UI is the web face of the `logo-export-kit` skill
(`ShadowOS/SHADOW-LAB/logo-export-kit/`). Detection, recolor rules, folder
structure, file naming, and sizes are ported 1:1 from
`scripts/process_logos.py`; `lib/dimensions.json` is vendored from the kit's
`references/dimensions.json` (re-copy when sizes change — that file is the
shared contract).

- **Rendering: in the browser.** The kit's own fallback renderer is headless
  Chrome, so the visitor's browser is the same engine class — canvas output
  matches the CLI, previews are instant, and the server does nothing.
- **CMYK: the one server piece** — `api/cmyk.py` (Vercel Python, Pillow-only)
  converts the browser-rendered 300dpi print PNGs. Hosted conversion is
  profile-less (fine for flat logo color; print shops re-profile anyway); the
  CLI applies ICC locally via macOS's Generic CMYK profile.

## Develop

```
npm install
npm run dev        # localhost:4490 (api/cmyk.py needs `vercel dev` or prod)
npm run build && npm start
node qa/run-qa.mjs                    # QA gate, local (CMYK toggle off)
BASE=<url> CMYK=1 node qa/run-qa.mjs  # QA gate against a deployment
```

Deploy: `vercel deploy --prod` (project `logo-export-kit-ui`, team
the-shadow-leaders-projects).
