# Playwright MCP Enhancement Implementation Guide

## Quick Start

This guide provides concrete implementation steps with code examples for enhancing Playwright MCP with advanced browser automation capabilities.

## Step 1: Create JavaScript Execution Tools

### 1.1 Create the JavaScript tools file

Create `src/tools/javascript.ts`:

```typescript
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { z } from 'zod';
import { defineTool, type ToolFactory } from './tool.js';

const evaluate: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'browser_evaluate',
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
    
    // Execute the JavaScript code
    const result = await tab.page.evaluate(
      new Function(...(params.args || []), params.code),
      params.args
    );

    const code = [
      `// Execute JavaScript in page context`,
      `await page.evaluate(${JSON.stringify(params.code)}, ${JSON.stringify(params.args || [])});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },
    };
  },
});

// Additional tools: evaluateHandle, evalOnSelector, evalOnSelectorAll
// ... (see full implementation in src/tools/javascript.ts)

export default (captureSnapshot: boolean) => [
  evaluate(captureSnapshot),
  evaluateHandle(captureSnapshot),
  evalOnSelector(captureSnapshot),
  evalOnSelectorAll(captureSnapshot),
];
```

### 1.2 Create Script Injection Tools

Create `src/tools/scriptInjection.ts`:

```typescript
import { z } from 'zod';
import { defineTool, type ToolFactory } from './tool.js';

const addScriptTag: ToolFactory = captureSnapshot => defineTool({
  capability: 'javascript',
  
  schema: {
    name: 'browser_add_script_tag',
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
    
    await tab.page.addScriptTag(params);

    const code = [
      `// Add script tag`,
      `await page.addScriptTag(${JSON.stringify(params)});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: true,
    };
  },
});

// Additional tools: addStyleTag, addInitScript, removeScripts
// ... (see full implementation in src/tools/scriptInjection.ts)

export default (captureSnapshot: boolean) => [
  addScriptTag(captureSnapshot),
  addStyleTag(captureSnapshot),
  addInitScript(captureSnapshot),
  removeScripts(captureSnapshot),
];
```

## Step 2: Update Configuration

### 2.1 Update config.d.ts

```typescript
// Add to config.d.ts
export type ToolCapability = 
  | 'core'
  | 'tabs'
  | 'pdf'
  | 'history'
  | 'wait'
  | 'files'
  | 'install'
  | 'testing'
  // New capabilities
  | 'javascript'
  | 'network'
  | 'storage'
  | 'dom'
  | 'frames'
  | 'batch';
```

### 2.2 Update tools.ts to include new tools

```typescript
// In src/tools.ts
import javascriptTools from './tools/javascript.js';
import scriptInjectionTools from './tools/scriptInjection.js';

export const snapshotTools = [
  // ... existing tools
  ...javascriptTools(true),
  ...scriptInjectionTools(true),
];

export const visionTools = [
  // ... existing tools
  ...javascriptTools(false),
  ...scriptInjectionTools(false),
];
```

## Step 3: Create Network Interception Tools

Create `src/tools/networkInterception.ts`:

```typescript
import { z } from 'zod';
import { defineTool, type ToolFactory } from './tool.js';

const route: ToolFactory = captureSnapshot => defineTool({
  capability: 'network',
  
  schema: {
    name: 'browser_route',
    title: 'Intercept network requests',
    description: 'Intercept and modify network requests',
    inputSchema: z.object({
      pattern: z.string().describe('URL pattern to match'),
      handler: z.object({
        abort: z.boolean().optional().describe('Abort the request'),
        fulfill: z.object({
          status: z.number().optional(),
          body: z.string().optional(),
          headers: z.record(z.string()).optional(),
        }).optional(),
        continue: z.object({
          url: z.string().optional(),
          method: z.string().optional(),
          headers: z.record(z.string()).optional(),
          postData: z.string().optional(),
        }).optional(),
      }),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    await tab.page.route(params.pattern, async route => {
      if (params.handler.abort) {
        await route.abort();
      } else if (params.handler.fulfill) {
        await route.fulfill(params.handler.fulfill);
      } else if (params.handler.continue) {
        await route.continue(params.handler.continue);
      }
    });

    const code = [
      `// Route network requests matching: ${params.pattern}`,
      `await page.route('${params.pattern}', handler);`,
    ];

    return {
      code,
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default (captureSnapshot: boolean) => [
  route(captureSnapshot),
  waitForRequest(captureSnapshot),
];
```

## Step 4: Testing Strategy

### 4.1 Create test utilities

Create `tests/utils/testHelpers.ts`:

```typescript
import { test as base } from '@playwright/test';
import { createConnection } from '../src/index.js';

export const test = base.extend({
  mcp: async ({}, use) => {
    const connection = await createConnection({
      capabilities: ['javascript', 'network', 'storage'],
    });
    
    await use(connection);
    await connection.close();
  },
});
```

### 4.2 Create tests for JavaScript tools

Create `tests/javascript.spec.ts`:

```typescript
import { test, expect } from './utils/testHelpers.js';

test.describe('JavaScript Execution Tools', () => {
  test('should execute JavaScript code', async ({ mcp }) => {
    const result = await mcp.callTool('browser_evaluate', {
      code: 'return 2 + 2;',
    });
    
    expect(result.content[0].text).toBe('4');
  });
  
  test('should pass arguments to JavaScript', async ({ mcp }) => {
    const result = await mcp.callTool('browser_evaluate', {
      code: 'return a + b;',
      args: { a: 5, b: 3 },
    });
    
    expect(result.content[0].text).toBe('8');
  });
  
  test('should handle syntax errors', async ({ mcp }) => {
    await expect(mcp.callTool('browser_evaluate', {
      code: 'invalid javascript {{',
    })).rejects.toThrow();
  });
});
```

## Step 5: Documentation

### 5.1 Update README

Add to README.md:

```markdown
### JavaScript Execution

The enhanced Playwright MCP now supports JavaScript execution:

```javascript
// Execute JavaScript in page context
await mcp.callTool('browser_evaluate', {
  code: 'return document.title;'
});

// Execute JavaScript with arguments
await mcp.callTool('browser_evaluate', {
  code: 'return a + b;',
  args: { a: 5, b: 3 }
});

// Execute on specific elements
await mcp.callTool('browser_eval_on_selector', {
  selector: '.button',
  code: 'element.click();'
});
```

### Script Injection

Inject scripts and styles into pages:

```javascript
// Add external script
await mcp.callTool('browser_add_script_tag', {
  url: 'https://code.jquery.com/jquery-3.6.0.min.js'
});

// Add inline script
await mcp.callTool('browser_add_script_tag', {
  content: 'window.myGlobal = "Hello World";'
});

// Add initialization script (runs on every navigation)
await mcp.callTool('browser_add_init_script', {
  script: 'window.startTime = Date.now();'
});
```

### Error Handling

JavaScript execution includes error handling for:
- Syntax errors in provided code
- Runtime errors during execution
- Timeout errors for long-running scripts
- Element not found errors for selector-based operations
```

## Next Steps

1. **Complete Phase 1 Implementation**
   - Implement all JavaScript execution tools
   - Add comprehensive error handling
   - Create validation layer

2. **Testing & Validation**
   - Unit tests for each tool
   - Integration tests with real pages
   - Performance testing

3. **Performance Optimization**
   - Implement caching for repeated operations
   - Add batch operation support
   - Optimize snapshot generation

4. **Documentation**
   - API reference for all new tools
   - Migration guide from CDP
   - Usage examples and patterns

This implementation guide provides a concrete starting point. Each phase builds on the previous one, ensuring a stable enhancement of the Playwright MCP server.