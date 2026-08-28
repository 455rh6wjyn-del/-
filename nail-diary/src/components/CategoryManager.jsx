import { useState } from "react";
import { addCategory, deleteCategory } from "../store";

export default function CategoryManager({ categories, products, onClose }) {
  const [name, setName] = useState("");

  const countFor = (categoryName) =>
    products.filter((p) => (p.categories || []).includes(categoryName)).length;

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || categories.some((c) => c.name === trimmed)) return;
    await addCategory(trimmed);
    setName("");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>카테고리 관리</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="detail-body">
          <p className="hint">
            색상(빨강), 재질(글리터), 종류(파츠) 등 원하는 대로 만들면 돼요. 아이템 하나에 여러
            카테고리를 같이 붙일 수 있어요.
          </p>
          <form className="chip-add" onSubmit={submit}>
            <input
              placeholder="새 카테고리 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              추가
            </button>
          </form>
          <ul className="category-manage-list">
            {categories.map((c) => (
              <li key={c.id}>
                <span>{c.name}</span>
                <span className="hint">{countFor(c.name)}개 아이템</span>
                <button type="button" className="comment-delete" onClick={() => deleteCategory(c.id)}>
                  삭제
                </button>
              </li>
            ))}
            {categories.length === 0 && <li className="comment-empty">아직 카테고리가 없어요</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
