// Race gun towers (maps with MAP.race; spots from racePlan in js/raceplan.js): scrap lattice towers beside the track that
// fire on every racer going past, the player and the rival rigs alike. Each head carries a minigun (hitscan, harder to
// hit the faster the target goes, so boosting past pays) and a grenade pod that lobs a two-round salvo at where the
// target will be (red warning rings, like crawler shells). Towers live in `enemies` (type 'tower'), so shells, blasts,
// the bash, health bars and the cursor snap all work on them; they never move. A tower the player wrecks pays
// TOWER.bounty shells. Quiet during the countdown and never fire on a rig in the arena; wrecked ones stay wrecked until the race restarts.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const TOWER={hp:90,range:42,far:78,min:12,dps:6,dmgTick:.12,tracer:.05,yawRate:1.9,pitchRate:2,spinUp:.5,headY:6.22,
  shell:{spd:29,pw:.75},salvo:2,gap:.3,reload:[4.4,5.4],bounty:2,r:1.5,hh:7.6};
const gunTowers=[],_tw=new THREE.Vector3(),_tw2=new THREE.Vector3(),_twS=new THREE.Vector3(),_twM=new THREE.Vector3();
const towerNeonM=new THREE.MeshBasicMaterial({color:0xff2bd6}),towerNeonG=B(2.8,.1,2.8);
// The static frame (plinth, legs, X braces, platform) is merged once per material and shared by every tower
let towerFrame=null;
function towerFrameGeo(){if(towerFrame)return towerFrame;const U=THREE.BufferGeometryUtils,L={c:[],h:[],s:[],r:[]},E=new THREE.Euler(),M=new THREE.Matrix4();
  const put=(k,g,x,y,z,rx=0,rz=0)=>{g.applyMatrix4(M.makeRotationFromEuler(E.set(rx,0,rz)));g.applyMatrix4(M.makeTranslation(x,y,z));L[k].push(g)};
  put('c',B(2.8,1,2.8),0,.5,0);put('h',B(2.9,.26,2.9),0,1.1,0);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>put('s',C(.13,5,6),a*.95,3.65,b*.95));
  const bl=Math.hypot(1.9,2.2),ba=Math.atan2(2.2,1.9);
  [2.35,4.6].forEach(y=>[1,-1].forEach(s=>[1,-1].forEach(t=>{put('r',B(.07,.07,bl),s*.95,y,0,t*ba,0);put('r',B(bl,.07,.07),0,y,s*.95,0,t*ba)})));
  put('r',B(2.7,.24,2.7),0,6.1,0);
  [[1.3,0],[-1.3,0],[0,1.3],[0,-1.3]].forEach(([x,z])=>put('s',B(x?.06:2.6,.5,x?2.6:.06),x,6.45,z)); // railing plates
  const mats={c:concrete,h:hazard,s:steel,r:rusty};
  towerFrame=[];for(const k in L){if(U)towerFrame.push([U.mergeBufferGeometries(L[k]),mats[k]]);else L[k].forEach(g=>towerFrame.push([g,mats[k]]))}
  return towerFrame}

