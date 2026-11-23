/* PDFStow animated demos — a "video player" that is NOT a video: short
   scenes built from page elements, animated with CSS, stepped by this
   script. No media files, no uploads, loads instantly.
   Merge PDF uses hand-built scenes (the approved pilot). Every other tool
   is data-driven: a TOOLS entry + a mid-scene renderer. */
(function () {
  'use strict';

  var GRIP = '<svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/><circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg>';
  var CURSOR = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 7-6.5 1.5L9 18z" fill="#13233c" stroke="#fff" stroke-width="1.6"/></svg>';
  var CHECK = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline class="demo-check-path" points="20 6 9 17 4 12"/></svg>';
  var DL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var UP = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';

  var BADGE_TXT = { PDF: 'PDF', DOC: 'DOC', XLS: 'XLS', MD: 'MD', TXT: 'TXT', HTML: 'HTML', JPG: 'JPG', PNG: 'PNG', ZIP: 'ZIP' };
  function badge(kind) { return '<span class="demo-pdf demo-b-' + kind + '">' + (BADGE_TXT[kind] || kind) + '</span>'; }
  function kindOf(name) {
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'PDF'; if (ext === 'docx' || ext === 'doc') return 'DOC';
    if (ext === 'xlsx' || ext === 'xls') return 'XLS'; if (ext === 'md') return 'MD';
    if (ext === 'txt') return 'TXT'; if (ext === 'html') return 'HTML';
    if (ext === 'jpg' || ext === 'jpeg') return 'JPG'; if (ext === 'png') return 'PNG';
    if (ext === 'zip') return 'ZIP'; return 'PDF';
  }
  function row(name, meta, cls) {
    return '<div class="demo-row ' + (cls || '') + '"><span class="demo-grip">' + GRIP + '</span>' +
      badge(kindOf(name)) + '<span class="demo-rname">' + name + '</span>' +
      '<span class="demo-rpages">' + meta + '</span></div>';
  }
  function lines(widths, extra) {
    return '<div class="demo-page ' + (extra || '') + '">' + widths.map(function (w) {
      return '<span class="demo-line" style="width:' + w + '%"></span>';
    }).join('') + '</div>';
  }
  function thumbs(n, cls, marks) {
    var out = '<div class="demo-thumbs ' + (cls || '') + '">';
    for (var i = 1; i <= n; i++) {
      var m = marks && marks[i] ? ' ' + marks[i] : '';
      out += '<span class="demo-thumb' + m + '"><i></i><i></i><i></i><b>' + i + '</b></span>';
    }
    return out + '</div>';
  }

  /* ================= Merge — the approved pilot, hand-built ================= */
  var MERGE = {
    title: 'Merge PDF — watch how it works',
    dur: [2600, 2600, 3200, 3000],
    captions: [
      'Add your PDFs — as many as you like',
      'Drag to put them in your order',
      'One click — merging happens on your device',
      'One file, ready to download'
    ],
    scenes: [
      '<div class="demo-drop">' + UP + '<p>Drop your PDFs here</p></div>' +
      '<div class="demo-rows">' +
        row('report.pdf', '6 pages', 'd-in1') +
        row('invoice.pdf', '4 pages', 'd-in2') +
        row('notes.pdf', '2 pages', 'd-in3') +
      '</div>',
      '<p class="demo-scene-label">Your files</p><div class="demo-rows demo-rows-swap">' +
        row('report.pdf', '6 pages', 'd-swap-a') +
        row('invoice.pdf', '4 pages', 'd-swap-b') +
        row('notes.pdf', '2 pages', '') +
      '</div><span class="demo-cursor d-cur2">' + CURSOR + '</span>',
      '<div class="demo-rows demo-rows-mini">' +
        row('invoice.pdf', '4 pages', '') +
        row('report.pdf', '6 pages', '') +
        row('notes.pdf', '2 pages', '') +
      '</div>' +
      '<div class="demo-action"><span class="demo-merge-btn">Merge PDF</span><span class="demo-cursor d-cur3">' + CURSOR + '</span><span class="demo-click-ring"></span></div>' +
      '<div class="demo-prog"><span class="demo-prog-fill"></span></div>' +
      '<p class="demo-prog-label"><span class="d-lbl-a">Merging…</span><span class="d-lbl-b">Done</span></p>',
      '<div class="demo-final">' +
        '<span class="demo-check">' + CHECK + '</span>' +
        '<div class="demo-final-file">' + badge('PDF') + '<span class="demo-rname">merged.pdf</span><span class="demo-rpages">12 pages</span></div>' +
        '<span class="demo-dl-btn">' + DL + 'Download</span>' +
      '</div>' +
      '<p class="demo-note">Nothing was uploaded — it all happens on your device.</p>'
    ]
  };

  /* ================= Data for the other 31 tools =================
     files: [name, meta] rows for scene 1 · mid: scene-2 renderer key
     action/verb: scene 3 · out: [name, meta] result cards for scene 4 */
  var T = {
    'split': { name: 'Split PDF', files: [['report.pdf', '12 pages']], mid: 'split', action: 'Split PDF', verb: 'Splitting…',
      out: [['report-1.pdf', 'pages 1–6'], ['report-2.pdf', 'pages 7–12']],
      caps: ['Add the PDF you want to split', 'Choose the ranges — or split every page', 'One click — splitting happens on your device', 'Your split PDFs, ready to download'] },
    'remove-pages': { name: 'Remove Pages', files: [['report.pdf', '12 pages']], mid: 'pages-remove', action: 'Remove pages', verb: 'Removing…',
      out: [['report.pdf', '9 pages']],
      caps: ['Add your PDF', 'Tap the pages you want to remove', 'One click — the rest stays untouched', 'Your shorter PDF, ready to download'] },
    'extract-pages': { name: 'Extract Pages', files: [['report.pdf', '12 pages']], mid: 'pages-select', action: 'Extract pages', verb: 'Extracting…',
      out: [['report-extract.pdf', '3 pages']],
      caps: ['Add your PDF', 'Tap the pages you want to keep', 'One click — they come out as one new PDF', 'Your new PDF, ready to download'] },
    'organize': { name: 'Organize / Reorder', files: [['report.pdf', '12 pages']], mid: 'reorder', action: 'Save new order', verb: 'Saving…',
      out: [['report.pdf', '12 pages']],
      caps: ['Add your PDF', 'Drag pages into the order you want', 'One click — nothing is uploaded', 'Your reordered PDF, ready to download'] },
    'rotate': { name: 'Rotate PDF', files: [['report.pdf', '8 pages']], mid: 'rotate', action: 'Rotate all pages', verb: 'Rotating…',
      out: [['report.pdf', '8 pages']],
      caps: ['Add your PDF', 'Tap to turn any page — or turn them all', 'One click — the pages stay turned', 'Your rotated PDF, ready to download'] },
    'crop': { name: 'Crop PDF', files: [['report.pdf', '8 pages']], mid: 'crop', action: 'Crop PDF', verb: 'Cropping…',
      out: [['report.pdf', '8 pages']],
      caps: ['Add your PDF', 'Drag to select the part to keep', 'The same cut is applied to every page', 'Your cropped PDF, ready to download'] },
    'compress': { name: 'Compress PDF', files: [['report.pdf', '8.4 MB']], mid: 'slider', action: 'Compress PDF', verb: 'Compressing…',
      out: [['report.pdf', '1.9 MB']],
      caps: ['Add your PDF — big is fine', 'Pick how small you need it', 'One click — shrinking happens on your device', 'Same PDF, a quarter of the size'] },
    'repair': { name: 'Repair PDF', files: [['damaged.pdf', 'will not open']], mid: 'repair', action: 'Repair PDF', verb: 'Repairing…',
      out: [['damaged-repaired.pdf', 'opens again']],
      caps: ['Add the PDF that will not open', 'Its structure is rebuilt, cleanly', 'If it is too damaged, we tell you plainly', 'Your repaired PDF, ready to download'] },
    'ocr': { name: 'OCR PDF', files: [['scan.pdf', '5 pages']], mid: 'scan', action: 'OCR PDF', verb: 'Reading text…',
      out: [['scan-searchable.pdf', 'searchable text']],
      caps: ['Add a scanned PDF', 'The text is read page by page — English only', 'One click — reading happens on your device', 'A searchable PDF, plus the plain text'] },
    'scan': { name: 'Scan to PDF', files: [['page1.jpg', 'photo of page 1'], ['page2.jpg', 'photo of page 2']], mid: 'scan', action: 'Make PDF', verb: 'Building\u2026',
      out: [['scan.pdf', '2 pages']],
      caps: ['Take a photo of each paper page', 'Cleaned up — black & white document look', 'One click — it all happens on your device', 'One clean PDF, ready to download'] },
    'images-to-pdf': { name: 'Images to PDF', title: 'JPG to PDF', files: [['photo1.jpg', 'JPG image'], ['photo2.png', 'PNG image']], mid: 'images', action: 'Images to PDF', verb: 'Building…',
      out: [['images.pdf', '2 pages']],
      caps: ['Add your JPG or PNG images', 'Put them in the order you want', 'One click — they become one polished PDF', 'Your PDF, ready to download'] },
    'html-to-pdf': { name: 'HTML to PDF', files: [['page.html', 'HTML file']], mid: 'code', action: 'HTML to PDF', verb: 'Converting…',
      out: [['page.pdf', '1 page']],
      caps: ['Add an .html file', 'Its text is laid out as a clean page', 'One click — conversion happens on your device', 'Your PDF, ready to download'] },
    'word-to-pdf': { name: 'Word to PDF', files: [['letter.docx', 'Word document']], mid: 'convert', target: 'PDF', action: 'Word to PDF', verb: 'Converting…',
      out: [['letter.pdf', '2 pages']],
      caps: ['Add a Word document', 'It is laid out as PDF pages', 'One click — conversion happens on your device', 'Your PDF, ready to download'] },
    'pdf-to-jpg': { name: 'PDF to JPG', files: [['report.pdf', '6 pages']], mid: 'to-images', target: 'JPG', action: 'PDF to JPG', verb: 'Converting…',
      out: [['report-pages.zip', '6 JPG images']],
      caps: ['Add your PDF', 'Every page becomes a JPG image', 'One click — conversion happens on your device', 'Your images, zipped and ready'] },
    'pdf-to-png': { name: 'PDF to PNG', files: [['report.pdf', '6 pages']], mid: 'to-images', target: 'PNG', action: 'PDF to PNG', verb: 'Converting…',
      out: [['report-pages.zip', '6 PNG images']],
      caps: ['Add your PDF', 'Every page becomes a crisp PNG image', 'One click — conversion happens on your device', 'Your images, zipped and ready'] },
    'pdf-to-text': { name: 'PDF to Text', files: [['report.pdf', '8 pages']], mid: 'text-out', action: 'PDF to Text', verb: 'Extracting…',
      out: [['report.txt', 'plain text']],
      caps: ['Add your PDF', 'All readable text is pulled out', 'One click — nothing is uploaded', 'Your .txt file, ready to download'] },
    'pdf-to-word': { name: 'PDF to Word', files: [['report.pdf', '8 pages']], mid: 'convert', target: 'DOC', action: 'PDF to Word', verb: 'Converting…',
      out: [['report.docx', 'editable Word file']],
      caps: ['Add your PDF', 'Its text becomes an editable document', 'One click — conversion happens on your device', 'Your Word file, ready to download'] },
    'pdf-to-excel': { name: 'PDF to Excel', files: [['report.pdf', '8 pages']], mid: 'convert', target: 'XLS', action: 'PDF to Excel', verb: 'Converting…',
      out: [['report.xlsx', 'spreadsheet']],
      caps: ['Add your PDF', 'Tables and text become spreadsheet rows', 'One click — conversion happens on your device', 'Your Excel file, ready to download'] },
    'pdf-to-markdown': { name: 'PDF to Markdown', files: [['report.pdf', '8 pages']], mid: 'convert', target: 'MD', action: 'PDF to Markdown', verb: 'Converting…',
      out: [['report.md', 'Markdown file']],
      caps: ['Add your PDF', 'Its text becomes clean Markdown', 'One click — conversion happens on your device', 'Your .md file, ready to download'] },
    'pdf-editor': { name: 'PDF Editor', files: [['report.pdf', '8 pages']], mid: 'editor', action: 'Save PDF', verb: 'Saving…',
      out: [['report-edited.pdf', 'edited']],
      caps: ['Add your PDF', 'Change words, add text, images or a signature', 'Edits cover the old words — Redact removes them', 'Your edited PDF, ready to download'] },
    'edit-pdf': { name: 'Add Text', files: [['report.pdf', '8 pages']], mid: 'addtext', action: 'Add Text', verb: 'Adding…',
      out: [['report.pdf', 'text added']],
      caps: ['Add your PDF', 'Click the page to place your text', 'Type it, size it, put it anywhere', 'Your PDF, ready to download'] },
    'annotate': { name: 'Annotate PDF', files: [['report.pdf', '8 pages']], mid: 'annotate', action: 'Annotate PDF', verb: 'Saving…',
      out: [['report.pdf', 'note stamped']],
      caps: ['Add your PDF', 'Drag a box over the part to mark', 'Your note is stamped onto the page', 'Your annotated PDF, ready to download'] },
    'page-numbers': { name: 'Add Page Numbers', files: [['report.pdf', '8 pages']], mid: 'posgrid-num', action: 'Add Page Numbers', verb: 'Stamping…',
      out: [['report.pdf', 'numbers on every page']],
      caps: ['Add your PDF', 'Tap a square to choose the position', 'Numbers are stamped on every page', 'Your PDF, ready to download'] },
    'watermark': { name: 'Watermark', files: [['report.pdf', '8 pages']], mid: 'posgrid-wm', action: 'Watermark', verb: 'Stamping…',
      out: [['report.pdf', 'watermarked']],
      caps: ['Add your PDF', 'Type your watermark text', 'It sits softly across every page', 'Your PDF, ready to download'] },
    'sign-pdf': { name: 'Sign PDF', files: [['report.pdf', '8 pages']], mid: 'sign', action: 'Sign PDF', verb: 'Placing…',
      out: [['report-signed.pdf', 'signed']],
      caps: ['Add your PDF', 'Draw, type or upload your signature', 'Drag it anywhere on the page', 'Your signed PDF, ready to download'] },
    'redact': { name: 'Redact PDF', files: [['report.pdf', '8 pages']], mid: 'redact', action: 'Redact PDF', verb: 'Redacting…',
      out: [['report-redacted.pdf', 'text truly removed']],
      caps: ['Add your PDF', 'Drag boxes over anything sensitive', 'Covered pages are flattened — the text is gone', 'Your redacted PDF, ready to download'] },
    'protect': { name: 'Protect PDF', files: [['report.pdf', '8 pages']], mid: 'lock-close', action: 'Protect PDF', verb: 'Encrypting…',
      out: [['report-protected.pdf', 'password locked']],
      caps: ['Add your PDF', 'Choose a password — there is no recovery', 'One click — encryption happens on your device', 'Your locked PDF, ready to download'] },
    'unlock': { name: 'Unlock PDF', files: [['locked.pdf', 'password protected']], mid: 'lock-open', action: 'Unlock PDF', verb: 'Unlocking…',
      out: [['locked-unlocked.pdf', 'no password']],
      caps: ['Add a PDF you own', 'Enter its password once', 'Protection is removed on your device', 'Your unlocked PDF, ready to download'] },
    'metadata': { name: 'Metadata Editor', files: [['report.pdf', '8 pages']], mid: 'metadata', action: 'Save metadata', verb: 'Saving…',
      out: [['report.pdf', 'details updated']],
      caps: ['Add your PDF', 'See the title, author and more stored inside', 'Edit them, then save', 'Your PDF, with details updated'] },
    'compare': { name: 'Compare PDF', files: [['version1.pdf', 'first PDF'], ['version2.pdf', 'second PDF']], mid: 'compare', action: 'Compare PDF', verb: 'Comparing…',
      out: [['differences.txt', 'difference report']],
      caps: ['Add two PDFs', 'Their text is compared line by line', 'One click — comparison happens on your device', 'A report of exactly what changed'] },
    'summarize': { name: 'Summarize PDF', files: [['report.pdf', '8 pages']], mid: 'summarize', action: 'Summarize PDF', verb: 'Summarizing…',
      out: [['report-summary.txt', 'key sentences']],
      caps: ['Add your PDF', 'Key sentences are picked from the document itself', 'Nothing is uploaded — the summary is local', 'Your summary, ready to read'] }
  };

  /* ================= Scene builders ================= */
  function spans(widths, cls) {
    return widths.map(function (w, i) {
      return '<span class="demo-line ' + ((cls && cls[i]) || '') + '" style="width:' + w + '%"></span>';
    }).join('');
  }
  function pageMock(inner) { return '<div class="demo-pwrap"><div class="demo-page">' + inner + '</div></div>'; }

  var MID = {
    'split': function () {
      return '<p class="demo-scene-label">Two parts</p>' +
        thumbs(6, '', { 1: 'grp-a', 2: 'grp-a', 3: 'grp-a', 4: 'grp-b', 5: 'grp-b', 6: 'grp-b' }) +
        '<div class="demo-legend"><span class="demo-chip demo-chip-a">Part 1 · pages 1–6</span><span class="demo-chip demo-chip-b">Part 2 · pages 7–12</span></div>';
    },
    'pages-select': function () {
      return '<p class="demo-scene-label">Tap pages to choose them</p>' +
        thumbs(6, '', { 2: 'sel d-pop2', 4: 'sel d-pop4', 5: 'sel d-pop5' });
    },
    'pages-remove': function () {
      return '<p class="demo-scene-label">Tap pages to remove them</p>' +
        thumbs(6, '', { 3: 'del d-pop3', 5: 'del d-pop5' });
    },
    'reorder': function () {
      return '<p class="demo-scene-label">Drag pages into place</p>' +
        '<div class="demo-thumbs demo-thumbs-swap">' +
        '<span class="demo-thumb d-pswap-a"><i></i><i></i><i></i><b>1</b></span>' +
        '<span class="demo-thumb d-pswap-b"><i></i><i></i><i></i><b>2</b></span>' +
        '<span class="demo-thumb"><i></i><i></i><i></i><b>3</b></span></div>' +
        '<span class="demo-cursor d-cur2">' + CURSOR + '</span>';
    },
    'rotate': function () {
      return '<p class="demo-scene-label">One tap turns the page</p>' +
        '<div class="demo-pwrap"><div class="demo-page demo-page-rot">' + spans([88, 72, 80, 55]) +
        '<span class="demo-rot-badge"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></span></div></div>';
    },
    'crop': function () {
      return '<p class="demo-scene-label">Drag to select what stays</p>' +
        pageMock(spans([92, 78, 85, 60, 70]) + '<span class="demo-cropbox"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></span>');
    },
    'slider': function () {
      return '<p class="demo-scene-label">Choose the size</p>' +
        '<div class="demo-size"><span class="d-size-a">8.4 MB</span><span class="d-size-b">1.9 MB</span></div>' +
        '<div class="demo-slider"><span class="demo-slider-fill"></span><span class="demo-knob"></span></div>' +
        '<div class="demo-slider-lbls"><span>Clearer</span><span>Smaller</span></div>';
    },
    'repair': function () {
      return '<p class="demo-scene-label">Rebuilding the file</p>' +
        '<div class="demo-pwrap"><div class="demo-page demo-page-fix">' + spans([88, 70, 82, 58]) +
        '<span class="demo-fix-a"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>' +
        '<span class="demo-fix-b"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div></div>';
    },
    'scan': function () {
      return '<p class="demo-scene-label">Reading the page</p>' +
        pageMock('<span class="demo-scanline"></span>' + spans([90, 76, 84, 62, 70]));
    },
    'images': function () {
      var img = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      return '<p class="demo-scene-label">Your images, in order</p>' +
        '<div class="demo-imgrow"><span class="demo-imgcard d-in1">' + img + '<b>photo1.jpg</b></span>' +
        '<span class="demo-imgcard d-in2">' + img + '<b>photo2.png</b></span>' +
        '<span class="demo-imgarrow"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>' +
        '<span class="demo-imgpdf d-in3">' + badge('PDF') + '</span></div>';
    },
    'code': function () {
      return '<p class="demo-scene-label">From web page to PDF</p>' +
        '<div class="demo-code"><span>&lt;h1&gt;My page&lt;/h1&gt;</span><span>&lt;p&gt;Hello, world.&lt;/p&gt;</span><span>&lt;p&gt;Made with HTML&lt;/p&gt;</span></div>' +
        '<div class="demo-arrow-c"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></div>' +
        pageMock(spans([70, 88, 64]));
    },
    'convert': function (d) {
      return '<p class="demo-scene-label">One format becomes another</p>' +
        '<div class="demo-rows">' + row(d.files[0][0], d.files[0][1], '') + '</div>' +
        '<div class="demo-arrow-c"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></div>' +
        '<div class="demo-bigbadge">' + badge(d.target) + '<span>' + d.out[0][0] + '</span></div>';
    },
    'to-images': function (d) {
      return '<p class="demo-scene-label">Every page, as an image</p>' +
        '<div class="demo-fan"><span class="demo-fancard d-fan1">' + badge(d.target) + '<b>page 1</b></span>' +
        '<span class="demo-fancard d-fan2">' + badge(d.target) + '<b>page 2</b></span>' +
        '<span class="demo-fancard d-fan3">' + badge(d.target) + '<b>page 3</b></span></div>';
    },
    'text-out': function () {
      return '<p class="demo-scene-label">Words come out as plain text</p>' +
        pageMock(spans([90, 76, 84, 60])) +
        '<div class="demo-arrow-c"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></div>' +
        '<div class="demo-txtcard">' + badge('TXT') + spans([88, 70, 78]) + '</div>';
    },
    'editor': function () {
      return '<p class="demo-scene-label">Fix a word in place</p>' +
        pageMock('<p class="demo-words">The meeting is on<br><span class="demo-oldwrap"><span class="demo-old">Monday</span><span class="demo-cover"></span></span> <span class="demo-newword">Friday</span></p>' + spans([84, 66]));
    },
    'addtext': function () {
      return '<p class="demo-scene-label">Click the page, type your text</p>' +
        pageMock(spans([88, 72, 80]) + '<span class="demo-textbox">CONFIDENTIAL</span>') +
        '<span class="demo-cursor d-cur-tb">' + CURSOR + '</span>';
    },
    'annotate': function () {
      return '<p class="demo-scene-label">Mark the part that matters</p>' +
        pageMock(spans([90, 76, 84, 60]) + '<span class="demo-hlbox"></span><span class="demo-noteflag"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Check this</span>');
    },
    'posgrid-num': function () {
      var cells = '';
      for (var i = 0; i < 9; i++) cells += '<span class="demo-pos' + (i === 7 ? ' on' : '') + '"></span>';
      return '<div class="demo-posrow"><div><p class="demo-scene-label">Pick the position</p><div class="demo-posgrid">' + cells + '</div></div>' +
        '<div class="demo-pwrap"><div class="demo-page demo-page-sm">' + spans([88, 70, 78]) + '<span class="demo-pagenum">1</span></div></div></div>';
    },
    'posgrid-wm': function () {
      return '<p class="demo-scene-label">Softly, on every page</p>' +
        pageMock(spans([88, 72, 80, 58]) + '<span class="demo-wmtext">CONFIDENTIAL</span>');
    },
    'sign': function () {
      return '<p class="demo-scene-label">Sign on the line</p>' +
        '<div class="demo-sigwrap"><svg class="demo-sig" viewBox="0 0 120 44" width="240" height="88"><path class="demo-sig-path" d="M8 32 C 20 6, 30 40, 44 18 C 54 4, 62 34, 76 20 C 88 8, 98 26, 112 14" fill="none" stroke="#1a365d" stroke-width="2.6" stroke-linecap="round"/><path class="demo-sig-path d-sig2" d="M10 39 C 40 35, 80 35, 110 37" fill="none" stroke="#c5a059" stroke-width="2" stroke-linecap="round"/></svg><span class="demo-sigline"></span></div>';
    },
    'redact': function () {
      return '<p class="demo-scene-label">Cover what must not be seen</p>' +
        pageMock(spans([90, 76, 84, 62]) + '<span class="demo-redact r1"></span><span class="demo-redact r2"></span>');
    },
    'lock-close': function () { return lockScene(false); },
    'lock-open': function () { return lockScene(true); },
    'metadata': function () {
      function f(lbl, val, cls) {
        return '<div class="demo-meta-row ' + cls + '"><span>' + lbl + '</span><b>' + val + '</b></div>';
      }
      return '<p class="demo-scene-label">Details stored inside the file</p>' +
        f('Title', 'Annual Report 2026', 'd-in1') + f('Author', 'Accounts Team', 'd-in2') + f('Keywords', 'finance · report', 'd-in3');
    },
    'compare': function () {
      return '<p class="demo-scene-label">Spot what changed</p>' +
        '<div class="demo-cmp"><div class="demo-page demo-page-sm">' + spans([88, 70, 80], { 1: 'diff-a' }) + '</div>' +
        '<div class="demo-page demo-page-sm">' + spans([88, 70, 80], { 1: 'diff-b' }) + '</div></div>' +
        '<div class="demo-legend"><span class="demo-chip demo-chip-del">Old line</span><span class="demo-chip demo-chip-add">New line</span></div>';
    },
    'summarize': function () {
      return '<p class="demo-scene-label">The key sentences stand out</p>' +
        pageMock(spans([90, 74, 84, 66, 78], { 0: 'key', 2: 'key', 1: 'fade', 3: 'fade', 4: 'fade' }));
    }
  };

  function lockScene(opening) {
    var lock = function (cls, shackle) {
      return '<span class="demo-lock ' + cls + '"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="10" rx="2"/>' + shackle + '</svg></span>';
    };
    var open = lock('lk-open', '<path d="M8 10V7a4 4 0 0 1 7.7-1.6"/>');
    var shut = lock('lk-shut', '<path d="M8 10V7a4 4 0 0 1 8 0v3"/>');
    return '<p class="demo-scene-label">' + (opening ? 'Unlock with the password' : 'Set the password') + '</p>' +
      '<div class="demo-pwrow"><div class="demo-pw"><span>Password</span><b class="demo-dots-pw">••••••••</b></div>' +
      '<span class="demo-lockwrap ' + (opening ? 'to-open' : 'to-shut') + '">' + open + shut + '</span></div>';
  }

  function s1(d) {
    return '<div class="demo-drop">' + UP + '<p>Drop your ' + (d.files.length > 1 ? 'files' : 'file') + ' here</p></div>' +
      '<div class="demo-rows">' + d.files.map(function (f, i) { return row(f[0], f[1], 'd-in' + (i + 1)); }).join('') + '</div>';
  }
  function s3(d) {
    return '<div class="demo-rows demo-rows-mini">' + d.files.map(function (f) { return row(f[0], f[1], ''); }).join('') + '</div>' +
      '<div class="demo-action"><span class="demo-merge-btn">' + d.action + '</span><span class="demo-cursor d-cur3">' + CURSOR + '</span><span class="demo-click-ring"></span></div>' +
      '<div class="demo-prog"><span class="demo-prog-fill"></span></div>' +
      '<p class="demo-prog-label"><span class="d-lbl-a">' + d.verb + '</span><span class="d-lbl-b">Done</span></p>';
  }
  function s4(d) {
    return '<div class="demo-final"><span class="demo-check">' + CHECK + '</span>' +
      d.out.map(function (f) {
        return '<div class="demo-final-file">' + badge(kindOf(f[0])) + '<span class="demo-rname">' + f[0] + '</span><span class="demo-rpages">' + f[1] + '</span></div>';
      }).join('') +
      '<span class="demo-dl-btn">' + DL + 'Download</span></div>' +
      '<p class="demo-note">Nothing was uploaded — it all happens on your device.</p>';
  }

  function getDemo(id) {
    if (id === 'merge') return MERGE;
    var d = T[id];
    if (!d) return null;
    return {
      title: (d.title || d.name) + ' — watch how it works',
      dur: [2600, 2800, 3200, 3000],
      captions: d.caps,
      scenes: [s1(d), MID[d.mid](d), s3(d), s4(d)]
    };
  }

  var SLUG_TO_ID = {
    'merge-pdf': 'merge', 'split-pdf': 'split', 'remove-pages': 'remove-pages',
    'extract-pages': 'extract-pages', 'organize-pdf': 'organize', 'rotate-pdf': 'rotate',
    'crop-pdf': 'crop', 'compress-pdf': 'compress', 'repair-pdf': 'repair', 'ocr-pdf': 'ocr',
    'scan-pdf': 'scan', 'jpg-to-pdf': 'images-to-pdf', 'html-to-pdf': 'html-to-pdf', 'word-to-pdf': 'word-to-pdf',
    'pdf-to-jpg': 'pdf-to-jpg', 'pdf-to-png': 'pdf-to-png', 'pdf-to-text': 'pdf-to-text',
    'pdf-to-word': 'pdf-to-word', 'pdf-to-excel': 'pdf-to-excel', 'pdf-to-markdown': 'pdf-to-markdown',
    'pdf-editor': 'pdf-editor', 'edit-pdf': 'edit-pdf', 'annotate-pdf': 'annotate',
    'page-numbers': 'page-numbers', 'watermark-pdf': 'watermark', 'sign-pdf': 'sign-pdf',
    'redact-pdf': 'redact', 'protect-pdf': 'protect', 'unlock-pdf': 'unlock',
    'pdf-metadata': 'metadata', 'compare-pdf': 'compare', 'summarize-pdf': 'summarize'
  };

  function currentToolId() {
    if (document.body && document.body.dataset && document.body.dataset.tool) return document.body.dataset.tool;
    var seg = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    return SLUG_TO_ID[seg] || null;
  }

  /* ---------- Watch-demo button ---------- */
  function ensureButton() {
    var id = currentToolId();
    var existing = document.getElementById('demoWatchBtn');
    if (!id || !getDemo(id)) { if (existing) existing.remove(); return; }
    if (existing) return;
    /* Standalone tool pages have a page H1 above the tool — the button
       belongs beside that heading. In the homepage app there is no tool
       H1, so it sits beside the panel title instead. */
    var anchor = null;
    if (document.body && document.body.dataset && document.body.dataset.tool) {
      anchor = document.querySelector('h1');
    }
    if (!anchor) anchor = document.getElementById('toolTitle');
    if (!anchor || !anchor.parentNode) return;
    var row = anchor.parentNode;
    if (!row.classList || !row.classList.contains('demo-title-row')) {
      row = document.createElement('div');
      row.className = 'demo-title-row';
      anchor.parentNode.insertBefore(row, anchor);
      row.appendChild(anchor);
    }
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'demo-watch-btn';
    b.id = 'demoWatchBtn';
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg> See how it works';
    b.addEventListener('click', function () { openDemo(id); });
    row.appendChild(b);
  }

  /* ---------- Player ---------- */
  var overlay = null, els = {}, timer = null, idx = 0, activeDemo = null, lastFocus = null;

  function buildPlayer() {
    overlay = document.createElement('div');
    overlay.className = 'demo-overlay hidden';
    overlay.id = 'demoOverlay';
    overlay.innerHTML =
      '<div class="demo-window" role="dialog" aria-modal="true" aria-labelledby="demoTitle">' +
        '<div class="demo-head">' +
          '<span class="demo-dots"><i></i><i></i><i></i></span>' +
          '<span class="demo-title" id="demoTitle"></span>' +
          '<button type="button" class="demo-close" id="demoClose" aria-label="Close demo"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>' +
        '<div class="demo-screen">' +
          '<span class="demo-tag"><i></i>DEMO</span>' +
          '<span class="demo-wm">PDFStow</span>' +
          '<div class="demo-scenes" id="demoScenes"></div>' +
        '</div>' +
        '<div class="demo-foot">' +
          '<div class="demo-segs" id="demoSegs"></div>' +
          '<p class="demo-caption" id="demoCaption"></p>' +
          '<button type="button" class="demo-replay hidden" id="demoReplay"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Replay</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    els.title = overlay.querySelector('#demoTitle');
    els.scenes = overlay.querySelector('#demoScenes');
    els.segs = overlay.querySelector('#demoSegs');
    els.caption = overlay.querySelector('#demoCaption');
    els.replay = overlay.querySelector('#demoReplay');
    overlay.querySelector('#demoClose').addEventListener('click', closeDemo);
    els.replay.addEventListener('click', function () { play(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDemo(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) closeDemo();
    });
  }

  function stopTimers() { if (timer) { clearTimeout(timer); timer = null; } }

  function setScene(i) {
    idx = i;
    var kids = els.scenes.children;
    for (var k = 0; k < kids.length; k++) kids[k].classList.toggle('active', k === i);
    els.caption.textContent = activeDemo.captions[i];
    var segs = els.segs.children;
    for (var s = 0; s < segs.length; s++) {
      var fill = segs[s].firstChild;
      fill.style.transition = 'none';
      fill.style.width = s < i ? '100%' : '0%';
    }
    var cur = segs[i].firstChild;
    void cur.offsetWidth;
    cur.style.transition = 'width ' + activeDemo.dur[i] + 'ms linear';
    cur.style.width = '100%';
    timer = setTimeout(function () {
      if (i + 1 < activeDemo.scenes.length) { setScene(i + 1); }
      else { els.replay.classList.remove('hidden'); }
    }, activeDemo.dur[i]);
  }

  function play() {
    stopTimers();
    els.replay.classList.add('hidden');
    els.scenes.innerHTML = activeDemo.scenes.map(function (h) { return '<div class="dscene">' + h + '</div>'; }).join('');
    els.segs.innerHTML = activeDemo.scenes.map(function () { return '<span class="demo-seg"><i></i></span>'; }).join('');
    setScene(0);
  }

  function openDemo(id) {
    activeDemo = getDemo(id);
    if (!activeDemo) return;
    if (!overlay) buildPlayer();
    els.title.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" fill="#c5a059"/></svg> ' + activeDemo.title;
    lastFocus = document.activeElement;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    play();
    var c = overlay.querySelector('#demoClose');
    if (c) c.focus();
  }

  function closeDemo() {
    stopTimers();
    if (!overlay) return;
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- Wiring ---------- */
  function init() {
    ensureButton();
    var title = document.getElementById('toolTitle');
    if (title && 'MutationObserver' in window) {
      new MutationObserver(function () { ensureButton(); }).observe(title, { childList: true, characterData: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
