#!/usr/bin/env node
// CIC BA 排课 · 课表制作「📝 注册用课表」方案 A 检查(2026-11-25)
// 打开页面(匿名只读,写入一律拦下),用该学期的存档(没有就一键排一次)画出注册用课表,列出:版块 1/2/3 各占哪些格、冲突的一般课与届别,并存一张截图。
// 用法:  node tools/tt_reg_check.mjs [学期=2569-2] [输出资料夹]   只需 Node 22+ 与 Chrome。改到注册用课表时,推送前跑一次。
// 用无头 Chrome 打开页面(匿名只读,写入一律拦下),对「按课程」「按上/下半」两种排序各量:
//   ① 画面表格的课程顺序  ② 导出 Excel 的课程顺序(必须和画面一样)  ③ 列印版面(列印媒体)实际印出的课数、页数(必须是全部课,不能只印一部分)
// 用法:  node tools/tt_dates_check.mjs [学期=2569-2] [输出资料夹] [网站根资料夹=本 repo]
//   第三个参数可指向别的拷贝(例如旧版 worktree)来重现问题。只需 Node 22+ 与 Chrome。改到上课日期的导出/列印时,推送前跑一次。
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[4] ? resolve(process.argv[4]) : join(dirname(fileURLToPath(import.meta.url)), '..');
const SEM = process.argv[2] || '2569-2', OUT = process.argv[3] || join(tmpdir(), 'tt-reg-check');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && existsSync(p));
await mkdir(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => { try { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(ROOT, p === '/' ? 'index.html' : p); if (!f.startsWith(ROOT)) throw 0; res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const target = `http://127.0.0.1:${server.address().port}/index.html`;
const profile = await mkdtemp(join(tmpdir(), 'ba-reg-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1400,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => { let buf = ''; const t = setTimeout(() => rej(new Error('Chrome 启动超时')), 20000); chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } }); });
const port = new URL(wsUrl).port;
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const pending = new Map(); const errors = [];
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; } if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(((d.exception && d.exception.description) || d.text).split('\n')[0]); } };
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text); return r.result && r.result.result ? r.result.result.value : undefined; };

