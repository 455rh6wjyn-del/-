import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  clearResponses,
  hashPw,
  saveConfig,
  savePlan,
  saveProjects,
  saveResponse,
  subscribeConfig,
  subscribePlan,
  subscribePlans,
  subscribeProjects,
  subscribeResponses,
  subscribeResponsesByEmail,
} from "./store";

/* ── 장부(ledger) 토큰 ───────────────────────────────────────── */
const C = {
  paper: "#F1F4F0",
  bar: "#E0E8DE",
  rule: "#C3CFC0",
  ink: "#1B211D",
  ink2: "#5A655C",
  red: "#9E3520",
  redSoft: "#F0DED8",
  seal: "#1F4D3A",
  sealSoft: "#DCE7DF",
  card: "#FBFCFA",
};
const SANS =
  "'Pretendard Variable','Pretendard','Apple SD Gothic Neo','Malgun Gothic',-apple-system,BlinkMacSystemFont,system-ui,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

/* ── 조사 설정: 여기만 고치면 화면·엑셀·표가 함께 따라간다 ──── */
const MONTHS = [9, 10, 11, 12];
const MKEY = (m) => `m${m}`;
const SPAN = `${MONTHS[0]}~${MONTHS[MONTHS.length - 1]}월`;
const BUDGET_YEAR = 2026;
const NEXT_YEAR = BUDGET_YEAR + 1;
const UNIT = "백만원";

/* ── 유틸 ───────────────────────────────────────────────────── */
const digits = (s) => String(s ?? "").replace(/[^0-9]/g, "");
const num = (n) => (Number(n) || 0).toLocaleString("ko-KR");
const bizFmt = (b) => {
  const d = digits(b);
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d || "—";
};
const emailKey = (s) => String(s ?? "").trim().toLowerCase();
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey(s));
/** 명단을 다시 올려도 같은 프로젝트면 기존 입력이 그대로 붙도록 결정적인 ID 를 쓴다. */
const projectId = (email, year, name) =>
  `${emailKey(email)}::${digits(year)}::${String(name ?? "").trim()}`.replace(/\//g, "／");
const todayISO = () => new Date().toISOString().slice(0, 10);
const isPast = (iso) => {
  if (!iso) return false;
  return Date.now() > new Date(iso + "T23:59:59").getTime();
};
const dday = (iso) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 86400000);
};
const stamp = (t) =>
  t ? new Date(t).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";

const monthSum = (r) => MONTHS.reduce((s, m) => s + (r?.[MKEY(m)] || 0), 0);
/** 배정금액 − 집행액 − 월별계획 − 미집행예정액. 0 이어야 제출할 수 있다. */
const leftOver = (p, r) => (p.budget || 0) - (p.spent || 0) - monthSum(r) - (r?.unspent || 0);
const statusOf = (r) => r?.status || "none";
const STATUS_TEXT = { submitted: "제출완료", draft: "임시저장", none: "미입력" };

/* ── 공용 조각 ──────────────────────────────────────────────── */
function Label({ children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: "0.12em", color: C.ink2, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, kind = "solid", disabled, small, full }) {
  const base = {
    fontFamily: SANS,
    fontSize: small ? 13 : 14,
    fontWeight: 600,
    padding: small ? "7px 14px" : "11px 22px",
    borderRadius: 2,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 140ms, opacity 140ms",
    width: full ? "100%" : undefined,
    opacity: disabled ? 0.45 : 1,
  };
  const kinds = {
    solid: { background: C.ink, color: C.paper, border: `1px solid ${C.ink}` },
    seal: { background: C.seal, color: "#F4F8F4", border: `1px solid ${C.seal}` },
    ghost: { background: "transparent", color: C.ink, border: `1px solid ${C.rule}` },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.red}` },
  };
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...kinds[kind] }}>
      {children}
    </button>
  );
}

function StatusTag({ status, text }) {
  const tone =
    status === "submitted"
      ? { bg: C.sealSoft, fg: C.seal, line: C.seal }
      : status === "draft"
      ? { bg: C.bar, fg: C.ink2, line: C.rule }
      : { bg: C.redSoft, fg: C.red, line: C.red };
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 2,
        whiteSpace: "nowrap",
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.line}`,
      }}
    >
      {text || STATUS_TEXT[status]}
    </span>
  );
}

function TextInput({ value, onChange, placeholder, disabled, onEnter, type = "text", mono }) {
  return (
    <input
      type={type}
      disabled={disabled}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()}
      style={{
        width: "100%",
        fontFamily: mono ? MONO : SANS,
        fontSize: 14,
        padding: "10px 12px",
        background: disabled ? C.bar : C.card,
        color: C.ink,
        border: `1px solid ${C.rule}`,
        borderRadius: 2,
        outline: "none",
      }}
    />
  );
}

function MoneyInput({ value, onChange, disabled, invalid }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        inputMode="numeric"
        disabled={disabled}
        value={value ? num(value) : ""}
        placeholder="0"
        onChange={(e) => onChange(Number(digits(e.target.value) || 0))}
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: MONO,
          fontSize: 15,
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
          padding: "10px 12px",
          background: disabled ? C.bar : C.card,
          color: C.ink,
          border: `1px solid ${invalid ? C.red : C.rule}`,
          borderRadius: 2,
          outline: "none",
        }}
      />
      <span style={{ fontSize: 12, color: C.ink2, whiteSpace: "nowrap" }}>{UNIT}</span>
    </div>
  );
}

