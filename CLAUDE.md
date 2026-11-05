# CLAUDE.md — CIC 本科排课管理系统

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
- **部署验证**:push 后**比对线上内容**(硬刷新 / curl 抓唯一标记),不是只看「推成功」
- **不提交任何密码**;后台操作的报错用 `_errText()` 透出真实 DB 报错(别只显示 unknown)
- **GitHub Pages 有缓存**:自己和同事看不到更新时,先硬刷新(Cmd+Shift+R)

## 容易踩的结构(改前必读)
- `courses` 是**视图** = catalog + dept_map + courses_extra:改部门动 `dept_map`、改课码动 `catalog`,**别改视图**
- 届别→专业判定:用 `cohortDept()`,**不要** `cohortPrefix()`(后者截前 2 字母,IBCE 这类 4 字母专业会错)
- `audit_log` **新旧两套列并存**:触发器写 `tbl/op/row_id/editor/before/after`;约 13 个手写审计函数写 `editor/action/target/detail`。**改此表前先查谁在写**,别换列名
- 老师离职 = 软删 `teachers.resigned`(**不要硬删**,会让历史排课变孤儿)
- 顶部主分页高亮靠 `switchTab` 的顺序数组按位置配对——**改分页顺序要同步改该数组**

## 进度 / 待办
**最近一轮(2026-11-05)已完成**
- 修 bug:分页高亮错位、排课/IS-SG 表头计数误导、顶部「专业库」计数错源
- 新功能:老师离职存档(migrations/003)、后台分页分组 + 学期/专业卡片、编辑记录加「老师/届别」类型、归档按类型
- 做了全站实际操作体检(管理员身份),无 JS 崩溃;IBCE 专业班级课表、账号权限、归档等均正常

**待办 backlog**
- `migrations/000` 基线快照待填(见 `000_baseline_HOWTO.md`)
- P1:清 audit 双写(add/update/delete_record 的手写审计冗余,每次编辑写两条);`_errText` 报错透出推广到更多后台操作;届别改卡片(保留年限/状态)
- P2:117 个原生 alert → toast;加云端排程备份(目前只靠本机 launchd 单点)
- 运维交接单第 2、9 节「待填」(密码保管处、备援联络人)需 Aj. Tsai 补

## 相关档案
- `docs/运维交接单.md` — 接手/救急完整指南
- `migrations/` — 所有 DB 变更 SQL + `checks/rls_audit.sql`(安全体检,可随时重跑)
