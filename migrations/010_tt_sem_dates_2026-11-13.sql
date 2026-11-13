-- ============================================================
-- 010  上/下半学期日期 tt_sem_dates（「课表制作」功能 · 阶段⑤ 列印抬头用）
-- 写于:2026-11-13   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- ------------------------------------------------------------
-- 为什么:
--   课表列印(上/下半各一张 A4)抬头要标「上半 X 月 X 日 ~ Y 月 Y 日 / 下半 …」。
--   这组日期每学期不同、要可维护,存成一张小设定表(设计 §3.3)。
--   整学期制的学期(如 2569-3,无上下半)把上半、下半都填成整个学期区间即可。
--
-- 改了什么:
--   ① 建表 tt_sem_dates —— 每学年学期一条:sem(主键)/ up_start,up_end,dn_start,dn_end(date,可空)
--   ② RPC tt_set_sem_dates(p_pin,p_sem,p_us,p_ue,p_ds,p_de) —— 设定该学期日期(日期用文字 yyyy-mm-dd,空字串→null)
--        **能改 = Head of Administration(teacher)+Admin**(同 timetable_save,设计 §2;director/pic 只读)。
--   读:anon 只读;前端 sget('tt_sem_dates?sem=eq.<sem>')。
--
-- 权限/安全(同 009):rooms/timetable 一套——RLS 关、只 grant select 给 anon、写走 security-definer、不挂 trg_audit。
--
-- 回滚:
--   drop function if exists public.tt_set_sem_dates(text,text,text,text,text,text);
--   drop table if exists public.tt_sem_dates;
-- ============================================================

create table if not exists public.tt_sem_dates(
  sem      text primary key,
  up_start date,
  up_end   date,
  dn_start date,
  dn_end   date
);

grant select on public.tt_sem_dates to anon, authenticated;

create or replace function public.tt_set_sem_dates(p_pin text, p_sem text, p_us text, p_ue text, p_ds text, p_de text)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text;
begin
  select name into ed from public.pins where pin = trim(p_pin) and role in ('admin', 'teacher') limit 1;   -- 同 timetable_save
  if ed is null then return jsonb_build_object('success', false, 'error', '需要 Head of Administration 或管理员权限'); end if;
  if coalesce(trim(p_sem), '') = '' then return jsonb_build_object('success', false, 'error', '缺学期'); end if;

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

-- ============================================================
-- 跑完后可顺手种 Aj. Tsai 给的日期(可选;把 <PIN> 换成 teacher/admin PIN):
--   select public.tt_set_sem_dates('<PIN>','2569-2','2027-01-11','2027-03-05','2027-03-15','2027-05-09');
--   select public.tt_set_sem_dates('<PIN>','2569-3','2027-05-31','2027-07-25','2027-05-31','2027-07-25'); -- 整学期:上下半同区间
--   select * from public.tt_sem_dates order by sem;
-- ============================================================
