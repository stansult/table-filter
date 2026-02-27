# Table Filter (Chrome Extension)

**Table Filter** is a Chrome extension for filtering table rows directly on the current page.

Current first feature:
- Hide rows where a specific column has a specific value.

## How It Works

- Click the extension icon to open the in-page Table Filter panel.
- Select which table to target.
- Select which column to evaluate.
- Enter a value.
- Rows with an exact (case-insensitive) match in that column are hidden.
- Use `Clear` to reset hidden rows.

## Current Scope

- Works on pages that contain one or more HTML `<table>` elements.
- Supports multiple tables on the same page.
- This is the first step toward broader table filtering/sorting features.

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

- This project focuses on user-triggered, in-browser table filtering.
- Privacy policy: [`PRIVACY.md`](PRIVACY.md)
