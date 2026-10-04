# 删除 config.js 中已无人读取的 questions 死代码块（按括号配对精确移除）
import io, sys, re

FILES = [
    r'D:\program\无忧占卜\无忧占卜小程序\miniprogram\utils\config.js',
    r'D:\program\无忧占卜\无忧占卜小程序\libs\config.js',
]

for path in FILES:
    lines = io.open(path, encoding='utf-8').read().split('\n')
    out = []
    i = 0
    removed = 0
    while i < len(lines):
        if re.match(r'^\s*questions:\s*\[\s*$', lines[i]):
            depth = 0
            j = i
            end = None
            while j < len(lines):
                depth += lines[j].count('[') - lines[j].count(']')
                if depth == 0:
                    end = j
                    break
                j += 1
            if end is None:
                print('UNBALANCED at', path, i + 1)
                sys.exit(1)
            # questions 为最后一个属性时结尾行没有逗号，需顺带去掉上一行末尾的悬空逗号
            if not lines[end].rstrip().endswith(',') and out:
                out[-1] = out[-1].rstrip().rstrip(',')
            removed += end - i + 1
            i = end + 1
            continue
        out.append(lines[i])
        i += 1
    io.open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
    print('removed', removed, 'lines from', path)
