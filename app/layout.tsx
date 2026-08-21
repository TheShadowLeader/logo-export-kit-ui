import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";

// Display face per the Shadow Legacy site ruling (30-07-2026): Jost stands in
// for Futura until the licensed Futura PT files land (then next/font/local).
const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap" });

export const metadata: Metadata = {
  title: "Logo Export Kit — The Shadow Legacy",
  description:
    "Drop the SVG masters. Leave with the whole package — social, web, favicon, print with CMYK — named, organized, client-ready.",
  robots: { index: false },
  icons: { icon: "/brand/mark.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jost.variable} suppressHydrationWarning>
      <head>
        {/*
          Theme boot — runs before first paint so neither theme flashes.
          'tsl-theme' = light | dark | system (unset = system → follows
          prefers-color-scheme). Same one-class switch the Shadow Legacy site
          uses; components/ThemeSwitch.tsx owns it after hydration.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('tsl-theme'),d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
