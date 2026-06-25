/* =====================================================================
   KroshayKorner · admin panel
   Handles login, product CRUD, category CRUD, image upload
   ===================================================================== */

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const ART = {
  flower: `<svg viewBox="0 0 200 200"><g transform="translate(100 100)"><g><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95"/><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95" transform="rotate(72)"/><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95" transform="rotate(144)"/><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95" transform="rotate(216)"/><ellipse cx="0" cy="-48" rx="24" ry="42" fill="#fff" opacity=".95" transform="rotate(288)"/></g><circle r="18" fill="#C9986B"/></g></svg>`,
  bag:    `<svg viewBox="0 0 200 200"><path d="M60 60 Q60 30 100 30 Q140 30 140 60" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M40 70 H160 L150 160 Q150 175 135 175 H65 Q50 175 50 160 Z" fill="#fff"/></svg>`,
  toy:    `<svg viewBox="0 0 200 200"><circle cx="62" cy="60" r="20" fill="#fff"/><circle cx="138" cy="60" r="20" fill="#fff"/><circle cx="100" cy="110" r="58" fill="#fff"/><circle cx="82" cy="100" r="5" fill="#3D2A26"/><circle cx="118" cy="100" r="5" fill="#3D2A26"/></svg>`,
  heart:  `<svg viewBox="0 0 200 200"><path d="M100 160 C40 120 30 80 60 60 Q90 40 100 75 Q110 40 140 60 C170 80 160 120 100 160 Z" fill="#fff"/></svg>`,
  yarn:   `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="70" fill="#fff"/></svg>`
};

let STATE = { categories: [], products: [] };
let editingId = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const priceFmt = n => '₹' + Number(n).toLocaleString('en-IN');

/* ---------- toast ---------- */
const toast = $('#toast');
function notify(msg, kind='ok') {
  toast.textContent = msg;
  toast.className = 'toast' + (kind === 'err' ? ' toast--err' : '');
  toast.hidden = false;
  clearTimeout(notify._t);
  notify._t = setTimeout(() => { toast.hidden = true; }, 2400);
}

/* ---------- API helpers ---------- */
async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: 'same-origin', ...opts });
  let body = null;
  try { body = await r.json(); } catch {}
  if (!r.ok) {
    const err = new Error(body?.error || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return body;
}

/* ---------- AUTH ---------- */
async function checkAuth() {
  try {
    const r = await api('/api/me');
    if (r.authenticated) showApp();
    else showLogin()
  } catch { showApp(); }
}

function showLogin() {
  $('#login').hidden = false;
  $('#app').hidden = true;
}
function showApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  loadState();
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const password = $('#loginPassword').value;
  const errEl = $('#loginError');
  errEl.hidden = true;
  try {
    await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    showApp();
  } catch (e) {
    errEl.textContent = e.message || 'Login failed';
    errEl.hidden = false;
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  showLogin();
});

/* ---------- LOAD & RENDER ---------- */
async function loadState() {
  STATE = await api('/api/state');
  renderCategories();
  renderProducts();
}

