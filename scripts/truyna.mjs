// Đồng bộ danh sách truy nã công khai (truyna.bocongan.gov.vn) → Supabase bảng truy_na.
//
//   npm run truyna                 đọc đủ mọi trang trên web, ghi du-lieu/truyna.json + .xlsx, cập nhật
//                                  Supabase, XOÁ HẲN đối tượng không còn trên trang, quét lại cảnh báo
//   npm run truyna -- nhanh        chỉ 5 trang đầu (người mới bị truy nã nằm đầu danh sách), không xoá
//   npm run truyna -- nhap [tệp]   nhập file AutoWeb xuất ra (.xlsx / .csv / .json, mặc định assets/dstruyna.json): chèn cột
//                                  DIADANH_MOI ngay sau NOIDKTT, ghi lại <tệp>.json + <tệp>.xlsx, rồi cập nhật
//                                  Supabase + XOÁ HẲN đối tượng không có trong tệp (tệp phải là danh sách đầy đủ)
//   npm run truyna -- tinh         nạp bảng tinh_cu_moi (tỉnh cũ/mới → tỉnh mới) từ assets/data.json
//   tuỳ chọn: --khong-db (chỉ ghi tệp)  --trang N (tối đa N trang web)  --chi-tiet N (đọc trang chi tiết
//             của tối đa N đối tượng chưa có thông tin báo tin, mặc định 150)
//
// Đọc web chậm (nghỉ giữa các trang) để không làm nặng máy chủ của Bộ.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bangTinh, doiDiaChi } from './dia-chi.mjs';
import { taoXlsx } from './xlsx.mjs';
import { docBang } from './doc-bang.mjs';

const GOC = 'https://truyna.bocongan.gov.vn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LuuTruSync/1.0';
const NGHI_MS = 1500;
const TIEU_DE = ['STT', 'Họ tên đối tượng', 'Năm sinh', 'Nơi ĐKTT', 'Họ tên bố/mẹ', 'Tội danh', 'Số ngày QĐ', 'Đơn vị ra QĐ'];

// ---------- tham số ----------
const argv = process.argv.slice(2);
const lenh = argv.find(a => !a.startsWith('--')) || 'day-du';
const co = k => argv.includes(k);
const so = (k, mac) => { const i = argv.indexOf(k); return i >= 0 ? Number(argv[i + 1]) : mac; };
// --chi-json / --chi-csv: chỉ ghi <tên file>.json / .csv cạnh file Excel (không ghi .xlsx, không đụng Supabase)
const CHI_JSON = co('--chi-json');
const CHI_CSV = co('--chi-csv');
const KHONG_DB = co('--khong-db') || CHI_JSON || CHI_CSV;
const TOI_DA_TRANG = so('--trang', lenh === 'nhanh' ? 5 : Infinity);
const SO_CHI_TIET = so('--chi-tiet', 150);
const TEP_NHAP = lenh === 'nhap'
  ? resolve(argv.find((a, i) => i > argv.indexOf('nhap') && !a.startsWith('--') && !/^\d+$/.test(a)) || 'assets/dstruyna.json')
  : null;

