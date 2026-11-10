// Missions: the run structure around the swarm (js/swarm.js). Phases, from MAP.mission:
//   brief (garage overlay, game paused) -> nests (destroy every foundry) -> convoy (meet the evac trucks, escort them
//   along MAP.mission.convoy.route until they leave the map) -> extract (hold in the extraction zone) -> over.
// A run is lost when the rig is wrecked or every truck dies. Maps without a convoy go straight from nests to extract.
// Salvage (scrap) drops from kills (drive over it), and comes from foundries, saved trucks and a win; a wreck keeps
// half. It's banked in localStorage and spent in the garage on rig upgrades (UPGRADES), which change hull, speed,
// reload, shell power and mech heat, and bolt visible parts onto the rig.
// Also here: enemy target choice (player or a truck), HUD markers (foundries, trucks, extraction) and the objective panel.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const MISSION=MAP.mission||{nests:1,extract:{x:MAP.start.x,z:MAP.start.z,r:7}};
const SAVE_KEY='scrapShifterSave';
const UPGRADES=[
  {id:'armor',name:'Armor plating',desc:'+15 max hull',cost:[40,80,130,190,260]},
  {id:'engine',name:'Engine',desc:'+7% drive and walk speed',cost:[35,70,115,170,230]},
  {id:'loader',name:'Autoloader',desc:'-7% reload time',cost:[45,90,140,200,270]},
  {id:'cannon',name:'Cannon',desc:'+8% shell power (damage and blast radius)',cost:[50,100,150,210,280]},
  {id:'cooling',name:'Heat sinks',desc:'-12% mech heat build-up',cost:[30,60,100,150,210]}];
const SAVE=(()=>{let s=null;try{s=JSON.parse(localStorage.getItem(SAVE_KEY))}catch(e){}s=s||{};
  return{scrap:s.scrap|0,runs:s.runs|0,up:Object.assign({armor:0,engine:0,loader:0,cannon:0,cooling:0},s.up||{})}})();
function saveGame(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(SAVE))}catch(e){}}
const RUN={n:SAVE.runs,scrap:0,nestsDown:0,trucksSaved:0,trucksLost:0,t:0};
const MS={sandbox:(()=>{try{return localStorage.getItem('scrapShifterGame')==='sandbox'}catch(e){return false}})(),phase:'brief',overlay:true,needReset:false,result:null,reason:'',endT:0,rolling:false,extractT:0,blocker:null,blockT:0,spawnT:6,bikeT:12};

// ---------- Upgrades: numbers + visible parts on the rig
const RELOAD_BASE=RELOAD.slice(),POWER_BASE=FIRE.map(f=>f[1]),rigExtra=[];
function applyUpgrades(){const u=SAVE.up;PL_MAX=100+15*u.armor;UPG.spd=1+.07*u.engine;UPG.heat=1-.12*u.cooling;
  RELOAD.forEach((_,i)=>RELOAD[i]=RELOAD_BASE[i]*(1-.07*u.loader));FIRE.forEach((f,i)=>f[1]=POWER_BASE[i]*(1+.08*u.cannon));
  rigExtra.forEach(o=>o.parent&&o.parent.remove(o));rigExtra.length=0;const put=(g,m,x,y,z,p,rz=0)=>{const o=add(g,m,x,y,z,p);o.rotation.z=rz;rigExtra.push(o);return o};
  for(let k=0;k<u.armor*2;k++){const s=k%2?1:-1,i=k>>1;put(B(.62,.34,.05),i%2?rusty:primer,-1.2+i*.6,.04,.93*s,hull,(i%3-1)*.08)} // bolted side plates
  if(u.armor>=3)put(B(1,.06,1.2),primer,-.1,.2,0,deck);
  for(let k=0;k<u.engine;k++){put(C(.07,.75,8),steel,-1.55,.62,(k-(u.engine-1)/2)*.26,hull);put(C(.09,.1,8),rusty,-1.55,1.02,(k-(u.engine-1)/2)*.26,hull)} // exhaust stacks
  for(let k=0;k<Math.ceil(u.loader/2);k++)put(C(.2,.5,12),hazard,.75,.35,(k-.5)*.45,deck); // ammo drums
  if(u.cannon){put(C(.15,.45+.1*u.cannon,12),steel,.95,0,0,gun,-PI/2);if(u.cannon>=3)put(B(.28,.34,.34),rusty,1.72,0,0,gun)} // barrel sleeve, muzzle brake
  for(let k=0;k<u.cooling;k++)put(B(.5,.04,.7),steel,-.15,.28+k*.07,0,cab); // cooling fins
  tuneEnv(root)}