let fail = 0; const ok = (good, msg) => { if (!good) fail++; console.log((good ? '✅ ' : '❌ ') + msg); };
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: target + '?dc=' + Date.now() }); await sleep(3000);
  await evaluate(`(function(){window.gasPost=async function(){return {success:true};};window.alert=function(){};window.confirm=function(){return false;};window.print=function(){};
    window.__blob=null;const o=URL.createObjectURL.bind(URL);URL.createObjectURL=function(b){window.__blob=b;return o(b);};return true;})()`);
  await evaluate(`(currentRole='teacher', unlockApp(), true)`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await evaluate(`(typeof schD!=='undefined'&&schD.length>0)`)) break; }
  await evaluate(`switchTab('tt')`); await sleep(1500);
  await evaluate(`(function(){const s=document.getElementById('tt-sem');s.value='${SEM}';s.dispatchEvent(new Event('change'));return true;})()`); await sleep(3000);
  // 有存档就用存档的课表;没有就一键排一次
  const hasSol = await evaluate(`(!!(_ttCache.sol||_ttCache.tt))`);
  if (!hasSol) { await evaluate(`(ttAutoSolve(),true)`); for (let i = 0; i < 240; i++) { await sleep(500); if (await evaluate(`(!_ttSolving&&!!_ttCache.sol)`)) break; } }
  const SOLX = '(_ttCache.sol||(_ttCache.tt?_ttSolutionFromSaved(_ttCache.sem,_ttCache.tt):null))';
  const info = JSON.parse(await evaluate(`(function(){const sol=${SOLX};return JSON.stringify(sol?{caps:(sol.placements||[]).filter(p=>p.isCap).length,plan:(function(){const P=_ttRegPlanA(sol);return {b1:P.txt('b1'),b2:P.txt('b2'),b3:P.txt('b3'),hit:P.hit.map(h=>({c:_ttName(h.p),co:h.co,wh:h.wh}))};})()}:null);})()`));
  if (!info) { ok(false, '没有可测的课表'); throw new Error('no sol'); }
  console.log(`学期 ${SEM}:Capstone ${info.caps} 门`);
  if (info.caps === 0) { ok(/没有 Capstone 课/.test(await evaluate(`(function(){const sol=${SOLX};return _ttRegHtml(sol);})()`)), '这学期没有 Capstone 课:画面写明「没有 Capstone 课」,略过其余检查'); throw new Error('no sol'); }
  console.log(`  版块 1:${info.plan.b1}　版块 2:${info.plan.b2}　版块 3:${info.plan.b3}`);
  info.plan.hit.forEach(h => console.log(`  冲突:${h.c}（${h.wh.join('、')}）→ ${h.co.join('、')}`));
  ok(info.caps > 0, '有 Capstone 课');
  ok(/整天/.test(info.plan.b1) && /整天/.test(info.plan.b2), '版块 1、2 都在周五整天');
  ok(info.plan.b3.split('＋').length === 2, '版块 3 有两格');
  // 画出来 + 截图
  const txt = await evaluate(`(function(){const sol=${SOLX};let d=document.getElementById('__regchk');if(d)d.remove();d=document.createElement('div');d.id='__regchk';d.style.cssText='position:absolute;left:0;top:0;width:1000px;background:#fff;z-index:99999;padding:12px';d.innerHTML=_ttRegHtml(sol);document.body.appendChild(d);return d.innerText;})()`);
  ok(/三个版块总览/.test(txt) && /版块 1＋3 的学生/.test(txt) && /版块 2 的学生/.test(txt), '画面有:三个版块总览、版块 1＋3、版块 2 的学生');
  ok(!/重新选第二天|还没选定/.test(txt), '画面没有旧的「第二天」字样');
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1024, height: 1500, scale: 1 } });
  if (shot.result && shot.result.data) { await writeFile(join(OUT, `reg-${SEM}.png`), Buffer.from(shot.result.data, 'base64')); console.log(`  截图:${join(OUT, `reg-${SEM}.png`)}`); }
  // 老师「注册打卡」:依授课老师表要有注册时间(版块 3 在周五以外),地点 51305;版块 1、2 的老师不重复列
  const clk = JSON.parse(await evaluate(`JSON.stringify((function(){const sol=${SOLX};const D=_ttEntityData(sol,'teacher');const o={};Object.keys(D.grp).forEach(function(t){const r=D.grp[t].raw,ks=Object.keys(r).filter(function(k){return r[k].some(function(x){return x.p._regClk;});});if(ks.length)o[t]=ks.map(function(k){const x=r[k].filter(function(y){return y.p._regClk;})[0];return k+'@'+x.p.room+'|'+x.p.count+'人';});});return {o:o,html:_ttEntityCards(sol,'teacher').indexOf('注册打卡')>=0,fri:(function(){const e=D.grp['Aj. Xu, Yan'];return !!(e&&e.raw['下|周五|am']&&e.raw['下|周五|pm']);})()};})())`));
  console.log('  注册打卡:' + JSON.stringify(clk.o));
  if (info.plan.b3 !== '周五整天') {
    const t3 = clk.o['Aj. Xu, Yan'] || [];
    ok(t3.length === 2 && t3.every(x => /@\d+\|/.test(x)), '版块 3 老师(Aj. Xu)有两格注册打卡(有教室)');
    ok(clk.fri, '版块 3 老师同时保留周五整天(实际带班)');
  }
  ok(!clk.o['Aj. Liu, Feng-Lin'] && !clk.o['Aj. Lu, Peng'], '版块 1、2 的老师(注册时间＝周五)不重复列注册打卡');
  ok(clk.html, '依授课老师画面出现「注册打卡」');
  // 上课日期:Capstone 一律按注册打卡的时间列,每次 3 小时、15 次＝45 小时
  const dr = JSON.parse(await evaluate(`JSON.stringify((function(){const sol=${SOLX};const rows=_ttCourseDateRows(sol);if(!rows)return null;return rows.filter(function(r){return r.cap;}).map(function(r){return {n:r.name,tc:r.tc,legs:r.legs.map(function(l){return l.wd+l.slot+'@'+l.room+(l.reg?'*':'')+' '+l.dates.length+'天';}),total:r.total,hrs:r.hrs};});})())`));
  if (!dr) console.log('  (这学期没设定上下半日期,略过「上课日期」检查)');
  else {
    dr.forEach(r => console.log(`  上课日期 ${r.n}｜${r.tc}｜${r.legs.join(' / ')}｜${r.total} 次 ${r.hrs} 小时`));
    ok(dr.length > 0 && dr.every(r => r.total === 15 && r.hrs === 45), '上课日期:每门 Capstone 都是 15 次、45 小时');
    const b3 = dr.filter(r => r.legs.some(l => l.includes('*')));
    if (info.plan.b3 !== '周五整天') ok(b3.length > 0 && b3.every(r => r.legs.every(l => /@\d+/.test(l))), '上课日期:版块 3 的 Capstone 按注册打卡的时间列(周二／周四下午，教室=自动挑出的那间)');
    ok(dr.filter(r => !r.legs.some(l => l.includes('*'))).every(r => r.legs.every(l => l.startsWith('周五'))), '上课日期:版块 1、2 的 Capstone 仍是周五上午＋下午');
  }
  // 注册打卡教室(2026-11-25):预设 51305、可改、跟着存档走;被占用／容量不够会警告
  if (info.plan.b3 !== '周五整天') {
    const rr = JSON.parse(await evaluate(`(async function(){
      const sol=${SOLX};const out={};
      out.auto=_ttRegRoom(sol);out.autoIssues=_ttRegRoomIssues(sol).length;
      out.bar=_ttRegHtml(sol).indexOf('老师注册打卡教室')>=0&&_ttRegHtml(sol).indexOf('自动挑')>=0;
      ttRegSetRoom('233');const s2=_ttCache.sol;
      out.bad=_ttRegRoomIssues(s2).map(function(o){return o.why;});
      out.badChip=_ttEntityCards(s2,'teacher').indexOf('⚠')>=0;
      const dr=_ttCourseDateRows(s2).filter(function(r){return r.cap&&r.legs.some(function(l){return l.reg;});});
      out.datesRoom=dr.length>0&&dr.every(function(r){return r.legs.every(function(l){return l.room==='233';});});
      ttRegSetRoom('51405');const s3=_ttCache.sol;out.ok405=_ttRegRoomIssues(s3).length;
      let body=null;const g=window.gasPost;window.gasPost=async function(a,b){body=b||a;return {success:true,version:99};};
      const cf=window.confirm;window.confirm=function(){return true;};const al=window.alert;window.alert=function(){};
      try{window._ttVerCheck=async function(){return undefined;};await ttSave();}catch(e){out.saveErr=String(e.message);}
      window.gasPost=g;window.confirm=cf;window.alert=al;
      out.saved=/"rr":"51405"/.test(JSON.stringify(body||{}));
      ttRegSetRoom('');out.back=_ttRegRoom(_ttCache.sol);
      return JSON.stringify(out);})()`));
    console.log('  教室:' + JSON.stringify(rr));
    ok(rr.auto && rr.autoIssues === 0 && rr.bar, `注册打卡教室没有写死：自动挑出 ${rr.auto}、没有警告、画面有「自动挑」选择栏`);
    ok(rr.bad.some(w => /已有/.test(w)) && rr.bad.some(w => /容量/.test(w)) && rr.badChip, '换成 233：警告「已有课占用」「容量不够」，老师卡的打卡格标 ⚠');
    ok(rr.datesRoom, '「上课日期」里版块 3 的注册打卡教室跟着换');
    ok(rr.ok405 === 0 && rr.back === rr.auto, '换成 51405 没有警告；选回「自动挑」又回到 '+rr.auto);
    ok(rr.saved, '存档内容里带着注册打卡教室（rr）');
  }
  if (errors.length) { fail++; console.log('❌ JS 报错: ' + errors.slice(0, 3).join(' | ')); }
} catch (e) { if (!/no sol/.test(e.message)) { fail++; console.log('❌ 测试本身: ' + e.message); } }
finally { try { ws.close(); } catch {} chrome.kill(); server.close(); await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {}); }
console.log(`\n(输出在 ${OUT})\n=== 注册用课表检查:${fail ? fail + ' 项失败' : '全部通过'} ===`);
process.exit(fail ? 1 : 0);
