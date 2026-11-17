-- ============================================================
-- 015  Head of Administration 也能改「教室库」与「课表日期」
-- 写于:2026-11-17   状态:✅ 已跑(Aj. Tsai 2026-11-17;假 PIN 实测三个函数都回新版提示)
-- ------------------------------------------------------------
-- 为什么:
--   Aj. Tsai 要求把「⚙️ 后台操作」里的 教室库 + 课表日期 开给 Head of Administration
--   (内部角色码 role='teacher')。课表制作本来就是 Head + 管理员在排(009 timetable_save),
--   教室与上下半日期是排课表要用的资料,让 Head 自己维护。
--   前端同日改:Head 看得到「后台操作」分页,但里面只有这两个子分页。
--
-- 改了什么(三个函数只换权限判断,其余逻辑与 008 / 011 相同):
--   ① admin_upsert_room  : _admin(p_pin)       → _admin(p_pin) 或 pins.role = 'teacher'
--   ② admin_del_room     : _admin(p_pin)       → _admin(p_pin) 或 pins.role = 'teacher'
--      (_admin 原本认的角色一个不少,只是多放行 teacher)
--   ③ tt_set_sem_dates   : pins.role = 'admin' → pins.role in ('admin','teacher')
--   三个都照旧 set_config('app.editor') → 编辑记录(012 挂的 trg_audit)的修改人正确带出。
--   函数名与参数不变(前端不用改接线);后台其余 admin_* 函数没动,Head 仍然改不了别的。
--
-- 回滚:
--   重跑 008 的 ③④ 两个函数 与 011 的 tt_set_sem_dates。
-- ============================================================

create or replace function public.admin_upsert_room(p_pin text, p_code text, p_cap integer, p_pref_dept text)
 returns json
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text;
begin
  ed := _admin(p_pin);                                  -- 原本的管理员判断照旧(顺带 set app.editor)
  if ed is null then                                    -- 新增:Head of Administration(role=teacher)
    select name into ed from public.pins where pin = trim(p_pin) and role = 'teacher' limit 1;
  end if;
  if ed is null then return json_build_object('success', false, 'error', '需要 Head of Administration 或管理员权限'); end if;
  if coalesce(trim(p_code), '') = '' then return json_build_object('success', false, 'error', '教室号不能为空'); end if;
  perform set_config('app.editor', ed, true);

  insert into public.rooms(code, cap, pref_dept)
    values(trim(p_code), coalesce(p_cap, 0), nullif(trim(coalesce(p_pref_dept, '')), ''))
    on conflict(code) do update set
      cap       = coalesce(excluded.cap, 0),
      pref_dept = excluded.pref_dept;

  return json_build_object('success', true);
end $function$;

create or replace function public.admin_del_room(p_pin text, p_code text)
 returns json
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text;
begin
  ed := _admin(p_pin);                                  -- 原本的管理员判断照旧(顺带 set app.editor)
  if ed is null then                                    -- 新增:Head of Administration(role=teacher)
    select name into ed from public.pins where pin = trim(p_pin) and role = 'teacher' limit 1;
  end if;
  if ed is null then return json_build_object('success', false, 'error', '需要 Head of Administration 或管理员权限'); end if;
  perform set_config('app.editor', ed, true);
  delete from public.rooms where code = trim(p_code);
  return json_build_object('success', true);
end $function$;

create or replace function public.tt_set_sem_dates(p_pin text, p_sem text, p_us text, p_ue text, p_ds text, p_de text)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text;
begin
  select name into ed from public.pins where pin = trim(p_pin) and role in ('admin', 'teacher') limit 1;
  if ed is null then return jsonb_build_object('success', false, 'error', '需要 Head of Administration 或管理员权限'); end if;
  if coalesce(trim(p_sem), '') = '' then return jsonb_build_object('success', false, 'error', '缺学期'); end if;
  perform set_config('app.editor', ed, true);

  insert into public.tt_sem_dates(sem, up_start, up_end, dn_start, dn_end)
    values(trim(p_sem),
           nullif(trim(coalesce(p_us,'')),'')::date, nullif(trim(coalesce(p_ue,'')),'')::date,
           nullif(trim(coalesce(p_ds,'')),'')::date, nullif(trim(coalesce(p_de,'')),'')::date)
    on conflict(sem) do update set
      up_start = excluded.up_start, up_end = excluded.up_end,
      dn_start = excluded.dn_start, dn_end = excluded.dn_end;

  return jsonb_build_object('success', true);
end $function$;

grant execute on function public.admin_upsert_room(text, text, integer, text)             to anon, authenticated;
grant execute on function public.admin_del_room(text, text)                               to anon, authenticated;
grant execute on function public.tt_set_sem_dates(text, text, text, text, text, text)     to anon, authenticated;

-- 跑完自检:
--   用假 PIN 测,应回「需要 Head of Administration 或管理员权限」(看到这句=新版已生效):
--   select public.admin_upsert_room('x','235',50,'');
--   select public.tt_set_sem_dates('x','2569-1','','','','');
-- ============================================================
