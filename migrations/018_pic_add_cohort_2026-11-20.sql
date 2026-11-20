-- ============================================================
-- 018  Program-in Charge(pic)也能新增届别
-- 写于:2026-11-20   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- ------------------------------------------------------------
-- 为什么:pic 要能在排课表「➕ 新增届别」与批量导入时自动建档新届别。
--   原本 admin_add_cohort 靠 _admin() 验证,只认 admin / director / 主任,pic 会被挡回「需要管理员权限」。
-- 做法:不动旧函数(admin_add_cohort / admin_set_cohort_years 原样保留,后台操作的届别分页照旧用),
--   新增两个函数,角色放宽到 admin / director / 主任 / pic:
--   ① cohort_add(p_pin,p_dept,p_cohort)      —— 新增届别(已存在就回错,不重复)
--   ② cohort_set_years(p_pin,p_cohort,p_years) —— 设修业年限(有就改、没有就新增)
--   验证成功时 set_config('app.editor',姓名) → 编辑记录(trg_audit)的修改人正确。
-- 前端:index.html 的 adminAddCohort / adminSetCohortYears 改先走新函数;新函数还没建时自动退回旧函数(所以先上前端、后跑本档都安全)。
-- 回滚:drop function public.cohort_add(text,text,text); drop function public.cohort_set_years(text,text,numeric);
-- ============================================================

create or replace function public.cohort_add(p_pin text, p_dept text, p_cohort text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare ed text; nid bigint;
begin
  select name into ed from pins where pin = trim(p_pin) and role in ('admin','director','主任','pic') limit 1;
  if ed is null then return json_build_object('success',false,'error','需要管理员、主任或 Program-in Charge 权限'); end if;
  perform set_config('app.editor', ed, true);
  if coalesce(trim(p_cohort),'')='' then return json_build_object('success',false,'error','届别代码不能为空'); end if;
  if exists(select 1 from cohorts where lower(cohort)=lower(trim(p_cohort))) then
    return json_build_object('success',false,'error','届别「'||trim(p_cohort)||'」已存在');
  end if;
  insert into cohorts(dept,cohort) values(trim(p_dept),trim(p_cohort)) returning id into nid;
  return json_build_object('success',true,'id',nid);
end $$;

create or replace function public.cohort_set_years(p_pin text, p_cohort text, p_years numeric)
returns json language plpgsql security definer set search_path to 'public' as $$
declare ed text;
begin
  select name into ed from pins where pin = trim(p_pin) and role in ('admin','director','主任','pic') limit 1;
  if ed is null then return json_build_object('success',false,'error','需要管理员、主任或 Program-in Charge 权限'); end if;
  perform set_config('app.editor', ed, true);
  if p_years is null or p_years<0.5 or p_years>8 then return json_build_object('success',false,'error','年限需在 0.5–8 年'); end if;
  update cohort_years set years=p_years where cohort=trim(p_cohort);
  if not found then insert into cohort_years(cohort,years) values(trim(p_cohort),p_years); end if;
  return json_build_object('success',true);
end $$;

revoke all on function public.cohort_add(text,text,text) from public;
revoke all on function public.cohort_set_years(text,text,numeric) from public;
grant execute on function public.cohort_add(text,text,text) to anon, authenticated;
grant execute on function public.cohort_set_years(text,text,numeric) to anon, authenticated;
notify pgrst, 'reload schema';

-- 档尾自检(跑完后):
--   1) 假 PIN:select cohort_add('0000000','X','ZZZ-TEST');   → success=false「需要管理员…权限」(证明函数在、PostgREST 认得)
--   2) pic 的真 PIN 新增一个测试届别,再到后台删掉;编辑记录应出现「届别」新增、修改人=pic 姓名。
