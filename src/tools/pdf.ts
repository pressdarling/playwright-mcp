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

import * as javascript from '../javascript.js';
import { outputFile, standardizedOutputFile } from '../config.js';

const pdfSchema = z.object({
  filename: z.string().optional().describe('File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified.'),
});

const pdf = defineTool({
  capability: 'pdf',

  schema: {
    name: 'browser_pdf_save',
    title: 'Save as PDF',
    description: 'Save page as PDF',
    inputSchema: pdfSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    // Use standardized path if filename not provided
    const fileName = params.filename 
      ? await outputFile(context.config, params.filename)
      : await standardizedOutputFile(tab.page.url(), 'pdf');

    const code = [
      `// Save page as ${fileName}`,
      `await page.pdf(${javascript.formatObject({ path: fileName })});`,
    ];

    return {
      code,
      action: async () => tab.page.pdf({ path: fileName }).then(() => {}),
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default [
  pdf,
];
