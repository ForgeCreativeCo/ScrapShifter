// Mech walk/run gait, leg IK, and the Tune panel.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Mech walk/run: procedural gait + two-bone leg IK ----------
// Each leg cycles u in [0,1): stance [0,duty) the foot slides back exactly as far as the body moves (planted),
// swing [duty,1) it lifts and steps forward. Legs are half a cycle apart, so duty>.5 gives a heavy double-support walk
// and duty<.5 gives a run with a flight phase. Leg parts live in root space, x forward, y up.
// TUNE is live-editable from the Tune panel (T) and saved in this browser.
const TUNE_DEF={walk:4.1,run:12,back:1.8,turn:1.1,accel:6.8,stride:1.7,runStride:2.6,stepH:.45,runStepH:.7,duty:.45,runDuty:.27,crouch:.22,bob:.1,sway:.035,lurch:.55,shake:.205}; // Joe's tuned values
const TUNE=Object.assign({},TUNE_DEF);try{Object.assign(TUNE,JSON.parse(localStorage.getItem('scrapTune')||'{}'))}catch(e){}
const HIP_Y=2.5,ANK_Y=.35,L1=1.15,L2=1.05;
const LEGS=[{th:parts[0],sh:parts[2],ft:parts[4],kn:[parts[6],parts[7]],off:0},{th:parts[1],sh:parts[3],ft:parts[5],kn:[parts[8],parts[9]],off:.5}];
let gaitU=0,gaitW=0,ikK=0,stepBob=0,runK=0;const G={S:1.7,D:.55,H:.45,C:.3};
function footfall(leg,w){const p=new THREE.Vector3();leg.ft.o.getWorldPosition(p);p.y=gh(p.x,p.z)+.1;const r=1+runK;
  trauma=Math.min(1,trauma+TUNE.shake*w*r);
  for(let i=0;i<Math.round(7*r);i++){const a=Math.random()*6.28,s=rnd(1.2,2.6)*r;smoke(p.clone().add(new THREE.Vector3(Math.cos(a)*.35,0,Math.sin(a)*.35)),new THREE.Vector3(Math.cos(a)*s,rnd(.1,.5),Math.sin(a)*s),0x8A7A60,.35,rnd(1.2,1.9)*(1+runK*.4),rnd(.8,1.4),.4*w)}
  if(audio()){const t=AC.currentTime;th(t,75+runK*15,28,.3,Math.min(1,.6*w*(1+runK*.4)));nz(t,.35,700+runK*500,60,.45*w);nz(t+.02,.12,2400,900,.15*w*r,'bandpass')}}
function gait(dt,moved,turn){
  const active=mode===2&&!run;ikK=active?Math.min(1,ikK+dt*3):0;
  if(!active){gaitW=0;stepBob=0;runK=0;return}
  runK=cl((Math.abs(car.v)-TUNE.walk)/Math.max(.1,TUNE.run-TUNE.walk));
  G.S=L(TUNE.stride,TUNE.runStride,runK);G.D=L(TUNE.duty,TUNE.runDuty,runK);G.H=L(TUNE.stepH,TUNE.runStepH,runK);G.C=TUNE.crouch+runK*.15;
  const want=Math.min(1,Math.abs(moved)/dt/1.2+Math.abs(turn)*1.2); // full gait above ~1.2 m/s, or when turning in place
  gaitW+=(want-gaitW)*Math.min(1,dt*(want>gaitW?6:3));
  // one cycle covers S/D of ground, so the planted foot moves exactly with the body
  const du=(moved+(moved>=0?1:-1)*Math.abs(turn)*dt*.9)*G.D/G.S,prevU=gaitU;
  gaitU=((gaitU+du)%1+1)%1;
  if(gaitW>.3)LEGS.forEach(leg=>{const a=(prevU+leg.off)%1,b=(gaitU+leg.off)%1;
    if((du>0&&b<a)||(du<0&&a>=G.D&&b<G.D))footfall(leg,gaitW)}); // forward lands at u=0, reverse lands at u=duty
  // body dips at each footfall, rises mid-stride (deeper when running); idles with a slow hydraulic breathe
  const amp=TUNE.bob*(1+.8*runK);
  stepBob=gaitW*(-amp+amp*Math.abs(Math.sin(2*PI*gaitU)))+(1-gaitW)*.025*Math.sin(clock*1.6)}
