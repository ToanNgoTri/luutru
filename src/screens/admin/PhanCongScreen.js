import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Btn, C, Card, Chip, Empty, Field, KeyboardScroll, NutGoi, ROLE_LABEL, s } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import {
  deleteNhom, findProfileByCccd, giaoChuc, listCanBo, listCoSoQuanLy, listNhom, listYeuCauCanBo, saveNhom, setCoSoNhom, setRole,
  xuLyYeuCauCanBo,
} from '../../lib/api';
import { isCccd } from '../../lib/cccd';
import UnitSelect, { CHUC_VU, nguoiDuyet } from '../../components/UnitSelect';
import { unitName } from '../../lib/units';

const tenChucVu = id => CHUC_VU.find(c => c.id === id)?.label || 'Cán bộ';

// Trưởng / Phó Trưởng CA: nhóm cơ sở, giao cán bộ, xếp cơ sở — CHỈ trong đơn vị mình (RLS chặn đơn vị khác).
// Trưởng CA + dev: thêm tab Vai trò (duyệt người mới vào đơn vị, cấp/thu Cán bộ, Phó). Dev: lọc mọi đơn vị.
export default function PhanCongScreen() {
  const { isDev, canCapQuyen, donViId } = useAuth();
  const [tab, setTab] = useState('nhom');
  const [locDv, setLocDv] = useState(isDev ? '' : donViId || '');
  if (!isDev && !donViId) return <Empty text="Tài khoản của bạn chưa gắn đơn vị (xã/phường). Nhờ Quản trị tỉnh (dev) gắn đơn vị." />;
  return (
    <View style={s.screen}>
      <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
        {isDev
          ? <UnitSelect value={locDv} onChange={setLocDv} tatCa />
          : <Text style={[s.title, { color: C.primaryDark }]}>{unitName(donViId)}</Text>}
      </View>
      <View style={[s.row, { padding: 12, paddingBottom: 0 }]}>
        <Chip label="Nhóm & cán bộ" active={tab === 'nhom'} onPress={() => setTab('nhom')} />
        <Chip label="Cơ sở" active={tab === 'coso'} onPress={() => setTab('coso')} />
        {canCapQuyen && <Chip label="Vai trò" active={tab === 'role'} onPress={() => setTab('role')} />}
      </View>
      {tab === 'nhom' && <NhomTab locDv={locDv} />}
      {tab === 'coso' && <CoSoTab locDv={locDv} />}
      {tab === 'role' && canCapQuyen && <RoleTab locDv={locDv} />}
    </View>
  );
}

