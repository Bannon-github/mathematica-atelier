import {parse as parseMath, compile as compileMath} from 'https://esm.sh/mathjs@14.0.1';

const equationInput = document.getElementById('expr');
const workspaceNav = document.getElementById('workspaceNav');
if (!equationInput || !workspaceNav) throw new Error('Equation editor: missing expression input or navigation');

const catalog = {
  Integer: ['-10','-9','-8','-7','-6','-5','-4','-3','-2','-1','0','1','2','3','4','5','6','7','8','9','10'],
  Decimal: ['-3.5','-2.5','-1.5','-0.5','0.1','0.25','0.5','0.75','1.25','1.5','2.5','3.14'],
  Variable: ['x','y','z','t','A','f','g','a','b','c','u','v','w','theta','alpha','beta'],
  Exponent: ['^2','^3','^4','^0.5','^(-1)','^(-2)','^n'],
  Operator: ['+','-','*','/','^','%'],
  Function: ['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','sqrt','cbrt','abs','exp','log','log10','log2','floor','ceil','round','sign','min','max','pow','hypot'],
  Constant: ['pi','e'],
  Grouping: ['(...)','(',')',',']
};
const functionNames = new Set(catalog.Function);
const constantNames = new Set(catalog.Constant);
const numberPattern = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const specialImplicit = /^\s*x\s*\^\s*2\s*-\s*y\s*\^\s*2\s*\+\s*z\s*\^\s*2\s*\+\s*1\s*=\s*0\s*$/;

const editor = document.createElement('section');
editor.id = 'tokenEditor';
editor.className = 'token-editor';
editor.hidden = true;
editor.setAttribute('role','dialog');
editor.setAttribute('aria-modal','false');
editor.setAttribute('aria-label','Interactive equation token editor');
editor.innerHTML = [
 '<div class="token-stage">',
 '<section class="token-card token-edit-card" id="tokenEditCard" aria-label="Edit selected equation element">',
 ' <div class="token-card-title"><strong>Edit Token</strong><button type="button" id="tokenClose" aria-label="Close editor">×</button></div>',
 ' <label for="tokenKindSelect">Type</label><select id="tokenKindSelect" aria-label="Selected element type"></select>',
 ' <label for="tokenCustom">Value</label><div class="token-edit-wheel" id="tokenEditWheel"></div>',
 ' <div class="token-custom-row"><input id="tokenCustom" spellcheck="false" aria-label="Element value"><button type="button" id="tokenApply">Apply</button></div>',
 ' <div class="token-actions"><button type="button" id="tokenInsert">Insert after</button><button type="button" id="tokenWrap">Wrap ( )</button><button type="button" id="tokenDelete">Delete</button></div>',
 ' <p class="token-edit-hint">Select a symbol above, then choose a value or type.</p>',
 '</section>',
 '<div class="token-center" aria-label="Live equation and value controls">',
 ' <div id="tokenExpression" class="token-expression" aria-label="Click an element to edit"></div>',
 ' <div id="tokenCenterWheelArea" class="token-center-wheel-area"><div class="token-center-arrow">▽</div><div id="tokenCenterWheel" class="token-center-wheel"></div></div>',
 '</div>',
 '<div class="token-right">',
 ' <section class="token-card token-types-card" id="tokenTypesCard"><div class="token-card-title"><strong>Token Type</strong><button type="button" id="tokenTypesClose" aria-label="Hide token types">×</button></div><div class="token-types" id="tokenTypes"></div></section>',
 ' <section class="token-card token-values-card" id="tokenValuesCard"><div class="token-card-title"><strong>Token Values</strong><button type="button" id="tokenValuesClose" aria-label="Hide token values">×</button></div><div id="tokenValueTabs" class="token-value-tabs"></div><h3 id="tokenPaletteHeading">Available values</h3><div id="tokenChoices" class="token-choices"></div>',
 ' <div id="tokenWheelArea" class="token-wheel-area"><div id="tokenWheel" class="token-wheel" tabindex="0" aria-label="Scroll or click to adjust number"></div></div></section>',
 '</div>',
 '</div>',
 '<div class="token-bottomtoolbar" id="tokenQuickbar" aria-label="Equation editing tools"></div>',
 '<div id="tokenStatus" class="token-status" role="status" aria-live="polite">Select an equation element to edit it.</div>',
 '<input type="file" id="tokenFile" accept=".txt,.math,.json" hidden>',
 '<button id="tokenSave" type="button" hidden>Save to history</button>'
].join('');
document.body.append(editor);

