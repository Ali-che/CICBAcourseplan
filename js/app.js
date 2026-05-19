// ══════════════════════════════════════════════════════
// ★ 修改这两行即可连接你的 Supabase 项目 ★
// ══════════════════════════════════════════════════════
const SUPABASE_URL = 'https://xzplzckugyvutsqocrtw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cGx6Y2t1Z3l2dXRzcW9jcnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzI0MjcsImV4cCI6MjA5NDYwODQyN30.GmbK_bnDceThgaVBBapZx6MrriEyNjbhVHrN1Ei4Hb8';
// ══════════════════════════════════════════════════════

const COHORTS = ['66','67','68','69','70','71','72','73','74','75']; // 动态扩展
let NOW_SEM = localStorage.getItem('now_sem') || '2568/2';
const TEP_PASS = 39;

// ── State ──────────────────────────────────────────────
let DB = { students: [], programs: [] };
let currentUser = null;

const _PW = 'CICTM2569';

function doLogin(){
  const val=document.getElementById('pw-input')?.value||'';
  if(val===_PW){
    sessionStorage.setItem('cic_auth','1');
    const ov=document.getElementById('login-overlay');
    if(ov) ov.style.display='none';
    document.getElementById('pw-error').textContent='';
  } else {
    const err=document.getElementById('pw-error');
    if(err){ err.textContent='密码错误，请再试一次'; }
    const inp=document.getElementById('pw-input');
    if(inp){ inp.value=''; inp.focus(); inp.style.borderColor='#dc2626'; setTimeout(()=>inp.style.borderColor='#e5e7eb',1500); }
  }
}
function checkAuth(){
  const ov=document.getElementById('login-overlay');
  if(!ov) return;
  if(sessionStorage.getItem('cic_auth')==='1'){
    ov.style.display='none';
  } else {
    ov.style.display='flex';
    setTimeout(()=>document.getElementById('pw-input')?.focus(), 100);
  }
}
function logout(){
  sessionStorage.removeItem('cic_auth');
  const ov=document.getElementById('login-overlay');
  if(ov){ ov.style.display='flex'; }
  const inp=document.getElementById('pw-input');
  if(inp){ inp.value=''; setTimeout(()=>inp.focus(),100); }
}
function updateLoginUI(){
  const btn=document.getElementById('login-btn');
  if(btn){ btn.textContent='登出'; btn.onclick=logout; }
}
let activeProg = 'TourismManagement';
let activeFilter = 'all';
let cellCtx = null;
let pickedVal = null;
let tepCtx = null;
let pendingDiffs = [];
let pendingProgCourses = [];
let batchResults = [];
let selectMode = false;
let selectedIds = new Set();
let currentView = 'card';

// ── Supabase REST ──────────────────────────────────────
async function sb(path, opts = {}) {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': opts.prefer || 'return=representation',
    ...(opts.headers || {})
  };
  delete opts.headers;
  delete opts.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.details || res.statusText);
  }
  if(res.status === 204) return null;
  const text = await res.text();
  if(!text || !text.trim()) return null;
  try{ return JSON.parse(text); }catch(e){ return null; }
}

// ── Row converters ─────────────────────────────────────
function toRow(s) {
  return {
    id: s.id,
    prog: s.prog || 'TM',
    name: s.name,
    cname: s.cname||'',
    cohort: s.cohort,
    type: s.type || 'normal',
    note: s.note || '',
    note_text: s.noteText || '',
    advisor: s.advisor || '',
    status: s.status || '就读',
    class_code: s.classCode || '',
    status_detail: s.statusDetail || {},
    courses: s.courses || {},
    tep: s.tep || {},
    gpa: s.gpa || null,
    gpa_history: s.gpaHistory || [],
    gpa_updated: s.gpaUpdated || null,
    dpu_tep_score: s.dpuTepScore || null,
    counselor_notes: s.counselorNotes || [],
    counselor: s.counselor || {},
    updated_at: new Date().toISOString()
  };
}

function fromRow(r) {
  return {
    id: r.id,
    prog: r.prog || 'TM',
    name: r.name,
    cname: r.cname||'',
    cohort: r.cohort,
    type: r.type || 'normal',
    note: r.note || '',
    noteText: r.note_text || '',
    advisor: r.advisor || '',
    status: r.status || '就读',
    classCode: r.class_code || '',
    statusDetail: (()=>{try{return typeof r.status_detail==='object'?r.status_detail:JSON.parse(r.status_detail||'{}')}catch(e){return{}}})(),
    courses: r.courses || {},
    tep: r.tep || {},
    gpa: r.gpa != null ? parseFloat(r.gpa) : null,
    gpaHistory: r.gpa_history || [],
    gpaUpdated: r.gpa_updated || '',
    dpuTepScore: r.dpu_tep_score || null,
    counselorNotes: r.counselor_notes || [],
    counselor: r.counselor || {}
  };
}

function fromProgRow(r) {
  const courses=Array.isArray(r.courses)?r.courses:(typeof r.courses==='string'?JSON.parse(r.courses||'[]'):[]);
  return { id: r.id, name: r.name, totalCr: r.total_cr || 123, courses, preCohorts: r.pre_cohorts || [] };
}

// ── API helpers (replaces GAS api()) ──────────────────
function setSyncing(on) {
  document.getElementById('sync-dot').className = 'sync-dot' + (on ? ' syncing' : '');
  document.getElementById('sync-label').textContent = on ? '同步中...' : '已同步';
}
function setSyncError() {
  document.getElementById('sync-dot').className = 'sync-dot error';
  document.getElementById('sync-label').textContent = '同步失败';
}

async function apiGetAll() {
  setSyncing(true);
  try {
    const [students, programs] = await Promise.all([
      sb('students?select=*&order=id'),
      sb('programs?select=*')
    ]);
    setSyncing(false);
    return {
      students: (students || []).map(fromRow),
      programs: (programs || []).map(fromProgRow).filter(p => p.id)
    };
  } catch(e) { setSyncError(); throw e; }
}

async function apiSaveStudent(s) {
  setSyncing(true);
  try {
    await sb('students', {
      method: 'POST',
      body: JSON.stringify(toRow(s)),
      prefer: 'resolution=merge-duplicates,return=minimal'
    });
    setSyncing(false);
  } catch(e) { setSyncError(); throw e; }
}

async function apiDeleteStudent(id) {
  setSyncing(true);
  try {
    await sb(`students?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    setSyncing(false);
  } catch(e) { setSyncError(); throw e; }
}

async function apiSaveCourse(studentId, courseCode, value) {
  const s = DB.students.find(x => x.id === studentId); if (!s) return;
  if (!s.courses) s.courses = {};
  if (value) s.courses[courseCode] = value; else delete s.courses[courseCode];
  setSyncing(true);
  try {
    await sb(`students?id=eq.${encodeURIComponent(studentId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ courses: s.courses, updated_at: new Date().toISOString() }),
      prefer: 'return=minimal'
    });
    setSyncing(false);
  } catch(e) { setSyncError(); throw e; }
}

async function apiSaveTep(studentId, type, data) {
  const s = DB.students.find(x => x.id === studentId); if (!s) return;
  if (!s.tep) s.tep = {};
  if (data && Object.keys(data).length) s.tep[type] = data; else delete s.tep[type];
  setSyncing(true);
  try {
    await sb(`students?id=eq.${encodeURIComponent(studentId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ tep: s.tep }),
      prefer: 'return=minimal'
    });
    setSyncing(false);
  } catch(e) { setSyncError(); throw e; }
}

async function apiSaveGpa(studentId, gpa, updatedAt) {
  const s = DB.students.find(x => x.id === studentId); if (!s) return;
  setSyncing(true);
  try {
    await sb(`students?id=eq.${encodeURIComponent(studentId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ gpa, gpa_history: s.gpaHistory || [], gpa_updated: updatedAt }),
      prefer: 'return=minimal'
    });
    setSyncing(false);
  } catch(e) { setSyncError(); throw e; }
}

async function apiSaveCounselor(studentId, data) {
  const s = DB.students.find(x => x.id === studentId); if (!s) return;
  setSyncing(true);
  try {
    await sb(`students?id=eq.${encodeURIComponent(studentId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        advisor: data.advisor || s.advisor || '',
        status: s.status || '就读',
        counselor: data,
        counselor_notes: s.counselorNotes || [],
        updated_at: new Date().toISOString()
      }),
      prefer: 'return=minimal'
    });
    setSyncing(false);
  } catch(e) { setSyncError(); throw e; }
}

async function apiSaveBatch(students) {
  if (!students || !students.length) return;
  // 去重：同一批次里相同 id 只保留最后一个
  const seen=new Map();
  students.forEach(s=>seen.set(s.id,s));
  const unique=[...seen.values()];
  if(!unique.length) return;
  setSyncing(true);
  try {
    const rows = unique.map(toRow);
    await sb('students', {
      method: 'POST',
      body: JSON.stringify(rows),
      prefer: 'resolution=merge-duplicates,return=minimal'
    });
    setSyncing(false);
  } catch(e) { setSyncError(); throw e; }
}

async function apiDeleteProgram(progId) {
  setSyncing(true);
  try {
    await sb('programs?id=eq.'+encodeURIComponent(progId), {method:'DELETE'});
    setSyncing(false);
  } catch(e) { setSyncError(); throw e; }
}

async function apiSaveProgram(prog) {
  setSyncing(true);
  try {
    await sb('programs', {
      method: 'POST',
      body: JSON.stringify({ id: prog.id, name: prog.name, total_cr: prog.totalCr, courses: prog.courses, pre_cohorts: prog.preCohorts||[] }),
      prefer: 'resolution=merge-duplicates,return=minimal'
    });
    setSyncing(false);
  } catch(e) { setSyncError(); throw e; }
}

// ── Export / Import JSON (local backup) ───────────────
function exportData() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `CICBATM_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function importJSON(inp) {
  const file = inp.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.students) { alert('格式不正确'); return; }
      if (!confirm(`导入 ${data.students.length} 位学生资料？将覆盖 Supabase 现有数据。`)) return;
      DB.students = (data.students||[]).map(s=>({...s,classCode:s.classCode||autoClassCode(s.cohort,s.type)}));
      if (data.programs && data.programs.length) DB.programs = data.programs;
      render();
      await apiSaveBatch(DB.students);
      for (const p of DB.programs) { try { await apiSaveProgram(p); } catch(e){} }
      alert('✓ 导入完成并已同步至 Supabase');
    } catch(err) { alert('导入失败：' + err.message); }
  };
  reader.readAsText(file);
  inp.value = '';
}

// ── Init ────────────────────────────────────────────────
async function init() {
  document.getElementById('sync-label').textContent = '连接中...';
  try {
    const data = await apiGetAll();
    DB.students = (data.students||[]).map(s=>({...s,classCode:s.classCode||autoClassCode(s.cohort,s.type)}));
    DB.programs = data.programs && data.programs.length
      ? data.programs
      : [{ id: 'TM', name: '旅游管理 TM', totalCr: 123, courses: getBuiltinTMCourses() }];
    // Fix empty group names for TM
    DB.programs.forEach(prog => {
      const bm = {};
      getBuiltinTMCourses().forEach(c => bm[c.c] = c);
      // 如果专业 courses 为空，用内建 TM 课程作为 fallback（适用任何 TM 相关专业）
      if (!prog.courses || !prog.courses.length) {
        const isTM=prog.id==='TM'||prog.name?.toLowerCase().includes('tourism');
        if(isTM) prog.courses = getBuiltinTMCourses();
      } else {
        // 补全缺失的 group 名称
        (prog.courses || []).forEach(c => {
          if (!c.g) c.g = bm[c.c]?.g || '自由选修';
          if (!c.n || c.n === c.c) c.n = bm[c.c]?.n || c.n;
        });
      }
    });
    if (!DB.programs.length) DB.programs = [{ id: 'TM', name: '旅游管理 TM', totalCr: 123, courses: getBuiltinTMCourses() }];
    // 设定 activeProg 为第一个专业
    if(DB.programs.length) activeProg=DB.programs[0].id;
    render();
    renderAdvisorDropdowns();
  } catch(err) {
    document.getElementById('sync-dot').className = 'sync-dot error';
    document.getElementById('sync-label').textContent = '连接失败';
    alert('连接 Supabase 失败！\n\n请检查 SUPABASE_URL 和 SUPABASE_KEY 是否正确填入。\n\n错误：' + err.message);
  }
}

// ── Helpers ────────────────────────────────────────────
function getProg(id) { return DB.programs.find(p=>p.id===id) || DB.programs[0] || {id:'TM',name:'TM',totalCr:123,courses:[]}; }
function progCourses(pid) { return (getProg(pid)||{}).courses || []; }
function groups(pid) {
  const TM_LAYOUT = [
    {g:'通识课·必修'},{g:'通识课·选修'},{g:'基础专业课'},{g:'旅游专业·必修'},
    {g:'Capstone'},{g:'旅游专业·选修'},{g:'实习课程'},{g:'语言修选'},{g:'自由选修'},
  ];
  const courses = progCourses(pid);
  const gs=[], seen={};
  const layoutGroups = TM_LAYOUT.map(l=>l.g);
  const ordered = [
    ...courses.filter(c=>layoutGroups.includes(c.g)).sort((a,b)=>layoutGroups.indexOf(a.g)-layoutGroups.indexOf(b.g)),
    ...courses.filter(c=>!layoutGroups.includes(c.g))
  ];
  ordered.forEach(c=>{
    if(!seen[c.g]){seen[c.g]=1;gs.push({g:c.g,label:c.g,cr:'',note:'',courses:[]});}
    gs.find(x=>x.g===c.g).courses.push(c);
  });
  return gs;
}

// ── 课程进度计算（统一函数）────────────────────────────
function calcProgress(s, allPC) {
  const c = s.courses || {};
  const INTERN_CODES = new Set(['KT411','KT331','KT332']);
  const GE_SEL_GROUPS = new Set(['终身学习-选修','价值论理-选修','生活质量-选修']);
  const SKIP_GROUPS = new Set(['实习课程','旅游专业·选修']);  // 自由选修现在计入
  const EXT1_CODE = 'KH160';

  let doneCr = 0, doneC = 0, transferC = 0, transferCr = 0;
  const geSelDone = {};   // 每组最多算1门
  let langSelDone = 0;    // 最多算5门

  // 学期比较辅助（判断是否 <= NOW_SEM）
  const _sv=v=>{if(!v||v==='-'||v==='Transferred')return null;const m=v.match(/^(25\d\d)\/(\d)$/);return m?parseInt(m[1])*10+parseInt(m[2]):null;};
  const _nowV=_sv(NOW_SEM)||99999;
  const _semOk=v=>v==='Transferred'||(_sv(v)!==null&&_sv(v)<=_nowV);

  // 不在课程架构里的课（外系选修如 FA301）也计入学分
  const pcCodes = new Set(allPC.map(co=>co.c));
  // 外系选修（不在课程架构里的课）计入学分，但排除 ext2 slot 本身和实习代码
  const ext2Val=(c['ext2']||'').split('|');
  const ext2Code=ext2Val[0]?.trim().toUpperCase()||'';
  const INTERN_EXTRA=new Set(['KT411','KT331','KT332']);
  Object.keys(c).forEach(code=>{
    if(pcCodes.has(code)) return;
    if(code==='ext2') return; // ext2 slot 本身不计（代码才计）
    if(code===ext2Code) return; // ext2 的实际课程代码已经在 ext2 slot 里计了
    if(INTERN_EXTRA.has(code)) return; // 实习不计入 38 课课数
    const val=c[code];
    if(!val||val==='Transferred') return;
    if(!_semOk(val)) return; // 只计 <= NOW_SEM 的课
    doneCr+=3; doneC++;
  });
  // ext2 slot：有实际课程代码+学期 → 计1门；或是 Transferred → 也计1门
  const ext2Raw=c['ext2']||'';
  const ext2Sem=ext2Val.length>1?ext2Val[1]:'';
  if(ext2Code&&ext2Sem&&_semOk(ext2Sem)){doneCr+=3;doneC++;}
  else if(ext2Raw==='Transferred'){doneCr+=3;doneC++;}

  allPC.forEach(co => {
    if (INTERN_CODES.has(co.c) || SKIP_GROUPS.has(co.g)) return;
    const val = c[co.c];
    if (!val) return;
    if(!_semOk(val)) return; // 只计 <= NOW_SEM 的课
    const isTransfer = val === 'Transferred';

    if (co.g === '语言修选') {
      if (langSelDone < 5) { langSelDone++; doneCr += co.cr; doneC++; }
      if (isTransfer && langSelDone <= 5) transferC++;
      return;
    }
    if (GE_SEL_GROUPS.has(co.g)) {
      if (!geSelDone[co.g]) {
        geSelDone[co.g] = true;
        doneCr += co.cr; doneC++;
        if (isTransfer) transferC++;
      }
      return;
    }
    // 其余课程（GE必修、语言跨文化、基础、旅游必修、Capstone）
    doneCr += co.cr; doneC++;
    if (isTransfer) { transferC++; transferCr += co.cr; }
  });

  // 外系选修1 = KH160（在 allPC 里，被当普通课算了）
  // 外系选修2 = ext2（已在上面 ext2Code 处计入，这里不重复）
  // ext3 不计入38课

  // 实习：只计学分，不计课数（实习不占 38 门名额）
  // 实习完成：实习学期 < 当下学期（已出成绩）才算完成
  const _semVal=v=>{if(!v||v==='-'||v==='Transferred')return null;const m=v.match(/^(25\d\d)\/(\d)$/);return m?parseInt(m[1])*10+parseInt(m[2]):null;};
  const _nowVal=_semVal(NOW_SEM)||0;
  const _internDone=v=>{const sv=_semVal(v);return sv!==null&&sv<_nowVal;};
  const internOk = !!(_internDone(c['KT411']) || (_internDone(c['KT331']) && _internDone(c['KT332'])));
  const internTransfer = c['KT411'] === 'Transferred' || (c['KT331'] === 'Transferred' && c['KT332'] === 'Transferred');
  if (internOk) { doneCr += 6; }

  const totalCr = 123, totalC = 38;
  const doneCCapped = Math.min(doneC, totalC); // 课数上限 38
  const doneCrCapped = Math.min(doneCr, totalCr);  // 上限 123
  const remCr = Math.max(0, totalCr - doneCrCapped);
  const remC  = Math.max(0, totalC - doneCCapped);

  return { doneCr: doneCrCapped, doneC: doneCCapped, remCr, remC, internOk, transferC, transferCr, internTransfer };
}

function doneCredits(s) { return calcProgress(s, progCourses(s.prog||'TM')).doneCr; }
function doneCourses(s) { return calcProgress(s, progCourses(s.prog||'TM')).doneC; }
function semsByStudent(s) {
  const base=parseInt(s.cohort)+2500, years=s.type==='transfer'?3:4, sems=[];
  for(let y=0;y<years;y++) sems.push(`${base+y}/1`,`${base+y}/2`,`${base+y}/3`);
  return sems;
}
function shortName(n) { if(!n||typeof n!=='string') return '—'; return n.replace(/^(Mr\.|Miss|Mrs\.|Ms\.)\s*/i,'').split(' ').slice(0,2).join(' '); }
function gpaClass(g) { if(!g) return 'none'; return g>=2?'ok':g>=1.5?'warn':'risk'; }
function gpaLabel(g) {
  if(!g) return '';
  if(g>=2) return '✅ 风险解除';
  if(g>=1.5) return '⚠️ 一般风险：定期访谈';
  if(g>=1) return '🚫 重点预警：紧急深度干预';
  return '🔴 极高风险：紧急深度干预';
}
function visStudents() {
  let s=DB.students.filter(x=>(x.prog||'TM')===activeProg);
  const co=document.getElementById('bar-classcode')?.value||'';
  if(co) s=s.filter(x=>x.cohort===co);
  const st=document.getElementById('bar-status')?.value||'';
  if(st) s=s.filter(x=>{
    const sd=x.statusDetail||{};
    if(st==='退学') return sd.withdrawn;
    if(st==='休学') return sd.leave&&sd.leave.length>0&&!sd.withdrawn;
    if(st==='在学'){const _pg=calcProgress(x,progCourses(x.prog||'TM'));const _gn2=parseFloat(x.gpa);const _isGrad2=_pg.remC===0&&_pg.internOk&&(x.gpa==null||_gn2>=2.0);return !sd.withdrawn&&!(sd.leave&&sd.leave.length>0)&&!_isGrad2;}
    if(st==='毕业'){const p=calcProgress(x,progCourses(x.prog||'TM'));const _gn=parseFloat(x.gpa);return p.remC===0&&p.internOk&&(x.gpa==null||_gn>=2.0);}
    return true;
  });
  const nt=document.getElementById('bar-note')?.value||'';
  if(nt){
    if(nt==='jmei'||nt==='btec'||nt==='other'){
      s=s.filter(x=>x.note===nt);
    } else if(nt==='tep_fail'){
      s=s.filter(x=>{const tx=x.tep?.exit;return tx&&parseInt(tx.score||0)<TEP_PASS&&!(tx.retest&&parseInt(tx.retest||0)>=TEP_PASS);});
    } else if(nt==='gpa_warn'){
      s=s.filter(x=>x.gpa&&parseFloat(x.gpa)<2.0);
    } else if(nt==='intern_eligible'){
      s=s.filter(x=>{const p=calcProgress(x,progCourses(x.prog||'TM'));const gn=parseFloat(x.gpa);return p.remC===0&&!p.internOk&&gn>=2.0;});
    }
  }
  const av=document.getElementById('bar-advisor')?.value||'';
  if(av) s=s.filter(x=>x.advisor===av);
  return s.sort((a,b)=>a.id.localeCompare(b.id));
}
function cohortStudents(co) {
  const studs=DB.students.filter(s=>(s.prog||'TM')===activeProg&&s.cohort===co).sort((a,b)=>a.id.localeCompare(b.id));
  // 预建班级：没有学生且没有预建班级时跳过
  const _progPC=getProg(activeProg);
  const _preCodes=(_progPC?.preCohorts||[]).filter(cc=>cc.replace(/[^0-9]/g,'')===co||cc.replace(/[^0-9]/g,'').startsWith(co));
  if(studs.length===0&&_preCodes.length===0) return '';
  return studs;
}

// ── Sync ───────────────────────────────────────────────
async function syncFromSheet() {
  gpShow("连接数据库...");
  const btn = document.getElementById('sync-btn');
  if(btn) { btn.textContent='⟳ 同步中...'; btn.disabled=true; }
  try {
    const data = await apiGetAll();
    DB.students = (data.students||[]).map(s=>({...s,classCode:s.classCode||autoClassCode(s.cohort,s.type)}));
    if (data.programs && data.programs.length) {
      DB.programs = data.programs;
      DB.programs.forEach(prog => {
        if(prog.id==='TM') {
          const bm={};
          getBuiltinTMCourses().forEach(c=>bm[c.c]=c);
          prog.courses.forEach(c=>{if(!c.g)c.g=bm[c.c]?.g||'自由选修';});
        }
      });
    }
    if(!DB.programs.length) DB.programs=[{id:'TM',name:'旅游管理 TM',totalCr:123,courses:getBuiltinTMCourses()}];
    render();
    if(btn){ btn.textContent='⟳ 同步'; btn.disabled=false; }
  } catch(e) {
    if(btn){ btn.textContent='⟳ 同步'; btn.disabled=false; }
    alert('同步失败：'+e.message);
  }
}

// ── Tabs ───────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.bar-tabs .tab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('on'));
  document.getElementById('tab-'+tab)?.classList.add('on');
  const idx={'overview':0,'progress':1,'classtable':2,'counsel':3};
  const tabs=document.querySelectorAll('.bar-tabs .tab');
  if(tabs[idx[tab]]!==undefined) tabs[idx[tab]].classList.add('on');
  if(tab==='counsel') renderCounselPage();
  if(tab==='classtable') renderClassTable();
  if(tab==='overview') renderOverview();

  sessionStorage.setItem('activeTab', tab);
}

// ── Render ─────────────────────────────────────────────
function render() {
  renderFilterBar(); renderCards(); renderOverview(); renderPdfSel(); renderProgSelect();
  const sl=document.getElementById('sync-label');
  if(sl) sl.textContent=`已同步 · ${DB.students.length}位学生`;
  const progStuds = DB.students.filter(s=>(s.prog||'TM')===activeProg);
  const bs=document.getElementById('bstat');
  // 追踪中 = 不含达标毕业
  const tracking=progStuds.filter(s=>{const p=calcProgress(s,progCourses(s.prog||'TM'));const _gn=parseFloat(s.gpa);const _isGrad=p.remC===0&&p.internOk&&(s.gpa==null||_gn>=2.0);return !_isGrad;});
  if(bs) bs.textContent=tracking.length||'—';
  // 届别 pills
  const _yrColors=[
    {bg:'#fce7f3',fg:'#9d174d'},{bg:'#dbeafe',fg:'#1e40af'},{bg:'#dcfce7',fg:'#166534'},
    {bg:'#fef9c3',fg:'#713f12'},{bg:'#f3e8ff',fg:'#6d28d9'},{bg:'#e0f2fe',fg:'#0c4a6e'},
    {bg:'#ffedd5',fg:'#9a3412'},{bg:'#f0fdf4',fg:'#14532d'}
  ];
  const _yrs=[...new Set(progStuds.map(s=>s.cohort))].filter(Boolean).sort();
  const _pillEl=document.getElementById('cohort-pills');
  if(_pillEl){
    _pillEl.innerHTML=_yrs.map((yr,i)=>{
      const pal=_yrColors[i%_yrColors.length];
      const yrStuds=tracking.filter(s=>s.cohort===yr);
      const cnt=yrStuds.length;
      const leaveN=yrStuds.filter(s=>{const sd=s.statusDetail||{};return sd.leave&&sd.leave.length&&!sd.withdrawn;}).length;
      const activeN=cnt-leaveN;
      const tip=leaveN>0?`在学${activeN} · 休学${leaveN}`:`在学${activeN}`;
      return `<span title="${tip}" style="font-size:10px;font-weight:600;color:${pal.fg};background:${pal.bg};padding:2px 8px;border-radius:20px;white-space:nowrap;cursor:default;">${yr}·${cnt}</span>`;
    }).join('');
  }
  const atRisk = progStuds.filter(s=>s.gpa&&parseFloat(s.gpa)<2.0).length;
  const total = progStuds.length;
  // 更新顶部预警和当前学期
  const warnEl=document.getElementById('bar-warn');
  if(warnEl){const rate=total>0?Math.round(atRisk/total*100):0;warnEl.innerHTML=atRisk>0?`△ 预警 <strong style="color:#fef08a">${atRisk}人</strong> (${rate}%)`:'✓ 无预警';}
  const semEl=document.getElementById('bar-sem');
  if(semEl) semEl.textContent=NOW_SEM||'';
  const riskEl=document.getElementById('risk-stat');
  if(riskEl){const rate=total>0?Math.round(atRisk/total*100):0;riskEl.innerHTML=atRisk>0?`△ 预警 <strong>${atRisk}</strong>人 (${rate}%)`:'△ 预警 0人 (0%)';riskEl.style.color=atRisk>0?'var(--amber-m)':'var(--g4)';}
  const internCount=progStuds.filter(s=>s.statusDetail?.internship||(s.courses?.['KT411']&&s.courses['KT411']===NOW_SEM)).length;
  const internEl=document.getElementById('intern-stat');
  if(internEl){internEl.innerHTML=internCount>0?`→ 实习 <strong style="color:#fff">${internCount}</strong>人`:'→ 实习 0人';internEl.style.color=internCount>0?'#93c5fd':'var(--g4)';}
}

function renderFilterBar() {
  const psel=document.getElementById('bar-prog');
  if(psel) psel.innerHTML=`<option value="all" ${activeProg==='all'?'selected':''}>全专业</option>`+DB.programs.map(p=>`<option value="${p.id}"${p.id===activeProg?' selected':''}>${p.name}</option>`).join('');
  const ccsel=document.getElementById('bar-classcode');
  if(ccsel){
    const cur=ccsel.value;
    const prog=getProg(activeProg);
  const studentCohorts=[...new Set(DB.students.filter(s=>(s.prog||'TM')===activeProg).map(s=>s.cohort).filter(Boolean))];
  const preCohorts=(prog?.preCohorts||[]).map(cc=>{
    const m=cc.match(/(\d{2})/);return m?m[1]:null;
  }).filter(Boolean);
  const cohorts=[...new Set([...studentCohorts,...preCohorts])].sort();
    ccsel.innerHTML='<option value="">学生届别</option>'+cohorts.map(c=>`<option value="${c}"${c===cur?' selected':''}>${c}届</option>`).join('');
  }
  // 辅导员老师下拉：从 getAdvisors() 名单
  const advEl=document.getElementById('bar-advisor');
  if(advEl){
    const cur=advEl.value;
    const advisors=getAdvisors();
    advEl.innerHTML='<option value="">辅导员老师</option>'+advisors.map(a=>`<option value="${a}" ${a===cur?'selected':''}>${a}</option>`).join('');
    if(advisors.includes(cur)) advEl.value=cur;
  }
}

