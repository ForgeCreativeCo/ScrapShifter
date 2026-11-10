// Renderer, scene, camera, lights, math helpers, procedural textures and materials.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const st=document.getElementById('st');
const PI=Math.PI,rnd=(a,b)=>a+Math.random()*(b-a);
const cv=document.getElementById('c');
const R=new THREE.WebGLRenderer({canvas:cv,antialias:true});R.setPixelRatio(Math.min(2,window.devicePixelRatio));R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.05;R.outputEncoding=THREE.sRGBEncoding;
const sc=new THREE.Scene();sc.background=new THREE.Color(0x9C9384);sc.fog=new THREE.Fog(0x9C9384,22,75);
const cam=new THREE.PerspectiveCamera(45,1,.1,200);
const size=()=>{const w=cv.clientWidth||800,h=cv.clientHeight||500;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()};size();window.addEventListener('resize',size);

// ---------- Lighting ----------
const hemi=new THREE.HemisphereLight(0xD8C8A8,0x3A3428,.75);sc.add(hemi); // maps.js may recolour (blue sky)
const sun=new THREE.DirectionalLight(0xFFD9A8,1.7);sun.position.set(10,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24});sun.shadow.bias=-.0005;sc.add(sun);
const flashL=new THREE.PointLight(0xFF8A3A,0,40,2);sc.add(flashL);
const muzL=new THREE.PointLight(0xFFC870,0,14,2);sc.add(muzL);
let rigLamp=null; // night maps: the rig's work light, carried just ahead of it (made in maps.js, moved in main.js)

