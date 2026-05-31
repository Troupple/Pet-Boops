const TIERS = [
  [
    "M 22,100 L 418,100",
    "M 22,170 L 220,30 L 418,170",
    "M 22,170 H 418 V 30 H 22",
  ],
  [
    "M 22,170 V 30 H 62 V 170 H 102 V 30 H 142 V 170 H 182 V 30 H 222 V 170 H 262 V 30 H 302 V 170 H 342 V 30 H 382 V 170 H 418",
    "M 22,170 L 62,30 L 102,170 L 142,30 L 182,170 L 222,30 L 262,170 L 302,30 L 342,170 L 382,30 L 418,170",
    "M 22,20 H 120 V 170 H 60 V 90 H 180 V 20 H 280 V 170 H 200 V 90 H 320 V 20 H 418",
  ],
];

const TIER_CONSTRAINTS = [
  [70, 42, 10],
  [35, 18,  6],
];

const TIER_LABELS  = ['EASY','NIGHTMARE'];
const TIER_COLORS  = ['#22c55e','#dc2626'];

const MATH = [
  ()=>{
    const a=acdRi(1,9), b=acdRi(1,9);
    return {q:`${a} + ${b} = ?`, hint:'Simple addition', ans:a+b};
  },
  ()=>{
    const b=acdRi(1,15), a=b+acdRi(1,15);
    return {q:`${a} − ${b} = ?`, hint:'Subtraction', ans:a-b};
  },
  ()=>{
    if(Math.random()<0.5){
      const a=acdRi(2,12), b=acdRi(2,12);
      return {q:`${a} × ${b} = ?`, hint:'Multiplication', ans:a*b};
    } else {
      const b=acdRi(2,12), ans=acdRi(2,12), a=b*ans;
      return {q:`${a} ÷ ${b} = ?`, hint:'Division', ans};
    }
  },
  ()=>{
    const types=['mul2','div2','mixed'];
    const t=types[acdRi(0,2)];
    if(t==='mul2'){
      const a=acdRi(11,25), b=acdRi(11,25);
      return {q:`${a} × ${b} = ?`, hint:'Two-digit multiplication', ans:a*b};
    } else if(t==='div2'){
      const b=acdRi(3,15), ans=acdRi(10,20), a=b*ans;
      return {q:`${a} ÷ ${b} = ?`, hint:'Division', ans};
    } else {
      const a=acdRi(2,9), b=acdRi(2,9), c=acdRi(1,9);
      return {q:`(${a} × ${b}) + ${c} = ?`, hint:'Order of operations', ans:a*b+c};
    }
  },
  ()=>{
    const types=['linear','quad_easy','two_step'];
    const t=types[acdRi(0,2)];
    if(t==='linear'){
      const a=acdRi(2,9), x=acdRi(1,12), b=acdRi(1,20), c=a*x+b;
      return {q:`${a}x + ${b} = ${c}<br>Solve for x`, hint:'Linear equation', ans:x};
    } else if(t==='quad_easy'){
      const x=acdRi(2,10), n=x*x;
      return {q:`x² = ${n}<br>Solve for x (positive)`, hint:'Square root', ans:x};
    } else {
      const a=acdRi(2,9), x=acdRi(2,12), b=acdRi(1,15), c=a*x-b;
      return {q:`${a}x − ${b} = ${c}<br>Solve for x`, hint:'Two-step equation', ans:x};
    }
  },
];

function acdRi(min,max){return Math.floor(Math.random()*(max-min+1))+min;}

const WINDOW=3000, MIN_CLICKS=6, SUSTAINED_CPS=15, STD_THRESHOLD=18;
const INT_50=[45,55], INT_100=[95,105];
const COOLDOWN_MS = 3 * 60 * 60 * 1000;
const NIGHTMARE_LIMIT = 2;
const DEMOTION_MS = 5 * 60 * 1000;
const SUSTAINED_CPS_MINUTE = 60000;

