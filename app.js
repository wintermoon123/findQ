/* 找问卷 · 交互逻辑 */
(function () {
  'use strict';

  var DATA = window.QUESTIONNAIRE_DATA || [];
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var ICONS = {
    search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>',
    heart: '<path d="M20.7 5.1a5.3 5.3 0 0 0-7.5 0L12 6.3l-1.2-1.2a5.3 5.3 0 0 0-7.5 7.5L12 21l8.7-8.4a5.3 5.3 0 0 0 0-7.5z"></path>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
    check: '<path d="m5 12 4 4L19 6"></path>',
    close: '<path d="M18 6 6 18M6 6l12 12"></path>',
    back: '<path d="M19 12H5m6-7-7 7 7 7"></path>',
    external: '<path d="M14 4h6v6M20 4l-9 9"></path><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"></path><path d="m3 13 9 5 9-5"></path>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"></path>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z"></path><path d="M8 7h8"></path>',
    chevron: '<path d="m9 6 6 6-6 6"></path>',
    info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>'
  };

  function icon(name, cls, filled) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') +
      '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || '') + '</svg>';
  }

  var DISCIPLINES = ['心理学', '社会学', '社会工作', '精神卫生', '教育学', '社会政策', '经济学', '管理学', '护理学', '人类学', '传播学', '语言学', '人文地理', '研究方法'];
  var TYPES = ['自评量表', '他评量表', '访谈量表', '人格测验', '大型社会调查'];
  var POPULATIONS = ['成人', '大学生', '青少年', '儿童', '老年人', '临床人群'];
  var YEAR_RANGES = {
    '1970 年前': [0, 1969],
    '1970–1989': [1970, 1989],
    '1990–1999': [1990, 1999],
    '2000–2009': [2000, 2009],
    '2010 至今': [2010, 9999]
  };
  var SORTS = [
    { value: 'default', label: '默认排序' },
    { value: 'heat', label: '最多收藏' },
    { value: 'newest', label: '最新发布' },
    { value: 'oldest', label: '最早发布' },
    { value: 'name', label: '按名称' }
  ];
  var HOT_TAGS = ['抑郁', '焦虑', '人格', '社会支持', '主观幸福感', 'CGSS', '社会调查', '睡眠', '大学生'];

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* file:// 环境可能禁用存储 */ }
  }

  var state = {
    keyword: '',
    discipline: '全部',
    type: '全部',
    population: '全部',
    year: '全部',
    sort: 'default',
    favorites: new Set(Array.isArray(loadJSON('zhaowenjuan-fav', [])) ? loadJSON('zhaowenjuan-fav', []) : []),
    compare: (function () {
      var raw = loadJSON('zhaowenjuan-cmp', []);
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (id) { return DATA.some(function (d) { return d.id === id; }); }).slice(0, 3);
    })(),
    homeScroll: 0
  };

  function persistFav() { saveJSON('zhaowenjuan-fav', Array.from(state.favorites)); }
  function persistCmp() { saveJSON('zhaowenjuan-cmp', state.compare); }
  function find(id) {
    for (var i = 0; i < DATA.length; i++) if (DATA[i].id === id) return DATA[i];
    return null;
  }
  function getRoute() {
    var hash = (location.hash || '').replace(/^#\/?/, '');
    var parts = hash.split('/');
    return { name: parts[0] || 'home', param: decodeURIComponent(parts[1] || '') };
  }

  /* ---------- 通用组件 ---------- */
  function options(list, current) {
    return list.map(function (v) {
      var value = typeof v === 'string' ? v : v.value;
      var label = typeof v === 'string' ? v : v.label;
      return '<option value="' + esc(value) + '"' + (value === current ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function badge(d) {
    var cls = d.type === '大型社会调查' ? 'survey' : d.type === '人格测验' ? 'personality' : '';
    return '<span class="badge ' + cls + '">' + esc(d.type) + '</span>';
  }

  function heartButton(id) {
    var active = state.favorites.has(id);
    return '<button class="icon-btn' + (active ? ' faved' : '') + '" type="button" data-fav="' + esc(id) +
      '" aria-label="' + (active ? '取消收藏' : '收藏') + '" aria-pressed="' + active + '" title="' + (active ? '取消收藏' : '收藏') + '">' +
      icon('heart', '', active) + '</button>';
  }

  function cardHTML(d) {
    var inCmp = state.compare.indexOf(d.id) !== -1;
    return '<article class="card">' +
      '<div class="card-top">' + badge(d) + heartButton(d.id) + '</div>' +
      '<h3><a href="#/item/' + encodeURIComponent(d.id) + '">' + esc(d.name) + '</a></h3>' +
      '<span class="alias">' + esc(d.alias) + '</span>' +
      '<div class="tag-row">' + d.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<p class="card-summary">' + esc(d.summary) + '</p>' +
      '<div class="card-meta">' +
      '<span>' + esc(d.items) + '</span><span class="dot"></span>' +
      '<span>' + esc(d.population.slice(0, 2).join(' / ')) + '</span><span class="dot"></span>' +
      '<span>' + d.year + ' 年</span>' +
      '</div>' +
      '<div class="card-actions">' +
      '<a class="btn btn-outline" href="#/item/' + encodeURIComponent(d.id) + '">查看详情</a>' +
      '<button class="btn ' + (inCmp ? 'added' : 'btn-soft') + '" type="button" data-compare="' + esc(d.id) + '">' +
      icon(inCmp ? 'check' : 'plus', 'icon-sm') + (inCmp ? '已加入' : '对比') + '</button>' +
      '</div>' +
      '</article>';
  }

  function emptyHTML(title, text, actionHtml) {
    return '<div class="empty"><div class="empty-icon">' + icon('search') + '</div>' +
      '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (actionHtml || '') + '</div>';
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    $('#app').innerHTML =
      '<section class="hero"><div class="wrap hero-inner">' +
      '<span class="hero-eyebrow"><span class="dot"></span> 为社会科学研究而生</span>' +
      '<h1>找到对的那份<em>问卷</em><br>让研究更有据可依</h1>' +
      '<p class="hero-sub">收录心理学、社会学、社会工作等专业常用的量表与大型社会调查，按学科、类型、人群快速筛选，支持收藏与并排对比。</p>' +
      '<div class="search-box">' + icon('search') +
      '<input class="search-input" id="searchInput" type="search" placeholder="搜索量表名称、缩写或关键词，如 PHQ-9、社会支持、CGSS" value="' + esc(state.keyword) + '" autocomplete="off" aria-label="搜索问卷">' +
      '<button class="clear-search" id="clearSearch" type="button" aria-label="清空搜索" hidden>' + icon('close', 'icon-sm') + '</button>' +
      '<button class="search-btn" id="searchBtn" type="button">搜索问卷</button>' +
      '</div>' +
      '<div class="hot-row"><span class="hot-label">热门搜索</span>' +
      HOT_TAGS.map(function (t) {
        return '<button class="hot-tag' + (state.keyword === t ? ' active' : '') + '" type="button" data-keyword="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>' +
      '<div class="hero-stats">' +
      '<div class="stat"><strong>' + DATA.length + '</strong><span>份精选问卷与调查</span></div>' +
      '<div class="stat"><strong>' + DISCIPLINES.length + '</strong><span>个专业学科领域</span></div>' +
      '<div class="stat"><strong>3</strong><span>份问卷并排对比</span></div>' +
      '</div></div></section>' +

      '<section class="catalog wrap" id="catalog">' +
      '<div class="filter-panel"><div class="filter-grid">' +
      '<div class="field"><label for="fDiscipline">所属学科</label><div class="select-wrap"><select id="fDiscipline">' + options(['全部'].concat(DISCIPLINES), state.discipline) + '</select></div></div>' +
      '<div class="field"><label for="fType">量表类型</label><div class="select-wrap"><select id="fType">' + options(['全部'].concat(TYPES), state.type) + '</select></div></div>' +
      '<div class="field"><label for="fPopulation">适用人群</label><div class="select-wrap"><select id="fPopulation">' + options(['全部'].concat(POPULATIONS), state.population) + '</select></div></div>' +
      '<div class="field"><label for="fYear">发布年份</label><div class="select-wrap"><select id="fYear">' + options(['全部'].concat(Object.keys(YEAR_RANGES)), state.year) + '</select></div></div>' +
      '<div class="field"><label for="fSort">排序方式</label><div class="select-wrap"><select id="fSort">' + options(SORTS, state.sort) + '</select></div></div>' +
      '<button class="reset-btn" id="resetBtn" type="button">' + icon('back', 'icon-sm') + ' 重置</button>' +
      '</div></div>' +
      '<div class="results-head"><h2>问卷库</h2><p id="resultCount"></p></div>' +
      '<div class="active-filters" id="activeFilters"></div>' +
      '<div class="card-grid" id="resultGrid"></div>' +
      '</section>';

    var input = $('#searchInput');
    input.addEventListener('input', function () { setKeyword(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#catalog').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    $('#clearSearch').addEventListener('click', function () { setKeyword(''); input.focus(); });
    $('#searchBtn').addEventListener('click', function () { $('#catalog').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $('#fDiscipline').addEventListener('change', function (e) { state.discipline = e.target.value; updateResults(); });
    $('#fType').addEventListener('change', function (e) { state.type = e.target.value; updateResults(); });
    $('#fPopulation').addEventListener('change', function (e) { state.population = e.target.value; updateResults(); });
    $('#fYear').addEventListener('change', function (e) { state.year = e.target.value; updateResults(); });
    $('#fSort').addEventListener('change', function (e) { state.sort = e.target.value; updateResults(); });
    $('#resetBtn').addEventListener('click', resetFilters);

    updateResults();
  }

  function setKeyword(value) {
    state.keyword = value;
    var input = $('#searchInput');
    if (input && input.value !== value) input.value = value;
    updateResults();
  }

  function resetFilters() {
    state.keyword = '';
    state.discipline = '全部';
    state.type = '全部';
    state.population = '全部';
    state.year = '全部';
    state.sort = 'default';
    var input = $('#searchInput');
    if (input) input.value = '';
    ['fDiscipline', 'fType', 'fPopulation', 'fYear', 'fSort'].forEach(function (id) {
      var el = $('#' + id);
      if (el) el.value = id === 'fSort' ? 'default' : '全部';
    });
    updateResults();
  }

  function inYear(year, range) {
    var r = YEAR_RANGES[range];
    return r ? year >= r[0] && year <= r[1] : true;
  }

  function filteredData() {
    var terms = state.keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var list = DATA.filter(function (d) {
      if (state.discipline !== '全部' && d.disciplines.indexOf(state.discipline) === -1) return false;
      if (state.type !== '全部' && d.type !== state.type) return false;
      if (state.population !== '全部' && d.population.indexOf(state.population) === -1) return false;
      if (state.year !== '全部' && !inYear(d.year, state.year)) return false;
      if (terms.length) {
        var hay = [d.name, d.alias, d.summary, d.type, d.tags.join(' '), d.disciplines.join(' '),
          d.population.join(' '), d.literature.join(' ')].join(' ').toLowerCase();
        for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
      }
      return true;
    });

    list.sort(function (a, b) {
      if (state.sort === 'newest') return b.year - a.year;
      if (state.sort === 'oldest') return a.year - b.year;
      if (state.sort === 'name') return a.name.localeCompare(b.name, 'zh-CN');
      return b.heat - a.heat;
    });
    return list;
  }

  function updateResults() {
    var grid = $('#resultGrid');
    if (!grid) return;
    var list = filteredData();
    $('#resultCount').innerHTML = '共找到 <b>' + list.length + '</b> 份问卷';
    grid.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : emptyHTML('没有找到匹配的问卷', '试试更换关键词，或放宽筛选条件。',
        '<button class="btn btn-primary" type="button" id="emptyReset">清空筛选条件</button>');

    var emptyReset = $('#emptyReset');
    if (emptyReset) emptyReset.addEventListener('click', resetFilters);

    var clear = $('#clearSearch');
    if (clear) clear.hidden = !state.keyword;
    $$('.hot-tag').forEach(function (el) { el.classList.toggle('active', el.dataset.keyword === state.keyword); });

    var chips = [];
    if (state.keyword) chips.push(['keyword', '关键词：' + state.keyword]);
    if (state.discipline !== '全部') chips.push(['discipline', '学科：' + state.discipline]);
    if (state.type !== '全部') chips.push(['type', '类型：' + state.type]);
    if (state.population !== '全部') chips.push(['population', '人群：' + state.population]);
    if (state.year !== '全部') chips.push(['year', '年份：' + state.year]);
    $('#activeFilters').innerHTML = chips.map(function (c) {
      return '<span class="filter-chip">' + esc(c[1]) + '<button type="button" data-clear-filter="' + c[0] + '" aria-label="移除该条件">' + icon('close', 'icon-sm') + '</button></span>';
    }).join('');
  }

  /* ---------- 详情页 ---------- */
  function renderDetail(id) {
    var d = find(id);
    if (!d) {
      $('#app').innerHTML = '<div class="wrap page">' + emptyHTML('问卷不存在', '这份问卷可能已被移除，返回首页继续查找。',
        '<a class="btn btn-primary" href="#/">返回首页</a>') + '</div>';
      return;
    }
    var related = DATA.filter(function (x) {
      return x.id !== d.id && (x.tags.some(function (t) { return d.tags.indexOf(t) !== -1; }) ||
        x.disciplines.some(function (s) { return d.disciplines.indexOf(s) !== -1; }));
    }).slice(0, 3);
    var faved = state.favorites.has(d.id);
    var inCmp = state.compare.indexOf(d.id) !== -1;
    var scholar = 'https://xueshu.baidu.com/s?wd=' + encodeURIComponent(d.name + ' ' + d.alias);

    $('#app').innerHTML =
      '<div class="wrap page">' +
      '<div class="crumb"><a href="#/">首页</a><span class="sep">/</span><span>' + esc(d.disciplines[0]) + '</span><span class="sep">/</span><span>' + esc(d.name) + '</span></div>' +
      '<div class="detail-hero">' +
      '<div class="detail-head"><div>' + badge(d) +
      '<h1>' + esc(d.name) + '</h1><span class="detail-alias">' + esc(d.alias) + '</span>' +
      '<div class="detail-badges">' + d.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '</div><div class="detail-actions">' +
      '<button class="btn ' + (faved ? 'btn-primary' : 'btn-outline') + '" type="button" data-fav="' + esc(d.id) + '">' +
      icon('heart', '', faved) + (faved ? '已收藏' : '收藏问卷') + '</button>' +
      '<button class="btn ' + (inCmp ? 'added' : 'btn-soft') + '" type="button" data-compare="' + esc(d.id) + '">' +
      icon(inCmp ? 'check' : 'plus', 'icon-sm') + (inCmp ? '已加入对比' : '加入对比') + '</button>' +
      '</div></div>' +
      '<p class="detail-summary">' + esc(d.summary) + '</p>' +
      '</div>' +

      '<div class="detail-layout"><div class="main-col">' +
      '<section class="section-card"><h2>量表简介</h2><p>' + esc(d.summary) + '</p>' +
      (d.note ? '<div class="callout">' + icon('info', 'icon-sm') + ' ' + esc(d.note) + '</div>' : '') + '</section>' +

      '<section class="section-card"><h2>题项示例</h2>' +
      '<ol class="sample-list">' + d.sampleItems.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<div class="callout">题项示例仅用于展示量表风格与测量内容，正式施测请使用原版问卷。</div></section>' +

      '<section class="section-card"><h2>信度与效度</h2>' +
      '<p><strong style="color:var(--ink)">信度：</strong>' + esc(d.reliability) + '</p>' +
      '<p><strong style="color:var(--ink)">效度：</strong>' + esc(d.validity) + '</p></section>' +

      '<section class="section-card"><h2>来源文献</h2>' +
      '<ol class="lit-list">' + d.literature.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol></section>' +
      '</div>' +

      '<aside class="sidebar">' +
      '<div class="side-card"><h3>基本信息</h3><dl class="kv">' +
      kv('所属学科', d.disciplines.join('、')) + kv('量表类型', d.type) + kv('适用人群', d.population.join('、')) +
      kv('题项数量', d.items) + kv('施测时长', d.duration) + kv('发布年份', d.year + ' 年') +
      kv('语言版本', d.language) + kv('获取方式', d.access) +
      '</dl></div>' +

      '<div class="side-card"><h3>获取与引用</h3>' +
      '<div class="access-box"><div class="access-label">获取方式</div><strong>' + esc(d.access) + '</strong></div>' +
      '<div class="side-links">' +
      (d.official ? '<a class="btn btn-primary" href="' + esc(d.official.url) + '" target="_blank" rel="noopener noreferrer">' + icon('external', 'icon-sm') + esc(d.official.label) + '</a>' : '') +
      '<a class="btn btn-outline" href="' + esc(scholar) + '" target="_blank" rel="noopener noreferrer">' + icon('book', 'icon-sm') + '检索来源文献</a>' +
      '</div><p class="access-note">请遵守原版权与数据使用协议，并在论文中规范引用。</p></div>' +

      (related.length ? '<div class="side-card"><h3>相关推荐</h3><div class="related-list">' + related.map(function (r) {
        return '<a class="related-item" href="#/item/' + encodeURIComponent(r.id) + '">' +
          '<span class="related-icon">' + icon('layers', 'icon-sm') + '</span><span><strong>' + esc(r.name) + '</strong><small>' + esc(r.alias) + '</small></span></a>';
      }).join('') + '</div></div>' : '') +
      '</aside></div>' +
      '<div style="margin-top:8px"><a class="btn btn-plain" href="#/">' + icon('back', 'icon-sm') + ' 返回问卷库</a></div>' +
      '</div>';
  }

  function kv(k, v) { return '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>'; }

  /* ---------- 收藏页 ---------- */
  function renderFavorites() {
    var items = Array.from(state.favorites).map(find).filter(Boolean);
    $('#app').innerHTML = '<div class="wrap page">' +
      '<div class="section-title"><h1>我的收藏</h1><p>已收藏 ' + items.length + ' 份问卷 · 保存在当前浏览器中</p></div>' +
      '<div class="card-grid">' + (items.length ? items.map(cardHTML).join('') :
        emptyHTML('还没有收藏的问卷', '在问卷卡片上点击爱心，即可把常用量表保存到这里。',
          '<a class="btn btn-primary" href="#/">去发现问卷</a>')) + '</div></div>';
  }

  /* ---------- 对比页 ---------- */
  function renderCompare() {
    var items = state.compare.map(find).filter(Boolean);
    var head = '<div class="wrap page"><div class="section-title"><h1>问卷对比</h1><p>并排查看不同量表的关键信息，帮助你快速做出选择</p></div>';
    if (items.length < 2) {
      $('#app').innerHTML = head + emptyHTML('至少选择 2 份问卷', '在问卷库中点击「对比」，最多可同时比较 3 份问卷。',
        '<a class="btn btn-primary" href="#/">去选择问卷</a>') + '</div>';
      return;
    }
    var rows = [
      ['量表类型', function (d) { return d.type; }],
      ['所属学科', function (d) { return d.disciplines.join('、'); }],
      ['适用人群', function (d) { return d.population.join('、'); }],
      ['题项数量', function (d) { return d.items; }],
      ['施测时长', function (d) { return d.duration; }],
      ['发布年份', function (d) { return d.year + ' 年'; }],
      ['语言版本', function (d) { return d.language; }],
      ['获取方式', function (d) { return d.access; }],
      ['信度表现', function (d) { return d.reliability; }],
      ['效度表现', function (d) { return d.validity; }],
      ['核心特点', function (d) { return d.summary; }],
      ['来源文献', function (d) { return d.literature[0]; }]
    ];
    var html = head +
      '<div class="compare-toolbar"><span>正在对比 ' + items.length + ' 份问卷（最多 3 份）</span>' +
      '<button class="btn btn-plain" type="button" id="clearCompare">' + icon('close', 'icon-sm') + ' 清空对比</button></div>' +
      '<div class="compare-wrap"><table class="cmp"><thead><tr><th></th>' + items.map(function (d) {
        return '<th><div class="cmp-head-cell"><a href="#/item/' + encodeURIComponent(d.id) + '">' + esc(d.name) +
          '<br><small style="font-weight:500;color:var(--muted);font-size:12px">' + esc(d.alias) + '</small></a>' +
          '<button class="cmp-remove" type="button" data-remove-compare="' + esc(d.id) + '" aria-label="移除">' + icon('close', 'icon-sm') + '</button></div></th>';
      }).join('') + '</tr></thead><tbody>' + rows.map(function (row) {
        return '<tr><th>' + esc(row[0]) + '</th>' + items.map(function (d) {
          return '<td>' + esc(row[1](d)) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>';
    $('#app').innerHTML = html;
    $('#clearCompare').addEventListener('click', function () {
      state.compare = [];
      persistCmp();
      render();
      showToast('已清空对比列表');
    });
  }

  /* ---------- 关于页 ---------- */
  function renderAbout() {
    $('#app').innerHTML = '<div class="wrap page">' +
      '<div class="section-title"><h1>关于找问卷</h1><p>一个为社会科学学生打造的问卷与量表检索工具</p></div>' +
      '<div class="about-grid">' +
      '<section class="about-card"><div class="mini-label">WHY</div><h2>为什么做这个站</h2>' +
      '<p>写文献综述、设计调查、准备开题时，找到一个信效度可靠、适合自己研究对象的量表往往要花很多时间。「找问卷」把心理学、社会学、社会工作常用的量表与大型社会调查整理在一起，帮助你更快锁定合适的测量工具。</p></section>' +
      '<section class="about-card"><div class="mini-label">HOW</div><h2>怎么用</h2>' +
      '<ol><li>在首页输入关键词，或直接按学科、类型、人群、年份筛选。</li><li>进入详情页查看题项示例、信效度、来源文献与获取方式。</li><li>点击爱心收藏常用量表，点击「对比」最多并排比较 3 份问卷。</li></ol></section>' +
      '<section class="about-card"><div class="mini-label">DATA</div><h2>数据说明</h2>' +
      '<p>当前收录 140 份示例条目，覆盖 14 个学科领域与 5 种量表类型，涵盖症状筛查、人格、社会支持、组织行为、护理评估、语言学习、环境感知、调查方法等量表，以及 CGSS、CFPS、CHARLS、CLHLS、EU-SILC 等大型社会调查。条目信息经过简化整理，题项示例经过改写，仅作演示。</p></section>' +
      '<section class="about-card"><div class="mini-label">SCOPE</div><h2>适用场景</h2>' +
      '<p>适合课程作业、研究设计初期的工具调研，以及了解某个领域有哪些成熟量表。收藏与对比数据保存在你的浏览器中，不上传服务器。</p></section>' +
      '<section class="about-card about-full"><div class="mini-label">DISCLAIMER</div><h2>使用提醒</h2>' +
      '<div class="warn">本站为课程设计演示项目，不具备学术数据库或诊断工具的资质。量表版权、授权要求与解释标准请以原作者文献及出版机构为准；大型调查数据请通过官方平台申请并遵守数据使用协议。请勿将本站内容直接用于临床诊断。</div></section>' +
      '</div></div>';
  }

  /* ---------- 交互状态同步 ---------- */
  function showToast(msg) {
    var toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.classList.remove('show'); }, 2300);
  }

  function updateNav(routeName) {
    var active = routeName === 'item' ? 'home' : routeName;
    $$('.nav a').forEach(function (a) { a.classList.toggle('active', a.dataset.route === active); });
    var fc = $('#favCount'), cc = $('#cmpCount');
    fc.textContent = state.favorites.size;
    fc.hidden = state.favorites.size === 0;
    cc.textContent = state.compare.length;
    cc.hidden = state.compare.length === 0;
  }

  function syncFavButton(id) {
    var active = state.favorites.has(id);
    $$('[data-fav="' + id + '"]').forEach(function (btn) {
      btn.classList.toggle('faved', active);
      btn.setAttribute('aria-pressed', String(active));
      if (btn.classList.contains('btn')) {
        btn.classList.toggle('btn-primary', active);
        btn.classList.toggle('btn-outline', !active);
        btn.innerHTML = icon('heart', '', active) + (active ? '已收藏' : '收藏问卷');
      } else {
        btn.innerHTML = icon('heart', '', active);
      }
    });
  }

  function syncCompareButton(id) {
    var active = state.compare.indexOf(id) !== -1;
    $$('[data-compare="' + id + '"]').forEach(function (btn) {
      btn.classList.toggle('added', active);
      btn.classList.toggle('btn-soft', !active);
      btn.innerHTML = icon(active ? 'check' : 'plus', 'icon-sm') + (active ? (btn.closest('.detail-actions') ? '已加入对比' : '已加入') : (btn.closest('.detail-actions') ? '加入对比' : '对比'));
    });
  }

  function updateCompareBar(routeName) {
    var bar = $('#compareBar');
    if (!bar) return;
    if (!state.compare.length || routeName === 'compare') {
      bar.classList.remove('show');
      bar.innerHTML = '';
      return;
    }
    bar.innerHTML = '<span class="cmp-bar-label">对比栏 <b>' + state.compare.length + '/3</b></span>' +
      '<div class="cmp-bar-items">' + state.compare.map(function (id) {
        var d = find(id);
        return d ? '<span class="cmp-chip">' + esc(d.alias) + '<button type="button" data-remove-compare="' + esc(id) + '" aria-label="移除 ' + esc(d.name) + '">' + icon('close', 'icon-sm') + '</button></span>' : '';
      }).join('') + '</div>' +
      '<div class="cmp-bar-actions"><button class="bar-btn" type="button" id="barClear">清空</button>' +
      '<button class="bar-btn go" type="button" id="barGo">开始对比 ' + icon('chevron', 'icon-sm') + '</button></div>';
    bar.classList.add('show');
    $('#barClear').addEventListener('click', function () {
      state.compare = [];
      persistCmp();
      updateCompareBar(getRoute().name);
      $$('[data-compare]').forEach(function (b) { syncCompareButton(b.dataset.compare); });
      updateNav(getRoute().name);
      showToast('已清空对比列表');
    });
    $('#barGo').addEventListener('click', function () {
      if (state.compare.length < 2) { showToast('至少选择 2 份问卷才能对比'); return; }
      location.hash = '#/compare';
    });
  }

  function toggleFav(id) {
    if (!find(id)) return;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      showToast('已取消收藏');
    } else {
      state.favorites.add(id);
      showToast('已加入收藏');
    }
    persistFav();
    syncFavButton(id);
    updateNav(getRoute().name);
    if (getRoute().name === 'favorites') render();
  }

  function toggleCompare(id) {
    if (!find(id)) return;
    var idx = state.compare.indexOf(id);
    if (idx !== -1) {
      state.compare.splice(idx, 1);
      showToast('已移出对比');
    } else {
      if (state.compare.length >= 3) { showToast('最多同时对比 3 份问卷'); return; }
      state.compare.push(id);
      showToast('已加入对比栏');
    }
    persistCmp();
    syncCompareButton(id);
    updateNav(getRoute().name);
    updateCompareBar(getRoute().name);
    if (getRoute().name === 'compare') render();
  }

  /* ---------- 路由 ---------- */
  var lastRoute = null;
  function render() {
    var route = getRoute();
    if (lastRoute === 'home' && route.name !== 'home') state.homeScroll = window.scrollY || 0;
    updateNav(route.name);
    if (route.name === 'item') renderDetail(route.param);
    else if (route.name === 'favorites') renderFavorites();
    else if (route.name === 'compare') renderCompare();
    else if (route.name === 'about') renderAbout();
    else renderHome();
    updateCompareBar(route.name);
    window.scrollTo(0, 0);
    if (route.name === 'home' && state.homeScroll) {
      var y = state.homeScroll;
      state.homeScroll = 0;
      requestAnimationFrame(function () { window.scrollTo(0, y); });
    }
    lastRoute = route.name;
  }

  document.addEventListener('click', function (e) {
    var fav = e.target.closest('[data-fav]');
    if (fav) { toggleFav(fav.dataset.fav); return; }
    var cmp = e.target.closest('[data-compare]');
    if (cmp) { toggleCompare(cmp.dataset.compare); return; }
    var rm = e.target.closest('[data-remove-compare]');
    if (rm) { toggleCompare(rm.dataset.removeCompare); return; }
    var clearF = e.target.closest('[data-clear-filter]');
    if (clearF) {
      var k = clearF.dataset.clearFilter;
      if (k === 'keyword') setKeyword('');
      else {
        state[k] = '全部';
        var map = { discipline: 'fDiscipline', type: 'fType', population: 'fPopulation', year: 'fYear' };
        var el = $('#' + map[k]);
        if (el) el.value = '全部';
        updateResults();
      }
      return;
    }
    var hot = e.target.closest('[data-keyword]');
    if (hot) { setKeyword(hot.dataset.keyword); }
  });

  window.addEventListener('hashchange', render);
  render();
})();