// ---------- Procedural textures ----------
function tex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;if(rep)t.repeat.set(rep,rep);return t}
function grime(g,w,h){for(let i=0;i<1100;i++){const v=Math.random()>.5?255:0;g.fillStyle=`rgba(${v},${v},${v},${Math.random()*.07})`;g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*6,1+Math.random()*6)}}
function rustBlobs(g,w,h,n){for(let i=0;i<n;i++){const x=Math.random()*w,y=Math.random()*h,r=6+Math.random()*32;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(104,46,16,.9)');gr.addColorStop(.55,'rgba(140,70,28,.5)');gr.addColorStop(1,'rgba(120,60,25,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();for(let k=0;k<3;k++){g.fillStyle='rgba(96,44,16,.3)';g.fillRect(x+(Math.random()-.5)*r,y,1+Math.random()*2,15+Math.random()*55)}}}
function metalTex(base,rust,stripes){return tex(256,256,(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);
if(stripes){g.fillStyle='#1c1a17';for(let i=-h;i<w+h;i+=56){g.beginPath();g.moveTo(i,0);g.lineTo(i+28,0);g.lineTo(i+28+h,h);g.lineTo(i+h,h);g.fill()}for(let i=0;i<70;i++){g.fillStyle='rgba(60,55,48,.85)';g.beginPath();g.arc(Math.random()*w,Math.random()*h,1+Math.random()*5,0,7);g.fill()}}
grime(g,w,h);rustBlobs(g,w,h,rust*12);
g.strokeStyle='rgba(215,208,190,.28)';g.lineWidth=1;for(let i=0;i<45;i++){const x=Math.random()*w,y=Math.random()*h,a=Math.random()*6.28,l=5+Math.random()*28;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke()}
g.fillStyle='rgba(14,13,11,.6)';g.fillRect(0,h*.5,w,2);g.fillRect(w*.5,0,2,h);g.fillRect(0,0,w,2);g.fillRect(0,0,2,h);
for(let i=10;i<w;i+=18){g.fillStyle='rgba(20,18,15,.7)';g.beginPath();g.arc(i,h*.5+7,2.2,0,7);g.arc(w*.5+7,i,2.2,0,7);g.fill();g.fillStyle='rgba(220,210,190,.35)';g.fillRect(i-1,h*.5+5,1,1)}
const gd=g.createLinearGradient(0,h*.6,0,h);gd.addColorStop(0,'rgba(30,25,18,0)');gd.addColorStop(1,'rgba(30,25,18,.45)');g.fillStyle=gd;g.fillRect(0,0,w,h)})}
// Surface bumps: build a tangent-space normal map from a canvas's brightness (Sobel), so painted texture detail
// (bricks, rust blotches, panel seams, dirt) catches the light. maxSize downsamples big canvases first.
function normalFromCanvas(src,strength=2,maxSize=512){const w=Math.min(src.width,maxSize),h=Math.min(src.height,maxSize),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(src,0,0,w,h);
  const d=g.getImageData(0,0,w,h),px=d.data,L=new Float32Array(w*h);for(let i=0;i<w*h;i++)L[i]=(px[i*4]*.299+px[i*4+1]*.587+px[i*4+2]*.114)/255;
  const at=(x,y)=>L[((y+h)%h)*w+((x+w)%w)];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1))-(at(x-1,y-1)+2*at(x-1,y)+at(x-1,y+1)),dy=(at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1))-(at(x-1,y-1)+2*at(x,y-1)+at(x+1,y-1));
    let nx=-dx*strength,ny=dy*strength,nz=1;const l=Math.hypot(nx,ny,nz);const i=(y*w+x)*4;px[i]=(nx/l*.5+.5)*255;px[i+1]=(ny/l*.5+.5)*255;px[i+2]=(nz/l*.5+.5)*255;px[i+3]=255}
  g.putImageData(d,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
const nmCache=new Map();
const SM=(t,r=.85,m=.25)=>{let n=nmCache.get(t);if(!n){n=normalFromCanvas(t.image,2.2);n.repeat.copy(t.repeat);nmCache.set(t,n)}
  return new THREE.MeshStandardMaterial({map:t,roughness:r,metalness:m,normalMap:n,normalScale:new THREE.Vector2(.55,.55)})};
const olive=SM(metalTex('#5d5f3e',3)),primer=SM(metalTex('#6c6a63',2)),rusty=SM(metalTex('#6a462a',7)),steel=SM(metalTex('#3e3d3a',2),.7,.45),hazard=SM(metalTex('#a8832e',4,true)),sand=SM(metalTex('#8a7a5a',3));
const concrete=SM(tex(256,256,(g,w,h)=>{g.fillStyle='#8a877f';g.fillRect(0,0,w,h);grime(g,w,h);for(let i=0;i<25;i++){g.fillStyle=`rgba(50,45,38,${Math.random()*.25})`;g.beginPath();g.arc(Math.random()*w,Math.random()*h,5+Math.random()*30,0,7);g.fill()}g.strokeStyle='rgba(30,28,24,.6)';for(let i=0;i<6;i++){let x=Math.random()*w,y=Math.random()*h;g.beginPath();g.moveTo(x,y);for(let k=0;k<6;k++){x+=rnd(-20,20);y+=rnd(-20,20);g.lineTo(x,y)}g.stroke()}}),.95,0);
const tireM=SM(tex(128,128,(g,w,h)=>{g.fillStyle='#1b1a19';g.fillRect(0,0,w,h);for(let i=0;i<w;i+=10){g.fillStyle='#0d0d0c';g.fillRect(i,0,4,h)}grime(g,w,h)}),.95,0);
const glassM=new THREE.MeshStandardMaterial({color:0x3e4c50,roughness:.25,metalness:.3});
const dirtT=tex(512,512,(g,w,h)=>{g.fillStyle='#5e5444';g.fillRect(0,0,w,h);for(let i=0;i<4000;i++){const c=Math.random();g.fillStyle=c>.66?'rgba(120,105,80,.35)':c>.33?'rgba(45,38,28,.35)':'rgba(90,80,60,.4)';g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*4,1+Math.random()*4)}for(let i=0;i<30;i++){g.fillStyle=`rgba(35,30,22,${Math.random()*.25})`;g.beginPath();g.arc(Math.random()*w,Math.random()*h,10+Math.random()*60,0,7);g.fill()}g.strokeStyle='rgba(40,34,26,.35)';g.lineWidth=6;for(let k=0;k<2;k++){g.beginPath();g.moveTo(0,h*.3+k*30);g.bezierCurveTo(w*.3,h*.1,w*.6,h*.8,w,h*.55+k*30);g.stroke()}},14);
const puffT=tex(128,128,(g,w,h)=>{for(let i=0;i<45;i++){const a=Math.random()*6.28,d=Math.random()*34,x=64+Math.cos(a)*d,y=64+Math.sin(a)*d,r=12+Math.random()*24;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.22)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)}g.globalCompositeOperation='destination-in';const m=g.createRadialGradient(64,64,10,64,64,64);m.addColorStop(0,'rgba(0,0,0,1)');m.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=m;g.fillRect(0,0,w,h)});
const glowT=tex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.3,'rgba(255,255,255,.6)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)});

