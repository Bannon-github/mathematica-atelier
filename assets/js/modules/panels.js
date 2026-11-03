
(function(){
 const panels=document.querySelectorAll('main > aside');
 for(const aside of panels){
  const children=Array.from(aside.children);let current=null,body=null;
  for(const child of children){
   if(child.tagName==='H3'){
    const heading=child.textContent.trim();
    current=document.createElement('details');current.className='settings-panel';
    current.dataset.panel=heading.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    if(['Equation Library','Expression'].includes(heading))current.open=true;
    const summary=document.createElement('summary');summary.textContent=heading;
    body=document.createElement('div');body.className='settings-panel-content';
    current.append(summary,body);aside.insertBefore(current,child);
    child.remove();
   }else if(body){body.append(child)}
  }
 }
})();
