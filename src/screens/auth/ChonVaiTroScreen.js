import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, s } from '../../components/ui';
import { setVaiTroChon } from '../../lib/vaiTro';

// Màn đầu tiên khi chưa đăng nhập: bạn là người dân hay cán bộ?
export default function ChonVaiTroScreen({ navigation }) {
  const chon = async vaiTro => {
    await setVaiTroChon(vaiTro);
    navigation.navigate('Login', { vaiTro });
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={st.container}>
      <Text style={st.title}>THÔNG BÁO LƯU TRÚ</Text>
      <Text style={[s.muted, { textAlign: 'center', marginBottom: 36 }]}>Bạn sử dụng ứng dụng với vai trò nào?</Text>

      <Pressable onPress={() => chon('nguoi_dan')} style={({ pressed }) => [st.card, pressed && st.pressed]}>
        <Text style={st.emoji}>🏠</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.cardTitle}>Người dân</Text>
          <Text style={s.muted}>Chủ nhà trọ / hộ gia đình — quét CCCD người đến ở để thông báo lưu trú với Công an xã</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => chon('can_bo')} style={({ pressed }) => [st.card, pressed && st.pressed]}>
        <Text style={st.emoji}>👮</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.cardTitle}>Cán bộ Công an xã</Text>
          <Text style={s.muted}>Xác nhận thông báo lưu trú của nhóm cơ sở được phân công. Chọn đơn vị + chức vụ, chờ Trưởng CA đơn vị duyệt.</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: C.primaryDark, textAlign: 'center', marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0' },
  pressed: { opacity: 0.85, borderColor: C.primary },
  emoji: { fontSize: 40 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 4 },
});
