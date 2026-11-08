// Rival rigs: machines like the player's. Each is a clone of the player's rig (whatever upgrades it has bolted on),
// tinted red, with its own copy of the part poses, so it transforms between buggy, artillery, mech and gyro the same way.
// Spawned by the wanted system (js/wanted.js) from level 3. They live in `enemies` (type 'rig'), so shells, blasts,
// the minigun turrets, the drone laser, health bars and scrap drops all work on them as on crawlers.
// AI: pick a mode by distance (far: buggy to close in; mid: artillery lobs; near: buggy strafing; close: mech brawl
// with a shield bash), and at wanted 4+ occasionally a gyro bombing run. Transforming leaves it exposed (1.5x damage).
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const RIG={hp:300*FOE_HP,armor:[1.25,.7,.85,1.4],tArmor:1.5,minMode:5,
  gun:[{spd:30,pw:.7,reload:1.6,range:70,spread:1.6},{spd:37,pw:1.8,reload:4.5,range:135},{spd:34,pw:.35,reload:.24,range:45,spread:1.8,burst:3},{pw:1.8}],
  band:{far:125,art:60,mech:20},spd:[13,0,4.2,12],turn:[2.2,0,1.8,1.7],mechRun:6.5,gyroAlt:14,bashCd:4.5,bashDmg:22,bashR:4.2,
  hh:[2.2,2.6,5.2,1.9],barY:[3,3.4,6.2,2.8]};
const rigTints=new Map(),RIG_TINT=new THREE.Color(1,.55,.5);
function rigTint(m){if(!m||!m.color)return m;let t=rigTints.get(m);if(!t){t=m.clone();t.color=m.color.clone().multiply(RIG_TINT);rigTints.set(m,t)}return t}
const PIV_I=parts.findIndex(pt=>pt.o===piv);
const _rv1=new THREE.Vector3(),_rv2=new THREE.Vector3(),_rv3=new THREE.Vector3();

function makeRig(x,z){const src=[];root.traverse(o=>src.push(o));const g=root.clone(true),dst=[];g.traverse(o=>dst.push(o));const map=o=>dst[src.indexOf(o)];
  g.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(rigTint):rigTint(o.material)});
  g.rotation.order='YZX';sc.add(g);
  const ps2=parts.map(pt=>({o:map(pt.o),po:pt.po}));ps2.forEach(pt=>apply(pt,pt.po[0],pt.po[0],1));
  const lampM=new THREE.MeshStandardMaterial({color:0x2a0805,emissive:0xff2a10,emissiveIntensity:1.5});mk(new THREE.SphereGeometry(.13,10,8),lampM,0,.33,0,map(cab));
  const bar=document.createElement('div');bar.className='ebar';bar.innerHTML='<i></i>';ebars.appendChild(bar);
  const e={type:'rig',g,parts:ps2,piv:map(piv),muz:map(muz),wheels:wheels.map(map),blades:blades.map(map),bombs:bombMeshes.map(map),lampM,bar,
    x,z,y:gh(x,z),h:Math.atan2(-(car.z-z),car.x-x),v:0,pitch:0,roll:0,hp:RIG.hp,maxHp:RIG.hp,dead:false,deadT:0,flash:0,kx:0,kz:0,stun:0,rammed:-9,
    r:1.6,hh:RIG.hh[0],barY:RIG.barY[0],mode:0,prev:0,T:9,run:false,modeT:0,reload:2,burst:0,heat:0,nbombs:4,bombT:0,bashT:0,gait:0,spin:0,
    losT:0,los:false,thinkT:0,lead:rnd(.6,.9),strafe:Math.random()<.5?1:-1,strafeT:rnd(3,6),gyroCd:rnd(8,16),pass:0,landing:null,stepS:1,wp:null};
  e.armor=()=>e.run?RIG.tArmor:RIG.armor[e.mode];
  e.mark=addMark('rival',()=>e.dead?null:_mp.set(e.x,e.y+e.barY+.8,e.z),()=>'Rival rig',()=>e.hp/e.maxHp);
  tuneEnv(g);enemies.push(e);return e}

