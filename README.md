# Namma Seva

Government scheme eligibility assistant.

A static web app (no build step). Open `index.html` with VS Code's Live Server extension.

- `index.html`  page structure (form, chat panel, results area)
- `styles.css`  design tokens (light and dark) and layout
- `app.js`      scheme data, eligibility rules, results rendering, chat flow

Scheme data lives in the `S` array in `app.js`. Each scheme has `rules` that return
true, false, null (needs an answer) or "maybe" (depends on official records).
Always confirm rules against the official portal before publishing changes.
