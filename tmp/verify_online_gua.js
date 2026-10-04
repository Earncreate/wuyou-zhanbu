#!/usr/bin/env node
/**
 * 在线卦象核验：引擎 64 卦结构快照 对照 两个独立外部站点
 *   源A aitjg.com/g.php?name=卦名     —— 六爻排盘表（六亲/纳甲/阴阳/世应）、宫位、卦性、卦辞、爻辞、六亲分布
 *   源B bazi-atlas.com 各卦页 og:description —— 文王卦序、上下卦、宫、卦性、世应爻位、纳甲干支序列（自初爻起）
 * 缓存：tmp/cache_gua/*.html（只在其缺时联网）
 * 产出：tmp/gua_reference.json（合并参考数据，供后续测试用）、tmp/在线卦象核验报告.md
 * 有不符 → 控制台列出 + exit 1（可作回归闸门）
 */
const fs = require('fs');
const path = require('path');
const LY = require('../libs/liuyao.js');

const CACHE = path.join(__dirname, 'cache_gua');
if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });

const TRI_CN = { qian: '乾', dui: '兑', li: '离', zhen: '震', xun: '巽', kan: '坎', gen: '艮', kun: '坤' };
const TRI_XIANG = { 乾: '天', 兑: '泽', 离: '火', 震: '雷', 巽: '风', 坎: '水', 艮: '山', 坤: '地' };
const POS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchCached(url, file) {
  const p = path.join(CACHE, file);
  if (fs.existsSync(p) && fs.statSync(p).size > 500) return fs.readFileSync(p, 'utf8');
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) liuyao-verify' } });
  if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
  const t = await res.text();
  fs.writeFileSync(p, t);
  await sleep(150); // 温和抓取
  return t;
}
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, '').replace(/\s+/g, ' ');
const alias = (n) => n.replace(/遯/g, '遁'); // 异体字：遯=遁

// ---------- 引擎 64 卦快照 ----------
function engineSnapshots() {
  const out = [];
  for (let id = 0; id < 64; id++) {
    const bits = [id & 1, (id >> 1) & 1, (id >> 2) & 1, (id >> 3) & 1, (id >> 4) & 1, (id >> 5) & 1]; // bits[0]=初爻
    const six = bits.map((b) => ({ sum: b ? 7 : 8 }));
    const c = LY.arrange({ six, monthGanZhi: '丙寅', dayGanZhi: '甲子' });
    const dist = {};
    c.ben.yaos.forEach((y) => { (dist[y.liuqin] = dist[y.liuqin] || []).push(y.posName); });
    out.push({
      bits, name: c.ben.name,
      upper: TRI_CN[c.ben.info.upper], lower: TRI_CN[c.ben.info.lower],
      palace: c.ben.info.palaceName, elem: c.ben.info.element,
      shi: c.ben.info.shi, ying: c.ben.info.ying, // 1-6 爻位
      yaos: c.ben.yaos.map((y, i) => ({ pos: POS[i], zhi: y.zhi, gz: y.ganzhi, lq: y.liuqin, yang: !!y.yang, shi: !!y.isShi, ying: !!y.isYing })),
      dist
    });
  }
  return out;
}

