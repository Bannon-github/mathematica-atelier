
import * as THREE from 'https://esm.sh/three@0.170.0';import {OrbitControls} from 'https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js';import {compile,parse as parseMath} from 'https://esm.sh/mathjs@14.0.1';
const presets={'Two-sheet hyperboloid':'x^2-y^2+z^2+1=0','Wave interference':'A*sin(f*x+t)*cos(g*y)','Radial ripples':'A*sin(f*sqrt(x*x+y*y)-t)','Saddle':'A*(x*x-y*y)/12','Gaussian bell':'A*exp(-(x*x+y*y)/f)','Twisted surface':'A*sin(f*x*y/8+t)','Hyperbolic paraboloid':'A*x*y/7','Sombrero':'A*sin(f*sqrt(x*x+y*y))/(sqrt(x*x+y*y)+0.1)','Moiré interference':'A*(sin(f*x+t)+cos(g*y-t))','Standing waves':'A*sin(f*x)*sin(g*y)*cos(t)'};let history=[];const $=id=>document.getElementById(id);let parameters={A:2,f:1.5,g:1.5};const reserved=new Set(['x','y','z','t','sin','cos','tan','sqrt','exp','log','abs','pi','e','pow','min','max']);let expression,colour,bg,implicitMode=false;let componentNodes=[],componentEnabled={};let renderer,scene,camera,controls,mesh,geometry,material;let time=0,last=performance.now(),audioCtx,gain,audioOn=false,audioOscillators=new Map(),audioPanner;
function makeCompiled(str){return compile(str)}
function buildComponents(){
 const tree=parseMath($('expr').value),nodes=[];
 function walk(node,sign=1){
  if(node.isOperatorNode&&node.fn==='add'){walk(node.args[0],sign);walk(node.args[1],sign)}
  else if(node.isOperatorNode&&node.fn==='subtract'){walk(node.args[0],sign);walk(node.args[1],-sign)}
  else nodes.push({node,sign,id:String(nodes.length)});
 }
 walk(tree);componentNodes=nodes;
 const host=$('components');host.replaceChildren();
 nodes.forEach(({node,sign,id})=>{
  if(!(id in componentEnabled))componentEnabled[id]=true;
  const line=document.createElement('label');line.style.cssText='display:flex;align-items:center;gap:8px;font-size:17px;overflow-wrap:anywhere';
  const cb=document.createElement('input');cb.type='checkbox';cb.style.width='auto';cb.checked=componentEnabled[id];
  cb.setAttribute('aria-label','Enable term '+(Number(id)+1)+': '+(sign<0?'-':'')+node.toString());
  cb.onchange=()=>{componentEnabled[id]=cb.checked;parse(false)};
  const span=document.createElement('span');span.textContent=(sign<0?'− ':'+ ')+node.toString();
  line.append(cb,span);host.append(line);
 });
}
function effectiveExpression(){
 if(!componentNodes.length)return $('expr').value;
 return componentNodes.filter(({id})=>componentEnabled[id]!==false).map(({node,sign})=>(sign<0?'-':'')+'('+node.toString()+')').join('+')||'0';
}
function expressionParameters(source){
 const found=new Set(),tree=parseMath(source);
 tree.traverse((node,path,parent)=>{
  if(!node.isSymbolNode)return;
  if(parent&&parent.isFunctionNode&&parent.fn===node)return;
  if(!reserved.has(node.name))found.add(node.name);
 });
 return [...found];
}



