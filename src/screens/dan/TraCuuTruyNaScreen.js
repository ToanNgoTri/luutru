import React from 'react';
import { Text, View } from 'react-native';
import { C, Card, s } from '../../components/ui';
import { DanhSachTruyNa } from '../canbo/TruyNaScreen';

// Người dân: chỉ TRA CỨU danh sách truy nã công khai. Không có cảnh báo nghi trùng, không có thông báo đẩy.
export default function TraCuuTruyNaScreen({ navigation }) {
  return (
    <View style={s.screen}>
      <DanhSachTruyNa
        navigation={navigation}
        header={
          <Card style={{ borderLeftWidth: 4, borderLeftColor: C.warn }}>
            <Text style={s.text}>
              Danh sách đối tượng truy nã công khai của Bộ Công an. Nếu phát hiện đối tượng, hãy báo ngay cho Công an xã
              hoặc số điện thoại trong trang chi tiết — không tự ý bắt giữ.
            </Text>
          </Card>
        }
      />
    </View>
  );
}
