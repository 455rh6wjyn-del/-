import { useEffect, useState } from "react";
import {
  addComment,
  deleteComment,
  deleteProduct,
  subscribeComments,
  updateProduct,
} from "../store";

function timeAgo(ts) {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function ProductDetail({ identity, product, onEdit, onClose }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    return subscribeComments(product.id, setComments, console.error);
  }, [product.id]);

  const adjustAmount = (delta) => {
    const next = Math.max(0, Math.min(100, (product.amountPercent ?? 0) + delta));
    updateProduct(product.id, { amountPercent: next });
  };

  const adjustCount = (delta) => {
    const next = Math.max(0, (product.count ?? 0) + delta);
    updateProduct(product.id, { count: next });
  };

  const submitComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    await addComment(product.id, { author: identity.name, text });
    setCommentText("");
  };

  const remove = async () => {
    if (!confirm("이 아이템을 삭제할까요?")) return;
    await deleteProduct(product.id);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {product.brand} · {product.name}
          </h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="detail-body">
          <div className="detail-thumb" style={{ background: product.colorHex || "#f3e6ea" }}>
            {product.imageUrl && <img src={product.imageUrl} alt={product.name} />}
          </div>

          <div className="detail-meta">
            {product.modelNo && <div className="detail-model">모델번호 #{product.modelNo}</div>}
            <div className="chip-list">
              {(product.categories || []).map((c) => (
                <span key={c} className="tag">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="detail-amount">
            {product.trackingType === "count" ? (
              <div className="stepper">
                <button type="button" onClick={() => adjustCount(-1)}>
                  −
                </button>
                <span>{product.count ?? 0}개</span>
                <button type="button" onClick={() => adjustCount(1)}>
                  +
                </button>
              </div>
            ) : (
              <div>
                <div className="amount-bar">
                  <div
                    className="amount-bar-fill"
                    style={{ width: `${product.amountPercent ?? 0}%` }}
                  />
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => adjustAmount(-10)}>
                    −10%
                  </button>
                  <span>{product.amountPercent ?? 0}%</span>
                  <button type="button" onClick={() => adjustAmount(10)}>
                    +10%
                  </button>
                </div>
              </div>
            )}
          </div>

          {product.tip && (
            <div className="detail-tip">
              <div className="card-title">사용 팁</div>
              <p>{product.tip}</p>
            </div>
          )}

          <div className="detail-actions">
            <button type="button" className="btn-soft" onClick={() => onEdit(product)}>
              수정
            </button>
            <button type="button" className="btn-danger" onClick={remove}>
              삭제
            </button>
          </div>

          <div className="comments">
            <div className="card-title">댓글</div>
            <ul className="comment-list">
              {comments.map((c) => (
                <li key={c.id} className="comment">
                  <span className="comment-author">{c.author}</span>
                  <span className="comment-text">{c.text}</span>
                  <span className="comment-time">{timeAgo(c.createdAt)}</span>
                  {c.author === identity.name && (
                    <button
                      type="button"
                      className="comment-delete"
                      onClick={() => deleteComment(product.id, c.id)}
                    >
                      삭제
                    </button>
                  )}
                </li>
              ))}
              {comments.length === 0 && <li className="comment-empty">아직 댓글이 없어요</li>}
            </ul>
            <form className="comment-form" onSubmit={submitComment}>
              <input
                placeholder={`${identity.name}(으)로 댓글 남기기`}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button type="submit" className="btn-primary">
                등록
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
