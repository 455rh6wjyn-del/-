import React, { useState, useEffect, useRef, useMemo } from "react";
import storage from "./storage.js";
import { getPhoto, putPhoto, listPhotoKeys, clearPhotos } from "./photos.js";

/* 사진 태그 자동 분류용 엔드포인트.
   정적 사이트에서 모델 API 를 직접 부르면 키가 노출되고 CORS 도 막힌다.
   중계 서버를 두었다면 VITE_AI_ENDPOINT 로 주소를 넣고, 없으면 태그를 손으로 고른다. */
const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || "";

/* ═══════ 토큰 ═══════ */
const C = {
  bg: "#F5F4F9", card: "#FFFFFF", accent: "#6D5EF0", accentSoft: "#EEEBFD", accentText: "#5A4BE0",
  ink: "#1D1B26", sub: "#8B8797", line: "#EDEBF2", gray: "#A5A1B0", graySoft: "#F0EFF4",
  yellow: "#D99A2B", yellowSoft: "#FBF3E1", green: "#3FA870", greenSoft: "#E6F4EC",
  red: "#E06B5C", redSoft: "#FCEDEA", pink: "#D96BA0", pinkSoft: "#FBEAF3",
};
const font = { fontFamily: "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',-apple-system,sans-serif" };

/* ═══════ 유틸 ═══════ */
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (k, n) => { const d = new Date(k + "T00:00:00"); d.setDate(d.getDate() + n); return dkey(d); };
const diffDays = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
const daysSince = (k) => (k == null ? null : diffDays(k, dkey()));
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const uid = () => Math.random().toString(36).slice(2, 9);
const pctStr = (x) => `${Math.round((x || 0) * 100)}%`;

const PHASES = ["월경기", "난포기", "배란기", "황체기"];
const phaseOf = (dateKey, info) => {
  if (!info?.lastPeriodStart) return null;
  const len = info.cycleLen || 28;
  let d = diffDays(info.lastPeriodStart, dateKey) % len;
  if (d < 0) d += len;
  return d < 5 ? "월경기" : d < 13 ? "난포기" : d < 16 ? "배란기" : "황체기";
};

