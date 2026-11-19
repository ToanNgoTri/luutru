import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export const C = {
  primary: '#1d4ed8',
  primaryDark: '#1e3a8a',
  bg: '#f1f5f9',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#cbd5e1',
  danger: '#dc2626',
  ok: '#16a34a',
  warn: '#d97706',
};

export const TRANG_THAI = {
  cho_duyet: { label: 'Chờ xác nhận', color: C.warn },
  da_duyet: { label: 'Đã xác nhận', color: C.ok },
  tu_choi: { label: 'Bị từ chối', color: C.danger },
  da_huy: { label: 'Đã huỷ', color: C.muted },
};

export const ROLE_LABEL = {
  nguoi_dan: 'Người thông báo lưu trú',
  can_bo: 'Cán bộ',
  pho_truong: 'Phó Trưởng CA',
  truong_ca: 'Trưởng CA',
  admin: 'Cán bộ (admin)',
  dev: 'Quản trị tỉnh (dev)',
};

/**
 * ScrollView tự né bàn phím.
 * Android 15+ (targetSdk 35+) ép edge-to-edge → adjustResize không còn thu nhỏ màn hình,
 * KeyboardAvoidingView lại tính theo toạ độ tương đối nên lệch khi có header/tab bar.
 * Ở đây đo vị trí thật của khung (measureInWindow) so với mép trên bàn phím, chừa đúng phần bị che,
 * rồi cuộn ô đang nhập lên trên bàn phím. Máy cũ vẫn adjustResize thì phần bị che = 0, không chừa thừa.
 */
export function KeyboardScroll({ children, style, contentContainerStyle, scrollRef, onScroll, ...rest }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const scroll = scrollRef || innerRef;
  const offsetY = useRef(0);
  const [pad, setPad] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = e => {
      const kbTop = e.endCoordinates.screenY;
      boxRef.current?.measureInWindow((x, y, w, h) => {
        setPad(Math.max(0, Math.round(y + h - kbTop)));
        // đợi layout co lại rồi đưa ô đang nhập lên trên bàn phím
        setTimeout(() => {
          const input = TextInput.State.currentlyFocusedInput?.();
          if (!input?.measureInWindow) return;
          input.measureInWindow((ix, iy, iw, ih) => {
            const hidden = iy + ih + 16 - kbTop;
            if (hidden > 0) scroll.current?.scrollTo({ y: offsetY.current + hidden, animated: true });
          });
        }, Platform.OS === 'ios' ? 300 : 80);
      });
    };
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, () => setPad(0));
    return () => { s1.remove(); s2.remove(); };
  }, [scroll]);

  return (
    <View ref={boxRef} collapsable={false} style={[s.screen, { flex: 1, paddingBottom: pad }, style]}>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={e => { offsetY.current = e.nativeEvent.contentOffset.y; onScroll?.(e); }}
        {...rest}>
        {children}
      </ScrollView>
    </View>
  );
}

export function Btn({ title, onPress, kind = 'primary', loading, disabled, style, small }) {
  const bg = { primary: C.primary, danger: C.danger, ok: C.ok, ghost: 'transparent' }[kind];
  const fg = kind === 'ghost' ? C.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 1, borderColor: C.primary },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, style, ...props }) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput placeholderTextColor="#94a3b8" style={s.input} {...props} />
    </View>
  );
}

export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function Badge({ trangThai }) {
  const t = TRANG_THAI[trangThai] || { label: trangThai, color: C.muted };
  return (
    <View style={[s.badge, { borderColor: t.color }]}>
      <Text style={{ color: t.color, fontSize: 12, fontWeight: '600' }}>{t.label}</Text>
    </View>
  );
}

export function Empty({ text }) {
  return <Text style={{ textAlign: 'center', color: C.muted, marginTop: 40, paddingHorizontal: 24 }}>{text}</Text>;
}

export function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: C.primary, borderColor: C.primary }]}>
      <Text style={{ color: active ? '#fff' : C.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16 },
  btn: { borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  btnText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, color: C.muted, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.text, backgroundColor: '#fff' },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  title: { fontSize: 16, fontWeight: '700', color: C.text },
  h2: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 8, marginBottom: 8 },
  muted: { color: C.muted, fontSize: 13 },
  text: { color: C.text, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: '#fff' },
});

// ---------- Icon + bảng thông tin ----------
import Icon from '@react-native-vector-icons/ionicons';
export { Icon };

/**
 * Bảng 2 cột "nhãn | giá trị", có kẻ ngăn từng dòng — dễ dò hơn dồn chữ.
 * dong: [{ nhan, giaTri, noiBat?, mau? }] — dòng không có giá trị thì bỏ qua.
 */
export function BangThongTin({ dong, rongNhan = 96, style }) {
  const ds = dong.filter(d => d && d.giaTri !== null && d.giaTri !== undefined && String(d.giaTri).trim() !== '');
  return (
    <View style={[bt.bang, style]}>
      {ds.map((d, i) => (
        <View key={d.nhan} style={[bt.dong, i === ds.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={[bt.nhan, { width: rongNhan }]}>{d.nhan}</Text>
          <Text style={[bt.giaTri, d.noiBat && { fontWeight: '700' }, d.mau && { color: d.mau }]} selectable>
            {String(d.giaTri)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const bt = StyleSheet.create({
  bang: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  dong: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  nhan: { backgroundColor: '#f8fafc', color: C.muted, fontSize: 12.5, paddingHorizontal: 10, paddingVertical: 8, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  giaTri: { flex: 1, color: C.text, fontSize: 13.5, paddingHorizontal: 10, paddingVertical: 8 },
});

/**
 * Nút gọi điện: chỉ hiện khi có số điện thoại hợp lệ (≥ 8 chữ số), không có số thì không hiện gì.
 * Số được làm sạch (bỏ khoảng trắng, dấu chấm, gạch) trước khi mở trình gọi.
 */
export function NutGoi({ sdt, title, small = true, kind = 'ghost', style }) {
  const so = String(sdt ?? '').replace(/[^\d+]/g, '');
  if (so.replace(/\D/g, '').length < 8) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(`tel:${so}`)}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall,
        { flexDirection: 'row', gap: 6, backgroundColor: kind === 'ghost' ? 'transparent' : C.ok, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: C.ok, opacity: pressed ? 0.8 : 1 },
        style,
      ]}>
      <Icon name="call" size={small ? 15 : 18} color={kind === 'ghost' ? C.ok : '#fff'} />
      <Text style={[s.btnText, small && { fontSize: 14 }, { color: kind === 'ghost' ? C.ok : '#fff' }]}>{title || `Gọi ${sdt}`}</Text>
    </Pressable>
  );
}
