// Opt-in browser UI tests; runs only when ?smoke=1.
if(new URLSearchParams(location.search).get('smoke')==='1') (async()=>{
 const report=document.createElement('div');report.id='smokeReport';report.setAttribute('role','status');
 report.style.cssText='position:fixed;z-index:20000;top:65px;left:50%;transform:translateX(-50%);width:min(680px,95vw);max-height:70vh;overflow:auto;padding:16px 20px;background:#101927f5;border:2px solid #5aeebc;color:#f2ffee;border-radius:12px;font:15px/1.5 Consolas,monospace;white-space:pre-wrap;box-shadow:0 12px 30px #0009';
 report.textContent='Running live browser smoke tests...';document.body.append(report);
 const tests=[],delay=ms=>new Promise(r=>setTimeout(r,ms)),input=document.querySelector('#expr');
 const check=(name,pass,detail='')=>tests.push({name,pass:Boolean(pass),detail});
 const wait=async(selector)=>{for(let t=0;t<100;t++){const e=document.querySelector(selector);if(e)return e;await delay(100)}throw Error('Missing '+selector)};
 try{
  const editor=await wait('#tokenEditor'),expr=await wait('#tokenExpression');await delay(500);
  const canvas=document.querySelector('#view'),original=input.value;
  check('Editor visible',getComputedStyle(editor).display!=='none');
  check('3D canvas visible',canvas?.getBoundingClientRect().width>100&&canvas?.getBoundingClientRect().height>100);
  check('Edit / Type / Values cards',[...['#tokenEditCard','#tokenTypesCard','#tokenValuesCard']].every(s=>document.querySelector(s)));
  check('Top commands',document.querySelector('[aria-label="Undo"]')&&document.querySelector('[aria-label="Redo"]'));
  check('Bottom quickbar',document.querySelectorAll('#tokenQuickbar button').length>=9);
  check('Example equation',original==='2*sin(2*x^2+3*y)',original);
  const a=document.querySelector('#tokenEditCard')?.getBoundingClientRect(),b=document.querySelector('.token-center')?.getBoundingClientRect(),c=document.querySelector('#tokenTypesCard')?.getBoundingClientRect();
  check('Left-center-right positions',a&&b&&c&&a.left<b.left&&b.left<c.left);
  expr.querySelector('button.token-chip')?.click();
  check('Number wheel visible',document.querySelector('#tokenCenterWheelArea:not([hidden]) .token-wheel-value.selected'));
  const three=[...document.querySelectorAll('#tokenEditWheel button.token-wheel-value')].find(x=>x.textContent==='3');
  check('Wheel option 3 exists',three);
  three?.click();await delay(240);
  check('Wheel changes equation to 3',input.value.startsWith('3*sin('),input.value);
  check('Canvas remains visible',canvas?.getBoundingClientRect().width>100);
  document.querySelector('[aria-label="Undo"]')?.click();
  check('Undo restores equation',input.value===original,input.value);
  document.querySelector('[aria-label="Redo"]')?.click();
  check('Redo changes equation to 3',input.value.startsWith('3*sin('),input.value);
  document.querySelector('[aria-label="Undo"]')?.click();
  check('Second undo restores equation',input.value===original,input.value);
  for(const [kind,expected] of [['Operator','*'],['Variable','x'],['Decimal','0.5'],['Function','sin'],['Constant','pi'],['Grouping','('],['Exponent','^2'],['Integer','2']]){
   const button=[...document.querySelectorAll('#tokenTypes button')].find(x=>x.textContent.includes(kind));
   button?.click();
   const opts=[...document.querySelectorAll('#tokenChoices button')].map(x=>x.textContent);
   check(kind+' palette',opts.includes(expected),opts.slice(0,4).join(','));
  }
  check('Palette selection preserves equation',input.value===original,input.value);
 }catch(err){check('Uncaught test error',false,String(err.stack||err))}
 const passed=tests.filter(x=>x.pass).length;
 report.dataset.passed=String(passed);report.dataset.total=String(tests.length);
 report.textContent='LIVE BROWSER TEST: '+passed+'/'+tests.length+' PASS\n\n'+tests.map(x=>(x.pass?'PASS':'FAIL')+'  '+x.name+(x.detail?' ['+x.detail+']':'')).join('\n');
 report.style.borderColor=passed===tests.length?'#5aeebc':'#ff607b';
})();


