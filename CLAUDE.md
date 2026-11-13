# CLAUDE.md — CIC 本科排课管理系统

> 简称：**【BA】**（BA 课纲排课）。TM 排课是另一个项目【TM】，不在这个文件夹。

单文件 HTML 排课系统,GitHub Pages 托管 + Supabase 后端,约 8 位同事使用。
**完整运维说明 → `docs/运维交接单.md`;数据库变更史 → `migrations/`。**
> 本档不写任何密码/PIN(repo 为公开)。anon 公钥写在 index.html 里是公开的、靠数据库权限兜底。

## 架构速记
- **真源**:本 repo → `git push origin main` → GitHub Pages 约 1–2 分钟自动上线
  - 线上:https://ali-che.github.io/CICBAcourseplan/index.html
- **前端**:单一文件 `index.html`(约 54 万字 / 7400 行),无打包,改完直接 commit+push
- **后端**:Supabase(project ref `ahygebtmavcmzqdwwhbs`)。写入**全走 security-definer RPC + PIN 验证**;anon 只读、写权限已 revoke;敏感表开 RLS
- **登入**:PIN + 角色(teacher / pic / director / admin);管理员 = Aj. Tsai

## 工作约定(重要)
- **改数据库**:每次在 `migrations/` 存一个编号档 `NNN_说明_日期.sql`,写清何时/为何/改什么;跑过的不改,要改开新编号
- **推送前必跑画面测试** `node tools/ui_smoke.mjs`(全过才推):模拟没进过后台的一般同事点遍各分页,有 JS 报错就失败。手动检查也要用「刚打开、没进后台」的状态,不能只用自己(管理员)的路线测
- **借用现有函数到新地方前,先看它依赖哪些全局资料**(如 `opsD` 只在开过后台才有值):新地方未必有,读之前先判 null
- **部署验证**:push 后**比对线上内容**(硬刷新 / curl 抓唯一标记),不是只看「推成功」;推送后再跑 `node tools/ui_smoke.mjs --url <线上网址>`
- **不提交任何密码**;后台操作的报错用 `_errText()` 透出真实 DB 报错(别只显示 unknown)
- **GitHub Pages 有缓存**:自己和同事看不到更新时,先硬刷新(Cmd+Shift+R)

