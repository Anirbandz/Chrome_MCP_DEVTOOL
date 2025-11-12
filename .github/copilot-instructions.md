## Quick orientation — Chrome DevTools MCP

This repository implements an MCP (Model-Context-Protocol) server that exposes
Chrome DevTools functionality to MCP clients (Copilot, Gemini, Claude, Cursor,
etc.). The server is written in TypeScript, built to `build/src`, and launched
via the CLI wrapper `npx chrome-devtools-mcp@latest` (or `npm run start`).

Keep this short, actionable, and specific to this codebase.

Core architecture (what matters)
- Entry: `src/index.ts` -> `src/main.ts` (parses CLI, constructs an MCP server).
- MCP glue: `third_party/index.js` (MCP SDK shims/types) and `src/main.ts` where
  tools are registered using `server.registerTool(...)`.
- Tool implementations: `src/tools/*.ts` (each tool exports a ToolDefinition
  with `name`, `schema`, `annotations`, and `handler`). See `src/tools/pages.ts`
  and `src/tools/performance.ts` for examples.
- Browser control & lifecycle: `src/browser.ts` (connects to or launches
  Chrome via Puppeteer). It supports `--wsEndpoint`, `--browserUrl`, or
  launching a new browser using `--channel`, `--executablePath`, `--headless`.
- Runtime context: `src/McpContext.ts` manages pages, snapshots, network and
  console collectors. Use it as the single source of truth for page state.

Key workflows & commands (copyable)
- Build (produces `build/src`):

  npm run build

- Start server (build + run):

  npm run start

- Start with debug logs (writes verbose logs when DEBUG env is set):

  npm run start-debug

- Run tests (note: tests run against the built JS in `build/tests`):

  npm test

- Quick manual run (connect to existing Chrome via WebSocket):

  npx chrome-devtools-mcp@latest --wsEndpoint ws://127.0.0.1:9222/devtools/browser/<id>

Notable runtime details
- Node requirement: >= 20.19 LTS (enforced at startup in `src/index.ts`).
- Chrome: the server either launches Chrome via Puppeteer (pinned in
  package.json) or connects to an existing instance via `--wsEndpoint` or
  `--browserUrl`.
- CLI flags and validation: `src/cli.ts` (use this for acceptable options and
  coercions — e.g., `--wsHeaders` must be a JSON object).
- Logs: `--logFile` writes Puppeteer process stdout/stderr to a file (see
  `src/browser.ts`). For debugging internal flows set `DEBUG=mcp:*`.

Project conventions & patterns to follow
- TypeScript-first: edit `.ts` files in `src/`, run `npm run build` to emit
  JS into `build/src`. Tests operate on built output.
- Post-build pipeline: `npm run build` runs `tsc` then `scripts/post-build.ts`
  (it strips types/adjusts imports). The published CLI uses `build/src/index.js`.
- Tools are objects (ToolDefinition) exported from `src/tools/*`. They are
  registered centrally in `src/main.ts` — follow the same export shape.
- Single-threaded tool handling: a global Mutex serializes tool handlers
  (`src/main.ts`). Tool handlers should be short and rely on `McpContext` to
  perform long-running actions via `waitForEventsAfterAction` where needed.

Integration points and external dependencies
- Puppeteer (launch/connect): `src/browser.ts`. Behavior differs if using
  `--wsEndpoint`/`--browserUrl` (connect) vs launching (channel/executable).
- chrome-devtools-frontend: used to read DevTools UI state (see
  `McpContext.getDevToolsData` which evaluates code inside `devtools://` pages).
- MCP SDK & helper types: `third_party/index.js` (bridges MCP types and
  Stdio transport). Look here for how the MCP server and transport are used.

Examples (useful jump-to locations)
- Registering tools: `src/main.ts` (function `registerTool`) — follow the
  logging, error handling and mutex pattern when adding features.
- Context and page management: `src/McpContext.ts` — page snapshots, network
  collectors, console collectors, and snapshot id conventions are implemented
  here.
- CLI options & validation: `src/cli.ts` (input coercion examples like
  viewport parsing and wsHeaders JSON parsing).

When editing or adding code
- Run `npm run typecheck` and `npm test` after `npm run build`.
- Preserve runtime behavior: tests and publishing rely on compiled output in
  `build/src` and the post-build script — do not change `bin` or the build
  pipeline without updating `scripts/post-build.ts` and `rollup.config.mjs`.

What I couldn't infer (please tell me):
- Any private or infra-specific CI steps, or non-public environment variables
  required for end-to-end CI/browser runs (if you have CI runners for Chrome
  versions, add notes here).

If this looks good I will commit this file. Tell me any gaps or details to add
(for example: CI commands, required Chrome channels for tests, or a local
developer quickstart). 
