// Gyro mode (mode 3, key 4): the wheels swing out flat on the stabilizer struts and become rotors; the rig flies at a set
// height (climbing over roofs) and drops heavy bombs (same power and structural hits as artillery shells) from a 4-bomb rack.
// Flying builds heat; overheating forces a landing until it cools. Fragile in the air, and crawlers shoot it with flak.
// Must land to transform out (setMode queues it in GY.land). Loads after every vehicle part exists: it adds the 4th pose.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const GYRO={alt:[8,26],alt0:14,spd:13,turn:1.7,heat:6,bombs:4,refill:3,flakR:46,flakDmg:6};
const GY={alt:GYRO.alt0,bombs:GYRO.bombs,refT:0,land:null,spinK:0,spinA:0,whT:0};
const gyroAir=()=>mode===3&&car.y-gh(car.x,car.z)>2.5;

// ---------- 4th pose for every part: buggy layout, except wheels (flat rotors) and struts (arms out to the rotors) ----------
const blades=[];
parts.forEach(pt=>{const p0=pt.po[0];pt.po[3]=p0;
  if(p0.r[0]===PI/2&&pt.o.geometry){ // tyres and hubs
    const sx=Math.sign(p0.p[0]),sz=Math.sign(p0.p[2]),tyre=pt.o.geometry.parameters.radiusTop>.4;
    pt.po[3]=ps([sx*1.3,tyre?1.62:1.7,sz*1.62],[0,0,0],tyre?[1.45,.22,1.45]:[1,.5,1]);
    if(tyre){const bm=mk(new THREE.CircleGeometry(1.2/1.45,24).rotateX(-PI/2),rotorM,0,.3,0,pt.o);bm.castShadow=false;bm.visible=false;blades.push(bm); // blur disc
      [0,PI/2].forEach(a=>{const b=mk(B(1.6,.12,.09),steel,0,.26,0,pt.o);b.rotation.y=a;b.visible=false;blades.push(b)})}}
  else if(p0.r[2]===0&&pt.po[2]&&pt.po[2].r[2]===.6){ // stabilizer struts become rotor arms
    const x=p0.p[0],z=p0.p[2];pt.po[3]=ps([Math.sign(x)*1.3,1.5,z*.86],[-Math.sign(z)*PI/2,0,0])}});
// bomb rack under the hull: tucked in the other modes
const rack=grp();add(B(1.7,.08,.95),steel,0,.12,0,rack);const bombMeshes=[];
[[-.45,.3],[-.45,-.3],[.45,.3],[.45,-.3]].forEach(([x,z])=>{const b=grp(rack);b.position.set(x,-.05,z);add(C(.13,.55,10),olive,0,0,0,b).rotation.z=PI/2;
  add(new THREE.SphereGeometry(.13,10,8),olive,.28,0,0,b);add(new THREE.ConeGeometry(.15,.22,4),rusty,-.36,0,0,b).rotation.z=PI/2;add(C(.135,.05,10),hazard,.1,0,0,b).rotation.z=PI/2;bombMeshes.push(b)});
{const tuck=ps([0,.75,0],[0,0,0],[.01,.01,.01]);P(rack,tuck,tuck,tuck);parts[parts.length-1].po[3]=ps([0,.5,0])}
parts.forEach(pt=>apply(pt,pt.po[0],pt.po[0],1)); // start in the buggy pose (includes parts added after vehicle.js: turrets, rack)

// ---------- Flight (called from drive) ----------
// Heading/speed from WASD; height eases toward GY.alt above the ground or 4 m over the highest roof under or ahead.
// Overheated, landing for a transform, or wrecked: descend (holding over roofs until clear) and settle on the ground.
const gyDown=()=>HEAT.over||GY.land!=null||pl.dead;
function gyroDrive(dt,f,t){const onGround=car.y-gh(car.x,car.z)<.35,can=!(gyDown()&&onGround)&&!pl.dead,tv=can?(f>0?GYRO.spd*UPG.spd:f<0?-6:0):0;
  car.v+=(tv-car.v)*Math.min(1,dt*(f?1.1:.8));car.h+=can?t*GYRO.turn*dt:0}
function gyroAlt(dt,t){const g=gh(car.x,car.z),down=gyDown();
  const fx=Math.cos(car.h),fz=-Math.sin(car.h),ax=car.x+fx*car.v*.9,az=car.z+fz*car.v*.9,roof=Math.max(roofAt(car.x,car.z),roofAt(ax,az));
  let want=down?(roof>g-1?roof+4:g):Math.max(g+GY.alt,gh(ax,az)+GY.alt*.7,roof+4);if(pl.dead)want=g;
  const dy=want-car.y,rate=dy<0?(pl.dead?16:down?8:5):7;car.y+=Math.sign(dy)*Math.min(Math.abs(dy),rate*dt*Math.min(1,Math.abs(dy)/1.5+.25));if(car.y<g)car.y=g;
  const air=car.y-g>.35,k=Math.min(1,dt*3);
  car.pitch+=((air?-car.v*.022:0)-car.pitch)*k;car.roll+=((air?-t*.16*Math.min(1,Math.abs(car.v)/5+.3):0)-car.roll)*k;
  if(GY.land!=null&&!air){const m=GY.land;GY.land=null;car.v=0;setMode(m)}}

