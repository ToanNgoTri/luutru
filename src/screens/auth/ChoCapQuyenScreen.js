import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { Btn, C, Card, KeyboardScroll, s } from '../../components/ui';
import UnitSelect, { ChucVuSelect, nguoiDuyet } from '../../components/UnitSelect';
import { useAuth } from '../../context/AuthContext';
import { setYeuCauCanBo } from '../../lib/api';
import { unitName } from '../../lib/units';
import { clearVaiTroChon } from '../../lib/vaiTro';

/**
 * Đã chọn "Cán bộ" nhưng chưa được duyệt (giống PendingApproval của PlanRegister):
 * chọn ĐƠN VỊ (xã/phường) + CHỨC VỤ → chờ Trưởng CA của đơn vị đó duyệt.
 * Xin làm Trưởng CA thì dev duyệt. Chỉ thấy dữ liệu đơn vị mình sau khi được duyệt.
 */
export default function ChoCapQuyenScreen() {
  const { user, profile, reloadProfile, setProfile, signOut } = useAuth();
  const daGui = !!profile?.yeu_cau_can_bo;
  const [donVi, setDonVi] = useState(profile?.don_vi_id || '');
  const [chucVu, setChucVu] = useState(profile?.yeu_cau_chuc_vu || 'can_bo');
  const [busy, setBusy] = useState(null);
  const doi = daGui && (donVi !== profile.don_vi_id || chucVu !== profile.yeu_cau_chuc_vu);

  const gui = async () => {
    if (!donVi) return Alert.alert('Thiếu đơn vị', 'Chọn xã / phường nơi bạn công tác.');
    setBusy('gui');
    try {
      const p = await setYeuCauCanBo(user.id, true, { don_vi_id: donVi, chuc_vu: chucVu });
      await clearVaiTroChon();
      setProfile(p);
      Alert.alert(
        'Đã gửi yêu cầu',
        `Đã gửi yêu cầu vào ${unitName(donVi)}. Vui lòng chờ ${nguoiDuyet(chucVu, donVi)} duyệt.`,
      );
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    }
    setBusy(null);
  };

  const taiLai = async () => {
    setBusy('reload');
    await reloadProfile();
    setBusy(null);
  };

  const dungNguoiDan = () =>
    Alert.alert('Dùng với vai trò người dân?', 'Bạn sẽ dùng app để thông báo lưu trú. Yêu cầu cán bộ (nếu có) sẽ bị rút.', [
      { text: 'Huỷ' },
      {
        text: 'Đồng ý',
        onPress: async () => {
          setBusy('dan');
          try {
            await clearVaiTroChon();
            setProfile(daGui ? await setYeuCauCanBo(user.id, false) : { ...profile, _xinCanBo: false });
          } catch (e) { Alert.alert('Lỗi', e.message); }
          setBusy(null);
        },
      },
    ]);

  return (
    <KeyboardScroll contentContainerStyle={[s.pad, { flexGrow: 1, justifyContent: 'center' }]}>
      <Text style={{ fontSize: 56, textAlign: 'center' }}>{daGui ? '⏳' : '🏢'}</Text>
      <Card style={{ marginTop: 12 }}>
        <Text style={[s.title, { textAlign: 'center', marginBottom: 8 }]}>
          {daGui ? 'Đang chờ duyệt quyền cán bộ' : 'Chọn đơn vị công tác'}
        </Text>
        <Text style={[s.text, { textAlign: 'center' }]}>
          {profile?.ho_ten} · CCCD {profile?.cccd}
        </Text>
        <Text style={[s.muted, { textAlign: 'center', marginTop: 8 }]}>
          {daGui
            ? `Đang chờ ${nguoiDuyet(profile.yeu_cau_chuc_vu, profile.don_vi_id)} duyệt. Mở lại app hoặc bấm “Kiểm tra lại” sau khi được báo.`
            : 'Chọn xã / phường và chức vụ. Bạn chỉ thấy dữ liệu của đơn vị mình sau khi Trưởng CA đơn vị duyệt.'}
        </Text>
        {daGui && profile?.yeu_cau_luc && (
          <Text style={[s.muted, { textAlign: 'center', marginTop: 6, color: C.warn }]}>
            Gửi yêu cầu lúc {new Date(profile.yeu_cau_luc).toLocaleString('vi-VN')}
          </Text>
        )}
      </Card>

      <Text style={s.label}>Đơn vị (xã / phường)</Text>
      <UnitSelect value={donVi} onChange={setDonVi} style={{ marginBottom: 12 }} />
      <Text style={s.label}>Chức vụ</Text>
      <ChucVuSelect value={chucVu} onChange={setChucVu} donViId={donVi} />

      {(!daGui || doi) && <Btn title={daGui ? 'Gửi lại yêu cầu' : 'Gửi yêu cầu'} onPress={gui} loading={busy === 'gui'} />}
      {daGui && <Btn title="Kiểm tra lại" kind={doi ? 'ghost' : 'primary'} onPress={taiLai} loading={busy === 'reload'} style={{ marginTop: 8 }} />}
      <Btn title="Dùng với vai trò người dân" kind="ghost" onPress={dungNguoiDan} loading={busy === 'dan'} style={{ marginTop: 10 }} />
      <Btn
        title="Đăng xuất"
        kind="ghost"
        style={{ marginTop: 10 }}
        onPress={() => Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [{ text: 'Huỷ', style: 'cancel' }, { text: 'Đăng xuất', style: 'destructive', onPress: signOut }])}
      />
    </KeyboardScroll>
  );
}
