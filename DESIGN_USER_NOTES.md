# 사용자별 메모 시스템 설계 문서

## 📋 요구사항 분석

1. **메모는 사용자별로 저장** - 나의 트리에서 작성한 메모는 나에게만 보임
2. **각 사람(멤버)별로 메모 저장** - 멤버마다 독립적인 메모 관리
3. **서브 트리에서 메모 보기** - 서브 트리를 볼 때 해당 멤버들의 이름과 메모가 함께 표시
4. **공유된 서브 트리 동시 편집** - 이미 구현됨 (Firestore onSnapshot)
5. **실시간 동기화** - 멤버/약속/리크릿/메모 추가 시 공유된 사람들에게 즉시 반영 (이미 구현됨)

## 🏗️ 데이터 모델 설계

### 현재 구조 (문제점)
```javascript
trees/{treeId}
  ├─ data
  │   ├─ members[]
  │   ├─ notes[]      // ❌ 모든 사용자가 같은 메모를 봄
  │   ├─ recruits[]
  │   └─ appointments[]
```

### 새로운 구조 (해결책)
```javascript
// 트리 데이터 (공유됨)
trees/{treeId}
  ├─ data
  │   ├─ members[]
  │   ├─ recruits[]
  │   └─ appointments[]
  
// 사용자별 메모 (개인)
userNotes/{userId}/trees/{treeId}/memberNotes/{memberId}
  ├─ notes: [
  │     { id, text, createdAt, updatedAt }
  │   ]
  └─ updatedAt

// 또는 전역 메모용
userNotes/{userId}/trees/{treeId}/globalNotes
  ├─ notes: [
  │     { id, text, createdAt, updatedAt }
  │   ]
```

## 🔐 Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 트리 접근 규칙 (기존 유지)
    match /trees/{treeId} {
      // 읽기: 소유자 또는 공유된 사용자
      allow read: if request.auth != null && (
        resource.data.ownerId == request.auth.uid ||
        request.auth.token.email.lower() in resource.data.sharedEmails
      );
      
      // 생성: 인증된 사용자
      allow create: if request.auth != null &&
        request.resource.data.ownerId == request.auth.uid;
      
      // 업데이트: 소유자 또는 편집 권한이 있는 공유 사용자
      allow update: if request.auth != null && (
        resource.data.ownerId == request.auth.uid ||
        (
          request.auth.token.email.lower() in resource.data.sharedEmails &&
          resource.data.sharePermissions[request.auth.token.email.lower()].role == 'editor'
        )
      );
      
      // 삭제: 소유자만
      allow delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }
    
    // 사용자별 메모 규칙 (신규)
    match /userNotes/{userId}/trees/{treeId}/{document=**} {
      // 본인의 메모만 읽기/쓰기 가능
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
    
    // Canvas 환경용 (있는 경우)
    match /artifacts/{appId}/trees/{treeId} {
      allow read: if request.auth != null && (
        resource.data.ownerId == request.auth.uid ||
        request.auth.token.email.lower() in resource.data.sharedEmails
      );
      
      allow create: if request.auth != null &&
        request.resource.data.ownerId == request.auth.uid;
      
      allow update: if request.auth != null && (
        resource.data.ownerId == request.auth.uid ||
        (
          request.auth.token.email.lower() in resource.data.sharedEmails &&
          resource.data.sharePermissions[request.auth.token.email.lower()].role == 'editor'
        )
      );
      
      allow delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }
    
    match /artifacts/{appId}/userNotes/{userId}/trees/{treeId}/{document=**} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
  }
}
```

## 💻 코드 구현 방법

### 1. 메모 저장 경로 함수 추가
```javascript
const getUserNotesPath = (userId, treeId, memberId = null) => {
  if (isCanvas) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    if (memberId) {
      return `artifacts/${appId}/userNotes/${userId}/trees/${treeId}/memberNotes/${memberId}`;
    }
    return `artifacts/${appId}/userNotes/${userId}/trees/${treeId}/globalNotes`;
  } else {
    if (memberId) {
      return `userNotes/${userId}/trees/${treeId}/memberNotes/${memberId}`;
    }
    return `userNotes/${userId}/trees/${treeId}/globalNotes`;
  }
};
```

### 2. 멤버별 메모 데이터 구조
```javascript
// 상태 추가
const memberNotes = ref({});  // { memberId: [{ id, text, createdAt }] }
const globalNotes = ref([]);  // 전역 메모 (기존 notes)
let unsubMemberNotes = {};
let unsubGlobalNotes = null;
```

### 3. 메모 로드 함수
```javascript
const loadUserNotes = async () => {
  if (!currentUser.value || !currentTreeId.value) return;
  
  // 전역 메모 로드
  const globalPath = getUserNotesPath(currentUser.value.uid, currentTreeId.value);
  const globalRef = doc(db, globalPath);
  unsubGlobalNotes = onSnapshot(globalRef, (snap) => {
    if (snap.exists()) {
      globalNotes.value = snap.data().notes || [];
    } else {
      globalNotes.value = [];
    }
  });
  
  // 각 멤버별 메모 구독
  members.value.forEach(member => {
    subscribeMemberNotes(member.id);
  });
};

