import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Alert, Text } from 'react-native';
import { Btn, C, Card, Field, KeyboardScroll, ROLE_LABEL, s } from '../../components/ui';
import UnitSelect, { ChucVuSelect, nguoiDuyet } from '../../components/UnitSelect';
import { useAuth } from '../../context/AuthContext';
import { devDoiDonVi, listMyCoSo, updateMyProfile, xinDoiDonVi } from '../../lib/api';
import { isoToVn, vnToIso } from '../../lib/cccd';
import { unitName } from '../../lib/units';

export default function ProfileScreen() {
  const { profile, user, signOut, deleteAccount, reloadProfile } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const navigation = useNavigation();
  const laDan = profile?.role === 'nguoi_dan';
  const laCanBo = ['can_bo', 'pho_truong', 'truong_ca', 'admin'].includes(profile?.role);
  // đổi đơn vị / chức vụ: mất quyền hiện tại, chờ Trưởng CA đơn vị mới (hoặc dev) duyệt
  const [doiDv, setDoiDv] = useState(null); // { don_vi_id, chuc_vu } khi đang mở form
  const [guiDoi, setGuiDoi] = useState(false);
  const doiChucVu = useCallback(v => setDoiDv(o => (o ? { ...o, chuc_vu: v } : o)), []);
  const [coSo, setCoSo] = useState([]);
  useFocusEffect(useCallback(() => {
    if (laDan && user?.id) listMyCoSo(user.id).then(setCoSo).catch(() => {});
  }, [laDan, user?.id]));
  const [f, setF] = useState({
    ho_ten: profile?.ho_ten || '',
    ngay_sinh: isoToVn(profile?.ngay_sinh),
    dia_chi: profile?.dia_chi || '',
    sdt: profile?.sdt || '',
  });
  const [saving, setSaving] = useState(false);
  const set = k => v => setF(o => ({ ...o, [k]: v }));

  async function save() {
    const ns = vnToIso(f.ngay_sinh);
    if (!f.ho_ten.trim()) return Alert.alert('Nhập họ tên');
    if (f.ngay_sinh && !ns) return Alert.alert('Ngày sinh dạng dd/mm/yyyy');
    setSaving(true);
    try {
      await updateMyProfile(user.id, { ...f, ngay_sinh: ns });
      await reloadProfile();
      Alert.alert('Đã lưu');
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function devLuuDonVi() {
    setGuiDoi(true);
    try {
      await devDoiDonVi(user.id, doiDv.don_vi_id);
      await reloadProfile();
      setDoiDv(null);
    } catch (e) {
      Alert.alert('Không đổi được', e.message);
    } finally {
      setGuiDoi(false);
    }
  }

  function xinDoi() {
    if (profile?.role === 'dev') return devLuuDonVi();
    if (!doiDv.don_vi_id) return Alert.alert('Chọn đơn vị');
    if (doiDv.don_vi_id === profile.don_vi_id && doiDv.chuc_vu === profile.role) return Alert.alert('Đơn vị và chức vụ chưa thay đổi');
    const den = `${ROLE_LABEL[doiDv.chuc_vu]} · ${unitName(doiDv.don_vi_id)}`;
    // cán bộ đơn vị này nhận Cán bộ (admin) đơn vị mình đang khuyết → không cần duyệt
    const nhanNgay = doiDv.chuc_vu === 'admin' && doiDv.don_vi_id === profile.don_vi_id;
    Alert.alert(
      nhanNgay ? 'Nhận chức Cán bộ (admin)?' : 'Gửi yêu cầu đổi?',
      nhanNgay
        ? `Bạn sẽ là Cán bộ (admin) của ${unitName(profile.don_vi_id)} ngay, không cần duyệt (thôi chức ${ROLE_LABEL[profile.role]}).`
        : `Xin làm ${den}.\n\nBạn sẽ MẤT quyền ở ${unitName(profile.don_vi_id)} ngay và chờ ${nguoiDuyet(doiDv.chuc_vu, doiDv.don_vi_id)} duyệt.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: nhanNgay ? 'Nhận chức' : 'Gửi yêu cầu',
          style: 'destructive',
          onPress: async () => {
            setGuiDoi(true);
            try {
              const kq = await xinDoiDonVi(doiDv.don_vi_id, doiDv.chuc_vu);
              await reloadProfile(); // chờ duyệt → RootNavigator mở màn Chờ duyệt; nhận ngay → ở lại, đổi chức vụ
              if (kq === 'da_nhan') {
                setDoiDv(null);
                setGuiDoi(false);
                Alert.alert('Đã nhận chức', `Bạn là Cán bộ (admin) của ${unitName(profile.don_vi_id)}.`);
              }
            } catch (e) {
              Alert.alert('Không gửi được', e.message);
              setGuiDoi(false);
            }
          },
        },
      ],
    );
  }

  return (
    <KeyboardScroll contentContainerStyle={s.pad}>
      <Card>
        <Text style={s.muted}>Số CCCD (tên đăng nhập)</Text>
        <Text style={[s.title, { fontSize: 18 }]}>{profile?.cccd}</Text>
        {laDan ? (
          <Text style={[s.muted, { marginTop: 6 }]}>Vai trò: {ROLE_LABEL.nguoi_dan}</Text>
        ) : (
          <>
            <Text style={[s.text, { marginTop: 6 }]}>
              Chức vụ: <Text style={{ fontWeight: '700' }}>{ROLE_LABEL[profile?.role] || profile?.role}</Text>
            </Text>
            <Text style={s.text}>
              Đơn vị: <Text style={{ fontWeight: '700' }}>
                {profile?.don_vi_id ? unitName(profile.don_vi_id) : profile?.role === 'dev' ? 'Toàn tỉnh' : '— chưa gắn (nhờ quản trị gắn) —'}
              </Text>
            </Text>
            {(laCanBo || profile?.role === 'dev') && !doiDv && (
              <Btn small kind="ghost" title={profile?.role === 'dev' ? 'Đổi đơn vị' : 'Đổi đơn vị / chức vụ'} style={{ alignSelf: 'flex-start', marginTop: 10 }}
                onPress={() => setDoiDv({ don_vi_id: profile.don_vi_id || '', chuc_vu: profile.role })} />
            )}
          </>
        )}
        {profile?.provider && profile.provider !== 'email' && (
          <Text style={s.muted}>Đăng nhập bằng {profile.provider === 'apple' ? 'Apple' : profile.provider}{profile.email ? ` · ${profile.email}` : ''}</Text>
        )}
      </Card>
      {doiDv && profile?.role === 'dev' && (
        <Card>
          <Text style={[s.title, { marginBottom: 4 }]}>Đổi đơn vị</Text>
          <Text style={[s.muted, { marginBottom: 10 }]}>Cán bộ (admin): đổi ngay, không cần duyệt, vẫn xem được toàn tỉnh.</Text>
          <UnitSelect value={doiDv.don_vi_id} onChange={v => setDoiDv(o => ({ ...o, don_vi_id: v }))} tatCa="Toàn tỉnh (không gắn đơn vị)" style={{ marginBottom: 12 }} />
          <Btn title="Lưu" onPress={devLuuDonVi} loading={guiDoi} />
          <Btn title="Huỷ" kind="ghost" onPress={() => setDoiDv(null)} style={{ marginTop: 8 }} />
        </Card>
      )}
      {doiDv && profile?.role !== 'dev' && (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: C.warn }}>
          <Text style={[s.title, { marginBottom: 4 }]}>Đổi đơn vị / chức vụ</Text>
          <Text style={[s.muted, { marginBottom: 10 }]}>
            Sau khi gửi, tài khoản về chờ Trưởng CA hoặc Cán bộ (admin) của đơn vị mới duyệt. Riêng nhận Cán bộ (admin) của chính đơn vị mình khi đang khuyết thì không cần duyệt. Chức Trưởng CA / admin đã có người thì người đang giữ chức chuyển giao ở tab Phân công.
          </Text>
          <Text style={s.label}>Đơn vị mới</Text>
          <UnitSelect value={doiDv.don_vi_id} onChange={v => setDoiDv(o => ({ ...o, don_vi_id: v }))} style={{ marginBottom: 12 }} />
          <Text style={s.label}>Chức vụ</Text>
          <ChucVuSelect value={doiDv.chuc_vu} onChange={doiChucVu} donViId={doiDv.don_vi_id} nhanNgay={!!doiDv.don_vi_id && doiDv.don_vi_id === profile.don_vi_id} />
          <Btn title="Gửi yêu cầu duyệt" onPress={xinDoi} loading={guiDoi} />
          <Btn title="Huỷ" kind="ghost" onPress={() => setDoiDv(null)} style={{ marginTop: 8 }} />
        </Card>
      )}
      <Field label="Họ và tên" value={f.ho_ten} onChangeText={set('ho_ten')} />
      <Field label="Ngày sinh (dd/mm/yyyy)" value={f.ngay_sinh} onChangeText={set('ngay_sinh')} />
      <Field label="Nơi thường trú (theo CCCD)" value={f.dia_chi} onChangeText={set('dia_chi')} multiline />
      <Field label="Số điện thoại" value={f.sdt} onChangeText={set('sdt')} keyboardType="phone-pad" />
      <Btn title="Lưu thông tin" onPress={save} loading={saving} />

      {laDan && (
        <>
          <Text style={[s.h2, { marginTop: 20 }]}>Địa chỉ nơi thông báo lưu trú</Text>
          {coSo.length === 0 && <Text style={s.muted}>Chưa có. Thêm nhà/nhà trọ có người đến ở để bắt đầu thông báo lưu trú.</Text>}
          {coSo.map(c => (
            <Card key={c.id} onPress={() => navigation.navigate('CoSoForm', { coSo: c })}>
              <Text style={s.title}>{c.ten}</Text>
              <Text style={s.muted}>{c.dia_chi}</Text>
              {c.don_vi_id
                ? <Text style={s.muted}>{unitName(c.don_vi_id)}</Text>
                : <Text style={{ color: '#d97706', fontSize: 13 }}>Chưa chọn xã/phường — chạm để chọn (bắt buộc trước khi gửi)</Text>}
            </Card>
          ))}
          <Btn small kind="ghost" title="+ Thêm nơi lưu trú" onPress={() => navigation.navigate('CoSoForm')} style={{ alignSelf: 'flex-start' }} />
        </>
      )}
      <Btn
        title="Đăng xuất"
        kind="ghost"
        style={{ marginTop: 24 }}
        onPress={() => Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [{ text: 'Huỷ', style: 'cancel' }, { text: 'Đăng xuất', style: 'destructive', onPress: signOut }])}
      />
      <Btn
        title="Xoá tài khoản"
        kind="danger"
        loading={deleting}
        style={{ marginTop: 12 }}
        onPress={() =>
          Alert.alert(
            'Xoá tài khoản?',
            'Tài khoản và thông tin cá nhân sẽ bị xoá vĩnh viễn. Các thông báo lưu trú đã gửi vẫn được Công an xã lưu giữ theo quy định.',
            [
              { text: 'Huỷ', style: 'cancel' },
              {
                text: 'Xoá vĩnh viễn',
                style: 'destructive',
                onPress: async () => {
                  setDeleting(true);
                  try { await deleteAccount(); } catch (e) { Alert.alert('Không xoá được', e.message); setDeleting(false); }
                },
              },
            ],
          )
        }
      />
    </KeyboardScroll>
  );
}
