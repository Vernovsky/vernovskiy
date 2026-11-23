(function(){
  var PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5L8 5.5Z" fill="currentColor"/></svg>';
  var PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
  function bind(){
    var b=document.getElementById('glass-audio-control'); if(!b||b.dataset.bound) return; b.dataset.bound='1';
    function paint(){var s=window.VSAudio&&window.VSAudio.state?window.VSAudio.state():{on:false,paused:true};var on=!!(s.on&&!s.paused);b.setAttribute('aria-label',on?'Выключить музыку':'Включить музыку');b.innerHTML='<span class="glass-audio-play">'+(on?PAUSE:PLAY)+'</span>';b.classList.toggle('is-playing',on);var p=document.querySelector('.hx-player');if(p)p.classList.toggle('is-playing',on);}
    b.addEventListener('click',function(){if(window.VSAudio)window.VSAudio.toggle();setTimeout(paint,80);});
    document.addEventListener('click',function(e){if(e.target.closest('#ambient-toggle'))setTimeout(paint,80);});
    var vol=document.getElementById('hx-volume');
    if(vol){var st=window.VSAudio&&window.VSAudio.state?window.VSAudio.state():null;if(st&&typeof st.volume==='number')vol.value=st.volume;
      var fill=function(){vol.style.setProperty('--v',(vol.value*100)+'%');};fill();
      vol.addEventListener('input',function(){if(window.VSAudio)window.VSAudio.setVolume(vol.value);fill();});}
    function restart(){var a=window.VSAudio&&window.VSAudio.el;if(a){try{a.currentTime=0;}catch(e){}}}
    var pv=document.getElementById('hx-prev'),nx=document.getElementById('hx-next');
    if(pv)pv.addEventListener('click',restart);if(nx)nx.addEventListener('click',restart);
    var total=document.getElementById('hx-film-total');
    if(total&&Array.isArray(window.D)&&window.D.length)total.textContent=window.D.length+' '+(function(n){var m=n%100,d=n%10;return m>10&&m<15?'фильмов':d===1?'фильм':(d>1&&d<5)?'фильма':'фильмов';})(window.D.length);
    var t=document.getElementById('hx-temp');
    if(t&&window.fetch){try{fetch('https://api.open-meteo.com/v1/forecast?latitude=59.93&longitude=30.31&current=temperature_2m').then(function(r){return r.ok?r.json():null;}).then(function(j){var v=j&&j.current&&j.current.temperature_2m;if(typeof v==='number'){t.textContent=Math.round(v)+'°C';t.hidden=false;}}).catch(function(){});}catch(e){}}
    paint(); setInterval(paint,1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
