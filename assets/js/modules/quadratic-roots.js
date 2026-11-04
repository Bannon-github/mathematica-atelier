/** Quadratic polynomial discriminant sphere, adapted from user-supplied GLSL. */
export function createQuadraticRoots(THREE, renderer, controls){
 const nav=document.getElementById('workspaceNav'),status=document.getElementById('status');
 let active=false,elapsed=0,playing=true,mode=0,speed=0.5,quality=2,previousStatus='',previousEditorVisible=false;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const uniforms={
  uResolution:{value:new THREE.Vector2(1,1)},uTime:{value:0},uRotationSpeed:{value:0.5},
  uMode:{value:0},uQuality:{value:2}
 };
 const material=new THREE.ShaderMaterial({
  uniforms,depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:"\nprecision highp float;\nuniform vec2 uResolution;\nuniform float uTime,uRotationSpeed;\nuniform int uMode,uQuality;\nfloat divsafe(float a,float b){return a/((b<0.0?-1.0:1.0)*max(abs(b),0.00001));}\nvec3 getColor(vec3 p){\n float a=uRotationSpeed*uTime,si=sin(a),co=cos(a);\n p.xz=mat2(co,-si,si,co)*p.xz;\n float h=p.y*p.y-4.0*p.x*p.z, m=11.0;\n vec3 col;\n if(h<0.0){col=vec3(0.0,0.5,1.0);float f=sqrt(abs(divsafe(p.z,p.x)));m=min(f,divsafe(1.0,f));}\n else{\n  float s=sqrt(max(0.0,h)),t1=divsafe((-p.y-s)*0.5,p.x),t2=divsafe((-p.y+s)*0.5,p.x);\n  col=t1*t2>0.0?vec3(1.0,0.9,0.8):vec3(1.0,0.5,0.1);\n  m=16.0*min(min(abs(t1),abs(t2)),min(abs(divsafe(1.0,t1)),abs(divsafe(1.0,t2))));\n }\n col*=clamp(log(1.0+max(0.0,m)),0.0,1.0);\n col*=clamp(log(1.0+16.0*abs(h)),0.0,1.0);\n col*=0.7+0.3*smoothstep(-0.1,0.1,sin(abs(24.0*h)));\n return col;\n}\nfloat sphIntersect(vec3 ro,vec3 rd,vec4 sph){\n vec3 oc=ro-sph.xyz;float b=dot(oc,rd),c=dot(oc,oc)-sph.w*sph.w,h=b*b-c;\n if(h<0.0)return -1.0;float t=-b-sqrt(h);return t>0.0?t:-1.0;\n}\nfloat sphSoftShadow(vec3 ro,vec3 rd,vec4 sph,float k){\n vec3 oc=ro-sph.xyz;float b=dot(oc,rd),c=dot(oc,oc)-sph.w*sph.w,h=b*b-c;\n if(b>=0.0)return 1.0;\n if(h>0.0&&-b-sqrt(h)>0.0001)return 0.0;\n return clamp(k*sqrt(max(0.0,-h))/max(0.001,-b),0.0,1.0);\n}\nfloat sphOcclusion(vec3 pos,vec3 nor,vec4 sph){\n vec3 r=sph.xyz-pos;float l=max(0.001,length(r));\n return dot(nor,r)*sph.w*sph.w/(l*l*l);\n}\nvec3 plot2D(vec2 px){\n vec2 p=px/uResolution.xy;p.x-=0.5;\n vec2 a=p.yx*vec2(3.14159265,6.28318530);\n vec3 q=vec3(cos(a.x),sin(a.x)*cos(a.y),sin(a.x)*sin(a.y));\n return getColor(q);\n}\nvec3 plot3D(vec2 px){\n vec2 p=(-uResolution.xy+2.0*px)/uResolution.y;\n vec3 ro=vec3(0.0,0.0,3.0),rd=normalize(vec3(p,-2.0));\n vec4 sph=vec4(0.0,0.0,0.0,1.0);\n vec3 col=vec3(0.0),nor=vec3(0.0,1.0,0.0),mate=vec3(1.0);\n float tmin=1.0e10,occ=1.0;\n if(abs(rd.y)>0.0001){\n  float t=(-1.0-ro.y)/rd.y;\n  if(t>0.0){tmin=t;vec3 pos=ro+t*rd;occ=1.0-clamp(sphOcclusion(pos,nor,sph),0.0,1.0);mate=vec3(0.2);}\n }\n float t=sphIntersect(ro,rd,sph);\n if(t>0.0&&t<tmin){tmin=t;vec3 pos=ro+t*rd;nor=normalize(pos-sph.xyz);occ=0.5+0.5*nor.y;mate=getColor(nor);}\n if(tmin<1000.0){\n  vec3 pos=ro+tmin*rd,lig=normalize(vec3(0.6,0.3,0.4));\n  float sha=sphSoftShadow(pos+nor*0.002,lig,sph,2.0);\n  vec3 lin=vec3(1.5)*clamp(dot(nor,lig),0.0,1.0)*sha;\n  lin+=0.5*occ;lin+=0.5*occ*pow(clamp(1.0+dot(nor,rd),0.0,1.0),3.0);\n  col=mate*lin*exp(-0.05*tmin);\n }\n return col;\n}\nvoid main(){\n vec2 xy=gl_FragCoord.xy;vec3 total=vec3(0.0);\n for(int i=0;i<2;i++)for(int j=0;j<2;j++){\n  if(uQuality==1&&(i>0||j>0))continue;\n  float aa=float(uQuality);\n  vec2 p=xy+vec2(float(i),float(j))/aa-(uQuality==1?vec2(0.0):vec2(0.5));\n  bool flat=uMode==2||(uMode==0&&sin(0.7*uTime)<-0.5);\n  vec3 color=flat?plot2D(p):plot3D(p);\n  total+=pow(max(color,vec3(0.0)),vec3(0.4545));\n }\n total/=float(uQuality*uQuality);\n total+=sin(xy.x*114.0)*sin(xy.y*211.1)/512.0;\n gl_FragColor=vec4(clamp(total,0.0,1.0),1.0);\n}\n"
 });
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quad.frustumCulled=false;scene.add(quad);
 const button=document.createElement('button');button.type='button';button.id='quadraticRootsToggle';
 button.className='quadratic-toggle';button.textContent='Quadratic Roots';button.setAttribute('aria-pressed','false');
 button.title='Visualize quadratic roots and their discriminant on a sphere';
 nav.insertBefore(button,nav.querySelector('.token-commandbar')||null);
 const panel=document.createElement('section');panel.id='quadraticRootsPanel';panel.className='quadratic-panel';
 panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Quadratic roots controls');
 panel.innerHTML="\n<div class=\"quadratic-panel-title\"><strong>Quadratic Roots</strong><button type=\"button\" id=\"quadraticClose\" aria-label=\"Close Quadratic Roots\">×</button></div>\n<p class=\"quadratic-equation\">a·r² + b·r + c = 0</p>\n<p class=\"quadratic-subtitle\">Each point on the unit sphere represents coefficients (a, b, c). Colour reveals the roots using Δ = b² − 4ac.</p>\n<label for=\"quadraticMode\">View</label>\n<select id=\"quadraticMode\"><option value=\"0\">Automatic: 3D ↔ 2D map</option><option value=\"1\">3D sphere and shadow</option><option value=\"2\">2D flattened sphere map</option></select>\n<label for=\"quadraticSpeed\">Solution-space rotation <output id=\"quadraticSpeedLabel\">0.50 rad/s</output></label>\n<input id=\"quadraticSpeed\" type=\"range\" min=\"0\" max=\"2\" step=\"0.05\" value=\"0.5\">\n<label for=\"quadraticQuality\">Antialiasing</label>\n<select id=\"quadraticQuality\"><option value=\"2\">Smooth (2×2)</option><option value=\"1\">Fast (1 sample)</option></select>\n<div class=\"quadratic-actions\"><button type=\"button\" id=\"quadraticPlay\">Pause motion</button><button type=\"button\" id=\"quadraticReset\">Reset</button></div>\n<div class=\"quadratic-legend\" aria-label=\"Root colour legend\">\n <div><span class=\"quadratic-swatch quadratic-complex\"></span>Complex roots (Δ &lt; 0)</div>\n <div><span class=\"quadratic-swatch quadratic-same\"></span>Real roots, same sign</div>\n <div><span class=\"quadratic-swatch quadratic-opposite\"></span>Real roots, opposite signs</div>\n</div>\n<p class=\"quadratic-note\">Discriminant isolines create the fine stripes. Automatic mode periodically switches between the 3D sphere and 2D map.</p>\n";document.body.append(panel);
 const modeSelect=panel.querySelector('#quadraticMode'),speedInput=panel.querySelector('#quadraticSpeed');
 const speedLabel=panel.querySelector('#quadraticSpeedLabel'),qualitySelect=panel.querySelector('#quadraticQuality');
 const playButton=panel.querySelector('#quadraticPlay');
 modeSelect.onchange=()=>{mode=Number(modeSelect.value);uniforms.uMode.value=mode};
 speedInput.oninput=()=>{speed=Number(speedInput.value);speedLabel.textContent=speed.toFixed(2)+' rad/s';uniforms.uRotationSpeed.value=speed};
 qualitySelect.onchange=()=>{quality=Number(qualitySelect.value);uniforms.uQuality.value=quality};
 playButton.onclick=()=>{playing=!playing;playButton.textContent=playing?'Pause motion':'Resume motion'};
 panel.querySelector('#quadraticReset').onclick=()=>{
  elapsed=0;playing=true;mode=0;speed=0.5;quality=2;modeSelect.value='0';speedInput.value='0.5';
  speedLabel.textContent='0.50 rad/s';qualitySelect.value='2';playButton.textContent='Pause motion';
  uniforms.uTime.value=0;uniforms.uMode.value=0;uniforms.uRotationSpeed.value=0.5;uniforms.uQuality.value=2;
 };
 function activate(){
  if(active)return;
  active=true;window.__quadraticRootsActive=true;previousStatus=status?.textContent||'';
  const editor=document.getElementById('tokenEditor');previousEditorVisible=!!editor&&!editor.hidden;
  if(editor)editor.hidden=true;
  const workspace=document.querySelector('.workspace-float');if(workspace)workspace.hidden=true;
  for(const id of ['backgroundPopup','surfacePopup']){const p=document.getElementById(id);if(p)p.hidden=true}
  controls.enabled=false;panel.hidden=false;button.setAttribute('aria-pressed','true');
  if(status)status.textContent='Quadratic roots · Switch between 3D and 2D in the floating card';
 }
 function deactivate(){
  if(!active)return;
  active=false;window.__quadraticRootsActive=false;controls.enabled=true;panel.hidden=true;
  button.setAttribute('aria-pressed','false');if(status)status.textContent=previousStatus;
  const editor=document.getElementById('tokenEditor');
  if(editor&&previousEditorVisible&&(!location.hash||location.hash==='#equations'))editor.hidden=false;
 }
 button.onclick=()=>active?deactivate():activate();
 panel.querySelector('#quadraticClose').onclick=deactivate;
 nav.addEventListener('click',event=>{if(event.target.closest('button[data-workspace]'))deactivate()},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active)deactivate()});
 const size=new THREE.Vector2();
 function render(dt){
  if(!active)return false;
  if(playing)elapsed+=dt;
  uniforms.uTime.value=elapsed;renderer.getDrawingBufferSize(size);
  uniforms.uResolution.value.set(Math.max(1,size.x),Math.max(1,size.y));
  renderer.render(scene,camera);return true;
 }
 return {render,activate,deactivate,get active(){return active},get mode(){return mode},get time(){return elapsed}};
}
