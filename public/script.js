/* ================================================================
   KroshayKorner · public site script
   Fetches /api/state and renders the catalogue.
   ================================================================ */

const ORDER_WHATSAPP = '917550281520';   // brand's primary WhatsApp (Sreeja)

/* ---------- SVG art (used when a product has no image) ---------- */
const ART = {
  flower: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><g transform="translate(100 100)"><g><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95"/><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95" transform="rotate(72)"/><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95" transform="rotate(144)"/><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95" transform="rotate(216)"/><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95" transform="rotate(288)"/></g><circle r="18" fill="#C9986B"/><circle r="18" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="2 3" opacity=".8"/></g></svg>`,
  bag:    `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M60 60 Q60 30 100 30 Q140 30 140 60" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M40 70 H160 L150 160 Q150 175 135 175 H65 Q50 175 50 160 Z" fill="#fff" opacity=".95"/><g stroke="#C9986B" stroke-width="1.5" opacity=".55" fill="none"><path d="M50 90 H150 M50 105 H150 M50 120 H150 M50 135 H150 M50 150 H150"/></g><circle cx="100" cy="115" r="10" fill="#E8B4B8"/></svg>`,
  toy:    `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><circle cx="62" cy="60" r="20" fill="#fff"/><circle cx="138" cy="60" r="20" fill="#fff"/><circle cx="62" cy="60" r="9" fill="#E8B4B8"/><circle cx="138" cy="60" r="9" fill="#E8B4B8"/><circle cx="100" cy="110" r="58" fill="#fff"/><circle cx="82" cy="100" r="5" fill="#3D2A26"/><circle cx="118" cy="100" r="5" fill="#3D2A26"/><path d="M88 122 Q100 132 112 122" stroke="#3D2A26" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="100" cy="115" r="4" fill="#E8B4B8"/></svg>`,
  heart:  `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M100 160 C40 120 30 80 60 60 Q90 40 100 75 Q110 40 140 60 C170 80 160 120 100 160 Z" fill="#fff"/><path d="M100 160 C40 120 30 80 60 60 Q90 40 100 75 Q110 40 140 60 C170 80 160 120 100 160 Z" fill="none" stroke="#C9986B" stroke-width="2" stroke-dasharray="3 4" opacity=".6"/></svg>`,
  yarn:   `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="70" fill="#fff"/><g stroke="#C9986B" stroke-width="2" fill="none" opacity=".6"><path d="M40 100 Q100 60 160 100"/><path d="M40 110 Q100 70 160 110"/><path d="M40 120 Q100 80 160 120"/><path d="M40 130 Q100 90 160 130"/><path d="M40 90 Q100 50 160 90"/><path d="M50 70 Q120 90 150 150"/><path d="M40 80 Q110 100 145 145"/></g><path d="M150 100 Q175 95 175 75" stroke="#E8B4B8" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`
};
function artFor(k){ return ART[k] || ART.flower; }
function waLink(name){ return `https://wa.me/${ORDER_WHATSAPP}?text=${encodeURIComponent(`Hi KroshayKorner, I want to order ${name}`)}`; }
function priceFmt(n){ return '₹' + Number(n).toLocaleString('en-IN'); }
function esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- state & render ---------- */
let STATE = { categories: [], products: [] };
let activeCategory = 'All';

const grid    = document.getElementById('grid');
const filters = document.getElementById('filters');

async function loadState(){
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (!r.ok) throw new Error('failed');
    STATE = await r.json();
  } catch (e) {
    STATE = { categories: [], products: [] };
  }
  renderFilters();
  renderGrid();
}

function renderFilters(){
  filters.innerHTML = '';
  const cats = ['All', ...STATE.categories];
  cats.forEach(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = cat;
    if (cat === activeCategory) b.classList.add('is-active');
    b.addEventListener('click', () => {
      activeCategory = cat;
      renderFilters();
      renderGrid();
    });
    filters.appendChild(b);
  });
}

function renderGrid(){
  grid.innerHTML = '';
  const list = activeCategory === 'All'
    ? STATE.products
    : STATE.products.filter(p => p.category === activeCategory);

  if (!list.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--ink-soft);padding:3rem 0">
      Nothing here yet — new pieces coming soon ♡</p>`;
    return;
  }

  list.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.setProperty('--reveal-delay', (i * 60) + 'ms');
    const media = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`
      : `<div class="card__art">${artFor(p.art)}</div>`;
    card.innerHTML = `
      <div class="card__media">
        ${p.badge ? `<span class="card__badge">${esc(p.badge)}</span>` : ''}
        ${media}
        <span class="card__cat">${esc(p.category)}</span>
      </div>
      <div class="card__body">
        <div class="card__head">
          <h3 class="card__name">${esc(p.name)}</h3>
          <span class="card__price">${priceFmt(p.price)}</span>
        </div>
        <p class="card__desc">${esc(p.description)}</p>
        <a class="card__order" href="${waLink(p.name)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24"><path d="M19.05 4.91A10 10 0 0 0 2.05 16.3L1 21l4.8-1.26A10 10 0 1 0 19.05 4.91zM12 20a8.06 8.06 0 0 1-4.1-1.12l-.3-.18-2.85.75.76-2.78-.2-.32A8.07 8.07 0 1 1 12 20zm4.42-6.04c-.24-.12-1.43-.71-1.65-.79s-.38-.12-.55.12-.62.79-.76.95-.28.18-.52.06a6.6 6.6 0 0 1-3.29-2.87c-.14-.24 0-.37.11-.49s.24-.28.36-.42a1.6 1.6 0 0 0 .24-.4.45.45 0 0 0 0-.42c-.06-.12-.55-1.31-.75-1.79s-.4-.4-.55-.41h-.46a.9.9 0 0 0-.65.3 2.71 2.71 0 0 0-.85 2c0 1.19.86 2.34.98 2.5s1.7 2.6 4.13 3.65a14 14 0 0 0 1.38.51 3.32 3.32 0 0 0 1.52.1 2.5 2.5 0 0 0 1.63-1.15 2 2 0 0 0 .14-1.15c-.06-.1-.22-.16-.46-.28z"/></svg>
          Order on WhatsApp
        </a>
      </div>`;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.card').forEach(el => revealObserver.observe(el));
}

/* ---------- reveal on scroll ---------- */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('is-in');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ---------- nav ---------- */
const nav    = document.getElementById('nav');
const burger = document.getElementById('burger');
burger?.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  burger.setAttribute('aria-expanded', String(open));
});
nav.querySelectorAll('.nav__links a').forEach(a => {
  a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  });
});

/* ---------- footer year ---------- */
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

/* boot */
loadState();