function switchProg(id) { activeProg=id; activeFilter='all'; render(); }
function setFilter(f) { activeFilter=f; renderCards(); renderBlocks(); }
function toggleListExpand(sid,btn){
  const body=document.getElementById('lv-body-'+sid);
  const icon=document.getElementById('lv-icon-'+sid);
  const label=document.getElementById('lv-label-'+sid);
  if(!body)return;
  const isOpen=body.classList.toggle('lv-expanded');
  if(icon)icon.textContent=isOpen?'－':'＋';
  if(btn)btn.style.color=isOpen?'var(--g7)':'';
  const s=DB.students.find(x=>x.id===sid);
  if(s&&label){const d=doneCredits(s),total=(getProg(s.prog||'TM')).totalCr||123;label.textContent=isOpen?'收起':`展开详情 · ${Math.round(d/total*100)}% · ${d}/${total}学分`;}
}

function jumpToCard(sid){
  // 确保在学生进度 tab
  switchTab('progress');
  // 切换到卡片模式
  setViewMode('card');
  renderCards();
  // 等 DOM 渲染后滚动到该卡片
  setTimeout(()=>{
    const card=document.getElementById('card-'+sid);
    if(card){
      card.scrollIntoView({behavior:'smooth',block:'center'});
      // 短暂高亮
      card.style.transition='box-shadow .2s';
      card.style.boxShadow='0 0 0 3px var(--h-accent),0 4px 20px rgba(0,0,0,.15)';
      setTimeout(()=>{ card.style.boxShadow=''; },1500);
    }
  },80);
}

function setViewMode(mode) {
  currentView=mode;
  const cardsEl=document.getElementById('cards');
  document.getElementById('vp-card').className='vp'+(mode==='card'?' on':'');
  document.getElementById('vp-list').className='vp'+(mode==='list'?' on':'');
  if(mode==='list') cardsEl?.classList.add('list-view');
  else cardsEl?.classList.remove('list-view');
}

// ── Batch select ───────────────────────────────────────
function toggleSelectMode() {
  selectMode=!selectMode; selectedIds.clear();
  const btn=document.getElementById('select-mode-btn');
  if(btn) btn.textContent=selectMode?'✕ 取消':'☐ 批次管理';
  renderCards();

}
function toggleSelect(sid) {
  if(selectedIds.has(sid)) selectedIds.delete(sid); else selectedIds.add(sid);
  const card=document.getElementById('card-'+sid);
  if(card) card.classList.toggle('selected',selectedIds.has(sid));

}
function selectAll() {
  visStudents().forEach(s=>selectedIds.add(s.id)); renderCards();

}
async function batchDelete() {
  if(!selectedIds.size){alert('请先选择要删除的学生');return;}
  const sorted=[...selectedIds].sort();
  const nameList=sorted.map((id,i)=>{
    const s=DB.students.find(x=>x.id===id);
    return `${String(i+1).padStart(2,'0')}. ${id}  ${s?.name||''}`;
  }).join('\n');
  if(!confirm(`确定删除以下 ${selectedIds.size} 位学生？\n\n${nameList}\n\n此操作无法恢复。`)) return;
  const ids=[...selectedIds];
  gpShow(`删除学生中...`);
  // 先从本地删除
  ids.forEach(id=>{DB.students=DB.students.filter(s=>s.id!==id);});
  // 并行删除（Promise.all）
  gpSet('连接数据库...', 30);
  await Promise.allSettled(ids.map(id=>apiDeleteStudent(id)));
  gpSet('完成', 100);
  gpDone(`✓ 已删除 ${ids.length} 位学生`);
  selectedIds.clear();
  selectMode=false;
  const _smb=document.getElementById('select-mode-btn');
  if(_smb) _smb.textContent='☐ 批次管理';
  render();
}

// ── Cards ──────────────────────────────────────────────
function clearFilters(){
  const ids=['bar-classcode','bar-status','bar-note','bar-advisor','bar-search'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderCards();
}
function _updateClearBtn(){
  const btn=document.getElementById('btn-clear-filters');
  if(!btn)return;
  const hasFilter=['bar-classcode','bar-status','bar-note','bar-advisor','bar-search'].some(id=>{
    const el=document.getElementById(id);return el&&el.value;
  });
  btn.style.display=hasFilter?'':'none';
}
function renderCards() {
  _updateClearBtn();
  const grid=document.getElementById('cards');
  const q=(document.getElementById('bar-search')?.value||'').trim().toLowerCase();
  let studs=visStudents();
  if(q) studs=studs.filter(s=>s.id.toLowerCase().includes(q)||(s.name||'').toLowerCase().includes(q));
  if(!studs.length){
    // 无学生时退出批次模式
    if(selectMode){selectMode=false;selectedIds.clear();const _b=document.getElementById('select-mode-btn');if(_b)_b.textContent='☐ 批次管理';}
    grid.innerHTML=`<div style="color:var(--ink3);grid-column:1/-1;padding:16px 0">${q?`没有符合「${q}」的学生`:'尚无学生'}</div>`;
    return;
  }
  if(selectMode) {
    grid.innerHTML=`<div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 12px;background:var(--amber-l);border:1px solid var(--amber-m);border-radius:6px;font-size:12px;">
      <span style="color:var(--amber);font-weight:500;">已选 <strong>${selectedIds.size}</strong> / ${studs.length} 位</span>
      <button onclick="selectAll()" style="padding:3px 10px;border-radius:5px;border:1px solid var(--amber);background:transparent;color:var(--amber);cursor:pointer;font-size:11px;font-family:var(--font);">☑ 全选</button>
      <button onclick="selectedIds.clear();renderCards();" style="padding:3px 10px;border-radius:5px;border:1px solid var(--amber);background:transparent;color:var(--amber);cursor:pointer;font-size:11px;font-family:var(--font);">清除</button>
      <div style="flex:1;"></div>
      <button onclick="batchDelete()" style="padding:3px 14px;border-radius:5px;border:none;background:#dc2626;color:#fff;cursor:pointer;font-size:11px;font-weight:600;font-family:var(--font);">🗑 删除所选 (${selectedIds.size})</button>
      <button onclick="toggleSelectMode()" style="padding:3px 10px;border-radius:5px;border:1px solid var(--line2);background:#fff;color:var(--ink2);cursor:pointer;font-size:11px;font-family:var(--font);">✕ 取消</button>
    </div>`+studs.map(s=>cardHTML(s)).join('');
  } else {
    grid.innerHTML=studs.map(s=>cardHTML(s)).join('');
  }
  if(currentView==='list') grid.classList.add('list-view');
}

function cardHTML(s) {
  const prog=getProg(s.prog||'TM'),total=prog.totalCr||123;
  const TOTAL_C=38; // 38课（不含实习）
  const _p=calcProgress(s,progCourses(s.prog||'TM')),d=_p.doneCr,rem=_p.remCr,pct=Math.round(d/total*100);
  const internDone=_p.internOk,isComplete=_p.remCr===0&&_p.internOk&&(s.gpa==null||parseFloat(s.gpa)>=2.0),pfill=pct<40?'lo':pct<70?'mid':'';
  const sems=semsByStudent(s),majorSems=sems.filter(x=>!x.endsWith('/3'));
  const exp=Math.min(majorSems.filter(x=>x<=NOW_SEM).length*18,total);
  const behind=exp-d,onTrack=behind<=12;
  // 到当下学期应修门数（每学期约6门，小学期约1门）
  const _semsPassed=sems.filter(x=>x<=NOW_SEM);
  const _expC=Math.min(_semsPassed.filter(x=>!x.endsWith('/3')).length*6+_semsPassed.filter(x=>x.endsWith('/3')).length*1,38);
  const _gapC=_expC-_p.doneC; // 应修 - 实修（差几门）
  const gpa=s.gpa,gpaCls=gpaClass(gpa),gpaLbl=gpaLabel(gpa);
  const hist=s.gpaHistory||[],lastG=hist.length>1?hist[hist.length-2]:null;
  const trend=gpa&&lastG?(gpa>lastG?'↑':gpa<lastG?'↓':'→'):'';
  const te=s.tep?.entry,tx=s.tep?.exit;
  const xFail=tx&&parseInt(tx.score||0)<TEP_PASS&&!(tx.retest&&parseInt(tx.retest||0)>=TEP_PASS);
  const bl=s.note==='jmei'?'b-j':s.note==='btec'?'b-b':'';
  const bt=s.note==='jmei'?'集美':s.note==='btec'?'BTEC':s.noteText||'';
  // ── 实习资格判断 ──
  const gpaNum=gpa?parseFloat(gpa):null;
  const gpaOk=gpaNum!=null&&gpaNum>=2.0;
  const coursesAllDone=_p.remC===0;
  const internEligible=coursesAllDone&&gpaOk; // 可申请实习
  const nearIntern=!internDone&&_gapC<=10&&_gapC>=0; // 到当下学期差 ≤ 10 门
  const alerts=[];
  if(isComplete){
    // 达标：不显示任何提示
  } else if(internDone){
    // 实习完成但 GPA 不足
    if(!gpaOk) alerts.push({t:'实习完成，但 GPA 未达 2.0',c:'risk'});
  } else if(internEligible){
    alerts.push({t:'✅ 可申请实习',c:'ok'});
  } else if(nearIntern&&gpaNum!=null&&!gpaOk){
    // 到当下学期差 ≤ 10 门且 GPA < 2.0 → 提醒
    alerts.push({t:`⚠ GPA ${gpaNum.toFixed(2)} 不足 2.0，请有效提升 GPA 以便申请实习课程`,c:'risk'});
  } else {
    if(!onTrack&&behind>0) alerts.push({t:`落后约${behind}学分`,c:'warn'}); else alerts.push({t:'进度正常',c:'ok'});
  }
  if(xFail) alerts.push({t:'TEP毕业未过',c:'warn'});
  // DPU-TEP score badge
  const tepBadge=s.dpuTepScore!=null?`<span class="bdg" style="background:#eff6ff;color:#1e40af">TEP ${s.dpuTepScore}</span>`:'';
  const _onclick=selectMode?`onclick="toggleSelect('${s.id}')"`:'';
  return `<div class="sc${selectMode?' selectable':''}${selectedIds.has(s.id)?' selected':''}${isComplete?' sc-complete':''}" id="card-${s.id}" ${_onclick}>
    <div class="sc-top" style="${currentView==='list'?'cursor:pointer;':''}" onclick="${currentView==='list'?`event.stopPropagation();jumpToCard('${s.id}')`:''}" title="${currentView==='list'?'点击查看卡片详情':''}">
      <div style="display:flex;flex-direction:column;gap:2px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
          <div style="font-size:13px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}${isComplete?' <span style="font-size:10px;color:var(--g6)">✓</span>':''}</div>
          <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">
${(()=>{const _cc=s.classCode||autoClassCode(s.cohort,s.type);const _pal=getClassColor(_cc);return `<span style="font-family:var(--mono);font-size:9px;background:${_pal.bg};color:${_pal.fg};border:0.5px solid ${_pal.bd};padding:1px 6px;border-radius:20px;font-weight:600">${_cc}</span>`;})()}
            <button class="ib" onclick="event.stopPropagation();openEditStudent('${s.id}')" title="编辑">✏️</button>
            <button class="ib" onclick="event.stopPropagation();deleteStudent('${s.id}')" title="删除">🗑</button>
          </div>
        </div>
        <div style="font-size:11px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.id}${s.cname?' · '+s.cname:''}</div>
        <div style="font-size:11px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.advisor||''}</div>
        <div class="sc-badges" style="margin-top:1px;display:flex;flex-wrap:wrap;gap:3px;">
          ${bt?`<span class="bdg ${bl}">${bt}</span>`:''}
          <span class="bdg ${s.type==='transfer'?'b-x':'b-n'}">${s.type==='transfer'?'专升本':'全日生'}</span>
          ${(()=>{const sd=s.statusDetail||{};if(sd.withdrawn){const wi=[sd.withdrawDate,sd.withdrawSem].filter(Boolean).join(' ');return `<span class="bdg" style="background:#f5f3ff;color:#7c3aed">退学${wi?' · '+wi:''}</span>`;}if(sd.leave&&sd.leave.length)return `<span class="bdg" style="background:#fef2f2;color:#b91c1c">休学 ${sd.leave.join(', ')}</span>`;if(isComplete)return `<span class="bdg" style="background:#854d0e;color:#fff">达标毕业</span>`;
              if(internDone&&!gpaOk)return `<span class="bdg" style="background:#fef2f2;color:#b91c1c">GPA 不足</span>`;return '<span class="bdg" style="background:#f0fdf4;color:#166534">在学</span>';})()}
          ${tepBadge}
        </div>
      </div>
    </div>
    <div class="sc-body">

      <div class="lv-status-pct">
        <div class="prog-w"><div class="prog-b"><div class="prog-f ${pfill}" style="width:${pct}%"></div></div><span class="prog-pct" style="font-size:10px;">${pct}%</span></div>

      </div>
      ${(()=>{
        const p=calcProgress(s,progCourses(s.prog||'TM'));
        return `<div class="stats">
          <div class="st"><div class="n">${p.doneCr}</div><div class="l">已修学分</div></div>
          <div class="st"><div class="n ${p.remCr>total*.5?'r':p.remCr>total*.3?'a':''}">${p.remCr}</div><div class="l">剩余学分</div></div>
          <div class="st"><div class="n">${p.doneC}<span style="font-size:9px;color:var(--ink3)">/38</span></div><div class="l">已修课数</div></div>
          <div class="st">${(()=>{
            if(!p.internOk) return '<div class="n r" style="font-size:11px">待实习</div><div class="l">实习</div>';
            const c=s.courses||{};
            const raw=c['KT411']||c['KT331']||c['KT332']||'';
            const sem=raw&&raw!=='Transferred'?raw:'';
            if(sem){
              return '<div class="n" style="font-size:13px">'+sem+'</div><div class="l">实习完成</div>';
            }
            return '<div class="n" style="font-size:16px">✓</div><div class="l">实习完成</div>';
          })()}</div>
        </div>`;
      })()}
      <div class="lv-tep-col list-only-tep">
        <div style="width:100%">
          <div style="font-size:9px;font-weight:600;color:var(--ink3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;">TEP 入 / 毕</div>
          <div style="font-family:var(--mono);font-size:11px;line-height:1.9">
            <div><span style="font-size:9px;color:var(--ink3)">入 </span><span style="${te?'color:var(--g7);font-weight:600':'color:var(--ink3)'}">${te?te.score:'—'}</span></div>
            <div><span style="font-size:9px;color:var(--ink3)">毕 </span><span style="${xFail?'color:var(--red);font-weight:600':tx?'color:var(--g7);font-weight:600':'color:var(--ink3)'}">${tx?tx.score:'—'}</span>
              ${tx?.retest?`<span style="font-size:9px;${parseInt(tx.retest)>=TEP_PASS?'color:var(--g7)':'color:var(--red)'}"> / 补${tx.retest}${parseInt(tx.retest)>=TEP_PASS?' ✓':' ✗'}</span>`:''}
              ${xFail&&!tx?.retest?`<span style="font-size:9px;color:var(--red)"> ⚠需补考</span>`:''}
            </div>
          </div>
        </div>
      </div>
      ${gpa!==undefined&&gpa!==null?`<div class="gpa-row">
        <div class="gpa-item"><div class="gpa-label">GPA ${trend}</div>
          <div class="gpa-val ${gpaCls}">${gpa}</div>
          ${s.gpaUpdated?`<div class="gpa-updated">${s.gpaUpdated}</div>`:''}
          <div style="font-size:9px;margin-top:2px;color:${gpa>=2?'var(--g7)':gpa>=1.5?'var(--amber)':'var(--red)'}">${gpaLabel(gpa)}</div>
        </div>
        <div class="gpa-item"><div class="gpa-label">GPA 历史</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--ink2);margin-top:3px;line-height:1.7">${hist.map(g=>`<span style="color:${g>=2?'var(--g7)':g>=1.5?'var(--amber)':'var(--red)'}">${g}</span>`).join('<br>')}</div>
        </div>
      </div>`:''}
      <div class="tep-row card-only-tep" style="gap:4px;">
        <div class="tep-item" onclick="openTep('${s.id}','entry')" style="display:flex;align-items:center;gap:6px;padding:3px 7px;">
          <div class="tep-label" style="white-space:nowrap;">TEP 入学</div>
          <div class="tep-val ${te?'pass':'none'}" style="font-size:11px;">${te?te.score:'—'}</div>
        </div>
        <div class="tep-item" onclick="openTep('${s.id}','exit')" style="display:flex;align-items:center;gap:6px;padding:3px 7px;">
          <div class="tep-label" style="white-space:nowrap;">TEP 毕业</div>
          <div class="tep-val ${xFail?'fail':tx?'pass':'none'}" style="font-size:11px;">${tx?(tx.score+(tx.retest?' /补'+tx.retest:'')):'—'}</div>
          ${xFail?'<span style="font-size:9px;color:var(--red);margin-left:2px">⚠</span>':(tx?.retest?'<span style="font-size:9px;color:var(--g7);margin-left:2px">✓补</span>':'')}
        </div>
      </div>
      <div class="counsel-box">
        <div class="counsel-toggle" onclick="toggleCounsel('${s.id}')">
          <span class="ct-label">辅导员老师记录 ${(s.counselorNotes||[]).length?`· <span style="color:var(--g6);font-weight:600">${(s.counselorNotes||[]).length}笔</span>`:''}</span>
          <span class="ct-icon" id="ci-${s.id}">+</span>
        </div>
        <div class="counsel-body" id="cb-${s.id}">
          ${(s.counselorNotes||[]).length?`<div style="display:flex;flex-direction:column;gap:5px;margin-top:6px">
            ${(s.counselorNotes||[]).map(n=>`<div style="border:1px solid var(--line);border-radius:6px;padding:6px 9px;background:var(--paper)">
              <div style="font-family:var(--mono);font-size:10px;font-weight:600;color:var(--g8);margin-bottom:3px">${n.date||''}</div>
              ${n.content?`<div style="font-size:11px;color:var(--ink2)">${n.content}</div>`:''}
              ${n.dirNote?`<div style="font-size:11px;color:var(--sky);margin-top:3px;padding-top:3px;border-top:1px solid var(--line)"><span style="font-size:10px;color:var(--ink3)">主任：</span>${n.dirNote}</div>`:''}
            </div>`).join('')}</div>`:
          `<div style="font-size:11px;color:var(--ink3);padding:6px 0">暂无辅导员老师记录</div>`}
        </div>
      </div>
      <div class="achips">${alerts.map(a=>`<span class="ac ${a.c}">${a.t}</span>`).join('')}</div>

    </div>

  </div>`;
}

function toggleCounsel(sid) {
  const body=document.getElementById('cb-'+sid),icon=document.getElementById('ci-'+sid);
  if(!body) return;
  const o=body.classList.toggle('open');
  if(icon){icon.classList.toggle('open',o);icon.textContent=o?'×':'+';}
}

// ── Schedule planning ──────────────────────────────────

let batchMode={};

// ── 全局学期颜色映射（固定，不随数据变化）──
const _SEM_PALETTE=[
  {bg:'#e8f0fe',tx:'#1a56db'},  // 蓝
  {bg:'#e6f4ea',tx:'#137333'},  // 绿
  {bg:'#fef7e0',tx:'#b45309'},  // 黄
  {bg:'#fde8f0',tx:'#9d174d'},  // 粉
  {bg:'#ede7f6',tx:'#5b21b6'},  // 紫
  {bg:'#fdeede',tx:'#9a3412'},  // 橙
  {bg:'#e1f5fe',tx:'#0277bd'},  // 天蓝
  {bg:'#e8f5e9',tx:'#2e7d32'},  // 深绿
  {bg:'#f3e8fd',tx:'#7e22ce'},  // 淡紫
  {bg:'#fff8e1',tx:'#e65100'},  // 琥珀
  {bg:'#e8fdf2',tx:'#065f46'},  // 薄荷
  {bg:'#e8f4fd',tx:'#01579b'},  // 冰蓝
];
const _GLOBAL_SEM_MAP=(()=>{
  const map={};
  // 枚举 2564~2575 年的所有学期，顺序固定
  let idx=0;
  for(let yr=2564;yr<=2575;yr++){
    for(let sem=1;sem<=3;sem++){
      map[`${yr}/${sem}`]=_SEM_PALETTE[idx%_SEM_PALETTE.length];
      idx++;
    }
  }
  return map;
})();
function globalSemStyle(v){
  if(!v||v==='·') return '';
  if(v==='✓') return 'background:#d1fae5;color:#065f46';
  if(v==='Transferred') return 'background:#dbeafe;color:#1e40af;font-size:7.5px;letter-spacing:-.4px;font-weight:600';
  const c=_GLOBAL_SEM_MAP[v];
  return c?`background:${c.bg};color:${c.tx}`:'';
}
  // {cohort: {active:bool, sem:'2568/3', selections:{code:bool}}}
function getBatch(co){if(!batchMode[co])batchMode[co]={active:false,mode:'add',sem:NOW_SEM,selections:{}};return batchMode[co];}
function toggleBatchMode(co,mode='add'){
  const b=getBatch(co);
  if(b.active&&b.mode===mode){b.active=false;b.selections={};}
  else{b.active=true;b.mode=mode;b.selections={};}
  _renderOverviewKeepScroll();
}
function _renderOverviewKeepScroll(){
  const shell=document.getElementById('main-shell');
  const shellY=shell?.scrollTop||0;
  const wrapScrolls=[...document.querySelectorAll('.tbl-wrap')].map(w=>({x:w.scrollLeft,y:w.scrollTop}));
  renderOverview();
  // 用 requestAnimationFrame 等 DOM 更新完再恢复位置
  requestAnimationFrame(()=>{
    if(shell) shell.scrollTop=shellY;
    [...document.querySelectorAll('.tbl-wrap')].forEach((w,i)=>{
      if(wrapScrolls[i]){w.scrollLeft=wrapScrolls[i].x;w.scrollTop=wrapScrolls[i].y;}
    });
  });
}
function setBatchSem(co,sem){getBatch(co).sem=sem;_renderOverviewKeepScroll();}
function toggleBatchCourse(co,code){
  const b=getBatch(co);
  b.selections[code]=!b.selections[code];
  _renderOverviewKeepScroll();
}
async function saveBatch(co){
  const b=getBatch(co);
  if(!b.sem){alert('请选择学期');return;}
  const codes=Object.keys(b.selections).filter(k=>b.selections[k]);
  if(!codes.length){alert('请勾选要排入的课程');return;}
  const studsInCo=DB.students.filter(s=>(s.prog||'TM')===activeProg&&s.cohort===co);
  let count=0;const toSync=[];
  studsInCo.forEach(s=>{
    if(!s.courses)s.courses={};
    let changed=false;
    codes.forEach(code=>{
      if(!s.courses[code]){s.courses[code]=b.sem;count++;changed=true;}
    });
    if(changed)toSync.push(s);
  });
  if(!count){alert('所选课程该届学生均已排课');return;}
  b.active=false;b.selections={};
  render();
  gpShow(`同步排课中...`);
  try{
    await apiSaveBatch(toSync);
    gpDone(`✓ 已批次排入 ${count} 笔 → ${b.sem}`);
  }catch(e){gpHide();alert('同步失败：'+e.message);}
}

async function deleteBatch(co){
  const b=getBatch(co);
  const codes=Object.keys(b.selections).filter(k=>b.selections[k]);
  if(!codes.length){alert('请勾选要删除的课程');return;}
  if(!confirm(`确认批次删除 ${co}届 · ${codes.length}门课的排课记录？\n此操作不可还原`)) return;
  const studsInCo=DB.students.filter(s=>(s.prog||'TM')===activeProg&&s.cohort===co);
  let count=0;const toSync=[];
  studsInCo.forEach(s=>{
    if(!s.courses)return;
    let changed=false;
    codes.forEach(code=>{
      if(s.courses[code]===b.sem){delete s.courses[code];count++;changed=true;}
    });
    if(changed)toSync.push(s);
  });
  if(!count){alert('所选课程该届学生均无排课记录');return;}
  b.active=false;b.selections={};
  render();
  gpShow(`同步删除中...`);
  try{
    await apiSaveBatch(toSync);
    gpDone(`✓ 已批次删除 ${count} 笔排课记录`);
  }catch(e){gpHide();alert('同步失败：'+e.message);}
}

// ── Blocks ─────────────────────────────────────────────
function renderOverview() {
  const page = document.getElementById('overview-page');
  if(!page) return;

  // 用届别筛选（不再用班级代码）
  const selCo = window._ovCohort||'';
  let allStuds = DB.students.filter(s=>(s.prog||'TM')===activeProg);
  let studs = selCo ? allStuds.filter(s=>s.cohort===selCo) : allStuds;

  // 取得所有届别选项（有学生的届 + 预建班级的届）
  const _prog=getProg(activeProg);
  const _preCohortNums=[...new Set((_prog?.preCohorts||[]).map(cc=>cc.replace(/[^0-9]/g,'').substring(0,2)))].filter(Boolean);
  const cohorts=[...new Set([...allStuds.map(s=>s.cohort),..._preCohortNums])].sort();

  let h = `<div style="position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:8px;padding:5px 16px;border-bottom:1px solid var(--line);background:var(--paper);min-height:36px;">
    <span style="font-size:11px;color:var(--ink3);font-family:var(--mono);">排课总览 · 按学号排序</span>
    <span style="width:1px;height:14px;background:var(--line2);margin:0 4px;flex-shrink:0;"></span>
    <select onchange="window._ovCohort=this.value;_renderOverviewKeepScroll();"
      style="padding:2px 7px;border:1px solid var(--line2);border-radius:5px;background:var(--card);color:var(--ink);font-family:var(--mono);font-size:11px;cursor:pointer;height:24px;">
      <option value="">学生届别</option>
      ${cohorts.map(c=>`<option value="${c}" ${c===selCo?'selected':''}>${c}届</option>`).join('')}
    </select>
    <span style="font-size:11px;color:var(--ink3);font-family:var(--mono);">${studs.length} 位学生</span>
    <div style="flex:1;"></div>
  </div>`;

  // 按届别分组（全新生+专升本合并），每届一张大表，学生按学号排序
  const groups = {};
  studs.forEach(s => {
    const co = s.cohort;
    if(!groups[co]) groups[co] = [];
    groups[co].push(s);
  });
  // 加入预建班级的届别（没有学生时也显示空框架）
  _preCohortNums.forEach(co=>{
    if(!groups[co]) groups[co]=[];
  });
  const keys = Object.keys(groups).sort();
  if(!keys.length) {
    h += '<div style="padding:40px;text-align:center;color:var(--ink3)">尚无学生</div>';
  } else {
    h += '<div>';
    h += keys.map(co => blockHTML(co, groups[co])).join('');
    h += '</div>';
  }
  page.innerHTML = h;
}

function renderBlocks() {
  const area=document.getElementById('blocks');
  const cc=document.getElementById('bar-classcode')?.value||'';
  let studs=DB.students.filter(s=>(s.prog||'TM')===activeProg);
  if(cc) studs=studs.filter(s=>(s.classCode||autoClassCode(s.cohort,s.type))===cc);
  // 按届别+类型分组，每个班级一个大表
  const groups={};
  studs.forEach(s=>{
    const key=s.classCode||autoClassCode(s.cohort,s.type);
    if(!groups[key]) groups[key]={cohort:s.cohort,classCode:key,studs:[]};
    groups[key].studs.push(s);
  });
  // ── 加入预建班级（没有学生的班级也显示）──
  const _prog=getProg(activeProg);
  (_prog?.preCohorts||[]).forEach(classCode=>{
    if(cc&&classCode!==cc) return; // 筛选班级时过滤
    if(!groups[classCode]){
      const cohort=classCode.replace(/[^0-9]/g,'').substring(0,2);
      groups[classCode]={cohort,classCode,studs:[],prebuilt:true};
    }
  });
  // 按班级代码排序
  const keys=Object.keys(groups).sort();
  area.innerHTML=keys.map(k=>blockHTML(groups[k].cohort,groups[k].studs,groups[k].classCode,groups[k].prebuilt)).join('');
}

function normSem(v){if(!v)return '';if(/^\d\/25\d\d$/.test(v)){const m=v.match(/^(\d)\/(25\d\d)$/);if(m)return m[2]+'/'+m[1];}return v;}

