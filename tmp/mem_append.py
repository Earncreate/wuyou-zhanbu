import os
d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.workbuddy', 'memory')
os.makedirs(d, exist_ok=True)
p = os.path.join(d, '2026-10-02.md')
note = '''
## 按方法1+2+3优化词表 + 臃肿分析（2026-10-02 上午·续）
- 用户要求：按上轮建议(方法1+2+3)落地优化并再测；另问"第一次通用测试是否提示词太臃肿(因把规则也写进去了)"。
- 臃肿分析结论：第一次通用模块确实偏臃肿，两层原因——①XIANG '*' 那条"六亲传统类象(根)"把父母/官鬼/妻财/子孙/兄弟全部语义铺开(超长)，对"问病"等具体问题妻财=妻妾/钱财是噪声；②通用模块无领域聚焦主干、全靠自由取用，反而比专属模块虚胖无方向；③STAGE2_RULES通用输出规则也进通用模块(占字数但属合理)。
- 落地 symbol_dict.js：①新增 MOD_RULE(模块章法主干,按modId必注入,不依赖用神是否上卦,覆盖 general/loveM/loveF/wealth/career/illness,解"用神伏藏塌通用")；②新增伏神取用 LOCAL(when useMissing,飞伏关系+出伏条件)；③新增 stage1Anchor(供Stage1注入用神倾向,不含实况)；④selectSymbols 注入【模块章法】段+伏藏提示；⑤精简 XIANG '*' 超长六亲根为"六亲取象边界总则"降噪；⑥buildSignals 暴露 useMissing。
- config.js buildStage1Messages 注入 SYM.stage1Anchor；prompts.js 规则1 放宽("日月力量分数须采信,用神取向以章法主干为准,冲突以章法主干+关系清单为准") + STAGE1_RULES 加第7条(用神取向与伏神取用)。
- 同步 miniprogram/utils(symbol_dict+config+prompts)；node --check 双端通过。
- 预演 tmp/test_optimize_preview.js 验证：H1水火既济 loveM 与 general 不再逐字相同(塌通用已解)、loveM含"男问感情章法"+伏藏提示；通用模块注入 1251/1242/1183/1215(基线1116/1057/1089/1125,微增因加了聚焦章法主干,但噪声降信噪比升)。
- 真LLM重测：用户旧DeepSeek key已建议轮换,给命令 WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=<新key> node tmp/test_8cases_real.js 或本地跑后回传 real_outputs.json。未用旧key再发请求(安全+尊重轮换)。
'''
with open(p, 'a', encoding='utf-8') as f:
    f.write(note)
print('appended, size', len(open(p, encoding='utf-8').read()))
