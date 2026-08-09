import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, onSnapshot, updateDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
  // 접두 기호만 고정하고, 뒤에 붙는 이름은 범례에서 바꾼 라벨(statusLabel)을 따라가도록 함
  const BADGE_PREFIX = { EFD:'★★★★★', NFD:'★★★★', DFD:'★★★', SFD:'★★★', FD:'★★', SA:'★★', Agent:'★', Licensed:'★', 'New(Code-in)':'◈' };

  createApp({
    setup() {
      // ── Cloud State ──
      const ADMIN_EMAILS = ['donghyukbang@gmail.com', 'dhbang@itdowoomi.com'];
      const currentUser = ref(null);
      const isDashboard = ref(true);
      const savedTrees = ref([]);
      const currentTreeId = ref(null);
      const registeredUsers = ref([]);
      const showAdminPanel = ref(false);
      const userAccessStatus = ref(null); // null=확인중 | 'admin' | 'manager' | 'approved' | 'grace' | 'denied' | 'expired'
      const userGraceDays = ref(0);
      const adminTab = ref('pending');
      const adminSelectedUids = ref([]);
      const appInviteEmail = ref('');

      // ── 이메일 로그인 폼 상태 ──
      const emailLoginMode = ref('login'); // 'login' | 'register' | 'reset'
      const emailForm = reactive({ email: '', password: '', confirm: '' });
      const emailLoginError = ref('');
      const emailLoginLoading = ref(false);

      // ── 기술 지원 요청 모달 상태 ──
      // 사용자: 요청 내용(제목/본문) 작성용
      const showSupportRequestModal = ref(false);
      const supportRequestForm = reactive({ treeId: '', treeName: '', subject: '', message: '' });
      // 관리자: 요청 상세 보기용
      const showSupportDetailModal = ref(false);
      const selectedSupportRequest = ref(null); // 현재 상세 보고 있는 tree 객체

      // ── App State ──
      const defaultHeader = () => ({ title:'FD RUNNING CHART', id:'SCA87396', rank:'New(Code-in)', periodStart:'04/01/26', periodEnd:'06/30/26', periodEndAuto:false, asOf:'03/06/2026', fd:'ESTHER YI', sfd:'PETER AND JEAN', dfd:'', nfd:'', efd:'HYEJEONG LEE' });
      const defaultDisposition = () => ({ relationScore: 15, friendScore: 7, market: 'S', married: false, child: false, house: false, income: false, ambition: false, dissatisfied: false, pma: false, entrepreneur: false, prejudice: 30 });
      const defaultRoot = () => {
        // 로그인한 사용자 정보 기반으로 Root 멤버 생성 (하드코딩 개인정보 제거)
        const u = currentUser.value;
        const email = u && u.email ? u.email : '';
        const name = (u && u.displayName) ? u.displayName : (email ? email.split('@')[0] : '');
        return { id:'root', recruitId: null, name, email, memberCode:'', mergedPeople:[], major:'', job:'', company:'', status:'root', parentId:null, history:[], interactionHistory:[], issuePaid:0, pending:0, score:0, relation:'본인', age:'', meetDate:'', gender:'', birthDate:'', disposition: defaultDisposition(), trainingDone:[] };
      };

      const header = reactive(defaultHeader());
      // 기간 종료에 "today"를 입력하면 오늘 날짜로, 기간 시작은 자동으로 90일 전 날짜로 설정
      function fmtMDY(d){ const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const yy=String(d.getFullYear()).slice(-2); return `${mm}/${dd}/${yy}`; }
      watch(() => header.periodEnd, (val) => {
        if(val && val.trim().toLowerCase() === 'today'){
          applyAutoPeriodEnd();
        }
      });
      // 기간 종료를 "항상 오늘 날짜"로 고정하는 옵션: 기간 시작은 그 기준으로 90일 전으로 함께 갱신됨
      function applyAutoPeriodEnd(){
        const today = new Date();
        const start = new Date(today.getTime() - 90*24*60*60*1000);
        header.periodEnd = fmtMDY(today);
        header.periodStart = fmtMDY(start);
      }
      watch(() => header.periodEndAuto, (v) => { if(v) applyAutoPeriodEnd(); });
      const members = ref([
        defaultRoot(),
        { id:'m1', recruitId: null, name:'김은숙', email:'', memberCode:'', mergedPeople:[], major:'', job:'', company:'', status:'SA', parentId:'root', history:[], interactionHistory:[], issuePaid:0, pending:0, score:0, relation:'', age:'', meetDate:'', gender:'여', birthDate:'', disposition: defaultDisposition(), trainingDone:[] }
      ]);
      const notes = ref([]);
      const appointments = ref([]);
      const deletedAptIds = ref([]); // 삭제된 약속 ID 목록 (tombstone - 동기화 시 양방향 삭제 전파용)
      const recruits = ref([]);
      const trainingTopics = ref([]); // [{id, name, group?, groupLabel?, groupIndex?}] 교육(Training) 항목 마스터 목록 (순서 = 표시 순서). group 항목은 같은 group값끼리 연속 배치됨.
      const newTrainingTopic = reactive({ name: '' });
      const newTrainingGroup = reactive({ name: '', count: 6 }); // 예: NAT, 6단계 → NAT 1~NAT 6 일괄 생성
      function addTrainingTopic(){
        if(!newTrainingTopic.name.trim()) return;
        trainingTopics.value = [...trainingTopics.value, { id: 'tt'+Date.now()+Math.random().toString(36).slice(2,7), name: newTrainingTopic.name.trim(), group: null }];
        newTrainingTopic.name = '';
      }
      function addTrainingGroup(){
        const name = newTrainingGroup.name.trim(); const count = Math.round(Number(newTrainingGroup.count)) || 0;
        if(!name || count < 1) return;
        const groupId = 'tg'+Date.now()+Math.random().toString(36).slice(2,5);
        const items = [];
        for(let i=1;i<=count;i++){ items.push({ id: 'tt'+Date.now()+Math.random().toString(36).slice(2,7)+'_'+i, name: name+' '+i, group: groupId, groupLabel: name, groupIndex: i }); }
        trainingTopics.value = [...trainingTopics.value, ...items];
        newTrainingGroup.name = ''; newTrainingGroup.count = 6;
      }
      function removeTrainingTopic(id){
        trainingTopics.value = trainingTopics.value.filter(t=>t.id!==id);
        members.value.forEach(m=>{ if(m.trainingDone && m.trainingDone.includes(id)) m.trainingDone = m.trainingDone.filter(tid=>tid!==id); });
      }
      function removeTrainingGroup(groupId){
        const ids = trainingTopics.value.filter(t=>t.group===groupId).map(t=>t.id);
        trainingTopics.value = trainingTopics.value.filter(t=>t.group!==groupId);
        members.value.forEach(m=>{ if(m.trainingDone) m.trainingDone = m.trainingDone.filter(tid=>!ids.includes(tid)); });
      }
      // trainingTopics를 "표시 단위(단일 항목 또는 그룹 전체)"로 묶어서 관리/이동을 쉽게 함
      const trainingUnits = computed(() => {
        const arr = trainingTopics.value; const units = []; let i = 0;
        while(i < arr.length){
          const t = arr[i];
          if(t.group){ let j = i; while(j < arr.length && arr[j].group === t.group) j++; units.push({ type:'group', group:t.group, items: arr.slice(i,j), startIdx:i, endIdx:j }); i = j; }
          else { units.push({ type:'single', item:t, startIdx:i, endIdx:i+1 }); i++; }
        }
        return units;
      });
      function swapTrainingUnits(a, b){
        const units = [...trainingUnits.value]; [units[a], units[b]] = [units[b], units[a]];
        const flat = []; units.forEach(u => { if(u.type==='group') flat.push(...u.items); else flat.push(u.item); });
        trainingTopics.value = flat;
      }
      function moveTrainingUnitUp(unit){
        const units = trainingUnits.value; const idx = units.findIndex(u=>u.startIdx===unit.startIdx);
        if(idx > 0) swapTrainingUnits(idx, idx-1);
      }
      function moveTrainingUnitDown(unit){
        const units = trainingUnits.value; const idx = units.findIndex(u=>u.startIdx===unit.startIdx);
        if(idx >= 0 && idx < units.length-1) swapTrainingUnits(idx, idx+1);
      }
      function isTrainingDone(m, topicId){ return !!(m && m.trainingDone && m.trainingDone.includes(topicId)); }
      function toggleTrainingDone(m, topicId){
        if(!m) return;
        const list = m.trainingDone ? [...m.trainingDone] : [];
        const idx = list.indexOf(topicId);
        if(idx>=0) list.splice(idx,1); else list.push(topicId);
        m.trainingDone = list;
      }
      function getTrainingDoneCount(m){ if(!m || !m.trainingDone) return 0; return m.trainingDone.filter(id=>trainingTopics.value.some(t=>t.id===id)).length; }
      const newNote = reactive({ text: '', scope: 'notice' }); // notice | issue | personal (legacy: all)
      function noteScopeLabel(scope){
        if(scope === 'notice') return '공지사항';
        if(scope === 'issue') return '최근 이슈';
        if(scope === 'personal') return '개인 메모';
        return '공지사항'; // 예전 데이터(scope:'all' 또는 미지정)와의 호환용 기본값
      }
      
      const notesPosition = ref('none');
      const recruitPosition = ref('none');
      const memberInfoPosition = ref('right');
      const appointmentPosition = ref('none');
      const tab = ref('memberInfo');
      // 트리 데이터 용량(Firestore 문서 1개당 1MB 제한 대비 추정치) 확인
      const treeSizeInfo = ref({ bytes: 0, checkedAt: null });
      const showShareModal = ref(false);
      const showSubTreeShareModal = ref(false);
      const shareInput = reactive({ email: '', role: 'editor' });
      const subTreeShareInput = reactive({ email: '', role: 'editor', includeData: true });
      // 다른 사람이 내보낸 트리 JSON 파일을 선택된 노드 아래에 추가하거나, 선택된 노드와 병합하는 기능
      const showTreeMergeModal = ref(false);
      const treeMergeInput = reactive({ mode: 'append', assignStatus: '', includeExtras: true, fileName: '', parsedData: null, rootName: '', memberCount: 0 });
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
      
      const newRecruit = reactive({ name:'', email:'', major:'', job:'', company:'', relation:'', meetDate:'', period:'', gender:'남', score:50, birthDate:'', age:'', parentPersonKey:'' });
      const focusRootId = ref(null);
      
      const expandedMemberId = ref(null);
      const expandedInteractionId = ref(null);
      const expandedDispositionId = ref(null);
      const expandedTrainingId = ref(null);
      const showAddMemberModal = ref(false);
      
      const expandedRecruitInteractionId = ref(null);
      const expandedRecruitDispositionId = ref(null);
      
      const editingApptId = ref(null);
      
      const selectedMemberId = ref('root'); 
      const newHist = reactive({ date:'', type:'History', content:'', point:null, amount:null });
      const newInteraction = reactive({ date:'', content:'' });
      const newRecruitInteraction = reactive({ date:'', content:'' });
      const newAppt = reactive({ date: '', time: '', endTime: '', location: '', type: '이벤트', title: '', description: '', targetName: '', attendees: [], newAttendeeInput: '', createdBy: '' });

      const nm = reactive({ name:'', email:'', major:'', job:'', company:'', status:'New(Code-in)', parentId:'', birthDate:'', age:'', meetDate:'', relation:'', gender:'남', score:0 });

      const nodeWidth = ref(155), nodeBaseHeight = ref(58), nodeFontSize = ref(10), nodeLineGap = ref(11);
      const widthLocked = ref(false), heightLocked = ref(false), fontLocked = ref(false), lineGapLocked = ref(false);
      const notePanelWidth = ref(210), notePanelLocked = ref(false);
      const legendPanelWidth = ref(175), legendPanelLocked = ref(false);
      const zoomLevel = ref(1), panX = ref(0), panY = ref(0);
      let isPanning = false, panStartX = 0, panStartY = 0, panStartPX = 0, panStartPY = 0;
      const legendConfig = ref({ show:true, items:{} });
      ALL_STATUSES.forEach(s => { legendConfig.value.items[s] = { label:s, show:true }; });

      // 노드에 표기할 내용 옵션 (기본 정보 탭 > 노드 표기 옵션)
      const nodeDisplayConfig = ref({
        showRank: true,
        showPoints: true,
        showIssuePaid: true,
        showPending: true,
        showHistory: true,
        historyCount: 3,
        showIssuePaidHistory: false,
        issuePaidHistoryCount: 3,
        showPhoto: false
      });

      // 승급 기준 설정: { [rank]: { requirements:[{statuses:[status,...],count}], points:Number } }
      // requirements의 각 항목은 statuses 배열(OR 조건)로 구성됨 - 예: statuses:['Licensed','Agent'], count:2 → "Licensed 또는 Agent 합산 2명"
      const promotionCriteria = ref({});
      const promotionWindowDays = ref(90);
      const promoEditRank = ref('');
      const newPromoReq = reactive({ statuses: [] });

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
      const supportRequestedTrees = ref([]); // 기술 지원 요청된 트리 (관리자용)
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
          if (!user) { userAccessStatus.value = null; return; }

          const email = (user.email || '').toLowerCase();
          userAccessStatus.value = null; // 확인 중

          if (ADMIN_EMAILS.includes(email)) {
            userAccessStatus.value = 'admin';
            if (!migrationDone) { migrationDone = true; await migrateLegacyTrees(); }
            fetchSavedTrees();
            if (!isDashboard.value) setRootEmailToLoginIfEmpty();
            fetchRegisteredUsers();
            return;
          }

          try {
            const inviteSnap = await getDoc(doc(db, 'invitedEmails', email));
            const isInvited = inviteSnap.exists();
            const userRef = doc(db, 'registeredUsers', user.uid);
            const snap = await getDoc(userRef);
            const nowTs = serverTimestamp();
            let status, joinedMs;

            if (!snap.exists()) {
              status = isInvited ? 'approved' : 'pending';
              const newData = { uid: user.uid, email, displayName: user.displayName || '', photoURL: user.photoURL || '', status, joinedAt: nowTs, lastLoginAt: nowTs };
              if (isInvited) { newData.approvedBy = 'invite'; newData.approvedAt = nowTs; }
              await setDoc(userRef, newData);
              joinedMs = Date.now();
            } else {
              const existing = snap.data();
              await updateDoc(userRef, { lastLoginAt: nowTs });
              if (isInvited && existing.status === 'pending') {
                await updateDoc(userRef, { status: 'approved', approvedBy: 'invite', approvedAt: nowTs });
                status = 'approved';
              } else {
                status = existing.status || 'pending';
              }
              joinedMs = existing.joinedAt?.seconds ? existing.joinedAt.seconds * 1000 : Date.now();
            }

            // pending 상태인데 공유받은 트리가 있으면 자동 승인 (기존 공유 사용자 소급 처리)
            if (status === 'pending') {
              try {
                const sharedSnap = await getDocs(query(collection(db, getTreesPath()), where('sharedEmails', 'array-contains', email)));
                if (!sharedSnap.empty) {
                  await updateDoc(userRef, { status: 'approved', approvedBy: 'shared_tree', approvedAt: nowTs });
                  await setDoc(doc(db, 'invitedEmails', email), { email, invitedBy: 'system', invitedAt: nowTs, autoDetected: true });
                  status = 'approved';
                }
              } catch(e3) { console.warn('공유 트리 자동 승인 실패:', e3); }
            }

            if (status === 'approved') {
              userAccessStatus.value = 'approved';
            } else if (status === 'manager') {
              userAccessStatus.value = 'manager';
            } else if (status === 'denied') {
              userAccessStatus.value = 'denied';
              return;
            } else {
              const daysPassed = (Date.now() - joinedMs) / (1000 * 60 * 60 * 24);
              userGraceDays.value = Math.floor(daysPassed);
              if (daysPassed <= 30) {
                userAccessStatus.value = 'grace';
              } else {
                userAccessStatus.value = 'expired';
                return;
              }
            }
          } catch (e) {
            console.warn('접근 권한 확인 실패:', e);
            userAccessStatus.value = 'grace';
          }

          if (!migrationDone) { migrationDone = true; await migrateLegacyTrees(); }
          fetchSavedTrees();
          if (!isDashboard.value) setRootEmailToLoginIfEmpty();
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

      const loginWithEmail = async () => {
        emailLoginError.value = '';
        if (!emailForm.email || !emailForm.password) {
          emailLoginError.value = '이메일과 비밀번호를 입력하세요.';
          return;
        }
        emailLoginLoading.value = true;
        try {
          await signInWithEmailAndPassword(auth, emailForm.email, emailForm.password);
        } catch (error) {
          const code = error.code;
          if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
            emailLoginError.value = '이메일 또는 비밀번호가 올바르지 않습니다.';
          } else if (code === 'auth/invalid-email') {
            emailLoginError.value = '올바른 이메일 형식이 아닙니다.';
          } else if (code === 'auth/too-many-requests') {
            emailLoginError.value = '요청이 너무 많습니다. 잠시 후 다시 시도하세요.';
          } else {
            emailLoginError.value = '로그인에 실패했습니다. 다시 시도해주세요.';
          }
        } finally {
          emailLoginLoading.value = false;
        }
      };

      const registerWithEmail = async () => {
        emailLoginError.value = '';
        if (!emailForm.email || !emailForm.password) {
          emailLoginError.value = '이메일과 비밀번호를 입력하세요.';
          return;
        }
        if (emailForm.password !== emailForm.confirm) {
          emailLoginError.value = '비밀번호가 일치하지 않습니다.';
          return;
        }
        if (emailForm.password.length < 6) {
          emailLoginError.value = '비밀번호는 6자 이상이어야 합니다.';
          return;
        }
        emailLoginLoading.value = true;
        try {
          await createUserWithEmailAndPassword(auth, emailForm.email, emailForm.password);
        } catch (error) {
          const code = error.code;
          if (code === 'auth/email-already-in-use') {
            emailLoginError.value = '이미 사용 중인 이메일입니다.';
          } else if (code === 'auth/invalid-email') {
            emailLoginError.value = '올바른 이메일 형식이 아닙니다.';
          } else if (code === 'auth/weak-password') {
            emailLoginError.value = '비밀번호는 6자 이상이어야 합니다.';
          } else {
            emailLoginError.value = '회원가입에 실패했습니다. 다시 시도해주세요.';
          }
        } finally {
          emailLoginLoading.value = false;
        }
      };

      const resetPassword = async () => {
        emailLoginError.value = '';
        if (!emailForm.email) {
          emailLoginError.value = '이메일을 입력하세요.';
          return;
        }
        emailLoginLoading.value = true;
        try {
          await sendPasswordResetEmail(auth, emailForm.email);
          showToastMsg('비밀번호 재설정 메일을 발송했습니다.');
          emailLoginMode.value = 'login';
        } catch (error) {
          const code = error.code;
          if (code === 'auth/user-not-found') {
            emailLoginError.value = '등록된 이메일이 없습니다.';
          } else if (code === 'auth/invalid-email') {
            emailLoginError.value = '올바른 이메일 형식이 아닙니다.';
          } else {
            emailLoginError.value = '메일 발송에 실패했습니다.';
          }
        } finally {
          emailLoginLoading.value = false;
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
            const sharedDocs = sharedSnap.docs
              .map(d => ({ id: d.id, ...d.data(), _owned: false }))
              .filter(t => t.ownerId !== currentUser.value.uid);
            // 편집(공동 관리자) 권한으로 공유받은 트리는 "공유받은 트리"가 아니라 "내 트리 목록"에 표시
            const coManaged = sharedDocs
              .filter(t => (((t.sharePermissions || {})[email]) || {}).role === 'editor')
              .map(t => ({ ...t, _coManaged: true }));
            const viewOnly = sharedDocs
              .filter(t => (((t.sharePermissions || {})[email]) || {}).role !== 'editor');
            savedTrees.value = [...savedTrees.value, ...coManaged]
              .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            sharedTrees.value = viewOnly
              .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          } else {
            sharedTrees.value = [];
          }

          // 슈퍼 관리자: 기술 지원 요청된 트리만 조회
          if (ADMIN_EMAILS.includes(email)) {
            try {
              const supportSnap = await getDocs(query(col, where('supportRequested', '==', true)));
              supportRequestedTrees.value = supportSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(t => t.ownerId !== currentUser.value.uid)
                .sort((a,b) => (b.supportRequestedAt?.seconds||0) - (a.supportRequestedAt?.seconds||0));
            } catch(e2) { console.warn('지원 요청 트리 조회 실패:', e2); }
          }
        } catch (e) {
          console.error("Error fetching trees:", e);
        }
      };

      const createNewTree = () => {
        currentTreeId.value = 'tree_' + Date.now();
        Object.assign(header, defaultHeader());
        const root = defaultRoot();
        // 로그인한 사용자 정보로 Root 이름/이메일 확정 반영 (displayName → 없으면 이메일 local-part)
        if (currentUser.value) {
          if (currentUser.value.email) root.email = currentUser.value.email;
          if (currentUser.value.displayName) {
            root.name = currentUser.value.displayName;
          } else if (currentUser.value.email && !root.name) {
            root.name = currentUser.value.email.split('@')[0];
          }
        }
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

            // tombstone: 양쪽의 삭제 마커를 합산
            const parentDeletedIds = new Set(deletedAptIds.value || []);
            const subDeletedIds = new Set(subTreeData.data.deletedAptIds || []);
            const mergedDeletedIds = new Set([...parentDeletedIds, ...subDeletedIds]);

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

            // tombstone 적용: 삭제 마커에 있는 약속은 병합 결과에서 제거
            mergedDeletedIds.forEach(id => aptMap.delete(id));
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
              dfd: header.sfd || header.dfd,
              nfd: header.dfd || header.nfd,
              efd: header.nfd || header.efd
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
                deletedAptIds: Array.from(mergedDeletedIds),
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

          // tombstone: 양쪽의 삭제 마커를 합산하여 병합 결과에서 제거
          const parentDeletedSet = new Set(parentData.data.deletedAptIds || []);
          const subDeletedSet = new Set(subTreeData.data.deletedAptIds || []);
          const mergedDeletedSet = new Set([...parentDeletedSet, ...subDeletedSet]);
          mergedDeletedSet.forEach(id => aptMergeMap.delete(id));

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
              deletedAptIds: Array.from(mergedDeletedSet),
              notes: parentNotes
            }
          };

          await updateDoc(parentRef, updatedParentData);

          // savedTrees 캐시를 즉시 갱신: 다음에 메인 트리를 열 때 stale 데이터를 로드하지 않도록
          const cachedIdx = savedTrees.value.findIndex(t => t.id === subTreeData.parentTreeId);
          if (cachedIdx >= 0) {
            savedTrees.value[cachedIdx] = { ...savedTrees.value[cachedIdx], ...updatedParentData };
          }
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

      const isAdmin = computed(() => ADMIN_EMAILS.includes((currentUser.value?.email || '').toLowerCase()));
      const isManager = computed(() => ['admin', 'manager'].includes(userAccessStatus.value));

      const fetchRegisteredUsers = async () => {
        if (!isAdmin.value) return;
        try {
          const now = Date.now();
          const snap = await getDocs(collection(db, 'registeredUsers'));
          const mapped = snap.docs.map(d => {
            const data = d.data();
            const joinedMs = data.joinedAt?.seconds ? data.joinedAt.seconds * 1000 : 0;
            const daysPassed = joinedMs ? Math.floor((now - joinedMs) / (1000*60*60*24)) : 0;
            const remaining = 30 - daysPassed;
            const s = data.status || 'pending';
            return {
              uid: d.id, ...data,
              joinedAtStr: data.joinedAt?.toDate?.()?.toLocaleDateString('ko-KR') || '-',
              lastLoginAtStr: data.lastLoginAt?.toDate?.()?.toLocaleDateString('ko-KR') || '-',
              daysInfo: (s !== 'approved' && s !== 'denied') ? (remaining > 0 ? `유예 ${remaining}일` : '만료') : ''
            };
          }).sort((a,b) => (b.joinedAt?.seconds||0) - (a.joinedAt?.seconds||0));
          registeredUsers.value = mapped;
        } catch (e) { console.error('사용자 목록 로드 실패:', e); }
      };

      const approveUser = async (uid) => {
        if (!isAdmin.value) return;
        try {
          await updateDoc(doc(db, 'registeredUsers', uid), { status: 'approved', approvedAt: serverTimestamp(), approvedBy: currentUser.value.email || '' });
          await fetchRegisteredUsers();
          showToastMsg('승인되었습니다.');
        } catch (e) { console.error(e); showToastMsg('승인 실패', 'error'); }
      };

      const denyUser = async (uid) => {
        if (!isAdmin.value) return;
        try {
          await updateDoc(doc(db, 'registeredUsers', uid), { status: 'denied', deniedAt: serverTimestamp(), deniedBy: currentUser.value.email || '' });
          await fetchRegisteredUsers();
          showToastMsg('비승인 처리되었습니다.');
        } catch (e) { console.error(e); showToastMsg('비승인 실패', 'error'); }
      };

      const bulkApprove = async () => {
        if (!isAdmin.value || adminSelectedUids.value.length === 0) return;
        const uids = [...adminSelectedUids.value];
        try {
          for (const uid of uids) {
            await updateDoc(doc(db, 'registeredUsers', uid), { status: 'approved', approvedAt: serverTimestamp(), approvedBy: currentUser.value.email || '' });
          }
          adminSelectedUids.value = [];
          await fetchRegisteredUsers();
          showToastMsg(`${uids.length}명 승인 완료`);
        } catch (e) { console.error(e); showToastMsg('일괄 승인 실패', 'error'); }
      };

      const bulkDeny = async () => {
        if (!isAdmin.value || adminSelectedUids.value.length === 0) return;
        const uids = [...adminSelectedUids.value];
        try {
          for (const uid of uids) {
            await updateDoc(doc(db, 'registeredUsers', uid), { status: 'denied', deniedAt: serverTimestamp(), deniedBy: currentUser.value.email || '' });
          }
          adminSelectedUids.value = [];
          await fetchRegisteredUsers();
          showToastMsg(`${uids.length}명 비승인 처리 완료`);
        } catch (e) { console.error(e); showToastMsg('일괄 비승인 실패', 'error'); }
      };

      const approveAsManager = async (uid) => {
        if (!isAdmin.value) return;
        try {
          await updateDoc(doc(db, 'registeredUsers', uid), { status: 'manager', approvedAt: serverTimestamp(), approvedBy: currentUser.value.email || '' });
          await fetchRegisteredUsers();
          showToastMsg('관리자 그룹으로 승인되었습니다.');
        } catch (e) { console.error(e); showToastMsg('승인 실패', 'error'); }
      };

      // 사용자: "기술 지원 요청" 버튼 → 요청 내용 작성 모달 열기
      // 기존 요청이 있으면 기존 subject/message 를 불러와 수정 가능
      const openSupportRequestModal = (tree) => {
        if (!tree) return;
        supportRequestForm.treeId = tree.id;
        supportRequestForm.treeName = tree.name || '제목 없는 트리';
        supportRequestForm.subject = tree.supportRequestSubject || '';
        supportRequestForm.message = tree.supportRequestMessage || '';
        showSupportRequestModal.value = true;
      };

      // 사용자: 요청 내용 작성 후 "전송" → Firestore 업데이트 + 관리자 메일 발송
      const submitSupportRequest = async () => {
        if (!currentUser.value) return;
        const treeId = (supportRequestForm.treeId || '').trim();
        if (!treeId) return showToastMsg('트리 정보가 없습니다.', 'error');
        const subject = (supportRequestForm.subject || '').trim();
        const message = (supportRequestForm.message || '').trim();
        if (!message) return showToastMsg('요청 내용을 입력해 주세요.', 'error');
        try {
          const requesterName = currentUser.value.displayName || currentUser.value.email || '사용자';
          const requesterEmail = currentUser.value.email || '';
          await updateDoc(doc(db, getTreesPath(), treeId), {
            supportRequested: true,
            supportRequestedAt: serverTimestamp(),
            supportRequestedBy: currentUser.value.uid,
            supportRequesterName: requesterName,
            supportRequesterEmail: requesterEmail,
            supportRequestSubject: subject,
            supportRequestMessage: message
          });
          try {
            const treeName = supportRequestForm.treeName || treeId;
            const escapedMsg = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            const escapedSubj = (subject || '(제목 없음)').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            await addDoc(collection(db, 'mail'), {
              to: ADMIN_EMAILS,
              message: {
                subject: `[Family Tree] 기술 지원 요청: ${subject || treeName}`,
                html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
                  <h2 style="color:#1c2b4a;margin-bottom:8px;">🆘 기술 지원 요청</h2>
                  <p style="color:#444;line-height:1.7;margin:0 0 12px 0;">
                    <b>${requesterName}</b> (${requesterEmail})님이 기술 지원을 요청했습니다.<br>
                    트리: <b>${treeName}</b>
                  </p>
                  <div style="margin-top:12px;padding:12px 14px;background:#f7f4eb;border:1px solid #ece5cf;border-radius:6px;">
                    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">요청 제목</div>
                    <div style="font-size:14px;color:#1c2b4a;font-weight:700;margin-bottom:10px;">${escapedSubj}</div>
                    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">요청 내용</div>
                    <div style="font-size:13px;color:#333;line-height:1.6;white-space:pre-wrap;">${escapedMsg}</div>
                  </div>
                  <a href="https://familytree.itdowoomi.com/" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1c2b4a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
                    Family Tree 열기
                  </a>
                </div>`
              }
            });
          } catch(mailErr) { console.warn('지원 요청 알림 실패:', mailErr); }
          showSupportRequestModal.value = false;
          supportRequestForm.treeId = '';
          supportRequestForm.treeName = '';
          supportRequestForm.subject = '';
          supportRequestForm.message = '';
          await fetchSavedTrees();
          showToastMsg('기술 지원이 요청되었습니다. 관리자에게 알림이 전송됩니다.');
        } catch(e) { console.error(e); showToastMsg('요청 실패', 'error'); }
      };

      const endSupportRequest = async (treeId) => {
        if (!currentUser.value) return;
        try {
          await updateDoc(doc(db, getTreesPath(), treeId), {
            supportRequested: false,
            supportRequestedAt: null,
            supportRequestedBy: null,
            supportRequesterName: null,
            supportRequesterEmail: null,
            supportRequestSubject: null,
            supportRequestMessage: null
          });
          // 상세 모달 닫기 (관리자가 요청 상세 모달에서 종료를 눌렀을 때를 위한 처리)
          if (selectedSupportRequest.value && selectedSupportRequest.value.id === treeId) {
            showSupportDetailModal.value = false;
            selectedSupportRequest.value = null;
          }
          await fetchSavedTrees();
          showToastMsg('기술 지원 요청이 종료되었습니다.');
        } catch(e) { console.error(e); showToastMsg('종료 실패', 'error'); }
      };

      // 관리자: 지원 요청 카드 클릭 시 상세 모달 열기
      const openSupportDetailModal = (tree) => {
        if (!tree) return;
        selectedSupportRequest.value = tree;
        showSupportDetailModal.value = true;
      };

      // 관리자: 상세 모달에서 "트리 열기" → 모달 닫고 해당 트리 로드
      const openSupportRequestTree = (tree) => {
        showSupportDetailModal.value = false;
        selectedSupportRequest.value = null;
        if (tree) loadTree(tree);
      };

      const sendAppInvite = async (email) => {
        const trimmed = (email || '').trim().toLowerCase();
        if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return showToastMsg('올바른 이메일을 입력하세요.', 'error');
        if (currentUser.value?.email && trimmed === currentUser.value.email.toLowerCase()) return showToastMsg('본인 이메일은 초대할 수 없습니다.', 'error');
        try {
          await setDoc(doc(db, 'invitedEmails', trimmed), { email: trimmed, invitedBy: currentUser.value.email || '', invitedAt: serverTimestamp(), type: 'app_invite' });
          const inviterName = currentUser.value.displayName || currentUser.value.email || '관리자';
          const inviterEmail = currentUser.value.email || '';
          await addDoc(collection(db, 'mail'), {
            to: trimmed,
            replyTo: inviterEmail,
            message: {
              subject: `[Family Tree] ${inviterName}님이 Family Tree에 초대했습니다`,
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
                  <h2 style="color:#1c2b4a;margin-bottom:8px;">Family Tree 초대</h2>
                  <p style="color:#444;line-height:1.7;">
                    <b>${inviterName}</b>님이 <b>Family Tree</b> 사용을 초대했습니다.<br>
                    Google 계정으로 로그인하면 나만의 패밀리 트리를 만들 수 있습니다.
                  </p>
                  <a href="https://familytree.itdowoomi.com/"
                     style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1c2b4a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
                    Family Tree 시작하기
                  </a>
                  <p style="margin-top:16px;font-size:13px;color:#555;">
                    문의사항은 이 이메일에 답장하시면 <b>${inviterName}</b>(${inviterEmail})님께 전달됩니다.
                  </p>
                  <p style="margin-top:12px;font-size:12px;color:#999;">https://familytree.itdowoomi.com/</p>
                </div>
              `
            }
          });
          appInviteEmail.value = '';
          showToastMsg(`${trimmed} 님께 초대장을 발송했습니다.`);
        } catch (e) { console.error(e); showToastMsg('초대 발송 실패', 'error'); }
      };

      const deleteRegisteredUser = async (uid, email) => {
        if (!isAdmin.value) return;
        if (!confirm(`${email} 사용자를 목록에서 삭제하시겠습니까?`)) return;
        try {
          await deleteDoc(doc(db, 'registeredUsers', uid));
          registeredUsers.value = registeredUsers.value.filter(u => u.uid !== uid);
          showToastMsg(`${email} 삭제 완료`);
        } catch (e) { console.error(e); showToastMsg('삭제 실패', 'error'); }
      };

      // status 값이 공백/대소문자/null로 들어와도 안전하게 정규화
      function _normStatus(s) { return (typeof s === 'string' ? s.trim().toLowerCase() : ''); }
      // 단일 진실 소스: 탭 카운트와 리스트 모두 이 함수를 사용 → 필터 불일치 방지
      function adminUsersForTab(tabKey) {
        const users = Array.isArray(registeredUsers.value) ? registeredUsers.value : [];
        if (tabKey === 'pending') return users.filter(u => { const s = _normStatus(u.status); return !s || s === 'pending'; });
        if (tabKey === 'manager') return users.filter(u => _normStatus(u.status) === 'manager');
        if (tabKey === 'approved') return users.filter(u => _normStatus(u.status) === 'approved');
        if (tabKey === 'denied')   return users.filter(u => _normStatus(u.status) === 'denied');
        return [];
      }
      const adminTabUsers = computed(() => adminUsersForTab(adminTab.value));

      const adminPendingCount = computed(() => adminUsersForTab('pending').length);

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
          // 초대된 이메일 선승인 처리
          try {
            await setDoc(doc(db, 'invitedEmails', trimmed), { email: trimmed, invitedBy: currentUser.value.email || '', invitedAt: serverTimestamp(), treeId: currentTreeId.value });
          } catch (e2) { console.warn('초대 선승인 기록 실패:', e2); }
          showToastMsg(`🔗 ${trimmed} 님에게 공유되었습니다.`);
          try {
            const inviterName = currentUser.value.displayName || currentUser.value.email || '관리자';
            const inviterEmail = currentUser.value.email || '';
            const treeName = header.title || 'Family Tree';
            await addDoc(collection(db, 'mail'), {
              to: trimmed,
              replyTo: inviterEmail,
              message: {
                subject: `[Family Tree] ${inviterName}님이 트리를 공유했습니다`,
                html: `
                  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
                    <h2 style="color:#1c2b4a;margin-bottom:8px;">Family Tree 초대</h2>
                    <p style="color:#444;line-height:1.7;">
                      <b>${inviterName}</b>님이 <b>${treeName}</b>을(를) 공유했습니다.<br>
                      아래 링크로 접속하여 확인하세요.
                    </p>
                    <a href="https://familytree.itdowoomi.com/"
                       style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1c2b4a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
                      Family Tree 열기
                    </a>
                    <p style="margin-top:16px;font-size:13px;color:#555;">
                      문의사항은 이 이메일에 답장하시면 <b>${inviterName}</b>(${inviterEmail})님께 전달됩니다.
                    </p>
                    <p style="margin-top:12px;font-size:12px;color:#999;">
                      https://familytree.itdowoomi.com/
                    </p>
                  </div>
                `
              }
            });
          } catch (mailErr) {
            console.warn('초대 메일 발송 실패:', mailErr);
          }
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
            // 초대 선승인 + 이메일 발송
            try { await setDoc(doc(db, 'invitedEmails', trimmedEmail), { email: trimmedEmail, invitedBy: currentUser.value.email || '', invitedAt: serverTimestamp(), treeId: existingTree.id }); } catch(e2){}
            try {
              const inviterName = currentUser.value.displayName || currentUser.value.email || '관리자';
              const inviterEmail = currentUser.value.email || '';
              await addDoc(collection(db, 'mail'), { to: trimmedEmail, replyTo: inviterEmail, message: { subject: `[Family Tree] ${inviterName}님이 서브 트리를 공유했습니다`, html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;"><h2 style="color:#1c2b4a;margin-bottom:8px;">Family Tree 초대</h2><p style="color:#444;line-height:1.7;"><b>${inviterName}</b>님이 <b>${subRoot.name}</b>의 서브 트리를 공유했습니다.<br>아래 링크로 접속하여 확인하세요.</p><a href="https://familytree.itdowoomi.com/" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1c2b4a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Family Tree 열기</a><p style="margin-top:16px;font-size:13px;color:#555;">문의사항은 이 이메일에 답장하시면 <b>${inviterName}</b>(${inviterEmail})님께 전달됩니다.</p><p style="margin-top:12px;font-size:12px;color:#999;">https://familytree.itdowoomi.com/</p></div>` } });
            } catch(mailErr) { console.warn('초대 메일 발송 실패:', mailErr); }

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
            dfd: header.sfd || header.dfd,
            nfd: header.dfd || header.nfd,
            efd: header.nfd || header.efd
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
          // 초대 선승인 + 이메일 발송
          try { await setDoc(doc(db, 'invitedEmails', trimmedEmail), { email: trimmedEmail, invitedBy: currentUser.value.email || '', invitedAt: serverTimestamp(), treeId: newTreeId }); } catch(e2){}
          try {
            const inviterName = currentUser.value.displayName || currentUser.value.email || '관리자';
            const inviterEmail = currentUser.value.email || '';
            await addDoc(collection(db, 'mail'), { to: trimmedEmail, replyTo: inviterEmail, message: { subject: `[Family Tree] ${inviterName}님이 서브 트리를 공유했습니다`, html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;"><h2 style="color:#1c2b4a;margin-bottom:8px;">Family Tree 초대</h2><p style="color:#444;line-height:1.7;"><b>${inviterName}</b>님이 <b>${subRoot.name}</b>의 서브 트리를 공유했습니다.<br>아래 링크로 접속하여 확인하세요.</p><a href="https://familytree.itdowoomi.com/" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1c2b4a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Family Tree 열기</a><p style="margin-top:16px;font-size:13px;color:#555;">문의사항은 이 이메일에 답장하시면 <b>${inviterName}</b>(${inviterEmail})님께 전달됩니다.</p><p style="margin-top:12px;font-size:12px;color:#999;">https://familytree.itdowoomi.com/</p></div>` } });
          } catch(mailErr) { console.warn('초대 메일 발송 실패:', mailErr); }

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
        const out = { fd: '', sfd: '', dfd: '', nfd: '', efd: '' };
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
        out.dfd = findNearest(sid, 'DFD') || header.dfd || '';
        out.nfd = findNearest(sid, 'NFD') || header.nfd || '';
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
          dfd: up.dfd,
          nfd: up.nfd,
          efd: up.efd
        };
      });
      const selectedIsRootView = computed(() => !selectedMemberId.value || selectedMemberId.value === 'root');
      // 기본 정보 탭에서 지금 편집 대상인 멤버 (root 뷰면 root, 아니면 선택된 멤버) — 배우자 통합 인물 반복 표시에 사용
      const activeInfoMember = computed(() => selectedIsRootView.value ? rootMember.value : selectedMember.value);
      // 트리 타이틀에 표시할 회원 ID 코드 (배우자 통합된 경우 콤마로 이어붙임: 예 "SCA87396, SCA46478")
      const rootDisplayCode = computed(() => {
        const codes = [header.id];
        if (rootMember.value && rootMember.value.mergedPeople) {
          rootMember.value.mergedPeople.forEach(p => { if (p.memberCode) codes.push(p.memberCode); });
        }
        return codes.filter(Boolean).join(', ');
      });

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
          if (n.scope !== 'personal') return true;
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
               if (n.scope !== 'personal' && (!n.createdBy || selectedNames.has(n.createdBy))) return true;
               if (n.createdBy && selectedNames.has(n.createdBy)) return true;
               return false;
           })
        };
      });

      const tabMembers = computed(() => tabContext.value.members);
      const sideHistMember = computed(() => expandedMemberId.value ? (tabMembers.value.find(m => m.id === expandedMemberId.value) || null) : null);
      const sideInteractionMember = computed(() => expandedInteractionId.value ? (tabMembers.value.find(m => m.id === expandedInteractionId.value) || null) : null);
      const sideDispositionMember = computed(() => expandedDispositionId.value ? (tabMembers.value.find(m => m.id === expandedDispositionId.value) || null) : null);
      const sideTrainingMember = computed(() => expandedTrainingId.value ? (tabMembers.value.find(m => m.id === expandedTrainingId.value) || null) : null);
      const recentTeamHistory = computed(() => {
        const all = [];
        for (const m of tabMembers.value) {
          if (m.history) {
            for (const h of m.history) {
              all.push({ ...h, _memberName: m.name, _member: m });
            }
          }
        }
        return all.sort((a, b) => parseDateForSort(b.date) - parseDateForSort(a.date)).slice(0, 10);
      });
      const recentTeamInteractions = computed(() => {
        const all = [];
        for (const m of tabMembers.value) {
          if (m.interactionHistory) {
            for (const h of m.interactionHistory) {
              all.push({ ...h, _memberName: m.name, _member: m });
            }
          }
        }
        return all.sort((a, b) => parseDateForSort(b.date) - parseDateForSort(a.date)).slice(0, 10);
      });
      // ── Recruit 핀: 부부(배우자 통합) 팀이 각자 로그인해서 "내가 아는 사람"을 체크 ──
      // 한 사람만 체크하면 그 사람 고유 색(파랑/초록), 둘 다 체크하면 빨강(둘 다 아는 사람).
      // 정렬 우선순위는 지금 로그인한 사람 기준으로 "내 색"이 "상대 색"보다 위에 오도록 계산.
      function recruitOwnerCoupleEmails(r){
        const owner = members.value.find(m => m.id === r.parentId);
        if(!owner) return { primary: '', secondary: '' };
        const primary = (owner.email || '').toLowerCase();
        const secondaryPerson = (owner.mergedPeople || [])[0];
        const secondary = secondaryPerson ? (secondaryPerson.email || '').toLowerCase() : '';
        return { primary, secondary };
      }
      function recruitPinState(r){
        const pinnedBy = (r.pinnedBy || []).map(e => (e || '').toLowerCase()).filter(Boolean);
        if(!pinnedBy.length) return 'none';
        const { primary, secondary } = recruitOwnerCoupleEmails(r);
        const hasPrimary = primary && pinnedBy.includes(primary);
        const hasSecondary = secondary && pinnedBy.includes(secondary);
        if(pinnedBy.length >= 2 || (hasPrimary && hasSecondary)) return 'red';
        if(hasPrimary) return 'blue';
        if(hasSecondary) return 'green';
        return 'blue'; // 커플 이메일과 매칭되지 않는 다른 공동 관리자가 체크한 경우의 기본값
      }
      function recruitPinColor(r){
        const state = recruitPinState(r);
        if(state==='red') return '#e74c3c';
        if(state==='green') return '#27ae60';
        if(state==='blue') return '#2d6cdf';
        return '';
      }
      function recruitPinMyColor(r){
        const myEmail = ((currentUser.value && currentUser.value.email) || '').toLowerCase();
        if(!myEmail) return '';
        const { primary, secondary } = recruitOwnerCoupleEmails(r);
        if(myEmail === primary) return 'blue';
        if(myEmail === secondary) return 'green';
        return '';
      }
      function recruitPinTitle(r){
        const state = recruitPinState(r);
        if(state==='none') return '클릭하면 내가 아는 사람으로 표시';
        if(state==='red') return '둘 다 아는 사람';
        const myColor = recruitPinMyColor(r);
        if(myColor && state===myColor) return '나만 아는 사람';
        return '상대방만 아는 사람';
      }
      function togglePinForRecruit(r){
        const email = ((currentUser.value && currentUser.value.email) || '').toLowerCase();
        if(!email) return;
        const list = new Set((r.pinnedBy || []).map(e => (e || '').toLowerCase()).filter(Boolean));
        if(list.has(email)) list.delete(email); else list.add(email);
        r.pinnedBy = Array.from(list);
      }
      function recruitPinPriority(r){
        const state = recruitPinState(r);
        if(state==='none') return 0;
        if(state==='red') return 3;
        const myColor = recruitPinMyColor(r);
        if(myColor && state===myColor) return 2; // 지금 로그인한 사람의 색이 상대방 색보다 위
        return 1;
      }
      const tabRecruitsSorted = computed(() => [...tabContext.value.recruits].filter(r => !r.recruitPending).sort((a,b)=>{
        const pa = recruitPinPriority(a), pb = recruitPinPriority(b);
        if(pa !== pb) return pb - pa; // 핀 고정된 항목을 최상단으로 (빨강 > 내 색 > 상대 색 > 없음)
        return (b.score||0)-(a.score||0);
      }));
      // 펜딩 리스트 탭: 펜딩 처리된 리크루트만, Recruit 탭과 동일한 정렬 기준
      const tabPendingRecruitsSorted = computed(() => [...tabContext.value.recruits].filter(r => r.recruitPending).sort((a,b)=>{
        const pa = recruitPinPriority(a), pb = recruitPinPriority(b);
        if(pa !== pb) return pb - pa;
        return (b.score||0)-(a.score||0);
      }));
      const tabNotes = computed(() => tabContext.value.notes || notes.value);
      const tabUpcomingAppointments = computed(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        return tabContext.value.appointments.filter(a => {
            const d = new Date(a.date.replace(/[-./]/g, '/'));
            return d >= today;
        }).sort((a,b) => new Date(a.date.replace(/[-./]/g, '/')) - new Date(b.date.replace(/[-./]/g, '/')));
      });
      // 약속 관리 탭의 메인 목록: 날짜가 지나도 "히스토리로 이관" 하기 전까지는 계속 표시 (날짜 필터 없음)
      const tabAllAppointmentsSorted = computed(() => {
        return [...tabContext.value.appointments].sort((a,b) => new Date(a.date.replace(/[-./]/g, '/')) - new Date(b.date.replace(/[-./]/g, '/')));
      });
      // 사이드바 디스플레이 패널에 보여줄 약속: 확인(confirmed)된 항목은 숨김
      const visibleSidebarAppointments = computed(() => {
        return tabUpcomingAppointments.value.filter(a => !a.confirmed);
      });

      const availableStatuses = computed(() => STATUSES.filter(s => legendConfig.value.items[s] && legendConfig.value.items[s].show));
      // 범례에서 이름을 바꾼 경우, 내부 상태값(status)은 그대로 두고 화면에 표시되는 라벨만 범례 라벨을 따라가도록 함
      function statusLabel(s){
        if(!s) return s;
        if(s === 'root') return '최상위';
        const cfg = legendConfig.value.items[s];
        return (cfg && cfg.label) ? cfg.label : s;
      }
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
      
      // 범례 체크가 꺼진 직책(status)은 트리 노드에서도 숨김 (root 노드 자신은 항상 표시)
      function isStatusVisible(status){
        if(!status) return true;
        const cfg = legendConfig.value.items[status];
        return !cfg || cfg.show !== false;
      }
      const visibleFocusedList = computed(() => {
        const list = focusedList.value;
        const idMap = {}; list.forEach(m=>idMap[m.id]=m);
        const hiddenIds = new Set(list.filter(m=>m.parentId && !isStatusVisible(m.status)).map(m=>m.id));
        if(!hiddenIds.size) return list;
        return list.filter(m=>!hiddenIds.has(m.id)).map(m=>{
          if(!m.parentId || !hiddenIds.has(m.parentId)) return m;
          let pid = m.parentId;
          while(pid && hiddenIds.has(pid)){ const p = idMap[pid]; pid = p ? p.parentId : null; }
          return { ...m, parentId: pid };
        });
      });
      const rootMember = computed(() => focusedList.value.find(m=>!m.parentId));
      const rootMemberName = computed(() => rootMember.value ? rootMember.value.name : '');
      const rootMemberEmail = computed(() => rootMember.value ? (rootMember.value.email || '') : '');
      const currentMembers = computed(() => focusRootId.value ? focusedList.value : members.value);
      // 부부(배우자 통합) 멤버의 이름에서 본인(첫 번째) 개인 이름만 추출. 예) "방동혁, 김은숙" → "방동혁"
      function memberPrimaryName(m){
        if(!m) return '';
        if(m.mergedPeople && m.mergedPeople.length) return (m.name||'').split(',')[0].trim();
        return m.name || '';
      }
      // 상위 멤버 선택용: 부부인 경우 두 사람을 각각의 옵션으로 분리해서 보여준다.
      // (트리 상의 소속 멤버는 동일 - memberId. 개인 이름은 Recruit 작성자 표기에 사용)
      const parentPersonOptions = computed(() => {
        const list = [];
        for(const m of currentMembers.value){
          if(m.mergedPeople && m.mergedPeople.length){
            list.push({ key: m.id+'::0', memberId: m.id, name: memberPrimaryName(m) });
            m.mergedPeople.forEach((p, idx) => {
              list.push({ key: m.id+'::'+(idx+1), memberId: m.id, name: (p.name||'').trim() || `배우자${idx+1}` });
            });
          } else {
            list.push({ key: m.id+'::0', memberId: m.id, name: m.name || '' });
          }
        }
        return list;
      });
      
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

        // 펜딩 처리된 리크루트는 트리/인쇄용 목록에서 제외 (펜딩 리스트 탭에서만 표시)
        filtered = filtered.filter(r => !r.recruitPending);

        return [...filtered].sort((a,b)=>(b.score||0)-(a.score||0));
      });
      const visibleRecruits = computed(() => recruitsSortedAll.value.filter(r=>r.show));
      
      const selectedMember = computed(() => members.value.find(m => m.id === selectedMemberId.value));
      const memberNames = computed(() => members.value.map(m => m.name));
      const recruitNames = computed(() => recruits.value.map(r => r.name));

      const uplineMemberNames = computed(() => {
          const names = [header.fd, header.sfd, header.dfd, header.nfd, header.efd].map(n => (n || '').trim()).filter(Boolean);
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

      // 전체 합계(Point/Issue Paid/Pending) 집계 기준: 기간 합계 | 연도 합계 | 전체 합계
      const pointSumMode = ref('year'); // 'period' | 'year' | 'all'
      const pointSumYear = ref(new Date().getFullYear());

      function fmtDateDot(dStr){
        if(!dStr) return '';
        const parts = dStr.trim().split(/[-/]/);
        if(parts.length<2) return dStr;
        let m=parseInt(parts[0],10), day=parseInt(parts[1],10), y=parts.length>2?parseInt(parts[2],10):new Date().getFullYear();
        if(isNaN(m)||isNaN(day)||isNaN(y)) return dStr;
        if(y<100) y+=2000;
        return `${m}.${day}.${y}`;
      }
      function historyInSumScope(h){
        if(!h || !h.date) return true;
        if(pointSumMode.value === 'all') return true;
        if(pointSumMode.value === 'period') return histInRange(h);
        if(pointSumMode.value === 'year'){
          const t = parseDateForSort(h.date);
          if(!t) return true;
          return new Date(t).getFullYear() === Number(pointSumYear.value);
        }
        return true;
      }
      const teamTotalScopeLabel = computed(() => {
        if(pointSumMode.value === 'all') return '(전체 기간)';
        if(pointSumMode.value === 'year') return `(${pointSumYear.value}년)`;
        if(pointSumMode.value === 'period') return `(${fmtDateDot(header.periodStart)}~${fmtDateDot(header.periodEnd)})`;
        return '';
      });

      // 기본정보에서 선택한 기간(기간 합계/연도 합계/전체 합계) 기준으로 계산되는 포인트/실적 값
      function mPtsSumScoped(m){ if(!m || !m.history) return 0; return m.history.filter(h=>h.show && historyInSumScope(h)).reduce((s,h)=>s+(Number(h.point)||0),0); }
      function getMemberIssuePaidScoped(m){ if(!m || !m.history) return 0; return m.history.filter(h=>h.show && h.type==='Issue Paid' && historyInSumScope(h)).reduce((s,h)=>s+(Number(h.amount)||0),0); }
      function getMemberPendingScoped(m){ if(!m || !m.history) return 0; return m.history.filter(h=>h.show && h.type==='Pending' && historyInSumScope(h)).reduce((s,h)=>s+(Number(h.amount)||0),0); }
      function getRawMemberTotalScoped(m){ return getMemberIssuePaidScoped(m) + getMemberPendingScoped(m); }
      function getMemberTotalScoped(m){ return fmt(getRawMemberTotalScoped(m)); }
      function getIncomePercentScoped(m){ const mTotal=getRawMemberTotalScoped(m); const tTotal=teamTotal.value.total; if(tTotal===0||mTotal===0) return 0; return Math.min(100, Math.max(0,(mTotal/tTotal)*100)); }

      const teamTotal = computed(() => {
        const l = focusedList.value;
        const points = l.reduce((s,m)=> s + mPtsSumScoped(m), 0);
        const paid = l.reduce((s,m)=> s + getMemberIssuePaidScoped(m), 0);
        const pend = l.reduce((s,m)=> s + getMemberPendingScoped(m), 0);
        return { points, paid, pending:pend, total:paid+pend };
      });
      // 사이드바 "합계" 박스: 트리에서 현재 선택/포커스된 노드(activeInfoMember) 한 명의 포인트/이슈페이드/펜딩/토탈
      const selectedNodeTotal = computed(() => {
        const m = activeInfoMember.value;
        if(!m) return { points:0, paid:0, pending:0, total:0 };
        return { points: mPtsSumScoped(m), paid: getMemberIssuePaidScoped(m), pending: getMemberPendingScoped(m), total: getRawMemberTotalScoped(m) };
      });

      // ── 승급 기준 (Promotion Criteria) ──
      // STATUSES 배열 순서 = 직급 서열(선임→말단). 특정 상태의 "다음 승급 랭크"는 배열에서 바로 앞(더 상위) 항목.
      function nextRankFor(status){
        const idx = STATUSES.indexOf(status);
        if(idx <= 0) return null;
        return STATUSES[idx-1];
      }
      function ensurePromoCriteria(rank){
        if(!rank) return null;
        if(!promotionCriteria.value[rank]){
          promotionCriteria.value = { ...promotionCriteria.value, [rank]: { requirements: [], points: 0, cases: 0, customNote: '' } };
        } else {
          if(typeof promotionCriteria.value[rank].customNote !== 'string'){
            promotionCriteria.value[rank].customNote = '';
          }
          if(typeof promotionCriteria.value[rank].cases !== 'number'){
            promotionCriteria.value[rank].cases = 0;
          }
        }
        return promotionCriteria.value[rank];
      }
      function addPromoRequirement(){
        if(!promoEditRank.value || !newPromoReq.statuses.length) return;
        const crit = ensurePromoCriteria(promoEditRank.value);
        const key = [...newPromoReq.statuses].sort().join('|');
        if(crit.requirements.some(r=>normalizeReqStatuses(r).sort().join('|')===key)) { newPromoReq.statuses=[]; return; }
        crit.requirements = [...crit.requirements, { statuses:[...newPromoReq.statuses], count:1 }];
        newPromoReq.statuses = [];
      }
      function removePromoRequirement(rank, idx){
        const crit = promotionCriteria.value[rank]; if(!crit) return;
        crit.requirements = crit.requirements.filter((r,i)=>i!==idx);
      }
      // 구버전 데이터({status,count}) 호환: statuses 배열이 없으면 status 하나짜리 배열로 변환
      function normalizeReqStatuses(r){ return r.statuses || (r.status ? [r.status] : []); }
      function setPromoPoints(rank, val){
        const crit = ensurePromoCriteria(rank);
        crit.points = Number(val)||0;
      }
      // 승급 기준 설정 화면에서 직급을 선택하는 즉시 편집 가능한 항목(requirements/points)이 항상 존재하도록 보장
      watch(promoEditRank, (rank) => { if(rank) ensurePromoCriteria(rank); });
      // 특정 멤버의 하위 전체(모든 세대) 자손 목록 수집
      function collectDescendants(id){
        const result = [];
        function walk(pid){ members.value.filter(m=>m.parentId===pid).forEach(m=>{ result.push(m); walk(m.id); }); }
        walk(id);
        return result;
      }
      // 지정된 멤버 목록의 최근 N일 이내 포인트 합계
      function pointsInWindow(memberList, days){
        const now = Date.now(); const startTime = now - (Number(days)||0)*24*60*60*1000;
        let sum = 0;
        memberList.forEach(m=>{ (m.history||[]).filter(h=>h.show).forEach(h=>{ const t=parseDateForSort(h.date); if(t && t>=startTime && t<=now) sum += Number(h.point)||0; }); });
        return sum;
      }
      // 지정된 멤버 본인의 최근 N일 이내 Case 건수 (포인트가 부여된 히스토리 항목 = 1건의 Case로 인정)
      function casesInWindow(member, days){
        if(!member || !member.history) return 0;
        const now = Date.now(); const startTime = now - (Number(days)||0)*24*60*60*1000;
        return member.history.filter(h=>{
          if(!h.show || !(Number(h.point) > 0)) return false;
          const t = parseDateForSort(h.date);
          return t && t>=startTime && t<=now;
        }).length;
      }
      // 현재 선택/포커스된 멤버(activeInfoMember) 기준, 다음 승급까지의 진행률 계산
      const promotionProgress = computed(() => {
        const m = activeInfoMember.value;
        if(!m || !m.status) return null;
        const target = nextRankFor(m.status);
        if(!target) return { targetRank:null };
        const crit = promotionCriteria.value[target];
        if(!crit || (!crit.requirements.length && !crit.points && !crit.cases && !crit.customNote)) return { targetRank:target, noCriteria:true };
        const descendants = collectDescendants(m.id);
        const requirements = (crit.requirements||[]).map(r=>{
          const statuses = normalizeReqStatuses(r);
          const actual = descendants.filter(d=>statuses.includes(d.status)).length;
          const label = statuses.map(s=>statusLabel(s)).join(' 또는 ');
          return { statuses, label, required:r.count, actual, met: actual>=r.count, shortfall: Math.max(0, r.count-actual) };
        });
        const actualPoints = pointsInWindow([m, ...descendants], promotionWindowDays.value);
        const requiredPoints = crit.points||0;
        const actualCases = casesInWindow(m, promotionWindowDays.value);
        const requiredCases = crit.cases||0;
        return {
          targetRank: target,
          requirements,
          customNote: crit.customNote || '',
          points: { required: requiredPoints, actual: actualPoints, met: actualPoints>=requiredPoints, shortfall: Math.max(0, requiredPoints-actualPoints) },
          cases: { required: requiredCases, actual: actualCases, met: actualCases>=requiredCases, shortfall: Math.max(0, requiredCases-actualCases) }
        };
      });

      // 멤버 관리 탭: 고정 2단(좌: 선택 멤버 실적 / 우: 팀 전체 실적)으로 표시. 둘 다 기본정보에서 선택한 검색범위(historyInSumScope) 반영
      const perfMemberHistoryEntries = computed(() => {
        const m = activeInfoMember.value;
        if(!m) return [];
        return (m.history||[]).filter(h=>h.show && historyInSumScope(h)).map(h=>({ ...h, _member:m, _memberName:m.name })).sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date));
      });
      const perfTeamHistoryEntries = computed(() => {
        const rows = [];
        focusedList.value.forEach(m => { (m.history||[]).filter(h=>h.show && historyInSumScope(h)).forEach(h => rows.push({ ...h, _member:m, _memberName:m.name })); });
        rows.sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date));
        return rows;
      });
      const statusCounts = computed(() => {
        const c = {}; STATUSES.forEach(s => c[s] = 0);
        focusedList.value.forEach(m=>{ if(c[m.status]!==undefined) c[m.status]++; });
        return c;
      });
      const layout = computed(() => {
        const NW = nodeWidth.value, list = visibleFocusedList.value;
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
                  const dispKeys = ['relationScore', 'friendScore', 'market', 'married', 'child', 'house', 'income', 'ambition', 'dissatisfied', 'pma', 'entrepreneur', 'prejudice'];
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
                      const dispKeys = ['relationScore', 'friendScore', 'market', 'married', 'child', 'house', 'income', 'ambition', 'dissatisfied', 'pma', 'entrepreneur', 'prejudice'];
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
      // 멤버 사진 업로드: 파일을 정사각형으로 크롭 후 축소하여 base64로 저장 (Firestore 문서 용량 절약 + 원형 노드 표시에 최적)
      function onMemberPhotoSelected(m, e){
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if(!m || !file) return;
        if(!file.type.startsWith('image/')) { showToastMsg('이미지 파일만 업로드할 수 있습니다.', 'error'); return; }
        if(file.size > 8*1024*1024){ showToastMsg('이미지 용량이 너무 큽니다 (8MB 이하로 선택해 주세요).', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const SIZE = 240;
            const canvas = document.createElement('canvas');
            canvas.width = SIZE; canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
            ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
            m.photo = canvas.toDataURL('image/jpeg', 0.82);
            showToastMsg('📷 사진이 등록되었습니다.');
          };
          img.onerror = () => showToastMsg('이미지를 불러올 수 없습니다.', 'error');
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
      function removeMemberPhoto(m){ if(m) m.photo = ''; }
      // 부부(배우자 통합) 노드의 사진 2장 표기: 본인 사진을 앞쪽, 배우자(mergedPeople 중 사진이 있는 첫 인물) 사진을 뒤쪽에 겹쳐 표시
      function nodeFrontPhoto(m){ if(!m) return ''; if(m.photo) return m.photo; const p=(m.mergedPeople||[]).find(x=>x.photo); return p?p.photo:''; }
      function nodeBackPhoto(m){ if(!m || !m.photo) return ''; const p=(m.mergedPeople||[]).find(x=>x.photo); return p?p.photo:''; }
      function nodePhotoCount(m){ return (nodeFrontPhoto(m)?1:0) + (nodeBackPhoto(m)?1:0); }
      // 사진이 표기될 때 노드 상단(이름/뱃지) 영역의 높이 (확대된 원형 사진이 들어갈 공간을 확보)
      function photoBandHeight(){ return Math.max(nodeFontSize.value + 14, 52); }
      function nodeHeaderBand(m){
        const base = nodeFontSize.value + 14;
        if(!nodeDisplayConfig.value.showPhoto) return base;
        if(!nodeFrontPhoto(m) && !nodeBackPhoto(m)) return base;
        return photoBandHeight();
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
      // 노드에 이름/뱃지 아래로 표기되는 모든 줄(재무정보/포인트/히스토리)을 노드 표기 옵션에 맞춰 계산.
      // 각 항목은 variant(fin/total/divider/note/noteExtra)와 절대 y좌표를 함께 반환하여 템플릿이 단순 순회만 하도록 함.
      function nodeContentLines(m){
        const cfg = nodeDisplayConfig.value;
        const gap = nodeLineGap.value;
        let y = nodeHeaderBand(m); // 이름/뱃지(또는 사진) 아래 구분선 위치와 동일
        const lines = [];
        const hasFin = cfg.showIssuePaid || cfg.showPending;
        if(hasFin){
          const parts=[]; if(cfg.showIssuePaid) parts.push(`Paid: ${fmtS(getMemberIssuePaid(m))}`); if(cfg.showPending) parts.push(`Pend: ${fmtS(getMemberPending(m))}`);
          y += gap; lines.push({ variant:'fin', text: parts.join('  /  '), y });
          const pts = mPtsSum(m);
          y += gap; lines.push({ variant:'total', text:`Total: ${getMemberTotal(m)}`, ptsText:(cfg.showPoints && pts>0) ? `Pts: ${fmt(pts)}` : '', y });
        } else if(cfg.showPoints){
          const pts = mPtsSum(m);
          if(pts>0){ y += gap; lines.push({ variant:'total', text:'', ptsText:`Pts: ${fmt(pts)}`, y }); }
        }
        function pushHistBlock(entries, issuePaidOnly){
          if(!entries.length) return;
          y += 6; lines.push({ variant:'divider', y });
          entries.forEach(h=>{
            const val = h.content || ''; y += gap; lines.push({ variant:'note', text: h.date ? `[${h.date}] ${val}` : val, y });
            const extras=[]; if(Number(h.amount)) extras.push(`$${fmt(h.amount)}`); if(!issuePaidOnly && Number(h.point)) extras.push(`${fmt(h.point)} Pts`);
            if(extras.length){ y += gap; lines.push({ variant:'noteExtra', text: extras.join(' | '), y }); }
          });
        }
        if(cfg.showHistory){
          const n = Math.max(0, cfg.historyCount||0);
          const hist = (m.history||[]).filter(h=>h.show).sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date)).slice(0,n);
          pushHistBlock(hist, false);
        }
        if(cfg.showIssuePaidHistory){
          const n = Math.max(0, cfg.issuePaidHistoryCount||0);
          const hist = (m.history||[]).filter(h=>h.show && h.type==='Issue Paid').sort((a,b)=>parseDateForSort(b.date)-parseDateForSort(a.date)).slice(0,n);
          pushHistBlock(hist, true);
        }
        return lines;
      }
      function nodeH(m){
        const base = Math.max(nodeBaseHeight.value, nodeHeaderBand(m) + 10);
        const lines = nodeContentLines(m);
        if(!lines.length) return base;
        return Math.max(base, lines[lines.length-1].y + 10);
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
          if (!item.disposition) return; let total = 0;
          total += parseInt(item.disposition.relationScore) || 0;
          total += parseInt(item.disposition.friendScore) || 0;
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
      // 태블릿/모바일 터치 지원: 한 손가락 드래그 = 이동(pan), 두 손가락 = 핀치 확대/축소
      let touchPinchStartDist = 0, touchPinchStartZoom = 1;
      function touchDist(e){ const a=e.touches[0], b=e.touches[1]; return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); }
      function onTouchStart(e){
        if(e.touches.length===1){ const t=e.touches[0]; isPanning=true; panStartX=t.clientX; panStartY=t.clientY; panStartPX=panX.value; panStartPY=panY.value; e.currentTarget.classList.add('panning'); }
        else if(e.touches.length===2){ isPanning=false; touchPinchStartDist=touchDist(e); touchPinchStartZoom=zoomLevel.value; }
      }
      function onTouchMove(e){
        if(e.touches.length===2){ const dist=touchDist(e); if(touchPinchStartDist>0){ zoomLevel.value=Math.min(3,Math.max(0.2,+(touchPinchStartZoom*(dist/touchPinchStartDist)).toFixed(2))); } return; }
        if(!isPanning || e.touches.length!==1) return; const t=e.touches[0]; panX.value=panStartPX+(t.clientX-panStartX); panY.value=panStartPY+(t.clientY-panStartY);
      }
      function onTouchEnd(e){ isPanning=false; touchPinchStartDist=0; if(e.currentTarget) e.currentTarget.classList.remove('panning'); }
      function centerTree(){ nextTick(()=>{ const wrap=document.getElementById('tree-svg-container'); if(!wrap)return; const svgW = layout.value.totalWidth * zoomLevel.value; const svgH = layout.value.totalHeight * zoomLevel.value; panX.value = Math.max(16,(wrap.clientWidth-svgW)/2); panY.value = Math.max(16,(wrap.clientHeight-svgH)/2); }); }
      function addMember(){
        if(!nm.name.trim()) return;
        const newId = 'm'+Date.now();
        const parentId = nm.parentId || focusRootId.value || (members.value.find(m => !m.parentId)?.id) || null;
        members.value.push({ id:newId, recruitId: null, name:nm.name.trim(), email:(nm.email||'').trim(), memberCode:'', mergedPeople:[], major:nm.major.trim(), job:nm.job.trim(), company:nm.company.trim(), status:nm.status, parentId, history:[], interactionHistory:[], issuePaid:0, pending:0, birthDate:nm.birthDate, age:nm.age, meetDate:nm.meetDate, relation:nm.relation, gender:nm.gender, score:nm.score, disposition: defaultDisposition(), trainingDone:[] });
        showAddMemberModal.value = false;
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
        if(expandedMemberId.value===id) expandedMemberId.value=null; if(expandedInteractionId.value===id) expandedInteractionId.value=null; if(expandedDispositionId.value===id) expandedDispositionId.value=null; if(expandedTrainingId.value===id) expandedTrainingId.value=null;
        if (hadLinkedRecruit) showToastMsg(`[${m.name}]님이 멤버와 Recruit 리스트에서 모두 삭제되었습니다.`);
      }
      // ── 배우자 통합 (멤버 합치기) ──
      // 특정 직급 조건에 상관없이, 사용자가 직접 "합칠 멤버"와 "합쳐질 상위 멤버"를 골라
      // 하나의 노드로 합친다. 합쳐지는 멤버의 하위 멤버는 모두 상위 멤버 밑으로 이동한다.
      const showMergeModal = ref(false);
      const mergeForm = reactive({ sourceId: '', targetId: '' });
      function isMemberDescendantOf(candidateId, ancestorId) {
        let cur = members.value.find(x => x.id === candidateId);
        while (cur && cur.parentId) {
          if (cur.parentId === ancestorId) return true;
          cur = members.value.find(x => x.id === cur.parentId);
        }
        return false;
      }
      // 합칠 멤버(사라짐) 후보: root는 다른 멤버에 흡수될 수 없으므로 제외
      const mergeSourceOptions = computed(() => members.value.filter(m => m.parentId));
      // 합쳐질 상위 멤버(남음) 후보: 선택한 source 자신과, source의 하위트리는 제외(순환 방지)
      const mergeTargetOptions = computed(() => {
        if (!mergeForm.sourceId) return members.value;
        return members.value.filter(m => m.id !== mergeForm.sourceId && !isMemberDescendantOf(m.id, mergeForm.sourceId));
      });
      function openMergeModal() { mergeForm.sourceId = ''; mergeForm.targetId = ''; showMergeModal.value = true; }
      function closeMergeModal() { showMergeModal.value = false; }
      // 배우자(합쳐진 인물)의 이메일을 트리 공동 관리자로 자동 등록 (이미 공유되어 있거나, 본인 계정이거나, 소유자가 아니면 건너뜀)
      function autoShareEmailIfNeeded(rawEmail){
        const email = (rawEmail || '').trim().toLowerCase();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
        if (currentUser.value && currentUser.value.email && email === currentUser.value.email.toLowerCase()) return;
        const already = currentTreeMeta.value && (currentTreeMeta.value.sharedEmails || []).some(e => (e || '').toLowerCase() === email);
        if (already) return;
        if (!currentIsOwner.value) return; // 소유자만 공유 가능 (addShare 내부 정책과 동일)
        addShare(email, 'editor').catch(err => console.warn('배우자 자동 공유 실패:', err));
      }
      // 배우자 통합 인물의 이메일 입력/수정 시(merge 이후에도) 자동으로 공동 관리자에 등록
      function onMergedPersonEmailChange(p){ if(p && p.email) autoShareEmailIfNeeded(p.email); }
      // 트리를 열 때마다(또는 데이터가 바뀔 때마다) 이미 입력되어 있는 배우자 통합 인물들의 이메일을
      // 전부 훑어서 아직 공동 관리자로 등록되지 않았다면 등록한다. (이전에 이메일을 미리 입력해 둔 기존 트리도 소급 적용)
      function syncAllMergedEmails(){
        if (!currentIsOwner.value || !currentTreeMeta.value) return;
        members.value.forEach(m => { (m.mergedPeople || []).forEach(p => { if (p.email) autoShareEmailIfNeeded(p.email); }); });
      }
      watch(currentTreeMeta, (v) => { if (v) syncAllMergedEmails(); });
      function canMergeMembers(sourceId, targetId) {
        if (!sourceId || !targetId || sourceId === targetId) return false;
        const source = members.value.find(x => x.id === sourceId);
        const target = members.value.find(x => x.id === targetId);
        if (!source || !target) return false;
        if (!source.parentId) return false; // 최상위(root)는 다른 멤버에 흡수될 수 없음
        if (isMemberDescendantOf(targetId, sourceId)) return false; // 순환 방지
        return true;
      }
      function mergeTwoMembers(sourceId, targetId) {
        const m = members.value.find(x => x.id === sourceId);
        const target = members.value.find(x => x.id === targetId);
        if (!canMergeMembers(sourceId, targetId) || !m || !target) {
          showToastMsg('선택한 두 멤버는 합칠 수 없습니다.', 'error');
          return;
        }
        const oldName = m.name;
        if (!confirm(`'${oldName}' 님을 '${target.name}' 님 쪽으로 합치시겠습니까?\n\n· '${target.name}' 님의 이름이 '${target.name}, ${oldName}' 로 바뀝니다.\n· ${oldName} 님의 하위 멤버 전체가 '${target.name}' 님 밑으로 옮겨집니다.\n· 포인트/실적, 상담 기록, 연결된 Recruit·약속·메모, 개인정보가 모두 합쳐집니다.\n· 이 작업은 되돌릴 수 없습니다.`)) return;

        const today = new Date();
        const d = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${String(today.getFullYear()).slice(2)}`;

        // 1) 이름 합치기 (중복 방지)
        const existingNames = target.name.split(',').map(s => s.trim()).filter(Boolean);
        if (!existingNames.includes(oldName)) target.name = existingNames.concat(oldName).join(', ');

        // 2) 개인정보를 별도 인물로 보관 (기본 정보 탭에서 각자 정보를 확인/수정할 수 있도록)
        if (!target.mergedPeople) target.mergedPeople = [];
        const ownPerson = {
          id: 'p' + Date.now() + Math.random().toString(36).slice(2, 7),
          name: oldName, email: m.email || '', memberCode: m.memberCode || '',
          major: m.major || '', job: m.job || '', company: m.company || '',
          relation: m.relation || '', birthDate: m.birthDate || '', age: m.age || '', gender: m.gender || '남',
          photo: m.photo || ''
        };
        // 이미 합쳐져 있던 멤버(m)를 또 합치는 경우, m이 가지고 있던 사람들도 함께 승계
        target.mergedPeople = [...target.mergedPeople, ownPerson, ...(m.mergedPeople || [])];

        // 3) 이메일/사진 보존 (상위 멤버에 값이 없을 때만 승계)
        if (!target.email && m.email) target.email = m.email;
        if (!target.photo && m.photo) target.photo = m.photo;

        // 4) 하위 멤버 전체를 상위 멤버 밑으로 재배치 (서브 노드가 고스란히 따라 올라감)
        members.value.forEach(x => { if (x.parentId === m.id) x.parentId = target.id; });

        // 5) 포인트/실적 히스토리 병합 (id 재발급으로 충돌 방지)
        const mergedHistory = (m.history || []).map(h => ({ ...h, id: 'h' + Date.now() + Math.random().toString(36).slice(2, 7) }));
        target.history = [...(target.history || []), ...mergedHistory];

        // 6) 상담/관리 기록 병합 + 합침 로그 추가
        const mergedInteractions = (m.interactionHistory || []).map(h => ({ ...h, id: 'ih' + Date.now() + Math.random().toString(36).slice(2, 7) }));
        target.interactionHistory = [...(target.interactionHistory || []), ...mergedInteractions,
          { id: 'ih' + Date.now() + Math.random().toString(36).slice(2, 7), date: d, content: `🔗 '${oldName}' 님과 합쳐짐 (멤버·Recruit·약속·메모 통합)` }];

        // 7) 적합도 점수: 더 큰 값을 유지
        target.score = Math.max(target.score || 0, m.score || 0);

        // 8) 연결된 Recruit 정리 (중복 링크 방지)
        if (m.recruitId) {
          if (!target.recruitId) {
            target.recruitId = m.recruitId;
            const r = recruits.value.find(x => x.id === m.recruitId);
            if (r) r.name = target.name;
          } else {
            recruits.value = recruits.value.filter(r => r.id !== m.recruitId);
          }
        }
        // 합쳐진 멤버 이름으로 남아있는 별개 Recruit 항목도 이름 갱신
        recruits.value.forEach(r => { if (r.name === oldName) r.name = target.name; });

        // 9) 약속(appointments)의 대상자/참석자/작성자 이름 갱신
        appointments.value.forEach(a => {
          if (a.targetName === oldName) a.targetName = target.name;
          if (a.attendees) a.attendees = a.attendees.map(n => n === oldName ? target.name : n);
          if (a.createdBy === oldName) a.createdBy = target.name;
        });

        // 10) 메모(notes) 작성자 이름 갱신
        notes.value.forEach(n => { if (n.createdBy === oldName) n.createdBy = target.name; });

        // 11) 선택/포커스/펼침 상태 정리
        if (focusRootId.value === m.id) clearFocus();
        if (selectedMemberId.value === m.id) selectedMemberId.value = target.id;
        if (expandedMemberId.value === m.id) expandedMemberId.value = null;
        if (expandedInteractionId.value === m.id) expandedInteractionId.value = null;
        if (expandedDispositionId.value === m.id) expandedDispositionId.value = null;

        // 12) 멤버 목록에서 제거
        members.value = members.value.filter(x => x.id !== m.id);

        // 13) 합쳐진 배우자의 이메일도 이 트리를 열람/관리할 수 있도록 자동 공유
        //     (배우자 통합된 경우, 두 사람 중 누구의 계정으로 로그인해도 같은 트리를 관리할 수 있어야 함)
        [m.email, target.email, ...(m.mergedPeople || []).map(p => p.email), ...(target.mergedPeople || []).map(p => p.email)]
          .forEach(autoShareEmailIfNeeded);

        showToastMsg(`✅ '${oldName}' 님이 '${target.name}' 님과 합쳐졌습니다.`);
      }
      function confirmMergeFromModal() {
        if (!mergeForm.sourceId || !mergeForm.targetId) {
          showToastMsg('합칠 멤버와 합쳐질 상위 멤버를 모두 선택하세요.', 'error');
          return;
        }
        mergeTwoMembers(mergeForm.sourceId, mergeForm.targetId);
        showMergeModal.value = false;
      }
      function parentOpts(ex){
        const excludeIds=new Set([ex]); const chMap={}; members.value.forEach(m=>chMap[m.id]=[]);
        members.value.forEach(m=>{ if(m.parentId&&chMap[m.parentId]) chMap[m.parentId].push(m.id); });
        function getDesc(id){ (chMap[id]||[]).forEach(cid=>{excludeIds.add(cid);getDesc(cid);}); } getDesc(ex);
        return members.value.filter(m=>!excludeIds.has(m.id));
      }
      function toggleHistoryPanel(id){ expandedMemberId.value = expandedMemberId.value===id ? null : id; newHist.date=''; newHist.content=''; newHist.point=null; newHist.amount=null; newHist.type='History'; }
      function toggleInteractionPanel(id){ expandedDispositionId.value = null; expandedTrainingId.value = null; expandedInteractionId.value = expandedInteractionId.value===id ? null : id; newInteraction.date=''; newInteraction.content=''; }
      function toggleDispositionPanel(id){ expandedInteractionId.value = null; expandedTrainingId.value = null; expandedDispositionId.value = expandedDispositionId.value===id ? null : id; }
      function toggleTrainingPanel(id){ expandedInteractionId.value = null; expandedDispositionId.value = null; expandedTrainingId.value = expandedTrainingId.value===id ? null : id; }
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
                  const pId = item.parentId || focusRootId.value || (members.value.find(m => !m.parentId)?.id) || null;
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
            const pId = r.parentId || focusRootId.value || (members.value.find(m => !m.parentId)?.id) || null; if(!pId) { showToastMsg('상위 멤버가 없습니다.', 'error'); return; }
            targetMemberId = 'm' + Date.now();
            const mappedInteractions = (r.interactionHistory || []).map(h => ({ id: 'ih' + Date.now() + Math.random(), date: h.date, content: h.content })); mappedInteractions.push({ id: 'ih' + Date.now(), date: d, content: 'Recruit 리스트에서 정식 멤버로 승급됨' });
            members.value.push({ id: targetMemberId, recruitId: null, name: r.name, email: r.email || '', major: r.major || '', job: r.job || '', company: r.company || '', status: 'New(Code-in)', parentId: pId, history: [], interactionHistory: mappedInteractions, issuePaid: 0, pending: 0, birthDate: r.birthDate || '', age: r.age || '', meetDate: r.meetDate || '', relation: r.relation || '', gender: r.gender || '남', score: r.score, disposition: r.disposition ? JSON.parse(JSON.stringify(r.disposition)) : defaultDisposition() });
        }
        recruits.value = recruits.value.filter(x => x.id !== r.id); showToastMsg(`🎉 ${r.name}님이 정식 멤버로 승급되었습니다!`);
        selectedMemberId.value = targetMemberId; if(memberInfoPosition.value === 'none') memberInfoPosition.value = 'right'; if(tab.value !== 'members' && tab.value !== 'memberInfo') tab.value = 'memberInfo';
      }
      function addRecruit(){
        if(!newRecruit.name.trim()) return;
        // 상위 멤버 선택 시, 부부라도 실제로 고른 개인 이름을 작성자로 기록 (트리 소속은 memberId로 동일)
        const selectedPerson = newRecruit.parentPersonKey
          ? parentPersonOptions.value.find(p => p.key === newRecruit.parentPersonKey)
          : null;
        const createdBy = selectedPerson
          ? (selectedPerson.name || meName.value || '')
          : meName.value || (selectedMemberId.value && selectedMemberId.value !== 'root'
              ? members.value.find(m => m.id === selectedMemberId.value)?.name
              : rootMember.value?.name || '');
        const createdByEmail = (currentUser.value?.email || '').toLowerCase();
        // parentId: 선택 시 우선, 아니면 작성자(본인) 멤버, 아니면 트리 루트
        const fallbackParentId = (meMember.value && meMember.value.id) || (members.value.find(m => !m.parentId)?.id) || 'root';
        const parentId = (selectedPerson ? selectedPerson.memberId : '') || fallbackParentId;
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
          pinnedBy:[],
          recruitPending:false,
          interactionHistory:[],
          disposition: defaultDisposition(),
          createdBy,
          createdByEmail, 
          parentId,
          createdAt: now,
          updatedAt: now
        }; 
        recruits.value.push(newR);
        newRecruit.name=''; newRecruit.email=''; newRecruit.major=''; newRecruit.job=''; newRecruit.company=''; newRecruit.relation=''; newRecruit.meetDate=''; newRecruit.gender='남'; newRecruit.score=50; newRecruit.birthDate=''; newRecruit.age=''; newRecruit.parentPersonKey='';
      }
      function moveRecruitToPending(r){
        r.recruitPending = true;
        r.pendingAt = new Date().toISOString();
        showToastMsg(`${r.name}님을 펜딩 리스트로 이동했습니다.`);
      }
      function restoreRecruitFromPending(r){
        r.recruitPending = false;
        showToastMsg(`${r.name}님을 Recruit 리스트로 복귀했습니다.`);
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
        newNote.scope='notice';
      }
      function getPersonTitle(name) {
          if (!name) return ''; const n = String(name).trim(); if (!n) return '';
          if ((header.fd || '').trim() === n) return 'FD'; if ((header.sfd || '').trim() === n) return 'SFD'; if ((header.dfd || '').trim() === n) return 'DFD'; if ((header.nfd || '').trim() === n) return 'NFD'; if ((header.efd || '').trim() === n) return 'EFD';
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
      function removeAppointment(id) {
        if (!confirm('이 약속/이벤트를 삭제하시겠습니까?')) return;
        appointments.value = appointments.value.filter(a => a.id !== id);
        if (!deletedAptIds.value.includes(id)) deletedAptIds.value = [...deletedAptIds.value, id];
        showToastMsg('약속이 삭제되었습니다.');
      }
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
      function addHistoryToPerson(name, dateStr, content) {
          let m = members.value.find(x => x.name === name);
          if(m) { if(!m.interactionHistory) m.interactionHistory = []; m.interactionHistory.push({ id: 'ih'+Date.now()+Math.random(), date: dateStr, content: content }); m.interactionHistory = [...m.interactionHistory]; if(m.recruitId) { let r = recruits.value.find(x => x.id === m.recruitId); if(r) r.interactionHistory = [...m.interactionHistory]; } }
          else { let r = recruits.value.find(x => x.name === name); if(r) { if(!r.interactionHistory) r.interactionHistory = []; r.interactionHistory.push({ id: 'ih'+Date.now()+Math.random(), date: dateStr, content: content }); r.interactionHistory = [...r.interactionHistory]; } }
      }
      function onNodeClick(m){ selectedMemberId.value = m.id; if(memberInfoPosition.value === 'none') { memberInfoPosition.value = 'right'; } }
      function getRecruitMeta(r){ const ageStr=r.age?`${r.age}세`:''; return [r.major, r.job, r.company, r.relation,ageStr,calcPeriod(r.meetDate,r.period),r.gender].filter(Boolean).join(' | '); }
      function snapshot(){ return { header:{...header}, members:JSON.parse(JSON.stringify(members.value)), notes:JSON.parse(JSON.stringify(notes.value)), recruits:JSON.parse(JSON.stringify(recruits.value)), appointments:JSON.parse(JSON.stringify(appointments.value)), deletedAptIds:JSON.parse(JSON.stringify(deletedAptIds.value)), trainingTopics:JSON.parse(JSON.stringify(trainingTopics.value)), recruitPosition:recruitPosition.value, notesPosition:notesPosition.value, memberInfoPosition:memberInfoPosition.value, appointmentPosition:appointmentPosition.value, nodeWidth:nodeWidth.value, nodeBaseHeight:nodeBaseHeight.value, nodeFontSize:nodeFontSize.value, nodeLineGap:nodeLineGap.value, notePanelWidth:notePanelWidth.value, legendPanelWidth:legendPanelWidth.value, legendConfig:JSON.parse(JSON.stringify(legendConfig.value)), nodeDisplayConfig:JSON.parse(JSON.stringify(nodeDisplayConfig.value)), promotionCriteria:JSON.parse(JSON.stringify(promotionCriteria.value)), promotionWindowDays:promotionWindowDays.value }; }
      // 현재 트리 데이터의 실제 저장 용량(UTF-8 바이트)을 측정. Firestore 문서 1개당 1MB(1,048,576바이트) 제한 대비 추정치로 사용.
      function checkTreeSize(){
        try {
          const bytes = new TextEncoder().encode(JSON.stringify(snapshot())).length;
          treeSizeInfo.value = { bytes, checkedAt: new Date() };
        } catch (e) { console.error('[checkTreeSize] failed', e); }
      }
      const treeSizeKB = computed(() => (treeSizeInfo.value.bytes / 1024).toFixed(1));
      const treeSizeLimitKB = 1024; // Firestore 문서 1개 제한 1MB = 1024KB
      const treeSizePercent = computed(() => Math.min(100, (treeSizeInfo.value.bytes / (treeSizeLimitKB * 1024)) * 100));
      const treeSizeLevel = computed(() => {
        const p = treeSizePercent.value;
        if (p >= 90) return 'danger';
        if (p >= 70) return 'warn';
        return 'ok';
      });
      // 기본 정보 탭으로 이동할 때마다 최신 용량으로 갱신 (매 입력마다 재계산하면 무거우므로 탭 전환/저장 시점에만 계산)
      watch(tab, (v) => { if (v === 'header') checkTreeSize(); });
      function migrateHistory(h){ if(!h.type) h.type='History'; if(h.type==='Point') h.type='History'; if(h.amount===undefined){ if(h.type==='Issue Paid'||h.type==='Pending'){ h.amount=h.point||0; h.point=0; } else h.amount=0; } if(h.point===undefined) h.point=0; return h; }
      function restore(d){
        clearFocus(); Object.assign(header,d.header);
        // 레거시 데이터 마이그레이션: 예전 필드명 'dd'(Division Director 오표기)를 'dfd'(District Field Director)로 이전
        if(d.header && d.header.dd && !d.header.dfd){ header.dfd = d.header.dd; }
        if(!('nfd' in header)) header.nfd = '';
        members.value=(d.members||[]).map(m=>{ const history=(m.history||[]).map(h=>migrateHistory({...h})); const interactionHistory = m.interactionHistory || []; let st = m.status; if(st === 'New' || st === 'Code-in') st = 'New(Code-in)'; const disp = m.disposition ? JSON.parse(JSON.stringify(m.disposition)) : defaultDisposition(); const mergedPeople = m.mergedPeople || []; const trainingDone = m.trainingDone || []; return {birthDate:'',age:'',meetDate:'',major:'',job:'',company:'',relation:'',gender:'남',email:'',memberCode:'',issuePaid:0,pending:0,score:0, interactionHistory, recruitId:null, ...m, status:st, history, disposition: disp, mergedPeople, trainingDone}; });
        notes.value=(d.notes||[]).map(n=>typeof n==='string'?{text:n, scope:'all', createdBy:''}:{scope:'all', createdBy:'', ...n});
        if(d.recruits) recruits.value = d.recruits.map(r => { let ih = r.interactionHistory || []; if (r.history && r.history.length > 0 && ih.length === 0) { ih = r.history.map(h => typeof h === 'string' ? {id:'ih'+Math.random(), date:'', content:h} : h); } const disp = r.disposition ? JSON.parse(JSON.stringify(r.disposition)) : defaultDisposition(); let pinnedBy = Array.isArray(r.pinnedBy) ? r.pinnedBy : []; if(!pinnedBy.length && r.pinned){ const fallback = (currentUser.value && currentUser.value.email) || r.createdByEmail || ''; if(fallback) pinnedBy = [fallback]; } return {relation:'',meetDate:'',major:'',job:'',company:'',period:'',gender:'남',birthDate:'',age:'',email:'',createdBy:'',parentId:'',...r, pinnedBy, interactionHistory: ih, disposition: disp}; });
        if(d.appointments) appointments.value = d.appointments.map(a => ({ type: '이벤트', time: '', endTime: '', location: '', description: '', attendees: [], targetName: '', createdBy: '', confirmed: false, ...a }));
        deletedAptIds.value = d.deletedAptIds || [];
        trainingTopics.value = d.trainingTopics || [];
        if(d.recruitPosition) recruitPosition.value=d.recruitPosition; if(d.notesPosition) notesPosition.value=d.notesPosition; if(d.memberInfoPosition) memberInfoPosition.value=d.memberInfoPosition; if(d.appointmentPosition) appointmentPosition.value=d.appointmentPosition; if(d.nodeWidth) nodeWidth.value=d.nodeWidth; if(d.nodeBaseHeight) nodeBaseHeight.value=d.nodeBaseHeight; if(d.nodeFontSize) nodeFontSize.value=d.nodeFontSize; if(d.nodeLineGap) nodeLineGap.value=d.nodeLineGap; if(d.notePanelWidth) notePanelWidth.value=d.notePanelWidth; if(d.legendPanelWidth) legendPanelWidth.value=d.legendPanelWidth;
        if(d.legendConfig&&d.legendConfig.items){ legendConfig.value.show=d.legendConfig.show; for(let k in d.legendConfig.items){ if(legendConfig.value.items[k]) legendConfig.value.items[k]=d.legendConfig.items[k]; } }
        if(d.nodeDisplayConfig) nodeDisplayConfig.value = { ...nodeDisplayConfig.value, ...d.nodeDisplayConfig };
        promotionCriteria.value = d.promotionCriteria || {};
        Object.values(promotionCriteria.value).forEach(crit=>{
          if(crit && Array.isArray(crit.requirements)){
            crit.requirements = crit.requirements.map(r=> r.statuses ? r : { statuses: r.status?[r.status]:[], count:r.count });
          }
          if(crit && typeof crit.customNote !== 'string') crit.customNote = '';
          if(crit && typeof crit.cases !== 'number') crit.cases = 0;
        });
        if(d.promotionWindowDays) promotionWindowDays.value = d.promotionWindowDays;
        if(header.periodEndAuto) applyAutoPeriodEnd(); // 저장된 값이 지난 날짜일 수 있으므로, 불러올 때마다 오늘 기준으로 재계산
        checkTreeSize();
      }
      function exportJSON(){ 
        if (printRootId.value !== '__actual_root__') {
            const subRoot = members.value.find(m => m.id === printRootId.value); if (!subRoot) return; const ids = new Set(); function col(id){ ids.add(id); members.value.filter(m=>m.parentId===id).forEach(m=>col(m.id)); } col(printRootId.value);
            const subMemberList = members.value.filter(m=>ids.has(m.id)).map(m=>m.id===printRootId.value ? {...m,parentId:null} : {...m}); const originalRoot = members.value.find(m=>!m.parentId);
            const newHeader = {...header, id:'', rank:subRoot.status==='root'?'':subRoot.status, fd:originalRoot?originalRoot.name:header.fd, sfd:header.fd||header.sfd, dfd:header.sfd||header.dfd, nfd:header.dfd||header.nfd, efd:header.nfd||header.efd};
            const data = { header: newHeader, members: JSON.parse(JSON.stringify(subMemberList)), notes: JSON.parse(JSON.stringify(notes.value)), recruits: [], appointments: [], recruitPosition: recruitPosition.value, notesPosition: notesPosition.value, memberInfoPosition: memberInfoPosition.value, appointmentPosition: appointmentPosition.value, nodeWidth: nodeWidth.value, nodeBaseHeight: nodeBaseHeight.value, nodeFontSize: nodeFontSize.value, nodeLineGap: nodeLineGap.value, notePanelWidth: notePanelWidth.value, legendConfig: JSON.parse(JSON.stringify(legendConfig.value)), _subExportOf: originalRoot ? originalRoot.name : '', _subExportFrom: subRoot.name, _exportedAt: new Date().toLocaleString('ko-KR') };
            const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${subRoot.name.replace(/\s+/g,'_')}_subtree_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); showToastMsg(`📤 ${subRoot.name} 하위 그룹 내보내기 완료`);
        } else {
            const d = snapshot(); d._exportedAt = new Date().toLocaleString('ko-KR'); const blob = new Blob([JSON.stringify(d,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${(rootMemberName.value||'tree').replace(/\s+/g,'_')}_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); showToastMsg('📤 JSON 전체 내보내기 완료'); 
        }
      }
      function exportSubJSON(){
        if(!focusRootId.value){showToastMsg('포커스 모드에서만 사용 가능합니다','error');return;}
        const subRoot=members.value.find(m=>m.id===focusRootId.value); if(!subRoot)return; const subMemberList=focusedList.value.map(m=>m.id===focusRootId.value?{...m,parentId:null}:{...m}); const originalRoot=members.value.find(m=>!m.parentId);
        const newHeader={...header,id:'',rank:subRoot.status==='root'?'':subRoot.status,fd:originalRoot?originalRoot.name:header.fd,sfd:header.fd||header.sfd,dfd:header.sfd||header.dfd,nfd:header.dfd||header.nfd,efd:header.nfd||header.efd};
        const data={header:newHeader,members:JSON.parse(JSON.stringify(subMemberList)),notes:JSON.parse(JSON.stringify(notes.value)),recruits:[],appointments:[],recruitPosition:recruitPosition.value,notesPosition:notesPosition.value, memberInfoPosition:memberInfoPosition.value, appointmentPosition:appointmentPosition.value, nodeWidth:nodeWidth.value,nodeBaseHeight:nodeBaseHeight.value,nodeFontSize:nodeFontSize.value,nodeLineGap:nodeLineGap.value,notePanelWidth:notePanelWidth.value,legendConfig:JSON.parse(JSON.stringify(legendConfig.value)),_subExportOf:originalRoot?originalRoot.name:'',_subExportFrom:subRoot.name,_exportedAt:new Date().toLocaleString('ko-KR')};
        const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${subRoot.name.replace(/\s+/g,'_')}_subtree_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); showToastMsg(`📤 ${subRoot.name} 서브 내보내기 완료`);
      }
      function importJSON(e){ const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(!d.header||!d.members)throw new Error(); if(!confirm('현재 작업을 덮어쓸까요?'))return; restore(d); isDirty.value=false; showToastMsg('📥 불러오기 완료'); }catch{ showToastMsg('❌ 파일 형식 오류','error'); } }; reader.readAsText(file); e.target.value=''; }

      // ── 다른 사람이 내보낸 트리(JSON) 파일을 선택된 노드 아래에 추가하거나, 선택된 노드(동일 인물)와 병합 ──
      function openTreeMergeModal(){
        if (!selectedMemberId.value || selectedMemberId.value === 'root') return showToastMsg('먼저 트리에서 노드를 선택하세요.', 'error');
        treeMergeInput.mode = 'append';
        treeMergeInput.assignStatus = '';
        treeMergeInput.includeExtras = true;
        treeMergeInput.fileName = '';
        treeMergeInput.parsedData = null;
        treeMergeInput.rootName = '';
        treeMergeInput.memberCount = 0;
        showTreeMergeModal.value = true;
      }
      function closeTreeMergeModal(){ showTreeMergeModal.value = false; }
      function onTreeMergeFileSelected(e){
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const d = JSON.parse(ev.target.result);
            if (!d.header || !Array.isArray(d.members) || !d.members.length) throw new Error('invalid');
            const root = d.members.find(m => !m.parentId) || d.members[0];
            treeMergeInput.parsedData = d;
            treeMergeInput.fileName = file.name;
            treeMergeInput.rootName = root ? root.name : '(이름 없음)';
            treeMergeInput.memberCount = d.members.length;
          } catch (err) {
            showToastMsg('❌ 파일 형식을 읽을 수 없습니다. Family Tree에서 내보낸 JSON 파일인지 확인하세요.', 'error');
            treeMergeInput.parsedData = null; treeMergeInput.fileName = ''; treeMergeInput.rootName = ''; treeMergeInput.memberCount = 0;
          }
        };
        reader.readAsText(file);
      }
      function executeTreeMerge(){
        const targetId = selectedMemberId.value;
        const target = members.value.find(m => m.id === targetId);
        const d = treeMergeInput.parsedData;
        if (!target || !d) return showToastMsg('대상 노드 또는 불러올 파일이 없습니다.', 'error');
        if (treeMergeInput.mode === 'append' && !treeMergeInput.assignStatus) {
          return showToastMsg('가져온 인물에게 부여할 직급을 선택하세요.', 'error');
        }
        const modeLabel = treeMergeInput.mode === 'merge' ? `'${target.name}' 님과 병합` : `'${target.name}' 님 아래에 추가`;
        if (!confirm(`'${treeMergeInput.rootName}' 트리(멤버 ${treeMergeInput.memberCount}명)를 ${modeLabel}하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

        // 1) 멤버 ID 재발급 (현재 트리와의 ID 충돌 방지)
        const idMap = new Map();
        const srcMembers = JSON.parse(JSON.stringify(d.members));
        srcMembers.forEach(m => idMap.set(m.id, 'm' + Date.now() + Math.random().toString(36).slice(2, 8)));
        const importedRootOldId = (srcMembers.find(m => !m.parentId) || srcMembers[0]).id;
        const newRootId = idMap.get(importedRootOldId);

        // 2) Recruit ID 재발급 (포함 옵션 켠 경우만)
        const recruitIdMap = new Map();
        const srcRecruits = treeMergeInput.includeExtras ? JSON.parse(JSON.stringify(d.recruits || [])) : [];
        srcRecruits.forEach(r => recruitIdMap.set(r.id, 'r' + Date.now() + Math.random().toString(36).slice(2, 8)));

        const remapped = srcMembers.map(m => {
          const nm = {
            mergedPeople: [], trainingDone: [], history: [], interactionHistory: [],
            disposition: defaultDisposition(),
            ...m,
            id: idMap.get(m.id)
          };
          nm.parentId = m.parentId ? (idMap.get(m.parentId) || null) : null;
          nm.recruitId = (m.recruitId && recruitIdMap.has(m.recruitId)) ? recruitIdMap.get(m.recruitId) : null;
          return nm;
        });
        let remappedRecruits = srcRecruits.map(r => ({
          ...r, id: recruitIdMap.get(r.id),
          parentId: (r.parentId && idMap.has(r.parentId)) ? idMap.get(r.parentId) : target.id
        }));

        const importedRootNode = remapped.find(m => m.id === newRootId);

        if (treeMergeInput.mode === 'append') {
          // 새 자식 노드로 추가: 가져온 루트를 대상 노드 아래로 붙이고, root였던 상태를 실제 직급으로 교체
          importedRootNode.parentId = target.id;
          importedRootNode.status = treeMergeInput.assignStatus;
          members.value = [...members.value, ...remapped];
        } else {
          // 병합: 대상 노드(id/parentId/status 유지)에 가져온 루트의 정보를 흡수하고, 하위 조직은 대상 노드 밑으로 편입
          const oldName = importedRootNode.name;
          ['email', 'memberCode', 'major', 'job', 'company', 'relation', 'birthDate', 'age', 'gender', 'photo'].forEach(k => {
            if (!importedRootNode[k]) return;
            if (k === 'photo' && target.photo) return; // 기존 사진이 있으면 유지
            target[k] = importedRootNode[k];
          });
          const mergedHistory = (importedRootNode.history || []).map(h => ({ ...h, id: 'h' + Date.now() + Math.random().toString(36).slice(2, 7) }));
          target.history = [...(target.history || []), ...mergedHistory];
          const mergedInteractions = (importedRootNode.interactionHistory || []).map(h => ({ ...h, id: 'ih' + Date.now() + Math.random().toString(36).slice(2, 7) }));
          const today = new Date();
          const dstr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${String(today.getFullYear()).slice(2)}`;
          target.interactionHistory = [...(target.interactionHistory || []), ...mergedInteractions,
            { id: 'ih' + Date.now() + Math.random().toString(36).slice(2, 7), date: dstr, content: `🔗 '${oldName}' 님이 관리하던 트리 파일과 병합됨 (하위 ${remapped.length - 1}명 편입)` }];
          if (importedRootNode.mergedPeople && importedRootNode.mergedPeople.length) {
            const carried = importedRootNode.mergedPeople.map(p => ({ ...p, id: 'p' + Date.now() + Math.random().toString(36).slice(2, 7) }));
            target.mergedPeople = [...(target.mergedPeople || []), ...carried];
          }
          // 가져온 루트 자신은 대상 노드로 흡수되어 사라지고, 루트의 직속 자녀만 대상 노드 밑으로 재배치
          const children = remapped.filter(m => m.id !== newRootId).map(m => m.parentId === newRootId ? { ...m, parentId: target.id } : m);
          members.value = [...members.value, ...children];
          // 가져온 루트가 흡수됐으므로, 그 루트를 가리키던 recruit 연결도 대상 노드 기준으로 정리
          remappedRecruits = remappedRecruits.map(r => r.parentId === newRootId ? { ...r, parentId: target.id } : r);
        }

        if (treeMergeInput.includeExtras) {
          if (remappedRecruits.length) recruits.value = [...recruits.value, ...remappedRecruits];
          if (d.notes && d.notes.length) notes.value = [...notes.value, ...JSON.parse(JSON.stringify(d.notes)).filter(n => n && n.scope !== 'personal')];
          if (d.appointments && d.appointments.length) appointments.value = [...appointments.value, ...JSON.parse(JSON.stringify(d.appointments))];
        }

        showToastMsg(`✅ '${treeMergeInput.rootName}' 트리를 ${treeMergeInput.mode === 'merge' ? '병합' : '추가'}했습니다.`);
        showTreeMergeModal.value = false;
      }

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
        const printCodes=[h.id]; if(rm && rm.mergedPeople) rm.mergedPeople.forEach(p=>{ if(p.memberCode) printCodes.push(p.memberCode); });
        const printCodeStr = printCodes.filter(Boolean).join(', ');
        const uplines=[]; if(h.fd)uplines.push(`<strong>FD</strong> ${h.fd}`); if(h.sfd)uplines.push(`<strong>SFD</strong> ${h.sfd}`); if(h.dfd)uplines.push(`<strong>DFD</strong> ${h.dfd}`); if(h.nfd)uplines.push(`<strong>NFD</strong> ${h.nfd}`); if(h.efd)uplines.push(`<strong>EFD</strong> ${h.efd}`);
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
        let headerHTML=`<div class="pd-header"><div class="pd-header-left"><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 6px;width:100%;">${legendHTML}</div></div><div class="pd-header-center"><div class="pd-name">${rm?rm.name:''} <span class="pd-id">(${printCodeStr})</span></div>`;
        if(rm && rm.status && rm.status!=='root')headerHTML+=`<div style="display:inline-block;margin:1px 0 2px 0;background:#1c2b4a;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:6px;letter-spacing:1px">${statusLabel(rm.status)}</div>`;
        if(uplines.length)headerHTML+=`<div class="pd-upline">${uplines.join('&nbsp;|&nbsp;')}</div>`;
        headerHTML+=`<div style="margin-top:3px;font-size:8px;color:#555;"><strong>PERIOD:</strong> ${h.periodStart} – ${h.periodEnd}</div></div><div class="pd-header-right"><div class="pd-date">As of ${h.asOf || new Date().toLocaleDateString('ko-KR')}</div><div class="pd-fin-row"><span class="pd-fin-label">Issue Paid</span><span class="pd-fin-val">${fmt(tt.paid)}</span></div><div class="pd-fin-row"><span class="pd-fin-label">Pending</span><span class="pd-fin-val">${fmt(tt.pending)}</span></div><div class="pd-fin-row pd-fin-total"><span>Total</span><span class="pd-fin-val">${fmt(tt.total)}</span></div></div></div>`;
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

      watch([header,members,notes,recruits,appointments,deletedAptIds,trainingTopics,recruitPosition,notesPosition,memberInfoPosition,appointmentPosition,nodeWidth,nodeBaseHeight,nodeFontSize,nodeLineGap,notePanelWidth,legendPanelWidth,legendConfig,nodeDisplayConfig,promotionCriteria,promotionWindowDays],()=>{
        if (applyingRemote) return;
        if (currentIsReadOnly.value) return;
        if(!isDashboard.value) {
            isDirty.value=true;
            if(autoTimer)clearTimeout(autoTimer);
            autoTimer=setTimeout(() => saveToCloud(true), 3000);
        }
      },{deep:true});

      return {
        currentUser, isDashboard, savedTrees, sharedTrees, supportRequestedTrees, currentTreeId, currentTreeMeta, currentIsOwner, currentIsEditor, currentIsReadOnly,
        isAdmin, isManager, registeredUsers, showAdminPanel, userAccessStatus, userGraceDays, adminTab, adminSelectedUids, adminTabUsers, adminPendingCount, adminUsersForTab,
        fetchRegisteredUsers, approveUser, approveAsManager, denyUser, bulkApprove, bulkDeny, deleteRegisteredUser,
        appInviteEmail, sendAppInvite, endSupportRequest,
        // 기술 지원 요청 관련 (사용자 + 관리자 모달)
        showSupportRequestModal, supportRequestForm, openSupportRequestModal, submitSupportRequest,
        showSupportDetailModal, selectedSupportRequest, openSupportDetailModal, openSupportRequestTree,
        emailLoginMode, emailForm, emailLoginError, emailLoginLoading,
        loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, logout, fetchSavedTrees, createNewTree, loadTree, deleteTree, goToDashboard, saveToCloud,
        addShare, removeShare, changeShareRole, shareSubTree, openSubTreeShareModal, showSubTreeShareModal, subTreeShareInput,
        subTreeSharesForSelected, selectedMemberEffectiveEmail, removeSubTreeSharee, setSubTreeShareePrimary,
        showTreeMergeModal, treeMergeInput, openTreeMergeModal, closeTreeMergeModal, onTreeMergeFileSelected, executeTreeMerge,
        header, members, notes, appointments, notesPosition, recruitPosition, memberInfoPosition, appointmentPosition, tab,
        toast, showPreview, isDirty, lastAutoSave, slots, showShareModal, shareInput, focusRootId, zoomLevel, panX, panY,
        nodeWidth, nodeBaseHeight, nodeFontSize, nodeLineGap, widthLocked, heightLocked, fontLocked, lineGapLocked, notePanelWidth, notePanelLocked, legendPanelWidth, legendPanelLocked,
        recruits, newRecruit, expandedMemberId, expandedInteractionId, expandedDispositionId, expandedTrainingId, expandedRecruitInteractionId, expandedRecruitDispositionId, editingApptId,
        trainingTopics, newTrainingTopic, newTrainingGroup, addTrainingTopic, addTrainingGroup, removeTrainingTopic, removeTrainingGroup, trainingUnits, moveTrainingUnitUp, moveTrainingUnitDown, isTrainingDone, toggleTrainingDone, getTrainingDoneCount, toggleTrainingPanel, sideTrainingMember, showAddMemberModal,
        selectedMemberId, selectedMember, newHist, newInteraction, newRecruitInteraction, newAppt, nm, printLandscape, showSizePanel, printRootId, newNote, noteScopeLabel,
        legendConfig, allStatuses:ALL_STATUSES, availableStatuses, statusLabel, memberNames, recruitNames, allPersonNames, apptMemberNames, uplineMemberNames, upcomingAppointments, parentPersonOptions,
        recruitsSortedAll, visibleRecruits, focusedList, rootMember, rootMemberName, rootMemberEmail, currentMembers, tabMembers, sideHistMember, sideInteractionMember, sideDispositionMember, recentTeamHistory, recentTeamInteractions, tabRecruitsSorted, tabPendingRecruitsSorted, tabUpcomingAppointments, tabAllAppointmentsSorted, tabNotes,
        recruitPinColor, recruitPinTitle, togglePinForRecruit,
        meMember, meName, meSubtreeIds, meSubtreeNames,
        selectedUpline, viewHeader, selectedIsRootView, activeInfoMember, rootDisplayCode,
        teamTotal, selectedNodeTotal, pointSumMode, pointSumYear, teamTotalScopeLabel, statusCounts, layout, panTransform, previewPageStyle, previewFrameStyle,
        fmt, fmtS, parseDateForSort, calcAge, calcPeriod, onMemberPhotoSelected, removeMemberPhoto, nodeFrontPhoto, nodeBackPhoto, nodePhotoCount, photoBandHeight, nodeHeaderBand, sortedPointHistory, sortedInteractionHistory,
        treeSizeInfo, treeSizeKB, treeSizeLimitKB, treeSizePercent, treeSizeLevel, checkTreeSize,
        getMemberIssuePaid, getMemberPending, mPtsSum, getMemberTotal, getIncomePercent, fmtApptDateShort, getPointHistPct,
        mPtsSumScoped, getMemberIssuePaidScoped, getMemberPendingScoped, getMemberTotalScoped, getIncomePercentScoped, perfMemberHistoryEntries, perfTeamHistoryEntries,
        updateRootMemberName, updateRootMemberEmail, setFocus, clearFocus, toggleFocus, nodeContentLines, nodeH,
        nodeDisplayConfig, promotionCriteria, promotionWindowDays, promoEditRank, newPromoReq, addPromoRequirement, removePromoRequirement, setPromoPoints, promotionProgress, nextRankFor,
        addMember, removeMember, toggleHistoryPanel, toggleInteractionPanel, toggleDispositionPanel, toggleRecruitInteractionPanel, toggleRecruitDispositionPanel, addHistoryItem, removeHistoryItem, addInteractionItem, removeInteractionItem, parentOpts,
        showMergeModal, mergeForm, mergeSourceOptions, mergeTargetOptions, openMergeModal, closeMergeModal, canMergeMembers, mergeTwoMembers, confirmMergeFromModal, onMergedPersonEmailChange,
        calcDisposition, addRecruit, removeRecruit, promoteRecruit, moveRecruitToPending, restoreRecruitFromPending, onScoreChange,
        addRecruitInteractionItem, removeRecruitInteractionItem, onRecruitInteractionChange, onMemberInteractionChange,
        addAppointment, removeAppointment, completeAppointment, editAppointment, cancelEditAppt, handleTargetNameChange, addAttendeeByName, getPersonTitle, apptPeopleList,
        toggleApptConfirmed, apptDisplayTitle, apptDisplaySubtitle, visibleSidebarAppointments,
        addNote, onNodeClick, getRecruitMeta, zoomIn, zoomOut, zoomReset, centerTree, onWheel, onPanStart, onPanMove, onPanEnd, onTouchStart, onTouchMove, onTouchEnd,
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
        nDivider:(s)=>DIVIDERS[s]||'rgba(0,0,0,.15)', statusBadge:(s)=>(BADGE_PREFIX[s] ? BADGE_PREFIX[s]+' ' : '') + statusLabel(s)
      };
    }
  }).mount('#app');
});