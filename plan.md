# BUILD SPEC — Browser History Roaster (Chrome Extension, Manifest V3)

> **Instructions for the implementing model:** Build the complete, installable extension
> described below. Produce every file in §3 with full working code. Follow all constraints
> in §2 exactly. Do not ask clarifying questions — make reasonable choices where the spec
> is silent and note them in code comments. The result must load via `chrome://extensions`
> → "Load unpacked" with zero console errors.

---

## 1. What to build

A Manifest V3 Chrome extension that reads the user's browsing history via the
`chrome.history` API, computes behavioral metrics, and presents a humorous "personality
profile + roast." Clicking the toolbar icon shows a fast summary in a popup; a button opens
a full report page in a new tab. The report is a single page dashboard with multiple analytics based on the browsing history. Everything runs client-side. The tone is an **affectionate,
witty roast** — clever, never cruel, PG-13.

---

## 2. Hard constraints (non-negotiable)

- **Manifest V3** (`"manifest_version": 3`).
- **Vanilla JS, HTML, CSS only.** No frameworks, no TypeScript, no npm, no build step.
  Every file is directly loadable.
- **No remote code.** MV3 CSP forbids it. No CDN `<script>`, no remote fonts. Use a system
  font stack. Any helper code must be inline in the packaged files.
- **No network requests of any kind.** No analytics, no telemetry, no host permissions.
- **Only one permission:** `"history"`. (Opening the report page needs no `"tabs"`
  permission — either a normal `<a href="report.html" target="_blank">` link or
  `chrome.tabs.create(chrome.runtime.getURL("report.html"))` works without it.)
- **In-memory only.** Do not persist anything; no `chrome.storage` in this build.
- Must gracefully handle empty/sparse history.

---

## 3. Deliverables (exact file list)

```
manifest.json        # MV3 manifest, "history" permission, action popup
popup.html           # compact summary UI (~360px wide)
popup.js             # runs the LITE tier, renders archetype + top roast lines
report.html          # full-page report shell
report.js            # runs the FULL analysis, renders all sections
analyze.js           # shared: data fetch, normalization, ALL metric computation
roast.js             # shared: archetype selection + roast-line generation
styles.css           # shared styling for popup + report
icons/icon16.png     # placeholder icons (generate simple solid-color PNGs)
icons/icon48.png
icons/icon128.png
README.md            # install steps, privacy statement, feature list
```

`analyze.js` and `roast.js` are plain scripts shared by both `popup.js` and `report.js`
(load them via `<script>` tags before the page script; expose their functions on `window`
or as globals — no ES modules needed, but ES modules are acceptable if wired correctly).

### manifest.json (use this exactly, adjust only if necessary)

```json
{
  "manifest_version": 3,
  "name": "History Roaster",
  "version": "1.0.0",
  "description": "Reads your browsing history locally and roasts your personality. No data leaves your browser.",
  "permissions": ["history"],
  "action": { "default_popup": "popup.html", "default_icon": "icons/icon48.png" },
  "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
}
```

---

## 4. Data layer (in `analyze.js`)

### 4.1 Fetch + normalize

```
async function getVisits(days = 30, maxUrls = 500) -> { items, visits, windowStartMs }
```

- `windowStartMs = Date.now() - days * 86_400_000`.
- Fetch URL list: `await chrome.history.search({ text: "", startTime: windowStartMs, maxResults: 100000 })`.
  **Must set `maxResults` high** — the default of 100 would silently cap the dataset.
- For the **full tier**, take the top `maxUrls` items by `visitCount`, and for each call
  `await chrome.history.getVisits({ url })`. Run these with `Promise.all`. Note `getVisits`
  returns *all-time* visits, so filter each to `visitTime >= windowStartMs`.
- Normalize every visit to:
  ```
  Visit = { url, domain, title, timestamp: Date, transition: string, visitCount: number }
  ```
  - `domain`: `new URL(url).hostname` with a leading `www.` stripped. Wrap in try/catch and
    **skip** anything that throws (malformed URLs) or whose scheme is `chrome:`,
    `chrome-extension:`, `about:`, `edge:`, or `file:`.
  - `timestamp`: `new Date(visitTime)` (the API gives Unix milliseconds — no epoch math).
  - `transition`: the API string enum (`"link"`, `"typed"`, `"reload"`, `"auto_bookmark"`,
    `"generated"`, `"form_submit"`, `"keyword"`, …).

Return both the raw `items` (for lite-tier metrics that only need `visitCount`/`typedCount`)
and the normalized `visits` array.

### 4.2 Two tiers

- **Lite tier** computes from `items` alone (no `getVisits`) so the popup loads fast.
- **Full tier** adds the normalized `visits` for time-of-day and transition metrics.

---

## 5. Metrics (implement all of these in `analyze.js`)

Each metric returns a small object the UI and roast logic can read. Group as below.

### Lite tier (from `items`)
- **topRevisitedUrls** — items sorted by `visitCount` desc, top 10 `{url, title, visitCount}`.
- **topDomains** — sum `visitCount` per `domain`; top 10 `{domain, total}`.
- **siteYouCantQuit** — the single `domain` with the highest summed `visitCount`.
- **domainDiversity** — count of distinct domains.
- **searchQueries** — for items whose domain is google/bing/duckduckgo, parse the query
  param (`q`, fallback `p`) from the URL; return the top ~10 most frequent search terms.
- **socialSink** — total visits across a `SOCIAL_DOMAINS` set (e.g. twitter/x, instagram,
  reddit, tiktok, facebook, youtube), ranked.
- **shoppingSpiral** — repeat visits across a `RETAIL_DOMAINS` set (e.g. amazon, ebay,
  etsy, aliexpress), ranked.

