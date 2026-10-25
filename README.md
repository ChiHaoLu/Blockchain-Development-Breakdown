# Blockchain Development Breakdown

## Development

```bash
npm install
npm run dev
```

Sidebar order for each folder lives in its `meta.json`. Each book is a root folder (`"root": true`), so it shows up as its own tab in the sidebar.

## Deployment

`.github/workflows/ci.yml` type-checks and builds every push and pull request.
`.github/workflows/deploy.yml` builds the static export and publishes it to GitHub Pages on every push to `main`.
