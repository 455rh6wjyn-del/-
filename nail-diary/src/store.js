import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Firestore 구조 (naildiary 프로젝트)
 *   nailDiaryProducts/{id}                 제품 (브랜드·모델번호·카테고리·색상·잔여량 등)
 *   nailDiaryProducts/{id}/comments/{id}   제품별 댓글 (author, text, createdAt)
 *   nailDiaryCategories/{id}               카테고리 이름 목록 (자동완성용)
 *   nailDiaryTips/{id}                     꿀팁 메모 (author, text, photoUrl, createdAt)
 *   nailDiaryConfig/schedule                다음 네일 일정 { date, note }
 *
 * Storage 는 안 쓴다. 꿀팁 사진도 아이템 이미지처럼 인터넷 주소를 붙여넣는
 * 방식이다 (Firebase Storage 는 Blaze 요금제가 있어야 켤 수 있어서 뺐다).
 */
const productsCol = collection(db, "nailDiaryProducts");
const categoriesCol = collection(db, "nailDiaryCategories");
const tipsCol = collection(db, "nailDiaryTips");
const scheduleRef = doc(db, "nailDiaryConfig", "schedule");

/* ── 제품 ───────────────────────────────────────────────── */

export function subscribeProducts(next, onError) {
  return onSnapshot(
    query(productsCol, orderBy("createdAt", "desc")),
    (snap) => next(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function createProduct(data) {
  return addDoc(productsCol, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateProduct(id, patch) {
  return updateDoc(doc(productsCol, id), { ...patch, updatedAt: serverTimestamp() });
}

export function deleteProduct(id) {
  return deleteDoc(doc(productsCol, id));
}

/* ── 제품별 댓글 ────────────────────────────────────────── */

export function subscribeComments(productId, next, onError) {
  const col = collection(db, "nailDiaryProducts", productId, "comments");
  return onSnapshot(
    query(col, orderBy("createdAt", "asc")),
    (snap) => next(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function addComment(productId, { author, text }) {
  const col = collection(db, "nailDiaryProducts", productId, "comments");
  return addDoc(col, { author, text, createdAt: serverTimestamp() });
}

export function deleteComment(productId, commentId) {
  return deleteDoc(doc(db, "nailDiaryProducts", productId, "comments", commentId));
}

/* ── 카테고리 (자동완성 목록) ───────────────────────────── */

export function subscribeCategories(next, onError) {
  return onSnapshot(
    query(categoriesCol, orderBy("name", "asc")),
    (snap) => next(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function addCategory(name) {
  return addDoc(categoriesCol, { name, createdAt: serverTimestamp() });
}

export function deleteCategory(id) {
  return deleteDoc(doc(categoriesCol, id));
}

/* ── 꿀팁 메모 ──────────────────────────────────────────── */

export function subscribeTips(next, onError) {
  return onSnapshot(
    query(tipsCol, orderBy("createdAt", "desc")),
    (snap) => next(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function addTip({ author, text, photoUrl }) {
  return addDoc(tipsCol, { author, text, photoUrl: photoUrl || null, createdAt: serverTimestamp() });
}

export function deleteTip(id) {
  return deleteDoc(doc(tipsCol, id));
}

/* ── 다음 네일 일정 ─────────────────────────────────────── */

export function subscribeSchedule(next, onError) {
  return onSnapshot(
    scheduleRef,
    (snap) => next(snap.exists() ? snap.data() : null),
    onError
  );
}

export function saveSchedule(patch) {
  return setDoc(scheduleRef, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
