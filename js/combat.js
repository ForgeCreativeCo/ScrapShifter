// Health, blast damage, enemy crawlers.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Combat: health, blast damage, enemy crawlers ----------
// Blast damage falls off linearly to 0 at 2.3*power + 1.2 m. The player takes extra damage mid-transform.
const PL_H=[2.2,2.6,5.2],ARMOR=[1.25,.7,.85],TRANSFORM_ARMOR=1.5,PL_DMG=45,EN_DMG=60,EN_HP=60,ENEMY_MAX=2;
const EN_SHELL={spd:22,pw:.85},EN_RANGE=48,EN_PREF=[14,26]; // shell, engage range, preferred band
const pl={hp:100,dead:false,lastHit:-99,slump:0};let kills=0;
const enemies=[];let spawnT=4; // first crawler rolls in after a few seconds, the next 8s later
const hpFill=document.getElementById('hpFill'),hpNum=document.getElementById('hpNum'),killsEl=document.getElementById('kills'),hurtEl=document.getElementById('hurt'),toastEl=document.getElementById('toast'),ebars=document.getElementById('ebars');
let toastT=0;function toast(m,s=2.5){toastEl.textContent=m;toastEl.classList.add('show');toastT=s}
let hurtA=0;
function hitClank(p,pw){if(!audio())return;const t=AC.currentTime+cam.position.distanceTo(p)/343;nz(t,.25,3200,500,.5*pw,'bandpass');th(t,240,70,.18,.35*pw)}
function sparks(p,n){for(let i=0;i<n;i++)ember(p.clone(),new THREE.Vector3(rnd(-1,1),rnd(.3,1.2),rnd(-1,1)).normalize().multiplyScalar(rnd(4,9)),rnd(.3,.8))}
function damagePlayer(d){if(pl.dead)return;d*=run?TRANSFORM_ARMOR:ARMOR[mode];pl.hp-=d;pl.lastHit=clock;hurtA=Math.min(1,hurtA+d/30);trauma=Math.min(1,trauma+d/60);
  sparks(new THREE.Vector3(car.x,car.y+1.2,car.z),8);hitClank(root.position,1);
  if(pl.hp<=0){pl.hp=0;pl.dead=true;AIM.lock=null;firing=false;
    explode(new THREE.Vector3(car.x,car.y+.8,car.z),1.4);slowT=.35;
    let tt=0;addFx(null,14,(f,k,dt)=>{tt+=dt;if(tt>.12&&pl.dead){tt=0;const q=new THREE.Vector3(car.x+rnd(-.6,.6),car.y+1,car.z+rnd(-.6,.6));fireball(q,new THREE.Vector3(0,rnd(1,2),0),.35,.9*(1-k),rnd(.4,.7));smoke(q.clone().setY(q.y+.8),new THREE.Vector3(rnd(-.2,.2),rnd(1.5,2.5),rnd(-.2,.2)),0x221F1B,.7,3.2,rnd(4,6),.6)}});
    toast('Wrecked. Press R to rebuild.',9999)}}
function damageEnemy(e,d){if(e.dead)return;e.hp-=d;e.flash=1;sparks(new THREE.Vector3(e.x,e.y+1,e.z),8);hitClank(e.g.position,.8);
  if(e.hp<=0){e.hp=0;e.dead=true;e.deadT=0;kills++;killsEl.textContent=kills;e.bar.style.display='none';
    e.g.traverse(o=>{if(o.isMesh)o.material=charM});explode(new THREE.Vector3(e.x,e.y+.8,e.z),1.5);toast('Crawler destroyed')}}
function applyBlast(p,pw){const R=2.3*pw+1.2;
  if(!pl.dead){const d=Math.hypot(p.x-car.x,p.y-(car.y+1),p.z-car.z);if(d<R)damagePlayer(PL_DMG*pw*(1-d/R))}
  enemies.slice().forEach(e=>{if(e.dead)return;const d=Math.hypot(p.x-e.x,p.y-(e.y+.8),p.z-e.z);if(d<R)damageEnemy(e,EN_DMG*pw*(1-d/R))})}
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
    reload:rnd(2,4),tYaw:0,tElev:.1,wp:null,strafe:Math.random()<.5?1:-1,strafeT:rnd(3,7),lead:rnd(.55,.95)};
  enemies.push(e);return e}