// ---------- Convoy trucks: follow the route, stop for blockers, take damage, leave the map at the route's end
const TRUCK={hp:300,spd:5.5,gap:13};
const truckM=SM(metalTex('#cfcac0',1)),truckCabM=SM(metalTex('#2f5d8a',1));
const route=(MISSION.convoy?.route||[]).map(([x,z])=>({x,z}));let routeLen=0;route.forEach((p,i)=>{p.s=routeLen;if(route[i+1])routeLen+=Math.hypot(route[i+1].x-p.x,route[i+1].z-p.z)});
function routeAt(s){let i=0;while(i<route.length-2&&s>route[i+1].s)i++;const a=route[i],b=route[i+1],l=b.s-a.s,k=(s-a.s)/l;return{x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k,h:Math.atan2(-(b.z-a.z),b.x-a.x)}}
const trucks=[];
function makeTruck(i){const g=new THREE.Group();g.rotation.order='YZX';sc.add(g);
  mk(B(6.4,.3,2.2),steel,0,.78,0,g);mk(B(4.4,2.4,2.4),truckM,-1.05,2.13,0,g);mk(B(4.42,.22,2.42),hazard,-1.05,1.08,0,g);
  mk(B(1.8,1.7,2.3),truckCabM,2.3,1.6,0,g);mk(B(.06,.7,2.0),glassM,3.21,1.95,0,g);
  [-2.4,-1.1,2.3].forEach(x=>[1,-1].forEach(s=>{mk(C(.5,.36,14),tireM,x,.5,1.06*s,g).rotation.x=PI/2}));
  const lampM=new THREE.MeshStandardMaterial({color:0x0a2a10,emissive:0x40ff70,emissiveIntensity:1.5});mk(new THREE.SphereGeometry(.16,10,8),lampM,2.3,2.55,0,g);
  const t={g,lampM,i,s:-i*TRUCK.gap,x:0,y:0,z:0,h:0,v:0,pitch:0,lat:0,hp:TRUCK.hp,max:TRUCK.hp,dead:false,out:false,smokeT:0,flash:0,honkT:0,blk:null,blkT:0};
  addMark('warn',()=>MS.phase==='convoy'&&!t.dead&&!t.out&&t.blk&&t.blkT>1?_mp.set(t.blk.x,t.blk.y0+2,t.blk.z):null,()=>'Clear the road'); // whatever is stopping this truck
  t.mark=addMark('truck',()=>t.dead||t.out||MS.phase!=='convoy'?null:_mp.set(t.x,t.y+4,t.z),()=>MS.rolling?'Truck':'Convoy',()=>t.hp/t.max);
  truckPlace(t,1);tuneEnv(g);trucks.push(t);return t}
function truckPlace(t,k){const p=routeAt(t.s);t.h=p.h;t.x=p.x+Math.sin(p.h)*t.lat;t.z=p.z+Math.cos(p.h)*t.lat;
  const fx=Math.cos(t.h),fz=-Math.sin(t.h),hf=gh(t.x+fx*2.6,t.z+fz*2.6),hb=gh(t.x-fx*2.6,t.z-fz*2.6);
  t.pitch+=(Math.atan2(hf-hb,5.2)-t.pitch)*k;t.y+=((hf+hb)/2-t.y)*k;t.g.position.set(t.x,t.y,t.z);t.g.rotation.set(0,t.h,t.pitch)}
function damageTruck(t,d){if(t.dead||t.out||d<=0)return;t.hp-=d;t.flash=1;if(t.hp>0)return;
  t.hp=0;t.dead=true;RUN.trucksLost++;t.g.traverse(o=>{if(o.isMesh)o.material=charM});explode(new THREE.Vector3(t.x,t.y+1.5,t.z),1.6);toast('Convoy truck destroyed!',3)}
