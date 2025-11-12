#!/bin/bash

# ==============================================================================
# Chrome DevTools MCP - Universal Performance Test Script
# ==============================================================================
# This script runs a complete performance test on any provided URL
# Usage: ./run_universal_perf_test.sh "<URL>"
# Example: ./run_universal_perf_test.sh "https://example.com"
# ==============================================================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if URL is provided
if [ -z "$1" ]; then
    print_header "Chrome DevTools MCP - Performance Test"
    echo ""
    print_error "No URL provided!"
    echo ""
    echo -e "${CYAN}Usage:${NC}"
    echo "  ./run_universal_perf_test.sh \"<URL>\""
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  ./run_universal_perf_test.sh \"https://example.com\""
    echo "  ./run_universal_perf_test.sh \"https://github.com\""
    echo "  ./run_universal_perf_test.sh \"https://google.com\""
    echo ""
    exit 1
fi

# Extract URL and validate
TARGET_URL="$1"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="performance_reports/${TIMESTAMP}"

# Extract domain from URL for naming
DOMAIN=$(echo "$TARGET_URL" | sed 's/https\?:\/\///' | sed 's/\/.*//' | sed 's/:.*$//')

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Print header
print_header "Chrome DevTools MCP - Performance Test"
echo ""
print_info "Target URL: ${CYAN}$TARGET_URL${NC}"
print_info "Domain: ${CYAN}$DOMAIN${NC}"
print_info "Output: ${CYAN}$OUTPUT_DIR${NC}"
echo ""

# Check if Node.js is installed
print_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js >= 20.19 LTS"
    exit 1
fi
NODE_VERSION=$(node --version)
print_success "Node.js found: $NODE_VERSION"
echo ""

# Build the project
print_info "Building project..."
npm run build > "$OUTPUT_DIR/build.log" 2>&1
if [ $? -eq 0 ]; then
    print_success "Project built successfully"
else
    print_error "Build failed. Check $OUTPUT_DIR/build.log"
    exit 1
fi
echo ""

# Run performance test with the provided URL
print_info "Running performance test..."
print_info "Browser Mode: Visible (HEADLESS=false)"
echo ""

HEADLESS=false node scripts/run_perf_reload.mjs "$TARGET_URL" 2>&1 | tee "$OUTPUT_DIR/test_output.log"

if [ $? -eq 0 ]; then
    print_success "Performance test completed"
    echo ""
    
    # Generate detailed markdown report
    print_info "Generating comprehensive report..."
    node scripts/markdown_report.mjs out/report.json 2>&1 >> "$OUTPUT_DIR/report_generation.log"
    
    # Move report to output directory
    if [ -f "performance_report.md" ]; then
        mv performance_report.md "$OUTPUT_DIR/performance_report_${DOMAIN}.md"
        print_success "Report generated"
    fi
    
    # Copy trace and metrics files
    if [ -d "out" ]; then
        print_info "Copying trace and metrics files..."
        cp -r out/* "$OUTPUT_DIR/" 2>/dev/null
        print_success "Trace files copied"
    fi
else
    print_error "Performance test failed"
    exit 1
fi

echo ""
print_header "✅ Performance Test Complete!"
echo ""
echo -e "${GREEN}📁 Results location:${NC}"
echo -e "   ${CYAN}$OUTPUT_DIR${NC}"
echo ""
echo -e "${GREEN}📄 Key Files Generated:${NC}"
echo -e "   ${YELLOW}• performance_report_${DOMAIN}.md${NC} - Main performance report"
echo -e "   ${YELLOW}• *.trace.json${NC} - Detailed trace files"
echo -e "   ${YELLOW}• *.metrics.json${NC} - Performance metrics"
echo -e "   ${YELLOW}• report.json${NC} - Complete test data"
echo -e "   ${YELLOW}• test_output.log${NC} - Test execution log"
echo ""
echo -e "${GREEN}📖 To view the report:${NC}"
echo -e "   ${CYAN}cat $OUTPUT_DIR/performance_report_${DOMAIN}.md${NC}"
echo ""
echo -e "${GREEN}📊 To analyze trace files:${NC}"
echo -e "   1. Open Chrome DevTools (F12)"
echo -e "   2. Go to Performance tab"
echo -e "   3. Click Upload and select .trace.json from results folder"
echo ""
echo -e "${GREEN}🔍 To view raw metrics data:${NC}"
echo -e "   ${CYAN}cat $OUTPUT_DIR/report.json | jq${NC}"
echo ""
