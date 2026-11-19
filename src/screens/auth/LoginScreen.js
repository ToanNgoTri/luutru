import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppleButton } from '@invertase/react-native-apple-authentication';
import { Btn, C, Field, KeyboardScroll, s } from '../../components/ui';
import { signIn, viError } from '../../lib/api';
import { isCccd } from '../../lib/cccd';
import { appleSupported, isCancellation, signInWithApple } from '../../lib/socialAuth';

const TEN_VAI_TRO = { nguoi_dan: 'Người dân', can_bo: 'Cán bộ Công an xã' };

export default function LoginScreen({ navigation, route }) {
  const vaiTro = route.params?.vaiTro || 'nguoi_dan';
  const [cccd, setCccd] = useState('');
  const [pw, setPw] = useState('');
  // chỉ nút đang đăng nhập hiện vòng quay
  const [pending, setPending] = useState(null); // 'cccd' | 'apple'

  const run = async (provider, fn) => {
    if (pending) return;
    setPending(provider);
    try {
      await fn();
      // thành công → AuthContext tự chuyển màn
    } catch (e) {
      if (!isCancellation(e)) Alert.alert('Đăng nhập thất bại', viError(e?.message || 'Có lỗi xảy ra'));
    } finally {
      setPending(null);
    }
  };

  const onLogin = () =>
    run('cccd', async () => {
      if (!isCccd(cccd)) throw new Error('Số CCCD phải đủ 12 chữ số');
      if (!pw) throw new Error('Nhập mật khẩu');
      await signIn(cccd.trim(), pw);
    });

  return (
    <KeyboardScroll contentContainerStyle={st.container}>
        <Text style={st.title}>Đăng nhập</Text>
        <View style={[s.row, { justifyContent: 'center', marginBottom: 28 }]}>
          <Text style={s.muted}>Vai trò: </Text>
          <Text style={{ fontWeight: '700', color: C.primary }}>{TEN_VAI_TRO[vaiTro]}</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={{ color: C.primary, marginLeft: 8, textDecorationLine: 'underline' }}>Đổi</Text>
          </Pressable>
        </View>

        {appleSupported && (
          <>
            <AppleButton
              style={st.apple}
              cornerRadius={10}
              buttonStyle={AppleButton.Style.BLACK}
              buttonType={AppleButton.Type.CONTINUE}
              onPress={() => run('apple', signInWithApple)}
            />
            <View style={st.dividerRow}>
              <View style={st.divider} />
              <Text style={[s.muted, { marginHorizontal: 8 }]}>hoặc bằng số CCCD</Text>
              <View style={st.divider} />
            </View>
          </>
        )}

        <Field label="Số CCCD" value={cccd} onChangeText={setCccd} keyboardType="number-pad" maxLength={12} placeholder="12 chữ số" editable={!pending} />
        <Field label="Mật khẩu" value={pw} onChangeText={setPw} secureTextEntry placeholder="Mật khẩu" onSubmitEditing={onLogin} editable={!pending} />
        <Btn title="Đăng nhập" onPress={onLogin} loading={pending === 'cccd'} disabled={!!pending && pending !== 'cccd'} style={{ marginTop: 4 }} />
        <View style={{ height: 12 }} />
        <Btn title="Đăng ký tài khoản bằng CCCD" kind="ghost" onPress={() => navigation.navigate('Register', { vaiTro })} />
        {appleSupported && (
          <Text style={[s.muted, { textAlign: 'center', marginTop: 16 }]}>
            Đăng nhập Apple lần đầu sẽ tự tạo tài khoản, sau đó bạn bổ sung số CCCD và thông tin cá nhân.
          </Text>
        )}
    </KeyboardScroll>
  );
}

const st = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: C.primaryDark, textAlign: 'center', marginBottom: 6 },
  apple: { height: 48 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: C.border },
});