function makeTower(x,z){const y=gh(x,z),g=new THREE.Group();g.position.set(x,y,z);sc.add(g);
  towerFrameGeo().forEach(([geo,m])=>mk(geo,m,0,0,0,g));
  const neon=mk(towerNeonG,towerNeonM,0,5.93,0,g);neon.castShadow=false;
  const head=new THREE.Group();head.position.y=TOWER.headY;head.rotation.y=Math.random()*6.28;g.add(head);
  mk(C(.75,.24,14),primer,0,.12,0,head);mk(B(1.4,.8,1.15),hostile,-.05,.66,0,head);mk(B(.5,.55,1.25),rusty,-.72,.62,0,head);
  const lampM=new THREE.MeshStandardMaterial({color:0x2a0805,emissive:0xff2a10,emissiveIntensity:.5});mk(new THREE.SphereGeometry(.13,10,8),lampM,.68,.86,0,head);
  const glow=S(glowT,0xff2a10,true,.5,1.6);glow.position.set(.72,.86,0);head.add(glow);
  // minigun on the right of the head: six barrels that spin up before they fire
  const gun=new THREE.Group();gun.position.set(.35,.62,.8);head.add(gun);mk(B(.6,.3,.32),olive,0,0,0,gun);
  const spin=new THREE.Group();spin.position.x=.3;gun.add(spin);
  for(let i=0;i<6;i++){const a=i/6*PI*2;mk(C(.028,.85,6),steel,.42,Math.cos(a)*.06,Math.sin(a)*.06,spin).rotation.z=-PI/2}
  mk(C(.09,.05,10),steel,.78,0,0,spin).rotation.z=-PI/2;mk(C(.09,.05,10),steel,.12,0,0,spin).rotation.z=-PI/2;
  const muz=new THREE.Object3D();muz.position.x=.9;spin.add(muz);
  // grenade pod on the left: four tubes, fired in turn
  const pod=new THREE.Group();pod.position.set(.2,.68,-.86);head.add(pod);mk(B(.85,.62,.62),hazard,0,0,0,pod);
  const tubes=[[.15,.15],[-.15,-.15],[.15,-.15],[-.15,.15]].map(([ty,tz])=>{mk(C(.1,.3,10),steel,.45,ty,tz,pod).rotation.z=-PI/2;const o=new THREE.Object3D();o.position.set(.62,ty,tz);pod.add(o);return o});
  tuneEnv(g);
  const mf=S(puffT,0xFFD27A,true,0,.6);sc.add(mf);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),mgTracerM);line.frustumCulled=false;line.visible=false;sc.add(line);
  const bar=document.createElement('div');bar.className='ebar';bar.innerHTML='<i></i>';ebars.appendChild(bar);
  const e={type:'tower',g,head,gun,spin,pod,tubes,muz,mf,line,neon,glow,lampM,bar,x,z,y,h:0,v:0,hp:TOWER.hp,maxHp:TOWER.hp,dead:false,deadT:0,flash:0,
    r:TOWER.r,hh:TOWER.hh,barY:8.6,kx:0,kz:0,stun:0,rammed:-9,tgt:null,los:false,pickT:rnd(0,.5),spinK:0,spinA:0,dmg:0,dmgT:0,trT:0,lineT:0,
    reload:rnd(1,3),salvo:0,salvoT:0,tube:0,mgOn:false,fx:1,fz:0,landed:false};
  // HUD marker while it is ahead of the camera and in reach
  e.mark=addMark('nest',()=>{if(e.dead||RS.phase==='grid'||RS.pArena||pl.dead)return null;const d=Math.hypot(e.x-car.x,e.z-car.z);if(d>95||d<5)return null;
    const m=cam.matrixWorld.elements;if((e.x-cam.position.x)*-m[8]+(e.z-cam.position.z)*-m[10]<0)return null;return _mp.set(e.x,e.y+e.barY,e.z)},()=>'Gun tower',()=>e.hp/e.maxHp);
  enemies.push(e);gunTowers.push(e);return e}

function towerReset(){if(!MAP.race||!MAP.race.towers)return;
  gunTowers.forEach(e=>{sc.remove(e.mf);sc.remove(e.line);e.line.geometry.dispose();if(enemies.includes(e))removeEnemy(e)});gunTowers.length=0;
  MAP.race.towers.forEach(t=>makeTower(t.x,t.z))}

// Racers it may shoot: the player (not mid pit-rebuild, not in the arena) and rivals still on the track
function towerOk(t){return t===PLT?!pl.dead&&!RS.pArena&&!RS.pit:!t.dead&&!t.arena&&!(t.pitT>0)}
// Nearest racer in reach with a clear line from the head (the player counts as a little nearer); checks at most three
function towerPick(e){const c=[],o=_tw.set(e.x,e.y+TOWER.headY+.65,e.z);
  if(towerOk(PLT))c.push([Math.hypot(car.x-e.x,car.z-e.z)*.85,PLT]);
  for(const r of RS.racers)if(towerOk(r))c.push([Math.hypot(r.x-e.x,r.z-e.z),r]);
  c.sort((a,b)=>a[0]-b[0]);
  for(let i=0;i<Math.min(3,c.length);i++){if(c[i][0]>TOWER.far)break;const t=c[i][1];if(fireLine(o.clone(),_tw2.set(t.x,t.y+1,t.z)))return t}
  return null}
// Low-arc launch from p onto where target t will be (lead: share of its motion to allow for)
function towerSolve(p,t,lead,out){const v=TOWER.shell.spd,g=9.8,vx=Math.cos(t.h)*t.v,vz=-Math.sin(t.h)*t.v;let tx=t.x,tz=t.z,th=0,yw=0,ok=false;
  for(let it=0;it<3;it++){const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz),dy=t.y+.6-p.y,disc=v**4-g*(g*d*d+2*dy*v*v);ok=disc>=0;
    th=ok?Math.atan2(v*v-Math.sqrt(disc),g*d):PI/4;yw=Math.atan2(-dz,dx);const tf=d/(v*Math.cos(th));tx=t.x+vx*tf*lead;tz=t.z+vz*tf*lead}
  if(out)out.set(Math.cos(th)*Math.cos(yw),Math.sin(th),-Math.cos(th)*Math.sin(yw)).multiplyScalar(v);return ok?th:null}

