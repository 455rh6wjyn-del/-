import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Firestore 구조
 *   fundSurvey/config              { title, deadline, adminPwHash }
 *   fundSurvey/projects            { list: [프로젝트...], updatedAt }
 *   fundSurveyResponses/{프로젝트ID} { email, m9..m12, unspent, manager, phone, status, updatedAt }
 *   fundSurveyPlans/{이메일}         { apply, totalCost, loanWanted, updatedAt }
 *
 * 조사 단위는 업체가 아니라 프로젝트다. 한 업체(이메일)가 여러 프로젝트를
 * 지원받을 수 있어서, 응답을 프로젝트별 문서로 나눴다. 동시에 제출해도
 * 서로 덮어쓰지 않고, 업체는 자기 이메일 것만 읽어가면 된다.
 *
 * 내년 신규 신청 계획(fundSurveyPlans)은 프로젝트가 아니라 업체 단위라
 * 이메일을 문서 ID 로 쓴다.
 */
const configRef = doc(db, "fundSurvey", "config");
const projectsRef = doc(db, "fundSurvey", "projects");
const responsesCol = collection(db, "fundSurveyResponses");
const plansCol = collection(db, "fundSurveyPlans");

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

export function subscribeProjects(next, onError) {
  return onSnapshot(
    projectsRef,
    (snap) => next(snap.exists() ? snap.data().list || [] : []),
    onError
  );
}

export function saveProjects(list) {
  return setDoc(projectsRef, { list, updatedAt: Date.now() });
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

/** 업체 화면: 자기 이메일로 등록된 프로젝트의 응답만 구독 */
export function subscribeResponsesByEmail(email, next, onError) {
  return onSnapshot(
    query(responsesCol, where("email", "==", email)),
    (snap) => {
      const out = {};
      snap.forEach((d) => (out[d.id] = d.data()));
      next(out, snap.metadata.fromCache);
    },
    onError
  );
}

export function saveResponse(projectId, email, patch) {
  return setDoc(
    doc(responsesCol, projectId),
    { ...patch, email, updatedAt: Date.now() },
    { merge: true }
  );
}

export function subscribePlans(next, onError) {
  return onSnapshot(
    plansCol,
    (snap) => {
      const out = {};
      snap.forEach((d) => (out[d.id] = d.data()));
      next(out);
    },
    onError
  );
}

export function subscribePlan(email, next, onError) {
  return onSnapshot(
    doc(plansCol, email),
    (snap) => next(snap.exists() ? snap.data() : null, snap.metadata.fromCache),
    onError
  );
}

export function savePlan(email, patch) {
  return setDoc(doc(plansCol, email), { ...patch, updatedAt: Date.now() }, { merge: true });
}

/** 업체가 입력한 값(응답 + 내년 계획)을 모두 지운다. 명단은 남는다. */
export async function clearResponses() {
  let count = 0;
  for (const col of [responsesCol, plansCol]) {
    const snap = await getDocs(col);
    const refs = snap.docs.map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    count += refs.length;
  }
  return count;
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
