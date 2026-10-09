window.TEMPLATES=(function(){
  const SC=LKPD_SCORING,r6=SC.r6;
  const PICK=a=>a[Math.floor(Math.random()*a.length)];

    const DEF = {
    m013: { B: [2, 3], s: [2, 3, 4], c: [2, 3, 4, 6], t: [2, 3], pct: [80, 85, 90, 95] },
    m012: { kantong: [40, 45, 50] }
  };
  const W = m => (window.DATA_POOL && DATA_POOL[m] && DATA_POOL[m].vars_wajar) || DEF[m] || {};
  const pk = (w, k, d) => (w[k] && w[k].length ? w[k] : d);

  /* ===== KONTEKSTUAL KOLAM (m013) ===== */
  function genKolam(){
    const w = W('m013');
    const B = PICK(pk(w, 'B', [2, 3])), s1 = PICK(pk(w, 's', [2, 3, 4])), s2 = PICK(pk(w, 's', [2, 3, 4]));
    const c1 = PICK(pk(w, 'c', [2, 3, 4, 6])), c2 = PICK(pk(w, 'c', [2, 3, 4, 6]));
    const t = PICK(pk(w, 't', [2, 3])), pct = PICK(pk(w, 'pct', [80, 85, 90, 95]));
    const L=c1*s1,W=c2*s2;              // koefisien setelah disederhanakan
    const prod=L*W*B;                   // (L√B)(W√B)=L·W·B
    const V=prod*t;
    const Vair=r6(V*pct/100);
    const liter=r6(Vair*1000);
    const kel=2*(L+W);
    const kelApprox=r6(kel*Math.sqrt(B));
    return{B,c1,s1,c2,s2,t,pct,L,W,prod,V,Vair,liter,kel,kelApprox,
      texP:c1+'\\sqrt{'+B*s1*s1+'}',texW:c2+'\\sqrt{'+B*s2*s2+'}'};
  }

  /* ===== KONTEKSTUAL SEL DARAH (m012) ===== */
  function genDarah(){
    const kantong=PICK([40,45,50]);
    const perKantong=15300000;
    const perHari=kantong*perKantong;
    const ml=10*0.5*1000;               // 10 donor
    const putih=ml*25000;
    const merah=2*5*0.5*1000*(25000*32000);
    return{kantong,perKantong,perHari,putih,merah,
      mantMikro:7.41,expMikro:-5,
      mantHari:r6(perHari/1e8),expHari:8};
  }

  /* ===== VARIABEL WAJAR (referensi Sheet) ===== */
  const WAJAR={
    m013_kolam:{B:[2,3],s:[2,3,4],c:[2,3,4,6],t:[2,3],pct:[80,85,90,95]},
    m012_darah:{kantong:[40,45,50],donor:[10],volOrang:[0.5],putihPerMl:[25000],faktorMerah:[32000]}
  };
  return{genKolam,genDarah,WAJAR};
})();