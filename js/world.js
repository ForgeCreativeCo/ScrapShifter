// Deformable ground, scenery colliders, destructible target stacks.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Deformable ground: heightfield drawn as chunk meshes ----------
// One height + colour sample every STEP m over the whole map. Edits (craters, rubble mounds) change the samples and
// rebuild only the chunks they touch. Normals come from the heightfield, so chunk edges have no lighting seams.
const GS=MAP.size,STEP=.5,GN=Math.round(GS/STEP),CH=64,NC=Math.ceil(GN/CH); // CH cells per chunk side (32 m)
const gHt=new Float32Array((GN+1)*(GN+1)),gCol=new Float32Array((GN+1)*(GN+1)*3),gI=(c,r)=>r*(GN+1)+c;
const MAPSPACE=MAP.ground==='town'; // town: one painted texture across the whole map (roads, lots); otherwise tiled dirt
const groundMap=MAPSPACE?paintTownGround(MAP.size):dirtT;dirtT.repeat.set(1,1);
const groundM=new THREE.MeshStandardMaterial({map:groundMap,vertexColors:true,roughness:MAPSPACE?.92:1,metalness:0,normalMap:normalFromCanvas(groundMap.image,MAPSPACE?1.4:3,MAPSPACE?2048:512),normalScale:new THREE.Vector2(.7,.7)});
// Night town: the painted neon glow (townGlow, js/townplan.js) is the ground's emissive map; scorch and stains
// (vertex colours) darken it too. Wetter-looking streets pick up the sky's haze.
if(MAPSPACE&&townGlow){groundM.emissiveMap=townGlow;groundM.emissive.setHex(0xffffff);groundM.emissiveIntensity=1.25;groundM.color.setHex(0x8a90b4);groundM.roughness=.72;
  groundM.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance*=vColor.rgb;\n#endif')}}
const chunks=[];
// Terrain LOD: far chunks draw every 2nd / 4th sample (same vertices, so craters and normals stay exact). The chunk's
// border keeps full resolution and fans into the coarse interior, so neighbours at any level meet without cracks.
const LOD_STEP=[1,2,4],LOD_DIST=[72,140]; // step 2 beyond 72 m from the camera, step 4 beyond 140 m
function lodIndex(idx,w,h,s){const tri=(a,b,c)=>{const ax=a%w,az=(a/w|0),cr=(b%w-ax)*((c/w|0)-az)-((b/w|0)-az)*(c%w-ax);if(cr<0)idx.push(a,b,c);else idx.push(a,c,b)}; // keep the up-facing winding (cross<0)
  for(let r=0;r<h-1;r+=s)for(let c=0;c<w-1;c+=s){const p=r*w+c;
    if(s===1||(r>0&&c>0&&r+s<h-1&&c+s<w-1)){tri(p,p+s*w,p+s);tri(p+s,p+s*w,p+s*w+s);continue}
    // border cell: fan from its centre over the perimeter, every sample along a chunk edge, corners only inside
    const ring=[],side=(c1,r1,dc,dr,edge)=>{for(let k=0;k<s;k++)if(edge||k===0)ring.push((r1+dr*k)*w+c1+dc*k)};
    side(c,r,1,0,r===0);side(c+s,r,0,1,c+s===w-1);side(c+s,r+s,-1,0,r+s===h-1);side(c,r+s,0,-1,c===0);
    const m=(r+s/2)*w+c+s/2;for(let k=0;k<ring.length;k++)tri(m,ring[k],ring[(k+1)%ring.length])}}
function terrainLod(){const px=cam.position.x,pz=cam.position.z,far=sc.fog.far+24; // chunks wholly past the fog are not drawn
  for(const ch of chunks){const d=Math.hypot(ch.x-px,ch.z-pz),lv=Math.min(ch.lod.length-2,d>LOD_DIST[1]?2:d>LOD_DIST[0]?1:0);
    ch.mesh.visible=d<far;if(lv!==ch.lv){ch.lv=lv;ch.geo.setDrawRange(ch.lod[lv],ch.lod[lv+1]-ch.lod[lv])}}}
for(let cz=0;cz<NC;cz++)for(let cx=0;cx<NC;cx++){const c0=cx*CH,r0=cz*CH,w=Math.min(GN,c0+CH)-c0+1,h=Math.min(GN,r0+CH)-r0+1,n=w*h;
  const geo=new THREE.BufferGeometry(),pos=new Float32Array(n*3),uv=new Float32Array(n*2),idx=[];
  for(let r=0;r<h;r++)for(let c=0;c<w;c++){const k=r*w+c,x=(c0+c)*STEP-GS/2,z=(r0+r)*STEP-GS/2;pos[k*3]=x;pos[k*3+2]=z;if(MAPSPACE){uv[k*2]=(x+GS/2)/GS;uv[k*2+1]=1-(z+GS/2)/GS}else{uv[k*2]=x/8.6;uv[k*2+1]=-z/8.6}}
  const lod=[0];for(const s of LOD_STEP){if(s>1&&((w-1)%s||(h-1)%s))break;lodIndex(idx,w,h,s);lod.push(idx.length)} // levels share one index buffer
  geo.setIndex(idx);geo.setDrawRange(0,lod[1]);geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(n*3),3));
  geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  const mesh=new THREE.Mesh(geo,groundM);mesh.receiveShadow=true;sc.add(mesh);chunks.push({geo,mesh,c0,r0,w,h,lod,lv:0,x:(c0+(w-1)/2)*STEP-GS/2,z:(r0+(h-1)/2)*STEP-GS/2})}
