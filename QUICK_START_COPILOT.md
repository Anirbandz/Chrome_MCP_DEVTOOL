# 🎯 Quick Start Guide - Chrome DevTools MCP Performance Testing

## For Copilot / AI Assistant Usage

This guide is designed for Copilot or other AI assistants to understand how to set up and use this performance testing suite.

---

## 📌 What This Tool Does

This is an **automated performance testing framework** that:

1. ✅ Connects to any website/URL provided by the user
2. ✅ Measures performance metrics (LCP, CLS, TTFB, etc.)
3. ✅ Records detailed Chrome trace files
4. ✅ Generates professional performance reports
5. ✅ Provides optimization recommendations
6. ✅ Works on any machine with Node.js installed

---

## 🚀 Setup on New Machine (5 Minutes)

### For Copilot/AI Assistant:

When a user provides this project on a new machine, follow these exact steps:

```bash
# Step 1: Verify prerequisites
node --version      # Should be >= v20.19.0
npm --version       # Should be >= 9.0.0

# Step 2: Navigate to project
cd chrome-devtools-mcp-main

# Step 3: Install dependencies
npm install

# Step 4: Install Chrome
npx puppeteer browsers install chrome

# Step 5: Build project
npm run build

# Step 6: Make scripts executable
chmod +x run_universal_perf_test.sh
chmod +x run_mcp_perf_complete.sh

# Step 7: Verify setup
ls -la build/src/  # Should show .js files
```

**Expected time:** 5-10 minutes

---

## 📊 Running Performance Tests

### User Provides a URL

When the user gives you a URL to test, follow this pattern:

```bash
# Format: ./run_universal_perf_test.sh "URL_PROVIDED_BY_USER"

# Example usage:
./run_universal_perf_test.sh "https://example.com"
./run_universal_perf_test.sh "https://github.com"
./run_universal_perf_test.sh "https://petstore.octoperf.com/actions/Catalog.action"
```

**The script automatically:**
- Builds the project
- Runs the test with visible Chrome browser
- Generates comprehensive report
- Saves results in timestamped folder
- Creates performance metrics and traces

---

## 📋 Universal Test Script Usage

The main script: `run_universal_perf_test.sh`

### What It Does:

```
User provides URL
    ↓
Script validates Node.js
    ↓
Script builds project
    ↓
Script launches Chrome (visible)
    ↓
Script collects performance metrics
    ↓
Script generates report
    ↓
Results saved to: performance_reports/TIMESTAMP/
```

### Output Files Created:

```
performance_reports/20251112_192440/
├── performance_report_domain.md    ← Main report (READ THIS)
├── report.json                     ← Raw data
├── homepage.trace.json             ← Performance trace
├── homepage.metrics.json           ← Metrics data
├── test_output.log                 ← Execution log
└── [other trace/metrics files]
```

---

## 🎯 Copilot Instructions

### When User Says: "Test this URL"

1. **Extract the URL** from user's request
2. **Run this command:**
   ```bash
   ./run_universal_perf_test.sh "USER_PROVIDED_URL"
   ```
3. **Wait for completion** (~2-5 minutes depending on URL)
4. **Read the generated report:**
   ```bash
   cat performance_reports/*/performance_report_*.md
   ```
5. **Provide summary** to user with:
   - Core Web Vitals (LCP, CLS, TTFB)
   - Performance grade
   - Optimization recommendations
   - Result file location

### When User Says: "Run test on Google"

```bash
./run_universal_perf_test.sh "https://google.com"
# Wait for completion
# Read and summarize report
```

### When User Says: "Test our company website"

```bash
./run_universal_perf_test.sh "https://company-website.com"
# Same process as above
```

---

## 📈 Understanding the Results

### Performance Report Structure

The generated markdown report includes:

