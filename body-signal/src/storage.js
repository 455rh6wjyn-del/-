/**
 * localStorage 래퍼.
 * 원래 코드가 쓰던 window.storage 와 같은 모양(get → { value }, set)을 유지해서
 * 앱 쪽 호출부를 그대로 둘 수 있게 했다.
 *
 * 사파리 프라이빗 모드처럼 localStorage 가 막힌 환경에서도 던지지 않고,
 * 메모리에만 담아 그 세션 동안은 정상 동작하게 한다.
 */
const memory = new Map();

let available = null;
const canUse = () => {
  if (available !== null) return available;
  try {
    const probe = "__bs_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
};

export const storage = {
  async get(key) {
    if (canUse()) {
      const value = window.localStorage.getItem(key);
      if (value !== null) return { value };
    }
    return memory.has(key) ? { value: memory.get(key) } : null;
  },

  async set(key, value) {
    memory.set(key, value);
    if (!canUse()) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // 용량 초과(QuotaExceededError) 등. 호출부가 사용자에게 알릴 수 있도록 올린다.
      throw e;
    }
  },

  async remove(key) {
    memory.delete(key);
    if (canUse()) window.localStorage.removeItem(key);
  },
};

export default storage;
