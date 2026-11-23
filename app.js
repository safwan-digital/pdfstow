/* PDFStow — 100% client-side PDF tools. No uploads. */
'use strict';
/* Performance (v4.7.2): NO library loads with the page any more. pdf-lib,
   PDF.js and JSZip moved from eager <head> tags into LAZY_LIBS below and
   are injected by loadLib() the first time a tool needs them — the home
   page used to wait on ~360 KB of tool stack before it could paint.
   pdf-lib's helpers are bound lazily by bindPdfLib() once it arrives;
   a library that FAILS to load is reported by loadLib itself, in context
   (the old boot-time LIBS_OK check is gone — "not loaded yet" is now the
   normal state until a tool starts). */
let PDFDocument, StandardFonts, rgb, degrees;
function bindPdfLib(){if(window.PDFLib&&!PDFDocument)({PDFDocument, StandardFonts, rgb, degrees} = PDFLib)}
function showLibFailure(what){let p=document.getElementById('libFail');if(!p){p=document.createElement('div');p.id='libFail';p.className='libfail glass';p.setAttribute('role','alert');const m=document.querySelector('main');if(m)m.prepend(p);else document.body.prepend(p)}p.innerHTML='<strong>A library failed to load.</strong> '+(what||'Part of PDFStow')+' could not be loaded — check your connection and reload the page. <button type="button" class="btn sm" onclick="location.reload()">Reload</button>';p.classList.remove('hidden')}
/* pdf.js is only ever called through GD, which sets isEvalSupported:false
   on every call (deep-audit #1 — the switch that closes the CVE-2024-4367
   code path in pdf.js 3.11.174). */
const GD=opts=>pdfjsLib.getDocument({isEvalSupported:false,...opts});
/* Lazy libraries (deep-audit #20–22): SheetJS is vendored same-origin at a
   current 0.20.3 (vendor/ — fixes the frozen-0.18.5 CVEs of #21); the
   rest load from their pinned CDNs. EVERY library is lazy since v4.7.2:
   pdf-lib, PDF.js and JSZip joined this registry and load on first use
   of a tool that needs them, each with the same SRI integrity hash its
   old eager <head> tag carried. loadLib dedupes concurrent calls
   through libPromises; a failed load surfaces the plain failure panel
   and rejects, so the calling tool stops with a clear message instead
   of running half-equipped. */
const PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const LAZY_LIBS={
 pdflib:{url:'https://unpkg.com/pdf-lib-plus-encrypt@1.1.0/dist/pdf-lib-plus-encrypt.min.js',integrity:'sha384-3Vtx+d/EbRfd0HOhIWT43lRjbbmpzXlIjVW9jorWQoodg/CiZLtori41Pt0Klz5P',global:'PDFLib',label:'The PDF library'},
 pdfjs:{url:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',integrity:'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e',global:'pdfjsLib',label:'The PDF viewer library',after:()=>{if(window.pdfjsLib)pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER}},
 jszip:{url:'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',integrity:'sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG',global:'JSZip',label:'The ZIP library'},
 xlsx:{url:'xlsx.full.min.js',integrity:'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT',global:'XLSX',label:'The spreadsheet library'},
 mammoth:{url:'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',integrity:'sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz',global:'mammoth',label:'The Word library'},
 tesseract:{url:'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js',integrity:'sha384-Ptw8HCYAWF6vIop6WuGxfSCiDCIzUWqjrHYfx8Vd0S4CMBaicAdBh2y+Ufle664A',global:'Tesseract',label:'The OCR library'}};
const libPromises={};
function loadLib(key){const L=LAZY_LIBS[key];if(!L)return Promise.resolve();if(window[L.global]){if(L.after)L.after();return Promise.resolve()}if(libPromises[key])return libPromises[key];libPromises[key]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=L.url;if(L.integrity){s.integrity=L.integrity;s.crossOrigin='anonymous'}s.onload=()=>{if(L.after)L.after();res()};s.onerror=()=>{delete libPromises[key];showLibFailure(L.label);rej(new Error(L.label+' failed to load — check your connection and reload the page.'))};document.head.appendChild(s)});return libPromises[key]}
/* Per-tool library needs (v4.7.2). processTool() awaits ensureToolLibs()
   before dispatching; the preview paths (buildVisual, probePdf) await
   ensurePdfJs() themselves; openTool() prefetches the set in the
   background so a library is usually already here when it is needed;
   zipOut() self-ensures JSZip. A tool missing from the map gets the
   safe default of both core libraries. */
async function ensurePdfLib(){await loadLib('pdflib');bindPdfLib()}
async function ensurePdfJs(){await loadLib('pdfjs')}
async function ensureZip(){await loadLib('jszip')}
const TOOL_LIBS={'scan':['pdflib'],'merge':['pdflib'],'split':['pdflib','jszip'],'remove-pages':['pdflib'],'extract-pages':['pdflib'],'organize':['pdflib'],'rotate':['pdflib'],'crop':['pdflib'],'compress':['pdflib','pdfjs'],'repair':['pdflib'],'ocr':['pdflib','pdfjs'],'images-to-pdf':['pdflib'],'html-to-pdf':['pdflib'],'word-to-pdf':['pdflib'],'pdf-to-jpg':['pdfjs','jszip'],'pdf-to-png':['pdfjs','jszip'],'pdf-to-text':['pdfjs'],'pdf-to-word':['pdfjs','jszip'],'pdf-to-excel':['pdfjs'],'pdf-to-markdown':['pdfjs'],'pdf-editor':['pdflib','pdfjs'],'edit-pdf':['pdflib','pdfjs'],'annotate':['pdflib','pdfjs'],'page-numbers':['pdflib'],'watermark':['pdflib','pdfjs'],'sign-pdf':['pdflib','pdfjs'],'redact':['pdflib','pdfjs'],'protect':['pdflib'],'unlock':['pdflib','pdfjs'],'metadata':['pdflib'],'compare':['pdfjs'],'summarize':['pdfjs']};
async function ensureToolLibs(id){const needs=TOOL_LIBS[id]||['pdflib','pdfjs'];await Promise.all(needs.map(k=>k==='pdflib'?ensurePdfLib():k==='pdfjs'?ensurePdfJs():loadLib(k)))}
/* Analytics (v4.4.0, DEC-2; v4.5.0: GA fires via Tag Manager):
   Google Tag Manager + Microsoft Clarity. Loaded ONLY on http(s) —
   on file:// (the test suites, local previews) this stays completely
   silent: no requests, no errors, exactly like the manifest /
   service-worker guards. Everything is wrapped so an analytics
   failure can never affect the tools. The service worker bypasses
   these hosts entirely, so nothing here is ever cached or
   stale-served. Google Analytics is NOT loaded directly any more:
   the GTM container (GTM-MDP3TXXV) holds the Google tag, which fires
   GA4 property G-PQVM1CRD02 — Safwan's separate PDFStow account.
   What is collected is disclosed on the Privacy page: visits and
   usage only — analytics never receives files or anything inside
   them. */
/* v4.7.2: analytics no longer competes with first paint. GTM + Clarity
   start only after the window load event, on an idle callback with a
   bounded timeout (plain-timer fallback), so measurement still fires
   on every page — just never before the page itself has rendered. */
function startAnalytics(){
  try{
    if(!/^https?:$/.test(location.protocol))return;
    const add=u=>{const s=document.createElement('script');s.async=true;s.src=u;document.head.appendChild(s)};
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
    add('https://www.googletagmanager.com/gtm.js?id=GTM-MDP3TXXV');
    add('https://www.clarity.ms/tag/zf09zdj8dk');
    tagAppMode();
  }catch(e){}
}
/* App-mode marker (v4.7.27): label every analytics session as
   'installed' when the site runs as an installed app (Microsoft Store
   app, installed PWA, home-screen app) or 'browser' otherwise, so
   Store-app usage can be told apart from website visits in both GA4
   (user property app_mode) and Microsoft Clarity (custom tag
   app_mode). Detection uses the standard display-mode signals; the
   label is applied with a bounded retry because GTM's Google tag and
   the Clarity tag finish loading after this script injects them. No
   files or file contents are involved — same promise as all analytics
   here. */
function tagAppMode(){
  try{
    let installed=false;
    try{
      installed=!!((window.matchMedia&&((matchMedia('(display-mode: standalone)').matches)||(matchMedia('(display-mode: window-controls-overlay)').matches)))||navigator.standalone===true||(document.referrer&&document.referrer.indexOf('android-app://')===0));
    }catch(e){}
    const mode=installed?'installed':'browser';
    try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'app_mode',app_mode:mode});}catch(e){}
    let tries=0,clarityDone=false,gtagDone=false;
    const timer=setInterval(()=>{
      tries++;
      try{
        if(!clarityDone&&typeof window.clarity==='function'){window.clarity('set','app_mode',mode);clarityDone=true;}
      }catch(e){clarityDone=true;}
      try{
        if(!gtagDone&&typeof window.gtag==='function'){window.gtag('set','user_properties',{app_mode:mode});gtagDone=true;}
      }catch(e){gtagDone=true;}
      if((clarityDone&&gtagDone)||tries>=20)clearInterval(timer);
    },500);
  }catch(e){}
}
/* Error tracking (v4.7.6): Sentry, errors only — no session replay,
   no performance tracing, no PII (sendDefaultPii off) and a beforeSend
   scrub that strips URLs' query strings, headers and user data. It
   receives exception stack traces only — never files or their contents,
   same promise as analytics. Loaded on the same idle schedule as
   analytics so it never competes with first paint. The SDK comes from
   Sentry's own CDN, browser.sentry-cdn.com (added to the CSP
   script-src in v4.7.7 — the jsDelivr path first tried in v4.7.6 does
   not exist for v8 bundles, which is why the first self-test never
   arrived); events go to *.ingest.sentry.io
   (added to connect-src in v4.7.6). A one-time self-test fires when
   the URL carries ?sentrytest=1. */
function startErrorTracking(){
  try{
    if(!/^https?:$/.test(location.protocol))return;
    const s=document.createElement('script');s.async=true;
    s.src='https://browser.sentry-cdn.com/8.42.0/bundle.min.js';
    s.onload=()=>{
      try{
        if(!window.Sentry)return;
        Sentry.init({
          dsn:'https://383305095000e8bf3b265d0181b099f0@o4512462711357440.ingest.us.sentry.io/4512462714503168',
          sendDefaultPii:false,
          tracesSampleRate:0,
          beforeSend(event){
            try{
              /* v4.7.25: drop errors that live entirely inside Microsoft
                 Clarity's own tag (e.g. PDFSTOW-2) — not our code, and
                 Safwan only wants alerts about real PDFStow errors. */
              const vals=(event.exception&&event.exception.values)||[];
              for(const v of vals){const fr=(v.stacktrace&&v.stacktrace.frames)||[];if(fr.length&&fr.every(f=>String(f.filename||f.abs_path||'').indexOf('clarity.ms')>=0))return null;}
              if(event.request){delete event.request.headers;if(event.request.url)event.request.url=event.request.url.split('?')[0];}
              delete event.user;
              if(event.breadcrumbs)event.breadcrumbs=event.breadcrumbs.map(b=>({timestamp:b.timestamp,type:b.type,level:b.level,category:b.category}));
            }catch(e){}
            return event;
          }
        });
        if(/[?&]sentrytest=1/.test(location.search))Sentry.captureException(new Error('PDFStow Sentry self-test (v4.7.7)'));
      }catch(e){}
    };
    document.head.appendChild(s);
  }catch(e){}
}
(function scheduleAnalytics(){
  try{
    if(!/^https?:$/.test(location.protocol))return;
    /* v4.7.9: trackers start on first interaction, or on an idle
       callback with a 3.5s bound after load — whichever comes first.
       The v4.7.6-era 2s bound let GTM/Clarity/Sentry main-thread work
       land inside Lighthouse's blocking-time window (TBT 20ms -> 260ms
       in the 2026-11-20 fresh run); real visits still get measured,
       because any scroll, tap or keypress starts them instantly. */
    let done=false;
    const start=()=>{if(done)return;done=true;startAnalytics();startErrorTracking()};
    const idle=()=>{if('requestIdleCallback' in window)requestIdleCallback(start,{timeout:3500});else setTimeout(start,3500)};
    if(document.readyState==='complete')idle();
    else addEventListener('load',idle);
    ['pointerdown','keydown','scroll'].forEach(ev=>addEventListener(ev,start,{once:true,passive:true}));
  }catch(e){}
})();
/* Service worker registration (v4.3.0; moved here from the index.html
   inline init in v4.5.0 so EVERY page that loads app.js — home and
   all 32 tool pages — registers the same root worker). Guarded to
   http(s) exactly like the analytics above: on file:// it stays
   silent. The absolute path '/sw.js' matters: on a tool page
   (/merge-pdf/) a relative 'sw.js' would resolve inside the folder
   and 404. */
try{if(/^https?:$/.test(location.protocol)&&'serviceWorker' in navigator){addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}}catch(e){}

const F=(key,label,type='text',def='',extra={})=>({key,label,type,def,...extra});
const O=(v,l)=>({v,l}); // select option with separate value/label
const TOOLS=[
 // Organize
 {id:'merge',cat:'Organize',icon:'combine',name:'Merge PDF',desc:'Combine multiple PDFs into one, in the order you arrange them.',accept:'.pdf',multiple:true},
 {id:'split',cat:'Organize',icon:'scissors',name:'Split PDF',desc:'Split by page ranges, into one PDF per page, or tap pages to pull them out together.',accept:'.pdf',opts:[F('mode','How to split','select','ranges',{options:[O('ranges','By page ranges'),O('each','Every page as its own PDF'),O('pick','Pick pages (tap below)')]}),F('ranges','Ranges (for “By page ranges”)','text','',{placeholder:'e.g. 1-3, 4-6'})]},
 {id:'remove-pages',cat:'Organize',icon:'file-x-2',name:'Remove Pages',desc:'Tap page thumbnails to choose the pages to delete.',accept:'.pdf',opts:[F('pages','Pages to remove (e.g. 2, 4-5)','text','')]},
 {id:'extract-pages',cat:'Organize',icon:'file-output',name:'Extract Pages',desc:'Tap page thumbnails to choose the pages to pull out into a new PDF.',accept:'.pdf',opts:[F('pages','Pages to extract (e.g. 1, 3-5)','text','')]},
 {id:'organize',cat:'Organize',icon:'layers',name:'Organize / Reorder',desc:'Drag page thumbnails into a new order, remove pages, or add a blank page.',accept:'.pdf',opts:[F('order','New order (e.g. 3,1,2)','text','')]},
 {id:'rotate',cat:'Organize',icon:'rotate-cw',name:'Rotate PDF',desc:'Tap [[rotate-cw]] on any page thumbnail to rotate just that page — or rotate every page at once.',accept:'.pdf',opts:[F('angle','Angle (for rotate-all)','select','90',{options:['90','180','270']}),F('pages','Pages for rotate-all (blank = all)','text','')]},
 {id:'crop',cat:'Organize',icon:'crop',name:'Crop PDF',desc:'Drag on the preview to select the part of the page to keep. The same selection is applied to every page.',accept:'.pdf',opts:[F('left','Left trim','number','36'),F('right','Right trim','number','36'),F('top','Top trim','number','36'),F('bottom','Bottom trim','number','36')]},
 // Optimize
 {id:'compress',cat:'Optimize',icon:'minimize-2',name:'Compress PDF',desc:'Re-encode pages to shrink file size. Choose your level.',accept:'.pdf',opts:[F('level','Level','select','recommended',{options:[O('recommended','Recommended — good quality, much smaller'),O('extreme','Extreme — smallest file, lower quality'),O('low','Light — best quality, a bit smaller')]})]},
 {id:'repair',cat:'Optimize',icon:'wrench',name:'Repair PDF',desc:'Load and cleanly re-save a damaged PDF. If a file is too damaged to fix, we will tell you plainly.',accept:'.pdf'},
 {id:'ocr',cat:'Optimize',icon:'scan-text',name:'OCR PDF',desc:'Recognize text in scanned PDFs and build a searchable text PDF. English only; the first run downloads the language data once.',accept:'.pdf',note:'Best effort — English OCR; first use downloads the language data (~10 MB) once, then it is cached',opts:[F('pages','Max pages to OCR','number','5')]},
 // Convert to PDF
 {id:'scan',cat:'Convert to PDF',icon:'scan',name:'Scan to PDF',desc:'Take a photo of each paper page with your camera — or add photos you already have — and turn them into one clean PDF. Your photos are processed on this device and never uploaded.',accept:'.jpg,.jpeg,.png,.webp',multiple:true,note:'Photos never leave your device',opts:[F('enhance','Look','select','bw',{options:[O('color','Color — as photographed'),O('gray','Grayscale'),O('bw','Black & white — clean document')]}),F('size','Page size','select','a4',{options:[O('a4','A4 — fit each page'),O('original','Original photo size')]})]},
 {id:'images-to-pdf',cat:'Convert to PDF',icon:'images',name:'Images to PDF',desc:'Convert JPG & PNG images into one polished PDF.',accept:'.jpg,.jpeg,.png',multiple:true,opts:[F('size','Page size','select','A4',{options:['A4','Letter','Fit image']}),F('margin','Margin around each image','select','18',{options:[O('0','No margin'),O('18','Small'),O('36','Comfortable')]})]},
 {id:'html-to-pdf',cat:'Convert to PDF',icon:'globe',name:'HTML to PDF',desc:'Upload an .html file — its text becomes a clean PDF.',accept:'.html,.htm',note:'Beta — text-based, layout is simplified'},
 {id:'word-to-pdf',cat:'Convert to PDF',icon:'file-type-2',name:'Word to PDF',desc:'Convert a .docx file into a PDF.',accept:'.docx',note:'Beta — text-based, layout is simplified'},
 // Convert from PDF
 {id:'pdf-to-jpg',cat:'Convert from PDF',icon:'image',name:'PDF to JPG',desc:'Turn each page into a JPG image (ZIP if there are many).',accept:'.pdf',opts:[F('scale','Image quality','select','2',{options:[O('1','Standard — smaller files'),O('2','High — recommended'),O('3','Maximum — largest files')]})]},
 {id:'pdf-to-png',cat:'Convert from PDF',icon:'image-down',name:'PDF to PNG',desc:'Turn each page into a crisp PNG image (ZIP if there are many).',accept:'.pdf',opts:[F('scale','Image quality','select','2',{options:[O('1','Standard — smaller files'),O('2','High — recommended'),O('3','Maximum — largest files')]})]},
 {id:'pdf-to-text',cat:'Convert from PDF',icon:'align-left',name:'PDF to Text',desc:'Extract all readable text as a .txt file.',accept:'.pdf'},
 {id:'pdf-to-word',cat:'Convert from PDF',icon:'file-text',name:'PDF to Word',desc:'Extract the text into an editable .docx file.',accept:'.pdf',note:'Beta — text-based, layout is simplified'},
 {id:'pdf-to-excel',cat:'Convert from PDF',icon:'table-2',name:'PDF to Excel',desc:'Turn PDF text into a spreadsheet (.xlsx) — one row per line, split into columns where the spacing allows.',accept:'.pdf',note:'Beta — text into rows/columns, table layout not preserved'},
 {id:'pdf-to-markdown',cat:'Convert from PDF',icon:'file-code-2',name:'PDF to Markdown',desc:'Extract text as Markdown, page by page.',accept:'.pdf',note:'Beta — text-based, structure is approximate'},
 // Edit
 {id:'pdf-editor',cat:'Edit',icon:'pencil',name:'PDF Editor',desc:'Edit the words in a PDF, add text, images and a signature — all in one place.',accept:'.pdf'},
 {id:'edit-pdf',cat:'Edit',icon:'pen-line',name:'Add Text',desc:'Click on the page preview to place your text exactly there. (To change words already in the PDF, use the PDF Editor.)',accept:'.pdf',opts:[F('text','Text to add','text','',{placeholder:'Type the text to add…'}),F('page','Page number','number','1'),F('size','Font size','number','18')]},
 {id:'annotate',cat:'Edit',icon:'sticky-note',name:'Annotate PDF',desc:'Drag a rectangle on the page preview to place a highlighted note, stamped onto the page.',accept:'.pdf',opts:[F('text','Note text','text','',{placeholder:'Type your note…'}),F('page','Page number','number','1')]},
 {id:'page-numbers',cat:'Edit',icon:'hash',name:'Add Page Numbers',desc:'Stamp page numbers on every page — tap a square to choose where they go.',accept:'.pdf',opts:[F('position','Position','posgrid','bottom-right'),F('format','Number style','select','n',{options:[O('n','Just the number (1, 2, 3…)'),O('Page n','Page 1, Page 2…'),O('n / total','1 / 14, 2 / 14…')]}),F('first','First number','number','1')]},
 {id:'watermark',cat:'Edit',icon:'stamp',name:'Watermark',desc:'Add a translucent text watermark — tap a square to choose where it sits.',accept:'.pdf',opts:[F('text','Watermark text','text','',{placeholder:'e.g. CONFIDENTIAL'}),F('position','Position','posgrid','center'),F('opacity','Strength','select','0.25',{options:[O('0.12','Faint'),O('0.25','Clear — recommended'),O('0.4','Strong')]}),F('size','Font size','number','42')]},
 {id:'sign-pdf',cat:'Edit',icon:'signature',name:'Sign PDF',desc:'Draw, type or upload your signature, then drag it anywhere on any page preview.',accept:'.pdf',sig:true},
 {id:'redact',cat:'Edit',icon:'eye-off',name:'Redact PDF',desc:'Drag rectangles on the page preview to permanently black out sensitive areas. Pages with boxes are flattened into images, so the hidden text is truly removed — not just covered.',accept:'.pdf',opts:[F('page','Page number','number','1')]},
 // Security
 {id:'protect',cat:'Security',icon:'lock',name:'Protect PDF',desc:'Encrypt your PDF with a password you choose. There is no recovery if you forget it — keep it safe.',accept:'.pdf',opts:[F('password','Password','password',''),F('confirm','Confirm password','password','')]},
 {id:'unlock',cat:'Security',icon:'lock-open',name:'Unlock PDF',desc:'Remove password protection from a PDF you own. If the file has an open password, you will need to enter it — protection can\'t (and shouldn\'t) be bypassed without it.',accept:'.pdf',note:'Works on permission-protected files, and on password files when you know the password',opts:[F('password','Current password (if the file asks for one)','password','')]},
 {id:'metadata',cat:'Security',icon:'tags',name:'Metadata Editor',desc:'See and edit the title, author, subject & keywords stored inside your PDF.',accept:'.pdf',opts:[F('title','Title','text',''),F('author','Author','text',''),F('subject','Subject','text',''),F('keywords','Keywords (comma separated)','text',''),F('clearmeta','Clear all metadata instead','checkbox','')]},
 // Other
 {id:'compare',cat:'Compare & AI',icon:'git-compare-arrows',name:'Compare PDF',desc:'Upload 2 PDFs — get a text difference report. (If you add more, the first two are compared.)',accept:'.pdf',multiple:true},
 {id:'summarize',cat:'Compare & AI',icon:'sparkles',name:'Summarize PDF',desc:'Local extractive summary — picks the key sentences from the document itself. Nothing is uploaded.',accept:'.pdf',note:'Extractive summary runs 100% locally'},
];
let current=null, files=[];
/* Scan to PDF: per-photo rotation, keyed by the File object itself. */
const scanState=new Map();
function rotateScanFile(i){const f=files[i];if(!f)return;const st=scanState.get(f)||{rot:0};st.rot=(st.rot+90)%360;scanState.set(f,st);renderFileList()}
const $=id=>document.getElementById(id);
function toast(m){const t=$('toast');t.textContent=m;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),4200)}
function showHome(){if(PAGE_TOOL){location.href='/';return}cleanUrl('/');$('homeView').classList.remove('hidden');$('toolView').classList.add('hidden');window.scrollTo({top:0,behavior:'smooth'})}
function fmt(n){return n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB'}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const icon=(n,s=20)=>`<svg class="ic" width="${s}" height="${s}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const expandDesc=d=>d.replace(/\[\[([\w-]+)\]\]/g,(m,n)=>icon(n,14));
const pillHTML=note=>{if(!note)return '';const txt=note.split('—')[0].trim();const cls=txt.split(/\s+/).filter(Boolean).length<=3?'pill tag':'pill';return `<span class="${cls}">${txt}</span>`};
const POPULAR=['merge','compress','pdf-to-jpg','images-to-pdf'];
/* Short card blurbs (v4.5.2, F9): cards get one plain line each — the full
   desc stays on the tool panel and the tool pages, where there is room. */
const CARD_BLURBS={'scan':'Photograph paper pages and turn them into one clean PDF.','merge':'Combine several PDFs into one file, in your order.','split':'Split by page ranges, one PDF per page, or by tapping pages.','remove-pages':'Tap the pages you do not want and delete them.','extract-pages':'Pull the pages you pick out into a new PDF.','organize':'Drag pages into a new order, remove pages, or add a blank one.','rotate':'Rotate single pages, or every page at once.','crop':'Select the part of the page to keep — just drag on the preview.','compress':'Make a PDF smaller. Best for scans and photo-heavy files.','repair':'Re-save a damaged PDF cleanly so it opens again.','ocr':'Make scanned PDFs searchable. English, on your device.','images-to-pdf':'Turn JPG and PNG images into one polished PDF.','html-to-pdf':'Turn an HTML file into a clean, readable PDF.','word-to-pdf':'Convert a Word (.docx) file into a PDF.','pdf-to-jpg':'Save each page as a JPG image.','pdf-to-png':'Save each page as a crisp PNG image.','pdf-to-text':'Pull all the readable text out as a .txt file.','pdf-to-word':'Extract the text into an editable Word file.','pdf-to-excel':'Turn PDF text into a spreadsheet, row by row.','pdf-to-markdown':'Extract the text as Markdown, page by page.','pdf-editor':'Change the words in a PDF, and add text, images and a signature.','edit-pdf':'Click the page preview to place new text on it.','annotate':'Add a highlighted note anywhere on a page.','page-numbers':'Stamp page numbers where you want them.','watermark':'Add a faint text watermark across your pages.','sign-pdf':'Draw, type or upload a signature and place it.','redact':'Black out sensitive areas — removed for good, not just covered.','protect':'Lock a PDF with a password you choose.','unlock':'Remove a password from a PDF you own.','metadata':'See and edit the title, author and keywords inside a PDF.','compare':'Compare two PDFs and get a text difference report.','summarize':'Get the key sentences from a document, on your device.'};
const cardText=t=>CARD_BLURBS[t.id]||t.desc;
const CAT_SUB={'Organize':'Merge, split, reorder and clean up pages','Optimize':'Smaller files, rescued documents, scanned text','Convert to PDF':'Bring documents and images into PDF','Convert from PDF':'Turn PDFs into images, text and Office files','Edit':'Mark up, sign and add to your pages','Security':'Locks, passwords and document details','Compare & AI':'Read, compare and summarize documents'};
const SLUGS={'scan':'scan-pdf','merge':'merge-pdf','split':'split-pdf','remove-pages':'remove-pages','extract-pages':'extract-pages','organize':'organize-pdf','rotate':'rotate-pdf','crop':'crop-pdf','compress':'compress-pdf','repair':'repair-pdf','ocr':'ocr-pdf','images-to-pdf':'jpg-to-pdf','html-to-pdf':'html-to-pdf','word-to-pdf':'word-to-pdf','pdf-to-jpg':'pdf-to-jpg','pdf-to-png':'pdf-to-png','pdf-to-text':'pdf-to-text','pdf-to-word':'pdf-to-word','pdf-to-excel':'pdf-to-excel','pdf-to-markdown':'pdf-to-markdown','pdf-editor':'pdf-editor','edit-pdf':'edit-pdf','annotate':'annotate-pdf','page-numbers':'page-numbers','watermark':'watermark-pdf','sign-pdf':'sign-pdf','redact':'redact-pdf','protect':'protect-pdf','unlock':'unlock-pdf','metadata':'pdf-metadata','compare':'compare-pdf','summarize':'summarize-pdf'};
/* Per-tool pages (v4.5.0): <body data-tool="<id>"> marks a static tool
   page (/<slug>/). app.js opens that tool at boot and never rewrites the
   URL there — the address already names the tool. On the home SPA,
   openTool mirrors that same clean /<slug>/ path (v4.6.1). */
const PAGE_TOOL=(document.body&&document.body.dataset&&document.body.dataset.tool)||null;function clearSearch(){const si=$('searchInput');if(si)si.value='';renderTools('')}
function renderTools(filter=''){
  const cats=[...new Set(TOOLS.map(t=>t.cat))]; let html='';
  if(!filter){const pop=POPULAR.map(id=>TOOLS.find(t=>t.id===id)).filter(Boolean);
    html+=`<section class="cat" id="popular"><h2>${icon('flame',22)} Most popular</h2><p>The everyday tools — one tap away</p><div class="grid">${pop.map((t,i)=>`<a class="card glass rv pop" style="--rd:${(i%4)*70}ms" href="/${SLUGS[t.id]}/" onclick="openTool('${t.id}');return false"><div class="icchip"><span class="ic-in">${icon(t.icon,24)}</span></div><h3>${t.name}</h3><p>${expandDesc(cardText(t))}</p><span class="pill tag">Popular</span>${pillHTML(t.note)}</a>`).join('')}</div></section>`}
  cats.forEach(c=>{const list=TOOLS.filter(t=>t.cat===c&&(t.name+' '+t.desc).toLowerCase().includes(filter.toLowerCase())); if(!list.length)return;
    html+=`<section class="cat"><h2>${c}</h2><p>${CAT_SUB[c]||''}</p><div class="grid">${list.map((t,i)=>`<a class="card glass rv" style="--rd:${(i%4)*70}ms" href="/${SLUGS[t.id]}/" onclick="openTool('${t.id}');return false"><div class="icchip"><span class="ic-in">${icon(t.icon,24)}</span></div><h3>${t.name}</h3><p>${expandDesc(cardText(t))}</p>${pillHTML(t.note)}</a>`).join('')}</div></section>`});
  const sm=$('searchMeta');const q=filter.trim();if(sm){if(q){const n=TOOLS.filter(t=>(t.name+' '+t.desc).toLowerCase().includes(q.toLowerCase())).length;sm.textContent=n?n+' tool'+(n===1?'':'s')+' match \u201c'+q+'\u201d':'No tools match that search.';sm.classList.remove('hidden')}else sm.classList.add('hidden')}
  $('tools').innerHTML=html||`<div class="emptystate glass"><p>No tools match \u201c${esc(q)}\u201d. Try a shorter word — or browse them all.</p><button class="btn" type="button" onclick="clearSearch()">Show all tools</button></div>`;
  revealScan(!!filter);
}
$('searchInput').addEventListener('input',e=>renderTools(e.target.value));
/* ===== V4.6.0: real search — results dropdown under the hero bar =====
   Matches name, card blurb, category and a synonym map; a result behaves
   exactly like its card (same /<slug>/ anchor + openTool intercept). The
   grid filter above still runs; the dropdown is the primary surface, so
   it owns the match / no-match messaging (searchMeta stays hidden). */
const SEARCH_KEYS={'scan':'camera photo scanner photograph paper document','merge':'combine join together','split':'separate apart','remove-pages':'delete pages','extract-pages':'pull out pages','organize':'reorder arrange pages','rotate':'turn sideways upside down','crop':'trim cut margins','compress':'shrink smaller reduce size squeeze','repair':'fix broken damaged corrupt','ocr':'scan scanned searchable recognition','images-to-pdf':'picture photo image jpg jpeg png','html-to-pdf':'html web page','word-to-pdf':'word doc docx','pdf-to-jpg':'picture photo image jpg jpeg','pdf-to-png':'picture photo image png','pdf-to-text':'text txt words extract','pdf-to-word':'word doc docx editable','pdf-to-excel':'excel spreadsheet xlsx table rows','pdf-to-markdown':'markdown md','pdf-editor':'edit change fix words typo editor write','edit-pdf':'add text write on','annotate':'note comment highlight sticky','page-numbers':'number numbering stamp','watermark':'stamp overlay faint text','sign-pdf':'sign signature autograph','redact':'black out hide censor sensitive','protect':'password lock encrypt secure','unlock':'password remove password decrypt unprotect','metadata':'title author keywords properties info','compare':'diff difference versus vs','summarize':'summary key points tldr'};
(function(){
  const bar=document.querySelector('.search');const input=$('searchInput');
  if(!bar||!input||!bar.contains(input))return;
  const drop=document.createElement('div');drop.className='sdrop glass hidden';drop.setAttribute('role','listbox');drop.setAttribute('aria-label','Matching tools');document.body.appendChild(drop);
  const place=()=>{const r=bar.getBoundingClientRect();drop.style.left=r.left+'px';drop.style.top=(r.bottom+8)+'px';drop.style.width=r.width+'px'};
  let rows=[],sel=-1;
  const hay=t=>(t.name+' '+cardText(t)+' '+t.cat+' '+(SEARCH_KEYS[t.id]||'')).toLowerCase();
  function matches(q){
    const words=q.toLowerCase().split(/\s+/).filter(Boolean);if(!words.length)return[];
    const scored=[];
    TOOLS.forEach(t=>{const h=hay(t);if(!words.every(w=>h.includes(w)))return;const nm=t.name.toLowerCase();scored.push({t,s:nm.includes(q.trim().toLowerCase())?0:1})});
    return scored.sort((a,b)=>a.s-b.s).slice(0,7).map(x=>x.t);
  }
  function close(){drop.classList.add('hidden');sel=-1;rows=[]}
  function open(q){
    const list=matches(q);
    if(!list.length){drop.innerHTML='<div class="snone">No tool matches \u201c'+esc(q.trim())+'\u201d \u2014 try \u201cmerge\u201d or \u201ccompress\u201d.</div>';rows=[];sel=-1}
    else{drop.innerHTML=list.map(t=>'<a class="sresult" role="option" href="/'+SLUGS[t.id]+'/" data-tool="'+t.id+'" onclick="openTool(\''+t.id+'\');return false"><span class="ic-in">'+icon(t.icon,20)+'</span><span class="st"><span class="sn">'+t.name+'</span><span class="sb">'+cardText(t)+'</span></span></a>').join('');rows=[...drop.querySelectorAll('.sresult')];sel=-1}
    place();drop.classList.remove('hidden');
  }
  function mark(){rows.forEach((r,i)=>r.classList.toggle('sel',i===sel));if(sel>=0&&rows[sel])rows[sel].scrollIntoView({block:'nearest'})}
  input.addEventListener('input',()=>{const sm=$('searchMeta');if(sm)sm.classList.add('hidden');const q=input.value;if(!q.trim()){close();return}open(q)});
  input.addEventListener('focus',()=>{if(input.value.trim())open(input.value)});
  input.addEventListener('keydown',e=>{
    if(e.key==='Escape'){close();return}
    if(drop.classList.contains('hidden'))return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!rows.length)return;sel=e.key==='ArrowDown'?(sel+1)%rows.length:(sel-1+rows.length)%rows.length;mark();return}
    if(e.key==='Enter'){const list=matches(input.value);if(list.length){e.preventDefault();const t=list[sel>=0?sel:0];close();input.blur();openTool(t.id)}}
  });
  drop.addEventListener('click',()=>close());
  window.addEventListener('scroll',()=>{if(drop.classList.contains('hidden'))return;const r=bar.getBoundingClientRect();if(r.bottom<0||r.top>window.innerHeight)close();else place()},{capture:true,passive:true});
  window.addEventListener('resize',()=>{if(!drop.classList.contains('hidden'))place()});
  document.addEventListener('pointerdown',e=>{if(!bar.contains(e.target)&&!drop.contains(e.target))close()});
})();
/* ===== V4.1 motion: scroll reveal for tool cards =====
   Cards start hidden ONLY under .js-anim (added pre-paint by the head init
   when motion is allowed), so no-JS / reduced-motion always sees content.
   IntersectionObserver reveals each card once, staggered per row via --rd;
   the reveal classes are removed after the transition so the normal card
   hover physics take over cleanly. Search re-renders reveal instantly. */
