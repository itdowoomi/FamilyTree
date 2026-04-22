import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;

  // ========== 파이어베이스 설정 ==========
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
      const defaultDisposition = () => ({ relationScore: 0, market: '', married: false, child: false, house: false, income: false, ambition: false, dissatisfied: false, pma: false, entrepreneur: false, prejudice: 0 });
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
      const newNote = reactive({ text: '', scope: 'all' }); // all or personal
      
      const notesPosition = ref('none');
      const recruitPosition = ref('none');
      const memberInfoPosition = ref('right');
      const appointmentPosition = ref('none');
      const tab = ref('memberInfo');
      const showShareModal = ref(false);
      const showSubTreeShareModal = ref(false);
      const shareInput = reactive({ email: '', role: 'editor' });
      const subTreeShareInput = reactive({ email: '', role: 'editor', includeData: true });
      // 선택된 멤버의 서브트리 공유 정보 (우측 패널에 표시/관리용)
      const subTreeSharesForSelected = ref({ treeId: null, sharedEmails: [], sharePermissions: {}, primaryEmail: '' });
      const toast = reactive({ msg:'', type:'success', visible:false });
      let toastTimer = null, autoTimer = null;
      const isDirty = ref(false);
      const lastAutoSave = ref('');
      const slots = ref(Array(5).fill(null));
      const printLandscape = ref(true);
      const showSizePanel = ref(false);
      const showPreview = ref(false);
      const printRootId = ref('__actual_root__');
      
      // 인쇄 옵션 변수들
      const printIncludeNotes = ref(true);
      const printIncludeRecruit = ref(true);
      const printIncludeAppointment = ref(true);
      const printIncludeMemberInfo = ref(true);
      const printIncludePointHistory = ref(true);
      
      const newRecruit = reactive({ name:'', email:'', major:'', job:'', company:'', relation:'', meetDate:'', period:'', gender:'남', score:50, birthDate:'', age:'', parentId:'' });
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
      const newAppt = reactive({ date: '', time: '', endTime: '', location: '', type: '이벤트', title: '', description: '', targetName: '', attendees: [], newAttendeeInput: '', createdBy: '' });

      const nm = reactive({ name:'', email:'', major:'', job:'', company:'', status:'New(Code-in)', parentId:'root', birthDate:'', age:'', meetDate:'', relation:'', gender:'남', score:0 });

      const nodeWidth = ref(155), nodeBaseHeight = ref(58), nodeFontSize = ref(10), nodeLineGap = ref(11);
      const widthLocked = ref(false), heightLocked = ref(false), fontLocked = ref(false), lineGapLocked = ref(false);
      const notePanelWidth = ref(210), notePanelLocked = ref(false);
      const zoomLevel = ref(1), panX = ref(0), panY = ref(0);
      let isPanning = false, panStartX = 0, panStartY = 0, panStartPX = 0, panStartPY = 0;
      const legendConfig = ref({ show:true, items:{} });
      ALL_STATUSES.forEach(s => { legendConfig.value.items[s] = { label:s, show:true }; });

      // ── Auth & Cloud Logic ──
      const getTreesPath = () => {
        if (isCanvas) {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          return `artifacts/${appId}/trees`;
        }
        return 'trees';
      };
      const getLegacyTreesPath = (uid) => getCollectionPath(uid, 'trees');

      const sharedTrees = ref([]);
      const currentTreeMeta = ref(null);
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
        } catch (e) {
          // permission-denied 등은 레거시 경로가 더 이상 허용되지 않는 일반적 상황.
          // 기능 동작에는 영향이 없으므로 경고로 낮춰 조용히 무시한다.
          const code = (e && e.code) || '';
          if (code === 'permission-denied') {
            console.warn('[migration] skipped (no legacy access)');
          } else {
            console.warn('[migration] skipped:', code || (e && e.message) || e);
          }
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
          const ownedSnap = await getDocs(query(col, where('ownerId', '==', currentUser.value.uid)));
          savedTrees.value = ownedSnap.docs.map(d => ({ id: d.id, ...d.data(), _owned: true }))
            .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));

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
        lastLocalSaveMs = 0; // 트리 전환 시 에코 가드 초기화
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
          sharePermissions: treeSummary.sharePermissions || {},
          isSubTree: treeSummary.isSubTree || false,
          parentTreeId: treeSummary.parentTreeId || null
        };
        isDashboard.value = false;
        lastLocalSaveMs = 0; // 트리 전환 시 에코 가드 초기화 (다른 트리의 저장이 이 트리의 onSnapshot을 가리지 않도록)
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
        lastLocalSaveMs = 0;
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

      const removeFromSharedTree = async (id, name) => {
        if (!confirm(`'${name || '이 트리'}'를 공유 목록에서 제거하시겠습니까?`)) return;
        try {
          const ref = doc(db, getTreesPath(), id);
          const snap = await getDoc(ref);
          if (!snap.exists()) return;
          const d = snap.data();
          const myEmail = (currentUser.value.email || '').toLowerCase();
          const emails = (d.sharedEmails || []).filter(e => e !== myEmail);
          const perms = { ...(d.sharePermissions || {}) };
          delete perms[myEmail];
          await updateDoc(ref, { sharedEmails: emails, sharePermissions: perms });
          fetchSavedTrees();
          showToastMsg('공유 목록에서 제거되었습니다.');
        } catch (e) {
          console.error(e);
          showToastMsg('제거 실패', 'error');
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

          // Firestore는 undefined 를 거부하므로 항상 허용 값(false / null / 빈값)으로 보정한다.
          const treeData = {
            name: rootMemberName.value || '제목 없는 트리',
            updatedAt: new Date().toLocaleString('ko-KR'),
            updatedAtMs: now,
            savedByUid: currentUser.value.uid,
            savedByEmail: currentUser.value.email || '',
            memberCount: members.value.length,
            data: snap,
            ownerId: (prev && prev.ownerId) ? prev.ownerId : currentUser.value.uid,
            ownerEmail: (prev && prev.ownerEmail) ? prev.ownerEmail : (currentUser.value.email || ''),
            sharedEmails: (prev && Array.isArray(prev.sharedEmails)) ? prev.sharedEmails : [],
            sharePermissions: (prev && prev.sharePermissions && typeof prev.sharePermissions === 'object') ? prev.sharePermissions : {},
            isSubTree: !!(prev && prev.isSubTree),
            parentTreeId: (prev && prev.parentTreeId) ? prev.parentTreeId : null,
            subTreeRootMemberId: (prev && prev.subTreeRootMemberId) ? prev.subTreeRootMemberId : null,
            subTreeRootMemberName: (prev && prev.subTreeRootMemberName) ? prev.subTreeRootMemberName : null
          };
          // 안전망: 남아있는 undefined 를 모두 null 로 치환
          Object.keys(treeData).forEach(k => { if (treeData[k] === undefined) treeData[k] = null; });
          await setDoc(ref, treeData);
          lastAutoSave.value = treeData.updatedAt;
          isDirty.value = false;
          
          if (!treeData.isSubTree) {
            await updateRelatedSubTrees(currentTreeId.value);
          } else {
            await syncSubTreeToParent(currentTreeId.value, treeData);
          }
          
          if(!isAuto) showToastMsg('☁️ 클라우드에 안전하게 저장되었습니다!');
        } catch (e) {
          console.error('[saveToCloud] failed:', e);
          const code = (e && e.code) ? e.code : '';
          const msg = (e && e.message) ? e.message : '';
          let friendly = '저장 실패';
          if (code === 'permission-denied' || /permission/i.test(msg)) {
            friendly = '권한 오류: Firestore 보안 규칙을 확인하세요. (firestore.rules 파일 참고)';
          } else if (code === 'unauthenticated') {
            friendly = '로그인 세션이 만료되었습니다. 다시 로그인 해 주세요.';
          } else if (code === 'unavailable' || /network|offline/i.test(msg)) {
            friendly = '네트워크 연결을 확인하세요.';
          } else if (msg) {
            friendly = `저장 실패: ${msg.slice(0,120)}`;
          }
          showToastMsg(friendly, 'error');
        }
      };

      const updateRelatedSubTrees = async (parentTreeId) => {
        try {
          const topPath = getTreesPath();
          const col = collection(db, topPath);
          const subTreesSnap = await getDocs(query(col, 
            where('parentTreeId', '==', parentTreeId),
            where('ownerId', '==', currentUser.value.uid)
          ));

          if (subTreesSnap.empty) return;

          for (const subTreeDoc of subTreesSnap.docs) {
            const subTreeData = subTreeDoc.data();
            const subRootMemberId = subTreeData.subTreeRootMemberId;
            
            if (!subRootMemberId) continue;

            const subRoot = members.value.find(m => m.id === subRootMemberId);
            if (!subRoot) continue;

            const ids = new Set();
            function collectSubtree(id) {
              ids.add(id);
              members.value.filter(m => m.parentId === id).forEach(m => collectSubtree(m.id));
            }
            collectSubtree(subRootMemberId);

            const subMembers = members.value.filter(m => ids.has(m.id)).map(m => 
              m.id === subRootMemberId ? { ...m, parentId: null } : { ...m }
            );

            const subRecruits = recruits.value.filter(r => {
              const linkedMember = members.value.find(m => m.recruitId === r.id);
              return linkedMember && ids.has(linkedMember.id);
            });

            // 약속 동기화: 양방향 병합 (upsert 전략)
            //   - 부모의 약속 중 "서브트리와 관련된 것"만 서브로 전파
            //     (타겟/참석자/작성자가 서브 멤버에 있거나, 이벤트 타입인 경우)
            //   - 서브에 있던 약속 중 부모에 없는 것(서브에서 새로 추가된 약속)은 유지
            //   - 타임스탬프 기반으로 최신 버전 우선
            const existingSubApts = subTreeData.data.appointments || [];
            const parentApts = appointments.value || [];
            const subMemberNamesForApts = new Set(subMembers.map(m => m.name));
            const isRelevantToSubtree = (apt) => {
              if (!apt) return false;
              if (apt.type === '이벤트') return true;
              if (apt.targetName && subMemberNamesForApts.has(apt.targetName)) return true;
              if (apt.attendees && apt.attendees.some(n => subMemberNamesForApts.has(n))) return true;
              if (apt.createdBy && subMemberNamesForApts.has(apt.createdBy)) return true;
              return false;
            };
            const parentIdSet = new Set(parentApts.map(a => a.id));
            const aptMap = new Map();

            // 기존 서브 약속: 부모에도 있던 항목은 그대로 두고(관련 여부는 부모 쪽에서 다시 판별),
            // 부모에 없는 항목(서브에서 고유하게 추가된 약속)은 보존
            existingSubApts.forEach(apt => {
              if (!parentIdSet.has(apt.id)) {
                aptMap.set(apt.id, { ...apt, _source: 'sub' });
              }
            });

            // 부모 약속 중 서브트리와 관련된 것만 병합 (최신 버전 우선)
            parentApts.filter(isRelevantToSubtree).forEach(apt => {
              const existing = aptMap.get(apt.id);
              if (!existing || !apt.updatedAt || !existing.updatedAt ||
                  new Date(apt.updatedAt) >= new Date(existing.updatedAt)) {
                aptMap.set(apt.id, { ...apt, _source: 'parent' });
              }
            });

            const mergedApts = Array.from(aptMap.values());

            // 메모 동기화: 양방향 병합
            //   - 서브의 개인(scope='personal') 메모 유지
            //   - 부모와 서브의 공개 메모 병합
            const existingSubNotes = subTreeData.data.notes || [];
            const subPersonal = existingSubNotes.filter(n => n && n.scope === 'personal');
            const subPublic = existingSubNotes.filter(n => n && n.scope !== 'personal');
            const parentPublicNotes = (notes.value || []).filter(n => n && n.scope !== 'personal');
            
            const noteMap = new Map();
            subPublic.forEach(n => noteMap.set(n.createdAt || n.text, n));
            parentPublicNotes.forEach(n => noteMap.set(n.createdAt || n.text, n));
            
            const mergedNotes = [...subPersonal, ...Array.from(noteMap.values())];

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

            const updatedSubTreeData = {
              ...subTreeData,
              name: `${subRoot.name} 서브 트리 (공유)`,
              updatedAt: new Date().toLocaleString('ko-KR'),
              updatedAtMs: Date.now(),
              savedByUid: currentUser.value.uid,
              savedByEmail: currentUser.value.email || '',
              memberCount: subMembers.length,
              subTreeRootMemberName: subRoot.name,
              data: {
                header: newHeader,
                members: JSON.parse(JSON.stringify(subMembers)),
                notes: JSON.parse(JSON.stringify(mergedNotes)),
                recruits: JSON.parse(JSON.stringify(subRecruits)),
                appointments: JSON.parse(JSON.stringify(mergedApts)),
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
              }
            };

            await updateDoc(doc(db, topPath, subTreeDoc.id), updatedSubTreeData);
          }
        } catch (e) {
          console.error('[subtree sync] failed', e);
        }
      };

      const syncSubTreeToParent = async (subTreeId, subTreeData) => {
        try {
          if (!subTreeData.isSubTree || !subTreeData.parentTreeId || !subTreeData.subTreeRootMemberId) return;
          
          const topPath = getTreesPath();
          const parentRef = doc(db, topPath, subTreeData.parentTreeId);
          const parentSnap = await getDoc(parentRef);
          
          if (!parentSnap.exists()) return;
          
          const parentData = parentSnap.data();
          if (!parentData.data || !parentData.data.members) return;
          
          const subMembers = subTreeData.data.members || [];
          const subRootMemberId = subTreeData.subTreeRootMemberId;
          
          let parentMembers = JSON.parse(JSON.stringify(parentData.data.members));
          
          const parentSubRoot = parentMembers.find(m => m.id === subRootMemberId);
          if (!parentSubRoot) return;
          
          const existingSubIds = new Set();
          function collectExistingSubtree(id) {
            existingSubIds.add(id);
            parentMembers.filter(m => m.parentId === id).forEach(m => collectExistingSubtree(m.id));
          }
          collectExistingSubtree(subRootMemberId);
          
          // 서브트리에 속한 멤버 ID 목록
          const subMemberIds = new Set(subMembers.map(m => m.id));
          
          parentMembers = parentMembers.filter(m => !existingSubIds.has(m.id) || m.id === subRootMemberId);
          
          subMembers.forEach(subM => {
            if (subM.id === subRootMemberId) {
              const idx = parentMembers.findIndex(m => m.id === subRootMemberId);
              if (idx >= 0) parentMembers[idx] = { ...subM, parentId: parentSubRoot.parentId };
            } else {
              const newMember = { ...subM };
              if (newMember.parentId === null) newMember.parentId = subRootMemberId;
              parentMembers.push(newMember);
            }
          });
          
          // 리크룻은 보존(추가/수정만 반영). 삭제까지 전파하면 다른 서브의 리크룻을 잃을 수 있음.
          const subRecruits = subTreeData.data.recruits || [];
          let parentRecruits = JSON.parse(JSON.stringify(parentData.data.recruits || []));
          subRecruits.forEach(subR => {
            const existingIdx = parentRecruits.findIndex(r => r.id === subR.id);
            if (existingIdx >= 0) parentRecruits[existingIdx] = { ...subR };
            else parentRecruits.push({ ...subR });
          });

          // ── 약속(appointments): 양방향 병합 전략 ──
          //    서브와 부모의 약속을 ID 기반으로 병합 (최신 버전 우선)
          const parentExistingApts = parentData.data.appointments || [];
          const subApts = subTreeData.data.appointments || [];
          const aptMergeMap = new Map();
          
          // 기존 부모 약속 먼저 로드
          parentExistingApts.forEach(apt => {
            aptMergeMap.set(apt.id, { ...apt, _source: 'parent' });
          });
          
          // 서브 약속으로 업데이트 (최신 것 우선)
          subApts.forEach(apt => {
            const existing = aptMergeMap.get(apt.id);
            if (!existing || !apt.updatedAt || !existing.updatedAt || 
                new Date(apt.updatedAt) >= new Date(existing.updatedAt)) {
              aptMergeMap.set(apt.id, { ...apt, _source: 'sub' });
            }
          });
          
          const parentApts = Array.from(aptMergeMap.values());

          // ── 메모(notes): 양방향 병합 전략 ──
          //    부모의 개인 메모 + 서브와 부모의 공개 메모 병합
          const parentPersonal = (parentData.data.notes || []).filter(n => n && n.scope === 'personal');
          const parentPublic = (parentData.data.notes || []).filter(n => n && n.scope !== 'personal');
          const subPublic = (subTreeData.data.notes || []).filter(n => n && n.scope !== 'personal');
          
          const noteMergeMap = new Map();
          parentPublic.forEach(n => noteMergeMap.set(n.createdAt || n.text, n));
          subPublic.forEach(n => noteMergeMap.set(n.createdAt || n.text, n));
          
          const parentNotes = [...parentPersonal, ...Array.from(noteMergeMap.values())];

          // 메인 트리 업데이트
          const updatedParentData = {
            ...parentData,
            updatedAt: new Date().toLocaleString('ko-KR'),
            updatedAtMs: Date.now(),
            savedByUid: currentUser.value.uid,
            savedByEmail: currentUser.value.email || '',
            memberCount: parentMembers.length,
            data: {
              ...parentData.data,
              header: parentData.data.header,
              members: parentMembers,
              recruits: parentRecruits,
              appointments: parentApts,
              notes: parentNotes
            }
          };

          await updateDoc(parentRef, updatedParentData);
          console.log('[sync] 서브트리 변경사항이 메인 트리에 반영되었습니다.');
        } catch (e) {
          console.error('[sync to parent] failed', e);
        }
      };

      function quickSave() { saveToCloud(false); }

      const subscribeToCurrentTree = () => {
        if (unsubTreeDoc) { unsubTreeDoc(); unsubTreeDoc = null; }
        if (!currentTreeId.value) return;
        const ref = doc(db, getTreesPath(), currentTreeId.value);
        unsubTreeDoc = onSnapshot(ref, (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          currentTreeMeta.value = {
            ownerId: d.ownerId || '',
            ownerEmail: d.ownerEmail || '',
            sharedEmails: d.sharedEmails || [],
            sharePermissions: d.sharePermissions || {},
            isSubTree: d.isSubTree || false,
            parentTreeId: d.parentTreeId || null
          };
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
        });
      };

      const addShare = async (email, role) => {
        if (!currentTreeId.value || !currentUser.value) return;
        const trimmed = (email || '').trim().toLowerCase();
        if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return showToastMsg('올바른 이메일을 입력하세요.', 'error');
        if (currentUser.value.email && trimmed === currentUser.value.email.toLowerCase()) return showToastMsg('본인 이메일은 추가할 수 없습니다.', 'error');
        try {
          const ref = doc(db, getTreesPath(), currentTreeId.value);
          const existing = await getDoc(ref);
          if (!existing.exists()) await saveToCloud(true);
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

      const shareSubTree = async () => {
        if (!selectedMemberId.value || selectedMemberId.value === 'root') return showToastMsg('서브 트리를 공유하려면 먼저 멤버를 선택하세요.', 'error');
        const trimmedEmail = (subTreeShareInput.email || '').trim().toLowerCase();
        if (!trimmedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) return showToastMsg('올바른 이메일을 입력하세요.', 'error');
        if (currentUser.value.email && trimmedEmail === currentUser.value.email.toLowerCase()) return showToastMsg('본인 이메일은 추가할 수 없습니다.', 'error');

        try {
          const subRoot = members.value.find(m => m.id === selectedMemberId.value);
          if (!subRoot) return showToastMsg('멤버를 찾을 수 없습니다.', 'error');

          const topPath = getTreesPath();
          const col = collection(db, topPath);
          const existingSnap = await getDocs(query(col, 
            where('parentTreeId', '==', currentTreeId.value),
            where('subTreeRootMemberId', '==', selectedMemberId.value),
            where('ownerId', '==', currentUser.value.uid)
          ));

          if (!existingSnap.empty) {
            const existingTree = existingSnap.docs[0];
            const existingData = existingTree.data();
            const existingEmails = new Set(existingData.sharedEmails || []);
            
            if (existingEmails.has(trimmedEmail)) return showToastMsg('이미 이 사용자에게 공유된 서브 트리입니다.', 'error');

            existingEmails.add(trimmedEmail);
            const perms = { ...(existingData.sharePermissions || {}) };
            perms[trimmedEmail] = { role: subTreeShareInput.role || 'editor', scope: 'subtree' };

            const updatePayload = { sharedEmails: Array.from(existingEmails), sharePermissions: perms };
            // 기존 대표 이메일이 없으면 현재 추가되는 이메일을 대표로 자동 설정
            if (!existingData.primaryShareEmail) {
              updatePayload.primaryShareEmail = trimmedEmail;
              if (subRoot) subRoot.email = trimmedEmail;
            }
            await updateDoc(doc(db, topPath, existingTree.id), updatePayload);

            showToastMsg(`🔗 기존 ${subRoot.name} 서브 트리에 ${trimmedEmail}님이 추가되었습니다!`);
            showSubTreeShareModal.value = false;
            subTreeShareInput.email = '';
            await fetchSubTreeForSelectedMember();
            return;
          }

          const ids = new Set();
          function collectSubtree(id) {
            ids.add(id);
            members.value.filter(m => m.parentId === id).forEach(m => collectSubtree(m.id));
          }
          collectSubtree(selectedMemberId.value);

          const subMembers = members.value.filter(m => ids.has(m.id)).map(m => 
            m.id === selectedMemberId.value ? { ...m, parentId: null } : { ...m }
          );

          const subRecruits = subTreeShareInput.includeData ? recruits.value.filter(r => {
            const linkedMember = members.value.find(m => m.recruitId === r.id);
            return linkedMember && ids.has(linkedMember.id);
          }) : [];

          const subAppointments = subTreeShareInput.includeData ? appointments.value.filter(apt => {
            if (apt.type === '이벤트') return true; 
            const subMemberNames = new Set(subMembers.map(m => m.name));
            const hasTargetInSubtree = apt.targetName && subMemberNames.has(apt.targetName);
            const hasAttendeeInSubtree = apt.attendees && apt.attendees.some(name => subMemberNames.has(name));
            const hasCreatorInSubtree = apt.createdBy && subMemberNames.has(apt.createdBy);
            return hasTargetInSubtree || hasAttendeeInSubtree || hasCreatorInSubtree;
          }) : [];

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
              notes: [], 
              recruits: JSON.parse(JSON.stringify(subRecruits)),
              appointments: JSON.parse(JSON.stringify(subAppointments)),
              recruitPosition: recruitPosition.value, notesPosition: notesPosition.value, memberInfoPosition: memberInfoPosition.value, appointmentPosition: appointmentPosition.value,
              nodeWidth: nodeWidth.value, nodeBaseHeight: nodeBaseHeight.value, nodeFontSize: nodeFontSize.value, nodeLineGap: nodeLineGap.value, notePanelWidth: notePanelWidth.value,
              legendConfig: JSON.parse(JSON.stringify(legendConfig.value))
            },
            ownerId: currentUser.value.uid, ownerEmail: currentUser.value.email || '',
            sharedEmails: [trimmedEmail],
            sharePermissions: { [trimmedEmail]: { role: subTreeShareInput.role || 'editor', scope: 'subtree' } },
            primaryShareEmail: trimmedEmail,
            isSubTree: true, parentTreeId: currentTreeId.value, subTreeRootMemberId: selectedMemberId.value, subTreeRootMemberName: subRoot.name
          };

          const ref = doc(db, getTreesPath(), newTreeId);
          await setDoc(ref, sharedTreeData);

          // 첫 공유이므로 멤버의 실효 이메일을 대표 이메일로 동기화
          if (subRoot) subRoot.email = trimmedEmail;

          showToastMsg(`🔗 ${subRoot.name} 서브 트리가 ${trimmedEmail}님에게 공유되었습니다!`);
          showSubTreeShareModal.value = false;
          subTreeShareInput.email = ''; subTreeShareInput.role = 'editor'; subTreeShareInput.includeData = true;
          await fetchSubTreeForSelectedMember();
        } catch (e) { console.error(e); showToastMsg('서브 트리 공유 실패', 'error'); }
      };

      const openSubTreeShareModal = () => {
        if (!selectedMemberId.value || selectedMemberId.value === 'root') return showToastMsg('서브 트리를 공유하려면 먼저 root가 아닌 멤버를 선택하세요.', 'error');
        showSubTreeShareModal.value = true;
      };

      // ── 선택된 멤버에 대응되는 서브 트리 공유 정보 조회/관리 ──
      const fetchSubTreeForSelectedMember = async () => {
        subTreeSharesForSelected.value = { treeId: null, sharedEmails: [], sharePermissions: {}, primaryEmail: '' };
        if (!selectedMemberId.value || selectedMemberId.value === 'root') return;
        if (!currentTreeId.value || !currentUser.value) return;
        try {
          const topPath = getTreesPath();
          const col = collection(db, topPath);
          const snap = await getDocs(query(col,
            where('parentTreeId', '==', currentTreeId.value),
            where('subTreeRootMemberId', '==', selectedMemberId.value),
            where('ownerId', '==', currentUser.value.uid)
          ));
          if (snap.empty) return;
          const d = snap.docs[0];
          const data = d.data();
          const emails = Array.isArray(data.sharedEmails) ? data.sharedEmails : [];
          subTreeSharesForSelected.value = {
            treeId: d.id,
            sharedEmails: emails,
            sharePermissions: data.sharePermissions || {},
            primaryEmail: data.primaryShareEmail || emails[0] || ''
          };
        } catch (e) { console.error('[fetchSubTreeForSelectedMember] failed', e); }
      };

      const removeSubTreeSharee = async (email) => {
        const info = subTreeSharesForSelected.value;
        if (!info.treeId) return;
        if (!confirm(`${email} 님의 공유를 해제하시겠습니까?`)) return;
        try {
          const topPath = getTreesPath();
          const refDoc = doc(db, topPath, info.treeId);
          const snap = await getDoc(refDoc);
          if (!snap.exists()) return;
          const data = snap.data();
          const newEmails = (data.sharedEmails || []).filter(e => e !== email);
          const newPerms = { ...(data.sharePermissions || {}) };
          delete newPerms[email];
          let newPrimary = data.primaryShareEmail || '';
          if (newPrimary === email || !newPrimary) newPrimary = newEmails[0] || '';
          await updateDoc(refDoc, {
            sharedEmails: newEmails,
            sharePermissions: newPerms,
            primaryShareEmail: newPrimary
          });
          // 멤버 이메일도 대표 이메일로 동기화
          const m = members.value.find(x => x.id === selectedMemberId.value);
          if (m) m.email = newPrimary;
          showToastMsg(`${email} 님의 공유가 해제되었습니다.`);
          await fetchSubTreeForSelectedMember();
          if (newEmails.length === 0) {
            // 공유 대상이 아무도 없으면 서브 트리 문서 자체 삭제 (권한: 소유자만)
            try { await deleteDoc(refDoc); } catch (_) {}
          }
        } catch (e) { console.error(e); showToastMsg('공유 해제 실패', 'error'); }
      };

      const setSubTreeShareePrimary = async (email) => {
        const info = subTreeSharesForSelected.value;
        if (!info.treeId) return;
        try {
          const topPath = getTreesPath();
          const refDoc = doc(db, topPath, info.treeId);
          await updateDoc(refDoc, { primaryShareEmail: email });
          // 멤버 이메일도 대표 이메일로 동기화
          const m = members.value.find(x => x.id === selectedMemberId.value);
          if (m) m.email = email;
          showToastMsg(`${email} 이(가) 대표 이메일로 설정되었습니다.`);
          await fetchSubTreeForSelectedMember();
        } catch (e) { console.error(e); showToastMsg('대표 이메일 설정 실패', 'error'); }
      };

      // 우측 패널 등에서 표시할 "멤버의 실효 이메일"
      //  - 해당 멤버에 대한 서브 트리 공유가 있으면 대표 이메일
      //  - 없으면 멤버 레코드에 저장된 이메일
      const selectedMemberEffectiveEmail = computed(() => {
        const s = subTreeSharesForSelected.value;
        if (s && s.primaryEmail) return s.primaryEmail;
        if (s && s.sharedEmails && s.sharedEmails.length) return s.sharedEmails[0];
        return (selectedMember.value && selectedMember.value.email) || '';
      });

      const currentIsOwner = computed(() => !!(currentTreeMeta.value && currentUser.value && currentTreeMeta.value.ownerId === currentUser.value.uid));
      const currentIsEditor = computed(() => {
        if (currentIsOwner.value) return true;
        const m = currentTreeMeta.value;
        if (!m || !currentUser.value) return false;
        const key = (currentUser.value.email || '').toLowerCase();
        const p = (m.sharePermissions || {})[key];
        return !!(p && p.role === 'editor');
      });
      const currentIsReadOnly = computed(() => !!currentTreeId.value && !currentIsEditor.value);

      // ── 신원(identity) 계산: 접속한 사용자에 대응되는 멤버 ──
      const meMember = computed(() => {
        const myEmail = (currentUser.value?.email || '').toLowerCase();
        // 1) 서브 트리에서는 공유받은 모든 사용자가 "서브 트리 루트" 관점으로 동일하게 보이도록
        //    루트 멤버를 "본인"으로 간주한다. (여러 사람에게 공유되었을 때 표시 일관성 확보)
        //    예) 김은숙 서브 트리를 김은숙 본인/박철수/다른 하위 누구에게 공유하더라도
        //        모두 메인 트리에서 '김은숙'을 클릭했을 때와 동일한 약속·메모가 보임.
        if (currentTreeMeta.value && currentTreeMeta.value.isSubTree) {
          return rootMember.value || null;
        }
        // 2) 트리 내에서 이메일이 일치하는 멤버
        if (myEmail) {
          const byEmail = members.value.find(m => (m.email || '').toLowerCase() === myEmail);
          if (byEmail) return byEmail;
        }
        // 3) 트리 소유자(=본인)인 경우 root 멤버
        if (currentTreeMeta.value && currentUser.value && currentTreeMeta.value.ownerId === currentUser.value.uid) {
          return rootMember.value || null;
        }
        // 4) 로컬(클라우드 미저장) 상태일 땐 root가 본인
        if (!currentTreeId.value) return rootMember.value || null;
        return null;
      });
      const meName = computed(() => meMember.value?.name || '');
      const meSubtreeIds = computed(() => {
        const me = meMember.value;
        if (!me) return new Set();
        const ids = new Set();
        const collect = (id) => {
          ids.add(id);
          members.value.filter(m => m.parentId === id).forEach(m => collect(m.id));
        };
        collect(me.id);
        return ids;
      });
      const meSubtreeNames = computed(() => {
        const ids = meSubtreeIds.value;
        return new Set(members.value.filter(m => ids.has(m.id)).map(m => m.name));
      });

      // ── 선택된 멤버의 상위 체인에서 FD/SFD/DD/EFD 각 직책을 가진 가장 가까운 조상을 찾음 ──
      // "바로 위 상위가 FD가 아니라면 더 위로 올라가서 FD를 찾는다" 로직
      // 조상에 해당 직책이 없으면 트리의 header 값(= 최상위 소유자 기준)으로 대체.
      const selectedUpline = computed(() => {
        const out = { fd: '', sfd: '', dd: '', efd: '' };
        const sid = selectedMemberId.value;
        if (!sid || sid === 'root') return out;
        const findNearest = (startId, status) => {
          let cur = members.value.find(m => m.id === startId);
          // 자신은 제외하고 상위부터
          cur = cur ? members.value.find(m => m.id === cur.parentId) : null;
          while (cur) {
            if ((cur.status || '') === status) return cur.name || '';
            cur = members.value.find(m => m.id === cur.parentId);
          }
          return '';
        };
        out.fd  = findNearest(sid, 'FD')  || header.fd  || '';
        out.sfd = findNearest(sid, 'SFD') || header.sfd || '';
        out.dd  = findNearest(sid, 'DD')  || header.dd  || '';
        out.efd = findNearest(sid, 'EFD') || header.efd || '';
        return out;
      });

      // ── 현재 뷰에 표시할 헤더 (root 선택시 트리의 header, 서브 선택시 해당 멤버 기준) ──
      const viewHeader = computed(() => {
        const sid = selectedMemberId.value;
        if (!sid || sid === 'root') return header;
        const m = members.value.find(x => x.id === sid);
        if (!m) return header;
        const up = selectedUpline.value;
        return {
          title: header.title || '',
          id: m.id || '',
          rank: m.status || '',
          periodStart: header.periodStart || '',
          periodEnd: header.periodEnd || '',
          asOf: header.asOf || '',
          fd: up.fd,
          sfd: up.sfd,
          dd: up.dd,
          efd: up.efd
        };
      });
      const selectedIsRootView = computed(() => !selectedMemberId.value || selectedMemberId.value === 'root');

      // ── 핵심 필터링 로직 (선택된 멤버 기준 뷰) ──
      const tabContext = computed(() => {
        const myEmail = (currentUser.value?.email || '').toLowerCase();
        const myName = meName.value;
        const myDownlineIds = meSubtreeIds.value;
        const myDownlineNames = meSubtreeNames.value;

        // 약속(이벤트 제외) 가시성: 본인 혹은 본인 이하가 포함된 약속만 보임
        // 작성자(createdBy)도 자동으로 참석자로 인식
        const apptIncludesMeOrDownline = (a) => {
          if (!myName) return false;
          const names = new Set([...(a.attendees || []), a.targetName, a.createdBy].filter(Boolean));
          for (const n of names) if (myDownlineNames.has(n)) return true;
          return false;
        };
        // 메모 가시성: scope=all(전체) 또는 작성자 본인(이메일/이름 일치)
        const noteVisible = (n) => {
          if (!n) return false;
          if (n.scope === 'all' || !n.scope) return true;
          const byEmail = (n.createdByEmail || '').toLowerCase();
          if (byEmail && myEmail && byEmail === myEmail) return true;
          if (n.createdBy && myName && n.createdBy === myName) return true;
          return false;
        };

        if (!selectedMemberId.value || selectedMemberId.value === 'root') {
           // 메인 뷰: 멤버 전체, 리크룻 전체(작성자 이름 표시), 이벤트+본인포함 약속, 메모는 전체+본인 개인메모
           return {
             members: members.value,
             recruits: recruits.value, // 메인에서는 전부 보이되 화면에서 '작성자' 표시로 구분
             appointments: appointments.value.filter(a => {
               if (a.type === '이벤트') return true;
               return apptIncludesMeOrDownline(a);
             }),
             notes: notes.value.filter(noteVisible)
           };
        }

        // 서브 뷰: 선택된 멤버와 그 하위만
        const ids = new Set();
        const collect = (id) => {
           ids.add(id);
           members.value.filter(m => m.parentId === id).forEach(m => collect(m.id));
        };
        collect(selectedMemberId.value);

        const selectedName = members.value.find(m => m.id === selectedMemberId.value)?.name || '';
        const selectedNames = new Set(members.value.filter(m => ids.has(m.id)).map(m => m.name));

        return {
           members: members.value.filter(m => ids.has(m.id)),
           recruits: recruits.value.filter(r => {
               // 작성자 이름이 선택된 멤버이거나, parentId가 서브트리 내인 경우에만
               if (r.createdBy && r.createdBy === selectedName) return true;
               if (r.parentId && ids.has(r.parentId)) return true;
               const linked = members.value.find(m => m.recruitId === r.id);
               if (linked && ids.has(linked.id)) return true;
               return false;
           }),
           appointments: appointments.value.filter(a => {
               // 이벤트, 약속 모두: 서브트리 멤버가 참여하는 모든 것을 표시
               // 작성자, 대상자, 참석자 중 하나라도 서브트리에 속하면 표시
               if (a.createdBy && selectedNames.has(a.createdBy)) return true;
               if (a.targetName && selectedNames.has(a.targetName)) return true;
               if ((a.attendees || []).some(n => selectedNames.has(n))) return true;
               
               return false;
           }),
           notes: notes.value.filter(n => {
               if (!noteVisible(n)) return false;
               // 서브 뷰에서는 선택된 멤버 영역의 메모만
               if (n.scope === 'all' && (!n.createdBy || selectedNames.has(n.createdBy))) return true;
               if (n.createdBy && selectedNames.has(n.createdBy)) return true;
               return false;
           })
        };
      });

      const tabMembers = computed(() => tabContext.value.members);
      const tabRecruitsSorted = computed(() => [...tabContext.value.recruits].sort((a,b)=>(b.score||0)-(a.score||0)));
      const tabNotes = computed(() => tabContext.value.notes || notes.value);
      const tabUpcomingAppointments = computed(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        return tabContext.value.appointments.filter(a => {
            const d = new Date(a.date.replace(/[-./]/g, '/'));
            return d >= today;
        }).sort((a,b) => new Date(a.date.replace(/[-./]/g, '/')) - new Date(b.date.replace(/[-./]/g, '/')));
      });
      // 사이드바 디스플레이 패널에 보여줄 약속: 확인(confirmed)된 항목은 숨김
      const visibleSidebarAppointments = computed(() => {
        return tabUpcomingAppointments.value.filter(a => !a.confirmed);
      });

      const availableStatuses = computed(() => STATUSES.filter(s => legendConfig.value.items[s] && legendConfig.value.items[s].show));
      const PAGE_W_PX = computed(() => printLandscape.value ? 979 : 739);
      const PAGE_H_PX = computed(() => printLandscape.value ? 700 : 979);
      const previewScale = computed(() => Math.min((window.innerWidth-80)/PAGE_W_PX.value, (window.innerHeight-100)/PAGE_H_PX.value, 1));
      const previewPageStyle = computed(() => ({ width:PAGE_W_PX.value*previewScale.value+'px', height:PAGE_H_PX.value*previewScale.value+'px', overflow:'hidden' }));
      const previewFrameStyle = computed(() => ({ width:PAGE_W_PX.value+'px', height:PAGE_H_PX.value+'px', transform:`scale(${previewScale.value})`, transformOrigin:'0 0' }));
      const panTransform = computed(() => `translate(${panX.value}px,${panY.value}px)`);
      
      const focusedList = computed(() => {
        if (!focusRootId.value) return members.value;
        const ids = new Set();
        function col(id){ ids.add(id); members.value.filter(m=>m.parentId===id).forEach(m=>col(m.id)); }
        col(focusRootId.value);
        return members.value.filter(m=>ids.has(m.id)).map(m=>m.id===focusRootId.value ? {...m,parentId:null} : m);
      });
      
      // focusRootId가 설정된 경우 서브트리 멤버 ID 세트
      const focusedMemberIds = computed(() => {
        if (!focusRootId.value) return null;
        const ids = new Set();
        function col(id){ ids.add(id); members.value.filter(m=>m.parentId===id).forEach(m=>col(m.id)); }
        col(focusRootId.value);
        return ids;
      });
      
      const rootMember = computed(() => focusedList.value.find(m=>!m.parentId));
      const rootMemberName = computed(() => rootMember.value ? rootMember.value.name : '');
      const rootMemberEmail = computed(() => rootMember.value ? (rootMember.value.email || '') : '');
      const currentMembers = computed(() => focusRootId.value ? focusedList.value : members.value);
      
      // 포커스된 서브트리에 속한 리크루트만 필터링
      const recruitsSortedAll = computed(() => {
        let filtered = recruits.value;
        
        // focusRootId가 설정되어 있으면 해당 서브트리에 연결된 리크루트만
        if (focusedMemberIds.value) {
          filtered = recruits.value.filter(r => {
            // 리크루트와 연결된 멤버 찾기
            const linkedMember = members.value.find(m => m.recruitId === r.id);
            return linkedMember && focusedMemberIds.value.has(linkedMember.id);
          });
        }
        
        return [...filtered].sort((a,b)=>(b.score||0)-(a.score||0));
      });
      const visibleRecruits = computed(() => recruitsSortedAll.value.filter(r=>r.show));
      
      const selectedMember = computed(() => members.value.find(m => m.id === selectedMemberId.value));
      const memberNames = computed(() => members.value.map(m => m.name));
      const recruitNames = computed(() => recruits.value.map(r => r.name));

      const uplineMemberNames = computed(() => {
          const names = [header.fd, header.sfd, header.dd, header.efd].map(n => (n || '').trim()).filter(Boolean);
          return [...new Set(names)].filter(n => !memberNames.value.includes(n));
      });

      const apptMemberNames = computed(() => { return [...new Set([...memberNames.value, ...uplineMemberNames.value])]; });
      const allPersonNames = computed(() => { return [...new Set([...apptMemberNames.value, ...recruitNames.value])]; });

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
        const c = {}; STATUSES.forEach(s => c[s] = 0);
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
                  const dispKeys = ['relationScore', 'market', 'married', 'child', 'house', 'income', 'ambition', 'dissatisfied', 'pma', 'entrepreneur', 'prejudice'];
                  dispKeys.forEach(k => { if(m.disposition[k] !== r.disposition[k]) m.disposition[k] = r.disposition[k]; });
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
                      m.recruitId = existingRecruit.id; existingRecruit.score = m.score || (m.status === 'Serious' ? 75 : 60);
                  } else {
                      const newRId = 'r' + Date.now() + Math.random().toString(36).substring(2,7);
                      m.recruitId = newRId;
                      recruits.value.push({ id: newRId, name: m.name, major: m.major || '', job: m.job || '', company: m.company || '', relation: m.relation || '', meetDate: m.meetDate || '', period: '', gender: m.gender || '남', score: m.score || (m.status === 'Serious' ? 75 : 60), birthDate: m.birthDate || '', age: m.age || '', show: true, interactionHistory: [...(m.interactionHistory || [])], disposition: m.disposition ? JSON.parse(JSON.stringify(m.disposition)) : defaultDisposition() });
                  }
              } else if (!isPotentialOrSerious && m.recruitId) {
                  // Member no longer Potential/Serious: disconnect link only, keep recruit
                  m.recruitId = null;
              }

              if(m.recruitId) {
                  const r = recruits.value.find(x => x.id === m.recruitId);
                  if(r) {
                      if(r.name !== m.name) r.name = m.name; if(r.major !== m.major) r.major = m.major; if(r.job !== m.job) r.job = m.job; if(r.company !== m.company) r.company = m.company; if(r.relation !== m.relation) r.relation = m.relation; if(r.meetDate !== m.meetDate) r.meetDate = m.meetDate; if(r.birthDate !== m.birthDate) r.birthDate = m.birthDate; if(r.age !== m.age) r.age = m.age; if(r.gender !== m.gender) r.gender = m.gender; if(r.score !== m.score) r.score = m.score;
                      if (!m.disposition) m.disposition = defaultDisposition(); if (!r.disposition) r.disposition = defaultDisposition();
                      const dispKeys = ['relationScore', 'market', 'married', 'child', 'house', 'income', 'ambition', 'dissatisfied', 'pma', 'entrepreneur', 'prejudice'];
                      dispKeys.forEach(k => { if(r.disposition[k] !== m.disposition[k]) r.disposition[k] = m.disposition[k]; });
                  }
              }
          });
          setTimeout(() => { syncLock = false; }, 100);
      }, { deep: true });

      function showToastMsg(msg,type='success'){ if(toastTimer)clearTimeout(toastTimer); toast.msg=msg; toast.type=type; toast.visible=true; toastTimer=setTimeout(()=>toast.visible=false,2200); }
      function getToastClass(){ return [toast.type, toast.visible?'':'hidden']; }
      function getSaveStatusClass(){ return isDirty.value?'unsaved':'saved'; }
      function getSaveStatusText(){ return isDirty.value?'저장 안 됨':'자동저장 완료'; }
      function fmt(n){ return Number(n||0).toLocaleString(); }
      function fmtS(n){ if(!n&&n!==0) return '-'; return Number(n).toLocaleString(); }
      function parseDateForSort(dStr){
        if(!dStr) return 0; let d = dStr.trim(); if(d.length === 4 && !isNaN(d)) d += '/01/01';
        const parts=d.split(/[-/]/); if(parts.length<2) return 0;
        let m=parseInt(parts[0],10), day=parseInt(parts[1],10), y=parts.length>2?parseInt(parts[2],10):new Date().getFullYear();
        if(y<100) y+=2000; return new Date(y,m-1,day).getTime();
      }
      function sortedPointHistory(m) { if(!m || !m.history) return []; return [...m.history].sort((a,b) => parseDateForSort(b.date) - parseDateForSort(a.date)); }
      function sortedInteractionHistory(m) { if(!m || !m.interactionHistory) return []; return [...m.interactionHistory].sort((a,b) => parseDateForSort(b.date) - parseDateForSort(a.date)); }
      function calcAge(birthDateStr){
        if(!birthDateStr) return ''; let dStr = birthDateStr.trim(); if(dStr.length === 4 && !isNaN(dStr)) dStr += '-01-01'; 
        const b=new Date(dStr.replace(/[./]/g,'-')); if(isNaN(b.getTime())) return '';
        const today=new Date(); let age=today.getFullYear()-b.getFullYear();
        const mo=today.getMonth()-b.getMonth(); if(mo<0||(mo===0&&today.getDate()<b.getDate())) age--; return age>=0?age:0;
      }
      function calcPeriod(dateStr,legacyPeriod){
        if(!dateStr) return legacyPeriod||''; let dStr = dateStr.trim(); if(dStr.length === 4 && !isNaN(dStr)) dStr += '-01'; 
        const p=dStr.split(/[-./]/); if(p.length<1) return legacyPeriod||'';
        const start=new Date(parseInt(p[0],10), p.length >= 2 ? parseInt(p[1],10)-1 : 0); if(isNaN(start.getTime())) return legacyPeriod||'';
        const now=new Date(); let mDiff=(now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth());
        if(mDiff<0) return '미래'; if(mDiff===0) return '1개월 미만'; const y=Math.floor(mDiff/12), mo=mDiff%12; return (y>0&&mo>0)?`${y}년 ${mo}개월`:(y>0?`${y}년`:`${mo}개월`);
      }
      function getMemberIssuePaid(m){ if(!m.history) return 0; return m.history.filter(h=>h.show&&h.type==='Issue Paid').reduce((s,h)=>s+(Number(h.amount)||0),0); }
      function getMemberPending(m){ if(!m.history) return 0; return m.history.filter(h=>h.show&&h.type==='Pending').reduce((s,h)=>s+(Number(h.amount)||0),0); }
      function mPtsSum(m){ if(!m.history) return 0; return m.history.filter(h=>h.show).reduce((s,h)=>s+(Number(h.point)||0),0); }
      function updateRootMemberName(e){ if(rootMember.value) rootMember.value.name=e.target.value; }
      function updateRootMemberEmail(e){ if(rootMember.value) rootMember.value.email=e.target.value; }
      function setRootEmailToLoginIfEmpty() {
          if (!rootMember.value) return; const loginEmail = currentUser.value && currentUser.value.email; if (!loginEmail) return;
          if (!rootMember.value.email || !String(rootMember.value.email).trim() || rootMember.value.email === 'example@gmail.com') { rootMember.value.email = loginEmail; }
      }
      function setFocus(id){ focusRootId.value=id; zoomLevel.value=1; nextTick(centerTree); }
      function clearFocus(){ focusRootId.value=null; zoomLevel.value=1; nextTick(centerTree); }
      function toggleFocus(id){ if(focusRootId.value===id) clearFocus(); else setFocus(id); }
      function nodeNoteLines(m){
        if(!m.history) return [];
        return m.history.filter(h=>h.show).sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date)).reduce((acc, h) => {
            let val = h.content || ''; acc.push({ text: h.date ? `[${h.date}] ${val}` : val, isExtra: false });
            let extras=[]; if(Number(h.amount)) extras.push(`$${fmt(h.amount)}`); if(Number(h.point)) extras.push(`${fmt(h.point)} Pts`);
            if(extras.length) acc.push({ text: extras.join(' | '), isExtra: true }); return acc;
          }, []).slice(0,5); 
      }
      function nodeH(m){ 
        const base = Math.max(nodeBaseHeight.value, nodeFontSize.value + 14 + nodeLineGap.value * 2 + 10);
        const notesCount = nodeNoteLines(m).length; if(notesCount === 0) return base; return (nodeFontSize.value + 14 + nodeLineGap.value * 2 + 6) + 8 + (notesCount * nodeLineGap.value) + 6; 
      }
      function getRawMemberTotal(m) { return getMemberIssuePaid(m) + getMemberPending(m); }
      function getMemberTotal(m) { return fmt(getRawMemberTotal(m)); }
      function getIncomePercent(m) { const mTotal = getRawMemberTotal(m); const tTotal = teamTotal.value.total; if (tTotal === 0 || mTotal === 0) return 0; return Math.min(100, Math.max(0, (mTotal / tTotal) * 100)); }
      function fmtApptDateShort(dStr){
        if(!dStr) return ''; const parts = String(dStr).split(/[-./]/).map(s => s.trim()).filter(Boolean); if (parts.length < 2) return dStr;
        let m, d; if (parts[0].length === 4) { m = parseInt(parts[1], 10); d = parseInt(parts[2] || '1', 10); } else { m = parseInt(parts[0], 10); d = parseInt(parts[1], 10); }
        if (isNaN(m) || isNaN(d)) return dStr; return `${m}/${d}`;
      }
      function getPointHistPct(m, h){
        if (!m || !h || !m.history) return 0; const visible = m.history.filter(x => x.show);
        if (Number(h.amount) > 0) { const tot = visible.reduce((s,x) => s + (Number(x.amount) || 0), 0); if (tot > 0) return Math.min(100, (Number(h.amount) / tot) * 100); }
        if (Number(h.point) > 0) { const tot = visible.reduce((s,x) => s + (Number(x.point) || 0), 0); if (tot > 0) return Math.min(100, (Number(h.point) / tot) * 100); }
        return 0;
      }
      function calcDisposition(item, isRecruit) {
          if (!item.disposition) return; let total = 0; total += parseInt(item.disposition.relationScore) || 0;
          if (item.disposition.market === 'L') total += 10; else if (item.disposition.market === 'M') total += 8; else if (item.disposition.market === 'S') total += 6;
          ['married', 'child', 'house', 'income', 'ambition', 'dissatisfied', 'pma', 'entrepreneur'].forEach(k => { if (item.disposition[k]) total += 10; });
          total -= parseInt(item.disposition.prejudice) || 0;
          item.score = Math.min(100, Math.max(0, total)); onScoreChange(item, isRecruit);
      }
      function zoomIn(){ zoomLevel.value=Math.min(3,+(zoomLevel.value+0.15).toFixed(2)); }
      function zoomOut(){ zoomLevel.value=Math.max(0.2,+(zoomLevel.value-0.15).toFixed(2)); }
      function zoomReset(){ zoomLevel.value=1; centerTree(); }
      function onWheel(e){ zoomLevel.value=Math.min(3,Math.max(0.2,+(zoomLevel.value+(e.deltaY>0?-0.1:0.1)).toFixed(2))); }
      function onPanStart(e){ if(e.button!==0)return; isPanning=true; panStartX=e.clientX; panStartY=e.clientY; panStartPX=panX.value; panStartPY=panY.value; e.currentTarget.classList.add('panning'); }
      function onPanMove(e){ if(!isPanning)return; panX.value = panStartPX + (e.clientX - panStartX); panY.value = panStartPY + (e.clientY - panStartY); }
      function onPanEnd(e){ isPanning=false; if(e.currentTarget) e.currentTarget.classList.remove('panning'); }
      function centerTree(){ nextTick(()=>{ const wrap=document.getElementById('tree-svg-container'); if(!wrap)return; const svgW = layout.value.totalWidth * zoomLevel.value; const svgH = layout.value.totalHeight * zoomLevel.value; panX.value = Math.max(16,(wrap.clientWidth-svgW)/2); panY.value = Math.max(16,(wrap.clientHeight-svgH)/2); }); }
      function addMember(){
        if(!nm.name.trim()) return;
        const newId = 'm'+Date.now();
        members.value.push({ id:newId, recruitId: null, name:nm.name.trim(), email:(nm.email||'').trim(), major:nm.major.trim(), job:nm.job.trim(), company:nm.company.trim(), status:nm.status, parentId:nm.parentId, history:[], interactionHistory:[], issuePaid:0, pending:0, birthDate:nm.birthDate, age:nm.age, meetDate:nm.meetDate, relation:nm.relation, gender:nm.gender, score:nm.score, disposition: defaultDisposition() });
        nm.name=''; nm.email=''; nm.major=''; nm.job=''; nm.company=''; nm.birthDate=''; nm.age=''; nm.meetDate=''; nm.relation=''; nm.gender='남'; nm.score=0;
        showToastMsg(`✅ 멤버가 추가되었습니다.`);
      }
      function removeMember(id){
        if(focusRootId.value===id) clearFocus();
        const m=members.value.find(x=>x.id===id); if(!m||!m.parentId)return;
        // Potential/Serious 멤버 삭제 시 연결된 Recruit도 함께 삭제 (양방향 동기화)
        const hadLinkedRecruit = !!m.recruitId;
        if (m.recruitId) {
          recruits.value = recruits.value.filter(r => r.id !== m.recruitId);
        }
        members.value.forEach(x=>{ if(x.parentId===id) x.parentId=m.parentId; });
        members.value=members.value.filter(x=>x.id!==id);
        if(selectedMemberId.value===id) selectedMemberId.value='root';
        if(expandedMemberId.value===id) expandedMemberId.value=null; if(expandedInteractionId.value===id) expandedInteractionId.value=null; if(expandedDispositionId.value===id) expandedDispositionId.value=null;
        if (hadLinkedRecruit) showToastMsg(`[${m.name}]님이 멤버와 Recruit 리스트에서 모두 삭제되었습니다.`);
      }
      function parentOpts(ex){
        const excludeIds=new Set([ex]); const chMap={}; members.value.forEach(m=>chMap[m.id]=[]);
        members.value.forEach(m=>{ if(m.parentId&&chMap[m.parentId]) chMap[m.parentId].push(m.id); });
        function getDesc(id){ (chMap[id]||[]).forEach(cid=>{excludeIds.add(cid);getDesc(cid);}); } getDesc(ex);
        return members.value.filter(m=>!excludeIds.has(m.id));
      }
      function toggleHistoryPanel(id){ expandedMemberId.value = expandedMemberId.value===id ? null : id; newHist.date=''; newHist.content=''; newHist.point=null; newHist.amount=null; newHist.type='History'; }
      function toggleInteractionPanel(id){ expandedDispositionId.value = null; expandedInteractionId.value = expandedInteractionId.value===id ? null : id; newInteraction.date=''; newInteraction.content=''; }
      function toggleDispositionPanel(id){ expandedInteractionId.value = null; expandedDispositionId.value = expandedDispositionId.value===id ? null : id; }
      function toggleRecruitInteractionPanel(id){ expandedRecruitDispositionId.value = null; expandedRecruitInteractionId.value = expandedRecruitInteractionId.value===id ? null : id; newRecruitInteraction.date=''; newRecruitInteraction.content=''; }
      function toggleRecruitDispositionPanel(id){ expandedRecruitInteractionId.value = null; expandedRecruitDispositionId.value = expandedRecruitDispositionId.value===id ? null : id; }
      function addHistoryItem(memberId){
        if(!newHist.content.trim()&&!newHist.point&&!newHist.amount) return; const m=members.value.find(x=>x.id===memberId); if(!m)return;
        if(!m.history) m.history=[]; const today=new Date(); const d=`${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        m.history.push({ id:'h'+Date.now(), date:newHist.date||d, type:newHist.type, content:newHist.content.trim(), point:Number(newHist.point)||0, amount:['Issue Paid','Pending'].includes(newHist.type)?(Number(newHist.amount)||0):0, show:true });
        m.history = [...m.history]; newHist.date=''; newHist.content=''; newHist.point=null; newHist.amount=null;
      }
      function removeHistoryItem(memberId,histId){ const m=members.value.find(x=>x.id===memberId); if(m) m.history=m.history.filter(h=>h.id!==histId); }
      function addInteractionItem(memberId) {
        if(!newInteraction.content.trim()) return; const m=members.value.find(x=>x.id===memberId); if(!m)return;
        if(!m.interactionHistory) m.interactionHistory=[]; const today=new Date(); const d=`${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        m.interactionHistory.push({ id: 'ih' + Date.now(), date: newInteraction.date || d, content: newInteraction.content.trim() });
        m.interactionHistory = [...m.interactionHistory];
        if(m.recruitId) { const r = recruits.value.find(x => x.id === m.recruitId); if(r) r.interactionHistory = [...m.interactionHistory]; }
        newInteraction.date = ''; newInteraction.content = '';
      }
      function removeInteractionItem(memberId, histId) {
        const m=members.value.find(x=>x.id===memberId); 
        if(m) { m.interactionHistory=m.interactionHistory.filter(h=>h.id!==histId); if(m.recruitId) { const r = recruits.value.find(x => x.id === m.recruitId); if(r) r.interactionHistory = r.interactionHistory.filter(h=>h.id!==histId); } }
      }
      function addRecruitInteractionItem(recruitId) {
        if(!newRecruitInteraction.content.trim()) return; const r=recruits.value.find(x=>x.id===recruitId); if(!r)return;
        if(!r.interactionHistory) r.interactionHistory=[]; const today=new Date(); const d=`${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        r.interactionHistory.push({ id: 'ih' + Date.now(), date: newRecruitInteraction.date || d, content: newRecruitInteraction.content.trim() });
        r.interactionHistory = [...r.interactionHistory]; const m=members.value.find(x=>x.recruitId===recruitId); if(m) m.interactionHistory = [...r.interactionHistory];
        newRecruitInteraction.date = ''; newRecruitInteraction.content = '';
      }
      function removeRecruitInteractionItem(recruitId, histId) {
        const r=recruits.value.find(x=>x.id===recruitId); if(r) { r.interactionHistory=r.interactionHistory.filter(h=>h.id!==histId); const m = members.value.find(x => x.recruitId === recruitId); if(m) m.interactionHistory = m.interactionHistory.filter(h=>h.id!==histId); }
      }
      function onRecruitInteractionChange(r) { r.interactionHistory = [...r.interactionHistory]; const m = members.value.find(x => x.recruitId === r.id); if(m) m.interactionHistory = [...r.interactionHistory]; }
      function onMemberInteractionChange(m) { m.interactionHistory = [...m.interactionHistory]; if(m.recruitId) { const r = recruits.value.find(x => x.id === m.recruitId); if(r) r.interactionHistory = [...m.interactionHistory]; } }
      function onScoreChange(item, isRecruit = true) {
          if (!item || item.score === undefined) return;
          
          const score = Number(item.score) || 0;
          let newStatus = null;
          
          // Automatic grade calculation based on score
          if (score >= 85) {
              newStatus = 'Serious';
          } else if (score >= 60) {
              newStatus = 'Potential';
          }
          
          if (isRecruit) {
              // For Recruit: Update recruit score and create/update linked member
              const linkedMember = members.value.find(m => m.recruitId === item.id);
              
              if (newStatus && linkedMember) {
                  // Update existing linked member's status and score
                  linkedMember.status = newStatus;
                  linkedMember.score = score;
              } else if (newStatus && !linkedMember) {
                  const pId = focusRootId.value || (members.value.find(m => !m.parentId)?.id) || null;
                  if (pId) {
                      const newMemberId = 'm' + Date.now() + Math.random().toString(36).substring(2, 7);
                      members.value.push({
                          id: newMemberId, recruitId: item.id, name: item.name, email: item.email || '',
                          major: item.major || '', job: item.job || '', company: item.company || '',
                          status: newStatus, parentId: pId, history: [],
                          interactionHistory: [...(item.interactionHistory || [])],
                          issuePaid: 0, pending: 0, birthDate: item.birthDate || '', age: item.age || '',
                          meetDate: item.meetDate || '', relation: item.relation || '',
                          gender: item.gender || '남', score: score,
                          disposition: item.disposition ? JSON.parse(JSON.stringify(item.disposition)) : defaultDisposition()
                      });
                  }
              } else if (!newStatus && linkedMember) {
                  // Score dropped below 60, remove member (keep recruit)
                  if (linkedMember.parentId) {
                      members.value.forEach(x => { if (x.parentId === linkedMember.id) x.parentId = linkedMember.parentId; });
                      members.value = members.value.filter(m => m.id !== linkedMember.id);
                      if (selectedMemberId.value === linkedMember.id) selectedMemberId.value = 'root';
                  }
              }
          } else {
              // For Member: Update member status and sync to linked recruit
              if (newStatus) {
                  item.status = newStatus;
                  if (item.recruitId) {
                      const r = recruits.value.find(x => x.id === item.recruitId);
                      if (r) r.score = score;
                  }
              } else if (!newStatus && ['Potential', 'Serious'].includes(item.status)) {
                  // Score dropped below 60: remove member from tree, keep recruit (same as recruit-side behavior)
                  if (item.parentId) {
                      members.value.forEach(x => { if (x.parentId === item.id) x.parentId = item.parentId; });
                      members.value = members.value.filter(m => m.id !== item.id);
                      if (selectedMemberId.value === item.id) selectedMemberId.value = 'root';
                      if (expandedMemberId.value === item.id) expandedMemberId.value = null;
                      if (expandedInteractionId.value === item.id) expandedInteractionId.value = null;
                      if (expandedDispositionId.value === item.id) expandedDispositionId.value = null;
                  }
              }
          }
      }
      function promoteRecruit(r) {
        const existingMemberIndex = members.value.findIndex(m => m.recruitId === r.id);
        const today = new Date(); const d = `${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        let targetMemberId = null;
        if (existingMemberIndex !== -1) {
            members.value[existingMemberIndex].recruitId = null; members.value[existingMemberIndex].status = 'New(Code-in)'; members.value[existingMemberIndex].interactionHistory.push({ id: 'ih' + Date.now(), date: d, content: '정식 멤버로 승급됨' }); targetMemberId = members.value[existingMemberIndex].id;
        } else {
            const pId = focusRootId.value || (members.value.find(m => !m.parentId)?.id) || null; if(!pId) { showToastMsg('상위 멤버가 없습니다.', 'error'); return; }
            targetMemberId = 'm' + Date.now();
            const mappedInteractions = (r.interactionHistory || []).map(h => ({ id: 'ih' + Date.now() + Math.random(), date: h.date, content: h.content })); mappedInteractions.push({ id: 'ih' + Date.now(), date: d, content: 'Recruit 리스트에서 정식 멤버로 승급됨' });
            members.value.push({ id: targetMemberId, recruitId: null, name: r.name, email: r.email || '', major: r.major || '', job: r.job || '', company: r.company || '', status: 'New(Code-in)', parentId: pId, history: [], interactionHistory: mappedInteractions, issuePaid: 0, pending: 0, birthDate: r.birthDate || '', age: r.age || '', meetDate: r.meetDate || '', relation: r.relation || '', gender: r.gender || '남', score: r.score, disposition: r.disposition ? JSON.parse(JSON.stringify(r.disposition)) : defaultDisposition() });
        }
        recruits.value = recruits.value.filter(x => x.id !== r.id); showToastMsg(`🎉 ${r.name}님이 정식 멤버로 승급되었습니다!`);
        selectedMemberId.value = targetMemberId; if(memberInfoPosition.value === 'none') memberInfoPosition.value = 'right'; if(tab.value !== 'members' && tab.value !== 'memberInfo') tab.value = 'memberInfo';
      }
      function addRecruit(){
        if(!newRecruit.name.trim()) return;
        const createdBy = meName.value || (selectedMemberId.value && selectedMemberId.value !== 'root'
          ? members.value.find(m => m.id === selectedMemberId.value)?.name
          : rootMember.value?.name || '');
        const createdByEmail = (currentUser.value?.email || '').toLowerCase();
        // parentId: 선택 시 우선, 아니면 작성자(본인) 멤버, 아니면 트리 루트
        const fallbackParentId = (meMember.value && meMember.value.id) || (members.value.find(m => !m.parentId)?.id) || 'root';
        const parentId = newRecruit.parentId || fallbackParentId;
        const now = new Date().toISOString();
        const newR={
          id:'r'+Date.now(),
          name:newRecruit.name.trim(),
          email:(newRecruit.email||'').trim(),
          major:newRecruit.major.trim(),
          job:newRecruit.job.trim(),
          company:newRecruit.company.trim(),
          relation:newRecruit.relation.trim(),
          meetDate:newRecruit.meetDate,
          period:'',
          gender:newRecruit.gender,
          score:newRecruit.score||0,
          birthDate:newRecruit.birthDate,
          age:newRecruit.age,
          show:true,
          interactionHistory:[], 
          disposition: defaultDisposition(), 
          createdBy, 
          createdByEmail, 
          parentId,
          createdAt: now,
          updatedAt: now
        }; 
        recruits.value.push(newR);
        newRecruit.name=''; newRecruit.email=''; newRecruit.major=''; newRecruit.job=''; newRecruit.company=''; newRecruit.relation=''; newRecruit.meetDate=''; newRecruit.gender='남'; newRecruit.score=50; newRecruit.birthDate=''; newRecruit.age=''; newRecruit.parentId='';
      }
      function removeRecruit(id){
        // Potential/Serious 멤버와 연결된 Recruit 삭제 시 연결된 멤버도 함께 삭제 (양방향 동기화)
        const linkedMember = members.value.find(m => m.recruitId === id);
        const recruitName = (recruits.value.find(r => r.id === id) || {}).name || '';
        if (linkedMember && linkedMember.parentId) {
          // 연결 멤버의 자식들을 부모로 재연결 후 멤버 삭제
          if (focusRootId.value === linkedMember.id) clearFocus();
          const parentId = linkedMember.parentId;
          members.value.forEach(x => { if (x.parentId === linkedMember.id) x.parentId = parentId; });
          members.value = members.value.filter(m => m.id !== linkedMember.id);
          if (selectedMemberId.value === linkedMember.id) selectedMemberId.value = 'root';
          if (expandedMemberId.value === linkedMember.id) expandedMemberId.value = null;
          if (expandedInteractionId.value === linkedMember.id) expandedInteractionId.value = null;
          if (expandedDispositionId.value === linkedMember.id) expandedDispositionId.value = null;
        }
        recruits.value = recruits.value.filter(r => r.id !== id);
        if (linkedMember) showToastMsg(`[${recruitName || linkedMember.name}]님이 Recruit 리스트와 멤버에서 모두 삭제되었습니다.`);
      }
      function addNote(){
        if(!newNote.text.trim())return;
        const createdBy = meName.value || (selectedMemberId.value && selectedMemberId.value !== 'root'
          ? members.value.find(m => m.id === selectedMemberId.value)?.name
          : rootMember.value?.name || '');
        const createdByEmail = (currentUser.value?.email || '').toLowerCase();
        const now = new Date().toISOString();
        notes.value.push({
          id: 'note_' + Date.now(),
          text: newNote.text.trim(), 
          scope: newNote.scope, 
          createdBy, 
          createdByEmail, 
          createdAt: now,
          updatedAt: now
        });
        newNote.text='';
        newNote.scope='all';
      }
      function getPersonTitle(name) {
          if (!name) return ''; const n = String(name).trim(); if (!n) return '';
          if ((header.fd || '').trim() === n) return 'FD'; if ((header.sfd || '').trim() === n) return 'SFD'; if ((header.dd || '').trim() === n) return 'DD'; if ((header.efd || '').trim() === n) return 'EFD';
          const m = members.value.find(x => x.name === n); if (m) return m.status === 'root' ? '본인' : (m.status || ''); return '';
      }
      function apptPeopleList(apt) {
          const main = (apt && apt.title || '').trim(); const attendees = ((apt && apt.attendees) || []).map(n => (n || '').trim()).filter(n => n && n !== main);
          const seen = new Set(); const out = []; if (main) { out.push(main); seen.add(main); } attendees.forEach(n => { if (!seen.has(n)) { out.push(n); seen.add(n); } }); return out;
      }
      function handleTargetNameChange() {
          // 약속의 만날 사람은 고객이므로 Recruit 리스트에 자동 등록하지 않음.
          // (이벤트의 경우 등록이 필요하다면 별도 입력을 통해 진행)
          return;
      }
      function addAppointment() {
          if(!newAppt.date || !newAppt.title) return showToastMsg('날짜와 내용은 필수 항목입니다.', 'error');

          const createdBy = meName.value || (selectedMemberId.value && selectedMemberId.value !== 'root'
            ? members.value.find(m => m.id === selectedMemberId.value)?.name
            : rootMember.value?.name || '');
          const createdByEmail = (currentUser.value?.email || '').toLowerCase();
          
          if ((newAppt.type || '이벤트') === '약속') {
            newAppt.targetName = (newAppt.title || '').trim();
            // 약속의 경우 본인을 자동으로 참석자에 추가
            if (createdBy && !newAppt.attendees.includes(createdBy)) {
              newAppt.attendees.unshift(createdBy);
            }
          }
          
          if(!newAppt.targetName && newAppt.attendees.length === 0) return showToastMsg('참석할 멤버나 만날 대상자를 최소 한 명 이상 지정해주세요.', 'error');
          // ⚠️ 약속(meet)의 만날 사람은 "고객"이므로 Recruit 리스트에 자동 등록하지 않음.
          //    이벤트(event)의 targetName은 자동 등록 대상이 아님(빈 값) — 별도 동작 없음.
          //    고객이면서 Recruit 대상에 추가하고 싶다면 Recruit 탭의 신규 등록 폼을 이용해야 함.
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
                appointments.value[idx].updatedAt = new Date().toISOString();
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
                attendees: [...newAppt.attendees],
                confirmed: false,
                createdBy: newAppt.type === '이벤트' ? '' : createdBy,
                createdByEmail: newAppt.type === '이벤트' ? '' : createdByEmail,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              showToastMsg(`새로운 ${newAppt.type || '이벤트'}가 등록되었습니다.`);
          }
          newAppt.date = ''; newAppt.time = ''; newAppt.endTime = ''; newAppt.location = ''; newAppt.type = '이벤트'; newAppt.title = ''; newAppt.description = ''; newAppt.targetName = ''; newAppt.attendees = []; newAppt.newAttendeeInput = ''; newAppt.createdBy = '';
      }
      function removeAppointment(id) { if (!confirm('이 약속/이벤트를 삭제하시겠습니까?')) return; appointments.value = appointments.value.filter(a => a.id !== id); showToastMsg('약속이 삭제되었습니다.'); }
      function toggleApptConfirmed(apt) {
          const idx = appointments.value.findIndex(a => a.id === apt.id);
          if (idx === -1) return;
          const cur = !!appointments.value[idx].confirmed;
          appointments.value[idx].confirmed = !cur;
          appointments.value[idx].updatedAt = new Date().toISOString();
          showToastMsg(cur ? '약속을 다시 표시합니다.' : '약속을 확인 처리하여 디스플레이에서 숨깁니다.');
      }
      function apptDisplayTitle(apt) {
          const type = apt.type || '이벤트';
          if (type === '약속') {
              // 약속: 장소를 제목으로
              if (apt.location && apt.location.trim()) return '📍 ' + apt.location;
              // 장소가 없으면 사람 이름으로 폴백
              const ppl = (typeof apptPeopleList === 'function' ? apptPeopleList(apt) : []) || [];
              if (ppl.length) return ppl.slice(0, 2).join(', ') + (ppl.length > 2 ? ' 외' : '');
              return '(장소 미정)';
          }
          // 이벤트: 이벤트 명을 제목으로
          if (apt.title && apt.title.trim()) return apt.title;
          if (apt.location && apt.location.trim()) return '📍 ' + apt.location;
          return '(이벤트 명 미정)';
      }
      function apptDisplaySubtitle(apt) {
          const parts = [];
          const type = apt.type || '이벤트';
          if (type === '약속') {
              const ppl = (typeof apptPeopleList === 'function' ? apptPeopleList(apt) : []) || [];
              if (ppl.length) parts.push('👥 ' + ppl.join(', '));
          } else {
              // 이벤트: 제목이 메인이므로 장소와 참석자를 부제로
              if (apt.location && apt.location.trim()) parts.push('📍 ' + apt.location);
              const names = [];
              if (apt.targetName) names.push(apt.targetName);
              if (apt.attendees && apt.attendees.length) {
                  apt.attendees.forEach(n => { if (!names.includes(n)) names.push(n); });
              }
              if (names.length) parts.push('👥 ' + names.join(', '));
          }
          return parts.join(' · ');
      }
      function completeAppointment(apt) {
          const aptDate = new Date(apt.date.replace(/[-./]/g, '/')); const histDate = `${String(aptDate.getMonth()+1).padStart(2,'0')}/${String(aptDate.getDate()).padStart(2,'0')}/${String(aptDate.getFullYear()).slice(2)}`; const typeLabel = apt.type || '약속/행사';
          let extraBits = []; if(apt.time) extraBits.push(apt.endTime ? apt.time + '~' + apt.endTime : apt.time); if(apt.location) extraBits.push('@'+apt.location);
          const extraStr = extraBits.length ? ' ('+extraBits.join(' ')+')' : ''; const descStr = apt.description ? ' — ' + apt.description : ''; const content = `[${typeLabel}] ${apt.title}${extraStr}${descStr}`;
          if(apt.targetName) addHistoryToPerson(apt.targetName, histDate, content);
          apt.attendees.forEach(attName => addHistoryToPerson(attName, histDate, content));
          appointments.value = appointments.value.filter(a => a.id !== apt.id); showToastMsg('✅ 완료 처리되어 참석자 히스토리에 기록되었습니다.');
      }
      function editAppointment(apt) { editingApptId.value = apt.id; newAppt.date = apt.date; newAppt.time = apt.time || ''; newAppt.endTime = apt.endTime || ''; newAppt.location = apt.location || ''; newAppt.type = apt.type || '이벤트'; newAppt.title = apt.title; newAppt.description = apt.description || ''; newAppt.targetName = apt.targetName || ''; newAppt.attendees = [...(apt.attendees || [])]; newAppt.newAttendeeInput = ''; newAppt.createdBy = apt.createdBy || ''; }
      function cancelEditAppt() { editingApptId.value = null; newAppt.date = ''; newAppt.time = ''; newAppt.endTime = ''; newAppt.location = ''; newAppt.type = '이벤트'; newAppt.title = ''; newAppt.description = ''; newAppt.targetName = ''; newAppt.attendees = []; newAppt.newAttendeeInput = ''; newAppt.createdBy = ''; }
      function addAttendeeByName() {
          const name = (newAppt.newAttendeeInput || '').trim(); if (!name) return; if (newAppt.attendees.includes(name)) { newAppt.newAttendeeInput = ''; return; }
          const isMember = apptMemberNames.value.includes(name); const isRecruit = recruitNames.value.includes(name);
          const createdBy = selectedMemberId.value && selectedMemberId.value !== 'root'
            ? members.value.find(m => m.id === selectedMemberId.value)?.name
            : rootMember.value?.name || '';
          // 이벤트(event) 참석자 중 기존에 없는 이름은 Recruit 리스트에 자동 추가.
          // 단, 약속(meet)의 경우 고객 프라이버시 보호를 위해 자동 등록하지 않음.
          const isMeet = (newAppt.type || '이벤트') === '약속';
          if (!isMember && !isRecruit && !isMeet) {
            const newR = { id:'r'+Date.now(), name, major:'', job:'', company:'', relation:'', meetDate:'', period:'', gender:'남', score:50, birthDate:'', age:'', show:true, interactionHistory:[], disposition: defaultDisposition(), createdBy, parentId: selectedMemberId.value || 'root' };
            recruits.value.push(newR);
            showToastMsg(`[${name}]님이 Recruit 리스트에 자동 추가되었습니다.`);
          }
          newAppt.attendees.push(name); newAppt.newAttendeeInput = '';
      }
      function checkPastAppointments() {
          const today = new Date(); today.setHours(0,0,0,0); let kept = []; let changed = false;
          for(let apt of appointments.value) {
              const aptDate = new Date(apt.date.replace(/[-./]/g, '/'));
              if(aptDate < today) {
                  const histDate = `${String(aptDate.getMonth()+1).padStart(2,'0')}/${String(aptDate.getDate()).padStart(2,'0')}/${String(aptDate.getFullYear()).slice(2)}`; const typeLabel = apt.type || '약속/행사';
                  let extraBits = []; if(apt.time) extraBits.push(apt.endTime ? apt.time + '~' + apt.endTime : apt.time); if(apt.location) extraBits.push('@'+apt.location); const extraStr = extraBits.length ? ' ('+extraBits.join(' ')+')' : ''; const descStr = apt.description ? ' — ' + apt.description : ''; const content = `[${typeLabel}] ${apt.title}${extraStr}${descStr}`;
                  if(apt.targetName) addHistoryToPerson(apt.targetName, histDate, content);
                  apt.attendees.forEach(attName => addHistoryToPerson(attName, histDate, content));
                  changed = true;
              } else kept.push(apt);
          }
          if(changed) { appointments.value = kept; showToastMsg('지난 약속이 각 멤버 히스토리로 이관되었습니다.'); }
      }
      function addHistoryToPerson(name, dateStr, content) {
          let m = members.value.find(x => x.name === name);
          if(m) { if(!m.interactionHistory) m.interactionHistory = []; m.interactionHistory.push({ id: 'ih'+Date.now()+Math.random(), date: dateStr, content: content }); m.interactionHistory = [...m.interactionHistory]; if(m.recruitId) { let r = recruits.value.find(x => x.id === m.recruitId); if(r) r.interactionHistory = [...m.interactionHistory]; } }
          else { let r = recruits.value.find(x => x.name === name); if(r) { if(!r.interactionHistory) r.interactionHistory = []; r.interactionHistory.push({ id: 'ih'+Date.now()+Math.random(), date: dateStr, content: content }); r.interactionHistory = [...r.interactionHistory]; } }
      }
      function onNodeClick(m){ selectedMemberId.value = m.id; if(memberInfoPosition.value === 'none') { memberInfoPosition.value = 'right'; } }
      function getRecruitMeta(r){ const ageStr=r.age?`${r.age}세`:''; return [r.major, r.job, r.company, r.relation,ageStr,calcPeriod(r.meetDate,r.period),r.gender].filter(Boolean).join(' | '); }
      function snapshot(){ return { header:{...header}, members:JSON.parse(JSON.stringify(members.value)), notes:JSON.parse(JSON.stringify(notes.value)), recruits:JSON.parse(JSON.stringify(recruits.value)), appointments:JSON.parse(JSON.stringify(appointments.value)), recruitPosition:recruitPosition.value, notesPosition:notesPosition.value, memberInfoPosition:memberInfoPosition.value, appointmentPosition:appointmentPosition.value, nodeWidth:nodeWidth.value, nodeBaseHeight:nodeBaseHeight.value, nodeFontSize:nodeFontSize.value, nodeLineGap:nodeLineGap.value, notePanelWidth:notePanelWidth.value, legendConfig:JSON.parse(JSON.stringify(legendConfig.value)) }; }
      function migrateHistory(h){ if(!h.type) h.type='History'; if(h.type==='Point') h.type='History'; if(h.amount===undefined){ if(h.type==='Issue Paid'||h.type==='Pending'){ h.amount=h.point||0; h.point=0; } else h.amount=0; } if(h.point===undefined) h.point=0; return h; }
      function restore(d){
        clearFocus(); Object.assign(header,d.header);
        members.value=(d.members||[]).map(m=>{ const history=(m.history||[]).map(h=>migrateHistory({...h})); const interactionHistory = m.interactionHistory || []; let st = m.status; if(st === 'New' || st === 'Code-in') st = 'New(Code-in)'; const disp = m.disposition ? JSON.parse(JSON.stringify(m.disposition)) : defaultDisposition(); return {birthDate:'',age:'',meetDate:'',major:'',job:'',company:'',relation:'',gender:'남',email:'',issuePaid:0,pending:0,score:0, interactionHistory, recruitId:null, ...m, status:st, history, disposition: disp}; });
        notes.value=(d.notes||[]).map(n=>typeof n==='string'?{text:n, scope:'all', createdBy:''}:{scope:'all', createdBy:'', ...n});
        if(d.recruits) recruits.value = d.recruits.map(r => { let ih = r.interactionHistory || []; if (r.history && r.history.length > 0 && ih.length === 0) { ih = r.history.map(h => typeof h === 'string' ? {id:'ih'+Math.random(), date:'', content:h} : h); } const disp = r.disposition ? JSON.parse(JSON.stringify(r.disposition)) : defaultDisposition(); return {relation:'',meetDate:'',major:'',job:'',company:'',period:'',gender:'남',birthDate:'',age:'',email:'',createdBy:'',parentId:'',...r, interactionHistory: ih, disposition: disp}; });
        if(d.appointments) appointments.value = d.appointments.map(a => ({ type: '이벤트', time: '', endTime: '', location: '', description: '', attendees: [], targetName: '', createdBy: '', confirmed: false, ...a }));
        if(d.recruitPosition) recruitPosition.value=d.recruitPosition; if(d.notesPosition) notesPosition.value=d.notesPosition; if(d.memberInfoPosition) memberInfoPosition.value=d.memberInfoPosition; if(d.appointmentPosition) appointmentPosition.value=d.appointmentPosition; if(d.nodeWidth) nodeWidth.value=d.nodeWidth; if(d.nodeBaseHeight) nodeBaseHeight.value=d.nodeBaseHeight; if(d.nodeFontSize) nodeFontSize.value=d.nodeFontSize; if(d.nodeLineGap) nodeLineGap.value=d.nodeLineGap; if(d.notePanelWidth) notePanelWidth.value=d.notePanelWidth;
        if(d.legendConfig&&d.legendConfig.items){ legendConfig.value.show=d.legendConfig.show; for(let k in d.legendConfig.items){ if(legendConfig.value.items[k]) legendConfig.value.items[k]=d.legendConfig.items[k]; } }
      }
      function exportJSON(){ 
        if (printRootId.value !== '__actual_root__') {
            const subRoot = members.value.find(m => m.id === printRootId.value); if (!subRoot) return; const ids = new Set(); function col(id){ ids.add(id); members.value.filter(m=>m.parentId===id).forEach(m=>col(m.id)); } col(printRootId.value);
            const subMemberList = members.value.filter(m=>ids.has(m.id)).map(m=>m.id===printRootId.value ? {...m,parentId:null} : {...m}); const originalRoot = members.value.find(m=>!m.parentId);
            const newHeader = {...header, id:'', rank:subRoot.status==='root'?'':subRoot.status, fd:originalRoot?originalRoot.name:header.fd, sfd:header.fd||header.sfd, dd:header.sfd||header.dd, efd:header.dd||header.efd};
            const data = { header: newHeader, members: JSON.parse(JSON.stringify(subMemberList)), notes: JSON.parse(JSON.stringify(notes.value)), recruits: [], appointments: [], recruitPosition: recruitPosition.value, notesPosition: notesPosition.value, memberInfoPosition: memberInfoPosition.value, appointmentPosition: appointmentPosition.value, nodeWidth: nodeWidth.value, nodeBaseHeight: nodeBaseHeight.value, nodeFontSize: nodeFontSize.value, nodeLineGap: nodeLineGap.value, notePanelWidth: notePanelWidth.value, legendConfig: JSON.parse(JSON.stringify(legendConfig.value)), _subExportOf: originalRoot ? originalRoot.name : '', _subExportFrom: subRoot.name, _exportedAt: new Date().toLocaleString('ko-KR') };
            const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${subRoot.name.replace(/\s+/g,'_')}_subtree_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); showToastMsg(`📤 ${subRoot.name} 하위 그룹 내보내기 완료`);
        } else {
            const d = snapshot(); d._exportedAt = new Date().toLocaleString('ko-KR'); const blob = new Blob([JSON.stringify(d,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${(rootMemberName.value||'tree').replace(/\s+/g,'_')}_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); showToastMsg('📤 JSON 전체 내보내기 완료'); 
        }
      }
      function exportSubJSON(){
        if(!focusRootId.value){showToastMsg('포커스 모드에서만 사용 가능합니다','error');return;}
        const subRoot=members.value.find(m=>m.id===focusRootId.value); if(!subRoot)return; const subMemberList=focusedList.value.map(m=>m.id===focusRootId.value?{...m,parentId:null}:{...m}); const originalRoot=members.value.find(m=>!m.parentId);
        const newHeader={...header,id:'',rank:subRoot.status==='root'?'':subRoot.status,fd:originalRoot?originalRoot.name:header.fd,sfd:header.fd||header.sfd,dd:header.sfd||header.dd,efd:header.dd||header.efd};
        const data={header:newHeader,members:JSON.parse(JSON.stringify(subMemberList)),notes:JSON.parse(JSON.stringify(notes.value)),recruits:[],appointments:[],recruitPosition:recruitPosition.value,notesPosition:notesPosition.value, memberInfoPosition:memberInfoPosition.value, appointmentPosition:appointmentPosition.value, nodeWidth:nodeWidth.value,nodeBaseHeight:nodeBaseHeight.value,nodeFontSize:nodeFontSize.value,nodeLineGap:nodeLineGap.value,notePanelWidth:notePanelWidth.value,legendConfig:JSON.parse(JSON.stringify(legendConfig.value)),_subExportOf:originalRoot?originalRoot.name:'',_subExportFrom:subRoot.name,_exportedAt:new Date().toLocaleString('ko-KR')};
        const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${subRoot.name.replace(/\s+/g,'_')}_subtree_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); showToastMsg(`📤 ${subRoot.name} 서브 내보내기 완료`);
      }
      function importJSON(e){ const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(!d.header||!d.members)throw new Error(); if(!confirm('현재 작업을 덮어쓸까요?'))return; restore(d); isDirty.value=false; showToastMsg('📥 불러오기 완료'); }catch{ showToastMsg('❌ 파일 형식 오류','error'); } }; reader.readAsText(file); e.target.value=''; }

      function histInRange(h){
        if(!h.date) return true; const hTime = parseDateForSort(h.date); if(!hTime) return true;
        const startStr = header.periodStart; const endStr = header.periodEnd; if(!startStr && !endStr) return true;
        const startTime = startStr ? parseDateForSort(startStr) : 0; const endTime = endStr ? parseDateForSort(endStr) : Infinity; return hTime >= startTime && hTime <= endTime;
      }
      async function buildPrintDoc(){
        await nextTick(); const orient=printLandscape.value?'landscape':'portrait'; const pw=PAGE_W_PX.value, ph=PAGE_H_PX.value;
        let svgHTML=''; const svgEl=document.getElementById('main-tree-svg');
        if(svgEl){ const clone=svgEl.cloneNode(true); clone.removeAttribute('width'); clone.removeAttribute('height'); clone.setAttribute('viewBox',`0 0 ${layout.value.totalWidth} ${layout.value.totalHeight}`); clone.style.cssText='width:100%;height:auto;display:block;'; svgHTML=clone.outerHTML; }
        const subMembers=members.value; const tt={paid:subMembers.reduce((s,m)=>s+getMemberIssuePaid(m),0),pending:subMembers.reduce((s,m)=>s+getMemberPending(m),0),total:subMembers.reduce((s,m)=>s+getMemberIssuePaid(m)+getMemberPending(m),0)};
        const sc={}; subMembers.forEach(m=>{sc[m.status]=(sc[m.status]||0)+1;}); const rm=rootMember.value, h=header;
        const uplines=[]; if(h.fd)uplines.push(`<strong>FD</strong> ${h.fd}`); if(h.sfd)uplines.push(`<strong>SFD</strong> ${h.sfd}`); if(h.dd)uplines.push(`<strong>DD</strong> ${h.dd}`); if(h.efd)uplines.push(`<strong>EFD</strong> ${h.efd}`);
        let memberRows = ''; if (printIncludeMemberInfo.value) {
            memberRows=subMembers.map(m=>{
              const vis=(m.history||[]).filter(hh=>hh.show&&histInRange(hh)); if(!vis.length)return '';
              const rows=vis.sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date)).map(hh=>{
                let val=hh.content || ''; let extras=[]; if(Number(hh.amount)) extras.push(`$${fmt(hh.amount)}`); if(Number(hh.point)) extras.push(`${fmt(hh.point)} Pts`);
                let extraStr = extras.length ? `<div style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:#1c2b4a;margin-top:2px;">${extras.join(' | ')}</div>` : '';
                return `<tr><td style="width:110px;white-space:nowrap;color:#555;font-family:'JetBrains Mono',monospace;font-size:9px">${hh.date||'—'}</td><td style="font-size:10px;padding-bottom:4px;"><div>${val}</div>${extraStr}</td></tr>`;
              }).join('');
              let mName=m.name; const pts=mPtsSum(m); if(pts>0) mName+=` <span style="font-size:8px;color:#b8943a;font-family:'JetBrains Mono',monospace;">(Pts:${fmt(pts)})</span>`;
              return `<div class="pd-hist-member"><div class="pd-hist-name">${mName}</div><table class="pd-hist-table">${rows}</table></div>`;
            }).filter(Boolean).join('');
        }
        let recruitsHTML = ''; if (printIncludeRecruit.value && visibleRecruits.value.length) {
            recruitsHTML = visibleRecruits.value.map(r => {
                let rInfo = `<div class="pd-hist-member"><div class="pd-hist-name">${r.name} <span style="font-size:8px;color:#b8943a;">(적합도:${r.score})</span></div>`;
                if (r.interactionHistory && r.interactionHistory.length) {
                    const rows = [...r.interactionHistory].sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date)).map(ih => `<tr><td style="width:80px;white-space:nowrap;color:#555;font-family:'JetBrains Mono',monospace;font-size:9px">${ih.date||'—'}</td><td style="font-size:10px;padding-bottom:4px;">${ih.content}</td></tr>`).join('');
                    rInfo += `<table class="pd-hist-table">${rows}</table>`;
                } else rInfo += `<div style="font-size:9px;color:#888;padding:2px 0;">상담 기록 없음</div>`; rInfo += `</div>`; return rInfo;
            }).join('');
        }
        let appointmentsHTML = ''; if (printIncludeAppointment.value && upcomingAppointments.value.length) {
            appointmentsHTML = upcomingAppointments.value.map(apt => {
                const dateStr = fmtApptDateShort(apt.date); const timeStr = apt.time ? (apt.endTime ? apt.time + '~' + apt.endTime : apt.time) : '';
                let titleStr = apt.title; if ((apt.type||'이벤트') === '약속') { titleStr = apptPeopleList(apt).join(', '); }
                return `<div class="pd-note-item" style="display:flex; flex-direction:column; gap:2px; padding:4px 0;"><div style="display:flex; gap:6px; align-items:baseline;"><span class="pd-note-num" style="color:#d35400; background:#fdf6ee; padding:1px 4px; border-radius:4px; border:none; font-size:8.5px;">${apt.type||'이벤트'}</span><span style="font-family:'JetBrains Mono',monospace; font-weight:700; color:#1c2b4a; font-size:10px;">${dateStr} ${timeStr}</span><span style="font-weight:700; color:#1c2b4a; font-size:11px;">${titleStr}</span></div>${apt.location ? `<div style="font-size:9px; color:#555; padding-left:4px;">📍 ${apt.location}</div>` : ''}${apt.description ? `<div style="font-size:10px; color:#333; padding-left:4px; border-left:2px solid #ddd; margin-left:2px;">${apt.description}</div>` : ''}</div>`;
            }).join('');
        }
        let notesHTML=''; if (printIncludeNotes.value && notes.value.length) { notesHTML=notes.value.map((n,i)=>`<div class="pd-note-item"><span class="pd-note-num">${i+1}</span>${n.text}</div>`).join(''); }
        let filterLabel=''; if(h.periodStart || h.periodEnd) { filterLabel = `${h.periodStart||'시작'} ~ ${h.periodEnd||'계속'}`; }
        let legendHTML=''; if(legendConfig.value.show){ legendHTML=ALL_STATUSES.filter(s=>legendConfig.value.items[s].show && sc[s] > 0).map(s=>`<div class="pd-leg-item"><span class="pd-leg-box" style="background:${COLORS[s]}!important;border:1px solid ${STROKES[s]}!important"></span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${legendConfig.value.items[s].label}</span><span style="transform:scale(0.8);flex-shrink:0;">(${sc[s]})</span></div>`).join(''); }
        let headerHTML=`<div class="pd-header"><div class="pd-header-left"><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 6px;width:100%;">${legendHTML}</div></div><div class="pd-header-center"><div class="pd-name">${rm?rm.name:''} <span class="pd-id">(${h.id})</span></div>`;
        if(h.rank)headerHTML+=`<div style="display:inline-block;margin:1px 0 2px 0;background:#1c2b4a;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:6px;letter-spacing:1px">${h.rank}</div>`;
        if(uplines.length)headerHTML+=`<div class="pd-upline">${uplines.join('&nbsp;|&nbsp;')}</div>`;
        headerHTML+=`<div style="margin-top:3px;font-size:8px;color:#555;"><strong>PERIOD:</strong> ${h.periodStart} – ${h.periodEnd}</div></div><div class="pd-header-right"><div class="pd-date">As of ${h.asOf}</div><div class="pd-fin-row"><span class="pd-fin-label">Issue Paid</span><span class="pd-fin-val">${fmt(tt.paid)}</span></div><div class="pd-fin-row"><span class="pd-fin-label">Pending</span><span class="pd-fin-val">${fmt(tt.pending)}</span></div><div class="pd-fin-row pd-fin-total"><span>Total</span><span class="pd-fin-val">${fmt(tt.total)}</span></div></div></div>`;
        let sideColHTML = ''; if (memberRows || recruitsHTML || appointmentsHTML || notesHTML) {
            sideColHTML += `<div class="pd-side-col">`;
            if(memberRows) sideColHTML += `<div class="pd-hist-section"><div class="pd-hist-section-title">📋 멤버 히스토리<span class="pd-hist-filter-label">${filterLabel}</span></div><div class="pd-hist-grid">${memberRows}</div></div>`;
            if(recruitsHTML) sideColHTML += `<div class="pd-hist-section" style="margin-top:12px;"><div class="pd-hist-section-title" style="color:#b8943a; border-bottom:1.5px solid #b8943a;">🎯 Recruit 리스트</div><div class="pd-hist-grid">${recruitsHTML}</div></div>`;
            if(appointmentsHTML) sideColHTML += `<div style="margin-top:12px"><div class="pd-notes-title" style="color:#d35400; border-bottom:1.5px solid #d35400;">📅 예정된 약속/이벤트</div><div style="display:flex; flex-direction:column; gap:4px;">${appointmentsHTML}</div></div>`;
            if(notesHTML) sideColHTML += `<div style="margin-top:12px"><div class="pd-notes-title">📝 메모 / 액션 아이템</div><div class="pd-notes-grid">${notesHTML}</div></div>`;
            sideColHTML += `</div>`;
        }
        let inner=''; if(printLandscape.value){ inner+=`<div class="pd-body-landscape"><div class="pd-main-col">`; if(h.title)inner+=`<div class="pd-doc-title">${h.title}</div>`; inner+=headerHTML+`<div class="pd-tree-wrap">${svgHTML}</div></div>`; inner += sideColHTML; inner+=`</div>`; } else { if(h.title)inner+=`<div class="pd-doc-title">${h.title}</div>`; inner+=headerHTML+`<div class="pd-body-portrait"><div class="pd-main-col"><div class="pd-tree-wrap">${svgHTML}</div></div>`; inner += sideColHTML; inner+=`</div>`; }
        let html='<!DOCTYPE html><html><head><meta charset="UTF-8">'; html+='<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Libre+Baskerville:wght@700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">';
        html+='<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"Noto Sans KR",sans-serif;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}#wrap{width:'+pw+'px;min-height:'+ph+'px;padding:16px 20px;}@page{margin:0;size:letter '+orient+';}@media print{html,body{width:'+pw+'px;height:'+ph+'px;overflow:hidden;}#wrap{padding:16px 20px;}} .edge-line{stroke:#6b7280;stroke-width:1.5px;fill:none;}.edge-dash{stroke:#9ca3af;stroke-width:1.2px;stroke-dasharray:5,3;fill:none;}.pd-doc-title{text-align:center;font-family:"Libre Baskerville",serif;font-size:18px;font-weight:700;color:#1c2b4a;margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid #1c2b4a;}.pd-header{display:grid;grid-template-columns:180px 1fr 140px;align-items:stretch;border:1.5px solid #1c2b4a;margin-bottom:8px;background:#fff;}.pd-header-left{padding:4px 6px;font-size:8px;line-height:1.3;border-right:1px solid #1c2b4a;}.pd-leg-item{display:flex;align-items:center;gap:4px;margin-bottom:1px;font-size:8px;overflow:hidden;}.pd-leg-box{width:12px;height:8px;border-radius:1px;display:inline-block;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.pd-header-center{padding:4px 8px;text-align:center;border-right:1px solid #1c2b4a;display:flex;flex-direction:column;justify-content:center;}.pd-name{font-family:"Libre Baskerville",serif;font-size:15px;font-weight:700;margin-bottom:2px;}.pd-id{font-size:9px;color:#555;margin-left:4px;}.pd-upline{font-size:8px;color:#333;margin-top:2px;}.pd-upline strong{font-weight:700;color:#1c2b4a;margin-right:2px;}.pd-header-right{padding:4px 8px;font-size:9px;text-align:right;line-height:1.4;display:flex;flex-direction:column;justify-content:center;}.pd-fin-row{display:flex;justify-content:space-between;gap:4px;}.pd-fin-label{color:#555;}.pd-fin-val{font-family:"JetBrains Mono",monospace;font-weight:600;}.pd-fin-total{font-size:11px;font-weight:700;border-top:1px solid #1c2b4a;padding-top:2px;margin-top:2px;}.pd-date{font-size:8px;color:#666;margin-bottom:2px;}.pd-body-landscape{display:flex;gap:16px;align-items:flex-start;}.pd-body-landscape .pd-main-col{flex:1;min-width:0;}.pd-body-landscape .pd-side-col{width:310px;flex-shrink:0;}.pd-body-portrait .pd-main-col{width:100%;}.pd-body-portrait .pd-side-col{width:100%;margin-top:12px;}.pd-tree-wrap{border:1px solid #ddd;padding:4px;text-align:center;display:flex;justify-content:center;}.pd-tree-wrap svg{max-width:100%;height:auto;display:block;}.pd-hist-section-title{font-size:10px;font-weight:700;letter-spacing:.5px;color:#1c2b4a;text-transform:uppercase;border-bottom:1.5px solid #1c2b4a;padding-bottom:2px;margin-bottom:5px;}.pd-hist-filter-label{font-size:8.5px;color:#888;margin-left:6px;font-style:italic;}.pd-hist-grid{display:grid;gap:5px 10px;}.pd-body-landscape .pd-hist-grid{grid-template-columns:1fr;}.pd-body-portrait .pd-hist-grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));}.pd-hist-member{break-inside:avoid;}.pd-hist-name{font-size:10.5px;font-weight:700;color:#1c2b4a;margin-bottom:1px;border-bottom:1px solid #ddd;padding-bottom:1px;}.pd-hist-table{width:100%;border-collapse:collapse;font-size:8.5px;}.pd-hist-table td{padding:1px 3px;border-bottom:1px dotted #eee;vertical-align:top;}.pd-notes-title{font-size:10px;font-weight:700;letter-spacing:.5px;color:#1c2b4a;text-transform:uppercase;margin-bottom:5px;border-bottom:1.5px solid #1c2b4a;padding-bottom:3px;}.pd-notes-grid{display:grid;gap:2px 12px;}.pd-body-landscape .pd-notes-grid{grid-template-columns:1fr;}.pd-body-portrait .pd-notes-grid{grid-template-columns:1fr 1fr 1fr;}.pd-note-item{display:flex;align-items:baseline;gap:4px;font-size:10px;padding:2px 0;border-bottom:1px dotted #ccc;}.pd-note-num{font-weight:700;color:#b8943a;font-family:"JetBrains Mono",monospace;font-size:9px;flex-shrink:0;}';
        html+='</style></head><body><div id="wrap">'+inner+'</div>'; html+='<scr'+'ipt>window.onload=function(){var wrap=document.getElementById("wrap");var scale=Math.min('+pw+'/wrap.scrollWidth,'+ph+'/wrap.scrollHeight);if(scale<1){wrap.style.transformOrigin="top left";wrap.style.transform="scale("+scale+")";document.body.style.overflow="hidden";}};</scr'+'ipt></body></html>'; return html;
      }
      async function doPrint(){ const html=await buildPrintDoc(); showPreview.value=true; await nextTick(); const frame=document.getElementById('preview-frame'); if(frame)frame.srcdoc=html; }
      function confirmPrint(){ const frame=document.getElementById('preview-frame'); if(frame&&frame.contentWindow){ let ps=frame.contentDocument.getElementById('print-page-style'); if(!ps){ps=frame.contentDocument.createElement('style');ps.id='print-page-style';frame.contentDocument.head.appendChild(ps);} ps.textContent=`@page{margin:0;size:letter ${printLandscape.value?'landscape':'portrait'};}`;frame.contentWindow.print(); } }

      onMounted(()=>{ initAuth(); });

      // 선택된 멤버가 바뀔 때마다 해당 멤버의 서브 트리 공유 정보를 다시 읽어온다.
      watch([selectedMemberId, currentTreeId, currentUser], () => {
        fetchSubTreeForSelectedMember();
      });

      watch([header,members,notes,recruits,appointments,recruitPosition,notesPosition,memberInfoPosition,appointmentPosition,nodeWidth,nodeBaseHeight,nodeFontSize,nodeLineGap,notePanelWidth,legendConfig],()=>{
        if (applyingRemote) return;
        if (currentIsReadOnly.value) return;
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
        subTreeSharesForSelected, selectedMemberEffectiveEmail, removeSubTreeSharee, setSubTreeShareePrimary,
        header, members, notes, appointments, notesPosition, recruitPosition, memberInfoPosition, appointmentPosition, tab,
        toast, showPreview, isDirty, lastAutoSave, slots, showShareModal, shareInput, focusRootId, zoomLevel, panX, panY,
        nodeWidth, nodeBaseHeight, nodeFontSize, nodeLineGap, widthLocked, heightLocked, fontLocked, lineGapLocked, notePanelWidth, notePanelLocked,
        recruits, newRecruit, expandedMemberId, expandedInteractionId, expandedDispositionId, expandedRecruitInteractionId, expandedRecruitDispositionId, editingApptId,
        selectedMemberId, selectedMember, newHist, newInteraction, newRecruitInteraction, newAppt, nm, printLandscape, showSizePanel, printRootId, newNote,
        legendConfig, allStatuses:ALL_STATUSES, availableStatuses, memberNames, recruitNames, allPersonNames, apptMemberNames, uplineMemberNames, upcomingAppointments,
        recruitsSortedAll, visibleRecruits, focusedList, rootMember, rootMemberName, rootMemberEmail, currentMembers, tabMembers, tabRecruitsSorted, tabUpcomingAppointments, tabNotes,
        meMember, meName, meSubtreeIds, meSubtreeNames,
        selectedUpline, viewHeader, selectedIsRootView,
        teamTotal, statusCounts, layout, panTransform, previewPageStyle, previewFrameStyle,
        fmt, fmtS, parseDateForSort, calcAge, calcPeriod, sortedPointHistory, sortedInteractionHistory,
        getMemberIssuePaid, getMemberPending, mPtsSum, getMemberTotal, getIncomePercent, fmtApptDateShort, getPointHistPct,
        updateRootMemberName, updateRootMemberEmail, setFocus, clearFocus, toggleFocus, nodeNoteLines, nodeH,
        addMember, removeMember, toggleHistoryPanel, toggleInteractionPanel, toggleDispositionPanel, toggleRecruitInteractionPanel, toggleRecruitDispositionPanel, addHistoryItem, removeHistoryItem, addInteractionItem, removeInteractionItem, parentOpts,
        calcDisposition, addRecruit, removeRecruit, promoteRecruit, onScoreChange,
        addRecruitInteractionItem, removeRecruitInteractionItem, onRecruitInteractionChange, onMemberInteractionChange,
        addAppointment, removeAppointment, completeAppointment, editAppointment, cancelEditAppt, handleTargetNameChange, addAttendeeByName, getPersonTitle, apptPeopleList,
        toggleApptConfirmed, apptDisplayTitle, apptDisplaySubtitle, visibleSidebarAppointments,
        addNote, onNodeClick, getRecruitMeta, zoomIn, zoomOut, zoomReset, centerTree, onWheel, onPanStart, onPanMove, onPanEnd,
        quickSave, exportJSON, exportSubJSON, importJSON, doPrint, confirmPrint, getToastClass, getSaveStatusClass, getSaveStatusText,
        printIncludeNotes, printIncludeRecruit, printIncludeAppointment, printIncludeMemberInfo, printIncludePointHistory,
        getEdgeClass:(e)=>['Potential', 'Serious'].includes(e.status)?'edge-dash':'edge-line',
        getNodeTransform:(m)=>`translate(${m.pos.x-nodeWidth.value/2},${m.pos.y-nodeH(m)/2})`,
        getRectStrokeWidth:(m)=>['Potential', 'Serious'].includes(m.status)?1.5:1,
        getRectDash:(m)=>['Potential', 'Serious'].includes(m.status)?'5,3':'none',
        getLegendMargin:()=>legendConfig.value.show?'auto':'0',
        getTbarClass:(c)=>c?'tbar-save':'tbar-other',
        getFocusTitle:(m)=>focusRootId.value===m.id?'포커스 해제':m.name+' 기준으로 보기',
        getFocusIcon:(m)=>focusRootId.value===m.id?'⊙':'🔍',
        nColor:(s)=>COLORS[s]||'#fff', nStroke:(s)=>STROKES[s]||'#000', nTextColor:(s)=>TEXT_COLORS[s]||'#000',
        nDivider:(s)=>DIVIDERS[s]||'rgba(0,0,0,.15)', statusBadge:(s)=>BADGE_MAP[s]||s
      };
    }
  }).mount('#app');
});