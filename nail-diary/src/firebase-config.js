/**
 * ★ Firebase 프로젝트를 바꿀 때 고치는 곳 ★
 *
 * 네일다이어리는 자금수요조사(fund-survey-bfd82)와는 별도인 naildiary
 * 프로젝트의 Firestore·Storage 를 쓴다. Hosting 만 fund-survey-bfd82 에
 * 얹혀서 /nail-diary/ 경로로 나간다 (README 2번 섹션 참고).
 * 여기 값들은 비밀이 아니다. 브라우저에 그대로 노출되는 식별자이고,
 * 실제 접근 제어는 nail-diary/firestore.rules · nail-diary/storage.rules 가 담당한다.
 *
 * 프로젝트를 바꾸면 nail-diary/.firebaserc 의 projects.default 도 같이 고친다.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyC30DBXKiS8PDW406HFDmtGvLSRmQ3HM-o",
  authDomain: "naildiary.firebaseapp.com",
  projectId: "naildiary",
  storageBucket: "naildiary.firebasestorage.app",
  messagingSenderId: "783801254704",
  appId: "1:783801254704:web:2300015388dff8483dfef5",
};
