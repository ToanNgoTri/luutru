import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { Btn, Field, KeyboardScroll, s } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { saveCoSo } from '../../lib/api';
import UnitSelect from '../../components/UnitSelect';

export default function CoSoFormScreen({ navigation, route }) {
  const { user } = useAuth();
  const old = route.params?.coSo;
  const [ten, setTen] = useState(old?.ten || '');
  const [diaChi, setDiaChi] = useState(old?.dia_chi || '');
  const [donVi, setDonVi] = useState(old?.don_vi_id || '');
  const [loading, setLoading] = useState(false);

  async function onSave() {
    if (!ten.trim() || !diaChi.trim()) return Alert.alert('Nhập đủ tên và địa chỉ nơi lưu trú');
    if (!donVi) return Alert.alert('Chọn xã / phường của nơi lưu trú');
    setLoading(true);
    try {
      await saveCoSo({ id: old?.id, ten: ten.trim(), dia_chi: diaChi.trim(), don_vi_id: donVi }, user.id);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardScroll contentContainerStyle={s.pad}>
      <Field label="Tên (vd: Nhà trọ Hoa Mai, Nhà riêng)" value={ten} onChangeText={setTen} />
      <Field label="Địa chỉ nơi thông báo lưu trú" value={diaChi} onChangeText={setDiaChi} multiline placeholder="Số nhà, đường/ấp, xã/phường, tỉnh" />
      <Text style={s.label}>Xã / phường (Công an đơn vị này tiếp nhận thông báo)</Text>
      <UnitSelect value={donVi} onChange={setDonVi} style={{ marginBottom: 12 }} />
      <Btn title="Lưu" onPress={onSave} loading={loading} />
      <Text style={[s.muted, { marginTop: 12 }]}>Công an xã/phường đã chọn sẽ phân công cán bộ phụ trách cơ sở này. Đổi xã/phường thì cơ sở chuyển sang đơn vị mới.</Text>
    </KeyboardScroll>
  );
}
