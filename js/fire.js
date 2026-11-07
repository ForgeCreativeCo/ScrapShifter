// Building fires. A real hit on a building panel (shell, blast, bash, ram) sets it alight; a roof hit lights the top
// floor. A burning panel grows to full fire, slowly destroys itself, scorches black, and spreads: up to the panel
// above every BURN.climb s and sideways every BURN.spread s. Left alone a hit building burns through its walls and
// collapses under the normal floor rule; the rubble then smoulders. Spread runs on timers (no randomness), so the
// burn plays out the same way for everyone. Flames, smoke and firelight are only drawn for fires near the camera.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const BURN={dps:1.2,grow:.3,climb:3,spread:6,fuel:50,ignite:12,max:160,fxNear:28}; // dps is before TUNE.bldDmg
const burning=new Set(),smoulder=[],_fireWhite=new THREE.Color(1,1,1),_fireScorch=new THREE.Color(0x3c3632),_fc=new THREE.Color();
const fireLights=[0,1,2].map(()=>{const l=new THREE.PointLight(0xff7a2e,0,24,2);sc.add(l);return l}); // pooled: adding/removing lights recompiles shaders

function ignite(p,amt=.5){if(!TUNE.fire)return;if(p.kind==='slab'){const lv=p.bld.levels[p.level];let best=null,bd=1e9;lv.forEach(q=>{if(q.state<2&&!q.fire){const d=Math.hypot(q.x-p.x,q.z-p.z);if(d<bd){bd=d;best=q}}});if(best)ignite(best,amt);return}
  if(p.kind!=='panel')return;
  if(p.state===2){fireNeighbours(p).forEach(q=>{if(q.state<2&&q.level>=p.level)ignite(q,amt*.8)});return} // blown out: the edges of the hole catch
  if(!p.fire&&burning.size>=BURN.max)return;
  if(!p.fire){p.fire=0;p.fuel=BURN.fuel;p.spT=0;p.fxT=0;p.burnt=0;burning.add(p)}p.fire=Math.max(p.fire,amt)}
