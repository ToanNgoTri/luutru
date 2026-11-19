# Lưu trú — app thông báo lưu trú (React Native + Supabase)

Supabase project: `rkbzijjembmylylhpyyx`.

## Cài đặt lần đầu
1. Dashboard → SQL Editor → dán và chạy `sql/01-schema.sql`.
2. Dashboard → Authentication → Sign In / Providers → Email: **tắt "Confirm email"**
   (đăng nhập bằng CCCD, email là `<cccd>@luutru.app` nội bộ, không gửi thư).
3. Dashboard → Project Settings → API Keys → copy **Publishable key** vào `src/config.js`.
4. Đăng nhập Apple (iOS): Supabase → Providers → Apple: bật, Client IDs = `com.luutru`; Xcode bật capability Sign in with Apple (đã có `LuuTru.entitlements`).
5. Tạo tài khoản quản trị đầu tiên: `npm run admin -- tao <cccd> <matkhau> "<Họ tên>" dev`
   (cần `.env` có `SUPABASE_SECRET_KEY`; `npm run admin -- kiemtra` để kiểm tra bảng).
6. `npm run android`.

## Luồng vào app
Chọn vai trò (Người dân / Cán bộ) → Đăng nhập (CCCD + mật khẩu / Đăng ký; thêm Apple trên iOS) →
nếu tài khoản Apple chưa có CCCD → **Hoàn tất hồ sơ** → nếu chọn Cán bộ mà chưa có quyền → gửi yêu cầu,
màn **Chờ duyệt** (chỉ huy/dev duyệt ở Phân công → Vai trò). Không ai tự cấp được quyền cán bộ.
Tài khoản: Đăng xuất + Xoá tài khoản (RPC `xoa_tai_khoan`, hồ sơ lưu trú đã gửi vẫn giữ).

## Vai trò
| role | Màn hình |
|---|---|
| `nguoi_dan` | Cơ sở của tôi → quét CCCD → xác nhận lần cuối → gửi; nhắc gia hạn 30 ngày; lịch sử của mình |
| `can_bo` | Chờ xác nhận (Xác nhận / Từ chối kèm lý do), lịch sử nhóm cơ sở được giao |
| `chi_huy`, `dev` | Như cán bộ nhưng thấy tất cả + tab Phân công (nhóm, giao cán bộ, xếp cơ sở, cấp vai trò). Chỉ dev cấp được quyền dev |

## Dữ liệu
- `profiles` (1–1 auth.users, tạo bởi trigger từ metadata đăng ký), `nhom_co_so` (can_bo_id), `co_so` (chu_id, nhom_id),
  `thong_bao` (cho_duyet/da_duyet/tu_choi/da_huy, `den_ngay = tu_ngay + 30`, `gia_han_tu` = thông báo được gia hạn), `thong_bao_nguoi`.
- Ghi `thong_bao` chỉ qua RPC: `gui_thong_bao`, `huy_thong_bao`, `duyet_thong_bao`. RLS: người gửi/chủ cơ sở, cán bộ phụ trách nhóm, chỉ huy/dev.
- QR CCCD: `CCCD|CMND|Họ tên|ddmmyyyy|Giới tính|Địa chỉ|ddmmyyyy` → `src/lib/cccd.js` (test: `npx jest`).

## Nhắc gia hạn
`src/lib/reminders.js`: notifee trigger cục bộ `giahan-<id>` lúc 8:00 ngày `den_ngay`, đồng bộ lại mỗi lần mở app.
Bấm "Gia hạn" → màn lập thông báo điền sẵn danh sách cũ (bỏ/quét thêm) → gửi với `gia_han_tu`. "Không" → ngừng nhắc (lưu trên máy).
Cán bộ nhận báo có hồ sơ mới qua Supabase Realtime khi đang mở app (chưa có push khi app tắt).

## Truy nã + cảnh báo (chỉ cán bộ thấy)
**Excel AutoWeb → CSV có địa danh mới:** kéo thả file Excel vào `excel-sang-csv.bat` (hoặc bấm đúp rồi chọn file) → ra `<tên>.csv` (dấu phẩy, UTF-8 không BOM) cạnh file Excel, có cột `DIADANH_MOI` sau `NOIDKTT`.

**Cho admin, không cần gõ lệnh:** bấm đúp `cap-nhat-truyna.bat` → chọn 1–5, hoặc kéo thả file AutoWeb (.xlsx/.json)
vào file .bat. Kết quả có cột `DIADANH_MOI`: lấy từ web → `du-lieu	ruyna.xlsx`; nhập file → `<tên>-diadanh.xlsx` cạnh file gốc.

1. SQL Editor → chạy `sql/02-truy-na.sql`, rồi `sql/03-truy-na-tra-cuu.sql` (người dân được tra cứu danh sách, không thấy cảnh báo) và `sql/04-tim-truy-na.sql` (tìm theo đủ trường) (bảng truy_na, canh_bao_truy_na, thiet_bi, cau_hinh, tinh_cu_moi; trigger so trùng + gửi push).
2. `npm run truyna -- tinh` — nạp bảng tỉnh cũ/mới từ `assets/data.json`.
3. `npm run admin -- push` — ghi URL + khoá Cloud Function vào bảng `cau_hinh`.
4. Nạp danh sách:
   - từ file AutoWeb: `npm run truyna -- nhap assets/dstruyna.json` (chèn cột `DIADANH_MOI` sau `NOIDKTT`, ghi lại .json + .xlsx)
   - hoặc đọc thẳng web: `npm run truyna` (đủ trang, ra `du-lieu/truyna.json/.xlsx`) / `npm run truyna -- nhanh` (5 trang đầu)
   - Đối tượng không còn trong danh sách → **xoá hẳn** (chỉ khi danh sách đầy đủ ≥95%), cảnh báo liên quan xoá theo.
5. So trùng: trigger khi gửi thông báo lưu trú + quét lại sau mỗi lần nạp. Trùng **họ tên + năm sinh** → cảnh báo;
   cùng tỉnh (quy đổi tỉnh cũ → mới) → mức "cao". Người dân không đọc được bảng cảnh báo (RLS).
6. Push: Firebase project `tbluutru-76cea`, function `guiCanhBao` (asia-southeast1, `functions/`, khoá ở `functions/.env`).
   Deploy: `firebase deploy --only functions:luutru:guiCanhBao`. App chỉ đăng ký token khi role là can_bo/chi_huy/dev;
   đăng xuất gỡ token. Nội dung push không ghi tên người lưu trú.
7. Chạy định kỳ (Task Scheduler): `schtasks /Create /TN LuuTruTruyNa /SC DAILY /ST 02:00 /TR "cmd /c cd /d D:\Code\LuuTru && npm run truyna >> du-lieu\truyna.log 2>&1"`

Địa danh mới: `scripts/dia-chi.mjs` (đổi xã/huyện/tỉnh cũ → xã/tỉnh mới theo `assets/data.json`; không có → trống;
xã cũ bị chia → nối các xã mới bằng " / "). Hàm `loiDiaDanh` phải khớp SQL `chuan_hoa_dia_danh`.

## Trang công khai cho Store
- Chính sách quyền riêng tư: https://tbluutru-76cea.web.app/quyen-rieng-tu
- Xoá tài khoản (Google Play yêu cầu): https://tbluutru-76cea.web.app/xoa-tai-khoan
- Sửa file trong `public/` rồi `firebase deploy --only hosting --project tbluutru-76cea`.
