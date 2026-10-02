window.LKPD_EVENTS=(function(){
  const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
  function wireBS(root){$$(root+' .q-bs').forEach(b=>b.addEventListener('click',()=>{const i=b.dataset.i;$$(root+' .q-bs').forEach(x=>{if(x.dataset.i===i)x.classList.remove('sel','ring-4');});b.classList.add('sel','ring-4');if(window.updateBtn)updateBtn();}));}
  function wireInputs(root,cb){$$(root+' .q-ans').forEach(e=>e.addEventListener('input',()=>cb&&cb()));}
  function wireLock(btnId,prefix,onLock){$(btnId).onclick=()=>{const on=!$(btnId).dataset.on;$(btnId).dataset.on=on?'1':'';$$( 'input,select').forEach(el=>{if(el.id&&el.id.startsWith(prefix))el.disabled=!!on;});onLock&&onLock(!!on);};}
  return{wireBS,wireInputs,wireLock};
})();