// Rebuild a chunk's vertices from the heightfield; pass a sample range (global c/r) to touch only that patch
function rebuildChunk(ch,gc0=0,gc1=GN,gr0=0,gr1=GN){const P=ch.geo.attributes.position.array,N=ch.geo.attributes.normal.array,Cc=ch.geo.attributes.color.array;
  const ca=Math.max(0,gc0-ch.c0),cb=Math.min(ch.w-1,gc1-ch.c0),ra=Math.max(0,gr0-ch.r0),rb=Math.min(ch.h-1,gr1-ch.r0);
  for(let r=ra;r<=rb;r++)for(let c=ca;c<=cb;c++){const k=r*ch.w+c,gc=ch.c0+c,gr=ch.r0+r,i=gI(gc,gr);P[k*3+1]=gHt[i];
    const nx=gHt[gI(Math.max(gc-1,0),gr)]-gHt[gI(Math.min(gc+1,GN),gr)],nz=gHt[gI(gc,Math.max(gr-1,0))]-gHt[gI(gc,Math.min(gr+1,GN))],ny=2*STEP,l=Math.hypot(nx,ny,nz);
    N[k*3]=nx/l;N[k*3+1]=ny/l;N[k*3+2]=nz/l;Cc[k*3]=gCol[i*3];Cc[k*3+1]=gCol[i*3+1];Cc[k*3+2]=gCol[i*3+2]}
  ['position','normal','color'].forEach(a=>ch.geo.attributes[a].needsUpdate=true);ch.geo.computeBoundingSphere()}
// Visit every sample within rad of (x,z) as fn(index, sampleX, sampleZ), then rebuild the touched chunks
function editGround(x,z,rad,fn){const c0=Math.max(0,Math.floor((x-rad+GS/2)/STEP)),c1=Math.min(GN,Math.ceil((x+rad+GS/2)/STEP)),r0=Math.max(0,Math.floor((z-rad+GS/2)/STEP)),r1=Math.min(GN,Math.ceil((z+rad+GS/2)/STEP));
  if(c0>c1||r0>r1)return;for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)fn(gI(c,r),c*STEP-GS/2,r*STEP-GS/2);
  chunks.forEach(ch=>{if(ch.c0<=c1+1&&ch.c0+ch.w-1>=c0-1&&ch.r0<=r1+1&&ch.r0+ch.h-1>=r0-1)rebuildChunk(ch,c0-1,c1+1,r0-1,r1+1)})} // ±1 so neighbouring normals update
function initGround(){for(let r=0;r<=GN;r++)for(let c=0;c<=GN;c++){const i=gI(c,r),x=c*STEP-GS/2,z=r*STEP-GS/2;gHt[i]=MAP.height(x,z);
    const A=MAP.groundNoise??.1,n=1-1.4*A+A*Math.sin(x*.21+Math.sin(z*.13)*2)*Math.cos(z*.17)+.4*A*Math.sin(x*1.3+z*.9);gCol[i*3]=n;gCol[i*3+1]=n*.98;gCol[i*3+2]=n*.94}
  chunks.forEach(ch=>rebuildChunk(ch))}
initGround();
// Ground height at any point (bilinear between samples; clamps at the map edge)
function gh(x,z){const fx=Math.max(0,Math.min(GN-1e-6,(x+GS/2)/STEP)),fz=Math.max(0,Math.min(GN-1e-6,(z+GS/2)/STEP)),c=Math.floor(fx),r=Math.floor(fz),u=fx-c,v=fz-r;
  return(gHt[gI(c,r)]*(1-u)+gHt[gI(c+1,r)]*u)*(1-v)+(gHt[gI(c,r+1)]*(1-u)+gHt[gI(c+1,r+1)]*u)*v}
function crater(p,pw){const r=1.7*pw,rs=r*1.7;
  editGround(p.x,p.z,rs+STEP,(i,x,z)=>{const d=Math.hypot(x-p.x,z-p.z);
    if(d<r)gHt[i]-=.5*pw*(1-(d/r)**2);else if(d<r*1.45)gHt[i]+=.14*pw*Math.sin((d-r)/(r*.45)*PI);
    if(d<rs){const f=1-.78*(1-d/rs)**1.3;gCol[i*3]*=f;gCol[i*3+1]*=f;gCol[i*3+2]*=f}})}