let acdTimes=[], acdLocked=false, acdChallengeUp=false;
let acdSuspicionCount=0;
let acdLastDetectTime=0;
let acdMoveHandler=null, acdUpHandler=null;
let acdMathAnswer=null, acdMathAttempts=0;
let acdActiveChallengeState=null;
let acdCPSHistory=[], acdLastCPSCheckTime=0;

function acdGetStore(){
  try{return JSON.parse(localStorage.getItem('_acd')||'{}');}catch{return {};}
}
function acdSetStore(o){try{localStorage.setItem('_acd',JSON.stringify(o));}catch{}}
function acdLoadSuspicionCount(){
  const s=acdGetStore();
  acdSuspicionCount=s.suspicionCount||0;
}
function acdSaveSuspicionCount(){
  const s=acdGetStore();
  s.suspicionCount=acdSuspicionCount;
  acdSetStore(s);
}
function acdSaveActiveChallengeState(tier){
  const s=acdGetStore();
  s.activeChallengeState={tier:tier, timestamp:Date.now()};
  acdSetStore(s);
}
function acdLoadActiveChallengeState(){
  const s=acdGetStore();
  return s.activeChallengeState||null;
}
function acdClearActiveChallengeState(){
  const s=acdGetStore();
  delete s.activeChallengeState;
  acdSetStore(s);
}

function acdCheckCooldown(){
  const s=acdGetStore();
  if(!s.cooldownUntil)return false;
  if(Date.now()<s.cooldownUntil)return true;
  delete s.cooldownUntil;
  delete s.nightmareCount;
  acdSetStore(s);
  return false;
}

function acdRecordNightmare(){
  const s=acdGetStore();
  s.nightmareCount=(s.nightmareCount||0)+1;
  if(s.nightmareCount>=NIGHTMARE_LIMIT){
    s.cooldownUntil=Date.now()+COOLDOWN_MS;
  }
  acdSetStore(s);
  return s.cooldownUntil||null;
}

function acdFormatMs(ms){
  if(ms<=0)return '00:00:00';
  const h=Math.floor(ms/3600000);
  const m=Math.floor((ms%3600000)/60000);
  const s=Math.floor((ms%60000)/1000);
  return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
}

function acdShowCooldownScreen(until){
  acdCdScreen.classList.add('show');
  const tick=()=>{
    const rem=until-Date.now();
    if(rem<=0){acdCdScreen.classList.remove('show');return;}
    acdCdTimer.textContent=acdFormatMs(rem);
    setTimeout(tick,500);
  };
  tick();
}

let acdCwEl, acdWarnEl, acdMathBox, acdMathQ, acdMathInput, acdMathHint, acdMathAttemptEl, acdMathSubmit, acdSbEl, acdUhEl, acdReasonBadge, acdChallengeWrapper, acdCdScreen, acdCdTimer;
let acdDetectionInterval;
let acdDOMGuardInterval;

