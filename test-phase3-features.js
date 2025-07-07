#!/usr/bin/env node

/**
 * Test script for Phase 3 features
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function testPhase3() {
  const client = new Client({ name: 'phase3-test', version: '1.0.0' });
  let passedTests = 0;
  let failedTests = 0;
  
  async function runTest(name, testFn) {
    process.stdout.write(`Testing ${name}... `);
    try {
      await testFn();
      console.log(`${GREEN}✓${RESET}`);
      passedTests++;
    } catch (error) {
      console.log(`${RED}✗${RESET}`);
      console.log(`  Error: ${error.message}`);
      failedTests++;
    }
  }
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('Connected to MCP server\n');
    
    // Navigate to a test page with multiple elements
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });
    
    console.log(`${YELLOW}=== Phase 3: DOM Manipulation Tests ===${RESET}\n`);
    
    // Test 1: querySelector
    await runTest('browser_query_selector', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_query_selector',
        arguments: {
          selector: 'h1',
          returnType: 'properties'
        }
      });
      const element = JSON.parse(result.content[0].text);
      if (!element || element.tagName !== 'H1') {
        throw new Error('Failed to find H1 element');
      }
    });
    
    // Test 2: querySelectorAll
    await runTest('browser_query_selector_all', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_query_selector_all',
        arguments: {
          selector: 'p',
          limit: 5
        }
      });
      const elements = JSON.parse(result.content[0].text);
      if (!Array.isArray(elements) || elements.length === 0) {
        throw new Error('Failed to find paragraph elements');
      }
    });
    
    // Test 3: getAttribute
    await runTest('browser_get_attribute', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_attribute',
        arguments: {
          selector: 'a',
          attribute: 'href'
        }
      });
      const href = JSON.parse(result.content[0].text);
      if (typeof href !== 'string') {
        throw new Error('Failed to get href attribute');
      }
    });
    
    // Test 4: getTextContent
    await runTest('browser_get_text_content', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_text_content',
        arguments: {
          selector: 'h1'
        }
      });
      const text = JSON.parse(result.content[0].text);
      if (!text || text.length === 0) {
        throw new Error('Failed to get text content');
      }
    });
    
    console.log(`\n${YELLOW}=== Phase 3: Advanced Waiting Tests ===${RESET}\n`);
    
    // Test 5: waitForSelector
    await runTest('browser_wait_for_selector', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_wait_for_selector',
        arguments: {
          selector: 'body',
          state: 'visible',
          timeout: 5000
        }
      });
      const found = JSON.parse(result.content[0].text);
      if (!found.found) {
        throw new Error('Failed to wait for selector');
      }
    });
    
    // Test 6: waitForFunction
    await runTest('browser_wait_for_function', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_wait_for_function',
        arguments: {
          code: 'return document.readyState === "complete"',
          timeout: 5000
        }
      });
      const ready = JSON.parse(result.content[0].text);
      if (!ready.success) {
        throw new Error('Failed to wait for function');
      }
    });
    
    // Test 7: waitForLoadState
    await runTest('browser_wait_for_load_state', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_wait_for_load_state',
        arguments: {
          state: 'domcontentloaded'
        }
      });
      if (!result.content[0].text.includes('domcontentloaded')) {
        throw new Error('Failed to wait for load state');
      }
    });
    
    console.log(`\n${YELLOW}=== Phase 3: Page Information Tests ===${RESET}\n`);
    
    // Test 8: getTitle
    await runTest('browser_get_title', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_title',
        arguments: {}
      });
      const title = result.content[0].text;
      if (!title || title.length === 0) {
        throw new Error('Failed to get page title');
      }
    });
    
    // Test 9: getUrl
    await runTest('browser_get_url', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_url',
        arguments: {}
      });
      const url = result.content[0].text;
      if (!url.includes('example.com')) {
        throw new Error('Failed to get correct URL');
      }
    });
    
    // Test 10: getMetrics
    await runTest('browser_get_metrics', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_metrics',
        arguments: {
          type: 'performance'
        }
      });
      const metrics = JSON.parse(result.content[0].text);
      if (!metrics.performance) {
        throw new Error('Failed to get performance metrics');
      }
    });
    
    console.log(`\n${YELLOW}=== Phase 3: Frame Management Tests ===${RESET}\n`);
    
    // Test 11: listFrames
    await runTest('browser_list_frames', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_list_frames',
        arguments: {}
      });
      const frames = JSON.parse(result.content[0].text);
      if (!Array.isArray(frames)) {
        throw new Error('Failed to list frames');
      }
    });
    
    console.log(`\n${YELLOW}=== Phase 3: Accessibility Tests ===${RESET}\n`);
    
    // Test 12: getAccessibilityTree
    await runTest('browser_get_accessibility_tree', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_accessibility_tree',
        arguments: {
          selector: 'h1',
          interestingOnly: true
        }
      });
      const tree = JSON.parse(result.content[0].text);
      if (!tree) {
        throw new Error('Failed to get accessibility tree');
      }
    });
    
    // Test 13: checkAccessibility
    await runTest('browser_check_accessibility', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_check_accessibility',
        arguments: {
          rules: ['image-alt', 'label'],
          level: 'A'
        }
      });
      const report = JSON.parse(result.content[0].text);
      if (!report.summary) {
        throw new Error('Failed to run accessibility checks');
      }
    });
    
    // Print summary
    console.log(`\n${YELLOW}=== Test Summary ===${RESET}`);
    console.log(`${GREEN}Passed: ${passedTests}${RESET}`);
    console.log(`${RED}Failed: ${failedTests}${RESET}`);
    console.log(`Total: ${passedTests + failedTests}\n`);
    
    if (failedTests === 0) {
      console.log(`${GREEN}✅ All Phase 3 tests passed!${RESET}`);
    } else {
      console.log(`${RED}❌ Some tests failed${RESET}`);
    }
    
  } catch (error) {
    console.error(`${RED}Fatal error: ${error.message}${RESET}`);
  } finally {
    await client.close();
  }
}

// Run the tests
console.log('🎯 Phase 3 Feature Tests\n');
testPhase3().catch(console.error);