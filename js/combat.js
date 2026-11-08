// Health, blast damage, enemy crawlers.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Combat: health, blast damage, enemy crawlers ----------
// Blast damage falls off linearly to 0 at 2.3*power + 1.2 m. The player takes extra damage mid-transform.
const PL_H=[2.2,2.6,5.2,1.9],ARMOR=[1.25,.7,.85,1.4],TRANSFORM_ARMOR=1.5,PL_DMG=45,EN_DMG=60,EN_HP=60,ENEMY_MAX=2;
const EN_SHELL={spd:22,pw:.85},EN_RANGE=48,EN_PREF=[14,26]; // shell, engage range, preferred band
const pl={hp:100,dead:false,lastHit:-99,slump:0};let kills=0,PL_MAX=100; // PL_MAX grows with armor upgrades (js/mission.js)
const enemies=[];let spawnT=4,bikeT=20; // first crawler rolls in after a few seconds, the next 8s later
const hpFill=document.getElementById('hpFill'),hpNum=document.getElementById('hpNum'),killsEl=document.getElementById('kills'),hurtEl=document.getElementById('hurt'),toastEl=document.getElementById('toast'),ebars=document.getElementById('ebars');
let toastT=0;function toast(m,s=2.5){toastEl.textContent=m;toastEl.classList.add('show');toastT=s}
let hurtA=0;
function hitClank(p,pw){if(!audio())return;const t=AC.currentTime+cam.position.distanceTo(p)/343;nz(t,.25,3200,500,.5*pw,'bandpass');th(t,240,70,.18,.35*pw)}
function sparks(p,n){for(let i=0;i<n;i++)ember(p.clone(),new THREE.Vector3(rnd(-1,1),rnd(.3,1.2),rnd(-1,1)).normalize().multiplyScalar(rnd(4,9)),rnd(.3,.8))}
// Mech shield: blasts arriving from the front arc (from 57° left to 75° right, the shield side) do SHIELD_BLOCK of their damage
const SHIELD_BLOCK=.25,SHIELD_ARC=[-1,1.3],RAM_DMG=35;
function shieldBlocks(from){if(!from||mode!==2||run)return false;const dx=from.x-car.x,dz=from.z-car.z;if(Math.hypot(dx,dz)<.8)return false;
  const a=Math.atan2(dx*Math.sin(car.h)+dz*Math.cos(car.h),dx*Math.cos(car.h)-dz*Math.sin(car.h)); // 0 = dead ahead, + = right/shield side
  return a>SHIELD_ARC[0]&&a<SHIELD_ARC[1]}
function damagePlayer(d,from){if(pl.dead)return;d*=run?TRANSFORM_ARMOR:ARMOR[mode];
  if(shieldBlocks(from)){d*=SHIELD_BLOCK;const q=new THREE.Vector3();ARM.shield.o.getWorldPosition(q);sparks(q,14);
    if(audio()){const t=AC.currentTime;nz(t,.35,5200,1800,.55,'bandpass');th(t,620,300,.3,.3)}} // bright clang off the plate
  else{sparks(new THREE.Vector3(car.x,car.y+1.2,car.z),8);hitClank(root.position,1)}
  pl.hp-=d;pl.lastHit=clock;hurtA=Math.min(1,hurtA+d/30);trauma=Math.min(1,trauma+d/60);
  if(pl.hp<=0){pl.hp=0;pl.dead=true;AIM.pending=false;firing=false;
    explode(new THREE.Vector3(car.x,car.y+.8,car.z),1.4);slowT=.35;
    let tt=0;addFx(null,14,(f,k,dt)=>{tt+=dt;if(tt>.12&&pl.dead){tt=0;const q=new THREE.Vector3(car.x+rnd(-.6,.6),car.y+1,car.z+rnd(-.6,.6));fireball(q,new THREE.Vector3(0,rnd(1,2),0),.35,.9*(1-k),rnd(.4,.7));smoke(q.clone().setY(q.y+.8),new THREE.Vector3(rnd(-.2,.2),rnd(1.5,2.5),rnd(-.2,.2)),0x221F1B,.7,3.2,rnd(4,6),.6)}});
    toast('Wrecked!',3)}}
