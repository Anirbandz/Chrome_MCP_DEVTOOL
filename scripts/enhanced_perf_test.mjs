import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'out');

// Helper function to click elements by text
async function clickByText(page, text) {
    const elements = await page.$x(`//*[contains(text(), '${text}')]`);
    if (elements.length > 0) {
        await elements[0].click();
        return true;
    }
    return false;
}

// Enhanced tracing categories for detailed performance metrics
const categories = [
    '-*',
    'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.frame',
    'devtools.timeline',
    'blink.user_timing',
    'loading',
    'latencyInfo',
    'disabled-by-default-lighthouse',
    'v8.execute',
    'disabled-by-default-v8.cpu_profiler',
    'disabled-by-default-v8.cpu_profiler.hires'
];

// Helper functions
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function injectPerformanceObserver(page) {
    await page.evaluateOnNewDocument(() => {
        // Capture LCP
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
                window.__LCP = entries[entries.length - 1];
            }
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // Capture CLS
        let clsValue = 0;
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            }
            window.__CLS = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });

        // Capture INP
        let maxINP = 0;
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const value = entry.duration;
                maxINP = Math.max(maxINP, value);
            }
            window.__INP = maxINP;
        }).observe({ entryTypes: ['interaction'] });

        // Capture Long Tasks for TBT
        const longTasks = [];
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                longTasks.push({
                    duration: entry.duration,
                    startTime: entry.startTime,
                    attribution: entry.attribution
                });
            }
            window.__longTasks = longTasks;
        }).observe({ entryTypes: ['longtask'] });
    });
}

async function getPerformanceMetrics(page) {
    const metrics = await page.evaluate(() => ({
        // Navigation Timing
        navigationTiming: performance.getEntriesByType('navigation')[0],
        // Core Web Vitals
        lcp: window.__LCP,
        cls: window.__CLS,
        inp: window.__INP,
        // Long Tasks
        longTasks: window.__longTasks,
        // Resource Timing
        resources: performance.getEntriesByType('resource'),
        // Paint Timing
        paint: performance.getEntriesByType('paint'),
        // Layout Shifts
        layoutShifts: window.__layoutShifts
    }));

    // Get Chrome Performance Metrics
    const chromeMetrics = await page.metrics();
    
    return {
        ...metrics,
        chromeMetrics
    };
}

async function recordTraceAround(page, name, actionFn, opts = { reload: true, autoStop: true }) {
    const outPath = path.join(OUT_DIR, `${name}.trace.json`);
    const metricsPath = path.join(OUT_DIR, `${name}.metrics.json`);

    if (opts.reload) {
        try {
            await page.goto('about:blank', { waitUntil: ['networkidle0'] });
        } catch (e) {
            console.warn('Warning: about:blank navigation failed:', e.message);
        }
    }

    // Start tracing
    await page.tracing.start({ categories });

    // Perform action
    await actionFn();

    // Wait for network and rendering to settle
    await sleep(2500);

    // Collect metrics
    const metrics = await getPerformanceMetrics(page);
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));

    // Stop tracing
    const buffer = await page.tracing.stop();
    await fs.writeFile(outPath, buffer);

    return {
        path: outPath,
        metricsPath,
        metrics
    };
}

async function ensureOut() {
    await fs.mkdir(OUT_DIR, { recursive: true });
}

