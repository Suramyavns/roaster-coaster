// popup.js — lite-tier analysis, renders archetype + top 3 roast lines

(async () => {
  const { getVisits, computeLiteMetrics } = window.analyzeHistory;
  const { pickArchetype, buildRoast } = window.roastEngine;

  const elLoading = document.getElementById('loading');
  const elContent = document.getElementById('content');
  const elEmpty   = document.getElementById('empty');
  const elError   = document.getElementById('error');

  function showError(err) {
    console.error('[HistoryRoaster] popup error:', err);
    elLoading.classList.add('hidden');
    elError.classList.remove('hidden');
    document.getElementById('error-msg').textContent = String(err);
  }

  try {
    const { items } = await getVisits(30, 500, false);

    if (!items.length) {
      elLoading.classList.add('hidden');
      elEmpty.classList.remove('hidden');
      return;
    }

    const metrics = computeLiteMetrics(items);
    const archetype = pickArchetype(metrics);
    const roastLines = buildRoast(metrics, archetype.id);

    document.getElementById('archetype-title').textContent = archetype.title;
    document.getElementById('archetype-blurb').textContent  = archetype.blurb;

    const ul = document.getElementById('roast-lines');
    roastLines.slice(0, 3).forEach(line => {
      const li = document.createElement('li');
      li.className = 'roast-line';
      li.textContent = line;
      ul.appendChild(li);
    });

    elLoading.classList.add('hidden');
    elContent.classList.remove('hidden');
  } catch (err) {
    showError(err);
  }
})();