function truckBlast(p,pw){const R=2.3*pw+1.2;trucks.forEach(t=>{if(t.dead||t.out)return;const d=Math.max(0,Math.hypot(p.x-t.x,p.y-(t.y+1.5),p.z-t.z)-1.6);if(d<R)damageTruck(t,EN_DMG*1.15*pw*(1-d/R)*foeK())})}
function truckShotHit(sp){for(const t of trucks){if(t.out)continue;const dx=sp.x-t.x,dz=sp.z-t.z,lx=dx*Math.cos(t.h)-dz*Math.sin(t.h),lz=dx*Math.sin(t.h)+dz*Math.cos(t.h);
  if(Math.abs(lx)<3.3&&Math.abs(lz)<1.25&&sp.y>t.y&&sp.y<t.y+3.4)return true}return false}
// What's in the road ahead of a truck: an intact blocking piece (barrier, wall) or a living enemy
function truckBlocked(t){const a=routeAt(t.s+6);a.x+=Math.sin(a.h)*t.lat;a.z+=Math.cos(a.h)*t.lat;const q=_mp.set(a.x,gh(a.x,a.z)+1,a.z);
  for(const pc of piecesNear(a.x,a.z,3))if(pc.blocks&&pc.state<2&&pieceDist(pc,q)<1.5)return pc;
  for(const e of enemies)if(!e.dead&&Math.hypot(e.x-a.x,e.z-a.z)<4)return e;
  if(!pl.dead&&!gyroAir()&&Math.hypot(car.x-a.x,car.z-a.z)<4){if(clock-t.honkT>3&&audio()){t.honkT=clock;const k=AC.currentTime;th(k,330,320,.35,.12);th(k,415,405,.35,.1)}return 'player'}
  return null}
function convoyTick(dt){if(!trucks.length)return;
  const lead=trucks.find(t=>!t.dead&&!t.out);if(!MS.rolling&&lead&&!pl.dead&&Math.hypot(car.x-lead.x,car.z-lead.z)<35){MS.rolling=true;toast('Convoy rolling. Keep the trucks alive!',3)}
  MS.blocker=null;
  trucks.forEach(t=>{if(t.out)return;
    if(t.dead){t.lat+=(4.5-t.lat)*Math.min(1,dt*1.5);truckPlace(t,1);return} // wrecks get shoved to the roadside
    let want=MS.rolling?TRUCK.spd:0;const front=trucks.filter(o=>!o.dead&&!o.out&&o.s>t.s).sort((a,b)=>a.s-b.s)[0];
    if(front&&front.s-t.s<TRUCK.gap)want=Math.min(want,Math.max(0,(front.s-t.s-8)*.8));
    let b=null;if(want>0){b=truckBlocked(t);if(b)want=0}const pb=b&&b.kind?b:null;t.blkT=pb&&pb===t.blk?t.blkT+dt:0;t.blk=pb;if(pb&&t.blkT>1)MS.blocker=pb;
    t.v+=(want-t.v)*Math.min(1,dt*1.5);t.s+=t.v*dt;truckPlace(t,Math.min(1,dt*6));
    t.flash=Math.max(0,t.flash-dt*3);t.lampM.emissiveIntensity=t.flash>0?4:1.2+.8*Math.sin(clock*5+t.i);
    if(t.hp<t.max*.5){t.smokeT-=dt;if(t.smokeT<=0){t.smokeT=.15;smoke(new THREE.Vector3(t.x,t.y+3.4,t.z),new THREE.Vector3(rnd(-.3,.3),rnd(1.5,2.5),rnd(-.3,.3)),0x26221e,.5,2.6,rnd(2.5,4),.55)}}
    // solid: the rig and enemies get pushed off the truck (two circles along its length)
    [-1.9,1.9].forEach(o=>{const cx=t.x+Math.cos(t.h)*o,cz=t.z-Math.sin(t.h)*o;pushOut(car,cx,cz,CR+1.35);enemies.forEach(e=>{if(!e.dead)pushOut(e,cx,cz,(e.r||1.5)+1.35)})});
    if(t.s>=routeLen){t.out=true;sc.remove(t.g);RUN.trucksSaved++;RUN.scrap+=25;toast(`Truck ${RUN.trucksSaved} is out! +25 scrap`,2.5)}});
  MS.blockT=MS.blocker?2:0;
  if(trucks.every(t=>t.dead||t.out)){if(RUN.trucksSaved)startExtract();else endRun('lost','The whole convoy was destroyed.')}}