### Full tier (from `visits`)
- **hourHistogram** — array of 24 counts bucketed by `timestamp.getHours()`.
- **peakHour** — the hour (0–23) with the most visits.
- **nightOwlScore** — fraction of visits with hour in `[0, 4)` (midnight–4am).
- **busiestDay** — day-of-week (0–6 via `getDay()`) with the most visits.
- **sessions** — sort visits by time; start a new session when the gap to the previous
  visit exceeds **30 minutes**. Derive:
  - **longestSession** — session with the most visits (`{count, startTime, endTime}`).
  - **mostCursedSession** — among sessions whose median hour is in `[0, 5)`, the one with
    the most visits.
- **transitionCounts** — count of visits per `transition` type.
- **reloadGoblinScore** — count of `transition === "reload"`.
- **typedVsLinkRatio** — `count(typed) / max(1, count(link))`.

Edge handling: if `visits` is empty, full-tier metrics return safe zeros/nulls and the UI
shows a friendly "not enough history yet" state.

---

## 6. Archetype selection (in `roast.js`)

```
function pickArchetype(metrics) -> { title, blurb }
```

Evaluate conditions in **priority order**; the first match wins. If none match, fall back to
the (deliberately boring) default. Tune thresholds to be reachable on normal histories.

| Priority | Archetype | Trigger (illustrative — tune as needed) |
|----------|-----------|------------------------------------------|
| 1 | **The 2 AM Spelunker** | `nightOwlScore > 0.15` |
| 2 | **The Reload Goblin** | `reloadGoblinScore` in the top decile of total visits |
| 3 | **The Single-Tab Loyalist** | one domain holds >40% of all visits |
| 4 | **The Scatterbrain** | `domainDiversity > 150` over the window |
| 5 | **The Doomscroll Devotee** | `socialSink` total > 30% of all visits |
| 6 | **The Search Bar Whisperer** | `typedVsLinkRatio > 1.5` |
| 7 | **The Retail Therapist** | `shoppingSpiral` total over a threshold |
| — | **The Perfectly Balanced Browser** (fallback) | nothing else fires — and that's the most suspicious profile of all |

The model may rename/add archetypes in the same spirit; keep the priority-cascade structure.

---

## 7. Roast lines (in `roast.js`)

```
function buildRoast(metrics) -> string[]   // ordered list of one-liners
```

A list of rules, each `{ test: (m) => bool, line: (m) => string }`. Include the `Date`/hour
formatting helpers needed for readable output (e.g. "2 AM", "Tuesday"). Generate **at least
12** lines covering the metrics above. Seed examples to match the voice (write more like
these — witty, specific, affectionate):

- Peak hour: *"Your brain peaks at {peakHour}. Unfortunately that's when the rest of us are asleep."*
- Night owl: *"{nightPct}% of your browsing happens after midnight. The owls have started taking notes."*
- Site you can't quit: *"You visited {domain} {n} times. At this point it's not a habit, it's a residence."*
- Reload goblin: *"You hit reload {n} times. The page heard you the first time."*
- Search queries: *"You asked the internet '{query}'. Bold of you to put that in writing."*
- Domain diversity: *"{n} different domains. Focus is a skill and you have heroically avoided it."*
- Longest session: *"Your longest unbroken session was {count} pages. We're calling that one a journey."*

Keep them PG-13 and never genuinely mean.

---

## 8. UI

### popup.html / popup.js (~360px wide)
- On open: run `getVisits(30, 500)` **lite path only** (skip `getVisits` calls for speed —
  compute lite-tier metrics + a quick archetype from what's available), render:
  - the archetype **title** (large), a one-line blurb,
  - the top **3** roast lines,
  - a **"Full roast →"** button/link that opens `report.html` in a new tab.
- Show a brief loading state; if history is empty, show a friendly message.

### report.html / report.js
- On load: run the **full** analysis (`getVisits` included).
- Render, in order:
  1. Archetype title + blurb (hero).
  2. **Hour-of-day bar chart** — pure CSS/`div` bars (no chart library), 24 bars, peak hour highlighted.
  3. Stat cards: top domains, top revisited URLs, domain diversity, social sink, busiest day, longest session.
  4. "What you asked the internet" — the search-query list.
  5. The full roast list.
- A **time-window selector** (7 / 30 / 90 / 365 days) that re-runs the analysis.
- Optional stretch: a "Save as image" button — only if implementable **without** a remote
  library; otherwise omit and let the user screenshot.

---

## 9. Styling (`styles.css`)

- Self-contained; system font stack only (e.g. `-apple-system, Segoe UI, Roboto, sans-serif`),
  no remote fonts.
- Playful but clean: a dark card-based layout, a large expressive archetype headline, subtle
  accent color, monospace for numbers/stats. Make the bar chart legible at a glance.
- Popup and report share the stylesheet; scope where needed.

---

## 10. Definition of done

- Loads unpacked with **no console errors** in popup or report.
- Clicking the toolbar icon shows an archetype + roast lines within ~1 second.
- The full report opens in a tab and renders every §8 section with the user's real data.
- Changing the time window re-computes and re-renders.
- DevTools Network tab shows **zero** outgoing requests.
- Works on a history with at least the last 30 days of activity, and degrades gracefully on
  an almost-empty history.

---

## 11. Do NOT

- Do not add remote scripts, fonts, CDNs, or any network call.
- Do not request permissions beyond `"history"`.
- Do not use frameworks, bundlers, or a build step.
- Do not claim or attempt dwell-time / "time spent on page" metrics — the history API does
  not expose visit duration.
- Do not persist user data anywhere.
```