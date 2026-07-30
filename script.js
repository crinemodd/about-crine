// Clean, modular physics rewrite for letters and links

// Global error overlay to surface runtime errors on deployments (helps debug white screens)
(function installErrorOverlay(){
  function show(msg){
    try{
      const existing = document.getElementById('error-overlay');
      if(existing) existing.remove();
      const o = document.createElement('div');
      o.id = 'error-overlay';
      o.style.position = 'fixed'; o.style.inset = '12px'; o.style.padding = '18px'; o.style.zIndex = 20000;
      o.style.background = 'rgba(8,8,8,0.95)'; o.style.color = 'white'; o.style.border = '1px solid rgba(255,0,0,0.2)';
      o.style.fontFamily = 'monospace'; o.style.fontSize = '13px'; o.style.overflow = 'auto'; o.style.maxHeight = '80%';
      o.innerText = msg;
      document.body.appendChild(o);
    }catch(e){ console.error('Could not show error overlay', e); }
  }
  window.addEventListener('error', (ev)=>{
    const msg = (ev && ev.error && ev.error.stack) ? ev.error.stack : (ev && ev.message) || String(ev);
    console.error('Runtime error:', msg);
    try{ show(msg); }catch(e){}
  });
  window.addEventListener('unhandledrejection', (ev)=>{
    const msg = ev.reason && ev.reason.stack ? ev.reason.stack : String(ev.reason);
    console.error('Unhandled rejection:', msg);
    try{ show('Unhandled rejection: ' + msg); }catch(e){}
  });
})();

const NAME = 'Crine';
const links = [
  {url: 'https://github.com/crinemodd', title: 'GitHub'},
  {url: 'https://tryhackme.com/p/crinemodd', title: 'TryHackMe'},
  {url: 'https://www.reddit.com/user/crine_mod/', title: 'Reddit'},
  {url: 'https://www.youtube.com/@Crine-/featured', title: 'YouTube'}
];

// Tweakable physics constants
const SPRING_K_LETTER = 24; // spring strength to anchor
const DAMPING_LETTER = 0.92; // per-frame damping factor (applied relative to 60hz)
const CENTER_PULL_WHILE_DRAG = 0.0025; // small pull toward center only while dragging
const GRAVITY_PX_PER_S2 = 980; // visual gravity constant used for subtle downward pull

// create name letters
const nameEl = document.getElementById('name');
NAME.split('').forEach((ch, i) => {
  const span = document.createElement('span');
  span.className = 'letter';
  span.textContent = ch;
  nameEl.appendChild(span);
  setTimeout(() => span.classList.add('visible'), i * 150);
});

// particle system helper ----------------------------------------------------
function makeParticle(el, options = {}){
  return {
    el,
    // anchor (world coords)
    ax: 0, ay: 0,
    // position relative to anchor (px)
    x: 0, y: 0,
    vx: 0, vy: 0,
    dragging: false,
    pointerId: null,
    lastMouseX: 0, lastMouseY: 0, lastTime: 0,
    // click detection
    downX: 0, downY: 0, downTime: 0,
    // orbit params (for letters)
    r: options.r || 80,
    baseAngle: options.baseAngle || 0,
    speed: options.speed || 0.3,
    fixedAnchor: false,
    // visual rotation multiplier
    rotateMult: options.rotateMult || 0.02
  };
}

