-- =====================================================================
-- App Thông báo lưu trú — lược đồ + RLS (Supabase rkbzijjembmylylhpyyx)
-- Chạy 1 lần trong Dashboard → SQL Editor. Chạy lại được (idempotent).
-- ⚠ ĐÃ CÓ sql/05-don-vi.sql (phân quyền theo đơn vị): chạy lại file này thì PHẢI chạy lại 05 ngay sau.
-- =====================================================================

-- ---------- Bảng ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  ho_ten      text not null default '',
  ngay_sinh   date,
  dia_chi     text,
  -- null khi mới đăng nhập Google/Apple, bắt buộc điền ở màn "Hoàn tất hồ sơ"
  cccd        text unique check (cccd is null or cccd ~ '^[0-9]{12}$'),
  sdt         text,
  email       text,
  provider    text,                                   -- email | google | apple
  -- người dùng chọn "Cán bộ" lúc vào app → chờ chỉ huy/dev duyệt mới thành can_bo
  yeu_cau_can_bo boolean not null default false,
  yeu_cau_luc    timestamptz,
  -- nguoi_dan = người thông báo lưu trú; can_bo = quản lý nhóm cơ sở;
  -- chi_huy / dev = phân công cán bộ + nhóm, xem toàn bộ
  role        text not null default 'nguoi_dan'
              check (role in ('nguoi_dan','can_bo','chi_huy','dev')),
  created_at  timestamptz not null default now()
);

