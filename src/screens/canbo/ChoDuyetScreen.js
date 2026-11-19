import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Empty, s } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { listThongBaoQuanLy } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { showLocal } from '../../lib/reminders';
import { ThongBaoItem } from '../common/LichSuScreen';

// Cán bộ: các thông báo đang chờ xác nhận thuộc nhóm cơ sở mình phụ trách (cũ nhất lên trước).
export default function ChoDuyetScreen({ navigation }) {
  const { user, role } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listThongBaoQuanLy({ trangThai: 'cho_duyet' });
      setRows(list.filter(r => r.nguoi_gui !== user.id));
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: có thông báo mới (RLS lọc theo quyền) → báo + tải lại
  useEffect(() => {
    const ch = supabase
      .channel('thong_bao_moi')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thong_bao' }, payload => {
        if (payload.new?.nguoi_gui === user.id) return;
        showLocal('Thông báo lưu trú mới', 'Có cơ sở vừa gửi danh sách lưu trú cần xác nhận', { id: String(payload.new.id) }).catch(() => {});
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user.id]);

  return (
    <View style={s.screen}>
      <Text style={[s.muted, { padding: 16, paddingBottom: 4 }]}>
        {role === 'can_bo' ? 'Các cơ sở thuộc nhóm bạn phụ trách' : 'Tất cả cơ sở'} · {rows.length} chờ xác nhận
      </Text>
      <FlatList
        data={rows}
        keyExtractor={r => String(r.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={!loading && <Empty text="Không có thông báo nào chờ xác nhận." />}
        renderItem={({ item }) => <ThongBaoItem r={item} onPress={() => navigation.navigate('ThongBaoDetail', { id: item.id })} />}
      />
    </View>
  );
}
