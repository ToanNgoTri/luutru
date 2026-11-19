-- =====================================================================
-- Truy nã + cảnh báo nghi trùng + thông báo đẩy cho cán bộ
-- Chạy SAU 01-schema.sql. Chạy lại được (idempotent).
-- ⚠ ĐÃ CÓ sql/05-don-vi.sql: chạy lại file này thì PHẢI chạy lại 05 ngay sau.
-- =====================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ---------- Chuẩn hoá chữ (phải giống scripts/dia-chi.mjs) ----------
create or replace function public.chuan_hoa_ten(p text) returns text
language sql immutable parallel safe set search_path = public, extensions as $$
  select trim(regexp_replace(lower(extensions.unaccent('extensions.unaccent', coalesce(p, ''))), '\s+', ' ', 'g'))
$$;

create or replace function public.chuan_hoa_dia_danh(p text) returns text
language sql immutable parallel safe set search_path = public, extensions as $$
  select regexp_replace(
           regexp_replace(
             trim(regexp_replace(regexp_replace(replace(public.chuan_hoa_ten(p), '.', ' '), '\s*\(.*?\)\s*', ' ', 'g'), '\s+', ' ', 'g')),
             '^(thanh pho|tinh|tp|quan|huyen|thi xa|thi tran|phuong|xa|tx|tt|q|p)\s+', ''),
           '^0+(\d)', '\1')
$$;

-- Tỉnh cũ (63) / mới (34) → tên tỉnh mới. Nạp bằng: npm run truyna -- tinh
create table if not exists public.tinh_cu_moi (
  khoa     text primary key,      -- chuan_hoa_dia_danh(tên tỉnh)
  tinh_moi text not null
);

-- Tỉnh mới của một địa chỉ: xét 2 đoạn cuối (sau dấu phẩy)
create or replace function public.tinh_moi_tu_dia_chi(p text) returns text
language sql stable set search_path = public as $$
  with seg as (
    select u.s, u.i
    from unnest(string_to_array(regexp_replace(coalesce(p, ''), '\(.*?\)', '', 'g'), ',')) with ordinality as u(s, i)
  ), cuoi as (
    select s, i from seg where trim(s) <> '' order by i desc limit 2
  )
  select t.tinh_moi from cuoi c join public.tinh_cu_moi t on t.khoa = public.chuan_hoa_dia_danh(c.s)
  order by c.i desc limit 1
$$;

-- ---------- Danh sách truy nã (đồng bộ từ truyna.bocongan.gov.vn) ----------
-- Đối tượng không còn trên trang → XOÁ HẲN (scripts/truyna.mjs), cảnh báo liên quan xoá theo.
create table if not exists public.truy_na (
  ma            uuid primary key,             -- mã GUID trong link /TimKiem/ChiTiet/{ma}
  ho_ten        text not null,
  ten_chuan     text,                         -- tự tính: chuan_hoa_ten(ho_ten)
  nam_sinh      int,
  noi_dktt      text,
  dktt_moi      text,                         -- địa danh mới tương ứng (trống nếu không có trong data)
  tinh_moi      text,
  ten_bo        text,
  ten_me        text,
  toi_danh      text,
  quyet_dinh    text,
  don_vi        text,
  pham_vi       text,
  loai_truy_na  text,
  bao_cho       text,                         -- đơn vị cần báo tin (trang chi tiết)
  sdt_bao       text,
  lan_dau_thay  timestamptz not null default now(),
  lan_cuoi_thay timestamptz not null default now()
);
create index if not exists truy_na_ten_nam_idx on public.truy_na(ten_chuan, nam_sinh);

create or replace function public.truy_na_chuan_hoa() returns trigger
language plpgsql set search_path = public as $$
begin
  new.ten_chuan := public.chuan_hoa_ten(new.ho_ten);
  if coalesce(new.tinh_moi, '') = '' then new.tinh_moi := public.tinh_moi_tu_dia_chi(new.noi_dktt); end if;
  return new;
end $$;
drop trigger if exists truy_na_chuan_hoa on public.truy_na;
create trigger truy_na_chuan_hoa before insert or update on public.truy_na
  for each row execute function public.truy_na_chuan_hoa();

create table if not exists public.dong_bo_truy_na (
  id          bigint generated always as identity primary key,
  bat_dau     timestamptz not null default now(),
  ket_thuc    timestamptz,
  kieu        text,            -- day-du | nhanh
  tong_tren_trang int,
  so_doc      int,
  so_moi      int,
  so_xoa      int,
  so_canh_bao int,
  loi         text
);

