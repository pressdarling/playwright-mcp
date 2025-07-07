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

const getAccessibilityTree: ToolFactory = captureSnapshot => defineTool({
  capability: 'accessibility',
  
  schema: {
    name: 'mcp__playwright__browser_get_accessibility_tree',
    title: 'Get accessibility tree',
    description: 'Get the accessibility tree of the page or a specific element',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector to get accessibility tree for specific element'),
      interestingOnly: z.boolean().optional()
        .describe('Only include interesting nodes (default: true)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// Get accessibility tree`,
      params.selector ? 
        `const element = await page.locator('${params.selector}').first();` :
        `const element = page;`,
      `const snapshot = await page.accessibility.snapshot({`,
      params.selector ? `  root: await element.elementHandle(),` : '',
      `  interestingOnly: ${params.interestingOnly !== false}`,
      `});`,
    ].filter(Boolean);

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        let root = undefined;
        
        if (params.selector) {
          const element = await tab.page.locator(params.selector).first().elementHandle();
          if (!element) {
            throw new Error(`Element not found: ${params.selector}`);
          }
          root = element;
        }
        
        const snapshot = await tab.page.accessibility.snapshot({
          root,
          interestingOnly: params.interestingOnly !== false,
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(snapshot, null, 2),
          }],
        };
      },
    };
  },
});