function rigSetMode(e,m){if(m===e.mode&&!e.run)return;e.prev=e.mode;e.mode=m;
  e.parts.forEach(pt=>{const o=pt.o;pt.f={p:o.position.toArray(),r:[o.rotation.x,o.rotation.y,o.rotation.z],s:o.scale.toArray()}});
  e.T=0;e.run=true;e.modeT=0;e.reload=Math.max(e.reload,1.2);e.burst=0;e.hh=RIG.hh[m];e.barY=RIG.barY[m];
  if(m===3){e.nbombs=4;e.heat=0}
  if(audio()){const s=spot(_rv1.set(e.x,e.y+1,e.z),.04);sfx(m===2||e.prev===2?'transform-a':'transform-b',{t:s.t,vol:.8*s.a,rate:rnd(.95,1.05),pan:s.pan,lp:s.lp})}}

// which mode the rig wants for a target at horizontal distance d
function rigWantMode(e,d){
  if(e.mode===3)return e.nbombs<=0||e.heat>=90||e.modeT>18?(d<RIG.band.mech?2:0):3;
  if(e.modeT<RIG.minMode&&!(e.mode===1&&d<25))return e.mode;
  if(WANT.level>=4&&e.gyroCd<=0&&d>30&&d<110){e.gyroCd=rnd(25,40);return 3}
  return d>RIG.band.far?0:d>RIG.band.art?1:d>RIG.band.mech?0:2}

// low or high ballistic solution from o to t at speed v: {th (elevation), yw (world heading), tf (flight time)} or null
function ballistic(o,t,v,high){const dx=t.x-o.x,dz=t.z-o.z,dy=t.y-o.y,dh=Math.max(.5,Math.hypot(dx,dz)),g=9.8,disc=v**4-g*(g*dh*dh+2*dy*v*v);
  if(disc<0)return null;const th=Math.atan2(v*v+(high?1:-1)*Math.sqrt(disc),g*dh);return{th,yw:Math.atan2(-dz,dx),tf:dh/(v*Math.cos(th))}}

function rigShoot(e,G,s,heavy){const p=new THREE.Vector3();e.muz.getWorldPosition(p);
  const v=new THREE.Vector3(Math.cos(s.th)*Math.cos(s.yw),Math.sin(s.th),-Math.cos(s.th)*Math.sin(s.yw)).multiplyScalar(G.spd*rnd(.985,1.015));
  const sh=spawnShell(p,v,G.pw,e,heavy?.2:.1,0xFF4030,heavy?1.2:.6);sh.heavy=heavy;
  if(e.mode!==2){const hit=simShell(p,v,e);if(hit){const w=new THREE.Mesh(warnGeo,new THREE.MeshBasicMaterial({color:0xE5533D,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide}));
    w.position.copy(hit);w.position.y=Math.max(hit.y,gh(hit.x,hit.z))+.07;w.scale.setScalar((2.3*G.pw+1.2)/1.9);sc.add(w);sh.warn=w}}
  const fl=S(puffT,0xFFC070,true,1,heavy?2.4:1.3);fl.position.copy(p);addFx(fl,.12,(f,k)=>{fl.material.opacity=1-k;fl.scale.setScalar((heavy?2.4:1.3)*(1+k))});
  for(let i=0;i<(heavy?10:3);i++)smoke(p.clone(),v.clone().multiplyScalar(rnd(.03,.12)),0x8C857A,.3,heavy?2.6:1.5,rnd(1.2,2.2),.5);
  if(audio()){const a=spot(p,.035);
    if(e.mode===1){const[off,dur]=sfxPick(SFX_CUT.tank);sfx('tank-shot',{t:a.t,off,dur,fade:.5,vol:.9*a.a,pan:a.pan,lp:a.lp})}
    else{const[off,dur]=sfxPick(SFX_CUT.gun);sfx('gun-shot',{t:a.t,off,dur:e.mode===2?.45:dur,fade:e.mode===2?.2:0,vol:(e.mode===2?1.3:1.9)*a.a,rate:e.mode===2?rnd(1.1,1.2):rnd(.92,1),pan:a.pan,lp:a.lp})}}}

