// Thông báo đẩy (FCM) cảnh báo truy nã — CHỈ đăng ký cho cán bộ / Trưởng, Phó CA / dev.
// Gửi từ Cloud Function guiCanhBao (project Firebase tbluutru-76cea) khi Supabase tạo cảnh báo.
// Khi app tắt/nền: Android tự hiện thông báo (payload có `notification`) trên kênh canh-bao-truy-na.
import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import {
  deleteToken, getInitialNotification, getMessaging, getToken, onMessage,
  onNotificationOpenedApp, onTokenRefresh, setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { supabase } from './supabase';

export const KENH_TRUY_NA = 'canh-bao-truy-na';
export const ROLE_NHAN_PUSH = ['can_bo', 'pho_truong', 'truong_ca', 'admin', 'dev'];

const messaging = () => getMessaging();

export async function taoKenhTruyNa() {
  await notifee.createChannel({
    id: KENH_TRUY_NA, name: 'Cảnh báo truy nã', importance: AndroidImportance.HIGH, sound: 'default', vibration: true,
  });
}

// Gọi ở index.js (ngoài component). Thông báo hệ thống tự hiện; ở đây không cần làm gì thêm.
export function dangKyNenFcm() {
  setBackgroundMessageHandler(messaging(), async () => {});
}

async function luuToken(token) {
  if (!token) return;
  const { error } = await supabase.rpc('dang_ky_thiet_bi', { p_token: token, p_nen_tang: Platform.OS });
  if (error) console.warn('dang_ky_thiet_bi', error.message);
}

/**
 * Đăng ký nhận push cho người đang đăng nhập (nếu là cán bộ).
 * onOpen(data): người dùng bấm vào thông báo (app nền / app tắt / đang mở).
 * Trả hàm huỷ lắng nghe.
 */
export async function batDauPush(role, onOpen) {
  if (!ROLE_NHAN_PUSH.includes(role)) return () => {};
  await taoKenhTruyNa();
  try { await notifee.requestPermission(); } catch {}
  try {
    await luuToken(await getToken(messaging()));
  } catch (e) {
    console.warn('getToken', e.message);
  }
  const huy = [
    onTokenRefresh(messaging(), luuToken),
    // app đang mở: FCM không tự hiện → hiện bằng notifee
    onMessage(messaging(), async msg => {
      if (msg.data?.kind !== 'truy_na') return;
      await notifee.displayNotification({
        title: msg.notification?.title || 'Cảnh báo truy nã',
        body: msg.notification?.body || '',
        data: msg.data,
        android: { channelId: KENH_TRUY_NA, pressAction: { id: 'default' }, importance: AndroidImportance.HIGH },
      });
    }),
    onNotificationOpenedApp(messaging(), msg => msg?.data && onOpen(msg.data)),
  ];
  getInitialNotification(messaging()).then(msg => msg?.data && onOpen(msg.data)).catch(() => {});
  return () => huy.forEach(f => f && f());
}

// Đăng xuất: gỡ token khỏi tài khoản này để máy không nhận cảnh báo của người cũ
export async function dungPush() {
  try {
    const token = await getToken(messaging());
    if (token) await supabase.rpc('huy_thiet_bi', { p_token: token });
    await deleteToken(messaging());
  } catch {}
}
