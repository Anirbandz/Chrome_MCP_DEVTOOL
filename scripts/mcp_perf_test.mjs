import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'out');

// Helper to send MCP requests
async function sendMcpRequest(method, params) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            jsonrpc: '2.0',
            id: Math.random(),
            method,
            params
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(responseData);
                    resolve(response);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function ensureOut() {
    await fs.mkdir(OUT_DIR, { recursive: true });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function performanceTest(baseUrl) {
    try {
        await ensureOut();

        const report = [];

        console.log('Starting performance test using Chrome DevTools MCP...\n');

        // 1) Homepage
        console.log('1. Recording: Homepage');
        const homeResponse = await sendMcpRequest('pages_navigate', {
            url: baseUrl,
            waitUntil: 'load'
        });
        console.log('✓ Homepage loaded');

        // Start trace for homepage
        const homeTraceStart = await sendMcpRequest('performance_start_trace', {
            reload: true,
            autoStop: true
        });
        console.log('✓ Homepage trace started');
        
        await sleep(2000);
        
        const homeTraceStop = await sendMcpRequest('performance_stop_trace', {});
        console.log('✓ Homepage trace completed');

        const homeMetrics = await sendMcpRequest('performance_get_metrics', {});
        console.log('✓ Homepage metrics collected');

        report.push({
            step: 'homepage',
            metrics: homeMetrics,
            trace: homeTraceStop
        });

        // 2) Navigate to Sign In
        console.log('\n2. Recording: Sign In Page');
        
        const signInResponse = await sendMcpRequest('pages_navigate', {
            url: `${baseUrl}?signonForm=`,
            waitUntil: 'load'
        });
        console.log('✓ Sign In page loaded');

        const signInTraceStart = await sendMcpRequest('performance_start_trace', {
            reload: true,
            autoStop: true
        });
        
        await sleep(2000);
        
        const signInTrace = await sendMcpRequest('performance_stop_trace', {});
        const signInMetrics = await sendMcpRequest('performance_get_metrics', {});

        report.push({
            step: 'sign_in',
            metrics: signInMetrics,
            trace: signInTrace
        });

        console.log('✓ Sign In page trace completed');

        // 3) Login
        console.log('\n3. Recording: Login');
        
        // Use input tool to type credentials
        const usernameInput = await sendMcpRequest('input_type', {
            selector: 'input[name="username"]',
            text: 'j2ee'
        });
        
        const passwordInput = await sendMcpRequest('input_type', {
            selector: 'input[name="password"]',
            text: 'j2ee'
        });

        const loginTraceStart = await sendMcpRequest('performance_start_trace', {
            reload: true,
            autoStop: true
        });

        // Click login button
        const submitButton = await sendMcpRequest('input_click', {
            selector: 'input[type="submit"]'
        });

        await sleep(3000);

        const loginTrace = await sendMcpRequest('performance_stop_trace', {});
        const loginMetrics = await sendMcpRequest('performance_get_metrics', {});

        report.push({
            step: 'login',
            metrics: loginMetrics,
            trace: loginTrace
        });

        console.log('✓ Login trace completed');

        // 4a) Navigate to Fish category
        console.log('\n4a. Recording: Fish Category');
        
        const fishUrl = new URL(baseUrl);
        fishUrl.pathname = '/actions/Catalog.action';
        fishUrl.searchParams.set('categoryId', 'FISH');

        const fishResponse = await sendMcpRequest('pages_navigate', {
            url: fishUrl.href,
            waitUntil: 'load'
        });

        const fishTraceStart = await sendMcpRequest('performance_start_trace', {
            reload: true,
            autoStop: true
        });

        await sleep(2000);

        const fishTrace = await sendMcpRequest('performance_stop_trace', {});
        const fishMetrics = await sendMcpRequest('performance_get_metrics', {});

        report.push({
            step: 'fish_category',
            metrics: fishMetrics,
            trace: fishTrace
        });

        console.log('✓ Fish category trace completed');

        // 4b) Click on a product
        console.log('\n4b. Recording: Product Details');
        
        const productTraceStart = await sendMcpRequest('performance_start_trace', {
            reload: true,
            autoStop: true
        });

        const productClick = await sendMcpRequest('input_click', {
            selector: 'a[href*="Product.action"]'
        });

        await sleep(2000);

        const productTrace = await sendMcpRequest('performance_stop_trace', {});
        const productMetrics = await sendMcpRequest('performance_get_metrics', {});

        report.push({
            step: 'product_details',
            metrics: productMetrics,
            trace: productTrace
        });

        console.log('✓ Product details trace completed');

        // 4c) Add to cart
        console.log('\n4c. Recording: Add to Cart');
        
        const cartTraceStart = await sendMcpRequest('performance_start_trace', {
            reload: true,
            autoStop: true
        });

        const addToCartClick = await sendMcpRequest('input_click', {
            selector: 'input[value*="Add"]'
        });

        await sleep(2000);

        const cartTrace = await sendMcpRequest('performance_stop_trace', {});
        const cartMetrics = await sendMcpRequest('performance_get_metrics', {});

        report.push({
            step: 'add_to_cart',
            metrics: cartMetrics,
            trace: cartTrace
        });

        console.log('✓ Add to cart trace completed');

        // 4d) View cart
        console.log('\n4d. Recording: View Cart');
        
        const viewCartUrl = new URL(baseUrl);
        viewCartUrl.pathname = '/actions/Cart.action';

        const viewCartResponse = await sendMcpRequest('pages_navigate', {
            url: viewCartUrl.href,
            waitUntil: 'load'
        });

        const viewCartTraceStart = await sendMcpRequest('performance_start_trace', {
            reload: true,
            autoStop: true
        });

        await sleep(2000);

        const viewCartTrace = await sendMcpRequest('performance_stop_trace', {});
        const viewCartMetrics = await sendMcpRequest('performance_get_metrics', {});

        report.push({
            step: 'view_cart',
            metrics: viewCartMetrics,
            trace: viewCartTrace
        });

        console.log('✓ View cart trace completed');

        // 4e) Proceed to checkout
        console.log('\n4e. Recording: Proceed to Checkout');
        
        const checkoutTraceStart = await sendMcpRequest('performance_start_trace', {
            reload: true,
            autoStop: true
        });

        const checkoutClick = await sendMcpRequest('input_click', {
            selector: 'button:contains("Proceed")'
        });

        await sleep(2000);

        const checkoutTrace = await sendMcpRequest('performance_stop_trace', {});
        const checkoutMetrics = await sendMcpRequest('performance_get_metrics', {});

        report.push({
            step: 'checkout',
            metrics: checkoutMetrics,
            trace: checkoutTrace
        });

        console.log('✓ Checkout trace completed');

        // 5) Logout
        console.log('\n5. Recording: Logout');
        
        const logoutTraceStart = await sendMcpRequest('performance_start_trace', {
            reload: true,
            autoStop: true
        });

        const logoutClick = await sendMcpRequest('input_click', {
            selector: 'a:contains("Sign Out")'
        });

        await sleep(2000);

        const logoutTrace = await sendMcpRequest('performance_stop_trace', {});
        const logoutMetrics = await sendMcpRequest('performance_get_metrics', {});

        report.push({
            step: 'logout',
            metrics: logoutMetrics,
            trace: logoutTrace
        });

        console.log('✓ Logout trace completed');

        // Write report
        const reportPath = path.join(OUT_DIR, 'mcp_performance_report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log('\n✅ Performance test completed successfully!');
        console.log(`📊 Report saved to: ${reportPath}`);

        return report;

    } catch (error) {
        console.error('❌ Error during performance test:', error.message);
        process.exit(1);
    }
}

// Main execution
const baseUrl = process.argv[2] || 'https://petstore.octoperf.com';
console.log(`🚀 Starting performance test for: ${baseUrl}\n`);
performanceTest(baseUrl).catch(console.error);