// render helpers
function renderLetter(p){
  p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.x * p.rotateMult}rad)`;
}
function renderSimple(p){
  p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
}

// Letters physics -----------------------------------------------------------
function enableLetterPhysics(){
  const letters = Array.from(document.querySelectorAll('.letter'));
  if(!letters.length) return;
  const state = letters.map((el,i)=> makeParticle(el, {
    r: 70 + i * 10,
    baseAngle: (i / letters.length) * Math.PI * 2,
    speed: 0.35 + (i%3)*0.02,
    rotateMult: 0.02
  }));

  function updateAnchors(now){
    const cx = innerWidth/2, cy = innerHeight/2;
    const t = now/1000;
    state.forEach(p => {
      if(!p.fixedAnchor){
        const ang = p.baseAngle + t * p.speed;
        p.ax = cx + Math.cos(ang) * p.r;
        p.ay = cy + Math.sin(ang) * p.r;
      }
      p.el.style.willChange = 'transform';
      p.el.style.touchAction = 'none';
    });
  }

  // pointer handlers
  state.forEach(p => {
    const el = p.el;
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      try{ document.body.style.userSelect = 'none'; }catch(e){}
      el.setPointerCapture(ev.pointerId);
      p.pointerId = ev.pointerId;
      p.dragging = true; el.classList.add('dragging');
      p.lastMouseX = ev.clientX; p.lastMouseY = ev.clientY; p.lastTime = performance.now();
      p.vx = 0; p.vy = 0;
      p.downX = ev.clientX; p.downY = ev.clientY; p.downTime = Date.now();
      // freeze anchor and set offset so element doesn't jump
      p.fixedAnchor = true;
      p.x = ev.clientX - p.ax;
      p.y = ev.clientY - p.ay;
      renderLetter(p);
    });

    el.addEventListener('pointermove', (ev)=>{
      if(!p.dragging || p.pointerId !== ev.pointerId) return;
      ev.preventDefault();
      const now = performance.now();
      const dt = Math.max(1, now - p.lastTime) / 1000;
      p.x = ev.clientX - p.ax;
      p.y = ev.clientY - p.ay;
      // velocity estimate
      p.vx = (ev.clientX - p.lastMouseX) / dt;
      p.vy = (ev.clientY - p.lastMouseY) / dt;
      p.lastMouseX = ev.clientX; p.lastMouseY = ev.clientY; p.lastTime = now;
      renderLetter(p);
    });

    el.addEventListener('pointerup', (ev)=>{
      if(p.pointerId !== ev.pointerId) return;
      try{ el.releasePointerCapture(ev.pointerId); }catch(e){}
      p.pointerId = null; p.dragging = false; el.classList.remove('dragging');
      try{ document.body.style.userSelect = ''; }catch(e){}
      // compute angle so orbit continues smoothly from current position
      const now = performance.now();
      const cx = innerWidth/2, cy = innerHeight/2;
      const px = p.ax + p.x, py = p.ay + p.y;
      const angle = Math.atan2(py - cy, px - cx);
      p.baseAngle = angle - (now/1000) * p.speed;
      p.fixedAnchor = false;
    });

    el.addEventListener('pointercancel', (ev)=>{
      if(p.pointerId !== ev.pointerId) return;
      try{ el.releasePointerCapture(ev.pointerId); }catch(e){}
      p.pointerId = null; p.dragging = false; el.classList.remove('dragging');
      try{ document.body.style.userSelect = ''; }catch(e){}
      p.fixedAnchor = false;
    });
  });

  // physics loop (semi-implicit Euler)
  let last = performance.now();
  function step(now){
    const dt = Math.min(0.032, (now - last) / 1000); last = now;
    updateAnchors(now);
    state.forEach(p => {
      // spring toward anchor
      const fx = -SPRING_K_LETTER * p.x;
      const fy = -SPRING_K_LETTER * p.y;
      p.vx += fx * dt;
      p.vy += fy * dt + GRAVITY_PX_PER_S2 * 0.0012 * dt;
      // center pull only while dragging
      if(p.dragging){
        const cx = innerWidth/2, cy = innerHeight/2;
        const px = p.ax + p.x, py = p.ay + p.y;
        const dx = cx - px, dy = cy - py;
        p.vx += dx * CENTER_PULL_WHILE_DRAG * dt * 60;
        p.vy += dy * CENTER_PULL_WHILE_DRAG * dt * 60;
      }
      // damping scaled to frame
      p.vx *= Math.pow(DAMPING_LETTER, dt * 60);
      p.vy *= Math.pow(DAMPING_LETTER, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // small rest clamp
      if(Math.abs(p.x) < 0.001 && Math.abs(p.y) < 0.001 && Math.abs(p.vx) < 0.01 && Math.abs(p.vy) < 0.01){
        p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
      }
      renderLetter(p);
    });
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

setTimeout(enableLetterPhysics, 350);

// Links physics (anchored to DOM position) ---------------------------------
function enablePhysicsForLinks(){
  const els = Array.from(document.querySelectorAll('.link'));
  if(!els.length) return;
  const state = els.map(el => makeParticle(el, {}));

  function updateAnchors(){
    state.forEach(p => {
      if(!p.fixedAnchor){
        const r = p.el.getBoundingClientRect();
        p.ax = r.left + r.width/2;
        p.ay = r.top + r.height/2;
      }
      p.el.style.willChange = 'transform';
      p.el.style.touchAction = 'none';
    });
  }
  updateAnchors(); window.addEventListener('resize', updateAnchors);

  state.forEach(p => {
    const el = p.el;
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      try{ document.body.style.userSelect = 'none'; }catch(e){}
      el.setPointerCapture(ev.pointerId);
      p.pointerId = ev.pointerId; p.dragging = true; el.classList.add('dragging');
      p.lastMouseX = ev.clientX; p.lastMouseY = ev.clientY; p.lastTime = performance.now(); p.vx = 0; p.vy = 0;
      p.downX = ev.clientX; p.downY = ev.clientY; p.downTime = Date.now();
      // freeze anchor and set offset to avoid jump
      p.fixedAnchor = true; p.x = ev.clientX - p.ax; p.y = ev.clientY - p.ay; renderSimple(p);
    });

    el.addEventListener('pointermove', (ev)=>{
      if(!p.dragging || p.pointerId !== ev.pointerId) return; ev.preventDefault();
      const now = performance.now(); const dt = Math.max(1, now - p.lastTime)/1000;
      p.x = ev.clientX - p.ax; p.y = ev.clientY - p.ay;
      p.vx = (ev.clientX - p.lastMouseX)/dt; p.vy = (ev.clientY - p.lastMouseY)/dt;
      p.lastMouseX = ev.clientX; p.lastMouseY = ev.clientY; p.lastTime = now; renderSimple(p);
    });

    el.addEventListener('pointerup', (ev)=>{
      if(p.pointerId !== ev.pointerId) return;
      try{ el.releasePointerCapture(ev.pointerId); }catch(e){}
      // detect click vs drag
      const dx = ev.clientX - (p.downX || ev.clientX);
      const dy = ev.clientY - (p.downY || ev.clientY);
      const dist2 = dx*dx + dy*dy;
      const dtMs = Date.now() - (p.downTime || Date.now());
      const CLICK_MOVE_SQ = 9; const CLICK_TIME_MS = 500;
      if(dist2 <= CLICK_MOVE_SQ && dtMs <= CLICK_TIME_MS){
        // follow link
        try{ const href = el.href; const target = el.target || '_self'; if(href){ if(target === '_blank') window.open(href, '_blank'); else window.location.href = href; } }catch(e){}
      }
      p.pointerId = null; p.dragging = false; el.classList.remove('dragging'); try{ document.body.style.userSelect = '';}catch(e){}
      // unfreeze anchor
      p.fixedAnchor = false;
    });

    el.addEventListener('pointercancel', (ev)=>{
      if(p.pointerId !== ev.pointerId) return;
      try{ el.releasePointerCapture(ev.pointerId); }catch(e){}
      p.pointerId = null; p.dragging = false; el.classList.remove('dragging'); try{ document.body.style.userSelect = '';}catch(e){}
      p.fixedAnchor = false;
    });
  });

  // physics loop for links
  let last = performance.now();
  function step(now){
    const dt = Math.min(0.032, (now - last)/1000); last = now;
    const k = 26, damping = 0.9;
    updateAnchors();
    state.forEach(p => {
      // skip physics while being dragged: pointermove directly sets position
      if(p.dragging) {
        // still allow center pull while dragging for subtle effect
        const cx = innerWidth/2, cy = innerHeight/2;
        const px = p.ax + p.x, py = p.ay + p.y; const dx = cx-px, dy = cy-py;
        p.vx += dx * CENTER_PULL_WHILE_DRAG * dt * 60; p.vy += dy * CENTER_PULL_WHILE_DRAG * dt * 60;
      } else {
        const fx = -k * p.x; const fy = -k * p.y;
        p.vx += fx * dt; p.vy += fy * dt + GRAVITY_PX_PER_S2 * 0.0008 * dt;
        p.vx *= Math.pow(damping, dt*60); p.vy *= Math.pow(damping, dt*60);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if(Math.abs(p.x) < 0.001 && Math.abs(p.y) < 0.001 && Math.abs(p.vx) < 0.01 && Math.abs(p.vy) < 0.01){ p.x=0; p.y=0; p.vx=0; p.vy=0 }
      }
      renderSimple(p);
    });
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

setTimeout(enablePhysicsForLinks, 450);

// link rendering and about button ------------------------------------------
const linksEl = document.getElementById('links');
function renderLinks(){
  linksEl.innerHTML = '';
  links.forEach(l => {
    const a = document.createElement('a');
    a.className = 'link'; a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';

    const icon = document.createElement('div'); icon.className = 'icon';
    const img = document.createElement('img');
    try{ const host = new URL(l.url).hostname; img.src = `https://www.google.com/s2/favicons?sz=64&domain=${host}` }catch(e){ img.src = '' }
    icon.appendChild(img);

    const label = document.createElement('div'); label.className = 'label'; label.textContent = l.title || l.url;
    a.appendChild(icon); a.appendChild(label); linksEl.appendChild(a);
  });
}
renderLinks();

