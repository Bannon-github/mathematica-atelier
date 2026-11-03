const pages = {
 equations: {title:'Equations',description:'Find, enter and decompose mathematical surfaces.',sections:['equation-library','history','expression','expression-components']},
 appearance: {title:'Appearance',description:'Tune geometry, colour wheels and atmosphere.',sections:['two-sheet-hyperboloid','colour-wheels','colour-atmosphere']},
 motion: {title:'Motion',description:'Control automated changes, time and parameter limits.',sections:['time-automation']},
 audio: {title:'Audio Studio',description:'Mix waveforms and map mathematical measurements to sound.',sections:['mathematical-audio-studio']}
};
const nav=document.getElementById('workspaceNav');
const controlAside=document.querySelector('main > aside:last-child');
const libraryAside=document.querySelector('main > aside:first-child');
const panels=[...document.querySelectorAll('main > aside .settings-panel')];
// Library panels originally live in a separate sidebar; move them into the common workspace host.
for(const panel of libraryAside.querySelectorAll('.settings-panel'))controlAside.append(panel);
// Nested hyperboloid controls remain in Expression so the renderer can keep using its IDs.
const hyperboloid=document.getElementById('implicitControls');
if(hyperboloid){const panel=document.createElement('details');panel.className='settings-panel';panel.dataset.panel='two-sheet-hyperboloid';panel.open=true;const summary=document.createElement('summary');summary.textContent='Two-sheet hyperboloid';const body=document.createElement('div');body.className='settings-panel-content';body.append(hyperboloid);panel.append(summary,body);controlAside.append(panel);}
const heading=document.createElement('h2');heading.className='workspace-title';
const intro=document.createElement('p');intro.className='workspace-intro';
controlAside.prepend(intro);controlAside.prepend(heading);
for(const [id,page] of Object.entries(pages)){
 const button=document.createElement('button');button.type='button';button.textContent=page.title;button.dataset.workspace=id;button.addEventListener('click',()=>openWorkspace(id));nav.append(button);
}
function openWorkspace(id){
 if(!pages[id])id='equations';
 const page=pages[id];heading.textContent=page.title;intro.textContent=page.description;
 for(const panel of controlAside.querySelectorAll('.settings-panel'))panel.hidden=!page.sections.includes(panel.dataset.panel);
 for(const button of nav.querySelectorAll('button')){const selected=button.dataset.workspace===id;button.setAttribute('aria-current',selected?'page':'false');button.setAttribute('aria-pressed',String(selected));}
 try{history.replaceState(null,'','#'+id)}catch{}
 try{localStorage.setItem('atelierWorkspace',id)}catch{}
}
const initial=location.hash.slice(1)||localStorage.getItem('atelierWorkspace')||'equations';
openWorkspace(initial);
window.addEventListener('hashchange',()=>openWorkspace(location.hash.slice(1)));
