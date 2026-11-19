import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Card, Chip, Empty, s, TRANG_THAI } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { listCoSoQuanLy, listMyThongBao, listThongBaoQuanLy } from '../../lib/api';
import { isoToVn } from '../../lib/cccd';

/**
 * Lịch sử thông báo lưu trú.
 * - Người dân: chỉ các thông báo của chính mình.
 * - Cán bộ: các cơ sở trong nhóm được phân công (RLS); Trưởng/Phó CA: cả đơn vị; dev: tất cả. Lọc theo cơ sở + trạng thái.
 */
export default function LichSuScreen({ navigation }) {
  const { user, role } = useAuth();
  const quanLy = role !== 'nguoi_dan';
  const [rows, setRows] = useState([]);
  const [coSo, setCoSo] = useState([]);
  const [coSoId, setCoSoId] = useState(null);
  const [tt, setTt] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (quanLy) {
        const [list, cs] = await Promise.all([listThongBaoQuanLy({ coSoId }), coSo.length ? coSo : listCoSoQuanLy()]);
        setRows(list);
        if (!coSo.length) setCoSo(cs);
      } else {
        setRows(await listMyThongBao(user.id));
      }
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  }, [quanLy, coSoId, user.id, coSo]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const data = useMemo(() => (tt ? rows.filter(r => r.trang_thai === tt) : rows), [rows, tt]);

  return (
    <View style={s.screen}>
      {quanLy && coSo.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 12, paddingBottom: 0 }}>
          <Chip label="Tất cả cơ sở" active={!coSoId} onPress={() => setCoSoId(null)} />
          {coSo.map(c => <Chip key={c.id} label={c.ten} active={coSoId === c.id} onPress={() => setCoSoId(c.id)} />)}
        </ScrollView>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 12 }}>
        <Chip label="Mọi trạng thái" active={!tt} onPress={() => setTt(null)} />
        {Object.entries(TRANG_THAI).map(([k, v]) => <Chip key={k} label={v.label} active={tt === k} onPress={() => setTt(k)} />)}
      </ScrollView>
      <FlatList
        data={data}
        keyExtractor={r => String(r.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={!loading && <Empty text="Chưa có thông báo lưu trú nào." />}
        renderItem={({ item: r }) => <ThongBaoItem r={r} onPress={() => navigation.navigate('ThongBaoDetail', { id: r.id })} />}
      />
    </View>
  );
}

export function ThongBaoItem({ r, onPress }) {
  return (
    <Card onPress={onPress}>
      <View style={[s.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
        <Text style={[s.title, { flex: 1 }]} numberOfLines={1}>{r.co_so?.ten}</Text>
        <Badge trangThai={r.trang_thai} />
      </View>
      <Text style={s.muted}>
        {r.thong_bao_nguoi?.[0]?.count ?? 0} người · {isoToVn(r.tu_ngay)} → {isoToVn(r.den_ngay)}
        {r.gia_han_tu ? ' · Gia hạn' : ''}
      </Text>
      <Text style={s.muted}>Gửi lúc {new Date(r.created_at).toLocaleString('vi-VN')}</Text>
    </Card>
  );
}