const expressionRow = editor.querySelector('#tokenExpression');
const typesHost = editor.querySelector('#tokenTypes');
const choicesHost = editor.querySelector('#tokenChoices');
const wheelArea = editor.querySelector('#tokenWheelArea');
const wheel = editor.querySelector('#tokenWheel');
const leftWheel = editor.querySelector('#tokenEditWheel');
const centerWheel = editor.querySelector('#tokenCenterWheel');
const centerWheelArea = editor.querySelector('#tokenCenterWheelArea');
const kindSelect = editor.querySelector('#tokenKindSelect');
const quickbar = editor.querySelector('#tokenQuickbar');
const typeTabs = editor.querySelector('#tokenValueTabs');
const typeCard = editor.querySelector('#tokenTypesCard');
const valueCard = editor.querySelector('#tokenValuesCard');
const editCard = editor.querySelector('#tokenEditCard');
const typeGlyphs = {Integer:'#',Decimal:'·',Variable:'𝑥',Exponent:'xⁿ',Operator:'+',Function:'ƒ(x)',Constant:'α',Grouping:'( )'};
for(const type of Object.keys(catalog)){
 const o=document.createElement('option');o.value=type;o.textContent=type;kindSelect.append(o);
}
kindSelect.addEventListener('change',()=>{currentType=kindSelect.value;render()});
const custom = editor.querySelector('#tokenCustom');
const status = editor.querySelector('#tokenStatus');
const heading = editor.querySelector('#tokenPaletteHeading');
let tokens = [];
let selectedIndex = -1;
let currentType = 'Integer';

