/* PDFStow v4.7.4 page generator.
   Builds the 32 per-tool pages, the 4 trust pages, the trust.html stub,
   sitemap.xml and llms.txt from index.html's own chrome (head / sprite /
   header / toolView / footer) + build/tools-data.js copy.
   Run: node build/generate.js   (idempotent) */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TOOLS = require('./tools-data.js');
const BASE = 'https://pdfstow.com';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escA = s => esc(s).replace(/"/g, '&quot;');
const ldjson = obj => JSON.stringify(obj).replace(/<\//g, '<\\/');

/* ---- slice index.html into reusable chrome ----
   Anchored on content, NOT line numbers (v4.7.10): the old fixed-line
   slices silently truncated the head mid-comment after v4.7.5 added
   head lines, shipping duplicate <body> tags and visible comment text
   on every generated page. Anchors + hard throws prevent a repeat:
   if index.html's structure changes, generation stops loudly. */
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n');
const findA = (pred, what) => { const i = idx.findIndex(pred); if (i < 0) throw new Error('generate: anchor not found: ' + what); return i; };
const headEnd = findA(l => l.trim() === '</head>', 'head end');
const bodyIdx = findA(l => l.startsWith('<body>'), 'body');
const headerStart = findA(l => l.startsWith('<header'), 'header start');
const headerEnd = findA(l => l.trim() === '</header>', 'header end');
const toolViewStart = findA(l => l.includes('id="toolView"'), 'toolView');
const footerStart = findA(l => l.startsWith('<footer>'), 'footer start');
const footerEnd = findA(l => l.trim() === '</footer>', 'footer end');
const headTpl = idx.slice(0, headEnd + 1).join('\n');            // doctype .. </head>
const sprite = idx.slice(bodyIdx + 1, headerStart).join('\n');  // svg sprite block
const header = idx.slice(headerStart, headerEnd + 1).join('\n');
const toolView = idx.slice(toolViewStart, footerStart - 1).join('\n'); // toolView .. </section> (before </main>)
const footer = idx.slice(footerStart, footerEnd + 1).join('\n');
const toast = idx[footerEnd + 1];

function subHead(html, { title, desc, url, bodyAttr, jsonld }) {
  let h = html;
  h = h.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escA(desc)}">`);
  h = h.replace('<link rel="canonical" href="https://pdfstow.com/">', `<link rel="canonical" href="${url}">`);
  h = h.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escA(title)}">`);
  h = h.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escA(desc)}">`);
  h = h.replace('<meta property="og:url" content="https://pdfstow.com/">', `<meta property="og:url" content="${url}">`);
  h = h.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escA(title)}">`);
  h = h.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escA(desc)}">`);
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  if (jsonld) h = h.replace('<!-- The manifest link', `<script type="application/ld+json">\n${jsonld}\n</script>\n<!-- The manifest link`);
  h = h.replace('href="styles.css?v=70"', 'href="/styles.css?v=70"');
  h = h.replace('href="favicon.ico"', 'href="/favicon.ico"');
  h = h.replace('href="favicon-32.png"', 'href="/favicon-32.png"');
  h = h.replace('href="apple-touch-icon.png"', 'href="/apple-touch-icon.png"');
  h = h.replace("ml.href='manifest.json'", "ml.href='/manifest.json'");
  return h;
}
const subHeader = header
  .replace('src="logo-icon-sm.webp"', 'src="/logo-icon-sm.webp"')
  .replace('<a href="#tools">Tools</a>', '<a href="/#tools">Tools</a>');

