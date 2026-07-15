import fitz
import os

doc = fitz.open("attached_assets/Community_Medicine_Past_Questions_2026_Unsolved__1784070676147.pdf")
print(f"Pages: {doc.page_count}")

# Render first 4 pages to see structure
for i in range(min(4, doc.page_count)):
    page = doc[i]
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    out = f".agents/outputs/page_{i+1}.png"
    pix.save(out)
    print(f"Saved {out}")

# Also dump raw text from first 3 pages
for i in range(min(3, doc.page_count)):
    page = doc[i]
    print(f"\n=== PAGE {i+1} TEXT ===")
    print(page.get_text())