1. **Core Web Vitals Summary**
   - LCP (Largest Contentful Paint) - Target: < 2500ms
   - CLS (Cumulative Layout Shift) - Target: < 0.1
   - TTFB (Time to First Byte) - Target: < 600ms

2. **Performance Analysis**
   - Step-by-step metrics for each page load
   - Issues identified
   - Recommendations provided

3. **Optimization Opportunities**
   - High priority items
   - Medium priority items
   - Low priority items

---

## 🔧 Troubleshooting for Copilot

### Issue: "Node.js not found"
**Solution:**
```bash
node --version  # If error, install Node.js from nodejs.org
npm install     # Reinstall after Node.js install
npm run build
```

### Issue: "Chrome not found"
**Solution:**
```bash
npx puppeteer browsers install chrome
```

### Issue: "Build fails"
**Solution:**
```bash
npm run clean
npm install
npm run build
```

### Issue: "Test times out"
**Solution:**
```bash
# Website might be slow. This is normal.
# Check the generated report anyway - it will still have data
# Or try a different URL to verify setup works
./run_universal_perf_test.sh "https://google.com"
```

---

## 📚 Key Commands Copilot Should Know

```bash
# Setup (run once per machine)
npm install
npx puppeteer browsers install chrome
npm run build
chmod +x run_universal_perf_test.sh

# Run test on any URL
./run_universal_perf_test.sh "USER_URL"

# View results
cat performance_reports/*/performance_report_*.md

# View raw data
cat performance_reports/*/report.json | jq

# Analyze traces (in Chrome DevTools)
# - Press F12
# - Go to Performance tab
# - Click Upload
# - Select .trace.json file from results
```

---

## 💾 File Structure Reference

```
chrome-devtools-mcp-main/
│
├── run_universal_perf_test.sh      ← MAIN SCRIPT (run this with URL)
├── SETUP_AND_COMMANDS.md            ← Full reference guide
├── QUICK_START_COPILOT.md           ← This file
│
├── scripts/
│   ├── run_perf_reload.mjs          ← Core test script
│   └── markdown_report.mjs          ← Report generator
│
├── src/
│   └── [source TypeScript files]
│
├── build/
│   └── src/
│       └── [compiled JavaScript files]
│
└── performance_reports/
    ├── 20251112_192440/             ← Timestamped results
    ├── 20251112_191703/
    └── [previous test results]
```

---

## 🎯 Typical Interaction Pattern

### Example: User wants to test GitHub

```
User: "Can you test the performance of https://github.com?"

Copilot:
1. ✓ Acknowledge: "I'll test GitHub's performance for you."
2. ✓ Run: ./run_universal_perf_test.sh "https://github.com"
3. ✓ Wait for results (2-3 minutes)
4. ✓ Read: cat performance_reports/*/performance_report_github.md
5. ✓ Summarize with:
   - LCP: 450ms ✅ Excellent
   - CLS: 0.00 ✅ Perfect
   - TTFB: 200ms ✅ Good
   - Recommendations: [list key items]
   - Full report: performance_reports/20251112_192440/
```

---

## 📊 Test Results Interpretation

### Performance Grades

| LCP | CLS | TTFB | Grade | Status |
|-----|-----|------|-------|--------|
| <1s | <0.05 | <100ms | A+ | Excellent |
| <1.5s | <0.075 | <200ms | A | Very Good |
| <2.5s | <0.1 | <600ms | B | Good |
| <4s | <0.15 | <1s | C | Fair |
| >4s | >0.15 | >1s | D | Poor |

---

## 🔄 Continuous Testing Pattern

For users who want multiple tests:

```bash
# Test 1
./run_universal_perf_test.sh "https://site1.com"
# Results: performance_reports/TIMESTAMP1/

# Test 2
./run_universal_perf_test.sh "https://site2.com"
# Results: performance_reports/TIMESTAMP2/

# Compare results
cat performance_reports/TIMESTAMP1/report.json | jq '.[0].metrics'
cat performance_reports/TIMESTAMP2/report.json | jq '.[0].metrics'
```

