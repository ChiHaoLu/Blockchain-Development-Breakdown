# Blockchain Development Breakdown

A [Fumadocs](https://fumadocs.dev) site that collects four mdBook notes in one place:

| Book | Content dir | Original |
| --- | --- | --- |
| Cryptography & ZKP | `content/docs/cryptography-and-zkp` | https://cryptography-and-zkp.web.app |
| DeFi Development Breakdown | `content/docs/defi-development-breakdown` | https://defi-development-breakdown.web.app |
| Ethereum Scalability Solution | `content/docs/ethereum-layer2` | https://ethereum-layer2.web.app |
| Smart Contract Security & Foundry Testing | `content/docs/contract-security` | https://contract-security.web.app |

## Development

```bash
npm install
npm run dev
```

Sidebar order for each folder lives in its `meta.json`. Each book is a root folder (`"root": true`), so it shows up as its own tab in the sidebar.

## Deployment

`.github/workflows/ci.yml` type-checks and builds every push and pull request.
`.github/workflows/deploy.yml` builds the static export and publishes it to GitHub Pages on every push to `main`.
