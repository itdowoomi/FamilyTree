# 사용자별 메모 시스템 - 요약 문서

## 🎯 핵심 개념

### 현재 상황
- **문제**: 모든 사용자가 같은 메모를 보고 수정함
- **요구사항**: 각 사용자가 자신만의 메모를 관리하고, 멤버별로 메모 작성 가능

### 해결 방안
```
기존: trees/{treeId}/data/notes[] (공유됨 ❌)
      ↓
신규: userNotes/{userId}/trees/{treeId}/memberNotes/{memberId} (개인 ✅)
```

## 📁 생성된 파일

1. **`DESIGN_USER_NOTES.md`** - 전체 시스템 설계 문서
2. **`IMPLEMENTATION_GUIDE.md`** - 단계별 구현 가이드
3. **`firestore.rules`** - Firebase Security Rules
4. **`README_USER_NOTES.md`** (이 파일) - 빠른 참조 요약

## 🚀 빠른 시작 (3단계)

### 1단계: Firebase Rules 배포
```bash
cd /Users/donghyukbang/Desktop/FamilyTreeApp
firebase deploy --only firestore:rules
```

### 2단계: 코드 구현
`IMPLEMENTATION_GUIDE.md` 파일을 열어서 Phase 2의 모든 단계를 따라 app.js 수정

### 3단계: UI 추가
`IMPLEMENTATION_GUIDE.md` 파일의 Phase 3을 따라 index.html에 메모 UI 추가

## 🔑 주요 기능

### ✅ 이미 구현된 기능
- **서브 트리 공유**: `shareSubTree()` 함수로 이미 구현됨
- **실시간 동기화**: Firestore의 `onSnapshot()` 사용 중
- **동시 편집**: 현재 멤버/약속/리크릿 추가 시 모든 편집자에게 실시간 반영됨

### 🆕 새로 추가되는 기능
- **사용자별 메모**: 각 사용자가 자신만의 메모 관리
- **멤버별 메모**: 각 멤버에 대한 개인 메모 작성
- **보안**: Firebase Security Rules로 다른 사용자의 메모 접근 차단

## 📊 데이터 구조

### 전역 메모 (기존 notes 대체)
```javascript
userNotes/{userId}/trees/{treeId}/globalNotes
  ├─ notes: [
  │    { id: "note_123", text: "...", createdAt: "...", updatedAt: "..." }
  │  ]
  └─ updatedAt: timestamp
```

### 멤버별 메모 (신규)
```javascript
userNotes/{userId}/trees/{treeId}/memberNotes/{memberId}
  ├─ notes: [
  │    { id: "note_456", text: "...", createdAt: "...", updatedAt: "..." }
  │  ]
  └─ updatedAt: timestamp
```

## 🔒 보안 규칙 요약

```javascript
// ✅ 허용
- 사용자 본인의 메모 읽기/쓰기
- 트리 소유자의 트리 수정
- 편집 권한이 있는 공유 사용자의 트리 수정

// ❌ 차단
- 다른 사용자의 메모 접근
- 읽기 전용 사용자의 트리 수정
- 비소유자의 트리 삭제
```

## 💡 중요 포인트

### 1. 메모는 사용자별로 저장됨
같은 트리를 여러 사람이 공유해도, 각자의 메모는 독립적입니다.

```
사용자 A: "이 멤버는 다음 달에 연락하기"
사용자 B: "이 멤버는 내 친구 소개"
→ 서로 보이지 않음 ✅
```

### 2. 공유 트리는 실시간 동기화
멤버 추가, 약속 추가, 리크릿 추가는 **모든 편집자에게 실시간 반영**됩니다.
(이미 구현되어 있음 - `subscribeToCurrentTree()` 사용)

### 3. 서브 트리 공유 시 메모 제외
서브 트리를 공유할 때 **메모는 포함되지 않습니다** (개인 정보이므로).

## 🔧 핵심 함수

### 메모 구독
```javascript
subscribeToUserNotes()      // 전역 & 멤버별 메모 구독
subscribeMemberNotes(id)    // 특정 멤버 메모 구독
unsubscribeAllNotes()       // 모든 메모 구독 해제
```

### 메모 CRUD
```javascript
addNote()                   // 전역 메모 추가
addMemberNote(id, text)     // 멤버별 메모 추가
removeMemberNote(id, noteId) // 멤버별 메모 삭제
```

### 경로 생성
```javascript
getUserNotesPath(userId, treeId, memberId?)
// 반환: "userNotes/{userId}/trees/{treeId}/memberNotes/{memberId}"
```

## 📝 구현 체크리스트

- [ ] Firebase Rules 배포 완료
- [ ] app.js에 상태 변수 추가
- [ ] getUserNotesPath 함수 추가
- [ ] 메모 구독 함수 추가
- [ ] createNewTree, loadTree 함수 수정
- [ ] logout, goToDashboard 함수 수정
- [ ] 메모 CRUD 함수 추가
- [ ] snapshot, restore 함수 수정
- [ ] computed 속성 추가
- [ ] return 문에 새 함수들 추가
- [ ] index.html에 UI 추가
- [ ] 테스트 완료

## 🐛 문제 해결

### "Missing permissions" 오류가 나요
```bash
firebase deploy --only firestore:rules
```

### 메모가 로드되지 않아요
1. `subscribeToUserNotes()`가 호출되는지 확인
2. Chrome DevTools > Network 탭에서 Firestore 요청 확인
3. Firebase Console에서 데이터 확인

### 메모가 중복 저장돼요
`subscribeMemberNotes()` 함수에 중복 체크가 있는지 확인:
```javascript
if (unsubMemberNotes[memberId]) return; // 이미 구독 중
```

## 📚 참고 문서

- **설계 문서**: `DESIGN_USER_NOTES.md` - 전체 아키텍처 설명
- **구현 가이드**: `IMPLEMENTATION_GUIDE.md` - 단계별 코드 작성 방법
- **보안 규칙**: `firestore.rules` - Firebase 보안 설정

## 🎓 학습 포인트

이 구현을 통해 배우는 내용:
1. ✅ Firestore의 실시간 구독 (`onSnapshot`)
2. ✅ 사용자별 데이터 격리 (Security Rules)
3. ✅ 공유 데이터 vs 개인 데이터 분리
4. ✅ Vue 3 Composition API (`ref`, `computed`, `watch`)
5. ✅ 비동기 데이터 처리 (`async/await`)

## 🎉 완료 후 기대 효과

- ✅ 각 사용자가 자신만의 메모 작성
- ✅ 멤버별로 개인 메모 관리
- ✅ 실시간으로 멤버/약속/리크릿 동기화
- ✅ 보안이 강화된 메모 시스템
- ✅ 서브 트리 공유 시 개인정보 보호

---

## 💬 도움이 필요하신가요?

1. **설계 이해하기**: `DESIGN_USER_NOTES.md` 읽기
2. **구현 방법**: `IMPLEMENTATION_GUIDE.md` 따라하기
3. **보안 설정**: `firestore.rules` 배포하기

**모든 문서는 한국어로 작성되어 있습니다!** 🇰🇷