function acdInitDOM(){
  acdCwEl=document.getElementById('cw');
  acdWarnEl=document.getElementById('warn-flash');
  acdMathBox=document.getElementById('math-box');
  acdMathQ=document.getElementById('math-q');
  acdMathInput=document.getElementById('math-input');
  acdMathHint=document.getElementById('math-hint');
  acdMathAttemptEl=document.getElementById('math-attempts');
  acdMathSubmit=document.getElementById('math-submit');
  acdSbEl=document.getElementById('sb');
  acdUhEl=document.getElementById('uh');
  acdReasonBadge=document.getElementById('reason-badge');
  acdChallengeWrapper=document.getElementById('acd-challenge-wrapper');
  acdCdScreen=document.getElementById('cooldown-screen');
  acdCdTimer=document.getElementById('cd-timer');
  
  acdLoadSuspicionCount();
  
  const s=acdGetStore();
  if(s.cooldownUntil&&Date.now()<s.cooldownUntil){
    acdShowCooldownScreen(s.cooldownUntil);
  }
  
  const activeChallengeState=acdLoadActiveChallengeState();
  if(activeChallengeState&&!acdLocked){
    acdShowChallengeFromState(activeChallengeState.tier);
  }
  
  acdDetectionInterval=setInterval(()=>{
    const now=Date.now();
    acdTimes=acdTimes.filter(t=>t>now-5000);
    const w3=acdTimes.filter(t=>t>now-WINDOW);
    const cps=acdTimes.filter(t=>t>now-1000).length;
    
    if(now-acdLastCPSCheckTime>=1000){
      acdCPSHistory.push({cps:cps, time:now});
      acdCPSHistory=acdCPSHistory.filter(entry=>entry.time>now-SUSTAINED_CPS_MINUTE);
      acdLastCPSCheckTime=now;
    }
    
    let sustainedConstantCPS=false;
    if(acdCPSHistory.length>=60){
      const cpsValues=acdCPSHistory.slice(-60).map(entry=>entry.cps);
      const allSame=cpsValues.every(v=>v===cpsValues[0]&&v>0);
      if(allSame){sustainedConstantCPS=true;}
    }
    
    const ivs=acdIntervals(w3);
    const enough=ivs.length>=MIN_CLICKS-1;
    const avg=enough?acdMean(ivs):null;
    const sd=enough?acdStd(ivs):null;
    const suspStd=enough&&sd<STD_THRESHOLD;
    const is50=enough&&avg>=INT_50[0]&&avg<=INT_50[1]&&suspStd;
    const is100=enough&&avg>=INT_100[0]&&avg<=INT_100[1]&&suspStd;
    const susRate=w3.length/(WINDOW/1000);
    const isSus=susRate>=SUSTAINED_CPS&&w3.length>=MIN_CLICKS;

    const flagged=is50||is100||isSus||sustainedConstantCPS;
    if(flagged&&!acdChallengeUp&&!acdLocked&&!acdCheckCooldown())acdShowChallenge();
  },200);
  
  acdMathSubmit.addEventListener('click',acdCheckMath);
  acdMathInput.addEventListener('keydown',e=>{if(e.key==='Enter')acdCheckMath();});
  
  acdDOMGuardInterval=setInterval(()=>{
    if(!acdChallengeWrapper.parentNode){document.body.appendChild(acdChallengeWrapper);}
    if(!acdCdScreen.parentNode){document.body.appendChild(acdCdScreen);}
    if(acdLocked&&!acdChallengeWrapper.classList.contains('show')){acdChallengeWrapper.classList.add('show');}
  },100);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',acdInitDOM);
}else{
  acdInitDOM();
}

function acdMean(a){return a.reduce((s,v)=>s+v,0)/a.length;}
function acdStd(a){const m=acdMean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);}
function acdIntervals(ts){const r=[];for(let i=1;i<ts.length;i++)r.push(ts[i]-ts[i-1]);return r;}

function acdComputeTier(){
  const now=Date.now();
  if(acdLastDetectTime>0 && (now-acdLastDetectTime)>DEMOTION_MS){
    acdSuspicionCount=Math.max(0,acdSuspicionCount-1);
  }
  acdLastDetectTime=now;
  acdSuspicionCount++;
  acdSaveSuspicionCount();
  return Math.min(acdSuspicionCount-1, TIERS.length-1);
}

function acdShowChallenge(){
  if(acdCheckCooldown()){
    const s=acdGetStore();
    acdShowCooldownScreen(s.cooldownUntil);
    return;
  }

  const tier=acdComputeTier();
  acdDisplayChallengeTier(tier);
}

function acdShowChallengeFromState(tier){
  if(acdCheckCooldown()){
    const s=acdGetStore();
    acdShowCooldownScreen(s.cooldownUntil);
    return;
  }
  acdChallengeUp=true;
  acdLocked=true;
  acdDisplayChallengeTier(tier);
}

