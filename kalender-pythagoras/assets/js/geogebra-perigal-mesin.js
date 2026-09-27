/* =====================================================
   geogebra-perigal-mesin.js  v1.8  (AGGRESSIVE DEBUG)
   - _ensureConfig dipanggil via aggressive polling 500ms x 30
   - setiap tahap log verbose untuk diagnosa
   - reset() log setiap tahap
===================================================== */
(function(){
"use strict";

var PerigalEngine = {
  applet:null, containerId:null, config:null, isReady:false,
  currentStep:0, isPlaying:false, isPaused:false, currentSpeed:4,
  currentTriple:'345', timeouts:[], animationMonitor:null, currentSliderIndex:0,
  currentCoord:{xmin:-10,xmax:20,ymin:-10,ymax:20},
  currentPosisi:{horizontal:'tengah',vertikal:'tengah'},
  _injected:false, _retried:false, _ggb:null, _pollInterval:null, _pollCount:0,

  sliders:["d_1","a_1","w_1","v_1","t_1"],
  nilaiAkhirSlider:{"d_1":"E_1","a_1":"D_1","w_1":"C_1","v_1":"B_1","t_1":"Z"},
  kategoriObjek:{
    poligon:["poli1","poli2","poli3"],
    bayangan:["poli1'"],
    garisPotong:["f_2","g_2"],
    potongan:["q11","q21","q31","q41"]
  },
  triples:{
    "345":{Ax:3,Ay:0,Cx:0,Cy:4},
    "51213":{Ax:5,Ay:0,Cx:0,Cy:12},
    "6810":{Ax:6,Ay:0,Cx:0,Cy:8},
    "72425":{Ax:7,Ay:0,Cx:0,Cy:24},
    "81517":{Ax:8,Ay:0,Cx:0,Cy:15}
  },

  /* ---------- INISIALISASI ---------- */
  init:function(containerId,config){
    console.log('[perigal-v1.8] init dipanggil, containerId='+containerId);
    console.log('[perigal-v1.8] config:', JSON.stringify(config||{}));
    this.containerId=containerId;
    this.config=config||{};
    this.currentTriple=this.config.defaultTriple||'345';
    this.currentSpeed=this.config.defaultSpeed||4;
    var dp=this.config.defaultPosisi||{horizontal:'tengah',vertikal:'tengah'};
    this.currentPosisi={horizontal:dp.horizontal,vertikal:dp.vertikal};
    var self=this;
    var params={
      "appName":"classic",
      "material_id":this.config.material_id||'fwwhu8yb',
      "width":this.config.width||'100%',
      "height":this.config.height||480,
      "showToolBar":false,"showAlgebraInput":false,"showMenuBar":false,
      "showZoomButtons":false,"showFullscreenButton":false,"showResetIcon":false,
      "showMenuButton":false,"showSuggestionButtons":false,
      "enableShiftDragZoom":false,
      "appletOnLoad":function(api){
        console.log('[perigal-v1.8] appletOnLoad terpanggil - applet siap');
        self.applet=api;
        self.isReady=true;
        console.log('[perigal-v1.8] akan memanggil reset()');
        try{
          self.reset();
        }catch(e){
          console.error('[perigal-v1.8] reset() melempar error:', e);
        }
        console.log('[perigal-v1.8] reset() selesai, memulai polling agresif');
        if(self.config.locked){
          self._startAggressivePolling();
        }
        if(self.config.onReady){ self.config.onReady(); }
      }
    };
    this._ggb=new GGBApplet(params,true);
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',function(){
        setTimeout(function(){ self.injectNow(); },0);
      });
    } else {
      setTimeout(function(){ self.injectNow(); },0);
    }
    this._startWatchdog();
  },

  injectNow:function(){
    if(this._injected){ return; }
    this._injected=true;
    console.log('[perigal-v1.8] inject dipanggil');
    try{
      this._ggb.inject(this.containerId);
    }catch(e){
      console.error('[perigal-v1.8] inject melempar error:',e);
      this._injected=false;
      if(this.config.onLoadError){ this.config.onLoadError('inject'); }
    }
  },

  _startWatchdog:function(){
    var self=this;
    setTimeout(function(){
      if(self.isReady){ return; }
      console.warn('[perigal-v1.8] watchdog: applet belum siap dalam 10 detik');
      if(!self._retried){
        self._retried=true;
        self._injected=false;
        self.injectNow();
        setTimeout(function(){
          if(!self.isReady && self.config.onLoadError){ self.config.onLoadError('timeout'); }
        },6000);
      } else if(self.config.onLoadError){
        self.config.onLoadError('timeout');
      }
    },10000);
  },

  retryLoad:function(){
    console.log('[perigal-v1.8] retryLoad manual');
    this._injected=false;
    this._retried=false;
    this.injectNow();
    this._startWatchdog();
  },

  /* ---------- AGGRESSIVE POLLING (v1.8 BARU) ---------- */
  _startAggressivePolling:function(){
    var self=this;
    if(this._pollInterval){ clearInterval(this._pollInterval); }
    this._pollCount=0;
    console.log('[perigal-v1.8] Polling agresif dimulai (max 30x @500ms)');
    this._pollInterval=setInterval(function(){
      self._pollCount++;
      console.log('[perigal-v1.8] Poll #'+self._pollCount+'/30');
      try{
        var changed=self._ensureConfig('poll-'+self._pollCount);
        var A=self._readPt('A');
        var C=self._readPt('C');
        var t=self.triples[self.config.defaultTriple];
        console.log('[perigal-v1.8]   A=('+A.x+','+A.y+') expected ('+t.Ax+','+t.Ay+')');
        console.log('[perigal-v1.8]   C=('+C.x+','+C.y+') expected ('+t.Cx+','+t.Cy+')');
        console.log('[perigal-v1.8]   changed='+changed);
        if(!changed && self._pollCount>=3){
          /* stabil 3x berturut-turut → hentikan polling */
          console.log('[perigal-v1.8]   stabil, polling dihentikan');
          clearInterval(self._pollInterval);
          self._pollInterval=null;
        }
        if(self._pollCount>=30){
          console.warn('[perigal-v1.8] polling timeout, dihentikan');
          clearInterval(self._pollInterval);
          self._pollInterval=null;
        }
      }catch(e){
        console.error('[perigal-v1.8] polling error:',e);
        clearInterval(self._pollInterval);
        self._pollInterval=null;
      }
    }, 500);
  },

  /* ---------- SELF-HEALING CONFIG ---------- */
  _readPt:function(label){
    return { x:this.applet.getXcoord(label), y:this.applet.getYcoord(label) };
  },
  _expectedM:function(h){
    var C=this._readPt('C'), L=this._readPt('L');
    if(h==='atas'){ return C; }
    if(h==='bawah'){ return L; }
    return {x:(C.x+L.x)/2, y:(C.y+L.y)/2};
  },
  _expectedO:function(v){
    var B=this._readPt('B'), N=this._readPt('N');
    if(v==='kiri'){ return N; }
    if(v==='kanan'){ return B; }
    return {x:(B.x+N.x)/2, y:(B.y+N.y)/2};
  },
  _ensureConfig:function(tag){
    console.log('[perigal-v1.8] >>> _ensureConfig ENTER tag='+tag+', locked='+this.config.locked+', ready='+this.isReady);
    if(!this.config.locked || !this.isReady){
      console.log('[perigal-v1.8] >>> _ensureConfig SKIP: locked='+this.config.locked+' ready='+this.isReady);
      return false;
    }
    var tn=this.config.defaultTriple;
    var t=this.triples[tn];
    if(!t){
      console.warn('[perigal-v1.8] >>> _ensureConfig triple tidak ditemukan: '+tn);
      return false;
    }
    var eps=1e-6, changed=false;
    try{
      /* --- verifikasi triple (titik A & C) --- */
      var A=this._readPt('A'), C=this._readPt('C');
      console.log('[perigal-v1.8]   baca A=('+A.x+','+A.y+') C=('+C.x+','+C.y+') expected A=('+t.Ax+','+t.Ay+') C=('+t.Cx+','+t.Cy+')');
      if(Math.abs(A.x-t.Ax)>eps || Math.abs(A.y-t.Ay)>eps ||
         Math.abs(C.x-t.Cx)>eps || Math.abs(C.y-t.Cy)>eps){
        console.log('[perigal-v1.8]   APPLY SetCoords A,C');
        this.applet.evalCommand("SetCoords(A,"+t.Ax+","+t.Ay+")");
        this.applet.evalCommand("SetCoords(C,"+t.Cx+","+t.Cy+")");
        this.currentTriple=tn;
        changed=true;
      } else {
        console.log('[perigal-v1.8]   A,C sudah sesuai');
      }
      /* --- verifikasi posisi perpotongan (titik M & O) --- */
      var p=this.config.defaultPosisi||this.currentPosisi;
      try{
        var M=this._readPt('M'), eM=this._expectedM(p.horizontal);
        if(Math.abs(M.x-eM.x)>eps || Math.abs(M.y-eM.y)>eps){
          console.log('[perigal-v1.8]   APPLY horizontal='+p.horizontal);
          if(p.horizontal==='atas'){ this.applet.evalCommand("SetValue(M,C)"); }
          else if(p.horizontal==='tengah'){ this.applet.evalCommand("SetValue(M,Midpoint(C,L))"); }
          else { this.applet.evalCommand("SetValue(M,L)"); }
          changed=true;
        }
        var O=this._readPt('O'), eO=this._expectedO(p.vertikal);
        if(Math.abs(O.x-eO.x)>eps || Math.abs(O.y-eO.y)>eps){
          console.log('[perigal-v1.8]   APPLY vertikal='+p.vertikal);
          if(p.vertikal==='kiri'){ this.applet.evalCommand("SetValue(O,N)"); }
          else if(p.vertikal==='tengah'){ this.applet.evalCommand("SetValue(O,Midpoint(B,N))"); }
          else { this.applet.evalCommand("SetValue(O,B)"); }
          changed=true;
        }
      }catch(e){
        console.warn('[perigal-v1.8]   M/O check error:', e.message);
      }
      if(changed){
        this.applet.updateConstruction();
        this.currentCoord=this._bbox(this.currentTriple);
        this._applyCoord();
        console.log('[perigal-v1.8]   konstruksi di-update');
      }
    }catch(e){
      console.warn('[perigal-v1.8] >>> _ensureConfig ERROR:', e);
      return false;
    }
    console.log('[perigal-v1.8] <<< _ensureConfig EXIT changed='+changed);
    return changed;
  },

  /* ---------- ANIMASI ---------- */
  play:function(){
    if(!this.isReady){ return; }
    if(this.currentStep>=5){ this.reset(); return; }
    if(this.config.locked && this.currentStep===0){ this._ensureConfig('play-step1'); }
    this.currentStep++;
    this.isPlaying=true; this.isPaused=false;
    if(this.currentStep===1){ this._langkah1(); }
    else if(this.currentStep===2){ this._langkah2(); }
    else if(this.currentStep===3){ this._langkah3(); }
    else if(this.currentStep===4){ this._langkah4(); }
    else if(this.currentStep===5){ this._langkah5(); }
    if(this.config.onStepChange){ this.config.onStepChange(this.currentStep); }
  },

  pause:function(){
    if(!this.isPlaying){ return; }
    if(!this.isPaused){
      this.isPaused=true;
      this.applet.stopAnimation();
    } else {
      this.isPaused=false;
      if(this.currentStep===4 && this.currentSliderIndex<this.sliders.length){
        this.applet.setAnimating(this.sliders[this.currentSliderIndex],true);
        this.applet.startAnimation();
        this._monitorAnim();
      }
    }
  },

  reset:function(){
    console.log('[perigal-v1.8] reset() dipanggil');
    if(!this.isReady){
      console.log('[perigal-v1.8] reset() ABORT: isReady=false');
      return;
    }
    this.timeouts.forEach(function(t){ clearTimeout(t); });
    this.timeouts=[];
    if(this.animationMonitor){ clearInterval(this.animationMonitor); }
    this.currentStep=0; this.currentSliderIndex=0;
    this.isPlaying=false; this.isPaused=false;
    this.applet.stopAnimation();
    var self=this;
    this.sliders.forEach(function(o){ self.applet.setAnimating(o,false); });
    this.applet.evalCommand("SetValue(t_1,A_1)");
    this.applet.evalCommand("SetValue(a_1,W)");
    this.applet.evalCommand("SetValue(w_1,V)");
    this.applet.evalCommand("SetValue(v_1,U)");
    this.applet.evalCommand("SetValue(d_1,T)");
    var semua=[].concat(this.kategoriObjek.poligon,this.kategoriObjek.bayangan,
      this.kategoriObjek.garisPotong,this.kategoriObjek.potongan);
    semua.forEach(function(o){ self.applet.setVisible(o,false); });

    if(this.config.locked){
      console.log('[perigal-v1.8] reset: mode locked, memuat ulang triple+posisi');
      if(this.config.defaultTriple){ this._setTripleCoords(this.config.defaultTriple); }
      if(this.config.defaultPosisi){
        this.currentPosisi={
          horizontal:this.config.defaultPosisi.horizontal,
          vertikal:this.config.defaultPosisi.vertikal
        };
      }
    }
    this._applyPosisi();
    this.currentCoord=this._bbox(this.currentTriple);
    this._applyCoord();
    this.applet.updateConstruction();
    this._ensureConfig('reset');
    console.log('[perigal-v1.8] reset() selesai');
    if(this.config.onStepChange){ this.config.onStepChange(0); }
  },

  jumpToEnd:function(){
    if(!this.isReady){ return; }
    this.timeouts.forEach(function(t){ clearTimeout(t); });
    this.timeouts=[];
    if(this.animationMonitor){ clearInterval(this.animationMonitor); }
    this.isPlaying=false; this.isPaused=false;
    this.currentStep=5; this.currentSliderIndex=this.sliders.length;
    var self=this;
    var semua=[].concat(this.kategoriObjek.poligon,this.kategoriObjek.bayangan,
      this.kategoriObjek.garisPotong,this.kategoriObjek.potongan);
    semua.forEach(function(o){ self.applet.setVisible(o,true); });
    this.sliders.forEach(function(s){
      var v=self.nilaiAkhirSlider[s];
      if(v){ self.applet.evalCommand("SetValue("+s+","+v+")"); }
    });
    this._applyPosisi();
    this.applet.updateConstruction();
    if(this.config.onStepChange){ this.config.onStepChange(5); }
    if(this.config.onStepComplete){ this.config.onStepComplete(5); }
  },

  jumpToStep:function(step){
    if(!this.isReady){ return Promise.resolve(); }
    var self=this;
    return new Promise(function(resolve){
      if(step===0){ self.reset(); setTimeout(resolve,400); return; }
      self.jumpToEnd();
      var toHide=[];
      if(step===1){ toHide=self.kategoriObjek.garisPotong.concat(self.kategoriObjek.potongan); }
      else if(step===2){ toHide=self.kategoriObjek.potongan; }
      toHide.forEach(function(o){ self.applet.setVisible(o,false); });
      if(step<4){
        var nilaiAwal={"d_1":"T","a_1":"W","w_1":"V","v_1":"U","t_1":"A_1"};
        self.sliders.forEach(function(s){
          if(nilaiAwal[s]){ self.applet.evalCommand("SetValue("+s+","+nilaiAwal[s]+")"); }
        });
      }
      self.currentStep=step;
      self.applet.updateConstruction();
      setTimeout(resolve,600);
    });
  },

  /* ---------- TAMPILAN ---------- */
  zoomIn:function(){ this._zoom(0.4); },
  zoomOut:function(){ this._zoom(0.6); },
  resetZoom:function(){ this.currentCoord=this._bbox(this.currentTriple); this._applyCoord(); },
  resetView:function(){ this.resetZoom(); },
  pan:function(dir){
    if(!this.isReady){ return; }
    var o=2;
    if(dir==='up'){ this.currentCoord.ymin-=o; this.currentCoord.ymax-=o; }
    else if(dir==='down'){ this.currentCoord.ymin+=o; this.currentCoord.ymax+=o; }
    else if(dir==='left'){ this.currentCoord.xmin+=o; this.currentCoord.xmax+=o; }
    else if(dir==='right'){ this.currentCoord.xmin-=o; this.currentCoord.xmax-=o; }
    this._applyCoord();
  },
  _zoom:function(f){
    var rx=this.currentCoord.xmax-this.currentCoord.xmin;
    var ry=this.currentCoord.ymax-this.currentCoord.ymin;
    var cx=(this.currentCoord.xmin+this.currentCoord.xmax)/2;
    var cy=(this.currentCoord.ymin+this.currentCoord.ymax)/2;
    this.currentCoord.xmin=cx-rx*f; this.currentCoord.xmax=cx+rx*f;
    this.currentCoord.ymin=cy-ry*f; this.currentCoord.ymax=cy+ry*f;
    this._applyCoord();
  },

  /* ---------- KONFIGURASI ---------- */
  _setTripleCoords:function(tn){
    var t=this.triples[tn];
    if(!t){ return; }
    this.currentTriple=tn;
    this.applet.evalCommand("SetCoords(A,"+t.Ax+","+t.Ay+")");
    this.applet.evalCommand("SetCoords(C,"+t.Cx+","+t.Cy+")");
    this.currentCoord=this._bbox(tn);
    this._applyCoord();
  },
  setTriple:function(tn){
    if(!this.isReady||!this.triples[tn]){ return; }
    this._setTripleCoords(tn);
    this.reset();
  },
  _setPosisiCmd:function(h,v){
    if(!this.isReady){ return; }
    if(h==='atas'){ this.applet.evalCommand("SetValue(M,C)"); }
    else if(h==='tengah'){ this.applet.evalCommand("SetValue(M,Midpoint(C,L))"); }
    else if(h==='bawah'){ this.applet.evalCommand("SetValue(M,L)"); }
    if(v==='kiri'){ this.applet.evalCommand("SetValue(O,N)"); }
    else if(v==='tengah'){ this.applet.evalCommand("SetValue(O,Midpoint(B,N))"); }
    else if(v==='kanan'){ this.applet.evalCommand("SetValue(O,B)"); }
    this.applet.updateConstruction();
  },
  setPosisiPerpotongan:function(h,v){
    this.currentPosisi={horizontal:h,vertikal:v};
    this._setPosisiCmd(h,v);
  },
  _applyPosisi:function(){
    var p=this.currentPosisi||{horizontal:'tengah',vertikal:'tengah'};
    this._setPosisiCmd(p.horizontal,p.vertikal);
  },
  setSpeed:function(s){ this.currentSpeed=Math.max(1,Math.min(4,s)); },

  /* ---------- SCREENSHOT ---------- */
  takeScreenshot:function(){
    if(!this.isReady){ return null; }
    var base=null;
    for(var i=0;i<3;i++){
      try{
        base=this.applet.getPNGBase64();
        if(base && base.length>1000){ return 'data:image/png;base64,'+base; }
      }catch(e){}
    }
    try{
      var cv=document.querySelector('#'+this.containerId+' canvas');
      if(cv){ return cv.toDataURL('image/png'); }
    }catch(e){}
    return null;
  },
  takeScreenshotAsync:function(){
    var self=this;
    return new Promise(function(resolve){
      setTimeout(function(){
        var img=self.takeScreenshot();
        if(img){ resolve(img); return; }
        var retries=2;
        var tryAgain=function(){
          setTimeout(function(){
            img=self.takeScreenshot();
            if(img || retries<=0){ resolve(img); return; }
            retries--;
            tryAgain();
          },400);
        };
        tryAgain();
      },500);
    });
  },

  /* ---------- STATE ---------- */
  getCurrentStep:function(){ return this.currentStep; },
  isAnimationRunning:function(){ return this.isPlaying && !this.isPaused; },
  isPausedState:function(){ return this.isPaused; },
  waitForReady:function(){
    var self=this;
    return new Promise(function(resolve){
      if(self.isReady){ resolve(); return; }
      var c=setInterval(function(){
        if(self.isReady){ clearInterval(c); resolve(); }
      },100);
    });
  },

  /* ---------- PRIVATE ---------- */
  _bbox:function(tn,tol){
    tol=(tol===undefined)?(this.config.bboxTolerance||2):tol;
    var t=this.triples[tn];
    if(!t){ return this.currentCoord; }
    var a=Math.abs(t.Ax), b=Math.abs(t.Cy);
    return {xmin:-b-tol, xmax:a+b+tol, ymin:-a-tol, ymax:a+b+tol};
  },
  _applyCoord:function(){
    if(!this.isReady){ return; }
    this.applet.setCoordSystem(this.currentCoord.xmin,this.currentCoord.xmax,
      this.currentCoord.ymin,this.currentCoord.ymax);
  },
  _delay:function(ms){ return Math.round(ms*(4/this.currentSpeed)); },

  _langkah1:function(){
    var self=this;
    this.kategoriObjek.poligon.forEach(function(o){ self.applet.setVisible(o,true); });
    this.isPlaying=false;
    if(this.config.onStepComplete){ this.config.onStepComplete(1); }
  },
  _langkah2:function(){
    var self=this;
    this.kategoriObjek.garisPotong.forEach(function(o){ self.applet.setVisible(o,true); });
    this.isPlaying=false;
    if(this.config.onStepComplete){ this.config.onStepComplete(2); }
  },
  _langkah3:function(){
    this.applet.setVisible("poli1'",true);
    this._showPotongan(0);
  },
  _showPotongan:function(idx){
    if(idx<this.kategoriObjek.potongan.length){
      var self=this;
      var t=setTimeout(function(){
        if(self.isPaused){ return; }
        self.applet.setVisible(self.kategoriObjek.potongan[idx],true);
        self._showPotongan(idx+1);
      }, this._delay(500));
      this.timeouts.push(t);
    } else {
      this.isPlaying=false;
      if(this.config.onStepComplete){ this.config.onStepComplete(3); }
    }
  },
  _langkah4:function(){ this.currentSliderIndex=0; this._nextSlider(); },
  _nextSlider:function(){
    if(this.currentSliderIndex<this.sliders.length){
      var s=this.sliders[this.currentSliderIndex];
      if(!this.isPaused){
        this.applet.setAnimating(s,true);
        this.applet.startAnimation();
      }
      this._monitorAnim();
    } else {
      this.currentStep=5;
      if(this.config.onStepComplete){ this.config.onStepComplete(4); }
      this._langkah5();
    }
  },
  _monitorAnim:function(){
    var self=this;
    var t=setTimeout(function(){
      self.animationMonitor=setInterval(function(){
        if(self.isPaused){ return; }
        if(!self.applet.isAnimationRunning()){
          clearInterval(self.animationMonitor);
          self.currentSliderIndex++;
          var tn=setTimeout(function(){ self._nextSlider(); },self._delay(200));
          self.timeouts.push(tn);
        }
      },200);
    }, this._delay(300));
    this.timeouts.push(t);
  },
  _langkah5:function(){
    this.isPlaying=false;
    if(this.config.onStepComplete){ this.config.onStepComplete(5); }
    if(this.config.onAnimationComplete){ this.config.onAnimationComplete(); }
  }
};

window.PerigalEngine=PerigalEngine;
console.log('[perigal-v1.8] script selesai dimuat, PerigalEngine terdaftar');
})();