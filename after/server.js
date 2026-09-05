// Dumb persistence layer. On purpose.
// This server knows nothing about todos. It reads and writes rows.
// Every rule about what a todo *is* lives in public/index.html.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4322;
const DB_FILE = path.join(__dirname, 'db.json');
const PUBLIC = path.join(__dirname, 'public');

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ _rev: 0, rows: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  db._rev = db._rev + 1;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  return db;
}

function body(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => {
      try { resolve(JSON.parse(s || '{}')); } catch (e) { resolve({}); }
    });
  });
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);

  // ---- API ----------------------------------------------------------------
  if (url.pathname === '/api/todos') {
    const db = readDb();

    if (req.method === 'GET') {
      // The client passes a raw column name. Yes, the schema is the API.
      const orderBy = url.searchParams.get('order_by') || 'created_at';
      const rows = db.rows.slice().sort((a, b) => (a[orderBy] > b[orderBy] ? 1 : -1));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // _rev and _file_offset are storage internals. Shipped anyway.
      return res.end(JSON.stringify({ _rev: db._rev, _file_offset: fs.statSync(DB_FILE).size, rows }));
    }

    if (req.method === 'POST') {
      // No validation. Whatever shape the browser sends becomes the row shape.
      const row = await body(req);
      db.rows.push(row);
      writeDb(db);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(row));
    }

    if (req.method === 'PUT') {
      // Full-table replace. The client owns the truth; we just hold the bag.
      const payload = await body(req);
      db.rows = payload.rows;
      writeDb(db);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ _rev: db._rev, rows: db.rows }));
    }

    if (req.method === 'DELETE') {
      // Deletes by array position, because that's what the UI had handy.
      const i = parseInt(url.searchParams.get('i'), 10);
      db.rows.splice(i, 1);
      writeDb(db);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: 1 }));
    }
  }

  // ---- static -------------------------------------------------------------
  let f = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(PUBLIC, f);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain' });
    return res.end(fs.readFileSync(file));
  }

  res.writeHead(404);
  res.end('nope');
});

server.listen(PORT, () => console.log('todo-app on http://localhost:' + PORT));
