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
- **部署验证**:push 后**比对线上内容**(硬刷新 / curl 抓唯一标记),不是只看「推成功」
- **不提交任何密码**;后台操作的报错用 `_errText()` 透出真实 DB 报错(别只显示 unknown)
- **GitHub Pages 有缓存**:自己和同事看不到更新时,先硬刷新(Cmd+Shift+R)

## 容易踩的结构(改前必读)
- `courses` 是**视图** = catalog + dept_map + courses_extra:改部门动 `dept_map`、改课码动 `catalog`,**别改视图**
- 届别→专业判定:用 `cohortDept()`,**不要** `cohortPrefix()`(后者截前 2 字母,IBCE 这类 4 字母专业会错)
- `audit_log` **新旧两套列并存**:触发器写 `tbl/op/row_id/editor/before/after`;约 13 个手写审计函数写 `editor/action/target/detail`。**改此表前先查谁在写**,别换列名
- 老师离职 = 软删 `teachers.resigned`(**不要硬删**,会让历史排课变孤儿)
- 顶部主分页高亮靠 `switchTab` 的顺序数组按位置配对——**改分页顺序要同步改该数组**

## 相关档案
- `docs/运维交接单.md` — 接手/救急完整指南
- `migrations/` — 所有 DB 变更 SQL + `checks/rls_audit.sql`(安全体检,可随时重跑)

---

## 进度 / 待办（最后更新 2026-11-05 · 每次有进展就更这里）

### 目前做到哪
- 系统上线稳定运行,约 8 位同事日常使用;**全站实际操作体检通过,无 JS 崩溃**。
- DB 已跑到 `migrations/003`;**RLS 安全盘点 2026-11-05 全数通过**(全绿)。
- 本轮完成:
  - 修 3 个 bug(均已上线):① 分页高亮错位(教务须知↔教学统计)② 排课/IS-SG 表头计数误导 → 「显示 X / 共 Y」③ 顶部「专业库」计数错源(11→10)
  - 新功能:老师离职软删存档(`migrations/003`)、后台分页分组 + 学年学期/专业卡片、编辑记录加「老师/届别」类型 + 改动一行逗号、归档按类型(排课+IS/SG vs 期末考 独立)
  - 运维基建:建 `migrations/` 变更存档、写 `docs/运维交接单.md`、建本 CLAUDE.md、交接单+migrations 已备份到 Google Drive

### 下一步要做什么（按优先级）
1. **基线快照 `migrations/000`**（一次性,未做)— 请 Aj. Tsai 跑 `000_baseline_HOWTO.md` 里的只读查询,把结果给我存档,作为 DB 现状定锚。
2. **P1 · 清 audit 双写** — `add_record/update_record/delete_record` 仍有手写旧列审计,与触发器重复,每次编辑写两条(一真一空;前端已过滤空行,但 DB 仍持续膨胀)。移除这三个函数里的手写审计即可。
3. **P1 · 报错透出推广** — 把 `_errText()` 接到更多后台写操作(目前只接了 `opsAfter` / `addCohSubmit`)。
4. **P1 · 届别改卡片** — 后台「届别」仍是表格;改卡片时**必须保留年限 + 在读/已毕业状态**,别丢信息。
5. **P2** — 原生 `alert`(117 处)→ toast;加**云端排程备份**(目前只靠本机 launchd,单点风险);顶部「专业」三处数字标示统一。
6. **非技术待办** — 运维交接单第 2、9 节「待填」(密码保管处、备援联络人)由 Aj. Tsai 补;Drive 交接单副本是快照,需同步时请我重传。
