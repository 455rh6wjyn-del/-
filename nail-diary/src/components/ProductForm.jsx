import { useState } from "react";
import { addCategory, createProduct, updateProduct } from "../store";
import { extractDominantColor, loadImage } from "../color";

const AMOUNT_PRESETS = [
  { label: "가득참", value: 100 },
  { label: "많음", value: 75 },
  { label: "보통", value: 50 },
  { label: "적음", value: 25 },
  { label: "거의없음", value: 10 },
];

export default function ProductForm({ identity, categories, product, onClose }) {
  const isEdit = Boolean(product);
  const [brand, setBrand] = useState(product?.brand || "");
  const [modelNo, setModelNo] = useState(product?.modelNo || "");
  const [name, setName] = useState(product?.name || "");
  const [selectedCategories, setSelectedCategories] = useState(product?.categories || []);
  const [newCategory, setNewCategory] = useState("");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");
  const [colorHex, setColorHex] = useState(product?.colorHex || "#f3c6d3");
  const [trackingType, setTrackingType] = useState(product?.trackingType || "amount");
  const [amountPercent, setAmountPercent] = useState(product?.amountPercent ?? 100);
  const [count, setCount] = useState(product?.count ?? 1);
  const [tip, setTip] = useState(product?.tip || "");
  const [imageStatus, setImageStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleCategory = (name) => {
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const addNewCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (!selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
    }
    setNewCategory("");
    if (!categories.some((c) => c.name === trimmed)) {
      addCategory(trimmed).catch(console.error);
    }
  };

  const fetchPreview = async () => {
    if (!imageUrl.trim()) return;
    setImageStatus("불러오는 중...");
    try {
      const img = await loadImage(imageUrl.trim());
      setImageStatus("이미지를 불러왔어요");
      try {
        const hex = extractDominantColor(img);
        setColorHex(hex);
        setImageStatus("이미지와 색상을 불러왔어요");
      } catch {
        setImageStatus("이미지는 불러왔지만 색상 자동 추출은 안 돼요. 색상을 직접 골라주세요.");
      }
    } catch {
      setImageStatus("이미지를 불러오지 못했어요. 주소를 확인해주세요.");
    }
  };

  const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
    `${brand} ${modelNo} ${name} 네일 폴리시`.trim()
  )}`;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      brand: brand.trim(),
      modelNo: modelNo.trim(),
      name: name.trim(),
      categories: selectedCategories,
      imageUrl: imageUrl.trim() || null,
      colorHex,
      trackingType,
      amountPercent: trackingType === "amount" ? Number(amountPercent) : null,
      count: trackingType === "count" ? Number(count) : null,
      tip: tip.trim(),
    };
    try {
      if (isEdit) {
        await updateProduct(product.id, payload);
      } else {
        await createProduct({ ...payload, createdBy: identity.name });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "아이템 수정" : "새 아이템 추가"}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="product-form" onSubmit={submit}>
          <div className="form-row">
            <label>브랜드</label>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="예: 홀리카홀리카" />
          </div>
          <div className="form-row">
            <label>모델 번호</label>
            <input value={modelNo} onChange={(e) => setModelNo(e.target.value)} placeholder="예: RD01" />
          </div>
          <div className="form-row">
            <label>제품명 / 색이름</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 체리레드" />
          </div>

          <div className="form-row">
            <label>카테고리</label>
            <div className="chip-list">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${selectedCategories.includes(c.name) ? "chip-active" : ""}`}
                  onClick={() => toggleCategory(c.name)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="chip-add">
              <input
                placeholder="새 카테고리 (예: 글리터, 파츠)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNewCategory();
                  }
                }}
              />
              <button type="button" className="btn-soft" onClick={addNewCategory}>
                추가
              </button>
            </div>
          </div>

          <div className="form-row">
            <label>이미지 주소 (인터넷에서 복사)</label>
            <div className="chip-add">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
              <button type="button" className="btn-soft" onClick={fetchPreview}>
                불러오기
              </button>
            </div>
            <a className="gate-link" href={searchUrl} target="_blank" rel="noreferrer">
              이 제품 이미지 검색하기 ↗
            </a>
            {imageStatus && <p className="hint">{imageStatus}</p>}
            {imageUrl && (
              <div className="image-preview">
                <img src={imageUrl} alt="미리보기" />
              </div>
            )}
          </div>

          <div className="form-row">
            <label>색상</label>
            <div className="color-row">
              <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} />
              <input value={colorHex} onChange={(e) => setColorHex(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <label>수량 관리 방식</label>
            <div className="segmented">
              <button
                type="button"
                className={trackingType === "amount" ? "active" : ""}
                onClick={() => setTrackingType("amount")}
              >
                잔여량 (폴리시)
              </button>
              <button
                type="button"
                className={trackingType === "count" ? "active" : ""}
                onClick={() => setTrackingType("count")}
              >
                개수 (파츠·도구)
              </button>
            </div>
          </div>

          {trackingType === "amount" ? (
            <div className="form-row">
              <label>남은 양: {amountPercent}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={amountPercent}
                onChange={(e) => setAmountPercent(e.target.value)}
              />
              <div className="chip-list">
                {AMOUNT_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className="chip"
                    onClick={() => setAmountPercent(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="form-row">
              <label>개수</label>
              <div className="stepper">
                <button type="button" onClick={() => setCount((c) => Math.max(0, Number(c) - 1))}>
                  −
                </button>
                <input
                  type="number"
                  min="0"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
                <button type="button" onClick={() => setCount((c) => Number(c) + 1)}>
                  +
                </button>
              </div>
            </div>
          )}

          <div className="form-row">
            <label>사용 팁 / 메모</label>
            <textarea
              rows={3}
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="예: 2코트로 발색 예쁨, 지속력 좋음"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-soft" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
