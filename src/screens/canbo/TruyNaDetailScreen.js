import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from 'react-native';
import { BangThongTin, Btn, C, Card, NutGoi, s } from '../../components/ui';
import { getTruyNa } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { LINK_TRUY_NA } from './CanhBaoDetailScreen';

export default function TruyNaDetailScreen({ route }) {
  const { role } = useAuth();
  const [t, setT] = useState(null);
  useEffect(() => {
    getTruyNa(route.params.ma).then(setT).catch(e => Alert.alert('Lỗi', e.message));
  }, [route.params.ma]);

  if (!t) return <View style={[s.screen, { justifyContent: 'center' }]}><ActivityIndicator color={C.primary} /></View>;

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.pad, { paddingBottom: 32 }]}>
      <View style={{ marginBottom: 6 }}>
        <Text style={[s.title, { fontSize: 20 }]}>{t.ho_ten}</Text>
        <Text style={s.muted}>Năm sinh {t.nam_sinh || '?'}</Text>
      </View>

      <Text style={s.h2}>Thông tin cá nhân</Text>
      <BangThongTin
        dong={[
          { nhan: 'Họ tên', giaTri: t.ho_ten, noiBat: true },
          { nhan: 'Năm sinh', giaTri: t.nam_sinh },
          { nhan: 'Nơi ĐKTT', giaTri: t.noi_dktt },
          { nhan: 'Địa danh mới', giaTri: t.dktt_moi, mau: C.primary },
          { nhan: 'Họ tên bố', giaTri: t.ten_bo },
          { nhan: 'Họ tên mẹ', giaTri: t.ten_me },
        ]}
      />

      <Text style={s.h2}>Thông tin truy nã</Text>
      <BangThongTin
        dong={[
          { nhan: 'Tội danh', giaTri: t.toi_danh, noiBat: true, mau: C.danger },
          { nhan: 'Quyết định', giaTri: t.quyet_dinh },
          { nhan: 'Đơn vị ra QĐ', giaTri: t.don_vi },
          { nhan: 'Phạm vi', giaTri: t.pham_vi },
          { nhan: 'Loại truy nã', giaTri: t.loai_truy_na },
          { nhan: 'Báo cho', giaTri: t.bao_cho },
          { nhan: 'Điện thoại', giaTri: t.sdt_bao },
        ]}
      />

      {role === 'nguoi_dan' && (
        <Card style={{ marginTop: 14, borderLeftWidth: 4, borderLeftColor: C.warn }}>
          <Text style={s.text}>Phát hiện đối tượng: báo ngay cho Công an xã hoặc số điện thoại ở trên. Không tự ý bắt giữ.</Text>
        </Card>
      )}

      <View style={{ gap: 10, marginTop: 14 }}>
        <NutGoi sdt={t.sdt_bao} title={`Gọi báo tin ${t.sdt_bao}`} small={false} kind="solid" />
        <Btn title="Mở trang Bộ Công an" kind="ghost" onPress={() => Linking.openURL(LINK_TRUY_NA(t.ma))} />
      </View>
      <Text style={[s.muted, { marginTop: 12, fontSize: 12 }]}>Nguồn: truyna.bocongan.gov.vn</Text>
    </ScrollView>
  );
}