// ---------- Enemy targets: the player or (once the convoy rolls) the nearest truck; bikes go for trucks first
const PLT={x:0,y:0,z:0,h:0,v:0,pl:true},RCT={x:0,y:0,z:0,h:0,v:0,rc:true}; // target proxies: the player rig, the RC bike
function enemyTarget(e){let best=null,bd=1e9;if(!pl.dead&&!(e.type==='bike'&&gyroAir())){ // bikes can't reach a flying gyro
  PLT.x=car.x;PLT.y=car.y;PLT.z=car.z;PLT.h=car.h;PLT.v=car.v;best=PLT;bd=Math.hypot(car.x-e.x,car.z-e.z)}
  if(rcOut()){const d=Math.hypot(RC.x-e.x,RC.z-e.z);if(d<bd){bd=d;RCT.x=RC.x;RCT.y=RC.y;RCT.z=RC.z;RCT.h=RC.h;RCT.v=RC.v;best=RCT}} // the RC bike draws fire when it is the nearer one
  if(MS.rolling)for(const t of trucks){if(t.dead||t.out)continue;const d=Math.hypot(t.x-e.x,t.z-e.z)*(e.type==='bike'?.6:.9);if(d<bd){bd=d;best=t}}
  return best}

// ---------- Scrap pickups
const pickups=[],pickGeo=B(.36,.2,.28);
function dropScrap(x,z,amt){const g=new THREE.Group();g.position.set(x,gh(x,z)+.25,z);sc.add(g);
  for(let k=0;k<4;k++){const o=mk(pickGeo,k%2?rusty:steel,rnd(-.3,.3),rnd(0,.25),rnd(-.3,.3),g);o.rotation.set(rnd(0,3),rnd(0,3),rnd(0,3))}
  const gl=S(glowT,0xffd27a,true,.9,1.5);gl.position.y=.6;g.add(gl);pickups.push({g,gl,x,z,amt,t:0})}
function pickupsTick(dt){for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.t+=dt;const d=Math.hypot(car.x-p.x,car.z-p.z);
  if(!pl.dead&&d<8){const k=Math.min(d,dt*(10+30/(d+.5)));p.x+=(car.x-p.x)/d*k;p.z+=(car.z-p.z)/d*k} // magnet
  p.g.position.set(p.x,gh(p.x,p.z)+.25+.12*Math.sin(p.t*3),p.z);p.g.rotation.y+=dt*1.5;p.gl.material.opacity=.6+.35*Math.sin(p.t*6);
  if((!pl.dead&&d<2.2)||p.t>90){if(p.t<=90){RUN.scrap+=p.amt;if(audio()){const t=AC.currentTime;th(t,1900,1300,.07,.16);th(t+.06,2500,1800,.07,.12)}}sc.remove(p.g);pickups.splice(i,1)}}}

// ---------- HUD markers: bracket on screen, arrow at the edge when off screen; label + distance; optional health bar
const marks=[],marksEl=document.getElementById('marks'),_mp=new THREE.Vector3(),_mv=new THREE.Vector3();
function addMark(cls,pos,label,hp){const el=document.createElement('div');el.className='mk '+cls;el.innerHTML='<i class="br"></i><i class="ar"></i><span></span><b><u></u></b>';marksEl.appendChild(el);
  const m={el,pos,label,hp,ar:el.querySelector('.ar'),txt:el.querySelector('span'),bw:el.querySelector('b'),bar:el.querySelector('u')};marks.push(m);return m}
