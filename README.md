# mcp-hari-libur-indonesia

An [MCP](https://modelcontextprotocol.io) server that knows **Indonesian national public holidays and cuti bersama (collective leave) for 2025, 2026 and 2027**, taken from the joint ministerial decrees (SKB 3 Menteri), and does **working-day math** with them: is this date a working day, how many working days between two dates, what date is N working days from now. Offline, no API key, one file, zero dependencies.

Example: *"Kalau pesanan masuk 17 Maret 2026 dan SLA-nya 3 hari kerja, kapan paling lambat dikirim?"* → 27 March 2026 (Nyepi and the Lebaran holidays are skipped).

> 🇮🇩 Bahasa Indonesia: lihat [bagian di bawah](#bahasa-indonesia).

- Every holiday cites its decree number and a source link; every answer ends with the source line.
- Choose whether **cuti bersama** counts as a day off (it is leave, not a public holiday) and whether **Saturday** is a working day.
- Timezone-safe: dates are plain calendar days, never converted through your machine's timezone. "Today" means today in Asia/Jakarta (WIB).
- Answers in Indonesian, with a JSON block in English field names.

## Tools

| Tool | What it does | Input |
|---|---|---|
| `daftar_libur` | Lists national holidays and cuti bersama of a year (optionally one month), with weekday, type and the SKB source. | `year` (2025-2027), `month` (1-12), `include_cuti_bersama` (default true) |
| `cek_tanggal` | Is a date a national holiday, cuti bersama, weekend or working day? Gives every reason (e.g. "Idulfitri + Sunday"). | `date` (default today), `cuti_bersama_off`, `saturday_working` |
| `hitung_hari_kerja` | Working days between two dates (both ends included by default), with the list of holidays that fell on weekdays. Reversed ranges are swapped and flagged. | `start`, `end`, `count_start` (default true), `cuti_bersama_off`, `saturday_working` |
| `hari_kerja_berikutnya` | The date N working days after (or before, with negative N) a date. The start date is not counted. `n: 0` gives the date itself if it is a working day, else the next one. Good for SLA, deadline and shipping estimates. | `date` (default today), `n` (-750..750), `cuti_bersama_off`, `saturday_working` |

Options shared by the last three tools:

| Option | Default | Meaning |
|---|---|---|
| `cuti_bersama_off` | `true` | Treat cuti bersama as a day off. Set `false` for businesses that keep working on cuti bersama. |
| `saturday_working` | `false` | 6-day week: Saturday is a working day. National holidays on a Saturday stay off. |

Dates: `YYYY-MM-DD` (also `DD-MM-YYYY`, `DD/MM/YYYY`, `DD.MM.YYYY`, `today`, `hari ini`). US order `MM/DD/YYYY` is rejected rather than misread. Impossible dates (e.g. `2026-02-29`, `2026-04-31`) are rejected with the reason.

Example JSON (shortened) from `hari_kerja_berikutnya` with `{"date": "2026-12-23", "n": 5}`:

```json
{
  "date": "2026-12-23",
  "n": 5,
  "result": "2027-01-04",
  "result_weekday": "Monday",
  "skipped_holidays": [
    { "date": "2026-12-24", "holidays": [{ "type": "cuti_bersama", "name": "Cuti bersama Kelahiran Yesus Kristus" }] },
    { "date": "2026-12-25", "holidays": [{ "type": "libur_nasional", "name": "Kelahiran Yesus Kristus" }] },
    { "date": "2027-01-01", "holidays": [{ "type": "libur_nasional", "name": "Tahun Baru 2027 Masehi" }] }
  ],
  "options": { "cuti_bersama_off": true, "saturday_working": false, "timezone": "Asia/Jakarta" }
}
```

## Install

Requires **Node.js 18+** (`node -v`). With npx there is nothing else to install: your app runs `npx -y mcp-hari-libur-indonesia`.

**Claude Desktop**: Settings → Developer → Edit Config (`claude_desktop_config.json`), then fully quit and reopen Claude Desktop.

```json
{
  "mcpServers": {
    "hari-libur": {
      "command": "npx",
      "args": ["-y", "mcp-hari-libur-indonesia"]
    }
  }
}
```

**Claude Code**

```bash
claude mcp add hari-libur -- npx -y mcp-hari-libur-indonesia
```

Add `--scope user` to make it available in every project. Check with `claude mcp list`.

**Cursor**: `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project), same JSON as Claude Desktop.

**OpenCode**: `opencode.json` in the project, or `~/.config/opencode/opencode.json`.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "hari-libur": {
      "type": "local",
      "command": ["npx", "-y", "mcp-hari-libur-indonesia"],
      "enabled": true
    }
  }
}
```

**Windows**: if the app cannot start `npx`, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "mcp-hari-libur-indonesia"]`.

**From source**: `git clone https://github.com/EzkielynaGroup/mcp-hari-libur-indonesia.git`, then `"command": "node"` with `"args": ["/full/path/to/mcp-hari-libur-indonesia.mjs"]`.

No environment variables are needed.

## Data sources

The holiday list is bundled as a JSON block inside `mcp-hari-libur-indonesia.mjs` (between `BEGIN HOLIDAY DATA` and `END HOLIDAY DATA`), with the decree and source link per year. Checked on **11 Nov 2026**.

| Year | Decree (SKB Menteri Agama, Menteri Ketenagakerjaan, Menteri PANRB) | Signed | Days | Source |
|---|---|---|---|---|
| 2025 | Nomor 1017 Tahun 2024, Nomor 2 Tahun 2024, Nomor 2 Tahun 2024; **amended** by Nomor 933 Tahun 2025, Nomor 1 Tahun 2025, Nomor 3 Tahun 2025 (signed 7 Aug 2025: adds cuti bersama on 18 Aug 2025) | 14 Oct 2024 | 17 libur nasional + 11 cuti bersama (10 + 1 added) | [Kemenko PMK](https://www.kemenkopmk.go.id/pemerintah-tetapkan-hari-libur-nasional-dan-cuti-bersama-tahun-2025), [Setneg (amendment)](https://setneg.go.id/baca/index/sambut_hut_ke_80_kemerdekaan_ri_pemerintah_tetapkan_18_agustus_2025_sebagai_cuti_bersama) |
| 2026 | Nomor 1497 Tahun 2025, Nomor 2 Tahun 2025, Nomor 5 Tahun 2025 | 19 Sep 2025 | 17 libur nasional + 8 cuti bersama | [Setneg](https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026) |
| 2027 | Nomor 1205 Tahun 2026, Nomor 3 Tahun 2026, Nomor 2 Tahun 2026 | 15 Sep 2026 | 18 libur nasional + 8 cuti bersama | [Setneg](https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027) |

What to know about the data:

- **Eid dates.** Each SKB says 1 Ramadan, Idulfitri and Iduladha are confirmed by a decision of the Minister of Religious Affairs (after the isbat session). For 2025 and 2026 the confirmed dates matched the SKB (Idulfitri 1446 H on 31 Mar 2025, Iduladha 1446 H on 6 Jun 2025, Idulfitri 1447 H on 21 Mar 2026, Iduladha 1447 H on 27 May 2026, per news reports of the isbat results). For 2027 they are not confirmed yet, so treat 2027 Eid dates as planned.
- **2027 has two Isra Mikraj holidays** (5 Jan 2027 and 26 Dec 2027), because the Islamic calendar is about 11 days shorter than the Gregorian year. This is in the decree, not a duplicate.
- **Not included:** regional holidays, optional holidays (libur fakultatif), and one-off holidays such as election days. Changes to a decree after 11 Nov 2026 are not included until the data is updated.
- **Cuti bersama** reduces annual leave. Each SKB leaves the private sector to the employer and the civil service to its own regulation, which is why `cuti_bersama_off` is an option.
- We compiled the dates from the government pages linked above (Setneg and Kemenko PMK publish the decree contents); we did not read the signed decree PDFs themselves. If you find a difference with the decree text, please open an issue with the link.
- The data are dates and names of public holidays published by the government. We redistribute them as factual information with attribution to the sources above.

## Safety and limits

- Offline: no network calls, no files written, no key.
- Ranges are limited to the years with data. Asking about a date outside 2025-2027 in `cek_tanggal` still answers the weekend question and warns that holiday data is missing; `hitung_hari_kerja` and `hari_kerja_berikutnya` refuse instead of guessing.
- Errors come back as short Indonesian + English messages, never stack traces. Logs go to stderr; stdout carries only MCP messages.

## FAQ

**What are the public holidays in Indonesia in 2026?**
17 national holidays and 8 cuti bersama days, set by SKB 3 Menteri Nomor 1497 Tahun 2025, 2 Tahun 2025 and 5 Tahun 2025. Ask `daftar_libur` with `year: 2026` for the full list with weekdays.

**Is cuti bersama a public holiday in Indonesia?**
No. Cuti bersama is collective leave that reduces annual leave; national holidays (libur nasional) are separate. Private employers decide whether to apply cuti bersama, so this server lets you count it as off or as a working day.

**How do I count working days in Indonesia excluding holidays?**
Use `hitung_hari_kerja` with a start and end date. It excludes weekends, national holidays and (by default) cuti bersama, and lists every holiday it skipped.

**How do I calculate an SLA deadline in working days for Indonesia?**
Use `hari_kerja_berikutnya` with the order date and the number of working days, e.g. `{"date": "2026-03-17", "n": 3}` returns 27 March 2026 because Nyepi and the Lebaran holidays are skipped.

**Are the 2027 Indonesian holidays already set?**
Yes. SKB 3 Menteri Nomor 1205 Tahun 2026, 3 Tahun 2026 and 2 Tahun 2026 (signed 15 Sep 2026) sets 18 national holidays and 8 cuti bersama days for 2027. Eid dates are still subject to the isbat decision.

## Development

```bash
node --test test/
```

The tests spawn the server over stdio and check every tool, the bundled data (counts per decree, real dates, one entry per date), year boundaries, leap years, reversed ranges, invalid dates, several machine timezones, and a brute-force cross-check against an independent date implementation. No network needed.

To add a year: copy a year block in the data section, fill it from the new SKB (decree, date, source URL, holidays), update the expected counts in the test, run the tests.

---

## Bahasa Indonesia

Server MCP berisi **hari libur nasional dan cuti bersama Indonesia 2025, 2026, dan 2027** dari SKB 3 Menteri, plus **hitungan hari kerja**. Tanpa internet, tanpa API key, cukup Node.js 18+.

**Tools**

- `daftar_libur`: daftar libur nasional dan cuti bersama per tahun (opsional per bulan), lengkap dengan hari, jenis, dan sumber SKB.
- `cek_tanggal`: apakah suatu tanggal libur nasional, cuti bersama, akhir pekan, atau hari kerja, beserta alasannya. Default hari ini (WIB).
- `hitung_hari_kerja`: jumlah hari kerja antara dua tanggal (kedua ujung dihitung). Jika tanggal terbalik, otomatis ditukar dan diberi tanda.
- `hari_kerja_berikutnya`: tanggal setelah N hari kerja (N negatif = mundur). Cocok untuk SLA, tenggat, dan estimasi pengiriman.

**Opsi**: `cuti_bersama_off` (default `true`, cuti bersama dihitung libur; isi `false` bila kantor tetap buka saat cuti bersama) dan `saturday_working` (default `false`; isi `true` untuk 6 hari kerja, libur nasional di hari Sabtu tetap libur).

**Format tanggal**: `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `hari ini`. Tanggal yang tidak ada (mis. `2026-02-29`) ditolak dengan alasannya. Perhitungan memakai tanggal kalender murni, tidak terpengaruh zona waktu komputer; "hari ini" mengikuti Asia/Jakarta.

**Sumber data** (dicek 11 November 2026):

- 2025: SKB Nomor 1017 Tahun 2024, 2 Tahun 2024, 2 Tahun 2024 (14 Okt 2024), diubah dengan SKB Nomor 933 Tahun 2025, 1 Tahun 2025, 3 Tahun 2025 (7 Agu 2025) yang menambah cuti bersama 18 Agustus 2025. Total 17 libur nasional + 11 cuti bersama.
- 2026: SKB Nomor 1497 Tahun 2025, 2 Tahun 2025, 5 Tahun 2025 (19 Sep 2025). 17 libur nasional + 8 cuti bersama.
- 2027: SKB Nomor 1205 Tahun 2026, 3 Tahun 2026, 2 Tahun 2026 (15 Sep 2026). 18 libur nasional + 8 cuti bersama. Tanggal Idulfitri dan Iduladha 2027 masih menunggu sidang isbat Kementerian Agama.

Tidak termasuk libur daerah, libur fakultatif, dan libur khusus (mis. hari pemungutan suara). Data dihimpun dari laman Setneg dan Kemenko PMK yang memuat isi SKB, bukan dari PDF SKB yang ditandatangani. Bila menemukan perbedaan, silakan buka issue beserta tautannya.

**Pasang**: tambahkan `npx -y mcp-hari-libur-indonesia` ke aplikasi Anda (contoh konfigurasi di atas). Di Windows gunakan `cmd /c npx -y mcp-hari-libur-indonesia` bila perlu.

---

Made by Ezkielyna, an independent AI API gateway for Indonesian developers (QRIS): [ezkielyna.store](https://ezkielyna.store/?utm_source=github&utm_medium=readme&utm_campaign=mcp-hari-libur-indonesia).

## License

MIT for the code. Holiday dates are public government information; sources are listed above.
