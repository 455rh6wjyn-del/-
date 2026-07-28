import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/**
 * 웹 앱용 Firebase 설정값은 비밀이 아니다(브라우저에 그대로 노출되는 식별자).
 * 실제 접근 제어는 Firestore 보안 규칙(firestore.rules)이 담당한다.
 * 리포지토리 루트의 커피노트 페이지와 같은 프로젝트를 쓴다.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCpqPBtxjBDT_Zp9CQu9cIu2oY0sOShX6I",
  authDomain: "lovehouse-b7440.firebaseapp.com",
  projectId: "lovehouse-b7440",
  storageBucket: "lovehouse-b7440.firebasestorage.app",
  messagingSenderId: "910165492271",
  appId: "1:910165492271:web:258d97081d966a5f27fcda",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
