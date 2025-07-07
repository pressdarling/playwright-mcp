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

const getStorage: ToolFactory = captureSnapshot => defineTool({
  capability: 'storage',
  
  schema: {
    name: 'mcp__playwright__browser_get_storage',
    title: 'Get storage data',
    description: 'Get localStorage or sessionStorage data',
    inputSchema: z.object({
      type: z.enum(['local', 'session']).describe('Storage type to retrieve'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Get ${params.type}Storage data`,
      `const storage = await page.evaluate((type) => {`,
      `  const storage = type === 'local' ? localStorage : sessionStorage;`,
      `  const data = {};`,
      `  for (let i = 0; i < storage.length; i++) {`,
      `    const key = storage.key(i);`,
      `    if (key) data[key] = storage.getItem(key);`,
      `  }`,
      `  return data;`,
      `}, '${params.type}');`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        const storage = await tab.page.evaluate((type: string) => {
          const storage = type === 'local' ? localStorage : sessionStorage;
          const data: Record<string, string> = {};
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key) {
              const value = storage.getItem(key);
              if (value !== null) {
                data[key] = value;
              }
            }
          }
          return data;
        }, params.type);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(storage, null, 2),
          }],
        };
      },
    };
  },
});

const setStorage: ToolFactory = captureSnapshot => defineTool({
  capability: 'storage',
  
  schema: {
    name: 'mcp__playwright__browser_set_storage',
    title: 'Set storage data',
    description: 'Set localStorage or sessionStorage data',
    inputSchema: z.object({
      type: z.enum(['local', 'session']).describe('Storage type to set'),
      data: z.record(z.string()).describe('Key-value pairs to set in storage'),
      clear: z.boolean().optional().describe('Clear existing storage before setting new data'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Set ${params.type}Storage data`,
      `await page.evaluate(({ type, data, clear }) => {`,
      `  const storage = type === 'local' ? localStorage : sessionStorage;`,
      `  if (clear) storage.clear();`,
      `  Object.entries(data).forEach(([key, value]) => {`,
      `    storage.setItem(key, value);`,
      `  });`,
      `}, ${JSON.stringify({ type: params.type, data: params.data, clear: params.clear })});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        await tab.page.evaluate(({ type, data, clear }: { type: string; data: Record<string, string>; clear?: boolean }) => {
          const storage = type === 'local' ? localStorage : sessionStorage;
          if (clear) {
            storage.clear();
          }
          Object.entries(data).forEach(([key, value]) => {
            storage.setItem(key, value);
          });
        }, { type: params.type, data: params.data, clear: params.clear });
        
        const count = Object.keys(params.data).length;
        return {
          content: [{
            type: 'text',
            text: `Set ${count} item(s) in ${params.type}Storage${params.clear ? ' (cleared existing data)' : ''}`,
          }],
        };
      },
    };
  },
});

const clearStorage: ToolFactory = captureSnapshot => defineTool({
  capability: 'storage',
  
  schema: {
    name: 'mcp__playwright__browser_clear_storage',
    title: 'Clear storage',
    description: 'Clear localStorage, sessionStorage, or both',
    inputSchema: z.object({
      type: z.enum(['local', 'session', 'all']).optional().describe('Storage type to clear (default: all)'),
      keys: z.array(z.string()).optional().describe('Specific keys to remove (if not provided, clears all)'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    const type = params.type || 'all';
    
    const code = [
      `// Clear ${type === 'all' ? 'all storage' : type + 'Storage'}`,
      `await page.evaluate(({ type, keys }) => {`,
    ];
    
    if (params.keys) {
      code.push(
        `  const removeKeys = (storage) => {`,
        `    keys.forEach(key => storage.removeItem(key));`,
        `  };`,
        `  if (type === 'local' || type === 'all') removeKeys(localStorage);`,
        `  if (type === 'session' || type === 'all') removeKeys(sessionStorage);`
      );
    } else {
      code.push(
        `  if (type === 'local' || type === 'all') localStorage.clear();`,
        `  if (type === 'session' || type === 'all') sessionStorage.clear();`
      );
    }
    
    code.push(
      `}, ${JSON.stringify({ type, keys: params.keys })});`
    );

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        const result = await tab.page.evaluate(({ type, keys }: { type: string; keys?: string[] }) => {
          let clearedLocal = 0;
          let clearedSession = 0;
          
          if (keys) {
            const removeKeys = (storage: Storage) => {
              let count = 0;
              keys.forEach(key => {
                if (storage.getItem(key) !== null) {
                  storage.removeItem(key);
                  count++;
                }
              });
              return count;
            };
            
            if (type === 'local' || type === 'all') {
              clearedLocal = removeKeys(localStorage);
            }
            if (type === 'session' || type === 'all') {
              clearedSession = removeKeys(sessionStorage);
            }
          } else {
            if (type === 'local' || type === 'all') {
              clearedLocal = localStorage.length;
              localStorage.clear();
            }
            if (type === 'session' || type === 'all') {
              clearedSession = sessionStorage.length;
              sessionStorage.clear();
            }
          }
          
          return { clearedLocal, clearedSession };
        }, { type, keys: params.keys });
        
        let message = '';
        if (params.keys) {
          const total = result.clearedLocal + result.clearedSession;
          message = `Removed ${total} item(s)`;
          if (type === 'all') {
            message += ` (localStorage: ${result.clearedLocal}, sessionStorage: ${result.clearedSession})`;
          }
        } else {
          if (type === 'all') {
            message = `Cleared all storage (localStorage: ${result.clearedLocal} items, sessionStorage: ${result.clearedSession} items)`;
          } else if (type === 'local') {
            message = `Cleared localStorage (${result.clearedLocal} items)`;
          } else {
            message = `Cleared sessionStorage (${result.clearedSession} items)`;
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: message,
          }],
        };
      },
    };
  },
});

