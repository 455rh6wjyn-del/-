/**
 * ★ Firebase 프로젝트를 바꿀 때 고치는 곳 ★
 *
 * Firebase 콘솔 → 프로젝트 설정(톱니바퀴) → 내 앱 → 웹 앱(</>) 에 나오는
 * firebaseConfig 를 그대로 붙여 넣으면 된다.
 * 여기 값들은 비밀이 아니다. 브라우저에 그대로 노출되는 식별자이고,
 * 실제 접근 제어는 firestore.rules 가 담당한다.
 *
 * 프로젝트를 바꾸면 아래 세 곳도 같이 고쳐야 한다.
 *   1) 이 파일
 *   2) /.firebaserc                          → projects.default
 *   3) /.github/workflows/firebase-hosting.yml → projectId
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCpqPBtxjBDT_Zp9CQu9cIu2oY0sOShX6I",
  authDomain: "lovehouse-b7440.firebaseapp.com",
  projectId: "lovehouse-b7440",
  storageBucket: "lovehouse-b7440.firebasestorage.app",
  messagingSenderId: "910165492271",
  appId: "1:910165492271:web:258d97081d966a5f27fcda",
};
