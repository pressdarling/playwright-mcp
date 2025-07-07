#!/usr/bin/env node

/**
 * Live Adapter Testing Example
 * Shows how to test and iterate on web scrapers/adapters in real-time
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function liveAdapterTesting() {
  const client = new Client({ name: 'adapter-test', version: '1.0.0' });
  
  try {
    const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
    await client.connect(transport);
    console.log('Connected to MCP server\n');
    
    // Navigate to target site (example: e-commerce site)
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example-shop.com/products' }
    });
    
    console.log('📊 Step 1: Test Selectors Dynamically\n');
    
    // Test various selectors to find the right ones
    const selectorTests = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          const selectors = {
            '.product-item': document.querySelectorAll('.product-item').length,
            '[data-testid="product"]': document.querySelectorAll('[data-testid="product"]').length,
            '.item-card': document.querySelectorAll('.item-card').length,
            'article.product': document.querySelectorAll('article.product').length
          };
          
          console.log('Selector test results:', selectors);
          
          // Find the best selector
          const best = Object.entries(selectors)
            .filter(([_, count]) => count > 0)
            .sort(([_, a], [__, b]) => b - a)[0];
            
          return { selectors, best: best ? best[0] : null };
        `
      }
    });
    
    const results = JSON.parse(selectorTests.content[0].text);
    console.log('Best selector found:', results.best);
    console.log('All results:', results.selectors);
    
    console.log('\n🌐 Step 2: Monitor Network Activity\n');
    
    // Set up network monitoring for API calls
    const requests = await client.callTool({
      name: 'mcp__playwright__browser_get_requests',
      arguments: {
        filter: { url: '*api*' }
      }
    });
    
    const apiCalls = JSON.parse(requests.content[0].text);
    console.log(`Found ${apiCalls.length} API calls`);
    apiCalls.forEach(req => {
      console.log(`- ${req.method} ${req.url}`);
    });
    
    console.log('\n🔧 Step 3: Live Adapter Testing\n');
    
    // Inject adapter code
    await client.callTool({
      name: 'mcp__playwright__browser_add_script_tag',
      arguments: {
        content: `
          window.ProductAdapter = {
            getProducts: function() {
              const products = [];
              const selector = '${results.best || '.product-item'}';
              
              document.querySelectorAll(selector).forEach(el => {
                try {
                  const product = {
                    title: el.querySelector('h2, h3, .title')?.textContent?.trim(),
                    price: el.querySelector('.price, [class*="price"]')?.textContent?.trim(),
                    image: el.querySelector('img')?.src,
                    link: el.querySelector('a')?.href
                  };
                  products.push(product);
                } catch (e) {
                  console.error('Error parsing product:', e);
                }
              });
              
              return products;
            },
            
            getFilters: function() {
              const filters = {};
              
              // Try to find filter elements
              document.querySelectorAll('[class*="filter"], [id*="filter"]').forEach(el => {
                const label = el.querySelector('label')?.textContent?.trim();
                const value = el.querySelector('input:checked, select')?.value;
                if (label && value) {
                  filters[label] = value;
                }
              });
              
              return filters;
            }
          };
          
          console.log('ProductAdapter injected successfully');
        `
      }
    });
    
    // Test the adapter
    const adapterTest = await client.callTool({
      name: 'mcp__playwright__browser_evaluate',
      arguments: {
        code: `
          const products = window.ProductAdapter.getProducts();
          const filters = window.ProductAdapter.getFilters();
          
          console.log(\`Extracted \${products.length} products\`);
          console.log('Sample product:', products[0]);
          console.log('Active filters:', filters);
          
          return {
            productCount: products.length,
            sampleProduct: products[0],
            filters: filters,
            hasValidData: products.length > 0 && products[0]?.title
          };
        `
      }
    });
    
    const adapterResults = JSON.parse(adapterTest.content[0].text);
    console.log('Adapter test results:', adapterResults);
    
    // Check console for errors
    const consoleLogs = await client.callTool({
      name: 'browser_console_messages',
      arguments: {}
    });
    
    const logs = JSON.parse(consoleLogs.content[0].text);
    const errors = logs.filter(log => log.type === 'error');
    if (errors.length > 0) {
      console.log('\n⚠️  Console errors detected:');
      errors.forEach(err => console.log(`- ${err.text}`));
    }
    
    console.log('\n🔍 Step 4: Advanced Analysis\n');
    
    // Extract structured data from all products
    const structuredData = await client.callTool({
      name: 'mcp__playwright__browser_eval_on_selector_all',
      arguments: {
        selector: results.best || '.product-item',
        code: `
          return elements.map((el, index) => {
            const getText = (selector) => el.querySelector(selector)?.textContent?.trim() || '';
            const getAttr = (selector, attr) => el.querySelector(selector)?.getAttribute(attr) || '';
            
            return {
              index,
              title: getText('h2, h3, .title, .name'),
              price: getText('.price, [class*="price"]'),
              image: getAttr('img', 'src'),
              link: getAttr('a', 'href'),
              inStock: !el.classList.contains('out-of-stock'),
              attributes: {
                brand: getText('.brand, [class*="brand"]'),
                rating: getText('.rating, [class*="rating"]'),
                reviews: getText('.reviews, [class*="review"]')
              }
            };
          });
        `
      }
    });
    
    const products = JSON.parse(structuredData.content[0].text);
    console.log(`Extracted ${products.length} products with structured data`);
    
    // Validate extraction accuracy
    const validation = products.reduce((acc, product) => {
      acc.hasTitle += product.title ? 1 : 0;
      acc.hasPrice += product.price ? 1 : 0;
      acc.hasImage += product.image ? 1 : 0;
      acc.hasLink += product.link ? 1 : 0;
      return acc;
    }, { hasTitle: 0, hasPrice: 0, hasImage: 0, hasLink: 0 });
    
    console.log('\nExtraction accuracy:');
    console.log(`- Titles: ${validation.hasTitle}/${products.length} (${Math.round(validation.hasTitle/products.length*100)}%)`);
    console.log(`- Prices: ${validation.hasPrice}/${products.length} (${Math.round(validation.hasPrice/products.length*100)}%)`);
    console.log(`- Images: ${validation.hasImage}/${products.length} (${Math.round(validation.hasImage/products.length*100)}%)`);
    console.log(`- Links: ${validation.hasLink}/${products.length} (${Math.round(validation.hasLink/products.length*100)}%)`);
    
    console.log('\n✅ Live adapter testing complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

// Run the test
liveAdapterTesting().catch(console.error);