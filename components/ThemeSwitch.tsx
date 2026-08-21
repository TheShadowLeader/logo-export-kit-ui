"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

/*
  Theme switch — light · dark · system. The Shadow Legacy site's theme mechanics
  (animated-theme-toggler.tsx), extended from two states to three:

  · the CSS reads ONE switch: the `.dark` class on <html>
  · the choice persists as localStorage['tsl-theme'] = light | dark | system;
    the boot script in layout.tsx replays it before first paint, so the
    theme never flashes and this control only has to READ it on mount
  · "system" follows prefers-color-scheme and live-updates when the OS flips
  · the flip runs inside a View Transition revealed by a circle growing out
    of the pressed segment — the site's wipe (864ms, ease-in-out, percentage
    keyframes so Safari's 2x snapshot space doesn't halve the travel).
    Browsers without startViewTransition, reduced-motion users, and picks
    that don't actually change the face (system while the OS already agrees)
    get an instant swap.
*/

export type Mode = "light" | "dark" | "system";

const KEY = "tsl-theme";
const MODES: { mode: Mode; label: string }[] = [
  { mode: "light", label: "Light theme" },
  { mode: "dark", label: "Dark theme" },
  { mode: "system", label: "System theme" },
];

const mq = () => window.matchMedia("(prefers-color-scheme: dark)");
const isDark = (m: Mode) => m === "dark" || (m === "system" && mq().matches);
const readMode = (): Mode => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* private mode — fall through to system */
  }
  return "system";
};

// View Transitions aren't in this TS lib yet
type VTDocument = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

export default function ThemeSwitch() {
  const [mode, setMode] = useState<Mode>("system");

  // the boot script already decided the theme — read it, never guess
  useEffect(() => setMode(readMode()), []);

  // system mode tracks the OS live
  useEffect(() => {
    if (mode !== "system") return;
    const m = mq();
    const follow = () => document.documentElement.classList.toggle("dark", m.matches);
    m.addEventListener("change", follow);
    return () => m.removeEventListener("change", follow);
  }, [mode]);

  const choose = useCallback(async (next: Mode, btn: HTMLButtonElement) => {
    const root = document.documentElement;
    const apply = () =>
      flushSync(() => {
        root.classList.toggle("dark", isDark(next));
        try {
          localStorage.setItem(KEY, next);
        } catch {
          /* private mode — the theme just won't persist */
        }
        setMode(next);
      });

    const doc = document as VTDocument;
    const flips = root.classList.contains("dark") !== isDark(next);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!flips || reduced || !doc.startViewTransition) {
      apply();
      return;
    }

    await doc.startViewTransition(apply).ready;
    const { top, left, width, height } = btn.getBoundingClientRect();
    const x = ((left + width / 2) / window.innerWidth) * 100;
    const y = ((top + height / 2) / window.innerHeight) * 100;
    root.animate(
      { clipPath: [`circle(0% at ${x}% ${y}%)`, `circle(150% at ${x}% ${y}%)`] },
      { duration: 864, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  }, []);

  return (
    <div className="theme" role="group" aria-label="Theme">
      {MODES.map(({ mode: m, label }) => (
        <button
          key={m}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={mode === m}
          onClick={(e) => void choose(m, e.currentTarget)}
          data-testid={`theme-${m}`}
        >
          <Icon mode={m} />
        </button>
      ))}
    </div>
  );
}

/* lucide geometry (sun / moon / monitor), stroke = currentColor so the glyph takes
   the segment's ink: role ink at rest, sunrise on hover, midnight when active */
function Icon({ mode }: { mode: Mode }) {
  const p = {
    width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
  };
  if (mode === "light")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  if (mode === "dark")
    return (
      <svg {...p}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  return (
    <svg {...p}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
