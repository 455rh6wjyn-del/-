import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Firestore 구조
 *   fundSurvey/config              { title, deadline, adminPwHash }
 *   fundSurvey/companies           { list: [{ bizNo, name, recommend, prevDrawn }], updatedAt }
 *   fundSurveyResponses/{사업자번호} { m8..m12, manager, phone, status, updatedAt }
 *
 * 업체 응답을 문서 하나에 몰아넣지 않고 사업자번호별로 쪼갠 이유:
 * 여러 업체가 동시에 제출해도 서로의 입력을 덮어쓰지 않게 하기 위해서다.
 */
const configRef = doc(db, "fundSurvey", "config");
const companiesRef = doc(db, "fundSurvey", "companies");
const responsesCol = collection(db, "fundSurveyResponses");

/**
 * 두 번째 인자로 fromCache 를 넘긴다.
 * 오프라인일 때 Firestore 는 "문서 없음"을 캐시에서 먼저 돌려주는데,
 * 그걸 그대로 믿으면 설정이 이미 있는데도 최초 설정 화면이 뜬다.
 */
export function subscribeConfig(next, onError) {
  return onSnapshot(
    configRef,
    (snap) => next(snap.exists() ? snap.data() : null, snap.metadata.fromCache),
    onError
  );
}

export function saveConfig(patch) {
  return setDoc(configRef, patch, { merge: true });
}

export function subscribeCompanies(next, onError) {
  return onSnapshot(
    companiesRef,
    (snap) => next(snap.exists() ? snap.data().list || [] : []),
    onError
  );
}

export function saveCompanies(list) {
  return setDoc(companiesRef, { list, updatedAt: Date.now() });
}

/** 관리자 화면: 전체 응답 실시간 구독 */
export function subscribeResponses(next, onError) {
  return onSnapshot(
    responsesCol,
    (snap) => {
      const out = {};
      snap.forEach((d) => (out[d.id] = d.data()));
      next(out);
    },
    onError
  );
}

/** 업체 화면: 자기 응답 하나만 구독 */
export function subscribeResponse(bizNo, next, onError) {
  return onSnapshot(
    doc(responsesCol, bizNo),
    (snap) => next(snap.exists() ? snap.data() : null, snap.metadata.fromCache),
    onError
  );
}

export function saveResponse(bizNo, patch) {
  return setDoc(
    doc(responsesCol, bizNo),
    { ...patch, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function clearResponses() {
  const snap = await getDocs(responsesCol);
  const refs = snap.docs.map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return refs.length;
}

/**
 * 관리자 비밀번호는 평문 대신 해시로 저장한다.
 * 브라우저에서만 검증하므로 완전한 인증은 아니다(README 의 보안 주의 참고).
 */
export async function hashPw(text) {
  if (!globalThis.crypto?.subtle) return `plain:${text}`;
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`fundsurvey:${text}`)
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
