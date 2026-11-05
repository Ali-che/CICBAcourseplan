-- ============================================================
-- 001  audit_log 兼容新旧两套列
-- 跑于:2026-11-05   状态:✅ 已跑(新增届别随后恢复正常)
-- ------------------------------------------------------------
-- 为什么:
--   「编辑记录」B 方案把 audit_log 建成新列(tbl/op/row_id/editor/before/after),
--   但 add_record / delete_record / admin_add_cohort / admin_add_teacher …
--   约 13 个旧函数仍写旧列(editor/action/target/detail)。
--   新表没有 action/target/detail → 新增届别/老师等后台操作报错:
--       42703  column "action" of relation "audit_log" does not exist
--   权限闸其实通过了,却在审计那行整笔回滚,前端只显示 "操作失败: unknown"。
-- 改了什么:
--   给 audit_log 补回旧列、并放宽新列的非空约束,让两套写法并存。
-- ============================================================

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS target text,
  ADD COLUMN IF NOT EXISTS detail jsonb;

ALTER TABLE public.audit_log ALTER COLUMN tbl      DROP NOT NULL;
ALTER TABLE public.audit_log ALTER COLUMN op       DROP NOT NULL;
ALTER TABLE public.audit_log ALTER COLUMN row_id   DROP NOT NULL;
ALTER TABLE public.audit_log ALTER COLUMN "before" DROP NOT NULL;
ALTER TABLE public.audit_log ALTER COLUMN "after"  DROP NOT NULL;

-- 后续待办(尚未做):清掉 add_record/update_record/delete_record 里多余的
-- 旧列手写审计(触发器已覆盖),以免每次编辑写两条(一条真一条空)。
