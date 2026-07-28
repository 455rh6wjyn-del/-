# 자금수요조사 사이트

Firebase Hosting(`fund-survey-bfd82`) 한 곳에 정적 페이지 두 개를 올린다.

| 경로 | 내용 | 소스 |
| --- | --- | --- |
| `/` | 햄쮸하우스 커피노트 (PWA) | `index.html`, `sw.js`, `manifest.json`, `icons/` |
| `/fund-survey/` | 자금수요조사 (React + Firestore) | `fund-survey/` |

Firestore 는 앱마다 다른 프로젝트를 쓴다.

- 자금수요조사 → `fund-survey-bfd82` (이 저장소의 `firestore.rules` 가 적용되는 곳)
- 커피노트 → `lovehouse-b7440` (`index.html` 안에 자기 설정을 따로 들고 있다)

호스팅만 `fund-survey-bfd82` 로 합쳐져 있고, 커피노트가 읽고 쓰는 데이터는 예전 그대로다.

---

## 1. 자금수요조사 앱

업체가 **이메일 주소**로 들어와, 지원받는 프로젝트마다 9~12월 월별 인출계획과 미집행예정액을
넣는다. `현재까지 집행액 + 9~12월 합계 + 미집행예정액 = 2026년 배정금액` 이 딱 맞아야 미리보기를
거쳐 제출할 수 있다. 여기에 더해 2027년 신규 신청 계획을 업체당 한 번 받는다.
관리자는 비밀번호로 들어와 진행현황을 실시간으로 보고 결과를 엑셀로 내려받는다.

- 조사 단위는 업체가 아니라 **프로젝트**다. 한 업체가 여러 프로젝트를 지원받을 수 있어서,
  이메일로 들어오면 프로젝트 목록이 먼저 나온다.
- 금액은 모두 **백만원 단위 정수**다.

### 데이터 구조 (Firestore)

```
fundSurvey/config              { title, deadline, adminPwHash }
fundSurvey/projects            { list: [{ id, year, name, company, bizNo, email, budget, spent }] }
fundSurveyResponses/{프로젝트ID} { email, m9..m12, unspent, manager, phone, status, updatedAt }
fundSurveyPlans/{이메일}         { apply, totalCost, loanWanted, updatedAt }
```

프로젝트 ID 는 `이메일::선정연도::프로젝트명` 이다. 명단을 다시 올려도 같은 프로젝트면
기존 입력이 그대로 붙는다. 응답을 프로젝트별 문서로 나눈 덕에 여러 업체가 같은 시각에
제출해도 서로의 입력을 덮어쓰지 않고, 업체 화면은 자기 이메일 것만 읽어간다.

내년 신규 신청 계획은 프로젝트가 아니라 업체 단위라 이메일을 문서 ID 로 쓴다.

### 처음 쓰는 순서

1. 배포된 `/fund-survey/` 주소로 들어가면 **처음 설정** 화면이 나온다.
   조사명 · 관리자 비밀번호 · 마감일을 넣고 시작한다. (한 번만)
2. 관리자 → **명단** 탭에서 양식을 내려받아 채운 뒤 올린다. 한 줄에 프로젝트 하나이고,
   머리글은 `선정연도 / 프로젝트명 / 업체명 / 사업자번호 / 이메일 / 2026년 배정금액 / 현재까지 집행액`.
   금액은 백만원 단위 정수.
3. 업체에는 `/fund-survey/` 주소만 알려주면 된다. 각자 명단에 등록된 이메일로 들어간다.
4. 관리자 → **현황** 탭에서 제출 상황을 보고 `결과 엑셀 내려받기`.

---

## 2. 로컬 개발

```bash
npm run install:app     # fund-survey/ 의존성 설치
npm run dev             # http://localhost:5173/fund-survey/
npm run build           # public/ 에 배포용 결과 생성
```

`npm run build` 는 `fund-survey/` 를 vite 로 빌드해 `public/fund-survey/` 에 넣고,
루트의 커피노트 정적 파일을 `public/` 로 복사한다. `public/` 은 빌드 산출물이라
git 에 올리지 않는다.

---

## 3. Firebase 배포

### 다른 Firebase 프로젝트로 바꾸기

콘솔에서 프로젝트를 새로 만들고 **웹 앱(</>)** 을 하나 추가하면 `firebaseConfig` 가 나온다.
그 값으로 아래 세 곳을 고치면 끝이다.

| 파일 | 고칠 것 |
| --- | --- |
| `fund-survey/src/firebase-config.js` | `firebaseConfig` 전체 |
| `.firebaserc` | `projects.default` = 새 프로젝트 ID |
| `.github/workflows/firebase-hosting.yml` | `projectId` = 새 프로젝트 ID |

