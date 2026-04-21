# 사용자별 메모 시스템 구현 가이드

## 📝 개요
이 문서는 사용자별 메모 시스템을 기존 app.js에 통합하는 방법을 단계별로 안내합니다.

## 🔧 Phase 1: Firebase Security Rules 배포

### 1-1. Firebase Console에서 배포
```bash
# Firebase CLI를 사용하여 배포
firebase deploy --only firestore:rules

# 또는 Firebase Console에서 수동으로 firestore.rules 파일 내용을 복사/붙여넣기
```

### 1-2. 규칙 테스트
Firebase Console > Firestore Database > Rules 탭에서 다음 시나리오를 테스트:
- ✅ 소유자가 자신의 트리를 읽을 수 있는지
- ✅ 편집자가 공유된 트리를 수정할 수 있는지
- ✅ 사용자가 자신의 메모를 읽고 쓸 수 있는지
- ❌ 다른 사용자의 메모를 읽을 수 없는지

## 🔧 Phase 2: app.js에 코드 추가

### 2-1. 상태 변수 추가 (app.js 라인 76 근처)
```javascript
// 기존 코드
const notes = ref([]);
const appointments = ref([]);
const recruits = ref([]);

// 추가할 코드
const memberNotes = ref({});  // { memberId: [{ id, text, createdAt, updatedAt }] }
let unsubMemberNotes = {};
let unsubGlobalNotes = null;
```

### 2-2. 유틸리티 함수 추가 (app.js 라인 41 근처, getCollectionPath 다음)
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

### 2-3. 메모 구독 함수 추가 (app.js 라인 395 subscribeToCurrentTree 다음)
```javascript
// ── User Notes Subscription ──
const subscribeToUserNotes = () => {
  unsubscribeAllNotes();  // 기존 구독 정리
  
  if (!currentUser.value || !currentTreeId.value) return;
  
  // 전역 메모 구독
  const globalPath = getUserNotesPath(currentUser.value.uid, currentTreeId.value);
  const globalRef = doc(db, globalPath);
  unsubGlobalNotes = onSnapshot(globalRef, (snap) => {
    if (snap.exists()) {
      notes.value = snap.data().notes || [];
    } else {
      notes.value = [];
    }
  }, (err) => {
    console.error('[userNotes] global notes error', err);
  });
  
  // 각 멤버별 메모 구독
  members.value.forEach(member => {
    subscribeMemberNotes(member.id);
  });
};

const subscribeMemberNotes = (memberId) => {
  if (!currentUser.value || !currentTreeId.value) return;
  if (unsubMemberNotes[memberId]) return; // 이미 구독 중
  
  const notePath = getUserNotesPath(currentUser.value.uid, currentTreeId.value, memberId);
  const noteRef = doc(db, notePath);
  
  unsubMemberNotes[memberId] = onSnapshot(noteRef, (snap) => {
    if (snap.exists()) {
      memberNotes.value[memberId] = snap.data().notes || [];
    } else {
      memberNotes.value[memberId] = [];
    }
  }, (err) => {
    console.error(`[userNotes] member ${memberId} error`, err);
  });
};

const unsubscribeAllNotes = () => {
  if (unsubGlobalNotes) {
    unsubGlobalNotes();
    unsubGlobalNotes = null;
  }
  
  Object.values(unsubMemberNotes).forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });
  unsubMemberNotes = {};
  
  memberNotes.value = {};
};
```

### 2-4. createNewTree 함수 수정 (라인 257)
```javascript
const createNewTree = () => {
  currentTreeId.value = 'tree_' + Date.now();
  Object.assign(header, defaultHeader());
  const root = defaultRoot();
  if (currentUser.value && currentUser.value.email) root.email = currentUser.value.email;
  members.value = [root];
  notes.value = [];
  recruits.value = [];
  appointments.value = [];
  currentTreeMeta.value = {
    ownerId: currentUser.value ? currentUser.value.uid : '',
    ownerEmail: currentUser.value ? (currentUser.value.email || '') : '',
    sharedEmails: [],
    sharePermissions: {}
  };
  isDashboard.value = false;
  subscribeToCurrentTree();
  subscribeToUserNotes();  // 추가
  nextTick(centerTree);
};
```

