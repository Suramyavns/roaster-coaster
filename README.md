# History Roaster

A Chrome extension that reads your browsing history locally and gives you an affectionate, witty personality roast. No data ever leaves your browser.

## Features

- **Personality archetype** — one of 8 archetypes based on your browsing patterns (e.g. The 2 AM Spelunker, The Reload Goblin, The Doomscroll Devotee)
- **Roast lines** — generated from your actual stats: peak hour, night owl score, most-visited domain, reload count, search queries, and more
- **Popup** — instant lite summary when you click the toolbar icon
- **Full report page** — hour-of-day bar chart, top domains, most-visited URLs, search queries you've been asking, the full roast list
- **Time window selector** — analyze 7, 30, 90, or 365 days of history
- **Zero network requests** — all computation is in-browser, in-memory only

## Install

1. Clone or download this folder.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.
5. Click the History Roaster icon in your toolbar.

> You will be prompted to grant the `history` permission on first use.

## Icons

Place your own `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png` before loading. Any PNG works; a solid-color square is fine for development.

## Privacy

- **No network requests of any kind.** DevTools → Network will show zero outgoing calls.
- **No storage.** Nothing is written to `chrome.storage`, `localStorage`, or any other persistence layer. All data lives in memory and is gone when you close the popup or tab.
- **Only the `history` permission** is requested — no `tabs`, no `cookies`, no `webRequest`.
- History is fetched locally from Chrome's built-in history database and never transmitted.

Full privacy policy: [https://suramyavns.github.io/roaster-coaster/privacy.html](https://suramyavns.github.io/roaster-coaster/privacy.html)

## File structure

```
manifest.json   MV3 manifest
popup.html/js   Compact summary (lite tier, no getVisits calls)
report.html/js  Full-page report (full tier with per-visit data)
analyze.js      Data fetching, normalization, all metric computation
roast.js        Archetype selection and roast-line generation
styles.css      Shared dark-card styling
icons/          16×16, 48×48, 128×128 PNGs
```
