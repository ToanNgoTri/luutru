// Vai trò người dùng chọn ở màn đầu tiên (trước khi đăng nhập).
// Lưu tạm để sau khi đăng nhập Apple còn biết họ chọn gì.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'luutru.vaiTroChon';

export async function setVaiTroChon(v) {
  try { await AsyncStorage.setItem(KEY, v); } catch {}
}
export async function getVaiTroChon() {
  try { return await AsyncStorage.getItem(KEY); } catch { return null; }
}
export async function clearVaiTroChon() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
