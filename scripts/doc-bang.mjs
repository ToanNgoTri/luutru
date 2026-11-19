/**
 * ĐỌC .xlsx / .csv thành bảng — chiều ngược lại của lib/xuat/xlsx.js.
 *
 * Vì sao tự viết mà không thêm `xlsx`/`exceljs`: gói này phải đóng gói offline
 * (xem scripts/dong-goi.mjs), thêm thư viện là thêm vài MB và thêm một thứ nữa
 * có thể copy thiếu. Một file .xlsx chỉ là ZIP chứa vài file XML, mà Node đã có
 * sẵn `zlib` để bung — đủ dùng.
 *
 * MỌI Ô TRẢ VỀ LÀ CHUỖI. Dữ liệu đọc lên để ĐIỀN VÀO Ô TRÊN WEB, nên số CCCD
 * `075086014547` phải giữ nguyên số 0 đứng đầu, số hiệu `01/2024` không được
 * biến thành ngày. Riêng ô Excel đánh dấu là NGÀY thì đổi về `dd/mm/yyyy` —
 * để nguyên serial `31699` thì điền lên form là sai.
 *
 * Chỉ chạy được ở Node (dùng `node:fs`, `node:zlib`).
 */

import { readFile } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import { basename, extname } from 'node:path'

/**
 * @typedef {object} BangDoc
 * @property {string} tep đường dẫn đã đọc
 * @property {string} sheet tên sheet đã đọc ('' với .csv)
 * @property {string[]} dsSheet mọi sheet có trong file (để UI cho chọn)
 * @property {string[]} cot tên cột, lấy từ dòng đầu
 * @property {Record<string, string>[]} dong các dòng dữ liệu (đã cắt theo khoảng)
 * @property {number} tongDong tổng số dòng dữ liệu TRƯỚC khi cắt khoảng
 */

/**
 * @typedef {object} TuyChonDoc
 * @property {string} [sheet] tên sheet; bỏ trống = sheet đầu tiên
 * @property {number} [dongDau] dòng dữ liệu đầu tiên lấy, đếm từ 1 (không tính
 *   dòng tiêu đề). Bỏ trống = từ đầu. Dùng để chạy tiếp mẻ đang dở.
 * @property {number} [dongCuoi] dòng dữ liệu cuối cùng lấy (bao gồm). Bỏ trống = tới hết.
 * @property {boolean} [boQuaTrong] bỏ các dòng mà mọi ô đều rỗng (mặc định true)
 */

/**
 * @param {string} tep
 * @param {TuyChonDoc} [tuyChon]
 * @returns {Promise<BangDoc>}
 */
export async function docBang(tep, tuyChon = {}) {
  const duoi = extname(tep).toLowerCase()
  // Chặn ở đây cho lời báo lỗi nói đúng chuyện. Không chặn thì mọi đuôi lạ đều
  // rơi vào nhánh .xlsx và người dùng nhận được "không đọc được cấu trúc ZIP",
  // chẳng liên quan gì tới cái họ vừa chọn.
  if (!['.xlsx', '.csv', '.txt'].includes(duoi))
    throw new Error(
      `Chỉ đọc được .xlsx / .csv / .txt — "${basename(tep)}" thì không. ` +
        'File .xls đời cũ thì mở bằng Excel rồi "Save As" sang .xlsx.',
    )

  const thoDu = await readFile(tep).catch((err) => {
    throw new Error(`Không đọc được file dữ liệu "${tep}": ${err.code === 'ENOENT' ? 'không tìm thấy file' : err.message}`)
  })

  const tho =
    duoi === '.csv' || duoi === '.txt'
      ? docCsv(thoDu.toString('utf8'))
      : docXlsx(thoDu, tuyChon.sheet)

  return dungBang(tep, tho, tuyChon)
}

/**
 * Chỉ liệt kê tên các sheet — cho UI vẽ ô chọn mà không phải đọc cả file.
 *
 * @param {string} tep
 * @returns {Promise<string[]>}
 */
export async function dsSheetCuaTep(tep) {
  if (['.csv', '.txt'].includes(extname(tep).toLowerCase())) return []
  const tepZip = docZip(await readFile(tep))
  return dsSheet(tepZip).map((s) => s.ten)
}

// ── dựng bảng từ lưới ô thô ─────────────────────────────────────────────────

/**
 * @param {string} tep
 * @param {{ luoi: string[][], sheet: string, dsSheet: string[] }} tho
 * @param {TuyChonDoc} tuyChon
 * @returns {BangDoc}
 */