function renderCategories() {
  const list = $('#catList');
  list.innerHTML = '';
  STATE.categories.forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${esc(c)}</span><button data-cat="${esc(c)}" aria-label="Delete category">✕</button>`;
    list.appendChild(li);
  });
  list.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => deleteCategory(b.dataset.cat));
  });
}

function renderProducts() {
  const list = $('#productList');
  list.innerHTML = '';
  $('#counter').textContent = `${STATE.products.length} item${STATE.products.length === 1 ? '' : 's'}`;

  if (!STATE.products.length) {
    list.innerHTML = `<p style="text-align:center;color:var(--ink-soft);padding:3rem 0">No products yet — add your first piece ♡</p>`;
    return;
  }

  STATE.products.forEach(p => {
    const row = document.createElement('div');
    row.className = 'prod';
    const thumb = p.image
      ? `<img src="${esc(p.image)}" alt="">`
      : (ART[p.art] || ART.flower);
    row.innerHTML = `
      <div class="prod__thumb">${thumb}</div>
      <div>
        <div class="prod__name">${esc(p.name)}${p.badge ? `<span class="prod__badge">${esc(p.badge)}</span>` : ''}</div>
        <div class="prod__desc">${esc(p.description)}</div>
      </div>
      <span class="prod__cat">${esc(p.category)}</span>
      <span class="prod__price">${priceFmt(p.price)}</span>
      <div class="prod__actions">
        <button class="icon-btn" data-edit="${p.id}" aria-label="Edit">✎</button>
        <button class="icon-btn icon-btn--del" data-del="${p.id}" aria-label="Delete">✕</button>
      </div>`;
    list.appendChild(row);
  });

  list.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openModal(+b.dataset.edit)));
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteProduct(+b.dataset.del)));
}
/* ---------- CATEGORY CRUD ---------- */
$('#catForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#catInput').value.trim();
  if (!name) return;
  try {
    const r = await api('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    STATE.categories = r.categories;
    $('#catInput').value = '';
    renderCategories();
    notify('Category added');
  } catch (e) { notify(e.message, 'err'); }
});

async function deleteCategory(name) {
  if (!confirm(`Delete category "${name}"? (Only works if no product uses it.)`)) return;
  try {
    const r = await api(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
    STATE.categories = r.categories;
    renderCategories();
    notify('Category removed');
  } catch (e) { notify(e.message, 'err'); }
}

/* ---------- PRODUCT MODAL ---------- */
const modal = $('#modal');
const form  = $('#productForm');

$('#addBtn').addEventListener('click', () => openModal(null));
modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

function openModal(id) {
  editingId = id;
  $('#formError').hidden = true;

  const sel = $('#fCategory');
  if (sel.options.length <= 1 && STATE.categories.length) {
    sel.innerHTML = '';
    STATE.categories.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  }

  if (id) {
    const p = STATE.products.find(x => x.id === id);
    if (!p) return;
    $('#modalTitle').textContent = 'Edit product';
    $('#fId').value = p.id;
    $('#fName').value = p.name;
    $('#fCategory').value = p.category;
    $('#fPrice').value = p.price;
    $('#fDesc').value = p.description;
    $('#fImage').value = p.image || '';
    $('#fArt').value = p.art || 'flower';
    $('#fBadge').value = p.badge || '';
    updatePreview(p.image, p.art);
  } else {
    $('#modalTitle').textContent = 'New product';
    form.reset();
    $('#fId').value = '';
    if (sel.options.length > 1) {
      sel.selectedIndex = 1;
    }
    updatePreview('', 'flower');
  }

  modal.hidden = false;
  setTimeout(() => $('#fName').focus(), 80);
}

function closeModal() {
  modal.hidden = true;
  editingId = null;
}

function updatePreview(image, art) {
  const el = $('#fPreview');
  if (image) {
    el.innerHTML = `<img src="${esc(image)}" alt="">`;
  } else {
    el.innerHTML = ART[art] || ART.flower;
  }
}

$('#fImage').addEventListener('input', e => updatePreview(e.target.value.trim(), $('#fArt').value));
$('#fArt').addEventListener('change', e => {
  if (!$('#fImage').value.trim()) updatePreview('', e.target.value);
});
$('#fClearImg').addEventListener('click', () => {
  $('#fImage').value = '';
  $('#fFile').value = '';
  updatePreview('', $('#fArt').value);
});

$('#fFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('image', file);
  try {
    notify('Uploading…');
    const r = await api('/api/upload', { method: 'POST', body: fd });
    $('#fImage').value = r.url;
    updatePreview(r.url, $('#fArt').value);
    notify('Image uploaded');
  } catch (err) {
    notify(err.message || 'Upload failed', 'err');
  } finally {
    e.target.value = '';
  }
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  $('#formError').hidden = true;

  const payload = {
    name:        $('#fName').value.trim(),
    category:    $('#fCategory').value,
    price:       Number($('#fPrice').value),
    description: $('#fDesc').value.trim(),
    image:       $('#fImage').value.trim(),
    art:         $('#fArt').value,
    badge:       $('#fBadge').value.trim()
  };

  try {
    if (editingId) {
      await api(`/api/products/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      notify('Product updated');
    } else {
      await api('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      notify('Product added');
    }
    closeModal();
    await loadState();
  } catch (err) {
    $('#formError').textContent = err.message;
    $('#formError').hidden = false;
  }
});

async function deleteProduct(id) {
  const p = STATE.products.find(x => x.id === id);
  if (!confirm(`Delete "${p?.name || 'this product'}"? This cannot be undone.`)) return;
  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    notify('Product deleted');
    await loadState();
  } catch (e) { notify(e.message, 'err'); }
}

/* ---------- BOOT ---------- */
checkAuth();
