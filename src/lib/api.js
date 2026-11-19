import { supabase } from './supabase';
import { emailFromCccd, todayIso } from './cccd';

function must({ data, error }) {
  if (error) throw new Error(viError(error.message));
  return data;
}

// Dịch vài lỗi hay gặp của Supabase sang tiếng Việt
export function viError(msg = '') {
  if (/Invalid login credentials/i.test(msg)) return 'Sai số CCCD hoặc mật khẩu';
  if (/User already registered/i.test(msg)) return 'Số CCCD này đã có tài khoản';
  if (/Email not confirmed/i.test(msg))
    return 'Tài khoản chưa kích hoạt (cần tắt "Confirm email" trong Supabase Auth)';
  if (/Password should be at least/i.test(msg)) return 'Mật khẩu tối thiểu 6 ký tự';
  if (/network request failed|fetch/i.test(msg)) return 'Không có kết nối mạng';
  if (/profiles_cccd_key|duplicate key.*cccd/i.test(msg)) return 'Số CCCD này đã được đăng ký bởi tài khoản khác';
  if (/Provider .* is not enabled|provider is not enabled/i.test(msg)) return 'Chưa bật nhà cung cấp đăng nhập này trong Supabase';
  if (/Database error saving new user/i.test(msg)) return 'Không tạo được tài khoản — đơn vị có thể đã có Trưởng CA / Cán bộ (admin), chọn chức vụ khác';
  if (/profiles_mot_admin/i.test(msg)) return 'Đơn vị này đã có Cán bộ (admin)';
  if (/profiles_mot_truong_ca/i.test(msg)) return 'Đơn vị này đã có Trưởng CA — thu hồi người cũ trước';
  return msg;
}

// ---------- Tài khoản ----------
export async function signIn(cccd, password) {
  return must(await supabase.auth.signInWithPassword({ email: emailFromCccd(cccd), password }));
}

// vai_tro = 'can_bo' thì kèm don_vi_id + chuc_vu (can_bo|pho_truong|truong_ca) → thành yêu cầu chờ duyệt
export async function signUp({ cccd, password, ho_ten, ngay_sinh, dia_chi, sdt, vai_tro, don_vi_id, chuc_vu }) {
  return must(
    await supabase.auth.signUp({
      email: emailFromCccd(cccd),
      password,
      options: { data: { cccd, ho_ten, ngay_sinh, dia_chi, sdt, vai_tro, don_vi_id, chuc_vu } },
    }),
  );
}

export const signOut = () => supabase.auth.signOut();

