-- ============================================================
-- 008  教室库 rooms（「课表制作」功能 · 阶段①）
-- 写于:2026-11-13   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- ------------------------------------------------------------
-- 为什么:
--   「课表制作」要把课排进「周几·上午/下午·教室」。教室(含容量)在此功能前不归 BA 系统管,
--   现在请进系统:后台「教室库」可增删改,求解器据 cap(容量) 判容量、据 pref_dept(优先专业) 做软优先。
--
-- 改了什么:
--   ① 建表 rooms —— 每间一条:code(教室号,主键) / cap(容量,整数) / pref_dept(优先专业,可空) / sort(排序,可空)
--   ② 种 12 间初始教室(见设计稿 §3.2;on conflict do nothing → 可安全重跑)
--   ③ RPC admin_upsert_room / admin_del_room —— 后台增删改,_admin(p_pin) 验管理员
--
-- 权限/安全(同 schedule / 007 模式,见 CLAUDE.md「写入全走 security-definer RPC;anon 只读」):
--   - rooms 不开 RLS,但只 grant select 给 anon、不给写权限 → 外人读得到(容量非个资)、写不了。
--   - 写入一律走下方 SECURITY DEFINER 函数,函数内 _admin(p_pin) 验管理员。
--   - 下次安全体检(health_check_all)会把 rooms 列为「RLS 关但不可写」,属预期,同 archived_terms 等基线。
--   - 刻意不挂 trg_audit(编辑记录):教室库是设施配置、极少改,比照 007 不挂。
--     (若日后要进编辑记录,再挂 trg_audit + 前端 _AUD_TBLS 加一行即可。)
--
-- 回滚:
--   drop function if exists public.admin_del_room(text,text);
--   drop function if exists public.admin_upsert_room(text,text,integer,text);
--   drop table if exists public.rooms;
-- ============================================================

-- ① 教室表 ---------------------------------------------------------------
create table if not exists public.rooms(
  code      text primary key,
  cap       integer not null default 0,
  pref_dept text,
  sort      integer
);

-- 读:anon 只读(容量非个资);写:不给 anon,只走下方 RPC ---------------------
grant select on public.rooms to anon, authenticated;

-- ② 种 12 间初始教室(设计稿 §3.2)--------------------------------------
insert into public.rooms(code, cap, pref_dept, sort) values
  ('321',   40, 'CD', 10),
  ('322',   40, 'CD', 20),
  ('233',   45, null, 30),
  ('234',   45, null, 40),
  ('235',   50, null, 50),
  ('236',   60, null, 60),
  ('51301', 66, null, 70),
  ('51302', 66, null, 80),
  ('51303', 66, null, 90),
  ('51304', 66, null, 100),
  ('51305', 120, null, 110),
  ('51405', 120, null, 120)
on conflict(code) do nothing;

-- ③ 新增 / 修改教室(code 为主键;改容量或优先专业走 upsert)------------------
create or replace function public.admin_upsert_room(p_pin text, p_code text, p_cap integer, p_pref_dept text)
 returns json
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text;
begin
  ed := _admin(p_pin);                                  -- 验管理员;顺带 set app.editor
  if ed is null then return json_build_object('success', false, 'error', '需要管理员权限'); end if;
  if coalesce(trim(p_code), '') = '' then return json_build_object('success', false, 'error', '教室号不能为空'); end if;

  insert into public.rooms(code, cap, pref_dept)
    values(trim(p_code), coalesce(p_cap, 0), nullif(trim(coalesce(p_pref_dept, '')), ''))
    on conflict(code) do update set
      cap       = coalesce(excluded.cap, 0),
      pref_dept = excluded.pref_dept;

  return json_build_object('success', true);
end $function$;

-- ④ 删除教室 ------------------------------------------------------------
create or replace function public.admin_del_room(p_pin text, p_code text)
 returns json
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text;
begin
  ed := _admin(p_pin);
  if ed is null then return json_build_object('success', false, 'error', '需要管理员权限'); end if;
  delete from public.rooms where code = trim(p_code);
  return json_build_object('success', true);
end $function$;

-- 函数 EXECUTE:PostgreSQL 默认 PUBLIC(含 anon)可执行新函数,此处显式写明以防默认被改。
grant execute on function public.admin_upsert_room(text, text, integer, text) to anon, authenticated;
grant execute on function public.admin_del_room(text, text)                   to anon, authenticated;

-- ============================================================
-- 跑完后自检(可选,贴 SQL Editor):
--   select code, cap, pref_dept from public.rooms order by sort, code;   -- 应列 12 间
--   -- 用管理员 PIN 测改容量(把 <PIN> 换成管理员 PIN):
--   -- select public.admin_upsert_room('<PIN>','235', 55, '');  -- 235 容量 50→55
--   -- select public.admin_upsert_room('<badpin>','235', 55, ''); -- 应回「需要管理员权限」
-- ============================================================
