// The transforming vehicle: parts with a pose per mode (0 buggy, 1 artillery, 2 mech).
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Vehicle (built from parts, each with a pose per mode: 0 buggy, 1 artillery, 2 mech) ----------
const root=new THREE.Group();sc.add(root);
const add=(g,m,x=0,y=0,z=0,p=root)=>mk(g,m,x,y,z,p);
const grp=(p=root)=>{const g=new THREE.Group();p.add(g);return g};
const ps=(p,r=[0,0,0],s=[1,1,1])=>({p,r,s}),HID=ps([0,1,0],[0,0,0],[.001,.001,.001]);
const parts=[];const P=(o,v,a,m)=>parts.push({o,po:[v,a||v,m]});
[1,-1].forEach(s=>P(add(B(.5,1.1,.5),steel),HID,null,ps([0,1.95,.5*s])));
[1,-1].forEach(s=>P(add(B(.55,1,.55),s>0?olive:rusty),HID,null,ps([.05,.85,.5*s])));
[1,-1].forEach(s=>P(add(B(1,.3,.65),steel),HID,null,ps([.15,.15,.5*s])));
[.95,-.95].forEach(z=>{const s=Math.sign(z);P(add(C(.48,.38),tireM),ps([-1.05,.48,z],[PI/2,0,0]),null,ps([.1,1.4,.85*s],[PI/2,0,0],[.75,1,.75]));P(add(C(.2,.4,8),rusty),ps([-1.05,.48,z],[PI/2,0,0]),null,ps([.1,1.4,.85*s],[PI/2,0,0],[.75,1,.75]))});
const nose=add(B(.6,.4,1.6),rusty);P(nose,ps([1.75,.85,0],[0,0,-.35]),null,ps([0,2.55,0],[0,0,0],[1.2,1.3,.9]));
const hull=add(B(3.2,.6,1.8),olive);P(hull,ps([0,.95,0]),null,ps([0,3.55,0],[0,0,PI/2],[.55,1.25,1]));
[[-.8,.12,.91,rusty,.06],[.55,-.06,.91,primer,-.08],[-.3,.05,-.91,primer,.1],[.8,.1,-.91,rusty,-.05]].forEach(([x,y,z,m,r])=>{add(B(.75,.32,.03),m,x,y,z,hull).rotation.z=r});
[.6,-.6].forEach(z=>{add(C(.06,.8,8),steel,-1.45,.55,z,hull);add(C(.08,.06,8),rusty,-1.45,.96,z,hull)});
add(B(.14,.2,1.95),rusty,1.0,-.2,0,nose);[-.6,0,.6].forEach(z=>{add(new THREE.ConeGeometry(.07,.32,8),steel,1.22,-.2,z,nose).rotation.z=-PI/2});
[1,-1].forEach(s=>P(add(B(2.8,.12,.02),hazard),ps([0,.95,.915*s]),null,ps([0,3.55,.915*s],[0,0,PI/2],[.6,1,1])));
[[1.75,.7,4.3],[1.75,-.7,4.3],[-1.75,.7,3.4],[-1.75,-.7,3.4]].forEach(([x,z,my])=>{const p=grp();add(B(.18,1.1,.18),steel,0,-.55,0,p);add(B(.45,.08,.45),hazard,0,-1.1,0,p);P(p,ps([x,.75,z],[0,0,0],[1,.02,1]),ps([x,.75,z]),ps([-.7,my,z*.6],[0,0,.6],[1,.55,1]))});
const deck=add(B(2.2,.35,1.4),steel);P(deck,ps([-.3,1.42,0]),null,ps([-.6,3.7,0],[0,0,PI/2],[.6,1,.9]));
add(C(.34,.18),tireM,-.75,.27,0,deck);add(B(.5,.25,.35),sand,.2,.3,.4,deck).rotation.y=.2;add(B(.45,.22,.3),sand,.25,.29,-.42,deck).rotation.y=-.15;
[.95,-.95].forEach(z=>{const s=Math.sign(z);P(add(C(.48,.38),tireM),ps([1.05,.48,z],[PI/2,0,0]),null,ps([0,4.25,1.15*s],[PI/2,0,0]));P(add(C(.2,.4,8),rusty),ps([1.05,.48,z],[PI/2,0,0]),null,ps([0,4.25,1.18*s],[PI/2,0,0]))});
P(add(C(.5,.32),rusty),ps([-.35,1.76,0]),null,ps([0,4.05,-1.25],[0,0,0],[.6,1,.6]));
const ARM={}; // the mech's shield arm (+z side): upper arm, forearm, shield plate. Swung by the shield bash (mech.js)
[1,-1].forEach(s=>{P(add(B(.4,1.1,.4),s>0?primer:steel),HID,null,ps([0,3.55,1.25*s]));if(s>0)ARM.upper=parts[parts.length-1]});
P(add(B(.38,1,.38),rusty),HID,null,ps([.3,2.8,1.25],[0,0,.9]));ARM.fore=parts[parts.length-1];
const piv=grp();const gun=grp(piv);
add(C(.11,1.5,14),steel,.75,0,0,gun).rotation.z=-PI/2;
add(B(.6,.26,.26),rusty,.4,0,0,gun);
add(C(.19,.3,10),steel,1.5,0,0,gun).rotation.z=-PI/2;
const extP=grp(gun);add(C(.085,1.6,12),primer,.8,0,0,extP).rotation.z=-PI/2;add(C(.13,.22,8),steel,1.55,0,0,extP).rotation.z=-PI/2;
const muz=new THREE.Object3D();gun.add(muz);
P(piv,ps([-.35,1.86,0]),ps([-.35,1.86,0],[0,0,.62]),ps([.05,2.95,-1.25],[0,0,.05]));
P(extP,ps([1.6,0,0],[0,0,0],[.01,1,1]),ps([1.6,0,0]),ps([1.6,0,0],[0,0,0],[.4,1,1]));
[1,-1].forEach(s=>{const p=grp();add(B(1.9,.06,.55),hazard,0,0,.27*s,p);P(p,ps([-.3,1.6,.7*s]),ps([-.3,1.6,.7*s],[-s*1.25,0,0]),s>0?ps([.72,2.75,1.0],[0,0,PI/2]):ps([-.85,3.7,-.35],[0,0,PI/2+.3]));if(s>0)ARM.shield=parts[parts.length-1]});
const cab=add(B(.9,.45,1.2),primer);P(cab,ps([.95,1.45,0]),null,ps([0,4.75,0],[0,0,0],[.65,1.2,.6]));
[-.38,0,.38].forEach(z=>add(B(.04,.4,.05),steel,.49,.02,z,cab));add(B(.95,.05,.05),steel,0,.25,.55,cab);add(B(.95,.05,.05),steel,0,.25,-.55,cab);
P(add(B(.05,.32,1),glassM),ps([1.41,1.48,0]),null,ps([.31,4.78,0],[0,0,0],[1,.6,.55]));
const ant=add(B(.04,1,.04),steel);P(ant,ps([-1.3,2.1,.5]),null,ps([-.1,5.3,.25],[0,0,0],[1,.6,1]));add(B(.02,.2,.34),olive,0,.38,.17,ant);
const L=(a,b,k)=>a+(b-a)*k;
const apply=(pt,f,to,k)=>{const o=pt.o;o.position.set(L(f.p[0],to.p[0],k),L(f.p[1],to.p[1],k),L(f.p[2],to.p[2],k));o.rotation.set(L(f.r[0],to.r[0],k),L(f.r[1],to.r[1],k),L(f.r[2],to.r[2],k));o.scale.set(L(f.s[0],to.s[0],k),L(f.s[1],to.s[1],k),L(f.s[2],to.s[2],k))};
parts.forEach(pt=>apply(pt,pt.po[0],pt.po[0],1));
