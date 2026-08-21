import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logo Export Kit — The Shadow Legacy",
  description:
    "Drop SVG logos, set brand colors, get the complete client-ready package: social profiles, web, favicon, print with CMYK.",
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
