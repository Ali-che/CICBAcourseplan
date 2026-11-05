# 基线快照怎么做(000_baseline)

基线 = 某一天数据库的**完整现状**,之后所有变更都以它为起点。
做一次就好;等你有空照下面做,把结果给我,我帮你存成 `000_baseline_2026-11-05.sql`。

## 步骤

到 Supabase → SQL Editor,**清空后贴这一条**,跑完把结果(会是一大段文字)复制给我:

```sql
-- 导出 public 下所有函数(RPC)的完整定义 = 业务逻辑的全部
SELECT string_agg(
         pg_get_functiondef(oid),
         E'\n\n-- ========================================\n\n'
         ORDER BY proname
       ) AS 全部函数定义
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace;
```

- 出来是**一个大格子**,里面是所有函数的 SQL。点那个格子 → 全选复制 → 贴给我即可。
- 表的结构(栏位)不用你导;Supabase 的 Table Editor 本来就看得到,需要时我再单独抓。

## 说明

- 这一步**纯只读**,不会改任何东西,放心跑。
- 做完后,这份基线就定住了;以后每次改动都是新编号的档(001、002…),一路叠上去。
