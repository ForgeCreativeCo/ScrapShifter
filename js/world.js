// Deformable ground, scenery colliders, destructible target stacks.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Deformable ground ----------
const GS=120,GN=240,STEP=GS/GN;
const gGeo=new THREE.PlaneGeometry(GS,GS,GN,GN);gGeo.rotateX(-PI/2);
const gPos=gGeo.attributes.position,gOrig=gPos.array.slice(),gCol=new Float32Array(gPos.count*3);
function initGround(){gPos.array.set(gOrig);for(let i=0;i<gPos.count;i++){const x=gPos.getX(i),z=gPos.getZ(i);const n=.86+.1*Math.sin(x*.21+Math.sin(z*.13)*2)*Math.cos(z*.17)+.04*Math.sin(x*1.3+z*.9);gCol[i*3]=n;gCol[i*3+1]=n*.98;gCol[i*3+2]=n*.94}gGeo.setAttribute('color',new THREE.BufferAttribute(gCol,3));gPos.needsUpdate=true;gGeo.attributes.color.needsUpdate=true;gGeo.computeVertexNormals()}
initGround();
const ground=new THREE.Mesh(gGeo,new THREE.MeshStandardMaterial({map:dirtT,vertexColors:true,roughness:1,metalness:0}));ground.receiveShadow=true;sc.add(ground);
const gIdx=(x,z)=>{const c=Math.round((x+GS/2)/STEP),r=Math.round((z+GS/2)/STEP);return(c<0||r<0||c>GN||r>GN)?-1:r*(GN+1)+c};
const gh=(x,z)=>{const i=gIdx(x,z);return i<0?0:gPos.getY(i)};
function crater(p,pw){const r=1.7*pw,rs=r*1.7;const c0=Math.round((p.x+GS/2)/STEP),r0=Math.round((p.z+GS/2)/STEP),n=Math.ceil(rs/STEP)+1;
for(let rr=r0-n;rr<=r0+n;rr++)for(let cc=c0-n;cc<=c0+n;cc++){if(rr<0||cc<0||rr>GN||cc>GN)continue;const i=rr*(GN+1)+cc,x=gPos.getX(i),z=gPos.getZ(i),d=Math.hypot(x-p.x,z-p.z);
if(d<r){gPos.setY(i,gPos.getY(i)-.5*pw*(1-(d/r)**2))}else if(d<r*1.45){gPos.setY(i,gPos.getY(i)+.14*pw*Math.sin((d-r)/(r*.45)*PI))}
if(d<rs){const f=1-.78*(1-d/rs)**1.3;gCol[i*3]*=f;gCol[i*3+1]*=f;gCol[i*3+2]*=f}}
gPos.needsUpdate=true;gGeo.attributes.color.needsUpdate=true;gGeo.computeVertexNormals()}

// ---------- Scenery ----------
const mk=(g,m,x,y,z,p)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;(p||sc).add(o);return o};
const B=(w,h,d)=>new THREE.BoxGeometry(w,h,d),C=(r,h,s=20)=>new THREE.CylinderGeometry(r,r,h,s);
function wreck(x,z,ry){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.set(rnd(-.05,.05),ry,rnd(-.08,.08));sc.add(g);const m=[rusty,olive,primer][Math.floor(Math.random()*3)];mk(B(3.6,.8,1.7),m,0,.55,0,g);mk(B(1.8,.6,1.5),rusty,-.3,1.2,0,g).rotation.z=.08;mk(B(.05,.5,1.4),glassM,.6,1.2,0,g);[[1.2,.85],[-1.2,-.85]].forEach(([a,b])=>mk(C(.42,.3),tireM,a,.3,b,g).rotation.x=PI/2)}
function drum(x,z,lie){const d=mk(C(.3,.9,14),Math.random()<.5?rusty:hazard,x,lie?.3:.45,z);if(lie){d.rotation.z=PI/2;d.rotation.y=Math.random()*3}return d}
// Destructible structure layout (built in structures.js). Walls: centre, rotation, length. Sheds are 4.2 m square.
const LAYOUT=[
  {k:'wall',x:26,z:0,rot:PI/2,w:10},{k:'wall',x:-14,z:14,rot:0,w:8},{k:'wall',x:10,z:-22,rot:.4,w:10},
  {k:'wall',x:-24,z:-12,rot:PI/2+.3,w:8},{k:'wall',x:34,z:26,rot:-.6,w:8},{k:'wall',x:-38,z:6,rot:PI/2,w:7.5},
  {k:'shed',x:-30,z:24,rot:.2},{k:'shed',x:20,z:30,rot:-.3},{k:'shed',x:36,z:-28,rot:.5},{k:'shed',x:-8,z:-34,rot:0}];
function layoutNear(x,z){return LAYOUT.some(it=>{const dx=x-it.x,dz=z-it.z;if(it.k==='shed')return Math.hypot(dx,dz)<5.5;
  const c=Math.cos(it.rot),s=Math.sin(it.rot),lx=dx*c-dz*s,lz=dx*s+dz*c;return Math.abs(lx)<it.w/2+2.5&&Math.abs(lz)<3})}
const solids=[]; // circle colliders for scenery: {x,z,r}
for(let i=0;i<34;i++){const a=Math.random()*6.28,r=8+Math.random()*26,x=Math.cos(a)*r,z=Math.sin(a)*r;if((x>0&&Math.abs(z)<6)||layoutNear(x,z))continue;const t=Math.random();
if(t<.3){wreck(x,z,Math.random()*6);solids.push({x,z,r:1.7})}else if(t<.55){const w=rnd(1,2.5);const b=mk(B(w,rnd(.6,1.2),.6),concrete,x,0,z);b.position.y=b.geometry.parameters.height/2;b.rotation.y=Math.random()*3;solids.push({x,z,r:w*.42})}
else if(t<.75){for(let k=0;k<3;k++)drum(x+rnd(-.8,.8),z+rnd(-.8,.8),Math.random()<.4);solids.push({x,z,r:1.1})}
else{const tp=new THREE.Group();tp.position.set(x,0,z);sc.add(tp);for(let k=0;k<4;k++){const tt=mk(new THREE.TorusGeometry(.38,.16,8,16),tireM,rnd(-.2,.2),.16+k*.3,rnd(-.2,.2),tp);tt.rotation.x=PI/2}solids.push({x,z,r:.6})}}

// ---------- Destructible targets ----------
let targets=[];
function buildTargets(){targets.forEach(t=>sc.remove(t));targets=[];
const put=(g,m,x,y,z,hx,hy,hz)=>{const o=mk(g,m,x,y,z);o.rotation.y=rnd(-.15,.15);o.userData.h=new THREE.Vector3(hx,hy,hz);o.userData.m=m;targets.push(o)};
const box=(x,y,z,m)=>put(B(.9,.9,.9),m,x,y,z,.45,.45,.45);
const pal=[rusty,olive,primer,rusty,sand];
for(let i=0;i<3;i++)for(let j=0;j<4-i;j++)box(16.2,.45+i*.9,(j-(3-i)/2)*.95,pal[(i*3+j)%5]);
for(let i=0;i<4;i++)box(17.6,.45+i*.9,-.5+(i%2)*.4,pal[(i+2)%5]);
[[7,-.7],[7,0],[7,.7],[7.6,-.35],[7.6,.35]].forEach(([x,z],i)=>put(C(.3,.9,14),i%2?hazard:rusty,x,.45,z,.3,.45,.3));
for(let i=0;i<5;i++)put(B(.9,.9,.9),concrete,11,.45+i*.9,-1.3+(i%2)*.2,.45,.45,.45)}
buildTargets();
