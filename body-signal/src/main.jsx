import React from "react";
import { createRoot } from "react-dom/client";
import BodySignal from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BodySignal />
  </React.StrictMode>
);

/* 서비스워커 등록 — 경로를 상대로 두어 하위 경로 배포에서도 스코프가 맞는다. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
