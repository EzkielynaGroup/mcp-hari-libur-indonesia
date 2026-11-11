// End-to-end tests: the MCP server spawned over stdio (no network needed at all), plus checks of the bundled SKB data
// and a brute-force cross-check of the working-day math against an independent implementation.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'mcp-hari-libur-indonesia.mjs');
const SOURCE = fs.readFileSync(SERVER, 'utf8');
const DATA = JSON.parse(SOURCE.split('// BEGIN HOLIDAY DATA (JSON)\nconst HOLIDAY_DATA = ')[1].split(';\n// END HOLIDAY DATA (JSON)')[0]);

const children = new Set();
after(() => { for (const c of children) c.kill(); }); // a failed assertion must not leave a server running

function startMcp(extraEnv = {}) {
  const child = spawn(process.execPath, [SERVER], { env: { PATH: process.env.PATH, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
  children.add(child);
  child.on('close', () => children.delete(child));
  let buf = '';
  let stderr = '';
  let nextId = 1;
  const waiting = new Map();
  child.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      const msg = JSON.parse(line); // every stdout line must be JSON-RPC
      waiting.get(msg.id)?.(msg);
      waiting.delete(msg.id);
    }
  });
  child.stderr.on('data', d => { stderr += d; });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 10000);
    waiting.set(id, m => { clearTimeout(t); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const raw = line => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for raw')), 5000);
    waiting.set(null, m => { clearTimeout(t); resolve(m); });
    child.stdin.write(line + '\n');
  });
  const call = async (name, args) => (await request('tools/call', { name, arguments: args })).result;
  const json = async (name, args) => {
    const r = await call(name, args);
    assert.equal(r.isError, undefined, `${name} ${JSON.stringify(args)} -> ${r.content[0].text}`);
    const m = /```json\n([\s\S]*?)\n```/.exec(r.content[0].text);
    assert.ok(m, 'answer has a JSON block');
    const j = JSON.parse(m[1]);
    assert.deepEqual(r.structuredContent, j);
    return j;
  };
  const err = async (name, args, re) => {
    const r = await call(name, args);
    assert.equal(r.isError, true, `${name} ${JSON.stringify(args)} should fail`);
    if (re) assert.match(r.content[0].text, re);
    assert.doesNotMatch(r.content[0].text, /at .*\.mjs:\d+/);
    return r.content[0].text;
  };
  const stop = () => new Promise(r => { child.on('close', r); child.stdin.end(); });
  return { request, raw, call, json, err, stop, stderr: () => stderr };
}

// ---------- independent reference implementation (Date.UTC based) ----------
const OFF = new Map();
for (const info of Object.values(DATA)) for (const h of info.holidays) OFF.set(h.date, h.type);
const DAY_MS = 86400000;
const toMs = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromMs = ms => new Date(ms).toISOString().slice(0, 10);
function refWorking(s, { cutiOff = true, satWork = false } = {}) {
  const wd = new Date(toMs(s)).getUTCDay();
  if (wd === 0 || (wd === 6 && !satWork)) return false;
  const t = OFF.get(s);
  if (t === 'libur_nasional') return false;
  if (t === 'cuti_bersama' && cutiOff) return false;
  return true;
}
function refCount(a, b, opt) {
  let n = 0;
  for (let ms = toMs(a); ms <= toMs(b); ms += DAY_MS) if (refWorking(fromMs(ms), opt)) n++;
  return n;
}
function refAdd(a, n, opt) {
  let ms = toMs(a);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  if (n === 0) { while (!refWorking(fromMs(ms), opt)) ms += DAY_MS; return fromMs(ms); }
  while (left > 0) { ms += step * DAY_MS; if (refWorking(fromMs(ms), opt)) left--; }
  return fromMs(ms);
}
function jakartaToday() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

// ---------- data ----------

