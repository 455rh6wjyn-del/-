import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  clearResponses,
  hashPw,
  saveCompanies,
  saveConfig,
  saveResponse,
  subscribeCompanies,
  subscribeConfig,
  subscribeResponse,
  subscribeResponses,
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

const MONTHS = [8, 9, 10, 11, 12];
const MKEY = (m) => `m${m}`;

/* ── 유틸 ───────────────────────────────────────────────────── */
const digits = (s) => String(s ?? "").replace(/[^0-9]/g, "");
const won = (n) => (Number(n) || 0).toLocaleString("ko-KR");
const bizFmt = (b) => {
  const d = digits(b);
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const isPast = (iso) => {
  if (!iso) return false;
  const end = new Date(iso + "T23:59:59");
  return Date.now() > end.getTime();
};
const dday = (iso) => {
  if (!iso) return null;
  const a = new Date(iso + "T23:59:59").getTime();
  return Math.ceil((a - Date.now()) / 86400000);
};
const stamp = (t) =>
  t ? new Date(t).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";

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

/* ── 서명 요소: 대차 레일 ───────────────────────────────────── */
function BalanceRail({ recommend, prev, months, diff }) {
  const used = prev + MONTHS.reduce((s, m) => s + (months[MKEY(m)] || 0), 0);
  const scale = Math.max(recommend, used) || 1;
  const pct = (v) => `${(v / scale) * 100}%`;
  const balanced = diff === 0 && recommend > 0;
  const over = diff < 0;

  const tints = ["#8FA894", "#7E9C86", "#6D9078", "#5C846A", "#4B785C"];

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
            width: pct(prev),
            background: `repeating-linear-gradient(45deg, ${C.ink2}, ${C.ink2} 3px, #6E7970 3px, #6E7970 6px)`,
            transition: "width 260ms ease",
          }}
          title={`기인출액 ${won(prev)}원`}
        />
        {MONTHS.map((m, i) => (
          <div
            key={m}
            style={{
              width: pct(months[MKEY(m)] || 0),
              background: tints[i],
              borderLeft: (months[MKEY(m)] || 0) > 0 ? `1px solid ${C.paper}` : "none",
              transition: "width 260ms ease",
            }}
            title={`${m}월 ${won(months[MKEY(m)] || 0)}원`}
          />
        ))}
        {over && (
          <div
            style={{
              width: pct(-diff),
              background: `repeating-linear-gradient(45deg, ${C.red}, ${C.red} 4px, #B5462F 4px, #B5462F 8px)`,
              transition: "width 260ms ease",
            }}
            title={`초과 ${won(-diff)}원`}
          />
        )}
        {recommend > 0 && used > recommend && (
          <div
            style={{
              position: "absolute",
              left: pct(recommend),
              top: 0,
              bottom: 0,
              width: 2,
              background: C.ink,
            }}
          />
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
          배분 {won(used)} / 추천 {won(recommend)}원
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
            ? `미배분 ${won(diff)}원`
            : `초과 ${won(-diff)}원`}
        </div>
      </div>
    </div>
  );
}

