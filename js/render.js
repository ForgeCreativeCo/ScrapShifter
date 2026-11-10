// Rendering: sky shader (gradient, sun disc + glow, drifting clouds) baked into a cube map a face per frame, image-based
// lighting from that sky (reflections on glass, paint and metal), sun shadow setup, and the post-processing chain (bloom
// on fire/explosions/lamps, gamma, colour grade + vignette, FXAA). Graphics: High uses all of it; Medium the same at a
// lower pixel ratio; Low renders directly with a smaller shadow area. Auto resolution adjusts the pixel ratio to frame
// time. Post-processing scripts come from the CDN; if they fail to load, High/Medium fall back to Low.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const SKY=MAP.sky;
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{top:{value:new THREE.Color(SKY.top)},hor:{value:new THREE.Color(SKY.horizon)},gnd:{value:new THREE.Color(SKY.ground||SKY.fog)},
    sunDir:{value:new THREE.Vector3(...SKY.sunDir).normalize()},sunCol:{value:new THREE.Color(SKY.sun[0])},cloud:{value:SKY.cloud??.4},cloudCol:{value:new THREE.Color(SKY.cloudCol??0xffffff).multiplyScalar(SKY.cloudCol?1:1.05)},stars:{value:SKY.stars||0},time:{value:0}},
  vertexShader:`varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_Position.z*=.99999;}`, // pinned to the far plane
  fragmentShader:`uniform vec3 top,hor,gnd,sunDir,sunCol;uniform vec3 cloudCol;uniform float cloud,time,stars;varying vec3 vDir;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
    void main(){vec3 d=normalize(vDir);float y=d.y;
      vec3 col=y>0.?mix(hor,top,pow(y,.45)):mix(hor,gnd,pow(min(1.,-y*3.),.6));
      float s=max(dot(d,sunDir),0.);col+=sunCol*(pow(s,1200.)*12.+pow(s,40.)*.35+pow(s,5.)*.1);
      if(stars>0.&&y>0.){vec3 sp=d*150.,sg=floor(sp);float sh=fract(sin(dot(sg,vec3(127.1,311.7,74.7)))*43758.5453);col+=vec3(.8,.86,1.)*stars*step(.9975,sh)*(.5+3.*fract(sh*731.))*smoothstep(.5,.15,length(fract(sp)-.5))*smoothstep(.02,.35,y);}
      if(y>0.){vec2 uv=d.xz/(y+.1)*.9+vec2(time*.006,time*.002);float c=fbm(uv);c=smoothstep(1.-cloud-.12,1.-cloud+.3,c);
        float lit=smoothstep(.25,.9,fbm(uv*1.3+.4));vec3 cc=mix(hor*.78,cloudCol,lit)+sunCol*pow(s,6.)*.35;col=mix(col,cc,c*smoothstep(0.,.2,y)*.9);}
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`});
// The sky shader (two 5-octave fbm lookups per pixel) is too costly to run on every screen pixel each frame. It is
// rendered raw (before tone mapping) into a half-float cube map instead, one face per frame, so the whole sky refreshes
// every 6 frames (the clouds drift slowly). The dome on screen just samples the cube and tone-maps it.
const SKY_RAW=skyMat.fragmentShader.replace('#include <tonemapping_fragment>','').replace('#include <encodings_fragment>','');
const skyRawMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,uniforms:skyMat.uniforms,vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:SKY_RAW});
const skyRT=new THREE.WebGLCubeRenderTarget(512,{type:THREE.HalfFloatType,generateMipmaps:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
const skyScene=new THREE.Scene(),skyCubeCam=new THREE.CubeCamera(.05,10,skyRT);skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(1,48,24),skyRawMat),skyCubeCam);
let skyFace=0;
function skyFaceTick(all){const prev=R.getRenderTarget(),xr=R.xr.enabled;R.xr.enabled=false;skyScene.updateMatrixWorld();
  for(let k=0;k<(all?6:1);k++){R.setRenderTarget(skyRT,skyFace);R.render(skyScene,skyCubeCam.children[skyFace]);skyFace=(skyFace+1)%6}
  R.setRenderTarget(prev);R.xr.enabled=xr}
const skyDomeMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{cube:{value:skyRT.texture}},
  vertexShader:skyMat.vertexShader,
  fragmentShader:`uniform samplerCube cube;varying vec3 vDir;void main(){gl_FragColor=vec4(textureCube(cube,normalize(vDir)).rgb,1.);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`});
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(1,48,24),skyDomeMat);skyDome.frustumCulled=false;skyDome.renderOrder=-1;sc.add(skyDome);
skyFaceTick(true);

// Image-based lighting: bake the sky into an environment map once; the sky now does most of the ambient light
{const pm=new THREE.PMREMGenerator(R),es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(1,48,24),skyMat));
  sc.environment=pm.fromScene(es,.02).texture;pm.dispose();hemi.intensity*=.3;R.toneMappingExposure=SKY.exposure??.92}
// Ordinary surfaces take a softer share of sky light (glossy glass/paint set their own envMapIntensity). Run once
// everything is built (main.js) and on new materials as they appear.
function tuneEnv(root=sc){root.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];ms.forEach(m=>{if(m.isMeshStandardMaterial&&!m.userData.envTuned){m.userData.envTuned=true;if(m.envMapIntensity===1)m.envMapIntensity=.5}})})}

