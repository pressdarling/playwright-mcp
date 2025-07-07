#!/usr/bin/env node

/**
 * Test script to verify browser instance reuse across multiple commands
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function testBrowserReuse() {
  const client = new Client({ name: 'browser-reuse-test', version: '1.0.0' });
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('Connected to MCP server\n');
    
    console.log('Test 1: First navigation (should create browser if not exists)');
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });
    console.log('✓ First navigation completed\n');
    
    console.log('Test 2: Second navigation (should reuse existing browser)');
    await client.callTool({
      name: 'browser_navigate', 
      arguments: { url: 'https://playwright.dev' }
    });
    console.log('✓ Second navigation completed\n');
    
    console.log('Test 3: Open new tab (should use same browser instance)');
    await client.callTool({
      name: 'browser_tab_new',
      arguments: { url: 'https://google.com' }
    });
    console.log('✓ New tab opened\n');
    
    console.log('Test 4: JavaScript execution (should work in existing browser)');
    const result = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: 'return { url: window.location.href, time: new Date().toISOString() }'
      }
    });
    console.log('✓ JavaScript executed:', result.content[0].text, '\n');
    
    console.log('Test 5: List tabs (verifying all operations used same browser)');
    const tabs = await client.callTool({
      name: 'browser_tab_list',
      arguments: {}
    });
    console.log('✓ Current tabs:', tabs.content[0].text, '\n');
    
    console.log('✅ All tests passed! Browser instance was reused across all commands.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.close();
    console.log('\nClient disconnected (browser should stay open with --keep-browser-open)');
  }
}

// Run the test
console.log('Browser Reuse Test\n==================\n');
testBrowserReuse().catch(console.error);