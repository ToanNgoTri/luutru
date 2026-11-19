-- =====================================================================
-- 95 xã/phường tỉnh Đồng Nai + phân quyền THEO ĐƠN VỊ (mô hình giống PlanRegister).
-- Chạy SAU 01..04. Chạy lại được (idempotent).
-- ⚠ Nếu chạy lại 01-schema.sql hoặc 02-truy-na.sql thì PHẢI chạy lại file này (nó ghi đè hàm/policy cũ).
--
-- Vai trò (profiles.role):
--   nguoi_dan  : người thông báo lưu trú — KHÔNG thuộc đơn vị; nơi lưu trú (co_so) chọn xã/phường
--   can_bo     : Cán bộ — chỉ thấy cơ sở trong nhóm được giao (nhóm thuộc đơn vị mình)
--   pho_truong : Phó Trưởng CA — xem/duyệt thông báo/phân nhóm TOÀN đơn vị mình; KHÔNG duyệt người mới
--   truong_ca  : Trưởng CA (mỗi đơn vị 1 người) — như phó + duyệt người mới, cấp/thu MỌI chức vụ trong đơn vị (kể cả admin)
--   admin      : "Cán bộ (admin)" (mỗi đơn vị 1 người) — quản trị ĐƠN VỊ MÌNH, quyền như Trưởng CA.
--                Chuyển giao chức Trưởng CA / admin: Trưởng CA hoặc admin của đơn vị làm (giao_chuc), người cũ về Cán bộ.
--                Cán bộ đã trong đơn vị xin admin của chính đơn vị khi đang khuyết → nhận ngay;
--                người mới / chuyển từ đơn vị khác → Trưởng CA đơn vị đó (hoặc dev) duyệt
--   dev        : "Quản trị tỉnh" — toàn tỉnh, mọi quyền; giao/thu admin
-- Người mới / chuyển đến: chọn ĐƠN VỊ + CHỨC VỤ → chờ Trưởng CA hoặc admin của ĐƠN VỊ ĐÓ duyệt (hoặc dev). Chức vụ Trưởng CA / admin đã có người → không chọn được.
-- Chuyển đơn vị = luôn chờ ĐƠN VỊ MỚI duyệt (trừ nhận admin của chính đơn vị mình khi khuyết).
-- Người đơn vị này KHÔNG tra cứu được dữ liệu đơn vị khác. Truy nã (dữ liệu công khai) giữ nguyên.
-- =====================================================================

