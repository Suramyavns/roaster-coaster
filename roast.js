// roast.js — archetype selection and roast-line generation

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHour(h) {
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ─── Archetype selection ───────────────────────────────────────────────────────

const ARCHETYPES = [
  // ── Site-specific loyalties (most specific first) ──────────────────────────
  {
    id: 'youtube_captive',
    title: 'The YouTube Captive',
    blurb: 'You came for one video. That was six hours ago. The autoplay is your life coach now and it has strong opinions.',
    test: m => m.topDomains.length > 0 && m.topDomains[0].domain === 'youtube.com'
      && m.totalVisits > 0 && (m.topDomains[0].total / m.totalVisits) > 0.20
  },
  {
    id: 'reddit_ambassador',
    title: 'The Reddit Ambassador',
    blurb: 'You\'ve read ten thousand strangers\' opinions on topics you never knew you cared about. Now you have opinions too. Strong ones.',
    test: m => m.topDomains.length > 0 && m.topDomains[0].domain === 'reddit.com'
  },
  {
    id: 'github_haunter',
    title: 'The GitHub Haunter',
    blurb: 'You\'ve starred 60 repositories you\'ll definitely contribute to someday. The stars accumulate. The PRs do not.',
    test: m => m.topDomains.length > 0 && m.topDomains[0].domain === 'github.com'
  },
  {
    id: 'twitter_correspondent',
    title: 'The Discourse Correspondent',
    blurb: 'You\'re not doomscrolling — you\'re monitoring the cultural conversation. (It\'s doomscrolling.)',
    test: m => m.topDomains.length > 0 && (m.topDomains[0].domain === 'x.com' || m.topDomains[0].domain === 'twitter.com')
  },

  // ── Time-based patterns ────────────────────────────────────────────────────
  {
    id: 'night_owl',
    title: 'The 2 AM Spelunker',
    blurb: 'You treat the internet like a late-night diner — always open, never judging, and mildly questionable at 3 AM.',
    test: m => m.nightOwlScore > 0.15
  },
  {
    id: 'early_bird',
    title: 'The Pre-Coffee Researcher',
    blurb: 'You\'re online before most people are conscious. Whether this is admirable discipline or untreated insomnia remains unclear.',
    test: m => m.peakHour !== null && m.peakHour >= 5 && m.peakHour <= 8
  },
  {
    id: 'lunchtime_lurker',
    title: 'The Lunchtime Escape Artist',
    blurb: 'Every day at noon you open a new tab and briefly remember you have an inner life. Then you open four more tabs.',
    test: m => m.peakHour !== null && m.peakHour >= 11 && m.peakHour <= 14
      && m.busiestDay !== null && m.busiestDay >= 1 && m.busiestDay <= 5
  },
  {
    id: 'weekend_hermit',
    title: 'The Weekend Hermit',
    blurb: 'Saturday and Sunday are sacred. Sacred browsing time. You and the internet have standing plans.',
    test: m => m.busiestDay !== null && (m.busiestDay === 0 || m.busiestDay === 6)
  },

  // ── Session depth ──────────────────────────────────────────────────────────
  {
    id: 'reload_goblin',
    title: 'The Reload Goblin',
    blurb: 'F5 is your love language. You believe in the page — you just believe harder every time you press it.',
    test: m => m.reloadGoblinScore > 0 && m.totalFullVisits > 0
      && (m.reloadGoblinScore / m.totalFullVisits) > 0.05
  },
  {
    id: 'tab_archaeologist',
    title: 'The Tab Archaeologist',
    blurb: 'Your longest session could fill a documentary. You didn\'t browse the internet — you excavated it, layer by layer.',
    test: m => m.longestSession !== null && m.longestSession.count > 50
  },
  {
    id: 'habitual_returner',
    title: 'The Habitual Returner',
    blurb: 'There is one page you cannot stop visiting. It\'s not that good. You go anyway. It has become a ritual.',
    test: m => m.topRevisitedUrls.length > 0 && m.topRevisitedUrls[0].visitCount > 50
  },

  // ── Domain behavior ────────────────────────────────────────────────────────
  {
    id: 'loyalist',
    title: 'The Single-Tab Loyalist',
    blurb: 'Why explore the whole internet when one website already has everything you need? (Spoiler: it doesn\'t.)',
    test: m => m.siteYouCantQuit && m.totalVisits > 0
      && (m.siteYouCantQuit.total / m.totalVisits) > 0.40
  },
  {
    id: 'link_rabbit',
    title: 'The Link Rabbit',
    blurb: 'You clicked your way here from somewhere else entirely. You always do. The URL bar is decorative at this point.',
    test: m => m.totalFullVisits > 30 && m.typedVsLinkRatio < 0.3
  },
  {
    id: 'scatterbrain',
    title: 'The Scatterbrain',
    blurb: 'You\'ve visited more domains than most people have thoughts. Every tab is an adventure. Every adventure is abandoned.',
    test: m => m.domainDiversity > 150
  },

  // ── Content behavior ───────────────────────────────────────────────────────
  {
    id: 'doomscroll',
    title: 'The Doomscroll Devotee',
    blurb: 'You\'re keeping the social media economy running almost single-handedly. The algorithm has named a wing after you.',
    test: m => m.totalVisits > 0 && (m.socialSinkTotal / m.totalVisits) > 0.30
  },
  {
    id: 'research_spiral',
    title: 'The Research Spiral',
    blurb: 'You asked a simple question and three hours later you understand the full geopolitical history of a country you didn\'t know existed.',
    test: m => m.searchQueries.length >= 5 && m.domainDiversity > 80
  },
  {
    id: 'searcher',
    title: 'The Search Bar Whisperer',
    blurb: 'You type your destinations directly. No middlemen, no wandering. You know what you want, you just need the internet to agree.',
    test: m => m.typedVsLinkRatio > 1.5
  },
  {
    id: 'retail_therapist',
    title: 'The Retail Therapist',
    blurb: 'Why go to therapy when the checkout button is right there? Your cart has feelings too. It misses you when you close the tab.',
    test: m => m.shoppingSpiralTotal > 40
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  {
    id: 'default',
    title: 'The Perfectly Balanced Browser',
    blurb: 'Your history is suspiciously moderate. Either you\'re the most well-adjusted person online, or you\'re very good at clearing your history.',
    test: () => true
  }
];

function pickArchetype(metrics) {
  for (const archetype of ARCHETYPES) {
    if (archetype.test(metrics)) {
      return { id: archetype.id, title: archetype.title, blurb: archetype.blurb };
    }
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

// ─── Roast lines ──────────────────────────────────────────────────────────────

const ROAST_RULES = [
  {
    test: m => m.peakHour !== null,
    line: m => `Your browsing peaks at ${formatHour(m.peakHour)}. Your neurons have a schedule — we just don't know why they chose that one.`
  },
  {
    test: m => m.nightOwlScore > 0.05,
    line: m => `${Math.round(m.nightOwlScore * 100)}% of your browsing happens after midnight. The owls have started taking notes.`
  },
  {
    test: m => m.siteYouCantQuit !== null,
    line: m => `You visited ${m.siteYouCantQuit.domain} ${m.siteYouCantQuit.total} times. At this point it's not a habit, it's a residence.`
  },
  {
    suppressFor: ['reload_goblin'],
    test: m => m.reloadGoblinScore > 5,
    line: m => `You hit reload ${m.reloadGoblinScore} times. The page heard you the first time. It just needed a moment.`
  },
  {
    test: m => m.searchQueries.length > 0,
    line: m => `You asked the internet "${m.searchQueries[0].query}". Bold of you to put that in writing.`
  },
  {
    test: m => m.searchQueries.length > 1,
    line: m => `Also: "${m.searchQueries[1].query}". The internet is not judging you. We are, but the internet isn't.`
  },
  {
    test: m => m.domainDiversity > 50,
    line: m => `${m.domainDiversity} different domains in the window. Focus is a skill and you have heroically avoided it.`
  },
  {
    test: m => m.longestSession !== null && m.longestSession.count > 10,
    line: m => `Your longest unbroken session was ${m.longestSession.count} pages. We're calling that one a journey. Scholars will debate its purpose.`
  },
  {
    test: m => m.socialSinkTotal > 20,
    line: m => `${m.socialSinkTotal} visits to social media. The algorithm didn't radicalize you — it domesticated you.`
  },
  {
    test: m => m.socialSinkRanked.length > 0,
    line: m => `${m.socialSinkRanked[0].domain} alone got ${m.socialSinkRanked[0].total} visits. It knows more about you than your doctor does.`
  },
  {
    test: m => m.shoppingSpiralTotal > 10,
    line: m => `${m.shoppingSpiralTotal} shopping site visits. Your wallet has filed a restraining order application.`
  },
  {
    test: m => m.typedVsLinkRatio > 2,
    line: m => `You type ${m.typedVsLinkRatio.toFixed(1)}x more than you click links. You're either a power user or you've never heard of bookmarks.`
  },
  {
    test: m => m.busiestDay !== null,
    line: m => `${DAYS[m.busiestDay]} is your most active browsing day. Rest of the week is clearly just loading time.`
  },
  {
    test: m => m.mostCursedSession !== null,
    line: m => `You have a late-night browsing session with ${m.mostCursedSession.count} pages. We didn't look at what they were. You're welcome.`
  },
  {
    test: m => m.topRevisitedUrls.length > 0 && m.topRevisitedUrls[0].visitCount > 20,
    line: m => {
      const top = m.topRevisitedUrls[0];
      const title = top.title || top.url;
      const short = title.length > 50 ? title.slice(0, 47) + '…' : title;
      return `"${short}" — ${top.visitCount} visits. That page didn't ask for this relationship but here we are.`;
    }
  },
  {
    test: m => m.totalVisits > 1000,
    line: m => `${m.totalVisits} total page visits this period. The internet is starting to recognize your knock.`
  },
  {
    test: m => m.domainDiversity < 10 && m.totalVisits > 50,
    line: m => `Only ${m.domainDiversity} unique domains. You've found your corner of the internet and you're staying there.`
  },
  {
    test: m => m.topDomains.length >= 2,
    line: m => `Your top two domains — ${m.topDomains[0].domain} and ${m.topDomains[1].domain} — account for most of your personality at this point.`
  }
];

function buildRoast(metrics, archetypeId) {
  return ROAST_RULES
    .filter(rule => !rule.suppressFor?.includes(archetypeId) && rule.test(metrics))
    .map(rule => rule.line(metrics));
}

window.roastEngine = { pickArchetype, buildRoast };