/* Interactive GPU regression test: enable with ?smoke=quadratic */
if(new URLSearchParams(location.search).get('smoke')==='quadratic') (async()=>{
  const report=document.createElement('div');report.id='quadraticSmokeReport';
  report.setAttribute('role','status');
  report.style.cssText='position:fixed;z-index:20000;left:16px;bottom:16px;width:min(470px,90vw);max-height:60vh;overflow:auto;padding:13px;background:#131a2bed;border:2px solid #63f3b6;border-radius:10px;color:#f6fff9;font:13px/1.55 Consolas,monospace;white-space:pre-wrap;box-shadow:0 14px 35px #000b';
  report.textContent='Checking quadratic shader...';document.body.append(report);
  const results=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const test=(name,pass,detail='')=>results.push({name,pass:!!pass,detail});
  async function waitFor(selector){for(let n=0;n<80;n++){const element=document.querySelector(selector);if(element)return element;await sleep(125)}throw Error('Missing '+selector)}
  try{
    const toggle=await waitFor('#quadraticRootsToggle');
    const panel=await waitFor('#quadraticRootsPanel');
    const canvas=await waitFor('#view');
    await sleep(450);
    test('Quadratic Roots tab available',toggle.textContent.includes('Quadratic Roots'));
    const originalWidth=canvas.getBoundingClientRect().width;
    toggle.click();await sleep(700);
    test('Shader mode activated',toggle.getAttribute('aria-pressed')==='true');
    test('Floating controls appear',!panel.hidden);
    test('Canvas remains full-size',canvas.getBoundingClientRect().width===originalWidth&&originalWidth>100);
    const sphere=canvas.toDataURL('image/png');
    const mode=panel.querySelector('#quadraticMode');
    mode.value='2';mode.dispatchEvent(new Event('change',{bubbles:true}));await sleep(650);
    const flat=canvas.toDataURL('image/png');
    test('2D map selectable',mode.value==='2');
    test('3D and 2D GPU frames differ',sphere!==flat,'3D PNG '+sphere.length+' bytes, map PNG '+flat.length+' bytes');
    const quality=panel.querySelector('#quadraticQuality');
    quality.value='1';quality.dispatchEvent(new Event('change',{bubbles:true}));
    test('Fast antialiasing selectable',quality.value==='1');
    const speed=panel.querySelector('#quadraticSpeed');
    speed.value='1.25';speed.dispatchEvent(new Event('input',{bubbles:true}));
    test('Rotation slider updates',panel.querySelector('#quadraticSpeedLabel').textContent.includes('1.25'));
    const pause=panel.querySelector('#quadraticPlay');
    pause.click();test('Animation pauses',pause.textContent.includes('Resume'));
    panel.querySelector('#quadraticReset').click();
    test('Reset restores defaults',mode.value==='0'&&speed.value==='0.5'&&quality.value==='2'&&pause.textContent.includes('Pause'));
    panel.querySelector('#quadraticClose').click();await sleep(350);
    test('Back to normal surface',toggle.getAttribute('aria-pressed')==='false'&&panel.hidden);
    const editor=await waitFor('#tokenEditor');
    test('Equation editor restored',!editor.hidden);
    const input=document.querySelector('#expr'),before=input.value;
    const tokenWrap=editor.querySelector('.token-chip-wrap');
    const deleteButton=tokenWrap?.querySelector('.token-chip-delete');
    test('Token hover-delete button exists',Boolean(deleteButton)&&deleteButton.getAttribute('aria-label')?.startsWith('Delete '));
    deleteButton?.click();
    test('Delete changes equation',input.value!==before,'Before '+before+' after '+input.value);
    document.querySelector('[aria-label="Undo"]')?.click();
    test('Undo restores deleted token',input.value===before,input.value);
  }catch(error){test('Uncaught smoke test error',false,String(error.stack||error))}
  const success=results.filter(x=>x.pass).length;
  report.textContent='QUADRATIC BROWSER TEST: '+success+'/'+results.length+' PASS\n'+results.map(x=>(x.pass?'PASS':'FAIL')+' '+x.name+(x.detail?' ['+x.detail+']':'')).join('\n');
  report.dataset.passed=String(success);report.dataset.total=String(results.length);
  report.style.borderColor=success===results.length?'#63f3b6':'#ff607b';
})();
