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

import { defineTool } from './tool.js';
import { outputFile, standardizedOutputFile } from '../config.js';

const saveHtmlSchema = z.object({
  filename: z.string().describe('File path to save the HTML to. Required parameter.'),
  selector: z.string().optional().describe('Optional CSS selector to extract HTML from specific element (default: entire page)'),
  includeStyles: z.boolean().optional().describe('Include computed styles in the HTML (default: false)'),
});

const saveHtml = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_save_html',
    title: 'Save page HTML to file',
    description: 'Save the full rendered HTML content of the page or specific element to a file, avoiding token limits',
    inputSchema: saveHtmlSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    // Use standardized path if filename contains common patterns
    const useStandardizedPath = params.filename.includes('save') || params.filename.includes('extract') || params.filename.includes('html');
    const fileName = useStandardizedPath
      ? await standardizedOutputFile(tab.page.url(), 'html')
      : await outputFile(context.config, params.filename);
    const selector = params.selector;
    const includeStyles = params.includeStyles ?? false;

    const code = [
      `// Save HTML content to ${fileName}`,
      selector ? `// Extracting from selector: ${selector}` : '// Extracting full page HTML',
      includeStyles ? '// Including computed styles' : '// Basic HTML only',
    ];

    if (selector) {
      code.push(`const element = await page.locator('${selector}').first();`);
      code.push(`const html = await element.innerHTML();`);
    } else {
      code.push(`const html = await page.content();`);
    }

    const action = async () => {
      let html: string;
      
      if (selector) {
        // Get HTML from specific element
        const element = tab.page.locator(selector).first();
        html = await element.innerHTML();
      } else {
        // Get full page HTML
        html = await tab.page.content();
      }

      // Optionally include computed styles
      if (includeStyles) {
        const styledHtml = await tab.page.evaluate(() => {
          const addComputedStyles = (element: Element): void => {
            const computedStyle = window.getComputedStyle(element);
            let styleString = '';
            
            // Get all computed style properties
            for (let i = 0; i < computedStyle.length; i++) {
              const property = computedStyle[i];
              const value = computedStyle.getPropertyValue(property);
              styleString += `${property}: ${value}; `;
            }
            
            if (styleString) {
              element.setAttribute('data-computed-style', styleString);
            }
            
            // Recursively process children
            Array.from(element.children).forEach(addComputedStyles);
          };
          
          // Clone the document to avoid modifying the original
          const clonedDoc = document.documentElement.cloneNode(true) as Element;
          addComputedStyles(clonedDoc);
          return clonedDoc.outerHTML;
        });
        html = styledHtml;
      }

      // Save to file
      const fs = await import('fs/promises');
      await fs.writeFile(fileName, html, 'utf8');
    };

    return {
      code,
      action,
      captureSnapshot: false,
      waitForNetwork: false,
      resultOverride: {
        content: [{
          type: 'text' as 'text',
          text: `HTML saved to: ${fileName}`,
        }]
      }
    };
  },
});

export default [
  saveHtml,
];