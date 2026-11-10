-- ============================================================
-- 编辑记录覆盖面体检(纯只读,不改任何东西)  2026-11-10
-- 用途:为 006「把后台其他资料也纳入编辑记录」收集现状:
--   ① public 每张表的栏位 ② 每张表已挂的触发器 ③ 所有函数(RPC)的完整定义
-- 用法:Supabase → SQL Editor 清空贴上 → Run → 结果只有一个格子,全选复制贴给 Claude。
-- 注意:函数定义可能含敏感逻辑,贴给 Claude 即可,不要提交进公开 repo。
-- ============================================================
SELECT
  '### 表与栏位' || E'\n' ||
  (SELECT string_agg(t, E'\n' ORDER BY t) FROM (
     SELECT c.table_name || ' (' || string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position) || ')' AS t
     FROM information_schema.columns c
     JOIN information_schema.tables tb ON tb.table_schema=c.table_schema AND tb.table_name=c.table_name
     WHERE c.table_schema='public' AND tb.table_type='BASE TABLE'
     GROUP BY c.table_name) x)
  || E'\n\n### 触发器' || E'\n' ||
  coalesce((SELECT string_agg(event_object_table || ' · ' || trigger_name || ' · ' || event_manipulation || ' · ' || action_statement, E'\n' ORDER BY event_object_table, trigger_name)
            FROM information_schema.triggers WHERE trigger_schema='public'), '(无)')
  || E'\n\n### 函数定义' || E'\n\n' ||
  (SELECT string_agg(pg_get_functiondef(p.oid), E'\n\n-- ========================================\n\n' ORDER BY p.proname)
   FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f')
  AS 结果;