// ---------- Bombs ----------
function dropBomb(){if(!gyroAir()||GY.bombs<=0)return false;GY.bombs--;GY.refT=0;
  const fx=Math.cos(car.h),fz=-Math.sin(car.h),p=new THREE.Vector3(car.x,car.y+.2,car.z),v=new THREE.Vector3(fx*car.v*.9,-2,fz*car.v*.9);
  const sh=spawnShell(p,v,FIRE[3][1],'player',.18,0xFF8030,.6);sh.heavy=true;
  if(audio()){const t=AC.currentTime,h=Math.max(1,car.y-gh(car.x,car.z)),ft=(-2+Math.sqrt(4+19.6*h))/9.8;nz(t,.15,2600,600,.3,'bandpass'); // release clunk
    // falling whistle (sfx/bomb-drop.mp3): play the last ft seconds before its peak at 4.8 s, so it peaks as the bomb lands
    const s=spot(p,.03);if(!sfx('bomb-drop',{off:Math.max(0,4.8-ft),dur:Math.min(4.8,ft),fade:.06,vol:.9*s.a,pan:s.pan}))th(t+.1,1500,520,ft,.05)}
  return true}
const bombStart=new THREE.Vector3(),bombVel=new THREE.Vector3();
function bombLaunch(){bombStart.set(car.x,car.y+.2,car.z);bombVel.set(Math.cos(car.h)*car.v*.9,-2,-Math.sin(car.h)*car.v*.9)}

// ---------- Per frame (main loop): rotors, rack, sound, status ----------
let gyLastSt='';
function gyroTick(dt){const on=mode===3&&(!run||T>.45),g=gh(car.x,car.z),air=car.y-g>.35;
  blades.forEach(b=>b.visible=on);
  GY.spinK+=((on?(air||!HEAT.over?1:.25):0)-GY.spinK)*Math.min(1,dt*2);GY.spinA+=GY.spinK*30*dt;
  if(on)wheels.forEach((w,i)=>w.rotation.y=GY.spinA*(i%2?1:-1));
  if(mode===3&&GY.bombs<GYRO.bombs){GY.refT+=dt;if(GY.refT>=GYRO.refill*RELOAD[3]/RELOAD_BASE[3]){GY.refT=0;GY.bombs++}}
  bombMeshes.forEach((b,i)=>b.visible=i<GY.bombs);
  // rotor wash: dust ring under the rig when low
  if(on&&GY.spinK>.5&&car.y-g<10&&Math.random()<dt*14){const a=Math.random()*6.28,r=rnd(1.5,3);smoke(new THREE.Vector3(car.x+Math.cos(a)*r,g+.2,car.z+Math.sin(a)*r),new THREE.Vector3(Math.cos(a)*rnd(4,7),rnd(.2,.6),Math.sin(a)*rnd(4,7)),0x8A7A60,.4,rnd(1.4,2.2),rnd(.8,1.3),.35*(1-(car.y-g)/10))}
  if(AC&&SFX.drone&&mode===3){const s=spot(root.position,.03);loopSnd('drone',soundOn?Math.min(1.2,1.4*s.a)*GY.spinK:0,.55+.12*GY.spinK+Math.min(.12,Math.abs(car.v)*.008),s.pan)}
  if(mode===3&&!run){const st2=pl.dead?'':GY.land!=null?'Gyro · landing to transform…':HEAT.over?(air?'Gyro · overheated: landing to vent':'Gyro · venting heat · defence turrets up'):
    'Gyro · bombs '+GY.bombs+'/'+GYRO.bombs+' · alt '+Math.round(car.y-g)+' m · WASD fly, scroll altitude, click to drop (hold for a stick)';
    if(st2&&st2!==gyLastSt)st.textContent=gyLastSt=st2}else gyLastSt=''}
function resetGyro(){GY.bombs=GYRO.bombs;GY.refT=0;GY.land=null;GY.alt=GYRO.alt0}

// Crawler flak at the airborne gyro (same tracers as at the drone): bursts within GYRO.flakR with a clear line
function gyroFlak(e,dt){if(!gyroAir()||pl.dead||e.stun>0){e.gflakT=Math.max(e.gflakT||0,1);return}
  const o=new THREE.Vector3(e.x,e.y+1.6,e.z),tp=new THREE.Vector3(car.x,car.y+.8,car.z),d=o.distanceTo(tp);if(d>GYRO.flakR){e.gflakT=Math.max(e.gflakT||0,rnd(.8,1.6));return}
  e.gflakT=(e.gflakT??rnd(1,2))-dt;if(e.gflakT>0)return;e.gflakT=rnd(2,3);
  if(!fireLine(o.clone(),tp.clone()))return;
  const pHit=Math.max(.15,.7-d/GYRO.flakR*.35-Math.min(.25,Math.abs(car.v)*.015));
  for(let i=0;i<3;i++){const hit=Math.random()<pHit,end=tp.clone();if(!hit)end.add(new THREE.Vector3(rnd(-1,1),rnd(-.5,1),rnd(-1,1)).normalize().multiplyScalar(rnd(2.5,4.5)));
    const gm=new THREE.BufferGeometry().setFromPoints([o.clone(),end]),ln=new THREE.Line(gm,tracerM);ln.frustumCulled=false;addFx(ln,.09,(f,k)=>{if(k>.9)gm.dispose()},i*.11);
    if(hit)addFx(null,.02,f=>{if(!f.hit){f.hit=1;if(gyroAir())damagePlayer(GYRO.flakDmg,o)}},i*.11+d/400)}
  if(audio()){const s=spot(o,.04);if(!sfx('gun-shot',{t:s.t,off:SFX_CUT.gun[0][0],dur:.4,fade:.2,vol:.45*s.a,rate:1.7,pan:s.pan,lp:s.lp}))nz(s.t,.15,6000,1500,.3*s.a,'bandpass')}}
