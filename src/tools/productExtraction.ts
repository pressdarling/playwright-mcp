/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from 'zod';

import { defineTool } from './tool.js';
import * as javascript from '../javascript.js';

const extractProductsSchema = z.object({
  limit: z.number().optional().describe('Maximum number of products to return (default: 20)'),
  minScore: z.number().optional().describe('Minimum product confidence score threshold (default: 3)'),
  includeImages: z.boolean().optional().describe('Include base64 image data (default: false)'),
  selector: z.string().optional().describe('Optional custom container selector to use instead of auto-detection'),
});

const extractProducts = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_extract_products',
    title: 'Extract products from e-commerce page',
    description: 'Identify and extract product listing containers from e-commerce pages, reducing token usage and improving site adapter development workflow',
    inputSchema: extractProductsSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const limit = params.limit ?? 20;
    const minScore = params.minScore ?? 3;
    const includeImages = params.includeImages ?? false;
    const customSelector = params.selector;

    const code = [
      `// Extract products from e-commerce page`,
      `// Limit: ${limit}, Min Score: ${minScore}, Include Images: ${includeImages}`,
      customSelector ? `// Using custom selector: ${customSelector}` : '// Using auto-detection',
    ];

    const extractionScript = `
      (function() {
        const startTime = performance.now();
        
        // Common product container selectors
        const productSelectors = [
          '[data-product]', '[data-product-id]', '[data-testid*="product"]',
          '.product-item', '.product-card', '.product-tile', '.product-listing-item',
          '.product', '.item', '.listing-item', '.search-result-item',
          '[class*="product"]', '[class*="item"]', '[id*="product"]'
        ];
        
        // Score containers by product-like characteristics
        function scoreProductContainer(element) {
          let score = 0;
          
          // Check for image
          if (element.querySelector('img')) score += 2;
          
          // Check for price indicators
          if (element.querySelector('[class*="price"], [class*="cost"], [class*="amount"], .price, .cost')) score += 3;
          
          // Check for product links
          if (element.querySelector('a[href*="/product"], a[href*="/item"], a[href*="/p/"]')) score += 2;
          
          // Check for add to cart buttons
          if (element.querySelector('button[class*="add"], button[class*="cart"], [class*="add-to-cart"]')) score += 1;
          
          // Check for product titles
          if (element.querySelector('h1, h2, h3, h4, h5, h6, .title, .name, [class*="title"], [class*="name"]')) score += 1;
          
          // Check for ratings/reviews
          if (element.querySelector('[class*="rating"], [class*="review"], [class*="star"]')) score += 1;
          
          return score;
        }
        
        // Extract text from element, trying multiple selectors
        function extractText(container, selectors) {
          for (const selector of selectors) {
            const element = container.querySelector(selector);
            if (element) {
              return element.textContent?.trim() || '';
            }
          }
          return '';
        }
        
        // Generate CSS selector for element
        function generateSelector(element) {
          if (element.id) return '#' + element.id;
          if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) return '.' + classes.join('.');
          }
          return element.tagName.toLowerCase() + ':nth-child(' + (Array.from(element.parentNode?.children || []).indexOf(element) + 1) + ')';
        }
        
        // Extract product data from container with actionable selectors
        function extractProductData(container, index) {
          const titleSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.title', '.name', '.product-name', '[class*="title"]', '[class*="name"]'];
          const priceSelectors = ['.price', '.cost', '[class*="price"]', '[class*="cost"]', '[class*="amount"]'];
          const linkSelectors = ['a[href*="/product"]', 'a[href*="/item"]', 'a[href*="/p/"]', 'a'];
          
          // Enhanced element finder that returns both value and selector
          function findElement(container, selectors, type) {
            for (const selector of selectors) {
              const element = container.querySelector(selector);
              if (element) {
                return {
                  text: element.textContent?.trim() || '',
                  selector: selector,
                  element: generateSelector(element),
                  tagName: element.tagName.toLowerCase(),
                  attributes: {
                    id: element.id || null,
                    className: element.className || null,
                    href: element.href || null,
                    src: element.src || element.dataset?.src || null
                  }
                };
              }
            }
            return null;
          }
          
          // Find title element
          const titleElement = findElement(container, titleSelectors, 'title');
          
          // Find price element  
          const priceElement = findElement(container, priceSelectors, 'price');
          
          // Find link element
          const linkElement = findElement(container, linkSelectors, 'link');
          
          // Find image element
          const imgElement = container.querySelector('img');
          const imageData = imgElement ? {
            src: imgElement.src || imgElement.dataset?.src || '',
            alt: imgElement.alt || '',
            selector: generateSelector(imgElement),
            attributes: {
              id: imgElement.id || null,
              className: imgElement.className || null,
              'data-src': imgElement.dataset?.src || null,
              srcset: imgElement.srcset || null
            }
          } : null;
          
          const containerSelector = generateSelector(container);
          const score = scoreProductContainer(container);
          
          // Extract structured child elements for code generation
          const structure = {
            container: {
              tagName: container.tagName.toLowerCase(),
              selector: containerSelector,
              id: container.id || null,
              className: container.className || null
            },
            elements: {
              title: titleElement,
              price: priceElement,
              link: linkElement,
              image: imageData
            }
          };
          
          // Extract additional semantic elements
          const additionalElements = {};
          
          // Brand element
          const brandEl = container.querySelector('.brand, [class*="brand"]');
          if (brandEl) {
            additionalElements.brand = {
              text: brandEl.textContent?.trim() || '',
              selector: generateSelector(brandEl),
              tagName: brandEl.tagName.toLowerCase()
            };
          }
          
          // Rating element
          const ratingEl = container.querySelector('.rating, [class*="rating"], [class*="star"]');
          if (ratingEl) {
            additionalElements.rating = {
              text: ratingEl.textContent?.trim() || '',
              selector: generateSelector(ratingEl),
              tagName: ratingEl.tagName.toLowerCase()
            };
          }
          
          // Add to cart button
          const addToCartEl = container.querySelector('button[class*="add"], button[class*="cart"], [class*="add-to-cart"]');
          if (addToCartEl) {
            additionalElements.addToCart = {
              text: addToCartEl.textContent?.trim() || '',
              selector: generateSelector(addToCartEl),
              tagName: addToCartEl.tagName.toLowerCase(),
              attributes: {
                type: addToCartEl.type,
                disabled: addToCartEl.disabled
              }
            };
          }
          
          return {
            // Legacy fields for backward compatibility
            title: titleElement?.text || '',
            price: priceElement?.text || '',
            image: imageData?.src || '',
            link: linkElement?.attributes?.href || '',
            selector: containerSelector,
            score,
            
            // New structured data for code generation
            structure,
            elements: {
              ...structure.elements,
              ...additionalElements
            },
            
            // Code generation helpers
            codeGeneration: {
              containerSelector: containerSelector,
              titleSelector: titleElement?.selector,
              priceSelector: priceElement?.selector,
              linkSelector: linkElement?.selector,
              imageSelector: imageData?.selector,
              
              // Example Playwright code
              playwrightCode: [
                \`// Container: \${containerSelector}\`,
                titleElement ? \`const title = await page.locator('\${containerSelector} \${titleElement.selector}').textContent();\` : '',
                priceElement ? \`const price = await page.locator('\${containerSelector} \${priceElement.selector}').textContent();\` : '',
                linkElement ? \`const link = await page.locator('\${containerSelector} \${linkElement.selector}').getAttribute('href');\` : '',
                imageData ? \`const image = await page.locator('\${containerSelector} \${imageData.selector}').getAttribute('src');\` : ''
              ].filter(line => line)
            }
          };
        }
        
        let productContainers;
        
        if (${customSelector ? `'${customSelector}'` : 'null'}) {
          // Use custom selector
          productContainers = Array.from(document.querySelectorAll('${customSelector || ''}'));
        } else {
          // Auto-detect product containers
          const allContainers = new Set();
          
          for (const selector of productSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => allContainers.add(el));
          }
          
          productContainers = Array.from(allContainers);
        }
        
        // Score and filter containers
        const scoredContainers = productContainers.map(container => ({
          element: container,
          score: scoreProductContainer(container)
        })).filter(item => item.score >= ${minScore});
        
        // Sort by score descending
        scoredContainers.sort((a, b) => b.score - a.score);
        
        // Extract product data
        const products = scoredContainers.slice(0, ${limit}).map((item, index) => {
          const productData = extractProductData(item.element, index);
          return productData;
        });
        
        // Generate container summary
        const containerSummary = {};
        scoredContainers.forEach(item => {
          const tagName = item.element.tagName.toLowerCase();
          const className = item.element.className;
          const key = className ? \`\${tagName}.\${className.split(' ')[0]}\` : tagName;
          
          if (!containerSummary[key]) {
            containerSummary[key] = { count: 0, totalScore: 0 };
          }
          containerSummary[key].count++;
          containerSummary[key].totalScore += item.score;
        });
        
        const containerResults = Object.entries(containerSummary).map(([selector, data]) => ({
          selector,
          count: data.count,
          score: Math.round(data.totalScore / data.count)
        })).sort((a, b) => b.count - a.count);
        
        const processingTime = Math.round(performance.now() - startTime);
        
        return {
          products,
          containers: containerResults,
          totalFound: scoredContainers.length,
          processingTime
        };
      })();
    `;

    code.push(`const result = ${extractionScript}`);

    const action = async () => {
      const result = await tab.page.evaluate(extractionScript) as {
        products: Array<{
          title: string;
          price: string;
          image: string;
          link: string;
          selector: string;
          score: number;
          attributes: Record<string, string>;
          imageData?: string;
        }>;
        containers: Array<{
          selector: string;
          count: number;
          score: number;
        }>;
        totalFound: number;
        processingTime: number;
      };
      
      // If includeImages is true, fetch image data
      if (includeImages && result.products) {
        for (const product of result.products) {
          if (product.image) {
            try {
              const imageData = await tab.page.evaluate((imgSrc) => {
                return new Promise<string>((resolve) => {
                  const img = new Image();
                  img.crossOrigin = 'anonymous';
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                  };
                  img.onerror = () => resolve('');
                  img.src = imgSrc;
                });
              }, product.image);
              
              if (imageData) {
                product.imageData = imageData;
              }
            } catch (error) {
              // Ignore image extraction errors
            }
          }
        }
      }
      
      return {
        content: [{
          type: 'text' as 'text',
          text: JSON.stringify(result, null, 2),
        }]
      };
    };

    return {
      code,
      action,
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default [
  extractProducts,
];