export async function getProfile(uid) {
  return must(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
}

// Hồ sơ đủ để dùng app: có CCCD + họ tên (tài khoản Apple lúc mới tạo thì chưa có)
export const hoSoDayDu = p => !!(p && p.cccd && p.ho_ten && p.ho_ten.trim());

// Màn "Hoàn tất hồ sơ": điền CCCD lần đầu (trigger chỉ cho điền khi CCCD đang trống)
export async function hoanTatHoSo(uid, { cccd, ho_ten, ngay_sinh, dia_chi, sdt }) {
  return must(
    await supabase.from('profiles').update({ cccd, ho_ten, ngay_sinh: ngay_sinh || null, dia_chi, sdt }).eq('id', uid).select().single(),
  );
}

// Người dùng gửi (kèm đơn vị + chức vụ) / rút yêu cầu làm cán bộ. Rút → trigger tự bỏ đơn vị.
export async function setYeuCauCanBo(uid, on, { don_vi_id, chuc_vu } = {}) {
  const patch = on ? { yeu_cau_can_bo: true, don_vi_id, yeu_cau_chuc_vu: chuc_vu || 'can_bo' } : { yeu_cau_can_bo: false };
  return must(await supabase.from('profiles').update(patch).eq('id', uid).select().single());
}

// Dev đổi đơn vị của mình: ngay, không cần duyệt, vẫn giữ quyền dev (xem toàn tỉnh). '' = không gắn đơn vị
export async function devDoiDonVi(uid, donViId) {
  return must(await supabase.from('profiles').update({ don_vi_id: donViId || null }).eq('id', uid).select().single());
}

// Cán bộ xin đổi đơn vị / chức vụ → mất quyền hiện tại, về chờ duyệt.
// Trả 'da_nhan' khi là cán bộ đơn vị này xin Cán bộ (admin) đơn vị mình đang khuyết (nhận ngay), còn lại 'cho_duyet'.
export async function xinDoiDonVi(donViId, chucVu) {
  return must(await supabase.rpc('xin_doi_don_vi', { p_don_vi: donViId, p_chuc_vu: chucVu }));
}

export async function xoaTaiKhoan() {
  return must(await supabase.rpc('xoa_tai_khoan'));
}

export async function updateMyProfile(uid, patch) {
  const { ho_ten, ngay_sinh, dia_chi, sdt } = patch;
  return must(
    await supabase.from('profiles').update({ ho_ten, ngay_sinh: ngay_sinh || null, dia_chi, sdt }).eq('id', uid).select().single(),
  );
}

// ---------- Cơ sở (người thông báo lưu trú) ----------
export async function listMyCoSo(uid) {
  return must(await supabase.from('co_so').select('*').eq('chu_id', uid).order('created_at'));
}

// don_vi_id = xã/phường nơi lưu trú (bắt buộc) — quyết định Công an đơn vị nào thấy cơ sở này
export async function saveCoSo({ id, ten, dia_chi, don_vi_id }, uid) {
  if (id) return must(await supabase.from('co_so').update({ ten, dia_chi, don_vi_id }).eq('id', id).select().single());
  return must(await supabase.from('co_so').insert({ ten, dia_chi, don_vi_id, chu_id: uid }).select().single());
}

// ---------- Thông báo lưu trú ----------
const TB_LIST = `id, co_so_id, tu_ngay, den_ngay, trang_thai, ly_do, gia_han_tu, created_at, duyet_luc,
  co_so(id, ten, dia_chi),
  thong_bao_nguoi(count)`;

export async function guiThongBao(coSoId, nguoi, giaHanTu = null) {
  const payload = nguoi.map(n => ({
    cccd: n.cccd, cmnd: n.cmnd || '', ho_ten: n.ho_ten, ngay_sinh: n.ngay_sinh || '',
    gioi_tinh: n.gioi_tinh || '', dia_chi: n.dia_chi || '', ngay_cap: n.ngay_cap || '',
  }));
  return must(
    await supabase.rpc('gui_thong_bao', {
      p_co_so: coSoId, p_nguoi: payload, p_tu_ngay: todayIso(), p_gia_han_tu: giaHanTu,
    }),
  );
}

export async function huyThongBao(id) {
  return must(await supabase.rpc('huy_thong_bao', { p_id: id }));
}

export async function duyetThongBao(id, dongY, lyDo) {
  return must(await supabase.rpc('duyet_thong_bao', { p_id: id, p_dong_y: dongY, p_ly_do: lyDo || null }));
}

// Lịch sử của chính người gửi
export async function listMyThongBao(uid) {
  return must(
    await supabase.from('thong_bao').select(TB_LIST).eq('nguoi_gui', uid).order('created_at', { ascending: false }).limit(200),
  );
}

// Cán bộ: theo nhóm được giao; Trưởng/Phó CA: toàn đơn vị; dev: tất cả (RLS)
export async function listThongBaoQuanLy({ trangThai, coSoId } = {}) {
  let q = supabase.from('thong_bao').select(TB_LIST).order('created_at', { ascending: trangThai === 'cho_duyet' });
  if (trangThai) q = q.eq('trang_thai', trangThai);
  if (coSoId) q = q.eq('co_so_id', coSoId);
  return must(await q.limit(300));
}

export async function getThongBao(id) {
  return must(
    await supabase
      .from('thong_bao')
      .select(`*,
        co_so(id, ten, dia_chi, nhom_id, chu:profiles!co_so_chu_id_fkey(ho_ten, cccd, sdt, dia_chi)),
        nguoi_duyet_p:profiles!thong_bao_nguoi_duyet_fkey(ho_ten),
        thong_bao_nguoi(*)`)
      .eq('id', id)
      .single(),
  );
}

/**
 * Các thông báo đã duyệt của tôi CHƯA được gia hạn (chưa có bản gia hạn đang chờ/đã duyệt).
 * Đây là danh sách cần nhắc khi tới hạn 30 ngày.
 */
export async function listCanGiaHan(uid) {
  const rows = must(
    await supabase
      .from('thong_bao')
      .select('id, co_so_id, tu_ngay, den_ngay, trang_thai, gia_han_tu, co_so(ten)')
      .eq('nguoi_gui', uid)
      .in('trang_thai', ['da_duyet', 'cho_duyet'])
      .order('den_ngay'),
  );
  const daGiaHan = new Set(rows.filter(r => r.gia_han_tu).map(r => r.gia_han_tu));
  return rows.filter(r => r.trang_thai === 'da_duyet' && !daGiaHan.has(r.id));
}

// ---------- Cán bộ ----------
export async function listCoSoQuanLy() {
  // RLS: cán bộ thấy cơ sở trong nhóm mình; Trưởng/Phó CA thấy cả đơn vị; dev thấy tất cả
  return must(
    await supabase
      .from('co_so')
      .select('id, ten, dia_chi, nhom_id, don_vi_id, chu:profiles!co_so_chu_id_fkey(ho_ten, cccd, sdt), nhom:nhom_co_so(id, ten)')
      .order('ten'),
  );
}

// ---------- Trưởng / Phó Trưởng CA / dev: phân công (RLS tự giới hạn trong đơn vị) ----------
export async function listNhom() {
  return must(
    await supabase.from('nhom_co_so').select('id, ten, can_bo_id, don_vi_id, can_bo:profiles(id, ho_ten, cccd), co_so(count)').order('ten'),
  );
}
// don_vi_id chỉ dev cần gửi khi tạo; Trưởng/Phó thì trigger tự gắn đơn vị của mình
export async function saveNhom({ id, ten, can_bo_id, don_vi_id }) {
  const row = { ten, can_bo_id: can_bo_id || null };
  if (id) return must(await supabase.from('nhom_co_so').update(row).eq('id', id).select().single());
  return must(await supabase.from('nhom_co_so').insert({ ...row, don_vi_id: don_vi_id || null }).select().single());
}
export async function deleteNhom(id) {
  return must(await supabase.from('nhom_co_so').delete().eq('id', id));
}
export async function setCoSoNhom(coSoId, nhomId) {
  return must(await supabase.from('co_so').update({ nhom_id: nhomId || null }).eq('id', coSoId));
}
export const ROLE_CAN_BO = ['can_bo', 'pho_truong', 'truong_ca', 'admin'];
export async function listCanBo() {
  return must(await supabase.from('profiles').select('id, ho_ten, cccd, role, don_vi_id').in('role', ROLE_CAN_BO).order('ho_ten'));
}
export async function findProfileByCccd(cccd) {
  return must(await supabase.from('profiles').select('id, ho_ten, cccd, role, ngay_sinh, dia_chi, don_vi_id').eq('cccd', cccd.trim()).maybeSingle());
}
// Cấp/thu vai trò. Trưởng CA: trigger tự gắn đơn vị của mình. Dev cấp vai trò cán bộ thì gửi kèm donViId.
export async function setRole(uid, role, donViId) {
  const patch = { role };
  if (donViId && ROLE_CAN_BO.includes(role)) patch.don_vi_id = donViId;
  return must(await supabase.from('profiles').update(patch).eq('id', uid).select('id, role, don_vi_id').single());
}
// Yêu cầu vào đơn vị đang chờ duyệt (RLS: Trưởng/Phó chỉ thấy người xin vào đơn vị mình)
export async function listYeuCauCanBo() {
  return must(
    await supabase.from('profiles').select('id, ho_ten, cccd, sdt, email, provider, dia_chi, yeu_cau_luc, don_vi_id, yeu_cau_chuc_vu')
      .eq('yeu_cau_can_bo', true).eq('role', 'nguoi_dan').order('yeu_cau_luc'),
  );
}
// Duyệt = cấp đúng chức vụ người đó xin (Trưởng CA chỉ dev duyệt — trigger chặn)
// Giao / chuyển giao chức Trưởng CA hoặc Cán bộ (admin): người đang giữ chức (kể cả mình) tự về Cán bộ.
// Gọi bởi Trưởng CA / admin của đơn vị; dev truyền thêm donViId.
export async function giaoChuc(uid, chucVu, donViId = null) {
  return must(await supabase.rpc('giao_chuc', { p_id: uid, p_chuc_vu: chucVu, p_don_vi: donViId }));
}

export async function xuLyYeuCauCanBo(p, dongY) {
  // Trưởng CA / admin: đi qua giao_chuc (lỡ có người vừa nhận chức thì chuyển giao)
  if (dongY && ['truong_ca', 'admin'].includes(p.yeu_cau_chuc_vu)) return giaoChuc(p.id, p.yeu_cau_chuc_vu, p.don_vi_id);
  const patch = dongY
    ? { role: p.yeu_cau_chuc_vu || 'can_bo', don_vi_id: p.don_vi_id }
    : { yeu_cau_can_bo: false };
  return must(await supabase.from('profiles').update(patch).eq('id', p.id));
}

// ---------- Truy nã (chỉ cán bộ / Trưởng, Phó CA / dev — RLS chặn người dân) ----------
const CB_SELECT = `id, muc_do, trang_thai, ghi_chu, created_at, xu_ly_luc,
  nguoi:thong_bao_nguoi(id, cccd, cmnd, ho_ten, ngay_sinh, gioi_tinh, dia_chi, ngay_cap,
    thong_bao(id, tu_ngay, den_ngay, trang_thai, co_so(id, ten, dia_chi, chu:profiles!co_so_chu_id_fkey(ho_ten, sdt)))),
  truy_na(*),
  nguoi_xu_ly_p:profiles!canh_bao_truy_na_nguoi_xu_ly_fkey(ho_ten)`;

export async function listCanhBao(trangThai) {
  let q = supabase.from('canh_bao_truy_na').select(CB_SELECT).order('created_at', { ascending: false }).limit(200);
  if (trangThai) q = q.eq('trang_thai', trangThai);
  return must(await q);
}

export async function getCanhBao(id) {
  return must(await supabase.from('canh_bao_truy_na').select(CB_SELECT).eq('id', id).single());
}

export async function demCanhBaoMoi() {
  const { count, error } = await supabase.from('canh_bao_truy_na').select('id', { count: 'exact', head: true }).eq('trang_thai', 'moi');
  if (error) throw new Error(viError(error.message));
  return count || 0;
}

export async function xuLyCanhBao(id, dung, ghiChu) {
  return must(await supabase.rpc('xu_ly_canh_bao', { p_id: id, p_dung: dung, p_ghi_chu: ghiChu || null }));
}

// cảnh báo của các người trong 1 thông báo lưu trú (màn chi tiết thông báo)
export async function canhBaoTheoNguoi(tbnIds) {
  if (!tbnIds.length) return [];
  return must(
    await supabase.from('canh_bao_truy_na').select('id, thong_bao_nguoi_id, muc_do, trang_thai').in('thong_bao_nguoi_id', tbnIds),
  );
}

/**
 * Tìm truy nã theo đủ trường (không phân biệt dấu). dk: { hoTen, namTu, namDen, diaChi, tenBo, tenMe, toiDanh, quyetDinh, donVi }
 * Trả { rows, tong } — tong là tổng số kết quả (mỗi lần lấy 50 dòng từ vị trí `tu`).
 */
export async function timTruyNa(dk = {}, tu = 0) {
  const so = v => (/^\d{4}$/.test(String(v || '').trim()) ? Number(v) : null);
  const rows = must(
    await supabase.rpc('tim_truy_na2', {
      p_ho_ten: dk.hoTen || null, p_nam_tu: so(dk.namTu), p_nam_den: so(dk.namDen), p_dia_chi: dk.diaChi || null,
      p_ten_bo: dk.tenBo || null, p_ten_me: dk.tenMe || null, p_toi_danh: dk.toiDanh || null,
      p_quyet_dinh: dk.quyetDinh || null, p_don_vi: dk.donVi || null, p_tu: tu,
    }),
  );
  return { rows, tong: rows[0]?.tong ?? 0 };
}

export async function getTruyNa(ma) {
  return must(await supabase.from('truy_na').select('*').eq('ma', ma).single());
}

export async function dongBoTruyNaGanNhat() {
  const { data } = await supabase.from('dong_bo_truy_na').select('*').not('ket_thuc', 'is', null).order('id', { ascending: false }).limit(1);
  const { count } = await supabase.from('truy_na').select('ma', { count: 'exact', head: true });
  return { lan: data?.[0] || null, tong: count || 0 };
}
