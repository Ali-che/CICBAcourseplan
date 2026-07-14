#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CIC BA 排课 · 冒烟测试(smoke test)
一支随时能跑的健康检查:站点可达 / 关键读取正常 / 今天补的安全不变量没退化。
用法:  python3 tools/smoke.py
退出码 0=全过,1=有失败。不需要任何第三方套件,也不需要 PIN。
需要登入才能测的(能存 BTEC 格子、能改排课)属人工项,脚本末尾会提示。
"""
import urllib.request, urllib.error, sys, time

SITE = "https://ali-che.github.io/CICBAcourseplan/index.html"
SUPA = "https://ahygebtmavcmzqdwwhbs.supabase.co/rest/v1"
KEY  = "sb_publishable_hWK78P_LTzHgKcuFMI2FVg_44Yw_tsZ"
H    = {"apikey": KEY, "Authorization": "Bearer " + KEY}

results = []
def check(name, ok, detail=""):
    results.append(ok)
    print(("  ✅ " if ok else "  ❌ ") + name + (("  — " + detail) if detail else ""))

def http(method, url, headers=None, body=None):
    hdr = dict(H); hdr.update(headers or {})
    req = urllib.request.Request(url, method=method, headers=hdr,
                                 data=(body.encode() if body else None))
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")
    except Exception as e:
        return -1, str(e)

print("\n=== CIC BA 排课 冒烟测试 ===\n")

# 1) 站点可达 + 关键标记在(改坏/半部署会缺)
print("[1] 站点")
st, html = http("GET", SITE + "?cb=%d" % int(time.time()))
check("index.html HTTP 200", st == 200, "实际 %s" % st)
for marker in ["id=\"panel-btec\"", "id=\"panel-sch\"", "区块目录", "function renderBtec", "function renderSch"]:
    check("含标记 %s" % marker, marker in html)

# 2) 参考资料读取(画面靠这些;空了=画面会开天窗)
print("\n[2] 参考资料读取(匿名应可读且有资料)")
for tbl, q in [("catalog","catalog?select=code&limit=1"),
               ("schedule","schedule?select=id&limit=1"),
               ("semesters","semesters?select=sem&limit=1"),
               ("teachers","teachers?select=name&limit=1"),
               ("btec_unit","btec_unit?select=code&limit=1")]:
    st, body = http("GET", "%s/%s" % (SUPA, q))
    check("%s 可读且非空" % tbl, st == 200 and body.strip().startswith("[{"), "HTTP %s" % st)

# 3) 安全不变量(今天补的洞,防退化)
print("\n[3] 安全不变量(RLS 硬化后应维持)")
st, body = http("GET", "%s/btec_student?select=sid&limit=1" % SUPA)
check("btec_student 匿名读被拒", st in (401,403) or "permission denied" in body, "HTTP %s" % st)
st, body = http("GET", "%s/btec_plan?select=code&limit=1" % SUPA)
check("btec_plan 匿名读被拒", st in (401,403) or "permission denied" in body, "HTTP %s" % st)
# 匿名写(WHERE 匹配零行,不动资料):应被拒
st, _ = http("PATCH", "%s/schedule?id=eq.-999999" % SUPA,
             {"Content-Type":"application/json","Prefer":"return=minimal"}, '{"note":"x"}')
check("匿名写 schedule 被拒(HTTP 401/403)", st in (401,403), "HTTP %s" % st)
st, _ = http("DELETE", "%s/catalog?code=eq.__NOPE__" % SUPA, {"Prefer":"return=minimal"})
check("匿名删 catalog 被拒(HTTP 401/403)", st in (401,403), "HTTP %s" % st)

# 4) 关键 RPC 存在且有闸门(用假 PIN,应回逻辑错误而非 404)
print("\n[4] 关键 RPC 闸门")
st, body = http("POST", "%s/rpc/btec_data" % SUPA, {"Content-Type":"application/json"}, '{"p_pin":"000000-invalid"}')
check("btec_data 存在且挡无效 PIN", st == 200 and "需要登入" in body, "HTTP %s / %s" % (st, body[:40]))
st, body = http("POST", "%s/rpc/authenticate" % SUPA, {"Content-Type":"application/json"}, '{"p_pin":"000000-invalid"}')
check("authenticate 存在(非 404)", st == 200, "HTTP %s" % st)

# 汇总
passed = sum(1 for x in results if x); total = len(results)
print("\n=== 结果:%d/%d 通过 ===" % (passed, total))
print("（人工项:登入后 BTEC 能载入/能存格子、排课能改 —— 这些需要有效 PIN，脚本不测）\n")
sys.exit(0 if passed == total else 1)
