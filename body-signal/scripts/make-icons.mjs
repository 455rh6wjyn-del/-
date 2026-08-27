/**
 * PWA 아이콘(PNG)을 만든다. 외부 의존성 없이 직접 PNG 를 인코딩한다.
 *   node scripts/make-icons.mjs
 *
 * 보라색 배경에 흰 반짝임(✨) 두 개. 앱 안에서 쓰는 강조색과 같은 계열이다.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/* ── PNG 인코딩 ────────────────────────────────────────────── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const encodePNG = (size, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/* ── 도형 ──────────────────────────────────────────────────── */
// 둥근 사각형 안쪽인가 (좌표는 0~1)
const inRoundedRect = (x, y, r) => {
  const dx = Math.max(r - x, x - (1 - r), 0);
  const dy = Math.max(r - y, y - (1 - r), 0);
  return dx * dx + dy * dy <= r * r;
};
// 반짝임: (|x|/a)^k + (|y|/a)^k <= 1 (k<1 이면 오목한 별)
const inSparkle = (x, y, cx, cy, a, k = 0.55) => {
  const px = Math.abs(x - cx) / a;
  const py = Math.abs(y - cy) / a;
  if (px > 1 || py > 1) return false;
  return Math.pow(px, k) + Math.pow(py, k) <= 1;
};

const lerp = (a, b, t) => a + (b - a) * t;
const TOP = [0x7b, 0x6d, 0xf6];
const BOTTOM = [0x53, 0x40, 0xd8];

/**
 * @param size    한 변 픽셀
 * @param radius  모서리 둥글기 (0~0.5, 0 이면 꽉 찬 정사각형)
 * @param scale   반짝임 크기 배율 (maskable 은 안전영역 안으로 줄인다)
 */
const render = (size, radius, scale) => {
  const SS = 4; // 슈퍼샘플링 배수 (계단 현상 제거)
  const buf = Buffer.alloc(size * size * 4);
  const big = { cx: 0.46, cy: 0.5, a: 0.36 * scale };
  const small = { cx: 0.755, cy: 0.265, a: 0.125 * scale };
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0, fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          if (radius > 0 && !inRoundedRect(x, y, radius)) continue;
          bg++;
          if (inSparkle(x, y, big.cx, big.cy, big.a) || inSparkle(x, y, small.cx, small.cy, small.a)) fg++;
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      const t = py / (size - 1);
      const base = [lerp(TOP[0], BOTTOM[0], t), lerp(TOP[1], BOTTOM[1], t), lerp(TOP[2], BOTTOM[2], t)];
      const white = fg / n;                 // 반짝임 덮인 비율
      const alpha = bg / n;                 // 배경 도형 덮인 비율
      for (let c = 0; c < 3; c++) buf[i + c] = Math.round(lerp(base[c], 255, white / Math.max(alpha, 1e-6)));
      buf[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePNG(size, buf);
};

mkdirSync(OUT, { recursive: true });
const files = [
  ["icon-192.png", render(192, 0.22, 1)],
  ["icon-512.png", render(512, 0.22, 1)],
  // maskable 은 바깥 20% 가 잘릴 수 있어서, 꽉 채우고 그림은 안쪽으로 줄인다.
  ["icon-maskable-512.png", render(512, 0, 0.66)],
  // iOS 는 스스로 모서리를 깎으므로 정사각형으로 준다.
  ["apple-touch-icon.png", render(180, 0, 0.86)],
  ["favicon-32.png", render(32, 0.22, 1)],
];
for (const [name, data] of files) {
  writeFileSync(join(OUT, name), data);
  console.log(`${name} — ${(data.length / 1024).toFixed(1)}KB`);
}
