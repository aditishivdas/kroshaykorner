/* =====================================================================
   KroshayKorner — Express server (PostgreSQL backed)
   ===================================================================== */
const express = require('express');
const multer  = require('multer');
const { Pool } = require('pg');
const path    = require('path');
const crypto  = require('crypto');

const PORT            = process.env.PORT || 3000;
const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD || 'kroshay2025';
const SESSION_SECRET  = process.env.SESSION_SECRET || crypto.createHash('sha256').update('kk-' + ADMIN_PASSWORD).digest('hex');
const DATABASE_URL    = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SEED_CATEGORIES = ['Crochet Bags', 'Crochet Flowers', 'Crochet Toys', 'Crochet Accessories', 'Custom Handmade Gifts', 'New Arrivals'];
const SEED_PRODUCTS = [
  { name: 'Blossom Crochet Flower', category: 'Crochet Flowers', price: 199, description: 'Handcrafted crochet flowers made with love.', art: 'flower', badge: 'Bestseller' },
  { name: 'Cottage Tote Bag', category: 'Crochet Bags', price: 699, description: 'Unique handmade crochet bag.', art: 'bag', badge: '' }
];

async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS categories (name VARCHAR(60) NOT NULL PRIMARY KEY, sort_order INT NOT NULL DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS images (id SERIAL PRIMARY KEY, mime VARCHAR(60) NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, category VARCHAR(60) NOT NULL, price INT NOT NULL, description VARCHAR(500) NOT NULL DEFAULT '', image VARCHAR(500) NOT NULL DEFAULT '', art VARCHAR(20) NOT NULL DEFAULT 'flower', badge VARCHAR(40) NOT NULL DEFAULT '', sort_order INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

  const catRows = await pool.query('SELECT COUNT(*) AS n FROM categories');
  if (parseInt(catRows.rows[0].n, 10) === 0) {
    for (let i = 0; i < SEED_CATEGORIES.length; i++) {
      await pool.query('INSERT INTO categories (name, sort_order) VALUES ($1, $2)', [SEED_CATEGORIES[i], i]);
    }
    console.log('Seeded categories');
  }
  const prodRows = await pool.query('SELECT COUNT(*) AS n FROM products');
  if (parseInt(prodRows.rows[0].n, 10) === 0) {
    for (let i = 0; i < SEED_PRODUCTS.length; i++) {
      const p = SEED_PRODUCTS[i];
      await pool.query(`INSERT INTO products (name, category, price, description, image, art, badge, sort_order) VALUES ($1, $2, $3, $4, '', $5, $6, $7)`, [p.name, p.category, p.price, p.description, p.art, p.badge, i]);
    }
    console.log('Seeded products');
  }
}

function signToken() {
  const ts = Date.now().toString(36);
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(ts).digest('hex').slice(0, 32);
  return `${ts}.${sig}`;
}
function verifyToken(tok) {
  if (!tok || typeof tok !== 'string' || !tok.includes('.')) return false;
  const [ts, sig] = tok.split('.');
  const expect = crypto.createHmac('sha256', SESSION_SECRET).update(ts).digest('hex').slice(0, 32);
  if (sig !== expect) return false;
  return (Date.now() - parseInt(ts, 36)) < 1000 * 60 * 60 * 24 * 30;
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function requireAuth(req, res, next) {
  if (!verifyToken(parseCookies(req).kk_admin)) return res.status(401).json({ error: 'unauthorised' });
  next();
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/api/state', async (req, res, next) => {
  try {
    let cats = await pool.query('SELECT name FROM categories ORDER BY sort_order, name');
    
    // If the database is empty, this safely injects your categories right here!
    if (cats.rows.length === 0) {
      const defaultCats = ['Crochet Bags', 'Crochet Flowers', 'Crochet Toys', 'Crochet Accessories', 'Custom Handmade Gifts', 'New Arrivals'];
      for (let i = 0; i < defaultCats.length; i++) {
        await pool.query('INSERT INTO categories (name, sort_order) VALUES ($1, $2) ON CONFLICT DO NOTHING', [defaultCats[i], i]);
      }
      cats = await pool.query('SELECT name FROM categories ORDER BY sort_order, name');
    }

    const prods = await pool.query('SELECT id, name, category, price, description, image, art, badge FROM products ORDER BY sort_order, id');
    
    res.json({
      categories: cats.rows.map(c => c.name),
      products: prods.rows.map(p => ({ ...p, price: Number(p.price) }))
    });
  } catch (e) { next(e); }
});

app.get('/api/images/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rows = await pool.query('SELECT mime, data FROM images WHERE id = $1', [id]);
    if (!rows.rows.length) return res.status(404).end();
    res.setHeader('Content-Type', rows.rows[0].mime);
    res.send(rows.rows[0].data);
  } catch (e) { next(e); }
});

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  res.setHeader('Set-Cookie', `kk_admin=${encodeURIComponent(signToken())}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60*60*24*30}`);
  res.json({ ok: true });
});

async function getCategories() {
  const rows = await pool.query('SELECT name FROM categories ORDER BY sort_order, name');
  return rows.rows.map(r => r.name);
}

app.post('/api/products', requireAuth, async (req, res, next) => {
  try {
    const v = req.body;
    const maxRow = await pool.query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM products');
    const sort = (maxRow.rows[0].m ?? -1) + 1;
    const r = await pool.query('INSERT INTO products (name, category, price, description, image, art, badge, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [v.name, v.category, v.price, v.description, v.image, v.art, v.badge, sort]);
    res.json({ id: r.rows[0].id, ...v });
  } catch (e) { next(e); }
});

app.put('/api/products/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const v = req.body;
    await pool.query('UPDATE products SET name=$1, category=$2, price=$3, description=$4, image=$5, art=$6, badge=$7 WHERE id=$8', [v.name, v.category, v.price, v.description, v.image, v.art, v.badge, id]);
    res.json({ id, ...v });
  } catch (e) { next(e); }
});

app.delete('/api/products/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.post('/api/categories', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const cats = await getCategories();
    await pool.query('INSERT INTO categories (name, sort_order) VALUES ($1, $2)', [name, cats.length]);
    res.json({ ok: true, categories: [...cats, name] });
  } catch (e) { next(e); }
});

app.delete('/api/categories/:name', requireAuth, async (req, res, next) => {
  try {
    const name = req.params.name;
    await pool.query('DELETE FROM categories WHERE name = $1', [name]);
    res.json({ ok: true, categories: await getCategories() });
  } catch (e) { next(e); }
});

app.post('/api/upload', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file' });
    const r = await pool.query('INSERT INTO images (mime, data) VALUES ($1, $2) RETURNING id', [req.file.mimetype, req.file.buffer]);
    res.json({ url: `/api/images/${r.rows[0].id}` });
  } catch (e) { next(e); }
});

app.use((err, req, res, next) => { res.status(500).json({ error: err.message || 'server error' }); });

(async () => {
  try { await migrate(); } catch (e) { console.error(e); process.exit(1); }
  app.listen(PORT, '0.0.0.0', () => { console.log(`Server running on port ${PORT}`); });
})();