// neighbours: same floor and touching, or the panel directly above/below
function fireNeighbours(p){if(!p.nb){const all=p.bld.levels.flat();p.nb=all.filter(q=>q!==p&&(q.level===p.level?Math.hypot(q.x-p.x,q.z-p.z)<MOD+.8:Math.abs(q.level-p.level)===1&&Math.hypot(q.x-p.x,q.z-p.z)<.6))}return p.nb}
// Persistent flickering flame sprites for nearby burning panels (made on demand, removed when the fire ends)
const flameMat=new THREE.SpriteMaterial({map:puffT,color:0xff8a2a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
function dropFlames(p){if(p.flames){p.flames.forEach(f=>sc.remove(f));p.flames=null}}
function flamesFor(p){if(p.flames)return p.flames;const[nx,nz]=panelOut(p);p.flames=[-.3,0,.3].map((u,i)=>{const f=new THREE.Sprite(flameMat.clone());f.userData={u:u*p.w,nx,nz,ph:Math.random()*9,i};sc.add(f);return f});return p.flames}
const panelOut=p=>{const nx=p.s,nz=p.c,sd=Math.sign((p.x-p.bld.x)*nx+(p.z-p.bld.z)*nz)||1;return[nx*sd,nz*sd]}; // outward face normal

function fireTick(dt){
  for(const p of burning){
    if(p.state===2||p.bld.collapsedFrom<=p.level){burning.delete(p);p.fire=0;dropFlames(p);continue}
    const F=TUNE.fire;if(!F){burning.delete(p);p.fire=0;dropFlames(p);continue}const d=dt*F; // Fire × scales the whole burn (growth, spread, damage, fuel)
    p.fuel-=d;p.fire=p.fuel>0?Math.min(1,p.fire+BURN.grow*d):p.fire-.15*d;if(p.fire<=0){burning.delete(p);p.fire=0;dropFlames(p);continue}
    p.burnt=Math.min(1,p.burnt+d/30); // scorch the facade
    p.inst.mesh.setColorAt(p.inst.i,_fc.copy(_fireWhite).lerp(_fireScorch,p.burnt));p.inst.mesh.instanceColor.needsUpdate=true;
    if(p.fire>.6){p.spT+=d;const nb=fireNeighbours(p);
      if(p.spT%BURN.climb<d)nb.forEach(q=>{if(q.level>p.level)ignite(q,.35)}); // fire climbs
      if(p.spT>=BURN.spread){p.spT=0;nb.forEach(q=>{if(q.level===p.level)ignite(q,.3)})}}
    damagePiece(p,BURN.dps*p.fire*d,null)} // may destroy the panel and collapse floors
  // effects for the nearest fires only
  const cx=cam.position.x,cz=cam.position.z,near=[...burning].map(p=>[p,Math.hypot(p.x-cx,p.z-cz)]).filter(a=>a[1]<140).sort((a,b)=>a[1]-b[1]).slice(0,BURN.fxNear);
  const nearSet=new Set(near.map(a=>a[0]));burning.forEach(p=>{if(!nearSet.has(p))dropFlames(p)});
  near.forEach(([p])=>flamesFor(p).forEach(f=>{const d=f.userData,fl=.75+.25*Math.sin(clock*11+d.ph)+.12*Math.sin(clock*23+d.ph*2),h=p.H[0];
    f.position.set(p.x+p.c*d.u+d.nx*.3,p.y0+h*(.3+.08*d.i)+fl*.5*p.fire,p.z-p.s*d.u+d.nz*.3);
    f.scale.set((1.6+p.fire*1.4)*fl,(2.2+p.fire*2.2)*fl,1);f.material.opacity=Math.min(1,.35+.65*p.fire)*(.8+.2*fl);f.material.color.setHSL(.06+.03*fl,1,.45+.15*fl)}));
  near.forEach(([p,d],k)=>{p.fxT-=dt;if(p.fxT>0)return;p.fxT=.15/p.fire+d*.002;let[nx,nz]=panelOut(p);const u=(Math.random()-.5)*p.w*.7;
    // mostly out of the windows, some inside (seen through holes), and on the top floor flames lick over the roofline
    const top=p.level===p.bld.collapsedFrom-1&&Math.random()<.45,inside=!top&&Math.random()<.3;if(inside){nx=-nx;nz=-nz}
    const y=top?p.y0+p.H[0]+.2:p.y0+p.H[0]*rnd(.3,.6),q=new THREE.Vector3(p.x+p.c*u+nx*(top?-.6:.35),y,p.z-p.s*u+nz*(top?-.6:.35));
    fireball(q,new THREE.Vector3((top?0:nx*rnd(.4,1))+rnd(-.2,.2),rnd(1.4,2.6)*(top?1.3:1),(top?0:nz*rnd(.4,1))+rnd(-.2,.2)),.4,(.6+p.fire)*rnd(1,1.5)*(top?1.3:1),rnd(.5,.9));
    if(Math.random()<.4)smoke(q.clone().setY(y+1.4),new THREE.Vector3(nx*.6,rnd(2,3.2),nz*.6),0x1f1c19,.9,rnd(3.5,5.5),rnd(5,8),.5);
    if(Math.random()<.15)ember(q.clone(),new THREE.Vector3(rnd(-1,1),rnd(2,5),rnd(-1,1)),rnd(.8,1.6))});
  fireLights.forEach((l,i)=>{const n=near[i];if(!n||n[1]>70){l.intensity=0;return}const p=n[0],[nx,nz]=panelOut(p);
    l.position.set(p.x+nx*1.5,p.y0+p.H[0]*.5,p.z+nz*1.5);l.intensity=(3+2.5*Math.random())*p.fire});
  if(near.length&&near[0][1]<30&&audio()&&Math.random()<dt*5){const t=AC.currentTime,a=.12*(1-near[0][1]/30);nz(t,.08,5000,1500,a,'bandpass')} // crackle
  // collapsed burning buildings smoulder
  for(let i=smoulder.length-1;i>=0;i--){const s=smoulder[i];s.t-=dt;if(s.t<=0){smoulder.splice(i,1);continue}s.fxT=(s.fxT||0)-dt;
    if(s.fxT<=0&&Math.hypot(s.x-cx,s.z-cz)<160){s.fxT=.25;smoke(new THREE.Vector3(s.x+rnd(-s.r,s.r),gh(s.x,s.z)+1,s.z+rnd(-s.r,s.r)),new THREE.Vector3(rnd(-.3,.3),rnd(1.5,2.5),rnd(-.3,.3)),0x2a2622,1,rnd(4,6),rnd(6,9),.45);
      if(s.t>s.t0*.5&&Math.random()<.4)fireball(new THREE.Vector3(s.x+rnd(-s.r,s.r)*.7,gh(s.x,s.z)+.6,s.z+rnd(-s.r,s.r)*.7),new THREE.Vector3(0,rnd(1,2),0),.4,1.2,rnd(.4,.7))}}}
function fireSmoulder(B){smoulder.push({x:B.x,z:B.z,r:Math.min(B.W,B.D)*.35,t:30,t0:30})}
function resetFires(){burning.forEach(p=>{p.fire=0;dropFlames(p)});burning.clear();smoulder.length=0;
  buildings.forEach(B=>B.levels.flat().forEach(p=>{p.burnt=0;if(p.inst){p.inst.mesh.setColorAt(p.inst.i,_fireWhite);p.inst.mesh.instanceColor.needsUpdate=true}}));fireLights.forEach(l=>l.intensity=0)}