-- ---------- Danh mục đơn vị (id trùng src/lib/units.js, trùng PlanRegister) ----------
create table if not exists public.don_vi (
  id    text primary key,
  ten   text not null
);
insert into public.don_vi (id, ten) values
  ('phuong-an-loc', 'Phường An Lộc'),
  ('phuong-bao-vinh', 'Phường Bảo Vinh'),
  ('phuong-bien-hoa', 'Phường Biên Hòa'),
  ('phuong-binh-long', 'Phường Bình Long'),
  ('phuong-binh-loc', 'Phường Bình Lộc'),
  ('phuong-binh-phuoc', 'Phường Bình Phước'),
  ('phuong-chon-thanh', 'Phường Chơn Thành'),
  ('phuong-dau-giay', 'Phường Dầu Giây'),
  ('phuong-dong-phu', 'Phường Đồng Phú'),
  ('phuong-dong-xoai', 'Phường Đồng Xoài'),
  ('phuong-hang-gon', 'Phường Hàng Gòn'),
  ('phuong-ho-nai', 'Phường Hố Nai'),
  ('phuong-long-binh', 'Phường Long Bình'),
  ('phuong-long-hung', 'Phường Long Hưng'),
  ('phuong-long-khanh', 'Phường Long Khánh'),
  ('phuong-long-thanh', 'Phường Long Thành'),
  ('phuong-loc-ninh', 'Phường Lộc Ninh'),
  ('phuong-minh-hung', 'Phường Minh Hưng'),
  ('phuong-nhon-trach', 'Phường Nhơn Trạch'),
  ('phuong-phuoc-binh', 'Phường Phước Bình'),
  ('phuong-phuoc-long', 'Phường Phước Long'),
  ('phuong-phuoc-tan', 'Phường Phước Tân'),
  ('phuong-tam-hiep', 'Phường Tam Hiệp'),
  ('phuong-tam-phuoc', 'Phường Tam Phước'),
  ('phuong-tan-khai', 'Phường Tân Khai'),
  ('phuong-tan-phu', 'Phường Tân Phú'),
  ('phuong-tan-trieu', 'Phường Tân Triều'),
  ('phuong-trang-bom', 'Phường Trảng Bom'),
  ('phuong-trang-dai', 'Phường Trảng Dài'),
  ('phuong-tran-bien', 'Phường Trấn Biên'),
  ('phuong-tri-an', 'Phường Trị An'),
  ('phuong-xuan-lap', 'Phường Xuân Lập'),
  ('phuong-xuan-loc', 'Phường Xuân Lộc'),
  ('xa-an-phuoc', 'Xã An Phước'),
  ('xa-an-vien', 'Xã An Viễn'),
  ('xa-bau-ham', 'Xã Bàu Hàm'),
  ('xa-binh-an', 'Xã Bình An'),
  ('xa-binh-minh', 'Xã Bình Minh'),
  ('xa-binh-tan', 'Xã Bình Tân'),
  ('xa-bom-bo', 'Xã Bom Bo'),
  ('xa-bu-dang', 'Xã Bù Đăng'),
  ('xa-bu-gia-map', 'Xã Bù Gia Mập'),
  ('xa-cam-my', 'Xã Cẩm Mỹ'),
  ('xa-da-kia', 'Xã Đa Kia'),
  ('xa-dai-phuoc', 'Xã Đại Phước'),
  ('xa-dak-lua', 'Xã Đak Lua'),
  ('xa-dak-nhau', 'Xã Đak Nhau'),
  ('xa-dak-o', 'Xã Đăk Ơ'),
  ('xa-dinh-quan', 'Xã Định Quán'),
  ('xa-dong-tam', 'Xã Đồng Tâm'),
  ('xa-gia-kiem', 'Xã Gia Kiệm'),
  ('xa-hung-phuoc', 'Xã Hưng Phước'),
  ('xa-hung-thinh', 'Xã Hưng Thịnh'),
  ('xa-la-nga', 'Xã La Ngà'),
  ('xa-long-ha', 'Xã Long Hà'),
  ('xa-long-phuoc', 'Xã Long Phước'),
  ('xa-loc-hung', 'Xã Lộc Hưng'),
  ('xa-loc-quang', 'Xã Lộc Quang'),
  ('xa-loc-tan', 'Xã Lộc Tấn'),
  ('xa-loc-thanh', 'Xã Lộc Thành'),
  ('xa-loc-thanh-nang', 'Xã Lộc Thạnh'),
  ('xa-minh-duc', 'Xã Minh Đức'),
  ('xa-nam-cat-tien', 'Xã Nam Cát Tiên'),
  ('xa-nghia-trung', 'Xã Nghĩa Trung'),
  ('xa-nha-bich', 'Xã Nha Bích'),
  ('xa-phu-hoa', 'Xã Phú Hòa'),
  ('xa-phu-lam', 'Xã Phú Lâm'),
  ('xa-phu-ly', 'Xã Phú Lý'),
  ('xa-phu-nghia', 'Xã Phú Nghĩa'),
  ('xa-phu-rieng', 'Xã Phú Riềng'),
  ('xa-phu-trung', 'Xã Phú Trung'),
  ('xa-phu-vinh', 'Xã Phú Vinh'),
  ('xa-phuoc-an', 'Xã Phước An'),
  ('xa-phuoc-son', 'Xã Phước Sơn'),
  ('xa-phuoc-thai', 'Xã Phước Thái'),
  ('xa-song-ray', 'Xã Sông Ray'),
  ('xa-ta-lai', 'Xã Tà Lài'),
  ('xa-tan-an', 'Xã Tân An'),
  ('xa-tan-hung', 'Xã Tân Hưng'),
  ('xa-tan-loi', 'Xã Tân Lợi'),
  ('xa-tan-quan', 'Xã Tân Quan'),
  ('xa-tan-tien', 'Xã Tân Tiến'),
  ('xa-thanh-son', 'Xã Thanh Sơn'),
  ('xa-thien-hung', 'Xã Thiện Hưng'),
  ('xa-tho-son', 'Xã Thọ Sơn'),
  ('xa-thong-nhat', 'Xã Thống Nhất'),
  ('xa-thuan-loi', 'Xã Thuận Lợi'),
  ('xa-xuan-bac', 'Xã Xuân Bắc'),
  ('xa-xuan-dinh', 'Xã Xuân Định'),
  ('xa-xuan-dong', 'Xã Xuân Đông'),
  ('xa-xuan-duong', 'Xã Xuân Đường'),
  ('xa-xuan-hoa', 'Xã Xuân Hòa'),
  ('xa-xuan-phu', 'Xã Xuân Phú'),
  ('xa-xuan-que', 'Xã Xuân Quế'),
  ('xa-xuan-thanh', 'Xã Xuân Thành')
on conflict (id) do update set ten = excluded.ten;

alter table public.don_vi enable row level security;
drop policy if exists don_vi_select on public.don_vi;
create policy don_vi_select on public.don_vi for select to anon, authenticated using (true);

