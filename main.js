const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const { spawn, execFile } = require('child_process');

// ---------- configurações (conexão com o slskd) ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function defaultDownloadsDir() {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(base, 'slskd', 'downloads');
}

let settings = { url: 'http://localhost:5030', downloadsDir: defaultDownloadsDir(), key: '', user: '', pass: '', remember: false };

const enc = (v) => {
  if (!v) return '';
  return safeStorage.isEncryptionAvailable()
    ? 'e:' + safeStorage.encryptString(v).toString('base64')
    : 'p:' + Buffer.from(v).toString('base64');
};
const dec = (v) => {
  if (!v) return '';
  const body = Buffer.from(v.slice(2), 'base64');
  return v.startsWith('e:') ? safeStorage.decryptString(body) : body.toString();
};

function loadSettings() {
  try {
    const j = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    if (j.url) settings.url = j.url;
    if (j.downloadsDir) settings.downloadsDir = j.downloadsDir;
    try { settings.key = dec(j.key); } catch {}
    if (j.remember) {
      try {
        settings.user = j.user || '';
        settings.pass = dec(j.pass);
        settings.remember = !!(settings.user && settings.pass);
      } catch {}
    }
  } catch {}
}

function persistSettings() {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify({
      url: settings.url,
      downloadsDir: settings.downloadsDir,
      key: enc(settings.key),
      remember: settings.remember,
      user: settings.remember ? settings.user : '',
      pass: settings.remember ? enc(settings.pass) : ''
    }));
  } catch (e) {
    console.error('Falha ao salvar configurações:', e);
  }
}

function saveSettings(s) {
  if (s.url) {
    const u = new URL(s.url); // lança erro se não for um endereço válido
    if (!/^https?:$/.test(u.protocol)) throw new Error('O endereço precisa começar com http:// ou https://');
    settings.url = s.url.replace(/\/+$/, '');
  }
  if (typeof s.downloadsDir === 'string' && s.downloadsDir.trim()) settings.downloadsDir = s.downloadsDir.trim();
  if (typeof s.key === 'string' && s.key.trim()) settings.key = s.key.trim();
  persistSettings();
  foundCache.clear();
  return { dirExists: fs.existsSync(settings.downloadsDir) };
}

// ---------- chamadas à API do slskd (feitas aqui para a chave não ir para a interface) ----------
const ALLOWED_PATH = /^\/(searches|transfers\/downloads|application)(\/|\?|$)/;

async function slskRequest({ method, path: apiPath, body }) {
  if (typeof apiPath !== 'string' || !ALLOWED_PATH.test(apiPath) || apiPath.includes('..')) {
    return { ok: false, status: 0, error: 'Caminho da API não permitido.' };
  }
  const m = ['GET', 'POST', 'DELETE'].includes(method) ? method : 'GET';
  const headers = { 'X-API-Key': settings.key };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const r = await fetch(settings.url + '/api/v0' + apiPath, {
      method: m,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000)
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: r.ok, status: r.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      error: 'Não consegui conectar ao slskd em ' + settings.url + '. Ele está aberto?'
    };
  }
}

// ---------- achar o arquivo baixado na pasta de downloads ----------
const foundCache = new Map();
const baseName = (p) => String(p).split(/[\\/]/).pop();

function walkFiles(dir, fn, depth = 0) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth < 6) walkFiles(full, fn, depth + 1); }
    else fn(full, e.name);
  }
}

function findLocal(track) {
  const key = track.username + '|' + track.filename;
  const cached = foundCache.get(key);
  if (cached && fs.existsSync(cached)) return cached;

  const want = baseName(track.filename).toLowerCase();
  let best = null;
  let bestTime = 0;
  walkFiles(settings.downloadsDir, (full, name) => {
    if (name.toLowerCase() !== want) return;
    try {
      const st = fs.statSync(full);
      if ((!track.size || st.size === track.size) && st.mtimeMs > bestTime) { best = full; bestTime = st.mtimeMs; }
    } catch {}
  });
  if (best) foundCache.set(key, best);
  return best;
}

// ---------- cache: o que só foi ouvido some sozinho; salvas (♥) e de playlists ficam ----------
const CACHE_LIMIT = 5 * 1024 ** 3;

