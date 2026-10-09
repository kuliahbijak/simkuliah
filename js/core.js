/**
 * ============================================================================
 *  SIM KULIAH — core.js
 *  Lapisan inti SPA: penyimpanan lokal, API (fetch tahan jaringan HP), bootstrap
 *  stale-while-revalidate, router hash, shell (sidebar/topbar), modal, toast,
 *  penampil berkas in-app, grafik ringan (SVG), ekspor Excel/PDF (lazy).
 *  Pola gas-instant-ux-pro: login = bootstrap (1 panggilan), cache per-user,
 *  render hanya bila data berubah, optimistic UI + rollback, reqId idempoten.
 * ============================================================================
 */
(function () {
  'use strict';
  const CFG = window.SIMK_CONFIG || {};
  const LS = 'simk:' + (CFG.CACHE_VERSI || 'v1') + ':';

  // ------------------------------------------------------------------ util DOM
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function ic(n, cls) {
    const b = (window.ICONS || {})[n];
    if (!b) { console.warn('Ikon hilang:', n); return ''; }
    return '<svg class="svg-i ' + (cls || '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>';
  }
  const debounce = (fn, ms) => { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); }; };
  const idle = (fn, ms) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: ms || 2000 }) : setTimeout(fn, ms || 800));

  // ------------------------------------------------------------------ format
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BULAN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const ymd = (s) => { const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ''; };
  function todayYmd() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayDiff(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
  function fmtTgl(s, panjang) {
    const v = ymd(s); if (!v) return '-';
    const d = new Date(v + 'T00:00:00');
    return (panjang ? HARI[d.getDay()] + ', ' : '') + d.getDate() + ' ' + (panjang ? BULAN_P : BULAN)[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtWaktu(iso) { if (!iso) return '-'; const d = new Date(iso); if (isNaN(d)) return fmtTgl(iso); return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function fmtRel(iso) {
    if (!iso) return '-'; const d = new Date(iso); if (isNaN(d)) return fmtTgl(iso);
    const s = (Date.now() - d) / 1000;
    if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' menit lalu'; if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    if (s < 172800) return 'kemarin'; if (s < 604800) return Math.floor(s / 86400) + ' hari lalu'; return fmtTgl(d.toISOString());
  }
  function fmtSize(b) { b = Number(b || 0); if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
  function initials(n) { return String(n || '?').split(',')[0].replace(/\b(dr|prof|ir|drs|dra|h|hj)\.\s*/gi, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0] || '').join('').toUpperCase() || '?'; }
  const AV = ['#5B74DB', '#3F55A8', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#0EA5E9', '#14B8A6', '#F97316'];
  function avatar(nama, cls, foto) {
    let h = 0; const s = String(nama || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return '<span class="avatar ' + (cls || '') + '" style="background:' + AV[Math.abs(h) % AV.length] + '">' + (foto ? '<img src="' + esc(foto) + '" alt="" referrerpolicy="no-referrer">' : esc(initials(nama))) + '</span>';
  }
  const ROLE_LABEL = { OPERATOR: 'Operator Kelas', KETUA: 'Ketua Kelas', ANGGOTA: 'Anggota Kelas' };
  function chipJenis(j) { return j === 'P2K' ? '<span class="chip p2k">P2K</span>' : (j === 'Reguler' ? '<span class="chip reg">Reguler</span>' : ''); }
  function pct(a, b) { return b ? Math.round((a * 100) / b) : 0; }
  function hp08(v) { let s = String(v || '').replace(/[^0-9+]/g, '').replace(/^\+/, ''); if (!s) return ''; if (s.indexOf('62') === 0) s = '0' + s.slice(2); else if (s[0] === '8') s = '0' + s; return s; }
  const hpValid = (v) => /^08\d{8,12}$/.test(hp08(v));
  const emailValid = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim());
  function fileKind(nama, mime) {
    const e = (String(nama || '').match(/\.([a-z0-9]+)$/i) || [])[1] || '';
    const x = e.toLowerCase();
    if (mime === 'video/youtube') return { k: 'yt', ic: 'circle-play', label: 'Video' };
    if (x === 'pdf') return { k: 'pdf', ic: 'file-text', label: 'PDF' };
    if (/^docx?$/.test(x)) return { k: 'doc', ic: 'file-text', label: 'Word' };
    if (/^pptx?$/.test(x)) return { k: 'ppt', ic: 'presentation', label: 'PowerPoint' };
    if (/^(xlsx?|csv)$/.test(x)) return { k: 'xls', ic: 'file-spreadsheet', label: 'Excel' };
    if (x === 'epub') return { k: 'doc', ic: 'book-marked', label: 'E-book' };
    return { k: '', ic: 'file', label: x.toUpperCase() || 'Berkas' };
  }

  // ------------------------------------------------------------------ penyimpanan lokal
  const Store = {
    get(k, d) { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) {
      const s = JSON.stringify(v);
      try { localStorage.setItem(LS + k, s); } catch (e) {
        try { Object.keys(localStorage).filter((x) => x.indexOf(LS + 'u:') === 0 && x.indexOf(LS + userKey('')) !== 0).forEach((x) => localStorage.removeItem(x)); localStorage.setItem(LS + k, s); } catch (e2) { /* jalan tanpa cache */ }
      }
    },
    del(k) { try { localStorage.removeItem(LS + k); } catch (e) {} }
  };
  const userKey = (k) => 'u:' + (S.email || 'anon') + ':' + k;
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }

  // ------------------------------------------------------------------ state aplikasi
  const S = {
    token: Store.get('token', ''), email: Store.get('email', ''), foto: Store.get('foto', ''),
    boot: null, me: null, idx: null, jenis: Store.get('jenis', ''), page: null, param: null, branding: Store.get('branding', null)
  };

  // ------------------------------------------------------------------ pengukur performa
  const Perf = {
    rows: [],
    add(action, total, server, cached) { this.rows.push({ action, total, server: server == null ? null : server, net: server != null ? total - server : null, cache: cached ? '✓' : '', at: new Date().toLocaleTimeString() }); if (this.rows.length > 300) this.rows.shift(); },
    table() { console.table(this.rows.slice(-30)); },
    /** Rata-rata per aksi: Perf.summary() di Console. */
    summary() {
      const m = {};
      this.rows.forEach((r) => { const x = (m[r.action] = m[r.action] || { n: 0, total: 0, server: 0, cache: 0 }); x.n++; x.total += r.total; x.server += r.server || 0; if (r.cache) x.cache++; });
      console.table(Object.keys(m).map((k) => ({ aksi: k, n: m[k].n, 'rata total ms': Math.round(m[k].total / m[k].n), 'rata server ms': Math.round(m[k].server / m[k].n), 'cache✓': m[k].cache })));
    }
  };

  // ------------------------------------------------------------------ API
  const READ_ACTIONS = /^(ping|branding|wallpaper|boot|batch|foto\.list|file\.download|settings\.get|system\.status|audit\.list|notif\.(config|queue)|wa\.(audience|blastList|device)|crm\.(list|stats|detail|duplikat|export))$/;
  function newReqId() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)); }
  async function apiOnce(action, data, timeout, reqId) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
    try {
      const res = await fetch(CFG.GAS_URL, {
        method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },              // hindari CORS preflight
        body: JSON.stringify({ action, token: S.token || '', reqId: reqId || '', data: data || {} })
      });
      const text = await res.text();
      try { const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms, j.cached || (j.data && j.data.partial && !Object.keys(j.data.g || {}).length)); return j; }
      catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429 || res.status === 200, message: 'Server membalas HTTP ' + res.status + ' (bukan JSON). Periksa GAS_URL & deployment.' }; }
    } catch (err) {
      return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : (navigator.onLine === false ? 'Anda sedang offline. Periksa koneksi internet.' : 'Server tidak dapat dihubungi. Coba lagi sebentar lagi; bila berulang, hubungi Operator.') };
    } finally { clearTimeout(timer); }
  }
  function waitOnline(ms) { return new Promise((r) => { if (navigator.onLine !== false) return r(); const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); }); }
  // ---- v1.1 Turbo: ID sementara (simpan optimistis), dedupe baca, epoch tulis, antrean latar (drain)
  const APP_VER = '1.2.0';
  const TMP = {}, REAL = {};
  function tmpId() { return 'tmp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  /** Ganti ID sementara di payload dengan ID asli (menunggu simpan induknya selesai). */
  async function resolveTmp(data) {
    if (!data) return data;
    let s = JSON.stringify(data);
    const ids = s.match(/tmp_[a-z0-9]+/g);
    if (!ids) return data;
    for (const id of [...new Set(ids)]) {
      if (!TMP[id]) continue;
      const real = await TMP[id];
      if (!real) throw new Error('Data induk gagal disimpan, aksi dibatalkan.');
      s = s.split(id).join(real);
    }
    return JSON.parse(s);
  }
  const inflight = {}; let writeEpoch = 0;
  async function api(action, data, opt) {
    opt = opt || {};
    if (!CFG.GAS_URL || /GANTI_DENGAN/.test(CFG.GAS_URL)) return { success: false, message: 'GAS_URL belum diisi di js/config.js.' };
    try { data = await resolveTmp(data); } catch (e) { return { success: false, message: e.message }; }
    const isRead = READ_ACTIONS.test(action);
    if (!isRead) { writeEpoch++; return apiRun(action, data, opt, false); }
    const k = writeEpoch + '|' + action + '|' + JSON.stringify(data || {});          // baca identik → menumpang
    if (inflight[k]) return inflight[k];
    const p = apiRun(action, data, opt, true);
    inflight[k] = p; p.then(() => delete inflight[k], () => delete inflight[k]);
    return p;
  }
  let drainT = null, drainN = 0;
  function scheduleDrain() { clearTimeout(drainT); drainT = setTimeout(doDrain, 400); }
  async function doDrain() {
    drainN++;
    try { const r = await apiOnce('notif.drain', {}, 60000, ''); if (r && r.success && r.data && r.data.left > 0 && drainN < 4) { scheduleDrain(); return; } } catch (e) {}
    drainN = 0;
  }
  async function apiRun(action, data, opt, isRead) {
    const reqId = isRead ? '' : (opt.reqId || newReqId());
    const tries = isRead ? 3 : 2;
    let res;
    for (let i = 0; i < tries; i++) {
      if (i) { await new Promise((r) => setTimeout(r, 1200 * i)); if (navigator.onLine === false) await waitOnline(15000); }
      res = await apiOnce(action, data, isRead ? (i ? 40000 : 25000) : (opt.timeout || 90000), reqId);
      if (res.success || !res.retryable) break;
    }
    if (res && res.nq > 0) scheduleDrain();                                // notifikasi/job dikerjakan di latar
    if (!res.success && res.code === 'AUTH' && S.token && action !== 'auth.google') onSessionExpired(res.message);
    return res;
  }
  /**
   * Unggah berkas — v1.2: lewat fetch text/plain (permintaan "sederhana", TANPA CORS preflight).
   * v1.1 memakai XHR + xhr.upload.onprogress: listener unggah membuat browser mengirim preflight OPTIONS
   * yang tidak dijawab Google Apps Script → unggahan selalu gagal "Koneksi terputus". Progres kini diperkirakan
   * dari ukuran berkas (naik halus sampai 95%) dan menjadi 100% saat server selesai menyimpan.
   */
  function apiUpload(action, data, onProgress) {
    return resolveTmp(data).then((d) => apiUploadRun(action, d, onProgress), (e) => ({ success: false, message: e.message }));
  }
  function apiUploadRun(action, data, onProgress) {
    const reqId = newReqId(), size = String((data && data.base64) || '').length, t0 = Date.now();
    const est = Math.max(2500, size / 90);                                     // ±90 KB/dtk termasuk kerja server Drive
    let tm = null;
    if (onProgress) { onProgress(3); tm = setInterval(() => onProgress(Math.round(3 + 92 * (1 - Math.exp(-(Date.now() - t0) / est)))), 300); }
    const once = () => apiOnce(action, data, 300000, reqId);
    return once()
      .then((r) => (r.success || !r.retryable ? r : new Promise((ok) => setTimeout(ok, 1500)).then(once)))   // reqId sama → aman diulang
      .then((r) => { clearInterval(tm); if (onProgress) onProgress(100); if (r && r.nq > 0) scheduleDrain(); if (!r.success && r.code === 'AUTH') onSessionExpired(r.message); return r; });
  }
  /** Warmup server (GET ?w=pub|admin, tanpa data) — maks. 1×/4 menit per lingkup. */
  function warmUp(scope) {
    scope = scope === 'admin' ? 'admin' : 'pub';
    try {
      if (!CFG.GAS_URL || /GANTI_DENGAN/.test(CFG.GAS_URL)) return;
      const k = 'simk_warm_' + scope, t = Number(sessionStorage.getItem(k) || 0);
      if (Date.now() - t < 240000) return;
      sessionStorage.setItem(k, String(Date.now()));
    } catch (e) {}
    try { fetch(CFG.GAS_URL + '?w=' + scope + '&t=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (e) {}
  }

  // ------------------------------------------------------------------ bootstrap + indeks data
  function buildIdx(b) {
    const g = b.g, I = { mk: {}, ptm: {}, tugas: {}, mhs: {}, mhsEmail: {}, user: {}, dosen: {}, smt: {}, subs: {}, tugasByPtm: {}, ptmByMk: {}, notulenByPtm: {}, refByMk: {}, jadwalByMk: {}, todoStatus: {} };
    g.mk.forEach((x) => (I.mk[x.mk_id] = x));
    g.semester.forEach((x) => (I.smt[x.semester_id] = x));
    g.dosen.forEach((x) => (I.dosen[x.dosen_id] = x));
    (b.a ? b.a.mahasiswa : g.mahasiswa).forEach((x) => { I.mhs[x.mhs_id] = x; if (x.email) I.mhsEmail[String(x.email).toLowerCase()] = x; });
    (b.a ? b.a.users : g.users).forEach((x) => (I.user[x.user_id] = x));
    g.pertemuan.forEach((x) => { I.ptm[x.pertemuan_id] = x; (I.ptmByMk[x.mk_id] = I.ptmByMk[x.mk_id] || []).push(x); });
    Object.values(I.ptmByMk).forEach((a) => a.sort((p, q) => Number(p.nomor) - Number(q.nomor)));
    g.penugasan.forEach((x) => { I.tugas[x.tugas_id] = x; (I.tugasByPtm[x.pertemuan_id] = I.tugasByPtm[x.pertemuan_id] || []).push(x); });
    g.submission.forEach((x) => { const s = (I.subs[x.tugas_id] = I.subs[x.tugas_id] || {}); s[x.jenis_file === 'PPT' ? 'ppt' : 'makalah'] = x; });
    g.notulen.forEach((x) => (I.notulenByPtm[x.pertemuan_id] = I.notulenByPtm[x.pertemuan_id] || []).push(x));
    g.referensi.forEach((x) => (I.refByMk[x.mk_id] = I.refByMk[x.mk_id] || []).push(x));
    g.jadwal.forEach((x) => (I.jadwalByMk[x.mk_id] = I.jadwalByMk[x.mk_id] || []).push(x));
    (b.u.todoStatus || []).forEach((x) => (I.todoStatus[x.todo_id] = x));
    I.dibaca = {}; (b.u.dibaca || []).forEach((x) => (I.dibaca[x] = 1));
    return I;
  }
  function bootHash(b) { return hashStr(JSON.stringify([b.g, b.u, b.a, b.me])); }
  function setBoot(b, fromCache) {
    S.boot = b; S.me = b.me; S.idx = buildIdx(b);
    if (!fromCache) Store.set(userKey('boot'), { t: Date.now(), h: bootHash(b), data: b });
  }
  let refreshing = null;
  /** SWR: tampilkan cache seketika, segarkan bila lewat batas kesegaran / dipaksa. Render ulang hanya bila berubah. */
  function refreshBoot(force) {
    const c = Store.get(userKey('boot'), null);
    if (!force && c && Date.now() - c.t < 60000) return Promise.resolve(false);
    if (refreshing) return refreshing;
    const have = S.boot && S.boot.sv ? S.boot.sv : null;
    refreshing = api('boot', have ? { sv: have } : {}).then((res) => {
      refreshing = null;
      if (!res.success) { if (!S.boot) showBootError(res.message); return false; }
      const d = res.data;
      if (d.partial && S.boot) {                                   // v1.1: hanya seksi yang berubah dikirim server
        const meChanged = JSON.stringify(d.me) !== JSON.stringify(S.boot.me);
        const changed = Object.keys(d.g || {}).length > 0 || 'a' in d || d.u !== undefined || meChanged;
        Object.assign(S.boot.g, d.g || {});
        if ('a' in d) S.boot.a = d.a === null ? null : Object.assign(S.boot.a || {}, d.a);
        if (d.u !== undefined) S.boot.u = d.u;
        S.boot.me = d.me; S.boot.t = d.t; S.boot.sv = d.sv; S.me = S.boot.me;
        if (changed) { S.idx = buildIdx(S.boot); const gg = d.g || {}; if (meChanged || 'a' in d || gg.settings || gg.mk || gg.semester) renderShell(); rerender(); if (gg.settings) Foto.sync(); }
        Store.set(userKey('boot'), { t: Date.now(), h: bootHash(S.boot), data: S.boot });
        return changed;
      }
      const h = bootHash(d), changed = !c || c.h !== h || !S.boot;
      setBoot(d);
      if (changed) { renderShell(); rerender(); Foto.sync(); }
      return changed;
    });
    return refreshing;
  }
  /** Segarkan latar setelah simpan — ditunda selama masih ada simpanan yang belum selesai. */
  const scheduleRefresh = debounce(function again() { if (PENDING > 0) { setTimeout(again, 800); return; } refreshBoot(true); }, 2500);

  // ---- v1.1: indikator sinkron & simpan optimistis
  let PENDING = 0, syncT = null;
  function pend(delta, gagal) {
    PENDING = Math.max(0, PENDING + delta);
    const el = document.getElementById('syncChip'); if (!el) return;
    clearTimeout(syncT);
    if (PENDING > 0) { el.hidden = false; el.className = 'sync-chip'; el.innerHTML = '<span class="spin"></span>Menyimpan' + (PENDING > 1 ? ' (' + PENDING + ')' : '') + '…'; }
    else { el.hidden = false; el.className = 'sync-chip ' + (gagal ? 'err' : 'ok'); el.textContent = gagal ? 'Gagal disimpan' : '✓ Tersimpan'; syncT = setTimeout(() => (el.hidden = true), 1800); }
  }
  window.addEventListener('beforeunload', (e) => { if (PENDING > 0) { e.preventDefault(); e.returnValue = ''; } });
  /**
   * Simpan optimistis: tampilan berubah & modal tertutup SEKETIKA, server bekerja di latar.
   * o = { action, data, list: () => array, key, row, modal?, mirror?: () => array, prepend?, fromRes?, onLocal?, onSaved?, reopen?, msg? }
   * Data baru memakai ID sementara (tmp_…); aksi lanjutan atas data itu otomatis menunggu ID asli.
   */
  function saveLocal(o) {
    const lists = [o.list()].concat(o.mirror ? [o.mirror()] : []), key = o.key;
    const isNew = !o.row[key], id = isNew ? tmpId() : (REAL[o.row[key]] || o.row[key]);
    let resolveId = null;
    if (isNew) TMP[id] = new Promise((r) => (resolveId = (v) => { if (v) REAL[id] = v; r(v); }));
    const at = (arr, sid) => { let i = arr.findIndex((x) => x[key] === id); if (i < 0 && REAL[id]) i = arr.findIndex((x) => x[key] === REAL[id]); if (i < 0 && sid) i = arr.findIndex((x) => x[key] === sid); return i; };
    const prev = lists.map((arr) => { const i = at(arr); return i > -1 ? arr[i] : null; });
    const local = Object.assign({}, prev[0] || {}, o.row, { [key]: id, _pending: true });
    lists.forEach((arr) => { const i = at(arr); if (i > -1) arr[i] = Object.assign({}, arr[i], local, { [key]: arr[i][key] }); else if (o.prepend) arr.unshift(Object.assign({}, local)); else arr.push(Object.assign({}, local)); });
    if (o.onLocal) { try { o.onLocal(local); } catch (e) { console.error(e); } }
    if (o.modal) o.modal.close();                                  // tutup dulu → browser langsung melukis tanpa modal
    pend(1);
    const p = api(o.action, o.data);                               // kirim ke server tanpa menunggu render
    setTimeout(() => { S.idx = buildIdx(S.boot); rerender(); }, 0);
    return p.then((res) => {
      if (res.success) {
        const srow = o.fromRes ? o.fromRes(res.data) : res.data;
        lists.forEach((arr) => {
          const i = at(arr, srow && srow[key]);
          if (srow && typeof srow === 'object' && srow[key]) { if (i > -1) { arr[i] = Object.assign({}, arr[i], srow); delete arr[i]._pending; } else arr.push(Object.assign({}, srow)); }
          else if (i > -1) delete arr[i]._pending;
        });
        if (isNew) resolveId(srow && srow[key] ? srow[key] : null);
        if (o.onSaved) { try { o.onSaved(srow, res); } catch (e) { console.error(e); } }
        if (o.msg !== false) toast(o.msg || res.message || 'Tersimpan.', 'success');
        pend(-1);
      } else {
        lists.forEach((arr, li) => { const i = at(arr); if (prev[li]) { if (i > -1) arr[i] = prev[li]; } else if (i > -1) arr.splice(i, 1); });
        if (isNew) resolveId(null);
        toast((res.message || 'Gagal menyimpan.') + (o.reopen ? ' Formulir dibuka kembali.' : ''), 'error');
        pend(-1, true);
        if (o.reopen) { const draft = Object.assign({}, local, { [key]: isNew ? '' : (REAL[id] || id) }); delete draft._pending; setTimeout(() => o.reopen(draft), 250); }   // isian pengguna tidak hilang
      }
      S.idx = buildIdx(S.boot); rerender();
      scheduleRefresh();
      return res;
    });
  }

  /** Mutasi: optimistic → server → rollback bila gagal → segarkan latar. */
  async function mutate(action, data, o) {
    o = o || {};
    if (o.optimistic) { try { o.optimistic(); S.idx = buildIdx(S.boot); rerender(); } catch (e) { console.error(e); } }
    pend(1);
    const res = await api(action, data);
    pend(-1, !res.success);
    if (!res.success) {
      if (o.rollback) { try { o.rollback(); S.idx = buildIdx(S.boot); rerender(); } catch (e) {} }
      if (!o.silent) toast(res.message || 'Gagal menyimpan.', 'error');
      return res;
    }
    if (o.apply) { try { o.apply(res.data); S.idx = buildIdx(S.boot); rerender(); } catch (e) { console.error(e); } }
    if (!o.silent && (res.message || o.msg)) toast(res.message || o.msg, 'success');
    if (o.refresh !== false) scheduleRefresh();
    return res;
  }

  // ------------------------------------------------------------------ data turunan
  const D = {
    get g() { return S.boot.g; }, get u() { return S.boot.u; }, get a() { return S.boot.a; },
    isAdmin: () => !!S.me && (S.me.role === 'OPERATOR' || S.me.role === 'KETUA'),
    isOp: () => !!S.me && S.me.role === 'OPERATOR',
    smtAktifId: () => S.boot.g.settings.SEMESTER_AKTIF || ((S.boot.g.semester.find((s) => s.status_aktif === 'YA') || {}).semester_id || ''),
    smtAktif: () => S.idx.smt[D.smtAktifId()] || {},
    mkAktif: () => S.boot.g.mk.filter((m) => m.status_aktif !== 'TIDAK' && (!D.smtAktifId() || m.semester_id === D.smtAktifId())).sort((a, b) => String(a.kode).localeCompare(String(b.kode))),
    mhsList: (jenis) => Object.values(S.idx.mhs).filter((m) => m.status !== 'Nonaktif' && (!jenis || m.jenis_mahasiswa === jenis)).sort((a, b) => String(a.nama_lengkap).localeCompare(String(b.nama_lengkap))),
    namaUser: (id) => (S.idx.user[id] || {}).nama_lengkap || '—',
    namaMhs: (id) => (S.idx.mhs[id] || {}).nama_lengkap || '—',
    ptmOf: (t) => S.idx.ptm[t.pertemuan_id] || {},
    mkOfPtm: (p) => S.idx.mk[p.mk_id] || {},
    subs: (tid) => S.idx.subs[tid] || {},
    statusTugas(t) {
      const s = D.subs(t.tugas_id);
      if (s.makalah && s.ppt) return 'Terkumpul';
      const dl = ymd(t.deadline_makalah);
      if (dl && dl < todayYmd()) return 'Terlambat';
      return s.makalah || s.ppt ? 'Sebagian' : 'Ditugaskan';
    },
    tugasSaya: () => (S.me && S.me.mhs_id ? S.boot.g.penugasan.filter((t) => (t.petugas_ids || []).indexOf(S.me.mhs_id) > -1) : []),
    tugasMk: (mkId) => (S.idx.ptmByMk[mkId] || []).reduce((a, p) => a.concat(S.idx.tugasByPtm[p.pertemuan_id] || []), []),
    deadlineOf: (t) => ymd(t.deadline_makalah) || ymd(t.tanggal_presentasi),
    jenisFilter: () => (D.isAdmin() ? S.jenis : ''),
    tugasCocokJenis(t) { const j = D.jenisFilter(); if (!j) return true; return (t.petugas_ids || []).some((id) => (S.idx.mhs[id] || {}).jenis_mahasiswa === j); },
    unreadAnn: () => S.boot.g.pengumuman.filter((p) => !S.idx.dibaca[p.pengumuman_id] && annForMe(p)),
    pendingRegs: () => (S.boot.a ? S.boot.a.users.filter((u) => u.status_akun === 'Menunggu') : [])
  };
  function annForMe(p) { const j = S.me && S.me.jenis_mahasiswa; return D.isAdmin() || !(p.target === 'P2K' || p.target === 'Reguler') || p.target === j; }
  function statusChip(st) {
    const m = { Terkumpul: 'green', Sebagian: 'amber', Ditugaskan: 'blue', Terlambat: 'red', Selesai: 'green', Terjadwal: '', Berlangsung: 'blue', Dibatalkan: 'red',
      Tercapai: 'green', Proses: 'blue', Belum: '', Aktif: 'green', Nonaktif: 'red', Menunggu: 'amber', Ditolak: 'red', 'Tepat Waktu': 'green', Berisiko: 'red',
      Antri: 'amber', Terkirim: 'green', Gagal: 'red', Batal: '', Berjalan: 'blue', Dihentikan: 'red', Cuti: 'amber', Lulus: 'violet' };
    return '<span class="chip dot ' + (m[st] || '') + '">' + esc(st || '-') + '</span>';
  }

  // ------------------------------------------------------------------ router
  const Pages = {};
  const ADMIN_PAGES = ['master', 'mahasiswa', 'roles', 'settings', 'notif', 'crm'];
  function registerPage(name, def) { Pages[name] = Object.assign({ auth: 'member' }, def); }
  function go(name, param) { const h = '#/' + name + (param ? '/' + encodeURIComponent(param) : ''); if (location.hash === h) route(); else location.hash = h; }
  function allowed(def) { return def.auth === 'member' || (def.auth === 'admin' && D.isAdmin()) || (def.auth === 'op' && D.isOp()); }
  let adminLoading = null;
  function ensureAdmin() {
    if (window.SIMK_ADMIN_LOADED) return Promise.resolve();
    if (adminLoading) return adminLoading;
    adminLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/admin.js?v=' + APP_VER; s.onload = () => res(); s.onerror = () => { adminLoading = null; rej(new Error('Gagal memuat modul admin.')); }; document.head.appendChild(s); });
    return adminLoading;
  }
  async function route() {
    if (!S.token || !S.boot) return;
    let [name, param] = location.hash.replace(/^#\/?/, '').split('/');
    name = name || 'dashboard'; param = param ? decodeURIComponent(param) : '';
    let def = Pages[name];
    if (!def && ADMIN_PAGES.indexOf(name) > -1 && D.isAdmin()) {
      $('#view').innerHTML = '<div class="card"><div class="skel" style="height:220px"></div></div>';
      try { await ensureAdmin(); def = Pages[name]; } catch (e) { toast(e.message, 'error'); }
    }
    if (!def || !allowed(def)) { if (name !== 'dashboard') { location.replace('#/dashboard'); return; } def = Pages.dashboard; name = 'dashboard'; }
    const changed = S.page !== name || S.param !== param;
    S.page = name; S.param = param;
    let el = $('.page[data-page="' + name + '"]', $('#view'));
    if (!el) { el = document.createElement('section'); el.className = 'page'; el.dataset.page = name; $('#view').appendChild(el); }
    $$('.page', $('#view')).forEach((p) => (p.hidden = p !== el));
    $$('#view > :not(.page)').forEach((x) => x.remove());
    document.body.classList.remove('nav-open');
    markNav();
    try { def.show(el, param, changed); } catch (e) { console.error(e); el.innerHTML = '<div class="card alert err">' + ic('triangle-alert') + ' Terjadi kesalahan menampilkan halaman: ' + esc(e.message) + '</div>'; }
    document.title = (def.title ? (typeof def.title === 'function' ? def.title(param) : def.title) + ' — ' : '') + (S.boot.g.settings.NAMA_APLIKASI || 'SIM KULIAH');
    if (changed) window.scrollTo(0, 0);
  }
  /** Render ulang halaman aktif dari data lokal. Halaman yang mengelola datanya sendiri (formulir admin) tidak ditimpa. */
  function rerender(force) {
    if (!S.page || !Pages[S.page]) return;
    const el = $('.page[data-page="' + S.page + '"]', $('#view'));
    if (el && (force || !Pages[S.page].selfManaged)) { try { Pages[S.page].show(el, S.param, force ? true : false); } catch (e) { console.error(e); } }
    updateBadges();
  }
  /** Prefetch data menu admin dalam SATU eksekusi server (batch) saat browser senggang. */
  function prefetchAdmin() {
    if (!D.isAdmin()) return;
    const calls = [['notifcfg', 'notif.config', {}], ['blasts', 'wa.blastList', {}], ['crm', 'crm.list', { per: 0 }], ['queue', 'notif.queue', {}]];
    if (D.isOp()) calls.push(['settings', 'settings.get', {}], ['sys', 'system.status', {}], ['audit', 'audit.list', {}]);
    const need = calls.filter((c) => { const x = Store.get(userKey('a:' + c[0]), null); return !x || Date.now() - x.t > 60000; });
    if (!need.length) return;
    api('batch', { calls: need.map((c) => ({ action: c[1], data: c[2] })) }).then((res) => {
      if (!res.success || !res.data) return;
      need.forEach((c) => { const r = res.data[c[1]]; if (r && r.success) Store.set(userKey('a:' + c[0]), { t: Date.now(), data: r.data }); });
    });
  }

  // ------------------------------------------------------------------ shell
  function navItems() {
    const unread = D.unreadAnn().length, mk = D.mkAktif();
    const items = [
      { id: 'dashboard', ic: 'layout-dashboard', t: 'Dashboard' },
      { id: 'mk', ic: 'book-open', t: 'Mata Kuliah', pill: mk.length ? '<span class="pill green">' + mk.length + ' Aktif</span>' : '', sub: mk },
      { id: 'pengumuman', ic: 'megaphone', t: 'Pengumuman', pill: unread ? '<span class="pill amber" data-badge="ann">' + unread + '</span>' : '<span data-badge="ann"></span>' },
      { id: 'arsip', ic: 'library', t: 'Arsip Materi' },
      { id: 'rencana', ic: 'calendar-days', t: 'Rencana' },
      { id: 'direktori', ic: 'contact-round', t: 'Anggota & Dosen' },
      { id: 'laporan', ic: 'chart-column', t: 'Laporan' }
    ];
    if (D.isAdmin()) {
      const pend = D.pendingRegs().length;
      items.push({ sec: 'Pengelolaan' });
      items.push({ id: 'master', ic: 'database', t: 'Master Data', pill: pend ? '<span class="pill amber">' + pend + '</span>' : '' });
      items.push({ id: 'notif', ic: 'message-circle', t: 'Notifikasi & WA' });
      items.push({ id: 'crm', ic: 'contact', t: 'CRM Kontak' });
    }
    if (D.isOp()) {
      items.push({ id: 'roles', ic: 'user-cog', t: 'Role User', pill: '<span class="pill">Super</span>' });
      items.push({ id: 'settings', ic: 'settings', t: 'Pengaturan' });
    }
    return items;
  }
  function brandHtml(cls) {
    const g = S.boot ? S.boot.g.settings : {}, br = S.branding || {};
    const logo = br.logo ? '<img src="' + br.logo + '" alt="Logo">' : ic('graduation-cap');
    return '<div class="brand ' + (cls || '') + '"><span class="logo">' + logo + '</span><div class="txt"><div class="nm">' + esc(g.NAMA_APLIKASI || br.nama || 'SIM KULIAH') + '</div><div class="sub">' + esc(g.NAMA_INSTITUSI || br.institusi || '') + '</div></div></div>';
  }
  let mkOpen = Store.get('mkOpen', true);
  function renderShell() {
    if (!S.boot) return;
    const me = S.me;
    const nav = navItems().map((n) => {
      if (n.sec) return '<div class="sec">' + esc(n.sec) + '</div>';
      if (n.sub) {
        return '<a href="#/mk" data-nav="mk" data-toggle-mk title="' + esc(n.t) + '">' + ic(n.ic) + '<span class="lbl">' + esc(n.t) + '</span>' + (n.pill || '') + '</a>' +
          '<div class="submenu" ' + (mkOpen ? '' : 'hidden') + '>' + n.sub.map((m) => '<a href="#/mk/' + encodeURIComponent(m.mk_id) + '" data-nav="mk/' + esc(m.mk_id) + '" title="' + esc(m.nama) + '"><span class="lbl"><span class="kd">' + esc(m.kode) + '</span> ' + esc(m.nama) + '</span></a>').join('') + '</div>';
      }
      return '<a href="#/' + n.id + '" data-nav="' + n.id + '" title="' + esc(n.t) + '">' + ic(n.ic) + '<span class="lbl">' + esc(n.t) + '</span>' + (n.pill || '') + '</a>';
    }).join('');
    $('#sidebar').innerHTML = brandHtml() + '<nav class="nav">' + nav + '</nav>' +
      '<div class="sb-foot"><div class="role-card" title="' + esc(ROLE_LABEL[me.role]) + '">' + ic('shield-check') + '<span>' + esc(ROLE_LABEL[me.role]) + '</span><i class="on"></i></div>' +
      '<a href="#" class="btn text sb-out" style="color:#fff" data-logout>' + ic('log-out') + '<span>Keluar</span></a></div>';
    const smt = D.smtAktif();
    $('#topbar').innerHTML =
      '<button class="icon-btn burger" data-burger aria-label="Menu">' + ic('menu') + '</button>' +
      '<div class="searchbox" id="gsearch">' + ic('search') + '<input type="search" placeholder="Cari mahasiswa, NIM, mata kuliah, tema…" autocomplete="off" aria-label="Cari"><div class="search-res" hidden></div></div>' +
      '<div class="grow"></div>' +
      '<button class="icon-btn" data-search-open style="display:none" aria-label="Cari">' + ic('search') + '</button>' +
      (D.isAdmin() ? '<select class="top-sel" id="jenisSel" aria-label="Filter jenis mahasiswa"><option value="">Semua Mahasiswa</option><option value="P2K">Mahasiswa P2K</option><option value="Reguler">Mahasiswa Reguler</option></select>' : '') +
      (smt.nama_semester ? '<span class="smt-pill">' + ic('graduation-cap') + esc(smt.nama_semester) + '</span>' : '') +
      '<span class="sync-chip" id="syncChip" hidden></span>' +
      (appLinks().length || D.isOp() ? '<div style="position:relative"><button class="icon-btn" data-apps aria-label="Aplikasi lain" title="Aplikasi lain">' + ic('layout-grid') + '</button></div>' : '') +
      '<div style="position:relative"><button class="icon-btn" data-bell aria-label="Notifikasi">' + ic('bell') + '<i class="ping" hidden></i></button></div>' +
      '<div style="position:relative"><button class="me-btn" data-me>' + avatar(me.nama_lengkap, '', fotoSaya()) + '<span class="t"><span class="nm">' + esc(me.nama_lengkap) + '</span><br><span class="rl">' + esc(ROLE_LABEL[me.role]) + '</span></span></button></div>';
    if ($('#jenisSel')) $('#jenisSel').value = S.jenis;
    if (window.matchMedia('(max-width:767px)').matches) $('[data-search-open]').style.display = 'grid';
    markNav(); updateBadges();
  }
  function markNav() {
    const cur = S.page === 'mk' && S.param ? 'mk/' + S.param : S.page;
    $$('#sidebar [data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === cur || (a.dataset.nav === S.page && !(S.page === 'mk' && S.param))));
  }
  function notifItems() {
    const out = [], t = todayYmd();
    D.tugasSaya().forEach((x) => {
      if (D.statusTugas(x) === 'Terkumpul') return;
      const dl = D.deadlineOf(x); if (!dl) return; const sisa = dayDiff(t, dl);
      if (sisa >= -3 && sisa <= 7) out.push({ ic: 'clock', amber: sisa <= 3, t: (sisa < 0 ? 'Terlambat ' + -sisa + ' hari' : sisa === 0 ? 'Hari ini' : 'H-' + sisa) + ' · ' + x.tema, s: (D.mkOfPtm(D.ptmOf(x)).nama || '') + ' — unggah Makalah & PPT', href: '#/mk/' + D.ptmOf(x).mk_id + '/' });
    });
    D.unreadAnn().slice(0, 5).forEach((p) => out.push({ ic: 'megaphone', t: p.judul, s: fmtRel(p.tanggal), ann: p.pengumuman_id }));
    if (D.isAdmin() && D.pendingRegs().length) out.push({ ic: 'user-plus', amber: true, t: D.pendingRegs().length + ' pendaftar menunggu verifikasi', s: 'Master Data → Verifikasi', href: '#/master' });
    return out;
  }
  function updateBadges() {
    if (!S.boot) return;
    const n = D.unreadAnn().length, b = $('[data-badge="ann"]');
    if (b) { b.className = n ? 'pill amber' : ''; b.textContent = n || ''; }
    const ping = $('[data-bell] .ping'); if (ping) ping.hidden = !notifItems().length;
  }
  function closeDropdowns() { $$('.dropdown').forEach((d) => d.remove()); }
  function openDropdown(anchor, html, cls) {
    closeDropdowns();
    const d = document.createElement('div'); d.className = 'dropdown ' + (cls || ''); d.innerHTML = html;
    anchor.parentElement.appendChild(d);
    setTimeout(() => document.addEventListener('click', function h(e) { if (!d.contains(e.target)) { d.remove(); document.removeEventListener('click', h); } }), 0);
    return d;
  }

  // ------------------------------------------------------------------ pencarian global
  function searchIndex(q) {
    q = q.toLowerCase(); const res = [];
    const add = (grp, ic2, t, s, href) => res.push({ grp, ic: ic2, t, s, href });
    D.mkAktif().forEach((m) => { if ((m.nama + ' ' + m.kode).toLowerCase().indexOf(q) > -1) add('Mata Kuliah', 'book-open', m.nama, m.kode, '#/mk/' + m.mk_id); });
    D.mhsList().forEach((m) => { if ((m.nama_lengkap + ' ' + (m.nim || '') + ' ' + m.email).toLowerCase().indexOf(q) > -1) add('Mahasiswa', 'users', m.nama_lengkap, (m.nim || m.email) + ' · ' + (m.jenis_mahasiswa || ''), D.isAdmin() ? '#/mahasiswa/' + m.mhs_id : '#/direktori/' + m.mhs_id); });
    S.boot.g.dosen.forEach((d) => { if ((d.nama + ' ' + (d.bidang || '')).toLowerCase().indexOf(q) > -1) add('Dosen', 'user-round', d.nama, d.bidang || 'Dosen pengampu', '#/direktori/' + d.dosen_id); });
    S.boot.g.penugasan.forEach((t) => { if (String(t.tema).toLowerCase().indexOf(q) > -1) { const p = D.ptmOf(t); add('Tema Presentasi', 'presentation', t.tema, (D.mkOfPtm(p).nama || '') + ' · Pertemuan ' + p.nomor, '#/mk/' + p.mk_id); } });
    S.boot.g.pengumuman.forEach((p) => { if ((p.judul + ' ' + p.isi).toLowerCase().indexOf(q) > -1) add('Pengumuman', 'megaphone', p.judul, fmtRel(p.tanggal), '#/pengumuman'); });
    return res.slice(0, 24);
  }
  const doSearch = debounce((inp) => {
    const box = inp.parentElement.querySelector('.search-res'), q = inp.value.trim();
    if (q.length < 2) { box.hidden = true; return; }
    const r = searchIndex(q); let grp = '';
    box.innerHTML = r.length ? r.map((x) => (x.grp !== grp ? '<div class="grp">' + esc((grp = x.grp)) + '</div>' : '') + '<a href="' + x.href + '">' + ic(x.ic) + '<span class="grow"><b class="semi">' + esc(x.t) + '</b><br><span class="small muted">' + esc(x.s) + '</span></span></a>').join('') : '<div class="empty">Tidak ditemukan.</div>';
    box.hidden = false;
  }, 200);

  // ------------------------------------------------------------------ modal & toast
  const modalStack = [];
  function modal(o) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal ' + (o.size || '') + ' ' + (o.cls || '') + '" role="dialog" aria-modal="true">' +
      (o.title !== undefined ? '<div class="modal-h">' + (o.icon ? '<span class="mi">' + ic(o.icon) + '</span>' : '') + '<div class="grow"><h3>' + esc(o.title) + '</h3>' + (o.sub ? '<div class="sub">' + o.sub + '</div>' : '') + '</div><button class="btn icon ghost modal-x" data-close aria-label="Tutup">' + ic('x') + '</button></div>' : '') +
      '<div class="modal-b">' + (o.body || '') + '</div>' + (o.foot ? '<div class="modal-f">' + o.foot + '</div>' : '') + '</div>';
    $('#modals').appendChild(bg);
    const m = { el: bg, body: $('.modal-b', bg), foot: $('.modal-f', bg), closed: false,
      close(v) { if (m.closed) return; m.closed = true; bg.remove(); modalStack.splice(modalStack.indexOf(m), 1); if (o.onClose) o.onClose(v); } };
    bg.addEventListener('click', (e) => { if (e.target === bg && !o.static) m.close(); if (e.target.closest('[data-close]')) m.close(); });
    modalStack.push(m);
    const f = $('input:not([type=hidden]):not([readonly]), textarea, select', m.body); if (f && !o.noFocus && window.innerWidth > 767) setTimeout(() => f.focus(), 50);
    return m;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close(); });
  function confirmDlg(title, msg, o) {
    o = o || {};
    return new Promise((res) => {
      const m = modal({ title, icon: o.icon || (o.danger ? 'triangle-alert' : 'circle-help'), size: 'sm', body: '<p class="muted" style="margin:0;line-height:1.6">' + msg + '</p>',
        foot: '<button class="btn ghost" data-close>Batal</button><button class="btn ' + (o.danger ? 'danger solid' : '') + '" data-ok>' + esc(o.ok || 'Ya, lanjutkan') + '</button>', onClose: (v) => res(!!v) });
      $('[data-ok]', m.el).onclick = () => m.close(true);
    });
  }
  function toast(msg, type, title) {
    type = type || 'success';
    const t = document.createElement('div'); t.className = 'toast ' + type;
    const icn = { success: 'circle-check', error: 'triangle-alert', info: 'info', warn: 'clock' }[type];
    t.innerHTML = '<span class="ti">' + ic(icn) + '</span><div class="grow">' + (title ? '<b>' + esc(title) + '</b><br>' : '') + '<span>' + esc(msg) + '</span></div><button class="btn icon sm text" aria-label="Tutup">' + ic('x') + '</button>';
    $('#toasts').appendChild(t);
    const rm = () => t.remove(); t.querySelector('button').onclick = rm; setTimeout(rm, type === 'error' ? 7000 : 4000);
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn._html = btn.innerHTML; btn.classList.add('loading'); btn.innerHTML = '<span class="spin"></span>' + (label ? esc(label) : btn.textContent.trim()); }
    else { btn.classList.remove('loading'); if (btn._html) btn.innerHTML = btn._html; }
  }
  /** Kumpulkan nilai form berdasarkan atribut name. */
  function formData(root) {
    const o = {};
    $$('[name]', root).forEach((el) => {
      const n = el.name;
      if (el.type === 'checkbox') { if (el.dataset.multi !== undefined) { o[n] = o[n] || []; if (el.checked) o[n].push(el.value); } else o[n] = el.checked; }
      else if (el.type === 'radio') { if (el.checked) o[n] = el.value; else if (!(n in o)) o[n] = ''; }
      else o[n] = el.value;
    });
    return o;
  }
  function radioCards(root) {
    $$('.radio-card input', root).forEach((r) => r.addEventListener('change', () => $$('.radio-card input[name="' + r.name + '"]', root).forEach((x) => x.closest('.radio-card').classList.toggle('on', x.checked))));
  }

  // ------------------------------------------------------------------ berkas
  function readFile(file, opt) {
    opt = opt || {};
    return new Promise((res, rej) => {
      const ext = ((file.name.match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
      if (opt.ext && opt.ext.indexOf(ext) < 0) return rej(new Error('Tipe .' + ext + ' tidak diizinkan. Gunakan ' + opt.ext.join(', ').toUpperCase() + '.'));
      if (opt.max && file.size > opt.max) return rej(new Error('Ukuran ' + fmtSize(file.size) + ' melebihi batas ' + fmtSize(opt.max) + '.'));
      const r = new FileReader();
      r.onload = () => res({ nama_file: file.name, mime: file.type || 'application/octet-stream', base64: String(r.result).split(',')[1] || '', ukuran: file.size });
      r.onerror = () => rej(new Error('Gagal membaca berkas.'));
      r.readAsDataURL(file);
    });
  }
  function b64ToBlob(b64, mime) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || 'application/octet-stream' }); }
  function saveBlob(blob, nama) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  async function downloadFile(fileId, nama, btn) {
    busy(btn, true, 'Mengunduh…'); toast('Menyiapkan unduhan ' + (nama || '') + '…', 'info');
    const r = await api('file.download', { file_id: fileId }, { timeout: 120000 });
    busy(btn, false);
    if (!r.success) return toast(r.message, 'error');
    saveBlob(b64ToBlob(r.data.base64, r.data.mime), r.data.nama || nama || 'berkas');
  }
  /**
   * Penampil in-app: berkas Drive & video YouTube dibuka di MODAL, tidak ada tab baru.
   * iframe di-sandbox tanpa allow-popups → tombol "buka di jendela baru" bawaan Drive/YouTube tidak bisa membuka tab.
   */
  function openViewer(o) {
    const kind = fileKind(o.nama, o.mime);
    const isYt = !!o.embed;
    const src = isYt ? o.embed + '?rel=0&modestbranding=1' : 'https://drive.google.com/file/d/' + encodeURIComponent(o.fileId) + '/preview';
    const m = modal({
      title: o.title || o.nama, sub: esc([kind.label, fmtSize(o.ukuran), o.info].filter(Boolean).join(' · ')), icon: kind.ic, size: 'xl', cls: 'viewer', noFocus: true,
      body: '<div class="viewer-body"><div class="loader"><span class="spin" style="width:28px;height:28px;border-width:3px"></span></div>' +
        '<iframe src="' + esc(src) + '" title="Pratinjau" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" ' +
        'sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>',
      foot: (isYt ? '' : '<span class="small muted grow" style="align-self:center">Tidak tampil? Pastikan Anda masuk Google dengan email terdaftar, atau gunakan mode alternatif.</span><button class="btn ghost sm" data-alt>' + ic('refresh-cw') + 'Mode alternatif</button>' +
        (o.download !== false ? '<button class="btn sm" data-dl>' + ic('download') + 'Unduh</button>' : '')) + '<button class="btn ghost sm" data-close>Tutup</button>'
    });
    m.body.style.padding = '0';
    const fr = $('iframe', m.el); fr.addEventListener('load', () => { const l = $('.loader', m.el); if (l) l.remove(); });
    const dl = $('[data-dl]', m.el); if (dl) dl.onclick = () => downloadFile(o.fileId, o.nama, dl);
    const alt = $('[data-alt]', m.el);
    if (alt) alt.onclick = async () => {
      busy(alt, true, 'Memuat…');
      const r = await api('file.download', { file_id: o.fileId }, { timeout: 120000 });
      busy(alt, false);
      if (!r.success) return toast(r.message, 'error');
      const mime = r.data.mime || '';
      const vb = $('.viewer-body', m.el);
      if (/pdf|image\//.test(mime)) { const url = URL.createObjectURL(b64ToBlob(r.data.base64, mime)); vb.innerHTML = /image\//.test(mime) ? '<div style="height:100%;display:grid;place-items:center;overflow:auto"><img src="' + url + '" alt=""></div>' : '<iframe src="' + url + '" title="PDF"></iframe>'; }
      else vb.innerHTML = '<div class="empty" style="color:#fff;padding-top:120px">' + ic('file') + '<br>Pratinjau alternatif hanya untuk PDF & gambar.<br>Gunakan tombol <b>Unduh</b> untuk membuka berkas ' + esc(kind.label) + '.</div>';
    };
    return m;
  }


  // ================================================================== v1.2 — FOTO PROFIL & POPUP PROFIL
  /** Foto disimpan terpisah dari data boot (tidak memperberat buka aplikasi): peta id → data URL, di-cache per perangkat. */
  const Foto = {
    ver: '', map: {}, loading: null,
    init() { const c = Store.get('fotoMap', null); if (c && c.map) { this.ver = c.ver || ''; this.map = c.map; } },
    of(id) { return id ? this.map[id] || '' : ''; },
    simpan() { Store.set('fotoMap', { ver: this.ver, map: this.map }); },
    set(id, foto, ver) { if (foto) this.map[id] = foto; else delete this.map[id]; if (ver) this.ver = ver; this.simpan(); },
    sync(force) {
      const v = S.boot && S.boot.g && S.boot.g.settings && S.boot.g.settings.FOTO_VER;
      if (!v || this.loading || (!force && v === this.ver)) return this.loading || Promise.resolve(false);
      this.loading = api('foto.list').then((r) => {
        this.loading = null;
        if (!r.success || !r.data) return false;
        this.ver = r.data.ver || v; this.map = r.data.map || {}; this.simpan();
        if (S.boot) { renderShell(); rerender(); }
        return true;
      });
      return this.loading;
    }
  };
  Foto.init();
  function mhsOfUser(u) { return u && u.email && S.idx ? S.idx.mhsEmail[String(u.email).toLowerCase()] || null : null; }
  function avProf(kind, id, nama, cls, foto, klik) {
    const a = avatar(nama, cls, foto);
    return klik === false || !id ? a : '<span class="av-link" data-prof="' + kind + ':' + esc(id) + '" role="button" tabindex="0" title="Lihat profil ' + esc(nama || '') + '">' + a + '</span>';
  }
  const avMhs = (m, cls, klik) => avProf('mhs', m && m.mhs_id, m && m.nama_lengkap, cls, Foto.of(m && m.mhs_id), klik);
  const avDsn = (d, cls, klik) => avProf('dsn', d && d.dosen_id, d && d.nama, cls, Foto.of(d && d.dosen_id), klik);
  function avUsr(u, cls, klik) {
    const m = mhsOfUser(u);
    if (m) return avProf('mhs', m.mhs_id, (u && u.nama_lengkap) || m.nama_lengkap, cls, Foto.of(m.mhs_id), klik);
    return avProf('usr', u && u.user_id, u && u.nama_lengkap, cls, Foto.of(u && u.user_id), klik);
  }
  /** Nama yang bisa diklik → popup profil. */
  function profLink(kind, id, nama) { return id ? '<a href="#" class="prof-link" data-prof="' + kind + ':' + esc(id) + '">' + esc(nama || '-') + '</a>' : esc(nama || '-'); }
  function fotoSaya() { return Foto.of(S.me && S.me.mhs_id) || Foto.of(S.me && S.me.user_id) || S.foto; }
  function waLink(hp, pesan) { const s = hp08(hp); return s && s.length > 8 ? 'https://wa.me/62' + s.slice(1) + (pesan ? '?text=' + encodeURIComponent(pesan) : '') : ''; }
  function kontakHtml(hp, email, nama) {
    const sapa = 'Halo ' + String(nama || '').split(/[\s,]+/)[0] + ', ';
    const wa = waLink(hp, sapa);
    return '<div class="prof-cta">' +
      (wa ? '<a class="btn wa" href="' + esc(wa) + '" target="_blank" rel="noopener" data-kontak="wa">' + ic('message-circle') + 'WhatsApp</a>' : '<span class="btn ghost off" title="Nomor WhatsApp belum diisi">' + ic('message-circle') + 'WhatsApp belum ada</span>') +
      (email ? '<a class="btn ghost" href="mailto:' + esc(email) + '" data-kontak="email">' + ic('mail') + 'Email</a>' : '<span class="btn ghost off">' + ic('mail') + 'Email belum ada</span>') + '</div>';
  }
  function infoRow(icn, lbl, val) { return val ? '<div class="prof-row">' + ic(icn) + '<span class="muted">' + esc(lbl) + '</span><b>' + val + '</b></div>' : ''; }
  function profHead(foto, nama, chips, sub, ubahFoto) {
    return '<div class="prof-head"><div class="prof-ph">' + (foto ? '<img src="' + esc(foto) + '" alt="">' : '<span class="ini">' + esc(initials(nama)) + '</span>') +
      (ubahFoto ? '<button class="prof-cam" data-foto title="Ganti foto">' + ic('camera') + '</button>' : '') + '</div>' +
      '<div style="min-width:0"><h2>' + esc(nama || '-') + '</h2>' + (sub ? '<div class="small muted mt8">' + sub + '</div>' : '') + '<div class="row wrap gap6 mt8">' + chips + '</div></div></div>';
  }
  function bindFotoBtn(md, pemilikId, nama, reopen) {
    const b = $('[data-foto]', md.el); if (!b) return;
    b.onclick = () => pilihFoto(pemilikId, nama, () => { md.close(); reopen(); });
  }
  function profilMhs(id) {
    const m = S.idx.mhs[id]; if (!m) return toast('Data mahasiswa tidak ditemukan.', 'error');
    const tg = S.boot.g.penugasan.filter((t) => (t.petugas_ids || []).indexOf(id) > -1);
    const u = (S.boot.g.users || []).find((x) => String(x.email).toLowerCase() === String(m.email || '').toLowerCase());
    const self = S.me.mhs_id === id, ubah = self || D.isAdmin();
    const chips = chipJenis(m.jenis_mahasiswa) + (u ? '<span class="chip blue">' + esc(ROLE_LABEL[u.role] || 'Anggota Kelas') + '</span>' : '') + (m.status && m.status !== 'Aktif' ? '<span class="chip red">' + esc(m.status) + '</span>' : '');
    const md = modal({ title: 'Profil Mahasiswa', icon: 'user-round', cls: 'prof-modal',
      body: profHead(Foto.of(id), m.nama_lengkap, chips, m.nim ? 'NIM ' + esc(m.nim) : '', ubah) + kontakHtml(m.no_hp, m.email, m.nama_lengkap) +
        '<div class="prof-grid">' + infoRow('graduation-cap', 'Angkatan', esc(m.angkatan || '')) + infoRow('book-open', 'Konsentrasi', esc(m.konsentrasi || '')) + infoRow('landmark', 'Instansi', esc(m.instansi || '')) +
        infoRow('mail', 'Email', esc(m.email || '')) + infoRow('phone', 'WhatsApp', esc(m.no_hp || '')) + infoRow('target', 'Target lulus', esc(m.target_lulus_semester || '')) + '</div>' +
        (tg.length ? '<div class="sec-t">TUGAS PRESENTASI (' + tg.length + ')</div>' + tg.slice(0, 6).map((t) => { const p = D.ptmOf(t), mk = D.mkOfPtm(p); return '<div class="tile row between small mb8"><span class="ellipsis"><b class="semi">' + esc(mk.kode || '') + ' · Sesi ' + esc(p.nomor || '-') + '</b> — ' + esc(t.tema || '') + '</span>' + statusChip(D.statusTugas(t)) + '</div>'; }).join('') : ''),
      foot: (D.isAdmin() ? '<a class="btn ghost" href="#/mahasiswa/' + esc(id) + '" data-close>' + ic('id-card') + 'Detail lengkap</a>' : '') + '<button class="btn" data-close>Tutup</button>' });
    bindFotoBtn(md, id, m.nama_lengkap, () => profilMhs(id));
    return md;
  }
  function profilDosen(id) {
    const d = S.idx.dosen[id]; if (!d) return toast('Data dosen tidak ditemukan.', 'error');
    const mks = S.boot.g.mk.filter((m) => m.dosen_id === id && m.status_aktif !== 'TIDAK');
    const md = modal({ title: 'Profil Dosen', icon: 'user-round', cls: 'prof-modal',
      body: profHead(Foto.of(id), d.nama, '<span class="chip violet">Dosen Pengampu</span>' + (d.status === 'Nonaktif' ? '<span class="chip red">Nonaktif</span>' : ''), esc(d.bidang || ''), D.isAdmin()) + kontakHtml(d.no_hp, d.email, d.nama) +
        '<div class="prof-grid">' + infoRow('book-open', 'Bidang', esc(d.bidang || '')) + infoRow('mail', 'Email', esc(d.email || '')) + infoRow('phone', 'WhatsApp', esc(d.no_hp || '')) + '</div>' +
        (mks.length ? '<div class="sec-t">MATA KULIAH DIAMPU (' + mks.length + ')</div>' + mks.map((m) => '<a class="tile row between small mb8" href="#/mk/' + esc(m.mk_id) + '" data-close style="color:inherit"><span class="ellipsis"><span class="chip blue">' + esc(m.kode) + '</span> <b class="semi">' + esc(m.nama) + '</b></span><span class="muted nowrap">' + esc((S.idx.jadwalByMk[m.mk_id] || []).map((j) => j.hari + ' ' + j.jam_mulai).join(', ')) + '</span></a>').join('') : ''),
      foot: '<button class="btn" data-close>Tutup</button>' });
    bindFotoBtn(md, id, d.nama, () => profilDosen(id));
    return md;
  }
  function profilUser(id) {
    const u = S.idx.user[id] || (S.boot.g.users || []).find((x) => x.user_id === id); if (!u) return toast('Data pengguna tidak ditemukan.', 'error');
    const m = mhsOfUser(u); if (m) return profilMhs(m.mhs_id);
    const self = S.me.user_id === id;
    const md = modal({ title: 'Profil Pengguna', icon: 'user-round', cls: 'prof-modal',
      body: profHead(Foto.of(id) || (self ? S.foto : ''), u.nama_lengkap, '<span class="chip blue">' + esc(ROLE_LABEL[u.role] || '') + '</span>', '', self || D.isOp()) + kontakHtml(u.no_hp, u.email, u.nama_lengkap) +
        '<div class="prof-grid">' + infoRow('mail', 'Email', esc(u.email || '')) + infoRow('phone', 'WhatsApp', esc(u.no_hp || '')) + '</div>',
      foot: '<button class="btn" data-close>Tutup</button>' });
    bindFotoBtn(md, id, u.nama_lengkap, () => profilUser(id));
    return md;
  }
  function bukaProfil(ref) {
    const i = String(ref || '').indexOf(':'), kind = ref.slice(0, i), id = ref.slice(i + 1);
    if (!S.boot || !id) return;
    if (kind === 'mhs') profilMhs(id); else if (kind === 'dsn') profilDosen(id); else profilUser(id);
  }
  /**
   * Kecilkan gambar di browser sebelum dikirim (hemat kuota & cepat).
   * o = { max: sisi terpanjang px, square: crop persegi tengah, q: kualitas awal, maxChars: batas panjang data URL }
   */
  function kecilkanGambar(file, o) {
    o = o || {};
    return new Promise((res, rej) => {
      if (!file || !/^image\/(jpeg|png|webp|gif|bmp)/.test(file.type)) return rej(new Error('Pilih berkas gambar (JPG/PNG/WebP).'));
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let sw = img.width, sh = img.height, sx = 0, sy = 0;
        if (o.square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
        let scale = Math.min(1, (o.max || 1600) / Math.max(sw, sh)), q = o.q || 0.82, out = '';
        for (let i = 0; i < 9; i++) {
          const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (!o.maxChars || out.length <= o.maxChars) break;
          if (q > 0.55) q -= 0.1; else scale *= 0.82;
        }
        if (o.maxChars && out.length > o.maxChars) return rej(new Error('Gambar terlalu besar, coba gambar lain.'));
        res({ dataUrl: out, mime: 'image/jpeg', base64: out.split(',')[1] });
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Gambar tidak dapat dibaca.')); };
      img.src = url;
    });
  }
  /** Pilih & unggah foto profil (sendiri; admin untuk mahasiswa/dosen). */
  function pilihFoto(pemilikId, nama, done) {
    const ada = Foto.of(pemilikId);
    const md = modal({ title: 'Foto Profil', sub: esc(nama || ''), icon: 'camera', size: 'sm',
      body: '<div class="foto-pick"><div class="prof-ph big" id="fpPrev">' + (ada ? '<img src="' + esc(ada) + '" alt="">' : '<span class="ini">' + esc(initials(nama)) + '</span>') + '</div>' +
        '<label class="btn ghost">' + ic('upload') + 'Pilih Foto<input type="file" accept="image/*" hidden data-fp></label><span class="small muted" style="text-align:center">Foto otomatis dipotong persegi & dikecilkan. Tampil sebagai thumbnail di seluruh aplikasi.</span></div>',
      foot: (ada ? '<button class="btn danger" data-hapus>' + ic('trash-2') + 'Hapus Foto</button><span class="grow"></span>' : '') + '<button class="btn ghost" data-close>Batal</button><button class="btn" data-ok disabled>' + ic('check') + 'Simpan Foto</button>' });
    let hasil = null;
    $('[data-fp]', md.el).onchange = async (e) => {
      try { hasil = await kecilkanGambar(e.target.files[0], { max: 192, square: true, q: 0.8, maxChars: 40000 }); $('#fpPrev', md.el).innerHTML = '<img src="' + hasil.dataUrl + '" alt="">'; $('[data-ok]', md.el).disabled = false; }
      catch (er) { toast(er.message, 'error'); }
    };
    const kirim = async (foto, btn) => {
      busy(btn, true, 'Menyimpan…');
      const r = await api('foto.save', { pemilik_id: pemilikId, foto });
      busy(btn, false);
      if (!r.success) return toast(r.message, 'error');
      Foto.set(r.data.pemilik_id, foto, r.data.ver); if (S.boot && S.boot.g.settings) S.boot.g.settings.FOTO_VER = r.data.ver;
      md.close(); toast(r.message); renderShell(); rerender(); if (done) done();
    };
    $('[data-ok]', md.el).onclick = (e) => hasil && kirim(hasil.dataUrl, e.target.closest('button'));
    const h = $('[data-hapus]', md.el); if (h) h.onclick = (e) => kirim('', e.target.closest('button'));
    return md;
  }

  // ================================================================== v1.2 — APLIKASI LAIN
  function appLinks() { return (S.boot && S.boot.g.settings && Array.isArray(S.boot.g.settings.APP_LINKS)) ? S.boot.g.settings.APP_LINKS.filter((l) => l && l.aktif !== false && l.url) : []; }
  const APP_WARNA = ['#5B74DB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#0EA5E9', '#14B8A6', '#F97316'];
  function appTiles(links, cls) {
    return '<div class="app-tiles ' + (cls || '') + '">' + links.map((l, i) => '<a class="app-tile" href="' + esc(l.url) + '" target="_blank" rel="noopener" title="' + esc(l.url) + '"><span class="ai" style="background:' + APP_WARNA[i % APP_WARNA.length] + '">' + ic(l.ikon || 'globe') + '</span><span class="grow" style="min-width:0"><b class="semi ellipsis" style="display:block">' + esc(l.nama) + '</b>' + (l.ket ? '<span class="small muted ellipsis" style="display:block">' + esc(l.ket) + '</span>' : '') + '</span>' + ic('arrow-up-right', 'ext') + '</a>').join('') + '</div>';
  }

  // ------------------------------------------------------------------ grafik ringan (SVG)
  function donut(p, o) {
    o = o || {}; const size = o.size || 96, sw = o.stroke || 10, r = (size - sw) / 2, c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, Number(p) || 0)), color = o.color || (v >= 90 ? '#10B981' : v >= 60 ? '#5B74DB' : '#F5A623');
    return '<svg class="donut" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + v + '%">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (o.track || '#E6E9F2') + '" stroke-width="' + sw + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + ((c * v) / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="' + (o.font || Math.round(size / 4.6)) + '">' + (o.label != null ? esc(o.label) : v + '%') + '</text></svg>';
  }
  function bars(groups, max) {
    max = max || Math.max(1, ...groups.map((g) => Math.max(g.a || 0, g.b || 0)));
    return '<div class="chart-bars">' + groups.map((g) => '<div class="grp" title="' + esc(g.title || g.x) + '"><div class="bars">' +
      '<span class="b" style="height:' + Math.max(3, (100 * (g.a || 0)) / max) + '%" data-v="' + esc(g.av || g.a) + '"></span>' +
      (g.b != null ? '<span class="b l" style="height:' + Math.max(3, (100 * (g.b || 0)) / max) + '%" data-v="' + esc(g.bv || g.b) + '"></span>' : '') +
      '</div><span class="x">' + esc(g.x) + '</span></div>').join('') + '</div>';
  }
  function progress(p, cls) { return '<div class="progress ' + (cls || '') + '"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div>'; }

  // ------------------------------------------------------------------ tabel generik (cari, urut, paging lokal)
  /**
   * table(el, {rows, cols:[{k,t,render,sort,cls,l}], search:fn(row)→string, per, empty, rowCls, mobileCards})
   * Semua filter/urut/paging lokal → instan tanpa server.
   */
  function table(host, o) {
    const st = host._tbl || (host._tbl = { q: '', page: 1, sort: o.sortDefault || null, dir: o.dirDefault || 1 });
    function draw() {
      let rows = o.rows.slice();
      if (st.q && o.search) { const q = st.q.toLowerCase(); rows = rows.filter((r) => o.search(r).toLowerCase().indexOf(q) > -1); }
      if (st.sort) { const c = o.cols.find((x) => x.k === st.sort); if (c) { const f = c.sortVal || ((r) => r[c.k]); rows.sort((a, b) => { const x = f(a), y = f(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x || '').localeCompare(String(y || ''), 'id', { numeric: true })) * st.dir; }); } }
      const per = o.per || 20, pages = Math.max(1, Math.ceil(rows.length / per)); if (st.page > pages) st.page = pages;
      const slice = rows.slice((st.page - 1) * per, st.page * per);
      const tb = $('.tbl-body', host);
      tb.innerHTML = '<div class="tbl-wrap"><table class="tbl ' + (o.mobileCards !== false ? 'cards' : '') + '"><thead><tr>' + o.cols.map((c) => '<th class="' + (c.sort !== false ? 'sortable' : '') + ' ' + (c.cls || '') + '" data-k="' + c.k + '">' + esc(c.t) + (st.sort === c.k ? (st.dir > 0 ? ' ↑' : ' ↓') : '') + '</th>').join('') + '</tr></thead><tbody>' +
        (slice.length ? slice.map((r) => '<tr class="' + (o.rowCls ? o.rowCls(r) : '') + '">' + o.cols.map((c, i) => '<td class="' + (c.cls || '') + (i === 0 ? ' cell-main' : '') + '" data-l="' + esc(c.t) + '">' + (c.render ? c.render(r) : esc(r[c.k])) + '</td>').join('') + '</tr>').join('')
          : '<tr><td colspan="' + o.cols.length + '" class="cell-main"><div class="empty">' + ic('inbox') + '<br>' + esc(o.empty || 'Belum ada data.') + '</div></td></tr>') + '</tbody></table></div>' +
        (rows.length > per ? '<div class="pager"><span>Menampilkan ' + ((st.page - 1) * per + 1) + '–' + Math.min(rows.length, st.page * per) + ' dari ' + rows.length + '</span><div class="pg">' +
          '<button data-pg="' + (st.page - 1) + '" ' + (st.page <= 1 ? 'disabled' : '') + '>‹</button>' +
          Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - st.page) <= 1).map((p, i, a) => (i && p - a[i - 1] > 1 ? '<span>…</span>' : '') + '<button data-pg="' + p + '" class="' + (p === st.page ? 'on' : '') + '">' + p + '</button>').join('') +
          '<button data-pg="' + (st.page + 1) + '" ' + (st.page >= pages ? 'disabled' : '') + '>›</button></div></div>' : (rows.length ? '<div class="pager"><span>' + rows.length + ' data</span></div>' : ''));
      $$('th.sortable', tb).forEach((th) => (th.onclick = () => { const k = th.dataset.k; if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = 1; } draw(); }));
      $$('[data-pg]', tb).forEach((b) => (b.onclick = () => { st.page = Number(b.dataset.pg); draw(); }));
      if (o.after) o.after(tb, slice);
    }
    if (!$('.tbl-body', host)) {
      host.innerHTML = (o.search ? '<div class="tbl-tools"><div class="searchbox">' + ic('search') + '<input type="search" placeholder="' + esc(o.placeholder || 'Cari…') + '" aria-label="Cari"></div>' + (o.tools || '') + '</div>' : (o.tools ? '<div class="tbl-tools">' + o.tools + '</div>' : '')) + '<div class="tbl-body"></div>';
      const inp = $('.tbl-tools input[type=search]', host);
      if (inp) { inp.value = st.q; inp.addEventListener('input', debounce(() => { st.q = inp.value; st.page = 1; draw(); }, 250)); }
      if (o.onTools) o.onTools($('.tbl-tools', host));
    }
    draw();
    return { redraw: draw, state: st };
  }

  // ------------------------------------------------------------------ pustaka eksternal (lazy)
  const scripts = {};
  function loadScript(src) { return scripts[src] || (scripts[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete scripts[src]; rej(new Error('Gagal memuat pustaka. Periksa internet.')); }; document.head.appendChild(s); })); }
  const LIB = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
  };
  async function exportXlsx(nama, sheets) {
    await loadScript(LIB.xlsx);
    const wb = XLSX.utils.book_new();
    Object.keys(sheets).forEach((k) => { const ws = XLSX.utils.json_to_sheet(sheets[k].length ? sheets[k] : [{ Info: 'Tidak ada data' }]); XLSX.utils.book_append_sheet(wb, ws, k.substring(0, 31)); });
    XLSX.writeFile(wb, nama.replace(/[\\/:*?"<>|]/g, '-') + '.xlsx');
  }
  async function exportPdf(judul, sub, columns, rows) {
    await loadScript(LIB.jspdf); await loadScript(LIB.autotable);
    const doc = new window.jspdf.jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    const app = S.boot.g.settings;
    doc.setFillColor(63, 85, 168); doc.rect(0, 0, doc.internal.pageSize.getWidth(), 58, 'F');
    doc.setTextColor(255); doc.setFontSize(15); doc.text(judul, 36, 30); doc.setFontSize(9); doc.text((app.NAMA_APLIKASI || 'SIM KULIAH') + ' · ' + (app.NAMA_INSTITUSI || '') + ' · ' + sub, 36, 46);
    doc.autoTable({ startY: 74, head: [columns], body: rows, styles: { fontSize: 8.5, cellPadding: 5 }, headStyles: { fillColor: [91, 116, 219] }, alternateRowStyles: { fillColor: [247, 248, 250] },
      didDrawPage: () => { doc.setFontSize(8); doc.setTextColor(150); doc.text('Dicetak ' + new Date().toLocaleString('id-ID'), 36, doc.internal.pageSize.getHeight() - 16); } });
    doc.save(judul.replace(/[\\/:*?"<>|]/g, '-') + '.pdf');
  }
  async function parseSheetFile(file) {
    await loadScript(LIB.xlsx);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', raw: false, cellText: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  }
  function normKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  // ------------------------------------------------------------------ login / tamu
  function applyBranding(br) {
    if (!br) return;
    S.branding = br; Store.set('branding', br);
  }
  async function fetchBranding() {
    try {
      if (!CFG.GAS_URL || /GANTI_DENGAN/.test(CFG.GAS_URL)) return S.branding;
      const r = await fetch(CFG.GAS_URL + '?action=branding', { cache: 'no-store', redirect: 'follow' });
      const j = await r.json(); if (j.success) applyBranding(j.data);
    } catch (e) {}
    return S.branding;
  }
  function clientId() { return CFG.GOOGLE_CLIENT_ID || (S.branding && S.branding.clientId) || ''; }
  let gsiReady = false;
  function initGsi(tries) {
    tries = tries || 0;
    const host = $('#gbtn'); if (!host) return;
    const cid = clientId();
    if (!cid) { if (tries < 1) return fetchBranding().then(() => initGsi(1)); host.innerHTML = '<div class="alert warn">' + ic('triangle-alert') + '<span>Google Client ID belum diatur. Isi <b>GOOGLE_CLIENT_ID</b> di <code>js/config.js</code> atau sheet Pengaturan.</span></div>'; return; }
    if (!(window.google && google.accounts && google.accounts.id)) {
      if (tries > 40) { host.innerHTML = '<div class="alert err">' + ic('triangle-alert') + '<span>Layanan Google Sign-In tidak dapat dimuat. Periksa koneksi / pemblokir iklan, lalu muat ulang.</span></div>'; return; }
      return setTimeout(() => initGsi(tries + 1), 250);
    }
    if (!gsiReady) { google.accounts.id.initialize({ client_id: cid, callback: onGoogleCredential, auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup', itp_support: true }); gsiReady = true; }
    host.innerHTML = '';
    google.accounts.id.renderButton(host, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', logo_alignment: 'center', width: Math.min(400, host.clientWidth || 360), locale: 'id' });
  }
  function featHtml(icn, t, s) { return '<div class="feat"><span class="fi">' + ic(icn) + '</span><div><b>' + esc(t) + '</b><span>' + esc(s) + '</span></div></div>'; }
  /** v1.2: wallpaper halaman login (diatur Operator) — disimpan di perangkat, diunduh ulang hanya bila diganti. */
  const Wall = {
    get() { const c = Store.get('wallpaper', null); return c && c.img ? c : null; },
    async sync(br) {
      if (!br || !br.bg) return null;
      if (!br.bg.ada) { Store.del('wallpaper'); return null; }
      const c = this.get(); if (c && c.ver === br.bg.ver) return c.img;
      try {
        const r = await fetch(CFG.GAS_URL + '?action=wallpaper&t=' + Date.now(), { cache: 'no-store', redirect: 'follow' });
        const j = await r.json(); if (j.success && j.data && j.data.img) { Store.set('wallpaper', { ver: j.data.ver, img: j.data.img }); return j.data.img; }
      } catch (e) {}
      return null;
    },
    apply(img, op) {
      const el = $('#lgBg'); if (!el) return;
      if (img) { el.style.backgroundImage = 'url("' + img + '")'; el.classList.add('on'); } else { el.style.backgroundImage = ''; el.classList.remove('on'); }
      el.style.opacity = img ? Math.max(0, Math.min(100, op == null ? 35 : op)) / 100 : 0;
    }
  };
  function showGuest(state) {
    $('#splash').hidden = true; $('#shell').hidden = true;
    const g = $('#guest'); g.hidden = false;
    const br = S.branding || {}, bg = br.bg || {}, w = bg.ada ? Wall.get() : null;
    const logo = br.logo ? '<img src="' + br.logo + '" alt="Logo">' : ic('graduation-cap');
    const info = (br.semester ? 'Perkuliahan ' + br.semester : 'Portal perkuliahan') + (br.angkatan ? ' · ' + br.angkatan : '');
    g.innerHTML = '<div class="lg2"><div class="lg2-bg" id="lgBg"></div><div class="lg2-shade"></div>' +
      '<header class="lg2-top"><div class="lg2-brand"><span class="logo">' + logo + '</span><div><b>' + esc(br.nama || 'SIM KULIAH') + '</b><span>' + esc(br.institusi || 'Program Pascasarjana') + '</span></div></div>' +
      '<span class="lg2-status"><i></i>Sistem Operasional</span></header>' +
      '<main class="lg2-main"><section class="lg2-hero"><span class="lg2-pill">' + ic('graduation-cap') + esc(info) + '</span>' +
      '<h2>Portal Akademik &amp; Manajemen Tugas Terpadu</h2><p>Kelola 16 pertemuan, presentasi kelompok, modul belajar, dan pemantauan kelulusan tepat waktu dalam satu tempat.</p>' +
      '<div class="lg2-feats">' + featHtml('book-open', '16 Pertemuan Terstruktur', 'Makalah, slide, notulen & referensi rapi di Google Drive.') +
      featHtml('bell', 'Pengingat H-7, H-3, H-1', 'Notifikasi petugas presentasi via WhatsApp & Email.') + featHtml('target', 'Monitoring Kelulusan', 'Pantau progres mahasiswa P2K & Reguler real-time.') + '</div></section>' +
      '<section class="lg2-card"><div class="login-form" id="loginForm"></div></section></main>' +
      '<footer class="lg2-foot">© ' + new Date().getFullYear() + ' ' + esc(br.institusi || br.nama || 'SIM KULIAH') + ' · Terintegrasi Google Workspace</footer></div>';
    Wall.apply(w && w.img, bg.opacity);
    if (bg.ada && (!w || w.ver !== bg.ver)) Wall.sync(br).then((img) => { if (img && $('#lgBg')) Wall.apply(img, bg.opacity); });
    renderLoginForm(state);
  }
  function renderLoginForm(state) {
    const f = $('#loginForm'); if (!f) return;
    state = state || {};
    const br = S.branding || {};
    let extra = '';
    if (state.code === 'PENDING') extra = '<div class="state-card" style="background:#FFFBEB;box-shadow:inset 0 0 0 1px #F7E2A8">' + ic('clock') + '<div><b>Menunggu Verifikasi</b><div class="small muted mt8">Pendaftaran <b>' + esc(state.email || '') + '</b> sudah kami terima dan sedang ditinjau Operator/Ketua Kelas. Anda akan mendapat pemberitahuan setelah disetujui.</div></div></div>';
    else if (state.code === 'REJECTED') extra = '<div class="alert err">' + ic('ban') + '<span>' + esc(state.message) + '</span></div>';
    else if (state.message) extra = '<div class="alert err">' + ic('triangle-alert') + '<span>' + esc(state.message) + '</span></div>';
    f.innerHTML = '<div class="lg2-logo">' + (br.logo ? '<img src="' + br.logo + '" alt="">' : ic('graduation-cap')) + '</div>' +
      '<div style="text-align:center"><span class="chip blue">' + ic('shield-check') + 'AKSES TERPROTEKSI</span><h1>Selamat Datang di Portal Kelas</h1><p class="muted lg2-sub">Masuk dengan akun Google terdaftar untuk mengakses jadwal, materi, dan penugasan perkuliahan.</p></div>' +
      '<div id="gbtn" class="gbtn-wrap"><div class="skel" style="height:44px;width:100%;max-width:400px"></div></div>' +
      '<div class="small faint" style="text-align:center">' + ic('info') + ' Gunakan email Gmail / Google Workspace yang telah didaftarkan</div>' + extra +
      '<div class="lg2-reg">' + ic('user-plus') + '<div><b>Mahasiswa baru, belum terdaftar?</b><div class="small mt8">Klik <b>Masuk dengan Google</b> — bila email belum terdaftar, formulir pendaftaran singkat (Nama, Email, No HP) muncul otomatis dan menunggu verifikasi Operator.</div></div></div>' +
      '<div id="loginBusy" hidden class="row" style="justify-content:center"><span class="spin" style="width:18px;height:18px;border:2px solid var(--primary);border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite"></span><span class="muted">Memverifikasi akun…</span></div>';
    initGsi();
  }
  async function onGoogleCredential(resp) {
    const b = $('#loginBusy'); if (b) b.hidden = false;
    const r = await api('auth.google', { credential: resp.credential });
    if (b) b.hidden = true;
    if (r.success) return onLoggedIn(r.data);
    if (r.code === 'NOT_REGISTERED') return openRegister(r.data);
    renderLoginForm({ code: r.code, email: r.data && r.data.email, message: r.message });
  }
  function onLoggedIn(d) {
    S.token = d.token; S.email = d.boot.me.email; S.foto = d.foto || '';
    Store.set('token', S.token); Store.set('email', S.email); Store.set('foto', S.foto);
    setBoot(d.boot);
    mountApp();
    toast('Selamat datang, ' + d.boot.me.nama_lengkap + '!', 'success');
  }
  function openRegister(d) {
    const br = S.branding || {};
    const m = modal({
      title: 'Formulir Pendaftaran Mahasiswa Baru', sub: 'Lengkapi data untuk diverifikasi oleh Operator / Ketua Kelas', icon: 'user-plus', static: true,
      body: '<form class="col" style="gap:16px" id="regForm">' +
        '<div class="field"><label>Nama Lengkap &amp; Gelar <span class="req">*</span></label><input class="inp" name="nama_lengkap" required minlength="3" value="' + esc(d.nama || '') + '" placeholder="mis. Budi Pratama, S.E."><span class="hint">Sesuai ijazah S1 / identitas resmi pendaftaran.</span></div>' +
        '<div class="field"><label>Akun Email Google <span class="req">*</span> <span class="chip blue">' + ic('lock') + 'Otomatis dari Akun Google</span></label><input class="inp" value="' + esc(d.email) + '" readonly></div>' +
        '<div class="field"><label>Nomor WhatsApp / HP Aktif <span class="req">*</span></label><div class="inp-group"><span class="pre">+62</span><input name="no_hp" inputmode="tel" required placeholder="812-3456-7890"></div><span class="hint">Untuk reminder presentasi otomatis H-7, H-3, H-1.</span></div>' +
        '<div class="field"><label>Preferensi Kelas</label><div class="radio-cards"><label class="radio-card on"><input type="radio" name="jenis_mahasiswa" value="P2K" checked><div><b>P2K (Karyawan)</b><span>Kelas weekend</span></div></label><label class="radio-card"><input type="radio" name="jenis_mahasiswa" value="Reguler"><div><b>Reguler</b><span>Kelas weekday</span></div></label></div><span class="hint">Jenis final ditetapkan Operator saat verifikasi.</span></div>' +
        '<div class="alert warn">' + ic('info') + '<span><b>Informasi Verifikasi:</b> setelah dikirim, status akun Anda menjadi <b>Menunggu Verifikasi</b>. Anda akan menerima notifikasi setelah disetujui.</span></div></form>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-send>Kirim Pendaftaran &amp; Tunggu Verifikasi ' + ic('arrow-right') + '</button>'
    });
    radioCards(m.el);
    $('[data-send]', m.el).onclick = async (e) => {
      const fd = formData($('#regForm', m.el)), btn = e.target.closest('button,.btn');
      if ((fd.nama_lengkap || '').trim().length < 3) return toast('Nama lengkap wajib diisi.', 'error');
      if (!hpValid(fd.no_hp)) return toast('Nomor HP tidak valid. Contoh: 812-3456-7890', 'error');
      busy(btn, true, 'Mengirim…');
      const r = await api('auth.register', { regToken: d.regToken, nama_lengkap: fd.nama_lengkap, no_hp: hp08(fd.no_hp), jenis_mahasiswa: fd.jenis_mahasiswa });
      busy(btn, false);
      if (!r.success) return toast(r.message, 'error');
      m.close(); renderLoginForm({ code: 'PENDING', email: d.email }); toast(r.message, 'success');
    };
  }
  function logout(msg) {
    Store.del('token'); Store.del(userKey('boot'));
    try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch (e) {}
    S.token = ''; S.boot = null; S.me = null; S.page = null;
    $('#view').innerHTML = ''; modalStack.slice().forEach((m) => m.close());
    history.replaceState(null, '', location.pathname);
    gsiReady = false;
    showGuest(msg ? { message: msg } : null);
  }
  function onSessionExpired(msg) { toast(msg || 'Sesi berakhir.', 'warn'); logout(msg); }
  function showBootError(msg) {
    $('#splash').hidden = true; $('#shell').hidden = false;
    $('#view').innerHTML = '<div class="card" style="max-width:560px;margin:60px auto;text-align:center"><div class="empty">' + ic('triangle-alert') + '<br><b>Gagal memuat data</b><br>' + esc(msg || '') + '</div><button class="btn" data-retry>' + ic('refresh-cw') + 'Coba lagi</button></div>';
    $('[data-retry]').onclick = () => { $('#view').innerHTML = ''; refreshBoot(true); };
  }

  // ------------------------------------------------------------------ pengumuman popup
  let popupShown = {};
  function showAnnouncementPopups() {
    const list = D.unreadAnn().filter((p) => p.popup === 'YA' && !popupShown[p.pengumuman_id]).slice(0, 3);
    const next = () => {
      const p = list.shift(); if (!p) return;
      popupShown[p.pengumuman_id] = 1;
      const m = modal({ title: p.judul, sub: 'Pengumuman · ' + fmtWaktu(p.tanggal), icon: 'megaphone', body: '<div style="white-space:pre-wrap;line-height:1.65">' + esc(p.isi) + '</div>',
        foot: '<button class="btn" data-close>Saya sudah membaca</button>', onClose: () => { markRead([p.pengumuman_id]); setTimeout(next, 250); } });
      return m;
    };
    next();
  }
  function markRead(ids) {
    ids = ids.filter((i) => !S.idx.dibaca[i]); if (!ids.length) return;
    ids.forEach((i) => { S.idx.dibaca[i] = 1; S.boot.u.dibaca.push(i); });
    Store.set(userKey('boot'), { t: Date.now() - 50000, h: bootHash(S.boot), data: S.boot });
    updateBadges(); if (S.page === 'pengumuman' || S.page === 'dashboard') rerender();
    api('pengumuman.read', { ids });
  }

  // ------------------------------------------------------------------ mount
  function mountApp() {
    $('#splash').hidden = true; $('#guest').hidden = true; $('#guest').innerHTML = ''; $('#shell').hidden = false;
    renderShell();
    if (!location.hash || location.hash === '#' || location.hash === '#/') location.replace('#/dashboard'); else route();
    setTimeout(showAnnouncementPopups, 600);
    idle(() => Foto.sync(), 1200);                                         // v1.2: foto profil dimuat terpisah, saat senggang
    if (D.isAdmin()) idle(() => ensureAdmin().then(() => idle(prefetchAdmin, 1500)).catch(() => {}), 2000);
  }

  // ------------------------------------------------------------------ event global (delegasi)
  // v1.2: foto/nama anggota & dosen → popup profil (fase capture: tidak memicu klik baris/kartu di bawahnya)
  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-prof]');
    if (!p || !S.boot) return;
    e.preventDefault(); e.stopPropagation();
    closeDropdowns(); bukaProfil(p.dataset.prof);
  }, true);
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.av-link[data-prof]')) { e.preventDefault(); bukaProfil(e.target.dataset.prof); } });
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-apps]')) {
      const links = appLinks(), btn = t.closest('[data-apps]');
      const d = openDropdown(btn, '<div class="row between" style="padding:8px 10px"><b>Aplikasi Lain</b><span class="small muted">' + links.length + ' aplikasi</span></div>' +
        (links.length ? appTiles(links, 'dd') : '<div class="empty">' + ic('layout-grid') + '<br>Belum ada tautan aplikasi.</div>') +
        (D.isOp() ? '<a href="#/settings/apps" class="small" style="display:block;text-align:center;padding:8px">' + ic('settings') + ' Atur tautan aplikasi</a>' : ''), 'apps-dd');
      d.addEventListener('click', (ev) => { if (ev.target.closest('a')) setTimeout(() => d.remove(), 50); });
      return;
    }
    if (t.closest('[data-burger]')) { document.body.classList.toggle('nav-open'); return; }
    if (t.closest('#overlay')) { document.body.classList.remove('nav-open'); return; }
    if (t.closest('[data-logout]')) { e.preventDefault(); confirmDlg('Keluar dari aplikasi?', 'Anda perlu masuk kembali dengan akun Google.', { ok: 'Keluar' }).then((y) => y && logout()); return; }
    const tg = t.closest('[data-toggle-mk]');
    if (tg && window.innerWidth > 1100 && S.page === 'mk' && !S.param) { e.preventDefault(); mkOpen = !mkOpen; Store.set('mkOpen', mkOpen); const sm = $('.nav .submenu'); if (sm) sm.hidden = !mkOpen; return; }
    if (t.closest('[data-search-open]')) { const sb = $('#gsearch'); sb.classList.add('open'); $('input', sb).focus(); return; }
    if (t.closest('[data-bell]')) {
      const items = notifItems(), btn = t.closest('[data-bell]');
      const d = openDropdown(btn, '<div class="row between" style="padding:8px 10px"><b>Notifikasi</b><span class="small muted">' + items.length + ' item</span></div>' +
        (items.length ? items.map((x, i) => '<div class="it" data-ni="' + i + '"><span class="kpi"><span class="ic ' + (x.amber ? 'amber' : '') + '" style="width:36px;height:36px">' + ic(x.ic) + '</span></span><div class="grow"><b class="semi" style="font-size:13.5px">' + esc(x.t) + '</b><div class="small muted">' + esc(x.s) + '</div></div></div>').join('') : '<div class="empty">' + ic('bell') + '<br>Tidak ada notifikasi baru.</div>'), 'notif-dd');
      $$('[data-ni]', d).forEach((el) => (el.onclick = () => { const x = items[+el.dataset.ni]; d.remove(); if (x.ann) { const p = S.boot.g.pengumuman.find((q) => q.pengumuman_id === x.ann); if (p) window.SIMK.openAnn(p); } else if (x.href) location.hash = x.href; }));
      return;
    }
    if (t.closest('[data-me]')) {
      const d = openDropdown(t.closest('[data-me]'), '<div style="padding:10px 12px"><b>' + esc(S.me.nama_lengkap) + '</b><div class="small muted">' + esc(S.me.email) + '</div></div><a href="#/profil">' + ic('user-cog') + 'Profil Saya</a><a href="#/laporan">' + ic('chart-column') + 'Laporan Saya</a><button data-logout>' + ic('log-out') + 'Keluar</button>');
      d.addEventListener('click', () => d.remove());
      return;
    }
    if (t.closest('.search-res a')) { const sb = $('#gsearch'); $('.search-res', sb).hidden = true; $('input', sb).value = ''; sb.classList.remove('open'); }
  });
  document.addEventListener('input', (e) => { if (e.target.closest('#gsearch input')) doSearch(e.target); });
  document.addEventListener('focusout', (e) => { if (e.target.closest('#gsearch input')) setTimeout(() => { const sb = $('#gsearch'); if (sb) { $('.search-res', sb).hidden = true; sb.classList.remove('open'); } }, 200); });
  document.addEventListener('change', (e) => { if (e.target.id === 'jenisSel') { S.jenis = e.target.value; Store.set('jenis', S.jenis); rerender(); } });
  window.addEventListener('hashchange', route);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 120000) { if (S.token) { refreshBoot(false); if (D.isAdmin()) idle(prefetchAdmin, 3000); } else warmUp('pub'); }
  });
  window.addEventListener('online', () => { if (S.token) refreshBoot(true); });

  // ------------------------------------------------------------------ start
  function start() {
    if (!S.token) warmUp('pub');                       // tamu: panaskan server selagi halaman login dibuka
    const cached = S.token && S.email ? Store.get(userKey('boot'), null) : null;
    if (S.token && cached) {
      setBoot(cached.data, true);
      mountApp();                                 // tampil seketika dari cache perangkat
      refreshBoot(Date.now() - cached.t > 60000);
    } else if (S.token) {
      api('boot').then((r) => { if (r.success) { setBoot(r.data); mountApp(); } else if (r.code !== 'AUTH') showBootError(r.message); });
    } else {
      showGuest();
      fetchBranding().then((br) => { if (br && !S.token && $('#guest') && !$('#guest').hidden && !modalStack.length) { const st = $('#loginForm .alert.err, #loginForm .state-card') ? null : undefined; if (st === undefined) showGuest(); } });
    }
  }

  // ------------------------------------------------------------------ ekspor ke modul halaman
  window.SIMK = {
    CFG, S, D, Store, Perf, $, $$, esc, ic, debounce, idle, api, apiUpload, mutate, refreshBoot, scheduleRefresh, setBoot, buildIdx,
    registerPage, go, route, rerender, renderShell, modal, confirmDlg, toast, busy, formData, radioCards, openDropdown,
    readFile, downloadFile, openViewer, saveBlob, b64ToBlob, donut, bars, progress, table, exportXlsx, exportPdf, parseSheetFile, normKey, loadScript,
    fmtTgl, fmtWaktu, fmtRel, fmtSize, initials, avatar, chipJenis, statusChip, pct, ymd, todayYmd, addDays, dayDiff, hp08, hpValid, emailValid, fileKind,
    ROLE_LABEL, HARI, BULAN, markRead, ensureAdmin, logout, userKey, annForMe, onGoogleCredential,
    APP_VER, saveLocal, tmpId, pend, warmUp, prefetchAdmin, scheduleDrain,
    Foto, avMhs, avDsn, avUsr, profLink, bukaProfil, profilMhs, profilDosen, pilihFoto, kecilkanGambar, appLinks, appTiles, waLink, kontakHtml, fotoSaya, Wall
  };
  window.Perf = Perf;
  document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0));
})();
