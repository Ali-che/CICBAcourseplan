-- ============================================================
-- 012  课表制作:管理员可删除某学期的课表存档
-- 写于:2026-11-15   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- ------------------------------------------------------------
-- 为什么:
--   Aj. Tsai 测试「课表制作」时存了档(例:2569-2 v2),测试完想把存档删掉,回到「尚未存档」。
--   timetable 表只 grant select 给 anon、写入一律走 security-definer RPC(见 009),
--   原本只有 timetable_save(存/覆盖),没有删除的路 → 加一支只给管理员的删除 RPC。
--
-- 改了什么:
--   新增 RPC timetable_delete(p_pin, p_sem):
--     · 只收 role='admin' 的 PIN(Head of Administration 能存档,但不能删)。
--     · 删掉 public.timetable 里该学期那一行;回 {success:true, deleted:行数}。
--     · 同 timetable_save 的写法:函数内直接查 pins、set_config('app.editor')(timetable 没挂 trg_audit,刻意)。
--   不动表结构、不动 RLS/grant、不动其他函数。可安全重跑(create or replace)。
--
-- 影响:
--   · 删掉后同事打开「课表制作」看到「尚未存档」;排课表(schedule)完全不受影响。
--   · timetable 每学期只有一行、不留旧版 → 删了数据库里就没有了。
--     每日备份自 2026-11-15 起含 timetable(~/CICBA-backups/backup_all.sh),要找回用 restore_sql.sh <快照夹> timetable。
--
-- 回滚:
--   drop function if exists public.timetable_delete(text, text);
-- ============================================================

create or replace function public.timetable_delete(p_pin text, p_sem text)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text; n integer;
begin
  -- 只有管理员能删(存档是 admin + teacher[Head],删除收紧为 admin)
  select name into ed from public.pins where pin = trim(p_pin) and role = 'admin' limit 1;
  if ed is null then return jsonb_build_object('success', false, 'error', '需要管理员权限'); end if;
  if coalesce(trim(p_sem), '') = '' then return jsonb_build_object('success', false, 'error', '缺学期'); end if;
  perform set_config('app.editor', ed, true);

  delete from public.timetable where sem = trim(p_sem);
  get diagnostics n = row_count;

  return jsonb_build_object('success', true, 'deleted', n, 'deleted_by', ed);
end $function$;

-- 函数 EXECUTE:显式写明(同 009);函数内自己验 PIN,anon 拿不到管理员 PIN 就删不了。
grant execute on function public.timetable_delete(text, text) to anon, authenticated;

-- ============================================================
-- 跑完后自测(把 <PIN> 换掉;第二条用非管理员 PIN 应回「需要管理员权限」):
--   -- select public.timetable_delete('<管理员PIN>', '9999-9');   -- 不存在的学期 → {"success":true,"deleted":0}
--   -- select public.timetable_delete('<Head的PIN>', '2569-2');    -- → {"success":false,"error":"需要管理员权限"}
-- ============================================================
