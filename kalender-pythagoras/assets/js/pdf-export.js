/* =====================================================
   pdf-export.js  v4.1
   - 3 jalur export: raster (WYSIWYG), print browser, editable (Canva)
   - Auto-relabel tombol + injeksi tombol PDF Editable di semua halaman
   - Modal konfirmasi tetap wajib (checkbox)
   - safe() memakai escape Unicode (kebal normalisasi editor)
   ===================================================== */
(function(){
"use strict";
var q = function(s){ return document.querySelector(s); };

/* ---------- Sanitasi teks ke WinAnsi (aman untuk jsPDF) ---------- */
function safe(s){
  if(!s) return '';
  var map = {
    '\u2192':'->',    // right arrow
    '\u2212':'-',     // minus sign
    '\u2013':'-',     // en dash
    '\u2014':'-',     // em dash
    '\u2713':'v',     // check mark
    '\u2714':'v',     // heavy check
    '\u26A0':'!',     // warning
    '\u2022':'-',     // bullet
    '\u00D7':'x',     // multiplication
    '\u221A':'akar',  // square root
    '\u0394':'delta', // delta
    '\u223C':'~',     // tilde op
    '\u2248':'~',     // almost equal
    '\u2260':'!=',    // not equal
    '\u2264':'<=',    // less equal
    '\u2265':'>=',    // greater equal
    '\u221E':'inf',   // infinity
    '\u03C0':'pi',    // pi
    '\u03B8':'theta', // theta
    '\u2026':'...',   // ellipsis
    '\u2018':"'",    // left single quote
    '\u2019':"'",    // right single quote
    '\u201C':'"',    // left double quote
    '\u201D':'"',    // right double quote
    '\u200C':'',      // zero width non-joiner
    '\u200D':'',      // zero width joiner
    '\uFE0F':''       // variation selector
  };
  var out = '';
  for(var i=0;i<s.length;i++){
    var cp = s.codePointAt(i);
    var ch = (cp > 0xFFFF) ? s.substr(i,2) : s[i];
    if(cp > 0xFFFF){ i++; }
    var rep = map[ch];
    if(rep !== undefined){ out += rep; }
    else if(cp <= 255){ out += ch; }
    /* selain itu (emoji/simbol luar latin-1) dibuang */
  }
  return out.replace(/\s+/g,' ').trim();
}

/* ---------- Overlay sibuk ---------- */
var busyEl = null;
function showBusy(on, msg){
  if(on){
    if(!busyEl){
      busyEl = document.createElement('div');
      busyEl.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:3000;display:flex;align-items:center;justify-content:center;';
      busyEl.innerHTML='<div style="background:#fff;padding:20px 30px;border-radius:10px;font-weight:700;color:#5a67d8;">Membuat PDF... mohon tunggu</div>';
      document.body.appendChild(busyEl);
    }
    busyEl.style.display='flex';
    if(msg) busyEl.querySelector('div').textContent = msg;
  } else if(busyEl){ busyEl.style.display='none'; }
}

/* ---------- Capture elemen ke canvas ---------- */
function captureEl(el, scale){
  return html2canvas(el, { scale: scale||3, useCORS:true, logging:false, backgroundColor:'#ffffff' });
}
function imgFit(pdf, canvas, x, y, maxW, maxH){
  var r = Math.min(maxW/canvas.width, maxH/canvas.height);
  var w = canvas.width*r, h = canvas.height*r;
  pdf.addImage(canvas.toDataURL('image/png'),'PNG', x, y, w, h);
  return h;
}
function badge(pdf,x,y,text,rgb){
  pdf.setFillColor(rgb[0],rgb[1],rgb[2]);
  pdf.roundedRect(x,y,16,5,1,1,'F');
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
  pdf.text(text, x+8, y+3.4, {align:'center'});
}

/* ---------- MODAL KONFIRMASI (wajib checkbox) ---------- */
var pendingMode = 'raster';
function showDownloadModal(mode){
  pendingMode = mode || 'raster';
  var modal = q('#downloadModal');
  var checkbox = q('#modalAck');
  var btnDownload = q('#btnModalDownload');
  var warning = q('#modalWarning');
  if(!modal){
    if(pendingMode==='editable') exportEditablePDF(); else doExportRaster();
    return;
  }
  checkbox.checked = false; btnDownload.disabled = true;
  var ok = (typeof window.canDownloadPDF==='function') ? window.canDownloadPDF() : true;
  if(!ok){
    warning.style.display='block';
    warning.textContent='Checklist proyek belum lengkap. Lengkapi di halaman utama, lalu centang box di bawah.';
  } else { warning.style.display='none'; }
  checkbox.onchange = function(){
    btnDownload.disabled = !checkbox.checked;
    if(checkbox.checked){
      try{ localStorage.setItem('pythagoras_modal_ack', JSON.stringify({acknowledged:true,timestamp:Date.now()})); }catch(e){}
    }
  };
  modal.classList.add('show');
}
function closeDownloadModal(){ var m=q('#downloadModal'); if(m) m.classList.remove('show'); }
function handleModalDownload(){
  var cb=q('#modalAck');
  if(!cb||!cb.checked){ alert('Centang checkbox terlebih dahulu!'); return; }
  closeDownloadModal();
  if(pendingMode==='editable') exportEditablePDF(); else doExportRaster();
}

/* ---------- JALUR 1: RASTER WYSIWYG (html2canvas) ---------- */
async function doExportRaster(){
  showBusy(true,'Membuat PDF gambar...');
  var previewCollapse = q('#previewCollapse');
  var wasCollapsed = previewCollapse && previewCollapse.classList.contains('collapsed');
  if(wasCollapsed){ previewCollapse.classList.remove('collapsed'); await new Promise(function(r){setTimeout(r,200);}); }
  if(typeof window.fitSheet==='function') window.fitSheet();
  await new Promise(function(r){setTimeout(r,300);});
  var sheet = q('.a4-sheet')||q('#exportArea');
  if(!sheet){ alert('Area export tidak ditemukan!'); showBusy(false); return; }
  var ot=sheet.style.transform, oo=sheet.style.transformOrigin;
  var vp=sheet.closest('.a4-viewport');
  var vh=vp?vp.style.height:'', vo=vp?vp.style.overflow:'';
  sheet.style.transform='none'; sheet.style.transformOrigin='top left';
  if(vp){ vp.style.height='auto'; vp.style.overflow='visible'; }
  await new Promise(function(r){setTimeout(r,100);});
  try{
    var canvas = await html2canvas(sheet,{scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff'});
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    var W=pdf.internal.pageSize.getWidth(), H=pdf.internal.pageSize.getHeight();
    var r=Math.min(W/canvas.width,H/canvas.height);
    var w=canvas.width*r,h=canvas.height*r;
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',(W-w)/2,(H-h)/2,w,h);
    pdf.setFontSize(8); pdf.setTextColor(150);
    pdf.text('Kalender Pythagoras 2027 - SMPN 2 Karawang Barat', W/2, H-4, {align:'center'});
    var name=(q('.proof-info h1')?q('.proof-info h1').textContent:'Bukti').replace(/[^a-z0-9]/gi,'_').substring(0,50);
    pdf.save(name+'.pdf');
  }catch(e){ console.error(e); alert('Gagal export PDF: '+e.message); }
  finally{
    sheet.style.transform=ot; sheet.style.transformOrigin=oo;
    if(vp){ vp.style.height=vh; vp.style.overflow=vo; }
    if(typeof window.fitSheet==='function') window.fitSheet();
    if(wasCollapsed && previewCollapse) previewCollapse.classList.add('collapsed');
    showBusy(false);
  }
}

/* ---------- JALUR 2: PRINT BROWSER ---------- */
function printPDF(){
  var pc=q('#previewCollapse');
  if(pc && pc.classList.contains('collapsed')){
    pc.classList.remove('collapsed');
    setTimeout(function(){ if(typeof window.fitSheet==='function') window.fitSheet(); window.print(); },200);
  } else { window.print(); }
}

/* ---------- JALUR 3: EDITABLE (teks vektor jsPDF) ---------- */
async function exportEditablePDF(){
  showBusy(true,'Membuat PDF editable (teks vektor)...');
  var pc=q('#previewCollapse');
  var wasCollapsed = pc && pc.classList.contains('collapsed');
  if(wasCollapsed){ pc.classList.remove('collapsed'); await new Promise(function(r){setTimeout(r,200);}); }
  if(typeof window.fitSheet==='function') window.fitSheet();
  await new Promise(function(r){setTimeout(r,300);});
  try{
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    var W=210,H=297,M=10; var y=M;

    /* Header */
    var title=safe(q('.export-header h2')?q('.export-header h2').textContent:'')||'Bukti Pythagoras';
    var sub=safe(q('.export-header p')?q('.export-header p').textContent:'')||'';
    pdf.setFont('helvetica','bold'); pdf.setFontSize(16); pdf.setTextColor(45,55,72);
    pdf.text(title, W/2, y+6, {align:'center'}); y+=10;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(113,128,150);
    pdf.text(sub, W/2, y+3, {align:'center'}); y+=7;
    pdf.setDrawColor(90,103,216); pdf.setLineWidth(0.8); pdf.line(M,y,W-M,y); y+=4;

    /* Kalender (gambar) */
    var calEl=q('#calBlock');
    if(calEl){ var c=await captureEl(calEl,3); y+=imgFit(pdf,c,M+5,y,W-2*M-10,72)+4; }

    /* Figures (gambar) + badge & caption (vektor) */
    var sc1=q('#figInitial .scene')||q('#figInitial');
    var sc2=q('#figFinal .scene')||q('#figFinal');
    var cap1=safe(q('#figInitial figcaption')?q('#figInitial figcaption').textContent:'')||'';
    var cap2=safe(q('#figFinal figcaption')?q('#figFinal figcaption').textContent:'')||'';
    var fw=(W-2*M-6)/2;
    badge(pdf,M,y,'AWAL',[237,137,54]);
    badge(pdf,M+fw+6,y,'AKHIR',[72,187,120]);
    y+=6;
    var h1=0,h2=0;
    if(sc1){ h1=imgFit(pdf,await captureEl(sc1,3),M,y,fw,58); }
    if(sc2){ h2=imgFit(pdf,await captureEl(sc2,3),M+fw+6,y,fw,58); }
    y+=Math.max(h1,h2)+2;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.setTextColor(74,85,104);
    var w1=pdf.splitTextToSize(cap1,fw), w2=pdf.splitTextToSize(cap2,fw);
    pdf.text(w1,M,y+2); pdf.text(w2,M+fw+6,y+2);
    y+=Math.max(w1.length,w2.length)*3.2+5;

    /* Penjelasan + rumus (vektor) */
    var expP=safe(q('.export-explain p')?q('.export-explain p').textContent:'')||'';
    var formula=safe(q('.export-formula')?q('.export-formula').textContent:'')||'';
    pdf.setFont('helvetica','bold'); pdf.setFontSize(10); pdf.setTextColor(45,55,72);
    pdf.text('Penjelasan:', M, y+2); y+=5;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(9);
    var lines=pdf.splitTextToSize(expP, W-2*M);
    pdf.text(lines, M, y+2); y+=lines.length*4+3;
    if(formula){
      pdf.setFillColor(250,240,200); pdf.rect(M,y,W-2*M,9,'F');
      pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(47,133,90);
      pdf.text(formula, W/2, y+6, {align:'center'}); y+=13;
    }

    /* Kesimpulan + nama kelompok (vektor) + QR (gambar) */
    var boxH=30;
    pdf.setFillColor(90,103,216); pdf.roundedRect(M,y,88,boxH,2,2,'F');
    pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(11);
    var conclRaw = q('.export-conclusion-text') ? q('.export-conclusion-text').innerText : 'KESIMPULAN:\na2 + b2 = c2';
    var concl = conclRaw.split('\n').map(safe);
    pdf.text(concl[0]||'KESIMPULAN:', M+4, y+9);
    pdf.setFontSize(13); pdf.text(concl[1]||'a2 + b2 = c2', M+4, y+18);
    pdf.setTextColor(45,55,72); pdf.setFontSize(9); pdf.setFont('helvetica','bold');
    pdf.text('Nama Anggota Kelompok:', M+93, y+6);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5);
    var dots=' .....................................';
    pdf.text('1.'+dots, M+93, y+12); pdf.text('3.'+dots, M+138, y+12);
    pdf.text('2.'+dots, M+93, y+17); pdf.text('4.'+dots, M+138, y+17);
    pdf.text('5.'+dots, M+93, y+22);
    var qrEl=q('#qrcode');
    if(qrEl){
      imgFit(pdf,await captureEl(qrEl,3), W-M-24, y+2, 22, 22);
      pdf.setFontSize(7); pdf.setTextColor(113,128,150);
      pdf.text('Scan untuk animasi', W-M-13, y+27, {align:'center'});
    }
    y+=boxH+6;

    /* Footer */
    pdf.setFontSize(8); pdf.setTextColor(150,150,150);
    pdf.text('Kalender Pythagoras 2027 - SMPN 2 Karawang Barat | PDF editable: teks vektor', W/2, H-6, {align:'center'});
    var name2=(q('.proof-info h1')?q('.proof-info h1').textContent:'Bukti').replace(/[^a-z0-9]/gi,'_').substring(0,40);
    pdf.save(name2+'-Editable-Canva.pdf');
  }catch(e){ console.error(e); alert('Gagal membuat PDF editable: '+e.message); }
  finally{
    if(wasCollapsed && pc) pc.classList.add('collapsed');
    if(typeof window.fitSheet==='function') window.fitSheet();
    showBusy(false);
  }
}

/* ---------- AUTO-RELABEL + INJEKSI TOMBOL (semua halaman) ---------- */
function enhanceButtons(){
  var bD=q('#btnDownloadPDF');
  if(bD){
    bD.innerHTML='PDF Gambar (Print/Arsip)';
    bD.title='PDF berbasis gambar: tampilan persis seperti layar. Cocok untuk print & arsip. Teks TIDAK bisa diedit.';
  }
  var bP=q('.btn-print');
  if(bP){
    bP.innerHTML='Print / Save as PDF';
    bP.title='PDF dari browser: teks asli (selectable). Lumayan ramah Canva.';
  }
  var wrap=bD?bD.parentElement:null;
  if(wrap && !q('#btnExportCanva')){
    var b=document.createElement('button');
    b.id='btnExportCanva';
    b.className='export-pdf-btn';
    b.style.background='#805ad5';
    b.innerHTML='PDF Editable (Canva)';
    b.title='PDF dengan teks vektor: judul, penjelasan, rumus, kesimpulan & nama kelompok bisa diedit di Canva.';
    b.onclick=function(){ showDownloadModal('editable'); };
    wrap.appendChild(b);
  }
  var bm=q('#btnModalDownload'); if(bm) bm.addEventListener('click', handleModalDownload);
  var bc=q('#btnModalCancel');  if(bc) bc.addEventListener('click', closeDownloadModal);
  var mo=q('#downloadModal');
  if(mo) mo.addEventListener('click', function(e){ if(e.target===mo) closeDownloadModal(); });
}

/* ---------- Expose global ---------- */
window.exportToPDF = function(){ showDownloadModal('raster'); };
window.printPDF = printPDF;
window.exportEditablePDF = exportEditablePDF;
window.closeDownloadModal = closeDownloadModal;
window.handleModalDownload = handleModalDownload;

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', enhanceButtons);
else enhanceButtons();
})();
