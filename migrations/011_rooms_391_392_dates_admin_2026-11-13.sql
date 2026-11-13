-- ============================================================
-- 011  加两间教室 391/392(各 80) + 课表日期设定改「只限管理员」
-- 写于:2026-11-13   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- ------------------------------------------------------------
-- 为什么:
--   ① Aj. Tsai 要再加两间教室 391、392(各容量 80)。008 已跑过不改,另开此档插入。
--   ② 课表「列印抬头日期」改成只有管理员能在后台设定(原本 teacher+admin;现收紧为 admin)。
--
-- 改了什么:
--   ① rooms 插入 391(80)、392(80)(on conflict do nothing,可安全重跑)。
--   ② 重定义 tt_set_sem_dates:权限由 role in('admin','teacher') 收紧为 role='admin'。
--
-- 回滚:
--   delete from public.rooms where code in('391','392');
--   -- tt_set_sem_dates 回 010 版(role in admin,teacher)
-- ============================================================

insert into public.rooms(code, cap, pref_dept, sort) values
  ('391', 80, null, 65),
  ('392', 80, null, 66)
on conflict(code) do nothing;

create or replace function public.tt_set_sem_dates(p_pin text, p_sem text, p_us text, p_ue text, p_ds text, p_de text)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text;
begin
  select name into ed from public.pins where pin = trim(p_pin) and role = 'admin' limit 1;   -- 只限管理员(Aj. Tsai 要求)
  if ed is null then return jsonb_build_object('success', false, 'error', '需要管理员权限'); end if;
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

grant execute on function public.tt_set_sem_dates(text, text, text, text, text, text) to anon, authenticated;

-- 跑完自检:
--   select code,cap from public.rooms where code in('391','392');   -- 应各 80
--   -- 用非 admin 的 PIN 测 tt_set_sem_dates 应回「需要管理员权限」
-- ============================================================