/* ── 금액 입력 ──────────────────────────────────────────────── */
function MoneyInput({ value, onChange, disabled, invalid }) {
  return (
    <input
      inputMode="numeric"
      disabled={disabled}
      value={value ? won(value) : ""}
      placeholder="0"
      onChange={(e) => onChange(Number(digits(e.target.value) || 0))}
      style={{
        width: "100%",
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

/* ── 업체 입력 화면 ─────────────────────────────────────────── */
function CompanySheet({ company, response, deadline, onSave, onExit }) {
  const closed = isPast(deadline);
  const [months, setMonths] = useState(() => {
    const o = {};
    MONTHS.forEach((m) => (o[MKEY(m)] = response?.[MKEY(m)] || 0));
    return o;
  });
  const [manager, setManager] = useState(response?.manager || "");
  const [phone, setPhone] = useState(response?.phone || "");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(response?.status === "submitted" ? "done" : "edit");

  const sum = MONTHS.reduce((s, m) => s + (months[MKEY(m)] || 0), 0);
  const diff = company.recommend - company.prevDrawn - sum;
  const balanced = diff === 0;
  const missing = !manager.trim() || !phone.trim();
  const canSubmit = balanced && !missing && !closed && !busy;

  const flash = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 2600);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await onSave({ ...months, manager: manager.trim(), phone: phone.trim(), status: "submitted" });
      setMode("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      flash("저장하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };
  const draft = async () => {
    setBusy(true);
    try {
      await onSave({ ...months, manager: manager.trim(), phone: phone.trim(), status: "draft" });
      flash("임시저장했습니다.");
    } catch {
      flash("저장하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  /* ── 제출완료 확인서 ── */
  if (mode === "done") {
    const line = (k, v, opts = {}) => (
      <div
        key={k}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "9px 0",
          borderTop: opts.double ? `3px double ${C.ink}` : `1px solid ${C.rule}`,
        }}
      >
        <span style={{ fontSize: 13, color: opts.strong ? C.ink : C.ink2, fontWeight: opts.strong ? 700 : 400 }}>{k}</span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: opts.strong ? 16 : 14,
            fontWeight: opts.strong ? 700 : 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {v}
        </span>
      </div>
    );

    return (
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "34px 20px 70px" }}>
        <div style={{ border: `1px solid ${C.rule}`, background: C.card, borderRadius: 2, padding: "30px 26px 26px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.ink2 }}>자금수요조사</div>
              <div style={{ fontSize: 25, fontWeight: 700, margin: "6px 0 0", letterSpacing: "-0.02em" }}>
                제출이 완료되었습니다
              </div>
              <div style={{ fontSize: 13, color: C.ink2, marginTop: 8 }}>
                {company.name} · {bizFmt(company.bizNo)}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: C.ink2, marginTop: 3 }}>
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

          <div style={{ marginTop: 24 }}>
            {line("기인출액", `${won(company.prevDrawn)}원`)}
            {MONTHS.map((m) => line(`${m}월 인출계획`, `${won(months[MKEY(m)] || 0)}원`))}
            {line("8~12월 합계", `${won(sum)}원`, { strong: true, double: true })}
            {line("올해 추천액", `${won(company.recommend)}원`)}
          </div>

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
            기인출액 + 8~12월 합계 = 올해 추천액 · 대차 일치
          </div>

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
          <Btn kind="solid" onClick={onExit}>
            나가기
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

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 140px" }}>
      {/* 원장 머리 */}
      <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.ink2 }}>자금수요조사</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{company.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.ink2, marginTop: 3 }}>
              {bizFmt(company.bizNo)}
            </div>
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

      {/* 고정값 */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.rule}`, marginBottom: 26 }}>
        {[
          ["올해 추천액", company.recommend],
          ["기인출액", company.prevDrawn],
          ["잔여 인출가능액", company.recommend - company.prevDrawn],
        ].map(([k, v], i) => (
          <div key={k} style={{ flex: 1, padding: "14px 0", borderLeft: i ? `1px solid ${C.rule}` : "none", paddingLeft: i ? 16 : 0 }}>
            <div style={{ fontSize: 11, color: C.ink2, letterSpacing: "0.06em" }}>{k}</div>
            <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, fontVariantNumeric: "tabular-nums", marginTop: 5 }}>
              {won(v)}
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

      <Label>월별 인출 계획 (원)</Label>
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
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", paddingRight: 12 }}>
            {won(sum)}
          </div>
        </div>
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

      {/* 하단 고정 레일 */}
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
          <BalanceRail recommend={company.recommend} prev={company.prevDrawn} months={months} diff={diff} />
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Btn kind="ghost" onClick={draft} disabled={closed || busy} small>
              임시저장
            </Btn>
            <Btn kind="seal" onClick={submit} disabled={!canSubmit}>
              {response?.status === "submitted" ? "수정 내용 제출" : "제출하기"}
            </Btn>
            <div style={{ fontSize: 12, color: C.ink2 }}>
              {closed
                ? "마감됨"
                : busy
                ? "저장 중…"
                : !balanced
                ? "합계가 추천액과 일치해야 제출할 수 있습니다"
                : missing
                ? "담당자명과 연락처를 입력해 주세요"
                : "제출할 수 있습니다"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 관리자 ─────────────────────────────────────────────────── */
function Admin({ data, onExit }) {
  const [tab, setTab] = useState("현황");
  const [note, setNote] = useState("");
  const fileRef = useRef(null);
  const flash = (t) => {
    setNote(t);
    setTimeout(() => setNote(""), 3000);
  };

  const rows = useMemo(
    () =>
      data.companies.map((c) => {
        const r = data.responses[c.bizNo] || {};
        const sum = MONTHS.reduce((s, m) => s + (r[MKEY(m)] || 0), 0);
        return { ...c, r, sum, status: r.status || "none" };
      }),
    [data]
  );
  const done = rows.filter((r) => r.status === "submitted").length;
  const drafting = rows.filter((r) => r.status === "draft").length;
  const d = dday(data.config.deadline);

  // xlsx 는 700KB 가 넘는다. 관리자가 실제로 누를 때만 받아온다.
  const loadXLSX = () => import("xlsx");

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
      ["사업자번호", "업체명", "올해 추천액", "기인출액"],
      ["1234567890", "(예시) 가나다산업", 1000000000, 400000000],
    ]);
    ws["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "업체명단");
    XLSX.writeFile(wb, "자금수요조사_업체명단_양식.xlsx");
  };

  const downloadResults = async () => {
    const XLSX = await loadXLSX();
    const out = rows.map((x) => ({
      사업자번호: bizFmt(x.bizNo),
      업체명: x.name,
      "올해 추천액": x.recommend,
      기인출액: x.prevDrawn,
      "8월": x.r.m8 || 0,
      "9월": x.r.m9 || 0,
      "10월": x.r.m10 || 0,
      "11월": x.r.m11 || 0,
      "12월": x.r.m12 || 0,
      "8~12월 합계": x.sum,
      "검증(기인출+합계-추천)": x.prevDrawn + x.sum - x.recommend,
      담당자: x.r.manager || "",
      연락처: x.r.phone || "",
      상태: x.status === "submitted" ? "제출완료" : x.status === "draft" ? "임시저장" : "미입력",
      최종수정: stamp(x.r.updatedAt),
    }));
    const ws = XLSX.utils.json_to_sheet(out);
    ws["!cols"] = Object.keys(out[0] || { a: 1 }).map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "자금수요조사 결과");
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
          const kk = k.replace(/\s/g, "");
          if (keys.some((t) => kk.includes(t))) return o[k];
        }
        return undefined;
      };
      const list = json
        .map((o) => ({
          bizNo: digits(pick(o, ["사업자"])),
          name: String(pick(o, ["업체", "기업", "회사"]) ?? "").trim(),
          recommend: Number(digits(pick(o, ["추천"]))) || 0,
          prevDrawn: Number(digits(pick(o, ["기인출", "인출액"]))) || 0,
        }))
        .filter((x) => x.bizNo.length === 10 && x.name);
      if (!list.length) {
        flash("읽을 수 있는 행이 없습니다. 머리글이 사업자번호 / 업체명 / 올해 추천액 / 기인출액 인지 확인해 주세요.");
        return;
      }
      await saveCompanies(list);
      if (fileRef.current) fileRef.current.value = "";
      flash(`${list.length}개사를 등록했습니다.`);
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
    if (!window.confirm("업체가 입력한 인출계획을 모두 지웁니다. 되돌릴 수 없습니다. 진행할까요?")) return;
    try {
      const n = await clearResponses();
      flash(`입력값 ${n}건을 지웠습니다.`);
    } catch {
      flash("삭제에 실패했습니다. 네트워크를 확인해 주세요.");
    }
  };

  const Stat = ({ k, v, tone }) => (
    <div style={{ flex: 1, minWidth: 110, padding: "14px 16px", background: C.card, border: `1px solid ${C.rule}`, borderRadius: 2 }}>
      <div style={{ fontSize: 11, color: C.ink2, letterSpacing: "0.06em" }}>{k}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, marginTop: 4, color: tone || C.ink, fontVariantNumeric: "tabular-nums" }}>
        {v}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 20px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${C.ink}`, paddingBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>관리자</div>
        <button type="button" onClick={onExit} style={{ background: "none", border: "none", color: C.ink2, fontSize: 12, cursor: "pointer", fontFamily: SANS }}>
          나가기
        </button>
      </div>

      <div style={{ display: "flex", gap: 20, margin: "16px 0 22px" }}>
        {["현황", "업체명단", "설정"].map((t) => (
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <Stat k="대상" v={`${rows.length}개사`} />
            <Stat k="제출완료" v={`${done}개사`} tone={C.seal} />
            <Stat k="임시저장" v={`${drafting}개사`} />
            <Stat k="미입력" v={`${rows.length - done - drafting}개사`} tone={C.red} />
            <Stat k="마감" v={d === null ? "미설정" : d >= 0 ? `D-${d}` : "마감됨"} tone={d !== null && d < 0 ? C.red : C.ink} />
          </div>

          <div style={{ height: 8, background: C.bar, border: `1px solid ${C.rule}`, borderRadius: 2, overflow: "hidden", marginBottom: 18 }}>
            <div style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%`, height: "100%", background: C.seal, transition: "width 300ms" }} />
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <Btn kind="ghost" small onClick={downloadResults} disabled={!rows.length}>
              결과 엑셀 내려받기
            </Btn>
            <div style={{ fontSize: 12, color: C.ink2, alignSelf: "center" }}>업체가 제출하면 실시간으로 갱신됩니다</div>
          </div>

          <div style={{ overflowX: "auto", border: `1px solid ${C.rule}`, borderRadius: 2 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ background: C.ink, color: C.paper }}>
                  {["업체명", "사업자번호", "추천액", "기인출액", "8월", "9월", "10월", "11월", "12월", "합계", "상태", "담당자", "최종수정"].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: h === "업체명" || h === "상태" || h === "담당자" ? "left" : "right", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x, i) => (
                  <tr key={x.bizNo} style={{ background: i % 2 ? C.bar : C.card }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{x.name}</td>
                    <td style={{ padding: "8px 10px", fontFamily: MONO, textAlign: "right", color: C.ink2 }}>{bizFmt(x.bizNo)}</td>
                    {[x.recommend, x.prevDrawn, x.r.m8 || 0, x.r.m9 || 0, x.r.m10 || 0, x.r.m11 || 0, x.r.m12 || 0, x.sum].map((v, j) => (
                      <td key={j} style={{ padding: "8px 10px", fontFamily: MONO, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: j === 7 ? 700 : 400 }}>
                        {won(v)}
                      </td>
                    ))}
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 2,
                          whiteSpace: "nowrap",
                          background: x.status === "submitted" ? C.sealSoft : x.status === "draft" ? C.bar : C.redSoft,
                          color: x.status === "submitted" ? C.seal : x.status === "draft" ? C.ink2 : C.red,
                          border: `1px solid ${x.status === "submitted" ? C.seal : x.status === "draft" ? C.rule : C.red}`,
                        }}
                      >
                        {x.status === "submitted" ? "제출완료" : x.status === "draft" ? "임시저장" : "미입력"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {x.r.manager ? `${x.r.manager} · ${x.r.phone || ""}` : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: C.ink2, whiteSpace: "nowrap" }}>{stamp(x.r.updatedAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={13} style={{ padding: "34px 12px", textAlign: "center", color: C.ink2, background: C.card }}>
                      업체명단 탭에서 명단을 올리면 여기에 현황이 나옵니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "업체명단" && (
        <div style={{ maxWidth: 620 }}>
          <Label>1. 입력 양식 내려받기</Label>
          <p style={{ fontSize: 13, color: C.ink2, margin: "0 0 12px" }}>
            사업자번호 · 업체명 · 올해 추천액 · 기인출액 네 칸짜리 엑셀입니다. 금액은 원 단위로 적어 주세요.
          </p>
          <Btn kind="ghost" small onClick={downloadTemplate}>
            양식 내려받기
          </Btn>

          <div style={{ height: 1, background: C.rule, margin: "26px 0" }} />

          <Label>2. 채운 양식 올리기</Label>
          <p style={{ fontSize: 13, color: C.ink2, margin: "0 0 12px" }}>
            올리면 기존 명단을 새 명단으로 바꿉니다. 이미 들어온 업체 입력값은 사업자번호 기준으로 유지됩니다.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            style={{ fontSize: 13, fontFamily: SANS }}
          />
          <div style={{ marginTop: 14, fontSize: 13, color: C.ink2 }}>
            현재 등록: <b style={{ color: C.ink }}>{data.companies.length}개사</b>
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
            업체가 입력한 인출계획을 모두 지웁니다. 업체명단은 남습니다. 되돌릴 수 없습니다.
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
function Gate({ data, onEnter, onAdmin }) {
  const [biz, setBiz] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("company");
  const [err, setErr] = useState("");
  const d = dday(data.config.deadline);

  const tryEnter = () => {
    const b = digits(biz);
    if (b.length !== 10) return setErr("사업자번호 10자리를 입력해 주세요.");
    const hit = data.companies.find((c) => c.bizNo === b);
    if (!hit) return setErr("조사 대상 명단에 없는 사업자번호입니다. 사업 담당자에게 문의해 주세요.");
    setErr("");
    onEnter(hit);
  };
  const tryAdmin = async () => {
    if (!data.config.adminPwHash) return setErr("관리자 비밀번호가 아직 설정되지 않았습니다.");
    // 설정할 때 trim 한 값으로 저장하므로 확인할 때도 똑같이 잘라낸다.
    if ((await hashPw(pw.trim())) !== data.config.adminPwHash)
      return setErr("비밀번호가 맞지 않습니다. 한/영 상태를 확인해 주세요.");
    setErr("");
    onAdmin();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 12, marginBottom: 22 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.16em", color: C.ink2 }}>
            {data.config.title || "융자지원 사업"}
          </div>
          <h1 style={{ fontSize: 27, fontWeight: 700, margin: "6px 0 0", letterSpacing: "-0.02em" }}>
            자금수요조사
          </h1>
          <p style={{ fontSize: 13, color: C.ink2, margin: "8px 0 0", lineHeight: 1.6 }}>
            8월부터 12월까지 월별 인출 계획을 제출합니다.
            {data.config.deadline && (
              <>
                {" "}
                마감 {data.config.deadline}
                {d !== null && d >= 0 ? ` (D-${d})` : " (마감됨)"}.
              </>
            )}
          </p>
        </div>

        {mode === "company" ? (
          <>
            <Label>사업자번호</Label>
            <TextInput
              value={biz}
              onChange={(v) => setBiz(v)}
              onEnter={tryEnter}
              placeholder="숫자 10자리"
              mono
            />
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
  const [companies, setCompanies] = useState([]);
  const [responses, setResponses] = useState({});
  const [view, setView] = useState("gate");
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [respReady, setRespReady] = useState(false);
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
      subscribeCompanies((list) => setCompanies(list), onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [onErr]);

  /* 관리자는 전체 응답을, 업체는 자기 응답만 구독한다. */
  useEffect(() => {
    if (view === "admin") {
      setRespReady(true);
      return subscribeResponses((all) => setResponses(all), onErr);
    }
    if (view === "company" && company) {
      const biz = company.bizNo;
      setRespReady(false);
      return subscribeResponse(
        biz,
        (r, fromCache) => {
          // 서버에서 확인되기 전의 "응답 없음"으로 화면을 열면
          // 기존 임시저장분을 0 으로 덮어쓸 수 있다.
          if (!r && fromCache) return;
          setResponses((p) => ({ ...p, [biz]: r || {} }));
          setRespReady(true);
        },
        onErr
      );
    }
    setRespReady(false);
    return undefined;
  }, [view, company, onErr]);

  const data = useMemo(
    () => ({ config: config || {}, companies, responses }),
    [config, companies, responses]
  );

  const startSetup = async ({ title, pw, deadline }) => {
    await saveConfig({ title, deadline, adminPwHash: await hashPw(pw) });
    setView("admin");
  };

  if (loading || !config)
    return (
      <div style={{ background: C.paper, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, color: netErr ? C.red : C.ink2, fontSize: 13, padding: 20, textAlign: "center" }}>
        {netErr || "불러오는 중…"}
      </div>
    );

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

  if (!data.config.adminPwHash) return shell(<Setup onDone={startSetup} />);

  if (view === "admin") return shell(<Admin data={data} onExit={() => setView("gate")} />);

  if (view === "company" && company) {
    const live = data.companies.find((c) => c.bizNo === company.bizNo) || company;
    /* 기존 입력값을 다 받기 전에 화면을 그리면 임시저장분이 0으로 덮일 수 있다. */
    if (!respReady)
      return shell(
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.ink2, fontSize: 13 }}>
          불러오는 중…
        </div>
      );
    return shell(
      <CompanySheet
        key={live.bizNo}
        company={live}
        response={data.responses[live.bizNo]}
        deadline={data.config.deadline}
        onSave={(patch) => saveResponse(live.bizNo, patch)}
        onExit={() => {
          setCompany(null);
          setView("gate");
        }}
      />
    );
  }

  return shell(
    <Gate
      data={data}
      onEnter={(c) => {
        setCompany(c);
        setView("company");
      }}
      onAdmin={() => setView("admin")}
    />
  );
}