function towerShot(e,t){const tube=e.tubes[e.tube++%4],p=new THREE.Vector3(),v=new THREE.Vector3();tube.getWorldPosition(p);
  if(towerSolve(p,t,rnd(.55,1),v)==null)return; // leads short more often than not: keep moving and it lands behind youv.x+=rnd(-1.6,1.6);v.z+=rnd(-1.6,1.6);
  const sh=spawnShell(p,v,TOWER.shell.pw,e,.13,0xFF3A6A,.9);shellWarn(sh,p,v,e);
  const fl=S(puffT,0xFFB070,true,1,1.2);fl.position.copy(p);addFx(fl,.12,(f,k)=>{fl.material.opacity=1-k;fl.scale.setScalar(1.2+k*1.4)});
  for(let i=0;i<3;i++)smoke(p.clone(),v.clone().multiplyScalar(rnd(.04,.12)),0x8C857A,.3,1.4,rnd(1,1.6),.5);
  if(audio()){const s=spot(p,.04),[off]=sfxPick(SFX_CUT.tank); // a short, hollow launcher thump
    if(!sfx('tank-shot',{t:s.t,off,dur:1.1,fade:.5,vol:.5*s.a,rate:rnd(1.6,1.8),pan:s.pan,lp:s.lp})){nz(s.t,.15,5000,700,.4*s.a);th(s.t,180,60,.25,.5*s.a)}}}