async function main() {
    try {
        await ensureOut();

        const browser = await puppeteer.launch({
            headless: process.env.HEADLESS !== 'false',
            args: ['--no-sandbox', '--enable-precise-memory-info']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await injectPerformanceObserver(page);

        const report = [];
        const BASE = new URL(process.argv[2] || 'https://petstore.octoperf.com');

        // 1) Homepage
        console.log('Recording: Homepage');
        const home = await recordTraceAround(page, 'homepage', async () => {
            await page.goto(BASE.href, { waitUntil: ['load', 'networkidle0'] });
            await sleep(1000);
        }, { reload: true });
        report.push({ step: 'homepage', ...home });

        // 2) Sign In page
        console.log('Recording: Sign In page');
        const signIn = await recordTraceAround(page, 'sign_in', async () => {
            try {
                await Promise.race([
                    page.click('a:has-text("Sign In")'),
                    page.goto(new URL('/actions/Account.action?signonForm=', BASE).href)
                ]);
                await sleep(1000);
            } catch (e) {
                console.warn('Sign in navigation error:', e.message);
                await page.goto(new URL('/actions/Account.action?signonForm=', BASE).href);
                await sleep(1000);
            }
        });
        report.push({ step: 'sign_in', ...signIn });

        // 3) Login
        console.log('Recording: Login');
        const login = await recordTraceAround(page, 'login', async () => {
            try {
                await page.type('input[name="username"]', 'j2ee');
                await page.type('input[name="password"]', 'j2ee');
                await Promise.all([
                    page.waitForNavigation({ waitUntil: ['load'] }),
                    page.click('input[type="submit"]')
                ]);
                await sleep(1000);
            } catch (e) {
                console.warn('Login error:', e.message);
            }
        });
        report.push({ step: 'login', ...login });

        // 4a) Fish category
        console.log('Recording: Fish category');
        const fish = await recordTraceAround(page, 'fish_category', async () => {
            try {
                await Promise.race([
                    page.click('a:has-text("Fish")'),
                    page.goto(new URL('/actions/Catalog.action?categoryId=FISH', BASE).href)
                ]);
                await sleep(1000);
            } catch (e) {
                await page.goto(new URL('/actions/Catalog.action?categoryId=FISH', BASE).href);
                await sleep(1000);
            }
        });
        report.push({ step: 'fish', ...fish });

        // 4b) Product details
        console.log('Recording: Product details');
        const product = await recordTraceAround(page, 'product_details', async () => {
            try {
                const productLink = await page.$('a[href*="Product.action"]');
                if (productLink) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: ['load'] }),
                        productLink.click()
                    ]);
                }
                await sleep(1000);
            } catch (e) {
                console.warn('Product navigation error:', e.message);
            }
        });
        report.push({ step: 'product', ...product });

        // 4c) Add to cart
        console.log('Recording: Add to cart');
        const addToCart = await recordTraceAround(page, 'add_to_cart', async () => {
            try {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: ['load'] }),
                    page.click('a:has-text("Add to Cart")')
                ]);
                await sleep(1000);
            } catch (e) {
                console.warn('Add to cart error:', e.message);
            }
        });
        report.push({ step: 'add_to_cart', ...addToCart });

        // 4d) View cart
        console.log('Recording: View cart');
        const viewCart = await recordTraceAround(page, 'view_cart', async () => {
            try {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: ['load'] }),
                    page.click('a:has-text("Cart")')
                ]);
                await sleep(1000);
            } catch (e) {
                await page.goto(new URL('/actions/Cart.action', BASE).href);
                await sleep(1000);
            }
        });
        report.push({ step: 'view_cart', ...viewCart });

        // 4e) Proceed to checkout
        console.log('Recording: Proceed to checkout');
        const checkout = await recordTraceAround(page, 'checkout', async () => {
            try {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: ['load'] }),
                    page.click('a:has-text("Proceed to Checkout")')
                ]);
                await sleep(1000);
            } catch (e) {
                console.warn('Checkout navigation error:', e.message);
            }
        });
        report.push({ step: 'checkout', ...checkout });

        // 5) Logout
        console.log('Recording: Logout');
        const logout = await recordTraceAround(page, 'logout', async () => {
            try {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: ['load'] }),
                    page.click('a:has-text("Sign Out")')
                ]);
                await sleep(1000);
            } catch (e) {
                await page.goto(new URL('/actions/Account.action?signoff=', BASE).href);
                await sleep(1000);
            }
        });
        report.push({ step: 'logout', ...logout });

        // Write full report
        const reportPath = path.join(OUT_DIR, 'report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`Report written to ${reportPath}`);

        await browser.close();

    } catch (e) {
        console.error('Error in scenario:', e);
        process.exit(1);
    }
}

main();