const reduceMotion=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
let revealIO=null;
function revealClean(el){el.classList.remove('rv','in','snap')}
function revealScan(instant){
  const els=[...document.querySelectorAll('.rv:not(.in)')];
  if(!els.length)return;
  if(instant||reduceMotion||!('IntersectionObserver' in window)){els.forEach(el=>{el.classList.add('in','snap');setTimeout(()=>revealClean(el),90)});return}
  if(!revealIO){revealIO=new IntersectionObserver(entries=>{entries.forEach(en=>{if(!en.isIntersecting)return;const el=en.target;revealIO.unobserve(el);el.classList.add('in');el.addEventListener('transitionend',function h(ev){if(ev.propertyName==='transform'){revealClean(el);el.removeEventListener('transitionend',h)}});setTimeout(()=>revealClean(el),1600)})},{threshold:.05,rootMargin:'0px 0px -2% 0px'})}
  els.forEach(el=>revealIO.observe(el));
}
/* Theme: a saved choice ('aurelia-theme') wins; until one exists, the theme follows the device (prefers-color-scheme), including live system switches. The pre-paint resolution lives in the inline init in index.html. */
const themeBtn=$('themeBtn');
function syncThemeBtn(){const d=document.documentElement.dataset.theme==='dark';themeBtn.innerHTML=icon(d?'sun':'moon',16)+' '+(d?'Light':'Dark')}
syncThemeBtn();
themeBtn.addEventListener('click',()=>{const h=document.documentElement;h.classList.add('theme-anim');setTimeout(()=>h.classList.remove('theme-anim'),520);const d=h.dataset.theme!=='dark';h.dataset.theme=d?'dark':'light';try{localStorage.setItem('aurelia-theme',d?'dark':'light')}catch(e){}syncThemeBtn()});
/* Auto theme: follow live system switches only while no choice is saved. */
try{const schemeMq=matchMedia('(prefers-color-scheme: dark)');const followScheme=e=>{let saved=null;try{saved=localStorage.getItem('aurelia-theme')}catch(err){}if(saved)return;document.documentElement.dataset.theme=e.matches?'dark':'light';syncThemeBtn()};if(schemeMq.addEventListener)schemeMq.addEventListener('change',followScheme);else if(schemeMq.addListener)schemeMq.addListener(followScheme)}catch(e){}

/* ================= Job / progress system (v3) =================
   Every run goes through startJob/endJob: the button locks with a
   "Working…" label (no double-runs, no lost clicks with zero feedback),
   long jobs report real per-page progress, OCR + page loops can be
   cancelled, and ANY failure — sync or async — surfaces a friendly
   error and unlocks the button. A watchdog keeps the user informed
   instead of staring at a frozen bar. */
let busy=false, jobCancelled=false, jobWatchdog=null, ocrWorker=null, ocrCancelReject=null;
const JOB_LABELS={'scan':'Building your PDF…','merge':'Merging PDFs…','split':'Splitting PDF…','remove-pages':'Removing pages…','extract-pages':'Extracting pages…','organize':'Reordering pages…','rotate':'Rotating pages…','crop':'Cropping PDF…','compress':'Compressing PDF…','repair':'Repairing PDF…','ocr':'Reading text (OCR)…','images-to-pdf':'Building your PDF…','html-to-pdf':'Converting HTML…','word-to-pdf':'Converting Word file…','pdf-to-jpg':'Converting pages to JPG…','pdf-to-png':'Converting pages to PNG…','pdf-to-text':'Extracting text…','pdf-to-word':'Converting to Word…','pdf-to-excel':'Building spreadsheet…','pdf-to-markdown':'Converting to Markdown…','pdf-editor':'Saving your edited PDF…','edit-pdf':'Adding your text…','annotate':'Adding your note…','page-numbers':'Adding page numbers…','watermark':'Adding watermark…','sign-pdf':'Stamping your signature…','redact':'Redacting — flattening pages…','protect':'Encrypting PDF…','unlock':'Unlocking PDF…','metadata':'Saving metadata…','compare':'Comparing PDFs…','summarize':'Summarizing…'};
function cancelError(){const e=new Error('Cancelled.');e.__cancelled=true;return e}
function setProg(p,text){const w=$('progWrap');if(w)w.classList.remove('hidden');if(typeof p==='number'){$('progBar').style.width=Math.round(Math.min(1,Math.max(0,p))*100)+'%';const pr=$('progBar').parentElement;if(pr)pr.classList.remove('indet')}if(text)$('progText').textContent=text}
function tick(i,total,label){if(jobCancelled)throw cancelError();if(total>0)setProg(.05+.9*(i/total),(label||'Working')+' — '+i+' of '+total)}
function startJob(){busy=true;jobCancelled=false;const btn=$('processBtn');btn.disabled=true;btn.classList.remove('pulse');btn.textContent='Working…';$('resultBox').innerHTML='';setProg(.03,JOB_LABELS[current.id]||'Working…');$('status').textContent=JOB_LABELS[current.id]||'Working locally in your browser…';
  const cb=$('cancelBtn');if(cb)cb.classList.toggle('hidden',!CANCELLABLE.has(current.id));
  const pr0=$('progBar').parentElement;if(pr0)pr0.classList.add('indet');
  clearTimeout(jobWatchdog);jobWatchdog=setTimeout(()=>{if(busy)$('status').textContent='Still working — large files can take a while on this device. You can keep waiting, or Cancel and try a smaller file.'},45000)}
function endJob(){const pr1=$('progBar')&&$('progBar').parentElement;if(pr1)pr1.classList.remove('indet');$('cancelBtn')&&$('cancelBtn').classList.add('hidden');busy=false;clearTimeout(jobWatchdog);const btn=$('processBtn');btn.disabled=false;updateActionLabel()}
const CANCELLABLE=new Set(['scan','compress','pdf-to-jpg','pdf-to-png','ocr','images-to-pdf','unlock','pdf-to-word','pdf-to-excel','pdf-to-text','pdf-to-markdown','summarize','compare']);
$('cancelBtn').addEventListener('click',()=>{jobCancelled=true;$('status').textContent='Cancelling…';if(ocrWorker){const w=ocrWorker;ocrWorker=null;try{w.terminate()}catch(e){}}if(ocrCancelReject){const r=ocrCancelReject;ocrCancelReject=null;r(cancelError())}});
window.addEventListener('unhandledrejection',e=>{if(busy){const fe=friendlyError(e.reason);setErrorStatus(fe);setProg(0);$('progWrap').classList.add('hidden');endJob()}});
function setErrorStatus(fe){$('status').innerHTML=icon('triangle-alert',16)+' '+esc(fe)}
function friendlyError(e){const m=(e&&e.message)||'';
  if(e&&e.__cancelled)return 'Cancelled — nothing was changed.';
  if(!m.trim())return 'Something went wrong with that file. Please try a different PDF — or a smaller, simpler one.';
  if(/Incorrect password|PasswordException|Invalid password/i.test(m))return 'That password didn\'t work. Check it and try again.';
  if(/is encrypted|EncryptedPDF/i.test(m))return 'This PDF is password-protected. If you know the password, the Unlock PDF tool can take the protection off first.';
  if(/No password given/i.test(m))return 'This PDF needs its password — enter it above and try again.';
  if(m.length<140&&!/TypeError|Cannot read|Cannot access|undefined is|null is|is not a function|NetworkError|Failed to fetch|Failed to parse|Invalid PDF|No PDF header|offset|line:\s?\d|col:\s?\d|pdf-lib|EncryptedPDF|stack|https?:\/\/|fake worker|load script|importScripts/i.test(m))return m;
  return 'Something went wrong with that file. Please try a different PDF — or a smaller, simpler one.'}

/* ================= Tool setup & options ================= */
function optFieldHTML(o){
  if(o.type==='select')return `<div class="field"><label>${o.label}</label><select id="opt_${o.key}">${o.options.map(v=>{const val=typeof v==='object'?v.v:v,lab=typeof v==='object'?v.l:v;return `<option value="${esc(val)}" ${val===o.def?'selected':''}>${esc(lab)}</option>`}).join('')}</select></div>`;
  if(o.type==='posgrid')return `<div class="field"><label>${o.label}</label><div class="posgrid" id="posgrid_${o.key}" role="radiogroup" aria-label="${o.label}"></div><input type="hidden" id="opt_${o.key}" value="${o.def}"><p class="pos-sentence" id="possent_${o.key}"></p></div>`;
  if(o.type==='checkbox')return `<div class="field"><label class="checkline"><input id="opt_${o.key}" type="checkbox"> ${o.label}</label></div>`;
  if(o.type==='password')return `<div class="field"><label>${o.label}</label><div class="pwwrap"><input id="opt_${o.key}" type="password" value="" autocomplete="new-password"><button type="button" class="eye" data-eye="${o.key}" aria-label="Show or hide password">${icon('eye',18)}</button></div><div id="pwhelp_${o.key}"></div></div>`;
  return `<div class="field"><label>${o.label}</label><input id="opt_${o.key}" type="${o.type}" value="${o.def||''}" placeholder="${o.placeholder||o.label}"></div>`;
}
const POS_WORDS={'top-left':'top left','top-center':'top center','top-right':'top right','middle-left':'middle left','center':'center','middle-right':'middle right','bottom-left':'bottom left','bottom-center':'bottom center','bottom-right':'bottom right'};
const POS_DOTS={'top-left':[14,14],'top-center':[50,14],'top-right':[86,14],'middle-left':[14,50],'center':[50,50],'middle-right':[86,50],'bottom-left':[14,86],'bottom-center':[50,86],'bottom-right':[86,86]};
function buildPosGrid(o){const g=$('posgrid_'+o.key);if(!g)return;g.innerHTML=Object.keys(POS_DOTS).map(v=>{const[x,y]=POS_DOTS[v];return `<button type="button" role="radio" aria-checked="${v===o.def}" data-pos="${v}" class="${v===o.def?'sel':''}" title="${POS_WORDS[v]}"><span class="dot" style="left:calc(${x}% - 4px);top:calc(${y}% - 4px)"></span></button>`}).join('');
  g.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{g.querySelectorAll('button').forEach(x=>{x.classList.remove('sel');x.setAttribute('aria-checked','false')});b.classList.add('sel');b.setAttribute('aria-checked','true');$('opt_'+o.key).value=b.dataset.pos;updatePosSentence(o.key)}));updatePosSentence(o.key)}
function updatePosSentence(key){const s=$('possent_'+key);if(!s||!current)return;const v=opt(key);if(current.id==='page-numbers')s.textContent='Number '+(parseInt(opt('first'))||1)+' will be placed on '+POS_WORDS[v]+' of the first page.';else if(current.id==='watermark')s.textContent='The watermark will sit at the '+POS_WORDS[v]+' of every page.'}
function wirePasswordWidgets(){document.querySelectorAll('[data-eye]').forEach(b=>b.addEventListener('click',()=>{const inp=$('opt_'+b.dataset.eye);if(inp){inp.type=inp.type==='password'?'text':'password';b.innerHTML=icon(inp.type==='text'?'eye-off':'eye',18)}}));
  if(current.id!=='protect')return;const pw=$('opt_password'),cf=$('opt_confirm'),help=$('pwhelp_password');
  if(help)help.innerHTML='<ul class="strength"><li data-k="len">At least 8 characters</li><li data-k="num">A number</li><li data-k="up">An UPPERCASE letter</li><li data-k="low">a lowercase letter</li></ul>';
  const check=()=>{const v=pw.value;const rules={len:v.length>=8,num:/\d/.test(v),up:/[A-Z]/.test(v),low:/[a-z]/.test(v)};if(help)help.querySelectorAll('li').forEach(li=>li.classList.toggle('ok',!!rules[li.dataset.k]));
    const ch=$('pwhelp_confirm');if(ch){if(cf.value&&v!==cf.value)ch.innerHTML='<div class="pwmatch bad">Passwords don\'t match yet</div>';else if(cf.value&&v===cf.value)ch.innerHTML='<div class="pwmatch good">'+icon('check',14)+' Passwords match</div>';else ch.innerHTML=''}};
  if(pw)pw.addEventListener('input',check);if(cf)cf.addEventListener('input',check)}
const LAZY_FOR={'word-to-pdf':'mammoth','pdf-to-excel':'xlsx','ocr':'tesseract'};
function openTool(id){current=TOOLS.find(t=>t.id===id);files=[];scanState.clear();metaLoaded=false;if(!PAGE_TOOL){/* v4.6.1: the address bar takes the tool's clean path, exactly like
     its standalone page — never a hash. file:// (local QC harness only)
     cannot change path via the History API, so it keeps the legacy hash
     write there; production is https-only. */
    try{if(/^https?:$/.test(location.protocol))history.replaceState(null,'','/'+SLUGS[id]+'/');else history.replaceState(null,'','#/'+id)}catch(e){}}if(LAZY_FOR[id])loadLib(LAZY_FOR[id]).catch(()=>{});ensureToolLibs(id).catch(()=>{});/* v4.7.2: also prefetch this tool's core libraries in the background — opening a tool is the earliest signal of intent, and the fetch then overlaps choosing a file instead of blocking the run. */$('homeView').classList.add('hidden');$('toolView').classList.remove('hidden');
  $('toolTitle').innerHTML='<span class="title-ic">'+icon(current.icon,24)+'</span>'+esc(current.name);$('toolDesc').innerHTML=expandDesc(current.desc);
  const n=$('toolNote'); if(current.note){n.textContent=current.note;n.classList.toggle('tag',current.note.trim().split(/\s+/).length<=3);n.classList.remove('hidden')}else n.classList.add('hidden');
  $('fileInput').accept=current.accept;$('fileInput').multiple=!!current.multiple;
  $('acceptHint').textContent='Accepts: '+current.accept+(current.multiple?' · multiple files':' · single file')+' · works best under ~50 MB per file on phones';
  $('sigWrap').classList.toggle('hidden',!current.sig); if(current.sig){initSig();const sw=$('sigWrap'),vw=$('visualWrap');if(sw&&vw&&vw.parentNode&&vw.previousElementSibling!==sw)vw.parentNode.insertBefore(sw,vw)}
  let optsHtml=(current.opts||[]).map(optFieldHTML).join('');
  if(current.id==='scan')optsHtml='<div class="scan-actions"><label class="btn primary" for="scanCamInput">'+icon('camera',16)+' Take a photo</label><input id="scanCamInput" type="file" accept="image/*" capture="environment" class="hidden"><label class="btn secondary" for="fileInput">'+icon('plus',16)+' Add photos</label><p class="pm-hint">On a phone, “Take a photo” opens your camera. Your photos are processed on this device and never uploaded.</p></div>'+optsHtml;
  if(current.id==='metadata')optsHtml='<div class="meta-view" id="metaView">Choose a PDF above — its current title, author, subject & keywords will appear here, ready to edit.</div>'+optsHtml;
  $('toolOpts').innerHTML=optsHtml;
  (current.opts||[]).filter(o=>o.type==='posgrid').forEach(buildPosGrid);
  wirePasswordWidgets();
  if(current.id==='scan'){const ci=$('scanCamInput');if(ci)ci.addEventListener('change',e=>{addFiles([...e.target.files]);e.target.value=''})}
  if(current.id==='split'){const m=$('opt_mode');if(m)m.addEventListener('change',()=>{updateActionLabel();refreshToolInfo()})}
  if(current.id==='page-numbers'){const fnum=$('opt_first');if(fnum)fnum.addEventListener('input',()=>updatePosSentence('position'))}
  wrapAdvanced(); updateActionLabel(); refreshToolInfo();
  resetTool(false); window.scrollTo({top:0,behavior:'smooth'});}
function resetTool(clear=true){if(clear)files=[];renderFileList();clearVisual();$('resultBox').innerHTML='';$('status').textContent='';setProg(0);$('progWrap').classList.add('hidden');refreshToolInfo();if(clear)$('fileInput').value=''}
function opt(k){const el=$('opt_'+k);if(!el)return '';return el.type==='checkbox'?el.checked:el.value}
const dz=$('dropZone');['dragover','dragenter'].forEach(e=>dz.addEventListener(e,ev=>{ev.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(e=>dz.addEventListener(e,ev=>{ev.preventDefault();dz.classList.remove('drag')}));
dz.addEventListener('drop',e=>addFiles([...e.dataTransfer.files]));
/* The whole dropzone is the button (audit fix #8): tapping anywhere in the
   dashed box opens the picker — the label inside already triggers it, so
   skip clicks that land on the label to avoid a double-open. */
dz.addEventListener('click',e=>{if(e.target.closest('label')||e.target===$('fileInput'))return;$('fileInput').click()});
dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click()}});
$('fileInput').addEventListener('change',e=>{addFiles([...e.target.files]);e.target.value=''});
function addFiles(list){if(!list||!list.length)return;const acc=((current&&current.accept)||'').split(',').map(a=>a.trim().toLowerCase()).filter(Boolean);
  const bad=acc.length?list.find(f=>!acc.some(a=>f.name.toLowerCase().endsWith(a))):null;
  if(bad){const ext=(bad.name.split('.').pop()||'').toUpperCase();toast('That tool needs '+acc.map(a=>a.replace('.','').toUpperCase()).join(' or ')+' — \u201c'+bad.name+'\u201d is a '+ext+' file, so it was not added.')}
  const good=acc.length?list.filter(f=>acc.some(a=>f.name.toLowerCase().endsWith(a))):list.slice();
  if(!good.length)return;
  const big=good.find(f=>f.size>100*1048576),big50=good.find(f=>f.size>50*1048576);
  if(big)toast('\u201c'+big.name+'\u201d is very large ('+fmt(big.size)+') — processing may be slow or run out of memory on this device.');
  else if(big50)toast('\u201c'+big50.name+'\u201d is '+fmt(big50.size)+' — large files can be slow on a phone. Works best under ~50 MB per file.');
  files=current&&current.multiple?files.concat(good):good.slice(0,1);renderFileList();onFilesChanged()}
/* ---------- File cards: real first-page thumbnail + page count (benchmark A) ---------- */
const probeCache=new WeakMap();
function probePdf(f){if(probeCache.has(f))return probeCache.get(f);const p=(async()=>{try{await ensurePdfJs();const raw=await bytes(f);const pdf=await GD({data:raw.slice()}).promise;let thumb='';try{const pg=await pdf.getPage(1);const base=pg.getViewport({scale:1});const vp=pg.getViewport({scale:176/base.width});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;thumb=c.toDataURL('image/jpeg',.82)}catch(e){}return{pages:pdf.numPages,thumb}}catch(e){return{pages:0,thumb:''}}})();probeCache.set(f,p);return p}
function renderFileList(){const el=$('fileList');if(!el)return;if(!files.length){el.innerHTML='';return}const multi=current&&current.multiple;
  el.innerHTML=files.map((f,i)=>{const isImg=/\.(jpe?g|png|webp)$/i.test(f.name)||/^image\//.test(f.type);const isPdf=/\.pdf$/i.test(f.name);
    return `<div class="fileitem" data-idx="${i}">${isPdf?`<img class="fthumb" data-thumb alt="">`:isImg?`<img class="fthumb" data-thumb src="${URL.createObjectURL(f)}" alt=""${current&&current.id==='scan'?` style="transform:rotate(${((scanState.get(f)||{}).rot||0)}deg)"`:''}>`:`<span class="fthumb-ic">${icon(current?current.icon:'file-text',24)}</span>`}<span class="fname" title="${esc(f.name)}">${i+1}. ${esc(f.name)}<span class="fmeta" data-meta>${fmt(f.size)}</span></span><span class="fbtns">${current&&current.id==='scan'?`<button type="button" class="chipbtn" title="Rotate this page 90 degrees" onclick="rotateScanFile(${i})">${icon('rotate-cw',15)}</button>`:''}${multi&&files.length>1?`<button type="button" class="chipbtn" title="Move up" onclick="moveFile(${i},-1)">${icon('arrow-up',15)}</button><button type="button" class="chipbtn" title="Move down" onclick="moveFile(${i},1)">${icon('arrow-down',15)}</button>`:''}<button type="button" class="chipbtn rm" title="Remove file" onclick="removeFile(${i})">${icon('x',15)}</button></span></div>`}).join('')
  +`<div class="filebar"><span id="fileCount">${files.length} file${files.length>1?'s':''} ready</span><button type="button" class="chipbtn wide" onclick="resetTool()">${icon('x',15)} Clear all</button>${multi?`<label class="btn secondary addmore" for="fileInput">${icon('plus',15)} Add more files</label>`:''}</div>`;
  files.forEach((f,i)=>{if(!/\.pdf$/i.test(f.name))return;probePdf(f).then(info=>{if(files[i]!==f)return;const item=el.querySelector(`.fileitem[data-idx="${i}"]`);if(!item)return;const img=item.querySelector('[data-thumb]');if(img&&info.thumb)img.src=info.thumb;const meta=item.querySelector('[data-meta]');if(meta&&info.pages)meta.textContent=fmt(f.size)+' · '+info.pages+' page'+(info.pages>1?'s':'');refreshToolInfo()})});
  updateActionLabel()}
function removeFile(i){files.splice(i,1);renderFileList();onFilesChanged()}
function moveFile(i,d){const j=i+d;if(j<0||j>=files.length)return;const t=files[i];files[i]=files[j];files[j]=t;renderFileList();onFilesChanged()}
function download(blob,name,label,cls){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  if(cls){a.className=cls;a.textContent=label||('Download '+name);$('resultBox').appendChild(a);return a}
  a.innerHTML=icon('download',18)+' '+(label||('Download '+name));a.className='btn dlbtn';const b=document.createElement('div');b.className='dlrow';b.appendChild(a);const s=document.createElement('span');s.className='dlmeta';s.textContent=fmt(blob.size);b.appendChild(s);$('resultBox').appendChild(b);return a}
/* Result panel (benchmark C): tool-specific success line, sizes, a
   "Continue to" row of related tools, and the privacy line. The download
   anchor stays the FIRST <a> in #resultBox. */