function damageEnemy(e,d){if(e.dead)return;if(e.armor)d*=e.armor();e.hp-=d; // rigs: per-mode armore.flash=1;sparks(new THREE.Vector3(e.x,e.y+1,e.z),8);hitClank(e.g.position,.8);
  if(e.hp<=0)killEnemy(e,true)}
function killEnemy(e,credit){e.hp=0;e.dead=true;e.deadT=0;e.bar.style.display='none';if(credit){kills++;killsEl.textContent=kills}
  e.g.traverse(o=>{if(o.isMesh)o.material=charM});const bike=e.type==='bike',rig=e.type==='rig';
  explode(new THREE.Vector3(e.x,e.y+(bike?.9:.8),e.z),bike?BIKE.pw:rig?2.2:1.5);if(rig)rigDie(e);
  if(credit){toast(bike?'Rusher down':rig?'Rival rig destroyed!':'Crawler destroyed');dropScrap(e.x,e.z,bike?5:rig?40:10);wantedKill(e)}}
function applyBlast(p,pw,heavy){const R=2.3*pw+1.2;if(heavy)structHits(p);
  if(!pl.dead){const d=Math.hypot(p.x-car.x,p.y-(car.y+1),p.z-car.z);if(d<R)damagePlayer(PL_DMG*pw*(1-d/R),p)}
  enemies.slice().forEach(e=>{if(e.dead)return;const d=Math.hypot(p.x-e.x,p.y-(e.y+.8),p.z-e.z);if(d<R)damageEnemy(e,EN_DMG*pw*(1-d/R))});
  piecesNear(p.x,p.z,R).forEach(pc=>{const d=pieceDist(pc,p);if(d<R)damagePiece(pc,STRUCT_DMG*pw*(1-d/R),p)});
  nestBlast(p,pw);truckBlast(p,pw)} // swarm foundries (swarm.js), convoy trucks (mission.js)
function spawnShell(p,v,pw,owner,r,col,gs){const s=mk(new THREE.SphereGeometry(r,10,8),steel,p.x,p.y,p.z);s.add(S(glowT,col,true,.9,gs));const sh={m:s,pw,v,tt:0,owner};shots.push(sh);return sh}
// Step a shell forward without spawning it; returns where it would land (used for enemy incoming warnings)
function simShell(p,v,owner){p=p.clone();v=v.clone();const h=1/60;for(let i=0;i<900;i++){v.y-=9.8*h;p.addScaledVector(v,h);if(shotHits(p,owner))return p}return null}

// --- Enemy model: a low tracked crawler with a plow blade, red-painted hull and a red sensor lamp
const hostile=SM(metalTex('#5c2a22',5)),charM=new THREE.MeshStandardMaterial({color:0x1d1a17,roughness:1,metalness:.1});
const warnGeo=new THREE.RingGeometry(1.6,1.9,40).rotateX(-PI/2);
function makeEnemy(x,z){const g=new THREE.Group();g.rotation.order='YZX';sc.add(g);
  mk(B(2.6,.7,1.6),hostile,0,.75,0,g);mk(B(1.1,.4,1.3),rusty,-.6,1.25,0,g);mk(C(.12,.6,8),steel,-.9,1.6,.4,g);
  [1,-1].forEach(s=>{mk(B(2.9,.55,.38),tireM,0,.33,.95*s,g);mk(B(2.4,.07,.04),hazard,.1,.68,1.15*s,g);[-1,0,1].forEach(k=>mk(C(.22,.42,10),rusty,k*.95,.33,.95*s,g).rotation.x=PI/2)});
  const blade=mk(B(.25,.55,2.1),rusty,1.45,.5,0,g);blade.rotation.z=-.35;
  const tur=new THREE.Group();tur.position.set(.15,1.15,0);g.add(tur);
  mk(C(.55,.4,10),primer,0,.2,0,tur);mk(B(.8,.38,.8),hostile,.12,.45,0,tur);
  const lampM=new THREE.MeshStandardMaterial({color:0x2a0805,emissive:0xff2a10,emissiveIntensity:.5});const lamp=mk(new THREE.SphereGeometry(.1,10,8),lampM,.45,.55,.28,tur);
  const bp=new THREE.Group();bp.position.set(.45,.42,-.1);tur.add(bp);
  mk(C(.09,1.6,10),steel,.8,0,0,bp).rotation.z=-PI/2;mk(C(.14,.25,8),rusty,1.55,0,0,bp).rotation.z=-PI/2;
  const m=new THREE.Object3D();m.position.x=1.7;bp.add(m);
  const bar=document.createElement('div');bar.className='ebar';bar.innerHTML='<i></i>';ebars.appendChild(bar);
  const e={g,tur,bp,muz:m,lamp,lampM,bar,x,z,y:gh(x,z),h:Math.random()*6.28,v:0,pitch:0,roll:0,hp:EN_HP,dead:false,deadT:0,flash:0,
    reload:rnd(2,4),tYaw:0,tElev:.1,wp:null,strafe:Math.random()<.5?1:-1,strafeT:rnd(3,7),lead:rnd(.55,.95),kx:0,kz:0,stun:0,rammed:-9,type:'crawler',r:1.5,hh:1.9,maxHp:EN_HP,barY:2.6};
  enemies.push(e);return e}
