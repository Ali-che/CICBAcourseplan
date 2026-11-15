-- ============================================================
-- 014  课表存档审计「记内容」：存一份落位摘要 where，编辑记录能看出「哪门课挪到哪」
-- 写于:2026-11-15   状态:⏳ 待跑(请 Aj. Tsai 在 Supabase SQL Editor 执行)
-- 依赖:012 已跑(本档重定义 012 的 timetable_save)。
-- ------------------------------------------------------------
-- 为什么:
--   012 的审计只记 {sem,version,placed},编辑记录只能显示「版本 2→3 · N 门」——
--   Aj. Tsai 反映「到底改了什么内容都不知道」。本档让存档时**多带一份落位摘要** where
--   (每门课 → 「上下半 · 教室 · 周几时段」的短字串),审计据此能列出这次「挪动/排入/移出」了哪些课。
--
-- 改了什么(只动 timetable_save,rooms/tt_sem_dates 的触发器维持 012 不变):
--   · 函数签名加第 4 个参数 p_where jsonb(前端把落位摘要算好传进来;给预设 '{}' 兼容旧前端)。
--     Postgres 加参数=新签名,故**先 drop 掉 012 的三参版**,再建四参版,避免两个重载并存。
--   · after 多存 where = p_where;before 的 where 取「上一笔 timetable 审计的 after->where」
--     (不必前端再送旧资料,就能做 旧→新 的差异)。其余(权限、version 累加、回传)与 012 一字不差。
--   · placed 仍记门数;where 的 key 数≈placed。一笔约 2–4KB,存档不频繁,audit_log 可接受。
--
-- 过渡期:012 之后、013 之前存的那几笔(如 2569-2 的 v3)没有 where → 之后第一次用 013 存同一学期时,
--   before.where 会是空,前端显示「本次起记录落位内容」而非把每门都当「新排入」。再往后就是正常 旧→新 差异。
--
-- 前端配套(index.html,随本次一起改):ttSave 用 _ttWhereMap(sol.placements) 算 where 传入;
--   编辑记录 detailOf 针对 tbl='timetable' 画「挪动 X;＋排入 Y;－移出 Z」。
--
-- 回滚:
--   drop function if exists public.timetable_save(text, text, jsonb, jsonb);
--   -- 再把 012 的三参版贴回来即可。
-- ============================================================

-- 先移除 012 的三参版,避免重载并存 -----------------------------------------
drop function if exists public.timetable_save(text, text, jsonb);

-- 四参版:多带 p_where,审计 after/before 记落位摘要 --------------------------
create or replace function public.timetable_save(p_pin text, p_sem text, p_placements jsonb, p_where jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text; v integer; old_ver integer; old_n integer; new_n integer; old_where jsonb;
begin
  -- 能存:Head of Administration(role=teacher) 与 admin;director/pic/其余不可(设计 §2)
  select name into ed from public.pins where pin = trim(p_pin) and role in ('admin', 'teacher') limit 1;
  if ed is null then return jsonb_build_object('success', false, 'error', '需要 Head of Administration 或管理员权限'); end if;
  if coalesce(trim(p_sem), '') = '' then return jsonb_build_object('success', false, 'error', '缺学期'); end if;
  perform set_config('app.editor', ed, true);

  -- 旧版本/旧门数(没有则 null = 首次存档)
  select version,
         case when jsonb_typeof(placements) = 'array' then jsonb_array_length(placements) else 0 end
    into old_ver, old_n
    from public.timetable where sem = trim(p_sem);

  -- 旧落位摘要:取上一笔同学期 timetable 审计的 after->where(做 旧→新 差异)
  select after -> 'where' into old_where
    from public.audit_log
    where tbl = 'timetable' and row_id = trim(p_sem)
    order by at desc limit 1;

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

  -- 编辑记录(014):摘要 + 落位内容 where(不塞整包 placements)
  insert into public.audit_log(tbl, op, row_id, editor, before, after)
  values('timetable',
         case when old_ver is null then 'INSERT' else 'UPDATE' end,
         trim(p_sem), ed,
         case when old_ver is null then null
              else jsonb_build_object('sem', trim(p_sem), 'version', old_ver, 'placed', old_n,
                                      'where', coalesce(old_where, '{}'::jsonb)) end,
         jsonb_build_object('sem', trim(p_sem), 'version', v, 'placed', new_n,
                            'where', coalesce(p_where, '{}'::jsonb)));

  return jsonb_build_object('success', true, 'version', v, 'saved_by', ed);
end $function$;

grant execute on function public.timetable_save(text, text, jsonb, jsonb) to anon, authenticated;

-- 让 PostgREST 立刻认得新签名(Supabase 通常会自动 reload,保险起见补一发)-----------
notify pgrst, 'reload schema';

-- ============================================================
-- 跑完后自检(可选):
--   -- 用 Head/admin PIN 存一次某学期课表,然后看最新一笔的 after->where 有没有东西:
--   select at, op, editor, after -> 'version' as v, after -> 'placed' as n,
--          jsonb_object_keys(after -> 'where') as 一门课
--     from public.audit_log where tbl = 'timetable' order by at desc limit 10;
--   -- 若前端报「找不到 timetable_save 的 p_where 参数」→ 再手动跑一次:  notify pgrst, 'reload schema';
-- ============================================================
