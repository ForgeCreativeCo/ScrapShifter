// Rendering: sky shader (gradient, sun disc + glow, drifting clouds), image-based lighting from that sky
// (reflections on glass, paint and metal), sun shadow setup, and the post-processing chain (MSAA, bloom on
// fire/explosions/lamps, colour grade + vignette, gamma). Graphics: High uses all of it; Low renders directly
// with a smaller shadow map. Post-processing scripts come from the CDN; if they fail to load, High falls back to Low.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const SKY=MAP.sky;
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{top:{value:new THREE.Color(SKY.top)},hor:{value:new THREE.Color(SKY.horizon)},gnd:{value:new THREE.Color(SKY.ground||SKY.fog)},
    sunDir:{value:new THREE.Vector3(...SKY.sunDir).normalize()},sunCol:{value:new THREE.Color(SKY.sun[0])},cloud:{value:SKY.cloud??.4},time:{value:0}},
  vertexShader:`varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_Position.z*=.99999;}`, // pinned to the far plane
  fragmentShader:`uniform vec3 top,hor,gnd,sunDir,sunCol;uniform float cloud,time;varying vec3 vDir;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
    void main(){vec3 d=normalize(vDir);float y=d.y;
      vec3 col=y>0.?mix(hor,top,pow(y,.45)):mix(hor,gnd,pow(min(1.,-y*3.),.6));
      float s=max(dot(d,sunDir),0.);col+=sunCol*(pow(s,1200.)*12.+pow(s,40.)*.35+pow(s,5.)*.1);
      if(y>0.){vec2 uv=d.xz/(y+.1)*.9+vec2(time*.006,time*.002);float c=fbm(uv);c=smoothstep(1.-cloud-.12,1.-cloud+.3,c);
        float lit=smoothstep(.25,.9,fbm(uv*1.3+.4));vec3 cc=mix(hor*.78,vec3(1.)*1.05,lit)+sunCol*pow(s,6.)*.35;col=mix(col,cc,c*smoothstep(0.,.2,y)*.9);}
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`});
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(1,48,24),skyMat);skyDome.frustumCulled=false;skyDome.renderOrder=-1;sc.add(skyDome);

// Image-based lighting: bake the sky into an environment map once; the sky now does most of the ambient light
{const pm=new THREE.PMREMGenerator(R),es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(1,48,24),skyMat));
  sc.environment=pm.fromScene(es,.02).texture;pm.dispose();hemi.intensity*=.3;R.toneMappingExposure=.92}
// Ordinary surfaces take a softer share of sky light (glossy glass/paint set their own envMapIntensity). Run once
// everything is built (main.js) and on new materials as they appear.
function tuneEnv(root=sc){root.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];ms.forEach(m=>{if(m.isMeshStandardMaterial&&!m.userData.envTuned){m.userData.envTuned=true;if(m.envMapIntensity===1)m.envMapIntensity=.5}})})}

// Graphics quality
let GFX=(()=>{try{return localStorage.getItem('scrapGfx')||'high'}catch(e){return'high'}})();
const SHADOW_EXT=MAP.size>200?60:32;
function applyShadows(){const hi=GFX==='high',ext=hi?SHADOW_EXT:Math.min(SHADOW_EXT,30),ms=hi?4096:2048;
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
  bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(sz.x/2,sz.y/2),.5,.55,.86);composer.addPass(bloomPass);
  composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
  const g=new THREE.ShaderPass(GRADE),G=SKY.grade||{};g.uniforms.sat.value=G.sat??1;g.uniforms.con.value=G.con??1;g.uniforms.vig.value=G.vig??.25;g.uniforms.tint.value.set(...(G.tint||[1,1,1]));composer.addPass(g);
  if(THREE.FXAAShader){fxaaPass=new THREE.ShaderPass(THREE.FXAAShader);composer.addPass(fxaaPass)}sizePost();return true}
function sizePost(){if(!composer)return;const w=cv.clientWidth||800,h=cv.clientHeight||500,pr=R.getPixelRatio();composer.setPixelRatio(pr);composer.setSize(w,h);
  if(fxaaPass)fxaaPass.material.uniforms.resolution.value.set(1/(w*pr),1/(h*pr))}
window.addEventListener('resize',sizePost);
function setGfx(v){GFX=v;try{localStorage.setItem('scrapGfx',v)}catch(e){}if(v==='high'&&!setupPost()&&!composer)GFX='low';applyShadows();const s=document.getElementById('gfxSel');if(s)s.value=GFX}
setGfx(GFX);
function renderFrame(dt){skyMat.uniforms.time.value+=dt;skyDome.position.copy(cam.position);
  if(GFX==='high'&&composer)composer.render(dt);else R.render(sc,cam)}
