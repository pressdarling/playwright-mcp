#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function test() {
  const client = new Client({ name: 'test', version: '1.0.0' });
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('Connected\n');
    
    // List tools
    const tools = await client.listTools();
    console.log(`Total tools available: ${tools.tools.length}`);
    
    // Check for Phase 3 tools
    const phase3Tools = tools.tools.filter(t => 
      t.name.includes('query_selector') || 
      t.name.includes('get_title') ||
      t.name.includes('wait_for_selector')
    );
    console.log(`Phase 3 tools found: ${phase3Tools.length}`);
    console.log('Sample Phase 3 tools:', phase3Tools.slice(0, 3).map(t => t.name));
    
    // Try navigation
    console.log('\nNavigating...');
    const nav = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });
    console.log('Navigation result:', nav.content[0].text);
    
    // Try Phase 3 tool
    console.log('\nTrying Phase 3 DOM query...');
    try {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_query_selector',
        arguments: {
          selector: 'h1',
          returnType: 'exists'
        }
      });
      console.log('Query result:', result.content[0].text);
    } catch (e) {
      console.log('Query error:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Clean up: Close the tab
    try {
      await client.callTool({
        name: 'browser_close',
        arguments: {}
      });
      console.log('\nClosed browser tab');
    } catch (e) {
      // Ignore cleanup errors
    }
    
    await client.close();
  }
}

test().catch(console.error);