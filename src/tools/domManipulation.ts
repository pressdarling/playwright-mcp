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

const querySelector: ToolFactory = captureSnapshot => defineTool({
  capability: 'dom',
  
  schema: {
    name: 'mcp__playwright__browser_query_selector',
    title: 'Find single element',
    description: 'Find the first element matching a CSS selector',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector to find element'),
      returnType: z.enum(['exists', 'count', 'properties']).optional()
        .describe('What to return: exists (boolean), count (number), or properties (object)')
        .default('properties'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// Find element: ${params.selector}`,
      `const element = await page.locator('${params.selector}').first();`,
      params.returnType === 'exists' ? 
        `const exists = await element.count() > 0;` :
      params.returnType === 'count' ?
        `const count = await page.locator('${params.selector}').count();` :
        `const properties = await element.evaluate(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          visible: el.offsetParent !== null,
          boundingBox: el.getBoundingClientRect(),
        }));`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        const element = tab.page.locator(params.selector).first();
        
        if (params.returnType === 'exists') {
          const exists = await element.count() > 0;
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(exists),
            }],
          };
        }
        
        if (params.returnType === 'count') {
          const count = await tab.page.locator(params.selector).count();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(count),
            }],
          };
        }
        
        // Default: return properties
        const exists = await element.count() > 0;
        if (!exists) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(null),
            }],
          };
        }
        
        const properties = await element.evaluate((el: Element) => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          textContent: el.textContent?.trim() || '',
          visible: (el as HTMLElement).offsetParent !== null,
          boundingBox: el.getBoundingClientRect(),
          attributes: Object.fromEntries(
            Array.from(el.attributes).map(attr => [attr.name, attr.value])
          ),
        }));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(properties, null, 2),
          }],
        };
      },
    };
  },
});

const querySelectorAll: ToolFactory = captureSnapshot => defineTool({
  capability: 'dom',
  
  schema: {
    name: 'mcp__playwright__browser_query_selector_all',
    title: 'Find all elements',
    description: 'Find all elements matching a CSS selector',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector to find elements'),
      limit: z.number().optional().describe('Maximum number of elements to return'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// Find all elements: ${params.selector}`,
      `const elements = await page.locator('${params.selector}').all();`,
      params.limit ? `const limited = elements.slice(0, ${params.limit});` : '',
      `const data = await Promise.all(limited.map(el => el.evaluate(...)));`,
    ].filter(Boolean);

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        const elements = await tab.page.locator(params.selector).all();
        const limited = params.limit ? elements.slice(0, params.limit) : elements;
        
        const data = await Promise.all(limited.map(async (element, index) => {
          return element.evaluate((el: Element, idx: number) => ({
            index: idx,
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            textContent: el.textContent?.trim() || '',
            visible: (el as HTMLElement).offsetParent !== null,
            attributes: Object.fromEntries(
              Array.from(el.attributes).map(attr => [attr.name, attr.value])
            ),
          }), index);
        }));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(data, null, 2),
          }],
        };
      },
    };
  },
});

const getAttribute: ToolFactory = captureSnapshot => defineTool({
  capability: 'dom',
  
  schema: {
    name: 'mcp__playwright__browser_get_attribute',
    title: 'Get element attribute',
    description: 'Get attribute value from an element',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector to find element'),
      attribute: z.string().describe('Attribute name to get'),
      all: z.boolean().optional().describe('Get from all matching elements'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = params.all ? [
      `// Get attribute "${params.attribute}" from all: ${params.selector}`,
      `const elements = await page.locator('${params.selector}').all();`,
      `const values = await Promise.all(elements.map(el => el.getAttribute('${params.attribute}')));`,
    ] : [
      `// Get attribute "${params.attribute}" from: ${params.selector}`,
      `const value = await page.locator('${params.selector}').first().getAttribute('${params.attribute}');`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        if (params.all) {
          const elements = await tab.page.locator(params.selector).all();
          const values = await Promise.all(
            elements.map(el => el.getAttribute(params.attribute))
          );
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(values),
            }],
          };
        } else {
          const value = await tab.page.locator(params.selector).first().getAttribute(params.attribute);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(value),
            }],
          };
        }
      },
    };
  },
});

const setAttribute: ToolFactory = captureSnapshot => defineTool({
  capability: 'dom',
  
  schema: {
    name: 'mcp__playwright__browser_set_attribute',
    title: 'Set element attribute',
    description: 'Set attribute value on an element',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector to find element'),
      attribute: z.string().describe('Attribute name to set'),
      value: z.string().describe('Attribute value to set'),
      all: z.boolean().optional().describe('Set on all matching elements'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = params.all ? [
      `// Set attribute "${params.attribute}" on all: ${params.selector}`,
      `await page.locator('${params.selector}').evaluateAll((elements, { attr, val }) => {`,
      `  elements.forEach(el => el.setAttribute(attr, val));`,
      `}, { attr: '${params.attribute}', val: '${params.value}' });`,
    ] : [
      `// Set attribute "${params.attribute}" on: ${params.selector}`,
      `await page.locator('${params.selector}').first().evaluate((el, { attr, val }) => {`,
      `  el.setAttribute(attr, val);`,
      `}, { attr: '${params.attribute}', val: '${params.value}' });`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        if (params.all) {
          await tab.page.locator(params.selector).evaluateAll(
            (elements: Element[], { attr, val }) => {
              elements.forEach(el => el.setAttribute(attr, val));
            },
            { attr: params.attribute, val: params.value }
          );
          const count = await tab.page.locator(params.selector).count();
          return {
            content: [{
              type: 'text',
              text: `Set attribute "${params.attribute}" to "${params.value}" on ${count} element(s)`,
            }],
          };
        } else {
          await tab.page.locator(params.selector).first().evaluate(
            (el: Element, { attr, val }) => {
              el.setAttribute(attr, val);
            },
            { attr: params.attribute, val: params.value }
          );
          return {
            content: [{
              type: 'text',
              text: `Set attribute "${params.attribute}" to "${params.value}"`,
            }],
          };
        }
      },
    };
  },
});

const getTextContent: ToolFactory = captureSnapshot => defineTool({
  capability: 'dom',
  
  schema: {
    name: 'mcp__playwright__browser_get_text_content',
    title: 'Get element text',
    description: 'Get text content from elements',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector to find element'),
      all: z.boolean().optional().describe('Get from all matching elements'),
      includeHidden: z.boolean().optional().describe('Include hidden elements'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = params.all ? [
      `// Get text from all: ${params.selector}`,
      `const texts = await page.locator('${params.selector}').allTextContents();`,
    ] : [
      `// Get text from: ${params.selector}`,
      `const text = await page.locator('${params.selector}').first().textContent();`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        if (params.all) {
          const texts = await tab.page.locator(params.selector).allTextContents();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(texts.map(t => t.trim())),
            }],
          };
        } else {
          const text = await tab.page.locator(params.selector).first().textContent();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(text?.trim() || ''),
            }],
          };
        }
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  querySelector(captureSnapshot),
  querySelectorAll(captureSnapshot),
  getAttribute(captureSnapshot),
  setAttribute(captureSnapshot),
  getTextContent(captureSnapshot),
];