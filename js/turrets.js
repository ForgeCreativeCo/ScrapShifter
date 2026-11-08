// Artillery point defence: two minigun turrets slide out of the hull sides when the legs plant (hidden in buggy and mech).
// They pick the nearest enemy within MG.range with a clear line, slew onto it, spin up and hose it with tracers.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const MG={range:40,dps:18,spinUp:.35,yawRate:4.5,pitchRate:3,tracer:.05,dmgTick:.12};
const mgTracerM=new THREE.LineBasicMaterial({color:0xffd27a,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false});
const mgs=[1,-1].map(side=>{
  const t=grp();add(B(.42,.14,.34),steel,0,-.07,0,t);add(B(.08,.36,.08),rusty,-.12,-.3,-.1*side,t); // bracket and strut into the hull
  const yaw=grp(t);add(C(.17,.14,12),rusty,0,.06,0,yaw);
  const pitch=grp(yaw);pitch.position.y=.24;add(B(.36,.2,.24),olive,0,0,0,pitch);add(B(.16,.15,.12),hazard,-.06,.02,.19*side,pitch); // housing, ammo box
  const spin=grp(pitch);spin.position.x=.2;for(let i=0;i<6;i++){const a=i/6*PI*2;add(C(.022,.5,6),steel,.25,Math.cos(a)*.05,Math.sin(a)*.05,spin).rotation.z=-PI/2}
  add(C(.075,.04,10),steel,.46,0,0,spin).rotation.z=-PI/2;add(C(.075,.04,10),steel,.12,0,0,spin).rotation.z=-PI/2;
  const muzO=new THREE.Object3D();muzO.position.x=.55;spin.add(muzO);
  // tucked inside the hull in buggy/mech, out on the sides in artillery
  const tuck=ps([.3,.95,.3*side],[0,0,0],[.01,.01,.01]);P(t,tuck,ps([.25,1.32,1.12*side]),tuck);
  const flash=S(puffT,0xFFD27A,true,0,.55);sc.add(flash);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),mgTracerM);line.frustumCulled=false;line.visible=false;sc.add(line);
  return{pt:parts[parts.length-1],side,t,yaw,pitch,spin,muzO,flash,line,tgt:null,losT:0,los:false,spinK:0,spinA:0,trT:0,dmg:0,dmgT:0,fire:false,lineT:0}});
