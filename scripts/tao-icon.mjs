// Tạo bộ icon app (mẫu A: nhà + khung quét) cho Android + iOS từ hình vẽ vector bên dưới.
//   node scripts/tao-icon.mjs
// Vẽ ra PNG bằng Chrome headless (không cần thư viện ảnh). Sửa màu/hình ở phần ART rồi chạy lại.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!CHROME) throw new Error('Cần Google Chrome hoặc Edge để vẽ icon');

const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>`;

// Hình chính trên khung 1024: khung quét 4 góc + ngôi nhà + người
const ART = `
  <g fill="none" stroke="#93c5fd" stroke-width="44" stroke-linecap="round" stroke-linejoin="round">
    <path d="M190 330 V230 a40 40 0 0 1 40 -40 H330"/>
    <path d="M694 190 H794 a40 40 0 0 1 40 40 V330"/>
    <path d="M190 694 V794 a40 40 0 0 0 40 40 H330"/>
    <path d="M834 694 V794 a40 40 0 0 1 -40 40 H694"/>
  </g>
  <path d="M512 282 L742 470 V732 a24 24 0 0 1 -24 24 H306 a24 24 0 0 1 -24 -24 V470 Z" fill="#ffffff"/>
  <path d="M512 250 L790 478" stroke="#ffffff" stroke-width="52" stroke-linecap="round"/>
  <path d="M512 250 L234 478" stroke="#ffffff" stroke-width="52" stroke-linecap="round"/>
  <circle cx="512" cy="548" r="58" fill="#1d4ed8"/>
  <path d="M410 712 a102 92 0 0 1 204 0 Z" fill="#1d4ed8"/>`;

const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${GRADIENT}</defs>${body}</svg>`;
const thuNho = (k, inner) => `<g transform="translate(512 512) scale(${k}) translate(-512 -512)">${inner}</g>`;

const MAU = {
  // icon cũ (Android < 8, launcher không hỗ trợ adaptive): ô vuông bo góc
  vuong: svg(`<rect width="1024" height="1024" rx="230" fill="url(#g)"/>${ART}`),
  // icon tròn (ic_launcher_round)
  tron: svg(`<circle cx="512" cy="512" r="512" fill="url(#g)"/>${thuNho(0.92, ART)}`),
  // iOS: vuông tràn viền, KHÔNG bo góc, KHÔNG trong suốt (iOS tự bo)
  ios: svg(`<rect width="1024" height="1024" fill="url(#g)"/>${ART}`),
  // Android adaptive (8+): nền + hình trước; hình nằm trong vùng an toàn 66/108
  nen: svg(`<rect width="1024" height="1024" fill="url(#g)"/>`),
  truoc: svg(thuNho(0.667, ART)),
};

const tam = join(tmpdir(), 'luutru-icon');
mkdirSync(tam, { recursive: true });
let n = 0;
function ve(mau, px, out) {
  const html = join(tam, `v${n++}.html`);
  const nenTrong = ['truoc', 'vuong', 'tron'].includes(mau); // góc ngoài ô bo tròn phải trong suốt
  writeFileSync(html, `<!doctype html><html><body style="margin:0;background:${nenTrong ? 'transparent' : '#1e3a8a'}">
<img width="${px}" height="${px}" style="display:block" src="data:image/svg+xml;base64,${Buffer.from(MAU[mau]).toString('base64')}"></body></html>`);
  mkdirSync(resolve(out, '..'), { recursive: true });
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${px},${px}`, ...(nenTrong ? ['--default-background-color=00000000'] : []),
    `--screenshot=${resolve(out)}`, `file:///${html.replace(/\\/g, '/')}`,
  ], { stdio: 'ignore' });
  console.log('✓', out, `${px}px`);
}

// ---------- Android ----------
const RES = 'android/app/src/main/res';
const DPI = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DPI)) {
  ve('vuong', 48 * k, `${RES}/mipmap-${d}/ic_launcher.png`);
  ve('tron', 48 * k, `${RES}/mipmap-${d}/ic_launcher_round.png`);
  ve('nen', 108 * k, `${RES}/mipmap-${d}/ic_launcher_background.png`);
  ve('truoc', 108 * k, `${RES}/mipmap-${d}/ic_launcher_foreground.png`);
}
mkdirSync(`${RES}/mipmap-anydpi-v26`, { recursive: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptive);

// ---------- iOS ----------
const SET = 'ios/LuuTru/Images.xcassets/AppIcon.appiconset';
const IOS = [
  ['iphone', 20, 2], ['iphone', 20, 3], ['iphone', 29, 2], ['iphone', 29, 3],
  ['iphone', 40, 2], ['iphone', 40, 3], ['iphone', 60, 2], ['iphone', 60, 3], ['ios-marketing', 1024, 1],
];
const images = IOS.map(([idiom, size, scale]) => {
  const filename = `icon-${size}@${scale}x.png`;
  ve('ios', size * scale, `${SET}/${filename}`);
  return { filename, idiom, scale: `${scale}x`, size: `${size}x${size}` };
});
writeFileSync(`${SET}/Contents.json`, JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2) + '\n');

// bản xem trước 1024
ve('vuong', 1024, 'assets/logo/icon-1024.png');
console.log('Xong.');
