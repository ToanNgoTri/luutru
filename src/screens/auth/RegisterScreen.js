import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { Btn, Field, KeyboardScroll, s } from '../../components/ui';
import UnitSelect, { ChucVuSelect } from '../../components/UnitSelect';
import { saveCoSo, signUp } from '../../lib/api';
import { isCccd, isoToVn, vnToIso } from '../../lib/cccd';

// Đăng ký: có thể quét CCCD của chính mình để điền sẵn họ tên, ngày sinh, địa chỉ.
export default function RegisterScreen({ navigation, route }) {
  const [f, setF] = useState({ cccd: '', ho_ten: '', ngay_sinh: '', dia_chi: '', dia_chi_luu_tru: '', don_vi_luu_tru: '', sdt: '', pw: '', pw2: '' });
  // cán bộ: đơn vị công tác + chức vụ xin (Trưởng CA đơn vị đó duyệt; xin Trưởng CA thì dev duyệt)
  const [donVi, setDonVi] = useState('');
  const [chucVu, setChucVu] = useState('can_bo');
  const laDan = route.params?.vaiTro !== 'can_bo';
  const [loading, setLoading] = useState(false);
  const set = k => v => setF(o => ({ ...o, [k]: v }));

  // Kết quả quét từ màn ScanCccd (mode=self)
  React.useEffect(() => {
    const p = route.params?.scanned;
    if (p) setF(o => ({ ...o, cccd: p.cccd, ho_ten: p.ho_ten, ngay_sinh: isoToVn(p.ngay_sinh), dia_chi: p.dia_chi }));
  }, [route.params?.scanned]);

  async function onSubmit() {
    if (!isCccd(f.cccd)) return Alert.alert('Số CCCD phải đủ 12 chữ số');
    if (!f.ho_ten.trim()) return Alert.alert('Nhập họ tên');
    const ngaySinh = vnToIso(f.ngay_sinh);
    if (!ngaySinh) return Alert.alert('Ngày sinh dạng dd/mm/yyyy');
    if (!f.dia_chi.trim()) return Alert.alert('Nhập nơi thường trú');
    if (!laDan && !donVi) return Alert.alert('Chọn đơn vị công tác (xã / phường)');
    if (laDan && f.dia_chi_luu_tru.trim() && !f.don_vi_luu_tru) return Alert.alert('Chọn xã / phường của nơi lưu trú');
    if (f.pw.length < 6) return Alert.alert('Mật khẩu tối thiểu 6 ký tự');
    if (f.pw !== f.pw2) return Alert.alert('Mật khẩu nhập lại không khớp');
    setLoading(true);
    try {
      const res = await signUp({
        cccd: f.cccd.trim(), password: f.pw, ho_ten: f.ho_ten.trim(),
        ngay_sinh: ngaySinh, dia_chi: f.dia_chi.trim(), sdt: f.sdt.trim(),
        vai_tro: laDan ? 'nguoi_dan' : 'can_bo',
        ...(laDan ? {} : { don_vi_id: donVi, chuc_vu: chucVu }),
      });
      // người dân: tạo luôn nơi thông báo lưu trú đầu tiên (sửa/thêm sau ở tab Lưu trú)
      if (res.session && laDan && f.dia_chi_luu_tru.trim()) {
        await saveCoSo({ ten: 'Nơi lưu trú', dia_chi: f.dia_chi_luu_tru.trim(), don_vi_id: f.don_vi_luu_tru }, res.session.user.id).catch(() => {});
      }
      if (!res.session) {
        Alert.alert('Đã tạo tài khoản', 'Tài khoản cần được kích hoạt trước khi đăng nhập.');
        navigation.goBack();
      }
      // có session → AuthContext tự chuyển vào app
    } catch (e) {
      Alert.alert('Không tạo được tài khoản', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardScroll contentContainerStyle={s.pad}>
      <Btn title="📷  Quét CCCD của tôi để điền nhanh" kind="ghost" onPress={() => navigation.navigate('ScanCccd', { mode: 'self', returnTo: 'Register' })} style={{ marginBottom: 16 }} />
      <Field label="Số CCCD (dùng để đăng nhập)" value={f.cccd} onChangeText={set('cccd')} keyboardType="number-pad" maxLength={12} />
      <Field label="Họ và tên" value={f.ho_ten} onChangeText={set('ho_ten')} />
      <Field label="Ngày sinh (dd/mm/yyyy)" value={f.ngay_sinh} onChangeText={set('ngay_sinh')} keyboardType="numbers-and-punctuation" />
      <Field label="Nơi thường trú (theo CCCD)" value={f.dia_chi} onChangeText={set('dia_chi')} multiline />
      {laDan && (
        <Field
          label="Địa chỉ nơi thông báo lưu trú (nhà/nhà trọ có người đến ở)"
          value={f.dia_chi_luu_tru}
          onChangeText={set('dia_chi_luu_tru')}
          placeholder="Bỏ trống nếu giống nơi thường trú — thêm sau cũng được"
          multiline
        />
      )}
      {laDan && !!f.dia_chi_luu_tru.trim() && (
        <>
          <Text style={s.label}>Xã / phường của nơi lưu trú</Text>
          <UnitSelect value={f.don_vi_luu_tru} onChange={set('don_vi_luu_tru')} style={{ marginBottom: 12 }} />
        </>
      )}
      {!laDan && (
        <>
          <Text style={s.label}>Đơn vị công tác (xã / phường)</Text>
          <UnitSelect value={donVi} onChange={setDonVi} style={{ marginBottom: 12 }} />
          <Text style={s.label}>Chức vụ</Text>
          <ChucVuSelect value={chucVu} onChange={setChucVu} donViId={donVi} />
        </>
      )}
      <Field label="Số điện thoại (không bắt buộc)" value={f.sdt} onChangeText={set('sdt')} keyboardType="phone-pad" />
      <Field label="Mật khẩu" value={f.pw} onChangeText={set('pw')} secureTextEntry />
      <Field label="Nhập lại mật khẩu" value={f.pw2} onChangeText={set('pw2')} secureTextEntry />
      <Btn title="Tạo tài khoản" onPress={onSubmit} loading={loading} />
      <Text style={[s.muted, { marginTop: 12 }]}>
        Mỗi số CCCD chỉ có một tài khoản. Số CCCD không sửa được sau khi đăng ký.
        {route.params?.vaiTro === 'can_bo' ? ' Tài khoản cán bộ cần Trưởng CA hoặc Cán bộ (admin) của đơn vị duyệt trước khi sử dụng.' : ''}
      </Text>
    </KeyboardScroll>
  );
}
