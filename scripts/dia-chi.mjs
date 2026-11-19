// Đổi địa danh CŨ (trước sáp nhập 2025: 63 tỉnh, có cấp huyện) → địa danh MỚI (34 tỉnh, xã/phường)
// dựa trên assets/data.json: [{ PROVINCE, COMMUNE, DETAIL: [{ province, district, commune }] }]
// — mỗi xã mới kèm danh sách xã/huyện/tỉnh cũ gộp vào.
//
// Quy tắc (theo yêu cầu): địa danh cũ có trong data → trả "Xã/Phường mới, Tỉnh mới";
// không tìm thấy → '' (bỏ trống). Xã cũ bị chia cho nhiều xã mới → nối các xã mới bằng " / ".
//
// LƯU Ý: hàm `loiDiaDanh` phải giữ GIỐNG HỆT hàm SQL public.chuan_hoa_dia_danh (sql/02-truy-na.sql).
import { readFileSync } from 'node:fs';

// bỏ dấu, đ→d, chữ thường, dấu chấm thành khoảng trắng, gộp khoảng trắng
export function chuanHoa(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TIEN_TO = /^(thanh pho|tinh|tp|quan|huyen|thi xa|thi tran|phuong|xa|tx|tt|q|p)\s+/;

// phần lõi của địa danh: "Thành phố Hà Nội" → "ha noi", "Phường 05" → "5", "TP. HCM" giữ "hcm"
export function loiDiaDanh(s) {
  return chuanHoa(s).replace(/\s*\(.*?\)\s*/g, ' ').trim().replace(TIEN_TO, '').replace(/^0+(\d)/, '$1').trim();
}

let _idx = null;
function chiMuc() {
  if (_idx) return _idx;
  const data = JSON.parse(readFileSync(new URL('../assets/data.json', import.meta.url), 'utf8'));
  const ba = new Map(); // tỉnh|huyện|xã (cũ) → Set("Xã mới, Tỉnh mới")
  const hai = new Map(); // tỉnh|xã (cũ) → Set(...)  — dùng khi địa chỉ không ghi huyện
  const tinh = new Map(); // lõi tỉnh cũ HOẶC mới → tên tỉnh mới
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
  for (const x of data) {
    const moi = `${x.COMMUNE}, ${x.PROVINCE}`;
    tinh.set(loiDiaDanh(x.PROVINCE), x.PROVINCE);
    for (const d of x.DETAIL) {
      const p = loiDiaDanh(d.province), h = loiDiaDanh(d.district), c = loiDiaDanh(d.commune);
      add(ba, `${p}|${h}|${c}`, moi);
      add(hai, `${p}|${c}`, moi);
      tinh.set(p, x.PROVINCE);
    }
  }
  _idx = { ba, hai, tinh };
  return _idx;
}

// danh sách tỉnh cũ/mới → tỉnh mới (để nạp bảng tinh_cu_moi trên Supabase)
export function bangTinh() {
  return [...chiMuc().tinh].map(([khoa, tinh_moi]) => ({ khoa, tinh_moi }));
}

/**
 * Địa chỉ cũ (vd "khối 13 Lê Lợi, phường Thành Vinh, Vinh, Nghệ An") →
 * { diaDanhMoi: "Phường Thành Vinh, Tỉnh Nghệ An" | '', tinhMoi: "Tỉnh Nghệ An" | '' }
 */
export function doiDiaChi(diaChi) {
  const { ba, hai, tinh } = chiMuc();
  const seg = String(diaChi ?? '')
    .replace(/\(.*?\)/g, ' ')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  let diaDanhMoi = '';
  // tìm bộ (xã, huyện, tỉnh) liền nhau, ưu tiên từ cuối địa chỉ
  for (let i = seg.length - 1; i >= 2 && !diaDanhMoi; i--) {
    const k = `${loiDiaDanh(seg[i])}|${loiDiaDanh(seg[i - 1])}|${loiDiaDanh(seg[i - 2])}`;
    if (ba.has(k)) diaDanhMoi = [...ba.get(k)].join(' / ');
  }
  // địa chỉ không ghi huyện: "xã X, tỉnh Y" — chỉ nhận khi ra đúng 1 xã mới
  for (let i = seg.length - 1; i >= 1 && !diaDanhMoi; i--) {
    const k = `${loiDiaDanh(seg[i])}|${loiDiaDanh(seg[i - 1])}`;
    if (hai.has(k) && hai.get(k).size === 1) diaDanhMoi = [...hai.get(k)][0];
  }
  // tỉnh mới: lấy từ kết quả, không có thì đoán theo đoạn cuối địa chỉ
  let tinhMoi = '';
  if (diaDanhMoi) tinhMoi = diaDanhMoi.split(' / ')[0].split(', ').pop();
  for (let i = seg.length - 1; i >= Math.max(0, seg.length - 2) && !tinhMoi; i--) tinhMoi = tinh.get(loiDiaDanh(seg[i])) || '';
  return { diaDanhMoi, tinhMoi };
}