create table if not exists public.nhom_co_so (
  id          bigint generated always as identity primary key,
  ten         text not null,
  can_bo_id   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.co_so (
  id          bigint generated always as identity primary key,
  chu_id      uuid references public.profiles(id) on delete set null,   -- xoá tài khoản vẫn giữ hồ sơ cho Công an xã
  ten         text not null,
  dia_chi     text not null,
  nhom_id     bigint references public.nhom_co_so(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists co_so_chu_idx on public.co_so(chu_id);
create index if not exists co_so_nhom_idx on public.co_so(nhom_id);

create table if not exists public.thong_bao (
  id            bigint generated always as identity primary key,
  co_so_id      bigint not null references public.co_so(id) on delete cascade,
  nguoi_gui     uuid references public.profiles(id) on delete set null,
  tu_ngay       date not null default current_date,
  den_ngay      date not null,                        -- tu_ngay + 30 ngày
  gia_han_tu    bigint references public.thong_bao(id) on delete set null,
  trang_thai    text not null default 'cho_duyet'
                check (trang_thai in ('cho_duyet','da_duyet','tu_choi','da_huy')),
  ly_do         text,                                 -- lý do từ chối
  nguoi_duyet   uuid references public.profiles(id) on delete set null,
  duyet_luc     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists thong_bao_co_so_idx on public.thong_bao(co_so_id, created_at desc);
create index if not exists thong_bao_gui_idx on public.thong_bao(nguoi_gui, created_at desc);
create index if not exists thong_bao_gia_han_idx on public.thong_bao(gia_han_tu);

create table if not exists public.thong_bao_nguoi (
  id            bigint generated always as identity primary key,
  thong_bao_id  bigint not null references public.thong_bao(id) on delete cascade,
  cccd          text not null,
  cmnd          text,
  ho_ten        text not null,
  ngay_sinh     date,
  gioi_tinh     text,
  dia_chi       text,
  ngay_cap      date,
  unique (thong_bao_id, cccd)
);
create index if not exists tbn_cccd_idx on public.thong_bao_nguoi(cccd);

-- ---------- Nâng cấp bảng đã tạo bằng bản SQL cũ (chạy lại an toàn) ----------
alter table public.profiles alter column ho_ten set default '';
alter table public.profiles alter column cccd drop not null;
alter table public.profiles drop constraint if exists profiles_cccd_check;
alter table public.profiles add constraint profiles_cccd_check check (cccd is null or cccd ~ '^[0-9]{12}$');
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists provider text;
alter table public.profiles add column if not exists yeu_cau_can_bo boolean not null default false;
alter table public.profiles add column if not exists yeu_cau_luc timestamptz;

alter table public.co_so alter column chu_id drop not null;
alter table public.co_so drop constraint if exists co_so_chu_id_fkey;
alter table public.co_so add constraint co_so_chu_id_fkey foreign key (chu_id) references public.profiles(id) on delete set null;

alter table public.thong_bao alter column nguoi_gui drop not null;
alter table public.thong_bao drop constraint if exists thong_bao_nguoi_gui_fkey;
alter table public.thong_bao add constraint thong_bao_nguoi_gui_fkey foreign key (nguoi_gui) references public.profiles(id) on delete set null;
alter table public.thong_bao drop constraint if exists thong_bao_nguoi_duyet_fkey;
alter table public.thong_bao add constraint thong_bao_nguoi_duyet_fkey foreign key (nguoi_duyet) references public.profiles(id) on delete set null;

-- ---------- Hàm trợ giúp (security definer để RLS không đệ quy) ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('chi_huy','dev') from public.profiles where id = auth.uid()), false)
$$;

-- người đang đăng nhập là cán bộ phụ trách cơ sở này?
create or replace function public.quan_ly_co_so(p_co_so bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.co_so c join public.nhom_co_so n on n.id = c.nhom_id
    where c.id = p_co_so and n.can_bo_id = auth.uid()
  )
$$;

create or replace function public.la_chu_co_so(p_co_so bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.co_so where id = p_co_so and chu_id = auth.uid())
$$;

-- ---------- Tạo profile khi đăng ký (metadata từ app) ----------
-- Đăng ký bằng CCCD: metadata có cccd/ho_ten/...; Google/Apple: chỉ có full_name/name + email.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_cccd text := m->>'cccd';
  v_can_bo boolean := coalesce(m->>'vai_tro', '') = 'can_bo';
begin
  if v_cccd !~ '^[0-9]{12}$' or exists (select 1 from public.profiles where cccd = v_cccd) then
    v_cccd := null;                                   -- để màn Hoàn tất hồ sơ hỏi lại
  end if;
  insert into public.profiles (id, ho_ten, ngay_sinh, dia_chi, cccd, sdt, email, provider, yeu_cau_can_bo, yeu_cau_luc)
  values (
    new.id,
    coalesce(nullif(m->>'ho_ten', ''), nullif(m->>'full_name', ''), nullif(m->>'name', ''), ''),
    case when coalesce(m->>'ngay_sinh', '') ~ '^\d{4}-\d{2}-\d{2}$' then (m->>'ngay_sinh')::date end,
    m->>'dia_chi',
    v_cccd,
    m->>'sdt',
    new.email,
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    v_can_bo,
    case when v_can_bo then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Người dùng tự sửa hồ sơ nhưng KHÔNG được tự đổi role / CCCD.
-- Chỉ huy không được cấp/thu quyền dev; chỉ dev làm được.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := public.my_role();
begin
  if auth.uid() is null then return new; end if;          -- service-role / SQL editor
  -- CCCD: điền lần đầu được (tài khoản Google/Apple), sau đó chỉ dev sửa
  if new.cccd is distinct from old.cccd and old.cccd is not null and r is distinct from 'dev' then
    raise exception 'Không được đổi số CCCD';
  end if;
  if new.role is distinct from old.role then
    if r not in ('chi_huy','dev') then raise exception 'Không có quyền đổi vai trò'; end if;
    if r = 'chi_huy' and ('dev' in (new.role, old.role)) then
      raise exception 'Chỉ dev được cấp/thu quyền dev';
    end if;
    new.yeu_cau_can_bo := false;                      -- đã xử lý yêu cầu
  end if;
  if new.yeu_cau_can_bo and not old.yeu_cau_can_bo then new.yeu_cau_luc := now(); end if;
  if new.email is distinct from old.email or new.provider is distinct from old.provider then
    new.email := old.email; new.provider := old.provider;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- Chủ cơ sở không tự gán nhóm (chỉ huy/dev phân công)
create or replace function public.guard_co_so() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.nhom_id := null; new.chu_id := auth.uid(); end if;
  if tg_op = 'UPDATE' and (new.nhom_id is distinct from old.nhom_id or new.chu_id is distinct from old.chu_id) then
    raise exception 'Chỉ chỉ huy/dev được phân nhóm cơ sở';
  end if;
  return new;
end $$;
drop trigger if exists guard_co_so on public.co_so;
create trigger guard_co_so before insert or update on public.co_so
  for each row execute function public.guard_co_so();

-- ---------- RPC nghiệp vụ ----------
-- Gửi thông báo lưu trú (mới hoặc gia hạn) kèm danh sách người, 1 giao dịch.
-- p_nguoi: [{cccd, cmnd, ho_ten, ngay_sinh:'YYYY-MM-DD', gioi_tinh, dia_chi, ngay_cap}]
create or replace function public.gui_thong_bao(
  p_co_so bigint, p_nguoi jsonb, p_tu_ngay date default current_date, p_gia_han_tu bigint default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.la_chu_co_so(p_co_so) then raise exception 'Không phải cơ sở của bạn'; end if;
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

-- Người dùng tự xoá tài khoản (yêu cầu của App Store / Google Play).
-- Hồ sơ lưu trú đã gửi vẫn giữ lại cho Công an xã (khoá ngoại set null).
create or replace function public.xoa_tai_khoan() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.xoa_tai_khoan() from public, anon;
grant execute on function public.xoa_tai_khoan() to authenticated;

-- Người gửi huỷ khi chưa được duyệt
create or replace function public.huy_thong_bao(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.thong_bao set trang_thai = 'da_huy'
  where id = p_id and nguoi_gui = auth.uid() and trang_thai = 'cho_duyet';
  if not found then raise exception 'Không huỷ được (đã xử lý hoặc không phải của bạn)'; end if;
end $$;

-- Cán bộ phụ trách (hoặc chỉ huy/dev) xác nhận / từ chối
create or replace function public.duyet_thong_bao(p_id bigint, p_dong_y boolean, p_ly_do text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_co_so bigint;
begin
  select co_so_id into v_co_so from public.thong_bao where id = p_id and trang_thai = 'cho_duyet';
  if v_co_so is null then raise exception 'Thông báo không còn chờ duyệt'; end if;
  if not (public.quan_ly_co_so(v_co_so) or public.is_admin()) then
    raise exception 'Bạn không phụ trách cơ sở này';
  end if;
  if not p_dong_y and coalesce(trim(p_ly_do), '') = '' then raise exception 'Cần nhập lý do từ chối'; end if;
  update public.thong_bao
     set trang_thai = case when p_dong_y then 'da_duyet' else 'tu_choi' end,
         ly_do = case when p_dong_y then null else trim(p_ly_do) end,
         nguoi_duyet = auth.uid(), duyet_luc = now()
   where id = p_id;
end $$;

-- ---------- RLS ----------
alter table public.profiles        enable row level security;
alter table public.nhom_co_so      enable row level security;
alter table public.co_so           enable row level security;
alter table public.thong_bao       enable row level security;
alter table public.thong_bao_nguoi enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin()
  or exists (select 1 from public.co_so c where c.chu_id = profiles.id and public.quan_ly_co_so(c.id))
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- nhom_co_so: chỉ huy/dev toàn quyền; cán bộ xem nhóm của mình
drop policy if exists nhom_select on public.nhom_co_so;
create policy nhom_select on public.nhom_co_so for select to authenticated
  using (public.is_admin() or can_bo_id = auth.uid());
drop policy if exists nhom_admin on public.nhom_co_so;
create policy nhom_admin on public.nhom_co_so for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- co_so
drop policy if exists co_so_select on public.co_so;
create policy co_so_select on public.co_so for select to authenticated
  using (chu_id = auth.uid() or public.is_admin() or public.quan_ly_co_so(id));
drop policy if exists co_so_insert on public.co_so;
create policy co_so_insert on public.co_so for insert to authenticated
  with check (chu_id = auth.uid() or public.is_admin());
drop policy if exists co_so_update on public.co_so;
create policy co_so_update on public.co_so for update to authenticated
  using (chu_id = auth.uid() or public.is_admin()) with check (chu_id = auth.uid() or public.is_admin());
drop policy if exists co_so_delete on public.co_so;
create policy co_so_delete on public.co_so for delete to authenticated using (public.is_admin());

-- thong_bao + thong_bao_nguoi: chỉ đọc qua RLS, mọi thay đổi đi qua RPC ở trên
drop policy if exists thong_bao_select on public.thong_bao;
create policy thong_bao_select on public.thong_bao for select to authenticated using (
  nguoi_gui = auth.uid() or public.la_chu_co_so(co_so_id)
  or public.quan_ly_co_so(co_so_id) or public.is_admin()
);
drop policy if exists tbn_select on public.thong_bao_nguoi;
create policy tbn_select on public.thong_bao_nguoi for select to authenticated using (
  exists (select 1 from public.thong_bao t where t.id = thong_bao_id)   -- kế thừa RLS thong_bao
);

-- quyền thực thi RPC
revoke all on function public.gui_thong_bao(bigint, jsonb, date, bigint) from public, anon;
revoke all on function public.huy_thong_bao(bigint) from public, anon;
revoke all on function public.duyet_thong_bao(bigint, boolean, text) from public, anon;
grant execute on function public.gui_thong_bao(bigint, jsonb, date, bigint) to authenticated;
grant execute on function public.huy_thong_bao(bigint) to authenticated;
grant execute on function public.duyet_thong_bao(bigint, boolean, text) to authenticated;

-- Realtime: cán bộ nhận thông báo mới khi đang mở app
do $$ begin
  alter publication supabase_realtime add table public.thong_bao;
exception when duplicate_object then null; when undefined_object then null; end $$;
