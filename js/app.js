// ── PIN 码验证 ──────────────────────────────
const PIN = 'CICBA2569';
const PIN_KEY = 'cic_auth';
const PIN_TTL = 24 * 60 * 60 * 1000; // 24小时

function checkPin(){
  const val = document.getElementById('pin-input').value;
  if(val === PIN){
    localStorage.setItem(PIN_KEY, Date.now());
    unlockApp();
  } else {
    const box = document.querySelector('.pin-box');
    const err = document.getElementById('pin-err');
    err.textContent = '密码错误，请再试一次';
    box.classList.remove('pin-shake');
    void box.offsetWidth;
    box.classList.add('pin-shake');
    document.getElementById('pin-input').value = '';
  }
}

function unlockApp(){
  document.getElementById('pin-overlay').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  init();
}

function checkAuth(){
  const ts = localStorage.getItem(PIN_KEY);
  if(ts && Date.now() - parseInt(ts) < PIN_TTL){
    unlockApp();
  } else {
    document.getElementById('pin-overlay').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    setTimeout(()=>document.getElementById('pin-input').focus(), 100);
  }
}

function logout(){
  if(!confirm('确认登出？'))return;
  localStorage.removeItem(PIN_KEY);
  document.getElementById('pin-input').value='';
  document.getElementById('pin-err').textContent='';
  document.getElementById('pin-overlay').style.display='flex';
  document.getElementById('main-app').style.display='none';
  setTimeout(()=>document.getElementById('pin-input').focus(),100);
}

// 页面载入时检查
window.addEventListener('DOMContentLoaded', checkAuth);

// ╔══════════════════════════════════════════════════════════╗
// ║  配置区 — 修改 SHEETS_URL 即可启用 Google Sheets 同步     ║
// ╚══════════════════════════════════════════════════════════╝
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwu07GbhASaGaEKM8A6xtAEqkgg6AOuWvTII0jn68sHTlPEwjTrIo0lmSJltjfJUhvF/exec';

