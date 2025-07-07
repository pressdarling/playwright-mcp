#!/usr/bin/env node

/**
 * Enhanced Live Adapter Testing with Phase 3 Features
 * Demonstrates the improved capabilities for live-analyze-adapt workflows
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function enhancedLiveAdapterTesting() {
  const client = new Client({ name: 'adapter-test-v2', version: '1.0.0' });
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('Connected to MCP server\n');
    
    // Navigate to target site
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example-shop.com/products' }
    });
    
    // Wait for page to be ready
    await client.callTool({
      name: 'mcp__playwright__browser_wait_for_load_state',
      arguments: { state: 'networkidle' }
    });
    
    console.log('📊 Step 1: Test Selectors Dynamically (Enhanced)\n');
    
    // Use Phase 3 DOM tools for more efficient selector testing
    const selectors = [
      '.product-item',
      '[data-testid="product"]',
      '.item-card',
      'article.product',
      '.product',
      '[class*="product"]'
    ];
    
    const selectorResults = {};
    for (const selector of selectors) {
      const result = await client.callTool({
        name: 'mcp__playwright__browser_query_selector',
        arguments: {
          selector,
          returnType: 'count'
        }
      });
      selectorResults[selector] = JSON.parse(result.content[0].text);
    }
    
    console.log('Selector test results:', selectorResults);
    const bestSelector = Object.entries(selectorResults)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a)[0]?.[0];
    
    console.log(`Best selector found: ${bestSelector} (${selectorResults[bestSelector]} items)\n`);
    
    console.log('🔍 Step 2: Analyze Product Structure\n');
    
    // Get detailed information about product elements
    const productElements = await client.callTool({
      name: 'mcp__playwright__browser_query_selector_all',
      arguments: {
        selector: bestSelector,
        limit: 3 // Analyze first 3 products
      }
    });
    
    const products = JSON.parse(productElements.content[0].text);
    console.log(`Analyzing ${products.length} sample products...`);
    
    // Analyze common attributes
    const commonAttributes = new Set();
    products.forEach(product => {
      Object.keys(product.attributes).forEach(attr => commonAttributes.add(attr));
    });
    console.log('Common attributes found:', Array.from(commonAttributes));
    
    console.log('\n🌐 Step 3: Monitor Network Activity (Enhanced)\n');
    
    // Set up network monitoring for API patterns
    await client.callTool({
      name: 'mcp__playwright__browser_route',
      arguments: {
        pattern: '**/api/**',
        handler: {
          continue: {
            headers: { 'X-Adapter-Monitor': 'true' }
          }
        }
      }
    });
    
    // Trigger some product interactions to capture API calls
    if (bestSelector) {
      await client.callTool({
        name: 'browser_click',
        arguments: {
          element: `first product item`,
          ref: `${bestSelector}:first-child`
        }
      });
      
      // Wait for potential API calls
      await client.callTool({
        name: 'mcp__playwright__browser_wait_for_function',
        arguments: {
          code: 'return window.performance.getEntriesByType("resource").length > 10',
          timeout: 3000
        }
      }).catch(() => console.log('No additional resources loaded'));
    }
    
    // Get network requests
    const requests = await client.callTool({
      name: 'mcp__playwright__browser_get_requests',
      arguments: {
        filter: { url: '*api*' }
      }
    });
    
    const apiCalls = JSON.parse(requests.content[0].text);
    console.log(`Captured ${apiCalls.length} API calls`);
    
    console.log('\n🔧 Step 4: Live Adapter Development & Testing\n');
    
    // Build adapter based on discovered structure
    const adapterCode = `
      window.EnhancedProductAdapter = {
        // Selector discovered through testing
        productSelector: '${bestSelector || '.product-item'}',
        
        // Extract products with discovered structure
        getProducts: async function() {
          const products = [];
          const elements = document.querySelectorAll(this.productSelector);
          
          for (const el of elements) {
            try {
              const product = {
                // Core data
                title: this.extractText(el, ['h2', 'h3', '.title', '.name', '[class*="title"]']),
                price: this.extractPrice(el),
                image: this.extractImage(el),
                link: this.extractLink(el),
                
                // Additional data based on discovered attributes
                attributes: this.extractAttributes(el),
                
                // Metadata
                position: Array.from(elements).indexOf(el),
                elementId: el.id || null,
                classes: el.className
              };
              
              products.push(product);
            } catch (e) {
              console.error('Error parsing product:', e);
            }
          }
          
          return products;
        },
        
        // Helper methods
        extractText: function(el, selectors) {
          for (const selector of selectors) {
            const textEl = el.querySelector(selector);
            if (textEl?.textContent?.trim()) {
              return textEl.textContent.trim();
            }
          }
          return '';
        },
        
        extractPrice: function(el) {
          const priceSelectors = ['.price', '[class*="price"]', '[data-price]'];
          const priceText = this.extractText(el, priceSelectors);
          
          // Extract numeric price
          const match = priceText.match(/[\\d,]+\\.?\\d*/);
          return {
            display: priceText,
            value: match ? parseFloat(match[0].replace(',', '')) : null,
            currency: priceText.match(/[$€£¥]/)?.[0] || '$'
          };
        },
        
        extractImage: function(el) {
          const img = el.querySelector('img');
          return {
            src: img?.src || '',
            alt: img?.alt || '',
            srcset: img?.srcset || ''
          };
        },
        
        extractLink: function(el) {
          const link = el.querySelector('a');
          return {
            href: link?.href || '',
            text: link?.textContent?.trim() || ''
          };
        },
        
        extractAttributes: function(el) {
          const attrs = {};
          
          // Common e-commerce attributes
          const attrSelectors = {
            brand: ['.brand', '[class*="brand"]'],
            rating: ['.rating', '[class*="rating"]', '[data-rating]'],
            reviews: ['.reviews', '[class*="review"]'],
            availability: ['.availability', '[class*="stock"]', '[data-availability]'],
            sku: ['[data-sku]', '.sku'],
            category: ['.category', '[data-category]']
          };
          
          for (const [key, selectors] of Object.entries(attrSelectors)) {
            attrs[key] = this.extractText(el, selectors);
          }
          
          return attrs;
        },
        
        // Validation method
        validate: function() {
          const products = this.getProducts();
          const validation = {
            count: products.length,
            complete: 0,
            issues: []
          };
          
          products.forEach((product, i) => {
            const required = ['title', 'price'];
            const missing = required.filter(field => !product[field]);
            
            if (missing.length === 0) {
              validation.complete++;
            } else {
              validation.issues.push({
                index: i,
                missing: missing
              });
            }
          });
          
          validation.completeness = (validation.complete / validation.count * 100).toFixed(1) + '%';
          return validation;
        }
      };
      
      console.log('Enhanced ProductAdapter injected successfully');
    `;
    
    // Inject the enhanced adapter
    await client.callTool({
      name: 'mcp__playwright__browser_add_script_tag',
      arguments: { content: adapterCode }
    });
    
    // Test the adapter
    const adapterTest = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          const adapter = window.EnhancedProductAdapter;
          const products = await adapter.getProducts();
          const validation = adapter.validate();
          
          return {
            success: true,
            productCount: products.length,
            sampleProducts: products.slice(0, 3),
            validation: validation
          };
        `
      }
    });
    
    const results = JSON.parse(adapterTest.content[0].text);
    console.log(`Extracted ${results.productCount} products`);
    console.log(`Data completeness: ${results.validation.completeness}`);
    
    if (results.validation.issues.length > 0) {
      console.log(`\nData quality issues found in ${results.validation.issues.length} products`);
    }
    
    console.log('\n📈 Step 5: Advanced Analysis with Phase 3 Tools\n');
    
    // Check page performance
    const metrics = await client.callTool({
      name: 'mcp__playwright__browser_get_metrics',
      arguments: { type: 'all' }
    });
    
    const pageMetrics = JSON.parse(metrics.content[0].text);
    console.log('Page Performance:');
    console.log(`- Total load time: ${pageMetrics.performance?.totalLoadTime}ms`);
    console.log(`- First contentful paint: ${pageMetrics.performance?.firstContentfulPaint}ms`);
    console.log(`- Resources loaded: ${pageMetrics.resources?.total}`);
    
    // Accessibility check on product elements
    const a11yCheck = await client.callTool({
      name: 'mcp__playwright__browser_check_accessibility',
      arguments: {
        selector: bestSelector,
        rules: ['image-alt', 'label', 'color-contrast'],
        level: 'AA'
      }
    });
    
    const a11yReport = JSON.parse(a11yCheck.content[0].text);
    console.log(`\nAccessibility: ${a11yReport.summary.totalViolations} issues found`);
    
    // Wait for any lazy-loaded content
    await client.callTool({
      name: 'mcp__playwright__browser_wait_for_selector',
      arguments: {
        selector: '[class*="lazy-loaded"]',
        state: 'attached',
        timeout: 2000
      }
    }).catch(() => console.log('No lazy-loaded content detected'));
    
    console.log('\n✅ Enhanced live adapter testing complete!');
    console.log('\nKey improvements with Phase 3:');
    console.log('- Direct DOM queries without JavaScript evaluation');
    console.log('- Built-in wait strategies for dynamic content');
    console.log('- Performance metrics and accessibility checks');
    console.log('- More robust selector discovery');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

// Run the enhanced test
console.log('🚀 Enhanced Live Adapter Testing with Phase 3 Features\n');
enhancedLiveAdapterTesting().catch(console.error);