// Race mode (maps with MAP.race; MS.race): a point-to-point race against rival rigs (js/rivals.js) that ends in a
// last-rig-standing fight in the arena at the end of the track.
//   grid  -> countdown, everyone held on the start grid
//   race  -> follow the track. Nobody starts with ammo: every shell comes from the crates on the road (RACE.crate each,
//            a crate comes back RACE.respawn s after it is taken). Shoot rivals on the way or save it all for the arena.
//   arena -> crossing the gate puts a racer in the arena (the first three in get some hull repaired). Rigs in the arena
//            fight each other and you; the last one standing wins. The gate closes RACE.gate s after the first racer is
//            in: whoever is still outside is out. After RACE.sudden s everyone in the arena starts losing hull.
// Rules for the player's rig: buggy and mech only (no artillery, no gyro), the RC bike can be launched once and only
// detonates (no mini-mech, no turrets guarding the parked rig), no hull repair once in the arena.
// A wrecked rig is out for good, rival or player. The route must be driven: progress only counts along the track, and
// the gate stays locked for a rig that cut across.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const RACE={rivals:4,rigHp:120,foeDmg:.4,plDmg:.35,bash:14,crate:2,respawn:2.5,gate:60,pick:2.4,cd:3.4,spd:[14.6,15.3,15.9,16.4],bonus:[.6,.4,.2],sudden:150,
  names:['VEX','ROOK','NOVA','GRIT'],tint:[[1,.5,.9],[.5,.95,1],[1,.72,.4],[.72,.6,1]],lamp:[0xff2bd6,0x19e6ff,0xff7a1a,0x9d4dff]};
const RS={phase:'grid',cd:0,cdN:9,t:0,arenaOn:false,arenaT:0,shut:false,sdT:0,ammo:0,got:0,bikeUsed:false,ps:0,pi:0,plat:0,offT:0,pArena:false,place:0,arrived:0,
  racers:[],crates:[],dryT:0,gateT:0,beacon:null,mark:null};
const TRK=MAP.race?MAP.race.track:null,ORD=['','1st','2nd','3rd','4th','5th','6th'];
const ammoPill=document.getElementById('ammoPill'),ammoN=document.getElementById('ammoN'),bigEl=document.getElementById('big');
let bigT=0;function big(t,s=1){bigEl.textContent=t;bigEl.classList.add('show');bigT=s}
function raceBeep(f,d=.14,v=.3){if(audio())th(AC.currentTime,f,f*.985,d,v)}
// nearest track sample to (x,z), searched only from `back` samples behind i0 to `fwd` ahead: progress can't jump lanes
function trkNear(x,z,i0,back,fwd){let bi=i0,bd=1e9;for(let i=Math.max(0,i0-back);i<=Math.min(TRK.n-1,i0+fwd);i++){const d=Math.hypot(TRK.x[i]-x,TRK.z[i]-z);if(d<bd){bd=d;bi=i}}return[bi,bd]}

if(MAP.race){const geo=B(.74,.44,.52),lid=B(.78,.08,.56);
  MAP.race.crates.forEach(c=>{const g=new THREE.Group();mk(geo,hazard,0,0,0,g);mk(lid,steel,0,.2,0,g);const gl=S(glowT,0x19e6ff,true,.8,2.4);gl.position.y=.45;g.add(gl);
    g.position.set(c.x,gh(c.x,c.z)+.62,c.z);sc.add(g);RS.crates.push({x:c.x,z:c.z,s:c.s,lat:c.lat,g,gl,t:0,ph:Math.random()*6})});
  document.querySelectorAll('button[data-m="1"],button[data-m="3"]').forEach(b=>b.style.display='none'); // no artillery, no gyro
  ammoPill.style.display='flex'}

