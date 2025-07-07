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

const waitForSelector: ToolFactory = captureSnapshot => defineTool({
  capability: 'wait',
  
  schema: {
    name: 'mcp__playwright__browser_wait_for_selector',
    title: 'Wait for element',
    description: 'Wait for an element to appear, disappear, or become visible/hidden',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector to wait for'),
      state: z.enum(['attached', 'detached', 'visible', 'hidden']).optional()
        .describe('State to wait for (default: visible)'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Wait for selector: ${params.selector}`,
      `await page.waitForSelector('${params.selector}', {`,
      `  state: '${params.state || 'visible'}',`,
      `  timeout: ${params.timeout || 30000}`,
      `});`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        try {
          const element = await tab.page.waitForSelector(params.selector, {
            state: params.state || 'visible',
            timeout: params.timeout || 30000,
          });
          
          if (element && params.state !== 'detached' && params.state !== 'hidden') {
            const info = await element.evaluate((el: Element) => ({
              tagName: el.tagName,
              id: el.id,
              className: el.className,
              textContent: el.textContent?.trim() || '',
              visible: (el as HTMLElement).offsetParent !== null,
            }));
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  found: true,
                  state: params.state || 'visible',
                  element: info,
                }, null, 2),
              }],
            };
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                found: true,
                state: params.state || 'visible',
              }),
            }],
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes('Timeout')) {
            throw new Error(`Timeout waiting for selector "${params.selector}" to be ${params.state || 'visible'}`);
          }
          throw error;
        }
      },
    };
  },
});

const waitForFunction: ToolFactory = captureSnapshot => defineTool({
  capability: 'wait',
  
  schema: {
    name: 'mcp__playwright__browser_wait_for_function',
    title: 'Wait for JavaScript condition',
    description: 'Wait for a JavaScript function to return true',
    inputSchema: z.object({
      code: z.string().describe('JavaScript code that should return true when ready'),
      args: z.array(z.any()).optional().describe('Arguments to pass to the function'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
      polling: z.enum(['raf']).or(z.number()).optional()
        .describe('Polling strategy: raf (requestAnimationFrame) or interval in ms'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Wait for function`,
      `await page.waitForFunction(`,
      `  ${JSON.stringify(params.code)},`,
      `  ${JSON.stringify(params.args || [])},`,
      `  {`,
      `    timeout: ${params.timeout || 30000},`,
      params.polling ? `    polling: ${typeof params.polling === 'string' ? `'${params.polling}'` : params.polling},` : '',
      `  }`,
      `);`,
    ].filter(Boolean);

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        try {
          const result = await tab.page.waitForFunction(
            ({ codeStr, args }: { codeStr: string; args: any[] }) => {
              // Create and execute function in page context
              const fn = new Function(...args.map((_, i) => `arg${i}`), codeStr);
              return fn(...args);
            },
            { codeStr: params.code, args: params.args || [] },
            {
              timeout: params.timeout || 30000,
              polling: params.polling as 'raf' | number | undefined,
            }
          );
          
          // Get the return value
          const value = await result.jsonValue();
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                value,
              }),
            }],
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes('Timeout')) {
            throw new Error(`Timeout waiting for function to return true`);
          }
          throw error;
        }
      },
    };
  },
});

const waitForLoadState: ToolFactory = captureSnapshot => defineTool({
  capability: 'wait',
  
  schema: {
    name: 'mcp__playwright__browser_wait_for_load_state',
    title: 'Wait for page load state',
    description: 'Wait for the page to reach a specific load state',
    inputSchema: z.object({
      state: z.enum(['load', 'domcontentloaded', 'networkidle']).optional()
        .describe('Load state to wait for (default: load)'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Wait for load state: ${params.state || 'load'}`,
      `await page.waitForLoadState('${params.state || 'load'}', {`,
      `  timeout: ${params.timeout || 30000}`,
      `});`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: params.state === 'networkidle',
      action: async () => {
        try {
          await tab.page.waitForLoadState(params.state || 'load', {
            timeout: params.timeout || 30000,
          });
          
          return {
            content: [{
              type: 'text',
              text: `Page reached ${params.state || 'load'} state`,
            }],
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes('Timeout')) {
            throw new Error(`Timeout waiting for load state: ${params.state || 'load'}`);
          }
          throw error;
        }
      },
    };
  },
});

const waitForEvent: ToolFactory = captureSnapshot => defineTool({
  capability: 'wait',
  
  schema: {
    name: 'mcp__playwright__browser_wait_for_event',
    title: 'Wait for page event',
    description: 'Wait for a specific page event to occur',
    inputSchema: z.object({
      event: z.enum([
        'close', 'console', 'dialog', 'download', 'filechooser',
        'frameattached', 'framedetached', 'framenavigated',
        'load', 'pageerror', 'popup', 'request', 'response',
        'requestfailed', 'requestfinished', 'websocket', 'worker'
      ]).describe('Event to wait for'),
      predicate: z.string().optional()
        .describe('JavaScript code to filter events (receives event as argument)'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Wait for event: ${params.event}`,
      `const event = await page.waitForEvent('${params.event}', {`,
      params.predicate ? `  predicate: ${params.predicate},` : '',
      `  timeout: ${params.timeout || 30000}`,
      `});`,
    ].filter(Boolean);

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        try {
          let eventData: any;
          
          const eventPromise = tab.page.waitForEvent(params.event as any, {
            predicate: params.predicate ? 
              (event: any) => {
                try {
                  const fn = new Function('event', params.predicate!);
                  return fn(event);
                } catch {
                  return false;
                }
              } : undefined,
            timeout: params.timeout || 30000,
          });
          
          const event = await eventPromise;
          
          // Extract relevant data based on event type
          switch (params.event) {
            case 'console':
              eventData = {
                type: (event as any).type(),
                text: (event as any).text(),
              };
              break;
            case 'dialog':
              eventData = {
                type: (event as any).type(),
                message: (event as any).message(),
              };
              break;
            case 'request':
            case 'response':
              eventData = {
                url: (event as any).url(),
                method: (event as any).method?.() || (event as any).request?.().method(),
                status: (event as any).status?.(),
              };
              break;
            case 'frameattached':
            case 'framedetached':
            case 'framenavigated':
              eventData = {
                url: (event as any).url(),
                name: (event as any).name(),
              };
              break;
            default:
              eventData = { event: params.event };
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                event: params.event,
                data: eventData,
              }, null, 2),
            }],
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes('Timeout')) {
            throw new Error(`Timeout waiting for event: ${params.event}`);
          }
          throw error;
        }
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  waitForSelector(captureSnapshot),
  waitForFunction(captureSnapshot),
  waitForLoadState(captureSnapshot),
  waitForEvent(captureSnapshot),
];