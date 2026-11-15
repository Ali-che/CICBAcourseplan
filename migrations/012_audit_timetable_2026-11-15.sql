-- ============================================================
-- 012  课表制作进编辑记录（timetable 存档 + 教室库 rooms + 课表日期 tt_sem_dates）
-- 写于:2026-11-15   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- 依赖:009(timetable)、008(rooms)、010/011(tt_sem_dates) 都已跑(线上已实证存在)。
-- ------------------------------------------------------------
-- 为什么:
--   009/010/011 当时「刻意不挂 trg_audit」,把课表布局当流程状态。但「课表制作」的存档、
--   教室库增删改、课表日期设定,都是对系统资料的实际改动,Aj. Tsai 要求进「编辑记录」
--   (延续 006「编辑记录覆盖全部后台资料」的方向)。目前这三项改了都查不到谁、何时改的。
--
-- 改了什么:
--   ① timetable_save —— 存档成功后,顺手往 audit_log 写一条「新列」审计(tbl='timetable')。
--        · 只记摘要 after={sem,version,placed(落位门数)};**不**直接挂 trg_audit——
--          placements 是整包落位 jsonb,很大,塞进 before/after 没意义也难看。
--        · 首次存档(该学期本来没有)记为 INSERT;覆盖记为 UPDATE,before={旧 version, 旧门数}。
--        · 其余逻辑(权限 = Head[teacher]+admin、回传值)与 009 一字不差。
--   ② rooms、tt_sem_dates 挂 trg_audit(通用触发器,同 006 那 21 张表)。
--        · 这两张表小,通用触发器刚好;它们的写入 RPC(admin_upsert_room/admin_del_room/
--          tt_set_sem_dates)本来就调 _admin() 或自设 app.editor,所以修改人会正确带出。
--        · 主键是 code/sem 不是 id,触发器里 row_id 会是 null——无妨,界面不靠 row_id 显示。
--
-- 权限/安全:
--   - 不新增任何写权限;audit 写入都在 SECURITY DEFINER 函数/触发器内。
--   - timetable/rooms/tt_sem_dates 仍 RLS 关、anon 只读,体检照旧列为「RLS 关但不可写」基线。
--   - audit_log 本身不挂触发器(同 006),不会递归。
--
-- 前端配套(index.html,已随本次一起改):
--   _AUD_TBLS 新增「课表制作」分组三项:timetable(课表存档)/rooms(教室库)/tt_sem_dates(课表日期);
--   FN 补字段中文名(门数/容量/优先专业/上下半开始结束)。
--
-- 注:009/010 已发生的既有存档(如 2569-2 v1/v2)在本 migration 之前没有审计,不会追溯补记;
--     本次之后的每一次存档/教室/日期改动才会进编辑记录。
--
-- 回滚:
--   drop trigger if exists trg_audit on public.rooms;
--   drop trigger if exists trg_audit on public.tt_sem_dates;
--   -- timetable_save 回 009 版(移除下方「-- 编辑记录(012)」那段 insert 即可)。
-- ============================================================

-- ① timetable_save 加审计(重定义;其余与 009 相同)--------------------------
create or replace function public.timetable_save(p_pin text, p_sem text, p_placements jsonb)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text; v integer; old_ver integer; old_n integer; new_n integer;
begin
  -- 能存:Head of Administration(role=teacher) 与 admin;director/pic/其余不可(设计 §2)
  select name into ed from public.pins where pin = trim(p_pin) and role in ('admin', 'teacher') limit 1;
  if ed is null then return jsonb_build_object('success', false, 'error', '需要 Head of Administration 或管理员权限'); end if;
  if coalesce(trim(p_sem), '') = '' then return jsonb_build_object('success', false, 'error', '缺学期'); end if;
  perform set_config('app.editor', ed, true);

  -- 存档前的旧版本/旧门数(没有则为 null = 首次存档)
  select version,
         case when jsonb_typeof(placements) = 'array' then jsonb_array_length(placements) else 0 end
    into old_ver, old_n
    from public.timetable where sem = trim(p_sem);

  new_n := case when jsonb_typeof(coalesce(p_placements, '[]'::jsonb)) = 'array'
                then jsonb_array_length(coalesce(p_placements, '[]'::jsonb)) else 0 end;

  insert into public.timetable(sem, placements, version, saved_by, saved_at)
    values(trim(p_sem), coalesce(p_placements, '[]'::jsonb), 1, ed, now())
    on conflict(sem) do update set
      placements = excluded.placements,
      version    = public.timetable.version + 1,
      saved_by   = ed,
      saved_at   = now()
    returning version into v;

  -- 编辑记录(012):只记摘要,不塞整包 placements
  insert into public.audit_log(tbl, op, row_id, editor, before, after)
  values('timetable',
         case when old_ver is null then 'INSERT' else 'UPDATE' end,
         trim(p_sem), ed,
         case when old_ver is null then null
              else jsonb_build_object('sem', trim(p_sem), 'version', old_ver, 'placed', old_n) end,
         jsonb_build_object('sem', trim(p_sem), 'version', v, 'placed', new_n));

  return jsonb_build_object('success', true, 'version', v, 'saved_by', ed);
end $function$;

grant execute on function public.timetable_save(text, text, jsonb) to anon, authenticated;

-- ② rooms、tt_sem_dates 挂通用审计触发器 -----------------------------------
do $$
declare t text;
begin
  foreach t in array array['rooms', 'tt_sem_dates']
  loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function public.audit_trg()', t);
  end loop;
end $$;

-- ============================================================
-- 跑完后自检(可选,贴 SQL Editor):
--   -- 用 Head(teacher) 或 admin 的 PIN 存一次某学期课表,然后:
--   select at, tbl, op, editor, before, after
--     from public.audit_log where tbl = 'timetable' order by at desc limit 5;   -- 应看到刚存的那笔
--   -- 后台改一间教室容量,然后:
--   select at, tbl, op, editor, before, after
--     from public.audit_log where tbl in ('rooms','tt_sem_dates') order by at desc limit 5;
--   -- 触发器已挂上:
--   select tgrelid::regclass as tbl, tgname from pg_trigger
--     where tgname = 'trg_audit' and tgrelid::regclass::text in ('rooms','tt_sem_dates');
-- ============================================================
