#!/usr/bin/env bash
# 从 index.html 产生 staging 预览版并发布到  /staging.html
#
# 工作流:
#   1) 改 index.html（先别 commit / 别 push）
#   2) ./tools/stage.sh          → 发布预览版
#   3) 看 https://ali-che.github.io/CICBAcourseplan/staging.html
#   4) 满意 → git commit index.html && git push   （正式站上线)
#      不满意 → 继续改,再 ./tools/stage.sh
#
# 注意:staging.html 是「自动产生物」,请勿手改(每次会被覆盖)。
#       staging 与正式共用同一个 Supabase → 勿在 staging 做删除/大量写入测试。
#       (要完全隔离,需另开一个 Supabase 专案;见 tools/README.md)
set -e
cd "$(dirname "$0")/.."

python3 - <<'PY'
src=open("index.html",encoding="utf-8").read()
banner=('<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#b45309;color:#fff;'
        'text-align:center;font:600 12px/1.7 system-ui;padding:3px 8px">'
        '🚧 STAGING 预览版 · 非正式站 · 数据与正式共用,勿删除/大量写入</div>'
        '<style>body{padding-top:26px !important}</style>')
marker="<!-- STAGING-BUILD:自动产生,勿手改,来源 tools/stage.sh -->"
if "<body>" not in src:
    raise SystemExit("找不到 <body>,中止")
out=src.replace("<body>","<body>"+marker+banner,1)
open("staging.html","w",encoding="utf-8").write(out)
print("staging.html 已生成 (%d bytes)"%len(out))
PY

git add staging.html
if git diff --cached --quiet; then echo "staging.html 无变更,不需发布"; exit 0; fi
git commit -q -m "staging: 更新预览版(tools/stage.sh 自动产生)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push -q
echo "✅ 已发布 → https://ali-che.github.io/CICBAcourseplan/staging.html"
