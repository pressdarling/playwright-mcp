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

const addScriptTag: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'mcp__playwright__browser_add_script_tag',
    title: 'Add script tag',
    description: 'Add a script tag to the page',
    inputSchema: z.object({
      url: z.string().optional().describe('URL of the script'),
      path: z.string().optional().describe('Path to local script file'),
      content: z.string().optional().describe('JavaScript content'),
      type: z.string().optional().describe('Script type attribute'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    // Validate that at least one source is provided
    if (!params.url && !params.path && !params.content) {
      throw new Error('Must provide either url, path, or content for script tag');
    }
    
    const code = [
      `// Add script tag`,
      `await page.addScriptTag(${JSON.stringify(params)});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: !!params.url, // Wait for network if loading external script
      action: async () => {
        try {
          await tab.page.addScriptTag(params);
          
          return {
            content: [{
              type: 'text',
              text: `Script tag added successfully${params.url ? ` from ${params.url}` : ''}`,
            }],
          };
        } catch (error) {
          throw new Error(`Failed to add script tag: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    };
  },
});

const addStyleTag: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'mcp__playwright__browser_add_style_tag',
    title: 'Add style tag',
    description: 'Add a style tag to the page',
    inputSchema: z.object({
      url: z.string().optional().describe('URL of the stylesheet'),
      path: z.string().optional().describe('Path to local CSS file'),
      content: z.string().optional().describe('CSS content'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    // Validate that at least one source is provided
    if (!params.url && !params.path && !params.content) {
      throw new Error('Must provide either url, path, or content for style tag');
    }
    
    const code = [
      `// Add style tag`,
      `await page.addStyleTag(${JSON.stringify(params)});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: !!params.url, // Wait for network if loading external stylesheet
      action: async () => {
        try {
          await tab.page.addStyleTag(params);
          
          return {
            content: [{
              type: 'text',
              text: `Style tag added successfully${params.url ? ` from ${params.url}` : ''}`,
            }],
          };
        } catch (error) {
          throw new Error(`Failed to add style tag: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    };
  },
});

const addInitScript: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'mcp__playwright__browser_add_init_script',
    title: 'Add initialization script',
    description: 'Add a script that runs on every page navigation',
    inputSchema: z.object({
      script: z.string().describe('JavaScript code to run on every page'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Add initialization script`,
      `await page.addInitScript(${JSON.stringify(params.script)});`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
      action: async () => {
        try {
          await tab.page.addInitScript(params.script);
          
          return {
            content: [{
              type: 'text',
              text: 'Initialization script added successfully. It will run on every page navigation.',
            }],
          };
        } catch (error) {
          throw new Error(`Failed to add initialization script: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    };
  },
});

const removeScripts: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'mcp__playwright__browser_remove_scripts',
    title: 'Remove scripts',
    description: 'Remove scripts from the page by selector',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector for script elements to remove (e.g., "script[src*=\'tracking\']")'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Remove scripts matching: ${params.selector}`,
      `await page.evaluate((selector) => {`,
      `  const scripts = document.querySelectorAll(selector);`,
      `  scripts.forEach(script => script.remove());`,
      `  return scripts.length;`,
      `}, ${JSON.stringify(params.selector)});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        try {
          const removedCount = await tab.page.evaluate((selector: string) => {
            const scripts = document.querySelectorAll(selector);
            const count = scripts.length;
            scripts.forEach(script => script.remove());
            return count;
          }, params.selector);
          
          return {
            content: [{
              type: 'text',
              text: `Removed ${removedCount} script(s) matching selector: ${params.selector}`,
            }],
          };
        } catch (error) {
          throw new Error(`Failed to remove scripts: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  addScriptTag(captureSnapshot),
  addStyleTag(captureSnapshot),
  addInitScript(captureSnapshot),
  removeScripts(captureSnapshot),
];