const SUCCESS_LINES={'scan':()=>'Your PDF is ready!','merge':()=>'PDFs merged!','split':()=>'PDF split!','remove-pages':m=>m,'extract-pages':()=>'Pages extracted!','organize':()=>'Pages reorganized!','rotate':()=>'Pages rotated!','crop':()=>'PDF cropped!','compress':()=>'PDF compressed!','repair':()=>'PDF repaired!','ocr':()=>'Text recognized!','images-to-pdf':()=>'Your PDF is ready!','html-to-pdf':()=>'Your PDF is ready!','word-to-pdf':()=>'Your PDF is ready!','pdf-to-jpg':()=>'Images created!','pdf-to-png':()=>'Images created!','pdf-to-text':()=>'Text extracted!','pdf-to-word':()=>'Word file created!','pdf-to-excel':()=>'Spreadsheet created!','pdf-to-markdown':()=>'Markdown created!','pdf-editor':m=>m,'edit-pdf':()=>'Text added!','annotate':()=>'Note added!','page-numbers':()=>'Page numbers added!','watermark':()=>'Watermark added!','sign-pdf':()=>'Document signed!','redact':()=>'Redaction complete — the hidden text is gone for good.','protect':()=>'PDF protected!','unlock':()=>'PDF unlocked!','metadata':()=>'Metadata saved!','compare':()=>'Comparison ready!','summarize':()=>'Summary ready!'};
function done(msg,extraHtml,headOpt){setProg(1,'Done');$('status').textContent=msg;toast(msg);
  const rb=$('resultBox');const head=document.createElement('div');head.className='result-head';head.innerHTML=icon(headOpt&&headOpt.icon?headOpt.icon:'circle-check',22)+' '+esc(headOpt&&headOpt.text?headOpt.text:(SUCCESS_LINES[current.id]||(()=> 'Done!'))(msg));if(headOpt&&headOpt.flat){const hi=head.querySelector('svg');if(hi)hi.style.color='var(--muted)'}rb.insertBefore(head,rb.firstChild);
  if(extraHtml){const x=document.createElement('div');x.className='result-extra';x.innerHTML=extraHtml;rb.appendChild(x)}
  const rel=TOOLS.filter(t=>t.cat===current.cat&&t.id!==current.id).slice(0,4);
  const cont=document.createElement('div');cont.className='continue';cont.innerHTML='<span class="cont-label">Continue to</span>'+rel.map(t=>PAGE_TOOL?`<a class="cont-chip" href="/${SLUGS[t.id]}/">${icon(t.icon,15)} ${t.name}</a>`:`<button type="button" class="cont-chip" onclick="openTool('${t.id}')">${icon(t.icon,15)} ${t.name}</button>`).join('')+`<button type="button" class="cont-chip" onclick="resetTool()">${icon('rotate-ccw',15)} New task</button>`;rb.appendChild(cont);
  const pv=document.createElement('p');pv.className='privacy-note';pv.innerHTML=icon('lock',13)+' Processed 100% locally — your file never left this device.';rb.appendChild(pv)}
function infoDone(msg){setProg(0);$('progWrap').classList.add('hidden');$('status').textContent=msg;toast(msg)}
async function bytes(f){return new Uint8Array(await f.arrayBuffer())}
function parseRanges(str,total){const out=new Set(); if(!str||!str.trim())return null; str.split(',').map(s=>s.trim()).filter(Boolean).forEach(p=>{if(p.includes('-')){let[a,b]=p.split('-').map(x=>parseInt(x)); if(isNaN(a))a=1; if(isNaN(b)||p.trim().endsWith('-'))b=total; for(let i=Math.max(1,a);i<=Math.min(total,b);i++)out.add(i-1)}else{const n=parseInt(p);if(n>=1&&n<=total)out.add(n-1)}});return [...out].sort((a,b)=>a-b)}
function wrapText(text,font,size,maxW){const words=text.split(/\s+/);const lines=[];let line='';for(const w of words){const t=line?line+' '+w:w;if(font.widthOfTextAtSize(t,size)>maxW&&line){lines.push(line);line=w}else line=t}if(line)lines.push(line);return lines}
async function textToPdfDoc(text,title='Document'){const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);let page=doc.addPage([595,842]);let y=800;const addPage=()=>{page=doc.addPage([595,842]);y=800}; text.split(/\n/).forEach(raw=>{const lines=raw===''?['']:wrapText(raw,font,11,495);lines.forEach(l=>{if(y<50)addPage();page.drawText(l,{x:50,y,size:11,font,color:rgb(.1,.1,.1)});y-=16})});doc.setTitle(title);return doc}
async function extractText(pdfBytes,onProg){const pdf=await GD({data:pdfBytes.slice()}).promise;let pages=[];for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();let lastY=null,lastEndX=null,line='',lines=[];tc.items.forEach(it=>{const y=it.transform[5];if(lastY!==null&&Math.abs(y-lastY)>2){lines.push(line);line='';lastEndX=null}
    /* Preserve wide horizontal gaps as multi-space breaks so PDF to Excel can
       split columns on them (audit fix #7); normal word gaps stay one space. */
    if(lastEndX!==null){const fontH=Math.hypot(it.transform[1],it.transform[3])||10;const gap=it.transform[4]-lastEndX;if(gap>fontH*.8)line+='   '}
    line+=it.str+' ';lastY=y;lastEndX=it.transform[4]+(it.width||0)});if(line)lines.push(line);pages.push(lines.join('\n'));if(onProg)onProg(i,pdf.numPages)}return pages}
async function firstPagePreview(pdfBytes){try{const pdf=await GD({data:pdfBytes.slice()}).promise;const pg=await pdf.getPage(1);const vp=pg.getViewport({scale:1.3});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:cx,viewport:vp}).promise;const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));if(!blob)return '';return '<figure class="wm-preview"><img src="'+URL.createObjectURL(blob)+'" alt="Preview of page 1 with your watermark"><figcaption>Page 1 with your watermark — your download looks exactly like this.</figcaption></figure>'}catch(e){return ''}}
async function renderPages(pdfBytes,scale=2,type='image/jpeg',quality=.85,onProg){const pdf=await GD({data:pdfBytes.slice()}).promise;const out=[];for(let i=1;i<=pdf.numPages;i++){if(jobCancelled)throw cancelError();const pg=await pdf.getPage(i);const vp=pg.getViewport({scale});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;out.push(await new Promise(r=>c.toBlob(r,type,quality)));if(onProg)onProg(i,pdf.numPages)}return out}
function baseName(f){return f.name.replace(/\.[^.]+$/,'')}

/* ================= Signature: draw / type / upload, transparent art =================
   The stamped image is sigArt — an offscreen canvas cropped to the ink, with a
   TRANSPARENT background (the pad is never filled), so no white box can land
   on the document. Draw, Type and Upload all produce sigArt. */
let sigCtx, sigArt=null, sigDrawn=false, sigPenColor='#111111', sigTypeFont="'Segoe Script','Brush Script MT',cursive", sigTypeColor='#111111', sigWired=false;
function cropToInk(src,padPx=8){try{const w=src.width,h=src.height;if(!w||!h)return null;const g=src.getContext('2d');const d=g.getImageData(0,0,w,h).data;let minX=w,minY=h,maxX=-1,maxY=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(d[(y*w+x)*4+3]>10){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}}if(maxX<0)return null;minX=Math.max(0,minX-padPx);minY=Math.max(0,minY-padPx);maxX=Math.min(w-1,maxX+padPx);maxY=Math.min(h-1,maxY+padPx);const out=document.createElement('canvas');out.width=maxX-minX+1;out.height=maxY-minY+1;out.getContext('2d').drawImage(src,minX,minY,out.width,out.height,0,0,out.width,out.height);return out}catch(e){return src}}
function setSigArt(canvas){sigArt=canvas;sigDrawn=!!canvas;const ss=$('signSize');if(ss)ss.disabled=!sigDrawn;if(ed&&ed.kind==='sign-pdf')drawEdOverlay();updateActionLabel()}
function refreshSigArtFromPad(){const c=$('sigpad');if(!c)return;setSigArt(cropToInk(c))}
function initSig(){const c=$('sigpad');if(!c)return;sigCtx=c.getContext('2d');sigCtx.lineWidth=3;sigCtx.lineCap='round';sigCtx.lineJoin='round';sigCtx.strokeStyle=sigPenColor;let down=false,last;
  const pos=e=>{const r=c.getBoundingClientRect();const p=e.touches?e.touches[0]:e;return{x:(p.clientX-r.left)*(c.width/r.width),y:(p.clientY-r.top)*(c.height/r.height)}};
  const strokeMove=e=>{if(!down)return;const p=pos(e);sigCtx.beginPath();sigCtx.moveTo(last.x,last.y);sigCtx.lineTo(p.x,p.y);sigCtx.stroke();last=p;if(e.cancelable)e.preventDefault()};
  const strokeEnd=()=>{if(!down)return;down=false;window.removeEventListener('mousemove',strokeMove);window.removeEventListener('mouseup',strokeEnd);window.removeEventListener('touchmove',strokeMove);window.removeEventListener('touchend',strokeEnd);refreshSigArtFromPad()};
  // Move/up are tracked on the WINDOW during a stroke: if the layout shifts
  // mid-draw (a heavy preview finishing rendering above the pad), the stroke
  // still completes instead of silently losing its end.
  c.onmousedown=c.ontouchstart=e=>{down=true;last=pos(e);e.preventDefault();window.addEventListener('mousemove',strokeMove);window.addEventListener('mouseup',strokeEnd);window.addEventListener('touchmove',strokeMove,{passive:false});window.addEventListener('touchend',strokeEnd)};
  if(sigWired)return;sigWired=true;
  document.querySelectorAll('.sigtab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.sigtab').forEach(x=>{const on=x===b;x.classList.toggle('sel',on);x.setAttribute('aria-pressed',on?'true':'false')});$('sigDrawPane').classList.toggle('hidden',b.dataset.sigtab!=='draw');$('sigTypePane').classList.toggle('hidden',b.dataset.sigtab!=='type');$('sigUploadPane').classList.toggle('hidden',b.dataset.sigtab!=='upload')}));
  document.querySelectorAll('[data-sigcolor]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-sigcolor]').forEach(x=>x.classList.toggle('sel',x===b));sigPenColor=b.dataset.sigcolor;if(sigCtx)sigCtx.strokeStyle=sigPenColor}));
  document.querySelectorAll('[data-sigfont]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-sigfont]').forEach(x=>x.classList.toggle('sel',x===b));sigTypeFont=b.dataset.sigfont;syncSigTypePrev()}));
  document.querySelectorAll('[data-sigtype-color]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-sigtype-color]').forEach(x=>x.classList.toggle('sel',x===b));sigTypeColor=b.dataset.sigtypeColor;syncSigTypePrev()}));
  const nm=$('sigName');if(nm)nm.addEventListener('input',syncSigTypePrev);
  const use=$('sigTypeUse');if(use)use.addEventListener('click',()=>{const name=(nm?nm.value:'').trim();if(!name){toast('Type your name first.');return}const t=document.createElement('canvas');const g=t.getContext('2d');const size=110;g.font=size+'px '+sigTypeFont;const w=Math.max(10,Math.ceil(g.measureText(name).width));t.width=w+24;t.height=size*1.5;const g2=t.getContext('2d');g2.font=size+'px '+sigTypeFont;g2.fillStyle=sigTypeColor;g2.textBaseline='middle';g2.fillText(name,12,t.height/2);setSigArt(cropToInk(t,6)||t);toast('Signature ready — drag it into place on the preview above.')});
  const sf=$('sigFile');if(sf)sf.addEventListener('change',()=>{const f=sf.files&&sf.files[0];if(!f)return;const img=new Image();img.onload=()=>{const t=document.createElement('canvas');const maxW=900;const sc=Math.min(1,maxW/img.width);t.width=Math.round(img.width*sc);t.height=Math.round(img.height*sc);t.getContext('2d').drawImage(img,0,0,t.width,t.height);setSigArt(cropToInk(t,6)||t);URL.revokeObjectURL(img.src);toast('Signature image ready — drag it into place on the preview above.')};img.src=URL.createObjectURL(f);sf.value=''});
}
function syncSigTypePrev(){const p=$('sigTypePrev');if(!p)return;const name=($('sigName')&&$('sigName').value.trim())||'Your name';p.textContent=name;p.style.fontFamily=sigTypeFont;p.style.color=sigTypeColor}
function clearSig(){const c=$('sigpad');sigCtx&&sigCtx.clearRect(0,0,c.width,c.height);setSigArt(null)}

/* ================= Visual page manager + placement editors =================
   All overlay positions are stored as fractions of the page (0..1), so preview
   size / device width never matter. PDF y-axis is flipped at stamp time:
   pdfY = pageH - (fy + fh) * pageH. Placement assumes page rotation 0 —
   pages with existing rotation are an edge limit (noted in TEST-REPORT). */
const VISUAL_PM={'remove-pages':'remove','extract-pages':'extract','organize':'organize','rotate':'rotate'};
const EDITOR_TOOLS=['crop','sign-pdf','edit-pdf','annotate','redact','pdf-editor'];
let pm=null, ed=null, pe=null, peFail=null, visualSeq=0;
/* clearVisual is the chokepoint where pm/ed state dies — Reset and
   last-file removal both pass through here, and renderFileList's empty
   branch never refreshes the label. Recompute the action label from the
   cleared state, or state-dependent labels (Redact's "Cover N area(s)",
   Merge's "Merge N PDFs", selection counts…) keep their stale text. */
function clearVisual(){visualSeq++;pm=null;ed=null;pe=null;peFail=null;const w=$('visualWrap');if(w){w.innerHTML='';w.classList.add('hidden')}updateActionLabel()}
function onFilesChanged(){if(!current)return;const needs=VISUAL_PM[current.id]||current.id==='split'||EDITOR_TOOLS.includes(current.id);if(needs&&files.length&&/\.pdf$/i.test(files[0].name))buildVisual();else if(!files.length)clearVisual();
  if(current.id==='metadata'&&files.length)loadMetadataView();refreshToolInfo()}
async function loadMetadataView(){const view=$('metaView');if(!view||!files.length)return;metaLoaded=false;try{await ensurePdfLib();const doc=await PDFDocument.load(await bytes(files[0]));const cur={title:doc.getTitle()||'',author:doc.getAuthor()||'',subject:doc.getSubject()||'',keywords:doc.getKeywords()||''};metaLoaded=true;
  view.innerHTML='<strong>Currently stored in this PDF:</strong><br>Title: '+(esc(cur.title)||'<em>— empty —</em>')+'<br>Author: '+(esc(cur.author)||'<em>— empty —</em>')+'<br>Subject: '+(esc(cur.subject)||'<em>— empty —</em>')+'<br>Keywords: '+(esc(cur.keywords)||'<em>— empty —</em>')+'<br><span style="color:var(--muted)">The fields below are filled in with these values — edit them, blank a field to clear it, then save.</span>';
  const set=(k,v)=>{const el=$('opt_'+k);if(el)el.value=v};set('title',cur.title);set('author',cur.author);set('subject',cur.subject);set('keywords',cur.keywords)}catch(e){view.textContent='Could not read this PDF\'s metadata — it may be damaged or password-protected.'}}
function refreshToolInfo(){const el=$('toolInfo');if(!el||!current)return;let txt='';
  // Page count arrives asynchronously via the file-card probe; read it back
  // from the card's meta line ("1.0 MB · 14 pages") once it lands.
  const metaEl=document.querySelector('.fileitem [data-meta]');const m=metaEl?/· (\d+) page/.exec(metaEl.textContent):null;const pages=m?parseInt(m[1]):0;
  if(current.id==='pdf-to-jpg'&&pages)txt=pages+' JPG image'+(pages>1?'s':'')+' will be created — one per page'+(pages>1?', delivered as a ZIP file.':'.');
  else if(current.id==='pdf-to-png'&&pages)txt=pages+' PNG image'+(pages>1?'s':'')+' will be created — one per page'+(pages>1?', delivered as a ZIP file.':'.');
  else if(current.id==='split'&&pages){const mode=opt('mode');if(mode==='each')txt=pages+' PDFs will be created — one per page, delivered as a ZIP file.';else if(mode==='pick')txt='Tap pages in the preview — the ones you pick are combined into 1 PDF.'}
  el.textContent=txt;el.classList.toggle('hidden',!txt)}
/* ---------- Plain labels, collapsed advanced, friendly errors ---------- */
const HIDE_OPTS={'remove-pages':['pages'],'extract-pages':['pages'],'organize':['order'],'rotate':['angle','pages'],'edit-pdf':['page'],'annotate':['page'],'redact':['page'],'split':['ranges'],'crop':['left','right','top','bottom']};
function wrapAdvanced(){if(!current)return;const hide=HIDE_OPTS[current.id];if(!hide)return;const box=$('toolOpts');if(!box)return;
  const fields=[...box.querySelectorAll('.field')].filter(f=>{const inp=f.querySelector('input,select,textarea');return inp&&hide.includes(inp.id.replace('opt_',''))});
  if(!fields.length)return;const det=document.createElement('details');det.className='adv';det.innerHTML='<summary>Advanced options — type instead of tapping</summary>';
  const grid=document.createElement('div');grid.className='opts';fields.forEach(f=>grid.appendChild(f));det.appendChild(grid);box.appendChild(det)}
function updateActionLabel(){const btn=$('processBtn');if(!btn||!current||busy)return;const n=files.length;const sel=pm?pm.sel.size:0;let label=current.name;
  if(current.id==='merge')label=n>1?'Merge '+n+' PDFs':'Merge PDF';
  else if(current.id==='remove-pages')label=sel?'Remove '+sel+' page'+(sel>1?'s':''):'Remove pages';
  else if(current.id==='extract-pages')label=sel?'Extract '+sel+' page'+(sel>1?'s':''):'Extract pages';
  else if(current.id==='split'){const m=opt('mode');label=m==='pick'?(sel?'Extract '+sel+' pages as one PDF':'Extract picked pages'):'Split PDF'}
  else if(current.id==='organize')label='Save new order';
  else if(current.id==='rotate')label=(pm&&Object.values(pm.rot).some(a=>a))?'Save rotated PDF':'Rotate all pages';
  else if(current.id==='sign-pdf')label='Place signature & download';
  else if(current.id==='pdf-editor')label='Save edited PDF';
  else if(current.id==='edit-pdf')label='Add text & download';
  else if(current.id==='annotate')label='Add note & download';
  else if(current.id==='redact')label=ed&&ed.boxes.length?'Cover '+ed.boxes.length+' area'+(ed.boxes.length>1?'s':'')+' & download':'Cover areas & download';
  else if(current.id==='scan')label=n?'Make PDF from '+n+' photo'+(n>1?'s':''):'Make PDF';
  else if(current.id==='images-to-pdf')label=n>1?'Make PDF from '+n+' images':'Make PDF';
  else if(current.id==='compare')label='Compare the 2 PDFs';
  btn.textContent=label;btn.classList.toggle('pulse',n>0);if(current.id!=='pdf-editor')btn.disabled=false;const pfh=$('preFileHint');if(pfh)pfh.classList.toggle('hidden',n>0)}
async function buildVisual(){
  const seq=++visualSeq;pm=null;ed=null;pe=null;peFail=null;const w=$('visualWrap');if(!w)return;const wasHidden=w.classList.contains('hidden');w.classList.remove('hidden');w.innerHTML='<p class="vload">Rendering page previews…</p>';
  try{await ensurePdfJs()}catch(e){if(seq===visualSeq)w.innerHTML='<p class="vload">The preview library could not be loaded — check your connection and reload the page.</p>';return}
  let pdf;try{const raw=await bytes(files[0]);pdf=await GD({data:raw.slice()}).promise}catch(e){if(seq===visualSeq){const pwErr=e&&(e.name==='PasswordException'||/password/i.test(e.message||''));
    if(current&&current.id==='pdf-editor'){peFail=pwErr?'password':'render';w.innerHTML='<p class="vload">'+(pwErr?'This PDF is password-protected, so the editor can\u2019t open it. If you know the password, take the protection off with the Unlock PDF tool first — then editing works as normal.':'Could not render a preview of this file, so the editor can\u2019t open it. The file may be damaged — the Repair PDF tool may help.')+'</p>'}
    else w.innerHTML='<p class="vload">'+(pwErr?'This PDF is password-protected. If the tool has a password field, enter it there — or take the protection off first with the Unlock PDF tool.':'Could not render previews for this file. The options below still work.')+'</p>'}return}
  if(seq!==visualSeq||!current)return;
  if(VISUAL_PM[current.id])buildPageManager(pdf,VISUAL_PM[current.id]);
  else if(current.id==='split'){buildPageManager(pdf,'pick');const m=$('opt_mode');if(m)m.addEventListener('change',updateActionLabel)}
  else if(current.id==='pdf-editor')buildPdfEditor(pdf);
  else buildEditor(pdf,current.id);
  updateActionLabel();
  if(wasHidden)setTimeout(()=>{const vw=$('visualWrap');if(vw&&visualSeq===seq)vw.scrollIntoView({behavior:'smooth',block:'start'})},80);
}
/* ---------- Page Manager (Remove / Extract / Organize / Rotate / Split-pick) ---------- */
function buildPageManager(pdf,mode){
  pm={mode,pdf,count:pdf.numPages,sel:new Set(),order:[...Array(pdf.numPages).keys()],rot:{},deleted:new Set(),blanks:0,rendered:new Set(),thumbEls:{}};
  const hints={remove:'Tap pages to mark them for removal.',extract:'Tap pages to extract.',organize:'Drag thumbnails — or use '+icon('chevron-left',13)+' '+icon('chevron-right',13)+' — to reorder. Tap '+icon('trash-2',13)+' to take a page out, or add a blank page.',rotate:'Tap '+icon('rotate-cw',13)+' on a page to rotate just that page 90°.',pick:'If “How to split” is set to “Pick pages”, tap the pages to pull out together as one PDF.'};
  $('visualWrap').innerHTML=`<div class="pm"><div class="pm-toolbar"><strong>Pages (${pm.count})</strong><span class="pm-hint">${hints[mode]||''}</span>${(mode==='remove'||mode==='extract'||mode==='pick')?'<button type="button" class="chipbtn wide" onclick="pmSelectAll()">Select all</button><button type="button" class="chipbtn wide" onclick="pmClearSel()">Clear</button>':''}${mode==='organize'?'<button type="button" class="chipbtn wide" onclick="pmAddBlank()">+ Add blank page</button>':''}<span id="pmSelInfo" class="pm-info"></span></div><div class="thumbgrid mode-${mode}" id="thumbGrid"></div></div>`;
  const grid=$('thumbGrid');
  for(let i=0;i<pm.count;i++)grid.appendChild(makeThumb(i));
  pmSync();pmInfo();
  if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting){renderThumb(parseInt(en.target.dataset.idx));io.unobserve(en.target)}})},{rootMargin:'240px'});Object.values(pm.thumbEls).forEach(d=>{if(d.dataset.idx>=0)io.observe(d)})}else for(let i=0;i<pm.count;i++)renderThumb(i);
}
function makeThumb(i){const mode=pm.mode;const d=document.createElement('div');d.className='thumb';d.dataset.idx=i;
  d.innerHTML=`<div class="thumb-wrap"><canvas></canvas><div class="thumb-fallback" style="display:none">${icon('file',30)}<span>Preview unavailable</span></div>${mode==='remove'?'<div class="thumb-x">'+icon('x',46)+'</div>':''}${(mode==='extract'||mode==='pick')?'<div class="thumb-check">'+icon('check',38)+'</div>':''}${mode==='rotate'?'<button type="button" class="rotbtn" title="Rotate this page 90°">'+icon('rotate-cw',18)+'</button>':''}${mode==='organize'?'<button type="button" class="thumb-del" title="Remove this page from the new document">'+icon('trash-2',15)+'</button>':''}</div>${mode==='organize'?'<div class="thumb-move"><button type="button" class="chipbtn" data-mv="-1" title="Move earlier">'+icon('chevron-left',15)+'</button><button type="button" class="chipbtn" data-mv="1" title="Move later">'+icon('chevron-right',15)+'</button></div>':''}<div class="thumb-label">Page ${i+1}</div>`;
  pm.thumbEls[i]=d;
  if(mode==='remove'||mode==='extract'||mode==='pick'){d.addEventListener('click',()=>{if(pm.sel.has(i))pm.sel.delete(i);else pm.sel.add(i);d.classList.toggle('sel',pm.sel.has(i));pmSync();pmInfo()})}
  if(mode==='rotate'){d.querySelector('.rotbtn').addEventListener('click',ev=>{ev.stopPropagation();pm.rot[i]=((pm.rot[i]||0)+90)%360;d.querySelector('canvas').style.transform='rotate('+pm.rot[i]+'deg)';pmInfo()})}
  if(mode==='organize'){d.querySelectorAll('[data-mv]').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();moveThumb(i,parseInt(b.dataset.mv))}));d.querySelector('.thumb-del').addEventListener('click',ev=>{ev.stopPropagation();pmToggleDelete(i)});attachThumbDrag(d)}
  return d}
/* V4.6.1: thumbnail renders are SERIALIZED through one promise chain and
   retried once. The old code fired every visible page render at once and
   swallowed any failure in an empty catch after marking the page rendered —
   on a phone with a 21+ page file, one dropped render left a permanently
   empty white box (Safwan's Page 20). Renders now happen at 300px wide
   (>= 2x the card's CSS width, retina-crisp), and a page that genuinely
   fails twice shows the in-card "Preview unavailable" fallback instead of
   an empty box. */
let pmRenderChain=Promise.resolve();
function renderThumb(i){if(!pm||i<0||pm.rendered.has(i))return;pm.rendered.add(i);const job=async()=>{const el=pm&&pm.thumbEls?pm.thumbEls[i]:null;if(!el)return;let ok=false;for(let attempt=0;attempt<2&&!ok;attempt++){try{const pg=await pm.pdf.getPage(i+1);const base=pg.getViewport({scale:1});const vp=pg.getViewport({scale:300/base.width});const c=el.querySelector('canvas');if(!c)break;c.width=Math.max(1,Math.round(vp.width));c.height=Math.max(1,Math.round(vp.height));await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;if(c.width>0&&c.height>0)ok=true}catch(e){}}if(!ok){pm.rendered.delete(i);const c=el.querySelector('canvas');if(c)c.style.display='none';const fb=el.querySelector('.thumb-fallback');if(fb)fb.style.display='grid'}};pmRenderChain=pmRenderChain.then(job,job)}
function pmToggleDelete(i){if(!pm)return;if(pm.deleted.has(i)){pm.deleted.delete(i);pm.thumbEls[i].classList.remove('deleted')}else{pm.deleted.add(i);pm.thumbEls[i].classList.add('deleted')}pmSync();pmInfo()}
function pmAddBlank(){if(!pm)return;pm.blanks++;const id=-pm.blanks;const d=document.createElement('div');d.className='thumb';d.dataset.idx=id;
  d.innerHTML=`<div class="thumb-wrap"><div class="thumb-blank">${icon('file',32)}</div><button type="button" class="thumb-del" title="Remove this blank page">${icon('trash-2',15)}</button></div><div class="thumb-move"><button type="button" class="chipbtn" data-mv="-1" title="Move earlier">${icon('chevron-left',15)}</button><button type="button" class="chipbtn" data-mv="1" title="Move later">${icon('chevron-right',15)}</button></div><div class="thumb-label">Blank page</div>`;
  pm.thumbEls[id]=d;pm.order.push(id);$('thumbGrid').appendChild(d);
  d.querySelectorAll('[data-mv]').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();moveThumb(id,parseInt(b.dataset.mv))}));
  d.querySelector('.thumb-del').addEventListener('click',ev=>{ev.stopPropagation();pm.order=pm.order.filter(x=>x!==id);delete pm.thumbEls[id];d.remove();pmSync();pmInfo()});
  attachThumbDrag(d);pmSync();pmInfo()}
function pmSync(){if(!pm)return;const sorted=[...pm.sel].sort((a,b)=>a-b).map(i=>i+1).join(',');
  if(pm.mode==='remove'||pm.mode==='extract'){const el=$('opt_pages');if(el)el.value=sorted}
  if(pm.mode==='organize'){const el=$('opt_order');if(el)el.value=pm.order.filter(i=>i>=0&&!pm.deleted.has(i)).map(i=>i+1).join(',')}}
function pmInfo(){if(!pm)return;const el=$('pmSelInfo');if(!el)return;let t='';
  if(pm.mode==='remove')t=pm.sel.size?pm.sel.size+' marked for removal':'None marked';
  else if(pm.mode==='extract'||pm.mode==='pick')t=pm.sel.size?pm.sel.size+' selected':'None selected';
  else if(pm.mode==='rotate'){const n=Object.values(pm.rot).filter(a=>a).length;t=n?n+' page(s) rotated':''}
  else if(pm.mode==='organize'){const kept=pm.order.filter(i=>i<0||!pm.deleted.has(i));t='New document: '+kept.length+' page'+(kept.length===1?'':'s')+(pm.deleted.size?' · '+pm.deleted.size+' removed':'')}
  el.textContent=t;updateActionLabel()}
function pmSelectAll(){if(!pm)return;for(let i=0;i<pm.count;i++){pm.sel.add(i);pm.thumbEls[i].classList.add('sel')}pmSync();pmInfo()}
function pmClearSel(){if(!pm)return;pm.sel.clear();Object.values(pm.thumbEls).forEach(d=>d.classList.remove('sel'));pmSync();pmInfo()}
function moveThumb(pageIdx,dir){if(!pm)return;const pos=pm.order.indexOf(pageIdx);const j=pos+dir;if(j<0||j>=pm.order.length)return;const t=pm.order[pos];pm.order[pos]=pm.order[j];pm.order[j]=t;const grid=$('thumbGrid');pm.order.forEach(pi=>grid.appendChild(pm.thumbEls[pi]));pmSync();pmInfo()}
function attachThumbDrag(d){
  d.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const startX=e.clientX,startY=e.clientY;let dragging=false;
    const move=ev=>{const dx=ev.clientX-startX,dy=ev.clientY-startY;
      if(!dragging&&Math.hypot(dx,dy)>9){dragging=true;d.classList.add('dragging');try{d.setPointerCapture(e.pointerId)}catch(_){}}
      if(!dragging)return;d.style.transform=`translate(${dx}px,${dy}px)`;
      const over=document.elementFromPoint(ev.clientX,ev.clientY);const tEl=over&&over.closest?over.closest('.thumb'):null;
      if(tEl&&tEl!==d&&pm){const from=pm.order.indexOf(parseInt(d.dataset.idx));const to=pm.order.indexOf(parseInt(tEl.dataset.idx));if(from>-1&&to>-1&&from!==to){pm.order.splice(from,1);pm.order.splice(to,0,parseInt(d.dataset.idx));const grid=$('thumbGrid');pm.order.forEach(pi=>grid.appendChild(pm.thumbEls[pi]));pmSync();pmInfo()}}};
    const up=()=>{d.classList.remove('dragging');d.style.transform='';d.removeEventListener('pointermove',move);d.removeEventListener('pointerup',up);d.removeEventListener('pointercancel',up)};
    d.addEventListener('pointermove',move);d.addEventListener('pointerup',up);d.addEventListener('pointercancel',up)});
}

