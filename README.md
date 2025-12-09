# Tezos Bank Machine

An ATM-style web interface for interacting with TezosX MCP spending contracts.

## Features

- View bank (contract) and client (spender) balances
- Withdraw funds within spending limits
- View transaction history
- See daily limits, per-transaction limits, and remaining allowance

## How It Works

This app connects to a deployed [TezosX MCP](https://github.com/anthropics/TezosX-mcp) server via a Netlify Function proxy. The MCP server handles all Tezos blockchain interactions.

## Deployment

### Deploy to Netlify

1. Fork or clone this repository
2. Connect to Netlify (via Git or drag-and-drop)
3. Netlify will auto-detect settings from `netlify.toml`
4. Deploy!

### Configuration

Edit `netlify/functions/mcp-proxy.js` to point to your MCP server:

```js
const MCP_SERVER_URL = 'https://your-mcp-server.up.railway.app/mcp';
```

## Local Development

```bash
npm install
npm run dev
```

Note: Local development may have CORS issues when calling the MCP server directly.

## Architecture

```
Browser → Netlify Function (proxy) → Railway MCP Server → Tezos Blockchain
```

The Netlify Function proxies requests to avoid CORS restrictions.

## Tech Stack

- Vanilla JS (no framework)
- Vite (build tool)
- Netlify Functions (serverless proxy)
- TezosX MCP (backend)