### 2-5. loadTree 함수 수정 (라인 277)
```javascript
const loadTree = (treeSummary) => {
  if(!treeSummary.data) return;
  applyingRemote = true;
  try { restore(treeSummary.data); } finally { applyingRemote = false; }
  currentTreeId.value = treeSummary.id;
  currentTreeMeta.value = {
    ownerId: treeSummary.ownerId || '',
    ownerEmail: treeSummary.ownerEmail || '',
    sharedEmails: treeSummary.sharedEmails || [],
    sharePermissions: treeSummary.sharePermissions || {}
  };
  isDashboard.value = false;
  nextTick(() => {
    setRootEmailToLoginIfEmpty();
    centerTree();
  });
  subscribeToCurrentTree();
  subscribeToUserNotes();  // 추가
};
```

### 2-6. goToDashboard 함수 수정 (라인 296)
```javascript
const goToDashboard = () => {
  if (unsubTreeDoc) { unsubTreeDoc(); unsubTreeDoc = null; }
  unsubscribeAllNotes();  // 추가
  isDashboard.value = true;
  currentTreeId.value = null;
  currentTreeMeta.value = null;
  fetchSavedTrees();
};
```

### 2-7. logout 함수 수정 (라인 222)
```javascript
const logout = async () => {
  if (unsubTreeDoc) { unsubTreeDoc(); unsubTreeDoc = null; }
  unsubscribeAllNotes();  // 추가
  await signOut(auth);
  isDashboard.value = true;
  currentTreeId.value = null;
  savedTrees.value = [];
  sharedTrees.value = [];
  currentTreeMeta.value = null;
};
```

### 2-8. 메모 CRUD 함수 추가 (라인 1172 addNote 수정)
```javascript
// 전역 메모 추가 (기존 notes 배열 대신 Firestore에 저장)
async function addNote() {
  if (!newNote.value.trim() || !currentUser.value || !currentTreeId.value) return;
  
  const globalPath = getUserNotesPath(currentUser.value.uid, currentTreeId.value);
  const globalRef = doc(db, globalPath);
  
  try {
    const existing = await getDoc(globalRef);
    const currentNotes = existing.exists() ? (existing.data().notes || []) : [];
    
    const newNoteObj = {
      id: 'note_' + Date.now(),
      text: newNote.value.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(globalRef, {
      notes: [...currentNotes, newNoteObj],
      updatedAt: serverTimestamp()
    });
    
    newNote.value = '';
    showToastMsg('✅ 메모가 저장되었습니다.');
  } catch (e) {
    console.error('메모 저장 실패:', e);
    showToastMsg('메모 저장 실패', 'error');
  }
}

// 멤버별 메모 추가 (신규)
async function addMemberNote(memberId, noteText) {
  if (!noteText?.trim() || !currentUser.value || !currentTreeId.value) return;
  
  const notePath = getUserNotesPath(currentUser.value.uid, currentTreeId.value, memberId);
  const noteRef = doc(db, notePath);
  
  try {
    const existing = await getDoc(noteRef);
    const currentNotes = existing.exists() ? (existing.data().notes || []) : [];
    
    const newNoteObj = {
      id: 'note_' + Date.now(),
      text: noteText.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(noteRef, {
      notes: [...currentNotes, newNoteObj],
      updatedAt: serverTimestamp()
    });
    
    showToastMsg('✅ 멤버 메모가 저장되었습니다.');
  } catch (e) {
    console.error('멤버 메모 저장 실패:', e);
    showToastMsg('메모 저장 실패', 'error');
  }
}

// 멤버별 메모 삭제 (신규)
async function removeMemberNote(memberId, noteId) {
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
}
```

### 2-9. snapshot 함수 수정 (라인 1402)
```javascript
function snapshot(){
  return {
    header:{...header},
    members:JSON.parse(JSON.stringify(members.value)),
    // notes 제거 - 이제 사용자별로 Firestore에 저장됨
    recruits:JSON.parse(JSON.stringify(recruits.value)),
    appointments:JSON.parse(JSON.stringify(appointments.value)),
    recruitPosition:recruitPosition.value, 
    notesPosition:notesPosition.value, 
    memberInfoPosition:memberInfoPosition.value, 
    appointmentPosition:appointmentPosition.value,
    nodeWidth:nodeWidth.value, 
    nodeBaseHeight:nodeBaseHeight.value, 
    nodeFontSize:nodeFontSize.value, 
    nodeLineGap:nodeLineGap.value, 
    notePanelWidth:notePanelWidth.value,
    legendConfig:JSON.parse(JSON.stringify(legendConfig.value))
  };
}
```

