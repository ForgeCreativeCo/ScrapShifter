// Sandbox wanted level (MS.phase 'sandbox'): destruction you cause and kills you make add wanted points; levels 1–5 at
// WANTED.th. Each level sets how many crawlers, bikes and rival rigs (js/rivals.js) hunt you, spawned from the map ring.
// After WANTED.quiet seconds without adding any, points drain at WANTED.decay per second.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const WANTED={th:[0,8,35,80,150,250],quiet:20,decay:3,
  spawn:[null,{c:2,b:1,r:0},{c:4,b:2,r:0},{c:4,b:2,r:1},{c:5,b:2,r:2},{c:6,b:3,r:3}], // per level: crawlers, bikes, rigs alive at once
  pts:{panel:1,slab:2,wall:1.5,shed:3,car:3,crawler:2,bike:1,rig:12}};
const WANT={pts:0,level:0,peak:0,quietT:0,cT:3,bT:8,rT:4,rigKills:0};
// Who set off the explosion being applied: shells from enemies don't count toward your wanted level (main.js sets it per shell)
let dmgBy='player';
function wantedAdd(n){if(MS.phase!=='sandbox'||n<=0||pl.dead)return;WANT.pts+=n;WANT.quietT=0}
function wantedPiece(p){if(dmgBy==='player')wantedAdd(WANTED.pts[p.kind]||1)} // from setPieceState when a piece is destroyed
function wantedKill(e){if(dmgBy!=='player')return;wantedAdd(WANTED.pts[e.type]||2);if(e.type==='rig')WANT.rigKills++}
const STARS=n=>'★'.repeat(n)+'☆'.repeat(5-n);
function wantedTick(dt){WANT.quietT+=dt;if(WANT.quietT>WANTED.quiet)WANT.pts=Math.max(0,WANT.pts-WANTED.decay*dt);
  let lv=0;for(let i=1;i<WANTED.th.length;i++)if(WANT.pts>=WANTED.th[i])lv=i;
  if(lv!==WANT.level){const up=lv>WANT.level;WANT.level=lv;
    if(up&&lv>WANT.peak&&lv>=3&&WANT.peak<3)toast('Wanted '+STARS(lv)+': rival rigs are coming for you!',3.5);
    else toast(up?'Wanted '+STARS(lv):'Cooling off: wanted '+STARS(lv),2.2);WANT.peak=Math.max(WANT.peak,lv);objEl.classList.remove('flash');void objEl.offsetWidth;if(up)objEl.classList.add('flash')}
  const S=WANTED.spawn[WANT.level];if(!S||pl.dead)return;
  const alive=t=>enemies.filter(e=>!e.dead&&e.type===t).length;
  WANT.cT-=dt;if(WANT.cT<=0&&alive('crawler')<S.c){spawnEnemy();WANT.cT=6}
  WANT.bT-=dt;if(WANT.bT<=0&&alive('bike')<S.b){makeBike(...spawnPoint());WANT.bT=10}
  WANT.rT-=dt;if(WANT.rT<=0&&alive('rig')<S.r){makeRig(...spawnPoint());WANT.rT=18;toast('Rival rig incoming!',2.5)}}
function resetWanted(){Object.assign(WANT,{pts:0,level:0,peak:0,quietT:0,cT:3,bT:8,rT:4,rigKills:0})}
function wantedHud(){const lv=WANT.level,next=WANTED.th[lv+1];
  const a=STARS(lv)+'  Wanted'+(lv?' level '+lv:'');
  const m=Math.floor(RUN.t/60),s=String(Math.floor(RUN.t%60)).padStart(2,'0');
  const b=!lv&&WANT.pts<1?'Sandbox: wreck the town. Destruction raises your wanted level.':
    (WANT.quietT<WANTED.quiet?'Lie low '+Math.ceil(WANTED.quiet-WANT.quietT)+' s to cool off':'Cooling off…')+(next?` · ${Math.floor(WANT.pts)}/${next}`:'')+` · ${m}:${s}`;
  return[a,b]}