const subscribeMemberNotes = (memberId) => {
  if (!currentUser.value || !currentTreeId.value) return;
  
  const notePath = getUserNotesPath(currentUser.value.uid, currentTreeId.value, memberId);
  const noteRef = doc(db, notePath);
  
  unsubMemberNotes[memberId] = onSnapshot(noteRef, (snap) => {
    if (snap.exists()) {
      memberNotes.value[memberId] = snap.data().notes || [];
    } else {
      memberNotes.value[memberId] = [];
    }
  });
};
```

### 4. 메모 추가 함수
```javascript
const addMemberNote = async (memberId, noteText) => {
  if (!currentUser.value || !currentTreeId.value || !noteText.trim()) return;
  
  const notePath = getUserNotesPath(currentUser.value.uid, currentTreeId.value, memberId);
  const noteRef = doc(db, notePath);
  
  try {
    const existing = await getDoc(noteRef);
    const currentNotes = existing.exists() ? (existing.data().notes || []) : [];
    
    const newNote = {
      id: 'note_' + Date.now(),
      text: noteText.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(noteRef, {
      notes: [...currentNotes, newNote],
      updatedAt: serverTimestamp()
    });
    
    showToastMsg('✅ 메모가 저장되었습니다.');
  } catch (e) {
    console.error('메모 저장 실패:', e);
    showToastMsg('메모 저장 실패', 'error');
  }
};

const removeMemberNote = async (memberId, noteId) => {
  if (!currentUser.value || !currentTreeId.value) return;
  
  const notePath = getUserNotesPath(currentUser.value.uid, currentTreeId.value, memberId);
  const noteRef = doc(db, notePath);
  
  try {
    const existing = await getDoc(noteRef);
    if (!existing.exists()) return;
    
    const filteredNotes = (existing.data().notes || []).filter(n => n.id !== noteId);
    
    await setDoc(noteRef, {
      notes: filteredNotes,
      updatedAt: serverTimestamp()
    });
    
    showToastMsg('메모가 삭제되었습니다.');
  } catch (e) {
    console.error('메모 삭제 실패:', e);
    showToastMsg('메모 삭제 실패', 'error');
  }
};
```

### 5. 메모 정리 함수
```javascript
const unsubscribeAllNotes = () => {
  if (unsubGlobalNotes) {
    unsubGlobalNotes();
    unsubGlobalNotes = null;
  }
  
  Object.values(unsubMemberNotes).forEach(unsub => unsub());
  unsubMemberNotes = {};
  
  memberNotes.value = {};
  globalNotes.value = [];
};
```

### 6. UI 컴포넌트에서 메모 표시
```javascript
// 선택된 멤버의 메모 가져오기
const selectedMemberNotes = computed(() => {
  if (!selectedMemberId.value) return [];
  return memberNotes.value[selectedMemberId.value] || [];
});

// 노드에 최근 메모 표시
function nodeNoteLines(m) {
  const memberNotesData = memberNotes.value[m.id] || [];
  const historyNotes = m.history ? m.history.filter(h => h.show)
    .sort((a,b) => parseDateForSort(b.date) - parseDateForSort(a.date))
    .reduce((acc, h) => {
      // ... 기존 로직
    }, []) : [];
  
  // 개인 메모도 함께 표시 (최근 2개)
  const recentNotes = [...memberNotesData]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 2)
    .map(n => ({ 
      text: `📝 ${n.text.substring(0, 30)}`, 
      isExtra: false 
    }));
  
  return [...historyNotes.slice(0, 3), ...recentNotes].slice(0, 5);
}
```

## 🔄 데이터 마이그레이션

기존 `notes` 배열을 `globalNotes`로 마이그레이션:

```javascript
const migrateNotesToUserNotes = async () => {
  if (!currentUser.value || !currentTreeId.value) return;
  
  const treeRef = doc(db, getTreesPath(), currentTreeId.value);
  const treeSnap = await getDoc(treeRef);
  
  if (!treeSnap.exists() || !treeSnap.data().data?.notes) return;
  
  const oldNotes = treeSnap.data().data.notes;
  if (!oldNotes || oldNotes.length === 0) return;
  
  const globalPath = getUserNotesPath(currentUser.value.uid, currentTreeId.value);
  const globalRef = doc(db, globalPath);
  
  const migratedNotes = oldNotes.map((n, i) => ({
    id: 'migrated_' + Date.now() + '_' + i,
    text: typeof n === 'string' ? n : n.text,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  
  await setDoc(globalRef, {
    notes: migratedNotes,
    updatedAt: serverTimestamp(),
    migratedFrom: 'legacy'
  });
  
  console.log('메모 마이그레이션 완료:', migratedNotes.length, '개');
};
```

## 📝 snapshot/restore 함수 수정

```javascript
// snapshot - 메모 제외
function snapshot() {
  return {
    header: {...header},
    members: JSON.parse(JSON.stringify(members.value)),
    // notes 제거 - 이제 사용자별로 저장됨
    recruits: JSON.parse(JSON.stringify(recruits.value)),
    appointments: JSON.parse(JSON.stringify(appointments.value)),
    // ... 기타 설정
  };
}

// restore - 메모 제외
function restore(d) {
  clearFocus(); 
  Object.assign(header, d.header);
  members.value = (d.members || []).map(m => {
    // ... 기존 로직
  });
  // notes 복원 제거
  // ... 나머지 로직
}
```

## 🎯 구현 단계

1. **Phase 1**: Firebase Security Rules 추가
2. **Phase 2**: 메모 관련 함수 추가 (getUserNotesPath, loadUserNotes 등)
3. **Phase 3**: UI 수정 (멤버별 메모 입력/표시)
4. **Phase 4**: 기존 데이터 마이그레이션
5. **Phase 5**: 테스트 및 검증

## ⚠️ 주의사항

1. **backward compatibility**: 기존 트리의 notes는 첫 로드 시 자동 마이그레이션
2. **서브 트리 공유**: 서브 트리를 공유할 때 메모는 포함되지 않음 (개인 메모이므로)
3. **비용 최적화**: 각 멤버별 실시간 구독이 많아질 수 있으므로 lazy loading 고려
