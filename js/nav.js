// Enemy navigation: a 2 m grid over the map, A* pathfinding, and line-of-sight checks.
// Blocked cells = map edge, scenery colliders, and blocking pieces (ground-floor panels, walls, sheds) inflated by
// NAV_INF so a crawler-sized hull fits. When a piece is destroyed (or reset), only the cells around it are re-checked,
// so holes punched in buildings and collapsed blocks open up new routes immediately.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const NAV_C=2,NAV_N=Math.ceil(MAP.size/NAV_C),NAV_INF=1.7,NAV_N2=NAV_N*NAV_N;
const navStatic=new Uint8Array(NAV_N2),navDyn=new Uint8Array(NAV_N2);
const nIdx=(i,j)=>j*NAV_N+i,cellC=i=>(i+.5)*NAV_C-HALF,toCell=x=>Math.max(0,Math.min(NAV_N-1,Math.floor((x+HALF)/NAV_C)));
const navBlocked=k=>navStatic[k]||navDyn[k];

// Static layer: outside the play area, and scenery
for(let j=0;j<NAV_N;j++)for(let i=0;i<NAV_N;i++)if(Math.abs(cellC(i))>PLAY-1||Math.abs(cellC(j))>PLAY-1)navStatic[nIdx(i,j)]=1;
solids.forEach(s=>{const R=s.r+NAV_INF;for(let j=toCell(s.z-R);j<=toCell(s.z+R);j++)for(let i=toCell(s.x-R);i<=toCell(s.x+R);i++)if(Math.hypot(cellC(i)-s.x,cellC(j)-s.z)<R)navStatic[nIdx(i,j)]=1});

// Dynamic layer: blocking pieces. Re-check a rectangle of cells against whatever still stands there.
const pieceBlocksCell=(p,x,z)=>{if(p.state===2||p.blocks===false)return false;const[lx,lz]=pieceLocal(p,x,z);return Math.hypot(Math.max(Math.abs(lx)-p.w/2,0),Math.max(Math.abs(lz)-p.d/2,0))<NAV_INF};
function navRecompute(x0,z0,x1,z1){for(let j=toCell(z0);j<=toCell(z1);j++)for(let i=toCell(x0);i<=toCell(x1);i++){const x=cellC(i),z=cellC(j);
  navDyn[nIdx(i,j)]=piecesNear(x,z,NAV_INF+NAV_C).some(p=>pieceBlocksCell(p,x,z))?1:0}}
const pieceBox=p=>{const r=Math.hypot(p.w,p.d)/2+NAV_INF+NAV_C;return[p.x-r,p.z-r,p.x+r,p.z+r]};
pieces.forEach(p=>{if(p.blocks!==false)navRecompute(...pieceBox(p))});
const navDirtySet=new Set();
function navDirty(p){if(p.blocks!==false)navDirtySet.add(p)} // called from setPieceState
function navFlush(){if(!navDirtySet.size)return;navDirtySet.forEach(p=>navRecompute(...pieceBox(p)));navDirtySet.clear();navRegionStale=true}
// Reachability: flood-fill from the map's start so wander targets and spawns avoid sealed pockets (e.g. courtyards
// behind alleys too narrow for a crawler). Refreshed lazily after the grid changes.
const navRegion=new Uint8Array(NAV_N2);let navRegionStale=true;
function navFillRegion(){navRegion.fill(0);const[si,sj]=nearestFree(toCell(MAP.start.x),toCell(MAP.start.z)),q=[nIdx(si,sj)];navRegion[q[0]]=1;
  for(let h=0;h<q.length;h++){const k=q[h],i=k%NAV_N,j=(k/NAV_N)|0;for(const[di,dj]of NB.slice(0,4)){const a=i+di,b=j+dj;if(a<0||b<0||a>=NAV_N||b>=NAV_N)continue;const n=nIdx(a,b);if(!navRegion[n]&&!navBlocked(n)){navRegion[n]=1;q.push(n)}}}
  navRegionStale=false}
function navReachable(x,z){if(navRegionStale)navFillRegion();return navRegion[nIdx(toCell(x),toCell(z))]===1}

// Walkable straight line? (samples the grid every half cell)
function navLine(ax,az,bx,bz){const d=Math.hypot(bx-ax,bz-az),n=Math.ceil(d/(NAV_C*.5));
  for(let k=1;k<=n;k++){const t=k/n;if(navBlocked(nIdx(toCell(ax+(bx-ax)*t),toCell(az+(bz-az)*t))))return false}return true}
// Clear line of fire? (3D: shells fly through holes and over low walls)
function fireLine(a,b){const d=a.distanceTo(b),n=Math.ceil(d/.8),p=new THREE.Vector3();
  for(let k=2;k<n-1;k++){p.lerpVectors(a,b,k/n);for(const pc of piecesNear(p.x,p.z,.3))if(pieceHitShot(pc,p))return false}return true}