function blockHTML(co, _studs, _classCode, _prebuilt) {
  // 预建班级但无学生：显示空大表框架
  if(_prebuilt&&(!_studs||_studs.length===0)){
    const pid=activeProg;
    const courses=progCourses(pid);
    const displayCode=_classCode||co;
    return `<div class="cb" style="margin-bottom:24px">
      <div class="cb-h" style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px 10px 0 0">
        <span style="font-size:13px;font-weight:700;color:var(--h-text)">${displayCode}届</span>
        <span style="font-size:11px;color:var(--g4)">预建班级 · 暂无学生 · ${courses.filter(c=>c.g!=='实习课程').length}门课 + 实习待排</span>
        <div style="flex:1"></div>
        <button onclick="toggleBatchMode('${co}','add')" style="padding:3px 10px;border:1px solid var(--g5);border-radius:4px;background:transparent;color:var(--g3);font-size:11px;cursor:pointer;">🗓 批次排课</button>
      </div>
      <div style="padding:20px;text-align:center;color:var(--ink3);font-size:12px;background:#fff;border:1px solid var(--line);border-top:none;border-radius:0 0 10px 10px">
        📭 尚无学生，排课后新生入学自动对应
      </div>
    </div>`;
  }
  const GE_CODE_MAP={'KG131':'终身学习-必修','KG132':'终身学习-选修','KG133':'终身学习-选修','KG134':'终身学习-选修','KG135':'终身学习-选修','KG145':'价值论理-必修','KG146':'价值论理-选修','KG147':'价值论理-选修','KG148':'价值论理-选修','KG151':'生活质量-必修','KG154':'生活质量-选修','KG156':'生活质量-选修','KG157':'生活质量-选修','KG155':'语言与跨文化','LA130':'语言与跨文化','LA131':'语言与跨文化','LA132':'语言与跨文化'};
  const studs=(_studs&&_studs.length)?[..._studs].sort((a,b)=>a.id.localeCompare(b.id)):cohortStudents(co);
  // 预建班级：无学生时检查是否有预建班级
  if(!studs.length){
    const _prog2=getProg(activeProg);
    const _preCodes2=(_prog2?.preCohorts||[]).filter(cc=>cc.replace(/[^0-9]/g,'').substring(0,2)===co);
    if(!_preCodes2.length) return '';
    // 有预建班级：继续往下渲染完整大表（studs为空，只显示课程架构，无学生列）
    // 不 return，继续执行
  }
  const pid=activeProg,prog=getProg(pid),total=prog.totalCr||123,totalC=(prog.courses||[]).length;
  const baseYear=parseInt(co)+2500;
  const allProgCourses=progCourses(pid).length?progCourses(pid):(prog.courses||getBuiltinTMCourses());
  // 非TM专业：用动态大表
  const _isTMProg=pid==='TourismManagement'||pid==='TM';
  if(!_isTMProg) return blockHTMLDynamic(co,studs,pid,prog,allProgCourses,total);
  const KG_GROUPS=[['KG132','KG133','KG134','KG135'],['KG146','KG147','KG148'],['KG154','KG156','KG157']];
  const LANG_EN=['KE311','KE316','KE325','KE327','KE333'];
  const LANG_TH=['KH351','KH352','KH353','KH354','KH355'];
  function internshipOk(c){return !!(c['KT411']||(c['KT331']&&c['KT332']));}
  function extraKG(c){let ex=[];KG_GROUPS.forEach(g=>{const d=g.filter(k=>c[k]);if(d.length>1)ex=ex.concat(d.slice(1));});return ex;}
  function langStatus(c){const en=LANG_EN.filter(k=>c[k]).length,th=LANG_TH.filter(k=>c[k]).length;return{en,th,mixed:en>0&&th>0,ok:(en>=5||th>=5)&&!(en>0&&th>0)};}
  const yearColors={'2566':'#d1fae5','2567':'#dbeafe','2568':'#fef3c7','2569':'#ede9fe','2570':'#fce7f3'};
  const yearText={'2566':'#065f46','2567':'#1e40af','2568':'#92400e','2569':'#5b21b6','2570':'#9d174d'};
  // 学期调色板：每个完整学期（如 2566/1）固定一个色对
  // 使用全局固定学期颜色映射
  function semStyle(v){ return globalSemStyle(v); }
  function normSem(v){
    if(!v) return '';
    if(/^\d\/25\d\d$/.test(v)){const m=v.match(/^(\d)\/(25\d\d)$/);if(m)return m[2]+'/'+m[1];}
    return v;
  }
  function semData(s){
    const cnt={},cr={};
    const SKIP2=new Set(['实习课程','旅游专业·选修','自由选修']);
    const INTERN2=new Set(['KT411','KT331','KT332']);
    const geSelSeen2={};
    let langSel2=0;
    allProgCourses.forEach(c=>{
      if(INTERN2.has(c.c)||SKIP2.has(c.g)) return;
      // GE选修每组只算1门
      if(['终身学习-选修','价值论理-选修','生活质量-选修'].includes(c.g)){
        if(geSelSeen2[c.g]) return;
        if((s.courses||{})[c.c]) geSelSeen2[c.g]=true; else return;
      }
      // 语言修选最多5门
      if(c.g==='语言修选'){
        if(langSel2>=5) return;
        if((s.courses||{})[c.c]) langSel2++;
      }
      let v=normSem((s.courses||{})[c.c]);
      if(v&&v!=='✓'&&v!=='Transferred'&&/^25\d\d\/\d$/.test(v)){cnt[v]=(cnt[v]||0)+1;cr[v]=(cr[v]||0)+c.cr;}
    });
    // ext2（外系选修2，计入38课）
    const ext2v=normSem(((s.courses||{})["ext2"]||'').split('|')[1]||((s.courses||{})['ext2']||''));
    if(ext2v&&/^25\d\d\/\d$/.test(ext2v)){cnt[ext2v]=(cnt[ext2v]||0)+1;cr[ext2v]=(cr[ext2v]||0)+3;}
    // 实习课程（KT411 或 KT331+KT332）计入每学期课数
    ['KT411','KT331','KT332'].forEach(code=>{
      const v=normSem((s.courses||{})[code]);
      if(v&&v!=='✓'&&v!=='Transferred'&&/^25\d\d\/\d$/.test(v)){
        cnt[v]=(cnt[v]||0)+1;
        cr[v]=(cr[v]||0)+(code==='KT411'?6:3);
      }
    });
    return{cnt,cr};
  }
  // 每学期课数：全新生4学年，专升本3学年（各+1延修年）
  const maxYears=studs.some(s=>s.type!=='transfer')?4:3;
  const years=Array.from({length:maxYears},(_,i)=>baseYear+i);
  const yearBg=['#f0f7f2','#eff6ff','#fffbeb','#fdf4ff'],yearBd=['#9dc9b0','#93c5fd','#fcd34d','#e9d5ff'];

  // 收集本届所有班级代码（去重排序）
  const cohortCodes=[...new Set(studs.map(s=>s.classCode||autoClassCode(s.cohort,s.type)))].sort().join(' · ');
  const _b=getBatch(co);
  const _semOpts=(()=>{const s=new Set();DB.students.forEach(x=>{Object.values(x.courses||{}).forEach(v=>{if(v&&/^25\d\d\/[123]$/.test(v))s.add(v);});});s.add(NOW_SEM);return[...s].sort((a,b)=>{const[ya,sa]=a.split('/');const[yb,sb]=b.split('/');return ya!==yb?parseInt(ya)-parseInt(yb):parseInt(sa)-parseInt(sb);});})();
  let h=`<div class="cb"><div class="cb-h" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <div style="flex:1;min-width:0;">
      <span class="cb-title">${co}届</span>
      <span class="cb-info" style="margin-left:6px">${cohortCodes}</span>
      <span class="cb-info">· ${studs.length}位学生 · ${prog.name}</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
      ${_b.active?`
        <select onchange="setBatchSem('${co}',this.value)" style="padding:2px 6px;border:1px solid rgba(255,255,255,.3);border-radius:4px;background:${_b.mode==='del'?'rgba(220,38,38,.2)':'rgba(255,255,255,.12)'};color:#fff;font-family:var(--mono);font-size:11px;height:24px;">${_semOpts.map(s=>`<option value="${s}" ${s===_b.sem?'selected':''}>${s}</option>`).join('')}</select>
        ${_b.mode==='del'?`<span style="font-size:10px;color:#fca5a5;">仅删除此学期的记录</span>`:''}
        <span style="font-size:10px;color:${_b.mode==='del'?'#fca5a5':'var(--g4)'};">${Object.values(_b.selections).filter(Boolean).length}门已选</span>
        ${_b.mode==='add'?
          `<button onclick="saveBatch('${co}')" style="padding:3px 10px;border-radius:4px;border:none;background:#3ecf72;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">✓ 储存排课</button>`:
          `<button onclick="deleteBatch('${co}')" style="padding:3px 10px;border-radius:4px;border:none;background:#dc2626;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">🗑 确认删除</button>`
        }
        <button onclick="toggleBatchMode('${co}','${_b.mode}')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(255,255,255,.3);background:transparent;color:var(--g4);font-size:11px;cursor:pointer;">✕ 取消</button>
      `:`
        <button onclick="toggleBatchMode('${co}','add')" style="padding:3px 10px;border:1px solid var(--g5);border-radius:4px;background:transparent;color:var(--g3);font-size:11px;cursor:pointer;transition:all .12s;" onmouseover="this.style.background='rgba(255,255,255,.1)'" onmouseout="this.style.background='transparent'">🗓 批次排课</button>
        <button onclick="toggleBatchMode('${co}','del')" style="padding:3px 10px;border:1px solid rgba(220,38,38,.5);border-radius:4px;background:transparent;color:#fca5a5;font-size:11px;cursor:pointer;transition:all .12s;" onmouseover="this.style.background='rgba(220,38,38,.15)'" onmouseout="this.style.background='transparent'">🗑 批次删除</button>
        <button style="font-size:11px;padding:3px 8px;border:1px solid var(--g6);border-radius:4px;background:transparent;color:var(--g3);cursor:pointer" onclick="printBlock()">🖨 打印</button>
      `}
    </div>
  </div><div class="tbl-wrap"><table>
  <thead><tr>
    <th class="cc sticky-col sc1" style="background:var(--g8);color:#fff;font-size:10px">#</th>
    <th class="cc sticky-col sc2" style="background:var(--g8);color:#fff">代码</th>
    <th class="ccr sticky-col sc3" style="background:var(--g8);color:#fff">学分</th>
    <th class="cn sticky-col sc4" style="background:var(--g8);color:#fff">课程名称</th>`;
  studs.forEach(s=>{
    const _bp=calcProgress(s,allProgCourses);
    const isCom=_bp.remC===0&&_bp.internOk;  // 38课修完 + 实习完成
    const clsCode=s.classCode||autoClassCode(s.cohort,s.type);
    const isTransfer=s.type==='transfer';
    const codeColor=isCom?'#fde68a':isTransfer?'#fbbf24':'#7dd3fc';
    h+=`<th class="cs th-s" style="${isCom?'background:#854d0e':''}">
      <span class="sn" style="${isCom?'color:#fff;font-weight:700':''}">${isCom?'🎓 ':''}${shortName(s.name)}</span>
      <span class="si2" style="${isCom?'color:rgba(255,255,255,.7)':''}">${s.id}</span>
      <span style="font-size:8px;display:block;color:${codeColor};letter-spacing:.3px;font-family:var(--mono);font-weight:600">${clsCode}</span>
    </th>`;
  });
  h+=`</tr></thead><tbody>`;

  const sections=[];
  sections.push({label:'通识课程',cr:18,hdrBg:'#d97706',hdrText:'#fff',color:'#fff',accent:'#f59e0b',isGeSuperHeader:true,courses:[]});
  [{g:'终身学习-必修',label:'终身学习·必修',hdrBg:'var(--g8)',hdrText:'#fff',color:'#fff',accent:'#f59e0b',pick1:false},
   {g:'终身学习-选修',label:'终身学习·选修',hdrBg:'var(--g8)',hdrText:'#fff',color:'#fff',accent:'#fbbf24',pick1:true},
   {g:'价值论理-必修',label:'价值论理·必修',hdrBg:'var(--g8)',hdrText:'#fff',color:'#fff',accent:'#f472b6',pick1:false},
   {g:'价值论理-选修',label:'价值论理·选修',hdrBg:'var(--g8)',hdrText:'#fff',color:'#fff',accent:'#ec4899',pick1:true},
   {g:'生活质量-必修',label:'生活质量·必修',hdrBg:'var(--g8)',hdrText:'#fff',color:'#fff',accent:'#60a5fa',pick1:false},
   {g:'生活质量-选修',label:'生活质量·选修',hdrBg:'var(--g8)',hdrText:'#fff',color:'#fff',accent:'#3b82f6',pick1:true},
  ].forEach(sub=>{
    let cs=allProgCourses.filter(c=>c.g===sub.g||(GE_CODE_MAP||{})[c.c]===sub.g);
    if(sub.pick1){
      // 每个学生已选的那门，或列出所有供选择
      // 表格里显示全部课程，但标注「选1门」
    }
    if(cs.length) sections.push({...sub,cr:3,note:sub.pick1?'选1门':undefined,courses:cs});
  });
  const langXC=allProgCourses.filter(c=>c.g==='语言与跨文化');
  if(langXC.length) sections.push({label:'语言与跨文化',cr:12,color:'#fff',hdrBg:'var(--g8)',hdrText:'#fff',accent:'#fb923c',courses:langXC});
  const core=allProgCourses.filter(c=>c.g==='基础专业课');
  if(core.length) sections.push({label:'基础专业课',cr:24,color:'#fff',hdrBg:'var(--g8)',hdrText:'#fff',accent:'#38bdf8',courses:core});
  const majReq=allProgCourses.filter(c=>c.g==='旅游专业·必修');
  if(majReq.length) sections.push({label:'旅游专业·必修',cr:36,color:'#fff',hdrBg:'var(--g8)',hdrText:'#fff',accent:'#34d399',courses:majReq});
  const cap=allProgCourses.filter(c=>c.g==='Capstone');
  if(cap.length) sections.push({label:'Capstone',cr:6,color:'#fff',hdrBg:'var(--g8)',hdrText:'#fff',accent:'#10b981',courses:cap});

  const intern=allProgCourses.filter(c=>c.g==='实习课程');
  if(intern.length) sections.push({label:'实习课程',cr:6,color:'#fff',hdrBg:'var(--g8)',hdrText:'#fff',accent:'#059669',note:'KT411(6学分) 或 KT331+KT332(3+3学分)',courses:intern});
  const langAll=allProgCourses.filter(c=>c.g==='语言修选');
  const langEN=langAll.filter(c=>LANG_EN.includes(c.c));
  const langTH=langAll.filter(c=>LANG_TH.includes(c.c));
  if(langAll.length) sections.push({label:'语言修选',cr:15,color:'#fff',hdrBg:'var(--g8)',hdrText:'#fff',accent:'#a78bfa',note:'全英文(KE) 或 全泰文(KH)',courses:langAll,langEN,langTH,isLangSec:true});

  sections.forEach(sec=>{
    if(sec.isGeSuperHeader){h+=`<tr><td class="cc sticky-col sc1" style="background:var(--g8)"></td><td class="cc sticky-col sc2" style="background:var(--g8)"></td><td class="ccr sticky-col sc3" style="background:var(--g8)"></td><td class="sticky-col sc4" colspan="${studs.length+1}" style="background:var(--g8);padding:5px 10px;"><span style="font-weight:600;font-size:11px;color:rgba(255,255,255,.5);letter-spacing:.8px;text-transform:uppercase">▸ 通识课程 GE</span></td></tr>`;return;}
    h+=`<tr>
      <td class="cc sticky-col sc1" style="background:var(--g8)"></td>
      <td class="cc sticky-col sc2" style="background:var(--g8)"></td>
      <td class="ccr sticky-col sc3" style="background:var(--g8)"></td>
      <td class="sticky-col sc4" style="background:var(--g8);padding:5px 10px;box-shadow:none">
        <span style="font-weight:600;font-size:11px;color:#fff;letter-spacing:.4px;text-transform:uppercase">${sec.label}</span>
        ${sec.note?`<span style="font-weight:400;font-size:10px;color:rgba(255,255,255,.55);margin-left:8px">· ${sec.note}</span>`:''}
      </td>
      ${studs.map(()=>`<td style="background:var(--g8)"></td>`).join('')}
    </tr>`;

    if(sec.isLangSec){
      const getTrack=s=>{const c=s.courses||{};const en=LANG_EN.filter(k=>c[k]).length,th=LANG_TH.filter(k=>c[k]).length;return en>0&&th>0?'MIX':en>0?'EN':th>0?'TH':'—';};
      ['EN','TH'].forEach(track=>{
        const courses=track==='EN'?sec.langEN:sec.langTH;
        h+=`<tr style="background:#f8f9fa">
          <td class="cc" style="background:#f8f9fa;font-size:9px;color:#6b7280;font-weight:600">${track}</td>
          <td class="cc" style="background:#f5f3ff"></td>
          <td class="ccr" style="background:#f5f3ff;font-size:9px;color:#7c3aed">15cr</td>
          <td class="cn" style="background:#f5f3ff;font-size:11px;color:#7c3aed;font-weight:500">${track==='EN'?'英文语种':'泰文语种'}</td>
          ${studs.map(s=>{const tr=getTrack(s);return`<td style="background:#f5f3ff;font-size:10px;text-align:center;color:${tr===track?'#7c3aed':tr==='MIX'?'#dc2626':'var(--ink3)'}">${tr===track?'✓选':tr==='MIX'?'⚠混':''}</td>`;}).join('')}
        </tr>`;
        courses.forEach((course,ci)=>{
          const _bLangActive=_b.active&&_b.selections[course.c];
          const _isDel3=_b.mode==='del';
          const _nameBgL=_bLangActive?(_isDel3?'#fef2f2':'#f0fdf4'):'#fafafa';
          const _chkColorL=_isDel3?'#dc2626':'var(--g6)';
          h+=`<tr style="background:${_nameBgL}">
            <td class="cc sticky-col sc1" style="background:#fdf4ff;font-size:9px;color:var(--ink3);text-align:center">${ci+1}</td>
            <td class="cc sticky-col sc2" style="background:#fdf4ff;font-family:var(--mono);font-size:10px;font-weight:500;color:#9333ea">${course.c}</td>
            <td class="ccr sticky-col sc3" style="background:${_nameBgL}">${course.cr}</td>
            <td class="cn sticky-col sc4" style="background:${_nameBgL};cursor:${_b.active?'pointer':'default'}" onclick="${_b.active?`toggleBatchCourse('${co}','${course.c}')`:''}">${_b.active?`<span style="display:inline-block;width:13px;height:13px;border-radius:3px;border:1.5px solid ${_bLangActive?_chkColorL:'var(--line2)'};background:${_bLangActive?_chkColorL:'transparent'};color:#fff;font-size:10px;line-height:12px;text-align:center;margin-right:5px;vertical-align:middle;">${_bLangActive?(_isDel3?'✕':'✓'):''}</span>`:''}${course.n}</td>`;
          studs.forEach(s=>{
            const v=normSem((s.courses||{})[course.c]||'');
            const ls=langStatus(s.courses||{});
            let sty=semStyle(v);
            if(ls.mixed&&v) sty='background:#fee2e2;color:#991b1b';
            const _isEmpty=!v;
            const _canAct=_b.active&&(_isDel3?(!_isEmpty&&v===_b.sem):_isEmpty);
            const _bLangSel=_b.active&&_b.selections[course.c];
            const _bRowSty=_canAct?(_bLangSel?(_isDel3?'background:#991b1b;color:#fff;cursor:pointer;':'background:#166534;color:#fff;cursor:pointer;'):'cursor:pointer;'):'';
            const _bClick=_canAct?`toggleBatchCourse('${co}','${course.c}')`:`openCell('${s.id}','${course.c}','${pid}')`;
            h+=`<td class="dc ${v?'vd':'vn'}" style="${_canAct?_bRowSty:sty}" onclick="${_bClick}">${_bLangSel&&_canAct?(_isDel3?'✕':'✓'):(v==='Transferred'?'Transferred':v||'·')}</td>`;
          });
          h+='</tr>';
        });
      });
      return;
    }

    sec.courses.forEach((course,ci)=>{
      const isKT411=course.c==='KT411',isKT331=course.c==='KT331',isKT332=course.c==='KT332';
      const note2=isKT411?' <span style="font-size:9px;color:var(--ink3)">(或KT331+KT332)</span>':(isKT331||isKT332)?' <span style="font-size:9px;color:var(--ink3)">(替代实习)</span>':'';
      const _rowBg=ci%2===0?'#fff':'#f9fafb';
      const _bRowActive=_b.active&&_b.selections[course.c];
      const _isDel2=_b.mode==='del';
      const _nameBg=_bRowActive?(_isDel2?'#fef2f2':'#f0fdf4'):_rowBg;
      const _chkColor=_isDel2?'#dc2626':'var(--g6)';
      h+=`<tr style="background:${_nameBg}">
        <td class="cc sticky-col sc1" style="background:${_nameBg};font-size:9px;color:#9ca3af;text-align:center">${ci+1}</td>
        <td class="cc sticky-col sc2" style="background:${_nameBg};font-family:var(--mono);font-size:10px;font-weight:600;color:var(--g7)">${course.c}</td>
        <td class="ccr sticky-col sc3" style="background:${_nameBg};font-size:11px;color:#6b7280;text-align:center">${course.cr}</td>
        <td class="cn sticky-col sc4" style="background:${_nameBg};box-shadow:none;color:#111827;font-size:12px;cursor:${_b.active?'pointer':'default'}" onclick="${_b.active?`toggleBatchCourse('${co}','${course.c}')`:''}">${_b.active?`<span style="display:inline-block;width:13px;height:13px;border-radius:3px;border:1.5px solid ${_bRowActive?_chkColor:'var(--line2)'};background:${_bRowActive?_chkColor:'transparent'};color:#fff;font-size:10px;line-height:12px;text-align:center;margin-right:5px;vertical-align:middle;">${_bRowActive?(_isDel2?'✕':'✓'):''}</span>`:''}${course.n}${note2}</td>`;
      studs.forEach(s=>{
        const c=s.courses||{},raw=c[course.c]||'',v=normSem(raw);
        const ex=new Set(extraKG(c)),isEx=ex.has(course.c);
        const ls=langStatus(c),isLangMix=ls.mixed&&(LANG_EN.includes(course.c)||LANG_TH.includes(course.c));
        const internSat=isKT411&&!v&&internshipOk(c);
        let sty=semStyle(v);
        if(isLangMix&&v) sty='background:#fee2e2;color:#991b1b';
        else if(isEx&&v) sty='background:#fef9c3;color:#92400e';
        else if(internSat) sty='background:#eff6ff;color:#1e40af';
        const disp=v==='Transferred'?'Transferred':v==='✓'?'✓':v||'·';
        const _bSel=_b.active&&_b.selections[course.c];
        const _isDel=_b.mode==='del';
        // 排课模式：只影响空格子；删除模式：只影响有值格子
        const _isEmpty=!v;
        const _canAct=_b.active&&(_isDel?(!_isEmpty&&v===_b.sem):_isEmpty);
        const _bRowSty=_canAct?(_bSel?(_isDel?'background:#991b1b;color:#fff;cursor:pointer;':'background:#166534;color:#fff;cursor:pointer;'):'cursor:pointer;'):'';
        const _bClick=_canAct?`toggleBatchCourse('${co}','${course.c}')`:`openCell('${s.id}','${course.c}','${pid}')`;
        const _bTitle=_canAct?(_bSel?'已选 → 点击取消':(_isDel?'点击批次删除':'点击批次排入')):(v||'未修');
        h+=`<td class="dc ${v?'vd':'vn'}" style="${_canAct?_bRowSty:sty}" onclick="${_bClick}" title="${_bTitle}${isEx?' ★外系':''}">${_bSel&&_canAct?(_isDel?'✕':'✓'):disp}</td>`;
      });
      h+='</tr>';
    });
  });

  // 外系选修
  const EXT_BG='#f5f5f4',EXT_HDR='#44403c';
  h+=`<tr>
    <td class="cc sticky-col sc1" style="background:${EXT_BG}"></td>
    <td class="cc sticky-col sc2" style="background:${EXT_BG}"></td>
    <td class="ccr sticky-col sc3" style="background:${EXT_BG}"></td>
    <td class="sticky-col sc4" style="background:${EXT_BG};padding:5px 10px;font-weight:700;font-size:12px;color:${EXT_HDR}">外系选修</td>
    ${studs.map(()=>`<td style="background:${EXT_BG}"></td>`).join('')}
  </tr>`;

  // ext1 = KH160 固定；ext2/ext3 自定义
  const EXT_DEF=[
    {n:1,slot:'KH160',code:'KH160',label:'Communication Skills in Thai for Non-Native Speakers',fixed:true},
    {n:2,slot:'ext2',code:'',label:'外系选修 2',fixed:false},
  ];
  EXT_DEF.forEach(def=>{
    const slot=def.slot;
    h+=`<tr style="background:${EXT_BG}">
      <td class="cc sticky-col sc1" style="background:${EXT_BG};font-size:9px;color:#9ca3af;text-align:center">${def.n}</td>
      <td class="cc sticky-col sc2" style="background:${EXT_BG};font-size:10px;font-weight:600;color:#78716c;text-align:center">${def.fixed?def.code:'各异'}</td>
      <td class="ccr sticky-col sc3" style="background:${EXT_BG};font-size:11px;color:#6b7280;text-align:center">3</td>
      <td class="cn sticky-col sc4" style="background:${EXT_BG};font-size:11px;color:#57534e">${def.label}</td>`;
    studs.forEach(s=>{
      const val=(s.courses||{})[slot]||'';
      const isT=val==='Transferred';
      let v='',dispCode='';
      if(def.fixed){
        v=normSem(val);
      } else {
        const parts=val.split('|');
        if(parts.length>1){
          dispCode=parts[0]; // 课程代码
          v=normSem(parts[1]); // 学期
        } else if(parts[0]&&/^25\d\d\/\d$/.test(normSem(parts[0]))){
          v=normSem(parts[0]);
        } else v='';
      }
      const sty=isT?'background:#dbeafe;color:#1e40af;font-size:7.5px;font-weight:600':semStyle(v);
      const cellStyle=sty||(v?'background:var(--g1)':'');
      const cellCls='dc '+(v||isT?'vd':'vn');
      // 非fixed：显示「代码 学期」两行，或只显示学期
      let cellDisp;
      if(isT) cellDisp='Trans';
      else if(def.fixed) cellDisp=v||'·';
      else if(dispCode&&v) cellDisp=`<span style="display:block;font-size:8px;color:#6b7280;font-weight:600;line-height:1.2">${dispCode}</span><span style="font-size:9px">${v}</span>`;
      else if(v) cellDisp=v;
      else cellDisp='·';

      if(def.fixed){
        h+=`<td class="${cellCls}" style="${cellStyle}" onclick="openCell('${s.id}','${slot}','${pid}')">${cellDisp}</td>`;
      } else {
        h+=`<td class="${cellCls}" style="${cellStyle};cursor:pointer;line-height:1.3;padding:2px 1px;" onclick="openExtCell('${s.id}','${slot}','${co}','${def.n}')">${cellDisp}</td>`;
      }
    });
    h+='</tr>';
  });

  h+='</tbody>';

  // ── tfoot: 固定在表格底部的汇总区 ──
  h+='<tfoot>';

  // 每学期课数
  h+=`<tr class="tr-sh"><td class="cc sticky-col sc1"></td><td class="cc sticky-col sc2"></td><td class="ccr sticky-col sc3"></td><td class="cn sticky-col sc4" style="font-weight:600">每学期课数</td>${studs.map(()=>'<td></td>').join('')}</tr>`;
  years.forEach((yr,yi)=>{
    const bg=yearBg[yi%3],bd=yearBd[yi%3];
    h+=`<tr><td colspan="2" style="background:${bg};border-top:2px solid ${bd}"></td>
      <td style="background:${bg};border-top:2px solid ${bd}"></td>
      <td class="cn" style="background:${bg};border-top:2px solid ${bd};font-size:10px;font-weight:600;color:var(--ink2);padding-left:8px">── ${yr} 学年 ──</td>
      ${studs.map(()=>`<td style="background:${bg};border-top:2px solid ${bd}"></td>`).join('')}</tr>`;
    [1,2,3].forEach(sem=>{
      const sc=`${yr}/${sem}`,isMin=sem===3,maxCr=isMin?9:21;
      h+=`<tr><td class="cc" style="background:${bg};font-size:9px;color:var(--ink3)">${isMin?'小':''}</td>
        <td class="cc" style="background:${bg}"></td><td class="ccr" style="background:${bg}"></td>
        <td class="cn" style="background:${bg};font-family:var(--mono);font-size:10px;color:var(--ink3);padding-left:16px">${sc}</td>`;
      studs.forEach(s=>{
        const{cnt,cr}=semData(s),n=cnt[sc]||0,cred=cr[sc]||0,over=cred>maxCr;
        h+=`<td style="background:${bg};text-align:center;font-size:11px;font-family:var(--mono)" class="${n===0?'snil':over?'so2':'sv'}" title="${n}门 ${cred}学分${over?' ⚠':''}">${n||''}</td>`;
      });
      h+='</tr>';
    });
  });

  // Transferred 统计行
  h+='<tr style="background:#eff6ff;border-top:2px solid #bfdbfe"><td class="sticky-col sc1" style="background:#eff6ff"></td><td class="sticky-col sc2" style="background:#eff6ff"></td><td class="sticky-col sc3" style="background:#eff6ff"></td><td class="sticky-col sc4" style="background:#eff6ff;padding:4px 8px;font-size:11px;font-weight:600;color:#1e40af">✈ Transferred 已抵免</td>';
  studs.forEach(s=>{
    const tp=calcProgress(s,allProgCourses);
    const tC=tp.transferC,tCr=tp.transferCr;
    h+=tC>0?
      '<td style="background:#dbeafe;text-align:center;font-family:var(--mono);font-size:10px;font-weight:600;color:#1e40af">'+tC+'门<br><span style="font-size:9px;opacity:.8">'+tCr+'学分</span></td>':
      '<td style="background:#eff6ff;text-align:center;color:#93c5fd;font-size:10px">—</td>';
  });
  h+='</tr>';

  // 剩余课数行（只显示剩余课数，不显示学分）
  h+=`<tr class="tr-rem">
    <td class="cc sticky-col sc1"></td><td class="cc sticky-col sc2"></td>
    <td class="ccr sticky-col sc3"></td>
    <td class="cn sticky-col sc4" style="font-weight:600;color:var(--amber)">剩余课数 &nbsp;<span style="font-size:10px;font-weight:400;color:var(--ink3)">38 课程 + 实习课程</span></td>`;
  studs.forEach(s=>{
    const bp=calcProgress(s,allProgCourses);
    const internOk=bp.internOk;
    const remC=bp.remC;
    const isCom=remC===0&&internOk;
    let cellContent='';
    if(isCom){
      cellContent=`<td class="rv rv-ok" style="background:#854d0e;color:#fff;text-align:center;vertical-align:middle">
        <div style="font-size:13px">🎓</div>
        <div style="font-size:9px;font-weight:700;letter-spacing:.3px">达标</div>
      </td>`;
    } else {
      const remTotal = remC + (internOk?0:1);
      const cls = remTotal>20?'rv-hi':remTotal>10?'rv-mid':'rv-ok';
      cellContent=`<td class="rv ${cls}" style="text-align:center;vertical-align:middle">
        <div style="font-size:13px;font-weight:700;font-family:var(--mono)">${remTotal}</div>
        <div style="font-size:8px;opacity:.7">${remC>0?remC+'课':''}${internOk?'':' +实习'}</div>
      </td>`;
    }
    h+=cellContent;
  });
  h+='</tr>';
  h+=`<tr><td colspan="${4+studs.length}" style="font-size:10px;color:var(--ink3);padding:4px 10px;font-style:italic;background:var(--paper)">
    ★ 通识选修超选 = 外系选修 &nbsp;|&nbsp; 实习：KT411(6cr) 或 KT331+KT332(3+3cr) &nbsp;|&nbsp; 语言修选：全英文(KE) 或 全泰文(KH)，不可混选
  </td></tr>`;
  h+='</tfoot></table></div></div>';
  return h;
}

