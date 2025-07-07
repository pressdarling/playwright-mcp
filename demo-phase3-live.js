#!/usr/bin/env node

/**
 * Live demo of Phase 3 features on any website
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function livePhase3Demo() {
  const client = new Client({ name: 'phase3-demo', version: '1.0.0' });
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('🚀 Connected to MCP server\n');
    
    // Navigate to example.com
    console.log('📍 Navigating to example.com...');
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });
    
    // Wait for page to load
    await client.callTool({
      name: 'mcp__playwright__browser_wait_for_load_state',
      arguments: { state: 'domcontentloaded' }
    });
    
    console.log('\n🔍 Phase 3 Feature Showcase\n');
    
    // 1. DOM Querying
    console.log('1️⃣ DOM Querying (Phase 3)\n');
    
    const h1Result = await client.callTool({
      name: 'mcp__playwright__browser_query_selector',
      arguments: {
        selector: 'h1',
        returnType: 'properties'
      }
    });
    const h1 = JSON.parse(h1Result.content[0].text);
    console.log('Found H1:', h1.textContent);
    console.log('Properties:', { id: h1.id, className: h1.className, visible: h1.visible });
    
    // 2. Get all paragraphs
    console.log('\n2️⃣ Query Multiple Elements\n');
    
    const paragraphs = await client.callTool({
      name: 'mcp__playwright__browser_query_selector_all',
      arguments: {
        selector: 'p',
        limit: 5
      }
    });
    const pElements = JSON.parse(paragraphs.content[0].text);
    console.log(`Found ${pElements.length} paragraphs`);
    pElements.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.textContent.substring(0, 50)}...`);
    });
    
    // 3. Page Information
    console.log('\n3️⃣ Page Information (Phase 3)\n');
    
    const title = await client.callTool({
      name: 'mcp__playwright__browser_get_title',
      arguments: {}
    });
    console.log('Page title:', title.content[0].text);
    
    const url = await client.callTool({
      name: 'mcp__playwright__browser_get_url',
      arguments: {}
    });
    console.log('Current URL:', url.content[0].text);
    
    // 4. Extract all links
    console.log('\n4️⃣ Extract Link Information\n');
    
    const links = await client.callTool({
      name: 'mcp__playwright__browser_query_selector_all',
      arguments: {
        selector: 'a',
        limit: 10
      }
    });
    const linkElements = JSON.parse(links.content[0].text);
    console.log(`Found ${linkElements.length} links:`);
    
    for (const link of linkElements) {
      const href = await client.callTool({
        name: 'mcp__playwright__browser_get_attribute',
        arguments: {
          selector: `a:nth-of-type(${link.index + 1})`,
          attribute: 'href'
        }
      });
      console.log(`  - ${link.textContent}: ${JSON.parse(href.content[0].text)}`);
    }
    
    // 5. Accessibility Check
    console.log('\n5️⃣ Accessibility Analysis (Phase 3)\n');
    
    const a11yTree = await client.callTool({
      name: 'mcp__playwright__browser_get_accessibility_tree',
      arguments: {
        interestingOnly: true
      }
    });
    const tree = JSON.parse(a11yTree.content[0].text);
    console.log('Accessibility tree root:', tree?.name || 'N/A');
    
    const a11yCheck = await client.callTool({
      name: 'mcp__playwright__browser_check_accessibility',
      arguments: {
        rules: ['image-alt', 'label'],
        level: 'A'
      }
    });
    const report = JSON.parse(a11yCheck.content[0].text);
    console.log(`Accessibility violations: ${report.summary.totalViolations}`);
    
    // 6. Advanced Waiting Demo
    console.log('\n6️⃣ Advanced Waiting (Phase 3)\n');
    
    // Wait for a custom condition
    const customWait = await client.callTool({
      name: 'mcp__playwright__browser_wait_for_function',
      arguments: {
        code: 'return document.querySelectorAll("p").length > 0',
        timeout: 5000
      }
    });
    console.log('Custom wait completed:', JSON.parse(customWait.content[0].text).success);
    
    // 7. Inject and test dynamic content
    console.log('\n7️⃣ Dynamic Content Injection & Testing\n');
    
    // Add a test element
    await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          const testDiv = document.createElement('div');
          testDiv.id = 'phase3-test';
          testDiv.className = 'test-element';
          testDiv.textContent = 'Phase 3 Test Element';
          testDiv.style.padding = '10px';
          testDiv.style.backgroundColor = '#e0f0ff';
          document.body.appendChild(testDiv);
        `
      }
    });
    
    // Wait for it to appear
    await client.callTool({
      name: 'mcp__playwright__browser_wait_for_selector',
      arguments: {
        selector: '#phase3-test',
        state: 'visible'
      }
    });
    
    // Query it with Phase 3 tools
    const testElement = await client.callTool({
      name: 'mcp__playwright__browser_query_selector',
      arguments: {
        selector: '#phase3-test',
        returnType: 'properties'
      }
    });
    console.log('Test element created:', JSON.parse(testElement.content[0].text));
    
    // 8. Performance Metrics
    console.log('\n8️⃣ Performance Metrics (Phase 3)\n');
    
    const metrics = await client.callTool({
      name: 'mcp__playwright__browser_get_metrics',
      arguments: {
        type: 'performance'
      }
    });
    const perf = JSON.parse(metrics.content[0].text);
    console.log('Performance metrics:');
    console.log(`  - DOM Content Loaded: ${perf.performance?.domContentLoaded}ms`);
    console.log(`  - Total Load Time: ${perf.performance?.totalLoadTime}ms`);
    console.log(`  - First Paint: ${perf.performance?.firstPaint}ms`);
    
    console.log('\n✅ Phase 3 Demo Complete!');
    console.log('\n🎯 Key Phase 3 Advantages Demonstrated:');
    console.log('  - Direct DOM queries without JavaScript evaluation');
    console.log('  - Structured data extraction with type safety');
    console.log('  - Built-in accessibility testing');
    console.log('  - Advanced waiting strategies');
    console.log('  - Performance metrics collection');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Clean up: Close the tab
    try {
      await client.callTool({
        name: 'browser_close',
        arguments: {}
      });
      console.log('\n🧹 Closed browser tab');
    } catch (e) {
      // Ignore cleanup errors
    }
    
    await client.close();
  }
}

// Run the demo
console.log('🎭 Phase 3 Features - Live Demo\n');
livePhase3Demo().catch(console.error);