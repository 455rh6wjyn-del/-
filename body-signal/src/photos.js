/**
 * 얼굴 사진 저장소 (IndexedDB).
 *
 * 사진은 localStorage 에 두기엔 너무 크다(문자열 5MB 남짓 제한).
 * 그래서 Blob 그대로 IndexedDB 에 넣고, 화면에는 objectURL 로 붙인다.
 * 키는 날짜 문자열("2026-08-27")이다.
 */
const DB_NAME = "bodysignal";
const DB_VERSION = 1;
const STORE = "photos";

let dbPromise = null;

const openDB = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("이 브라우저는 IndexedDB 를 지원하지 않아요."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("다른 탭에서 사용 중이라 저장소를 열지 못했어요."));
  });
  // 실패한 약속을 캐시해두면 이후 호출이 전부 막히므로 비워준다.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
};

const run = async (mode, fn) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const getPhoto = (key) => run("readonly", (s) => s.get(key));
export const putPhoto = (key, blob) => run("readwrite", (s) => s.put(blob, key));
export const deletePhoto = (key) => run("readwrite", (s) => s.delete(key));
export const listPhotoKeys = () => run("readonly", (s) => s.getAllKeys());
export const clearPhotos = () => run("readwrite", (s) => s.clear());
