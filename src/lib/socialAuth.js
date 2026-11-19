// Đăng nhập Apple (chỉ iOS) → đổi id token lấy phiên Supabase (signInWithIdToken).
import { Platform } from 'react-native';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { supabase } from './supabase';

export const appleSupported = Platform.OS === 'ios' && appleAuth.isSupported;

// Người dùng bấm huỷ ở hộp đăng nhập Apple: không coi là lỗi
export function isCancellation(e) {
  return e?.code === appleAuth.Error.CANCELED || e?.code === '1001';
}

/**
 * Sign in with Apple (iOS 13+). Apple chỉ trả họ tên ở LẦN ĐẦU cấp quyền
 * → lưu ngay vào metadata để profile có tên, không bắt người dùng gõ lại (App Store 4.8).
 */
export async function signInWithApple() {
  const res = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
  });
  if (!res.identityToken) throw new Error('Không lấy được token từ Apple.');
  // invertase trả nonce gốc (đã gửi SHA256 cho Apple) — Supabase cần nonce gốc
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple', token: res.identityToken, nonce: res.nonce,
  });
  if (error) throw new Error(error.message);
  const name = [res.fullName?.familyName, res.fullName?.middleName, res.fullName?.givenName].filter(Boolean).join(' ').trim();
  if (name && data?.user) {
    await supabase.auth.updateUser({ data: { full_name: name } }).catch(() => {});
    await supabase.from('profiles').update({ ho_ten: name }).eq('id', data.user.id).eq('ho_ten', '').then(() => {}, () => {});
  }
}