const getCookies: ToolFactory = captureSnapshot => defineTool({
  capability: 'storage',
  
  schema: {
    name: 'mcp__playwright__browser_get_cookies',
    title: 'Get cookies',
    description: 'Get browser cookies',
    inputSchema: z.object({
      urls: z.array(z.string()).optional().describe('Filter cookies by URLs'),
      name: z.string().optional().describe('Filter by cookie name'),
      domain: z.string().optional().describe('Filter by domain'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Get cookies`,
      `const cookies = await context.cookies(${params.urls ? JSON.stringify(params.urls) : ''});`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        let cookies = await tab.page.context().cookies(params.urls);
        
        // Apply additional filters
        if (params.name) {
          cookies = cookies.filter(c => c.name === params.name);
        }
        if (params.domain) {
          cookies = cookies.filter(c => c.domain === params.domain || c.domain === `.${params.domain}`);
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(cookies, null, 2),
          }],
        };
      },
    };
  },
});

const setCookies: ToolFactory = captureSnapshot => defineTool({
  capability: 'storage',
  
  schema: {
    name: 'mcp__playwright__browser_set_cookies',
    title: 'Set cookies',
    description: 'Set browser cookies',
    inputSchema: z.object({
      cookies: z.array(z.object({
        name: z.string().describe('Cookie name'),
        value: z.string().describe('Cookie value'),
        domain: z.string().optional().describe('Cookie domain'),
        path: z.string().optional().describe('Cookie path'),
        expires: z.number().optional().describe('Unix timestamp when cookie expires'),
        httpOnly: z.boolean().optional().describe('HttpOnly flag'),
        secure: z.boolean().optional().describe('Secure flag'),
        sameSite: z.enum(['Strict', 'Lax', 'None']).optional().describe('SameSite attribute'),
      })).describe('Cookies to set'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Set cookies`,
      `await context.addCookies(${JSON.stringify(params.cookies, null, 2)});`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        await tab.page.context().addCookies(params.cookies);
        
        return {
          content: [{
            type: 'text',
            text: `Set ${params.cookies.length} cookie(s)`,
          }],
        };
      },
    };
  },
});

const deleteCookies: ToolFactory = captureSnapshot => defineTool({
  capability: 'storage',
  
  schema: {
    name: 'mcp__playwright__browser_delete_cookies',
    title: 'Delete cookies',
    description: 'Delete cookies by name and/or domain',
    inputSchema: z.object({
      name: z.string().optional().describe('Cookie name to delete'),
      domain: z.string().optional().describe('Domain to delete cookies from'),
      path: z.string().optional().describe('Path to match'),
      all: z.boolean().optional().describe('Delete all cookies (ignores other filters)'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Delete cookies`,
      `await context.clearCookies();`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        if (params.all) {
          await tab.page.context().clearCookies();
          return {
            content: [{
              type: 'text',
              text: 'Deleted all cookies',
            }],
          };
        }
        
        // Get all cookies first
        const allCookies = await tab.page.context().cookies();
        let toDelete = allCookies;
        
        // Filter cookies to delete
        if (params.name) {
          toDelete = toDelete.filter(c => c.name === params.name);
        }
        if (params.domain) {
          toDelete = toDelete.filter(c => c.domain === params.domain || c.domain === `.${params.domain}`);
        }
        if (params.path) {
          toDelete = toDelete.filter(c => c.path === params.path);
        }
        
        // Clear all cookies and re-add the ones we want to keep
        if (toDelete.length > 0) {
          const toKeep = allCookies.filter(c => !toDelete.includes(c));
          await tab.page.context().clearCookies();
          if (toKeep.length > 0) {
            await tab.page.context().addCookies(toKeep);
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: `Deleted ${toDelete.length} cookie(s)`,
          }],
        };
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  getStorage(captureSnapshot),
  setStorage(captureSnapshot),
  clearStorage(captureSnapshot),
  getCookies(captureSnapshot),
  setCookies(captureSnapshot),
  deleteCookies(captureSnapshot),
];