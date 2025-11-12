# 🚀 Chrome DevTools MCP - Setup & Commands

## Quick Setup (5 Minutes)

```bash
# 1. Verify Node.js (>= 20.19)
node --version

# 2. Navigate to project
cd chrome-devtools-mcp-main

# 3. Install dependencies
npm install

# 4. Install Chrome
npx puppeteer browsers install chrome

# 5. Build project
npm run build

# 6. Make scripts executable
chmod +x run_universal_perf_test.sh
```

---

## Running Performance Tests

### Basic Usage
```bash
# Test any URL
./run_universal_perf_test.sh "https://example.com"

# Examples
./run_universal_perf_test.sh "https://google.com"
./run_universal_perf_test.sh "https://github.com"
./run_universal_perf_test.sh "https://petstore.octoperf.com/actions/Catalog.action"
```

### What It Does
- ✅ Validates Node.js environment
- ✅ Builds project automatically
- ✅ Launches Chrome (visible window)
- ✅ Collects performance metrics
- ✅ Generates comprehensive report
- ✅ Saves results in `performance_reports/TIMESTAMP/`

### Output Files
```
performance_reports/20251112_192440/
├── performance_report_domain.md   ← Main report (READ THIS)
├── report.json                    ← Raw metrics data
├── homepage.trace.json            ← Chrome trace
└── homepage.metrics.json          ← Detailed metrics
```

---

## Platform-Specific Setup

### macOS
```bash
brew install node chromium
npm install && npm run build && chmod +x run_universal_perf_test.sh
```

### Ubuntu/Debian
```bash
sudo apt-get install -y nodejs npm chromium
npm install && npm run build && chmod +x run_universal_perf_test.sh
```

### Windows
```bash
# Download Node.js from https://nodejs.org/
npm install && npm run build
```

### CentOS/RHEL
```bash
sudo yum install -y nodejs npm chromium
npm install && npm run build && chmod +x run_universal_perf_test.sh
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Node.js not found | Install from https://nodejs.org/ |
| Chrome not found | `npx puppeteer browsers install chrome` |
| Build fails | `npm run clean && npm install && npm run build` |
| Test times out | Website slow - verify with `https://google.com` |
| Permission denied | `chmod +x run_universal_perf_test.sh` |
| npm install fails | `npm cache clean --force && npm install` |

---

## Core Commands

```bash
# Verify environment
node --version          # Check Node.js version
npm --version           # Check npm version

# Project setup
npm install             # Install dependencies
npm run build           # Build TypeScript to JS
npm run typecheck       # Check for type errors
npm test                # Run tests

# Testing
./run_universal_perf_test.sh "URL"      # Test any URL
node scripts/run_perf_reload.mjs "URL"  # Direct test

# Maintenance
npm run clean           # Clean build artifacts
npm update              # Update dependencies
```

---

## Performance Metrics

| Metric | Target | Meaning |
|--------|--------|---------|
| **LCP** | < 2.5s | Largest content loads |
| **CLS** | < 0.1 | Page stability (no jumping) |
| **TTFB** | < 600ms | Server response time |
| **FCP** | < 1.8s | First content appears |

**Grades:** ✅ A (Excellent) | 🟡 B (Good) | 🔴 C+ (Needs work)

---

## Common Tasks

### Run without visible browser (faster)
```bash
PUPPETEER_HEADLESS=true ./run_universal_perf_test.sh "URL"
```

### Test multiple URLs
```bash
for url in "https://google.com" "https://github.com"; do
  ./run_universal_perf_test.sh "$url"
done
```

### View raw metrics
```bash
cat performance_reports/*/report.json | jq
```

### Extract specific metric
```bash
cat performance_reports/*/report.json | jq '.[0].metrics.lcp'
```

### View latest report
```bash
cat performance_reports/*/performance_report_*.md | head -50
```

---

## Environment Variables

```bash
# Use system Chrome
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Connect to existing Chrome
export PUPPETEER_WS_ENDPOINT="ws://127.0.0.1:9222/..."

# Disable GPU (headless)
export PUPPETEER_ARGS="--no-sandbox --disable-gpu"

# Run headless
export PUPPETEER_HEADLESS=true
```

---

## Automation

### Daily Cron Job (macOS/Linux)
```bash
# Edit crontab
crontab -e

# Add line: Run daily at 9 AM
0 9 * * * cd /path/to/project && ./run_universal_perf_test.sh "https://example.com"
```

### GitHub Actions (CI/CD)
```yaml
name: Performance Tests
on: [push, schedule]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20.19'
      - run: npm install && npm run build
      - run: npx puppeteer browsers install chrome
      - run: ./run_universal_perf_test.sh "https://example.com"
```

---

## File Structure

```
chrome-devtools-mcp-main/
├── run_universal_perf_test.sh     ← Main test script
├── SETUP_AND_COMMANDS.md          ← This guide
├── QUICK_START_COPILOT.md         ← AI Assistant guide
├── src/                           ← TypeScript source
├── build/                         ← Compiled JavaScript
├── scripts/                       ← Helper scripts
└── performance_reports/           ← Test results
```

---

## Verification Checklist

- [ ] Node.js: `node --version` (>= v20.19)
- [ ] npm: `npm --version`
- [ ] Built: `ls build/src/ | grep -c "\.js"`
- [ ] Chrome: `npx puppeteer browsers install chrome`
- [ ] Executable: `ls -la run_universal_perf_test.sh`
- [ ] Test: `./run_universal_perf_test.sh "https://google.com"`

---

## Success Indicators

After running a test:
- ✅ No errors in terminal
- ✅ `performance_reports/TIMESTAMP/` folder created
- ✅ `performance_report_*.md` file exists
- ✅ Report contains LCP, CLS, TTFB metrics
- ✅ JSON trace file generated

---

## Quick Reference

```
FIRST TIME SETUP:
  npm install
  npm run build
  chmod +x run_universal_perf_test.sh

RUN TEST:
  ./run_universal_perf_test.sh "https://url"
  (Wait 2-5 minutes)

VIEW RESULTS:
  cat performance_reports/*/performance_report_*.md
```

---

**Version:** 2.0 (Condensed)  
**Last Updated:** November 2025  
**Status:** ✅ Production Ready
