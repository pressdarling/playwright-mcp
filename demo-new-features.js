#!/usr/bin/env node

/**
 * Demo script showcasing Phase 1 and Phase 2 features
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function demo() {
  const client = new Client({ name: 'demo-client', version: '1.0.0' });
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('🚀 Connected to Playwright MCP server\n');
    
    // Navigate to a demo page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });
    
    console.log('📊 Demo 1: JavaScript Execution');
    console.log('================================\n');
    
    // Execute JavaScript to modify the page
    await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          document.querySelector('h1').textContent = 'Modified by MCP!';
          document.body.style.backgroundColor = '#f0f0f0';
          return 'Page modified successfully';
        `
      }
    });
    console.log('✓ Modified page title and background\n');
    
    // Add custom styles
    await client.callTool({
      name: 'mcp__playwright__browser_add_style_tag',
      arguments: {
        content: `
          h1 { 
            color: #ff6b6b; 
            font-family: 'Comic Sans MS', cursive;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `
      }
    });
    console.log('✓ Added animated styles\n');
    
    console.log('💾 Demo 2: Storage Management');
    console.log('============================\n');
    
    // Store user preferences
    await client.callTool({
      name: 'mcp__playwright__browser_set_storage',
      arguments: {
        type: 'local',
        data: {
          'user.theme': 'dark',
          'user.language': 'en',
          'user.lastVisit': new Date().toISOString()
        }
      }
    });
    console.log('✓ Saved user preferences to localStorage\n');
    
    // Set authentication cookie
    await client.callTool({
      name: 'mcp__playwright__browser_set_cookies',
      arguments: {
        cookies: [{
          name: 'auth_token',
          value: 'demo_session_12345',
          domain: '.example.com',
          path: '/',
          httpOnly: true,
          secure: true
        }]
      }
    });
    console.log('✓ Set authentication cookie\n');
    
    console.log('🌐 Demo 3: Network Interception');
    console.log('==============================\n');
    
    // Mock API responses
    await client.callTool({
      name: 'mcp__playwright__browser_route',
      arguments: {
        pattern: '**/api/user',
        handler: {
          fulfill: {
            status: 200,
            body: JSON.stringify({
              id: 1,
              name: 'MCP Demo User',
              role: 'admin',
              features: ['javascript', 'storage', 'network']
            }),
            contentType: 'application/json'
          }
        }
      }
    });
    console.log('✓ Set up mock API endpoint\n');
    
    // Make a request to the mocked endpoint
    const apiResult = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          return fetch('/api/user')
            .then(r => r.json())
            .then(data => {
              console.log('User data:', data);
              return data;
            });
        `
      }
    });
    console.log('✓ Fetched mocked user data:', apiResult.content[0].text, '\n');
    
    // Block tracking scripts
    await client.callTool({
      name: 'mcp__playwright__browser_route',
      arguments: {
        pattern: '**/*analytics*',
        handler: { abort: true }
      }
    });
    console.log('✓ Blocked analytics tracking\n');
    
    console.log('📸 Demo 4: Advanced Features');
    console.log('===========================\n');
    
    // Inject a monitoring script
    await client.callTool({
      name: 'mcp__playwright__browser_add_init_script',
      arguments: {
        script: `
          window.addEventListener('click', (e) => {
            console.log('Click detected on:', e.target.tagName);
          });
          console.log('MCP monitoring script loaded');
        `
      }
    });
    console.log('✓ Injected click monitoring script\n');
    
    // Get network activity summary
    const requests = await client.callTool({
      name: 'mcp__playwright__browser_get_requests',
      arguments: {}
    });
    const requestData = JSON.parse(requests.content[0].text);
    console.log(`✓ Captured ${requestData.length} network requests\n`);
    
    // Take a screenshot of the modified page
    await client.callTool({
      name: 'browser_take_screenshot',
      arguments: { filename: 'mcp-demo-result.png' }
    });
    console.log('✓ Saved screenshot as mcp-demo-result.png\n');
    
    console.log('🎉 Demo completed successfully!');
    console.log('Check the browser to see all modifications.');
    
  } catch (error) {
    console.error('❌ Demo error:', error.message);
  } finally {
    await client.close();
  }
}

// Run the demo
console.log('🎭 Playwright MCP - New Features Demo\n');
demo().catch(console.error);