import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Btn, C, Card, Empty, s } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { listMyCoSo } from '../../lib/api';
import { isoToVn } from '../../lib/cccd';
import { dismissGiaHan, syncReminders } from '../../lib/reminders';
import { getDraft, loadDraft } from '../../lib/draftStore';

export default function HomeDanScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [coSo, setCoSo] = useState([]);
  const [denHan, setDenHan] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draftInfo, setDraftInfo] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, dh] = await Promise.all([listMyCoSo(user.id), syncReminders(user.id)]);
      setCoSo(cs);
      setDenHan(dh);
      const d = await loadDraft();
      setDraftInfo(d.nguoi.length ? d : null);
    } catch (e) {
      Alert.alert('Lỗi tải dữ liệu', e.message);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tenCoSo = id => coSo.find(c => c.id === id)?.ten || 'Cơ sở';

  function khongGiaHan(t) {
    Alert.alert('Không gia hạn?', `Ngừng nhắc gia hạn lưu trú ở ${t.co_so?.ten}.`, [
      { text: 'Huỷ' },
      { text: 'Không gia hạn', style: 'destructive', onPress: async () => { await dismissGiaHan(t.id); load(); } },
    ]);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={s.muted}>Xin chào</Text>
      <Text style={[s.title, { fontSize: 20, marginBottom: 12 }]}>{profile?.ho_ten}</Text>

      {denHan.length > 0 && (
        <>
          <Text style={[s.h2, { color: C.warn }]}>⏰ Đến hạn gia hạn ({denHan.length})</Text>
          {denHan.map(t => (
            <Card key={t.id} style={{ borderLeftWidth: 4, borderLeftColor: C.warn }}>
              <Text style={s.title}>{t.co_so?.ten}</Text>
              <Text style={s.muted}>Lưu trú {isoToVn(t.tu_ngay)} → {isoToVn(t.den_ngay)} đã đủ 30 ngày. Tiếp tục gia hạn?</Text>
              <View style={[s.row, { marginTop: 10, gap: 8 }]}>
                <Btn small title="Gia hạn" onPress={() => navigation.navigate('LapThongBao', { coSoId: t.co_so_id, giaHanTu: t.id })} style={{ flex: 1 }} />
                <Btn small kind="ghost" title="Không gia hạn" onPress={() => khongGiaHan(t)} style={{ flex: 1 }} />
              </View>
            </Card>
          ))}
        </>
      )}

      {draftInfo && (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: C.primary }} onPress={() => navigation.navigate('LapThongBao', { coSoId: draftInfo.coSoId, giaHanTu: draftInfo.giaHanTu })}>
          <Text style={s.title}>Bản nháp chưa gửi</Text>
          <Text style={s.muted}>{tenCoSo(draftInfo.coSoId)} · {draftInfo.nguoi.length} người đã quét — chạm để tiếp tục</Text>
        </Card>
      )}

      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={s.h2}>Nơi thông báo lưu trú</Text>
        <Btn small kind="ghost" title="+ Thêm nơi" onPress={() => navigation.navigate('CoSoForm')} />
      </View>
      {!loading && coSo.length === 0 && <Empty text="Chưa có nơi thông báo lưu trú. Thêm nhà / nhà trọ có người đến ở để bắt đầu thông báo." />}
      {coSo.map(c => (
        <Card key={c.id}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{c.ten}</Text>
              <Text style={s.muted}>📍 {c.dia_chi}</Text>
              {!c.nhom_id && <Text style={[s.muted, { color: C.warn, marginTop: 4 }]}>Chưa được phân cán bộ phụ trách</Text>}
            </View>
            <Btn small kind="ghost" title="Sửa" onPress={() => navigation.navigate('CoSoForm', { coSo: c })} />
          </View>
          <Btn
            title="📷  Thông báo lưu trú"
            onPress={() => {
              const d = getDraft();
              if (d.nguoi.length && (d.coSoId !== c.id || d.giaHanTu)) {
                return Alert.alert('Đang có bản nháp khác', `Bản nháp ${tenCoSo(d.coSoId)} có ${d.nguoi.length} người sẽ bị bỏ.`, [
                  { text: 'Huỷ' },
                  { text: 'Bỏ nháp cũ', style: 'destructive', onPress: () => navigation.navigate('LapThongBao', { coSoId: c.id, reset: true }) },
                ]);
              }
              navigation.navigate('LapThongBao', { coSoId: c.id });
            }}
            style={{ marginTop: 10 }}
          />
        </Card>
      ))}
    </ScrollView>
  );
}