/* ---------- Placement editor (Sign / Edit / Annotate / Redact / Crop) ---------- */
function buildEditor(pdf,kind){
  ed={kind,pdf,count:pdf.numPages,page:0,pageW:0,pageH:0,boxes:[],marker:null,rect:null,signPos:{fx:.52,fy:.76},signW:.38,crop:{fx:.07,fy:.07,fw:.86,fh:.86}};
  const titles={'crop':'Crop — drag on the page to select what to keep','sign-pdf':'Place your signature — drag it anywhere on the page','edit-pdf':'Click on the page to place your text','annotate':'Drag a rectangle for your note','redact':'Drag rectangles to cover sensitive areas'};
  $('visualWrap').innerHTML=`<div class="pm"><div class="pm-toolbar"><strong>${titles[kind]||''}</strong><span class="pm-nav"><button type="button" class="chipbtn wide" id="edPrev" onclick="edNav(-1)">${icon('chevron-left',15)} Prev</button><span id="edPageInfo" class="pm-info"></span><button type="button" class="chipbtn wide" id="edNext" onclick="edNav(1)">Next ${icon('chevron-right',15)}</button></span></div><div class="stage" id="edStage"><canvas id="edCanvas"></canvas><div id="edOverlay"></div></div><div id="edExtra"></div></div>`;
  if(kind==='sign-pdf'){$('edExtra').innerHTML=`<div class="field" style="margin-top:12px;max-width:340px"><label>Signature size</label><input type="range" id="signSize" min="12" max="85" value="38"></div><p class="pm-hint">Create your signature with Draw, Type or Upload (below the preview) — it appears here and can be dragged to any position, on any page. Placement assumes unrotated pages.</p>`;const ss=$('signSize');ss.disabled=!sigDrawn;ss.addEventListener('input',e=>{ed.signW=e.target.value/100;drawEdOverlay()})}
  if(kind==='redact'){$('edExtra').innerHTML='<div id="boxList" style="margin-top:10px"></div>';renderBoxList()}
  if(kind==='crop'){$('edExtra').innerHTML='<p class="pm-hint">Drag on the page to draw the area to keep — drag its edges or corners to adjust it. The same selection is applied to every page. You can also type exact trims under “Advanced options” below.</p>';['left','right','top','bottom'].forEach(k=>{const el=$('opt_'+k);if(el&&!el.dataset.cropW){el.dataset.cropW='1';el.addEventListener('input',syncCropFromOpts)}})}
  if(kind==='edit-pdf'||kind==='annotate'){$('edExtra').innerHTML='<p class="pm-hint">Page selector above and the “Page number” field under Advanced options stay in sync.</p>'}
  renderEdPage();attachStageHandlers();
}
function edNav(d){if(!ed)return;ed.page=Math.min(ed.count-1,Math.max(0,ed.page+d));renderEdPage()}
async function renderEdPage(){
  if(!ed)return;const info=$('edPageInfo');if(info)info.textContent='Page '+(ed.page+1)+' of '+ed.count;
  const pv=$('edPrev'),nx=$('edNext');if(pv)pv.disabled=ed.page<=0;if(nx)nx.disabled=ed.page>=ed.count-1;
  const pageField=$('opt_page');if(pageField&&(ed.kind==='edit-pdf'||ed.kind==='annotate'||ed.kind==='redact'))pageField.value=ed.page+1;
  try{const pg=await ed.pdf.getPage(ed.page+1);const base=pg.getViewport({scale:1});ed.pageW=base.width;ed.pageH=base.height;
    const wrap=$('visualWrap');const targetW=Math.min(960,Math.max(280,(wrap?wrap.clientWidth:960)-16));const dpr=Math.min(2,window.devicePixelRatio||1);const vp=pg.getViewport({scale:(targetW/base.width)*dpr});
    const c=$('edCanvas');if(!c)return;c.width=vp.width;c.height=vp.height;c.style.width=(vp.width/dpr)+'px';c.style.height=(vp.height/dpr)+'px';await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise}catch(e){}
  drawEdOverlay();if(ed&&ed.kind==='crop')syncCropOpts();
}
function fracFromEvent(e){const r=$('edOverlay').getBoundingClientRect();return{fx:Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),fy:Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))}}
function drawEdOverlay(){
  if(!ed||ed._dragging)return;const ov=$('edOverlay');if(!ov)return;ov.innerHTML='';
  if(ed.kind==='sign-pdf'){if(!sigDrawn||!sigArt)return;const b=document.createElement('div');b.className='sigbox';b.id='sigBox';b.style.left=(ed.signPos.fx*100)+'%';b.style.top=(ed.signPos.fy*100)+'%';b.style.width=(ed.signW*100)+'%';const img=document.createElement('img');img.src=sigArt.toDataURL('image/png');img.alt='Your signature';b.appendChild(img);ov.appendChild(b);
    b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const start=fracFromEvent(e);const off={dx:start.fx-ed.signPos.fx,dy:start.fy-ed.signPos.fy};b.setPointerCapture(e.pointerId);
      const move=ev=>{const p=fracFromEvent(ev);ed.signPos.fx=Math.min(1-ed.signW,Math.max(0,p.fx-off.dx));ed.signPos.fy=Math.min(.98,Math.max(0,p.fy-off.dy));b.style.left=(ed.signPos.fx*100)+'%';b.style.top=(ed.signPos.fy*100)+'%'};
      const up=()=>{b.removeEventListener('pointermove',move);b.removeEventListener('pointerup',up)};b.addEventListener('pointermove',move);b.addEventListener('pointerup',up)});return}
  if(ed.kind==='edit-pdf'){if(ed.marker&&ed.marker.page===ed.page){const m=document.createElement('div');m.className='marker';m.style.left=(ed.marker.fx*100)+'%';m.style.top=(ed.marker.fy*100)+'%';m.textContent=($('opt_text')?$('opt_text').value:'')||'Text';ov.appendChild(m)}return}
  if(ed.kind==='annotate'){if(ed.rect&&ed.rect.page===ed.page)ov.appendChild(rectDiv(ed.rect,'notebox',''));return}
  if(ed.kind==='redact'){ed.boxes.forEach((bx,i)=>{if(bx.page!==ed.page)return;const d=rectDiv(bx,'rbox','');const x=document.createElement('button');x.type='button';x.className='rbox-x';x.innerHTML=icon('x',12);x.title='Remove this box';x.addEventListener('pointerdown',ev=>ev.stopPropagation());x.addEventListener('click',ev=>{ev.stopPropagation();ed.boxes.splice(i,1);drawEdOverlay();renderBoxList()});d.appendChild(x);ov.appendChild(d)});return}
  if(ed.kind==='crop'){const d=document.createElement('div');d.className='crop-rect';const place=()=>{d.style.left=(ed.crop.fx*100)+'%';d.style.top=(ed.crop.fy*100)+'%';d.style.width=(ed.crop.fw*100)+'%';d.style.height=(ed.crop.fh*100)+'%'};place();ov.appendChild(d);
    const MIN=.04;
    const drag=(el,fn)=>{el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const start=fracFromEvent(e);const orig={...ed.crop};try{el.setPointerCapture(e.pointerId)}catch(_){}
      const move=ev=>{const p=fracFromEvent(ev);fn(p.fx-start.fx,p.fy-start.fy,orig);place();syncCropOpts()};
      const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up)};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)})};
    drag(d,(dx,dy,o)=>{ed.crop.fx=Math.min(1-o.fw,Math.max(0,o.fx+dx));ed.crop.fy=Math.min(1-o.fh,Math.max(0,o.fy+dy))});
    const edges={e:(dx,dy,o)=>{ed.crop.fw=Math.min(1-o.fx,Math.max(MIN,o.fw+dx))},w:(dx,dy,o)=>{const nx=Math.min(o.fx+o.fw-MIN,Math.max(0,o.fx+dx));ed.crop.fw=o.fw+(o.fx-nx);ed.crop.fx=nx},s:(dx,dy,o)=>{ed.crop.fh=Math.min(1-o.fy,Math.max(MIN,o.fh+dy))},n:(dx,dy,o)=>{const ny=Math.min(o.fy+o.fh-MIN,Math.max(0,o.fy+dy));ed.crop.fh=o.fh+(o.fy-ny);ed.crop.fy=ny}};
    const combos={nw:['w','n'],ne:['e','n'],sw:['w','s'],se:['e','s'],n:['n'],s:['s'],e:['e'],w:['w']};
    Object.keys(combos).forEach(k=>{const h=document.createElement('div');h.className='ch ch-'+k;h.title='Drag to resize';d.appendChild(h);drag(h,(dx,dy,o)=>{combos[k].forEach(en=>edges[en](dx,dy,o))})});return}
}
function rectDiv(r,cls){const d=document.createElement('div');d.className=cls;d.style.left=(r.fx*100)+'%';d.style.top=(r.fy*100)+'%';d.style.width=(r.fw*100)+'%';d.style.height=(r.fh*100)+'%';return d}
function renderBoxList(){const el=$('boxList');if(!el||!ed)return;el.innerHTML=ed.boxes.length?('<strong>'+ed.boxes.length+' box(es):</strong> '+ed.boxes.map((b,i)=>`<span class="boxitem">Page ${b.page+1} <button type="button" class="chipbtn rm" onclick="removeBox(${i})">${icon('x',13)}</button></span>`).join(' ')):'<span class="pm-hint">No boxes yet — drag on the page to add one. Nothing is redacted until you draw at least one box.</span>';updateActionLabel()}
function removeBox(i){if(!ed)return;ed.boxes.splice(i,1);drawEdOverlay();renderBoxList()}
function syncCropOpts(){if(!ed||!ed.pageW)return;const r=ed.crop;const set=(k,v)=>{const el=$('opt_'+k);if(el)el.value=Math.max(0,Math.round(v))};set('left',r.fx*ed.pageW);set('right',(1-r.fx-r.fw)*ed.pageW);set('top',r.fy*ed.pageH);set('bottom',(1-r.fy-r.fh)*ed.pageH)}
function syncCropFromOpts(){if(!ed||ed.kind!=='crop'||!ed.pageW||!ed.pageH)return;const g=k=>{const el=$('opt_'+k);const v=el?parseFloat(el.value):0;return isNaN(v)?0:Math.max(0,v)};const l=g('left'),r=g('right'),t=g('top'),b=g('bottom');const W=ed.pageW,H=ed.pageH;if(l+r>=W-10||t+b>=H-10)return;ed.crop={fx:l/W,fy:t/H,fw:(W-l-r)/W,fh:(H-t-b)/H};drawEdOverlay()}
function attachStageHandlers(){
  const ov=$('edOverlay');if(!ov||!ed)return;
  if(ed.kind==='edit-pdf'){const txt=$('opt_text');if(txt)txt.addEventListener('input',()=>drawEdOverlay());
    ov.addEventListener('pointerdown',e=>{const p=fracFromEvent(e);ed.marker={fx:p.fx,fy:p.fy,page:ed.page};drawEdOverlay()});return}
  if(ed.kind==='crop'){
    ov.addEventListener('pointerdown',e=>{if(e.target!==ov)return;const start=fracFromEvent(e);ed._dragging=true;try{ov.setPointerCapture(e.pointerId)}catch(_){}const ghost=rectDiv({fx:start.fx,fy:start.fy,fw:0,fh:0},'crop-rect');ov.appendChild(ghost);
      const move=ev=>{const p=fracFromEvent(ev);const r={fx:Math.min(start.fx,p.fx),fy:Math.min(start.fy,p.fy),fw:Math.abs(p.fx-start.fx),fh:Math.abs(p.fy-start.fy)};ghost.style.left=(r.fx*100)+'%';ghost.style.top=(r.fy*100)+'%';ghost.style.width=(r.fw*100)+'%';ghost.style.height=(r.fh*100)+'%';ghost.dataset.rect=JSON.stringify(r)};
      const up=()=>{ov.removeEventListener('pointermove',move);ov.removeEventListener('pointerup',up);ov.removeEventListener('pointercancel',up);ed._dragging=false;const r=ghost.dataset.rect?JSON.parse(ghost.dataset.rect):null;ghost.remove();if(r&&r.fw>.02&&r.fh>.02){ed.crop=r;syncCropOpts()}drawEdOverlay()};
      ov.addEventListener('pointermove',move);ov.addEventListener('pointerup',up);ov.addEventListener('pointercancel',up)});return}
  if(ed.kind==='annotate'||ed.kind==='redact'){
    ov.addEventListener('pointerdown',e=>{if(e.target.closest('.rbox-x'))return;const start=fracFromEvent(e);ed._dragging=true;try{ov.setPointerCapture(e.pointerId)}catch(_){}const ghost=rectDiv({fx:start.fx,fy:start.fy,fw:0,fh:0},ed.kind==='redact'?'rbox':'notebox');ov.appendChild(ghost);
      const move=ev=>{const p=fracFromEvent(ev);const r={fx:Math.min(start.fx,p.fx),fy:Math.min(start.fy,p.fy),fw:Math.abs(p.fx-start.fx),fh:Math.abs(p.fy-start.fy)};ghost.style.left=(r.fx*100)+'%';ghost.style.top=(r.fy*100)+'%';ghost.style.width=(r.fw*100)+'%';ghost.style.height=(r.fh*100)+'%';ghost.dataset.rect=JSON.stringify(r)};
      const up=()=>{ov.removeEventListener('pointermove',move);ov.removeEventListener('pointerup',up);ov.removeEventListener('pointercancel',up);ed._dragging=false;const r=ghost.dataset.rect?JSON.parse(ghost.dataset.rect):null;ghost.remove();if(r&&r.fw>.01&&r.fh>.01){r.page=ed.page;if(ed.kind==='redact'){ed.boxes.push(r);renderBoxList()}else ed.rect=r}drawEdOverlay()};
      ov.addEventListener('pointermove',move);ov.addEventListener('pointerup',up);ov.addEventListener('pointercancel',up)});return}
}

/* ================= PDF Editor (v4.7.0; v4.7.1 segment edits, pinned header, keyboard) =================
   One workspace over one PDF, modelled on the big editors (Sejda,
   iLovePDF, Smallpdf, Adobe, Xodo) but with their paid walls removed:
   editing existing text is free here (it is Pro at Smallpdf, trial-
   walled at Adobe, preview-only at Xodo, Premium-labelled at
   iLovePDF, capped at 3 saves/hour at Sejda). No caps, no sign-up,
   no watermark — and no upload wait, because everything is on-device.
   Tools: Edit text, Add text, Add image, Sign, Mark (highlight /
   underline / strike), Shapes, Draw, Cover, Stamps, Find & Replace,
   plus a page-numbers setting, Undo/Redo and Zoom.
   Every change is an op in pe.ops; the preview is pure overlay DOM —
   the rendered page canvas is never re-drawn for an op — so mode
   switches, drags and resizes run at pointer speed (drags mutate the
   element's style during the move and commit to the op on release).
   Save replays the ops with pdf-lib onto the original document:
   headers, footers, letterheads, images and untouched lines are
   never re-drawn.
   Positions are fractions of the page, like the other visual editors;
   placement assumes page rotation 0 (same stated limit as Sign/Edit).
   Font mapping: the PDF.js font name picks the closest pdf-lib
   standard family (Courier/Times/Helvetica + Bold/Italic variants)
   and the detected size and baseline are reused, so a re-typed line
   sits where the original sat. Text COLOUR (v4.7.12): PDF.js exposes
   no colour for text items, so each field's ink colour is DETECTED
   from the rendered page — the pixels inside the field that differ
   most from the paper colour — and shown in the format bar as a hex
   code the user can keep, pick, or type over. Edits therefore keep
   the field's own colour unless the user changes it. The COVER
   colour is real data: sampled
   from the rendered page around the line (median of the rect's edge
   pixels), so covers blend on tinted paper.
   HONESTY: an edit COVERS the old words — they stay inside the file,
   hidden, not erased (the same is true of Sejda's whiteout). The tool
   page FAQ and the workspace say so, and point to Redact PDF for
   removal that is permanent. */
const PE_MODES=[
 {id:'edit',label:'Edit text',icon:'pencil'},
 {id:'text',label:'Add text',icon:'type'},
 {id:'image',label:'Add image',icon:'image-plus'},
 {id:'sign',label:'Sign',icon:'signature'},
 {id:'mark',label:'Mark',icon:'pen-line'},
 {id:'shapes',label:'Shapes',icon:'layers'},
 {id:'draw',label:'Draw',icon:'pencil'},
 {id:'cover',label:'Cover',icon:'eye-off'},
 {id:'stamps',label:'Stamps',icon:'stamp'},
 {id:'find',label:'Find & Replace',icon:'scan-text'}
];
const PE_TXT_COLORS=[{css:'#141414',rgb:[.08,.08,.08],name:'Ink'},{css:'#1a365d',rgb:[.10,.21,.36],name:'Navy'},{css:'#666666',rgb:[.40,.40,.40],name:'Grey'},{css:'#b03a2e',rgb:[.69,.23,.18],name:'Red'}];
const PE_HL_COLORS=[{css:'rgba(255,213,79,.5)',rgb:[1,.84,.3],name:'Yellow'},{css:'rgba(110,220,110,.5)',rgb:[.45,.85,.45],name:'Green'},{css:'rgba(255,150,180,.5)',rgb:[1,.6,.75],name:'Pink'},{css:'rgba(110,170,255,.5)',rgb:[.45,.7,1],name:'Blue'}];
const PE_STAMPS=[{text:'APPROVED',css:'#1e7d32',rgb:[.12,.49,.19]},{text:'DRAFT',css:'#666666',rgb:[.40,.40,.40]},{text:'CONFIDENTIAL',css:'#b03a2e',rgb:[.69,.23,.18]},{text:'FINAL',css:'#1a365d',rgb:[.10,.21,.36]},{text:'PAID',css:'#1e7d32',rgb:[.12,.49,.19]},{text:'REJECTED',css:'#b03a2e',rgb:[.69,.23,.18]}];
function peFontFam(fontName){const n=(fontName||'').toLowerCase();if(/courier|mono/.test(n))return 'Courier';if(/times|roman|serif|georgia|garamond/.test(n))return 'TimesRoman';return 'Helvetica'}
function peFontStd(fam,bold,ital){if(fam==='TimesRoman')return 'TimesRoman'+(bold?'Bold':'')+(ital?'Italic':'');return fam+(bold?'Bold':'')+(ital?'Oblique':'')}
function peFontCss(fontName){const n=(fontName||'').toLowerCase();if(/courier|mono/.test(n))return "'Courier New',monospace";if(/times|roman|serif|georgia|garamond/.test(n))return "'Times New Roman',Times,serif";return 'Helvetica,Arial,sans-serif'}
function peFontName(pg,it){try{const o=pg.commonObjs.get(it.fontName);if(o&&o.name)return o.name}catch(e){}return ''}
/* pdf-lib's standard fonts print WinAnsi (CP1252) characters only.
   Words in scripts outside it (Arabic, Chinese, most emoji…) cannot
   be re-typed: drawing them would throw at save time and lose every
   change in that save. The editor checks BEFORE an op is made and
   says so in plain words instead (v4.7.1 matrix find). */
const PE_WINANSI_EXTRA='€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function peEncodable(s){if(!s)return true;for(const ch of s){const c=ch.codePointAt(0);if(c===9||c===10||c===13)continue;if(c>=0x20&&c<=0x7E)continue;if(c>=0xA0&&c<=0xFF)continue;if(PE_WINANSI_EXTRA.indexOf(ch)>=0)continue;return false}return true}
/* Right-to-left scripts (Hebrew, Arabic and their presentation forms).
   PDFs usually store RTL text as glyphs in VISUAL order, often as
   Arabic presentation-form code points, so a naive left-to-right read
   scrambles the words and search words typed normally never match.
   peComputeLines assembles RTL fields in reading order (mirrored x),
   and peLogical maps presentation forms back to plain letters (NFKC)
   so Find & Replace and the field editor work with the words as a
   person reads them. Re-typing the result is still gated by
   peEncodable: an edit that keeps any RTL wording is
   skipped/reported, never drawn broken. */
const PE_RTL_RE=/[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
/* peComputeLines assembles RTL fields in reading order (below); what
   remains non-plain about them is the presentation-form code points,
   which NFKC maps back to ordinary letters for reading and search. */
function peLogical(t){return String(t).normalize('NFKC')}
function peFrac(e){const r=$('peOverlay').getBoundingClientRect();return{fx:Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),fy:Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))}}
let peSeq=0;
/* Median of the edge pixels of a page-fraction rect, sampled from a
   rendered canvas of the page — the colour covers blend with. */
function peSampleFrom(cv,fx,fy,fw,fh,pw,ph){try{const g=cv.getContext('2d',{willReadFrequently:true});const sx=cv.width/pw,sy=cv.height/ph;const x0=Math.max(0,Math.round(fx*pw*sx)),y0=Math.max(0,Math.round(fy*ph*sy)),w=Math.min(cv.width-x0,Math.max(2,Math.round(fw*pw*sx))),h=Math.min(cv.height-y0,Math.max(2,Math.round(fh*ph*sy)));if(w<2||h<2)return[1,1,1];const data=g.getImageData(x0,y0,w,h).data;const pts=[];const ring=(x,y)=>{const o=(y*w+x)*4;pts.push([data[o],data[o+1],data[o+2]])};
  for(let x=0;x<w;x++){ring(x,0);if(h>2)ring(x,h-1)}for(let y=1;y<h-1;y++){ring(0,y);if(w>2)ring(w-1,y)}
  if(!pts.length)return[1,1,1];const med=ch=>{const a=pts.map(p=>p[ch]).sort((a,b)=>a-b);return a[a.length>>1]/255};return[med(0),med(1),med(2)]}catch(e){return[1,1,1]}}
function peRgbHex(c){return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,'0')).join('').toUpperCase()}
function peHexRgb(h){const s=(h||'').trim();const m=/^#?([0-9a-f]{6})$/i.exec(s);if(m){const n=parseInt(m[1],16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]}const m3=/^#?([0-9a-f]{3})$/i.exec(s);if(m3){const t=m3[1];return[parseInt(t[0]+t[0],16)/255,parseInt(t[1]+t[1],16)/255,parseInt(t[2]+t[2],16)/255]}return null}
/* A field's real ink colour (v4.7.12): the pixels inside the field
   rect that differ MOST from the paper (cover) colour are the printed
   glyphs and their anti-aliasing; the median of the strongest 40% is
   the ink. Works for dark-on-light and light-on-dark alike. */
function peDetectInk(cv,l,pw,ph){try{const g=cv.getContext('2d',{willReadFrequently:true});const sx=cv.width/pw,sy=cv.height/ph;const x0=Math.max(0,Math.round(l.fx*pw*sx)),y0=Math.max(0,Math.round(l.fTop*ph*sy)),w=Math.min(cv.width-x0,Math.max(2,Math.round(l.fw*pw*sx))),h=Math.min(cv.height-y0,Math.max(2,Math.round(l.fh*ph*sy)));if(w<2||h<2)return null;const d=g.getImageData(x0,y0,w,h).data;const bg=l.cover||[1,1,1];const cand=[];
  for(let i=0;i<d.length;i+=4){const r=d[i]/255,gg=d[i+1]/255,b=d[i+2]/255;const dist=Math.abs(r-bg[0])+Math.abs(gg-bg[1])+Math.abs(b-bg[2]);if(dist>.35)cand.push([dist,r,gg,b])}
  if(cand.length<6)return null;cand.sort((a,b)=>b[0]-a[0]);const top=cand.slice(0,Math.max(6,Math.floor(cand.length*.4)));const med=ch=>{const a=top.map(p=>p[ch]).sort((a,b)=>a-b);return a[a.length>>1]};return[med(1),med(2),med(3)]}catch(e){return null}}
/* Embedded pictures as elements (v4.7.12): walk the page's operator
   list tracking the current transform; every painted image XObject
   yields its page-space rect. Lets the editor offer Cover / Replace
   for the PDF's own pictures — the practical edits people want —
   without pretending to rewrite content streams. */
async function peExtractImages(pg,pw,ph){const out=[];try{if(!window.pdfjsLib||!pdfjsLib.OPS)return out;const OPS=pdfjsLib.OPS;const ol=await pg.getOperatorList();let ctm=[1,0,0,1,0,0];const stack=[];
  const pt=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  for(let i=0;i<ol.fnArray.length;i++){const fn=ol.fnArray[i],args=ol.argsArray[i];
    if(fn===OPS.save)stack.push(ctm.slice());
    else if(fn===OPS.restore){if(stack.length)ctm=stack.pop()}
    else if(fn===OPS.transform){const m=args;ctm=[ctm[0]*m[0]+ctm[2]*m[1],ctm[1]*m[0]+ctm[3]*m[1],ctm[0]*m[2]+ctm[2]*m[3],ctm[1]*m[2]+ctm[3]*m[3],ctm[0]*m[4]+ctm[2]*m[5]+ctm[4],ctm[1]*m[4]+ctm[3]*m[5]+ctm[5]]}
    else if(fn===OPS.paintImageXObject||fn===OPS.paintInlineImageXObject||(OPS.paintJpegXObject!==undefined&&fn===OPS.paintJpegXObject)){const cs=[[0,0],[1,0],[0,1],[1,1]].map(q=>pt(ctm,q[0],q[1]));const xs=cs.map(p=>p[0]),ys=cs.map(p=>p[1]);const x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs),y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);if(x1-x0>4&&y1-y0>4)out.push({fx:x0/pw,fTop:(ph-y1)/ph,fw:(x1-x0)/pw,fh:(y1-y0)/ph})}}
  }catch(e){}
  return out}
function buildPdfEditor(pdf){
  pe={pdf,count:pdf.numPages,page:0,pageW:0,pageH:0,mode:'edit',ops:[],redo:[],sel:-1,lines:[],images:[],imgSel:-1,bmpCache:null,hasText:false,mostSize:12,lineCache:{},zoom:1,rot:0,rotCache:{},pn:{on:false,pos:'bottom-center',start:1},txt:{text:'',size:18,color:0,custCss:null,custRgb:null,bold:false,sizeTouched:false},mark:{style:'highlight',hl:0,line:0},shape:{kind:'rect',color:0,width:1.5},draw:{color:0,width:2},stamp:0,editLine:-1,editFmt:null};
  const modes=PE_MODES.map(m=>`<button type="button" class="pe-tool${m.id==='edit'?' sel':''}" data-pemode="${m.id}" aria-pressed="${m.id==='edit'}">${icon(m.icon,17)} ${m.label}</button>`).join('');
  $('visualWrap').innerHTML=`<div class="pm pe"><div class="pe-head"><button type="button" class="pe-tool" id="peUndoH">${icon('rotate-ccw',17)} Undo</button><button type="button" class="pe-tool" id="peRedoH">${icon('rotate-cw',17)} Redo</button><span class="pe-count" id="peCountH">0 changes</span><span class="pe-spacer"></span><button type="button" class="btn sm" id="peSaveH">Save edited PDF</button></div><div class="pe-rotwarn hidden" id="peRotWarn">${icon('triangle-alert',15)}<span>This page is rotated — editing and placing are paused on rotated pages, so nothing can land in the wrong place. Other pages work as normal.</span></div><div class="pe-tools" role="toolbar" aria-label="Editor tools">${modes}<button type="button" class="pe-tool" id="pePnBtn" aria-pressed="false">${icon('hash',17)} Page numbers</button><span class="pe-spacer"></span><button type="button" class="pe-tool" id="peUndo">${icon('rotate-ccw',17)} Undo</button><button type="button" class="pe-tool" id="peRedo">${icon('rotate-cw',17)} Redo</button><span class="pe-count" id="peCount">0 changes</span></div><p class="pm-hint pe-keys">${icon('keyboard',14)}<span>Shortcuts: Ctrl+Z undo · Ctrl+Shift+Z redo · Ctrl+C / Ctrl+V copy &amp; paste · Delete removes the selected item</span></p><div class="pe-modebar" id="peModeBar"></div><div class="pe-pn hidden" id="pePn"></div><div class="pm-toolbar"><strong>Page preview</strong><span class="pm-nav"><button type="button" class="chipbtn wide" id="peZoomOut" aria-label="Zoom out">${icon('minimize-2',15)}</button><span id="peZoomPct" class="pm-info">100%</span><button type="button" class="chipbtn wide" id="peZoomIn" aria-label="Zoom in">${icon('plus',15)}</button></span><span class="pm-nav"><button type="button" class="chipbtn wide" id="pePrev">${icon('chevron-left',15)} Prev</button><span id="pePageInfo" class="pm-info"></span><button type="button" class="chipbtn wide" id="peNext">Next ${icon('chevron-right',15)}</button></span></div><div class="pe-zoomwrap"><div class="stage" id="peStage"><canvas id="peCanvas"></canvas><div id="peOverlay"></div></div></div><input type="file" id="peImgFile" accept="image/png,image/jpeg" class="hidden"><input type="file" id="peImgRepFile" accept="image/png,image/jpeg" class="hidden"></div>`;
  document.querySelectorAll('[data-pemode]').forEach(b=>b.addEventListener('click',()=>peSetMode(b.dataset.pemode)));
  $('peUndo').addEventListener('click',peDoUndo);
  $('peRedo').addEventListener('click',peDoRedo);
  $('peUndoH').addEventListener('click',peDoUndo);
  $('peRedoH').addEventListener('click',peDoRedo);
  $('peSaveH').addEventListener('click',()=>{const b=$('processBtn');if(b&&!b.disabled)b.click()});
  $('pePnBtn').addEventListener('click',()=>{const p=$('pePn');if(!p)return;const opening=p.classList.contains('hidden');p.classList.toggle('hidden',!opening);$('pePnBtn').classList.toggle('sel',opening);if(opening)peRenderPn()});
  $('pePrev').addEventListener('click',()=>peNav(-1));$('peNext').addEventListener('click',()=>peNav(1));
  $('peZoomIn').addEventListener('click',()=>peSetZoom(pe.zoom+.25));$('peZoomOut').addEventListener('click',()=>peSetZoom(pe.zoom-.25));
  $('peImgFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)peAddImageFile(f)});
  $('peImgRepFile').addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f||!pe||pe.imgSel<0||!pe.images[pe.imgSel])return;const im=pe.images[pe.imgSel];
    try{const buf=new Uint8Array(await f.arrayBuffer());const isPng=/\.png$/i.test(f.name)||/png/.test(f.type);const url=URL.createObjectURL(f);const cv=$('peCanvas');const cov=cv?peSampleFrom(cv,im.fx,im.fTop,im.fw,im.fh,pe.pageW,pe.pageH):[1,1,1];
      pePushOp({type:'cover',page:pe.page,fx:im.fx,fy:im.fTop,fw:im.fw,fh:im.fh,cover:cov},false);
      pePushOp({type:'image',page:pe.page,fx:im.fx,fy:im.fTop,fw:im.fw,fh:im.fh,bytes:buf,format:isPng?'png':'jpg',url,aspect:(im.fw*pe.pageW)/Math.max(1,im.fh*pe.pageH),sign:false},true);
      pe.imgSel=-1;peDrawOverlay();toast('Picture replaced — drag it to adjust, resize from the corner dot.')}catch(err){toast('That image could not be read — try a PNG or JPG.')}});
  peAttachStage();peRenderModeBar();peSyncCount();peRenderPage();
}
function peShowSig(){const sw=$('sigWrap'),vw=$('visualWrap');if(sw&&vw&&vw.parentNode&&vw.previousElementSibling!==sw)vw.parentNode.insertBefore(sw,vw);if(sw)sw.classList.remove('hidden');initSig()}
function peSetMode(m){if(!pe)return;pe.mode=m;pe.editLine=-1;pe.imgSel=-1;document.querySelectorAll('[data-pemode]').forEach(b=>{const on=b.dataset.pemode===m;b.classList.toggle('sel',on);b.setAttribute('aria-pressed',on?'true':'false')});if(m==='sign')peShowSig();peRenderModeBar();peDrawOverlay()}
function peNav(d){if(!pe)return;const np=Math.min(pe.count-1,Math.max(0,pe.page+d));if(np===pe.page)return;pe.page=np;pe.editLine=-1;pe.sel=-1;pe.imgSel=-1;peRenderPage()}
function peSetZoom(z){if(!pe)return;const nz=Math.min(2,Math.max(.5,Math.round(z*4)/4));if(nz===pe.zoom)return;pe.zoom=nz;const el=$('peZoomPct');if(el)el.textContent=Math.round(nz*100)+'%';peRenderPage()}
/* Undo/Redo live in TWO places (v4.7.1): the pinned header row —
   always visible, even on a phone — and the end of the scrolling
   toolbar. In v4.7.0 they existed ONLY at the toolbar's end, off-
   screen on phones, so users reasonably concluded they did not
   exist. Both copies call these functions, and peSyncCount keeps
   every copy (and both Save buttons) in sync. Undo/Redo cover EVERY
   op type uniformly, text edits included. */
