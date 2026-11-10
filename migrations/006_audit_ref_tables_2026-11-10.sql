-- ============================================================
-- 006  编辑记录覆盖全部后台资料(课程总库/学期/专业/职位/毕业学分/教务须知/BTEC…)
-- 写于:2026-11-10   状态:⏳ 待跑
-- ------------------------------------------------------------
-- 为什么:
--   原本只有 schedule / special / exam_special 挂 trg_audit,编辑记录只看得到排课、IS/SG、期末考
--   (外加 002/003 手写的「新增届别」「离职/复职」)。其他后台改动多半只写旧列(界面不显示)或完全没写。
--   另外 exam_special 没有 editor 栏,触发器取 new.editor → 期末考记录的修改人一直是空的。
-- 改了什么:
--   ① 修改人改由 PIN 检查函数统一提供:_admin / _pin_editor / _can_exam 验证成功时
--      set_config('app.editor', 名字, true)(只在本次交易有效)。所有 RPC 都先调其中一个,
--      所以不必逐一改 30 多个函数。函数由 sql STABLE 改 plpgsql VOLATILE(set_config 要求),回传值不变。
--   ② audit_trg:修改人一律先取 app.editor,取不到才退回该行的 editor 栏;
--      UPDATE 前后完全相同(如 upsert 同值、admin_update_cohort 每次都写 grad_override)不记,免得一堆空行。
--   ③ 以下表加挂 trg_audit(INSERT/UPDATE/DELETE):
--      catalog, cohorts, cohort_years, depts, dept_map, courses_extra, semesters, positions, grad,
--      teachers, teach_btec, exam_school, notice, archived_terms,
--      btec, btec_student, btec_unit, btec_plan, btec_iv, btec_kind, btec_stat
--      刻意不挂:pins / app_admins / partner_*(含 PIN)、presence / messages / message_reads(高频/私信)、audit_log 本身。
--   ④ cohorts、teachers 改由触发器记,移除 002 / 003 手写的新列审计(否则一次动作出两条)。
--      admin_add_cohort / admin_set_teacher_resigned 其余逻辑一字不差。
--   旧列手写审计(admin_add_teacher 等写 editor/action/target/detail)保留不动:界面本来就隐藏,无害。
-- 回滚:
--   DROP TRIGGER trg_audit ON <③ 各表>;_admin/_pin_editor/_can_exam 改回 sql 单行 select;
--   audit_trg 改回 004 版;002/003 两函数把审计 insert 加回。
-- 验证(跑完后):见文末注释的查询。
-- ============================================================

-- ① PIN 检查函数顺手记下修改人 -------------------------------------------
CREATE OR REPLACE FUNCTION public._admin(p_pin text)
 RETURNS text
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n text;
begin
  select name into n from pins where pin = trim(p_pin) and role in ('admin','director','主任') limit 1;
  if n is not null then perform set_config('app.editor', n, true); end if;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public._pin_editor(p_pin text)
 RETURNS text
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n text;
begin
  select name into n from pins where pin = trim(p_pin) limit 1;
  if n is not null then perform set_config('app.editor', n, true); end if;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public._can_exam(p_pin text)
 RETURNS text
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n text;
begin
  select name into n from public.pins where pin = trim(p_pin) and role in ('admin','director','pic') limit 1;
  if n is not null then perform set_config('app.editor', n, true); end if;
  return n;
end $function$;

-- ② 通用审计触发器 -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare ed text := nullif(current_setting('app.editor', true),'');
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log(tbl,op,row_id,editor,before,after)
    values (tg_table_name,'DELETE',(to_jsonb(old)->>'id'),
            coalesce(ed,(to_jsonb(old)->>'editor')), to_jsonb(old), null);
    return old;
  end if;
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;   -- (006) 没有实际变化不记
  end if;
  insert into public.audit_log(tbl,op,row_id,editor,before,after)
  values (tg_table_name,tg_op,(to_jsonb(new)->>'id'),
          coalesce(ed,(to_jsonb(new)->>'editor')),
          case when tg_op='UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end $function$;

-- ③ 挂到参考资料表 -------------------------------------------------------
DO $$
declare t text;
begin
  foreach t in array array[
    'catalog','cohorts','cohort_years','depts','dept_map','courses_extra','semesters','positions','grad',
    'teachers','teach_btec','exam_school','notice','archived_terms',
    'btec','btec_student','btec_unit','btec_plan','btec_iv','btec_kind','btec_stat']
  loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function public.audit_trg()', t);
  end loop;
end $$;

-- ④ 拿掉会和触发器重复的新列手写审计 ---------------------------------------
CREATE OR REPLACE FUNCTION public.admin_add_cohort(p_pin text, p_dept text, p_cohort text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare ed text; nid bigint;
begin
  ed := _admin(p_pin);
  if ed is null then
    return json_build_object('success',false,'error','需要管理员权限');
  end if;
  if coalesce(trim(p_cohort),'')='' then
    return json_build_object('success',false,'error','届别代码不能为空');
  end if;
  insert into cohorts(dept,cohort) values(trim(p_dept),trim(p_cohort)) returning id into nid;
  -- (006 移除,改由 trg_audit 记) insert into audit_log(tbl,op,editor,after) values('cohorts','INSERT',ed,…);
  return json_build_object('success',true,'id',nid);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_teacher_resigned(p_pin text, p_name text, p_resigned boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare ed text;
begin
  ed := _admin(p_pin);
  if ed is null then
    return json_build_object('success',false,'error','需要管理员权限');
  end if;
  update teachers set resigned = coalesce(p_resigned,false) where name = p_name;
  if not found then
    return json_build_object('success',false,'error','找不到老师:'||coalesce(p_name,''));
  end if;
  -- (006 移除,改由 trg_audit 记) insert into audit_log(tbl,op,editor,after) values('teachers','UPDATE',ed,…);
  return json_build_object('success',true);
end;
$function$;

-- ------------------------------------------------------------
-- 验证(跑完后另开一页执行,只读):应列出 24 张表都有 trg_audit
--   select event_object_table, count(*) from information_schema.triggers
--   where trigger_schema='public' and trigger_name='trg_audit' group by 1 order by 1;
-- 再到网页后台改一笔职位额度(改回原值也行)→ 编辑记录应出现「职位 · 修改 · 你的名字」。
-- ------------------------------------------------------------