function dungBang(tep, tho, { dongDau, dongCuoi, boQuaTrong = true }) {
  const luoi = tho.luoi
  // Dòng tiêu đề = dòng đầu tiên có chữ. File xuất từ phần mềm hay có một hai
  // dòng trống ở trên, bắt người dùng tự xoá thì phiền mà dễ quên.
  const viTriTieuDe = luoi.findIndex((h) => h.some((o) => o.trim() !== ''))
  if (viTriTieuDe < 0)
    throw new Error(`File "${basename(tep)}"${tho.sheet ? ` (sheet "${tho.sheet}")` : ''} không có dòng nào có dữ liệu.`)

  const cot = tenCotDuyNhat(luoi[viTriTieuDe])

  /** @type {Record<string, string>[]} */
  const tatCa = []
  for (let i = viTriTieuDe + 1; i < luoi.length; i++) {
    const h = luoi[i]
    if (boQuaTrong && !h.some((o) => (o ?? '').trim() !== '')) continue
    /** @type {Record<string, string>} */
    const dong = {}
    cot.forEach((c, j) => {
      dong[c] = h[j] ?? ''
    })
    tatCa.push(dong)
  }

  const tu = Math.max(1, dongDau ?? 1)
  const den = dongCuoi && dongCuoi > 0 ? dongCuoi : tatCa.length
  if (tu > tatCa.length && tatCa.length > 0)
    throw new Error(
      `Khoảng dòng bắt đầu từ ${tu} nhưng file chỉ có ${tatCa.length} dòng dữ liệu — không còn gì để chạy.`,
    )

  return {
    tep,
    sheet: tho.sheet,
    dsSheet: tho.dsSheet,
    cot,
    dong: tatCa.slice(tu - 1, den),
    tongDong: tatCa.length,
  }
}

/**
 * Tên cột phải KHÁC NHAU: hai cột trùng tên thì cột sau đè cột trước và mất
 * dữ liệu mà không báo gì. Ô tiêu đề trống thì đặt theo chữ cái cột.
 *
 * @param {string[]} hang
 * @returns {string[]}
 */
function tenCotDuyNhat(hang) {
  const daCo = new Map()
  return hang.map((o, i) => {
    let t = (o ?? '').replace(/\s+/g, ' ').trim() || `cot_${chuCot(i)}`
    const n = (daCo.get(t) ?? 0) + 1
    daCo.set(t, n)
    if (n > 1) t = `${t}_${n}`
    return t
  })
}

/**
 * Tên cột dùng được trong `{{DONG.…}}`: bỏ dấu tiếng Việt, chỉ còn chữ/số/gạch
 * dưới. Engine cài thêm bí danh này bên cạnh tên gốc, nên tiêu đề "Ngày sinh"
 * viết được là `{{DONG.NGAY_SINH}}` mà cột trong file kết quả vẫn giữ tên gốc.
 *
 * @param {string} ten
 * @returns {string}
 */
