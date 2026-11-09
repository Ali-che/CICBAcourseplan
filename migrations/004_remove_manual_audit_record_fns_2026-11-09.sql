-- ============================================================
-- 004  清 audit 双写:移除 add_record / update_record / delete_record 的手写旧列审计
-- 跑于:2026-11-09   状态:✅ 已跑(Success)
-- ------------------------------------------------------------
-- 为什么:
--   承 001。schedule / special / exam_special 三表都挂了触发器
--     trg_audit AFTER INSERT OR DELETE OR UPDATE … EXECUTE FUNCTION audit_trg()
--   会写新列(tbl/op/row_id/editor/before/after)。
--   这三个函数又各自手写一行旧列审计(editor/action/target/detail),
--   于是每次排课/IS-SG 编辑写两条:一条新列(真)+ 一条旧列(在编辑记录界面是空行)。
--   2026-11-09 体检(checks/audit_dual_write_inspect.sql):旧列手写行 add 7 / delete 14 / …,
--   新列触发器行 INSERT 9 / UPDATE 162 / DELETE 11 / BASELINE 329。
-- 改了什么:
--   ① 三个函数各删掉一行 `insert into audit_log(editor,action,target,detail) …`。
--   ② 删除人归属:audit_trg 的 DELETE 分支原本取 old.editor(= 该行最后编辑人,不是删的人),
--      过去靠 delete_record 的手写审计记「谁删的」。删掉手写后为免丢失:
--        - delete_record 删前 set_config('app.editor', ed, true)(仅本交易有效)
--        - audit_trg 的 DELETE 分支改取 coalesce(app.editor, old.editor)
--      没设 app.editor 的其他删除路径(如 exam_special)行为不变,仍取 old.editor。
--   其余逻辑与 2026-11-09 线上定义(pg_get_functiondef)一字不差。
--   已存在的旧列行不动(历史保留)。
-- 回滚:
--   把三行 insert 加回去(原文见各函数内注释);audit_trg 的 DELETE 分支改回 (to_jsonb(old)->>'editor')。
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log(tbl,op,row_id,editor,before,after)
    values (tg_table_name,'DELETE',(to_jsonb(old)->>'id'),
            coalesce(nullif(current_setting('app.editor', true),''), (to_jsonb(old)->>'editor')),  -- (004 改)
            to_jsonb(old),null);
    return old;
  else
    insert into public.audit_log(tbl,op,row_id,editor,before,after)
    values (tg_table_name,tg_op,(to_jsonb(new)->>'id'),(to_jsonb(new)->>'editor'),
            case when tg_op='UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
    return new;
  end if;
end $function$;


CREATE OR REPLACE FUNCTION public.add_record(p_pin text, p_type text, p_rec jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ed text; nid text;
begin
  ed := _pin_editor(p_pin);
  if ed is null then return json_build_object('success',false,'error','UNAUTHORIZED — 缺少有效 PIN'); end if;
  nid := coalesce(nullif(p_rec->>'id',''), (extract(epoch from clock_timestamp())*1000)::bigint::text);
  if p_type = 'special' then
    while exists(select 1 from special where id=nid) loop nid := nid||'-'||floor(random()*9000+1000)::text; end loop;
    insert into special(id,student_id,title,name,major,course_code,course_en,class_code,sem,teacher,note,updated_at,editor)
    values(nid,p_rec->>'student_id',p_rec->>'title',p_rec->>'name',p_rec->>'major',p_rec->>'course_code',
           p_rec->>'course_en',p_rec->>'class_code',p_rec->>'sem',p_rec->>'teacher',p_rec->>'note',now(),ed);
  else
    while exists(select 1 from schedule where id=nid) loop nid := nid||'-'||floor(random()*9000+1000)::text; end loop;
    insert into schedule(id,course_code,course_en,sem,half,type,class_code,teacher,cohorts,total,note,btec,updated_at,editor)
    values(nid,p_rec->>'course_code',p_rec->>'course_en',p_rec->>'sem',p_rec->>'half',p_rec->>'type',
           p_rec->>'class_code',p_rec->>'teacher',coalesce(p_rec->'cohorts','[]'::jsonb),
           nullif(p_rec->>'total','')::int,p_rec->>'note',
           coalesce((nullif(p_rec->>'btec',''))::boolean,false),now(),ed);
  end if;
  -- (004 移除) insert into audit_log(editor,action,target,detail) values(ed,'add',p_type,jsonb_build_object('id',nid));
  return json_build_object('success',true,'id',nid);
end; $function$;


CREATE OR REPLACE FUNCTION public.delete_record(p_pin text, p_type text, p_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ed text;
begin
  ed := _pin_editor(p_pin);
  if ed is null then return json_build_object('success',false,'error','UNAUTHORIZED — 缺少有效 PIN'); end if;
  perform set_config('app.editor', ed, true);  -- (004 新增) 让 audit_trg 的 DELETE 记下「谁删的」;true=只在本次交易有效
  if p_type='special' then delete from special where id=p_id; else delete from schedule where id=p_id; end if;
  -- (004 移除) insert into audit_log(editor,action,target,detail) values(ed,'delete',p_type,jsonb_build_object('id',p_id));
  return json_build_object('success',true);
end; $function$;


CREATE OR REPLACE FUNCTION public.update_record(p_pin text, p_type text, p_id text, p_fields jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ed text;
begin
  ed := _pin_editor(p_pin);
  if ed is null then return json_build_object('success',false,'error','UNAUTHORIZED — 缺少有效 PIN'); end if;
  if p_type='special' then
    update special set
      student_id=coalesce(p_fields->>'student_id',student_id), title=coalesce(p_fields->>'title',title),
      name=coalesce(p_fields->>'name',name), major=coalesce(p_fields->>'major',major),
      course_code=coalesce(p_fields->>'course_code',course_code), course_en=coalesce(p_fields->>'course_en',course_en),
      class_code=coalesce(p_fields->>'class_code',class_code), sem=coalesce(p_fields->>'sem',sem),
      teacher=coalesce(p_fields->>'teacher',teacher), note=coalesce(p_fields->>'note',note),
      updated_at=now(), editor=ed
    where id=p_id;
  else
    update schedule set
      course_code=coalesce(p_fields->>'course_code',course_code), course_en=coalesce(p_fields->>'course_en',course_en),
      sem=coalesce(p_fields->>'sem',sem), half=coalesce(p_fields->>'half',half),
      type=coalesce(p_fields->>'type',type), class_code=coalesce(p_fields->>'class_code',class_code),
      teacher=coalesce(p_fields->>'teacher',teacher), cohorts=coalesce(p_fields->'cohorts',cohorts),
      total=coalesce(nullif(p_fields->>'total','')::int,total), note=coalesce(p_fields->>'note',note),
      btec=coalesce((nullif(p_fields->>'btec',''))::boolean,btec), updated_at=now(), editor=ed
    where id=p_id;
  end if;
  if not found then return json_build_object('success',false,'error','找不到 id='||p_id); end if;
  -- (004 移除) insert into audit_log(editor,action,target,detail) values(ed,'update',p_type,jsonb_build_object('id',p_id,'fields',p_fields));
  return json_build_object('success',true);
end; $function$;
