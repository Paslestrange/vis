# Vis

An alternative web UI for [OpenCode](https://github.com/sst/opencode), designed for daily use. It connects to a running OpenCode instance and provides a browser-based, window-style interface for managing sessions, viewing tool output, and interacting with AI agents in real time.

![Demo](docs/demo.gif)

## Features

- **Review-first floating windows** that keep tool output and agent reasoning in context
- Session management with **multi-project and worktree** support
- Syntax-highlighted **code and diff viewers** built for fast, confident review
- Permission and question prompts for interactive agent workflows
- Embedded terminal powered by xterm.js

## How to Use

### Local

Serve the UI locally and then open `http://localhost:3000` in your browser.

Start the UI server:

```bash
pnpm install
pnpm build
node server.js
```

Start the OpenCode API server:

```bash
opencode serve --cors http://localhost:3000
```

Or add this to your `.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "server": {
    "cors": ["http://localhost:3000"]
  }
}
```

and then:

```bash
opencode serve
```

---

## Development

```sh
pnpm install
pnpm dev
```

## License

MIT
