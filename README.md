# Table Filter (Chrome Extension)

**Table Filter** is a Chrome extension that takes over a page table locally after activation, scans all rows, and lets you filter and sort the resulting table in-browser.

Current implementation:
- Scans virtualized table rows into a local cache.
- Rebuilds the table as a local, fully visible result set.
- Adds local controls for text search, status filtering, and numeric `Unwatched` filtering.
- Adds local sorting for all visible columns except `Image`.
- Keeps a `Rescan` action to rebuild from the current page state.

## How It Works

- Configure visible columns on the page first (if the site supports that).
- Click the extension icon.
- Table Filter scans the full current table and builds a local copy.
- While active, the extension replaces the page's filter controls with local controls.
- Use local text search, multi-select `Status`, and numeric `Unwatched` filter controls.
- Sort any visible non-image column using the local header controls.
- Use `Rescan` to rebuild from the page's current dataset.

## Current Scope

- Currently tuned for sites that render data in HTML tables, including virtualized tables.
- Current target workflow has been refined around `trackseries.tv/myshows`.
- Column layout is fixed for the active session based on the columns visible when the extension is activated.

## How to Install

### Development mode

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project folder.

## Packaging

- Create upload zip: `npm run package`
- Bump patch + package: `npm run package:patch`

## Notes

- Table data is processed locally in your browser.
- While active, Table Filter owns the visible table view for the current session.
- To change the source column layout, turn the extension off, adjust the site's own column/view controls, then activate Table Filter again.
- Privacy policy: [`PRIVACY.md`](PRIVACY.md)
