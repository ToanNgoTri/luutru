-- =====================================================================
-- Tìm truy nã theo đủ các trường (không phân biệt dấu, hoa/thường), trả kèm TỔNG số kết quả.
-- Chạy sau 02/03. Chạy lại được.
-- =====================================================================
create or replace function public.tim_truy_na2(
  p_ho_ten     text default null,
  p_nam_tu     int  default null,
  p_nam_den    int  default null,
  p_dia_chi    text default null,   -- khớp nơi ĐKTT (cũ) hoặc địa danh mới
  p_ten_bo     text default null,
  p_ten_me     text default null,
  p_toi_danh   text default null,
  p_quyet_dinh text default null,
  p_don_vi     text default null,
  p_tu         int  default 0
)
returns table (ma uuid, ho_ten text, nam_sinh int, noi_dktt text, dktt_moi text, toi_danh text, quyet_dinh text, tong bigint)
language sql stable set search_path = public as $$
  with dk as (
    select public.chuan_hoa_ten(p_ho_ten) as ten, public.chuan_hoa_ten(p_dia_chi) as dc,
           public.chuan_hoa_ten(p_ten_bo) as bo, public.chuan_hoa_ten(p_ten_me) as me,
           public.chuan_hoa_ten(p_toi_danh) as td, public.chuan_hoa_ten(p_quyet_dinh) as qd,
           public.chuan_hoa_ten(p_don_vi) as dv
  )
  select t.ma, t.ho_ten, t.nam_sinh, t.noi_dktt, t.dktt_moi, t.toi_danh, t.quyet_dinh, count(*) over () as tong
  from public.truy_na t, dk
  where (dk.ten = '' or t.ten_chuan like '%' || dk.ten || '%')
    and (p_nam_tu is null or t.nam_sinh >= p_nam_tu)
    and (p_nam_den is null or t.nam_sinh <= p_nam_den)
    and (dk.dc = '' or public.chuan_hoa_ten(coalesce(t.noi_dktt, '') || ' | ' || coalesce(t.dktt_moi, '')) like '%' || dk.dc || '%')
    and (dk.bo = '' or public.chuan_hoa_ten(t.ten_bo) like '%' || dk.bo || '%')
    and (dk.me = '' or public.chuan_hoa_ten(t.ten_me) like '%' || dk.me || '%')
    and (dk.td = '' or public.chuan_hoa_ten(t.toi_danh) like '%' || dk.td || '%')
    and (dk.qd = '' or public.chuan_hoa_ten(t.quyet_dinh) like '%' || dk.qd || '%')
    and (dk.dv = '' or public.chuan_hoa_ten(t.don_vi) like '%' || dk.dv || '%')
  order by t.lan_dau_thay desc, t.ho_ten
  offset greatest(coalesce(p_tu, 0), 0) limit 50
$$;

grant execute on function public.tim_truy_na2(text, int, int, text, text, text, text, text, text, int) to authenticated;