const cl=v=>Math.max(0,Math.min(1,v)),ss=v=>v*v*(3-2*v); // clamp01, smoothstep
function rng(seed){return()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}} // seeded random (mulberry32), for deterministic layouts

// Instances spread across the map, split into INST_TILE m tiles: one InstancedMesh per occupied tile with its own
// bounding sphere, so the camera and the shadow camera skip whole tiles (a single map-wide InstancedMesh can't be
// culled at all). Same setMatrixAt/setColorAt-by-global-index API as an InstancedMesh: fill every instance, then
// build(). After build, writes go straight to the right tile and flag its upload, so callers' own
// `instanceMatrix/instanceColor.needsUpdate=true` lines are harmless no-ops. Tile spheres come from the initial
// matrices; later edits (hiding with a zero scale, sagging a wreck) only shrink instances, so they stay valid.
// tileCull(far), once a frame, also hides tiles that lie wholly beyond the fog, which the frustum alone would still draw.
const instTiles=[];
function tileCull(far){const p=cam.position;for(const t of instTiles){const s=t.geometry.boundingSphere;t.visible=Math.hypot(s.center.x-p.x,s.center.z-p.z)-s.radius<far}}
const INST_TILE=64,_tiS=new THREE.Sphere(),_tiB=new THREE.Box3(),_tiB2=new THREE.Box3(),_tiM=new THREE.Matrix4();
class TiledInst{
  constructor(geo,mat,n,shadow=true){this.geo=geo;this.mat=mat;this.count=n;this.shadow=shadow;this.mats=new Float32Array(n*16);this.cols=null;
    this.meshes=null;this.tile=new Int32Array(n);this.local=new Int32Array(n);this.instanceMatrix={};this.instanceColor={}}
  setMatrixAt(i,m){if(!this.meshes){m.toArray(this.mats,i*16);return}const t=this.meshes[this.tile[i]];t.setMatrixAt(this.local[i],m);t.instanceMatrix.needsUpdate=true}
  setColorAt(i,c){if(!this.meshes){(this.cols||(this.cols=new Float32Array(this.count*3)));c.toArray(this.cols,i*3);return}
    const t=this.meshes[this.tile[i]];t.setColorAt(this.local[i],c);t.instanceColor.needsUpdate=true}
  build(){const g0=this.geo;if(!g0.boundingSphere)g0.computeBoundingSphere();const groups=new Map();
    for(let i=0;i<this.count;i++){const k=Math.floor(this.mats[i*16+12]/INST_TILE)+','+Math.floor(this.mats[i*16+14]/INST_TILE);let l=groups.get(k);if(!l)groups.set(k,l=[]);l.push(i)}
    this.meshes=[];const col=new THREE.Color();
    groups.forEach(list=>{const g=new THREE.BufferGeometry();g.index=g0.index;g.attributes=g0.attributes;g.groups=g0.groups; // shares the GPU buffers
      const im=new THREE.InstancedMesh(g,this.mat,list.length);_tiB.makeEmpty();
      list.forEach((i,j)=>{this.tile[i]=this.meshes.length;this.local[i]=j;_tiM.fromArray(this.mats,i*16);im.setMatrixAt(j,_tiM);
        _tiS.copy(g0.boundingSphere).applyMatrix4(_tiM);_tiB.union(_tiS.getBoundingBox(_tiB2));if(this.cols)im.setColorAt(j,col.fromArray(this.cols,i*3))});
      g.boundingSphere=_tiB.getBoundingSphere(new THREE.Sphere()); // world space; the tile mesh sits at the origin
      im.frustumCulled=true;im.castShadow=this.shadow;im.receiveShadow=true;im.matrixAutoUpdate=false; // InstancedMesh turns culling off by default
      sc.add(im);this.meshes.push(im);instTiles.push(im)});
    this.mats=this.cols=null;return this}}