function spawnPoint(){let x=0,z=0;for(let i=0;i<20;i++){const a=Math.random()*6.28;x=Math.cos(a)*MAP.spawn.ring;z=Math.sin(a)*MAP.spawn.ring;if(Math.hypot(x-car.x,z-car.z)>MAP.spawn.minDist&&!layoutNear(x,z)&&navReachable(x,z))break}return[x,z]}
function spawnEnemy(){makeEnemy(...spawnPoint())}
function removeEnemy(e){sc.remove(e.g);e.bar.remove();enemies.splice(enemies.indexOf(e),1);if(e.mark){e.mark.el.remove();const i=marks.indexOf(e.mark);if(i>=0)marks.splice(i,1)}}
function enemyFire(e){const p=new THREE.Vector3();e.muz.getWorldPosition(p);e.bp.getWorldQuaternion(_q);
  const v=new THREE.Vector3(1,0,0).applyQuaternion(_q).multiplyScalar(EN_SHELL.spd*rnd(.97,1.03));v.x+=rnd(-.35,.35);v.z+=rnd(-.35,.35);
  const sh=spawnShell(p,v,EN_SHELL.pw,e,.11,0xFF5533,.7);
  const hit=simShell(p,v,e);if(hit){const w=new THREE.Mesh(warnGeo,new THREE.MeshBasicMaterial({color:0xE5533D,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide}));w.position.copy(hit);w.position.y=Math.max(hit.y,gh(hit.x,hit.z))+.07;w.scale.setScalar((2.3*EN_SHELL.pw+1.2)/1.9);sc.add(w);sh.warn=w}
  const fl=S(puffT,0xFFC070,true,1,1.4);fl.position.copy(p);addFx(fl,.12,(f,k)=>{fl.material.opacity=1-k;fl.scale.setScalar(1.4+k*1.5)});
  for(let i=0;i<4;i++)smoke(p.clone(),v.clone().multiplyScalar(rnd(.05,.15)),0x8C857A,.3,1.6,rnd(1.2,2),.5);
  if(audio()){const s=spot(p,.04),[off]=sfxPick(SFX_CUT.tank); // crawler gun: a smaller, higher tank shot
    if(!sfx('tank-shot',{t:s.t,off,dur:1.5,fade:.7,vol:.6*s.a,rate:rnd(1.3,1.45),pan:s.pan,lp:s.lp})){const t=s.t,a=s.a;nz(t,.2,7000,900,.5*a);th(t,140,40,.3,.55*a)}}}
