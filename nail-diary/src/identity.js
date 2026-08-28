const KEY = "nailDiary:identity";

/** 미리 준비한 두 자매 프로필. 필요하면 "직접 입력"으로 다른 이름도 쓸 수 있다. */
export const PRESET_PROFILES = [
  { name: "언니", color: "#E88CA6" },
  { name: "동생", color: "#9B8CE8" },
];

export function loadIdentity() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveIdentity(identity) {
  localStorage.setItem(KEY, JSON.stringify(identity));
}

export function clearIdentity() {
  localStorage.removeItem(KEY);
}

export function colorForName(name) {
  const preset = PRESET_PROFILES.find((p) => p.name === name);
  if (preset) return preset.color;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${hash}, 60%, 72%)`;
}