const automationRegistry=new Map();
const automationInitial=new Map();
let automationActive=true;
const selectedColours={upper:'#d7a0ee',lower:'#5dd2cf',surface:'#a77cf0',background:'#151225'};
const colourOverrides={upper:true,lower:true,surface:false,background:false};
function addColourWheel(key,title){
 const panel=document.createElement('div');panel.className='wheel-panel';
 const heading=document.createElement('label');heading.textContent=title;
 const toggle=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.checked=colourOverrides[key];check.style.width='auto';check.onchange=()=>{colourOverrides[key]=check.checked};toggle.append(check,document.createTextNode(' Use selected colour'));
 const canvas=document.createElement('canvas');canvas.width=220;canvas.height=220;
 const ctx=canvas.getContext('2d'),center=110,radius=98;
 const image=ctx.createImageData(220,220);
 for(let y=0;y<220;y++)for(let x=0;x<220;x++){
  const dx=x-center,dy=y-center,rad=Math.hypot(dx,dy),idx=(y*220+x)*4;
  if(rad>radius){image.data[idx+3]=0;continue}
  const hue=(Math.atan2(dy,dx)/(2*Math.PI)+1)%1;
  const col=new THREE.Color().setHSL(hue,Math.min(1,rad/radius),.5);
  image.data[idx]=Math.round(255*col.clone().convertLinearToSRGB().r);
  image.data[idx+1]=Math.round(255*col.clone().convertLinearToSRGB().g);
  image.data[idx+2]=Math.round(255*col.clone().convertLinearToSRGB().b);
  image.data[idx+3]=255;
 }
 ctx.putImageData(image,0,0);
 const row=document.createElement('div');row.className='colour-row';
 const picker=document.createElement('input');picker.type='color';picker.value=selectedColours[key];
 const hex=document.createElement('input');hex.type='text';hex.value=selectedColours[key];hex.setAttribute('aria-label',title+' hex colour');
 function set(hexValue){if(!/^#[0-9a-f]{6}$/i.test(hexValue))return;const currentHSL={h:0,s:0,l:0};new THREE.Color(hexValue).getHSL(currentHSL);hue=currentHSL.h;selectedColours[key]=hexValue;picker.value=hexValue;hex.value=hexValue;colourOverrides[key]=true;check.checked=true}
 picker.oninput=()=>set(picker.value);
 hex.onchange=()=>set(hex.value.trim());
 function choose(event){const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*220/rect.width-center,y=(event.clientY-rect.top)*220/rect.height-center;const d=Math.min(1,Math.hypot(x,y)/radius);const h=(Math.atan2(y,x)/(2*Math.PI)+1)%1;set('#'+new THREE.Color().setHSL(h,d,.5).getHexString())}
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);choose(e)});
 canvas.addEventListener('pointermove',e=>{if(e.buttons)choose(e)});
 row.append(picker,hex);panel.append(heading,toggle,canvas,row);$('colourWheels').append(panel);
 const hueColor=new THREE.Color(selectedColours[key]);const hsl={h:0,s:0,l:0};hueColor.getHSL(hsl);
 let hue=hsl.h;
 numericControl('colour:'+key,title+' hue',()=>hue,v=>{hue=((v%1)+1)%1;const color=new THREE.Color().setHSL(hue,.85,.55);set('#'+color.getHexString())},0,1,panel);

}
for(const [key,title] of [['upper','Upper sheet'],['lower','Lower sheet'],['surface','General surface'],['background','Background']])addColourWheel(key,title);

