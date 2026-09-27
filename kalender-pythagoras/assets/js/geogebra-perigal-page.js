/* =====================================================
   geogebra-perigal-page.js  v1.5
   - semua deklarasi fungsi top-level (aman strict-mode)
   - fullscreen native + pseudo (iOS) + tombol ❌
   - mode capture FIT / sesuai tampilan
   - overlay error + tombol Coba Lagi
===================================================== */
(function(){
"use strict";

var engine=null;
var config=window.PERIGAL_CONFIG||{};

/* ---------- fullscreen ---------- */
function isFs(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement) ||
         !!document.querySelector('.ggb-wrap.pseudo-fullscreen');
}
function setFsBtn(on){
  var b=document.getElementById('btnFullscreen');
  if(b){
    b.textContent=on?'❌':'️';
    b.title=on?'Keluar Layar Penuh (Esc / tap ini)':'Layar Penuh';
  }
}
function resizeApplet(){
  setTimeout(function(){
    if(engine && engine.applet && typeof engine.applet.setSize==='function'){
      var el=document.getElementById('ggb-element');
      if(el){
        var r=el.getBoundingClientRect();
        engine.applet.setSize(Math.round(r.width),Math.round(r.height));
      }
    }
  },200);
}
function toggleFullscreen(){
  var wrap=document.querySelector('.ggb-wrap');
  if(!wrap){ return; }
  if(!isFs()){
    if(wrap.requestFullscreen){ wrap.requestFullscreen(); }
    else if(wrap.webkitRequestFullscreen){ wrap.webkitRequestFullscreen(); }
    else { wrap.classList.add('pseudo-fullscreen'); setFsBtn(true); resizeApplet(); }
  } else {
    if(document.fullscreenElement && document.exitFullscreen){ document.exitFullscreen(); }
    else if(document.webkitFullscreenElement && document.webkitExitFullscreen){ document.webkitExitFullscreen(); }
    else { wrap.classList.remove('pseudo-fullscreen'); setFsBtn(false); resizeApplet(); }
  }
}

/* ---------- overlay error ---------- */
function showLoadError(kind){
  var l=document.getElementById('ggbLoading');
  if(!l){ return; }
  l.style.display='flex';
  l.innerHTML=
    '<div style="text-align:center;padding:16px;">'+
      '<div style="color:#c53030;font-weight:700;margin-bottom:8px;">⚠ Gagal memuat GeoGebra</div>'+
      '<div style="font-size:13px;color:#7f8c8d;margin-bottom:12px;">Periksa koneksi internet, lalu coba lagi.<br>(Kode: '+kind+')</div>'+
      '<button id="btnRetryGgb" style="background:#5a67d8;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;">🔁 Coba Lagi</button>'+
    '</div>';
  var b=document.getElementById('btnRetryGgb');
  if(b){
    b.onclick=function(){
      l.innerHTML='⏳ Memuat ulang GeoGebra… mohon tunggu';
      if(window.PerigalEngine && window.PerigalEngine.retryLoad){ window.PerigalEngine.retryLoad(); }
      else { window.location.reload(); }
    };
  }
}

/* ---------- init ---------- */
function init(){
  var s=document.createElement('script');
  s.src='https://www.geogebra.org/apps/deployggb.js';
  s.onload=function(){
    console.log('[perigal] deployggb terunduh');
    initEngine();
    initUI();
    initExport();
  };
  s.onerror=function(){
    console.error('[perigal] deployggb GAGAL diunduh (CDN/jaringan)');
    showLoadError('cdn');
  };
  document.head.appendChild(s);
}

function initEngine(){
  engine=window.PerigalEngine;
  engine.init('ggb-element',{
    locked: !!config.locked,
    material_id:config.material_id||'fwwhu8yb',
    width:config.width||'100%',
    height:config.height||480,
    defaultTriple:config.defaultTriple||'345',
    defaultPosisi:config.defaultPosisi||{horizontal:'tengah',vertikal:'tengah'},
    defaultSpeed:config.defaultSpeed||4,
    onReady:function(){
      console.log('✅ GeoGebra siap');
      var l=document.getElementById('ggbLoading');
      if(l){ l.style.display='none'; }
      enableControls(true);
    },
    onStepChange:function(step){ updateInfo(step); updateProgress(step); },
    onStepComplete:function(){ updateUIState(false,false); },
    onAnimationComplete:function(){ updateUIState(false,false); },
    onLoadError:function(kind){ showLoadError(kind); }
  });
}

function initUI(){
  if(config.stepsInfo){ window.stepsInfo=config.stepsInfo; }

  var btnPlay=document.getElementById('btnPlay');
  var btnPause=document.getElementById('btnPause');
  var btnReset=document.getElementById('btnReset');
  var btnEnd=document.getElementById('btnEnd');

  if(btnPlay){
    btnPlay.onclick=function(){
      if(!engine){ return; }
      engine.play();
      var running=engine.isAnimationRunning();
      updateUIState(running, engine.isPausedState());
      updateStatus(engine.getCurrentStep());
    };
  }
  if(btnPause){
    btnPause.onclick=function(){
      if(!engine){ return; }
      engine.pause();
      updateUIState(engine.isAnimationRunning(), engine.isPausedState());
    };
  }
  if(btnReset){
    btnReset.onclick=function(){
      if(!engine){ return; }
      engine.reset();
      updateUIState(false,false);
      updateStatus(0);
    };
  }
  if(btnEnd){
    btnEnd.onclick=function(){
      if(!engine){ return; }
      engine.jumpToEnd();
      updateUIState(false,false);
      updateStatus(5);
    };
  }

  var map={
    btnZoomIn:function(){ engine.zoomIn(); },
    btnZoomOut:function(){ engine.zoomOut(); },
    btnResetView:function(){ engine.resetView(); },
    btnFullscreen:function(){ toggleFullscreen(); },
    btnPanUp:function(){ engine.pan('up'); },
    btnPanDown:function(){ engine.pan('down'); },
    btnPanLeft:function(){ engine.pan('left'); },
    btnPanRight:function(){ engine.pan('right'); }
  };
  Object.keys(map).forEach(function(id){
    var el=document.getElementById(id);
    if(el){ el.onclick=map[id]; }
  });

  var ss=document.getElementById('speedSlider');
  if(ss){
    ss.oninput=function(){
      if(engine){ engine.setSpeed(parseInt(this.value,10)); }
      var v=this.value;
      var l=(v==='4')?'4x (Normal)':(v==='1')?'1x (Paling Lambat)':(v+'x');
      var sv=document.getElementById('speedValue');
      if(sv){ sv.textContent=l; }
    };
  }

  var triples=document.querySelectorAll('input[name="triple"]');
  for(var i=0;i<triples.length;i++){
    triples[i].onchange=function(){ if(engine){ engine.setTriple(this.value); } };
  }
  var pos=document.querySelectorAll('input[name="horizontal"],input[name="vertikal"]');
  for(var j=0;j<pos.length;j++){
    pos[j].onchange=updatePosisi;
  }

  enableControls(false);
}

function updatePosisi(){
  var h=document.querySelector('input[name="horizontal"]:checked');
  var v=document.querySelector('input[name="vertikal"]:checked');
  if(h && v && engine){ engine.setPosisiPerpotongan(h.value,v.value); }
}

function enableControls(on){
  var els=document.querySelectorAll('.ggb-controls-top button,.icon-btn');
  for(var i=0;i<els.length;i++){ els[i].disabled=!on; }
}

function updateInfo(step){
  var b=document.getElementById('infoBox');
  if(!b || !window.stepsInfo){ return; }
  b.style.opacity=0;
  setTimeout(function(){
    b.textContent=window.stepsInfo[step]||'';
    b.style.opacity=1;
  },200);
}

function updateProgress(step){
  var p=document.getElementById('progressBar');
  if(p){ p.style.width=((step/5)*100)+'%'; }
}

function updateStatus(step){
  var t=document.getElementById('statusText');
  if(!t){ return; }
  var texts={
    0:'Siap dimulai - Klik Play untuk Langkah 1',
    1:'Langkah 1 selesai - Klik Play untuk Langkah 2',
    2:'Langkah 2 selesai - Klik Play untuk Langkah 3',
    3:'Langkah 3 selesai - Klik Play untuk Langkah 4',
    4:'Langkah 4 selesai - Klik Play untuk Langkah 5',
    5:'Selesai! Klik Reset untuk mengulang'
  };
  t.textContent=texts[step]||'';
}

function updateUIState(playing,paused){
  var p=document.getElementById('btnPlay');
  var pa=document.getElementById('btnPause');
  if(p){ p.disabled=playing; }
  if(pa){
    pa.disabled=!playing;
    pa.textContent=paused?'▶️ Lanjut':'⏸️ Jeda';
  }
}

function initExport(){
  window.refreshSheet=async function(){
    if(!engine || !engine.isReady){ await engine.waitForReady(); }
    console.log('📸 Capturing 2 gambar (AWAL=Langkah 3, AKHIR=Langkah 5)...');
    var steps=[3,5];
    var targets=['figAwal','figAkhir'];
    var labels=['Awal','Akhir'];
    var useCurrent=false;
    var chk=document.getElementById('chkCaptureCurrent');
    if(chk){ useCurrent=chk.checked; }
    try{
      for(var i=0;i<steps.length;i++){
        await engine.jumpToStep(steps[i]);
        if(!useCurrent){ engine.resetView(); }
        await new Promise(function(r){ setTimeout(r,400); });
        var img=await engine.takeScreenshotAsync();
        var el=document.getElementById(targets[i]);
        if(el && img){
          el.innerHTML='<img src="'+img+'" alt="Gambar '+labels[i]+'">';
        } else if(el){
          el.innerHTML='<div style="color:#c53030;font-size:12px;padding:8px;">⚠ Capture gambar '+labels[i]+' gagal</div>';
        }
      }
      await engine.reset();
      console.log('✅ 2 gambar berhasil (AWAL & AKHIR)');
    }catch(e){
      console.error('❌ Capture gagal:',e);
    }
  };

  var btn=document.getElementById('btnPreview');
  if(btn){
    var old=window.togglePreview;
    window.togglePreview=function(){
      if(old){ old(); }
      var col=document.getElementById('previewCollapse');
      if(col && !col.classList.contains('collapsed')){ window.refreshSheet(); }
    };
  }
}

/* ---------- listener fullscreen ---------- */
document.addEventListener('fullscreenchange',function(){
  setFsBtn(!!document.fullscreenElement);
  resizeApplet();
});
document.addEventListener('webkitfullscreenchange',function(){
  setFsBtn(!!document.webkitFullscreenElement);
  resizeApplet();
});

/* ---------- start ---------- */
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
} else {
  init();
}
})();