function raceReset(){if(!MAP.race)return;const G=MAP.race;
  Object.assign(RS,{phase:'grid',cd:RACE.cd,cdN:9,t:0,arenaOn:false,arenaT:0,shut:false,sdT:0,ammo:0,got:0,bikeUsed:false,ps:G.playerS,pi:Math.round(G.playerS/TRK.step),plat:-3,offT:0,pArena:false,place:0,arrived:0,dryT:0,gateT:0});
  RS.racers.length=0;
  G.grid.slice(0,RACE.rivals).forEach((q,i)=>{const p=trkAt(TRK,q.s,q.lat),e=makeRig(p.x,p.z,{tint:RACE.tint[i],lamp:RACE.lamp[i],name:RACE.names[i]});
    Object.assign(e,{h:p.h,hp:RACE.rigHp,maxHp:RACE.rigHp,race:true,arena:false,place:0,rs:q.s,ri:Math.round(q.s/TRK.step),lane:q.lat,home:q.lat,laneT:q.lat,rspd:RACE.spd[i],
      ammo:0,fireT:rnd(8,14),crT:0,slowT:0,told:false});RS.racers.push(e)});
  RS.crates.forEach(c=>{c.t=0;c.g.visible=true});
  if(!RS.beacon)RS.beacon=makeBeacon(0,gh(0,0)+14,0,0x19e6ff,2,120); // the arena shows from anywhere on the track (starts above the top deck, out of the fight's way)
  RS.mark=addMark('warn',()=>RS.offT>1.5&&!RS.pArena&&RS.phase==='race'?_mp.set(TRK.x[RS.pi],2,TRK.z[RS.pi]):null,()=>'Rejoin the route')}

// A racer crosses the arena gate: finishing order, hull repair for the first three
function raceArrive(e){const place=++RS.arrived,k=RACE.bonus[place-1]||0,first=!RS.arenaOn;RS.arenaOn=true;
  if(e){e.arena=true;e.place=place;e.hp=Math.min(e.maxHp,e.hp+e.maxHp*k);e.modeT=9;e.wp=null;e.path=null;if(!pl.dead)toast(`${e.name} reached the arena · ${ORD[place]}`+(first&&!RS.pArena?` · the gate closes in ${RACE.gate} s`:''),first?3.5:2.2);return}
  RS.pArena=true;RS.place=place;RS.phase='arena';pl.hp=Math.min(PL_MAX,pl.hp+PL_MAX*k);big('ARENA',1.8);raceBeep(520,.5,.35);
  toast(`You finished ${ORD[place]}${k?' · +'+Math.round(k*100)+'% hull':''}. Last rig standing wins!`,4.5)}

// ---------- Rival rigs (called from rigTick in js/rivals.js)
// Racing: steer for a point a little way up the track in the rig's lane (A* round anything in the way); ease off for
// corners; a little rubber-banding on the player.
function raceDrive(e,dt){const T=TRK;if(RS.phase==='grid')return[e.h,0];
  const i1=Math.min(T.n-1,e.ri+16);let bend=T.h[i1]-T.h[e.ri];bend=Math.abs(Math.atan2(Math.sin(bend),Math.cos(bend)));
  e.lane+=Math.max(-5*dt,Math.min(5*dt,e.laneT-e.lane));
  const p=trkAt(T,e.rs+9+Math.abs(e.v)*.45,e.lane*(1-.6*Math.min(1,bend))),gap=RS.pArena||pl.dead?0:RS.ps-e.rs;
  return[navWant(e,p.x,p.z,dt),e.rspd*(gap>50?1.07:gap<-70?.92:1)*(1-.3*Math.min(1,bend/1.3))]}
// Who a rig shoots at: on the track, the nearest racer within reach; in the arena, the nearest racer who is in it too
function raceTarget(e){let best=null,bd=e.arena?1e9:55;
  if(!pl.dead&&RS.phase!=='grid'&&RS.pArena===e.arena){const d=Math.hypot(car.x-e.x,car.z-e.z);if(d<bd){bd=d;best=PLT}}
  for(const o of RS.racers)if(o!==e&&!o.dead&&o.arena===e.arena){const d=Math.hypot(o.x-e.x,o.z-e.z);if(d<bd){bd=d;best=o}}
  if(best===PLT){PLT.x=car.x;PLT.y=car.y;PLT.z=car.z;PLT.h=car.h;PLT.v=car.v}return best}
// Buggy on the track. In the arena: mech up close or when the shells run out (the shield bash needs none), buggy otherwise.
function raceWantMode(e,d,tg){if(!e.arena)return 0;if(!tg||e.modeT<4)return e.mode;if(e.ammo<=0)return 2;return d<16?2:d>24?0:e.mode}
// May it fire now? Costs a shell. On the track a rig only spends what it holds above a reserve that grows toward the arena.
function raceFire(e){if(e.ammo<=0||RS.phase==='grid')return false;
  if(!e.arena){if(e.fireT>0||e.ammo<=6+30*e.rs/TRK.len)return false;e.fireT=rnd(2.5,5)}
  e.ammo--;return true}

// ---------- Player's cannon: one shell per shot (called from fire() in js/main.js)
function raceAmmo(){if(RS.phase==='grid')return false;
  if(RS.ammo<=0){reloadT=.35;if(clock-RS.dryT>2.5){RS.dryT=clock;toast('Out of ammo · grab crates, bash (F) or send the bike (5)',2.2)}
    if(audio()){const t=AC.currentTime;nz(t,.05,4200,1800,.3,'bandpass');th(t,900,700,.04,.12)}return false}
  RS.ammo--;return true}

