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

const listFrames: ToolFactory = captureSnapshot => defineTool({
  capability: 'frames',
  
  schema: {
    name: 'mcp__playwright__browser_list_frames',
    title: 'List all frames',
    description: 'List all frames/iframes in the current page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// List all frames in the page`,
      `const frames = page.frames();`,
      `const frameInfo = frames.map(frame => ({`,
      `  url: frame.url(),`,
      `  name: frame.name(),`,
      `  isDetached: frame.isDetached(),`,
      `}));`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        const frames = tab.page.frames();
        const frameInfo = frames.map((frame, index) => ({
          index,
          url: frame.url(),
          name: frame.name() || '',
          isMain: frame === tab.page.mainFrame(),
          isDetached: frame.isDetached(),
          parentFrame: frame.parentFrame() ? frames.indexOf(frame.parentFrame()!) : null,
        }));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(frameInfo, null, 2),
          }],
        };
      },
    };
  },
});

const switchToFrame: ToolFactory = captureSnapshot => defineTool({
  capability: 'frames',
  
  schema: {
    name: 'mcp__playwright__browser_switch_to_frame',
    title: 'Switch to frame',
    description: 'Switch context to a specific frame',
    inputSchema: z.object({
      frameSelector: z.string().optional().describe('CSS selector for iframe element'),
      frameName: z.string().optional().describe('Frame name attribute'),
      frameUrl: z.string().optional().describe('Frame URL pattern'),
      frameIndex: z.number().optional().describe('Frame index (0-based)'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    if (!params.frameSelector && !params.frameName && !params.frameUrl && params.frameIndex === undefined) {
      throw new Error('Must provide frameSelector, frameName, frameUrl, or frameIndex');
    }
    
    const code = [];
    if (params.frameSelector) {
      code.push(
        `// Switch to frame by selector: ${params.frameSelector}`,
        `const frameElement = await page.locator('${params.frameSelector}').first();`,
        `const frame = await frameElement.contentFrame();`
      );
    } else if (params.frameName) {
      code.push(
        `// Switch to frame by name: ${params.frameName}`,
        `const frame = page.frame({ name: '${params.frameName}' });`
      );
    } else if (params.frameUrl) {
      code.push(
        `// Switch to frame by URL: ${params.frameUrl}`,
        `const frame = page.frame({ url: '${params.frameUrl}' });`
      );
    } else {
      code.push(
        `// Switch to frame by index: ${params.frameIndex}`,
        `const frame = page.frames()[${params.frameIndex}];`
      );
    }

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        let targetFrame: playwright.Frame | null = null;
        
        if (params.frameSelector) {
          const frameElement = await tab.page.locator(params.frameSelector).first().elementHandle();
          if (!frameElement) throw new Error(`Frame element not found: ${params.frameSelector}`);
          targetFrame = await frameElement.contentFrame();
        } else if (params.frameName) {
          targetFrame = tab.page.frame({ name: params.frameName });
        } else if (params.frameUrl) {
          targetFrame = tab.page.frame({ url: params.frameUrl });
        } else if (params.frameIndex !== undefined) {
          const frames = tab.page.frames();
          targetFrame = frames[params.frameIndex] || null;
        }
        
        if (!targetFrame) {
          throw new Error('Frame not found with the specified criteria');
        }
        
        // Store current frame context
        (tab as any).currentFrame = targetFrame;
        
        return {
          content: [{
            type: 'text',
            text: `Switched to frame: ${targetFrame.url()}`,
          }],
        };
      },
    };
  },
});

const switchToMainFrame: ToolFactory = captureSnapshot => defineTool({
  capability: 'frames',
  
  schema: {
    name: 'mcp__playwright__browser_switch_to_main_frame',
    title: 'Switch to main frame',
    description: 'Switch context back to the main frame',
    inputSchema: z.object({}),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Switch back to main frame`,
      `const mainFrame = page.mainFrame();`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        const mainFrame = tab.page.mainFrame();
        
        // Clear frame context
        delete (tab as any).currentFrame;
        
        return {
          content: [{
            type: 'text',
            text: `Switched to main frame: ${mainFrame.url()}`,
          }],
        };
      },
    };
  },
});

const waitForFrame: ToolFactory = captureSnapshot => defineTool({
  capability: 'frames',
  
  schema: {
    name: 'mcp__playwright__browser_wait_for_frame',
    title: 'Wait for frame',
    description: 'Wait for a frame to load or appear',
    inputSchema: z.object({
      frameUrl: z.string().optional().describe('Frame URL pattern to wait for'),
      frameName: z.string().optional().describe('Frame name to wait for'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    if (!params.frameUrl && !params.frameName) {
      throw new Error('Must provide frameUrl or frameName');
    }
    
    const code = [
      `// Wait for frame`,
      params.frameUrl ? 
        `await page.waitForFrame({ url: '${params.frameUrl}' }, { timeout: ${params.timeout || 30000} });` :
        `await page.waitForFrame({ name: '${params.frameName}' }, { timeout: ${params.timeout || 30000} });`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        const predicate = params.frameUrl ? 
          (frame: playwright.Frame) => frame.url().includes(params.frameUrl!) :
          (frame: playwright.Frame) => frame.name() === params.frameName;
        
        try {
          const frame = await tab.page.waitForFunction(
            ({ url, name }) => {
              const frames = (window as any).page?.frames() || [];
              return frames.find((f: any) => 
                url ? f.url().includes(url) : f.name() === name
              );
            },
            { url: params.frameUrl, name: params.frameName },
            { timeout: params.timeout || 30000 }
          );
          
          const foundFrame = tab.page.frames().find(predicate);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                found: true,
                url: foundFrame?.url(),
                name: foundFrame?.name(),
              }),
            }],
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes('Timeout')) {
            throw new Error(`Timeout waiting for frame: ${params.frameUrl || params.frameName}`);
          }
          throw error;
        }
      },
    };
  },
});