function pushOut(o,cx,cz,m){const dx=o.x-cx,dz=o.z-cz,d=Math.hypot(dx,dz);if(d<m&&d>1e-4){o.x+=dx/d*(m-d);o.z+=dz/d*(m-d);return true}return false}
function enemyTick(e,dt){
  if(e.dead){e.deadT+=dt;if(e.deadT>14)e.g.position.y-=dt*.3;if(e.deadT>20)removeEnemy(e);return}
  if(e.type==='bike')return bikeTick(e,dt);
  if(e.type==='rig')return rigTick(e,dt); // rival rigs (rivals.js)
  droneFlak(e,dt);gyroFlak(e,dt); // crawlers shoot at the spotter drone (drone.js) and the flying gyro (gyro.js)
  const tg=enemyTarget(e),dx=tg?tg.x-e.x:0,dz=tg?tg.z-e.z:0,d=tg?Math.hypot(dx,dz):1e9,engage=!!tg&&d<EN_RANGE,toP=Math.atan2(-dz,dx),pdx=car.x-e.x,pdz=car.z-e.z,pd=Math.hypot(pdx,pdz); // target: player or a convoy truck
  // knockback from bashes/rams, and a stun that stops it driving and firing
  e.x+=e.kx*dt;e.z+=e.kz*dt;const kd=Math.exp(-dt*4);e.kx*=kd;e.kz*=kd;e.stun=Math.max(0,e.stun-dt);
  // mech ram: running into a crawler head-on damages and shoves it
  if(!pl.dead&&mode===2&&!run&&runK>.5&&pd<1.5+CR+.4&&clock-e.rammed>.8){const fx=Math.cos(car.h),fz=-Math.sin(car.h);
    if((-pdx*fx-pdz*fz)/Math.max(pd,.01)>.5){e.rammed=clock;damageEnemy(e,RAM_DMG*runK);e.kx+=fx*10;e.kz+=fz*10;e.stun=.8;car.v*=.6;trauma=Math.min(1,trauma+.35);
      if(audio()){const t=AC.currentTime;th(t,80,30,.35,.8);nz(t,.3,1500,120,.6)}}}
  let want,spd;
  // line of fire to the player (through holes / over low walls), refreshed a few times a second
  if(engage){e.losT=(e.losT||0)-dt;if(e.losT<=0){e.losT=.3;e.los=fireLine(new THREE.Vector3(e.x,e.y+1.6,e.z),new THREE.Vector3(tg.x,tg.y+1.2,tg.z))}}else e.los=false;
  if(engage){ // path in until in range with a clear shot; then back off if too close, or circle-strafe in the band
    if(d>EN_PREF[1]||!e.los){want=navWant(e,tg.x,tg.z,dt);spd=5}else if(d<EN_PREF[0]){want=toP;spd=-3}else{want=toP+e.strafe*PI/2;spd=3.2}
    e.strafeT-=dt;if(e.strafeT<0){e.strafe*=-1;e.strafeT=rnd(3,7)}}
  else{e.huntT=(e.huntT||0)-dt;if(!e.wp||e.huntT<=0||Math.hypot(e.wp.x-e.x,e.wp.z-e.z)<4){e.wp=e.guard&&!e.guard.dead&&MS.phase==='nests'?navRandomPoint(e.guard.x,e.guard.z,22):tg?navRandomPoint(tg.x,tg.z,30):navRandomPoint();e.huntT=rnd(6,10)} // hunt: roam toward the target's area (guards circle their foundry)
    want=navWant(e,e.wp.x,e.wp.z,dt);spd=tg?4.5:3.5}
  if(engage&&e.los&&d>=EN_PREF[0]&&d<=EN_PREF[1]){const ax=e.x+Math.cos(want)*3,az=e.z-Math.sin(want)*3;if(navBlocked(nIdx(toCell(ax),toCell(az)))){e.strafe*=-1;want=toP+e.strafe*PI/2}} // strafing into a wall: switch direction
  if(e.unstick>0){e.unstick-=dt;want=e.h+e.strafe;spd=-2.5} // stuck: back up while turning
  if(e.stun>0)spd=0;
  let dh=want-e.h;dh=Math.atan2(Math.sin(dh),Math.cos(dh));e.h+=Math.max(-1.2*dt,Math.min(1.2*dt,dh));
  e.v+=(spd*Math.max(0,Math.cos(dh))-e.v)*Math.min(1,dt*2);
  const fx=Math.cos(e.h),fz=-Math.sin(e.h);e.x+=fx*e.v*dt;e.z+=fz*e.v*dt;navStuck(e,dt,Math.abs(spd)>1&&e.stun<=0);
  for(const s of solids)pushOut(e,s.x,s.z,1.5+s.r);
  for(const o of targets){const h=o.userData.h;pushOut(e,Math.max(o.position.x-h.x,Math.min(e.x,o.position.x+h.x)),Math.max(o.position.z-h.z,Math.min(e.z,o.position.z+h.z)),1.5)}
  for(const o of enemies)if(o!==e&&!o.dead)pushOut(e,o.x,o.z,3);
  for(const pc of piecesNear(e.x,e.z,2.5))obbPush(e,pc,1.5);
  if(!pl.dead&&!gyroAir())pushOut(e,car.x,car.z,1.5+CR); // crawler stops against the player
  const lim=PLAY-1;e.x=Math.max(-lim,Math.min(lim,e.x));e.z=Math.max(-lim,Math.min(lim,e.z));
  const sx=Math.sin(e.h),sz=Math.cos(e.h),hf=gh(e.x+fx*1.2,e.z+fz*1.2),hb=gh(e.x-fx*1.2,e.z-fz*1.2),hl=gh(e.x+sx*.9,e.z+sz*.9),hr=gh(e.x-sx*.9,e.z-sz*.9),k=Math.min(1,dt*8);
  e.pitch+=(Math.atan2(hf-hb,2.4)-e.pitch)*k;e.roll+=(-Math.atan2(hl-hr,1.8)-e.roll)*k;e.y+=((hf+hb+hl+hr)/4-e.y)*k;
  e.g.position.set(e.x,e.y,e.z);e.g.rotation.set(e.roll,e.h,e.pitch);
  // Turret: lead the player's motion (imperfectly, per-crawler e.lead), solve the low arc, slew, fire when laid
  e.reload-=dt;let laid=false,inRange=false;
  if(engage){const ox=e.x,oz=e.z,oy=e.y+1.6,pvx=Math.cos(tg.h)*tg.v,pvz=-Math.sin(tg.h)*tg.v,v=EN_SHELL.spd,g=9.8;let tx=tg.x,tz=tg.z,th=0,yw=0;
    for(let it=0;it<3;it++){const ddx=tx-ox,ddz=tz-oz,dh2=Math.hypot(ddx,ddz),dy=tg.y+1-oy,disc=v**4-g*(g*dh2*dh2+2*dy*v*v);inRange=disc>=0;
      th=inRange?Math.atan2(v*v-Math.sqrt(disc),g*dh2):PI/4;yw=Math.atan2(-ddz,ddx);const tf=dh2/(v*Math.cos(th));tx=tg.x+pvx*tf*e.lead;tz=tg.z+pvz*tf*e.lead}
    let ly=yw-e.h;ly=Math.atan2(Math.sin(ly),Math.cos(ly));e.tYaw=ly;e.tElev=th-e.pitch}
  else{e.tYaw=0;e.tElev=.1}
  let ey=e.tYaw-e.tur.rotation.y;ey=Math.atan2(Math.sin(ey),Math.cos(ey));e.tur.rotation.y=Math.atan2(Math.sin(e.tur.rotation.y+Math.max(-1.6*dt,Math.min(1.6*dt,ey))),Math.cos(e.tur.rotation.y+Math.max(-1.6*dt,Math.min(1.6*dt,ey))));
  e.bp.rotation.z+=Math.max(-dt,Math.min(dt,e.tElev-e.bp.rotation.z));
  laid=Math.abs(ey)<.04&&Math.abs(e.tElev-e.bp.rotation.z)<.03;
  if(engage&&inRange&&laid&&e.los&&e.reload<=0&&e.stun<=0){enemyFire(e);e.reload=rnd(2.4,3.4)}
  // lamp brightens as the next shot gets close: a tell before it fires
  e.flash=Math.max(0,e.flash-dt*4);e.lampM.emissiveIntensity=engage?.6+3*Math.max(0,1-e.reload/1):(.3+.2*Math.sin(clock*3));
  e.lampM.emissive.setHex(e.flash>0?0xffffff:0xff2a10)}
