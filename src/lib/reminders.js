// Nhắc gia hạn lưu trú khi tới 30 ngày: notifee trigger CỤC BỘ trên máy người gửi.
// Đồng bộ lại mỗi lần mở app / quay lại app (syncReminders) theo dữ liệu server.
import notifee, { AndroidImportance, TriggerType, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listCanGiaHan } from './api';
import { isoToVn } from './cccd';
import { GIO_NHAC } from '../config';

const CHANNEL = 'luutru-gia-han';
const PREFIX = 'giahan-';
const DISMISS_KEY = 'luutru.khongGiaHan.v1'; // id thông báo người dùng chọn "Không gia hạn"

async function ensureChannel() {
  return notifee.createChannel({ id: CHANNEL, name: 'Nhắc gia hạn lưu trú', importance: AndroidImportance.HIGH, sound: 'default' });
}

export async function requestNotifyPermission() {
  try { await notifee.requestPermission(); } catch {}
}

export async function getDismissed() {
  try { return new Set(JSON.parse((await AsyncStorage.getItem(DISMISS_KEY)) || '[]')); } catch { return new Set(); }
}

export async function dismissGiaHan(id) {
  const s = await getDismissed();
  s.add(id);
  await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify([...s]));
  await notifee.cancelNotification(PREFIX + id).catch(() => {});
}

function nhacLuc(denNgayIso) {
  const [y, m, d] = denNgayIso.split('-').map(Number);
  return new Date(y, m - 1, d, GIO_NHAC, 0, 0).getTime();
}

/**
 * Lên lịch cho mọi thông báo đã duyệt chưa gia hạn; huỷ trigger không còn cần.
 * Trả về danh sách đến hạn (den_ngay <= hôm nay) để Home hiển thị ngay.
 */
export async function syncReminders(uid) {
  const [list, dismissed] = await Promise.all([listCanGiaHan(uid), getDismissed()]);
  const active = list.filter(t => !dismissed.has(t.id));
  await ensureChannel();

  const want = new Set(active.map(t => PREFIX + t.id));
  const existing = await notifee.getTriggerNotificationIds();
  await Promise.all(existing.filter(id => id.startsWith(PREFIX) && !want.has(id)).map(id => notifee.cancelTriggerNotification(id)));

  const now = Date.now();
  for (const t of active) {
    const ts = nhacLuc(t.den_ngay);
    if (ts <= now) continue; // đã quá giờ nhắc → Home hiển thị mục "Cần gia hạn"
    await notifee.createTriggerNotification(
      {
        id: PREFIX + t.id,
        title: 'Hết hạn thông báo lưu trú',
        body: `${t.co_so?.ten || 'Cơ sở'}: lưu trú từ ${isoToVn(t.tu_ngay)} đã đủ 30 ngày. Bạn có tiếp tục gia hạn không?`,
        data: { kind: 'gia_han', thongBaoId: String(t.id), coSoId: String(t.co_so_id) },
        android: {
          channelId: CHANNEL,
          pressAction: { id: 'default' },
          actions: [
            { title: 'Gia hạn', pressAction: { id: 'gia_han', launchActivity: 'default' } },
            { title: 'Không', pressAction: { id: 'khong_gia_han' } },
          ],
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: ts },
    );
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return active.filter(t => nhacLuc(t.den_ngay) <= today.getTime());
}

export async function cancelAllReminders() {
  const ids = await notifee.getTriggerNotificationIds();
  await Promise.all(ids.filter(id => id.startsWith(PREFIX)).map(id => notifee.cancelTriggerNotification(id)));
}

// Sự kiện nền (app đã tắt): nút "Không" xử lý luôn, không cần mở app.
export function registerBackgroundHandler() {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'khong_gia_han') {
      const id = Number(detail.notification?.data?.thongBaoId);
      if (id) await dismissGiaHan(id);
      if (detail.notification?.id) await notifee.cancelNotification(detail.notification.id);
    }
  });
}

// Thông báo cho cán bộ khi có hồ sơ mới (lúc app đang mở, qua Realtime)
export async function showLocal(title, body, data = {}) {
  await notifee.createChannel({ id: 'luutru-moi', name: 'Thông báo lưu trú mới', importance: AndroidImportance.HIGH });
  await notifee.displayNotification({ title, body, data, android: { channelId: 'luutru-moi', pressAction: { id: 'default' } } });
}