function racePos(){let ahead=0,n=1;for(const o of RS.racers){if(o.dead)continue;n++;if(RS.pArena?o.arena&&o.place<RS.place:o.arena||o.rs>RS.ps)ahead++}return[ahead+1,n]}

// ---------- Per frame (missionTick)
function raceTick(dt){const T=TRK,A=MAP.arena,len=T.len;MS.phase=RS.phase;
  // countdown on the grid
  if(RS.phase==='grid'){RS.cd-=dt;car.v=0;const n=Math.ceil(RS.cd);if(n!==RS.cdN){RS.cdN=n;if(n>=1&&n<=3){big(String(n),.7);raceBeep(620)}}
    if(RS.cd<=0){RS.phase='race';big('GO!',.9);raceBeep(1040,.45,.35)}}
  else if(!RS.pArena)RS.t+=dt;
  // ammo crates: bob, respawn, the player drives through them
  const cx=cam.position.x,cz=cam.position.z;
  for(const c of RS.crates){if(c.t>0){c.t-=dt;c.g.visible=false;if(c.t>0)continue}
    c.g.visible=Math.hypot(c.x-cx,c.z-cz)<150;if(c.g.visible){c.g.rotation.y+=dt*1.6;c.g.position.y=gh(c.x,c.z)+.62+.12*Math.sin(clock*3+c.ph);c.gl.material.opacity=.55+.3*Math.sin(clock*6+c.ph)}
    if(!pl.dead&&RS.phase!=='grid'&&Math.hypot(car.x-c.x,car.z-c.z)<RACE.pick){c.t=RACE.respawn;c.g.visible=false;RS.ammo+=RACE.crate;RS.got+=RACE.crate;
      ammoPill.classList.remove('got');void ammoPill.offsetWidth;ammoPill.classList.add('got');if(audio()){const t=AC.currentTime;th(t,1500,1900,.06,.2);th(t+.07,2100,2700,.07,.16)}}}
  // the player's progress along the route, and the gate
  if(!RS.pArena&&!pl.dead){const[i,d]=trkNear(car.x,car.z,RS.pi,12,30);
    if(d<24){RS.pi=i;RS.ps=i*T.step;RS.offT=0;const h=T.h[i];RS.plat=-((car.x-T.x[i])*Math.sin(h)+(car.z-T.z[i])*Math.cos(h))}else RS.offT+=dt;
    if(Math.abs(car.x)<A.half+1&&Math.abs(car.z)<A.half+1){if(RS.ps>=len-60)raceArrive(null);
      else{car.x=-A.half-3;car.v=Math.min(car.v,0)-3;if(clock-RS.gateT>2){RS.gateT=clock;toast('Gate locked · drive the whole route first',2.5)}}}}
  // rivals: progress, crates, overtaking, arrival
  let alive=0;
  for(const e of RS.racers){
    if(e.dead){if(e.glow)e.glow.visible=false;if(!e.told){e.told=true;const n=RS.racers.filter(o=>!o.dead).length;if(!pl.dead)toast(`${e.name} is wrecked`+(n?` · ${n} rival${n>1?'s':''} left`:''),2.6)}continue}
    alive++;e.fireT-=dt;if(e.arena||RS.phase==='grid')continue;
    const[i]=trkNear(e.x,e.z,e.ri,6,25);e.ri=i;e.rs=i*T.step;
    e.crT-=dt;if(e.crT<=0){e.crT=.25;let best=null; // head for the next crate, pull out to pass whoever is in the way
      for(const c of RS.crates)if(c.t<=0&&c.s>e.rs+5&&c.s<e.rs+38&&(!best||c.s<best.s||(c.s===best.s&&Math.abs(c.lat-e.lane)<Math.abs(best.lat-e.lane))))best=c;
      e.laneT=best?best.lat:e.home;
      const pass=(os,ol)=>{const ds=os-e.rs;if(ds>1&&ds<13&&Math.abs(ol-e.laneT)<2.8)e.laneT=Math.max(-5,Math.min(5,ol+(ol>0?-4.2:4.2)))};
      RS.racers.forEach(o=>{if(o!==e&&!o.dead&&!o.arena)pass(o.rs,o.lane)});if(!pl.dead&&!RS.pArena)pass(RS.ps,RS.plat)}
    for(const c of RS.crates)if(c.t<=0&&Math.abs(c.s-e.rs)<8&&Math.hypot(c.x-e.x,c.z-e.z)<RACE.pick+.3){c.t=RACE.respawn;c.g.visible=false;e.ammo+=RACE.crate}
    // wedged somewhere for a while: back onto the centreline
    e.slowT=Math.abs(e.v)<1.5&&!e.run?e.slowT+dt:0;if(e.slowT>5){e.slowT=0;const p=trkAt(T,e.rs+6);e.x=p.x;e.z=p.z;e.h=p.h;e.lane=e.laneT=0;e.path=null}
    if(e.rs>=len-16)raceArrive(e)}
  // arena: the gate closes on the stragglers; sudden death once the fight drags on
  if(RS.arenaOn){RS.arenaT+=dt;
    if(!RS.shut&&RS.arenaT>=RACE.gate){RS.shut=true;dmgBy='enemy';RS.racers.forEach(e=>{if(!e.dead&&!e.arena){e.told=true;killEnemy(e,false);if(RS.pArena)toast(`${e.name} is locked out`,2.2)}});dmgBy='player';alive=RS.racers.filter(e=>!e.dead).length;
      if(!RS.pArena&&!pl.dead){endRun('raceLost','The arena gate closed before you got there.');return}}
    if(RS.arenaT>RACE.sudden){if(RS.sdT===0)toast('Sudden death: every rig in the arena is losing hull!',4);RS.sdT+=dt;
    if(RS.sdT>=1){RS.sdT-=1;dmgBy='enemy';RS.racers.forEach(e=>{if(!e.dead&&e.arena)damageEnemy(e,3/e.armor())});dmgBy='player';if(RS.pArena&&!pl.dead)damagePlayer(3)}}}
  if(!alive&&!pl.dead&&RS.phase!=='grid')endRun('raceWon');
  if(bigT>0){bigT-=Math.max(dt,1/120);if(bigT<=0)bigEl.classList.remove('show')}
  setText(ammoN,String(RS.ammo));ammoPill.classList.toggle('dry',RS.ammo<=0)}

