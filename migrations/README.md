# 数据库变更存档(migrations)

这个资料夹存**所有改过 Supabase 数据库的 SQL**——建表、改表、建/改函数、权限等。
目的:以后改了什么有据可查,换人接手也能看懂数据库现状。

## 规则(很简单)

1. **每改一次数据库,就新建一个档**,不要改旧档。
2. 档名格式:`NNN_说明_日期.sql`,编号顺着往下加。
   例:`003_新增删除届别审计_2026-11-10.sql`
3. 档案开头用注释写清楚:**什么时候跑的、为什么改、改了什么**。
4. **跑过的档不要再动它**(它代表历史已发生的事)。要再改,就开新编号。
5. `000_` 是**基线快照**(某一天数据库的完整现状),作为一切的起点。
6. `checks/` 放**只读体检查询**(不改数据,随时可重跑),例如 RLS 安全盘点。

## 现有档案

| 档 | 内容 | 状态 |
|---|---|---|
| `000_baseline_2026-11-05.sql` | 基线:当天所有函数/表的完整定义 | 待填入(见 `000_baseline_HOWTO.md`) |
| `001_audit_log_dual_schema_2026-11-05.sql` | 修 audit_log 新旧列冲突(新增届别/老师报错 42703) | ✅ 已跑 |
| `002_admin_add_cohort_audit_newcols_2026-11-05.sql` | 新增届别写进「编辑记录」 | ✅ 已跑(2026-11-09 audit_log 见 cohorts INSERT 新列行) |
| `003_teacher_resigned_archive_2026-11-05.sql` | 老师离职软删存档(`teachers.resigned`) | ✅ 已跑 |
| `004_remove_manual_audit_record_fns_2026-11-09.sql` | 清 audit 双写:排课/IS-SG 增删改只留触发器一条;删除人改记真正删的人 | ✅ 已跑 |
| `005_btec_students_ic_to_ibce_2026-11-10.sql` | BTEC 学生专业 IC → IBCE(只改 BTEC 学生表 dept) | ⏳ 待跑 |
| `checks/rls_audit.sql` | RLS 安全盘点(全表防护+外人写权限) | 只读,可重跑 |
| `checks/audit_dual_write_inspect.sql` | audit 双写体检(三函数定义 / 触发器 / 新旧列行数) | 只读,可重跑 |

> 约定:**从此以后,凡是给出要在 Supabase 跑的 SQL,都会同时在这里存一个编号档。**