---

## 📖 Documentation Files

For different use cases, refer to these files:

| File | Purpose | Audience |
|------|---------|----------|
| **QUICK_START_COPILOT.md** | This file - AI Assistant guide | Copilot |
| **SETUP_AND_COMMANDS.md** | Complete command reference | Developers |
| **PERFORMANCE_TESTING_GUIDE.md** | In-depth technical guide | Engineers |
| **TEST_COMPLETION_REPORT.md** | Latest test summary | Everyone |
| **README_PERFORMANCE_TEST.md** | Project overview | Everyone |

---

## ✨ Key Points for Copilot

### Always Remember:

1. ✅ **URL is flexible** - Any valid URL can be tested
2. ✅ **Script is automated** - Just provide URL to `run_universal_perf_test.sh`
3. ✅ **Results are timestamped** - Each run creates new folder
4. ✅ **Reports are generated** - Always check `performance_report_*.md`
5. ✅ **Setup is one-time** - Only run setup once per machine

### Standard Workflow:

```
1. User provides URL
   ↓
2. Run: ./run_universal_perf_test.sh "URL"
   ↓
3. Wait 2-5 minutes for completion
   ↓
4. Read: cat performance_reports/*/performance_report_*.md
   ↓
5. Summarize key metrics for user
   ↓
6. Provide optimization suggestions
   ↓
7. Offer to test other URLs if needed
```

---

## 🎓 Teaching Users

When explaining to users:

```
"I've run a performance test on [URL]. Here's what it means:

📊 Performance Metrics:
- LCP: [value]ms ([grade]) - How fast large content loads
- CLS: [value] ([grade]) - How stable the page is (no jumping)
- TTFB: [value]ms ([grade]) - How fast server responds

✅ Strengths:
- [Good metric 1]
- [Good metric 2]

🔧 Improvements:
- [Issue 1 - Impact, Recommendation]
- [Issue 2 - Impact, Recommendation]

📁 Full Report: performance_reports/[timestamp]/performance_report_*.md"
```

---

## 🚀 Advanced Commands (If Needed)

```bash
# Rebuild project
npm run build

# Run tests without visible browser (faster)
node scripts/run_perf_reload.mjs "URL"

# Generate report from existing data
node scripts/markdown_report.mjs out/report.json

# View specific metrics
cat performance_reports/*/report.json | jq '.[0].metrics'

# Check Node.js version
node --version

# Update dependencies
npm update

# Clean cache
npm run clean
```

---

## ✅ Pre-Test Checklist

Before running test, Copilot should verify:

- [ ] Node.js is installed: `node --version` (should be >= v20.19.0)
- [ ] npm is available: `npm --version`
- [ ] Project is built: `ls build/src/` (should have .js files)
- [ ] Script is executable: `ls -la run_universal_perf_test.sh`
- [ ] Chrome is available: `npx puppeteer browsers install chrome`
- [ ] User has provided URL to test
- [ ] Internet connection is available

---

## 📞 Quick Help

If Copilot gets stuck:

1. **Check logs:** `tail -f performance_reports/*/test_output.log`
2. **Verify setup:** `npm run build && echo "Build OK"`
3. **Test with known URL:** `./run_universal_perf_test.sh "https://google.com"`
4. **Read guide:** `cat SETUP_AND_COMMANDS.md`

---

## 🎉 Success Indicators

You've successfully completed a test when:

1. ✅ No errors in output
2. ✅ `performance_reports/TIMESTAMP/` folder created
3. ✅ `performance_report_*.md` file exists
4. ✅ Report contains metrics (LCP, CLS, TTFB)
5. ✅ Results are positive or actionable

---

**Version:** 1.0  
**Framework:** Chrome DevTools MCP  
**Last Updated:** November 2025  
**Status:** ✅ Ready for Production Use
