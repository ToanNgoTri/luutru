import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Btn, C, Card, Empty, Field, KeyboardScroll, s } from '../../components/ui';
import { getThongBao, guiThongBao, listMyCoSo } from '../../lib/api';
import { addDaysIso, isCccd, isoToVn, todayIso, vnToIso } from '../../lib/cccd';
import { addNguoi, clearDraft, removeNguoi, startDraft, useDraft } from '../../lib/draftStore';
import { useAuth } from '../../context/AuthContext';
import { SO_NGAY_LUU_TRU } from '../../config';

/**
 * Lập danh sách lưu trú: quét từng CCCD (hoặc nhập tay) → xem lại → xác nhận lần cuối → gửi Công an xã.
 * params: coSoId, giaHanTu? (id thông báo cũ khi gia hạn — điền sẵn người cũ, thêm/bớt tuỳ ý), reset?
 */
export default function LapThongBaoScreen({ navigation, route }) {
  const { coSoId, giaHanTu = null, reset } = route.params;
  const { user } = useAuth();
  const draft = useDraft();
  const [coSo, setCoSo] = useState(null);
  const [manual, setManual] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: giaHanTu ? 'Gia hạn lưu trú' : 'Lập thông báo lưu trú' });
    listMyCoSo(user.id).then(list => setCoSo(list.find(c => c.id === coSoId))).catch(() => {});
    (async () => {
      if (reset) clearDraft();
      if (giaHanTu) {
        try {
          const old = await getThongBao(giaHanTu);
          const nguoi = old.thong_bao_nguoi.map(({ cccd, cmnd, ho_ten, ngay_sinh, gioi_tinh, dia_chi, ngay_cap }) => ({
            cccd, cmnd, ho_ten, ngay_sinh, gioi_tinh, dia_chi, ngay_cap,
          }));
          startDraft(coSoId, giaHanTu, nguoi);
        } catch (e) {
          Alert.alert('Không tải được danh sách cũ', e.message);
        }
      } else {
        startDraft(coSoId, null, []);
      }
    })();
  }, [coSoId, giaHanTu, reset, navigation, user.id]);

  const nguoi = draft.coSoId === coSoId && draft.giaHanTu === giaHanTu ? draft.nguoi : [];

  function bo(p) {
    Alert.alert('Bỏ khỏi danh sách?', p.ho_ten, [
      { text: 'Huỷ' },
      { text: 'Bỏ', style: 'destructive', onPress: () => removeNguoi(p.cccd) },
    ]);
  }

  async function gui() {
    setSending(true);
    try {
      await guiThongBao(coSoId, nguoi, giaHanTu);
      clearDraft();
      setConfirm(false);
      Alert.alert('Đã gửi', 'Thông báo lưu trú đã chuyển cho Công an xã. Bạn sẽ thấy kết quả xác nhận trong Lịch sử.');
      navigation.popToTop();
    } catch (e) {
      Alert.alert('Gửi thất bại', e.message);
    } finally {
      setSending(false);
    }
  }

  const den = addDaysIso(todayIso(), SO_NGAY_LUU_TRU);

  return (
    <View style={s.screen}>
      <View style={[s.pad, { paddingBottom: 0 }]}>
        <Text style={s.title}>{coSo?.ten}</Text>
        <Text style={s.muted}>{coSo?.dia_chi}</Text>
        {giaHanTu && <Text style={[s.muted, { color: C.primary, marginTop: 4 }]}>Danh sách cũ đã được điền sẵn — bỏ người đã đi, quét thêm người mới.</Text>}
        <View style={[s.row, { gap: 8, marginVertical: 12 }]}>
          <Btn title="📷  Quét CCCD" onPress={() => navigation.navigate('ScanCccd', { mode: 'draft' })} style={{ flex: 2 }} />
          <Btn title="Nhập tay" kind="ghost" onPress={() => setManual(true)} style={{ flex: 1 }} />
        </View>
        <Text style={s.h2}>Danh sách lưu trú ({nguoi.length})</Text>
      </View>

      <FlatList
        data={nguoi}
        keyExtractor={p => p.cccd}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        ListEmptyComponent={<Empty text="Chưa có ai. Bấm “Quét CCCD” và đưa lần lượt từng thẻ vào khung." />}
        renderItem={({ item: p, index }) => (
          <Card style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{index + 1}. {p.ho_ten}</Text>
              <Text style={s.muted}>CCCD {p.cccd} · {isoToVn(p.ngay_sinh)} · {p.gioi_tinh}</Text>
              <Text style={s.muted} numberOfLines={2}>{p.dia_chi}</Text>
            </View>
            <Pressable onPress={() => bo(p)} hitSlop={12} style={{ padding: 6 }}>
              <Text style={{ color: C.danger, fontSize: 22 }}>✕</Text>
            </Pressable>
          </Card>
        )}
      />

      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        <Btn title={`Xem lại & gửi (${nguoi.length})`} disabled={!nguoi.length} onPress={() => setConfirm(true)} />
      </View>

      <ManualModal visible={manual} onClose={() => setManual(false)} />

      {/* Xác nhận lần cuối */}
      <Modal visible={confirm} animationType="slide" onRequestClose={() => setConfirm(false)}>
        <ScrollView style={s.screen} contentContainerStyle={s.pad}>
          <Text style={[s.title, { fontSize: 20, marginBottom: 8 }]}>Xác nhận lần cuối</Text>
          <Text style={s.text}>Cơ sở: <Text style={{ fontWeight: '700' }}>{coSo?.ten}</Text></Text>
          <Text style={s.text}>Thời gian lưu trú: {isoToVn(todayIso())} → {isoToVn(den)} ({SO_NGAY_LUU_TRU} ngày)</Text>
          {giaHanTu && <Text style={s.text}>Loại: Gia hạn thông báo trước</Text>}
          <Text style={[s.h2, { marginTop: 14 }]}>{nguoi.length} người lưu trú</Text>
          {nguoi.map((p, i) => (
            <Text key={p.cccd} style={[s.text, { marginBottom: 6 }]}>
              {i + 1}. {p.ho_ten} — {p.cccd} — {isoToVn(p.ngay_sinh)}
            </Text>
          ))}
          <Text style={[s.muted, { marginVertical: 14 }]}>
            Tôi cam đoan thông tin trên là đúng sự thật và chịu trách nhiệm trước pháp luật. Sau khi gửi, thông báo được chuyển tới Công an xã để xác nhận.
          </Text>
          <Btn title="Gửi Công an xã" onPress={gui} loading={sending} />
          <View style={{ height: 10 }} />
          <Btn title="Quay lại sửa" kind="ghost" onPress={() => setConfirm(false)} />
        </ScrollView>
      </Modal>
    </View>
  );
}

