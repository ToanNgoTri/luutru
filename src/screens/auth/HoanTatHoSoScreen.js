import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Btn, Card, Field, KeyboardScroll, s } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { hoanTatHoSo, saveCoSo } from '../../lib/api';
import UnitSelect from '../../components/UnitSelect';
import { isCccd, isoToVn, vnToIso } from '../../lib/cccd';
import { clearVaiTroChon, getVaiTroChon } from '../../lib/vaiTro';

// Sau khi đăng nhập Apple lần đầu: bắt buộc bổ sung CCCD + thông tin cá nhân.
export default function HoanTatHoSoScreen({ navigation, route }) {
  const { user, profile, setProfile, signOut } = useAuth();
  const [f, setF] = useState({
    cccd: profile?.cccd || '',
    ho_ten: profile?.ho_ten || '',
    ngay_sinh: isoToVn(profile?.ngay_sinh),
    dia_chi: profile?.dia_chi || '',
    sdt: profile?.sdt || '',
    dia_chi_luu_tru: '',
    don_vi_luu_tru: '',
  });
  const [loading, setLoading] = useState(false);
  const set = k => v => setF(o => ({ ...o, [k]: v }));

  useEffect(() => {
    const p = route.params?.scanned;
    if (p) setF(o => ({ ...o, cccd: p.cccd, ho_ten: p.ho_ten, ngay_sinh: isoToVn(p.ngay_sinh), dia_chi: p.dia_chi }));
  }, [route.params?.scanned]);

  async function onSave() {
    if (!isCccd(f.cccd)) return Alert.alert('Số CCCD phải đủ 12 chữ số');
    if (!f.ho_ten.trim()) return Alert.alert('Nhập họ tên');
    const ns = vnToIso(f.ngay_sinh);
    if (!ns) return Alert.alert('Ngày sinh dạng dd/mm/yyyy');
    if (!f.dia_chi.trim()) return Alert.alert('Nhập nơi thường trú');
    if (f.dia_chi_luu_tru.trim() && !f.don_vi_luu_tru) return Alert.alert('Chọn xã / phường của nơi lưu trú');
    setLoading(true);
    try {
      let p = await hoanTatHoSo(user.id, {
        cccd: f.cccd.trim(), ho_ten: f.ho_ten.trim(), ngay_sinh: ns, dia_chi: f.dia_chi.trim(), sdt: f.sdt.trim(),
      });
      const chon = await getVaiTroChon();
      if (chon === 'can_bo' && p.role === 'nguoi_dan' && !p.yeu_cau_can_bo) {
        p = { ...p, _xinCanBo: true }; // → màn ChoCapQuyen chọn đơn vị + chức vụ
      } else {
        await clearVaiTroChon();
        if (f.dia_chi_luu_tru.trim()) {
          await saveCoSo({ ten: 'Nơi lưu trú', dia_chi: f.dia_chi_luu_tru.trim(), don_vi_id: f.don_vi_luu_tru }, user.id).catch(() => {});
        }
      }
      setProfile(p); // đủ hồ sơ → RootNavigator chuyển vào app
    } catch (e) {
      Alert.alert('Không lưu được', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardScroll contentContainerStyle={s.pad}>
      <Card>
        <Text style={s.title}>Bổ sung thông tin tài khoản</Text>
        <Text style={s.muted}>
          Đã đăng nhập {user?.email ? `bằng ${user.email}` : ''}. Công an xã cần số CCCD và thông tin cá nhân của người thông báo lưu trú.
        </Text>
      </Card>
      <Btn title="📷  Quét CCCD của tôi để điền nhanh" kind="ghost" onPress={() => navigation.navigate('ScanCccd', { mode: 'self', returnTo: 'HoanTatHoSo' })} style={{ marginBottom: 16 }} />
      <Field label="Số CCCD" value={f.cccd} onChangeText={set('cccd')} keyboardType="number-pad" maxLength={12} />
      <Field label="Họ và tên" value={f.ho_ten} onChangeText={set('ho_ten')} />
      <Field label="Ngày sinh (dd/mm/yyyy)" value={f.ngay_sinh} onChangeText={set('ngay_sinh')} keyboardType="numbers-and-punctuation" />
      <Field label="Nơi thường trú (theo CCCD)" value={f.dia_chi} onChangeText={set('dia_chi')} multiline />
      <Field
        label="Địa chỉ nơi thông báo lưu trú (nếu là người dân)"
        value={f.dia_chi_luu_tru}
        onChangeText={set('dia_chi_luu_tru')}
        placeholder="Nhà/nhà trọ có người đến ở — thêm sau cũng được"
        multiline
      />
      {!!f.dia_chi_luu_tru.trim() && (
        <>
          <Text style={s.label}>Xã / phường của nơi lưu trú</Text>
          <UnitSelect value={f.don_vi_luu_tru} onChange={set('don_vi_luu_tru')} style={{ marginBottom: 12 }} />
        </>
      )}
      <Field label="Số điện thoại (không bắt buộc)" value={f.sdt} onChangeText={set('sdt')} keyboardType="phone-pad" />
      <Btn title="Lưu và tiếp tục" onPress={onSave} loading={loading} />
      <Text style={[s.muted, { marginTop: 12 }]}>Số CCCD không sửa được sau khi lưu.</Text>
      <Btn title="Đăng xuất" kind="ghost" onPress={signOut} style={{ marginTop: 24 }} />
    </KeyboardScroll>
  );
}