function spawnEnemy(){let x=0,z=0;for(let i=0;i<20;i++){const a=Math.random()*6.28;x=Math.cos(a)*46;z=Math.sin(a)*46;if(Math.hypot(x-car.x,z-car.z)>32)break}makeEnemy(x,z)}
function removeEnemy(e){sc.remove(e.g);e.bar.remove();enemies.splice(enemies.indexOf(e),1)}
function enemyFire(e){const p=new THREE.Vector3();e.muz.getWorldPosition(p);e.bp.getWorldQuaternion(_q);
  const v=new THREE.Vector3(1,0,0).applyQuaternion(_q).multiplyScalar(EN_SHELL.spd*rnd(.97,1.03));v.x+=rnd(-.35,.35);v.z+=rnd(-.35,.35);
  const sh=spawnShell(p,v,EN_SHELL.pw,e,.11,0xFF5533,.7);
  const hit=simShell(p,v,e);if(hit){const w=new THREE.Mesh(warnGeo,new THREE.MeshBasicMaterial({color:0xE5533D,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide}));w.position.copy(hit);w.position.y=Math.max(hit.y,gh(hit.x,hit.z))+.07;w.scale.setScalar((2.3*EN_SHELL.pw+1.2)/1.9);sc.add(w);sh.warn=w}
  const fl=S(puffT,0xFFC070,true,1,1.4);fl.position.copy(p);addFx(fl,.12,(f,k)=>{fl.material.opacity=1-k;fl.scale.setScalar(1.4+k*1.5)});
  for(let i=0;i<4;i++)smoke(p.clone(),v.clone().multiplyScalar(rnd(.05,.15)),0x8C857A,.3,1.6,rnd(1.2,2),.5);
  if(audio()){const d=cam.position.distanceTo(p),t=AC.currentTime+d/343,a=1/(1+d*.04);nz(t,.2,7000,900,.5*a);th(t,140,40,.3,.55*a)}}
function pushOut(o,cx,cz,m){const dx=o.x-cx,dz=o.z-cz,d=Math.hypot(dx,dz);if(d<m&&d>1e-4){o.x+=dx/d*(m-d);o.z+=dz/d*(m-d);return true}return false}
function enemyTick(e,dt){
  if(e.dead){e.deadT+=dt;if(e.deadT>14)e.g.position.y-=dt*.3;if(e.deadT>20)removeEnemy(e);return}
  const dx=car.x-e.x,dz=car.z-e.z,d=Math.hypot(dx,dz),engage=!pl.dead&&d<EN_RANGE,toP=Math.atan2(-dz,dx);
  let want,spd;
  if(engage){ // close in, back off, or circle-strafe inside the preferred band
    if(d>EN_PREF[1]){want=toP;spd=5}else if(d<EN_PREF[0]){want=toP;spd=-3}else{want=toP+e.strafe*PI/2;spd=3.2}
    e.strafeT-=dt;if(e.strafeT<0){e.strafe*=-1;e.strafeT=rnd(3,7)}}
  else{if(!e.wp||Math.hypot(e.wp.x-e.x,e.wp.z-e.z)<3)e.wp={x:rnd(-45,45),z:rnd(-45,45)};want=Math.atan2(-(e.wp.z-e.z),e.wp.x-e.x);spd=3.5}
  let dh=want-e.h;dh=Math.atan2(Math.sin(dh),Math.cos(dh));e.h+=Math.max(-1.2*dt,Math.min(1.2*dt,dh));
  e.v+=(spd*Math.max(0,Math.cos(dh))-e.v)*Math.min(1,dt*2);
  const fx=Math.cos(e.h),fz=-Math.sin(e.h);e.x+=fx*e.v*dt;e.z+=fz*e.v*dt;
  for(const s of solids)if(pushOut(e,s.x,s.z,1.5+s.r)&&!engage)e.wp=null;
  for(const o of targets){const h=o.userData.h;pushOut(e,Math.max(o.position.x-h.x,Math.min(e.x,o.position.x+h.x)),Math.max(o.position.z-h.z,Math.min(e.z,o.position.z+h.z)),1.5)}
  for(const o of enemies)if(o!==e&&!o.dead)pushOut(e,o.x,o.z,3);
  if(!pl.dead)pushOut(e,car.x,car.z,1.5+CR); // crawler stops against the player
  const lim=GS/2-4;e.x=Math.max(-lim,Math.min(lim,e.x));e.z=Math.max(-lim,Math.min(lim,e.z));
  const sx=Math.sin(e.h),sz=Math.cos(e.h),hf=gh(e.x+fx*1.2,e.z+fz*1.2),hb=gh(e.x-fx*1.2,e.z-fz*1.2),hl=gh(e.x+sx*.9,e.z+sz*.9),hr=gh(e.x-sx*.9,e.z-sz*.9),k=Math.min(1,dt*8);
  e.pitch+=(Math.atan2(hf-hb,2.4)-e.pitch)*k;e.roll+=(-Math.atan2(hl-hr,1.8)-e.roll)*k;e.y+=((hf+hb+hl+hr)/4-e.y)*k;
  e.g.position.set(e.x,e.y,e.z);e.g.rotation.set(e.roll,e.h,e.pitch);
  // Turret: lead the player's motion (imperfectly, per-crawler e.lead), solve the low arc, slew, fire when laid
  e.reload-=dt;let laid=false,inRange=false;
  if(engage){const ox=e.x,oz=e.z,oy=e.y+1.6,pvx=Math.cos(car.h)*car.v,pvz=-Math.sin(car.h)*car.v,v=EN_SHELL.spd,g=9.8;let tx=car.x,tz=car.z,th=0,yw=0;
    for(let it=0;it<3;it++){const ddx=tx-ox,ddz=tz-oz,dh2=Math.hypot(ddx,ddz),dy=car.y+1-oy,disc=v**4-g*(g*dh2*dh2+2*dy*v*v);inRange=disc>=0;
      th=inRange?Math.atan2(v*v-Math.sqrt(disc),g*dh2):PI/4;yw=Math.atan2(-ddz,ddx);const tf=dh2/(v*Math.cos(th));tx=car.x+pvx*tf*e.lead;tz=car.z+pvz*tf*e.lead}
    let ly=yw-e.h;ly=Math.atan2(Math.sin(ly),Math.cos(ly));e.tYaw=ly;e.tElev=th-e.pitch}
  else{e.tYaw=0;e.tElev=.1}
  let ey=e.tYaw-e.tur.rotation.y;ey=Math.atan2(Math.sin(ey),Math.cos(ey));e.tur.rotation.y=Math.atan2(Math.sin(e.tur.rotation.y+Math.max(-1.6*dt,Math.min(1.6*dt,ey))),Math.cos(e.tur.rotation.y+Math.max(-1.6*dt,Math.min(1.6*dt,ey))));
  e.bp.rotation.z+=Math.max(-dt,Math.min(dt,e.tElev-e.bp.rotation.z));
  laid=Math.abs(ey)<.04&&Math.abs(e.tElev-e.bp.rotation.z)<.03;
  if(engage&&inRange&&laid&&e.reload<=0){enemyFire(e);e.reload=rnd(2.4,3.4)}
  // lamp brightens as the next shot gets close: a tell before it fires
  e.flash=Math.max(0,e.flash-dt*4);e.lampM.emissiveIntensity=engage?.6+3*Math.max(0,1-e.reload/1):(.3+.2*Math.sin(clock*3));
  e.lampM.emissive.setHex(e.flash>0?0xffffff:0xff2a10)}
