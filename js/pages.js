/**
 * ============================================================================
 *  SIM KULIAH — pages.js (halaman untuk semua peran)
 *  Dashboard • Mata Kuliah (16 pertemuan, petugas, materi, notulen, referensi)
 *  Pengumuman • Rencana (timeline, to-do, target) • Laporan • Profil
 *  Semua halaman dirender dari data bootstrap lokal → pindah menu instan.
 * ============================================================================
 */
(function () {
  'use strict';
  const K = window.SIMK;
  const { S, D, $, $$, esc, ic, api, mutate, modal, confirmDlg, toast, busy, formData, radioCards, fmtTgl, fmtWaktu, fmtRel, fmtSize,
    avatar, chipJenis, statusChip, pct, ymd, todayYmd, addDays, dayDiff, donut, bars, progress, table, openViewer, downloadFile, fileKind,
    avMhs, avDsn, avUsr, profLink, Foto } = K;

  const MAX_FILE = 10 * 1024 * 1024;
  const EXT = { Makalah: ['pdf', 'doc', 'docx'], PPT: ['ppt', 'pptx', 'pdf'], Notulen: ['pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg'],
    File: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'epub', 'txt', 'csv', 'png', 'jpg', 'jpeg'], 'E-book': ['pdf', 'epub'] };
  const firstName = (n) => String(n || '').replace(/^(dr|prof|ir|drs|h|hj)\.?\s+/i, '').split(/[\s,]+/)[0] || n;
  const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  function ptmStatus(p) { if (p.status && p.status !== 'Terjadwal') return p.status; const t = ymd(p.tanggal); return t && t < todayYmd() ? 'Selesai' : 'Terjadwal'; }
  function petugasNames(t) { return (t.petugas_ids || []).map((id) => D.namaMhs(id)).join(', ') || '—'; }
  function canUpload(t) { return D.isAdmin() || (S.me.mhs_id && (t.petugas_ids || []).indexOf(S.me.mhs_id) > -1); }
  function ytId(url) { const m = String(url || '').match(/embed\/([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; }

  // ============================================================== ilustrasi hero (SVG orisinal)
  const HERO_ART = '<svg viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs><linearGradient id="hg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#EEF2FF"/><stop offset="1" stop-color="#E0E7FF"/></linearGradient></defs>' +
    '<rect x="10" y="10" width="300" height="200" rx="26" fill="url(#hg)"/>' +
    '<circle cx="262" cy="52" r="20" fill="#FEF6E9"/><circle cx="262" cy="52" r="9" fill="#F5A623"/>' +
    '<rect x="40" y="150" width="240" height="10" rx="5" fill="#C7D2FE"/><rect x="62" y="160" width="8" height="40" rx="3" fill="#A5B4FC"/><rect x="250" y="160" width="8" height="40" rx="3" fill="#A5B4FC"/>' +
    '<rect x="150" y="92" width="96" height="58" rx="8" fill="#3F55A8"/><rect x="157" y="99" width="82" height="44" rx="4" fill="#fff"/>' +
    '<rect x="164" y="122" width="8" height="16" rx="2" fill="#5B74DB"/><rect x="176" y="114" width="8" height="24" rx="2" fill="#5B74DB"/><rect x="188" y="118" width="8" height="20" rx="2" fill="#10B981"/><rect x="200" y="108" width="8" height="30" rx="2" fill="#5B74DB"/><rect x="214" y="106" width="20" height="4" rx="2" fill="#C7D2FE"/><rect x="214" y="114" width="16" height="4" rx="2" fill="#C7D2FE"/>' +
    '<path d="M140 150h116l-8 0" stroke="#3F55A8" stroke-width="6" stroke-linecap="round"/>' +
    '<rect x="58" y="124" width="62" height="12" rx="3" fill="#5B74DB"/><rect x="62" y="112" width="54" height="12" rx="3" fill="#F5A623"/><rect x="56" y="136" width="66" height="14" rx="3" fill="#10B981"/>' +
    '<path d="M70 70l30-14 30 14-30 14z" fill="#1E2438"/><path d="M84 77v12c8 6 24 6 32 0V77l-16 7z" fill="#3F55A8"/><path d="M130 70v18" stroke="#F5A623" stroke-width="3"/><circle cx="130" cy="90" r="4" fill="#F5A623"/>' +
    '<g opacity=".8"><circle cx="214" cy="60" r="3" fill="#5B74DB"/><circle cx="40" cy="44" r="3" fill="#5B74DB"/><circle cx="292" cy="140" r="3" fill="#10B981"/></g></svg>';

  // ============================================================== DASHBOARD
  function progresMk() {
    return D.mkAktif().map((m) => {
      const ts = D.tugasMk(m.mk_id).filter(D.tugasCocokJenis);
      let mk = 0, pp = 0; ts.forEach((t) => { const s = D.subs(t.tugas_id); if (s.makalah) mk++; if (s.ppt) pp++; });
      return { m, total: ts.length, makalah: mk, ppt: pp, lengkap: ts.filter((t) => D.statusTugas(t) === 'Terkumpul').length };
    });
  }
  function jadwalHari(hariIdx) {
    const out = [], my = S.me.jenis_mahasiswa;
    D.mkAktif().forEach((m) => (S.idx.jadwalByMk[m.mk_id] || []).forEach((j) => {
      if (K.HARI.indexOf(j.hari) !== hariIdx) return;
      if (!D.isAdmin() && my && j.jenis_kelas && j.jenis_kelas !== 'Semua' && j.jenis_kelas !== my) return;
      if (D.jenisFilter() && j.jenis_kelas && j.jenis_kelas !== 'Semua' && j.jenis_kelas !== D.jenisFilter()) return;
      out.push({ j, m });
    }));
    return out.sort((a, b) => String(a.j.jam_mulai).localeCompare(String(b.j.jam_mulai)));
  }
  function nextPtm(mkId, from) { return (S.idx.ptmByMk[mkId] || []).find((p) => ymd(p.tanggal) >= from) || null; }
  function tenggatList() {
    const t = todayYmd(), out = [];
    const tugas = D.isAdmin() ? S.boot.g.penugasan.filter(D.tugasCocokJenis) : D.tugasSaya();
    tugas.forEach((x) => {
      if (D.statusTugas(x) === 'Terkumpul') return;
      const dl = D.deadlineOf(x); if (!dl) return; const sisa = dayDiff(t, dl); if (sisa < -7 || sisa > 21) return;
      const p = D.ptmOf(x), mk = D.mkOfPtm(p), s = D.subs(x.tugas_id);
      out.push({ d: dl, sisa, ic: 'file-text', t: (D.isAdmin() ? '' : 'Unggah ') + 'Makalah & PPT — ' + x.tema, s: (mk.nama || '') + ' · Pertemuan ' + p.nomor + (D.isAdmin() ? ' · ' + petugasNames(x) : '') + ' · ' + (s.makalah ? '✓' : '✗') + ' Makalah ' + (s.ppt ? '✓' : '✗') + ' PPT', href: '#/mk/' + p.mk_id });
    });
    if (!D.isAdmin()) S.boot.g.todo.forEach((x) => {
      const st = S.idx.todoStatus[x.todo_id]; if (st && st.selesai === 'Y') return;
      if (x.jenis_kelas && x.jenis_kelas !== 'Semua' && x.jenis_kelas !== S.me.jenis_mahasiswa) return;
      const dl = ymd(x.deadline); if (!dl) return; const sisa = dayDiff(t, dl); if (sisa < 0 || sisa > 21) return;
      out.push({ d: dl, sisa, ic: 'list-checks', t: x.judul, s: 'To-do ' + x.sumber + (x.wajib === 'YA' ? ' · wajib' : ''), href: '#/rencana' });
    });
    D.mkAktif().forEach((m) => (S.idx.ptmByMk[m.mk_id] || []).filter((p) => p.jenis !== 'Pembelajaran').forEach((p) => {
      const dl = ymd(p.tanggal); if (!dl) return; const sisa = dayDiff(t, dl); if (sisa < 0 || sisa > 21) return;
      out.push({ d: dl, sisa, ic: 'graduation-cap', t: p.jenis + ' — ' + m.nama, s: 'Pertemuan ' + p.nomor, href: '#/mk/' + m.mk_id });
    }));
    return out.sort((a, b) => a.d.localeCompare(b.d)).slice(0, 8);
  }
  function sisaLabel(sisa, d) { return sisa < 0 ? 'TERLAMBAT ' + -sisa + ' HARI' : sisa === 0 ? 'HARI INI (23:59)' : 'H-' + sisa + ' • ' + fmtTgl(d); }

  function renderDashboard(el) {
    const me = S.me, g = S.boot.g, admin = D.isAdmin(), t = todayYmd();
    const mineOpen = D.tugasSaya().filter((x) => D.statusTugas(x) !== 'Terkumpul');
    const mineUpcoming = mineOpen.filter((x) => (D.deadlineOf(x) || '9') >= t);
    const nextMine = mineUpcoming.slice().sort((a, b) => (D.deadlineOf(a) || '').localeCompare(D.deadlineOf(b) || ''))[0];
    const prog = progresMk();
    const tot = prog.reduce((a, x) => a + x.total, 0), sumF = prog.reduce((a, x) => a + x.makalah + x.ppt, 0), lengkap = prog.reduce((a, x) => a + x.lengkap, 0);
    const pctAll = tot ? ((sumF * 100) / (2 * tot)).toFixed(1) : '0';
    let heroTxt;
    if (admin) {
      const pend = D.pendingRegs().length, aktif = g.penugasan.filter((x) => D.statusTugas(x) !== 'Terkumpul').length;
      heroTxt = 'Ada <b>' + aktif + '</b> penugasan presentasi berjalan' + (pend ? ' dan <b>' + pend + '</b> pendaftar menunggu verifikasi' : '') + '. Pantau progres kelas mahasiswa P2K &amp; Reguler secara real-time.';
    } else heroTxt = 'Kamu memiliki <b>' + mineUpcoming.length + '</b> tugas presentasi mendatang dan <b>' + mineOpen.filter((x) => D.statusTugas(x) === 'Terlambat').length + '</b> tugas terlambat.' + (nextMine ? '' : ' Tetap pantau jadwal & materi kelas.');
    const heroNote = nextMine ? (() => { const p = D.ptmOf(nextMine), s = D.subs(nextMine.tugas_id), sisa = dayDiff(t, D.deadlineOf(nextMine));
      return '<div class="alert ' + (sisa <= 3 ? 'warn' : 'info') + ' mt12">' + ic('clock') + '<span><b>Sesi ' + p.nomor + ' ' + esc(D.mkOfPtm(p).kode || '') + ':</b> ' + (s.makalah ? 'Makalah ✓' : 'Makalah belum') + ' · ' + (s.ppt ? 'PPT ✓' : 'PPT belum') + ' — deadline ' + fmtTgl(D.deadlineOf(nextMine)) + ' (' + (sisa === 0 ? 'hari ini' : 'H-' + sisa) + ')</span></div>'; })()
      : (!admin && D.tugasSaya().length && !mineOpen.length ? '<div class="alert ok mt12">' + ic('circle-check') + '<span>Semua berkas tugas presentasi Anda sudah lengkap & tersinkron ke Google Drive.</span></div>' : '');

    // Penyelesaian sesi per MK
    const ses = D.mkAktif().slice(0, 4).map((m) => {
      const ps = S.idx.ptmByMk[m.mk_id] || [], done = ps.filter((p) => ptmStatus(p) === 'Selesai').length;
      return { m, p: pct(done, ps.length || 16), done, n: ps.length || 16 };
    });
    // Target
    const mhs = D.mhsList(D.jenisFilter());
    let targetCard;
    if (admin) {
      const tepat = mhs.filter((x) => x.status_target !== 'Berisiko'), ris = mhs.length - tepat.length;
      const per = ['P2K', 'Reguler'].map((j) => { const a = D.mhsList(j); const ok = a.filter((x) => x.status_target !== 'Berisiko').length; return { j, ok, n: a.length }; });
      targetCard = '<div class="card"><div class="card-h"><div><h3>Target Kelulusan Semester</h3></div><span class="small muted">Total: ' + mhs.length + ' Mahasiswa</span></div>' +
        '<div class="col gap6"><span class="chip green" style="align-self:flex-start">' + ic('circle-check') + tepat.length + ' Tepat Waktu (' + pct(tepat.length, mhs.length) + '%)</span>' +
        '<span class="chip amber" style="align-self:flex-start">' + ic('triangle-alert') + ris + ' Berisiko Terlambat (' + pct(ris, mhs.length) + '%)</span></div>' +
        per.filter((x) => !D.jenisFilter() || x.j === D.jenisFilter()).map((x) => '<div class="mt16"><div class="row between small"><span class="row gap6">' + chipJenis(x.j) + '<span>Mahasiswa ' + (x.j === 'P2K' ? 'Karyawan (Weekend)' : 'Reguler (Full-time)') + '</span></span><b class="tabnum">' + x.ok + '/' + x.n + ' (' + pct(x.ok, x.n) + '%)</b></div><div class="mt8">' + progress(pct(x.ok, x.n), x.j === 'P2K' ? 'deep' : '') + '</div></div>').join('') +
        '<div class="row between mt16 small muted" style="border-top:1px solid #EEF0F5;padding-top:12px"><span>Status dihitung otomatis dari target per mahasiswa</span><a href="#/laporan">Detail ' + ic('arrow-right') + '</a></div></div>';
    } else {
      const my = S.boot.u.target || [];
      targetCard = '<div class="card"><div class="card-h"><div><h3>Target Kelulusan Saya</h3><div class="sub">' + (S.idx.mhs[me.mhs_id] && S.idx.mhs[me.mhs_id].target_lulus_semester ? 'Target lulus: ' + esc(S.idx.mhs[me.mhs_id].target_lulus_semester) : 'Atur target pribadi hingga lulus') + '</div></div><a class="btn sm soft" href="#/rencana/target">' + ic('plus') + 'Target</a></div>' +
        (my.length ? my.slice(0, 4).map((x) => '<div class="mt12"><div class="row between small"><b class="semi ellipsis">' + esc(x.judul_target) + '</b>' + statusChip(x.status) + '</div><div class="mt8">' + progress(Number(x.progres || 0), x.status === 'Terlambat' ? 'amber' : x.status === 'Tercapai' ? 'green' : '') + '</div><div class="xs faint mt8">Tenggat ' + fmtTgl(x.tenggat) + ' · ' + (x.progres || 0) + '%</div></div>').join('')
          : '<div class="empty">' + ic('target') + '<br>Belum ada target. Tambahkan target semester lulus, proposal, atau seminar.</div>') + '</div>';
    }
    // Dosen & PIC
    const dosenIds = {}; D.mkAktif().forEach((m) => { if (m.dosen_id) (dosenIds[m.dosen_id] = dosenIds[m.dosen_id] || []).push(m.nama); });
    const ketua = g.users.filter((u) => u.role === 'KETUA');
    const dosenCard = '<div class="card"><div class="card-h"><h3>Dosen &amp; PIC Kelas</h3><span class="small muted">' + (Object.keys(dosenIds).length + ketua.length) + ' kontak</span></div><div class="col">' +
      Object.keys(dosenIds).slice(0, 4).map((id) => { const d = S.idx.dosen[id] || {}; return '<div class="tile row">' + avDsn(Object.assign({ dosen_id: id }, d), 'sm') + '<div class="grow"><b class="semi">' + profLink('dsn', id, d.nama || '-') + '</b><div class="small muted ellipsis">' + esc(dosenIds[id].join(', ')) + ' · Dosen</div></div>' + (d.email ? '<a class="btn icon sm ghost" href="mailto:' + esc(d.email) + '" title="Email">' + ic('mail') + '</a>' : '') + '</div>'; }).join('') +
      ketua.map((u) => { const km = S.idx.mhsEmail[String(u.email || '').toLowerCase()]; return '<div class="tile row">' + avUsr(u, 'sm') + '<div class="grow"><b class="semi">' + (km ? profLink('mhs', km.mhs_id, u.nama_lengkap) : profLink('usr', u.user_id, u.nama_lengkap)) + '</b><div class="small muted">Ketua Kelas · ' + esc(u.jenis_mahasiswa || '') + '</div></div><a class="btn icon sm ghost" href="mailto:' + esc(u.email) + '" title="Email">' + ic('mail') + '</a></div>'; }).join('') +
      (!Object.keys(dosenIds).length && !ketua.length ? '<div class="empty">Belum ada data dosen.</div>' : '') + '</div></div>';

    // Kalender
    const calMode = el._cal || 'hari';
    const calHtml = (() => {
      const today = new Date(), out = [];
      const days = calMode === 'hari' ? [0] : [0, 1, 2, 3, 4, 5, 6];
      days.forEach((off) => {
        const d = new Date(today); d.setDate(d.getDate() + off);
        const dYmd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const list = jadwalHari(d.getDay());
        if (calMode === 'minggu' && list.length) out.push('<div class="sec-t" style="margin-top:6px">' + esc(fmtTgl(dYmd, true)) + '</div>');
        list.forEach(({ j, m }) => {
          const p = (S.idx.ptmByMk[m.mk_id] || []).find((x) => ymd(x.tanggal) === dYmd) || nextPtm(m.mk_id, dYmd);
          const now = off === 0 && nowHM() >= j.jam_mulai && nowHM() <= (j.jam_selesai || '23:59');
          const tg = p ? (S.idx.tugasByPtm[p.pertemuan_id] || [])[0] : null;
          out.push('<div class="cal-row"><span class="tm">' + esc(j.jam_mulai) + '</span><a class="cal-item ' + (now ? 'now' : '') + '" href="#/mk/' + m.mk_id + '" style="color:inherit;display:block">' +
            (now ? '<div class="xs bold" style="letter-spacing:.05em">SESI SEDANG BERLANGSUNG</div>' : '<span class="chip ' + (j.jenis_kelas === 'P2K' ? 'p2k' : j.jenis_kelas === 'Reguler' ? 'reg' : 'blue') + '">' + esc(j.jenis_kelas && j.jenis_kelas !== 'Semua' ? 'Kelas ' + j.jenis_kelas : m.kode) + '</span>') +
            '<div class="bold mt8" style="font-size:16px">' + esc(m.nama) + '</div><div class="small muted">' + (p ? 'Pertemuan ' + p.nomor + ' · ' + esc(p.tema || p.jenis) : '') + (tg ? ' · ' + esc(petugasNames(tg)) : '') + '</div>' +
            '<div class="row small mt8 muted" style="gap:14px">' + ic('clock') + esc(j.jam_mulai + ' – ' + (j.jam_selesai || '')) + ' WIB<span>' + esc(j.ruang || '') + '</span></div></a></div>');
        });
      });
      return out.length ? out.join('') : '<div class="empty">' + ic('calendar-days') + '<br>Tidak ada jadwal kuliah ' + (calMode === 'hari' ? 'hari ini' : 'minggu ini') + '.</div>';
    })();
    const tgl = tenggatList();
    const ann = g.pengumuman.filter(K.annForMe).slice(0, 3);

    el.innerHTML = '<div class="dash"><div class="col" style="gap:20px">' +
      '<div class="card hero"><div><span class="chip blue">● ' + esc([g.settings.NAMA_INSTITUSI, g.settings.ANGKATAN_LABEL].filter(Boolean).join(' • ') || 'Portal Kelas') + '</span>' +
      '<h1>Halo, ' + esc(firstName(me.nama_lengkap)) + '!</h1><p>' + heroTxt + '</p>' + heroNote +
      '<div class="row mt16 wrap"><a href="#/rencana" class="btn text" style="padding-left:0">Lihat Jadwal Kuliah Lengkap ' + ic('arrow-right') + '</a></div><div class="xs faint">Update terakhir: ' + fmtRel(S.boot.t) + '</div></div><div class="art">' + HERO_ART + '</div></div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-h"><div><h3>Progres Makalah &amp; PPT</h3><div class="sub">Rasio submisi materi presentasi semester berjalan</div></div><span class="chip">' + esc((D.smtAktif().nama_semester || '').replace(/^Semester\s*/i, '')) + '</span></div>' +
      '<div class="row wrap" style="border-bottom:1px solid #EEF0F5;padding-bottom:12px"><span class="stat">' + pctAll + '%</span><span class="chip green">' + lengkap + '/' + tot + ' lengkap</span><span class="grow"></span><span class="legend"><span><i style="background:#3F55A8"></i>Makalah</span><span><i style="background:#5B74DB"></i>Slide PPT</span></span></div>' +
      (prog.length ? bars(prog.map((x) => ({ x: x.m.kode, title: x.m.nama, a: pct(x.makalah, x.total), b: pct(x.ppt, x.total), av: x.makalah + '/' + x.total + ' makalah', bv: x.ppt + '/' + x.total + ' PPT' })), 100) : '<div class="empty">Belum ada mata kuliah aktif.</div>') +
      '<div class="tile row between small mt12"><span class="muted">' + (tot ? tot + ' penugasan presentasi tercatat semester ini' : 'Belum ada penugasan presentasi') + '</span><a href="#/laporan">Detail ' + ic('arrow-right') + '</a></div></div>' +
      '<div class="card"><div class="card-h"><div><h3>Penyelesaian Sesi</h3><div class="sub">Pertemuan terlaksana dari 16 per mata kuliah</div></div></div>' +
      (ses.length ? '<div class="donut-grid">' + ses.map((x) => '<a class="donut-tile" href="#/mk/' + x.m.mk_id + '" style="color:inherit">' + donut(x.p, { size: 84, stroke: 9 }) + '<div class="t ellipsis">' + esc(x.m.nama) + '</div><div class="s">Sesi ' + x.done + ' dari ' + x.n + '</div></a>').join('') + '</div>' : '<div class="empty">Belum ada data.</div>') +
      '<div class="row small muted mt12"><span class="chip green dot">Hijau</span> ≥ 90% · <span class="chip blue dot">Biru</span> ≥ 60%</div></div>' +
      '</div><div class="grid g2">' + targetCard + dosenCard + '</div></div>' +
      '<div class="col right" style="gap:20px">' +
      (K.appLinks().length ? '<div class="card" id="appCard"><div class="card-h"><div><h3 class="row gap6">' + ic('layout-grid') + 'Aplikasi Lain</h3><div class="sub">Akses cepat aplikasi kampus & kelas</div></div>' + (D.isOp() ? '<a class="small" href="#/settings/apps">Atur</a>' : '') + '</div>' + K.appTiles(K.appLinks()) + '</div>' : '') +
      '<div class="card"><div class="card-h"><div><h3>Kalender Kuliah</h3><div class="sub">' + esc(fmtTgl(todayYmd(), true)) + '</div></div><div class="seg"><button data-cal="hari" class="' + (calMode === 'hari' ? 'on' : '') + '">Hari Ini</button><button data-cal="minggu" class="' + (calMode === 'minggu' ? 'on' : '') + '">7 Hari</button></div></div><div class="col">' + calHtml + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Tenggat Waktu Penting</h3><a class="small" href="#/rencana">Semua</a></div><div class="col">' +
      (tgl.length ? tgl.map((x) => '<a class="dl-item ' + (x.sisa <= 1 ? 'urgent' : '') + '" href="' + x.href + '" style="color:inherit"><span class="ic">' + ic(x.ic) + '</span><div class="grow" style="min-width:0"><div class="k">' + esc(sisaLabel(x.sisa, x.d)) + '</div><b class="ellipsis">' + esc(x.t) + '</b><div class="small muted">' + esc(x.s) + '</div></div></a>').join('') : '<div class="empty">' + ic('circle-check') + '<br>Tidak ada tenggat dalam 3 minggu ke depan.</div>') + '</div></div>' +
      '<div class="card"><div class="card-h"><h3 class="row gap6">' + ic('megaphone') + 'Pengumuman Terkini</h3>' + (D.unreadAnn().length ? '<span class="chip amber">' + D.unreadAnn().length + ' Baru</span>' : '') + '</div><div class="col">' +
      (ann.length ? ann.map((p) => '<div class="ann-item ' + (S.idx.dibaca[p.pengumuman_id] ? '' : 'unread') + '" data-ann="' + p.pengumuman_id + '"><div class="row between"><span class="row gap4">' + kanalChips(p) + '</span><span class="xs faint">' + fmtRel(p.tanggal) + '</span></div><b class="semi" style="display:block;margin:6px 0 2px">' + esc(p.judul) + '</b><div class="small muted ellipsis">' + esc(p.isi) + '</div></div>').join('') : '<div class="empty">Belum ada pengumuman.</div>') +
      (admin ? '<button class="btn soft block" data-new-ann>' + ic('plus') + 'Buat Pengumuman Baru</button>' : '') + '</div></div></div></div>';

    $$('[data-cal]', el).forEach((b) => (b.onclick = () => { el._cal = b.dataset.cal; renderDashboard(el); }));
    $$('[data-ann]', el).forEach((a) => (a.onclick = () => openAnn(g.pengumuman.find((p) => p.pengumuman_id === a.dataset.ann))));
    const na = $('[data-new-ann]', el); if (na) na.onclick = () => annForm();
  }
  K.registerPage('dashboard', { title: 'Dashboard', show: renderDashboard });

  // ============================================================== MATA KULIAH
  function mkIndex(el) {
    const list = D.mkAktif();
    el.innerHTML = '<div class="page-h"><div><h1>Mata Kuliah</h1><div class="sub">' + esc(D.smtAktif().nama_semester || '') + ' · ' + list.length + ' mata kuliah aktif, masing-masing 16 pertemuan.</div></div>' + (D.isAdmin() ? '<a class="btn" href="#/master/mk">' + ic('plus') + 'Kelola Mata Kuliah</a>' : '') + '</div>' +
      (list.length ? '<div class="grid g3">' + list.map((m) => {
        const ps = S.idx.ptmByMk[m.mk_id] || [], done = ps.filter((p) => ptmStatus(p) === 'Selesai').length, ts = D.tugasMk(m.mk_id), ok = ts.filter((t) => D.statusTugas(t) === 'Terkumpul').length;
        const j = (S.idx.jadwalByMk[m.mk_id] || [])[0], d = S.idx.dosen[m.dosen_id] || {};
        return '<a class="card kpi-click" href="#/mk/' + m.mk_id + '" style="color:inherit;display:block"><div class="row between"><span class="chip blue">' + esc(m.kode) + '</span><span class="chip">' + esc(m.sks || '-') + ' SKS</span></div>' +
          '<h3 style="font-size:17px;margin:12px 0 4px">' + esc(m.nama) + '</h3><div class="small muted">' + esc(d.nama || 'Dosen belum diatur') + '</div>' +
          '<div class="small muted mt8">' + ic('clock') + ' ' + (j ? esc(j.hari + ', ' + j.jam_mulai + '–' + (j.jam_selesai || '') + ' · ' + (j.ruang || '')) : 'Jadwal belum diatur') + '</div>' +
          '<div class="row mt16 small"><span class="grow">Sesi ' + done + '/16</span><b>' + pct(done, 16) + '%</b></div><div class="mt8">' + progress(pct(done, 16)) + '</div>' +
          '<div class="row mt12 small"><span class="grow">Berkas lengkap ' + ok + '/' + ts.length + '</span><b>' + pct(ok, ts.length) + '%</b></div><div class="mt8">' + progress(pct(ok, ts.length), 'green') + '</div></a>';
      }).join('') + '</div>' : '<div class="card empty">' + ic('book-open') + '<br>Belum ada mata kuliah aktif di semester ini.</div>');
  }

  function renderMk(el, id) {
    if (!id) return mkIndex(el);
    const m = S.idx.mk[id];
    if (!m) { el.innerHTML = '<div class="card empty">Mata kuliah tidak ditemukan.</div>'; return; }
    const st = (el._st && el._st.id === id) ? el._st : (el._st = { id, tab: 'sesi', sel: null, filter: 'Semua', range: 'all' });
    const ps = S.idx.ptmByMk[id] || [], ts = D.tugasMk(id), d = S.idx.dosen[m.dosen_id] || {}, jd = S.idx.jadwalByMk[id] || [];
    const okT = ts.filter((t) => D.statusTugas(t) === 'Terkumpul').length;
    const subsMk = S.boot.g.submission.filter((s) => S.idx.tugas[s.tugas_id] && D.ptmOf(S.idx.tugas[s.tugas_id]).mk_id === id);
    const refs = S.idx.refByMk[id] || [], notulen = ps.reduce((a, p) => a.concat(S.idx.notulenByPtm[p.pertemuan_id] || []), []);
    const t = todayYmd(), next = ps.find((p) => (ymd(p.tanggal) || '0') >= t);
    if (!st.sel) st.sel = (next || ps[0] || {}).pertemuan_id;
    const smt = S.idx.smt[m.semester_id] || {}, mhsAll = D.mhsList();
    const tabs = [['sesi', 'Daftar 16 Pertemuan', 16], ['petugas', 'Petugas & Tema', ts.length], ['materi', 'Materi & Makalah', subsMk.length], ['notulen', 'Notulen Pembelajaran', notulen.length], ['ref', 'Referensi', refs.length]];
    el.innerHTML = '<div class="crumb"><a href="#/mk">' + ic('book-open') + 'Mata Kuliah</a>' + ic('chevron-right') + '<span>' + esc(m.kode) + '</span>' + ic('chevron-right') + '<b>' + esc(tabs.find((x) => x[0] === st.tab)[1]) + '</b></div>' +
      '<div class="card pad-lg mk-head"><div><div class="row wrap gap6"><span class="chip">KODE: ' + esc(m.kode) + '</span><span class="chip blue">' + esc(m.sks || '-') + ' SKS</span><span class="chip">' + esc(smt.nama_semester || '') + '</span>' + (jd.length ? jd.map((j) => '<span class="chip green dot">' + esc(j.jenis_kelas === 'Semua' || !j.jenis_kelas ? 'Kelas Paralel P2K & Reguler' : 'Kelas ' + j.jenis_kelas) + '</span>').join('') : '') + '</div>' +
      '<h1>' + esc(m.nama) + '</h1>' + (m.deskripsi ? '<p class="muted" style="margin:0 0 12px;line-height:1.6">' + esc(m.deskripsi) + '</p>' : '') +
      '<div class="row wrap" style="gap:18px">' + '<div class="row">' + (m.dosen_id && S.idx.dosen[m.dosen_id] ? avDsn(d, 'sm') : avatar(d.nama, 'sm')) + '<div><b class="semi">' + (m.dosen_id && S.idx.dosen[m.dosen_id] ? profLink('dsn', m.dosen_id, d.nama) : esc(d.nama || 'Dosen belum diatur')) + '</b><div class="xs muted">' + esc(d.bidang || 'Dosen pengampu') + '</div></div></div>' +
      jd.map((j) => '<div class="row">' + ic('calendar-days') + '<div><b class="semi">' + esc(j.hari + ', ' + j.jam_mulai + ' – ' + (j.jam_selesai || '')) + ' WIB</b><div class="xs muted">' + esc(j.ruang || '-') + '</div></div></div>').join('') + '</div></div>' +
      '<div class="tile row" style="gap:16px">' + donut(pct(okT, ts.length), { size: 92, stroke: 9 }) + '<div><div class="xs bold" style="color:var(--green-ink);letter-spacing:.05em">KELENGKAPAN BERKAS</div><div class="stat">' + okT + ' / ' + ts.length + '</div><div class="small muted">Penugasan lengkap</div></div></div></div>' +
      '<div class="grid g4 keep2 mt20">' +
      kpi('Struktur Pertemuan', '16 Sesi', '7 Pra-UTS · UTS · 7 Pra-UAS · UAS', 'columns-3') +
      kpi('Makalah & PPT Terkumpul', okT + ' / ' + ts.length, pct(okT, ts.length) + '% kelengkapan', 'circle-check', 'green') +
      kpi('Modul Belajar', (subsMk.length + refs.length + notulen.length) + ' Berkas', 'Makalah, slide, notulen & referensi', 'folder-open', 'amber') +
      kpi('Mahasiswa Kelas', mhsAll.length + ' Orang', mhsAll.filter((x) => x.jenis_mahasiswa === 'P2K').length + ' P2K · ' + mhsAll.filter((x) => x.jenis_mahasiswa === 'Reguler').length + ' Reguler', 'users') + '</div>' +
      '<div class="row between wrap mt20"><div class="tabs" style="margin:0">' + tabs.map((x) => '<button class="tab ' + (st.tab === x[0] ? 'active' : '') + '" data-tab="' + x[0] + '">' + esc(x[1]) + ' <span class="n">' + x[2] + '</span></button>').join('') + '</div>' +
      '<div class="row gap6 wrap">' + (D.isAdmin() ? '<button class="btn ghost sm" data-jadwal>' + ic('calendar-range') + 'Atur Tanggal</button><button class="btn ghost sm" data-tema>' + ic('file-spreadsheet') + 'Import Tema (Excel)</button><button class="btn ghost sm" data-assign>' + ic('users') + 'Kelola Penugasan</button>' : '') + '<button class="btn sm" data-addref>' + ic('plus') + 'Referensi / Modul</button></div></div><div class="mt16" id="mkBody"></div>';
    $$('[data-tab]', el).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; renderMk(el, id); }));
    const as = $('[data-assign]', el); if (as) as.onclick = () => penugasanForm({ mk_id: id, pertemuan_id: st.sel });
    $('[data-addref]', el).onclick = () => referensiForm({ mk_id: id });
    const jb = $('[data-jadwal]', el); if (jb) jb.onclick = () => jadwalkanForm(id);
    const tb = $('[data-tema]', el); if (tb) tb.onclick = () => temaImportForm(id);
    const body = $('#mkBody', el);
    if (st.tab === 'sesi') renderSesiTab(body, m, ps, st, el);
    else if (st.tab === 'petugas') renderPetugasTab(body, m, ps);
    else if (st.tab === 'materi') renderMateriTab(body, subsMk, st, el);
    else if (st.tab === 'notulen') renderNotulenTab(body, m, ps, notulen);
    else renderRefTab(body, m, refs);
  }
  function kpi(lbl, val, sub, icn, cls) { return '<div class="card kpi"><div style="min-width:0"><div class="lbl">' + esc(lbl) + '</div><div class="stat mt8">' + esc(val) + '</div><div class="small muted">' + esc(sub) + '</div></div><span class="ic ' + (cls || '') + '">' + ic(icn) + '</span></div>'; }

  function renderSesiTab(body, m, ps, st, root) {
    const t = todayYmd(), next = ps.find((p) => (ymd(p.tanggal) || '0') >= t);
    const flt = st.range;
    const list = ps.filter((p) => flt === 'all' || (flt === 'pra' ? Number(p.nomor) <= 8 : Number(p.nomor) > 8));
    body.innerHTML = '<div class="split"><div><div class="card" style="padding:14px 18px;margin-bottom:12px"><div class="row between wrap"><h3 style="font-size:16px">Rangkaian Kuliah</h3><div class="seg"><button data-r="all" class="' + (flt === 'all' ? 'on' : '') + '">Semua</button><button data-r="pra" class="' + (flt === 'pra' ? 'on' : '') + '">1–8</button><button data-r="pasca" class="' + (flt === 'pasca' ? 'on' : '') + '">9–16</button></div></div></div><div class="sesi-list">' +
      list.map((p) => {
        const tg = S.idx.tugasByPtm[p.pertemuan_id] || [], uj = p.jenis !== 'Pembelajaran', isNext = next && p.pertemuan_id === next.pertemuan_id;
        const stt = ptmStatus(p), tg0 = tg[0];
        let sub = uj ? (p.jenis === 'UTS' ? 'Ujian Tengah Semester — bebas tugas presentasi' : 'Ujian Akhir Semester — bebas tugas presentasi') : (tg0 ? 'Pemakalah: ' + petugasNames(tg0) + (tg.length > 1 ? ' +' + (tg.length - 1) + ' kelompok' : '') : 'Petugas belum ditetapkan');
        const chip = uj ? '<span class="chip violet">' + esc(p.jenis) + '</span>' : (tg0 ? statusChip(D.statusTugas(tg0)) : statusChip(stt));
        return '<div class="sesi ' + (uj ? 'ujian ' : '') + (isNext && !uj ? 'next ' : '') + (st.sel === p.pertemuan_id ? 'sel' : '') + '" data-ptm="' + p.pertemuan_id + '"><span class="no"><small>SESI</small>' + String(p.nomor).padStart(2, '0') + '</span><div class="grow" style="min-width:0">' +
          (isNext ? '<div class="xs bold" style="letter-spacing:.05em;margin-bottom:2px">' + (ymd(p.tanggal) === t ? 'HARI INI • ' : 'BERIKUTNYA • ') + esc(fmtTgl(p.tanggal)) + '</div>' : '') +
          '<div class="tt ellipsis">' + esc(p.tema || (uj ? p.jenis : 'Tema belum ditetapkan')) + '</div><div class="small muted ellipsis">' + (isNext ? '' : esc(fmtTgl(p.tanggal)) + ' · ') + esc(sub) + '</div></div>' + chip + '</div>';
      }).join('') + '</div></div><div class="detail-panel" id="ptmDetail"></div></div>';
    $$('[data-r]', body).forEach((b) => (b.onclick = () => { st.range = b.dataset.r; renderSesiTab(body, m, ps, st, root); }));
    $$('[data-ptm]', body).forEach((r) => (r.onclick = () => { st.sel = r.dataset.ptm; $$('.sesi', body).forEach((x) => x.classList.toggle('sel', x === r)); renderPtmDetail($('#ptmDetail', body), S.idx.ptm[st.sel]); if (window.innerWidth < 1101) $('#ptmDetail', body).scrollIntoView({ behavior: 'smooth' }); }));
    renderPtmDetail($('#ptmDetail', body), S.idx.ptm[st.sel]);
  }

  function fileRow(sub, label, t) {
    if (!sub) return '<div class="file-row" style="opacity:.75"><span class="file-ic">' + ic('file') + '</span><div class="grow"><b class="semi">' + esc(label) + '</b><div class="small muted">Belum diunggah</div></div>' +
      (t && canUpload(t) ? '<button class="btn sm ' + (D.statusTugas(t) === 'Terlambat' ? 'amber' : '') + '" data-up="' + t.tugas_id + '" data-jenis="' + (label === 'Makalah' ? 'Makalah' : 'PPT') + '">' + ic('upload') + 'Unggah</button>' : '') + '</div>';
    const k = fileKind(sub.nama_file, sub.mime);
    return '<div class="file-row"><span class="file-ic ' + k.k + '">' + ic(k.ic) + '</span><div class="grow" style="min-width:0"><b class="semi ellipsis" style="display:block">' + esc(sub.nama_file) + '</b><div class="small muted">' + esc(label) + ' · ' + fmtSize(sub.ukuran) + ' · ' + fmtRel(sub.tanggal_unggah) + '</div></div>' +
      '<button class="btn xs" data-view-sub="' + sub.submission_id + '">' + ic('eye') + 'Lihat</button><button class="btn icon sm ghost" title="Unduh" data-dl="' + sub.drive_file_id + '" data-nm="' + esc(sub.nama_file) + '">' + ic('download') + '</button>' +
      (t && canUpload(t) ? '<button class="btn icon sm ghost" title="Ganti berkas" data-up="' + t.tugas_id + '" data-jenis="' + (label === 'Makalah' ? 'Makalah' : 'PPT') + '">' + ic('refresh-cw') + '</button>' : '') + '</div>';
  }
  function bindFileActions(host) {
    $$('[data-view-sub]', host).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const s = S.boot.g.submission.find((x) => x.submission_id === b.dataset.viewSub); if (s) viewSub(s); }));
    $$('[data-dl]', host).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); downloadFile(b.dataset.dl, b.dataset.nm, b); }));
    $$('[data-up]', host).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); uploadForm(S.idx.tugas[b.dataset.up], b.dataset.jenis); }));
  }
  function viewSub(s) {
    const t = S.idx.tugas[s.tugas_id] || {}, p = D.ptmOf(t);
    openViewer({ fileId: s.drive_file_id, nama: s.nama_file, mime: s.mime, ukuran: s.ukuran, title: s.nama_file, info: (s.jenis_file === 'PPT' ? 'Slide' : 'Makalah') + ' · Pertemuan ' + (p.nomor || '-') + ' · ' + D.namaUser(s.pengirim_id) });
  }
  function renderPtmDetail(host, p) {
    if (!host) return;
    if (!p) { host.innerHTML = '<div class="card empty">Pilih pertemuan.</div>'; return; }
    const tg = S.idx.tugasByPtm[p.pertemuan_id] || [], uj = p.jenis !== 'Pembelajaran', nt = S.idx.notulenByPtm[p.pertemuan_id] || [];
    host.innerHTML = '<div class="card"><div class="row between"><span class="small bold" style="color:var(--primary-ink);letter-spacing:.04em">DETAIL SESI ' + p.nomor + ' • ' + esc(fmtTgl(p.tanggal).toUpperCase()) + '</span>' + statusChip(ptmStatus(p)) + '</div>' +
      '<h3 style="font-size:19px;margin:8px 0 4px;line-height:1.35">' + esc(p.tema || (uj ? p.jenis : 'Tema belum ditetapkan')) + '</h3>' +
      (D.isAdmin() ? '<div class="row wrap gap6 mt8"><button class="btn xs ghost" data-edit-ptm>' + ic('pencil') + 'Kelola Sesi</button>' + (!uj ? '<button class="btn xs soft" data-new-tugas>' + ic('user-plus') + 'Tetapkan Petugas &amp; Tema</button>' : '') + '</div>' : '') +
      (uj ? '<div class="alert info mt16">' + ic('info') + '<span>Pertemuan ' + p.nomor + ' adalah <b>' + esc(p.jenis) + '</b> — tidak ada penugasan presentasi.</span></div>' : '') +
      (!uj && !tg.length ? '<div class="empty">' + ic('users') + '<br>Belum ada petugas presentasi untuk sesi ini.</div>' : '') +
      tg.map((t) => {
        const s = D.subs(t.tugas_id), stt = D.statusTugas(t);
        return '<div class="sec-t">TIM PEMAKALAH (' + esc(t.tipe) + ')<span class="row gap6">' + statusChip(stt) + (D.isAdmin() ? '<button class="btn icon sm text" title="Ubah" data-edit-tugas="' + t.tugas_id + '">' + ic('pencil') + '</button><button class="btn icon sm text" title="Hapus" data-del-tugas="' + t.tugas_id + '">' + ic('trash-2') + '</button>' : '') + '</span></div>' +
          '<div class="grid g2" style="gap:8px">' + (t.petugas_ids || []).map((id, i) => { const x = S.idx.mhs[id] || {}; return '<div class="team-card">' + (x.mhs_id ? avMhs(x, 'sm') : avatar(x.nama_lengkap, 'sm')) + '<div style="min-width:0"><b class="semi ellipsis" style="display:block;font-size:13px">' + (x.mhs_id ? profLink('mhs', id, x.nama_lengkap) : esc(id)) + '</b><div class="xs muted">' + esc(x.nim ? 'NIM ' + x.nim : '') + ' ' + (x.jenis_mahasiswa || '') + (t.tipe === 'Kelompok' ? ' · ' + (i === 0 ? 'Moderator' : 'Presenter') : '') + '</div></div></div>'; }).join('') + '</div>' +
          (t.tema !== p.tema ? '<div class="small mt8"><b>Tema:</b> ' + esc(t.tema) + '</div>' : '') +
          '<div class="row wrap gap6 mt8"><span class="chip ' + (stt === 'Terlambat' ? 'red' : 'amber') + '">' + ic('clock') + 'Deadline makalah ' + esc(fmtTgl(t.deadline_makalah)) + '</span>' + (t.tanggal_presentasi ? '<span class="chip">' + ic('presentation') + 'Presentasi ' + esc(fmtTgl(t.tanggal_presentasi)) + '</span>' : '') + '</div>' +
          '<div class="sec-t">BERKAS MAKALAH UTAMA</div>' + fileRow(s.makalah, 'Makalah', t) + '<div class="sec-t">SLIDE PRESENTASI (PPT)</div>' + fileRow(s.ppt, 'Slide PPT', t) +
          (s.makalah && s.ppt ? '<div class="alert ok mt12">' + ic('cloud-check') + '<span>Tersinkronisasi ke Google Drive & tampil sebagai modul belajar kelas.</span></div>' : '');
      }).join('') +
      '<div class="sec-t">NOTULEN PEMBELAJARAN <button class="btn xs soft" data-new-notulen>' + ic('notebook-pen') + 'Tulis Notulen</button></div>' +
      (nt.length ? nt.map((n) => notulenItem(n)).join('') : '<div class="tile small muted">Belum ada notulen untuk sesi ini.</div>') + '</div>';
    bindFileActions(host);
    bindNotulen(host);
    const ep = $('[data-edit-ptm]', host); if (ep) ep.onclick = () => ptmForm(p);
    const nw = $('[data-new-tugas]', host); if (nw) nw.onclick = () => penugasanForm({ mk_id: p.mk_id, pertemuan_id: p.pertemuan_id });
    $$('[data-edit-tugas]', host).forEach((b) => (b.onclick = () => penugasanForm({ tugas: S.idx.tugas[b.dataset.editTugas] })));
    $$('[data-del-tugas]', host).forEach((b) => (b.onclick = () => hapusTugas(S.idx.tugas[b.dataset.delTugas])));
    $('[data-new-notulen]', host).onclick = () => notulenForm({ pertemuan_id: p.pertemuan_id, mk_id: p.mk_id });
  }
  function notulenItem(n) {
    const own = D.isAdmin() || n.pengunggah_id === S.me.user_id, k = n.drive_file_id ? fileKind(n.nama_file, n.mime) : null;
    return '<div class="tile mb8"><div class="row between"><b class="semi">' + esc(n.judul) + '</b>' + (own ? '<span class="row gap4"><button class="btn icon sm text" data-edit-ntl="' + n.notulen_id + '">' + ic('pencil') + '</button><button class="btn icon sm text" data-del-ntl="' + n.notulen_id + '">' + ic('trash-2') + '</button></span>' : '') + '</div>' +
      '<div class="xs muted">' + esc(D.namaUser(n.pengunggah_id)) + ' · ' + fmtRel(n.tanggal) + '</div>' + (n.isi ? '<div class="small mt8" style="white-space:pre-wrap;line-height:1.55;max-height:160px;overflow:auto">' + esc(n.isi) + '</div>' : '') +
      (k ? '<div class="row mt8"><button class="btn xs ghost" data-view-ntl="' + n.notulen_id + '">' + ic(k.ic) + esc(n.nama_file) + '</button></div>' : '') + '</div>';
  }
  function bindNotulen(host) {
    $$('[data-edit-ntl]', host).forEach((b) => (b.onclick = () => { const n = S.boot.g.notulen.find((x) => x.notulen_id === b.dataset.editNtl); notulenForm({ notulen: n, pertemuan_id: n.pertemuan_id }); }));
    $$('[data-del-ntl]', host).forEach((b) => (b.onclick = async () => {
      const n = S.boot.g.notulen.find((x) => x.notulen_id === b.dataset.delNtl); if (!(await confirmDlg('Hapus notulen?', 'Notulen "' + esc(n.judul) + '" akan dihapus.', { danger: true, ok: 'Hapus' }))) return;
      const g = S.boot.g, i = g.notulen.indexOf(n);
      mutate('notulen.delete', { notulen_id: n.notulen_id }, { optimistic: () => g.notulen.splice(i, 1), rollback: () => g.notulen.splice(i, 0, n) });
    }));
    $$('[data-view-ntl]', host).forEach((b) => (b.onclick = () => { const n = S.boot.g.notulen.find((x) => x.notulen_id === b.dataset.viewNtl); openViewer({ fileId: n.drive_file_id, nama: n.nama_file, mime: n.mime, ukuran: n.ukuran, info: 'Notulen' }); }));
  }

  function bebanMap() {
    const smt = D.smtAktifId(), map = {};
    S.boot.g.penugasan.forEach((t) => { const mk = D.mkOfPtm(D.ptmOf(t)); if (smt && mk.semester_id !== smt) return; (t.petugas_ids || []).forEach((id) => (map[id] = (map[id] || 0) + 1)); });
    return map;
  }
  function renderPetugasTab(body, m, ps) {
    const beban = bebanMap(), mhs = D.mhsList(D.jenisFilter());
    const maxB = Math.max(1, ...mhs.map((x) => beban[x.mhs_id] || 0));
    body.innerHTML = '<div class="split"><div class="card" id="ptgTbl"></div><div class="card"><div class="card-h"><div><h3>Beban Penugasan per Mahasiswa</h3><div class="sub">Semua mata kuliah semester aktif — agar pembagian merata</div></div></div>' +
      mhs.slice().sort((a, b) => (beban[a.mhs_id] || 0) - (beban[b.mhs_id] || 0)).map((x) => '<div class="beban"><span class="row gap6" style="min-width:0">' + avMhs(x, 'xs') + '<span class="ellipsis">' + profLink('mhs', x.mhs_id, x.nama_lengkap) + '</span>' + chipJenis(x.jenis_mahasiswa) + '</span>' + progress(pct(beban[x.mhs_id] || 0, maxB), (beban[x.mhs_id] || 0) === 0 ? 'amber' : '') + '<b class="tabnum">' + (beban[x.mhs_id] || 0) + '</b></div>').join('') + '</div></div>';
    const rows = ps.filter((p) => p.jenis === 'Pembelajaran').map((p) => ({ p, t: (S.idx.tugasByPtm[p.pertemuan_id] || [])[0] }));
    table($('#ptgTbl', body), {
      rows, per: 20, placeholder: 'Cari tema / petugas…', search: (r) => (r.p.tema || '') + ' ' + (r.t ? petugasNames(r.t) + ' ' + r.t.tema : ''),
      cols: [
        { k: 'no', t: 'Sesi', sortVal: (r) => Number(r.p.nomor), render: (r) => '<b>' + String(r.p.nomor).padStart(2, '0') + '</b><div class="xs muted">' + esc(fmtTgl(r.p.tanggal)) + '</div>' },
        { k: 'tema', t: 'Tema', sortVal: (r) => (r.t || r.p).tema, render: (r) => '<span class="semi">' + esc((r.t && r.t.tema) || r.p.tema || '—') + '</span>' },
        { k: 'ptg', t: 'Petugas', sort: false, render: (r) => (r.t ? '<span class="chip">' + esc(r.t.tipe) + '</span> ' + esc(petugasNames(r.t)) : '<span class="faint">Belum ditetapkan</span>') },
        { k: 'dl', t: 'Deadline', sortVal: (r) => (r.t ? r.t.deadline_makalah : ''), render: (r) => (r.t ? esc(fmtTgl(r.t.deadline_makalah)) : '—') },
        { k: 'st', t: 'Status', sortVal: (r) => (r.t ? D.statusTugas(r.t) : ''), render: (r) => (r.t ? statusChip(D.statusTugas(r.t)) : '') },
        { k: 'aksi', t: '', sort: false, render: (r) => (D.isAdmin() ? '<button class="btn xs ' + (r.t ? 'ghost' : 'soft') + '" data-asg="' + r.p.pertemuan_id + '" data-tid="' + (r.t ? r.t.tugas_id : '') + '">' + ic(r.t ? 'pencil' : 'user-plus') + (r.t ? 'Ubah' : 'Tetapkan') + '</button>' : '') }
      ],
      after: (tb) => $$('[data-asg]', tb).forEach((b) => (b.onclick = () => (b.dataset.tid ? penugasanForm({ tugas: S.idx.tugas[b.dataset.tid] }) : penugasanForm({ mk_id: m.mk_id, pertemuan_id: b.dataset.asg }))))
    });
  }
  function renderMateriTab(body, subs, st, root) {
    const f = st.filter;
    const list = subs.filter((s) => f === 'Semua' || (f === 'Makalah' ? s.jenis_file === 'Makalah' : s.jenis_file === 'PPT')).sort((a, b) => String(b.tanggal_unggah).localeCompare(String(a.tanggal_unggah)));
    body.innerHTML = '<div class="row between wrap mb12"><div class="seg">' + ['Semua', 'Makalah', 'PPT'].map((x) => '<button data-f="' + x + '" class="' + (f === x ? 'on' : '') + '">' + x + '</button>').join('') + '</div><span class="small muted">Klik berkas untuk membuka pratinjau di dalam aplikasi</span></div>' +
      (list.length ? '<div class="file-grid">' + list.map((s) => { const t = S.idx.tugas[s.tugas_id] || {}, p = D.ptmOf(t), k = fileKind(s.nama_file, s.mime);
        return '<div class="file-card" data-view-sub="' + s.submission_id + '"><div class="thumb"><span class="file-ic ' + k.k + '" style="width:56px;height:56px">' + ic(k.ic) + '</span></div><div style="min-width:0"><b class="semi ellipsis" style="display:block">' + esc(s.nama_file) + '</b><div class="small muted ellipsis">Sesi ' + (p.nomor || '-') + ' · ' + esc(t.tema || '') + '</div></div><div class="row between small"><span class="chip ' + (s.jenis_file === 'PPT' ? 'amber' : 'blue') + '">' + (s.jenis_file === 'PPT' ? 'Slide' : 'Makalah') + '</span><span class="muted">' + fmtSize(s.ukuran) + '</span><button class="btn icon sm ghost" data-dl="' + s.drive_file_id + '" data-nm="' + esc(s.nama_file) + '" title="Unduh">' + ic('download') + '</button></div></div>'; }).join('') + '</div>'
        : '<div class="card empty">' + ic('folder-open') + '<br>Belum ada berkas makalah/slide yang diunggah.</div>');
    $$('[data-f]', body).forEach((b) => (b.onclick = () => { st.filter = b.dataset.f; renderMateriTab(body, subs, st, root); }));
    bindFileActions(body);
  }
  function renderNotulenTab(body, m, ps, notulen) {
    body.innerHTML = '<div class="row between mb12"><span class="muted small">Semua anggota dapat menulis & membaca notulen.</span><button class="btn sm" data-new>' + ic('notebook-pen') + 'Tulis Notulen</button></div>' +
      (notulen.length ? '<div class="grid g2">' + ps.filter((p) => (S.idx.notulenByPtm[p.pertemuan_id] || []).length).reverse().map((p) => '<div class="card"><div class="card-h"><h3>Pertemuan ' + p.nomor + '</h3><span class="small muted">' + esc(fmtTgl(p.tanggal)) + '</span></div>' + (S.idx.notulenByPtm[p.pertemuan_id] || []).map(notulenItem).join('') + '</div>').join('') + '</div>'
        : '<div class="card empty">' + ic('notebook-pen') + '<br>Belum ada notulen.</div>');
    $('[data-new]', body).onclick = () => notulenForm({ mk_id: m.mk_id });
    bindNotulen(body);
  }
  function renderRefTab(body, m, refs) {
    const list = refs.slice().sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
    body.innerHTML = (list.length ? '<div class="file-grid">' + list.map((r) => { const yt = r.tipe === 'YouTube', k = fileKind(r.nama_file, r.mime), own = D.isAdmin() || r.pengunggah_id === S.me.user_id;
      return '<div class="file-card" data-ref="' + r.ref_id + '"><div class="thumb" ' + (yt ? 'style="background-image:url(https://i.ytimg.com/vi/' + ytId(r.url_embed) + '/hqdefault.jpg)"' : '') + '>' + (yt ? '<span class="play">' + ic('play') + '</span>' : '<span class="file-ic ' + k.k + '" style="width:56px;height:56px">' + ic(r.tipe === 'E-book' ? 'book-marked' : k.ic) + '</span>') + '</div>' +
        '<div style="min-width:0"><b class="semi ellipsis" style="display:block">' + esc(r.judul) + '</b><div class="small muted ellipsis">' + esc(D.namaUser(r.pengunggah_id)) + ' · ' + fmtRel(r.tanggal) + '</div></div><div class="row between small"><span class="chip ' + (yt ? 'red' : r.tipe === 'E-book' ? 'violet' : 'blue') + '">' + esc(r.tipe) + '</span><span class="row gap4">' +
        (!yt ? '<button class="btn icon sm ghost" data-dl="' + r.drive_file_id + '" data-nm="' + esc(r.nama_file) + '" title="Unduh">' + ic('download') + '</button>' : '') + (own ? '<button class="btn icon sm ghost" data-del-ref="' + r.ref_id + '" title="Hapus">' + ic('trash-2') + '</button>' : '') + '</span></div></div>'; }).join('') + '</div>'
      : '<div class="card empty">' + ic('book-marked') + '<br>Belum ada referensi. Tambahkan e-book, berkas, atau video YouTube.</div>');
    $$('[data-ref]', body).forEach((c) => (c.onclick = (e) => {
      if (e.target.closest('button')) return;
      const r = refs.find((x) => x.ref_id === c.dataset.ref);
      if (r.tipe === 'YouTube') openViewer({ embed: r.url_embed, nama: r.judul, mime: 'video/youtube', title: r.judul, info: 'Video referensi' });
      else openViewer({ fileId: r.drive_file_id, nama: r.nama_file, mime: r.mime, ukuran: r.ukuran, title: r.judul, info: r.tipe });
    }));
    $$('[data-dl]', body).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); downloadFile(b.dataset.dl, b.dataset.nm, b); }));
    $$('[data-del-ref]', body).forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation(); const r = refs.find((x) => x.ref_id === b.dataset.delRef);
      if (!(await confirmDlg('Hapus referensi?', '"' + esc(r.judul) + '" akan dihapus dari modul belajar.', { danger: true, ok: 'Hapus' }))) return;
      const g = S.boot.g, i = g.referensi.indexOf(r);
      mutate('referensi.delete', { ref_id: r.ref_id }, { optimistic: () => g.referensi.splice(i, 1), rollback: () => g.referensi.splice(i, 0, r) });
    }));
  }
  K.registerPage('mk', { title: (id) => (id && S.idx.mk[id] ? S.idx.mk[id].nama : 'Mata Kuliah'), show: renderMk });

  // ============================================================== FORM: penugasan, sesi, unggah, notulen, referensi
  function upsertLocal(arr, key, obj) { const i = arr.findIndex((x) => x[key] === obj[key]); if (i > -1) arr[i] = Object.assign({}, arr[i], obj); else arr.push(obj); }

  function penugasanForm(o) {
    const t = o.tugas || null, ptm0 = t ? S.idx.ptm[t.pertemuan_id] : S.idx.ptm[o.pertemuan_id];
    const mkId = ptm0 ? ptm0.mk_id : o.mk_id;
    const ps = (S.idx.ptmByMk[mkId] || []).filter((p) => p.jenis === 'Pembelajaran');
    const beban = bebanMap(), pilih = new Set(t ? t.petugas_ids : []);
    const selPtm = ptm0 && ptm0.jenis === 'Pembelajaran' ? ptm0.pertemuan_id : (ps.find((p) => !(S.idx.tugasByPtm[p.pertemuan_id] || []).length) || ps[0] || {}).pertemuan_id;
    const p0 = S.idx.ptm[selPtm] || {};
    const m = modal({
      title: t ? 'Ubah Penugasan Presentasi' : 'Tetapkan Petugas & Tema', sub: esc((S.idx.mk[mkId] || {}).nama || ''), icon: 'users', size: 'lg',
      body: '<div class="form-grid"><div class="field"><label>Pertemuan <span class="req">*</span></label><select class="inp" name="pertemuan_id" ' + (t ? 'disabled' : '') + '>' + ps.map((p) => '<option value="' + p.pertemuan_id + '" ' + (p.pertemuan_id === selPtm ? 'selected' : '') + '>Sesi ' + p.nomor + ' · ' + esc(fmtTgl(p.tanggal)) + ((S.idx.tugasByPtm[p.pertemuan_id] || []).length ? ' · sudah ada petugas' : '') + '</option>').join('') + '</select><span class="hint">Pertemuan 8 (UTS) & 16 (UAS) tidak memiliki penugasan.</span></div>' +
        '<div class="field"><label>Tipe Tugas</label><div class="seg" id="tipeSeg"><button type="button" data-v="Kelompok" class="' + (!t || t.tipe === 'Kelompok' ? 'on' : '') + '">Kelompok</button><button type="button" data-v="Mandiri" class="' + (t && t.tipe === 'Mandiri' ? 'on' : '') + '">Mandiri</button></div></div>' +
        '<div class="field full"><label>Tema Makalah / Presentasi <span class="req">*</span></label><input class="inp" name="tema" value="' + esc(t ? t.tema : p0.tema || '') + '" placeholder="mis. Aplikasi SEM AMOS pada Riset Loyalitas Nasabah"></div>' +
        '<div class="field"><label>Deadline Makalah</label><input class="inp" type="date" name="deadline_makalah" value="' + esc(t ? ymd(t.deadline_makalah) : ymd(p0.tanggal) ? addDays(ymd(p0.tanggal), -2) : '') + '"><span class="hint">Reminder otomatis H-7, H-3, H-1 dari tanggal ini.</span></div>' +
        '<div class="field"><label>Tanggal Presentasi</label><input class="inp" type="date" name="tanggal_presentasi" value="' + esc(t ? ymd(t.tanggal_presentasi) : ymd(p0.tanggal)) + '"></div>' +
        '<div class="field full"><label>Pilih Petugas <span class="req">*</span> <span class="chip" id="selCount">' + pilih.size + ' dipilih</span></label>' +
        '<div class="row wrap gap6"><div class="searchbox" style="max-width:280px">' + ic('search') + '<input id="ptgQ" placeholder="Cari nama / NIM" style="height:38px"></div><div class="seg" id="jSeg"><button type="button" data-j="" class="on">Semua</button><button type="button" data-j="P2K">P2K</button><button type="button" data-j="Reguler">Reguler</button></div></div>' +
        '<div id="ptgList" class="mt8" style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:14px;padding:6px"></div><span class="hint">Angka di kanan = jumlah tugas semester ini (pilih yang paling sedikit agar merata).</span></div></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>' + ic('send') + (t ? 'Simpan Perubahan' : 'Simpan & Notifikasi Petugas') + '</button>'
    });
    let tipe = t ? t.tipe : 'Kelompok', fj = '', q = '';
    const draw = () => {
      const list = D.mhsList(fj).filter((x) => !q || (x.nama_lengkap + ' ' + (x.nim || '')).toLowerCase().indexOf(q) > -1).sort((a, b) => (beban[a.mhs_id] || 0) - (beban[b.mhs_id] || 0) || a.nama_lengkap.localeCompare(b.nama_lengkap));
      $('#ptgList', m.el).innerHTML = list.map((x) => '<label class="row" style="padding:8px 10px;border-radius:10px;cursor:pointer;' + (pilih.has(x.mhs_id) ? 'background:var(--primary-soft)' : '') + '"><input type="checkbox" value="' + x.mhs_id + '" ' + (pilih.has(x.mhs_id) ? 'checked' : '') + ' style="width:17px;height:17px;accent-color:var(--primary)">' + avatar(x.nama_lengkap, 'xs', Foto.of(x.mhs_id)) + '<span class="grow"><b class="semi">' + esc(x.nama_lengkap) + '</b> <span class="xs muted">' + esc(x.nim || '') + '</span></span>' + chipJenis(x.jenis_mahasiswa) + '<span class="chip ' + ((beban[x.mhs_id] || 0) ? '' : 'green') + '">' + (beban[x.mhs_id] || 0) + ' tugas</span></label>').join('') || '<div class="empty">Tidak ada mahasiswa.</div>';
      $$('#ptgList input', m.el).forEach((c) => (c.onchange = () => { if (c.checked) { if (tipe === 'Mandiri') pilih.clear(); pilih.add(c.value); } else pilih.delete(c.value); $('#selCount', m.el).textContent = pilih.size + ' dipilih'; draw(); }));
    };
    draw();
    $('#ptgQ', m.el).oninput = K.debounce((e) => { q = e.target.value.toLowerCase(); draw(); }, 200);
    $$('#jSeg button', m.el).forEach((b) => (b.onclick = () => { fj = b.dataset.j; $$('#jSeg button', m.el).forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
    $$('#tipeSeg button', m.el).forEach((b) => (b.onclick = () => { tipe = b.dataset.v; $$('#tipeSeg button', m.el).forEach((x) => x.classList.toggle('on', x === b)); if (tipe === 'Mandiri' && pilih.size > 1) { const f = [...pilih][0]; pilih.clear(); pilih.add(f); draw(); } $('#selCount', m.el).textContent = pilih.size + ' dipilih'; }));
    const selEl = $('[name=pertemuan_id]', m.el);
    selEl.onchange = () => { const p = S.idx.ptm[selEl.value]; if (p && ymd(p.tanggal)) { $('[name=tanggal_presentasi]', m.el).value = ymd(p.tanggal); $('[name=deadline_makalah]', m.el).value = addDays(ymd(p.tanggal), -2); } };
    $('[data-save]', m.el).onclick = () => {
      const fd = formData(m.el);
      const data = { tugas_id: t ? t.tugas_id : '', pertemuan_id: t ? t.pertemuan_id : fd.pertemuan_id, tema: fd.tema.trim(), tipe, petugas_ids: [...pilih], deadline_makalah: fd.deadline_makalah, tanggal_presentasi: fd.tanggal_presentasi };
      if (!data.tema) return toast('Tema wajib diisi.', 'error');
      if (!data.petugas_ids.length) return toast('Pilih minimal satu petugas.', 'error');
      if (tipe === 'Mandiri' && data.petugas_ids.length > 1) return toast('Tugas Mandiri hanya untuk satu petugas.', 'error');
      const lama = t ? S.idx.tugas[t.tugas_id] : null;
      K.saveLocal({ action: 'penugasan.save', data, list: () => S.boot.g.penugasan, key: 'tugas_id', modal: m, reopen: (d) => penugasanForm(Object.assign({}, o, { tugas: d })),
        row: { tugas_id: data.tugas_id, pertemuan_id: data.pertemuan_id, tema: data.tema, tipe, petugas_ids: data.petugas_ids, deadline_makalah: data.deadline_makalah, tanggal_presentasi: data.tanggal_presentasi, status: (lama && lama.status) || 'Ditugaskan', dibuat_oleh: (lama && lama.dibuat_oleh) || S.me.user_id } });
    };
  }
  async function hapusTugas(t) {
    const s = D.subs(t.tugas_id), n = (s.makalah ? 1 : 0) + (s.ppt ? 1 : 0);
    if (!(await confirmDlg('Hapus penugasan?', 'Penugasan "' + esc(t.tema) + '"' + (n ? ' beserta <b>' + n + ' berkas</b> yang sudah diunggah' : '') + ' akan dihapus.', { danger: true, ok: 'Hapus' }))) return;
    const g = S.boot.g, i = g.penugasan.indexOf(t);
    mutate('penugasan.delete', { tugas_id: t.tugas_id, force: true }, { optimistic: () => g.penugasan.splice(i, 1), rollback: () => g.penugasan.splice(i, 0, t) });
  }
  function dropzoneHtml(accept, label) {
    return '<label class="dropzone" data-dz><input type="file" accept="' + accept + '" hidden>' + ic('cloud-upload') + '<div class="semi mt8">' + esc(label || 'Seret berkas ke sini atau klik untuk memilih') + '</div><div class="small muted">' + esc(accept.replace(/\./g, '').toUpperCase().split(',').join(', ')) + ' · maks 10 MB</div></label><div data-picked class="mt12"></div>';
  }
  function bindDropzone(root, opt, onPick) {
    const dz = $('[data-dz]', root), inp = $('input[type=file]', dz);
    const pick = async (file) => {
      try { const f = await K.readFile(file, opt); onPick(f, file); const k = fileKind(f.nama_file, f.mime);
        $('[data-picked]', root).innerHTML = '<div class="file-row"><span class="file-ic ' + k.k + '">' + ic(k.ic) + '</span><div class="grow" style="min-width:0"><b class="semi ellipsis" style="display:block">' + esc(f.nama_file) + '</b><div class="small muted">' + fmtSize(f.ukuran) + '</div></div><span class="chip green">' + ic('check') + 'Siap diunggah</span></div><div class="progress mt8" data-prog hidden><i style="width:0"></i></div>';
      } catch (e) { toast(e.message, 'error'); }
    };
    inp.onchange = () => inp.files[0] && pick(inp.files[0]);
    ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => e.dataTransfer.files[0] && pick(e.dataTransfer.files[0]));
  }
  function setProg(root, p) { const b = $('[data-prog]', root); if (b) { b.hidden = false; b.firstChild.style.width = p + '%'; } }

  function uploadForm(t, jenis) {
    if (!t) return;
    const p = D.ptmOf(t), mk = D.mkOfPtm(p), s = D.subs(t.tugas_id), sisa = D.deadlineOf(t) ? dayDiff(todayYmd(), D.deadlineOf(t)) : null;
    const isPpt = jenis === 'PPT', ext = EXT[isPpt ? 'PPT' : 'Makalah'];
    let file = null;
    const lain = isPpt ? s.makalah : s.ppt;
    const m = modal({
      title: 'Unggah Berkas ' + (isPpt ? 'PPT Slide Presentasi' : 'Makalah'), icon: isPpt ? 'presentation' : 'file-text', size: 'lg',
      sub: '<span class="row wrap gap6 mt8"><span class="chip blue">' + ic('users') + 'Sesi ' + p.nomor + ' · Tugas ' + esc(t.tipe) + '</span><span class="chip">' + esc(mk.nama || '') + '</span>' + (sisa != null ? '<span class="chip ' + (sisa <= 3 ? 'amber' : '') + '">' + ic('clock') + (sisa < 0 ? 'Terlambat ' + -sisa + ' hari' : 'H-' + sisa) + ' Deadline: ' + esc(fmtTgl(D.deadlineOf(t))) + '</span>' : '') + '</span>',
      body: '<div class="tile"><div class="xs bold muted" style="letter-spacing:.06em">TOPIK RISET &amp; MAKALAH PRESENTASI</div><div class="semi mt8" style="font-size:16px">' + esc(t.tema) + '</div>' +
        '<div class="grid g2 mt12" style="gap:10px"><div class="card" style="padding:12px"><div class="small muted mb8">' + ic('users') + ' Tim Pemakalah (Sesi ' + p.nomor + ')</div>' + (t.petugas_ids || []).map((id, i) => '<div class="row small mb8"><span class="chip blue">' + (i + 1) + '</span><b class="semi">' + esc(D.namaMhs(id)) + '</b></div>').join('') + '</div>' +
        '<div class="card" style="padding:12px"><div class="small muted mb8">' + ic('circle-check') + ' Status ' + (isPpt ? 'Makalah' : 'Slide PPT') + '</div>' + (lain ? '<b class="semi small ellipsis" style="display:block">' + esc(lain.nama_file) + '</b><div class="xs muted">' + fmtSize(lain.ukuran) + ' · diunggah ' + fmtRel(lain.tanggal_unggah) + '</div><span class="chip green mt8">TERVERIFIKASI</span>' : '<span class="chip amber">Belum diunggah</span>') + '</div></div></div>' +
        '<div class="sec-t" style="margin-top:20px">Berkas ' + (isPpt ? 'PPT Slide Presentasi' : 'Makalah') + ' <span class="req">*</span><span class="xs muted" style="text-transform:none;letter-spacing:0">Format: ' + ext.map((x) => '.' + x.toUpperCase()).join(', ') + ' (Maks. 10 MB)</span></div>' +
        dropzoneHtml(ext.map((x) => '.' + x).join(','), 'Seret berkas ke sini atau klik untuk memilih') + ((isPpt ? s.ppt : s.makalah) ? '<div class="alert warn mt12">' + ic('refresh-cw') + '<span>Berkas lama <b>' + esc((isPpt ? s.ppt : s.makalah).nama_file) + '</b> akan diganti.</span></div>' : ''),
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-up>' + ic('cloud-upload') + 'Unggah ke Google Drive</button>'
    });
    bindDropzone(m.el, { ext, max: MAX_FILE }, (f) => (file = f));
    $('[data-up]', m.el).onclick = async (e) => {
      if (!file) return toast('Pilih berkas terlebih dahulu.', 'error');
      const btn = e.target.closest('button,.btn'); busy(btn, true, 'Mengunggah…');
      const r = await K.apiUpload('submission.upload', Object.assign({ tugas_id: t.tugas_id, jenis_file: isPpt ? 'PPT' : 'Makalah' }, file), (pp) => setProg(m.el, pp));
      busy(btn, false);
      if (!r.success) return toast(r.message, 'error');
      const g = S.boot.g;
      g.submission = g.submission.filter((x) => !(x.tugas_id === t.tugas_id && x.jenis_file === r.data.submission.jenis_file));
      g.submission.push(r.data.submission); t.status = r.data.status;
      S.idx = K.buildIdx(S.boot); K.rerender(); K.scheduleRefresh();
      m.close();
      toast((isPpt ? 'Slide' : 'Makalah') + ' tersimpan di folder Pertemuan ' + p.nomor + ' dan tampil sebagai modul belajar.' + (r.data.status === 'Terkumpul' ? ' Status: Lengkap — reminder dihentikan.' : ''), 'success', 'Berkas Berhasil Tersinkronisasi!');
    };
  }

  function notulenForm(o) {
    const n = o.notulen || null, mkId = o.mk_id || (S.idx.ptm[o.pertemuan_id] || {}).mk_id;
    const ps = S.idx.ptmByMk[mkId] || [];
    const defPtm = o.pertemuan_id || (ps.filter((p) => ymd(p.tanggal) <= todayYmd()).pop() || ps[0] || {}).pertemuan_id;
    let file = null;
    const m = modal({
      title: n ? 'Ubah Notulen' : 'Tulis Notulen Pembelajaran', sub: esc((S.idx.mk[mkId] || {}).nama || ''), icon: 'notebook-pen', size: 'lg',
      body: '<div class="form-grid"><div class="field"><label>Pertemuan</label><select class="inp" name="pertemuan_id" ' + (n ? 'disabled' : '') + '>' + ps.map((p) => '<option value="' + p.pertemuan_id + '" ' + (p.pertemuan_id === defPtm ? 'selected' : '') + '>Sesi ' + p.nomor + ' · ' + esc(p.tema || p.jenis) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Judul</label><input class="inp" name="judul" value="' + esc(n ? n.judul : '') + '" placeholder="Notulen Pertemuan …"></div>' +
        '<div class="field full"><label>Isi Notulen</label><textarea class="inp" name="isi" rows="9" placeholder="Ringkasan diskusi, tanya jawab dosen, poin penting…">' + esc(n ? n.isi : '') + '</textarea></div>' +
        '<div class="field full"><label>Lampiran (opsional)</label>' + dropzoneHtml(EXT.Notulen.map((x) => '.' + x).join(','), 'Lampirkan berkas notulen (PDF/DOC/foto papan tulis)') + '</div></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>' + ic('send') + 'Simpan Notulen</button>'
    });
    bindDropzone(m.el, { ext: EXT.Notulen, max: MAX_FILE }, (f) => (file = f));
    $('[data-save]', m.el).onclick = async (e) => {
      const fd = formData(m.el);
      if (!fd.isi.trim() && !file && !(n && n.drive_file_id)) return toast('Isi notulen atau lampirkan berkas.', 'error');
      const data = Object.assign({ notulen_id: n ? n.notulen_id : '', pertemuan_id: n ? n.pertemuan_id : fd.pertemuan_id, judul: fd.judul, isi: fd.isi }, file || {});
      if (!file) {                                       // teks saja → simpan optimistis
        const ptmN = (S.idx.ptm[data.pertemuan_id] || {}).nomor;
        return K.saveLocal({ action: 'notulen.save', data, list: () => S.boot.g.notulen, key: 'notulen_id', modal: m, reopen: () => notulenForm(o),
          row: Object.assign({ pengunggah_id: S.me.user_id, tanggal: new Date().toISOString(), drive_file_id: '', nama_file: '', mime: '', ukuran: '' }, n || {}, { notulen_id: data.notulen_id, pertemuan_id: data.pertemuan_id, judul: (fd.judul || '').trim() || ('Notulen Pertemuan ' + ptmN), isi: fd.isi }) });
      }
      const btn = e.target.closest('button,.btn'); busy(btn, true, 'Menyimpan…');
      const r = file ? await K.apiUpload('notulen.save', data, (pp) => setProg(m.el, pp)) : await api('notulen.save', data);
      busy(btn, false);
      if (!r.success) return toast(r.message, 'error');
      upsertLocal(S.boot.g.notulen, 'notulen_id', r.data); S.idx = K.buildIdx(S.boot); K.rerender(); K.scheduleRefresh();
      m.close(); toast(r.message);
    };
  }

  function referensiForm(o) {
    const mkId = o.mk_id, ps = S.idx.ptmByMk[mkId] || [];
    let tipe = 'File', file = null;
    const m = modal({
      title: 'Tambah Referensi / Modul Belajar', sub: esc((S.idx.mk[mkId] || {}).nama || ''), icon: 'book-marked', size: 'lg',
      body: '<div class="field"><label>Jenis Referensi</label><div class="seg" id="refSeg"><button type="button" class="on" data-t="File">' + ic('file') + ' Berkas</button><button type="button" data-t="E-book">' + ic('book-marked') + ' E-book</button><button type="button" data-t="YouTube">' + ic('circle-play') + ' Video YouTube</button></div></div>' +
        '<div class="form-grid mt16"><div class="field"><label>Judul <span class="req">*</span></label><input class="inp" name="judul" placeholder="mis. Panduan AMOS untuk SEM"></div><div class="field"><label>Terkait Pertemuan (opsional)</label><select class="inp" name="pertemuan_id"><option value="">— Umum —</option>' + ps.map((p) => '<option value="' + p.pertemuan_id + '">Sesi ' + p.nomor + ' · ' + esc(p.tema || p.jenis) + '</option>').join('') + '</select></div></div>' +
        '<div class="mt16" id="refFile">' + dropzoneHtml(EXT.File.map((x) => '.' + x).join(',')) + '</div><div class="field mt16" id="refYt" hidden><label>Tautan YouTube <span class="req">*</span></label><input class="inp" name="url" placeholder="https://youtu.be/…"><span class="hint">Video diputar di dalam aplikasi (tanpa membuka tab baru).</span></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>' + ic('plus') + 'Simpan Referensi</button>'
    });
    bindDropzone(m.el, { ext: EXT.File, max: MAX_FILE }, (f) => {
      file = f;
      const j = $('[name=judul]', m.el); if (!j.value.trim()) j.value = f.nama_file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();   // judul otomatis dari nama berkas
    });
    $$('#refSeg button', m.el).forEach((b) => (b.onclick = () => {
      tipe = b.dataset.t; $$('#refSeg button', m.el).forEach((x) => x.classList.toggle('on', x === b)); $('#refFile', m.el).hidden = tipe === 'YouTube'; $('#refYt', m.el).hidden = tipe !== 'YouTube';
      const ext = tipe === 'E-book' ? ['pdf', 'epub'] : EXT.File, inp = $('[data-dz] input', m.el), hint = $('[data-dz] .small', m.el);
      if (inp) inp.accept = ext.map((x) => '.' + x).join(',');
      if (hint) hint.textContent = ext.join(', ').toUpperCase() + ' · maks 10 MB';
    }));
    $('[data-save]', m.el).onclick = async (e) => {
      const fd = formData(m.el);
      if (!fd.judul.trim()) return toast('Judul wajib diisi.', 'error');
      if (tipe === 'YouTube' && !/youtu/.test(fd.url)) return toast('Masukkan tautan YouTube yang valid.', 'error');
      if (tipe !== 'YouTube' && !file) return toast('Pilih berkas referensi.', 'error');
      if (tipe === 'E-book' && file && !/\.(pdf|epub)$/i.test(file.nama_file)) return toast('E-book harus PDF/EPUB.', 'error');
      const data = Object.assign({ mk_id: mkId, judul: fd.judul, tipe, pertemuan_id: fd.pertemuan_id, url: fd.url }, tipe !== 'YouTube' ? file : {});
      if (tipe === 'YouTube') {                          // tautan video → simpan optimistis
        const vid = (String(fd.url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/) || [])[1];
        if (!vid) return toast('Tautan YouTube tidak valid.', 'error');
        return K.saveLocal({ action: 'referensi.save', data, list: () => S.boot.g.referensi, key: 'ref_id', modal: m, reopen: () => referensiForm(o),
          row: { ref_id: '', mk_id: mkId, pertemuan_id: fd.pertemuan_id, pengunggah_id: S.me.user_id, judul: fd.judul.trim(), tipe: 'YouTube', url_embed: 'https://www.youtube-nocookie.com/embed/' + vid, drive_file_id: '', nama_file: '', mime: 'video/youtube', ukuran: '', tanggal: new Date().toISOString() } });
      }
      const btn = e.target.closest('button,.btn'); busy(btn, true, 'Menyimpan…');
      const r = tipe !== 'YouTube' ? await K.apiUpload('referensi.save', data, (pp) => setProg(m.el, pp)) : await api('referensi.save', data);
      busy(btn, false);
      if (!r.success) return toast(r.message, 'error');
      upsertLocal(S.boot.g.referensi, 'ref_id', r.data); S.idx = K.buildIdx(S.boot); K.rerender(); K.scheduleRefresh();
      m.close(); toast(r.message);
    };
  }

  // ============================================================== PENGUMUMAN
  function kanalChips(p) {
    return String(p.kanal || 'Popup').split(',').filter(Boolean).map((k) => '<span class="chip ' + (k === 'WA' ? 'green' : k === 'Email' ? 'amber' : 'blue') + '">' + (k === 'WA' ? 'BroadCast WA' : k === 'Email' ? 'Email Blast' : 'Portal') + '</span>').join('');
  }
  function openAnn(p) {
    if (!p) return;
    const m = modal({ title: p.judul, icon: 'megaphone', sub: fmtWaktu(p.tanggal) + ' · ' + esc(D.namaUser(p.pembuat_id)) + ' · Sasaran: ' + esc(p.target === 'Matakuliah' ? (S.idx.mk[p.mk_id] || {}).nama || 'Mata kuliah' : p.target || 'Semua'),
      body: '<div class="row gap6 mb12">' + kanalChips(p) + (D.isAdmin() && p.status_kirim ? '<span class="chip">' + esc(p.status_kirim) + '</span>' : '') + '</div><div style="white-space:pre-wrap;line-height:1.7">' + esc(p.isi) + '</div>',
      foot: (D.isAdmin() ? '<button class="btn danger" data-del>' + ic('trash-2') + 'Hapus</button><button class="btn ghost" data-edit>' + ic('pencil') + 'Ubah</button><span class="grow"></span>' : '') + '<button class="btn" data-close>Tutup</button>' });
    K.markRead([p.pengumuman_id]);
    if (D.isAdmin()) {
      $('[data-edit]', m.el).onclick = () => { m.close(); annForm(p); };
      $('[data-del]', m.el).onclick = async () => {
        if (!(await confirmDlg('Hapus pengumuman?', '"' + esc(p.judul) + '" akan dihapus untuk semua anggota.', { danger: true, ok: 'Hapus' }))) return;
        m.close(); const g = S.boot.g, i = g.pengumuman.indexOf(p);
        mutate('pengumuman.delete', { pengumuman_id: p.pengumuman_id }, { optimistic: () => g.pengumuman.splice(i, 1), rollback: () => g.pengumuman.splice(i, 0, p) });
      };
    }
  }
  function annForm(p) {
    const set = S.boot.g.settings, waOn = set.NOTIF_WA_AKTIF === 'YA', emOn = set.NOTIF_EMAIL_AKTIF === 'YA';
    const kanal = p ? String(p.kanal || '').split(',') : ['Popup'];
    const m = modal({
      title: p ? 'Ubah Pengumuman' : 'Buat Pengumuman', sub: 'Tampil sebagai popup saat anggota membuka aplikasi, plus kanal Email/WA opsional', icon: 'megaphone', size: 'lg',
      body: '<div class="form-grid"><div class="field full"><label>Judul <span class="req">*</span></label><input class="inp" name="judul" value="' + esc(p ? p.judul : '') + '" placeholder="mis. Perubahan Ruang Kuliah Metodologi Penelitian"></div>' +
        '<div class="field full"><label>Isi Pengumuman <span class="req">*</span></label><textarea class="inp" name="isi" rows="7">' + esc(p ? p.isi : '') + '</textarea></div>' +
        '<div class="field"><label>Sasaran</label><select class="inp" name="target">' + [['Semua', 'Semua anggota'], ['P2K', 'Mahasiswa P2K saja'], ['Reguler', 'Mahasiswa Reguler saja'], ['Matakuliah', 'Per mata kuliah']].map((x) => '<option value="' + x[0] + '" ' + (p && p.target === x[0] ? 'selected' : '') + '>' + x[1] + '</option>').join('') + '</select></div>' +
        '<div class="field" id="annMk" ' + (p && p.target === 'Matakuliah' ? '' : 'hidden') + '><label>Mata Kuliah</label><select class="inp" name="mk_id">' + D.mkAktif().map((x) => '<option value="' + x.mk_id + '" ' + (p && p.mk_id === x.mk_id ? 'selected' : '') + '>' + esc(x.nama) + '</option>').join('') + '</select></div>' +
        '<div class="field full"><label>Kanal Pengiriman</label><div class="row wrap" style="gap:18px">' +
        '<label class="check"><input type="checkbox" name="kanal" data-multi value="Popup" ' + (kanal.indexOf('Popup') > -1 ? 'checked' : '') + '>Popup di aplikasi</label>' +
        '<label class="check"><input type="checkbox" name="kanal" data-multi value="Email" ' + (kanal.indexOf('Email') > -1 ? 'checked' : '') + ' ' + (emOn ? '' : 'disabled') + '>Email' + (emOn ? '' : ' <span class="xs faint">(nonaktif)</span>') + '</label>' +
        '<label class="check"><input type="checkbox" name="kanal" data-multi value="WA" ' + (kanal.indexOf('WA') > -1 ? 'checked' : '') + ' ' + (waOn ? '' : 'disabled') + '>WhatsApp' + (waOn ? '' : ' <span class="xs faint">(nonaktif)</span>') + '</label></div>' +
        '<span class="hint">Email/WA dikirim bertahap lewat antrean (gelombang sesuai Pengaturan) agar aman dari batas kuota.</span></div>' + (p ? '<label class="check full"><input type="checkbox" name="kirimUlang">Kirim ulang Email/WA</label>' : '') + '</div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>' + ic('send') + (p ? 'Simpan' : 'Terbitkan') + '</button>'
    });
    $('[name=target]', m.el).onchange = (e) => ($('#annMk', m.el).hidden = e.target.value !== 'Matakuliah');
    $('[data-save]', m.el).onclick = () => {
      const fd = formData(m.el);
      if (!fd.judul.trim() || !fd.isi.trim()) return toast('Judul dan isi wajib diisi.', 'error');
      if (!fd.kanal.length) return toast('Pilih minimal satu kanal.', 'error');
      const tandaiBaca = (id) => { if (id && !S.boot.u.dibaca.includes(id)) S.boot.u.dibaca.push(id); };
      K.saveLocal({ action: 'pengumuman.save', data: Object.assign({ pengumuman_id: p ? p.pengumuman_id : '' }, fd), list: () => S.boot.g.pengumuman, key: 'pengumuman_id', modal: m, prepend: true, reopen: (d) => annForm(d),
        row: Object.assign({ pembuat_id: S.me.user_id, tanggal: new Date().toISOString(), status_kirim: 'Menyimpan…' }, p || {}, { pengumuman_id: p ? p.pengumuman_id : '', judul: fd.judul.trim(), isi: fd.isi.trim(), target: fd.target, mk_id: fd.target === 'Matakuliah' ? fd.mk_id : '', kanal: fd.kanal.join(','), popup: fd.kanal.indexOf('Popup') > -1 ? 'YA' : 'TIDAK' }),
        onLocal: (r) => tandaiBaca(r.pengumuman_id), onSaved: (d) => d && tandaiBaca(d.pengumuman_id) });
    };
  }
  function renderPengumuman(el) {
    const st = el._st || (el._st = { f: 'semua' });
    let list = S.boot.g.pengumuman.filter(K.annForMe);
    if (st.f === 'baru') list = list.filter((p) => !S.idx.dibaca[p.pengumuman_id]);
    el.innerHTML = '<div class="page-h"><div><h1>Pengumuman</h1><div class="sub">Informasi resmi kelas. Pengumuman baru tampil sebagai popup sekali per pengguna.</div></div><div class="row">' +
      (D.unreadAnn().length ? '<button class="btn ghost" data-readall>' + ic('check') + 'Tandai semua dibaca</button>' : '') + (D.isAdmin() ? '<button class="btn" data-new>' + ic('plus') + 'Buat Pengumuman</button>' : '') + '</div></div>' +
      '<div class="tabs"><button class="tab ' + (st.f === 'semua' ? 'active' : '') + '" data-f="semua">Semua <span class="n">' + S.boot.g.pengumuman.filter(K.annForMe).length + '</span></button><button class="tab ' + (st.f === 'baru' ? 'active' : '') + '" data-f="baru">Belum dibaca <span class="n">' + D.unreadAnn().length + '</span></button></div>' +
      (list.length ? '<div class="grid g2">' + list.map((p) => '<div class="card ann-item ' + (S.idx.dibaca[p.pengumuman_id] ? '' : 'unread') + '" data-ann="' + p.pengumuman_id + '" style="background:#fff"><div class="row between"><span class="row gap4 wrap">' + kanalChips(p) + (p.target && p.target !== 'Semua' ? '<span class="chip">' + esc(p.target === 'Matakuliah' ? (S.idx.mk[p.mk_id] || {}).kode || 'MK' : p.target) + '</span>' : '') + '</span><span class="xs faint">' + fmtRel(p.tanggal) + '</span></div><h3 style="font-size:16px;margin:10px 0 6px">' + esc(p.judul) + '</h3><div class="muted small" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;line-height:1.55">' + esc(p.isi) + '</div><div class="xs faint mt12">oleh ' + esc(D.namaUser(p.pembuat_id)) + (!S.idx.dibaca[p.pengumuman_id] ? ' · <b style="color:var(--primary-ink)">Baru</b>' : '') + '</div></div>').join('') + '</div>'
        : '<div class="card empty">' + ic('megaphone') + '<br>Tidak ada pengumuman.</div>');
    $$('[data-f]', el).forEach((b) => (b.onclick = () => { st.f = b.dataset.f; renderPengumuman(el); }));
    $$('[data-ann]', el).forEach((a) => (a.onclick = () => openAnn(S.boot.g.pengumuman.find((p) => p.pengumuman_id === a.dataset.ann))));
    const n = $('[data-new]', el); if (n) n.onclick = () => annForm();
    const ra = $('[data-readall]', el); if (ra) ra.onclick = () => K.markRead(D.unreadAnn().map((p) => p.pengumuman_id));
  }
  K.registerPage('pengumuman', { title: 'Pengumuman', show: renderPengumuman });

  // ============================================================== RENCANA
  function timelineItems() {
    const smt = D.smtAktifId(), items = S.boot.g.timeline.filter((x) => !smt || !x.semester_id || x.semester_id === smt).map((x) => Object.assign({ src: 'manual' }, x));
    const s = D.smtAktif();
    if (s.tanggal_mulai) items.push({ judul: 'Awal Perkuliahan ' + (s.nama_semester || ''), tanggal_mulai: s.tanggal_mulai, tanggal_selesai: s.tanggal_mulai, kategori: 'Perkuliahan', src: 'auto' });
    ['UTS', 'UAS'].forEach((j) => {
      const ds = D.mkAktif().map((m) => (S.idx.ptmByMk[m.mk_id] || []).find((p) => p.jenis === j)).filter((p) => p && ymd(p.tanggal)).map((p) => ymd(p.tanggal)).sort();
      if (ds.length) items.push({ judul: (j === 'UTS' ? 'Ujian Tengah Semester' : 'Ujian Akhir Semester') + ' (' + j + ')', tanggal_mulai: ds[0], tanggal_selesai: ds[ds.length - 1], kategori: 'Ujian', src: 'auto' });
    });
    if (s.tanggal_selesai) items.push({ judul: 'Akhir Semester', tanggal_mulai: s.tanggal_selesai, tanggal_selesai: s.tanggal_selesai, kategori: 'Perkuliahan', src: 'auto' });
    return items.sort((a, b) => String(a.tanggal_mulai).localeCompare(String(b.tanggal_mulai)));
  }
  function renderRencana(el, param) {
    const st = el._st || (el._st = { tab: param || 'timeline' });
    if (param && param !== st.tab && ['timeline', 'todo', 'target'].indexOf(param) > -1) st.tab = param;
    const admin = D.isAdmin();
    el.innerHTML = '<div class="page-h"><div><h1>Rencana Semester</h1><div class="sub">Timeline tahapan penting, to-do wajib (Kampus · Kelas · Dosen), dan target kelulusan.</div></div></div>' +
      '<div class="tabs">' + [['timeline', 'Timeline Semester', 'calendar-days'], ['todo', 'Ceklis To-Do', 'list-checks'], ['target', 'Target Kelulusan', 'target']].map((x) => '<button class="tab ' + (st.tab === x[0] ? 'active' : '') + '" data-tab="' + x[0] + '">' + ic(x[2]) + esc(x[1]) + '</button>').join('') + '</div><div id="rcBody"></div>';
    $$('[data-tab]', el).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; history.replaceState(null, '', '#/rencana/' + st.tab); S.param = st.tab; renderRencana(el, st.tab); }));
    const body = $('#rcBody', el);
    if (st.tab === 'timeline') {
      const t = todayYmd(), items = timelineItems();
      const cur = items.findIndex((x) => (x.tanggal_selesai || x.tanggal_mulai) >= t);
      body.innerHTML = '<div class="split"><div class="card"><div class="card-h"><div><h3>Timeline ' + esc(D.smtAktif().nama_semester || 'Semester') + '</h3><div class="sub">Item otomatis: awal/akhir semester & tanggal UTS/UAS dari 16 pertemuan</div></div>' + (admin ? '<button class="btn sm" data-add>' + ic('plus') + 'Tahapan</button>' : '') + '</div>' +
        (items.length ? '<div class="timeline">' + items.map((x, i) => '<div class="tl-item ' + ((x.tanggal_selesai || x.tanggal_mulai) < t ? 'past ' : '') + (i === cur ? 'now ' : '') + (x.kategori === 'Ujian' ? 'uji ' : '') + (x.kategori === 'Deadline Kampus' ? 'kampus' : '') + '"><div class="row between"><b class="semi">' + esc(x.judul) + '</b><span class="row gap4"><span class="chip ' + (x.kategori === 'Ujian' ? 'violet' : x.kategori === 'Deadline Kampus' ? 'amber' : 'blue') + '">' + esc(x.kategori || '') + '</span>' + (admin && x.src === 'manual' ? '<button class="btn icon sm text" data-edit="' + x.rencana_id + '">' + ic('pencil') + '</button><button class="btn icon sm text" data-del="' + x.rencana_id + '">' + ic('trash-2') + '</button>' : '') + '</span></div><div class="small muted">' + esc(fmtTgl(x.tanggal_mulai)) + (x.tanggal_selesai && x.tanggal_selesai !== x.tanggal_mulai ? ' – ' + esc(fmtTgl(x.tanggal_selesai)) : '') + (i === cur ? ' · <b style="color:var(--primary-ink)">Berikutnya</b>' : '') + '</div>' + (x.keterangan ? '<div class="small mt8">' + esc(x.keterangan) + '</div>' : '') + '</div>').join('') + '</div>' : '<div class="empty">Belum ada tahapan.</div>') + '</div>' +
        '<div class="card"><div class="card-h"><h3>Jadwal Mingguan</h3></div>' + [1, 2, 3, 4, 5, 6, 0].map((d) => { const l = jadwalHari(d); return l.length ? '<div class="sec-t">' + K.HARI[d] + '</div>' + l.map(({ j, m }) => '<a class="tile row mb8" href="#/mk/' + m.mk_id + '" style="color:inherit">' + ic('clock') + '<div class="grow"><b class="semi">' + esc(m.nama) + '</b><div class="small muted">' + esc(j.jam_mulai + '–' + (j.jam_selesai || '') + ' · ' + (j.ruang || '')) + '</div></div>' + (j.jenis_kelas && j.jenis_kelas !== 'Semua' ? chipJenis(j.jenis_kelas) : '') + '</a>').join('') : ''; }).join('') + '</div></div>';
      const add = $('[data-add]', body); if (add) add.onclick = () => timelineForm();
      $$('[data-edit]', body).forEach((b) => (b.onclick = () => timelineForm(S.boot.g.timeline.find((x) => x.rencana_id === b.dataset.edit))));
      $$('[data-del]', body).forEach((b) => (b.onclick = async () => {
        const x = S.boot.g.timeline.find((y) => y.rencana_id === b.dataset.del); if (!(await confirmDlg('Hapus tahapan?', esc(x.judul), { danger: true, ok: 'Hapus' }))) return;
        const g = S.boot.g, i = g.timeline.indexOf(x); mutate('timeline.delete', { rencana_id: x.rencana_id }, { optimistic: () => g.timeline.splice(i, 1), rollback: () => g.timeline.splice(i, 0, x) });
      }));
    } else if (st.tab === 'todo') renderTodo(body);
    else renderTarget(body);
  }
  function todoForMe(x) { return !x.jenis_kelas || x.jenis_kelas === 'Semua' || D.isAdmin() || x.jenis_kelas === S.me.jenis_mahasiswa; }
  function renderTodo(body) {
    const admin = D.isAdmin(), todos = S.boot.g.todo.filter(todoForMe).sort((a, b) => String(a.deadline || '9').localeCompare(String(b.deadline || '9')));
    const mine = !!S.me.mhs_id;
    const done = todos.filter((x) => (S.idx.todoStatus[x.todo_id] || {}).selesai === 'Y').length;
    let html = '<div class="split"><div class="card"><div class="card-h"><div><h3>Ceklis To-Do Wajib</h3><div class="sub">' + (mine ? 'Progres Anda: <b>' + done + '/' + todos.length + '</b> selesai' : 'Daftar to-do kelas') + '</div></div>' + (admin ? '<button class="btn sm" data-add>' + ic('plus') + 'To-Do</button>' : '') + '</div>' + (mine ? progress(pct(done, todos.length), 'green') : '') +
      ['Kampus', 'Kelas', 'Dosen'].map((src) => { const l = todos.filter((x) => x.sumber === src); return l.length ? '<div class="sec-t">' + ic(src === 'Kampus' ? 'graduation-cap' : src === 'Kelas' ? 'users' : 'user-check') + ' Dari ' + src + '</div><div class="col gap6">' + l.map((x) => {
        const ok = (S.idx.todoStatus[x.todo_id] || {}).selesai === 'Y', sisa = x.deadline ? dayDiff(todayYmd(), ymd(x.deadline)) : null;
        return '<div class="todo ' + (ok ? 'done' : '') + '">' + (mine ? '<input type="checkbox" data-tg="' + x.todo_id + '" ' + (ok ? 'checked' : '') + ' aria-label="Selesai">' : ic('list-checks')) + '<div class="grow"><b class="tt semi">' + esc(x.judul) + '</b>' + (x.keterangan ? '<div class="small muted">' + esc(x.keterangan) + '</div>' : '') +
          '<div class="row wrap gap6 mt8">' + (x.wajib === 'YA' ? '<span class="chip red">Wajib</span>' : '<span class="chip">Opsional</span>') + (x.deadline ? '<span class="chip ' + (!ok && sisa != null && sisa <= 3 ? 'amber' : '') + '">' + ic('clock') + esc(fmtTgl(x.deadline)) + '</span>' : '') + (x.mk_id && S.idx.mk[x.mk_id] ? '<span class="chip blue">' + esc(S.idx.mk[x.mk_id].kode) + '</span>' : '') + (x.jenis_kelas && x.jenis_kelas !== 'Semua' ? chipJenis(x.jenis_kelas) : '') + '</div></div>' +
          (admin ? '<span class="row gap4"><button class="btn icon sm text" data-edit="' + x.todo_id + '">' + ic('pencil') + '</button><button class="btn icon sm text" data-del="' + x.todo_id + '">' + ic('trash-2') + '</button></span>' : '') + '</div>';
      }).join('') + '</div>' : ''; }).join('') + (todos.length ? '' : '<div class="empty">' + ic('list-checks') + '<br>Belum ada to-do.</div>') + '</div>';
    if (admin) html += '<div class="card" id="todoRekap"><div class="card-h"><div><h3>Penyelesaian per Mahasiswa</h3><div class="sub">Persentase to-do selesai' + (D.jenisFilter() ? ' · ' + D.jenisFilter() : '') + '</div></div></div><div id="todoTbl"></div></div>';
    else html += '<div class="card"><div class="card-h"><h3>Ringkasan</h3></div><div class="row" style="gap:20px">' + donut(pct(done, todos.length), { size: 110, stroke: 11 }) + '<div><div class="stat">' + done + ' / ' + todos.length + '</div><div class="muted small">To-do selesai</div></div></div></div>';
    body.innerHTML = html + '</div>';
    $$('[data-tg]', body).forEach((c) => (c.onchange = () => {
      const id = c.dataset.tg, sel = c.checked, u = S.boot.u, prev = u.todoStatus.slice();
      mutate('todo.toggle', { todo_id: id, selesai: sel }, { silent: true, optimistic: () => { u.todoStatus = u.todoStatus.filter((s) => s.todo_id !== id); u.todoStatus.push({ todo_id: id, mhs_id: S.me.mhs_id, selesai: sel ? 'Y' : 'N' }); }, rollback: () => (u.todoStatus = prev) })
        .then((r) => r.success && toast(sel ? 'To-do ditandai selesai.' : 'Tanda selesai dibatalkan.', 'success'));
    }));
    const add = $('[data-add]', body); if (add) add.onclick = () => todoForm();
    $$('[data-edit]', body).forEach((b) => (b.onclick = () => todoForm(S.boot.g.todo.find((x) => x.todo_id === b.dataset.edit))));
    $$('[data-del]', body).forEach((b) => (b.onclick = async () => {
      const x = S.boot.g.todo.find((y) => y.todo_id === b.dataset.del); if (!(await confirmDlg('Hapus to-do?', esc(x.judul) + ' beserta status centang semua mahasiswa.', { danger: true, ok: 'Hapus' }))) return;
      const g = S.boot.g, i = g.todo.indexOf(x); mutate('todo.delete', { todo_id: x.todo_id }, { optimistic: () => g.todo.splice(i, 1), rollback: () => g.todo.splice(i, 0, x) });
    }));
    if (admin && S.boot.a) {
      const all = S.boot.a.todoStatus, mhs = D.mhsList(D.jenisFilter());
      const rows = mhs.map((x) => { const rel = todos.filter((t) => !t.jenis_kelas || t.jenis_kelas === 'Semua' || t.jenis_kelas === x.jenis_mahasiswa); const d = all.filter((s) => s.mhs_id === x.mhs_id && s.selesai === 'Y' && rel.some((t) => t.todo_id === s.todo_id)).length; return { x, d, n: rel.length, p: pct(d, rel.length) }; });
      table($('#todoTbl', body), { rows, per: 15, placeholder: 'Cari mahasiswa…', search: (r) => r.x.nama_lengkap, sortDefault: 'p',
        cols: [{ k: 'nama', t: 'Mahasiswa', sortVal: (r) => r.x.nama_lengkap, render: (r) => '<div class="person">' + avMhs(r.x, 'xs') + '<span class="ellipsis">' + profLink('mhs', r.x.mhs_id, r.x.nama_lengkap) + '</span></div>' },
          { k: 'j', t: 'Jenis', sortVal: (r) => r.x.jenis_mahasiswa, render: (r) => chipJenis(r.x.jenis_mahasiswa) },
          { k: 'p', t: 'Selesai', sortVal: (r) => r.p, render: (r) => '<div style="min-width:120px">' + progress(r.p, r.p === 100 ? 'green' : r.p < 50 ? 'amber' : '') + '<span class="xs muted">' + r.d + '/' + r.n + ' · ' + r.p + '%</span></div>' }] });
    }
  }
  function timelineForm(x) {
    const m = modal({ title: x ? 'Ubah Tahapan' : 'Tambah Tahapan Timeline', icon: 'calendar-days',
      body: '<div class="form-grid"><div class="field full"><label>Judul <span class="req">*</span></label><input class="inp" name="judul" value="' + esc(x ? x.judul : '') + '"></div><div class="field"><label>Mulai <span class="req">*</span></label><input class="inp" type="date" name="tanggal_mulai" value="' + esc(x ? ymd(x.tanggal_mulai) : '') + '"></div><div class="field"><label>Selesai</label><input class="inp" type="date" name="tanggal_selesai" value="' + esc(x ? ymd(x.tanggal_selesai) : '') + '"></div>' +
        '<div class="field"><label>Kategori</label><select class="inp" name="kategori">' + ['Perkuliahan', 'Ujian', 'Deadline Kampus', 'Kegiatan Kelas', 'Libur'].map((k) => '<option ' + (x && x.kategori === k ? 'selected' : '') + '>' + k + '</option>').join('') + '</select></div><div class="field full"><label>Keterangan</label><input class="inp" name="keterangan" value="' + esc(x ? x.keterangan : '') + '"></div></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button>' });
    $('[data-save]', m.el).onclick = () => {
      const fd = formData(m.el);
      if (!fd.judul.trim() || !fd.tanggal_mulai) return toast('Judul dan tanggal mulai wajib diisi.', 'error');
      K.saveLocal({ action: 'timeline.save', data: Object.assign({ rencana_id: x ? x.rencana_id : '' }, fd), list: () => S.boot.g.timeline, key: 'rencana_id', modal: m, reopen: (d) => timelineForm(d),
        row: Object.assign({ semester_id: D.smtAktifId() }, x || {}, { rencana_id: x ? x.rencana_id : '', judul: fd.judul.trim(), tanggal_mulai: fd.tanggal_mulai, tanggal_selesai: fd.tanggal_selesai || fd.tanggal_mulai, kategori: fd.kategori || 'Perkuliahan', keterangan: fd.keterangan }) });
    };
  }
  function todoForm(x) {
    const m = modal({ title: x ? 'Ubah To-Do' : 'Tambah To-Do Wajib', icon: 'list-checks',
      body: '<div class="form-grid"><div class="field full"><label>Judul <span class="req">*</span></label><input class="inp" name="judul" value="' + esc(x ? x.judul : '') + '" placeholder="mis. Isi KRS online"></div>' +
        '<div class="field"><label>Sumber <span class="req">*</span></label><select class="inp" name="sumber">' + ['Kampus', 'Kelas', 'Dosen'].map((k) => '<option ' + (x && x.sumber === k ? 'selected' : '') + '>' + k + '</option>').join('') + '</select></div><div class="field"><label>Deadline</label><input class="inp" type="date" name="deadline" value="' + esc(x ? ymd(x.deadline) : '') + '"></div>' +
        '<div class="field"><label>Untuk</label><select class="inp" name="jenis_kelas">' + ['Semua', 'P2K', 'Reguler'].map((k) => '<option ' + (x && x.jenis_kelas === k ? 'selected' : '') + '>' + k + '</option>').join('') + '</select></div><div class="field"><label>Mata Kuliah (opsional)</label><select class="inp" name="mk_id"><option value="">—</option>' + D.mkAktif().map((mk) => '<option value="' + mk.mk_id + '" ' + (x && x.mk_id === mk.mk_id ? 'selected' : '') + '>' + esc(mk.nama) + '</option>').join('') + '</select></div>' +
        '<div class="field full"><label>Keterangan</label><input class="inp" name="keterangan" value="' + esc(x ? x.keterangan : '') + '"></div><label class="check"><input type="checkbox" name="wajib" ' + (!x || x.wajib === 'YA' ? 'checked' : '') + '>Wajib</label></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button>' });
    $('[data-save]', m.el).onclick = () => {
      const fd = formData(m.el); if (!fd.judul.trim()) return toast('Judul wajib diisi.', 'error');
      K.saveLocal({ action: 'todo.save', data: Object.assign({ todo_id: x ? x.todo_id : '' }, fd), list: () => S.boot.g.todo, key: 'todo_id', modal: m, reopen: (d) => todoForm(d),
        row: Object.assign({}, x || {}, { todo_id: x ? x.todo_id : '', judul: fd.judul.trim(), sumber: fd.sumber, deadline: fd.deadline, wajib: fd.wajib ? 'YA' : 'TIDAK', mk_id: fd.mk_id, jenis_kelas: fd.jenis_kelas || 'Semua', keterangan: fd.keterangan }) });
    };
  }
  function renderTarget(body) {
    const admin = D.isAdmin(), st = body._ts || (body._ts = { mhs: S.me.mhs_id || '' });
    const targets = admin ? (S.boot.a ? S.boot.a.target : []) : S.boot.u.target;
    const mhsId = admin ? st.mhs : S.me.mhs_id, me = S.idx.mhs[mhsId] || {};
    const mine = targets.filter((x) => x.mhs_id === mhsId);
    let html = '<div class="split"><div class="card"><div class="card-h"><div><h3>' + (admin ? 'Target Mahasiswa' : 'Target Pribadi Saya') + '</h3><div class="sub">Status otomatis: Belum · Proses · Tercapai · Terlambat (melewati tenggat)</div></div>' + (mhsId ? '<button class="btn sm" data-add>' + ic('plus') + 'Target</button>' : '') + '</div>' +
      (admin ? '<div class="field mb12"><select class="inp" id="tgMhs"><option value="">— Pilih mahasiswa —</option>' + D.mhsList(D.jenisFilter()).map((x) => '<option value="' + x.mhs_id + '" ' + (x.mhs_id === mhsId ? 'selected' : '') + '>' + esc(x.nama_lengkap) + ' (' + (x.jenis_mahasiswa || '-') + ')</option>').join('') + '</select></div>' : '') +
      (mhsId ? '<div class="tile row between mb12"><div><div class="xs bold muted" style="letter-spacing:.05em">TARGET YUDISIUM / LULUS</div><div class="bold" style="font-size:18px">' + esc(me.target_lulus_semester || 'Belum diatur') + '</div></div>' + (me.status_target ? statusChip(me.status_target) : '') + '<button class="btn xs ghost" data-lulus>' + ic('pencil') + 'Ubah</button></div>' +
        (mine.length ? mine.map((x) => '<div class="tile mb8"><div class="row between"><b class="semi">' + esc(x.judul_target) + '</b><span class="row gap4">' + statusChip(x.status) + '<button class="btn icon sm text" data-edit="' + x.target_id + '">' + ic('pencil') + '</button><button class="btn icon sm text" data-del="' + x.target_id + '">' + ic('trash-2') + '</button></span></div><div class="mt8">' + progress(Number(x.progres || 0), x.status === 'Terlambat' ? 'amber' : x.status === 'Tercapai' ? 'green' : '') + '</div><div class="xs muted mt8">Tenggat ' + esc(fmtTgl(x.tenggat)) + ' · Progres ' + (x.progres || 0) + '%' + (x.catatan ? ' · ' + esc(x.catatan) : '') + '</div></div>').join('') : '<div class="empty">Belum ada target.</div>')
        : '<div class="empty">' + (admin ? 'Pilih mahasiswa untuk melihat & mengatur targetnya.' : 'Akun Anda belum terhubung dengan data mahasiswa.') + '</div>') + '</div>';
    if (admin) html += '<div class="card"><div class="card-h"><div><h3>Rekap Status Kelulusan</h3><div class="sub">Tepat waktu vs berisiko terlambat</div></div></div><div id="tgTbl"></div></div>';
    else html += '<div class="card"><div class="card-h"><h3>Tips</h3></div><div class="col small muted" style="line-height:1.6"><div class="tile">' + ic('target') + ' Pecah target besar (tesis) menjadi tahap: proposal, seminar, sidang.</div><div class="tile">' + ic('clock') + ' Target yang melewati tenggat otomatis berstatus <b>Terlambat</b> dan Anda mendapat pengingat.</div><div class="tile">' + ic('circle-check') + ' Set progres 100% atau centang Tercapai saat selesai.</div></div></div>';
    body.innerHTML = html + '</div>';
    const sel = $('#tgMhs', body); if (sel) sel.onchange = () => { st.mhs = sel.value; renderTarget(body); };
    const add = $('[data-add]', body); if (add) add.onclick = () => targetForm(null, mhsId);
    const lu = $('[data-lulus]', body); if (lu) lu.onclick = () => lulusForm(me);
    $$('[data-edit]', body).forEach((b) => (b.onclick = () => targetForm(targets.find((x) => x.target_id === b.dataset.edit), mhsId)));
    $$('[data-del]', body).forEach((b) => (b.onclick = async () => {
      const x = targets.find((y) => y.target_id === b.dataset.del); if (!(await confirmDlg('Hapus target?', esc(x.judul_target), { danger: true, ok: 'Hapus' }))) return;
      const i = targets.indexOf(x); mutate('target.delete', { target_id: x.target_id }, { optimistic: () => targets.splice(i, 1), rollback: () => targets.splice(i, 0, x) });
    }));
    if (admin) {
      const rows = D.mhsList(D.jenisFilter()).map((x) => ({ x, n: targets.filter((t) => t.mhs_id === x.mhs_id).length, telat: targets.filter((t) => t.mhs_id === x.mhs_id && t.status === 'Terlambat').length }));
      table($('#tgTbl', body), { rows, per: 12, placeholder: 'Cari…', search: (r) => r.x.nama_lengkap,
        cols: [{ k: 'nama', t: 'Mahasiswa', sortVal: (r) => r.x.nama_lengkap, render: (r) => '<a href="#" data-pick="' + r.x.mhs_id + '">' + esc(r.x.nama_lengkap) + '</a>' },
          { k: 'lulus', t: 'Target Lulus', sortVal: (r) => r.x.target_lulus_semester, render: (r) => esc(r.x.target_lulus_semester || '—') },
          { k: 'st', t: 'Status', sortVal: (r) => r.x.status_target, render: (r) => (r.x.status_target ? statusChip(r.x.status_target) : '<span class="faint">—</span>') },
          { k: 'n', t: 'Target', sortVal: (r) => r.n, render: (r) => r.n + (r.telat ? ' <span class="chip red">' + r.telat + ' telat</span>' : '') }],
        after: (tb) => $$('[data-pick]', tb).forEach((a) => (a.onclick = (e) => { e.preventDefault(); st.mhs = a.dataset.pick; renderTarget(body); })) });
    }
  }
  function targetForm(x, mhsId) {
    const m = modal({ title: x ? 'Ubah Target' : 'Tambah Target', sub: esc(D.namaMhs(mhsId)), icon: 'target',
      body: '<div class="form-grid"><div class="field full"><label>Judul Target <span class="req">*</span></label><input class="inp" name="judul_target" value="' + esc(x ? x.judul_target : '') + '" placeholder="mis. Seminar proposal tesis"></div><div class="field"><label>Tenggat</label><input class="inp" type="date" name="tenggat" value="' + esc(x ? ymd(x.tenggat) : '') + '"></div>' +
        '<div class="field"><label>Progres: <b id="pv">' + (x ? x.progres || 0 : 0) + '%</b></label><input type="range" min="0" max="100" step="5" name="progres" value="' + (x ? x.progres || 0 : 0) + '" style="accent-color:var(--primary)"></div><div class="field full"><label>Catatan</label><input class="inp" name="catatan" value="' + esc(x ? x.catatan : '') + '"></div>' +
        '<label class="check"><input type="checkbox" name="tercapai" ' + (x && x.status === 'Tercapai' ? 'checked' : '') + '>Tandai Tercapai</label></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button>' });
    $('[name=progres]', m.el).oninput = (e) => ($('#pv', m.el).textContent = e.target.value + '%');
    $('[data-save]', m.el).onclick = () => {
      const fd = formData(m.el); if (!fd.judul_target.trim()) return toast('Judul wajib diisi.', 'error');
      const arr = D.isAdmin() ? S.boot.a.target : S.boot.u.target, prog = Number(fd.progres);
      const st = fd.tercapai || prog >= 100 ? 'Tercapai' : (fd.tenggat && fd.tenggat < todayYmd() ? 'Terlambat' : (prog > 0 ? 'Proses' : 'Belum'));
      K.saveLocal({ action: 'target.save', data: { target_id: x ? x.target_id : '', mhs_id: mhsId, judul_target: fd.judul_target, tenggat: fd.tenggat, progres: prog, catatan: fd.catatan, status: fd.tercapai ? 'Tercapai' : '' },
        list: () => arr, key: 'target_id', modal: m, reopen: (d) => targetForm(d, mhsId),
        row: Object.assign({}, x || {}, { target_id: x ? x.target_id : '', mhs_id: mhsId, judul_target: fd.judul_target.trim(), tenggat: fd.tenggat, progres: prog, catatan: fd.catatan, status: st }) });
    };
  }
  function lulusForm(me) {
    const m = modal({ title: 'Target Semester Lulus', sub: esc(me.nama_lengkap || ''), icon: 'graduation-cap', size: 'sm',
      body: '<div class="field"><label>Target lulus</label><select class="inp" name="t">' + ['Semester 3 (Akselerasi)', 'Semester 4 (Tepat Waktu)', 'Semester 5', 'Semester 6', 'Semester 7+'].map((x) => '<option ' + (me.target_lulus_semester === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button>' });
    $('[data-save]', m.el).onclick = () => {
      const v = $('[name=t]', m.el).value, arr = D.isAdmin() ? S.boot.a.target : S.boot.u.target, ex = arr.find((t) => t.mhs_id === me.mhs_id && /lulus/i.test(t.judul_target));
      const srcs = [S.boot.g.mahasiswa].concat(S.boot.a ? [S.boot.a.mahasiswa] : []), lama = me.target_lulus_semester;
      m.close();
      mutate('target.save', { target_id: ex ? ex.target_id : '', mhs_id: me.mhs_id, judul_target: ex ? ex.judul_target : 'Lulus ' + v, tenggat: ex ? ex.tenggat : '', progres: ex ? ex.progres : 0, target_lulus_semester: v }, {
        optimistic: () => srcs.forEach((a) => a.forEach((x) => { if (x.mhs_id === me.mhs_id) x.target_lulus_semester = v; })),
        rollback: () => srcs.forEach((a) => a.forEach((x) => { if (x.mhs_id === me.mhs_id) x.target_lulus_semester = lama; })),
        apply: (d) => upsertLocal(arr, 'target_id', d) });
    };
  }
  K.registerPage('rencana', { title: 'Rencana', show: renderRencana });

  // ============================================================== LAPORAN
  function rekapMahasiswa(jenis) {
    const g = S.boot.g, a = S.boot.a, todos = g.todo, tStat = a ? a.todoStatus : S.boot.u.todoStatus, targets = a ? a.target : S.boot.u.target;
    const list = D.isAdmin() ? D.mhsList(jenis) : [S.idx.mhs[S.me.mhs_id]].filter(Boolean);
    return list.map((x) => {
      const ts = g.penugasan.filter((t) => (t.petugas_ids || []).indexOf(x.mhs_id) > -1);
      const rel = todos.filter((t) => !t.jenis_kelas || t.jenis_kelas === 'Semua' || t.jenis_kelas === x.jenis_mahasiswa);
      const dn = tStat.filter((s) => s.mhs_id === x.mhs_id && s.selesai === 'Y' && rel.some((t) => t.todo_id === s.todo_id)).length;
      const tg = targets.filter((t) => t.mhs_id === x.mhs_id);
      return { x, tugas: ts.length, lengkap: ts.filter((t) => D.statusTugas(t) === 'Terkumpul').length, telat: ts.filter((t) => D.statusTugas(t) === 'Terlambat').length, todo: pct(dn, rel.length), todoTxt: dn + '/' + rel.length, target: tg.length, tercapai: tg.filter((t) => t.status === 'Tercapai').length };
    });
  }
  function renderLaporan(el) {
    const admin = D.isAdmin();
    const st = el._st || (el._st = { tab: admin ? 'grafik' : 'pribadi', mk: '', smt: D.smtAktifId() });
    const jenis = D.jenisFilter();
    const mks = S.boot.g.mk.filter((m) => !st.smt || m.semester_id === st.smt);
    el.innerHTML = '<div class="page-h"><div><h1>Laporan &amp; Export</h1><div class="sub">' + (admin ? 'Grafik, progres per mahasiswa, dan rekap per mata kuliah — dapat difilter & diekspor ke Excel/PDF.' : 'Laporan pribadi: penugasan, to-do, dan target Anda.') + '</div></div>' +
      '<div class="row wrap"><select class="top-sel" id="lpSmt">' + S.boot.g.semester.map((s) => '<option value="' + s.semester_id + '" ' + (s.semester_id === st.smt ? 'selected' : '') + '>' + esc(s.nama_semester) + '</option>').join('') + '</select>' + (admin ? '<span class="chip blue">' + esc(jenis || 'Semua jenis') + ' (filter di atas)</span>' : '') + '</div></div>' +
      (admin ? '<div class="tabs">' + [['grafik', 'Grafik Dashboard', 'chart-column'], ['mhs', 'Progres per Mahasiswa', 'users'], ['mk', 'Rekap per Mata Kuliah', 'book-open']].map((x) => '<button class="tab ' + (st.tab === x[0] ? 'active' : '') + '" data-tab="' + x[0] + '">' + ic(x[2]) + esc(x[1]) + '</button>').join('') + '</div>' : '') + '<div id="lpBody"></div>';
    $('#lpSmt', el).onchange = (e) => { st.smt = e.target.value; renderLaporan(el); };
    $$('[data-tab]', el).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; renderLaporan(el); }));
    const body = $('#lpBody', el), smtNama = (S.idx.smt[st.smt] || {}).nama_semester || '';
    const tugasSmt = S.boot.g.penugasan.filter((t) => { const mk = D.mkOfPtm(D.ptmOf(t)); return mk.semester_id === st.smt && D.tugasCocokJenis(t); });

    if (st.tab === 'pribadi') {
      const r = rekapMahasiswa()[0];
      const mine = D.tugasSaya().filter((t) => D.mkOfPtm(D.ptmOf(t)).semester_id === st.smt);
      body.innerHTML = r ? '<div class="grid g4 keep2">' + kpi('Penugasan Saya', r.tugas + ' tugas', r.lengkap + ' lengkap', 'presentation') + kpi('Berkas Lengkap', pct(r.lengkap, r.tugas) + '%', r.telat + ' terlambat', 'circle-check', 'green') + kpi('To-Do Selesai', r.todo + '%', r.todoTxt + ' item', 'list-checks', 'amber') + kpi('Target Tercapai', r.tercapai + '/' + r.target, 'Status: ' + (r.x.status_target || '-'), 'target') + '</div>' +
        '<div class="card mt20"><div class="card-h"><h3>Riwayat Penugasan Saya</h3><div class="row gap6"><button class="btn sm ghost" data-xls>' + ic('file-spreadsheet') + 'Excel</button><button class="btn sm ghost" data-pdf>' + ic('printer') + 'PDF</button></div></div><div id="lpT"></div></div>' : '<div class="card empty">Akun belum terhubung dengan data mahasiswa.</div>';
      if (!r) return;
      const rows = mine.map((t) => { const p = D.ptmOf(t), s = D.subs(t.tugas_id); return { mk: D.mkOfPtm(p).nama, sesi: p.nomor, tema: t.tema, deadline: fmtTgl(t.deadline_makalah), makalah: s.makalah ? '✓' : '—', ppt: s.ppt ? '✓' : '—', status: D.statusTugas(t) }; });
      table($('#lpT', body), { rows, cols: [{ k: 'mk', t: 'Mata Kuliah' }, { k: 'sesi', t: 'Sesi' }, { k: 'tema', t: 'Tema' }, { k: 'deadline', t: 'Deadline' }, { k: 'makalah', t: 'Makalah' }, { k: 'ppt', t: 'PPT' }, { k: 'status', t: 'Status', render: (x) => statusChip(x.status) }], empty: 'Belum ada penugasan.' });
      $('[data-xls]', body).onclick = () => K.exportXlsx('Laporan Pribadi ' + S.me.nama_lengkap, { Penugasan: rows });
      $('[data-pdf]', body).onclick = () => K.exportPdf('Laporan Pribadi — ' + S.me.nama_lengkap, smtNama, ['Mata Kuliah', 'Sesi', 'Tema', 'Deadline', 'Makalah', 'PPT', 'Status'], rows.map((x) => [x.mk, x.sesi, x.tema, x.deadline, x.makalah, x.ppt, x.status]));
      return;
    }
    if (st.tab === 'grafik') {
      const perMk = mks.map((m) => { const ts = tugasSmt.filter((t) => D.ptmOf(t).mk_id === m.mk_id); return { m, n: ts.length, mk: ts.filter((t) => D.subs(t.tugas_id).makalah).length, pp: ts.filter((t) => D.subs(t.tugas_id).ppt).length, ok: ts.filter((t) => D.statusTugas(t) === 'Terkumpul').length }; });
      const rk = rekapMahasiswa(jenis), stCount = { Terkumpul: 0, Sebagian: 0, Ditugaskan: 0, Terlambat: 0 };
      tugasSmt.forEach((t) => stCount[D.statusTugas(t)]++);
      const tepat = rk.filter((r) => r.x.status_target !== 'Berisiko').length;
      body.innerHTML = '<div class="grid g3"><div class="card"><div class="card-h"><h3>Progres Target Kelulusan</h3></div><div class="row" style="gap:20px">' + donut(pct(tepat, rk.length), { size: 120, stroke: 12, color: '#10B981' }) + '<div class="col gap6"><span class="chip green dot">' + tepat + ' tepat waktu</span><span class="chip red dot">' + (rk.length - tepat) + ' berisiko</span><span class="small muted">dari ' + rk.length + ' mahasiswa</span></div></div></div>' +
        '<div class="card"><div class="card-h"><h3>Penyelesaian Tugas</h3></div><div class="row" style="gap:20px">' + donut(pct(stCount.Terkumpul, tugasSmt.length), { size: 120, stroke: 12 }) + '<div class="col gap6">' + Object.keys(stCount).map((k) => '<span class="row gap6 small">' + statusChip(k) + '<b>' + stCount[k] + '</b></span>').join('') + '</div></div></div>' +
        '<div class="card"><div class="card-h"><h3>Rata-rata To-Do</h3></div><div class="row" style="gap:20px">' + donut(rk.length ? Math.round(rk.reduce((a, r) => a + r.todo, 0) / rk.length) : 0, { size: 120, stroke: 12, color: '#F5A623' }) + '<div class="small muted">Persentase rata-rata to-do selesai per mahasiswa' + (jenis ? ' (' + jenis + ')' : '') + '</div></div></div></div>' +
        '<div class="card mt20"><div class="card-h"><div><h3>Status Pengumpulan per Mata Kuliah</h3><div class="sub">Persentase makalah & PPT terkumpul</div></div><span class="legend"><span><i style="background:#3F55A8"></i>Makalah</span><span><i style="background:#5B74DB"></i>PPT</span></span></div>' + (perMk.length ? bars(perMk.map((x) => ({ x: x.m.kode, title: x.m.nama, a: pct(x.mk, x.n), b: pct(x.pp, x.n), av: x.mk + '/' + x.n, bv: x.pp + '/' + x.n })), 100) : '<div class="empty">Tidak ada data.</div>') + '</div>';
      return;
    }
    if (st.tab === 'mhs') {
      const rows = rekapMahasiswa(jenis);
      body.innerHTML = '<div class="card"><div class="card-h"><div><h3>Progres per Mahasiswa</h3><div class="sub">' + esc(smtNama) + (jenis ? ' · ' + jenis : '') + '</div></div><div class="row gap6"><button class="btn sm ghost" data-xls>' + ic('file-spreadsheet') + 'Excel</button><button class="btn sm ghost" data-pdf>' + ic('printer') + 'PDF</button></div></div><div id="lpT"></div></div>';
      table($('#lpT', body), { rows, per: 25, placeholder: 'Cari nama / NIM…', search: (r) => r.x.nama_lengkap + ' ' + (r.x.nim || ''),
        cols: [{ k: 'nama', t: 'Mahasiswa', sortVal: (r) => r.x.nama_lengkap, render: (r) => '<div class="person">' + avMhs(r.x, 'sm') + '<div class="t"><b>' + profLink('mhs', r.x.mhs_id, r.x.nama_lengkap) + '</b><span>' + esc(r.x.nim || r.x.email) + '</span></div></div>' },
          { k: 'jenis', t: 'Jenis', sortVal: (r) => r.x.jenis_mahasiswa, render: (r) => chipJenis(r.x.jenis_mahasiswa) },
          { k: 'tugas', t: 'Tugas', sortVal: (r) => r.tugas, render: (r) => r.lengkap + '/' + r.tugas + (r.telat ? ' <span class="chip red">' + r.telat + ' telat</span>' : '') },
          { k: 'todo', t: 'To-Do', sortVal: (r) => r.todo, render: (r) => '<div style="min-width:100px">' + progress(r.todo, r.todo === 100 ? 'green' : '') + '<span class="xs muted">' + r.todoTxt + '</span></div>' },
          { k: 'target', t: 'Target', sortVal: (r) => r.tercapai, render: (r) => r.tercapai + '/' + r.target },
          { k: 'st', t: 'Status Lulus', sortVal: (r) => r.x.status_target, render: (r) => (r.x.status_target ? statusChip(r.x.status_target) : '—') + '<div class="xs muted">' + esc(r.x.target_lulus_semester || '') + '</div>' }] });
      const flat = rows.map((r) => ({ Nama: r.x.nama_lengkap, NIM: r.x.nim || '', Email: r.x.email, Jenis: r.x.jenis_mahasiswa, 'Tugas Lengkap': r.lengkap, 'Total Tugas': r.tugas, Terlambat: r.telat, 'To-Do (%)': r.todo, 'Target Tercapai': r.tercapai, 'Total Target': r.target, 'Target Lulus': r.x.target_lulus_semester || '', 'Status Lulus': r.x.status_target || '' }));
      $('[data-xls]', body).onclick = () => K.exportXlsx('Progres Mahasiswa ' + smtNama + (jenis ? ' ' + jenis : ''), { 'Progres Mahasiswa': flat });
      $('[data-pdf]', body).onclick = () => K.exportPdf('Laporan Progres per Mahasiswa', smtNama + (jenis ? ' · ' + jenis : ''), ['Nama', 'NIM', 'Jenis', 'Tugas', 'To-Do', 'Target', 'Status'], rows.map((r) => [r.x.nama_lengkap, r.x.nim || '', r.x.jenis_mahasiswa, r.lengkap + '/' + r.tugas, r.todo + '%', r.tercapai + '/' + r.target, r.x.status_target || '-']));
      return;
    }
    // rekap per MK
    if (!st.mk || !mks.some((m) => m.mk_id === st.mk)) st.mk = (mks[0] || {}).mk_id || '';
    const mk = S.idx.mk[st.mk];
    const rows = mk ? (S.idx.ptmByMk[mk.mk_id] || []).map((p) => { const ts = (S.idx.tugasByPtm[p.pertemuan_id] || []).filter(D.tugasCocokJenis); const t = ts[0]; const s = t ? D.subs(t.tugas_id) : {};
      return { sesi: p.nomor, tanggal: fmtTgl(p.tanggal), jenis: p.jenis, tema: (t && t.tema) || p.tema || '', petugas: t ? petugasNames(t) : (p.jenis === 'Pembelajaran' ? 'Belum ditetapkan' : '—'), makalah: s.makalah ? 'Terkumpul' : (t ? 'Belum' : '—'), ppt: s.ppt ? 'Terkumpul' : (t ? 'Belum' : '—'), status: t ? D.statusTugas(t) : '' }; }) : [];
    body.innerHTML = '<div class="card"><div class="card-h"><div class="row wrap"><select class="inp" id="lpMk" style="width:auto">' + mks.map((m) => '<option value="' + m.mk_id + '" ' + (m.mk_id === st.mk ? 'selected' : '') + '>' + esc(m.kode + ' — ' + m.nama) + '</option>').join('') + '</select></div><div class="row gap6"><button class="btn sm ghost" data-xls>' + ic('file-spreadsheet') + 'Excel</button><button class="btn sm ghost" data-pdf>' + ic('printer') + 'PDF</button></div></div><div id="lpT"></div></div>';
    table($('#lpT', body), { rows, per: 16, sortDefault: 'sesi', cols: [{ k: 'sesi', t: 'Sesi', sortVal: (r) => Number(r.sesi) }, { k: 'tanggal', t: 'Tanggal' }, { k: 'tema', t: 'Tema', render: (r) => esc(r.tema) + (r.jenis !== 'Pembelajaran' ? ' <span class="chip violet">' + r.jenis + '</span>' : '') }, { k: 'petugas', t: 'Petugas' }, { k: 'makalah', t: 'Makalah', render: (r) => (r.makalah === 'Terkumpul' ? statusChip('Terkumpul') : esc(r.makalah)) }, { k: 'ppt', t: 'PPT', render: (r) => (r.ppt === 'Terkumpul' ? statusChip('Terkumpul') : esc(r.ppt)) }, { k: 'status', t: 'Status', render: (r) => (r.status ? statusChip(r.status) : '') }] });
    const lm = $('#lpMk', body); if (lm) lm.onchange = () => { st.mk = lm.value; renderLaporan(el); };
    $('[data-xls]', body).onclick = () => mk && K.exportXlsx('Rekap ' + mk.kode + ' ' + mk.nama, { Rekap: rows.map((r) => ({ Sesi: r.sesi, Tanggal: r.tanggal, Jenis: r.jenis, Tema: r.tema, Petugas: r.petugas, Makalah: r.makalah, PPT: r.ppt, Status: r.status })) });
    $('[data-pdf]', body).onclick = () => mk && K.exportPdf('Rekap ' + mk.kode + ' — ' + mk.nama, smtNama + (jenis ? ' · ' + jenis : ''), ['Sesi', 'Tanggal', 'Tema', 'Petugas', 'Makalah', 'PPT', 'Status'], rows.map((r) => [r.sesi, r.tanggal, r.tema, r.petugas, r.makalah, r.ppt, r.status]));
  }
  K.registerPage('laporan', { title: 'Laporan', show: renderLaporan });

  // ============================================================== PROFIL
  K.registerPage('profil', {
    title: 'Profil Saya',
    show(el) {
      const me = S.me, m = S.idx.mhs[me.mhs_id] || {};
      el.innerHTML = '<div class="page-h"><div><h1>Profil Saya</h1><div class="sub">Data akun & kontak untuk notifikasi pengingat.</div></div></div><div class="split"><div class="card pad-lg"><div class="row" style="gap:18px"><div class="prof-ph">' + (K.fotoSaya() ? '<img src="' + esc(K.fotoSaya()) + '" alt="">' : '<span class="ini">' + esc(K.initials(me.nama_lengkap)) + '</span>') + '<button class="prof-cam" data-myfoto title="Ganti foto profil">' + ic('camera') + '</button></div><div><h2 style="font-size:22px">' + esc(me.nama_lengkap) + '</h2><div class="row wrap gap6 mt8"><span class="chip blue">' + esc(K.ROLE_LABEL[me.role]) + '</span>' + chipJenis(me.jenis_mahasiswa) + (me.nim ? '<span class="chip">NIM ' + esc(me.nim) + '</span>' : '') + '</div><div class="small muted mt8">' + esc(me.email) + '</div></div></div>' +
        '<div class="form-grid mt20"><div class="field"><label>Nama Lengkap &amp; Gelar</label><input class="inp" name="nama_lengkap" value="' + esc(me.nama_lengkap) + '"></div><div class="field"><label>No. WhatsApp / HP</label><div class="inp-group"><span class="pre">+62</span><input name="no_hp" value="' + esc(String(me.no_hp || '').replace(/^0/, '')) + '"></div><span class="hint">Untuk reminder H-7, H-3, H-1.</span></div>' +
        '<div class="field"><label>Email Google</label><input class="inp" value="' + esc(me.email) + '" readonly></div><div class="field"><label>Angkatan / Konsentrasi</label><input class="inp" value="' + esc([m.angkatan, m.konsentrasi].filter(Boolean).join(' · ') || '-') + '" readonly></div></div>' +
        '<div class="row mt20"><button class="btn" data-save>' + ic('check') + 'Simpan Profil</button><button class="btn ghost" data-logout>' + ic('log-out') + 'Keluar</button></div></div>' +
        '<div class="card"><div class="card-h"><h3>Aktivitas Saya</h3></div><div class="col"><div class="tile row between"><span>Tugas presentasi</span><b>' + D.tugasSaya().length + '</b></div><div class="tile row between"><span>Berkas lengkap</span><b>' + D.tugasSaya().filter((t) => D.statusTugas(t) === 'Terkumpul').length + '</b></div><div class="tile row between"><span>Target pribadi</span><b>' + S.boot.u.target.length + '</b></div><div class="tile row between"><span>Status kelulusan</span>' + (m.status_target ? statusChip(m.status_target) : '<b>-</b>') + '</div></div></div></div>';
      $('[data-myfoto]', el).onclick = () => K.pilihFoto(me.mhs_id || me.user_id, me.nama_lengkap);
      $('[data-save]', el).onclick = () => {
        const fd = formData(el);
        if (!K.hpValid(fd.no_hp)) return toast('Nomor HP tidak valid.', 'error');
        const prev = { n: S.boot.me.nama_lengkap, h: S.boot.me.no_hp };
        mutate('profile.save', { nama_lengkap: fd.nama_lengkap, no_hp: K.hp08(fd.no_hp) }, {
          optimistic: () => { S.boot.me.nama_lengkap = fd.nama_lengkap; S.boot.me.no_hp = K.hp08(fd.no_hp); K.renderShell(); },
          rollback: () => { S.boot.me.nama_lengkap = prev.n; S.boot.me.no_hp = prev.h; K.renderShell(); } });
      };
    }
  });

  // ============================================================== v1.2 — TANGGAL PERTEMUAN OTOMATIS
  const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const hariOf = (y) => (y ? HARI_ID[new Date(y + 'T00:00:00').getDay()] : '');
  /** Tanggal mingguan: sesi ke-n = mulai + (n − dari) × 7 hari (cermin logika server pertemuan.jadwalkan). */
  function hitungJadwal(mkId, mulai, dari) {
    dari = Number(dari || 1);
    return (S.idx.ptmByMk[mkId] || []).filter((p) => Number(p.nomor) >= dari).map((p) => ({ p, lama: ymd(p.tanggal), baru: addDays(mulai, (Number(p.nomor) - dari) * 7) }));
  }
  /** Tanggal presentasi & deadline penugasan ikut tanggal sesi bila sebelumnya mengikuti tanggal lama (cermin server). */
  function sinkronTugasLokal(ubah) {
    const map = {}; ubah.forEach((u) => { if (u.baru && u.baru !== u.lama) map[u.p.pertemuan_id] = u; });
    S.boot.g.penugasan.forEach((t) => {
      const u = map[t.pertemuan_id]; if (!u) return;
      const tp = ymd(t.tanggal_presentasi), dl = ymd(t.deadline_makalah);
      if (!tp || tp === u.lama) t.tanggal_presentasi = u.baru;
      if (!dl || (u.lama && dl === addDays(u.lama, -2))) t.deadline_makalah = addDays(u.baru, -2);
    });
  }
  function terapkanPtm(list) { const g = S.boot.g; (list || []).forEach((x) => { const i = g.pertemuan.findIndex((p) => p.pertemuan_id === x.pertemuan_id); if (i > -1) g.pertemuan[i] = Object.assign(g.pertemuan[i], x); }); }
  function terapkanTugas(list) { const g = S.boot.g; (list || []).forEach((x) => { const i = g.penugasan.findIndex((t) => t.tugas_id === x.tugas_id); if (i > -1) g.penugasan[i] = Object.assign(g.penugasan[i], x); }); }
  /** Saran tanggal sesi 1: tanggal sesi 1 yang ada → atau hari kuliah pertama sejak semester dimulai. */
  function saranSesi1(mkId) {
    const ps = S.idx.ptmByMk[mkId] || [], p1 = ps[0];
    if (p1 && ymd(p1.tanggal)) return ymd(p1.tanggal);
    const mk = S.idx.mk[mkId] || {}, smt = S.idx.smt[mk.semester_id] || {}, j = (S.idx.jadwalByMk[mkId] || [])[0];
    let d = ymd(smt.tanggal_mulai) || todayYmd();
    if (j && HARI_ID.indexOf(j.hari) > -1) for (let i = 0; i < 7 && hariOf(d) !== j.hari; i++) d = addDays(d, 1);
    return d;
  }
  /** Simpan jadwal otomatis (optimistis: tampilan langsung berubah, server menyusul). */
  function jadwalkan(mkId, mulai, dari) {
    const ubah = hitungJadwal(mkId, mulai, dari);
    const prevP = ubah.map((u) => ({ p: u.p, t: u.p.tanggal })), prevT = S.boot.g.penugasan.map((t) => ({ t, a: t.tanggal_presentasi, b: t.deadline_makalah }));
    return mutate('pertemuan.jadwalkan', { mk_id: mkId, tanggal_mulai: mulai, dari: Number(dari || 1) }, {
      optimistic: () => { ubah.forEach((u) => (u.p.tanggal = u.baru)); sinkronTugasLokal(ubah); },
      rollback: () => { prevP.forEach((x) => (x.p.tanggal = x.t)); prevT.forEach((x) => { x.t.tanggal_presentasi = x.a; x.t.deadline_makalah = x.b; }); },
      apply: (d) => { terapkanPtm(d.pertemuan); terapkanTugas(d.penugasan); }
    });
  }
  function jadwalkanForm(mkId, dari0) {
    const mk = S.idx.mk[mkId] || {}, ps = S.idx.ptmByMk[mkId] || [], j = (S.idx.jadwalByMk[mkId] || [])[0];
    const dari = Number(dari0 || 1), awal = dari > 1 ? (ymd((ps[dari - 1] || {}).tanggal) || todayYmd()) : saranSesi1(mkId);
    const m = modal({
      title: 'Atur Tanggal Pertemuan Otomatis', sub: esc((mk.kode ? mk.kode + ' · ' : '') + (mk.nama || '')), icon: 'calendar-range', size: 'lg',
      body: '<div class="alert info">' + ic('info') + '<span>Cukup isi <b>tanggal perkuliahan pertama</b> — sesi berikutnya terisi otomatis <b>setiap minggu</b> (UTS di sesi 8, UAS di sesi 16). Jadwal berubah di tengah semester? Pilih <b>mulai dari sesi</b> yang terdampak; sesi sebelumnya tidak berubah.</span></div>' +
        '<div class="form-grid mt16"><div class="field"><label>Mulai dari sesi</label><select class="inp" name="dari">' + ps.map((p) => '<option value="' + p.nomor + '" ' + (Number(p.nomor) === dari ? 'selected' : '') + '>Sesi ' + p.nomor + (p.jenis !== 'Pembelajaran' ? ' (' + esc(p.jenis) + ')' : '') + '</option>').join('') + '</select></div>' +
        '<div class="field"><label id="lblMulai">Tanggal sesi ' + dari + ' <span class="req">*</span></label><input class="inp" type="date" name="mulai" value="' + esc(awal) + '"><span class="hint" id="hariInfo"></span></div></div>' +
        '<div class="sec-t">PRATINJAU 16 TANGGAL</div><div class="tgl-prev" id="tglPrev"></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>' + ic('check') + 'Terapkan Tanggal</button>'
    });
    const draw = () => {
      const fd = formData(m.el), d = Number(fd.dari || 1);
      $('#lblMulai', m.el).innerHTML = 'Tanggal sesi ' + d + ' <span class="req">*</span>';
      const h = hariOf(fd.mulai);
      $('#hariInfo', m.el).innerHTML = fd.mulai ? 'Hari ' + esc(h) + (j && j.hari && j.hari !== h ? ' · <span style="color:var(--amber-ink)">jadwal rutin tercatat hari ' + esc(j.hari) + '</span>' : '') : '';
      const map = {}; if (fd.mulai) hitungJadwal(mkId, fd.mulai, d).forEach((u) => (map[u.p.pertemuan_id] = u.baru));
      $('#tglPrev', m.el).innerHTML = ps.map((p) => { const b = map[p.pertemuan_id], t = b || ymd(p.tanggal); return '<span class="' + (p.jenis !== 'Pembelajaran' ? 'uj' : '') + '" style="' + (b && b !== ymd(p.tanggal) ? 'border-color:var(--primary);color:var(--primary-ink);font-weight:600' : (b ? '' : 'opacity:.55')) + '">S' + p.nomor + ' · ' + (t ? esc(fmtTgl(t)) : '—') + '</span>'; }).join('');
    };
    m.el.addEventListener('input', draw); m.el.addEventListener('change', draw); draw();
    $('[data-save]', m.el).onclick = () => {
      const fd = formData(m.el);
      if (!fd.mulai) return toast('Isi tanggal perkuliahan pertama.', 'error');
      m.close(); jadwalkan(mkId, fd.mulai, fd.dari);
    };
    return m;
  }
  function ptmForm(p) {
    const ps = S.idx.ptmByMk[p.mk_id] || [], akhir = ps.length ? Number(ps[ps.length - 1].nomor) : 16, lamaT = ymd(p.tanggal);
    const m = modal({
      title: 'Kelola Sesi ' + p.nomor, sub: esc((S.idx.mk[p.mk_id] || {}).nama || '') + ' · ' + esc(p.jenis), icon: 'calendar-check',
      body: '<div class="form-grid"><div class="field"><label>Tanggal</label><input class="inp" type="date" name="tanggal" value="' + esc(lamaT) + '"></div><div class="field"><label>Status</label><select class="inp" name="status">' + ['Terjadwal', 'Berlangsung', 'Selesai', 'Dibatalkan'].map((x) => '<option ' + (x === (p.status || 'Terjadwal') ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        '<div class="field full"><label>Tema / Topik Sesi</label><input class="inp" name="tema" value="' + esc(p.tema || '') + '"></div></div>' +
        (Number(p.nomor) < akhir ? '<label class="check mt12" id="geserRow"><input type="checkbox" name="geser">Geser juga Sesi ' + (Number(p.nomor) + 1) + '–' + akhir + ' mengikuti tanggal baru (tetap mingguan)</label><div class="small muted mt8" id="geserInfo"></div>' : '') +
        '<div class="alert info mt16">' + ic('calendar-range') + '<span>Atur semua tanggal sekaligus: cukup isi tanggal <b>sesi pertama</b>, sesi berikutnya terisi otomatis setiap minggu.</span><button class="btn xs soft" data-auto>Atur otomatis</button></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button>'
    });
    const info = () => {
      const el = $('#geserInfo', m.el); if (!el) return;
      const fd = formData(m.el);
      el.innerHTML = fd.geser && fd.tanggal ? 'Sesi ' + (Number(p.nomor) + 1) + ' → ' + esc(fmtTgl(addDays(fd.tanggal, 7))) + ' · Sesi ' + akhir + ' → ' + esc(fmtTgl(addDays(fd.tanggal, (akhir - Number(p.nomor)) * 7))) : (fd.tanggal && fd.tanggal !== lamaT ? 'Hanya sesi ini yang diubah (mis. dosen mengganti jadwal satu kali).' : '');
    };
    m.el.addEventListener('change', info); m.el.addEventListener('input', info);
    $('[data-save]', m.el).onclick = () => {
      const fd = formData(m.el), baru = fd.tanggal, geser = !!fd.geser && !!baru && baru !== lamaT;
      const data = { pertemuan_id: p.pertemuan_id, tanggal: baru, status: fd.status, tema: fd.tema, geser };
      const ubah = [{ p, lama: lamaT, baru }].concat(geser ? ps.filter((x) => Number(x.nomor) > Number(p.nomor)).map((x) => ({ p: x, lama: ymd(x.tanggal), baru: addDays(baru, (Number(x.nomor) - Number(p.nomor)) * 7) })) : []);
      const prevP = ubah.map((u) => ({ p: u.p, t: u.p.tanggal })), prev = Object.assign({}, p), prevT = S.boot.g.penugasan.map((t) => ({ t, a: t.tanggal_presentasi, b: t.deadline_makalah }));
      m.close();
      mutate('pertemuan.save', data, {
        optimistic: () => { Object.assign(p, { status: fd.status, tema: fd.tema }); ubah.forEach((u) => (u.p.tanggal = u.baru)); if (baru !== lamaT) sinkronTugasLokal(ubah); },
        rollback: () => { Object.assign(p, prev); prevP.forEach((x) => (x.p.tanggal = x.t)); prevT.forEach((x) => { x.t.tanggal_presentasi = x.a; x.t.deadline_makalah = x.b; }); },
        apply: (d) => { if (d && d._ubah) terapkanPtm(d._ubah); }
      });
    };
    $('[data-auto]', m.el).onclick = () => { m.close(); jadwalkanForm(p.mk_id); };
  }

  // ============================================================== v1.2 — IMPORT TEMA DARI EXCEL
  const KOLOM_NO = ['sesi', 'pertemuan', 'pertemuanke', 'sesike', 'no', 'nomor', 'ke'], KOLOM_TEMA = ['tema', 'topik', 'temapertemuan', 'temasesi', 'judul', 'materi', 'pokokbahasan'];
  async function unduhTemplateTema(mkId) {
    const mk = S.idx.mk[mkId] || {}, ps = S.idx.ptmByMk[mkId] || [];
    await K.loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const aoa = [['Sesi', 'Jenis', 'Tanggal', 'Tema']].concat(ps.map((p) => [Number(p.nomor), p.jenis, ymd(p.tanggal) ? fmtTgl(p.tanggal) : '', p.tema || '']));
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 80 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Tema Pertemuan');
    XLSX.writeFile(wb, ('Template Tema - ' + (mk.kode || '') + ' ' + (mk.nama || '')).replace(/[\\/:*?"<>|]/g, '-').trim() + '.xlsx');
  }
  function temaImportForm(mkId) {
    const mk = S.idx.mk[mkId] || {}, ps = S.idx.ptmByMk[mkId] || [], byNo = {}; ps.forEach((p) => (byNo[Number(p.nomor)] = p));
    let rows = null;
    const m = modal({
      title: 'Import Tema Pertemuan (Excel)', sub: esc((mk.kode ? mk.kode + ' · ' : '') + (mk.nama || '')), icon: 'file-spreadsheet', size: 'lg',
      body: '<div class="grid g2" style="gap:12px"><div class="tile"><b class="semi">1. Unduh template</b><div class="small muted mt8">Berisi Sesi 1–16 (tema saat ini sudah terisi). Ubah kolom <b>Tema</b> saja.</div><button class="btn ghost sm mt12" data-tpl>' + ic('download') + 'Unduh Template Excel</button></div>' +
        '<div class="tile"><b class="semi">2. Unggah kembali</b><div class="small muted mt8">Format <b>.xlsx / .xls</b> (bukan CSV). Kolom wajib: <b>Sesi</b> & <b>Tema</b>. Setelah tersimpan, tema tetap bisa diedit manual di "Kelola Sesi".</div></div></div>' +
        '<label class="dropzone mt16" data-dzx><input type="file" accept=".xlsx,.xls" hidden>' + ic('cloud-upload') + '<div class="semi mt8">Seret berkas Excel ke sini atau klik untuk memilih</div><div class="small muted">XLSX / XLS</div></label>' +
        '<div id="temaPrev" class="mt16"></div>',
      foot: '<label class="check" style="margin-right:auto"><input type="checkbox" name="kosongkan">Sel tema kosong = hapus tema sesi itu</label><button class="btn ghost" data-close>Batal</button><button class="btn" data-save disabled>' + ic('check') + 'Simpan Tema</button>'
    });
    $('[data-tpl]', m.el).onclick = (e) => { const b = e.target.closest('button'); busy(b, true, 'Menyiapkan…'); unduhTemplateTema(mkId).catch((er) => toast('Gagal membuat template: ' + er.message, 'error')).finally(() => busy(b, false)); };
    const dz = $('[data-dzx]', m.el), inp = $('input', dz);
    const draw = () => {
      const kos = !!$('[name=kosongkan]', m.el).checked;
      let nUbah = 0;
      const html = rows.map((r) => {
        const p = byNo[r.nomor], lama = p ? String(p.tema || '') : '';
        let st;
        if (!p) st = '<span class="chip red">Sesi tidak dikenal</span>';
        else if (!r.tema && !kos) st = '<span class="chip">Kosong — dilewati</span>';
        else if (r.tema === lama) st = '<span class="chip">Sama</span>';
        else { st = '<span class="chip green">' + (r.tema ? 'Diperbarui' : 'Dikosongkan') + '</span>'; nUbah++; }
        return '<tr><td><b>' + esc(r.raw) + '</b></td><td class="muted">' + esc(lama || '—') + '</td><td class="baru">' + esc(r.tema || '—') + '</td><td>' + st + '</td></tr>';
      }).join('');
      $('#temaPrev', m.el).innerHTML = '<div class="alert ' + (nUbah ? 'ok' : 'warn') + '">' + ic(nUbah ? 'circle-check' : 'info') + '<span><b>' + nUbah + '</b> tema akan diperbarui dari ' + rows.length + ' baris.</span></div>' +
        '<div class="tbl-wrap mt12" style="max-height:340px;overflow:auto"><table class="tbl tema-prev"><thead><tr><th>Sesi</th><th>Tema saat ini</th><th>Tema baru</th><th>Status</th></tr></thead><tbody>' + html + '</tbody></table></div>';
      $('[data-save]', m.el).disabled = !nUbah;
    };
    const pick = async (file) => {
      if (!file) return;
      const ext = ((file.name.match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
      if (['xlsx', 'xls'].indexOf(ext) < 0) return toast('Gunakan berkas Excel (.xlsx / .xls), bukan ' + (ext ? '.' + ext.toUpperCase() : 'berkas ini') + '.', 'error');
      try {
        const data = await K.parseSheetFile(file);
        if (!data.length) return toast('Berkas Excel kosong.', 'error');
        const keys = Object.keys(data[0]), kNo = keys.find((k) => KOLOM_NO.indexOf(K.normKey(k)) > -1), kTema = keys.find((k) => KOLOM_TEMA.indexOf(K.normKey(k)) > -1);
        if (!kNo || !kTema) return toast('Kolom "Sesi" dan "Tema" tidak ditemukan. Gunakan template yang disediakan.', 'error');
        rows = data.map((r) => ({ raw: String(r[kNo]).trim(), nomor: Number(String(r[kNo]).replace(/[^0-9]/g, '')), tema: String(r[kTema] == null ? '' : r[kTema]).replace(/\s+/g, ' ').trim() })).filter((r) => r.raw || r.tema);
        dz.innerHTML = '<input type="file" accept=".xlsx,.xls" hidden>' + ic('file-spreadsheet') + '<div class="semi mt8">' + esc(file.name) + '</div><div class="small muted">' + rows.length + ' baris dibaca · klik untuk ganti berkas</div>';
        $('input', dz).onchange = (e) => pick(e.target.files[0]);
        draw();
      } catch (er) { toast('Berkas tidak dapat dibaca: ' + er.message, 'error'); }
    };
    inp.onchange = (e) => pick(e.target.files[0]);
    ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => e.dataTransfer.files[0] && pick(e.dataTransfer.files[0]));
    $('[name=kosongkan]', m.el).onchange = () => rows && draw();
    $('[data-save]', m.el).onclick = () => {
      const kos = !!$('[name=kosongkan]', m.el).checked;
      const kirim = rows.filter((r) => byNo[r.nomor] && (r.tema || kos)).map((r) => ({ nomor: r.nomor, tema: r.tema }));
      const prev = ps.map((p) => ({ p, t: p.tema }));
      m.close();
      mutate('pertemuan.temaImport', { mk_id: mkId, rows: kirim, kosongkan: kos }, {
        optimistic: () => kirim.forEach((r) => { byNo[r.nomor].tema = r.tema; }),
        rollback: () => prev.forEach((x) => (x.p.tema = x.t)),
        apply: (d) => terapkanPtm(d.pertemuan)
      });
    };
  }

  // ============================================================== v1.2 — ARSIP MATERI
  const JENIS_FILE = [['', 'Semua jenis file'], ['pdf', 'PDF'], ['word', 'Word (DOC/DOCX)'], ['ppt', 'PowerPoint (PPT/PPTX)'], ['excel', 'Excel (XLS/XLSX/CSV)'], ['ebook', 'E-book (EPUB)'], ['gambar', 'Gambar (JPG/PNG)'], ['video', 'Video YouTube'], ['teks', 'Teks / Notulen tertulis']];
  const KAT = ['Makalah', 'Slide', 'Referensi', 'E-book', 'Video', 'Notulen'];
  function jenisFileOf(x) {
    if (x.embed) return 'video';
    if (!x.fileId) return 'teks';
    const e = ((String(x.nama || '').match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
    if (e === 'pdf') return 'pdf'; if (/^docx?$/.test(e)) return 'word'; if (/^pptx?$/.test(e)) return 'ppt'; if (/^(xlsx?|csv)$/.test(e)) return 'excel';
    if (e === 'epub') return 'ebook'; if (/^(png|jpe?g|gif|webp)$/.test(e)) return 'gambar';
    return 'teks';
  }
  function arsipItems() {
    const g = S.boot.g, out = [];
    g.submission.forEach((s) => {
      const t = S.idx.tugas[s.tugas_id]; if (!t) return; const p = D.ptmOf(t);
      out.push({ id: 's' + s.submission_id, kat: s.jenis_file === 'PPT' ? 'Slide' : 'Makalah', judul: t.tema || s.nama_file, ket: s.nama_file, mk_id: p.mk_id, nomor: Number(p.nomor) || 0, oleh: D.namaUser(s.pengirim_id), tgl: s.tanggal_unggah, fileId: s.drive_file_id, nama: s.nama_file, mime: s.mime, ukuran: s.ukuran });
    });
    g.referensi.forEach((r) => {
      const p = S.idx.ptm[r.pertemuan_id];
      out.push({ id: 'r' + r.ref_id, kat: r.tipe === 'YouTube' ? 'Video' : r.tipe === 'E-book' ? 'E-book' : 'Referensi', judul: r.judul, ket: r.tipe === 'YouTube' ? 'Video YouTube' : r.nama_file, mk_id: r.mk_id, nomor: p ? Number(p.nomor) : 0, oleh: D.namaUser(r.pengunggah_id), tgl: r.tanggal, fileId: r.drive_file_id, nama: r.nama_file, mime: r.mime, ukuran: r.ukuran, embed: r.tipe === 'YouTube' ? r.url_embed : '' });
    });
    g.notulen.forEach((n) => {
      const p = S.idx.ptm[n.pertemuan_id] || {};
      out.push({ id: 'n' + n.notulen_id, kat: 'Notulen', judul: n.judul, ket: n.drive_file_id ? n.nama_file : 'Catatan tertulis', mk_id: p.mk_id, nomor: Number(p.nomor) || 0, oleh: D.namaUser(n.pengunggah_id), tgl: n.tanggal, fileId: n.drive_file_id, nama: n.nama_file, mime: n.mime, ukuran: n.ukuran, teks: n.isi });
    });
    out.forEach((x) => { x.jenis = jenisFileOf(x); const mk = S.idx.mk[x.mk_id] || {}; x.mk = mk; x.cari = [x.judul, x.ket, x.oleh, mk.kode, mk.nama, x.kat, x.teks].join(' ').toLowerCase(); });
    return out;
  }
  function bukaArsip(x) {
    const info = [(x.mk.kode || ''), x.nomor ? 'Sesi ' + x.nomor : 'Umum', x.kat, x.oleh].filter(Boolean).join(' · ');
    if (x.embed) return openViewer({ embed: x.embed, nama: x.judul, mime: 'video/youtube', title: x.judul, info });
    if (x.fileId) return openViewer({ fileId: x.fileId, nama: x.nama, mime: x.mime, ukuran: x.ukuran, title: x.judul, info });
    modal({ title: x.judul, sub: esc(info), icon: 'notebook-pen', size: 'lg', body: '<div style="white-space:pre-wrap;line-height:1.7">' + esc(x.teks || '') + '</div>', foot: '<button class="btn" data-close>Tutup</button>' });
  }
  const sorot = (s, q) => { const t = esc(s || ''); if (!q) return t; const i = t.toLowerCase().indexOf(esc(q).toLowerCase()); return i < 0 ? t : t.slice(0, i) + '<mark>' + t.slice(i, i + esc(q).length) + '</mark>' + t.slice(i + esc(q).length); };
  function renderArsip(el) {
    const st = el._st || (el._st = { mk: '', no: '', jenis: '', kat: '', q: '', urut: 'baru', n: 24 });
    const all = arsipItems(), mks = S.boot.g.mk.slice().sort((a, b) => String(a.kode).localeCompare(String(b.kode)));
    const ps = st.mk ? (S.idx.ptmByMk[st.mk] || []) : [];
    el.innerHTML = '<div class="page-h"><div><h1>Arsip Materi</h1><div class="sub">Semua makalah, slide, referensi, e-book, video, dan notulen kelas dalam satu tempat. Klik untuk membuka di dalam aplikasi.</div></div><span class="chip blue">' + all.length + ' materi</span></div>' +
      '<div class="card"><div class="arsip-filter">' +
      '<div class="field"><label>Cari</label><div class="searchbox" style="max-width:none">' + ic('search') + '<input id="arQ" placeholder="Judul, nama berkas, pengunggah, mata kuliah…" value="' + esc(st.q) + '"></div></div>' +
      '<div class="field"><label>Mata Kuliah</label><select class="inp" id="arMk"><option value="">Semua mata kuliah</option>' + mks.map((m) => '<option value="' + m.mk_id + '" ' + (st.mk === m.mk_id ? 'selected' : '') + '>' + esc(m.kode + ' — ' + m.nama) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Pertemuan</label><select class="inp" id="arNo"><option value="">Semua pertemuan</option><option value="0" ' + (st.no === '0' ? 'selected' : '') + '>Umum (tanpa sesi)</option>' +
        (ps.length ? ps.map((p) => '<option value="' + p.nomor + '" ' + (st.no === String(p.nomor) ? 'selected' : '') + '>Sesi ' + p.nomor + (p.tema ? ' · ' + esc(String(p.tema).slice(0, 40)) : p.jenis !== 'Pembelajaran' ? ' · ' + esc(p.jenis) : '') + '</option>').join('')
          : Array.from({ length: 16 }, (_, i) => '<option value="' + (i + 1) + '" ' + (st.no === String(i + 1) ? 'selected' : '') + '>Pertemuan ' + (i + 1) + '</option>').join('')) + '</select></div>' +
      '<div class="field"><label>Jenis File</label><select class="inp" id="arJenis">' + JENIS_FILE.map((j) => '<option value="' + j[0] + '" ' + (st.jenis === j[0] ? 'selected' : '') + '>' + j[1] + '</option>').join('') + '</select></div></div>' +
      '<div class="row between wrap"><div class="arsip-kpi" id="arKat"></div><div class="row gap6"><span class="small muted">Urutkan</span><select class="inp" id="arUrut" style="height:38px;width:auto;padding-top:0;padding-bottom:0"><option value="baru">Terbaru</option><option value="sesi">Pertemuan</option><option value="judul">Judul A–Z</option></select><button class="btn ghost sm" data-reset>' + ic('rotate-ccw') + 'Reset</button></div></div></div>' +
      '<div class="mt16" id="arList"></div>';
    $('#arUrut', el).value = st.urut;
    const list = () => {
      const q = st.q.trim().toLowerCase();
      const base = all.filter((x) => (!st.mk || x.mk_id === st.mk) && (st.no === '' || String(x.nomor) === st.no) && (!st.jenis || x.jenis === st.jenis) && (!q || x.cari.indexOf(q) > -1));
      $('#arKat', el).innerHTML = [''].concat(KAT).map((k) => { const n = k ? base.filter((x) => x.kat === k).length : base.length; return '<button data-kat="' + k + '" class="' + (st.kat === k ? 'on' : '') + '">' + (k || 'Semua') + '<b>' + n + '</b></button>'; }).join('');
      $$('[data-kat]', el).forEach((b) => (b.onclick = () => { st.kat = b.dataset.kat; st.n = 24; list(); }));
      let rows = base.filter((x) => !st.kat || x.kat === st.kat);
      rows.sort(st.urut === 'judul' ? (a, b) => String(a.judul).localeCompare(String(b.judul)) : st.urut === 'sesi' ? (a, b) => String(a.mk.kode || '').localeCompare(String(b.mk.kode || '')) || a.nomor - b.nomor : (a, b) => String(b.tgl || '').localeCompare(String(a.tgl || '')));
      const tampil = rows.slice(0, st.n);
      $('#arList', el).innerHTML = rows.length ? '<div class="file-grid">' + tampil.map((x) => {
        const k = fileKind(x.nama, x.embed ? 'video/youtube' : x.mime), yt = x.embed ? (String(x.embed).match(/embed\/([A-Za-z0-9_-]{11})/) || [])[1] : '';
        const chip = { Makalah: 'blue', Slide: 'amber', Referensi: 'green', 'E-book': 'violet', Video: 'red', Notulen: '' }[x.kat];
        return '<div class="file-card" data-ar="' + x.id + '" title="Buka ' + esc(x.judul) + '"><div class="thumb" ' + (yt ? 'style="background-image:url(https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg)"' : '') + '>' + (yt ? '<span class="play">' + ic('play') + '</span>' : '<span class="file-ic ' + (x.fileId ? k.k : '') + '" style="width:56px;height:56px">' + ic(x.fileId ? (x.kat === 'E-book' ? 'book-marked' : k.ic) : 'notebook-pen') + '</span>') + '</div>' +
          '<div style="min-width:0"><b class="semi" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + sorot(x.judul, st.q.trim()) + '</b><div class="small muted ellipsis">' + sorot(x.ket, st.q.trim()) + '</div></div>' +
          '<div class="meta"><span>' + esc(x.mk.kode || '—') + '</span><span>' + (x.nomor ? 'Sesi ' + x.nomor : 'Umum') + '</span><span>' + esc(x.oleh) + '</span><span>' + fmtRel(x.tgl) + '</span></div>' +
          '<div class="row between small"><span class="chip ' + chip + '">' + esc(x.kat) + '</span><span class="row gap4"><span class="muted">' + fmtSize(x.ukuran) + '</span>' + (x.fileId ? '<button class="btn icon sm ghost" data-dl="' + esc(x.fileId) + '" data-nm="' + esc(x.nama) + '" title="Unduh">' + ic('download') + '</button>' : '') + '</span></div></div>';
      }).join('') + '</div>' + (rows.length > st.n ? '<div class="row mt16" style="justify-content:center"><button class="btn ghost" data-more>' + ic('chevron-down') + 'Tampilkan lebih banyak (' + (rows.length - st.n) + ' lagi)</button></div>' : '')
        : '<div class="card empty">' + ic('search-x') + '<br>Tidak ada materi yang cocok dengan filter.</div>';
      $$('[data-ar]', el).forEach((c) => (c.onclick = (e) => { if (e.target.closest('button')) return; const x = all.find((y) => y.id === c.dataset.ar); if (x) bukaArsip(x); }));
      $$('#arList [data-dl]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); downloadFile(b.dataset.dl, b.dataset.nm, b); }));
      const more = $('[data-more]', el); if (more) more.onclick = () => { st.n += 24; list(); };
    };
    $('#arQ', el).oninput = K.debounce((e) => { st.q = e.target.value; st.n = 24; list(); }, 150);
    $('#arMk', el).onchange = (e) => { st.mk = e.target.value; st.no = ''; st.n = 24; renderArsip(el); };
    $('#arNo', el).onchange = (e) => { st.no = e.target.value; st.n = 24; list(); };
    $('#arJenis', el).onchange = (e) => { st.jenis = e.target.value; st.n = 24; list(); };
    $('#arUrut', el).onchange = (e) => { st.urut = e.target.value; list(); };
    $('[data-reset]', el).onclick = () => { el._st = null; renderArsip(el); };
    list();
  }
  K.registerPage('arsip', { title: 'Arsip Materi', show: renderArsip });

  // ============================================================== v1.2 — ANGGOTA & DOSEN (direktori profil)
  function renderDirektori(el, param) {
    const st = el._st || (el._st = { tab: 'mhs', q: '', jenis: '' });
    if (param && param !== st._p) { st._p = param; if (/^DSN/i.test(param)) st.tab = 'dsn'; setTimeout(() => K.bukaProfil((/^DSN/i.test(param) ? 'dsn:' : 'mhs:') + param), 30); }
    const mhs = D.mhsList(), dsn = S.boot.g.dosen.filter((d) => d.status !== 'Nonaktif').slice().sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
    el.innerHTML = '<div class="page-h"><div><h1>Anggota &amp; Dosen</h1><div class="sub">Klik foto atau kartu untuk melihat profil, lalu hubungi lewat WhatsApp atau Email.</div></div></div>' +
      '<div class="row between wrap mb12"><div class="tabs" style="margin:0"><button class="tab ' + (st.tab === 'mhs' ? 'active' : '') + '" data-tab="mhs">' + ic('users') + 'Anggota Kelas <span class="n">' + mhs.length + '</span></button><button class="tab ' + (st.tab === 'dsn' ? 'active' : '') + '" data-tab="dsn">' + ic('user-round') + 'Dosen <span class="n">' + dsn.length + '</span></button></div>' +
      '<div class="row gap6 wrap">' + (st.tab === 'mhs' ? '<div class="seg" id="dirJ"><button data-j="" class="' + (!st.jenis ? 'on' : '') + '">Semua</button><button data-j="P2K" class="' + (st.jenis === 'P2K' ? 'on' : '') + '">P2K</button><button data-j="Reguler" class="' + (st.jenis === 'Reguler' ? 'on' : '') + '">Reguler</button></div>' : '') +
      '<div class="searchbox" style="max-width:280px">' + ic('search') + '<input id="dirQ" placeholder="Cari nama, NIM, bidang…" value="' + esc(st.q) + '"></div></div></div><div id="dirList"></div>';
    const list = () => {
      const q = st.q.trim().toLowerCase();
      const items = st.tab === 'mhs'
        ? mhs.filter((m) => (!st.jenis || m.jenis_mahasiswa === st.jenis) && (!q || (m.nama_lengkap + ' ' + (m.nim || '') + ' ' + (m.konsentrasi || '')).toLowerCase().indexOf(q) > -1))
          .map((m) => ({ ref: 'mhs:' + m.mhs_id, av: K.avatar(m.nama_lengkap, 'lg', Foto.of(m.mhs_id)), nama: m.nama_lengkap, sub: m.nim ? 'NIM ' + m.nim : (m.konsentrasi || ''), chip: chipJenis(m.jenis_mahasiswa), hp: m.no_hp, email: m.email }))
        : dsn.filter((d) => !q || (d.nama + ' ' + (d.bidang || '')).toLowerCase().indexOf(q) > -1)
          .map((d) => ({ ref: 'dsn:' + d.dosen_id, av: K.avatar(d.nama, 'lg', Foto.of(d.dosen_id)), nama: d.nama, sub: d.bidang || 'Dosen pengampu', chip: '<span class="chip violet">' + S.boot.g.mk.filter((m) => m.dosen_id === d.dosen_id && m.status_aktif !== 'TIDAK').length + ' MK</span>', hp: d.no_hp, email: d.email }));
      $('#dirList', el).innerHTML = items.length ? '<div class="dir-grid">' + items.map((x) => '<div class="dir-card" data-prof="' + esc(x.ref) + '">' + x.av + '<b>' + esc(x.nama) + '</b><span class="small muted ellipsis" style="max-width:100%">' + esc(x.sub) + '</span>' + x.chip +
        '<span class="acts">' + (K.waLink(x.hp) ? '<a class="btn icon sm ghost" href="' + esc(K.waLink(x.hp)) + '" target="_blank" rel="noopener" title="WhatsApp" data-stop>' + ic('message-circle') + '</a>' : '') + (x.email ? '<a class="btn icon sm ghost" href="mailto:' + esc(x.email) + '" title="Email" data-stop>' + ic('mail') + '</a>' : '') + '</span></div>').join('') + '</div>'
        : '<div class="card empty">' + ic('search-x') + '<br>Tidak ditemukan.</div>';
      $$('[data-stop]', el).forEach((a) => a.addEventListener('click', (e) => e.stopPropagation(), true));
    };
    $$('[data-tab]', el).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; renderDirektori(el); }));
    $$('#dirJ [data-j]', el).forEach((b) => (b.onclick = () => { st.jenis = b.dataset.j; renderDirektori(el); }));
    $('#dirQ', el).oninput = K.debounce((e) => { st.q = e.target.value; list(); }, 150);
    list();
  }
  K.registerPage('direktori', { title: 'Anggota & Dosen', show: renderDirektori });

  // ekspor untuk modul admin & core
  Object.assign(K, { openAnn, annForm, penugasanForm, uploadForm, notulenForm, referensiForm, kpi, upsertLocal, petugasNames, bebanMap, ptmStatus, dropzoneHtml, bindDropzone, setProg, kanalChips, rekapMahasiswa, viewSub,
    ptmForm, jadwalkanForm, jadwalkan, hitungJadwal, saranSesi1, temaImportForm, unduhTemplateTema, hariOf });
})();