새 프로젝트에서도 **Firestore 데이터베이스**와 **Hosting** 을 켜고 `npm run deploy:rules`
로 규칙을 올려야 한다. `FIREBASE_SERVICE_ACCOUNT` 시크릿도 새 프로젝트 것으로 다시 발급받는다.

커피노트(루트 페이지)는 `index.html` 안에 자기 `firebaseConfig` 를 따로 들고 있다.
같이 옮길 게 아니면 건드리지 않아도 된다.

### 최초 1회 준비

```bash
npm install -g firebase-tools
firebase login
```

Firebase 콘솔에서 프로젝트 `fund-survey-bfd82` 에 **Firestore 데이터베이스**가
켜져 있어야 한다(완료). Hosting 은 첫 배포 때 자동으로 켜진다.
그다음 보안 규칙을 올린다.

```bash
npm run deploy:rules    # firestore.rules 반영
```

> 이 명령은 `fund-survey-bfd82` 의 규칙을 `firestore.rules` 내용으로 **덮어쓴다.**
> 커피노트가 쓰는 `lovehouse-b7440` 쪽 규칙은 건드리지 않는다.

### 손으로 배포

```bash
npm run deploy          # 빌드 + firebase deploy --only hosting
```

### GitHub Actions 자동 배포

`main` 브랜치에 푸시하면 `.github/workflows/firebase-hosting.yml` 이 빌드 후 배포한다.
동작하려면 저장소 시크릿 `FIREBASE_SERVICE_ACCOUNT` 가 필요하다.

가장 쉬운 방법:

```bash
firebase init hosting:github
```

깃허브 저장소를 물으면 `455rh6wjyn-del/-` 를, 프로젝트는 `fund-survey-bfd82` 를 고른다. 서비스 계정을 만들어 시크릿까지
자동으로 등록해 준다. 워크플로 파일을 새로 만들지 묻거든 **거절**하고(이미 있음),
혹시 덮어썼다면 `git checkout .github/workflows/firebase-hosting.yml` 로 되돌린다.

손으로 하려면: Google Cloud 콘솔에서 `Firebase Hosting 관리자` 권한을 가진 서비스 계정을
만들고, JSON 키 전체를 저장소 `Settings → Secrets and variables → Actions` 의
`FIREBASE_SERVICE_ACCOUNT` 에 붙여 넣는다.

배포 후 주소는 `https://fund-survey-bfd82.web.app/fund-survey/` 이다.

---

## 4. 보안에 대해 알아둘 것

이 앱에는 **로그인이 없다.** 주소를 아는 사람은 누구나 접근할 수 있고, 명단에 있는
사업자번호만 알면 그 업체의 입력값을 보고 고칠 수 있다. 관리자 비밀번호도 브라우저에서만
검사한다(해시로 저장하지만, 마음먹으면 우회할 수 있다).

`firestore.rules` 로 막아둔 것은 이 정도다.

- 관리자 비밀번호 해시는 한 번 만들어지면 클라이언트에서 바꿀 수 없다
  (비밀번호를 바꾸려면 콘솔에서 `fundSurvey/config` 문서를 지우고 다시 설정한다).
- 정해둔 경로 밖의 컬렉션은 전부 접근 불가.

식별자를 사업자번호에서 이메일로 바꾼 것도 같은 맥락이다. 사업자번호는 공개 정보라
아무나 남의 업체 입력값을 열 수 있었지만, 이메일은 최소한 개별로 안내받은 사람만 안다.
그래도 이메일을 아는 사람은 들어갈 수 있으니, 진짜 인증이 필요하면
Firebase Authentication(이메일 링크 로그인)을 얹어야 한다.

담당자 연락처가 들어가는 조사이므로, 외부에 널리 알려질 주소라면
Firebase Authentication + App Check 를 얹는 것을 권한다.

---

조사 대상 월(`MONTHS`), 배정 연도(`BUDGET_YEAR`), 금액 단위(`UNIT`)는
`fund-survey/src/App.jsx` 위쪽 상수 몇 줄에서 정한다.
화면 문구·엑셀 열·관리자 표가 모두 여기서 따라간다.

---

## 5. 그 밖에

- 엑셀 처리는 npm 의 `xlsx@0.18.5` 를 쓴다. SheetJS 최신판은 npm 이 아니라
  `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` 로 설치해야 한다
  (이 저장소를 만든 환경에서는 해당 CDN 이 막혀 있어 npm 판을 썼다).
- 커피노트의 서비스워커는 사이트 전체가 범위라, `/fund-survey` 경로는
  캐시하지 않고 항상 네트워크에서 받도록 예외를 뒀다. 그러지 않으면 재배포 후에도
  옛 빌드가 남아 빈 화면이 뜰 수 있다.