function peDoUndo(){if(!pe||!pe.ops.length)return;pe.redo.push(pe.ops.pop());pe.sel=-1;pe.editLine=-1;peDrawOverlay();if(pe.mode==='edit')peRenderModeBar();peSyncCount()}
function peDoRedo(){if(!pe||!pe.redo.length)return;pe.ops.push(pe.redo.pop());pe.sel=-1;pe.editLine=-1;peDrawOverlay();if(pe.mode==='edit')peRenderModeBar();peSyncCount()}
function peSyncCount(){if(!pe)return;const n=pe.ops.length+(pe.pn.on?1:0);const label=pe.ops.length+' change'+(pe.ops.length===1?'':'s')+(pe.pn.on?' · page numbers on':'');const el=$('peCount');if(el)el.textContent=label;const elh=$('peCountH');if(elh)elh.textContent=label;const u=$('peUndo'),r=$('peRedo'),uh=$('peUndoH'),rh=$('peRedoH');if(u)u.disabled=!pe.ops.length;if(r)r.disabled=!pe.redo.length;if(uh)uh.disabled=!pe.ops.length;if(rh)rh.disabled=!pe.redo.length;const sh=$('peSaveH');if(sh)sh.disabled=n===0;const pb=$('processBtn');if(pb)pb.disabled=n===0}
function pePushOp(op,select){if(!pe)return;pe.ops.push(op);pe.redo=[];pe.sel=select===false?-1:pe.ops.length-1;peDrawOverlay();peSyncCount()}
function peRenderPn(){if(!pe)return;const p=$('pePn');if(!p)return;
  p.innerHTML=`<div class="pe-row"><div class="field"><label class="checkline"><input type="checkbox" id="pePnOn" ${pe.pn.on?'checked':''}> Add page numbers when saving</label></div><div class="field"><label for="pePnPos">Position</label><select id="pePnPos"><option value="bottom-center" ${pe.pn.pos==='bottom-center'?'selected':''}>Bottom center</option><option value="bottom-left" ${pe.pn.pos==='bottom-left'?'selected':''}>Bottom left</option><option value="bottom-right" ${pe.pn.pos==='bottom-right'?'selected':''}>Bottom right</option></select></div><div class="field"><label for="pePnStart">Start at</label><input type="number" id="pePnStart" min="0" max="9999" value="${pe.pn.start}"></div></div><p class="pm-hint">Numbers are stamped on every page when you save — they are not placed by hand.</p>`;
  $('pePnOn').addEventListener('change',e=>{pe.pn.on=e.target.checked;const b=$('pePnBtn');if(b){b.classList.toggle('on',pe.pn.on);b.setAttribute('aria-pressed',pe.pn.on?'true':'false')}peSyncCount()});
  $('pePnPos').addEventListener('change',e=>{pe.pn.pos=e.target.value});
  $('pePnStart').addEventListener('input',e=>{const v=parseInt(e.target.value);pe.pn.start=isNaN(v)?1:Math.max(0,v)})}
function peColorDots(list,cur,attr){return list.map((c,i)=>`<button type="button" class="colordot ${i===cur?'sel':''}" data-${attr}="${i}" style="background:${c.css}" aria-label="${c.name}"></button>`).join('')}
function peWireDots(bar,attr,fn){bar.querySelectorAll('[data-'+attr+']').forEach(b=>b.addEventListener('click',()=>{fn(parseInt(b.dataset[attr]));bar.querySelectorAll('[data-'+attr+']').forEach(x=>x.classList.toggle('sel',x===b))}))}
function peRenderModeBar(){
  if(!pe)return;const bar=$('peModeBar');if(!bar)return;const m=pe.mode;
  if(m==='edit'){
    if(pe.rot){bar.innerHTML='<p class="pm-hint">This page is rotated '+pe.rot+'&deg;. Editing and placing are paused on rotated pages, so nothing can land in the wrong place — the other pages of this file work as normal.</p>';return}
    if(pe.editLine>=0&&pe.lines[pe.editLine]&&pe.editFmt){const l=pe.lines[pe.editLine];const f=pe.editFmt;const oi=pe.ops.findIndex(o=>o.type==='edit'&&o.page===pe.page&&o.lineIdx===pe.editLine);const cur=oi>=0?pe.ops[oi].newText:(PE_RTL_RE.test(l.text)?peLogical(l.text):l.text);
      bar.innerHTML=`<div class="pe-row"><div class="field grow"><label for="peEditInput">Change this field <span class="pm-hint">— font: ${esc(l.fontName||'standard')}, matched as closely as possible</span></label><input id="peEditInput" type="text" value="${esc(cur).replace(/"/g,'&quot;')}"></div><button type="button" class="btn sm" id="peEditUse">Use new text</button>${oi>=0?'<button type="button" class="btn secondary sm" id="peEditRemove">Remove this edit</button>':''}<button type="button" class="btn secondary sm" id="peEditCancel">Cancel</button></div><div class="pe-row" style="margin-top:8px"><span class="pe-step"><button type="button" class="pe-stepbtn" id="peSizeDown" aria-label="Smaller text">−</button><span class="pm-info" id="peSizeVal">${f.size} pt</span><button type="button" class="pe-stepbtn" id="peSizeUp" aria-label="Bigger text">+</button></span><button type="button" class="pe-chip ${f.bold?'sel':''}" id="peFmtBold" aria-pressed="${f.bold}">Bold</button><button type="button" class="pe-chip ${f.italic?'sel':''}" id="peFmtItalic" aria-pressed="${f.italic}">Italic</button><span class="sigrow">${peColorDots(PE_TXT_COLORS,PE_TXT_COLORS.findIndex(c=>c.css===f.css),'pefmtcolor')}</span><span class="pe-colorbox"><input type="color" id="peFmtPick" value="${f.css.toLowerCase()}" aria-label="Pick a colour"><input type="text" id="peFmtHex" value="${f.css}" maxlength="7" aria-label="Colour code, for example #1A365D"><span class="pm-hint">the field's own colour, detected from the page</span></span></div>${!peEncodable(l.text)?'<p class="pm-hint" style="margin-top:8px">This field is in a script the editor\u2019s standard fonts can\u2019t re-type (such as Arabic). You can replace it with Latin-letter wording, or Cancel and cover it instead.</p>':''}`;
      $('peEditUse').addEventListener('click',peUseEdit);
      const rm=$('peEditRemove');if(rm)rm.addEventListener('click',()=>{const ix=pe.ops.findIndex(o=>o.type==='edit'&&o.page===pe.page&&o.lineIdx===pe.editLine);if(ix>=0){pe.ops.splice(ix,1);pe.redo=[]}pe.editLine=-1;peRenderModeBar();peDrawOverlay();peSyncCount()});
      $('peEditCancel').addEventListener('click',()=>{pe.editLine=-1;peRenderModeBar();peDrawOverlay()});
      const inp=$('peEditInput');if(inp)inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();peUseEdit()}});
      $('peSizeDown').addEventListener('click',()=>{f.size=Math.max(6,f.size-1);f.sizeTouched=true;$('peSizeVal').textContent=f.size+' pt'});
      $('peSizeUp').addEventListener('click',()=>{f.size=Math.min(72,f.size+1);f.sizeTouched=true;$('peSizeVal').textContent=f.size+' pt'});
      $('peFmtBold').addEventListener('click',e=>{f.bold=!f.bold;e.currentTarget.classList.toggle('sel',f.bold);e.currentTarget.setAttribute('aria-pressed',f.bold?'true':'false')});
      $('peFmtItalic').addEventListener('click',e=>{f.italic=!f.italic;e.currentTarget.classList.toggle('sel',f.italic);e.currentTarget.setAttribute('aria-pressed',f.italic?'true':'false')});
      peWireDots(bar,'pefmtcolor',i=>{f.css=PE_TXT_COLORS[i].css;f.rgb=PE_TXT_COLORS[i].rgb;const pk=$('peFmtPick'),hx=$('peFmtHex');if(pk)pk.value=f.css;if(hx)hx.value=f.css});
      const pkF=$('peFmtPick');if(pkF)pkF.addEventListener('input',()=>{f.css=pkF.value.toUpperCase();f.rgb=peHexRgb(pkF.value)||f.rgb;const hx=$('peFmtHex');if(hx)hx.value=f.css;bar.querySelectorAll('[data-pefmtcolor]').forEach(x=>x.classList.remove('sel'))});
      const hxF=$('peFmtHex');if(hxF)hxF.addEventListener('change',()=>{const rgb=peHexRgb(hxF.value);if(rgb){f.rgb=rgb;f.css=peRgbHex(rgb);hxF.value=f.css;if(pkF)pkF.value=f.css;bar.querySelectorAll('[data-pefmtcolor]').forEach(x=>x.classList.toggle('sel',(PE_TXT_COLORS[parseInt(x.dataset.pefmtcolor)]||{}).css===f.css))}else hxF.value=f.css});
      return}
    bar.innerHTML=pe.hasText?'<p class="pm-hint">Tap a field to change its words — its colour is detected automatically and shown as a code in the editing bar. Drag a field to move it somewhere else; its words stay the same unless you change them. Editing is field by field: everything else on the page stays exactly as it is. Dashed boxes are the page\u2019s pictures — tap one to move, cover or replace it. Edits cover the old words: hidden, not erased. To remove sensitive text for good, use the Redact PDF tool.</p>':'<p class="pm-hint">This page is a scanned picture, so its words can\'t be edited as text.'+(pe.images&&pe.images.length?' The dashed box is the page\u2019s picture — tap it to cover or replace it.':'')+' Add text, images, highlights and signatures still work on it.</p>';return}
  if(m==='text'){
    if(!pe.txt.sizeTouched)pe.txt.size=pe.mostSize||12;
    bar.innerHTML=`<div class="pe-row"><div class="field grow"><label for="peTxtInput">Text to add</label><input id="peTxtInput" type="text" placeholder="Type the text, then tap the page" value="${esc(pe.txt.text).replace(/"/g,'&quot;')}"></div><div class="field"><label for="peTxtSize">Size</label><select id="peTxtSize">${[10, 12, 14, 18, 24, 30, 36].map(s=>`<option value="${s}" ${s===pe.txt.size?'selected':''}>${s} pt</option>`).join('')}</select></div><div class="field"><label>Color</label><div class="sigrow" style="margin-top:2px">${peColorDots(PE_TXT_COLORS,pe.txt.custCss?-1:pe.txt.color,'pecolor')}<span class="pe-colorbox"><input type="color" id="peTxtPick" value="${(pe.txt.custCss||PE_TXT_COLORS[pe.txt.color].css).toLowerCase()}" aria-label="Pick a colour"><input type="text" id="peTxtHex" value="${pe.txt.custCss||PE_TXT_COLORS[pe.txt.color].css}" maxlength="7" aria-label="Colour code, for example #1A365D"></span></div></div><div class="field"><label class="checkline"><input type="checkbox" id="peTxtBold" ${pe.txt.bold?'checked':''}> Bold</label></div></div><p class="pm-hint">Type the text, then tap the page where it should start — one tap places it. The starting size matches this page's own text. Tap placed text to move it, or use Duplicate / Delete above it.</p>`;
    $('peTxtInput').addEventListener('input',e=>{pe.txt.text=e.target.value});
    $('peTxtSize').addEventListener('change',e=>{pe.txt.size=parseInt(e.target.value)||12;pe.txt.sizeTouched=true});
    peWireDots(bar,'pecolor',i=>{pe.txt.color=i;pe.txt.custCss=null;pe.txt.custRgb=null;const pk=$('peTxtPick'),hx=$('peTxtHex');if(pk)pk.value=PE_TXT_COLORS[i].css;if(hx)hx.value=PE_TXT_COLORS[i].css});
    const pkT=$('peTxtPick');if(pkT)pkT.addEventListener('input',()=>{pe.txt.custCss=pkT.value.toUpperCase();pe.txt.custRgb=peHexRgb(pkT.value);const hx=$('peTxtHex');if(hx)hx.value=pe.txt.custCss;bar.querySelectorAll('[data-pecolor]').forEach(x=>x.classList.remove('sel'))});
    const hxT=$('peTxtHex');if(hxT)hxT.addEventListener('change',()=>{const rgb=peHexRgb(hxT.value);if(rgb){pe.txt.custRgb=rgb;pe.txt.custCss=peRgbHex(rgb);hxT.value=pe.txt.custCss;if(pkT)pkT.value=pe.txt.custCss}else hxT.value=pe.txt.custCss||PE_TXT_COLORS[pe.txt.color].css});
    $('peTxtBold').addEventListener('change',e=>{pe.txt.bold=e.target.checked});return}
  if(m==='image'){bar.innerHTML='<div class="pe-row"><label class="btn secondary sm" for="peImgFile">'+icon('image-plus',16)+' Choose an image</label><span class="pm-hint">PNG or JPG — a logo, stamp or photo. Drag it on the page; resize it from the corner dot.</span></div>';return}
  if(m==='sign'){bar.innerHTML=`<div class="pe-row"><button type="button" class="btn sm" id="pePlaceSig">${icon('signature',16)} Place signature on this page</button><span class="pm-hint">${sigDrawn?'Your signature is ready — place it, then drag it into position.':'Create your signature below first — draw it, type it, or upload a picture.'}</span></div>`;$('pePlaceSig').addEventListener('click',pePlaceSig);return}
  if(m==='mark'){const st=pe.mark.style;
    bar.innerHTML=`<div class="pe-row"><button type="button" class="pe-chip ${st==='highlight'?'sel':''}" data-pemarkstyle="highlight">Highlight</button><button type="button" class="pe-chip ${st==='underline'?'sel':''}" data-pemarkstyle="underline">Underline</button><button type="button" class="pe-chip ${st==='strike'?'sel':''}" data-pemarkstyle="strike">Strike through</button><span class="sigrow">${st==='highlight'?peColorDots(PE_HL_COLORS,pe.mark.hl,'pemarkhl'):peColorDots([PE_TXT_COLORS[0],PE_TXT_COLORS[3],PE_TXT_COLORS[1]],pe.mark.line,'pemarkline')}</span></div><p class="pm-hint">Drag across the words to ${st==='highlight'?'highlight them':st==='underline'?'underline them':'strike through them'}. Tap a mark to move or remove it.</p>`;
    bar.querySelectorAll('[data-pemarkstyle]').forEach(b=>b.addEventListener('click',()=>{pe.mark.style=b.dataset.pemarkstyle;peRenderModeBar()}));
    peWireDots(bar,'pemarkhl',i=>{pe.mark.hl=i});peWireDots(bar,'pemarkline',i=>{pe.mark.line=i});return}
  if(m==='shapes'){const k=pe.shape.kind;
    bar.innerHTML=`<div class="pe-row">${[['rect','Rectangle'],['ellipse','Ellipse'],['line','Line'],['arrow','Arrow']].map(([v,l])=>`<button type="button" class="pe-chip ${k===v?'sel':''}" data-peshape="${v}">${l}</button>`).join('')}<span class="sigrow">${peColorDots(PE_TXT_COLORS,pe.shape.color,'peshapecolor')}</span><button type="button" class="pe-chip ${pe.shape.width===1.5?'sel':''}" data-peshapew="1.5">Thin line</button><button type="button" class="pe-chip ${pe.shape.width===3?'sel':''}" data-peshapew="3">Thick line</button></div><p class="pm-hint">Drag on the page to draw the shape. Tap a shape to move it, or use Duplicate / Delete above it.</p>`;
    bar.querySelectorAll('[data-peshape]').forEach(b=>b.addEventListener('click',()=>{pe.shape.kind=b.dataset.peshape;peRenderModeBar()}));
    bar.querySelectorAll('[data-peshapew]').forEach(b=>b.addEventListener('click',()=>{pe.shape.width=parseFloat(b.dataset.peshapew);peRenderModeBar()}));
    peWireDots(bar,'peshapecolor',i=>{pe.shape.color=i});return}
  if(m==='draw'){
    bar.innerHTML=`<div class="pe-row"><span class="sigrow">${peColorDots(PE_TXT_COLORS,pe.draw.color,'pedrawcolor')}</span><button type="button" class="pe-chip ${pe.draw.width===2?'sel':''}" data-pedraww="2">Thin line</button><button type="button" class="pe-chip ${pe.draw.width===4?'sel':''}" data-pedraww="4">Thick line</button></div><p class="pm-hint">Draw on the page with your finger or mouse — a signature flourish, a circle around a figure, an arrow by hand.</p>`;
    bar.querySelectorAll('[data-pedraww]').forEach(b=>b.addEventListener('click',()=>{pe.draw.width=parseFloat(b.dataset.pedraww);peRenderModeBar()}));
    peWireDots(bar,'pedrawcolor',i=>{pe.draw.color=i});return}
  if(m==='cover'){bar.innerHTML='<p class="pm-hint">Drag a box over anything to cover it — the box takes the page\'s own background colour. Covering HIDES what is underneath; it does not erase it from the file. For sensitive text, use the Redact PDF tool instead.</p>';return}
  if(m==='stamps'){
    bar.innerHTML=`<div class="pe-row">${PE_STAMPS.map((s,i)=>`<button type="button" class="pe-chip pe-stampchip ${i===pe.stamp?'sel':''}" data-pestamp="${i}" style="color:${s.css};border-color:${s.css}">${s.text}</button>`).join('')}</div><p class="pm-hint">Pick a stamp, then tap the page to place it. Drag to move it; resize it from the corner dot.</p>`;
    bar.querySelectorAll('[data-pestamp]').forEach(b=>b.addEventListener('click',()=>{pe.stamp=parseInt(b.dataset.pestamp);peRenderModeBar()}));return}
  if(m==='find'){
    bar.innerHTML=`<div class="pe-row"><div class="field grow"><label for="peFindText">Find</label><input id="peFindText" type="text" placeholder="Words to find, exactly as written"></div><div class="field grow"><label for="peReplaceText">Replace with</label><input id="peReplaceText" type="text" placeholder="New wording"></div><button type="button" class="btn sm" id="peFindGo">Replace all</button></div><p class="pm-hint">Searches the words on every page and re-types each field that contains them — every changed field counts as one edit, and Undo can take them back. Exact match, case-sensitive. <span id="peFindResult" style="font-weight:700"></span></p>`;
    $('peFindGo').addEventListener('click',peFindReplace);return}
  bar.innerHTML='';
}
async function peRenderPage(){
  if(!pe)return;const seq=++peSeq;const pageIdx=pe.page;
  const info=$('pePageInfo');if(info)info.textContent='Page '+(pageIdx+1)+' of '+pe.count;
  const pv=$('pePrev'),nx=$('peNext');if(pv)pv.disabled=pageIdx<=0;if(nx)nx.disabled=pageIdx>=pe.count-1;
  let pg;try{pg=await pe.pdf.getPage(pageIdx+1)}catch(e){return}
  if(!pe||seq!==peSeq)return;
  /* Rotated pages (v4.7.1): placement math assumes rotation 0 — on a
     rotated page, edits would land in the wrong place SILENTLY. The
     editor now detects the rotation, shows a banner, and pauses
     editing/placing on that page instead of guessing. */
  pe.rot=pg.rotate||0;pe.rotCache[pageIdx]=pe.rot;
  const rw=$('peRotWarn');if(rw)rw.classList.toggle('hidden',pe.rot===0);
  const base=pg.getViewport({scale:1});pe.pageW=base.width;pe.pageH=base.height;
  const wrap=$('visualWrap');const targetW=Math.min(960,Math.max(280,(wrap?wrap.clientWidth:960)-16))*pe.zoom;const dpr=Math.min(1.5,window.devicePixelRatio||1);const vp=pg.getViewport({scale:(targetW/base.width)*dpr});
  const c=$('peCanvas');if(!c)return;c.width=vp.width;c.height=vp.height;c.style.width=(vp.width/dpr)+'px';c.style.height=(vp.height/dpr)+'px';
  /* Speed (v4.7.12): rendered page bitmaps are cached per page+zoom,
     so moving back and forth between pages is instant instead of a
     full re-render every time; the preview also paints at up to 1.5x
     device pixels instead of 2x — far fewer pixels on big pages, no
     visible difference on screen. */
  const bkey=pageIdx+'|'+pe.zoom+'|'+Math.round(vp.width)+'x'+Math.round(vp.height);
  if(pe.bmpCache&&pe.bmpCache.key===bkey){try{c.getContext('2d').drawImage(pe.bmpCache.canvas,0,0)}catch(e){}}
  else{try{await pg.render({canvasContext:c.getContext('2d',{willReadFrequently:true}),viewport:vp}).promise;const bc=document.createElement('canvas');bc.width=c.width;bc.height=c.height;bc.getContext('2d').drawImage(c,0,0);pe.bmpCache={key:bkey,canvas:bc}}catch(e){}}
  if(!pe||seq!==peSeq)return;
  await peBuildLines(pg,pageIdx);
  if(!pe||seq!==peSeq)return;
  peDrawOverlay();if(pe.mode==='edit'||pe.mode==='text')peRenderModeBar();
}
/* Lines for one page: PDF.js text items grouped by baseline proximity.
   Each line keeps its rect + baseline as page fractions, its detected
   size and font name; the cover colour is sampled separately. */
function peComputeLines(tc){
  const raw=[];
  tc.items.forEach(it=>{if(typeof it.str!=='string')return;const size=Math.hypot(it.transform[1],it.transform[3])||Math.abs(it.transform[0])||10;raw.push({str:it.str,x:it.transform[4],base:it.transform[5],w:it.width||0,size,fontName:it._fontName||''})});
  const grouped=[];
  raw.forEach(r=>{if(!r.str.trim()&&!r.w)return;let line=grouped.find(l=>Math.abs(l.base-r.base)<=Math.max(2,r.size*.4));if(!line){line={base:r.base,size:r.size,fontName:r.fontName,items:[]};grouped.push(line)}line.items.push(r);if(r.size>line.size){line.size=r.size;line.fontName=r.fontName}});
  /* V4.7.1 — SEGMENTS: each baseline group is split into separately
     editable FIELDS wherever the layout itself separates them: a
     horizontal gap wider than 1.0x the font size (a column gap —
     normal word spaces are ~0.3em, well clear of the threshold), or
     a font-size change over 20% between neighbours. A receipt row
     like "Student Name | Abu Mohammed Safwan | Mobile No | +91..." is
     therefore four tappable fields, not one line, and editing one
     field covers and re-types only that field's own rectangle — the
     rest of the row is never redrawn. (In this codebase a "line"
     object IS one segment; lineIdx indexes segments.) */
  const lines=[];
  grouped.forEach(l=>{
    /* RTL fields (Arabic, Hebrew): the text layer stores glyphs in
       visual order, so reading order is x DESCENDING. Mirror the x
       axis for RTL-dominant groups and the whole segment pipeline —
       sorting, gap splits, space rebuilding — works unchanged in
       reading order; geometry is un-mirrored when the line is built.
       Without this, an Arabic field's words come out scrambled and
       Find & Replace can never match words as a person types them. */
    const joinedAll=l.items.map(r=>r.str).join('');let rc=0;for(const ch of joinedAll)if(PE_RTL_RE.test(ch))rc++;
    const rtl=joinedAll.length>0&&rc/joinedAll.length>.3;
    const items=rtl?l.items.map(r=>({str:r.str,x:-r.x-r.w,w:r.w,size:r.size,fontName:r.fontName,base:r.base})):l.items;
    items.sort((a,b)=>a.x-b.x);
    const segs=[];let cur=null;
    const flush=()=>{if(cur)segs.push(cur);cur=null};
    items.forEach(r=>{
      /* Whitespace-only items are layout filler, never field content:
         wkhtmltopdf emits space runs whose width SPANS the column gap
         (one measured 120pt wide), so counting them would bridge every
         field back into one line. They never start, extend or split a
         segment; word spaces inside a segment are rebuilt from the ink
         items' geometry when the segment text is joined. */
      if(!r.str.trim())return;
      if(cur){const gap=r.x-cur.end;const ref=Math.max(cur.size,r.size);
        if(gap>ref||Math.abs(r.size-cur.size)/ref>.2)flush()}
      if(!cur)cur={base:l.base,size:r.size,fontName:r.fontName,items:[],end:r.x+r.w};
      cur.items.push(r);if(r.x+r.w>cur.end)cur.end=r.x+r.w;
      if(r.size>cur.size){cur.size=r.size;cur.fontName=r.fontName}});
    flush();
    segs.forEach(sg=>{let text='',endX=null;sg.items.forEach(r=>{if(endX!==null&&r.x-endX>sg.size*.25&&!/\s$/.test(text)&&!/^\s/.test(r.str))text+=' ';text+=r.str;if(endX===null||r.x+r.w>endX)endX=r.x+r.w});
      /* Invisible bidi / zero-width controls (Chromium-printed RTL
         files embed them) are formatting, not words — never re-type
         them into the saved file. */
      text=text.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,'');
      if(!text.trim())return;const mx0=Math.min(...sg.items.map(r=>r.x)),mx1=Math.max(...sg.items.map(r=>r.x+r.w));const x0=rtl?-mx1:mx0,x1=rtl?-mx0:mx1;const top=sg.base+sg.size*.85,bot=sg.base-sg.size*.3;
      lines.push({text,base:sg.base,size:sg.size,fontName:sg.fontName,fx:x0/pe.pageW,fw:Math.max(.008,(x1-x0)/pe.pageW),fTop:(pe.pageH-top)/pe.pageH,fh:(top-bot)/pe.pageH,fBase:(pe.pageH-sg.base)/pe.pageH,cover:null})})});
  lines.sort((a,b)=>b.base-a.base);
  return lines;
}
function peMostSize(lines){if(!lines.length)return 12;const freq={};lines.forEach(l=>{const s=Math.max(6,Math.round(l.size));freq[s]=(freq[s]||0)+1});let best=12,n=0;Object.keys(freq).forEach(s=>{if(freq[s]>n){n=freq[s];best=parseInt(s)}});return best}
async function peBuildLines(pg,pageIdx){
  if(!pe)return;const cached=pe.lineCache[pageIdx];if(cached){pe.lines=cached.lines;pe.hasText=cached.hasText;pe.mostSize=cached.mostSize;pe.images=cached.images||[];return}
  let lines=[],hasText=false,mostSize=12,images=[];
  if((pg.rotate||0)!==0){if(pe){pe.lineCache[pageIdx]={lines:[],hasText:false,mostSize:12,images:[],rot:pg.rotate};if(pe.page===pageIdx){pe.lines=[];pe.hasText=false;pe.mostSize=12;pe.images=[]}}return}
  try{const tc=await pg.getTextContent();tc.items.forEach(it=>{it._fontName=peFontName(pg,it)});lines=peComputeLines(tc);hasText=lines.length>0;mostSize=peMostSize(lines);
    const cv=$('peCanvas');if(cv)lines.forEach(l=>{l.cover=peSampleFrom(cv,l.fx,l.fTop,l.fw,l.fh,pe.pageW,pe.pageH);const ink=peDetectInk(cv,l,pe.pageW,pe.pageH);if(ink){l.ink=ink;l.inkCss=peRgbHex(ink)}});
    images=await peExtractImages(pg,pe.pageW,pe.pageH);
  }catch(e){lines=[];hasText=false}
  if(pe){pe.lineCache[pageIdx]={lines,hasText,mostSize,images};if(pe.page===pageIdx){pe.lines=lines;pe.hasText=hasText;pe.mostSize=mostSize;pe.images=images}}
}
/* Lines for any page (Find & Replace): renders that page offscreen at
   scale 1.5 so its cover colours are sampled from the right page. */
