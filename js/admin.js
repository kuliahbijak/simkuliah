/**
 * ============================================================================
 *  SIM KULIAH — admin.js (dimuat lazy hanya untuk Operator & Ketua Kelas)
 *  Master Data (verifikasi, mahasiswa + impor, MK, semester, dosen, jadwal)
 *  Detail Mahasiswa • Role User • Pengaturan (umum, sistem, migrasi, audit)
 *  Notifikasi & WA (blast per gelombang, antrean, konfigurasi) • CRM Kontak
 * ============================================================================
 */
(function () {
  'use strict';
  const K = window.SIMK;
  const { S, D, $, $$, esc, ic, api, mutate, modal, confirmDlg, toast, busy, formData, radioCards, fmtTgl, fmtWaktu, fmtRel, avatar, chipJenis, statusChip, pct, ymd, table, Store, userKey, hp08, hpValid, emailValid, normKey } = K;
  const ROLE_OPT = (sel, opOk) => ['ANGGOTA', 'KETUA'].concat(opOk ? ['OPERATOR'] : []).map((r) => '<option value="' + r + '" ' + (r === sel ? 'selected' : '') + '>' + K.ROLE_LABEL[r] + '</option>').join('');
  const TARGET_OPT = ['', 'Semester 3 (Akselerasi)', 'Semester 4 (Tepat Waktu)', 'Semester 5', 'Semester 6', 'Semester 7+'];
  const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  function saveCsv(nama, rows) {
    if (!rows.length) return toast('Tidak ada data.', 'warn');
    const h = Object.keys(rows[0]);
    K.saveBlob(new Blob(['﻿' + [h.map(csvCell).join(',')].concat(rows.map((r) => h.map((k) => csvCell(r[k])).join(','))).join('\n')], { type: 'text/csv;charset=utf-8' }), nama + '.csv');
  }
  /** SWR kecil untuk data admin yang tidak ada di bootstrap. */
  async function loadSwr(key, action, data, render, fresh) {
    const c = Store.get(userKey('a:' + key), null);
    if (c) render(c.data, true);
    if (c && Date.now() - c.t < (fresh || 30000)) return c.data;
    const r = await api(action, data || {});
    if (r.success) { const h = JSON.stringify(r.data); if (!c || JSON.stringify(c.data) !== h) render(r.data, false); Store.set(userKey('a:' + key), { t: Date.now(), data: r.data }); return r.data; }
    if (!c) render(null, false, r.message);
    else toast(r.message, 'error');
    return null;
  }
  function tabsHtml(tabs, cur) { return '<div class="tabs">' + tabs.map((x) => '<button class="tab ' + (cur === x[0] ? 'active' : '') + '" data-tab="' + x[0] + '">' + (x[2] ? ic(x[2]) : '') + esc(x[1]) + (x[3] != null ? ' <span class="n">' + x[3] + '</span>' : '') + '</button>').join('') + '</div>'; }

  // ============================================================== MASTER DATA
  function renderMaster(el, param) {
    const a = S.boot.a, g = S.boot.g;
    const st = el._st || (el._st = { tab: 'verif' });
    if (param && param !== st._p) { st._p = param; if (['verif', 'mhs', 'mk', 'smt', 'dosen', 'jadwal'].indexOf(param) > -1) st.tab = param; }
    const pend = D.pendingRegs(), mhs = a.mahasiswa.filter((m) => m.status !== 'Nonaktif'), jf = D.jenisFilter();
    if (!pend.length && st.tab === 'verif' && !param) st.tab = 'mhs';
    el.innerHTML = '<div class="crumb">MASTER DATA · MANAJEMEN PENGGUNA · <b>' + esc(D.smtAktif().nama_semester || '') + '</b></div>' +
      '<div class="page-h"><div><h1>Master Data &amp; Verifikasi Pendaftaran</h1><div class="sub">Kelola direktori mahasiswa, dosen pengampu, mata kuliah, semester, jadwal, dan antrean registrasi akun Google.</div></div>' +
      '<div class="row wrap"><button class="btn ghost" data-import>' + ic('upload') + 'Import CSV/Excel</button><button class="btn ghost" data-export>' + ic('download') + 'Export (.xlsx)</button><button class="btn" data-add-mhs>' + ic('user-plus') + 'Tambah Mahasiswa</button></div></div>' +
      '<div class="grid g4 keep2">' +
      kpiC('Total Mahasiswa Aktif', mhs.length, '<span class="chip p2k">P2K: ' + mhs.filter((x) => x.jenis_mahasiswa === 'P2K').length + '</span> <span class="chip reg">Reguler: ' + mhs.filter((x) => x.jenis_mahasiswa === 'Reguler').length + '</span>', 'users', '', 'mhs') +
      kpiC('Menunggu Verifikasi', pend.length, pend.length ? '<span class="chip amber">Perlu Aksi</span>' : '<span class="chip green">Bersih</span>', 'user-check', 'amber', 'verif') +
      kpiC('Dosen Pengampu', a.dosen.filter((x) => x.status !== 'Nonaktif').length, '<span class="small muted">' + D.mkAktif().length + ' mata kuliah aktif</span>', 'user-cog', '', 'dosen') +
      kpiC('Akun Aktif', a.users.filter((u) => u.status_akun === 'Aktif').length, '<span class="small muted">login Google OAuth</span>', 'shield-check', 'green', D.isOp() ? 'roles' : 'mhs') + '</div>' +
      '<div class="mt20">' + tabsHtml([['verif', 'Verifikasi Pendaftaran', 'shield-check', pend.length], ['mhs', 'Daftar Mahasiswa', 'users', a.mahasiswa.length], ['mk', 'Mata Kuliah & SKS', 'book-open', g.mk.length], ['smt', 'Semester', 'calendar-days', g.semester.length], ['dosen', 'Dosen Pengampu', 'user-cog', a.dosen.length], ['jadwal', 'Jadwal', 'clock', g.jadwal.length]], st.tab) + '</div><div class="card" id="msBody"></div>';
    $$('[data-tab]', el).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; renderMaster(el); }));
    $$('[data-kpi]', el).forEach((b) => (b.onclick = () => { if (b.dataset.kpi === 'roles') return K.go('roles'); st.tab = b.dataset.kpi; renderMaster(el); }));
    $('[data-import]', el).onclick = () => importModal();
    $('[data-add-mhs]', el).onclick = () => mhsForm();
    $('[data-export]', el).onclick = () => K.exportXlsx('Master Data SIM KULIAH', {
      Mahasiswa: a.mahasiswa.map((m) => ({ NIM: m.nim, Nama: m.nama_lengkap, Email: m.email, 'No HP': m.no_hp, Jenis: m.jenis_mahasiswa, Angkatan: m.angkatan, Konsentrasi: m.konsentrasi, Instansi: m.instansi, 'Target Lulus': m.target_lulus_semester, 'Status Target': m.status_target, Status: m.status })),
      Dosen: a.dosen.map((d) => ({ Nama: d.nama, Email: d.email, 'No HP': d.no_hp, Bidang: d.bidang, Status: d.status })),
      'Mata Kuliah': g.mk.map((m) => ({ Kode: m.kode, Nama: m.nama, SKS: m.sks, Semester: (S.idx.smt[m.semester_id] || {}).nama_semester, Dosen: (S.idx.dosen[m.dosen_id] || {}).nama, Aktif: m.status_aktif })),
      Jadwal: g.jadwal.map((j) => ({ 'Mata Kuliah': (S.idx.mk[j.mk_id] || {}).nama, Hari: j.hari, Mulai: j.jam_mulai, Selesai: j.jam_selesai, Ruang: j.ruang, Kelas: j.jenis_kelas }))
    }).catch((e) => toast(e.message, 'error'));
    const body = $('#msBody', el);
    ({ verif: tabVerif, mhs: tabMhs, mk: tabMk, smt: tabSmt, dosen: tabDosen, jadwal: tabJadwal })[st.tab](body, jf);
  }
  function kpiC(lbl, val, sub, icn, cls, go) { return '<div class="card kpi kpi-click" data-kpi="' + go + '"><div style="min-width:0"><div class="lbl">' + esc(lbl) + '</div><div class="stat mt8">' + val + '</div><div class="mt8">' + sub + '</div></div><span class="ic ' + (cls || '') + '">' + ic(icn) + '</span></div>'; }

  function tabVerif(body) {
    const rows = D.pendingRegs();
    body.innerHTML = '<div class="card-h"><div class="row">' + '<span class="kpi"><span class="ic amber">' + ic('user-check') + '</span></span><div><h3>Antrean Verifikasi Pendaftaran Baru</h3><div class="sub">Pendaftar yang masuk melalui Google OAuth dan menunggu otorisasi kelas.</div></div></div><span class="chip amber">Otoritas: Operator / Ketua Kelas</span></div>' +
      '<div class="alert info mb12">' + ic('info') + '<span><b>Petunjuk:</b> tentukan Jenis Mahasiswa (P2K/Reguler) dan Peran akun sebelum menyetujui. Pendaftar otomatis menerima email/WA pemberitahuan & akses folder materi.</span></div><div id="vt"></div>';
    table($('#vt', body), {
      rows, per: 20, empty: 'Tidak ada pendaftar yang menunggu verifikasi.',
      cols: [
        { k: 'nama', t: 'Mahasiswa & Akun Google', sortVal: (r) => r.nama_lengkap, render: (r) => '<div class="person">' + avatar(r.nama_lengkap) + '<div class="t"><b>' + esc(r.nama_lengkap) + '</b><span>' + ic('circle-check') + ' ' + esc(r.email) + '</span></div></div>' },
        { k: 'hp', t: 'WhatsApp', render: (r) => '<span class="mono">' + esc(r.no_hp) + '</span>' },
        { k: 'tgl', t: 'Waktu Daftar', sortVal: (r) => r.tanggal_daftar, render: (r) => esc(fmtWaktu(r.tanggal_daftar)) + '<div class="xs muted">' + fmtRel(r.tanggal_daftar) + '</div>' },
        { k: 'jenis', t: 'Jenis Mahasiswa', sort: false, render: (r) => '<select class="inp" data-j="' + r.user_id + '" style="min-width:140px"><option value="P2K" ' + (r.jenis_mahasiswa === 'P2K' ? 'selected' : '') + '>P2K (Karyawan)</option><option value="Reguler" ' + (r.jenis_mahasiswa === 'Reguler' ? 'selected' : '') + '>Reguler</option></select>' },
        { k: 'role', t: 'Peran Akun', sort: false, render: (r) => '<select class="inp" data-r="' + r.user_id + '" style="min-width:150px">' + ROLE_OPT('ANGGOTA', D.isOp()) + '</select>' },
        { k: 'st', t: 'Status', sort: false, render: () => statusChip('Menunggu') },
        { k: 'aksi', t: 'Tindakan', sort: false, render: (r) => '<div class="row gap6"><button class="btn sm green" data-ok="' + r.user_id + '">' + ic('check') + 'Setujui</button><button class="btn icon sm danger" title="Tolak" data-no="' + r.user_id + '">' + ic('x') + '</button></div>' }
      ],
      after: (tb) => {
        $$('[data-ok]', tb).forEach((b) => (b.onclick = async () => {
          const id = b.dataset.ok, u = S.boot.a.users.find((x) => x.user_id === id), prev = u.status_akun;
          const data = { user_id: id, setuju: true, jenis_mahasiswa: $('[data-j="' + id + '"]', tb).value, role: $('[data-r="' + id + '"]', tb).value };
          mutate('reg.verify', data, { optimistic: () => Object.assign(u, { status_akun: 'Aktif', role: data.role, jenis_mahasiswa: data.jenis_mahasiswa }), rollback: () => (u.status_akun = prev) });
        }));
        $$('[data-no]', tb).forEach((b) => (b.onclick = () => {
          const id = b.dataset.no, u = S.boot.a.users.find((x) => x.user_id === id);
          const m = modal({ title: 'Tolak Pendaftaran', sub: esc(u.nama_lengkap + ' · ' + u.email), icon: 'ban', size: 'sm', body: '<div class="field"><label>Alasan (dikirim ke pendaftar)</label><textarea class="inp" name="alasan" rows="3" placeholder="mis. Bukan mahasiswa kelas ini"></textarea></div>', foot: '<button class="btn ghost" data-close>Batal</button><button class="btn danger solid" data-go>Tolak</button>' });
          $('[data-go]', m.el).onclick = async () => { const al = $('[name=alasan]', m.el).value; m.close(); await mutate('reg.verify', { user_id: id, setuju: false, alasan: al }, { optimistic: () => (u.status_akun = 'Ditolak'), rollback: () => (u.status_akun = 'Menunggu') }); };
        }));
      }
    });
  }

  function tabMhs(body, jf) {
    const st = body._m || (body._m = { j: jf || '', s: 'Aktif' });
    const all = S.boot.a.mahasiswa;
    const rows = all.filter((m) => (!st.j || m.jenis_mahasiswa === st.j) && (!st.s || (st.s === 'Aktif' ? m.status !== 'Nonaktif' : m.status === st.s)));
    body.innerHTML = '<div class="card-h"><div><h3>Direktori Mahasiswa <span class="small muted">(Terdaftar ' + all.length + ' Mahasiswa)</span></h3><div class="sub">Basis data mahasiswa untuk pemantauan status studi, penugasan, dan target.</div></div></div><div id="mt"></div>';
    table($('#mt', body), {
      rows, per: 15, placeholder: 'Cari nama, NIM, atau email…', search: (m) => [m.nama_lengkap, m.nim, m.email, m.no_hp].join(' '),
      tools: '<div class="seg" data-seg>' + [['', 'Semua (' + all.length + ')'], ['P2K', 'P2K (' + all.filter((x) => x.jenis_mahasiswa === 'P2K').length + ')'], ['Reguler', 'Reguler (' + all.filter((x) => x.jenis_mahasiswa === 'Reguler').length + ')']].map((x) => '<button data-j="' + x[0] + '" class="' + (st.j === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div><select class="top-sel" data-s><option value="">Semua Status</option>' + ['Aktif', 'Cuti', 'Lulus', 'Nonaktif'].map((x) => '<option ' + (st.s === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select>',
      onTools: (tl) => {
        $$('[data-seg] button', tl).forEach((b) => (b.onclick = () => { st.j = b.dataset.j; body.innerHTML = ''; tabMhs(body); }));
        $('[data-s]', tl).onchange = (e) => { st.s = e.target.value; body.innerHTML = ''; tabMhs(body); };
      },
      cols: [
        { k: 'nama', t: 'NIM & Profil Mahasiswa', sortVal: (m) => m.nama_lengkap, render: (m) => '<div class="person">' + avatar(m.nama_lengkap, 'sm') + '<div class="t"><b>' + esc(m.nama_lengkap) + '</b><span class="mono">NIM: ' + esc(m.nim || '—') + '</span></div></div>' },
        { k: 'email', t: 'Email Akademik', render: (m) => '<span class="small">' + esc(m.email) + '</span>' },
        { k: 'jenis_mahasiswa', t: 'Program / Jalur', render: (m) => chipJenis(m.jenis_mahasiswa) },
        { k: 'angkatan', t: 'Angkatan', render: (m) => esc(m.angkatan || '—') },
        { k: 'target_lulus_semester', t: 'Rencana Target Lulus', render: (m) => (m.status_target === 'Berisiko' ? '<span class="chip amber">' + ic('triangle-alert') + esc(m.target_lulus_semester || 'Berisiko') + '</span>' : esc(m.target_lulus_semester || '—')) },
        { k: 'status', t: 'Status Studi', render: (m) => statusChip(m.status || 'Aktif') },
        { k: 'aksi', t: 'Aksi', sort: false, render: (m) => '<div class="row gap4"><a class="btn icon sm ghost" href="#/mahasiswa/' + m.mhs_id + '" title="Detail">' + ic('eye') + '</a><button class="btn icon sm ghost" title="Ubah" data-ed="' + m.mhs_id + '">' + ic('pencil') + '</button>' + (m.status !== 'Nonaktif' ? '<button class="btn icon sm ghost" title="Nonaktifkan" data-off="' + m.mhs_id + '">' + ic('ban') + '</button>' : '') + '</div>' }
      ],
      rowCls: (m) => (m.status === 'Nonaktif' ? 'dim' : m.status_target === 'Berisiko' ? 'warn' : ''),
      after: (tb) => {
        $$('[data-ed]', tb).forEach((b) => (b.onclick = () => mhsForm(S.boot.a.mahasiswa.find((x) => x.mhs_id === b.dataset.ed))));
        $$('[data-off]', tb).forEach((b) => (b.onclick = () => nonaktif('Mahasiswa', S.boot.a.mahasiswa.find((x) => x.mhs_id === b.dataset.off))));
      }
    });
  }
  async function nonaktif(sheet, row) {
    const key = { Mahasiswa: 'mhs_id', Dosen: 'dosen_id', MataKuliah: 'mk_id', Jadwal: 'jadwal_id', Semester: 'semester_id' }[sheet];
    const nama = row.nama_lengkap || row.nama || row.nama_semester || (S.idx.mk[row.mk_id] || {}).nama || row[key];
    const hard = sheet === 'Jadwal' || sheet === 'Semester';
    if (!(await confirmDlg(hard ? 'Hapus data?' : 'Nonaktifkan data?', '<b>' + esc(nama) + '</b> akan ' + (hard ? 'dihapus' : 'dinonaktifkan (soft delete — data tetap tersimpan)') + (sheet === 'Mahasiswa' ? ' dan akun login-nya diblokir.' : '.'), { danger: true, ok: hard ? 'Hapus' : 'Nonaktifkan' }))) return;
    const prev = Object.assign({}, row);
    mutate('master.delete', { sheet, id: row[key] }, {
      optimistic: () => { if (sheet === 'Mahasiswa') row.status = 'Nonaktif'; else if (sheet === 'Dosen') row.status = 'Nonaktif'; else if (sheet === 'MataKuliah') row.status_aktif = 'TIDAK'; },
      rollback: () => Object.assign(row, prev)
    });
  }
  function mhsForm(m) {
    const isNew = !m || !m.mhs_id; m = m || {};
    const md = modal({
      title: isNew ? 'Tambah Mahasiswa' : 'Perbarui Profil Mahasiswa', sub: isNew ? 'Data mahasiswa + akun login Google (opsional)' : esc(m.nama_lengkap + ' · ' + (m.nim || '')), icon: 'user-plus', size: 'lg',
      body: '<div class="sec-t" style="margin-top:0">● Informasi Identitas &amp; Kontak</div><div class="form-grid">' +
        '<div class="field"><label>Nama Lengkap &amp; Gelar <span class="req">*</span></label><input class="inp" name="nama_lengkap" value="' + esc(m.nama_lengkap || '') + '"><span class="hint">Gunakan nama resmi sesuai ijazah S1</span></div>' +
        '<div class="field"><label>Nomor Induk Mahasiswa (NIM)</label><input class="inp" name="nim" inputmode="numeric" value="' + esc(m.nim || '') + '"><span class="hint">Unik per mahasiswa</span></div>' +
        '<div class="field"><label>Email Akun Google <span class="req">*</span></label><input class="inp" type="email" name="email" value="' + esc(m.email || '') + '"><span class="hint">Dipakai untuk login & akses Google Drive</span></div>' +
        '<div class="field"><label>No. WhatsApp Aktif</label><div class="inp-group"><span class="pre">+62</span><input name="no_hp" inputmode="tel" value="' + esc(String(m.no_hp || '').replace(/^0/, '')) + '"></div><span class="hint">Untuk reminder H-7, H-3, H-1</span></div></div>' +
        '<div class="sec-t">● Klasifikasi Program &amp; Wewenang</div><div class="radio-cards"><label class="radio-card ' + (m.jenis_mahasiswa !== 'Reguler' ? 'on' : '') + '"><input type="radio" name="jenis_mahasiswa" value="P2K" ' + (m.jenis_mahasiswa !== 'Reguler' ? 'checked' : '') + '><div><b>P2K (Kelas Karyawan) <span class="chip blue">Weekend</span></b><span>Jadwal fleksibel Jumat malam, Sabtu, dan Minggu.</span></div></label>' +
        '<label class="radio-card ' + (m.jenis_mahasiswa === 'Reguler' ? 'on' : '') + '"><input type="radio" name="jenis_mahasiswa" value="Reguler" ' + (m.jenis_mahasiswa === 'Reguler' ? 'checked' : '') + '><div><b>Reguler (Full-time) <span class="chip green">Weekday</span></b><span>Kuliah tatap muka Senin s.d. Kamis.</span></div></label></div>' +
        '<div class="form-grid mt16"><div class="field"><label>Angkatan</label><input class="inp" name="angkatan" value="' + esc(m.angkatan || S.boot.g.settings.ANGKATAN_LABEL || '') + '"></div>' +
        '<div class="field"><label>Target Kelulusan</label><select class="inp" name="target_lulus_semester">' + TARGET_OPT.map((x) => '<option value="' + x + '" ' + (x === (m.target_lulus_semester || '') ? 'selected' : '') + '>' + (x || '—') + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Konsentrasi</label><input class="inp" name="konsentrasi" value="' + esc(m.konsentrasi || '') + '"></div><div class="field"><label>Instansi / Unit Kerja</label><input class="inp" name="instansi" value="' + esc(m.instansi || '') + '"></div>' +
        '<div class="field"><label>Status Studi</label><select class="inp" name="status">' + ['Aktif', 'Cuti', 'Lulus', 'Nonaktif'].map((x) => '<option ' + (x === (m.status || 'Aktif') ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        (isNew ? '<label class="check" style="align-self:end"><input type="checkbox" name="buatAkun" checked>Buat akun login (Anggota) & beri akses Drive</label>' : '') + '</div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>' + ic('check') + (isNew ? 'Simpan Mahasiswa' : 'Simpan Perubahan') + '</button>'
    });
    radioCards(md.el);
    $('[data-save]', md.el).onclick = () => {
      const fd = formData(md.el);
      if (!fd.nama_lengkap.trim()) return toast('Nama wajib diisi.', 'error');
      if (!emailValid(fd.email)) return toast('Email tidak valid.', 'error');
      if (fd.no_hp && !hpValid(fd.no_hp)) return toast('Nomor WA tidak valid.', 'error');
      const row = { mhs_id: m.mhs_id || '', nama_lengkap: fd.nama_lengkap, nim: fd.nim, email: fd.email.trim().toLowerCase(), no_hp: fd.no_hp ? hp08(fd.no_hp) : '', jenis_mahasiswa: fd.jenis_mahasiswa, angkatan: fd.angkatan, target_lulus_semester: fd.target_lulus_semester, konsentrasi: fd.konsentrasi, instansi: fd.instansi, status: fd.status };
      const dup = S.boot.a.mahasiswa.find((x) => x.mhs_id !== row.mhs_id && ((row.email && String(x.email).toLowerCase() === row.email) || (row.nim && x.nim && String(x.nim) === String(row.nim))));
      if (dup) return toast('Email/NIM sudah dipakai oleh ' + dup.nama_lengkap + '.', 'error');
      K.saveLocal({ action: 'master.save', data: { sheet: 'Mahasiswa', row, buatAkun: !!fd.buatAkun }, list: () => S.boot.a.mahasiswa, key: 'mhs_id', modal: md, reopen: (d) => mhsForm(d),
        row: Object.assign({}, m, row, { status: row.status || 'Aktif' }) });
    };
  }

  // ---------- Impor mahasiswa (CSV/Excel) dengan validasi pratinjau
  const IMPORT_MAP = {
    nama_lengkap: ['nama', 'namalengkap', 'namalengkapgelar', 'namamahasiswa', 'name'], email: ['email', 'emailgoogle', 'emailgoogleworkspace', 'emailakademik', 'gmail'],
    no_hp: ['nohp', 'hp', 'wa', 'nowa', 'whatsapp', 'nomorwhatsapp', 'nomorhp', 'telepon'], nim: ['nim', 'npm', 'nomorinduk'],
    jenis_mahasiswa: ['jenis', 'jenismahasiswa', 'jalur', 'jalurkuliah', 'program', 'kelas'], role: ['role', 'peran', 'perankelas'], angkatan: ['angkatan'],
    konsentrasi: ['konsentrasi'], instansi: ['instansi', 'unitkerja', 'instansiunitkerja'], target_lulus_semester: ['targetlulus', 'targetlulussemester', 'targetkelulusan']
  };
  function mapImportRow(raw) {
    const o = {}, keys = Object.keys(raw);
    Object.keys(IMPORT_MAP).forEach((c) => { const k = keys.find((x) => IMPORT_MAP[c].indexOf(normKey(x)) > -1); o[c] = k ? String(raw[k]).trim() : ''; });
    return o;
  }
  function jenisNorm(v) { const s = String(v || '').toLowerCase(); return /p2k|karyawan|eksekutif|weekend/.test(s) ? 'P2K' : (/reg|full/.test(s) ? 'Reguler' : ''); }
  function validasiImpor(rows) {
    const seen = {}, nimAda = {}, emailAda = {};
    S.boot.a.mahasiswa.forEach((m) => { if (m.nim) nimAda[m.nim] = m.email; emailAda[m.email] = 1; });
    return rows.map((r, i) => {
      const x = mapImportRow(r), w = [], err = [];
      x.email = x.email.toLowerCase(); x.jenis_mahasiswa = jenisNorm(x.jenis_mahasiswa);
      if (!x.nama_lengkap) err.push('Nama kosong');
      if (!emailValid(x.email)) err.push('Email tidak valid'); else if (seen[x.email]) err.push('Email ganda di berkas');
      if (!x.jenis_mahasiswa) err.push('Jenis harus P2K/Reguler');
      if (x.no_hp) { const h = hp08(x.no_hp); if (!hpValid(h)) err.push('Nomor HP tidak valid'); else if (h !== x.no_hp.replace(/[^0-9]/g, '')) { w.push('Format HP dirapikan → ' + h); } x.no_hp = h; }
      if (x.nim && nimAda[x.nim] && nimAda[x.nim] !== x.email) err.push('NIM duplikat di master');
      if (emailAda[x.email]) w.push('Sudah ada → diperbarui');
      seen[x.email] = 1;
      return { no: i + 1, x, err, w, st: err.length ? 'Galat' : (w.length ? 'Peringatan' : 'Valid') };
    });
  }
  function importModal() {
    let parsed = [], fname = '', filt = 'all';
    const md = modal({
      title: 'Import Mahasiswa Baru (Massal)', icon: 'cloud-upload', size: 'xl', sub: 'Unggah berkas spreadsheet (.csv / .xlsx) untuk mendaftarkan dan memperbarui mahasiswa kelas S2 secara otomatis.',
      body: '<div class="seg mb12"><button data-mode="manual">' + ic('user-plus') + ' Input Manual (1 Mahasiswa)</button><button class="on" data-mode="csv">' + ic('file-spreadsheet') + ' Import CSV / Excel</button></div><div id="impArea"></div>',
      foot: '<span class="small muted grow" id="impInfo" style="align-self:center"></span><button class="btn ghost" data-close>Batal</button><button class="btn" data-go disabled>' + ic('circle-check') + 'Impor Mahasiswa Valid</button>'
    });
    $('[data-mode="manual"]', md.el).onclick = () => { md.close(); mhsForm(); };
    const area = $('#impArea', md.el), goBtn = $('[data-go]', md.el);
    const drawPick = () => {
      area.innerHTML = '<div class="row between wrap mb12"><span class="small muted">Kolom yang dikenali: Nama, Email, WhatsApp/No HP, NIM, Jenis/Jalur (P2K/Reguler), Peran (Ketua Kelas), Angkatan, Konsentrasi, Instansi, Target Lulus.</span><button class="btn sm ghost" data-tpl>' + ic('download') + 'Unduh Template CSV</button></div>' +
        '<label class="dropzone" data-dz2><input type="file" accept=".csv,.xlsx,.xls" hidden>' + ic('cloud-upload') + '<div class="semi mt8">Seret berkas .csv / .xlsx ke sini atau klik untuk memilih</div><div class="small muted">Baris pertama = judul kolom</div></label>';
      $('[data-tpl]', area).onclick = () => saveCsv('Template_Import_Mahasiswa', [{ Nama: 'Ahmad Fauzi, S.E.', Email: 'a.fauzi@student.ac.id', WhatsApp: '081233449001', NIM: '2026880051', Jalur: 'P2K', Peran: 'Ketua Kelas', Angkatan: 'Angkatan 34', Konsentrasi: 'Manajemen Keuangan', Instansi: 'PT Contoh', 'Target Lulus': 'Semester 4 (Tepat Waktu)' }, { Nama: 'Citra Lestari, S.Kom.', Email: 'citra@student.ac.id', WhatsApp: '085711228902', NIM: '2026880052', Jalur: 'Reguler', Peran: 'Anggota', Angkatan: 'Angkatan 34', Konsentrasi: 'Sistem Informasi Bisnis', Instansi: '', 'Target Lulus': 'Semester 4 (Tepat Waktu)' }]);
      const dz = $('[data-dz2]', area), inp = $('input', dz);
      const handle = async (f) => {
        try { busy(goBtn, true, 'Membaca…'); const raw = await K.parseSheetFile(f); fname = f.name; parsed = validasiImpor(raw); busy(goBtn, false); if (!parsed.length) return toast('Berkas kosong.', 'error'); drawPreview(); }
        catch (e) { busy(goBtn, false); toast(e.message, 'error'); }
      };
      inp.onchange = () => inp.files[0] && handle(inp.files[0]);
      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); e.dataTransfer.files[0] && handle(e.dataTransfer.files[0]); });
    };
    const drawPreview = () => {
      const valid = parsed.filter((r) => r.st !== 'Galat'), bad = parsed.filter((r) => r.st !== 'Valid');
      const list = filt === 'valid' ? parsed.filter((r) => r.st === 'Valid') : filt === 'warn' ? bad : parsed;
      area.innerHTML = '<div class="file-row"><span class="file-ic xls">' + ic('file-spreadsheet') + '</span><div class="grow"><b class="semi">' + esc(fname) + '</b><div class="small" style="color:var(--green-ink)">' + ic('circle-check') + ' Berkas siap diproses · <a href="#" data-ganti>Ganti berkas</a></div></div></div>' +
        '<div class="alert info mt12">' + ic('info') + '<span><b>Format terverifikasi:</b> ' + parsed.length + ' baris terdeteksi. <b style="color:var(--green-ink)">' + valid.length + ' baris akan diimpor</b> dan <b style="color:var(--amber-ink)">' + bad.length + ' baris memerlukan perhatian</b> (' + parsed.filter((r) => r.st === 'Peringatan').length + ' peringatan, ' + parsed.filter((r) => r.st === 'Galat').length + ' galat).</span></div>' +
        '<div class="row wrap mt12 mb12"><span class="small semi">Filter baris:</span><div class="seg"><button data-fl="all" class="' + (filt === 'all' ? 'on' : '') + '">Tampilkan Semua ' + parsed.length + '</button><button data-fl="valid" class="' + (filt === 'valid' ? 'on' : '') + '">Hanya Valid ' + parsed.filter((r) => r.st === 'Valid').length + '</button><button data-fl="warn" class="' + (filt === 'warn' ? 'on' : '') + '">Peringatan / Galat ' + bad.length + '</button></div></div><div id="impTbl"></div>';
      table($('#impTbl', area), { rows: list, per: 50, mobileCards: true,
        cols: [{ k: 'no', t: 'No', sortVal: (r) => r.no, render: (r) => r.no },
          { k: 'st', t: 'Status', render: (r) => '<span class="chip ' + (r.st === 'Valid' ? 'green' : r.st === 'Galat' ? 'red' : 'amber') + '">' + ic(r.st === 'Valid' ? 'check' : 'triangle-alert') + r.st + '</span>' + (r.err.concat(r.w).length ? '<div class="xs" style="color:' + (r.err.length ? 'var(--red-ink)' : 'var(--amber-ink)') + '">' + esc(r.err.concat(r.w).join('; ')) + '</div>' : '') },
          { k: 'nim', t: 'NIM', render: (r) => '<span class="mono">' + esc(r.x.nim || '—') + '</span>' },
          { k: 'nama', t: 'Nama Lengkap & Gelar', render: (r) => '<b class="semi">' + esc(r.x.nama_lengkap) + '</b><div class="xs muted">' + esc(r.x.konsentrasi) + '</div>' },
          { k: 'email', t: 'Email Google', render: (r) => esc(r.x.email) },
          { k: 'hp', t: 'WhatsApp', render: (r) => '<span class="mono">' + esc(r.x.no_hp) + '</span>' },
          { k: 'j', t: 'Jalur', render: (r) => chipJenis(r.x.jenis_mahasiswa) || '<span class="chip red">?</span>' },
          { k: 'role', t: 'Peran', render: (r) => (/ketua/i.test(r.x.role) ? '<span class="chip blue">' + ic('shield-check') + 'Ketua Kelas</span>' : '<span class="muted">Anggota</span>') }],
        rowCls: (r) => (r.st === 'Galat' ? 'dim' : r.st === 'Peringatan' ? 'warn' : '') });
      $$('[data-fl]', area).forEach((b) => (b.onclick = () => { filt = b.dataset.fl; drawPreview(); }));
      $('[data-ganti]', area).onclick = (e) => { e.preventDefault(); parsed = []; drawPick(); goBtn.disabled = true; };
      goBtn.disabled = !valid.length;
      goBtn.innerHTML = ic('circle-check') + 'Impor ' + valid.length + ' Mahasiswa';
      $('#impInfo', md.el).textContent = 'Menampilkan ' + list.length + ' baris dari 1 berkas terpilih';
    };
    drawPick();
    goBtn.onclick = async () => {
      const valid = parsed.filter((r) => r.st !== 'Galat');
      busy(goBtn, true, 'Mengimpor…');
      const r = await api('mahasiswa.import', { rows: valid.map((v) => v.x), buatAkun: true }, { timeout: 180000 });
      busy(goBtn, false);
      if (!r.success) return toast(r.message, 'error');
      md.close(); K.scheduleRefresh(); K.refreshBoot(true);
      const d = r.data, lewatLokal = parsed.filter((x) => x.st === 'Galat').map((x) => ({ baris: x.no + 1, alasan: x.err.join('; ') }));
      const lewat = lewatLokal.concat(d.dilewati || []);
      const m2 = modal({ title: 'Impor Data Mahasiswa Berhasil!', icon: 'circle-check', size: 'lg', sub: 'Sinkronisasi ke Google Sheets Database dan Google Workspace telah selesai diproses.',
        body: '<div class="grid g2"><div class="tile row" style="background:var(--green-soft)"><span class="kpi"><span class="ic green">' + ic('user-check') + '</span></span><div><b style="font-size:18px">' + d.ditambah + ' Mahasiswa baru</b><div class="small" style="color:var(--green-ink)">' + d.diperbarui + ' diperbarui · ' + d.akunBaru + ' akun login dibuat</div></div></div>' +
          '<div class="tile row" style="background:var(--primary-soft)"><span class="kpi"><span class="ic">' + ic('users') + '</span></span><div><b style="font-size:18px">Klasifikasi Program</b><div class="small"><span style="color:var(--primary-ink)">' + d.p2k + ' P2K</span> · <span style="color:var(--green-ink)">' + d.reguler + ' Reguler</span></div></div></div></div>' +
          (lewat.length ? '<div class="alert warn mt12">' + ic('triangle-alert') + '<div class="grow"><b>' + lewat.length + ' baris dilewati</b> <span class="chip amber">Perlu Review</span><div class="small mt8">' + esc(lewat.slice(0, 3).map((x) => 'Baris ' + x.baris + ': ' + x.alasan).join(' · ')) + (lewat.length > 3 ? ' …' : '') + '</div></div><button class="btn xs ghost" data-log>' + ic('download') + 'Unduh Log (.csv)</button></div>' : '') +
          '<div class="tile mt12"><div class="row between"><span class="xs bold muted" style="letter-spacing:.06em">OTOMASI SISTEM AKADEMIK S2</span><span class="chip green dot">3 Jalur Berjalan</span></div>' +
          '<div class="row top mt12">' + ic('circle-check') + '<div><b class="semi">Google Workspace &amp; Hak Akses</b><div class="small muted">Akun ditautkan dengan peran default Anggota Kelas (Ketua bila ditandai).</div></div></div>' +
          '<div class="row top mt12">' + ic('circle-check') + '<div><b class="semi">Email/WA Aktivasi &amp; Sambutan</b><div class="small muted">Pesan berisi panduan login dikirim bertahap lewat antrean notifikasi.</div></div></div>' +
          '<div class="row top mt12">' + ic('folder-open') + '<div><b class="semi">Google Drive</b><div class="small muted">Akses Viewer folder "Berkas Kuliah" dibagikan ke akun baru.</div></div></div></div>',
        foot: '<button class="btn ghost" data-rekap>' + ic('file-spreadsheet') + 'Unduh Rekap Impor (.xlsx)</button><button class="btn" data-close>Selesai &amp; Buka Direktori ' + ic('arrow-right') + '</button>' });
      const lg = $('[data-log]', m2.el); if (lg) lg.onclick = () => saveCsv('Log_Impor_Dilewati', lewat);
      $('[data-rekap]', m2.el).onclick = () => K.exportXlsx('Rekap Impor Mahasiswa', { Diimpor: valid.map((v) => ({ Nama: v.x.nama_lengkap, Email: v.x.email, NIM: v.x.nim, WA: v.x.no_hp, Jalur: v.x.jenis_mahasiswa, Catatan: v.w.join('; ') })), Dilewati: lewat });
    };
  }

  function tabMk(body) {
    const g = S.boot.g;
    body.innerHTML = '<div class="card-h"><div><h3>Mata Kuliah &amp; SKS</h3><div class="sub">Mata kuliah baru otomatis memiliki 16 pertemuan (UTS = 8, UAS = 16) dan folder Drive.</div></div><button class="btn sm" data-add>' + ic('plus') + 'Mata Kuliah</button></div><div id="kt"></div>';
    table($('#kt', body), { rows: g.mk, per: 20, placeholder: 'Cari kode / nama…', search: (m) => m.kode + ' ' + m.nama, sortDefault: 'kode',
      cols: [{ k: 'kode', t: 'Kode', render: (m) => '<span class="chip blue">' + esc(m.kode) + '</span>' }, { k: 'nama', t: 'Nama Mata Kuliah', render: (m) => '<a href="#/mk/' + m.mk_id + '" class="semi">' + esc(m.nama) + '</a>' }, { k: 'sks', t: 'SKS' },
        { k: 'smt', t: 'Semester', sortVal: (m) => (S.idx.smt[m.semester_id] || {}).nama_semester, render: (m) => esc((S.idx.smt[m.semester_id] || {}).nama_semester || '-') },
        { k: 'dosen', t: 'Dosen', sortVal: (m) => (S.idx.dosen[m.dosen_id] || {}).nama, render: (m) => esc((S.idx.dosen[m.dosen_id] || {}).nama || '—') },
        { k: 'jadwal', t: 'Jadwal', sort: false, render: (m) => (S.idx.jadwalByMk[m.mk_id] || []).map((j) => esc(j.hari + ' ' + j.jam_mulai)).join('<br>') || '<span class="faint">—</span>' },
        { k: 'status_aktif', t: 'Status', render: (m) => (m.status_aktif === 'TIDAK' ? statusChip('Nonaktif') : statusChip('Aktif')) },
        { k: 'aksi', t: '', sort: false, render: (m) => '<div class="row gap4"><button class="btn icon sm ghost" data-ed="' + m.mk_id + '" title="Ubah">' + ic('pencil') + '</button>' + (m.status_aktif !== 'TIDAK' ? '<button class="btn icon sm ghost" data-off="' + m.mk_id + '" title="Nonaktifkan">' + ic('ban') + '</button>' : '') + '</div>' }],
      after: (tb) => { $$('[data-ed]', tb).forEach((b) => (b.onclick = () => mkForm(S.idx.mk[b.dataset.ed]))); $$('[data-off]', tb).forEach((b) => (b.onclick = () => nonaktif('MataKuliah', S.idx.mk[b.dataset.off]))); } });
    $('[data-add]', body).onclick = () => mkForm();
  }
  function mkForm(m) {
    const isNew = !m || !m.mk_id; m = m || {};
    const md = modal({ title: isNew ? 'Tambah Mata Kuliah' : 'Ubah Mata Kuliah', icon: 'book-open', size: 'lg',
      body: '<div class="form-grid"><div class="field"><label>Kode <span class="req">*</span></label><input class="inp" name="kode" value="' + esc(m.kode || '') + '" placeholder="MET-804"></div><div class="field"><label>SKS</label><input class="inp" type="number" min="1" max="6" name="sks" value="' + esc(m.sks || 3) + '"></div>' +
        '<div class="field full"><label>Nama Mata Kuliah <span class="req">*</span></label><input class="inp" name="nama" value="' + esc(m.nama || '') + '"></div>' +
        '<div class="field"><label>Semester <span class="req">*</span></label><select class="inp" name="semester_id">' + S.boot.g.semester.map((s) => '<option value="' + s.semester_id + '" ' + (s.semester_id === (m.semester_id || D.smtAktifId()) ? 'selected' : '') + '>' + esc(s.nama_semester) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Dosen Pengampu</label><select class="inp" name="dosen_id"><option value="">—</option>' + S.boot.a.dosen.filter((d) => d.status !== 'Nonaktif').map((d) => '<option value="' + d.dosen_id + '" ' + (d.dosen_id === m.dosen_id ? 'selected' : '') + '>' + esc(d.nama) + '</option>').join('') + '</select></div>' +
        '<div class="field full"><label>Deskripsi</label><textarea class="inp" name="deskripsi" rows="3">' + esc(m.deskripsi || '') + '</textarea></div>' +
        (!isNew ? '<div class="field"><label>Status</label><select class="inp" name="status_aktif"><option value="YA" ' + (m.status_aktif !== 'TIDAK' ? 'selected' : '') + '>Aktif</option><option value="TIDAK" ' + (m.status_aktif === 'TIDAK' ? 'selected' : '') + '>Nonaktif</option></select></div>' : '') + '</div>' +
        (isNew ? '<div class="sec-t">Jadwal Kuliah (untuk tanggal 16 pertemuan otomatis)</div><div class="form-grid"><div class="field"><label>Hari</label><select class="inp" name="hari"><option value="">—</option>' + K.HARI.map((h) => '<option>' + h + '</option>').join('') + '</select></div><div class="field"><label>Ruang / Link</label><input class="inp" name="ruang" placeholder="R. 402 / Zoom"></div><div class="field"><label>Jam Mulai</label><input class="inp" type="time" name="jam_mulai"></div><div class="field"><label>Jam Selesai</label><input class="inp" type="time" name="jam_selesai"></div><div class="field"><label>Kelas</label><select class="inp" name="jenis_kelas"><option>Semua</option><option>P2K</option><option>Reguler</option></select></div></div>' : ''),
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>' + ic('check') + 'Simpan</button>' });
    $('[data-save]', md.el).onclick = async (e) => {
      const fd = formData(md.el);
      if (!fd.kode.trim() || !fd.nama.trim()) return toast('Kode & nama wajib diisi.', 'error');
      const row = { mk_id: m.mk_id || '', kode: fd.kode.trim().toUpperCase(), nama: fd.nama, sks: fd.sks, semester_id: fd.semester_id, dosen_id: fd.dosen_id, deskripsi: fd.deskripsi };
      if (!isNew) row.status_aktif = fd.status_aktif;
      if (!isNew) return K.saveLocal({ action: 'master.save', data: { sheet: 'MataKuliah', row }, list: () => S.boot.g.mk, key: 'mk_id', modal: md, reopen: (d) => mkForm(d), row: Object.assign({}, m, row) });
      busy(e.target.closest('button,.btn'), true, 'Menyimpan…');
      const r = await mutate('master.save', { sheet: 'MataKuliah', row, jadwal: isNew && fd.hari ? { hari: fd.hari, jam_mulai: fd.jam_mulai, jam_selesai: fd.jam_selesai, ruang: fd.ruang, jenis_kelas: fd.jenis_kelas } : null }, { apply: (d) => K.upsertLocal(S.boot.g.mk, 'mk_id', d) });
      busy(e.target.closest('button,.btn'), false); if (r.success) { md.close(); if (isNew) K.refreshBoot(true); }
    };
  }
  function tabSmt(body) {
    const g = S.boot.g;
    body.innerHTML = '<div class="card-h"><div><h3>Semester</h3><div class="sub">Semester aktif menentukan mata kuliah yang tampil di menu.</div></div><button class="btn sm" data-add>' + ic('plus') + 'Semester</button></div><div id="st"></div>';
    table($('#st', body), { rows: g.semester, sortDefault: 'tanggal_mulai', dirDefault: -1,
      cols: [{ k: 'nama_semester', t: 'Semester', render: (s) => '<b class="semi">' + esc(s.nama_semester) + '</b>' }, { k: 'tanggal_mulai', t: 'Mulai', render: (s) => esc(fmtTgl(s.tanggal_mulai)) }, { k: 'tanggal_selesai', t: 'Selesai', render: (s) => esc(fmtTgl(s.tanggal_selesai)) },
        { k: 'status_aktif', t: 'Status', render: (s) => (s.status_aktif === 'YA' ? '<span class="chip green dot">Aktif</span>' : '<button class="btn xs soft" data-on="' + s.semester_id + '">Jadikan aktif</button>') },
        { k: 'mk', t: 'MK', sort: false, render: (s) => g.mk.filter((m) => m.semester_id === s.semester_id).length },
        { k: 'aksi', t: '', sort: false, render: (s) => '<div class="row gap4"><button class="btn icon sm ghost" data-ed="' + s.semester_id + '">' + ic('pencil') + '</button><button class="btn icon sm ghost" data-del="' + s.semester_id + '">' + ic('trash-2') + '</button></div>' }],
      after: (tb) => {
        $$('[data-ed]', tb).forEach((b) => (b.onclick = () => smtForm(S.idx.smt[b.dataset.ed])));
        $$('[data-del]', tb).forEach((b) => (b.onclick = () => nonaktif('Semester', S.idx.smt[b.dataset.del])));
        $$('[data-on]', tb).forEach((b) => (b.onclick = () => { const s = S.idx.smt[b.dataset.on]; mutate('master.save', { sheet: 'Semester', row: Object.assign({}, s, { status_aktif: 'YA' }) }, { optimistic: () => { g.semester.forEach((x) => (x.status_aktif = x === s ? 'YA' : 'TIDAK')); g.settings.SEMESTER_AKTIF = s.semester_id; } }).then(() => K.renderShell()); }));
      } });
    $('[data-add]', body).onclick = () => smtForm();
  }
  function smtForm(s) {
    s = s || {};
    const md = modal({ title: s.semester_id ? 'Ubah Semester' : 'Tambah Semester', icon: 'calendar-days',
      body: '<div class="form-grid"><div class="field full"><label>Nama Semester <span class="req">*</span></label><input class="inp" name="nama_semester" value="' + esc(s.nama_semester || '') + '" placeholder="Semester Genap 2026/2027"></div><div class="field"><label>Tanggal Mulai</label><input class="inp" type="date" name="tanggal_mulai" value="' + esc(ymd(s.tanggal_mulai)) + '"></div><div class="field"><label>Tanggal Selesai</label><input class="inp" type="date" name="tanggal_selesai" value="' + esc(ymd(s.tanggal_selesai)) + '"></div><label class="check"><input type="checkbox" name="aktif" ' + (s.status_aktif === 'YA' ? 'checked' : '') + '>Jadikan semester aktif</label></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button>' });
    $('[data-save]', md.el).onclick = () => {
      const fd = formData(md.el);
      if (!fd.nama_semester.trim() || !fd.tanggal_mulai || !fd.tanggal_selesai) return toast('Nama, tanggal mulai & selesai wajib diisi.', 'error');
      const row = { semester_id: s.semester_id || '', nama_semester: fd.nama_semester.trim(), tanggal_mulai: fd.tanggal_mulai, tanggal_selesai: fd.tanggal_selesai, status_aktif: fd.aktif ? 'YA' : (s.status_aktif || 'TIDAK') };
      K.saveLocal({ action: 'master.save', data: { sheet: 'Semester', row }, list: () => S.boot.g.semester, key: 'semester_id', modal: md, reopen: (d) => smtForm(d), row: Object.assign({}, s, row),
        onSaved: (d) => { if (d && d.status_aktif === 'YA') { S.boot.g.semester.forEach((x) => { if (x.semester_id !== d.semester_id) x.status_aktif = 'TIDAK'; }); S.boot.g.settings.SEMESTER_AKTIF = d.semester_id; K.renderShell(); } } });
    };
  }
  function tabDosen(body) {
    body.innerHTML = '<div class="card-h"><div><h3>Dosen Pengampu</h3><div class="sub">Dosen hanya sebagai data master (tidak login).</div></div><button class="btn sm" data-add>' + ic('plus') + 'Dosen</button></div><div id="dt"></div>';
    table($('#dt', body), { rows: S.boot.a.dosen, placeholder: 'Cari dosen…', search: (d) => d.nama + ' ' + d.email + ' ' + d.bidang,
      cols: [{ k: 'nama', t: 'Nama', render: (d) => '<div class="person">' + avatar(d.nama, 'sm') + '<div class="t"><b>' + esc(d.nama) + '</b><span>' + esc(d.bidang || '') + '</span></div></div>' }, { k: 'email', t: 'Email' }, { k: 'no_hp', t: 'No HP', render: (d) => '<span class="mono">' + esc(d.no_hp || '—') + '</span>' },
        { k: 'mk', t: 'Mata Kuliah', sort: false, render: (d) => S.boot.g.mk.filter((m) => m.dosen_id === d.dosen_id).map((m) => '<span class="chip">' + esc(m.kode) + '</span>').join(' ') || '—' }, { k: 'status', t: 'Status', render: (d) => statusChip(d.status || 'Aktif') },
        { k: 'aksi', t: '', sort: false, render: (d) => '<div class="row gap4"><button class="btn icon sm ghost" data-ed="' + d.dosen_id + '">' + ic('pencil') + '</button>' + (d.status !== 'Nonaktif' ? '<button class="btn icon sm ghost" data-off="' + d.dosen_id + '">' + ic('ban') + '</button>' : '') + '</div>' }],
      after: (tb) => { $$('[data-ed]', tb).forEach((b) => (b.onclick = () => dosenForm(S.boot.a.dosen.find((x) => x.dosen_id === b.dataset.ed)))); $$('[data-off]', tb).forEach((b) => (b.onclick = () => nonaktif('Dosen', S.boot.a.dosen.find((x) => x.dosen_id === b.dataset.off)))); } });
    $('[data-add]', body).onclick = () => dosenForm();
  }
  function dosenForm(d) {
    d = d || {};
    const md = modal({ title: d.dosen_id ? 'Ubah Dosen' : 'Tambah Dosen', icon: 'user-cog',
      body: '<div class="form-grid"><div class="field full"><label>Nama &amp; Gelar <span class="req">*</span></label><input class="inp" name="nama" value="' + esc(d.nama || '') + '"></div><div class="field"><label>Email</label><input class="inp" name="email" value="' + esc(d.email || '') + '"></div><div class="field"><label>No HP</label><input class="inp" name="no_hp" value="' + esc(d.no_hp || '') + '"></div><div class="field full"><label>Bidang / Keahlian</label><input class="inp" name="bidang" value="' + esc(d.bidang || '') + '"></div><div class="field"><label>Status</label><select class="inp" name="status"><option ' + (d.status !== 'Nonaktif' ? 'selected' : '') + '>Aktif</option><option ' + (d.status === 'Nonaktif' ? 'selected' : '') + '>Nonaktif</option></select></div></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button>' });
    $('[data-save]', md.el).onclick = () => {
      const fd = formData(md.el); if (!fd.nama.trim()) return toast('Nama wajib diisi.', 'error');
      if (fd.no_hp && !hpValid(fd.no_hp)) return toast('Nomor HP tidak valid.', 'error');
      const row = Object.assign({ dosen_id: d.dosen_id || '' }, fd, { no_hp: fd.no_hp ? hp08(fd.no_hp) : '' });
      K.saveLocal({ action: 'master.save', data: { sheet: 'Dosen', row }, list: () => S.boot.a.dosen, mirror: () => S.boot.g.dosen, key: 'dosen_id', modal: md, reopen: (x) => dosenForm(x), row: Object.assign({}, d, row) });
    };
  }
  function tabJadwal(body) {
    body.innerHTML = '<div class="card-h"><div><h3>Jadwal Mata Kuliah</h3><div class="sub">Jadwal mingguan; dapat dibedakan untuk kelas P2K & Reguler.</div></div><button class="btn sm" data-add>' + ic('plus') + 'Jadwal</button></div><div id="jt"></div>';
    table($('#jt', body), { rows: S.boot.g.jadwal, sortDefault: 'hari',
      cols: [{ k: 'mk', t: 'Mata Kuliah', sortVal: (j) => (S.idx.mk[j.mk_id] || {}).nama, render: (j) => '<b class="semi">' + esc((S.idx.mk[j.mk_id] || {}).nama || '-') + '</b>' }, { k: 'hari', t: 'Hari', sortVal: (j) => K.HARI.indexOf(j.hari) }, { k: 'jam', t: 'Jam', sortVal: (j) => j.jam_mulai, render: (j) => esc(j.jam_mulai + ' – ' + (j.jam_selesai || '')) }, { k: 'ruang', t: 'Ruang / Link' }, { k: 'jenis_kelas', t: 'Kelas', render: (j) => (j.jenis_kelas === 'Semua' || !j.jenis_kelas ? '<span class="chip">Semua</span>' : chipJenis(j.jenis_kelas)) },
        { k: 'aksi', t: '', sort: false, render: (j) => '<div class="row gap4"><button class="btn icon sm ghost" data-ed="' + j.jadwal_id + '">' + ic('pencil') + '</button><button class="btn icon sm ghost" data-del="' + j.jadwal_id + '">' + ic('trash-2') + '</button></div>' }],
      after: (tb) => { $$('[data-ed]', tb).forEach((b) => (b.onclick = () => jadwalForm(S.boot.g.jadwal.find((x) => x.jadwal_id === b.dataset.ed)))); $$('[data-del]', tb).forEach((b) => (b.onclick = () => nonaktif('Jadwal', S.boot.g.jadwal.find((x) => x.jadwal_id === b.dataset.del)))); } });
    $('[data-add]', body).onclick = () => jadwalForm();
  }
  function jadwalForm(j) {
    j = j || {};
    const md = modal({ title: j.jadwal_id ? 'Ubah Jadwal' : 'Tambah Jadwal', icon: 'clock',
      body: '<div class="form-grid"><div class="field full"><label>Mata Kuliah <span class="req">*</span></label><select class="inp" name="mk_id">' + D.mkAktif().map((m) => '<option value="' + m.mk_id + '" ' + (m.mk_id === j.mk_id ? 'selected' : '') + '>' + esc(m.kode + ' — ' + m.nama) + '</option>').join('') + '</select></div><div class="field"><label>Hari <span class="req">*</span></label><select class="inp" name="hari">' + K.HARI.map((h) => '<option ' + (h === j.hari ? 'selected' : '') + '>' + h + '</option>').join('') + '</select></div><div class="field"><label>Kelas</label><select class="inp" name="jenis_kelas">' + ['Semua', 'P2K', 'Reguler'].map((x) => '<option ' + (x === (j.jenis_kelas || 'Semua') ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div><div class="field"><label>Jam Mulai <span class="req">*</span></label><input class="inp" type="time" name="jam_mulai" value="' + esc(j.jam_mulai || '') + '"></div><div class="field"><label>Jam Selesai</label><input class="inp" type="time" name="jam_selesai" value="' + esc(j.jam_selesai || '') + '"></div><div class="field full"><label>Ruang / Link</label><input class="inp" name="ruang" value="' + esc(j.ruang || '') + '"></div></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button>' });
    $('[data-save]', md.el).onclick = () => {
      const fd = formData(md.el); if (!fd.jam_mulai) return toast('Jam mulai wajib diisi.', 'error');
      const row = Object.assign({ jadwal_id: j.jadwal_id || '' }, fd);
      K.saveLocal({ action: 'master.save', data: { sheet: 'Jadwal', row }, list: () => S.boot.g.jadwal, key: 'jadwal_id', modal: md, reopen: (x) => jadwalForm(x), row: Object.assign({}, j, row) });
    };
  }
  K.registerPage('master', { auth: 'admin', title: 'Master Data', show: renderMaster });

  // ============================================================== DETAIL MAHASISWA
  K.registerPage('mahasiswa', {
    auth: 'admin', title: 'Detail Mahasiswa',
    show(el, id) {
      const m = S.boot.a.mahasiswa.find((x) => x.mhs_id === id);
      if (!m) { el.innerHTML = '<div class="card empty">Mahasiswa tidak ditemukan. <a href="#/master/mhs">Kembali</a></div>'; return; }
      const st = el._st && el._st.id === id ? el._st : (el._st = { id, tab: 'info' });
      const u = S.boot.a.users.find((x) => x.email === m.email), ts = S.boot.g.penugasan.filter((t) => (t.petugas_ids || []).indexOf(id) > -1);
      const ok = ts.filter((t) => D.statusTugas(t) === 'Terkumpul').length, tg = S.boot.a.target.filter((t) => t.mhs_id === id);
      const todos = S.boot.g.todo.filter((t) => !t.jenis_kelas || t.jenis_kelas === 'Semua' || t.jenis_kelas === m.jenis_mahasiswa), done = S.boot.a.todoStatus.filter((s) => s.mhs_id === id && s.selesai === 'Y').length;
      el.innerHTML = '<div class="crumb"><a href="#/master/mhs">Master Data</a>' + ic('chevron-right') + '<a href="#/master/mhs">Direktori Mahasiswa</a>' + ic('chevron-right') + '<b>' + esc(m.nama_lengkap) + '</b></div>' +
        '<div class="page-h"><h1>Detail Profil Mahasiswa</h1><div class="row wrap"><a class="btn ghost" href="#/master/mhs">' + ic('arrow-left') + 'Kembali</a><button class="btn ghost" data-notif>' + ic('send') + 'Kirim Notifikasi</button><button class="btn" data-edit>' + ic('pencil') + 'Perbarui Profil</button></div></div>' +
        '<div class="card pad-lg" style="background:linear-gradient(120deg,#fff 60%,#F3F5FF)"><div class="row wrap" style="gap:22px;align-items:flex-start">' + avatar(m.nama_lengkap, 'lg') + '<div class="grow"><div class="row wrap gap6"><h2 style="font-size:26px">' + esc(m.nama_lengkap) + '</h2>' + chipJenis(m.jenis_mahasiswa) + '</div>' +
        '<div class="row wrap gap6 mt8">' + (u ? '<span class="chip blue">' + ic('shield-check') + esc(K.ROLE_LABEL[u.role]) + '</span>' : '<span class="chip">Belum punya akun login</span>') + (u ? statusChip(u.status_akun) : '') + '</div>' +
        '<div class="row wrap mt12 small" style="gap:18px"><span>' + ic('file-text') + ' NIM: <b>' + esc(m.nim || '—') + '</b></span><span>' + ic('calendar-days') + ' ' + esc(m.angkatan || '—') + '</span><span>' + ic('graduation-cap') + ' ' + esc(m.konsentrasi || 'Konsentrasi belum diisi') + '</span></div>' +
        '<div class="small muted mt8">Status: ' + statusChip(m.status || 'Aktif') + (u && u.last_login ? ' · Login terakhir ' + fmtRel(u.last_login) : '') + '</div></div>' +
        '<div class="col" style="gap:10px;min-width:200px"><div class="tile row">' + ic('presentation') + '<div><b>' + ts.length + ' tugas</b><div class="xs muted">' + ok + ' lengkap</div></div></div><div class="tile row">' + ic('list-checks') + '<div><b>' + pct(done, todos.length) + '%</b><div class="xs muted">To-do selesai</div></div></div><div class="tile row">' + ic('target') + '<div><b>' + esc(m.status_target || 'Belum ada target') + '</b><div class="xs muted">' + esc(m.target_lulus_semester || '') + '</div></div></div></div></div></div>' +
        '<div class="mt20">' + tabsHtml([['info', 'Informasi Umum & Kontak', 'user-cog'], ['tugas', 'Riwayat Penugasan & Makalah', 'presentation', ts.length], ['target', 'Target & Rencana Kelulusan', 'target', tg.length]], st.tab) + '</div><div id="mdBody"></div>';
      $$('[data-tab]', el).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; Pages_show(el, id); }));
      $('[data-edit]', el).onclick = () => mhsForm(m);
      $('[data-notif]', el).onclick = () => kirimSatu(m);
      const body = $('#mdBody', el);
      if (st.tab === 'info') {
        body.innerHTML = '<div class="split"><div class="card"><div class="card-h"><h3>Data Personal &amp; Instansi</h3><span class="chip">ID: ' + esc(m.mhs_id) + '</span></div><div class="grid g2" style="gap:12px">' +
          [['EMAIL GOOGLE', m.email], ['NOMOR WHATSAPP', (m.no_hp || '—') + (m.StatusWA ? ' · ' + m.StatusWA : '')], ['INSTANSI / UNIT KERJA', m.instansi || '—'], ['KONSENTRASI', m.konsentrasi || '—'], ['ANGKATAN', m.angkatan || '—'], ['JALUR', m.jenis_mahasiswa === 'P2K' ? 'P2K (Kelas Karyawan - Weekend)' : 'Reguler (Full-time)']].map((x) => '<div class="tile"><div class="xs bold muted" style="letter-spacing:.05em">' + x[0] + '</div><div class="semi mt8" style="word-break:break-word">' + esc(x[1]) + '</div></div>').join('') + '</div></div>' +
          '<div class="card"><div class="card-h"><h3>Jalur Reminder Otomatis</h3>' + ic('bell') + '</div><div class="small muted mb12">Notifikasi jadwal & batas pengumpulan makalah via WhatsApp (Fonnte) dan Email.</div>' +
          [['H-7', 'Pemberitahuan topik & sesi'], ['H-3', 'Batas unggah draf makalah'], ['H-1', 'Finalisasi slide presentasi']].map((x) => '<div class="tile row between mb8"><span class="row"><span class="chip ' + (x[0] === 'H-1' ? 'red' : x[0] === 'H-3' ? 'amber' : '') + '">' + x[0] + '</span>' + x[1] + '</span><span class="chip green dot">aktif</span></div>').join('') +
          '<div class="xs muted mt8">Kanal: ' + (S.boot.g.settings.NOTIF_WA_AKTIF === 'YA' ? 'WhatsApp ✓ ' : 'WhatsApp ✗ ') + (S.boot.g.settings.NOTIF_EMAIL_AKTIF === 'YA' ? '· Email ✓' : '· Email ✗') + '</div></div></div>';
      } else if (st.tab === 'tugas') {
        body.innerHTML = '<div class="card" id="tt"></div>';
        table($('#tt', body), { rows: ts, empty: 'Belum ada penugasan.',
          cols: [{ k: 'mk', t: 'Mata Kuliah', sortVal: (t) => D.mkOfPtm(D.ptmOf(t)).nama, render: (t) => '<b class="semi">' + esc(D.mkOfPtm(D.ptmOf(t)).nama || '') + '</b><div class="xs muted">Sesi ' + D.ptmOf(t).nomor + '</div>' }, { k: 'tema', t: 'Tema' }, { k: 'tipe', t: 'Tipe' }, { k: 'deadline_makalah', t: 'Deadline', render: (t) => esc(fmtTgl(t.deadline_makalah)) },
            { k: 'berkas', t: 'Berkas', sort: false, render: (t) => { const s = D.subs(t.tugas_id); return (s.makalah ? '<button class="btn xs ghost" data-v="' + s.makalah.submission_id + '">' + ic('file-text') + 'Makalah</button> ' : '') + (s.ppt ? '<button class="btn xs ghost" data-v="' + s.ppt.submission_id + '">' + ic('presentation') + 'PPT</button>' : '') || '<span class="faint">—</span>'; } },
            { k: 'st', t: 'Status', sortVal: (t) => D.statusTugas(t), render: (t) => statusChip(D.statusTugas(t)) }],
          after: (tb) => $$('[data-v]', tb).forEach((b) => (b.onclick = () => K.viewSub(S.boot.g.submission.find((x) => x.submission_id === b.dataset.v)))) });
      } else {
        body.innerHTML = '<div class="card">' + (tg.length ? tg.map((x) => '<div class="tile mb8"><div class="row between"><b class="semi">' + esc(x.judul_target) + '</b>' + statusChip(x.status) + '</div><div class="mt8">' + K.progress(Number(x.progres || 0), x.status === 'Terlambat' ? 'amber' : x.status === 'Tercapai' ? 'green' : '') + '</div><div class="xs muted mt8">Tenggat ' + esc(fmtTgl(x.tenggat)) + ' · ' + (x.progres || 0) + '%</div></div>').join('') : '<div class="empty">Belum ada target.</div>') + '<a class="btn soft mt12" href="#/rencana/target">' + ic('target') + 'Kelola target di menu Rencana</a></div>';
      }
    }
  });
  function Pages_show(el, id) { K.rerender(); }
  function kirimSatu(m) {
    const md = modal({ title: 'Kirim Notifikasi', sub: esc(m.nama_lengkap + ' · ' + (m.no_hp || '') + ' · ' + m.email), icon: 'send',
      body: '<div class="field"><label>Kanal</label><div class="seg" id="kSeg"><button class="on" data-k="WA">WhatsApp</button><button data-k="EMAIL">Email</button></div></div><div class="field mt12"><label>Judul (subjek email)</label><input class="inp" name="judul" value="Info dari Ketua Kelas"></div><div class="field mt12"><label>Pesan</label><textarea class="inp" name="pesan" rows="5">Halo {nama}, </textarea><span class="hint">Dikirim lewat antrean notifikasi (≤ 1 menit).</span></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-go>' + ic('send') + 'Kirim</button>' });
    let k = 'WA'; $$('#kSeg button', md.el).forEach((b) => (b.onclick = () => { k = b.dataset.k; $$('#kSeg button', md.el).forEach((x) => x.classList.toggle('on', x === b)); }));
    $('[data-go]', md.el).onclick = async (e) => {
      const fd = formData(md.el); busy(e.target.closest('button,.btn'), true, 'Mengirim…');
      const r = await api('wa.blastCreate', { judul: fd.judul, pesan: fd.pesan, kanal: k, ukuranBatch: 5, jeda: '2', sasaran: 'Perorangan: ' + m.nama_lengkap, penerima: [{ id: m.mhs_id, nama: m.nama_lengkap, hp: m.no_hp, email: m.email, vars: { nim: m.nim } }] });
      if (r.success) await api('wa.blastProcess', { blastId: r.data.blast_id });
      busy(e.target.closest('button,.btn'), false);
      if (!r.success) return toast(r.message, 'error');
      md.close(); toast('Notifikasi dikirim ke ' + m.nama_lengkap + '.');
    };
  }

  // ============================================================== ROLE USER (Operator)
  K.registerPage('roles', {
    auth: 'op', title: 'Role User',
    show(el) {
      const st = el._st || (el._st = { s: '' });
      const users = S.boot.a.users.filter((u) => !st.s || u.status_akun === st.s);
      const c = (s) => S.boot.a.users.filter((u) => u.status_akun === s).length;
      el.innerHTML = '<div class="page-h"><div><h1>Role User</h1><div class="sub">Atur peran (Operator · Ketua Kelas · Anggota) dan aktif/nonaktifkan akun. Dicek di sisi server pada setiap permintaan.</div></div></div>' +
        '<div class="alert info mb12">' + ic('shield-check') + '<span><b>Operator</b>: akses penuh termasuk Pengaturan & Role User. <b>Ketua Kelas</b>: kelola penugasan, pengumuman, master data, verifikasi. <b>Anggota</b>: membaca, mengunggah tugas/notulen/referensi.</span></div>' +
        '<div class="card" id="rt"></div>';
      table($('#rt', el), { rows: users, per: 20, placeholder: 'Cari nama / email…', search: (u) => u.nama_lengkap + ' ' + u.email,
        tools: '<div class="seg" data-seg>' + [['', 'Semua'], ['Aktif', 'Aktif ' + c('Aktif')], ['Menunggu', 'Menunggu ' + c('Menunggu')], ['Nonaktif', 'Nonaktif ' + c('Nonaktif')], ['Ditolak', 'Ditolak ' + c('Ditolak')]].map((x) => '<button data-s="' + x[0] + '" class="' + (st.s === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>',
        onTools: (tl) => $$('[data-s]', tl).forEach((b) => (b.onclick = () => { st.s = b.dataset.s; el.innerHTML = ''; K.rerender(); })),
        cols: [{ k: 'nama', t: 'Pengguna', sortVal: (u) => u.nama_lengkap, render: (u) => '<div class="person">' + avatar(u.nama_lengkap, 'sm') + '<div class="t"><b>' + esc(u.nama_lengkap) + (u.user_id === S.me.user_id ? ' <span class="chip blue">Anda</span>' : '') + '</b><span>' + esc(u.email) + '</span></div></div>' },
          { k: 'jenis', t: 'Jenis', sortVal: (u) => u.jenis_mahasiswa, render: (u) => chipJenis(u.jenis_mahasiswa) || '—' },
          { k: 'role', t: 'Peran', sortVal: (u) => u.role, render: (u) => '<select class="inp" data-role="' + u.user_id + '" style="min-width:150px">' + ROLE_OPT(u.role, true) + '</select>' },
          { k: 'status', t: 'Status Akun', sortVal: (u) => u.status_akun, render: (u) => (u.status_akun === 'Menunggu' ? '<a class="chip amber" href="#/master/verif">Menunggu → verifikasi</a>' : '<label class="switch"><input type="checkbox" data-act="' + u.user_id + '" ' + (u.status_akun === 'Aktif' ? 'checked' : '') + '><span class="tr"></span>' + esc(u.status_akun) + '</label>') },
          { k: 'last', t: 'Login Terakhir', sortVal: (u) => u.last_login, render: (u) => (u.last_login ? fmtRel(u.last_login) : '<span class="faint">belum</span>') }],
        after: (tb) => {
          $$('[data-role]', tb).forEach((s) => (s.onchange = () => { const u = S.boot.a.users.find((x) => x.user_id === s.dataset.role), prev = u.role; mutate('user.save', { user_id: u.user_id, role: s.value }, { optimistic: () => (u.role = s.value), rollback: () => (u.role = prev) }); }));
          $$('[data-act]', tb).forEach((c) => (c.onchange = () => { const u = S.boot.a.users.find((x) => x.user_id === c.dataset.act), prev = u.status_akun, v = c.checked ? 'Aktif' : 'Nonaktif'; mutate('user.save', { user_id: u.user_id, status_akun: v }, { optimistic: () => (u.status_akun = v), rollback: () => (u.status_akun = prev) }); }));
        } });
    }
  });

  // ============================================================== PENGATURAN (Operator)
  function resizeImage(file, max) {
    return new Promise((res, rej) => {
      if (!/^image\//.test(file.type)) return rej(new Error('Pilih berkas gambar.'));
      if (/svg/.test(file.type)) return K.readFile(file, { max: 300 * 1024 }).then(res, rej);
      const img = new Image(); img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/png'); res({ nama_file: file.name.replace(/\.\w+$/, '') + '.png', mime: 'image/png', base64: url.split(',')[1], preview: url });
      }; img.onerror = () => rej(new Error('Gambar tidak dapat dibaca.')); img.src = URL.createObjectURL(file);
    });
  }
  K.registerPage('settings', {
    auth: 'op', title: 'Pengaturan', selfManaged: true,
    show(el, param) {
      const st = el._st || (el._st = { tab: param || 'umum' });
      if (param && ['umum', 'sistem', 'migrasi', 'audit'].indexOf(param) > -1) st.tab = param;
      el.innerHTML = '<div class="page-h"><div><h1>Pengaturan</h1><div class="sub">Identitas aplikasi, logo, semester aktif, sistem & trigger, migrasi data, dan log audit. Hanya Operator.</div></div></div>' +
        tabsHtml([['umum', 'Umum & Logo', 'settings'], ['sistem', 'Sistem & Trigger', 'server'], ['migrasi', 'Migrasi Data', 'database'], ['audit', 'Log Audit', 'history']], st.tab) + '<div id="setBody"></div>';
      $$('[data-tab]', el).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; history.replaceState(null, '', '#/settings/' + st.tab); S.param = st.tab; this.show(el, st.tab, true); }));
      const body = $('#setBody', el);
      ({ umum: setUmum, sistem: setSistem, migrasi: setMigrasi, audit: setAudit })[st.tab](body);
    }
  });
  function setUmum(body) {
    body.innerHTML = '<div class="card"><div class="skel" style="height:240px"></div></div>';
    loadSwr('settings', 'settings.get', {}, (s, fromCache, err) => {
      if (!s) { body.innerHTML = '<div class="card alert err">' + esc(err || 'Gagal memuat.') + '</div>'; return; }
      const br = S.branding || {};
      body.innerHTML = '<div class="split"><div class="card"><div class="card-h"><h3>Identitas Aplikasi</h3></div><div class="form-grid">' +
        '<div class="field"><label>Nama Aplikasi</label><input class="inp" name="NAMA_APLIKASI" value="' + esc(s.NAMA_APLIKASI) + '"></div><div class="field"><label>Program / Institusi</label><input class="inp" name="NAMA_INSTITUSI" value="' + esc(s.NAMA_INSTITUSI) + '"></div>' +
        '<div class="field"><label>Label Angkatan</label><input class="inp" name="ANGKATAN_LABEL" value="' + esc(s.ANGKATAN_LABEL) + '"></div><div class="field"><label>Semester Aktif</label><select class="inp" name="SEMESTER_AKTIF">' + S.boot.g.semester.map((x) => '<option value="' + x.semester_id + '" ' + (x.semester_id === s.SEMESTER_AKTIF ? 'selected' : '') + '>' + esc(x.nama_semester) + '</option>').join('') + '</select></div>' +
        '<div class="field full"><label>Google OAuth Client ID</label><input class="inp mono" name="GOOGLE_CLIENT_ID" value="' + esc(s.GOOGLE_CLIENT_ID) + '" placeholder="xxxx.apps.googleusercontent.com"><span class="hint">Dipakai tombol "Masuk dengan Google". Origin GitHub Pages harus terdaftar di Google Cloud Console.</span></div>' +
        '<div class="field full"><label>URL Aplikasi (untuk {link} di pesan)</label><input class="inp" name="APP_URL" value="' + esc(s.APP_URL) + '" placeholder="https://username.github.io/sim-kuliah/"></div>' +
        '<div class="field"><label>Nama Pengirim Email</label><input class="inp" name="EMAIL_NAMA_PENGIRIM" value="' + esc(s.EMAIL_NAMA_PENGIRIM) + '"></div>' +
        '<div class="field"><label>Ukuran Gelombang Blast</label><select class="inp" name="WA_BATCH_DEFAULT">' + ['5', '10', '20', '30', '50'].map((x) => '<option ' + (x === String(s.WA_BATCH_DEFAULT || '10') ? 'selected' : '') + '>' + x + '</option>').join('') + '</select><span class="hint">Penerima per gelombang (5/10/30 sesuai PRD, +20/50).</span></div>' +
        '<label class="switch"><input type="checkbox" name="REMINDER_AKTIF" ' + (s.REMINDER_AKTIF !== 'TIDAK' ? 'checked' : '') + '><span class="tr"></span>Reminder otomatis H-7/H-3/H-1</label>' +
        '<label class="switch"><input type="checkbox" name="BACKUP_MINGGUAN" ' + (s.BACKUP_MINGGUAN !== 'TIDAK' ? 'checked' : '') + '><span class="tr"></span>Backup spreadsheet mingguan</label></div>' +
        '<div class="row mt20"><button class="btn" data-save>' + ic('check') + 'Simpan Pengaturan</button></div></div>' +
        '<div class="card"><div class="card-h"><div><h3>Logo Custom</h3><div class="sub">Tampil sebagai thumbnail di halaman login & sidebar</div></div></div><div class="row" style="gap:18px"><div id="logoPrev" style="width:96px;height:96px;border-radius:22px;background:var(--primary);display:grid;place-items:center;overflow:hidden;color:#fff">' + (br.logo ? '<img src="' + br.logo + '" style="width:100%;height:100%;object-fit:contain;background:#fff">' : ic('graduation-cap')) + '</div>' +
        '<div class="col"><label class="btn ghost">' + ic('upload') + 'Pilih Gambar<input type="file" accept="image/*" hidden data-logo></label><span class="small muted">PNG/JPG/SVG, otomatis dikecilkan ke 256 px.</span></div></div></div></div>';
      $('[data-save]', body).onclick = async (e) => {
        const fd = formData(body); fd.REMINDER_AKTIF = fd.REMINDER_AKTIF ? 'YA' : 'TIDAK'; fd.BACKUP_MINGGUAN = fd.BACKUP_MINGGUAN ? 'YA' : 'TIDAK';
        busy(e.target.closest('button,.btn'), true, 'Menyimpan…');
        const r = await api('settings.save', fd);
        busy(e.target.closest('button,.btn'), false);
        if (!r.success) return toast(r.message, 'error');
        Store.set(userKey('a:settings'), { t: Date.now(), data: r.data });
        Object.assign(S.boot.g.settings, { NAMA_APLIKASI: r.data.NAMA_APLIKASI, NAMA_INSTITUSI: r.data.NAMA_INSTITUSI, ANGKATAN_LABEL: r.data.ANGKATAN_LABEL, SEMESTER_AKTIF: r.data.SEMESTER_AKTIF });
        if (S.branding) Object.assign(S.branding, { nama: r.data.NAMA_APLIKASI, institusi: r.data.NAMA_INSTITUSI, clientId: r.data.GOOGLE_CLIENT_ID });
        K.renderShell(); K.refreshBoot(true); toast('Pengaturan disimpan.');
      };
      $('[data-logo]', body).onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const img = await resizeImage(f, 256);
          $('#logoPrev', body).innerHTML = '<img src="' + (img.preview || 'data:' + img.mime + ';base64,' + img.base64) + '" style="width:100%;height:100%;object-fit:contain;background:#fff">';
          const r = await api('logo.upload', img);
          if (!r.success) return toast(r.message, 'error');
          S.branding = Object.assign({}, S.branding || {}, { logo: r.data.logo }); Store.set('branding', S.branding); K.renderShell(); toast('Logo diperbarui.');
        } catch (er) { toast(er.message, 'error'); }
      };
    }, 15000);
  }
  function setSistem(body) {
    body.innerHTML = '<div class="card"><div class="skel" style="height:200px"></div></div>';
    const draw = (s, c, err) => {
      if (!s) { body.innerHTML = '<div class="card alert err">' + esc(err || 'Gagal memuat status.') + '</div>'; return; }
      body.innerHTML = '<div class="grid g2"><div class="card"><div class="card-h"><h3>Status Sistem</h3><span class="chip">v' + esc(s.versi) + ' · skema ' + esc(s.schema) + '</span></div><div class="col">' +
        '<div class="tile row between"><span>' + ic('clock') + ' Trigger antrean notifikasi (1 menit)</span>' + statusChip(s.triggerAntrean ? 'Aktif' : 'Nonaktif') + '</div>' +
        '<div class="tile row between"><span>' + ic('calendar-check') + ' Trigger harian (reminder, target, backup)</span>' + statusChip(s.triggerHarian ? 'Aktif' : 'Nonaktif') + '</div>' +
        '<div class="tile row between"><span>' + ic('mail') + ' Sisa kuota email hari ini</span><b>' + (s.kuotaEmail == null ? '-' : s.kuotaEmail) + '</b></div>' +
        '<div class="tile row between"><span>' + ic('history') + ' Job harian terakhir</span><b class="small">' + (s.harianTerakhir ? fmtWaktu(s.harianTerakhir) : 'belum') + '</b></div>' +
        '<div class="tile row between"><span>' + ic('hard-drive-download') + ' Backup terakhir</span><b class="small">' + (s.backupTerakhir ? fmtWaktu(s.backupTerakhir) : 'belum') + '</b></div>' +
        '<div class="tile row between"><span>' + ic('users') + ' Data</span><span class="small">' + s.jumlah.users + ' akun · ' + s.jumlah.mahasiswa + ' mhs · ' + s.jumlah.mk + ' MK · ' + s.jumlah.penugasan + ' tugas</span></div></div></div>' +
        '<div class="card"><div class="card-h"><h3>Tindakan</h3></div><div class="col">' +
        [['trigger', 'zap', 'Pasang / Perbaiki Trigger'], ['harian', 'calendar-check', 'Jalankan Job Harian Sekarang'], ['reminder', 'bell', 'Jalankan Reminder Saja'], ['backup', 'hard-drive-download', 'Backup Spreadsheet Sekarang'], ['shareAll', 'folder-open', 'Bagikan Folder Berkas ke Semua Akun Aktif'], ['cache', 'refresh-cw', 'Reset Cache Server']].map((x) => '<button class="btn ghost" data-job="' + x[0] + '" style="justify-content:flex-start">' + ic(x[1]) + x[2] + '</button>').join('') +
        '<div class="sec-t">Tautan Admin (salin)</div><div class="tile row"><span class="grow small ellipsis mono">' + esc(s.spreadsheetUrl) + '</span><button class="btn xs ghost" data-copy="' + esc(s.spreadsheetUrl) + '">' + ic('copy') + 'Spreadsheet</button></div><div class="tile row"><span class="grow small ellipsis mono">' + esc(s.driveUrl) + '</span><button class="btn xs ghost" data-copy="' + esc(s.driveUrl) + '">' + ic('copy') + 'Folder Drive</button></div>' +
        '<div class="small muted">Performa klien: buka Console lalu ketik <span class="mono">Perf.table()</span>.</div></div></div></div>';
      $$('[data-job]', body).forEach((b) => (b.onclick = async () => {
        busy(b, true, 'Menjalankan…');
        const r = await api('system.run', { job: b.dataset.job }, { timeout: 300000 });
        busy(b, false);
        toast(r.success ? 'Selesai: ' + JSON.stringify(r.data).slice(0, 140) : r.message, r.success ? 'success' : 'error');
        if (r.success) { const s2 = await api('system.status', { _fresh: true }); if (s2.success) Store.set(userKey('a:sys'), { t: Date.now(), data: s2.data }); setSistem(body); if (b.dataset.job === 'cache') K.refreshBoot(true); }
      }));
      $$('[data-copy]', body).forEach((b) => (b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy).then(() => toast('Disalin ke clipboard.')); }));
    };
    loadSwr('sys', 'system.status', {}, draw, 10000);
  }
  const MIG_SHEETS = [['Pengaturan', 'Pengaturan aplikasi', true], ['Semester', 'Semester', true], ['Dosen', 'Dosen', true], ['Users', 'Akun pengguna', true], ['Mahasiswa', 'Mahasiswa', true], ['MataKuliah', 'Mata kuliah', true], ['Jadwal', 'Jadwal', true], ['Pertemuan', 'Pertemuan (16 sesi)', true], ['Penugasan', 'Penugasan', true], ['Submission', 'Submission makalah/PPT', true], ['Notulen', 'Notulen', true], ['Referensi', 'Referensi', true], ['Pengumuman', 'Pengumuman', true], ['Rencana_Timeline', 'Timeline', true], ['Rencana_Todo', 'To-do', true], ['Todo_Status', 'Status to-do', true], ['Target_Mahasiswa', 'Target mahasiswa', true], ['CRM_Kontak', 'Kontak CRM manual', true], ['Audit_Log', 'Log audit (besar)', false]];
  function setMigrasi(body) {
    const st = body._m || (body._m = { src: Store.get('migSrc', ''), res: null });
    body.innerHTML = '<div class="split"><div class="card"><div class="card-h"><div><h3>Import Data dari App Lama</h3><div class="sub">Spreadsheet lama hanya <b>dibaca</b> — tidak diubah sama sekali. Aman dijalankan berulang (tanpa data dobel).</div></div><span class="chip blue">gas-migrasi-database</span></div>' +
      '<div class="field"><label>URL / ID Spreadsheet App Lama</label><input class="inp mono" id="migSrc" value="' + esc(st.src) + '" placeholder="https://docs.google.com/spreadsheets/d/…"><span class="hint">Harus milik akun Google yang sama dengan app ini agar ID file Drive lama tetap terbaca.</span></div>' +
      '<div class="sec-t">Data yang diimpor <span class="row gap6"><button class="btn xs text" data-all>Pilih semua</button><button class="btn xs text" data-none>Kosongkan</button></span></div><div class="grid g2" style="gap:8px">' +
      MIG_SHEETS.map((x) => '<label class="check tile" style="padding:9px 12px"><input type="checkbox" data-multi name="sheets" value="' + x[0] + '" ' + (x[2] ? 'checked' : '') + '>' + esc(x[1]) + '</label>').join('') + '</div>' +
      '<label class="check mt16"><input type="checkbox" id="migTimpa">Timpa data yang sudah ada di app baru (default: tidak — keputusan di app baru dipertahankan)</label>' +
      '<div class="row wrap mt20"><button class="btn ghost" data-scan>' + ic('search') + 'Pindai (Dry-run)</button><button class="btn" data-run>' + ic('database') + 'Jalankan Import</button></div><div id="migRes" class="mt20"></div></div>' +
      '<div class="card"><div class="card-h"><h3>Checklist Cutover</h3></div><div class="col small" style="line-height:1.6">' +
      ['Pasang app baru → login Operator → <b>Pindai</b> untuk melihat jumlah data.', '<b>Jalankan Import</b>. Cek mahasiswa, mata kuliah, berkas, dan pengaturan. Uji dengan 1 akun anggota.', 'Tepat sebelum pindah: <b>Jalankan Import sekali lagi</b> (delta sync) untuk menangkap data baru di app lama.', 'Umumkan alamat baru (Pengumuman popup + blast WA). Arsipkan deployment lama — datanya tetap aman.'].map((x, i) => '<div class="tile row top"><span class="chip blue">' + (i + 1) + '</span><span>' + x + '</span></div>').join('') +
      '<div class="alert warn">' + ic('triangle-alert') + '<span>Sesi login lama tidak ikut pindah (anggota cukup masuk ulang dengan Google). Akun Operator lama tidak diimpor. Kolom dibaca berdasarkan nama header (alias didukung: Nama, WhatsApp, Jalur, dll).</span></div></div></div></div>';
    const sel = () => $$('[name=sheets]', body).filter((c) => c.checked).map((c) => c.value);
    $('[data-all]', body).onclick = () => $$('[name=sheets]', body).forEach((c) => (c.checked = true));
    $('[data-none]', body).onclick = () => $$('[name=sheets]', body).forEach((c) => (c.checked = false));
    const run = async (dry, btn) => {
      const src = $('#migSrc', body).value.trim(); if (!src) return toast('Tempel URL spreadsheet lama.', 'error');
      if (!sel().length) return toast('Pilih minimal satu data.', 'error');
      if (!dry && !(await confirmDlg('Jalankan import?', 'Data dari spreadsheet lama akan ditulis ke database app ini. Aman diulang (tanpa dobel).', { ok: 'Jalankan Import' }))) return;
      st.src = src; Store.set('migSrc', src);
      busy(btn, true, dry ? 'Memindai…' : 'Mengimpor…');
      const r = await api('migrasi.run', { source: src, sheets: sel(), dryRun: dry, timpa: $('#migTimpa', body).checked }, { timeout: 330000 });
      busy(btn, false);
      if (!r.success) return toast(r.message, 'error');
      const d = r.data, rep = d.report;
      $('#migRes', body).innerHTML = '<div class="alert ' + (dry ? 'info' : 'ok') + '">' + ic(dry ? 'search' : 'circle-check') + '<span><b>' + (dry ? 'Hasil pindai (belum ada yang ditulis)' : 'Import selesai') + '</b> — sumber: ' + esc(d.source.name) + '</span></div>' +
        '<div class="tbl-wrap mt12"><table class="tbl"><thead><tr><th>Data</th><th class="num">Di app lama</th><th class="num">Ditambah</th><th class="num">Diperbarui</th><th class="num">Dilewati</th></tr></thead><tbody>' +
        Object.keys(rep).map((k) => '<tr><td>' + esc(k) + (rep[k].catatan ? ' <span class="xs faint">(' + esc(rep[k].catatan) + ')</span>' : '') + '</td><td class="num">' + rep[k].sumber + '</td><td class="num"><b style="color:var(--green-ink)">' + rep[k].ditambah + '</b></td><td class="num">' + rep[k].diperbarui + '</td><td class="num faint">' + rep[k].dilewati + '</td></tr>').join('') + '</tbody></table></div>' +
        (d.warnings.length ? '<div class="alert warn mt12">' + ic('triangle-alert') + '<div>' + d.warnings.map((w) => '<div>• ' + esc(w) + '</div>').join('') + '</div></div>' : '');
      if (!dry) { K.refreshBoot(true); toast('Import selesai. Data dimuat ulang.'); }
    };
    $('[data-scan]', body).onclick = (e) => run(true, e.target.closest('button,.btn'));
    $('[data-run]', body).onclick = (e) => run(false, e.target.closest('button,.btn'));
  }
  function setAudit(body) {
    body.innerHTML = '<div class="card" id="au"><div class="skel" style="height:200px"></div></div>';
    loadSwr('audit', 'audit.list', {}, (rows, c, err) => {
      const host = $('#au', body); if (!host) return;
      if (!rows) { host.innerHTML = '<div class="alert err">' + esc(err || 'Gagal memuat.') + '</div>'; return; }
      host.innerHTML = '';
      table(host, { rows, per: 25, placeholder: 'Cari aksi / pengguna…', search: (r) => r.aksi + ' ' + r.user_id + ' ' + r.detail, mobileCards: true,
        cols: [{ k: 'waktu', t: 'Waktu', render: (r) => '<span class="nowrap">' + esc(fmtWaktu(r.waktu)) + '</span>' }, { k: 'user_id', t: 'Pengguna', render: (r) => '<span class="small">' + esc(r.user_id) + '</span>' }, { k: 'aksi', t: 'Aksi', render: (r) => '<span class="chip ' + (/HAPUS|ROLE|BLAST|IMPORT|TOLAK/.test(r.aksi) ? 'amber' : '') + '">' + esc(r.aksi) + '</span>' }, { k: 'detail', t: 'Detail', render: (r) => '<span class="small muted">' + esc(String(r.detail || '').slice(0, 160)) + '</span>' }] });
    }, 10000);
  }

  // ============================================================== NOTIFIKASI & WA
  const NS = { aud: null, sel: new Set(), blast: null, auto: false, timer: null, batch: null, jeda: null, kanal: 'WA', hanyaWA: false };
  K.blastPrefill = function (rows) { NS.aud = { rows: rows.map((r) => Object.assign({ valid: hpValid(r.hp) || emailValid(r.email), ganda: false }, r)), ringkas: null }; NS.sel = new Set(rows.map((r) => r.id)); K.go('notif', 'blast'); };
  K.registerPage('notif', {
    auth: 'admin', title: 'Notifikasi & WA', selfManaged: true,
    show(el, param) {
      const st = el._st || (el._st = { tab: param || 'blast' });
      if (param && ['blast', 'antrean', 'config'].indexOf(param) > -1) st.tab = param;
      if (st.tab === 'config' && !D.isOp()) st.tab = 'blast';
      const set = S.boot.g.settings;
      el.innerHTML = '<div class="page-h"><div><h1>WhatsApp &amp; Notifikasi</h1><div class="sub">Blast per gelombang via Fonnte, notifikasi email, antrean pengiriman, dan matriks notifikasi otomatis.</div></div><div class="row gap6"><span class="chip ' + (set.NOTIF_WA_AKTIF === 'YA' ? 'green' : 'red') + ' dot">WhatsApp ' + (set.NOTIF_WA_AKTIF === 'YA' ? 'aktif' : 'nonaktif') + '</span><span class="chip ' + (set.NOTIF_EMAIL_AKTIF === 'YA' ? 'green' : 'red') + ' dot">Email ' + (set.NOTIF_EMAIL_AKTIF === 'YA' ? 'aktif' : 'nonaktif') + '</span></div></div>' +
        tabsHtml([['blast', 'Blast WhatsApp / Email', 'megaphone'], ['antrean', 'Antrean & Riwayat', 'history']].concat(D.isOp() ? [['config', 'Konfigurasi', 'sliders-horizontal']] : []), st.tab) + '<div id="nBody"></div>';
      $$('[data-tab]', el).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; history.replaceState(null, '', '#/notif/' + st.tab); S.param = st.tab; this.show(el, st.tab, true); }));
      const body = $('#nBody', el);
      ({ blast: tabBlast, antrean: tabAntrean, config: tabConfig })[st.tab](body);
    }
  });
  const VARS = ['nama', 'nim', 'jenis', 'app', 'link'];
  function previewMsg(tpl, r) {
    const set = S.boot.g.settings, v = Object.assign({ nama: (r && r.nama) || 'Bapak/Ibu', app: set.NAMA_APLIKASI, institusi: set.NAMA_INSTITUSI, link: location.origin + location.pathname }, (r && r.vars) || {});
    return esc(String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] == null ? '' : v[k]))).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>');
  }
  function tabBlast(body) {
    const set = S.boot.g.settings;
    if (NS.batch == null) NS.batch = Number((Store.get(userKey('a:settings'), {}).data || {}).WA_BATCH_DEFAULT || 10);
    if (NS.jeda == null) NS.jeda = '5';
    body.innerHTML = '<div class="split"><div class="card"><div class="card-h"><div><h3>1. Pilih Sasaran</h3><div class="sub">Default dari CRM Kontak (gabungan mahasiswa, pendaftar, dosen, pengurus)</div></div></div>' +
      '<div class="form-grid"><div class="field"><label>Kanal</label><div class="seg" id="kanalSeg"><button data-k="WA" class="' + (NS.kanal === 'WA' ? 'on' : '') + '">' + ic('message-circle') + ' WhatsApp</button><button data-k="EMAIL" class="' + (NS.kanal === 'EMAIL' ? 'on' : '') + '">' + ic('mail') + ' Email</button></div></div>' +
      '<div class="field"><label>Sumber</label><select class="inp" id="audSrc"><option value="crm">CRM Kontak (semua)</option><option value="mahasiswa">Mahasiswa aktif</option><option value="manual">Tempel manual</option></select></div>' +
      '<div class="field" data-crm><label>Segmen</label><select class="inp" id="audSeg"><option value="">Semua segmen</option><option>Mahasiswa</option><option>Pendaftar</option><option>Pengurus Kelas</option><option>Dosen</option><option>Kontak Luar</option></select></div>' +
      '<div class="field"><label>Jenis Mahasiswa</label><select class="inp" id="audJenis"><option value="">P2K & Reguler</option><option value="P2K">P2K</option><option value="Reguler">Reguler</option></select></div>' +
      '<div class="field full" id="audManualWrap" hidden><label>Daftar manual (satu per baris: <span class="mono">0812xxxx|Nama|email</span>)</label><textarea class="inp mono" id="audManual" rows="4"></textarea></div></div>' +
      '<div class="row wrap mt16"><button class="btn soft" data-load>' + ic('users') + 'Muat Penerima</button><button class="btn ghost" data-detect>' + ic('smartphone') + 'Deteksi Nomor WA</button><span class="small muted" id="detProg"></span></div>' +
      '<div id="audSum" class="row wrap gap6 mt12"></div><label class="check mt12"><input type="checkbox" id="hanyaWA" ' + (NS.hanyaWA ? 'checked' : '') + '>Kirim hanya ke nomor terdeteksi WhatsApp</label><div id="audTbl" class="mt12"></div></div>' +
      '<div class="col" style="gap:20px"><div class="card"><div class="card-h"><h3>2. Tulis Pesan</h3></div><div class="field"><label>Judul internal / subjek email</label><input class="inp" id="bJudul" placeholder="mis. Info Perubahan Jadwal"></div>' +
      '<div class="row wrap gap6 mt12"><span class="small muted">Sisipkan:</span>' + VARS.map((v) => '<button class="btn xs soft" data-var="' + v + '">{' + v + '}</button>').join('') + '</div>' +
      '<textarea class="inp mt8" id="bPesan" rows="6" placeholder="Halo {nama}, …">Halo {nama} 👋\n\n</textarea><div class="wa-preview mt12"><div class="xs bold muted mb8">PRATINJAU · penerima pertama</div><div class="wa-bubble" id="bPrev"></div></div></div>' +
      '<div class="card"><div class="card-h"><h3>3. Ukuran Gelombang &amp; Jeda</h3></div><div class="seg" id="batchSeg">' + [5, 10, 20, 30, 50].map((n) => '<button data-b="' + n + '" class="' + (NS.batch === n ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div class="field mt12"><label>Jeda antarpesan (detik)</label><input class="inp" id="bJeda" value="' + esc(NS.jeda) + '" placeholder="5 atau 3-8"><span class="hint">Rentang acak (mis. 3-8) lebih aman dari pemblokiran WhatsApp.</span></div>' +
      '<div class="tile mt12 small" id="bEst"></div><button class="btn block mt12" data-start>' + ic('send') + 'Mulai Blast</button></div>' +
      '<div class="card" id="blastActive"></div></div></div>' +
      '<div class="card mt20"><div class="card-h"><h3>Riwayat Blast</h3><button class="btn xs ghost" data-refresh-bl>' + ic('refresh-cw') + 'Muat ulang</button></div><div id="blHist"><div class="skel" style="height:80px"></div></div></div>';
    $$('#kanalSeg button', body).forEach((b) => (b.onclick = () => { NS.kanal = b.dataset.k; $$('#kanalSeg button', body).forEach((x) => x.classList.toggle('on', x === b)); drawAud(); }));
    $('#audSrc', body).onchange = (e) => { $('#audManualWrap', body).hidden = e.target.value !== 'manual'; $('[data-crm]', body).hidden = e.target.value !== 'crm'; };
    $$('#batchSeg button', body).forEach((b) => (b.onclick = () => { NS.batch = Number(b.dataset.b); $$('#batchSeg button', body).forEach((x) => x.classList.toggle('on', x === b)); est(); }));
    $('#bJeda', body).oninput = (e) => { NS.jeda = e.target.value; est(); };
    $('#hanyaWA', body).onchange = (e) => { NS.hanyaWA = e.target.checked; drawAud(); };
    const ta = $('#bPesan', body);
    ta.oninput = () => prev();
    $$('[data-var]', body).forEach((b) => (b.onclick = () => { const p = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p) + '{' + b.dataset.var + '}' + ta.value.slice(p); ta.focus(); prev(); }));
    const penerima = () => (NS.aud ? NS.aud.rows.filter((r) => NS.sel.has(r.id) && r.valid && !r.ganda && !r.optOut && (!NS.hanyaWA || NS.kanal !== 'WA' || r.statusWA === 'Terdaftar')) : []);
    function prev() { $('#bPrev', body).innerHTML = previewMsg(ta.value, penerima()[0]) || '<span class="faint">Pesan kosong</span>'; }
    function est() {
      const n = penerima().length, b = NS.batch, j = String(NS.jeda || '5').split('-').map(Number), avg = j.length > 1 ? (j[0] + j[1]) / 2 : j[0] || 5;
      const g = Math.ceil(n / b) || 0, menit = Math.max(g, Math.ceil((n * avg) / 60));
      $('#bEst', body).innerHTML = '<b>' + n + '</b> penerima → <b>' + g + '</b> gelombang × ' + b + ' · perkiraan ±' + menit + ' menit (1 gelombang/menit + jeda ' + esc(NS.jeda) + ' dtk)';
      $('[data-start]', body).innerHTML = ic('send') + 'Mulai Blast (' + n + ' ' + (NS.kanal === 'WA' ? 'nomor' : 'email') + ')';
    }
    function drawAud() {
      const host = $('#audTbl', body), sum = $('#audSum', body);
      if (!NS.aud) { host.innerHTML = '<div class="empty">' + ic('users') + '<br>Klik <b>Muat Penerima</b> untuk memilih sasaran.</div>'; sum.innerHTML = ''; est(); prev(); return; }
      const rows = NS.aud.rows, k = NS.kanal;
      rows.forEach((r) => { r.valid = k === 'WA' ? hpValid(r.hp) : emailValid(r.email); });
      const seen = {}; rows.forEach((r) => { const key = k === 'WA' ? hp08(r.hp) : String(r.email || '').toLowerCase(); r.ganda = r.valid && !!seen[key]; if (r.valid) seen[key] = 1; });
      const c = { total: rows.length, valid: rows.filter((r) => r.valid && !r.ganda).length, tidak: rows.filter((r) => !r.valid).length, ganda: rows.filter((r) => r.ganda).length, opt: rows.filter((r) => r.optOut).length, wa: rows.filter((r) => r.statusWA === 'Terdaftar').length, nowa: rows.filter((r) => r.statusWA === 'Tidak Terdaftar').length };
      sum.innerHTML = '<span class="chip">' + c.total + ' total</span><span class="chip green">' + c.valid + ' valid</span><span class="chip red">' + c.tidak + ' tidak valid</span><span class="chip amber">' + c.ganda + ' ganda</span><span class="chip">' + c.opt + ' opt-out</span>' + (k === 'WA' ? '<span class="wa-badge ya">✓ ' + c.wa + ' WA</span><span class="wa-badge tidak">✕ ' + c.nowa + ' bukan WA</span>' : '');
      host.innerHTML = '';
      table(host, { rows, per: 10, mobileCards: false, placeholder: 'Cari penerima…', search: (r) => r.nama + ' ' + r.hp + ' ' + r.email,
        tools: '<button class="btn xs ghost" data-allsel>Pilih semua valid</button><button class="btn xs ghost" data-nosel>Kosongkan</button>',
        onTools: (tl) => { $('[data-allsel]', tl).onclick = () => { rows.forEach((r) => r.valid && !r.ganda && !r.optOut && NS.sel.add(r.id)); drawAud(); }; $('[data-nosel]', tl).onclick = () => { NS.sel.clear(); drawAud(); }; },
        cols: [{ k: 'c', t: '', sort: false, render: (r) => '<input type="checkbox" data-c="' + esc(r.id) + '" ' + (NS.sel.has(r.id) ? 'checked' : '') + ' ' + (!r.valid || r.ganda || r.optOut ? 'disabled' : '') + ' style="width:17px;height:17px;accent-color:var(--primary)">' },
          { k: 'nama', t: 'Nama', render: (r) => '<b class="semi">' + esc(r.nama || '—') + '</b>' + (r.optOut ? ' <span class="chip">opt-out</span>' : '') },
          { k: 'hp', t: k === 'WA' ? 'Nomor' : 'Email', render: (r) => '<span class="mono">' + esc(k === 'WA' ? hp08(r.hp) || '—' : r.email || '—') + '</span>' + (r.ganda ? ' <span class="chip amber">ganda</span>' : '') },
          { k: 'statusWA', t: 'WA', render: (r) => (r.statusWA === 'Terdaftar' ? '<span class="wa-badge ya">✓ WA</span>' : r.statusWA === 'Tidak Terdaftar' ? '<span class="wa-badge tidak">✕ bukan WA</span>' : '<span class="wa-badge belum">? belum dicek</span>') }],
        rowCls: (r) => (!r.valid || r.ganda || r.optOut ? 'dim' : ''),
        after: (tb) => $$('[data-c]', tb).forEach((cb) => (cb.onchange = () => { cb.checked ? NS.sel.add(cb.dataset.c) : NS.sel.delete(cb.dataset.c); est(); prev(); })) });
      est(); prev();
    }
    $('[data-load]', body).onclick = async (e) => {
      busy(e.target.closest('button,.btn'), true, 'Memuat…');
      const r = await api('wa.audience', { sumber: $('#audSrc', body).value, segmen: $('#audSeg', body).value, jenis: $('#audJenis', body).value, manual: $('#audManual', body).value, kanal: NS.kanal });
      busy(e.target.closest('button,.btn'), false);
      if (!r.success) return toast(r.message, 'error');
      NS.aud = r.data; NS.sel = new Set(r.data.rows.filter((x) => x.valid && !x.ganda && !x.optOut).map((x) => x.id)); drawAud();
    };
    $('[data-detect]', body).onclick = async (e) => {
      if (!NS.aud) return toast('Muat penerima dulu.', 'warn');
      const nomor = [...new Set(NS.aud.rows.filter((r) => hpValid(r.hp) && !r.statusWA).map((r) => hp08(r.hp)))];
      if (!nomor.length) return toast('Semua nomor sudah dicek.', 'info');
      const btn = e.target.closest('button,.btn'); busy(btn, true, 'Mengecek…');
      for (let i = 0; i < nomor.length; i += 50) {
        $('#detProg', body).textContent = 'Mengecek ' + Math.min(i + 50, nomor.length) + '/' + nomor.length;
        const r = await api('wa.validate', { nomor: nomor.slice(i, i + 50) });
        if (!r.success) { toast(r.message, 'error'); break; }
        NS.aud.rows.forEach((x) => { const s = r.data.hasil[hp08(x.hp)]; if (s) x.statusWA = s; });
        drawAud();
      }
      busy(btn, false); $('#detProg', body).textContent = '';
    };
    $('[data-start]', body).onclick = async (e) => {
      const list = penerima(), pesan = ta.value.trim();
      if (!list.length) return toast('Belum ada penerima valid yang dipilih.', 'error');
      if (pesan.length < 3) return toast('Tulis isi pesan.', 'error');
      if (!/^\d{1,3}(-\d{1,3})?$/.test(String(NS.jeda))) return toast('Format jeda: 5 atau 3-8.', 'error');
      if (!(await confirmDlg('Mulai blast?', 'Pesan akan dikirim ke <b>' + list.length + '</b> penerima via ' + (NS.kanal === 'WA' ? 'WhatsApp' : 'Email') + ' dalam gelombang ' + NS.batch + '. Server tetap mengirim 1 gelombang/menit walau halaman ditutup.', { ok: 'Mulai Blast' }))) return;
      busy(e.target.closest('button,.btn'), true, 'Membuat blast…');
      const r = await api('wa.blastCreate', { judul: $('#bJudul', body).value, pesan, kanal: NS.kanal, ukuranBatch: NS.batch, jeda: NS.jeda, hanyaTerdaftar: NS.hanyaWA, sasaran: $('#audSrc', body).selectedOptions[0].text + ($('#audSeg', body).value ? ' · ' + $('#audSeg', body).value : '') + ($('#audJenis', body).value ? ' · ' + $('#audJenis', body).value : ''),
        penerima: list.map((x) => ({ id: x.id, nama: x.nama, hp: x.hp, email: x.email, statusWA: x.statusWA, vars: x.vars })) });
      busy(e.target.closest('button,.btn'), false);
      if (!r.success) return toast(r.message, 'error');
      toast(r.message); NS.blast = r.data; drawActive(); loadHist(true);
      processNext();
    };
    function drawActive() {
      const host = $('#blastActive', body), b = NS.blast;
      if (!host) return;
      if (!b) { host.innerHTML = '<div class="card-h"><h3>Blast Aktif</h3></div><div class="empty">Tidak ada blast yang sedang dipantau.</div>'; return; }
      host.innerHTML = '<div class="card-h"><div><h3>' + esc(b.judul) + '</h3><div class="sub">' + esc(b.kanal) + ' · gelombang ' + b.ukuran_batch + ' · jeda ' + esc(b.jeda_detik) + ' dtk</div></div>' + statusChip(b.status) + '</div>' + K.progress(b.persen, b.status === 'Selesai' ? 'green' : '') +
        '<div class="row between small mt8"><span><b style="color:var(--green-ink)">' + b.terkirim + '</b> terkirim · <b style="color:var(--red-ink)">' + b.gagal + '</b> gagal · ' + b.sisa + ' sisa</span><b>' + b.persen + '%</b></div>' +
        (b.status === 'Berjalan' ? '<div class="row wrap mt12"><button class="btn sm" data-next>' + ic('play') + 'Kirim Gelombang Berikutnya</button><label class="switch"><input type="checkbox" data-auto ' + (NS.auto ? 'checked' : '') + '><span class="tr"></span>Otomatis <span class="small muted" id="cd"></span></label><button class="btn sm danger" data-stop>' + ic('square-stop') + 'Hentikan</button></div><div class="xs muted mt8">Server tetap mengirim 1 gelombang/menit walau halaman ditutup.</div>' : '');
      const nx = $('[data-next]', host); if (nx) nx.onclick = () => processNext(nx);
      const au = $('[data-auto]', host); if (au) au.onchange = () => { NS.auto = au.checked; if (NS.auto) scheduleAuto(); else clearTimeout(NS.timer); };
      const sp = $('[data-stop]', host); if (sp) sp.onclick = async () => {
        if (!(await confirmDlg('Hentikan blast?', 'Sisa pesan yang belum terkirim akan dibatalkan.', { danger: true, ok: 'Hentikan' }))) return;
        const r = await api('wa.blastStop', { blastId: b.blast_id }); if (r.success) { NS.blast = r.data; NS.auto = false; clearTimeout(NS.timer); drawActive(); loadHist(true); toast(r.message); } else toast(r.message, 'error');
      };
    }
    async function processNext(btn) {
      if (!NS.blast || NS.blast.status !== 'Berjalan') return;
      if (btn) busy(btn, true, 'Mengirim…');
      const r = await api('wa.blastProcess', { blastId: NS.blast.blast_id }, { timeout: 300000 });
      if (btn) busy(btn, false);
      if (!r.success) { toast(r.message, 'error'); return; }
      NS.blast = r.data; drawActive();
      if (NS.blast.status !== 'Berjalan') { NS.auto = false; toast('Blast selesai: ' + NS.blast.terkirim + ' terkirim, ' + NS.blast.gagal + ' gagal.'); loadHist(true); }
      else if (NS.auto) scheduleAuto();
    }
    function scheduleAuto() {
      clearTimeout(NS.timer);
      if (!NS.blast || !NS.auto) return;
      const j = String(NS.blast.jeda_detik || '5').split('-').map(Number), avg = j.length > 1 ? (j[0] + j[1]) / 2 : j[0];
      let s = Math.max(30, Math.round(Number(NS.blast.ukuran_batch) * avg));
      const tick = () => { const cd = $('#cd', body); if (!cd || !NS.auto || S.page !== 'notif') return; cd.textContent = '(' + s + ' dtk)'; if (s-- <= 0) return processNext(); NS.timer = setTimeout(tick, 1000); };
      tick();
    }
    async function loadHist(force) {
      if (force) Store.del(userKey('a:blasts'));
      loadSwr('blasts', 'wa.blastList', {}, (list, c, err) => {
        const h = $('#blHist', body); if (!h) return;
        if (!list) { h.innerHTML = '<div class="alert err">' + esc(err || 'Gagal memuat.') + '</div>'; return; }
        if (!NS.blast) { const run = list.find((x) => x.status === 'Berjalan'); if (run) { NS.blast = run; drawActive(); } }
        h.innerHTML = '';
        table(h, { rows: list, per: 8, empty: 'Belum ada blast.',
          cols: [{ k: 'tanggal', t: 'Waktu', render: (b) => esc(fmtWaktu(b.tanggal)) }, { k: 'judul', t: 'Judul', render: (b) => '<b class="semi">' + esc(b.judul) + '</b><div class="xs muted">' + esc(b.sasaran || '') + ' · ' + esc(b.dibuat_oleh || '') + '</div>' },
            { k: 'kanal', t: 'Kanal' }, { k: 'gel', t: 'Gelombang·Jeda', sort: false, render: (b) => b.ukuran_batch + ' · ' + esc(b.jeda_detik) + 's' },
            { k: 'persen', t: 'Progres', render: (b) => '<div style="min-width:120px">' + K.progress(b.persen, b.status === 'Selesai' ? 'green' : '') + '<span class="xs muted">' + b.terkirim + '/' + b.total + (Number(b.gagal) ? ' · ' + b.gagal + ' gagal' : '') + '</span></div>' },
            { k: 'status', t: 'Status', render: (b) => statusChip(b.status) },
            { k: 'aksi', t: '', sort: false, render: (b) => (b.status === 'Berjalan' ? '<button class="btn xs soft" data-mon="' + b.blast_id + '">Pantau</button>' : '') }],
          after: (tb) => $$('[data-mon]', tb).forEach((x) => (x.onclick = () => { NS.blast = list.find((y) => y.blast_id === x.dataset.mon); drawActive(); window.scrollTo({ top: 0, behavior: 'smooth' }); })) });
      }, force ? 0 : 15000);
    }
    $('[data-refresh-bl]', body).onclick = () => loadHist(true);
    drawAud(); drawActive(); loadHist(false);
    if (NS.auto) scheduleAuto();
  }
  function tabAntrean(body) {
    const st = body._q || (body._q = { status: '', kanal: '', jenis: '' });
    body.innerHTML = '<div class="grid g4 keep2" id="qKpi"></div><div class="card mt20"><div class="row wrap between mb12"><div class="row wrap gap6"><select class="top-sel" data-f="status"><option value="">Semua status</option>' + ['Antri', 'Terkirim', 'Gagal', 'Batal'].map((x) => '<option ' + (st.status === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select><select class="top-sel" data-f="kanal"><option value="">Semua kanal</option><option ' + (st.kanal === 'WA' ? 'selected' : '') + '>WA</option><option ' + (st.kanal === 'EMAIL' ? 'selected' : '') + '>EMAIL</option></select><select class="top-sel" data-f="jenis"><option value="">Semua jenis</option>' + ['Reminder', 'Pengumuman', 'Penugasan', 'Blast', 'Sistem'].map((x) => '<option ' + (st.jenis === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
      '<div class="row gap6"><button class="btn sm" data-proc>' + ic('play') + 'Proses Sekarang</button>' + (D.isOp() ? '<button class="btn sm ghost" data-retry>' + ic('rotate-ccw') + 'Ulangi yang Gagal</button>' : '') + '</div></div><div id="qTbl"><div class="skel" style="height:160px"></div></div></div>';
    const load = (force) => {
      if (force) Store.del(userKey('a:queue'));
      loadSwr('queue', 'notif.queue', {}, (d, c, err) => {
        if (!$('#qTbl', body)) return;
        if (!d) { $('#qTbl', body).innerHTML = '<div class="alert err">' + esc(err || 'Gagal memuat.') + '</div>'; return; }
        $('#qKpi', body).innerHTML = [['Menunggu', d.ringkas.Antri, 'clock', 'amber'], ['Terkirim', d.ringkas.Terkirim, 'circle-check', 'green'], ['Gagal', d.ringkas.Gagal, 'triangle-alert', 'red'], ['Dibatalkan', d.ringkas.Batal, 'ban', '']].map((x) => '<div class="card kpi"><div><div class="lbl">' + x[0] + '</div><div class="stat mt8">' + x[1] + '</div><div class="xs muted">3.000 log terakhir</div></div><span class="ic ' + x[3] + '">' + ic(x[2]) + '</span></div>').join('');
        const rows = d.rows.filter((r) => (!st.status || r.status === st.status) && (!st.kanal || r.kanal === st.kanal) && (!st.jenis || r.jenis === st.jenis));
        $('#qTbl', body).innerHTML = '';
        table($('#qTbl', body), { rows, per: 20, placeholder: 'Cari tujuan / pesan…', search: (r) => r.tujuan + ' ' + r.nama_penerima + ' ' + r.pesan + ' ' + r.event,
          cols: [{ k: 'dibuat_pada', t: 'Waktu', render: (r) => '<span class="nowrap small">' + esc(fmtWaktu(r.waktu_kirim || r.dibuat_pada)) + '</span>' }, { k: 'kanal', t: 'Kanal', render: (r) => '<span class="chip ' + (r.kanal === 'WA' ? 'green' : 'amber') + '">' + esc(r.kanal) + '</span>' },
            { k: 'tujuan', t: 'Tujuan', render: (r) => '<b class="semi">' + esc(r.nama_penerima || '') + '</b><div class="xs mono muted">' + esc(r.tujuan) + '</div>' }, { k: 'event', t: 'Event', render: (r) => '<span class="xs">' + esc(r.jenis) + '</span><div class="xs muted">' + esc(r.event) + '</div>' },
            { k: 'pesan', t: 'Pesan', render: (r) => '<span class="small muted">' + esc(r.subjek ? r.subjek + ' — ' : '') + esc(String(r.pesan).slice(0, 90)) + '</span>' }, { k: 'status', t: 'Status', render: (r) => statusChip(r.status) + (r.respon && r.status !== 'Terkirim' ? '<div class="xs muted">' + esc(r.respon) + '</div>' : '') }] });
      }, force ? 0 : 10000);
    };
    $$('[data-f]', body).forEach((s) => (s.onchange = () => { st[s.dataset.f] = s.value; load(false); }));
    $('[data-proc]', body).onclick = async (e) => { busy(e.target.closest('button,.btn'), true, 'Memproses…'); const r = await api('notif.processNow', {}, { timeout: 300000 }); busy(e.target.closest('button,.btn'), false); toast(r.success ? 'Diproses: ' + (r.data.dikirim || 0) + ' terkirim' + (r.data.gagal ? ', ' + r.data.gagal + ' gagal' : '') + (r.data.info ? ' (' + r.data.info + ')' : '') : r.message, r.success ? 'success' : 'error'); load(true); };
    const rt = $('[data-retry]', body); if (rt) rt.onclick = async (e) => { busy(e.target.closest('button,.btn'), true); const r = await api('notif.retry', {}); busy(e.target.closest('button,.btn'), false); toast(r.message, r.success ? 'success' : 'error'); load(true); };
    load(false);
  }
  function tabConfig(body) {
    body._dirty = false; body._shown = false;
    if (!Store.get(userKey('a:notifcfg'), null)) body.innerHTML = '<div class="card"><div class="skel" style="height:260px"></div></div>';
    loadSwr('notifcfg', 'notif.config', {}, (c, fromCache, err) => {
      if (!c) { if (!body._shown) body.innerHTML = '<div class="card alert err">' + esc(err || 'Gagal memuat.') + '</div>'; return; }
      if (body._shown && body._dirty) return;                      // jangan timpa suntingan yang belum disimpan
      body._shown = true;
      const mat = JSON.parse(JSON.stringify(c.matriks));
      body.innerHTML = '<div class="grid g2"><div class="card"><div class="card-h"><div><h3 class="row gap6">' + ic('message-circle') + 'WhatsApp (Fonnte)</h3><div class="sub">Token disimpan di Script Properties — tidak pernah dikirim ke browser.</div></div></div>' +
        '<label class="switch" style="font-size:15px"><input type="checkbox" id="cWa" ' + (c.waAktif ? 'checked' : '') + '><span class="tr"></span>Notifikasi WhatsApp ' + (c.waAktif ? 'AKTIF' : 'NONAKTIF') + '</label>' +
        '<div class="field mt16"><label>Token Fonnte ' + (c.tokenAda ? '<span class="chip green">tersimpan</span>' : '<span class="chip red">kosong</span>') + '</label><input class="inp mono" id="cTok" type="password" placeholder="' + esc(c.tokenMask || 'Tempel token dari fonnte.com → Device') + '" autocomplete="off"><span class="hint">Kosongkan bila tidak diubah. ' + (c.tokenAda ? '<a href="#" data-deltok>Hapus token</a>' : '') + '</span></div>' +
        '<div class="row wrap mt12"><button class="btn sm ghost" data-dev>' + ic('smartphone') + 'Cek Perangkat</button><input class="inp" id="cTestWa" placeholder="08xxxxxxxxxx" style="max-width:170px"><button class="btn sm ghost" data-twa>' + ic('send') + 'Kirim Tes WA</button></div><div id="devInfo" class="mt8"></div>' +
        '<div class="form-grid mt16"><div class="field"><label>Gelombang default</label><select class="inp" id="cBatch">' + c.batchOpsi.map((n) => '<option ' + (n === c.batchDefault ? 'selected' : '') + '>' + n + '</option>').join('') + '</select></div><div class="field"><label>Jeda (detik)</label><input class="inp" id="cJeda" value="' + esc(c.jeda) + '"></div></div>' +
        '<label class="switch mt12"><input type="checkbox" id="cDet" ' + (c.deteksiOtomatis ? 'checked' : '') + '><span class="tr"></span>Deteksi otomatis nomor baru terdaftar WA (±10 menit)</label></div>' +
        '<div class="card"><div class="card-h"><div><h3 class="row gap6">' + ic('mail') + 'Email (Gmail)</h3><div class="sub">Sisa kuota hari ini: <b>' + (c.kuotaEmail == null ? '-' : c.kuotaEmail) + '</b> (Gmail biasa ±100/hari, Workspace ±1.500/hari)</div></div></div>' +
        '<label class="switch" style="font-size:15px"><input type="checkbox" id="cEm" ' + (c.emailAktif ? 'checked' : '') + '><span class="tr"></span>Notifikasi Email ' + (c.emailAktif ? 'AKTIF' : 'NONAKTIF') + '</label>' +
        '<div class="field mt16"><label>Nama pengirim</label><input class="inp" id="cNama" value="' + esc(c.namaPengirim) + '"></div><div class="field mt12"><label>URL aplikasi ({link})</label><input class="inp" id="cUrl" value="' + esc(c.appUrl || location.origin + location.pathname) + '"></div>' +
        '<div class="row wrap mt12"><input class="inp" id="cTestEm" placeholder="email tujuan" value="' + esc(S.me.email) + '" style="max-width:240px"><button class="btn sm ghost" data-tem>' + ic('send') + 'Kirim Tes Email</button></div>' +
        '<div class="tile row between mt16"><span>' + ic('clock') + ' Trigger antrean (1 menit)</span>' + statusChip(c.triggerAktif ? 'Aktif' : 'Nonaktif') + '</div></div></div>' +
        '<div class="card mt20"><div class="card-h"><div><h3>Matriks Notifikasi Otomatis</h3><div class="sub">Pilih kejadian mana dikirim via WA dan/atau Email, dan sesuaikan isi pesannya.</div></div></div><div class="tbl-wrap"><table class="tbl matrix"><thead><tr><th>Kejadian</th><th>WhatsApp</th><th>Email</th><th></th></tr></thead><tbody id="mx"></tbody></table></div>' +
        '<div class="row mt20"><button class="btn" data-save>' + ic('check') + 'Simpan Konfigurasi</button></div></div>';
      const drawMx = () => {
        $('#mx', body).innerHTML = mat.map((m, i) => '<tr><td><b class="semi">' + esc(m.label) + '</b><div class="xs mono muted">' + m.kode + '</div></td><td><label class="switch"><input type="checkbox" data-mw="' + i + '" ' + (m.wa ? 'checked' : '') + '><span class="tr"></span></label></td><td><label class="switch"><input type="checkbox" data-me="' + i + '" ' + (m.email ? 'checked' : '') + '><span class="tr"></span></label></td><td><button class="btn xs ghost" data-tpl="' + i + '">' + ic('pencil') + 'Ubah pesan</button></td></tr>' +
          '<tr data-row="' + i + '" hidden><td colspan="4"><div class="grid g2"><div class="col"><div class="field"><label>Subjek email</label><input class="inp" data-sj="' + i + '" value="' + esc(m.subjek) + '"></div><div class="field"><label>Isi pesan</label><textarea class="inp" data-ps="' + i + '" rows="6">' + esc(m.pesan) + '</textarea><span class="hint">Variabel: ' + (m.vars || []).concat(['app', 'institusi', 'link']).map((v) => '{' + v + '}').join(' ') + '</span></div><button class="btn xs text" data-reset="' + i + '">↺ Kembalikan bawaan</button></div><div class="wa-preview"><div class="wa-bubble" data-pv="' + i + '">' + previewMsg(m.pesan) + '</div></div></div></td></tr>').join('');
        $$('[data-mw]', body).forEach((x) => (x.onchange = () => (mat[x.dataset.mw].wa = x.checked)));
        $$('[data-me]', body).forEach((x) => (x.onchange = () => (mat[x.dataset.me].email = x.checked)));
        $$('[data-tpl]', body).forEach((x) => (x.onclick = () => { const r = $('[data-row="' + x.dataset.tpl + '"]', body); r.hidden = !r.hidden; }));
        $$('[data-sj]', body).forEach((x) => (x.oninput = () => (mat[x.dataset.sj].subjek = x.value)));
        $$('[data-ps]', body).forEach((x) => (x.oninput = () => { mat[x.dataset.ps].pesan = x.value; $('[data-pv="' + x.dataset.ps + '"]', body).innerHTML = previewMsg(x.value); }));
        $$('[data-reset]', body).forEach((x) => (x.onclick = () => { const m = mat[x.dataset.reset]; m.subjek = m.subjekDefault; m.pesan = m.pesanDefault; drawMx(); $('[data-row="' + x.dataset.reset + '"]', body).hidden = false; }));
      };
      drawMx();
      const tandai = () => (body._dirty = true);
      body.oninput = tandai; body.onchange = tandai;
      [['#cWa', 'Notifikasi WhatsApp '], ['#cEm', 'Notifikasi Email ']].forEach((x) => { const cb = $(x[0], body); cb.addEventListener('change', () => { cb.parentElement.lastChild.textContent = x[1] + (cb.checked ? 'AKTIF' : 'NONAKTIF'); }); });
      const dt = $('[data-deltok]', body); if (dt) dt.onclick = (e) => { e.preventDefault(); $('#cTok', body).value = '__HAPUS__'; toast('Token akan dihapus saat disimpan.', 'warn'); };
      $('[data-dev]', body).onclick = async (e) => { busy(e.target.closest('button,.btn'), true, 'Mengecek…'); const r = await api('wa.device', {}); busy(e.target.closest('button,.btn'), false); $('#devInfo', body).innerHTML = r.success ? '<div class="alert ' + (r.data.status === 'connect' ? 'ok' : 'warn') + '">' + ic('smartphone') + '<span>' + esc(r.data.device || '') + ' · <b>' + esc(r.data.status || '') + '</b> · paket ' + esc(r.data.paket || '-') + ' · kuota ' + esc(r.data.kuota || '-') + ' · s.d. ' + esc(r.data.kedaluwarsa || '-') + '</span></div>' : '<div class="alert err">' + esc(r.message) + '</div>'; };
      $('[data-twa]', body).onclick = async (e) => { busy(e.target.closest('button,.btn'), true, ''); const r = await api('wa.test', { nomor: $('#cTestWa', body).value }); busy(e.target.closest('button,.btn'), false); toast(r.message, r.success ? 'success' : 'error'); };
      $('[data-tem]', body).onclick = async (e) => { busy(e.target.closest('button,.btn'), true, ''); const r = await api('email.test', { email: $('#cTestEm', body).value }); busy(e.target.closest('button,.btn'), false); toast(r.message, r.success ? 'success' : 'error'); };
      $('[data-save]', body).onclick = async (e) => {
        busy(e.target.closest('button,.btn'), true, 'Menyimpan…');
        const r = await api('notif.configSave', { token: $('#cTok', body).value.trim(), waAktif: $('#cWa', body).checked, emailAktif: $('#cEm', body).checked, batchDefault: Number($('#cBatch', body).value), jeda: $('#cJeda', body).value.trim(), deteksiOtomatis: $('#cDet', body).checked, namaPengirim: $('#cNama', body).value, appUrl: $('#cUrl', body).value, matriks: mat });
        busy(e.target.closest('button,.btn'), false);
        if (!r.success) return toast(r.message, 'error');
        Store.set(userKey('a:notifcfg'), { t: Date.now(), data: r.data });
        S.boot.g.settings.NOTIF_WA_AKTIF = r.data.waAktif ? 'YA' : 'TIDAK'; S.boot.g.settings.NOTIF_EMAIL_AKTIF = r.data.emailAktif ? 'YA' : 'TIDAK';
        toast('Konfigurasi notifikasi disimpan.'); K.scheduleRefresh(); body._dirty = false; K.rerender(true);
      };
    }, 20000);
  }

  // ============================================================== CRM KONTAK
  const CS = { f: { cari: '', segmen: '', statusWA: '', optOut: false, duplikat: false, emailValid: '', tag: '' }, sel: new Set(), data: null };
  K.registerPage('crm', {
    auth: 'admin', title: 'CRM Kontak', selfManaged: true,
    show(el) {
      el.innerHTML = '<div class="page-h"><div><h1>CRM Kontak</h1><div class="sub">Satu layar untuk memantau Nama · Email · WhatsApp seluruh mahasiswa, pendaftar, pengurus, dosen, dan kontak luar — lalu langsung dipakai untuk blast.</div></div>' +
        '<div class="row wrap"><span class="small muted" id="syncInfo"></span><button class="btn ghost" data-sync>' + ic('refresh-cw') + 'Sinkron Sekarang</button><button class="btn ghost" data-imp>' + ic('upload') + 'Import CSV</button><button class="btn ghost" data-dup>' + ic('merge') + 'Periksa Duplikat</button>' + (D.isOp() ? '<button class="btn ghost" data-exp>' + ic('download') + 'Ekspor</button>' : '') + '</div></div>' +
        '<div class="grid g3" id="crmKpi"></div><div class="card mt20"><div class="row wrap gap6 mb12" id="segChips"></div><div class="row wrap gap6 mb12"><div class="searchbox" style="max-width:320px">' + ic('search') + '<input id="crmQ" placeholder="Cari nama, email, nomor…" value="' + esc(CS.f.cari) + '" style="height:40px;background:#fff;border:1px solid var(--line)"></div>' +
        '<select class="top-sel" data-cf="statusWA"><option value="">Status WA: semua</option><option value="Terdaftar">✓ Terdaftar WA</option><option value="Tidak Terdaftar">✕ Bukan WA</option><option value="Belum">? Belum dicek</option></select><select class="top-sel" data-cf="emailValid"><option value="">Email: semua</option><option value="YA">Email valid</option><option value="TIDAK">Email tidak valid</option></select>' +
        '<label class="check"><input type="checkbox" data-cb="optOut">Opt-out</label><label class="check"><input type="checkbox" data-cb="duplikat">Duplikat</label></div><div id="bulkBar"></div><div id="crmTbl"><div class="skel" style="height:240px"></div></div></div>';
      const load = (force) => {
        if (force) Store.del(userKey('a:crm'));
        loadSwr('crm', 'crm.list', { per: 0 }, (d, c, err) => { if (!d) { $('#crmTbl', el).innerHTML = '<div class="alert err">' + esc(err || 'Gagal memuat.') + '</div>'; return; } CS.data = d; draw(); }, force ? 0 : 30000);
      };
      const draw = () => {
        const d = CS.data; if (!d || !$('#crmTbl', el)) return;
        const all = d.rows, f = CS.f, q = f.cari.toLowerCase();
        const rows = all.filter((k) => (!q || (k.nama + ' ' + k.email + ' ' + k.no_wa).toLowerCase().indexOf(q) > -1) && (!f.segmen || k.segmen === f.segmen) && (!f.tag || String(k.tag || '').split(',').indexOf(f.tag) > -1) &&
          (!f.statusWA || (f.statusWA === 'Belum' ? !k.status_wa : k.status_wa === f.statusWA)) && (!f.optOut || k.opt_out === 'YA') && (!f.duplikat || k.duplikat) && (!f.emailValid || k.email_valid === f.emailValid));
        const s = { total: all.length, wa: all.filter((k) => k.status_wa === 'Terdaftar').length, em: all.filter((k) => k.email_valid === 'YA').length, belum: all.filter((k) => hpValid(k.no_wa) && !k.status_wa).length, opt: all.filter((k) => k.opt_out === 'YA').length, dup: all.filter((k) => k.duplikat).length };
        $('#crmKpi', el).innerHTML = [['Total Kontak', s.total, 'contact', '', () => Object.assign(f, { statusWA: '', optOut: false, duplikat: false, emailValid: '', segmen: '' })], ['WA Terverifikasi', s.wa, 'smartphone', 'green', () => (f.statusWA = 'Terdaftar')], ['Email Valid', s.em, 'mail', '', () => (f.emailValid = 'YA')], ['Belum Dicek WA', s.belum, 'circle-help', 'amber', () => (f.statusWA = 'Belum')], ['Opt-out', s.opt, 'ban', 'red', () => (f.optOut = true)], ['Duplikat', s.dup, 'merge', 'amber', () => (f.duplikat = true)]]
          .map((x, i) => '<div class="card kpi kpi-click" data-k="' + i + '"><div><div class="lbl">' + x[0] + '</div><div class="stat mt8">' + x[1] + '</div></div><span class="ic ' + x[3] + '">' + ic(x[2]) + '</span></div>').join('');
        const acts = [() => Object.assign(f, { statusWA: '', optOut: false, duplikat: false, emailValid: '', segmen: '' }), () => (f.statusWA = 'Terdaftar'), () => (f.emailValid = 'YA'), () => (f.statusWA = 'Belum'), () => (f.optOut = true), () => (f.duplikat = true)];
        $$('[data-k]', el).forEach((c) => (c.onclick = () => { acts[+c.dataset.k](); syncFilterUi(); draw(); }));
        $('#segChips', el).innerHTML = '<button class="tab ' + (!f.segmen ? 'active' : '') + '" data-seg="">Semua <span class="n">' + all.length + '</span></button>' + Object.keys(d.facet.segmen).map((sg) => '<button class="tab ' + (f.segmen === sg ? 'active' : '') + '" data-seg="' + esc(sg) + '">' + esc(sg) + ' <span class="n">' + d.facet.segmen[sg] + '</span></button>').join('') +
          Object.keys(d.facet.tag).map((t) => '<button class="tab ' + (f.tag === t ? 'active' : '') + '" data-tag="' + esc(t) + '">' + ic('tag') + esc(t) + ' <span class="n">' + d.facet.tag[t] + '</span></button>').join('');
        $$('[data-seg]', el).forEach((b) => (b.onclick = () => { f.segmen = b.dataset.seg; draw(); }));
        $$('[data-tag]', el).forEach((b) => (b.onclick = () => { f.tag = f.tag === b.dataset.tag ? '' : b.dataset.tag; draw(); }));
        $('#syncInfo', el).textContent = d.syncTerakhir ? 'Sinkron ' + fmtRel(new Date(d.syncTerakhir).toISOString()) : '';
        drawBulk();
        const host = $('#crmTbl', el); host.innerHTML = '';
        table(host, { rows, per: 50, mobileCards: true,
          cols: [{ k: 'c', t: '', sort: false, render: (k) => '<input type="checkbox" data-ck="' + k.kontak_id + '" ' + (CS.sel.has(k.kontak_id) ? 'checked' : '') + ' style="width:17px;height:17px;accent-color:var(--primary)">' },
            { k: 'nama', t: 'Kontak', render: (k) => '<div class="person">' + avatar(k.nama, 'sm') + '<div class="t"><b>' + esc(k.nama || '—') + '</b><span><span class="chip">' + esc(k.segmen) + '</span> ' + (k.info && k.info.jenis_mahasiswa ? chipJenis(k.info.jenis_mahasiswa) : '') + '</span></div></div>' },
            { k: 'email', t: 'Email', render: (k) => (k.email ? '<span class="small">' + esc(k.email) + '</span> ' + (k.email_valid === 'YA' ? '<span style="color:var(--green-ink)">✓</span>' : '<span style="color:var(--amber-ink)">⚠</span>') : '<span class="faint">—</span>') },
            { k: 'no_wa', t: 'WhatsApp', render: (k) => (k.no_wa ? '<span class="mono">' + esc(k.no_wa) + '</span> ' + (k.status_wa === 'Terdaftar' ? '<span class="wa-badge ya">✓ WA</span>' : k.status_wa === 'Tidak Terdaftar' ? '<span class="wa-badge tidak">✕</span>' : '<span class="wa-badge belum">?</span>') : '<span class="faint">—</span>') },
            { k: 'tag', t: 'Tag', render: (k) => String(k.tag || '').split(',').filter(Boolean).map((t) => '<span class="chip blue">' + esc(t) + '</span>').join(' ') + (k.opt_out === 'YA' ? ' <span class="chip red">opt-out</span>' : '') },
            { k: 'terakhir_dihubungi', t: 'Terakhir Dihubungi', render: (k) => (k.terakhir_dihubungi ? fmtRel(k.terakhir_dihubungi) : '<span class="faint">belum</span>') },
            { k: 'jumlah_pesan', t: 'Pesan', sortVal: (k) => Number(k.jumlah_pesan || 0) },
            { k: 'aksi', t: '', sort: false, render: (k) => '<button class="btn xs ghost" data-det="' + k.kontak_id + '">Detail</button>' }],
          rowCls: (k) => (k.duplikat || (!hpValid(k.no_wa) && k.email_valid !== 'YA') || k.email_valid === 'TIDAK' ? 'warn' : ''),
          after: (tb) => {
            $$('[data-ck]', tb).forEach((c) => (c.onchange = () => { c.checked ? CS.sel.add(c.dataset.ck) : CS.sel.delete(c.dataset.ck); drawBulk(); }));
            $$('[data-det]', tb).forEach((b) => (b.onclick = () => crmDrawer(b.dataset.det, () => load(true))));
          } });
      };
      const drawBulk = () => {
        const n = CS.sel.size, bar = $('#bulkBar', el); if (!bar) return;
        bar.innerHTML = n ? '<div class="tile row wrap mb12" style="background:var(--primary-soft)"><b>' + n + ' dipilih</b><button class="btn xs ghost" data-b="wa">' + ic('smartphone') + 'Deteksi WA</button><button class="btn xs ghost" data-b="tag">' + ic('tag') + 'Beri Tag</button><button class="btn xs ghost" data-b="untag">Hapus Tag</button><button class="btn xs" data-b="blast">' + ic('megaphone') + 'Blast ke Terpilih</button><button class="btn xs ghost" data-b="optout">' + ic('ban') + 'Opt-out</button><button class="btn xs ghost" data-b="optin">Opt-in</button><button class="btn xs text" data-b="clear">Batal pilih</button></div>' : '';
        $$('[data-b]', bar).forEach((b) => (b.onclick = () => bulk(b.dataset.b, b)));
      };
      const bulk = async (aksi, btn) => {
        const ids = [...CS.sel], rows = CS.data.rows.filter((k) => CS.sel.has(k.kontak_id));
        if (aksi === 'clear') { CS.sel.clear(); return draw(); }
        if (aksi === 'blast') return K.blastPrefill(rows.map((k) => ({ id: k.kontak_id, nama: k.nama, hp: k.no_wa, email: k.email, statusWA: k.status_wa, optOut: k.opt_out === 'YA', vars: { nim: (k.info || {}).nim || '', jenis: (k.info || {}).jenis_mahasiswa || '' } })));
        if (aksi === 'wa') {
          const nomor = [...new Set(rows.filter((k) => hpValid(k.no_wa)).map((k) => k.no_wa))]; busy(btn, true, '');
          for (let i = 0; i < nomor.length; i += 50) { const r = await api('wa.validate', { nomor: nomor.slice(i, i + 50) }); if (!r.success) { toast(r.message, 'error'); break; } CS.data.rows.forEach((k) => { const s = r.data.hasil[k.no_wa]; if (s) k.status_wa = s; }); }
          busy(btn, false); draw(); return toast('Deteksi WA selesai.');
        }
        let nilai = '';
        if (aksi === 'tag' || aksi === 'untag') { nilai = prompt(aksi === 'tag' ? 'Nama tag:' : 'Tag yang dihapus:') || ''; nilai = nilai.trim(); if (!nilai) return; }
        const prev = rows.map((k) => ({ k, tag: k.tag, opt: k.opt_out }));
        const r = await mutate('crm.bulk', { ids, aksi, nilai }, { refresh: false,
          optimistic: () => rows.forEach((k) => { const t = String(k.tag || '').split(',').filter(Boolean); if (aksi === 'tag' && t.indexOf(nilai) < 0) t.push(nilai); if (aksi === 'untag') t.splice(t.indexOf(nilai), t.indexOf(nilai) > -1 ? 1 : 0); k.tag = t.join(','); if (aksi === 'optout') k.opt_out = 'YA'; if (aksi === 'optin') k.opt_out = 'TIDAK'; }),
          rollback: () => prev.forEach((p) => { p.k.tag = p.tag; p.k.opt_out = p.opt; }) });
        draw(); if (r.success) Store.del(userKey('a:crm'));
      };
      const syncFilterUi = () => { $$('[data-cf]', el).forEach((s) => (s.value = CS.f[s.dataset.cf] || '')); $$('[data-cb]', el).forEach((c) => (c.checked = !!CS.f[c.dataset.cb])); };
      syncFilterUi();
      $('#crmQ', el).oninput = K.debounce((e) => { CS.f.cari = e.target.value; draw(); }, 300);
      $$('[data-cf]', el).forEach((s) => (s.onchange = () => { CS.f[s.dataset.cf] = s.value; draw(); }));
      $$('[data-cb]', el).forEach((c) => (c.onchange = () => { CS.f[c.dataset.cb] = c.checked; draw(); }));
      $('[data-sync]', el).onclick = async (e) => { busy(e.target.closest('button,.btn'), true, 'Sinkron…'); const r = await api('crm.sync', {}); busy(e.target.closest('button,.btn'), false); toast(r.message, r.success ? 'success' : 'error'); load(true); };
      $('[data-imp]', el).onclick = () => crmImport(() => load(true));
      $('[data-dup]', el).onclick = () => crmDup(() => load(true));
      const ex = $('[data-exp]', el); if (ex) ex.onclick = async (e) => { busy(e.target.closest('button,.btn'), true, ''); const r = await api('crm.export', {}); busy(e.target.closest('button,.btn'), false); if (!r.success) return toast(r.message, 'error'); K.exportXlsx('CRM Kontak SIM KULIAH', { Kontak: r.data }).catch((er) => toast(er.message, 'error')); };
      load(false);
    }
  });
  async function crmDrawer(id, reload) {
    const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.style.justifyContent = 'flex-end'; bg.style.padding = '0';
    bg.innerHTML = '<div class="drawer"><div class="modal-h"><div class="grow"><h3>Detail Kontak</h3></div><button class="btn icon ghost" data-x>' + ic('x') + '</button></div><div class="drawer-b"><div class="skel" style="height:300px"></div></div></div>';
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    const r = await api('crm.detail', { kontakId: id });
    const b = $('.drawer-b', bg);
    if (!r.success) { b.innerHTML = '<div class="alert err">' + esc(r.message) + '</div>'; return; }
    const k = r.data.kontak;
    b.innerHTML = '<div class="row" style="gap:14px">' + avatar(k.nama, 'lg') + '<div><h2 style="font-size:20px">' + esc(k.nama) + '</h2><div class="row wrap gap6 mt8"><span class="chip">' + esc(k.segmen) + '</span><span class="chip">' + esc(k.sumber) + ':' + esc(k.ref_id) + '</span></div></div></div>' +
      '<div class="form-grid mt20"><div class="field"><label>Nama</label><input class="inp" name="nama" value="' + esc(k.nama) + '"></div><div class="field"><label>No WhatsApp</label><input class="inp" name="no_wa" value="' + esc(k.no_wa) + '"></div><div class="field full"><label>Email</label><input class="inp" name="email" value="' + esc(k.email) + '"></div>' +
      '<div class="field full"><label>Tag (pisahkan koma)</label><input class="inp" name="tag" value="' + esc(k.tag) + '"></div><div class="field full"><label>Catatan</label><textarea class="inp" name="catatan" rows="3">' + esc(k.catatan) + '</textarea></div>' +
      '<label class="switch"><input type="checkbox" name="opt_out" ' + (k.opt_out === 'YA' ? 'checked' : '') + '><span class="tr"></span>Opt-out (tidak menerima blast)</label></div>' +
      '<div class="row wrap mt12"><button class="btn sm" data-save>' + ic('check') + 'Simpan</button><button class="btn sm ghost" data-copy>' + ic('copy') + 'Salin nomor</button><a class="btn sm ghost" href="mailto:' + esc(k.email) + '">' + ic('mail') + 'Email</a></div>' +
      (k.sumber !== 'manual' ? '<div class="xs muted mt8">Perubahan Nama/Email/No WA ditulis balik ke data ' + esc(k.sumber) + ' (satu sumber kebenaran).</div>' : '') +
      '<div class="sec-t">Catat Interaksi</div><div class="row wrap gap6"><select class="inp" id="iK" style="width:auto">' + ['Telepon', 'WA Manual', 'Kunjungan', 'Email Manual', 'Catatan'].map((x) => '<option>' + x + '</option>').join('') + '</select><input class="inp grow" id="iR" placeholder="Ringkasan…" style="flex:1;min-width:160px"><button class="btn sm soft" data-int>Catat</button></div>' +
      '<div class="sec-t">Timeline Interaksi</div><div id="tl">' + (r.data.timeline.length ? r.data.timeline.map((t) => '<div class="tl-msg"><div class="row between xs"><b>' + esc(t.kanal) + (t.otomatis ? ' · ' + esc(t.event || 'otomatis') : ' · ' + esc(t.oleh || '')) + '</b><span class="faint">' + esc(fmtWaktu(t.tanggal)) + '</span></div><div class="small mt8">' + esc(t.ringkasan) + '</div>' + (t.status ? '<div class="mt8">' + statusChip(t.status) + '</div>' : '') + '</div>').join('') : '<div class="empty">Belum ada interaksi.</div>') + '</div>';
    $('[data-copy]', b).onclick = () => navigator.clipboard.writeText(k.no_wa).then(() => toast('Nomor disalin.'));
    $('[data-save]', b).onclick = async (e) => {
      const fd = formData(b); busy(e.target.closest('button,.btn'), true);
      const x = await api('crm.save', { kontak_id: k.kontak_id, nama: fd.nama, no_wa: fd.no_wa, email: fd.email, tag: fd.tag, catatan: fd.catatan, opt_out: fd.opt_out });
      busy(e.target.closest('button,.btn'), false); toast(x.message, x.success ? 'success' : 'error'); if (x.success) { reload(); K.scheduleRefresh(); }
    };
    $('[data-int]', b).onclick = async (e) => {
      const ring = $('#iR', b).value.trim(); if (!ring) return toast('Isi ringkasan.', 'error');
      busy(e.target.closest('button,.btn'), true, ''); const x = await api('crm.interaksi', { kontakId: k.kontak_id, kanal: $('#iK', b).value, ringkasan: ring }); busy(e.target.closest('button,.btn'), false);
      if (!x.success) return toast(x.message, 'error');
      $('#tl', b).insertAdjacentHTML('afterbegin', '<div class="tl-msg"><div class="row between xs"><b>' + esc(x.data.kanal) + ' · ' + esc(x.data.oleh) + '</b><span class="faint">baru saja</span></div><div class="small mt8">' + esc(ring) + '</div></div>');
      $('#iR', b).value = ''; toast('Interaksi dicatat.'); reload();
    };
  }
  function crmImport(reload) {
    let rows = [];
    const md = modal({ title: 'Import Kontak (CSV/Excel)', sub: 'Untuk kontak di luar aplikasi: calon mahasiswa, peserta seminar, alumni. Kolom: nama, wa, email, segmen, tag.', icon: 'upload', size: 'lg',
      body: '<div class="row between mb12"><span class="small muted">Dedupe otomatis berdasarkan nomor WA / email.</span><button class="btn sm ghost" data-tpl>' + ic('download') + 'Template CSV</button></div><label class="dropzone" data-dz3><input type="file" accept=".csv,.xlsx,.xls" hidden>' + ic('cloud-upload') + '<div class="semi mt8">Pilih berkas kontak</div></label><div id="ciPrev" class="mt12"></div>',
      foot: '<button class="btn ghost" data-close>Batal</button><button class="btn" data-go disabled>Import</button>' });
    $('[data-tpl]', md.el).onclick = () => saveCsv('Template_Kontak_CRM', [{ nama: 'Calon Mahasiswa', wa: '081299991111', email: 'calon@gmail.com', segmen: 'Calon Mahasiswa', tag: 'Seminar Okt' }]);
    const inp = $('[data-dz3] input', md.el);
    inp.onchange = async () => {
      try {
        const raw = await K.parseSheetFile(inp.files[0]);
        rows = raw.map((r) => { const o = {}; Object.keys(r).forEach((k) => (o[normKey(k)] = String(r[k]).trim())); return { nama: o.nama || o.name || '', wa: o.wa || o.whatsapp || o.nohp || o.hp || '', email: o.email || '', segmen: o.segmen || '', tag: o.tag || '' }; });
        $('#ciPrev', md.el).innerHTML = '<div class="alert info">' + ic('info') + '<span>' + rows.length + ' baris terbaca · ' + rows.filter((r) => hpValid(r.wa) || emailValid(r.email)).length + ' dapat dihubungi.</span></div>';
        $('[data-go]', md.el).disabled = !rows.length;
      } catch (e) { toast(e.message, 'error'); }
    };
    $('[data-go]', md.el).onclick = async (e) => { busy(e.target.closest('button,.btn'), true, 'Mengimpor…'); const r = await api('crm.import', { rows }); busy(e.target.closest('button,.btn'), false); toast(r.message, r.success ? 'success' : 'error'); if (r.success) { md.close(); reload(); } };
  }
  async function crmDup(reload) {
    const md = modal({ title: 'Periksa Duplikat', sub: 'Kontak dengan nomor WA atau email yang sama', icon: 'merge', size: 'lg', body: '<div class="skel" style="height:160px"></div>', foot: '<button class="btn ghost" data-close>Tutup</button>' });
    const r = await api('crm.duplikat', {});
    if (!r.success) { md.body.innerHTML = '<div class="alert err">' + esc(r.message) + '</div>'; return; }
    md.body.innerHTML = r.data.length ? r.data.map((g, i) => '<div class="tile mb12"><div class="row between"><b>' + esc(g.jenis) + ': <span class="mono">' + esc(g.kunci) + '</span></b><button class="btn xs" data-merge="' + i + '">' + ic('merge') + 'Gabungkan</button></div>' + g.kontak.map((k, j) => '<label class="row mt8 small"><input type="radio" name="u' + i + '" value="' + k.kontak_id + '" ' + (j === 0 ? 'checked' : '') + '><b>' + esc(k.nama) + '</b><span class="chip">' + esc(k.segmen) + '</span><span class="muted">' + esc(k.email || '') + ' ' + esc(k.no_wa || '') + '</span></label>').join('') + '<div class="xs muted mt8">Pilih kontak utama; lainnya digabung (tag, catatan, riwayat).</div></div>').join('')
      : '<div class="empty">' + ic('circle-check') + '<br>Tidak ada duplikat.</div>';
    $$('[data-merge]', md.el).forEach((b) => (b.onclick = async () => {
      const g = r.data[+b.dataset.merge], utama = $('input[name=u' + b.dataset.merge + ']:checked', md.el).value;
      busy(b, true, ''); const x = await api('crm.merge', { utama, gabung: g.kontak.map((k) => k.kontak_id).filter((id) => id !== utama) }); busy(b, false);
      toast(x.message, x.success ? 'success' : 'error'); if (x.success) { b.closest('.tile').remove(); reload(); }
    }));
  }

  window.SIMK_ADMIN_LOADED = true;
})();
