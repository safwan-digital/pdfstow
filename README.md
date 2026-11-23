# PDFStow — Free PDF Tools, Private by Design

**Live:** https://pdfstow.com/

*(Formerly AURELIA.)*

PDFStow is a complete PDF toolkit in the spirit of the classic online PDF suites — rebuilt with a clean, modern interface (light + dark mode) and one big difference:

> 🔒 **100% client-side. Your files are never uploaded — everything runs in your browser.** No login, no storage — processing happens entirely on your device. (The honest details — hosting, CDN library loads, the one-time OCR language download — are on the site's Privacy page, `/privacy/`.)

## ✨ 32 working tools

**Organize:** Merge · Split · Remove Pages · Extract Pages · Organize/Reorder · Rotate · Crop
**Optimize:** Compress (3 levels) · Repair · OCR (English, in-browser)
**Convert to PDF:** Images to PDF (JPG/PNG) · HTML to PDF · Word to PDF *(Beta, text-based)* · Text to PDF
**Convert from PDF:** PDF to JPG · PDF to PNG · PDF to Text · PDF to Word *(Beta, text-based)* · PDF to Excel *(Beta)* · PDF to Markdown
**Edit:** Edit (add text) · Annotate · Page Numbers · Watermark · Sign (draw your signature) · Redact
**Security:** Protect (real password encryption) · Unlock (permission-strip + owner-password rebuild) · Metadata Editor
**Compare & AI:** Compare two PDFs (text diff) · Summarize (local extractive summary — no AI server)

No mock tools: every card in the app runs a real operation. Honest limits are labelled on the tool itself (Beta / best-effort where the browser platform has real constraints — see `TEST-REPORT.md`).

## 🧪 Tested with real-world files

Every tool was tested against real files downloaded from public sample sources (Mozilla pdf.js test corpus, W3C, Wikimedia, Picsum, calibre demo, Tesseract sample) — **31/31 passed**. Full per-tool table, sources and known limits: [`TEST-REPORT.md`](TEST-REPORT.md).

**Publish checklist:** do not publish unless `node --check app.js` passes and the headless suites (ui-test 20/20, v3-checks 18/18, qc-v41, qc-v412, qc-v42) are all green on the exact files being pushed.

## 🛠 Tech

| Need | Library (pinned CDN) |
|---|---|
| Create / merge / split / edit / encrypt PDFs | pdf-lib-plus-encrypt 1.1.0 |
| Render pages / extract text | PDF.js 3.11.174 |
| OCR | Tesseract.js 5.0.4 |
| Multi-file downloads | JSZip 3.10.1 |
| Spreadsheets | SheetJS 0.18.5 |
| Word reading | Mammoth 1.6.0 |

No build step. Plain `index.html` + `app.js` + `styles.css` — deployable to any static host.

## 🚀 Run locally

```bash
# any static server, e.g.
python3 -m http.server 8000
# open http://localhost:8000
```

An internet connection is needed on first load for the CDN libraries and the OCR language data.

## 🔐 Privacy

Files are processed in-memory in your browser tab and discarded when you close it. PDFStow has no backend and makes no upload requests with your documents.

## 📄 License

MIT © Safwan Digital
