import { useState } from "react";
import { PRESET_PROFILES, colorForName, saveIdentity } from "../identity";

export default function IdentityGate({ onDone }) {
  const [customName, setCustomName] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const pick = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const identity = { name: trimmed, color: colorForName(trimmed) };
    saveIdentity(identity);
    onDone(identity);
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-emoji">💅💗</div>
        <h1>다정한 자매의 네일다이어리</h1>
        <p>누구로 접속할까요? 댓글이랑 꿀팁에 이름이 남아요.</p>

        <div className="gate-presets">
          {PRESET_PROFILES.map((p) => (
            <button
              key={p.name}
              type="button"
              className="gate-preset"
              style={{ background: p.color }}
              onClick={() => pick(p.name)}
            >
              {p.name}
            </button>
          ))}
        </div>

        {!showCustom && (
          <button type="button" className="gate-link" onClick={() => setShowCustom(true)}>
            다른 이름으로 입력할래요
          </button>
        )}

        {showCustom && (
          <form
            className="gate-custom"
            onSubmit={(e) => {
              e.preventDefault();
              pick(customName);
            }}
          >
            <input
              autoFocus
              placeholder="이름을 입력하세요"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <button type="submit">시작하기</button>
          </form>
        )}
      </div>
    </div>
  );
}