// ╔══════════════════════════════════════════════════════════╗
// ║  内建预设参考数据（SHEETS_URL 空白时自动使用）              ║
// ╚══════════════════════════════════════════════════════════╝
const DEFAULT_C=[
  {c:'CA201',en:'Principles and Theories of Communication'},{c:'CA213',en:'Digital Photography for Communication'},
  {c:'CA215',en:'News and Current Affairs'},{c:'CA218',en:'Verbal Communication and Expression Skills'},
  {c:'CA219',en:'Aesthetics and Design in Communication Arts'},{c:'CA220',en:'Media Landscape and Media Ecology'},
  {c:'CA221',en:'Narrative Arts and Information Design'},{c:'CA222',en:'Digital Marketing Principles'},
  {c:'DI315',en:'Self-Creation and Identity'},{c:'DI316',en:'Broadcasting and Streaming Content Creation'},
  {c:'DI317',en:'Innovative Media'},{c:'DI318',en:'Scriptwriting'},{c:'DI319',en:'Visual Design and Graphics'},
  {c:'DI320',en:'Digital Content Production and Post-Production 1'},{c:'DI321',en:'Digital Content Production and Post-Production 2'},
  {c:'DI322',en:'Transmedia Storytelling'},{c:'DI323',en:'Digital Media and Data Research'},
  {c:'DI324',en:'Content Marketing'},{c:'DI325',en:'Entrepreneurship in Digital Content Creation'},
  {c:'DI326',en:'Law and Ethics in Digital Media'},{c:'DI354',en:'New Media and Society'},
  {c:'DI371',en:'Media Industry Field Study'},{c:'DI376',en:'Content Moderation'},
  {c:'DI377',en:'Digital Media Journalism and Documentary'},{c:'DI378',en:'Announcer'},
  {c:'DI379',en:'Artist Management'},{c:'DI380',en:'Event Exhibition and Media'},
  {c:'DI381',en:'International Content Industry'},{c:'DI382',en:'Creative Industry'},
  {c:'DI383',en:'Music Festival Management'},{c:'DI384',en:'Design Thinking for Content Creators'},
  {c:'DI385',en:'Infographics'},{c:'DI386',en:'Sound Design and Podcasting'},
  {c:'DI387',en:'The Art of Motion Photography'},{c:'DI388',en:'Advanced Editing and Image Sequencing'},
  {c:'DI389',en:'Animation Production'},{c:'DI390',en:'Short Film Production and New Media'},
  {c:'DI391',en:'Virtual Production'},{c:'DI392',en:'Content Creation on YouTube'},
  {c:'DI393',en:'Creating Content for Marginalized Groups'},
  {c:'DI394',en:'Digital Content Creation Special Topics 1'},{c:'DI395',en:'Digital Content Creation Special Topics 2'},
  {c:'DI403',en:'Digital Media and Creative Cooperative Education'},{c:'DI404',en:'Creative Entrepreneurship Capstone Project'},
  {c:'FA207',en:'Art Structure'},{c:'FA221',en:'Aesthetics'},{c:'FA223',en:'Drawing'},{c:'FA225',en:'Color Theory'},
  {c:'FA226',en:'Creative Design Culture Capital'},{c:'FA227',en:'Computer Creative Design'},{c:'FA228',en:'Art and Design World'},
  {c:'FA230',en:'Thai Creative Design'},{c:'FA301',en:'Creative Photography Presentation'},
  {c:'FA302',en:'Positioning as a Digital Media Designer'},{c:'FA303',en:'Lifestyle Products and Design'},
  {c:'FA306',en:'Branding and Brand Design'},{c:'FA307',en:'Typography in Everyday Life'},
  {c:'FA309',en:'Creative Exhibition Design'},{c:'FA310',en:'Creative Thinking for Designers'},
  {c:'FA311',en:'Sustainable Design Principles'},{c:'FA312',en:'Creative Design Special Topics'},
  {c:'FA338',en:'Visual Communication Design'},{c:'FA339',en:'Digital Typography Design'},
  {c:'FA340',en:'Illustration Design'},{c:'FA341',en:'Graphic Design Photography'},
  {c:'FA342',en:'Product and Packaging Design'},{c:'FA343',en:'Environmental Graphic Design'},
  {c:'FA344',en:'User Experience Design'},{c:'FA345',en:'Animation Design'},
  {c:'FA346',en:'Brand Identity Design'},{c:'FA347',en:'Creative Advertising Design'},
  {c:'FA348',en:'Design Entrepreneurship'},{c:'FA376',en:'Black and White Photography'},
  {c:'FA380',en:'Basic Home Interior Environmental Design'},
  {c:'FA401',en:'Creative Design Capstone Project 1'},{c:'FA402',en:'Creative Design Capstone Project 2'},
  {c:'FA403',en:'Art Thesis Preparation'},{c:'FA404',en:'Art Thesis'},{c:'FA405',en:'Practicum'},
  {c:'KF301',en:'Financial Management'},{c:'KF303',en:'Financial Statement Analysis'},
  {c:'KF305',en:'Insurance Business Management'},{c:'KF306',en:'Principles of Securities and Investment Analysis'},
  {c:'KF307',en:'Wealth Management'},{c:'KF311',en:'International Financial Management'},
  {c:'KF312',en:'Digital Financial Operations'},{c:'KF313',en:'Accounting Information Systems and FinTech'},
  {c:'KF314',en:'Finance and Accounting Special Topics'},{c:'KF315',en:'Career Preparation'},
  {c:'KF331',en:'Intermediate Accounting 1'},{c:'KF332',en:'Intermediate Accounting 2'},
  {c:'KF333',en:'Cost Accounting'},{c:'KF334',en:'Management Accounting'},
  {c:'KF337',en:'Cost Analysis and Management'},{c:'KF338',en:'Internal Audit and Control'},
  {c:'KF351',en:'Investment Banking'},{c:'KF352',en:'Portfolio Management'},
  {c:'KF353',en:'Personal Financial Management'},{c:'KF354',en:'Credit Management'},
  {c:'KF355',en:'Enterprise Risk Management'},{c:'KF356',en:'Accounting for Specific Enterprises'},
  {c:'KF360',en:'Finance and Accounting Seminar'},{c:'KF411',en:'Business Administration Cooperative Education'},
  {c:'KF412',en:'Finance and Accounting Capstone Project'},
  {c:'KL301',en:'Regional Business Environment Analysis'},{c:'KL302',en:'International Business Management'},
  {c:'KL303',en:'Import and Export Principles'},{c:'KL304',en:'Import and Export Trade Management Practice'},
  {c:'KL305',en:'Business Operation in AEC and China'},{c:'KL306',en:'Cross-Cultural Communication'},
  {c:'KL307',en:'International Media Management'},{c:'KL308',en:'International Food Industry Management'},
  {c:'KL309',en:'Business Technology Application'},{c:'KL310',en:'New Business and Digital Marketing'},
  {c:'KL311',en:'New Business and Digital Marketing Practice'},{c:'KL312',en:'International Business Seminar'},
  {c:'KL313',en:'International Business Special Topics'},{c:'KL314',en:'Career Preparation'},
  {c:'KL411',en:'Business Administration Cooperative Education'},{c:'KL412',en:'International Business Capstone Project'},
  {c:'KB215',en:'Business English'},{c:'KB216',en:'Organizational and Strategic Management'},
  {c:'KB217',en:'Supply Chain Management'},{c:'KB218',en:'Marketing Principles and Innovation'},
  {c:'KB219',en:'Quantitative Analysis and Business Statistics'},{c:'KB220',en:'Corporate Finance'},
  {c:'KB221',en:'Business Economics'},{c:'KB222',en:'Accounting Principles'},{c:'KB223',en:'Business Law and Ethics'},
  {c:'IT238',en:'Introduction to Database Systems and Data Warehousing'},{c:'IT240',en:'Data Communications and Networks'},
  {c:'IT244',en:'Introduction to Data Science and Business Intelligence'},{c:'IT262',en:'IT Innovation'},
  {c:'IT263',en:'Mathematics for IT'},{c:'IT264',en:'Statistics and Probability Principles'},
  {c:'IT265',en:'Business Processes'},{c:'IT266',en:'Concepts and Principles of Computer Programming'},
  {c:'IT267',en:'Object-Oriented Application Development'},{c:'IT322',en:'Introduction to Software Quality Assurance'},
  {c:'IT347',en:'IT Project Management'},{c:'IT356',en:'Deep Learning and Image Processing'},
  {c:'IT358',en:'Data Structures and Algorithms'},{c:'IT359',en:'Computer Organization and Architecture'},
  {c:'IT363',en:'Security Technology and Protection Systems'},{c:'IT367',en:'Big Data Processing'},
  {c:'IT368',en:'Cloud Computing'},{c:'IT369',en:'Introduction to Internet of Things'},
  {c:'IT371',en:'Machine Learning'},{c:'IT373',en:'Information Systems Analysis and Design'},
  {c:'IT374',en:'Mobile Application Development'},{c:'IT375',en:'Application Services Design and Development'},
  {c:'IT376',en:'Web Front-End Development'},{c:'IT377',en:'UI and UX Design'},
  {c:'IT389',en:'Data Visualization'},{c:'IT392',en:'Artificial Intelligence'},
  {c:'IT393',en:'Human-Computer Interaction and UX Design'},{c:'IT410',en:'Cooperative Education'},
  {c:'IT430',en:'Capstone'},{c:'IT433',en:'IT and AI Project 1'},{c:'IT434',en:'IT and AI Project 2'},
  {c:'SS201',en:'Fundamentals of Sports and Exercise Science'},{c:'SS202',en:'Anatomy for Sports and Exercise Science'},
  {c:'SS203',en:'Physiology for Sports and Exercise Science'},{c:'SS204',en:'Kinesiology'},
  {c:'SS205',en:'Sports and Exercise Nutrition'},{c:'SS206',en:'Sports and Exercise Psychology'},
  {c:'SS301',en:'Principles of Sports and Exercise Training'},{c:'SS302',en:'Sports, Exercise and Anti-Aging Medicine'},
  {c:'SS303',en:'Fitness, Sports and Anti-Aging Industry Management'},{c:'SS304',en:'Personalized Athlete Management'},
  {c:'SS305',en:'Physical Fitness Assessment'},{c:'SS306',en:'Functional Movement Screening'},
  {c:'SS307',en:'Prescription Development for Sports Training'},{c:'SS308',en:'Corrective Exercise Training'},
  {c:'SS309',en:'Sports and Exercise Science Special Topics'},{c:'SS310',en:'Exercise Prescription for the Elderly'},
  {c:'SS311',en:'Resistance Training'},{c:'SS312',en:'Functional Training'},{c:'SS313',en:'Basic Group Fitness'},
  {c:'SS314',en:'Massage'},{c:'SS315',en:'Yoga'},{c:'SS316',en:'Fitness and Sports Industry Strategic Planning'},
  {c:'SS317',en:'Management Communication Skills'},{c:'SS318',en:'Personal Fitness Training'},
  {c:'SS401',en:'Advanced Group Fitness'},{c:'SS402',en:'Pilates'},
  {c:'SS403',en:'Exercise Prescription for Special Populations'},{c:'SS404',en:'Team Sports Training and Development'},
  {c:'SS405',en:'Aquatic Sports Training and Development'},{c:'SS406',en:'Racket Sports Training and Development'},
  {c:'SS407',en:'Fitness and Sports Industry Marketing'},{c:'SS408',en:'Fitness and Sports Industry HRM'},
  {c:'SS409',en:'Fitness and Sports Industry Law and Ethics'},{c:'SS410',en:'Performance Evaluation and Effectiveness Measurement'},
  {c:'SS411',en:'Sports and Exercise Science Capstone Project'},{c:'SS412',en:'Sports and Exercise Science Professional Internship'},
  {c:'KT305',en:'Tourism Operations Management'},{c:'KT311',en:'Tourist Behavior'},{c:'KT316',en:'Introduction to Tourism'},
  {c:'KT319',en:'Tourism Information Systems'},{c:'KT322',en:'Tourism Logistics Management'},
  {c:'KT327',en:'Hotel and Resort Accommodation Management'},{c:'KT328',en:'Sustainable Tourism Management'},
  {c:'KT329',en:'Tourism English'},{c:'KT330',en:'Digital Tourism Operations'},
  {c:'KT331',en:'Tourism Management Special Topics'},{c:'KT332',en:'Career Preparation'},
  {c:'KT333',en:'Cultural and Creative Tourism'},{c:'KT363',en:'Food and Beverage Service Operations Management'},
  {c:'KT364',en:'Convention and Exhibition Management'},{c:'KT411',en:'Business Administration Cooperative Education'},
  {c:'KT412',en:'Tourism Management Capstone Project'},
  {c:'KE311',en:'Restaurant and Hospitality English'},{c:'KE316',en:'Basic Writing for Tourism'},
  {c:'KE325',en:'Basic Reading Skills'},{c:'KE327',en:'English Conversation'},{c:'KE333',en:'Business Reading'},
  {c:'GE170',en:'Thai Socio-Economic 4.0'},{c:'GE171',en:'Creative Thinking and Innovation'},
  {c:'GE172',en:'New Economy and Culture in AEC Countries and China'},
  {c:'GE174',en:'Social and Economic Sustainable Development'},{c:'GE175',en:'Digital Entrepreneurship for Sustainable Development'},
  {c:'GE176',en:'Innovation and Creativity'},{c:'GE177',en:'Digital Entrepreneurship and Sustainable Development'},
  {c:'GE201',en:'Fundamental Health Sciences'},{c:'GE202',en:'Lifestyle Health Management'},
  {c:'GE203',en:'Alternative Medicine'},{c:'GE204',en:'Anti-Aging Science'},{c:'GE205',en:'Micro-Entrepreneurship'},
  {c:'KG131',en:'Critical and Innovative Thinking'},{c:'KG133',en:'Business Concepts and Entrepreneurial Thinking'},
  {c:'KG145',en:'Eastern and Western Thinking and Values'},{c:'KG148',en:'Modern Business Information Security'},
  {c:'KG151',en:'Health and Well-Being'},{c:'KG155',en:'Society and Culture of ASEAN Countries'},
  {c:'KG156',en:'Technology, Environment and Quality of Life'},
  {c:'LA030',en:'Foundation English'},{c:'LA130',en:'Foundation English'},{c:'LA131',en:'English 1'},
  {c:'LA132',en:'English 2'},{c:'LA160',en:'Foundation English'},{c:'LA161',en:'English Communication 1'},
  {c:'LA162',en:'English Communication 2'},{c:'LA241',en:'Business English 1'},
  {c:'KH160',en:'Thai Language Communication for Foreigners'},
  {c:'KH351',en:'Thai Language 1'},{c:'KH352',en:'Thai Language 2'},{c:'KH353',en:'Thai Language 3'},
  {c:'KH354',en:'Thai Language 4'},{c:'KH355',en:'Thai Language 5'},
  {c:'MA109',en:'Mathematics and Statistics'},{c:'MA208',en:'Basic Mathematics'},
  {c:'MA209',en:'Engineering Mathematics 1'},{c:'MA210',en:'Engineering Mathematics 2'},
  {c:'LW103',en:'Law in Daily Life'},{c:'PA101',en:'Quality of Life - Sufficiency Economy Philosophy'},
  {c:'BA103',en:'Digital Entrepreneurship'},{c:'SC106',en:'Science and Technology'},
  {c:'SC218',en:'Human Anatomy and Physiology'},{c:'CE100',en:'Introduction to Robotics'},
  {c:'CT101',en:'AI World and IoT'},{c:'CT102',en:'Introduction to VR and AR Technology'}
];
const DEFAULT_T=[
  {n:'Aj. Liu, Feng-Lin',d:'IB',r:'主任老师',l:7},{n:'Aj. Shi, Xiongfei',d:'FA',r:'主任老师',l:7},
  {n:'Aj. Tsai, Chiu-Hui',d:'TM',r:'主任老师',l:7},{n:'Aj. Lee, Shian-Heng',d:'CD',r:'主任老师',l:7},
  {n:'Dr. Chang, Chuan-Chi',d:'GE',r:'主任老师',l:7},{n:'Aj. Chen, Dui',d:'FA',r:'副主任老师',l:8},
  {n:'Aj. Chen, Hao',d:'IB',r:'副主任老师',l:8},{n:'Aj. Xu, Yan',d:'IB',r:'副主任老师',l:8},
  {n:'Aj. Liu, Shen-Yin',d:'TM',r:'副院长',l:4},{n:'Aj. Zhao, Fei',d:'GE',r:'副院长',l:4},
  {n:'Aj. Zhang, Lu',d:'GE',r:'副院长',l:4},{n:'Aj. Zhao, Tian',d:'GE',r:'支援活动科研老师',l:6},
  {n:'Dr. Chou, I-wen',d:'IB',r:'一般老师',l:10},{n:'Aj. Guo, Jing',d:'IB',r:'一般老师',l:10},
  {n:'Aj. Yin, Shujian',d:'IB',r:'一般老师',l:10},{n:'Aj. Chen, Pao-Cheng',d:'FA',r:'一般老师',l:10},
  {n:'Aj. Lu, Peng',d:'TM',r:'一般老师',l:10},{n:'Aj. Zhang, Yun',d:'CD',r:'一般老师',l:10},
  {n:'Aj. Li, Manhua',d:'GE',r:'一般老师',l:10},{n:'Dr. Huang, Xichang',d:'GE',r:'一般老师',l:10},
  {n:'Dr. Wei, Liwei',d:'GE',r:'一般老师',l:10},{n:'Aj. Wang, Xinrui',d:'GE',r:'一般老师',l:10},
  {n:'Aj. Chen, Xiongling',d:'GE',r:'一般老师',l:10},{n:'Aj. Wang, Ying',d:'CA',r:'一般老师',l:10},
  {n:'Aj. Yu, Zhaoxiao',d:'SE',r:'一般老师',l:10},{n:'Aj. Xue, Yuanjing',d:'IC',r:'一般老师',l:10},
  {n:'Aj. Wang, Bo',d:'IB',r:'兼市场部老师',l:2},{n:'Aj. Su, Dan',d:'IB',r:'兼市场部老师',l:2},
  {n:'Aj. Chen, Ying',d:'IB',r:'兼市场部老师',l:2},{n:'Aj. Ding, Ruina',d:'TM',r:'兼市场部老师',l:2},
  {n:'Aj. Feng, Lu',d:'CD',r:'兼市场部老师',l:2},{n:'Aj. Zhou, Jiaji',d:'IT',r:'兼市场部老师',l:2},
  {n:'Aj. Mo, Lingfen',d:'GE',r:'兼HR行政老师',l:2},
  {n:'Aj. Paitaya',d:'DPU',r:'外聘',l:0},{n:'Aj. Sunee',d:'DPU',r:'外聘',l:0},
  {n:'Aj. Praewa',d:'DPU',r:'外聘',l:0},{n:'Aj. Penpisut Sikakaew',d:'CIC',r:'外聘',l:0}
];
const DEFAULT_CBD={
  CA:['CA67','CA68','CA68ZSB','CA69','CA69ZSB'],
  CD:['CD67(25)','CD67 2+2(12)','CD68(18)','CD68 2+2(5)','CD69','CD69 2+2'],
  FA:['FA67(15)','FA67A','FA67B','FA67 2+2','FA68A','FA68 2+2','FA69','FA69 2+2'],
  IB:['IB66-1FAN-A(21)曾靜雯','IB66-1FAN-B(36)靳騏先','IB66-2FZSB(16)陈丁慧','IB67-1FAN-A','IB67-1FAN-B','IB67-1FAN-C','IB67-1FAN(38)','IB67-1FZSB(29)李雪茹','IB67-1SAN(21)董艺繁','IB68-1FAN','IB68-1FZSB(10)','IB68-3FAN','IB69-1FAN','IB69-2FAN','IB69-1FZSB','IB69-2FZSB'],
  TM:['TM66(9)','TM67(7)','TM67ZSB(4)','TM67-2ZSB(2)','TM68(7)','TM68ZSB(1)','TM69','TM69ZSB','TM69-2ZSB'],
  IT:['IT68','IT68ZSB','IT69','IT69ZSB'],SE:['SE69','SE69ZSB'],EV:['EV69','EV69ZSB']
};

