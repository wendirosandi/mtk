/* pdf-export.js v4.2 - support pythagoras-container baru */
(function(){
"use strict";
var q=function(s){return document.querySelector(s);};

function safe(s){
  if(!s) return '';
  var map={
    '\u2192':'->','\u2212':'-','\u2013':'-','\u2014':'-','\u2713':'v','\u2714':'v',
    '\u26A0':'!','\u2022':'-','\u00D7':'x','\u221A':'akar','\u0394':'delta','\u223C':'~',
    '\u2248':'~','\u2260':'!=','\u2264':'<=','\u2265':'>=','\u221E':'inf','\u03C0':'pi',
    '\u03B8':'theta','\u2026':'...','\u2018':"'",'\u2019':"'",'\u201C':'"','\u201D':'"',
    '\u200C':'','\u200D':'','\uFE0F':''
  };
  var out='';
  for(var i=0;i<s.length;i++){
    var cp=s.codePointAt(i); var ch=(cp>0xFFFF)?s.substr(i,2):s[i];
    if(cp>0xFFFF) i++;
    var rep=map[ch];
    if(rep!==undefined) out+=rep;
    else if(cp<=255) out+=ch;
  }
  return out.replace(/\s+/g,' ').trim();
}

var busyEl=null;
function showBusy(on,msg){
  if(on){
    if(!busyEl){
      busyEl=document.createElement('div');
      busyEl.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:3000;display:flex;align-items:center;justify-content:center;';
      busyEl.innerHTML='<div style="background:#fff;padding:20px 30px;border-radius:10px;font-weight:700;color:#5a67d8;">Membuat PDF...</div>';
      document.body.appendChild(busyEl);
    }
    busyEl.style.display='flex';
    if(msg) busyEl.querySelector('div').textContent=msg;
  } else if(busyEl){ busyEl.style.display='none'; }
}

function captureEl(el,scale){ return html2canvas(el,{scale:scale||3,useCORS:true,logging:false,backgroundColor:'#ffffff'}); }
function imgFit(pdf,canvas,x,y,maxW,maxH){
  var r=Math.min(maxW/canvas.width,maxH/canvas.height);
  var w=canvas.width*r,h=canvas.height*r;
  pdf.addImage(canvas.toDataURL('image/png'),'PNG',x,y,w,h);
  return h;
}
function badge(pdf,x,y,text,rgb){
  pdf.setFillColor(rgb[0],rgb[1],rgb[2]);
  pdf.roundedRect(x,y,18,5,1,1,'F');
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
  pdf.text(text,x+9,y+3.4,{align:'center'});
}

var pendingMode='raster';
function showDownloadModal(mode){
  pendingMode=mode||'raster';
  var modal=q('#downloadModal');
  var cb=q('#modalAck');
  var bd=q('#btnModalDownload');
  var w=q('#modalWarning');
  if(!modal){ if(pendingMode==='editable') exportEditablePDF(); else doExportRaster(); return; }
  cb.checked=false; bd.disabled=true;
  var ok=(typeof window.canDownloadPDF==='function')?window.canDownloadPDF():true;
  if(!ok){ w.style.display='block'; w.textContent='Checklist belum lengkap. Lengkapi dulu di halaman utama.'; }
  else w.style.display='none';
  cb.onchange=function(){
    bd.disabled=!cb.checked;
    if(cb.checked){ try{localStorage.setItem('pythagoras_modal_ack',JSON.stringify({acknowledged:true,timestamp:Date.now()}));}catch(e){} }
  };
  modal.classList.add('show');
}
function closeDownloadModal(){ var m=q('#downloadModal'); if(m) m.classList.remove('show'); }
function handleModalDownload(){
  var cb=q('#modalAck');
  if(!cb||!cb.checked){ alert('Centang checkbox dulu!'); return; }
  closeDownloadModal();
  if(pendingMode==='editable') exportEditablePDF(); else doExportRaster();
}

async function doExportRaster(){
  showBusy(true,'Membuat PDF gambar...');
  var pc=q('#previewCollapse');
  var was=pc && pc.classList.contains('collapsed');
  if(was){ pc.classList.remove('collapsed'); await new Promise(function(r){setTimeout(r,200);}); }
  if(typeof window.fitSheet==='function') window.fitSheet();
  await new Promise(function(r){setTimeout(r,300);});
  var sheet=q('.a4-sheet')||q('#exportArea');
  if(!sheet){ alert('Area export tidak ada!'); showBusy(false); return; }
  var ot=sheet.style.transform, oo=sheet.style.transformOrigin;
  var vp=sheet.closest('.a4-viewport');
  var vh=vp?vp.style.height:'', vo=vp?vp.style.overflow:'';
  sheet.style.transform='none'; sheet.style.transformOrigin='top left';
  if(vp){ vp.style.height='auto'; vp.style.overflow='visible'; }
  await new Promise(function(r){setTimeout(r,100);});
  try{
    var canvas=await html2canvas(sheet,{scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff'});
    var jsPDF=window.jspdf.jsPDF;
    var pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    var W=pdf.internal.pageSize.getWidth(), H=pdf.internal.pageSize.getHeight();
    var r=Math.min(W/canvas.width,H/canvas.height);
    var w=canvas.width*r, h=canvas.height*r;
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',(W-w)/2,(H-h)/2,w,h);
    pdf.setFontSize(8); pdf.setTextColor(150);
    pdf.text('Kalender Pythagoras 2027 - SMPN 2 Karawang Barat',W/2,H-4,{align:'center'});
    var name=(q('.proof-info h1')?q('.proof-info h1').textContent:'Bukti').replace(/[^a-z0-9]/gi,'_').substring(0,50);
    pdf.save(name+'.pdf');
  }catch(e){ console.error(e); alert('Gagal: '+e.message); }
  finally{
    sheet.style.transform=ot; sheet.style.transformOrigin=oo;
    if(vp){ vp.style.height=vh; vp.style.overflow=vo; }
    if(typeof window.fitSheet==='function') window.fitSheet();
    if(was && pc) pc.classList.add('collapsed');
    showBusy(false);
  }
}

function printPDF(){
  var pc=q('#previewCollapse');
  if(pc && pc.classList.contains('collapsed')){
    pc.classList.remove('collapsed');
    setTimeout(function(){ if(typeof window.fitSheet==='function') window.fitSheet(); window.print(); },200);
  } else window.print();
}

async function exportEditablePDF(){
  showBusy(true,'Membuat PDF editable...');
  var pc=q('#previewCollapse');
  var was=pc && pc.classList.contains('collapsed');
  if(was){ pc.classList.remove('collapsed'); await new Promise(function(r){setTimeout(r,200);}); }
  if(typeof window.fitSheet==='function') window.fitSheet();
  await new Promise(function(r){setTimeout(r,300);});
  try{
    var jsPDF=window.jspdf.jsPDF;
    var pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    var W=210,H=297,M=8; var y=6;

    /* Header */
    var title=safe(q('.export-header h2')?q('.export-header h2').textContent:'')||'Bukti Pythagoras';
    var sub=safe(q('.export-header p')?q('.export-header p').textContent:'')||'';
    pdf.setFont('helvetica','bold'); pdf.setFontSize(16); pdf.setTextColor(45,55,72);
    pdf.text(title,W/2,y+6,{align:'center'}); y+=10;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(113,128,150);
    pdf.text(sub,W/2,y+3,{align:'center'}); y+=7;
    pdf.setDrawColor(90,103,216); pdf.setLineWidth(0.8); pdf.line(M,y,W-M,y); y+=4;

    var calEl=q('#calBlock');
    if(calEl){ var c=await captureEl(calEl,3); y+=imgFit(pdf,c,M+5,y,W-2*M-10,72)+4; }

    var figures=q('.proof-figures .proof-figure');
    var fw=(W-2*M-6)/Math.max(figures.length,1);
    figures.forEach(function(fig,i){
      var badgeEl=fig.querySelector('.state-badge');
      var scene=fig.querySelector('.scene');
      var cap=fig.querySelector('figcaption');
      if(badgeEl) badge(pdf,M+i*(fw+3),y,safe(badgeEl.textContent),
        badgeEl.classList.contains('final')?[72,187,120]:
        badgeEl.classList.contains('initial')?[237,137,54]:[33,150,243]);
    });
    y+=6;
    var maxH=0;
    figures.forEach(function(fig,i){
      var scene=fig.querySelector('.scene');
      if(scene){
        (async function(){
          var c=await captureEl(scene,3);
          imgFit(pdf,c,M+i*(fw+3),y,fw-3,58);
        })();
      }
    });
    y+=60;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.setTextColor(74,85,104);
    figures.forEach(function(fig,i){
      var cap=fig.querySelector('figcaption');
      if(cap){
        var lines=pdf.splitTextToSize(safe(cap.textContent),fw-3);
        pdf.text(lines,M+i*(fw+3),y+2);
      }
    });
    y+=8;

    var expP=safe(q('.export-explain p')?q('.export-explain p').textContent:'')||'';
    var formulaCalc=safe(q('.formula-calc')?q('.formula-calc').textContent:'');
    var formulaVerif=safe(q('.formula-verified')?q('.formula-verified').textContent:'');

    pdf.setFont('helvetica','bold'); pdf.setFontSize(10); pdf.setTextColor(45,55,72);
    pdf.text('Penjelasan:',M,y+2); y+=5;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(9);
    var lines=pdf.splitTextToSize(expP,W-2*M);
    pdf.text(lines,M,y+2); y+=lines.length*4+3;

    if(formulaCalc){
      pdf.setFillColor(255,243,205); pdf.rect(M,y,W-2*M,9,'F');
      pdf.setDrawColor(255,193,7); pdf.setLineWidth(0.5); pdf.line(M,y,M,y+9);
      pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(51,51,51);
      var text=formulaCalc + (formulaVerif?('   '+formulaVerif):'');
      pdf.text(text,W/2,y+6,{align:'center'}); y+=13;
    }

    /* Kesimpulan baru (pythagoras-container) */
    var pyLabel=safe(q('.pythagoras-label')?q('.pythagoras-label').textContent:'KESIMPULAN:');
    var pyRumus=safe(q('.pythagoras-rumus')?q('.pythagoras-rumus').textContent:'a2 + b2 = c2');
    var pyTeks=safe(q('.pythagoras-teks')?q('.pythagoras-teks').textContent:'');

    var boxH=20;
    pdf.setFillColor(90,103,216);
    pdf.roundedRect(M,y,130,boxH,2,2,'F');
    pdf.setTextColor(255,255,255); pdf.setFont('helvetica','normal'); pdf.setFontSize(10);
    pdf.text(pyLabel,M+3,y+7);
    pdf.setFont('helvetica','bold'); pdf.setFontSize(13);
    pdf.text(pyRumus,M+3+pdf.getTextWidth(pyLabel+'  '),y+7.5);
    if(pyTeks){
      pdf.setFont('helvetica','oblique'); pdf.setFontSize(9);
      var tLines=pdf.splitTextToSize('"'+pyTeks+'"',W-2*M-135);
      pdf.text(tLines,M+133,y+5);
    }
    y+=boxH+3;

    /* Nama kelompok */
    pdf.setTextColor(45,55,72); pdf.setFontSize(9); pdf.setFont('helvetica','bold');
    pdf.text('Nama Anggota Kelompok:',M,y+4);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5);
    var dots=' .....................................';
    pdf.text('1.'+dots,M,y+10); pdf.text('3.'+dots,M+45,y+10);
    pdf.text('2.'+dots,M,y+15); pdf.text('4.'+dots,M+45,y+15);
    pdf.text('5.'+dots,M,y+20);
    var qrEl=q('#qrcode');
    if(qrEl){
      imgFit(pdf,await captureEl(qrEl,3),W-M-24,y+1,22,22);
      pdf.setFontSize(7); pdf.setTextColor(113,128,150);
      pdf.text('Scan untuk animasi',W-M-13,y+26,{align:'center'});
    }
    y+=26;

    pdf.setFontSize(8); pdf.setTextColor(150,150,150);
    pdf.text('Kalender Pythagoras 2027 - SMPN 2 Karawang Barat | PDF editable',W/2,H-4,{align:'center'});
    var name=(q('.proof-info h1')?q('.proof-info h1').textContent:'Bukti').replace(/[^a-z0-9]/gi,'_').substring(0,40);
    pdf.save(name+'-Editable-Canva.pdf');
  }catch(e){ console.error(e); alert('Gagal: '+e.message); }
  finally{
    if(was && pc) pc.classList.add('collapsed');
    if(typeof window.fitSheet==='function') window.fitSheet();
    showBusy(false);
  }
}

function enhanceButtons(){
  var bD=q('#btnDownloadPDF');
  if(bD){ bD.innerHTML='PDF Gambar (Print/Arsip)'; bD.onclick=function(){showDownloadModal('raster');}; }
  var bP=q('.btn-print');
  if(bP){ bP.innerHTML='Print / Save as PDF'; bP.onclick=printPDF; }
  var wrap=bD?bD.parentElement:null;
  if(wrap && !q('#btnExportCanva')){
    var b=document.createElement('button');
    b.id='btnExportCanva'; b.className='export-pdf-btn';
    b.style.background='#805ad5';
    b.innerHTML='PDF Editable (Canva)';
    b.onclick=function(){showDownloadModal('editable');};
    wrap.appendChild(b);
  }
  var bm=q('#btnModalDownload'); if(bm) bm.addEventListener('click',handleModalDownload);
  var bc=q('#btnModalCancel'); if(bc) bc.addEventListener('click',closeDownloadModal);
  var mo=q('#downloadModal'); if(mo) mo.addEventListener('click',function(e){if(e.target===mo) closeDownloadModal();});
}

window.exportToPDF=function(){showDownloadModal('raster');};
window.printPDF=printPDF;
window.exportEditablePDF=exportEditablePDF;
window.closeDownloadModal=closeDownloadModal;
window.handleModalDownload=handleModalDownload;

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',enhanceButtons);
else enhanceButtons();
})();