async function peLinesForPage(i){
  if(!pe)return{lines:[],rotated:false};if(i===pe.page)return{lines:pe.lines,rotated:pe.rot!==0};const cached=pe.lineCache[i];if(cached)return{lines:cached.lines,rotated:!!cached.rot};
  const pg=await pe.pdf.getPage(i+1);const rot=pg.rotate||0;if(pe)pe.rotCache[i]=rot;
  if(rot){if(pe)pe.lineCache[i]={lines:[],hasText:false,mostSize:12,rot};return{lines:[],rotated:true}}
  const vp=pg.getViewport({scale:1});const save={w:pe.pageW,h:pe.pageH};pe.pageW=vp.width;pe.pageH=vp.height;
  let lines=[];
  try{const tc=await pg.getTextContent();tc.items.forEach(it=>{it._fontName=peFontName(pg,it)});lines=peComputeLines(tc);
    if(lines.length){const v2=pg.getViewport({scale:1.5});const cv=document.createElement('canvas');cv.width=v2.width;cv.height=v2.height;try{await pg.render({canvasContext:cv.getContext('2d',{willReadFrequently:true}),viewport:v2}).promise;lines.forEach(l=>{l.cover=peSampleFrom(cv,l.fx,l.fTop,l.fw,l.fh,vp.width,vp.height);const ink=peDetectInk(cv,l,vp.width,vp.height);if(ink){l.ink=ink;l.inkCss=peRgbHex(ink)}})}catch(e){lines.forEach(l=>{l.cover=[1,1,1]})}}
  }catch(e){lines=[]}
  pe.pageW=save.w;pe.pageH=save.h;
  if(pe)pe.lineCache[i]={lines,hasText:lines.length>0,mostSize:peMostSize(lines),rot:0};
  return{lines,rotated:false};
}
function peMakeEditOp(pageIdx,l,lineIdx,newText,fmt){
  const fam=peFontFam(l.fontName);const bold=fmt?fmt.bold:/bold/i.test(l.fontName||'');const ital=fmt?fmt.italic:/italic|oblique/i.test(l.fontName||'');const col=fmt?{css:fmt.css,rgb:fmt.rgb}:(l.ink?{css:l.inkCss,rgb:l.ink}:PE_TXT_COLORS[0]);
  return {type:'edit',page:pageIdx,lineIdx,fx:l.fx,fTop:l.fTop,fw:l.fw,fh:l.fh,fBase:l.fBase,cfx:l.fx,cTop:l.fTop,size:fmt?fmt.size:Math.round(l.size*10)/10,fontName:l.fontName,fontStd:peFontStd(fam,bold,ital),bold,italic:ital,cover:l.cover||[1,1,1],css:col.css,color:col.rgb,oldText:l.text,newText};
}
function peSelectLine(li){if(!pe)return;const l=pe.lines[li];if(!l)return;pe.editLine=li;pe.imgSel=-1;const oi=pe.ops.findIndex(o=>o.type==='edit'&&o.page===pe.page&&o.lineIdx===li);const ex=oi>=0?pe.ops[oi]:null;
  pe.editFmt={size:ex?ex.size:Math.max(6,Math.round(l.size)),bold:ex?ex.bold:/bold/i.test(l.fontName||''),italic:ex?ex.italic:/italic|oblique/i.test(l.fontName||''),css:ex?ex.css:(l.inkCss||PE_TXT_COLORS[0].css),rgb:ex?ex.color:(l.ink||PE_TXT_COLORS[0].rgb)};
  peRenderModeBar();peDrawOverlay()}
function peUseEdit(){if(!pe||pe.editLine<0||!pe.editFmt)return;const l=pe.lines[pe.editLine];if(!l)return;const inp=$('peEditInput');const nt=(inp?inp.value:'').replace(/\s*\n\s*/g,' ').trim();if(!nt){toast('Type the new wording — or choose “Remove this edit” / Cancel.');return}
  if(!peEncodable(nt)){toast('That wording uses characters the editor\u2019s standard fonts can\u2019t print — scripts like Arabic or Chinese can\u2019t be re-typed here. Latin-letter wording works.');return}
  const oi=pe.ops.findIndex(o=>o.type==='edit'&&o.page===pe.page&&o.lineIdx===pe.editLine);
  const op=peMakeEditOp(pe.page,l,pe.editLine,nt,pe.editFmt);
  if(oi>=0){op.fx=pe.ops[oi].fx;op.fBase=pe.ops[oi].fBase}
  /* Blend-in fit (v4.7.13): unless the user set the size themselves,
     scale the size so the new wording spans the SAME width as the
     field it replaces — an edit then sits in the line instead of
     running noticeably longer or shorter than its neighbours. */
  if(!pe.editFmt.sizeTouched){try{const mc=peMeasureCtx();mc.font=(op.italic?'italic ':'')+(op.bold?'700 ':'')+op.size+'px '+peFontCss(op.fontName);const wNew=mc.measureText(nt).width;const wTarget=l.fw*pe.pageW;if(wNew>4&&wTarget>4){const r=Math.min(1.35,Math.max(.65,wTarget/wNew));op.size=Math.max(6,Math.round(op.size*r*10)/10)}}catch(e){}}
  if(oi>=0){pe.ops[oi]=op;pe.redo=[]}else pe.ops.push(op);
  pe.editLine=-1;peRenderModeBar();peDrawOverlay();peSyncCount()}
let _peMeasCtx=null;
function peMeasureCtx(){if(!_peMeasCtx)_peMeasCtx=document.createElement('canvas').getContext('2d');return _peMeasCtx}
/* Drag a field to a new place (v4.7.13): the cover stays on the
   field's original rectangle; only the re-typed words move. A pure
   move keeps the original wording — the op is an edit whose new text
   equals the old. */
function peMoveLine(li,dx,dy){if(!pe)return;const l=pe.lines[li];if(!l)return;const oi=pe.ops.findIndex(o=>o.type==='edit'&&o.page===pe.page&&o.lineIdx===li);const ex=oi>=0?pe.ops[oi]:null;
  const nfx=Math.min(.98,Math.max(0,(ex?ex.fx:l.fx)+dx)),nfb=Math.min(1,Math.max(.02,(ex?ex.fBase:l.fBase)+dy));
  if(ex){ex.fx=nfx;ex.fBase=nfb;if(ex.cfx===undefined){ex.cfx=l.fx;ex.cTop=l.fTop}}
  else{const op=peMakeEditOp(pe.page,l,li,PE_RTL_RE.test(l.text)?peLogical(l.text):l.text,null);op.fx=nfx;op.fBase=nfb;pe.ops.push(op)}
  pe.redo=[];peDrawOverlay();peSyncCount();toast('Field moved — tap it any time to change its words too.')}
function peDragEditText(e,op,el){if(!pe)return;e.stopPropagation();e.preventDefault();const start=peFrac(e);const ofx=op.fx,ofb=op.fBase;let moved=false;try{el.setPointerCapture(e.pointerId)}catch(_){}
  const cvs=$('peCanvas');const stageH=cvs?cvs.clientHeight:0;const sx=pe.pageW&&cvs?cvs.clientWidth/pe.pageW:1;
  const move=ev=>{const p=peFrac(ev);const dx=p.fx-start.fx,dy=p.fy-start.fy;if(!moved&&Math.hypot(dx,dy)>.004)moved=true;if(!moved)return;op.fx=Math.min(.98,Math.max(0,ofx+dx));op.fBase=Math.min(1,Math.max(.02,ofb+dy));el.style.left=(op.fx*100)+'%';el.style.top=(op.fBase*stageH-op.size*sx*.84)+'px'};
  const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);if(moved){pe.redo=[];peDrawOverlay()}else if(pe.lines[op.lineIdx])peSelectLine(op.lineIdx)};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)}
/* Lift a picture off the page (v4.7.13): copy its pixels from the
   rendered preview, cover the original spot, and drop the copy back
   as a free image element the user can drag anywhere and resize.
   The copy is a picture of the picture at preview resolution —
   plenty for logos and photos placed back at a similar size. */
async function peMoveImage(){if(!pe||pe.imgSel<0||!pe.images[pe.imgSel])return;const im=pe.images[pe.imgSel];const cv=$('peCanvas');if(!cv){toast('The preview is not ready yet — try again in a moment.');return}
  try{const sx=cv.width/pe.pageW,sy=cv.height/pe.pageH;const x0=Math.max(0,Math.round(im.fx*pe.pageW*sx)),y0=Math.max(0,Math.round(im.fTop*pe.pageH*sy)),w=Math.min(cv.width-x0,Math.round(im.fw*pe.pageW*sx)),h=Math.min(cv.height-y0,Math.round(im.fh*pe.pageH*sy));if(w<4||h<4){toast('That picture is too small to lift.');return}
    const c2=document.createElement('canvas');c2.width=w;c2.height=h;c2.getContext('2d').drawImage(cv,x0,y0,w,h,0,0,w,h);
    const blob=await new Promise(r=>c2.toBlob(r,'image/png'));if(!blob){toast('That picture could not be lifted — Cover or Replace still work.');return}
    const buf=new Uint8Array(await blob.arrayBuffer());const url=URL.createObjectURL(blob);const cov=peSampleFrom(cv,im.fx,im.fTop,im.fw,im.fh,pe.pageW,pe.pageH);
    pePushOp({type:'cover',page:pe.page,fx:im.fx,fy:im.fTop,fw:im.fw,fh:im.fh,cover:cov},false);
    pePushOp({type:'image',page:pe.page,fx:im.fx,fy:im.fTop,fw:im.fw,fh:im.fh,bytes:buf,format:'png',url,aspect:(im.fw*pe.pageW)/Math.max(1,im.fh*pe.pageH),sign:false},true);
    pe.imgSel=-1;peDrawOverlay();toast('Picture lifted — drag it anywhere on the page, resize from the corner dot.')}catch(e){toast('That picture could not be lifted — Cover or Replace still work.')}}
async function peFindReplace(){
  if(!pe)return;const fEl=$('peFindText'),rEl=$('peReplaceText'),res=$('peFindResult');const find=fEl?fEl.value:'';const repl=rEl?rEl.value:'';
  if(!find){toast('Type the words to find first.');return}
  let updated=0,skipped=0,rotSkipped=0;
  for(let i=0;i<pe.count;i++){const got=await peLinesForPage(i);if(!pe)return;if(got.rotated){rotSkipped++;continue}
    got.lines.forEach((l,li)=>{const rtl=PE_RTL_RE.test(l.text);const hay=rtl?peLogical(l.text):l.text;const ndl=rtl?find.normalize('NFKC'):find;if(!hay.includes(ndl))return;const nt=hay.split(ndl).join(repl);if(nt===hay)return;
      /* A hit whose RESULT still can't be printed by the standard
         fonts (e.g. one word replaced inside an Arabic field) is
         skipped and reported — never saved as a broken edit. */
      if(!peEncodable(nt)){skipped++;return}
      const oi=pe.ops.findIndex(o=>o.type==='edit'&&o.page===i&&o.lineIdx===li);
      const op=peMakeEditOp(i,l,li,nt,null);
      if(oi>=0)pe.ops[oi]=op;else pe.ops.push(op);updated++})}
  pe.redo=[];pe.sel=-1;peDrawOverlay();peSyncCount();
  const notes=[];if(skipped)notes.push(skipped+' field'+(skipped===1?'':'s')+' skipped — that script can\u2019t be re-typed');if(rotSkipped)notes.push('rotated pages are not searched');
  if(res)res.textContent=updated?updated+' field'+(updated===1?'':'s')+' updated.'+(notes.length?' ('+notes.join('; ')+')':''):(notes.length?'No fields updated ('+notes.join('; ')+').':'No matches found.');
  toast(updated?('Find & Replace: '+updated+' field'+(updated===1?'':'s')+' updated.'):'Find & Replace: no fields updated.')}
function peOpBBox(op){
  if(op.type==='text')return{fx:op.fx,fy:op.fBase-(op.size/Math.max(1,pe.pageH))*1.05,fw:.2,fh:(op.size/Math.max(1,pe.pageH))*1.3};
  if(op.type==='draw'){let x0=1,y0=1,x1=0,y1=0;op.points.forEach(p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1])});return{fx:x0,fy:y0,fw:Math.max(.01,x1-x0),fh:Math.max(.01,y1-y0)}}
  if(op.type==='shape'&&op.fx2!==undefined)return{fx:Math.min(op.fx,op.fx2),fy:Math.min(op.fy,op.fy2),fw:Math.max(.01,Math.abs(op.fx2-op.fx)),fh:Math.max(.01,Math.abs(op.fy2-op.fy))};
  return{fx:op.fx,fy:op.fy!==undefined?op.fy:op.fTop,fw:op.fw,fh:op.fh};
}
function peSvgEl(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const k in attrs)el.setAttribute(k,attrs[k]);return el}
function peDrawOverlay(){
  if(!pe)return;const ov=$('peOverlay');if(!ov)return;ov.innerHTML='';
  const cvs=$('peCanvas');const stageW=ov.clientWidth||(cvs?cvs.clientWidth:0),stageH=ov.clientHeight||(cvs?cvs.clientHeight:0);
  const sx=pe.pageW?stageW/pe.pageW:1;
  /* Shapes + freehand live on one SVG layer (vector-effect keeps the
     stroke width honest at any page aspect). */
  const svg=peSvgEl('svg',{viewBox:'0 0 1000 1000',preserveAspectRatio:'none','class':'pe-svg'});
  const shapeOps=[];
  pe.ops.forEach((op,i)=>{if(op.page!==pe.page)return;
    if(op.type==='shape'){const col=PE_TXT_COLORS[op.color];let el=null;const bb=peOpBBox(op);
      if(op.kind==='rect')el=peSvgEl('rect',{x:bb.fx*1000,y:bb.fy*1000,width:bb.fw*1000,height:bb.fh*1000,fill:'none',stroke:col.css,'stroke-width':op.width,'vector-effect':'non-scaling-stroke'});
      else if(op.kind==='ellipse')el=peSvgEl('ellipse',{cx:(bb.fx+bb.fw/2)*1000,cy:(bb.fy+bb.fh/2)*1000,rx:bb.fw*500,ry:bb.fh*500,fill:'none',stroke:col.css,'stroke-width':op.width,'vector-effect':'non-scaling-stroke'});
      else{el=peSvgEl('g',{});el.appendChild(peSvgEl('line',{x1:op.fx*1000,y1:op.fy*1000,x2:op.fx2*1000,y2:op.fy2*1000,stroke:col.css,'stroke-width':op.width,'vector-effect':'non-scaling-stroke'}));
        if(op.kind==='arrow'){const dx=(op.fx2-op.fx)*1000,dy=(op.fy2-op.fy)*1000;const len=Math.max(1,Math.hypot(dx,dy));const hx=Math.min(26,len*.3),a=Math.atan2(dy,dx);[[a+2.6],[a-2.6]].forEach(([ang])=>{el.appendChild(peSvgEl('line',{x1:op.fx2*1000,y1:op.fy2*1000,x2:op.fx2*1000+hx*Math.cos(ang),y2:op.fy2*1000+hx*Math.sin(ang),stroke:col.css,'stroke-width':op.width,'vector-effect':'non-scaling-stroke'}))})}}
      if(el){el.dataset.op=i;svg.appendChild(el);shapeOps.push(i)}}
    else if(op.type==='draw'){const col=PE_TXT_COLORS[op.color];const pl=peSvgEl('polyline',{points:op.points.map(p=>(p[0]*1000)+','+(p[1]*1000)).join(' '),fill:'none',stroke:col.css,'stroke-width':op.width,'vector-effect':'non-scaling-stroke','stroke-linejoin':'round','stroke-linecap':'round'});pl.dataset.op=i;svg.appendChild(pl);shapeOps.push(i)}
  });
  ov.appendChild(svg);
  pe.ops.forEach((op,i)=>{if(op.page!==pe.page)return;const d=document.createElement('div');d.dataset.op=i;
    if(op.type==='edit'){const ecx=op.cfx!==undefined?op.cfx:op.fx,ect=op.cTop!==undefined?op.cTop:op.fTop;d.className='pe-opedit';d.style.left=(ecx*100)+'%';d.style.top=(ect*100)+'%';d.style.width=(op.fw*100)+'%';d.style.height=(op.fh*100)+'%';d.style.background='rgb('+op.cover.map(v=>Math.round(v*255)).join(',')+')';
      const s=document.createElement('div');s.className='pe-opmovtext';s.textContent=op.newText;s.style.left=(op.fx*100)+'%';s.style.top=(op.fBase*stageH-op.size*sx*.84)+'px';s.style.fontSize=(op.size*sx)+'px';s.style.fontFamily=peFontCss(op.fontName);if(op.bold)s.style.fontWeight='700';if(op.italic)s.style.fontStyle='italic';s.style.color=op.css;s.title='Drag to move this text — tap to edit it';s.addEventListener('pointerdown',e=>peDragEditText(e,op,s));d._movtext=s}
    else if(op.type==='text'){d.className='pe-optext';d.style.left=(op.fx*100)+'%';d.style.top=(op.fBase*100)+'%';d.style.fontSize=(op.size*sx)+'px';d.style.color=op.css;if(op.bold)d.style.fontWeight='700';d.textContent=op.text;peWireObject(d,i,null)}
    else if(op.type==='image'){d.className='pe-opimg';const img=document.createElement('img');img.src=op.url;img.alt=op.sign?'Your signature':'Added image';d.appendChild(img);d.style.left=(op.fx*100)+'%';d.style.top=(op.fy*100)+'%';d.style.width=(op.fw*100)+'%';d.style.height=(op.fh*100)+'%';const h=document.createElement('div');h.className='pe-handle';h.title='Drag to resize';d.appendChild(h);peWireObject(d,i,null);peWireHandle(h,d,i)}
    else if(op.type==='mark'){d.className='pe-opmark';const col=op.style==='highlight'?PE_HL_COLORS[op.color]:[PE_TXT_COLORS[0],PE_TXT_COLORS[3],PE_TXT_COLORS[1]][op.color];if(op.style==='highlight'){d.style.background=col.css}else{const ln=document.createElement('div');ln.className='pe-markline '+(op.style==='strike'?'strike':'under');ln.style.background=col.css;d.appendChild(ln)}d.style.left=(op.fx*100)+'%';d.style.top=(op.fy*100)+'%';d.style.width=(op.fw*100)+'%';d.style.height=(op.fh*100)+'%';peWireObject(d,i,null)}
    else if(op.type==='cover'){d.className='pe-cover';d.style.background='rgb('+op.cover.map(v=>Math.round(v*255)).join(',')+')';d.style.left=(op.fx*100)+'%';d.style.top=(op.fy*100)+'%';d.style.width=(op.fw*100)+'%';d.style.height=(op.fh*100)+'%';peWireObject(d,i,null)}
    else if(op.type==='stamp'){const st=PE_STAMPS[op.preset];d.className='pe-stamp';d.style.left=(op.fx*100)+'%';d.style.top=(op.fy*100)+'%';d.style.width=(op.fw*100)+'%';d.style.height=(op.fh*100)+'%';d.style.color=st.css;d.style.borderColor=st.css;d.style.fontSize=((op.fs0*(op.fw/op.fw0))*sx)+'px';d.textContent=st.text;const h=document.createElement('div');h.className='pe-handle';h.title='Drag to resize';d.appendChild(h);peWireObject(d,i,null);peWireHandle(h,d,i)}
    else if(op.type==='shape'||op.type==='draw'){const bb=peOpBBox(op);d.className='pe-hit';d.style.left=(bb.fx*100)+'%';d.style.top=(bb.fy*100)+'%';d.style.width=(bb.fw*100)+'%';d.style.height=(bb.fh*100)+'%';const node=svg.querySelector('[data-op="'+i+'"]');peWireObject(d,i,node)}
    else return;
    if(op.type!=='edit'&&pe.sel===i)d.classList.add('sel');
    ov.appendChild(d);if(d._movtext)ov.appendChild(d._movtext)});
  /* Floating actions for the selected object (Sejda/Smallpdf pattern). */
  if(pe.sel>=0&&pe.ops[pe.sel]&&pe.ops[pe.sel].page===pe.page&&pe.ops[pe.sel].type!=='edit'){
    const op=pe.ops[pe.sel];const bb=peOpBBox(op);const bar=document.createElement('div');bar.className='pe-actions';
    const above=bb.fy>.09;bar.style.left=Math.min(92,Math.max(0,bb.fx*100))+'%';bar.style.top=(above?(bb.fy*100-6.5):(bb.fy+bb.fh)*100+1.2)+'%';if(above)bar.style.transform='translateY(-100%)';
    const dup=document.createElement('button');dup.type='button';dup.innerHTML=icon('layers',14)+' Duplicate';dup.addEventListener('pointerdown',e=>e.stopPropagation());dup.addEventListener('click',e=>{e.stopPropagation();peDuplicate(pe.sel)});
    const del=document.createElement('button');del.type='button';del.innerHTML=icon('trash-2',14)+' Delete';del.addEventListener('pointerdown',e=>e.stopPropagation());del.addEventListener('click',e=>{e.stopPropagation();if(!pe)return;pe.ops.splice(pe.sel,1);pe.redo=[];pe.sel=-1;peDrawOverlay();peSyncCount()});
    bar.appendChild(dup);bar.appendChild(del);ov.appendChild(bar)}
  if(pe.mode==='edit'&&!pe.rot&&pe.images&&pe.images.length){pe.images.forEach((im,ii)=>{const d=document.createElement('div');d.className='pe-imgel'+(pe.imgSel===ii?' sel':'');d.style.left=(im.fx*100)+'%';d.style.top=(im.fTop*100)+'%';d.style.width=(im.fw*100)+'%';d.style.height=(im.fh*100)+'%';d.title='Picture — tap to cover or replace it';d.addEventListener('pointerdown',e=>{e.stopPropagation();pe.imgSel=ii;pe.editLine=-1;peRenderModeBar();peDrawOverlay()});ov.appendChild(d)});
    if(pe.imgSel>=0&&pe.images[pe.imgSel]){const im=pe.images[pe.imgSel];const bar=document.createElement('div');bar.className='pe-actions';const above=im.fTop>.09;bar.style.left=Math.min(92,Math.max(0,im.fx*100))+'%';bar.style.top=(above?(im.fTop*100-6.5):(im.fTop+im.fh)*100+1.2)+'%';if(above)bar.style.transform='translateY(-100%)';
      const cov=document.createElement('button');cov.type='button';cov.innerHTML=icon('eye-off',14)+' Cover (hide)';cov.addEventListener('pointerdown',e=>e.stopPropagation());cov.addEventListener('click',e=>{e.stopPropagation();if(!pe)return;const cv2=$('peCanvas');const covr=cv2?peSampleFrom(cv2,im.fx,im.fTop,im.fw,im.fh,pe.pageW,pe.pageH):[1,1,1];pePushOp({type:'cover',page:pe.page,fx:im.fx,fy:im.fTop,fw:im.fw,fh:im.fh,cover:covr},false);pe.imgSel=-1;toast('Picture covered — Undo can bring it back.')});
      const mv=document.createElement('button');mv.type='button';mv.innerHTML=icon('move',14)+' Move';mv.addEventListener('pointerdown',e=>e.stopPropagation());mv.addEventListener('click',e=>{e.stopPropagation();peMoveImage()});
      const rep=document.createElement('button');rep.type='button';rep.innerHTML=icon('image-plus',14)+' Replace…';rep.addEventListener('pointerdown',e=>e.stopPropagation());rep.addEventListener('click',e=>{e.stopPropagation();const inp=$('peImgRepFile');if(inp)inp.click()});
      const dn=document.createElement('button');dn.type='button';dn.innerHTML=icon('x',14)+' Done';dn.addEventListener('pointerdown',e=>e.stopPropagation());dn.addEventListener('click',e=>{e.stopPropagation();pe.imgSel=-1;peDrawOverlay()});
      bar.appendChild(cov);bar.appendChild(mv);bar.appendChild(rep);bar.appendChild(dn);ov.appendChild(bar)}}
  if(pe.mode==='edit'&&pe.hasText){pe.lines.forEach((l,li)=>{const h=document.createElement('div');h.className='pe-line'+(pe.editLine===li?' sel':'');h.style.left=(l.fx*100)+'%';h.style.top=(l.fTop*100)+'%';h.style.width=(l.fw*100)+'%';h.style.height=(l.fh*100)+'%';h.title='Tap to edit this field — or drag it to a new place';
    h.addEventListener('pointerdown',e=>{e.stopPropagation();const start=peFrac(e);let moved=false;try{h.setPointerCapture(e.pointerId)}catch(_){}
      const move=ev=>{const p=peFrac(ev);if(!moved&&Math.hypot(p.fx-start.fx,p.fy-start.fy)>.006)moved=true;if(moved){h.style.left=((l.fx+(p.fx-start.fx))*100)+'%';h.style.top=((l.fTop+(p.fy-start.fy))*100)+'%'}};
      const up=ev=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);if(!moved){peSelectLine(li);return}const p=peFrac(ev);peMoveLine(li,p.fx-start.fx,p.fy-start.fy)};
      h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up)});ov.appendChild(h)})}
}
/* Deep-copy an op (image bytes/URL ride along by reference, as they
   always have here) + the shared slight-offset placement used by
   Duplicate and by Copy/Paste. */
function peCloneOp(src){const c=JSON.parse(JSON.stringify(src));if(src.type==='image'){c.bytes=src.bytes;c.url=src.url}return c}
function peOffsetOp(c){
  if(c.type==='draw'){c.points=c.points.map(p=>[Math.min(1,p[0]+.03),Math.min(1,p[1]+.03)])}
  else if(c.type==='text'){c.fx=Math.min(.95,c.fx+.03);c.fBase=Math.min(1,c.fBase+.03)}
  else{c.fx=Math.min(1-(c.fw||0),c.fx+.03);if(c.fy!==undefined)c.fy=Math.min(1-(c.fh||0),c.fy+.03);if(c.fTop!==undefined)c.fTop=Math.min(1,c.fTop+.03);if(c.fBase!==undefined)c.fBase=Math.min(1,c.fBase+.03);if(c.fx2!==undefined){c.fx2=Math.min(1,c.fx2+.03);c.fy2=Math.min(1,c.fy2+.03)}}}
function peDuplicate(i){if(!pe||!pe.ops[i])return;const c=peCloneOp(pe.ops[i]);peOffsetOp(c);pePushOp(c,true);toast('Duplicated.')}
function peDeleteSel(){if(!pe||pe.sel<0||!pe.ops[pe.sel])return;pe.ops.splice(pe.sel,1);pe.redo=[];pe.sel=-1;peDrawOverlay();peSyncCount()}
let peClip=null;
function peNudge(dx,dy){if(!pe||pe.sel<0)return;const op=pe.ops[pe.sel];if(!op||op.type==='edit')return;const cx=v=>Math.min(1,Math.max(0,v));
  if(op.type==='text'){op.fx=cx(op.fx+dx);op.fBase=Math.min(1,Math.max(.02,op.fBase+dy))}
  else if(op.type==='draw'){op.points=op.points.map(p=>[cx(p[0]+dx),cx(p[1]+dy)])}
  else if(op.type==='shape'&&op.fx2!==undefined){op.fx+=dx;op.fy+=dy;op.fx2+=dx;op.fy2+=dy}
  else if(op.fx!==undefined&&op.fw!==undefined){op.fx=Math.min(1-op.fw,Math.max(0,op.fx+dx));if(op.fy!==undefined)op.fy=Math.min(1-op.fh,Math.max(0,op.fy+dy))}
  peDrawOverlay()}
/* Keyboard control (v4.7.1): Ctrl/Cmd+Z undo, Ctrl+Shift+Z and
   Ctrl+Y redo, Ctrl/Cmd+C / X / V copy, cut and paste the selected
   object (internal clipboard), Ctrl/Cmd+D duplicate, Delete /
   Backspace removes the selection, arrow keys nudge it by one
   screen pixel (Shift = 10x), Esc cancels an open line edit, then
   deselects, then closes the page-numbers panel. The typing guard
   is absolute: while any input, textarea, select or contentEditable
   has focus — the inline field editor included — native behaviour
   wins (native Ctrl+Z text undo, native Ctrl+C/V for text) and
   this handler does nothing at all. */