// ── External elective cells ────────────────────────────
function extCodeChanged(co,n,slot){
  const codeEl=document.getElementById('extcode-'+co+'-'+n);
  const code=(codeEl?.value||'').trim().toUpperCase();
  document.querySelectorAll(`[data-slot="${slot}"][data-cohort="${co}"]`).forEach(inp=>{
    const sid=inp.dataset.sid,sem=inp.value.trim();
    saveFreeCell(sid,slot,code,sem);
  });
}
function extSemChanged(inp){
  const sid=inp.dataset.sid,slot=inp.dataset.slot,co=inp.dataset.cohort,n=inp.dataset.n;
  const codeEl=document.getElementById('extcode-'+co+'-'+n);
  const code=(codeEl?.value||'').trim().toUpperCase(),sem=inp.value.trim();
  saveFreeCell(sid,slot,code,sem);
}
function saveFreeCell(sid,slot,code,sem){
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  if(!s.courses) s.courses={};
  code=(code||'').trim().toUpperCase(); sem=(sem||'').trim();
  const val=code&&sem?`${code}|${sem}`:code||'';
  if(val) s.courses[slot]=val; else delete s.courses[slot];
  try{apiSaveCourse(sid,slot,val);}catch(e){}
}

// ── Cell edit modal ────────────────────────────────────
function openCell(sid,code,pid){
  const s=DB.students.find(x=>x.id===sid);
  const course=progCourses(pid||activeProg).find(x=>x.c===code);
  if(!s||!course) return;
  const cur=(s.courses||{})[code]||'';
  cellCtx={sid,code,pid:pid||activeProg}; pickedVal=cur;
  document.getElementById('cm-n').textContent=shortName(s.name);
  document.getElementById('cm-i').textContent=`${s.cohort}届 · ${s.id}`;
  document.getElementById('cm-chip').innerHTML=`<div class="ccode">${course.c} · ${course.cr}学分</div><div class="cname">${course.n}</div><div class="cgrp">${course.g}</div>${cur?`<div class="ccur">目前：<span class="cur-pill">${cur}</span></div>`:''}`;
  const sems=semsByStudent(s);
  document.getElementById('cm-grid').innerHTML=sems.map(sem=>`<div class="sopt${sem===cur?' sel':sem===NOW_SEM?' now':''}" onclick="pick('${sem}')" id="so-${sem.replace('/','_')}">${sem}${sem===NOW_SEM?' ★':''}</div>`).join('');
  document.getElementById('sp-t').className='sp sp-t'+(cur==='Transferred'?' sel':'');
  openModal('cell-modal');
}
function pick(val){
  pickedVal=val;
  document.querySelectorAll('.sopt').forEach(e=>e.classList.remove('sel'));
  document.getElementById('sp-t').classList.remove('sel');
  if(val==='Transferred') document.getElementById('sp-t').classList.add('sel');
  else if(val){const el=document.getElementById('so-'+val.replace('/','_'));if(el)el.classList.add('sel');}
}
async function confirmCell(){
  if(!cellCtx) return;
  const s=DB.students.find(x=>x.id===cellCtx.sid); if(!s) return;
  if(!s.courses) s.courses={};
  if(cellCtx.isExt){
    const codeInp=document.getElementById('ext-modal-code');
    const code=(codeInp?.value||cellCtx.extCode||'').trim().toUpperCase();
    if(!pickedVal){delete s.courses[cellCtx.code];}
    else if(pickedVal==='Transferred'){s.courses[cellCtx.code]='Transferred';}
    else{s.courses[cellCtx.code]=code?code+'|'+pickedVal:pickedVal;}
    closeModal('cell-modal'); _renderOverviewKeepScroll();
    try{await apiSaveCourse(cellCtx.sid,cellCtx.code,s.courses[cellCtx.code]||'');}
    catch(e){alert('同步失败：'+e.message);}
    return;
  }
  if(!pickedVal) delete s.courses[cellCtx.code]; else s.courses[cellCtx.code]=pickedVal;
  closeModal('cell-modal'); _renderOverviewKeepScroll();
  try{await apiSaveCourse(cellCtx.sid,cellCtx.code,pickedVal||'');}
  catch(e){alert('同步失败：'+e.message);}
}

// ── TEP modal ──────────────────────────────────────────
function openTep(sid,type){
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  tepCtx={sid,type};
  document.getElementById('tm-n').textContent=shortName(s.name)+' · TEP';
  document.getElementById('tm-i').textContent=type==='entry'?'入学时 (Entry)':'毕业前 (Exit)';
  const t=(s.tep||{})[type]||{};
  if(type==='entry'){
    document.getElementById('tm-body').innerHTML=`<div class="fr"><label>入学 TEP 分数</label><input type="number" id="tm-score" value="${t.score||''}"></div>`;
  } else {
    const fail=t.score&&parseInt(t.score)<TEP_PASS;
    document.getElementById('tm-body').innerHTML=`
      <div class="fr"><label>毕业 TEP 分数（满分 100）</label>
        <input type="number" id="tm-score" value="${t.score||''}" oninput="checkTepFail(this.value)"></div>
      <div id="tm-fail-wrap" style="${fail?'':'display:none'}">
        <div class="notice n-warn" style="margin-bottom:10px">低于 ${TEP_PASS} 分，需要重考</div>
        <div class="fr"><label>重考分数</label><input type="number" id="tm-retest" value="${t.retest||''}"></div>
      </div>`;
  }
  openModal('tep-modal');
}
function checkTepFail(v){const w=document.getElementById('tm-fail-wrap');if(w)w.style.display=(parseInt(v)<TEP_PASS&&v!=='')?'':'none';}
async function confirmTep(){
  if(!tepCtx) return;
  const s=DB.students.find(x=>x.id===tepCtx.sid); if(!s) return;
  if(!s.tep) s.tep={};
  const score=document.getElementById('tm-score').value.trim();
  const retest=document.getElementById('tm-retest')?.value.trim()||'';
  if(!score) delete s.tep[tepCtx.type]; else s.tep[tepCtx.type]={score,...(retest?{retest}:{})};
  closeModal('tep-modal'); render();
  try{await apiSaveTep(tepCtx.sid,tepCtx.type,s.tep[tepCtx.type]||{});}catch(e){}
}

// ── Add / Edit student ─────────────────────────────────
function renderProgSelect(){document.getElementById('f-prog').innerHTML=DB.programs.map(p=>`<option value="${p.id}"${p.id===activeProg?' selected':''}>${p.name}</option>`).join('');}
function autoClassCode(cohort,type){return 'TM'+(cohort||'')+( type==='transfer'?'ZSB':'');}
function toggleOther(v){document.getElementById('f-other-row').style.display=v==='other'?'flex':'none';}

