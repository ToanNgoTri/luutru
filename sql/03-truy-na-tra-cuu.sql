-- =====================================================================
-- Cho NGƯỜI DÂN tra cứu danh sách truy nã (dữ liệu công khai của Bộ Công an).
-- Cảnh báo nghi trùng (canh_bao_truy_na) VẪN chỉ cán bộ / chỉ huy / dev đọc được — không đổi.
-- Chạy sau 02-truy-na.sql. Chạy lại được.
-- =====================================================================

drop policy if exists truy_na_select on public.truy_na;
create policy truy_na_select on public.truy_na for select to authenticated
  using (true);

drop policy if exists dong_bo_select on public.dong_bo_truy_na;
create policy dong_bo_select on public.dong_bo_truy_na for select to authenticated
  using (true);
