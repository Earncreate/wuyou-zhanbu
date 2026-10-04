"""应验反馈：等级定义与统计口径。

等级（数字越大越准）：
    1 未应验   断语与事实相反
    2 大致应验 方向沾边，细节不符
    3 基本应验 主要说中，细节有出入
    4 完全应验 说的就是后来发生的
    5 未到应期 事情还没到兑现的时候（不计入应验率分母）

口径（前后端必须一致，前端 JS 里有一份等价定义）：
    已反馈 = level in 1..5
    有结论 = level in 1..4（排除了「未到应期」，它不代表准不准）
    应验率 = (2+3+4) / 有结论数
    加权准头 = (2*0.5 + 3*0.75 + 4*1.0) / 有结论数 —— 只用于展示，别拿它下结论
"""

# level -> 中文名（前端按钮文案也用这套，改这里要同步 index.html 的 FB_LEVELS）
LEVEL_NAMES = {
    0: "未反馈",
    1: "未应验",
    2: "大致应验",
    3: "基本应验",
    4: "完全应验",
    5: "未到应期",
}

VALID_LEVELS = (0, 1, 2, 3, 4, 5)
CONCLUSIVE = (1, 2, 3, 4)      # 计入应验率分母
POSITIVE = (2, 3, 4)           # 计入分子
WEIGHT = {1: 0.0, 2: 0.5, 3: 0.75, 4: 1.0}


def extract(payload):
    """从记录的 payload 里取出规范化的反馈，返回 (level, at, note)。payload 里没有则返回 (0,0,'')。"""
    if not isinstance(payload, dict):
        return 0, 0, ""
    fb = payload.get("feedback")
    if isinstance(fb, dict):
        lv = fb.get("level")
        try:
            lv = int(lv)
        except (TypeError, ValueError):
            lv = 0
        if lv not in VALID_LEVELS:
            lv = 0
        try:
            at = int(fb.get("at") or 0)
        except (TypeError, ValueError):
            at = 0
        note = str(fb.get("note") or "")[:2000]
        return lv, at, note
    # 兼容早期把等级直接写成字符串的存法
    if isinstance(fb, str):
        for lv, name in LEVEL_NAMES.items():
            if lv and name == fb:
                return lv, 0, ""
    return 0, 0, ""


def summarize(levels):
    """给一组 level 算统计。levels 是可迭代的 int。"""
    dist = {str(lv): 0 for lv in VALID_LEVELS}
    conclusive = 0
    positive = 0
    weighted = 0.0
    for lv in levels:
        try:
            lv = int(lv or 0)
        except (TypeError, ValueError):
            lv = 0
        key = str(lv)
        if key in dist:            # dist 的键是字符串，别拿 int 直接查，否则全 0 还看不出来
            dist[key] += 1
        if lv in CONCLUSIVE:
            conclusive += 1
            weighted += WEIGHT.get(lv, 0.0)
            if lv in POSITIVE:
                positive += 1
    return {
        "feedbackCount": sum(dist[str(lv)] for lv in VALID_LEVELS if lv),
        "conclusive": conclusive,
        "positive": positive,
        "dist": dist,
        "rate": round(positive / conclusive * 100, 1) if conclusive else 0.0,
        "weighted": round(weighted / conclusive * 100, 1) if conclusive else 0.0,
    }
