#!/usr/bin/env node

/**
 * Demo comparing current approach vs Phase 3 approach
 * Shows how Phase 3 tools would improve workflows
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

async function compareApproaches() {
  const client = new Client({ name: 'demo-client', version: '1.0.0' });
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('Connected to MCP server\n');
    
    // Navigate to example page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });
    
    console.log(`${YELLOW}=== DOM Querying Comparison ===${RESET}\n`);
    
    console.log(`${BLUE}Current approach (with JavaScript):${RESET}`);
    // Current: Using JavaScript evaluation
    const currentResult = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          const h1 = document.querySelector('h1');
          return h1 ? {
            exists: true,
            tagName: h1.tagName,
            text: h1.textContent,
            id: h1.id,
            className: h1.className
          } : { exists: false };
        `
      }
    });
    console.log('Result:', currentResult.content[0].text);
    
    console.log(`\n${GREEN}Phase 3 approach (direct DOM query):${RESET}`);
    console.log('Would use: browser_query_selector');
    console.log('```javascript');
    console.log(`await client.callTool({
  name: 'mcp__playwright__browser_query_selector',
  arguments: {
    selector: 'h1',
    returnType: 'properties'
  }
});`);
    console.log('```');
    console.log('Benefits: Cleaner, type-safe, no JS evaluation needed\n');
    
    console.log(`${YELLOW}=== Waiting for Elements Comparison ===${RESET}\n`);
    
    console.log(`${BLUE}Current approach:${RESET}`);
    // Current: Custom JavaScript waiting
    const waitResult = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          return new Promise((resolve) => {
            const checkElement = () => {
              const el = document.querySelector('.dynamic-content');
              if (el) {
                resolve({ found: true, text: el.textContent });
              } else {
                setTimeout(checkElement, 100);
              }
            };
            checkElement();
            setTimeout(() => resolve({ found: false }), 5000);
          });
        `
      }
    });
    console.log('Complex JavaScript Promise required');
    
    console.log(`\n${GREEN}Phase 3 approach:${RESET}`);
    console.log('Would use: browser_wait_for_selector');
    console.log('```javascript');
    console.log(`await client.callTool({
  name: 'mcp__playwright__browser_wait_for_selector',
  arguments: {
    selector: '.dynamic-content',
    state: 'visible',
    timeout: 5000
  }
});`);
    console.log('```');
    console.log('Benefits: Built-in retry logic, proper error handling\n');
    
    console.log(`${YELLOW}=== Page Information Comparison ===${RESET}\n`);
    
    console.log(`${BLUE}Current approach:${RESET}`);
    // Current: Multiple JavaScript calls
    const pageInfo = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          return {
            title: document.title,
            url: window.location.href,
            performance: {
              loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
              domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
            }
          };
        `
      }
    });
    console.log('Page info via JS:', pageInfo.content[0].text);
    
    console.log(`\n${GREEN}Phase 3 approach:${RESET}`);
    console.log('Would use dedicated tools:');
    console.log('- browser_get_title');
    console.log('- browser_get_url');
    console.log('- browser_get_metrics');
    console.log('Benefits: Structured data, comprehensive metrics, no JS needed\n');
    
    console.log(`${YELLOW}=== Accessibility Testing Comparison ===${RESET}\n`);
    
    console.log(`${BLUE}Current approach:${RESET}`);
    // Current: Manual accessibility checks
    const a11yCheck = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          const images = Array.from(document.querySelectorAll('img'));
          const missingAlt = images.filter(img => !img.alt && !img.getAttribute('aria-label'));
          return {
            totalImages: images.length,
            missingAlt: missingAlt.length,
            issues: missingAlt.map(img => ({
              src: img.src,
              issue: 'Missing alt text'
            }))
          };
        `
      }
    });
    console.log('Manual a11y check:', a11yCheck.content[0].text);
    
    console.log(`\n${GREEN}Phase 3 approach:${RESET}`);
    console.log('Would use: browser_check_accessibility');
    console.log('```javascript');
    console.log(`await client.callTool({
  name: 'mcp__playwright__browser_check_accessibility',
  arguments: {
    rules: ['image-alt', 'label', 'color-contrast'],
    level: 'AA'
  }
});`);
    console.log('```');
    console.log('Benefits: Comprehensive WCAG checks, structured reports\n');
    
    console.log(`${YELLOW}=== Live Adapter Testing Impact ===${RESET}\n`);
    
    console.log('With Phase 3 tools, live-analyze-adapt becomes:');
    console.log('1. ✅ More efficient - Direct DOM queries vs JavaScript evaluation');
    console.log('2. ✅ More reliable - Built-in wait strategies and error handling');
    console.log('3. ✅ More comprehensive - Performance metrics and accessibility');
    console.log('4. ✅ Easier to use - Dedicated tools for common tasks');
    console.log('5. ✅ Better debugging - Structured data and clear error messages\n');
    
    console.log(`${GREEN}Summary:${RESET} Phase 3 tools transform browser automation from`);
    console.log('JavaScript-heavy scripting to declarative, purpose-built commands.\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

// Run the comparison
console.log(`${BLUE}📊 Phase 3 Tools - Before & After Comparison${RESET}\n`);
compareApproaches().catch(console.error);