function pruneCache(keep) {
  const keepSet = new Set((Array.isArray(keep) ? keep : []).map((t) => baseName(t.filename).toLowerCase() + '|' + t.size));
  const files = [];
  let total = 0;
  walkFiles(settings.downloadsDir, (full, name) => {
    try {
      const st = fs.statSync(full);
      if (keepSet.has(name.toLowerCase() + '|' + st.size)) return; // salvas não contam no limite
      files.push({ full, size: st.size, t: st.mtimeMs });
      total += st.size;
    } catch {}
  });
  files.sort((a, b) => a.t - b.t); // ouvidas há mais tempo saem primeiro (o play atualiza a data)
  for (const f of files) {
    if (total <= CACHE_LIMIT) break;
    try { fs.unlinkSync(f.full); total -= f.size; } catch {}
  }
}

// ---------- imagem de fundo ----------
const BG_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const BG_RE = /^background-\d+\.(jpg|jpeg|png|webp)$/i;

function userBackground() {
  try {
    const files = fs.readdirSync(app.getPath('userData')).filter((f) => BG_RE.test(f)).sort();
    return files.length ? path.join(app.getPath('userData'), files[files.length - 1]) : null;
  } catch {
    return null;
  }
}

function backgroundUrl() {
  const f = userBackground();
  if (f) return pathToFileURL(f).href;
  const bundled = path.join(__dirname, 'renderer', 'background.jpg');
  return fs.existsSync(bundled) ? pathToFileURL(bundled).href : null;
}

async function chooseBackground() {
  const r = await dialog.showOpenDialog({
    title: 'Escolher imagem de fundo',
    properties: ['openFile'],
    filters: [{ name: 'Imagens', extensions: BG_EXT }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const src = r.filePaths[0];
  const ext = path.extname(src).slice(1).toLowerCase();
  if (!BG_EXT.includes(ext)) throw new Error('Use uma imagem JPG, PNG ou WEBP.');
  const old = userBackground();
  const dest = path.join(app.getPath('userData'), 'background-' + Date.now() + '.' + ext);
  fs.copyFileSync(src, dest);
  if (old) { try { fs.unlinkSync(old); } catch {} }
  return pathToFileURL(dest).href;
}

// ---------- slskd embutido (o usuário só faz login; o app cuida do resto) ----------
let slskdProc = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slskdAppDir = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'slskd');
const slskdBinDir = () => path.join(app.getPath('userData'), 'slskd-bin');

function findSlskdExe() {
  const dirs = [slskdBinDir(), path.join(os.homedir(), 'slskd')];
  const walk = (dir, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name.toLowerCase() === 'slskd.exe') return full;
    }
    if (depth < 3) {
      for (const e of entries) {
        if (e.isDirectory()) { const f = walk(path.join(dir, e.name), depth + 1); if (f) return f; }
      }
    }
    return null;
  };
  for (const d of dirs) { const f = walk(d, 0); if (f) return f; }
  return null;
}

async function downloadSlskd(send) {
  send('Baixando o motor de música (só na primeira vez)…');
  const rel = await (await fetch('https://api.github.com/repos/slskd/slskd/releases/latest', {
    headers: { 'User-Agent': 'roxy-app' }, signal: AbortSignal.timeout(30000)
  })).json();
  const asset = (rel.assets || []).find((a) => /win-x64\.zip$/.test(a.name));
  if (!asset) throw new Error('Não achei a versão do slskd para Windows. Verifique sua internet.');
  const r = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'roxy-app' } });
  if (!r.ok) throw new Error('Falha ao baixar o slskd (erro ' + r.status + ').');
  const zip = path.join(os.tmpdir(), asset.name);
  fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
  send('Instalando…');
  const dir = slskdBinDir();
  fs.mkdirSync(dir, { recursive: true });
  await new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command',
        'Expand-Archive -LiteralPath $env:ROXY_ZIP -DestinationPath $env:ROXY_DIR -Force; Get-ChildItem -Path $env:ROXY_DIR -Recurse -File | Unblock-File'],
      { env: { ...process.env, ROXY_ZIP: zip, ROXY_DIR: dir }, windowsHide: true },
      (err) => (err ? reject(new Error('Não consegui extrair o slskd: ' + err.message)) : resolve())
    );
  });
  try { fs.unlinkSync(zip); } catch {}
}

