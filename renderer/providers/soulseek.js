const AUDIO_EXT = new Set(['mp3', 'flac', 'ogg', 'opus', 'wav', 'm4a', 'aac']);
const LOSSLESS = new Set(['flac', 'wav']);
const RACE = 3; // quantos usuários recebem o pedido da mesma faixa ao mesmo tempo
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
// como norm, mas mantém o que está entre parênteses ("Creep (Acoustic)" ≠ "Creep")
const loose = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const fileOf = (t) => ({ username: t.username, filename: t.filename, size: t.size, ext: t.ext, bitrate: t.bitrate, detail: t.detail });

// versões que quase nunca são o que a pessoa procura (a menos que ela tenha digitado a palavra)
const JUNK = new Set(['remix', 'mix', 'live', 'cover', 'karaoke', 'instrumental', 'acapella', 'acoustic', 'demo',
  'edit', 'version', 'slowed', 'reverb', 'sped', 'nightcore', 'tribute', 'rehearsal', 'bootleg', 'unplugged', '8d',
  'quartet', 'lullaby', 'covers']);
const LIVE_DATE = /(19|20)\d\d[-.]\d\d[-.]\d\d/; // pastas de show: "1993-10-08 - boston"

const folderTokens = (file) => new Set(loose(String(file).split(/[\\/]/).slice(-3, -1).join(' ')).split(' '));

// "Coldplay - Parachutes - 05 - Yellow.flac" → título "Yellow", artista "Coldplay"
function splitName(file) {
  const base = baseName(file).replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const parts = base.split(/\s+[-–—]+\s+/).map((s) => s.trim()).filter((s) => s && !/^\d{1,3}$/.test(s));
  // partes que só repetem o nome das pastas são artista/álbum ("Help Is Round the Corner - Coldplay")
  const folders = folderTokens(file);
  const own = parts.filter((p) => !loose(p).split(' ').every((w) => folders.has(w)));
  let title = own.length ? own[own.length - 1] : parts.length ? parts[parts.length - 1] : base;
  title = title.replace(/^\d{1,3}(?:\s*[-._)]\s*|\s+)/, '').trim() || title;
  return { title, artist: parts.length > 1 ? parts[0] : parentFolder(file) };
}

// Chave da música para juntar cópias: título sem números nem palavras que já estão nas pastas
// ("Radiohead Pablo Honey 02 Creep" em "Radiohead/Pablo Honey" vira "creep").
function songKey(title, file) {
  const folders = folderTokens(file);
  const all = loose(title).split(' ').filter((w) => w && !/^\d+$/.test(w));
  const own = all.filter((w) => !folders.has(w));
  return (own.length ? own : all).join(' ');
}

// Pontua um arquivo para a busca: termos no título, termos perto dele (pastas de artista/álbum), versões "lixo".
function relevance(qTok, title, file) {
  if (!qTok.length) return 0;
  const tTok = loose(title).split(' ').filter(Boolean);
  const folders = folderTokens(file);
  const hits = qTok.filter((w) => tTok.includes(w)).length;
  const junk = tTok.filter((w) => JUNK.has(w) && !qTok.includes(w)).length;
  const folderJunk = [...folders].some((w) => JUNK.has(w) && !qTok.includes(w)) || (LIVE_DATE.test(file) && !qTok.includes('live'));
  const extra = tTok.filter((w) => !qTok.includes(w) && !folders.has(w) && !/^\d+$/.test(w)).length;
  // "Creep (Radiohead)": o artista buscado entre parênteses no título é cover.
  const paren = loose((title.match(/[([{]([^)\]}]*)[)\]}]/) || [])[1]).split(' ').filter((w) => w && !/^\d+$/.test(w));
  const cover = paren.length && paren.every((w) => qTok.includes(w)) &&
    !loose(title.replace(/[([{].*?[)\]}]/g, ' ')).split(' ').some((w) => paren.includes(w));
  return (qTok.every((w) => tTok.includes(w) || folders.has(w)) ? 3 : 0) + 4 * hits / qTok.length
    - (hits ? 0 : 6) // nenhum termo no título: é outra faixa do mesmo álbum/single
    - 8 * junk - (folderJunk ? 5 : 0) - (cover ? 8 : 0) - Math.min(3, 0.5 * extra);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const baseName = (p) => String(p || '').split(/[\\/]/).pop();

function parentFolder(file) {
  const parts = String(file || '').split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : '';
}

function describeTransfer(f) {
  const st = String(f.state || '');
  if (/InProgress/i.test(st)) return 'Baixando… ' + Math.round(f.percentComplete || 0) + '%';
  if (/Queued,\s*Remotely/i.test(st)) return 'Na fila do outro usuário…';
  if (/Queued,\s*Locally/i.test(st)) return 'Na fila do slskd…';
  if (/Initializing/i.test(st)) return 'Iniciando o download…';
  if (/Requested/i.test(st)) return 'Pedindo o arquivo…';
  return st || 'Aguardando…';
}

