/* Charts for the parent dashboard.
 *
 * Colour follows the data's job, not the bar's rank: every bar in a single
 * series wears the same hue (length carries magnitude), and only the calendar
 * — which encodes continuous magnitude — uses a light-to-dark ramp. Tokens
 * come from css/app.css so light and dark are one switch. */
(function (w) {
  'use strict';

  var el = w.PP.ui.el;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    var n = w.document.createElementNS(SVG_NS, tag), k;
    for (k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null) {
        n.setAttribute(k, attrs[k]);
      }
    }
    return n;
  }

  /* ---- shared tooltip ---------------------------------------------- */
  var tip = null;
  function showTip(x, y, title, value) {
    hideTip();
    tip = el('div', { class: 'viz-tip' }, [
      el('span', { class: 't', text: title }),
      el('span', { class: 'v', text: value })
    ]);
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
    w.document.body.appendChild(tip);
  }
  function hideTip() {
    if (tip && tip.parentNode) { tip.parentNode.removeChild(tip); }
    tip = null;
  }
  w.document.addEventListener('touchstart', function (e) {
    if (tip && !(e.target && e.target.getAttribute && e.target.getAttribute('data-tip'))) { hideTip(); }
  }, true);

  /* Hover on a desktop, tap on the iPad — the hit target is the whole row. */
  function bindTip(node, titleFn, valueFn) {
    node.setAttribute('data-tip', '1');
    function at(e) {
      var r = node.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top;
      if (e && e.touches && e.touches[0]) { x = e.touches[0].clientX; y = r.top; }
      showTip(x, y, titleFn(), valueFn());
    }
    node.addEventListener('mouseenter', at, false);
    node.addEventListener('mouseleave', hideTip, false);
    node.addEventListener('touchstart', function (e) { at(e); }, false);
    node.addEventListener('click', at, false);
  }

  /* ---- ranked bars (HTML, so labels stay crisp at any width) -------- */
  function rankedBar(rows, opts) {
    opts = opts || {};
    var max = 0, i, wrap, row, r;
    for (i = 0; i < rows.length; i++) { if (rows[i].value > max) { max = rows[i].value; } }
    if (!rows.length || max === 0) { return emptyNote(opts.empty || 'Nothing logged yet.'); }

    wrap = el('div', { class: 'bars', role: 'img', 'aria-label': opts.title || 'Ranked bar chart' });
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      row = buildBarRow(r, max, opts);
      wrap.appendChild(row);
    }
    return wrap;
  }

  function buildBarRow(r, max, opts) {
    var pct = Math.max(2, Math.round((r.value / max) * 100));
    var fill = el('div', { class: 'bar-fill' });
    fill.style.width = pct + '%';
    var row = el('div', { class: 'bar-row' }, [
      el('div', { class: 'bar-label' }, [
        r.emoji ? el('span', { class: 'bar-emoji', text: r.emoji }) : null,
        el('span', { text: r.label })
      ]),
      el('div', { class: 'bar-track' }, [fill]),
      el('div', { class: 'bar-value', text: opts.format ? opts.format(r.value) : String(r.value) })
    ]);
    bindTip(row,
      function () { return r.label; },
      function () { return (opts.tip ? opts.tip(r) : (opts.format ? opts.format(r.value) : r.value)); });
    return row;
  }

  /* ---- line trend (SVG) -------------------------------------------- */
  function lineTrend(points, opts) {
    opts = opts || {};
    if (points.length < 2) {
      return emptyNote(opts.empty || 'Two weeks of practice will draw this line.');
    }
    var W = 600, H = 220, padL = 42, padR = 18, padT = 16, padB = 34;
    var i, p, x, y, maxY = 0, minY = Infinity, path = '', ticks, val;

    for (i = 0; i < points.length; i++) {
      if (points[i].y > maxY) { maxY = points[i].y; }
      if (points[i].y < minY) { minY = points[i].y; }
    }
    maxY = Math.ceil(maxY + Math.max(1, maxY * 0.15));
    minY = Math.max(0, Math.floor(minY - 1));
    if (maxY - minY < 2) { maxY = minY + 2; }

    function sx(idx) { return padL + (idx / (points.length - 1)) * (W - padL - padR); }
    function sy(v) { return padT + (1 - (v - minY) / (maxY - minY)) * (H - padT - padB); }

    var svg = svgEl('svg', {
      class: 'chart-svg', viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': opts.title || 'Trend line'
    });

    /* recessive gridlines + y ticks */
    ticks = niceTicks(minY, maxY, 4);
    for (i = 0; i < ticks.length; i++) {
      val = ticks[i];
      y = sy(val);
      svg.appendChild(svgEl('line', {
        x1: padL, x2: W - padR, y1: y, y2: y,
        stroke: 'var(--viz-grid)', 'stroke-width': 1
      }));
      svg.appendChild(textEl(padL - 8, y + 4, String(val), 'end', 13, 'var(--viz-muted)'));
    }
    svg.appendChild(svgEl('line', {
      x1: padL, x2: W - padR, y1: sy(minY), y2: sy(minY),
      stroke: 'var(--viz-axis)', 'stroke-width': 1
    }));

    for (i = 0; i < points.length; i++) {
      x = sx(i); y = sy(points[i].y);
      path += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    svg.appendChild(svgEl('path', {
      d: path, fill: 'none', stroke: 'var(--viz-series-1)',
      'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));

    for (i = 0; i < points.length; i++) {
      p = points[i]; x = sx(i); y = sy(p.y);
      /* 2px surface ring keeps overlapping markers separable */
      svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 5.5, fill: 'var(--viz-surface)' }));
      svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 4, fill: 'var(--viz-series-1)' }));
      /* x labels: first, last, and every other one so they never collide */
      if (i === 0 || i === points.length - 1 || points.length <= 6) {
        svg.appendChild(textEl(x, H - 12, p.label, i === 0 ? 'start' : (i === points.length - 1 ? 'end' : 'middle'), 13, 'var(--viz-muted)'));
      }
      var hit = svgEl('circle', { cx: x, cy: y, r: 18, fill: 'transparent', 'data-tip': '1' });
      (function (pt, cx, cy) {
        hit.addEventListener('mouseenter', function () { tipAtSvg(svg, cx, cy, pt.label, pt.tip); }, false);
        hit.addEventListener('mouseleave', hideTip, false);
        hit.addEventListener('touchstart', function () { tipAtSvg(svg, cx, cy, pt.label, pt.tip); }, false);
        hit.addEventListener('click', function () { tipAtSvg(svg, cx, cy, pt.label, pt.tip); }, false);
      })(p, x, y);
      svg.appendChild(hit);
    }

    /* direct label on the most recent point — no number on every marker */
    p = points[points.length - 1];
    svg.appendChild(textEl(sx(points.length - 1), sy(p.y) - 14, String(p.y), 'end', 15, 'var(--viz-ink)', 700));

    return svg;
  }

  function tipAtSvg(svg, vx, vy, title, value) {
    var r = svg.getBoundingClientRect();
    var scale = r.width / 600;
    showTip(r.left + vx * scale, r.top + vy * scale, title, value);
  }

  function textEl(x, y, str, anchor, size, fill, weight) {
    var t = svgEl('text', {
      x: x, y: y, 'text-anchor': anchor,
      'font-size': size, fill: fill,
      'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'font-weight': weight || 400
    });
    t.textContent = str;
    return t;
  }

  function niceTicks(min, max, count) {
    var step = Math.max(1, Math.round((max - min) / count)), out = [], v;
    for (v = min; v <= max; v += step) { out.push(v); }
    return out;
  }

  /* ---- practice calendar (sequential ramp) -------------------------- */
  var DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  function heatmap(cells, opts) {
    opts = opts || {};
    var max = 0, i, c, wrap, grid, level, cell, weeks = 0;
    for (i = 0; i < cells.length; i++) {
      if (cells[i].minutes > max) { max = cells[i].minutes; }
      if (cells[i].week + 1 > weeks) { weeks = cells[i].week + 1; }
    }

    wrap = el('div', { class: 'heat-wrap', role: 'img', 'aria-label': 'Practice calendar' });
    var labels = el('div', { class: 'heat-days' });
    for (i = 0; i < 7; i++) { labels.appendChild(el('span', { text: DOW[i] })); }
    wrap.appendChild(labels);

    grid = el('div', { class: 'heat-grid' });
    grid.style.width = (weeks * 18) + 'px';
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      level = c.minutes === 0 && c.passes === 0 ? 0 : levelFor(c.minutes || 1, max || 1);
      cell = el('div', { class: 'heat-cell l' + level });
      cell.style.gridColumn = (c.week + 1);
      cell.style.gridRow = (c.dow + 1);
      bindTipCell(cell, c);
      grid.appendChild(cell);
    }
    var scroller = el('div', { class: 'heat-scroll' }, [grid]);
    wrap.appendChild(scroller);
    /* newest weeks are on the right, so start scrolled to them */
    setTimeout(function () { scroller.scrollLeft = scroller.scrollWidth; }, 0);

    wrap.appendChild(el('div', { class: 'heat-legend' }, [
      el('span', { class: 'tiny muted', text: 'less' }),
      el('i', { class: 'heat-cell l0' }), el('i', { class: 'heat-cell l1' }),
      el('i', { class: 'heat-cell l2' }), el('i', { class: 'heat-cell l3' }),
      el('i', { class: 'heat-cell l4' }),
      el('span', { class: 'tiny muted', text: 'more' })
    ]));
    return wrap;
  }

  function bindTipCell(cell, c) {
    bindTip(cell,
      function () { return w.PP.ui.fmtDate(c.ts); },
      function () {
        if (!c.passes && !c.minutes) { return 'No practice'; }
        return c.minutes + ' min · ' + w.PP.ui.plural(c.passes, 'try', 'tries') +
               (c.runs ? ' · ' + w.PP.ui.plural(c.runs, 'streak') + ' cleared' : '');
      });
  }

  function levelFor(v, max) {
    var r = v / max;
    if (r <= 0.25) { return 1; }
    if (r <= 0.5) { return 2; }
    if (r <= 0.75) { return 3; }
    return 4;
  }

  function emptyNote(msg) { return el('div', { class: 'chart-empty', text: msg }); }

  /* ---- table view (the accessibility fallback for every chart) ------ */
  function table(cols, rows) {
    var thead = el('tr'), i, j, tr, tbody = el('tbody');
    for (i = 0; i < cols.length; i++) {
      thead.appendChild(el('th', { class: cols[i].num ? 'num' : '', text: cols[i].label }));
    }
    for (i = 0; i < rows.length; i++) {
      tr = el('tr');
      for (j = 0; j < cols.length; j++) {
        tr.appendChild(el('td', { class: cols[j].num ? 'num' : '', text: String(rows[i][cols[j].key]) }));
      }
      tbody.appendChild(tr);
    }
    return el('table', { class: 'data-table' }, [el('thead', {}, [thead]), tbody]);
  }

  w.PP.charts = {
    rankedBar: rankedBar,
    lineTrend: lineTrend,
    heatmap: heatmap,
    table: table,
    emptyNote: emptyNote,
    hideTip: hideTip
  };
})(window);