function rigTick(e,dt){
  const tg=enemyTarget(e),dx=tg?tg.x-e.x:0,dz=tg?tg.z-e.z:0,d=tg?Math.hypot(dx,dz):1e9,toT=Math.atan2(-dz,dx);
  e.x+=e.kx*dt;e.z+=e.kz*dt;const kd=Math.exp(-dt*4);e.kx*=kd;e.kz*=kd;e.stun=Math.max(0,e.stun-dt);
  e.modeT+=dt;e.reload-=dt;e.bashT-=dt;e.gyroCd-=dt;e.bombT-=dt;
  // transform: same staggered part interpolation as the player's (main.js)
  if(e.run){e.T+=dt;let done=true;const n=e.parts.length,fwd=e.mode===2||(e.mode===1&&e.prev===0);
    e.parts.forEach((pt,i)=>{const k=ss(cl((e.T-(fwd?i:n-1-i)*.035)/.55));if(k<1)done=false;apply(pt,pt.f,pt.po[e.mode],k)});if(done)e.run=false}
  if(tg){e.losT-=dt;if(e.losT<=0){e.losT=.4;e.los=fireLine(_rv1.set(e.x,e.y+2,e.z),_rv2.set(tg.x,tg.y+1.2,tg.z))}}else e.los=false;
  const g0=gh(e.x,e.z),air=e.mode===3&&e.y-g0>2.5;
  // brain: switch modes (a flying gyro lands first)
  if(!e.run&&e.stun<=0&&e.landing==null){e.thinkT-=dt;if(e.thinkT<=0){e.thinkT=.5;const m=tg?rigWantMode(e,d):0;if(m!==e.mode){if(air)e.landing=m;else rigSetMode(e,m)}}}
  // movement
  let want=e.h,spd=0;const M=e.mode;
  if(!e.run&&e.stun<=0){
    if(!tg){if(!e.wp||Math.hypot(e.wp.x-e.x,e.wp.z-e.z)<5)e.wp=navRandomPoint();if(M===0||M===2){want=navWant(e,e.wp.x,e.wp.z,dt);spd=RIG.spd[M]*.6}}
    else if(M===0){if(d>40||!e.los){want=navWant(e,tg.x,tg.z,dt);spd=RIG.spd[0]}else{want=toT+e.strafe*PI/2*.8;spd=9;e.strafeT-=dt;if(e.strafeT<0){e.strafe*=-1;e.strafeT=rnd(3,6)}
      const ax=e.x+Math.cos(want)*4,az=e.z-Math.sin(want)*4;if(navBlocked(nIdx(toCell(ax),toCell(az)))){e.strafe*=-1;want=toT+e.strafe*PI/2*.8}}}
    else if(M===2){if(d>RIG.bashR-.6){want=d>8?navWant(e,tg.x,tg.z,dt):toT;spd=d>12?RIG.mechRun:RIG.spd[2]}else want=toT}
    else if(M===3){e.pass-=dt;if(d<8&&e.pass<=0)e.pass=3; // overflown: carry on straight, then come round for another run
      want=e.landing!=null||e.pass>0?e.h:toT;spd=e.landing!=null?4:RIG.spd[3]}}
  if(e.unstick>0&&!air){e.unstick-=dt;want=e.h+e.strafe;spd=-2.5}
  let dh=want-e.h;dh=Math.atan2(Math.sin(dh),Math.cos(dh));const tr=RIG.turn[M]||1.5;e.h+=Math.max(-tr*dt,Math.min(tr*dt,dh));
  e.v+=(spd*(M===3?1:Math.max(0,Math.cos(dh)))-e.v)*Math.min(1,dt*(M===0?1.5:2.5));
  const fx=Math.cos(e.h),fz=-Math.sin(e.h);e.x+=fx*e.v*dt;e.z+=fz*e.v*dt;
  if(!air){navStuck(e,dt,Math.abs(spd)>1&&e.stun<=0);for(const s of solids)pushOut(e,s.x,s.z,1.5+s.r);
    for(const o of targets){const h=o.userData.h;pushOut(e,Math.max(o.position.x-h.x,Math.min(e.x,o.position.x+h.x)),Math.max(o.position.z-h.z,Math.min(e.z,o.position.z+h.z)),1.5)}
    for(const o of enemies)if(o!==e&&!o.dead)pushOut(e,o.x,o.z,3.2);for(const pc of piecesNear(e.x,e.z,2.6))obbPush(e,pc,1.6);
    if(!pl.dead&&!gyroAir())pushOut(e,car.x,car.z,1.6+CR)}
  const lim=PLAY-1;e.x=Math.max(-lim,Math.min(lim,e.x));e.z=Math.max(-lim,Math.min(lim,e.z));
  // height: gyro flies over roofs (lands first to transform); everything else follows the terrain
  const g=gh(e.x,e.z);
  if(M===3&&!e.run){const roof=Math.max(roofAt(e.x,e.z),roofAt(e.x+fx*e.v,e.z+fz*e.v)),down=e.landing!=null,wy=down?(roof>g-1?roof+4:g):Math.max(g+RIG.gyroAlt,roof+4),dy=wy-e.y;
    e.y+=Math.sign(dy)*Math.min(Math.abs(dy),(dy<0?6:7)*dt*Math.min(1,Math.abs(dy)/1.5+.25));if(e.y<g)e.y=g;e.heat+=6*dt;
    const k=Math.min(1,dt*3);e.pitch+=(-e.v*.022-e.pitch)*k;e.roll+=(-dh*.5-e.roll)*k;
    if(down&&e.y-g<.35){const m=e.landing;e.landing=null;e.v=0;rigSetMode(e,m)}}
  else{const sx=Math.sin(e.h),sz=Math.cos(e.h),hf=gh(e.x+fx*1.1,e.z+fz*1.1),hb=gh(e.x-fx*1.1,e.z-fz*1.1),hl=gh(e.x+sx*.95,e.z+sz*.95),hr=gh(e.x-sx*.95,e.z-sz*.95),k=Math.min(1,dt*8);
    e.pitch+=(Math.atan2(hf-hb,2.2)-e.pitch)*k;e.roll+=(-Math.atan2(hl-hr,1.9)-e.roll)*k;e.y+=((hf+hb+hl+hr)/4-e.y)*k}
  // visuals: lift, wheels/rotors, bomb rack, mech legs
  const lift=[0,.4,0,0][M]*(e.run?ss(cl(e.T/.7)):1);let bob=0;
  if(M===0&&!e.run){e.spin+=e.v*dt/.48;e.wheels.forEach(w=>w.rotation.y=-e.spin)}
  const rot=M===3&&(!e.run||e.T>.45);e.blades.forEach(b=>b.visible=rot);if(rot){e.spin+=dt*30;e.wheels.forEach((w,i)=>w.rotation.y=e.spin*(i%2?1:-1))}
  e.bombs.forEach((b,i)=>b.visible=i<e.nbombs);
  if(M===2&&!e.run){e.gait+=Math.abs(e.v)*dt/1.7*PI;const lp=e.parts;
    [0,1].forEach(si=>{const ph=e.gait+(si?PI:0),sw=Math.sin(ph),up=Math.max(0,Math.cos(ph)),th=lp[si],sh=lp[2+si],ft=lp[4+si];
      th.o.position.x=th.po[2].p[0]+sw*.2;th.o.rotation.z=-sw*.25;sh.o.position.x=sh.po[2].p[0]+sw*.4;sh.o.position.y=sh.po[2].p[1]+up*.2;
      ft.o.position.x=ft.po[2].p[0]+sw*.55;ft.o.position.y=ft.po[2].p[1]+up*.35});
    bob=-Math.abs(Math.sin(e.gait))*.12*Math.min(1,Math.abs(e.v)/3);
    const s=Math.sign(Math.sin(e.gait));if(s!==e.stepS&&Math.abs(e.v)>.5){e.stepS=s;if(audio()){const a=spot(_rv1.set(e.x,e.y,e.z),.05);if(a.d<60)sfx('mech-step',{t:a.t,off:.03,vol:.8*a.a,rate:rnd(.9,1),pan:a.pan,lp:a.lp})}}}
  e.g.position.set(e.x,e.y+lift+bob,e.z);e.g.rotation.set(e.roll,e.h,e.pitch);
  // weapons
  if(tg&&!e.run&&e.stun<=0&&!pl.dead){
    if(M===3){if(air&&e.nbombs>0&&e.bombT<=0&&e.landing==null){const h=e.y-gh(e.x,e.z),tf=(-2+Math.sqrt(4+19.6*h))/9.8,ix=e.x+fx*e.v*.9*tf,iz=e.z+fz*e.v*.9*tf;
        if(Math.hypot(ix-tg.x,iz-tg.z)<4){e.nbombs--;e.bombT=.35;e.pass=Math.max(e.pass,2.5);const p=new THREE.Vector3(e.x,e.y+.2,e.z),v=new THREE.Vector3(fx*e.v*.9,-2,fz*e.v*.9);
          const sh=spawnShell(p,v,RIG.gun[3].pw,e,.18,0xFF5030,.6);sh.heavy=true;
          if(audio()){const a=spot(p,.03);sfx('bomb-drop',{t:a.t,off:Math.max(0,4.8-tf),dur:Math.min(4.8,tf),fade:.06,vol:.9*a.a,pan:a.pan,lp:a.lp})}}}}
    else{const G=RIG.gun[M];e.piv.getWorldPosition(_rv1);_rv2.set(tg.x+Math.cos(tg.h||0)*(tg.v||0)*.4*e.lead,tg.y+1,tg.z-Math.sin(tg.h||0)*(tg.v||0)*.4*e.lead);
      if(M===1){const sc2=Math.max(1,d/30);_rv2.x+=rnd(-sc2,sc2);_rv2.z+=rnd(-sc2,sc2);_rv2.y=gh(_rv2.x,_rv2.z)} // artillery scatters with range
      else{_rv2.x+=rnd(-G.spread,G.spread);_rv2.z+=rnd(-G.spread,G.spread)} // light guns spray a little
      const s=ballistic(_rv1,_rv2,G.spd,M===1&&!e.los);
      if(s){let yr=s.yw-e.h;yr=Math.atan2(Math.sin(yr),Math.cos(yr));const pp=e.parts[PIV_I].po[M].r,lim2=M===2?.6:M===0?2.1:PI;
        e.piv.rotation.y=Math.max(-lim2,Math.min(lim2,yr))+pp[1];e.piv.rotation.z=Math.max(-.3,Math.min(1.45,s.th-e.pitch));
        if(M===2&&Math.abs(yr)>.6)e.h+=Math.sign(yr)*Math.min(Math.abs(yr),1.5*dt); // mech turns to bring the arm gun on
        if(e.reload<=0&&d<G.range&&(e.los||M===1)&&Math.abs(yr)<=lim2+.05){rigShoot(e,G,s,M===1);
          if(M===2){e.burst++;e.reload=e.burst>=G.burst?(e.burst=0,rnd(2.5,3.2)):G.reload}else e.reload=G.reload*rnd(.9,1.2)}}}
    // mech shield bash
    if(M===2&&d<RIG.bashR&&e.bashT<=0){e.bashT=RIG.bashCd;const ux=dx/Math.max(d,.01),uz=dz/Math.max(d,.01);
      if(tg===PLT){damagePlayer(RIG.bashDmg*FOE_DMG,_rv3.set(e.x,e.y+2,e.z));car.x+=ux*2.4;car.z+=uz*2.4;car.v*=.3;trauma=Math.min(1,trauma+.45)}else if(tg.max)damageTruck(tg,RIG.bashDmg*2*FOE_DMG);
      sparks(_rv3.set(e.x+ux*2,e.y+2.4,e.z+uz*2),16);if(audio()){const a=spot(_rv3,.04);th(a.t,95,28,.45,.9*a.a);nz(a.t,.5,1800,90,.7*a.a)}}}
  // lamp: brighter when hit or about to fire
  e.flash=Math.max(0,e.flash-dt*4);e.lampM.emissiveIntensity=e.flash>0?4:1+1.5*Math.max(0,1-e.reload);e.lampM.emissive.setHex(e.flash>0?0xffffff:0xff2a10)}

// on death: a flying rig drops out of the sky
function rigDie(e){const g=gh(e.x,e.z);if(e.y-g<1)return;let vy=0;addFx(null,4,(f,k,dt)=>{vy-=9.8*dt;e.y=Math.max(g,e.y+vy*dt);e.g.position.y=e.y;e.g.rotation.x+=dt*2})}