// ╔══════════════════════════════════════════════════════════╗
// ║  运行时参考数据（从 Sheets 覆盖，或维持预设）               ║
// ╚══════════════════════════════════════════════════════════╝
let C=DEFAULT_C.map(x=>({...x})),T=DEFAULT_T.map(x=>({...x})),CBD=JSON.parse(JSON.stringify(DEFAULT_CBD));
let refSource='local',refLoadTime=null;

// ── 动态加载 ──────────────────────────────
async function loadRefFromSheets(){
  if(!SHEETS_URL)return false;
  const banner=document.getElementById('load-banner');
  const msg=document.getElementById('load-msg');
  if(banner)banner.style.display='flex';
  const steps=['正在连接 Google Sheets…','正在加载课程库…','正在加载老师库…','正在加载届别库…'];
  let si=0;const ticker=setInterval(()=>{if(msg)msg.textContent=steps[Math.min(si++,steps.length-1)];},700);
  try{
    const res=await fetch(SHEETS_URL+'?action=readRef',{cache:'no-store'});
    const data=await res.json();clearInterval(ticker);
    if(data.courses&&data.courses.length)C=data.courses;
    if(data.teachers&&data.teachers.length)T=data.teachers;
    if(data.cohorts&&data.cohorts.length){
      CBD={};data.cohorts.forEach(c=>{if(!CBD[c.dept])CBD[c.dept]=[];CBD[c.dept].push(c.cohort);});
    }
    refSource='sheets';refLoadTime=new Date();
    if(banner)banner.style.display='none';return true;
  }catch(e){
    clearInterval(ticker);
    if(msg)msg.textContent='⚠ 连线失败，使用内建预设数据';
    setTimeout(()=>{if(banner)banner.style.display='none';},2500);
    return false;
  }
}
async function reloadRef(){
  const ok=await loadRefFromSheets();rebuildUI();updateRefBar();
  if(ok){
    // 同步更新现有排课记录里的课程英文名
    let updated=0;
    schD.forEach(r=>{
      const f=C.find(x=>x.c===r.course);
      if(f&&f.en&&f.en!==r.en){r.en=f.en;updated++;}
    });
    spD.forEach(r=>{
      const f=C.find(x=>x.c===r.co);
      if(f&&f.en&&f.en!==r.co){r.en=f.en;updated++;}
    });
    if(updated>0){
      renderSch();renderSp();renderAllSum();
      syncNow('schedule');syncNow('special');
    }
    alert('✅ 参考数据已刷新！\n课程：'+C.length+'条　老师：'+T.length+'位　届别：'+Object.values(CBD).flat().length+'条'+(updated>0?'\n\n已更新 '+updated+' 笔排课记录的课程英文名':''));
  }else alert('⚠ 未配置 SHEETS_URL 或连线失败，目前使用内建预设数据。');
}
function updateRefBar(){
  const totalCoh=Object.values(CBD).flat().length,depts=[...new Set(T.map(t=>t.d))].length;
  document.getElementById('ref-courses').textContent='课程库 '+C.length+' 条';
  document.getElementById('ref-teachers').textContent='老师库 '+T.length+' 位';
  document.getElementById('ref-cohorts').textContent='届别库 '+totalCoh+' 条';
  document.getElementById('ref-depts').textContent='专业库 '+depts+' 个';
  document.getElementById('ref-time').textContent=refLoadTime?'更新：'+refLoadTime.toLocaleTimeString():'';
  const b=document.getElementById('src-badge');
  if(b){b.className='src-badge '+(refSource==='sheets'?'src-sheets':'src-local');
    b.textContent=refSource==='sheets'?'⬤ Google Sheets 数据':'⬤ 内建预设数据';}
}

// ── 常数与状态 ────────────────────────────
const WTS={正常:1,英文:.5,实习:1,SG:.167,Capstone:.75};
const RO={'主任老师':0,'副主任老师':1,'副院长':2,'支援活动科研老师':3,'一般老师':4,'兼市场部老师':5,'兼HR行政老师':5,'外聘':6};
const TB={正常:'b0',英文:'b6',实习:'b2',SG:'b3',Capstone:'b5'};
const CLSS=['601','602','603','604','605','331','332','333','Capstone-971','Capstone-972','Capstone-973','Capstone-974','Capstone-975','Capstone-976','Capstone-977','Capstone-978'];
const SEMS=['2569-1','2569-2','2569-3','2570-1','2570-2','2570-3'];
let schD=[],spD=[],selDpts=new Set(),btecD={};
let schSK=null,schSD=1,spSK='tc',spSD=1;

// ── 辅助 ──────────────────────────────────
function sk(s){return String(s).replace(/[^a-zA-Z0-9]/g,'_');}
function eh(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function enOnly(el){el.value=el.value.replace(/[^\x00-\x7F]/g,'');}
function siIcon(k,ck,d){if(k!==ck)return'<span style="opacity:.35;font-size:10px">⇅</span>';return'<span style="font-size:10px">'+(d>0?'▲':'▼')+'</span>';}
function tchrDrop(){return[...T].sort((a,b)=>a.d.localeCompare(b.d)||a.n.localeCompare(b.n));}
function tchrOptHTML(selectedName,placeholder){
  const label=selectedName?'— 更改老师 —':'— 选择老师 —';
  let html='<option value="">'+(placeholder||label)+'</option>';
  const bd={};
  tchrDrop().forEach(t=>{if(!bd[t.d])bd[t.d]=[];bd[t.d].push(t);});
  Object.keys(bd).sort().forEach(d=>{
    html+='<optgroup label="'+d+'">';
    bd[d].forEach(t=>{html+='<option value="'+eh(t.n)+'"'+(t.n===selectedName?' selected':'')+'>'+eh(t.n)+'</option>';});
    html+='</optgroup>';
  });
  return html;
}
function sortSch(k){if(schSK===k)schSD=-schSD;else{schSK=k;schSD=1;}renderSch();}
function sortSp(k){if(spSK===k)spSD=-spSD;else{spSK=k;spSD=1;}renderSp();}

// ── 重建 UI ───────────────────────────────
function rebuildUI(){
  const dl=document.getElementById('co-dl');dl.innerHTML='';
  [...C].sort((a,b)=>a.c.localeCompare(b.c)).forEach(x=>{const o=document.createElement('option');o.value=x.c;o.textContent=x.c+' — '+x.en;dl.appendChild(o);});
  ['s-tc','p-tc'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;el.innerHTML='<option value="">请选择</option>';
    const bd={};tchrDrop().forEach(t=>{if(!bd[t.d])bd[t.d]=[];bd[t.d].push(t);});
    Object.keys(bd).sort().forEach(d=>{const g=document.createElement('optgroup');g.label=d;bd[d].forEach(t=>{const o=document.createElement('option');o.value=t.n;o.textContent=t.n;g.appendChild(o);});el.appendChild(g);});
    el.value=cur;
  });
  // f-tc-d 专业筛选重建
  const ftcd=document.getElementById('f-tc-d');
  if(ftcd){const cur=ftcd.value;ftcd.innerHTML='<option value="">全部</option>';
    [...new Set(T.filter(t=>t.l>0).map(t=>t.d))].sort().forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=d;ftcd.appendChild(o);});ftcd.value=cur;}
  // f-st-d 专业筛选重建
  const fstd=document.getElementById('f-st-d');
  if(fstd){const cur=fstd.value;fstd.innerHTML='<option value="">全部</option>';
    [...new Set(T.filter(t=>t.l>0).map(t=>t.d))].sort().forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=d;fstd.appendChild(o);});fstd.value=cur;}
  ['f-tc','f-st'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;el.innerHTML='<option value="">请选择</option>';
    const bd={};tchrDrop().filter(t=>t.l>0).forEach(t=>{if(!bd[t.d])bd[t.d]=[];bd[t.d].push(t);});
    Object.keys(bd).sort().forEach(d=>{const g=document.createElement('optgroup');g.label=d;bd[d].forEach(t=>{const o=document.createElement('option');o.value=t.n;o.textContent=t.n;g.appendChild(o);});el.appendChild(g);});
    el.value=cur;
  });
  const fcd=document.getElementById('f-co-d');
  if(fcd){const cur=fcd.value;fcd.innerHTML='<option value="">全部</option>';
    Object.keys(CBD).sort().forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=d;fcd.appendChild(o);});fcd.value=cur;}
  const fc=document.getElementById('f-co');
  if(fc){const cur=fc.value;fc.innerHTML='<option value="">请选择</option>';
    Object.entries(CBD).forEach(([d,list])=>{const g=document.createElement('optgroup');g.label=d;list.forEach(co=>{const o=document.createElement('option');o.value=co;o.textContent=co;g.appendChild(o);});fc.appendChild(g);});fc.value=cur;}
  const depts=[...new Set([...T.map(t=>t.d)].filter(d=>!['DPU','CIC'].includes(d)))].sort();
  ['p-mj','f-sm'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value,isFilter=(id==='f-sm');
    el.innerHTML=isFilter?'<option value="">全部</option>':'<option value="">请选择</option>';
    depts.forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=d;el.appendChild(o);});el.value=cur;
  });
  buildDeptChips();buildEG('s-eg',null);
}