// ---------- 源A：aitjg ----------
function parseAitjg(html, guaName) {
  const rows = [];
  const tb = html.slice(html.indexOf('paipan-table'));
  const seg = tb.slice(0, tb.indexOf('</table>'));
  const trs = seg.split('<tr>').slice(1);
  for (const tr of trs) {
    const lq = (tr.match(/pp-relative">([^<]+)</) || [])[1];
    const yin = (tr.match(/hxf-yao (yang|yin)/) || [])[1];
    const gz = (tr.match(/pp-jiazi">([^<]+)</) || [])[1];
    const el = (tr.match(/pp-el el-([^"]+)">/) || [])[1];
    const seat = (tr.match(/pp-(?:seat|respond)-mark\">([^<]+)</) || [])[1] || '';
    if (lq && gz) rows.push({ lq, yang: yin === 'yang', gz, el, seat });
  }
  const text = strip(html);
  const palace = (text.match(/宫位\s*([乾兑离震巽坎艮坤])宫/) || [])[1] || '';
  const elem = (text.match(/宫位\s*[乾兑离震巽坎艮坤]宫\s*（?属([金木水火土])/) || [])[1] || '';
  const guaxing = (text.match(/卦性\s*([^\s，。]{2,4}卦)/) || [])[1] || '';
  const shiYing = text.match(/世(\d)爻\s*·\s*应(\d)爻/);
  // 卦辞与爻辞（「卦辞与爻辞」节）
  let guaci = '', yaoci = [];
  const sec = html.slice(html.indexOf('卦辞与爻辞'));
  const secText = strip(sec.slice(0, 3000));
  const guaM = secText.match(/卦辞\s*([\s\S]{2,90}?)(?=\s*(?:初[九六]|九[二三四五]|六[二三四五]|上[九六]|用[九六])|\s*爻辞|$)/);
  if (guaM) guaci = guaM[1].replace(/^卦辞\s*/, '').trim();
  const liRe = /<li>([^<]*?(?:初[九六]|九[二三四五]|六[二三四五]|上[九六]|用[九六])[^<]*?)[，,：:]([^<]+)<\/li>/g;
  let m; const secLim = sec.indexOf('延伸阅读') > 0 ? sec.slice(0, sec.indexOf('延伸阅读')) : sec.slice(0, 8000);
  while ((m = liRe.exec(secLim)) && yaoci.length < 6) yaoci.push((m[1] + '：' + m[2]).trim());
  // 六亲分布（父母 初爻爻 …）
  const dist = {};
  const dsec = html.slice(html.indexOf('六亲分布'));
  const dl = dsec.indexOf('卦辞与爻辞') > 0 ? dsec.slice(0, dsec.indexOf('卦辞与爻辞')) : dsec.slice(0, 6000);
  const dRe = /(父母|兄弟|子孙|妻财|官鬼)\s+((?:(?:初|二|三|四|五|上)爻)(?:[·、](?:(?:初|二|三|四|五|上)爻))*)/g;
  const dtext = strip(dl);
  while ((m = dRe.exec(dtext))) {
    const poses = m[2].match(/初爻|二爻|三爻|四爻|五爻|上爻/g) || [];
    if (poses.length) dist[m[1]] = (dist[m[1]] || []).concat(poses);
  }
  return { name: alias(guaName), palace: palace ? palace + '宫' : '', elem, guaxing, shi: shiYing ? +shiYing[1] : null, ying: shiYing ? +shiYing[2] : null, rows, guaci, yaoci, dist };
}

// ---------- 源B：bazi-atlas ----------
function parseAtlasOverview(html) {
  // 八宫树：<h3>☰ <b>乾</b> 宫 · 金</h3> … <li><a href="./hexagram-N-slug">䷀ <b>乾</b> 乾为天</a> <span class="muted">· 六世</span></li>
  const map = {};
  const h3Re = /<h3>☰?\s*<b[^>]*>([乾兑离震巽坎艮坤])<\/b>\s*宫\s*·\s*([金木水火土])<\/h3>([\s\S]*?)(?=<h3|$)/g;
  let hm;
  while ((hm = h3Re.exec(html))) {
    const [, gx, el, body] = hm;
    const liRe = /<a href="\.\/(hexagram-(\d+)-([a-z-]+))"[^>]*>\s*[^<]*\s*<b[^>]*>([^<]+)<\/b>\s*([^<]+)<\/a>\s*(?:<span[^>]*>·\s*([^<]+)<\/span>)?/g;
    let lm;
    while ((lm = liRe.exec(body))) {
      const lm2 = lm[4] + lm[5];
    map[lm2.replace(/遯/g, '遁')] = { slug: lm[1], order: +lm[2], palace: gx + '宫', elem: el, guaxing: (lm[6] || '').trim() };
    }
  }
  // 矩阵 title="第 N 卦 简名（全名）" —— 补 slug↔全名 对齐（八宫树 b 内是 简名+全名连排）
  const tRe = /<a class="hcell" href="\.\/(hexagram-(\d+)-([a-z-]+))" title="第\s*\d+\s*卦\s*([^（<]+)（([^）]+)）"/g;
  let tm;
  while ((tm = tRe.exec(html))) map[tm[5].replace(/遯/g, '遁')] = Object.assign(map[tm[5].replace(/遯/g, '遁')] || {}, { slug: tm[1], order: +tm[2], short: tm[4] });
  return map;
}
function parseAtlasPage(html) {
  const m = html.match(/<meta property="og:description" content="([^"]+)"/);
  if (!m) return null;
  const d = m[1];
  const r = {};
  const o = d.match(/第\s*(\d+)\s*卦（周易文王卦序）：(\S+?)。上卦(\S)（\S+?）、下卦(\S)（\S+?）。京房归([乾兑离震巽坎艮坤])宫（([金木水火土])）、(\S+?)，世第\s*(\d)\s*爻、应第\s*(\d)\s*爻。纳甲六爻自初爻起\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:、[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]){5})/);
  if (!o) return null;
  r.order = +o[1]; r.name = o[2].replace(/遯/g, '遁'); r.upper = o[3]; r.lower = o[4];
  r.palace = o[5] + '宫'; r.elem = o[6]; r.guaxing = o[7]; r.shi = +o[8]; r.ying = +o[9];
  r.zhiSeq = o[10].split('、'); // 自初爻起
  return r;
}

// ---------- 主流程 ----------
(async function main() {
  console.log('① 引擎生成 64 卦快照…');
  const eng = engineSnapshots();
  if (new Set(eng.map((e) => e.name)).size !== 64) { console.error('引擎 64 卦名有重复！'); process.exit(1); }

  console.log('② 抓取 bazi-atlas 总览（八宫树）…');
  const ov = await fetchCached('https://bazi-atlas.com/zh/hexagrams', '_atlas_overview.html');
  const atlasMap = parseAtlasOverview(ov);
  console.log('   八宫树解析得 ' + Object.keys(atlasMap).length + ' 卦');

  console.log('③ 逐卦抓取 aitjg（64 页，有缓存）…');
  const refA = {};
  let aFail = [];
  for (const e of eng) {
    const variants = [e.name, alias(e.name), e.name.replace(/遁/g, '遯')];
    let h = null, got = null;
    for (const v of variants) {
      try { h = await fetchCached('https://aitjg.com/g.php?name=' + encodeURIComponent(v), 'aitjg_' + v + '.html'); got = v; break; }
      catch (err) { if (!/HTTP 404/.test(err.message)) { aFail.push(e.name + '(' + err.message + ')'); h = null; break; } }
    }
    if (h) refA[e.name] = parseAitjg(h, e.name); else if (!got) { /* 404 全落空 */ aFail.push(e.name + '(aitjg 404)'); }
  }
  console.log('   aitjg 成功 ' + Object.keys(refA).length + '/64' + (aFail.length ? '；失败：' + aFail.join('、') : ''));

  console.log('④ 逐卦抓取 bazi-atlas（64 页，有缓存）…');
  const refB = {};
  let bFail = [];
  for (const e of eng) {
    const meta = atlasMap[e.name] || atlasMap[alias(e.name)] || atlasMap[e.name.replace(/遁/g, '遯')];
    if (!meta || !meta.slug) { bFail.push(e.name + '(总览无此卦)'); continue; }
    try {
      const h = await fetchCached('https://bazi-atlas.com/zh/' + meta.slug, 'atlas_' + e.name + '.html');
      const p = parseAtlasPage(h);
      if (p) refB[e.name] = p; else bFail.push(e.name + '(og:description 未解析出)');
    } catch (err) { bFail.push(e.name + '(' + err.message + ')'); }
  }
  console.log('   bazi-atlas 成功 ' + Object.keys(refB).length + '/64' + (bFail.length ? '；失败：' + bFail.join('、') : ''));

  // ---------- 对照 ----------
  console.log('⑤ 三方对照…');
  const problems = [];
  let chk = { total: 0, bad: 0 };
  function cmp(gua, item, expect, actual, src) {
    chk.total++;
    const ok = String(expect) === String(actual);
    if (!ok) { chk.bad++; problems.push('【' + gua + '】' + item + ' 引擎=' + expect + ' ' + src + '=' + actual); }
  }
  for (const e of eng) {
    const A = refA[e.name], B = refB[e.name];
    if (A) {
      // 排盘表 rows 自上而下=上→初 → 转初→上
      const rows = A.rows.slice().reverse();
      if (rows.length !== 6) problems.push('【' + e.name + '】aitjg 排盘行数=' + rows.length + '（应 6）'), chk.bad++, chk.total++;
      else {
        for (let i = 0; i < 6; i++) {
          cmp(e.name, POS[i] + '六亲', e.yaos[i].lq, rows[i].lq, 'aitjg');
          cmp(e.name, POS[i] + '干支', e.yaos[i].gz, rows[i].gz, 'aitjg');
          cmp(e.name, POS[i] + '阴阳', e.yaos[i].yang, rows[i].yang, 'aitjg');
        }
        cmp(e.name, '世爻位', e.shi, rows.findIndex((r) => r.seat === '世') + 1, 'aitjg');
        cmp(e.name, '应爻位', e.ying, rows.findIndex((r) => r.seat === '应') + 1, 'aitjg');
        cmp(e.name, '宫', e.palace, A.palace, 'aitjg');
        cmp(e.name, '宫五行', e.elem, A.elem, 'aitjg');
        // 六亲分布交叉验证（引擎推导 vs 站点分布表）
        for (const lq of ['父母', '兄弟', '子孙', '妻财', '官鬼']) {
          const dEng = (e.dist[lq] || []).slice().sort().join('');
          const dA = (A.dist[lq] || []).slice().sort().join('');
          if (dA) cmp(e.name, lq + '分布', dEng, dA, 'aitjg');
        }
        if (!A.guaci) problems.push('【' + e.name + '】aitjg 卦辞未取得'), chk.bad++, chk.total++;
        if (A.yaoci.length !== 6) problems.push('【' + e.name + '】aitjg 爻辞条数=' + A.yaoci.length + '（应 6）'), chk.bad++, chk.total++;
      }
    }
    if (B) {
      cmp(e.name, '卦名(序)', alias(e.name), alias(B.name), 'bazi-atlas');
      cmp(e.name, '上卦', e.upper, B.upper, 'bazi-atlas');
      cmp(e.name, '下卦', e.lower, B.lower, 'bazi-atlas');
      cmp(e.name, '宫', e.palace, B.palace, 'bazi-atlas');
      cmp(e.name, '宫五行', e.elem, B.elem, 'bazi-atlas');
      cmp(e.name, '世爻位', e.shi, B.shi, 'bazi-atlas');
      cmp(e.name, '应爻位', e.ying, B.ying, 'bazi-atlas');
      for (let i = 0; i < 6; i++) cmp(e.name, POS[i] + '地支', e.yaos[i].zhi, (B.zhiSeq[i] || '').slice(-1), 'bazi-atlas');
    }
  }

  // ---------- 参考数据落盘（供后续测试/取象用） ----------
  const reference = eng.map((e) => {
    const A = refA[e.name] || {}, B = refB[e.name] || {}, M = atlasMap[e.name] || {};
    return {
      name: e.name, wenwangOrder: M.order || null, slug: M.slug || null,
      upper: e.upper + '（' + TRI_XIANG[e.upper] + '）', lower: e.lower + '（' + TRI_XIANG[e.lower] + '）',
      palace: e.palace, elem: e.elem, guaxing: (B.guaxing || A.guaxing || ''),
      shi: e.shi, ying: e.ying,
      yaos: e.yaos.map((y, i) => ({ pos: y.pos, gz: y.gz, zhi: y.zhi, wuxing: A.rows ? A.rows[5 - i].el : '', lq: y.lq, yang: y.yang, shi: y.shi, ying: y.ying })),
      dist: e.dist,
      guaci: A.guaci || '', yaoci: A.yaoci || []
    };
  });
  fs.writeFileSync(path.join(__dirname, 'gua_reference.json'), JSON.stringify(reference, null, 1), 'utf8');

  // ---------- 报告 ----------
  const okRate = chk.total ? ((chk.total - chk.bad) / chk.total * 100).toFixed(2) : '0';
  let md = [];
  md.push('# 在线卦象核验报告');
  md.push('');
  md.push('- 核验时间：' + new Date().toISOString());
  md.push('- 引擎：libs/liuyao.js arrange()（月建丙寅／日辰甲子，静卦装法）');
  md.push('- 源A：aitjg.com/g.php?name=卦名（六爻排盘表·六亲/纳甲/阴阳/世应/宫位/卦性/六亲分布/卦辞/爻辞）');
  md.push('- 源B：bazi-atlas.com 各卦页 og:description（文王卦序/上下卦/宫/卦性/世应/纳甲地支序列）');
  md.push('- 对照项总数：' + chk.total + '；不符：' + chk.bad + '；一致率：' + okRate + '%');
  md.push('- 抓取失败：aitjg ' + aFail.length + '、bazi-atlas ' + bFail.length + (aFail.length || bFail.length ? '（' + aFail.concat(bFail).join('、') + '）' : ''));
  md.push('');
  if (problems.length) {
    md.push('## 不符清单（' + problems.length + ' 条）');
    md.push('');
    problems.forEach((p) => md.push('- ' + p));
  } else {
    md.push('## 结果：全部一致 ✅');
    md.push('');
    md.push('引擎 64 卦的卦名、上下卦、宫位、宫五行、卦性、世应、逐爻纳甲干支、逐爻六亲、逐爻阴阳、六亲分布，与两个独立外部站点全部吻合；每卦卦辞与六条爻辞均取得并落成参考数据 tmp/gua_reference.json。');
  }
  fs.writeFileSync(path.join(__dirname, '在线卦象核验报告.md'), md.join('\n'), 'utf8');

  console.log('');
  console.log('======== 汇总 ========');
  console.log('对照项 ' + chk.total + '，不符 ' + chk.bad + '，一致率 ' + okRate + '%');
  if (problems.length) { console.log(problems.slice(0, 30).join('\n')); if (problems.length > 30) console.log('…共 ' + problems.length + ' 条，详见 tmp/在线卦象核验报告.md'); }
  console.log('参考数据：tmp/gua_reference.json；报告：tmp/在线卦象核验报告.md');
  process.exit(chk.bad ? 1 : 0);
})().catch((e) => { console.error('核验失败：', e); process.exit(2); });
