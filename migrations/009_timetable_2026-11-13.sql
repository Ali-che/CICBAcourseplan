-- ============================================================
-- 009  课表存档 timetable（「课表制作」功能 · 阶段②）
-- 写于:2026-11-13   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- ------------------------------------------------------------
-- 为什么:
--   「课表制作」自动/手动把该学期的课排进「周几·上午下午·教室」后,要能存起来、重开续排、列印。
--   本表每学期存一份当前排好的布局(placements);求解器/标红在前端据此 + schD 重算,表只存结果。
--
-- 改了什么:
--   ① 建表 timetable —— 每学年学期一条:
--        sem(主键) / placements(jsonb:[{id,course,half,day,slot,room}],每门课的落位)
--        version(每次存档累加) / saved_by(存档人) / saved_at / note
--   ② RPC timetable_save(p_pin,p_sem,p_placements) —— 存/覆盖该学期课表。
--        **能存 = Head of Administration(角色码 teacher) + Admin**(设计 §2;Director/pic/其余只读)。
--        这是本系统里少数「teacher 能写、director 不能写」的操作,故不走 _admin/_pin_editor,
--        改在函数内直接 role in ('admin','teacher') 查(见下)。
--   读:anon 只读(内容=课表时段教室,无个资),前端 sget('timetable?sem=eq.<sem>') 直接读,不另开读 RPC。
--
-- 权限/安全(同 schedule / 007 / 008 模式):
--   - timetable 不开 RLS,但只 grant select 给 anon、不给写 → 外人读得到、写不了。
--   - 写入走下方 SECURITY DEFINER 函数,内部查 pins.role。
--   - 下次安全体检(health_check_all)会把 timetable 列为「RLS 关但不可写」,属预期基线。
--   - 刻意不挂 trg_audit(编辑记录):课表布局是流程状态、比照 007 不挂;最新存档人已在 saved_by/version。
--
-- 回滚:
--   drop function if exists public.timetable_save(text,text,jsonb);
--   drop table if exists public.timetable;
-- ============================================================

-- ① 课表存档表 ---------------------------------------------------------
create table if not exists public.timetable(
  sem        text primary key,
  placements jsonb       not null default '[]'::jsonb,
  version    integer     not null default 1,
  saved_by   text,
  saved_at   timestamptz not null default now(),
  note       text
);

-- 读:anon 只读;写:不给 anon,只走下方 RPC -------------------------------
grant select on public.timetable to anon, authenticated;

-- ② 存档 / 覆盖该学期课表(能存 = teacher[Head] + admin)----------------------
create or replace function public.timetable_save(p_pin text, p_sem text, p_placements jsonb)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text; v integer;
begin
  -- 能存:Head of Administration(role=teacher) 与 admin;director/pic/其余不可(设计 §2)
  select name into ed from public.pins where pin = trim(p_pin) and role in ('admin', 'teacher') limit 1;
  if ed is null then return jsonb_build_object('success', false, 'error', '需要 Head of Administration 或管理员权限'); end if;
  if coalesce(trim(p_sem), '') = '' then return jsonb_build_object('success', false, 'error', '缺学期'); end if;
  perform set_config('app.editor', ed, true);

  insert into public.timetable(sem, placements, version, saved_by, saved_at)
    values(trim(p_sem), coalesce(p_placements, '[]'::jsonb), 1, ed, now())
    on conflict(sem) do update set
      placements = excluded.placements,
      version    = public.timetable.version + 1,
      saved_by   = ed,
      saved_at   = now()
    returning version into v;

  return jsonb_build_object('success', true, 'version', v, 'saved_by', ed);
end $function$;

-- 函数 EXECUTE:PostgreSQL 默认 PUBLIC(含 anon)可执行新函数,此处显式写明以防默认被改。
grant execute on function public.timetable_save(text, text, jsonb) to anon, authenticated;

-- ============================================================
-- 跑完后自检(可选,贴 SQL Editor):
--   select sem,version,saved_by,saved_at from public.timetable;    -- 应为空(还没存)
--   -- 用 Head(teacher) 或 admin 的 PIN 存一次(把 <PIN> 换成有效 teacher/admin PIN):
--   -- select public.timetable_save('<PIN>','2570-1','[{"id":"1","course":"BA101","half":"上","day":"周一","slot":"am","room":"235"}]'::jsonb);
--   -- select public.timetable_save('<director的PIN>','2570-1','[]'::jsonb);  -- 应回「需要 Head... 权限」
--   -- 测完 delete from public.timetable where sem='2570-1';
-- ============================================================