test('bundled SKB data is complete, sourced and consistent', () => {
  assert.deepEqual(Object.keys(DATA), ['2025', '2026', '2027']);
  const expected = { 2025: [17, 11], 2026: [17, 8], 2027: [18, 8] };
  for (const [year, info] of Object.entries(DATA)) {
    assert.match(info.decree, /^SKB Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB Nomor \d+ Tahun \d{4}/);
    assert.match(info.decree_date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(info.source_url, /^https:\/\/(www\.)?(setneg|kemenkopmk)\.go\.id\//);
    assert.equal(info.checked_on, '2026-11-11');
    const nat = info.holidays.filter(h => h.type === 'libur_nasional').length;
    const cuti = info.holidays.filter(h => h.type === 'cuti_bersama').length;
    assert.deepEqual([nat, cuti], expected[year], year);
    assert.deepEqual(info.totals, { libur_nasional: nat, cuti_bersama: cuti });
    const dates = info.holidays.map(h => h.date);
    assert.deepEqual(dates, [...dates].sort(), `${year} sorted`);
    assert.equal(new Set(dates).size, dates.length, `${year} one entry per date`);
    for (const h of info.holidays) {
      assert.ok(h.date.startsWith(year));
      assert.equal(fromMs(toMs(h.date)), h.date, `${h.date} is a real date`);
      assert.ok(['libur_nasional', 'cuti_bersama'].includes(h.type));
      assert.ok(h.name.length > 3 && h.name_en.length > 3);
      assert.doesNotMatch(h.name + h.name_en, /resmi|official/i);
    }
    for (const a of info.amendments) assert.match(a.source_url, /^https:\/\//);
  }
  assert.equal(DATA['2025'].amendments.length, 1);
  assert.ok(DATA['2025'].holidays.some(h => h.date === '2025-08-18' && h.type === 'cuti_bersama'));
  // Spot checks against the decree texts.
  assert.ok(DATA['2026'].holidays.some(h => h.date === '2026-03-21' && /Idulfitri 1447/.test(h.name)));
  assert.ok(DATA['2027'].holidays.some(h => h.date === '2027-12-26' && /Isra Mikraj/.test(h.name)));
  assert.ok(DATA['2027'].holidays.some(h => h.date === '2027-01-05' && /Isra Mikraj/.test(h.name)));
});

// ---------- protocol ----------

test('initialize, tools/list and protocol errors', async () => {
  const s = startMcp();
  const init = await s.request('initialize', { protocolVersion: '2024-11-05' });
  assert.equal(init.result.protocolVersion, '2024-11-05');
  assert.equal(init.result.serverInfo.name, 'mcp-hari-libur-indonesia');
  assert.equal((await s.request('initialize', { protocolVersion: 'x' })).result.protocolVersion, '2025-06-18');
  const tools = (await s.request('tools/list', {})).result.tools;
  assert.deepEqual(tools.map(t => t.name), ['daftar_libur', 'cek_tanggal', 'hitung_hari_kerja', 'hari_kerja_berikutnya']);
  for (const t of tools) {
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.openWorldHint, false);
    assert.equal(t.inputSchema.additionalProperties, false);
  }
  assert.deepEqual((await s.request('ping', {})).result, {});
  assert.equal((await s.request('foo/bar', {})).error.code, -32601);
  assert.equal((await s.request('tools/call', { name: 'nope', arguments: {} })).error.code, -32602);
  assert.equal((await s.raw('{oops')).error.code, -32700);
  await s.stop();
  assert.match(s.stderr(), /ready; holiday data 2025, 2026, 2027/);
});

// ---------- daftar_libur ----------

test('daftar_libur lists a year, a month, with or without cuti bersama', async () => {
  const s = startMcp();
  const y26 = await s.json('daftar_libur', { year: 2026 });
  assert.deepEqual(y26.counts, { libur_nasional: 17, cuti_bersama: 8 });
  assert.equal(y26.holidays.length, 25);
  assert.equal(y26.sources[0].decree_date, '2025-09-19');
  assert.match(y26.sources[0].decree, /1497 Tahun 2025/);
  const first = y26.holidays[0];
  assert.deepEqual(first, { date: '2026-01-01', weekday: 'Thursday', weekday_id: 'Kamis', type: 'libur_nasional', name: 'Tahun Baru 2026 Masehi', name_en: "New Year's Day 2026", on_weekend: false });
  const natOnly = await s.json('daftar_libur', { year: 2026, include_cuti_bersama: false });
  assert.equal(natOnly.holidays.length, 17);
  assert.ok(natOnly.holidays.every(h => h.type === 'libur_nasional'));
  const march = await s.json('daftar_libur', { year: 2026, month: 3 });
  assert.deepEqual(march.counts, { libur_nasional: 3, cuti_bersama: 4 });
  const july = await s.call('daftar_libur', { year: 2026, month: 7 });
  assert.match(july.content[0].text, /Tidak ada libur/);
  const y25 = await s.call('daftar_libur', { year: '2025' });
  assert.match(y25.content[0].text, /Senin, 18 Agustus 2025: Cuti bersama HUT ke-80/);
  assert.match(y25.content[0].text, /Nomor 933 Tahun 2025/);
  const y27 = await s.json('daftar_libur', { year: 2027 });
  assert.deepEqual(y27.counts, { libur_nasional: 18, cuti_bersama: 8 });
  assert.match((await s.call('daftar_libur', { year: 2027 })).content[0].text, /Sumber: SKB .*1205 Tahun 2026/);
  await s.stop();
});

test('daftar_libur rejects missing or unsupported years and bad months', async () => {
  const s = startMcp();
  await s.err('daftar_libur', {}, /year/);
  await s.err('daftar_libur', { year: 2028 }, /2028 belum tersedia.*2025, 2026, 2027/s);
  await s.err('daftar_libur', { year: 2024 }, /2024 belum tersedia/);
  await s.err('daftar_libur', { year: 2026.5 }, /year/);
  await s.err('daftar_libur', { year: 2026, month: 13 }, /month/);
  await s.err('daftar_libur', { year: 2026, month: 0 }, /month/);
  await s.err('daftar_libur', { year: 2026, include_cuti_bersama: 'maybe' }, /include_cuti_bersama/);
  await s.stop();
});

// ---------- cek_tanggal ----------

test('cek_tanggal explains holidays, cuti bersama, weekends and working days', async () => {
  const s = startMcp();
  const indep = await s.json('cek_tanggal', { date: '2026-08-17' });
  assert.equal(indep.status, 'libur_nasional');
  assert.equal(indep.is_working_day, false);
  assert.equal(indep.weekday, 'Monday');
  assert.equal(indep.reasons[0].name, 'Proklamasi Kemerdekaan');
  const cuti = await s.json('cek_tanggal', { date: '2026-03-20' });
  assert.equal(cuti.status, 'cuti_bersama');
  assert.equal(cuti.is_working_day, false);
  const cutiWork = await s.json('cek_tanggal', { date: '2026-03-20', cuti_bersama_off: false });
  assert.equal(cutiWork.status, 'cuti_bersama');
  assert.equal(cutiWork.is_working_day, true);
  const sat = await s.json('cek_tanggal', { date: '2026-11-14' });
  assert.equal(sat.status, 'akhir_pekan');
  assert.equal(sat.is_working_day, false);
  assert.equal((await s.json('cek_tanggal', { date: '2026-11-14', saturday_working: true })).is_working_day, true);
  assert.equal((await s.json('cek_tanggal', { date: '2026-11-15', saturday_working: true })).is_working_day, false);
  const both = await s.json('cek_tanggal', { date: '2026-03-21', saturday_working: true });
  assert.equal(both.status, 'libur_nasional');
  assert.equal(both.is_working_day, false, 'a national holiday on Saturday stays off with a 6-day week');
  assert.deepEqual(both.reasons.map(r => r.type), ['libur_nasional']);
  const both2 = await s.json('cek_tanggal', { date: '2026-03-22' });
  assert.deepEqual(both2.reasons.map(r => r.type), ['libur_nasional', 'akhir_pekan']);
  const work = await s.json('cek_tanggal', { date: '2026-11-11' });
  assert.equal(work.status, 'hari_kerja');
  assert.equal(work.is_working_day, true);
  assert.equal(work.weekday_id, 'Rabu');
  assert.equal(work.holiday_data_available, true);
  await s.stop();
});

test('cek_tanggal date formats, leap years, invalid dates and years without data', async () => {
  const s = startMcp();
  for (const v of ['17-08-2026', '17/08/2026', '17.08.2026', '2026-8-17', ' 2026-08-17 ']) {
    assert.equal((await s.json('cek_tanggal', { date: v })).date, '2026-08-17', v);
  }
  await s.err('cek_tanggal', { date: '2026-02-29' }, /2026 bukan tahun kabisat/);
  await s.err('cek_tanggal', { date: '2027-02-29' }, /kabisat/);
  await s.err('cek_tanggal', { date: '2100-02-29' }, /2100 bukan tahun kabisat/);
  await s.err('cek_tanggal', { date: '2026-04-31' }, /tidak ada/);
  await s.err('cek_tanggal', { date: '2026-13-01' }, /Bulan/);
  await s.err('cek_tanggal', { date: '2026-00-10' }, /Bulan/);
  await s.err('cek_tanggal', { date: '2026-01-00' }, /tidak ada/);
  await s.err('cek_tanggal', { date: 'besok' }, /tidak dikenali/);
  await s.err('cek_tanggal', { date: '08/17/2026' }, /Bulan/); // US order is not accepted silently
  await s.err('cek_tanggal', { date: '2026/08/17' }, /tidak dikenali/);
  await s.err('cek_tanggal', { date: 20260817 }, /harus teks/);
  await s.err('cek_tanggal', { date: '1800-01-01' }, /1900-2100/);
  await s.err('cek_tanggal', { date: '2026-08-17', saturday_working: 'yes' }, /saturday_working/);
  const leap = await s.json('cek_tanggal', { date: '2028-02-29' });
  assert.equal(leap.weekday, 'Tuesday');
  assert.equal(leap.holiday_data_available, false);
  assert.equal(leap.warnings.length, 1);
  assert.deepEqual(leap.sources, []);
  assert.match((await s.call('cek_tanggal', { date: '2028-02-29' })).content[0].text, /PERINGATAN: data libur 2028 belum tersedia/);
  assert.equal((await s.json('cek_tanggal', { date: '2024-02-29' })).weekday, 'Thursday');
  assert.equal((await s.json('cek_tanggal', { date: '2000-02-29' })).weekday, 'Tuesday');
  assert.equal((await s.json('cek_tanggal', { date: '1900-03-01' })).weekday, 'Thursday');
  await s.stop();
});

test('"today" is today in Asia/Jakarta whatever the machine timezone', async () => {
  for (const TZ of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Jakarta']) {
    const s = startMcp({ TZ });
    const expected = jakartaToday();
    assert.equal((await s.json('cek_tanggal', {})).date, expected, TZ);
    assert.equal((await s.json('cek_tanggal', { date: 'hari ini' })).date, expected, TZ);
    assert.equal((await s.json('cek_tanggal', { date: 'TODAY' })).date, expected, TZ);
    // A fixed date gives the same answer in every timezone.
    const fixed = await s.json('cek_tanggal', { date: '2026-01-01' });
    assert.equal(fixed.weekday, 'Thursday', TZ);
    assert.equal(fixed.status, 'libur_nasional', TZ);
    const add = await s.json('hari_kerja_berikutnya', { date: '2026-12-31', n: 1 });
    assert.equal(add.result, '2027-01-04', TZ);
    await s.stop();
  }
});

// ---------- hitung_hari_kerja ----------

test('hitung_hari_kerja: month, whole year, options', async () => {
  const s = startMcp();
  const mar = await s.json('hitung_hari_kerja', { start: '2026-03-01', end: '2026-03-31' });
  assert.equal(mar.working_days, 17);
  assert.equal(mar.calendar_days, 31);
  assert.equal(mar.weekend_days, 9);
  assert.equal(mar.holidays_on_weekdays, 5);
  assert.equal(mar.reversed, false);
  const y = await s.json('hitung_hari_kerja', { start: '2026-01-01', end: '2026-12-31' });
  assert.equal(y.working_days, 240); // 261 weekdays - 13 national holidays on weekdays - 8 cuti bersama
  assert.equal((await s.json('hitung_hari_kerja', { start: '2026-01-01', end: '2026-12-31', cuti_bersama_off: false })).working_days, 248); // 261 - 13
  const sixDay = await s.json('hitung_hari_kerja', { start: '2026-01-01', end: '2026-12-31', saturday_working: true });
  assert.equal(sixDay.working_days, 291); // + 52 Saturdays - 1 Saturday holiday (21 Mar)
  const cw = await s.json('hitung_hari_kerja', { start: '2026-03-01', end: '2026-03-31', cuti_bersama_off: false });
  assert.equal(cw.working_days, 21);
  assert.equal(cw.cuti_bersama_counted_as_working.length, 4);
  const all = await s.json('hitung_hari_kerja', { start: '2025-01-01', end: '2027-12-31' });
  assert.equal(all.working_days, refCount('2025-01-01', '2027-12-31'));
  assert.equal(all.sources.length, 3);
  await s.stop();
});

test('hitung_hari_kerja edge cases: year boundary, reversed range, single day, count_start', async () => {
  const s = startMcp();
  const nye = await s.json('hitung_hari_kerja', { start: '2025-12-22', end: '2026-01-09' });
  assert.equal(nye.working_days, 12); // 15 weekdays - 25 Dec - 26 Dec (cuti) - 1 Jan
  assert.deepEqual(nye.days_off.filter(d => !d.on_weekend).map(d => d.date), ['2025-12-25', '2025-12-26', '2026-01-01']);
  assert.equal(nye.sources.length, 2);
  assert.equal((await s.json('hitung_hari_kerja', { start: '2025-12-22', end: '2026-01-09', cuti_bersama_off: false })).working_days, 13);
  const rev = await s.json('hitung_hari_kerja', { start: '2026-01-09', end: '2025-12-22' });
  assert.equal(rev.working_days, 12);
  assert.equal(rev.reversed, true);
  assert.equal(rev.start, '2025-12-22');
  assert.match((await s.call('hitung_hari_kerja', { start: '2026-01-09', end: '2025-12-22' })).content[0].text, /ditukar/);
  assert.equal((await s.json('hitung_hari_kerja', { start: '2026-08-17', end: '2026-08-17' })).working_days, 0);
  const one = await s.json('hitung_hari_kerja', { start: '2026-08-18', end: '2026-08-18' });
  assert.equal(one.working_days, 1);
  assert.equal(one.calendar_days, 1);
  const zero = await s.json('hitung_hari_kerja', { start: '2026-08-18', end: '2026-08-18', count_start: false });
  assert.equal(zero.working_days, 0);
  assert.equal(zero.calendar_days, 0);
  assert.equal((await s.json('hitung_hari_kerja', { start: '2026-11-09', end: '2026-11-13', count_start: false })).working_days, 4);
  await s.stop();
});

test('hitung_hari_kerja errors: missing, invalid, outside data', async () => {
  const s = startMcp();
  await s.err('hitung_hari_kerja', { start: '2026-01-01' }, /"end" wajib/);
  await s.err('hitung_hari_kerja', { end: '2026-01-01' }, /"start" wajib/);
  await s.err('hitung_hari_kerja', { start: '2026-02-30', end: '2026-03-01' }, /tidak ada/);
  await s.err('hitung_hari_kerja', { start: '2024-12-30', end: '2025-01-03' }, /2024 belum tersedia/);
  await s.err('hitung_hari_kerja', { start: '2027-12-30', end: '2028-01-03' }, /2028 belum tersedia/);
  await s.err('hitung_hari_kerja', { start: '2025-01-01', end: '2026-01-01', count_start: 'no' }, /count_start/);
  await s.stop();
});

// ---------- hari_kerja_berikutnya ----------

test('hari_kerja_berikutnya: forward, backward, zero, options', async () => {
  const s = startMcp();
  const lebaran = await s.json('hari_kerja_berikutnya', { date: '2026-03-17', n: 3 });
  assert.equal(lebaran.result, '2026-03-27');
  assert.equal(lebaran.result_weekday_id, 'Jumat');
  assert.equal(lebaran.skipped_days, 7);
  assert.equal(lebaran.skipped_holidays.length, 7);
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2026-03-25', n: -1 })).result, '2026-03-17');
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2026-03-21', n: 0 })).result, '2026-03-25');
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2026-11-11', n: 0 })).result, '2026-11-11');
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2026-11-13', n: 1 })).result, '2026-11-16');
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2026-11-13', n: 1, saturday_working: true })).result, '2026-11-14');
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2026-11-16', n: -1 })).result, '2026-11-13');
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2026-11-14', n: '2' })).result, '2026-11-17');
  const today = await s.json('hari_kerja_berikutnya', { n: 0 });
  assert.ok(today.date === jakartaToday());
  await s.stop();
});

test('hari_kerja_berikutnya crosses year boundaries and stops at the end of the data', async () => {
  const s = startMcp();
  const ny = await s.json('hari_kerja_berikutnya', { date: '2026-12-23', n: 5 });
  assert.equal(ny.result, '2027-01-04');
  assert.equal(ny.sources.length, 2);
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2026-12-23', n: 5, cuti_bersama_off: false })).result, '2026-12-31');
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2027-01-04', n: -5 })).result, '2026-12-23');
  assert.equal((await s.json('hari_kerja_berikutnya', { date: '2027-12-23', n: 3 })).result, '2027-12-29');
  await s.err('hari_kerja_berikutnya', { date: '2027-12-29', n: 5 }, /2028 belum tersedia/);
  await s.err('hari_kerja_berikutnya', { date: '2025-01-03', n: -5 }, /2024 belum tersedia/);
  await s.err('hari_kerja_berikutnya', { date: '2026-01-01' }, /"n" wajib/);
  await s.err('hari_kerja_berikutnya', { date: '2026-01-01', n: 1.5 }, /"n" harus/);
  await s.err('hari_kerja_berikutnya', { date: '2026-01-01', n: 751 }, /"n" harus/);
  await s.err('hari_kerja_berikutnya', { date: '2026-01-01', n: 'abc' }, /"n" harus/);
  await s.err('hari_kerja_berikutnya', { date: 'kemarin', n: 1 }, /tidak dikenali/);
  await s.stop();
});

test('brute-force cross-check against an independent Date.UTC implementation', async () => {
  const s = startMcp();
  let seed = 20261111;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const lo = toMs('2025-01-01');
  const span = (toMs('2027-12-31') - lo) / DAY_MS;
  const optsList = [{}, { cuti_bersama_off: false }, { saturday_working: true }, { cuti_bersama_off: false, saturday_working: true }];
  for (let i = 0; i < 60; i++) {
    const a = fromMs(lo + Math.floor(rnd() * span) * DAY_MS);
    const b = fromMs(lo + Math.floor(rnd() * span) * DAY_MS);
    const o = optsList[i % 4];
    const ref = { cutiOff: o.cuti_bersama_off !== false, satWork: o.saturday_working === true };
    const [x, y] = a <= b ? [a, b] : [b, a];
    assert.equal((await s.json('hitung_hari_kerja', { start: a, end: b, ...o })).working_days, refCount(x, y, ref), `${a}..${b} ${JSON.stringify(o)}`);
    const n = Math.floor(rnd() * 41) - 20;
    const expected = refAdd(a, n, ref);
    if (expected >= '2025-01-01' && expected <= '2027-12-31') {
      assert.equal((await s.json('hari_kerja_berikutnya', { date: a, n, ...o })).result, expected, `${a} + ${n} ${JSON.stringify(o)}`);
    }
    const c = await s.json('cek_tanggal', { date: a, ...o });
    assert.equal(c.is_working_day, refWorking(a, ref), `${a} ${JSON.stringify(o)}`);
  }
  await s.stop();
});
