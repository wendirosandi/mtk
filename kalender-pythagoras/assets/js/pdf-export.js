/* =====================================================
   pdf-export.js  v4.0
   - 3 jalur export: raster (WYSIWYG), print browser, editable (Canva)
   - Auto-relabel tombol + injeksi tombol 📝 di semua halaman
   - Modal konfirmasi tetap wajib (checkbox)
   ===================================================== */
(function(){
"use strict";
const q = s => document.querySelector(s);

/* ---------- Sanitasi teks ke WinAnsi (aman untuk jsPDF) ---------- */
function safe(s){
  if(!s) return '';
  const map = {'→':'->','−':'-','–':'-','—':'-','✓':'v','✔':'v','⚠':'!','•':'-',
    '×':'x','√':'akar','Δ':'delta','∼':'~','≈':'~','≠':'!=','≤':'<=','≥':'>=',
    '∞':'inf','π':'pi','θ':'theta','…':'...','‘':"'",'’':"'','“':'"','”':'"',
    '‌':'','‍':'','':'','':'','':'','':'','↺':'','▶':'','⏸':'','':'','💡':'','📋':'','⏱':'','️':''};
  let out='';
  for(const ch of s){
    const cp = ch.codePointAt(0);
    out += (map[ch]!==undefined) ? map[ch] : (cp<=255 ? ch : '');
  }
  return out.replace(/\s+/g,' ').trim();
}

/* ---------- Overlay sibuk ---------- */
let busyEl = null;
function showBusy(on, msg){
  if(on){
    if(!busyEl){
      busyEl = document.createElement('div');
      busyEl.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:3000;display:flex;align-items:center;justify-content:center;';
      busyEl.innerHTML='<div style="background:#fff;padding:20px 30px;border-radius:10px;font-weight:700;color:#5a67d8;">⏳ Membuat PDF… mohon tunggu</div>';
      document.body.appendChild(busyEl);
    }
    busyEl.style.display='flex';
    if(msg) busyEl.querySelector('div').textContent = msg;
  } else if(busyEl){ busyEl.style.display='none'; }
}

/* ---------- Capture elemen ke canvas ---------- */
async function captureEl(el, scale){
  return await html2canvas(el, { scale: scale||3, useCORS:true, logging:false, backgroundColor:'#ffffff' });
}
function imgFit(pdf, canvas, x, y, maxW, maxH){
  const r = Math.min(maxW/canvas.width, maxH/canvas.height);
  const w = canvas.width*r, h = canvas.height*r;
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
let pendingMode = 'raster';
function showDownloadModal(mode){
  pendingMode = mode || 'raster';
  const modal = q('#downloadModal');
  const checkbox = q('#modalAck');
  const btnDownload = q('#btnModalDownload');
  const warning = q('#modalWarning');
  if(!modal){ (pendingMode==='editable'? exportEditablePDF() : doExportRaster()); return; }
  checkbox.checked = false; btnDownload.disabled = true;
  const ok = (typeof window.canDownloadPDF==='function') ? window.canDownloadPDF() : true;
  if(!ok){ warning.style.display='block';
    warning.textContent='⚠️ Checklist proyek belum lengkap. Lengkapi di halaman utama, lalu centang box di bawah.'; }
  else warning.style.display='none';
  checkbox.onchange = () => {
    btnDownload.disabled = !checkbox.checked;
    if(checkbox.checked){ try{ localStorage.setItem('pythagoras_modal_ack', JSON.stringify({acknowledged:true,timestamp:Date.now()})); }catch(e){} }
  };
  modal.classList.add('show');
}
function closeDownloadModal(){ const m=q('#downloadModal'); if(m) m.classList.remove('show'); }
function handleModalDownload(){
  const cb=q('#modalAck'); if(!cb||!cb.checked){ alert('⚠️ Centang checkbox terlebih dahulu!'); return; }
  closeDownloadModal();
  if(pendingMode==='editable') exportEditablePDF(); else doExportRaster();
}

/* ---------- JALUR 1: RASTER WYSIWYG (html2canvas) ---------- */
async function doExportRaster(){
  showBusy(true,'⏳ Membuat PDF gambar…');
  const previewCollapse = q('#previewCollapse');
  const wasCollapsed = previewCollapse && previewCollapse.classList.contains('collapsed');
  if(wasCollapsed){ previewCollapse.classList.remove('collapsed'); await new Promise(r=>setTimeout(r,200)); }
  if(typeof window.fitSheet==='function') window.fitSheet();
  await new Promise(r=>setTimeout(r,300));
  const sheet = q('.a4-sheet')||q('#exportArea');
  if(!sheet){ alert('❌ Area export tidak ditemukan!'); showBusy(false); return; }
  const ot=sheet.style.transform, oo=sheet.style.transformOrigin;
  const vp=sheet.closest('.a4-viewport');
  const vh=vp?vp.style.height:'', vo=vp?vp.style.overflow:'';
  sheet.style.transform='none'; sheet.style.transformOrigin='top left';
  if(vp){ vp.style.height='auto'; vp.style.overflow='visible'; }
  await new Promise(r=>setTimeout(r,100));
  try{
    const canvas = await html2canvas(sheet,{scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff'});
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=pdf.internal.pageSize.getWidth(), H=pdf.internal.pageSize.getHeight();
    const r=Math.min(W/canvas.width,H/canvas.height);
    const w=canvas.width*r,h=canvas.height*r;
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',(W-w)/2,(H-h)/2,w,h);
    pdf.setFontSize(8); pdf.setTextColor(150);
    pdf.text('Kalender Pythagoras 2027 - SMPN 2 Karawang Barat', W/2, H-4, {align:'center'});
    const name=(q('.proof-info h1')?.textContent||'Bukti').replace(/[^a-z0-9]/gi,'_').substring(0,50);
    pdf.save(name+'.pdf');
  }catch(e){ console.error(e); alert('❌ Gagal export PDF: '+e.message); }
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
  const pc=q('#previewCollapse');
  if(pc && pc.classList.contains('collapsed')){
    pc.classList.remove('collapsed');
    setTimeout(()=>{ if(typeof window.fitSheet==='function') window.fitSheet(); window.print(); },200);
  } else window.print();
}

/* ---------- JALUR 3: EDITABLE (teks vektor jsPDF) ---------- */
async function exportEditablePDF(){
  showBusy(true,'⏳ Membuat PDF editable (teks vektor)…');
  const pc=q('#previewCollapse');
  const wasCollapsed = pc && pc.classList.contains('collapsed');
  if(wasCollapsed){ pc.classList.remove('collapsed'); await new Promise(r=>setTimeout(r,200)); }
  if(typeof window.fitSheet==='function') window.fitSheet();
  await new Promise(r=>setTimeout(r,300));
  try{
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=210,H=297,M=10; let y=M;

    /* Header */
    const title=safe(q('.export-header h2')?.textContent)||'Bukti Pythagoras';
    const sub=safe(q('.export-header p')?.textContent)||'';
    pdf.setFont('helvetica','bold'); pdf.setFontSize(16); pdf.setTextColor(45,55,72);
    pdf.text(title, W/2, y+6, {align:'center'}); y+=10;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(113,128,150);
    pdf.text(sub, W/2, y+3, {align:'center'}); y+=7;
    pdf.setDrawColor(90,103,216); pdf.setLineWidth(0.8); pdf.line(M,y,W-M,y); y+=4;

    /* Kalender (gambar) */
    const calEl=q('#calBlock');
    if(calEl){ const c=await captureEl(calEl,3); y+=imgFit(pdf,c,M+5,y,W-2*M-10,72)+4; }

    /* Figures (gambar) + badge & caption (vektor) */
    const sc1=q('#figInitial .scene')||q('#figInitial');
    const sc2=q('#figFinal .scene')||q('#figFinal');
    const cap1=safe(q('#figInitial figcaption')?.textContent)||'';
    const cap2=safe(q('#figFinal figcaption')?.textContent)||'';
    const fw=(W-2*M-6)/2;
    badge(pdf,M,y,'AWAL',[237,137,54]);
    badge(pdf,M+fw+6,y,'AKHIR',[72,187,120]);
    y+=6;
    let h1=0,h2=0;
    if(sc1){ h1=imgFit(pdf,await captureEl(sc1,3),M,y,fw,58); }
    if(sc2){ h2=imgFit(pdf,await captureEl(sc2,3),M+fw+6,y,fw,58); }
    y+=Math.max(h1,h2)+2;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.setTextColor(74,85,104);
    const w1=pdf.splitTextToSize(cap1,fw), w2=pdf.splitTextToSize(cap2,fw);
    pdf.text(w1,M,y+2); pdf.text(w2,M+fw+6,y+2);
    y+=Math.max(w1.length,w2.length)*3.2+5;

    /* Penjelasan + rumus (vektor) */
    const expP=safe(q('.export-explain p')?.textContent)||'';
    const formula=safe(q('.export-formula')?.textContent)||'';
    pdf.setFont('helvetica','bold'); pdf.setFontSize(10); pdf.setTextColor(45,55,72);
    pdf.text('Penjelasan:', M, y+2); y+=5;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(9);
    const lines=pdf.splitTextToSize(expP, W-2*M);
    pdf.text(lines, M, y+2); y+=lines.length*4+3;
    if(formula){
      pdf.setFillColor(250,240,200); pdf.rect(M,y,W-2*M,9,'F');
      pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(47,133,90);
      pdf.text(formula, W/2, y+6, {align:'center'}); y+=13;
    }

    /* Kesimpulan (box vektor) + nama kelompok (vektor) + QR (gambar) */
    const boxH=30;
    pdf.setFillColor(90,103,216); pdf.roundedRect(M,y,88,boxH,2,2,'F');
    pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(11);
    const concl=(q('.export-conclusion-text')?.innerText||'KESIMPULAN:\na2 + b2 = c2').split('\n').map(safe);
    pdf.text(concl[0]||'KESIMPULAN:', M+4, y+9);
    pdf.setFontSize(13); pdf.text(concl[1]||'a2 + b2 = c2', M+4, y+18);
    pdf.setTextColor(45,55,72); pdf.setFontSize(9); pdf.setFont('helvetica','bold');
    pdf.text('Nama Anggota Kelompok:', M+93, y+6);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5);
    const dots=' .....................................';
    pdf.text('1.'+dots, M+93, y+12); pdf.text('3.'+dots, M+138, y+12);
    pdf.text('2.'+dots, M+93, y+17); pdf.text('4.'+dots, M+138, y+17);
    pdf.text('5.'+dots, M+93, y+22);
    const qrEl=q('#qrcode');
    if(qrEl){ imgFit(pdf,await captureEl(qrEl,3), W-M-24, y+2, 22, 22);
      pdf.setFontSize(7); pdf.setTextColor(113,128,150);
      pdf.text('Scan untuk animasi', W-M-13, y+27, {align:'center'}); }
    y+=boxH+6;

    /* Footer */
    pdf.setFontSize(8); pdf.setTextColor(150,150,150);
    pdf.text('Kalender Pythagoras 2027 - SMPN 2 Karawang Barat | PDF editable: teks vektor', W/2, H-6, {align:'center'});
    const name=(q('.proof-info h1')?.textContent||'Bukti').replace(/[^a-z0-9]/gi,'_').substring(0,40);
    pdf.save(name+'-Editable-Canva.pdf');
  }catch(e){ console.error(e); alert('❌ Gagal membuat PDF editable: '+e.message); }
  finally{
    if(wasCollapsed && pc) pc.classList.add('collapsed');
    if(typeof window.fitSheet==='function') window.fitSheet();
    showBusy(false);
  }
}

/* ---------- AUTO-RELABEL + INJEKSI TOMBOL (semua halaman) ---------- */
function enhanceButtons(){
  const bD=q('#btnDownloadPDF');
  if(bD){
    bD.innerHTML='📄 PDF Gambar (Print/Arsip)';
    bD.title='PDF berbasis gambar: tampilan persis seperti layar. Cocok untuk print & arsip. Teks TIDAK bisa diedit.';
  }
  const bP=q('.btn-print');
  if(bP){
    bP.innerHTML='🖨 Print / Save as PDF';
    bP.title='PDF dari browser: teks asli (selectable). Lumayan ramah Canva.';
  }
  const wrap=bD?bD.parentElement:null;
  if(wrap && !q('#btnExportCanva')){
    const b=document.createElement('button');
    b.id='btnExportCanva';
    b.className='export-pdf-btn';
    b.style.background='#805ad5';
    b.innerHTML='📝 PDF Editable (Canva)';
    b.title='PDF dengan teks vektor: judul, penjelasan, rumus, kesimpulan & nama kelompok bisa diedit di Canva.';
    b.onclick=()=>showDownloadModal('editable');
    wrap.appendChild(b);
  }
  const bm=q('#btnModalDownload'); if(bm) bm.addEventListener('click', handleModalDownload);
  const bc=q('#btnModalCancel');  if(bc) bc.addEventListener('click', closeDownloadModal);
  const mo=q('#downloadModal');
  if(mo) mo.addEventListener('click', e=>{ if(e.target===mo) closeDownloadModal(); });
}

/* ---------- Expose global ---------- */
window.exportToPDF = ()=>showDownloadModal('raster');
window.printPDF = printPDF;
window.exportEditablePDF = exportEditablePDF;
window.closeDownloadModal = closeDownloadModal;
window.handleModalDownload = handleModalDownload;

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', enhanceButtons);
else enhanceButtons();
})();