-- ---------- Cảnh báo nghi trùng ----------
create table if not exists public.canh_bao_truy_na (
  id                 bigint generated always as identity primary key,
  thong_bao_nguoi_id bigint not null references public.thong_bao_nguoi(id) on delete cascade,
  truy_na_ma         uuid not null references public.truy_na(ma) on delete cascade,
  muc_do             text not null check (muc_do in ('cao', 'trung_ten')),  -- cao = tên + năm sinh + cùng tỉnh
  trang_thai         text not null default 'moi' check (trang_thai in ('moi', 'dung', 'khong_phai')),
  ghi_chu            text,
  nguoi_xu_ly        uuid references public.profiles(id) on delete set null,
  xu_ly_luc          timestamptz,
  created_at         timestamptz not null default now(),
  unique (thong_bao_nguoi_id, truy_na_ma)
);
create index if not exists canh_bao_tt_idx on public.canh_bao_truy_na(trang_thai, created_at desc);

-- Thiết bị nhận push (1 token = 1 người: đăng nhập tài khoản khác trên cùng máy thì token chuyển chủ)
create table if not exists public.thiet_bi (
  token       text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  nen_tang    text,
  updated_at  timestamptz not null default now()
);
create index if not exists thiet_bi_user_idx on public.thiet_bi(user_id);

-- Cấu hình bí mật (URL + khoá của Cloud Function gửi push). RLS bật, KHÔNG có policy → chỉ service-role.
create table if not exists public.cau_hinh (
  khoa     text primary key,
  gia_tri  text not null
);

-- ---------- So trùng ----------
-- So 1 người lưu trú với danh sách truy nã; trả số cảnh báo mới tạo
create or replace function public.quet_truy_na_nguoi(p_tbn bigint) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with p as (
    select n.id, public.chuan_hoa_ten(n.ho_ten) as ten, extract(year from n.ngay_sinh)::int as nam,
           public.tinh_moi_tu_dia_chi(n.dia_chi) as tinh
    from public.thong_bao_nguoi n where n.id = p_tbn and n.ngay_sinh is not null
  ), moi as (
    insert into public.canh_bao_truy_na (thong_bao_nguoi_id, truy_na_ma, muc_do)
    select p.id, t.ma, case when p.tinh is not null and p.tinh = t.tinh_moi then 'cao' else 'trung_ten' end
    from p join public.truy_na t on t.ten_chuan = p.ten and t.nam_sinh = p.nam
    on conflict (thong_bao_nguoi_id, truy_na_ma) do nothing
    returning 1
  )
  select count(*) into v_n from moi;
  return v_n;
end $$;
revoke all on function public.quet_truy_na_nguoi(bigint) from public, anon, authenticated;

create or replace function public.tbn_quet_truy_na() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.quet_truy_na_nguoi(new.id);
  return new;
end $$;
drop trigger if exists tbn_quet_truy_na on public.thong_bao_nguoi;
create trigger tbn_quet_truy_na after insert on public.thong_bao_nguoi
  for each row execute function public.tbn_quet_truy_na();

-- Quét lại toàn bộ người đang lưu trú (chạy sau mỗi lần đồng bộ danh sách)
create or replace function public.quet_lai_truy_na() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_tong int := 0;
begin
  for r in
    select n.id from public.thong_bao_nguoi n join public.thong_bao t on t.id = n.thong_bao_id
    where t.trang_thai in ('cho_duyet', 'da_duyet') and t.den_ngay >= current_date
  loop
    v_tong := v_tong + public.quet_truy_na_nguoi(r.id);
  end loop;
  return v_tong;
end $$;
revoke all on function public.quet_lai_truy_na() from public, anon, authenticated;
grant execute on function public.quet_lai_truy_na() to service_role;

-- Cán bộ được xem cảnh báo của 1 người lưu trú? (cán bộ phụ trách nhóm hoặc chỉ huy/dev)
create or replace function public.xem_duoc_canh_bao(p_tbn bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.thong_bao_nguoi n join public.thong_bao t on t.id = n.thong_bao_id
    where n.id = p_tbn and public.quan_ly_co_so(t.co_so_id)
  )
$$;