function renderAboutButton(){
  const a = document.createElement('a'); a.className = 'link about'; a.href = 'about.html'; a.target = '_self';
  const icon = document.createElement('div'); icon.className = 'icon';
  icon.innerHTML = `\n    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>\n      <rect x="11" y="10" width="2" height="6" fill="rgba(255,255,255,0.9)"/>\n      <rect x="11" y="7" width="2" height="2" fill="rgba(255,255,255,0.9)"/>\n    </svg>`;
  const label = document.createElement('div'); label.className = 'label'; label.textContent = 'About';
  a.appendChild(icon); a.appendChild(label); linksEl.appendChild(a);
}
renderAboutButton();

// simple canvas background (unchanged behaviour) ---------------------------
const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
let w = canvas.width = innerWidth, h = canvas.height = innerHeight;
window.addEventListener('resize', ()=>{ w = canvas.width = innerWidth; h = canvas.height = innerHeight; });

const drops = [];
function initDrops(count = 130){ drops.length = 0; for(let i=0;i<count;i++){ drops.push({ x: Math.random()*w, y: Math.random()*h, vy: 4 + Math.random()*8, len: 10 + Math.random()*20, vx: -0.8 + Math.random()*1.6 }); } }
initDrops(Math.floor(w/10));

let flashAlpha = 0; let nextFlash = Date.now() + 8000 + Math.random() * 15000;
function draw(){
  ctx.clearRect(0,0,w,h);
  ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(180,200,255,0.18)';
  for(const d of drops){
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vy * 0.3, d.y + d.len); ctx.stroke();
    d.x += d.vx * 0.6 + Math.sin(d.y * 0.02) * 0.6; d.y += d.vy;
    if(d.y > h){ d.y = -20; d.x = Math.random() * w; }
  }
  if(Date.now() > nextFlash){ flashAlpha = 0.6 + Math.random() * 0.6; nextFlash = Date.now() + 8000 + Math.random() * 15000; }
  if(flashAlpha > 0.02){ const a = Math.min(1, flashAlpha * 0.8); ctx.fillStyle = `rgba(180,230,180,${a})`; ctx.fillRect(0,0,w,h); flashAlpha *= 0.88; }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// optional fog layers (unchanged) -----------------------------------------