// --- Scrap-bike rusher: fast, fragile, carries a drum charge. Weaves in, detonates within BIKE.fuse of the player.
// Its beacon blinks (and beeps) faster as it closes. Shooting it sets off the charge too, which can take nearby crawlers with it.
const BIKE={hp:30,spd:11,turn:2.6,fuse:2.6,pw:1.6};
function makeBike(x,z){const g=new THREE.Group();g.rotation.order='YZX';sc.add(g);
  mk(B(1.5,.22,.3),hostile,0,.62,0,g);mk(B(.55,.35,.42),rusty,.15,.85,0,g);mk(C(.06,.75,6),steel,.62,.95,0,g).rotation.z=-.5;mk(B(.08,.08,.75),steel,.8,1.27,0,g);
  const wheels=[.75,-.65].map(wx=>{const w=mk(C(.36,.16,12),tireM,wx,.36,0,g);w.rotation.x=PI/2;return w});
  mk(C(.27,.62,12),hazard,-.45,1.0,0,g).rotation.x=PI/2;mk(B(.04,.6,.66),steel,-.45,1.0,0,g);
  const lampM=new THREE.MeshStandardMaterial({color:0x2a0805,emissive:0xff2a10,emissiveIntensity:.3});mk(new THREE.SphereGeometry(.1,10,8),lampM,-.45,1.37,0,g);
  const bar=document.createElement('div');bar.className='ebar';bar.innerHTML='<i></i>';ebars.appendChild(bar);
  const e={type:'bike',g,wheels,lampM,bar,x,z,y:gh(x,z),h:Math.random()*6.28,v:0,pitch:0,roll:0,hp:BIKE.hp,maxHp:BIKE.hp,dead:false,deadT:0,flash:0,
    kx:0,kz:0,stun:0,t:0,seed:rnd(0,6.28),blinkT:0,wp:null,rammed:-9,r:1.0,hh:1.5,barY:1.9};
  enemies.push(e);return e}
