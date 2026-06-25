/* =====================================================================
   KroshayKorner — Express server (PostgreSQL backed)
   - Serves static site from /public
   - Schema: products, categories, images
   - Admin auth via password → signed cookie
   - First boot seeds default categories + products if tables are empty
   ===================================================================== */

   const express = require('express');
   const multer  = require('multer');
   const { Pool } = require('pg');
   const path    = require('path');
   const crypto  = require('crypto');
   
   const PORT            = process.env.PORT || 3000;
   const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD || 'kroshay2025';
   const SESSION_SECRET  = process.env.SESSION_SECRET ||
                           crypto.createHash('sha256').update('kk-' + ADMIN_PASSWORD).digest('hex');
   const DATABASE_URL    = process.env.DATABASE_URL;
   
   if (!DATABASE_URL) {
     console.error('DATABASE_URL is required. Configure this environment variable in Render.');
     process.exit(1);
   }
   
   const pool = new Pool({
     connectionString: DATABASE_URL,
     ssl: {
       rejectUnauthorized: false
     }
   });
   
   /* ---------- SEED DATA (used only when tables are empty) ---------- */
   const SEED_CATEGORIES = [
     'Crochet Bags',
     'Crochet Flowers',
     'Crochet Toys',
     'Crochet Accessories',
     'Custom Handmade Gifts',
     'New Arrivals'
   ];
   const SEED_PRODUCTS = [
     { name: 'Blossom Crochet Flower', category: 'Crochet Flowers',       price: 199, description: 'Handcrafted crochet flowers made with love, perfect for gifts and decoration.', art: 'flower', badge: 'Bestseller' },
     { name: 'Cottage Tote Bag',       category: 'Crochet Bags',          price: 699, description: 'Unique handmade crochet bag designed with creativity and care.',                  art: 'bag',    badge: '' },
     { name: 'Tiny Bear Plushie',      category: 'Crochet Toys',          price: 499, description: 'Cute handmade crochet toy created to bring smiles.',                              art: 'toy',    badge: 'New' },
     { name: 'Daisy Hair Clip Set',    category: 'Crochet Accessories',   price: 249, description: 'Soft pastel daisy clips — a dainty everyday accessory.',                         art: 'flower', badge: '' },
     { name: 'Custom Name Keychain',   category: 'Custom Handmade Gifts', price: 299, description: 'Personalised crochet keychain made just for you or someone special.',             art: 'heart',  badge: '' },
     { name: 'Sunflower Bouquet',      category: 'Crochet Flowers',       price: 449, description: 'A forever bouquet of sunshine — never wilts, always smiles.',                    art: 'flower', badge: '' },
     { name: 'Mini Bunny Charm',       category: 'Crochet Toys',          price: 199, description: 'Pocket-sized bunny charm to clip on your bag or keys.',                           art: 'toy',    badge: 'New' },
     { name: 'Pastel Bucket Bag',      category: 'Crochet Bags',          price: 899, description: 'Soft pastel bucket bag with a sturdy braided handle.',                            art: 'bag',    badge: '' },
     { name: 'Cosy Ear Warmer',        category: 'New Arrivals',          price: 349, description: 'A warm crochet headband for breezy mornings and cosy evenings.',                  art: 'yarn',   badge: 'New' }
   ];
   
   async function migrate() {
     await pool.query(`
       CREATE TABLE IF NOT EXISTS categories (
         name VARCHAR(60) NOT NULL PRIMARY KEY,
         sort_order INT NOT NULL DEFAULT 0
       )
     `);
     await pool.query(`
       CREATE TABLE IF NOT EXISTS images (
         id SERIAL PRIMARY KEY,
         mime VARCHAR(60) NOT NULL,
         data BYTEA NOT NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )
     `);
     await pool.query(`
       CREATE TABLE IF NOT EXISTS products (
         id SERIAL PRIMARY KEY,
         name VARCHAR(120) NOT NULL,
         category VARCHAR(60) NOT NULL,
         price INT NOT NULL,
         description VARCHAR(500) NOT NULL DEFAULT '',
         image VARCHAR(500) NOT NULL DEFAULT '',
         art VARCHAR(20) NOT NULL DEFAULT 'flower',
         badge VARCHAR(40) NOT NULL DEFAULT '',
         sort_order INT NOT NULL DEFAULT 0,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )
     `);
   
     // Seed categories if empty
     const catRows = await pool.query('SELECT COUNT(*) AS n FROM categories');
     if (parseInt(catRows.rows[0]?.n || 0, 10) === 0) {
       for (let i = 0; i < SEED_CATEGORIES.length; i++) {
         await pool.query(
           'INSERT INTO categories (name, sort_order) VALUES ($1, $2)',
           [SEED_CATEGORIES[i], i]
         );
       }
       console.log('Seeded categories');
     }
   
     // Seed products if empty
     const prodRows = await pool.query('SELECT COUNT(*) AS n FROM products');
     if (parseInt(prodRows.rows[0]?.n || 0, 10) === 0) {
       for (let i = 0; i < SEED_PRODUCTS.length; i++) {
         const p = SEED_PRODUCTS[i];
         await pool.query(
           `INSERT INTO products (name, category, price, description, image, art, badge, sort_order)
            VALUES ($1, $2, $3, $4, '', $5, $6, $7)`,
           [p.name, p.category, p.price, p.description, p.art, p.badge, i]
         );
       }
       console.log('Seeded products');
     }
   }
   
   /* ---------- auth helpers ---------- */
   function signToken() {
     const ts  = Date.now().toString(36);
     const sig = crypto.createHmac('sha256', SESSION_SECRET).update(ts).digest('hex').slice(0, 32);
     return `${ts}.${sig}`;
   }
   function verifyToken(tok) {
     if (!tok || typeof tok !== 'string' || !tok.includes('.')) return false;
     const [ts, sig] = tok.split('.');
     const expect = crypto.createHmac('sha256', SESSION_SECRET).update(ts).digest('hex').slice(0, 32);
     if (sig !== expect) return false;
     const age = Date.now() - parseInt(ts, 36);
     return age >= 0 && age < 1000 * 60 * 60 * 24 * 30;
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
     if (!verifyToken(parseCookies(req).kk_admin)) {
       return res.status(401).json({ error: 'unauthorised' });
     }
     next();
   }
   
   /* ---------- multer (memory; we store BYTEA in Database) ---------- */
   const upload = multer({
     storage: multer.memoryStorage(),
     limits:  { fileSize: 5 * 1024 * 1024 },
     fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
   });
   
   /* ---------- app ---------- */
   const app = express();
   app.use(express.json({ limit: '1mb' }));
   app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
   /* ---------- public read ---------- */
