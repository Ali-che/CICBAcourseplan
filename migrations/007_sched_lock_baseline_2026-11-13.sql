-- ============================================================
-- 007  排课「定版基准线」+ 秘书处对账(sched_lock / sched_lock_ack + RPC)
-- 写于:2026-11-13   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- ------------------------------------------------------------
-- 为什么(流程痛点):
--   排课表「定版」后交 Head of Administration(秘书处,内部角色码 = teacher,只读)去排教室/定时间并印出;
--   但 Director 之后还会微调(改 课程/届别/班级人数/老师/上下半,不碰时段教室),秘书处不知情 → 纸本过期。
--   本功能让系统记一条「基准线」(= 定版那一刻的排课内容快照),之后把「定版当时 → 现在」的净差异
--   摊给秘书处对账;看得到、赖不掉,不靠口头沟通。
--
-- 改了什么:
--   ① 建表 sched_lock —— 每个学年学期一条「基准线」:
--        sem(主键) / version(每次定版或「对账到此」累加) / locked_at / locked_by(操作人名)
--        ver_code(定版当时的内容版本码,4码,与前端 _schVerCode 同算法,纯显示)
--        snapshot(jsonb:定版那一刻该学期的排课内容 [{id,course,half,cls,tc,cc}],对账据此算净差异)
--   ② 建表 sched_lock_ack —— 单笔「已对账」标记(秘书处想单独清掉某一笔时用):
--        (sem,row_id) 主键 / row_code(打勾当下那笔课的内容指纹) / acked_by / acked_at
--        对账时:某笔课的「现在指纹」== 它的 ack.row_code → 视为已处理(灰掉);那笔课再被改 → 指纹变 → 自动重新亮灯。
--   ③ RPC sched_set_baseline(p_pin,p_sem,p_snapshot,p_ver_code) —— 「定版」/「对账到此」(两者都=把基准线设成现在):
--        任何有效 PIN 可用(主由 Head of Administration 操作;Director/Admin 亦可);version 累加;顺手清掉该学期全部 ack(整批吸收)。
--   ④ RPC sched_ack_row(p_pin,p_sem,p_row_id,p_row_code,p_on) —— 单笔勾/取消勾一笔课(p_on=true 打勾、false 取消)。
--
-- 权限/安全(与 schedule 同模式,见 CLAUDE.md「写入全走 security-definer RPC;anon 只读」):
--   - 两张表 **不开 RLS**,但 **只 grant select 给 anon**、不给写权限 → 外人读得到(内容=排课,本就可匿名读、无个资)、写不了。
--   - 写入一律走下方 SECURITY DEFINER 函数(以 owner 身份写),函数内 _pin_editor(p_pin) 验 PIN。
--   - **下次安全体检(health_check_all)会把 sched_lock / sched_lock_ack 列为「RLS 关但不可写」,属预期,同 archived_terms 等基线。**
--   - 刻意不挂 trg_audit(编辑记录):这是流程状态、非业务资料,同 presence/messages 不挂;最新定版人已在 locked_by/version。
--
-- 回滚:
--   drop function if exists public.sched_ack_row(text,text,text,text,boolean);
--   drop function if exists public.sched_set_baseline(text,text,jsonb,text);
--   drop table if exists public.sched_lock_ack;  drop table if exists public.sched_lock;
-- ============================================================

-- ① 基准线表 -------------------------------------------------------------
create table if not exists public.sched_lock(
  sem        text primary key,
  version    integer     not null default 1,
  locked_at  timestamptz not null default now(),
  locked_by  text,
  ver_code   text,
  snapshot   jsonb       not null default '[]'::jsonb,
  note       text
);

-- ② 单笔「已对账」标记表 -------------------------------------------------
create table if not exists public.sched_lock_ack(
  sem       text        not null,
  row_id    text        not null,
  row_code  text,
  acked_by  text,
  acked_at  timestamptz not null default now(),
  primary key (sem, row_id)
);

-- 读:anon 只读(内容=排课,无个资);写:不给 anon,只走下方 RPC ---------------
grant select on public.sched_lock     to anon, authenticated;
grant select on public.sched_lock_ack to anon, authenticated;

-- ③ 定版 / 对账到此:把某学期基准线设为「现在」----------------------------
create or replace function public.sched_set_baseline(p_pin text, p_sem text, p_snapshot jsonb, p_ver_code text)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text; v integer;
begin
  ed := _pin_editor(p_pin);                         -- 任何有效 PIN;顺带 set app.editor
  if ed is null then return jsonb_build_object('success', false, 'error', 'PIN 无效'); end if;
  if coalesce(trim(p_sem), '') = '' then return jsonb_build_object('success', false, 'error', '缺学期'); end if;

  insert into public.sched_lock(sem, version, locked_at, locked_by, ver_code, snapshot)
    values(trim(p_sem), 1, now(), ed, p_ver_code, coalesce(p_snapshot, '[]'::jsonb))
    on conflict(sem) do update set
      version   = public.sched_lock.version + 1,
      locked_at = now(),
      locked_by = ed,
      ver_code  = excluded.ver_code,
      snapshot  = excluded.snapshot
    returning version into v;

  delete from public.sched_lock_ack where sem = trim(p_sem);   -- 新基准线:旧的单笔勾一并吸收

  return jsonb_build_object('success', true, 'version', v, 'locked_by', ed);
end $function$;

-- ④ 单笔勾 / 取消勾一笔课 ------------------------------------------------
create or replace function public.sched_ack_row(p_pin text, p_sem text, p_row_id text, p_row_code text, p_on boolean)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text;
begin
  ed := _pin_editor(p_pin);
  if ed is null then return jsonb_build_object('success', false, 'error', 'PIN 无效'); end if;
  if coalesce(trim(p_sem), '') = '' or coalesce(trim(p_row_id), '') = '' then
    return jsonb_build_object('success', false, 'error', '缺学期或行 id');
  end if;

  if p_on then
    insert into public.sched_lock_ack(sem, row_id, row_code, acked_by, acked_at)
      values(trim(p_sem), trim(p_row_id), p_row_code, ed, now())
      on conflict(sem, row_id) do update set
        row_code = excluded.row_code, acked_by = ed, acked_at = now();
  else
    delete from public.sched_lock_ack where sem = trim(p_sem) and row_id = trim(p_row_id);
  end if;

  return jsonb_build_object('success', true);
end $function$;

-- 函数 EXECUTE:PostgreSQL 默认 PUBLIC(含 anon)可执行新函数,此处显式写明以防默认被改。
grant execute on function public.sched_set_baseline(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.sched_ack_row(text, text, text, text, boolean) to anon, authenticated;

-- ============================================================
-- 跑完后自检(可选,贴 SQL Editor):
--   select * from public.sched_lock;                      -- 应为空(还没定版)
--   -- 用一个真实 PIN 定版一个学期(把 <PIN> 换成有效 PIN):
--   -- select public.sched_set_baseline('<PIN>','2570-1','[]'::jsonb,'TEST');
--   -- select sem,version,locked_by,ver_code from public.sched_lock where sem='2570-1';  -- version=1
--   -- 再跑一次同学期 → version=2(验证累加)。测完 delete from public.sched_lock where sem='2570-1';
-- ============================================================
