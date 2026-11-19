// Danh sách người đang quét (bản nháp) — dùng chung giữa màn Lập thông báo và màn Quét.
// Lưu AsyncStorage để lỡ thoát app giữa chừng không mất những CCCD đã quét.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'luutru.draft.v1';
let state = { coSoId: null, giaHanTu: null, nguoi: [] };
const listeners = new Set();

function emit() {
  listeners.forEach(l => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export async function loadDraft() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch {}
  listeners.forEach(l => l());
  return state;
}

export const getDraft = () => state;

export function useDraft() {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

// Bắt đầu nháp mới cho 1 cơ sở; nếu đang có nháp đúng cơ sở/gia hạn đó thì giữ nguyên
export function startDraft(coSoId, giaHanTu = null, nguoiBanDau = []) {
  if (state.coSoId === coSoId && state.giaHanTu === giaHanTu && state.nguoi.length) return;
  state = { coSoId, giaHanTu, nguoi: nguoiBanDau };
  emit();
}

// Trả false nếu CCCD đã có trong danh sách
export function addNguoi(p) {
  if (state.nguoi.some(x => x.cccd === p.cccd)) return false;
  state = { ...state, nguoi: [...state.nguoi, p] };
  emit();
  return true;
}

export function removeNguoi(cccd) {
  state = { ...state, nguoi: state.nguoi.filter(x => x.cccd !== cccd) };
  emit();
}

export function clearDraft() {
  state = { coSoId: null, giaHanTu: null, nguoi: [] };
  emit();
}
