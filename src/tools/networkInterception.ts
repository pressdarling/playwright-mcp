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
import type * as playwright from 'playwright';

const route: ToolFactory = captureSnapshot => defineTool({
  capability: 'network',
  
  schema: {
    name: 'mcp__playwright__browser_route',
    title: 'Intercept network requests',
    description: 'Intercept and modify network requests',
    inputSchema: z.object({
      pattern: z.string().describe('URL pattern to match (can use * and ** wildcards)'),
      handler: z.object({
        abort: z.boolean().optional().describe('Abort the request'),
        fulfill: z.object({
          status: z.number().optional().describe('Response status code'),
          body: z.string().optional().describe('Response body'),
          headers: z.record(z.string()).optional().describe('Response headers'),
          contentType: z.string().optional().describe('Content-Type header'),
        }).optional().describe('Fulfill with custom response'),
        continue: z.object({
          url: z.string().optional().describe('Override URL'),
          method: z.string().optional().describe('Override method'),
          headers: z.record(z.string()).optional().describe('Override headers'),
          postData: z.string().optional().describe('Override post data'),
        }).optional().describe('Continue with modifications'),
      }).describe('How to handle matching requests'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Route network requests matching: ${params.pattern}`,
      `await page.route('${params.pattern}', async route => {`,
    ];

    if (params.handler.abort) {
      code.push(`  await route.abort();`);
    } else if (params.handler.fulfill) {
      code.push(`  await route.fulfill(${JSON.stringify(params.handler.fulfill)});`);
    } else if (params.handler.continue) {
      code.push(`  await route.continue(${JSON.stringify(params.handler.continue)});`);
    }
    
    code.push(`});`);

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        await tab.page.route(params.pattern, async (route: playwright.Route) => {
          if (params.handler.abort) {
            await route.abort();
          } else if (params.handler.fulfill) {
            const fulfillOptions: any = { ...params.handler.fulfill };
            if (fulfillOptions.contentType && !fulfillOptions.headers) {
              fulfillOptions.headers = {};
            }
            if (fulfillOptions.contentType) {
              fulfillOptions.headers['content-type'] = fulfillOptions.contentType;
              delete fulfillOptions.contentType;
            }
            await route.fulfill(fulfillOptions);
          } else if (params.handler.continue) {
            await route.continue(params.handler.continue);
          } else {
            await route.continue();
          }
        });
        
        return {
          content: [{
            type: 'text',
            text: `Route handler added for pattern: ${params.pattern}`,
          }],
        };
      },
    };
  },
});

const unroute: ToolFactory = captureSnapshot => defineTool({
  capability: 'network',
  
  schema: {
    name: 'mcp__playwright__browser_unroute',
    title: 'Remove network route handler',
    description: 'Remove a previously added route handler',
    inputSchema: z.object({
      pattern: z.string().describe('URL pattern to stop intercepting'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Remove route handler for: ${params.pattern}`,
      `await page.unroute('${params.pattern}');`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        await tab.page.unroute(params.pattern);
        
        return {
          content: [{
            type: 'text',
            text: `Route handler removed for pattern: ${params.pattern}`,
          }],
        };
      },
    };
  },
});

const waitForRequest: ToolFactory = captureSnapshot => defineTool({
  capability: 'network',
  
  schema: {
    name: 'mcp__playwright__browser_wait_for_request',
    title: 'Wait for request',
    description: 'Wait for a specific network request',
    inputSchema: z.object({
      urlPattern: z.string().describe('URL pattern to wait for (can use * wildcards)'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Wait for request: ${params.urlPattern}`,
      `const request = await page.waitForRequest('${params.urlPattern}'${params.timeout ? `, { timeout: ${params.timeout} }` : ''});`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        try {
          const request = await tab.page.waitForRequest(params.urlPattern, {
            timeout: params.timeout || 30000,
          });

          const postData = request.postData();
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
                postData: postData,
                resourceType: request.resourceType(),
                isNavigationRequest: request.isNavigationRequest(),
              }, null, 2),
            }],
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes('Timeout')) {
            throw new Error(`Timeout waiting for request matching: ${params.urlPattern}`);
          }
          throw error;
        }
      },
    };
  },
});

const waitForResponse: ToolFactory = captureSnapshot => defineTool({
  capability: 'network',
  
  schema: {
    name: 'mcp__playwright__browser_wait_for_response',
    title: 'Wait for response',
    description: 'Wait for a specific network response',
    inputSchema: z.object({
      urlPattern: z.string().describe('URL pattern to wait for (can use * wildcards)'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Wait for response: ${params.urlPattern}`,
      `const response = await page.waitForResponse('${params.urlPattern}'${params.timeout ? `, { timeout: ${params.timeout} }` : ''});`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        try {
          const response = await tab.page.waitForResponse(params.urlPattern, {
            timeout: params.timeout || 30000,
          });

          let body: string | null = null;
          let bodyError: string | null = null;
          
          try {
            // Try to get response body as text
            body = await response.text();
          } catch (error) {
            bodyError = error instanceof Error ? error.message : 'Failed to get response body';
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                url: response.url(),
                status: response.status(),
                statusText: response.statusText(),
                headers: response.headers(),
                body: body,
                bodyError: bodyError,
                ok: response.ok(),
              }, null, 2),
            }],
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes('Timeout')) {
            throw new Error(`Timeout waiting for response matching: ${params.urlPattern}`);
          }
          throw error;
        }
      },
    };
  },
});

