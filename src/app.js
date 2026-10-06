import { gsap } from 'gsap';

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
  const photonCanvas = document.getElementById('photonCanvas');
  const pctx = photonCanvas.getContext('2d');
  const pmTotal = document.getElementById('pmTotal');
  const pmStatus = document.getElementById('pmStatus');
  const goPid = document.getElementById('goPid');
  const classCanvas = {
    EM: document.getElementById('emCanvas'),
    MU: document.getElementById('muCanvas'),
    HAD: document.getElementById('hadCanvas')
  };
  const classLabel = {
    EM: document.getElementById('cmEM'),
    MU: document.getElementById('cmMU'),
    HAD: document.getElementById('cmHAD')
  };
  let classMaps = null;
  let lastDrcT = 0;
  let mlTimer = null;

  let selectedEnergy = '1PeV';
  let mode = 'particle';
  let startTime = 0;
  let raf = null;
  let drcRaf = null;
  let clickableFootprint = false;
  let footprintCenter = {x:0,y:0,r:0};
  let drcFinished = false;
  let pingScale = { s: 1, a: 0 };
  let showerParticles = [];
  let mlStarted = false;
  let photonMap = [];
  let currentEvent = null;
  let drcFibers = [], drcShower = [];
  const PM_N = 27;
  const DRC_W = 760, DRC_H = 520, SIG_W = 520, SIG_H = 230, PM_W = 460, CM_W = 300;
  const DRC_COLS = 13, DRC_ROWS = 7;
  const DRC_C_CORE = '#6aa8ff', DRC_C_GLOW = '#2f6bff';
  const DRC_S_CORE = '#ff6b6b', DRC_S_GLOW = '#ff2f3f';
  const CMAP_C = [[5,7,15],[16,44,118],[58,122,235],[168,214,255]];
  const CMAP_S = [[5,7,15],[104,18,26],[236,74,74],[255,205,170]];
  const CMAP_EM = [[5,7,15],[16,44,118],[58,122,235],[168,214,255]];
  const CMAP_MU = [[5,7,15],[92,40,6],[236,126,34],[255,214,150]];
  const CMAP_HAD = [[5,7,15],[10,74,40],[58,196,110],[190,255,205]];
  const CLASS_YIELD = { EM:1, MU:.035, HAD:.45 };
  const CLASS_CMAP = { EM:CMAP_EM, MU:CMAP_MU, HAD:CMAP_HAD };

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
    '1PeV':   {label:'1 PeV', shower:60, spread:.24, footprint:.16, color:'#72e7ff', mode:'particle'},
    '10PeV':  {label:'10 PeV', shower:100, spread:.34, footprint:.23, color:'#73a7ff', mode:'particle'},
    '100PeV': {label:'100PeV',shower:150,spread:.44, footprint:.31, color:'#a989ff', mode:'performance'},
    '10EeV':  {label:'10EeV', shower:220,spread:.57, footprint:.40, color:'#ffb86a', mode:'performance'}
  };

  // Placeholder distributions — replace mean/std with the measured values.
  const PID_DEMO = {
    '1PeV': {
      cher:{mean:486,std:48}, scin:{mean:840,std:78},
      composition:{EM:{mean:.18,std:.025},MU:{mean:.69,std:.040},HAD:{mean:.13,std:.020}}
    },
    '10PeV': {
      cher:{mean:1118,std:105}, scin:{mean:2724,std:240},
      composition:{EM:{mean:.24,std:.030},MU:{mean:.12,std:.025},HAD:{mean:.64,std:.045}}
    }
  };

  function gauss(mean,std){
    let u=0,v=0;
    while(u===0)u=Math.random();
    while(v===0)v=Math.random();
    return mean+std*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  }

  function sampleEvent(key){
    const d=PID_DEMO[key]||PID_DEMO['1PeV'];
    const raw={
      EM:Math.max(.01,gauss(d.composition.EM.mean,d.composition.EM.std)),
      MU:Math.max(.01,gauss(d.composition.MU.mean,d.composition.MU.std)),
      HAD:Math.max(.01,gauss(d.composition.HAD.mean,d.composition.HAD.std))
    };
    const sum=raw.EM+raw.MU+raw.HAD;
    return {
      cFinal:Math.max(1,Math.round(gauss(d.cher.mean,d.cher.std))),
      sFinal:Math.max(1,Math.round(gauss(d.scin.mean,d.scin.std))),
      composition:{EM:raw.EM/sum,MU:raw.MU/sum,HAD:raw.HAD/sum}
    };
  }

  // scene sits high enough that the ground plane clears the hint banner at the canvas bottom
  const GROUND_Y = .66, DEPTH_SCALE = .48, HORIZON_Y = GROUND_Y - .19;

  const SHOWER_ORIGIN_X = -.06, SHOWER_Z_TOP = .62, SHOWER_Z_GROUND = .02, SHOWER_U_END = .72;
  const SHOWER_SPREAD_SCALE = 1.45;
  const SPECIES_CORE = { EM:'#a8cdff', MU:'#ffc48c', HAD:'#96e8b8' };
  const SPECIES_GLOW = { EM:'#3a7aeb', MU:'#ff8a2b', HAD:'#2fbf6e' };
  const SPECIES_SPREAD = { EM:.32, MU:.13, HAD:.5 };
  const SPECIES_DIE_CHANCE = { EM:.04, MU:.015, HAD:.12 };

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
    const groundY = h*GROUND_Y;
    const perspective = 1 - y*.22;
    return {x:w*.5 + x*w*.39*perspective,y:groundY - z*h*DEPTH_SCALE + y*h*.18,s:perspective};
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
      const x=(i*97)%w, y=((i*61)%Math.max(120,h*HORIZON_Y)); const r=(i%4===0)?1.2:.6;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
  }

  function drawGround(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const horizon=h*HORIZON_Y;
    ctx.fillStyle='rgba(3,24,36,.86)';ctx.beginPath();ctx.moveTo(0,horizon);ctx.lineTo(w,horizon);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
    const poly=SONGDO_POLY.map(([x,y])=>project(x,y,0));
    ctx.beginPath(); poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
    const grd=ctx.createLinearGradient(0,h*(GROUND_Y-.23),0,h*(GROUND_Y+.17)); grd.addColorStop(0,'#173a31');grd.addColorStop(1,'#10251f');
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

  function mutateSpecies(species){
    if(species==='HAD'){
      const r=Math.random();
      return r<.35?'EM':(r<.5?'MU':'HAD');
    }
    if(species==='EM') return Math.random()<.06?'MU':'EM';
    return 'MU';
  }

  function initShower(cfg) {
    const maxGen=Math.max(4,Math.round(Math.log2(cfg.shower)));
    const cap=Math.round(cfg.shower*2.9);
    const segs=[];

    function branchCount(species,gen){
      const vigor=1-gen/maxGen;
      const r=Math.random();
      if(species==='MU') return r<.14*vigor?2:1;
      if(species==='HAD') return r<.6*vigor?2:1;
      if(r<.3*vigor) return 3;
      return r<vigor?2:1;
    }

    function addNode(x0,y0,z0,angle,gen,u0,species){
      const u1=Math.min(SHOWER_U_END,((gen+1)/maxGen)*SHOWER_U_END);
      const reach=Math.min(1,(gen+1)/maxGen);
      const depth=gen/maxGen;
      const r1=cfg.spread*SHOWER_SPREAD_SCALE*Math.pow(reach,.55);
      const swing=SPECIES_SPREAD[species]||.32;
      const angle1=angle+(Math.random()-0.5)*swing*2;
      const x1=Math.cos(angle1)*r1, y1=Math.sin(angle1)*r1*.6;
      const z1=SHOWER_Z_TOP-(SHOWER_Z_TOP-SHOWER_Z_GROUND)*reach;
      const dies=gen>=1 && reach<1 && Math.random()<(SPECIES_DIE_CHANCE[species]||.04);
      segs.push({
        x0,y0,z0,x1,y1,z1,u0,u1,depth,species,dies,
        bend:(Math.random()-0.5)*.4,
        width:.5+2.1*Math.pow(1-depth,1.3)
      });
      if(dies || reach>=1) return;
      const n = segs.length>=cap ? 1 : branchCount(species,gen+1);
      for(let i=0;i<n;i++) addNode(x1,y1,z1,angle1,gen+1,u1,mutateSpecies(species));
    }

    const roots=Math.max(3,6+Math.floor(cfg.shower/50));
    const rootSpecies=['HAD','MU'];
    while(rootSpecies.length<roots) rootSpecies.push('EM');
    rootSpecies.forEach((species,i)=>{
      const angle0=(i/roots)*Math.PI*2+Math.random()*.6;
      addNode(0,0,SHOWER_Z_TOP,angle0,0,0,species);
    });
    showerParticles=segs;
  }

  function drawPrimary(t,cfg){
    const rawFall=t/.25;
    const fall=Math.min(1,Math.max(0,rawFall));
    const ease=fall<1?1-Math.pow(1-fall,4):1;
    const p=project(-.06,0,1.22-ease*0.6), p2=project(-.06,0,1.38-ease*0.6);

    if(fall < 1) {
      ctx.strokeStyle=cfg.color;ctx.lineWidth=4;ctx.shadowColor=cfg.color;ctx.shadowBlur=25;
      ctx.beginPath();ctx.moveTo(p2.x,p2.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.shadowBlur=0;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();
    } else if (rawFall < 1.1) {
      const flash = Math.max(0, Math.min(1, (1.1 - rawFall) * 10));
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, 40 * (1-flash)), 0, Math.PI*2); ctx.fill();
    }
  }

  function drawShower(t,cfg){
    const phase=Math.max(0, (t-.20)/0.60); if(phase<=0)return;

    const visible=[];
    showerParticles.forEach(seg=>{
      if(phase < seg.u0) return;
      const local=Math.min(1,(phase-seg.u0)/(seg.u1-seg.u0));
      const growth=1-Math.pow(1-local,3);

      const ex=seg.x0+(seg.x1-seg.x0)*growth;
      const ey=seg.y0+(seg.y1-seg.y0)*growth;
      const ez=seg.z0+(seg.z1-seg.z0)*growth;
      const mx=(seg.x0+ex)/2-(ey-seg.y0)*seg.bend;
      const my=(seg.y0+ey)/2+(ex-seg.x0)*seg.bend;
      const mz=(seg.z0+ez)/2;

      let alpha=(.3+.7*growth)*(.65+.35*(1-seg.depth));
      if(seg.dies) alpha*=Math.max(0,1-(phase-seg.u1)*1.8);
      if(alpha<=0.01) return;

      const p1=project(SHOWER_ORIGIN_X+ex, ey, ez);
      visible.push({
        p0:project(SHOWER_ORIGIN_X+seg.x0, seg.y0, seg.z0),
        pm:project(SHOWER_ORIGIN_X+mx, my, mz),
        p1, alpha, local, species:seg.species,
        w:seg.width*(0.7+0.3*p1.s)
      });
    });

    ctx.save();
    ctx.lineCap='round';

    ctx.globalCompositeOperation='lighter';
    visible.forEach(v=>{
      ctx.strokeStyle=hexToRgba(SPECIES_GLOW[v.species], v.alpha*.13);
      ctx.lineWidth=v.w*2.0;
      ctx.beginPath();ctx.moveTo(v.p0.x,v.p0.y);ctx.quadraticCurveTo(v.pm.x,v.pm.y,v.p1.x,v.p1.y);ctx.stroke();
    });

    ctx.globalCompositeOperation='source-over';
    visible.forEach(v=>{
      ctx.strokeStyle=hexToRgba(SPECIES_CORE[v.species], v.alpha*.92);
      ctx.lineWidth=v.w;
      ctx.beginPath();ctx.moveTo(v.p0.x,v.p0.y);ctx.quadraticCurveTo(v.pm.x,v.pm.y,v.p1.x,v.p1.y);ctx.stroke();

      if(v.local<1){
        const spark=ctx.createRadialGradient(v.p1.x,v.p1.y,0,v.p1.x,v.p1.y,v.w*2.2);
        spark.addColorStop(0,'rgba(255,255,255,.9)');
        spark.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=spark;
        ctx.beginPath();ctx.arc(v.p1.x,v.p1.y,v.w*2.2,0,Math.PI*2);ctx.fill();
      }
    });
    ctx.restore();
  }

  function drawFootprint(t,cfg){
    const reveal=Math.max(0,Math.min(1,(t-.75)/.20)); if(reveal<=0)return;
    const c=project(-.06,0,0.012), radius=cfg.footprint*canvas.clientWidth*.36*reveal;
    footprintCenter={x:c.x,y:c.y,r:radius};
    const rg=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,radius);
    rg.addColorStop(0,'rgba(255,255,255,.95)');rg.addColorStop(.2,hexToRgba(cfg.color,.9));rg.addColorStop(.6,hexToRgba(cfg.color,.3));rg.addColorStop(1,hexToRgba(cfg.color,0));
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

    if(clickableFootprint) {
      ctx.strokeStyle = `rgba(255,255,255,${pingScale.a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, radius * pingScale.s, radius * 0.48 * pingScale.s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function hexToRgba(hex,a){
    const h=hex.replace('#',''),n=parseInt(h,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  function animate(ts){
    const cfg=ENERGY[selectedEnergy]; if(!startTime)startTime=ts;
    const sec=(ts-startTime)/1000, t=Math.min(1,sec/5.2);
    drawBackground();drawGround();drawPrimary(t,cfg);drawShower(t,cfg);drawFootprint(t,cfg);
    progress.style.width=(t*100)+'%';
    
    if(t<.20)statusLabel.textContent='Primary particle collision';
    else if(t<.75)statusLabel.textContent='Extensive Air Shower cascade';
    else if(t<.90)statusLabel.textContent='Detector ground response';
    else statusLabel.textContent=mode==='particle'?'Detector ready for DRC view':'Footprint ready';
    
    if(t>=.92 && !clickableFootprint){
      clickableFootprint=true;
      hint.classList.remove('hidden');
      gsap.fromTo(hint, { scale: 0.8, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)' });
      hint.textContent=mode==='particle'?'빛나는 detector를 클릭하여 내부 신호를 확인하세요':'Footprint를 클릭하여 array 성능을 확인하세요';
      
      gsap.to(pingScale, {
        s: 2.2, a: 0, duration: 1.5, repeat: -1, ease: 'sine.out',
        onRepeat: () => { pingScale.s = 1; pingScale.a = 1; }
      });
      gsap.set(pingScale, { s: 1, a: 1 });
    }
    if(t<1)raf=requestAnimationFrame(animate);
  }

  function startExperience(key){
    selectedEnergy=key;mode=ENERGY[key].mode;energyLabel.textContent=ENERGY[key].label;
    landing.classList.add('hidden');experience.classList.remove('hidden');panel.classList.add('hidden');
    hint.classList.add('hidden');progress.style.width='0';clickableFootprint=false;startTime=0;
    initShower(ENERGY[key]);
    gsap.killTweensOf(pingScale);gsap.killTweensOf(hint);
    cancelAnimationFrame(raf);cancelAnimationFrame(drcRaf);requestAnimationFrame(()=>{resize();raf=requestAnimationFrame(animate);});
  }

  function resetPidUI(){
    drcFinished=false;mlStarted=false;continueML.disabled=true;mlSection.classList.add('locked');mlSection.classList.add('hidden');
    mlLock.textContent='DRC event를 먼저 재생하세요';
    showStep('drc');
    document.querySelectorAll('[data-stage]').forEach(el=>el.classList.remove('active'));
    const prog=document.getElementById('unetProgress'); if(prog) prog.style.width='0';
    ['fEM','fMU','fHAD','summaryEM','summaryMU','summaryHAD'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
    const ft=document.getElementById('featTotal');if(ft)ft.textContent='—';
    const ms=document.getElementById('modelStatus');if(ms)ms.textContent='Waiting for detector photon map';
    const cs=document.getElementById('compositionStatus');if(cs)cs.textContent='Per-pixel composition not calculated';
    cCount.textContent='0';sCount.textContent='0';
    pmTotal.textContent='—';pmStatus.textContent='Waiting for DRC event';
    goPid.classList.remove('ready');
    clearClassMaps();
    initPhotonMap();initDRCEvent();drawDRC(0);drawSignal(0);drawPhotonMap(0);
  }

  function showStep(stepId) {
    document.querySelectorAll('.step-view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    const targetView = document.getElementById(`view-${stepId}`);
    const targetBtn = document.querySelector(`.step[data-step="${stepId}"]`);
    
    if (targetView) targetView.classList.remove('hidden');
    if (targetBtn) targetBtn.classList.add('active');

    if (stepId === 'drc') {
      mlSection.classList.add('hidden');
    } else {
      mlSection.classList.remove('hidden');
    }
  }

  function openDetail(){
    gsap.killTweensOf(hint);
    hint.classList.add('hidden');
    cancelAnimationFrame(raf);
    experience.classList.add('hidden');
    panel.classList.remove('hidden');
    window.scrollTo(0,0);

    if(mode==='particle'){
      particlePanel.classList.remove('hidden');performancePanel.classList.add('hidden');particleTitle.textContent=`Detector event — ${ENERGY[selectedEnergy].label}`;
      resetPidUI();requestAnimationFrame(()=>startDRC());
    }else{
      performancePanel.classList.remove('hidden');particlePanel.classList.add('hidden');performanceTitle.textContent=`Array performance — ${ENERGY[selectedEnergy].label}`;
    }
  }

  function closeDetail() {
    cancelAnimationFrame(drcRaf);
    panel.classList.add('hidden');
    experience.classList.remove('hidden');
    window.scrollTo(0,0);
    if(clickableFootprint) hint.classList.remove('hidden');
  }

  function fitCanvas(cv,c,W,H){
    const css=cv.getBoundingClientRect().width||W;
    const scale=Math.min(2,window.devicePixelRatio||1)*(css/W);
    const w=Math.max(1,Math.round(W*scale)), h=Math.max(1,Math.round(H*scale));
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
    c.setTransform(scale,0,0,scale,0,0);
  }

  function isoPoint(x,y,z){
    return {x:DRC_W*.5 + x*190 - y*108, y:DRC_H*.76 - z*310 + x*42 + y*42};
  }

  function line(a,b,color,width=1){dctx.strokeStyle=color;dctx.lineWidth=width;dctx.beginPath();dctx.moveTo(a.x,a.y);dctx.lineTo(b.x,b.y);dctx.stroke();}

  function initDRCEvent(){
    drcShower=[];
    const maxGen=5, zTop=.92, zBot=.10;
    function grow(x0,y0,z0,ang,gen,u0){
      const frac=(gen+1)/maxGen;
      const z1=zTop-(zTop-zBot)*frac;
      const spread=.46*Math.pow(frac,.8);
      const a1=ang+(Math.random()-.5)*1.1;
      const rr=spread*(.55+.55*Math.random());
      const x1=Math.cos(a1)*rr, y1=Math.sin(a1)*rr*.66;
      const u1=((gen+1)/maxGen)*.8;
      drcShower.push({x0,y0,z0,x1,y1,z1,u0,u1,gen,width:Math.max(.7,2.4-gen*.42)});
      if(gen+1>=maxGen)return;
      const vigor=1-gen/maxGen;
      let n=Math.random()<.78*vigor?2:1;
      if(Math.random()<.24*vigor)n=3;
      for(let i=0;i<n;i++) grow(x1,y1,z1,a1,gen+1,u1);
    }
    for(let i=0;i<3;i++) grow(0,0,zTop,Math.random()*Math.PI*2,0,.04);

    const deposits=[];
    drcShower.forEach(s=>{
      for(let k=1;k<=3;k++){
        const f=k/3;
        deposits.push({
          x:s.x0+(s.x1-s.x0)*f, y:s.y0+(s.y1-s.y0)*f, z:s.z0+(s.z1-s.z0)*f,
          u:s.u0+(s.u1-s.u0)*f, e:1/(1+s.gen*.55)
        });
      }
    });

    drcFibers=[];
    for(let i=0;i<DRC_COLS;i++){
      for(let j=0;j<DRC_ROWS;j++){
        const fx=-.62+(i/(DRC_COLS-1))*1.24;
        const fy=-.42+(j/(DRC_ROWS-1))*.84;
        const type=(i+j)%2===0?'C':'S';
        const sig=type==='C'?.20:.34;
        let e=0,uFirst=1,zPeak=zTop,best=0;
        deposits.forEach(d=>{
          const r=Math.hypot(d.x-fx,d.y-fy);
          const wgt=d.e*Math.exp(-(r*r)/(2*sig*sig));
          if(wgt<.004)return;
          e+=wgt;
          if(wgt>best){best=wgt;zPeak=d.z;}
          if(d.u<uFirst)uFirst=d.u;
        });
        drcFibers.push({fx,fy,type,e,uFirst,zPeak});
      }
    }
    const peak=Math.max(...drcFibers.map(f=>f.e),1e-6);
    drcFibers.forEach(f=>{f.e=Math.min(1,f.e/peak)});
    drcFibers.sort((a,b)=>(a.fx+a.fy)-(b.fx+b.fy));
  }

  function drawDRC(t){
    lastDrcT=t;
    fitCanvas(drcCanvas,dctx,DRC_W,DRC_H);
    const w=DRC_W,h=DRC_H;dctx.clearRect(0,0,w,h);
    const bg=dctx.createRadialGradient(w*.5,h*.45,20,w*.5,h*.45,w*.58);
    bg.addColorStop(0,'#101c33');bg.addColorStop(1,'#05070f');dctx.fillStyle=bg;dctx.fillRect(0,0,w,h);

    const A=isoPoint(-.72,-.52,0),B=isoPoint(.72,-.52,0),C=isoPoint(.72,.52,0),D=isoPoint(-.72,.52,0),
          A2=isoPoint(-.72,-.52,1),B2=isoPoint(.72,-.52,1),C2=isoPoint(.72,.52,1),D2=isoPoint(-.72,.52,1);
    dctx.fillStyle='rgba(58,86,140,.12)';dctx.beginPath();[A,B,C,D].forEach((p,i)=>i?dctx.lineTo(p.x,p.y):dctx.moveTo(p.x,p.y));dctx.closePath();dctx.fill();
    [[A,B],[B,C],[C,D],[D,A],[A2,B2],[B2,C2],[C2,D2],[D2,A2],[A,A2],[B,B2],[C,C2],[D,D2]]
      .forEach(e=>line(e[0],e[1],'rgba(126,158,214,.42)',1.1));

    dctx.lineCap='butt';
    drcFibers.forEach(f=>{
      line(isoPoint(f.fx,f.fy,.95), isoPoint(f.fx,f.fy,.05),
           f.type==='C'?'rgba(86,120,205,.20)':'rgba(190,84,94,.17)', 1);
    });

    dctx.lineCap='round';
    const showerT=Math.max(0,(t-.10)/.78);
    const TRACK_TAIL=.5;
    drcShower.forEach(s=>{
      const life=(showerT-s.u0)/(s.u1-s.u0);
      if(life<=0||life-TRACK_TAIL>=1)return;
      const ease=u=>1-Math.pow(1-u,3);
      const hu=ease(Math.min(1,life)), tu=ease(Math.max(0,life-TRACK_TAIL));
      const at=u=>isoPoint(s.x0+(s.x1-s.x0)*u, s.y0+(s.y1-s.y0)*u, s.z0+(s.z1-s.z0)*u);
      const p0=at(tu), p1=at(hu);
      const a=Math.min(1,(hu-tu)/(TRACK_TAIL*.8))*(1-s.gen*.10);
      line(p0,p1,`rgba(150,190,255,${a*.22})`,s.width*2.6);
      line(p0,p1,`rgba(232,242,255,${a*.9})`,s.width);
      if(life<1){
        dctx.fillStyle=`rgba(255,255,255,${a})`;
        dctx.beginPath();dctx.arc(p1.x,p1.y,s.width*.9,0,Math.PI*2);dctx.fill();
      }
    });

    const entry=Math.min(1,t/.16), pz=1.42-entry*.5;
    if(entry<1){
      const p=isoPoint(0,0,pz), trail=isoPoint(0,0,pz+.4);
      line(trail,p,'rgba(168,202,255,.45)',5);
      line(trail,p,'#ffffff',2);
      dctx.fillStyle='#fff';dctx.beginPath();dctx.arc(p.x,p.y,4,0,Math.PI*2);dctx.fill();
    }

    drcFibers.forEach(f=>{
      const arrive=Math.max(0,Math.min(1,(t-f.uFirst*.66-.10)*3.0-1));
      if(arrive<=0||f.e<=.02)return;
      const q=isoPoint(f.fx,f.fy,.03);
      const col=f.type==='C'?DRC_C_CORE:DRC_S_CORE;
      const glow=f.type==='C'?DRC_C_GLOW:DRC_S_GLOW;
      const a=f.e*Math.min(1,arrive*4);
      const pop=1+.7*Math.max(0,1-arrive*5);
      dctx.fillStyle=hexToRgba(glow,a*.3);
      dctx.fillRect(q.x-5*pop,q.y-3*pop,10*pop,6*pop);
      dctx.fillStyle=hexToRgba(col,a*.95);
      dctx.fillRect(q.x-3.5,q.y-2,7,4);
    });
    dctx.fillStyle='rgba(206,220,246,.9)';dctx.font='600 12px system-ui';
    dctx.fillText('SiPM readout plane', isoPoint(-.72,.52,0).x, isoPoint(-.72,.52,0).y+22);

    dctx.fillStyle='rgba(240,247,255,.97)';dctx.font='700 15px system-ui';
    dctx.fillText('DRC module · dual-readout fibres',30,34);
    dctx.font='12.5px system-ui';dctx.fillStyle='rgba(199,214,242,.95)';
    dctx.fillText('Cherenkov fibres track the EM core · Scintillation fibres see the full deposit',30,h-44);
    const lx=30, ly=h-14;
    dctx.fillStyle=DRC_C_CORE;dctx.fillRect(lx,ly-9,11,5);
    dctx.fillStyle='rgba(222,233,252,.96)';dctx.font='12px system-ui';dctx.fillText('Cherenkov',lx+21,ly-4);
    dctx.fillStyle=DRC_S_CORE;dctx.fillRect(lx+110,ly-9,11,5);
    dctx.fillStyle='rgba(222,233,252,.96)';dctx.fillText('Scintillation',lx+131,ly-4);
  }

  function cmapColor(stops,v){
    const x=Math.max(0,Math.min(1,v))*(stops.length-1);
    const i=Math.min(stops.length-2,Math.floor(x)), f=x-i;
    const a=stops[i], b=stops[i+1];
    return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
  }

  function initPhotonMap(cherFrac=.4){
    photonMap=[];
    const hot=[...Array(3)].map(()=>({x:(Math.random()-.5)*.7,y:(Math.random()-.5)*.7,r:.1+Math.random()*.12}));
    for(let gy=0;gy<PM_N;gy++){
      for(let gx=0;gx<PM_N;gx++){
        const nx=(gx+.5)/PM_N*2-1, ny=(gy+.5)/PM_N*2-1;
        const d=Math.hypot(nx,ny);
        let v=Math.exp(-Math.pow(d/.33,2))+.42*Math.exp(-Math.pow(d/.78,2));
        hot.forEach(h=>{v+=.5*Math.exp(-Math.pow(Math.hypot(nx-h.x,ny-h.y)/h.r,2))});
        v=Math.min(1,v*(.55+.9*Math.random()));
        const core=Math.exp(-Math.pow(d/.34,2));
        const cw=Math.max(0,Math.min(1,cherFrac*(.55+1.6*core)+(Math.random()-.5)*.18));
        const type=(gx+gy)%2===0?'C':'S';
        photonMap.push({gx,gy,type,v:Math.min(1,v*(type==='C'?cw:1-cw)*1.35),delay:Math.min(1,d/1.2)});
      }
    }
  }

  function initClassMaps(){
    const build=fn=>{
      const cells=[];let peak=0;
      for(let gy=0;gy<PM_N;gy++){
        for(let gx=0;gx<PM_N;gx++){
          const nx=(gx+.5)/PM_N*2-1, ny=(gy+.5)/PM_N*2-1;
          const v=Math.max(0,fn(nx,ny,Math.hypot(nx,ny)));
          if(v>peak)peak=v;
          cells.push({gx,gy,v});
        }
      }
      if(peak>0)cells.forEach(c=>{c.v/=peak});
      return cells;
    };
    const lumps=[...Array(4)].map(()=>{
      const a=Math.random()*Math.PI*2, r=.1+Math.random()*.28;
      return {x:Math.cos(a)*r,y:Math.sin(a)*r,s:.1+Math.random()*.11,w:.3+Math.random()*.45};
    });
    classMaps={
      EM: build((x,y,d)=>Math.exp(-Math.pow(d/.23,2))*(.85+.3*Math.random())+.1*Math.exp(-Math.pow(d/.5,2))),
      MU: build((x,y,d)=>Math.random()<(.07+.055*Math.exp(-Math.pow(d/.75,2)))?.45+.55*Math.random():0),
      HAD: build((x,y,d)=>{
        let v=.62*Math.exp(-Math.pow(d/.37,2));
        lumps.forEach(l=>{v+=l.w*Math.exp(-Math.pow(Math.hypot(x-l.x,y-l.y)/l.s,2))});
        return v*(.8+.4*Math.random());
      })
    };
  }

  function drawClassMap(key){
    const cv=classCanvas[key]; if(!cv)return;
    const c=cv.getContext('2d');
    fitCanvas(cv,c,CM_W,CM_W);
    const w=CM_W,h=CM_W;
    c.fillStyle='#05070f';c.fillRect(0,0,w,h);
    const cell=Math.min(w,h)/PM_N, ox=(w-cell*PM_N)/2, oy=(h-cell*PM_N)/2;
    if(classMaps&&classMaps[key]){
      const cmap=CLASS_CMAP[key];
      classMaps[key].forEach(m=>{
        if(m.v<.02)return;
        c.fillStyle=cmapColor(cmap,Math.pow(m.v,.8));
        c.fillRect(ox+m.gx*cell,oy+m.gy*cell,cell-1,cell-1);
      });
    }
    c.strokeStyle='rgba(120,140,200,.3)';c.lineWidth=1;
    c.strokeRect(ox+.5,oy+.5,cell*PM_N-1,cell*PM_N-1);
  }

  function renderClassMaps(total){
    const sum=CLASS_YIELD.EM+CLASS_YIELD.MU+CLASS_YIELD.HAD;
    ['EM','MU','HAD'].forEach(k=>{
      drawClassMap(k);
      const share=CLASS_YIELD[k]/sum;
      if(classLabel[k]) classLabel[k].textContent=
        `${Math.round(total*share).toLocaleString()} γ · ${(share*100).toFixed(1)}%`;
    });
  }

  function clearClassMaps(){
    classMaps=null;
    ['EM','MU','HAD'].forEach(k=>{drawClassMap(k); if(classLabel[k])classLabel[k].textContent='—';});
  }

  function drawPhotonMap(p){
    fitCanvas(photonCanvas,pctx,PM_W,PM_W);
    const w=PM_W,h=PM_W;
    pctx.fillStyle='#05070f';pctx.fillRect(0,0,w,h);
    const cell=Math.min(w,h)/PM_N, ox=(w-cell*PM_N)/2, oy=(h-cell*PM_N)/2;
    photonMap.forEach(m=>{
      const local=Math.max(0,Math.min(1,(p-m.delay*.55)*2.8));
      if(local<=0)return;
      const v=Math.pow(Math.min(1,m.v*local),.78);
      if(v<.02)return;
      pctx.fillStyle=cmapColor(m.type==='C'?CMAP_C:CMAP_S,v);
      pctx.fillRect(ox+m.gx*cell,oy+m.gy*cell,cell-1,cell-1);
    });
    if(p>0&&p<1){
      const sweep=oy+Math.min(1,p*1.25)*cell*PM_N;
      pctx.strokeStyle='rgba(190,205,255,.45)';pctx.lineWidth=2;
      pctx.beginPath();pctx.moveTo(ox,sweep);pctx.lineTo(ox+cell*PM_N,sweep);pctx.stroke();
    }
    pctx.strokeStyle='rgba(120,140,200,.35)';pctx.lineWidth=1;
    pctx.strokeRect(ox+.5,oy+.5,cell*PM_N-1,cell*PM_N-1);
  }

  function drawSignal(t){
    fitCanvas(signalCanvas,sctx,SIG_W,SIG_H);
    const w=SIG_W,h=SIG_H;sctx.clearRect(0,0,w,h);
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
    drawWave(DRC_C_CORE,92,52,.39,.055);drawWave(DRC_S_CORE,188,70,.48,.10);
    sctx.fillStyle='rgba(145,162,188,.78)';sctx.font='11px system-ui';sctx.fillText('Cherenkov',28,28);sctx.fillText('Scintillation',28,126);sctx.fillText('time →',w-62,h-10);
  }

  function startDRC(){
    cancelAnimationFrame(drcRaf);
    drcFinished=false;mlStarted=false;continueML.disabled=true;
    mlSection.classList.add('locked');mlLock.textContent='DRC event를 먼저 재생하세요';
    const data=currentEvent=sampleEvent(selectedEnergy);
    const mapped=data.cFinal+data.sFinal;
    initPhotonMap(data.cFinal/mapped);
    initDRCEvent();
    const EVENT_MS=4200, MAP_FROM=2900, MAP_MS=2500;
    let t0=0;
    function frame(ts){
      if(!t0)t0=ts;
      const el=ts-t0;
      const t=Math.min(1,el/EVENT_MS);
      const mp=Math.max(0,Math.min(1,(el-MAP_FROM)/MAP_MS));
      drawDRC(t);drawSignal(t);drawPhotonMap(mp);
      const eased=1-Math.pow(1-t,2);
      cCount.textContent=Math.round(data.cFinal*eased).toLocaleString();
      sCount.textContent=Math.round(data.sFinal*eased).toLocaleString();
      pmTotal.textContent=mp>0?Math.round(mapped*mp).toLocaleString():'—';
      if(t<.20)drcStatus.textContent='Particle entering detector';
      else if(t<.50)drcStatus.textContent='Shower developing inside DRC';
      else if(t<.86)drcStatus.textContent='Cherenkov / Scintillation photons increasing';
      else drcStatus.textContent='Optical readout complete';
      if(mp<=0)pmStatus.textContent='Waiting for optical readout';
      else if(mp<1)pmStatus.textContent='광신호를 2D 이미지로 투영하는 중…';
      else pmStatus.textContent='Photon map ready — U-Net 실행 가능';
      if(t<1||mp<1)drcRaf=requestAnimationFrame(frame);
      else{
        drcFinished=true;continueML.disabled=false;
        mlSection.classList.remove('locked');
        mlLock.textContent='Detector photon map ready';
      }
    }
    drcRaf=requestAnimationFrame(frame);
  }

  function runML(){
    if(!drcFinished)return;
    if(mlTimer){clearInterval(mlTimer);mlTimer=null;}
    mlStarted=true;
    const data=currentEvent||sampleEvent(selectedEnergy);

    showStep('ml');
    goPid.classList.remove('ready');
    ['fEM','fMU','fHAD'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
    ['barEM','barMU','barHAD'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.width='0';});

    mlLock.textContent='U-Net inference in progress';
    const stages=[...document.querySelectorAll('[data-stage]')].sort((a,b)=>Number(a.dataset.stage)-Number(b.dataset.stage));
    stages.forEach(el=>el.classList.remove('active'));
    const prog=document.getElementById('unetProgress');
    const modelStatus=document.getElementById('modelStatus');
    const compositionStatus=document.getElementById('compositionStatus');
    const total=data.cFinal+data.sFinal;
    document.getElementById('featTotal').textContent=total.toLocaleString();
    let idx=0;
    const timer=mlTimer=setInterval(()=>{
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
        clearInterval(timer);mlTimer=null;
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
        initClassMaps();renderClassMaps(total);
        goPid.classList.add('ready');

        setTimeout(()=>stages.forEach(el=>el.classList.remove('active')),650);
      }
    },250);
  }

  canvas.addEventListener('click',e=>{
    if(!clickableFootprint)return;
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    const dx=(x-footprintCenter.x)/Math.max(footprintCenter.r,1),dy=(y-footprintCenter.y)/Math.max(footprintCenter.r*.55,1);
    if(dx*dx+dy*dy<=1.4)openDetail();
  });
  document.querySelectorAll('.energy-btn').forEach(b=>b.addEventListener('click',()=>startExperience(b.dataset.energy)));
  document.getElementById('homeBtn').addEventListener('click',()=>{
    cancelAnimationFrame(raf);cancelAnimationFrame(drcRaf);
    gsap.killTweensOf(pingScale);gsap.killTweensOf(hint);
    experience.classList.add('hidden');panel.classList.add('hidden');landing.classList.remove('hidden');
  });
  document.getElementById('closePanel').addEventListener('click', closeDetail);
  replayDRC.addEventListener('click',startDRC);continueML.addEventListener('click',runML);
  goPid.addEventListener('click',()=>showStep('pid'));
  document.querySelectorAll('.step').forEach(s=>s.addEventListener('click',()=>{
    const step=s.dataset.step;
    if(step==='drc'){ showStep('drc'); return; }
    if(!drcFinished) return;
    if(mlStarted) showStep(step);
    else runML();
  }));
  document.querySelectorAll('.graph-placeholder').forEach(b=>b.addEventListener('click',()=>{b.querySelector('small').textContent='여기에 실제 PNG 그래프를 연결하세요';}));
  initPhotonMap();initDRCEvent();drawDRC(0);drawSignal(0);drawPhotonMap(0);clearClassMaps();
})();
