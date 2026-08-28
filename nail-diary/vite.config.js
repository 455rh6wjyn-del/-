import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Firebase Hosting 의 /nail-diary/ 경로 아래로 배포된다.
export default defineConfig({
  base: "/nail-diary/",
  plugins: [react()],
  build: {
    outDir: "../public/nail-diary",
    emptyOutDir: true,
  },
});