// 在籍状况
let _leaveSems = [];
function toggleStatusFields(val){
  document.getElementById('f-leave-area').style.display=val==='休学'?'block':'none';
  document.getElementById('f-withdraw-area').style.display=val==='退学'?'block':'none';
}
function addLeaveSem(){
  const inp=document.getElementById('f-leave-input');
  const sem=(inp?.value||'').trim();
  if(!sem)return;
  if(!_leaveSems.includes(sem))_leaveSems.push(sem);
  inp.value='';
  renderLeaveTags();
}
function removeLeaveSem(i){
  _leaveSems.splice(i,1);
  renderLeaveTags();
}
function renderLeaveTags(){
  const el=document.getElementById('f-leave-tags');
  if(!el)return;
  el.innerHTML=_leaveSems.map((s,i)=>`<span style="display:inline-flex;align-items:center;gap:3px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:4px;padding:2px 6px;font-size:10px;font-family:var(--mono)">${s}<button onclick="removeLeaveSem(${i})" style="border:none;background:none;cursor:pointer;color:#b91c1c;font-size:11px;line-height:1;padding:0 2px">×</button></span>`).join('');
}
function extCodeChangedV2(co, n, slot, newCode) {
  const code = (newCode||'').trim().toUpperCase();
  // Update all students' ext slot to use new code (keep their sem)
  cohortStudents(co).forEach(s => {
    if(!s.courses) s.courses = {};
    const val = s.courses[slot] || '';
    const parts = val.split('|');
    const sem = parts.length > 1 ? parts[1] : (parts[0] && !/^ext/.test(parts[0]) ? parts[0] : '');
    const newVal = code && sem ? code+'|'+sem : code || '';
    if(newVal !== val) {
      s.courses[slot] = newVal || undefined;
      if(!newVal) delete s.courses[slot];
      apiSaveCourse(s.id, slot, newVal).catch(e => console.error(e));
    }
  });
}
function openExtCell(sid, slot, co, n) {
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  const val=(s.courses||{})[slot]||'';
  const parts=val.split('|');
  const curCode=parts[0]||'';
  const rawSem=parts.length>1?parts[1]:'';
  const curSem=rawSem&&/^\d\/25\d\d$/.test(rawSem)?(rawSem.match(/^(\d)\/(25\d\d)$/)||[])[2]+'/'+rawSem.split('/')[0]:rawSem;
  cellCtx={sid,code:slot,pid:activeProg,isExt:true,extCode:curCode,extCo:co,extN:n};
  pickedVal=curSem||'';
  document.getElementById('cm-n').textContent=shortName(s.name);
  document.getElementById('cm-i').textContent=s.cohort+'届 · '+s.id;
  document.getElementById('cm-chip').innerHTML=`
    <div class="ccode">${slot} · 3学分</div>
    <div class="cname">外系选修 ${n}</div>
    <div style="margin-top:6px;font-size:11px;color:var(--ink3)">课程代码：
      <input id="ext-modal-code" value="${curCode}" placeholder="例：FA301"
        style="border:1px solid var(--line2);border-radius:4px;padding:2px 7px;font-family:var(--mono);font-size:12px;width:90px;margin-left:4px">
    </div>
    ${curSem?`<div class="ccur">目前：<span class="cur-pill">${curSem}</span></div>`:''}`;
  const sems=semsByStudent(s);
  document.getElementById('cm-grid').innerHTML=sems.map(sem=>
    `<div class="sopt${sem===curSem?' sel':sem===NOW_SEM?' now':''}" id="so-${sem.replace('/','_')}" onclick="pick('${sem}')">${sem}${sem===NOW_SEM?' ★':''}</div>`
  ).join('');
  document.getElementById('sp-t').className='sp sp-t'+(curSem==='Transferred'?' sel':'');
  openModal('cell-modal');
}
function openAddStudent(){
  document.getElementById('am-title').textContent='新增学生';
  ['f-id','f-name','f-cname','f-other'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const ccEl=document.getElementById('f-classcode');
  if(ccEl) ccEl.value=autoClassCode(document.getElementById('f-cohort').value,document.getElementById('f-type').value);
  _leaveSems=[];renderLeaveTags();
  document.querySelectorAll('input[name="f-status"]').forEach((r,i)=>{r.checked=i===0;});
  toggleStatusFields('在学');
  ['f-withdraw-date','f-withdraw-sem','f-withdraw-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openModal('add-modal');
}
function openEditStudent(id){
  const s=DB.students.find(x=>x.id===id); if(!s) return;
  document.getElementById('am-title').textContent='编辑学生';
  document.getElementById('f-id').value=s.id;
  document.getElementById('f-name').value=s.name;
  document.getElementById('f-cname').value=s.cname||'';
  document.getElementById('f-cohort').value=s.cohort;
  document.getElementById('f-type').value=s.type;
  document.getElementById('f-note').value=s.note||'';
  document.getElementById('f-advisor').value=s.advisor||'';
  document.getElementById('f-other').value=s.noteText||'';
  document.getElementById('f-other-row').style.display=s.note==='other'?'flex':'none';
  // 在籍状况
  const sd=s.statusDetail||{};
  _leaveSems=sd.leave?[...sd.leave]:[];
  let statusVal='在学';
  if(sd.withdrawn) statusVal='退学';
  else if(sd.leave&&sd.leave.length) statusVal='休学';
  document.querySelectorAll('input[name="f-status"]').forEach(r=>{r.checked=r.value===statusVal;});
  toggleStatusFields(statusVal);
  renderLeaveTags();
  if(sd.withdrawn){
    const d=document.getElementById('f-withdraw-date');if(d)d.value=sd.withdrawDate||'';
    const sm=document.getElementById('f-withdraw-sem');if(sm)sm.value=sd.withdrawSem||'';
    const nt=document.getElementById('f-withdraw-note');if(nt)nt.value=sd.withdrawNote||'';
  }
  openModal('add-modal');
}
async function confirmAdd(){
  const id=document.getElementById('f-id').value.trim();
  const name=document.getElementById('f-name').value.trim();
  if(!id||!name){alert('请填写学号和姓名');return;}
  const note=document.getElementById('f-note').value;
  const nt=note==='other'?document.getElementById('f-other').value.trim():'';
  const pid=document.getElementById('f-prog').value;
  const ei=DB.students.findIndex(s=>s.id===id);
  if(ei>=0){
    if(!window.confirm(`⚠ 学号 ${id} 已存在！\n\n现有记录：${DB.students[ei].name}（${DB.students[ei].cohort}届）\n\n是否覆盖更新？`)) return;
  }
  // 在籍状况
  const statusRadio=document.querySelector('input[name="f-status"]:checked')?.value||'在学';
  let statusDetail={};
  if(statusRadio==='休学'){ statusDetail={leave:[..._leaveSems]}; }
  else if(statusRadio==='退学'){ statusDetail={withdrawn:true,withdrawDate:document.getElementById('f-withdraw-date')?.value||'',withdrawSem:document.getElementById('f-withdraw-sem')?.value||'',withdrawNote:document.getElementById('f-withdraw-note')?.value||''}; }
  const classCode=(document.getElementById('f-classcode')?.value||'').trim()||autoClassCode(document.getElementById('f-cohort').value,document.getElementById('f-type').value);
  const advisor=(document.getElementById('f-advisor')?.value||'').trim();
  const cname=(document.getElementById('f-cname')?.value||'').trim();
  const st={id,name,cname,cohort:document.getElementById('f-cohort').value,type:document.getElementById('f-type').value,note,noteText:nt,prog:pid,classCode,advisor,
    status:statusRadio,  // 同步文字状态
    statusDetail,
    courses:ei>=0?DB.students[ei].courses:{},tep:ei>=0?DB.students[ei].tep||{}:{},
    counselor:ei>=0?DB.students[ei].counselor||{}:{},counselorNotes:ei>=0?DB.students[ei].counselorNotes||[]:[],
    gpa:ei>=0?DB.students[ei].gpa:null,gpaHistory:ei>=0?DB.students[ei].gpaHistory||[]:[]};
  if(ei>=0) DB.students[ei]=st; else DB.students.push(st);
  closeModal('add-modal'); render();
  try{await apiSaveStudent(st);}catch(e){alert('同步失败：'+e.message);}
}
async function deleteStudent(id){
  const s=DB.students.find(x=>x.id===id);
  if(!confirm(`确定删除以下学生？\n\n${s?s.name+'（'+s.id+'）':id}\n\n此操作无法恢复。`)) return;
  DB.students=DB.students.filter(x=>x.id!==id); render();
  try{await apiDeleteStudent(id);}catch(e){}
}

// ── Counselor page ─────────────────────────────────────
// ── 动态大表（非TM专业）──────────────────────────────────
function blockHTMLDynamic(co, studs, pid, prog, courses, total) {
  const _b=getBatch(co);
  const groupMap={};
  courses.forEach(c=>{
    if(!groupMap[c.g]) groupMap[c.g]=[];
    groupMap[c.g].push(c);
  });
  const studsSorted=[...studs].sort((a,b)=>a.id.localeCompare(b.id));
  const _semOpts=(()=>{const s=new Set([NOW_SEM]);studsSorted.forEach(s2=>Object.values(s2.courses||{}).forEach(v=>{if(v&&v!=='Transferred'&&/^25\d\d\/\d$/.test(v))s.add(v);}));return[...s].sort((a,b)=>{const[ya,sa]=a.split('/');const[yb,sb]=b.split('/');return ya!==yb?parseInt(ya)-parseInt(yb):parseInt(sa)-parseInt(sb);});})();

  let h=`<div class="cb"><div class="cb-h" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-size:13px;font-weight:700;color:var(--h-text)">${co}届</span>
    <span style="font-size:11px;color:var(--g4)">${studsSorted.length}位学生 · ${prog.name}</span>
    <div style="flex:1"></div>
    ${_b.active?`
      <select onchange="setBatchSem('${co}',this.value)" style="padding:2px 6px;border:1px solid rgba(255,255,255,.3);border-radius:4px;background:rgba(255,255,255,.12);color:#fff;font-family:var(--mono);font-size:11px;height:24px;">
        ${_semOpts.map(s=>`<option value="${s}" ${s===_b.sem?'selected':''}>${s}</option>`).join('')}
      </select>
      <button onclick="saveBatch('${co}')" style="padding:3px 10px;border-radius:4px;border:none;background:#3ecf72;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">✓ 储存排课</button>
      <button onclick="toggleBatchMode('${co}','add')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(255,255,255,.3);background:transparent;color:var(--g4);font-size:11px;cursor:pointer;">✕ 取消</button>
    `:`
      <button onclick="toggleBatchMode('${co}','add')" style="padding:3px 10px;border:1px solid var(--g5);border-radius:4px;background:transparent;color:var(--g3);font-size:11px;cursor:pointer;">🗓 批次排课</button>
      <button onclick="toggleBatchMode('${co}','del')" style="padding:3px 10px;border:1px solid rgba(220,38,38,.5);border-radius:4px;background:transparent;color:#fca5a5;font-size:11px;cursor:pointer;">🗑 批次删除</button>
    `}
  </div><div class="tbl-wrap"><table style="min-width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr class="dh">
      <th style="position:sticky;left:0;z-index:3;min-width:28px;text-align:center">#</th>
      <th style="position:sticky;left:28px;z-index:3;min-width:72px">代码</th>
      <th style="position:sticky;left:100px;z-index:3;min-width:36px;text-align:center">学分</th>
      <th style="position:sticky;left:136px;z-index:3;min-width:180px">课程名称</th>
      ${studsSorted.map(s=>{
        const cc=s.classCode||autoClassCode(s.cohort,s.type);
        const pal=getClassColor(cc);
        return`<th style="min-width:70px;text-align:center;font-size:10px;font-weight:500;background:var(--g8)">
          <div style="font-size:11px;font-weight:600;color:#fff">${s.name.split(' ').slice(-1)[0]}</div>
          <div style="font-size:9px;color:var(--g4)">${s.id.slice(-4)}</div>
          <div style="font-size:9px;background:${pal.bg};color:${pal.fg};border-radius:3px;padding:0 3px;margin-top:1px">${cc}</div>
        </th>`;
      }).join('')}
    </tr></thead>
    <tbody>`;

  Object.entries(groupMap).forEach(([g,gCourses])=>{
    const _gtype=gCourses[0]?._gtype||'required';
    const _gcr=gCourses[0]?._gcr||0;
    const _label=_gtype==='elective'?` · 选修满 ${_gcr}学分`:_gtype==='skip'?` · 不计`:'';
    h+=`<tr class="dh"><td colspan="${4+studsSorted.length}" style="padding:6px 9px;font-size:11px;font-weight:600;color:#fff">▸ ${g}${_label}</td></tr>`;
    gCourses.forEach((course,ci)=>{
      const bg=ci%2===0?'#fff':'#fafafa';
      const _bSel=_b.active&&_b.selections[course.c];
      const _isDel=_b.mode==='del';
      const _nameBg=_bSel?(_isDel?'#fef2f2':'#f0fdf4'):bg;
      h+=`<tr style="background:${_nameBg}">
        <td class="cc sticky-col sc1" style="background:${_nameBg};text-align:center;color:var(--ink3);font-size:10px">${ci+1}</td>
        <td class="cc sticky-col sc2" style="background:${_nameBg};font-family:var(--mono);font-size:10px;font-weight:600;color:var(--sky)">${course.c}</td>
        <td class="ccr sticky-col sc3" style="background:${_nameBg};text-align:center">${course.cr}</td>
        <td class="cn sticky-col sc4" style="background:${_nameBg};cursor:${_b.active?'pointer':'default'}" onclick="${_b.active?`toggleBatchCourse('${co}','${course.c}')`:''}">${_b.active?`<span style="display:inline-block;width:13px;height:13px;border-radius:3px;border:1.5px solid ${_bSel?(_isDel?'#dc2626':'var(--g6)'):'var(--line2)'};background:${_bSel?(_isDel?'#dc2626':'var(--g6)'):'transparent'};color:#fff;font-size:10px;line-height:12px;text-align:center;margin-right:5px;vertical-align:middle;">${_bSel?(_isDel?'✕':'✓'):''}</span>`:''}${course.n}</td>
        ${studsSorted.map(s=>{
          const v=(s.courses||{})[course.c];
          const normV=v&&v!=='Transferred'?v:'';
          const sty=normV?globalSemStyle(normV):'';
          const disp=v==='Transferred'?'Transferred':normV||'·';
          const _isEmpty=!v;
          const _canAct=_b.active&&(_isDel?(!_isEmpty&&normV===_b.sem):_isEmpty);
          const _bRowSty=_canAct?(_bSel?(_isDel?'background:#991b1b;color:#fff;cursor:pointer;':'background:#166534;color:#fff;cursor:pointer;'):'cursor:pointer;'):'';
          const _bClick=_canAct?`toggleBatchCourse('${co}','${course.c}')`:`openCell('${s.id}','${course.c}','${pid}')`;
          return`<td class="dc ${normV?'vd':'vn'}" style="${_canAct?_bRowSty:sty}" onclick="${_bClick}">${_bSel&&_canAct?(_isDel?'✕':'✓'):disp}</td>`;
        }).join('')}
      </tr>`;
    });
  });

  h+=`</tbody></table></div></div>`;
  return h;
}

function getRiskInfo(gpa){
  const g=parseFloat(gpa)||0;
  if(!gpa) return{label:'无数据',cls:'',color:'var(--ink3)',emoji:''};
  if(g>=2) return{label:'✅ 风险解除',cls:'rp-ok',color:'#065f46',emoji:'✅'};
  if(g>=1.5) return{label:'⚠️ 一般风险：定期访谈',cls:'rp-warn',color:'#92400e',emoji:'⚠️'};
  if(g>=1) return{label:'🚫 重点预警：紧急深度干预',cls:'rp-risk',color:'#991b1b',emoji:'🚫'};
  return{label:'🔴 极高风险：紧急深度干预',cls:'rp-high',color:'#9d174d',emoji:'🔴'};
}
function renderCounselPage(){
  const page=document.getElementById('counsel-page');
  const filterProg=window._counselProg||'all',filterCohort=window._counselCohort||'all';
  const studs=DB.students.filter(s=>{
    const g=parseFloat(s.gpa);
    if(!s.gpa) return false;
    if(filterProg!=='all'&&(s.prog||'TM')!==filterProg) return false;
    if(filterCohort!=='all'&&s.cohort!==filterCohort) return false;
    // 达标毕业不计入辅导员老师记录
    const _pp=calcProgress(s,progCourses(s.prog||'TM'));
    const _gpn=parseFloat(s.gpa);
    if(_pp.remC===0&&_pp.internOk&&(s.gpa==null||_gpn>=2.0)) return false;
    const rk=window._counselRisk||'all';
    if(rk==='high'&&g>=1.0) return false;
    if(rk==='risk'&&(g<1.0||g>=1.5)) return false;
    if(rk==='warn'&&(g<1.5||g>=2.0)) return false;
    if(rk==='ok'&&g<2.0) return false;
    if(rk==='all'&&g>=2.0) return false;
    return true;
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const all=DB.students,counts={high:0,risk:0,warn:0,ok:0};
  all.forEach(s=>{const g=parseFloat(s.gpa);if(!s.gpa)return;if(g<1)counts.high++;else if(g<1.5)counts.risk++;else if(g<2)counts.warn++;else counts.ok++;});
  const atRisk=counts.high+counts.risk+counts.warn,rate=all.length?Math.round(atRisk/all.length*100):0;
  const progOpts=['all',...new Set(DB.students.map(s=>s.prog||'TM'))];
  const filterRisk=window._counselRisk||'all';
  let h=`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);margin-bottom:14px;min-height:36px;">
    <span style="font-size:11px;color:var(--ink3);font-family:var(--mono);">辅导员老师记录 · GPA 预警追踪</span>
    <span style="width:1px;height:14px;background:var(--line2);margin:0 4px;flex-shrink:0;"></span>
    <select onchange="window._counselProg=this.value;window._counselCohort='all';window._counselRisk='all';renderCounselPage()"
      style="padding:2px 7px;border:1px solid var(--line2);border-radius:5px;background:var(--card);color:var(--ink);font-family:var(--mono);font-size:11px;cursor:pointer;height:24px;">
      ${progOpts.map(p=>`<option value="${p}" ${p===filterProg?'selected':''}>${p==='all'?'全部专业':DB.programs.find(x=>x.id===p)?.name||p}</option>`).join('')}
    </select>
    <select onchange="window._counselCohort=this.value;window._counselRisk='all';renderCounselPage()"
      style="padding:2px 7px;border:1px solid var(--line2);border-radius:5px;background:var(--card);color:var(--ink);font-family:var(--mono);font-size:11px;cursor:pointer;height:24px;">
      <option value="all">全部届别</option>
      ${[...new Set(DB.students.filter(s=>filterProg==='all'||(s.prog||'TM')===filterProg).map(s=>s.cohort))].sort().map(co=>`<option value="${co}" ${co===filterCohort?'selected':''}>${co}届</option>`).join('')}
    </select>
    <span style="font-size:11px;color:var(--ink3);font-family:var(--mono);">预警 ${atRisk} / ${all.length} 人 · 风险率 <strong style="color:${atRisk>0?'var(--amber)':'var(--g7)'}">${rate}%</strong></span>
    <div style="flex:1;"></div>
    ${filterRisk!=='all'?`<button onclick="window._counselRisk='all';renderCounselPage()" style="padding:2px 8px;border:1px solid var(--line2);border-radius:4px;background:var(--paper);color:var(--ink2);font-size:11px;cursor:pointer;">✕ 清除筛选</button>`:''}
  </div>
  <div style="display:flex;gap:6px;margin-bottom:14px;">
    <div onclick="window._counselRisk=window._counselRisk==='high'?'all':'high';renderCounselPage()" style="flex:1;padding:8px 12px;border-radius:7px;border:2px solid ${filterRisk==='high'?'#dc2626':'#fecaca'};background:${filterRisk==='high'?'#fee2e2':'#fef2f2'};cursor:pointer;transition:all .12s;min-width:0">
      <div style="font-size:18px;font-weight:700;color:#dc2626;font-family:var(--mono);line-height:1">${counts.high}</div>
      <div style="font-size:10px;color:#991b1b;margin-top:3px;white-space:nowrap">🔴 极高风险 &lt;1.0</div>
    </div>
    <div onclick="window._counselRisk=window._counselRisk==='risk'?'all':'risk';renderCounselPage()" style="flex:1;padding:8px 12px;border-radius:7px;border:2px solid ${filterRisk==='risk'?'#ea580c':'#fed7aa'};background:${filterRisk==='risk'?'#ffedd5':'#fff7ed'};cursor:pointer;transition:all .12s;min-width:0">
      <div style="font-size:18px;font-weight:700;color:#ea580c;font-family:var(--mono);line-height:1">${counts.risk}</div>
      <div style="font-size:10px;color:#9a3412;margin-top:3px;white-space:nowrap">🚫 重点预警 1.0–1.5</div>
    </div>
    <div onclick="window._counselRisk=window._counselRisk==='warn'?'all':'warn';renderCounselPage()" style="flex:1;padding:8px 12px;border-radius:7px;border:2px solid ${filterRisk==='warn'?'#d97706':'#fde68a'};background:${filterRisk==='warn'?'#fef3c7':'#fffbeb'};cursor:pointer;transition:all .12s;min-width:0">
      <div style="font-size:18px;font-weight:700;color:#d97706;font-family:var(--mono);line-height:1">${counts.warn}</div>
      <div style="font-size:10px;color:#78350f;margin-top:3px;white-space:nowrap">⚠️ 一般风险 1.5–2.0</div>
    </div>
    <div onclick="window._counselRisk=window._counselRisk==='ok'?'all':'ok';renderCounselPage()" style="flex:1;padding:8px 12px;border-radius:7px;border:2px solid ${filterRisk==='ok'?'#059669':'#6ee7b7'};background:${filterRisk==='ok'?'#d1fae5':'#ecfdf5'};cursor:pointer;transition:all .12s;min-width:0">
      <div style="font-size:18px;font-weight:700;color:#059669;font-family:var(--mono);line-height:1">${counts.ok}</div>
      <div style="font-size:10px;color:#064e3b;margin-top:3px;white-space:nowrap">✅ 风险解除 ≥ 2.0</div>
    </div>
  </div>`;
  if(!studs.length){h+='<div style="text-align:center;padding:40px;color:var(--ink3);font-size:13px">✅ 目前没有 GPA 低于 2.0 的学生</div>';page.innerHTML=h;return;}
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">';
  studs.forEach((s,i)=>{
    const risk=getRiskInfo(s.gpa),notes=s.counselorNotes||[];
    h+=`<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${risk.cls==='rp-ok'?'#f0fdf4':risk.cls==='rp-warn'?'#fffbeb':risk.cls==='rp-risk'?'#fff1f2':'#fdf2f8'}">
        <div style="font-family:var(--mono);font-size:18px;font-weight:700;color:#9ca3af;width:28px;text-align:center">${i+1}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:600;color:#111827">${s.name}</div><div style="font-size:11px;color:#6b7280;margin-top:1px;font-family:var(--mono)">${s.id} · ${(()=>{const _cc2=s.classCode||autoClassCode(s.cohort,s.type);const _pal2=getClassColor(_cc2);return `<span style="color:${_pal2.fg};font-weight:600">${_cc2}</span>`;})()}</div></div>
        <div style="text-align:right"><div style="font-size:20px;font-weight:700;color:${risk.color};font-family:var(--mono)">${s.gpa}</div>
          <div style="font-size:10px;margin-top:2px"><span style="padding:2px 7px;border-radius:4px;background:${risk.cls==='rp-ok'?'#d1fae5':risk.cls==='rp-warn'?'#fef3c7':risk.cls==='rp-risk'?'#fee2e2':'#fce7f3'};color:${risk.color}">${risk.label}</span></div></div>
      </div>
      <div style="padding:12px 14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#fafafa">
        <div><div style="font-size:10px;color:#9ca3af;font-weight:600;margin-bottom:3px">辅导员老师</div>
          <input id="adv-${s.id}" value="${s.advisor||''}" placeholder="辅导员老师姓名"
            style="width:100%;border:1px solid #e5e7eb;border-radius:5px;padding:5px 8px;font-size:12px;font-family:var(--font);background:#fff">
        </div>
        <div><div style="font-size:10px;color:#9ca3af;font-weight:600;margin-bottom:3px">在籍状况</div>
          ${(()=>{
            const sd=s.statusDetail||{};
            let st=s.status||'就读';
            if(sd.withdrawn) st='退学';
            else if(sd.leave&&sd.leave.length) st='休学';
            const col=st==='退学'?'#7c3aed':st==='休学'?'#b91c1c':st==='延修'?'#d97706':'#374151';
            const detail=sd.withdrawn&&sd.withdrawSem?` · ${sd.withdrawSem}`:sd.leave&&sd.leave.length?` · ${sd.leave.join(', ')}` :'';
            return `<div style="padding:5px 8px;border:1px solid #e5e7eb;border-radius:5px;font-size:12px;background:#f9fafb;color:${col};font-weight:500">${st}${detail}</div>`;
          })()}
        </div>

      </div>
      <div style="padding:0 14px 8px;background:#fafafa">
        <div style="font-size:10px;color:#9ca3af;font-weight:600;margin-bottom:6px">访谈记录</div>
        <div id="notes-${s.id}" style="display:flex;flex-direction:column;gap:6px">
          ${notes.map((n,ni)=>`
            <div style="border:1px solid #e5e7eb;border-radius:6px;background:#fff;overflow:hidden" id="note-${s.id}-${ni}">
              <div style="display:flex;gap:6px;align-items:center;padding:6px 10px;cursor:pointer;user-select:none" onclick="toggleNote('${s.id}',${ni})">
                <span style="font-size:13px;color:#9ca3af" id="note-icon-${s.id}-${ni}">${n._open!==false?'−':'＋'}</span>
                <span style="font-family:var(--mono);font-size:11px;font-weight:600;color:#374151">${n.date||'新记录'}</span>
                <span style="font-size:10px;color:#9ca3af;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.content?n.content.substring(0,40)+'...':''}</span>
                <button onclick="event.stopPropagation();deleteNote('${s.id}',${ni})" style="border:none;background:none;color:#ef4444;cursor:pointer;font-size:12px;padding:0 4px;flex-shrink:0">✕</button>
              </div>
              <div id="note-body-${s.id}-${ni}" style="padding:0 10px 10px;display:${n._open===false?'none':'block'}">
                <input value="${n.date||''}" placeholder="日期 2025-08-20"
                  style="border:1px solid #e5e7eb;border-radius:4px;padding:3px 6px;font-size:11px;font-family:var(--mono);width:130px;margin-bottom:6px"
                  onchange="updateNote('${s.id}',${ni},'date',this.value)">
                <textarea placeholder="访谈内容..."
                  style="width:100%;border:1px solid #e5e7eb;border-radius:4px;padding:5px 7px;font-size:12px;font-family:var(--font);resize:vertical;min-height:60px;box-sizing:border-box"
                  onchange="updateNote('${s.id}',${ni},'content',this.value)">${n.content||''}</textarea>
                <div style="margin-top:5px"><div style="font-size:10px;color:#9ca3af;margin-bottom:2px">主任备注</div>
                  <textarea placeholder="主任访谈记录..."
                    style="width:100%;border:1px solid #e5e7eb;border-radius:4px;padding:4px 7px;font-size:11px;font-family:var(--font);resize:vertical;min-height:30px;box-sizing:border-box"
                    onchange="updateNote('${s.id}',${ni},'dirNote',this.value)">${n.dirNote||''}</textarea>
                </div>
                <div style="margin-top:8px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb">
                  <div style="font-size:10px;color:#9ca3af;font-weight:600;margin-bottom:5px">同意书</div>
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;margin-bottom:5px">
                    <input type="checkbox" id="con-${s.id}-${ni}" ${n.consent?'checked':''}
                      onchange="updateNote('${s.id}',${ni},'consent',this.checked)"
                      style="width:13px;height:13px">
                    <span>已签署同意书</span>
                  </label>
                  <textarea placeholder="同意书备注..."
                    style="width:100%;border:1px solid #e5e7eb;border-radius:4px;padding:4px 7px;font-size:11px;font-family:var(--font);resize:vertical;min-height:30px;box-sizing:border-box"
                    onchange="updateNote('${s.id}',${ni},'consentNote',this.value)">${n.consentNote||''}</textarea>
                </div>
              </div>
            </div>`).join('')}
        </div>
        <button onclick="addNote('${s.id}')" style="margin-top:6px;width:100%;padding:7px;border:1px dashed #d1d5db;border-radius:6px;background:#fff;color:#6b7280;font-size:12px;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:4px">
          <span style="font-size:16px;line-height:1;font-weight:300">＋</span> 新增访谈记录
        </button>
      </div>

      <div style="padding:8px 14px;background:#f3f4f6;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end">
        <button id="save-btn-${s.id}" onclick="saveCounselCard('${s.id}')"
          style="padding:6px 18px;background:var(--g7);color:#fff;border:none;border-radius:6px;font-size:12px;font-family:var(--font);cursor:pointer;font-weight:500">✓ 确认储存</button>
      </div>
    </div>`;
  });
  h+='</div>';
  page.innerHTML=h;
}
function toggleNote(sid,idx){
  const body=document.getElementById('note-body-'+sid+'-'+idx),icon=document.getElementById('note-icon-'+sid+'-'+idx);
  if(!body) return;
  const isOpen=body.style.display!=='none';
  body.style.display=isOpen?'none':'block';
  if(icon) icon.textContent=isOpen?'＋':'−';
  const s=DB.students.find(x=>x.id===sid);
  if(s?.counselorNotes?.[idx]) s.counselorNotes[idx]._open=!isOpen;
}
function addNote(sid){
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  if(!s.counselorNotes) s.counselorNotes=[];
  // 折叠所有旧记录
  s.counselorNotes.forEach(n=>{ n._open=false; });
  // 新记录展开
  s.counselorNotes.push({date:new Date().toISOString().slice(0,10),content:'',dirNote:'',_open:true});
  renderCounselPage();
}
function deleteNote(sid,idx){
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  if(!confirm('删除这条访谈记录？')) return;
  s.counselorNotes.splice(idx,1); renderCounselPage();
}
function updateNote(sid,idx,field,val){
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  if(!s.counselorNotes) s.counselorNotes=[];
  if(!s.counselorNotes[idx]) s.counselorNotes[idx]={};
  s.counselorNotes[idx][field]=val;
}
async function saveCounselCard(sid){
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  s.advisor=document.getElementById('adv-'+sid)?.value||'';
  // 状态从学生进度同步，辅导员老师页不再修改
  const consent=document.getElementById('con-'+sid)?.checked||false;
  const consentNote=document.getElementById('con-note-'+sid)?.value||'';
  if(!s.counselor) s.counselor={};
  s.counselor.consent=consent?'已签':'';
  s.counselor.consentNote=consentNote;
  try{await apiSaveCounselor(sid,{advisor:s.advisor,consent:s.counselor.consent,consentNote,notes:JSON.stringify(s.counselorNotes||[])});}catch(e){console.error(e);}
  // 储存后折叠所有记录
  if(s.counselorNotes) s.counselorNotes.forEach(n=>{ n._open=false; });
  const btn=document.getElementById('save-btn-'+sid);
  const card=btn?.closest('div[style*="border-radius:10px"]');
  if(btn){btn.textContent='✓ 已储存';btn.style.background='#059669';btn.style.boxShadow='0 0 0 3px #6ee7b7';}
  if(card){card.style.boxShadow='0 0 0 2px #059669,0 4px 12px rgba(5,150,105,.2)';card.style.borderColor='#059669';}
  setTimeout(()=>{
    renderCounselPage();
  },800);
}

// ── GPA ────────────────────────────────────────────────
async function applyGPA(sid,gpa,updatedAt){
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  if(!s.gpaHistory) s.gpaHistory=[];
  if(s.gpa!==gpa) s.gpaHistory.push(gpa);
  s.gpa=gpa; s.gpaUpdated=updatedAt;
  render();
  try{await apiSaveGpa(sid,gpa,updatedAt);}catch(e){}
  alert('GPA 已更新');
}

// ── PDF Import ──────────────────────────────────────────
function openBuildModal(){ openImport('structure'); }
function openGradeModal(){ openImport('report'); }
function openImport(mode){
  window._importMode=mode;
  // 若 DB.students 为空，先同步
  if(!DB.students.length&&mode==='report'){
    if(!confirm('⚠ 目前没有已建档学生，Report 模式需要先有学生才能匹配。\n\n是否先同步数据库？\n（按「取消」继续上传，按「确认」先同步）')) {
      // 继续
    } else {
      syncFromSheet();
      return;
    }
  }
  const title=document.getElementById('import-title'),sub=document.getElementById('import-sub');
  const dropTitle=document.getElementById('drop-title'),dropSub=document.getElementById('drop-sub');
  if(mode==='structure'){
    if(title) title.textContent='📋 建档 — Course Structure';
    if(sub) sub.textContent='上传 Course Structure PDF · 建立学生档案';
    if(dropTitle) dropTitle.textContent='选取 Course Structure PDF（可多选）';
    if(dropSub) dropSub.textContent='自动识别学号 · 建立档案 · 标记 ✓ / Transferred';
  } else {
    if(title) title.textContent='📊 更新成绩 — Report';
    if(sub) sub.textContent='上传 Report PDF · 写入学期码 · 更新 GPA';
    if(dropTitle) dropTitle.textContent='选取 Report PDF（可多选）';
    if(dropSub) dropSub.textContent='自动识别学号 · 写入学期码 · 更新 GPA 历史';
  }
  document.getElementById('pdf-out').innerHTML='';
  document.getElementById('batch-out').innerHTML='';
  document.getElementById('batch-progress').style.display='none';
  document.getElementById('batch-apply-btn').style.display='none';
  openModal('import-modal');
}
function renderPdfSel(){
  const progSel=document.getElementById('pdf-prog');
  if(progSel) progSel.innerHTML=DB.programs.map(p=>`<option value="${p.id}" ${p.id===activeProg?'selected':''}>${p.name}</option>`).join('');
  const sel=document.getElementById('pdf-stu'); if(!sel) return;
  const selProg=progSel?.value||activeProg;
  let h='<option value="">— 自动从 PDF 识别学号 —</option>';
  COHORTS.forEach(co=>{
    const sts=DB.students.filter(s=>s.cohort===co&&(s.prog||'TM')===selProg);
    if(!sts.length) return;
    h+=`<optgroup label="${co}届">${sts.map(s=>`<option value="${s.id}">${s.name}（${s.id}）</option>`).join('')}</optgroup>`;
  });
  sel.innerHTML=h;
}
function getPdfProg(){return document.getElementById('pdf-prog')?.value||activeProg;}
function handlePdfDrop(e){e.preventDefault();document.getElementById('pdf-drop').classList.remove('on');const files=[...e.dataTransfer.files].filter(f=>f.name.endsWith('.pdf'));if(files.length)unifiedImport(files);}
function handlePdfFiles(inp){if(inp.files.length)unifiedImport([...inp.files]);}
async function unifiedImport(files){
  const sid=document.getElementById('pdf-stu')?.value;
  if(files.length===1&&sid){
    const out=document.getElementById('pdf-out');
    document.getElementById('batch-out').innerHTML='';
    document.getElementById('apply-all').style.display='none';
    out.innerHTML='<div style="color:var(--ink3);padding:8px;font-size:12px">解析中...</div>';
    let txt='';
    try{
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const buf=await files[0].arrayBuffer(),pdf=await pdfjsLib.getDocument(buf).promise;
      for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const ct=await pg.getTextContent();txt+=ct.items.map(x=>x.str).join(' ')+' ';}
    }catch(e){out.innerHTML=`<div class="notice n-warn">解析失败：${e.message}</div>`;return;}
    analyzeText(txt,out);
  } else {
    document.getElementById('pdf-out').innerHTML='';
    runBatch(files);
  }
}
function detectPdfType(txt){if(/\bReport\b/.test(txt)&&/Semester.Year/i.test(txt))return 'report';if(/Course Structure/i.test(txt))return 'structure';if(/\b\d\/25\d\d\b/.test(txt))return 'report';return 'structure';}
const TM_GROUPS_MAP={'KG131':'通识课·必修','KG145':'通识课·必修','KG151':'通识课·必修','KG155':'通识课·必修','LA130':'通识课·必修','LA131':'通识课·必修','LA132':'通识课·必修','KG132':'通识课·选修','KG133':'通识课·选修','KG134':'通识课·选修','KG135':'通识课·选修','KG146':'通识课·选修','KG147':'通识课·选修','KG148':'通识课·选修','KG154':'通识课·选修','KG156':'通识课·选修','KG157':'通识课·选修','KB216':'基础专业课','KB217':'基础专业课','KB218':'基础专业课','KB219':'基础专业课','KB220':'基础专业课','KB221':'基础专业课','KB222':'基础专业课','KB223':'基础专业课','KT305':'旅游专业·必修','KT311':'旅游专业·必修','KT316':'旅游专业·必修','KT319':'旅游专业·必修','KT322':'旅游专业·必修','KT327':'旅游专业·必修','KT328':'旅游专业·必修','KT329':'旅游专业·必修','KT330':'旅游专业·必修','KT333':'旅游专业·必修','KT363':'旅游专业·必修','KT364':'旅游专业·必修','KT412':'Capstone','KT331':'旅游专业·选修','KT332':'旅游专业·选修','KT411':'实习课程','KE311':'语言修选','KE316':'语言修选','KE325':'语言修选','KE327':'语言修选','KE333':'语言修选','KH351':'语言修选','KH352':'语言修选','KH353':'语言修选','KH354':'语言修选','KH355':'语言修选','KH160':'自由选修'};
function parseCourseStructure(txt,courses){const found={};courses.forEach(c=>{const re=new RegExp(c.c+'.{0,150}?/([A-Za-z+*\\-]+)[\\s/]','i');const m=txt.match(re);if(!m)return;if(m[1].trim()==='*')found[c.c]='Transferred';});return found;}
function parseReport(txt,courses){
  const found={};
  const FAIL=new Set(['F','W','U','I']);

  // Transfer 区段
  const transIdx=txt.indexOf('Transfer');
  if(transIdx>=0){
    const transEnd=txt.search(/\d\/25\d\d/);
    const transSeg=txt.substring(transIdx,transEnd>0?transEnd:transIdx+600);
    (transSeg.match(/\b([A-Z]{2,4}\d{3,4})\b/g)||[]).forEach(code=>{found[code]='Transferred';});
  }

  // 去除重修编号 (1)(2)
  const norm=txt.replace(/\b([A-Z]{2,4}\d{3,4})\s*\(\d+\)/g,'$1');

  // 建立学期码位置映射
  const semPos=[];
  const semRe2=/\b(\d)\/(25\d\d)\b/g;
  let sm;
  while((sm=semRe2.exec(norm))!==null){
    semPos.push({pos:sm.index,sem:sm[2]+'/'+sm[1]});
  }

  // 对每个课程代码，找前面最近的学期码，再验证成绩
  const codeRe=/\b([A-Z]{2,4}\d{3,4})\b/g;
  let cm;
  while((cm=codeRe.exec(norm))!==null){
    const code=cm[1],pos=cm.index;
    if(found[code]) continue;

    // 找前面最近的学期码
    let curSem=null;
    for(const sp of semPos){ if(sp.pos<pos) curSem=sp.sem; }
    if(!curSem) continue;

    // 在课程代码后面找学分+成绩+分数（最多150字符）
    const after=norm.substring(pos,pos+150);

    // 检查课程代码和成绩之间是否有更新的学期码（如 KB218 ... Innovation 3/2566 ...）
    const inlineSem=after.match(/\b(\d)\/(25\d\d)\b/);
    if(inlineSem) curSem=inlineSem[2]+'/'+inlineSem[1];

    // 匹配学分 成绩 分数（分数可选，如 `-` 成绩无分数）
    const gm=after.match(/\b(3|6)\s+([A-Za-z+\-]+)(?:\s+([\d.]+))?/);
    if(!gm) continue;
    const grade=gm[2],pts=gm[3]?parseFloat(gm[3]):null;
    if(FAIL.has(grade)) continue;
    // 「-」= 已注册未出成绩，写入当前学期（不覆盖已有记录）
    if(grade==='-'){
      if(!found[code]) found[code]=curSem;
      continue;
    }
    if(pts!==null&&pts===0&&grade!=='S'&&grade!=='P') continue;

    found[code]=curSem;  // 重修覆盖旧记录
  }

  // Transferred 标记（*）
  courses.forEach(c=>{
    if(found[c.c]) return;
    if(norm.match(new RegExp(c.c+'.{0,80}?\\*','i'))) found[c.c]='Transferred';
  });

  return found;
}

function parseReportGPA(txt){const matches=[...txt.matchAll(/GPAX\s*:\s*([\d.]+)/gi)];const vals=matches.map(m=>parseFloat(m[1])).filter(v=>v<=4.0&&v>0);return{gpa:vals.length?vals[vals.length-1]:null,history:vals};}
function extractStudentInfo(txt){
  let sid=null;
  // 支持多种格式：Student ID / Student Code / 行首8位数
  const p1=txt.match(/Student\s*(?:ID|Code)\s*[:\s]+(\d{8})/i);if(p1)sid=p1[1];
  if(!sid){const p2=txt.match(/\b(6[4-9]\d{6})\b/);if(p2)sid=p2[1];}
  // 支持 Name Miss... 和 Student Name: Miss...
  let name=null;
  const nm1=txt.match(/\bName\s+((?:Mr\.|Miss|Mrs\.|Ms\.)\s+[\w\s]+?)(?:\s{2,}|\s*Degree|\s*Track|\n)/i);
  if(nm1) name=nm1[1].replace(/\s+/g,' ').trim();
  if(!name){const nm2=txt.match(/Student\s*Name\s*:\s*((?:Mr\.|Miss|Mrs\.|Ms\.)\s+[\w\s]+?)(?:\s{2,}|\s*Student|\n)/i);if(nm2)name=nm2[1].replace(/\s+/g,' ').trim().replace(/Student.*/i,'').trim();}
  const isTransfer=/HV\.?\s*Transfer/i.test(txt),type=isTransfer?'transfer':'normal';
  const pdfType=detectPdfType(txt);
  let gpa=null,gpaHistory=[];
  if(pdfType==='report'){const gpaData=parseReportGPA(txt);gpa=gpaData.gpa;gpaHistory=gpaData.history;}
  return{sid,name,type,gpa,gpaHistory};
}
function extractCourseList(txt){
  const codeRe=/\b([A-Z]{2,4}\d{3,4}[a-z]?)\b/g,SKIP=new Set(['TRUE','FALSE','GPA','TEP','DPU','CIC','PDF','HV','AEC']);
  const seen=new Set(),courses=[];let m;
  while((m=codeRe.exec(txt))!==null){
    const code=m[1];if(seen.has(code)||SKIP.has(code))continue;
    const seg=txt.substring(m.index,m.index+140);
    const crM=seg.match(/\b(6|3)\s*\/([A-Za-z+*\-]+)/);if(!crM)continue;
    const cr=parseInt(crM[1]),beforeCr=seg.substring(code.length,seg.indexOf(crM[0]));
    const name=beforeCr.replace(/^\s*\d*\s*/,'').replace(/\s+/g,' ').trim()||code;
    const g=TM_GROUPS_MAP[code]||'专业课程';
    seen.add(code);courses.push({c:code,n:name,cr,g});
  }
  return courses;
}
function analyzeText(txt,out){
  const sid=document.getElementById('pdf-stu').value;
  const student=sid?DB.students.find(s=>s.id===sid):null;
  const pid=(student?.prog)||getPdfProg(),courses=progCourses(pid);
  const type=detectPdfType(txt);
  const{sid:pdfSid,name:pdfName,type:pdfStudentType,gpa:latestGPA,gpaHistory:gpaHistArr}=extractStudentInfo(txt);
  let found={};
  if(type==='report')found=parseReport(txt,courses);
  else found=parseCourseStructure(txt,courses);
  const sys=student?(student.courses||{}):{};
  pendingDiffs=[];
  const now=new Date().toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  courses.forEach(c=>{
    const pv=found[c.c],sv=sys[c.c];if(!pv)return;
    if(type==='structure'){if(!sv)pendingDiffs.push({code:c.c,name:c.n,pdf:'✓ 已完成',sys:'—',type:'add',val:'✓'});}
    else{if(pv!==sv)pendingDiffs.push({code:c.c,name:c.n,pdf:pv,sys:sv||'—',type:sv?'diff':'add',val:pv});}
  });
  let h=`<div class="notice n-info" style="margin-top:10px">识别为：<strong>${type==='report'?'成绩单 Report':type==='structure'?'Course Structure':'未知格式'}</strong>${pdfSid?` · 学号 ${pdfSid}`:''}${pdfName?` · ${pdfName}`:''}</div>`;
  if(latestGPA&&student){
    h+=`<div class="notice n-${gpaClass(latestGPA)==='ok'?'ok':'amber'}" style="margin-top:6px">GPA: <strong>${latestGPA}</strong> ${gpaLabel(latestGPA)||'正常'}
      <button style="float:right;padding:2px 8px;border-radius:4px;border:1px solid currentColor;background:transparent;cursor:pointer;font-size:11px" onclick="applyGPA('${student.id}',${latestGPA},'${now}')">写入</button></div>`;
  }
  if(!student){h+=`<div class="notice n-amber" style="margin-top:6px">请先在上方选择对应学生</div>`;}
  else if(!pendingDiffs.length){h+=`<div class="notice n-ok" style="margin-top:6px">✓ 与系统记录一致，无需更新</div>`;}
  else{
    h+=`<div class="notice n-amber" style="margin-top:6px">发现 ${pendingDiffs.length} 门课程可更新</div><div class="diff-list">`;
    pendingDiffs.forEach((d,i)=>{h+=`<div class="ditem ${d.type==='add'?'di-add':'di-diff'}"><span class="dc2">${d.code}</span><span class="dn2">${d.name}</span><span class="dpv">${d.pdf}</span><span style="font-size:10px;color:var(--ink3)">${d.sys}</span><button class="di-apply" onclick="applyOne(${i})">写入</button></div>`;});
    h+='</div>';
    document.getElementById('apply-all').style.display='';
  }
  out.innerHTML=h;
}
async function applyOne(i){
  const d=pendingDiffs[i],sid=document.getElementById('pdf-stu').value;
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  if(!s.courses)s.courses={};
  s.courses[d.code]=d.pdf;pendingDiffs.splice(i,1);render();
  try{await apiSaveCourse(sid,d.code,d.pdf);}catch(e){}
  const items=document.getElementById('pdf-out').querySelectorAll('.ditem');
  if(items[i])items[i].remove();
  if(!pendingDiffs.length)document.getElementById('apply-all').style.display='none';
}
async function applyAllDiffs(){
  const sid=document.getElementById('pdf-stu').value,s=DB.students.find(x=>x.id===sid); if(!s) return;
  if(!s.courses)s.courses={};
  pendingDiffs.forEach(d=>{s.courses[d.code]=d.pdf;});
  document.getElementById('pdf-out').innerHTML='<div class="notice n-ok">✓ 写入完成，同步中...</div>';
  document.getElementById('apply-all').style.display='none';render();
  try{await apiSaveBatch([s]);}catch(e){alert('同步失败：'+e.message);}
  document.getElementById('pdf-out').innerHTML='<div class="notice n-ok">✓ 已写入 Supabase</div>';
}
async function runBatch(files){
  const out=document.getElementById('batch-out'),bar=document.getElementById('batch-bar'),status=document.getElementById('batch-status'),applyBtn=document.getElementById('batch-apply-btn');
  out.innerHTML='';
  document.getElementById('batch-progress').style.display='';
  applyBtn.style.display='none';  // 先隐藏，解析完再决定
  applyBtn.onclick=applyBatchAll; // 重置 onclick
  batchResults=[];
  window.batchSkipped=new Set();  // 每次重置略过状态
  for(let i=0;i<files.length;i++){
    bar.style.width=`${Math.round((i/files.length)*100)}%`;status.textContent=`${i+1} / ${files.length}`;
    const file=files[i];let txt='';
    try{
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const buf=await file.arrayBuffer(),pdf=await pdfjsLib.getDocument(buf).promise;
      for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p);const ct=await pg.getTextContent();txt+=ct.items.map(x=>x.str).join(' ')+' ';}
    }catch(e){batchResults.push({file:file.name,status:'error',error:e.message});continue;}
    const forcedMode=window._importMode;
    const pdfType=forcedMode==='structure'?'structure':forcedMode==='report'?'report':detectPdfType(txt);
    const{sid,name:pdfName,type:pdfStudentType,gpa:_rawGpa,gpaHistory:gpaHistArr}=extractStudentInfo(txt);
    let latestGPA=null,gpaHistoryArr=[];
    if(pdfType==='report'){const gd=parseReportGPA(txt);latestGPA=gd.gpa;gpaHistoryArr=gd.history;}else{latestGPA=_rawGpa;gpaHistoryArr=_rawGpa?[_rawGpa]:[];}
    const student=sid?DB.students.find(s=>s.id===sid):null;
    const pid=(student?.prog)||activeProg,courses=progCourses(pid);
    if(pdfType==='report'){
      console.log('[txt sample]', txt.substring(0,600).replace(/\n/g,'↵'));
    }
    const found=pdfType==='report'?parseReport(txt,courses):parseCourseStructure(txt,courses);
    console.log('[found]', sid, Object.keys(found).slice(0,5));
    const sys=student?(student.courses||{}):{};
    let diffs;
    if(pdfType==='structure'){
      diffs=courses.filter(c=>{const pv=found[c.c],sv=sys[c.c];return pv&&!sv;}).map(c=>({code:c.c,name:c.n,pdf:found[c.c],sys:'—',val:found[c.c]}));
    } else {
      // Report 模式：包含所有解析到的课程（含外系选修、通识选修）
      const codeMap={};courses.forEach(c=>codeMap[c.c]=c.n);
      diffs=Object.keys(found).filter(code=>{const pv=found[code],sv=sys[code];return pv&&pv!==sv;}).map(code=>({code,name:codeMap[code]||code,pdf:found[code],sys:sys[code]||'—',val:found[code]}));
    }
    batchResults.push({file:file.name,sid,pdfName,pdfType,pdfStudentType,student,found,diffs,latestGPA,gpaHistoryArr,status:!sid?'no-id':!student?'no-match':diffs.length||latestGPA?'has-diff':'ok'});
  }
  bar.style.width='100%';status.textContent=`完成 ${files.length} 个`;
  const ok=batchResults.filter(r=>r.status==='ok').length,hasDiff=batchResults.filter(r=>r.status==='has-diff'),noMatch=batchResults.filter(r=>r.status==='no-match'),noId=batchResults.filter(r=>r.status==='no-id'),errors=batchResults.filter(r=>r.status==='error');
  if(!window.batchSkipped) window.batchSkipped=new Set();
  window._batchFilter='all';
  let h=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0">
    <div id="bcard-ok" onclick="setBatchFilter('ok')" style="cursor:pointer;background:var(--g1);border:2px solid var(--g3);border-radius:6px;padding:10px;text-align:center;transition:all .15s"><div style="font-family:var(--mono);font-size:20px;font-weight:500;color:var(--g7)">${ok}</div><div style="font-size:10px;color:var(--ink3);margin-top:2px">无差异</div></div>
    <div id="bcard-has-diff" onclick="setBatchFilter('has-diff')" style="cursor:pointer;background:var(--amber-l);border:2px solid var(--amber-m);border-radius:6px;padding:10px;text-align:center;transition:all .15s"><div style="font-family:var(--mono);font-size:20px;font-weight:500;color:var(--amber)">${hasDiff.length}</div><div style="font-size:10px;color:var(--ink3);margin-top:2px">有差异待更新</div></div>
    <div id="bcard-no-match" onclick="setBatchFilter('no-match')" style="cursor:pointer;background:var(--sky-l);border:2px solid var(--sky-m);border-radius:6px;padding:10px;text-align:center;transition:all .15s"><div style="font-family:var(--mono);font-size:20px;font-weight:500;color:var(--sky)">${noMatch.length}</div><div style="font-size:10px;color:var(--ink3);margin-top:2px">学号未建档</div></div>
    <div id="bcard-error" onclick="setBatchFilter('error')" style="cursor:pointer;background:var(--red-l);border:2px solid var(--red-m);border-radius:6px;padding:10px;text-align:center;transition:all .15s"><div style="font-family:var(--mono);font-size:20px;font-weight:500;color:var(--red)">${errors.length+noId.length}</div><div style="font-size:10px;color:var(--ink3);margin-top:2px">无法识别</div></div>
  </div>`;
  if(noMatch.length>0){h+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--sky-l);border:1px solid var(--sky-m);border-radius:6px;margin-bottom:8px;font-size:12px;color:var(--sky)">
    <span>共 <strong id="no-match-count">${noMatch.length}</strong> 位新学生未建档</span>
    <div style="flex:1"></div>
    <button onclick="unskipAll()" style="padding:2px 10px;border-radius:4px;border:1px solid var(--sky-m);background:#fff;color:var(--sky);font-size:11px;cursor:pointer;font-family:var(--font)">↩ 全部取消略过</button>
  </div>`;}
  batchResults.forEach((r,i)=>{
    const icon=r.status==='ok'?'✓':r.status==='has-diff'?'⚠':r.status==='no-match'?'?':'✗';
    const bg=r.status==='ok'?'var(--g1)':r.status==='has-diff'?'var(--amber-l)':r.status==='no-match'?'var(--sky-l)':'var(--red-l)';
    const tc=r.status==='ok'?'var(--g7)':r.status==='has-diff'?'var(--amber)':r.status==='no-match'?'var(--sky)':'var(--red)';
    h+=`<div id="batch-row-${i}" style="background:${bg};border-radius:6px;padding:8px 12px;margin-bottom:5px;font-size:12px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-family:var(--mono);font-size:14px;color:${tc};width:16px">${icon}</span>
        <div style="flex:1"><strong>${r.student?r.student.name:(r.pdfName||r.file)}</strong><span style="font-family:var(--mono);font-size:10px;color:var(--ink3);margin-left:4px">${r.sid||'无学号'}</span>${r.latestGPA?` <span style="font-family:var(--mono);font-size:10px;color:${gpaClass(r.latestGPA)==='ok'?'var(--g7)':gpaClass(r.latestGPA)==='warn'?'var(--amber)':'var(--red)'}">GPA ${r.latestGPA}</span>`:''}</div>
        ${r.status==='has-diff'?`<span style="font-size:10px;color:var(--amber)">${r.diffs.length}处差异</span>`:''}
        ${r.status==='no-match'&&r.sid?`<span id="batch-btns-${i}"><button class="di-apply" style="font-size:10px;padding:2px 8px" onclick="quickAddStudent('${r.sid}','${(r.pdfName||'').replace(/'/g,"\\'")}',${i})">新增</button><button onclick="skipBatchRow(${i})" style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--line2);background:transparent;cursor:pointer;color:var(--ink3)">略过</button></span>`:''}
      </div>
      ${r.status==='has-diff'?`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px">${r.diffs.slice(0,5).map(d=>`<span style="font-family:var(--mono);font-size:10px;background:rgba(255,255,255,.6);padding:1px 6px;border-radius:3px">${d.code}→${d.pdf}</span>`).join('')}${r.diffs.length>5?`<span style="font-size:10px;color:var(--ink3)">+${r.diffs.length-5}...</span>`:''}</div>`:''}
    </div>`;
  });
  const totalDiffs=hasDiff.reduce((a,r)=>a+r.diffs.length,0);
  if(totalDiffs>0||hasDiff.some(r=>r.latestGPA)||noMatch.length>0){
    applyBtn.style.display='';
    const mode=window._importMode;
    if(mode==='structure'){
      applyBtn.textContent=`✓ 确认建档（${noMatch.length}位新增）`;
      applyBtn.onclick=addAllNewStudents;
    } else {
      applyBtn.textContent=`✓ 确认更新成绩（${totalDiffs}处差异）`;
      applyBtn.onclick=applyBatchAll;
    }
  }
  out.innerHTML=h;
}
function setBatchFilter(type){
  window._batchFilter=window._batchFilter===type?'all':type;
  ['ok','has-diff','no-match','error'].forEach(t=>{
    const card=document.getElementById('bcard-'+t);if(!card)return;
    const isActive=window._batchFilter===t;
    card.style.transform=isActive?'scale(1.04)':'';
    card.style.boxShadow=isActive?'0 0 0 3px rgba(0,0,0,.15)':'';
    card.style.opacity=(window._batchFilter!=='all'&&!isActive)?'0.45':'1';
  });
  batchResults.forEach((r,i)=>{
    const el=document.getElementById('batch-row-'+i);if(!el)return;
    const rowType=r.status==='error'||r.status==='no-id'?'error':r.status;
    el.style.display=(window._batchFilter==='all'||rowType===window._batchFilter)?'':'none';
  });
}
function skipBatchRow(i){
  const el=document.getElementById('batch-row-'+i);
  if(el){el.style.opacity='0.4';}
  if(!window.batchSkipped)window.batchSkipped=new Set();
  window.batchSkipped.add(i);
  // 按钮改成「取消略过」
  const btns=document.getElementById('batch-btns-'+i);
  if(btns) btns.innerHTML=`<button onclick="unskipBatchRow(${i})" style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--line2);background:#fff;cursor:pointer;color:var(--ink2)">↩ 取消略过</button>`;
  updateBatchApplyBtn();
}
function unskipBatchRow(i){
  const r=batchResults[i];
  const el=document.getElementById('batch-row-'+i);
  if(el){el.style.opacity='1';}
  if(window.batchSkipped) window.batchSkipped.delete(i);
  // 恢复按钮
  const btns=document.getElementById('batch-btns-'+i);
  if(btns&&r) btns.innerHTML=`<button class="di-apply" style="font-size:10px;padding:2px 8px" onclick="quickAddStudent('${r.sid}','${(r.pdfName||'').replace(/'/g,"\'")}',${i})">新增</button><button onclick="skipBatchRow(${i})" style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--line2);background:transparent;cursor:pointer;color:var(--ink3)">略过</button>`;
  updateBatchApplyBtn();
}
function unskipAll(){
  if(!window.batchSkipped||!window.batchSkipped.size){alert('没有已略过的学生');return;}
  const toRestore=[...window.batchSkipped];
  window.batchSkipped.clear();
  toRestore.forEach(i=>{
    const r=batchResults[i];
    const el=document.getElementById('batch-row-'+i);
    if(el) el.style.opacity='1';
    const btns=document.getElementById('batch-btns-'+i);
    if(btns&&r) btns.innerHTML=`<button class="di-apply" style="font-size:10px;padding:2px 8px" onclick="quickAddStudent('${r.sid}','${(r.pdfName||'').replace(/'/g,"\'")}',${i})">新增</button><button onclick="skipBatchRow(${i})" style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--line2);background:transparent;cursor:pointer;color:var(--ink3)">略过</button>`;
  });
  updateBatchApplyBtn();
}

