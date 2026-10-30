const AUDIO_EXT = new Set(['mp3', 'flac', 'ogg', 'opus', 'wav', 'm4a', 'aac']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const baseName = (p) => String(p || '').split(/[\\/]/).pop();

function cleanTitle(file) {
  const name = baseName(file).replace(/\.[^.]+$/, '');
  return name.replace(/^\s*\d{1,3}\s*[-._)]+\s*/, '').trim() || name;
}

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
    return this._toTracks((last && last.responses) || []);
  }

  _toTracks(responses) {
    const out = [];
    for (const r of responses) {
      for (const f of r.files || []) {
        const name = f.filename || '';
        const ext = String(f.extension || name.split('.').pop() || '').replace('.', '').toLowerCase();
        if (!AUDIO_EXT.has(ext)) continue;
        const mb = f.size ? (f.size / 1048576).toFixed(1) + ' MB' : '';
        const detail = [ext.toUpperCase() + (f.bitRate ? ' ' + f.bitRate + ' kbps' : ''), mb, 'de ' + r.username]
          .filter(Boolean).join(' · ');
        out.push({
          source: 'soulseek',
          id: r.username + '|' + name,
          username: r.username,
          filename: name,
          size: f.size,
          ext,
          bitrate: f.bitRate,
          title: cleanTitle(name),
          artist: parentFolder(name),
          detail,
          duration: f.length ? f.length * 1000 : undefined,
          _free: r.hasFreeUploadSlot ? 1 : 0,
          _queue: r.queueLength || 0,
          _speed: r.uploadSpeed || 0
        });
      }
    }
    // Quem tem vaga livre, fila curta e conexão rápida vem primeiro (baixa mais rápido).
    out.sort((a, b) => b._free - a._free || a._queue - b._queue || b._speed - a._speed);
    return out.slice(0, 60).map(({ _free, _queue, _speed, ...t }) => t);
  }

  // ----- achar no Soulseek uma música vinda do Spotify (só título e artista) -----
  async findBest(track, onProgress) {
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
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
      return (close[0] || ok[0]);
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