// ── 课程检测 ──────────────────────────────
function lookupC(ci,ei,ti){
  const code=document.getElementById(ci).value.trim().toUpperCase();
  const f=C.find(x=>x.c===code);
  if(ei)document.getElementById(ei).value=f?f.en:'';
  if(ti&&f)document.getElementById(ti).value=detectType(code,'');
}
function detectType(code,cls){
  if(cls==='IS-222'||cls==='SG-222')return'SG';
  if(cls&&cls.startsWith('Capstone'))return'Capstone';
  if(cls==='331'||cls==='332'||cls==='333')return'实习';
  if(!code)return'正常';
  const p=code.substring(0,2);
  if(p==='KE'||p==='LA'||p==='KH')return'英文';
  if(['FA405','IT410','KL411','KF411','KT411','DI403','SS412','AE491','AE492'].includes(code))return'实习';
  if(['FA401','FA402','IT430','IT433','IT434','KL412','KF412','KT412','DI404','SS411','AE399'].includes(code))return'Capstone';
  return'正常';
}
function autoType(ci,cl,ti){document.getElementById(ti).value=detectType(document.getElementById(ci).value.trim().toUpperCase(),document.getElementById(cl).value);}

// ── 届别 chip/grid ────────────────────────
function buildDeptChips(){
  const w=document.getElementById('dc-wrap');if(!w)return;w.innerHTML='';
  Object.keys(CBD).forEach(d=>{
    const b=document.createElement('button');b.className='dc'+(selDpts.has(d)?' on':'');b.textContent=d;
    b.onclick=()=>{if(selDpts.has(d))selDpts.delete(d);else selDpts.add(d);b.classList.toggle('on',selDpts.has(d));buildEG('s-eg',null);};
    w.appendChild(b);
  });
}
function buildEG(id,cc){
  const g=document.getElementById(id);if(!g)return;g.innerHTML='';
  const cm={};if(cc)cc.forEach(x=>cm[x.cohort]=x.count);
  const depts=selDpts.size>0?[...selDpts]:Object.keys(CBD);
  depts.forEach(d=>{
    if(!CBD[d])return;
    CBD[d].forEach(cohort=>{
      const k=sk(cohort),chk=cm.hasOwnProperty(cohort),cnt=cm[cohort]||'';
      const w=document.createElement('div');w.className='ei';
      w.innerHTML='<input type="checkbox" id="chk-'+k+'" value="'+eh(cohort)+'"'+(chk?' checked':'')+'>'+
        '<label for="chk-'+k+'" title="'+eh(cohort)+'">'+eh(cohort)+'</label>'+
        '<input type="number" id="cnt-'+k+'" min="0" value="'+cnt+'"'+(chk?'':' disabled')+' style="width:46px;font-size:12px;padding:2px 5px;text-align:center">';
      const cb=w.querySelector('input[type=checkbox]'),ni=w.querySelector('input[type=number]');
      cb.onchange=()=>{ni.disabled=!cb.checked;if(!cb.checked)ni.value='';};
      g.appendChild(w);
    });
  });
}
function getEG(){const r=[];document.querySelectorAll('#s-eg input[type=checkbox]:checked').forEach(cb=>{const k=sk(cb.value),n=document.getElementById('cnt-'+k);r.push({cohort:cb.value,count:n?parseInt(n.value)||0:0});});return r;}
function cohEditHTML(rid,cc){
  const cm={};cc.forEach(x=>cm[x.cohort]=x.count);
  let h='<div class="ew"><div class="ei-chips">';
  Object.keys(CBD).forEach(d=>{h+='<button class="ei-chip" onclick="egFilt('+rid+',\''+d+'\')">'+d+'</button>';});
  h+='<button class="ei-chip" onclick="egFilt('+rid+',\'\')">全部</button></div><div class="ei-g" id="egi-'+rid+'">';
  Object.entries(CBD).forEach(([d,cohorts])=>{
    cohorts.forEach(cohort=>{
      const k=sk(cohort),chk=cm.hasOwnProperty(cohort),cnt=cm[cohort]||'';
      h+='<div class="ei" data-d="'+d+'"><input type="checkbox" id="ec-'+rid+'-'+k+'" value="'+eh(cohort)+'"'+(chk?' checked':'')+' onchange="egTgl('+rid+',\''+k+'\')">'+'<label for="ec-'+rid+'-'+k+'" style="font-size:10px" title="'+eh(cohort)+'">'+eh(cohort)+'</label>'+'<input type="number" id="en-'+rid+'-'+k+'" min="0" value="'+cnt+'"'+(chk?'':' disabled')+' style="width:38px;font-size:11px;padding:1px 3px;text-align:center"></div>';
    });
  });
  return h+'</div></div>';
}
function egFilt(rid,d){document.querySelectorAll('#egi-'+rid+' .ei').forEach(el=>{el.style.display=(!d||el.dataset.d===d)?'':'none';});}
function egTgl(rid,k){const cb=document.getElementById('ec-'+rid+'-'+k),n=document.getElementById('en-'+rid+'-'+k);if(!n)return;n.disabled=!cb.checked;if(!cb.checked)n.value='';}
function collectEC(rid){const r=[];const g=document.getElementById('egi-'+rid);if(!g)return r;g.querySelectorAll('input[type=checkbox]:checked').forEach(cb=>{const k=sk(cb.value),n=document.getElementById('en-'+rid+'-'+k);r.push({cohort:cb.value,count:n?parseInt(n.value)||0:0});});return r;}

// ── 排课 CRUD ──────────────────────────────
function addSch(){
  const course=document.getElementById('s-co').value.trim().toUpperCase(),en=document.getElementById('s-en').value;
  const sem=document.getElementById('s-sem').value,half=document.getElementById('s-half').value;
  const type=document.getElementById('s-tp').value,cls=document.getElementById('s-cls').value;
  const tc=document.getElementById('s-tc').value,nt=document.getElementById('s-nt').value,cc=getEG();
  const btec=document.getElementById('s-btec')?document.getElementById('s-btec').checked:false;
  if(!course||!cls||!cc.length){alert('请填写：课程代码、班级，并至少勾选一个届别');return;}
  // 重复检查：同课程 + 同班级 + 同学期
  const dup=schD.find(r=>r.course===course&&r.cls===cls&&r.sem===sem&&r.half===half);
  if(dup){
    const go=confirm('⚠️ 重复提醒\n\n「'+course+'」已在 '+sem+' '+half+' '+cls+' 班级新增过一次。\n\n确定要继续新增吗？（如不同老师或不同届别可忽略此提醒）');
    if(!go)return;
  }
  schD.push({id:Date.now(),course,en,sem,half,type,cls,tc,cc,nt,btec,editing:false});
  clearSchF();
  renderSch();renderAllSum();renderSta();syncNow('schedule');
}
function delSch(id){
  id=String(id);
  const r=schD.find(x=>String(x.id)===id);
  if(!r)return;
  const msg='确认删除以下排课？\n\n课程代码：'+r.course+'\n班级：'+r.cls+'\n授课老师：'+(r.tc||'待定');
  if(!confirm(msg))return;
  schD=schD.filter(r=>String(r.id)!==id);
  renderSch();renderAllSum();renderSta();
  syncNow('schedule').then(()=>{}).catch(()=>alert('⚠️ 网页已删除，但 Sheets 同步失败，请手动按「↑ 上传」'));}
