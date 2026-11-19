// Công cụ quản trị chạy trên máy dev (dùng SECRET key — KHÔNG đưa vào app).
//   npm run admin -- tao <cccd> <matkhau> "<Họ tên>" [role] [don_vi_id]   tạo tài khoản đã kích hoạt (vd tài khoản dev đầu tiên)
//   npm run admin -- role <cccd> <nguoi_dan|can_bo|pho_truong|truong_ca|admin|dev> [don_vi_id]   vd phuong-hang-gon (src/lib/units.js)
//   npm run admin -- kiemtra                                 kiểm tra đã chạy các file sql chưa
//   npm run admin -- push                                    ghi URL + khoá Cloud Function gửi push vào bảng cau_hinh
//                                                            (lấy PUSH_URL, PUSH_SECRET trong .env)
// Đọc SUPABASE_URL + SUPABASE_SECRET_KEY từ file .env (đã gitignore).
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
const DOMAIN = 'luutru.app';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const ROLES = ['nguoi_dan', 'can_bo', 'pho_truong', 'truong_ca', 'admin', 'dev'];

async function req(path, opts = {}) {
  const r = await fetch(URL_ + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await r.text();
  const body = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(body)}`);
  return body;
}

async function setRole(cccd, role, donVi) {
  if (!ROLES.includes(role)) throw new Error('role phải là ' + ROLES.join('|'));
  if (['can_bo', 'pho_truong', 'truong_ca', 'admin'].includes(role) && !donVi) throw new Error('Cán bộ cần đơn vị: role <cccd> <role> <don_vi_id> (id xem src/lib/units.js)');
  const rows = await req(`/rest/v1/profiles?cccd=eq.${cccd}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ role, don_vi_id: role === 'nguoi_dan' ? null : donVi || undefined, yeu_cau_can_bo: false, yeu_cau_chuc_vu: null }),
  });
  if (!rows.length) throw new Error('Không có tài khoản CCCD ' + cccd);
  console.log(`✓ ${rows[0].ho_ten} (${cccd}) → ${role}${rows[0].don_vi_id ? ' @ ' + rows[0].don_vi_id : ''}`);
}

const [cmd, ...a] = process.argv.slice(2);
try {
  if (cmd === 'tao') {
    const [cccd, pw, hoTen, role = 'nguoi_dan', donVi] = a;
    if (!/^\d{12}$/.test(cccd || '') || !pw || !hoTen) throw new Error('Cú pháp: tao <cccd 12 số> <matkhau> "<Họ tên>" [role]');
    await req('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: `${cccd}@${DOMAIN}`, password: pw, email_confirm: true, user_metadata: { cccd, ho_ten: hoTen } }),
    });
    console.log(`✓ Đã tạo tài khoản ${cccd}`);
    if (role !== 'nguoi_dan') await setRole(cccd, role, donVi);
  } else if (cmd === 'role') {
    await setRole(a[0], a[1], a[2]);
  } else if (cmd === 'push') {
    if (!env.PUSH_URL || !env.PUSH_SECRET) throw new Error('Thiếu PUSH_URL / PUSH_SECRET trong .env');
    await req('/rest/v1/cau_hinh?on_conflict=khoa', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ khoa: 'push_url', gia_tri: env.PUSH_URL }, { khoa: 'push_secret', gia_tri: env.PUSH_SECRET }]),
    });
    console.log('✓ Đã cấu hình push:', env.PUSH_URL);
  } else if (cmd === 'kiemtra') {
    for (const t of ['profiles', 'nhom_co_so', 'co_so', 'thong_bao', 'thong_bao_nguoi', 'truy_na', 'canh_bao_truy_na', 'thiet_bi', 'cau_hinh', 'tinh_cu_moi', 'don_vi']) {
      try { await req(`/rest/v1/${t}?select=count`, { headers: { Prefer: 'count=exact' } }); console.log('✓', t); }
      catch (e) { console.log('✗', t, '—', e.message.slice(0, 120)); }
    }
  } else {
    console.log('Lệnh: tao | role | kiemtra (xem đầu file scripts/admin.mjs)');
  }
} catch (e) {
  console.error('✗', e.message);
  if (/Database error/.test(e.message)) console.error('  → trigger tạo profile lỗi: chạy lại toàn bộ sql/01-schema.sql trong SQL Editor');
  process.exitCode = 1;
}