function positionEditor(panel,x,y){
 panel.hidden=false;
 const margin=12,width=Math.min(340,innerWidth-2*margin);
 panel.style.width=width+'px';
 panel.style.left=Math.max(margin,Math.min(x+14,innerWidth-width-margin))+'px';
 panel.style.top=Math.max(margin,Math.min(y+14,innerHeight-Math.min(panel.offsetHeight,innerHeight-2*margin)-margin))+'px';
}
function openSurfacePopup(x,y){const panel=document.getElementById('surfacePopup');if(panel)positionEditor(panel,x,y)}
function installSurfacePopup(){
 const wheel=[...document.querySelectorAll('#colourWheels .wheel-panel')].find(p=>p.querySelector('label')?.textContent==='General surface');
 if(!wheel)return;
 const panel=document.createElement('div');panel.id='surfacePopup';panel.className='background-popup surface-popup';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Surface colour settings');
 const bar=document.createElement('div');bar.className='background-popup-header';
 const title=document.createElement('strong');title.textContent='Surface colour';
 const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close surface settings');close.onclick=()=>panel.hidden=true;
 bar.append(title,close);panel.append(bar,wheel);
 const hue=$('hue');if(hue){const label=hue.previousElementSibling;if(label?.tagName==='LABEL')panel.append(label);panel.append(hue)}
 document.body.append(panel);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')panel.hidden=true});
}
function installBackgroundPopup(){
 const wheel=[...document.querySelectorAll('#colourWheels .wheel-panel')].find(p=>p.querySelector('label')?.textContent?.trim()==='Background');
 const input=$('bg');
 const panel=document.createElement('div');panel.id='backgroundPopup';panel.className='background-popup';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Background settings');
 const header=document.createElement('div');header.className='background-popup-header';
 const title=document.createElement('strong');title.textContent='Background colour';
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close background settings');close.onclick=()=>panel.hidden=true;
 header.append(title,close);panel.append(header);
 if(wheel)panel.append(wheel);
 if(input){const label=input.previousElementSibling;if(label?.tagName==='LABEL')panel.append(label);panel.append(input)}
 document.body.append(panel);
 // OrbitControls captures pointer events. Listen in the capture phase at document level.
 const canvas=$('view'),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 let down=null;
 document.addEventListener('pointerdown',e=>{
  if(e.target===canvas&&e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};else down=null;
 },true);
 document.addEventListener('pointerup',e=>{
  if(!down||e.pointerId!==down.id)return;
  const start=down;down=null;
  if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>7)return;
  const rect=canvas.getBoundingClientRect();
  if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
  pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const surfaces=[mesh,upperMesh,lowerMesh].filter(o=>o&&o.visible);
  const hit=raycaster.intersectObjects(surfaces,false).length>0;
  const other=document.getElementById('surfacePopup');
  if(hit){panel.hidden=true;openSurfacePopup(e.clientX,e.clientY)}
  else{if(other)other.hidden=true;positionEditor(panel,e.clientX,e.clientY)}
 },true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')panel.hidden=true});
}

function numericControl(key,label,get,set,min,max,host,precision=4){
 const config={key,label,get,set,min,max,enabled:false,rate:0.1,lower:min,upper:max,mode:'bounce',direction:1};
 automationRegistry.set(key,config);
 automationInitial.set(key,get());
 const details=document.createElement('details');details.className='automation';
 const summary=document.createElement('summary');summary.textContent='Time variance: '+label;
 const activeLabel=document.createElement('label');const active=document.createElement('input');
 active.type='checkbox';active.style.width='auto';config.controlCheckbox=active;active.onchange=()=>{config.enabled=active.checked;config.direction=1};
 activeLabel.append(active,document.createTextNode(' Enable automatic adjustment'));
 const grid=document.createElement('div');grid.className='automation-grid';
 function field(title,value,change){const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.type='number';input.step='any';input.value=String(value);input.onchange=()=>{if(Number.isFinite(input.valueAsNumber))change(input.valueAsNumber);input.value=String(title==='Rate / second'?config.rate:title==='Minimum'?config.lower:config.upper)};label.append(input);grid.append(label);return label}
 field('Rate / second',config.rate,v=>config.rate=Math.max(-100,Math.min(100,v)));
 field('Minimum',config.lower,v=>{config.lower=Math.max(min,Math.min(max,v));if(config.lower>config.upper)config.upper=config.lower});
 field('Maximum',config.upper,v=>{config.upper=Math.max(min,Math.min(max,v));if(config.upper<config.lower)config.lower=config.upper});
 const modeLabel=document.createElement('label');modeLabel.textContent='At limits';
 const mode=document.createElement('select');
 for(const [value,text] of [['bounce','Reverse direction'],['loop','Wrap to opposite limit'],['stop','Stop at limit']])mode.add(new Option(text,value));
 mode.onchange=()=>config.mode=mode.value;modeLabel.append(mode);
 details.append(summary,activeLabel,grid,modeLabel);host.append(details);
 return config;
}
function tickAutomation(dt){
 if(!automationActive||!$('automationPlay').checked)return;
 const elapsed=dt*Number($('automationSpeed').value);
 for(const c of automationRegistry.values()){
  if(!c.enabled||!c.rate||c.upper<=c.lower)continue;
  const lo=c.lower,hi=c.upper,span=hi-lo;
  let next=c.get()+c.rate*c.direction*elapsed;
  if(c.mode==='bounce'){
   let remaining=Math.abs(c.rate*elapsed);
   next=Math.max(lo,Math.min(hi,c.get()));
   let dir=Math.sign(c.rate)*c.direction||1;
   while(remaining>0){
    const available=dir>0?hi-next:next-lo;
    if(remaining<=available){next+=dir*remaining;remaining=0}
    else{next=dir>0?hi:lo;remaining-=available;dir=-dir}
    if(remaining>2*span)remaining%=2*span;
   }
   c.direction=dir*Math.sign(c.rate);
  }else if(c.mode==='loop'){
   if(next>hi)next=lo+((next-hi)%span);
   if(next<lo)next=hi-((lo-next)%span);
  }else if(next>=hi||next<=lo){next=Math.max(lo,Math.min(hi,next));c.enabled=false;const check=c.controlCheckbox;if(check)check.checked=false}
  c.set(Number(next.toFixed(6)));
 }
}
$('automationPause').onclick=()=>{automationActive=!automationActive;$('automationPause').textContent=automationActive?'Pause':'Resume'};
$('automationReset').onclick=()=>{for(const [key,c] of automationRegistry){c.set(automationInitial.get(key));c.direction=1}};

