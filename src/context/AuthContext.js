import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getProfile, hoSoDayDu, signOut as apiSignOut, xoaTaiKhoan } from '../lib/api';
import { cancelAllReminders } from '../lib/reminders';
import { clearDraft } from '../lib/draftStore';
import { clearVaiTroChon, getVaiTroChon } from '../lib/vaiTro';
import { dungPush } from '../lib/push';

const Ctx = createContext(null);

/**
 * Áp vai trò đã chọn ở màn đầu: chọn "Cán bộ" mà tài khoản đang là người dân và chưa gửi yêu cầu
 * → đánh dấu `_xinCanBo` để RootNavigator mở màn ChoCapQuyen, nơi chọn ĐƠN VỊ + CHỨC VỤ rồi gửi
 * (giống PendingApproval của PlanRegister). Lựa chọn giữ lại tới khi gửi / rút yêu cầu.
 */
async function apDungVaiTroChon(p) {
  if (!p || !hoSoDayDu(p)) return p;
  const chon = await getVaiTroChon();
  if (!chon) return p;
  if (chon === 'can_bo' && p.role === 'nguoi_dan' && !p.yeu_cau_can_bo) return { ...p, _xinCanBo: true };
  await clearVaiTroChon();
  return p;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async uid => {
    if (!uid) return setProfile(null);
    const key = `luutru.profile.${uid}`;
    try {
      let p = await getProfile(uid);
      p = await apDungVaiTroChon(p);
      setProfile(p);
      if (p) AsyncStorage.setItem(key, JSON.stringify(p)).catch(() => {});
    } catch (e) {
      // mất mạng: dùng hồ sơ đã lưu, không đá về màn đăng nhập
      console.warn('getProfile', e.message);
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) setProfile(p0 => p0 || JSON.parse(cached));
      } catch {}
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      // không await trong callback (supabase-js khuyến nghị) → đẩy ra ngoài
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') setTimeout(() => loadProfile(sess?.user?.id), 0);
      if (event === 'SIGNED_OUT') setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Đăng xuất: huỷ lịch nhắc, xoá nháp
  const signOut = useCallback(async () => {
    await cancelAllReminders().catch(() => {});
    clearDraft();
    await clearVaiTroChon();
    await dungPush(); // gỡ token push khỏi tài khoản (phải chạy trước khi mất phiên)
    await apiSignOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    await xoaTaiKhoan();
    await signOut();
  }, [signOut]);

  const value = {
    ready,
    session,
    user: session?.user || null,
    profile,
    role: profile?.role,
    // xem / duyệt / phân nhóm toàn đơn vị (dev: toàn tỉnh)
    isAdmin: ['pho_truong', 'truong_ca', 'admin', 'dev'].includes(profile?.role),
    // duyệt người mới vào đơn vị + cấp/thu quyền: Trưởng CA, Cán bộ (admin) của đơn vị, dev (tỉnh)
    canCapQuyen: ['truong_ca', 'admin', 'dev'].includes(profile?.role),
    isDev: profile?.role === 'dev',
    donViId: profile?.don_vi_id || null,
    reloadProfile: () => loadProfile(session?.user?.id),
    setProfile,
    signOut,
    deleteAccount,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