export function bienCuaCot(ten) {
  return (ten || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

/**
 * Đoán các cột BỊ EXCEL ĂN MẤT SỐ 0 ĐỨNG ĐẦU, để UI gợi ý điền sẵn ô "bù số 0".
 *
 * Dấu hiệu: cột toàn chữ số nhưng độ dài không đều — `075086014547` bị lưu
 * thành số thì còn 11 ký tự, nằm cạnh những dòng 12 ký tự khác. Chỉ GỢI Ý,
 * không tự sửa: cột "số nhà" dài ngắn khác nhau là chuyện bình thường.
 *
 * @param {BangDoc} bang
 * @returns {{ cot: string, dai: number, soDongThieu: number }[]}
 */
export function goiYBuSoKhong(bang) {
  const ra = []
  for (const c of bang.cot) {
    let daiNhat = 0
    let soSo = 0
    let soCo = 0
    for (const d of bang.dong) {
      const v = (d[c] ?? '').trim()
      if (!v) continue
      soCo++
      if (!/^\d+$/.test(v)) {
        soSo = -1
        break
      }
      soSo++
      if (v.length > daiNhat) daiNhat = v.length
    }
    // Cần đủ dòng để kết luận, và phải là cột định danh (>= 6 chữ số) — cột
    // "STT" hay "số con" thì độ dài lệch là đương nhiên.
    if (soSo < 5 || soCo < 5 || daiNhat < 6) continue
    const thieu = bang.dong.filter((d) => {
      const v = (d[c] ?? '').trim()
      return v && v.length < daiNhat
    }).length
    if (thieu > 0) ra.push({ cot: c, dai: daiNhat, soDongThieu: thieu })
  }
  return ra
}

/** 0 → A, 25 → Z, 26 → AA… */
function chuCot(i) {
  let s = ''
  for (let n = i + 1; n > 0; ) {
    const du = (n - 1) % 26
    s = String.fromCharCode(65 + du) + s
    n = Math.floor((n - du) / 26)
  }
  return s
}

/** "AB12" → 27 (chỉ số cột, đếm từ 0) */
function soCot(diaChi) {
  const m = /^([A-Z]+)/.exec(diaChi || '')
  if (!m) return 0
  let n = 0
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

// ── CSV ─────────────────────────────────────────────────────────────────────

/**
 * Excel bản Việt xuất CSV bằng dấu `;`, bản Anh bằng `,` — đoán theo dòng đầu
 * chứ đừng bắt người dùng khai.
 *
 * @param {string} chu
 * @returns {{ luoi: string[][], sheet: string, dsSheet: string[] }}
 */
function docCsv(chu) {
  const s = chu.replace(/^﻿/, '')
  const dongDau = s.slice(0, s.indexOf('\n') + 1 || s.length)
  const dem = (k) => (dongDau.match(new RegExp(`\\${k}`, 'g')) ?? []).length
  const nganh = dem(';') > dem(',') ? ';' : dem('\t') > dem(',') ? '\t' : ','

  /** @type {string[][]} */
  const luoi = []
  /** @type {string[]} */
  let hang = []
  let o = ''
  let trongNgoac = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (trongNgoac) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          o += '"'
          i++
        } else trongNgoac = false
      } else o += c
      continue
    }
    if (c === '"') trongNgoac = true
    else if (c === nganh) {
      hang.push(o)
      o = ''
    } else if (c === '\n') {
      hang.push(o)
      luoi.push(hang)
      hang = []
      o = ''
    } else if (c !== '\r') o += c
  }
  if (o !== '' || hang.length) {
    hang.push(o)
    luoi.push(hang)
  }
  return { luoi, sheet: '', dsSheet: [] }
}

// ── XLSX ────────────────────────────────────────────────────────────────────

/**
 * @param {Buffer} du
 * @param {string} [tenSheet]
 * @returns {{ luoi: string[][], sheet: string, dsSheet: string[] }}
 */
function docXlsx(du, tenSheet) {
  const tep = docZip(du)
  const ds = dsSheet(tep)
  if (ds.length === 0) throw new Error('File .xlsx không có sheet nào đọc được.')

  const muon = (tenSheet ?? '').trim()
  const chon = muon ? ds.find((s) => s.ten === muon) : ds[0]
  if (!chon)
    throw new Error(`Không có sheet tên "${muon}". Các sheet trong file: ${ds.map((s) => s.ten).join(', ')}`)

  const xmlSheet = docChu(tep, chon.duong)
  if (xmlSheet == null) throw new Error(`Không tìm thấy dữ liệu của sheet "${chon.ten}" trong file.`)

  return {
    luoi: luoiCuaSheet(xmlSheet, chuoiChung(tep), kieuNgay(tep), coHe1904(tep)),
    sheet: chon.ten,
    dsSheet: ds.map((s) => s.ten),
  }
}

/**
 * Danh sách sheet theo đúng thứ tự trong workbook, kèm đường dẫn phần XML của
 * nó (tra qua rels — KHÔNG đoán `sheet1.xml`, nhiều file đánh số không khớp).
 *
 * @param {Record<string, Buffer>} tep
 * @returns {{ ten: string, duong: string }[]}
 */
function dsSheet(tep) {
  const wb = docChu(tep, 'xl/workbook.xml')
  if (!wb) throw new Error('File không phải .xlsx hợp lệ (thiếu xl/workbook.xml).')

  const rels = docChu(tep, 'xl/_rels/workbook.xml.rels') ?? ''
  /** @type {Record<string, string>} */
  const dich = {}
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1]
    let dd = /Target="([^"]+)"/.exec(m[0])?.[1]
    if (!id || !dd) continue
    dd = dd.replace(/^\/?xl\//, '').replace(/^\//, '')
    dich[id] = `xl/${dd}`
  }

  const ra = []
  let i = 0
  for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const ten = goXml(/name="([^"]*)"/.exec(m[0])?.[1] ?? `Sheet${i + 1}`)
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1]
    const duong = (rid && dich[rid]) || `xl/worksheets/sheet${i + 1}.xml`
    ra.push({ ten, duong })
    i++
  }
  return ra
}

/**
 * Bảng chuỗi dùng chung. Ô chữ trong .xlsx thường không chứa chữ mà chứa CHỈ SỐ
 * trỏ vào bảng này.
 *
 * @param {Record<string, Buffer>} tep
 * @returns {string[]}
 */
