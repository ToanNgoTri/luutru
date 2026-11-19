// Dự án Supabase của app Thông báo lưu trú.
// CHỈ dùng publishable key (sb_publishable_...) ở đây — tuyệt đối không đặt secret key vào app.
// Lấy ở Dashboard → Project Settings → API Keys → Publishable key.
export const SUPABASE_URL = 'https://rkbzijjembmylylhpyyx.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8VUswjmmk1t0YUJtXIUIaw_cJW0YJWd';

// Tài khoản đăng nhập bằng CCCD → email nội bộ (không gửi thư).
export const EMAIL_DOMAIN = 'luutru.app';

// Số ngày hiệu lực của một lần thông báo lưu trú (khớp với SQL: den_ngay = tu_ngay + 30).
export const SO_NGAY_LUU_TRU = 30;
// Giờ bắn thông báo nhắc gia hạn trong ngày đến hạn.
export const GIO_NHAC = 8;