### 2-10. restore 함수 수정 (라인 1423)
```javascript
function restore(d){
  clearFocus(); 
  Object.assign(header,d.header);
  members.value=(d.members||[]).map(m=>{
    const history=(m.history||[]).map(h=>migrateHistory({...h}));
    const interactionHistory = m.interactionHistory || [];
    let st = m.status;
    if(st === 'New' || st === 'Code-in') st = 'New(Code-in)';
    const disp = m.disposition ? JSON.parse(JSON.stringify(m.disposition)) : defaultDisposition();
    return {birthDate:'',age:'',meetDate:'',major:'',job:'',company:'',relation:'',gender:'남',email:'',issuePaid:0,pending:0,score:0, interactionHistory, recruitId:null, ...m, status:st, history, disposition: disp};
  });
  // notes 복원 제거 - Firestore에서 로드됨
  if(d.recruits) {
    recruits.value = d.recruits.map(r => {
      let ih = r.interactionHistory || [];
      if (r.history && r.history.length > 0 && ih.length === 0) {
        ih = r.history.map(h => typeof h === 'string' ? {id:'ih'+Math.random(), date:'', content:h} : h);
      }
      const disp = r.disposition ? JSON.parse(JSON.stringify(r.disposition)) : defaultDisposition();
      return {relation:'',meetDate:'',major:'',job:'',company:'',period:'',gender:'남',birthDate:'',age:'',email:'',...r, interactionHistory: ih, disposition: disp};
    });
  }
  if(d.appointments) appointments.value = d.appointments.map(a => ({
    type: '이벤트', time: '', endTime: '', location: '', description: '', attendees: [], targetName: '', ...a
  }));
  
  if(d.recruitPosition) recruitPosition.value=d.recruitPosition;
  if(d.notesPosition) notesPosition.value=d.notesPosition;
  if(d.memberInfoPosition) memberInfoPosition.value=d.memberInfoPosition;
  if(d.appointmentPosition) appointmentPosition.value=d.appointmentPosition;
  if(d.nodeWidth) nodeWidth.value=d.nodeWidth;
  if(d.nodeBaseHeight) nodeBaseHeight.value=d.nodeBaseHeight;
  if(d.nodeFontSize) nodeFontSize.value=d.nodeFontSize;
  if(d.nodeLineGap) nodeLineGap.value=d.nodeLineGap;
  if(d.notePanelWidth) notePanelWidth.value=d.notePanelWidth;
  if(d.legendConfig&&d.legendConfig.items){
    legendConfig.value.show=d.legendConfig.show;
    for(let k in d.legendConfig.items){ 
      if(legendConfig.value.items[k]) legendConfig.value.items[k]=d.legendConfig.items[k]; 
    }
  }
}
```

### 2-11. computed 속성 추가 (라인 615 selectedMember 다음)
```javascript
const selectedMemberNotes = computed(() => {
  if (!selectedMemberId.value) return [];
  return memberNotes.value[selectedMemberId.value] || [];
});
```

### 2-12. return 문에 추가 (라인 1692)
```javascript
return {
  // ... 기존 return 값들
  memberNotes,
  selectedMemberNotes,
  addMemberNote,
  removeMemberNote,
  subscribeToUserNotes,
  unsubscribeAllNotes,
  // ... 나머지
};
```

### 2-13. watch 문에서 notes 제거 (라인 1682)
```javascript
// 기존
watch([header,members,notes,recruits,appointments,...],()=>{

// 수정 (notes 제거)
watch([header,members,recruits,appointments,...],()=>{
```

## 🔧 Phase 3: UI 수정 (index.html)

### 3-1. 멤버 정보 패널에 메모 섹션 추가 (라인 535 다음)
```html
<!-- 멤버별 메모 섹션 추가 -->
<div>
  <div class="mem-hist-section-title">📝 나의 메모 (비공개)</div>
  <div class="mem-hist-list">
    <div v-for="note in selectedMemberNotes" :key="note.id" class="mem-int-item">
      <span class="mem-int-date">{{ note.createdAt ? new Date(note.createdAt).toLocaleDateString('ko-KR') : '—' }}</span>
      <span class="mem-int-content">{{ note.text }}</span>
      <button class="del-x-btn" @click.stop="removeMemberNote(selectedMemberId, note.id)" title="삭제">✕</button>
    </div>
    <div v-if="selectedMemberNotes.length === 0" class="mem-hist-empty">개인 메모가 없습니다.</div>
  </div>
  <!-- 메모 추가 입력 -->
  <div class="hist-add-row" style="margin-top:8px;">
    <input 
      class="history-content-input" 
      v-model="newMemberNoteText" 
      placeholder="이 멤버에 대한 나의 메모 입력..." 
      @keyup.enter="addMemberNote(selectedMemberId, newMemberNoteText); newMemberNoteText='';"
      style="flex:1;">
    <button 
      class="btn btn-primary" 
      style="padding:3px 12px;font-size:11px;white-space:nowrap;flex-shrink:0" 
      @click="addMemberNote(selectedMemberId, newMemberNoteText); newMemberNoteText='';">
      + 메모 추가
    </button>
  </div>
</div>
```

