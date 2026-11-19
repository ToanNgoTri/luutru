import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Btn, C, Card, Field, KeyboardScroll, NutGoi, s } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { canhBaoTheoNguoi, duyetThongBao, getThongBao, huyThongBao } from '../../lib/api';
import { isoToVn } from '../../lib/cccd';

export default function ThongBaoDetailScreen({ navigation, route }) {
  const { id } = route.params;
  const { user, role } = useAuth();
  const [tb, setTb] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tuChoi, setTuChoi] = useState(false);
  const [lyDo, setLyDo] = useState('');
  const [canhBao, setCanhBao] = useState({}); // thong_bao_nguoi_id → cảnh báo (chỉ cán bộ đọc được)

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getThongBao(id);
      setTb(data);
      if (role !== 'nguoi_dan') {
        const ds = await canhBaoTheoNguoi(data.thong_bao_nguoi.map(p => p.id)).catch(() => []);
        setCanhBao(Object.fromEntries(ds.map(c => [c.thong_bao_nguoi_id, c])));
      }
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  }, [id, role]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!tb) return <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} />;

  const laNguoiGui = tb.nguoi_gui === user.id;
  const coTheDuyet = role !== 'nguoi_dan' && tb.trang_thai === 'cho_duyet' && !laNguoiGui;

  async function act(fn, okMsg) {
    setBusy(true);
    try {
      await fn();
      Alert.alert(okMsg);
      setTuChoi(false);
      load();
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setBusy(false);
    }
  }

  const xacNhan = () =>
    Alert.alert('Xác nhận thông báo lưu trú?', `${tb.thong_bao_nguoi.length} người tại ${tb.co_so?.ten}`, [
      { text: 'Huỷ' },
      { text: 'Xác nhận', onPress: () => act(() => duyetThongBao(id, true), 'Đã xác nhận') },
    ]);

  const huy = () =>
    Alert.alert('Huỷ thông báo này?', 'Chỉ huỷ được khi Công an xã chưa xác nhận.', [
      { text: 'Không' },
      { text: 'Huỷ thông báo', style: 'destructive', onPress: () => act(() => huyThongBao(id), 'Đã huỷ') },
    ]);

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 120 }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Card>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={[s.title, { flex: 1 }]}>{tb.co_so?.ten}</Text>
            <Badge trangThai={tb.trang_thai} />
          </View>
          <Text style={s.muted}>Nơi lưu trú: {tb.co_so?.dia_chi}</Text>
          {tb.co_so?.chu && (
            <Text style={[s.text, { marginTop: 8 }]}>
              Người thông báo: {tb.co_so.chu.ho_ten} · CCCD {tb.co_so.chu.cccd}{tb.co_so.chu.sdt ? ` · ĐT ${tb.co_so.chu.sdt}` : ''}
            </Text>
          )}
          {!!tb.co_so?.chu?.dia_chi && <Text style={s.muted}>Thường trú người thông báo: {tb.co_so.chu.dia_chi}</Text>}
          {!laNguoiGui && <NutGoi sdt={tb.co_so?.chu?.sdt} title="Gọi người thông báo" style={{ alignSelf: 'flex-start', marginTop: 6 }} />}
          <Text style={s.text}>Lưu trú: {isoToVn(tb.tu_ngay)} → {isoToVn(tb.den_ngay)}{tb.gia_han_tu ? ' (gia hạn)' : ''}</Text>
          <Text style={s.muted}>Gửi lúc {new Date(tb.created_at).toLocaleString('vi-VN')}</Text>
          {tb.duyet_luc && (
            <Text style={s.muted}>
              {tb.trang_thai === 'da_duyet' ? 'Xác nhận' : 'Xử lý'} bởi {tb.nguoi_duyet_p?.ho_ten || 'cán bộ'} lúc {new Date(tb.duyet_luc).toLocaleString('vi-VN')}
            </Text>
          )}
          {tb.trang_thai === 'tu_choi' && <Text style={{ color: C.danger, marginTop: 6 }}>Lý do từ chối: {tb.ly_do}</Text>}
          {tb.gia_han_tu && (
            <Btn small kind="ghost" title="Xem thông báo trước" onPress={() => navigation.push('ThongBaoDetail', { id: tb.gia_han_tu })} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
          )}
        </Card>

        <Text style={s.h2}>Danh sách lưu trú ({tb.thong_bao_nguoi.length})</Text>
        {tb.thong_bao_nguoi.map((p, i) => (
          <Card key={p.id} style={canhBao[p.id] && canhBao[p.id].trang_thai !== 'khong_phai' ? { borderWidth: 2, borderColor: C.danger } : null}>
            {canhBao[p.id] && (
              <Pressable onPress={() => navigation.navigate('CanhBaoDetail', { id: canhBao[p.id].id })} style={{ marginBottom: 6 }}>
                <Text style={{ color: canhBao[p.id].trang_thai === 'khong_phai' ? C.muted : C.danger, fontWeight: '700' }}>
                  🚨 {canhBao[p.id].trang_thai === 'khong_phai' ? 'Đã xác minh: không phải đối tượng truy nã' : canhBao[p.id].trang_thai === 'dung' ? 'ĐÚNG đối tượng truy nã' : 'Nghi trùng đối tượng truy nã — chạm để xem'}
                </Text>
              </Pressable>
            )}
            <Text style={s.title}>{i + 1}. {p.ho_ten}</Text>
            <Text style={s.text}>CCCD: {p.cccd}{p.cmnd ? ` · CMND: ${p.cmnd}` : ''}</Text>
            <Text style={s.text}>Ngày sinh: {isoToVn(p.ngay_sinh)} · {p.gioi_tinh}</Text>
            <Text style={s.muted}>Thường trú: {p.dia_chi}</Text>
            {!!p.ngay_cap && <Text style={s.muted}>Ngày cấp CCCD: {isoToVn(p.ngay_cap)}</Text>}
          </Card>
        ))}
      </ScrollView>

      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 8 }}>
        {coTheDuyet && (
          <View style={[s.row, { gap: 8 }]}>
            <Btn title="Xác nhận" kind="ok" onPress={xacNhan} loading={busy} style={{ flex: 1 }} />
            <Btn title="Từ chối" kind="danger" onPress={() => setTuChoi(true)} disabled={busy} style={{ flex: 1 }} />
          </View>
        )}
        {laNguoiGui && tb.trang_thai === 'cho_duyet' && <Btn title="Huỷ thông báo" kind="ghost" onPress={huy} loading={busy} />}
        {laNguoiGui && tb.trang_thai === 'tu_choi' && (
          <Btn title="Lập lại thông báo" onPress={() => navigation.navigate('LapThongBao', { coSoId: tb.co_so_id, giaHanTu: tb.gia_han_tu || null, reset: true })} />
        )}
      </View>

      <Modal visible={tuChoi} transparent animationType="fade" onRequestClose={() => setTuChoi(false)}>
        <KeyboardScroll style={{ backgroundColor: '#0008' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16 }}>
            <Text style={[s.title, { marginBottom: 10 }]}>Lý do từ chối</Text>
            <Field value={lyDo} onChangeText={setLyDo} multiline placeholder="vd: Sai thông tin người lưu trú, cần bổ sung..." autoFocus />
            <View style={[s.row, { gap: 8 }]}>
              <Btn title="Đóng" kind="ghost" onPress={() => setTuChoi(false)} style={{ flex: 1 }} />
              <Btn title="Từ chối" kind="danger" loading={busy} disabled={!lyDo.trim()} onPress={() => act(() => duyetThongBao(id, false, lyDo), 'Đã từ chối')} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardScroll>
      </Modal>
    </View>
  );
}
