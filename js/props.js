// Town street furniture and countryside, all instanced: street/park trees, lamp posts, parked cars, the plaza
// fountain, wooded hills and rocks outside town, and a tree line as the map boundary. Trees, poles, cars and the
// fountain become `solids` (circle colliders) so vehicles and the nav grid respect them. Only maps with MAP.props.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

if(MAP.props){(()=>{const P=MAP.props,r=rng(MAP.seed*7+1),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),UP=new THREE.Vector3(0,1,0),V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const inst=(geo,mat,list,fn,shadow=true)=>{if(!list.length)return null;const im=new THREE.InstancedMesh(geo,mat,list.length);im.frustumCulled=false;im.castShadow=shadow;im.receiveShadow=true;
    list.forEach((it,i)=>{fn(it,i,im);im.setMatrixAt(i,m4)});im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;sc.add(im);return im};
  const put=(x,y,z,rotY,sx,sy,sz)=>m4.compose(V(x,y,z),q.setFromAxisAngle(UP,rotY),V(sx,sy,sz));
  const okSpot=(x,z,m=2)=>Math.abs(x)<PLAY-m&&Math.abs(z)<PLAY-m&&!(x<-TP.EDGE&&Math.abs(z-TP.HWY_Z)<TP.ROAD/2+3)&&Math.hypot(x-MAP.start.x,z-MAP.start.z)>14&&!layoutNear(x,z);

  // --- trees: street + park trees from the plan, wooded clusters on the hills, and a two-row tree line at the edge
  const trees=P.trees.slice();
  for(let i=0;i<80;i++){const a=r()*6.28,d=132+r()*40,cx=Math.cos(a)*d,cz=Math.sin(a)*d,n=4+Math.floor(r()*9);
    for(let k=0;k<n;k++){const x=cx+(r()-.5)*20,z=cz+(r()-.5)*20;if(okSpot(x,z))trees.push({x,z,s:.9+r()*.9})}}
  const edge=[],e1=HALF-1.3,e2=HALF-2.9;for(let a=-HALF;a<=HALF;a+=3.4)[[a,-e1],[a,e1],[-e1,a],[e1,a],[a+1.7,-e2],[a+1.7,e2],[-e2,a+1.7],[e2,a+1.7]].forEach(([x,z])=>edge.push({x,z,s:1.3+r()*.7}));
  const allTrees=trees.concat(edge),leafCols=[0x3f6b2a,0x4a7a30,0x557f35,0x36602a,0x5d8a3a].map(c=>new THREE.Color(c));
  inst(new THREE.CylinderGeometry(.14,.22,1,7).translate(0,.5,0),new THREE.MeshStandardMaterial({color:0x5b4532,roughness:.95}),allTrees,(t)=>{const h=2.2*t.s;put(t.x,gh(t.x,t.z),t.z,0,t.s,h,t.s)});
  inst(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9}),allTrees,(t,i,im)=>{const s=t.s*(.9+r()*.25);put(t.x,gh(t.x,t.z)+2.2*t.s+1.2*s,t.z,r()*6,1.7*s,1.9*s,1.7*s);im.setColorAt(i,leafCols[Math.floor(r()*leafCols.length)])});
  trees.forEach(t=>solids.push({x:t.x,z:t.z,r:.45*t.s}));

  // --- rocks on the hills
  const rocks=[];for(let i=0;i<90;i++){const a=r()*6.28,d=130+r()*45,x=Math.cos(a)*d,z=Math.sin(a)*d;if(okSpot(x,z,4))rocks.push({x,z,s:.5+r()*1.4})}
  inst(new THREE.DodecahedronGeometry(1,0),SM(tex(128,128,(g,w,h)=>{g.fillStyle='#8a877f';g.fillRect(0,0,w,h);grime(g,w,h)}),.95,0),rocks,(k)=>{m4.compose(V(k.x,gh(k.x,k.z)+k.s*.35,k.z),q.setFromEuler(new THREE.Euler(r()*3,r()*3,r()*3)),V(k.s*1.3,k.s*.8,k.s))});
  rocks.forEach(k=>solids.push({x:k.x,z:k.z,r:k.s*1.1}));

  // --- lamp posts: pole, arm reaching over the road, lamp head
  const L=P.lamps,poleM=new THREE.MeshStandardMaterial({color:0x4b5157,roughness:.5,metalness:.6});
  inst(new THREE.CylinderGeometry(.07,.1,1,8).translate(0,.5,0),poleM,L,l=>put(l.x,gh(l.x,l.z),l.z,0,1,6.6,1));
  inst(new THREE.BoxGeometry(1,1,1),poleM,L,l=>put(l.x+l.ax*.8,gh(l.x,l.z)+6.5,l.z+l.az*.8,l.ax?0:PI/2,1.7,.08,.08));
  inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xeeeedd,emissive:0x998866,emissiveIntensity:.25}),L,l=>put(l.x+l.ax*1.55,gh(l.x,l.z)+6.4,l.z+l.az*1.55,l.ax?0:PI/2,.55,.14,.28),false);
  L.forEach(l=>solids.push({x:l.x,z:l.z,r:.25}));

  // --- parked cars: body (instance-coloured), glass cabin, four wheels
  const C=P.cars,carCols=[0xb8bcc2,0x1f2a36,0x8c1c13,0xe6e3dc,0x2d5d8a,0x3b3f42].map(c=>new THREE.Color(c));
  const along=(c,u,y,s)=>({x:c.x+Math.cos(c.rot)*u+Math.sin(c.rot)*s,y:gh(c.x,c.z)+y,z:c.z-Math.sin(c.rot)*u+Math.cos(c.rot)*s});
  inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.35,metalness:.4}),C,(c,i,im)=>{const p=along(c,0,.62,0);put(p.x,p.y,p.z,c.rot,4.3,.72,1.82);im.setColorAt(i,carCols[c.c])});
  inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x1d242b,roughness:.15,metalness:.5}),C,c=>{const p=along(c,-.25,1.22,0);put(p.x,p.y,p.z,c.rot,2.3,.6,1.62)});
  const wheels=[];C.forEach(c=>[[1.35,.86],[1.35,-.86],[-1.35,.86],[-1.35,-.86]].forEach(([u,s])=>wheels.push({c,u,s})));
  inst(new THREE.CylinderGeometry(.34,.34,.24,12).rotateX(PI/2),new THREE.MeshStandardMaterial({color:0x151515,roughness:.9}),wheels,w=>{const p=along(w.c,w.u,.34,w.s);put(p.x,p.y,p.z,w.c.rot,1,1,1)});
  C.forEach(c=>[-1.15,1.15].forEach(u=>{const p=along(c,u,0,0);solids.push({x:p.x,z:p.z,r:.95})}));

  // --- plaza fountain
  const stone=SM(tex(128,128,(g,w,h)=>{g.fillStyle='#c9c2b4';g.fillRect(0,0,w,h);grime(g,w,h)}),.8,0),water=new THREE.MeshStandardMaterial({color:0x4f86a8,roughness:.1,metalness:.2,transparent:true,opacity:.85});
  P.fountains.forEach(f=>{const y=gh(f.x,f.z);mk(C_(3.4,3.6,.7,28),stone,f.x,y+.35,f.z);mk(C_(3.05,3.05,.12,28),water,f.x,y+.62,f.z);mk(C_(.45,.6,2.4,12),stone,f.x,y+1.2,f.z);mk(C_(1.3,.5,.35,20),stone,f.x,y+2.5,f.z);
    solids.push({x:f.x,z:f.z,r:3.6})});
})()}
function C_(r1,r2,h,s){return new THREE.CylinderGeometry(r1,r2,h,s)}
