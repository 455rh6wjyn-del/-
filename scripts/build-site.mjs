/**
 * Firebase Hosting 배포용 public/ 폴더를 만든다.
 *   public/                  ← 루트의 커피노트 정적 파일
 *   public/fund-survey/      ← vite 빌드 결과 (fund-survey/vite.config.js 가 직접 출력)
 */
import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public");

const ASSETS = ["index.html", "manifest.json", "sw.js", "icons"];

await mkdir(out, { recursive: true });
for (const name of ASSETS) {
  await cp(join(root, name), join(out, name), { recursive: true });
}

console.log(`정적 파일 복사 완료 → public/ (${ASSETS.join(", ")})`);