-- Cán bộ xử lý cảnh báo
create or replace function public.xu_ly_canh_bao(p_id bigint, p_dung boolean, p_ghi_chu text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tbn bigint;
begin
  select thong_bao_nguoi_id into v_tbn from public.canh_bao_truy_na where id = p_id;
  if v_tbn is null then raise exception 'Cảnh báo không tồn tại'; end if;
  if not public.xem_duoc_canh_bao(v_tbn) then raise exception 'Bạn không phụ trách cơ sở này'; end if;
  update public.canh_bao_truy_na
     set trang_thai = case when p_dung then 'dung' else 'khong_phai' end,
         ghi_chu = nullif(trim(coalesce(p_ghi_chu, '')), ''), nguoi_xu_ly = auth.uid(), xu_ly_luc = now()
   where id = p_id;
end $$;
revoke all on function public.xu_ly_canh_bao(bigint, boolean, text) from public, anon;
grant execute on function public.xu_ly_canh_bao(bigint, boolean, text) to authenticated;

-- Tìm trong danh sách truy nã (cán bộ)
create or replace function public.tim_truy_na(p_q text default '', p_nam int default null, p_tu int default 0)
returns setof public.truy_na
language sql stable set search_path = public as $$
  select * from public.truy_na
  where (coalesce(p_q, '') = '' or ten_chuan like '%' || public.chuan_hoa_ten(p_q) || '%')
    and (p_nam is null or nam_sinh = p_nam)
  order by lan_dau_thay desc, ho_ten
  offset greatest(p_tu, 0) limit 50
$$;

-- ---------- Thiết bị (push) ----------
create or replace function public.dang_ky_thiet_bi(p_token text, p_nen_tang text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(p_token, '') = '' then return; end if;
  insert into public.thiet_bi (token, user_id, nen_tang, updated_at)
  values (p_token, auth.uid(), p_nen_tang, now())
  on conflict (token) do update set user_id = excluded.user_id, nen_tang = excluded.nen_tang, updated_at = now();
end $$;
create or replace function public.huy_thiet_bi(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.thiet_bi where token = p_token and user_id = auth.uid()
$$;
revoke all on function public.dang_ky_thiet_bi(text, text) from public, anon;
revoke all on function public.huy_thiet_bi(text) from public, anon;
grant execute on function public.dang_ky_thiet_bi(text, text) to authenticated;
grant execute on function public.huy_thiet_bi(text) to authenticated;

-- ---------- Gửi push khi có cảnh báo mới ----------
-- Người nhận: cán bộ phụ trách nhóm của cơ sở + mọi chỉ huy/dev.
-- Nội dung KHÔNG ghi tên người lưu trú (hiện trên màn hình khoá).
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
  left join public.profiles p on p.id = g.can_bo_id or p.role in ('chi_huy', 'dev')
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
drop trigger if exists canh_bao_gui_push on public.canh_bao_truy_na;
create trigger canh_bao_gui_push after insert on public.canh_bao_truy_na
  for each row execute function public.canh_bao_gui_push();

-- ---------- RLS ----------
alter table public.tinh_cu_moi      enable row level security;
alter table public.truy_na          enable row level security;
alter table public.dong_bo_truy_na  enable row level security;
alter table public.canh_bao_truy_na enable row level security;
alter table public.thiet_bi         enable row level security;
alter table public.cau_hinh         enable row level security;

-- danh sách truy nã + nhật ký đồng bộ: mọi người đã đăng nhập đều tra cứu được (dữ liệu công khai)
drop policy if exists truy_na_select on public.truy_na;
create policy truy_na_select on public.truy_na for select to authenticated
  using (true);
drop policy if exists dong_bo_select on public.dong_bo_truy_na;
create policy dong_bo_select on public.dong_bo_truy_na for select to authenticated
  using (true);

-- cảnh báo: CHỈ cán bộ phụ trách + chỉ huy/dev; người dân không bao giờ đọc được
drop policy if exists canh_bao_select on public.canh_bao_truy_na;
create policy canh_bao_select on public.canh_bao_truy_na for select to authenticated
  using (public.my_role() in ('can_bo', 'chi_huy', 'dev') and public.xem_duoc_canh_bao(thong_bao_nguoi_id));

-- thiet_bi / cau_hinh / tinh_cu_moi: không policy → chỉ qua RPC hoặc service-role

-- tìm truy nã đi qua RLS của truy_na (security invoker)
grant execute on function public.tim_truy_na(text, int, int) to authenticated;

-- Realtime (danh sách cảnh báo tự làm mới khi đang mở app)
do $$ begin
  alter publication supabase_realtime add table public.canh_bao_truy_na;
exception when duplicate_object then null; when undefined_object then null; end $$;
