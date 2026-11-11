#!/usr/bin/env node
// mcp-hari-libur-indonesia: Indonesian national public holidays (libur nasional) and collective leave (cuti bersama) from the
// joint ministerial decrees (SKB 3 Menteri), plus working-day math, for Claude Desktop, Claude Code, Cursor, OpenCode and
// other MCP clients. One file, no dependencies, no network, Node >= 18, MCP over stdio (newline-delimited JSON-RPC).
// Logs go to stderr only; stdout carries protocol messages.
//
// Dates are handled as plain calendar days (day numbers), never through the local timezone of the machine, so results
// do not shift by a day around midnight or across time zones. "Today" means today in Asia/Jakarta (WIB, UTC+7, no DST).
import readline from 'node:readline';

const VERSION = '1.0.0';
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_PROTOCOL = '2025-06-18';

// ---------- data: SKB 3 Menteri (Menteri Agama, Menteri Ketenagakerjaan, Menteri PANRB) ----------
// Strict JSON between the markers (the tests parse it). Each year cites its decree, amendments and the page it was checked against.
// To add a year: copy a block, fill it from the new SKB, run `node --test test/`.
// BEGIN HOLIDAY DATA (JSON)
const HOLIDAY_DATA = {
  "2025": {
    "decree": "SKB Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB Nomor 1017 Tahun 2024, Nomor 2 Tahun 2024, Nomor 2 Tahun 2024 tentang Hari Libur Nasional dan Cuti Bersama Tahun 2025",
    "decree_date": "2024-10-14",
    "source_url": "https://www.kemenkopmk.go.id/pemerintah-tetapkan-hari-libur-nasional-dan-cuti-bersama-tahun-2025",
    "amendments": [
      {
        "decree": "Keputusan Bersama Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB Nomor 933 Tahun 2025, Nomor 1 Tahun 2025, Nomor 3 Tahun 2025",
        "decree_date": "2025-08-07",
        "change": "Adds cuti bersama on Monday 18 August 2025 (80th Independence Day)",
        "source_url": "https://setneg.go.id/baca/index/sambut_hut_ke_80_kemerdekaan_ri_pemerintah_tetapkan_18_agustus_2025_sebagai_cuti_bersama"
      }
    ],
    "checked_on": "2026-11-11",
    "totals": { "libur_nasional": 17, "cuti_bersama": 11 },
    "holidays": [
      { "date": "2025-01-01", "type": "libur_nasional", "name": "Tahun Baru 2025 Masehi", "name_en": "New Year's Day 2025" },
      { "date": "2025-01-27", "type": "libur_nasional", "name": "Isra Mikraj Nabi Muhammad SAW", "name_en": "Isra Mi'raj of the Prophet Muhammad" },
      { "date": "2025-01-28", "type": "cuti_bersama", "name": "Cuti bersama Tahun Baru Imlek 2576 Kongzili", "name_en": "Collective leave, Chinese New Year 2576" },
      { "date": "2025-01-29", "type": "libur_nasional", "name": "Tahun Baru Imlek 2576 Kongzili", "name_en": "Chinese New Year 2576" },
      { "date": "2025-03-28", "type": "cuti_bersama", "name": "Cuti bersama Hari Suci Nyepi (Tahun Baru Saka 1947)", "name_en": "Collective leave, Day of Silence (Saka New Year 1947)" },
      { "date": "2025-03-29", "type": "libur_nasional", "name": "Hari Suci Nyepi (Tahun Baru Saka 1947)", "name_en": "Day of Silence (Saka New Year 1947)" },
      { "date": "2025-03-31", "type": "libur_nasional", "name": "Idulfitri 1446 Hijriah", "name_en": "Eid al-Fitr 1446 AH" },
      { "date": "2025-04-01", "type": "libur_nasional", "name": "Idulfitri 1446 Hijriah", "name_en": "Eid al-Fitr 1446 AH" },
      { "date": "2025-04-02", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1446 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1446 AH" },
      { "date": "2025-04-03", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1446 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1446 AH" },
      { "date": "2025-04-04", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1446 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1446 AH" },
      { "date": "2025-04-07", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1446 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1446 AH" },
      { "date": "2025-04-18", "type": "libur_nasional", "name": "Wafat Yesus Kristus", "name_en": "Good Friday" },
      { "date": "2025-04-20", "type": "libur_nasional", "name": "Kebangkitan Yesus Kristus (Paskah)", "name_en": "Easter Sunday" },
      { "date": "2025-05-01", "type": "libur_nasional", "name": "Hari Buruh Internasional", "name_en": "International Labour Day" },
      { "date": "2025-05-12", "type": "libur_nasional", "name": "Hari Raya Waisak 2569 BE", "name_en": "Vesak Day 2569 BE" },
      { "date": "2025-05-13", "type": "cuti_bersama", "name": "Cuti bersama Hari Raya Waisak 2569 BE", "name_en": "Collective leave, Vesak Day 2569 BE" },
      { "date": "2025-05-29", "type": "libur_nasional", "name": "Kenaikan Yesus Kristus", "name_en": "Ascension of Jesus Christ" },
      { "date": "2025-05-30", "type": "cuti_bersama", "name": "Cuti bersama Kenaikan Yesus Kristus", "name_en": "Collective leave, Ascension of Jesus Christ" },
      { "date": "2025-06-01", "type": "libur_nasional", "name": "Hari Lahir Pancasila", "name_en": "Pancasila Day" },
      { "date": "2025-06-06", "type": "libur_nasional", "name": "Iduladha 1446 Hijriah", "name_en": "Eid al-Adha 1446 AH" },
      { "date": "2025-06-09", "type": "cuti_bersama", "name": "Cuti bersama Iduladha 1446 Hijriah", "name_en": "Collective leave, Eid al-Adha 1446 AH" },
      { "date": "2025-06-27", "type": "libur_nasional", "name": "1 Muharam Tahun Baru Islam 1447 Hijriah", "name_en": "Islamic New Year 1447 AH" },
      { "date": "2025-08-17", "type": "libur_nasional", "name": "Proklamasi Kemerdekaan", "name_en": "Independence Day" },
      { "date": "2025-08-18", "type": "cuti_bersama", "name": "Cuti bersama HUT ke-80 Kemerdekaan RI", "name_en": "Collective leave, 80th Independence Day" },
      { "date": "2025-09-05", "type": "libur_nasional", "name": "Maulid Nabi Muhammad SAW", "name_en": "Prophet Muhammad's Birthday" },
      { "date": "2025-12-25", "type": "libur_nasional", "name": "Kelahiran Yesus Kristus", "name_en": "Christmas Day" },
      { "date": "2025-12-26", "type": "cuti_bersama", "name": "Cuti bersama Kelahiran Yesus Kristus", "name_en": "Collective leave, Christmas" }
    ]
  },
  "2026": {
    "decree": "SKB Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB Nomor 1497 Tahun 2025, Nomor 2 Tahun 2025, Nomor 5 Tahun 2025 tentang Hari Libur Nasional dan Cuti Bersama Tahun 2026",
    "decree_date": "2025-09-19",
    "source_url": "https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026",
    "amendments": [],
    "checked_on": "2026-11-11",
    "totals": { "libur_nasional": 17, "cuti_bersama": 8 },
    "holidays": [
      { "date": "2026-01-01", "type": "libur_nasional", "name": "Tahun Baru 2026 Masehi", "name_en": "New Year's Day 2026" },
      { "date": "2026-01-16", "type": "libur_nasional", "name": "Isra Mikraj Nabi Muhammad SAW", "name_en": "Isra Mi'raj of the Prophet Muhammad" },
      { "date": "2026-02-16", "type": "cuti_bersama", "name": "Cuti bersama Tahun Baru Imlek 2577 Kongzili", "name_en": "Collective leave, Chinese New Year 2577" },
      { "date": "2026-02-17", "type": "libur_nasional", "name": "Tahun Baru Imlek 2577 Kongzili", "name_en": "Chinese New Year 2577" },
      { "date": "2026-03-18", "type": "cuti_bersama", "name": "Cuti bersama Hari Suci Nyepi (Tahun Baru Saka 1948)", "name_en": "Collective leave, Day of Silence (Saka New Year 1948)" },
      { "date": "2026-03-19", "type": "libur_nasional", "name": "Hari Suci Nyepi (Tahun Baru Saka 1948)", "name_en": "Day of Silence (Saka New Year 1948)" },
      { "date": "2026-03-20", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1447 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1447 AH" },
      { "date": "2026-03-21", "type": "libur_nasional", "name": "Idulfitri 1447 Hijriah", "name_en": "Eid al-Fitr 1447 AH" },
      { "date": "2026-03-22", "type": "libur_nasional", "name": "Idulfitri 1447 Hijriah", "name_en": "Eid al-Fitr 1447 AH" },
      { "date": "2026-03-23", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1447 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1447 AH" },
      { "date": "2026-03-24", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1447 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1447 AH" },
      { "date": "2026-04-03", "type": "libur_nasional", "name": "Wafat Yesus Kristus", "name_en": "Good Friday" },
      { "date": "2026-04-05", "type": "libur_nasional", "name": "Kebangkitan Yesus Kristus (Paskah)", "name_en": "Easter Sunday" },
      { "date": "2026-05-01", "type": "libur_nasional", "name": "Hari Buruh Internasional", "name_en": "International Labour Day" },
      { "date": "2026-05-14", "type": "libur_nasional", "name": "Kenaikan Yesus Kristus", "name_en": "Ascension of Jesus Christ" },
      { "date": "2026-05-15", "type": "cuti_bersama", "name": "Cuti bersama Kenaikan Yesus Kristus", "name_en": "Collective leave, Ascension of Jesus Christ" },
      { "date": "2026-05-27", "type": "libur_nasional", "name": "Iduladha 1447 Hijriah", "name_en": "Eid al-Adha 1447 AH" },
      { "date": "2026-05-28", "type": "cuti_bersama", "name": "Cuti bersama Iduladha 1447 Hijriah", "name_en": "Collective leave, Eid al-Adha 1447 AH" },
      { "date": "2026-05-31", "type": "libur_nasional", "name": "Hari Raya Waisak 2570 BE", "name_en": "Vesak Day 2570 BE" },
      { "date": "2026-06-01", "type": "libur_nasional", "name": "Hari Lahir Pancasila", "name_en": "Pancasila Day" },
      { "date": "2026-06-16", "type": "libur_nasional", "name": "1 Muharam Tahun Baru Islam 1448 Hijriah", "name_en": "Islamic New Year 1448 AH" },
      { "date": "2026-08-17", "type": "libur_nasional", "name": "Proklamasi Kemerdekaan", "name_en": "Independence Day" },
      { "date": "2026-08-25", "type": "libur_nasional", "name": "Maulid Nabi Muhammad SAW", "name_en": "Prophet Muhammad's Birthday" },
      { "date": "2026-12-24", "type": "cuti_bersama", "name": "Cuti bersama Kelahiran Yesus Kristus", "name_en": "Collective leave, Christmas" },
      { "date": "2026-12-25", "type": "libur_nasional", "name": "Kelahiran Yesus Kristus", "name_en": "Christmas Day" }
    ]
  },
  "2027": {
    "decree": "SKB Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB Nomor 1205 Tahun 2026, Nomor 3 Tahun 2026, Nomor 2 Tahun 2026 tentang Hari Libur Nasional dan Cuti Bersama Tahun 2027",
    "decree_date": "2026-09-15",
    "source_url": "https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027",
    "amendments": [],
    "checked_on": "2026-11-11",
    "totals": { "libur_nasional": 18, "cuti_bersama": 8 },
    "holidays": [
      { "date": "2027-01-01", "type": "libur_nasional", "name": "Tahun Baru 2027 Masehi", "name_en": "New Year's Day 2027" },
      { "date": "2027-01-05", "type": "libur_nasional", "name": "Isra Mikraj Nabi Muhammad SAW", "name_en": "Isra Mi'raj of the Prophet Muhammad" },
      { "date": "2027-02-05", "type": "cuti_bersama", "name": "Cuti bersama Tahun Baru Imlek 2578 Kongzili", "name_en": "Collective leave, Chinese New Year 2578" },
      { "date": "2027-02-06", "type": "libur_nasional", "name": "Tahun Baru Imlek 2578 Kongzili", "name_en": "Chinese New Year 2578" },
      { "date": "2027-03-08", "type": "libur_nasional", "name": "Hari Suci Nyepi (Tahun Baru Saka 1949)", "name_en": "Day of Silence (Saka New Year 1949)" },
      { "date": "2027-03-09", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1448 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1448 AH" },
      { "date": "2027-03-10", "type": "libur_nasional", "name": "Idulfitri 1448 Hijriah", "name_en": "Eid al-Fitr 1448 AH" },
      { "date": "2027-03-11", "type": "libur_nasional", "name": "Idulfitri 1448 Hijriah", "name_en": "Eid al-Fitr 1448 AH" },
      { "date": "2027-03-12", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1448 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1448 AH" },
      { "date": "2027-03-15", "type": "cuti_bersama", "name": "Cuti bersama Idulfitri 1448 Hijriah", "name_en": "Collective leave, Eid al-Fitr 1448 AH" },
      { "date": "2027-03-25", "type": "cuti_bersama", "name": "Cuti bersama Wafat Yesus Kristus", "name_en": "Collective leave, Good Friday" },
      { "date": "2027-03-26", "type": "libur_nasional", "name": "Wafat Yesus Kristus", "name_en": "Good Friday" },
      { "date": "2027-03-28", "type": "libur_nasional", "name": "Kebangkitan Yesus Kristus (Paskah)", "name_en": "Easter Sunday" },
      { "date": "2027-05-01", "type": "libur_nasional", "name": "Hari Buruh Internasional", "name_en": "International Labour Day" },
      { "date": "2027-05-06", "type": "libur_nasional", "name": "Kenaikan Yesus Kristus", "name_en": "Ascension of Jesus Christ" },
      { "date": "2027-05-17", "type": "libur_nasional", "name": "Iduladha 1448 Hijriah", "name_en": "Eid al-Adha 1448 AH" },
      { "date": "2027-05-18", "type": "cuti_bersama", "name": "Cuti bersama Iduladha 1448 Hijriah", "name_en": "Collective leave, Eid al-Adha 1448 AH" },
      { "date": "2027-05-19", "type": "cuti_bersama", "name": "Cuti bersama Hari Raya Waisak 2571 BE", "name_en": "Collective leave, Vesak Day 2571 BE" },
      { "date": "2027-05-20", "type": "libur_nasional", "name": "Hari Raya Waisak 2571 BE", "name_en": "Vesak Day 2571 BE" },
      { "date": "2027-06-01", "type": "libur_nasional", "name": "Hari Lahir Pancasila", "name_en": "Pancasila Day" },
      { "date": "2027-06-06", "type": "libur_nasional", "name": "1 Muharam Tahun Baru Islam 1449 Hijriah", "name_en": "Islamic New Year 1449 AH" },
      { "date": "2027-08-15", "type": "libur_nasional", "name": "Maulid Nabi Muhammad SAW", "name_en": "Prophet Muhammad's Birthday" },
      { "date": "2027-08-17", "type": "libur_nasional", "name": "Proklamasi Kemerdekaan", "name_en": "Independence Day" },
      { "date": "2027-12-24", "type": "cuti_bersama", "name": "Cuti bersama Kelahiran Yesus Kristus", "name_en": "Collective leave, Christmas" },
      { "date": "2027-12-25", "type": "libur_nasional", "name": "Kelahiran Yesus Kristus", "name_en": "Christmas Day" },
      { "date": "2027-12-26", "type": "libur_nasional", "name": "Isra Mikraj Nabi Muhammad SAW", "name_en": "Isra Mi'raj of the Prophet Muhammad" }
    ]
  }
};
// END HOLIDAY DATA (JSON)

const ISLAMIC_NOTE = 'Tanggal 1 Ramadan, Idulfitri, dan Iduladha ditetapkan Menteri Agama (sidang isbat); tanggal di SKB bisa disesuaikan. '
  + '/ Eid dates are confirmed by the Minister of Religious Affairs and may shift from the SKB.';
const CUTI_NOTE = 'Cuti bersama mengurangi hak cuti tahunan; untuk swasta pelaksanaannya diatur pimpinan perusahaan, untuk ASN sesuai ketentuan. '
  + '/ Collective leave is deducted from annual leave; private employers decide whether to apply it.';
const NOT_INCLUDED = 'Tidak termasuk libur daerah, libur fakultatif, atau libur khusus (mis. pilkada). / Regional, optional and ad-hoc holidays are not included.';

const YEARS = Object.keys(HOLIDAY_DATA).map(Number).sort((a, b) => a - b);
const MIN_YEAR = YEARS[0];
const MAX_YEAR = YEARS[YEARS.length - 1];

function log(...args) {
  process.stderr.write('[mcp-hari-libur-indonesia] ' + args.map(a => String(a)).join(' ') + '\n');
}

class ToolError extends Error {}

// ---------- pure calendar math (proleptic Gregorian, integer day numbers; no Date, no timezone) ----------

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y, m) {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

// Days since 1970-01-01 (H. Hinnant's days_from_civil).
function toDay(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function fromDay(z) {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
const ymdOf = day => { const { y, m, d } = fromDay(day); return `${pad(y, 4)}-${pad(m)}-${pad(d)}`; };
const weekdayOf = day => ((day % 7) + 7 + 4) % 7; // 0 = Sunday; 1970-01-01 was a Thursday
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function longId(day) {
  const { y, m, d } = fromDay(day);
  return `${HARI[weekdayOf(day)]}, ${d} ${BULAN[m - 1]} ${y}`;
}

// Today in Asia/Jakarta (UTC+7 all year).
function todayJakarta() {
  return Math.floor((Date.now() + 7 * 3600 * 1000) / 86400000);
}

const TODAY_WORDS = new Set(['today', 'hari ini', 'sekarang', 'now']);

// Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY and "today"/"hari ini". Returns a day number.
function parseDate(value, field, { allowEmptyToday = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (allowEmptyToday) return todayJakarta();
    throw new ToolError(`"${field}" wajib diisi (format YYYY-MM-DD). / "${field}" is required (YYYY-MM-DD).`);
  }
  if (typeof value !== 'string') throw new ToolError(`"${field}" harus teks tanggal YYYY-MM-DD. / "${field}" must be a date string YYYY-MM-DD.`);
  const v = value.trim().toLowerCase();
  if (TODAY_WORDS.has(v)) return todayJakarta();
  let y; let m; let d;
  let mt = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (mt) { y = +mt[1]; m = +mt[2]; d = +mt[3]; } else {
    mt = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(v);
    if (mt) { d = +mt[1]; m = +mt[2]; y = +mt[3]; }
  }
  if (y === undefined) {
    throw new ToolError(`Format "${field}" tidak dikenali: "${String(value).slice(0, 40)}". Gunakan YYYY-MM-DD (contoh 2026-08-17) atau DD-MM-YYYY. `
      + `/ Unrecognised date "${String(value).slice(0, 40)}"; use YYYY-MM-DD.`);
  }
  if (y < 1900 || y > 2100) throw new ToolError(`Tahun pada "${field}" harus 1900-2100. / Year must be 1900-2100.`);
  if (m < 1 || m > 12) throw new ToolError(`Bulan pada "${field}" tidak valid (${m}). / Invalid month.`);
  if (d < 1 || d > daysInMonth(y, m)) {
    const leapHint = m === 2 && d === 29 ? ` ${y} bukan tahun kabisat. / ${y} is not a leap year.` : '';
    throw new ToolError(`Tanggal pada "${field}" tidak ada: ${pad(y, 4)}-${pad(m)}-${pad(d)}.${leapHint || ' / This date does not exist.'}`);
  }
  return toDay(y, m, d);
}

function boolArg(v, field, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw new ToolError(`"${field}" harus true atau false. / "${field}" must be true or false.`);
}

function intArg(v, field, { min, max, dflt, required = false }) {
  if (v === undefined || v === null || v === '') {
    if (required) throw new ToolError(`"${field}" wajib diisi. / "${field}" is required.`);
    return dflt;
  }
  const n = typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v.trim()) : v;
  if (!Number.isInteger(n) || n < min || n > max) throw new ToolError(`"${field}" harus bilangan bulat ${min} sampai ${max}. / "${field}" must be an integer from ${min} to ${max}.`);
  return n;
}

// ---------- holiday index ----------

const BY_DAY = new Map(); // day number -> [holiday]
for (const [year, info] of Object.entries(HOLIDAY_DATA)) {
  for (const h of info.holidays) {
    const [y, m, d] = h.date.split('-').map(Number);
    const day = toDay(y, m, d);
    if (String(y) !== year || ymdOf(day) !== h.date) throw new Error(`bad holiday date ${h.date}`);
    if (!BY_DAY.has(day)) BY_DAY.set(day, []);
    BY_DAY.get(day).push({ ...h, year: y });
  }
}

const hasData = day => HOLIDAY_DATA[String(fromDay(day).y)] !== undefined;

function requireDataRange(fromD, toD, what) {
  const y1 = fromDay(fromD).y;
  const y2 = fromDay(toD).y;
  for (let y = y1; y <= y2; y++) {
    if (!HOLIDAY_DATA[String(y)]) {
      throw new ToolError(`Data libur ${y} belum tersedia (tersedia ${YEARS.join(', ')}), jadi ${what} tidak bisa dihitung dengan akurat. `
        + `/ Holiday data for ${y} is not available (have ${YEARS.join(', ')}); cannot compute this reliably.`);
    }
  }
}

// Why a day is (not) a working day under the given options.
function classify(day, opt) {
  const wd = weekdayOf(day);
  const hol = BY_DAY.get(day) || [];
  const reasons = [];
  for (const h of hol) reasons.push({ type: h.type, name: h.name, name_en: h.name_en });
  const weekend = wd === 0 || (wd === 6 && !opt.saturdayWorking);
  if (weekend) reasons.push({ type: 'akhir_pekan', name: HARI[wd], name_en: DAY_EN[wd] });
  const national = hol.some(h => h.type === 'libur_nasional');
  const cuti = hol.some(h => h.type === 'cuti_bersama');
  const off = weekend || national || (cuti && opt.cutiOff);
  const status = national ? 'libur_nasional' : cuti ? 'cuti_bersama' : weekend ? 'akhir_pekan' : 'hari_kerja';
  return { day, date: ymdOf(day), weekday: DAY_EN[wd], weekday_id: HARI[wd], status, is_working_day: !off, reasons };
}

function options(args) {
  return {
    cutiOff: boolArg(args.cuti_bersama_off, 'cuti_bersama_off', true),
    saturdayWorking: boolArg(args.saturday_working, 'saturday_working', false),
  };
}

function optionsJson(opt) {
  return { cuti_bersama_off: opt.cutiOff, saturday_working: opt.saturdayWorking, timezone: 'Asia/Jakarta' };
}

function sourcesFor(y1, y2) {
  const out = [];
  for (let y = y1; y <= y2; y++) {
    const info = HOLIDAY_DATA[String(y)];
    if (info) out.push({ year: y, decree: info.decree, decree_date: info.decree_date, source_url: info.source_url, amendments: info.amendments, checked_on: info.checked_on });
  }
  return out;
}

function sourceLine(sources) {
  if (!sources.length) return 'Sumber: tidak ada data SKB untuk tahun ini.';
  return 'Sumber: ' + sources.map(s => `${s.decree.replace(/ tentang .*/, '')}${s.amendments.length ? ` (diubah ${s.amendments.map(a => a.decree.replace(/^Keputusan Bersama .*?Nomor/, 'Nomor')).join('; ')})` : ''}, ${s.source_url}`).join(' | ');
}

function answer(text, data, sources) {
  const payload = { ...data, sources };
  return {
    content: [{ type: 'text', text: `${text}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\n${sourceLine(sources)}` }],
    structuredContent: payload,
  };
}

const TYPE_ID = { libur_nasional: 'libur nasional', cuti_bersama: 'cuti bersama', akhir_pekan: 'akhir pekan', hari_kerja: 'hari kerja' };

// ---------- tools ----------

function daftarLibur(args) {
  const year = intArg(args.year, 'year', { min: 1900, max: 2100, required: true });
  const month = intArg(args.month, 'month', { min: 1, max: 12, dflt: null });
  const includeCuti = boolArg(args.include_cuti_bersama, 'include_cuti_bersama', true);
  const info = HOLIDAY_DATA[String(year)];
  if (!info) {
    const later = year > MAX_YEAR;
    throw new ToolError(`Data libur ${year} belum tersedia. Tersedia: ${YEARS.join(', ')}.${later ? ' SKB 3 Menteri untuk tahun itu belum ada di server ini (biasanya terbit sekitar September-Oktober tahun sebelumnya).' : ''} `
      + `/ No holiday data for ${year}; available: ${YEARS.join(', ')}.`);
  }
  const list = info.holidays
    .filter(h => includeCuti || h.type === 'libur_nasional')
    .filter(h => month === null || Number(h.date.slice(5, 7)) === month)
    .map(h => {
      const [y, m, d] = h.date.split('-').map(Number);
      const day = toDay(y, m, d);
      return { date: h.date, weekday: DAY_EN[weekdayOf(day)], weekday_id: HARI[weekdayOf(day)], type: h.type, name: h.name, name_en: h.name_en, on_weekend: [0, 6].includes(weekdayOf(day)) };
    });
  const nat = list.filter(h => h.type === 'libur_nasional').length;
  const cuti = list.filter(h => h.type === 'cuti_bersama').length;
  const scope = month === null ? `tahun ${year}` : `${BULAN[month - 1]} ${year}`;
  const lines = [`Hari libur nasional${includeCuti ? ' dan cuti bersama' : ''} ${scope}: ${nat} libur nasional${includeCuti ? `, ${cuti} cuti bersama` : ''}.`];
  if (!list.length) lines.push('Tidak ada libur nasional atau cuti bersama pada periode ini. / No holidays in this period.');
  for (const h of list) {
    const [y, m, d] = h.date.split('-').map(Number);
    lines.push(`- ${longId(toDay(y, m, d))}: ${h.name} (${TYPE_ID[h.type]})`);
  }
  lines.push('', `Catatan: ${ISLAMIC_NOTE}`, NOT_INCLUDED);
  if (includeCuti && cuti) lines.push(CUTI_NOTE);
  return answer(lines.join('\n'), {
    year, month, include_cuti_bersama: includeCuti,
    counts: { libur_nasional: nat, cuti_bersama: cuti },
    year_totals: info.totals,
    holidays: list,
  }, sourcesFor(year, year));
}

function cekTanggal(args) {
  const day = parseDate(args.date, 'date', { allowEmptyToday: true });
  const opt = options(args);
  const c = classify(day, opt);
  const available = hasData(day);
  const y = fromDay(day).y;
  const lines = [`${longId(day)} (${c.date}): ${c.is_working_day ? 'HARI KERJA' : 'BUKAN hari kerja'} (${TYPE_ID[c.status]}).`];
  for (const r of c.reasons) lines.push(`- ${TYPE_ID[r.type]}: ${r.name}`);
  if (!c.reasons.length) lines.push('- Tidak ada libur nasional atau cuti bersama; bukan akhir pekan.');
  if (c.status === 'cuti_bersama') lines.push(opt.cutiOff ? 'Cuti bersama dihitung libur (cuti_bersama_off=true).' : 'Cuti bersama dihitung hari kerja (cuti_bersama_off=false).', CUTI_NOTE);
  if (opt.saturdayWorking && c.weekday_id === 'Sabtu') lines.push('Sabtu dihitung hari kerja (saturday_working=true).');
  const warnings = [];
  if (!available) {
    warnings.push(`Holiday data for ${y} is not available (have ${YEARS.join(', ')}); only the weekend check was applied.`);
    lines.push(`PERINGATAN: data libur ${y} belum tersedia (tersedia ${YEARS.join(', ')}); hanya akhir pekan yang diperiksa.`);
  }
  const { day: _d, ...rest } = c;
  return answer(lines.join('\n'), { ...rest, holiday_data_available: available, options: optionsJson(opt), warnings }, sourcesFor(y, y));
}

function hitungHariKerja(args) {
  let start = parseDate(args.start, 'start', { allowEmptyToday: false });
  let end = parseDate(args.end, 'end', { allowEmptyToday: false });
  const opt = options(args);
  const countStart = boolArg(args.count_start, 'count_start', true);
  const reversed = start > end;
  if (reversed) [start, end] = [end, start];
  requireDataRange(start, end, 'jumlah hari kerja');
  const from = countStart ? start : start + 1;
  let working = 0;
  let weekend = 0;
  const offDays = []; // non-weekend days off (holidays), plus holidays that fell on a weekend
  const cutiCountedAsWork = [];
  for (let day = from; day <= end; day++) {
    const c = classify(day, opt);
    if (c.is_working_day) working++;
    if (c.reasons.some(r => r.type === 'akhir_pekan')) weekend++;
    const hol = c.reasons.filter(r => r.type !== 'akhir_pekan');
    if (hol.length) {
      const entry = { date: c.date, weekday_id: c.weekday_id, type: hol[0].type, name: hol[0].name, on_weekend: c.reasons.some(r => r.type === 'akhir_pekan') };
      if (!c.is_working_day) offDays.push(entry); else cutiCountedAsWork.push(entry);
    }
  }
  const calendar = Math.max(0, end - from + 1);
  const holidaysOnWorkdays = offDays.filter(h => !h.on_weekend);
  const lines = [
    `Hari kerja ${countStart ? 'dari' : 'setelah'} ${longId(start)} sampai ${longId(end)}: ${working} hari kerja (dari ${calendar} hari kalender).`,
    `Akhir pekan: ${weekend} hari (${opt.saturdayWorking ? 'Minggu saja, Sabtu masuk kerja' : 'Sabtu dan Minggu'}). Libur pada hari biasa: ${holidaysOnWorkdays.length} hari.`,
  ];
  if (reversed) lines.push('Catatan: tanggal awal lebih besar dari tanggal akhir, jadi urutannya ditukar. / start was after end; the range was swapped.');
  for (const h of holidaysOnWorkdays.slice(0, 60)) lines.push(`- ${h.date} (${h.weekday_id}): ${h.name} (${TYPE_ID[h.type]})`);
  if (holidaysOnWorkdays.length > 60) lines.push(`- ... dan ${holidaysOnWorkdays.length - 60} lainnya (lihat JSON).`);
  if (cutiCountedAsWork.length) lines.push(`${cutiCountedAsWork.length} hari cuti bersama dihitung hari kerja (cuti_bersama_off=false).`);
  lines.push(`Catatan: ${ISLAMIC_NOTE}`);
  return answer(lines.join('\n'), {
    start: ymdOf(start), end: ymdOf(end), reversed, count_start: countStart,
    working_days: working, calendar_days: calendar, weekend_days: weekend,
    holidays_on_weekdays: holidaysOnWorkdays.length,
    days_off: offDays,
    cuti_bersama_counted_as_working: cutiCountedAsWork,
    options: optionsJson(opt),
  }, sourcesFor(fromDay(start).y, fromDay(end).y));
}

function hariKerjaBerikutnya(args) {
  const start = parseDate(args.date, 'date', { allowEmptyToday: true });
  const n = intArg(args.n, 'n', { min: -750, max: 750, required: true });
  const opt = options(args);
  const step = n < 0 ? -1 : 1;
  const skipped = [];
  let day = start;
  let remaining = Math.abs(n);
  const visit = d => {
    if (!hasData(d)) requireDataRange(d, d, 'tanggal hasil');
    return classify(d, opt);
  };
  if (n === 0) {
    while (!visit(day).is_working_day) {
      skipped.push(day);
      day += 1;
    }
  } else {
    while (remaining > 0) {
      day += step;
      if (visit(day).is_working_day) remaining--; else skipped.push(day);
    }
  }
  const skippedInfo = skipped.map(d => {
    const c = classify(d, opt);
    return { date: c.date, weekday_id: c.weekday_id, reasons: c.reasons };
  });
  const holidaysSkipped = skippedInfo
    .filter(s => s.reasons.some(r => r.type !== 'akhir_pekan'))
    .map(s => ({ date: s.date, weekday_id: s.weekday_id, holidays: s.reasons.filter(r => r.type !== 'akhir_pekan').map(r => ({ type: r.type, name: r.name })) }));
  const verb = n === 0 ? 'Hari kerja terdekat mulai' : n > 0 ? `${n} hari kerja setelah` : `${-n} hari kerja sebelum`;
  const lines = [`${verb} ${longId(start)}: ${longId(day)} (${ymdOf(day)}).`];
  if (n !== 0) lines.push(`Tanggal awal tidak dihitung. Melewati ${skipped.length} hari libur/akhir pekan.`);
  for (const s of holidaysSkipped.slice(0, 40)) lines.push(`- dilewati ${s.date} (${s.weekday_id}): ${s.holidays.map(h => `${h.name} (${TYPE_ID[h.type]})`).join(', ')}`);
  lines.push(`Catatan: ${ISLAMIC_NOTE}`);
  return answer(lines.join('\n'), {
    date: ymdOf(start), n, result: ymdOf(day), result_weekday: DAY_EN[weekdayOf(day)], result_weekday_id: HARI[weekdayOf(day)],
    calendar_days_between: Math.abs(day - start), skipped_days: skippedInfo.length, skipped_holidays: holidaysSkipped.slice(0, 200),
    options: optionsJson(opt),
  }, sourcesFor(fromDay(Math.min(start, day)).y, fromDay(Math.max(start, day)).y));
}

const OPT_PROPS = {
  cuti_bersama_off: { type: 'boolean', default: true, description: 'Treat cuti bersama (collective leave) as a day off. Default true. Set false for businesses that work on cuti bersama.' },
  saturday_working: { type: 'boolean', default: false, description: 'Saturday is a working day (6-day work week). Default false. National holidays on Saturday stay off.' },
};
const DATE_DESC = 'Date as YYYY-MM-DD (also DD-MM-YYYY, DD/MM/YYYY, or "today"/"hari ini" in Asia/Jakarta).';
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: 'daftar_libur',
    title: 'Daftar hari libur / List holidays',
    description: `Daftar libur nasional dan cuti bersama Indonesia per tahun (opsional per bulan), sesuai SKB 3 Menteri, lengkap dengan nomor SKB dan sumber. `
      + `Lists Indonesian national public holidays and collective leave for ${YEARS.join(', ')}. Offline, free.`,
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', minimum: MIN_YEAR, maximum: MAX_YEAR, description: `Year (${YEARS.join(', ')}).` },
        month: { type: 'integer', minimum: 1, maximum: 12, description: 'Optional month 1-12.' },
        include_cuti_bersama: { type: 'boolean', default: true, description: 'Include cuti bersama (collective leave). Default true.' },
      },
      required: ['year'],
      additionalProperties: false,
    },
    annotations: { title: 'Daftar libur', ...READ_ONLY },
  },
  {
    name: 'cek_tanggal',
    title: 'Cek tanggal / Check a date',
    description: 'Cek apakah suatu tanggal libur nasional, cuti bersama, akhir pekan, atau hari kerja, beserta alasannya. '
      + 'Checks whether a date is a holiday, weekend or working day in Indonesia, with the reason. Default date: today (Asia/Jakarta).',
    inputSchema: {
      type: 'object',
      properties: { date: { type: 'string', description: `${DATE_DESC} Default today.` }, ...OPT_PROPS },
      additionalProperties: false,
    },
    annotations: { title: 'Cek tanggal', ...READ_ONLY },
  },
  {
    name: 'hitung_hari_kerja',
    title: 'Hitung hari kerja / Count working days',
    description: 'Menghitung jumlah hari kerja di antara dua tanggal (tidak termasuk akhir pekan, libur nasional, dan opsional cuti bersama). '
      + 'Counts Indonesian working days between two dates, inclusive of both by default. Reversed ranges are swapped.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: `Start date. ${DATE_DESC}` },
        end: { type: 'string', description: `End date (inclusive). ${DATE_DESC}` },
        count_start: { type: 'boolean', default: true, description: 'Count the start date itself. Default true. Set false for "working days after start, up to and including end".' },
        ...OPT_PROPS,
      },
      required: ['start', 'end'],
      additionalProperties: false,
    },
    annotations: { title: 'Hitung hari kerja', ...READ_ONLY },
  },
  {
    name: 'hari_kerja_berikutnya',
    title: 'Tambah hari kerja / Add working days',
    description: 'Tanggal setelah N hari kerja dari suatu tanggal (untuk SLA, tenggat, estimasi pengiriman). N negatif = mundur. N=0 = hari kerja terdekat. '
      + 'Adds N Indonesian working days to a date (start date not counted), skipping weekends, holidays and optionally cuti bersama.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: `Start date. ${DATE_DESC} Default today.` },
        n: { type: 'integer', minimum: -750, maximum: 750, description: 'Working days to add (negative = go back, 0 = this date if it is a working day, else the next one).' },
        ...OPT_PROPS,
      },
      required: ['n'],
      additionalProperties: false,
    },
    annotations: { title: 'Tambah hari kerja', ...READ_ONLY },
  },
];

function callTool(name, args) {
  if (name === 'daftar_libur') return daftarLibur(args);
  if (name === 'cek_tanggal') return cekTanggal(args);
  if (name === 'hitung_hari_kerja') return hitungHariKerja(args);
  if (name === 'hari_kerja_berikutnya') return hariKerjaBerikutnya(args);
  throw Object.assign(new Error(`Unknown tool: ${name}`), { rpcCode: -32602 });
}

// ---------- JSON-RPC over stdio ----------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  if (typeof method !== 'string') {
    if (isRequest) send({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid request' } });
    return;
  }
  if (!isRequest) return; // notifications need no answer
  try {
    let res;
    switch (method) {
      case 'initialize': {
        const asked = params && params.protocolVersion;
        res = {
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : DEFAULT_PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'mcp-hari-libur-indonesia', title: 'Hari Libur Indonesia', version: VERSION },
          instructions: `Indonesian national holidays and cuti bersama for ${YEARS.join(', ')} from the SKB 3 Menteri, plus working-day math `
            + '(cek_tanggal, hitung_hari_kerja, hari_kerja_berikutnya). Dates are YYYY-MM-DD; "today" is Asia/Jakarta. Works offline.',
        };
        break;
      }
      case 'ping': res = {}; break;
      case 'tools/list': res = { tools: TOOLS }; break;
      case 'resources/list': res = { resources: [] }; break;
      case 'resources/templates/list': res = { resourceTemplates: [] }; break;
      case 'prompts/list': res = { prompts: [] }; break;
      case 'tools/call': {
        const name = params && params.name;
        if (!TOOLS.some(t => t.name === name)) {
          send({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${String(name).slice(0, 100)}` } });
          return;
        }
        const args = (params && params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)) ? params.arguments : {};
        try {
          res = callTool(name, args);
        } catch (e) {
          if (!(e instanceof ToolError)) log('tool failed:', e && e.stack || e);
          res = { content: [{ type: 'text', text: e instanceof ToolError ? e.message : 'Terjadi kesalahan tak terduga. / Unexpected error.' }], isError: true };
        }
        break;
      }
      default:
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method.slice(0, 100)}` } });
        return;
    }
    send({ jsonrpc: '2.0', id, result: res });
  } catch (e) {
    log('request failed:', e && e.stack || e);
    send({ jsonrpc: '2.0', id, error: { code: e.rpcCode || -32603, message: String(e.message || 'Internal error').slice(0, 200) } });
  }
}

function main() {
  log(`v${VERSION} ready; holiday data ${YEARS.join(', ')}; offline.`);
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', line => {
    if (!line.trim()) return;
    if (line.length > 1024 * 1024) {
      send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request too large' } });
      return;
    }
    let msg;
    try { msg = JSON.parse(line); } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
    for (const m of Array.isArray(msg) ? msg : [msg]) handle(m && typeof m === 'object' ? m : {});
  });
  rl.on('close', () => process.exit(0));
}

main();