/* ---- tool pages ---- */
/* Lucide icon per tool (mirrors app.js TOOLS) for the tool-page H1 chip. */
const ICONS = { 'scan': 'scan', 'merge': 'combine', 'split': 'scissors', 'remove-pages': 'file-x-2', 'extract-pages': 'file-output', 'organize': 'layers', 'rotate': 'rotate-cw', 'crop': 'crop', 'compress': 'minimize-2', 'repair': 'wrench', 'ocr': 'scan-text', 'images-to-pdf': 'images', 'html-to-pdf': 'globe', 'word-to-pdf': 'file-type-2', 'pdf-to-jpg': 'image', 'pdf-to-png': 'image-down', 'pdf-to-text': 'align-left', 'pdf-to-word': 'file-text', 'pdf-to-excel': 'table-2', 'pdf-to-markdown': 'file-code-2', 'pdf-editor': 'pencil', 'edit-pdf': 'pen-line', 'annotate': 'sticky-note', 'page-numbers': 'hash', 'watermark': 'stamp', 'sign-pdf': 'signature', 'redact': 'eye-off', 'protect': 'lock', 'unlock': 'lock-open', 'metadata': 'tags', 'compare': 'git-compare-arrows', 'summarize': 'sparkles' };
const bySlug = Object.fromEntries(TOOLS.map(t => [t.slug, t]));
const nameOf = slug => bySlug[slug].h1;
let made = 0;
for (const t of TOOLS) {
  const url = `${BASE}/${t.slug}/`;
  const jsonld = ldjson([
    { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: `${t.h1} — PDFStow`, url, applicationCategory: 'BusinessApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description: t.desc, publisher: { '@type': 'Organization', name: 'Safwan.Digital', url: 'https://safwan.digital', logo: `${BASE}/icon-512.png` } },
    { '@context': 'https://schema.org', '@type': 'HowTo', name: t.howName, step: t.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' }, { '@type': 'ListItem', position: 2, name: t.h1, item: url }] }
  ]);
  const head = subHead(headTpl, { title: t.title, desc: t.desc, url, bodyAttr: `data-tool="${t.id}"`, jsonld });
  const steps = t.steps.map(s => `      <li>${esc(s)}</li>`).join('\n');
  const know = t.know.map(s => `      <li>${esc(s)}</li>`).join('\n');
  const faqs = t.faqs.map(f => `    <div class="faqitem"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('\n');
  const mid = (t.mid || []).map(s => `  <section class="seo glass">\n    <h2>${esc(s.h)}</h2>\n${s.ps.map(p => `    <p>${esc(p)}</p>`).join('\n')}\n  </section>`).join('\n');
  const rel = t.related.map(s => `<a href="/${s}/">${esc(nameOf(s))}</a>`).join('');
  const main = `<main class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span class="sep" aria-hidden="true">/</span> <span>${esc(t.h1)}</span></nav>
  <div class="toolpage-head">
    <h1><span class="title-ic"><svg class="ic" width="22" height="22" aria-hidden="true"><use href="#i-${ICONS[t.id] || 'file-text'}"/></svg></span>${esc(t.h1)}</h1>
    <p class="answer">${esc(t.answer)}</p>
  </div>
${toolView.replace('<section id="toolView" class="hidden">', '<section id="toolView" class="pagetool">')}
  <section id="homeView" class="hidden" aria-hidden="true">
    <input id="searchInput" type="search" class="hidden" tabindex="-1">
    <p id="searchMeta" class="hidden"></p>
    <div id="tools"></div>
  </section>
${mid ? mid + '\n' : ''}  <section class="seo glass">
    <h2>${esc(t.howName)}</h2>
    <ol>
${steps}
    </ol>
  </section>
  <section class="seo glass">
    <h2>Good to know</h2>
    <ul>
${know}
    </ul>
  </section>
  <section class="seo glass">
    <h2>Questions</h2>
${faqs}
  </section>
  <section class="seo glass">
    <h2>Related tools</h2>
    <div class="relrow">${rel}</div>
  </section>
</main>`;
  const page = [head, `<body data-tool="${t.id}">`, sprite, subHeader, main, footer, toast, '<script src="/app.js?v=71" defer></script><script src="/demo.js?v=5" defer></script>', '</body></html>', ''].join('\n');
  const dir = path.join(ROOT, t.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page);
  made++;
}
console.log('tool pages:', made);

/* ---- trust pages ---- */
const trustStyle = `<style>
.trust{max-width:820px;margin:0 auto;padding:8px 20px 30px}
.trust section{margin:0 0 26px;padding:26px 28px;border-radius:var(--r-lg)}
.trust h1{margin:0 0 12px;font-size:30px;letter-spacing:-.01em}
.trust h2{margin:0 0 12px;font-size:20px}
.trust p,.trust li{color:var(--muted);line-height:1.7;font-size:16px}
.trust p{margin:0 0 12px}
.trust ul{margin:0 0 12px;padding-left:20px}
.trust li{margin-bottom:8px}
.trust strong{color:var(--ink)}
.trust a{color:var(--accent);font-weight:600}
.backrow{max-width:820px;margin:0 auto;padding:18px 20px 0}
.backlink{display:inline-flex;align-items:center;gap:7px;min-height:44px;color:var(--accent);font-weight:600;text-decoration:none}
.backlink:hover{text-decoration:underline}
</style>`;
function trustHead(title, desc, slug) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escA(desc)}">
<link rel="canonical" href="${BASE}/${slug}/">
<meta name="theme-color" content="#1A365D">
<meta property="og:title" content="${escA(title)}">
<meta property="og:description" content="${escA(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE}/${slug}/">
<meta property="og:image" content="${BASE}/og-image.png">
<meta property="og:image:alt" content="PDFStow — free online PDF tools that keep your files private">
<meta name="twitter:image:alt" content="PDFStow — free online PDF tools that keep your files private">
<script type="application/ld+json">
${ldjson({ '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url: `${BASE}/${slug}/`, isPartOf: { '@type': 'WebSite', name: 'PDFStow', url: BASE + '/' }, publisher: { '@type': 'Organization', name: 'Safwan.Digital', url: 'https://safwan.digital', logo: `${BASE}/icon-512.png` } })}
</script>
<script>try{if(/^https?:$/.test(location.protocol)&&/\\/index\\.html$/.test(location.pathname)){history.replaceState(null,'',location.pathname.replace(/\\/index\\.html$/,'/')+location.search+location.hash)}}catch(e){}try{localStorage.removeItem('aurelia-palette');var _t=localStorage.getItem('aurelia-theme');if(_t==='dark'||(_t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.dataset.theme='dark'}catch(e){}</script>
<link rel="stylesheet" href="/styles.css?v=70">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${trustStyle}
</head>`;
}
/* Trust pages carry the SAME header as the rest of the site (v4.5.2, F11),
   theme toggle included — the logo just links home instead of calling the
   SPA's showHome(), and a small inline script wires the toggle (trust pages
   do not load app.js). */
const trustHeader = subHeader.replace('href="/" onclick="showHome();return false"', 'href="/"');
const trustThemeScript = `<script>
(function(){var b=document.getElementById('themeBtn');if(!b)return;function sync(){var d=document.documentElement.dataset.theme==='dark';b.innerHTML='<svg class="ic" width="16" height="16" aria-hidden="true"><use href="#i-'+(d?'sun':'moon')+'"/></svg> '+(d?'Light':'Dark')}sync();b.addEventListener('click',function(){var h=document.documentElement;var d=h.dataset.theme!=='dark';h.dataset.theme=d?'dark':'light';try{localStorage.setItem('aurelia-theme',d?'dark':'light')}catch(e){}sync()});try{var mq=matchMedia('(prefers-color-scheme: dark)');var fol=function(e){var sv=null;try{sv=localStorage.getItem('aurelia-theme')}catch(err){}if(sv)return;document.documentElement.dataset.theme=e.matches?'dark':'light';sync()};if(mq.addEventListener)mq.addEventListener('change',fol);else if(mq.addListener)mq.addListener(fol)}catch(e){}})();
</script>`;
const SECTIONS = {
  about: `<section class="glass" id="about">
      <h1>About PDFStow</h1>
      <p>PDFStow is a free set of 32+ PDF tools — merge, split, compress, convert, edit, sign, protect and more — that runs entirely in your web browser. It is made by <strong>Safwan Digital</strong>.</p>
      <p>There is no account to create and nothing to install. You open a tool, pick your file, and download the result.</p>
      <p>PDFStow is built and run by <a href="https://safwan.digital" target="_blank" rel="noopener">Safwan.Digital</a>.</p>
      <p>Don’t just take our word for the privacy promise: the complete source code is public on <a href="https://github.com/safwan-digital/pdfstow" target="_blank" rel="noopener">GitHub</a>, so anyone can check that files are never uploaded.</p>
    </section>
    <section class="glass" id="how">
      <h2>How PDFStow works</h2>
      <p>1. You pick a tool and choose a file from your device.</p>
      <p>2. The work happens in your browser tab, on your own device.</p>
      <p>3. You download the finished file. Nothing is sent anywhere in between.</p>
    </section>`,
  privacy: `<section class="glass" id="privacy">
      <h1>Privacy</h1>
      <p><strong>Your files are never uploaded.</strong> Every tool runs 100% in your browser, so your documents never leave your device. When you close the tab, nothing remains anywhere.</p>
      <p>So there is nothing to hide — but a web page still loads things, and you deserve the full picture:</p>
      <ul>
        <li><strong>Hosting:</strong> this page is hosted on GitHub Pages. Like any website host, GitHub can see normal visit data (such as your IP address) when your browser loads the page. That is about the page itself — never about your files, which are not sent.</li>
        <li><strong>Code libraries:</strong> PDFStow's tools are built on open-source libraries, loaded from public code servers (unpkg, cdnjs and jsDelivr) — the same way most websites load shared code. Those servers receive a normal file request, never your documents.</li>
        <li><strong>First-use downloads:</strong> a few tools load their library only when you first open them. The first time you use OCR, your browser also downloads the English language data (about 10 MB) from jsDelivr; after that it is cached on your device.</li>
        <li><strong>Analytics:</strong> PDFStow uses Google Analytics and Microsoft Clarity to count visits and see how people use the pages — which tools are popular, and where people click and scroll — so the site can be improved. They never receive your files or anything inside them: your documents still never leave your device. Like the hosting and library servers above, these services receive a normal visit request (such as your IP address and browser type) — about your visit, never about your documents.</li>
        <li><strong>No accounts, no adverts:</strong> PDFStow has no accounts and no advertising. Your light/dark theme choice is stored only on your own device.</li>
        <li><strong>Check it yourself:</strong> the complete source code is public — read it, or watch what your browser sends, at <a href="https://github.com/safwan-digital/pdfstow" target="_blank" rel="noopener">github.com/safwan-digital/pdfstow</a>. Anyone can verify that files are never uploaded.</li>
      </ul>
    </section>`,
  terms: `<section class="glass" id="terms">
      <h1>Terms</h1>
      <ul>
        <li>PDFStow is free to use, for personal and business documents.</li>
        <li>Only use Unlock, Protect and Redact on documents you own or have permission to change.</li>
        <li>Keep your own copies of important files. Because nothing is uploaded, PDFStow cannot recover a file for you.</li>
        <li>The tools are provided “as is”, without warranty. A few conversions are marked Beta on their tool pages — they are text-based, so complex layouts may come out simplified.</li>
      </ul>
    </section>`,
  contact: `<section class="glass" id="contact">
      <h1>Contact</h1>
      <p>Questions, feedback, or a bug to report? Email us at <a href="mailto:info@safwan.digital">info@safwan.digital</a>, reach out on Instagram, or open an issue on GitHub — where you can also read every line of code and suggest a tool:</p>
      <p><a href="https://www.instagram.com/safwan.digital" target="_blank" rel="noopener">@safwan.digital on Instagram</a></p>
      <p><a href="https://github.com/safwan-digital/pdfstow" target="_blank" rel="noopener">PDFStow on GitHub</a></p>
      <h2>Send a message</h2>
      <form id="contactForm">
        <p><label>Your name<br><input name="name" type="text" autocomplete="name" style="width:100%;margin-top:6px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:var(--glass2);color:var(--ink)"></label></p>
        <p><label>Your email<br><input name="email" type="email" required autocomplete="email" style="width:100%;margin-top:6px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:var(--glass2);color:var(--ink)"></label></p>
        <p><label>Subject<br><input name="subject" type="text" required style="width:100%;margin-top:6px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:var(--glass2);color:var(--ink)"></label></p>
        <p><label>Message<br><textarea name="message" rows="5" required style="width:100%;margin-top:6px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:var(--glass2);color:var(--ink)"></textarea></label></p>
        <p><button class="btn primary" type="submit">Send message</button> <button class="btn" type="button" id="copyEmailBtn">Copy our email address</button></p>
        <p id="contactNote">How this works: pressing Send message opens your own email app with your message filled in, addressed to us — you press Send there. Nothing is stored on this site, and no form service is involved.</p>
      </form>
      <script>(function(){var form=document.getElementById('contactForm');var note=document.getElementById('contactNote');var copyBtn=document.getElementById('copyEmailBtn');copyBtn.addEventListener('click',function(){var done=function(){copyBtn.textContent='Copied — info@safwan.digital';};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText('info@safwan.digital').then(done,done);}else{done();}});form.addEventListener('submit',function(e){e.preventDefault();var v=function(n){var el=form.elements.namedItem(n);return el?el.value.trim():'';};var subject=v('subject')||'Message from the pdfstow.com contact form';var body='Name: '+(v('name')||'-')+'\\nEmail: '+v('email')+'\\n\\n'+v('message');note.textContent='Your email app should now open with your message ready — press Send there to finish. If nothing opened, use the Copy button and write to info@safwan.digital.';window.location.href='mailto:info@safwan.digital?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);});})();</script>
    </section>`
};
const TRUST_PAGES = [
  { slug: 'about', title: 'About PDFStow — Free PDF Tools That Run in Your Browser', desc: 'PDFStow is a free set of 32+ PDF tools that runs entirely in your browser — no uploads, no account. Made by Safwan Digital. Here is how it works.', sections: ['about'] },
  { slug: 'privacy', title: 'PDFStow Privacy — Your Files Never Leave Your Device', desc: 'Your files are never uploaded: every PDFStow tool runs 100% in your browser. What the hosting, library and analytics services can see, in plain words.', sections: ['privacy'] },
  { slug: 'terms', title: 'Terms of Use — PDFStow', desc: 'The simple terms for using PDFStow\u2019s free tools: free for personal and business use, only change documents you own, and keep your own copies.', sections: ['terms'] },
  { slug: 'contact', title: 'Contact — PDFStow', desc: 'Questions, feedback or a bug to report? Email PDFStow at info@safwan.digital, reach out on Instagram at @safwan.digital, or open an issue on GitHub — the full source code is public.', sections: ['contact'] }
];
for (const p of TRUST_PAGES) {
  const body = p.sections.map(s => SECTIONS[s]).join('\n    ');
  const page = `${trustHead(p.title, p.desc, p.slug)}
<body>
${sprite}
${trustHeader}
<main>
  <div class="backrow"><a class="backlink" href="/"><svg class="ic" width="16" height="16" aria-hidden="true"><use href="#i-arrow-left"/></svg> Back to the tools</a></div>
  <div class="trust">
    ${body}
  </div>
</main>
${footer}
${trustThemeScript}
</body>
</html>
`;
  const dir = path.join(ROOT, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page);
}
console.log('trust pages:', TRUST_PAGES.length);

/* ---- trust.html redirect stub ---- */
fs.writeFileSync(path.join(ROOT, 'trust.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Privacy — PDFStow</title>
<meta name="description" content="This page has moved to the PDFStow Privacy page.">
<link rel="canonical" href="${BASE}/privacy/">
<meta http-equiv="refresh" content="0; url=/privacy/">
<meta name="robots" content="noindex">
</head>
<body>
<p>This page has moved. <a href="/privacy/">Continue to the Privacy page</a> — or see <a href="/about/">About</a>, <a href="/terms/">Terms</a> and <a href="/contact/">Contact</a>.</p>
</body>
</html>
`);
console.log('trust.html stub written');

/* ---- text-to-pdf redirect stub (v4.7.0: the tool became PDF Editor) ---- */
fs.mkdirSync(path.join(ROOT, 'text-to-pdf'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'text-to-pdf', 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PDF Editor — PDFStow</title>
<meta name="description" content="Text to PDF has moved: PDFStow's PDF Editor now covers it — edit a PDF's words, add text, images and a signature in one place.">
<link rel="canonical" href="${BASE}/pdf-editor/">
<meta http-equiv="refresh" content="0; url=/pdf-editor/">
<meta name="robots" content="noindex">
</head>
<body>
<p>Text to PDF has moved. <a href="/pdf-editor/">Continue to the PDF Editor</a> — edit a PDF's words, add text, images and a signature, all in one place.</p>
</body>
</html>
`);
console.log('text-to-pdf stub written');

/* ---- sitemap.xml (37 URLs) ---- */
const ORDER = ['merge-pdf', 'compress-pdf', 'jpg-to-pdf', 'pdf-to-word', 'pdf-to-jpg', 'word-to-pdf', 'split-pdf', 'pdf-to-excel', 'sign-pdf', 'ocr-pdf', 'edit-pdf', 'pdf-to-png', 'pdf-to-text', 'rotate-pdf', 'watermark-pdf', 'protect-pdf', 'unlock-pdf', 'remove-pages', 'extract-pages', 'organize-pdf', 'crop-pdf', 'page-numbers', 'annotate-pdf', 'html-to-pdf', 'pdf-editor', 'pdf-metadata', 'repair-pdf', 'compare-pdf', 'pdf-to-markdown', 'summarize-pdf', 'redact-pdf', 'scan-pdf'];
const TOP = new Set(ORDER.slice(0, 10));
/* Per-page lastmod: set a page's date here when its own content changes;
   pages touched by a site-wide release take that release's date. */
const RELEASE_DATE = '2026-11-27';
const TRUST_DATES = { about: '2026-11-27', privacy: '2026-11-27', terms: '2026-11-17', contact: '2026-11-22' };
const urls = [{ loc: BASE + '/', pr: '1.0', cf: 'weekly', dt: RELEASE_DATE }]
  .concat(ORDER.map(s => ({ loc: `${BASE}/${s}/`, pr: TOP.has(s) ? '0.9' : '0.8', cf: 'weekly', dt: RELEASE_DATE })))
  .concat(['about', 'privacy', 'terms', 'contact'].map(s => ({ loc: `${BASE}/${s}/`, pr: '0.3', cf: 'monthly', dt: TRUST_DATES[s] })));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.dt}</lastmod><changefreq>${u.cf}</changefreq><priority>${u.pr}</priority></url>`).join('\n')
  + `\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log('sitemap URLs:', urls.length);

/* ---- llms.txt (draft adapted to the final structure) ---- */
let llms = fs.readFileSync(path.join(ROOT, 'seo-drafts', 'llms.txt'), 'utf8');
llms = llms.replace('- [All PDFStow tools](https://pdfstow.com/tools/): The full list of 32+ tools.',
  '- [All PDFStow tools](https://pdfstow.com/): The home page lists all 32+ tools, with search.');
llms = llms.replace('- [About, Privacy and Terms](https://pdfstow.com/trust/): How PDFStow works, why files are never uploaded, and the terms of use. PDFStow is made by Safwan Digital (safwan.digital). Contact: Instagram @safwan.digital or the GitHub repo.',
  '- [About PDFStow](https://pdfstow.com/about/): What PDFStow is and how it works. PDFStow is made by Safwan Digital (safwan.digital).\n- [Privacy](https://pdfstow.com/privacy/): Why files are never uploaded, and what hosting, library and analytics services can see.\n- [Terms](https://pdfstow.com/terms/): The simple terms of use.\n- [Contact](https://pdfstow.com/contact/): Email info@safwan.digital, Instagram @safwan.digital or the GitHub repo.');
llms = llms.replace('- [Text to PDF](https://pdfstow.com/text-to-pdf/): Turn plain text into a clean PDF.',
  '- [PDF Editor](https://pdfstow.com/pdf-editor/): Edit the words in a PDF line by line, add text, images and a signature — all in one place.');
llms = llms.replace('https://github.com/safwan-digital/aurelia-pdf', 'https://github.com/safwan-digital/pdfstow');
fs.writeFileSync(path.join(ROOT, 'llms.txt'), llms);
console.log('llms.txt written');