function bikeTick(e,dt){const tg=enemyTarget(e),dx=tg?tg.x-e.x:0,dz=tg?tg.z-e.z:0,d=tg?Math.hypot(dx,dz):1e9;e.t+=dt;
  e.x+=e.kx*dt;e.z+=e.kz*dt;const kd=Math.exp(-dt*4);e.kx*=kd;e.kz*=kd;e.stun=Math.max(0,e.stun-dt);
  let want,spd;
  if(tg){const direct=navLine(e.x,e.z,tg.x,tg.z); // weave only in the open; follow the streets otherwise
    want=direct?Math.atan2(-dz,dx)+(d>10?Math.sin(e.t*2.2+e.seed)*.6:0):navWant(e,tg.x,tg.z,dt);spd=BIKE.spd*(direct?1:.8)}
  else{if(!e.wp||Math.hypot(e.wp.x-e.x,e.wp.z-e.z)<4)e.wp=navRandomPoint();want=navWant(e,e.wp.x,e.wp.z,dt);spd=5}
  if(e.unstick>0){e.unstick-=dt;want=e.h+1;spd=-3}
  if(e.stun>0)spd=0;
  let dh=want-e.h;dh=Math.atan2(Math.sin(dh),Math.cos(dh));e.h+=Math.max(-BIKE.turn*dt,Math.min(BIKE.turn*dt,dh));
  e.v+=(spd*Math.max(.25,Math.cos(dh))-e.v)*Math.min(1,dt*1.5);
  const fx=Math.cos(e.h),fz=-Math.sin(e.h);e.x+=fx*e.v*dt;e.z+=fz*e.v*dt;navStuck(e,dt,Math.abs(spd)>1&&e.stun<=0);
  for(const s of solids)pushOut(e,s.x,s.z,.9+s.r);
  for(const o of targets){const h=o.userData.h;pushOut(e,Math.max(o.position.x-h.x,Math.min(e.x,o.position.x+h.x)),Math.max(o.position.z-h.z,Math.min(e.z,o.position.z+h.z)),.9)}
  for(const pc of piecesNear(e.x,e.z,2))obbPush(e,pc,.9);
  for(const o of enemies)if(o!==e&&!o.dead)pushOut(e,o.x,o.z,1.8);
  const lim=PLAY-1;e.x=Math.max(-lim,Math.min(lim,e.x));e.z=Math.max(-lim,Math.min(lim,e.z));
  const hf=gh(e.x+fx*.7,e.z+fz*.7),hb=gh(e.x-fx*.7,e.z-fz*.7),k=Math.min(1,dt*10);
  e.pitch+=(Math.atan2(hf-hb,1.4)-e.pitch)*k;e.roll+=(Math.max(-.5,Math.min(.5,-dh*1.2))*Math.min(1,e.v/6)-e.roll)*Math.min(1,dt*5);e.y+=((hf+hb)/2-e.y)*k; // leans into turns
  e.g.position.set(e.x,e.y,e.z);e.g.rotation.set(e.roll,e.h,e.pitch);e.wheels.forEach(w=>w.rotation.y-=e.v*dt/.36);
  if(e.v>6&&Math.random()<dt*14){const q=new THREE.Vector3(e.x-fx*.8,e.y+.15,e.z-fz*.8);smoke(q,new THREE.Vector3(-fx*2+rnd(-.4,.4),rnd(.3,.8),-fz*2+rnd(-.4,.4)),0x8A7A60,.25,rnd(1,1.6),rnd(.7,1.1),.35)}
  // beacon + beep speed up as it closes in
  const period=Math.max(.1,Math.min(.9,d/28));e.blinkT+=dt;if(e.blinkT>period){e.blinkT=0;e.flash=.5;
    if(tg&&d<35&&audio()){const t=AC.currentTime,a=1/(1+d*.06);th(t,1500,1450,.05,.18*a)}}
  e.flash=Math.max(0,e.flash-dt*5);e.lampM.emissiveIntensity=e.flash>0?3.5:.3;
  if(tg&&d<BIKE.fuse&&e.stun<=0)killEnemy(e,false)} // detonate