const checkAccessibility: ToolFactory = captureSnapshot => defineTool({
  capability: 'accessibility',
  
  schema: {
    name: 'mcp__playwright__browser_check_accessibility',
    title: 'Run accessibility checks',
    description: 'Run accessibility checks on the page and report violations',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector to check specific element'),
      rules: z.array(z.string()).optional()
        .describe('Specific WCAG rules to check (e.g., ["color-contrast", "label"])'),
      level: z.enum(['A', 'AA', 'AAA']).optional()
        .describe('WCAG conformance level to check (default: AA)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    const code = [
      `// Run accessibility checks`,
      `// Note: This is a simplified check. For comprehensive testing, use axe-core`,
      `const violations = await page.evaluate(() => {`,
      `  const checks = [];`,
      `  `,
      `  // Check images for alt text`,
      `  document.querySelectorAll('img').forEach(img => {`,
      `    if (!img.alt && !img.getAttribute('aria-label')) {`,
      `      checks.push({`,
      `        rule: 'image-alt',`,
      `        element: img.outerHTML.substring(0, 100),`,
      `        issue: 'Image missing alt text'`,
      `      });`,
      `    }`,
      `  });`,
      `  `,
      `  // Check form inputs for labels`,
      `  document.querySelectorAll('input, select, textarea').forEach(input => {`,
      `    const id = input.id;`,
      `    const hasLabel = id && document.querySelector(\`label[for="\${id}"]\`);`,
      `    const hasAriaLabel = input.getAttribute('aria-label');`,
      `    if (!hasLabel && !hasAriaLabel) {`,
      `      checks.push({`,
      `        rule: 'label',`,
      `        element: input.outerHTML.substring(0, 100),`,
      `        issue: 'Form element missing label'`,
      `      });`,
      `    }`,
      `  });`,
      `  `,
      `  return checks;`,
      `});`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      action: async () => {
        // Inject a more comprehensive accessibility check
        const violations = await tab.page.evaluate(({ selector, rules, level }) => {
          const checks: any[] = [];
          const root = selector ? document.querySelector(selector) : document;
          
          if (!root) {
            throw new Error(`Element not found: ${selector}`);
          }
          
          // Helper to check if rule should be tested
          const shouldCheckRule = (rule: string) => !rules || rules.includes(rule);
          
          // Check images for alt text
          if (shouldCheckRule('image-alt')) {
            root.querySelectorAll('img').forEach((img: HTMLImageElement) => {
              if (!img.alt && !img.getAttribute('aria-label') && !img.getAttribute('aria-labelledby')) {
                checks.push({
                  rule: 'image-alt',
                  level: 'A',
                  element: {
                    tag: img.tagName,
                    src: img.src,
                    html: img.outerHTML.substring(0, 150),
                  },
                  issue: 'Image missing alternative text',
                  wcag: '1.1.1',
                });
              }
            });
          }
          
          // Check form inputs for labels
          if (shouldCheckRule('label')) {
            root.querySelectorAll('input, select, textarea').forEach((element) => {
              const input = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
              if ('type' in input && (input.type === 'hidden' || input.type === 'submit' || input.type === 'button')) return;
              
              const id = input.id;
              const hasLabel = id && document.querySelector(`label[for="${id}"]`);
              const hasAriaLabel = input.getAttribute('aria-label');
              const hasAriaLabelledby = input.getAttribute('aria-labelledby');
              const hasTitle = input.title;
              
              if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
                checks.push({
                  rule: 'label',
                  level: 'A',
                  element: {
                    tag: input.tagName,
                    type: 'type' in input ? input.type : 'N/A',
                    name: 'name' in input ? input.name : '',
                    html: input.outerHTML.substring(0, 150),
                  },
                  issue: 'Form element missing accessible label',
                  wcag: '3.3.2',
                });
              }
            });
          }
          
          // Check headings hierarchy
          if (shouldCheckRule('heading-order')) {
            const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
            let lastLevel = 0;
            
            headings.forEach((heading: Element) => {
              const level = parseInt(heading.tagName[1]);
              if (level - lastLevel > 1 && lastLevel !== 0) {
                checks.push({
                  rule: 'heading-order',
                  level: 'AA',
                  element: {
                    tag: heading.tagName,
                    text: heading.textContent?.trim().substring(0, 50),
                    html: heading.outerHTML.substring(0, 150),
                  },
                  issue: `Heading level skipped from H${lastLevel} to H${level}`,
                  wcag: '1.3.1',
                });
              }
              lastLevel = level;
            });
          }
          
          // Check color contrast (simplified)
          if (shouldCheckRule('color-contrast')) {
            const elements = root.querySelectorAll('*');
            elements.forEach((el: Element) => {
              const style = window.getComputedStyle(el as HTMLElement);
              const text = el.textContent?.trim();
              
              if (text && style.color && style.backgroundColor && style.backgroundColor !== 'transparent') {
                // Note: Real contrast calculation would need color parsing and WCAG formula
                // This is a placeholder for demonstration
                checks.push({
                  rule: 'color-contrast',
                  level: 'AA',
                  element: {
                    tag: el.tagName,
                    text: text.substring(0, 50),
                    color: style.color,
                    backgroundColor: style.backgroundColor,
                  },
                  issue: 'Color contrast should be checked with proper tools',
                  wcag: '1.4.3',
                  note: 'Use dedicated tools like axe-core for accurate contrast testing',
                });
              }
            });
          }
          
          // Check for keyboard accessibility
          if (shouldCheckRule('keyboard')) {
            root.querySelectorAll('div[onclick], span[onclick]').forEach((el: Element) => {
              if (!el.getAttribute('tabindex') && !el.getAttribute('role')) {
                checks.push({
                  rule: 'keyboard',
                  level: 'A',
                  element: {
                    tag: el.tagName,
                    html: el.outerHTML.substring(0, 150),
                  },
                  issue: 'Clickable element not keyboard accessible',
                  wcag: '2.1.1',
                });
              }
            });
          }
          
          // Filter by conformance level if specified
          const levelPriority = { 'A': 1, 'AA': 2, 'AAA': 3 };
          const targetLevel = levelPriority[level as keyof typeof levelPriority] || 2;
          
          return checks.filter(check => 
            levelPriority[check.level as keyof typeof levelPriority] <= targetLevel
          );
        }, {
          selector: params.selector,
          rules: params.rules,
          level: params.level || 'AA',
        });
        
        // Summary
        const summary = {
          totalViolations: violations.length,
          byRule: violations.reduce((acc: any, v: any) => {
            acc[v.rule] = (acc[v.rule] || 0) + 1;
            return acc;
          }, {}),
          byLevel: violations.reduce((acc: any, v: any) => {
            acc[v.level] = (acc[v.level] || 0) + 1;
            return acc;
          }, {}),
        };
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              summary,
              violations: violations.slice(0, 50), // Limit to first 50 violations
              note: 'This is a basic accessibility check. For comprehensive testing, use specialized tools like axe-core.',
            }, null, 2),
          }],
        };
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  getAccessibilityTree(captureSnapshot),
  checkAccessibility(captureSnapshot),
];