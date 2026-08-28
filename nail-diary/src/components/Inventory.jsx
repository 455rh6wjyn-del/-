import { useMemo, useState } from "react";
import ProductCard from "./ProductCard.jsx";
import ProductForm from "./ProductForm.jsx";
import ProductDetail from "./ProductDetail.jsx";
import CategoryManager from "./CategoryManager.jsx";

export default function Inventory({ identity, products, categories }) {
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState([]);
  const [formTarget, setFormTarget] = useState(null); // null | {} (new) | product (edit)
  const [detailProduct, setDetailProduct] = useState(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const toggleCategory = (name) => {
    setActiveCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        [p.brand, p.name, p.modelNo].some((v) => (v || "").toLowerCase().includes(q));
      const matchesCategory =
        activeCategories.length === 0 ||
        activeCategories.every((c) => (p.categories || []).includes(c));
      return matchesSearch && matchesCategory;
    });
  }, [products, search, activeCategories]);

  const liveDetailProduct = detailProduct
    ? products.find((p) => p.id === detailProduct.id) || null
    : null;

  return (
    <div className="inventory">
      <div className="inventory-toolbar">
        <input
          className="search-input"
          placeholder="브랜드·제품명·모델번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="btn-soft" onClick={() => setShowCategoryManager(true)}>
          카테고리 관리
        </button>
      </div>

      <div className="chip-list">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip ${activeCategories.includes(c.name) ? "chip-active" : ""}`}
            onClick={() => toggleCategory(c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="product-grid">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} onClick={() => setDetailProduct(p)} />
        ))}
        {filtered.length === 0 && <p className="hint">조건에 맞는 아이템이 없어요.</p>}
      </div>

      <button type="button" className="fab" onClick={() => setFormTarget({})}>
        +
      </button>

      {formTarget !== null && (
        <ProductForm
          identity={identity}
          categories={categories}
          product={formTarget.id ? formTarget : null}
          onClose={() => setFormTarget(null)}
        />
      )}

      {liveDetailProduct && (
        <ProductDetail
          identity={identity}
          product={liveDetailProduct}
          onEdit={(p) => {
            setDetailProduct(null);
            setFormTarget(p);
          }}
          onClose={() => setDetailProduct(null)}
        />
      )}

      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          products={products}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
    </div>
  );
}
