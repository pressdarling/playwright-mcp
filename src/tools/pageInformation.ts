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
import { defineTool, type ToolFactory } from './tool.js';

const getTitle: ToolFactory = captureSnapshot => defineTool({
  capability: 'info',
  
  schema: {
    name: 'mcp__playwright__browser_get_title',
    title: 'Get page title',
    description: 'Get the current page title',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// Get page title`,
      `const title = await page.title();`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        const title = await tab.page.title();
        
        return {
          content: [{
            type: 'text',
            text: title,
          }],
        };
      },
    };
  },
});

const getUrl: ToolFactory = captureSnapshot => defineTool({
  capability: 'info',
  
  schema: {
    name: 'mcp__playwright__browser_get_url',
    title: 'Get current URL',
    description: 'Get the current page URL',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// Get current URL`,
      `const url = page.url();`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        const url = tab.page.url();
        
        return {
          content: [{
            type: 'text',
            text: url,
          }],
        };
      },
    };
  },
});

const getHtml: ToolFactory = captureSnapshot => defineTool({
  capability: 'info',
  
  schema: {
    name: 'mcp__playwright__browser_get_html',
    title: 'Get page HTML',
    description: 'Get the full HTML content of the page',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector to get HTML from specific element'),
      outer: z.boolean().optional().describe('Include outer HTML (default: true)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = params.selector ? [
      `// Get HTML from: ${params.selector}`,
      `const html = await page.locator('${params.selector}').first().evaluate(`,
      `  el => ${params.outer !== false ? 'el.outerHTML' : 'el.innerHTML'}`,
      `);`,
    ] : [
      `// Get full page HTML`,
      `const html = await page.content();`,
    ];

    return {
      code,
      captureSnapshot: false, // HTML is already being returned, no need for snapshot
      waitForNetwork: false,
      action: async () => {
        let html: string;
        
        if (params.selector) {
          const element = tab.page.locator(params.selector).first();
          const exists = await element.count() > 0;
          
          if (!exists) {
            throw new Error(`Element not found: ${params.selector}`);
          }
          
          html = await element.evaluate(
            (el: Element, outer: boolean) => outer ? el.outerHTML : el.innerHTML,
            params.outer !== false
          );
        } else {
          html = await tab.page.content();
        }
        
        return {
          content: [{
            type: 'text',
            text: html,
          }],
        };
      },
    };
  },
});

const getMetrics: ToolFactory = captureSnapshot => defineTool({
  capability: 'info',
  
  schema: {
    name: 'mcp__playwright__browser_get_metrics',
    title: 'Get page metrics',
    description: 'Get performance and resource metrics for the page',
    inputSchema: z.object({
      type: z.enum(['performance', 'memory', 'navigation', 'all']).optional()
        .describe('Type of metrics to retrieve (default: all)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// Get page metrics`,
      `const metrics = await page.evaluate(() => {`,
      `  const perf = performance.getEntriesByType('navigation')[0];`,
      `  return {`,
      `    performance: {`,
      `      domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,`,
      `      loadComplete: perf.loadEventEnd - perf.loadEventStart,`,
      `      // ... more metrics`,
      `    },`,
      `    memory: performance.memory ? {`,
      `      usedJSHeapSize: performance.memory.usedJSHeapSize,`,
      `      totalJSHeapSize: performance.memory.totalJSHeapSize,`,
      `    } : null,`,
      `  };`,
      `});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        const metrics = await tab.page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const paint = performance.getEntriesByType('paint');
          
          const result: any = {};
          
          // Performance metrics
          if (!params || params.type === 'performance' || params.type === 'all') {
            result.performance = {
              domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
              loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
              domInteractive: Math.round(navigation.domInteractive - navigation.fetchStart),
              timeToFirstByte: Math.round(navigation.responseStart - navigation.requestStart),
              totalLoadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart),
              firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
              firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
            };
          }
          
          // Memory metrics (Chrome only)
          if (!params || params.type === 'memory' || params.type === 'all') {
            if ((performance as any).memory) {
              result.memory = {
                usedJSHeapSize: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
                totalJSHeapSize: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
                jsHeapSizeLimit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024),
                unit: 'MB',
              };
            }
          }
          
          // Navigation metrics
          if (!params || params.type === 'navigation' || params.type === 'all') {
            result.navigation = {
              type: navigation.type,
              redirectCount: navigation.redirectCount,
              transferSize: navigation.transferSize,
              encodedBodySize: navigation.encodedBodySize,
              decodedBodySize: navigation.decodedBodySize,
            };
          }
          
          // Resource count
          if (!params || params.type === 'all') {
            const resources = performance.getEntriesByType('resource');
            const resourcesByType: Record<string, number> = {};
            
            resources.forEach(resource => {
              const url = new URL(resource.name);
              const ext = url.pathname.split('.').pop() || 'other';
              resourcesByType[ext] = (resourcesByType[ext] || 0) + 1;
            });
            
            result.resources = {
              total: resources.length,
              byType: resourcesByType,
            };
          }
          
          return result;
        }, params);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(metrics, null, 2),
          }],
        };
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  getTitle(captureSnapshot),
  getUrl(captureSnapshot),
  getHtml(captureSnapshot),
  getMetrics(captureSnapshot),
];