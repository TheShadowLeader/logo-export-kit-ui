# Reel research — the "logo package tool" reference (Phase C step 1)

**Date:** 21-08-2026 · **Source:** instagram.com/reel/Db2uvCSTr8z (creator: **iggykos**, verified; built with **base44.app**) · 4.2K likes / 5K comments / 83 shares

## What the tool is (from the creator's own caption — full functional description)

> Preparing final logo files for a client is one of the most boring parts of brand design.
> Different logo versions — primary, wordmark, monogram, symbol.
> Different formats — PNG, JPG, SVG. RGB, CMYK. Different colors. Different sizes.
> You can easily spend hours just exporting, naming and organizing everything.
> So I decided to build my own tool with @base44.app that does it for me.
> **Upload the black SVG logo files, set the brand colors — and it automatically generates the entire client-ready package.**
> Follow me, Like and Comment LOGO to get the link to this tool in your DMs.

## Extracted facts

- **Flow: upload black SVGs → set brand colors → generate → download package.** Two inputs, one button. That's the whole UI story.
- **Input convention: black SVGs** (single-color masters), recolored by the tool from the brand palette — vs. our pipeline which takes as-designed SVGs and auto-generates B&W from them. Same capability, opposite direction; ours also auto-detects positive/negative pairs, which theirs doesn't mention.
- **Logo versions named:** primary, wordmark, monogram, symbol — maps 1:1 to our mark / horizontal / stacked / type orientations.
- **Outputs named:** PNG / JPG / SVG · RGB / CMYK · multiple colors · multiple sizes · named + organized. Our pipeline covers all of this except an explicit **CMYK** story (flag for spec) and adds social-profile sizes with auto-extracted brand-color backgrounds, favicon set, and print files.
- **Distribution:** the tool itself is DM-gated lead-gen (comment "LOGO"), hosted on base44 — it's a marketing asset as much as a utility. Ours is an internal Shadow Lab tool first (per approved assumption 3).

## Video / visuals note

Instagram refuses to attach media to the `<video>` elements under browser automation (all four player elements stay `readyState 0`; screenshots capture the poster only), so frame-by-frame UI capture wasn't possible in this session. The embed poster (first frame) shows the creator's screen with a Figma-style dark editor and the reel's title card — style reference only. **The caption fully specifies the functional flow, which is what the spec needs.** If pixel-level reference of their UI is wanted, the reel is 30–40s: `https://www.instagram.com/reel/Db2uvCSTr8z/` (log-in required).

## What our pipeline already does that theirs doesn't claim

Auto B&W from colored masters · positive/negative pair detection with subfolder structure · social-profile backgrounds auto-filled from extracted brand colors · favicon set · print set · client-folder naming conventions. **The gap is purely the front-end:** drop-zone + color pickers + preview grid + zip download, wrapping `scripts/process_logos.py` unchanged.
