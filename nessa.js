(function(){
  'use strict';
  var root=document.getElementById('nessa-easter-egg');
  var trigger=document.getElementById('nessa-trigger');
  var stage=document.getElementById('nessa-stage');
  if(!root||!trigger||!stage)return;
  function setOpen(open){
    root.classList.toggle('is-open',open);
    trigger.setAttribute('aria-expanded',open?'true':'false');
    stage.setAttribute('aria-hidden',open?'false':'true');
  }
  trigger.addEventListener('click',function(e){e.stopPropagation();setOpen(!root.classList.contains('is-open'));});
  document.addEventListener('click',function(e){if(!root.contains(e.target))setOpen(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')setOpen(false);});
  root.addEventListener('mouseenter',function(){if(window.matchMedia('(hover:hover)').matches)setOpen(true);});
  root.addEventListener('mouseleave',function(){if(window.matchMedia('(hover:hover)').matches)setOpen(false);});
})();