/* ── 서명 요소: 대차 레일 ───────────────────────────────────── */
function BalanceRail({ budget, spent, months, unspent, diff }) {
  const used = spent + MONTHS.reduce((s, m) => s + (months[MKEY(m)] || 0), 0) + unspent;
  const scale = Math.max(budget, used) || 1;
  const pct = (v) => `${(v / scale) * 100}%`;
  const balanced = diff === 0 && budget > 0;
  const over = diff < 0;
  const tints = ["#7E9C86", "#6D9078", "#5C846A", "#4B785C"];

  return (
    <div>
      <div
        style={{
          position: "relative",
          height: 34,
          background: C.bar,
          border: `1px solid ${C.rule}`,
          borderRadius: 2,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div
          style={{
            width: pct(spent),
            background: `repeating-linear-gradient(45deg, ${C.ink2}, ${C.ink2} 3px, #6E7970 3px, #6E7970 6px)`,
            transition: "width 260ms ease",
          }}
          title={`현재까지 집행액 ${num(spent)}${UNIT}`}
        />
        {MONTHS.map((m, i) => (
          <div
            key={m}
            style={{
              width: pct(months[MKEY(m)] || 0),
              background: tints[i % tints.length],
              borderLeft: (months[MKEY(m)] || 0) > 0 ? `1px solid ${C.paper}` : "none",
              transition: "width 260ms ease",
            }}
            title={`${m}월 ${num(months[MKEY(m)] || 0)}${UNIT}`}
          />
        ))}
        <div
          style={{
            width: pct(unspent),
            background: `repeating-linear-gradient(90deg, #A9BCAF, #A9BCAF 2px, ${C.bar} 2px, ${C.bar} 5px)`,
            borderLeft: unspent > 0 ? `1px solid ${C.paper}` : "none",
            transition: "width 260ms ease",
          }}
          title={`미집행예정액 ${num(unspent)}${UNIT}`}
        />
        {over && (
          <div
            style={{
              width: pct(-diff),
              background: `repeating-linear-gradient(45deg, ${C.red}, ${C.red} 4px, #B5462F 4px, #B5462F 8px)`,
              transition: "width 260ms ease",
            }}
            title={`초과 ${num(-diff)}${UNIT}`}
          />
        )}
        {budget > 0 && used > budget && (
          <div style={{ position: "absolute", left: pct(budget), top: 0, bottom: 0, width: 2, background: C.ink }} />
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, color: C.ink2 }}>
          배분 {num(used)} / 배정 {num(budget)}
          {UNIT}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 15,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: balanced ? C.seal : C.red,
            borderTop: balanced ? `1px solid ${C.seal}` : "none",
            borderBottom: balanced ? `3px double ${C.seal}` : "none",
            paddingBottom: balanced ? 2 : 0,
          }}
        >
          {balanced
            ? "대차 일치"
            : diff > 0
            ? `미배분 ${num(diff)}${UNIT}`
            : `초과 ${num(-diff)}${UNIT}`}
        </div>
      </div>
    </div>
  );
}

/* ── 항목 한 줄 (확인서·미리보기 공용) ──────────────────────── */
function Line({ k, v, strong, double }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "9px 0",
        borderTop: double ? `3px double ${C.ink}` : `1px solid ${C.rule}`,
      }}
    >
      <span style={{ fontSize: 13, color: strong ? C.ink : C.ink2, fontWeight: strong ? 700 : 400 }}>{k}</span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: strong ? 16 : 14,
          fontWeight: strong ? 700 : 500,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v}
      </span>
    </div>
  );
}

