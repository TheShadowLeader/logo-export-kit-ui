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
    <html lang="en" className={jost.variable}>
      <body>{children}</body>
    </html>
  );
}
