-- ============================================================
-- BA 排课 · 安全体检「合一版」(只读,不改任何数据,可随时重跑)
-- ------------------------------------------------------------
-- 用法:Supabase → SQL Editor → 清空 → 整段贴上 → Run → 看「一张表」。
--   · 先扫「结论」栏有没有 ⚠️(危险)或 🟡(要检查)—— 这两个要处理。
--   · 🟢 / ✅ / ℹ️ = 没事或只是提示。
--   · 结果已排序:最危险的排最上面。
--
-- 合并自三个旧脚本:
--   rls_audit.sql(区块 A)+ 审计触发器覆盖(区块 B)+ audit 双写量(区块 C)
-- 为什么合成一段:SQL Editor 一次 Run 只显示「最后一个」结果表,
--   所以不能把多个 SELECT 直接叠着贴;这里用 UNION ALL 合成单一结果表。
--
-- 背景:上次 RLS 全绿是 2026-11-05,之后 migrations 004/005/006 动过结构
--   (006 给 21 张参考表挂了审计触发器、改了一批 RPC),本脚本用来复查。
-- 不含「函数源码 dump」—— 那是给 Claude 读逻辑用的,见本档最底部注释,另跑。
-- 2026-11-13
-- ============================================================
WITH
-- 外人(anon / PUBLIC)对每张表的「写」权限数(INSERT/UPDATE/DELETE)
gw AS (
  SELECT table_name, count(*) AS w
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'PUBLIC')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  GROUP BY table_name
),
-- 每张表是否挂了「审计触发器」(触发器函数名含 audit,如 audit_trg)
aud AS (
  SELECT DISTINCT c.relname AS tbl
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid AND c.relnamespace = 'public'::regnamespace
  JOIN pg_proc  p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal
    AND p.proname ILIKE '%audit%'
)

-- ───────── 区块 A:RLS 防护 + 外人可写(核心安全检查)─────────
SELECT
  CASE
    WHEN COALESCE(gw.w, 0) > 0 AND NOT c.relrowsecurity THEN 0
    WHEN COALESCE(gw.w, 0) > 0                           THEN 1
    WHEN NOT c.relrowsecurity                            THEN 2
    ELSE 3
  END                                                     AS "序",
  'A·RLS'                                                 AS "区块",
  t.tablename                                             AS "对象",
  (CASE WHEN c.relrowsecurity THEN 'RLS开' ELSE 'RLS关' END)
    || ' / 外人'
    || (CASE WHEN COALESCE(gw.w, 0) > 0 THEN '可写' ELSE '不可写' END)
                                                          AS "状态",
  CASE
    WHEN COALESCE(gw.w, 0) > 0 AND NOT c.relrowsecurity THEN '⚠️ 危险:外人能直接改这张表,且无防护'
    WHEN COALESCE(gw.w, 0) > 0 AND c.relrowsecurity     THEN '🟡 要检查:有防护,但外人仍有写权限'
    WHEN NOT c.relrowsecurity                           THEN '🟢 尚可:外人不能写(建议也开防护)'
    ELSE '✅ 安全'
  END                                                     AS "结论"
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
LEFT JOIN gw ON gw.table_name = t.tablename
WHERE t.schemaname = 'public'

UNION ALL

-- ───────── 区块 B:审计触发器覆盖(编辑记录)─────────
-- 006 后参考表应「有审计」;账号/PIN/消息/在线表本来就「不挂」—— 所以「无审计」只是清单,
-- 需人眼判断该不该挂,不是告警。
SELECT
  CASE WHEN a.tbl IS NULL THEN 5 ELSE 6 END,
  'B·审计覆盖',
  t.tablename,
  CASE WHEN a.tbl IS NULL THEN '无审计触发器' ELSE '有审计触发器' END,
  CASE WHEN a.tbl IS NULL
       THEN 'ℹ️ 无审计 — 确认是否应挂(pins/app_admins/partner_*/消息/在线 本就不挂)'
       ELSE '✅ 已纳入编辑记录'
  END
FROM pg_tables t
LEFT JOIN aud a ON a.tbl = t.tablename
WHERE t.schemaname = 'public'

UNION ALL

-- ───────── 区块 C:audit_log 双写量(确认 004「清双写」生效)─────────
-- 旧列(手写)= 004 之前的历史残留,数字不为 0 是正常的,关键是「不该再新增」。
-- 新列(触发器)= 现行写法。
SELECT 8, 'C·双写量', k.lab, k.cnt::text, k.note
FROM (
  SELECT
    (CASE WHEN tbl IS NULL THEN '旧列(手写)' ELSE '新列(触发器)' END)
      || ' · ' || COALESCE(action, op)                   AS lab,
    CASE WHEN tbl IS NULL
         THEN 'ℹ️ 旧列=004前历史,应不再新增'
         ELSE '✅ 新列=现行写法'
    END                                                  AS note,
    count(*)                                             AS cnt
  FROM audit_log
  GROUP BY 1, 2
) k

ORDER BY 1, 2, 3;

-- ============================================================
-- (选用)要我重新审 RPC 逻辑 / 触发器定义时,另跑这两段、结果整份贴回给 Claude。
--   含函数源码,可能有敏感逻辑 —— 贴给 Claude 即可,不要提交进公开 repo。
--
-- 一次性整包(表+栏位+触发器+所有函数定义,结果是一个大格子):
--   见 migrations/checks/audit_coverage_inspect.sql
-- 只看 add/update/delete_record 三函数 + 触发器 + 双写量:
--   见 migrations/checks/audit_dual_write_inspect.sql
-- ============================================================