/* ── 프로젝트 입력 화면 ─────────────────────────────────────── */
function ProjectSheet({ project, response, deadline, onSave, onBack }) {
  const closed = isPast(deadline);
  const [months, setMonths] = useState(() => {
    const o = {};
    MONTHS.forEach((m) => (o[MKEY(m)] = response?.[MKEY(m)] || 0));
    return o;
  });
  const [unspent, setUnspent] = useState(response?.unspent || 0);
  const [manager, setManager] = useState(response?.manager || "");
  const [phone, setPhone] = useState(response?.phone || "");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(response?.status === "submitted" ? "done" : "edit");

  const sum = MONTHS.reduce((s, m) => s + (months[MKEY(m)] || 0), 0);
  const diff = (project.budget || 0) - (project.spent || 0) - sum - unspent;
  const balanced = diff === 0;
  const missing = !manager.trim() || !phone.trim();
  const canPreview = balanced && !missing && !closed;

  const flash = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 2600);
  };

  const payload = (status) => ({
    ...months,
    unspent,
    manager: manager.trim(),
    phone: phone.trim(),
    status,
  });

  const submit = async () => {
    setBusy(true);
    try {
      await onSave(payload("submitted"));
      setMode("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      flash("저장하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
      setMode("edit");
    } finally {
      setBusy(false);
    }
  };

  const draft = async () => {
    setBusy(true);
    try {
      await onSave(payload("draft"));
      flash("임시저장했습니다.");
    } catch {
      flash("저장하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const head = (
    <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.ink2 }}>
            {project.year}년 선정 · {project.company}
          </div>
          <div style={{ fontSize: 23, fontWeight: 700, marginTop: 5, letterSpacing: "-0.02em" }}>
            {project.name}
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{ background: "none", border: "none", color: C.ink2, fontSize: 12, cursor: "pointer", fontFamily: SANS, whiteSpace: "nowrap" }}
        >
          목록으로
        </button>
      </div>
    </div>
  );

  const detail = (
    <div style={{ marginTop: 4 }}>
      <Line k={`${BUDGET_YEAR}년 배정금액`} v={`${num(project.budget)} ${UNIT}`} />
      <Line k="현재까지 집행액" v={`${num(project.spent)} ${UNIT}`} />
      {MONTHS.map((m) => (
        <Line key={m} k={`${m}월 인출계획`} v={`${num(months[MKEY(m)] || 0)} ${UNIT}`} />
      ))}
      <Line k={`${SPAN} 합계`} v={`${num(sum)} ${UNIT}`} strong double />
      <Line k="미집행예정액" v={`${num(unspent)} ${UNIT}`} />
    </div>
  );

  /* ── 미리보기 ── */
  if (mode === "preview") {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "28px 20px 70px" }}>
        {head}
        <div style={{ border: `1px solid ${C.rule}`, background: C.card, borderRadius: 2, padding: "24px 24px 20px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.ink2 }}>제출 전 확인</div>
          <div style={{ fontSize: 20, fontWeight: 700, margin: "6px 0 4px" }}>이 내용으로 제출합니다</div>
          <div style={{ fontSize: 13, color: C.ink2 }}>
            아래 내용을 확인하신 뒤 최종 제출을 눌러 주세요.
          </div>
          {detail}
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: C.sealSoft,
              border: `1px solid ${C.seal}`,
              color: C.seal,
              fontSize: 13,
              borderRadius: 2,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            집행액 + {SPAN} 합계 + 미집행예정액 = {BUDGET_YEAR}년 배정금액 · 대차 일치
          </div>
          <div style={{ marginTop: 16, fontSize: 13, color: C.ink2 }}>
            담당자 {manager} · {phone}
          </div>
        </div>

        {toast && (
          <div style={{ marginTop: 16, background: C.redSoft, border: `1px solid ${C.red}`, color: C.red, padding: "11px 14px", fontSize: 13, borderRadius: 2 }}>
            {toast}
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Btn kind="ghost" onClick={() => setMode("edit")} disabled={busy}>
            고치러 가기
          </Btn>
          <Btn kind="seal" onClick={submit} disabled={busy}>
            {busy ? "제출 중…" : "최종 제출"}
          </Btn>
        </div>
      </div>
    );
  }

  /* ── 제출완료 확인서 ── */
  if (mode === "done") {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "28px 20px 70px" }}>
        {head}
        <div style={{ border: `1px solid ${C.rule}`, background: C.card, borderRadius: 2, padding: "30px 26px 26px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>제출이 완료되었습니다</div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: C.ink2, marginTop: 6 }}>
                제출일시 {stamp(response?.updatedAt || Date.now())}
              </div>
            </div>
            <div
              style={{
                border: `2px solid ${C.seal}`,
                color: C.seal,
                borderRadius: "50%",
                width: 88,
                height: 88,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: "rotate(-10deg)",
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.2em" }}>검 인</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 3 }}>제출완료</div>
            </div>
          </div>

          {detail}

          <div style={{ marginTop: 18, fontSize: 13, color: C.ink2 }}>
            담당자 {manager}
            {phone ? ` · ${phone}` : ""}
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!closed && (
            <Btn kind="ghost" onClick={() => setMode("edit")}>
              수정하기
            </Btn>
          )}
          <Btn kind="solid" onClick={onBack}>
            목록으로
          </Btn>
          <div style={{ fontSize: 12, color: C.ink2 }}>
            {closed
              ? `${deadline} 마감되어 더 이상 수정할 수 없습니다.`
              : deadline
              ? `${deadline}까지 수정할 수 있습니다.`
              : "마감 전까지 수정할 수 있습니다."}
          </div>
        </div>
      </div>
    );
  }

  /* ── 입력 ── */
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 150px" }}>
      {head}

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.rule}`, marginBottom: 26, flexWrap: "wrap" }}>
        {[
          [`${BUDGET_YEAR}년 배정금액`, project.budget],
          ["현재까지 집행액", project.spent],
          ["남은 금액", (project.budget || 0) - (project.spent || 0)],
        ].map(([k, v], i) => (
          <div key={k} style={{ flex: 1, minWidth: 110, padding: "14px 0", borderLeft: i ? `1px solid ${C.rule}` : "none", paddingLeft: i ? 16 : 0 }}>
            <div style={{ fontSize: 11, color: C.ink2, letterSpacing: "0.06em" }}>{k}</div>
            <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, fontVariantNumeric: "tabular-nums", marginTop: 5 }}>
              {num(v)}
              <span style={{ fontSize: 11, color: C.ink2, marginLeft: 4 }}>{UNIT}</span>
            </div>
          </div>
        ))}
      </div>

      {closed && (
        <div style={{ background: C.redSoft, border: `1px solid ${C.red}`, color: C.red, padding: "12px 14px", fontSize: 13, marginBottom: 22, borderRadius: 2 }}>
          제출이 마감되었습니다({deadline}). 수정하시려면 사업 담당자에게 연락해 주세요.
        </div>
      )}

      {!closed && response?.status === "submitted" && (
        <div style={{ background: C.bar, border: `1px solid ${C.rule}`, color: C.ink2, padding: "12px 14px", fontSize: 13, marginBottom: 22, borderRadius: 2 }}>
          이미 제출한 내용을 고치는 중입니다. 다시 제출해야 변경 내용이 반영됩니다.
        </div>
      )}

      <Label>월별 인출 계획 ({UNIT})</Label>
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, overflow: "hidden", marginBottom: 22 }}>
        {MONTHS.map((m, i) => (
          <div
            key={m}
            style={{
              display: "grid",
              gridTemplateColumns: "84px 1fr",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: i % 2 ? C.bar : C.card,
              borderTop: i ? `1px solid ${C.rule}` : "none",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>{m}월</div>
            <MoneyInput
              value={months[MKEY(m)]}
              disabled={closed}
              onChange={(v) => setMonths((p) => ({ ...p, [MKEY(m)]: v }))}
            />
          </div>
        ))}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "84px 1fr",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderTop: `3px double ${C.ink}`,
            background: C.card,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>합계</div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", paddingRight: 46 }}>
            {num(sum)}
          </div>
        </div>
      </div>

      <Label>미집행예정액 ({UNIT})</Label>
      <p style={{ fontSize: 12, color: C.ink2, margin: "0 0 8px" }}>
        {BUDGET_YEAR}년 배정금액 중 올해 안에 집행하지 않을 금액을 적어 주세요. 전액 집행하실 예정이면 0으로 두시면 됩니다.
      </p>
      <div style={{ marginBottom: 26, maxWidth: 320 }}>
        <MoneyInput value={unspent} disabled={closed} onChange={setUnspent} />
      </div>

      <Label>담당자</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 26 }}>
        <TextInput value={manager} onChange={setManager} placeholder="담당자명" disabled={closed} />
        <TextInput value={phone} onChange={setPhone} placeholder="연락처" disabled={closed} />
      </div>

      {toast && (
        <div style={{ background: C.sealSoft, border: `1px solid ${C.seal}`, color: C.seal, padding: "11px 14px", fontSize: 13, borderRadius: 2, marginBottom: 20 }}>
          {toast}
        </div>
      )}

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: C.paper,
          borderTop: `1px solid ${C.rule}`,
          padding: "14px 20px 16px",
          boxShadow: "0 -6px 20px rgba(27,33,29,0.07)",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <BalanceRail
            budget={project.budget || 0}
            spent={project.spent || 0}
            months={months}
            unspent={unspent}
            diff={diff}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Btn kind="ghost" onClick={draft} disabled={closed || busy} small>
              임시저장
            </Btn>
            <Btn kind="seal" onClick={() => setMode("preview")} disabled={!canPreview}>
              미리보기
            </Btn>
            <div style={{ fontSize: 12, color: C.ink2 }}>
              {closed
                ? "마감됨"
                : busy
                ? "저장 중…"
                : !balanced
                ? `집행액 + ${SPAN} 합계 + 미집행예정액이 배정금액과 같아야 합니다`
                : missing
                ? "담당자명과 연락처를 입력해 주세요"
                : "미리보기에서 확인 후 제출합니다"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 내년 신규 신청 계획 (업체 단위 1회) ────────────────────── */
function NextYearPlan({ plan, closed, onSave }) {
  const [apply, setApply] = useState(plan?.apply || "");
  const [totalCost, setTotalCost] = useState(plan?.totalCost || 0);
  const [loanWanted, setLoanWanted] = useState(plan?.loanWanted || 0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const dirty =
    apply !== (plan?.apply || "") ||
    totalCost !== (plan?.totalCost || 0) ||
    loanWanted !== (plan?.loanWanted || 0);

  const save = async () => {
    setBusy(true);
    setNote("");
    try {
      await onSave({
        apply,
        totalCost: apply === "yes" ? totalCost : 0,
        loanWanted: apply === "yes" ? loanWanted : 0,
      });
      setNote("저장했습니다.");
      setTimeout(() => setNote(""), 2600);
    } catch {
      setNote("저장하지 못했습니다. 네트워크를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const choice = (val, text) => (
    <button
      key={val}
      type="button"
      disabled={closed}
      onClick={() => setApply(val)}
      style={{
        flex: 1,
        padding: "11px 12px",
        fontFamily: SANS,
        fontSize: 14,
        fontWeight: apply === val ? 700 : 500,
        cursor: closed ? "not-allowed" : "pointer",
        background: apply === val ? C.sealSoft : C.card,
        color: apply === val ? C.seal : C.ink2,
        border: `1px solid ${apply === val ? C.seal : C.rule}`,
        borderRadius: 2,
      }}
    >
      {text}
    </button>
  );

  return (
    <div style={{ border: `1px solid ${C.rule}`, background: C.card, borderRadius: 2, padding: "20px 20px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{NEXT_YEAR}년 신규 프로젝트 신청 계획</div>
        <StatusTag status={plan?.apply ? "submitted" : "none"} text={plan?.apply ? "응답완료" : "미응답"} />
      </div>
      <p style={{ fontSize: 13, color: C.ink2, margin: "8px 0 16px", lineHeight: 1.6 }}>
        위 프로젝트들과는 별개로, {NEXT_YEAR}년에 새 프로젝트로 융자지원을 신청하실 계획이 있는지
        업체당 한 번만 답해 주세요. 위 인출계획 검증과는 무관합니다.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: apply === "yes" ? 18 : 8 }}>
        {choice("yes", "신청 계획 있음")}
        {choice("no", "신청 계획 없음")}
      </div>

      {apply === "yes" && (
        <div style={{ display: "grid", gap: 14, marginBottom: 8 }}>
          <div>
            <Label>프로젝트 총 사업비 ({UNIT})</Label>
            <MoneyInput value={totalCost} disabled={closed} onChange={setTotalCost} />
          </div>
          <div>
            <Label>그중 융자 신청 희망액 ({UNIT})</Label>
            <MoneyInput value={loanWanted} disabled={closed} onChange={setLoanWanted} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <Btn kind="seal" small onClick={save} disabled={closed || busy || !apply || !dirty}>
          {busy ? "저장 중…" : plan?.apply ? "수정 내용 저장" : "저장"}
        </Btn>
        <div style={{ fontSize: 12, color: note.startsWith("저장하지") ? C.red : C.ink2 }}>
          {note || (closed ? "마감됨" : dirty ? "저장하지 않은 변경이 있습니다" : "")}
        </div>
      </div>
    </div>
  );
}

/* ── 업체 화면: 프로젝트 목록 ───────────────────────────────── */
function Hub({ email, projects, responses, plan, config, onOpen, onSavePlan, onExit }) {
  const closed = isPast(config.deadline);
  const company = projects[0]?.company || "";
  const done = projects.filter((p) => statusOf(responses[p.id]) === "submitted").length;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 70px" }}>
      <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.ink2 }}>자금수요조사</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{company}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.ink2, marginTop: 3 }}>{email}</div>
          </div>
          <button
            type="button"
            onClick={onExit}
            style={{ background: "none", border: "none", color: C.ink2, fontSize: 12, cursor: "pointer", fontFamily: SANS }}
          >
            나가기
          </button>
        </div>
      </div>

      {closed && (
        <div style={{ background: C.redSoft, border: `1px solid ${C.red}`, color: C.red, padding: "12px 14px", fontSize: 13, marginBottom: 20, borderRadius: 2 }}>
          제출이 마감되었습니다({config.deadline}). 수정하시려면 사업 담당자에게 연락해 주세요.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <Label>지원받는 프로젝트 {projects.length}건</Label>
        <div style={{ fontSize: 12, color: C.ink2 }}>
          제출 {done} / {projects.length}건
          {config.deadline && !closed && dday(config.deadline) !== null ? ` · 마감 D-${dday(config.deadline)}` : ""}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
        {projects.map((p) => {
          const r = responses[p.id];
          const st = statusOf(r);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p)}
              style={{
                textAlign: "left",
                background: C.card,
                border: `1px solid ${C.rule}`,
                borderRadius: 2,
                padding: "16px 18px",
                cursor: "pointer",
                fontFamily: SANS,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: C.ink2, letterSpacing: "0.06em" }}>{p.year}년 선정</div>
                <div style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 6px", color: C.ink }}>{p.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: C.ink2, fontVariantNumeric: "tabular-nums" }}>
                  배정 {num(p.budget)} · 집행 {num(p.spent)} {UNIT}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                <StatusTag status={st} />
                <span style={{ fontSize: 12, color: C.ink2 }}>
                  {closed ? "보기" : st === "none" ? "입력하기 →" : "수정하기 →"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <NextYearPlan plan={plan} closed={closed} onSave={onSavePlan} />
    </div>
  );
}

/* ── 관리자 ─────────────────────────────────────────────────── */
const HEADERS = [
  "선정연도",
  "프로젝트명",
  "업체명",
  "사업자번호",
  "이메일",
  "배정금액",
  "집행액",
  ...MONTHS.map((m) => `${m}월`),
  "합계",
  "미집행예정액",
  "검증",
  "상태",
  "담당자",
  "최종수정",
];

function Admin({ data, onExit }) {
  const [tab, setTab] = useState("현황");
  const [note, setNote] = useState("");
  const fileRef = useRef(null);
  const flash = (t) => {
    setNote(t);
    setTimeout(() => setNote(""), 3200);
  };

  const rows = useMemo(
    () =>
      data.projects.map((p) => {
        const r = data.responses[p.id] || {};
        const sum = monthSum(r);
        return {
          ...p,
          r,
          sum,
          unspent: r.unspent || 0,
          check: (p.spent || 0) + sum + (r.unspent || 0) - (p.budget || 0),
          status: statusOf(r),
        };
      }),
    [data]
  );

  /** 내년 계획은 업체(이메일) 단위라 프로젝트 목록에서 업체를 뽑아 붙인다. */
  const companies = useMemo(() => {
    const map = new Map();
    data.projects.forEach((p) => {
      if (!map.has(p.email)) map.set(p.email, { email: p.email, company: p.company, bizNo: p.bizNo });
    });
    return [...map.values()].map((c) => ({ ...c, plan: data.plans[c.email] || {} }));
  }, [data]);

  const done = rows.filter((r) => r.status === "submitted").length;
  const drafting = rows.filter((r) => r.status === "draft").length;
  const planYes = companies.filter((c) => c.plan.apply === "yes").length;
  const planAnswered = companies.filter((c) => c.plan.apply).length;
  const d = dday(data.config.deadline);

  const loadXLSX = () => import("xlsx");

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
      ["선정연도", "프로젝트명", "업체명", "사업자번호", "이메일", `${BUDGET_YEAR}년 배정금액(${UNIT})`, `현재까지 집행액(${UNIT})`],
      [2024, "(예시) 탄소저감 설비 도입", "(예시) 가나다산업", "1234567890", "hong@example.com", 1000, 400],
      [2025, "(예시) 공정 전기화", "(예시) 가나다산업", "1234567890", "hong@example.com", 500, 100],
    ]);
    ws["!cols"] = [{ wch: 10 }, { wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 26 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "프로젝트명단");
    XLSX.writeFile(wb, "자금수요조사_명단_양식.xlsx");
  };

  const downloadResults = async () => {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();

    const sheet1 = rows.map((x) => ({
      선정연도: x.year,
      프로젝트명: x.name,
      업체명: x.company,
      사업자번호: bizFmt(x.bizNo),
      이메일: x.email,
      [`${BUDGET_YEAR}년 배정금액`]: x.budget,
      "현재까지 집행액": x.spent,
      ...Object.fromEntries(MONTHS.map((m) => [`${m}월`, x.r[MKEY(m)] || 0])),
      [`${SPAN} 합계`]: x.sum,
      미집행예정액: x.unspent,
      "검증(집행+합계+미집행-배정)": x.check,
      상태: STATUS_TEXT[x.status],
      담당자: x.r.manager || "",
      연락처: x.r.phone || "",
      최종수정: stamp(x.r.updatedAt),
    }));
    const ws1 = XLSX.utils.json_to_sheet(sheet1);
    ws1["!cols"] = Object.keys(sheet1[0] || { a: 1 }).map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws1, `${BUDGET_YEAR} 인출계획`);

    const sheet2 = companies.map((c) => ({
      업체명: c.company,
      사업자번호: bizFmt(c.bizNo),
      이메일: c.email,
      "신청 계획": c.plan.apply === "yes" ? "있음" : c.plan.apply === "no" ? "없음" : "미응답",
      [`총 사업비(${UNIT})`]: c.plan.totalCost || 0,
      [`융자 신청 희망액(${UNIT})`]: c.plan.loanWanted || 0,
      최종수정: stamp(c.plan.updatedAt),
    }));
    const ws2 = XLSX.utils.json_to_sheet(sheet2);
    ws2["!cols"] = Object.keys(sheet2[0] || { a: 1 }).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws2, `${NEXT_YEAR} 신규계획`);

    XLSX.writeFile(wb, `자금수요조사_결과_${todayISO()}.xlsx`);
  };

  const upload = async (file) => {
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const pick = (o, keys) => {
        for (const k of Object.keys(o)) {
          const kk = k.replace(/\s/g, "").toLowerCase();
          if (keys.some((t) => kk.includes(t))) return o[k];
        }
        return undefined;
      };
      const seen = new Set();
      const list = [];
      json.forEach((o) => {
        const email = emailKey(pick(o, ["이메일", "메일", "mail"]));
        const name = String(pick(o, ["프로젝트"]) ?? "").trim();
        const year = digits(pick(o, ["선정연도", "연도"]));
        if (!isEmail(email) || !name) return;
        const id = projectId(email, year, name);
        if (seen.has(id)) return;
        seen.add(id);
        list.push({
          id,
          year: Number(year) || "",
          name,
          company: String(pick(o, ["업체", "기업", "회사"]) ?? "").trim(),
          bizNo: digits(pick(o, ["사업자"])),
          email,
          budget: Number(digits(pick(o, ["배정"]))) || 0,
          spent: Number(digits(pick(o, ["집행"]))) || 0,
        });
      });
      if (!list.length) {
        flash("읽을 수 있는 행이 없습니다. 머리글에 선정연도 · 프로젝트명 · 이메일이 있는지, 이메일 형식이 맞는지 확인해 주세요.");
        return;
      }
      await saveProjects(list);
      if (fileRef.current) fileRef.current.value = "";
      const emails = new Set(list.map((x) => x.email));
      flash(`${emails.size}개사 · ${list.length}개 프로젝트를 등록했습니다.`);
    } catch {
      flash("파일을 읽지 못했거나 저장에 실패했습니다. xlsx 형식과 네트워크를 확인해 주세요.");
    }
  };

  const setDeadline = async (v) => {
    try {
      await saveConfig({ deadline: v });
    } catch {
      flash("마감일을 저장하지 못했습니다. 네트워크를 확인해 주세요.");
    }
  };

  const wipeResponses = async () => {
    if (!window.confirm("업체가 입력한 인출계획과 내년 신청 계획을 모두 지웁니다. 되돌릴 수 없습니다. 진행할까요?")) return;
    try {
      const n = await clearResponses();
      flash(`입력값 ${n}건을 지웠습니다.`);
    } catch {
      flash("삭제에 실패했습니다. 네트워크를 확인해 주세요.");
    }
  };

  const Stat = ({ k, v, tone }) => (
    <div style={{ flex: 1, minWidth: 108, padding: "14px 16px", background: C.card, border: `1px solid ${C.rule}`, borderRadius: 2 }}>
      <div style={{ fontSize: 11, color: C.ink2, letterSpacing: "0.06em" }}>{k}</div>
      <div style={{ fontFamily: MONO, fontSize: 21, fontWeight: 700, marginTop: 4, color: tone || C.ink, fontVariantNumeric: "tabular-nums" }}>
        {v}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 20px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${C.ink}`, paddingBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>관리자</div>
        <button type="button" onClick={onExit} style={{ background: "none", border: "none", color: C.ink2, fontSize: 12, cursor: "pointer", fontFamily: SANS }}>
          나가기
        </button>
      </div>

      <div style={{ display: "flex", gap: 20, margin: "16px 0 22px" }}>
        {["현황", "명단", "설정"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              padding: "4px 0",
              cursor: "pointer",
              fontFamily: SANS,
              fontSize: 14,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? C.ink : C.ink2,
              borderBottom: tab === t ? `2px solid ${C.seal}` : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {note && (
        <div style={{ background: C.sealSoft, border: `1px solid ${C.seal}`, color: C.seal, padding: "11px 14px", fontSize: 13, borderRadius: 2, marginBottom: 18 }}>
          {note}
        </div>
      )}

      {tab === "현황" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Stat k="대상 프로젝트" v={`${rows.length}건`} />
            <Stat k="제출완료" v={`${done}건`} tone={C.seal} />
            <Stat k="임시저장" v={`${drafting}건`} />
            <Stat k="미입력" v={`${rows.length - done - drafting}건`} tone={C.red} />
            <Stat k="마감" v={d === null ? "미설정" : d >= 0 ? `D-${d}` : "마감됨"} tone={d !== null && d < 0 ? C.red : C.ink} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <Stat k="대상 업체" v={`${companies.length}개사`} />
            <Stat k={`${NEXT_YEAR} 계획 응답`} v={`${planAnswered}개사`} />
            <Stat k={`${NEXT_YEAR} 신청 예정`} v={`${planYes}개사`} tone={C.seal} />
            <Stat
              k={`${NEXT_YEAR} 융자 희망 합계`}
              v={`${num(companies.reduce((s, c) => s + (c.plan.loanWanted || 0), 0))}`}
            />
          </div>

          <div style={{ height: 8, background: C.bar, border: `1px solid ${C.rule}`, borderRadius: 2, overflow: "hidden", marginBottom: 18 }}>
            <div style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%`, height: "100%", background: C.seal, transition: "width 300ms" }} />
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <Btn kind="ghost" small onClick={downloadResults} disabled={!rows.length}>
              결과 엑셀 내려받기
            </Btn>
            <div style={{ fontSize: 12, color: C.ink2, alignSelf: "center" }}>
              업체가 제출하면 실시간으로 갱신됩니다 · 금액 단위 {UNIT}
            </div>
          </div>

          <div style={{ overflowX: "auto", border: `1px solid ${C.rule}`, borderRadius: 2 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1100 }}>
              <thead>
                <tr style={{ background: C.ink, color: C.paper }}>
                  {HEADERS.map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "9px 10px",
                        textAlign: ["프로젝트명", "업체명", "이메일", "상태", "담당자"].includes(h) ? "left" : "right",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x, i) => (
                  <tr key={x.id} style={{ background: i % 2 ? C.bar : C.card }}>
                    <td style={{ padding: "8px 10px", fontFamily: MONO, textAlign: "right", color: C.ink2 }}>{x.year}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{x.name}</td>
                    <td style={{ padding: "8px 10px" }}>{x.company}</td>
                    <td style={{ padding: "8px 10px", fontFamily: MONO, textAlign: "right", color: C.ink2, whiteSpace: "nowrap" }}>{bizFmt(x.bizNo)}</td>
                    <td style={{ padding: "8px 10px", fontFamily: MONO, fontSize: 12, color: C.ink2 }}>{x.email}</td>
                    {[x.budget, x.spent, ...MONTHS.map((m) => x.r[MKEY(m)] || 0), x.sum, x.unspent].map((v, j, arr) => (
                      <td
                        key={j}
                        style={{
                          padding: "8px 10px",
                          fontFamily: MONO,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: j === arr.length - 2 ? 700 : 400,
                        }}
                      >
                        {num(v)}
                      </td>
                    ))}
                    <td
                      style={{
                        padding: "8px 10px",
                        fontFamily: MONO,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: x.status === "none" ? C.ink2 : x.check === 0 ? C.seal : C.red,
                        fontWeight: 600,
                      }}
                    >
                      {x.status === "none" ? "—" : x.check === 0 ? "일치" : num(x.check)}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <StatusTag status={x.status} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>{x.r.manager ? `${x.r.manager} · ${x.r.phone || ""}` : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: C.ink2, whiteSpace: "nowrap" }}>{stamp(x.r.updatedAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={HEADERS.length} style={{ padding: "34px 12px", textAlign: "center", color: C.ink2, background: C.card }}>
                      명단 탭에서 프로젝트 명단을 올리면 여기에 현황이 나옵니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "명단" && (
        <div style={{ maxWidth: 640 }}>
          <Label>1. 입력 양식 내려받기</Label>
          <p style={{ fontSize: 13, color: C.ink2, margin: "0 0 12px", lineHeight: 1.7 }}>
            한 줄에 프로젝트 하나입니다. 같은 업체가 프로젝트를 여러 개 지원받고 있으면 같은 이메일로 여러 줄을 적으시면 됩니다.
            <br />
            금액은 <b style={{ color: C.ink }}>{UNIT} 단위 정수</b>로 적어 주세요. 업체가 입력하는 금액도 같은 단위입니다.
          </p>
          <Btn kind="ghost" small onClick={downloadTemplate}>
            양식 내려받기
          </Btn>

          <div style={{ height: 1, background: C.rule, margin: "26px 0" }} />

          <Label>2. 채운 양식 올리기</Label>
          <p style={{ fontSize: 13, color: C.ink2, margin: "0 0 12px", lineHeight: 1.7 }}>
            올리면 기존 명단을 새 명단으로 바꿉니다. 업체가 이미 입력한 값은 선정연도 · 프로젝트명 · 이메일이 같으면 그대로 유지됩니다.
            <br />
            업체는 <b style={{ color: C.ink }}>이메일 주소</b>로 들어옵니다. 명단의 이메일이 정확해야 합니다.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            style={{ fontSize: 13, fontFamily: SANS }}
          />
          <div style={{ marginTop: 14, fontSize: 13, color: C.ink2 }}>
            현재 등록: <b style={{ color: C.ink }}>{companies.length}개사 · {data.projects.length}개 프로젝트</b>
          </div>
        </div>
      )}

      {tab === "설정" && (
        <div style={{ maxWidth: 420 }}>
          <Label>제출 마감일</Label>
          <input
            type="date"
            value={data.config.deadline || ""}
            onChange={(e) => setDeadline(e.target.value)}
            style={{ fontFamily: MONO, fontSize: 14, padding: "10px 12px", border: `1px solid ${C.rule}`, background: C.card, borderRadius: 2, color: C.ink }}
          />
          <p style={{ fontSize: 12, color: C.ink2, marginTop: 8 }}>
            마감일 당일 자정까지 업체가 수정할 수 있고, 이후에는 화면이 잠깁니다.
          </p>

          <div style={{ height: 1, background: C.rule, margin: "26px 0" }} />

          <Label>입력값 초기화</Label>
          <p style={{ fontSize: 12, color: C.ink2, margin: "0 0 12px" }}>
            업체가 입력한 인출계획과 {NEXT_YEAR}년 신청 계획을 모두 지웁니다. 명단은 남습니다. 되돌릴 수 없습니다.
          </p>
          <Btn kind="danger" small onClick={wipeResponses}>
            입력값 모두 지우기
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ── 진입 화면 ──────────────────────────────────────────────── */
function Gate({ config, projects, onEnter, onAdmin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("company");
  const [err, setErr] = useState("");
  const d = dday(config.deadline);

  const tryEnter = () => {
    const e = emailKey(email);
    if (!isEmail(e)) return setErr("이메일 주소를 정확히 입력해 주세요.");
    if (!projects.some((p) => p.email === e))
      return setErr("조사 대상 명단에 없는 이메일입니다. 사업 담당자에게 문의해 주세요.");
    setErr("");
    onEnter(e);
  };

  const tryAdmin = async () => {
    if (!config.adminPwHash) return setErr("관리자 비밀번호가 아직 설정되지 않았습니다.");
    if ((await hashPw(pw.trim())) !== config.adminPwHash)
      return setErr("비밀번호가 맞지 않습니다. 한/영 상태를 확인해 주세요.");
    setErr("");
    onAdmin();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 12, marginBottom: 22 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.16em", color: C.ink2 }}>
            {config.title || "융자지원 사업"}
          </div>
          <h1 style={{ fontSize: 27, fontWeight: 700, margin: "6px 0 0", letterSpacing: "-0.02em" }}>자금수요조사</h1>
          <p style={{ fontSize: 13, color: C.ink2, margin: "8px 0 0", lineHeight: 1.6 }}>
            {MONTHS[0]}월부터 {MONTHS[MONTHS.length - 1]}월까지 월별 인출 계획과 {NEXT_YEAR}년 신규 신청 계획을 제출합니다.
            금액 단위는 {UNIT}입니다.
            {config.deadline && (
              <>
                {" "}
                마감 {config.deadline}
                {d !== null && d >= 0 ? ` (D-${d})` : " (마감됨)"}.
              </>
            )}
          </p>
        </div>

        {mode === "company" ? (
          <>
            <Label>이메일 주소</Label>
            <TextInput
              value={email}
              onChange={setEmail}
              onEnter={tryEnter}
              placeholder="명단에 등록된 이메일"
              type="email"
              mono
            />
            <p style={{ fontSize: 12, color: C.ink2, margin: "8px 0 0" }}>
              사업 담당자에게 안내받은 이메일 주소로 들어오시면 됩니다.
            </p>
            <div style={{ marginTop: 14 }}>
              <Btn full onClick={tryEnter}>
                들어가기
              </Btn>
            </div>
          </>
        ) : (
          <>
            <Label>관리자 비밀번호</Label>
            <TextInput value={pw} onChange={setPw} onEnter={tryAdmin} type="password" placeholder="비밀번호" />
            <div style={{ marginTop: 14 }}>
              <Btn full onClick={tryAdmin}>
                관리자로 들어가기
              </Btn>
            </div>
          </>
        )}

        {err && (
          <div style={{ marginTop: 14, fontSize: 13, color: C.red, background: C.redSoft, border: `1px solid ${C.red}`, padding: "10px 12px", borderRadius: 2 }}>
            {err}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "company" ? "admin" : "company");
            setErr("");
          }}
          style={{ marginTop: 22, background: "none", border: "none", color: C.ink2, fontSize: 12, cursor: "pointer", fontFamily: SANS, textDecoration: "underline" }}
        >
          {mode === "company" ? "관리자" : "업체 입력으로"}
        </button>
      </div>
    </div>
  );
}

/* ── 최초 설정 ──────────────────────────────────────────────── */
function Setup({ onDone }) {
  const [title, setTitle] = useState("탄소중립전환선도프로젝트 융자지원");
  const [pw, setPw] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const start = async () => {
    setBusy(true);
    setErr("");
    try {
      await onDone({ title: title.trim(), pw: pw.trim(), deadline });
    } catch {
      setErr("저장하지 못했습니다. 네트워크와 Firestore 보안 규칙을 확인해 주세요.");
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 12, marginBottom: 22 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>처음 설정</h1>
          <p style={{ fontSize: 13, color: C.ink2, margin: "8px 0 0" }}>
            한 번만 하면 됩니다. 이후에는 업체 입력 화면이 먼저 나옵니다.
          </p>
        </div>
        <Label>조사명</Label>
        <TextInput value={title} onChange={setTitle} placeholder="사업명" />
        <div style={{ height: 16 }} />
        <Label>관리자 비밀번호</Label>
        <TextInput value={pw} onChange={setPw} type="password" placeholder="관리자만 아는 비밀번호" />
        <p style={{ fontSize: 12, color: C.ink2, margin: "8px 0 0" }}>
          한/영 상태를 확인해 주세요. 나중에 앱에서는 바꿀 수 없습니다.
        </p>
        <div style={{ height: 16 }} />
        <Label>제출 마감일</Label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          style={{ fontFamily: MONO, fontSize: 14, padding: "10px 12px", border: `1px solid ${C.rule}`, background: C.card, borderRadius: 2, color: C.ink }}
        />
        {err && (
          <div style={{ marginTop: 14, fontSize: 13, color: C.red, background: C.redSoft, border: `1px solid ${C.red}`, padding: "10px 12px", borderRadius: 2 }}>
            {err}
          </div>
        )}
        <div style={{ marginTop: 22 }}>
          <Btn full kind="seal" disabled={!pw.trim() || busy} onClick={start}>
            {busy ? "저장 중…" : "시작하기"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ── 앱 ─────────────────────────────────────────────────────── */
export default function App() {
  const [config, setConfig] = useState(null);
  const [projects, setProjects] = useState([]);
  const [responses, setResponses] = useState({});
  const [plans, setPlans] = useState({});
  const [view, setView] = useState("gate");
  const [email, setEmail] = useState("");
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [netErr, setNetErr] = useState("");

  const onErr = useCallback((e) => {
    console.error(e);
    setNetErr("서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 새로고침해 주세요.");
    setLoading(false);
  }, []);

  /* 방화벽 등으로 Firestore 스트림이 열리지 않으면 오류 콜백이 한참 뒤에 오거나
     아예 오지 않는다. 계속 빈 로딩 화면만 보이지 않도록 안내를 띄운다. */
  useEffect(() => {
    if (!loading) return undefined;
    const t = setTimeout(
      () =>
        setNetErr(
          "서버에 연결하는 중입니다. 잠시 후에도 이 화면이면 네트워크나 사내 방화벽 설정을 확인해 주세요."
        ),
      8000
    );
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    const unsubs = [
      subscribeConfig((c, fromCache) => {
        // 캐시가 돌려준 "설정 없음"은 아직 믿지 않는다 (오프라인일 수 있다).
        if (!c && fromCache) return;
        setConfig(c || {});
        setNetErr("");
        setLoading(false);
      }, onErr),
      subscribeProjects(setProjects, onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [onErr]);

  /* 관리자는 전체를, 업체는 자기 이메일 것만 구독한다. */
  useEffect(() => {
    if (view === "admin") {
      setReady(true);
      const unsubs = [subscribeResponses(setResponses, onErr), subscribePlans(setPlans, onErr)];
      return () => unsubs.forEach((u) => u());
    }
    if (view === "company" && email) {
      setReady(false);
      const unsubs = [
        subscribeResponsesByEmail(
          email,
          (mine, fromCache) => {
            // 서버에서 확인되기 전 값으로 화면을 열면 임시저장분을 0 으로 덮을 수 있다.
            if (fromCache && !Object.keys(mine).length) return;
            setResponses((p) => ({ ...p, ...mine }));
            setReady(true);
          },
          onErr
        ),
        subscribePlan(email, (p) => setPlans((prev) => ({ ...prev, [email]: p || {} })), onErr),
      ];
      // 응답이 하나도 없는 업체는 위 콜백이 계속 걸릴 수 있으니 짧게 풀어준다.
      const t = setTimeout(() => setReady(true), 2500);
      return () => {
        clearTimeout(t);
        unsubs.forEach((u) => u());
      };
    }
    setReady(false);
    return undefined;
  }, [view, email, onErr]);

  const data = useMemo(
    () => ({ config: config || {}, projects, responses, plans }),
    [config, projects, responses, plans]
  );

  const myProjects = useMemo(
    () =>
      projects
        .filter((p) => p.email === email)
        .sort((a, b) => (a.year || 0) - (b.year || 0) || String(a.name).localeCompare(String(b.name))),
    [projects, email]
  );

  const startSetup = async ({ title, pw, deadline }) => {
    await saveConfig({ title, deadline, adminPwHash: await hashPw(pw) });
    setView("admin");
  };

  const shell = (child) => (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink, fontFamily: SANS }}>
      {netErr && (
        <div style={{ background: C.redSoft, borderBottom: `1px solid ${C.red}`, color: C.red, padding: "10px 16px", fontSize: 13, textAlign: "center" }}>
          {netErr}
        </div>
      )}
      {child}
    </div>
  );

  const spinner = (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.ink2, fontSize: 13 }}>
      불러오는 중…
    </div>
  );

  if (loading || !config)
    return (
      <div
        style={{
          background: C.paper,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SANS,
          color: netErr ? C.red : C.ink2,
          fontSize: 13,
          padding: 20,
          textAlign: "center",
        }}
      >
        {netErr || "불러오는 중…"}
      </div>
    );

  if (!data.config.adminPwHash) return shell(<Setup onDone={startSetup} />);

  if (view === "admin") return shell(<Admin data={data} onExit={() => setView("gate")} />);

  if (view === "company" && email) {
    if (!ready) return shell(spinner);

    if (project) {
      const live = myProjects.find((p) => p.id === project.id) || project;
      return shell(
        <ProjectSheet
          key={live.id}
          project={live}
          response={responses[live.id]}
          deadline={data.config.deadline}
          onSave={(patch) => saveResponse(live.id, email, patch)}
          onBack={() => setProject(null)}
        />
      );
    }

    return shell(
      <Hub
        email={email}
        projects={myProjects}
        responses={responses}
        plan={plans[email]}
        config={data.config}
        onOpen={setProject}
        onSavePlan={(patch) => savePlan(email, patch)}
        onExit={() => {
          setEmail("");
          setProject(null);
          setView("gate");
        }}
      />
    );
  }

  return shell(
    <Gate
      config={data.config}
      projects={projects}
      onEnter={(e) => {
        setEmail(e);
        setView("company");
      }}
      onAdmin={() => setView("admin")}
    />
  );
}