// ---------- Supabase REST (secret key, bỏ qua RLS) ----------
let env = {};
try {
  env = Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  );
} catch {}
const H = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' };
async function db(path, opts = {}) {
  const r = await fetch(env.SUPABASE_URL + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status} ${path.split('?')[0]}: ${text.slice(0, 300)}`);
  return { body: text ? JSON.parse(text) : null, headers: r.headers };
}

// Dữ liệu truy nã lưu TOÀN CHỮ IN HOA (theo yêu cầu). Mã MA, năm sinh giữ nguyên.
const hoa = v => (v == null ? v : String(v).toLocaleUpperCase('vi'));
// KHÔNG in hoa tinh_moi: SQL so khớp nó với bảng tinh_cu_moi (chữ thường)
const COT_CHU = ['ho_ten', 'noi_dktt', 'dktt_moi', 'ten_bo', 'ten_me', 'toi_danh', 'quyet_dinh', 'don_vi_1', 'don_vi_ca'];
const inHoa = r => { const o = { ...r }; for (const k of COT_CHU) if (o[k]) o[k] = hoa(o[k]); return o; };

// ---------- tải + đọc trang web ----------
const nghi = ms => new Promise(r => setTimeout(r, ms));
async function tai(url, lan = 1) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'vi' }, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    if (lan >= 3) throw new Error(`Tải ${url} lỗi: ${e.message}`);
    await nghi(3000 * lan);
    return tai(url, lan + 1);
  }
}

const giaiMa = s => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// ô HTML → các dòng chữ (<br> tách dòng)
const dong = h => giaiMa(h.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
  .split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);

function docTrangDanhSach(html) {
  const i = html.indexOf('class="table-view"');
  if (i < 0) throw new Error('Không thấy bảng .table-view — trang đã đổi giao diện?');
  const bang = html.slice(i, html.indexOf('</table>', i));
  const th = [...bang.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => dong(m[1]).join(' '));
  if (th.join('|') !== TIEU_DE.join('|')) throw new Error(`Tiêu đề bảng đã đổi: ${th.join(' | ')}`);
  const tbody = bang.slice(bang.indexOf('<tbody'));
  const ds = [];
  for (const m of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const td = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1]);
    if (td.length !== 8) continue;
    const ma = /ChiTiet\/([0-9a-fA-F-]{36})/.exec(td[1])?.[1];
    if (!ma) continue;
    const [bo = '', me = ''] = dong(td[4]);
    const dv = dong(td[7]);
    const ns = dong(td[2])[0] || '';
    ds.push({
      stt: dong(td[0])[0] || '',
      ma: ma.toLowerCase(),
      ho_ten: dong(td[1]).join(' '),
      nam_sinh: /^\d{4}$/.test(ns) ? Number(ns) : null,
      noi_dktt: dong(td[3]).join(' '),
      ten_bo: bo,
      ten_me: me,
      toi_danh: dong(td[5]).join(' '),
      quyet_dinh: dong(td[6]).join(' '),
      don_vi_1: dv[0] || '',
      don_vi_ca: dv.slice(1).join(', '),
    });
  }
  const t = /Tổng số\s*([\d.,]+)\s*đối tượng trong\s*([\d.,]+)\s*trang/.exec(giaiMa(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' '));
  const soNguyen = s => Number(String(s).replace(/[.,]/g, ''));
  return { ds, tong: t ? soNguyen(t[1]) : null, soTrang: t ? soNguyen(t[2]) : null };
}

function docTrangChiTiet(html) {
  const tk = giaiMa(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').split(/<[^>]+>/).join('\n'))
    .split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const nhan = ['Phạm vi truy nã', 'Loại truy nã', 'Báo cho đơn vị', 'Số điện thoại', 'Quyết định truy nã', 'Đơn vị ra quyết định', 'Khi phát hiện báo cho'];
  const lay = l => { const i = tk.indexOf(l); const v = i >= 0 ? tk[i + 1] : null; return v && !nhan.includes(v) ? v : null; };
  return { pham_vi: lay('Phạm vi truy nã'), loai_truy_na: lay('Loại truy nã'), bao_cho: lay('Báo cho đơn vị'), sdt_bao: lay('Số điện thoại') };
}

// ---------- tệp AutoWeb (STT, MA, HOTEN, NAMSINH, NOIDKTT, TENBO, TENME, TOIDANH, QUYETDINH, DONVI, DONVI_CA) ----------
async function docTepAutoWeb(tep) {
  let ds;
  if (/\.json$/i.test(tep)) {
    const j = JSON.parse(readFileSync(tep, 'utf8'));
    ds = Array.isArray(j) ? j : Object.values(j).find(Array.isArray);
  } else {
    ds = (await docBang(tep)).dong; // .xlsx / .csv — cột theo dòng tiêu đề (STT, MA, HOTEN, ...)
  }
  if (!ds?.length) throw new Error(`Tệp ${tep} không có danh sách`);
  return ds.filter(x => /^[0-9a-fA-F-]{36}$/.test(String(x.MA || ''))).map(x => {
    const ns = String(x.NAMSINH ?? '').trim();
    return {
      stt: String(x.STT ?? ''),
      ma: x.MA.toLowerCase(),
      ho_ten: String(x.HOTEN || '').trim(),
      nam_sinh: /^\d{4}$/.test(ns) ? Number(ns) : null,
      noi_dktt: String(x.NOIDKTT || '').trim(),
      ten_bo: x.TENBO || '',
      ten_me: x.TENME || '',
      toi_danh: x.TOIDANH || '',
      quyet_dinh: x.QUYETDINH || '',
      don_vi_1: x.DONVI || '',
      don_vi_ca: x.DONVI_CA || '',
    };
  });
}

// Xuất lại theo đúng cột AutoWeb, cột DIADANH_MOI nằm NGAY SAU NOIDKTT (trống nếu không có trong data)
const COT_XUAT = ['STT', 'MA', 'HOTEN', 'NAMSINH', 'NOIDKTT', 'DIADANH_MOI', 'TENBO', 'TENME', 'TOIDANH', 'QUYETDINH', 'DONVI', 'DONVI_CA'];
function ghiTep(rows, goc) {
  const ds = rows.map(r => ({
    STT: r.stt, MA: r.ma, HOTEN: r.ho_ten, NAMSINH: r.nam_sinh == null ? '' : String(r.nam_sinh),
    NOIDKTT: r.noi_dktt, DIADANH_MOI: r.dktt_moi || '', TENBO: r.ten_bo, TENME: r.ten_me,
    TOIDANH: r.toi_danh, QUYETDINH: r.quyet_dinh, DONVI: r.don_vi_1, DONVI_CA: r.don_vi_ca,
  }));
  if (CHI_CSV) {
    // Quy ước CSV cho trình nhập của Supabase (giống replaceBieuMau): dấu phẩy, UTF-8 không BOM, \n,
    // ô rỗng không bọc nháy (vào CSDL là NULL), bọc nháy khi ô có , " xuống dòng hoặc khoảng trắng ở biên
    const o = v => {
      const s = v == null ? '' : String(v);
      if (s === '') return '';
      return /[",\n\r]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [COT_XUAT.join(','), ...ds.map(d => COT_XUAT.map(c => o(d[c])).join(','))].join('\n') + '\n';
    writeFileSync(`${goc}.csv`, csv, 'utf8');
    return [`${goc}.csv`];
  }
  writeFileSync(`${goc}.json`, JSON.stringify(ds, null, 1), 'utf8');
  if (CHI_JSON) return [`${goc}.json`];
  writeFileSync(`${goc}.xlsx`, taoXlsx([{ ten: 'dstruyna', cot: COT_XUAT, dong: ds }]));
  return [`${goc}.json`, `${goc}.xlsx`];
}

// ---------- Supabase ----------
async function napTinh() {
  const rows = bangTinh();
  await db('/rest/v1/tinh_cu_moi?on_conflict=khoa', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  });
  console.log(`✓ Đã nạp ${rows.length} khoá tỉnh cũ/mới vào tinh_cu_moi`);
}

async function maDaCo() {
  const m = new Map();
  for (let tu = 0; ; tu += 1000) {
    const { body } = await db(`/rest/v1/truy_na?select=ma,bao_cho&order=ma`, { headers: { Range: `${tu}-${tu + 999}` } });
    body.forEach(r => m.set(r.ma, r.bao_cho));
    if (body.length < 1000) return m;
  }
}

async function dongBo() {
  const batDau = new Date().toISOString();
  const kieu = TEP_NHAP ? 'tep' : TOI_DA_TRANG === Infinity ? 'day-du' : 'nhanh';
  let logId = null;
  const log = async patch => {
    if (KHONG_DB) return;
    if (!logId) {
      const { body } = await db('/rest/v1/dong_bo_truy_na?select=id', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ kieu, bat_dau: batDau, ...patch }),
      });
      logId = body[0].id;
    } else {
      await db(`/rest/v1/dong_bo_truy_na?id=eq.${logId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    }
  };

  try {
    await log({});
    const daCo = KHONG_DB ? new Map() : await maDaCo();

    // 1. lấy danh sách: từ tệp AutoWeb hoặc đọc web
    const tatCa = new Map();
    let tong = null, du = false;
    if (TEP_NHAP) {
      (await docTepAutoWeb(TEP_NHAP)).forEach(r => tatCa.set(r.ma, r));
      // AutoWeb đánh STT liên tục 1..N → tệp đủ khi STT lớn nhất ≈ số đối tượng
      tong = Math.max(0, ...[...tatCa.values()].map(r => Number(r.stt) || 0)) || tatCa.size;
      du = true;
      console.log(`Tệp ${TEP_NHAP}: ${tatCa.size} đối tượng (STT lớn nhất ${tong})`);
    } else {
      let soTrang = 1, docDuoc = 0;
      const het = () => Math.min(soTrang, TOI_DA_TRANG);
      for (let p = 1; p <= het(); p++) {
        const kq = docTrangDanhSach(await tai(`${GOC}/?page=${p}`));
        if (p === 1) { tong = kq.tong; soTrang = kq.soTrang || 1; console.log(`Trang có ${tong} đối tượng / ${soTrang} trang`); }
        kq.ds.forEach(r => tatCa.set(r.ma, r));
        docDuoc = p;
        process.stdout.write(`\r  đã đọc trang ${p}/${het()} — ${tatCa.size} đối tượng`);
        if (p < het()) await nghi(NGHI_MS);
      }
      console.log('');
      du = kieu === 'day-du' && docDuoc === soTrang;
    }

    // 2. địa danh mới (không có trong data thì để trống)
    const rows = [...tatCa.values()].map(r => {
      const { diaDanhMoi, tinhMoi } = doiDiaChi(r.noi_dktt);
      return inHoa({ ...r, dktt_moi: diaDanhMoi, tinh_moi: tinhMoi });
    });
    console.log(`Địa danh mới: tìm được ${rows.filter(r => r.dktt_moi).length}/${rows.length}, còn lại để trống`);
    const goc = TEP_NHAP && (CHI_JSON || CHI_CSV)
      ? TEP_NHAP.replace(/\.(xlsx|csv|txt|json)$/i, '') + (CHI_CSV && /\.csv$/i.test(TEP_NHAP) ? '-diadanh' : '') // dstruyna.xlsx → dstruyna.csv
      : TEP_NHAP
      ? (/\.json$/i.test(TEP_NHAP) ? TEP_NHAP.replace(/\.json$/i, '') : TEP_NHAP.replace(/\.(xlsx|csv|txt)$/i, '') + '-diadanh')
      : resolve('du-lieu/truyna');
    if (!TEP_NHAP) mkdirSync(resolve('du-lieu'), { recursive: true });
    console.log(`✓ Đã ghi (cột DIADANH_MOI cạnh NOIDKTT):\n  ${ghiTep(rows, goc).join('\n  ')}`);
    if (KHONG_DB) return;

    // 3. ghi Supabase theo lô
    const moi = rows.filter(r => !daCo.has(r.ma));
    for (let i = 0; i < rows.length; i += 500) {
      const lo = rows.slice(i, i + 500).map(r => ({
        ma: r.ma, ho_ten: r.ho_ten, nam_sinh: r.nam_sinh, noi_dktt: r.noi_dktt,
        dktt_moi: r.dktt_moi || null, tinh_moi: r.tinh_moi || null, ten_bo: r.ten_bo, ten_me: r.ten_me,
        toi_danh: r.toi_danh, quyet_dinh: r.quyet_dinh, don_vi: [r.don_vi_1, r.don_vi_ca].filter(Boolean).join(', '),
        lan_cuoi_thay: batDau,
      }));
      await db('/rest/v1/truy_na?on_conflict=ma', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(lo),
      });
    }
    console.log(`✓ Đã cập nhật ${rows.length} đối tượng (${moi.length} mới)`);

    // 4. XOÁ HẲN đối tượng không còn trong danh sách — chỉ khi danh sách ĐẦY ĐỦ
    let soXoa = 0;
    if (du && tong && rows.length >= tong * 0.95) {
      const { body } = await db(`/rest/v1/truy_na?lan_cuoi_thay=lt.${encodeURIComponent(batDau)}&select=ma`, {
        method: 'DELETE', headers: { Prefer: 'return=representation' },
      });
      soXoa = body.length;
      console.log(`✓ Đã xoá ${soXoa} đối tượng không còn trong danh sách`);
    } else if (kieu !== 'nhanh') {
      console.log(`! Không xoá: danh sách chưa đầy đủ (${rows.length}/${tong})`);
    }

    // 5. trang chi tiết (đơn vị báo tin, SĐT) cho người chưa có
    const canChiTiet = rows.filter(r => !daCo.get(r.ma)).slice(0, SO_CHI_TIET);
    for (const [k, r] of canChiTiet.entries()) {
      try {
        const ct = docTrangChiTiet(await tai(`${GOC}/TimKiem/ChiTiet/${r.ma}`));
        for (const k of ['pham_vi', 'loai_truy_na', 'bao_cho']) if (ct[k]) ct[k] = hoa(ct[k]);
        if (ct.bao_cho || ct.pham_vi) await db(`/rest/v1/truy_na?ma=eq.${r.ma}`, { method: 'PATCH', body: JSON.stringify(ct) });
      } catch (e) {
        console.log(`\n  bỏ qua chi tiết ${r.ma}: ${e.message}`);
      }
      process.stdout.write(`\r  chi tiết ${k + 1}/${canChiTiet.length}`);
      await nghi(800);
    }
    if (canChiTiet.length) console.log('');

    // 6. so lại với người đang lưu trú → cảnh báo (trigger tự gửi push cho cán bộ)
    const { body: soCanhBao } = await db('/rest/v1/rpc/quet_lai_truy_na', { method: 'POST', body: '{}' });
    console.log(`✓ Cảnh báo mới: ${soCanhBao}`);

    await log({ ket_thuc: new Date().toISOString(), tong_tren_trang: tong, so_doc: rows.length, so_moi: moi.length, so_xoa: soXoa, so_canh_bao: soCanhBao });
  } catch (e) {
    await log({ ket_thuc: new Date().toISOString(), loi: e.message }).catch(() => {});
    throw e;
  }
}

try {
  if (lenh === 'tinh') await napTinh();
  else await dongBo();
} catch (e) {
  console.error('\n✗', e.message);
  if (/PGRST205|Could not find the table/.test(e.message)) console.error('  → chưa chạy sql/02-truy-na.sql trong SQL Editor');
  process.exitCode = 1;
}