class SoulseekProvider {
  constructor() {
    this.name = 'soulseek';
    this.handlers = {};
    this.job = 0;
    this.transfer = null; // download em andamento: { username, id }
    this.audio = document.getElementById('audio');
    this.audio.volume = 0.7;

    const a = this.audio;
    a.addEventListener('play', () => this.emit('playing', true));
    a.addEventListener('pause', () => { if (!a.ended) this.emit('playing', false); });
    a.addEventListener('ended', () => this.emit('end'));
    a.addEventListener('timeupdate', () => {
      this.emit('progress', a.currentTime * 1000, Number.isFinite(a.duration) ? a.duration * 1000 : 0);
    });
    a.addEventListener('error', () => {
      if (!a.getAttribute('src')) return;
      this.emit('error', 'Não foi possível tocar este arquivo (o formato pode não ser suportado).');
    });
  }

  on(evt, fn) { this.handlers[evt] = fn; }
  emit(evt, ...args) { if (this.handlers[evt]) this.handlers[evt](...args); }

  async _req(method, path, body) {
    const r = await window.api.slskRequest({ method, path, body });
    if (r.status === 0) throw new Error(r.error || 'Falha ao falar com o slskd.');
    return r;
  }

  _err(r, fallback) {
    if (r.status === 401 || r.status === 403) return 'O slskd recusou a chave de API. Confira a aba Conexão.';
    return fallback + ' (erro ' + r.status + ').';
  }

