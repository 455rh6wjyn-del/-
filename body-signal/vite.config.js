import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base 를 "./" 로 두면 빌드 결과가 상대 경로만 쓴다.
// 그래서 도메인 루트든 /body-signal/ 같은 하위 경로든 그대로 올라간다.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