document.addEventListener('keydown',e=>{
  if(!pe||!current||current.id!=='pdf-editor')return;
  const t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
  const mod=e.ctrlKey||e.metaKey;const k=(e.key||'').toLowerCase();
  if(mod&&k==='z'&&!e.shiftKey){e.preventDefault();peDoUndo();return}
  if(mod&&((k==='z'&&e.shiftKey)||k==='y')){e.preventDefault();peDoRedo();return}
  if(mod&&k==='c'){const op=pe.sel>=0?pe.ops[pe.sel]:null;if(op&&op.type!=='edit'){e.preventDefault();peClip=peCloneOp(op);toast('Copied — paste with Ctrl+V.')}return}
  if(mod&&k==='x'){const op=pe.sel>=0?pe.ops[pe.sel]:null;if(op&&op.type!=='edit'){e.preventDefault();peClip=peCloneOp(op);peDeleteSel();toast('Cut — paste with Ctrl+V.')}return}
  if(mod&&k==='v'){if(peClip){e.preventDefault();const c=peCloneOp(peClip);c.page=pe.page;peOffsetOp(c);pePushOp(c,true)}return}
  if(mod&&k==='d'){if(pe.sel>=0){e.preventDefault();peDuplicate(pe.sel)}return}
  if(mod)return;
  if(e.key==='Delete'||e.key==='Backspace'){if(pe.sel>=0){e.preventDefault();peDeleteSel()}return}
  if(e.key==='Escape'){if(pe.editLine>=0){pe.editLine=-1;peRenderModeBar();peDrawOverlay()}else if(pe.sel>=0){pe.sel=-1;peDrawOverlay()}else{const p=$('pePn');if(p&&!p.classList.contains('hidden')){p.classList.add('hidden');const b=$('pePnBtn');if(b)b.classList.remove('sel')}}return}
  if(e.key.indexOf('Arrow')===0&&pe.sel>=0){const cvs=$('peCanvas');if(!cvs)return;const st=e.shiftKey?10:1;const dx=(e.key==='ArrowRight'?st:e.key==='ArrowLeft'?-st:0)/Math.max(1,cvs.clientWidth);const dy=(e.key==='ArrowDown'?st:e.key==='ArrowUp'?-st:0)/Math.max(1,cvs.clientHeight);if(dx||dy){e.preventDefault();peNudge(dx,dy)}return}
});
/* Placed objects: tap selects (class-only, no redraw), drag moves at
   pointer speed by mutating style; the op commits live and the overlay
   re-syncs once on release. `linked` is an SVG node (shapes/draw) that
   follows the drag through a CSS transform. */
function peWireObject(d,i,linked){
  d.addEventListener('pointerdown',e=>{
    if(e.target.closest('.pe-handle')||e.target.closest('.pe-actions'))return;
    e.stopPropagation();if(!pe)return;const op=pe.ops[i];if(!op)return;
    if(pe.sel!==i){pe.sel=i;peDrawOverlay();return}
    const start=peFrac(e);const orig=JSON.parse(JSON.stringify(op));const bb0=peOpBBox(op);
    try{d.setPointerCapture(e.pointerId)}catch(_){}
    const move=ev=>{const p=peFrac(ev);const dx=p.fx-start.fx,dy=p.fy-start.fy;
      if(op.type==='text'){op.fx=Math.min(1,Math.max(0,orig.fx+dx));op.fBase=Math.min(1,Math.max(.02,orig.fBase+dy));d.style.left=(op.fx*100)+'%';d.style.top=(op.fBase*100)+'%'}
      else if(op.type==='draw'){d.style.left=((bb0.fx+dx)*100)+'%';d.style.top=((bb0.fy+dy)*100)+'%';if(linked)linked.style.transform=`translate(${dx*1000}px,${dy*1000}px)`}
      else if(op.type==='shape'&&orig.fx2!==undefined){op.fx=orig.fx+dx;op.fy=orig.fy+dy;op.fx2=orig.fx2+dx;op.fy2=orig.fy2+dy;d.style.left=((bb0.fx+dx)*100)+'%';d.style.top=((bb0.fy+dy)*100)+'%';if(linked)linked.style.transform=`translate(${dx*1000}px,${dy*1000}px)`}
      else{op.fx=Math.min(1-op.fw,Math.max(0,orig.fx+dx));op.fy=Math.min(1-op.fh,Math.max(0,orig.fy+dy));d.style.left=(op.fx*100)+'%';d.style.top=(op.fy*100)+'%';if(linked)linked.style.transform=`translate(${dx*1000}px,${dy*1000}px)`}};
    const up=ev=>{d.removeEventListener('pointermove',move);d.removeEventListener('pointerup',up);d.removeEventListener('pointercancel',up);
      if(op.type==='draw'){const p=peFrac(ev);const dx=p.fx-start.fx,dy=p.fy-start.fy;op.points=orig.points.map(pt=>[Math.min(1,Math.max(0,pt[0]+dx)),Math.min(1,Math.max(0,pt[1]+dy))])}
      if(linked)linked.style.transform='';peDrawOverlay()};
    d.addEventListener('pointermove',move);d.addEventListener('pointerup',up);d.addEventListener('pointercancel',up)});
}
function peWireHandle(h,d,i){
  h.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();if(!pe)return;const op=pe.ops[i];if(!op)return;const start=peFrac(e);const ofw=op.fw;
    try{h.setPointerCapture(e.pointerId)}catch(_){}
    const move=ev=>{const p=peFrac(ev);op.fw=Math.min(1-op.fx,Math.max(.04,ofw+(p.fx-start.fx)));op.fh=op.fw*pe.pageW/(op.aspect*pe.pageH);if(op.fh>1-op.fy){op.fh=1-op.fy;op.fw=op.fh*op.aspect*pe.pageH/pe.pageW}d.style.width=(op.fw*100)+'%';d.style.height=(op.fh*100)+'%';if(op.type==='stamp')d.style.fontSize=((op.fs0*(op.fw/op.fw0))*(($('peCanvas')?$('peCanvas').clientWidth:0)/Math.max(1,pe.pageW)))+'px'};
    const up=()=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);peDrawOverlay()};
    h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up)});
}
/* Drag-create on the empty page: cb receives the normalized rect (or
   the raw start/end for lines) once, on release. */
function peDragCreate(e,makeGhost,onDone){
  const ov=$('peOverlay');const start=peFrac(e);try{ov.setPointerCapture(e.pointerId)}catch(_){}
  const ghost=makeGhost(start);if(ghost)ov.appendChild(ghost);let last={fx:start.fx,fy:start.fy};
  const move=ev=>{last=peFrac(ev);if(ghost&&ghost._upd)ghost._upd(start,last)};
  const up=()=>{ov.removeEventListener('pointermove',move);ov.removeEventListener('pointerup',up);ov.removeEventListener('pointercancel',up);if(ghost)ghost.remove();onDone(start,last)};
  ov.addEventListener('pointermove',move);ov.addEventListener('pointerup',up);ov.addEventListener('pointercancel',up);
}
function peRectGhost(cls){const g=rectDiv({fx:0,fy:0,fw:0,fh:0},cls);g._upd=(a,b)=>{const r={fx:Math.min(a.fx,b.fx),fy:Math.min(a.fy,b.fy),fw:Math.abs(b.fx-a.fx),fh:Math.abs(b.fy-a.fy)};g.style.left=(r.fx*100)+'%';g.style.top=(r.fy*100)+'%';g.style.width=(r.fw*100)+'%';g.style.height=(r.fh*100)+'%';g._r=r};return g}
function peNormRect(a,b){return{fx:Math.min(a.fx,b.fx),fy:Math.min(a.fy,b.fy),fw:Math.abs(b.fx-a.fx),fh:Math.abs(b.fy-a.fy)}}
function peAttachStage(){
  const ov=$('peOverlay');if(!ov)return;
  ov.addEventListener('pointerdown',e=>{
    if(!pe||e.target!==ov)return;
    if(pe.rot){toast('This page is rotated — editing and placing are paused on rotated pages.');return}
    if(pe.mode==='text'){const t=pe.txt.text.trim();if(!t){toast('Type the text in the bar above first.');return}if(!peEncodable(t)){toast('That text uses characters the editor\u2019s standard fonts can\u2019t print — scripts like Arabic or Chinese can\u2019t be added as text here.');return}const p=peFrac(e);const col=pe.txt.custCss?{css:pe.txt.custCss,rgb:pe.txt.custRgb}:PE_TXT_COLORS[pe.txt.color];pePushOp({type:'text',page:pe.page,fx:p.fx,fBase:p.fy,text:t,size:pe.txt.size,color:col.rgb,css:col.css,bold:pe.txt.bold},true);return}
    if(pe.mode==='stamps'){pePlaceStamp(peFrac(e));return}
    if(pe.mode==='mark'){const st=pe.mark.style;peDragCreate(e,()=>peRectGhost(st==='highlight'?'pe-opmark ghost':'pe-hit ghost'),(a,b)=>{const r=peNormRect(a,b);if(r.fw>.008&&r.fh>.006){r.type='mark';r.page=pe.page;r.style=st;r.color=st==='highlight'?pe.mark.hl:pe.mark.line;pePushOp(r,true)}else{peDrawOverlay()}});return}
    if(pe.mode==='cover'){peDragCreate(e,()=>peRectGhost('pe-cover ghost'),(a,b)=>{const r=peNormRect(a,b);if(r.fw>.008&&r.fh>.006){const cv=$('peCanvas');r.type='cover';r.page=pe.page;r.cover=cv?peSampleFrom(cv,r.fx,r.fy,r.fw,r.fh,pe.pageW,pe.pageH):[1,1,1];pePushOp(r,true)}else{peDrawOverlay()}});return}
    if(pe.mode==='shapes'){const kind=pe.shape.kind;const col=PE_TXT_COLORS[pe.shape.color];
      peDragCreate(e,s=>{const svg=peSvgEl('svg',{viewBox:'0 0 1000 1000',preserveAspectRatio:'none','class':'pe-svg'});let el=null;
        if(kind==='rect'){el=peSvgEl('rect',{fill:'none',stroke:col.css,'stroke-width':pe.shape.width,'vector-effect':'non-scaling-stroke'})}
        else if(kind==='ellipse'){el=peSvgEl('ellipse',{fill:'none',stroke:col.css,'stroke-width':pe.shape.width,'vector-effect':'non-scaling-stroke'})}
        else{el=peSvgEl('line',{stroke:col.css,'stroke-width':pe.shape.width,'vector-effect':'non-scaling-stroke'})}
        svg.appendChild(el);svg._upd=(a,b)=>{if(kind==='rect'){const r=peNormRect(a,b);el.setAttribute('x',r.fx*1000);el.setAttribute('y',r.fy*1000);el.setAttribute('width',r.fw*1000);el.setAttribute('height',r.fh*1000)}else if(kind==='ellipse'){const r=peNormRect(a,b);el.setAttribute('cx',(r.fx+r.fw/2)*1000);el.setAttribute('cy',(r.fy+r.fh/2)*1000);el.setAttribute('rx',r.fw*500);el.setAttribute('ry',r.fh*500)}else{el.setAttribute('x1',a.fx*1000);el.setAttribute('y1',a.fy*1000);el.setAttribute('x2',b.fx*1000);el.setAttribute('y2',b.fy*1000)}};return svg},
      (a,b)=>{if(kind==='line'||kind==='arrow'){if(Math.hypot(b.fx-a.fx,b.fy-a.fy)>.01)pePushOp({type:'shape',kind,page:pe.page,fx:a.fx,fy:a.fy,fx2:b.fx,fy2:b.fy,color:pe.shape.color,width:pe.shape.width},true);else peDrawOverlay()}
        else{const r=peNormRect(a,b);if(r.fw>.008&&r.fh>.008){r.type='shape';r.kind=kind;r.page=pe.page;r.color=pe.shape.color;r.width=pe.shape.width;pePushOp(r,true)}else peDrawOverlay()}});return}
    if(pe.mode==='draw'){const col=PE_TXT_COLORS[pe.draw.color];const pts=[[peFrac(e).fx,peFrac(e).fy]];
      const svg=peSvgEl('svg',{viewBox:'0 0 1000 1000',preserveAspectRatio:'none','class':'pe-svg'});const pl=peSvgEl('polyline',{fill:'none',stroke:col.css,'stroke-width':pe.draw.width,'vector-effect':'non-scaling-stroke','stroke-linejoin':'round','stroke-linecap':'round'});svg.appendChild(pl);ov.appendChild(svg);
      try{ov.setPointerCapture(e.pointerId)}catch(_){}
      const move=ev=>{const p=peFrac(ev);const last=pts[pts.length-1];if(Math.hypot(p.fx-last[0],p.fy-last[1])>.0035){pts.push([p.fx,p.fy]);pl.setAttribute('points',pts.map(q=>(q[0]*1000)+','+(q[1]*1000)).join(' '))}};
      const up=()=>{ov.removeEventListener('pointermove',move);ov.removeEventListener('pointerup',up);ov.removeEventListener('pointercancel',up);svg.remove();if(pts.length>2)pePushOp({type:'draw',page:pe.page,points:pts,color:pe.draw.color,width:pe.draw.width},true);else peDrawOverlay()};
      ov.addEventListener('pointermove',move);ov.addEventListener('pointerup',up);ov.addEventListener('pointercancel',up);return}
    if(pe.sel!==-1){pe.sel=-1;peDrawOverlay()}
  });
}
async function peAddImageFile(f){if(!pe)return;try{const buf=new Uint8Array(await f.arrayBuffer());const isPng=/\.png$/i.test(f.name)||/png/.test(f.type);const url=URL.createObjectURL(f);const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url});const aspect=img.width/Math.max(1,img.height);let fw=.34,fh=fw*pe.pageW/(aspect*pe.pageH);if(fh>.9){fh=.9;fw=fh*aspect*pe.pageH/pe.pageW}pePushOp({type:'image',page:pe.page,fx:Math.max(0,(1-fw)/2),fy:Math.max(0,(1-fh)/2),fw,fh,bytes:buf,format:isPng?'png':'jpg',url,aspect,sign:false},true);toast('Image placed — drag it into position.')}catch(e){toast('That image could not be read — try a PNG or JPG.')}}
async function pePlaceSig(){if(!pe)return;if(!sigDrawn||!sigArt){peShowSig();toast('Create your signature first — draw it, type it, or upload a picture.');return}
  try{const blob=await new Promise(r=>sigArt.toBlob(r,'image/png'));const buf=new Uint8Array(await blob.arrayBuffer());const aspect=sigArt.width/Math.max(1,sigArt.height);let fw=.38,fh=fw*pe.pageW/(aspect*pe.pageH);if(fh>.9){fh=.9;fw=fh*aspect*pe.pageH/pe.pageW}pePushOp({type:'image',page:pe.page,fx:Math.min(.6,.52),fy:Math.min(.85,.7),fw,fh,bytes:buf,format:'png',url:sigArt.toDataURL('image/png'),aspect,sign:true},true);toast('Signature placed — drag it into position.')}catch(e){toast('The signature could not be placed — try creating it again.')}}
function pePlaceStamp(p){if(!pe)return;const st=PE_STAMPS[pe.stamp];const meas=document.createElement('canvas').getContext('2d');let fs=17;meas.font='800 '+fs+'px Helvetica,Arial,sans-serif';let tw=meas.measureText(st.text).width;let bw=tw+24,bh=32;if(bw>pe.pageW*.82){const sc=pe.pageW*.82/bw;fs=Math.max(9,Math.round(fs*sc));bw*=sc;bh*=sc;tw*=sc}
  const fw=bw/pe.pageW,fh=bh/pe.pageH;const fx=Math.min(1-fw,Math.max(0,p.fx-fw/2)),fy=Math.min(1-fh,Math.max(0,p.fy-fh/2));
  pePushOp({type:'stamp',page:pe.page,preset:pe.stamp,fx,fy,fw,fh,aspect:bw/bh,fs0:fs,fw0:fw},true);toast('Stamp placed — drag it into position.')}

/* ================= Processing ================= */
const ocrState={page:1};
let metaLoaded=false;
$('processBtn').addEventListener('click',async()=>{
  if(!current||busy)return;
  if(!files.length){toast('Please choose a file first.');return}
  startJob();
  try{ await processTool(); }
  catch(err){ if(err&&err.__cancelled){$('status').textContent='Cancelled — nothing was changed.';setProg(0);$('progWrap').classList.add('hidden');toast('Cancelled.')}
    else{const fe=friendlyError(err);setErrorStatus(fe);toast(fe);setProg(0);$('progWrap').classList.add('hidden')} }
  finally{ endJob(); }
});
/* Scan enhance (v4.7.28): plain pixel math on the photo — grayscale is a
   luminance pass; black & white stretches contrast, then thresholds, so
   gray paper goes white and ink goes black. No “AI”, nothing uploaded. */