function towerTick(e,dt){const vis=Math.hypot(e.x-cam.position.x,e.z-cam.position.z)<230;e.g.visible=vis;e.mgOn=false;
  if(e.dead){e.deadT+=dt;const k=cl(e.deadT/1.1); // the head topples off the platform, the stump smokes
    e.head.position.set(e.fx*1.8*ss(k),TOWER.headY-(TOWER.headY-.7)*k*k,e.fz*1.8*ss(k));e.head.rotation.x=e.fz*1.4*k;e.head.rotation.z=-e.fx*1.4*k;
    if(k>=1&&!e.landed){e.landed=true;const q=new THREE.Vector3(e.x+e.fx*1.8,e.y+.6,e.z+e.fz*1.8);for(let i=0;i<8;i++)smoke(q.clone(),new THREE.Vector3(rnd(-2,2),rnd(.3,1),rnd(-2,2)),0x8A7A60,.6,2.4,rnd(1.5,2.5),.5);hitClank(q,1)}
    if(vis&&e.deadT<16&&Math.random()<dt*6)smoke(new THREE.Vector3(e.x+rnd(-.5,.5),e.y+6.3,e.z+rnd(-.5,.5)),new THREE.Vector3(rnd(-.2,.2),rnd(1.2,2),rnd(-.2,.2)),0x221F1B,.6,2.6,rnd(3,5),.5);
    return}
  const live=MS.race&&RS.phase!=='grid';
  if(!pl.dead){PLT.x=car.x;PLT.y=car.y;PLT.z=car.z;PLT.h=car.h;PLT.v=car.v}
  e.pickT-=dt;if(e.pickT<=0){e.pickT=.5;e.tgt=live?towerPick(e):null;e.los=!!e.tgt}
  if(e.tgt&&!towerOk(e.tgt))e.tgt=null;
  const t=e.tgt;let ye=9,d=1e9;
  if(t){const dx=t.x-e.x,dz=t.z-e.z;d=Math.hypot(dx,dz);
    let dy=Math.atan2(-dz,dx)-e.head.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));e.head.rotation.y+=Math.max(-TOWER.yawRate*dt,Math.min(TOWER.yawRate*dt,dy));ye=Math.abs(dy);
    const el=Math.max(-.9,Math.min(.4,Math.atan2(t.y+1-(e.y+TOWER.headY+.62),d)));e.gun.rotation.z+=Math.max(-TOWER.pitchRate*dt,Math.min(TOWER.pitchRate*dt,el-e.gun.rotation.z));
    _tw.set(e.x,e.y+TOWER.headY+.7,e.z);const pe=towerSolve(_tw,t,.9,null);if(pe!=null)e.pod.rotation.z+=Math.max(-dt,Math.min(dt,pe-e.pod.rotation.z))}
  else{e.gun.rotation.z*=Math.exp(-dt*2);e.pod.rotation.z*=Math.exp(-dt*2);e.salvo=0}
  // minigun: spin up while it has a racer in reach, fire once laid; the faster the racer, the more rounds miss
  const fire=!!t&&ye<.1&&e.los&&d<TOWER.range;
  e.spinK=fire||(t&&d<TOWER.range+8)?Math.min(1,e.spinK+dt/TOWER.spinUp):Math.max(0,e.spinK-dt*1.2);e.spinA+=e.spinK*40*dt;e.spin.rotation.x=e.spinA;
  const shooting=fire&&e.spinK>.6;e.mgOn=shooting;
  if(shooting){const hitP=Math.max(.12,Math.min(.75,.85-d/TOWER.range*.35-Math.abs(t.v||0)*.028));e.muz.getWorldPosition(_twM);
    e.dmg+=TOWER.dps*hitP*dt;e.dmgT+=dt;if(e.dmgT>=TOWER.dmgTick){e.dmgT=0;const dd=e.dmg;e.dmg=0;
      if(t===PLT)damagePlayer(dd,_twM);else{dmgBy='enemy';damageEnemy(t,dd);dmgBy='player'}}
    e.trT-=dt;if(vis&&e.trT<=0){e.trT=TOWER.tracer;const end=_tw2.set(t.x,t.y+1,t.z);
      if(Math.random()>hitP){end.x+=rnd(-2,2);end.z+=rnd(-2,2);end.y=gh(end.x,end.z)+rnd(0,.6);if(Math.random()<.4)smoke(end.clone(),new THREE.Vector3(rnd(-.4,.4),rnd(.6,1.2),rnd(-.4,.4)),0x8A7A60,.12,.6,rnd(.4,.7),.5)}
      const a=e.line.geometry.attributes.position.array;_tw.lerpVectors(_twM,end,rnd(0,.35));a[0]=_tw.x;a[1]=_tw.y;a[2]=_tw.z;_tw.lerpVectors(_twM,end,rnd(.55,1));a[3]=_tw.x;a[4]=_tw.y;a[5]=_tw.z;
      e.line.geometry.attributes.position.needsUpdate=true;e.line.visible=true;e.lineT=.035}}
  e.lineT-=dt;if(e.lineT<=0)e.line.visible=false;
  e.muz.getWorldPosition(e.mf.position);e.mf.material.opacity=shooting&&vis?rnd(.5,1):0;e.mf.scale.setScalar(shooting?rnd(.4,.7):.01);
  // grenade pod: a salvo when the racer is in its band and the head is on it
  if(t)e.reload-=dt;
  if(t&&e.los&&e.salvo===0&&e.reload<=0&&d>TOWER.min&&d<TOWER.far&&ye<.15){
    e.salvo=TOWER.salvo;e.salvoT=0;e.reload=rnd(...TOWER.reload)}
  if(e.salvo>0&&t){e.salvoT-=dt;if(e.salvoT<=0){towerShot(e,t);e.salvo--;e.salvoT=TOWER.gap}}
  // lamp: brightens as the next salvo gets close (the tell), white on a hit
  e.flash=Math.max(0,e.flash-dt*4);e.lampM.emissiveIntensity=t?.6+3*Math.max(0,1-e.reload/1.2):.3+.2*Math.sin(clock*3+e.x);e.lampM.emissive.setHex(e.flash>0?0xffffff:0xff2a10)}

// Wrecked (from killEnemy): charred, the head topples off; the player's kill pays shells
function towerDie(e,credit){e.hp=0;e.dead=true;e.deadT=0;e.bar.style.display='none';e.salvo=0;e.mgOn=false;e.mf.material.opacity=0;e.line.visible=false;
  e.g.traverse(o=>{if(o.isMesh)o.material=charM});e.neon.visible=false;e.glow.visible=false;
  const a=Math.random()*6.28;e.fx=Math.cos(a);e.fz=Math.sin(a);e.landed=false;
  foeBlast=true;explode(new THREE.Vector3(e.x,e.y+TOWER.headY+.5,e.z),1.6);foeBlast=false;
  if(credit){RS.ammo+=TOWER.bounty;RS.got+=TOWER.bounty;toast(`Gun tower down · +${TOWER.bounty} shells`,2.4);dropScrap(e.x,e.z,10)}}
// The nearest tower minigun that is firing (for the shared minigun loop in turretTick), or null
function towerMg(){let best=null,bd=1e9;for(const e of gunTowers)if(e.mgOn){const d=Math.hypot(e.x-cam.position.x,e.z-cam.position.z);if(d<bd){bd=d;best=e}}
  return best?_twS.set(best.x,best.y+TOWER.headY+.6,best.z):null}
