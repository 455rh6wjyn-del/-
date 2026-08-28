import { useState } from "react";
import { addTip, deleteTip } from "../store";

function formatDate(ts) {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export default function Tips({ identity, tips }) {
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await addTip({ author: identity.name, text: trimmed, photoUrl: photoUrl.trim() || null });
      setText("");
      setPhotoUrl("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tips">
      <form className="card tip-form" onSubmit={submit}>
        <div className="card-title">꿀팁 남기기</div>
        <textarea
          rows={3}
          placeholder="예: 글리터는 탑코트 두껍게 발라야 안 일어나요"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          placeholder="사진 주소 (선택, https://...)"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
        />
        {photoUrl && (
          <div className="tip-form-row">
            <img className="tip-file-preview" src={photoUrl} alt="미리보기" />
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "등록 중..." : "등록"}
        </button>
      </form>

      <div className="tip-list">
        {tips.map((t) => (
          <article key={t.id} className="card tip-card">
            <div className="tip-header">
              <span className="tip-author">{t.author}</span>
              <span className="tip-date">{formatDate(t.createdAt)}</span>
              {t.author === identity.name && (
                <button type="button" className="comment-delete" onClick={() => deleteTip(t.id)}>
                  삭제
                </button>
              )}
            </div>
            {t.photoUrl && <img className="tip-photo" src={t.photoUrl} alt="" />}
            <p className="tip-text">{t.text}</p>
          </article>
        ))}
        {tips.length === 0 && <p className="hint">아직 남긴 꿀팁이 없어요.</p>}
      </div>
    </div>
  );
}
