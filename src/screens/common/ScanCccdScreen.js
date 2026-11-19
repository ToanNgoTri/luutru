import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { Btn, C } from '../../components/ui';
import { isoToVn, parseCccdQr } from '../../lib/cccd';
import { addNguoi, removeNguoi, useDraft } from '../../lib/draftStore';

const MSG_MAC_DINH = 'Đưa mã QR trên CCCD vào khung';

/**
 * mode = 'draft' (mặc định): quét liên tục, mỗi CCCD thêm vào danh sách nháp (chống trùng),
 *   nửa dưới màn hình hiện luôn danh sách người đã quét, bỏ được người quét nhầm.
 * mode = 'self': quét 1 lần rồi trả kết quả về route.params.returnTo (màn Đăng ký / Hoàn tất hồ sơ).
 */
export default function ScanCccdScreen({ navigation, route }) {
  const mode = route.params?.mode || 'draft';
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const draft = useDraft();
  const [msg, setMsg] = useState({ text: MSG_MAC_DINH, color: '#fff' });
  const [torch, setTorch] = useState(false);
  const [moiNhat, setMoiNhat] = useState(null); // CCCD vừa thêm → tô sáng trong danh sách
  const lock = useRef(false);
  const lastValue = useRef('');
  const listRef = useRef(null);

  // Kích thước vùng camera + khung — tính cụ thể, không dựa vào căn giữa tự động
  const { width, height } = useWindowDimensions();
  const camH = mode === 'draft' ? Math.round(Math.min(height * 0.5, width * 1.05)) : height;
  const FRAME = Math.min(240, Math.round(width * 0.62), camH - 110); // chừa chỗ dòng chữ dưới khung
  const frameTop = mode === 'draft'
    ? insets.top + Math.round((camH - FRAME) / 2) - 16 // vùng camera = insets.top + camH
    : Math.round((height - FRAME) / 2) - 40;
  const frameLeft = Math.round((width - FRAME) / 2);

  // Camera chỉ chạy khi màn đang hiển thị VÀ app ở foreground.
  // Ra nền mà camera vẫn isActive → Android thu hồi camera, quay lại báo "camera is restricted".
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [camKey, setCamKey] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      const active = st === 'active';
      setAppActive(active);
      if (active) setCamKey(k => k + 1); // gắn lại camera mới khi quay về app
    });
    return () => sub.remove();
  }, []);
  const camActive = isFocused && appActive;

  // Lỗi camera bị hệ thống chiếm/thu hồi: thử mở lại, không hiện lỗi
  const onCameraError = useCallback(e => {
    console.warn('camera', e?.code, e?.message);
    if (/restricted|in-use|disconnected/i.test(`${e?.code} ${e?.message}`)) {
      setTimeout(() => {
        if (AppState.currentState === 'active') setCamKey(k => k + 1);
      }, 600);
    }
  }, []);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useFocusEffect(useCallback(() => () => { lock.current = false; }, []));

  const flash = (text, color, ms = 1400) => {
    setMsg({ text, color });
    lock.current = true;
    setTimeout(() => {
      lock.current = false;
      setMsg({ text: 'Đưa CCCD tiếp theo vào khung', color: '#fff' });
    }, ms);
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (lock.current || !codes.length) return;
      const value = codes[0].value || '';
      if (value === lastValue.current && mode === 'draft') return; // thẻ cũ vẫn còn trong khung
      const p = parseCccdQr(value);
      if (!p) return flash('Không phải mã QR CCCD', '#fca5a5', 1000);
      lastValue.current = value;
      if (mode === 'self') {
        lock.current = true;
        navigation.navigate({ name: route.params.returnTo, params: { scanned: p }, merge: true });
        return;
      }
      if (addNguoi(p)) {
        flash(`✓ Đã thêm: ${p.ho_ten}`, '#86efac');
        setMoiNhat(p.cccd);
        setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
      } else {
        flash(`${p.ho_ten} đã có trong danh sách`, '#fde68a');
        setMoiNhat(p.cccd);
      }
    },
  });

  const bo = p =>
    Alert.alert('Bỏ khỏi danh sách?', `${p.ho_ten} — ${p.cccd}`, [
      { text: 'Huỷ' },
      {
        text: 'Bỏ',
        style: 'destructive',
        onPress: () => {
          removeNguoi(p.cccd);
          if (lastValue.current.startsWith(p.cccd)) lastValue.current = ''; // cho quét lại thẻ đó
        },
      },
    ]);

  if (!hasPermission) {
    return (
      <View style={st.center}>
        <Text style={{ color: '#fff', marginBottom: 16, textAlign: 'center' }}>App cần quyền camera để quét CCCD</Text>
        <Btn title="Cấp quyền camera" onPress={async () => { if (!(await requestPermission())) Linking.openSettings(); }} />
      </View>
    );
  }
  if (!device) return <View style={st.center}><Text style={{ color: '#fff' }}>Không tìm thấy camera</Text></View>;

  // người mới quét lên đầu
  const ds = [...draft.nguoi].reverse();

  return (
    <View style={{ flex: 1, backgroundColor: mode === 'draft' ? C.bg : '#000' }}>
      {/* ---- Vùng camera ---- */}
      <View style={{ height: camH + (mode === 'draft' ? insets.top : 0), backgroundColor: '#000', overflow: 'hidden' }}>
        <Camera
          key={camKey}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={camActive}
          codeScanner={codeScanner}
          torch={camActive && torch ? 'on' : 'off'}
          onError={onCameraError}
        />
        <View pointerEvents="none" style={{ position: 'absolute', top: frameTop, left: frameLeft, width: FRAME, height: FRAME }}>
          <View style={[st.corner, st.tl]} />
          <View style={[st.corner, st.tr]} />
          <View style={[st.corner, st.bl]} />
          <View style={[st.corner, st.br]} />
        </View>
        <Text pointerEvents="none" style={[st.msg, { top: frameTop + FRAME + 12, color: msg.color }]} numberOfLines={2}>
          {msg.text}
        </Text>
        <Pressable onPress={() => setTorch(t => !t)} style={[st.torch, { top: insets.top + 10 }]} hitSlop={8}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{torch ? '🔦 Tắt đèn' : '🔦 Bật đèn'}</Text>
        </Pressable>
        {mode === 'self' && (
          <View style={[st.selfBottom, { bottom: insets.bottom + 20 }]}>
            <Btn title="Huỷ" onPress={() => navigation.goBack()} />
          </View>
        )}
      </View>

      {/* ---- Danh sách đã quét (chỉ khi lập thông báo) ---- */}
      {mode === 'draft' && (
        <View style={{ flex: 1 }}>
          <View style={st.listHeader}>
            <Text style={st.listTitle}>Đã quét: {ds.length} người</Text>
            {ds.length > 0 && <Text style={{ color: C.muted, fontSize: 12 }}>Chạm ✕ để bỏ người quét nhầm</Text>}
          </View>
          <FlatList
            ref={listRef}
            data={ds}
            keyExtractor={p => p.cccd}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
            ListEmptyComponent={<Text style={st.empty}>Chưa có ai. Đưa mã QR ở mặt trước CCCD vào khung phía trên.</Text>}
            renderItem={({ item: p, index }) => (
              <View style={[st.row, p.cccd === moiNhat && st.rowNew]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.name} numberOfLines={1}>{ds.length - index}. {p.ho_ten}</Text>
                  <Text style={st.sub}>CCCD {p.cccd} · {isoToVn(p.ngay_sinh)}{p.gioi_tinh ? ` · ${p.gioi_tinh}` : ''}</Text>
                  {!!p.dia_chi && <Text style={st.sub} numberOfLines={1}>{p.dia_chi}</Text>}
                </View>
                <Pressable onPress={() => bo(p)} hitSlop={12} style={{ padding: 8 }}>
                  <Text style={{ color: C.danger, fontSize: 20 }}>✕</Text>
                </Pressable>
              </View>
            )}
          />
          <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 10 }}>
            <Btn title={ds.length ? `Xong (${ds.length} người)` : 'Xong'} onPress={() => navigation.goBack()} />
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: '#fff' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  msg: { position: 'absolute', left: 16, right: 16, fontSize: 15, fontWeight: '600', textAlign: 'center', textShadowColor: '#000', textShadowRadius: 4 },
  torch: { position: 'absolute', right: 12, backgroundColor: '#0008', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  selfBottom: { position: 'absolute', left: 24, right: 24 },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  listTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  empty: { textAlign: 'center', color: C.muted, marginTop: 20, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 8, paddingLeft: 12, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  rowNew: { borderColor: C.ok, backgroundColor: '#f0fdf4' },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  sub: { fontSize: 12.5, color: C.muted },
});
