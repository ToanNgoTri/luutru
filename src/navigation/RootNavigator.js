import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import notifee, { EventType } from '@notifee/react-native';
import { C, Icon } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { navigate } from './navRef';
import { dismissGiaHan, requestNotifyPermission, syncReminders } from '../lib/reminders';

import ChonVaiTroScreen from '../screens/auth/ChonVaiTroScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import HoanTatHoSoScreen from '../screens/auth/HoanTatHoSoScreen';
import ChoCapQuyenScreen from '../screens/auth/ChoCapQuyenScreen';
import { demCanhBaoMoi, hoSoDayDu } from '../lib/api';
import { batDauPush, ROLE_NHAN_PUSH } from '../lib/push';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ScanCccdScreen from '../screens/common/ScanCccdScreen';
import HomeDanScreen from '../screens/dan/HomeDanScreen';
import CoSoFormScreen from '../screens/dan/CoSoFormScreen';
import LapThongBaoScreen from '../screens/dan/LapThongBaoScreen';
import LichSuScreen from '../screens/common/LichSuScreen';
import ThongBaoDetailScreen from '../screens/common/ThongBaoDetailScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import ChoDuyetScreen from '../screens/canbo/ChoDuyetScreen';
import PhanCongScreen from '../screens/admin/PhanCongScreen';
import TruyNaScreen from '../screens/canbo/TruyNaScreen';
import CanhBaoDetailScreen from '../screens/canbo/CanhBaoDetailScreen';
import TruyNaDetailScreen from '../screens/canbo/TruyNaDetailScreen';
import TraCuuTruyNaScreen from '../screens/dan/TraCuuTruyNaScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const header = { headerStyle: { backgroundColor: C.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } };
// Ionicons: đang chọn = icon đặc, không chọn = icon viền
const icon = ten => ({ color, focused, size }) => <Icon name={focused ? ten : `${ten}-outline`} size={size ?? 22} color={color} />;

function Tabs() {
  const { role, isAdmin } = useAuth();
  const tabOpts = { ...header, tabBarActiveTintColor: C.primary };
  if (role === 'nguoi_dan') {
    return (
      <Tab.Navigator screenOptions={tabOpts}>
        <Tab.Screen name="HomeDan" component={HomeDanScreen} options={{ title: 'Lưu trú', tabBarIcon: icon('home') }} />
        <Tab.Screen name="LichSu" component={LichSuScreen} options={{ title: 'Lịch sử', tabBarIcon: icon('time') }} />
        <Tab.Screen name="TraCuuTruyNa" component={TraCuuTruyNaScreen} options={{ title: 'Tra cứu truy nã', tabBarLabel: 'Truy nã', tabBarIcon: icon('finger-print') }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Tài khoản', tabBarIcon: icon('settings') }} />
      </Tab.Navigator>
    );
  }
  return <CanBoTabs isAdmin={isAdmin} tabOpts={tabOpts} />;
}

// Tab của cán bộ / phó trưởng / trưởng CA / dev — tab Truy nã có số cảnh báo chưa xử lý
function CanBoTabs({ isAdmin, tabOpts }) {
  const [soCanhBao, setSoCanhBao] = useState(0);
  const dem = useCallback(() => { demCanhBaoMoi().then(setSoCanhBao).catch(() => {}); }, []);
  useEffect(() => {
    dem();
    const sub = AppState.addEventListener('change', st => st === 'active' && dem());
    const t = setInterval(dem, 60_000);
    return () => { sub.remove(); clearInterval(t); };
  }, [dem]);

  return (
    <Tab.Navigator screenOptions={tabOpts} screenListeners={{ focus: dem }}>
      <Tab.Screen name="ChoDuyet" component={ChoDuyetScreen} options={{ title: 'Chờ xác nhận', tabBarIcon: icon('file-tray-full') }} />
      <Tab.Screen
        name="TruyNa"
        component={TruyNaScreen}
        options={{
          title: 'Truy nã',
          tabBarIcon: icon('finger-print'),
          tabBarBadge: soCanhBao > 0 ? soCanhBao : undefined,
        }}
      />
      <Tab.Screen name="LichSu" component={LichSuScreen} options={{ title: isAdmin ? 'Lịch sử' : 'Lịch sử nhóm', tabBarIcon: icon('time') }} />
      {isAdmin && <Tab.Screen name="PhanCong" component={PhanCongScreen} options={{ title: 'Phân công', tabBarIcon: icon('people') }} />}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Tài khoản', tabBarIcon: icon('settings') }} />
    </Tab.Navigator>
  );
}

// Nhấn thông báo nhắc gia hạn → mở màn gia hạn với danh sách cũ
function useNotificationRouting(enabled) {
  useEffect(() => {
    if (!enabled) return;
    const handle = async detail => {
      const d = detail.notification?.data || {};
      const action = detail.pressAction?.id;
      if (d.kind === 'gia_han') {
        if (action === 'khong_gia_han') return dismissGiaHan(Number(d.thongBaoId));
        navigate('LapThongBao', { coSoId: Number(d.coSoId), giaHanTu: Number(d.thongBaoId) });
      } else if (d.kind === 'truy_na' && d.canhBaoId) {
        navigate('CanhBaoDetail', { id: Number(d.canhBaoId) });
      } else if (d.id) {
        navigate('ThongBaoDetail', { id: Number(d.id) });
      }
    };
    notifee.getInitialNotification().then(n => n && handle(n));
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) handle(detail);
    });
  }, [enabled]);
}

