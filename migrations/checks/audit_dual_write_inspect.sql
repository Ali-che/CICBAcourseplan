-- ============================================================
-- 只读体检:audit 双写现状(为 migration 004「清 audit 双写」做准备)
-- 不改任何数据,可随时重跑。在 Supabase → SQL Editor 跑,结果整份贴回给 Claude。
-- ============================================================

-- ① 三个函数的完整现行定义
select p.proname, pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('add_record','update_record','delete_record')
order by p.proname;

-- ② 触发器:确认 schedule / special 等表确实有审计触发器覆盖(移除手写审计前必须确认)
select c.relname as tbl, t.tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
order by c.relname, t.tgname;

-- ③ 双写量(全表):旧列行 vs 新列行
select case when tbl is null then '旧列(手写)' else '新列(触发器)' end as kind,
       coalesce(action, op) as act, count(*)
from audit_log
group by 1, 2 order by 1, 2;
