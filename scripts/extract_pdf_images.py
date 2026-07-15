"""
Server-side PDF text + image extractor using PyMuPDF.
Usage: python3 scripts/extract_pdf_images.py <pdf_path>
Output: JSON { text: string, images: [{ id, dataUri }] }
"""
import sys
import json
import base64
import fitz  # PyMuPDF

MIN_IMAGE_PX = 50  # ignore images smaller than this in either dimension

def extract(pdf_path: str) -> dict:
    doc = fitz.open(pdf_path)
    result_images: list[dict] = []
    image_counter = 0
    pages_text: list[str] = []

    for page_num in range(doc.page_count):
        page = doc[page_num]

        # ── Collect text blocks with Y positions ─────────────────────────────
        raw_blocks = page.get_text("blocks")
        # (x0, y0, x1, y1, text, block_no, block_type)  block_type 0=text 1=image
        text_items: list[tuple[float, str]] = []
        for b in raw_blocks:
            if b[6] == 0 and b[4].strip():
                text_items.append((float(b[1]), b[4].rstrip()))

        # ── Collect embedded images with Y positions ──────────────────────────
        img_items: list[tuple[float, str]] = []  # (y, img_id)
        for img_info in page.get_images(full=True):
            xref = img_info[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                # Skip tiny decorative images
                if pix.width < MIN_IMAGE_PX or pix.height < MIN_IMAGE_PX:
                    continue
                # Convert CMYK / alpha-only to RGB
                if pix.n > 4 or (pix.n == 4 and pix.alpha):
                    pix = fitz.Pixmap(fitz.csRGB, pix)

                image_counter += 1
                img_id = f"IMAGE_{image_counter}"

                img_bytes = pix.tobytes("png")
                b64 = base64.b64encode(img_bytes).decode("ascii")
                data_uri = f"data:image/png;base64,{b64}"
                result_images.append({"id": img_id, "dataUri": data_uri})

                # Find the Y position of this image on the page
                rects = page.get_image_rects(xref)
                img_y = float(rects[0].y0) if rects else page.rect.height / 2
                img_items.append((img_y, img_id))

            except Exception:
                # Silently skip any unreadable image
                if img_items and img_items[-1][1] == f"IMAGE_{image_counter}":
                    image_counter -= 1
                continue

        # ── Interleave text blocks and image markers by Y position ────────────
        combined: list[tuple[float, str, str]] = (
            [(y, "TEXT", t) for y, t in text_items] +
            [(y, "IMG",  id_) for y, id_ in img_items]
        )
        combined.sort(key=lambda x: x[0])

        page_lines: list[str] = []
        for _, kind, content in combined:
            if kind == "TEXT":
                page_lines.append(content)
            else:
                page_lines.append(f"[{content}]")

        pages_text.append("\n".join(page_lines))

    return {
        "text": "\n\n--- Page Break ---\n\n".join(pages_text),
        "images": result_images,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "pdf_path argument required"}))
        sys.exit(1)
    try:
        output = extract(sys.argv[1])
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