function chuoiChung(tep) {
  const xml = docChu(tep, 'xl/sharedStrings.xml')
  if (!xml) return []
  const ra = []
  // Chữ có định dạng bị chẻ thành nhiều <t> trong cùng một <si> — phải nối lại,
  // không thì "NGUYỄN VĂN A" in đậm chữ đầu chỉ còn "N".
  for (const m of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)) {
    const than = m[1] ?? ''
    let s = ''
    for (const t of than.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) s += goXml(t[1])
    ra.push(s)
  }
  return ra
}

/**
 * Ô nào đang mang định dạng NGÀY. Excel lưu ngày là số (số ngày kể từ
 * 30/12/1899) nên không tra định dạng thì `16/10/1986` đọc ra `31700`.
 *
 * @param {Record<string, Buffer>} tep
 * @returns {boolean[]} theo chỉ số style của ô (thuộc tính `s`)
 */
function kieuNgay(tep) {
  const xml = docChu(tep, 'xl/styles.xml')
  if (!xml) return []

  /** Mã định dạng dựng sẵn của Excel dành cho ngày/giờ. */
  const SAN_CO = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])
  /** @type {Set<number>} */
  const tuKhai = new Set()
  for (const m of xml.matchAll(/<numFmt\b[^>]*\/>/g)) {
    const id = Number(/numFmtId="(\d+)"/.exec(m[0])?.[1])
    const ma = goXml(/formatCode="([^"]*)"/.exec(m[0])?.[1] ?? '')
    // bỏ phần trong ngoặc kép và ký tự escape rồi mới dò y/m/d — format tiền tệ
    // kiểu `#,##0 "ngày"` không phải là ngày.
    const sach = ma.replace(/"[^"]*"/g, '').replace(/\\./g, '')
    if (/[yYdD]/.test(sach) || /h|s/.test(sach)) tuKhai.add(id)
  }

  const khoiXf = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? ''
  const ra = []
  for (const m of khoiXf.matchAll(/<xf\b[^>]*>/g)) {
    const id = Number(/numFmtId="(\d+)"/.exec(m[0])?.[1] ?? 0)
    ra.push(SAN_CO.has(id) || tuKhai.has(id))
  }
  return ra
}

/** Workbook đời Mac cũ đếm ngày từ 1904 thay vì 1900. */
function coHe1904(tep) {
  const wb = docChu(tep, 'xl/workbook.xml') ?? ''
  return /date1904="(1|true)"/i.test(wb)
}

/**
 * @param {string} xml nội dung sheetN.xml
 * @param {string[]} chung bảng chuỗi dùng chung
 * @param {boolean[]} laNgay ô mang định dạng ngày, theo chỉ số style
 * @param {boolean} he1904
 * @returns {string[][]}
 */
function luoiCuaSheet(xml, chung, laNgay, he1904) {
  /** @type {string[][]} */
  const luoi = []
  const reHang = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g
  const reO = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g

  for (const mh of xml.matchAll(reHang)) {
    const than = mh[1] ?? ''
    /** @type {string[]} */
    const hang = []
    for (const mo of than.matchAll(reO)) {
      const thuoc = mo[1] ?? ''
      const trong = mo[2] ?? ''
      const cot = soCot(/r="([A-Z]+\d+)"/.exec(thuoc)?.[1] ?? '')
      hang[cot] = giaTriO(thuoc, trong, chung, laNgay, he1904)
    }
    // Ô trống bị bỏ hẳn khỏi XML nên mảng có lỗ — lấp lại để cột không lệch.
    for (let i = 0; i < hang.length; i++) if (hang[i] === undefined) hang[i] = ''
    luoi.push(hang)
  }
  return luoi
}

/**
 * @param {string} thuoc phần thuộc tính của thẻ <c>
 * @param {string} trong phần bên trong <c>…</c>
 * @param {string[]} chung
 * @param {boolean[]} laNgay
 * @param {boolean} he1904
 * @returns {string}
 */
function giaTriO(thuoc, trong, chung, laNgay, he1904) {
  const kieu = /t="([^"]+)"/.exec(thuoc)?.[1] ?? 'n'

  if (kieu === 'inlineStr') {
    let s = ''
    for (const t of trong.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) s += goXml(t[1])
    return s
  }

  const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(trong)?.[1]
  if (v == null) return ''

  if (kieu === 's') return chung[Number(v)] ?? ''
  if (kieu === 'str') return goXml(v)
  if (kieu === 'b') return v === '1' ? 'TRUE' : 'FALSE'
  if (kieu === 'e') return goXml(v) // ô lỗi (#N/A…) — giữ nguyên để người dùng thấy

  const so = Number(v)
  if (!Number.isFinite(so)) return goXml(v)

  const chiSoStyle = Number(/\bs="(\d+)"/.exec(thuoc)?.[1] ?? -1)
  if (chiSoStyle >= 0 && laNgay[chiSoStyle]) return ngayTuSerial(so, he1904)

  // Số thường: in lại đúng như đã lưu, KHÔNG làm tròn theo locale.
  return String(so)
}