function updateBatchApplyBtn(){
  const remaining=batchResults.filter((r,idx)=>r.status==='no-match'&&r.sid&&!(window.batchSkipped||new Set()).has(idx)).length;
  const btn=document.getElementById('batch-apply-btn');
  const countEl=document.getElementById('no-match-count');
  if(countEl) countEl.textContent=remaining;
  if(btn&&window._importMode==='structure'){
    if(remaining>0){btn.style.display='';btn.textContent=`✓ 确认建档（${remaining}位新增）`;}
    else btn.style.display='none';
  }
}
async function addAllNewStudents(){
  const toAdd=batchResults.filter((r,i)=>r.status==='no-match'&&r.sid&&!(window.batchSkipped||new Set()).has(i));
  if(!toAdd.length){alert('没有需要新增的学生');return;}
  const fresh=toAdd.filter(r=>!DB.students.find(s=>s.id===r.sid));
  // 检查 fresh 里有没有重复学号
  const freshIds=fresh.map(r=>r.sid);
  const dupIds=freshIds.filter((id,i)=>freshIds.indexOf(id)!==i);
  const dupMsg=dupIds.length?`\n\n⚠ 以下学号重复（只保留最后一个）：\n${[...new Set(dupIds)].join(', ')}`:'';
  if(!window.confirm(`准备新增 ${fresh.length} 位新学生。确认新增？${dupMsg}`)) return;
  // 去重：相同学号只保留最后一个
  const freshMap=new Map();
  fresh.forEach(r=>freshMap.set(r.sid,r));
  const freshUniq=[...freshMap.values()];
  const now=new Date().toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const pid=getPdfProg();
  // 확인: pdf-prog가 activeProg와 다를 경우 전환
  if(pid!==activeProg) switchProg(pid);
  const newStudents=(typeof freshUniq!=='undefined'?freshUniq:fresh).map(r=>{
    const cohort=r.sid.substring(0,2);
    const type=r.pdfStudentType||'normal';
    const s={
      id:r.sid, name:r.pdfName||r.sid,
      cohort, type, note:'', noteText:'',
      prog:pid,
      classCode:autoClassCode(cohort,type),
      status:'就读', statusDetail:{},
      courses:{}, tep:{}, counselor:{}, counselorNotes:[],
      gpa:null, gpaHistory:[]
    };
    if(r.found){
      const _pcX=new Set(progCourses(getPdfProg()).map(c=>c.c));
      Object.keys(r.found).forEach(code=>{
        if(!r.found[code]) return;
        s.courses[code]=r.found[code];
        if(!_pcX.has(code)&&code!=='KH160'&&r.found[code]!=='Transferred'){
          const cur=s.courses['ext2']||'';const curCode=cur.split('|')[0];
          if(!curCode||curCode===code) s.courses['ext2']=code+'|'+r.found[code];
        }
      });
    }
    if(r.latestGPA){s.gpa=r.latestGPA;s.gpaHistory=r.gpaHistoryArr||[r.latestGPA];s.gpaUpdated=now;}
    return s;
  });
  newStudents.forEach(s=>{
    const ei=DB.students.findIndex(x=>x.id===s.id);
    if(ei>=0) DB.students[ei]=s; else DB.students.push(s);
  });
  render();
  gpShow(`同步中 0 / ${newStudents.length}`);
  let done=0,errors=0;
  try{
    const CHUNK=50;
    for(let i=0;i<newStudents.length;i+=CHUNK){
      const chunk=newStudents.slice(i,i+CHUNK);
      await apiSaveBatch(chunk);
      done+=chunk.length;
      gpSet(`同步中 ${done} / ${newStudents.length}`,Math.round(done/newStudents.length*100));
    }
  }catch(e){
    errors=newStudents.length-done;
    console.error('建档同步失败:',e);
    gpHide();
    alert('同步失败：'+e.message+'\n\n学生已建立在本地，请点「⟳ 同步」重新上传。');
    closeModal('import-modal');
    return;
  }
  gpDone(errors?`✓ 已新增 ${done} 位，${errors} 位失败`:`✓ 已新增 ${done} 位学生`);
  closeModal('import-modal');
}
async function quickAddStudent(sid,name,idx){
  const r=batchResults[idx];if(!sid)return;
  const existing=DB.students.find(s=>s.id===sid);
  if(existing){if(!window.confirm(`⚠ 学号 ${sid} 已存在！是否覆盖更新？`))return;}
  const cohort=sid.substring(0,2);
  const now=new Date().toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const s=existing||{id:sid,name:name||sid,cohort,type:r.pdfStudentType||'normal',note:'',noteText:'',prog:getPdfProg(),courses:{},tep:{},counselor:{},counselorNotes:[],gpa:null,gpaHistory:[]};
  if(!existing&&name&&name.match(/^(Mr\.|Miss|Mrs\.|Ms\.)/i))s.name=name;
  if(r.found){
    const _pc3=new Set(progCourses(s.prog||'TM').map(c=>c.c));
    Object.keys(r.found).forEach(code=>{
      if(!r.found[code]) return;
      s.courses[code]=r.found[code];
      if(!_pc3.has(code)&&code!=='KH160'&&r.found[code]!=='Transferred'){
        const cur=s.courses['ext2']||'';
        const curCode=cur.split('|')[0];
        if(!curCode||curCode===code) s.courses['ext2']=code+'|'+r.found[code];
      }
    });
  }
  if(r.latestGPA){s.gpa=r.latestGPA;if(!s.gpaHistory)s.gpaHistory=[];if(!s.gpaHistory.includes(r.latestGPA))s.gpaHistory.push(r.latestGPA);s.gpaUpdated=now;}
  if(!existing)DB.students.push(s);render();
  try{await apiSaveBatch([s]);const el=document.getElementById('batch-row-'+idx);if(el){el.style.background='var(--g1)';el.querySelectorAll('button').forEach(b=>b.remove());}}catch(e){console.error(e);}
}
async function applyBatchAll(){
  const now=new Date().toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const toSync=[];
  const isReport=window._importMode==='report';
  console.log('[applyBatchAll] isReport='+isReport+' _importMode='+window._importMode+' total='+batchResults.length);
  batchResults.forEach(r=>{
    console.log('  >>',r.sid, 'status='+r.status, 'diffs='+r.diffs.length, 'gpa='+r.latestGPA, 'found_keys='+(r.found?Object.keys(r.found).length:0));
    if(r.diffs.length>0) console.log('     diffs:', r.diffs.slice(0,3).map(d=>d.code+'→'+d.pdf));
  });

  batchResults.forEach(r=>{
    if(r.status==='error'||r.status==='no-id') return;

    // Report 模式：未建档或已存在 → 建档或覆盖
    if(r.status==='no-match'&&r.sid&&isReport){
      const cohort=r.sid.substring(0,2);
      const existing=DB.students.find(x=>x.id===r.sid);
      const s=existing||{
        id:r.sid, name:r.pdfName||r.sid,
        cohort, type:r.pdfStudentType||'normal',
        note:'', noteText:'', prog:getPdfProg(),
        classCode:autoClassCode(cohort,r.pdfStudentType||'normal'),
        status:'就读', statusDetail:{},
        courses:{}, tep:{}, counselor:{}, counselorNotes:[],
        gpa:null, gpaHistory:[]
      };
      if(!s.courses) s.courses={};
      // 写入课程
      if(r.found){
        const _pcX=new Set(progCourses(getPdfProg()).map(c=>c.c));
        Object.keys(r.found).forEach(code=>{
          if(!r.found[code]) return;
          s.courses[code]=r.found[code];
          if(!_pcX.has(code)&&code!=='KH160'&&r.found[code]!=='Transferred'){
            const cur=s.courses['ext2']||'';const curCode=cur.split('|')[0];
            if(!curCode||curCode===code) s.courses['ext2']=code+'|'+r.found[code];
          }
        });
      }
      // 写入 GPA
      if(r.latestGPA){ if(!s.gpaHistory)s.gpaHistory=[];if(s.gpa!==r.latestGPA)s.gpaHistory.push(r.latestGPA);s.gpa=r.latestGPA;s.gpaUpdated=now; }
      if(!existing) DB.students.push(s);
      toSync.push(s);
      return;
    }

    // 已建档学生：更新课程 + GPA（Report 模式直接写入全部 found）
    if(!r.student||(!r.diffs.length&&!r.latestGPA)) return;
    const s=r.student; if(!s.courses)s.courses={};
    if(isReport&&r.found){
      const _pc2=new Set(progCourses(s.prog||'TM').map(c=>c.c));
      Object.keys(r.found).forEach(code=>{
        if(!r.found[code]) return;
        s.courses[code]=r.found[code];
        if(!_pc2.has(code)&&code!=='KH160'&&r.found[code]!=='Transferred'){
          const cur=s.courses['ext2']||'';
          const curCode=cur.split('|')[0];
          if(!curCode||curCode===code) s.courses['ext2']=code+'|'+r.found[code];
        }
      });
    } else {
      r.diffs.forEach(d=>{ s.courses[d.code]=d.val||d.pdf; });
    }
    if(r.latestGPA){
      if(!s.gpaHistory)s.gpaHistory=[];
      if(s.gpa!==r.latestGPA)s.gpaHistory.push(r.latestGPA);
      s.gpa=r.latestGPA; s.gpaUpdated=now;
    }
    toSync.push(s);
  });

  if(!toSync.length){alert('没有需要更新的资料');return;}
  render();
  gpShow(`正在同步 ${toSync.length} 位学生...`);
  const outEl=document.getElementById('batch-out');
  outEl.insertAdjacentHTML('afterbegin',`<div class="notice n-info" id="sync-progress2" style="margin-bottom:8px">正在同步 ${toSync.length} 位学生（批次上传）...</div>`);
  let done=0,errors=0;
  try{
    // 批次一次全发（最多50个一批）
    const CHUNK=50;
    for(let i=0;i<toSync.length;i+=CHUNK){
      const chunk=toSync.slice(i,i+CHUNK);
      await apiSaveBatch(chunk);
      done+=chunk.length;
      gpSet(`同步中 ${done} / ${toSync.length}`,Math.round(done/toSync.length*100));
    }
  }catch(e){errors=toSync.length-done;console.error(e);}
  gpDone(`✓ 已更新 ${done} 位学生`);
  const prog=document.getElementById('sync-progress2');
  if(prog){prog.className=errors?'notice n-amber':'notice n-ok';prog.textContent=errors?`✓ 更新 ${done} 位，${errors} 位失败`:`✓ 已成功更新 ${done} 位学生`;}
  document.getElementById('batch-apply-btn').style.display='none';
}

// ── Program management ─────────────────────────────────
function openAddProg(){
  document.getElementById('pm-name').value='';document.getElementById('pm-cr').value='123';document.getElementById('pm-preview').innerHTML='';
  pendingProgCourses=[];window._allProgCourses=null;
  const tmBtn=document.getElementById('tm-builtin-btn');if(tmBtn)tmBtn.style.display='none';
  const nameEl=document.getElementById('pm-name');
  if(nameEl)nameEl.oninput=()=>{const isTM=/tourism|旅游/i.test(nameEl.value);if(tmBtn)tmBtn.style.display=isTM?'':'none';};
  openModal('prog-modal');
}
function useTMBuiltin(){
  document.getElementById('pm-name').value=document.getElementById('pm-name').value||'Tourism Management 旅游管理';
  document.getElementById('pm-cr').value='123';
  renderProgSelector(getBuiltinTMCourses());
}
async function handleProgPdfFile(inp){
  if(!inp.files[0])return;
  const prev=document.getElementById('pm-preview');prev.innerHTML='<div style="font-size:12px;color:var(--ink3);padding:8px">解析中...</div>';pendingProgCourses=[];
  try{
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf=await inp.files[0].arrayBuffer(),pdf=await pdfjsLib.getDocument(buf).promise;
    let txt='';for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const ct=await pg.getTextContent();txt+=ct.items.map(x=>x.str).join(' ')+' ';}
    const nameInput=document.getElementById('pm-name');if(!nameInput.value.trim()){const m=txt.match(/Program in ([A-Za-z ]+?)(?:\s+Student|\s+Bachelor|\s+\d)/i);if(m)nameInput.value=m[1].trim();}
    const crM=txt.match(/(\d{3})\s*[Cc]redits/);if(crM){const ci=document.getElementById('pm-cr');if(ci)ci.value=crM[1];}
    const isTM=/Tourism Management/i.test(txt)&&/Course Structure/i.test(txt);
    const allCourses=isTM?getBuiltinTMCourses():extractCourseList(txt);
    if(!allCourses.length){prev.innerHTML='<div class="notice n-warn">未能识别课程</div>';return;}
    renderProgSelector(allCourses);
  }catch(err){document.getElementById('pm-preview').innerHTML=`<div class="notice n-warn">解析失败：${err.message}</div>`;}
}
function renderProgSelector(allCourses){
  const prev=document.getElementById('pm-preview');
  const groups={};allCourses.forEach(c=>{if(!groups[c.g])groups[c.g]=[];groups[c.g].push(c);});
  const AUTO_CHECK=new Set(['通识课·必修','基础专业课','专业必修','专业核心课','旅游专业·必修','旅游专业·选修','实习课程','Capstone']);
  let h=`<div style="font-size:12px;color:#374151;margin-bottom:8px;padding:6px 8px;background:#f0fdf4;border-radius:6px;border:1px solid #86efac">识别到 <strong>${allCourses.length}</strong> 门课程 <span style="float:right"><button onclick="checkAllProg(true)" style="border:none;background:none;color:#16a34a;cursor:pointer;font-size:11px;font-family:var(--font)">全选</button><button onclick="checkAllProg(false)" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:11px;font-family:var(--font)">全不选</button></span></div><div style="max-height:340px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px">`;
  Object.entries(groups).forEach(([g,courses])=>{
    const ac=AUTO_CHECK.has(g);
    h+=`<div style="background:#f9fafb;padding:5px 10px;font-size:11px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:1"><label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" ${ac?'checked':''} onchange="toggleProgGroup('${g}',this.checked)" style="width:13px;height:13px"><span>${g}</span></label><span style="font-weight:400;color:#9ca3af;margin-left:auto">${courses.length}门 · ${courses.reduce((a,c)=>a+c.cr,0)}cr</span></div>`;
    courses.forEach(c=>{h+=`<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;border-bottom:1px solid #f3f4f6;background:#fff;font-size:11px" class="prog-row" data-group="${g}"><input type="checkbox" id="pc-${c.c}" ${ac?'checked':''} value="${c.c}" onchange="updateProgCount()" style="width:12px;height:12px;flex-shrink:0"><label for="pc-${c.c}" style="font-family:var(--mono);font-size:10px;color:#374151;font-weight:600;width:52px;flex-shrink:0;cursor:pointer">${c.c}</label><label for="pc-${c.c}" style="flex:1;color:#4b5563;cursor:pointer">${c.n}</label><span style="color:#9ca3af;flex-shrink:0">${c.cr}cr</span></div>`;});
  });
  h+=`</div><div style="margin-top:8px;font-size:11px;color:#6b7280">已选 <strong id="prog-count">0</strong> 门课程</div>`;
  prev.innerHTML=h;window._allProgCourses=allCourses;updateProgCount();
}
function toggleProgGroup(g,checked){document.querySelectorAll(`.prog-row[data-group="${g}"] input[type=checkbox]`).forEach(el=>{el.checked=checked;});updateProgCount();}
function checkAllProg(checked){document.querySelectorAll('#pm-preview input[type=checkbox]').forEach(el=>{el.checked=checked;});updateProgCount();}
function updateProgCount(){const checked=[...document.querySelectorAll('#pm-preview input[id^="pc-"]:checked')];const count=document.getElementById('prog-count');if(count)count.textContent=checked.length;const allCourses=window._allProgCourses||[];const checkedCodes=new Set(checked.map(el=>el.value));pendingProgCourses=allCourses.filter(c=>checkedCodes.has(c.c));}
// ── 课程架构编辑器 ────────────────────────────────────────
let _peData=[]; // 编辑中的课程列表
let _peGroupMeta={}; // 分组元数据 {type, required_cr}

function openProgEdit(){
  const prog=getProg(activeProg);if(!prog)return;
  document.getElementById('pe-title').textContent='编辑课程架构 · '+prog.name;
  document.getElementById('pe-sub').textContent=prog.courses?.length+'门课程 · '+prog.totalCr+'学分';
  document.getElementById('pe-name').value=prog.name;
  document.getElementById('pe-cr').value=prog.totalCr||123;
  _peData=JSON.parse(JSON.stringify(prog.courses||[]));
  // 从课程数据里提取分组元数据
  _peGroupMeta={};
  const _seen=new Set();
  _peData.forEach(c=>{
    if(!_seen.has(c.g)){
      _seen.add(c.g);
      _peGroupMeta[c.g]={type:c._gtype||'required',required_cr:c._gcr||0};
    }
  });
  peRender();
  openModal('prog-edit-modal');
}

function peRender(){
  const el=document.getElementById('pe-courses');
  const count=document.getElementById('pe-count');
  if(count){
    // ── 按规则计算「有效应到学分」和「达标门数」────────────────
    // 规则：必修全计；选修组只算 required_cr 上限；skip 不计；实习另算
    const INTERN_SET=new Set(['KT411','KT331','KT332']);
    const groups={};
    _peData.forEach(c=>{ if(!groups[c.g])groups[c.g]=[];groups[c.g].push(c); });
    let effCr=0, effC=0, internCr=0;
    Object.entries(groups).forEach(([g,cs])=>{
      const meta=_peGroupMeta[g]||{};
      const gtype=meta.type||'required';
      const reqCr=parseInt(meta.required_cr)||0;
      if(gtype==='skip'){
        // 实习组单独统计（固定 6 学分，不计入 38 课）
        cs.forEach(c=>{if(INTERN_SET.has(c.c))internCr=6;});
        return;
      }
      if(gtype==='elective'){
        // 选修：只计上限学分，门数按学分推算
        const cap=reqCr>0?reqCr:cs.reduce((s,c)=>s+(parseInt(c.cr)||0),0);
        const avgCr=cs.length>0?(cs.reduce((s,c)=>s+(parseInt(c.cr)||0),0)/cs.length):3;
        effCr+=cap;
        effC+=Math.round(cap/(avgCr||3));
      } else {
        // 必修：全部计入
        cs.forEach(c=>{ effCr+=(parseInt(c.cr)||0); effC++; });
      }
    });
    const _inputCr=parseInt(document.getElementById('pe-cr')?.value)||0;
    const crOk=_inputCr===(effCr+internCr);
    count.innerHTML=`
      <span style="color:var(--ink2)">达标需</span>
      <strong style="color:var(--g8)">${effC}</strong><span style="color:var(--ink3)">门课</span>
      <span style="color:var(--line2);margin:0 4px">+</span>
      <strong style="color:var(--g7)">${effCr}</strong><span style="color:var(--ink3)">学分</span>
      <span style="color:var(--line2);margin:0 4px">+</span>
      <span style="color:var(--ink3)">实习 ${internCr}学分</span>
      <span style="color:var(--line2);margin:0 6px">·</span>
      <span style="color:var(--ink3)">档案共 ${_peData.length} 门</span>
      <span style="color:var(--line2);margin:0 4px">·</span>
      总学分设定 <strong style="color:${crOk?'var(--g6)':'#dc2626'}">${_inputCr}</strong>
      ${crOk?'✅':'<span style="color:#dc2626">⚠ 应为 '+(effCr+internCr)+'</span>'}
      <button onclick="document.getElementById('pe-cr').value=${effCr+internCr};peRender()"
        style="padding:1px 7px;border:1px solid var(--line2);border-radius:4px;background:#fff;font-size:10px;cursor:pointer;font-family:var(--font);margin-left:4px;">🔄 自动填入</button>`;
  }
  if(!_peData.length){
    el.innerHTML='<div style="padding:24px;text-align:center;color:var(--ink3);font-size:12px">暂无课程，点「+ 新增课程」添加</div>';
    return;
  }
  // 按分组
  const groups={};
  _peData.forEach((c,i)=>{
    const g=c.g||'未分组';
    if(!groups[g]) groups[g]=[];
    groups[g].push({...c,_idx:i});
  });
  const _groupKeys=Object.keys(groups);
  el.innerHTML=_groupKeys.map((g,gi)=>{
    const courses2=groups[g];
    const _gm=_peGroupMeta[g]||{};
    const _gtype=_gm.type||'required';
    const _gcr=_gm.required_cr||0;
    const _gTotal=courses2.reduce((s,c)=>s+(parseInt(c.cr)||0),0);
    const _gi=gi; // group index
    return `<div style="border-bottom:1px solid var(--line);">
      <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--g8);">
        <input value="${g}" data-gi="${_gi}" onchange="peRenameGroup(this.dataset.gi,this.value)"
          style="background:transparent;border:none;color:#e4f0e8;font-size:12px;font-weight:600;font-family:var(--font);width:150px;outline:none;" title="点击编辑分组名称">
        <select data-gi="${_gi}" onchange="peSetGroupType(this.dataset.gi,this.value)" style="padding:1px 5px;border-radius:4px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#e4f0e8;font-size:10px;font-family:var(--font);">
          <option value="required" ${_gtype==='required'?'selected':''}>必修</option>
          <option value="elective" ${_gtype==='elective'?'selected':''}>选修</option>
          <option value="skip" ${_gtype==='skip'?'selected':''}>不计学分</option>
        </select>
        ${_gtype==='elective'?`
          <span style="color:rgba(255,255,255,.5);font-size:10px">需满足</span>
          <input type="number" min="0" value="${_gcr}" data-gi="${_gi}"
            onchange="peSetGroupCr(this.dataset.gi,parseInt(this.value)||0)"
            style="width:34px;padding:1px 4px;border-radius:4px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.15);color:#fff;font-size:10px;text-align:center;">
          <span style="color:rgba(255,255,255,.5);font-size:10px">/ ${_gTotal} 学分可选</span>
        `:`<span style="color:rgba(255,255,255,.4);font-size:10px">${_gtype==='skip'?'不计':'共 '+_gTotal+' 学分'}</span>`}
        <div style="flex:1"></div>
        <button data-gi="${_gi}" onclick="peAddCourseToGroupByIdx(this.dataset.gi)" style="padding:1px 8px;border:1px solid rgba(255,255,255,.3);border-radius:4px;background:transparent;color:#e4f0e8;font-size:10px;cursor:pointer;">+ 课程</button>
      </div>
      ${courses2.map(c=>`
        <div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:0.5px solid var(--line2);">
          <input value="${c.c}" onchange="peUpdateField(${c._idx},'c',this.value)"
            style="width:80px;font-family:var(--mono);font-size:11px;font-weight:600;color:var(--sky);border:1px solid transparent;border-radius:4px;padding:2px 5px;background:var(--sky-l);"
            onfocus="this.style.borderColor='var(--sky)'" onblur="this.style.borderColor='transparent'" title="课程代码">
          <input value="${c.n||''}" onchange="peUpdateField(${c._idx},'n',this.value)"
            style="flex:1;font-size:11px;border:1px solid transparent;border-radius:4px;padding:2px 5px;"
            onfocus="this.style.borderColor='var(--line2)';this.style.background='#fff'" onblur="this.style.borderColor='transparent';this.style.background=''" 
            placeholder="课程名称">
          <input type="number" value="${c.cr||3}" min="1" max="9" onchange="peUpdateField(${c._idx},'cr',parseInt(this.value)||3)"
            style="width:36px;text-align:center;font-size:11px;border:1px solid var(--line2);border-radius:4px;padding:2px 4px;" title="学分">
          <button onclick="peDeleteCourse(${c._idx})" style="padding:1px 6px;border:1px solid #fca5a5;border-radius:4px;background:#fff;color:#dc2626;font-size:11px;cursor:pointer;">✕</button>
        </div>
      `).join('')}
    </div>`;
  }).join('');
}