const yq = (v) => "'" + String(v).replace(/'/g, "''") + "'";

function writeSlskdConfig(user, pass) {
  const dir = slskdAppDir();
  fs.mkdirSync(dir, { recursive: true });
  const yml = path.join(dir, 'slskd.yml');
  if (fs.existsSync(yml) && !fs.existsSync(yml + '.bak')) fs.copyFileSync(yml, yml + '.bak');
  const lines = [
    'soulseek:',
    '  username: ' + yq(user),
    '  password: ' + yq(pass),
    'web:',
    '  authentication:',
    '    api_keys:',
    '      roxy:',
    '        key: ' + settings.key,
    '        role: readwrite',
    '        cidr: 127.0.0.1/32,::1/128',
    'directories:',
    '  downloads: ' + yq(path.join(dir, 'downloads'))
  ];
  fs.writeFileSync(yml, lines.join('\r\n') + '\r\n', 'utf8');
  settings.downloadsDir = path.join(dir, 'downloads');
}

async function connectSlskd(user, pass, send) {
  if (!user || !pass) throw new Error('Digite seu usuário e senha do Soulseek.');
  if (!settings.key) settings.key = crypto.randomBytes(32).toString('hex');
  settings.url = 'http://localhost:5030';

  send('Conectando…');
  const first = await slskRequest({ method: 'GET', path: '/application' });
  if (first.status === 401 || first.status === 403) {
    throw new Error('O slskd já está aberto com outra configuração. Feche-o (bandeja do Windows ou Gerenciador de Tarefas) e tente de novo.');
  }

  if (!first.ok) {
    let exe = findSlskdExe();
    if (!exe) { await downloadSlskd(send); exe = findSlskdExe(); }
    if (!exe) throw new Error('O slskd.exe não apareceu depois da instalação.');
    writeSlskdConfig(user, pass);
    send('Iniciando…');
    if (slskdProc) { try { slskdProc.kill(); } catch {} slskdProc = null; }
    slskdProc = spawn(exe, [], { cwd: path.dirname(exe), windowsHide: true, stdio: 'ignore' });
    let exited = false;
    slskdProc.on('exit', () => { exited = true; slskdProc = null; });
    slskdProc.on('error', () => { exited = true; });

    let up = false;
    for (let i = 0; i < 60 && !exited; i++) {
      await sleep(1000);
      const r = await slskRequest({ method: 'GET', path: '/application' });
      if (r.ok) { up = true; break; }
    }
    if (!up) throw new Error('O motor de música não iniciou. Se o Windows pediu permissão no Firewall, clique em Permitir e tente de novo.');
  }

  send('Entrando no Soulseek…');
  let last = null;
  for (let i = 0; i < 25; i++) {
    const r = await slskRequest({ method: 'GET', path: '/application' });
    const server = r.ok && r.data && r.data.server;
    if (!server) { last = null; break; } // formato desconhecido: segue em frente
    last = server;
    if (server.isLoggedIn === true || /LoggedIn/i.test(String(server.state || ''))) { last = null; break; }
    await sleep(1000);
  }
  if (last) throw new Error('Não consegui entrar no Soulseek (' + (last.state || 'sem conexão') + '). Confira usuário e senha.');

  settings.user = user;
  settings.pass = pass;
  foundCache.clear();
}

function stopSlskd() {
  if (slskdProc) { try { slskdProc.kill(); } catch {} slskdProc = null; }
}

// ---------- importar playlists do Spotify (login PKCE, sem chave secreta) ----------
const SPOTIFY_CLIENT_ID = '4baa7c4b5f0c46aaad9a95c0ba5e979f';
const SPOTIFY_PORT = 8898;
const SPOTIFY_REDIRECT = 'http://127.0.0.1:' + SPOTIFY_PORT + '/callback';
const SPOTIFY_SCOPE = 'playlist-read-private playlist-read-collaborative user-library-read';
let spotifyBusy = false;

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function callbackPage(ok) {
  return '<!doctype html><meta charset="utf-8"><title>Roxy</title><body style="font-family:Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0">' +
    '<div style="text-align:center"><h1 style="font-size:64px;margin:0">Roxy</h1><p>' +
    (ok ? 'Spotify conectado. Pode fechar esta aba e voltar para o app.' : 'Não deu certo. Feche esta aba e tente de novo no app.') +
    '</p></div>';
}

function spotifyAuthorize() {
  return new Promise((resolve, reject) => {
    const verifier = b64url(crypto.randomBytes(64));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));
    let finished = false;
    let timer;
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, SPOTIFY_REDIRECT);
      if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
      const code = u.searchParams.get('code');
      const ok = !!code && !u.searchParams.get('error') && u.searchParams.get('state') === state;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(callbackPage(ok));
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      server.close();
      if (ok) resolve({ code, verifier });
      else reject(new Error('O Spotify não autorizou o acesso (' + (u.searchParams.get('error') || 'cancelado') + ').'));
    });
    server.on('error', (e) => {
      if (finished) return;
      finished = true;
      reject(new Error(e.code === 'EADDRINUSE'
        ? 'A porta ' + SPOTIFY_PORT + ' está ocupada por outro programa. Feche-o e tente de novo.'
        : e.message));
    });
    server.listen(SPOTIFY_PORT, '127.0.0.1', () => {
      const q = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID, response_type: 'code', redirect_uri: SPOTIFY_REDIRECT,
        state, code_challenge_method: 'S256', code_challenge: challenge
      });
      if (SPOTIFY_SCOPE) q.set('scope', SPOTIFY_SCOPE);
      shell.openExternal('https://accounts.spotify.com/authorize?' + q.toString());
    });
    timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      server.close();
      reject(new Error('Tempo esgotado esperando o login no Spotify.'));
    }, 3 * 60 * 1000);
  });
}

