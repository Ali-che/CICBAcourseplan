-- ============================================================
-- 003  老师离职存档(soft-archive)
-- 跑于:2026-11-05   状态:⏳ 待确认已跑
-- ------------------------------------------------------------
-- 为什么:
--   老师离职不该硬删(会让历史排课变孤儿、员工号记录消失)。
--   改成「标记离职 + 存档」:从新增排课选单与在职名单隐藏,历史照旧,可复职。
-- 改了什么:
--   A) teachers 加 resigned 栏(默认 false=在职)。
--   B) admin_set_teacher_resigned(p_pin,p_name,p_resigned):仅管理员,切换离职/复职,
--      并写进编辑记录(新列 tbl='teachers')。
--   admin_add_teacher 的 upsert 不含 resigned,故编辑老师资料不会动到离职状态。
-- 前端配合:老师库 离职/复职按钮+徽标+「显示离职」筛选;排课老师选单排除离职;
--           编辑记录渲染「老师」类型。
-- ============================================================

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS resigned boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_set_teacher_resigned(p_pin text, p_name text, p_resigned boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare ed text;
begin
  ed := _admin(p_pin);
  if ed is null then
    return json_build_object('success',false,'error','需要管理员权限');
  end if;
  update teachers set resigned = coalesce(p_resigned,false) where name = p_name;
  if not found then
    return json_build_object('success',false,'error','找不到老师:'||coalesce(p_name,''));
  end if;
  insert into audit_log(tbl,op,editor,after)
    values('teachers','UPDATE',ed,
           jsonb_build_object('name',p_name,'resigned',coalesce(p_resigned,false)));
  return json_build_object('success',true);
end;
$function$;