function acdDisplayChallengeTier(tier){
  acdChallengeUp=true;
  acdLocked=true;
  acdChallengeWrapper.classList.add('show');
  acdCwEl.classList.add('show');
  acdReasonBadge.classList.add('show');
  acdSaveActiveChallengeState(tier);

  const [LOOKAHEAD,MAX_DIST,BACKTRACK]=TIER_CONSTRAINTS[tier];

  if(tier===1){
    const coolUntil=acdRecordNightmare();
  }

  document.getElementById('ct').innerHTML=
    'AUTO-CLICKER SUSPECTED'+
    '<br><span style="font-size:11px;letter-spacing:.08em;opacity:.7">Complete both stages to continue</span>'+
    '<br><span style="font-size:10px;letter-spacing:.12em;color:'+TIER_COLORS[tier]+'">DIFFICULTY: '+TIER_LABELS[tier]+' ('+acdSuspicionCount+'x FLAGGED)</span>';

  acdSbEl.style.display='';
  acdUhEl.style.display='';
  acdMathBox.classList.remove('show');

  const tierPaths=TIERS[tier];
  const pathD=tierPaths[Math.floor(Math.random()*tierPaths.length)];
  const svg=document.getElementById('ps');
  svg.innerHTML='';
  const ns='http://www.w3.org/2000/svg';
  const mk=(tag,at)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(at))e.setAttribute(k,v);svg.appendChild(e);return e;};

  mk('path',{d:pathD,stroke:'#111','stroke-width':'20',fill:'none','stroke-linecap':'round','stroke-linejoin':'round'});
  const mainP=mk('path',{d:pathD,stroke:'#3b82f6','stroke-width':'13',fill:'none','stroke-linecap':'round','stroke-linejoin':'round',id:'mainP'});
  const progP=mk('path',{d:pathD,stroke:'#facc15','stroke-width':'7',fill:'none','stroke-linecap':'round','stroke-linejoin':'round'});

  const total=mainP.getTotalLength();
  progP.style.strokeDasharray=total;
  progP.style.strokeDashoffset=total;

  const sp=mainP.getPointAtLength(0);
  const ep=mainP.getPointAtLength(total);

  mk('circle',{cx:sp.x,cy:sp.y,r:'11',fill:'#22c55e',stroke:'#111','stroke-width':'3'});
  mk('circle',{cx:ep.x+3,cy:ep.y+3,r:'11',fill:'#111',stroke:'none'});
  mk('circle',{cx:ep.x,cy:ep.y,r:'11',fill:'#ef4444',stroke:'#111','stroke-width':'3'});

  const hSh=mk('circle',{cx:sp.x+4,cy:sp.y+4,r:'19',fill:'#111',stroke:'none'});
  const hFl=mk('circle',{cx:sp.x,cy:sp.y,r:'19',fill:'#3b82f6',stroke:'#111','stroke-width':'3',style:'cursor:grab'});
  const hTx=document.createElementNS(ns,'text');
  hTx.setAttribute('x',sp.x);hTx.setAttribute('y',sp.y+6);
  hTx.setAttribute('text-anchor','middle');hTx.setAttribute('font-size','17');
  hTx.setAttribute('font-weight','900');hTx.setAttribute('fill','white');
  hTx.setAttribute('pointer-events','none');hTx.textContent='→';
  svg.appendChild(hTx);

  let dragging=false, curLen=0, warnTimeout=null;

  const flashWarn=()=>{
    acdWarnEl.style.opacity='0.22';
    clearTimeout(warnTimeout);
    warnTimeout=setTimeout(()=>acdWarnEl.style.opacity='0',200);
  };

  const toSVG=e=>{const r=svg.getBoundingClientRect();return{x:(e.clientX-r.left)*(440/r.width),y:(e.clientY-r.top)*(200/r.height)};};

  const movH=len=>{
    const p=mainP.getPointAtLength(len);
    hSh.setAttribute('cx',p.x+4);hSh.setAttribute('cy',p.y+4);
    hFl.setAttribute('cx',p.x);hFl.setAttribute('cy',p.y);
    hTx.setAttribute('x',p.x);hTx.setAttribute('y',p.y+6);
    progP.style.strokeDashoffset=total-len;
  };

  hFl.addEventListener('pointerdown',e=>{dragging=true;hFl.style.cursor='grabbing';e.preventDefault();});
  hSh.addEventListener('pointerdown',e=>{dragging=true;e.preventDefault();});

  acdMoveHandler=e=>{
    if(!dragging)return;
    const pt=toSVG(e);
    const from=Math.max(0,curLen-BACKTRACK);
    const to=Math.min(total,curLen+LOOKAHEAD);
    let bestLen=curLen, bestDist=Infinity;
    for(let i=from;i<=to;i+=2){
      const p=mainP.getPointAtLength(i);
      const d=Math.sqrt((p.x-pt.x)**2+(p.y-pt.y)**2);
      if(d<bestDist){bestDist=d;bestLen=i;}
    }
    if(bestDist>MAX_DIST){flashWarn();return;}
    if(bestLen>curLen){curLen=bestLen;movH(curLen);}
    if(curLen>=total-30)acdPathComplete(tier);
  };

  acdUpHandler=()=>{dragging=false;hFl.style.cursor='grab';};
  window.addEventListener('pointermove',acdMoveHandler);
  window.addEventListener('pointerup',acdUpHandler);
}

