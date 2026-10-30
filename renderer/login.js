const $ = (id) => document.getElementById(id);

function setStatus(msg, isError) {
  const s = $('status');
  s.textContent = msg || '';
  s.className = 'status' + (isError ? ' error' : '');
}

function busy(on) {
  $('go').disabled = on;
  $('user').disabled = on;
  $('pass').disabled = on;
}

async function login(payload) {
  busy(true);
  setStatus('Conectando…');
  const r = await window.api.authLogin(payload);
  if (r && r.ok) return; // a janela principal abre sozinha
  busy(false);
  $('auto').hidden = true;
  $('form').hidden = false;
  window.api.authState().then((s) => { if (s && s.user && !$('user').value) $('user').value = s.user; });
  setStatus((r && r.error) || 'Não foi possível entrar.', true);
}

window.api.onLoginStatus((m) => setStatus(m));

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  login({ user: $('user').value.trim(), pass: $('pass').value, remember: $('remember').checked });
});

(async function init() {
  const s = await window.api.authState();
  if (s && s.remembered) {
    $('form').hidden = true;
    $('auto').hidden = false;
    $('auto-text').textContent = 'Entrando como ' + s.user + '…';
    login({ auto: true });
  } else {
    $('user').focus();
  }
})();
