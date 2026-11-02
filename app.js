/* Redline Leaderboard — static, offline-friendly fastest-lap board.
 * Operator view: index.html          Display view: index.html#display
 * Both windows sync instantly on the same machine (BroadcastChannel + localStorage).
 */
(function () {
  'use strict';

  var KEY = 'redline-leaderboard-v1';
  var chan = 'BroadcastChannel' in window ? new BroadcastChannel('redline-leaderboard') : null;
  var $ = function (id) { return document.getElementById(id); };

  function defaults() {
    return { title: 'Fastest Lap', subtitle: 'Redline Racing', session: 1, rows: 10,
      bestOnly: true, entries: [], archive: [], flash: null };
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.entries)) return Object.assign(defaults(), s);
    } catch (e) {}
    return defaults();
  }
  var state = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (chan) chan.postMessage(state);
    render();
  }
  if (chan) chan.onmessage = function (ev) { state = Object.assign(defaults(), ev.data); render(); };
  window.addEventListener('storage', function (ev) { if (ev.key === KEY) { state = load(); render(); } });

  /* ---------- time helpers ---------- */
  // Accepts 1:42.318 · 1.42.318 · 102.318 · 42.5  → milliseconds (or null)
  function parseTime(raw) {
    var s = String(raw).trim().replace(',', '.');
    var m = s.match(/^(\d{1,2})[:.](\d{1,2})(?:\.(\d{1,3}))?$/);
    if (m && (s.indexOf(':') > -1 || s.split('.').length === 3)) {
      var sec = +m[2];
      if (sec >= 60) return null;
      return (+m[1] * 60 + sec) * 1000 + fracMs(m[3]);
    }
    m = s.match(/^(\d{1,4})(?:\.(\d{1,3}))?$/);
    if (m) return +m[1] * 1000 + fracMs(m[2]);
    return null;
  }
  function fracMs(f) { return f ? Math.round(+('0.' + f) * 1000) : 0; }
  function fmt(ms) {
    var m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000), r = ms % 1000;
    return m + ':' + String(s).padStart(2, '0') + '.' + String(r).padStart(3, '0');
  }
  function fmtGap(ms) { return '+' + (ms / 1000).toFixed(3); }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function norm(n) { return n.trim().replace(/\s+/g, ' ').toLowerCase(); }

  function ranked() {
    var list = state.entries.slice();
    if (state.bestOnly) {
      var best = {};
      list.forEach(function (e) {
        var k = norm(e.name), b = best[k];
        if (!b || e.ms < b.ms || (e.ms === b.ms && e.ts < b.ts)) best[k] = e;
      });
      list = Object.keys(best).map(function (k) { return best[k]; });
    }
    return list.sort(function (a, b) { return a.ms - b.ms || a.ts - b.ts; });
  }

  /* ---------- render ---------- */
  var isDisplay = false, lastFlash = 0, flashTimer = null;

  function render() {
    document.title = isDisplay ? state.title + ' · Leaderboard' : 'Redline Leaderboard';
    if (isDisplay) renderDisplay(); else renderOperator();
  }

  function renderOperator() {
    var list = ranked(), lead = list[0];
    $('standings').innerHTML = list.map(function (e, i) {
      return '<tr class="' + (i === 0 ? 'p1' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(e.name) +
        '</td><td>' + esc(e.gear || '') + '</td><td class="t r">' + fmt(e.ms) +
        '</td><td class="gap r">' + (i ? fmtGap(e.ms - lead.ms) : '—') +
        '</td><td class="r"><button class="x" data-del="' + e.id + '" aria-label="Delete lap by ' + esc(e.name) + '">×</button></td></tr>';
    }).join('');
    $('emptyOp').hidden = list.length > 0;
    $('meta').textContent = 'Session ' + state.session + ' · ' + state.entries.length + ' laps · ' + list.length + ' on board';

    $('log').innerHTML = state.entries.slice().reverse().slice(0, 50).map(function (e) {
      var d = new Date(e.ts);
      return '<li><span class="clock">' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') +
        '</span><span>' + esc(e.name) + '</span><span class="t">' + fmt(e.ms) +
        '</span><button class="x" data-del="' + e.id + '" aria-label="Delete this lap">×</button></li>';
    }).join('') || '<li class="empty">Nothing yet.</li>';

    var names = {};
    state.entries.forEach(function (e) { names[norm(e.name)] = e.name; });
    $('drivers').innerHTML = Object.keys(names).map(function (k) { return '<option value="' + esc(names[k]) + '">'; }).join('');

    if (document.activeElement !== $('sTitle')) $('sTitle').value = state.title;
    if (document.activeElement !== $('sSub')) $('sSub').value = state.subtitle;
    if (document.activeElement !== $('sRows')) $('sRows').value = state.rows;
    $('sBest').checked = state.bestOnly;
  }

  function renderDisplay() {
    var list = ranked().slice(0, state.rows);
    $('dTitle').textContent = state.title;
    $('dSub').textContent = state.subtitle;
    $('dSession').textContent = 'Session ' + state.session;
    // row height scales so the chosen number of rows fills the screen
    $('dList').style.setProperty('--row', 'min(' + (58 / Math.max(list.length, 5)).toFixed(2) + 'vh, 4.2vw)');
    var freshId = state.flash && Date.now() - state.flash.ts < 4000 ? state.flash.id : (state.entries.length && Date.now() - state.entries[state.entries.length - 1].ts < 4000 ? state.entries[state.entries.length - 1].id : null);
    $('dList').innerHTML = list.map(function (e, i) {
      return '<li class="p' + (i + 1) + (e.id === freshId ? ' fresh' : '') + '"><span class="pos">' + (i + 1) +
        '</span><span class="nm">' + esc(e.name) + '</span><span class="gr">' + esc(e.gear || '') +
        '</span><span class="t">' + fmt(e.ms) + '</span></li>';
    }).join('');
    $('dEmpty').hidden = list.length > 0;

    var f = state.flash;
    if (f && f.ts > lastFlash && Date.now() - f.ts < 8000) {
      lastFlash = f.ts;
      $('dFlash').textContent = 'New fastest lap · ' + f.name + ' · ' + fmt(f.ms);
      $('dFlash').hidden = false;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () { $('dFlash').hidden = true; }, 7000);
    }
  }

  /* ---------- routing ---------- */
  function route() {
    isDisplay = location.hash === '#display';
    document.body.classList.toggle('display-mode', isDisplay);
    $('operator').hidden = isDisplay;
    $('display').hidden = !isDisplay;
    render();
  }
  window.addEventListener('hashchange', route);

  /* ---------- operator actions ---------- */
  function say(text, err) { var m = $('formMsg'); m.textContent = text; m.classList.toggle('err', !!err); }

  $('lapForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = $('name').value.trim().replace(/\s+/g, ' ');
    var ms = parseTime($('time').value);
    if (!name) { say('Add the driver name.', true); $('name').focus(); return; }
    if (ms == null || ms <= 0) { say('Lap time not recognised. Try 1:42.318', true); $('time').focus(); return; }
    // reuse the existing spelling of a returning driver's name
    var prev = state.entries.filter(function (e) { return norm(e.name) === norm(name); })[0];
    if (prev) name = prev.name;
    var gear = (document.querySelector('input[name=gear]:checked') || {}).value || '';
    var oldBest = state.entries.reduce(function (b, e) { return Math.min(b, e.ms); }, Infinity);
    var entry = { id: uid(), name: name, ms: ms, gear: gear, ts: Date.now() };
    state.entries.push(entry);
    if (ms < oldBest) state.flash = { id: entry.id, name: name, ms: ms, ts: entry.ts };
    save();
    var pos = ranked().indexOf(entry) + 1;
    say(name + ' · ' + fmt(ms) + (pos ? ' · P' + pos : ' · slower than their best') + (ms < oldBest ? ' · new fastest lap!' : ''));
    $('name').value = ''; $('time').value = ''; $('name').focus();
  });

  document.addEventListener('click', function (ev) {
    var id = ev.target.getAttribute && ev.target.getAttribute('data-del');
    if (!id) return;
    var e = state.entries.filter(function (x) { return x.id === id; })[0];
    if (e && confirm('Delete ' + e.name + ' · ' + fmt(e.ms) + '?')) {
      state.entries = state.entries.filter(function (x) { return x.id !== id; });
      if (state.flash && state.flash.id === id) state.flash = null;
      save();
    }
  });

  $('sTitle').addEventListener('input', function () { state.title = this.value || 'Fastest Lap'; save(); });
  $('sSub').addEventListener('input', function () { state.subtitle = this.value; save(); });
  $('sRows').addEventListener('change', function () { state.rows = Math.min(20, Math.max(3, +this.value || 10)); save(); });
  $('sBest').addEventListener('change', function () { state.bestOnly = this.checked; save(); });

  $('openDisplay').addEventListener('click', function () {
    window.open(location.pathname + location.search + '#display', 'redline-display');
  });

  $('newSession').addEventListener('click', function () {
    if (!state.entries.length) { state.session++; save(); return; }
    if (!confirm('Archive these ' + state.entries.length + ' laps and start session ' + (state.session + 1) + '?')) return;
    state.archive.push({ session: state.session, title: state.title, subtitle: state.subtitle, closed: Date.now(), entries: state.entries });
    state.entries = []; state.flash = null; state.session++;
    save();
  });

  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function stamp() { return new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-'); }
  function csvCell(v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  $('exportCsv').addEventListener('click', function () {
    var rows = [['Session', 'Position', 'Driver', 'Gearbox', 'Lap time', 'Milliseconds', 'Recorded']];
    var all = state.archive.concat([{ session: state.session, entries: state.entries }]);
    all.forEach(function (s) {
      var sorted = s.entries.slice().sort(function (a, b) { return a.ms - b.ms; });
      sorted.forEach(function (e, i) {
        rows.push([s.session, i + 1, e.name, e.gear || '', fmt(e.ms), e.ms, new Date(e.ts).toLocaleString()]);
      });
    });
    download('leaderboard-' + stamp() + '.csv', rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'), 'text/csv');
  });

  $('backup').addEventListener('click', function () {
    download('leaderboard-backup-' + stamp() + '.json', JSON.stringify(state, null, 2), 'application/json');
  });

  $('restore').addEventListener('change', function () {
    var file = this.files[0]; this.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!Array.isArray(data.entries)) throw new Error('bad file');
        if (!confirm('Replace the current board with this backup?')) return;
        state = Object.assign(defaults(), data); save();
      } catch (e) { alert('That file is not a leaderboard backup.'); }
    };
    reader.readAsText(file);
  });

  $('clearAll').addEventListener('click', function () {
    if (!confirm('Delete ALL laps, sessions and settings? Download a backup first if you need one.')) return;
    state = defaults(); save();
  });

  $('fsBtn').addEventListener('click', function () {
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
  });

  // refresh relative animations (fresh-row highlight) on the display
  setInterval(function () { if (isDisplay) renderDisplay(); }, 5000);

  window.__redline = { parseTime: parseTime, fmt: fmt }; // handy for testing in the console
  route();
})();