function scan(source) {
  const matches = [...source.matchAll(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z_0-9]*|[^\s]/g)];
  const list = matches.map(match => ({value:match[0],start:match.index,end:match.index+match[0].length}));
  for (let i=1;i<list.length;i++) {
    const token = list[i], prev = list[i-1], prevprev = list[i-2];
    const unary = prev.value==='-' && prev.end===token.start && numberPattern.test(token.value)
      && (i===1 || ['+','-','*','/','^','%','(',',','='].includes(prevprev.value));
    if (unary) {token.value='-'+token.value;token.start=prev.start;list.splice(i-1,1);i--}
  }
  return list;
}
function tokenType(value) {
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return /[.eE]/.test(value)?'Decimal':'Integer';
  if (value==='^') return 'Exponent';
  if (catalog.Operator.includes(value)) return 'Operator';
  if (functionNames.has(value)) return 'Function';
  if (constantNames.has(value)) return 'Constant';
  if (['(',')','[',']',','].includes(value)) return 'Grouping';
  return 'Variable';
}
function check(candidate) {
  try {
    if (candidate.includes('=') && !specialImplicit.test(candidate)) throw new Error('Only the supported hyperboloid implicit equation can use =');
    if (!specialImplicit.test(candidate)) {
      const tree = parseMath(candidate);
      compileMath(candidate);
      if (tree.type === 'AssignmentNode' || tree.type === 'FunctionAssignmentNode') throw new Error('Assignments are not surface expressions');
    }
    return '';
  } catch(error) {return error.message || 'Invalid mathematical expression'}
}
function replacementFor(option,type) {
  if (selectedIndex<0) return null;
  const token = tokens[selectedIndex];
  if (type==='Exponent') {
    const power = option.startsWith('^')?option.slice(1):option;
    const previous = tokens[selectedIndex-1];
    if (token.value==='^') {
      const next = tokens[selectedIndex+1];
      if (!next) return null;
      return {start:next.start,end:next.end,text:power,selection:next.start};
    }
    if (previous && previous.value==='^') return {start:token.start,end:token.end,text:power,selection:token.start};
    return {start:token.start,end:token.end,text:'('+token.value+')^'+power,selection:token.start};
  }
  if (type==='Grouping' && option==='(...)') return {start:token.start,end:token.end,text:'('+token.value+')',selection:token.start+1};
  if (type==='Function' && !functionNames.has(token.value)) {
    return {start:token.start,end:token.end,text:option+'('+token.value+')',selection:token.start};
  }
  return {start:token.start,end:token.end,text:option,selection:token.start};
}
function setStatus(text,error=false) { status.textContent=text; status.dataset.error=error?'true':'false'; }
function applyChange(change) {
  if (!change) return false;
  const original = equationInput.value;
  const value = original.slice(0,change.start)+change.text+original.slice(change.end);
  const problem = check(value);
  if (problem) {setStatus('Not applied: '+problem,true);return false}
  recordBeforeChange(original);
  internalChange=true;
  equationInput.value=value;
  equationInput.dispatchEvent(new Event('input',{bubbles:true}));
  internalChange=false;
  refresh(change.selection);
  setStatus('Equation updated and rendering.');
  return true;
}
function choose(value,type=currentType) {return applyChange(replacementFor(value,type))}
function select(index) {
  if (!tokens.length) {selectedIndex=-1;render();return}
  selectedIndex=Math.min(tokens.length-1,Math.max(0,index));
  currentType=tokenType(tokens[selectedIndex].value);
  render();
}
function refresh(cursor) {
  tokens=scan(equationInput.value);
  if (typeof cursor==='number') {
    const i=tokens.findIndex(t=>cursor>=t.start&&cursor<t.end);
    selectedIndex=i>=0?i:tokens.findIndex(t=>t.start>=cursor);
    if (selectedIndex<0 && tokens.length) selectedIndex=tokens.length-1;
  } else if (selectedIndex>=tokens.length) selectedIndex=tokens.length-1;
  render();
}
function render() {
  expressionRow.replaceChildren();
  for (let i=0;i<tokens.length;i++) {
    const token=tokens[i];
    const button=document.createElement('button');
    button.type='button';button.className='token-chip';
    button.textContent=token.value;
    button.title='Edit '+token.value;
    button.setAttribute('aria-pressed',String(i===selectedIndex));
    button.onclick=()=>select(i);
    expressionRow.append(button);
  }
  typesHost.replaceChildren();
  for (const type of Object.keys(catalog)) {
    const button=document.createElement('button');
    button.type='button';button.className='token-type';button.innerHTML='<span class="token-type-glyph">'+typeGlyphs[type]+'</span><span>'+type+'</span>';
    button.setAttribute('aria-pressed',String(type===currentType));
    button.onclick=()=>{currentType=type;render()};
    typesHost.append(button);
  }
  kindSelect.value=currentType;
  if (selectedIndex>=0 && tokens[selectedIndex]) custom.value=tokens[selectedIndex].value;
  else custom.value='';
  heading.textContent=currentType==='Exponent'?'Powers and exponents':currentType+' choices';
  renderChoices();
  renderWheel();
}
function renderChoices() {
  choicesHost.replaceChildren();
  const foundVariables = tokens.filter(t=>tokenType(t.value)==='Variable').map(t=>t.value);
  const available=currentType==='Variable'?[...new Set([...catalog.Variable,...foundVariables])]:catalog[currentType];
  for (const option of available) {
    const button=document.createElement('button');
    button.type='button';button.className='token-choice';button.textContent=option;
    const change=replacementFor(option,currentType);
    const possible=change && !check(equationInput.value.slice(0,change.start)+change.text+equationInput.value.slice(change.end));
    button.disabled=!possible;
    button.title=possible?'Use '+option:'Not valid at this position';
    button.onclick=()=>choose(option,currentType);
    choicesHost.append(button);
  }
}
function renderWheel() {
 const token=tokens[selectedIndex];
 const numeric=token && /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token.value);
 const enabled=numeric && (currentType==='Integer'||currentType==='Decimal'||currentType==='Exponent');
 wheelArea.hidden=!enabled;centerWheelArea.hidden=!enabled;
 for(const target of [wheel,leftWheel,centerWheel]){
  target.replaceChildren();
  if(!enabled){if(target===leftWheel)target.textContent='Select a number for the value wheel';continue}
  const value=Number(token.value),step=currentType==='Decimal'?0.1:1;
  const up=document.createElement('button');up.type='button';up.className='token-wheel-arrow';up.textContent='▲';up.setAttribute('aria-label','Increase value');up.onclick=()=>adjust(step);target.append(up);
  for(let offset=5;offset>=-5;offset--){
   const next=Number((value+offset*step).toFixed(8));
   const button=document.createElement('button');button.type='button';button.textContent=String(next);button.className='token-wheel-value';
   if(offset===0){button.classList.add('selected');button.setAttribute('aria-current','true')}
   button.onclick=()=>choose(String(next),'Integer');
   target.append(button);
  }
  const down=document.createElement('button');down.type='button';down.className='token-wheel-arrow';down.textContent='▼';down.setAttribute('aria-label','Decrease value');down.onclick=()=>adjust(-step);target.append(down);
 }
 requestAnimationFrame(()=>{
  const selected=expressionRow.querySelector('[aria-pressed="true"]');
  if(!selected||centerWheelArea.hidden)return;
  const wrapper=editor.querySelector('.token-center').getBoundingClientRect(),r=selected.getBoundingClientRect();
  centerWheelArea.style.left=Math.max(40,Math.min(wrapper.width-40,r.left+r.width/2-wrapper.left))+'px';
 });
}
function adjust(amount) {
  const token=tokens[selectedIndex];
  if (!token) return;
  const value=Number(token.value);
  if (!Number.isFinite(value)) return;
  const next=String(Number((value+amount).toFixed(8)));
  applyChange({start:token.start,end:token.end,text:next,selection:token.start});
}
for(const target of [wheel,leftWheel,centerWheel]){
 target.addEventListener('wheel',event=>{
  if(!tokens[selectedIndex]||!Number.isFinite(Number(tokens[selectedIndex].value)))return;
  event.preventDefault();adjust((event.deltaY<0?1:-1)*(currentType==='Decimal'?0.1:1));
 },{passive:false});
 target.addEventListener('keydown',event=>{
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();adjust((event.key==='ArrowUp'?1:-1)*(currentType==='Decimal'?0.1:1))}
 });
}
editor.querySelector('#tokenApply').onclick=()=>{
  if (selectedIndex<0) return;
  const value=custom.value.trim();
  if (!value) {setStatus('Enter a value.',true);return}
  const type=currentType==='Function'&&functionNames.has(value)?'Function':currentType==='Exponent'&&value.startsWith('^')?'Exponent':tokenType(value);
  choose(value,type);
};
custom.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();editor.querySelector('#tokenApply').click()}});
editor.querySelector('#tokenInsert').onclick=()=>{
  const token=tokens[selectedIndex];if(!token)return;
  const value=custom.value.trim();
  if (!value) {setStatus('Enter an element to insert.',true);return}
  applyChange({start:token.end,end:token.end,text:value,selection:token.end});
};
editor.querySelector('#tokenWrap').onclick=()=>{
  const token=tokens[selectedIndex];if(!token)return;
  applyChange({start:token.start,end:token.end,text:'('+token.value+')',selection:token.start+1});
};
editor.querySelector('#tokenDelete').onclick=()=>{
  const token=tokens[selectedIndex];if(!token)return;
  applyChange({start:token.start,end:token.end,text:'',selection:token.start});
};
editor.querySelector('#tokenSave').onclick=()=>{document.getElementById('apply')?.click();setStatus('Expression saved to history.')};
editor.querySelector('#tokenClose').onclick=()=>editor.hidden=true;
function showEditor() {editor.hidden=false;refresh();if(selectedIndex<0&&tokens.length)select(0)}
const openButton=document.createElement('button');
openButton.type='button';openButton.className='token-launch';openButton.textContent='Edit equation elements';
openButton.title='Open the interactive equation editor';
openButton.onclick=()=>{showEditor();document.querySelector('.workspace-float')?.setAttribute('hidden','')};
const equationsTab=workspaceNav.querySelector('[data-workspace="equations"]');
if(equationsTab) equationsTab.insertAdjacentElement('afterend',openButton);
const applyButton=document.getElementById('apply');
if(applyButton) {
  const sideButton=openButton.cloneNode(true);sideButton.id='openTokenEditor';sideButton.onclick=openButton.onclick;
  applyButton.insertAdjacentElement('afterend',sideButton);
}
workspaceNav.addEventListener('click',event=>{
  const button=event.target.closest('[data-workspace]');
  if (!button) return;
  if (button.dataset.workspace==='equations') {
    setTimeout(()=>{showEditor();document.querySelector('.workspace-float')?.setAttribute('hidden','')},0);
  } else editor.hidden=true;
});
equationInput.addEventListener('input',()=>refresh());
equationInput.addEventListener('dblclick',()=>{
  showEditor();
  const caret=equationInput.selectionStart||0;
  const index=tokens.findIndex(t=>caret>=t.start&&caret<=t.end);
  if (index>=0) select(index);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')editor.hidden=true});

/* Mockup controls: compact command bar, palette shortcuts and editor card toggles. */
const undoStack=[],redoStack=[];
let internalChange=false;
const oldApplyChange=applyChange;
function recordBeforeChange(before){if(undoStack.at(-1)!==before){undoStack.push(before);if(undoStack.length>80)undoStack.shift()}redoStack.length=0}
function changeEquation(value){
 const error=check(value);if(error){setStatus('Not applied: '+error,true);return false}
 const before=equationInput.value;if(before===value)return true;
 recordBeforeChange(before);internalChange=true;equationInput.value=value;equationInput.dispatchEvent(new Event('input',{bubbles:true}));internalChange=false;refresh(0);setStatus('Equation updated and rendering.');return true
}
function undo(){if(!undoStack.length){setStatus('Nothing to undo.');return}const previous=undoStack.pop();redoStack.push(equationInput.value);internalChange=true;equationInput.value=previous;equationInput.dispatchEvent(new Event('input',{bubbles:true}));internalChange=false;refresh(0);setStatus('Undo applied.')}
function redo(){if(!redoStack.length){setStatus('Nothing to redo.');return}const next=redoStack.pop();undoStack.push(equationInput.value);internalChange=true;equationInput.value=next;equationInput.dispatchEvent(new Event('input',{bubbles:true}));internalChange=false;refresh(0);setStatus('Redo applied.')}
function saveEquation(){
 document.getElementById('apply')?.click();
 const link=document.createElement('a');const blob=new Blob([equationInput.value+'\n'],{type:'text/plain;charset=utf-8'});
 const url=URL.createObjectURL(blob);link.href=url;link.download='mathematica-equation.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
 setStatus('Equation saved.');
}
function addCommand(buttonClass,label,title,action,parent){
 const b=document.createElement('button');b.type='button';b.className=buttonClass;b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onclick=action;parent.append(b);return b
}
const toolbar=document.createElement('div');toolbar.className='token-commandbar';toolbar.setAttribute('aria-label','Equation commands');workspaceNav.append(toolbar);
addCommand('token-command','↶','Undo',undo,toolbar);
addCommand('token-command','↷','Redo',redo,toolbar);
addCommand('token-command','▱','Open equation file',()=>editor.querySelector('#tokenFile').click(),toolbar);
addCommand('token-command','▣','Save equation as text',saveEquation,toolbar);
addCommand('token-command','⚙','Appearance settings',()=>workspaceNav.querySelector('[data-workspace="appearance"]')?.click(),toolbar);
addCommand('token-command','?','Equation editor help',()=>setStatus('Select a symbol, choose valid replacements, or use the number wheel. Type a custom expression and press Apply. Use Undo/Redo to revert.'),toolbar);
editor.querySelector('#tokenFile').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 const content=(await file.text()).trim();
 if(content)changeEquation(content);e.target.value='';
});
const toolNames=[['⌨','Keyboard',()=>{showEditor();const next=prompt('Enter a mathematical expression',equationInput.value);if(next!==null)changeEquation(next)}],
 ...Object.keys(catalog).map(type=>[typeGlyphs[type],type==='Grouping'?'Grouping':type,()=>{
  showEditor();currentType=type;typeCard.hidden=false;valueCard.hidden=false;render()
 }])];
for(const [glyph,label,action] of toolNames){const b=addCommand('token-quickaction',glyph+'  '+label,label,action,quickbar);b.dataset.kind=label}
const valueTabTypes=['Integer','Decimal','Operator','Variable','Exponent','Function','Constant','Grouping'];
for(const type of valueTabTypes) addCommand('token-value-tab',type==='Integer'?'Integers':type==='Decimal'?'Decimals':type==='Operator'?'Operators':type==='Variable'?'Variables':type, 'Show '+type.toLowerCase()+' options',()=>{
 currentType=type;valueCard.hidden=false;render()
},typeTabs);
editor.querySelector('#tokenTypesClose').onclick=()=>typeCard.hidden=true;
editor.querySelector('#tokenValuesClose').onclick=()=>valueCard.hidden=true;
editor.querySelector('#tokenClose').onclick=()=>editor.hidden=true;
window.addEventListener('resize',()=>renderWheel());
workspaceNav.addEventListener('click',e=>{if(e.target.closest('[data-workspace]'))toolbar.hidden=e.target.closest('[data-workspace]').dataset.workspace!=='equations'});
toolbar.hidden=Boolean(location.hash&&location.hash!=='#equations');
refresh();
if (!location.hash || location.hash==='#equations') showEditor();
