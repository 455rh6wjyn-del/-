import { useEffect, useState } from "react";
import { loadIdentity } from "./identity";
import {
  subscribeCategories,
  subscribeProducts,
  subscribeSchedule,
  subscribeTips,
} from "./store";
import IdentityGate from "./components/IdentityGate.jsx";
import Home from "./components/Home.jsx";
import Inventory from "./components/Inventory.jsx";
import Tips from "./components/Tips.jsx";

const TABS = [
  { key: "home", label: "홈", icon: "🏠" },
  { key: "inventory", label: "재고", icon: "💅" },
  { key: "tips", label: "꿀팁", icon: "📝" },
];

export default function App() {
  const [identity, setIdentity] = useState(() => loadIdentity());
  const [tab, setTab] = useState("home");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tips, setTips] = useState([]);
  const [schedule, setSchedule] = useState(null);

  useEffect(() => {
    if (!identity) return undefined;
    const unsubs = [
      subscribeProducts(setProducts, console.error),
      subscribeCategories(setCategories, console.error),
      subscribeTips(setTips, console.error),
      subscribeSchedule(setSchedule, console.error),
    ];
    return () => unsubs.forEach((u) => u());
  }, [identity]);

  if (!identity) {
    return <IdentityGate onDone={setIdentity} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">
          <span className="topbar-emoji">💅</span>
          <div>
            <h1>다정한 자매의 네일다이어리</h1>
            <p>재료 재고 · 색상 · 사용 팁을 함께 기록해요</p>
          </div>
        </div>
        <button
          type="button"
          className="whoami"
          style={{ background: identity.color }}
          onClick={() => setIdentity(null)}
          title="다른 사람으로 전환"
        >
          {identity.name}
        </button>
      </header>

      <main className="content">
        {tab === "home" && (
          <Home
            identity={identity}
            products={products}
            schedule={schedule}
            onGoInventory={() => setTab("inventory")}
          />
        )}
        {tab === "inventory" && (
          <Inventory identity={identity} products={products} categories={categories} />
        )}
        {tab === "tips" && <Tips identity={identity} tips={tips} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tabbar-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span className="tabbar-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