// Weighted A* on the grid: 8-way moves, no cutting corners, octile heuristic, binary heap. Returns smoothed waypoints
// (string-pulled with navLine), or a partial path to the closest reachable cell if the goal can't be reached.
const aG=new Float32Array(NAV_N2),aFrom=new Int32Array(NAV_N2),aSeen=new Uint32Array(NAV_N2),aShut=new Uint32Array(NAV_N2);let aRun=0;
const heapK=[],heapF=[];
function hPush(k,f){let i=heapK.length;heapK.push(k);heapF.push(f);while(i>0){const p=(i-1)>>1;if(heapF[p]<=f)break;heapK[i]=heapK[p];heapF[i]=heapF[p];i=p}heapK[i]=k;heapF[i]=f}
function hPop(){const top=heapK[0],k=heapK.pop(),f=heapF.pop(),n=heapK.length;if(n){let i=0;for(;;){const l=2*i+1;if(l>=n)break;const r=l+1,m=r<n&&heapF[r]<heapF[l]?r:l;if(heapF[m]>=f)break;heapK[i]=heapK[m];heapF[i]=heapF[m];i=m}heapK[i]=k;heapF[i]=f}return top}
function nearestFree(i,j){if(!navBlocked(nIdx(i,j)))return[i,j];for(let r=1;r<8;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;
  const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<NAV_N&&b<NAV_N&&!navBlocked(nIdx(a,b)))return[a,b]}return[i,j]}
const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
function findPath(sx,sz,gx,gz,maxIter=15000){aRun++;heapK.length=heapF.length=0;
  const[si,sj]=nearestFree(toCell(sx),toCell(sz)),[gi,gj]=nearestFree(toCell(gx),toCell(gz)),s=nIdx(si,sj),g=nIdx(gi,gj);
  const h=(i,j)=>{const dx=Math.abs(i-gi),dy=Math.abs(j-gj);return 1.5*(dx+dy-.586*Math.min(dx,dy))}; // weighted A* (×1.5): near-optimal, much faster
  aG[s]=0;aFrom[s]=-1;aSeen[s]=aRun;hPush(s,h(si,sj));let best=s,bestH=h(si,sj),it=0;
  while(heapK.length&&it++<maxIter){const k=hPop();if(aShut[k]===aRun)continue;aShut[k]=aRun;if(k===g){best=k;break}
    const i=k%NAV_N,j=(k/NAV_N)|0,hk=h(i,j);if(hk<bestH){bestH=hk;best=k}
    for(const[di,dj,c]of NB){const a=i+di,b=j+dj;if(a<0||b<0||a>=NAV_N||b>=NAV_N)continue;const n=nIdx(a,b);if(navBlocked(n)||aShut[n]===aRun)continue;
      if(di&&dj&&(navBlocked(nIdx(i+di,j))||navBlocked(nIdx(i,j+dj))))continue;
      const gn=aG[k]+c;if(aSeen[n]!==aRun||gn<aG[n]){aSeen[n]=aRun;aG[n]=gn;aFrom[n]=k;hPush(n,gn+h(a,b))}}}
  const cells=[];for(let k=best;k!==-1;k=aFrom[k])cells.push({x:cellC(k%NAV_N),z:cellC((k/NAV_N)|0)});cells.reverse();
  if(best===g)cells.push({x:gx,z:gz});
  const out=[];let a={x:sx,z:sz};for(let i=1;i<cells.length;i++){if(!navLine(a.x,a.z,cells[i].x,cells[i].z)){out.push(cells[i-1]);a=cells[i-1]}} // string-pull
  if(cells.length)out.push(cells[cells.length-1]);out.partial=best!==g;return out}

// Steering helper for enemies: the heading to take toward (gx,gz). Goes straight when the line is clear, otherwise
// follows a cached path, re-planned every ~1.5 s, when the goal moves, or when stuck. A few paths per frame at most.
let navBudget=0;
function navWant(e,gx,gz,dt){e.repathT=(e.repathT||0)-dt;
  if(navLine(e.x,e.z,gx,gz)){e.path=null;return Math.atan2(-(gz-e.z),gx-e.x)}
  if((!e.path||e.repathT<=0||Math.hypot(gx-e.goalX,gz-e.goalZ)>6)&&navBudget>0){navBudget--;e.path=findPath(e.x,e.z,gx,gz);e.pi=0;e.goalX=gx;e.goalZ=gz;e.repathT=rnd(1.2,1.8)}
  if(!e.path||!e.path.length)return Math.atan2(-(gz-e.z),gx-e.x);
  while(e.pi<e.path.length-1&&(Math.hypot(e.path[e.pi].x-e.x,e.path[e.pi].z-e.z)<2.5||navLine(e.x,e.z,e.path[e.pi+1].x,e.path[e.pi+1].z)))e.pi++;
  const w=e.path[e.pi];
  if(e.pi===e.path.length-1&&e.path.partial&&Math.hypot(w.x-e.x,w.z-e.z)<3)return Math.atan2(-(gz-e.z),gx-e.x); // end of a partial path: push straight at the goal
  return Math.atan2(-(w.z-e.z),w.x-e.x)}
// Stuck check: if an enemy trying to move hasn't covered 0.6 m in a second, force a re-plan and a short reverse
function navStuck(e,dt,trying){e.stT=(e.stT||0)+dt;if(e.stT<1)return;e.stT=0;const moved=Math.hypot(e.x-(e.sx??e.x+9),e.z-(e.sz??e.z+9));e.sx=e.x;e.sz=e.z;
  if(trying&&moved<.6){e.repathT=0;e.unstick=.8}}
// A random reachable patrol point
// A random reachable point, anywhere or within r of (cx,cz)
function navRandomPoint(cx,cz,r){for(let t=0;t<60;t++){const x=cx===undefined?rnd(-PLAY,PLAY)*.85:Math.max(-PLAY,Math.min(PLAY,cx+rnd(-r,r))),z=cz===undefined?rnd(-PLAY,PLAY)*.85:Math.max(-PLAY,Math.min(PLAY,cz+rnd(-r,r)));if(navReachable(x,z))return{x,z}}return{x:MAP.start.x,z:MAP.start.z}}
