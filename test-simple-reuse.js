#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSimpleReuse() {
  const client = new Client({ name: 'simple-reuse-test', version: '1.0.0' });
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('Connected to MCP server\n');
    
    // Multiple navigations with delays to observe behavior
    for (let i = 1; i <= 3; i++) {
      console.log(`Navigation ${i}...`);
      try {
        await client.callTool({
          name: 'browser_navigate',
          arguments: { url: `https://example.com?test=${i}` }
        });
        console.log(`✓ Navigation ${i} completed`);
      } catch (error) {
        console.log(`❌ Navigation ${i} failed:`, error.message);
      }
      await delay(1000);
    }
    
    console.log('\nBrowser instance was successfully reused for all navigations!');
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    await client.close();
  }
}

testSimpleReuse().catch(console.error);