## 全站列表页统一模板(2026-11-10 定,新页面照做)
- 卡片内:**第 1 行** `.sechdr`(左:标题+笔数,13px 带图示;右:`.lh-tools` 按钮)→ **第 2 行** `.fbar` 筛选栏(每个下拉前有 `<label>`)→ 表格。
- 按钮顺序:↻ 重新载入 → 该页专属 → 📊 导出 Excel(绿 #1a6b2f/#9ed4ae)→ 管理类(📥 批量导入 黄 #854F0B/#FCD34D、清理、删除)→ 🖨️ 列印(最后)。
- 用词统一:「重新载入」「导出 Excel」「列印」;编辑/复制/删除图示用 `_ICO`。
- 筛选栏文字:每个下拉前有标签,标签用词固定为「学年学期 / 学年 / 专业 / 部门(老师所属) / 老师 / 课程代码 / 届别 / 类型 / 课程类型」;下拉默认项——不选=看全部的写「全部」,必须先选才显示的写「请选择」;搜索框一律「🔍 搜索：A / B / C」,不另加「搜索」标签。
- 已套用:排课表、IS/SG、期末考特例、BTEC(第 1 行左为统计提示)。

## 容易踩的结构(改前必读)
- `courses` 是**视图** = catalog + dept_map + courses_extra:改部门动 `dept_map`、改课码动 `catalog`,**别改视图**
- 届别→专业判定:用 `cohortDept()`,**不要** `cohortPrefix()`(后者截前 2 字母,IBCE 这类 4 字母专业会错)
- `audit_log` **新旧两套列并存**:触发器写 `tbl/op/row_id/editor/before/after`;约 13 个手写审计函数写 `editor/action/target/detail`(界面隐藏)。**改此表前先查谁在写**,别换列名
- 编辑记录的**修改人**(006 起):`_admin`/`_pin_editor`/`_can_exam` 验证成功时 `set_config('app.editor')`,`audit_trg` 先取它。**新写 RPC 一律先调这三个之一**;新增资料表要进编辑记录 → 挂 `trg_audit` + 前端 `_AUD_TBLS` 加一行。含 PIN 的表(pins/app_admins/partner_*)**不要挂**
- 老师离职 = 软删 `teachers.resigned`(**不要硬删**,会让历史排课变孤儿)
- 顶部主分页高亮按按钮的 `data-tab` 配对(2026-11-10 起,不再靠顺序数组);**新增主分页要加 `data-tab`**,并放进对应的 `.tab-grp` 分组

## 相关档案
- `docs/运维交接单.md` — 接手/救急完整指南
- `migrations/` — 所有 DB 变更 SQL + `checks/health_check_all.sql`(安全体检**合一版**:RLS + 审计覆盖 + 双写,一次 Run 出一张表,可随时重跑;`rls_audit.sql`/`audit_*_inspect.sql` 为单项旧脚本)

---

## 进度 / 待办（最后更新 2026-11-10 · 每次有进展就更这里）

### 目前做到哪
- 系统上线稳定运行,约 8 位同事日常使用;**全站实际操作体检通过,无 JS 崩溃**。
- **2026-11-14【课表制作】新功能✅ 已部署上线(push main `2f86948`;本机预览多轮迭代后 Aj. Tsai 批准部署)**:把原本「不归 BA 系统管」的时段+教室请进系统,自动把该学期排课表的课排进「周几·上午/下午·教室」,画成课表、拖拉微调、存档、列印。设计规格 `docs/课表制作设计.md`。**⚠ migration 008/009/010/011 仍待 Aj. Tsai 在 Supabase 跑**(没跑前教室库空、存不了档、列印无日期,前端安全降级不崩)。
  - **前端**(index.html):顶部「📋 课表制作」分页(§TT)。核心:`_ttSolve` 贪心求解器(硬约束:容量±5宽容/教室撞/老师撞/届别撞/Capstone 下半周五六;软:CD 优先 321/322、非CD 避开、LA/KH 层级)、三种检视「依教室号/依届别/依老师」(行=星期、上蓝下橙、按专业上色 用 `COHORT_COLOR`、课片三区版式、框统一大小、表头+教室栏冻结、周几分隔线)、未排课做胶囊三视图可拖进网格(entity 拖自动挑房)、即时标红、诊断式建议(含改另一半)、漂移侦测(存档后 schD 被改→标出受影响课)、列印(上/下半或全学期 A4横向,抬头带日期)、「↩ 上下半写回排课表」。LA/MA 归 GE;Capstone=班级是 Capstone;实习课不排。
  - **后台操作**新增:「教室库」(增删改容量/优先专业)、「📅 课表日期」(仅 admin 设上下半/全学期日期,列印抬头用)、「👁 分页显示」(把秘书处对账 tab 改打勾开启,预设隐藏——课表制作已大致取代它)。
  - **DB migration(待 Aj. Tsai 在 Supabase 跑,按序)**:`008_rooms`(教室库+种12间+admin RPC)、`009_timetable`(存档,能存=teacher[Head]+admin)、`010_tt_sem_dates`(半日期)、`011_rooms_391_392_dates_admin`(加 391/392 两间+日期 RPC 收紧为 admin)。都 RLS 关/anon 只读/写走 security-definer/不挂审计;没跑时前端安全降级。
  - **纪律**:**未 commit 时已多轮预览,此 commit 仅存分支,未 push 未部署**;等 Aj. Tsai 说「可以部署」才 push main。ui_smoke 每轮 12/12。详细迭代记录在本组 session 共享笔记 `课表制作_架构勘查与计划.md`。
- **2026-11-13【秘书处对账】功能 ①②③ 全做完(前端改好未部署;DB migration 007 ✅ 已跑)**:流程痛点——排课表「定版」交秘书处(Head of Administration,内部角色码=`teacher`,只读)去排教室/定时间并印出,但主任(director)之后还会微调(改 课程/届别/班级人数/老师/上下半,**不碰时段教室**;时段/教室不归 BA 系统管),秘书处不知情→纸本过期。
  - **① 列印版本章(纯前端)**:排课表每次列印,表头盖「版本章」=内容版本码(4码)+笔数+列印时刻,例 `版本 KQKU · 1 笔 · 列印 11/13 15:03`。两张纸版本码相同=内容一字不差,不同=被动过。新增 `_schVerCode(sem)`(按 课程·上下半·班级·老师·届别+人数 算指纹,**≠ `hashRecords` 的 id 指纹,勿混**);只盖排课表(`printPanel` 内 `id==='sch'`);样式 `.ph-ver`。**⚠ 用户待定:版本章里的「列印时刻」是专为此破例加的(全站原本「不压列印日期」);用户若不要可拿掉。**
  - **② 基准线表(`migrations/007_sched_lock_baseline_2026-11-13.sql`,✅ 已跑)**:`sched_lock`(每学期一条:version/locked_by/locked_at/ver_code/**snapshot**=定版那刻排课精简快照)+`sched_lock_ack`(单笔已对账标记:row_id+row_code内容指纹)。RPC:`sched_set_baseline(p_pin,p_sem,p_snapshot,p_ver_code)`=定版/对账到此(version++、清该学期全部 ack),`sched_ack_row(...p_on)`=单笔勾/取消。都 `_pin_editor` 验 PIN(任何有效 PIN;Head=teacher 可用)。**两表 RLS 关、仅 grant select 给 anon、写走 security-definer RPC(同 schedule);下次安全体检会列为「RLS 关但不可写」,属预期基线。** 刻意不挂 trg_audit。线上已实证:两表匿名读回 `[]`、两 RPC 假 PIN 正确挡回「PIN 无效」。
  - **③ 对账前端(纯前端)**:§RECO 区块(`_schSnapshot/_schRowSig/_rowCode/_recoFields/_recoDiff/_recoItemCode/_recoAcked/_recoRefresh/_recoRenderBar/openReco/renderReco/recoSetBaseline/recoAck/recoPrint`)。排课表工具栏「📌 定版/对账」钮(`btn-sch-reco`,给 teacher/director/admin,`applyRoleVisibility` 控);选学期后点开弹窗 `#reco-modal`:未定版→「📌 定版给秘书处」;已定版→列「定版当时→现在」**净差异**(按专业分组,删置顶→新增→变更,每笔右侧写「秘书处要复查什么」:人数→查教室容量、届别/班级→查撞堂、老师→查老师撞堂),每笔可单笔勾(`recoAck`,**那笔再被改→指纹变→自动重新亮灯**),底部一颗「✓ 对账到此」整批清(重设基准线)+「📄 列印小抄」(只印待对账清单,`body.print-reco`)。排课表挂橘色横幅 `#sch-reco-bar`「⚠ 已定版 vN 后有 M 笔待对账」(`renderSch` 末尾 `_recoRefresh()`;sem 变才重抓 lock/acks,diff 本地重算)。前端接线:`gasGet` 加 `schedLock` 读、`gasPost` 加 `setBaseline`/`ackRow` 写(Supabase 块内)。
  - **③′ 改为独立分页 + 版本章拿掉列印时刻(2026-11-13 同日,纯前端)**:依用户要求——① 版本章只留 `版本 <码> · N 笔`(拿掉「列印时刻」,全站本来就不压列印日期);② 对账从「弹窗」改成**主分页**「🤝 秘书处对账」(`data-tab="reco"`,放「日常排课」组,`applyRoleVisibility` 控、给 teacher/director/admin;`switchTab` 加 reco→`renderRecoPanel`)。分页内:自带「学年学期」下拉(`reco-sem`/`_recoFillSemSel`)+ 基准线状态条(含定版/对账到此/列印小抄)+ 整页净差异清单(单笔勾)。排课表橘色横幅保留,按钮改「前往对账 →」`gotoReco(sem)`(设 reco-sem + switchTab);**移除**排课表工具栏旧钮 `btn-sch-reco` 与旧弹窗 `#reco-modal`/openReco/closeReco/renderReco(已无残留引用)。
  - **③″ 修 onclick 引号 bug + 定版改只给 Admin(2026-11-13 同日)**:⚠**教训**——`gotoReco`/`recoAck` 的 onclick 原用 `JSON.stringify`(产双引号)塞进双引号 HTML 属性→引号打架、onclick 整个失效(「前往对账」「单笔勾」点了没反应)。改用 `jsq()`+转义单引号(`onclick="fn(\\''+jsq(x)+'\\')"`)。**新加带参数的 onclick 一律用 jsq 不用 JSON.stringify。** 另:**定版/对账到此/重新定版钮改成只给 Admin**(`currentRole==='admin'`,锁基准线=管理员操作);teacher/director 在分页只看清单+单笔勾,未定版时显示「等管理员定版」。验证:真·点击测(渲染出的 onclick 真的触发 gotoReco/recoAck)+ ui_smoke 12/12。
- **2026-11-13【课表制作】下一阶段·设计已定稿,另开 session 施工**:把排课表的课**自动排进「周几·上午/下午·教室」**,画成上/下半两张课表,拖拉微调+即时标红+存档+列印。完整设计规格 → **`docs/课表制作设计.md`**(8条硬约束含届别≤21学分、软优先CD进321/322与LA/KH层级、求解器排不下就标红留空、权限 Head+Admin 能排其余只读、新表 rooms/timetable、教室库进后台操作)。本质是排课求解器。CD=创意设计已查实、Capstone=`type==='Capstone'`。**此功能在独立 session 做,进度看那个 session;待 Aj. Tsai 提供上/下半实际时间点(开工后填)。** onclick 带参教训:一律 `jsq()` 不用 `JSON.stringify`。
  - **验证**:`ui_smoke` 12/12;无头逻辑测 15/15(钮可见/快照=全学期/无变更空/改人数→人数+容量提示/改老师→老师/删→del/单笔勾+再改重亮/弹窗含人数容量/徽章/两 RPC 载荷);375px 溢出 0、弹窗 353px 合身。**待 Aj. Tsai 亲手确认(本机验不到):㈠ 用 Head 真 PIN 实际「定版」→改一笔排课→看徽章与对账清单是否正确、「对账到此」能清、单笔勾能存;㈡ 印一张排课表 PDF + 一张对账小抄看纸面观感。** 整个功能**尚未 commit、未部署**。下一阶段(未做):课程表——把时段/教室请进系统、系统帮排(撞堂/容量自动抓)。
- **2026-11-13 备份加固:个资档加密 + 旧快照补加密(备份脚本在 repo 外:`~/CICBA-backups/`、`~/Documents/网站备份/_脚本/`,不进本 repo)**:① 三个含个资/PIN 的档(pins/btec_data/exam_special)**落地前一律 AES-256 加密**(`openssl enc -pbkdf2 -iter 200000`,机器无 gpg)成 `*.json.enc`、明文当场删;密码存钥匙圈 `cic-ba-backup-enc`(≠ PIN 的 `cic-ba-admin-pin`),**缺密码则 fail-closed 跳过个资**(绝不写明文)。② `ba_cloud.mjs` 完整性判断改「基础表 ≥17 个 .json」并把 `.enc` 一并镜像上云;`restore_sql.sh` 遇 `.enc` 自动解密到临时夹、用完即焚(密码错→exit1、不输出 SQL)。③ **retro 一次性补加密现存旧快照**(`~/CICBA-backups/retro_encrypt_pii.sh`,幂等,加密→解密验证一致→才删明文):本机 150 + 云端 150 = **300 档全加密、0 失败**,两处残留明文 = 0、`.enc` 各 150、抽样解密为合法 JSON。④ Drive「网站备份」资料夹查实 = **PRIVATE、仅 owner、无连结分享**(备份未外泄)。干跑全绿;改动没碰网站,`ui_smoke` 本机 12/12、线上 12/12。异地第二份(云端单点)这次按用户选择暂不做。**遗留待用户:㈠ Drive「回收站」可能还留着被删的明文(约 30 天可还原)→ 去 drive.google.com 回收站清空;㈡ `cic-ba-backup-enc` 密码务必另存安全处,是唯一能解 `.enc` 的钥匙,且别覆盖(300 个 .enc 锁在当前密码上)。**
- **2026-11-13 安全体检合一版 + RLS 复查全绿(只读,没改 DB;新增 `migrations/checks/health_check_all.sql`)**:把 `rls_audit` + 审计覆盖 + 双写量三支 checks 合成「单一 UNION 结果表」(Supabase SQL Editor 一次 Run 只显示最后一个结果,故不能多 SELECT 叠贴)。Aj. Tsai 在 SQL Editor 跑过:**区块 A·RLS 零 ⚠️ 零 🟡**——无任何表外人可写,5 张 RLS 关但不可写(archived_terms/courses_extra/exam_school/notice/teach_btec)同 11-05 基线;**区块 B·审计覆盖无漏挂**——9 张「无审计」全是账号/PIN/消息/在线类(app_admins/audit_log/message_reads/messages/partner_*/pins/presence)本就不挂,其余业务+参考表全有;**区块 C·双写**——新列现行(I36/U415/D22/BASELINE329),旧列历史残留约 200 行(add12/del14/upd174,均 004 前,界面隐藏、可日后清)。要坐实旧列是否停写:`select max("at"), max("at")<date '2026-11-09' from audit_log where tbl is null`(audit_log 时间栏=`at`)。**结论:006 没开出任何漏洞,DB 侧干净。** 另两个真实资安项与 DB 无关、待办:① 备份含 PIN 明文+学生个资同步到 Google Drive → 确认该资料夹没对外分享 + 账号两步验证;② 云端单点(同一 Google 账号)。
- **2026-11-12 修 Secure Input 最后残留(纯前端,已上线 `5bbacd6`)**:三系统(TM/BA/测验)并行修 macOS Secure Input,本项目补齐最后一处——`togglePinEye`(登入页 PIN 眼睛钮)原本切换后一律 `i.focus()`,眼睛由「显示(text)」切回「隐藏(password)」时会聚焦密码框→又触发 Secure Input;改为切到 text 才 `focus()`、切回 password 改 `blur()`。其余密码/PIN 框(`pin-input`、`chpin-*`)2026-11-10 已处理。ui_smoke 本地 12/12;push 后以 `curl -H 'Cache-Control: no-cache'` 比对线上确认新版已上线(Pages 的 Fastly CDN `max-age=600`,带 `?cb=` 查询串不会破缓存,要用 no-cache 头或等 10 分钟/硬刷新才看得到)。**本机无法真正重开 Chrome App,Secure Input 释放待 Aj. Tsai 重开 App 后用 `ioreg -l -w 0 | grep -i SecureInput` 验收**。
- DB 已跑到 `migrations/004`(002 已确认跑过);**RLS 安全盘点 2026-11-05 全数通过**(全绿)。
- **2026-11-12(二轮) 课程结构选专业合并成一个药丸窗 + 专业老师课表列印满版 + 修教学统计手风琴列印截字(已上线验证 `d82a14b`)**:① **course_structure_online.html**:把「选专业 Excel」与「选专业 PDF」两窗**合并成一个「📤 导出 / 列印(选专业)」窗**(`openOutSel`,勾一次专业→底部绿 Excel(仅编辑者)/紫 PDF);选专业 UI 从朴素勾选格**改药丸式**(`.msel-chipitem`,选中紫底打勾/未选淡紫,与顶部专业 tab 同款,flex-wrap);`_mselRender/_mselPicked/_mselCount/outSelAll` 改读 `.msel-chipitem.on`。② **index.html 专业老师课表列印满版**:表加 class `mt-fullw` + 列印 `.mt-fullw{width:100%!important}`(覆盖全站列印预设 `table{width:auto}` 造成的半版)。③ **index.html 修教学统计手风琴列印截字**:`.tip-row` 固定 `min-width`(徽章44/课码50/人40/课时30…)在窄列印卡片里撑爆、最右「课时」被截→列印时(`body.print-sta .acc-sec .tip-row>span{min-width:0}`+缩字)放进卡片。**上一轮(`c7128f8`)以为是 `td *` 规则,其实元凶是这些 min-width**。验证:ui_smoke 本地/线上 12/12、选专业窗 11/11+6/6、满版+窄卡不截 7/7。**教学统计真实数据需 PIN,纸面待人工确认**。
- **2026-11-12 课程结构导出/PDF 选专业统一 + 专业老师课表占全版 + 修教学统计列印(已上线验证 `c7128f8`)**:① **course_structure_online.html**:导出 Excel 把「当前专业」+「全部专业」两钮**并成一个「📊 导出 Excel」→ 弹选专业窗**(默认全勾/可单多全,每专业一工作表 .xlsx,`openXlsSel`/`_cxXlsxPids`);PDF 钮改「📄 选专业列印 / PDF」,选专业弹窗 class 化重做(`.msel-*`:标题+副说明+全选/全不选胶囊+两列勾选格+已选计数),**Excel 与 PDF 共用同一套弹窗**(绿/紫),手机单列;Excel 导出仍仅编辑者可见(`_cxApplyPerm` 只留 btn-xls1)。② **index.html**:专业老师课表 `renderDeptTchMatrix` 表身去 inline `max-width:900px`→`width:100%` 占满版。③ **修 `d6e71ff` 的回归**:上版 `.panel.active td *,th *{font-size:inherit!important}` 会把教学统计手风琴卡片文字也压成 7pt(字被吃掉)→ 已移除(`_measurePrintTableW` clone 同步去 inherit);超宽表仍靠「表身 7pt!important + 按页宽 zoom」。验证:ui_smoke 本地/线上 12/12、课程结构交互 14/14、矩阵列印 4/4、教学统计列印 4/4。**注:教学统计真实数据需 PIN,匿名没能完整复现截图;课程结构弹窗与教学统计纸面观感待人工印一次确认**。
- **2026-11-12 列印自动缩放成 A4(纯前端,已上线验证 `d6e71ff`)**:超宽表(专业班级课表矩阵等)原本列印右侧被截。两层修复:①**根因**——矩阵表带 inline `font-size:12px`,列印 `.panel.active table{font-size:7pt}` 没 `!important` 被盖过→用大字列印爆版;已改 `!important` 并加 `.panel.active td *,th *{font-size:inherit!important}` 让 inline 子元素也归小字。②**兜底**——`printPanel` 列印前 `_printFitApply(id)`:用离屏 clone(等同列印样式:7pt/nowrap)量每张可见表的实际列印宽度,超过 A4 可印宽(横向269mm/直向186mm,留2%边)就对该表注入 `@media print{[data-pfit]{zoom:比例}}`(min 0.35),印后 `_printFitClear()` 还原、屏幕不受影响。**新增会带 inline 字号的宽表时此机制自动生效,无需改**。验证:最宽真实矩阵 IB 2569-2(23届别栏)屏幕3336px→列印媒体实测992px≤A4横向1017px完整不截;logic 8/8+列印宽度4/4+ui_smoke本地/线上各12/12。**注:自动缩放的纸面观感请人工印一次 PDF 确认**。备注:学期总表/教学统计只有「列印」无 Excel 导出(四个 Excel 导出都已加筛选 modal);如需可另加导出。
- **2026-11-12 IS/SG·期末考·BTEC 导出也统一加筛选 modal(纯前端,已上线验证 `67e1eff`)**:延续排课做法,三页「导出 Excel」改为点钮先弹居中 modal(`openSpExp`/`openExamExp`/`openBtecExp`)、预填屏幕当前筛选、底部实时笔数、确认才下载并关窗。**把 `_examRows`/`_btecStudents` 重构为委派 `_examRowsFrom(sem/专业/类型/搜索)` / `_btecStudentsFrom(专业/学年/搜索)`,render 与导出共用同一筛选函数(结构上不会分叉)**;IS/SG 走 `_spExpFilter`,**顺带补齐旧导出漏掉的「专业 `sp-mj-f`」筛选 + 搜索范围与 renderSp 对齐**(课码/英文名/学号/姓名/班级)。BTEC 的学年色块 `_btecYrF` 会一并带入导出并在 modal 提示。各 .xls 副标题列出实际筛选。验证:ui_smoke 本地+线上各 12/12;交互脚本 11/11+15/15(exam/btec 匿名只读返 0 笔,但 render=导出同源,空数据下仍一致)。
- **2026-11-12 排课「导出 Excel」改为先弹筛选 modal(纯前端,已上线验证 `03cae50`)**:点「📊 导出 Excel」不再直接下载,改开居中 modal `#schexp-modal`(`openSchExp` 复制屏幕上的 学年学期/课程代码/老师/搜索 下拉选项+当前值作预设,可调整),底部 `schExpCount` 实时显示「将导出 N 条」,按「确认导出」才下载并 `closeSchExp`。抽出 `_schExpFilter`(= `renderSch` 同一套四筛选逻辑)供预览与导出共用,**顺手修旧 bug**:原 `exportSchExcel` 只认学期、忽略课程代码/老师/搜索;`.xls` 副标题改列出本次实际用到的筛选。modal 筛选是独立副本,不改屏幕。验证:ui_smoke 本地+线上各 12/12,另写临时交互脚本点开 modal 跑 11/11(预填/笔数=屏幕可见行/独立性/导出无报错+下载+关窗)。
- **2026-11-09 清 audit 双写(`migrations/004`,已跑+验证)**:`add_record/update_record/delete_record` 移除手写旧列审计,排课/IS-SG 增删改只剩 `trg_audit` 一条新列行。`audit_trg` 的 DELETE 改取 `coalesce(current_setting('app.editor'), old.editor)`,`delete_record` 删前 `set_config('app.editor', ed, true)` → 编辑记录的删除人 = 真正删的人(其他删除路径如 `exam_special` 仍取 old.editor)。验证:TEST999 新增/删除各只一条、editor 正确;同事改排课也只一条。旧列历史行保留未删。体检查询 `migrations/checks/audit_dual_write_inspect.sql`。
- **2026-11-07 本轮完成(纯前端,均已上线验证)**:
  1. **后台编辑全面收齐为居中弹窗**:老师库 / 职位 / 毕业学分 / 课程总库 四个视图改成同一套路(顶部表单恒为「新增」,点 ✎/编辑 弹居中 modal)。靠 `form(E)` 双渲染 + `_opsF(id)`(作用域取值器:编辑时取 modal 内输入框,否则取顶部表单)。
  2. **排课批量导入自动建档新届别**:导入时若 `cc` 里引用了库中没有的届别,先逐个 `adminAddCohort` 建档(专业用新函数 `_cohGuessDept()`,全前缀匹配,IBCE 等 4 字母专业不会被截错),建完 `loadRefFromSheets()+rebuildUI()` 刷新;确认框会列出将自动建的届别。
  3. **班级总表「届别」下拉改为只列排课表里出现过的届别**:新 `_cohByDeptMerged()`(读 `schD`,经 `_filtArch` 过滤归档)。已毕业届别默认隐藏,工具栏加「显示已毕业」勾选框(`toggleCoShowGrad`/`_coShowGrad`)带出。`filterCohByDept` 与 `rebuildUI` 的 f-co-d/f-co 均改用此源。
  4. **修下拉载入时机**:下拉来源改读 `schD` 后,因 `init()` 的首次 `rebuildUI()` 在 `loadDataFromSheets()` 之前跑(此时 schD 空),会导致「专业」只剩「全部」。已在 `init()` 排课载入后、及 `syncAll()` 刷新后各补一次 `rebuildUI()`(线上 `rebuildUI()` 共 8 处)。
- **2026-11-09 新增「学期总表 › 专业老师课表」子页(`sub-smt`,纯前端)**:`renderDeptTchMatrix()` / `_mtFillSelectors()`,紧接在 `renderDeptMatrix()` 后。行=所选部门老师(`tchrDrop()` 中 `t.d===dept`,有限额或本学期有课),列=该专业届别(`cohortDept`)+「其他专业」,格=课码·人数小标签,**点课码 → `startES(id)` 编辑**;末行「⏳ 待定老师」= 本专业 tc 空的排课;右侧「本学期课数」与「总课时 / 学年规定」。已挂进 `switchSub` 和 `renderAllSum`。
  - 11-09 二修(**版面已改,上面「列=届别」的描述作废**):① 拿掉届别列,所有专业统一为「老师 | 任课课程 | 本学期课数 | 总课时 / 学年规定」,**每门课只出现一次**(chip = 课码 + 总人数,tooltip 列届别明细)②「总课时 / 学年规定」= `_tchYearLoad(n,yr)`:该学年 3 学期 `semDetail().wt` + BTEC×0.5 + 手填 `_teachBtec`,**与「教学统计」学年总数同算法**(已逐人核对一致),超额标红 ③ 任课课程格按 上半/下半/全学期 分行,chips 并排换行。
- **2026-11-09 IS/SG 排课表「操作」加「复制」钮(纯前端)**:绿色复制图标在 ✎ 与 🗑 之间,`copySp(id)` 把该笔的学号/称谓/姓名/专业/班级/学年学期带进「新增 IS/SG 排课」表单、清空课程/老师/备注,自动展开表单并聚焦课程代码;同一学生多门 SG/IS 不用重打。仍走原 `addSp()` 新增(含重复提醒)。
- **2026-11-09 修届别药丸颜色**:不在届别库的自订届别名(如 `IBCE69-Jiang/WangW/WangC`)以前 `cohortDept()` 退回 `cohortPrefix()` 截成 IB → 没颜色;现改为先用 `_cohGuessDept()` 完整前缀对专业码,对不上才退回 2 字母。
- **2026-11-09 修线上崩溃「Cannot read properties of null (reading 'depts')」**:上一条「届别药丸颜色」(`36cf7cc`)让 `cohortDept()` 调 `_cohGuessDept()`,后者直接读 `opsD.depts`;`opsD` 只有开过「后台操作」才有值,平时为 null → 排课表遇到不在届别库的届别就整页崩、显示空白(同事反映「看不到排课」的主因)。已改为 `opsD&&opsD.depts`。**教训:读 `opsD` 一律先判 null。**连带影响:`init()` 里 `renderSch()` 一崩,后面的 `startRemotePoll()`/`startHeartbeat()` 都没跑 →「谁在线上」名单也空白;修后 Aj. Tsai 确认排课与在线名单都已恢复(2026-11-09)。
- **2026-11-09 排课 / IS-SG 表头加归档提示**:`_archHint(list)` — 有学期被归档隐藏时,计数旁显示橘色「🗄 已隐藏 N 笔归档(学期) · 点此显示」,点了等于勾「显示已归档」。起因:2569-1 曾被归档,IS/SG 85 笔藏掉 81 笔,同事以为数据不见(该归档后来已取消)。
- 上一轮完成:
  - 修 3 个 bug(均已上线):① 分页高亮错位(教务须知↔教学统计)② 排课/IS-SG 表头计数误导 → 「显示 X / 共 Y」③ 顶部「专业库」计数错源(11→10)
  - 新功能:老师离职软删存档(`migrations/003`)、后台分页分组 + 学年学期/专业卡片、编辑记录加「老师/届别」类型 + 改动一行逗号、归档按类型(排课+IS/SG vs 期末考 独立)
  - 运维基建:建 `migrations/` 变更存档、写 `docs/运维交接单.md`、建本 CLAUDE.md、交接单+migrations 已备份到 Google Drive

- **2026-11-09 加画面冒烟测试 `tools/ui_smoke.mjs`**:无头 Chrome 打开网页、模拟一般同事点遍分页,有 JS 报错就失败;已用放回旧 bug 验证能拦下(9/12 失败),修好版 12/12 通过。也接进 GitHub Actions 每 30 分钟测线上(失败 email)。

- **2026-11-10 分页优化(纯前端,已上线)**:① 主分页分 4 组(日常排课 排课表/期末考/IS-SG | 查看汇总 学期总表/教学统计/BTEC/课程结构 | 参考 教务须知 | 管理 后台操作),组间细线,分页高度压低;`switchTab` 改按 `data-tab` 配对;后台组 `#tabgrp-ops` 随权限一起隐藏 ②「➕ 新增届别」移出分页列,改为排课表工具栏按钮 `#btn-addcoh`(仍只给 admin/director) ③ 学期总表子页分「按老师 / 按班级」两组,全站「SG/IS」统一为「IS/SG」 ④ 列印说明只显示「🖨️ 直向/横向 A4 ⓘ」,完整内容放悬停提示;紫色提示条加「✕ 不再显示」(localStorage `cic_hide_sum_tip`) ⑤ 网址记住分页:`#sum/smt` 形式,`_writeTabHash()`/`_restoreTabFromHash()`,init 末尾还原,看不到的分页(权限)不跳。ui_smoke 12/12 通过。「列印」一词全站一致,未改。
- **2026-11-10 期末考特例「操作」加「复制」钮(已上线)**:✎ 与 🗑 之间的绿色复制图标,`examCopy(id)` 带入学号/称谓/姓名/专业/学年学期/班级/负责学校/类型(「考试冲突」改回「登分」),清空课程/老师/上下半/备注,展开「新增期末考特例」并聚焦课程代码;无 id → 存档走新增。权限同编辑(admin/director/pic)。
- **2026-11-10 专业老师课表权限(已上线)**:老师名后的灰色职位、「总课时 / 学年规定」整栏(含表尾说明)只给 admin/director 看(`renderDeptTchMatrix` 内 `_priv`);其他角色只见「老师 | 任课课程 | 本学期课数」。
- **2026-11-10 全站编辑/复制/删除图示统一(已上线)**:以 IS/SG 排课表的 SVG 为准,抽成全局常量 `_ICO.edit/copy/del`(13px)与小号 `_ICOs.edit/del`(11px),放在主 `<script>` 开头。已套用:排课/IS-SG/期末考行内、BTEC 学生表头(`.btn-ic-s` 20px)、后台各表的「编辑/删除」文字钮→图示钮(离职/复职/归档仍为文字)、后台小卡片 ✎×、站内消息删除、弹窗与批量删除钮的 🗑。**以后新加编辑/删除按钮一律用 `_ICO`**。(2026-11-10 已上线;首次 Pages deploy 步骤失败,空提交重推后成功)
- **2026-11-10 BTEC 专业色块可点(已合并 main)**:`btecPickDept(d)` — 点色块=筛该专业学生并同步「专业」下拉,再点同一块=全部;色块改数**全体**学生,选中加外框、其他变淡。
- **BTEC 学生专业 IC→IBCE**:BTEC 学生的 dept 是存在学生资料里的,不随专业库同步。已写 `migrations/005_btec_students_ic_to_ibce_2026-11-10.sql`(先找表再改,只动 BTEC 学生表),**✅ 2026-11-10 Aj. Tsai 已跑**;专业库 depts 里 IC 仍保留。画面已确认显示 IBCE 5。
- **2026-11-10 BTEC 学年色块可点(已上线)**:标示改为「🎓 2025-2026 学年 · 4 人」「🎓 未设学年 · 1 人」(未设用橙色、排最后);`btecPickYr(y)` + 模块变量 `_btecYrF` 筛选(在 `_btecStudents()` 里,Excel/列印同步受影响),可与专业色块叠加;悬停列出该学年学生名单。专业色块也加「人」。修:筛到 0 人时原本先 return 不画色块 → 无法点回;现改为先画色块再判空,并显示「没有符合筛选条件的学生」。**repo 公开:本档不写学生姓名/学号。**(已上线;当时唯一「未设学年」的学生已由 Aj. Tsai 补好学年,2026-11-10);色块尺寸统一:专业与学年色块都固定 `height:20px` + inline-flex(🎓 缩为 10px),原本学年色块因 emoji 高 2px
- **2026-11-10 修 macOS Secure Input(已上线)**:Chrome 焦点停在 `type=password` 时会开 Secure Input,整台电脑第三方输入法(OpenVanilla)被停用。改:拿掉 5 处自动聚焦密码框(checkAuth、Supabase 版 checkAuth、logout、handleTokenExpired、openChangePin);新 `_blurPwds()`,在 unlockApp、closeChangePin、改密码成功、视窗 blur/分页隐藏时放掉密码框焦点。**以后不要用 `.focus()` 聚焦密码框**。验收:重开 App 后 `ioreg -l -w 0 | grep -i SecureInput` 不应出现 `kCGSSessionSecureInputPID`✅ 2026-11-10 Aj. Tsai 已验收(重开 App、登入、改密码后皆无 Secure Input)。
- **2026-11-10 批量删除限 admin/director + 排课/IS-SG 工具栏重排(已上线)**:`updateBatchDelButton` 对其他角色直接隐藏,`deleteFiltered` 开头再挡一次。两表的「操作区」改为筛选下方独立一行(`.sch-tools`):左「重新载入 | Excel · 列印」,右「新增届别 · 批量导入 · 按届别清理 · 批量删除」;拿掉「依当前筛选 · 横向 A4」文字(列印钮 tooltip 仍有)。(后续 2026-11-10 已改为全站统一模板,见上方「全站列表页统一模板」)
- **2026-11-10 教学统计明细加 BTEC 小标**:`semDetail()` 的课程物件多带 `btec`;`courseRowHtml()` 在上/下/全旁加紫色小字「BTEC」(列印明细同步)。曾加过排课备注小字,用户要求拿掉,**明细不显示备注**。
- **2026-11-10 全站筛选栏统一淡紫底框(已上线)**:共用 class `.fbar` 加同排课表筛选区的底框(#F5F4FE、边 #E5E3F8、圆角 8px、宽度随内容 `fit-content`)。涵盖期末考、学期总表各子页、教学统计、BTEC、后台届别筛选。**新筛选栏一律用 `.fbar`**。

- **2026-11-10 全站紫色表头可点排序 + 排序图示统一(已上线)**:新通用排序 `_gSort*`(在 `syncTblHeight` 前):MutationObserver 自动给「没有自带排序」的紫色表头每栏加 `.gs-ic`(图示一律 `siIcon`:灰 ⇅ / ▲ / ▼),点击 升序→降序→还原;重新渲染(换筛选)后自动套回。规则:分组列 `.dh`、小计列 `.dt`、整列跨栏列当分隔线,只在段内排;展开明细列(class 含 acc/detail,或隐藏列)跟着上一列走;「#」栏序号保持 1,2,3;`#`/操作/含输入框的表头不加;tbody 有 rowspan 的表跳过;列印隐藏图示。已有自带排序的表(排课/IS-SG/期末考/后台老师库/课程库/编辑记录)不动,但图示都改用 `siIcon`。**不想要排序的表加 `data-gsort="off"`**(公式说明表已加)。用 rAF 会在背景分页停住,故用 setTimeout。
- **2026-11-10 专业老师课表「本学期课数」改与教学统计同算法(已上线)**:原本是该学期排课笔数,现改为 `semDetail(老师,学期).wt`(按类型/人数加权,含 IS/SG、Capstone),= 教学统计该学期栏;数字悬停列逐课明细。「⏳ 待定老师」行用 `_pendWt()` 同规则加权。已逐人核对 2569-2 全部 34 位老师一致。
- **2026-11-10 编辑记录覆盖全部后台资料(006 ✅ 2026-11-10 已跑,前端已上线;Aj. Tsai 改职位额度实测,编辑记录正确出现)**:起因:编辑记录只看得到排课/IS-SG/期末考。`migrations/006`:① `_admin`/`_pin_editor`/`_can_exam` 设 `app.editor` → 所有 RPC 的修改人自动正确(顺带修好期末考修改人一直空白、批量删除记成原编辑人)② `audit_trg` 修改人先取 app.editor,UPDATE 无变化不记 ③ 21 张参考表挂 `trg_audit`(不含账号/PIN/消息/在线)④ 移除 002/003 手写新列审计免重复。前端:全局 `_AUD_TBLS`(类型名/徽章色/分组/对象显示)驱动类型下拉(optgroup 5 组)、徽章、排序;参考表新增/删除列出栏位,修改沿用 diff;老师 UPDATE 只有 resigned 变化才显示离职/复职。ui_smoke 12/12;用假资料渲染 10 种行已核对。
### 下一步要做什么（按优先级）
1. **基线快照 `migrations/000`**（一次性,未做)— 请 Aj. Tsai 跑 `000_baseline_HOWTO.md` 里的只读查询,把结果给我存档,作为 DB 现状定锚。
2. ~~P1 · 清 audit 双写~~ ✅ 2026-11-09 完成(`migrations/004`)。其余后台手写旧列审计在 006 后已被触发器取代(旧列行仍写但界面隐藏,可日后清掉)。
3. **P1 · 报错透出推广** — 把 `_errText()` 接到更多后台写操作(目前只接了 `opsAfter` / `addCohSubmit`)。
4. **P1 · 届别改卡片** — 后台「届别」仍是表格;改卡片时**必须保留年限 + 在读/已毕业状态**,别丢信息。
5. **P2** — 原生 `alert`(117 处)→ toast;加**云端排程备份**(目前只靠本机 launchd,单点风险);顶部「专业」三处数字标示统一。
6. **非技术待办** — 运维交接单第 2、9 节「待填」(密码保管处、备援联络人)由 Aj. Tsai 补;Drive 交接单副本是快照,需同步时请我重传。

## web-design-rules 体检设定
> 给 skill `web-design-rules` 的「体检模式」用(2026-11-13 加)。说「体检」就照这里的参数跑 8 项,只读不改。
- 网站根资料夹:.(repo 根目录;会列到 `index_supa_test.html`、`staging.html` 两个测试页,结果里可忽略)
- 线上网址:https://ali-che.github.io/CICBAcourseplan(GitHub Pages,keep-ext)
- 测试指令:`node tools/ui_smoke.mjs`(线上:`--url https://ali-che.github.io/CICBAcourseplan/index.html`)
- 备份:~/Documents/网站备份/BA课纲排课|'*'|2 天
- 匿名读取:--supabase ahygebtmavcmzqdwwhbs --key-from index.html pins app_admins btec btec_student exam_special
- 反向验证纪录:2026-11-09 ui_smoke 放回旧 bug(opsD null)→ 9/12 失败
- 已知:GitHub Pages 不能自订安全标头;个资表 2026-11-13 匿名读取全 0 笔/401
