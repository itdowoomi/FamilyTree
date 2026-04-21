import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;

  // ========== 파이어베이스 설정 (클라우드 호스팅용) ==========
  const isCanvas = typeof __firebase_config !== 'undefined';
  let app, auth, db;

  if (isCanvas) {
      app = initializeApp(JSON.parse(__firebase_config));
  } else {
      const firebaseConfig = {
          apiKey: "AIzaSyCqaelXcsffbrbkTN_Dq5vF4D7DZmVGdu8",
          authDomain: "myfamilytree-8d25f.firebaseapp.com",
          projectId: "myfamilytree-8d25f",
          storageBucket: "myfamilytree-8d25f.firebasestorage.app",
          messagingSenderId: "5519027679",
          appId: "1:5519027679:web:3c5d4802a80b09d19d286a",
          measurementId: "G-4BQ0S8YRDD"
      };
      try {
          app = initializeApp(firebaseConfig);
      } catch(e) {
          console.error("Firebase init error:", e);
      }
  }
  
  auth = getAuth(app);
  db = getFirestore(app);

  const getCollectionPath = (userId, colName) => {
      if (isCanvas) {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          return `artifacts/${appId}/users/${userId}/${colName}`;
      } else {
          return `users/${userId}/${colName}`;
      }
  };
  // ========================================================

  const VG = 70, HG = 20, PAD_Y = 50;

  const STATUSES = ['EFD','NFD','DFD','SFD','FD','SA','Agent','Licensed','New(Code-in)','Serious','Potential'];
  const ALL_STATUSES = ['root', ...STATUSES];

  const COLORS  = { root:'#1c2b4a', EFD:'#4a1a6b', NFD:'#6b2d8a', DFD:'#1a4a6b', SFD:'#1a5c5c', FD:'#2d5a2d', SA:'#2d4a2d', Agent:'#3d4a2d', Licensed:'#4a2d1c', 'Serious':'#e9e7e2', 'Potential':'#f8f9fa', 'New(Code-in)':'#ffffff' };
  const STROKES = { root:'#0f1e38', EFD:'#3a1258', NFD:'#561f72', DFD:'#123a58', SFD:'#124848', FD:'#1e3a1e', SA:'#1e3a1e', Agent:'#223316', Licensed:'#3a1e0e', 'Serious':'#ccc', 'Potential':'#9ca3af', 'New(Code-in)':'#cccccc' };
  const TEXT_COLORS = { root:'#ffffff', EFD:'#ffffff', NFD:'#ffffff', DFD:'#ffffff', SFD:'#ffffff', FD:'#ffffff', SA:'#ffffff', Agent:'#ffffff', Licensed:'#ffffff', 'Serious':'#333', 'Potential':'#555', 'New(Code-in)':'#333' };
  const DIVIDERS = { root:'rgba(255,255,255,.3)', EFD:'rgba(255,255,255,.3)', NFD:'rgba(255,255,255,.3)', DFD:'rgba(255,255,255,.3)', SFD:'rgba(255,255,255,.3)', FD:'rgba(255,255,255,.3)', SA:'rgba(255,255,255,.3)', Agent:'rgba(255,255,255,.3)', Licensed:'rgba(255,255,255,.3)', 'Serious':'rgba(0,0,0,.1)', 'Potential':'rgba(0,0,0,.05)', 'New(Code-in)':'rgba(0,0,0,.1)' };
  const BADGE_MAP = { EFD:'★★★★★ EFD', NFD:'★★★★ NFD', DFD:'★★★ DFD', SFD:'★★★ SFD', FD:'★★ FD', SA:'★★ SA', Agent:'★ Agent', Licensed:'★ Licensed', 'New(Code-in)':'◈ New(Code-in)' };

  createApp({
    setup() {
      // ── Cloud State ──
      const currentUser = ref(null);
      const isDashboard = ref(true);
      const savedTrees = ref([]);
      const currentTreeId = ref(null);

      // ── App State ──
      const defaultHeader = () => ({ title:'FD RUNNING CHART', id:'SCA87396', rank:'New(Code-in)', periodStart:'04/01/26', periodEnd:'06/30/26', asOf:'03/06/2026', fd:'ESTHER YI', sfd:'PETER AND JEAN', dd:'', efd:'HYEJEONG LEE' });
      const defaultDisposition = () => ({ relationScore: 0, market: '', married: false, child: false, house: false, income: false, ambition: false, dissatisfied: false, pma: false, entrepreneur: false });
      const defaultRoot = () => {
        const email = currentUser.value && currentUser.value.email ? currentUser.value.email : 'example@gmail.com';
        return { id:'root', recruitId: null, name:'방동혁 (Don Bang)', email, major:'교육학', job:'Logistics', company:'삼양 Logistics', status:'root', parentId:null, history:[], interactionHistory:[], issuePaid:0, pending:0, score:0, relation:'본인', age:51, meetDate:'1975', gender:'남', birthDate:'1975-01-01', disposition: defaultDisposition() };
      };

      const header = reactive(defaultHeader());
      const members = ref([
        defaultRoot(),
        { id:'m1', recruitId: null, name:'김은숙', email:'', major:'', job:'', company:'', status:'SA', parentId:'root', history:[], interactionHistory:[], issuePaid:0, pending:0, score:0, relation:'', age:'', meetDate:'', gender:'여', birthDate:'', disposition: defaultDisposition() }
      ]);
      const notes = ref([]);
      const appointments = ref([]);
      const recruits = ref([]);
      
      const notesPosition = ref('none');
      const recruitPosition = ref('none');
      const memberInfoPosition = ref('right');
      const appointmentPosition = ref('none');
      const tab = ref('memberInfo');

      const newNote = ref('');
      const showShareModal = ref(false);
      const showSubTreeShareModal = ref(false);
      const shareInput = reactive({ email: '', role: 'editor' });
      const subTreeShareInput = reactive({ email: '', role: 'editor', includeData: true });
      const toast = reactive({ msg:'', type:'success', visible:false });
      let toastTimer = null, autoTimer = null;
      const isDirty = ref(false);
      const lastAutoSave = ref('');
      const slots = ref(Array(5).fill(null));
      const printLandscape = ref(true);
      const showSizePanel = ref(false);
      const showPreview = ref(false);
      const printRootId = ref('__actual_root__');
      const printHistMode = ref('all');
      const printHistDays = ref(90);
      const printHistFrom = ref('');
      const printHistTo = ref('');
      const printIncludeLeft = ref(false);
      const printIncludeRight = ref(true);
      
      // 인쇄 옵션 변수들
      const printIncludeNotes = ref(true);
      const printIncludeRecruit = ref(true);
      const printIncludeAppointment = ref(true);
      const printIncludeMemberInfo = ref(true);
      const printIncludePointHistory = ref(true);
      
      const newRecruit = reactive({ name:'', email:'', major:'', job:'', company:'', relation:'', meetDate:'', period:'', gender:'남', score:50, birthDate:'', age:'' });
      const focusRootId = ref(null);
      
      const expandedMemberId = ref(null);
      const expandedInteractionId = ref(null);
      const expandedDispositionId = ref(null);
      
      const expandedRecruitInteractionId = ref(null);
      const expandedRecruitDispositionId = ref(null);
      
      const editingApptId = ref(null);
      
      const selectedMemberId = ref('root'); 
      const newHist = reactive({ date:'', type:'History', content:'', point:null, amount:null });
      const newInteraction = reactive({ date:'', content:'' });
      const newRecruitInteraction = reactive({ date:'', content:'' });
      const newAppt = reactive({ date: '', time: '', endTime: '', location: '', type: '이벤트', title: '', description: '', targetName: '', attendees: [], newAttendeeInput: '' });

      const nm = reactive({ name:'', email:'', major:'', job:'', company:'', status:'New(Code-in)', parentId:'root', birthDate:'', age:'', meetDate:'', relation:'', gender:'남', score:0 });

      const nodeWidth = ref(155), nodeBaseHeight = ref(58), nodeFontSize = ref(10), nodeLineGap = ref(11);
      const widthLocked = ref(false), heightLocked = ref(false), fontLocked = ref(false), lineGapLocked = ref(false);
      const notePanelWidth = ref(210), notePanelLocked = ref(false);
      const zoomLevel = ref(1), panX = ref(0), panY = ref(0);
      let isPanning = false, panStartX = 0, panStartY = 0, panStartPX = 0, panStartPY = 0;
      const legendConfig = ref({ show:true, items:{} });
      ALL_STATUSES.forEach(s => { legendConfig.value.items[s] = { label:s, show:true }; });

      // ── Auth & Cloud Logic ──
      // 최상위 공용 trees 컬렉션 (공유 지원)
      const getTreesPath = () => {
        if (isCanvas) {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          return `artifacts/${appId}/trees`;
        }
        return 'trees';
      };
      const getLegacyTreesPath = (uid) => getCollectionPath(uid, 'trees');

      const sharedTrees = ref([]);       // 공유받은 트리
      const currentTreeMeta = ref(null); // 현재 트리의 {ownerId, ownerEmail, sharedEmails, sharePermissions}
      let unsubTreeDoc = null;
      let lastLocalSaveMs = 0;
      let applyingRemote = false;
      let migrationDone = false;

      const initAuth = async () => {
        if (isCanvas) {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        }
        onAuthStateChanged(auth, async (user) => {
          currentUser.value = user;
          if (user) {
            if (!migrationDone) {
              migrationDone = true;
              await migrateLegacyTrees();
            }
            fetchSavedTrees();
            if (!isDashboard.value) setRootEmailToLoginIfEmpty();
          }
        });
      };

      // 레거시 users/{uid}/trees -> 최상위 trees/ 로 1회 이전
      const migrateLegacyTrees = async () => {
        if (!currentUser.value) return;
        try {
          const legacyPath = getLegacyTreesPath(currentUser.value.uid);
          const snap = await getDocs(collection(db, legacyPath));
          if (snap.empty) return;
          const topPath = getTreesPath();
          let migrated = 0;
          for (const d of snap.docs) {
            const data = d.data();
            const newRef = doc(db, topPath, d.id);
            const existing = await getDoc(newRef);
            if (existing.exists()) { await deleteDoc(doc(db, legacyPath, d.id)); continue; }
            await setDoc(newRef, {
              ...data,
              ownerId: currentUser.value.uid,
              ownerEmail: currentUser.value.email || '',
              sharedEmails: [],
              sharePermissions: {},
              migratedFromLegacy: true
            });
            await deleteDoc(doc(db, legacyPath, d.id));
            migrated++;
          }
          if (migrated > 0) console.log('[migration] moved', migrated, 'tree(s) to shared structure');
        } catch (e) {
          console.error('[migration] failed', e);
        }
      };

      const loginWithGoogle = async () => {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
        } catch (error) {
          console.error(error);
          showToastMsg('로그인에 실패했습니다.', 'error');
        }
      };

      const logout = async () => {
        if (unsubTreeDoc) { unsubTreeDoc(); unsubTreeDoc = null; }
        await signOut(auth);
        isDashboard.value = true;
        currentTreeId.value = null;
        savedTrees.value = [];
        sharedTrees.value = [];
        currentTreeMeta.value = null;
      };

      const fetchSavedTrees = async () => {
        if (!currentUser.value) return;
        try {
          const topPath = getTreesPath();
          const col = collection(db, topPath);
          // 내 트리
          const ownedSnap = await getDocs(query(col, where('ownerId', '==', currentUser.value.uid)));
          savedTrees.value = ownedSnap.docs.map(d => ({ id: d.id, ...d.data(), _owned: true }))
            .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          // 공유받은 트리
          const email = (currentUser.value.email || '').toLowerCase();
          if (email) {
            const sharedSnap = await getDocs(query(col, where('sharedEmails', 'array-contains', email)));
            sharedTrees.value = sharedSnap.docs
              .map(d => ({ id: d.id, ...d.data(), _owned: false }))
              .filter(t => t.ownerId !== currentUser.value.uid)
              .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          } else {
            sharedTrees.value = [];
          }
        } catch (e) {
          console.error("Error fetching trees:", e);
        }
      };

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
        nextTick(centerTree);
      };

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
      };

      const goToDashboard = () => {
        if (unsubTreeDoc) { unsubTreeDoc(); unsubTreeDoc = null; }
        isDashboard.value = true;
        currentTreeId.value = null;
        currentTreeMeta.value = null;
        fetchSavedTrees();
      };

      const deleteTree = async (id, name) => {
        if (!confirm(`'${name || '이 트리'}'를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
        try {
          const ref = doc(db, getTreesPath(), id);
          const snap = await getDoc(ref);
          if (snap.exists() && snap.data().ownerId !== currentUser.value.uid) {
            return showToastMsg('소유자만 삭제할 수 있습니다.', 'error');
          }
          await deleteDoc(ref);
          fetchSavedTrees();
          showToastMsg('트리가 삭제되었습니다.');
        } catch (e) {
          console.error(e);
          showToastMsg('삭제 실패', 'error');
        }
      };

      const saveToCloud = async (isAuto = false) => {
        if (!currentUser.value || !currentTreeId.value) return;
        if (currentIsReadOnly.value) {
          if (!isAuto) showToastMsg('읽기 전용 트리입니다. 저장할 수 없습니다.', 'error');
          return;
        }
        try {
          const ref = doc(db, getTreesPath(), currentTreeId.value);
          const existing = await getDoc(ref);
          const prev = existing.exists() ? existing.data() : null;

          const snap = snapshot();
          const now = Date.now();
          lastLocalSaveMs = now;

          const treeData = {
            name: rootMemberName.value || '제목 없는 트리',
            updatedAt: new Date().toLocaleString('ko-KR'),
            updatedAtMs: now,
            savedByUid: currentUser.value.uid,
            savedByEmail: currentUser.value.email || '',
            memberCount: members.value.length,
            data: snap,
            ownerId: prev ? prev.ownerId : currentUser.value.uid,
            ownerEmail: prev ? (prev.ownerEmail || currentUser.value.email || '') : (currentUser.value.email || ''),
            sharedEmails: prev ? (prev.sharedEmails || []) : [],
            sharePermissions: prev ? (prev.sharePermissions || {}) : {}
          };
          await setDoc(ref, treeData);
          lastAutoSave.value = treeData.updatedAt;
          isDirty.value = false;
          if(!isAuto) showToastMsg('☁️ 클라우드에 안전하게 저장되었습니다!');
        } catch (e) {
          console.error(e);
          showToastMsg('저장 실패', 'error');
        }
      };

      function quickSave() { saveToCloud(false); }

      // ── Realtime sync ──
      const subscribeToCurrentTree = () => {
        if (unsubTreeDoc) { unsubTreeDoc(); unsubTreeDoc = null; }
        if (!currentTreeId.value) return;
        const ref = doc(db, getTreesPath(), currentTreeId.value);
        unsubTreeDoc = onSnapshot(ref, (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          // 공유 메타 최신화
          currentTreeMeta.value = {
            ownerId: d.ownerId || '',
            ownerEmail: d.ownerEmail || '',
            sharedEmails: d.sharedEmails || [],
            sharePermissions: d.sharePermissions || {}
          };
          // 에코 무시: 내가 방금 저장한 변경
          if (d.savedByUid && currentUser.value && d.savedByUid === currentUser.value.uid) {
            if (d.updatedAtMs && Math.abs(d.updatedAtMs - lastLocalSaveMs) < 8000) return;
          }
          if (!d.data) return;
          applyingRemote = true;
          try {
            restore(d.data);
            lastAutoSave.value = d.updatedAt || '';
            isDirty.value = false;
            if (d.savedByEmail && (!currentUser.value || d.savedByEmail !== currentUser.value.email)) {
              showToastMsg(`🔄 ${d.savedByEmail} 님의 변경이 반영되었습니다.`);
            }
          } finally {
            nextTick(() => { applyingRemote = false; });
          }
        }, (err) => {
          console.error('[realtime] listener error', err);
        });
      };

      // ── Share CRUD ──
      const addShare = async (email, role) => {
        if (!currentTreeId.value || !currentUser.value) return;
        const trimmed = (email || '').trim().toLowerCase();
        if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
          return showToastMsg('올바른 이메일을 입력하세요.', 'error');
        }
        if (currentUser.value.email && trimmed === currentUser.value.email.toLowerCase()) {
          return showToastMsg('본인 이메일은 추가할 수 없습니다.', 'error');
        }
        try {
          const ref = doc(db, getTreesPath(), currentTreeId.value);
          const existing = await getDoc(ref);
          if (!existing.exists()) {
            // 아직 저장 안 된 새 트리면 먼저 저장
            await saveToCloud(true);
          }
          const refreshed = await getDoc(ref);
          if (!refreshed.exists()) return showToastMsg('먼저 저장해 주세요.', 'error');
          const d = refreshed.data();
          if (d.ownerId !== currentUser.value.uid) return showToastMsg('소유자만 공유할 수 있습니다.', 'error');
          const emails = new Set(d.sharedEmails || []);
          emails.add(trimmed);
          const perms = { ...(d.sharePermissions || {}) };
          perms[trimmed] = { role: role || 'editor', scope: 'full' };
          await updateDoc(ref, { sharedEmails: Array.from(emails), sharePermissions: perms });
          showToastMsg(`🔗 ${trimmed} 님에게 공유되었습니다.`);
        } catch (e) {
          console.error(e);
          showToastMsg('공유 실패', 'error');
        }
      };

      const removeShare = async (email) => {
        if (!currentTreeId.value || !currentUser.value) return;
        const target = (email || '').trim().toLowerCase();
        try {
          const ref = doc(db, getTreesPath(), currentTreeId.value);
          const existing = await getDoc(ref);
          if (!existing.exists()) return;
          const d = existing.data();
          if (d.ownerId !== currentUser.value.uid) return showToastMsg('소유자만 해제할 수 있습니다.', 'error');
          const emails = (d.sharedEmails || []).filter(e => e !== target);
          const perms = { ...(d.sharePermissions || {}) };
          delete perms[target];
          await updateDoc(ref, { sharedEmails: emails, sharePermissions: perms });
          showToastMsg(`🔓 ${target} 공유 해제됨`);
        } catch (e) { console.error(e); showToastMsg('해제 실패', 'error'); }
      };

      const changeShareRole = async (email, role) => {
        if (!currentTreeId.value || !currentUser.value) return;
        const target = (email || '').trim().toLowerCase();
        try {
          const ref = doc(db, getTreesPath(), currentTreeId.value);
          const existing = await getDoc(ref);
          if (!existing.exists()) return;
          const d = existing.data();
          if (d.ownerId !== currentUser.value.uid) return;
          const perms = { ...(d.sharePermissions || {}) };
          perms[target] = { ...(perms[target] || { scope: 'full' }), role };
          await updateDoc(ref, { sharePermissions: perms });
          showToastMsg(`권한 변경: ${target} → ${role === 'editor' ? '편집' : '보기'}`);
        } catch (e) { console.error(e); }
      };

      // ── SubTree Sharing ──
      const shareSubTree = async () => {
        if (!selectedMemberId.value || selectedMemberId.value === 'root') {
          return showToastMsg('서브 트리를 공유하려면 먼저 멤버를 선택하세요.', 'error');
        }
        const trimmedEmail = (subTreeShareInput.email || '').trim().toLowerCase();
        if (!trimmedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
          return showToastMsg('올바른 이메일을 입력하세요.', 'error');
        }
        if (currentUser.value.email && trimmedEmail === currentUser.value.email.toLowerCase()) {
          return showToastMsg('본인 이메일은 추가할 수 없습니다.', 'error');
        }

        try {
          // 선택된 멤버 이하의 서브 트리 수집
          const subRoot = members.value.find(m => m.id === selectedMemberId.value);
          if (!subRoot) return showToastMsg('멤버를 찾을 수 없습니다.', 'error');

          const ids = new Set();
          function collectSubtree(id) {
            ids.add(id);
            members.value.filter(m => m.parentId === id).forEach(m => collectSubtree(m.id));
          }
          collectSubtree(selectedMemberId.value);

          const subMembers = members.value.filter(m => ids.has(m.id)).map(m => 
            m.id === selectedMemberId.value ? { ...m, parentId: null } : { ...m }
          );

          // 서브 트리 데이터 수집
          const subRecruits = subTreeShareInput.includeData ? recruits.value.filter(r => {
            const linkedMember = members.value.find(m => m.recruitId === r.id);
            return linkedMember && ids.has(linkedMember.id);
          }) : [];

          const subAppointments = subTreeShareInput.includeData ? appointments.value.filter(apt => {
            const hasTargetInSubtree = apt.targetName && subMembers.some(m => m.name === apt.targetName);
            const hasAttendeeInSubtree = apt.attendees && apt.attendees.some(name => subMembers.some(m => m.name === name));
            return hasTargetInSubtree || hasAttendeeInSubtree;
          }) : [];

          // 새로운 공유 트리 생성
          const newTreeId = 'shared_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
          const originalRoot = members.value.find(m => !m.parentId);
          const newHeader = {
            ...header,
            id: subRoot.status === 'root' ? header.id : '',
            rank: subRoot.status === 'root' ? header.rank : subRoot.status,
            fd: originalRoot ? originalRoot.name : header.fd,
            sfd: header.fd || header.sfd,
            dd: header.sfd || header.dd,
            efd: header.dd || header.efd
          };

          const sharedTreeData = {
            name: `${subRoot.name} 서브 트리 (공유)`,
            updatedAt: new Date().toLocaleString('ko-KR'),
            updatedAtMs: Date.now(),
            savedByUid: currentUser.value.uid,
            savedByEmail: currentUser.value.email || '',
            memberCount: subMembers.length,
            data: {
              header: newHeader,
              members: JSON.parse(JSON.stringify(subMembers)),
              notes: subTreeShareInput.includeData ? JSON.parse(JSON.stringify(notes.value)) : [],
              recruits: JSON.parse(JSON.stringify(subRecruits)),
              appointments: JSON.parse(JSON.stringify(subAppointments)),
              recruitPosition: recruitPosition.value,
              notesPosition: notesPosition.value,
              memberInfoPosition: memberInfoPosition.value,
              appointmentPosition: appointmentPosition.value,
              nodeWidth: nodeWidth.value,
              nodeBaseHeight: nodeBaseHeight.value,
              nodeFontSize: nodeFontSize.value,
              nodeLineGap: nodeLineGap.value,
              notePanelWidth: notePanelWidth.value,
              legendConfig: JSON.parse(JSON.stringify(legendConfig.value))
            },
            ownerId: currentUser.value.uid,
            ownerEmail: currentUser.value.email || '',
            sharedEmails: [trimmedEmail],
            sharePermissions: {
              [trimmedEmail]: { role: subTreeShareInput.role || 'editor', scope: 'subtree' }
            },
            isSubTree: true,
            parentTreeId: currentTreeId.value,
            subTreeRootMemberId: selectedMemberId.value,
            subTreeRootMemberName: subRoot.name
          };

          const ref = doc(db, getTreesPath(), newTreeId);
          await setDoc(ref, sharedTreeData);

          showToastMsg(`🔗 ${subRoot.name} 서브 트리가 ${trimmedEmail}님에게 공유되었습니다!`);
          showSubTreeShareModal.value = false;
          subTreeShareInput.email = '';
          subTreeShareInput.role = 'editor';
          subTreeShareInput.includeData = true;
        } catch (e) {
          console.error(e);
          showToastMsg('서브 트리 공유 실패', 'error');
        }
      };

      const openSubTreeShareModal = () => {
        if (!selectedMemberId.value || selectedMemberId.value === 'root') {
          return showToastMsg('서브 트리를 공유하려면 먼저 root가 아닌 멤버를 선택하세요.', 'error');
        }
        showSubTreeShareModal.value = true;
      };

      // ── Permission computeds ──
      const currentIsOwner = computed(() => {
        const m = currentTreeMeta.value;
        return !!(m && currentUser.value && m.ownerId === currentUser.value.uid);
      });
      const currentIsEditor = computed(() => {
        if (currentIsOwner.value) return true;
        const m = currentTreeMeta.value;
        if (!m || !currentUser.value) return false;
        const key = (currentUser.value.email || '').toLowerCase();
        const p = (m.sharePermissions || {})[key] || (m.sharePermissions || {})[currentUser.value.email];
        return !!(p && p.role === 'editor');
      });
      const currentIsReadOnly = computed(() => {
        return !!currentTreeId.value && !currentIsEditor.value;
      });

      // ── Computed ──
      const availableStatuses = computed(() => STATUSES.filter(s => legendConfig.value.items[s] && legendConfig.value.items[s].show));
      const PAGE_W_PX = computed(() => printLandscape.value ? 979 : 739);
      const PAGE_H_PX = computed(() => printLandscape.value ? 700 : 979);
      const previewScale = computed(() => Math.min((window.innerWidth-80)/PAGE_W_PX.value, (window.innerHeight-100)/PAGE_H_PX.value, 1));
      const previewPageStyle = computed(() => ({ width:PAGE_W_PX.value*previewScale.value+'px', height:PAGE_H_PX.value*previewScale.value+'px', overflow:'hidden' }));
      const previewFrameStyle = computed(() => ({ width:PAGE_W_PX.value+'px', height:PAGE_H_PX.value+'px', transform:`scale(${previewScale.value})`, transformOrigin:'0 0' }));
      
      const panTransform = computed(() => `translate(${panX.value}px,${panY.value}px)`);
      
      const recruitsSortedAll = computed(() => [...recruits.value].sort((a,b)=>(b.score||0)-(a.score||0)));
      const visibleRecruits = computed(() => recruitsSortedAll.value.filter(r=>r.show));
      const focusedList = computed(() => {
        if (!focusRootId.value) return members.value;
        const ids = new Set();
        function col(id){ ids.add(id); members.value.filter(m=>m.parentId===id).forEach(m=>col(m.id)); }
        col(focusRootId.value);
        return members.value.filter(m=>ids.has(m.id)).map(m=>m.id===focusRootId.value ? {...m,parentId:null} : m);
      });
      const rootMember = computed(() => focusedList.value.find(m=>!m.parentId));
      const rootMemberName = computed(() => rootMember.value ? rootMember.value.name : '');
      const rootMemberEmail = computed(() => rootMember.value ? (rootMember.value.email || '') : '');
      const currentMembers = computed(() => focusRootId.value ? focusedList.value : members.value);
      
      const selectedMember = computed(() => members.value.find(m => m.id === selectedMemberId.value));

      const memberNames = computed(() => members.value.map(m => m.name));
      const recruitNames = computed(() => recruits.value.map(r => r.name));

      const uplineMemberNames = computed(() => {
          const names = [header.fd, header.sfd, header.dd, header.efd].map(n => (n || '').trim()).filter(Boolean);
          return [...new Set(names)].filter(n => !memberNames.value.includes(n));
      });

      const apptMemberNames = computed(() => {
          return [...new Set([...memberNames.value, ...uplineMemberNames.value])];
      });

      const allPersonNames = computed(() => {
          return [...new Set([...apptMemberNames.value, ...recruitNames.value])];
      });

      const upcomingAppointments = computed(() => {
          const today = new Date();
          today.setHours(0,0,0,0);
          return appointments.value.filter(a => {
              const d = new Date(a.date.replace(/[-./]/g, '/'));
              return d >= today;
          }).sort((a,b) => new Date(a.date.replace(/[-./]/g, '/')) - new Date(b.date.replace(/[-./]/g, '/')));
      });

      const teamTotal = computed(() => {
        const l = focusedList.value;
        const paid = l.reduce((s,m)=>s+getMemberIssuePaid(m), 0);
        const pend = l.reduce((s,m)=>s+getMemberPending(m), 0);
        return { paid, pending:pend, total:paid+pend };
      });
      const statusCounts = computed(() => {
        const c = {};
        STATUSES.forEach(s => c[s] = 0);
        focusedList.value.forEach(m=>{ if(c[m.status]!==undefined) c[m.status]++; });
        return c;
      });
      const layout = computed(() => {
        const NW = nodeWidth.value, list = focusedList.value;
        const rootNode = list.find(m=>!m.parentId);
        if (!rootNode) return { totalWidth:800, totalHeight:600, edges:[], membersWithPos:[] };
        const ch = {}; list.forEach(m=>ch[m.id]=[]);
        list.forEach(m=>{ if(m.parentId&&ch[m.parentId]) ch[m.parentId].push(m.id); });
        const span = {};
        function computeSpan(id){ const kids=ch[id]||[]; if(!kids.length){span[id]=NW;return NW;} const w=kids.reduce((s,c)=>s+computeSpan(c)+HG,-HG); span[id]=Math.max(NW,w); return span[id]; }
        computeSpan(rootNode.id);
        const rowMaxH = {};
        function measureRows(id,depth){ rowMaxH[depth]=Math.max(rowMaxH[depth]||0,nodeH(list.find(m=>m.id===id)||{})); (ch[id]||[]).forEach(cid=>measureRows(cid,depth+1)); }
        measureRows(rootNode.id,0);
        const rowY=[PAD_Y];
        const maxDepth=Math.max(...Object.keys(rowMaxH).map(Number))+1;
        for(let d=1;d<maxDepth;d++) rowY[d]=rowY[d-1]+(rowMaxH[d-1]||50)+VG;
        const pos={};
        function place(id,centerX,depth){ const nh=nodeH(list.find(m=>m.id===id)||{}); pos[id]={x:centerX,y:rowY[depth]+nh/2,depth}; const children=ch[id]||[]; if(!children.length)return; const totalChildSpan=children.reduce((s,cid)=>s+span[cid],0)+HG*(children.length-1); let cx=centerX-totalChildSpan/2; children.forEach(cid=>{place(cid,cx+span[cid]/2,depth+1);cx+=span[cid]+HG;}); }
        place(rootNode.id,0,0);
        const allX=Object.values(pos).map(p=>p.x);
        const allY=Object.values(pos).map(p=>p.y);
        const minX=Math.min(...allX)-NW/2, maxX=Math.max(...allX)+NW/2;
        const maxNH=Math.max(...list.map(m=>nodeH(m)));
        const maxY=Math.max(...allY)+maxNH/2;
        const PAD_X=30, offsetX=-minX+PAD_X;
        const finalPos={};
        Object.keys(pos).forEach(id=>{finalPos[id]={x:pos[id].x+offsetX,y:pos[id].y};});
        const edges=list.map(m=>{
          if(!m.parentId||!finalPos[m.id]||!finalPos[m.parentId]) return null;
          const pH=nodeH(list.find(x=>x.id===m.parentId)||{}), cH=nodeH(m);
          return {id:m.id,status:m.status,x1:finalPos[m.parentId].x,y1:finalPos[m.parentId].y+pH/2,x2:finalPos[m.id].x,y2:finalPos[m.id].y-cH/2};
        }).filter(Boolean);
        return { edges, membersWithPos:list.map(m=>({...m,pos:finalPos[m.id]||{x:0,y:0}})), totalWidth:maxX-minX+PAD_X*2, totalHeight:maxY+PAD_Y };
      });

      watch(focusRootId, (newVal) => {
          if(newVal) { selectedMemberId.value = newVal; } 
          else { const r = members.value.find(m => !m.parentId); if(r) selectedMemberId.value = r.id; }
      });

      // --- Two-way Data Sync (Members <-> Recruits) ---
      let syncLock = false;
      watch(() => recruits.value, (newVals) => {
          if(syncLock) return;
          syncLock = true;
          newVals.forEach(r => {
              const m = members.value.find(x => x.recruitId === r.id);
              if(m) {
                  if(m.name !== r.name) m.name = r.name;
                  if(m.major !== r.major) m.major = r.major;
                  if(m.job !== r.job) m.job = r.job;
                  if(m.company !== r.company) m.company = r.company;
                  if(m.relation !== r.relation) m.relation = r.relation;
                  if(m.meetDate !== r.meetDate) m.meetDate = r.meetDate;
                  if(m.birthDate !== r.birthDate) m.birthDate = r.birthDate;
                  if(m.age !== r.age) m.age = r.age;
                  if(m.gender !== r.gender) m.gender = r.gender;
                  if(m.score !== r.score) m.score = r.score;
                  
                  if (!m.disposition) m.disposition = defaultDisposition();
                  if (!r.disposition) r.disposition = defaultDisposition();
                  const dispKeys = ['relationScore', 'market', 'married', 'child', 'house', 'income', 'ambition', 'dissatisfied', 'pma', 'entrepreneur'];
                  dispKeys.forEach(k => {
                      if(m.disposition[k] !== r.disposition[k]) m.disposition[k] = r.disposition[k];
                  });
              }
          });
          setTimeout(() => { syncLock = false; }, 100);
      }, { deep: true });

      watch(() => members.value, (newVals) => {
          if(syncLock) return;
          syncLock = true;
          newVals.forEach(m => {
              const isPotentialOrSerious = ['Potential', 'Serious'].includes(m.status);

              if (isPotentialOrSerious && !m.recruitId) {
                  const existingRecruit = recruits.value.find(r => r.name === m.name);
                  if (existingRecruit) {
                      m.recruitId = existingRecruit.id;
                      existingRecruit.score = m.score || (m.status === 'Serious' ? 75 : 60);
                  } else {
                      const newRId = 'r' + Date.now() + Math.random().toString(36).substring(2,7);
                      m.recruitId = newRId;
                      recruits.value.push({
                          id: newRId,
                          name: m.name,
                          major: m.major || '',
                          job: m.job || '',
                          company: m.company || '',
                          relation: m.relation || '',
                          meetDate: m.meetDate || '',
                          period: '',
                          gender: m.gender || '남',
                          score: m.score || (m.status === 'Serious' ? 75 : 60),
                          birthDate: m.birthDate || '',
                          age: m.age || '',
                          show: true,
                          interactionHistory: [...(m.interactionHistory || [])],
                          disposition: m.disposition ? JSON.parse(JSON.stringify(m.disposition)) : defaultDisposition()
                      });
                  }
              } else if (!isPotentialOrSerious && m.recruitId) {
                  recruits.value = recruits.value.filter(r => r.id !== m.recruitId);
                  m.recruitId = null;
              }

              if(m.recruitId) {
                  const r = recruits.value.find(x => x.id === m.recruitId);
                  if(r) {
                      if(r.name !== m.name) r.name = m.name;
                      if(r.major !== m.major) r.major = m.major;
                      if(r.job !== m.job) r.job = m.job;
                      if(r.company !== m.company) r.company = m.company;
                      if(r.relation !== m.relation) r.relation = m.relation;
                      if(r.meetDate !== m.meetDate) r.meetDate = m.meetDate;
                      if(r.birthDate !== m.birthDate) r.birthDate = m.birthDate;
                      if(r.age !== m.age) r.age = m.age;
                      if(r.gender !== m.gender) r.gender = m.gender;
                      if(r.score !== m.score) r.score = m.score;
                      
                      if (!m.disposition) m.disposition = defaultDisposition();
                      if (!r.disposition) r.disposition = defaultDisposition();
                      const dispKeys = ['relationScore', 'market', 'married', 'child', 'house', 'income', 'ambition', 'dissatisfied', 'pma', 'entrepreneur'];
                      dispKeys.forEach(k => {
                          if(r.disposition[k] !== m.disposition[k]) r.disposition[k] = m.disposition[k];
                      });
                  }
              }
          });
          setTimeout(() => { syncLock = false; }, 100);
      }, { deep: true });
      // ------------------------------------------------

      // ── Helpers ──
      function showToastMsg(msg,type='success'){ if(toastTimer)clearTimeout(toastTimer); toast.msg=msg; toast.type=type; toast.visible=true; toastTimer=setTimeout(()=>toast.visible=false,2200); }
      function getToastClass(){ return [toast.type, toast.visible?'':'hidden']; }
      function getSaveStatusClass(){ return isDirty.value?'unsaved':'saved'; }
      function getSaveStatusText(){ return isDirty.value?'저장 안 됨':'자동저장 완료'; }
      function fmt(n){ return Number(n||0).toLocaleString(); }
      function fmtS(n){ if(!n&&n!==0) return '-'; return Number(n).toLocaleString(); }

      function parseDateForSort(dStr){
        if(!dStr) return 0;
        let d = dStr.trim();
        if(d.length === 4 && !isNaN(d)) d += '/01/01';
        
        const parts=d.split(/[-/]/); if(parts.length<2) return 0;
        let m=parseInt(parts[0],10), day=parseInt(parts[1],10), y=parts.length>2?parseInt(parts[2],10):new Date().getFullYear();
        if(y<100) y+=2000;
        return new Date(y,m-1,day).getTime();
      }

      function sortedPointHistory(m) {
          if(!m || !m.history) return [];
          return [...m.history].sort((a,b) => parseDateForSort(b.date) - parseDateForSort(a.date));
      }
      function sortedInteractionHistory(m) {
          if(!m || !m.interactionHistory) return [];
          return [...m.interactionHistory].sort((a,b) => parseDateForSort(b.date) - parseDateForSort(a.date));
      }

      function calcAge(birthDateStr){
        if(!birthDateStr) return '';
        let dStr = birthDateStr.trim();
        if(dStr.length === 4 && !isNaN(dStr)) dStr += '-01-01'; 

        const b=new Date(dStr.replace(/[./]/g,'-')); if(isNaN(b.getTime())) return '';
        const today=new Date(); let age=today.getFullYear()-b.getFullYear();
        const mo=today.getMonth()-b.getMonth(); if(mo<0||(mo===0&&today.getDate()<b.getDate())) age--;
        return age>=0?age:0;
      }
      
      function calcPeriod(dateStr,legacyPeriod){
        if(!dateStr) return legacyPeriod||'';
        let dStr = dateStr.trim();
        if(dStr.length === 4 && !isNaN(dStr)) dStr += '-01'; 

        const p=dStr.split(/[-./]/); if(p.length<1) return legacyPeriod||'';
        const start=new Date(parseInt(p[0],10), p.length >= 2 ? parseInt(p[1],10)-1 : 0);
        if(isNaN(start.getTime())) return legacyPeriod||'';

        const now=new Date(); let mDiff=(now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth());
        if(mDiff<0) return '미래'; if(mDiff===0) return '1개월 미만';
        const y=Math.floor(mDiff/12), mo=mDiff%12;
        return (y>0&&mo>0)?`${y}년 ${mo}개월`:(y>0?`${y}년`:`${mo}개월`);
      }

      function getMemberIssuePaid(m){
        if(!m.history) return 0;
        return m.history.filter(h=>h.show&&h.type==='Issue Paid').reduce((s,h)=>s+(Number(h.amount)||0),0);
      }
      function getMemberPending(m){
        if(!m.history) return 0;
        return m.history.filter(h=>h.show&&h.type==='Pending').reduce((s,h)=>s+(Number(h.amount)||0),0);
      }
      function mPtsSum(m){
        if(!m.history) return 0;
        return m.history.filter(h=>h.show).reduce((s,h)=>s+(Number(h.point)||0),0);
      }

      function updateRootMemberName(e){ if(rootMember.value) rootMember.value.name=e.target.value; }
      function updateRootMemberEmail(e){ if(rootMember.value) rootMember.value.email=e.target.value; }
      function setRootEmailToLoginIfEmpty() {
          if (!rootMember.value) return;
          const loginEmail = currentUser.value && currentUser.value.email;
          if (!loginEmail) return;
          // 항상 로그인 이메일로 업데이트 (example@gmail.com 이거나 비어있으면)
          if (!rootMember.value.email || !String(rootMember.value.email).trim() || rootMember.value.email === 'example@gmail.com') {
              rootMember.value.email = loginEmail;
          }
      }
      function setFocus(id){ focusRootId.value=id; zoomLevel.value=1; nextTick(centerTree); }
      function clearFocus(){ focusRootId.value=null; zoomLevel.value=1; nextTick(centerTree); }
      function toggleFocus(id){ if(focusRootId.value===id) clearFocus(); else setFocus(id); }

      function nodeNoteLines(m){
        if(!m.history) return [];
        return m.history.filter(h=>h.show)
          .sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date))
          .reduce((acc, h) => {
            let val = h.content || '';
            acc.push({ text: h.date ? `[${h.date}] ${val}` : val, isExtra: false });
            
            let extras=[];
            if(Number(h.amount)) extras.push(`$${fmt(h.amount)}`);
            if(Number(h.point)) extras.push(`${fmt(h.point)} Pts`);
            if(extras.length) {
              acc.push({ text: extras.join(' | '), isExtra: true });
            }
            return acc;
          }, []).slice(0,5); 
      }
      function nodeH(m){ 
        const base = Math.max(nodeBaseHeight.value, nodeFontSize.value + 14 + nodeLineGap.value * 2 + 10);
        const notesCount = nodeNoteLines(m).length;
        if(notesCount === 0) return base;
        return (nodeFontSize.value + 14 + nodeLineGap.value * 2 + 6) + 8 + (notesCount * nodeLineGap.value) + 6; 
      }

      function getRawMemberTotal(m) {
        return getMemberIssuePaid(m) + getMemberPending(m);
      }
      function getMemberTotal(m) {
        return fmt(getRawMemberTotal(m));
      }
      function getIncomePercent(m) {
        const mTotal = getRawMemberTotal(m);
        const tTotal = teamTotal.value.total;
        if (tTotal === 0 || mTotal === 0) return 0;
        return Math.min(100, Math.max(0, (mTotal / tTotal) * 100));
      }

      function fmtApptDateShort(dStr){
        if(!dStr) return '';
        const parts = String(dStr).split(/[-./]/).map(s => s.trim()).filter(Boolean);
        if (parts.length < 2) return dStr;
        let m, d;
        if (parts[0].length === 4) { 
          m = parseInt(parts[1], 10);
          d = parseInt(parts[2] || '1', 10);
        } else { 
          m = parseInt(parts[0], 10);
          d = parseInt(parts[1], 10);
        }
        if (isNaN(m) || isNaN(d)) return dStr;
        return `${m}/${d}`;
      }

      function getPointHistPct(m, h){
        if (!m || !h || !m.history) return 0;
        const visible = m.history.filter(x => x.show);
        const hasAmount = Number(h.amount) > 0;
        const hasPoint = Number(h.point) > 0;
        if (hasAmount) {
          const tot = visible.reduce((s,x) => s + (Number(x.amount) || 0), 0);
          if (tot > 0) return Math.min(100, (Number(h.amount) / tot) * 100);
        }
        if (hasPoint) {
          const tot = visible.reduce((s,x) => s + (Number(x.point) || 0), 0);
          if (tot > 0) return Math.min(100, (Number(h.point) / tot) * 100);
        }
        return 0;
      }

      function calcDisposition(item, isRecruit) {
          if (!item.disposition) return;
          let total = 0;
          total += parseInt(item.disposition.relationScore) || 0;
          if (item.disposition.market === 'L') total += 10;
          else if (item.disposition.market === 'M') total += 8;
          else if (item.disposition.market === 'S') total += 6;

          const checks = ['married', 'child', 'house', 'income', 'ambition', 'dissatisfied', 'pma', 'entrepreneur'];
          checks.forEach(k => {
              if (item.disposition[k]) total += 10;
          });

          item.score = Math.min(100, Math.max(0, total));
          onScoreChange(item, isRecruit);
      }

      // ── Fixed Zoom/Pan ──
      function zoomIn(){ zoomLevel.value=Math.min(3,+(zoomLevel.value+0.15).toFixed(2)); }
      function zoomOut(){ zoomLevel.value=Math.max(0.2,+(zoomLevel.value-0.15).toFixed(2)); }
      function zoomReset(){ zoomLevel.value=1; centerTree(); }
      function onWheel(e){ zoomLevel.value=Math.min(3,Math.max(0.2,+(zoomLevel.value+(e.deltaY>0?-0.1:0.1)).toFixed(2))); }
      function onPanStart(e){ if(e.button!==0)return; isPanning=true; panStartX=e.clientX; panStartY=e.clientY; panStartPX=panX.value; panStartPY=panY.value; e.currentTarget.classList.add('panning'); }
      function onPanMove(e){ 
        if(!isPanning)return; 
        panX.value = panStartPX + (e.clientX - panStartX);
        panY.value = panStartPY + (e.clientY - panStartY);
      }
      function onPanEnd(e){ isPanning=false; if(e.currentTarget) e.currentTarget.classList.remove('panning'); }
      function centerTree(){ 
        nextTick(()=>{ 
            const wrap=document.getElementById('tree-svg-container'); 
            if(!wrap)return; 
            const svgW = layout.value.totalWidth * zoomLevel.value;
            const svgH = layout.value.totalHeight * zoomLevel.value;
            panX.value = Math.max(16,(wrap.clientWidth-svgW)/2); 
            panY.value = Math.max(16,(wrap.clientHeight-svgH)/2); 
        }); 
      }

      // Member CRUD
      function addMember(){
        if(!nm.name.trim()) return;
        const newId = 'm'+Date.now();
        members.value.push({
          id:newId, recruitId: null, name:nm.name.trim(), email:(nm.email||'').trim(), major:nm.major.trim(), job:nm.job.trim(), company:nm.company.trim(), status:nm.status, parentId:nm.parentId,
          history:[], interactionHistory:[], issuePaid:0, pending:0,
          birthDate:nm.birthDate, age:nm.age, meetDate:nm.meetDate, relation:nm.relation, gender:nm.gender, score:nm.score, disposition: defaultDisposition()
        });
        nm.name=''; nm.email=''; nm.major=''; nm.job=''; nm.company=''; nm.birthDate=''; nm.age=''; nm.meetDate=''; nm.relation=''; nm.gender='남'; nm.score=0;
        showToastMsg(`✅ 멤버가 추가되었습니다.`);
      }
      function removeMember(id){
        if(focusRootId.value===id) clearFocus();
        const m=members.value.find(x=>x.id===id); if(!m||!m.parentId)return;
        members.value.forEach(x=>{ if(x.parentId===id) x.parentId=m.parentId; });
        members.value=members.value.filter(x=>x.id!==id);
        if(selectedMemberId.value===id) selectedMemberId.value='root';
        if(expandedMemberId.value===id) expandedMemberId.value=null;
        if(expandedInteractionId.value===id) expandedInteractionId.value=null;
        if(expandedDispositionId.value===id) expandedDispositionId.value=null;
      }
      function parentOpts(ex){
        const excludeIds=new Set([ex]);
        const chMap={}; members.value.forEach(m=>chMap[m.id]=[]);
        members.value.forEach(m=>{ if(m.parentId&&chMap[m.parentId]) chMap[m.parentId].push(m.id); });
        function getDesc(id){ (chMap[id]||[]).forEach(cid=>{excludeIds.add(cid);getDesc(cid);}); }
        getDesc(ex);
        return members.value.filter(m=>!excludeIds.has(m.id));
      }
      
      // History Managements
      function toggleHistoryPanel(id){ expandedMemberId.value = expandedMemberId.value===id ? null : id; newHist.date=''; newHist.content=''; newHist.point=null; newHist.amount=null; newHist.type='History'; }
      function toggleInteractionPanel(id){ 
          expandedDispositionId.value = null;
          expandedInteractionId.value = expandedInteractionId.value===id ? null : id; 
          newInteraction.date=''; newInteraction.content=''; 
      }
      function toggleDispositionPanel(id){
          expandedInteractionId.value = null;
          expandedDispositionId.value = expandedDispositionId.value===id ? null : id;
      }
      function toggleRecruitInteractionPanel(id){ 
          expandedRecruitDispositionId.value = null;
          expandedRecruitInteractionId.value = expandedRecruitInteractionId.value===id ? null : id; 
          newRecruitInteraction.date=''; newRecruitInteraction.content=''; 
      }
      function toggleRecruitDispositionPanel(id){
          expandedRecruitInteractionId.value = null;
          expandedRecruitDispositionId.value = expandedRecruitDispositionId.value===id ? null : id;
      }

      function addHistoryItem(memberId){
        if(!newHist.content.trim()&&!newHist.point&&!newHist.amount) return;
        const m=members.value.find(x=>x.id===memberId); if(!m)return;
        if(!m.history) m.history=[];
        const today=new Date();
        const d=`${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        m.history.push({
          id:'h'+Date.now(),
          date:newHist.date||d,
          type:newHist.type,
          content:newHist.content.trim(),
          point:Number(newHist.point)||0,
          amount:['Issue Paid','Pending'].includes(newHist.type)?(Number(newHist.amount)||0):0,
          show:true
        });
        m.history = [...m.history]; 
        newHist.date=''; newHist.content=''; newHist.point=null; newHist.amount=null;
      }
      function removeHistoryItem(memberId,histId){ const m=members.value.find(x=>x.id===memberId); if(m) m.history=m.history.filter(h=>h.id!==histId); }

      function addInteractionItem(memberId) {
        if(!newInteraction.content.trim()) return;
        const m=members.value.find(x=>x.id===memberId); if(!m)return;
        if(!m.interactionHistory) m.interactionHistory=[];
        const today=new Date();
        const d=`${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        m.interactionHistory.push({
            id: 'ih' + Date.now(),
            date: newInteraction.date || d,
            content: newInteraction.content.trim()
        });
        m.interactionHistory = [...m.interactionHistory];

        if(m.recruitId) {
            const r = recruits.value.find(x => x.id === m.recruitId);
            if(r) r.interactionHistory = [...m.interactionHistory];
        }
        newInteraction.date = ''; newInteraction.content = '';
      }
      function removeInteractionItem(memberId, histId) {
        const m=members.value.find(x=>x.id===memberId); 
        if(m) {
            m.interactionHistory=m.interactionHistory.filter(h=>h.id!==histId);
            if(m.recruitId) {
                const r = recruits.value.find(x => x.id === m.recruitId);
                if(r) r.interactionHistory = r.interactionHistory.filter(h=>h.id!==histId);
            }
        }
      }
      
      // Recruit explicit interaction
      function addRecruitInteractionItem(recruitId) {
        if(!newRecruitInteraction.content.trim()) return;
        const r=recruits.value.find(x=>x.id===recruitId); if(!r)return;
        if(!r.interactionHistory) r.interactionHistory=[];
        const today=new Date();
        const d=`${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        r.interactionHistory.push({
            id: 'ih' + Date.now(),
            date: newRecruitInteraction.date || d,
            content: newRecruitInteraction.content.trim()
        });
        r.interactionHistory = [...r.interactionHistory];

        const m=members.value.find(x=>x.recruitId===recruitId);
        if(m) m.interactionHistory = [...r.interactionHistory];
        newRecruitInteraction.date = ''; newRecruitInteraction.content = '';
      }
      function removeRecruitInteractionItem(recruitId, histId) {
        const r=recruits.value.find(x=>x.id===recruitId); 
        if(r) {
            r.interactionHistory=r.interactionHistory.filter(h=>h.id!==histId);
            const m = members.value.find(x => x.recruitId === recruitId);
            if(m) m.interactionHistory = m.interactionHistory.filter(h=>h.id!==histId);
        }
      }
      function onRecruitInteractionChange(r) {
        r.interactionHistory = [...r.interactionHistory];
        const m = members.value.find(x => x.recruitId === r.id);
        if(m) m.interactionHistory = [...r.interactionHistory];
      }
      function onMemberInteractionChange(m) {
        m.interactionHistory = [...m.interactionHistory];
        if(m.recruitId) {
            const r = recruits.value.find(x => x.id === m.recruitId);
            if(r) r.interactionHistory = [...m.interactionHistory];
        }
      }

      function onScoreChange(item, isRecruit = true) {
          // 자동 이관 로직 제거 - 수동으로만 멤버 승급 가능
      }

      // Recruit CRUD -> Manual Promotion
      function promoteRecruit(r) {
        const existingMemberIndex = members.value.findIndex(m => m.recruitId === r.id);
        const today = new Date();
        const d = `${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        
        let targetMemberId = null;

        if (existingMemberIndex !== -1) {
            members.value[existingMemberIndex].recruitId = null; 
            members.value[existingMemberIndex].status = 'New(Code-in)'; 
            members.value[existingMemberIndex].interactionHistory.push({ id: 'ih' + Date.now(), date: d, content: '정식 멤버로 승급됨' });
            targetMemberId = members.value[existingMemberIndex].id;
        } else {
            const pId = focusRootId.value || (members.value.find(m => !m.parentId)?.id) || null;
            if(!pId) { showToastMsg('상위 멤버가 없습니다.', 'error'); return; }

            targetMemberId = 'm' + Date.now();
            const mappedInteractions = (r.interactionHistory || []).map(h => ({
                id: 'ih' + Date.now() + Math.random(),
                date: h.date,
                content: h.content
            }));
            mappedInteractions.push({ id: 'ih' + Date.now(), date: d, content: 'Recruit 리스트에서 정식 멤버로 승급됨' });

            members.value.push({
                id: targetMemberId, recruitId: null, name: r.name, email: r.email || '', major: r.major || '', job: r.job || '', company: r.company || '', status: 'New(Code-in)', parentId: pId,
                history: [], interactionHistory: mappedInteractions,
                issuePaid: 0, pending: 0,
                birthDate: r.birthDate || '', age: r.age || '', meetDate: r.meetDate || '', relation: r.relation || '', gender: r.gender || '남', score: r.score,
                disposition: r.disposition ? JSON.parse(JSON.stringify(r.disposition)) : defaultDisposition()
            });
        }

        recruits.value = recruits.value.filter(x => x.id !== r.id);
        showToastMsg(`🎉 ${r.name}님이 정식 멤버로 승급되었습니다!`);
        
        selectedMemberId.value = targetMemberId;
        if(memberInfoPosition.value === 'none') memberInfoPosition.value = 'right';
        if(tab.value !== 'members' && tab.value !== 'memberInfo') tab.value = 'memberInfo';
      }

      function addRecruit(){
        if(!newRecruit.name.trim()) return;
        const newR={id:'r'+Date.now(),name:newRecruit.name.trim(),email:(newRecruit.email||'').trim(),major:newRecruit.major.trim(),job:newRecruit.job.trim(),company:newRecruit.company.trim(),relation:newRecruit.relation.trim(),meetDate:newRecruit.meetDate,period:'',gender:newRecruit.gender,score:newRecruit.score||0,birthDate:newRecruit.birthDate,age:newRecruit.age,show:true,interactionHistory:[], disposition: defaultDisposition()};
        recruits.value.push(newR);
        newRecruit.name=''; newRecruit.email=''; newRecruit.major=''; newRecruit.job=''; newRecruit.company=''; newRecruit.relation=''; newRecruit.meetDate=''; newRecruit.gender='남'; newRecruit.score=50; newRecruit.birthDate=''; newRecruit.age='';
      }
      function removeRecruit(id){ recruits.value=recruits.value.filter(r=>r.id!==id); }
      function addNote(){ if(!newNote.value.trim())return; notes.value.push({text:newNote.value.trim()}); newNote.value=''; }
      
      // Appointment Methods
      function getPersonTitle(name) {
          if (!name) return '';
          const n = String(name).trim();
          if (!n) return '';
          if ((header.fd || '').trim() === n) return 'FD';
          if ((header.sfd || '').trim() === n) return 'SFD';
          if ((header.dd || '').trim() === n) return 'DD';
          if ((header.efd || '').trim() === n) return 'EFD';
          const m = members.value.find(x => x.name === n);
          if (m) {
              if (m.status === 'root') return '본인';
              return m.status || '';
          }
          return '';
      }

      function apptPeopleList(apt) {
          const main = (apt && apt.title || '').trim();
          const attendees = ((apt && apt.attendees) || [])
              .map(n => (n || '').trim())
              .filter(n => n && n !== main);
          const seen = new Set();
          const out = [];
          if (main) { out.push(main); seen.add(main); }
          attendees.forEach(n => { if (!seen.has(n)) { out.push(n); seen.add(n); } });
          return out;
      }

      function handleTargetNameChange() {
          const name = newAppt.targetName.trim();
          if (!name) return;
          let exists = members.value.some(m => m.name === name) || recruits.value.some(r => r.name === name);
          if (!exists) {
              const newR = { id:'r'+Date.now(), name:name, major:'', job:'', company:'', relation:'', meetDate:'', period:'', gender:'남', score:50, birthDate:'', age:'', show:true, interactionHistory:[], disposition: defaultDisposition() };
              recruits.value.push(newR);
              showToastMsg(`[${name}]님이 Recruit 리스트에 자동 추가되었습니다.`);
          }
      }

      function addAppointment() {
          if(!newAppt.date || !newAppt.title) {
              return showToastMsg('날짜와 내용은 필수 항목입니다.', 'error');
          }

          if ((newAppt.type || '이벤트') === '약속') {
              newAppt.targetName = (newAppt.title || '').trim();
          }

          if(!newAppt.targetName && newAppt.attendees.length === 0) {
              return showToastMsg('참석할 멤버나 만날 대상자를 최소 한 명 이상 지정해주세요.', 'error');
          }

          if(newAppt.targetName) {
            let exists = members.value.some(m => m.name === newAppt.targetName) || recruits.value.some(r => r.name === newAppt.targetName);
            if(!exists) {
                const newR = { id:'r'+Date.now(), name:newAppt.targetName, major:'', job:'', company:'', relation:'', meetDate:'', period:'', gender:'남', score:50, birthDate:'', age:'', show:true, interactionHistory:[], disposition: defaultDisposition() };
                recruits.value.push(newR);
                showToastMsg(`[${newAppt.targetName}]님이 Recruit 리스트에 자동 추가되었습니다.`);
            }
          }

          if (editingApptId.value) {
              const idx = appointments.value.findIndex(a => a.id === editingApptId.value);
              if (idx !== -1) {
                  appointments.value[idx].date = newAppt.date;
                  appointments.value[idx].time = newAppt.time || '';
                  appointments.value[idx].endTime = newAppt.endTime || '';
                  appointments.value[idx].location = newAppt.location || '';
                  appointments.value[idx].type = newAppt.type || '이벤트';
                  appointments.value[idx].title = newAppt.title;
                  appointments.value[idx].description = newAppt.description || '';
                  appointments.value[idx].targetName = newAppt.targetName;
                  appointments.value[idx].attendees = [...newAppt.attendees];
                  showToastMsg('약속이 성공적으로 수정되었습니다.');
              }
              editingApptId.value = null;
          } else {
              appointments.value.push({
                  id: 'apt'+Date.now(),
                  date: newAppt.date,
                  time: newAppt.time || '',
                  endTime: newAppt.endTime || '',
                  location: newAppt.location || '',
                  type: newAppt.type || '이벤트',
                  title: newAppt.title,
                  description: newAppt.description || '',
                  targetName: newAppt.targetName,
                  attendees: [...newAppt.attendees]
              });
              showToastMsg(`새로운 ${newAppt.type || '이벤트'}가 등록되었습니다.`);
          }

          newAppt.date = ''; newAppt.time = ''; newAppt.endTime = ''; newAppt.location = ''; newAppt.type = '이벤트'; newAppt.title = ''; newAppt.description = ''; newAppt.targetName = ''; newAppt.attendees = []; newAppt.newAttendeeInput = '';
      }

      function removeAppointment(id) {
          if (!confirm('이 약속/이벤트를 삭제하시겠습니까?')) return;
          appointments.value = appointments.value.filter(a => a.id !== id);
          showToastMsg('약속이 삭제되었습니다.');
      }

      function completeAppointment(apt) {
          const aptDate = new Date(apt.date.replace(/[-./]/g, '/'));
          const histDate = `${String(aptDate.getMonth()+1).padStart(2,'0')}/${String(aptDate.getDate()).padStart(2,'0')}/${String(aptDate.getFullYear()).slice(2)}`;
          const typeLabel = apt.type || '약속/행사';
          let extraBits = [];
          if(apt.time) {
              extraBits.push(apt.endTime ? apt.time + '~' + apt.endTime : apt.time);
          }
          if(apt.location) extraBits.push('@'+apt.location);
          const extraStr = extraBits.length ? ' ('+extraBits.join(' ')+')' : '';
          const descStr = apt.description ? ' — ' + apt.description : '';
          const content = `[${typeLabel}] ${apt.title}${extraStr}${descStr}`;
          
          if(apt.targetName) {
              addHistoryToPerson(apt.targetName, histDate, content);
          }
          apt.attendees.forEach(attName => {
              addHistoryToPerson(attName, histDate, content);
          });
          
          appointments.value = appointments.value.filter(a => a.id !== apt.id);
          showToastMsg('✅ 완료 처리되어 참석자 히스토리에 기록되었습니다.');
      }

      function editAppointment(apt) {
          editingApptId.value = apt.id;
          newAppt.date = apt.date;
          newAppt.time = apt.time || '';
          newAppt.endTime = apt.endTime || '';
          newAppt.location = apt.location || '';
          newAppt.type = apt.type || '이벤트';
          newAppt.title = apt.title;
          newAppt.description = apt.description || '';
          newAppt.targetName = apt.targetName || '';
          newAppt.attendees = [...(apt.attendees || [])];
          newAppt.newAttendeeInput = '';
      }

      function cancelEditAppt() {
          editingApptId.value = null;
          newAppt.date = ''; newAppt.time = ''; newAppt.endTime = ''; newAppt.location = ''; newAppt.type = '이벤트'; newAppt.title = ''; newAppt.description = ''; newAppt.targetName = ''; newAppt.attendees = []; newAppt.newAttendeeInput = '';
      }

      function addAttendeeByName() {
          const name = (newAppt.newAttendeeInput || '').trim();
          if (!name) return;
          if (newAppt.attendees.includes(name)) {
              newAppt.newAttendeeInput = '';
              return;
          }
          const isMember = apptMemberNames.value.includes(name);
          const isRecruit = recruitNames.value.includes(name);
          if (!isMember && !isRecruit) {
              const newR = { id:'r'+Date.now(), name, major:'', job:'', company:'', relation:'', meetDate:'', period:'', gender:'남', score:50, birthDate:'', age:'', show:true, interactionHistory:[], disposition: defaultDisposition() };
              recruits.value.push(newR);
              showToastMsg(`[${name}]님이 Recruit 리스트에 자동 추가되었습니다.`);
          }
          newAppt.attendees.push(name);
          newAppt.newAttendeeInput = '';
      }

      function checkPastAppointments() {
          const today = new Date();
          today.setHours(0,0,0,0);
          
          let kept = [];
          let changed = false;
          
          for(let apt of appointments.value) {
              const aptDate = new Date(apt.date.replace(/[-./]/g, '/'));
              if(aptDate < today) {
                  const histDate = `${String(aptDate.getMonth()+1).padStart(2,'0')}/${String(aptDate.getDate()).padStart(2,'0')}/${String(aptDate.getFullYear()).slice(2)}`;
                  const typeLabel = apt.type || '약속/행사';
                  let extraBits = [];
                  if(apt.time) {
                      extraBits.push(apt.endTime ? apt.time + '~' + apt.endTime : apt.time);
                  }
                  if(apt.location) extraBits.push('@'+apt.location);
                  const extraStr = extraBits.length ? ' ('+extraBits.join(' ')+')' : '';
                  const descStr = apt.description ? ' — ' + apt.description : '';
                  const content = `[${typeLabel}] ${apt.title}${extraStr}${descStr}`;
                  
                  if(apt.targetName) {
                      addHistoryToPerson(apt.targetName, histDate, content);
                  }
                  apt.attendees.forEach(attName => {
                      addHistoryToPerson(attName, histDate, content);
                  });
                  changed = true;
              } else {
                  kept.push(apt);
              }
          }
          if(changed) {
              appointments.value = kept;
              showToastMsg('지난 약속이 각 멤버 히스토리로 이관되었습니다.');
          }
      }

      function addHistoryToPerson(name, dateStr, content) {
          let m = members.value.find(x => x.name === name);
          if(m) {
              if(!m.interactionHistory) m.interactionHistory = [];
              m.interactionHistory.push({ id: 'ih'+Date.now()+Math.random(), date: dateStr, content: content });
              m.interactionHistory = [...m.interactionHistory];
              if(m.recruitId) {
                  let r = recruits.value.find(x => x.id === m.recruitId);
                  if(r) r.interactionHistory = [...m.interactionHistory];
              }
          } else {
              let r = recruits.value.find(x => x.name === name);
              if(r) {
                  if(!r.interactionHistory) r.interactionHistory = [];
                  r.interactionHistory.push({ id: 'ih'+Date.now()+Math.random(), date: dateStr, content: content });
                  r.interactionHistory = [...r.interactionHistory];
              }
          }
      }

      function onNodeClick(m){ 
        selectedMemberId.value = m.id;
        if(memberInfoPosition.value === 'none') { memberInfoPosition.value = 'right'; }
      }
      function getRecruitMeta(r){ const ageStr=r.age?`${r.age}세`:''; return [r.major, r.job, r.company, r.relation,ageStr,calcPeriod(r.meetDate,r.period),r.gender].filter(Boolean).join(' | '); }

      // ── Persistence ──
      function snapshot(){
        return {
          header:{...header},
          members:JSON.parse(JSON.stringify(members.value)),
          notes:JSON.parse(JSON.stringify(notes.value)),
          recruits:JSON.parse(JSON.stringify(recruits.value)),
          appointments:JSON.parse(JSON.stringify(appointments.value)),
          recruitPosition:recruitPosition.value, notesPosition:notesPosition.value, memberInfoPosition:memberInfoPosition.value, appointmentPosition:appointmentPosition.value,
          nodeWidth:nodeWidth.value, nodeBaseHeight:nodeBaseHeight.value, nodeFontSize:nodeFontSize.value, nodeLineGap:nodeLineGap.value, notePanelWidth:notePanelWidth.value,
          legendConfig:JSON.parse(JSON.stringify(legendConfig.value))
        };
      }
      function migrateHistory(h){
        if(!h.type) h.type='History';
        if(h.type==='Point') h.type='History';
        if(h.amount===undefined){
          if(h.type==='Issue Paid'||h.type==='Pending'){ h.amount=h.point||0; h.point=0; } else { h.amount=0; }
        }
        if(h.point===undefined) h.point=0;
        return h;
      }
      function restore(d){
        clearFocus(); Object.assign(header,d.header);
        members.value=(d.members||[]).map(m=>{
          const history=(m.history||[]).map(h=>migrateHistory({...h}));
          const interactionHistory = m.interactionHistory || [];
          let st = m.status;
          if(st === 'New' || st === 'Code-in') st = 'New(Code-in)';
          const disp = m.disposition ? JSON.parse(JSON.stringify(m.disposition)) : defaultDisposition();
          return {birthDate:'',age:'',meetDate:'',major:'',job:'',company:'',relation:'',gender:'남',email:'',issuePaid:0,pending:0,score:0, interactionHistory, recruitId:null, ...m, status:st, history, disposition: disp};
        });
        notes.value=(d.notes||[]).map(n=>typeof n==='string'?{text:n}:n);
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

      function exportJSON(){ 
        if (printRootId.value !== '__actual_root__') {
            const subRoot = members.value.find(m => m.id === printRootId.value);
            if (!subRoot) return;
            const ids = new Set();
            function col(id){ ids.add(id); members.value.filter(m=>m.parentId===id).forEach(m=>col(m.id)); }
            col(printRootId.value);
            const subMemberList = members.value.filter(m=>ids.has(m.id)).map(m=>m.id===printRootId.value ? {...m,parentId:null} : {...m});
            const originalRoot = members.value.find(m=>!m.parentId);
            const newHeader = {...header, id:'', rank:subRoot.status==='root'?'':subRoot.status, fd:originalRoot?originalRoot.name:header.fd, sfd:header.fd||header.sfd, dd:header.sfd||header.dd, efd:header.dd||header.efd};
            
            const data = {
                header: newHeader,
                members: JSON.parse(JSON.stringify(subMemberList)),
                notes: JSON.parse(JSON.stringify(notes.value)),
                recruits: [], appointments: [],
                recruitPosition: recruitPosition.value, notesPosition: notesPosition.value, memberInfoPosition: memberInfoPosition.value, appointmentPosition: appointmentPosition.value,
                nodeWidth: nodeWidth.value, nodeBaseHeight: nodeBaseHeight.value, nodeFontSize: nodeFontSize.value, nodeLineGap: nodeLineGap.value, notePanelWidth: notePanelWidth.value,
                legendConfig: JSON.parse(JSON.stringify(legendConfig.value)),
                _subExportOf: originalRoot ? originalRoot.name : '',
                _subExportFrom: subRoot.name,
                _exportedAt: new Date().toLocaleString('ko-KR')
            };
            const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'}); 
            const url = URL.createObjectURL(blob); 
            const a = document.createElement('a'); a.href = url; 
            a.download = `${subRoot.name.replace(/\s+/g,'_')}_subtree_${Date.now()}.json`; 
            a.click(); URL.revokeObjectURL(url); 
            showToastMsg(`📤 ${subRoot.name} 하위 그룹 내보내기 완료`);
        } else {
            const d = snapshot(); d._exportedAt = new Date().toLocaleString('ko-KR'); 
            const blob = new Blob([JSON.stringify(d,null,2)], {type:'application/json'}); 
            const url = URL.createObjectURL(blob); 
            const a = document.createElement('a'); a.href = url; 
            a.download = `${(rootMemberName.value||'tree').replace(/\s+/g,'_')}_${Date.now()}.json`; 
            a.click(); URL.revokeObjectURL(url); 
            showToastMsg('📤 JSON 전체 내보내기 완료'); 
        }
      }

      function exportSubJSON(){
        if(!focusRootId.value){showToastMsg('포커스 모드에서만 사용 가능합니다','error');return;}
        const subRoot=members.value.find(m=>m.id===focusRootId.value); if(!subRoot)return;
        const subMemberList=focusedList.value.map(m=>m.id===focusRootId.value?{...m,parentId:null}:{...m});
        const originalRoot=members.value.find(m=>!m.parentId);
        const newHeader={...header,id:'',rank:subRoot.status==='root'?'':subRoot.status,fd:originalRoot?originalRoot.name:header.fd,sfd:header.fd||header.sfd,dd:header.sfd||header.dd,efd:header.dd||header.efd};
        const data={header:newHeader,members:JSON.parse(JSON.stringify(subMemberList)),notes:JSON.parse(JSON.stringify(notes.value)),recruits:[],appointments:[],recruitPosition:recruitPosition.value,notesPosition:notesPosition.value, memberInfoPosition:memberInfoPosition.value, appointmentPosition:appointmentPosition.value, nodeWidth:nodeWidth.value,nodeBaseHeight:nodeBaseHeight.value,nodeFontSize:nodeFontSize.value,nodeLineGap:nodeLineGap.value,notePanelWidth:notePanelWidth.value,legendConfig:JSON.parse(JSON.stringify(legendConfig.value)),_subExportOf:originalRoot?originalRoot.name:'',_subExportFrom:subRoot.name,_exportedAt:new Date().toLocaleString('ko-KR')};
        const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${subRoot.name.replace(/\s+/g,'_')}_subtree_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); showToastMsg(`📤 ${subRoot.name} 서브 내보내기 완료`);
      }
      function importJSON(e){ const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(!d.header||!d.members)throw new Error(); if(!confirm('현재 작업을 덮어쓸까요?'))return; restore(d); isDirty.value=false; showToastMsg('📥 불러오기 완료'); }catch{ showToastMsg('❌ 파일 형식 오류','error'); } }; reader.readAsText(file); e.target.value=''; }

      // ── Print ──
      function histInRange(h){
        if(!h.date) return true;
        const hTime = parseDateForSort(h.date);
        if(!hTime) return true;
        const startStr = header.periodStart;
        const endStr = header.periodEnd;
        if(!startStr && !endStr) return true;
        const startTime = startStr ? parseDateForSort(startStr) : 0;
        const endTime = endStr ? parseDateForSort(endStr) : Infinity;
        return hTime >= startTime && hTime <= endTime;
      }
      
      async function buildPrintDoc(){
        await nextTick();
        const orient=printLandscape.value?'landscape':'portrait';
        const pw=PAGE_W_PX.value, ph=PAGE_H_PX.value;
        let svgHTML='';
        const svgEl=document.getElementById('main-tree-svg');
        if(svgEl){
          const clone=svgEl.cloneNode(true);
          clone.removeAttribute('width'); clone.removeAttribute('height');
          clone.setAttribute('viewBox',`0 0 ${layout.value.totalWidth} ${layout.value.totalHeight}`);
          clone.style.cssText='width:100%;height:auto;display:block;';
          svgHTML=clone.outerHTML;
        }
        const subMembers=members.value;
        const tt={paid:subMembers.reduce((s,m)=>s+getMemberIssuePaid(m),0),pending:subMembers.reduce((s,m)=>s+getMemberPending(m),0),total:subMembers.reduce((s,m)=>s+getMemberIssuePaid(m)+getMemberPending(m),0)};
        const sc={}; subMembers.forEach(m=>{sc[m.status]=(sc[m.status]||0)+1;});
        const rm=rootMember.value, h=header;
        const uplines=[]; if(h.fd)uplines.push(`<strong>FD</strong> ${h.fd}`); if(h.sfd)uplines.push(`<strong>SFD</strong> ${h.sfd}`); if(h.dd)uplines.push(`<strong>DD</strong> ${h.dd}`); if(h.efd)uplines.push(`<strong>EFD</strong> ${h.efd}`);
        
        let memberRows = '';
        if (printIncludeMemberInfo.value) {
            memberRows=subMembers.map(m=>{
              const vis=(m.history||[]).filter(hh=>hh.show&&histInRange(hh)); if(!vis.length)return '';
              const rows=vis.sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date)).map(hh=>{
                let val=hh.content || ''; 
                let extras=[];
                if(Number(hh.amount)) extras.push(`$${fmt(hh.amount)}`);
                if(Number(hh.point)) extras.push(`${fmt(hh.point)} Pts`);
                
                let extraStr = extras.length ? `<div style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:#1c2b4a;margin-top:2px;">${extras.join(' | ')}</div>` : '';
                return `<tr><td style="width:110px;white-space:nowrap;color:#555;font-family:'JetBrains Mono',monospace;font-size:9px">${hh.date||'—'}</td><td style="font-size:10px;padding-bottom:4px;"><div>${val}</div>${extraStr}</td></tr>`;
              }).join('');
              let mName=m.name; const pts=mPtsSum(m); if(pts>0) mName+=` <span style="font-size:8px;color:#b8943a;font-family:'JetBrains Mono',monospace;">(Pts:${fmt(pts)})</span>`;
              return `<div class="pd-hist-member"><div class="pd-hist-name">${mName}</div><table class="pd-hist-table">${rows}</table></div>`;
            }).filter(Boolean).join('');
        }

        let recruitsHTML = '';
        if (printIncludeRecruit.value && visibleRecruits.value.length) {
            recruitsHTML = visibleRecruits.value.map(r => {
                let rInfo = `<div class="pd-hist-member"><div class="pd-hist-name">${r.name} <span style="font-size:8px;color:#b8943a;">(적합도:${r.score})</span></div>`;
                if (r.interactionHistory && r.interactionHistory.length) {
                    const rows = [...r.interactionHistory].sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date)).map(ih => {
                        return `<tr><td style="width:80px;white-space:nowrap;color:#555;font-family:'JetBrains Mono',monospace;font-size:9px">${ih.date||'—'}</td><td style="font-size:10px;padding-bottom:4px;">${ih.content}</td></tr>`;
                    }).join('');
                    rInfo += `<table class="pd-hist-table">${rows}</table>`;
                } else {
                    rInfo += `<div style="font-size:9px;color:#888;padding:2px 0;">상담 기록 없음</div>`;
                }
                rInfo += `</div>`;
                return rInfo;
            }).join('');
        }

        let appointmentsHTML = '';
        if (printIncludeAppointment.value && upcomingAppointments.value.length) {
            appointmentsHTML = upcomingAppointments.value.map(apt => {
                const dateStr = fmtApptDateShort(apt.date);
                const timeStr = apt.time ? (apt.endTime ? apt.time + '~' + apt.endTime : apt.time) : '';
                let titleStr = apt.title;
                if ((apt.type||'이벤트') === '약속') { titleStr = apptPeopleList(apt).join(', '); }
                return `<div class="pd-note-item" style="display:flex; flex-direction:column; gap:2px; padding:4px 0;">
                    <div style="display:flex; gap:6px; align-items:baseline;">
                      <span class="pd-note-num" style="color:#d35400; background:#fdf6ee; padding:1px 4px; border-radius:4px; border:none; font-size:8.5px;">${apt.type||'이벤트'}</span>
                      <span style="font-family:'JetBrains Mono',monospace; font-weight:700; color:#1c2b4a; font-size:10px;">${dateStr} ${timeStr}</span>
                      <span style="font-weight:700; color:#1c2b4a; font-size:11px;">${titleStr}</span>
                    </div>
                    ${apt.location ? `<div style="font-size:9px; color:#555; padding-left:4px;">📍 ${apt.location}</div>` : ''}
                    ${apt.description ? `<div style="font-size:10px; color:#333; padding-left:4px; border-left:2px solid #ddd; margin-left:2px;">${apt.description}</div>` : ''}
                </div>`;
            }).join('');
        }

        let notesHTML='';
        if (printIncludeNotes.value && notes.value.length) {
            notesHTML=notes.value.map((n,i)=>`<div class="pd-note-item"><span class="pd-note-num">${i+1}</span>${n.text}</div>`).join('');
        }

        let filterLabel=''; 
        if(h.periodStart || h.periodEnd) { filterLabel = `${h.periodStart||'시작'} ~ ${h.periodEnd||'계속'}`; }
        
        let legendHTML='';
        if(legendConfig.value.show){
          legendHTML=ALL_STATUSES.filter(s=>legendConfig.value.items[s].show && sc[s] > 0).map(s=>`<div class="pd-leg-item"><span class="pd-leg-box" style="background:${COLORS[s]}!important;border:1px solid ${STROKES[s]}!important"></span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${legendConfig.value.items[s].label}</span><span style="transform:scale(0.8);flex-shrink:0;">(${sc[s]})</span></div>`).join('');
        }
        let headerHTML=`<div class="pd-header"><div class="pd-header-left"><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 6px;width:100%;">${legendHTML}</div></div><div class="pd-header-center"><div class="pd-name">${rm?rm.name:''} <span class="pd-id">(${h.id})</span></div>`;
        if(h.rank)headerHTML+=`<div style="display:inline-block;margin:1px 0 2px 0;background:#1c2b4a;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:6px;letter-spacing:1px">${h.rank}</div>`;
        if(uplines.length)headerHTML+=`<div class="pd-upline">${uplines.join('&nbsp;|&nbsp;')}</div>`;
        headerHTML+=`<div style="margin-top:3px;font-size:8px;color:#555;"><strong>PERIOD:</strong> ${h.periodStart} – ${h.periodEnd}</div></div><div class="pd-header-right"><div class="pd-date">As of ${h.asOf}</div><div class="pd-fin-row"><span class="pd-fin-label">Issue Paid</span><span class="pd-fin-val">${fmt(tt.paid)}</span></div><div class="pd-fin-row"><span class="pd-fin-label">Pending</span><span class="pd-fin-val">${fmt(tt.pending)}</span></div><div class="pd-fin-row pd-fin-total"><span>Total</span><span class="pd-fin-val">${fmt(tt.total)}</span></div></div></div>`;
        
        let sideColHTML = '';
        if (memberRows || recruitsHTML || appointmentsHTML || notesHTML) {
            sideColHTML += `<div class="pd-side-col">`;
            if(memberRows) sideColHTML += `<div class="pd-hist-section"><div class="pd-hist-section-title">📋 멤버 히스토리<span class="pd-hist-filter-label">${filterLabel}</span></div><div class="pd-hist-grid">${memberRows}</div></div>`;
            if(recruitsHTML) sideColHTML += `<div class="pd-hist-section" style="margin-top:12px;"><div class="pd-hist-section-title" style="color:#b8943a; border-bottom:1.5px solid #b8943a;">🎯 Recruit 리스트</div><div class="pd-hist-grid">${recruitsHTML}</div></div>`;
            if(appointmentsHTML) sideColHTML += `<div style="margin-top:12px"><div class="pd-notes-title" style="color:#d35400; border-bottom:1.5px solid #d35400;">📅 예정된 약속/이벤트</div><div style="display:flex; flex-direction:column; gap:4px;">${appointmentsHTML}</div></div>`;
            if(notesHTML) sideColHTML += `<div style="margin-top:12px"><div class="pd-notes-title">📝 메모 / 액션 아이템</div><div class="pd-notes-grid">${notesHTML}</div></div>`;
            sideColHTML += `</div>`;
        }

        let inner='';
        if(printLandscape.value){
          inner+=`<div class="pd-body-landscape"><div class="pd-main-col">`;
          if(h.title)inner+=`<div class="pd-doc-title">${h.title}</div>`;
          inner+=headerHTML+`<div class="pd-tree-wrap">${svgHTML}</div></div>`;
          inner += sideColHTML;
          inner+=`</div>`;
        } else {
          if(h.title)inner+=`<div class="pd-doc-title">${h.title}</div>`;
          inner+=headerHTML+`<div class="pd-body-portrait"><div class="pd-main-col"><div class="pd-tree-wrap">${svgHTML}</div></div>`;
          inner += sideColHTML;
          inner+=`</div>`;
        }
        let html='<!DOCTYPE html><html><head><meta charset="UTF-8">';
        html+='<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Libre+Baskerville:wght@700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">';
        html+='<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"Noto Sans KR",sans-serif;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}#wrap{width:'+pw+'px;min-height:'+ph+'px;padding:16px 20px;}@page{margin:0;size:letter '+orient+';}@media print{html,body{width:'+pw+'px;height:'+ph+'px;overflow:hidden;}#wrap{padding:16px 20px;}} .edge-line{stroke:#6b7280;stroke-width:1.5px;fill:none;}.edge-dash{stroke:#9ca3af;stroke-width:1.2px;stroke-dasharray:5,3;fill:none;}';
        html+='.pd-doc-title{text-align:center;font-family:"Libre Baskerville",serif;font-size:18px;font-weight:700;color:#1c2b4a;margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid #1c2b4a;}';
        html+='.pd-header{display:grid;grid-template-columns:180px 1fr 140px;align-items:stretch;border:1.5px solid #1c2b4a;margin-bottom:8px;background:#fff;}';
        html+='.pd-header-left{padding:4px 6px;font-size:8px;line-height:1.3;border-right:1px solid #1c2b4a;}';
        html+='.pd-leg-item{display:flex;align-items:center;gap:4px;margin-bottom:1px;font-size:8px;overflow:hidden;}';
        html+='.pd-leg-box{width:12px;height:8px;border-radius:1px;display:inline-block;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}';
        html+='.pd-header-center{padding:4px 8px;text-align:center;border-right:1px solid #1c2b4a;display:flex;flex-direction:column;justify-content:center;}';
        html+='.pd-name{font-family:"Libre Baskerville",serif;font-size:15px;font-weight:700;margin-bottom:2px;}';
        html+='.pd-id{font-size:9px;color:#555;margin-left:4px;}';
        html+='.pd-upline{font-size:8px;color:#333;margin-top:2px;}';
        html+='.pd-upline strong{font-weight:700;color:#1c2b4a;margin-right:2px;}';
        html+='.pd-header-right{padding:4px 8px;font-size:9px;text-align:right;line-height:1.4;display:flex;flex-direction:column;justify-content:center;}';
        html+='.pd-fin-row{display:flex;justify-content:space-between;gap:4px;}';
        html+='.pd-fin-label{color:#555;}';
        html+='.pd-fin-val{font-family:"JetBrains Mono",monospace;font-weight:600;}';
        html+='.pd-fin-total{font-size:11px;font-weight:700;border-top:1px solid #1c2b4a;padding-top:2px;margin-top:2px;}';
        html+='.pd-date{font-size:8px;color:#666;margin-bottom:2px;}';
        html+='.pd-body-landscape{display:flex;gap:16px;align-items:flex-start;}.pd-body-landscape .pd-main-col{flex:1;min-width:0;}.pd-body-landscape .pd-side-col{width:310px;flex-shrink:0;}';
        html+='.pd-body-portrait .pd-main-col{width:100%;}.pd-body-portrait .pd-side-col{width:100%;margin-top:12px;}';
        html+='.pd-tree-wrap{border:1px solid #ddd;padding:4px;text-align:center;display:flex;justify-content:center;}.pd-tree-wrap svg{max-width:100%;height:auto;display:block;}';
        html+='.pd-hist-section-title{font-size:10px;font-weight:700;letter-spacing:.5px;color:#1c2b4a;text-transform:uppercase;border-bottom:1.5px solid #1c2b4a;padding-bottom:2px;margin-bottom:5px;}';
        html+='.pd-hist-filter-label{font-size:8.5px;color:#888;margin-left:6px;font-style:italic;}.pd-hist-grid{display:grid;gap:5px 10px;}.pd-body-landscape .pd-hist-grid{grid-template-columns:1fr;}.pd-body-portrait .pd-hist-grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));}';
        html+='.pd-hist-member{break-inside:avoid;}.pd-hist-name{font-size:10.5px;font-weight:700;color:#1c2b4a;margin-bottom:1px;border-bottom:1px solid #ddd;padding-bottom:1px;}';
        html+='.pd-hist-table{width:100%;border-collapse:collapse;font-size:8.5px;}.pd-hist-table td{padding:1px 3px;border-bottom:1px dotted #eee;vertical-align:top;}';
        html+='.pd-notes-title{font-size:10px;font-weight:700;letter-spacing:.5px;color:#1c2b4a;text-transform:uppercase;margin-bottom:5px;border-bottom:1.5px solid #1c2b4a;padding-bottom:3px;}';
        html+='.pd-notes-grid{display:grid;gap:2px 12px;}.pd-body-landscape .pd-notes-grid{grid-template-columns:1fr;}.pd-body-portrait .pd-notes-grid{grid-template-columns:1fr 1fr 1fr;}';
        html+='.pd-note-item{display:flex;align-items:baseline;gap:4px;font-size:10px;padding:2px 0;border-bottom:1px dotted #ccc;}.pd-note-num{font-weight:700;color:#b8943a;font-family:"JetBrains Mono",monospace;font-size:9px;flex-shrink:0;}';
        html+='</style></head><body><div id="wrap">'+inner+'</div>';
        html+='<scr'+'ipt>window.onload=function(){var wrap=document.getElementById("wrap");var scale=Math.min('+pw+'/wrap.scrollWidth,'+ph+'/wrap.scrollHeight);if(scale<1){wrap.style.transformOrigin="top left";wrap.style.transform="scale("+scale+")";document.body.style.overflow="hidden";}};</scr'+'ipt></body></html>';
        return html;
      }
      async function doPrint(){ const html=await buildPrintDoc(); showPreview.value=true; await nextTick(); const frame=document.getElementById('preview-frame'); if(frame)frame.srcdoc=html; }
      function confirmPrint(){ const frame=document.getElementById('preview-frame'); if(frame&&frame.contentWindow){ let ps=frame.contentDocument.getElementById('print-page-style'); if(!ps){ps=frame.contentDocument.createElement('style');ps.id='print-page-style';frame.contentDocument.head.appendChild(ps);} ps.textContent=`@page{margin:0;size:letter ${printLandscape.value?'landscape':'portrait'};}`;frame.contentWindow.print(); } }

      onMounted(()=>{
        initAuth();
      });
      
      watch([header,members,notes,recruits,appointments,recruitPosition,notesPosition,memberInfoPosition,appointmentPosition,nodeWidth,nodeBaseHeight,nodeFontSize,nodeLineGap,notePanelWidth,legendConfig],()=>{
        if (applyingRemote) return;                 // 원격 변경 적용 중엔 저장 트리거 금지 (에코 방지)
        if (currentIsReadOnly.value) return;        // 읽기 전용 트리는 저장 안 함
        if(!isDashboard.value) {
            isDirty.value=true;
            if(autoTimer)clearTimeout(autoTimer);
            autoTimer=setTimeout(() => saveToCloud(true), 3000);
        }
      },{deep:true});

      return {
        currentUser, isDashboard, savedTrees, sharedTrees, currentTreeId, currentTreeMeta, currentIsOwner, currentIsEditor, currentIsReadOnly,
        loginWithGoogle, logout, fetchSavedTrees, createNewTree, loadTree, deleteTree, goToDashboard, saveToCloud,
        addShare, removeShare, changeShareRole, shareSubTree, openSubTreeShareModal, showSubTreeShareModal, subTreeShareInput,
        header, members, notes, appointments, notesPosition, recruitPosition, memberInfoPosition, appointmentPosition, tab,
        toast, showPreview, isDirty, lastAutoSave, slots, showShareModal, shareInput,
        focusRootId, zoomLevel, panX, panY,
        nodeWidth, nodeBaseHeight, nodeFontSize, nodeLineGap, widthLocked, heightLocked, fontLocked, lineGapLocked, notePanelWidth, notePanelLocked,
        recruits, newRecruit, expandedMemberId, expandedInteractionId, expandedDispositionId, expandedRecruitInteractionId, expandedRecruitDispositionId, editingApptId,
        selectedMemberId, selectedMember, newHist, newInteraction, newRecruitInteraction, newAppt, nm, printLandscape, showSizePanel, printRootId, printHistMode, printHistDays, printHistFrom, printHistTo,
        legendConfig, allStatuses:ALL_STATUSES, availableStatuses, memberNames, recruitNames, allPersonNames, apptMemberNames, uplineMemberNames, upcomingAppointments,
        recruitsSortedAll, visibleRecruits,
        focusedList, rootMember, rootMemberName, rootMemberEmail, currentMembers,
        teamTotal, statusCounts, layout,
        panTransform, previewPageStyle, previewFrameStyle,
        fmt, fmtS, parseDateForSort, calcAge, calcPeriod,
        sortedPointHistory, sortedInteractionHistory,
        getMemberIssuePaid, getMemberPending, mPtsSum,
        getMemberTotal, getIncomePercent, fmtApptDateShort, getPointHistPct,
        updateRootMemberName, updateRootMemberEmail, setFocus, clearFocus, toggleFocus,
        nodeNoteLines, nodeH,
        addMember, removeMember, toggleHistoryPanel, toggleInteractionPanel, toggleDispositionPanel, toggleRecruitInteractionPanel, toggleRecruitDispositionPanel, addHistoryItem, removeHistoryItem, addInteractionItem, removeInteractionItem, parentOpts,
        calcDisposition, addRecruit, removeRecruit, promoteRecruit, onScoreChange,
        addRecruitInteractionItem, removeRecruitInteractionItem, onRecruitInteractionChange, onMemberInteractionChange,
        addAppointment, removeAppointment, completeAppointment, editAppointment, cancelEditAppt, handleTargetNameChange, addAttendeeByName, getPersonTitle, apptPeopleList,
        addNote, onNodeClick, getRecruitMeta,
        zoomIn, zoomOut, zoomReset, centerTree, onWheel, onPanStart, onPanMove, onPanEnd,
        quickSave, exportJSON, exportSubJSON, importJSON,
        doPrint, confirmPrint,
        getToastClass, getSaveStatusClass, getSaveStatusText,
        printIncludeNotes, printIncludeRecruit, printIncludeAppointment, printIncludeMemberInfo, printIncludePointHistory, printIncludeLeft, printIncludeRight,
        getEdgeClass:(e)=>['Potential', 'Serious'].includes(e.status)?'edge-dash':'edge-line',
        getNodeTransform:(m)=>`translate(${m.pos.x-nodeWidth.value/2},${m.pos.y-nodeH(m)/2})`,
        getRectStrokeWidth:(m)=>['Potential', 'Serious'].includes(m.status)?1.5:1,
        getRectDash:(m)=>['Potential', 'Serious'].includes(m.status)?'5,3':'none',
        getLegendMargin:()=>legendConfig.value.show?'auto':'0',
        getTbarClass:(c)=>c?'tbar-save':'tbar-other',
        getFocusTitle:(m)=>focusRootId.value===m.id?'포커스 해제':m.name+' 기준으로 보기',
        getFocusIcon:(m)=>focusRootId.value===m.id?'⊙':'🔍',
        nColor:(s)=>COLORS[s]||'#fff',
        nStroke:(s)=>STROKES[s]||'#000',
        nTextColor:(s)=>TEXT_COLORS[s]||'#000',
        nDivider:(s)=>DIVIDERS[s]||'rgba(0,0,0,.15)',
        statusBadge:(s)=>BADGE_MAP[s]||s
      };
    }
  }).mount('#app');
});