const _sp=new THREE.Vector3();
function combatTick(dt){navFlush();navBudget=2; // at most 2 A* searches per frame
  enemies.slice().forEach(e=>enemyTick(e,dt));
  if(!MAP.mission){ // free play: crawlers and bikes from the map ring (missions spawn from foundries instead)
  if(enemies.filter(e=>!e.dead&&e.type==='crawler').length<ENEMY_MAX){spawnT-=dt;if(spawnT<=0){spawnEnemy();spawnT=8}}
  if(!enemies.some(e=>!e.dead&&e.type==='bike')){bikeT-=dt;if(bikeT<=0){makeBike(...spawnPoint());bikeT=rnd(14,20)}}}
  if(!pl.dead&&clock-pl.lastHit>5)pl.hp=Math.min(PL_MAX,pl.hp+5*dt); // slow repair out of combat
  const hp=Math.round(pl.hp);const hk=pl.hp/PL_MAX;hpFill.style.width=hk*100+'%';hpFill.style.background=hk>.55?'#8fae5a':hk>.25?'#d9a43a':'#d8553a';if(hpNum.textContent!=hp)hpNum.textContent=hp;
  hurtA=Math.max(0,hurtA-dt*1.5);hurtEl.style.opacity=Math.max(hurtA,pl.dead?.5:hk<.25?.25+.1*Math.sin(clock*5):0);
  if(toastT>0){toastT-=dt;if(toastT<=0)toastEl.classList.remove('show')}
  const r=cv.getBoundingClientRect();
  enemies.forEach(e=>{if(e.dead)return;_sp.set(e.x,e.y+e.barY,e.z);const dist=cam.position.distanceTo(_sp);_sp.project(cam);
    const show=_sp.z<1&&dist<60&&(e.hp<e.maxHp||dist<35);e.bar.style.display=show?'block':'none';
    if(show){e.bar.style.left=(r.left+(_sp.x+1)/2*r.width)+'px';e.bar.style.top=(r.top+(1-_sp.y)/2*r.height)+'px';e.bar.firstChild.style.width=(e.hp/e.maxHp*100)+'%'}})}
function resetCombat(){enemies.slice().forEach(removeEnemy);shots.forEach(s=>{sc.remove(s.m);if(s.warn)sc.remove(s.warn)});shots.length=0;
  Object.assign(pl,{hp:PL_MAX,dead:false,lastHit:-99});Object.assign(car,{x:MAP.start.x,z:MAP.start.z,h:MAP.start.h,v:0});kills=0;killsEl.textContent=0;toastT=.01;spawnT=3;bikeT=20}
