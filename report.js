// report.js — full analysis and report rendering

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHour12(h) {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function formatDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ─── Render functions ──────────────────────────────────────────────────────────

function renderHourChart(hourHistogram, peakHour) {
  const chart = document.getElementById('hour-chart');
  chart.innerHTML = '';
  const max = Math.max(...hourHistogram, 1);

  hourHistogram.forEach((count, hour) => {
    const wrap = document.createElement('div');
    wrap.className = 'hour-bar-wrap';

    const bar = document.createElement('div');
    bar.className = 'hour-bar' + (hour === peakHour ? ' peak' : '');
    bar.style.height = `${Math.max(2, Math.round((count / max) * 80))}px`;
    bar.title = `${formatHour12(hour)}: ${count} visits`;

    const label = document.createElement('span');
    label.className = 'hour-label';
    // Only show some labels to avoid crowding
    if (hour % 6 === 0) label.textContent = formatHour12(hour);

    wrap.appendChild(bar);
    wrap.appendChild(label);
    chart.appendChild(wrap);
  });
}

function renderStatCards(metrics) {
  const container = document.getElementById('stat-cards');
  container.innerHTML = '';

  const cards = [
    {
      label: 'Domain diversity',
      value: metrics.domainDiversity,
      sub: 'unique sites visited'
    },
    {
      label: 'Total visits',
      value: metrics.totalVisits,
      sub: 'pages loaded'
    },
    {
      label: 'Peak hour',
      value: metrics.peakHour !== null ? formatHour12(metrics.peakHour) : '—',
      sub: 'most active time'
    },
    {
      label: 'Busiest day',
      value: metrics.busiestDay !== null ? DAYS_FULL[metrics.busiestDay].slice(0, 3) : '—',
      sub: DAYS_FULL[metrics.busiestDay] || ''
    },
    {
      label: 'Night owl',
      value: `${Math.round(metrics.nightOwlScore * 100)}%`,
      sub: 'browsing after midnight'
    },
    {
      label: 'Reload goblin',
      value: metrics.reloadGoblinScore,
      sub: 'times you hit reload'
    },
    {
      label: 'Longest session',
      value: metrics.longestSession ? metrics.longestSession.count : '—',
      sub: metrics.longestSession
        ? `pages · ${formatDuration(metrics.longestSession.endTime - metrics.longestSession.startTime)}`
        : 'no sessions found'
    },
    {
      label: 'Social time',
      value: metrics.socialSinkTotal,
      sub: 'social media visits'
    },
    {
      label: 'Shopping visits',
      value: metrics.shoppingSpiralTotal,
      sub: 'retail site visits'
    },
    {
      label: 'Typed vs clicked',
      value: metrics.typedVsLinkRatio.toFixed(1) + '×',
      sub: 'typed-to-link ratio'
    }
  ];

  cards.forEach(({ label, value, sub }) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
      <div class="card-sub">${sub}</div>
    `;
    container.appendChild(card);
  });
}

function renderDomainList(topDomains) {
  const ul = document.getElementById('top-domains');
  ul.innerHTML = '';
  if (!topDomains.length) {
    ul.innerHTML = '<li style="color:var(--text-muted);padding:8px">No domain data available.</li>';
    return;
  }
  const maxVal = topDomains[0].total;
  topDomains.forEach(({ domain, total }, i) => {
    const pct = Math.round((total / maxVal) * 100);
    const li = document.createElement('li');
    li.className = 'domain-row';
    li.innerHTML = `
      <span class="domain-rank">${i + 1}</span>
      <span class="domain-name">${domain}</span>
      <div class="domain-bar-bg"><div class="domain-bar-fill" style="width:${pct}%"></div></div>
      <span class="domain-count">${total}</span>
    `;
    ul.appendChild(li);
  });
}

function renderUrlList(topUrls) {
  const ul = document.getElementById('top-urls');
  ul.innerHTML = '';
  if (!topUrls.length) {
    ul.innerHTML = '<li style="color:var(--text-muted);padding:8px">No URL data available.</li>';
    return;
  }
  topUrls.forEach(({ url, title, visitCount }, i) => {
    const display = title || url;
    const li = document.createElement('li');
    li.className = 'url-row';
    li.innerHTML = `
      <span class="url-rank">${i + 1}</span>
      <div class="url-info">
        <div class="url-title">${escapeHtml(display)}</div>
        <a class="url-href" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>
      </div>
      <span class="url-count">${visitCount}×</span>
    `;
    ul.appendChild(li);
  });
}

function renderSearchQueries(queries) {
  const section = document.getElementById('search-section');
  const ul = document.getElementById('search-queries');
  ul.innerHTML = '';

  if (!queries.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  queries.forEach(({ query, count }) => {
    const li = document.createElement('li');
    li.className = 'query-row';
    li.innerHTML = `
      <span class="query-text">${escapeHtml(query)}</span>
      <span class="query-count">${count}×</span>
    `;
    ul.appendChild(li);
  });
}

function renderFullRoast(lines) {
  const ul = document.getElementById('full-roast');
  ul.innerHTML = '';
  if (!lines.length) {
    ul.innerHTML = '<li style="color:var(--text-muted);padding:8px">Not enough data to roast you. That\'s somehow worse.</li>';
    return;
  }
  lines.forEach(line => {
    const li = document.createElement('li');
    li.className = 'full-roast-item';
    li.textContent = line;
    ul.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Main render ──────────────────────────────────────────────────────────────

async function runReport(days) {
  const elLoading = document.getElementById('report-loading');
  const elContent = document.getElementById('report-content');
  const elEmpty   = document.getElementById('report-empty');

  elContent.classList.add('hidden');
  elEmpty.classList.add('hidden');
  elLoading.classList.remove('hidden');

  const { getVisits, computeAllMetrics } = window.analyzeHistory;
  const { pickArchetype, buildRoast } = window.roastEngine;

  try {
    const { items, visits } = await getVisits(days, 500, true);

    if (!items.length && !visits.length) {
      elLoading.classList.add('hidden');
      elEmpty.classList.remove('hidden');
      return;
    }

    const metrics = computeAllMetrics(items, visits);
    const archetype = pickArchetype(metrics);
    const roastLines = buildRoast(metrics, archetype.id);

    document.getElementById('report-archetype-title').textContent = archetype.title;
    document.getElementById('report-blurb').textContent = archetype.blurb;

    renderHourChart(metrics.hourHistogram, metrics.peakHour);
    renderStatCards(metrics);
    renderDomainList(metrics.topDomains);
    renderUrlList(metrics.topRevisitedUrls);
    renderSearchQueries(metrics.searchQueries);
    renderFullRoast(roastLines);

    elLoading.classList.add('hidden');
    elContent.classList.remove('hidden');
  } catch (err) {
    console.error('History Roaster report error:', err);
    elLoading.classList.add('hidden');
    elEmpty.classList.remove('hidden');
  }
}

// ─── Time window selector ─────────────────────────────────────────────────────

document.getElementById('window-selector').addEventListener('click', e => {
  const btn = e.target.closest('[data-days]');
  if (!btn) return;
  document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  runReport(parseInt(btn.dataset.days, 10));
});

// Initial load (30 days default)
runReport(30);