function acdPathComplete(tier){
  if(acdMoveHandler)window.removeEventListener('pointermove',acdMoveHandler);
  if(acdUpHandler)window.removeEventListener('pointerup',acdUpHandler);
  acdMoveHandler=null;
  acdUpHandler=null;

  acdSbEl.style.display='none';
  acdUhEl.style.display='none';
  acdMathBox.classList.add('show');
  acdMathAttempts=0;
  acdMathAttemptEl.textContent='';
  acdMathInput.value='';
  acdMathInput.classList.remove('error');

  const generated=MATH[tier]();
  acdMathAnswer=generated.ans;
  acdMathQ.innerHTML=generated.q;
  acdMathHint.textContent=generated.hint;
  acdMathInput.focus();
}

function acdCheckMath(){
  const val=parseInt(acdMathInput.value.trim(),10);
  if(isNaN(val)){
    acdMathInput.classList.add('shake');
    setTimeout(()=>acdMathInput.classList.remove('shake'),300);
    return;
  }
  if(val===acdMathAnswer){
    acdMathInput.classList.remove('error');
    acdUnlock();
  } else {
    acdMathAttempts++;
    acdMathInput.classList.add('error');
    acdMathInput.classList.add('shake');
    setTimeout(()=>{acdMathInput.classList.remove('shake');},300);
    acdMathInput.value='';
    acdMathAttemptEl.textContent='Wrong — '+acdMathAttempts+' incorrect attempt'+(acdMathAttempts>1?'s':'');
    acdMathInput.focus();
  }
}

function acdUnlock(){
  if(acdMoveHandler)window.removeEventListener('pointermove',acdMoveHandler);
  if(acdUpHandler)window.removeEventListener('pointerup',acdUpHandler);
  acdMoveHandler=null;
  acdUpHandler=null;
  acdChallengeUp=false;
  acdLocked=false;
  acdTimes=[];
  acdCPSHistory=[];
  acdLastCPSCheckTime=0;
  acdChallengeWrapper.classList.remove('show');
  acdCwEl.classList.remove('show');
  acdMathBox.classList.remove('show');
  acdSbEl.style.display='';
  acdUhEl.style.display='';
  acdReasonBadge.classList.remove('show');
  acdClearActiveChallengeState();

  if(acdCheckCooldown()){
    const s=acdGetStore();
    acdShowCooldownScreen(s.cooldownUntil);
  }
}

function acdTrackClick() {
  acdTimes.push(Date.now());
}

window.acdTrackClick = acdTrackClick;
