/**
 * 이미지 URL에서 대표 색상을 뽑아본다.
 * 이미지 서버가 CORS 를 안 열어두면 캔버스가 "오염"돼서 픽셀을 못 읽는데,
 * 그럴 땐 에러를 던지니 호출하는 쪽에서 "직접 색상을 골라달라"고 안내하면 된다.
 */
export function extractDominantColor(imgEl) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(imgEl, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size); // CORS 안 열려있으면 여기서 SecurityError

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [pr, pg, pb, pa] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (pa < 128) continue;
    // 흰 배경(제품 컷 사진 대부분)과 거의 검은 그림자는 대표색에서 제외
    const isNearWhite = pr > 235 && pg > 235 && pb > 235;
    const isNearBlack = pr < 20 && pg < 20 && pb < 20;
    if (isNearWhite || isNearBlack) continue;
    r += pr;
    g += pg;
    b += pb;
    n += 1;
  }
  if (n === 0) {
    r = g = b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  const toHex = (v) =>
    Math.round(v / n)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
    img.src = url;
  });
}
