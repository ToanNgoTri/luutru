import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { C, s } from './ui';
import { UNITS, fold, unitName } from '../lib/units';
import { supabase } from '../lib/supabase';

/**
 * Chọn 1 trong 95 xã/phường Đồng Nai (giống UnitSelect của PlanRegister): ô tìm không phân biệt dấu.
 * onChange(id). `tatCa` = thêm dòng "Tất cả đơn vị" (hoặc chuỗi tuỳ ý, value '') — dùng cho bộ lọc của dev.
 */
export default function UnitSelect({
  value,
  onChange,
  disabled,
  placeholder = 'Chọn xã / phường',
  tatCa,
  style,
}) {
  const [open, setOpen] = useState(false);
  const tenTatCa = typeof tatCa === 'string' ? tatCa : 'Tất cả đơn vị';
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const k = fold(q.trim());
    const ds = k ? UNITS.filter(u => fold(u.name).includes(k)) : UNITS;
    return tatCa && !k ? [{ id: '', name: tenTatCa }, ...ds] : ds;
  }, [q, tatCa, tenTatCa]);
  const close = () => {
    setOpen(false);
    setQ('');
  };
  const label = value ? unitName(value) : tatCa ? tenTatCa : '';

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          s.input,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          disabled && { backgroundColor: C.bg },
          style,
        ]}
      >
        <Text
          style={{ fontSize: 16, color: label ? C.text : '#94a3b8', flex: 1 }}
        >
          {label || placeholder}
        </Text>
        {!disabled && <Text style={{ color: C.muted }}>▾</Text>}
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: '#0008',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={close}
        >
          <Pressable
            style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              padding: 12,
              height: '75%',
            }}
          >
            <Text style={[s.title, { marginBottom: 8 }]}>Chọn đơn vị</Text>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Tìm xã / phường… (gõ không dấu được)"
              placeholderTextColor="#94a3b8"
              autoCorrect={false}
              style={[s.input, { marginBottom: 8 }]}
            />
            <FlatList
              data={items}
              keyExtractor={u => u.id || 'all'}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={20}
              ListEmptyComponent={
                <Text style={[s.muted, { textAlign: 'center', padding: 16 }]}>
                  Không có đơn vị phù hợp.
                </Text>
              }
              renderItem={({ item }) => {
                const chon = item.id === (value || '');
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.id);
                      close();
                    }}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      flexDirection: 'row',
                      backgroundColor: chon ? C.bg : undefined,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        color: chon ? C.primary : C.text,
                        fontWeight: chon ? '700' : '400',
                      }}
                    >
                      {item.name}
                    </Text>
                    {chon && (
                      <Text style={{ color: C.primary, fontWeight: '700' }}>
                        ✓
                      </Text>
                    )}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * Đơn vị đã có Trưởng CA / Cán bộ (admin) chưa (không tính chính mình)? { truong_ca, admin } — null = chưa biết.
 * RPC don_vi_da_co chỉ trả true/false, gọi được cả khi chưa đăng nhập.
 */
export function useDaCo(donViId) {
  const [co, setCo] = useState({ truong_ca: null, admin: null });
  useEffect(() => {
    let huy = false;
    setCo({ truong_ca: null, admin: null });
    if (!donViId) return;
    Promise.all(
      ['truong_ca', 'admin'].map(cv =>
        supabase.rpc('don_vi_da_co', { p_don_vi: donViId, p_chuc_vu: cv }).then(({ data, error }) => (error ? null : !!data)),
      ),
    ).then(([truong_ca, admin]) => {
      if (!huy) setCo({ truong_ca, admin });
    });
    return () => {
      huy = true;
    };
  }, [donViId]);
  return co;
}

/** Ai duyệt yêu cầu vào đơn vị này (mọi chức vụ): Trưởng CA hoặc Cán bộ (admin) của đơn vị đó, hoặc Quản trị tỉnh */
export function nguoiDuyet(chucVu, donViId) {
  return `Trưởng CA hoặc Cán bộ (admin) ${unitName(donViId)}`;
}

/**
 * Chọn chức vụ khi xin vào đơn vị (giống PositionSelect của PlanRegister).
 * Trưởng CA / Cán bộ (admin) mỗi đơn vị 1 người: đã có → ẩn (đang chọn thì tự về "Cán bộ").
 * nhanNgay = người đang là cán bộ CỦA đơn vị này → chọn admin (đang khuyết) được nhận ngay, không cần duyệt.
 */
export function ChucVuSelect({ value, onChange, donViId, nhanNgay }) {
  const daCo = useDaCo(donViId);
  useEffect(() => {
    if (daCo[value]) onChange('can_bo');
  }, [daCo, value, onChange]);
  const ds = CHUC_VU.filter(cv => !daCo[cv.id]);
  const daCoTen = CHUC_VU.filter(cv => daCo[cv.id]).map(cv => cv.label);
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {ds.map(cv => (
          <Pressable
            key={cv.id}
            onPress={() => onChange(cv.id)}
            style={[
              s.chip,
              value === cv.id && {
                backgroundColor: C.primary,
                borderColor: C.primary,
              },
            ]}
          >
            <Text
              style={{ color: value === cv.id ? '#fff' : C.text, fontSize: 14 }}
            >
              {cv.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {daCoTen.length > 0 && (
        <Text style={[s.muted, { marginTop: 6 }]}>Đơn vị này đã có {daCoTen.join(' và ')}.</Text>
      )}
      {value === 'admin' && (
        <Text style={[s.muted, { marginTop: 6, color: C.warn }]}>
          Cán bộ (admin) quản trị đơn vị này (mỗi đơn vị 1 người).{' '}
          {nhanNgay ? 'Bạn đang là cán bộ đơn vị này → nhận ngay, không cần duyệt.' : `Yêu cầu do ${nguoiDuyet('admin', donViId)} duyệt.`}
        </Text>
      )}
      {value === 'truong_ca' && (
        <Text style={[s.muted, { marginTop: 6, color: C.warn }]}>
          Yêu cầu làm Trưởng CA do {nguoiDuyet('truong_ca', donViId)} duyệt.
        </Text>
      )}
    </View>
  );
}

export const CHUC_VU = [
  { id: 'can_bo', label: 'Cán bộ' },
  { id: 'pho_truong', label: 'Phó Trưởng CA' },
  { id: 'truong_ca', label: 'Trưởng CA' },
  { id: 'admin', label: 'Cán bộ (admin)' }, // quản trị 1 đơn vị, mỗi đơn vị 1 người
];
