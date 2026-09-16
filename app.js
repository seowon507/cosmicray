(() => {
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const drcCanvas = document.getElementById('drcCanvas');
  const dctx = drcCanvas.getContext('2d');
  const signalCanvas = document.getElementById('signalCanvas');
  const sctx = signalCanvas.getContext('2d');
  const landing = document.getElementById('landing');
  const experience = document.getElementById('experience');
  const energyLabel = document.getElementById('energyLabel');
  const statusLabel = document.getElementById('statusLabel');
  const progress = document.getElementById('progress');
  const hint = document.getElementById('hint');
  const panel = document.getElementById('detailPanel');
  const particlePanel = document.getElementById('particlePanel');
  const performancePanel = document.getElementById('performancePanel');
  const particleTitle = document.getElementById('particleTitle');
  const performanceTitle = document.getElementById('performanceTitle');
  const replayDRC = document.getElementById('replayDRC');
  const continueML = document.getElementById('continueML');
  const drcStatus = document.getElementById('drcStatus');
  const mlSection = document.getElementById('mlSection');
  const mlLock = document.getElementById('mlLock');
  const cCount = document.getElementById('cCount');
  const sCount = document.getElementById('sCount');

  let selectedEnergy = '1PeV';
  let mode = 'particle';
  let startTime = 0;
  let raf = null;
  let drcRaf = null;
  let clickableFootprint = false;
  let footprintCenter = {x:0,y:0,r:0};
  let drcFinished = false;

  const SONGDO_POLY = [
    [-0.92,-0.16],[-0.83,-0.57],[-0.42,-0.78],[-0.05,-0.91],[0.35,-0.76],
    [0.78,-0.46],[0.94,-0.05],[0.81,0.33],[0.54,0.48],[0.24,0.47],
    [0.01,0.28],[-0.31,0.47],[-0.70,0.45],[-0.90,0.18]
  ];

  const DISTRICT_CENTERS = [
    {x:-.48,y:-.47,label:'1'}, {x:.08,y:-.54,label:'3'}, {x:.58,y:.06,label:'4'},
    {x:-.28,y:.12,label:'6–8'}, {x:-.71,y:.20,label:'11'}
  ];

  const ENERGY = {
    '1PeV':   {label:'1 PeV', shower:54, spread:.24, footprint:.16, color:'#72e7ff', mode:'particle'},
    '10PeV':  {label:'10 PeV', shower:84, spread:.34, footprint:.23, color:'#73a7ff', mode:'particle'},
    '100PeV': {label:'100 PeV',shower:118,spread:.44, footprint:.31, color:'#a989ff', mode:'performance'},
    '10EeV':  {label:'10 EeV', shower:170,spread:.57, footprint:.40, color:'#ffb86a', mode:'performance'}
  };

  const PID_DEMO = {
    '1PeV': {composition:{EM:0.18,MU:0.69,HAD:0.13},cFinal:486,sFinal:840},
    '10PeV': {composition:{EM:0.24,MU:0.12,HAD:0.64},cFinal:1118,sFinal:2724}
  };

  function resize(){
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(r.width*dpr));
    canvas.height = Math.max(1, Math.floor(r.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize);

  function project(x,y,z){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const groundY = h*.78;
    const perspective = 1 - y*.22;
    return {x:w*.5 + x*w*.39*perspective,y:groundY - z*h*.56 + y*h*.18,s:perspective};
  }

  function pointInPoly(x,y){
    let inside=false;
    for(let i=0,j=SONGDO_POLY.length-1;i<SONGDO_POLY.length;j=i++){
      const xi=SONGDO_POLY[i][0], yi=SONGDO_POLY[i][1], xj=SONGDO_POLY[j][0], yj=SONGDO_POLY[j][1];
      const hit=((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+1e-9)+xi);
      if(hit) inside=!inside;
    }
    return inside;
  }

  function drawBackground(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'#06101f'); g.addColorStop(.55,'#0a1830'); g.addColorStop(1,'#06101d');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(255,255,255,.55)';
    for(let i=0;i<70;i++){
      const x=(i*97)%w, y=((i*61)%Math.max(120,h*.48)); const r=(i%4===0)?1.2:.6;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
  }

  function drawGround(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    ctx.fillStyle='rgba(3,24,36,.86)';ctx.beginPath();ctx.moveTo(0,h*.59);ctx.lineTo(w,h*.59);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
    const poly=SONGDO_POLY.map(([x,y])=>project(x,y,0));
    ctx.beginPath(); poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
    const grd=ctx.createLinearGradient(0,h*.55,0,h*.95); grd.addColorStop(0,'#173a31');grd.addColorStop(1,'#10251f');
    ctx.fillStyle=grd;ctx.fill(); ctx.strokeStyle='rgba(118,231,255,.45)';ctx.lineWidth=2;ctx.stroke();
    ctx.save();ctx.clip();
    DISTRICT_CENTERS.forEach((d,idx)=>{
      const p=project(d.x,d.y,0); const rg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,idx===2?125:100);
      rg.addColorStop(0,'rgba(64,200,96,.34)'); rg.addColorStop(1,'rgba(64,200,96,0)');ctx.fillStyle=rg;ctx.fillRect(0,0,w,h);
    });
    ctx.restore();
    ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
    DISTRICT_CENTERS.forEach(d=>{const p=project(d.x,d.y,0);ctx.fillStyle='rgba(227,255,235,.7)';ctx.fillText(d.label+' District',p.x,p.y-14)});
    for(let yy=-.78;yy<=.42;yy+=.09){
      for(let xx=-.84;xx<=.84;xx+=.09){
        if(!pointInPoly(xx,yy)) continue;
        let zone=false;
        for(const d of DISTRICT_CENTERS){ if(Math.hypot(xx-d.x,yy-d.y) < (d.label==='4'?.40:.35)){zone=true;break;} }
        if(!zone) continue;
        const p=project(xx,yy,0.006);
        ctx.fillStyle='rgba(136,245,186,.72)';ctx.beginPath();ctx.arc(p.x,p.y,1.35,0,Math.PI*2);ctx.fill();
      }
    }
  }

  function drawPrimary(t,cfg){
    const fall=Math.min(1,Math.max(0,t/.34));
    const ease=fall<1?1-Math.pow(1-fall,3):1;
    const p=project(-.06,0,1.22-ease*1.0), p2=project(-.06,0,1.38-ease*1.0);
    ctx.strokeStyle=cfg.color;ctx.lineWidth=3;ctx.shadowColor=cfg.color;ctx.shadowBlur=18;
    ctx.beginPath();ctx.moveTo(p2.x,p2.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,3.2,0,Math.PI*2);ctx.fill();
  }

  function drawShower(t,cfg){
    const phase=Math.max(0,Math.min(1,(t-.16)/.52)); if(phase<=0)return;
    const count=cfg.shower;
    for(let i=0;i<count;i++){
      const q=(i+1)/count, prog=Math.max(0,Math.min(1,(phase-q*.18)*1.28)); if(prog<=0)continue;
      const branch=((i*47)%101)/101-.5, branch2=((i*73)%97)/97-.5;
      const z=1.03-prog*.97, radial=cfg.spread*Math.pow(prog,1.35);
      const p=project(-.06+branch*radial*2.0,branch2*radial*1.35,z);
      const alpha=.25+.7*(1-prog*.55);
      ctx.fillStyle=i%9===0?`rgba(255,210,115,${alpha})`:`rgba(120,220,255,${alpha})`;
      ctx.beginPath();ctx.arc(p.x,p.y,(i%11===0?2.1:1.15),0,Math.PI*2);ctx.fill();
    }
  }

  function drawFootprint(t,cfg){
    const reveal=Math.max(0,Math.min(1,(t-.67)/.22)); if(reveal<=0)return;
    const c=project(-.06,0,0.012), radius=cfg.footprint*canvas.clientWidth*.36*reveal;
    footprintCenter={x:c.x,y:c.y,r:radius};
    const rg=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,radius);
    rg.addColorStop(0,'rgba(255,255,255,.92)');rg.addColorStop(.14,hexToRgba(cfg.color,.86));rg.addColorStop(.48,hexToRgba(cfg.color,.30));rg.addColorStop(1,hexToRgba(cfg.color,0));
    ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(c.x,c.y,radius,radius*.48,0,0,Math.PI*2);ctx.fill();
    for(let yy=-.78;yy<=.42;yy+=.09){
      for(let xx=-.84;xx<=.84;xx+=.09){
        if(!pointInPoly(xx,yy))continue;
        const dist=Math.hypot(xx+.06,yy);
        if(dist<cfg.footprint*.95 && ((Math.floor((xx+1)*100)+Math.floor((yy+1)*100))%3!==0)){
          const p=project(xx,yy,.013);ctx.fillStyle='rgba(255,245,170,.94)';ctx.shadowColor='#fff1a3';ctx.shadowBlur=7;ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        }
      }
    }
  }

  function hexToRgba(hex,a){
    const h=hex.replace('#',''),n=parseInt(h,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  function animate(ts){
    const cfg=ENERGY[selectedEnergy]; if(!startTime)startTime=ts;
    const sec=(ts-startTime)/1000, t=Math.min(1,sec/4.6);
    drawBackground();drawGround();drawPrimary(t,cfg);drawShower(t,cfg);drawFootprint(t,cfg);
    progress.style.width=(t*100)+'%';
    if(t<.18)statusLabel.textContent='Primary entering atmosphere';
    else if(t<.66)statusLabel.textContent='Air shower developing';
    else if(t<.88)statusLabel.textContent='Detector response';
    else statusLabel.textContent=mode==='particle'?'Detector ready for DRC view':'Footprint ready';
    if(t>=.88){clickableFootprint=true;hint.classList.remove('hidden');hint.textContent=mode==='particle'?'빛나는 detector를 클릭하여 내부 신호를 확인하세요':'Footprint를 클릭하여 array 성능을 확인하세요';}
    if(t<1)raf=requestAnimationFrame(animate);
  }

  function startExperience(key){
    selectedEnergy=key;mode=ENERGY[key].mode;energyLabel.textContent=ENERGY[key].label;
    landing.classList.add('hidden');experience.classList.remove('hidden');panel.classList.add('hidden');
    hint.classList.add('hidden');progress.style.width='0';clickableFootprint=false;startTime=0;
    cancelAnimationFrame(raf);cancelAnimationFrame(drcRaf);requestAnimationFrame(()=>{resize();raf=requestAnimationFrame(animate);});
  }

  function resetPidUI(){
    drcFinished=false;continueML.disabled=true;mlSection.classList.add('locked');mlLock.textContent='DRC event를 먼저 재생하세요';
    document.querySelectorAll('.step').forEach((s,i)=>s.classList.toggle('active',i===0));
    document.querySelectorAll('[data-stage]').forEach(el=>el.classList.remove('active'));
    const prog=document.getElementById('unetProgress'); if(prog) prog.style.width='0';
    ['fEM','fMU','fHAD','summaryEM','summaryMU','summaryHAD'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
    const ft=document.getElementById('featTotal');if(ft)ft.textContent='—';
    const ms=document.getElementById('modelStatus');if(ms)ms.textContent='Waiting for detector feature maps';
    const cs=document.getElementById('compositionStatus');if(cs)cs.textContent='Per-pixel composition not calculated';
    cCount.textContent='0';sCount.textContent='0';drawDRC(0);drawSignal(0);
  }
  function openDetail(){
    panel.classList.remove('hidden');
    if(mode==='particle'){
      particlePanel.classList.remove('hidden');performancePanel.classList.add('hidden');particleTitle.textContent=`Detector event — ${ENERGY[selectedEnergy].label}`;
      resetPidUI();requestAnimationFrame(()=>startDRC());
    }else{
      performancePanel.classList.remove('hidden');particlePanel.classList.add('hidden');performanceTitle.textContent=`Array performance — ${ENERGY[selectedEnergy].label}`;
    }
  }

  function isoPoint(x,y,z){
    const w=drcCanvas.width,h=drcCanvas.height;
    return {x:w*.5 + x*190 - y*108, y:h*.76 - z*310 + x*42 + y*42};
  }

  function line(a,b,color,width=1){dctx.strokeStyle=color;dctx.lineWidth=width;dctx.beginPath();dctx.moveTo(a.x,a.y);dctx.lineTo(b.x,b.y);dctx.stroke();}

  function drawDRC(t){
    const w=drcCanvas.width,h=drcCanvas.height;dctx.clearRect(0,0,w,h);
    const bg=dctx.createRadialGradient(w*.5,h*.45,20,w*.5,h*.45,w*.55);bg.addColorStop(0,'#13294b');bg.addColorStop(1,'#07101e');dctx.fillStyle=bg;dctx.fillRect(0,0,w,h);
    const A=isoPoint(-.72,-.52,0),B=isoPoint(.72,-.52,0),C=isoPoint(.72,.52,0),D=isoPoint(-.72,.52,0),A2=isoPoint(-.72,-.52,1),B2=isoPoint(.72,-.52,1),C2=isoPoint(.72,.52,1),D2=isoPoint(-.72,.52,1);
    dctx.fillStyle='rgba(71,116,169,.13)';dctx.beginPath();[A,B,C,D].forEach((p,i)=>i?dctx.lineTo(p.x,p.y):dctx.moveTo(p.x,p.y));dctx.closePath();dctx.fill();
    dctx.fillStyle='rgba(87,134,192,.08)';dctx.beginPath();[A,A2,B2,B].forEach((p,i)=>i?dctx.lineTo(p.x,p.y):dctx.moveTo(p.x,p.y));dctx.closePath();dctx.fill();
    const edge='rgba(123,180,231,.58)';[[A,B],[B,C],[C,D],[D,A],[A,A2],[B,B2],[C,C2],[D,D2],[A2,B2],[B2,C2],[C2,D2],[D2,A2]].forEach(e=>line(e[0],e[1],edge,1.2));
    for(let i=-6;i<=6;i++){
      const x=i/9; line(isoPoint(x,-.49,.04),isoPoint(x,-.49,.96),'rgba(112,194,230,.18)',1);line(isoPoint(x,.49,.04),isoPoint(x,.49,.96),'rgba(112,194,230,.12)',1);
    }
    for(let j=-4;j<=4;j++){
      const y=j/8;line(isoPoint(-.69,y,.04),isoPoint(-.69,y,.96),'rgba(255,183,99,.10)',1);line(isoPoint(.69,y,.04),isoPoint(.69,y,.96),'rgba(255,183,99,.10)',1);
    }
    const entry=Math.min(1,t/.22), pz=1.45-entry*.55, p=isoPoint(0,0,pz), trail=isoPoint(0,0,pz+.35);
    line(trail,p,'#ffffff',3);dctx.fillStyle='#fff';dctx.shadowColor='#75e7ff';dctx.shadowBlur=18;dctx.beginPath();dctx.arc(p.x,p.y,5,0,Math.PI*2);dctx.fill();dctx.shadowBlur=0;
    const shower=Math.max(0,Math.min(1,(t-.16)/.72));
    const n=Math.floor(180*shower);
    for(let i=0;i<n;i++){
      const q=(i+1)/180, depth=Math.min(.92,Math.max(.05,(q*.82 + shower*.18)));
      if(depth>shower+.12)continue;
      const spread=.04 + depth*.42;
      const ang=((i*137.5)%360)*Math.PI/180;
      const rr=spread*Math.sqrt(((i*53)%101)/101);
      const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr*.72, z=.95-depth*.87;
      const pp=isoPoint(x,y,z);
      const cher=(i%3===0);dctx.fillStyle=cher?'rgba(117,231,255,.88)':'rgba(255,183,99,.78)';dctx.shadowColor=cher?'#75e7ff':'#ffb763';dctx.shadowBlur=cher?8:6;dctx.beginPath();dctx.arc(pp.x,pp.y,cher?2.1:2.4,0,Math.PI*2);dctx.fill();
    }
    dctx.shadowBlur=0;dctx.fillStyle='rgba(220,233,251,.68)';dctx.font='700 14px system-ui';dctx.fillText('DRC module',34,42);dctx.font='12px system-ui';dctx.fillStyle='rgba(155,174,204,.72)';dctx.fillText('Cherenkov + Scintillation optical response',34,62);
  }

  function drawSignal(t){
    const w=signalCanvas.width,h=signalCanvas.height;sctx.clearRect(0,0,w,h);
    sctx.strokeStyle='rgba(255,255,255,.08)';sctx.lineWidth=1;
    for(let y=30;y<h;y+=40){sctx.beginPath();sctx.moveTo(26,y);sctx.lineTo(w-12,y);sctx.stroke();}
    const drawWave=(color,base,amp,shift,width)=>{
      sctx.strokeStyle=color;sctx.lineWidth=3;sctx.beginPath();
      for(let x=25;x<w-10;x++){
        const u=(x-25)/(w-35), gate=Math.max(0,Math.min(1,(t-u*.72)*2.4));
        const g1=Math.exp(-Math.pow((u-shift)/width,2));
        const g2=.42*Math.exp(-Math.pow((u-(shift+.18))/(width*1.55),2));
        const y=base-(g1+g2)*amp*gate;
        if(x===25)sctx.moveTo(x,y);else sctx.lineTo(x,y);
      }
      sctx.stroke();
    };
    drawWave('#75e7ff',92,52,.39,.055);drawWave('#ffb763',188,70,.48,.10);
    sctx.fillStyle='rgba(145,162,188,.78)';sctx.font='11px system-ui';sctx.fillText('Cherenkov',28,28);sctx.fillText('Scintillation',28,126);sctx.fillText('time →',w-62,h-10);
  }

  function startDRC(){
    cancelAnimationFrame(drcRaf);drcFinished=false;continueML.disabled=true;mlSection.classList.add('locked');mlLock.textContent='DRC event를 먼저 재생하세요';
    const data=PID_DEMO[selectedEnergy] || PID_DEMO['1PeV'];let t0=0;
    function frame(ts){
      if(!t0)t0=ts;const t=Math.min(1,(ts-t0)/4200);drawDRC(t);drawSignal(t);
      const eased=1-Math.pow(1-t,2);cCount.textContent=Math.round(data.cFinal*eased).toLocaleString();sCount.textContent=Math.round(data.sFinal*eased).toLocaleString();
      if(t<.20)drcStatus.textContent='Particle entering detector';
      else if(t<.50)drcStatus.textContent='Shower developing inside DRC';
      else if(t<.86)drcStatus.textContent='Cherenkov / Scintillation photons increasing';
      else drcStatus.textContent='Optical readout complete';
      if(t<1)drcRaf=requestAnimationFrame(frame);else{drcFinished=true;continueML.disabled=false;mlSection.classList.remove('locked');mlLock.textContent='Detector feature maps ready';document.querySelectorAll('.step').forEach((s,i)=>s.classList.toggle('active',i<=1));}
    }
    drcRaf=requestAnimationFrame(frame);
  }

  function runML(){
    if(!drcFinished)return;
    const data=PID_DEMO[selectedEnergy] || PID_DEMO['1PeV'];
    mlSection.scrollIntoView({behavior:'smooth',block:'start'});
    mlLock.textContent='U-Net inference in progress';
    document.querySelectorAll('.step').forEach((s,i)=>s.classList.toggle('active',i<=2));
    const stages=[...document.querySelectorAll('[data-stage]')].sort((a,b)=>Number(a.dataset.stage)-Number(b.dataset.stage));
    stages.forEach(el=>el.classList.remove('active'));
    const prog=document.getElementById('unetProgress');
    const modelStatus=document.getElementById('modelStatus');
    const compositionStatus=document.getElementById('compositionStatus');
    const total=data.cFinal+data.sFinal;
    document.getElementById('featTotal').textContent=total.toLocaleString();
    let idx=0;
    const timer=setInterval(()=>{
      if(idx>0) stages[idx-1]?.classList.remove('active');
      if(idx<stages.length){
        stages[idx].classList.add('active');
        prog.style.width=((idx+1)/stages.length*100)+'%';
        if(idx===0) modelStatus.textContent='Reading mixed detector photon map…';
        else if(idx===1) modelStatus.textContent='Encoder: finding important light patterns…';
        else if(idx===2) modelStatus.textContent='Bottleneck: keeping the key information…';
        else if(idx===3) modelStatus.textContent='Decoder: restoring where the patterns came from…';
        else if(idx===4) modelStatus.textContent='Separating light into EM / MU / HAD maps…';
        else if(idx===5) modelStatus.textContent='Calculating composition fractions…';
        else modelStatus.textContent='Using the separated pattern for Particle ID…';
        idx++;
      }else{
        clearInterval(timer);
        const c=data.composition;
        const pct=k=>(c[k]*100).toFixed(0)+'%';
        document.getElementById('fEM').textContent=pct('EM');
        document.getElementById('fMU').textContent=pct('MU');
        document.getElementById('fHAD').textContent=pct('HAD');
        document.getElementById('summaryEM').textContent=pct('EM');
        document.getElementById('summaryMU').textContent=pct('MU');
        document.getElementById('summaryHAD').textContent=pct('HAD');
        const barEM=document.getElementById('barEM'),barMU=document.getElementById('barMU'),barHAD=document.getElementById('barHAD');
        if(barEM)barEM.style.width=pct('EM');
        if(barMU)barMU.style.width=pct('MU');
        if(barHAD)barHAD.style.width=pct('HAD');
        modelStatus.textContent='U-Net inference complete';
        compositionStatus.textContent='fEM + fMU + fHAD = 1 · decomposed maps ready';
        mlLock.textContent='Photon composition decomposed';
        document.querySelectorAll('.step').forEach(s=>s.classList.add('active'));
        setTimeout(()=>stages.forEach(el=>el.classList.remove('active')),650);
      }
    },180);
  }

  canvas.addEventListener('click',e=>{
    if(!clickableFootprint)return;
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    const dx=(x-footprintCenter.x)/Math.max(footprintCenter.r,1),dy=(y-footprintCenter.y)/Math.max(footprintCenter.r*.55,1);
    if(dx*dx+dy*dy<=1.4)openDetail();
  });
  document.querySelectorAll('.energy-btn').forEach(b=>b.addEventListener('click',()=>startExperience(b.dataset.energy)));
  document.getElementById('homeBtn').addEventListener('click',()=>{cancelAnimationFrame(raf);cancelAnimationFrame(drcRaf);experience.classList.add('hidden');panel.classList.add('hidden');landing.classList.remove('hidden');});
  document.getElementById('closePanel').addEventListener('click',()=>{cancelAnimationFrame(drcRaf);panel.classList.add('hidden');});
  replayDRC.addEventListener('click',startDRC);continueML.addEventListener('click',runML);
  document.querySelectorAll('.step').forEach(s=>s.addEventListener('click',()=>{if(s.dataset.step==='drc')startDRC();if((s.dataset.step==='features'||s.dataset.step==='ml'||s.dataset.step==='pid')&&drcFinished)runML();}));
  document.querySelectorAll('.graph-placeholder').forEach(b=>b.addEventListener('click',()=>{b.querySelector('small').textContent='여기에 실제 PNG 그래프를 연결하세요';}));
  drawDRC(0);drawSignal(0);
})();
