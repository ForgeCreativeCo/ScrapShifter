// Mode switching, main loop, firing, keyboard controls. Loaded last: starts the loop.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Mode switching and main loop ----------
let mode=0,prev=0,T=9,run=false,lift=0,liftF=0,rec=0,mf=0,lookY=1.2;const LIFT=[0,.4,0],LOOK=[1.2,1.4,2.8],shots=[];let last=performance.now(),clock=0;
const TXT=['Buggy mode. WASD to drive, mouse aims, click to fire.','Artillery mode. Planted, long range.','Mech mode. WASD walk, Shift run (rams through stuff), F shield bash, click to fire. Shield blocks hits from the front.'];
const modeBtns=document.querySelectorAll('button[data-m]');let camPull=1;const _camA=new THREE.Vector3(),_camP=new THREE.Vector3();
function setMode(m){if(pl.dead||(m===mode&&!run))return;prev=mode;mode=m;modeBtns.forEach(b=>b.classList.toggle('on',+b.dataset.m===m));parts.forEach(pt=>{const o=pt.o;pt.f={p:o.position.toArray(),r:[o.rotation.x,o.rotation.y,o.rotation.z],s:o.scale.toArray()}});liftF=lift;T=0;run=true;st.textContent='Transforming…';if(audio()){const t=AC.currentTime;for(let i=0;i<6;i++){nz(t+i*.12,.12,3000,800,.25,'bandpass');th(t+i*.12,rnd(300,500),rnd(80,150),.1,.15)}}}
const mflash=S(puffT,0xFFD27A,true,0,1);sc.add(mflash);
function loop(now){const rdt=Math.min(.05,(now-last)/1000);last=now;clock+=rdt;let ts=1;if(slowT>0){slowT-=rdt;ts=.18}const dt=rdt*ts;
if(run){T+=dt;let done=true;const n=parts.length,fwd=mode===2||(mode===1&&prev===0);parts.forEach((pt,i)=>{const d=(fwd?i:n-1-i)*.035;const k=ss(cl((T-d)/.55));if(k<1)done=false;apply(pt,pt.f,pt.po[mode],k)});lift=L(liftF,LIFT[mode],ss(cl(T/.7)));if(done){run=false;st.textContent=TXT[mode]}}
const {fx:hx,fz:hz}=drive(dt);engineTick();
rec*=Math.exp(-dt*7);gun.position.x=-rec*.45;
const kick=rec*(mode===1?0:.15),bob=(stepBob-G.C)*ikK,sway=mode===2?TUNE.sway*gaitW*ikK*Math.sin(2*PI*gaitU):0;
pl.slump+=((pl.dead?1:0)-pl.slump)*Math.min(1,dt*3); // wrecked: sag and list to one side
root.position.set(car.x-hx*kick,car.y+lift+bob-pl.slump*.35,car.z-hz*kick);
root.rotation.set(car.roll+sway+pl.slump*.22,car.h,car.pitch+rec*(mode===0?.08:mode===1?.04:.02)-pl.slump*.08);
poseLegs();smashTick(dt);poseArm();heatTick(dt);carsTick(dt);reloadT=Math.max(0,reloadT-dt);aimTick(dt);if(firing&&mode!==1)fire(); // hold to keep firing (artillery: one per click)
sun.position.set(car.x+SUN_DIR[0],SUN_DIR[1],car.z+SUN_DIR[2]);if(skyDome)skyDome.position.copy(cam.position);sun.target.position.set(car.x,0,car.z);
muz.position.x=1.6+1.6*extP.scale.x;
mf=Math.max(0,mf-dt*10);muz.getWorldPosition(mflash.position);mflash.material.opacity=mf;mflash.scale.setScalar((mode===1?2.6:1.5)*(.6+(1-mf)*.8));muzL.intensity=mf*7;muzL.position.copy(mflash.position);
flashL.intensity*=Math.exp(-dt*6);
for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.v.y-=9.8*dt;s.m.position.addScaledVector(s.v,dt);s.tt+=dt;if(s.tt>.025){s.tt=0;smoke(s.m.position.clone(),new THREE.Vector3(0,.15,0),0x8C857A,.15,.6,1,.4)}
const sp=s.m.position;const hit=shotHits(sp,s.owner);
if(hit){const p=sp.clone();p.y=Math.max(gh(p.x,p.z)+.1,p.y);sc.remove(s.m);if(s.warn)sc.remove(s.warn);shots.splice(i,1);explode(p,s.pw)}
else if(s.warn){s.warn.material.opacity=.35+.35*Math.sin(clock*18)}}
combatTick(dt);
for(let i=fx.length-1;i>=0;i--){const f=fx[i];if(f.w>0){f.w-=dt;if(f.o)f.o.visible=false;continue}if(f.o)f.o.visible=true;f.k+=dt/f.d;if(f.k>=1){if(f.o){sc.remove(f.o);if(f.o.isSprite)f.o.material.dispose()}fx.splice(i,1);continue}f.u(f,f.k,dt)}
lookY+=(LOOK[mode]-lookY)*Math.min(1,rdt*2);
// chase camera: trail behind the heading with a little lag; drag offset springs back after 1.5s idle
lookIdle+=rdt;if(!drag&&lookIdle>1.5){const e=Math.exp(-rdt*2);lookOff*=e;lookEl*=e}
let dy=(PI-car.h-AIM.yaw*AIM.k)-baseYaw; // artillery: camera sits behind the turret, not the hull
dy=Math.atan2(Math.sin(dy),Math.cos(dy));baseYaw+=dy*Math.min(1,rdt*4);
camR+=((CAM_R[mode]+runK*2.5)*zoom-camR)*Math.min(1,rdt*2);camEl+=(Math.max(.08,Math.min(1.35,CAM_EL[mode]+lookEl))-camEl)*Math.min(1,rdt*3);
// artillery: look partway toward the predicted impact and push the fog back so the far marker stays visible
// the camera stays anchored behind the vehicle (ax,az); only the look target (tx,tz) swings toward the impact
const ak=AIM.k*.35,yaw=baseYaw+lookOff,ax=car.x+hx*2.5,az=car.z+hz*2.5,tx=L(ax,impactP.x,ak),ty=car.y+lookY,tz=L(az,impactP.z,ak);
sc.fog.near=L(MAP.fog[0],MAP.fog[0]+18,AIM.k);sc.fog.far=L(MAP.fog[1],MAP.fog[1]+55,AIM.k);
trauma=Math.max(0,trauma-rdt*1.1);const sh=trauma*trauma*.9,ox=sh*(Math.sin(clock*41)+Math.sin(clock*67))*.5,oy=sh*(Math.sin(clock*53)+Math.sin(clock*29))*.5;
const cx=ax+Math.cos(yaw)*Math.cos(camEl)*camR,cz=az+Math.sin(yaw)*Math.cos(camEl)*camR;
// keep buildings from blocking the view: if a piece sits between the vehicle and the camera, pull the camera in
// (snaps in quickly, eases back out)
{const cy=Math.max(gh(cx,cz)+.6,ty+Math.sin(camEl)*camR),a=_camA.set(car.x,car.y+lookY,car.z);let want=1;
  for(let k=1;k<=18;k++){const f=k/18;_camP.set(L(a.x,cx,f),L(a.y,cy,f),L(a.z,cz,f));if(piecesNear(_camP.x,_camP.z,.4).some(pc=>pieceHitShot(pc,_camP))){want=Math.max(.12,(k-1.6)/18);break}}
  camPull+=(want-camPull)*Math.min(1,rdt*(want<camPull?18:2.5));
  cam.position.set(L(a.x,cx,camPull)+ox,Math.max(gh(L(a.x,cx,camPull),L(a.z,cz,camPull))+.6,L(a.y,cy,camPull))+oy,L(a.z,cz,camPull))}cam.lookAt(tx+ox*.4,ty+oy*.4,tz);