### 3-2. app.js에 newMemberNoteText 상태 추가
```javascript
const newMemberNoteText = ref('');

// return 문에도 추가
return {
  // ...
  newMemberNoteText,
  // ...
};
```

## 🔧 Phase 4: 데이터 마이그레이션 (선택사항)

기존 notes 데이터를 사용자별 Firestore로 마이그레이션:

```javascript
// app.js에 추가 (initAuth 함수 내부)
const migrateNotesToUserNotes = async () => {
  if (!currentUser.value || !currentTreeId.value) return;
  
  try {
    const treeRef = doc(db, getTreesPath(), currentTreeId.value);
    const treeSnap = await getDoc(treeRef);
    
    if (!treeSnap.exists() || !treeSnap.data().data?.notes) return;
    
    const oldNotes = treeSnap.data().data.notes;
    if (!oldNotes || oldNotes.length === 0) return;
    
    const globalPath = getUserNotesPath(currentUser.value.uid, currentTreeId.value);
    const globalRef = doc(db, globalPath);
    
    // 이미 마이그레이션 되었는지 확인
    const existing = await getDoc(globalRef);
    if (existing.exists() && existing.data().migratedFrom === 'legacy') {
      return; // 이미 마이그레이션됨
    }
    
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
    
    console.log('✅ 메모 마이그레이션 완료:', migratedNotes.length, '개');
    showToastMsg(`📦 ${migratedNotes.length}개의 기존 메모가 마이그레이션되었습니다.`);
  } catch (e) {
    console.error('메모 마이그레이션 실패:', e);
  }
};

// loadTree 함수에서 호출
const loadTree = (treeSummary) => {
  // ... 기존 코드
  subscribeToCurrentTree();
  subscribeToUserNotes();
  migrateNotesToUserNotes();  // 추가
};
```

## ✅ 테스트 체크리스트

### 기본 기능
- [ ] 트리 로드 시 사용자별 메모가 로드되는지
- [ ] 멤버별로 메모를 추가할 수 있는지
- [ ] 추가한 메모가 실시간으로 반영되는지
- [ ] 메모를 삭제할 수 있는지
- [ ] 전역 메모(기존 notes)가 정상 작동하는지

### 권한 테스트
- [ ] 다른 사용자의 메모가 보이지 않는지
- [ ] 공유된 트리에서 각자의 메모가 독립적으로 관리되는지
- [ ] 읽기 전용 사용자도 자신의 메모는 추가/삭제할 수 있는지

### 데이터 무결성
- [ ] 트리를 전환해도 메모가 유지되는지
- [ ] 로그아웃 후 재로그인 시 메모가 유지되는지
- [ ] 서브 트리 공유 시 메모가 포함되지 않는지 (의도된 동작)

## 🐛 트러블슈팅

### 문제: "Missing or insufficient permissions" 오류
**해결**: firestore.rules 파일이 올바르게 배포되었는지 확인
```bash
firebase deploy --only firestore:rules
```

### 문제: 메모가 로드되지 않음
**해결**: 
1. subscribeToUserNotes()가 loadTree와 createNewTree에서 호출되는지 확인
2. Chrome DevTools에서 Firestore 요청 확인
3. Firebase Console에서 userNotes 컬렉션 데이터 확인

### 문제: 메모가 중복 저장됨
**해결**: subscribeMemberNotes에서 이미 구독 중인 경우 조기 반환하는지 확인
```javascript
if (unsubMemberNotes[memberId]) return; // 이미 구독 중
```

## 📊 성능 최적화

### Lazy Loading (선택사항)
멤버가 많을 경우 모든 멤버의 메모를 구독하면 비용이 증가할 수 있습니다.
선택된 멤버의 메모만 로드하도록 변경:

```javascript
// selectedMemberId가 변경될 때만 해당 멤버 메모 구독
watch(selectedMemberId, (newId, oldId) => {
  if (newId && !memberNotes.value[newId]) {
    subscribeMemberNotes(newId);
  }
});
```

## 🎉 완료!

모든 단계를 완료하면 사용자별 메모 시스템이 완전히 작동합니다:
- ✅ 각 사용자가 독립적인 메모를 관리
- ✅ 멤버별로 개별 메모 저장
- ✅ 실시간 동기화
- ✅ 서브 트리 공유 시 메모는 공유되지 않음
- ✅ Firebase Security Rules로 보안 보장
