/**
 * ★ Firebase 프로젝트를 바꿀 때 고치는 곳 ★
 *
 * 네일다이어리는 지금 fund-survey-bfd82 프로젝트를 자금수요조사 앱과
 * 같이 쓴다 (Hosting 이 이미 이 프로젝트로 합쳐져 있어서, 새 프로젝트를
 * 만들지 않고 바로 쓸 수 있게 한 선택이다). 데이터는 nailDiary 로 시작하는
 * 컬렉션에만 저장되니 자금수요조사 데이터와 섞이지 않는다 (firestore.rules 참고).
 *
 * 완전히 분리하고 싶으면 콘솔에서 새 프로젝트 → 웹 앱(</>) 을 만들고
 * 나온 firebaseConfig 를 아래에 붙여 넣으면 된다. 그러면 이 프로젝트에서도
 * Firestore 와 Storage 를 새로 켜고 규칙을 올려야 한다.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyBdhE2d0rnyAaBE2eKGCZLWIZiHImPJF3U",
  authDomain: "fund-survey-bfd82.firebaseapp.com",
  projectId: "fund-survey-bfd82",
  storageBucket: "fund-survey-bfd82.firebasestorage.app",
  messagingSenderId: "895689323285",
  appId: "1:895689323285:web:9645134264ab9157d82f1c",
};