app.get('/api/state', async (req, res, next) => {
  try {
    const cats = await pool.query('SELECT name FROM categories ORDER BY sort_order, name');
    const prods = await pool.query(
      'SELECT id, name, category, price, description, image, art, badge FROM products ORDER BY sort_order, id'
    );
    res.json({
      categories: cats.rows.map(c => c.name),
      products: prods.rows.map(p => ({ ...p, price: Number(p.price) }))
    });
  } catch (e) { next(e); }
});

/* ---------- images store ---------- */
app.get('/api/images/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).end();
    const rows = await pool.query('SELECT mime, data FROM images WHERE id = $1', [id]);
    if (!rows.rows.length) return res.status(404).end();
    res.setHeader('Content-Type', rows.rows[0].mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(rows.rows[0].data);
  } catch (e) { next(e); }
});

/* ---------- auth ---------- */
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  const tok = signToken();
  res.setHeader('Set-Cookie',
    `kk_admin=${encodeURIComponent(tok)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60*60*24*30}`);
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `kk_admin=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => {
  res.json({ authenticated: verifyToken(parseCookies(req).kk_admin) });
});

/* ---------- products CRUD ---------- */
async function getCategories() {
  const rows = await pool.query('SELECT name FROM categories ORDER BY sort_order, name');
  return rows.rows.map(r => r.name);
}

function sanitiseProduct(b, validCats) {
  if (!b || typeof b !== 'object') return { ok: false, error: 'invalid payload' };
  const name = String(b.name || '').trim();
  const category = String(b.category || '').trim();
  const price = Number(b.price);
  const description = String(b.description || '').trim();
  const image = String(b.image || '').trim();
  const art = String(b.art || 'flower').trim();
  const badge = String(b.badge || '').trim();
  if (!name)                              return { ok: false, error: 'name required' };
  if (!category)                          return { ok: false, error: 'category required' };
  if (!validCats.includes(category))      return { ok: false, error: 'unknown category' };
  if (!Number.isFinite(price) || price<0) return { ok: false, error: 'price must be a number' };
  if (name.length > 120)                  return { ok: false, error: 'name too long' };
  if (description.length > 500)           return { ok: false, error: 'description too long' };
  if (image.length > 500)                 return { ok: false, error: 'image url too long' };
  return { ok: true, value: { name, category, price, description, image, art, badge } };
}

app.post('/api/products', requireAuth, async (req, res, next) => {
  try {
    const cats = await getCategories();
    const s = sanitiseProduct(req.body, cats);
    if (!s.ok) return res.status(400).json({ error: s.error });
    const v = s.value;
    const maxRow = await pool.query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM products');
    const sort = (maxRow.rows[0]?.m ?? -1) + 1;
    const r = await pool.query(
      'INSERT INTO products (name, category, price, description, image, art, badge, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [v.name, v.category, v.price, v.description, v.image, v.art, v.badge, sort]
    );
    res.json({ id: r.rows[0].id, ...v });
  } catch (e) { next(e); }
});

app.put('/api/products/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
    const cats = await getCategories();
    const s = sanitiseProduct(req.body, cats);
    if (!s.ok) return res.status(400).json({ error: s.error });
    const v = s.value;
    const r = await pool.query(
      'UPDATE products SET name=$1, category=$2, price=$3, description=$4, image=$5, art=$6, badge=$7 WHERE id=$8',
      [v.name, v.category, v.price, v.description, v.image, v.art, v.badge, id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ id, ...v });
  } catch (e) { next(e); }
});

app.delete('/api/products/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
    const r = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- categories ---------- */
app.post('/api/categories', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    if (name.length > 60) return res.status(400).json({ error: 'name too long' });
    const cats = await getCategories();
    if (cats.includes(name)) return res.status(409).json({ error: 'already exists' });
    await pool.query('INSERT INTO categories (name, sort_order) VALUES ($1, $2)', [name, cats.length]);
    res.json({ ok: true, categories: [...cats, name] });
  } catch (e) { next(e); }
});

app.delete('/api/categories/:name', requireAuth, async (req, res, next) => {
  try {
    const name = req.params.name;
    const uses = await pool.query('SELECT COUNT(*) AS n FROM products WHERE category = $1', [name]);
    if (parseInt(uses.rows[0]?.n || 0, 10) > 0) return res.status(409).json({ error: 'category is in use by at least one product' });
    const r = await pool.query('DELETE FROM categories WHERE name = $1', [name]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true, categories: await getCategories() });
  } catch (e) { next(e); }
});

/* ---------- upload (BYTEA) ---------- */
app.post('/api/upload', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file (image only, ≤5 MB)' });
    const r = await pool.query(
      'INSERT INTO images (mime, data) VALUES ($1, $2) RETURNING id',
      [req.file.mimetype, req.file.buffer]
    );
    res.json({ url: `/api/images/${r.rows[0].id}` });
  } catch (e) { next(e); }
});

/* ---------- error handler ---------- */
app.use((err, req, res, next) => {
  console.error('ERR', err && err.message);
  if (err && err.message) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'server error' });
});

/* ---------- start ---------- */
(async () => {
  try {
    await migrate();
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KroshayKorner listening on 0.0.0.0:${PORT}`);
  });
})();