function startES(id){id=String(id);schD.forEach(r=>r.editing=(String(r.id)===id));renderSch();}
function saveES(id){
  id=String(id);const r=schD.find(x=>String(x.id)===id);if(!r)return;
  const g=(p)=>{const el=document.getElementById(p+id);return el?el.value:null;};
  if(g('esc-'))r.course=g('esc-').toUpperCase();
  const f=C.find(x=>x.c===r.course);if(f)r.en=f.en;
  if(g('ess-'))r.sem=g('ess-');if(g('esh-'))r.half=g('esh-');
  if(g('est-'))r.type=g('est-');if(g('escl-'))r.cls=g('escl-');
  if(g('estc-'))r.tc=g('estc-');if(g('esnt-')!==null)r.nt=g('esnt-');
  r.cc=collectEC(id);r.editing=false;renderSch();renderAllSum();renderSta();syncNow('schedule');
}
function halfBadge(h){
  if(h==='上半学期'||h==='上半')return'<span class="badge b0" style="font-size:10px">上半</span>';
  if(h==='下半学期'||h==='下半')return'<span class="badge b2" style="font-size:10px">下半</span>';
  if(h==='全学期')return'<span class="badge b6" style="font-size:10px">全学期</span>';
  return'<span style="color:#bbb;font-style:italic;font-size:10px">待定</span>';
}
function renderSch(){
  const tb=document.getElementById('sch-tb'),em=document.getElementById('sch-em');
  document.getElementById('sch-n').textContent='('+schD.length+'条)';
  const el_co=document.getElementById('si-co');if(el_co)el_co.innerHTML=siIcon('course',schSK,schSD);
  const el_sem=document.getElementById('si-sem');if(el_sem)el_sem.innerHTML=siIcon('sem',schSK,schSD);
  const el_hl=document.getElementById('si-hl');if(el_hl)el_hl.innerHTML=siIcon('half',schSK,schSD);
  if(!schD.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  const semF=document.getElementById('sch-sem-f');
  let disp=[...schD];
  if(semF&&semF.value)disp=disp.filter(r=>r.sem===semF.value);
  if(schSK==='course')disp.sort((a,b)=>schSD*a.course.localeCompare(b.course));
  if(schSK==='sem')disp.sort((a,b)=>schSD*a.sem.localeCompare(b.sem));
  if(schSK==='half'){const ho={'上半学期':0,'上半':0,'下半学期':1,'下半':1,'全学期':2};disp.sort((a,b)=>schSD*((ho[a.half]??2)-(ho[b.half]??2)));}
  tb.innerHTML=disp.map((r,i)=>{
    const tot=r.cc.reduce((s,x)=>s+(x.count||0),0);
    if(r.editing){
      const cO=SEMS.map(s=>'<option'+(s===r.sem?' selected':'')+'>'+s+'</option>').join('');
      const hO='<option value=""'+(''===r.half?' selected':'')+'>— 待定 —</option>'+[['全学期','全学期'],['上半学期','上半'],['下半学期','下半']].map(([v,t])=>'<option value="'+v+'"'+(v===r.half?' selected':'')+'>'+t+'</option>').join('');
      const ttO=['正常','英文','实习','SG','Capstone'].map(t=>'<option value="'+t+'"'+(t===r.type?' selected':'')+'>'+t+'</option>').join('');
      const ccO=CLSS.map(s=>'<option'+(s===r.cls?' selected':'')+'>'+s+'</option>').join('');
      const tccO=tchrOptHTML(r.tc);
      return'<tr class="ed"><td>'+(i+1)+'</td>'+
        '<td><input id="esc-'+r.id+'" value="'+eh(r.course)+'" style="width:80px;text-transform:uppercase"></td>'+
        '<td style="font-size:11px;color:#534AB7">'+eh(r.en)+'</td>'+
        '<td><select id="est-'+r.id+'" style="width:90px">'+ttO+'</select></td>'+
        '<td><select id="ess-'+r.id+'" style="width:78px">'+cO+'</select></td>'+
        '<td><select id="esh-'+r.id+'" style="width:90px">'+hO+'</select></td>'+
        '<td><select id="escl-'+r.id+'" style="width:100px">'+ccO+'</select></td>'+
        '<td><select id="estc-'+r.id+'" style="width:150px">'+tccO+'</select></td>'+
        '<td>'+cohEditHTML(r.id,r.cc)+'</td><td><strong>'+tot+'</strong></td>'+
        '<td><input id="esnt-'+r.id+'" value="'+eh(r.nt||'')+'" style="width:80px"></td>'+
        '<td><input type="checkbox" id="esbt-'+r.id+'"'+(r.btec?' checked':'')+' style="width:auto"></td>'+
        '<td style="white-space:nowrap"><button class="btn btn-ok" onclick="saveES('+r.id+')">确定</button> <button class="btn btn-d" onclick="delSch('+r.id+')">删除</button></td></tr>';
    }
    const tags=r.cc.map(cc=>'<span class="tag">'+eh(cc.cohort)+(cc.count?' · '+cc.count+'人':'')+'</span>').join('');
    return'<tr><td>'+(i+1)+'</td><td><span class="badge b0">'+r.course+'</span></td>'+
      '<td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+eh(r.en)+'">'+eh(r.en)+'</td>'+
      '<td><span class="badge '+(TB[r.type]||'b4')+'">'+r.type+'</span></td>'+
      '<td><span class="badge b4">'+r.sem+'</span></td><td>'+halfBadge(r.half)+'</td>'+
      '<td>'+r.cls+'</td><td style="font-size:12px;white-space:nowrap">'+(r.tc?eh(r.tc):'<span style="color:#bbb;font-style:italic">待定</span>')+'</td>'+
      '<td style="white-space:normal;min-width:120px">'+tags+'</td><td><strong>'+tot+'</strong></td>'+
      '<td style="font-size:11px;color:#888">'+eh(r.nt||'—')+'</td>'+
      '<td>'+(r.btec===true||r.btec==='TRUE'||r.btec==='true'?'<span class="badge b4" style="font-size:10px">✓</span>':'—')+'</td>'+
      '<td style="white-space:nowrap"><button class="btn btn-e" onclick="startES('+r.id+')">更动</button> <button class="btn btn-d" onclick="delSch('+r.id+')">删除</button></td></tr>';
  }).join('');
}
function clearSchF(){
  document.getElementById('s-co').value='';
  document.getElementById('s-en').value='';
  document.getElementById('s-tp').value='正常';
  document.getElementById('s-sem').selectedIndex=0;
  document.getElementById('s-half').value='';
  document.getElementById('s-cls').value='';
  document.getElementById('s-tc').value='';
  document.getElementById('s-nt').value='';
  const btecCb=document.getElementById('s-btec');if(btecCb)btecCb.checked=false;
  // 清空专业筛选 + 重建届别网格
  selDpts.clear();
  buildDeptChips();
  buildEG('s-eg',null);
}

// ── 特别排课 CRUD ─────────────────────────
function addSp(){
  const sid=document.getElementById('p-id').value.trim(),mr=document.getElementById('p-mr').value;
  const nm=document.getElementById('p-nm').value.trim(),mj=document.getElementById('p-mj').value;
  const co=document.getElementById('p-co').value.trim().toUpperCase(),en=document.getElementById('p-en').value;
  const cls=document.getElementById('p-cls').value,sem=document.getElementById('p-sem').value;
  const tc=document.getElementById('p-tc').value,nt=document.getElementById('p-nt').value;
  if(!sid||!nm||!mj||!co){alert('请填写：学号、学生姓名、学生专业、课程代码');return;}
  if(/[^\x00-\x7F]/.test(nm)){alert('学生姓名请只填写英文字');return;}
  spD.push({id:Date.now(),sid,mr,nm,mj,co,en,cls,sem,tc,nt,type:'SG',editing:false});
  clearSpF();
  renderSp();renderAllSum();renderSta();syncNow('special');
}
function delSp(id){
  id=String(id);
  const r=spD.find(x=>String(x.id)===id);
  if(!r)return;
  const msg='确认删除以下 IS/SG 排课？\n\n学生：'+(r.mr||'')+' '+r.nm+'\n课程：'+r.co+'\n授课老师：'+(r.tc||'待定');
  if(!confirm(msg))return;
  spD=spD.filter(r=>String(r.id)!==id);
  renderSp();renderAllSum();renderSta();
  syncNow('special').then(()=>{}).catch(()=>alert('⚠️ 网页已删除，但 Sheets 同步失败，请手动按「↑ 上传」'));}
function startESp(id){id=String(id);spD.forEach(r=>r.editing=(String(r.id)===id));renderSp();}
function saveESp(id){
  id=String(id);const r=spD.find(x=>String(x.id)===id);if(!r)return;
  const g=(p)=>{const el=document.getElementById(p+id);return el?el.value:null;};
  if(g('epid-'))r.sid=g('epid-');if(g('epmr-'))r.mr=g('epmr-');
  if(g('epnm-')){r.nm=g('epnm-');if(/[^\x00-\x7F]/.test(r.nm)){alert('学生姓名请只填写英文字');return;}}
  if(g('epmj-'))r.mj=g('epmj-');
  if(g('epco-')){r.co=g('epco-').toUpperCase();const f=C.find(x=>x.c===r.co);if(f)r.en=f.en;}
  if(g('epcl-'))r.cls=g('epcl-');if(g('epsm-'))r.sem=g('epsm-');
  if(g('eptc-'))r.tc=g('eptc-');if(g('epnt-')!==null)r.nt=g('epnt-');
  r.editing=false;renderSp();renderAllSum();renderSta();syncNow('special');
}
function renderSp(){
  const tb=document.getElementById('sp-tb'),em=document.getElementById('sp-em');
  document.getElementById('sp-n').textContent='('+spD.length+'条)';
  const el_sid=document.getElementById('si-sid');if(el_sid)el_sid.innerHTML=siIcon('sid',spSK,spSD);
  const el_tc=document.getElementById('si-tc');if(el_tc)el_tc.innerHTML=siIcon('tc',spSK,spSD);
  if(!spD.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  const spSemF=document.getElementById('sp-sem-f');
  let disp=[...spD];
  if(spSemF&&spSemF.value)disp=disp.filter(r=>r.sem===spSemF.value);
  if(spSK==='sid')disp.sort((a,b)=>spSD*a.sid.localeCompare(b.sid));
  if(spSK==='tc')disp.sort((a,b)=>{const ta=T.find(x=>x.n===a.tc),tb2=T.find(x=>x.n===b.tc);return spSD*((ta?ta.d:'ZZ').localeCompare(tb2?tb2.d:'ZZ')||a.tc.localeCompare(b.tc));});
  tb.innerHTML=disp.map((r,i)=>{
    if(r.editing){
      const mrO=['Mr.','Ms.'].map(m=>'<option'+(m===r.mr?' selected':'')+'>'+m+'</option>').join('');
      const dpts=[...new Set(T.map(t=>t.d).filter(d=>!['DPU','CIC'].includes(d)))].sort();
      const mjO=dpts.map(m=>'<option'+(m===r.mj?' selected':'')+'>'+m+'</option>').join('');
      const smO=SEMS.map(s=>'<option'+(s===r.sem?' selected':'')+'>'+s+'</option>').join('');
      const clO=['IS-222','SG-222'].map(c=>'<option'+(c===r.cls?' selected':'')+'>'+c+'</option>').join('');
      const tO=tchrOptHTML(r.tc);
      return'<tr class="ed"><td>'+(i+1)+'</td>'+
        '<td><input id="epid-'+r.id+'" value="'+eh(r.sid)+'" style="width:80px"></td>'+
        '<td><select id="epmr-'+r.id+'" style="width:55px">'+mrO+'</select></td>'+
        '<td><input id="epnm-'+r.id+'" value="'+eh(r.nm)+'" style="width:100px" oninput="enOnly(this)"></td>'+
        '<td><select id="epmj-'+r.id+'" style="width:60px">'+mjO+'</select></td>'+
        '<td><input id="epco-'+r.id+'" value="'+eh(r.co)+'" style="width:80px;text-transform:uppercase"></td>'+
        '<td><input id="epen-'+r.id+'" readonly value="'+eh(r.en)+'" style="width:120px;font-size:11px"></td>'+
        '<td><select id="epcl-'+r.id+'" style="width:72px">'+clO+'</select></td>'+
        '<td><select id="epsm-'+r.id+'" style="width:72px">'+smO+'</select></td>'+
        '<td><select id="eptc-'+r.id+'" style="width:150px">'+tO+'</select></td>'+
        '<td><input id="epnt-'+r.id+'" value="'+eh(r.nt||'')+'" style="width:80px"></td>'+
        '<td style="white-space:nowrap"><button class="btn btn-ok" onclick="saveESp('+r.id+')">确定</button> <button class="btn btn-d" onclick="delSp('+r.id+')">删除</button></td></tr>';
    }
    return'<tr><td>'+(i+1)+'</td><td><code style="font-size:11px">'+eh(r.sid)+'</code></td>'+
      '<td><span class="badge b4">'+r.mr+'</span></td><td>'+eh(r.nm)+'</td>'+
      '<td><span class="badge b4">'+r.mj+'</span></td><td><span class="badge b0">'+r.co+'</span></td>'+
      '<td style="max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+eh(r.en)+'">'+eh(r.en)+'</td>'+
      '<td>'+r.cls+'</td><td><span class="badge b4">'+r.sem+'</span></td>'+
      '<td style="font-size:12px;white-space:nowrap">'+(r.tc?eh(r.tc):'<span style="color:#bbb;font-style:italic">待定</span>')+'</td>'+
      '<td style="font-size:11px;color:#888">'+eh(r.nt||'—')+'</td>'+
      '<td style="white-space:nowrap"><button class="btn btn-e" onclick="startESp('+r.id+')">更动</button> <button class="btn btn-d" onclick="delSp('+r.id+')">删除</button></td></tr>';
  }).join('');
}
function clearSpF(){
  ['p-id','p-mr','p-nm','p-mj','p-co','p-cls','p-tc','p-nt'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('p-en').value='';document.getElementById('p-sem').value='2569-1';
}

// ── 学期总表 ──────────────────────────────
function filterTchrByDept(){
  const dept=document.getElementById('f-tc-d').value;
  const el=document.getElementById('f-tc');
  const cur=el.value;
  el.innerHTML='<option value="">请选择</option>';
  const bd={};
  tchrDrop().filter(t=>t.l>0).forEach(t=>{
    if(dept&&t.d!==dept)return;
    if(!bd[t.d])bd[t.d]=[];bd[t.d].push(t);
  });
  Object.keys(bd).sort().forEach(d=>{
    const g=document.createElement('optgroup');g.label=d;
    bd[d].forEach(t=>{const o=document.createElement('option');o.value=t.n;o.textContent=t.n;g.appendChild(o);});
    el.appendChild(g);
  });
  if([...el.options].some(o=>o.value===cur))el.value=cur;
  renderTchr();
}
function renderTchr(){
  const tc=document.getElementById('f-tc').value,sem=document.getElementById('f-tc-s').value,tp=document.getElementById('f-tc-t').value;
  const dept=document.getElementById('f-tc-d')?document.getElementById('f-tc-d').value:'';
  const tb=document.getElementById('tc-tb'),em=document.getElementById('tc-em');
  const lbl=(tc?tc:(dept?dept+'专业':'全部老师'))+(sem?' · '+sem:'');
  document.getElementById('tc-ttl').textContent='任课老师课程总表 · '+lbl;
  // 无需先选老师，所有条件均为可选筛选
  let data=[...schD];
  if(tc)data=data.filter(r=>r.tc===tc);
  else if(dept){const dTchrs=T.filter(t=>t.d===dept).map(t=>t.n);data=data.filter(r=>dTchrs.includes(r.tc));}
  if(sem)data=data.filter(r=>r.sem===sem);
  if(tp)data=data.filter(r=>r.type===tp);
  // 加入 SG/IS 排课
  let spRows=[];
  if(!tp||tp==='SG'){
    let spData=[...spD];
    if(tc)spData=spData.filter(r=>r.tc===tc);
    else if(dept){const dTchrs=T.filter(t=>t.d===dept).map(t=>t.n);spData=spData.filter(r=>dTchrs.includes(r.tc));}
    if(sem)spData=spData.filter(r=>r.sem===sem);
    const spMap={};
    spData.forEach(r=>{
      const k=r.co+'|'+r.sem;
      if(!spMap[k])spMap[k]={co:r.co,en:r.en,sem:r.sem,cls:r.cls,tc:r.tc,stus:[]};
      spMap[k].stus.push(r.mr+' '+r.nm);
    });
    spRows=Object.values(spMap);
  }
  if(!data.length&&!spRows.length){tb.innerHTML='';em.textContent='暂无符合条件的排课记录';em.style.display='block';return;}
  em.style.display='none';
  const schRows=data.map((r,i)=>{const tot=r.cc.reduce((s,x)=>s+(x.count||0),0);
    return'<tr><td>'+(i+1)+'</td><td><span class="badge b0">'+r.course+'</span></td>'+
      '<td style="max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+eh(r.en)+'</td>'+
      '<td><span class="badge '+(TB[r.type]||'b4')+'">'+r.type+'</span></td>'+
      '<td style="font-size:11px;white-space:nowrap">'+(r.tc?eh(r.tc):'<span style="color:#bbb;font-style:italic">待定</span>')+'</td>'+
      '<td>'+r.cls+'</td><td><span class="badge b4">'+r.sem+'</span></td>'+
      '<td>'+halfBadge(r.half)+'</td><td>'+(tot||'—')+'</td>'+
      '<td style="font-size:11px;color:#888">'+eh(r.nt||'—')+'</td>'+'<td>'+(r.btec?'<span class="badge b4" style="font-size:10px">BTEC</span>':'—')+'</td></tr>';}).join('');
  const sgRows=spRows.map((r,i)=>
    '<tr style="background:#FFF8F0"><td>'+(data.length+i+1)+'</td>'+
    '<td><span class="badge b0">'+r.co+'</span></td>'+
    '<td style="max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+eh(r.en)+'</td>'+
    '<td><span class="badge b3">SG/IS</span></td>'+
    '<td style="font-size:11px;white-space:nowrap">'+eh(r.tc||'—')+'</td>'+
    '<td>'+r.cls+'</td><td><span class="badge b4">'+r.sem+'</span></td>'+
    '<td>—</td><td>'+r.stus.length+'</td>'+
    '<td style="font-size:11px;color:#888">'+r.stus.map(s=>eh(s)).join('、')+'</td></tr>').join('');
  tb.innerHTML=schRows+sgRows;
}
function filterCohByDept(){
  const dept=document.getElementById('f-co-d').value;
  const fc=document.getElementById('f-co');
  const cur=fc.value;
  fc.innerHTML='<option value="">请选择</option>';
  Object.entries(CBD).forEach(([d,list])=>{
    if(dept&&d!==dept)return;
    const g=document.createElement('optgroup');g.label=d;
    list.forEach(co=>{const o=document.createElement('option');o.value=co;o.textContent=co;g.appendChild(o);});
    fc.appendChild(g);
  });
  if([...fc.options].some(o=>o.value===cur))fc.value=cur;
  renderCoh();
}
function renderCoh(){
  const co=document.getElementById('f-co').value,sem=document.getElementById('f-co-s').value;
  const dept=document.getElementById('f-co-d')?document.getElementById('f-co-d').value:'';
  const tb=document.getElementById('co-tb'),em=document.getElementById('co-em');
  // 无需先选届别，直接显示全部
  let data=[...schD];
  if(co)data=data.filter(r=>r.cc.some(x=>x.cohort===co));
  else if(dept)data=data.filter(r=>r.cc.some(x=>Object.keys(CBD).filter(d=>d===dept).flatMap(d=>CBD[d]).includes(x.cohort)));
  if(sem)data=data.filter(r=>r.sem===sem);
  if(!data.length){tb.innerHTML='';em.textContent='暂无符合条件的排课记录';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=data.map((r,i)=>'<tr><td>'+(i+1)+'</td><td><span class="badge b0">'+r.course+'</span></td>'+
    '<td style="max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+eh(r.en)+'</td>'+
    '<td><span class="badge '+(TB[r.type]||'b4')+'">'+r.type+'</span></td>'+
    '<td>'+r.cls+'</td><td><span class="badge b4">'+r.sem+'</span></td>'+
    '<td>'+halfBadge(r.half)+'</td><td style="font-size:12px">'+eh(r.tc)+'</td></tr>').join('');
}
function renderSpStu(){
  const q=(document.getElementById('f-stu').value||'').toLowerCase();
  const mj=document.getElementById('f-sm').value;
  const sem=document.getElementById('f-sp-sem')?document.getElementById('f-sp-sem').value:'';
  let data=spD;
  if(q)data=data.filter(r=>(r.nm+r.sid).toLowerCase().includes(q));
  if(mj)data=data.filter(r=>r.mj===mj);
  if(sem)data=data.filter(r=>r.sem===sem);
  const tb=document.getElementById('ss-tb'),em=document.getElementById('ss-em');
  if(!data.length){tb.innerHTML='';em.style.display='block';return;}em.style.display='none';
  const map={};data.forEach(r=>{if(!map[r.sid])map[r.sid]={sid:r.sid,mr:r.mr,nm:r.nm,mj:r.mj,rows:[]};map[r.sid].rows.push(r);});
  let idx=0;
  tb.innerHTML=Object.values(map).map(s=>{idx++;
    return'<tr><td>'+idx+'</td><td><code style="font-size:11px">'+eh(s.sid)+'</code></td>'+
      '<td>'+s.mr+'</td><td>'+eh(s.nm)+'</td><td><span class="badge b4">'+s.mj+'</span></td>'+
      '<td><strong>'+s.rows.length+'</strong></td>'+
      '<td>'+s.rows.map(r=>'<span class="badge b0" style="margin:1px">'+r.co+'</span><span class="tag" style="margin:1px">'+r.cls+'</span>').join('<br>')+'</td>'+
      '<td>'+s.rows.map(r=>'<span style="font-size:11px">'+eh(r.en)+'</span>').join('<br>')+'</td>'+
      '<td>'+s.rows.map(r=>'<span class="badge b4" style="margin:1px">'+r.sem+'</span>').join('<br>')+'</td>'+
      '<td style="font-size:11px;color:#888">'+(s.rows.filter(r=>r.nt).map(r=>r.nt).join('；')||'—')+'</td></tr>';}).join('');
}
function filterSpTchrByDept(){
  const dept=document.getElementById('f-st-d').value;
  const el=document.getElementById('f-st');
  const cur=el.value;
  el.innerHTML='<option value="">请选择</option>';
  const bd={};
  tchrDrop().filter(t=>t.l>0).forEach(t=>{
    if(dept&&t.d!==dept)return;
    if(!bd[t.d])bd[t.d]=[];bd[t.d].push(t);
  });
  Object.keys(bd).sort().forEach(d=>{
    const g=document.createElement('optgroup');g.label=d;
    bd[d].forEach(t=>{const o=document.createElement('option');o.value=t.n;o.textContent=t.n;g.appendChild(o);});
    el.appendChild(g);
  });
  if([...el.options].some(o=>o.value===cur))el.value=cur;
  renderSpTchr();
}
function renderSpTchr(){
  const tc=document.getElementById('f-st').value;
  const sem=document.getElementById('f-st-s')?document.getElementById('f-st-s').value:'';
  const dept=document.getElementById('f-st-d')?document.getElementById('f-st-d').value:'';
  const tb=document.getElementById('st-tb'),em=document.getElementById('st-em');
  // 预设显示全部，筛选缩小
  let data=[...spD];
  if(tc)data=data.filter(r=>r.tc===tc);
  if(sem)data=data.filter(r=>r.sem===sem);
  if(dept&&!tc){
    // 只选专业时，筛选该专业老师的记录
    const deptTchrs=T.filter(t=>t.d===dept).map(t=>t.n);
    data=data.filter(r=>deptTchrs.includes(r.tc));
  }
  if(!data.length){tb.innerHTML='';em.textContent='暂无符合条件的 SG/IS 排课记录';em.style.display='block';return;}
  em.style.display='none';
  // 按课程+老师分组
  const cm={};
  data.forEach(r=>{
    const k=r.co+'|'+r.tc;
    if(!cm[k])cm[k]={co:r.co,en:r.en,tc:r.tc,stus:[]};
    cm[k].stus.push({sid:r.sid,mr:r.mr,nm:r.nm,mj:r.mj,sem:r.sem});
  });
  let idx=0;let rowNum=0;
  tb.innerHTML=Object.values(cm).map(x=>{
    const n=x.stus.length;
    rowNum++;
    return x.stus.map((s,si)=>{
      idx++;
      return'<tr>'+
        (si===0?
          '<td rowspan="'+n+'" style="color:#bbb;font-size:11px">'+rowNum+'</td>'+
          '<td rowspan="'+n+'"><span class="badge b0">'+x.co+'</span></td>'+
          '<td rowspan="'+n+'" style="max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+eh(x.en)+'</td>'+
          '<td rowspan="'+n+'" style="font-size:12px;white-space:nowrap">'+eh(x.tc)+'</td>'
        :'')+
        '<td><code style="font-size:11px">'+eh(s.sid||'—')+'</code></td>'+
        '<td><span class="badge b4" style="font-size:10px">'+eh(s.mr)+'</span></td>'+
        '<td style="white-space:nowrap">'+eh(s.nm)+'</td>'+
        '<td><span class="badge b4">'+eh(s.mj)+'</span></td>'+
        '<td><span class="badge b4">'+eh(s.sem)+'</span></td>'+
        (si===0?'<td rowspan="'+n+'"><strong>'+n+'</strong></td>':'')+
        '</tr>';
    }).join('');
  }).join('');
}
function renderAllSum(){renderTchr();renderCoh();renderSpStu();renderSpTchr();}

// ── 教学统计 ──────────────────────────────
function semDetail(tc,sem){
  const sch=schD.filter(r=>r.tc===tc&&r.sem===sem);
  const sp=spD.filter(r=>r.tc===tc&&r.sem===sem);
  const cnt={正常:0,英文:0,实习:0,SG:sp.length,Capstone:0};
  sch.forEach(r=>cnt[r.type]=(cnt[r.type]||0)+1);
  const wt=Math.round((cnt.正常*WTS.正常+cnt.英文*WTS.英文+cnt.实习*WTS.实习+cnt.SG*WTS.SG+cnt.Capstone*WTS.Capstone)*100)/100;
  return{wt,cnt};
}
function sdCells(d,bl){
  if(!d)return '<td class="sem-cell" style="text-align:center;'+(bl?'border-left:1px solid #eee;':'')+'"><span class="sem-zero">—</span></td>';
  const s=bl?'border-left:1px solid #eee;':'';
  const hasData=d.wt>0;
  // 细项 tooltip
  const tipRows=[
    ['正常',d.cnt.正常,'b0'],['英文',d.cnt.英文,'b6'],
    ['实习',d.cnt.实习,'b2'],['SG',d.cnt.SG,'b3'],['Cap',d.cnt.Capstone,'b5']
  ].filter(([,n])=>n>0)
   .map(([k,n,b])=>'<div class="tip-row"><span class="badge '+b+'" style="font-size:10px">'+k+'</span><span>'+n+'门</span></div>')
   .join('');
  const tip=hasData?'<div class="sem-tip"><div style="color:#888;font-size:11px;margin-bottom:4px">课程细项</div>'+tipRows+'</div>':'';
  return'<td class="sem-cell" style="text-align:center;'+s+'">'+
    (hasData?'<span class="sem-val">'+d.wt+'</span>':'<span class="sem-zero">—</span>')+
    tip+'</td>';
}
function saveBtec(el){
  const name=el.dataset.name;
  const val=el.value;
  btecD[name]=parseFloat(val)||0;
  // 更新学年总数显示（不重绘整表，只更新该行的相关 td）
  const t=T.find(x=>x.n===name);
  const k=name.replace(/[^a-zA-Z0-9]/g,'_');
  const d1=semDetail(name,'2569-1'),d2=semDetail(name,'2569-2'),d3=semDetail(name,'2569-3');
  const totalWt=Math.round((d1.wt+d2.wt+d3.wt)*100)/100;
  const btec=btecD[name]||0;
  const yearTotal=Math.round((totalWt+btec)*100)/100;
  const pct=t&&t.l>0?Math.round(yearTotal/t.l*100):0;
  const over=t&&t.l>0&&yearTotal>t.l;
  const ytEl=document.getElementById('yt-'+k);if(ytEl)ytEl.textContent=yearTotal;
  const pEl=document.getElementById('pct-'+k);
  if(pEl){pEl.textContent=pct+'% / '+(t?t.l:'—');pEl.className='badge '+(over?'b3':'b1');}
  autoSyncBtec();
}
let btecSyncTimer=null;
function autoSyncBtec(){
  if(!SHEETS_URL)return;
  clearTimeout(btecSyncTimer);
  btecSyncTimer=setTimeout(async()=>{
    try{
      const btecPayload=encodeURIComponent(JSON.stringify(btecD));
      const br=await (await fetchWithRetry(SHEETS_URL+'?action=write&type=btec&payload='+btecPayload,{cache:'no-store'})).json();
      setSyncStatus(br.success?'✅ BTEC 已同步 '+new Date().toLocaleTimeString():'❌ BTEC 同步失败',br.success);
    }catch(e){setSyncStatus('❌ BTEC 同步失败',false);}
  },1500);
}
function renderSta(){
  const yr=document.getElementById('sta-yr')?document.getElementById('sta-yr').value:'';
  // 根据学年决定显示哪三个学期
  const activeSems=yr?['1','2','3'].map(s=>yr+'-'+s):[];
  // 动态产生表头
  // 学年筛选标题已在左上角显示，不需要副标签
  const actT=[...new Set([...schD.map(r=>r.tc),...spD.map(r=>r.tc)])].filter(Boolean).length;
  document.getElementById('sta-m').innerHTML=[
    [schD.length,'排课记录'],[spD.length,'特别排课'],
    [schD.reduce((s,r)=>s+r.cc.length,0),'届别课次'],
    [actT,'参与老师'],[schD.filter(r=>r.type==='Capstone').length,'Capstone课程']
  ].map(([v,l])=>'<div class="mc"><div class="mv">'+v+'</div><div class="ml">'+l+'</div></div>').join('');

  const depts=[...new Set(T.filter(t=>t.l>0).map(t=>t.d))].sort();
  let rows='';let hasData=false;

  depts.forEach(dept=>{
    const dTchrs=T.filter(t=>t.d===dept&&t.l>0).sort((a,b)=>a.n.localeCompare(b.n));
    // colspan = 3 + 6*3 + 5 = 26
    rows+='<tr class="dh"><td colspan="'+(8+activeSems.length)+'">▸ '+dept+' · '+dTchrs.length+'位老师</td></tr>';
    let dWt=0;let idx=0;

    dTchrs.forEach(t=>{
      idx++;hasData=true;
      const k=t.n.replace(/[^a-zA-Z0-9]/g,'_');
      const semDetails=activeSems.map(s=>semDetail(t.n,s));
      const d1=semDetails[0],d2=semDetails[1],d3=semDetails[2];
      // 总计 = 所有已选学年的学期（或全部学年）
      const totalSems=yr?activeSems:['2569-1','2569-2','2569-3','2570-1','2570-2','2570-3'];
      const totalWt=Math.round(totalSems.reduce((s,sem)=>{const d=semDetail(t.n,sem);return s+d.wt;},0)*100)/100;
      const btec=btecD[t.n]||0;
      // 统计该老师在选定学期内的 BTEC 课程数
      const btecCount=totalSems.reduce((s,sem)=>s+schD.filter(r=>r.tc===t.n&&r.sem===sem&&r.btec).length,0);
      const btecWt=Math.round(btecCount*0.5*100)/100;
      const yearTotal=Math.round((totalWt+btecWt+btec)*100)/100;
      dWt+=yearTotal;
      const pct=t.l>0?Math.round(yearTotal/t.l*100):0;
      const over=t.l>0&&yearTotal>t.l;

      rows+='<tr>'+
        '<td style="color:#bbb;font-size:11px">'+idx+'</td>'+
        '<td style="font-size:12px;white-space:nowrap">'+eh(t.n)+'</td>'+
        '<td style="font-size:11px;color:#888;white-space:nowrap">'+t.r+'</td>'+
        sdCells(d1,true)+sdCells(d2,true)+sdCells(d3,true)+
        // 教学总数
        '<td style="text-align:center;border-left:1px solid #eee;font-weight:500">'+totalWt+'</td>'+
        // BTEC 栏（显示加权值 门数×0.5）
        '<td style="text-align:center;background:#F5F4FE;padding:3px">'+
          (btecCount>0?'<span style="font-size:13px;font-weight:600;color:#534AB7">'+btecWt+'</span>':'<span style="color:#ddd">—</span>')+
        '</td>'+
        // LA500 手填
        '<td style="text-align:center;background:#F5F4FE;padding:3px">'+
          '<input type="number" id="btec-'+k+'" value="'+(btec||'')+'" min="0" step="0.5" '+
          'style="width:58px;font-size:12px;padding:2px 4px;text-align:center;background:#fff;border:0.5px solid #AFA9EC;border-radius:5px" '+
          'onchange="saveBtec(this)" data-name="'+eh(t.n)+'" placeholder="0">'+
        '</td>'+
        // 学年规定
        '<td style="text-align:center;color:#888;font-size:11px">'+t.l+'</td>'+
        // 学年总数
        '<td style="text-align:center"><strong id="yt-'+k+'">'+yearTotal+'</strong></td>'+
        // %
        '<td><span class="badge '+(over?'b3':'b1')+'" id="pct-'+k+'">'+pct+'% / '+t.l+'</span></td>'+
        '</tr>';
    });

    // 专业小计
    rows+='<tr class="dt">'+
      '<td colspan="3" style="text-align:right;padding-right:12px">'+dept+' 小计</td>'+
      '<td colspan="'+activeSems.length+'"></td>'+
      '<td style="text-align:center;border-left:1px solid #eee"><strong>'+Math.round(dWt*100)/100+'</strong></td>'+
      '<td colspan="3"></td></tr>';
  });

  if(!yr){document.getElementById('sta-em').textContent='请先选择学年';document.getElementById('sta-em').style.display='block';document.getElementById('sta-tb').innerHTML='';return;}
  if(!hasData){document.getElementById('sta-em').style.display='block';document.getElementById('sta-tb').innerHTML='';return;}
  document.getElementById('sta-em').style.display='none';
  document.getElementById('sta-tb').innerHTML=rows;
}

// ── JSON 导出/导入 ────────────────────────
function exportData(){
  const data={version:'2569-v2',exported:new Date().toISOString(),schedule:schD,special:spD};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download='排课数据_'+new Date().toISOString().slice(0,10)+'.json';a.click();
}
function importData(){
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.onchange=e=>{
    const reader=new FileReader();
    reader.onload=ev=>{
      try{const data=JSON.parse(ev.target.result);
        if(data.schedule)schD=data.schedule;if(data.special)spD=data.special;
        renderSch();renderSp();renderAllSum();renderSta();
        alert('导入成功！排课记录：'+schD.length+'条，特别排课：'+spD.length+'条');
      }catch(e){alert('导入失败，请检查文件格式');}
    };reader.readAsText(e.target.files[0]);
  };input.click();
}

// ── Sheets 同步 ───────────────────────────
let syncTimer=null;
function setSyncStatus(msg,ok){
  const el=document.getElementById('sync-status-bar');
  if(el){el.textContent=msg;el.style.color=ok===true?'#3B6D11':ok===false?'#a32d2d':'#888';}
  const bar=document.getElementById('sync-bar-inner');
  if(!bar)return;
  bar.classList.remove('running','done','fail');
  if(ok===''){bar.classList.add('running');}
  else if(ok===true){bar.classList.add('done');setTimeout(()=>{bar.style.width='0%';},2000);}
  else if(ok===false){bar.classList.add('fail');setTimeout(()=>{bar.style.width='0%';},3000);}
}

// 通用重试（最多 2 次，间隔 2 秒）
async function fetchWithRetry(url,opts={},retry=2,delay=2000){
  for(let i=0;i<=retry;i++){try{return await fetch(url,opts);}catch(e){if(i===retry)throw e;await new Promise(r=>setTimeout(r,delay));}}
}
// 自动同步（静默，防抖 500ms，GET + 自动重试）
async function syncNow(type){
  if(!SHEETS_URL)return;
  setSyncStatus('⏳ 正在同步…','');
  try{
    const data=type==='schedule'?schD:spD;
    const payload=encodeURIComponent(JSON.stringify(data));
    const res=await fetchWithRetry(SHEETS_URL+'?action=write&type='+type+'&payload='+payload,{cache:'no-store'});
    const r=await res.json();
    const t=new Date().toLocaleTimeString();
    setSyncStatus(r.success?'✅ 已同步 '+t:'❌ 同步失败',r.success);
  }catch(e){setSyncStatus('❌ 连线失败（已重试）',false);}}
function autoSync(type){
  if(!SHEETS_URL)return;
  clearTimeout(syncTimer);
  setSyncStatus('⏳ 正在同步…','');
  syncTimer=setTimeout(()=>syncNow(type),500);
}

// 手动全部同步（有提示，使用 GET）
async function syncAll(){
  if(!SHEETS_URL){alert('请先配置 SHEETS_URL');return;}
  setSyncStatus('⏳ 正在同步…','');
  try{
    const r1=await fetchWrite('schedule',schD);
    const r2=await fetchWrite('special',spD);
    const t=new Date().toLocaleTimeString();
    setSyncStatus((r1&&r2)?'✅ 已同步 '+t:'❌ 部分失败',r1&&r2);
    alert(r1&&r2?'✅ 两份数据已同步至 Google Sheets！':'❌ 同步失败，请检查连线');
  }catch(e){setSyncStatus('❌ 连线失败',false);alert('❌ 连线失败');}
}
async function fetchWrite(type,data){
  const payload=encodeURIComponent(JSON.stringify(data));
  const res=await fetchWithRetry(SHEETS_URL+'?action=write&type='+type+'&payload='+payload,{cache:'no-store'});
  const r=await res.json();return r.success;
}

// 手动上传（有提示，使用 GET）
async function syncToSheets(type){
  if(!SHEETS_URL){alert('请先配置 SHEETS_URL');return;}
  const data=type==='schedule'?schD:spD;
  setSyncStatus('⏳ 正在同步…','');
  try{
    const ok=await fetchWrite(type,data);
    const t=new Date().toLocaleTimeString();
    setSyncStatus(ok?'✅ 已同步 '+t:'❌ 同步失败',ok);
    ok?alert('✅ 上传成功！'):alert('❌ 上传失败');
  }catch(e){setSyncStatus('❌ 连线失败',false);alert('❌ 连线失败');}
}
async function syncFromSheets(type){
  if(!SHEETS_URL){alert('请先配置 SHEETS_URL');return;}
  try{const res=await fetchWithRetry(SHEETS_URL+'?action=read&type='+type,{cache:'no-store'});
    const r=await res.json();
    if(r.success){if(type==='schedule')schD=r.data;else spD=r.data;
      renderSch();renderSp();renderAllSum();renderSta();alert('✅ 下载成功！'+r.data.length+'条记录');
    }else alert('❌ 下载失败：'+r.error);
  }catch(e){alert('❌ 连线失败');}
}

// ── 标签切换 ──────────────────────────────
function printPanel(id){
  switchTab(id);
  const titles={
    'sch':'排课记录',
    'sp':'IS/SG 排课记录',
    'sum':'学期总表',
    'sta':'教学统计 · 各授课老师工作量'
  };
  const subtitles={
    'sch':'课程安排总览',
    'sp':'IS/SG 特别排课学生名单',
    'sum':'学期课程综合总表',
    'sta':'专业分组工作量统计（含BTEC/LA500）'
  };
  const now=new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});
  const hdr=document.getElementById('print-header');
  if(hdr){
    hdr.innerHTML='<h1>2569学年 CIC 本科排课管理系统 · '+titles[id]+'</h1>'+
      '<p>'+subtitles[id]+'　｜　列印日期：'+now+'　｜　数据来源：Google Sheets</p>';
  }
  setTimeout(()=>window.print(), 300);
}
function switchTab(id){
  ['sch','sp','sum','sta'].forEach((x,i)=>{document.querySelectorAll('.tab')[i].classList.toggle('active',x===id);});
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+id).classList.add('active');
  if(id==='sta')renderSta();if(id==='sum')renderAllSum();
}
function switchSub(id){
  document.querySelectorAll('.stab').forEach(t=>t.classList.toggle('active',t.getAttribute('onclick').includes(id)));
  document.querySelectorAll('.spanel').forEach(p=>p.classList.remove('active'));
  document.getElementById('sub-'+id).classList.add('active');
}

// ── 启动 ──────────────────────────────────
// ── 启动时从 Sheets 载入主数据 ──────────────
async function loadDataFromSheets(){
  if(!SHEETS_URL)return;
  setSyncStatus('⏳ 正在载入排课数据…','');
  try{
    const [r1,r2,r3]=await Promise.all([
      fetch(SHEETS_URL+'?action=read&type=schedule',{cache:'no-store'}).then(r=>r.json()),
      fetch(SHEETS_URL+'?action=read&type=special',{cache:'no-store'}).then(r=>r.json()),
      fetch(SHEETS_URL+'?action=read&type=btec',{cache:'no-store'}).then(r=>r.json())
    ]);
    if(r1.success&&r1.data.length){schD=r1.data;}
    if(r2.success&&r2.data.length){spD=r2.data;}
    if(r3.success&&r3.data){btecD=r3.data;}
    const t=new Date().toLocaleTimeString();
    setSyncStatus('✅ 数据已载入 '+t,true);
  }catch(e){
    setSyncStatus('❌ 载入失败，请手动下载',false);
  }
}

async function init(){
  await loadRefFromSheets();  // 1. 载入参考数据（课程/老师/届别）
  rebuildUI();                // 2. 重建下拉选单
  updateRefBar();             // 3. 更新状态栏
  await loadDataFromSheets(); // 4. 载入排课记录 + 特别排课
  renderSch();renderSp();renderSta(); // 5. 渲染画面
}
// init() 由 unlockApp() 触发