// ---------- Scenery ----------
const mk=(g,m,x,y,z,p)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;(p||sc).add(o);return o};
const B=(w,h,d)=>new THREE.BoxGeometry(w,h,d),C=(r,h,s=20)=>new THREE.CylinderGeometry(r,r,h,s);
function wreck(x,z,ry){const g=new THREE.Group();g.position.set(x,gh(x,z),z);g.rotation.set(rnd(-.05,.05),ry,rnd(-.08,.08));sc.add(g);const m=[rusty,olive,primer][Math.floor(srnd()*3)];mk(B(3.6,.8,1.7),m,0,.55,0,g);mk(B(1.8,.6,1.5),rusty,-.3,1.2,0,g).rotation.z=.08;mk(B(.05,.5,1.4),glassM,.6,1.2,0,g);[[1.2,.85],[-1.2,-.85]].forEach(([a,b])=>mk(C(.42,.3),tireM,a,.3,b,g).rotation.x=PI/2)}
function drum(x,z,lie){const d=mk(C(.3,.9,14),srnd()<.5?rusty:hazard,x,gh(x,z)+(lie?.3:.45),z);if(lie){d.rotation.z=PI/2;d.rotation.y=srnd()*3}return d}
// Destructible structure layout comes from the map (built in structures.js). Walls: centre, rotation, length; sheds 4.2 m square.
const LAYOUT=MAP.layout;
function layoutNear(x,z){if((MAP.buildings||[]).some(b=>{const dx=x-b.x,dz=z-b.z,c=Math.cos(b.rot),s=Math.sin(b.rot);return Math.abs(dx*c-dz*s)<b.mx*2+3&&Math.abs(dx*s+dz*c)<b.mz*2+3}))return true;
  return LAYOUT.some(it=>{const dx=x-it.x,dz=z-it.z;if(it.k==='shed')return Math.hypot(dx,dz)<5.5;
  const c=Math.cos(it.rot),s=Math.sin(it.rot),lx=dx*c-dz*s,lz=dx*s+dz*c;return Math.abs(lx)<it.w/2+2.5&&Math.abs(lz)<3})}
const solids=[]; // circle colliders for scenery: {x,z,r}
const srnd=rng(MAP.seed*31+5),SC=MAP.scenery; // seeded so every player gets the same scenery
for(let i=0;i<SC.n;i++){const a=srnd()*6.28,r=SC.rMin+srnd()*(SC.rMax-SC.rMin),x=Math.cos(a)*r,z=Math.sin(a)*r,t=srnd();if(SC.keepClear(x,z)||layoutNear(x,z)||Math.abs(x)>PLAY-2||Math.abs(z)>PLAY-2)continue;
if(t<.3){wreck(x,z,srnd()*6);solids.push({x,z,r:1.7})}else if(t<.55){const w=1+srnd()*1.5,bh=.6+srnd()*.6;const b=mk(B(w,bh,.6),concrete,x,gh(x,z)+bh/2,z);b.rotation.y=srnd()*3;solids.push({x,z,r:w*.42})}
else if(t<.75){for(let k=0;k<3;k++)drum(x+srnd()*1.6-.8,z+srnd()*1.6-.8,srnd()<.4);solids.push({x,z,r:1.1})}
else{const tp=new THREE.Group();tp.position.set(x,gh(x,z),z);sc.add(tp);for(let k=0;k<4;k++){const tt=mk(new THREE.TorusGeometry(.38,.16,8,16),tireM,srnd()*.4-.2,.16+k*.3,srnd()*.4-.2,tp);tt.rotation.x=PI/2}solids.push({x,z,r:.6})}}

// ---------- Destructible targets ----------
let targets=[];
function buildTargets(){targets.forEach(t=>sc.remove(t));targets=[];if(!MAP.targets)return; // test-map shooting gallery
const put=(g,m,x,y,z,hx,hy,hz)=>{const o=mk(g,m,x,y,z);o.rotation.y=rnd(-.15,.15);o.userData.h=new THREE.Vector3(hx,hy,hz);o.userData.m=m;targets.push(o)};
const box=(x,y,z,m)=>put(B(.9,.9,.9),m,x,y,z,.45,.45,.45);
const pal=[rusty,olive,primer,rusty,sand];
for(let i=0;i<3;i++)for(let j=0;j<4-i;j++)box(16.2,.45+i*.9,(j-(3-i)/2)*.95,pal[(i*3+j)%5]);
for(let i=0;i<4;i++)box(17.6,.45+i*.9,-.5+(i%2)*.4,pal[(i+2)%5]);
[[7,-.7],[7,0],[7,.7],[7.6,-.35],[7.6,.35]].forEach(([x,z],i)=>put(C(.3,.9,14),i%2?hazard:rusty,x,.45,z,.3,.45,.3));
for(let i=0;i<5;i++)put(B(.9,.9,.9),concrete,11,.45+i*.9,-1.3+(i%2)*.2,.45,.45,.45)}
buildTargets();