const getRequests: ToolFactory = captureSnapshot => defineTool({
  capability: 'network',
  
  schema: {
    name: 'mcp__playwright__browser_get_requests',
    title: 'Get network requests',
    description: 'Get all network requests with optional filtering',
    inputSchema: z.object({
      filter: z.object({
        url: z.string().optional().describe('Filter by URL pattern'),
        method: z.string().optional().describe('Filter by HTTP method'),
        resourceType: z.string().optional().describe('Filter by resource type'),
      }).optional().describe('Optional filters'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// Get network requests`,
      `const requests = await page.context().requests();`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        const allRequests = tab.requests();
        let requests = Array.from(allRequests.keys());
        
        // Apply filters
        if (params.filter?.url) {
          const pattern = new RegExp(params.filter.url.replace(/\*/g, '.*'));
          requests = requests.filter(r => pattern.test(r.url()));
        }
        
        if (params.filter?.method) {
          requests = requests.filter(r => r.method().toUpperCase() === params.filter!.method!.toUpperCase());
        }
        
        if (params.filter?.resourceType) {
          requests = requests.filter(r => r.resourceType() === params.filter!.resourceType);
        }
        
        const requestData = requests.map(request => {
          const response = allRequests.get(request);
          return {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData(),
            resourceType: request.resourceType(),
            response: response ? {
              status: response.status(),
              statusText: response.statusText(),
            } : null,
          };
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(requestData, null, 2),
          }],
        };
      },
    };
  },
});

const getResponses: ToolFactory = captureSnapshot => defineTool({
  capability: 'network',
  
  schema: {
    name: 'mcp__playwright__browser_get_responses',
    title: 'Get network responses',
    description: 'Get all network responses with optional filtering',
    inputSchema: z.object({
      filter: z.object({
        url: z.string().optional().describe('Filter by URL pattern'),
        status: z.number().optional().describe('Filter by status code'),
        statusRange: z.object({
          min: z.number().describe('Minimum status code'),
          max: z.number().describe('Maximum status code'),
        }).optional().describe('Filter by status code range'),
      }).optional().describe('Optional filters'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// Get network responses`,
      `const responses = await page.context().responses();`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        const allRequests = tab.requests();
        let responses: playwright.Response[] = [];
        
        // Collect all responses
        for (const [request, response] of allRequests.entries()) {
          if (response) {
            responses.push(response);
          }
        }
        
        // Apply filters
        if (params.filter?.url) {
          const pattern = new RegExp(params.filter.url.replace(/\*/g, '.*'));
          responses = responses.filter(r => pattern.test(r.url()));
        }
        
        if (params.filter?.status) {
          responses = responses.filter(r => r.status() === params.filter!.status);
        }
        
        if (params.filter?.statusRange) {
          responses = responses.filter(r => {
            const status = r.status();
            return status >= params.filter!.statusRange!.min && status <= params.filter!.statusRange!.max;
          });
        }
        
        const responseData = await Promise.all(responses.map(async response => {
          let bodySize: number | null = null;
          let contentType: string | null = null;
          
          try {
            const headers = response.headers();
            contentType = headers['content-type'] || null;
            const body = await response.body();
            bodySize = body.length;
          } catch {
            // Ignore errors getting body
          }
          
          return {
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
            headers: response.headers(),
            ok: response.ok(),
            bodySize,
            contentType,
          };
        }));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(responseData, null, 2),
          }],
        };
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  route(captureSnapshot),
  unroute(captureSnapshot),
  waitForRequest(captureSnapshot),
  waitForResponse(captureSnapshot),
  getRequests(captureSnapshot),
  getResponses(captureSnapshot),
];