R.render(sc,cam);requestAnimationFrame(loop)}
requestAnimationFrame(loop);
st.textContent=TXT[0]+' Right-drag to look, scroll to zoom.';

// ---------- Controls ----------
function fire(){if(run||reloadT>0||pl.dead)return;reloadT=RELOAD[mode];const p=new THREE.Vector3();muz.getWorldPosition(p);const q=new THREE.Quaternion();gun.getWorldQuaternion(q);const dir=new THREE.Vector3(1,0,0).applyQuaternion(q);const [spd,pw]=FIRE[mode];
spawnShell(p,dir.clone().multiplyScalar(spd),pw,'player',mode===1?.14:.1,0xFFAA50,mode===1?.9:.6);
rec=mode===1?1:.7;mf=1;trauma=Math.min(1,trauma+(mode===1?.35:.18));fireSnd(mode);
for(let i=0;i<(mode===1?10:5);i++)smoke(p.clone(),dir.clone().multiplyScalar(rnd(1.5,5)).add(new THREE.Vector3(rnd(-.6,.6),rnd(0,.8),rnd(-.6,.6))),0x8C857A,rnd(.3,.6),rnd(1.5,2.6)*(mode===1?1.4:1),rnd(1.4,2.6),.55);
if(mode===1){for(let i=0;i<16;i++){const a=Math.random()*6.28,x=car.x+Math.cos(a)*1.4,z=car.z+Math.sin(a)*1.4;smoke(new THREE.Vector3(x,gh(x,z)+.3,z),new THREE.Vector3(Math.cos(a)*rnd(3,6),rnd(.2,.7),Math.sin(a)*rnd(3,6)),0x8A7A60,.6,2.6,rnd(1.4,2.4),.55)}}}
function resetField(){buildTargets();initGround();resetStructures();resetBuildings();resetCombat();HEAT.v=0;HEAT.over=false}
const sb=document.getElementById('snd');
function toggleSound(){soundOn=!soundOn;sb.querySelector('span').textContent=soundOn?'Sound on':'Sound off'}
modeBtns.forEach(b=>b.onclick=()=>setMode(+b.dataset.m));
document.getElementById('fire').onclick=fire;
document.getElementById('rst').onclick=resetField;
sb.onclick=toggleSound;
const DRIVE=['ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
window.addEventListener('keyup',e=>{keys[e.code]=false});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return; // let sliders and the copy box use keys
  if(DRIVE.includes(e.code)){e.preventDefault();keys[e.code]=true;if(audio())engine();return}
  if(e.repeat&&e.code!=='Space')return;if(audio())engine();
  if(e.key==='t'||e.key==='T'){toggleTune();return}
  if(e.key==='1')setMode(0);else if(e.key==='2')setMode(1);else if(e.key==='3')setMode(2);
  else if(e.code==='Space'){e.preventDefault();fire()}else if(e.key==='r'||e.key==='R')resetField();else if(e.key==='m'||e.key==='M')toggleSound();else if(e.key==='f'||e.key==='F')smash()});
// Map picker: reloads the page with ?map=<id>
const mapSel=document.getElementById('mapSel');
Object.entries(MAPS).forEach(([id,m])=>{const o=document.createElement('option');o.value=id;o.textContent='Map: '+m.name;o.selected=id===MAP_ID;mapSel.appendChild(o)});
mapSel.onchange=()=>{const u=new URL(location.href);u.searchParams.set('map',mapSel.value);location.href=u.href};