(() => {
  const layerDefs = [ {id: 'fogLayer1', target: 0.27}, {id: 'fogLayer2', target: 0.21}, {id: 'fogLayer3', target: 0.15} ];
  const layers = layerDefs.map(d => { const el = document.getElementById(d.id); if(!el) return null; el.style.animation = 'none'; el.style.opacity = '0'; el.setAttribute('opacity','0'); return {el, target: d.target, done: false}; }).filter(Boolean);
  if(!layers.length) return;
  let last = performance.now(); const perMs = 0.00002;
  function step(now){ const dt = Math.max(0, now - last); last = now; const inc = dt * perMs; let any = false; for(const l of layers){ if(l.done) continue; any = true; let cur = parseFloat(l.el.style.opacity || l.el.getAttribute('opacity') || 0) || 0; cur += inc; if(cur >= l.target){ cur = l.target; l.done = true; } l.el.setAttribute('opacity', String(cur)); l.el.style.opacity = String(cur); } if(any) requestAnimationFrame(step); }
})();

// --- Dramatic explode sequence -------------------------------------------
// Adds a faint "E to explode" hint and triggers a sequence that tears the DOM
// and shows a particle explosion before attempting to close the page.
function installExplodeUI(){
  const hint = document.createElement('div');
  hint.id = 'explode-hint';
  hint.textContent = 'E to explode';
  document.body.appendChild(hint);

  function trigger(){
    // remove hint to avoid retriggering
    if(hint.parentNode) hint.parentNode.removeChild(hint);
    runExplodeSequence();
  }

  hint.addEventListener('click', trigger);
  window.addEventListener('keydown', (ev)=>{ if(ev.key === 'e' || ev.key === 'E') trigger(); });
}

function randomBetween(a,b){ return a + Math.random() * (b-a); }

