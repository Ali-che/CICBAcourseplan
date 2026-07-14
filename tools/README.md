# tools/ — 排课系统的开发工具

无第三方依赖,只用系统内建的 `python3` / `git`。

## smoke.py — 冒烟测试(健康检查)

```bash
python3 tools/smoke.py
```

检查:①站点可达且关键标记在 ②参考资料匿名可读且非空 ③安全不变量(学生个资匿名读被拒、匿名写被拒)④关键 RPC 存在且有闸门。全过退出码 0,有失败退出码 1。**建议每次部署后跑一次。**

需要有效 PIN 才能测的(登入后 BTEC 能载入/能存格子、排课能改)属人工项,脚本不测。

## stage.sh — staging 预览环境

在同一个 GitHub Pages repo 多发布一个 `/staging.html`,让你先预览新版、正式站 `/index.html` 的老师不受影响。

**工作流**
1. 改 `index.html`(先别 commit)
2. `./tools/stage.sh` → 发布预览版
3. 看 <https://ali-che.github.io/CICBAcourseplan/staging.html>
4. 满意 → `git commit index.html && git push`(正式上线);不满意 → 继续改再 stage

**注意**
- `staging.html` 是自动产生物,**勿手改**(每次覆盖)。
- staging 与正式**共用同一个 Supabase** → 别在 staging 做删除/大量写入(会动到正式资料);看版面/流程 OK。
- 想**完全隔离**(staging 用独立资料库):另开一个 Supabase 专案、把所有建表/RPC SQL 跑一遍、seed 一份资料,再把 staging 版的 `SUPA_URL`/`SUPA_KEY` 指过去。工比较大,视需要再做。

## 部署验证惯例

- 单文件 `index.html` 直接 `git push` 上 GitHub Pages(约 1 分钟生效,偶尔排队)。
- 验证 = 轮询线上档 URL,连续两次「字节数吻合 + 关键标记在」才算稳定落地。
- 别在 1 小时内狂推空 commit 催部署(Pages 有 build 限流)。
