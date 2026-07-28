import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Firebase Hosting 의 /fund-survey/ 경로 아래로 배포된다.
export default defineConfig({
  base: "/fund-survey/",
  plugins: [react()],
  build: {
    outDir: "../public/fund-survey",
    emptyOutDir: true,
  },
});