function peSetGroupType(gi,type){
  const groupKeys=[...new Set(_peData.map(c=>c.g))];
  const g=groupKeys[parseInt(gi)];if(!g)return;
  if(!_peGroupMeta[g])_peGroupMeta[g]={};
  _peGroupMeta[g].type=type;
  peRender();
}
function peSetGroupCr(gi,cr){
  const groupKeys=[...new Set(_peData.map(c=>c.g))];
  const g=groupKeys[parseInt(gi)];if(!g)return;
  if(!_peGroupMeta[g])_peGroupMeta[g]={};
  _peGroupMeta[g].required_cr=cr;
  // 不重新 render，避免输入框焦点丢失
}
function peAddCourseToGroupByIdx(gi){
  const groupKeys=[...new Set(_peData.map(c=>c.g))];
  const g=groupKeys[parseInt(gi)];if(!g)return;
  peAddCourseToGroup(g);
}
function peUpdateField(idx,field,val){_peData[idx][field]=val;const count=document.getElementById('pe-count');if(count)count.textContent=_peData.length+'门课程';}
function peDeleteCourse(idx){if(!confirm('删除这门课程？'))return;_peData.splice(idx,1);peRender();}
function peRenameGroup(gi,newG){
  if(!newG.trim()) return;
  const groupKeys=[...new Set(_peData.map(c=>c.g))];
  const oldG=groupKeys[parseInt(gi)];
  if(!oldG) return;
  const trimNew=newG.trim();
  _peData.forEach(c=>{if(c.g===oldG)c.g=trimNew;});
  if(_peGroupMeta[oldG]){_peGroupMeta[trimNew]=_peGroupMeta[oldG];delete _peGroupMeta[oldG];}
  peRender();
}
function peAddGroup(){
  const g=prompt('新分组名称：');if(!g)return;
  _peData.push({c:'NEW001',n:'新课程',cr:3,g:g.trim()});peRender();
}
function peAddCourseToGroup(g){
  _peData.push({c:'',n:'',cr:3,g});peRender();
}
function peAddCourse(){
  const groups=[...new Set(_peData.map(c=>c.g||'未分组'))];
  const g=groups.length?groups[groups.length-1]:'未分组';
  _peData.push({c:'',n:'',cr:3,g});peRender();
}
function peCopyFrom(){
  const others=DB.programs.filter(p=>p.id!==activeProg&&p.courses?.length);
  if(!others.length){alert('没有其他专业可复制');return;}
  const names=others.map((p,i)=>`${i+1}. ${p.name}（${p.courses.length}门）`).join('\n');
  const ans=prompt('从哪个专业复制课程架构？\n\n'+names+'\n\n输入序号：');
  const idx=parseInt(ans)-1;
  if(isNaN(idx)||!others[idx])return;
  if(!confirm(`确认从「${others[idx].name}」复制 ${others[idx].courses.length} 门课程？\n（会覆盖当前编辑内容）`))return;
  _peData=JSON.parse(JSON.stringify(others[idx].courses));
  peRender();
}
async function peDeleteProg(){
  const prog=getProg(activeProg);if(!prog)return;
  if(DB.programs.length<=1){alert('至少保留一个专业，无法删除');return;}
  const studCount=DB.students.filter(s=>(s.prog||'TM')===activeProg).length;
  if(!confirm(`确认删除专业「${prog.name}」？${studCount>0?`\n\n⚠ 有 ${studCount} 位学生属于此专业，删除后学生记录不受影响。`:''}`)) return;
  DB.programs=DB.programs.filter(p=>p.id!==activeProg);
  activeProg=DB.programs[0]?.id||'TM';
  closeModal('prog-edit-modal');
  render();
  try{
    await apiDeleteProgram(prog.id);
    alert(`✅ 专业「${prog.name}」已删除`);
  }catch(e){alert('⚠ Supabase 删除失败：'+e.message);}
}

async function peConfirm(){
  const prog=getProg(activeProg);if(!prog)return;
  const name=document.getElementById('pe-name').value.trim();
  const cr=parseInt(document.getElementById('pe-cr').value)||123;
  if(!name){alert('请填写专业名称');return;}
  // 把分组元数据写入课程
  _peData.forEach(c=>{
    const meta=_peGroupMeta[c.g]||{};
    c._gtype=meta.type||'required';
    c._gcr=meta.required_cr||0;
  });
  const valid=_peData.filter(c=>c.c.trim()&&c.n.trim());
  if(valid.length<_peData.length){if(!confirm(`有 ${_peData.length-valid.length} 门课程代码或名称为空，将被忽略。确认储存？`))return;}
  prog.name=name;prog.totalCr=cr;prog.courses=valid;
  render();
  closeModal('prog-edit-modal');
  try{
    await apiSaveProgram(prog);
    alert(`✅ 课程架构已储存！\n${valid.length}门课程 · ${cr}学分`);
  }catch(e){alert('⚠ 储存到 Supabase 失败：'+e.message);}
}

function editProgName(){openProgEdit();}
async function confirmAddProg(){
  const name=document.getElementById('pm-name').value.trim(),cr=parseInt(document.getElementById('pm-cr').value)||123;
  const preCohorts=(document.getElementById('pm-precohorts')?.value||'').split(/[,\n]/).map(s=>s.trim().toUpperCase()).filter(Boolean);
  if(!name){alert('请填写专业名称');return;}
  if(window._allProgCourses)updateProgCount();
  if(!pendingProgCourses.length){alert('请先选择至少一门课程');return;}
  const idInput=(document.getElementById('pm-id')?.value||'').trim().toUpperCase();
  const id=idInput||String(name).replace(/[^A-Za-z0-9]/g,'').substring(0,20)||'P'+Date.now();
  const prog={id,name,totalCr:cr,courses:pendingProgCourses};
  if(DB.programs.find(p=>p.id===id)){
    if(!confirm(`专业 ID「${id}」已存在（${DB.programs.find(p=>p.id===id).name}），是否覆盖？`)) return;
    const i=DB.programs.findIndex(p=>p.id===id);DB.programs[i]=prog;
  }else{DB.programs.push(prog);}
  closeModal('prog-modal');render();
  try{await apiSaveProgram(prog);}catch(e){}
  alert(`专业「${name}」已新增（${pendingProgCourses.length}门课程 · ${cr}学分）`);
  window._allProgCourses=null;
}

// ── Modal ──────────────────────────────────────────────
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.overlay').forEach(el=>el.addEventListener('click',function(e){if(e.target===this)closeModal(this.id);}));
document.addEventListener('keydown',function(e){
  if(e.key!=='Enter')return;
  if(e.target.tagName==='TEXTAREA')return;
  const open=document.querySelector('.overlay.open');if(!open)return;
  const id=open.id;
  if(id==='cell-modal'){e.preventDefault();confirmCell();}
  else if(id==='tep-modal'){e.preventDefault();confirmTep();}
  else if(id==='add-modal'){e.preventDefault();confirmAdd();}
});

// ── Built-in TM course list ────────────────────────────
function getBuiltinTMCourses(){return[
  {c:'KG131',n:'Critical and Innovative Mindset',cr:3,g:'通识课·必修'},
  {c:'KG145',n:'Eastern and Western Views and Values',cr:3,g:'价值论理-必修'},
  {c:'KG151',n:'Healthy and Happy Life',cr:3,g:'生活质量-必修'},
  {c:'KG155',n:'ASEAN and Cross-culture Communication',cr:3,g:'语言与跨文化'},
  {c:'LA130',n:'Fundamental English',cr:3,g:'语言与跨文化'},
  {c:'LA131',n:'English for Communication 1',cr:3,g:'语言与跨文化'},
  {c:'LA132',n:'English for Communication 2',cr:3,g:'语言与跨文化'},
  {c:'KG132',n:'Information and Data Management',cr:3,g:'终身学习-选修'},
  {c:'KG133',n:'Business Mind and Start-up Thinking',cr:3,g:'终身学习-选修'},
  {c:'KG134',n:'International Politics and Global Issue',cr:3,g:'终身学习-选修'},
  {c:'KG135',n:'Critical Views of World Civilization',cr:3,g:'终身学习-选修'},
  {c:'KG146',n:'Modern Citizens and Public Mind',cr:3,g:'价值论理-选修'},
  {c:'KG147',n:'Art Masterpieces',cr:3,g:'价值论理-选修'},
  {c:'KG148',n:'Information Security in Modern Business',cr:3,g:'价值论理-选修'},
  {c:'KG154',n:'Mathematics and Sciences in Business and Daily Life',cr:3,g:'生活质量-选修'},
  {c:'KG156',n:'Technology, Environment and Quality of Life',cr:3,g:'生活质量-选修'},
  {c:'KG157',n:'Technology Competence in Digital Era',cr:3,g:'生活质量-选修'},
  {c:'KB216',n:'Organization and Strategic Management',cr:3,g:'基础专业课'},
  {c:'KB217',n:'Operation, Logistics and Supply Chain Management',cr:3,g:'基础专业课'},
  {c:'KB218',n:'Principles of Marketing and Marketing Innovation',cr:3,g:'基础专业课'},
  {c:'KB219',n:'Quantitative Analysis and Business Statistics',cr:3,g:'基础专业课'},
  {c:'KB220',n:'Business Finance',cr:3,g:'基础专业课'},
  {c:'KB221',n:'Business Economics',cr:3,g:'基础专业课'},
  {c:'KB222',n:'Accounting for Business',cr:3,g:'基础专业课'},
  {c:'KB223',n:'Law and Ethics for Business Operation',cr:3,g:'基础专业课'},
  {c:'KT305',n:'Travel Business Management',cr:3,g:'旅游专业·必修'},
  {c:'KT311',n:'Tourist Behavior',cr:3,g:'旅游专业·必修'},
  {c:'KT316',n:'Introduction to Tourism Industry',cr:3,g:'旅游专业·必修'},
  {c:'KT319',n:'Tourism Information System',cr:3,g:'旅游专业·必修'},
  {c:'KT322',n:'Logistics Management for Tourism Industry',cr:3,g:'旅游专业·必修'},
  {c:'KT327',n:'Resort & Hotel Management',cr:3,g:'旅游专业·必修'},
  {c:'KT328',n:'Sustainable Tourism Management',cr:3,g:'旅游专业·必修'},
  {c:'KT329',n:'English for Tourism',cr:3,g:'旅游专业·必修'},
  {c:'KT330',n:'Digital Operations for Tourism',cr:3,g:'旅游专业·必修'},
  {c:'KT333',n:'Creative and Cultural Tourism',cr:3,g:'旅游专业·必修'},
  {c:'KT363',n:'Food and Beverage Operations Management',cr:3,g:'旅游专业·必修'},
  {c:'KT364',n:'MICE Management',cr:3,g:'旅游专业·必修'},
  {c:'KT412',n:'Capstone Business Project in Tourism Management',cr:6,g:'Capstone'},
  {c:'KT331',n:'Special Topics in Tourism Management',cr:3,g:'实习课程'},
  {c:'KT332',n:'Career Preparation',cr:3,g:'实习课程'},
  {c:'KT411',n:'Co-operative Education',cr:6,g:'实习课程'},
  {c:'KE311',n:'English for Hospitality',cr:3,g:'语言修选'},
  {c:'KE316',n:'Basic Writing for Tourism',cr:3,g:'语言修选'},
  {c:'KE325',n:'Basic Reading Skills',cr:3,g:'语言修选'},
  {c:'KE327',n:'English Conversation',cr:3,g:'语言修选'},
  {c:'KE333',n:'Reading in Business',cr:3,g:'语言修选'},
  {c:'KH351',n:'Communicative Thai 1',cr:3,g:'语言修选'},
  {c:'KH352',n:'Communicative Thai 2',cr:3,g:'语言修选'},
  {c:'KH353',n:'Communicative Thai 3',cr:3,g:'语言修选'},
  {c:'KH354',n:'Communicative Thai 4',cr:3,g:'语言修选'},
  {c:'KH355',n:'Communicative Thai 5',cr:3,g:'语言修选'},
  {c:'KH160',n:'Communication Skills in Thai for Non-Native Speakers',cr:3,g:'外系选修-1'},
];}

// ── Sem + ClassTable ─────────────────────────────────────
function openSemSetting(){
  const val=window.prompt('设定当前学期（例：2568/2）：',NOW_SEM);
  if(!val||!val.trim())return;
  NOW_SEM=val.trim();localStorage.setItem('now_sem',NOW_SEM);
  const lbl=document.getElementById('now-sem-label');if(lbl)lbl.textContent=NOW_SEM;
  render();
}
function renderClassTable(){
  const page=document.getElementById('classtable-page');if(!page)return;
  const progStuds=DB.students.filter(s=>(s.prog||'TM')===activeProg);
  const _ctProg=getProg(activeProg);
  const _preClassCodes=_ctProg?.preCohorts||[];
  const codes=[...new Set([...progStuds.map(s=>s.classCode||autoClassCode(s.cohort,s.type)),..._preClassCodes].filter(Boolean))].sort();
  const selClass=window._ctClass||'all';  // 默认全部班级
  const selSem=window._ctSem||NOW_SEM;
  if(!window._ctSem)window._ctSem=NOW_SEM;
  // 全部班级 or 指定班级
  const studs=selClass==='all'?progStuds:progStuds.filter(s=>(s.classCode||autoClassCode(s.cohort,s.type))===selClass);
  const allPC=progCourses(activeProg).length?progCourses(activeProg):(getProg(activeProg)?.courses||getBuiltinTMCourses());
  const courseMap={};allPC.forEach(c=>courseMap[c.c]=c);
  const semCodes=new Set();
  studs.forEach(s=>{
    Object.entries(s.courses||{}).forEach(([code,sem])=>{
      if(code==='ext2'){
        // ext2 格式：代码|学期 或 只有学期
        const parts=sem.split('|');
        const extSem=parts.length>1?parts[1]:parts[0];
        const extCode=parts.length>1?parts[0]:'ext2';
        if(extSem===selSem&&extCode) semCodes.add('ext2:'+extCode);
      } else if(sem===selSem){
        semCodes.add(code);
      }
    });
  });
  const allSems=new Set();
  progStuds.forEach(s=>{Object.values(s.courses||{}).forEach(v=>{if(v&&v!=='Transferred'&&/^25\d\d\/[123]$/.test(v))allSems.add(v);});});
  // 自动补全：从最早的学期到 NOW_SEM 之间的所有学期都显示
  const _nowM=NOW_SEM.match(/^(25\d\d)\/(\d)$/);
  if(_nowM){
    const _ny=parseInt(_nowM[1]),_ns=parseInt(_nowM[2]);
    const _minY=allSems.size?Math.min(...[...allSems].map(s=>parseInt(s.split('/')[0]))):_ny;
    for(let y=_minY;y<=_ny;y++){
      const maxS=(y===_ny)?_ns:3;
      for(let s=1;s<=maxS;s++) allSems.add(y+'/'+s);
    }
  }
  const semOpts=[...allSems].filter(s=>s!==NOW_SEM).sort((a,b)=>{
    const [ya,sa]=a.split('/');const [yb,sb]=b.split('/');
    return ya!==yb?parseInt(ya)-parseInt(yb):parseInt(sa)-parseInt(sb);
  });
  let h=`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);margin-bottom:14px;min-height:36px;">
    <span style="font-size:11px;color:var(--ink3);font-family:var(--mono);">班级课表 · 按学期查看</span>
    <span style="width:1px;height:14px;background:var(--line2);margin:0 4px;flex-shrink:0;"></span>
    <select onchange="window._ctClass=this.value;window._ctClass2='';renderClassTable()" style="padding:2px 7px;border:1px solid var(--line2);border-radius:5px;background:var(--card);color:var(--ink);font-family:var(--mono);font-size:11px;cursor:pointer;height:24px;"><option value="all" ${selClass==='all'?'selected':''}>全部班级</option>${codes.map(c=>`<option value="${c}" ${c===selClass?'selected':''}>${c}</option>`).join('')}</select>
    <select onchange="window._ctSem=this.value;window._ctClass2='';renderClassTable()" style="padding:2px 7px;border:1px solid var(--line2);border-radius:5px;background:var(--card);color:var(--ink);font-family:var(--mono);font-size:11px;cursor:pointer;height:24px;">
      <option value="${NOW_SEM}" ${selSem===NOW_SEM?'selected':''}>📅 ${NOW_SEM}（当前）</option>
      ${(()=>{
        const opts=semOpts.filter(s=>s!==NOW_SEM);
        const byYear={};
        opts.forEach(s=>{const y=s.split('/')[0];if(!byYear[y])byYear[y]=[];byYear[y].push(s);});
        return Object.keys(byYear).sort((a,b)=>parseInt(a)-parseInt(b)).map(yr=>{
          return '<optgroup label="── '+yr+' ──">'+
            byYear[yr].sort((a,b)=>parseInt(a.split('/')[1])-parseInt(b.split('/')[1])).map(s=>
              `<option value="${s}" ${s===selSem?'selected':''}>${s}</option>`
            ).join('')+
          '</optgroup>';
        }).join('');
      })()}
    </select>
    <div style="flex:1;"></div>
  </div>`;
  if(!codes.length){h+='<p style="color:var(--ink3)">尚无班级代码</p>';page.innerHTML=h;return;}
  if(!semCodes.size){h+=`<div style="text-align:center;padding:40px;color:var(--ink3)">📭 ${selClass==="all"?"全部班级":selClass} · ${selSem} 无排课记录</div>`;page.innerHTML=h;return;}
  const totalCr=[...semCodes].reduce((a,c)=>{const x=courseMap[c];return a+(x?x.cr:0);},0);
  // 排序状态
  if(!window._ctSort) window._ctSort={key:'code',dir:1};
  const _sort=window._ctSort;
  // 班级筛选（修课班级）
  const _selClass2=window._ctClass2||'';
  const allClassCodes=[...new Set(studs.map(s=>s.classCode||autoClassCode(s.cohort,s.type)))].sort();

  // 真实上课人数（有修该学期任何课的学生）
  const _activeStuds=studs.filter(s=>Object.values(s.courses||{}).some(v=>v===selSem));
  h+=`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:8px 12px;background:var(--paper);border:0.5px solid var(--line);border-radius:8px;">
    <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--g8)">${semCodes.size}</span><span style="font-size:11px;color:var(--ink3)">门课</span>
    <span style="color:var(--line2);font-size:12px">·</span>
    <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--sky)">${totalCr}</span><span style="font-size:11px;color:var(--ink3)">学分</span>
    <span style="color:var(--line2);font-size:12px">·</span>
    <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--g7)">${_activeStuds.length}</span><span style="font-size:11px;color:var(--ink3)">位上课学生</span>
    <div style="flex:1"></div>
    ${(()=>{
      const allCC=[...new Set(studs.flatMap(s=>Object.entries(s.courses||{}).filter(([,v])=>v===selSem).map(()=>s.classCode||autoClassCode(s.cohort,s.type))))].sort();
      const _selCC=window._ctClass2||'';
      return allCC.map(cc=>{
        const pal=getClassColor(cc);
        const isActive=_selCC===cc;
        return `<span onclick="window._ctClass2=(window._ctClass2==='${cc}'?'':('${cc}'));renderClassTable()" style="font-family:var(--mono);font-size:10px;font-weight:600;color:${pal.fg};background:${isActive?pal.bd:pal.bg};border:${isActive?'1.5px':'0.5px'} solid ${pal.bd};padding:2px 8px;border-radius:20px;cursor:pointer;transition:all .12s;user-select:none;" title="${isActive?'取消筛选':'只看 '+cc}">${cc}</span>`;
      }).join('');
    })()}
  </div>`;
  h+=`<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:13px">
  <thead><tr style="background:var(--g8)">
    <th style="padding:8px 10px;width:36px;text-align:center;color:#e4f0e8;font-size:11px">#</th>
    <th style="padding:8px 10px;width:110px;color:#e4f0e8;font-size:11px;cursor:pointer;user-select:none" onclick="window._ctSort={key:'code',dir:window._ctSort?.key==='code'?-window._ctSort.dir:1};renderClassTable()">
      课程代码 ${_sort.key==='code'?(_sort.dir>0?'▲':'▼'):'⇅'}
    </th>
    <th style="padding:8px 10px;color:#e4f0e8;font-size:11px">课程名称</th>
    <th style="padding:8px 10px;width:46px;text-align:center;color:#e4f0e8;font-size:11px">学分</th>
    <th style="padding:8px 10px;width:130px;color:#e4f0e8;font-size:11px">修课班级</th>
    <th style="padding:8px 10px;width:60px;text-align:center;color:#e4f0e8;font-size:11px">人数</th>
    <th style="padding:8px 10px;width:22%;color:#e4f0e8;font-size:11px">备注</th>
  </tr></thead><tbody>`;

  // 排序
  let sortedCodes=[...semCodes];
  if(_sort.key==='code') sortedCodes.sort((a,b)=>_sort.dir*a.replace('ext2:','').localeCompare(b.replace('ext2:','')));

  let rn=0;sortedCodes.forEach(code=>{
    // 处理 ext2:CODE 格式
    const isExt2=code.startsWith('ext2:');
    const realCode=isExt2?code.replace('ext2:',''):code;
    const c=courseMap[realCode]||{c:realCode,n:'外系选修',cr:3,g:'外系选修'};
    const pickedStuds=isExt2
      ? studs.filter(s=>{const v=(s.courses||{})['ext2']||'';const parts=v.split('|');return parts.length>1?parts[1]===selSem&&parts[0]===realCode:false;})
      : studs.filter(s=>(s.courses||{})[realCode]===selSem);
    const picked=pickedStuds.length;
    // 班级筛选
    if(_selClass2){
      const hasClass=pickedStuds.some(s=>(s.classCode||autoClassCode(s.cohort,s.type))===_selClass2);
      if(!hasClass) return;
    }
    rn++;
    const classCodes=[...new Set(pickedStuds.map(s=>s.classCode||autoClassCode(s.cohort,s.type)))].sort();
    const classHtml=classCodes.map(cc=>{
      const pal=getClassColor(cc);
      return `<span style="font-family:var(--mono);font-size:10px;font-weight:600;color:${pal.fg};background:${pal.bg};border:0.5px solid ${pal.bd};padding:1px 7px;border-radius:20px;margin-right:3px;">${cc}</span>`;
    }).join('');
    // 备注（储存在 localStorage）
    const noteKey='ctnote_'+activeProg+'_'+selSem+'_'+realCode;
    const noteVal=localStorage.getItem(noteKey)||'';
    h+=`<tr style="background:${rn%2===0?'#fafafa':'#fff'};border-top:1px solid var(--line)">
      <td style="padding:7px 10px;text-align:center;color:var(--ink3);font-family:var(--mono);font-size:11px">${rn}</td>
      <td style="padding:7px 10px"><span style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--sky);background:var(--sky-l);padding:2px 6px;border-radius:4px">${realCode}</span></td>
      <td style="padding:7px 10px;color:var(--ink);font-size:12px">${c.n}</td>
      <td style="padding:7px 10px;text-align:center;font-family:var(--mono);font-weight:500;color:var(--g8);font-size:12px">${c.cr}</td>
      <td style="padding:7px 10px">${classHtml||'<span style="color:var(--ink3);font-size:11px">—</span>'}</td>
      <td style="padding:7px 10px;text-align:center"><span style="font-family:var(--mono);font-size:12px;font-weight:600;color:${picked>0?'var(--g7)':'var(--ink3)'}">${picked}</span></td>
      <td style="padding:5px 10px"><input value="${noteVal.replace(/"/g,'&quot;')}" placeholder="备注..."
        style="width:100%;border:1px solid transparent;border-radius:4px;padding:4px 7px;font-size:11px;font-family:var(--font);background:transparent;color:var(--ink2);"
        onfocus="this.style.border='1px solid var(--line2)';this.style.background='#fff'"
        onblur="localStorage.setItem('ctnote_${activeProg}_${selSem}_${code}',this.value);this.style.border='1px solid transparent';this.style.background='transparent'"
        onkeydown="if(event.key==='Enter')this.blur()">
      </td>
    </tr>`;
  });
  h+='</tbody></table></div>';
  page.innerHTML=h;
}
document.addEventListener('DOMContentLoaded',()=>{const lbl=document.getElementById('now-sem-label');if(lbl)lbl.textContent=NOW_SEM;});

document.addEventListener('DOMContentLoaded',()=>{
  const saved = sessionStorage.getItem('activeTab') || 'progress';
  switchTab(saved);
  checkAuth();
  updateLoginUI();
  // 动态调整 shell margin-top，跟 bar 实际高度一致
  function adjustShellMargin(){
    const bar=document.querySelector('.bar');
    const shell=document.getElementById('main-shell');
    if(bar&&shell){
      const h=bar.offsetHeight;
      shell.style.marginTop=h+'px';
      shell.style.height='calc(100vh - '+h+'px)';
    }
  }
  adjustShellMargin();
  window.addEventListener('resize', adjustShellMargin);
  // 预热 Supabase（避免冷启动延迟）
  setTimeout(()=>{
    fetch(`${SUPABASE_URL}/rest/v1/programs?select=id&limit=1`,{headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY}}).catch(()=>{});
  }, 2000);
  // ESC 键关闭当前开启的 modal
  document.addEventListener('keydown', e=>{
    if(e.key!=='Escape') return;
    const open=document.querySelector('.overlay[style*="flex"],.overlay[style*="block"]');
    if(open) closeModal(open.id);
  });
});

// ── 打印 / 导出 ────────────────────────────────────────
function printBlock(){
  // 取得当前激活的 tab
  const activePane = document.querySelector('.tab-pane.on');
  const tabId = activePane?.id || '';

  // 班级课表：专用打印窗口
  if(tabId === 'tab-classtable'){
    printClassTable();
    return;
  }

  // 在 <head> 动态插入打印专用 style
  let printStyle = document.getElementById('_print_override');
  if(!printStyle){ printStyle=document.createElement('style'); printStyle.id='_print_override'; document.head.appendChild(printStyle); }

  if(tabId === 'tab-overview'){
    printStyle.textContent = `@media print{ body > *:not(.shell){ display:none!important; } .shell .tab-pane{ display:none!important; } #tab-overview{ display:block!important; } }`;
  } else if(tabId === 'tab-progress'){
    printStyle.textContent = `@media print{ body > *:not(.shell){ display:none!important; } .shell .tab-pane{ display:none!important; } #tab-progress{ display:block!important; } }`;
  } else if(tabId === 'tab-counsel'){
    printStyle.textContent = `@media print{ body > *:not(.shell){ display:none!important; } .shell .tab-pane{ display:none!important; } #tab-counsel{ display:block!important; } .counsel-body{ display:block!important; } }`;
  } else {
    printStyle.textContent = '';
  }

  setTimeout(()=>{ window.print(); setTimeout(()=>{ printStyle.textContent=''; },500); }, 100);
}