function attachPrecision(slider,callback){
 if(slider.dataset.precisionAttached)return;
 slider.dataset.precisionAttached='true';
 const wrap=document.createElement('div');wrap.className='precision-control';
 const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.title='Decrease';
 const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.title='Increase';
 const numeric=document.createElement('input');numeric.type='number';numeric.setAttribute('aria-label','Exact parameter value');
 const step=document.createElement('select');step.setAttribute('aria-label','Adjustment increment');
 for(const amount of ['1','0.1','0.01','0.001','0.0001'])step.add(new Option('±'+amount,amount));
 step.value='0.01';
 const min=Number(slider.min),max=Number(slider.max);
 slider.step='any';numeric.step='any';numeric.min=slider.min;numeric.max=slider.max;
 function setValue(value){if(!Number.isFinite(value))return;const bounded=Math.max(min,Math.min(max,value));const rounded=Number(bounded.toFixed(6));slider.value=String(rounded);numeric.value=String(rounded);slider.dispatchEvent(new Event('input',{bubbles:false}));if(callback)callback(rounded)}
 slider.addEventListener('input',()=>{numeric.value=String(Number(slider.value))});
 minus.onclick=()=>setValue(Number(numeric.value)-Number(step.value));
 plus.onclick=()=>setValue(Number(numeric.value)+Number(step.value));
 numeric.addEventListener('change',()=>setValue(Number(numeric.value)));
 numeric.value=String(Number(slider.value));
 wrap.append(minus,numeric,plus,step);
 slider.insertAdjacentElement('afterend',wrap);
 const key=slider.id||'parameter:'+slider.previousElementSibling?.textContent?.split(' = ')[0];
 const host=document.createElement('div');wrap.insertAdjacentElement('afterend',host);
 const config=numericControl(key,key,()=>Number(slider.value),v=>setValue(v),min,max,host);
 slider.addEventListener('input',()=>{if(!config.enabled)automationInitial.set(key,Number(slider.value))});

}
function parse(rebuild=true){
 try{
  implicitMode=/^\s*x\s*\^\s*2\s*-\s*y\s*\^\s*2\s*\+\s*z\s*\^\s*2\s*\+\s*1\s*=\s*0\s*$/.test($('expr').value);
  $('implicitControls').style.display=implicitMode?'block':'none';
  if(implicitMode){$('components').replaceChildren();$('params').replaceChildren();$('status').textContent='Two-sheet hyperboloid · Drag to orbit';return true}
  if(rebuild)buildComponents();
  expression=makeCompiled(effectiveExpression());colour=makeCompiled($('hue').value);bg=makeCompiled($('bg').value);
  const vars=expressionParameters($('expr').value);
  for(const v of vars)if(!(v in parameters))parameters[v]=1;
  for(const k of Object.keys(parameters))if(!vars.includes(k))delete parameters[k];
  const oldSettings=new Map();
  for(const [key,config] of automationRegistry)if(key.startsWith('parameter:'))oldSettings.set(key,{enabled:config.enabled,rate:config.rate,lower:config.lower,upper:config.upper,mode:config.mode,direction:config.direction});
  for(const key of oldSettings.keys()){automationRegistry.delete(key)}
  $('params').replaceChildren();
  for(const [k,v] of Object.entries(parameters)){
   const label=document.createElement('label');label.textContent=k+' = '+v.toFixed(2);
   const slider=document.createElement('input');slider.type='range';slider.min='-8';slider.max='8';slider.step='.05';slider.value=v;
   slider.setAttribute('aria-label','Parameter '+k);
   slider.oninput=()=>{parameters[k]=+slider.value;label.textContent=k+' = '+slider.value};
   $('params').append(label,slider);attachPrecision(slider);
   const config=automationRegistry.get('parameter:'+k),saved=oldSettings.get('parameter:'+k);
   if(config&&saved){Object.assign(config,saved);if(config.controlCheckbox)config.controlCheckbox.checked=saved.enabled}
  }
  $('status').textContent='Drag to orbit · Scroll to zoom';return true;
 }catch(e){$('status').textContent='Expression error: '+e.message;return false}
}
function select(s){$('expr').value=s;apply()}function apply(){if(!parse())return;history=[ $('expr').value,...history.filter(v=>v!==$('expr').value)].slice(0,30);localStorage.setItem('atelierHistory',JSON.stringify(history));drawHistory()}function drawHistory(){$('history').innerHTML='<option value="">Recent expressions</option>';history.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;$('history').append(o)})}function library(q=''){$('library').innerHTML='';for(const [name,eq] of Object.entries(presets)){if(!(name+' '+eq).toLowerCase().includes(q.toLowerCase()))continue;const b=document.createElement('button');b.textContent=name;b.onclick=()=>select(eq);$('library').append(b)}}
$('search').oninput=e=>library(e.target.value);$('history').onchange=e=>{if(e.target.value)select(e.target.value)};$('apply').onclick=apply;let editTimer;$('expr').addEventListener('input',()=>{clearTimeout(editTimer);editTimer=setTimeout(()=>parse(),180)});$('snapshot').onclick=()=>{renderer.render(scene,camera);const link=document.createElement('a');link.download='mathematica-atelier.png';link.href=renderer.domElement.toDataURL('image/png');link.click()};$('expr').onkeydown=e=>{if(e.key==='Enter')apply()};$('hue').onchange=parse;$('bg').onchange=parse;library();try{history=JSON.parse(localStorage.getItem('atelierHistory')||'[]')}catch{}drawHistory();
installSurfacePopup();installBackgroundPopup();
scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,200);camera.position.set(12,11,15);renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;controls=new OrbitControls(camera,$('view'));controls.enableDamping=true;scene.add(new THREE.HemisphereLight(0xe7dcff,0x1c1634,2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(6,12,7);scene.add(light);geometry=new THREE.PlaneGeometry(14,14,120,120);geometry.rotateX(-Math.PI/2);material=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,metalness:.25,roughness:.34,vertexColors:true});mesh=new THREE.Mesh(geometry,material);scene.add(mesh);const positions=geometry.attributes.position;const colors=new Float32Array(positions.count*3);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));const colorObj=new THREE.Color();const sheetMat1=new THREE.MeshStandardMaterial({color:0xe2a6ef,side:THREE.DoubleSide,roughness:.3,metalness:.15});const sheetMat2=new THREE.MeshStandardMaterial({color:0x65cdd8,side:THREE.DoubleSide,roughness:.3,metalness:.15});function makeSheet(sign,mat){const g=new THREE.BufferGeometry(),vertices=[],indices=[];const rings=65,segments=96,maxR=5;for(let j=0;j<=rings;j++){const radius=maxR*j/rings;for(let k=0;k<=segments;k++){const a=2*Math.PI*k/segments;vertices.push(radius*Math.cos(a),sign*Math.sqrt(1+Number($('curvature').value)*radius*radius),radius*Math.sin(a))}}for(let j=0;j<rings;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1)}g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return new THREE.Mesh(g,mat)}let upperMesh,lowerMesh;function rebuildSheets(){if(upperMesh){scene.remove(upperMesh);upperMesh.geometry.dispose();scene.remove(lowerMesh);lowerMesh.geometry.dispose()}upperMesh=makeSheet(1,sheetMat1);lowerMesh=makeSheet(-1,sheetMat2);scene.add(upperMesh,lowerMesh)}rebuildSheets();$('curvature').oninput=()=>{$('curvatureValue').textContent=Number($('curvature').value).toFixed(2);rebuildSheets()};for(const id of ['curvature','upperHue','lowerHue'])attachPrecision($(id));parse();
let lastWidth=0,lastHeight=0;function evalSafe(comp,scope,fallback){try{const v=comp.evaluate(scope);return typeof v==='number'&&Number.isFinite(v)?v:fallback}catch{return fallback}}function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;if($('animateTime').checked)time+=dt;tickAutomation(dt);mesh.visible=!implicitMode;upperMesh.visible=implicitMode&&$('upperSheet').checked;lowerMesh.visible=implicitMode&&$('lowerSheet').checked;if(colourOverrides.upper)sheetMat1.color.set(selectedColours.upper);else sheetMat1.color.setHSL(+$('upperHue').value,.72,.65);if(colourOverrides.lower)sheetMat2.color.set(selectedColours.lower);else sheetMat2.color.setHSL(+$('lowerHue').value,.72,.60);let avg=0, sumSq=0,minimum=Infinity,maximum=-Infinity,peak=0,slopeSum=0,centre=0,count=0;
if(!implicitMode)for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getZ(i),scope={...parameters,x,y,t:time};const z=Math.max(-12,Math.min(12,evalSafe(expression,scope,0)));positions.setY(i,z);avg+=z;sumSq+=z*z;minimum=Math.min(minimum,z);maximum=Math.max(maximum,z);peak=Math.max(peak,Math.abs(z));count++;
if(i===Math.floor(positions.count/2))centre=z;
if(i%121!==0){slopeSum+=Math.abs(z-positions.getY(i-1))}
const hue=((evalSafe(colour,{...scope,z},.7)%1)+1)%1;if(colourOverrides.surface)colorObj.set(selectedColours.surface);else colorObj.setHSL(hue,.75,.55);colors[i*3]=colorObj.r;colors[i*3+1]=colorObj.g;colors[i*3+2]=colorObj.b}if(implicitMode){
 const curvature=Number($('curvature').value);
 const upperVisible=$('upperSheet').checked,lowerVisible=$('lowerSheet').checked;
 for(let i=0;i<121;i++){const radius=5*i/120, height=Math.sqrt(1+curvature*radius*radius);
 for(const sign of [1,-1]){if((sign===1&&!upperVisible)||(sign===-1&&!lowerVisible))continue;
 const z=sign*height;avg+=z;sumSq+=z*z;minimum=Math.min(minimum,z);maximum=Math.max(maximum,z);peak=Math.max(peak,Math.abs(z));count++;
 if(i===0)centre=z;if(i>0)slopeSum+=Math.abs(height-Math.sqrt(1+curvature*Math.pow(5*(i-1)/120,2)));
 }}
}
if(!implicitMode){positions.needsUpdate=true;geometry.attributes.color.needsUpdate=true;geometry.computeVertexNormals();}const h=((evalSafe(bg,{...parameters,t:time,x:0,y:0,z:0},.7)%1)+1)%1;scene.background=colourOverrides.background?new THREE.Color(selectedColours.background):new THREE.Color().setHSL(h,.27,.09);if(audioOn&&audioCtx&&!count){gain.gain.setTargetAtTime(0,audioCtx.currentTime,.03);$('audioStatus').textContent='No visible surface samples · audio muted'}if(audioOn&&audioCtx&&count){
 const mean=avg/count;
 const metrics={mean,rms:Math.sqrt(sumSq/count),range:maximum-minimum,peak,variance:Math.max(0,sumSq/count-mean*mean),center:centre,slope:slopeSum/count,time};
 const value=metrics[$('audioMapping').value]||0;
 const sensitivity=Number($('audioSensitivity').value);
 const base=Number($('audioBase').value);
 const targetPitch=Math.max(30,Math.min(4000,base+value*sensitivity));
 const volume=Number($('audioVolume').value);
 const smoothing=Math.max(.01,Number($('audioSmooth').value));
 const output=$('audioOutput').value;
 for(const oscillator of audioOscillators.values())oscillator.frequency.setTargetAtTime(output==='pitch'||output==='both'?targetPitch:base,audioCtx.currentTime,smoothing);
 const dynamicVolume=volume*(0.1+0.9*Math.tanh(Math.abs(value)*Math.max(0,sensitivity)/120));
 gain.gain.setTargetAtTime((output==='volume'||output==='both'?dynamicVolume:volume),audioCtx.currentTime,smoothing);
 if(audioPanner)audioPanner.pan.setTargetAtTime(output==='stereo'?Math.tanh(value*sensitivity/300):0,audioCtx.currentTime,smoothing);
 $('audioStatus').textContent='Playing · '+$('audioMapping').selectedOptions[0].text+' = '+value.toFixed(4)+' · '+Math.round(targetPitch)+' Hz';
}const r=$('view').getBoundingClientRect();if(r.width&&r.height&&(r.width!==lastWidth||r.height!==lastHeight)){lastWidth=r.width;lastHeight=r.height;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}controls.update();renderer.render(scene,camera)}requestAnimationFrame(animate);
function syncAudioWaves(){
 if(!audioCtx)return;
 const selected=new Set([...document.querySelectorAll('#waveTypes input:checked')].map(e=>e.value));
 for(const [type,oscillator] of audioOscillators){if(!selected.has(type)){oscillator.stop();oscillator.disconnect();audioOscillators.delete(type)}}
 for(const type of selected){if(audioOscillators.has(type))continue;const oscillator=audioCtx.createOscillator();oscillator.type=type;oscillator.frequency.value=Number($('audioBase').value);oscillator.connect(gain);oscillator.start();audioOscillators.set(type,oscillator)}
 if(audioOn&&audioOscillators.size===0){gain.gain.setTargetAtTime(0,audioCtx.currentTime,.03);$('audioStatus').textContent='Select at least one waveform to hear sound.'}
}
for(const cb of document.querySelectorAll('#waveTypes input'))cb.addEventListener('change',syncAudioWaves);
$('audio').onclick=async()=>{
 try{
  if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();gain=audioCtx.createGain();gain.gain.value=0;
   if(typeof audioCtx.createStereoPanner==='function'){audioPanner=audioCtx.createStereoPanner();gain.connect(audioPanner).connect(audioCtx.destination)}
   else gain.connect(audioCtx.destination);
  }
  await audioCtx.resume();
  audioOn=!audioOn;
  syncAudioWaves();
  if(!audioOn){gain.gain.setTargetAtTime(0,audioCtx.currentTime,.03);$('audioStatus').textContent='Audio is off.'}
  $('audio').textContent=audioOn?'Mute mathematical audio':'Enable mathematical audio';
 }catch(e){$('audioStatus').textContent='Audio could not start: '+e.message}
};