function clearMarks(keep){for(let i=marks.length-1;i>=0;i--){if(keep&&keep.includes(marks[i]))continue;marks[i].el.remove();marks.splice(i,1)}}
function marksTick(){const r=cv.getBoundingClientRect(),pad=40,hw=r.width/2,hh=r.height/2;
  marks.forEach(m=>{const p=m.pos();if(!p||MS.overlay){m.el.style.display='none';return}m.el.style.display='block';const dist=Math.hypot(p.x-car.x,p.z-car.z);
    _mv.copy(p).project(cam);let nx=_mv.x,ny=_mv.y;const behind=_mv.z>1;if(behind){nx=-nx;ny=-ny}
    let sx=hw+nx*hw,sy=hh-ny*hh;const off=behind||sx<pad||sx>r.width-pad||sy<pad||sy>r.height-pad;
    if(off){let dx=sx-hw,dy=sy-hh;if(Math.hypot(dx,dy)<1)dy=1;const k=Math.min((hw-pad)/Math.max(Math.abs(dx),1e-6),(hh-pad)/Math.max(Math.abs(dy),1e-6));sx=hw+dx*k;sy=hh+dy*k;m.ar.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`}
    m.el.classList.toggle('off',off);m.el.style.left=(r.left+sx)+'px';m.el.style.top=(r.top+sy)+'px';
    const t=m.label()+' · '+Math.round(dist)+' m';if(m.txt.textContent!==t)m.txt.textContent=t;
    const h=m.hp?m.hp():null;m.bw.style.display=h==null?'none':'block';if(h!=null)m.bar.style.width=Math.max(0,h*100)+'%'})}

// ---------- Extraction zone
let extractObjs=[];
function startExtract(){if(MS.phase==='extract'||MS.phase==='over')return;MS.phase='extract';MS.extractT=0;const X=MISSION.extract;
  const ring=new THREE.Mesh(new THREE.RingGeometry(X.r-.6,X.r,48).rotateX(-PI/2),new THREE.MeshBasicMaterial({color:0x22e6ff,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  ring.position.set(X.x,gh(X.x,X.z)+.15,X.z);sc.add(ring);extractObjs=[ring,makeBeacon(X.x,gh(X.x,X.z),X.z,0x22e6ff,X.r*.35,90)];
  addMark('ext',()=>MS.phase==='extract'?_mp.set(X.x,gh(X.x,X.z)+3,X.z):null,()=>'Extract');
  toast(MISSION.convoy?'Convoy is clear. Get to the extraction zone!':'Foundries down. Get to the extraction zone!',3.5)}

// ---------- Run flow
function nestDown(n){RUN.nestsDown++;RUN.scrap+=60;const left=nests.filter(x=>!x.dead).length;
  toast(left?`Foundry destroyed! +60 scrap (${left} left)`:'All foundries destroyed! +60 scrap',3.5);
  if(!left&&MS.phase==='nests'){if(route.length>1){MS.phase='convoy';MS.rolling=false;for(let i=0;i<(MISSION.convoy.trucks||3);i++)makeTruck(i);
    setTimeout(()=>{if(MS.phase==='convoy'&&!MS.rolling)toast('Evac convoy is waiting. Meet it at the green marker.',4)},3600)}else startExtract()}}
function endRun(result,reason){if(MS.phase==='over')return;MS.phase='over';MS.result=result;MS.reason=reason;MS.endT=2.2;
  if(result==='won')RUN.scrap+=50;const kept=result==='won'||result==='sandbox'?RUN.scrap:Math.floor(RUN.scrap/2); // sandbox banks everythingRUN.kept=kept;SAVE.scrap+=kept;SAVE.runs++;saveGame();
  toast(result==='won'?'Mission complete!':result==='sandbox'?'Wrecked! Peak wanted '+STARS(WANT.peak):reason,4)}
function resetMission(){clearNests();trucks.forEach(t=>sc.remove(t.g));trucks.length=0;pickups.forEach(p=>sc.remove(p.g));pickups.length=0;extractObjs.forEach(o=>sc.remove(o));extractObjs=[];clearMarks();
  Object.assign(RUN,{n:SAVE.runs,scrap:0,nestsDown:0,trucksSaved:0,trucksLost:0,t:0});Object.assign(MS,{rolling:false,extractT:0,blocker:null,blockT:0,spawnT:6,bikeT:12,result:null});resetWanted();
  if(!MS.sandbox)pickNestBuildings(MISSION.nests||1,MAP.seed*7919+RUN.n*104729).forEach((b,i)=>{const n=makeNest(b,i);addMark('nest',()=>n.dead?null:nestCore(n).setY(n.y+n.stackH+2),()=>'Foundry'+(n.stage?' +'+n.stage:''),()=>n.hp/n.max)})}
function missionTick(dt){
  if(MS.overlay)return;
  if(MS.phase==='over'){MS.endT-=dt;if(MS.endT<=0)showOverlay();return}
  RUN.t+=dt;swarmTick(dt);convoyTick(dt);pickupsTick(dt);if(MS.phase==='sandbox')wantedTick(dt);
  if(pl.dead){MS.deadT=(MS.deadT||0)+dt;if(MS.deadT>2.5)endRun(MS.sandbox?'sandbox':'lost','Your rig was wrecked.')}else MS.deadT=0;
  // after the foundries fall, the swarm counter-attacks from the map edge (crawlers and bikes go for the convoy)
  if(MS.phase==='convoy'||MS.phase==='extract'){const busy=MS.phase==='convoy'&&MS.rolling;MS.spawnT-=dt;MS.bikeT-=dt;
    if(MS.spawnT<=0&&enemies.filter(e=>!e.dead&&e.type==='crawler').length<(busy?3:2)){spawnEnemy();MS.spawnT=busy?9:14}
    if(MS.bikeT<=0&&!enemies.some(e=>!e.dead&&e.type==='bike')){makeBike(...spawnPoint());MS.bikeT=busy?12:18}}
  if(MS.phase==='extract'){const X=MISSION.extract;if(!pl.dead&&Math.hypot(car.x-X.x,car.z-X.z)<X.r){MS.extractT+=dt;if(MS.extractT>=3)endRun('won')}else MS.extractT=Math.max(0,MS.extractT-dt*2)}
  objectiveHud()}

// ---------- HUD: objective panel, scrap counter
const objT=document.getElementById('objT'),objS=document.getElementById('objS'),scrapN=document.getElementById('scrapN'),objEl=document.getElementById('obj');
function setText(el,t){if(el.textContent!==t)el.textContent=t}
function objectiveHud(){let a='',b='';const total=nests.length;
  if(MS.phase==='sandbox')[a,b]=wantedHud();
  if(MS.phase==='nests'){a=`Destroy the swarm foundries: ${RUN.nestsDown}/${total}`;const g=Math.max(0,...nests.filter(n=>!n.dead).map(n=>n.stage));
    b=g?`Rubble is feeding them (growth ${g}/5). Fire denies the material.`:'Follow the red beacons. Rubble near a foundry feeds it; burning denies it.'}
  else if(MS.phase==='convoy'){const alive=trucks.filter(t=>!t.dead&&!t.out).length;
    a=MS.rolling?`Escort the convoy: ${alive} rolling, ${RUN.trucksSaved} out`:'Meet the evac convoy (green marker)';
    b=MS.blocker&&MS.blockT>1?'The road is blocked. Destroy the obstacle!':MS.rolling?'Swarm units are hunting the trucks.':'It rolls once you reach it.'}
  else if(MS.phase==='extract'){a='Reach the extraction zone (cyan marker)';b=MS.extractT>0?`Extracting… ${Math.min(3,MS.extractT).toFixed(1)} / 3 s`:'Hold inside the ring for 3 s.'}
  setText(objT,a);setText(objS,b);setText(scrapN,String(RUN.scrap))}

// ---------- Overlay: briefing / debrief + garage
const ovl=document.getElementById('ovl');
function showOverlay(){MS.overlay=true;firing=false;for(const k in keys)keys[k]=false;ovl.classList.add('show');objEl.style.display='none';renderOverlay()}
function renderOverlay(){const over=MS.result!=null,won=MS.result==='won',sb=MS.result==='sandbox';
  document.querySelectorAll('#gmode button').forEach(b=>b.classList.toggle('on',(b.dataset.gm==='sandbox')===MS.sandbox));
  document.getElementById('ovlT').textContent=over?(won?'Mission complete':sb?'Sandbox over':'Run lost'):MS.sandbox?'Sandbox':'Scrap Shifter';
  document.getElementById('ovlSub').innerHTML=over?(won?'The town is clear and the convoy got out.':sb?'Your rig was wrecked. Everything you salvaged is banked.':MS.reason+' You keep half the scrap from this run.')
    :MS.sandbox?'No objective: wreck the town. Every building, car and machine you destroy raises your <b>wanted level</b>. '
     +'The swarm answers with crawlers and rushers at first; from <b>★★★</b> it sends <b style="color:#ff5a7a">rival rigs</b>, machines like yours that transform between all four modes. '
     +'Lie low for 20 s and the heat drains away. Scrap you salvage is banked when your rig is wrecked.'
    :'The Scrap is a machine swarm that strips towns for parts and builds more of itself. Its <b>foundries</b> nest inside buildings: follow the <b style="color:#ff6a4a">red beacons</b>. '
     +'Rubble feeds them, so every building you bring down near a living foundry makes it grow and spawn faster. Burning denies the material. Shell them, breach them with the mech, or burn them out.'
     +(MISSION.convoy?' Then escort the evac convoy out along the highway and extract.':' Then extract.');
  const tm=Math.floor(RUN.t/60)+':'+String(Math.floor(RUN.t%60)).padStart(2,'0');
  document.getElementById('ovlStats').innerHTML=over&&sb?`<div><b>${tm}</b>survived</div><div><b>${STARS(WANT.peak)}</b>peak wanted</div><div><b>${kills}</b>kills</div><div><b>${WANT.rigKills}</b>rival rigs</div><div><b>+${RUN.kept}</b>scrap banked</div>`
    :over?`<div><b>${RUN.nestsDown}/${nests.length}</b>foundries</div>`+(MISSION.convoy?`<div><b>${RUN.trucksSaved}</b>trucks saved</div>`:'')+`<div><b>${kills}</b>kills</div><div><b>+${RUN.kept}</b>scrap banked</div>`:'';
  document.getElementById('bank').textContent=SAVE.scrap;
  document.getElementById('ups').innerHTML=UPGRADES.map(u=>{const lv=SAVE.up[u.id],cost=u.cost[lv];
    return`<div class="up"><div><b>${u.name}</b><small>${u.desc}</small></div><div class="pips">${[0,1,2,3,4].map(i=>`<i class="${i<lv?'on':''}"></i>`).join('')}</div>`
      +`<button data-up="${u.id}" ${cost==null||cost>SAVE.scrap?'disabled':''}>${cost==null?'Max':cost+' scrap'}</button></div>`}).join('');
  document.getElementById('deploy').innerHTML=(over?'Next run':'Deploy')+'<kbd>Enter</kbd>'}
document.getElementById('gmode').addEventListener('click',e=>{const m=e.target.closest('button')?.dataset.gm;if(!m)return;const sb=m==='sandbox';if(sb===MS.sandbox)return;
  MS.sandbox=sb;MS.needReset=true;try{localStorage.setItem('scrapShifterGame',m)}catch(err){}MS.result=null;renderOverlay()}); // mission / sandbox picker (applies on deploy)
document.getElementById('ups').addEventListener('click',e=>{const id=e.target.dataset?.up;if(!id)return;const u=UPGRADES.find(x=>x.id===id),lv=SAVE.up[id],cost=u.cost[lv];
  if(cost==null||cost>SAVE.scrap)return;SAVE.scrap-=cost;SAVE.up[id]++;saveGame();applyUpgrades();if(!MS.needReset)pl.hp=PL_MAX;renderOverlay();
  if(audio()){const t=AC.currentTime;nz(t,.25,3200,600,.4,'bandpass');th(t+.1,220,90,.2,.4)}});
function deploy(){if(!MS.overlay)return;ovl.classList.remove('show');objEl.style.display='';if(MS.needReset)resetField();MS.needReset=true;MS.overlay=false;MS.phase=MS.sandbox?'sandbox':'nests';
  toast(MS.sandbox?'Sandbox: wreck the town. Watch your wanted level.':`Destroy ${nests.length} foundr${nests.length>1?'ies':'y'}. Follow the red beacons.`,4)}
document.getElementById('deploy').onclick=deploy;
function missionInit(){applyUpgrades();pl.hp=PL_MAX;resetMission();showOverlay()}