function printClassTable(){
  const prog=getProg(activeProg);
  const selClass=window._ctClass||'all';
  const selSem=window._ctSem||NOW_SEM;
  const progStuds=DB.students.filter(s=>(s.prog||'TM')===activeProg);
  const studs=selClass==='all'?progStuds:progStuds.filter(s=>(s.classCode||autoClassCode(s.cohort,s.type))===selClass);
  const allPC=progCourses(activeProg).length?progCourses(activeProg):(prog.courses||getBuiltinTMCourses());
  const courseMap={};allPC.forEach(c=>courseMap[c.c]=c);

  // 收集该学期课程
  const semCodes=new Set();
  studs.forEach(s=>{
    Object.entries(s.courses||{}).forEach(([code,sem])=>{
      if(code==='ext2'){
        const parts=sem.split('|');
        const extSem=parts.length>1?parts[1]:parts[0];
        const extCode=parts.length>1?parts[0]:'ext2';
        if(extSem===selSem&&extCode) semCodes.add('ext2:'+extCode);
      } else if(sem===selSem){
        semCodes.add(code);
      }
    });
  });

  if(!semCodes.size){alert(`${selClass==='all'?'全部班级':selClass} · ${selSem} 无排课记录`);return;}

  const now=new Date();
  const dateStr=`${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;

  // 统计
  const sortedCodes=[...semCodes].sort((a,b)=>a.replace('ext2:','').localeCompare(b.replace('ext2:','')));
  const totalCr=sortedCodes.reduce((a,code)=>{const c=courseMap[code.replace('ext2:','')];return a+(c?c.cr:3);},0);
  const activeStuds=studs.filter(s=>Object.values(s.courses||{}).some(v=>v===selSem));

  // 班级颜色图例
  const allCC=[...new Set(studs.flatMap(s=>Object.entries(s.courses||{}).filter(([,v])=>v===selSem).map(()=>s.classCode||autoClassCode(s.cohort,s.type))))].sort();

  // 表格行
  let rn=0;
  const tableRows=sortedCodes.map(code=>{
    const isExt2=code.startsWith('ext2:');
    const realCode=isExt2?code.replace('ext2:',''):code;
    const c=courseMap[realCode]||{c:realCode,n:'外系选修',cr:3};
    const pickedStuds=isExt2
      ? studs.filter(s=>{const v=(s.courses||{})['ext2']||'';const parts=v.split('|');return parts.length>1?parts[1]===selSem&&parts[0]===realCode:false;})
      : studs.filter(s=>(s.courses||{})[realCode]===selSem);
    rn++;
    const classCodes=[...new Set(pickedStuds.map(s=>s.classCode||autoClassCode(s.cohort,s.type)))].sort();
    const noteKey='ctnote_'+activeProg+'_'+selSem+'_'+realCode;
    const noteVal=localStorage.getItem(noteKey)||'';
    const ccText=classCodes.join(' · ')||'—';
    return `<tr>
      <td style="text-align:center;color:#6b7280;font-family:monospace">${rn}</td>
      <td style="font-family:monospace;font-weight:700;color:#1d4ed8">${realCode}</td>
      <td>${c.n}</td>
      <td style="text-align:center;font-weight:600;color:#166534">${c.cr}</td>
      <td style="font-size:10px;color:#374151">${ccText}</td>
      <td style="text-align:center;font-weight:700;color:#166534">${pickedStuds.length}</td>
      <td style="color:#6b7280;font-size:10px">${noteVal}</td>
    </tr>`;
  }).join('');

  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>班级课表 ${selSem}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      html{width:210mm;}
      body{width:190mm;margin:0 auto;padding:10mm 0;font-family:'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;font-size:10px;background:#fff;color:#111;}
      @media print{
        body{padding:0;margin:0 auto;}
        @page{size:A4 portrait;margin:10mm 10mm 10mm 10mm;}
        tr{page-break-inside:avoid;}
        thead{display:table-header-group;}
        .footer{page-break-inside:avoid;}
      }
      /* 表头信息 */
      .hdr-table{width:100%;border-collapse:collapse;margin-bottom:12px;border:1.5px solid #166534;border-radius:6px;overflow:hidden;}
      .hdr-table td{padding:6px 12px;background:#dcfce7;border-right:1px solid #86efac;}
      .hdr-table td:last-child{border-right:none;}
      .hdr-label{font-size:8px;color:#166534;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:2px;}
      .hdr-val{font-size:12px;font-weight:700;color:#14532d;}
      /* 统计 pill */
      .stat-row{display:flex;gap:6px;margin-bottom:10px;align-items:center;}
      .stat-pill{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;border:1px solid;}
      /* 主表格 */
      table.main{width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed;}
      table.main th{background:#166534;color:#f0fdf4;padding:6px 8px;text-align:left;font-size:9.5px;font-weight:600;white-space:nowrap;overflow:hidden;}
      table.main td{padding:5px 8px;border-bottom:0.5px solid #e5e7eb;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      table.main tr:nth-child(even) td{background:#f9fafb;}
      table.main tr:hover td{background:#f0fdf4;}
      /* 页脚 */
      .footer{margin-top:10px;padding:6px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;font-size:9px;color:#166534;display:flex;gap:16px;}
      .footer span{font-weight:600;}
    </style>
  </head><body>

    <table class="hdr-table">
      <tr>
        <td style="width:30%"><div class="hdr-label">Institution</div><div class="hdr-val">Chinese International College</div></td>
        <td style="width:25%"><div class="hdr-label">Program</div><div class="hdr-val">${prog.name||'Tourism Management'}</div></td>
        <td style="width:15%"><div class="hdr-label">Semester</div><div class="hdr-val">${selSem}</div></td>
        <td style="width:15%"><div class="hdr-label">Class</div><div class="hdr-val">${selClass==='all'?'All':selClass}</div></td>
        <td style="width:15%"><div class="hdr-label">Print Date</div><div class="hdr-val">${dateStr}</div></td>
      </tr>
    </table>

    <div class="stat-row">
      <span class="stat-pill" style="background:#eff6ff;color:#1e40af;border-color:#bfdbfe">${semCodes.size} 门课</span>
      <span class="stat-pill" style="background:#f0fdf4;color:#166534;border-color:#86efac">${totalCr} 学分</span>
      <span class="stat-pill" style="background:#fef9c3;color:#713f12;border-color:#fde047">${activeStuds.length} 位上课学生</span>
      <div style="flex:1"></div>
      <span style="font-size:9px;color:#6b7280">班级：${allCC.join(' · ')||'—'}</span>
    </div>

    <table class="main">
      <thead><tr>
        <th style="width:20px">#</th>
        <th style="width:70px">课程代码</th>
        <th>课程名称</th>
        <th style="width:30px;text-align:center">学分</th>
        <th style="width:22%">修课班级</th>
        <th style="width:30px;text-align:center">人数</th>
        <th style="width:20%">备注</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <div class="footer">
      <div>课程总数：<span>${semCodes.size}</span> 门</div>
      <div>总学分：<span>${totalCr}</span></div>
      <div>上课学生：<span>${activeStuds.length}</span> 人</div>
    </div>

    <script>window.onload=()=>window.print();<\/script>
  </body></html>`);
  win.document.close();
}

function exportCSV(){
  const prog=getProg(activeProg);
  const courses=prog.courses||getBuiltinTMCourses();
  const studs=DB.students.filter(s=>(s.prog||'TM')===activeProg).sort((a,b)=>a.id.localeCompare(b.id));
  if(!studs.length){alert('没有学生数据');return;}

  // 表头
  const headers=['学号','姓名','届别','班级代码','类型','状态','GPA','已修学分','剩余学分','已修课数','剩余课数','实习完成'];
  courses.forEach(c=>headers.push(c.c+' '+c.n));

  const rows=[headers];
  studs.forEach(s=>{
    const p=calcProgress(s,courses);
    const row=[
      s.id, s.name, s.cohort,
      s.classCode||autoClassCode(s.cohort,s.type),
      s.type==='transfer'?'专升本':'全新生',
      s.status||'就读',
      s.gpa||'',
      p.doneCr, p.remCr, p.doneC, p.remC,
      p.internOk?'是':'否'
    ];
    courses.forEach(c=>{
      const v=(s.courses||{})[c.c]||'';
      row.push(v);
    });
    rows.push(row);
  });

  const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const bom='﻿'; // UTF-8 BOM for Excel
  const blob=new Blob([bom+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`${prog.name||activeProg}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(){
  const data={
    exportedAt:new Date().toISOString(),
    programs:DB.programs,
    students:DB.students.filter(s=>(s.prog||'TM')===activeProg).sort((a,b)=>a.id.localeCompare(b.id))
  };
  const json=JSON.stringify(data,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  const prog=getProg(activeProg);
  a.download=`${prog.name||activeProg}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}


// ── 全局进度条 ──
function gpShow(text='处理中...'){
  const el=document.getElementById('global-progress');
  if(el){el.style.display='flex';}
  gpSet(text,0);
}
function gpSet(text,pct){
  const t=document.getElementById('gp-text');
  const b=document.getElementById('gp-bar');
  const p=document.getElementById('gp-pct');
  if(t) t.textContent=text;
  if(b) b.style.width=pct+'%';
  if(p) p.textContent=Math.round(pct)+'%';
}
function gpDone(text='完成'){
  gpSet(text,100);
  setTimeout(()=>{
    const el=document.getElementById('global-progress');
    if(el) el.style.display='none';
  },1200);
}
function gpHide(){
  const el=document.getElementById('global-progress');
  if(el) el.style.display='none';
}


// ── TEP 快速储存 ─────────────────────────────────────
async function quickSaveTep(sid, type, score, retest){
  const s=DB.students.find(x=>x.id===sid); if(!s) return;
  if(!s.tep) s.tep={};
  const val=String(score||'').trim();
  const rval=String(retest||'').trim();
  if(!val){ delete s.tep[type]; }
  else {
    s.tep[type]={score:val};
    if(rval) s.tep[type].retest=rval;
    else delete s.tep[type]?.retest;
  }
  const inp=document.activeElement;
  try{ await apiSaveTep(sid,type,s.tep[type]||{}); }catch(e){ console.error(e); }
  if(!inp||!inp.dataset||inp.dataset.tep!=='1'){
    _renderOverviewKeepScroll();
  }
}

// ── 预建班级 ──────────────────────────────────────────
function openPreCohortsModal(){
  const sel=document.getElementById('pc-prog-sel');
  if(sel){
    sel.innerHTML=DB.programs.map(p=>`<option value="${p.id}" ${p.id===activeProg?'selected':''}>${p.name}</option>`).join('');
  }
  document.getElementById('pc-input').value='';
  renderPreCohortList();
  openModal('precohort-modal');
  setTimeout(()=>document.getElementById('pc-input')?.focus(),100);
}

function renderPreCohortList(){
  const pid=document.getElementById('pc-prog-sel')?.value||activeProg;
  const prog=getProg(pid);
  const list=prog?.preCohorts||[];
  const el=document.getElementById('pc-list');
  if(!el) return;
  if(!list.length){
    el.innerHTML='<div style="text-align:center;color:var(--ink3);font-size:12px;padding:16px">暂无预建班级</div>';
    return;
  }
  el.innerHTML=list.map((cc,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--paper);border:1px solid var(--line);border-radius:7px">
      <span style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--g7);flex:1">${cc}</span>
      <span style="font-size:11px;color:var(--ink3)">${cc.includes('ZSB')?'专升本':'全新生'}</span>
      <button onclick="delPreCohort(${i})" style="padding:2px 8px;border:1px solid #fca5a5;border-radius:4px;background:#fff;color:#dc2626;font-size:11px;cursor:pointer;">删除</button>
    </div>
  `).join('');
}

function addPreCohort(){
  const val=document.getElementById('pc-input')?.value.trim().toUpperCase();
  if(!val){alert('请输入班级代码');return;}
  const pid=document.getElementById('pc-prog-sel')?.value||activeProg;
  const prog=getProg(pid);
  if(!prog){alert('请先选择专业');return;}
  if(!prog.preCohorts) prog.preCohorts=[];
  if(prog.preCohorts.includes(val)){alert('该班级代码已存在');return;}
  prog.preCohorts.push(val);
  prog.preCohorts.sort();
  document.getElementById('pc-input').value='';
  renderPreCohortList();
  render();
  try{apiSaveProgram(prog);}catch(e){}
}

function delPreCohort(idx){
  const pid=document.getElementById('pc-prog-sel')?.value||activeProg;
  const prog=getProg(pid);
  if(!prog?.preCohorts) return;
  const cc=prog.preCohorts[idx];
  if(!confirm(`确认删除预建班级「${cc}」？`)) return;
  prog.preCohorts.splice(idx,1);
  renderPreCohortList();
  render();
  try{apiSaveProgram(prog);}catch(e){}
}

// ── 辅导员老师名单 ────────────────────────────────────────────
function getAdvisors(){
  try{return JSON.parse(localStorage.getItem('cic_advisors')||'[]');}catch(e){return[];}
}
function saveAdvisors(list){
  localStorage.setItem('cic_advisors',JSON.stringify(list));
}
function openAdvisorsModal(){
  renderAdvisorList();
  openModal('advisors-modal');
  setTimeout(()=>document.getElementById('adv-input')?.focus(),100);
}
function renderAdvisorList(){
  const list=getAdvisors();
  const el=document.getElementById('adv-list');
  if(!el) return;
  if(!list.length){
    el.innerHTML='<div style="text-align:center;color:var(--ink3);font-size:12px;padding:16px">暂无辅导员老师</div>';
    return;
  }
  el.innerHTML=list.map((name,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--paper);border:1px solid var(--line);border-radius:7px">
      <span style="font-size:13px;flex:1;color:var(--ink)">${name}</span>
      <span style="font-size:10px;color:var(--ink3)">${DB.students.filter(s=>s.advisor===name).length}位学生</span>
      <button onclick="delAdvisor(${i})" style="padding:2px 8px;border:1px solid #fca5a5;border-radius:4px;background:#fff;color:#dc2626;font-size:11px;cursor:pointer;">删除</button>
    </div>
  `).join('');
}
function addAdvisor(){
  const val=document.getElementById('adv-input')?.value.trim();
  if(!val){alert('请输入辅导员老师姓名');return;}
  const list=getAdvisors();
  if(list.includes(val)){alert('该辅导员老师已存在');return;}
  list.push(val);
  list.sort();
  saveAdvisors(list);
  document.getElementById('adv-input').value='';
  renderAdvisorList();
  // 更新编辑学生的辅导员老师下拉
  renderAdvisorDropdowns();
}
function delAdvisor(idx){
  const list=getAdvisors();
  const name=list[idx];
  const count=DB.students.filter(s=>s.advisor===name).length;
  if(!confirm(`确认删除辅导员老师「${name}」？${count>0?`\n\n⚠ 有 ${count} 位学生指定此辅导员老师，删除后学生记录不受影响。`:''}`)){ return; }
  list.splice(idx,1);
  saveAdvisors(list);
  renderAdvisorList();
  renderAdvisorDropdowns();
}
function renderAdvisorDropdowns(){
  // 更新新增/编辑学生 modal 里的辅导员老师输入框 → 改成 datalist
  const list=getAdvisors();
  let dl=document.getElementById('advisor-dl');
  if(!dl){
    dl=document.createElement('datalist');
    dl.id='advisor-dl';
    document.body.appendChild(dl);
  }
  dl.innerHTML=list.map(n=>`<option value="${n}">`).join('');
  // 给辅导员老师输入框加 list 属性
  const inp=document.getElementById('f-advisor');
  if(inp) inp.setAttribute('list','advisor-dl');
}

// ── 学生名单打印 ──────────────────────────────────────────
function _getStudentListData(){
  const studs=visStudents();
  const noteMap={jmei:'集美(JMEI)',btec:'BTEC',other:'其他'};
  // 按届别分组，组内按学号排序
  const byYear={};
  studs.forEach(s=>{
    const yr=s.cohort||'?';
    if(!byYear[yr]) byYear[yr]=[];
    byYear[yr].push(s);
  });
  const rows=[];
  Object.keys(byYear).sort().forEach(yr=>{
    byYear[yr].sort((a,b)=>a.id.localeCompare(b.id)).forEach((s,i)=>{
      const typeLabel=s.type==='transfer'?'专升本':'全日生';
      const noteLabel=noteMap[s.note]||'';
      const fullType=noteLabel?`${typeLabel}(${noteLabel})`:typeLabel;
      const sd=s.statusDetail||{};
      const _p=calcProgress(s,progCourses(s.prog||'TM'));
      const _gpn2=parseFloat(s.gpa);
      const _isGrad=_p.remC===0&&_p.internOk&&(s.gpa==null||_gpn2>=2.0);
      let statusLabel='在学',statusBg='#dcfce7',statusFg='#166534';
      if(sd.withdrawn){statusLabel='退学';statusBg='#f3e8ff';statusFg='#6d28d9';}
      else if(_isGrad){statusLabel='达标毕业';statusBg='#fef9c3';statusFg='#713f12';}
      else if(sd.leave&&sd.leave.length){statusLabel='休学';statusBg='#fef2f2';statusFg='#b91c1c';}
      rows.push({
        yr, seq:i+1,
        id:s.id, name:s.name, cname:s.cname||'',
        type:typeLabel, note:noteLabel, fullType,
        statusLabel, statusBg, statusFg,
        advisor:s.advisor||''
      });
    });
  });
  return rows;
}

function printStudentList(){
  const studs=visStudents();
  if(!studs.length){alert('没有符合条件的学生');return;}
  const rows=_getStudentListData();
  const now=new Date();
  const dateStr=`${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;

  // 届别颜色（不含红色）
  const yrColors=[
    {bg:'#fce7f3',bd:'#f9a8d4'}, // 粉
    {bg:'#dbeafe',bd:'#93c5fd'}, // 蓝
    {bg:'#dcfce7',bd:'#86efac'}, // 绿
    {bg:'#fef9c3',bd:'#fde047'}, // 黄
    {bg:'#f3e8ff',bd:'#d8b4fe'}, // 紫
    {bg:'#e0f2fe',bd:'#7dd3fc'}, // 天蓝
    {bg:'#ffedd5',bd:'#fdba74'}, // 橙
    {bg:'#f0fdf4',bd:'#4ade80'}, // 浅绿
  ];
  const yrs=[...new Set(rows.map(r=>r.yr))].sort();
  const yrColorMap={};yrs.forEach((yr,i)=>yrColorMap[yr]=yrColors[i%yrColors.length]);

  // 统计
  const allStuds=visStudents();
  const totalCount=allStuds.length;
  const leaveCount=allStuds.filter(s=>{const sd=s.statusDetail||{};return sd.leave&&sd.leave.length&&!sd.withdrawn;}).length;
  const withdrawCount=allStuds.filter(s=>(s.statusDetail||{}).withdrawn).length;
  const gradCount=allStuds.filter(s=>{const p=calcProgress(s,progCourses(s.prog||'TM'));return p.remC===0&&p.internOk;}).length;
  const activeCount=totalCount-leaveCount-withdrawCount-gradCount;

  const tableRows=rows.map((r,idx)=>{
    const pal=yrColorMap[r.yr]||{bg:'#f8fafc',bd:'#e2e8f0'};
    const typeBg=r.type==='专升本'?'#ede9fe':'#f0fdf4';
    const typeColor=r.type==='专升本'?'#6d28d9':'#166534';
    return `<tr style="background:${pal.bg}">
      <td style="text-align:center;font-weight:600;color:#374151;border-left:3px solid ${pal.bd}">${r.yr}</td>
      <td style="text-align:center;color:#6b7280">${r.seq}</td>
      <td style="font-family:monospace;color:#111">${r.id}</td>
      <td style="font-weight:500">${r.name}</td>
      <td>${r.cname}</td>
      <td style="text-align:center;background:${typeBg};color:${typeColor};font-weight:500">${r.type==='专升本'?'专升本':'全日生'}</td>
      <td style="text-align:center;background:${r.statusBg};color:${r.statusFg}">${r.statusLabel}</td>
      <td style="color:#374151">${r.advisor}</td>
    </tr>`;
  }).join('');

  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>学生名单</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;font-size:12px;background:#fff;padding:16px;}
      .hdr{display:flex;border:1.5px solid #166534;border-radius:6px;overflow:hidden;margin-bottom:14px;}
      .hdr-cell{flex:1;padding:8px 14px;background:#dcfce7;border-right:1px solid #86efac;}
      .hdr-cell:last-child{border-right:none;}
      .hdr-cell .label{font-size:9px;color:#166534;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:2px}
      .hdr-cell .val{font-size:13px;font-weight:700;color:#14532d}
      table{width:100%;border-collapse:collapse;font-size:11.5px;}
      thead tr{background:#166534;}
      th{padding:7px 10px;text-align:left;color:#f0fdf4;font-size:11px;font-weight:600;border-right:1px solid rgba(255,255,255,.15);}
      th:last-child{border-right:none}
      td{padding:6px 10px;border-bottom:1px solid #e5e7eb;border-right:1px solid #f3f4f6;vertical-align:middle;}
      td:last-child{border-right:none}
      .footer{margin-top:10px;padding:7px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;font-size:9px;color:#166534;display:flex;gap:14px;flex-wrap:wrap;}
      .footer span{font-weight:600}
      *{box-sizing:border-box;margin:0;padding:0;}
      html{width:210mm;}
      body{width:190mm;margin:0 auto;padding:10mm 0;font-family:'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;font-size:9px;background:#fff;}
      @media print{
        body{padding:0;margin:0 auto;}
        @page{size:A4 portrait;margin:10mm 10mm 10mm 10mm;}
        .footer{page-break-inside:avoid;}
        tr{page-break-inside:avoid;}
        thead{display:table-header-group;}
      }
      table{table-layout:fixed;width:100%;border-collapse:collapse;font-size:9px;}
      th{background:#166534;color:#f0fdf4;padding:5px 5px;white-space:nowrap;overflow:hidden;font-size:8.5px;font-weight:600;}
      td{padding:4px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:0.5px solid #e5e7eb;vertical-align:middle;}
      tr:nth-child(even) td{background:#f9fafb;}
    </style>
  </head><body>
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;border:1.5px solid #166534;border-radius:6px;overflow:hidden;font-size:10px;">
      <tr>
        <td style="padding:6px 10px;background:#dcfce7;border-right:1px solid #86efac;width:30%"><div style="font-size:8px;color:#166534;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Institution</div><div style="font-size:11px;font-weight:700;color:#14532d">Chinese International College</div></td>
        <td style="padding:6px 10px;background:#dcfce7;border-right:1px solid #86efac;width:25%"><div style="font-size:8px;color:#166534;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Program</div><div style="font-size:11px;font-weight:700;color:#14532d">Tourism Management</div></td>
        <td style="padding:6px 10px;background:#dcfce7;border-right:1px solid #86efac;width:22%"><div style="font-size:8px;color:#166534;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Print Date</div><div style="font-size:11px;font-weight:700;color:#14532d">${dateStr}</div></td>
        <td style="padding:6px 10px;background:#dcfce7;width:23%"><div style="font-size:8px;color:#166534;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Semester</div><div style="font-size:11px;font-weight:700;color:#14532d">${NOW_SEM}</div></td>
      </tr>
    </table>
    <table>
      <thead><tr>
        <th style="width:18px;text-align:center">届</th>
        <th style="width:16px;text-align:center">#</th>
        <th style="width:72px">Student ID</th>
        <th style="width:24%">English Name</th>
        <th style="width:11%">中文姓名</th>
        <th style="width:52px;text-align:center">类型</th>
        <th style="width:56px;text-align:center">在籍状况</th>
        <th style="width:18%">辅导员老师</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="footer">
      <div>总人数：<span>${totalCount}</span> 人</div>
      <div>在学：<span>${activeCount}</span> 人</div>
      <div>休学：<span>${leaveCount}</span> 人</div>
      ${gradCount>0?`<div>达标毕业：<span>${gradCount}</span> 人</div>`:''}
      ${withdrawCount>0?`<div>退学：<span>${withdrawCount}</span> 人</div>`:''}
    </div>
    <script>window.onload=()=>window.print();<\/script>
  </body></html>`);
  win.document.close();
}

function exportStudentListExcel(){
  const studs=visStudents();
  if(!studs.length){alert('没有符合条件的学生');return;}
  const rows=_getStudentListData();
  const now=new Date();
  const dateStr=`${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;

  // CSV with BOM
  const headers=['届别','序号','Student ID','英文姓名','中文姓名','类型','辅导员老师'];
  const csvRows=[headers,...rows.map(r=>[r.yr,r.seq,r.id,r.name,r.cname,r.fullType,r.advisor])];
  const csv=csvRows.map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`学生名单_${dateStr.replace(/\//g,'-')}.csv`;
  a.click();
}

// ── 全局班级颜色映射（按届别固定，同届不重复）──────────────
const _COHORT_PALETTES={
  '66':[
    {bg:'#fce7f3',fg:'#9d174d',bd:'#f9a8d4'},   // TM66
    {bg:'#fecdd3',fg:'#9f1239',bd:'#fda4af'},   // TM66-2
    {bg:'#fbb6ce',fg:'#831843',bd:'#f472b6'},   // TM66ZSB
    {bg:'#f9a8d4',fg:'#7d1c4a',bd:'#ec4899'},   // TM66-2ZSB
  ],
  '67':[
    {bg:'#dbeafe',fg:'#1e40af',bd:'#93c5fd'},   // TM67
    {bg:'#bfdbfe',fg:'#1e3a8a',bd:'#60a5fa'},   // TM67ZSB
    {bg:'#e0f2fe',fg:'#075985',bd:'#7dd3fc'},   // TM67-2
    {bg:'#bae6fd',fg:'#0c4a6e',bd:'#38bdf8'},   // TM67-2ZSB
  ],
  '68':[
    {bg:'#dcfce7',fg:'#166534',bd:'#86efac'},   // TM68
    {bg:'#bbf7d0',fg:'#14532d',bd:'#4ade80'},   // TM68ZSB
    {bg:'#d1fae5',fg:'#065f46',bd:'#6ee7b7'},   // TM68-2
    {bg:'#a7f3d0',fg:'#064e3b',bd:'#34d399'},   // TM68-2ZSB
  ],
  '69':[
    {bg:'#fef9c3',fg:'#713f12',bd:'#fde047'},
    {bg:'#fef08a',fg:'#854d0e',bd:'#facc15'},
    {bg:'#fde68a',fg:'#92400e',bd:'#f59e0b'},
    {bg:'#fcd34d',fg:'#78350f',bd:'#d97706'},
  ],
  '70':[
    {bg:'#f3e8ff',fg:'#6d28d9',bd:'#d8b4fe'},
    {bg:'#e9d5ff',fg:'#581c87',bd:'#c084fc'},
    {bg:'#ddd6fe',fg:'#4c1d95',bd:'#a78bfa'},
    {bg:'#c4b5fd',fg:'#3b0764',bd:'#8b5cf6'},
  ],
  '71':[
    {bg:'#ffedd5',fg:'#9a3412',bd:'#fdba74'},
    {bg:'#fed7aa',fg:'#7c2d12',bd:'#fb923c'},
    {bg:'#fcd9bd',fg:'#7c2d12',bd:'#f97316'},
    {bg:'#fbb97a',fg:'#6c2310',bd:'#ea580c'},
  ],
  '72':[
    {bg:'#ccfbf1',fg:'#134e4a',bd:'#5eead4'},
    {bg:'#99f6e4',fg:'#0f3d38',bd:'#2dd4bf'},
    {bg:'#cffafe',fg:'#164e63',bd:'#67e8f9'},
    {bg:'#a5f3fc',fg:'#0e7490',bd:'#22d3ee'},
  ],
};
const _classColorCache={};
function getClassColor(code){
  if(!code) return {bg:'#f1f5f9',fg:'#475569',bd:'#cbd5e1'};
  if(_classColorCache[code]) return _classColorCache[code];
  // 提取届别数字（取前2位数字）
  const m=code.match(/(\d{2})/);
  const yr=m?m[1]:'00';
  const palettes=_COHORT_PALETTES[yr]||[
    {bg:'#f1f5f9',fg:'#475569',bd:'#cbd5e1'},
    {bg:'#e2e8f0',fg:'#334155',bd:'#94a3b8'},
    {bg:'#cbd5e1',fg:'#1e293b',bd:'#64748b'},
    {bg:'#94a3b8',fg:'#0f172a',bd:'#475569'},
  ];
  // 同届内按字母排序分配不同深浅
  const sameCohort=[...new Set(DB.students.map(s=>s.classCode||autoClassCode(s.cohort,s.type)).filter(Boolean))].filter(c=>c.match(/(\d{2})/)?.[1]===yr).sort();
  sameCohort.forEach((c,i)=>{if(!_classColorCache[c])_classColorCache[c]=palettes[i%palettes.length];});
  return _classColorCache[code]||palettes[0];
}
function resetClassColors(){Object.keys(_classColorCache).forEach(k=>delete _classColorCache[k]);}

// ── Start ──────────────────────────────────────────────────
init();
