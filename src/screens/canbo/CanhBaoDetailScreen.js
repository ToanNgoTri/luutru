import React, { useCallback, useState } from 'react';
import { Alert, Linking, Modal, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BangThongTin, Btn, C, Card, Field, Icon, KeyboardScroll, NutGoi, s } from '../../components/ui';
import { getCanhBao, xuLyCanhBao } from '../../lib/api';
import { isoToVn } from '../../lib/cccd';
import { MUC_DO } from './TruyNaScreen';

export const LINK_TRUY_NA = ma => `https://truyna.bocongan.gov.vn/TimKiem/ChiTiet/${ma}`;

// So sánh người lưu trú (từ CCCD) với đối tượng truy nã; cán bộ xác minh Đúng / Không phải
export default function CanhBaoDetailScreen({ navigation, route }) {
  const { id } = route.params;
  const [cb, setCb] = useState(null);
  const [loading, setLoading] = useState(false);
  const [xuLy, setXuLy] = useState(null); // true = đúng, false = không phải
  const [ghiChu, setGhiChu] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCb(await getCanhBao(id));
    } catch (e) {
      Alert.alert('Không mở được cảnh báo', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!cb) return <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} />;

  const n = cb.nguoi || {};
  const t = cb.truy_na || {};
  const coSo = n.thong_bao?.co_so;
  const m = MUC_DO[cb.muc_do];
  const namNguoi = n.ngay_sinh ? Number(n.ngay_sinh.slice(0, 4)) : null;

  async function luu() {
    setBusy(true);
    try {
      await xuLyCanhBao(id, xuLy, ghiChu);
      setXuLy(null);
      setGhiChu('');
      load();
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 140 }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Card style={{ borderLeftWidth: 4, borderLeftColor: m.color }}>
          <View style={[s.row, { gap: 6 }]}>
            <Icon name={m.icon} size={20} color={m.color} />
            <Text style={{ color: m.color, fontWeight: '800', fontSize: 16 }}>{m.label}</Text>
          </View>
          <Text style={s.muted}>{m.mo}. Đây chỉ là nghi vấn do trùng thông tin — phải xác minh trước khi xử lý.</Text>
          {cb.trang_thai !== 'moi' && (
            <Text style={[s.text, { marginTop: 6, fontWeight: '700', color: cb.trang_thai === 'dung' ? C.ok : C.muted }]}>
              {cb.trang_thai === 'dung' ? '✓ Đã xác minh: ĐÚNG đối tượng' : 'Đã xác minh: không phải'}
              {cb.nguoi_xu_ly_p?.ho_ten ? ` — ${cb.nguoi_xu_ly_p.ho_ten}` : ''}
              {cb.xu_ly_luc ? `, ${new Date(cb.xu_ly_luc).toLocaleString('vi-VN')}` : ''}
            </Text>
          )}
          {!!cb.ghi_chu && <Text style={s.muted}>Ghi chú: {cb.ghi_chu}</Text>}
        </Card>

        <Text style={s.h2}>Người lưu trú (từ CCCD)</Text>
        <BangThongTin
          dong={[
            { nhan: 'Họ tên', giaTri: n.ho_ten, noiBat: true, mau: C.danger },
            { nhan: 'Ngày sinh', giaTri: isoToVn(n.ngay_sinh), mau: namNguoi === t.nam_sinh ? C.danger : undefined },
            { nhan: 'Giới tính', giaTri: n.gioi_tinh },
            { nhan: 'CCCD', giaTri: n.cccd },
            { nhan: 'CMND', giaTri: n.cmnd },
            { nhan: 'Thường trú', giaTri: n.dia_chi, mau: cb.muc_do === 'cao' ? C.danger : undefined },
            { nhan: 'Nơi lưu trú', giaTri: coSo ? `${coSo.ten} — ${coSo.dia_chi}` : null },
            { nhan: 'Chủ cơ sở', giaTri: coSo?.chu ? `${coSo.chu.ho_ten}${coSo.chu.sdt ? ` · ${coSo.chu.sdt}` : ''}` : null },
            { nhan: 'Lưu trú', giaTri: n.thong_bao ? `${isoToVn(n.thong_bao.tu_ngay)} → ${isoToVn(n.thong_bao.den_ngay)}` : null },
          ]}
        />
        <View style={[s.row, { gap: 8, marginTop: 8, flexWrap: 'wrap' }]}>
          {!!n.thong_bao?.id && (
            <Btn small kind="ghost" title="Xem thông báo lưu trú" onPress={() => navigation.navigate('ThongBaoDetail', { id: n.thong_bao.id })} />
          )}
          <NutGoi sdt={coSo?.chu?.sdt} title="Gọi chủ cơ sở" />
        </View>

        <Text style={s.h2}>Đối tượng truy nã</Text>
        <BangThongTin
          dong={[
            { nhan: 'Họ tên', giaTri: t.ho_ten, noiBat: true, mau: C.danger },
            { nhan: 'Năm sinh', giaTri: t.nam_sinh, mau: namNguoi === t.nam_sinh ? C.danger : undefined },
            { nhan: 'Nơi ĐKTT', giaTri: t.noi_dktt, mau: cb.muc_do === 'cao' ? C.danger : undefined },
            { nhan: 'Địa danh mới', giaTri: t.dktt_moi },
            { nhan: 'Bố', giaTri: t.ten_bo },
            { nhan: 'Mẹ', giaTri: t.ten_me },
            { nhan: 'Tội danh', giaTri: t.toi_danh },
            { nhan: 'Quyết định', giaTri: t.quyet_dinh },
            { nhan: 'Đơn vị ra QĐ', giaTri: t.don_vi },
            { nhan: 'Phạm vi', giaTri: t.pham_vi },
            { nhan: 'Báo cho', giaTri: t.bao_cho },
          ]}
        />
        <View style={[s.row, { gap: 8, marginTop: 8, flexWrap: 'wrap' }]}>
          {t.ma && <Btn small kind="ghost" title="Trang Bộ Công an" onPress={() => Linking.openURL(LINK_TRUY_NA(t.ma))} />}
          <NutGoi sdt={t.sdt_bao} title={`Gọi báo tin ${t.sdt_bao}`} />
        </View>
      </ScrollView>

      {cb.trang_thai === 'moi' && (
        <View style={[s.row, { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 8 }]}>
          <Btn title="Đúng đối tượng" kind="danger" onPress={() => setXuLy(true)} style={{ flex: 1 }} />
          <Btn title="Không phải" kind="ghost" onPress={() => setXuLy(false)} style={{ flex: 1, backgroundColor: '#fff' }} />
        </View>
      )}

      <Modal visible={xuLy !== null} transparent animationType="fade" onRequestClose={() => setXuLy(null)}>
        <KeyboardScroll style={{ backgroundColor: '#0008' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16 }}>
            <Text style={[s.title, { marginBottom: 6 }]}>{xuLy ? 'Xác nhận ĐÚNG đối tượng truy nã' : 'Xác nhận KHÔNG phải đối tượng'}</Text>
            <Text style={[s.muted, { marginBottom: 10 }]}>{xuLy ? 'Ghi lại biện pháp đã xử lý / đơn vị đã báo.' : 'Ghi lại căn cứ (vd: khác cha mẹ, khác quê...).'}</Text>
            <Field value={ghiChu} onChangeText={setGhiChu} multiline placeholder="Ghi chú" />
            <View style={[s.row, { gap: 8 }]}>
              <Btn title="Huỷ" kind="ghost" onPress={() => setXuLy(null)} style={{ flex: 1 }} />
              <Btn title="Lưu" kind={xuLy ? 'danger' : 'primary'} loading={busy} onPress={luu} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardScroll>
      </Modal>
    </View>
  );
}
