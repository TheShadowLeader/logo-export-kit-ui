"""Vercel Python function: RGB print PNG -> CMYK TIFF/JPEG (Pillow-only).

The one server-side piece of the UI — everything else renders in the browser.
Hosted conversion is profile-less (Pillow naive convert; flat logo color
survives it, and print shops re-profile against their stock anyway). The CLI
skill applies ICC locally where macOS's Generic CMYK profile exists.
"""
import io
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from PIL import Image

MAX_BODY = 4 * 1024 * 1024  # Vercel request-body ceiling safety


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", 0))
            if not 0 < length <= MAX_BODY:
                self.send_error(413, "PNG too large (4MB max)")
                return
            fmt = parse_qs(urlparse(self.path).query).get("fmt", ["tif"])[0]
            raw = self.rfile.read(length)

            im = Image.open(io.BytesIO(raw)).convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[3])
            cm = bg.convert("CMYK")

            out = io.BytesIO()
            if fmt == "jpg":
                cm.save(out, "JPEG", quality=95, dpi=(300, 300))
                ctype = "image/jpeg"
            else:
                cm.save(out, "TIFF", compression="tiff_lzw", dpi=(300, 300))
                ctype = "image/tiff"
            body = out.getvalue()

            self.send_response(200)
            self.send_header("content-type", ctype)
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:  # noqa: BLE001 — surface as 500 with message
            self.send_error(500, f"CMYK conversion failed: {e}")