// Nhập tay khi thẻ bị mờ / không quét được QR
function ManualModal({ visible, onClose }) {
  const empty = { cccd: '', ho_ten: '', ngay_sinh: '', gioi_tinh: 'Nam', dia_chi: '' };
  const [f, setF] = useState(empty);
  const set = k => v => setF(o => ({ ...o, [k]: v }));

  function add() {
    if (!isCccd(f.cccd)) return Alert.alert('Số CCCD phải đủ 12 chữ số');
    if (!f.ho_ten.trim()) return Alert.alert('Nhập họ tên');
    const ns = vnToIso(f.ngay_sinh);
    if (!ns) return Alert.alert('Ngày sinh dạng dd/mm/yyyy');
    const ok = addNguoi({ cccd: f.cccd.trim(), cmnd: '', ho_ten: f.ho_ten.trim(), ngay_sinh: ns, gioi_tinh: f.gioi_tinh, dia_chi: f.dia_chi.trim(), ngay_cap: '' });
    if (!ok) return Alert.alert('CCCD này đã có trong danh sách');
    setF(empty);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardScroll contentContainerStyle={s.pad}>
        <Text style={[s.title, { fontSize: 18, marginBottom: 12 }]}>Nhập tay người lưu trú</Text>
        <Field label="Số CCCD" value={f.cccd} onChangeText={set('cccd')} keyboardType="number-pad" maxLength={12} />
        <Field label="Họ và tên" value={f.ho_ten} onChangeText={set('ho_ten')} />
        <Field label="Ngày sinh (dd/mm/yyyy)" value={f.ngay_sinh} onChangeText={set('ngay_sinh')} keyboardType="numbers-and-punctuation" />
        <View style={[s.row, { gap: 8, marginBottom: 12 }]}>
          {['Nam', 'Nữ'].map(g => (
            <Btn key={g} small title={g} kind={f.gioi_tinh === g ? 'primary' : 'ghost'} onPress={() => set('gioi_tinh')(g)} style={{ flex: 1 }} />
          ))}
        </View>
        <Field label="Nơi thường trú" value={f.dia_chi} onChangeText={set('dia_chi')} multiline />
        <Btn title="Thêm vào danh sách" onPress={add} />
        <View style={{ height: 10 }} />
        <Btn title="Đóng" kind="ghost" onPress={onClose} />
      </KeyboardScroll>
    </Modal>
  );
}