function legTarget(u,w){const{S,D,H}=G;let x,l=0;if(u<D)x=S/2-S*u/D;else{const s=(u-D)/(1-D);x=-S/2+S*ss(s);l=H*Math.sin(PI*s)}return[x*w,l*w]}
function poseLegs(){if(ikK<=0)return;const bob=stepBob*ikK;
  const set=(pt,x,y,rz)=>{const p=pt.po[2];pt.o.position.x=L(p.p[0],x,ikK);pt.o.position.y=L(p.p[1],y,ikK);pt.o.rotation.z=L(p.r[2],rz,ikK)};
  LEGS.forEach(leg=>{const[fx,lf]=legTarget((gaitU+leg.off)%1,gaitW);
    const ax=fx,ay=ANK_Y+G.C*ikK+lf-bob; // root is lowered by the crouch; counter the bob so planted feet stay down
    const d=Math.min(Math.hypot(ax,ay-HIP_Y),L1+L2-.01),a=Math.atan2(ay-HIP_Y,ax);
    const ta=a+Math.acos(cl((L1*L1+d*d-L2*L2)/(2*L1*d))); // knee bends forward
    const kx=Math.cos(ta)*L1,ky=HIP_Y+Math.sin(ta)*L1,ex=Math.cos(a)*d,ey=HIP_Y+Math.sin(a)*d;
    set(leg.th,kx/2,(HIP_Y+ky)/2,ta+PI/2);
    set(leg.sh,(kx+ex)/2,(ky+ey)/2,Math.atan2(ey-ky,ex-kx)+PI/2);
    set(leg.ft,ex+.12,ey-.2,lf*.5); // toe tips up during swing
    leg.kn.forEach(pt=>set(pt,kx+.1,ky,pt.po[2].r[2]))})} // wheel knee guards ride the knee

// ---------- Tuning panel (mech gait) ----------
const TSPEC=[['Speed'],['walk','Walk speed',1,6,.1],['run','Run speed (Shift)',3,12,.1],['back','Reverse speed',.5,4,.1],['turn','Turn rate',.4,2.5,.05],['accel','Acceleration',.5,8,.1],
  ['Stride'],['stride','Walk stride',.8,2.4,.05],['runStride','Run stride',1.2,3.2,.05],['stepH','Walk step height',.1,.9,.01],['runStepH','Run step height',.2,1.2,.01],['duty','Walk foot-down time',.4,.75,.01],['runDuty','Run foot-down time',.25,.5,.01],
  ['Weight'],['crouch','Crouch',0,.6,.01],['bob','Body dip per step',0,.3,.005],['sway','Side sway',0,.12,.005],['lurch','Lurch',0,1,.01],['shake','Footfall shake',0,.3,.005]];
const tp=document.getElementById('tune'),tb=document.getElementById('tuneBtn');
const saveTune=()=>{try{localStorage.setItem('scrapTune',JSON.stringify(TUNE))}catch(e){}};
function buildTune(){tp.innerHTML='';TSPEC.forEach(([k,name,mn,mx,stp])=>{if(!name){const h=document.createElement('h4');h.textContent=k;tp.appendChild(h);return}
  const l=document.createElement('label'),b=document.createElement('b'),i=document.createElement('input');l.append(name,b,i);
  Object.assign(i,{type:'range',min:mn,max:mx,step:stp,value:TUNE[k]});const show=()=>b.textContent=(+TUNE[k]).toFixed(stp<.01?3:2);show();
  i.oninput=()=>{TUNE[k]=+i.value;show();saveTune()};i.onchange=()=>i.blur(); // blur so WASD goes back to driving
  tp.appendChild(l)});
  const row=document.createElement('div');row.className='row';const cp=document.createElement('button'),rs=document.createElement('button');cp.textContent='Copy values';rs.textContent='Defaults';row.append(cp,rs);tp.appendChild(row);
  // Clipboard is often blocked (file:// or data: pages), so always show the values in a box too
  const out=document.createElement('textarea');out.readOnly=true;out.rows=4;out.style.cssText='display:none;width:100%;margin-top:8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;font:11px ui-monospace,monospace;padding:6px;resize:vertical';tp.appendChild(out);
  cp.onclick=()=>{out.value=JSON.stringify(TUNE);out.style.display='block';out.focus();out.select();
    let ok=false;try{ok=document.execCommand('copy')}catch(e){}
    if(!ok&&navigator.clipboard)navigator.clipboard.writeText(out.value).then(()=>{cp.textContent='Copied'},()=>{cp.textContent='Select and copy below'});
    cp.textContent=ok?'Copied':'Select and copy below';setTimeout(()=>cp.textContent='Copy values',2500)};
  rs.onclick=()=>{Object.assign(TUNE,TUNE_DEF);saveTune();buildTune()}}
