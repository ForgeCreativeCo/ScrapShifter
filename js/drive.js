// Driving, collisions, terrain following, engine sound.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Driving ----------
// Vehicle faces local +x. Heading h rotates +x toward -z, so A (left) increases h.
const car={x:0,y:0,z:0,h:0,v:0,pitch:0,roll:0};root.rotation.order='YZX';
const keys={};
const wheels=parts.filter(pt=>pt.po[0].r[0]===PI/2).map(pt=>pt.o);let wheelSpin=0,dustT=0;
const CR=1.5; // vehicle collision radius
const held=(...c)=>c.some(k=>keys[k]);
function clank(pw){if(!audio())return;const t=AC.currentTime;nz(t,.3,2600,300,.5*pw,'bandpass');th(t,170,45,.25,.45*pw)}
function collide(fx,fz){let n=null;
  const push=(dx,dz,d,m)=>{if(d<m&&d>1e-4){car.x+=dx/d*(m-d);car.z+=dz/d*(m-d);n={x:dx/d,z:dz/d}}};
  for(const s of solids){const dx=car.x-s.x,dz=car.z-s.z;push(dx,dz,Math.hypot(dx,dz),CR+s.r)}
  const ramming=mode===2&&!run&&runK>.5; // a running mech ploughs straight through target stacks
  for(const o of targets.slice()){const h=o.userData.h,cx=Math.max(o.position.x-h.x,Math.min(car.x,o.position.x+h.x)),cz=Math.max(o.position.z-h.z,Math.min(car.z,o.position.z+h.z)),dx=car.x-cx,dz=car.z-cz,d=Math.hypot(dx,dz);
    if(ramming&&d<CR+.2&&-(dx*fx+dz*fz)/Math.max(d,.01)>.3){shatter(o,new THREE.Vector3(car.x,car.y+1,car.z),5+Math.abs(car.v));car.v*=.93;trauma=Math.min(1,trauma+.12);continue}
    push(dx,dz,d,CR)}
  for(const pc of pieces){if(pc.state===2)continue;const w=obbPush(car,pc,CR);if(!w)continue;n=w;
    // running mech smashes through walls; a buggy just hits them
    if(ramming&&-(w.x*fx+w.z*fz)>.4&&clock-pc.lastRam>.5){pc.lastRam=clock;damagePiece(pc,RAM_STRUCT*runK,new THREE.Vector3(car.x,car.y+1,car.z));car.v*=.6;trauma=Math.min(1,trauma+.3);return}}
  if(!n)return;
  const into=-(fx*n.x+fz*n.z)*Math.sign(car.v); // how head-on the hit is
  if(into>.3&&Math.abs(car.v)>6){trauma=Math.min(1,trauma+.04*Math.abs(car.v));clank(Math.min(1,Math.abs(car.v)/15));car.v*=-.2}
  else car.v*=.92}
function drive(dt){
  const f=pl.dead?0:(held('KeyW','ArrowUp')?1:0)-(held('KeyS','ArrowDown')?1:0),t=pl.dead?0:(held('KeyA','ArrowLeft')?1:0)-(held('KeyD','ArrowRight')?1:0);
  if(!run&&mode===0){ // buggy: fast, can't turn in place
    if(f>0)car.v+=(car.v<0?30:14)*dt;else if(f<0)car.v-=(car.v>0?30:10)*dt;else car.v*=Math.exp(-dt*.9);
    car.v=Math.max(-7,Math.min(17,car.v));
    car.h+=t*2.2*Math.min(1,Math.abs(car.v)/4)*Math.sign(car.v)*(1-Math.abs(car.v)/45)*dt;
  }else if(!run&&mode===2){ // mech: slow walk, turns in place
    const tv=f>0?(held('ShiftLeft','ShiftRight')?TUNE.run:TUNE.walk):f<0?-TUNE.back:0; // hold Shift to run
    car.v+=(tv-car.v)*Math.min(1,dt*TUNE.accel);car.h+=t*TUNE.turn*(1-.4*runK)*dt;
  }else{ // artillery is planted (the turret aims instead, see aimTick); transforming bleeds off speed
    car.v*=Math.exp(-dt*(run?3:6))}
  if(Math.abs(car.v)<.03&&!f)car.v=0;
  const fx=Math.cos(car.h),fz=-Math.sin(car.h);
  // mech lurches: surges mid-stride, drags at each footfall (gait phase follows actual distance so feet stay planted)
  const lz=TUNE.lurch*(1-.6*runK)*gaitW,lurch=mode===2&&!run?1-lz*.637+lz*Math.abs(Math.sin(2*PI*gaitU)):1; // averages ~1
  const moved=car.v*dt*lurch;
  car.x+=fx*moved;car.z+=fz*moved;
  gait(dt,moved,mode===2&&!run?t*TUNE.turn:0);
  collide(fx,fz);
  const lim=GS/2-3;car.x=Math.max(-lim,Math.min(lim,car.x));car.z=Math.max(-lim,Math.min(lim,car.z));
  // follow terrain: sample front/back and both sides
  const sx=Math.sin(car.h),sz=Math.cos(car.h);
  const hf=gh(car.x+fx*1.1,car.z+fz*1.1),hb=gh(car.x-fx*1.1,car.z-fz*1.1),hl=gh(car.x+sx*.95,car.z+sz*.95),hr=gh(car.x-sx*.95,car.z-sz*.95);
  const k=Math.min(1,dt*10);car.pitch+=(Math.atan2(hf-hb,2.2)-car.pitch)*k;car.roll+=(-Math.atan2(hl-hr,1.9)-car.roll)*k;car.y+=((hf+hb+hl+hr)/4-car.y)*k;
  if(mode===0&&!run){wheelSpin=(wheelSpin+car.v*dt/.48)%(2*PI);wheels.forEach(w=>w.rotation.y=-wheelSpin)}
  // dust kicked up from the rear wheels
  dustT+=dt;if(mode===0&&Math.abs(car.v)>5&&dustT>.05){dustT=0;[1,-1].forEach(s=>{const x=car.x-fx*1.1+sx*.95*s,z=car.z-fz*1.1+sz*.95*s;smoke(new THREE.Vector3(x,gh(x,z)+.2,z),new THREE.Vector3(-fx*car.v*.15+rnd(-.3,.3),rnd(.3,.8),-fz*car.v*.15+rnd(-.3,.3)),0x8A7A60,.3,rnd(1.2,2),rnd(.9,1.5),.3*Math.min(1,Math.abs(car.v)/12))})}
  return{fx,fz}}
// Engine drone (only starts once audio has been unlocked by a key press or click)
let eng=null;
function engine(){if(!AC||eng)return;const o=AC.createOscillator(),o2=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain();o.type='sawtooth';o2.type='square';f.type='lowpass';f.frequency.value=420;g.gain.value=0;o.connect(f);o2.connect(f);f.connect(g);g.connect(master);o.start();o2.start();eng={o,o2,g}}
function engineTick(){if(!eng)return;const t=AC.currentTime,thr=held('KeyW','KeyS','ArrowUp','ArrowDown')&&!run?1:0;const rpm=mode===0?Math.abs(car.v)/17:mode===2?Math.abs(car.v)/9:0;const hz=36+rpm*75+thr*10;
  eng.o.frequency.setTargetAtTime(hz,t,.08);eng.o2.frequency.setTargetAtTime(hz*.5,t,.08);eng.g.gain.setTargetAtTime(soundOn?.03+.05*rpm+.025*thr:0,t,.1)}
