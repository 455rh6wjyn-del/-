/**
 * 깃허브 페이지스 배포용 _site/ 폴더를 만든다.
 *   _site/                ← 루트의 커피노트 정적 파일
 *   _site/body-signal/    ← vite 빌드 결과 (body-signal/dist)
 *
 * 자금수요조사(/fund-survey/)는 vite base 가 "/fund-survey/" 로 고정이라
 * 도메인 루트가 아니면 깨진다. 그래서 페이지스에는 올리지 않고 Firebase 쪽에만 둔다.
 */
import { cp, mkdir, rm, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "_site");

const ROOT_ASSETS = ["index.html", "manifest.json", "sw.js", "icons"];
const APPS = [["body-signal/dist", "body-signal"]];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const name of ROOT_ASSETS) {
  await cp(join(root, name), join(out, name), { recursive: true });
}

for (const [from, to] of APPS) {
  try {
    await access(join(root, from));
  } catch {
    throw new Error(`${from} 이 없다. 먼저 해당 앱을 빌드해야 한다.`);
  }
  await cp(join(root, from), join(out, to), { recursive: true });
}

// Jekyll 이 _ 로 시작하는 파일을 걸러내지 않도록
await writeFile(join(out, ".nojekyll"), "");

console.log(`_site/ 생성 완료 — 루트(${ROOT_ASSETS.join(", ")}) + ${APPS.map(([, t]) => t).join(", ")}`);
