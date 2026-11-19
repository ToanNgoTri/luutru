import { addDaysIso, isoToVn, parseCccdQr, vnToIso } from '../src/lib/cccd';

test('tách QR CCCD gắn chip', () => {
  const raw = '075204008221|276026075|Nguyễn Trí Thức|14062004|Nam|Ấp Hàng Gòn, Hàng Gòn, Long Khánh, Đồng Nai|16092021';
  expect(parseCccdQr(raw)).toEqual({
    cccd: '075204008221',
    cmnd: '276026075',
    ho_ten: 'Nguyễn Trí Thức',
    ngay_sinh: '2004-06-14',
    gioi_tinh: 'Nam',
    dia_chi: 'Ấp Hàng Gòn, Hàng Gòn, Long Khánh, Đồng Nai',
    ngay_cap: '2021-09-16',
  });
});

test('CCCD không có CMND cũ', () => {
  const p = parseCccdQr('075204008221||Trần Thị A|01012000|Nữ|Long Khánh|01022024');
  expect(p.cmnd).toBe('');
  expect(p.ngay_sinh).toBe('2000-01-01');
});

test('từ chối mã không phải CCCD', () => {
  expect(parseCccdQr('https://example.com')).toBeNull();
  expect(parseCccdQr('12345|x|y|z|a|b')).toBeNull();
});

test('ngày tháng', () => {
  expect(isoToVn('2004-06-14')).toBe('14/06/2004');
  expect(vnToIso('14/06/2004')).toBe('2004-06-14');
  expect(vnToIso('31/02/2004')).toBe('');
  expect(addDaysIso('2026-11-14', 30)).toBe('2026-12-14');
  expect(addDaysIso('2026-12-20', 30)).toBe('2027-01-19');
});
