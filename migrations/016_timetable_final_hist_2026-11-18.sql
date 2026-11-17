-- ============================================================
-- 016  课表制作:草稿／定版 + 保留最近 5 个旧版
-- 日期:2026-11-18      依赖:009(timetable)、012/014(timetable_save 写编辑记录)、013(timetable_delete)
--
-- 为什么:
--   课表存档每学期只有一份,秘书处排到一半存档,主任看到的就是半成品,分不出「还在排」还是「排好了」。
--   存档又会盖掉上一版,存错只能靠每天的备份救。Aj. Tsai 2026-11-18 定:
--     · 存档 = 草稿;按「定版」才是正式版;定版后再存档 → 自动变回草稿,要重新定版。
--     · 每次存档(或删除存档)前,把被盖掉的那一版留下来,每学期留最近 5 个。
--
-- 改什么:
--   ① timetable 加三栏:final_version / final_by / final_at。
--        「已定版」= final_version = version。存档会让 version+1 → 自然变回草稿,所以 timetable_save 完全不用改。
--   ② 新表 timetable_hist(旧版)+ 两个触发器:timetable 的 placements 被改、或整行被删之前,把旧的那一行抄进去,
--        每学期只留最近 5 笔。触发器做,所以 timetable_save / timetable_delete 都不用改。
--   ③ 新 RPC timetable_finalize(p_pin, p_sem, p_on):定版／取消定版。能按的人 = 能存档的人(admin + Head[role=teacher])。
--        顺手写一笔编辑记录(after 带 final;where 照抄上一笔,这样下一次存档的「挪动/排入/移出」差异不会断)。
--
-- 不动:timetable_save、timetable_delete、其他表与函数。可安全重跑(if not exists / create or replace / drop trigger if exists)。
--
-- 权限:timetable_hist 跟 timetable 一样——不开 RLS、anon 只能读、写只能经触发器(security definer)。
--       旧版内容跟现行课表同性质(课码、老师、教室、时段),没有学生个资、没有 PIN。
--       下次安全体检会把 timetable_hist 列为「RLS 关但不可写」,属预期。刻意不挂 trg_audit(它本身就是历史)。
--
-- 没跑之前:前端照旧运作(不显示草稿／定版、没有「旧版」清单);按「定版」会提示来跑这支。
--
-- 回滚:
--   drop function if exists public.timetable_finalize(text, text, boolean);
--   drop trigger if exists trg_timetable_hist_upd on public.timetable;
--   drop trigger if exists trg_timetable_hist_del on public.timetable;
--   drop function if exists public.timetable_keep_hist();
--   drop table if exists public.timetable_hist;
--   alter table public.timetable drop column if exists final_version, drop column if exists final_by, drop column if exists final_at;
--   notify pgrst, 'reload schema';
-- ============================================================

-- ① 定版栏位 -----------------------------------------------------------
alter table public.timetable
  add column if not exists final_version integer,
  add column if not exists final_by      text,
  add column if not exists final_at      timestamptz;

-- ② 旧版表 -------------------------------------------------------------
create table if not exists public.timetable_hist(
  id          bigserial   primary key,
  sem         text        not null,
  version     integer,
  placements  jsonb       not null default '[]'::jsonb,
  saved_by    text,
  saved_at    timestamptz,
  was_final   boolean     not null default false,   -- 被盖掉当时是不是定版
  archived_at timestamptz not null default now()    -- 什么时候被盖掉(或被删)的
);
create index if not exists timetable_hist_sem_idx on public.timetable_hist(sem, archived_at desc);

revoke all on public.timetable_hist from anon, authenticated;
grant select on public.timetable_hist to anon, authenticated;

create or replace function public.timetable_keep_hist()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.timetable_hist(sem, version, placements, saved_by, saved_at, was_final)
  values(old.sem, old.version, old.placements, old.saved_by, old.saved_at,
         old.final_version is not null and old.final_version = old.version);
  -- 每学期只留最近 5 笔
  delete from public.timetable_hist h
   where h.sem = old.sem
     and h.id not in (select id from public.timetable_hist
                       where sem = old.sem
                       order by archived_at desc, id desc
                       limit 5);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