function Picker({ visible, title, items, onPick, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, maxHeight: '75%' }}>
          <Text style={[s.title, { padding: 16 }]}>{title}</Text>
          <ScrollView>
            {items.map(it => (
              <Pressable key={String(it.value)} onPress={() => onPick(it.value)} style={{ padding: 14, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                <Text style={s.text}>{it.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

function NhomTab({ locDv }) {
  const { isDev } = useAuth();
  const [nhom, setNhom] = useState([]);
  const [canBo, setCanBo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState(null); // {id?, ten, can_bo_id}
  const [pick, setPick] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, c] = await Promise.all([listNhom(), listCanBo()]);
      setNhom(n);
      setCanBo(c);
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save() {
    if (!edit.ten.trim()) return Alert.alert('Nhập tên nhóm');
    if (isDev && !edit.don_vi_id) return Alert.alert('Chọn đơn vị cho nhóm');
    try {
      await saveNhom({ ...edit, ten: edit.ten.trim() });
      setEdit(null);
      load();
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    }
  }

  const xoa = n =>
    Alert.alert('Xoá nhóm?', `${n.ten} — các cơ sở trong nhóm sẽ thành "chưa phân nhóm".`, [
      { text: 'Huỷ' },
      { text: 'Xoá', style: 'destructive', onPress: async () => { try { await deleteNhom(n.id); load(); } catch (e) { Alert.alert('Lỗi', e.message); } } },
    ]);

  const tenCanBo = id => canBo.find(c => c.id === id)?.ho_ten;
  const dsNhom = locDv ? nhom.filter(n => n.don_vi_id === locDv) : nhom;
  // chỉ giao được cán bộ CÙNG đơn vị với nhóm (trigger guard_nhom cũng chặn)
  const canBoCungDv = canBo.filter(c => !edit?.don_vi_id || c.don_vi_id === edit.don_vi_id);

  return (
    <ScrollView contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Btn title="+ Tạo nhóm cơ sở" onPress={() => setEdit({ ten: '', can_bo_id: null, don_vi_id: locDv || null })} style={{ marginBottom: 12 }} />
      {!loading && !dsNhom.length && <Empty text="Chưa có nhóm. Tạo nhóm (vd: Ấp Hàng Gòn) rồi giao cho cán bộ phụ trách." />}
      {dsNhom.map(n => (
        <Card key={n.id}>
          <Text style={s.title}>{n.ten}</Text>
          <Text style={s.muted}>Cán bộ: {n.can_bo?.ho_ten || '— chưa giao —'} · {n.co_so?.[0]?.count ?? 0} cơ sở</Text>
          {isDev && !locDv && <Text style={s.muted}>{n.don_vi_id ? unitName(n.don_vi_id) : 'Chưa gắn đơn vị'}</Text>}
          <View style={[s.row, { gap: 8, marginTop: 10 }]}>
            <Btn small kind="ghost" title="Sửa / giao cán bộ" onPress={() => setEdit({ id: n.id, ten: n.ten, can_bo_id: n.can_bo_id, don_vi_id: n.don_vi_id })} style={{ flex: 1 }} />
            <Btn small kind="danger" title="Xoá" onPress={() => xoa(n)} />
          </View>
        </Card>
      ))}

      <Modal visible={!!edit} animationType="slide" onRequestClose={() => setEdit(null)}>
        {edit && (
          <KeyboardScroll contentContainerStyle={s.pad}>
            <Text style={[s.title, { fontSize: 18, marginBottom: 12 }]}>{edit.id ? 'Sửa nhóm' : 'Tạo nhóm'}</Text>
            <Field label="Tên nhóm" value={edit.ten} onChangeText={t => setEdit(o => ({ ...o, ten: t }))} />
            {isDev && (
              <>
                <Text style={s.label}>Đơn vị</Text>
                <UnitSelect value={edit.don_vi_id} onChange={v => setEdit(o => ({ ...o, don_vi_id: v, can_bo_id: null }))} disabled={!!edit.id && !!edit.don_vi_id} style={{ marginBottom: 12 }} />
              </>
            )}
            <Text style={s.label}>Cán bộ phụ trách</Text>
            <Btn kind="ghost" title={tenCanBo(edit.can_bo_id) || 'Chọn cán bộ…'} onPress={() => setPick(true)} style={{ marginBottom: 6 }} />
            <Text style={[s.muted, { marginBottom: 16 }]}>Chưa thấy người cần giao? Trưởng CA duyệt / cấp vai trò ở tab Vai trò trước (chỉ hiện cán bộ cùng đơn vị).</Text>
            <Btn title="Lưu" onPress={save} />
            <View style={{ height: 10 }} />
            <Btn title="Đóng" kind="ghost" onPress={() => setEdit(null)} />
            <Picker
              visible={pick}
              title="Chọn cán bộ phụ trách"
              items={[{ value: null, label: '— Bỏ giao —' }, ...canBoCungDv.map(c => ({ value: c.id, label: `${c.ho_ten} (${ROLE_LABEL[c.role]})` }))]}
              onPick={v => { setEdit(o => ({ ...o, can_bo_id: v })); setPick(false); }}
              onClose={() => setPick(false)}
            />
          </KeyboardScroll>
        )}
      </Modal>
    </ScrollView>
  );
}

function CoSoTab({ locDv }) {
  const { isDev } = useAuth();
  const [coSo, setCoSo] = useState([]);
  const [nhom, setNhom] = useState([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState(null);
  const [chiChuaPhan, setChiChuaPhan] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, n] = await Promise.all([listCoSoQuanLy(), listNhom()]);
      setCoSo(c);
      setNhom(n);
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const trongDv = locDv ? coSo.filter(c => c.don_vi_id === locDv) : coSo;
  const data = chiChuaPhan ? trongDv.filter(c => !c.nhom_id) : trongDv;

  return (
    <ScrollView contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <View style={[s.row, { marginBottom: 12 }]}>
        <Chip label="Tất cả" active={!chiChuaPhan} onPress={() => setChiChuaPhan(false)} />
        <Chip label={`Chưa phân nhóm (${trongDv.filter(c => !c.nhom_id).length})`} active={chiChuaPhan} onPress={() => setChiChuaPhan(true)} />
      </View>
      {!loading && !data.length && <Empty text="Không có cơ sở." />}
      {data.map(c => (
        <Card key={c.id} onPress={() => setTarget(c)}>
          <Text style={s.title}>{c.ten}</Text>
          <Text style={s.muted}>Nơi lưu trú: {c.dia_chi}</Text>
          {isDev && !locDv && <Text style={s.muted}>{c.don_vi_id ? unitName(c.don_vi_id) : 'Chưa chọn xã/phường'}</Text>}
          <Text style={s.muted}>Chủ: {c.chu?.ho_ten} · {c.chu?.cccd}{c.chu?.sdt ? ` · ${c.chu.sdt}` : ''}</Text>
          <Text style={{ marginTop: 4, color: c.nhom ? C.primary : C.warn }}>Nhóm: {c.nhom?.ten || 'chưa phân'} — chạm để đổi</Text>
          <NutGoi sdt={c.chu?.sdt} title="Gọi chủ cơ sở" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Card>
      ))}
      <Picker
        visible={!!target}
        title={`Xếp "${target?.ten}" vào nhóm`}
        items={[{ value: null, label: '— Bỏ khỏi nhóm —' }, ...nhom.filter(n => n.don_vi_id === target?.don_vi_id).map(n => ({ value: n.id, label: `${n.ten}${n.can_bo ? ` (${n.can_bo.ho_ten})` : ''}` }))]}
        onPick={async v => {
          const c = target;
          setTarget(null);
          try { await setCoSoNhom(c.id, v); load(); } catch (e) { Alert.alert('Lỗi', e.message); }
        }}
        onClose={() => setTarget(null)}
      />
    </ScrollView>
  );
}

// Danh sách người chọn "Cán bộ" lúc vào app, chờ duyệt
function YeuCauCanBo({ locDv }) {
  const { role: myRole } = useAuth();
  // Trưởng CA, Cán bộ (admin) của đơn vị và Quản trị tỉnh duyệt được mọi chức vụ
  const duocDuyet = cv => ['truong_ca', 'admin', 'dev'].includes(myRole);
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => {
    try { setRows(await listYeuCauCanBo()); } catch (e) { Alert.alert('Lỗi', e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const xuLy = (p, dongY) =>
    Alert.alert(dongY ? `Duyệt làm ${tenChucVu(p.yeu_cau_chuc_vu)}?` : 'Từ chối yêu cầu?', `${p.ho_ten} · CCCD ${p.cccd}\n${unitName(p.don_vi_id)}`, [
      { text: 'Huỷ' },
      {
        text: dongY ? 'Duyệt' : 'Từ chối',
        style: dongY ? 'default' : 'destructive',
        onPress: async () => { try { await xuLyYeuCauCanBo(p, dongY); load(); } catch (e) { Alert.alert('Lỗi', e.message); } },
      },
    ]);

  const ds = locDv ? rows.filter(p => p.don_vi_id === locDv) : rows;
  if (!ds.length) return null;
  return (
    <>
      <Text style={[s.h2, { color: C.warn, marginTop: 0 }]}>Chờ duyệt vào đơn vị ({ds.length})</Text>
      {ds.map(p => (
        <Card key={p.id} style={{ borderLeftWidth: 4, borderLeftColor: C.warn }}>
          <Text style={s.title}>{p.ho_ten}</Text>
          <Text style={s.muted}>CCCD {p.cccd}{p.sdt ? ` · ${p.sdt}` : ''}</Text>
          <Text style={[s.text, { marginTop: 2 }]}>Xin làm <Text style={{ fontWeight: '700' }}>{tenChucVu(p.yeu_cau_chuc_vu)}</Text> · {unitName(p.don_vi_id)}</Text>
          {!!p.email && p.provider !== 'email' && <Text style={s.muted}>{p.provider === 'apple' ? 'Apple' : p.provider}: {p.email}</Text>}
          {!!p.yeu_cau_luc && <Text style={s.muted}>Gửi lúc {new Date(p.yeu_cau_luc).toLocaleString('vi-VN')}</Text>}
          {!duocDuyet(p.yeu_cau_chuc_vu) ? (
            <Text style={[s.muted, { marginTop: 8, color: C.warn }]}>Xin làm {tenChucVu(p.yeu_cau_chuc_vu)} — chờ {nguoiDuyet(p.yeu_cau_chuc_vu, p.don_vi_id)} duyệt.</Text>
          ) : (
            <View style={[s.row, { gap: 8, marginTop: 10 }]}>
              <Btn small kind="ok" title={`Duyệt (${tenChucVu(p.yeu_cau_chuc_vu)})`} onPress={() => xuLy(p, true)} style={{ flex: 1 }} />
              <Btn small kind="danger" title="Từ chối" onPress={() => xuLy(p, false)} />
            </View>
          )}
          <NutGoi sdt={p.sdt} title="Gọi xác minh" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Card>
      ))}
      <View style={{ height: 12 }} />
    </>
  );
}

function RoleTab({ locDv }) {
  const { user, isDev, role: myRole, donViId: myDv, reloadProfile } = useAuth();
  const [cccd, setCccd] = useState('');
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  // Trưởng CA / Cán bộ (admin): mọi chức vụ trong đơn vị (giao Trưởng CA / admin = chuyển giao). Quản trị tỉnh: thêm dev.
  const roles = isDev
    ? ['nguoi_dan', 'can_bo', 'pho_truong', 'truong_ca', 'admin', 'dev']
    : ['nguoi_dan', 'can_bo', 'pho_truong', 'truong_ca', 'admin'];
  const [dv, setDv] = useState('');

  async function tim() {
    if (!isCccd(cccd)) return Alert.alert('Số CCCD phải đủ 12 chữ số');
    setBusy(true);
    try {
      const r = await findProfileByCccd(cccd);
      if (!r) Alert.alert('Không tìm thấy', 'Người này chưa tạo tài khoản trong app.');
      setP(r);
      setDv(r?.don_vi_id || locDv || '');
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doi(r) {
    if (p.id === user.id) return Alert.alert('Không tự đổi vai trò của chính mình');
    if (!isDev && p.role === 'dev') return Alert.alert('Chỉ Quản trị tỉnh (dev) được đổi vai trò này');
    if (isDev && ['can_bo', 'pho_truong', 'truong_ca', 'admin'].includes(r) && !dv) return Alert.alert('Chọn đơn vị cho người này trước');
    if (r === p.role) return;
    if (['truong_ca', 'admin'].includes(r)) {
      // chuyển giao: người đang giữ chức (kể cả mình) về Cán bộ
      return Alert.alert(
        `Giao chức ${ROLE_LABEL[r]}?`,
        `${p.ho_ten} sẽ là ${ROLE_LABEL[r]} ${unitName(isDev ? dv : p.don_vi_id || myDv)}.\nNgười đang giữ chức này (nếu có, kể cả bạn) sẽ chuyển về Cán bộ.`,
        [
          { text: 'Huỷ', style: 'cancel' },
          {
            text: 'Giao chức',
            onPress: async () => {
              try {
                await giaoChuc(p.id, r, isDev ? dv : null);
                setP({ ...p, role: r, don_vi_id: isDev ? dv : myDv });
                if (!isDev && myRole === r) reloadProfile(); // mình vừa chuyển giao chức của mình
              } catch (e) {
                Alert.alert('Lỗi', e.message);
              }
            },
          },
        ],
      );
    }
    try {
      const kq = await setRole(p.id, r, isDev ? dv : null);
      setP({ ...p, role: kq.role, don_vi_id: kq.don_vi_id });
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    }
  }

  return (
    <KeyboardScroll contentContainerStyle={s.pad}>
      <YeuCauCanBo locDv={locDv} />
      <Field label="CCCD người cần cấp vai trò" value={cccd} onChangeText={setCccd} keyboardType="number-pad" maxLength={12} onSubmitEditing={tim} />
      <Btn title="Tìm" onPress={tim} loading={busy} />
      {p && (
        <Card style={{ marginTop: 16 }}>
          <Text style={s.title}>{p.ho_ten}</Text>
          <Text style={s.muted}>CCCD {p.cccd} · Thường trú: {p.dia_chi}</Text>
          <Text style={[s.text, { marginTop: 8 }]}>Vai trò hiện tại: {ROLE_LABEL[p.role]}</Text>
          <Text style={[s.muted, { marginBottom: 8 }]}>Đơn vị: {p.don_vi_id ? unitName(p.don_vi_id) : '— (người dân không thuộc đơn vị) —'}</Text>
          {isDev && (
            <>
              <Text style={s.label}>Đơn vị khi cấp vai trò cán bộ</Text>
              <UnitSelect value={dv} onChange={setDv} style={{ marginBottom: 10 }} />
            </>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {roles.map(r => <Chip key={r} label={ROLE_LABEL[r]} active={p.role === r} onPress={() => doi(r)} />)}
          </View>
        </Card>
      )}
    </KeyboardScroll>
  );
}