async function spotifyToken({ code, verifier }) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: SPOTIFY_REDIRECT,
      client_id: SPOTIFY_CLIENT_ID, code_verifier: verifier
    }).toString()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Não consegui o acesso ao Spotify: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}

async function spotifyGet(token, url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429) {
      await sleep((Number(r.headers.get('retry-after')) || 2) * 1000 + 500);
      continue;
    }
    const data = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data };
  }
  return { ok: false, status: 429, data: null };
}

async function spotifyPages(token, url, onPage) {
  const out = [];
  while (url) {
    const r = await spotifyGet(token, url);
    if (!r.ok) return { ok: false, status: r.status, items: out };
    out.push(...(r.data.items || []));
    if (onPage) onPage(out.length, r.data.total);
    url = r.data.next;
  }
  return { ok: true, status: 200, items: out };
}

function toSlimTrack(t) {
  if (!t || t.type === 'episode' || t.is_local || !t.name) return null;
  return {
    id: t.id || t.uri || t.name,
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    duration: t.duration_ms || undefined
  };
}

let spotifyToken_ = null;
const LIKED_ID = '__liked__';

// Passo 1: login e lista das playlists disponíveis (sem baixar as faixas ainda).
async function spotifyList(send) {
  send('Abrindo o login do Spotify no navegador…');
  const auth = await spotifyAuthorize();
  spotifyToken_ = await spotifyToken(auth);

  send('Lendo suas playlists…');
  const pls = await spotifyPages(spotifyToken_, 'https://api.spotify.com/v1/me/playlists?limit=50');
  if (!pls.ok) {
    throw new Error(pls.status === 403
      ? 'O Spotify recusou o acesso. No modo de desenvolvimento, só a conta dona do app (ou usuários adicionados em "User Management" no painel) pode entrar, e o dono precisa ter Premium.'
      : 'Não consegui listar as playlists (erro ' + pls.status + ').');
  }
  const playlists = pls.items.filter(Boolean).map((p) => ({
    id: p.id,
    name: p.name,
    total: (p.items && p.items.total) ?? (p.tracks && p.tracks.total) ?? null,
    isPublic: p.public === true,
    owner: (p.owner && (p.owner.display_name || p.owner.id)) || ''
  }));

  const liked = await spotifyGet(spotifyToken_, 'https://api.spotify.com/v1/me/tracks?limit=1');
  if (liked.ok) playlists.unshift({ id: LIKED_ID, name: 'Músicas curtidas', total: liked.data.total ?? null, isPublic: false, owner: '' });
  return { playlists };
}