-- ---------- Cột đơn vị + chức vụ xin ----------
alter table public.profiles   add column if not exists don_vi_id text references public.don_vi(id);
alter table public.profiles   add column if not exists yeu_cau_chuc_vu text;
alter table public.nhom_co_so add column if not exists don_vi_id text references public.don_vi(id);
alter table public.co_so      add column if not exists don_vi_id text references public.don_vi(id);
create index if not exists profiles_don_vi_idx on public.profiles(don_vi_id);
create index if not exists nhom_don_vi_idx on public.nhom_co_so(don_vi_id);
create index if not exists co_so_don_vi_idx on public.co_so(don_vi_id);

-- ---------- Vai trò: chi_huy → truong_ca; thêm pho_truong, admin ----------
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'truong_ca' where role = 'chi_huy';
alter table public.profiles add constraint profiles_role_check
  check (role in ('nguoi_dan', 'can_bo', 'pho_truong', 'truong_ca', 'admin', 'dev'));
alter table public.profiles drop constraint if exists profiles_yeu_cau_chuc_vu_check;
update public.profiles set yeu_cau_chuc_vu = 'admin' where yeu_cau_chuc_vu = 'dev';
alter table public.profiles add constraint profiles_yeu_cau_chuc_vu_check
  check (yeu_cau_chuc_vu is null or yeu_cau_chuc_vu in ('can_bo', 'pho_truong', 'truong_ca', 'admin'));
-- mỗi đơn vị chỉ 1 Trưởng CA và 1 Cán bộ (admin)
create unique index if not exists profiles_mot_truong_ca on public.profiles(don_vi_id) where role = 'truong_ca';
create unique index if not exists profiles_mot_admin on public.profiles(don_vi_id) where role = 'admin';

-- ---------- Hàm trợ giúp ----------
create or replace function public.my_don_vi() returns text
language sql stable security definer set search_path = public as $$
  select don_vi_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_dev() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'dev' from public.profiles where id = auth.uid()), false)
$$;

-- giữ tên cũ: "có quyền quản trị (ít nhất trong đơn vị mình)"
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('pho_truong', 'truong_ca', 'admin', 'dev') from public.profiles where id = auth.uid()), false)
$$;

-- Xem / duyệt / phân nhóm trong đơn vị p: dev (toàn tỉnh), hoặc Trưởng / Phó Trưởng CA / admin CỦA đơn vị đó
create or replace function public.quan_tri_don_vi(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select role = 'dev' or (role in ('truong_ca', 'pho_truong', 'admin') and p is not null and don_vi_id = p)
    from public.profiles where id = auth.uid()
  ), false)
$$;

create or replace function public.quan_tri_co_so(p_co_so bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.co_so where id = p_co_so and public.quan_tri_don_vi(don_vi_id))
$$;

-- cán bộ phụ trách nhóm — chỉ khi còn là cán bộ CÙNG đơn vị với nhóm
create or replace function public.quan_ly_co_so(p_co_so bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.co_so c
    join public.nhom_co_so n on n.id = c.nhom_id
    join public.profiles p on p.id = n.can_bo_id
    where c.id = p_co_so and n.can_bo_id = auth.uid()
      and p.role in ('can_bo', 'pho_truong', 'truong_ca', 'admin') and p.don_vi_id = n.don_vi_id
  )
$$;