buildTune();
const toggleTune=()=>{tp.classList.toggle('open');tb.classList.toggle('on',tp.classList.contains('open'))};tb.onclick=toggleTune;

// ---------- Mech shield bash (F) ----------
// Wind up, lunge, slam the shield arm forward. The arm parts rotate about the shoulder in the hull's x/y plane.
// The hit lands at t=.5: one-shots a crawler (knockback + stun) and smashes target stacks in front.
const SMASH={t:-1,cd:0,hit:false},SMASH_TIME=.6,SMASH_CD=1.1,SMASH_DMG=75,SMASH_R=2.2,SHOULDER=[0,4.1];
function smash(){if(mode!==2||run||pl.dead||SMASH.cd>0)return;SMASH.t=0;SMASH.cd=SMASH_CD;SMASH.hit=false;
  if(audio()){const t=AC.currentTime;nz(t,.35,500,2600,.2,'bandpass');th(t,180,320,.3,.12)}} // servo whine on the wind-up
function smashAngle(t){ // arm swing (rad) and forward thrust over the bash
  if(t<0)return[0,0];if(t<.4)return[-.9*ss(t/.4),0];if(t<.55)return[L(-.9,1.35,ss((t-.4)/.15)),ss((t-.4)/.15)*.35];
  if(t<.7)return[1.35,.35];const k=ss((t-.7)/.3);return[L(1.35,0,k),L(.35,0,k)]}
function smashHit(){const fx=Math.cos(car.h),fz=-Math.sin(car.h),rx=Math.sin(car.h),rz=Math.cos(car.h);
  const c=new THREE.Vector3(car.x+fx*2.3+rx*.5,0,car.z+fz*2.3+rz*.5);c.y=gh(c.x,c.z)+.3;let hits=0;
  enemies.forEach(e=>{if(!e.dead&&Math.hypot(e.x-c.x,e.z-c.z)<SMASH_R+1.2){damageEnemy(e,SMASH_DMG);e.kx+=fx*9;e.kz+=fz*9;e.stun=1.2;hits++}});
  targets.slice().forEach(o=>{const h=o.userData.h,dx=Math.max(Math.abs(o.position.x-c.x)-h.x,0),dz=Math.max(Math.abs(o.position.z-c.z)-h.z,0);
    if(Math.hypot(dx,dz)<SMASH_R&&o.position.y<car.y+5.5){shatter(o,new THREE.Vector3(car.x,car.y+1.5,car.z),9);hits++}});
  for(let i=0;i<10;i++){const a=Math.random()*6.28,s=rnd(2,5);smoke(c.clone().add(new THREE.Vector3(Math.cos(a)*.4,0,Math.sin(a)*.4)),new THREE.Vector3(Math.cos(a)*s+fx*3,rnd(.2,1),Math.sin(a)*s+fz*3),0x8A7A60,.4,rnd(1.6,2.6),rnd(1,1.8),.5)}
  if(hits){sparks(c.clone().setY(c.y+1.5),16);trauma=Math.min(1,trauma+.55);slowT=.07;
    if(audio()){const t=AC.currentTime;th(t,95,28,.45,.95);nz(t,.5,1800,90,.75);nz(t,.25,4200,1200,.45,'bandpass')}}
  else{trauma=Math.min(1,trauma+.15);if(audio()){const t=AC.currentTime;nz(t,.3,2400,400,.3,'bandpass')}}}
function smashTick(dt){SMASH.cd=Math.max(0,SMASH.cd-dt);if(SMASH.t<0)return;
  if(mode!==2||run){SMASH.t=-1;return}
  const prev=SMASH.t;SMASH.t+=dt/SMASH_TIME;
  if(prev<.4&&SMASH.t>=.4)car.v=Math.max(car.v,0)+4; // lunge into the swing
  if(!SMASH.hit&&SMASH.t>=.5){SMASH.hit=true;smashHit()}
  if(SMASH.t>=1)SMASH.t=-1}
function poseArm(){if(mode!==2||run)return;const[th,push]=smashAngle(SMASH.t),c=Math.cos(th),s=Math.sin(th);
  [ARM.upper,ARM.fore,ARM.shield].forEach(pt=>{const p=pt.po[2].p,x=p[0]-SHOULDER[0],y=p[1]-SHOULDER[1];
    pt.o.position.x=SHOULDER[0]+x*c-y*s+push;pt.o.position.y=SHOULDER[1]+x*s+y*c;pt.o.rotation.z=pt.po[2].r[2]+th})}