// Passo 2: baixa as faixas só das playlists escolhidas.
async function spotifyFetch(ids, nameById, send) {
  if (!spotifyToken_) throw new Error('A sessão do Spotify expirou. Clique em importar de novo.');
  const out = [];
  const skipped = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const name = nameById[id] || id;
    send('Lendo "' + name + '" (' + (i + 1) + ' de ' + ids.length + ')…');
    let r;
    if (id === LIKED_ID) {
      r = await spotifyPages(spotifyToken_, 'https://api.spotify.com/v1/me/tracks?limit=50', (n, total) =>
        send('Músicas curtidas: ' + n + (total ? ' de ' + total : '') + '…'));
    } else {
      r = await spotifyPages(spotifyToken_, 'https://api.spotify.com/v1/playlists/' + encodeURIComponent(id) + '/items?limit=50');
      if (!r.ok && r.status === 404) {
        r = await spotifyPages(spotifyToken_, 'https://api.spotify.com/v1/playlists/' + encodeURIComponent(id) + '/tracks?limit=50');
      }
    }
    if (r.status === 401) { spotifyToken_ = null; throw new Error('A sessão do Spotify expirou. Clique em importar de novo.'); }
    if (!r.ok) { skipped.push(name); continue; }
    const tracks = r.items.map((it) => toSlimTrack(it && (it.item || it.track))).filter(Boolean);
    if (tracks.length) out.push({ name, tracks });
  }
  return { playlists: out, skipped };
}

// ---------- janelas ----------
let mainWin = null;
let loginWin = null;

function baseWindow(opts) {
  const win = new BrowserWindow({
    title: 'Roxy',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    ...opts,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  return win;
}

function createLoginWindow() {
  loginWin = baseWindow({
    width: 1000, height: 620, minWidth: 820, minHeight: 540,
    backgroundColor: '#ffffff'
  });
  loginWin.on('closed', () => { loginWin = null; });
  loginWin.loadFile(path.join(__dirname, 'renderer', 'login.html'));
}

function createWindow() {
  mainWin = baseWindow({
    width: 1080, height: 720, minWidth: 820, minHeight: 560,
    backgroundColor: '#0c1210'
  });
  mainWin.on('closed', () => { mainWin = null; });
  mainWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  loadSettings();

  ipcMain.handle('auth:state', () => ({ remembered: settings.remember, user: settings.user }));
  ipcMain.handle('auth:login', async (e, p) => {
    p = p || {};
    const user = p.auto ? settings.user : String(p.user || '').trim();
    const pass = p.auto ? settings.pass : String(p.pass || '');
    try {
      await connectSlskd(user, pass, (m) => { try { e.sender.send('login:status', m); } catch {} });
      settings.remember = p.auto ? true : !!p.remember;
      persistSettings();
      createWindow();
      if (loginWin) loginWin.close();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });
  ipcMain.handle('auth:logout', () => {
    settings.user = ''; settings.pass = ''; settings.remember = false;
    persistSettings();
    stopSlskd();
    createLoginWindow();
    if (mainWin) mainWin.close();
  });

  const spotifyGuard = async (fn) => {
    if (spotifyBusy) return { ok: false, error: 'Já existe uma operação do Spotify em andamento.' };
    spotifyBusy = true;
    try { return { ok: true, ...(await fn()) }; }
    catch (err) { return { ok: false, error: err.message || String(err) }; }
    finally { spotifyBusy = false; }
  };
  ipcMain.handle('spotify:list', (e) =>
    spotifyGuard(() => spotifyList((m) => { try { e.sender.send('spotify:progress', m); } catch {} })));
  ipcMain.handle('spotify:fetch', (e, req) =>
    spotifyGuard(() => spotifyFetch(
      Array.isArray(req && req.ids) ? req.ids.map(String).slice(0, 500) : [],
      (req && req.names) || {},
      (m) => { try { e.sender.send('spotify:progress', m); } catch {} })));

  ipcMain.handle('slsk:getSettings', () => ({
    url: settings.url,
    downloadsDir: settings.downloadsDir,
    hasKey: !!settings.key
  }));
  ipcMain.handle('slsk:saveSettings', (_e, s) => saveSettings(s || {}));
  ipcMain.handle('slsk:request', (_e, req) => slskRequest(req || {}));
  ipcMain.handle('slsk:find', (_e, track) => {
    const f = findLocal(track || {});
    if (f) { try { const now = new Date(); fs.utimesSync(f, now, now); } catch {} }
    return f ? pathToFileURL(f).href : null;
  });
  ipcMain.handle('cache:prune', (_e, keep) => pruneCache(keep));
  ipcMain.handle('slsk:pickFolder', async () => {
    const r = await dialog.showOpenDialog({ title: 'Pasta de downloads do slskd', properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('bg:get', () => backgroundUrl());
  ipcMain.handle('bg:choose', () => chooseBackground());

  createLoginWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
  });
});

app.on('before-quit', stopSlskd);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
