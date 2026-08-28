import { useState } from "react";
import { saveSchedule } from "../store";

function dday(iso) {
  if (!iso) return null;
  const diff = new Date(iso + "T00:00:00") - new Date(new Date().toDateString());
  return Math.round(diff / 86400000);
}

function ddayText(n) {
  if (n === null) return "";
  if (n === 0) return "D-day 🎉";
  if (n > 0) return `D-${n}`;
  return `${Math.abs(n)}일 지났어요`;
}

function isLowStock(p) {
  if (p.trackingType === "count") return (p.count ?? 0) <= 2;
  return (p.amountPercent ?? 100) <= 20;
}

export default function Home({ identity, products, schedule, onGoInventory }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(schedule?.date || "");
  const [note, setNote] = useState(schedule?.note || "");

  const n = dday(schedule?.date);
  const lowStock = products.filter(isLowStock);

  const startEdit = () => {
    setDate(schedule?.date || "");
    setNote(schedule?.note || "");
    setEditing(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    await saveSchedule({ date: date || null, note, updatedBy: identity.name });
    setEditing(false);
  };

  return (
    <div className="home">
      <section className="card schedule-card">
        <div className="card-title">다음 네일 일정</div>
        {!editing ? (
          <>
            {schedule?.date ? (
              <>
                <div className="schedule-dday">{ddayText(n)}</div>
                <div className="schedule-date">
                  {schedule.date}
                  {schedule.note ? ` · ${schedule.note}` : ""}
                </div>
              </>
            ) : (
              <div className="schedule-empty">아직 잡힌 일정이 없어요</div>
            )}
            <button type="button" className="btn-soft" onClick={startEdit}>
              {schedule?.date ? "일정 수정" : "일정 등록하기"}
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="schedule-form">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input
              placeholder="메모 (예: OO네일샵 예약)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="form-actions">
              <button type="button" className="btn-soft" onClick={() => setEditing(false)}>
                취소
              </button>
              <button type="submit" className="btn-primary">
                저장
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <div className="card-title">재고 요약</div>
        <div className="home-stats">
          <div className="home-stat">
            <div className="home-stat-num">{products.length}</div>
            <div className="home-stat-label">등록된 아이템</div>
          </div>
          <div className="home-stat">
            <div className="home-stat-num">{lowStock.length}</div>
            <div className="home-stat-label">얼마 안 남음</div>
          </div>
        </div>
        <button type="button" className="btn-soft" onClick={onGoInventory}>
          재고 보러가기
        </button>
      </section>

      {lowStock.length > 0 && (
        <section className="card">
          <div className="card-title">⚠️ 얼마 안 남았어요</div>
          <ul className="low-stock-list">
            {lowStock.map((p) => (
              <li key={p.id}>
                <span className="low-stock-swatch" style={{ background: p.colorHex || "#eee" }} />
                <span className="low-stock-name">
                  {p.brand} {p.name}
                </span>
                <span className="low-stock-amount">
                  {p.trackingType === "count" ? `${p.count ?? 0}개` : `${p.amountPercent ?? 0}%`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