function scanEnhance(data,mode){for(let i=0;i<data.length;i+=4){const lum=Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2]);if(mode==='gray'){data[i]=data[i+1]=data[i+2]=lum}else if(mode==='bw'){let v=(lum-128)*1.6+128;v=v<0?0:v>255?255:v;const o=v<150?0:255;data[i]=data[i+1]=data[i+2]=o}}return data}
function scanEnhanceCanvas(g,w,h,mode){try{const im=g.getImageData(0,0,w,h);scanEnhance(im.data,mode);g.putImageData(im,0,0)}catch(e){}}
async function saveDoc(doc,name){download(new Blob([await doc.save()],{type:'application/pdf'}),name)}
async function zipOut(items,name){await ensureZip();if(items.length===1){download(items[0].blob,items[0].name)}else{const zip=new JSZip();items.forEach(i=>zip.file(i.name,i.blob));download(await zip.generateAsync({type:'blob'}),name)}}
async function processTool(){
  const id=current.id, f=files[0];
  await ensureToolLibs(id);
  if(id==='merge'){const out=await PDFDocument.create();for(let fi=0;fi<files.length;fi++){const src=await PDFDocument.load(await bytes(files[fi]));(await out.copyPages(src,src.getPageIndices())).forEach(p=>out.addPage(p));tick(fi+1,files.length,'Merging PDFs')}await saveDoc(out,'pdfstow-merged.pdf');return done('Merged '+files.length+' PDFs into one file.')}
  if(id==='html-to-pdf'){const html=await f.text();const div=document.createElement('div');div.innerHTML=html;const doc=await textToPdfDoc(div.innerText||div.textContent,baseName(f));await saveDoc(doc,baseName(f)+'.pdf');return done('HTML text converted to PDF (Beta — layout simplified).')}
  if(id==='word-to-pdf'){await loadLib('mammoth');if(!window.mammoth)throw new Error('Word library failed to load — check connection and retry.');const r=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});const doc=await textToPdfDoc(r.value,baseName(f));await saveDoc(doc,baseName(f)+'.pdf');return done('Word document converted (text-based Beta — layout simplified).')}
  if(id==='images-to-pdf'){const doc=await PDFDocument.create();const margin=parseFloat(opt('margin'))||0;const sizes={A4:[595,842],Letter:[612,792]};for(let fi=0;fi<files.length;fi++){const file=files[fi];const b=await bytes(file);const img=file.type.includes('png')||/\.png$/i.test(file.name)?await doc.embedPng(b):await doc.embedJpg(b);let pw,ph;if(opt('size')==='Fit image'){pw=img.width+margin*2;ph=img.height+margin*2}else{[pw,ph]=sizes[opt('size')]||sizes.A4}const page=doc.addPage([pw,ph]);const s=Math.min((pw-margin*2)/img.width,(ph-margin*2)/img.height);const w=img.width*s,h=img.height*s;page.drawImage(img,{x:(pw-w)/2,y:(ph-h)/2,width:w,height:h});tick(fi+1,files.length,'Building your PDF')}await saveDoc(doc,'pdfstow-images.pdf');return done(files.length+' image(s) converted to one PDF.')}
  if(id==='scan'){const doc=await PDFDocument.create();const mode=opt('enhance')||'color';const useA4=opt('size')!=='original';const A4=[595.28,841.89];
    for(let fi=0;fi<files.length;fi++){const file=files[fi];const rot=((scanState.get(file)||{rot:0}).rot%360+360)%360;const swap=rot===90||rot===270;
      const url=URL.createObjectURL(file);let im;try{im=await new Promise((res,rej)=>{const t=new Image();t.onload=()=>res(t);t.onerror=rej;t.src=url})}finally{URL.revokeObjectURL(url)}
      let w=im.naturalWidth,h=im.naturalHeight;const sc0=Math.min(1,2480/Math.max(w,h));w=Math.max(1,Math.round(w*sc0));h=Math.max(1,Math.round(h*sc0));
      const dw=swap?h:w,dh=swap?w:h;const c=document.createElement('canvas');c.width=dw;c.height=dh;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,dw,dh);
      g.save();g.translate(dw/2,dh/2);g.rotate(rot*Math.PI/180);g.drawImage(im,-w/2,-h/2,w,h);g.restore();
      if(mode!=='color')scanEnhanceCanvas(g,dw,dh,mode);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));const img=await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      if(useA4){const pw=dh>=dw?A4[0]:A4[1],ph=dh>=dw?A4[1]:A4[0];const m=36;const s=Math.min((pw-m*2)/img.width,(ph-m*2)/img.height);const page=doc.addPage([pw,ph]);page.drawImage(img,{x:(pw-img.width*s)/2,y:(ph-img.height*s)/2,width:img.width*s,height:img.height*s})}
      else{const page=doc.addPage([img.width,img.height]);page.drawImage(img,{x:0,y:0,width:img.width,height:img.height})}
      tick(fi+1,files.length,'Building your PDF')}
    doc.setTitle('Scanned document');await saveDoc(doc,'pdfstow-scan.pdf');return done(files.length+' photo'+(files.length>1?'s':'')+' turned into one PDF.')}
  // All remaining tools take a PDF first file
  const raw=await bytes(f);
  if(id==='pdf-to-text'){const pages=await extractText(raw,(i,n)=>tick(i,n,'Extracting text'));download(new Blob([pages.join('\n\n--- Page break ---\n\n')],{type:'text/plain'}),baseName(f)+'.txt');return done('Extracted text from '+pages.length+' page(s).')}
  if(id==='pdf-to-markdown'){const pages=await extractText(raw,(i,n)=>tick(i,n,'Reading pages'));download(new Blob([pages.map((p,i)=>'## Page '+(i+1)+'\n\n'+p).join('\n\n')],{type:'text/markdown'}),baseName(f)+'.md');return done('Markdown created (Beta — page-by-page text, structure approximate).')}
  if(id==='summarize'){const pages=await extractText(raw,(i,n)=>tick(i,n,'Reading pages'));const text=pages.join(' ');const words=text.trim()?text.trim().split(/\s+/).length:0;const sents=text.match(/[^.!?]+[.!?]+/g)||[];
    if(words<20||sents.length<2)return infoDone('No readable text found in this PDF — it looks like scanned images rather than text. Try the “OCR PDF” tool first to turn the scans into text, then summarize.');
    const freq={};text.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/\s+/).forEach(w=>{if(w.length>3)freq[w]=(freq[w]||0)+1});const scored=sents.map((s,i)=>({s,i,score:s.toLowerCase().split(/\s+/).reduce((a,w)=>a+(freq[w.replace(/[^a-z0-9]/g,'')]||0),0)}));const top=scored.sort((a,b)=>b.score-a.score).slice(0,Math.min(7,sents.length)).sort((a,b)=>a.i-b.i).map(x=>x.s.trim());const out='SUMMARY — '+f.name+'\nPages: '+pages.length+' · Words: '+words+'\n\n'+top.map(s=>'• '+s).join('\n');download(new Blob([out],{type:'text/plain'}),baseName(f)+'-summary.txt');$('resultBox').insertAdjacentHTML('beforeend','<div class="glass" style="padding:16px;border-radius:var(--r-md);white-space:pre-wrap">'+esc(out)+'</div>');return done('Summary ready — computed locally on this device.')}
  if(id==='compare'){if(files.length<2)throw new Error('Choose 2 PDFs to compare.');const a=(await extractText(await bytes(files[0]),(i,n)=>tick(i,2*n,'Comparing PDFs'))).join('\n').split('\n'),b=(await extractText(await bytes(files[1]))).join('\n').split('\n');const setB=new Set(b),setA=new Set(a);const onlyA=a.filter(l=>l.trim()&&!setB.has(l)),onlyB=b.filter(l=>l.trim()&&!setA.has(l));const report='COMPARE REPORT\n'+files[0].name+' vs '+files[1].name+'\n\nLines only in FIRST ('+onlyA.length+'):\n'+onlyA.join('\n')+'\n\nLines only in SECOND ('+onlyB.length+'):\n'+onlyB.join('\n');download(new Blob([report],{type:'text/plain'}),'pdfstow-compare.txt');return done('Comparison ready: '+onlyA.length+' / '+onlyB.length+' differing lines.'+(files.length>2?' (You added '+files.length+' files — the first two were compared.)':''))}
  if(id==='pdf-to-jpg'||id==='pdf-to-png'){const isPng=id==='pdf-to-png';const blobs=await renderPages(raw,parseFloat(opt('scale'))||2,isPng?'image/png':'image/jpeg',.92,(i,n)=>tick(i,n,isPng?'Converting pages to PNG':'Converting pages to JPG'));await zipOut(blobs.map((b,i)=>({blob:b,name:baseName(f)+'-page-'+(i+1)+(isPng?'.png':'.jpg')})),baseName(f)+'-images.zip');return done(blobs.length+' page image(s) created'+(blobs.length>1?' — downloaded as one ZIP file.':'.'))}
  if(id==='compress'){const level=opt('level');const cfg={extreme:{s:.8,q:.45},recommended:{s:1.2,q:.65},low:{s:1.8,q:.85}}[level]||{s:1.2,q:.65};const blobs=await renderPages(raw,cfg.s,'image/jpeg',cfg.q,(i,n)=>tick(i,n,'Compressing PDF'));const src=await PDFDocument.load(raw);const doc=await PDFDocument.create();for(let i=0;i<blobs.length;i++){const img=await doc.embedJpg(new Uint8Array(await blobs[i].arrayBuffer()));const sp=src.getPage(Math.min(i,src.getPageCount()-1));const page=doc.addPage([sp.getWidth(),sp.getHeight()]);page.drawImage(img,{x:0,y:0,width:page.getWidth(),height:page.getHeight()})}const outBytes=await doc.save();
    /* Never hand back a bigger file as the result (v4.5.1): when the
       image-rendered copy is not smaller, the user's ORIGINAL becomes the
       primary download and the copy is demoted to a small secondary link. */
    if(outBytes.length>=raw.length){download(new Blob([raw],{type:'application/pdf'}),f.name,'Download your original file');download(new Blob([outBytes],{type:'application/pdf'}),baseName(f)+'-compressed.pdf','Or get the image-based copy anyway ('+fmt(outBytes.length)+')','alt-dl');
      return done('Your file is already smaller than the copy this tool can make ('+fmt(raw.length)+' vs '+fmt(outBytes.length)+'), so your original is the better file. The copy is image-based, which is why it came out larger.',undefined,{icon:'triangle-alert',text:'Already well compressed',flat:true})}
    download(new Blob([outBytes],{type:'application/pdf'}),baseName(f)+'-compressed.pdf');
    const pct=Math.round((1-outBytes.length/raw.length)*100);return done('Compressed ('+level+'): '+fmt(raw.length)+' to '+fmt(outBytes.length)+' ('+pct+'% smaller). Note: image-based output — text becomes part of the page image.')}
  if(id==='ocr'){
    await loadLib('tesseract');
    if(!window.Tesseract)throw new Error('OCR library failed to load — check your connection and reload the page.');
    const max=parseInt(opt('pages'))||5;const pdf=await GD({data:raw.slice()}).promise;const n=Math.min(max,pdf.numPages);let allText='';let worker=null;
    const cancelP=new Promise((_,rej)=>{ocrCancelReject=rej});
    try{
      const startTimeoutP=new Promise((_,rej)=>setTimeout(()=>rej(new Error('OCR could not start — its language data could not be downloaded. Check your connection and try again.')),120000));
      worker=await Promise.race([Tesseract.createWorker('eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0',logger:m=>{if(m.status==='recognizing text'&&typeof m.progress==='number'){setProg(.05+(((ocrState.page-1)+m.progress)/n)*.85,'Reading text — page '+ocrState.page+' of '+n+' ('+Math.round(m.progress*100)+'%)')}else if(m.status){setProg(undefined,'OCR: '+m.status+'…')}}}),cancelP,startTimeoutP]);
      ocrWorker=worker;
      for(let i=1;i<=n;i++){if(jobCancelled)throw cancelError();ocrState.page=i;
        const pg=await pdf.getPage(i);const vp=pg.getViewport({scale:2});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
        const timeoutP=new Promise((_,rej)=>setTimeout(()=>rej(new Error('OCR timed out on page '+i+' — try fewer pages, or a clearer, smaller scan.')),180000));
        const res=await Promise.race([worker.recognize(c),cancelP,timeoutP]);
        allText+='\n\n--- Page '+i+' ---\n'+res.data.text;tick(i,n,'Reading text (OCR)')}
    } finally {ocrCancelReject=null;if(worker){try{await worker.terminate()}catch(e){}}if(ocrWorker===worker)ocrWorker=null}
    if(jobCancelled)throw cancelError();
    const doc=await textToPdfDoc(allText,baseName(f)+' OCR');await saveDoc(doc,baseName(f)+'-ocr.pdf');download(new Blob([allText],{type:'text/plain'}),baseName(f)+'-ocr.txt');
    const words=allText.trim()?allText.trim().split(/\s+/).length:0;
    return done(words<10?'OCR finished, but found almost no readable text — the scan may be blank or too blurry. The results were still downloaded so you can check them.':'OCR finished for '+n+' page(s). A searchable PDF and a plain-text file were downloaded.')}
  if(id==='pdf-to-word'){const pages=await extractText(raw,(i,n)=>tick(i,n,'Reading pages'));download(await makeDocx(pages,baseName(f)),baseName(f)+'.docx');return done('Word file created (Beta, text-based — layout simplified).')}
  if(id==='pdf-to-excel'){await loadLib('xlsx').catch(()=>{});const pages=await extractText(raw,(i,n)=>tick(i,n,'Reading pages'));const rows=[];let maxCols=1;pages.forEach((p,pi)=>p.split('\n').forEach(l=>{const cells=l.split(/\s{2,}/).map(s=>s.trim()).filter(s=>s.length);const row=['Page '+(pi+1),...(cells.length?cells:[l.trim()])];if(row.length-1>maxCols)maxCols=row.length-1;rows.push(row)}));
    const header=['Page',...Array.from({length:maxCols},(_,i)=>'Column '+(i+1))];const full=[header,...rows.map(r=>[...r,...Array(Math.max(0,maxCols-(r.length-1))).fill('')])];
    if(window.XLSX){const ws=XLSX.utils.aoa_to_sheet(full);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Extracted');const out=XLSX.write(wb,{bookType:'xlsx',type:'array'});download(new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),baseName(f)+'.xlsx')}else{download(new Blob([full.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n')],{type:'text/csv'}),baseName(f)+'.csv')}return done('Spreadsheet created (Beta — text split into rows/columns by spacing; table layout is not preserved).')}
  if(id==='unlock'){
    const looksEnc=(()=>{try{const td=new TextDecoder('latin1');const head=td.decode(raw.slice(0,65536));const tail=td.decode(raw.slice(Math.max(0,raw.length-65536)));return head.includes('/Encrypt')||tail.includes('/Encrypt')}catch(e){return false}})();
    let opened=null,needsPw=false;
    try{opened=await GD({data:raw.slice()}).promise}catch(e){if(e&&e.name==='PasswordException'||/password/i.test((e&&e.message)||''))needsPw=true;else throw e}
    const pw=opt('password');
    if(opened&&!looksEnc)return infoDone('This PDF isn\'t password-protected — there is nothing to unlock. Your file was left unchanged.');
    if(opened&&looksEnc){
      try{const d=await PDFDocument.load(raw,{ignoreEncryption:true});const outBytes=await d.save();const chk=await GD({data:outBytes.slice()}).promise;if(chk.numPages===opened.numPages){download(new Blob([outBytes],{type:'application/pdf'}),baseName(f)+'-unlocked.pdf');return done('Unlocked — protection removed, text preserved.')}}catch(e){/* fall through to password path */}
      if(!pw)throw new Error('This file\'s protection could not be removed automatically. Enter its current password above and try again — files protected with PDFStow unlock with the password you set on them.');
    }
    if(needsPw||looksEnc){
      if(!pw)throw new Error('This PDF is locked with a password. Enter its current password above — PDFStow can only unlock files you own and know the password for.');
      let pdf2;try{pdf2=await GD({data:raw.slice(),password:pw}).promise}catch(e){throw new Error('That password didn\'t work. Check it and try again.')}
      const doc2=await PDFDocument.create();
      for(let i=1;i<=pdf2.numPages;i++){const pg=await pdf2.getPage(i);const vp=pg.getViewport({scale:2});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));const img=await doc2.embedJpg(new Uint8Array(await blob.arrayBuffer()));const base=pg.getViewport({scale:1});const page=doc2.addPage([base.width,base.height]);page.drawImage(img,{x:0,y:0,width:base.width,height:base.height});tick(i,pdf2.numPages,'Unlocking')}
      await saveDoc(doc2,baseName(f)+'-unlocked.pdf');return done('Unlocked with your password and rebuilt without protection. Note: rebuilt pages are images (text not selectable).')}
    return infoDone('This PDF isn\'t password-protected — there is nothing to unlock. Your file was left unchanged.')}

  // pdf-lib tools
  let doc;try{doc=await PDFDocument.load(raw,{ignoreEncryption:id==='repair'})}catch(e){if(id==='repair')throw new Error('This file is too damaged to fix in the browser — your original file is unchanged.');if(id==='pdf-editor'&&peFail==='password')throw new Error('This PDF is password-protected — take the protection off first (the Unlock PDF tool can help if you know the password), then edit it.');throw e}
  const total=doc.getPageCount();
  if(id==='pdf-editor'){
    if(!pe)throw new Error(peFail==='password'?'This PDF is password-protected — take the protection off first (the Unlock PDF tool can help if you know the password), then edit it.':'The editor preview did not open — choose the PDF again and wait for the preview before saving.');
    if(!pe.ops.length&&!pe.pn.on)throw new Error('Make at least one change first — edit a line, add text, an image, a signature or a highlight — or turn on page numbers.');
    const fontCache={};const getFont=async key=>{if(!fontCache[key])fontCache[key]=await doc.embedFont(StandardFonts[key]);return fontCache[key]};
    for(const op of pe.ops){const p=doc.getPage(op.page);const {width:W,height:H}=p.getSize();
      if(op.type==='edit'){const font=await getFont(op.fontStd);const pad=op.size*.14;const ecx=op.cfx!==undefined?op.cfx:op.fx,ect=op.cTop!==undefined?op.cTop:op.fTop;p.drawRectangle({x:ecx*W,y:H-(ect+op.fh)*H-pad,width:op.fw*W,height:op.fh*H+pad*2,color:rgb(op.cover[0],op.cover[1],op.cover[2])});p.drawText(op.newText,{x:op.fx*W,y:H-op.fBase*H,size:op.size,font,color:rgb(op.color[0],op.color[1],op.color[2])})}
      else if(op.type==='text'){const font=await getFont(op.bold?'HelveticaBold':'Helvetica');p.drawText(op.text,{x:op.fx*W,y:H-op.fBase*H,size:op.size,font,color:rgb(op.color[0],op.color[1],op.color[2])})}
      else if(op.type==='image'){const img=op.format==='png'?await doc.embedPng(op.bytes):await doc.embedJpg(op.bytes);p.drawImage(img,{x:op.fx*W,y:H-(op.fy+op.fh)*H,width:op.fw*W,height:op.fh*H})}
      else if(op.type==='mark'){if(op.style==='highlight'){const c=PE_HL_COLORS[op.color].rgb;p.drawRectangle({x:op.fx*W,y:H-(op.fy+op.fh)*H,width:op.fw*W,height:op.fh*H,color:rgb(c[0],c[1],c[2]),opacity:.35})}
        else{const c=[PE_TXT_COLORS[0],PE_TXT_COLORS[3],PE_TXT_COLORS[1]][op.color].rgb;const y=op.style==='underline'?H-(op.fy+op.fh)*H+1:H-(op.fy+op.fh/2)*H;p.drawLine({start:{x:op.fx*W,y},end:{x:(op.fx+op.fw)*W,y},thickness:Math.max(1.1,op.fh*H*.07),color:rgb(c[0],c[1],c[2])})}}
      else if(op.type==='shape'){const c=PE_TXT_COLORS[op.color].rgb;const col=rgb(c[0],c[1],c[2]);
        if(op.kind==='rect')p.drawRectangle({x:op.fx*W,y:H-(op.fy+op.fh)*H,width:op.fw*W,height:op.fh*H,borderColor:col,borderWidth:op.width});
        else if(op.kind==='ellipse')p.drawEllipse({x:(op.fx+op.fw/2)*W,y:H-(op.fy+op.fh/2)*H,xScale:op.fw*W/2,yScale:op.fh*H/2,borderColor:col,borderWidth:op.width});
        else{const s={x:op.fx*W,y:H-op.fy*H},e2={x:op.fx2*W,y:H-op.fy2*H};p.drawLine({start:s,end:e2,thickness:op.width,color:col});
          if(op.kind==='arrow'){const dx=e2.x-s.x,dy=e2.y-s.y;const len=Math.max(1,Math.hypot(dx,dy));const hl=Math.min(16,len*.3+4),a=Math.atan2(dy,dx);[a+2.6,a-2.6].forEach(ang=>{p.drawLine({start:e2,end:{x:e2.x+hl*Math.cos(ang),y:e2.y+hl*Math.sin(ang)},thickness:op.width,color:col})})}}}
      else if(op.type==='draw'){const c=PE_TXT_COLORS[op.color].rgb;const col=rgb(c[0],c[1],c[2]);for(let k=1;k<op.points.length;k++){p.drawLine({start:{x:op.points[k-1][0]*W,y:H-op.points[k-1][1]*H},end:{x:op.points[k][0]*W,y:H-op.points[k][1]*H},thickness:op.width,color:col})}}
      else if(op.type==='cover'){p.drawRectangle({x:op.fx*W,y:H-(op.fy+op.fh)*H,width:op.fw*W,height:op.fh*H,color:rgb(op.cover[0],op.cover[1],op.cover[2])})}
      else if(op.type==='stamp'){const st=PE_STAMPS[op.preset];const col=rgb(st.rgb[0],st.rgb[1],st.rgb[2]);const font=await getFont('HelveticaBold');const fs=op.fs0*(op.fw/op.fw0);const Wpt=op.fw*W,Hpt=op.fh*H,px=op.fx*W,py=H-(op.fy+op.fh)*H,rot=degrees(-8);
        p.drawRectangle({x:px,y:py,width:Wpt,height:Hpt,rotate:rot,borderColor:col,borderWidth:2.4});
        const tw=font.widthOfTextAtSize(st.text,fs);const ox=(Wpt-tw)/2,oy=(Hpt-fs)/2+fs*.34,rad=-8*Math.PI/180;
        p.drawText(st.text,{x:px+ox*Math.cos(rad)-oy*Math.sin(rad),y:py+ox*Math.sin(rad)+oy*Math.cos(rad),size:fs,font,color:col,rotate:rot})}
    }
    if(pe.pn.on){const font=await getFont('Helvetica');doc.getPages().forEach((p,i)=>{const {width:W}=p.getSize();const label=String(pe.pn.start+i);const tw=font.widthOfTextAtSize(label,10);let x=(W-tw)/2;if(pe.pn.pos==='bottom-left')x=36;if(pe.pn.pos==='bottom-right')x=W-tw-36;p.drawText(label,{x,y:24,size:10,font,color:rgb(.25,.25,.25)})})}
    const nChanges=pe.ops.length+(pe.pn.on?1:0);await saveDoc(doc,baseName(f)+'-edited.pdf');return done('Your edited PDF is ready — '+nChanges+' change'+(nChanges===1?'':'s')+' applied.')}
  if(id==='split'){const items=[];if(opt('mode')==='pick'){if(!(pm&&pm.mode==='pick'&&pm.sel.size))throw new Error('Tap at least one page in the preview above first.');const idx=[...pm.sel].sort((a,b)=>a-b);const d=await PDFDocument.create();(await d.copyPages(doc,idx)).forEach(p=>d.addPage(p));await saveDoc(d,baseName(f)+'-picked.pdf');return done('Extracted '+idx.length+' picked page(s) as one PDF.')}if(opt('mode')==='each'){for(let i=0;i<total;i++){const d=await PDFDocument.create();const [p]=await d.copyPages(doc,[i]);d.addPage(p);items.push({blob:new Blob([await d.save()],{type:'application/pdf'}),name:baseName(f)+'-page-'+(i+1)+'.pdf'});tick(i+1,total,'Splitting PDF')}}else{const ranges=opt('ranges').split(',').map(s=>s.trim()).filter(Boolean);for(let r=0;r<ranges.length;r++){const idx=parseRanges(ranges[r],total);if(!idx)continue;const d=await PDFDocument.create();(await d.copyPages(doc,idx)).forEach(p=>d.addPage(p));items.push({blob:new Blob([await d.save()],{type:'application/pdf'}),name:baseName(f)+'-part-'+(r+1)+'.pdf'})}}if(!items.length)throw new Error('No valid ranges — check the ranges under Advanced options (e.g. 1-3, 4-6).');await zipOut(items,baseName(f)+'-split.zip');return done('Split into '+items.length+' file(s)'+(items.length>1?' — downloaded as one ZIP file.':'.'))}
  if(id==='remove-pages'){const rm=new Set((pm&&pm.mode==='remove'&&pm.sel.size)?[...pm.sel]:(parseRanges(opt('pages'),total)||[]));if(!rm.size)throw new Error('Tap pages in the preview above to mark them for removal — or type page numbers under Advanced options.');if(rm.size>=total)throw new Error('You cannot remove every page — keep at least one.');const keep=doc.getPageIndices().filter(i=>!rm.has(i));const nd=await PDFDocument.create();(await nd.copyPages(doc,keep)).forEach(p=>nd.addPage(p));await saveDoc(nd,baseName(f)+'-trimmed.pdf');return done('Removed '+rm.size+' page(s). '+keep.length+' remain.')}
  if(id==='extract-pages'){let idx=null;if(pm&&pm.mode==='extract'&&pm.sel.size)idx=[...pm.sel].sort((a,b)=>a-b);else if(opt('pages').trim())idx=parseRanges(opt('pages'),total);if(!idx||!idx.length)throw new Error('Tap at least one page in the preview above first — or type page numbers under Advanced options.');const d=await PDFDocument.create();(await d.copyPages(doc,idx)).forEach(p=>d.addPage(p));await saveDoc(d,baseName(f)+'-extract.pdf');return done('Extracted '+idx.length+' page(s) into a new PDF.')}
  if(id==='organize'){
    if(pm&&pm.mode==='organize'){const seq=pm.order.filter(i=>i<0||!pm.deleted.has(i));if(!seq.length)throw new Error('Every page was removed — keep at least one page.');const d=await PDFDocument.create();let lastSize=[595,842];for(const ix of seq){if(ix<0){d.addPage(lastSize)}else{const [p]=await d.copyPages(doc,[ix]);d.addPage(p);lastSize=[p.getWidth(),p.getHeight()]}}await saveDoc(d,baseName(f)+'-reordered.pdf');return done('New document saved with '+seq.length+' page(s)'+(pm.deleted.size?' — '+pm.deleted.size+' page(s) removed':'')+(pm.blanks?' — including '+pm.blanks+' blank page(s)':'')+'.')}
    const idx=parseRanges(opt('order'),total);if(!idx||idx.length!==total)throw new Error('Order must list every page exactly once (1 to '+total+').');const d=await PDFDocument.create();(await d.copyPages(doc,idx)).forEach(p=>d.addPage(p));await saveDoc(d,baseName(f)+'-reordered.pdf');return done('Pages reordered.')}
  if(id==='rotate'){
    /* Snapshot the thumbnail rotations up front (audit fix #2): the run then
       depends only on local state — plus the global busy-lock and error
       surfacing mean a click can never again vanish silently. */
    const rotSnapshot=(pm&&pm.mode==='rotate')?{...pm.rot}:null;
    if(rotSnapshot&&Object.values(rotSnapshot).some(a=>a)){let n=0;Object.entries(rotSnapshot).forEach(([i,a])=>{if(!a)return;const p=doc.getPage(+i);p.setRotation(degrees((p.getRotation().angle+a)%360));n++});await saveDoc(doc,baseName(f)+'-rotated.pdf');return done('Rotated '+n+' page(s) from the thumbnails.')}
    const idx=opt('pages').trim()?(parseRanges(opt('pages'),total)||[]):doc.getPageIndices();idx.forEach(i=>{const p=doc.getPage(i);p.setRotation(degrees((p.getRotation().angle+parseInt(opt('angle')))%360))});await saveDoc(doc,baseName(f)+'-rotated.pdf');return done('Rotated '+idx.length+' page(s) by '+opt('angle')+'°.')}
  if(id==='crop'){const fr=(typeof ed!=='undefined'&&ed&&ed.kind==='crop'&&ed.crop)?ed.crop:null;const L=+opt('left')||0,R=+opt('right')||0,T=+opt('top')||0,B=+opt('bottom')||0;
    doc.getPages().forEach(p=>{const mb=p.getMediaBox();const rot=(p.getRotation&&p.getRotation().angle)||0;const W=mb.width,H=mb.height;let nx,ny,nw,nh;
      if(fr){const dW=(rot===90||rot===270)?H:W,dH=(rot===90||rot===270)?W:H;const dx=fr.fx*dW,dyT=fr.fy*dH,dw=fr.fw*dW,dh=fr.fh*dH,dy=dH-dyT-dh;
        if(rot===90){nx=mb.x+(W-dy-dh);ny=mb.y+dx;nw=dh;nh=dw}else if(rot===180){nx=mb.x+(W-dx-dw);ny=mb.y+(H-dy-dh);nw=dw;nh=dh}else if(rot===270){nx=mb.x+dy;ny=mb.y+(H-dx-dw);nw=dh;nh=dw}else{nx=mb.x+dx;ny=mb.y+dy;nw=dw;nh=dh}}
      else{nx=mb.x+L;ny=mb.y+B;nw=W-L-R;nh=H-T-B}
      nw=Math.max(20,nw);nh=Math.max(20,nh);p.setMediaBox(nx,ny,nw,nh);p.setCropBox(nx,ny,nw,nh);if(p.setTrimBox)p.setTrimBox(nx,ny,nw,nh);if(p.setBleedBox)p.setBleedBox(nx,ny,nw,nh);if(p.setArtBox)p.setArtBox(nx,ny,nw,nh)});
    await saveDoc(doc,baseName(f)+'-cropped.pdf');return done('Cropped all pages to your selection.')}
  if(id==='repair'){await saveDoc(doc,baseName(f)+'-repaired.pdf');return done('Repaired / cleanly re-saved. Pages: '+total+'. If the original already opened fine, it may not have needed repair.')}
  if(id==='page-numbers'){const font=await doc.embedFont(StandardFonts.Helvetica);const pos=opt('position'),fmtOpt=opt('format'),first=parseInt(opt('first'))||1;doc.getPages().forEach((p,i)=>{const {width,height}=p.getSize();const num=first+i;const label=fmtOpt==='n'?String(num):fmtOpt==='Page n'?'Page '+num:num+' / '+(first+total-1);const tw=font.widthOfTextAtSize(label,10);let x=(width-tw)/2;if(pos.includes('left'))x=36;if(pos.includes('right'))x=width-tw-36;let y=24;if(pos.startsWith('top'))y=height-30;else if(pos.startsWith('middle'))y=height/2;p.drawText(label,{x,y,size:10,font,color:rgb(.25,.25,.25)})});await saveDoc(doc,baseName(f)+'-numbered.pdf');return done('Page numbers added — starting at '+first+', at the '+POS_WORDS[pos]+' of every page.')}
  if(id==='watermark'){const font=await doc.embedFont(StandardFonts.HelveticaBold);const text=opt('text').trim();if(!text)throw new Error('Type the watermark text first.');const size=parseFloat(opt('size'))||42;const op=Math.min(.6,Math.max(.05,parseFloat(opt('opacity'))||.25));const pos=opt('position');const ang=pos==='center'?35:0,th=ang*Math.PI/180,cos=Math.cos(th),sin=Math.sin(th);doc.getPages().forEach(p=>{const {width,height}=p.getSize();let sz=size,tw=font.widthOfTextAtSize(text,sz);if(tw>width-48){sz=size*(width-48)/tw;tw=font.widthOfTextAtSize(text,sz)}let cx=width/2;if(pos.includes('left'))cx=tw/2+36;if(pos.includes('right'))cx=width-tw/2-36;let cy=height/2;if(pos.startsWith('top'))cy=height-sz*.8;if(pos.startsWith('bottom'))cy=sz*.9;const ox=tw/2,oy=sz*.35;p.drawText(text,{x:cx-(cos*ox-sin*oy),y:cy-(sin*ox+cos*oy),size:sz,font,color:rgb(.55,.6,.7),opacity:op,rotate:degrees(ang)})});const outBytes=await doc.save();download(new Blob([outBytes],{type:'application/pdf'}),baseName(f)+'-watermarked.pdf');const prevHtml=await firstPagePreview(outBytes);return done('Watermark added at the '+POS_WORDS[pos]+' of every page.',prevHtml)}
  if(id==='edit-pdf'||id==='annotate'){
    const text=opt('text').trim();if(!text)throw new Error(id==='edit-pdf'?'Type the text you want to add first.':'Type your note text first.');
    let pi=(parseInt(opt('page'))||1)-1;let px=50,py=700,rect=null;
    if(ed&&ed.kind===id){
      if(id==='edit-pdf'){if(!ed.marker)throw new Error('Click on the page preview above to choose where the text goes.');pi=ed.marker.page;const s=doc.getPage(pi).getSize();px=ed.marker.fx*s.width;py=s.height-ed.marker.fy*s.height}
      if(id==='annotate'){if(!ed.rect)throw new Error('Drag a rectangle on the page preview above to place your note.');pi=ed.rect.page;const s=doc.getPage(pi).getSize();rect={x:ed.rect.fx*s.width,y:s.height-(ed.rect.fy+ed.rect.fh)*s.height,w:ed.rect.fw*s.width,h:ed.rect.fh*s.height}}}
    if(pi<0||pi>=total)throw new Error('Page out of range.');const p=doc.getPage(pi);const font=await doc.embedFont(StandardFonts.Helvetica);
    if(id==='annotate'){const lines0=wrapText(text,font,11,Math.max(40,(rect?rect.w:220)-16));const w=rect?rect.w:Math.max(140,Math.min(320,font.widthOfTextAtSize(text,11)+24)),h=rect?rect.h:Math.max(30,lines0.length*13+14),x=rect?rect.x:50,y=rect?rect.y:650;const lines=wrapText(text,font,11,Math.max(40,w-16));p.drawRectangle({x,y,width:w,height:h,color:rgb(1,.93,.55),opacity:.95});lines.forEach((l,li)=>p.drawText(l,{x:x+8,y:y+h-15-li*13,size:11,font,color:rgb(.05,.05,.05)}));await saveDoc(doc,baseName(f)+'-annotated.pdf');return done('Note added to page '+(pi+1)+(rect?' where you drew it.':'.'))}
    p.drawText(text,{x:px,y:py,size:parseFloat(opt('size'))||18,font,color:rgb(.05,.05,.05)});await saveDoc(doc,baseName(f)+'-edited.pdf');return done('Text added to page '+(pi+1)+(ed&&ed.marker?' where you clicked.':'.'))}
  if(id==='sign-pdf'){if(!sigDrawn||!sigArt)throw new Error('Create your signature first — draw it, type it, or upload a picture — then drag it into place on the preview.');
    const blob=await new Promise(r=>sigArt.toBlob(r,'image/png'));const img=await doc.embedPng(new Uint8Array(await blob.arrayBuffer()));const aspect=sigArt.height/sigArt.width;
    let pi=total-1,x=null,y=null,wPt=180;
    if(ed&&ed.kind==='sign-pdf'){pi=Math.min(ed.page,total-1);const s=doc.getPage(pi).getSize();wPt=ed.signW*s.width;x=ed.signPos.fx*s.width;y=s.height-ed.signPos.fy*s.height-wPt*aspect}
    const p=doc.getPage(pi);const s2=p.getSize();if(x===null){x=Math.max(20,s2.width-wPt-40);y=60}
    p.drawImage(img,{x,y,width:wPt,height:wPt*aspect});
    if($('sigDate')&&$('sigDate').checked){const font=await doc.embedFont(StandardFonts.Helvetica);const dstr=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});let dx=x+wPt+10,dy=y+2;if(dx+font.widthOfTextAtSize(dstr,11)>s2.width-8){dx=x;dy=y-16}if(dy<8)dy=y+wPt*aspect+6;p.drawText(dstr,{x:dx,y:dy,size:11,font,color:rgb(.1,.1,.1)})}
    await saveDoc(doc,baseName(f)+'-signed.pdf');return done('Signature stamped on page '+(pi+1)+' where you placed it.')}
  if(id==='redact'){
    if(!ed||ed.kind!=='redact'||!ed.boxes.length)throw new Error('Draw at least one black-out box on the preview first — nothing is redacted until you do.');
    /* TRUE redaction (audit fix #1): every page carrying a box is re-rendered
       to an image with the boxes burned in, and the page is REPLACED by that
       image — the original text layer ceases to exist. Untouched pages are
       copied across unchanged. */
    const byPage={};ed.boxes.forEach(bx=>{if(bx.page>=0&&bx.page<total)(byPage[bx.page]=byPage[bx.page]||[]).push(bx)});
    const srcPdf=await GD({data:raw.slice()}).promise;const out=await PDFDocument.create();
    for(let i=0;i<total;i++){
      if(!byPage[i]){const [cp]=await out.copyPages(doc,[i]);out.addPage(cp)}
      else{const sp=doc.getPage(i);const {width,height}=sp.getSize();const pg=await srcPdf.getPage(i+1);const vp=pg.getViewport({scale:200/72});const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);const g=c.getContext('2d');await pg.render({canvasContext:g,viewport:vp}).promise;g.fillStyle='#000';byPage[i].forEach(bx=>g.fillRect(bx.fx*c.width,bx.fy*c.height,bx.fw*c.width,bx.fh*c.height));const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));const img=await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));const page=out.addPage([width,height]);page.drawImage(img,{x:0,y:0,width,height})}
      tick(i+1,total,'Redacting')}
    await saveDoc(out,baseName(f)+'-redacted.pdf');return done('Redacted '+ed.boxes.length+' area(s) on '+Object.keys(byPage).length+' page(s). Those pages were flattened into images, so the hidden text is permanently removed — it cannot be copied back out.')}
  if(id==='metadata'){
    if(!metaLoaded&&!opt('clearmeta'))throw new Error('We could not read this file\'s current metadata, so nothing was changed — the file may be damaged or password-protected.');
    if(opt('clearmeta')){doc.setTitle('');doc.setAuthor('');doc.setSubject('');doc.setKeywords([]);await saveDoc(doc,baseName(f)+'-metadata.pdf');return done('All metadata cleared and saved.')}
    doc.setTitle(opt('title'));doc.setAuthor(opt('author'));doc.setSubject(opt('subject'));const kw=opt('keywords').trim();doc.setKeywords(kw?kw.split(',').map(s=>s.trim()).filter(Boolean):[]);
    await saveDoc(doc,baseName(f)+'-metadata.pdf');return done('Metadata saved — Title: “'+(opt('title')||'—')+'”, Author: “'+(opt('author')||'—')+'”.')}
  if(id==='protect'){if(!opt('password'))throw new Error('Enter a password.');if(opt('password')!==opt('confirm'))throw new Error('Passwords do not match.');if(typeof doc.encrypt!=='function')throw new Error('Encryption engine unavailable in this build.');doc.encrypt({userPassword:opt('password'),ownerPassword:opt('password'),permissions:{printing:'highResolution',modifying:false,copying:false,annotating:false,fillingForms:false,contentAccessibility:true,documentAssembly:false}});await saveDoc(doc,baseName(f)+'-protected.pdf');return done('PDF encrypted with your password. Keep it safe — it cannot be recovered if forgotten.')}
  if(id==='unlock'){throw new Error('Unlock is handled earlier in the pipeline.')}
  throw new Error('Unknown tool.');
}
async function makeDocx(pages,title){
  const escx=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const paras=pages.map(p=>p.split('\n').map(l=>`<w:p><w:r><w:t xml:space="preserve">${escx(l)}</w:t></w:r></w:p>`).join('')).join('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  const docXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}</w:body></w:document>`;
  const zip=new JSZip();zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml',docXml);
  return zip.generateAsync({type:'blob'});
}
renderTools();
/* Boot checks + deep-links (deep-audit #3, #11; v4.6.1 clean paths).
   Legacy '#/merge' links still open Merge, but the address is normalized
   to the tool's clean /<slug>/ path — no hash ever survives in the bar.
   A '#tools' hash (header/footer links from other pages) scrolls to the
   grid and is stripped; a bare '#' is stripped. No popstate listener is
   needed: every in-app URL write uses replaceState, so the SPA adds no
   history entries and Back/Forward only traverse real documents — the
   restored document re-runs this same boot normalization. */
/* (v4.7.2: the old boot-time LIBS_OK check is gone — with every library
   lazy, "not loaded yet" is the normal state at boot. A library that
   FAILS to load is reported by loadLib itself, in context, the moment a
   tool actually needs it.) */
function cleanUrl(p){try{if(/^https?:$/.test(location.protocol))history.replaceState(null,'',p);else history.replaceState(null,'',location.pathname+location.search)}catch(e){}}
function goTools(){$('toolView').classList.add('hidden');$('homeView').classList.remove('hidden');cleanUrl('/');const t=$('tools');if(t)t.scrollIntoView({behavior:'smooth'})}
function routeFromHash(){if(PAGE_TOOL)return;const h=location.hash||'';const m=/^#\/([\w-]+)$/.exec(h);if(m&&TOOLS.some(t=>t.id===m[1])){if(!current||current.id!==m[1])openTool(m[1]);else cleanUrl('/'+SLUGS[m[1]]+'/')}else if(h==='#tools')goTools();else if(current&&(h===''||h==='#'))showHome()}
if(location.hash)routeFromHash();else if(/#$/.test(location.href))cleanUrl('/');
window.addEventListener('hashchange',routeFromHash);
/* '#tools' links on the SPA itself: smooth-scroll to the grid without
   letting the hash land in the address bar. (On tool pages the same link
   is a real navigation home, where the boot pass above normalizes it.) */
document.addEventListener('click',e=>{if(PAGE_TOOL)return;const a=e.target&&e.target.closest?e.target.closest('a[href="#tools"],a[href="/#tools"]'):null;if(!a)return;e.preventDefault();goTools()});
/* Per-tool pages (v4.5.0): open this page's tool at boot. */
if(PAGE_TOOL&&TOOLS.some(t=>t.id===PAGE_TOOL))openTool(PAGE_TOOL);
