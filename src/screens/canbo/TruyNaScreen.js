import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BangThongTin, Btn, C, Chip, Empty, Icon, KeyboardScroll, s } from '../../components/ui';
import { listCanhBao, timTruyNa } from '../../lib/api';
import { isoToVn } from '../../lib/cccd';

export const MUC_DO = {
  cao: { label: 'Trùng cao', mo: 'Trùng họ tên + năm sinh + cùng tỉnh', color: C.danger, icon: 'alert-circle' },
  trung_ten: { label: 'Trùng tên + năm sinh', mo: 'Khác tỉnh / không rõ tỉnh — cần xác minh kỹ', color: C.warn, icon: 'warning' },
};
const TT_CB = {
  moi: { label: 'Chưa xử lý', color: C.danger },
  dung: { label: 'Đúng đối tượng', color: C.ok },
  khong_phai: { label: 'Không phải', color: C.muted },
};

// Tab "Truy nã" của cán bộ: Cảnh báo nghi trùng + Danh sách đối tượng truy nã
export default function TruyNaScreen({ navigation }) {
  const [tab, setTab] = useState('canh_bao');
  return (
    <View style={s.screen}>
      <View style={st.segment}>
        {[['canh_bao', 'Cảnh báo nghi trùng', 'alert-circle-outline'], ['ds', 'Danh sách truy nã', 'list-outline']].map(([k, l, ic]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[st.segBtn, tab === k && st.segOn]}>
            <Icon name={ic} size={16} color={tab === k ? '#fff' : C.text} />
            <Text style={[st.segText, tab === k && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'canh_bao' ? <CanhBaoTab navigation={navigation} /> : <DanhSachTruyNa navigation={navigation} />}
    </View>
  );
}

function CanhBaoTab({ navigation }) {
  const [tt, setTt] = useState('moi');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listCanhBao(tt));
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  }, [tt]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.row, { paddingHorizontal: 12, paddingBottom: 8 }]}>
        {[['moi', 'Chưa xử lý'], ['dung', 'Đúng'], ['khong_phai', 'Không phải'], [null, 'Tất cả']].map(([k, l]) => (
          <Chip key={String(k)} label={l} active={tt === k} onPress={() => setTt(k)} />
        ))}
      </View>
      <FlatList
        data={rows}
        keyExtractor={r => String(r.id)}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={!loading && <Empty text={tt === 'moi' ? 'Không có cảnh báo nào cần xử lý.' : 'Không có cảnh báo.'} />}
        renderItem={({ item: r }) => {
          const m = MUC_DO[r.muc_do];
          const t = TT_CB[r.trang_thai];
          return (
            <Pressable onPress={() => navigation.navigate('CanhBaoDetail', { id: r.id })} style={({ pressed }) => [st.item, { borderTopColor: m.color }, pressed && { opacity: 0.85 }]}>
              <View style={[s.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
                <View style={[s.row, { gap: 6 }]}>
                  <Icon name={m.icon} size={18} color={m.color} />
                  <Text style={{ color: m.color, fontWeight: '700' }}>{m.label}</Text>
                </View>
                <View style={[st.pill, { borderColor: t.color }]}><Text style={{ color: t.color, fontSize: 11.5, fontWeight: '600' }}>{t.label}</Text></View>
              </View>
              <BangThongTin
                rongNhan={88}
                dong={[
                  { nhan: 'Người lưu trú', giaTri: `${r.nguoi?.ho_ten} · ${isoToVn(r.nguoi?.ngay_sinh)}`, noiBat: true },
                  { nhan: 'Nơi lưu trú', giaTri: r.nguoi?.thong_bao?.co_so?.ten },
                  { nhan: 'Truy nã', giaTri: `${r.truy_na?.ho_ten} (${r.truy_na?.nam_sinh || '?'})`, noiBat: true, mau: C.danger },
                  { nhan: 'Tội danh', giaTri: r.truy_na?.toi_danh },
                ]}
              />
              <View style={[s.row, { justifyContent: 'space-between', marginTop: 6 }]}>
                <Text style={[s.muted, { fontSize: 11.5 }]}>{new Date(r.created_at).toLocaleString('vi-VN')}</Text>
                <Icon name="chevron-forward" size={16} color={C.muted} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// Danh sách + tìm kiếm truy nã — dùng chung cho cán bộ (tab Truy nã) và người dân (tab Tra cứu).
// Chỉ hiện kết quả SAU KHI bấm Tìm kiếm.
const DK_TRONG = { hoTen: '', nam: '', namTu: '', namDen: '', diaChi: '', tenBo: '', tenMe: '', toiDanh: '', quyetDinh: '', donVi: '' };
const DK_NANG_CAO = ['namTu', 'namDen', 'diaChi', 'tenBo', 'tenMe', 'toiDanh', 'quyetDinh', 'donVi'];

function O({ label, value, onChangeText, style, ...props }) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <Text style={st.oLabel}>{label}</Text>
      {/* bàn phím bật sẵn chữ in hoa; chữ gõ/dán vào cũng tự đổi in hoa (khớp dữ liệu truy nã) */}
      <TextInput
        value={value}
        onChangeText={v => onChangeText(v.toLocaleUpperCase('vi'))}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholderTextColor="#94a3b8"
        style={st.oInput}
        {...props}
      />
    </View>
  );
}

export function DanhSachTruyNa({ navigation, header = null }) {
  const [dk, setDk] = useState(DK_TRONG);
  const [rows, setRows] = useState([]);
  const [tong, setTong] = useState(null); // null = chưa tìm lần nào
  const [loading, setLoading] = useState(false);
  const [nangCao, setNangCao] = useState(false);
  const set = k => v => setDk(o => ({ ...o, [k]: v }));
  const soDk = Object.values(dk).filter(v => String(v).trim()).length;
  const soNangCao = DK_NANG_CAO.filter(k => String(dk[k]).trim()).length;

  const tim = useCallback(async (tu = 0) => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      // "Năm sinh" ở ô cơ bản = đúng năm đó; khoảng năm ở phần nâng cao (nếu có) được ưu tiên
      const kq = await timTruyNa({ ...dk, namTu: dk.namTu || dk.nam, namDen: dk.namDen || dk.nam }, tu);
      setRows(old => (tu ? [...old, ...kq.rows] : kq.rows));
      setTong(tu && !kq.rows.length ? tong : kq.tong);
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  }, [dk, tong]);

  const xoa = () => { setDk(DK_TRONG); setRows([]); setTong(null); };

  return (
    <KeyboardScroll contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
      {header}
      <View style={st.form}>
        <View style={st.hang}>
          <O label="Họ tên" value={dk.hoTen} onChangeText={set('hoTen')} placeholder="CÓ HOẶC KHÔNG DẤU" returnKeyType="search" onSubmitEditing={() => tim(0)} style={{ flex: 2.2 }} />
          <O label="Năm sinh" value={dk.nam} onChangeText={set('nam')} keyboardType="number-pad" maxLength={4} placeholder="VD 1990" returnKeyType="search" onSubmitEditing={() => tim(0)} />
        </View>

        <Pressable onPress={() => setNangCao(v => !v)} style={st.nangCao} hitSlop={6}>
          <Icon name="options-outline" size={16} color={C.primary} />
          <Text style={{ color: C.primary, fontWeight: '600', flex: 1 }}>
            Tìm kiếm nâng cao{soNangCao ? ` (${soNangCao} điều kiện)` : ''}
          </Text>
          <Icon name={nangCao ? 'chevron-up' : 'chevron-down'} size={18} color={C.primary} />
        </Pressable>

        {nangCao && (
          <>
            <View style={st.hang}>
              <O label="Năm sinh từ" value={dk.namTu} onChangeText={set('namTu')} keyboardType="number-pad" maxLength={4} placeholder="VD 1985" />
              <O label="đến" value={dk.namDen} onChangeText={set('namDen')} keyboardType="number-pad" maxLength={4} placeholder="VD 1995" />
            </View>
            <O label="Nơi ĐKTT (địa chỉ cũ hoặc mới)" value={dk.diaChi} onChangeText={set('diaChi')} placeholder="VD: ĐỒNG NAI, LONG KHÁNH" />
            <View style={st.hang}>
              <O label="Họ tên bố" value={dk.tenBo} onChangeText={set('tenBo')} />
              <O label="Họ tên mẹ" value={dk.tenMe} onChangeText={set('tenMe')} />
            </View>
            <O label="Tội danh" value={dk.toiDanh} onChangeText={set('toiDanh')} placeholder="VD: TRỘM CẮP, MA TUÝ" />
            <View style={st.hang}>
              <O label="Số quyết định" value={dk.quyetDinh} onChangeText={set('quyetDinh')} />
              <O label="Đơn vị ra QĐ" value={dk.donVi} onChangeText={set('donVi')} placeholder="VD: CA TỈNH ĐỒNG NAI" />
            </View>
          </>
        )}
        {/* nút gọn, nằm bên phải */}
        <View style={[st.hang, { justifyContent: 'flex-end', alignItems: 'center' }]}>
          {(() => {
            const coDk = soDk > 0 || tong !== null;
            return (
              <Pressable onPress={xoa} disabled={!coDk} style={({ pressed }) => [st.nutXoa, !coDk && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}>
                <Icon name="close" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Xoá ĐK</Text>
              </Pressable>
            );
          })()}
          <Pressable onPress={() => tim(0)} disabled={loading} style={({ pressed }) => [st.nutTim, (pressed || loading) && { opacity: 0.75 }]}>
            {loading && !rows.length ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="search" size={16} color="#fff" />}
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Tìm</Text>
          </Pressable>
        </View>
      </View>

      {tong === null ? (
        <Text style={[s.muted, { textAlign: 'center', marginTop: 16 }]}>Nhập một hoặc nhiều điều kiện rồi bấm Tìm kiếm.</Text>
      ) : (
        <>
          <Text style={st.ketQua}>
            {tong ? `Tìm thấy ${Number(tong).toLocaleString('vi-VN')} đối tượng` : 'Không tìm thấy đối tượng nào'}
            {rows.length && rows.length < tong ? ` · đang hiện ${rows.length}` : ''}
          </Text>
          {rows.map(t => (
            <Pressable key={t.ma} onPress={() => navigation.navigate('TruyNaDetail', { ma: t.ma })} style={({ pressed }) => [st.item, pressed && { opacity: 0.85 }]}>
              <View style={[s.row, { gap: 10, marginBottom: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.ten} numberOfLines={1}>{t.ho_ten}</Text>
                  <Text style={[s.muted, { fontSize: 12 }]} numberOfLines={1}>{t.quyet_dinh}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={C.muted} />
              </View>
              <BangThongTin
                rongNhan={86}
                dong={[
                  { nhan: 'Năm sinh', giaTri: t.nam_sinh },
                  { nhan: 'Nơi ĐKTT', giaTri: t.noi_dktt },
                  { nhan: 'Địa danh mới', giaTri: t.dktt_moi, mau: C.primary },
                  { nhan: 'Tội danh', giaTri: t.toi_danh },
                ]}
              />
            </Pressable>
          ))}
          {rows.length > 0 && rows.length < tong && (
            <Btn kind="ghost" title={`Tải thêm (${Number(tong - rows.length).toLocaleString('vi-VN')} còn lại)`} loading={loading} onPress={() => tim(rows.length)} />
          )}
        </>
      )}
    </KeyboardScroll>
  );
}

const st = StyleSheet.create({
  segment: { flexDirection: 'row', margin: 12, backgroundColor: '#e2e8f0', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  segOn: { backgroundColor: C.primary },
  segText: { fontSize: 13.5, fontWeight: '600', color: C.text },
  item: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderTopWidth: 3, borderTopColor: C.danger, elevation: 1 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  ten: { fontSize: 16, fontWeight: '700', color: C.text },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 10, elevation: 1 },
  hang: { flexDirection: 'row', gap: 10 },
  oLabel: { fontSize: 12, color: C.muted, marginBottom: 4 },
  oInput: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14.5, color: C.text, backgroundColor: '#fff' },
  nutTim: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  nutXoa: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.danger, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  nangCao: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  ketQua: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 8 },
});