// ---------- HUD text and the briefing / result card (js/mission.js)
const raceClock=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
function raceHud(){const[pos,n]=racePos(),left=RS.racers.filter(o=>!o.dead).length;
  if(RS.phase==='grid')return['Neon Run · get ready','No ammo on board: collect the crates. Buggy and mech only.'];
  if(RS.phase==='arena')return[`Arena · ${left} rival${left===1?'':'s'} left`,(RS.arenaT>RACE.sudden?'SUDDEN DEATH · ':'Last rig standing wins · ')+(RS.ammo?RS.ammo+' shells':'out of ammo: bash (F)')];
  return[`Race · ${ORD[pos]} of ${n} · ${Math.min(99,Math.floor(RS.ps/TRK.len*100))}%`,RS.offT>1.5?'Off the route! Head back to the yellow marker.':RS.arenaOn?`The arena gate closes in ${Math.max(0,Math.ceil(RACE.gate-RS.arenaT))} s! · ${RS.ammo} shells`:`${raceClock(RS.t)} · ${RS.ammo} shells · the arena is the finish line`]}
function raceCard(){const over=MS.result!=null,won=MS.result==='raceWon';
  return{t:over?(won?'Last rig standing':'Wrecked'):'Neon Run',
    sub:over?(won?'You won the arena. Everything you salvaged is banked.':MS.reason+' You keep half the scrap from this run.')
      :'A point-to-point race through the neon city against <b style="color:#ff5a7a">four rival rigs</b>. The finish line is the gate of a <b>multi-level arena</b>, where everyone who made it fights until one rig is left standing. '
       +'Your cannon starts <b>empty</b>: every shell comes from the <b style="color:#19e6ff">ammo crates</b> on the road (+'+RACE.crate+' each). Spend them on the way to thin the field, or save them for the arena: what you collect is all you get. '
       +'<b>Buggy and mech only</b>. The RC bike can be launched <b>once</b>, as a bomb, and no turrets guard your rig while you drive it. The first three into the arena get hull repaired (60 / 40 / 20%), and the gate closes '+RACE.gate+' s after the first rig is in.',
    stats:over?`<div><b>${RS.place?ORD[RS.place]:'–'}</b>into the arena</div><div><b>${raceClock(RS.t)}</b>race time</div><div><b>${kills}</b>rivals wrecked</div><div><b>${RS.got}</b>shells collected</div><div><b>+${RUN.kept}</b>scrap banked</div>`:''}}
