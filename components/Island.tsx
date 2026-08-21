"use client";

import { useEffect, useState } from "react";
import HoverButton from "@/components/HoverButton";

/*
  The site's dynamic island (dynamic-island-toc.tsx), repurposed: once a
  package exists and the Generate row has scrolled away, a dark pill rises
  from the bottom with the sunrise dot, the file count + zip name, and the
  Download action — so the download travels with you across the 60-tile grid.
  Appears/retreats with the island's own motion (y 70→0, ease .22,1,.36,1);
  reduced motion fades only.
*/
export default function Island({ files, zipName, zipUrl }: { files: number; zipName: string; zipUrl: string | null }) {
  const [genVisible, setGenVisible] = useState(true);
  useEffect(() => {
    const row = document.querySelector(".genrow");
    if (!row) return;
    const io = new IntersectionObserver(([e]) => setGenVisible(e.isIntersecting), { rootMargin: "-8px 0px" });
    io.observe(row);
    return () => io.disconnect();
  }, []);
  const on = Boolean(zipUrl) && files > 0 && !genVisible;
  return (
    <div className={`island${on ? " on" : ""}`} role="status" aria-hidden={!on} data-testid="island">
      <span className="idot" aria-hidden />
      <span className="itext">
        {files}{" files · "}{zipName}
      </span>
      {zipUrl && (
        <HoverButton tone="primary" size="sm" href={zipUrl} download={zipName} testid="island-download">
          Download
        </HoverButton>
      )}
    </div>
  );
}