/**
 * Serial của Excel → `dd/mm/yyyy` (kèm giờ nếu có phần lẻ).
 *
 * @param {number} serial
 * @param {boolean} he1904
 * @returns {string}
 */
function ngayTuSerial(serial, he1904) {
  const goc = he1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const ms = goc + Math.round(serial * 86400 * 1000)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return String(serial)
  const hai = (n) => String(n).padStart(2, '0')
  const ngay = `${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
  const conGio = Math.abs(serial % 1) > 1e-9
  return conGio ? `${ngay} ${hai(d.getUTCHours())}:${hai(d.getUTCMinutes())}` : ngay
}

/** @param {string} s */
function goXml(s) {
  return (s ?? '').replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (khop, ten) => {
    if (ten === 'amp') return '&'
    if (ten === 'lt') return '<'
    if (ten === 'gt') return '>'
    if (ten === 'quot') return '"'
    if (ten === 'apos') return "'"
    const ma = ten[1] === 'x' || ten[1] === 'X' ? parseInt(ten.slice(2), 16) : parseInt(ten.slice(1), 10)
    return Number.isFinite(ma) ? String.fromCodePoint(ma) : khop
  })
}

// ── ZIP (chỉ đọc; method 0 = stored và 8 = deflate, đủ cho mọi .xlsx) ───────

/**
 * Bung một file ZIP thành { tên file: nội dung }. Đọc theo BẢNG THƯ MỤC TRUNG
 * TÂM ở cuối file chứ không quét tuần tự các header — header cục bộ có thể để
 * kích thước bằng 0 và ghi thật ở "data descriptor" phía sau.
 *
 * @param {Buffer} du
 * @returns {Record<string, Buffer>}
 */
function docZip(du) {
  const KET = 0x06054b50
  let cuoi = -1
  // Chú thích cuối file dài tối đa 65535 byte → chỉ cần dò ngần đó từ cuối lên.
  for (let i = du.length - 22; i >= Math.max(0, du.length - 22 - 65535); i--) {
    if (du.readUInt32LE(i) === KET) {
      cuoi = i
      break
    }
  }
  if (cuoi < 0) throw new Error('File không phải .xlsx (không đọc được cấu trúc ZIP bên trong).')

  const soTep = du.readUInt16LE(cuoi + 10)
  let viTri = du.readUInt32LE(cuoi + 16)
  if (viTri === 0xffffffff || soTep === 0xffff)
    throw new Error('File .xlsx dùng định dạng ZIP64 — hãy mở bằng Excel rồi lưu lại (Save As .xlsx).')

  /** @type {Record<string, Buffer>} */
  const ra = {}
  for (let i = 0; i < soTep && viTri + 46 <= du.length; i++) {
    if (du.readUInt32LE(viTri) !== 0x02014b50) break
    const cach = du.readUInt16LE(viTri + 10)
    const coNen = du.readUInt32LE(viTri + 20)
    const daiTen = du.readUInt16LE(viTri + 28)
    const daiPhu = du.readUInt16LE(viTri + 30)
    const daiChuThich = du.readUInt16LE(viTri + 32)
    const ten = du.toString('utf8', viTri + 46, viTri + 46 + daiTen)
    const dauCuc = du.readUInt32LE(viTri + 42)

    if (du.readUInt32LE(dauCuc) === 0x04034b50) {
      const tenCuc = du.readUInt16LE(dauCuc + 26)
      const phuCuc = du.readUInt16LE(dauCuc + 28)
      const dau = dauCuc + 30 + tenCuc + phuCuc
      const than = du.subarray(dau, dau + coNen)
      try {
        ra[ten] = cach === 0 ? Buffer.from(than) : inflateRawSync(than)
      } catch {
        // một phần hỏng thì bỏ qua phần đó, còn hơn hỏng cả file
      }
    }
    viTri += 46 + daiTen + daiPhu + daiChuThich
  }
  return ra
}

/**
 * @param {Record<string, Buffer>} tep
 * @param {string} ten
 * @returns {string | null}
 */
function docChu(tep, ten) {
  const b = tep[ten] ?? tep[ten.replace(/^\//, '')]
  return b ? b.toString('utf8') : null
}