const _sp=new THREE.Vector3();
function combatTick(dt){
  enemies.slice().forEach(e=>enemyTick(e,dt));
  if(enemies.filter(e=>!e.dead).length<ENEMY_MAX){spawnT-=dt;if(spawnT<=0){spawnEnemy();spawnT=8}}
  if(!pl.dead&&clock-pl.lastHit>5)pl.hp=Math.min(100,pl.hp+5*dt); // slow repair out of combat
  const hp=Math.round(pl.hp);hpFill.style.width=pl.hp+'%';hpFill.style.background=pl.hp>55?'#8fae5a':pl.hp>25?'#d9a43a':'#d8553a';if(hpNum.textContent!=hp)hpNum.textContent=hp;
  hurtA=Math.max(0,hurtA-dt*1.5);hurtEl.style.opacity=Math.max(hurtA,pl.dead?.5:pl.hp<25?.25+.1*Math.sin(clock*5):0);
  if(toastT>0){toastT-=dt;if(toastT<=0)toastEl.classList.remove('show')}
  const r=cv.getBoundingClientRect();
  enemies.forEach(e=>{if(e.dead)return;_sp.set(e.x,e.y+2.6,e.z);const dist=cam.position.distanceTo(_sp);_sp.project(cam);
    const show=_sp.z<1&&dist<60&&(e.hp<EN_HP||dist<35);e.bar.style.display=show?'block':'none';
    if(show){e.bar.style.left=(r.left+(_sp.x+1)/2*r.width)+'px';e.bar.style.top=(r.top+(1-_sp.y)/2*r.height)+'px';e.bar.firstChild.style.width=(e.hp/EN_HP*100)+'%'}})}
function resetCombat(){enemies.slice().forEach(removeEnemy);shots.forEach(s=>{sc.remove(s.m);if(s.warn)sc.remove(s.warn)});shots.length=0;
  Object.assign(pl,{hp:100,dead:false,lastHit:-99});Object.assign(car,{x:0,z:0,h:0,v:0});kills=0;killsEl.textContent=0;toastT=.01;spawnT=3}
