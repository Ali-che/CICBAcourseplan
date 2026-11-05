-- ============================================================
-- 体检:RLS 安全盘点(只读,不改任何数据,可随时重跑)
-- ------------------------------------------------------------
-- 看最后一栏「结论」即可:
--   ⚠️ 危险 = 外人能直接改表且无防护,要赶紧修
--   🟡 要检查 = 有防护但外人仍有写权限
--   🟢 尚可 / ✅ 安全 = 没事
-- 结果按「最危险排最上面」排序。
--
-- 2026-11-05 首次盘点结论:全数通过,无 ⚠️ 无 🟡。
--   敏感/重要表 RLS 全开 ✅;仅 5 张非敏感参考表(archived_terms、
--   courses_extra、exam_school、notice、teach_btec)RLS 关但外人不能写 → 维持现状。
-- ============================================================

SELECT
  t.tablename AS 表名,
  CASE WHEN c.relrowsecurity THEN '开' ELSE '关' END AS "RLS防护",
  CASE WHEN COALESCE(g.w,0) > 0 THEN '能' ELSE '不能' END AS "外人可直接写",
  CASE
    WHEN COALESCE(g.w,0) > 0 AND NOT c.relrowsecurity THEN '⚠️ 危险:外人能直接改这张表,且没有防护'
    WHEN COALESCE(g.w,0) > 0 AND c.relrowsecurity     THEN '🟡 要检查:有防护,但外人仍有写权限'
    WHEN NOT c.relrowsecurity                          THEN '🟢 尚可:外人不能写(建议也开防护)'
    ELSE                                                    '✅ 安全'
  END AS 结论
FROM pg_tables t
JOIN pg_class c
  ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
LEFT JOIN (
  SELECT table_name, count(*) AS w
  FROM information_schema.role_table_grants
  WHERE table_schema='public'
    AND grantee IN ('anon','PUBLIC')
    AND privilege_type IN ('INSERT','UPDATE','DELETE')
  GROUP BY table_name
) g ON g.table_name = t.tablename
WHERE t.schemaname='public'
ORDER BY
  CASE
    WHEN COALESCE(g.w,0) > 0 AND NOT c.relrowsecurity THEN 0
    WHEN COALESCE(g.w,0) > 0                           THEN 1
    WHEN NOT c.relrowsecurity                          THEN 2
    ELSE 3
  END,
  t.tablename;