export default function RootNavigator() {
  const { ready, session, profile, user } = useAuth();
  // đăng nhập + hồ sơ đủ + không còn chờ duyệt cán bộ → vào app
  const hoSoDu = hoSoDayDu(profile);
  // chọn Cán bộ: chưa gửi (_xinCanBo → chọn đơn vị + chức vụ) hoặc đang chờ Trưởng CA / dev duyệt
  const choDuyetCanBo = hoSoDu && profile.role === 'nguoi_dan' && (profile.yeu_cau_can_bo || profile._xinCanBo);
  const loggedIn = !!session && !!profile && hoSoDu && !choDuyetCanBo;

  useEffect(() => {
    if (!loggedIn) return;
    requestNotifyPermission();
    if (profile.role !== 'nguoi_dan') return;
    // đồng bộ lại lịch nhắc mỗi khi app quay lại
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') syncReminders(user.id).catch(() => {});
    });
    return () => sub.remove();
  }, [loggedIn, profile?.role, user?.id]);

  useNotificationRouting(loggedIn);

  // Push cảnh báo truy nã: chỉ cán bộ / Trưởng, Phó CA / dev đăng ký token
  useEffect(() => {
    if (!loggedIn || !ROLE_NHAN_PUSH.includes(profile?.role)) return;
    let huy = () => {};
    batDauPush(profile.role, data => {
      if (data.kind === 'truy_na' && data.canhBaoId) navigate('CanhBaoDetail', { id: Number(data.canhBaoId) });
    }).then(f => { huy = f; });
    return () => huy();
  }, [loggedIn, profile?.role]);

  if (!ready || (session && !profile)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={header}>
      {!session ? (
        <>
          <Stack.Screen name="ChonVaiTro" component={ChonVaiTroScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: '' }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Tạo tài khoản' }} />
          <Stack.Screen name="ScanCccd" component={ScanCccdScreen} options={{ headerShown: false }} />
        </>
      ) : !hoSoDu ? (
        <>
          <Stack.Screen name="HoanTatHoSo" component={HoanTatHoSoScreen} options={{ title: 'Hoàn tất hồ sơ' }} />
          <Stack.Screen name="ScanCccd" component={ScanCccdScreen} options={{ headerShown: false }} />
        </>
      ) : choDuyetCanBo ? (
        <Stack.Screen name="ChoCapQuyen" component={ChoCapQuyenScreen} options={{ title: profile?.yeu_cau_can_bo ? 'Chờ duyệt' : 'Chọn đơn vị công tác' }} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="CoSoForm" component={CoSoFormScreen} options={{ title: 'Cơ sở lưu trú' }} />
          <Stack.Screen name="LapThongBao" component={LapThongBaoScreen} options={{ title: 'Lập thông báo lưu trú' }} />
          <Stack.Screen name="ScanCccd" component={ScanCccdScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ThongBaoDetail" component={ThongBaoDetailScreen} options={{ title: 'Chi tiết thông báo' }} />
          <Stack.Screen name="CanhBaoDetail" component={CanhBaoDetailScreen} options={{ title: 'Cảnh báo truy nã', headerStyle: { backgroundColor: C.danger } }} />
          <Stack.Screen name="TruyNaDetail" component={TruyNaDetailScreen} options={{ title: 'Đối tượng truy nã' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
