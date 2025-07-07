#!/usr/bin/env node

/**
 * Simple test script to verify Phase 2 tools work with the running MCP server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function testPhase2Tools() {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  
  try {
    // Connect to the running server
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('Connected to MCP server');
    
    // List available tools
    const tools = await client.listTools();
    console.log('\nTotal tools available:', tools.tools.length);
    console.log('\nAll tool names:');
    tools.tools.forEach(t => console.log(`  - ${t.name}`));
    
    const storageTools = tools.tools.filter(t => t.name.includes('storage') || t.name.includes('cookie'));
    const networkTools = tools.tools.filter(t => t.name.includes('route') || t.name.includes('request') || t.name.includes('response'));
    console.log('\nPhase 2 tools found:');
    console.log('Storage tools:', storageTools.map(t => t.name));
    console.log('Network tools:', networkTools.map(t => t.name));
    
    // Navigate to a test page
    console.log('\n1. Testing navigation...');
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });
    console.log('✓ Navigation successful');
    
    // Test localStorage
    console.log('\n2. Testing localStorage...');
    await client.callTool({
      name: 'mcp__playwright__browser_set_storage',
      arguments: {
        type: 'local',
        data: {
          'test.key': 'test value',
          'another.key': 'another value'
        }
      }
    });
    console.log('✓ Set localStorage');
    
    const storageResult = await client.callTool({
      name: 'mcp__playwright__browser_get_storage',
      arguments: { type: 'local' }
    });
    console.log('✓ Retrieved localStorage:', JSON.parse(storageResult.content[0].text));
    
    // Test cookies
    console.log('\n3. Testing cookies...');
    await client.callTool({
      name: 'mcp__playwright__browser_set_cookies',
      arguments: {
        cookies: [{
          name: 'test_cookie',
          value: 'test_value',
          domain: 'example.com',
          path: '/'
        }]
      }
    });
    console.log('✓ Set cookies');
    
    const cookiesResult = await client.callTool({
      name: 'mcp__playwright__browser_get_cookies',
      arguments: {}
    });
    console.log('✓ Retrieved cookies:', JSON.parse(cookiesResult.content[0].text));
    
    // Test network interception
    console.log('\n4. Testing network interception...');
    await client.callTool({
      name: 'mcp__playwright__browser_route',
      arguments: {
        pattern: '**/test-api/**',
        handler: {
          fulfill: {
            status: 200,
            body: '{"intercepted": true}',
            contentType: 'application/json'
          }
        }
      }
    });
    console.log('✓ Set up route handler');
    
    // Test JavaScript execution to trigger the intercepted request
    console.log('\n5. Testing JavaScript execution with intercepted request...');
    const jsResult = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          return fetch('/test-api/data')
            .then(r => r.json())
            .then(data => JSON.stringify(data));
        `
      }
    });
    console.log('✓ JavaScript execution result:', jsResult.content[0].text);
    
    // Test network request monitoring
    console.log('\n6. Testing network request monitoring...');
    const requestsResult = await client.callTool({
      name: 'mcp__playwright__browser_get_requests',
      arguments: {
        filter: { url: '*example.com*' }
      }
    });
    const requests = JSON.parse(requestsResult.content[0].text);
    console.log(`✓ Found ${requests.length} requests to example.com`);
    
    console.log('\n✅ All Phase 2 tools tested successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.close();
  }
}

// Run the tests
testPhase2Tools().catch(console.error);