drop trigger if exists trg_timetable_hist_upd on public.timetable;
create trigger trg_timetable_hist_upd
  before update on public.timetable
  for each row
  when (old.placements is distinct from new.placements)   -- 只有内容变了才留旧版(按「定版」只改 final_* 不算)
  execute function public.timetable_keep_hist();

drop trigger if exists trg_timetable_hist_del on public.timetable;
create trigger trg_timetable_hist_del
  before delete on public.timetable
  for each row
  execute function public.timetable_keep_hist();

-- ③ 定版／取消定版 -------------------------------------------------------
create or replace function public.timetable_finalize(p_pin text, p_sem text, p_on boolean default true)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare ed text; v integer; was boolean; n integer; last_where jsonb; ts timestamptz := now();
begin
  -- 能定版 = 能存档:Head of Administration(role=teacher) 与 admin
  select name into ed from public.pins where pin = trim(p_pin) and role in ('admin', 'teacher') limit 1;
  if ed is null then return jsonb_build_object('success', false, 'error', '需要 Head of Administration 或管理员权限'); end if;
  if coalesce(trim(p_sem), '') = '' then return jsonb_build_object('success', false, 'error', '缺学期'); end if;
  perform set_config('app.editor', ed, true);

  select version,
         (final_version is not null and final_version = version),
         case when jsonb_typeof(placements) = 'array' then jsonb_array_length(placements) else 0 end
    into v, was, n
    from public.timetable where sem = trim(p_sem);
  if v is null then return jsonb_build_object('success', false, 'error', '这个学期还没有存档,不能定版'); end if;

  update public.timetable set
      final_version = case when coalesce(p_on, true) then version else null end,
      final_by      = case when coalesce(p_on, true) then ed      else null end,
      final_at      = case when coalesce(p_on, true) then ts      else null end
    where sem = trim(p_sem);

  -- 编辑记录:where 照抄上一笔(下一次存档要拿它算差异,不能断)
  select after -> 'where' into last_where
    from public.audit_log
    where tbl = 'timetable' and row_id = trim(p_sem)
    order by at desc limit 1;

  insert into public.audit_log(tbl, op, row_id, editor, before, after)
  values('timetable', 'UPDATE', trim(p_sem), ed,
         jsonb_build_object('sem', trim(p_sem), 'version', v, 'placed', n, 'final', coalesce(was, false),
                            'where', coalesce(last_where, '{}'::jsonb)),
         jsonb_build_object('sem', trim(p_sem), 'version', v, 'placed', n, 'final', coalesce(p_on, true),
                            'where', coalesce(last_where, '{}'::jsonb)));

  return jsonb_build_object('success', true, 'version', v, 'final', coalesce(p_on, true),
                            'final_by', case when coalesce(p_on, true) then ed else null end,
                            'final_at', case when coalesce(p_on, true) then ts else null end);
end $function$;

grant execute on function public.timetable_finalize(text, text, boolean) to anon, authenticated;

-- 让 PostgREST 立刻认得新栏位、新表、新函数 ------------------------------
notify pgrst, 'reload schema';

-- ============================================================
-- 跑完后自检(可选,都是只读):
--   -- 三栏在不在
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='timetable' and column_name like 'final%';
--   -- 现在各学期是草稿还是定版
--   select sem, version, final_version, (final_version = version) as 已定版, final_by, final_at from public.timetable order by sem;
--   -- 外人写不了旧版表(应该只有 SELECT)
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema='public' and table_name='timetable_hist' and grantee in ('anon','authenticated');
--   -- 存过一次档之后,旧版有没有留下来
--   select sem, version, saved_by, saved_at, was_final, archived_at from public.timetable_hist order by archived_at desc limit 10;
-- ============================================================