// Graphics quality
let GFX=(()=>{try{return localStorage.getItem('scrapGfx')||'high'}catch(e){return'high'}})();
const SHADOW_EXT=MAP.size>200?60:32;
function applyShadows(){const ext=GFX!=='low'?SHADOW_EXT:Math.min(SHADOW_EXT,30),ms=GFX==='high'?4096:2048;
  Object.assign(sun.shadow.camera,{left:-ext,right:ext,top:ext,bottom:-ext,near:1,far:200});sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}}
applyShadows();

// Post-processing: scene (half-float, so dark tones keep precision) -> bloom -> gamma -> grade/vignette (in display
// space, where contrast behaves perceptually) -> FXAA. A multisampled target corrupted the image on Intel/ANGLE,
// so anti-aliasing is FXAA on the final image.
let composer=null,bloomPass=null,fxaaPass=null;
const GRADE={uniforms:{tDiffuse:{value:null},sat:{value:1},con:{value:1},tint:{value:new THREE.Vector3(1,1,1)},vig:{value:.25}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float sat,con,vig;uniform vec3 tint;varying vec2 vUv;
    void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,sat);c=clamp((c-.5)*con+.5,0.,1.)*tint;
      c*=mix(1.-vig,1.,1.-smoothstep(.25,.85,length((vUv-.5)*vec2(1.15,1.)))); /* smoothstep needs edge0<edge1 */gl_FragColor=vec4(c,1.);}`};
function setupPost(){if(composer||!THREE.EffectComposer||!THREE.UnrealBloomPass||!THREE.GammaCorrectionShader)return false;
  const sz=R.getDrawingBufferSize(new THREE.Vector2());
  composer=new THREE.EffectComposer(R,new THREE.WebGLRenderTarget(sz.x,sz.y,{type:THREE.HalfFloatType}));composer.addPass(new THREE.RenderPass(sc,cam));
  bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(sz.x/2,sz.y/2),...(SKY.bloom||[.5,.55,.86])); // strength, radius, thresholdcomposer.addPass(bloomPass);
  composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
  const g=new THREE.ShaderPass(GRADE),G=SKY.grade||{};g.uniforms.sat.value=G.sat??1;g.uniforms.con.value=G.con??1;g.uniforms.vig.value=G.vig??.25;g.uniforms.tint.value.set(...(G.tint||[1,1,1]));composer.addPass(g);
  if(THREE.FXAAShader){fxaaPass=new THREE.ShaderPass(THREE.FXAAShader);composer.addPass(fxaaPass)}sizePost();return true}
function sizePost(){if(!composer)return;const w=cv.clientWidth||800,h=cv.clientHeight||500,pr=R.getPixelRatio();composer.setPixelRatio(pr);composer.setSize(w,h);
  if(fxaaPass)fxaaPass.material.uniforms.resolution.value.set(1/(w*pr),1/(h*pr))}
window.addEventListener('resize',sizePost);
// Graphics: High = full post chain, 4096 shadows; Medium = the same look at pixel ratio <= 1 with 2048 shadows;
// Low = direct render, smaller shadow area. Auto resolution: when frames run slow (smoothed > 24 ms for 2 s) the
// pixel ratio drops 0.25 toward the quality's floor; when they're fast (< 17.5 ms for 5 s) it climbs back to the ceiling.
const DPR=Math.min(2,window.devicePixelRatio||1);
const PR_CAP={high:[DPR,Math.min(1,DPR)],medium:[Math.min(1,DPR),Math.min(.75,DPR)],low:[DPR,Math.min(.75,DPR)]}; // [ceiling, floor]
let prNow=R.getPixelRatio(),frameMs=16.7,prSlowT=0,prFastT=0;
function prSet(v){if(Math.abs(v-prNow)<.01)return;prNow=v;R.setPixelRatio(v);sizePost();prSlowT=prFastT=0}
function autoRes(dt){if(document.hidden||dt>=.05)return; // skip stalls and background tabs
  frameMs+=(dt*1000-frameMs)*.05;const [hi,lo]=PR_CAP[GFX]||PR_CAP.low;
  if(frameMs>24&&prNow>lo){prFastT=0;if((prSlowT+=dt)>2)prSet(Math.max(lo,prNow-.25))}
  else if(frameMs<17.5&&prNow<hi){prSlowT=0;if((prFastT+=dt)>5)prSet(Math.min(hi,prNow+.25))}else prSlowT=prFastT=0}
function setGfx(v){GFX=v;try{localStorage.setItem('scrapGfx',v)}catch(e){}if(v!=='low'&&!setupPost()&&!composer)GFX='low';applyShadows();prSet(PR_CAP[GFX][0]);const s=document.getElementById('gfxSel');if(s)s.value=GFX}
setGfx(GFX);
function renderFrame(dt){skyMat.uniforms.time.value+=dt;skyFaceTick(false);skyDome.position.copy(cam.position);
  if(GFX!=='low'&&composer)composer.render(dt);else R.render(sc,cam);autoRes(dt)}
