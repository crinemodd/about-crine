const NAME = 'Crine';
const links = [
  {url: 'https://github.com/crinemodd', title: 'GitHub'},
  {url: 'https://tryhackme.com/p/crinemodd', title: 'TryHackMe'},
  {url: 'https://www.reddit.com/user/crine_mod/', title: 'Reddit'},
  {url: 'https://www.youtube.com/@Crine-/featured', title: 'YouTube'}
];

const nameEl = document.getElementById('name');
NAME.split('').forEach((ch, i) => {
  const span = document.createElement('span');
  span.className = 'letter';
  span.textContent = ch;
  nameEl.appendChild(span);
  setTimeout(() => span.classList.add('visible'), i * 250);
});

const linksEl = document.getElementById('links');
function renderLinks() {
  linksEl.innerHTML = '';
  links.forEach(l => {
    const a = document.createElement('a');
    a.className = 'link';
    a.href = l.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    const icon = document.createElement('div');
    icon.className = 'icon';
    const img = document.createElement('img');
    try {
      const host = new URL(l.url).hostname;
      img.src = `https://www.google.com/s2/favicons?sz=64&domain=${host}`;
    } catch {
      img.src = '';
    }
    icon.appendChild(img);

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = l.title || l.url;

    a.appendChild(icon);
    a.appendChild(label);
    linksEl.appendChild(a);
  });
}
renderLinks();

const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
let w = canvas.width = innerWidth;
let h = canvas.height = innerHeight;

window.addEventListener('resize', () => {
  w = canvas.width = innerWidth;
  h = canvas.height = innerHeight;
});

const drops = [];
function initDrops(count = 130) {
  drops.length = 0;
  for (let i = 0; i < count; i++) {
    drops.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vy: 4 + Math.random() * 8,
      len: 10 + Math.random() * 20,
      vx: -0.8 + Math.random() * 1.6
    });
  }
}
initDrops(Math.floor(w / 10));

let flashAlpha = 0;
let nextFlash = Date.now() + 8000 + Math.random() * 15000;

function draw() {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#07080a');
  g.addColorStop(1, '#0b0d10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(180,200,255,0.18)';
  for (const d of drops) {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - d.vy * 0.3, d.y + d.len);
    ctx.stroke();
    d.x += d.vx * 0.6 + Math.sin(d.y * 0.02) * 0.6;
    d.y += d.vy;
    if (d.y > h) {
      d.y = -20;
      d.x = Math.random() * w;
    }
  }

  if (Date.now() > nextFlash) {
    flashAlpha = 0.6 + Math.random() * 0.6;
    nextFlash = Date.now() + 8000 + Math.random() * 15000;
  }
  if (flashAlpha > 0.02) {
    const a = Math.min(1, flashAlpha * 0.8);
    ctx.fillStyle = `rgba(180,230,180,${a})`;
    ctx.fillRect(0, 0, w, h);
    flashAlpha *= 0.88;
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

(() => {
  const layerDefs = [
    {id: 'fogLayer1', target: 0.27},
    {id: 'fogLayer2', target: 0.21},
    {id: 'fogLayer3', target: 0.15}
  ];

  const layers = layerDefs.map(d => {
    const el = document.getElementById(d.id);
    if (!el) return null;
    el.style.animation = 'none';
    el.style.opacity = '0';
    el.setAttribute('opacity', '0');
    return {el, target: d.target, done: false};
  }).filter(Boolean);

  if (!layers.length) return;

  let last = performance.now();
  const perMs = 0.00002;

  function step(now) {
    const dt = Math.max(0, now - last);
    last = now;
    const inc = dt * perMs;
    let any = false;
    for (const l of layers) {
      if (l.done) continue;
      any = true;
      let cur = parseFloat(l.el.style.opacity || l.el.getAttribute('opacity') || 0) || 0;
      cur += inc;
      if (cur >= l.target) {
        cur = l.target;
        l.done = true;
      }
      l.el.setAttribute('opacity', String(cur));
      l.el.style.opacity = String(cur);
    }
    if (any) requestAnimationFrame(step);
  }

})();
