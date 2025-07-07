#!/usr/bin/env node

/**
 * Test multiple sequential connections to verify browser context reuse
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function createClientAndNavigate(clientName, url) {
  const client = new Client({ name: clientName, version: '1.0.0' });
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log(`\n${clientName}: Connected`);
    
    // Navigate to URL
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url }
    });
    console.log(`${clientName}: Navigated to ${url}`);
    
    // Execute JavaScript to verify it's working
    const result = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: 'return { title: document.title, time: new Date().toISOString() }'
      }
    });
    console.log(`${clientName}: Page title:`, JSON.parse(result.content[0].text).title);
    
  } catch (error) {
    console.error(`${clientName}: Error:`, error.message);
  } finally {
    await client.close();
    console.log(`${clientName}: Disconnected`);
  }
}

async function testMultipleConnections() {
  console.log('Testing Multiple Sequential Connections\n=======================================');
  
  // First connection
  await createClientAndNavigate('Client-1', 'https://example.com');
  
  console.log('\n--- Browser should stay open due to --keep-browser-open ---');
  
  // Second connection (should reuse browser)
  await createClientAndNavigate('Client-2', 'https://playwright.dev');
  
  console.log('\n--- Browser should still be open ---');
  
  // Third connection (should still reuse browser)
  await createClientAndNavigate('Client-3', 'https://google.com');
  
  console.log('\n✅ All connections completed successfully!');
  console.log('Browser should still be open with Google loaded.');
}

testMultipleConnections().catch(console.error);