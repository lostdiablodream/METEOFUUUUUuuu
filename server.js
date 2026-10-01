// Нулевая-зависимость: статика + JSON API поверх node:http.
// Запуск: npm start  (или node server.js), затем http://localhost:3000
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DB_PATH = join(ROOT, 'db.json');
const MAX_BODY_BYTES = 10_000;
const MAX_NOTE_LENGTH = 200;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function readDB() {
  try {
    const db = JSON.parse(await readFile(DB_PATH, 'utf8'));
    if (!Array.isArray(db.notes)) db.notes = [];
    return db;
  } catch {
    return { notes: [] };
  }
}

async function writeDB(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2) + '\n', 'utf8');
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Тело запроса слишком большое'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Некорректный JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  // GET /api/notes — список наблюдений
  if (url.pathname === '/api/notes' && req.method === 'GET') {
    const db = await readDB();
    return sendJSON(res, 200, db.notes);
  }

  // POST /api/notes { text } — создать наблюдение
  if (url.pathname === '/api/notes' && req.method === 'POST') {
    const body = await readBody(req);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > MAX_NOTE_LENGTH) {
      return sendJSON(res, 400, { error: `Поле text обязательно (1–${MAX_NOTE_LENGTH} символов).` });
    }
    const db = await readDB();
    const note = { id: randomUUID(), text, done: false, createdAt: new Date().toISOString() };
    db.notes.unshift(note);
    await writeDB(db);
    return sendJSON(res, 201, note);
  }

  const match = url.pathname.match(/^\/api\/notes\/([\w-]+)$/);

  // PATCH /api/notes/:id { done?, text? } — обновить
  if (match && req.method === 'PATCH') {
    const body = await readBody(req);
    const db = await readDB();
    const note = db.notes.find((n) => n.id === match[1]);
    if (!note) return sendJSON(res, 404, { error: 'Запись не найдена.' });
    if (typeof body.done === 'boolean') note.done = body.done;
    if (typeof body.text === 'string' && body.text.trim()) {
      note.text = body.text.trim().slice(0, MAX_NOTE_LENGTH);
    }
    await writeDB(db);
    return sendJSON(res, 200, note);
  }

  // DELETE /api/notes/:id — удалить
  if (match && req.method === 'DELETE') {
    const db = await readDB();
    const index = db.notes.findIndex((n) => n.id === match[1]);
    if (index === -1) return sendJSON(res, 404, { error: 'Запись не найдена.' });
    db.notes.splice(index, 1);
    await writeDB(db);
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 404, { error: 'Маршрут не найден.' });
}

async function serveStatic(req, res, url) {
  let pathname = normalize(decodeURIComponent(url.pathname));
  if (pathname === '/' || pathname === '.') pathname = '/index.html';
  const filePath = join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 — доступ запрещён');
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 — файл не найден');
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('405 — метод не поддерживается');
    }
    return await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    return sendJSON(res, 500, { error: 'Внутренняя ошибка сервера.' });
  }
});

server.listen(PORT, () => {
  console.log(`МетеоЦентр запущен: http://localhost:${PORT}`);
});
