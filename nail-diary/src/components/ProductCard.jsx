export default function ProductCard({ product, onClick }) {
  const amountLabel =
    product.trackingType === "count"
      ? `${product.count ?? 0}개`
      : `${product.amountPercent ?? 0}%`;

  return (
    <button type="button" className="product-card" onClick={onClick}>
      <div className="product-thumb" style={{ background: product.colorHex || "#f3e6ea" }}>
        {product.imageUrl && (
          <img src={product.imageUrl} alt={product.name} loading="lazy" />
        )}
      </div>
      <div className="product-info">
        <div className="product-brand">{product.brand || "브랜드 미입력"}</div>
        <div className="product-name">{product.name || "이름 없음"}</div>
        {product.modelNo && <div className="product-model">#{product.modelNo}</div>}
        <div className="product-tags">
          {(product.categories || []).slice(0, 3).map((c) => (
            <span key={c} className="tag">
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="product-amount">
        {product.trackingType !== "count" && (
          <div className="amount-bar">
            <div
              className="amount-bar-fill"
              style={{ width: `${product.amountPercent ?? 0}%` }}
            />
          </div>
        )}
        <span>{amountLabel}</span>
      </div>
    </button>
  );
}
