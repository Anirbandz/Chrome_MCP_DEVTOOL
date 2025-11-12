# How to Set Up Chrome DevTools MCP in Cursor

## Quick Setup Instructions

### Step 1: Start the Chrome DevTools MCP Server

Run this command in your terminal:

```bash
cd "/Users/anirbanganguly/Documents/Coding/Google Dev Tool MCP/chrome-devtools-mcp-main"
chmod +x start-chrome-devtools.sh
./start-chrome-devtools.sh
```

This will:
- Start Chrome with remote debugging enabled
- Start the MCP server connected to that Chrome instance
- Keep running until you press Ctrl+C

**Keep this terminal window open** - the server needs to keep running.

### Step 2: Configure Cursor

1. Open **Cursor Settings**:
   - Press `Cmd + ,` (or go to `Cursor` → `Settings`)

2. Go to **MCP Settings**:
   - Search for "MCP" in settings
   - Or go to `Cursor Settings` → `MCP` → `New MCP Server`

3. Add the Chrome DevTools MCP Server:
   - **Server name:** `chrome-devtools`
   - **Command:** `node`
   - **Args:** 
     ```
     /Users/anirbanganguly/Documents/Coding/Google Dev Tool MCP/chrome-devtools-mcp-main/build/src/index.js
     --browserUrl=http://127.0.0.1:9222
     ```

4. Save the configuration

### Step 3: Test It

In Cursor's chat, try this prompt:

```
Check the performance of https://developers.chrome.com
```

You should see Chrome open and a performance report generated!

## Alternative: Use npx (Easier but requires internet)

If you prefer, you can use the published version instead:

1. In Cursor Settings → MCP → New MCP Server:
   - **Server name:** `chrome-devtools`
   - **Command:** `npx`
   - **Args:** `-y`, `chrome-devtools-mcp@latest`, `--browserUrl=http://127.0.0.1:9222`

2. First, start Chrome with remote debugging:
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile-mcp
   ```

## Troubleshooting

- **Chrome won't start**: Make sure you close all Chrome windows first, then run the script
- **MCP server not connecting**: Make sure the script is still running and Chrome is accessible at http://127.0.0.1:9222
- **Cursor can't find the server**: Check that the path to `build/src/index.js` is correct

## What You Can Do Now

Once set up, you can ask Cursor to:
- "Check the performance of [any website]"
- "Test [website] on mobile with slow 3G"
- "Analyze the network requests for [website]"
- "Take a screenshot of [website]"
- And much more!