/* ═══════ 초기값 ═══════ */
const DEFAULT = {
  settings: { mealGoal: 3, waterGoal: 8, tierLow: 5, tierMid: 15, defaultLag: "2~3일 후", defaultLead: 1 },
  cycleInfo: { lastPeriodStart: null, cycleLen: 28 },
  healthkit: { read: false, write: false, log: [] },
  zones: [
    { id: "z1", name: "이마", detailed: false, subs: [] },
    { id: "z2", name: "코", detailed: false, subs: [] },
    { id: "z3", name: "볼", detailed: false, subs: [] },
    { id: "z4", name: "턱", detailed: true, subs: ["턱 중앙", "턱 좌측", "턱 우측", "입 주변", "턱선·목"] },
  ],
  acneTypes: ["좁쌀", "화농성", "붉은 자국", "블랙헤드", "각질"],
  products: [
    { id: "cl1", type: "cleanser", brand: "", name: "클렌징 오일 (1차)", ing: "", verdict: "맞음", opened: null, stage: "일상", testStart: null, pao: 12, totalUses: 120 },
    { id: "cl2", type: "cleanser", brand: "", name: "폼 클렌저 (2차)", ing: "", verdict: "맞음", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
    { id: "cl3", type: "cleanser", brand: "", name: "시르미오네 비누", ing: "", verdict: "테스트중", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
    { id: "p1", type: "cosmetic", brand: "", name: "토너패드", ing: "", verdict: "테스트중", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
    { id: "p2", type: "cosmetic", brand: "", name: "비타C 세럼", ing: "", verdict: "맞음", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
    { id: "p3", type: "cosmetic", brand: "", name: "레티놀 PDRN 앰플", ing: "", verdict: "테스트중", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
    { id: "p4", type: "cosmetic", brand: "메디큐브", name: "모공패드", ing: "", verdict: "테스트중", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
    { id: "p5", type: "cosmetic", brand: "ISOI", name: "블레미쉬 패드", ing: "", verdict: "맞음", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
    { id: "p6", type: "cosmetic", brand: "", name: "로션", ing: "", verdict: "맞음", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
    { id: "p7", type: "cosmetic", brand: "", name: "크림", ing: "", verdict: "맞음", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
    { id: "p8", type: "cosmetic", brand: "", name: "슬리핑팩", ing: "", verdict: "테스트중", opened: null, stage: "일상", testStart: null, pao: 6, totalUses: 60 },
  ],
  methods: ["손", "쿼드쎄라", "패드"],
  amounts: ["소량", "보통", "듬뿍"],
  feels: ["매끈함", "촉촉함", "따가움", "화끈거림", "유분감", "무거움", "겉돎"],
  symptoms: ["소화불편", "속쓰림", "더부룩함"],
  presets: [
    { id: "r1", name: "아침 루틴", items: ["p1", "p2", "p6"] },
    { id: "r2", name: "저녁 루틴", items: ["p1", "p3", "p7", "p8"] },
  ],
  cycles: [
    { id: "c1", name: "듀얼소닉 프로페셔널 알파", part: "피부", cycleDays: 7, lead: 1, icon: "⚡️", lastDone: null },
    { id: "c2", name: "알페이스S", part: "피부", cycleDays: 3, lead: 1, icon: "💡", lastDone: null },
    { id: "c3", name: "각질 제거", part: "피부", cycleDays: 5, lead: 1, icon: "🧽", lastDone: null },
    { id: "c4", name: "마스크팩", part: "피부", cycleDays: 4, lead: 1, icon: "🧖‍♀️", lastDone: null },
    { id: "c5", name: "체형 점검", part: "바디", cycleDays: 30, lead: 3, icon: "📐", lastDone: null },
    { id: "c6", name: "주간 얼굴 사진", part: "얼굴", cycleDays: 7, lead: 1, icon: "📷", lastDone: null },
  ],
  muscles: [
    { id: "m1", name: "장요근", status: "단축", cycleDays: 2, lead: 1, icon: "🦵", lastCare: null, moves: ["소파 스트레칭", "폼롤러"] },
    { id: "m2", name: "흉쇄유돌근", status: "단축", cycleDays: 3, lead: 1, icon: "🧣", lastCare: null, moves: ["목 이완 스트레칭"] },
    { id: "m3", name: "둔근", status: "약화", cycleDays: 2, lead: 1, icon: "🍑", lastCare: null, moves: ["힙브릿지", "마사지볼"] },
    { id: "m4", name: "발 내재근", status: "약화", cycleDays: 3, lead: 1, icon: "🦶", lastCare: null, moves: ["발가락 벌리기"] },
    { id: "m5", name: "심부경부굴곡근", status: "약화", cycleDays: 3, lead: 1, icon: "🙆‍♀️", lastCare: null, moves: ["턱 당기기"] },
  ],
  faceTools: [
    { id: "f1", name: "옥 괄사 (넓은 면)", target: "볼·광대", cycleDays: 2, lead: 1, icon: "💎", lastUsed: null },
    { id: "f2", name: "빗형 괄사", target: "두피·측두근", cycleDays: 3, lead: 1, icon: "🪮", lastUsed: null },
    { id: "f3", name: "곡선 괄사", target: "턱선·목", cycleDays: 2, lead: 1, icon: "🌙", lastUsed: null },
  ],
  faceMetrics: ["부기", "좌우 비대칭", "턱선 흐림"],
  profile: {
    avoid: [
      { name: "코코넛오일", kind: "코메도제닉" }, { name: "이소프로필미리스테이트", kind: "코메도제닉" },
      { name: "라우르산", kind: "코메도제닉" }, { name: "라놀린", kind: "오클루시브" },
      { name: "페트롤라툼", kind: "오클루시브" }, { name: "미네랄오일", kind: "오클루시브" },
    ],
    good: ["나이아신아마이드", "살리실릭애씨드", "아젤라익애씨드", "판테놀"],
  },
  hypotheses: [], savedMeals: [], photos: [], days: {},
};

const WASH_LV = ["대충", "보통", "꼼꼼히"];
const TAG_BOOLS = [["dairy", "유제품"], ["flour", "밀가루"], ["caffeine", "카페인"], ["alcohol", "알코올"]];
const TAG_LEVELS = [["spicy", "맵기"], ["oily", "기름짐"], ["sugar", "당류"]];
const LAGS = ["당일", "1일 후", "2~3일 후", "5~7일 후"];
const EFFECTS = ["피부 트러블", "속 불편", "근육 뻐근함", "얼굴 부기"];
const VERDICTS = ["맞음", "테스트중", "안맞음"];
const ICONS = ["✨", "⭐️", "❤️", "💖", "💧", "🌸", "🍋", "🧖‍♀️", "🧽", "⚡️", "💡", "📷", "📐", "💪", "🦵", "🍑", "🦶", "🧣", "🙆‍♀️", "💎", "🪮", "🌙", "🍽️", "😴", "🧠"];
const LV_TEXT = ["없음", "약간", "여러 개", "심함"];
const STAGES = ["보관중", "테스트중", "일상", "중단"];
const TEST_DAYS = 14;

/* ═══════ 소품 ═══════ */
const Card = ({ children, style }) => <div className="rounded-3xl p-5" style={{ background: C.card, ...style }}>{children}</div>;
const SectionTitle = ({ children, right }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="text-base font-bold" style={{ color: C.ink }}>{children}</div>{right}
  </div>
);
const Chip = ({ active, onClick, children, tone }) => (
  <button onClick={onClick} className="px-3 py-2 rounded-xl text-sm font-semibold"
    style={{
      background: active ? (tone === "warn" ? C.redSoft : tone === "pink" ? C.pinkSoft : C.accentSoft) : C.graySoft,
      color: active ? (tone === "warn" ? C.red : tone === "pink" ? C.pink : C.accentText) : C.sub, border: "none",
    }}>{children}</button>
);
const Badge = ({ tone = "gray", children }) => {
  const m = { gray: [C.graySoft, C.sub], yellow: [C.yellowSoft, C.yellow], green: [C.greenSoft, C.green], red: [C.redSoft, C.red], accent: [C.accentSoft, C.accentText], pink: [C.pinkSoft, C.pink] };
  const [bg, col] = m[tone] || m.gray;
  return <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: bg, color: col }}>{children}</span>;
};
const Bar = ({ pct, color }) => (
  <div className="h-2 rounded-full" style={{ background: C.graySoft }}>
    <div className="h-2 rounded-full transition-all" style={{ background: color || C.accent, width: pctStr(Math.max(0, Math.min(1, pct || 0))) }} />
  </div>
);
const Field = ({ label, children }) => (
  <div className="mb-3"><div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>{label}</div>{children}</div>
);
const NumStep = ({ value, onChange, unit, min = 1 }) => (
  <div className="flex items-center gap-2">
    <button onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 rounded-xl font-extrabold" style={{ background: C.card, color: C.accentText, border: "none" }}>−</button>
    <span className="text-sm font-extrabold w-16 text-center" style={{ color: C.ink }}>{value}{unit}</span>
    <button onClick={() => onChange(value + 1)} className="w-8 h-8 rounded-xl font-extrabold" style={{ background: C.card, color: C.accentText, border: "none" }}>+</button>
  </div>
);
const Input = (p) => (
  <input {...p} className={"px-3 py-2.5 rounded-xl text-sm " + (p.className || "")}
    style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink, outline: "none", ...(p.style || {}) }} />
);
const Btn = ({ children, onClick, disabled, kind = "primary", className = "" }) => {
  const st = kind === "primary" ? { background: C.accent, color: "#fff" }
    : kind === "soft" ? { background: C.accentSoft, color: C.accentText }
      : kind === "danger" ? { background: C.redSoft, color: C.red }
        : { background: C.graySoft, color: C.sub };
  return (
    <button onClick={onClick} disabled={disabled} className={"py-3 rounded-2xl text-sm font-bold " + className}
      style={{ ...st, border: "none", opacity: disabled ? 0.5 : 1 }}>{children}</button>
  );
};
/* 접히는 리스트 항목 */
const Chevron = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0"
    style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
    <path d="M9 5l7 7-7 7" stroke={open ? "#6D5EF0" : "#A5A1B0"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Row = ({ icon, title, sub, open, onToggle, onLongPress, right, children, sorting, onUp, onDown }) => {
  const timer = useRef(null);
  const start = () => { if (onLongPress) timer.current = setTimeout(onLongPress, 550); };
  const stop = () => clearTimeout(timer.current);
  if (sorting) return (
    <div className="rounded-2xl mb-2 flex items-center gap-2 p-3" style={{ background: C.graySoft }}>
      {icon && <span className="text-base">{icon}</span>}
      <div className="text-sm font-bold flex-1 truncate" style={{ color: C.ink }}>{title}</div>
      <button onClick={onUp} className="w-9 h-9 rounded-xl text-base font-extrabold" style={{ background: C.card, color: C.accentText, border: "none" }}>↑</button>
      <button onClick={onDown} className="w-9 h-9 rounded-xl text-base font-extrabold" style={{ background: C.card, color: C.accentText, border: "none" }}>↓</button>
    </div>
  );
  return (
    <div className="rounded-2xl mb-2" style={{ background: open ? C.graySoft : "transparent" }}>
      <button onClick={onToggle} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop}
        className="w-full flex items-center gap-2 p-3 text-left" style={{ background: "none", border: "none" }}>
        {icon && <span className="text-base">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: C.ink }}>{title}</div>
          {sub && <div className="text-xs truncate" style={{ color: C.sub }}>{sub}</div>}
        </div>
        {right}
        <Chevron open={open} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
};

/* 사진을 줄여 Blob 으로 돌려준다. IndexedDB 에는 dataURL 문자열 대신 Blob 을 넣는다
   (같은 사진이 base64 보다 25% 가볍고, 화면에는 objectURL 로 붙일 수 있다). */
const shrink = (file, max = 520) => new Promise((res, rej) => {
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => {
    URL.revokeObjectURL(url);
    const sc = Math.min(1, max / Math.max(im.width, im.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    cv.toBlob((blob) => (blob ? res(blob) : rej(new Error("이미지를 변환하지 못했어요."))), "image/jpeg", 0.7);
  };
  im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("이미지를 읽지 못했어요.")); };
  im.src = url;
});

/* ═══════ 홈 ═══════ */
function HomeTab({ state, setState, day, setDay, pct, board, doBoard, bestPattern, causeLabel, tierOf, tierMsg, setTab, hkWrite, todayPhase, alerts, testInfo, productInfo, fetchWeather, wxBusy, wxErr }) {
  const c = day.common || {};
  const setCommon = (p) => setDay({ common: { ...c, ...p } });
  const due = board.filter((b) => b.due), soon = board.filter((b) => !b.due);
  const toneOf = (p) => (p >= 0.8 ? C.green : p > 0 ? C.yellow : C.gray);

  const Tile = ({ it }) => {
    const tone = it.over ? C.red : it.due ? C.yellow : C.green;
    const soft = it.over ? C.redSoft : it.due ? C.yellowSoft : C.greenSoft;
    const head = it.gap === null ? "처음" : it.over ? `+${it.gap - it.cycleDays + 1}일` : `D-${Math.max(0, it.left)}`;
    return (
      <div className="rounded-3xl p-4" style={{ background: C.card }}>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-base">{it.icon}</span>
          <span className="w-2 h-2 rounded-full" style={{ background: tone }} />
          <span className="text-xs font-semibold truncate flex-1" style={{ color: C.sub }}>{it.part}</span>
        </div>
        <div className="text-sm font-bold mb-1 leading-tight" style={{ color: C.ink, minHeight: 34 }}>{it.name}</div>
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-xl font-extrabold" style={{ color: tone }}>{head}</span>
          <span className="text-xs" style={{ color: C.sub }}>{it.gap === null ? "기록 없음" : `${it.gap}일째`}</span>
        </div>
        <Bar pct={it.ratio} color={tone} />
        <button onClick={() => doBoard(it)} className="w-full mt-3 py-2 rounded-xl text-xs font-bold"
          style={{ background: soft, color: tone, border: "none" }}>했어요 ✓</button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="text-base font-extrabold" style={{ color: C.ink }}>⭐️ 지금 할 때 됐어요</div>
        <Badge tone={due.length ? "red" : "green"}>{due.length}건</Badge>
      </div>
      {due.length === 0
        ? <Card><div className="text-sm" style={{ color: C.sub }}>다 챙겼어요! 오늘은 여유롭네요 ✨</div></Card>
        : <div className="grid grid-cols-2 gap-3">{due.map((it) => <Tile key={it.key} it={it} />)}</div>}

      <div className="flex items-center justify-between px-1 pt-1">
        <div className="text-base font-extrabold" style={{ color: C.ink }}>🗓️ 다가오는 항목</div>
        <button onClick={() => setTab("settings")} className="text-xs font-bold" style={{ background: "none", border: "none", color: C.accentText }}>주기 설정 →</button>
      </div>
      {soon.length === 0
        ? <Card><div className="text-sm" style={{ color: C.sub }}>표시할 항목이 없어요.</div></Card>
        : <div className="grid grid-cols-2 gap-3">{soon.map((it) => <Tile key={it.key} it={it} />)}</div>}

      {(alerts.testing.length > 0 || alerts.stock.length > 0 || alerts.pao.length > 0) && (
        <Card style={{ borderLeft: `4px solid ${C.yellow}` }}>
          <SectionTitle>🧪 제품 관리</SectionTitle>
          {alerts.testing.map((p) => {
            const t = testInfo(p);
            return (
              <div key={p.id} className="mb-2.5">
                <div className="text-sm font-bold" style={{ color: C.ink }}>{p.name} · 테스트 {t?.dayN}일차</div>
                {t?.done ? (
                  <div className="text-xs mt-1" style={{ color: C.accentText }}>
                    2주 완료 — 테스트 중 트러블 {t.during.n ? pctStr(t.during.rate) : "–"} vs 직전 2주 {t.before.n ? pctStr(t.before.rate) : "–"} · 설정에서 판정해 주세요
                  </div>
                ) : <div className="text-xs mt-1" style={{ color: C.sub }}>{TEST_DAYS - t.dayN}일 남음 · 이 기간엔 다른 새 제품을 같이 시작하지 않는 게 좋아요</div>}
              </div>
            );
          })}
          {alerts.stock.map((p) => (
            <div key={p.id} className="text-sm mb-1" style={{ color: C.ink }}>📦 <b>{p.name}</b> 곧 다 써요 (약 {productInfo(p).left}회 남음)</div>
          ))}
          {alerts.pao.map((p) => (
            <div key={p.id} className="text-sm mb-1" style={{ color: C.red }}>⚠️ <b>{p.name}</b> 개봉 후 {Math.round(productInfo(p).openedMonths)}개월 — 권장 {p.pao}개월 지남</div>
          ))}
        </Card>
      )}

      <Card>
        <SectionTitle right={<Badge tone="accent">전체 {pctStr(pct.total)}</Badge>}>📊 오늘 입력률</SectionTitle>
        <Bar pct={pct.total} />
        <div className="flex gap-3 mt-4">
          {[["✨ 피부", pct.skin, "skin"], ["💪 바디", pct.muscle, "muscle"], ["🍽️ 이너", pct.gut, "gut"]].map(([l, p, t]) => (
            <button key={l} onClick={() => setTab(t)} className="flex-1 text-left" style={{ background: "none", border: "none", padding: 0 }}>
              <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>{l}</div>
              <div className="text-xl font-extrabold mb-1.5" style={{ color: p > 0 ? C.ink : C.gray }}>{pctStr(p)}</div>
              <Bar pct={p} color={toneOf(p)} />
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle right={todayPhase ? <Badge tone="pink">🌸 {todayPhase}</Badge> : null}>❤️ 공통 컨디션</SectionTitle>
        <Field label="😴 수면">
          <div className="flex flex-wrap gap-1.5">
            {["6시간 이하", "7시간", "8시간 이상"].map((v) => (
              <Chip key={v} active={c.sleep === v} onClick={() => setCommon({ sleep: c.sleep === v ? null : v })}>{v}</Chip>
            ))}
          </div>
        </Field>
        <Field label="🧠 스트레스">
          <div className="flex flex-wrap gap-1.5">
            {["낮음", "보통", "높음"].map((v) => (
              <Chip key={v} active={c.stress === v} onClick={() => setCommon({ stress: c.stress === v ? null : v })}>{v}</Chip>
            ))}
          </div>
        </Field>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold" style={{ color: C.sub }}>
            💧 물 <span className="font-extrabold text-sm" style={{ color: C.ink }}>{c.water || 0}</span> / {state.settings.waterGoal}잔
          </div>
          <div className="flex gap-1.5">
            <Chip onClick={() => setCommon({ water: Math.max(0, (c.water || 0) - 1) })}>−1</Chip>
            <Chip active onClick={() => { setCommon({ water: (c.water || 0) + 1 }); hkWrite("물 섭취 250ml"); }}>+1잔</Chip>
          </div>
        </div>
        <div className="pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold" style={{ color: C.sub }}>
              🌤️ 날씨 {c.weather ? <span className="font-extrabold text-sm" style={{ color: C.ink }}>{c.weather.temp}℃ · 습도 {c.weather.hum}%</span> : "미수집"}
            </div>
            <Chip active={!c.weather} onClick={fetchWeather}>{wxBusy ? "가져오는 중…" : c.weather ? "다시 가져오기" : "위치로 가져오기"}</Chip>
          </div>
          {wxErr && <div className="text-xs mt-1.5" style={{ color: C.red }}>{wxErr}</div>}
          {!c.weather && !wxErr && <div className="text-xs mt-1.5" style={{ color: C.gray }}>건조한 날·추운 날이 트러블과 관련 있는지 자동으로 같이 봐줘요.</div>}
        </div>
      </Card>

      <Card>
        <SectionTitle>🍎 HealthKit 연동</SectionTitle>
        {[["read", "읽기", "수면 · 활동량 · 생리주기를 가져와요"], ["write", "쓰기", "물 섭취 · 케어 세션을 건강 앱에 기록해요"]].map(([k, l, d]) => (
          <div key={k} className="flex items-center justify-between mb-3">
            <div className="flex-1 pr-3">
              <div className="text-sm font-bold" style={{ color: C.ink }}>{l}</div>
              <div className="text-xs mt-0.5" style={{ color: C.sub }}>{d}</div>
            </div>
            <button onClick={() => {
              const on = !state.healthkit[k];
              setState((s) => ({ ...s, healthkit: { ...s.healthkit, [k]: on } }));
              if (k === "read") setCommon(on ? { activity: "7,842보 (시뮬)", hkSleep: "7시간 12분 (시뮬)" } : { activity: null, hkSleep: null });
            }} className="w-12 h-7 rounded-full relative shrink-0" style={{ background: state.healthkit[k] ? C.accent : C.graySoft, border: "none" }}>
              <span className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all" style={{ left: state.healthkit[k] ? 26 : 4 }} />
            </button>
          </div>
        ))}
        {state.healthkit.read && (
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge tone="accent">🚶 {c.activity}</Badge><Badge tone="accent">😴 {c.hkSleep}</Badge>
            {todayPhase && <Badge tone="pink">🌸 {todayPhase}</Badge>}
          </div>
        )}
        {state.healthkit.write && (state.healthkit.log || []).length > 0 && (
          <div className="rounded-xl p-3 mb-2" style={{ background: C.graySoft }}>
            <div className="text-xs font-bold mb-1" style={{ color: C.sub }}>건강 앱으로 내보낸 기록</div>
            {(state.healthkit.log || []).slice(-4).reverse().map((l, i) => <div key={i} className="text-xs" style={{ color: C.ink }}>{l.t} · {l.what}</div>)}
          </div>
        )}
        <div className="text-xs p-3 rounded-xl" style={{ background: C.graySoft, color: C.sub }}>
          실제 권한 요청과 저장은 iOS 네이티브 앱 단계에서 붙습니다.
        </div>
      </Card>

      <Card style={{ borderLeft: `4px solid ${C.accent}` }}>
        <SectionTitle>🔍 최근 발견한 패턴</SectionTitle>
        {bestPattern ? (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge tone={bestPattern.auto ? "accent" : "pink"}>{bestPattern.auto ? "🤖 자동 탐지" : "🔍 직접 등록"}</Badge>
            </div>
            <div className="text-sm font-bold mb-1" style={{ color: C.ink }}>{causeLabel(bestPattern.h.cause)} → {bestPattern.h.effect} ({bestPattern.h.lag})</div>
            <Badge tone={tierOf(bestPattern.n)}>{tierMsg(bestPattern.n, bestPattern.match)}</Badge>
            <div className="text-xs mt-2" style={{ color: C.sub }}>한 날 {pctStr(bestPattern.withRate)} vs 안 한 날 {pctStr(bestPattern.withoutRate)}</div>
          </div>
        ) : <div className="text-sm" style={{ color: C.sub }}>기록이 쌓이면 자동으로 후보를 찾아 여기에 보여줘요. 리포트 → 분석에서 전체를 볼 수 있어요.</div>}
        <div className="text-xs mt-2" style={{ color: C.gray }}>※ 상관관계이지 원인이라는 뜻은 아니에요</div>
      </Card>
    </div>
  );
}

/* ═══════ 피부 ═══════ */
function SkinTab({ state, setState, day, setDay, flash, pct }) {
  const skin = day.skin || {};
  const setSkin = (p) => setDay({ skin: { ...skin, ...p } });
  const [pick, setPick] = useState(null);
  const [form, setForm] = useState({ amount: "보통", method: "손", feels: [] });
  const [detailZone, setDetailZone] = useState(null);

  const cleansers = state.products.filter((p) => p.type === "cleanser");
  const cosmetics = state.products.filter((p) => p.type === "cosmetic");

  const cycleWash = (z) => {
    const zones = { ...(skin.wash?.zones || {}) };
    zones[z] = WASH_LV[(WASH_LV.indexOf(zones[z]) + 1) % WASH_LV.length];
    setSkin({ wash: { ...(skin.wash || {}), zones } });
  };
  const cycleTrouble = (z) => {
    const r = skin.result || {};
    const zones = { ...(r.zones || {}) };
    zones[z] = zones[z] === undefined ? 0 : (zones[z] + 1) % 4;
    setSkin({ result: { ...r, zones } });
  };
  const setSub = (zone, sub, v) => {
    const r = skin.result || {};
    const subs = { ...(r.subs || {}) };
    subs[`${zone}>${sub}`] = v;
    setSkin({ result: { ...r, subs } });
  };
  const toggleType = (zone, t) => {
    const r = skin.result || {};
    const types = { ...(r.types || {}) };
    const cur = types[zone] || [];
    types[zone] = cur.includes(t) ? cur.filter((x) => x !== t) : cur.concat(t);
    setSkin({ result: { ...r, types } });
  };
  const addApply = () => {
    setSkin({ applied: (skin.applied || []).concat([{ productId: pick, ...form, t: nowHM() }]) });
    setPick(null); setForm({ amount: "보통", method: "손", feels: [] }); flash("도포 기록 완료");
  };
  const runPreset = (r) => {
    const items = r.items.map((pid) => ({ productId: pid, amount: "보통", method: "손", feels: [], t: nowHM() }));
    setSkin({ applied: (skin.applied || []).concat(items) });
    flash(`${r.name} ${items.length}개 기록 ✨`);
  };

  const tColor = (v) => v === undefined ? C.graySoft : v === 0 ? C.greenSoft : v === 1 ? C.yellowSoft : v === 2 ? "#F7D9C4" : C.redSoft;
  const tText = (v) => v === undefined ? "미입력" : LV_TEXT[v];
  const vTone = (v) => v === "맞음" ? "green" : v === "안맞음" ? "red" : "yellow";

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle right={<Badge tone="accent">{pctStr(pct.skin)}</Badge>}>✨ 피부 입력률</SectionTitle>
        <Bar pct={pct.skin} />
      </Card>

      <Card>
        <SectionTitle>🧴 루틴 프리셋 <span className="text-xs font-normal" style={{ color: C.sub }}>· 한 번에 기록</span></SectionTitle>
        <div className="flex flex-wrap gap-2">
          {state.presets.map((r) => <Btn key={r.id} kind="soft" className="px-4" onClick={() => runPreset(r)}>{r.name} ({r.items.length})</Btn>)}
        </div>
      </Card>

      <Card>
        <SectionTitle>① 🫧 세안 기록</SectionTitle>
        <Field label="클렌징 제품 · 설정에 등록된 목록">
          <div className="flex flex-wrap gap-1.5">
            {cleansers.length === 0 && <div className="text-xs" style={{ color: C.sub }}>설정 → 내 화장품에서 클렌징을 등록해 주세요.</div>}
            {cleansers.map((p) => {
              const on = (skin.wash?.cleansers || []).includes(p.id);
              return <Chip key={p.id} active={on} onClick={() => {
                const cur = skin.wash?.cleansers || [];
                setSkin({ wash: { ...(skin.wash || {}), cleansers: on ? cur.filter((x) => x !== p.id) : cur.concat(p.id) } });
              }}>{p.brand ? `${p.brand} ` : ""}{p.name}</Chip>;
            })}
          </div>
        </Field>
        <Field label="부위별 세정 강도 · 탭해서 변경">
          <div className="grid grid-cols-4 gap-2">
            {state.zones.map((z) => {
              const v = skin.wash?.zones?.[z.name];
              return (
                <button key={z.id} onClick={() => cycleWash(z.name)} className="rounded-2xl py-3 text-center" style={{ background: v ? C.accentSoft : C.graySoft, border: "none" }}>
                  <div className="text-sm font-bold" style={{ color: v ? C.accentText : C.sub }}>{z.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: v ? C.accentText : C.gray }}>{v || "미입력"}</div>
                </button>
              );
            })}
          </div>
        </Field>
      </Card>

      <Card>
        <SectionTitle>② 💧 도포 기록 <span className="text-xs font-normal" style={{ color: C.sub }}>· 발림 느낌 포함</span></SectionTitle>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {cosmetics.map((p) => (
            <Chip key={p.id} active={pick === p.id} tone={p.verdict === "안맞음" ? "warn" : undefined} onClick={() => setPick(pick === p.id ? null : p.id)}>
              {p.brand ? `${p.brand} ` : ""}{p.name}{p.verdict === "안맞음" ? " ⚠" : ""}
            </Chip>
          ))}
        </div>
        {pick && (
          <div className="rounded-2xl p-3 mb-3" style={{ background: C.graySoft }}>
            <Field label="도포량"><div className="flex gap-1.5">{state.amounts.map((a) => <Chip key={a} active={form.amount === a} onClick={() => setForm({ ...form, amount: a })}>{a}</Chip>)}</div></Field>
            <Field label="방법"><div className="flex gap-1.5 flex-wrap">{state.methods.map((m) => <Chip key={m} active={form.method === m} onClick={() => setForm({ ...form, method: m })}>{m}</Chip>)}</div></Field>
            <Field label="발랐을 때 느낌">
              <div className="flex gap-1.5 flex-wrap">
                {state.feels.map((f) => (
                  <Chip key={f} active={form.feels.includes(f)} tone={["따가움", "화끈거림"].includes(f) ? "warn" : undefined}
                    onClick={() => setForm({ ...form, feels: form.feels.includes(f) ? form.feels.filter((x) => x !== f) : form.feels.concat(f) })}>{f}</Chip>
                ))}
              </div>
            </Field>
            <Btn className="w-full" onClick={addApply}>기록하기</Btn>
          </div>
        )}
        {(skin.applied || []).map((a, i) => {
          const p = [...state.products, ...state.cycles].find((x) => x.id === a.productId);
          return (
            <div key={i} className="text-sm mb-1" style={{ color: C.ink }}>
              <b>{a.t}</b> {p?.name || "항목"} <span className="text-xs" style={{ color: C.sub }}>{a.amount} / {a.method}{(a.feels || []).length ? ` · ${a.feels.join(", ")}` : ""}</span>
            </div>
          );
        })}
      </Card>

      <Card>
        <SectionTitle>③ 🔎 피부 상태</SectionTitle>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {state.zones.map((z) => {
            const v = skin.result?.zones?.[z.name];
            return (
              <div key={z.id}>
                <button onClick={() => cycleTrouble(z.name)} className="w-full rounded-2xl py-3 text-center" style={{ background: tColor(v), border: "none" }}>
                  <div className="text-sm font-bold" style={{ color: v >= 2 ? C.red : C.ink }}>{z.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: v >= 2 ? C.red : C.sub }}>{tText(v)}</div>
                </button>
                {z.detailed && (
                  <button onClick={() => setDetailZone(detailZone === z.name ? null : z.name)} className="w-full mt-1 py-1 rounded-lg text-xs font-bold"
                    style={{ background: detailZone === z.name ? C.accent : C.accentSoft, color: detailZone === z.name ? "#fff" : C.accentText, border: "none" }}>
                    자세히
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {detailZone && (() => {
          const z = state.zones.find((x) => x.name === detailZone);
          return (
            <div className="rounded-2xl p-3 mt-3" style={{ background: C.graySoft }}>
              <div className="text-sm font-extrabold mb-2" style={{ color: C.ink }}>🔬 {detailZone} 세부 기록</div>
              <Field label="세부 위치별 정도">
                {z.subs.map((s) => {
                  const v = skin.result?.subs?.[`${detailZone}>${s}`];
                  return (
                    <div key={s} className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-xs font-bold w-20" style={{ color: C.ink }}>{s}</span>
                      {[0, 1, 2, 3].map((n) => (
                        <Chip key={n} active={v === n} tone={n >= 2 ? "warn" : undefined} onClick={() => setSub(detailZone, s, n)}>{LV_TEXT[n]}</Chip>
                      ))}
                    </div>
                  );
                })}
              </Field>
              <Field label="트러블 유형 (여러 개 선택)">
                <div className="flex flex-wrap gap-1.5">
                  {state.acneTypes.map((t) => (
                    <Chip key={t} active={(skin.result?.types?.[detailZone] || []).includes(t)} onClick={() => toggleType(detailZone, t)}>{t}</Chip>
                  ))}
                </div>
              </Field>
              <div className="text-xs" style={{ color: C.gray }}>세부 위치와 유형은 설정 → 피부 기록 항목에서 편집할 수 있어요.</div>
            </div>
          );
        })()}
      </Card>

      <Card>
        <SectionTitle right={<button onClick={() => flash("설정 탭에서 관리할 수 있어요")} className="text-xs font-bold" style={{ background: "none", border: "none", color: C.accentText }}>설정에서 편집</button>}>
          🧴 오늘 쓴 제품 요약
        </SectionTitle>
        {(skin.applied || []).length === 0 && (skin.wash?.cleansers || []).length === 0
          ? <div className="text-sm" style={{ color: C.sub }}>아직 기록이 없어요.</div>
          : (
            <div className="flex flex-wrap gap-1.5">
              {[...(skin.wash?.cleansers || []), ...new Set((skin.applied || []).map((a) => a.productId))].map((pid, i) => {
                const p = [...state.products, ...state.cycles].find((x) => x.id === pid);
                if (!p) return null;
                return <Badge key={i} tone={p.verdict ? vTone(p.verdict) : "accent"}>{p.name}</Badge>;
              })}
            </div>
          )}
      </Card>
    </div>
  );
}

/* ═══════ 근육 + 얼굴 ═══════ */
function MuscleTab({ state, setState, day, setDay, today, flash, pct, hkWrite, photos, addPhoto }) {
  const [sub, setSub] = useState("body");
  const [carePick, setCarePick] = useState(null);
  const [cmp, setCmp] = useState(null);
  const fileRef = useRef(null);
  const sessions = day.muscle || [];
  const face = day.face || {};

  const feelStats = (mId, move) => {
    let good = 0;
    Object.values(state.days).forEach((d) => (d.muscle || []).forEach((s) => {
      if (s.muscleId === mId && s.move === move && s.feel === "시원함") good++;
    }));
    return good;
  };
  const recordCare = (m, move, feel) => {
    setState((s) => ({ ...s, muscles: s.muscles.map((x) => x.id === m.id ? { ...x, lastCare: today } : x) }));
    setDay({ muscle: sessions.concat([{ muscleId: m.id, move, feel, t: nowHM() }]) });
    setCarePick(null); hkWrite(`유연성 운동 · ${m.name}`); flash("케어 기록 완료 💪");
  };
  const useTool = (f) => {
    setState((s) => ({ ...s, faceTools: s.faceTools.map((x) => x.id === f.id ? { ...x, lastUsed: today } : x) }));
    setDay({ face: { ...face, tools: (face.tools || []).concat([{ toolId: f.id, t: nowHM() }]) } });
    flash(`${f.name} 사용 기록 💖`);
  };
  const cycleMetric = (k) => {
    const r = { ...(face.result || {}) };
    r[k] = r[k] === undefined ? 0 : (r[k] + 1) % 4;
    setDay({ face: { ...face, result: r } });
  };
  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 change 가 뜨도록
    if (!f) return;
    try {
      const blob = await shrink(f);
      await addPhoto(today, blob);
      setState((s) => ({ ...s, cycles: s.cycles.map((c) => c.name === "주간 얼굴 사진" ? { ...c, lastDone: today } : c) }));
      flash("사진 저장됨 📷");
    } catch { flash("사진 저장 실패"); }
  };

  const overdue = state.muscles.filter((m) => { const g = daysSince(m.lastCare); return g === null || g >= m.cycleDays; });
  const mTone = (v) => v === undefined ? C.graySoft : v === 0 ? C.greenSoft : v === 1 ? C.yellowSoft : v === 2 ? "#F7D9C4" : C.redSoft;
  const dates = Object.keys(photos).sort();
  const latest = dates[dates.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[["body", "💪 바디"], ["face", "💖 얼굴 라인"]].map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className="flex-1 py-3 rounded-2xl text-sm font-bold"
            style={{ background: sub === k ? C.accent : C.card, color: sub === k ? "#fff" : C.sub, border: "none" }}>{l}</button>
        ))}
      </div>

      {sub === "body" ? (
        <>
          <Card>
            <SectionTitle right={<Badge tone="accent">{pctStr(pct.muscle)}</Badge>}>💪 바디 입력률</SectionTitle>
            <Bar pct={pct.muscle} />
          </Card>
          <Card style={{ borderLeft: `4px solid ${C.accent}` }}>
            <SectionTitle>⭐️ 오늘 추천</SectionTitle>
            {overdue.length === 0 ? <div className="text-sm" style={{ color: C.sub }}>모든 부위를 주기 안에 챙겼어요 ✨</div>
              : overdue.map((m) => {
                const best = [...m.moves].sort((a, b) => feelStats(m.id, b) - feelStats(m.id, a))[0];
                const g = daysSince(m.lastCare);
                return (
                  <div key={m.id} className="text-sm mb-1.5" style={{ color: C.ink }}>
                    {m.icon} <b>{m.name}</b> — {g === null ? "기록 없음" : `${g}일째`} → <span style={{ color: C.accentText, fontWeight: 700 }}>{best}</span>
                    {feelStats(m.id, best) > 0 && <span className="text-xs" style={{ color: C.green }}> 👍{feelStats(m.id, best)}</span>}
                  </div>
                );
              })}
          </Card>
          <Card>
            <SectionTitle right={<span className="text-xs" style={{ color: C.sub }}>편집은 설정에서</span>}>💪 근육 마스터</SectionTitle>
            {state.muscles.map((m) => {
              const gap = daysSince(m.lastCare);
              const due = gap === null || gap >= m.cycleDays;
              return (
                <div key={m.id} className="rounded-2xl p-3 mb-2" style={{ background: C.graySoft }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{m.icon}</span>
                    <div className="text-sm font-extrabold flex-1" style={{ color: C.ink }}>{m.name}</div>
                    <Badge tone={m.status === "정상" ? "green" : "yellow"}>{m.status}</Badge>
                    <Badge tone={due ? "red" : "green"}>{gap === null ? "처음" : `${gap}일째`}</Badge>
                  </div>
                  {carePick === m.id ? (
                    <div>
                      {m.moves.map((mv) => (
                        <div key={mv} className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="text-sm font-bold" style={{ color: C.ink }}>{mv}</span>
                          {["시원함", "변화없음", "더 뻐근함"].map((f) => (
                            <Chip key={f} active tone={f === "더 뻐근함" ? "warn" : undefined} onClick={() => recordCare(m, mv, f)}>{f}</Chip>
                          ))}
                        </div>
                      ))}
                      <button onClick={() => setCarePick(null)} className="text-xs" style={{ border: "none", background: "none", color: C.sub }}>닫기</button>
                    </div>
                  ) : <Btn kind="ghost" className="w-full" onClick={() => setCarePick(m.id)}>케어 기록하기</Btn>}
                </div>
              );
            })}
          </Card>
        </>
      ) : (
        <>
          <Card style={{ borderLeft: `4px solid ${C.pink}` }}>
            <SectionTitle right={<span className="text-xs" style={{ color: C.sub }}>도구 편집은 설정에서</span>}>💖 괄사 · 얼굴 라인</SectionTitle>
            {state.faceTools.length === 0 && <div className="text-sm" style={{ color: C.sub }}>설정 → 괄사에서 도구를 등록해 주세요.</div>}
            {state.faceTools.map((f) => {
              const gap = daysSince(f.lastUsed);
              const due = gap === null || gap >= f.cycleDays;
              return (
                <div key={f.id} className="flex items-center gap-2 mb-2.5">
                  <span>{f.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: C.ink }}>{f.name}</div>
                    <div className="text-xs" style={{ color: due ? C.red : C.sub }}>{f.target} · {gap === null ? "처음" : `${gap}일째`} / 주기 {f.cycleDays}일</div>
                  </div>
                  <Btn kind={due ? "primary" : "ghost"} className="px-3 py-2! text-xs" onClick={() => useTool(f)}>사용</Btn>
                </div>
              );
            })}
          </Card>

          <Card>
            <SectionTitle right={<span className="text-xs" style={{ color: C.sub }}>항목 추가는 설정에서</span>}>🪞 오늘 얼굴 상태</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {state.faceMetrics.map((k) => {
                const v = face.result?.[k];
                return (
                  <button key={k} onClick={() => cycleMetric(k)} className="rounded-2xl py-3 text-center" style={{ background: mTone(v), border: "none" }}>
                    <div className="text-sm font-bold" style={{ color: v >= 2 ? C.red : C.ink }}>{k}</div>
                    <div className="text-xs mt-0.5" style={{ color: v >= 2 ? C.red : C.sub }}>{v === undefined ? "미입력" : LV_TEXT[v]}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle right={<Badge tone="pink">{dates.length}장</Badge>}>📷 주간 얼굴 사진</SectionTitle>
            <Btn kind="soft" className="w-full mb-3" onClick={() => fileRef.current?.click()}>📷 오늘 사진 찍기 / 올리기</Btn>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
            {dates.length === 0
              ? <div className="text-xs" style={{ color: C.sub }}>같은 각도·같은 조명으로 주 1회 찍어두면 4주 뒤 차이가 보여요.</div>
              : (
                <>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <div className="text-xs font-bold mb-1" style={{ color: C.sub }}>비교 · {cmp || dates[0]}</div>
                      <img src={photos[cmp || dates[0]]} alt="past" className="w-full rounded-2xl" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold mb-1" style={{ color: C.accentText }}>최신 · {latest}</div>
                      <img src={photos[latest]} alt="latest" className="w-full rounded-2xl" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dates.map((d) => <Chip key={d} active={(cmp || dates[0]) === d} onClick={() => setCmp(d)}>{d.slice(5)}</Chip>)}
                  </div>
                  <div className="text-xs mt-2" style={{ color: C.gray }}>사진은 이 기기의 브라우저 저장소(IndexedDB)에만 있어요. 서버로 올라가지 않아요.</div>
                </>
              )}
          </Card>
        </>
      )}
    </div>
  );
}

/* ═══════ 내장 ═══════ */
function GutTab({ state, setState, day, setDay, flash, pct }) {
  const gut = day.gut || {};
  const setGut = (p) => setDay({ gut: { ...gut, ...p } });
  const [mealName, setMealName] = useState("");
  const [tags, setTags] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [img, setImg] = useState(null);
  const blank = () => Object.fromEntries(state.symptoms.map((k) => [k, 0]));
  const [symp, setSymp] = useState(blank);
  const fileRef = useRef(null);
  const empty = { spicy: 0, oily: 0, sugar: 0, dairy: false, flour: false, caffeine: false, alcohol: false, amount: "보통" };

  const pickImage = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setImg({ data: r.result.split(",")[1], media: f.type || "image/jpeg" });
    r.readAsDataURL(f);
  };
  const aiExtract = async () => {
    // 중계 서버를 설정하지 않았으면 네트워크를 타지 않고 바로 손으로 고르게 한다.
    if (!AI_ENDPOINT) { setTags(empty); setErr(null); return; }
    setBusy(true); setErr(null);
    try {
      const content = [];
      if (img) content.push({ type: "image", source: { type: "base64", media_type: img.media, data: img.data } });
      content.push({ type: "text", text: `${img ? "이 사진 속 음식을 보고" : `"${mealName}"에 대해`} 아래 JSON만 출력해. 백틱·설명 금지.\n{"name":"음식 이름(한국어)","spicy":0~3,"oily":0~3,"sugar":0~3,"dairy":bool,"flour":bool,"caffeine":bool,"alcohol":bool,"amount":"적게|보통|많이"}` });
      const res = await fetch(AI_ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content }] }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
      const p = JSON.parse(text.replace(/```json|```/g, "").trim());
      setMealName(p.name || mealName);
      setTags({ spicy: p.spicy ?? 0, oily: p.oily ?? 0, sugar: p.sugar ?? 0, dairy: !!p.dairy, flour: !!p.flour, caffeine: !!p.caffeine, alcohol: !!p.alcohol, amount: p.amount || "보통" });
    } catch { setErr("AI 태그 추출에 실패했어요. 아래에서 직접 골라도 돼요."); setTags(empty); }
    setBusy(false);
  };
  const saveMeal = (also) => {
    if (!tags) return;
    const meal = { t: nowHM(), name: mealName || "이름 없는 식사", tags };
    setGut({ meals: (gut.meals || []).concat([meal]) });
    if (also) setState((s) => ({ ...s, savedMeals: s.savedMeals.concat([{ id: uid(), name: meal.name, tags }]) }));
    setMealName(""); setTags(null); setImg(null); flash("식사 기록 완료 🍽️");
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle right={<Badge tone="accent">{pctStr(pct.gut)}</Badge>}>🍽️ 이너 입력률</SectionTitle>
        <Bar pct={pct.gut} />
        <div className="text-xs mt-2" style={{ color: C.sub }}>식사 {(gut.meals || []).length}/{state.settings.mealGoal}회 · 속 상태 {(gut.results || []).length}회</div>
      </Card>

      <Card>
        <SectionTitle>🍽️ 식사 기록 {AI_ENDPOINT && <span className="text-xs font-normal" style={{ color: C.sub }}>· 사진 → AI 태그</span>}</SectionTitle>
        {state.savedMeals.length > 0 && (
          <Field label="자주 먹는 메뉴">
            <div className="flex flex-wrap gap-1.5">
              {state.savedMeals.map((m) => <Chip key={m.id} active onClick={() => { setMealName(m.name); setTags({ ...m.tags }); }}>{m.name}</Chip>)}
            </div>
          </Field>
        )}
        {AI_ENDPOINT && (
          <>
            <Btn kind="soft" className="w-full mb-2" onClick={() => fileRef.current?.click()}>{img ? "📷 사진 첨부됨" : "📷 사진 찍기 / 올리기"}</Btn>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: "none" }} />
          </>
        )}
        <Input value={mealName} onChange={(e) => setMealName(e.target.value)} placeholder="음식 이름 입력" className="w-full mb-2" />
        <Btn className="w-full" onClick={aiExtract} disabled={busy || (!mealName.trim() && !(AI_ENDPOINT && img))}>
          {busy ? "AI가 분석 중…" : AI_ENDPOINT ? "AI로 태그 추출" : "태그 고르기"}
        </Btn>
        {err && <div className="text-xs mt-2" style={{ color: C.red }}>{err}</div>}
        {tags && (
          <div className="mt-3 rounded-2xl p-3" style={{ background: C.graySoft }}>
            <div className="text-xs font-semibold mb-2" style={{ color: C.sub }}>태그 확인 · 틀린 건 탭해서 수정</div>
            {TAG_LEVELS.map(([k, l]) => (
              <div key={k} className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="text-xs font-bold w-12" style={{ color: C.ink }}>{l}</span>
                {[0, 1, 2, 3].map((v) => <Chip key={v} active={tags[k] === v} onClick={() => setTags({ ...tags, [k]: v })}>{v}</Chip>)}
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {TAG_BOOLS.map(([k, l]) => <Chip key={k} active={tags[k]} onClick={() => setTags({ ...tags, [k]: !tags[k] })}>{l}</Chip>)}
            </div>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-xs font-bold w-12" style={{ color: C.ink }}>양</span>
              {["적게", "보통", "많이"].map((v) => <Chip key={v} active={tags.amount === v} onClick={() => setTags({ ...tags, amount: v })}>{v}</Chip>)}
            </div>
            <div className="flex gap-2">
              <Btn className="flex-1" onClick={() => saveMeal(false)}>기록하기</Btn>
              <Btn kind="ghost" className="flex-1" onClick={() => saveMeal(true)}>기록 + 메뉴 저장</Btn>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>🫧 속 상태 기록</SectionTitle>
        {state.symptoms.map((k) => (
          <div key={k} className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="text-sm font-bold w-16" style={{ color: C.ink }}>{k}</span>
            {[0, 1, 2, 3].map((v) => <Chip key={v} active={symp[k] === v} tone={v >= 2 ? "warn" : undefined} onClick={() => setSymp({ ...symp, [k]: v })}>{v === 0 ? "없음" : v}</Chip>)}
          </div>
        ))}
        <Btn className="w-full mt-1" onClick={() => {
          setGut({ results: (gut.results || []).concat([{ t: nowHM(), symptoms: symp }]) });
          setSymp(blank()); flash("속 상태 기록 완료");
        }}>지금 상태 기록</Btn>
      </Card>
    </div>
  );
}

/* ═══════ 리포트 ═══════ */
function ReportTab({ state, setState, today, pct, dailyReport, rangeReport, hypoStats, causeLabel, tierOf, tierMsg, phaseStats, setTab, autoFindings, uid }) {
  const [seg, setSeg] = useState("day");
  const SEGS = [["day", "일간"], ["week", "주간"], ["month", "월간"], ["analysis", "분석"]];
  const r = dailyReport;
  const w = rangeReport(7), mo = rangeReport(30);

  const Range = ({ d, label }) => (
    <>
      <Card>
        <SectionTitle right={<Badge tone="accent">{d.days}일</Badge>}>📊 {label} 요약</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {[["평균 입력률", pctStr(d.avgFill)], ["주기 준수율", pctStr(d.cycleKeep)],
            ["트러블", `${d.troubleDays} / ${d.skinLogged}일`], ["속 불편", `${d.gutDays} / ${d.gutLogged}일`]].map(([l, v]) => (
            <div key={l} className="rounded-2xl p-3" style={{ background: C.graySoft }}>
              <div className="text-xs mb-1" style={{ color: C.sub }}>{l}</div>
              <div className="text-lg font-extrabold" style={{ color: C.ink }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="text-xs mt-3" style={{ color: d.missing ? C.yellow : C.sub }}>
          {d.missing ? `📭 ${d.missing}일은 기록이 없어서 분석에서 빠졌어요` : "✅ 기간 내 모든 날에 기록이 있어요"}
        </div>
      </Card>
      <Card>
        <SectionTitle>🧴 많이 쓴 제품</SectionTitle>
        {d.topProducts.length === 0 ? <div className="text-sm" style={{ color: C.sub }}>기록이 없어요.</div>
          : d.topProducts.map((p) => (
            <div key={p.name} className="flex items-center justify-between text-sm mb-1.5">
              <span style={{ color: C.ink }}>{p.name}</span>
              <span className="text-xs" style={{ color: C.sub }}>{p.n}회</span>
            </div>
          ))}
      </Card>
      <Card>
        <SectionTitle>💪 케어한 부위</SectionTitle>
        {d.topMuscles.length === 0 ? <div className="text-sm" style={{ color: C.sub }}>기록이 없어요.</div>
          : d.topMuscles.map((p) => (
            <div key={p.name} className="flex items-center justify-between text-sm mb-1.5">
              <span style={{ color: C.ink }}>{p.name}</span>
              <span className="text-xs" style={{ color: C.sub }}>{p.n}회</span>
            </div>
          ))}
        {d.neglected.length > 0 && (
          <div className="text-xs mt-2" style={{ color: C.red }}>⚠️ 기간 내 한 번도 못 챙긴 부위: {d.neglected.join(", ")}</div>
        )}
      </Card>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {SEGS.map(([k, l]) => (
          <button key={k} onClick={() => setSeg(k)} className="flex-1 py-2.5 rounded-2xl text-sm font-bold"
            style={{ background: seg === k ? C.accent : C.card, color: seg === k ? "#fff" : C.sub, border: "none" }}>{l}</button>
        ))}
      </div>

      {seg === "day" && (
        <>
          <Card style={{ borderLeft: `4px solid ${C.accent}` }}>
            <SectionTitle right={<Badge tone="accent">{pctStr(pct.total)}</Badge>}>📋 {today} 리포트</SectionTitle>
            <div className="text-sm" style={{ color: C.ink }}>{r.headline}</div>
          </Card>

          <Card>
            <SectionTitle>✅ 오늘 한 케어</SectionTitle>
            {r.cares.length === 0 ? <div className="text-sm" style={{ color: C.sub }}>아직 기록된 케어가 없어요.</div>
              : r.cares.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm mb-1.5">
                  <span>{c.icon}</span><span className="flex-1" style={{ color: C.ink }}>{c.text}</span>
                  <span className="text-xs" style={{ color: C.sub }}>{c.t}</span>
                </div>
              ))}
          </Card>

          <Card>
            <SectionTitle>🔎 오늘 상태</SectionTitle>
            {r.states.length === 0 ? <div className="text-sm" style={{ color: C.sub }}>상태 기록이 없어요.</div>
              : r.states.map((s, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <span className="text-sm" style={{ color: C.ink }}>{s.text}</span>
                </div>
              ))}
          </Card>

          <Card>
            <SectionTitle>🕵️ 며칠 전 뭘 했나</SectionTitle>
            {r.suspects.length === 0 ? (
              <div className="text-sm" style={{ color: C.sub }}>
                {r.hasIssue ? "며칠 전 기록이 아직 없어요. 기록이 쌓이면 여기서 후보를 짚어줄게요." : "오늘 눈에 띄는 이상이 없어서 되짚을 게 없어요 ✨"}
              </div>
            ) : (
              <>
                {r.suspects.map((s, i) => (
                  <div key={i} className="rounded-2xl p-3 mb-2" style={{ background: C.graySoft }}>
                    <div className="text-sm font-bold mb-1" style={{ color: C.ink }}>{s.dayAgo}일 전 · {s.name}</div>
                    <div className="text-xs mb-1.5" style={{ color: C.sub }}>
                      과거 기록: 쓴 날 {s.n ? pctStr(s.withRate) : "–"} vs 안 쓴 날 {s.without ? pctStr(s.withoutRate) : "–"}
                    </div>
                    <Badge tone={s.n <= state.settings.tierLow ? "gray" : s.gap > 0.15 ? "red" : "green"}>
                      {s.n <= state.settings.tierLow ? `표본 ${s.n}회 · 아직 판단 이름` : s.gap > 0.15 ? `차이 +${Math.round(s.gap * 100)}%p · 관련 가능성` : "뚜렷한 차이 없음"}
                    </Badge>
                  </div>
                ))}
                <div className="text-xs" style={{ color: C.gray }}>※ 시간상 앞에 있었다는 것뿐, 원인이라는 뜻은 아니에요.</div>
              </>
            )}
          </Card>
        </>
      )}

      {seg === "week" && <Range d={w} label="최근 7일" />}
      {seg === "month" && <Range d={mo} label="최근 30일" />}

      {seg === "analysis" && (
        <>
          <Card style={{ borderLeft: `4px solid ${C.accent}` }}>
            <SectionTitle right={<Badge tone="accent">{autoFindings.dayCount}일치</Badge>}>🤖 자동 탐지</SectionTitle>
            {!autoFindings.ready ? (
              <div className="text-sm" style={{ color: C.sub }}>
                기록이 10일 이상 쌓이면 앱이 알아서 모든 조합을 훑어 후보를 찾아줘요. 지금은 {autoFindings.dayCount}일치 기록이 있어요.
              </div>
            ) : autoFindings.list.length === 0 ? (
              <div className="text-sm" style={{ color: C.sub }}>지금까지 기준을 넘긴 조합이 없어요. 조건이 뚜렷한 게 아직 안 보인다는 뜻이에요.</div>
            ) : (
              <>
                {autoFindings.list.map((f, i) => {
                  const already = state.hypotheses.some((h) => h.cause === f.cause && h.effect === f.effect);
                  const up = f.gap > 0;
                  return (
                    <div key={i} className="rounded-2xl p-3 mb-2" style={{ background: C.graySoft }}>
                      <div className="text-sm font-bold mb-1" style={{ color: C.ink }}>{f.label} → {f.effect}</div>
                      <div className="text-xs mb-2" style={{ color: C.sub }}>
                        시차 {f.lag} · 한 날 {pctStr(f.withRate)} ({f.n}일) vs 안 한 날 {pctStr(f.withoutRate)} ({f.without}일)
                        {f.skipped > 0 && ` · 미기록 ${f.skipped}일 제외`}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={up ? "red" : "green"}>{up ? `+${Math.round(f.gap * 100)}%p 높음` : `${Math.round(-f.gap * 100)}%p 낮음`}</Badge>
                        <Badge tone={tierOf(f.n)}>{tierOf(f.n) === "gray" ? "표본 적음" : tierOf(f.n) === "yellow" ? "가능성" : "꾸준함"}</Badge>
                        <button disabled={already} onClick={() => setState((s) => ({ ...s, hypotheses: s.hypotheses.concat([{ id: uid(), cause: f.cause, effect: f.effect, lag: f.lag }]) }))}
                          className="ml-auto px-3 py-1.5 rounded-xl text-xs font-bold"
                          style={{ background: already ? C.graySoft : C.accentSoft, color: already ? C.gray : C.accentText, border: "none" }}>
                          {already ? "의심 목록에 있음" : "의심 목록에 추가"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="text-xs" style={{ color: C.gray }}>
                  ※ 수많은 조합을 훑기 때문에 우연히 걸린 것도 섞여 있어요. 신경 쓰이는 건 의심 목록에 넣고 따로 지켜보는 게 좋아요.
                </div>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle>🌸 생리주기 위상별 트러블</SectionTitle>
            {!state.cycleInfo.lastPeriodStart ? (
              <>
                <div className="text-sm mb-3" style={{ color: C.sub }}>설정에서 마지막 생리 시작일을 넣으면 위상별로 볼 수 있어요.</div>
                <Btn className="w-full" onClick={() => setTab("settings")}>설정하러 가기</Btn>
              </>
            ) : PHASES.map((p) => {
              const s = phaseStats[p];
              return (
                <div key={p} className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold" style={{ color: C.ink }}>{p}</span>
                    <span className="text-xs" style={{ color: C.sub }}>{s.n === 0 ? "기록 없음" : `${s.n}일 중 ${s.hit}일 · ${pctStr(s.rate)}`}</span>
                  </div>
                  <Bar pct={s.rate} color={s.rate >= 0.5 ? C.red : s.rate > 0 ? C.yellow : C.green} />
                </div>
              );
            })}
          </Card>

          <div className="text-base font-extrabold px-1 pt-1" style={{ color: C.ink }}>🔍 직접 등록한 의심 목록</div>
          {state.hypotheses.length === 0 ? (
            <Card>
              <div className="text-sm mb-3" style={{ color: C.sub }}>직접 찍어둔 의심 항목이 없어요. 설정에서 추가하면 과거 기록까지 소급 계산돼요.</div>
              <Btn className="w-full" onClick={() => setTab("settings")}>의심 항목 추가하러 가기</Btn>
            </Card>
          ) : state.hypotheses.map((h) => {
            const st = hypoStats(h);
            const gapPP = Math.round((st.withRate - st.withoutRate) * 100);
            return (
              <Card key={h.id}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <div className="text-sm font-extrabold mb-1" style={{ color: C.ink }}>{causeLabel(h.cause)} → {h.effect}</div>
                    <div className="text-xs mb-2" style={{ color: C.sub }}>시차 {h.lag}</div>
                    <Badge tone={tierOf(st.n)}>{tierMsg(st.n, st.match)}</Badge>
                  </div>
                  <button onClick={() => setState((s) => ({ ...s, hypotheses: s.hypotheses.filter((x) => x.id !== h.id) }))} style={{ border: "none", background: "none", color: C.gray, fontSize: 16 }}>✕</button>
                </div>
                <div className="rounded-2xl p-3" style={{ background: C.graySoft }}>
                  <div className="text-xs font-bold mb-2" style={{ color: C.sub }}>기준선 비교</div>
                  <div className="flex items-center justify-between text-xs mb-1" style={{ color: C.ink }}><span>한 날 ({st.n}일)</span><b>{st.n ? pctStr(st.withRate) : "–"}</b></div>
                  <Bar pct={st.withRate} color={C.red} />
                  <div className="flex items-center justify-between text-xs mb-1 mt-2.5" style={{ color: C.ink }}><span>안 한 날 ({st.without}일)</span><b>{st.without ? pctStr(st.withoutRate) : "–"}</b></div>
                  <Bar pct={st.withoutRate} color={C.gray} />
                  {st.skipped > 0 && <div className="text-xs mt-2" style={{ color: C.gray }}>📭 미기록 {st.skipped}일은 계산에서 제외됨</div>}
                  <div className="text-xs mt-2.5" style={{ color: gapPP > 15 ? C.red : gapPP < -15 ? C.green : C.sub }}>
                    {st.n === 0 || st.without === 0 ? "양쪽 데이터가 모두 쌓여야 비교할 수 있어요."
                      : gapPP > 15 ? `한 날이 ${gapPP}%p 더 높아요 — 관련 가능성이 있어요`
                        : gapPP < -15 ? `한 날이 ${-gapPP}%p 더 낮아요 — 오히려 도움이 될 수도`
                          : `차이 ${Math.abs(gapPP)}%p — 뚜렷한 차이는 아니에요`}
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ═══════ 설정 ═══════ */
function SettingsTab({ state, setState, causeOptions, flash, productInfo, testInfo, testingOther, startTest, exportJSON, exportCSV, today, resetAll }) {
  const [open, setOpen] = useState("");
  const [row, setRow] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [nc, setNc] = useState({ name: "", part: "피부", cycleDays: 7, lead: 1 });
  const [nm, setNm] = useState({ name: "", cycleDays: 3, moves: "" });
  const [nf, setNf] = useState({ name: "", target: "", cycleDays: 2, lead: 1 });
  const [nz, setNz] = useState("");
  const [nsub, setNsub] = useState("");
  const [na, setNa] = useState("");
  const [np, setNp] = useState({ type: "cosmetic", brand: "", name: "", ing: "" });
  const [ingResult, setIngResult] = useState(null);
  const [hyp, setHyp] = useState({ cause: "", effect: "피부 트러블", lag: state.settings.defaultLag });
  const S = state.settings;
  const setS = (p) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } }));
  const tgl = (id) => setRow(row === id ? "" : id);
  const upd = (key, id, patch) => setState((s) => ({ ...s, [key]: s[key].map((x) => x.id === id ? { ...x, ...patch } : x) }));
  const del = (key, id) => { setRow(""); setState((s) => ({ ...s, [key]: s[key].filter((x) => x.id !== id) })); };
  const move = (key, id, dir) => setState((s) => {
    const arr = [...s[key]]; const i = arr.findIndex((x) => x.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return s;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...s, [key]: arr };
  });
  const sortProps = (key, id) => ({
    sorting: sortKey === key,
    onLongPress: () => { setRow(""); setSortKey(key); },
    onUp: () => move(key, id, -1),
    onDown: () => move(key, id, 1),
  });
  const SortBar = ({ k, label }) => sortKey === k ? (
    <div className="flex items-center gap-2 mb-2 p-2.5 rounded-2xl" style={{ background: C.accentSoft }}>
      <span className="text-xs font-bold flex-1" style={{ color: C.accentText }}>↕️ {label} 순서 변경 중</span>
      <button onClick={() => setSortKey("")} className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: C.accent, color: "#fff", border: "none" }}>완료</button>
    </div>
  ) : <div className="text-xs mb-2" style={{ color: C.gray }}>길게 누르면 순서를 바꿀 수 있어요</div>;

  const Acc = ({ id, title, desc, children }) => (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <button onClick={() => { setOpen(open === id ? "" : id); setRow(""); setSortKey(""); }} className="w-full text-left p-5" style={{ background: "none", border: "none" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-bold" style={{ color: C.ink }}>{title}</div>
            <div className="text-xs mt-0.5" style={{ color: C.sub }}>{desc}</div>
          </div>
          <Chevron open={open === id} />
        </div>
      </button>
      {open === id && <div className="px-5 pb-5">{children}</div>}
    </Card>
  );
  const IconPick = (cur, onPick) => (
    <div className="flex flex-wrap gap-1 mb-2">
      {ICONS.map((ic) => (
        <button key={ic} onClick={() => onPick(ic)} className="w-8 h-8 rounded-lg text-base"
          style={{ background: cur === ic ? C.accentSoft : C.card, border: "none" }}>{ic}</button>
      ))}
    </div>
  );
  /* 단순 문자열 목록 편집기 */
  const TagEditor = ({ listKey, placeholder, tone }) => {
    const [v, setV] = useState("");
    const list = state[listKey] || [];
    const mv = (i, d) => setState((s) => {
      const a = [...s[listKey]]; const j = i + d;
      if (j < 0 || j >= a.length) return s;
      [a[i], a[j]] = [a[j], a[i]]; return { ...s, [listKey]: a };
    });
    return (
      <>
        <div className="space-y-1.5 mb-2">
          {list.map((t, i) => (
            <div key={t + i} className="flex items-center gap-1.5">
              <span className="flex-1 text-sm font-semibold px-3 py-2 rounded-xl"
                style={{ background: tone === "pink" ? C.pinkSoft : C.accentSoft, color: tone === "pink" ? C.pink : C.accentText }}>{t}</span>
              <button onClick={() => mv(i, -1)} className="w-8 h-8 rounded-lg text-xs font-extrabold" style={{ background: C.card, color: C.accentText, border: "none" }}>↑</button>
              <button onClick={() => mv(i, 1)} className="w-8 h-8 rounded-lg text-xs font-extrabold" style={{ background: C.card, color: C.accentText, border: "none" }}>↓</button>
              <button onClick={() => setState((s) => ({ ...s, [listKey]: s[listKey].filter((_, j) => j !== i) }))}
                className="w-8 h-8 rounded-lg text-xs font-extrabold" style={{ background: C.redSoft, color: C.red, border: "none" }}>✕</button>
            </div>
          ))}
          {list.length === 0 && <div className="text-xs" style={{ color: C.sub }}>항목이 없어요. 아래에서 추가해 주세요.</div>}
        </div>
        <div className="flex gap-2">
          <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="flex-1" />
          <Chip active tone={tone} onClick={() => { if (v.trim()) { setState((s) => ({ ...s, [listKey]: s[listKey].concat([v.trim()]) })); setV(""); } }}>추가</Chip>
        </div>
      </>
    );
  };
  const checkIng = () => {
    const list = np.ing.split(/[,、\n]/).map((x) => x.trim().replace(/\s/g, "")).filter(Boolean);
    const warns = [], goods = [];
    list.forEach((ing, i) => {
      state.profile.avoid.forEach((a) => { if (ing.includes(a.name.replace(/\s/g, ""))) warns.push({ ing, kind: a.kind, pos: i + 1 }); });
      state.profile.good.forEach((g) => { if (ing.includes(g.replace(/\s/g, ""))) goods.push({ ing, pos: i + 1 }); });
    });
    setIngResult({ total: list.length, warns, goods });
  };
  const vTone = (v) => v === "맞음" ? "green" : v === "안맞음" ? "red" : "yellow";

  return (
    <div className="space-y-3">
      {/* 주기 항목 */}
      <Acc id="cycles" title="⏰ 주기 항목" desc={`${state.cycles.length}개 · 탭해서 수정 · 길게 눌러 정렬`}>
        <div className="flex items-center justify-between mb-3 p-3 rounded-2xl" style={{ background: C.accentSoft }}>
          <span className="text-xs font-bold" style={{ color: C.accentText }}>기본 알림 시점</span>
          <NumStep value={S.defaultLead ?? 1} min={0} unit="일 전" onChange={(v) => setS({ defaultLead: v })} />
        </div>
        <SortBar k="cycles" label="주기 항목" />
        {state.cycles.map((c) => (
          <Row key={c.id} icon={c.icon} title={c.name} sub={`${c.part} · 주기 ${c.cycleDays}일 · ${c.lead ?? S.defaultLead}일 전 알림`}
            open={row === c.id} onToggle={() => tgl(c.id)} {...sortProps("cycles", c.id)}>
            <Input value={c.name} onChange={(e) => upd("cycles", c.id, { name: e.target.value })} className="w-full mb-2" placeholder="이름" />
            <div className="flex gap-1.5 mb-2">
              {["피부", "바디", "얼굴", "이너"].map((p) => <Chip key={p} active={c.part === p} onClick={() => upd("cycles", c.id, { part: p })}>{p}</Chip>)}
            </div>
            <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>권장주기</span>
              <NumStep value={c.cycleDays} unit="일" onChange={(v) => upd("cycles", c.id, { cycleDays: v })} /></div>
            <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>⏰ 며칠 전부터</span>
              <NumStep value={c.lead ?? S.defaultLead ?? 1} min={0} unit="일 전" onChange={(v) => upd("cycles", c.id, { lead: v })} /></div>
            {IconPick(c.icon, (ic) => upd("cycles", c.id, { icon: ic }))}
            <div className="flex gap-2">
              <Btn kind="ghost" className="flex-1 py-2! text-xs" onClick={() => upd("cycles", c.id, { lastDone: null })}>기록 초기화</Btn>
              <Btn kind="danger" className="flex-1 py-2! text-xs" onClick={() => del("cycles", c.id)}>삭제</Btn>
            </div>
          </Row>
        ))}
        <Row icon="➕" title="항목 추가" open={row === "newC"} onToggle={() => tgl("newC")}>
          <Input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="예: 두피 스케일링" className="w-full mb-2" />
          <div className="flex gap-1.5 mb-2">{["피부", "바디", "얼굴", "이너"].map((p) => <Chip key={p} active={nc.part === p} onClick={() => setNc({ ...nc, part: p })}>{p}</Chip>)}</div>
          <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>주기</span><NumStep value={nc.cycleDays} unit="일" onChange={(v) => setNc({ ...nc, cycleDays: v })} /></div>
          <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>⏰ 며칠 전부터</span><NumStep value={nc.lead} min={0} unit="일 전" onChange={(v) => setNc({ ...nc, lead: v })} /></div>
          <Btn className="w-full" onClick={() => {
            if (!nc.name.trim()) return;
            setState((s) => ({ ...s, cycles: s.cycles.concat([{ id: uid(), ...nc, name: nc.name.trim(), icon: "✨", lastDone: null }]) }));
            setNc({ name: "", part: "피부", cycleDays: 7, lead: 1 }); setRow(""); flash("추가됨 ✨");
          }}>추가하기</Btn>
        </Row>
      </Acc>

      {/* 내 화장품 */}
      <Acc id="products" title="🧴 내 화장품" desc={`${state.products.length}개 · 클렌징/화장품 · 길게 눌러 정렬`}>
        <SortBar k="products" label="제품" />
        {state.products.map((p) => (
          <Row key={p.id} icon={p.type === "cleanser" ? "🫧" : "💧"} title={`${p.brand ? p.brand + " · " : ""}${p.name}`}
            sub={`${p.stage || "일상"} · ${p.ing ? `전성분 ${p.ing.split(",").length}개` : "전성분 미등록"}`}
            right={<Badge tone={p.stage === "테스트중" ? "accent" : vTone(p.verdict)}>{p.stage === "테스트중" ? "🧪" : p.verdict}</Badge>}
            open={row === p.id} onToggle={() => tgl(p.id)} {...sortProps("products", p.id)}>
            <Input value={p.brand} onChange={(e) => upd("products", p.id, { brand: e.target.value })} placeholder="브랜드" className="w-full mb-2" />
            <Input value={p.name} onChange={(e) => upd("products", p.id, { name: e.target.value })} placeholder="상품명" className="w-full mb-2" />
            <textarea value={p.ing} onChange={(e) => upd("products", p.id, { ing: e.target.value })} rows={3} placeholder="전성분"
              className="w-full px-3 py-2 rounded-xl text-sm mb-2" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink, outline: "none", resize: "none" }} />
            <div className="flex gap-1.5 mb-2">
              <Chip active={p.type === "cosmetic"} onClick={() => upd("products", p.id, { type: "cosmetic" })}>화장품</Chip>
              <Chip active={p.type === "cleanser"} onClick={() => upd("products", p.id, { type: "cleanser" })}>클렌징</Chip>
            </div>
            <div className="flex gap-1.5 mb-2">
              {VERDICTS.map((x) => <Chip key={x} active={p.verdict === x} tone={x === "안맞음" ? "warn" : undefined} onClick={() => upd("products", p.id, { verdict: x })}>{x}</Chip>)}
            </div>

            <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>사용 단계</div>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {STAGES.map((x) => (
                <Chip key={x} active={(p.stage || "일상") === x} onClick={() => {
                  if (x === "테스트중") {
                    const other = testingOther(p.id);
                    if (other && !window.confirm(`${other.name}을(를) 테스트 중이에요. 둘을 같이 시작하면 어느 쪽 때문인지 구분이 안 돼요. 그래도 시작할까요?`)) return;
                    startTest(p); return;
                  }
                  upd("products", p.id, { stage: x, testStart: x === "테스트중" ? p.testStart : null });
                }}>{x === "테스트중" ? "🧪 테스트중" : x}</Chip>
              ))}
            </div>
            {(() => {
              const t = testInfo(p);
              if (!t) return null;
              return (
                <div className="rounded-xl p-3 mb-2" style={{ background: C.card }}>
                  <div className="text-xs font-bold mb-1" style={{ color: C.accentText }}>테스트 {t.dayN}일차 / {TEST_DAYS}일</div>
                  <div className="text-xs" style={{ color: C.sub }}>
                    테스트 중 트러블 {t.during.n ? `${pctStr(t.during.rate)} (${t.during.n}일)` : "기록 부족"} · 직전 2주 {t.before.n ? `${pctStr(t.before.rate)} (${t.before.n}일)` : "기록 부족"}
                  </div>
                  {t.done && (
                    <div className="flex gap-2 mt-2">
                      <Btn kind="soft" className="flex-1 py-2! text-xs" onClick={() => upd("products", p.id, { stage: "일상", verdict: "맞음", testStart: null })}>일상으로 (맞음)</Btn>
                      <Btn kind="danger" className="flex-1 py-2! text-xs" onClick={() => upd("products", p.id, { stage: "중단", verdict: "안맞음", testStart: null })}>중단 (안맞음)</Btn>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>개봉일 · 사용기한 · 잔량</div>
            <input type="date" value={p.opened || ""} onChange={(e) => upd("products", p.id, { opened: e.target.value || null })}
              className="w-full px-3 py-2.5 rounded-xl text-sm mb-2" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink, outline: "none" }} />
            <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>개봉 후 사용기한</span>
              <NumStep value={p.pao || 6} unit="개월" onChange={(v) => upd("products", p.id, { pao: v })} /></div>
            <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>예상 총 사용 횟수</span>
              <NumStep value={p.totalUses || 60} unit="회" onChange={(v) => upd("products", p.id, { totalUses: v })} /></div>
            {(() => {
              const info = productInfo(p);
              return (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: C.sub }}>{info.used}회 사용 · 약 {info.left}회 남음</span>
                    {info.paoOver && <Badge tone="red">사용기한 지남</Badge>}
                  </div>
                  <Bar pct={info.leftPct} color={info.lowStock ? C.red : info.leftPct < 0.4 ? C.yellow : C.green} />
                </div>
              );
            })()}
            <Btn kind="danger" className="w-full py-2! text-xs" onClick={() => del("products", p.id)}>삭제</Btn>
          </Row>
        ))}
        <Row icon="➕" title="제품 추가 · 성분 대조" open={row === "newP"} onToggle={() => tgl("newP")}>
          <div className="flex gap-1.5 mb-2">
            <Chip active={np.type === "cosmetic"} onClick={() => setNp({ ...np, type: "cosmetic" })}>화장품</Chip>
            <Chip active={np.type === "cleanser"} onClick={() => setNp({ ...np, type: "cleanser" })}>클렌징</Chip>
          </div>
          <Input value={np.brand} onChange={(e) => setNp({ ...np, brand: e.target.value })} placeholder="브랜드" className="w-full mb-2" />
          <Input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="상품명" className="w-full mb-2" />
          <textarea value={np.ing} onChange={(e) => setNp({ ...np, ing: e.target.value })} rows={3} placeholder="전성분 · 쉼표로 붙여넣기"
            className="w-full px-3 py-2 rounded-xl text-sm mb-2" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink, outline: "none", resize: "none" }} />
          <div className="flex gap-2 mb-2">
            <Btn kind="soft" className="flex-1" disabled={!np.ing.trim()} onClick={checkIng}>성분 대조</Btn>
            <Btn className="flex-1" disabled={!np.name.trim()} onClick={() => {
              setState((s) => ({ ...s, products: s.products.concat([{ id: uid(), ...np, brand: np.brand.trim(), name: np.name.trim(), ing: np.ing.trim(), verdict: "테스트중", stage: "보관중", testStart: null, pao: 6, totalUses: 60, opened: null }]) }));
              setNp({ type: "cosmetic", brand: "", name: "", ing: "" }); setIngResult(null); flash("등록됨 🧴");
            }}>등록하기</Btn>
          </div>
          {ingResult && (
            <div className="space-y-1.5">
              <div className="text-xs" style={{ color: C.sub }}>총 {ingResult.total}개 성분</div>
              {ingResult.warns.length === 0 ? <Badge tone="green">주의 성분 없음</Badge>
                : ingResult.warns.map((w, i) => (
                  <div key={i} className="text-sm font-semibold" style={{ color: C.red }}>⚠ {w.ing} ({w.kind}) — {w.pos}번째{w.pos <= 7 ? " · 함량 높을 수 있음" : ""}</div>
                ))}
              {ingResult.goods.map((g, i) => <div key={i} className="text-sm font-semibold" style={{ color: C.green }}>✓ {g.ing} — 도움 성분</div>)}
            </div>
          )}
        </Row>
      </Acc>

      {/* 피부 기록 항목 */}
      <Acc id="skin" title="✨ 피부 기록 항목" desc="부위 · 세부 위치 · 트러블 유형 · 도포량/방법/느낌">
        <SortBar k="zones" label="부위" />
        {state.zones.map((z) => (
          <Row key={z.id} icon={z.detailed ? "🔬" : "•"} title={z.name} sub={z.detailed ? `세부 ${z.subs.length}곳` : "기본 기록"}
            open={row === z.id} onToggle={() => tgl(z.id)} {...sortProps("zones", z.id)}>
            <Input value={z.name} onChange={(e) => upd("zones", z.id, { name: e.target.value })} className="w-full mb-2" placeholder="부위 이름" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: C.sub }}>세부 기록 사용</span>
              <button onClick={() => upd("zones", z.id, { detailed: !z.detailed })} className="w-12 h-7 rounded-full relative"
                style={{ background: z.detailed ? C.accent : C.card, border: `1px solid ${C.line}` }}>
                <span className="absolute top-1 w-5 h-5 rounded-full" style={{ background: z.detailed ? "#fff" : C.gray, left: z.detailed ? 26 : 4 }} />
              </button>
            </div>
            {z.detailed && (
              <>
                <div className="space-y-1.5 mb-2">
                  {z.subs.map((sname, i) => (
                    <div key={sname + i} className="flex items-center gap-1.5">
                      <span className="flex-1 text-sm font-semibold px-3 py-2 rounded-xl" style={{ background: C.accentSoft, color: C.accentText }}>{sname}</span>
                      <button onClick={() => { const a = [...z.subs]; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; upd("zones", z.id, { subs: a }); } }}
                        className="w-8 h-8 rounded-lg text-xs font-extrabold" style={{ background: C.card, color: C.accentText, border: "none" }}>↑</button>
                      <button onClick={() => { const a = [...z.subs]; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; upd("zones", z.id, { subs: a }); } }}
                        className="w-8 h-8 rounded-lg text-xs font-extrabold" style={{ background: C.card, color: C.accentText, border: "none" }}>↓</button>
                      <button onClick={() => upd("zones", z.id, { subs: z.subs.filter((_, j) => j !== i) })}
                        className="w-8 h-8 rounded-lg text-xs font-extrabold" style={{ background: C.redSoft, color: C.red, border: "none" }}>✕</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mb-2">
                  <Input value={nsub} onChange={(e) => setNsub(e.target.value)} placeholder="세부 위치 추가" className="flex-1" />
                  <Chip active onClick={() => { if (nsub.trim()) { upd("zones", z.id, { subs: z.subs.concat([nsub.trim()]) }); setNsub(""); } }}>추가</Chip>
                </div>
              </>
            )}
            <Btn kind="danger" className="w-full py-2! text-xs" onClick={() => del("zones", z.id)}>삭제</Btn>
          </Row>
        ))}
        <Row icon="➕" title="부위 추가" open={row === "newZ"} onToggle={() => tgl("newZ")}>
          <Input value={nz} onChange={(e) => setNz(e.target.value)} placeholder="예: 목" className="w-full mb-2" />
          <Btn className="w-full" onClick={() => {
            if (!nz.trim()) return;
            setState((s) => ({ ...s, zones: s.zones.concat([{ id: uid(), name: nz.trim(), detailed: false, subs: [] }]) }));
            setNz(""); setRow(""); flash("추가됨");
          }}>추가하기</Btn>
        </Row>
        <Row icon="🩹" title="트러블 유형" sub={state.acneTypes.join(", ")} open={row === "types"} onToggle={() => tgl("types")}>
          <TagEditor listKey="acneTypes" placeholder="예: 좁쌀" />
        </Row>
        <Row icon="💧" title="도포량 단계" sub={state.amounts.join(", ")} open={row === "amt"} onToggle={() => tgl("amt")}>
          <TagEditor listKey="amounts" placeholder="예: 아주 조금" />
        </Row>
        <Row icon="🖐️" title="도포 방법" sub={state.methods.join(", ")} open={row === "mth"} onToggle={() => tgl("mth")}>
          <TagEditor listKey="methods" placeholder="예: 스패츄라" />
        </Row>
        <Row icon="🫧" title="발림 느낌 태그" sub={state.feels.join(", ")} open={row === "feel"} onToggle={() => tgl("feel")}>
          <TagEditor listKey="feels" placeholder="예: 밀림" />
        </Row>
      </Acc>

      {/* 괄사 */}
      <Acc id="face" title="💖 괄사 · 얼굴 라인" desc={`도구 ${state.faceTools.length}개 · 상태 항목 ${state.faceMetrics.length}개`}>
        <SortBar k="faceTools" label="괄사 도구" />
        {state.faceTools.map((f) => (
          <Row key={f.id} icon={f.icon} title={f.name} sub={`${f.target} · 주기 ${f.cycleDays}일`}
            open={row === f.id} onToggle={() => tgl(f.id)} {...sortProps("faceTools", f.id)}>
            <Input value={f.name} onChange={(e) => upd("faceTools", f.id, { name: e.target.value })} placeholder="도구 이름" className="w-full mb-2" />
            <Input value={f.target} onChange={(e) => upd("faceTools", f.id, { target: e.target.value })} placeholder="주 사용 부위" className="w-full mb-2" />
            <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>주기</span>
              <NumStep value={f.cycleDays} unit="일" onChange={(v) => upd("faceTools", f.id, { cycleDays: v })} /></div>
            <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>⏰ 며칠 전부터</span>
              <NumStep value={f.lead ?? S.defaultLead ?? 1} min={0} unit="일 전" onChange={(v) => upd("faceTools", f.id, { lead: v })} /></div>
            {IconPick(f.icon, (ic) => upd("faceTools", f.id, { icon: ic }))}
            <Btn kind="danger" className="w-full py-2! text-xs" onClick={() => del("faceTools", f.id)}>삭제</Btn>
          </Row>
        ))}
        <Row icon="➕" title="괄사 도구 추가" open={row === "newF"} onToggle={() => tgl("newF")}>
          <Input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="도구 이름 (예: 스테인리스 괄사)" className="w-full mb-2" />
          <Input value={nf.target} onChange={(e) => setNf({ ...nf, target: e.target.value })} placeholder="주 사용 부위 (예: 턱선·목)" className="w-full mb-2" />
          <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>주기</span><NumStep value={nf.cycleDays} unit="일" onChange={(v) => setNf({ ...nf, cycleDays: v })} /></div>
          <Btn className="w-full" onClick={() => {
            if (!nf.name.trim()) return;
            setState((s) => ({ ...s, faceTools: s.faceTools.concat([{ id: uid(), name: nf.name.trim(), target: nf.target.trim(), cycleDays: nf.cycleDays, lead: nf.lead, icon: "💖", lastUsed: null }]) }));
            setNf({ name: "", target: "", cycleDays: 2, lead: 1 }); setRow(""); flash("추가됨 💖");
          }}>추가하기</Btn>
        </Row>
        <Row icon="🪞" title="얼굴 상태 항목" sub={state.faceMetrics.join(", ")} open={row === "fm"} onToggle={() => tgl("fm")}>
          <TagEditor listKey="faceMetrics" placeholder="예: 눈 밑 부기" tone="pink" />
        </Row>
      </Acc>

      {/* 바디 */}
      <Acc id="muscle" title="💪 바디 · 근육 부위" desc={`${state.muscles.length}개 · 길게 눌러 정렬`}>
        <SortBar k="muscles" label="근육 부위" />
        {state.muscles.map((m) => (
          <Row key={m.id} icon={m.icon} title={m.name} sub={`${m.status} · 주기 ${m.cycleDays}일 · ${m.moves.length}개 동작`}
            open={row === m.id} onToggle={() => tgl(m.id)} {...sortProps("muscles", m.id)}>
            <Input value={m.name} onChange={(e) => upd("muscles", m.id, { name: e.target.value })} placeholder="부위 이름" className="w-full mb-2" />
            <div className="flex gap-1.5 mb-2">
              {["단축", "신장", "약화", "정상"].map((st) => <Chip key={st} active={m.status === st} onClick={() => upd("muscles", m.id, { status: st })}>{st}</Chip>)}
            </div>
            <Input value={m.moves.join(", ")} onChange={(e) => upd("muscles", m.id, { moves: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
              placeholder="동작 (쉼표로 구분)" className="w-full mb-2" />
            <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>주기</span>
              <NumStep value={m.cycleDays} unit="일" onChange={(v) => upd("muscles", m.id, { cycleDays: v })} /></div>
            <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>⏰ 며칠 전부터</span>
              <NumStep value={m.lead ?? S.defaultLead ?? 1} min={0} unit="일 전" onChange={(v) => upd("muscles", m.id, { lead: v })} /></div>
            {IconPick(m.icon, (ic) => upd("muscles", m.id, { icon: ic }))}
            <Btn kind="danger" className="w-full py-2! text-xs" onClick={() => del("muscles", m.id)}>삭제</Btn>
          </Row>
        ))}
        <Row icon="➕" title="부위 추가" open={row === "newM"} onToggle={() => tgl("newM")}>
          <Input value={nm.name} onChange={(e) => setNm({ ...nm, name: e.target.value })} placeholder="부위 이름" className="w-full mb-2" />
          <Input value={nm.moves} onChange={(e) => setNm({ ...nm, moves: e.target.value })} placeholder="동작 (쉼표로 구분)" className="w-full mb-2" />
          <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>주기</span><NumStep value={nm.cycleDays} unit="일" onChange={(v) => setNm({ ...nm, cycleDays: v })} /></div>
          <Btn className="w-full" onClick={() => {
            if (!nm.name.trim()) return;
            const mv2 = nm.moves.split(",").map((x) => x.trim()).filter(Boolean);
            setState((s) => ({ ...s, muscles: s.muscles.concat([{ id: uid(), name: nm.name.trim(), status: "정상", cycleDays: nm.cycleDays, lead: 1, icon: "💪", lastCare: null, moves: mv2.length ? mv2 : ["스트레칭"] }]) }));
            setNm({ name: "", cycleDays: 3, moves: "" }); setRow(""); flash("추가됨 💪");
          }}>추가하기</Btn>
        </Row>
      </Acc>

      {/* 이너 */}
      <Acc id="inner" title="🍽️ 이너 기록 항목" desc={`속 상태 ${state.symptoms.length}개 항목`}>
        <Row icon="🫧" title="속 상태 항목" sub={state.symptoms.join(", ")} open={row === "symp"} onToggle={() => tgl("symp")}>
          <TagEditor listKey="symptoms" placeholder="예: 트림, 복부 팽만" />
        </Row>
      </Acc>

      {/* 루틴 */}
      <Acc id="preset" title="🧴 루틴 프리셋" desc={`${state.presets.length}개 · 길게 눌러 정렬`}>
        <SortBar k="presets" label="루틴" />
        {state.presets.map((r) => (
          <Row key={r.id} icon="🧴" title={r.name} sub={`${r.items.length}개 제품`}
            open={row === r.id} onToggle={() => tgl(r.id)} {...sortProps("presets", r.id)}>
            <Input value={r.name} onChange={(e) => upd("presets", r.id, { name: e.target.value })} className="w-full mb-2" placeholder="루틴 이름" />
            <div className="flex flex-wrap gap-1.5 mb-2">
              {state.products.filter((p) => p.type === "cosmetic").map((p) => (
                <Chip key={p.id} active={r.items.includes(p.id)}
                  onClick={() => upd("presets", r.id, { items: r.items.includes(p.id) ? r.items.filter((i) => i !== p.id) : r.items.concat(p.id) })}>{p.name}</Chip>
              ))}
            </div>
            <Btn kind="danger" className="w-full py-2! text-xs" onClick={() => del("presets", r.id)}>삭제</Btn>
          </Row>
        ))}
        <Btn kind="soft" className="w-full" onClick={() => setState((s) => ({ ...s, presets: s.presets.concat([{ id: uid(), name: `루틴 ${s.presets.length + 1}`, items: [] }]) }))}>루틴 추가</Btn>
      </Acc>

      {/* 의심 목록 */}
      <Acc id="hyp" title="🔍 의심 목록" desc={`직접 등록 ${state.hypotheses.length}개 · 자동 탐지는 리포트에서`}>
        {state.hypotheses.map((h) => (
          <Row key={h.id} icon="🔍" title={causeOptions.find((o) => o.v === h.cause)?.l || h.cause} sub={`→ ${h.effect} · ${h.lag}`} open={row === h.id} onToggle={() => tgl(h.id)}>
            <div className="flex gap-1.5 mb-2 flex-wrap">{EFFECTS.map((v) => <Chip key={v} active={h.effect === v} onClick={() => upd("hypotheses", h.id, { effect: v })}>{v}</Chip>)}</div>
            <div className="flex gap-1.5 mb-2 flex-wrap">{LAGS.map((v) => <Chip key={v} active={h.lag === v} onClick={() => upd("hypotheses", h.id, { lag: v })}>{v}</Chip>)}</div>
            <Btn kind="danger" className="w-full py-2! text-xs" onClick={() => del("hypotheses", h.id)}>삭제</Btn>
          </Row>
        ))}
        <Row icon="➕" title="의심 항목 추가" open={row === "newH"} onToggle={() => tgl("newH")}>
          <Field label="원인 (요인) · 설정에서 항목을 추가하면 자동으로 늘어나요">
            <select value={hyp.cause} onChange={(e) => setHyp({ ...hyp, cause: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink, outline: "none" }}>
              <option value="">선택하세요</option>
              {causeOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>
          <Field label="결과"><div className="flex gap-1.5 flex-wrap">{EFFECTS.map((v) => <Chip key={v} active={hyp.effect === v} onClick={() => setHyp({ ...hyp, effect: v })}>{v}</Chip>)}</div></Field>
          <Field label="예상 시차 · 결과가 며칠 뒤에 나타나는지"><div className="flex gap-1.5 flex-wrap">{LAGS.map((v) => <Chip key={v} active={hyp.lag === v} onClick={() => setHyp({ ...hyp, lag: v })}>{v}</Chip>)}</div></Field>
          <Btn className="w-full" disabled={!hyp.cause} onClick={() => {
            setState((s) => ({ ...s, hypotheses: s.hypotheses.concat([{ id: uid(), ...hyp }]) }));
            setHyp({ cause: "", effect: "피부 트러블", lag: S.defaultLag }); setRow(""); flash("의심 목록에 추가됨 🔍");
          }}>의심 목록에 추가</Btn>
        </Row>
        <Row icon="🎚️" title="신뢰도 구간" sub={`회색 ~${S.tierLow}회 · 노랑 ~${S.tierMid}회`} open={row === "tier"} onToggle={() => tgl("tier")}>
          <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.sub }}>회색 ~</span><NumStep value={S.tierLow} unit="회" onChange={(v) => setS({ tierLow: v })} /></div>
          <div className="flex items-center justify-between"><span className="text-xs" style={{ color: C.sub }}>노랑 ~</span><NumStep value={S.tierMid} unit="회" onChange={(v) => setS({ tierMid: v })} /></div>
        </Row>
      </Acc>

      {/* 기타 */}
      <Acc id="etc" title="🌸 생리주기 · 목표값 · 성분" desc="분석 기준 설정">
        <Row icon="🌸" title="생리주기" sub={state.cycleInfo.lastPeriodStart ? `시작 ${state.cycleInfo.lastPeriodStart} · ${state.cycleInfo.cycleLen}일` : "미설정"} open={row === "ci"} onToggle={() => tgl("ci")}>
          <Field label="마지막 생리 시작일">
            <input type="date" value={state.cycleInfo.lastPeriodStart || ""} onChange={(e) => setState((s) => ({ ...s, cycleInfo: { ...s.cycleInfo, lastPeriodStart: e.target.value || null } }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink, outline: "none" }} />
          </Field>
          <div className="flex items-center justify-between"><span className="text-sm" style={{ color: C.ink }}>평균 주기</span>
            <NumStep value={state.cycleInfo.cycleLen} unit="일" onChange={(v) => setState((s) => ({ ...s, cycleInfo: { ...s.cycleInfo, cycleLen: v } }))} /></div>
        </Row>
        <Row icon="🎯" title="목표값" sub={`식사 ${S.mealGoal}회 · 물 ${S.waterGoal}잔`} open={row === "goal"} onToggle={() => tgl("goal")}>
          <div className="flex items-center justify-between mb-2"><span className="text-sm" style={{ color: C.ink }}>하루 식사 기록</span><NumStep value={S.mealGoal} unit="회" onChange={(v) => setS({ mealGoal: v })} /></div>
          <div className="flex items-center justify-between"><span className="text-sm" style={{ color: C.ink }}>하루 물</span><NumStep value={S.waterGoal} unit="잔" onChange={(v) => setS({ waterGoal: v })} /></div>
        </Row>
        <Row icon="🧪" title="내 성분 프로필" sub={`주의 ${state.profile.avoid.length}개 · 도움 ${state.profile.good.length}개`} open={row === "prof"} onToggle={() => tgl("prof")}>
          <div className="space-y-1.5 mb-2">
            {state.profile.avoid.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="flex-1 text-sm font-semibold px-3 py-2 rounded-xl" style={{ background: C.redSoft, color: C.red }}>{a.name} · {a.kind}</span>
                <button onClick={() => setState((s) => ({ ...s, profile: { ...s.profile, avoid: s.profile.avoid.filter((_, j) => j !== i) } }))}
                  className="w-8 h-8 rounded-lg text-xs font-extrabold" style={{ background: C.redSoft, color: C.red, border: "none" }}>✕</button>
              </div>
            ))}
          </div>
          <Input value={na} onChange={(e) => setNa(e.target.value)} placeholder="주의 성분 이름" className="w-full mb-2" />
          <div className="flex gap-1.5 mb-4">
            {["코메도제닉", "오클루시브"].map((k) => (
              <Chip key={k} active onClick={() => {
                if (!na.trim()) return;
                setState((s) => ({ ...s, profile: { ...s.profile, avoid: s.profile.avoid.concat([{ name: na.trim(), kind: k }]) } })); setNa("");
              }}>+ {k}</Chip>
            ))}
          </div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>도움 되는 성분</div>
          <div className="flex flex-wrap gap-1.5">
            {state.profile.good.map((g, i) => (
              <button key={i} onClick={() => setState((s) => ({ ...s, profile: { ...s.profile, good: s.profile.good.filter((_, j) => j !== i) } }))}
                className="px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: C.greenSoft, color: C.green, border: "none" }}>{g} ✕</button>
            ))}
          </div>
        </Row>
        <Row icon="🗂️" title="데이터 관리" sub={`기록된 날 ${Object.keys(state.days).length}일`} open={row === "data"} onToggle={() => tgl("data")}>
          <div className="flex gap-2 mb-2">
            <Btn kind="soft" className="flex-1 py-2! text-xs" onClick={exportJSON}>백업 (JSON)</Btn>
            <Btn kind="soft" className="flex-1 py-2! text-xs" onClick={exportCSV}>일별 표 (CSV)</Btn>
          </div>
          <div className="text-xs mb-3" style={{ color: C.gray }}>JSON은 전체 백업·복원용, CSV는 엑셀에서 열어보는 용도예요. 기록은 이 브라우저에만 있으니 기기를 바꾸기 전에 꼭 백업해 두세요. (사진은 JSON에 담기지 않아요)</div>
          <Btn kind="danger" className="w-full" onClick={resetAll}>전체 초기화</Btn>
        </Row>
      </Acc>
    </div>
  );
}

/* ═══════ 메인 ═══════ */
export default function BodySignal() {
  const [state, setState] = useState(null);
  /* photos 는 { 날짜: objectURL }. 실제 이미지는 IndexedDB 에 Blob 으로 있고,
     여기 담기는 건 화면에 붙일 임시 주소라 다 쓰면 revoke 해줘야 한다. */
  const [photos, setPhotos] = useState({});
  const urlsRef = useRef({});
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const today = dkey();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let st = DEFAULT;
      try {
        const r = await storage.get("bodysignal-v4");
        if (r?.value) st = { ...DEFAULT, ...JSON.parse(r.value) };
      } catch { }
      if (cancelled) return;
      setState(st);

      // 사진 목록은 IndexedDB 에 실제로 들어 있는 것을 기준으로 맞춘다.
      try {
        const keys = (await listPhotoKeys()).map(String).sort();
        const next = {};
        for (const d of keys) {
          const blob = await getPhoto(d);
          if (blob) next[d] = URL.createObjectURL(blob);
        }
        if (cancelled) { Object.values(next).forEach(URL.revokeObjectURL); return; }
        urlsRef.current = next;
        setPhotos(next);
        setState((s) => (s ? { ...s, photos: Object.keys(next) } : s));
      } catch { }
    })();
    return () => { cancelled = true; };
  }, []);

  // 화면을 떠날 때 남은 objectURL 정리
  useEffect(() => () => { Object.values(urlsRef.current).forEach(URL.revokeObjectURL); }, []);

  useEffect(() => {
    if (!state) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await storage.set("bodysignal-v4", JSON.stringify(state)); }
      catch { flash("저장 공간이 부족해요. 설정 → 데이터 관리에서 백업해 주세요."); }
    }, 700);
    return () => clearTimeout(timer.current);
  }, [state]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1600); };
  const day = state?.days?.[today] || {};
  const setDay = (patch) => setState((s) => ({ ...s, days: { ...s.days, [today]: { ...(s.days[today] || {}), ...patch } } }));
  const hkWrite = (what) => setState((s) => s.healthkit.write ? { ...s, healthkit: { ...s.healthkit, log: (s.healthkit.log || []).concat([{ t: nowHM(), what }]) } } : s);

  const addPhoto = async (d, blob) => {
    await putPhoto(d, blob);
    const url = URL.createObjectURL(blob);
    const old = urlsRef.current[d];
    urlsRef.current = { ...urlsRef.current, [d]: url };
    setPhotos(urlsRef.current);
    if (old) URL.revokeObjectURL(old);
    setState((s) => ({ ...s, photos: s.photos.includes(d) ? s.photos : s.photos.concat([d]) }));
  };

  const resetAll = async () => {
    if (!window.confirm("모든 기록과 설정을 초기화할까요? 저장된 사진도 함께 지워져요.")) return;
    Object.values(urlsRef.current).forEach(URL.revokeObjectURL);
    urlsRef.current = {};
    setPhotos({});
    try { await clearPhotos(); } catch { }
    setState(DEFAULT);
  };

  const fillOf = (d) => {
    if (!state) return 0;
    const S = state.settings, zc = state.zones.length || 1;
    const sk = d.skin || {};
    const skin = (((sk.wash?.cleansers || []).length > 0 ? 1 : 0) + Object.keys(sk.wash?.zones || {}).length / zc
      + ((sk.applied || []).length > 0 ? 1 : 0) + Object.keys(sk.result?.zones || {}).length / zc) / 4;
    const muscle = (d.muscle || []).length > 0 ? 1 : 0;
    const g = d.gut || {};
    const gut = Math.min((g.meals || []).length / (S.mealGoal || 3), 1) * 0.6 + ((g.results || []).length > 0 ? 0.4 : 0);
    const c = d.common || {};
    const common = ((c.sleep ? 1 : 0) + (c.stress ? 1 : 0) + Math.min((c.water || 0) / (S.waterGoal || 8), 1)) / 3;
    return (skin + muscle + gut + common) / 4;
  };

  const pct = useMemo(() => {
    if (!state) return { skin: 0, muscle: 0, gut: 0, common: 0, total: 0 };
    const d = state.days[today] || {}, S = state.settings, zc = state.zones.length || 1;
    const sk = d.skin || {};
    const skin = (((sk.wash?.cleansers || []).length > 0 ? 1 : 0) + Object.keys(sk.wash?.zones || {}).length / zc
      + ((sk.applied || []).length > 0 ? 1 : 0) + Object.keys(sk.result?.zones || {}).length / zc) / 4;
    const done = new Set((d.muscle || []).map((x) => x.muscleId));
    const stillDue = state.muscles.filter((m) => { const g = daysSince(m.lastCare); return !done.has(m.id) && (g === null || g >= m.cycleDays); }).length;
    const muscle = done.size + stillDue === 0 ? 1 : done.size / (done.size + stillDue);
    const g = d.gut || {};
    const gut = Math.min((g.meals || []).length / (S.mealGoal || 3), 1) * 0.6 + ((g.results || []).length > 0 ? 0.4 : 0);
    const c = d.common || {};
    const common = ((c.sleep ? 1 : 0) + (c.stress ? 1 : 0) + Math.min((c.water || 0) / (S.waterGoal || 8), 1)) / 3;
    return { skin, muscle, gut, common, total: (skin + muscle + gut + common) / 4 };
  }, [state, today]);

  const board = useMemo(() => {
    if (!state) return [];
    const dl = state.settings.defaultLead ?? 1;
    const mk = (key, id, kind, name, part, cycleDays, last, lead, icon) => {
      const gap = daysSince(last), L = lead ?? dl, alertAt = Math.max(1, cycleDays - L);
      return {
        key, id, kind, name, part, cycleDays, gap, icon, due: gap === null || gap >= alertAt,
        over: gap !== null && gap >= cycleDays, left: gap === null ? 0 : cycleDays - gap,
        ratio: gap === null ? 1 : Math.min(gap / cycleDays, 1),
      };
    };
    return [
      ...state.cycles.map((c) => mk("c" + c.id, c.id, "cycle", c.name, c.part, c.cycleDays, c.lastDone, c.lead, c.icon || "✨")),
      ...state.muscles.map((m) => mk("m" + m.id, m.id, "muscle", m.name, "바디", m.cycleDays, m.lastCare, m.lead, m.icon || "💪")),
      ...state.faceTools.map((f) => mk("f" + f.id, f.id, "face", f.name, "얼굴", f.cycleDays, f.lastUsed, f.lead, f.icon || "💖")),
    ].sort((a, b) => b.ratio - a.ratio);
  }, [state]);

  const doBoard = (it) => {
    if (it.kind === "cycle") {
      setState((s) => ({ ...s, cycles: s.cycles.map((c) => c.id === it.id ? { ...c, lastDone: today } : c) }));
      if (it.part === "피부") setDay({ skin: { ...(day.skin || {}), applied: (day.skin?.applied || []).concat([{ productId: it.id, amount: "케어", method: "기기/도구", feels: [], t: nowHM() }]) } });
    } else if (it.kind === "muscle") {
      setState((s) => ({ ...s, muscles: s.muscles.map((m) => m.id === it.id ? { ...m, lastCare: today } : m) }));
      setDay({ muscle: (day.muscle || []).concat([{ muscleId: it.id, move: "간단 케어", feel: null, t: nowHM() }]) });
      hkWrite(`유연성 운동 · ${it.name}`);
    } else {
      setState((s) => ({ ...s, faceTools: s.faceTools.map((f) => f.id === it.id ? { ...f, lastUsed: today } : f) }));
      setDay({ face: { ...(day.face || {}), tools: (day.face?.tools || []).concat([{ toolId: it.id, t: nowHM() }]) } });
    }
    flash("완료로 기록했어요 ✓");
  };

  /* 분석 */
  const causePresent = (d, cause) => {
    if (!d) return false;
    const [type, key] = cause.split(":");
    if (type === "product") return (d.skin?.applied || []).some((a) => a.productId === key) || (d.skin?.wash?.cleansers || []).includes(key);
    if (type === "face") return (d.face?.tools || []).some((a) => a.toolId === key);
    if (type === "tag") return (d.gut?.meals || []).some((m) => {
      const t = m.tags || {};
      return ["dairy", "flour", "caffeine", "alcohol"].includes(key) ? !!t[key] : (t[key] || 0) >= 2;
    });
    if (type === "common") {
      const c = d.common || {};
      if (key === "sleepLow") return c.sleep === "6시간 이하";
      if (key === "stressHigh") return c.stress === "높음";
      if (key === "dryAir") return (c.weather?.hum ?? 999) <= 40;
      if (key === "coldDay") return (c.weather?.temp ?? 999) <= 10;
    }
    if (type === "wash") return Object.values(d.skin?.wash?.zones || {}).includes("대충");
    return false;
  };
  const hasTrouble = (d) => Object.values(d?.skin?.result?.zones || {}).some((v) => v >= 2)
    || Object.values(d?.skin?.result?.subs || {}).some((v) => v >= 2);
  const hasGut = (d) => (d?.gut?.results || []).some((r) => Object.values(r.symptoms || {}).some((v) => v >= 2));
  /* 해당 결과를 판단할 만한 기록이 그날 있었는지 */
  const recorded = (d, effect) => {
    if (!d) return false;
    if (effect === "피부 트러블") return Object.keys(d.skin?.result?.zones || {}).length > 0 || Object.keys(d.skin?.result?.subs || {}).length > 0;
    if (effect === "속 불편") return (d.gut?.results || []).length > 0;
    if (effect === "근육 뻐근함") return (d.muscle || []).length > 0;
    if (effect === "얼굴 부기") return Object.keys(d.face?.result || {}).length > 0;
    return false;
  };
  /* 요인을 판단할 만한 기록이 그날 있었는지 */
  const causeRecorded = (d, cause) => {
    if (!d) return false;
    const t = cause.split(":")[0];
    if (t === "product" || t === "wash") return !!(d.skin?.applied?.length || d.skin?.wash?.cleansers?.length || Object.keys(d.skin?.wash?.zones || {}).length);
    if (t === "face") return !!(d.face?.tools?.length);
    if (t === "tag") return !!(d.gut?.meals?.length);
    if (t === "common") {
      if (cause.split(":")[1] === "dryAir" || cause.split(":")[1] === "coldDay") return !!d.common?.weather;
      return !!(d.common && (d.common.sleep || d.common.stress));
    }
    return false;
  };
  /* true=결과 있음 / false=없음 / null=미기록이라 판단 불가 */
  const effectStatus = (days, base, effect, lag) => {
    const offs = lag === "당일" ? [0] : lag === "1일 후" ? [1] : lag === "2~3일 후" ? [2, 3] : [5, 6, 7];
    let anyRecorded = false;
    for (const o of offs) {
      const d = days[addDays(base, o)];
      if (!recorded(d, effect)) continue;
      anyRecorded = true;
      if (effect === "피부 트러블" && hasTrouble(d)) return true;
      if (effect === "속 불편" && hasGut(d)) return true;
      if (effect === "근육 뻐근함" && (d.muscle || []).some((m) => m.feel === "더 뻐근함")) return true;
      if (effect === "얼굴 부기" && Object.values(d.face?.result || {}).some((v) => v >= 2)) return true;
    }
    return anyRecorded ? false : null;
  };
  const hypoStats = (h) => {
    if (!state) return { n: 0, match: 0, without: 0, wMatch: 0, withRate: 0, withoutRate: 0, skipped: 0 };
    let n = 0, match = 0, without = 0, wMatch = 0, skipped = 0;
    Object.keys(state.days).forEach((k) => {
      const d = state.days[k];
      const eff = effectStatus(state.days, k, h.effect, h.lag);
      if (eff === null || !causeRecorded(d, h.cause)) { skipped++; return; }
      if (causePresent(d, h.cause)) { n++; if (eff) match++; } else { without++; if (eff) wMatch++; }
    });
    return { n, match, without, wMatch, skipped, withRate: n ? match / n : 0, withoutRate: without ? wMatch / without : 0 };
  };
  const itemStats = (id, kind) => {
    let n = 0, hit = 0, without = 0, wHit = 0, skipped = 0;
    Object.keys(state.days).forEach((k) => {
      const d = state.days[k];
      const eff = effectStatus(state.days, k, "피부 트러블", "2~3일 후");
      const cr = kind === "face" ? !!(d.face?.tools?.length) : !!(d.skin?.applied?.length || d.skin?.wash?.cleansers?.length);
      if (eff === null || !cr) { skipped++; return; }
      const has = kind === "face" ? (d.face?.tools || []).some((a) => a.toolId === id)
        : (d.skin?.applied || []).some((a) => a.productId === id) || (d.skin?.wash?.cleansers || []).includes(id);
      if (has) { n++; if (eff) hit++; } else { without++; if (eff) wHit++; }
    });
    return { n, without, skipped, withRate: n ? hit / n : 0, withoutRate: without ? wHit / without : 0, gap: (n ? hit / n : 0) - (without ? wHit / without : 0) };
  };
  const tierOf = (n) => !state ? "gray" : n <= state.settings.tierLow ? "gray" : n <= state.settings.tierMid ? "yellow" : "green";
  const tierMsg = (n, match) => {
    const t = tierOf(n);
    return t === "gray" ? `아직 판단하기 일러요 (n=${n})` : t === "yellow" ? `관련이 있을 수도 있어요 (n=${n}, 일치 ${match}회)` : `관련성이 꾸준히 보여요 (n=${n}, 일치 ${match}회)`;
  };

  const phaseStats = useMemo(() => {
    const out = {}; PHASES.forEach((p) => (out[p] = { n: 0, hit: 0, rate: 0 }));
    if (!state?.cycleInfo?.lastPeriodStart) return out;
    Object.keys(state.days).forEach((k) => {
      const p = phaseOf(k, state.cycleInfo); if (!p) return;
      const d = state.days[k];
      if (!d.skin?.result?.zones) return;
      out[p].n++; if (hasTrouble(d)) out[p].hit++;
    });
    PHASES.forEach((p) => (out[p].rate = out[p].n ? out[p].hit / out[p].n : 0));
    return out;
  }, [state]);

  const nameOf = (id) => {
    const p = state.products.find((x) => x.id === id);
    if (p) return `${p.brand ? p.brand + " " : ""}${p.name}`;
    const c = state.cycles.find((x) => x.id === id);
    if (c) return c.name;
    const f = state.faceTools.find((x) => x.id === id);
    return f ? f.name : "항목";
  };

  const dailyReport = useMemo(() => {
    if (!state) return { cares: [], states: [], suspects: [], headline: "", hasIssue: false };
    const d = state.days[today] || {};
    const cares = [];
    (d.skin?.wash?.cleansers || []).forEach((id) => cares.push({ icon: "🫧", text: `세안 · ${nameOf(id)}`, t: "" }));
    (d.skin?.applied || []).forEach((a) => cares.push({ icon: "💧", text: `${nameOf(a.productId)} (${a.amount}/${a.method})`, t: a.t }));
    (d.muscle || []).forEach((m) => {
      const mu = state.muscles.find((x) => x.id === m.muscleId);
      cares.push({ icon: mu?.icon || "💪", text: `${mu?.name || "부위"} · ${m.move}${m.feel ? ` → ${m.feel}` : ""}`, t: m.t });
    });
    (d.face?.tools || []).forEach((f) => {
      const ft = state.faceTools.find((x) => x.id === f.toolId);
      cares.push({ icon: ft?.icon || "💖", text: `${ft?.name || "괄사"} 사용`, t: f.t });
    });
    (d.gut?.meals || []).forEach((m) => cares.push({ icon: "🍽️", text: m.name, t: m.t }));

    const states = [];
    const zEntries = Object.entries(d.skin?.result?.zones || {}).filter(([, v]) => v >= 1);
    if (zEntries.length) states.push({ tone: zEntries.some(([, v]) => v >= 2) ? "red" : "yellow", label: "피부", text: zEntries.map(([k, v]) => `${k} ${LV_TEXT[v]}`).join(", ") });
    const sEntries = Object.entries(d.skin?.result?.subs || {}).filter(([, v]) => v >= 2);
    if (sEntries.length) states.push({ tone: "red", label: "세부", text: sEntries.map(([k, v]) => `${k.split(">")[1]} ${LV_TEXT[v]}`).join(", ") });
    const types = Object.entries(d.skin?.result?.types || {}).filter(([, v]) => v.length);
    if (types.length) states.push({ tone: "gray", label: "유형", text: types.map(([k, v]) => `${k}: ${v.join("·")}`).join(" / ") });
    const gutBad = (d.gut?.results || []).flatMap((r) => Object.entries(r.symptoms).filter(([, v]) => v >= 2).map(([k]) => k));
    if (gutBad.length) states.push({ tone: "red", label: "속", text: [...new Set(gutBad)].join(", ") });
    const faceBad = Object.entries(d.face?.result || {}).filter(([, v]) => v >= 2).map(([k]) => k);
    if (faceBad.length) states.push({ tone: "pink", label: "얼굴", text: faceBad.join(", ") });
    const tough = (d.muscle || []).filter((m) => m.feel === "더 뻐근함").length;
    if (tough) states.push({ tone: "yellow", label: "근육", text: `${tough}개 동작에서 더 뻐근함` });

    const hasIssue = hasTrouble(d) || hasGut(d) || faceBad.length > 0;
    const suspects = [];
    if (hasIssue) {
      [2, 3, 5, 6, 7].forEach((ago) => {
        const past = state.days[addDays(today, -ago)];
        if (!past) return;
        const ids = [...new Set([...(past.skin?.applied || []).map((a) => a.productId), ...(past.skin?.wash?.cleansers || [])])];
        ids.forEach((id) => {
          if (suspects.some((s) => s.id === id)) return;
          const st = itemStats(id, "skin");
          suspects.push({ id, name: nameOf(id), dayAgo: ago, ...st });
        });
        (past.face?.tools || []).forEach((f) => {
          if (suspects.some((s) => s.id === f.toolId)) return;
          suspects.push({ id: f.toolId, name: nameOf(f.toolId), dayAgo: ago, ...itemStats(f.toolId, "face") });
        });
      });
    }
    suspects.sort((a, b) => b.gap - a.gap);

    const headline = hasIssue
      ? `오늘은 눈에 띄는 변화가 있어요. 케어 ${cares.length}건 기록됨. 아래에서 며칠 전 기록을 함께 볼 수 있어요.`
      : cares.length ? `오늘 케어 ${cares.length}건 기록됨. 특별한 이상 신호는 없어요 ✨`
        : "아직 오늘 기록이 없어요. 홈에서 오늘 할 일부터 체크해 보세요.";
    return { cares, states, suspects: suspects.slice(0, 4), headline, hasIssue };
  }, [state, today]);

  const rangeReport = (days) => {
    const empty = { days, avgFill: 0, cycleKeep: 0, troubleDays: 0, gutDays: 0, skinLogged: 0, gutLogged: 0, missing: days, topProducts: [], topMuscles: [], neglected: [] };
    if (!state) return empty;
    const keys = [];
    for (let i = 0; i < days; i++) keys.push(addDays(today, -i));
    const rec = keys.map((k) => state.days[k]).filter(Boolean);
    if (!rec.length) return empty;
    const avgFill = keys.reduce((a, k) => a + (state.days[k] ? fillOf(state.days[k]) : 0), 0) / days;
    const skinLogged = keys.filter((k) => recorded(state.days[k], "피부 트러블")).length;
    const gutLogged = keys.filter((k) => recorded(state.days[k], "속 불편")).length;
    const troubleDays = keys.filter((k) => hasTrouble(state.days[k])).length;
    const gutDays = keys.filter((k) => hasGut(state.days[k])).length;
    const missing = days - keys.filter((k) => state.days[k]).length;
    const pCount = {}, mCount = {};
    keys.forEach((k) => {
      const d = state.days[k]; if (!d) return;
      [...(d.skin?.applied || []).map((a) => a.productId), ...(d.skin?.wash?.cleansers || [])].forEach((id) => { pCount[id] = (pCount[id] || 0) + 1; });
      (d.muscle || []).forEach((m) => { mCount[m.muscleId] = (mCount[m.muscleId] || 0) + 1; });
      (d.face?.tools || []).forEach((f) => { mCount[f.toolId] = (mCount[f.toolId] || 0) + 1; });
    });
    const topProducts = Object.entries(pCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ name: nameOf(id), n }));
    const topMuscles = Object.entries(mCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ name: nameOf(id), n }));
    const neglected = [...state.muscles, ...state.faceTools].filter((x) => !mCount[x.id]).map((x) => x.name);
    let slots = 0, kept = 0;
    [...state.cycles, ...state.muscles, ...state.faceTools].forEach((x) => {
      const cd = x.cycleDays || 7;
      const expect = Math.max(1, Math.floor(days / cd));
      const actual = keys.filter((k) => {
        const d = state.days[k]; if (!d) return false;
        return (d.skin?.applied || []).some((a) => a.productId === x.id)
          || (d.muscle || []).some((m) => m.muscleId === x.id)
          || (d.face?.tools || []).some((f) => f.toolId === x.id);
      }).length;
      slots += expect; kept += Math.min(actual, expect);
    });
    return { days, avgFill, cycleKeep: slots ? kept / slots : 0, troubleDays, gutDays, skinLogged, gutLogged, missing, topProducts, topMuscles, neglected };
  };

  /* 제품 사용 횟수 · 소진 추정 */
  const useCount = (id) => Object.values(state.days).filter((d) =>
    (d.skin?.applied || []).some((a) => a.productId === id) || (d.skin?.wash?.cleansers || []).includes(id)).length;
  const productInfo = (p) => {
    const used = useCount(p.id);
    const total = p.totalUses || 60;
    const leftPct = Math.max(0, 1 - used / total);
    const openedMonths = p.opened ? diffDays(p.opened, dkey()) / 30 : null;
    const paoOver = openedMonths !== null && p.pao && openedMonths > p.pao;
    return { used, total, leftPct, left: Math.max(0, total - used), openedMonths, paoOver, lowStock: leftPct <= 0.15 };
  };
  const testInfo = (p) => {
    if (p.stage !== "테스트중" || !p.testStart) return null;
    const dayN = diffDays(p.testStart, dkey()) + 1;
    const rate = (from, to) => {
      let n = 0, hit = 0;
      Object.keys(state.days).forEach((k) => {
        if (k < from || k > to) return;
        if (!recorded(state.days[k], "피부 트러블")) return;
        n++; if (hasTrouble(state.days[k])) hit++;
      });
      return { n, hit, rate: n ? hit / n : 0 };
    };
    const during = rate(p.testStart, addDays(p.testStart, TEST_DAYS - 1));
    const before = rate(addDays(p.testStart, -TEST_DAYS), addDays(p.testStart, -1));
    return { dayN, done: dayN >= TEST_DAYS, during, before };
  };
  const testingOther = (id) => state.products.find((x) => x.stage === "테스트중" && x.id !== id);
  const startTest = (p) => {
    setState((s) => ({ ...s, products: s.products.map((x) => x.id === p.id ? { ...x, stage: "테스트중", testStart: today, opened: x.opened || today } : x) }));
    flash("테스트 시작 🧪");
  };
  const alerts = useMemo(() => {
    if (!state) return { testing: [], stock: [], pao: [] };
    const testing = state.products.filter((p) => p.stage === "테스트중");
    const stock = state.products.filter((p) => p.stage !== "보관중" && productInfo(p).lowStock);
    const pao = state.products.filter((p) => productInfo(p).paoOver);
    return { testing, stock, pao };
  }, [state]);

  /* 날씨 자동 수집 */
  const [wxBusy, setWxBusy] = useState(false);
  const [wxErr, setWxErr] = useState(null);
  const fetchWeather = () => {
    setWxErr(null);
    if (!navigator.geolocation) { setWxErr("이 브라우저는 위치를 지원하지 않아요."); return; }
    setWxBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m`);
        const j = await r.json();
        const c = j.current || {};
        setDay({ common: { ...(state.days[today]?.common || {}), weather: { temp: c.temperature_2m, hum: c.relative_humidity_2m, t: nowHM() } } });
        flash("날씨 기록됨 🌤️");
      } catch { setWxErr("날씨를 가져오지 못했어요. 아래에서 직접 입력해도 돼요."); }
      setWxBusy(false);
    }, () => { setWxErr("위치 권한이 필요해요."); setWxBusy(false); }, { timeout: 8000 });
  };

  /* 내보내기 */
  const download = (name, text, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportJSON = () => download(`body-signal-${today}.json`, JSON.stringify({ ...state, photos: state.photos }, null, 2), "application/json");
  const exportCSV = () => {
    const head = ["날짜", "위상", "수면", "스트레스", "물", "기온", "습도", "쓴제품", "피부트러블", "속불편", "케어부위", "괄사", "식사수"];
    const rows = Object.keys(state.days).sort().map((k) => {
      const d = state.days[k], c = d.common || {};
      const prods = [...new Set([...(d.skin?.applied || []).map((a) => a.productId), ...(d.skin?.wash?.cleansers || [])])].map(nameOf).join(" | ");
      return [k, phaseOf(k, state.cycleInfo) || "", c.sleep || "", c.stress || "", c.water || 0,
        c.weather?.temp ?? "", c.weather?.hum ?? "", prods,
        recorded(d, "피부 트러블") ? (hasTrouble(d) ? "있음" : "없음") : "미기록",
        recorded(d, "속 불편") ? (hasGut(d) ? "있음" : "없음") : "미기록",
        (d.muscle || []).map((m) => nameOf(m.muscleId)).join(" | "),
        (d.face?.tools || []).map((f) => nameOf(f.toolId)).join(" | "),
        (d.gut?.meals || []).length].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",");
    });
    download(`body-signal-${today}.csv`, "\uFEFF" + [head.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
  };

  const causeOptions = useMemo(() => {
    if (!state) return [];
    return [
      ...state.products.map((p) => ({ v: `product:${p.id}`, l: `${p.type === "cleanser" ? "클렌징" : "화장품"} · ${p.brand ? p.brand + " " : ""}${p.name}` })),
      ...state.cycles.map((c) => ({ v: `product:${c.id}`, l: `주기항목 · ${c.name}` })),
      ...state.faceTools.map((f) => ({ v: `face:${f.id}`, l: `괄사 · ${f.name}` })),
      { v: "tag:dairy", l: "음식 · 유제품" }, { v: "tag:flour", l: "음식 · 밀가루" },
      { v: "tag:oily", l: "음식 · 기름진 음식" }, { v: "tag:spicy", l: "음식 · 매운 음식" },
      { v: "tag:caffeine", l: "음식 · 카페인" }, { v: "tag:sugar", l: "음식 · 당류" },
      { v: "common:sleepLow", l: "컨디션 · 수면 부족" }, { v: "common:stressHigh", l: "컨디션 · 스트레스 높음" },
      { v: "wash:rough", l: "세안 · 대충 세안한 날" },
      { v: "common:dryAir", l: "날씨 · 건조한 날 (습도 40% 이하)" },
      { v: "common:coldDay", l: "날씨 · 추운 날 (10℃ 이하)" },
    ];
  }, [state]);
  const causeLabel = (cause) => (causeOptions.find((o) => o.v === cause) || {}).l || cause;

  /* 자동 탐지 — 모든 요인 × 결과 × 시차를 훑어 조건을 넘긴 것만 노출 */
  const autoFindings = useMemo(() => {
    if (!state) return { ready: false, dayCount: 0, list: [] };
    const dayCount = Object.keys(state.days).length;
    if (dayCount < 10) return { ready: false, dayCount, list: [] };
    const minN = Math.max(4, state.settings.tierLow - 1);
    const out = [];
    causeOptions.forEach((c) => {
      EFFECTS.forEach((e) => {
        LAGS.forEach((l) => {
          const st = hypoStats({ cause: c.v, effect: e, lag: l });
          if (st.n < minN || st.without < 3) return;
          const gap = st.withRate - st.withoutRate;
          if (Math.abs(gap) < 0.25) return;
          out.push({ cause: c.v, label: c.l, effect: e, lag: l, ...st, gap });
        });
      });
    });
    out.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    const seen = new Set(), list = [];
    out.forEach((o) => {
      const k = o.cause + "|" + o.effect;
      if (seen.has(k)) return;
      seen.add(k); list.push(o);
    });
    return { ready: true, dayCount, list: list.slice(0, 6) };
  }, [state, causeOptions]);

  const bestPattern = useMemo(() => {
    if (!state) return null;
    const manual = state.hypotheses.map((h) => ({ h, ...hypoStats(h) }))
      .filter((x) => x.n > state.settings.tierLow && x.withRate - x.withoutRate > 0.15)
      .sort((a, b) => (b.withRate - b.withoutRate) - (a.withRate - a.withoutRate))[0];
    if (manual) return manual;
    const auto = autoFindings.list[0];
    if (!auto) return null;
    return { h: { cause: auto.cause, effect: auto.effect, lag: auto.lag }, ...auto, auto: true };
  }, [state, autoFindings]);

  const todayPhase = state ? phaseOf(today, state.cycleInfo) : null;

  if (!state) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, ...font }}>
      <div className="text-sm" style={{ color: C.sub }}>기록을 불러오는 중…</div>
    </div>
  );

  const TABS = [["home", "홈", "🏠"], ["skin", "피부", "✨"], ["muscle", "바디", "💪"], ["gut", "이너", "🍽️"], ["report", "리포트", "📋"], ["settings", "설정", "⚙️"]];
  const dueCount = board.filter((b) => b.due).length;

  return (
    <div className="min-h-screen" style={{ background: C.bg, ...font }}>
      <div className="max-w-md mx-auto px-4"
        style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
        <div className="flex items-baseline justify-between mb-4 px-1">
          <div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: C.ink }}>Body Signal</div>
            <div className="text-xs mt-0.5" style={{ color: C.sub }}>{today} · 할 일 {dueCount}건 · 입력 {pctStr(pct.total)}</div>
          </div>
          <span className="px-2.5 h-9 rounded-2xl flex items-center text-sm font-extrabold"
            style={{ background: dueCount ? C.redSoft : C.greenSoft, color: dueCount ? C.red : C.green }}>{dueCount ? `⭐️ ${dueCount}` : "✓"}</span>
        </div>

        {tab === "home" && <HomeTab {...{ state, setState, day, setDay, pct, board, doBoard, bestPattern, causeLabel, tierOf, tierMsg, setTab, hkWrite, todayPhase, alerts, testInfo, productInfo, fetchWeather, wxBusy, wxErr }} />}
        {tab === "skin" && <SkinTab {...{ state, setState, day, setDay, flash, pct }} />}
        {tab === "muscle" && <MuscleTab {...{ state, setState, day, setDay, today, flash, pct, hkWrite, photos, addPhoto }} />}
        {tab === "gut" && <GutTab {...{ state, setState, day, setDay, flash, pct }} />}
        {tab === "report" && <ReportTab {...{ state, setState, today, pct, dailyReport, rangeReport, hypoStats, causeLabel, tierOf, tierMsg, phaseStats, setTab, autoFindings, uid }} />}
        {tab === "settings" && <SettingsTab {...{ state, setState, causeOptions, flash, productInfo, testInfo, testingOther, startTest, exportJSON, exportCSV, today, resetAll }} />}
      </div>

      {toast && (
        <div className="fixed left-1/2 bottom-24 -translate-x-1/2 px-4 py-2.5 rounded-2xl text-sm font-bold z-50"
          style={{ background: C.ink, color: "#fff" }}>{toast}</div>
      )}

      <div className="fixed bottom-0 left-0 right-0"
        style={{ background: "rgba(255,255,255,0.94)", borderTop: `1px solid ${C.line}`, backdropFilter: "blur(8px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-md mx-auto flex">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)} className="flex-1 py-3 flex flex-col items-center gap-0.5" style={{ border: "none", background: "none" }}>
              <span className="text-base" style={{ opacity: tab === id ? 1 : 0.45 }}>{icon}</span>
              <span className="text-xs font-bold" style={{ color: tab === id ? C.accent : C.gray }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
