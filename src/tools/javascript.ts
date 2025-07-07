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

const evaluate: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'mcp__playwright__browser_evaluate',
    title: 'Execute JavaScript',
    description: 'Execute JavaScript in page context',
    inputSchema: z.object({
      code: z.string().describe('JavaScript code to execute'),
      args: z.array(z.any()).optional().describe('Arguments to pass to the function'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Execute JavaScript in page context`,
      `await page.evaluate(${JSON.stringify(params.code)}, ${JSON.stringify(params.args || [])});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        try {
          // Execute the code directly as a string with arguments
          const result = await tab.page.evaluate(
            ({ codeStr, args }: { codeStr: string; args: any[] }) => {
              // Create and execute function in page context
              const fn = new Function(...args.map((_, i) => `arg${i}`), codeStr);
              return fn(...args);
            },
            { codeStr: params.code, args: params.args || [] }
          );
          
          return {
            content: [{
              type: 'text',
              text: result !== undefined ? JSON.stringify(result, null, 2) : 'undefined',
            }],
          };
        } catch (error) {
          throw new Error(`JavaScript execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    };
  },
});

const evaluateHandle: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'mcp__playwright__browser_evaluate_handle',
    title: 'Execute JavaScript and return handle',
    description: 'Execute JavaScript and return a handle to the result',
    inputSchema: z.object({
      code: z.string().describe('JavaScript code to execute'),
      args: z.array(z.any()).optional().describe('Arguments to pass'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const handleId = `handle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const code = [
      `// Execute JavaScript and get handle`,
      `const ${handleId} = await page.evaluateHandle(${JSON.stringify(params.code)}, ${JSON.stringify(params.args || [])});`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        try {
          // Execute and get handle
          const handle = await tab.page.evaluateHandle(
            ({ codeStr, args }: { codeStr: string; args: any[] }) => {
              // Create and execute function in page context
              const fn = new Function(...args.map((_, i) => `arg${i}`), codeStr);
              return fn(...args);
            },
            { codeStr: params.code, args: params.args || [] }
          );
          
          // Get some basic info about the handle
          const type = await handle.evaluate((obj: any) => typeof obj);
          const isElement = await handle.evaluate((obj: any) => obj instanceof Element);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                handleId,
                type,
                isElement,
                info: 'Handle created for future use',
              }, null, 2),
            }],
          };
        } catch (error) {
          throw new Error(`JavaScript handle creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    };
  },
});

const evalOnSelector: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'mcp__playwright__browser_eval_on_selector',
    title: 'Execute JavaScript on selector',
    description: 'Execute JavaScript on element matching selector',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector'),
      code: z.string().describe('JavaScript code to execute on element (element is available as first argument)'),
      args: z.array(z.any()).optional().describe('Additional arguments after element'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Execute JavaScript on selector: ${params.selector}`,
      `await page.$eval('${params.selector}', ${params.code}, ${JSON.stringify(params.args || [])});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        try {
          // Wait for selector first
          await tab.page.waitForSelector(params.selector, { timeout: 5000 });
          
          // Execute on selector
          const result = await tab.page.$eval(
            params.selector,
            (element: Element, { codeStr, args }: { codeStr: string; args: any[] }) => {
              // Create function that takes element as first argument
              const argNames = ['element', ...args.map((_, i) => `arg${i}`)];
              const fn = new Function(...argNames, codeStr);
              return fn(element, ...args);
            },
            { codeStr: params.code, args: params.args || [] }
          );
          
          return {
            content: [{
              type: 'text',
              text: result !== undefined ? JSON.stringify(result, null, 2) : 'undefined',
            }],
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes('failed to find element matching selector')) {
            throw new Error(`No element found matching selector: ${params.selector}`);
          }
          throw new Error(`JavaScript execution on selector failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    };
  },
});

const evalOnSelectorAll: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'mcp__playwright__browser_eval_on_selector_all',
    title: 'Execute JavaScript on all matching selectors',
    description: 'Execute JavaScript on all elements matching selector',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector'),
      code: z.string().describe('JavaScript code to execute on elements array (elements array is available as first argument)'),
      args: z.array(z.any()).optional().describe('Additional arguments after elements'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Execute JavaScript on all: ${params.selector}`,
      `await page.$$eval('${params.selector}', ${params.code}, ${JSON.stringify(params.args || [])});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        try {
          // Execute on all matching selectors
          const result = await tab.page.$$eval(
            params.selector,
            (elements: Element[], { codeStr, args }: { codeStr: string; args: any[] }) => {
              // Create function that takes elements array as first argument
              const argNames = ['elements', ...args.map((_, i) => `arg${i}`)];
              const fn = new Function(...argNames, codeStr);
              return fn(elements, ...args);
            },
            { codeStr: params.code, args: params.args || [] }
          );
          
          return {
            content: [{
              type: 'text',
              text: result !== undefined ? JSON.stringify(result, null, 2) : 'undefined',
            }],
          };
        } catch (error) {
          throw new Error(`JavaScript execution on selectors failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  evaluate(captureSnapshot),
  evaluateHandle(captureSnapshot),
  evalOnSelector(captureSnapshot),
  evalOnSelectorAll(captureSnapshot),
];