  // ----- busca -----
  async search(query, onProgress) {
    const start = await this._req('POST', '/searches', { searchText: query });
    if (!start.ok) throw new Error(this._err(start, 'A busca falhou'));
    const id = start.data && start.data.id;
    if (!id) throw new Error('O slskd não devolveu o identificador da busca.');

    let last = null;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      await sleep(1500);
      const r = await this._req('GET', '/searches/' + id + '?includeResponses=true');
      if (!r.ok) throw new Error(this._err(r, 'Não consegui ler os resultados'));
      last = r.data || {};
      if (onProgress) onProgress(last.fileCount || 0, last.responseCount || 0);
      if (last.isComplete) break;
    }
    this._req('DELETE', '/searches/' + id).catch(() => {});
    return this._toTracks((last && last.responses) || [], query);
  }

  // Uma linha por música: as cópias de vários usuários viram uma só (e fontes da corrida).
  // Ordem: relevância para a busca + popularidade (quantos usuários têm); dentro da música, a melhor versão.
  _toTracks(responses, query = '') {
    const qTok = loose(query).split(' ').filter(Boolean);
    const groups = new Map();
    for (const r of responses) {
      for (const f of r.files || []) {
        const name = f.filename || '';
        const ext = String(f.extension || name.split('.').pop() || '').replace('.', '').toLowerCase();
        if (!AUDIO_EXT.has(ext)) continue;
        const { title, artist } = splitName(name);
        const t = {
          source: 'soulseek',
          id: r.username + '|' + name,
          username: r.username,
          filename: name,
          size: f.size,
          ext,
          bitrate: f.bitRate,
          title,
          artist,
          duration: f.length ? f.length * 1000 : undefined,
          _quality: f.bitDepth && f.sampleRate
            ? f.bitDepth + '/' + +(f.sampleRate / 1000).toFixed(1)
            : f.bitRate ? f.bitRate + ' kbps' : '',
          _lossless: LOSSLESS.has(ext) ? 1 : 0,
          _ready: r.hasFreeUploadSlot && !r.queueLength ? 1 : 0,
          _hq: (f.bitDepth || 16) * (f.sampleRate || 44100) || f.bitRate || 0,
          _speed: r.uploadSpeed || 0,
          _score: relevance(qTok, title, name)
        };
        // mesma chave e duração parecida (±5 s) = mesma música; sem duração junta com a primeira
        const k = songKey(title, name);
        if (!groups.has(k)) groups.set(k, []);
        const clusters = groups.get(k);
        const c = clusters.find((x) => !t.duration || !x.ref || Math.abs(x.ref - t.duration) <= 5000);
        if (c) { c.files.push(t); c.ref = c.ref || t.duration; } else clusters.push({ ref: t.duration, files: [t] });
      }
    }

    const best = (a, b) => b._lossless - a._lossless || b._ready - a._ready || b._hq - a._hq || b._speed - a._speed;
    const rows = [...groups.values()].flat().map(({ files }) => {
      files.sort(best);
      const top = files[0];
      const users = new Set(files.map((x) => x.username)).size;
      // média (um arquivo mal nomeado não puxa o grupo) + popularidade
      const score = files.reduce((s, x) => s + x._score, 0) / files.length + 2 * Math.log2(users);
      // Fontes extras: outros usuários com a MESMA versão (mesmo formato e resolução), para não perder qualidade.
      const alts = files.filter((x, i, a) => x.username !== top.username && x.ext === top.ext && x._hq === top._hq &&
        a.findIndex((y) => y.username === x.username) === i).slice(0, RACE - 1);
      const mb = top.size ? (top.size / 1048576).toFixed(1) + ' MB' : '';
      const detail = [top.ext.toUpperCase() + (top._quality ? ' ' + top._quality : ''), mb,
        users > 1 ? users + ' usuários' : 'de ' + top.username].filter(Boolean).join(' · ');
      const clean = (x) => {
        const { _quality, _lossless, _ready, _hq, _speed, _score, ...t } = x;
        return t;
      };
      return { score, top, row: { ...clean(top), detail, alts: alts.map((x) => fileOf({ ...x, detail })) } };
    });
    rows.sort((a, b) => b.score - a.score || best(a.top, b.top));
    return rows.slice(0, 50).map((x) => x.row);
  }

  // ----- achar no Soulseek uma música vinda do Spotify (só título e artista) -----
  async findBest(track, onProgress) {
    const title = norm(track.title);
    const artist = norm(String(track.artist || '').split(',')[0]);
    const tTok = title.split(' ').filter(Boolean);
    const aTok = artist.split(' ').filter(Boolean);
    if (!tTok.length) return null;
    for (const q of [(artist + ' ' + title).trim(), title]) {
      const results = await this.search(q, onProgress);
      const ok = results.filter((r) => {
        const hay = norm(r.filename);
        return tTok.every((w) => hay.includes(w)) && (!aTok.length || aTok.some((w) => hay.includes(w)));
      });
      if (!ok.length) continue;
      const close = track.duration
        ? ok.filter((r) => r.duration && Math.abs(r.duration - track.duration) < 4000)
        : [];
      return close[0] || ok[0]; // já vem com as fontes extras da mesma versão
    }
    return null;
  }

  // ----- download e reprodução -----
  async play(track, onStatus) {
    const job = ++this.job;
    this._cancelTransfer();
    this.audio.pause();

    let url = await window.api.slskFind(track);
    if (!url) {
      await this._download(track, job, onStatus);
      if (job !== this.job) return;
      url = await window.api.slskFind(track);
      if (!url) {
        throw new Error('O download terminou, mas não achei o arquivo na pasta de downloads. Confira o caminho na aba Conexão.');
      }
    }
    if (job !== this.job) return;
    this.audio.src = url;
    await this.audio.play();
  }

  async _download(track, job, onStatus) {
    const files = [{ filename: track.filename, size: track.size }];
    const user = encodeURIComponent(track.username);
    let r = await this._req('POST', '/transfers/downloads/' + user, files);
    if (!r.ok && [404, 405, 410].includes(r.status)) {
      // Versões novas do slskd podem ter trocado o endpoint antigo pelo de lotes.
      r = await this._req('POST', '/transfers/downloads/batches', { username: track.username, files, options: {} });
    }
    if (!r.ok) throw new Error(this._err(r, 'Não consegui iniciar o download'));
    if (r.status === 200 && r.data && Array.isArray(r.data.failed) && r.data.failed.length) {
      throw new Error('O slskd não conseguiu colocar o arquivo na fila de download.');
    }

    const started = Date.now();
    while (job === this.job) {
      await sleep(1500);
      const s = await this._req('GET', '/transfers/downloads/' + user);
      const f = s.ok ? this._findTransfer(s.data, track.filename) : null;
      if (f) {
        this.transfer = { username: track.username, id: f.id };
        const st = String(f.state || '');
        if (/Succeeded/i.test(st)) { this.transfer = null; return; }
        if (/Completed/i.test(st)) {
          this.transfer = null;
          throw new Error('O download falhou (' + st + '). Tente outro resultado.');
        }
        if (onStatus) onStatus(describeTransfer(f));
      }
      if (Date.now() - started > 10 * 60 * 1000) {
        this._cancelTransfer();
        throw new Error('Tempo esgotado: o outro usuário pode estar offline ou com fila longa. Tente outro resultado.');
      }
    }
  }

  _findTransfer(data, filename) {
    const users = Array.isArray(data) ? data : data ? [data] : [];
    let found = null;
    for (const u of users) {
      for (const d of u.directories || []) {
        for (const f of d.files || []) {
          if (f.filename === filename) found = f;
        }
      }
    }
    return found;
  }

  _cancelTransfer() {
    const t = this.transfer;
    this.transfer = null;
    if (t && t.id) {
      this._req('DELETE', '/transfers/downloads/' + encodeURIComponent(t.username) + '/' + t.id).catch(() => {});
    }
  }

  pause() { this.audio.pause(); }
  resume() { this.audio.play().catch(() => {}); }
  seek(ms) { this.audio.currentTime = ms / 1000; }
  setVolume(v) { this.audio.volume = v; }
}

window.SoulseekProvider = SoulseekProvider;
