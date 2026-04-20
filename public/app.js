import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCqaelXcsffbrbkTN_Dq5vF4D7DZmVGdu8",
  authDomain: "myfamilytree-8d25f.firebaseapp.com",
  projectId: "myfamilytree-8d25f",
  storageBucket: "myfamilytree-8d25f.firebasestorage.app",
  messagingSenderId: "5519027679",
  appId: "1:5519027679:web:3c5d4802a80b09d19d286a",
  measurementId: "G-4BQ0S8YRDD"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {

  const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;
  const LS_AUTO  = 'ntm_auto_v4';

  const VG = 70;
  const HG = 20;
  const PAD_Y = 50;

  createApp({
    setup() {
      const currentUser = ref(null);
      const cloudTrees = ref([]);
      const currentTreeId = ref(null);
      const newTreeName = ref('');

      async function fetchCloudTrees() {
        if (!currentUser.value) { cloudTrees.value = []; return; }
        try {
          const q = query(collection(db, "users", currentUser.value.uid, "trees"), orderBy("updatedAt", "desc"));
          const querySnapshot = await getDocs(q);
          const trees = [];
          querySnapshot.forEach((doc) => {
            const d = doc.data();
            let dateStr = '';
            if (d.updatedAt && d.updatedAt.toDate) { dateStr = d.updatedAt.toDate().toLocaleString('ko-KR'); }
            trees.push({ id: doc.id, name: d.name, updatedAt: dateStr });
          });
          cloudTrees.value = trees;
        } catch (e) { console.error("트리 목록 로드 에러:", e); }
      }

      onAuthStateChanged(auth, (user) => {
        if (user) {
          currentUser.value = user;
          showToast(`환영합니다, ${user.displayName}님!`);
          fetchCloudTrees();
        } else {
          currentUser.value = null; cloudTrees.value = []; currentTreeId.value = null;
        }
      });

      function loginWithGoogle() { signInWithPopup(auth, provider).catch((err) => { showToast('로그인 실패: ' + err.message, 'error'); }); }
      function logout() { signOut(auth).then(() => showToast('로그아웃 되었습니다.')); }

      async function saveToCloud(isNew) {
        if (!currentUser.value) return showToast('먼저 로그인 해주세요!', 'error');
        let docId = currentTreeId.value; let tName = newTreeName.value.trim();
        if (isNew) {
          if (!tName) tName = header.title || rootMemberName.value || '새 네트워크 트리';
          docId = 'tree_' + Date.now();
        } else {
          if (!docId) return showToast('덮어쓸 트리가 선택되지 않았습니다. [새 트리로 저장]을 이용하세요.', 'error');
          const existing = cloudTrees.value.find(t => t.id === docId); tName = existing ? existing.name : '트리';
        }
        try {
          const dataToSave = snapshot();
          const docRef = doc(db, "users", currentUser.value.uid, "trees", docId);
          await setDoc(docRef, { name: tName, data: dataToSave, updatedAt: serverTimestamp() });
          showToast(`'${tName}' 클라우드 저장 완료!`);
          currentTreeId.value = docId; newTreeName.value = ''; isDirty.value = false; fetchCloudTrees();
        } catch (e) { console.error(e); showToast('저장 중 오류 발생', 'error'); }
      }

      async function loadFromCloud(id) {
        if (!currentUser.value) return;
        try {
          const docRef = doc(db, "users", currentUser.value.uid, "trees", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const d = docSnap.data();
            if(!confirm(`'${d.name}' 트리를 클라우드에서 불러올까요?\n(현재 작업 중인 내용은 덮어쓰기 됩니다)`)) return;
            restore(d.data); currentTreeId.value = id; isDirty.value = false; showToast(`'${d.name}' 불러오기 완료!`);
          } else { showToast('데이터를 찾을 수 없습니다.', 'error'); }
        } catch (e) { console.error(e); showToast('불러오기 오류', 'error'); }
      }

      async function deleteFromCloud(id, name) {
        if (!currentUser.value) return;
        if (!confirm(`'${name}' 트리를 클라우드에서 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!`)) return;
        try {
          await deleteDoc(doc(db, "users", currentUser.value.uid, "trees", id));
          if (currentTreeId.value === id) { currentTreeId.value = null; }
          showToast(`'${name}' 삭제됨`); fetchCloudTrees();
        } catch (e) { console.error(e); showToast('삭제 중 오류 발생', 'error'); }
      }

      const header = reactive({ title: '', id: 'SCA87396', rank: '', periodStart: '04/01/26', periodEnd: '06/30/26', asOf: '03/06/2026', fd: 'ESTHER YI', sfd: 'PETER AND JEAN', dd: '', efd: 'HYEJEONG LEE' });
      const DEF = [ { id:'root', name:'방동혁 (Don Bang)', status:'root', parentId:null, history:[], issuePaid:0, pending:0 }, { id:'m1', name:'김은숙', status:'SA', parentId:'root', history:[{id:'h1',date:'03/06/26',type:'History',content:'DB PLAN 진행중',point:0,show:true}], issuePaid:18000, pending:0 }, { id:'m2', name:'서순열', status:'Serious', parentId:'root', history:[{id:'h2',date:'03/06/26',type:'History',content:'라이센스 준비중',point:0,show:true}], issuePaid:0, pending:0 }, { id:'m3', name:'최태영', status:'Licensed', parentId:'m1', history:[{id:'h3',date:'03/06/26',type:'History',content:'공인 회계사',point:0,show:true}], issuePaid:0, pending:0 } ];
      const DEF_NOTES = [{ text:'Team Member 한명더 Recruit 하기' }];

      const members = ref(JSON.parse(JSON.stringify(DEF)));
      const notes = ref(JSON.parse(JSON.stringify(DEF_NOTES)));
      const notesPosition = ref('right');
      const newNote = ref('');
      const tab = ref('members');

      function parseDateForSort(dStr) {
        if (!dStr) return 0; const parts = dStr.split('/'); if (parts.length < 2) return 0;
        let m = parseInt(parts[0], 10); let d = parseInt(parts[1], 10); let y = parts.length > 2 ? parseInt(parts[2], 10) : new Date().getFullYear();
        if (y < 100) y += 2000; return new Date(y, m - 1, d).getTime();
      }
      function sortMemberHistory(m) { if (m.history) m.history.sort((a, b) => parseDateForSort(b.date) - parseDateForSort(a.date)); }

      function calcPeriod(dateStr, legacyPeriod) {
        if (!dateStr) return legacyPeriod || ''; const parts = dateStr.split('-'); if (parts.length < 2) return legacyPeriod || '';
        const startYear = parseInt(parts[0], 10); const startMonth = parseInt(parts[1], 10);
        const now = new Date(); const currentYear = now.getFullYear(); const currentMonth = now.getMonth() + 1;
        let mDiff = (currentYear - startYear) * 12 + (currentMonth - startMonth);
        if (mDiff < 0) return '미래'; if (mDiff === 0) return '1개월 미만';
        const y = Math.floor(mDiff / 12); const m = mDiff % 12;
        if (y > 0 && m > 0) return `${y}년 ${m}개월`; if (y > 0) return `${y}년`; return `${m}개월`;
      }

      const recruits = ref([]); const recruitPosition = ref('none'); const expandedRecruitId = ref(null);
      const newRecruit = reactive({ name:'', relation:'', meetDate:'', period:'', gender:'남', score:50 });
      const newRecruitHist = reactive({ date:'', content:'' });

      const recruitsSortedAll = computed(() => [...recruits.value].sort((a,b) => (b.score||0) - (a.score||0)));
      const visibleRecruits = computed(() => recruitsSortedAll.value.filter(r => r.show));

      async function checkPromoteRecruit(r) {
        await nextTick();
        if (r.score >= 75) {
          const exists = members.value.find(m => m.name === r.name);
          if (!exists) {
            const rootNode = members.value.find(m => !m.parentId); const pId = focusRootId.value || (rootNode ? rootNode.id : null);
            if (pId) {
              const today = new Date(); const d = `${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
              const newMember = { id: 'm' + Date.now(), name: r.name, status: 'Potential', parentId: pId, history: [{ id: 'h' + Date.now(), date: d, type: 'History', content: '프로스펙팅 대상', point: 0, show: true }], issuePaid: 0, pending: 0 };
              members.value.push(newMember); showToast(`🎉 ${r.name}님이 75점을 넘어 트리에 'Potential'로 등록되었습니다!`);
            }
          }
        }
      }

      function addRecruit() {
        if (!newRecruit.name.trim()) return;
        const newR = { id:'r'+Date.now(), name:newRecruit.name.trim(), relation: newRecruit.relation.trim(), meetDate: newRecruit.meetDate, period: '', gender: newRecruit.gender, score:newRecruit.score||0, show:true, history:[] };
        recruits.value.push(newR); checkPromoteRecruit(newR);
        newRecruit.name=''; newRecruit.relation=''; newRecruit.meetDate=''; newRecruit.gender='남'; newRecruit.score=50;
      }
      function removeRecruit(id) { recruits.value = recruits.value.filter(r=>r.id!==id); if (expandedRecruitId.value===id) expandedRecruitId.value=null; }
      function toggleRecruitPanel(id) { expandedRecruitId.value = expandedRecruitId.value===id ? null : id; newRecruitHist.date=''; newRecruitHist.content=''; }
      function addRecruitHist(recruitId) {
        if (!newRecruitHist.content.trim()) return; const r = recruits.value.find(x=>x.id===recruitId); if(!r) return;
        const today = new Date(); const d = `${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`;
        r.history.push({ id:'rh'+Date.now(), date:newRecruitHist.date||d, content:newRecruitHist.content.trim() });
        newRecruitHist.date=''; newRecruitHist.content='';
      }
      function removeRecruitHist(recruitId, histId) { const r = recruits.value.find(x=>x.id===recruitId); if(!r) return; r.history = r.history.filter(h=>h.id!==histId); }

      const STATUSES = ['EFD','NFD','DFD','SFD','FD','SA','Licensed','Code-in','Serious','New','Potential'];
      const nm = reactive({ name:'', status:'New', parentId:'root', issuePaid:0, pending:0 });
      const allStatuses = ['root', 'EFD', 'NFD', 'DFD', 'SFD', 'FD', 'SA', 'Licensed', 'Code-in', 'Serious', 'New', 'Potential'];
      const legendConfig = ref({
        show: true, items: {
          root: { label: 'Root', show: true }, EFD: { label: 'EFD', show: true }, NFD: { label: 'NFD', show: true }, DFD: { label: 'DFD', show: true }, SFD: { label: 'SFD', show: true }, FD: { label: 'FD', show: true }, SA: { label: 'SA', show: true }, Licensed: { label: 'Licensed', show: true }, 'Code-in': { label: 'Code-in', show: true }, Serious: { label: 'Serious', show: true }, New: { label: 'New', show: true }, Potential: { label: 'Potential', show: true }
        }
      });
      const availableStatuses = computed(() => STATUSES.filter(s => legendConfig.value.items[s] && legendConfig.value.items[s].show));

      const printLandscape = ref(true); const showSizePanel = ref(false); const showPreview = ref(false);
      const PAGE_W_PX = computed(() => printLandscape.value ? 979 : 739); const PAGE_H_PX = computed(() => printLandscape.value ? 700 : 979);
      const previewScale = computed(() => Math.min((window.innerWidth - 80) / PAGE_W_PX.value, (window.innerHeight - 100) / PAGE_H_PX.value, 1));
      const previewPageStyle = computed(() => ({ width: PAGE_W_PX.value * previewScale.value + 'px', height: PAGE_H_PX.value * previewScale.value + 'px', overflow: 'hidden' }));
      const previewFrameStyle = computed(() => ({ width: PAGE_W_PX.value + 'px', height: PAGE_H_PX.value + 'px', transform: `scale(${previewScale.value})`, transformOrigin: '0 0' }));

      const zoomLevel = ref(1); const panX = ref(0); const panY = ref(0); let isPanning = false, panStartX = 0, panStartY = 0, panStartPX = 0, panStartPY = 0;
      function zoomIn()  { zoomLevel.value = Math.min(3, +(zoomLevel.value + 0.15).toFixed(2)); }
      function zoomOut() { zoomLevel.value = Math.max(0.2, +(zoomLevel.value - 0.15).toFixed(2)); }
      function centerTree() { nextTick(() => { const wrap = document.getElementById('tree-svg-container'); if (!wrap) return; panX.value = Math.max(16, (wrap.clientWidth - layout.value.totalWidth * zoomLevel.value) / 2); panY.value = Math.max(16, (wrap.clientHeight - layout.value.totalHeight * zoomLevel.value) / 2); }); }
      function zoomReset() { zoomLevel.value = 1; centerTree(); }
      function onWheel(e) { zoomLevel.value = Math.min(3, Math.max(0.2, +(zoomLevel.value + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))); }
      function onPanStart(e) { if (e.button !== 0) return; isPanning = true; panStartX = e.clientX; panStartY = e.clientY; panStartPX = panX.value; panStartPY = panY.value; e.currentTarget.classList.add('panning'); }
      function onPanMove(e) { if (!isPanning) return; panX.value = panStartPX + (e.clientX - panStartX); panY.value = panStartPY + (e.clientY - panStartY); }
      function onPanEnd(e) { isPanning = false; if (e.currentTarget) e.currentTarget.classList.remove('panning'); }

      const printHistMode = ref('all'); const printHistDays = ref(90); const printHistFrom = ref(''); const printHistTo   = ref('');
      const expandedMemberId = ref(null); const newHist = reactive({ date: '', type: 'History', content: '', point: 0 });

      const nodeWidth = ref(155); const widthLocked = ref(false);
      const nodeBaseHeight = ref(58); const heightLocked = ref(false);
      const nodeFontSize = ref(10); const fontLocked = ref(false);
      const nodeLineGap = ref(11); const lineGapLocked = ref(false);
      const notePanelWidth = ref(185); const notePanelLocked = ref(false);

      const isDirty = ref(false); const lastAutoSave = ref('');
      const toast = reactive({ msg:'', type:'success', visible:false }); let toastTimer = null;
      function showToast(msg, type='success') { if (toastTimer) clearTimeout(toastTimer); toast.msg = msg; toast.type = type; toast.visible = true; toastTimer = setTimeout(() => toast.visible = false, 2200); }

      function snapshot() {
        return {
          header: { ...header }, members: JSON.parse(JSON.stringify(members.value)), notes: JSON.parse(JSON.stringify(notes.value)),
          recruits: JSON.parse(JSON.stringify(recruits.value)), recruitPosition: recruitPosition.value, notesPosition: notesPosition.value,
          nodeWidth: nodeWidth.value, nodeBaseHeight: nodeBaseHeight.value, nodeFontSize: nodeFontSize.value, nodeLineGap: nodeLineGap.value,
          notePanelWidth: notePanelWidth.value, legendConfig: JSON.parse(JSON.stringify(legendConfig.value)),
        };
      }
      function restore(d) {
        clearFocus(); 
        Object.assign(header, d.header);
        members.value = d.members.map(m => {
          const history = m.history || (m.note ? m.note.split('\n').filter(l=>l.trim()).map((c,i)=>({id:'h'+Date.now()+i,date:'',type:'History',content:c,point:0,show:true})) : []);
          history.forEach(h => { if (!h.type) h.type = 'History'; }); return { issuePaid:0, pending:0, ...m, history };
        });
        notes.value = (d.notes||[]).map(n => typeof n==='string' ? {text:n} : n);
        if (d.recruits) recruits.value = d.recruits.map(r => ({ relation:'', meetDate:'', period:'', gender:'남', ...r }));
        if (d.recruitPosition) recruitPosition.value = d.recruitPosition; if (d.notesPosition) notesPosition.value = d.notesPosition;
        if (d.nodeWidth) nodeWidth.value = d.nodeWidth; if (d.nodeBaseHeight) nodeBaseHeight.value = d.nodeBaseHeight;
        if (d.nodeFontSize) nodeFontSize.value = d.nodeFontSize; if (d.nodeLineGap) nodeLineGap.value = d.nodeLineGap;
        if (d.notePanelWidth) notePanelWidth.value = d.notePanelWidth;
        if (d.legendConfig && d.legendConfig.items) { legendConfig.value.show = d.legendConfig.show; for (let k in d.legendConfig.items) { if (legendConfig.value.items[k]) legendConfig.value.items[k] = d.legendConfig.items[k]; } }
      }

      function quickSave() {
        const d = snapshot(); d._savedAt = new Date().toLocaleString('ko-KR'); localStorage.setItem(LS_AUTO, JSON.stringify(d));
        lastAutoSave.value = d._savedAt; isDirty.value = false; showToast('✅ 로컬 백업 완료!');
      }
      function clearAuto() {
        if (!confirm('자동저장 데이터를 삭제할까요?')) return; localStorage.removeItem(LS_AUTO); lastAutoSave.value = ''; showToast('🗑 삭제됨','error');
      }

      function exportJSON() {
        const d = snapshot(); d._exportedAt = new Date().toLocaleString('ko-KR'); const blob = new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); const n = rootMember.value ? rootMember.value.name : 'tree';
        a.href = url; a.download = `${n.replace(/\s+/g,'_')}_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); showToast('📤 JSON 내보내기 완료');
      }

      function exportSubJSON() {
        if (!focusRootId.value) { showToast('포커스 모드에서만 사용 가능합니다', 'error'); return; }
        const subRoot = members.value.find(m => m.id === focusRootId.value); if (!subRoot) return;
        const subMemberList = focusedList.value.map(m => m.id === focusRootId.value ? { ...m, parentId: null } : { ...m });
        const originalRoot = members.value.find(m => !m.parentId);
        const newHeader = { ...header, title: header.title || '', id: '', rank: subRoot.status === 'root' ? '' : subRoot.status, fd: originalRoot ? originalRoot.name : header.fd, sfd: header.fd || header.sfd, dd: header.sfd || header.dd, efd: header.dd || header.efd, };
        const data = { header: newHeader, members: JSON.parse(JSON.stringify(subMemberList)), notes: JSON.parse(JSON.stringify(notes.value)), notesPosition: notesPosition.value, nodeWidth: nodeWidth.value, nodeBaseHeight: nodeBaseHeight.value, nodeFontSize: nodeFontSize.value, nodeLineGap: nodeLineGap.value, notePanelWidth: notePanelWidth.value, legendConfig: JSON.parse(JSON.stringify(legendConfig.value)), _subExportOf: originalRoot ? originalRoot.name : '', _subExportFrom: subRoot.name, _exportedAt: new Date().toLocaleString('ko-KR') };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `${subRoot.name.replace(/\s+/g,'_')}_subtree_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); showToast(`📤 ${subRoot.name} 서브 내보내기 완료`);
      }

      function importJSON(e) {
        const file = e.target.files[0]; if(!file)return; const reader = new FileReader();
        reader.onload = ev => { try { const d = JSON.parse(ev.target.result); if(!d.header||!d.members) throw new Error(); if(!confirm('현재 작업을 덮어쓸까요?'))return; restore(d); isDirty.value = false; showToast('📥 불러오기 완료'); } catch { showToast('❌ 파일 형식 오류','error'); } };
        reader.readAsText(file); e.target.value = '';
      }

      onMounted(() => {
        const saved = localStorage.getItem(LS_AUTO);
        if (saved) { try { const d = JSON.parse(saved); restore(d); lastAutoSave.value = d._savedAt || ''; isDirty.value = false; showToast('🔄 브라우저 임시 복원'); } catch {} }
        nextTick(() => centerTree());
      });

      let autoTimer = null;
      function markDirty() { isDirty.value = true; if (autoTimer) clearTimeout(autoTimer); autoTimer = setTimeout(quickSave, 2000); }
      watch([header, members, notes, recruits, recruitPosition, notesPosition, nodeWidth, nodeBaseHeight, nodeFontSize, nodeLineGap, notePanelWidth, legendConfig], markDirty, { deep: true });

      const focusRootId = ref(null); 
      const focusedList = computed(() => {
        if (!focusRootId.value) return members.value; const chMap = {}; members.value.forEach(m => chMap[m.id] = []); members.value.forEach(m => { if (m.parentId && chMap[m.parentId]) chMap[m.parentId].push(m.id); });
        function collect(id, acc) { if(acc.has(id)) return acc; acc.add(id); (chMap[id]||[]).forEach(c => collect(c, acc)); return acc; }
        const ids = collect(focusRootId.value, new Set()); return members.value.filter(m => ids.has(m.id)).map(m => m.id === focusRootId.value ? { ...m, parentId: null } : m);
      });

      const rootMember = computed(() => focusedList.value.find(m => !m.parentId));
      const rootMemberName = computed(() => rootMember.value ? rootMember.value.name : '');
      const currentMembers = computed(() => focusRootId.value ? focusedList.value : members.value);

      const teamTotal = computed(() => {
        const list = focusedList.value; const paid = list.reduce((s,m) => s+(m.issuePaid||0), 0); const pending = list.reduce((s,m) => s+(m.pending||0), 0); return { paid, pending, total: paid+pending };
      });
      const statusCounts = computed(() => {
        const c = { EFD:0, NFD:0, DFD:0, SFD:0, FD:0, SA:0, Licensed:0, 'Code-in':0, Serious:0, New:0, Potential:0 }; focusedList.value.forEach(m => { if (c[m.status] !== undefined) c[m.status]++; }); return c;
      });

      function setFocus(memberId) { focusRootId.value = memberId; panX.value = 0; panY.value = 0; zoomLevel.value = 1; nextTick(() => centerTree()); }
      function clearFocus() { focusRootId.value = null; panX.value = 0; panY.value = 0; zoomLevel.value = 1; nextTick(() => centerTree()); }
      function toggleFocus(memberId) { if (focusRootId.value === memberId) clearFocus(); else setFocus(memberId); }
      function mPtsSum(m) { if (!m.history) return 0; return m.history.filter(h => h.show && h.type === 'Point').reduce((sum, h) => sum + (Number(h.point) || 0), 0); }
      function nodeNoteLines(m) {
        if (!m.history || !m.history.length) return [];
        return m.history.filter(h => h.show).map(h => { let val = h.content; if (h.type === 'Point') { const c = h.content ? `(${h.content}) ` : ''; val = `${c}${fmt(h.point)} Pts`; } return h.date ? `[${h.date}] ${val}` : val; }).slice(0, 6);
      }
      function nodeH(m) { const base = nodeBaseHeight.value; const nl = nodeNoteLines(m).length; return nl > 0 ? base + 2 + nl * nodeLineGap.value : base; }

      const layout = computed(() => {
        const NW = nodeWidth.value; const list = focusedList.value;
        const ch = {}; list.forEach(m => ch[m.id] = []); list.forEach(m => { if (m.parentId && ch[m.parentId]) ch[m.parentId].push(m.id); });
        const root = list.find(m => !m.parentId);
        if (!root) return { edges:[], membersWithPos:[], totalWidth:400, totalHeight:300 };

        const span = {};
        function computeSpan(id) { const children = ch[id] || []; if (children.length === 0) { span[id] = NW; return NW; } const total = children.reduce((s, cid) => s + computeSpan(cid) + HG, -HG); span[id] = Math.max(NW, total); return span[id]; }
        computeSpan(root.id);

        const pos = {}; const rowMaxH = {};
        function measureRows(id, depth) { const nh = nodeH(list.find(m => m.id===id) || {}); rowMaxH[depth] = Math.max(rowMaxH[depth] || 0, nh); (ch[id]||[]).forEach(cid => measureRows(cid, depth+1)); }
        measureRows(root.id, 0);

        const rowY = [PAD_Y]; const maxDepth = Math.max(...Object.keys(rowMaxH).map(Number)) + 1; for (let d = 1; d < maxDepth; d++) { rowY[d] = rowY[d-1] + (rowMaxH[d-1]||50) + VG; }

        function place(id, centerX, depth) {
          const nh = nodeH(list.find(m => m.id===id) || {}); pos[id] = { x: centerX, y: rowY[depth] + nh/2, depth };
          const children = ch[id] || []; if (children.length === 0) return;
          const totalChildSpan = children.reduce((s, cid) => s + span[cid], 0) + HG * (children.length - 1); let cx = centerX - totalChildSpan / 2;
          children.forEach(cid => { place(cid, cx + span[cid]/2, depth + 1); cx += span[cid] + HG; });
        }
        place(root.id, 0, 0);

        const allX = Object.values(pos).map(p => p.x); const allY = Object.values(pos).map(p => p.y);
        const minX = Math.min(...allX) - NW/2; const maxX = Math.max(...allX) + NW/2;
        const maxNH = Math.max(...list.map(m => nodeH(m))); const maxY = Math.max(...allY) + maxNH/2;

        const PAD_X = 30; const offsetX = -minX + PAD_X;
        const finalPos = {}; Object.keys(pos).forEach(id => { finalPos[id] = { x: pos[id].x + offsetX, y: pos[id].y }; });

        const edges = list.map(m => {
          if (!m.parentId || !finalPos[m.id] || !finalPos[m.parentId]) return null;
          const pH = nodeH(list.find(x=>x.id===m.parentId)||{}); const cH = nodeH(m);
          return { id: m.id, status: m.status, x1: finalPos[m.parentId].x, y1: finalPos[m.parentId].y + pH/2, x2: finalPos[m.id].x, y2: finalPos[m.id].y - cH/2 };
        }).filter(Boolean);

        const membersWithPos = list.map(m => ({ ...m, pos: finalPos[m.id] || {x:0,y:0} }));
        return { edges, membersWithPos, totalWidth: maxX - minX + PAD_X * 2, totalHeight: maxY + PAD_Y };
      });

      const C = { root:'#1c2b4a', EFD:'#4a1a6b', NFD:'#6b2d8a', DFD:'#1a4a6b', SFD:'#1a5c5c', FD:'#2d5a2d', SA:'#2d4a2d', Licensed:'#4a2d1c', 'Code-in':'#3d3a6b', Serious:'#e8e4d8', New:'#ffffff', Potential:'#f5f5f5' };
      const S = { root:'#0f1e38', EFD:'#3a1258', NFD:'#561f72', DFD:'#123a58', SFD:'#124848', FD:'#1e3a1e', SA:'#1e3a1e', Licensed:'#3a1e0e', 'Code-in':'#2a2858', Serious:'#b0aa98', New:'#b0aa98', Potential:'#aaa' };
      const T = { root:'#ffffff', EFD:'#ffffff', NFD:'#ffffff', DFD:'#ffffff', SFD:'#ffffff', FD:'#ffffff', SA:'#ffffff', Licensed:'#ffffff', 'Code-in':'#ffffff', Serious:'#1a1917', New:'#1a1917', Potential:'#444' };
      const D = { root:'rgba(255,255,255,.3)', EFD:'rgba(255,255,255,.3)', NFD:'rgba(255,255,255,.3)', DFD:'rgba(255,255,255,.3)', SFD:'rgba(255,255,255,.3)', FD:'rgba(255,255,255,.3)', SA:'rgba(255,255,255,.3)', Licensed:'rgba(255,255,255,.3)', 'Code-in':'rgba(255,255,255,.3)', Serious:'rgba(0,0,0,.2)', New:'rgba(0,0,0,.15)', Potential:'rgba(0,0,0,.1)' };
      const nColor = s => C[s] || '#fff'; const nStroke = s => S[s] || '#ccc'; const nTextColor = s => T[s] || '#000'; const nDivider = s => D[s] || 'rgba(0,0,0,.15)';

      function fmtS(n) { if (!n && n!==0) return '-'; return Number(n).toLocaleString(); }
      function fmt(n) { return Number(n||0).toLocaleString(); }
      const BADGE_MAP = { EFD:'★★★★★ EFD', NFD:'★★★★ NFD', DFD:'★★★ DFD', SFD:'★★★ SFD', FD:'★★ FD', SA:'★★ SA', Licensed:'★ Licensed', 'Code-in':'◈ Code-in' };
      function statusBadge(s) { if (s === 'root') return ''; return BADGE_MAP[s] || s; }

      function addMember() { if (!nm.name.trim()) return; members.value.push({ id:'m'+Date.now(), name:nm.name.trim(), status:nm.status, parentId:nm.parentId, history:[], issuePaid:nm.issuePaid||0, pending:nm.pending||0 }); nm.name=''; nm.issuePaid=0; nm.pending=0; }
      function removeMember(id) { if (focusRootId.value === id) clearFocus(); const m = members.value.find(x=>x.id===id); if(!m||!m.parentId) return; members.value.forEach(x=>{ if(x.parentId===id) x.parentId=m.parentId; }); members.value = members.value.filter(x=>x.id!==id); if (expandedMemberId.value === id) expandedMemberId.value = null; }
      function toggleHistoryPanel(id) { expandedMemberId.value = expandedMemberId.value === id ? null : id; newHist.date = ''; newHist.content = ''; newHist.point = 0; newHist.type = 'History'; }
      function addHistoryItem(memberId) { if (newHist.type === 'History' && !newHist.content.trim()) return; const m = members.value.find(x=>x.id===memberId); if(!m) return; if (!m.history) m.history = []; const today = new Date(); const d = `${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}/${String(today.getFullYear()).slice(2)}`; m.history.push({ id: 'h'+Date.now(), date: newHist.date || d, type: newHist.type, content: newHist.content.trim(), point: newHist.type === 'Point' ? Number(newHist.point) : 0, show: true }); sortMemberHistory(m); newHist.date = ''; newHist.content = ''; newHist.point = 0; }
      function removeHistoryItem(memberId, histId) { const m = members.value.find(x=>x.id===memberId); if(!m) return; m.history = m.history.filter(h=>h.id!==histId); }
      function parentOpts(ex) { const excludeIds = new Set([ex]); const chMap = {}; members.value.forEach(m => chMap[m.id] = []); members.value.forEach(m => { if (m.parentId && chMap[m.parentId]) chMap[m.parentId].push(m.id); }); function getDescendants(id) { (chMap[id]||[]).forEach(cid => { excludeIds.add(cid); getDescendants(cid); }); } getDescendants(ex); return members.value.filter(m => !excludeIds.has(m.id)); }
      function addNote() { if(!newNote.value.trim())return; notes.value.push({text:newNote.value.trim()}); newNote.value=''; }
      function onNodeClick(m) { if(m.parentId!==null) tab.value='members'; }

      function getToastClass() { return [toast.type, toast.visible ? '' : 'hidden']; }
      function getSaveStatusClass() { return isDirty.value ? 'unsaved' : 'saved'; }
      function getSaveStatusText() { return isDirty.value ? '저장 안 됨' : '자동저장 완료'; }
      function getRecruitMeta(r) { return [r.relation, calcPeriod(r.meetDate, r.period), r.gender].filter(Boolean).join(' | '); }
      const panTransform = computed(() => `translate(${panX.value}px,${panY.value}px)`);
      function getEdgeClass(e) { return e.status === 'Potential' ? 'edge-dash' : 'edge-line'; }
      function getNodeTransform(m) { return `translate(${m.pos.x - nodeWidth.value/2}, ${m.pos.y - nodeH(m)/2})`; }
      function getRectStrokeWidth(m) { return m.status === 'Potential' ? 1.5 : 1; }
      function getRectDash(m) { return m.status === 'Potential' ? '5,3' : 'none'; }
      function getMemberTotal(m) { return fmtS((m.issuePaid||0) + (m.pending||0)); }
      function getLegendMargin() { return legendConfig.value.show ? 'auto' : '0'; }
      function getTbarClass(condition) { return condition ? 'tbar-save' : 'tbar-other'; }
      function getPrintTitle() { return printLandscape.value ? '가로(Landscape)' : '세로(Portrait)'; }
      function getPrintText() { return printLandscape.value ? '가로' : '세로'; }
      function getFocusTitle(m) { return focusRootId.value === m.id ? '포커스 해제' : m.name + ' 기준으로 보기'; }
      function getFocusIcon(m) { return focusRootId.value === m.id ? '⊙' : '🔍'; }
      function getHistPlaceholder(h) { return h.type === 'Point' ? '내용 (선택)' : '내용'; }
      function getNewHistPlaceholder() { return newHist.type === 'Point' ? '내용 (예: 상품명 등)' : '히스토리 내용 입력'; }

      const printRootId = ref('__actual_root__');

      function buildSubtreeSVG(rootMemberId) {
        const allMembers = members.value; const NW = nodeWidth.value; const _VG = 70, _HG = 20, _PAD = 50;
        const chMap = {}; allMembers.forEach(m => chMap[m.id] = []); allMembers.forEach(m => { if (m.parentId && chMap[m.parentId]) chMap[m.parentId].push(m.id); });
        function collectDescendants(id, acc) { acc.add(id); (chMap[id]||[]).forEach(cid => collectDescendants(cid, acc)); return acc; }
        const subIds = collectDescendants(rootMemberId, new Set());
        const subList = allMembers.filter(m => subIds.has(m.id)).map(m => m.id === rootMemberId ? { ...m, parentId: null } : m); 
        if (!subList.length) return '<svg width="400" height="100"></svg>';
        const subCh = {}; subList.forEach(m => subCh[m.id] = []); subList.forEach(m => { if (m.parentId && subCh[m.parentId]) subCh[m.parentId].push(m.id); });
        const subRoot = subList.find(m => !m.parentId);
        function _nodeH(m) { const base = nodeBaseHeight.value; const lines = Math.min((m.history||[]).filter(h=>h.show).length, 6); return lines > 0 ? base + 2 + lines * nodeLineGap.value : base; }
        const span = {}; function computeSpan(id) { const ch = subCh[id]||[]; if (!ch.length) { span[id]=NW; return NW; } const w = ch.reduce((s,c)=>s+computeSpan(c)+_HG,-_HG); span[id]=Math.max(NW,w); return span[id]; }
        computeSpan(subRoot.id);
        const rowMaxH={}; function measureRows(id,d){ const nh=_nodeH(subList.find(m=>m.id===id)||{}); rowMaxH[d]=Math.max(rowMaxH[d]||0,nh); (subCh[id]||[]).forEach(c=>measureRows(c,d+1)); }
        measureRows(subRoot.id,0); const rowY=[_PAD]; const maxD=Math.max(...Object.keys(rowMaxH).map(Number))+1; for(let d=1;d<maxD;d++) rowY[d]=(rowY[d-1]||_PAD)+(rowMaxH[d-1]||58)+_VG;
        const pos={}; function place(id,cx,d){ const nh=_nodeH(subList.find(m=>m.id===id)||{}); pos[id]={x:cx,y:rowY[d]+nh/2}; const ch=subCh[id]||[]; if(!ch.length) return; const total=ch.reduce((s,c)=>s+span[c],0)+_HG*(ch.length-1); let x=cx-total/2; ch.forEach(c=>{ place(c,x+span[c]/2,d+1); x+=span[c]+_HG; }); }
        place(subRoot.id,0,0);
        const allX=Object.values(pos).map(p=>p.x); const allY=Object.values(pos).map(p=>p.y);
        const minX=Math.min(...allX)-NW/2; const offsetX=-minX+_PAD; const finalPos={}; Object.keys(pos).forEach(id=>{ finalPos[id]={x:pos[id].x+offsetX,y:pos[id].y}; });
        const W=Math.max(...allX)+NW/2-minX+_PAD*2; const maxNH=Math.max(...subList.map(m=>_nodeH(m))); const H=Math.max(...allY)+maxNH/2+_PAD;
        const fs = nodeFontSize.value; const lg = nodeLineGap.value;
        function nodeRows(m) { return (m.history||[]).filter(h=>h.show).map(h=>{ let val = h.content; if (h.type === 'Point') { const c = h.content ? `(${h.content}) ` : ''; val = `${c}${fmt(h.point)} Pts`; } return h.date ? `[${h.date}] ${val}` : val; }).slice(0,6); }
        let svgContent = '';
        subList.forEach(m => { if (!m.parentId||!finalPos[m.id]||!finalPos[m.parentId]) return; const pH=_nodeH(subList.find(x=>x.id===m.parentId)||{}); const cH=_nodeH(m); const dash = m.status==='Potential'?'stroke-dasharray="5,3"':''; svgContent += `<line x1="${finalPos[m.parentId].x}" y1="${finalPos[m.parentId].y+pH/2}" x2="${finalPos[m.id].x}" y2="${finalPos[m.id].y-cH/2}" stroke="#6b7280" stroke-width="1.5" fill="none" ${dash}/>`; });
        subList.forEach(m => {
          const p=finalPos[m.id]; if(!p) return; const nh=_nodeH(m); const tx=p.x-NW/2, ty=p.y-nh/2; const fill=C[m.status]||'#fff'; const stroke=S[m.status]||'#ccc'; const tc=T[m.status]||'#000'; const div=D[m.status]||'rgba(0,0,0,.15)'; const dash=m.status==='Potential'?'stroke-dasharray="5,3"':''; const badge = m.status === 'root' ? '' : (BADGE_MAP[m.status] || m.status); const notes=nodeRows(m); const ptsSum = mPtsSum(m);
          svgContent += `<g transform="translate(${tx},${ty})">`;
          svgContent += `<rect width="${NW}" height="${nh}" rx="5" ry="5" fill="${fill}" stroke="${stroke}" stroke-width="1" ${dash}/>`;
          svgContent += `<text font-family="Noto Sans KR,sans-serif" font-size="${fs+2}" font-weight="700" x="${NW/2}" y="${fs+8}" text-anchor="middle" fill="${tc}">${m.name}</text>`;
          if(badge) svgContent += `<text font-family="JetBrains Mono,monospace" font-size="${fs-1}" x="${NW-5}" y="${fs+7}" text-anchor="end" fill="${tc}" opacity="0.9">${badge}</text>`;
          svgContent += `<line x1="6" y1="${fs+14}" x2="${NW-6}" y2="${fs+14}" stroke="${div}" stroke-width="0.8"/>`;
          svgContent += `<text font-family="JetBrains Mono,monospace" font-size="${fs-2}" x="7" y="${fs+14+lg}" fill="${tc}" opacity="0.85">Paid: ${fmtS(m.issuePaid)} / Pend: ${fmtS(m.pending)}</text>`;
          let totalStr = `Total: ${fmtS((m.issuePaid||0)+(m.pending||0))}`;
          svgContent += `<text font-family="JetBrains Mono,monospace" font-size="${fs-1}" font-weight="700" x="7" y="${fs+14+lg*2}" fill="${tc}">${totalStr}`;
          if (ptsSum > 0) { svgContent += `<tspan fill="${fill === '#ffffff' || fill === '#f5f5f5' || fill === '#e8e4d8' ? '#b8943a' : '#d4ae5a'}"> | Pts: ${fmt(ptsSum)}</tspan>`; }
          svgContent += `</text>`;
          if(notes.length) { svgContent += `<line x1="6" y1="${nodeBaseHeight.value-6}" x2="${NW-6}" y2="${nodeBaseHeight.value-6}" stroke="${div}" stroke-width="0.6" opacity="0.5"/>`; notes.forEach((line,li)=>{ svgContent += `<text font-family="Noto Sans KR,sans-serif" font-size="${fs-2}" x="7" y="${nodeBaseHeight.value-2+li*lg}" fill="${tc}" opacity="0.85">${line}</text>`; }); }
          svgContent += `</g>`;
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${svgContent}</svg>`;
      }

      async function buildPrintDoc() {
        await nextTick();
        const orient = printLandscape.value ? 'landscape' : 'portrait'; const pw = PAGE_W_PX.value, ph = PAGE_H_PX.value;
        function histInRange(h) {
          if (printHistMode.value === 'all') return true; if (!h.date) return true; const parts = h.date.split('/'); if (parts.length < 3) return true;
          const yr = parseInt(parts[2]) + (parseInt(parts[2]) < 100 ? 2000 : 0); const hDate = new Date(yr, parseInt(parts[0])-1, parseInt(parts[1]));
          if (printHistMode.value === 'days') { const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - printHistDays.value); return hDate >= cutoff; }
          if (printHistMode.value === 'range') { const from = printHistFrom.value ? new Date(printHistFrom.value) : null; const to = printHistTo ? new Date(printHistTo.value) : null; if (from && hDate < from) return false; if (to && hDate > to) return false; }
          return true;
        }
        let svgHTML = ''; const useSubtree = printRootId.value && printRootId.value !== '__actual_root__';
        if (useSubtree) { svgHTML = buildSubtreeSVG(printRootId.value); } else { const svgEl = document.getElementById('main-tree-svg'); if (svgEl) { const clone = svgEl.cloneNode(true); clone.removeAttribute('width'); clone.removeAttribute('height'); clone.setAttribute('viewBox', `0 0 ${layout.value.totalWidth} ${layout.value.totalHeight}`); clone.style.cssText = 'width:100%;height:auto;display:block;'; svgHTML = clone.outerHTML; } }
        const subIds = useSubtree ? (() => { const cm={}; members.value.forEach(m=>cm[m.id]=[]); members.value.forEach(m=>{if(m.parentId&&cm[m.parentId])cm[m.parentId].push(m.id);}); function col(id,a){a.add(id);(cm[id]||[]).forEach(c=>col(c,a));return a;} return col(printRootId.value, new Set()); })() : null;
        const subMembers = subIds ? members.value.filter(m=>subIds.has(m.id)) : members.value;
        const tt = { paid: subMembers.reduce((s,m)=>s+(m.issuePaid||0),0), pending: subMembers.reduce((s,m)=>s+(m.pending||0),0), total: subMembers.reduce((s,m)=>s+(m.issuePaid||0)+(m.pending||0),0), };
        const sc={}; subMembers.forEach(m=>{if(m.parentId||useSubtree){sc[m.status]=(sc[m.status]||0)+1;}});
        const rm = useSubtree ? (members.value.find(m=>m.id===printRootId.value)||rootMember.value) : rootMember.value;
        const h = header; const uplines = []; if(h.fd) uplines.push(`<strong>FD</strong> ${h.fd}`); if(h.sfd) uplines.push(`<strong>SFD</strong> ${h.sfd}`); if(h.dd) uplines.push(`<strong>DD</strong> ${h.dd}`); if(h.efd) uplines.push(`<strong>EFD</strong> ${h.efd}`);
        subMembers.forEach(m => sortMemberHistory(m));
        const memberRows = subMembers.map(m => {
          const vis = (m.history||[]).filter(h=>h.show&&histInRange(h)); if(!vis.length) return '';
          const rows = vis.map(h => { let val = h.content; if (h.type === 'Point') { const c = h.content ? `(${h.content}) ` : ''; val = `${c}<span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#1c2b4a;">${fmt(h.point)} Pts</span>`; } return `<tr><td style="width:110px;white-space:nowrap;color:#555;font-family:'JetBrains Mono',monospace;font-size:9px">${h.date||'—'}</td><td style="font-size:10px">${val}</td></tr>`; }).join('');
          let mName = m.name; const pts = mPtsSum(m); if (pts > 0) { mName += ` <span style="font-size:8px; color:#b8943a; font-family:'JetBrains Mono',monospace;">(Total: ${fmt(pts)} Pts)</span>`; }
          return `<div class="pd-hist-member"><div class="pd-hist-name">${mName}</div><table class="pd-hist-table">${rows}</table></div>`;
        }).filter(Boolean).join('');
        const notesHTML = notes.value.map((n,i)=>`<div class="pd-note-item"><span class="pd-note-num">${i+1}</span>${n.text}</div>`).join('');
        let filterLabel = ''; if(printHistMode.value==='days') filterLabel=`최근 ${printHistDays.value}일`; else if(printHistMode.value==='range') filterLabel=`${printHistFrom.value||'시작'}~${printHistTo.value||'오늘'}`;
        let legendHTML = '';
        if (legendConfig.value.show) { legendHTML = allStatuses.filter(s => legendConfig.value.items[s].show).map(s => { let cntStr = sc[s] ? ` (${sc[s]})` : ''; return `<div class="pd-leg-item"><span class="pd-leg-box" style="background:${C[s]}!important;border:1px solid ${S[s]}!important"></span>${legendConfig.value.items[s].label}${cntStr}</div>`; }).join(''); }
        let headerHTML = '';
        headerHTML += `<div class="pd-header"><div class="pd-header-left">${legendHTML}</div>`;
        headerHTML += `<div class="pd-header-center"><div class="pd-name">${rm ? rm.name : ''} <span class="pd-id">(${h.id})</span></div>`;
        if (h.rank) { headerHTML += `<div style="display:inline-block;margin:4px 0;background:#1c2b4a;color:#fff;font-size:10px;font-weight:700;padding:2px 10px;border-radius:10px;letter-spacing:1px">${h.rank}</div>`; }
        if (uplines.length) { headerHTML += `<div class="pd-upline">${uplines.join('&nbsp;|&nbsp;')}</div>`; }
        headerHTML += `<div style="margin-top:8px;font-size:9.5px;color:#555;line-height:1.5"><strong>FD RUNNING PERIOD</strong><br>${h.periodStart} – ${h.periodEnd}</div></div>`;
        headerHTML += `<div class="pd-header-right"><div class="pd-date">As of ${h.asOf}</div><div class="pd-fin-row"><span class="pd-fin-label">Total Issue Paid</span><span class="pd-fin-val">${fmt(tt.paid)}</span></div><div class="pd-fin-row"><span class="pd-fin-label">Total Pending</span><span class="pd-fin-val">${fmt(tt.pending)}</span></div><div class="pd-fin-row pd-fin-total"><span>Total</span><span class="pd-fin-val">${fmt(tt.total)}</span></div></div></div>`;
        const totalHistItems = subMembers.reduce((s, m) => s + (m.history||[]).filter(h=>h.show&&histInRange(h)).length, 0);
        const needPageBreak = !printLandscape.value && totalHistItems > 10;
        let inner = '';
        if (printLandscape.value) {
          inner += `<div class="pd-body-landscape"><div class="pd-main-col">`;
          if (h.title) inner += `<div class="pd-doc-title">${h.title}</div>`;
          inner += `${headerHTML}<div class="pd-tree-wrap">${svgHTML}</div></div>`;
          if (memberRows || notes.value.length) {
            inner += `<div class="pd-side-col">`;
            if (memberRows) { inner += `<div class="pd-hist-section"><div class="pd-hist-section-title">📋 멤버 히스토리<span class="pd-hist-filter-label">${filterLabel}</span></div><div class="pd-hist-grid">${memberRows}</div></div>`; }
            if (notes.value.length) { inner += `<div style="margin-top:12px"><div class="pd-notes-title">📝 메모 / 액션 아이템</div><div class="pd-notes-grid">${notesHTML}</div></div>`; }
            inner += `</div>`;
          }
          inner += `</div>`;
        } else {
          if (h.title) inner += `<div class="pd-doc-title">${h.title}</div>`;
          inner += headerHTML + `<div class="pd-body-portrait"><div class="pd-main-col"><div class="pd-tree-wrap">${svgHTML}</div></div>`;
          if (memberRows || notes.value.length) {
            inner += `<div class="pd-side-col" ${needPageBreak ? 'style="page-break-before: always; margin-top: 20px;"' : ''}>`;
            if (memberRows) { inner += `<div class="pd-hist-section"><div class="pd-hist-section-title">📋 멤버 히스토리<span class="pd-hist-filter-label">${filterLabel}</span></div><div class="pd-hist-grid">${memberRows}</div></div>`; }
            if (notes.value.length) { inner += `<div style="margin-top:12px"><div class="pd-notes-title">📝 메모 / 액션 아이템</div><div class="pd-notes-grid">${notesHTML}</div></div>`; }
            inner += `</div>`;
          }
          inner += `</div>`;
        }

        return `<!DOCTYPE html><html><head>
          <meta charset="UTF-8">
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Libre+Baskerville:wght@700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
          <style>
            *{box-sizing:border-box;margin:0;padding:0;}
            body{font-family:'Noto Sans KR',sans-serif;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
            #wrap{width:${pw}px;min-height:${ph}px;padding:22px 24px;}
            @page{margin:0;size:letter ${orient};}
            @media print{ html,body{width:${pw}px;height:${ph}px;overflow:hidden;} #wrap{padding:22px 24px;transform-origin:top left;} }
            .edge-line{stroke:#6b7280;stroke-width:1.5px;fill:none;} .edge-dash{stroke:#9ca3af;stroke-width:1.2px;stroke-dasharray:5,3;fill:none;}
            .pd-doc-title{text-align:center;font-family:'Libre Baskerville',serif;font-size:26px;font-weight:700;color:#1c2b4a;margin-bottom:10px;padding-bottom:8px;border-bottom:2.5px solid #1c2b4a;}
            .pd-header{display:grid;grid-template-columns:145px 1fr 165px;align-items:stretch;border:2px solid #1c2b4a;margin-bottom:10px;background:#fff;}
            .pd-header-left{padding:8px 10px;font-size:10px;line-height:1.9;border-right:1px solid #1c2b4a;}
            .pd-leg-item{display:flex;align-items:center;gap:6px;margin-bottom:2px;font-size:9.5px;} .pd-leg-box{width:16px;height:10px;border-radius:2px;display:inline-block;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
            .pd-header-center{padding:8px 14px;text-align:center;border-right:1px solid #1c2b4a;display:flex;flex-direction:column;justify-content:center;}
            .pd-name{font-family:'Libre Baskerville',serif;font-size:19px;font-weight:700;} .pd-id{font-size:11px;color:#555;margin-left:5px;}
            .pd-upline{font-size:9.5px;color:#333;margin-top:4px;} .pd-upline strong{font-weight:700;color:#1c2b4a;margin-right:2px;}
            .pd-header-right{padding:8px 12px;font-size:10.5px;text-align:right;line-height:2;display:flex;flex-direction:column;justify-content:center;}
            .pd-fin-row{display:flex;justify-content:space-between;gap:6px;} .pd-fin-label{color:#555;} .pd-fin-val{font-family:'JetBrains Mono',monospace;font-weight:600;}
            .pd-fin-total{font-size:13px;font-weight:700;border-top:1.5px solid #1c2b4a;padding-top:3px;margin-top:3px;} .pd-date{font-size:9.5px;color:#666;margin-bottom:4px;}
            .pd-body-landscape { display: flex; gap: 20px; align-items: flex-start; } .pd-body-landscape .pd-main-col { flex: 1; min-width: 0; } .pd-body-landscape .pd-side-col { width: 310px; flex-shrink: 0; }
            .pd-body-portrait .pd-main-col { width: 100%; } .pd-body-portrait .pd-side-col { width: 100%; margin-top: 16px; }
            .pd-tree-wrap{border:1px solid #ddd;padding:6px;text-align:center;display:flex;justify-content:center;} .pd-tree-wrap svg{max-width:100%;height:auto;display:block;}
            .pd-hist-section-title{font-size:10px;font-weight:700;letter-spacing:.5px;color:#1c2b4a;text-transform:uppercase;border-bottom:1.5px solid #1c2b4a;padding-bottom:2px;margin-bottom:5px;}
            .pd-hist-filter-label{font-size:8.5px;color:#888;margin-left:6px;font-style:italic;}
            .pd-hist-grid { display: grid; gap: 5px 10px; } .pd-body-landscape .pd-hist-grid { grid-template-columns: 1fr; } .pd-body-portrait .pd-hist-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
            .pd-hist-member{break-inside:avoid;} .pd-hist-name{font-size:10.5px;font-weight:700;color:#1c2b4a;margin-bottom:1px;border-bottom:1px solid #ddd;padding-bottom:1px;}
            .pd-hist-table{width:100%;border-collapse:collapse;font-size:8.5px;} .pd-hist-table td{padding:1px 3px;border-bottom:1px dotted #eee;vertical-align:top;}
            .pd-notes-title{font-size:10px;font-weight:700;letter-spacing:.5px;color:#1c2b4a;text-transform:uppercase;margin-bottom:5px;border-bottom:1.5px solid #1c2b4a;padding-bottom:3px;}
            .pd-notes-grid { display: grid; gap: 2px 12px; } .pd-body-landscape .pd-notes-grid { grid-template-columns: 1fr; } .pd-body-portrait .pd-notes-grid { grid-template-columns: 1fr 1fr 1fr; }
            .pd-note-item{display:flex;align-items:baseline;gap:4px;font-size:10px;padding:2px 0;border-bottom:1px dotted #ccc;} .pd-note-num{font-weight:700;color:#b8943a;font-family:'JetBrains Mono',monospace;font-size:9px;flex-shrink:0;}
          </style>
        </head><body>
          <div id="wrap">${inner}</div>
          <script>
            window.onload = function() {
              var wrap = document.getElementById('wrap'); var ph = ${ph}, pw = ${pw}; var h = wrap.scrollHeight, w = wrap.scrollWidth;
              var scale = Math.min(pw/w, ph/h);
              if(scale < 1) { wrap.style.transformOrigin = 'top left'; wrap.style.transform = 'scale(' + scale + ')'; document.body.style.overflow = 'hidden'; }
            };
          <\/script>
        </body></html>`;
      }

      async function doPrint() { const html = await buildPrintDoc(); showPreview.value = true; await nextTick(); const frame = document.getElementById('preview-frame'); if (frame) { frame.srcdoc = html; } }
      function confirmPrint() { const frame = document.getElementById('preview-frame'); if (frame && frame.contentWindow) { let pageStyle = frame.contentDocument.getElementById('print-page-style'); if (!pageStyle) { pageStyle = frame.contentDocument.createElement('style'); pageStyle.id = 'print-page-style'; frame.contentDocument.head.appendChild(pageStyle); } pageStyle.textContent = `@page{margin:0;size:letter ${printLandscape.value?'landscape':'portrait'};}`; frame.contentWindow.print(); } }

      const rootMemberName = computed(() => rootMember.value ? rootMember.value.name : '');

      return {
        currentUser, loginWithGoogle, logout, cloudTrees, currentTreeId, newTreeName, fetchCloudTrees, saveToCloud, loadFromCloud, deleteFromCloud,
        header, members, notes, notesPosition, newNote, tab, STATUSES, nm,
        nodeWidth, widthLocked, nodeBaseHeight, heightLocked, nodeFontSize, fontLocked, nodeLineGap, lineGapLocked, notePanelWidth, notePanelLocked, expandedMemberId, newHist,
        printLandscape, printHistMode, printHistDays, printHistFrom, printHistTo, printRootId, showPreview, previewPageStyle, previewFrameStyle, focusRootId, focusedList, setFocus, clearFocus,
        recruits, recruitPosition, expandedRecruitId, newRecruit, newRecruitHist, recruitsSortedAll, visibleRecruits, addRecruit, removeRecruit, toggleRecruitPanel, addRecruitHist, removeRecruitHist,
        zoomLevel, panX, panY, zoomIn, zoomOut, zoomReset, centerTree, onWheel, onPanStart, onPanMove, onPanEnd,
        showSizePanel, rootMember, teamTotal, statusCounts, layout, isDirty, lastAutoSave, toast,
        nColor, nStroke, nTextColor, nDivider, nodeH, nodeNoteLines, statusBadge, fmt, fmtS, mPtsSum, calcPeriod, toggleHistoryPanel, addHistoryItem, removeHistoryItem, parentOpts, sortMemberHistory,
        addMember, removeMember, addNote, onNodeClick, quickSave, clearAuto, exportJSON, exportSubJSON, importJSON, doPrint, confirmPrint, legendConfig, allStatuses, C, S, checkPromoteRecruit, availableStatuses,
        getToastClass, getSaveStatusClass, getSaveStatusText, getRecruitMeta, panTransform, getEdgeClass, getNodeTransform, getRectStrokeWidth, getRectDash, getMemberTotal, getLegendMargin, getTbarClass, getPrintTitle, getPrintText, toggleFocus, getFocusTitle, getFocusIcon, getHistPlaceholder, getNewHistPlaceholder, currentMembers, rootMemberName
      };
    }
  }).mount('#app');
});