function runExplodeSequence(){
  // Ultra-violent rip-and-tear sequence: spawn many fragments from each element,
  // create multiple shockwaves, violent velocities, and a long-lived particle storm.
  try{ document.body.style.pointerEvents = 'none'; }catch(e){}
  document.body.classList.add('_shaking');

  // collect top-level elements (skip explosion canvas overlays we create)
  const targets = Array.from(document.body.children).filter(el => !el.classList.contains('explosion-canvas') && el.id !== 'explode-hint');

  // gather small particles originating from each element's bounding box
  const particles = [];
  const now = performance.now();

  // helper: sample a color from computed style (fallback to white)
  function sampleColor(el){ try{ const cs = getComputedStyle(el); return cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : cs.color || 'white'; }catch(e){ return 'white'; } }

  // for each DOM element, hide it and spawn many debris particles from its rect
  targets.forEach(el => {
    const rect = el.getBoundingClientRect();
    // skip zero-size
    if(rect.width <= 2 || rect.height <= 2) return;
    const color = sampleColor(el);
    // hide original immediately but keep layout for a brief moment
    el.style.transition = 'opacity 350ms linear'; el.style.opacity = '0';
    // number of fragments scales with area, capped
    const area = rect.width * rect.height;
    const count = Math.min(250, Math.max(18, Math.floor(area / 1800)));
    for(let i=0;i<count;i++){
      const fx = rect.left + Math.random() * rect.width;
      const fy = rect.top + Math.random() * rect.height;
      const angle = Math.atan2(fy - (rect.top + rect.height/2), fx - (rect.left + rect.width/2)) + (Math.random()-0.5)*2.0;
      const speed = randomBetween(300, 2500) * (1 + Math.random());
      particles.push({x:fx, y:fy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, life:randomBetween(1000, 3500), size:randomBetween(2, Math.min(28, rect.width/6)), color});
    }
  });

  // global shockwave overlays (multiple pulses)
  const overlay = document.createElement('canvas'); overlay.className = 'explosion-canvas'; overlay.width = innerWidth; overlay.height = innerHeight; document.body.appendChild(overlay);
  const octx = overlay.getContext('2d');

  // also add many random ambient particles from screen center
  const cx = innerWidth/2, cy = innerHeight/2;
  for(let i=0;i<800;i++){
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(200, 3200);
    particles.push({x:cx, y:cy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, life:randomBetween(800, 4000), size:randomBetween(1,6), color: `hsl(${Math.random()*60},90%,60%)`});
  }

  // intense screen shake by toggling a heavier class
  document.body.classList.add('_shredded');

  const start = performance.now();
  function loop(now){
    const t = now - start;
    octx.clearRect(0,0,overlay.width, overlay.height);
    // draw shockwaves
    const pulses = [t/6, t/3, t/1.6];
    pulses.forEach((p, idx)=>{
      const radius = p * 0.6 + Math.sin((t + idx*250)/120) * 40;
      const alpha = Math.max(0, 0.7 - (p/1200));
      octx.beginPath(); octx.fillStyle = `rgba(255,255,255,${alpha*0.12})`; octx.arc(cx, cy, Math.abs(radius), 0, Math.PI*2); octx.fill();
    });

    // update particles
    for(let i = particles.length - 1; i >= 0; i--){
      const p = particles[i];
      // heavy air drag and gravity
      const drag = 0.0012;
      p.vx *= (1 - drag);
      p.vy *= (1 - drag);
      p.vy += GRAVITY_PX_PER_S2 * 0.0015 * (1/60);
      p.x += p.vx * (1/60);
      p.y += p.vy * (1/60);
      p.life -= 16;
      // draw debris as rectangles/particles
      octx.fillStyle = p.color;
      octx.save();
      octx.translate(p.x, p.y);
      octx.rotate((p.vx + p.vy) * 0.0008 * (Math.random()>.5?1:-1));
      const s = Math.max(1, p.size * (p.life/2000 + 0.05));
      octx.fillRect(-s/2, -s/2, s, s);
      octx.restore();
      if(p.life <= 0 || p.x < -2000 || p.y < -2000 || p.x > overlay.width + 2000 || p.y > overlay.height + 2000){
        particles.splice(i,1);
      }
    }

    // add bloom and flash as time goes on
    if(t > 700){
      const flash = Math.min(1, (t-700) / 400);
      octx.fillStyle = `rgba(255,255,255,${0.14 * flash})`;
      octx.fillRect(0,0,overlay.width, overlay.height);
    }

    // continue until all particles are exhausted or a timeout
    if(particles.length > 0 && t < 8000){ requestAnimationFrame(loop); } else conclude();
  }
  requestAnimationFrame(loop);

  function conclude(){
    // very final pass: remove all children and blank the page dramatically
    try{ document.body.innerHTML = ''; }catch(e){
      // fallback: hide children
      Array.from(document.body.children).forEach(ch => { try{ ch.style.display = 'none'; }catch(e){} });
    }
    // leave the overlay canvas for a final 600ms then attempt to close
    setTimeout(()=>{
      try{ window.close(); }catch(e){}
      try{ window.location.href = 'about:blank'; }catch(e){}
    }, 600);
  }
}

installExplodeUI();