const frameEvaluate: ToolFactory = captureSnapshot => defineTool({
  capability: 'frames',
  
  schema: {
    name: 'mcp__playwright__browser_frame_evaluate',
    title: 'Execute JavaScript in frame',
    description: 'Execute JavaScript code in a specific frame context',
    inputSchema: z.object({
      code: z.string().describe('JavaScript code to execute'),
      frameSelector: z.string().optional().describe('CSS selector for iframe element'),
      frameName: z.string().optional().describe('Frame name attribute'),
      frameIndex: z.number().optional().describe('Frame index (0-based)'),
      args: z.array(z.any()).optional().describe('Arguments to pass to the function'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const code = [
      `// Execute in frame context`,
      params.frameSelector ? 
        `const frame = await page.locator('${params.frameSelector}').first().contentFrame();` :
      params.frameName ?
        `const frame = page.frame({ name: '${params.frameName}' });` :
        `const frame = page.frames()[${params.frameIndex || 0}];`,
      `const result = await frame.evaluate(${JSON.stringify(params.code)}, ${JSON.stringify(params.args || [])});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        let targetFrame: playwright.Frame | null = null;
        
        if (params.frameSelector) {
          const frameElement = await tab.page.locator(params.frameSelector).first().elementHandle();
          if (!frameElement) throw new Error(`Frame element not found: ${params.frameSelector}`);
          targetFrame = await frameElement.contentFrame();
        } else if (params.frameName) {
          targetFrame = tab.page.frame({ name: params.frameName });
        } else if (params.frameIndex !== undefined) {
          const frames = tab.page.frames();
          targetFrame = frames[params.frameIndex] || null;
        } else {
          // Use current frame context if set, otherwise main frame
          targetFrame = (tab as any).currentFrame || tab.page.mainFrame();
        }
        
        if (!targetFrame) {
          throw new Error('Frame not found with the specified criteria');
        }
        
        try {
          const result = await targetFrame.evaluate(
            ({ codeStr, args }: { codeStr: string; args: any[] }) => {
              // Create and execute function in frame context
              const fn = new Function(...args.map((_, i) => `arg${i}`), codeStr);
              return fn(...args);
            },
            { codeStr: params.code, args: params.args || [] }
          );
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          throw new Error(`Frame JavaScript execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  listFrames(captureSnapshot),
  switchToFrame(captureSnapshot),
  switchToMainFrame(captureSnapshot),
  waitForFrame(captureSnapshot),
  frameEvaluate(captureSnapshot),
];