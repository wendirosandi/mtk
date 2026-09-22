/* perigal-classic.js v1 — Perigal PUSAT, translasi murni, pasangan tanda
   (terverifikasi benar untuk pusat). Verifikasi luas eksak internal. */
function perigalClassic(a, b, viewW, viewH, pad) {
    pad = pad || 20;
    const c = Math.hypot(a, b);
    const h = { x: a / c, y: -b / c }, n = { x: b / c, y: a / c };
    const minX = -b, maxX = a + b, minY = -a, maxY = a + b;
    const u = Math.min((viewW - 2*pad)/(maxX-minX), (viewH - 2*pad)/(maxY-minY));
    const ox = pad + ((viewW-2*pad)-(maxX-minX)*u)/2 - minX*u;
    const oy = pad + ((viewH-2*pad)-(maxY-minY)*u)/2 + maxY*u;
    const S = (x,y) => ({ x: ox + x*u, y: oy - y*u });
    const B={x:0,y:0}, A={x:a,y:0}, C={x:0,y:b};
    const sqA=[{x:0,y:0},{x:a,y:0},{x:a,y:-a},{x:0,y:-a}];
    const sqB=[{x:-b,y:0},{x:0,y:0},{x:0,y:b},{x:-b,y:b}];
    const sqC=[C,A,{x:A.x+n.x*c,y:A.y+n.y*c},{x:C.x+n.x*c,y:C.y+n.y*c}];
    const W={x:(C.x+sqC[2].x)/2,y:(C.y+sqC[2].y)/2};
    const G={x:-b/2,y:b/2};
    function clip(poly,P,m,s){const out=[],v=q=>m.x*(q.x-P.x)+m.y*(q.y-P.y);
        for(let i=0;i<poly.length;i++){const cur=poly[i],nxt=poly[(i+1)%poly.length];
        const vc=v(cur),vn=v(nxt);const fc=vc===0||Math.sign(vc)===s,fn=vn===0||Math.sign(vn)===s;
        if(fc)out.push(cur);if(fc!==fn){const t=vc/(vc-vn);out.push({x:cur.x+(nxt.x-cur.x)*t,y:cur.y+(nxt.y-cur.y)*t});}}
        return out;}
    function pip(poly,p,eps){eps=eps||0;
        for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;
        const len=Math.hypot(xj-xi,yj-yi)||1;const cr=(xj-xi)*(p.y-yi)-(yj-yi)*(p.x-xi);
        if(Math.abs(cr)/len<=eps&&p.x>=Math.min(xi,xj)-eps&&p.x<=Math.max(xi,xj)+eps&&p.y>=Math.min(yi,yj)-eps&&p.y<=Math.max(yi,yj)+eps)return true;}
        let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;
        if((yi>p.y)!==(yj>p.y)&&p.x<(xj-xi)*(p.y-yi)/(yj-yi)+xi)ins=!ins;}return ins;}
    function area(poly){let s=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)s+=poly[j].x*poly[i].y-poly[i].x*poly[j].y;return s/2;}
    function centroid(poly){let x=0,y=0;poly.forEach(p=>{x+=p.x;y+=p.y;});return{x:x/poly.length,y:y/poly.length};}
    function clipHalf(poly,P,m,s){const out=[],f=q=>(m.x*(q.x-P.x)+m.y*(q.y-P.y))*s;
        for(let i=0,j=poly.length-1;i<poly.length;j=i++){const cur=poly[i],prev=poly[j];const fc=f(cur),fp=f(prev);
        if(fc>=0)out.push(cur);if((fc>0)!==(fp>0)){const t=fp/(fp-fc);out.push({x:prev.x+(cur.x-prev.x)*t,y:prev.y+(cur.y-prev.y)*t});}}
        return out;}
    function interArea(Ap,Bp){let out=Ap.slice();const cb=centroid(Bp);
        for(let i=0,j=Bp.length-1;i<Bp.length&&out.length;j=i++){const P=Bp[j],Q=Bp[i];
        const m={x:-(Q.y-P.y),y:Q.x-P.x};const s=(m.x*(cb.x-P.x)+m.y*(cb.y-P.y))>0?1:-1;out=clipHalf(out,P,m,s);}
        return out.length?Math.abs(area(out)):0;}
    const inner=[{x:W.x-a/2,y:W.y-a/2},{x:W.x+a/2,y:W.y-a/2},{x:W.x+a/2,y:W.y+a/2},{x:W.x-a/2,y:W.y+a/2}];
    const signs=[[1,1],[-1,1],[-1,-1],[1,-1]];
    const pieces=[];
    for(const[sH,sN]of signs){let poly=clip(sqB.slice(),G,n,sN);poly=clip(poly,G,h,sH);
        if(poly.length<3||Math.abs(area(poly))<1e-9)return{valid:false};
        const K=sqB.find(P2=>pip(poly,P2,1e-6*b));if(!K)return{valid:false};
        const sx=Math.sign(K.x-G.x)||1, sy=Math.sign(K.y-G.y)||1;
        pieces.push({poly,t:{x:W.x+(a/2)*sx-K.x,y:W.y+(a/2)*sy-K.y}});}
    const ring=c*c-a*a, tol=1e-6*ring;
    const moved=pieces.map(pc=>pc.poly.map(p=>({x:p.x+pc.t.x,y:p.y+pc.t.y})));
    let ok=moved.every(m=>m.every(p=>pip(sqC,p,1e-7*c)));
    if(ok)ok=moved.every(m=>interArea(m,inner)<=tol);
    if(ok)for(let i=0;i<4&&ok;i++)for(let j=i+1;j<4&&ok;j++)if(interArea(moved[i],moved[j])>tol)ok=false;
    if(ok){let s=0;moved.forEach(m=>s+=Math.abs(area(m)));ok=Math.abs(s-ring)<=tol*8;}
    console.log(ok?('✅ PERIGAL KLASIK OK ('+a+','+b+')'):'⚠️ PERIGAL KLASIK GAGAL ('+a+','+b+')');
    const tA={x:W.x-a/2,y:W.y+a/2};
    const map=poly=>poly.map(P=>S(P.x,P.y));
    return{a,b,c,u,S,valid:ok,
        tri:map([B,A,C]),sqA:map(sqA),sqB:map(sqB),sqC:map(sqC),inner:map(inner),
        pieces:pieces.map(pc=>({poly:map(pc.poly),t:{x:pc.t.x*u,y:-pc.t.y*u}})),
        tA:{x:tA.x*u,y:-tA.y*u},
        cut1:[S(G.x-h.x*b*2,G.y-h.y*b*2),S(G.x+h.x*b*2,G.y+h.y*b*2)],
        cut2:[S(G.x-n.x*b*2,G.y-n.y*b*2),S(G.x+n.x*b*2,G.y+n.y*b*2)],
        labels:{a:S(a/2,0.6),b:S(-0.9,b/2),c:S(a/2+n.x*0.8,b/2+n.y*0.8),
                b2:S(-b/2,b/2),a2:S(a/2,-a/2),c2:S(W.x+n.x*1.2,W.y+n.y*1.2)}};
}
window.perigalClassic=perigalClassic;
