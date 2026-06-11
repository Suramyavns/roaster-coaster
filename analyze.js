// analyze.js — data fetch, normalization, and all metric computation

const SOCIAL_DOMAINS = new Set([
  'twitter.com', 'x.com', 'instagram.com', 'reddit.com', 'tiktok.com',
  'facebook.com', 'youtube.com', 'linkedin.com', 'snapchat.com', 'pinterest.com',
  'threads.net', 'tumblr.com', 'mastodon.social'
]);

const RETAIL_DOMAINS = new Set([
  'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.in', 'amazon.de',
  'ebay.com', 'etsy.com', 'aliexpress.com', 'walmart.com', 'target.com',
  'bestbuy.com', 'shopify.com', 'shop.app', 'wayfair.com', 'newegg.com',
  'bhphotovideo.com', 'zara.com', 'asos.com', 'wish.com', 'shein.com'
]);

const SEARCH_DOMAINS = new Set(['google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'ecosia.org', 'brave.com']);
const SKIP_SCHEMES = new Set(['chrome:', 'chrome-extension:', 'about:', 'edge:', 'file:']);

function normalizeDomain(url) {
  try {
    const u = new URL(url);
    if (SKIP_SCHEMES.has(u.protocol)) return null;
    return u.hostname.replace(/^www\./, '');
  } catch (_) {
    return null;
  }
}

async function getVisits(days = 30, maxUrls = 500, fullTier = false) {
  const windowStartMs = Date.now() - days * 86_400_000;

  const rawItems = await chrome.history.search({
    text: '',
    startTime: windowStartMs,
    maxResults: 100000
  });

  console.log(`[HistoryRoaster] chrome.history.search returned ${rawItems.length} raw items (${days}-day window)`);

  // Normalize items, skipping invalid URLs
  const normalizedItems = rawItems
    .map(item => {
      const domain = normalizeDomain(item.url);
      if (!domain) return null;
      return { ...item, domain };
    })
    .filter(Boolean);

  console.log(`[HistoryRoaster] ${normalizedItems.length} items after filtering internal URLs`);

  if (!fullTier) {
    return { items: normalizedItems, visits: [], windowStartMs };
  }

  // Full tier: fetch per-visit data for top maxUrls by visitCount
  const topItems = [...normalizedItems]
    .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
    .slice(0, maxUrls);

  const visitArrays = await Promise.all(
    topItems.map(item => chrome.history.getVisits({ url: item.url }))
  );

  const visits = [];
  topItems.forEach((item, i) => {
    for (const v of visitArrays[i]) {
      if (v.visitTime < windowStartMs) continue;
      visits.push({
        url: item.url,
        domain: item.domain,
        title: item.title || '',
        timestamp: new Date(v.visitTime),
        transition: v.transition || 'unknown',
        visitCount: item.visitCount || 0
      });
    }
  });

  visits.sort((a, b) => a.timestamp - b.timestamp);

  return { items: normalizedItems, visits, windowStartMs };
}

// ─── Lite-tier metrics (from items) ───────────────────────────────────────────

function computeLiteMetrics(items) {
  if (!items.length) return emptyLiteMetrics();

  // Domain visit counts
  const domainMap = new Map();
  for (const item of items) {
    const cur = domainMap.get(item.domain) || 0;
    domainMap.set(item.domain, cur + (item.visitCount || 1));
  }

  const totalVisits = [...domainMap.values()].reduce((a, b) => a + b, 0);

  const topDomains = [...domainMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, total]) => ({ domain, total }));

  const siteYouCantQuit = topDomains[0] || null;

  const topRevisitedUrls = [...items]
    .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
    .slice(0, 10)
    .map(({ url, title, visitCount }) => ({ url, title, visitCount }));

  const domainDiversity = domainMap.size;

  // Search queries
  const queryFreq = new Map();
  for (const item of items) {
    if (!SEARCH_DOMAINS.has(item.domain)) continue;
    try {
      const u = new URL(item.url);
      const q = u.searchParams.get('q') || u.searchParams.get('p') || u.searchParams.get('query');
      if (!q || q.trim().length < 2) continue;
      const term = q.trim().toLowerCase();
      queryFreq.set(term, (queryFreq.get(term) || 0) + 1);
    } catch (_) { /* skip */ }
  }
  const searchQueries = [...queryFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  // Social sink
  const socialMap = new Map();
  for (const item of items) {
    if (!SOCIAL_DOMAINS.has(item.domain)) continue;
    socialMap.set(item.domain, (socialMap.get(item.domain) || 0) + (item.visitCount || 1));
  }
  const socialSinkRanked = [...socialMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([domain, total]) => ({ domain, total }));
  const socialSinkTotal = socialSinkRanked.reduce((a, b) => a + b.total, 0);

  // Shopping spiral
  const retailMap = new Map();
  for (const item of items) {
    if (!RETAIL_DOMAINS.has(item.domain)) continue;
    retailMap.set(item.domain, (retailMap.get(item.domain) || 0) + (item.visitCount || 1));
  }
  const shoppingSpiralRanked = [...retailMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([domain, total]) => ({ domain, total }));
  const shoppingSpiralTotal = shoppingSpiralRanked.reduce((a, b) => a + b.total, 0);

  return {
    // lite-tier fields
    topRevisitedUrls,
    topDomains,
    siteYouCantQuit,
    domainDiversity,
    searchQueries,
    socialSinkRanked,
    socialSinkTotal,
    shoppingSpiralRanked,
    shoppingSpiralTotal,
    totalVisits,
    // full-tier fields stubbed to safe defaults so roast rules work on lite metrics
    hourHistogram: new Array(24).fill(0),
    peakHour: null,
    nightOwlScore: 0,
    busiestDay: null,
    longestSession: null,
    mostCursedSession: null,
    transitionCounts: {},
    reloadGoblinScore: 0,
    typedVsLinkRatio: 0,
    totalFullVisits: 0
  };
}

function emptyLiteMetrics() {
  return {
    topRevisitedUrls: [],
    topDomains: [],
    siteYouCantQuit: null,
    domainDiversity: 0,
    searchQueries: [],
    socialSinkRanked: [],
    socialSinkTotal: 0,
    shoppingSpiralRanked: [],
    shoppingSpiralTotal: 0,
    totalVisits: 0,
    hourHistogram: new Array(24).fill(0),
    peakHour: null,
    nightOwlScore: 0,
    busiestDay: null,
    longestSession: null,
    mostCursedSession: null,
    transitionCounts: {},
    reloadGoblinScore: 0,
    typedVsLinkRatio: 0,
    totalFullVisits: 0
  };
}

// ─── Full-tier metrics (from visits) ──────────────────────────────────────────

function computeFullMetrics(visits) {
  if (!visits.length) return emptyFullMetrics();

  // Hour histogram
  const hourHistogram = new Array(24).fill(0);
  for (const v of visits) {
    hourHistogram[v.timestamp.getHours()]++;
  }
  const peakHour = hourHistogram.indexOf(Math.max(...hourHistogram));

  const nightVisits = visits.filter(v => v.timestamp.getHours() < 4).length;
  const nightOwlScore = nightVisits / visits.length;

  // Busiest day
  const dayCount = new Array(7).fill(0);
  for (const v of visits) dayCount[v.timestamp.getDay()]++;
  const busiestDay = dayCount.indexOf(Math.max(...dayCount));

  // Sessions (30-min gap)
  const sessions = [];
  let current = [visits[0]];
  for (let i = 1; i < visits.length; i++) {
    const gap = visits[i].timestamp - visits[i - 1].timestamp;
    if (gap > 30 * 60 * 1000) {
      sessions.push(current);
      current = [visits[i]];
    } else {
      current.push(visits[i]);
    }
  }
  sessions.push(current);

  const toSessionObj = s => ({
    count: s.length,
    startTime: s[0].timestamp,
    endTime: s[s.length - 1].timestamp
  });

  const longestSession = sessions
    .map(toSessionObj)
    .sort((a, b) => b.count - a.count)[0] || null;

  const cursedSessions = sessions.filter(s => {
    const hours = s.map(v => v.timestamp.getHours());
    hours.sort((a, b) => a - b);
    const mid = hours[Math.floor(hours.length / 2)];
    return mid < 5;
  });
  const mostCursedSession = cursedSessions.length
    ? cursedSessions.map(toSessionObj).sort((a, b) => b.count - a.count)[0]
    : null;

  // Transition counts
  const transitionCounts = {};
  for (const v of visits) {
    transitionCounts[v.transition] = (transitionCounts[v.transition] || 0) + 1;
  }

  const reloadGoblinScore = transitionCounts['reload'] || 0;
  const typedCount = transitionCounts['typed'] || 0;
  const linkCount = transitionCounts['link'] || 0;
  const typedVsLinkRatio = typedCount / Math.max(1, linkCount);

  return {
    hourHistogram,
    peakHour,
    nightOwlScore,
    busiestDay,
    longestSession,
    mostCursedSession,
    transitionCounts,
    reloadGoblinScore,
    typedVsLinkRatio,
    totalFullVisits: visits.length
  };
}

function emptyFullMetrics() {
  return {
    hourHistogram: new Array(24).fill(0),
    peakHour: null,
    nightOwlScore: 0,
    busiestDay: null,
    longestSession: null,
    mostCursedSession: null,
    transitionCounts: {},
    reloadGoblinScore: 0,
    typedVsLinkRatio: 0,
    totalFullVisits: 0
  };
}

function computeAllMetrics(items, visits) {
  return {
    ...computeLiteMetrics(items),
    ...computeFullMetrics(visits)
  };
}

window.analyzeHistory = { getVisits, computeLiteMetrics, computeFullMetrics, computeAllMetrics };
