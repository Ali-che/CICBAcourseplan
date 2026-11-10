-- ============================================================
-- 005  BTEC 学生专业 IC → IBCE
-- 写于:2026-11-10   状态:✅ 已跑(2026-11-10,Aj. Tsai 在 Supabase SQL Editor 执行)
-- ------------------------------------------------------------
-- 为什么:
--   BTEC 计划里有 5 位学生的「专业」仍标 IC(国际学院),实际应为 IBCE
--   (国际学院_国际商务专业(中英))。BTEC 学生的专业是存在学生资料里的字段,
--   不会跟专业库自动同步,所以要直接改资料。
-- 改了什么:
--   只改 BTEC 学生表的 dept 字段:'IC' → 'IBCE'。不动专业库(depts 里 IC 仍保留)、
--   不动排课 / 届别 / 其他表。
-- 注意:
--   repo 里查不到 BTEC 学生表的确切表名,所以下面先「找表」,再按找到的那一张改。
--   步骤 1、3 只读;步骤 2 才会改资料。
-- ============================================================

-- 步骤 1(只读):找出 BTEC 学生表,并预览会被改的人数
select c.table_name
from information_schema.columns c
where c.table_schema = 'public'
  and c.column_name = 'dept'
  and c.table_name ilike '%btec%';
-- ↑ 预期只出现 1 张表(例如 btec_students)。如出现多张,先停下来告诉 Claude。

-- 步骤 2(改资料):自动对上述唯一那张表执行 IC → IBCE
do $$
declare t text; n int; cnt int;
begin
  select count(*) into cnt
  from information_schema.columns
  where table_schema='public' and column_name='dept' and table_name ilike '%btec%';
  if cnt <> 1 then
    raise exception '找到 % 张含 dept 的 btec 表,预期 1 张;未修改任何资料', cnt;
  end if;
  select table_name into t
  from information_schema.columns
  where table_schema='public' and column_name='dept' and table_name ilike '%btec%';
  execute format('update public.%I set dept = %L where dept = %L', t, 'IBCE', 'IC');
  get diagnostics n = row_count;
  raise notice '表 %: 已把 % 位学生的专业 IC 改为 IBCE', t, n;
end $$;

-- 步骤 3(只读):核对。把下面的 btec_students 换成步骤 1 查到的表名
-- select dept, count(*) from public.btec_students group by dept order by dept;
-- 预期:不再有 IC;IBCE 多出原本 IC 的人数(画面上原为 IC 5)。
