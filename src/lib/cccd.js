import { EMAIL_DOMAIN } from '../config';

// "14062004" → "2004-06-14"; trả '' nếu không hợp lệ
export function ddmmyyyyToIso(s) {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(String(s || '').trim());
  if (!m) return '';
  const [, d, mo, y] = m;
  const dt = new Date(`${y}-${mo}-${d}T00:00:00`);
  if (Number.isNaN(dt.getTime()) || dt.getDate() !== +d) return '';
  return `${y}-${mo}-${d}`;
}

// "2004-06-14" → "14/06/2004"
export function isoToVn(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// "14/06/2004" hoặc "14062004" → "2004-06-14"; '' nếu sai
export function vnToIso(s) {
  return ddmmyyyyToIso(String(s || '').replace(/[^\d]/g, ''));
}

export function todayIso() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Chuỗi QR trên CCCD gắn chip:
 * CCCD|CMND cũ|Họ tên|Ngày sinh ddmmyyyy|Giới tính|Địa chỉ|Ngày cấp ddmmyyyy
 * vd: 075204008221|276026075|Nguyễn Trí Thức|14062004|Nam|Ấp Hàng Gòn, ...|16092021
 * Trả null nếu không phải QR CCCD.
 */
export function parseCccdQr(raw) {
  const parts = String(raw || '').trim().split('|').map(x => x.trim());
  if (parts.length < 6 || !/^\d{12}$/.test(parts[0]) || !parts[2]) return null;
  return {
    cccd: parts[0],
    cmnd: /^\d{9}$/.test(parts[1]) ? parts[1] : '',
    ho_ten: parts[2],
    ngay_sinh: ddmmyyyyToIso(parts[3]),
    gioi_tinh: parts[4] || '',
    dia_chi: parts[5] || '',
    ngay_cap: ddmmyyyyToIso(parts[6]),
  };
}

export const isCccd = s => /^\d{12}$/.test(String(s || '').trim());

export const emailFromCccd = cccd => `${String(cccd).trim()}@${EMAIL_DOMAIN}`;

// Cộng ngày theo giờ máy (tránh lệch ngày do toISOString dùng UTC)
export function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const p = x => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