-- ---------- Chức vụ chỉ 1 người / đơn vị (Trưởng CA, admin) đã có ai chưa? (trừ chính mình) ----------
-- App ẩn lựa chọn khi đã có. Chỉ trả true/false, không lộ ai. Gọi được cả lúc chưa đăng nhập (màn Đăng ký).
create or replace function public.don_vi_da_co(p_don_vi text, p_chuc_vu text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_chuc_vu in ('truong_ca', 'admin') and exists (
    select 1 from public.profiles
    where role = p_chuc_vu and don_vi_id = p_don_vi and id is distinct from auth.uid()
  )
$$;
revoke all on function public.don_vi_da_co(text, text) from public;
grant execute on function public.don_vi_da_co(text, text) to anon, authenticated;

create or replace function public.don_vi_co_truong(p_don_vi text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.don_vi_da_co(p_don_vi, 'truong_ca')
$$;
revoke all on function public.don_vi_co_truong(text) from public;
grant execute on function public.don_vi_co_truong(text) to anon, authenticated;

create or replace function public.ten_chuc_vu(p text) returns text
language sql immutable as $$
  select case p when 'truong_ca' then 'Trưởng CA' when 'admin' then 'Cán bộ (admin)'
                when 'pho_truong' then 'Phó Trưởng CA' else 'Cán bộ' end
$$;

-- ---------- Tạo profile khi đăng ký: người xin làm cán bộ mang theo đơn vị + chức vụ ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_cccd text := m->>'cccd';
  v_can_bo boolean := coalesce(m->>'vai_tro', '') = 'can_bo';
  v_dv text;
  v_cv text := coalesce(nullif(m->>'chuc_vu', ''), 'can_bo');
begin
  if v_cccd !~ '^[0-9]{12}$' or exists (select 1 from public.profiles where cccd = v_cccd) then
    v_cccd := null;
  end if;
  if v_can_bo then select id into v_dv from public.don_vi where id = m->>'don_vi_id'; end if;
  if v_cv not in ('can_bo', 'pho_truong', 'truong_ca', 'admin') then v_cv := 'can_bo'; end if;
  if v_dv is not null and v_cv in ('truong_ca', 'admin')
     and exists (select 1 from public.profiles where role = v_cv and don_vi_id = v_dv) then
    raise exception 'Đơn vị này đã có % — chọn chức vụ khác', public.ten_chuc_vu(v_cv);
  end if;
  insert into public.profiles (id, ho_ten, ngay_sinh, dia_chi, cccd, sdt, email, provider,
                               yeu_cau_can_bo, yeu_cau_luc, don_vi_id, yeu_cau_chuc_vu)
  values (
    new.id,
    coalesce(nullif(m->>'ho_ten', ''), nullif(m->>'full_name', ''), nullif(m->>'name', ''), ''),
    case when coalesce(m->>'ngay_sinh', '') ~ '^\d{4}-\d{2}-\d{2}$' then (m->>'ngay_sinh')::date end,
    m->>'dia_chi',
    v_cccd,
    m->>'sdt',
    new.email,
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    v_dv is not null,
    case when v_dv is not null then now() end,
    v_dv,
    case when v_dv is not null then v_cv end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------- Bảo vệ hồ sơ: vai trò + đơn vị ----------
-- Ai cấp được vai trò gì (trong đơn vị mình, không tự cấp cho mình):
--   Trưởng CA, Cán bộ (admin) : mọi chức vụ trong đơn vị mình — Cán bộ, Phó, Trưởng CA, admin (giao / thu / chuyển giao)
--   dev (tỉnh)                : mọi vai trò, mọi đơn vị
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := public.my_role();
  v_dv text := public.my_don_vi();
  v_self boolean := new.id = auth.uid();
begin
  if auth.uid() is null then return new; end if;          -- service-role / SQL editor
  -- RPC hệ thống (xin_doi_don_vi) đã tự kiểm tra quyền; cờ chỉ đặt được bên trong hàm security definer
  if current_setting('luutru.he_thong', true) = '1' then return new; end if;
  if new.cccd is distinct from old.cccd and old.cccd is not null and r is distinct from 'dev' then
    raise exception 'Không được đổi số CCCD';
  end if;
  if new.email is distinct from old.email or new.provider is distinct from old.provider then
    new.email := old.email; new.provider := old.provider;
  end if;

  if new.role is distinct from old.role then
    if r = 'dev' then
      null;
    elsif r in ('truong_ca', 'admin') then
      if v_self then raise exception 'Không tự đổi vai trò của chính mình'; end if;
      if v_dv is null then raise exception 'Tài khoản của bạn chưa gắn đơn vị'; end if;
      if 'dev' in (new.role, old.role) then
        raise exception 'Chỉ Quản trị tỉnh (dev) được giao / thu quyền dev';
      end if;
      -- Trưởng CA và Cán bộ (admin) cấp / thu MỌI chức vụ trong đơn vị mình (kể cả Trưởng CA, admin).
      -- Giao Trưởng CA / admin khi đã có người giữ → dùng RPC giao_chuc (chuyển giao, người cũ về Cán bộ).
      if new.role <> 'nguoi_dan' then new.don_vi_id := v_dv; end if;
    else
      raise exception 'Chỉ Trưởng CA, Cán bộ (admin) hoặc dev được duyệt / cấp quyền';
    end if;
    new.yeu_cau_can_bo := false;
    new.yeu_cau_chuc_vu := null;
    if new.role = 'nguoi_dan' then new.don_vi_id := null; end if;   -- về người dân: không thuộc đơn vị
  elsif new.don_vi_id is distinct from old.don_vi_id then
    -- Đổi đơn vị (không đổi vai trò): dev; hoặc người dân tự chọn khi xin làm cán bộ
    if not (r = 'dev' or (v_self and old.role = 'nguoi_dan')) then
      raise exception 'Không được đổi đơn vị';
    end if;
  end if;

  if new.role in ('can_bo', 'pho_truong', 'truong_ca', 'admin') and new.don_vi_id is null then
    raise exception 'Cán bộ phải thuộc một đơn vị (xã/phường)';
  end if;

  -- Xin làm cán bộ: bắt buộc chọn đơn vị + chức vụ; rút / bị từ chối → bỏ đơn vị
  if new.yeu_cau_can_bo then
    if new.don_vi_id is null then raise exception 'Chọn đơn vị công tác'; end if;
    new.yeu_cau_chuc_vu := coalesce(new.yeu_cau_chuc_vu, 'can_bo');
    if new.yeu_cau_chuc_vu in ('truong_ca', 'admin')
       and (not old.yeu_cau_can_bo or new.don_vi_id is distinct from old.don_vi_id
            or new.yeu_cau_chuc_vu is distinct from old.yeu_cau_chuc_vu)
       and exists (select 1 from public.profiles where role = new.yeu_cau_chuc_vu and don_vi_id = new.don_vi_id and id <> new.id) then
      raise exception 'Đơn vị này đã có % — chọn chức vụ khác', public.ten_chuc_vu(new.yeu_cau_chuc_vu);
    end if;
    if not old.yeu_cau_can_bo then new.yeu_cau_luc := now(); end if;
  elsif new.role = 'nguoi_dan' then
    new.don_vi_id := null; new.yeu_cau_chuc_vu := null;
  end if;

  -- Rời đơn vị / thôi cán bộ → bỏ giao các nhóm cũ
  if new.role = 'nguoi_dan' or new.don_vi_id is distinct from old.don_vi_id then
    update public.nhom_co_so set can_bo_id = null
     where can_bo_id = new.id and (new.role = 'nguoi_dan' or don_vi_id is distinct from new.don_vi_id);
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- ---------- Cán bộ tự xin đổi đơn vị / chức vụ (màn Tài khoản) ----------
-- Đổi đơn vị hoặc chức vụ → MẤT quyền hiện tại, quay về CHỜ DUYỆT (Trưởng CA / admin đơn vị mới, hoặc dev).
-- RIÊNG: đã là cán bộ của đơn vị mà xin làm Cán bộ (admin) CỦA CHÍNH đơn vị đó khi admin đang khuyết
--        → nhận ngay, không cần duyệt. Trả 'da_nhan' hoặc 'cho_duyet'.
drop function if exists public.xin_doi_don_vi(text, text);
create function public.xin_doi_don_vi(p_don_vi text, p_chuc_vu text) returns text
language plpgsql security definer set search_path = public as $$
declare t public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select * into t from public.profiles where id = auth.uid() for update;
  if t.role not in ('can_bo', 'pho_truong', 'truong_ca', 'admin') then
    raise exception 'Chỉ cán bộ mới xin đổi đơn vị / chức vụ';
  end if;
  if not exists (select 1 from public.don_vi where id = p_don_vi) then raise exception 'Đơn vị không hợp lệ'; end if;
  if coalesce(p_chuc_vu, '') not in ('can_bo', 'pho_truong', 'truong_ca', 'admin') then raise exception 'Chức vụ không hợp lệ'; end if;
  if p_don_vi = t.don_vi_id and p_chuc_vu = t.role then raise exception 'Đơn vị và chức vụ không đổi'; end if;
  if public.don_vi_da_co(p_don_vi, p_chuc_vu) then
    raise exception 'Đơn vị này đã có % — chọn chức vụ khác', public.ten_chuc_vu(p_chuc_vu);
  end if;

  perform set_config('luutru.he_thong', '1', true);
  if p_chuc_vu = 'admin' and p_don_vi = t.don_vi_id then
    update public.profiles set role = 'admin', yeu_cau_can_bo = false, yeu_cau_chuc_vu = null where id = auth.uid();
    perform set_config('luutru.he_thong', '', true);
    return 'da_nhan';
  end if;
  update public.profiles
     set role = 'nguoi_dan', don_vi_id = p_don_vi,
         yeu_cau_can_bo = true, yeu_cau_chuc_vu = p_chuc_vu, yeu_cau_luc = now()
   where id = auth.uid();
  update public.nhom_co_so set can_bo_id = null where can_bo_id = auth.uid();
  perform set_config('luutru.he_thong', '', true);
  return 'cho_duyet';
end $$;
revoke all on function public.xin_doi_don_vi(text, text) from public, anon;
grant execute on function public.xin_doi_don_vi(text, text) to authenticated;

-- ---------- Giao / chuyển giao chức Trưởng CA hoặc Cán bộ (admin) ----------
-- Người gọi: Trưởng CA hoặc Cán bộ (admin) của đơn vị (dev: mọi đơn vị, truyền p_don_vi).
-- Người nhận: cán bộ trong đơn vị, hoặc người đang xin vào đơn vị. Người đang giữ chức đó (kể cả người gọi)
-- tự về Cán bộ — mỗi đơn vị vẫn chỉ 1 Trưởng CA, 1 admin.
create or replace function public.giao_chuc(p_id uuid, p_chuc_vu text, p_don_vi text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r text := public.my_role();
  v_dv text := case when public.my_role() = 'dev' then coalesce(p_don_vi, (select don_vi_id from public.profiles where id = p_id))
                    else public.my_don_vi() end;
  t public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if r not in ('truong_ca', 'admin', 'dev') then raise exception 'Chỉ Trưởng CA, Cán bộ (admin) hoặc dev được giao chức'; end if;
  if coalesce(p_chuc_vu, '') not in ('truong_ca', 'admin') then raise exception 'Chỉ giao chức Trưởng CA hoặc Cán bộ (admin)'; end if;
  if v_dv is null then raise exception 'Chưa xác định đơn vị'; end if;
  if p_id = auth.uid() then raise exception 'Không tự giao chức cho chính mình'; end if;
  select * into t from public.profiles where id = p_id for update;
  if not found then raise exception 'Không tìm thấy người nhận'; end if;
  if t.role = 'dev' then raise exception 'Không đổi được quyền dev'; end if;
  if r <> 'dev' and not (
       (t.role in ('can_bo', 'pho_truong', 'truong_ca', 'admin') and t.don_vi_id = v_dv)
    or (t.role = 'nguoi_dan' and t.yeu_cau_can_bo and t.don_vi_id = v_dv)
  ) then raise exception 'Người nhận phải là cán bộ (hoặc đang xin vào) đơn vị của bạn'; end if;
  if t.role = p_chuc_vu and t.don_vi_id = v_dv then raise exception 'Người này đã giữ chức đó'; end if;

  perform set_config('luutru.he_thong', '1', true);
  update public.profiles set role = 'can_bo'
   where role = p_chuc_vu and don_vi_id = v_dv and id <> p_id;          -- người giữ chức cũ về Cán bộ
  update public.profiles
     set role = p_chuc_vu, don_vi_id = v_dv, yeu_cau_can_bo = false, yeu_cau_chuc_vu = null
   where id = p_id;
  -- nhận chức ở đơn vị khác với đơn vị cũ (dev giao) → bỏ giao nhóm cũ
  update public.nhom_co_so set can_bo_id = null where can_bo_id = p_id and don_vi_id is distinct from v_dv;
  perform set_config('luutru.he_thong', '', true);
end $$;
revoke all on function public.giao_chuc(uuid, text, text) from public, anon;
grant execute on function public.giao_chuc(uuid, text, text) to authenticated;

-- ---------- Nhóm cơ sở luôn thuộc 1 đơn vị ----------
create or replace function public.guard_nhom() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if not public.is_dev() or new.don_vi_id is null then new.don_vi_id := public.my_don_vi(); end if;
  elsif new.don_vi_id is distinct from old.don_vi_id then
    if old.don_vi_id is not null then raise exception 'Không đổi đơn vị của nhóm — hãy tạo nhóm mới'; end if;
    if not public.is_dev() then raise exception 'Nhóm chưa gắn đơn vị — nhờ dev gắn'; end if;
  end if;
  if new.don_vi_id is null then raise exception 'Nhóm phải thuộc một đơn vị'; end if;
  if new.can_bo_id is not null and not exists (
    select 1 from public.profiles where id = new.can_bo_id and don_vi_id = new.don_vi_id
      and role in ('can_bo', 'pho_truong', 'truong_ca', 'admin')
  ) then raise exception 'Cán bộ phụ trách phải thuộc cùng đơn vị với nhóm'; end if;
  return new;
end $$;
drop trigger if exists guard_nhom on public.nhom_co_so;
create trigger guard_nhom before insert or update on public.nhom_co_so
  for each row execute function public.guard_nhom();

-- ---------- Cơ sở: người dân chọn xã/phường; chỉ quản trị đơn vị đó phân nhóm ----------
create or replace function public.guard_co_so() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qt boolean;
begin
  if auth.uid() is null then return new; end if;
  v_qt := public.is_dev() or (public.quan_tri_don_vi(new.don_vi_id)
          and (tg_op = 'INSERT' or public.quan_tri_don_vi(old.don_vi_id)));
  if tg_op = 'INSERT' then
    if not v_qt then new.nhom_id := null; new.chu_id := auth.uid(); end if;
    if new.don_vi_id is null then raise exception 'Chọn xã/phường nơi lưu trú'; end if;
  else
    if not v_qt and (new.nhom_id is distinct from old.nhom_id or new.chu_id is distinct from old.chu_id) then
      raise exception 'Chỉ Trưởng / Phó Trưởng CA được phân nhóm cơ sở';
    end if;
    if new.don_vi_id is null and old.don_vi_id is not null then raise exception 'Chọn xã/phường nơi lưu trú'; end if;
    -- chuyển sang xã/phường khác → về "chưa phân nhóm" của đơn vị mới
    if new.don_vi_id is distinct from old.don_vi_id and new.nhom_id is not distinct from old.nhom_id then
      new.nhom_id := null;
    end if;
  end if;
  if new.nhom_id is not null and not exists (
    select 1 from public.nhom_co_so where id = new.nhom_id and don_vi_id = new.don_vi_id
  ) then raise exception 'Nhóm không thuộc xã/phường của cơ sở'; end if;
  return new;
end $$;
drop trigger if exists guard_co_so on public.co_so;
create trigger guard_co_so before insert or update on public.co_so
  for each row execute function public.guard_co_so();

-- ---------- RPC nghiệp vụ (quyền theo đơn vị) ----------
create or replace function public.gui_thong_bao(
  p_co_so bigint, p_nguoi jsonb, p_tu_ngay date default current_date, p_gia_han_tu bigint default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.la_chu_co_so(p_co_so) then raise exception 'Không phải cơ sở của bạn'; end if;
  if exists (select 1 from public.co_so where id = p_co_so and don_vi_id is null) then
    raise exception 'Nơi lưu trú chưa chọn xã/phường — vào Tài khoản → sửa nơi lưu trú';
  end if;
  if jsonb_typeof(p_nguoi) <> 'array' or jsonb_array_length(p_nguoi) = 0 then
    raise exception 'Danh sách lưu trú trống';
  end if;
  if p_gia_han_tu is not null and not exists (
    select 1 from public.thong_bao where id = p_gia_han_tu and co_so_id = p_co_so and trang_thai = 'da_duyet'
  ) then raise exception 'Thông báo gốc không hợp lệ để gia hạn'; end if;

  insert into public.thong_bao (co_so_id, nguoi_gui, tu_ngay, den_ngay, gia_han_tu)
  values (p_co_so, auth.uid(), p_tu_ngay, p_tu_ngay + 30, p_gia_han_tu)
  returning id into v_id;

  insert into public.thong_bao_nguoi (thong_bao_id, cccd, cmnd, ho_ten, ngay_sinh, gioi_tinh, dia_chi, ngay_cap)
  select v_id, x->>'cccd', nullif(x->>'cmnd',''), x->>'ho_ten',
         nullif(x->>'ngay_sinh','')::date, x->>'gioi_tinh', x->>'dia_chi',
         nullif(x->>'ngay_cap','')::date
  from jsonb_array_elements(p_nguoi) x
  on conflict (thong_bao_id, cccd) do nothing;
  return v_id;
end $$;

create or replace function public.duyet_thong_bao(p_id bigint, p_dong_y boolean, p_ly_do text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_co_so bigint;
begin
  select co_so_id into v_co_so from public.thong_bao where id = p_id and trang_thai = 'cho_duyet';
  if v_co_so is null then raise exception 'Thông báo không còn chờ duyệt'; end if;
  if not (public.quan_ly_co_so(v_co_so) or public.quan_tri_co_so(v_co_so) or public.is_dev()) then
    raise exception 'Bạn không phụ trách cơ sở này';
  end if;
  if not p_dong_y and coalesce(trim(p_ly_do), '') = '' then raise exception 'Cần nhập lý do từ chối'; end if;
  update public.thong_bao
     set trang_thai = case when p_dong_y then 'da_duyet' else 'tu_choi' end,
         ly_do = case when p_dong_y then null else trim(p_ly_do) end,
         nguoi_duyet = auth.uid(), duyet_luc = now()
   where id = p_id;
end $$;

create or replace function public.xem_duoc_canh_bao(p_tbn bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_dev() or exists (
    select 1 from public.thong_bao_nguoi n join public.thong_bao t on t.id = n.thong_bao_id
    where n.id = p_tbn and (public.quan_ly_co_so(t.co_so_id) or public.quan_tri_co_so(t.co_so_id))
  )
$$;

-- Push cảnh báo truy nã: cán bộ phụ trách nhóm + Trưởng/Phó Trưởng CA/admin CỦA ĐƠN VỊ cơ sở + dev
create or replace function public.canh_bao_gui_push() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text; v_secret text; v_tokens jsonb; v_co_so text;
begin
  select gia_tri into v_url from public.cau_hinh where khoa = 'push_url';
  select gia_tri into v_secret from public.cau_hinh where khoa = 'push_secret';
  if v_url is null or v_secret is null then return new; end if;

  select c.ten, coalesce(jsonb_agg(distinct d.token) filter (where d.token is not null), '[]'::jsonb)
    into v_co_so, v_tokens
  from public.thong_bao_nguoi n
  join public.thong_bao t on t.id = n.thong_bao_id
  join public.co_so c on c.id = t.co_so_id
  left join public.nhom_co_so g on g.id = c.nhom_id
  left join public.profiles p on
       (p.id = g.can_bo_id and p.don_vi_id = c.don_vi_id)
    or (p.role in ('truong_ca', 'pho_truong', 'admin') and p.don_vi_id = c.don_vi_id)
    or p.role = 'dev'
  left join public.thiet_bi d on d.user_id = p.id
  where n.id = new.thong_bao_nguoi_id
  group by c.ten;

  if v_tokens is null or jsonb_array_length(v_tokens) = 0 then return new; end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-luutru-secret', v_secret),
    body := jsonb_build_object(
      'tokens', v_tokens,
      'title', case when new.muc_do = 'cao' then '🚨 Nghi trùng đối tượng truy nã' else '⚠️ Có thể trùng đối tượng truy nã' end,
      'body', 'Người lưu trú tại ' || coalesce(v_co_so, 'một cơ sở') || ' trùng tên + năm sinh với đối tượng truy nã. Mở app để xác minh.',
      'data', jsonb_build_object('kind', 'truy_na', 'canhBaoId', new.id::text)
    )
  );
  return new;
end $$;

-- ---------- RLS ----------
-- profiles: bản thân; dev; Trưởng/Phó thấy người TRONG đơn vị mình + người dân chưa thuộc đơn vị nào
--           (tra CCCD để cấp quyền); cán bộ/quản trị thấy chủ các cơ sở mình quản lý
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_dev()
  or (public.my_role() in ('truong_ca', 'pho_truong', 'admin')
      and (don_vi_id = public.my_don_vi() or (role = 'nguoi_dan' and don_vi_id is null)))
  or exists (select 1 from public.co_so c where c.chu_id = profiles.id
             and (public.quan_ly_co_so(c.id) or public.quan_tri_co_so(c.id)))
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = auth.uid() or public.is_dev()
    or (public.my_role() in ('truong_ca', 'admin') and (don_vi_id = public.my_don_vi() or (role = 'nguoi_dan' and don_vi_id is null)))
  )
  with check (
    id = auth.uid() or public.is_dev()
    or (public.my_role() in ('truong_ca', 'admin') and (don_vi_id = public.my_don_vi() or (role = 'nguoi_dan' and don_vi_id is null)))
  );

drop policy if exists nhom_select on public.nhom_co_so;
create policy nhom_select on public.nhom_co_so for select to authenticated
  using (public.quan_tri_don_vi(don_vi_id) or public.is_dev() or can_bo_id = auth.uid());
drop policy if exists nhom_admin on public.nhom_co_so;
create policy nhom_admin on public.nhom_co_so for all to authenticated
  using (public.quan_tri_don_vi(don_vi_id) or public.is_dev())
  with check (public.quan_tri_don_vi(don_vi_id) or public.is_dev() or public.my_role() in ('truong_ca', 'pho_truong', 'admin'));

drop policy if exists co_so_select on public.co_so;
create policy co_so_select on public.co_so for select to authenticated
  using (chu_id = auth.uid() or public.quan_tri_don_vi(don_vi_id) or public.is_dev() or public.quan_ly_co_so(id));
drop policy if exists co_so_insert on public.co_so;
create policy co_so_insert on public.co_so for insert to authenticated
  with check (chu_id = auth.uid() or public.quan_tri_don_vi(don_vi_id));
drop policy if exists co_so_update on public.co_so;
create policy co_so_update on public.co_so for update to authenticated
  using (chu_id = auth.uid() or public.quan_tri_don_vi(don_vi_id) or public.is_dev())
  with check (chu_id = auth.uid() or public.quan_tri_don_vi(don_vi_id));
drop policy if exists co_so_delete on public.co_so;
create policy co_so_delete on public.co_so for delete to authenticated
  using (public.quan_tri_don_vi(don_vi_id) or public.is_dev());

drop policy if exists thong_bao_select on public.thong_bao;
create policy thong_bao_select on public.thong_bao for select to authenticated using (
  nguoi_gui = auth.uid() or public.la_chu_co_so(co_so_id)
  or public.quan_ly_co_so(co_so_id) or public.quan_tri_co_so(co_so_id) or public.is_dev()
);

drop policy if exists canh_bao_select on public.canh_bao_truy_na;
create policy canh_bao_select on public.canh_bao_truy_na for select to authenticated
  using (public.my_role() in ('can_bo', 'pho_truong', 'truong_ca', 'admin', 'dev') and public.xem_duoc_canh_bao(thong_bao_nguoi_id));

-- ---------- Dữ liệu cũ (trước khi có đơn vị) ----------
-- Nhóm / cơ sở cũ chưa có đơn vị: chỉ dev thấy. Gắn tất cả vào Phường Hàng Gòn (giống LEGACY_UNIT_ID của PlanRegister):
update public.nhom_co_so set don_vi_id = 'phuong-hang-gon' where don_vi_id is null;
update public.co_so      set don_vi_id = 'phuong-hang-gon' where don_vi_id is null;
