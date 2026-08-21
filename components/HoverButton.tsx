/*
  The site's HoverButton (magicui interactive-hover-button, Vanja r13-10),
  ported to plain CSS (.hb in globals.css): an outlined or filled pill, label
  parked slightly left of centre with a dot in the left padding; on hover the
  dot floods the pill (a transform-only circle — GPU, interruptible), the
  label slides out right and the overlay label + arrow slide in on the fill's
  contrast colour. Tones follow the site's table: `primary` = the nav's filled
  sunrise CTA (floods bone, label stays dark green); `ghost` = the outline
  (light: green ring + green-deep dot + bone overlay · dark: sunrise ring +
  sunrise dot + green-deep overlay). Reduced motion = colour change only.
*/
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  tone?: "primary" | "ghost";
  size?: "md" | "sm";
  href?: string;
  download?: string;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  testid?: string;
  className?: string;
};

export default function HoverButton({ children, tone = "primary", size = "md", href, download, disabled, busy, onClick, testid, className = "" }: Props) {
  const cls = `hb ${tone} ${size}${className ? ` ${className}` : ""}`;
  const inner = (
    <>
      <span className="hb-label">{children}</span>
      <span className="hb-over" aria-hidden>
        {children}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
      <span className="hb-dot" aria-hidden />
    </>
  );
  if (href)
    return (
      <a className={cls} href={href} download={download} data-testid={testid}>
        {inner}
      </a>
    );
  return (
    <button type="button" className={cls} disabled={disabled} aria-busy={busy || undefined} onClick={onClick} data-testid={testid}>
      {inner}
    </button>
  );
}
