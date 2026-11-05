-- ============================================================
-- 002  admin_add_cohort 审计改写为新列(让「新增届别」进编辑记录)
-- 跑于:2026-11-05   状态:⏳ 待确认已跑
-- ------------------------------------------------------------
-- 为什么:
--   承 001。admin_add_cohort 的审计原本写旧列(editor/action/target/detail),
--   不会出现在「编辑记录」查看界面(界面只读新列)。
-- 改了什么:
--   只把审计那一行从旧列换成新列(tbl='cohorts', op='INSERT', editor, after=jsonb),
--   其余逻辑与原函数一字不差。新增届别 → 编辑记录显示「届别·新增·代码·专业」。
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_add_cohort(p_pin text, p_dept text, p_cohort text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare ed text; nid bigint;
begin
  ed := _admin(p_pin);
  if ed is null then
    return json_build_object('success',false,'error','需要管理员权限');
  end if;
  if coalesce(trim(p_cohort),'')='' then
    return json_build_object('success',false,'error','届别代码不能为空');
  end if;
  insert into cohorts(dept,cohort) values(trim(p_dept),trim(p_cohort)) returning id into nid;
  -- ★ 审计改写成新列,进编辑记录
  insert into audit_log(tbl,op,editor,after)
    values('cohorts','INSERT',ed,jsonb_build_object('id',nid,'dept',trim(p_dept),'cohort',trim(p_cohort)));
  return json_build_object('success',true,'id',nid);
end;
$function$;
