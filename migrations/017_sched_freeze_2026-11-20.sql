-- ============================================================
-- 017  「暂停修改排课表」开关(课表制作期间,挡住 Director / PIC 改排课表)
-- 写于:2026-11-20   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- ------------------------------------------------------------
-- 为什么:
--   制作课表(课表制作分页)期间,排课表若被别人改动,课表就对不上、要重排。
--   需要一个开关:管理员 / Head of Administration 打开「暂停」后,
--   该学期的排课表不让其他角色(director / pic)新增、修改、删除;做完再关掉。
--
-- 改了什么:
--   ① 新表 sched_freeze —— 每个学期一条:sem(主键) / frozen / by_name / at / note
--   ② RPC sched_set_freeze(p_pin,p_sem,p_on,p_note) —— 开/关暂停;只有 admin 与 teacher(Head) 能操作
--   ③ 触发器 trg_sched_freeze_guard (BEFORE insert/update/delete ON public.schedule) ——
--      该学期 frozen=true 时,若本次操作的人(app.editor → pins.name)不是 admin / teacher,
--      直接 raise exception「该学期排课表暂停修改…」。这是服务器端硬挡,不靠前端。
--      admin、Head(teacher) 不受限(课表制作「写回排课表」也走这条路,要放行)。
--
-- 注意(请先读):
--   - 触发器靠 app.editor 判断操作人(006 起 add_record / update_record / delete_record /
--     delete_multiple 先调 _admin / _pin_editor 会 set_config('app.editor'))。
--     若 app.editor 取不到(null),按「挡」处理(宁可挡错、不放行)——所以跑完请务必做档尾自检第 4 步。
--   - 同名 PIN 多个角色:只要 pins 里有一笔「同名且 role in (admin,teacher)」就放行。
--   - 读:anon 只读(与 sched_lock 同模式);写:不给 anon,只走 RPC。刻意不挂 trg_audit(流程状态)。
--   - 只管 schedule 表(排课表);IS/SG、期末考特例、BTEC 不受影响。
--
-- 回滚:
--   drop trigger if exists trg_sched_freeze_guard on public.schedule;
--   drop function if exists public.sched_freeze_guard();
--   drop function if exists public.sched_set_freeze(text,text,boolean,text);
--   drop table if exists public.sched_freeze;
-- ============================================================

-- ① 开关表 ----------------------------------------------------------------
create table if not exists public.sched_freeze(
  sem      text primary key,
  frozen   boolean     not null default false,
  by_name  text,
  at       timestamptz not null default now(),
  note     text
);
grant select on public.sched_freeze to anon, authenticated;

-- ② 开 / 关暂停 -----------------------------------------------------------
create or replace function public.sched_set_freeze(p_pin text, p_sem text, p_on boolean, p_note text default null)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text;
begin
  select name into ed from public.pins where pin = trim(p_pin) and role in ('admin','teacher') limit 1;
  if ed is null then
    return jsonb_build_object('success', false, 'error', '需要 Head of Administration 或管理员权限');
  end if;
  if coalesce(trim(p_sem), '') = '' then
    return jsonb_build_object('success', false, 'error', '缺学期');
  end if;
  perform set_config('app.editor', ed, true);

  insert into public.sched_freeze(sem, frozen, by_name, at, note)
    values(trim(p_sem), coalesce(p_on, false), ed, now(), nullif(trim(coalesce(p_note,'')), ''))
    on conflict(sem) do update set
      frozen  = excluded.frozen,
      by_name = excluded.by_name,
      at      = now(),
      note    = excluded.note;

  return jsonb_build_object('success', true, 'frozen', coalesce(p_on, false), 'by', ed);
end $function$;

grant execute on function public.sched_set_freeze(text, text, boolean, text) to anon, authenticated;

-- ③ 写入拦截触发器 ---------------------------------------------------------
create or replace function public.sched_freeze_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare ed text := nullif(current_setting('app.editor', true), '');
        s  text;
        hit text;
begin
  -- 本次动到的学期(UPDATE 可能把 sem 改掉 → 新旧都检查)
  for s in
    select distinct x from unnest(array[
      case when tg_op <> 'INSERT' then to_jsonb(old)->>'sem' end,
      case when tg_op <> 'DELETE' then to_jsonb(new)->>'sem' end
    ]) as x where x is not null
  loop
    select f.sem into hit from public.sched_freeze f where f.sem = s and f.frozen limit 1;
    if hit is not null then
      -- admin / Head(teacher) 放行;其余(含取不到操作人)一律挡
      if ed is not null and exists (select 1 from public.pins p where p.name = ed and p.role in ('admin','teacher')) then
        null;
      else
        raise exception '学期 % 的排课表目前暂停修改(课表制作中),请等管理员或秘书处解除暂停后再改。', s
          using errcode = 'P0001';
      end if;
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

drop trigger if exists trg_sched_freeze_guard on public.schedule;
create trigger trg_sched_freeze_guard
  before insert or update or delete on public.schedule
  for each row execute function public.sched_freeze_guard();

-- ============================================================
-- 跑完后自检(贴 SQL Editor,逐步):
--   1) select * from public.sched_freeze;                              -- 应为空
--   2) 假 PIN 应被挡:select public.sched_set_freeze('x','2569-2',true,'');
--        → {"success":false,"error":"需要 Head of Administration 或管理员权限"}
--   3) 用管理员真 PIN 打开暂停:select public.sched_set_freeze('<管理员PIN>','2569-2',true,'课表制作中');
--        select * from public.sched_freeze;                           -- 2569-2 frozen=true
--   4) **关键**:在网页用 director 或 pic 的账号去改一笔 2569-2 排课 → 应弹出「暂停修改」提示;
--      用管理员(或 Head)改同一学期 → 应能改。两边都对才算通过。
--      若管理员也被挡 = app.editor 没带到,马上回滚(见上)并告诉我。
--   5) 测完关掉:select public.sched_set_freeze('<管理员PIN>','2569-2',false,'');
-- ============================================================