const _mw=new THREE.Vector3(),_mt=new THREE.Vector3(),_mm=new THREE.Vector3();let mgSnd=false,mgK=0; // mgK: gyro deploy (0 tucked, 1 out)
function mgReset(){mgK=0;mgs.forEach(m=>{m.tgt=null;m.spinK=0;m.fire=false;m.flash.material.opacity=0;m.line.visible=false;m.yaw.rotation.y=0;m.pitch.rotation.z=0})}
function turretTick(dt){
  // gyro venting on the ground after an overheat: slide the turrets out for cover, tuck them back for take-off
  const vent=mode===3&&!run&&!pl.dead&&HEAT.over&&car.y-gh(car.x,car.z)<.5;
  if(mode===3&&!run){mgK=vent?Math.min(1,mgK+dt*2.5):Math.max(0,mgK-dt*4);mgs.forEach(m=>apply(m.pt,m.pt.po[3],m.pt.po[1],ss(mgK)))}else mgK=0;
  const on=((mode===1&&!run&&AIM.k>=1)||(vent&&mgK>=1))&&!pl.dead&&dt>0;let anyFire=false;
  for(const m of mgs){m.fire=false;
    if(on){m.muzO.getWorldPosition(_mw);
      // target: nearest living enemy in range; line of fire re-checked a few times a second
      if(!m.tgt||m.tgt.dead||Math.hypot(m.tgt.x-_mw.x,m.tgt.z-_mw.z)>MG.range+2){m.tgt=null;let bd=MG.range;
        for(const e of enemies){if(e.dead)continue;const d=Math.hypot(e.x-_mw.x,e.z-_mw.z);if(d<bd){bd=d;m.tgt=e}}m.losT=0}
      if(m.tgt){const e=m.tgt;_mt.set(e.x,e.y+Math.min(1,e.hh*.5),e.z);
        m.losT-=dt;if(m.losT<=0){m.losT=.3;m.los=fireLine(_mw.clone(),_mt.clone())}
        // slew: yaw in the mount's frame, pitch in the yaw node's frame
        _mm.copy(_mt);m.t.worldToLocal(_mm);let dy=Math.atan2(-_mm.z,_mm.x)-m.yaw.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));
        m.yaw.rotation.y+=Math.max(-MG.yawRate*dt,Math.min(MG.yawRate*dt,dy));
        _mm.copy(_mt);m.yaw.worldToLocal(_mm);const tp=Math.max(-.35,Math.min(.9,Math.atan2(_mm.y-.24,Math.hypot(_mm.x,_mm.z))));let dp=tp-m.pitch.rotation.z;
        m.pitch.rotation.z+=Math.max(-MG.pitchRate*dt,Math.min(MG.pitchRate*dt,dp));
        m.fire=m.los&&Math.abs(dy)<.09&&Math.abs(dp)<.12}
      else{m.yaw.rotation.y*=Math.exp(-dt*1.5);m.pitch.rotation.z*=Math.exp(-dt*2)}} // idle: drift back to facing forward
    m.spinK=m.fire||(on&&m.tgt&&m.los)?Math.min(1,m.spinK+dt/MG.spinUp):Math.max(0,m.spinK-dt*1.2);m.spinA+=m.spinK*40*dt;m.spin.rotation.x=m.spinA;
    const shooting=m.fire&&m.spinK>.6;anyFire=anyFire||shooting;
    if(shooting){const e=m.tgt,d=_mw.distanceTo(_mt),hitP=Math.max(.35,.9-d/MG.range*.45-Math.min(.1,Math.abs(e.v||0)*.01));
      m.dmg+=MG.dps*hitP*dt;m.dmgT+=dt;if(m.dmgT>=MG.dmgTick){m.dmgT=0;const dd=m.dmg;m.dmg=0;damageEnemy(e,dd)}
      m.trT-=dt;if(m.trT<=0){m.trT=MG.tracer;const miss=Math.random()>hitP,end=_mt.clone();if(miss){end.x+=rnd(-1.6,1.6);end.z+=rnd(-1.6,1.6);end.y=Math.max(gh(end.x,end.z),end.y+rnd(-1,.4));
          if(Math.random()<.35)smoke(end.clone().setY(gh(end.x,end.z)+.1),new THREE.Vector3(rnd(-.4,.4),rnd(.6,1.2),rnd(-.4,.4)),0x8A7A60,.12,.6,rnd(.4,.7),.5)}
        const a=m.line.geometry.attributes.position.array;_mm.lerpVectors(_mw,end,rnd(0,.35));a[0]=_mm.x;a[1]=_mm.y;a[2]=_mm.z;_mm.lerpVectors(_mw,end,rnd(.55,1));a[3]=_mm.x;a[4]=_mm.y;a[5]=_mm.z;
        m.line.geometry.attributes.position.needsUpdate=true;m.line.visible=true;m.lineT=.035}}
    m.lineT-=dt;if(m.lineT<=0)m.line.visible=false;
    m.muzO.getWorldPosition(m.flash.position);m.flash.material.opacity=shooting?rnd(.5,1):0;m.flash.scale.setScalar(shooting?rnd(.35,.6):.01)}
  // sound: loop the steady burst while any gun fires, play the wind-down tail when they stop
  if(AC){const s=spot(_mw.set(car.x,car.y+1.3,car.z),.03);loopSnd('minigun',anyFire&&soundOn?.75*s.a:0,1,s.pan);
    if(mgSnd&&!anyFire&&audio())sfx('minigun',{off:2.62,dur:2.4,vol:.75*s.a,pan:s.pan});mgSnd=anyFire}}
