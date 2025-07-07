#!/usr/bin/env node

/**
 * Comprehensive test of all Phase 1 and Phase 2 features
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function testAllFeatures() {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  let passedTests = 0;
  let failedTests = 0;
  
  async function runTest(name, testFn) {
    process.stdout.write(`Testing ${name}... `);
    try {
      await testFn();
      console.log(`${GREEN}✓${RESET}`);
      passedTests++;
      return true;
    } catch (error) {
      console.log(`${RED}✗${RESET}`);
      console.log(`  Error: ${error.message}`);
      failedTests++;
      return false;
    }
  }
  
  try {
    // Connect to the running server
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('Connected to MCP server\n');
    
    // List available tools
    const tools = await client.listTools();
    const phase1Tools = tools.tools.filter(t => 
      t.name.includes('evaluate') || 
      t.name.includes('script_tag') || 
      t.name.includes('style_tag') || 
      t.name.includes('init_script')
    );
    const phase2Tools = tools.tools.filter(t => 
      t.name.includes('storage') || 
      t.name.includes('cookie') || 
      t.name.includes('route') ||
      t.name.includes('request') ||
      t.name.includes('response')
    );
    
    console.log(`Available Phase 1 tools: ${phase1Tools.map(t => t.name).join(', ')}`);
    console.log(`Available Phase 2 tools: ${phase2Tools.map(t => t.name).join(', ')}`);
    console.log(`Total tools: ${tools.tools.length}\n`);
    
    // Navigate to a test page first
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });
    
    console.log(`${YELLOW}=== Phase 1: JavaScript Execution Tests ===${RESET}\n`);
    
    // Test 1: browser_evaluate
    await runTest('browser_evaluate', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_evaluate',
        arguments: {
          code: 'return window.location.hostname'
        }
      });
      const hostname = JSON.parse(result.content[0].text);
      if (hostname !== 'example.com') throw new Error(`Expected example.com, got ${hostname}`);
    });
    
    // Test 2: browser_evaluate with arguments
    await runTest('browser_evaluate with args', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_evaluate',
        arguments: {
          code: 'return arg0 + arg1',
          args: [5, 3]
        }
      });
      const sum = JSON.parse(result.content[0].text);
      if (sum !== 8) throw new Error(`Expected 8, got ${sum}`);
    });
    
    // Test 3: browser_evaluate_handle
    await runTest('browser_evaluate_handle', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_evaluate_handle',
        arguments: {
          code: 'return document.body'
        }
      });
      // Parse the result to check handle info
      const handleInfo = JSON.parse(result.content[0].text);
      if (!handleInfo.handleId || handleInfo.type !== 'object' || !handleInfo.isElement) {
        throw new Error('Invalid handle info returned');
      }
    });
    
    // Test 4: browser_eval_on_selector
    await runTest('browser_eval_on_selector', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_eval_on_selector',
        arguments: {
          selector: 'h1',
          code: 'return element.textContent'
        }
      });
      const text = JSON.parse(result.content[0].text);
      if (!text || text.length === 0) throw new Error('No text found');
    });
    
    // Test 5: browser_eval_on_selector_all
    await runTest('browser_eval_on_selector_all', async () => {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_eval_on_selector_all',
        arguments: {
          selector: 'p',
          code: 'return elements.length'
        }
      });
      const count = JSON.parse(result.content[0].text);
      if (typeof count !== 'number') throw new Error('Expected number');
    });
    
    // Test 6: browser_add_script_tag
    await runTest('browser_add_script_tag', async () => {
      await client.callTool({
        name: 'mcp__playwright__browser_add_script_tag',
        arguments: {
          content: 'window.testScriptLoaded = true;'
        }
      });
      
      // Verify script was added
      const result = await client.callTool({
        name: 'mcp__playwright__browser_evaluate',
        arguments: { code: 'return window.testScriptLoaded' }
      });
      if (result.content[0].text !== 'true') throw new Error('Script not loaded');
    });
    
    // Test 7: browser_add_style_tag
    await runTest('browser_add_style_tag', async () => {
      await client.callTool({
        name: 'mcp__playwright__browser_add_style_tag',
        arguments: {
          content: 'body { background-color: rgb(255, 0, 0) !important; }'
        }
      });
      
      // Verify style was applied
      const result = await client.callTool({
        name: 'mcp__playwright__browser_evaluate',
        arguments: { 
          code: 'return window.getComputedStyle(document.body).backgroundColor' 
        }
      });
      if (!result.content[0].text.includes('255')) throw new Error('Style not applied');
    });
    
    // Test 8: browser_add_init_script
    await runTest('browser_add_init_script', async () => {
      await client.callTool({
        name: 'mcp__playwright__browser_add_init_script',
        arguments: {
          script: 'window.initScriptRan = true;'
        }
      });
      
      // Navigate to trigger init script
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: 'https://example.org' }
      });
      
      const result = await client.callTool({
        name: 'mcp__playwright__browser_evaluate',
        arguments: { code: 'return window.initScriptRan' }
      });
      if (result.content[0].text !== 'true') throw new Error('Init script did not run');
    });
    
    console.log(`\n${YELLOW}=== Phase 2: Storage Management Tests ===${RESET}\n`);
    
    // Test 9: browser_set_storage and browser_get_storage
    await runTest('browser_set/get_storage', async () => {
      await client.callTool({
        name: 'mcp__playwright__browser_set_storage',
        arguments: {
          type: 'local',
          data: {
            'test.key1': 'value1',
            'test.key2': 'value2'
          }
        }
      });
      
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_storage',
        arguments: { type: 'local' }
      });
      
      const storage = JSON.parse(result.content[0].text);
      if (storage['test.key1'] !== 'value1') throw new Error('Storage not set correctly');
    });
    
    // Test 10: browser_clear_storage
    await runTest('browser_clear_storage', async () => {
      // First set some data
      await client.callTool({
        name: 'mcp__playwright__browser_set_storage',
        arguments: {
          type: 'session',
          data: { 'temp.key': 'temp value' }
        }
      });
      
      // Clear it
      await client.callTool({
        name: 'mcp__playwright__browser_clear_storage',
        arguments: { type: 'session' }
      });
      
      // Verify it's empty
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_storage',
        arguments: { type: 'session' }
      });
      
      const storage = JSON.parse(result.content[0].text);
      if (Object.keys(storage).length !== 0) throw new Error('Storage not cleared');
    });
    
    // Test 11: browser_set_cookies and browser_get_cookies
    await runTest('browser_set/get_cookies', async () => {
      await client.callTool({
        name: 'mcp__playwright__browser_set_cookies',
        arguments: {
          cookies: [{
            name: 'test_cookie',
            value: 'test_value',
            domain: '.example.org',
            path: '/'
          }]
        }
      });
      
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_cookies',
        arguments: {}
      });
      
      const cookies = JSON.parse(result.content[0].text);
      const testCookie = cookies.find(c => c.name === 'test_cookie');
      if (!testCookie || testCookie.value !== 'test_value') {
        throw new Error('Cookie not set correctly');
      }
    });
    
    // Test 12: browser_delete_cookies
    await runTest('browser_delete_cookies', async () => {
      // Delete the test cookie
      await client.callTool({
        name: 'mcp__playwright__browser_delete_cookies',
        arguments: { name: 'test_cookie' }
      });
      
      // Verify it's gone
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_cookies',
        arguments: { name: 'test_cookie' }
      });
      
      const cookies = JSON.parse(result.content[0].text);
      if (cookies.length !== 0) throw new Error('Cookie not deleted');
    });
    
    console.log(`\n${YELLOW}=== Phase 2: Network Interception Tests ===${RESET}\n`);
    
    // Test 13: browser_route with fulfill
    await runTest('browser_route (fulfill)', async () => {
      await client.callTool({
        name: 'mcp__playwright__browser_route',
        arguments: {
          pattern: '**/api/test',
          handler: {
            fulfill: {
              status: 200,
              body: '{"mocked": true}',
              contentType: 'application/json'
            }
          }
        }
      });
      
      // Make request to mocked endpoint
      const result = await client.callTool({
        name: 'mcp__playwright__browser_evaluate',
        arguments: {
          code: `
            return fetch('/api/test')
              .then(r => r.json())
              .then(data => JSON.stringify(data));
          `
        }
      });
      
      const response = JSON.parse(JSON.parse(result.content[0].text));
      if (!response.mocked) throw new Error('Route not intercepted');
    });
    
    // Test 14: browser_get_requests
    await runTest('browser_get_requests', async () => {
      // Make a request first
      await client.callTool({
        name: 'mcp__playwright__browser_evaluate',
        arguments: {
          code: `fetch('/test-request')`
        }
      });
      
      const result = await client.callTool({
        name: 'mcp__playwright__browser_get_requests',
        arguments: {
          filter: { url: '*test-request*' }
        }
      });
      
      const requests = JSON.parse(result.content[0].text);
      if (!Array.isArray(requests)) throw new Error('Expected array of requests');
    });
    
    // Test 15: browser_wait_for_response
    await runTest('browser_wait_for_response', async () => {
      // Set up a route to ensure we get a response
      await client.callTool({
        name: 'mcp__playwright__browser_route',
        arguments: {
          pattern: '**/response-wait-test',
          handler: {
            fulfill: {
              status: 200,
              body: 'OK',
              contentType: 'text/plain'
            }
          }
        }
      });
      
      // Start waiting for response
      const waitPromise = client.callTool({
        name: 'mcp__playwright__browser_wait_for_response',
        arguments: {
          urlPattern: '**/response-wait-test',
          timeout: 5000
        }
      });
      
      // Trigger the request after a small delay
      await new Promise(resolve => setTimeout(resolve, 100));
      await client.callTool({
        name: 'mcp__playwright__browser_evaluate',
        arguments: { code: `fetch('/response-wait-test')` }
      });
      
      const result = await waitPromise;
      const response = JSON.parse(result.content[0].text);
      if (!response.url.includes('response-wait-test')) {
        throw new Error('Wrong response captured');
      }
      
      // Clean up route
      await client.callTool({
        name: 'mcp__playwright__browser_unroute',
        arguments: { pattern: '**/response-wait-test' }
      });
    });
    
    // Print summary
    console.log(`\n${YELLOW}=== Test Summary ===${RESET}`);
    console.log(`${GREEN}Passed: ${passedTests}${RESET}`);
    console.log(`${RED}Failed: ${failedTests}${RESET}`);
    console.log(`Total: ${passedTests + failedTests}\n`);
    
    if (failedTests === 0) {
      console.log(`${GREEN}✅ All tests passed!${RESET}`);
    } else {
      console.log(`${RED}❌ Some tests failed${RESET}`);
    }
    
  } catch (error) {
    console.error(`${RED}Fatal error: ${error.message}${RESET}`);
  } finally {
    // Clean up: Close the tab before closing the client
    try {
      await client.callTool({
        name: 'browser_close',
        arguments: {}
      });
    } catch (e) {
      // Ignore cleanup errors
    }
    
    await client.close();
  }
}

// Run the tests
testAllFeatures().catch(console.error);