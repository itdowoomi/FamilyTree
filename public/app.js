import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;

  // ========== 파이어베이스 설정 (클라우드 호스팅용) ==========
  const isCanvas = typeof __firebase_config !== 'undefined';
  let app, auth, db;

  if (isCanvas) {
      // 캔버스 내장 파이어베이스 (미리보기 환경 전용)
      app = initializeApp(JSON.parse(__firebase_config));
  } else {
      // ⚠️ [내 도메인 연동용] 여기에 본인의 Firebase 설정값을 붙여넣으세요!
      const firebaseConfig = {
          apiKey: "AIzaSyCqaelXcsffbrbkTN_Dq5vF4D7DZmVGdu8",
          authDomain: "myfamilytree-8d25f.firebaseapp.com",
          projectId: "myfamilytree-8d25f",
          storageBucket: "myfamilytree-8d25f.firebasestorage.app",
          messagingSenderId: "5519027679",
          appId: "1:5519027679:web:3c5d4802a80b09d19d286a",
          measurementId: "G-4BQ0S8YRDD"
      };
      app = initializeApp(firebaseConfig);
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
      const defaultRoot = () => ({ id:'root', recruitId: null, name:'방동혁 (Don Bang)', major:'교육학', job:'Logistics', company:'삼양 Logistics', status:'root', parentId:null, history:[], interactionHistory:[], issuePaid:0, pending:0, score:0, relation:'본인', age:51, meetDate:'1975', gender:'남', birthDate:'1975-01-01', disposition: defaultDisposition() });

      const header = reactive(defaultHeader());
      const members = ref([
        defaultRoot(),
        { id:'m1', recruitId: null, name:'김은숙', major:'', job:'', company:'', status:'SA', parentId:'root',
      const recruits = ref([]);
      
      const notesPosition = ref('none');
      const recruitPosition = ref('none');
      const memberInfoPosition = ref('right');
      const appointmentPosition = ref('none');
      const tab = ref('memberInfo');

      const newNote = ref('');
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
      const newRecruit = reactive({ name:'', major:'', job:'', company:'', relation:'', meetDate:'', period:'', gender:'남', score:50, birthDate:'', age:'' });
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
      const newAppt = reactive({ date: '', title: '', targetName: '', attendees: [] });

      const nm = reactive({ name:'', major:'', job:'', company:'', status:'New(Code-in)', parentId:'root', birthDate:'', age:'', meetDate:'', relation:'', gender:'남', score:0 });

      const nodeWidth = ref(155), nodeBaseHeight = ref(58), nodeFontSize = ref(10), nodeLineGap = ref(11);
      const widthLocked = ref(false), heightLocked = ref(false), fontLocked = ref(false), lineGapLocked = ref(false);
      const notePanelWidth = ref(210), notePanelLocked = ref(false);
      const zoomLevel = ref(1), panX = ref(0), panY = ref(0);
      let isPanning = false, panStartX = 0, panStartY = 0, panStartPX = 0, panStartPY = 0;
      const legendConfig = ref({ show:true, items:{} });
      ALL_STATUSES.forEach(s => { legendConfig.value.items[s] = { label:s, show:true }; });

      // ── Auth & Cloud Logic ──
      const initAuth = async () => {
        if (isCanvas) {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        }
        onAuthStateChanged(auth, (user) => {
          currentUser.value = user;
          if (user) fetchSavedTrees();
        });
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
        await signOut(auth);
        isDashboard.value = true;
        currentTreeId.value = null;
        savedTrees.value = [];
      };

      const fetchSavedTrees = async () => {
        if (!currentUser.value) return;
        try {
          const path = getCollectionPath(currentUser.value.uid, 'trees');
          const snapshot = await getDocs(collection(db, path));
          savedTrees.value = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        } catch (e) {
          console.error("Error fetching trees:", e);
        }
      };

      const createNewTree = () => {
        currentTreeId.value = 'tree_' + Date.now();
        Object.assign(header, defaultHeader());
        members.value = [defaultRoot()];
        notes.value = [];
        recruits.value = [];
        appointments.value = [];
        isDashboard.value = false;
        nextTick(centerTree);
      };

      const loadTree = (treeSummary) => {
        if(!treeSummary.data) return;
        restore(treeSummary.data);
        currentTreeId.value = treeSummary.id;
        isDashboard.value = false;
        nextTick(centerTree);
      };

      const goToDashboard = () => {
        isDashboard.value = true;
        currentTreeId.value = null;
        fetchSavedTrees();
      };

      const deleteTree = async (id, name) => {
        if (!confirm(`'${name || '이 트리'}'를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
        try {
          const path = getCollectionPath(currentUser.value.uid, 'trees');
          await deleteDoc(doc(db, path, id));
          fetchSavedTrees();
          showToastMsg('트리가 삭제되었습니다.');
        } catch (e) {
          console.error(e);
          showToastMsg('삭제 실패', 'error');
        }
      };

      const saveToCloud = async (isAuto = false) => {
        if (!currentUser.value || !currentTreeId.value) return;
        try {
          const path = getCollectionPath(currentUser.value.uid, 'trees');
          const snap = snapshot();
          const treeData = {
            name: rootMemberName.value || '제목 없는 트리',
            updatedAt: new Date().toLocaleString('ko-KR'),
            memberCount: members.value.length,
            data: snap
          };
          await setDoc(doc(db, path, currentTreeId.value), treeData);
          lastAutoSave.value = treeData.updatedAt;
          isDirty.value = false;
          if(!isAuto) showToastMsg('☁️ 클라우드에 안전하게 저장되었습니다!');
        } catch (e) {
          console.error(e);
          showToastMsg('저장 실패', 'error');
        }
      };

      function quickSave() { saveToCloud(false); }

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
      const currentMembers = computed(() => focusRootId.value ? focusedList.value : members.value);
      
      const selectedMember = computed(() => members.value.find(m => m.id === selectedMemberId.value));

      const memberNames = computed(() => members.value.map(m => m.name));
      const recruitNames = computed(() => recruits.value.map(r => r.name));

      const allPersonNames = computed(() => {
          return [...new Set([...memberNames.value, ...recruitNames.value])];
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
          nextTick(() => { syncLock = false; });
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
          nextTick(() => { syncLock = false; });
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
          id:newId, recruitId: null, name:nm.name.trim(), major:nm.major.trim(), job:nm.job.trim(), company:nm.company.trim(), status:nm.status, parentId:nm.parentId,
          history:[], interactionHistory:[], issuePaid:0, pending:0,
          birthDate:nm.birthDate, age:nm.age, meetDate:nm.meetDate, relation:nm.relation, gender:nm.gender, score:nm.score, disposition: defaultDisposition()
        });
        nm.name=''; nm.major=''; nm.job=''; nm.company=''; nm.birthDate=''; nm.age=''; nm.meetDate=''; nm.relation=''; nm.gender='남'; nm.score=0;
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

      // Check Score Thresholds (For both Recruit and Member updates)
      function onScoreChange(item, isRecruit = true) {
          let r = isRecruit ? item : recruits.value.find(x => x.id === item.recruitId);
          if (r) setTimeout(() => checkPromoteRecruit(r), 0); // Defer to avoid watch conflicts
      }

      async function checkPromoteRecruit(r){
        await nextTick();
        const existingMember = members.value.find(m => m.recruitId === r.id);

        if(r.score >= 60) {
          const targetStatus = r.score >= 75 ? 'Serious' : 'Potential';
          if(!existingMember) {
            const pId = focusRootId.value || (members.value.find(m => !m.parentId)?.id) || null;
            if(pId) {
              const newMemberId = 'm' + Date.now() + Math.random().toString(36).substring(2,7);
              const today = new Date();
              const d = `${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
              
              if(!r.interactionHistory) r.interactionHistory = [];
              r.interactionHistory.push({ id: 'ih' + Date.now(), date: d, content: `점수 ${r.score}점 달성 (${targetStatus} 자동 등록)` });
              r.interactionHistory = [...r.interactionHistory];

              members.value.push({
                  id: newMemberId, recruitId: r.id, name: r.name, major: r.major || '', job: r.job || '', company: r.company || '', status: targetStatus, parentId: pId,
                  history: [], interactionHistory: [...r.interactionHistory],
                  issuePaid: 0, pending: 0,
                  birthDate: r.birthDate || '', age: r.age || '', meetDate: r.meetDate || '', relation: r.relation || '', gender: r.gender || '남', score: r.score,
                  disposition: r.disposition ? JSON.parse(JSON.stringify(r.disposition)) : defaultDisposition()
              });
              showToastMsg(`🎉 ${r.name}님이 ${r.score}점을 달성하여 ${targetStatus}로 등록되었습니다!`);
            }
          } else {
            // Update status dynamically if crossing thresholds
            if (existingMember.status === 'Potential' || existingMember.status === 'Serious') {
                if (existingMember.status !== targetStatus) {
                     existingMember.status = targetStatus;
                     const today = new Date();
                     const d = `${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
                     existingMember.interactionHistory.push({ id: 'ih' + Date.now(), date: d, content: `점수 ${r.score}점 달성 (${targetStatus} 변경)` });
                     existingMember.interactionHistory = [...existingMember.interactionHistory];
                     r.interactionHistory = [...existingMember.interactionHistory];
                }
            }
          }
        } else {
          // If score drops below 60 and they are automatically linked (Potential/Serious)
          if(existingMember && (existingMember.status === 'Potential' || existingMember.status === 'Serious')) {
            removeMember(existingMember.id);
            showToastMsg(`📉 ${r.name}님의 점수가 60점 미만으로 하락하여 트리에서 제외되었습니다.`, 'error');
          }
        }
      }

      // Recruit CRUD -> Manual Promotion
      function promoteRecruit(r) {
        const existingMemberIndex = members.value.findIndex(m => m.recruitId === r.id);
        const today = new Date();
        const d = `${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        
        let targetMemberId = null;

        if (existingMemberIndex !== -1) {
            // Already in tree due to >=60 score. Unlink and make independent.
            members.value[existingMemberIndex].recruitId = null; 
            members.value[existingMemberIndex].status = 'New(Code-in)'; 
            members.value[existingMemberIndex].interactionHistory.push({ id: 'ih' + Date.now(), date: d, content: '정식 멤버로 승급됨' });
            targetMemberId = members.value[existingMemberIndex].id;
        } else {
            // Score was < 60, straight to member
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
                id: targetMemberId, recruitId: null, name: r.name, major: r.major || '', job: r.job || '', company: r.company || '', status: 'New(Code-in)', parentId: pId,
                history: [], interactionHistory: mappedInteractions,
                issuePaid: 0, pending: 0,
                birthDate: r.birthDate || '', age: r.age || '', meetDate: r.meetDate || '', relation: r.relation || '', gender: r.gender || '남', score: r.score,
                disposition: r.disposition ? JSON.parse(JSON.stringify(r.disposition)) : defaultDisposition()
            });
        }

        // Remove from recruits list entirely
        recruits.value = recruits.value.filter(x => x.id !== r.id);
        showToastMsg(`🎉 ${r.name}님이 정식 멤버로 승급되었습니다!`);
        
        // Open info panel for new member
        selectedMemberId.value = targetMemberId;
        if(memberInfoPosition.value === 'none') memberInfoPosition.value = 'right';
        if(tab.value !== 'members' && tab.value !== 'memberInfo') tab.value = 'memberInfo';
      }

      function addRecruit(){
        if(!newRecruit.name.trim()) return;
        const newR={id:'r'+Date.now(),name:newRecruit.name.trim(),major:newRecruit.major.trim(),job:newRecruit.job.trim(),company:newRecruit.company.trim(),relation:newRecruit.relation.trim(),meetDate:newRecruit.meetDate,period:'',gender:newRecruit.gender,score:newRecruit.score||0,birthDate:newRecruit.birthDate,age:newRecruit.age,show:true,interactionHistory:[], disposition: defaultDisposition()};
        recruits.value.push(newR);
        setTimeout(() => checkPromoteRecruit(newR), 0); // Auto check score right after adding
        newRecruit.name=''; newRecruit.major=''; newRecruit.job=''; newRecruit.company=''; newRecruit.relation=''; newRecruit.meetDate=''; newRecruit.gender='남'; newRecruit.score=50; newRecruit.birthDate=''; newRecruit.age='';
      }
      function removeRecruit(id){ recruits.value=recruits.value.filter(r=>r.id!==id); }
      function addNote(){ if(!newNote.value.trim())return; notes.value.push({text:newNote.value.trim()}); newNote.value=''; }
      
      // Appointment Methods
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

          // Allow registration if there's either a target person OR an attendee
          if(!newAppt.targetName && newAppt.attendees.length === 0) {
              return showToastMsg('참석할 멤버나 만날 대상자를 최소 한 명 이상 지정해주세요.', 'error');
          }

          // In case handleTargetNameChange didn't fire
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
                  appointments.value[idx].title = newAppt.title;
                  appointments.value[idx].targetName = newAppt.targetName;
                  appointments.value[idx].attendees = [...newAppt.attendees];
                  showToastMsg('약속이 성공적으로 수정되었습니다.');
              }
              editingApptId.value = null;
          } else {
              appointments.value.push({
                  id: 'apt'+Date.now(),
                  date: newAppt.date,
                  title: newAppt.title,
                  targetName: newAppt.targetName,
                  attendees: [...newAppt.attendees]
              });
              showToastMsg('새로운 약속이 등록되었습니다.');
          }
          
          newAppt.date = ''; newAppt.title = ''; newAppt.targetName = ''; newAppt.attendees = [];
          checkPastAppointments();
      }

      function removeAppointment(id) {
          appointments.value = appointments.value.filter(a => a.id !== id);
      }

      function editAppointment(apt) {
          editingApptId.value = apt.id;
          newAppt.date = apt.date;
          newAppt.title = apt.title;
          newAppt.targetName = apt.targetName || '';
          newAppt.attendees = [...(apt.attendees || [])];
      }

      function cancelEditAppt() {
          editingApptId.value = null;
          newAppt.date = ''; newAppt.title = ''; newAppt.targetName = ''; newAppt.attendees = [];
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
                  const content = `[약속/행사] ${apt.title}`;
                  
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

      // Node Click Handler
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
          return {birthDate:'',age:'',meetDate:'',major:'',job:'',company:'',relation:'',gender:'남',issuePaid:0,pending:0,score:0, interactionHistory, recruitId:null, ...m, status:st, history, disposition: disp};
        });
        notes.value=(d.notes||[]).map(n=>typeof n==='string'?{text:n}:n);
        if(d.recruits) {
            recruits.value = d.recruits.map(r => {
                let ih = r.interactionHistory || [];
                if (r.history && r.history.length > 0 && ih.length === 0) {
                    ih = r.history.map(h => typeof h === 'string' ? {id:'ih'+Math.random(), date:'', content:h} : h);
                }
                const disp = r.disposition ? JSON.parse(JSON.stringify(r.disposition)) : defaultDisposition();
                return {relation:'',meetDate:'',major:'',job:'',company:'',period:'',gender:'남',birthDate:'',age:'',...r, interactionHistory: ih, disposition: disp};
            });
        }
        if(d.appointments) appointments.value = d.appointments;
        
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
      function importJSON(e){ const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(!d.header||!d.members)throw new Error(); if(!confirm('현재 작업을 덮어쓸까요?'))return; restore(d); isDirty.value=false; checkPastAppointments(); showToastMsg('📥 불러오기 완료'); }catch{ showToastMsg('❌ 파일 형식 오류','error'); } }; reader.readAsText(file); e.target.value=''; }

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
        const memberRows=subMembers.map(m=>{
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
        const notesHTML=notes.value.map((n,i)=>`<div class="pd-note-item"><span class="pd-note-num">${i+1}</span>${n.text}</div>`).join('');
        let filterLabel=''; 
        if(h.periodStart || h.periodEnd) {
          filterLabel = `${h.periodStart||'시작'} ~ ${h.periodEnd||'계속'}`;
        }
        let legendHTML='';
        if(legendConfig.value.show){
          legendHTML=ALL_STATUSES.filter(s=>legendConfig.value.items[s].show && sc[s] > 0).map(s=>`<div class="pd-leg-item"><span class="pd-leg-box" style="background:${COLORS[s]}!important;border:1px solid ${STROKES[s]}!important"></span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${legendConfig.value.items[s].label}</span><span style="transform:scale(0.8);flex-shrink:0;">(${sc[s]})</span></div>`).join('');
        }
        let headerHTML=`<div class="pd-header"><div class="pd-header-left"><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 6px;width:100%;">${legendHTML}</div></div><div class="pd-header-center"><div class="pd-name">${rm?rm.name:''} <span class="pd-id">(${h.id})</span></div>`;
        if(h.rank)headerHTML+=`<div style="display:inline-block;margin:1px 0 2px 0;background:#1c2b4a;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:6px;letter-spacing:1px">${h.rank}</div>`;
        if(uplines.length)headerHTML+=`<div class="pd-upline">${uplines.join('&nbsp;|&nbsp;')}</div>`;
        headerHTML+=`<div style="margin-top:3px;font-size:8px;color:#555;"><strong>PERIOD:</strong> ${h.periodStart} – ${h.periodEnd}</div></div><div class="pd-header-right"><div class="pd-date">As of ${h.asOf}</div><div class="pd-fin-row"><span class="pd-fin-label">Issue Paid</span><span class="pd-fin-val">${fmt(tt.paid)}</span></div><div class="pd-fin-row"><span class="pd-fin-label">Pending</span><span class="pd-fin-val">${fmt(tt.pending)}</span></div><div class="pd-fin-row pd-fin-total"><span>Total</span><span class="pd-fin-val">${fmt(tt.total)}</span></div></div></div>`;
        let inner='';
        if(printLandscape.value){
          inner+=`<div class="pd-body-landscape"><div class="pd-main-col">`;
          if(h.title)inner+=`<div class="pd-doc-title">${h.title}</div>`;
          inner+=headerHTML+`<div class="pd-tree-wrap">${svgHTML}</div></div>`;
          if(memberRows||notes.value.length){
            inner+=`<div class="pd-side-col">`;
            if(memberRows)inner+=`<div class="pd-hist-section"><div class="pd-hist-section-title">📋 멤버 히스토리<span class="pd-hist-filter-label">${filterLabel}</span></div><div class="pd-hist-grid">${memberRows}</div></div>`;
            if(notes.value.length)inner+=`<div style="margin-top:12px"><div class="pd-notes-title">📝 메모 / 액션 아이템</div><div class="pd-notes-grid">${notesHTML}</div></div>`;
            inner+=`</div>`;
          }
          inner+=`</div>`;
        } else {
          if(h.title)inner+=`<div class="pd-doc-title">${h.title}</div>`;
          inner+=headerHTML+`<div class="pd-body-portrait"><div class="pd-main-col"><div class="pd-tree-wrap">${svgHTML}</div></div>`;
          if(memberRows||notes.value.length){
            inner+=`<div class="pd-side-col">`;
            if(memberRows)inner+=`<div class="pd-hist-section"><div class="pd-hist-section-title">📋 멤버 히스토리<span class="pd-hist-filter-label">${filterLabel}</span></div><div class="pd-hist-grid">${memberRows}</div></div>`;
            if(notes.value.length)inner+=`<div style="margin-top:12px"><div class="pd-notes-title">📝 메모 / 액션 아이템</div><div class="pd-notes-grid">${notesHTML}</div></div>`;
            inner+=`</div>`;
          }
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
        if(!isDashboard.value) {
            isDirty.value=true;
            if(autoTimer)clearTimeout(autoTimer);
            autoTimer=setTimeout(() => saveToCloud(true), 3000);
        }
      },{deep:true});

      return {
        currentUser, isDashboard, savedTrees, currentTreeId,
        loginWithGoogle, logout, fetchSavedTrees, createNewTree, loadTree, deleteTree, goToDashboard, saveToCloud,
        header, members, notes, appointments, notesPosition, recruitPosition, memberInfoPosition, appointmentPosition, tab,
        toast, showPreview, isDirty, lastAutoSave, slots,
        focusRootId, zoomLevel, panX, panY,
        nodeWidth, nodeBaseHeight, nodeFontSize, nodeLineGap, widthLocked, heightLocked, fontLocked, lineGapLocked, notePanelWidth, notePanelLocked,
        recruits, newRecruit, expandedMemberId, expandedInteractionId, expandedDispositionId, expandedRecruitInteractionId, expandedRecruitDispositionId, editingApptId,
        selectedMemberId, selectedMember, newHist, newInteraction, newRecruitInteraction, newAppt, nm, printLandscape, showSizePanel, printRootId, printHistMode, printHistDays, printHistFrom, printHistTo,
        legendConfig, allStatuses:ALL_STATUSES, availableStatuses, memberNames, recruitNames, allPersonNames, upcomingAppointments,
        recruitsSortedAll, visibleRecruits,
        focusedList, rootMember, rootMemberName, currentMembers,
        teamTotal, statusCounts, layout,
        panTransform, previewPageStyle, previewFrameStyle,
        fmt, fmtS, parseDateForSort, calcAge, calcPeriod,
        sortedPointHistory, sortedInteractionHistory,
        getMemberIssuePaid, getMemberPending, mPtsSum,
        getMemberTotal, getIncomePercent,
        updateRootMemberName, setFocus, clearFocus, toggleFocus,
        nodeNoteLines, nodeH,
        addMember, removeMember, toggleHistoryPanel, toggleInteractionPanel, toggleDispositionPanel, toggleRecruitInteractionPanel, toggleRecruitDispositionPanel, addHistoryItem, removeHistoryItem, addInteractionItem, removeInteractionItem, parentOpts,
        calcDisposition, addRecruit, removeRecruit, promoteRecruit, checkPromoteRecruit, onScoreChange,
        addRecruitInteractionItem, removeRecruitInteractionItem, onRecruitInteractionChange, onMemberInteractionChange,
        addAppointment, removeAppointment, editAppointment, cancelEditAppt, handleTargetNameChange,
        addNote, onNodeClick, getRecruitMeta,
        zoomIn, zoomOut, zoomReset, centerTree, onWheel, onPanStart, onPanMove, onPanEnd,
        quickSave, exportJSON, exportSubJSON, importJSON,
        doPrint, confirmPrint,
        getToastClass, getSaveStatusClass, getSaveStatusText,
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