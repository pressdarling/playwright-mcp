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

import { test, expect } from './fixtures.js';

test.describe('JavaScript Execution Tools', () => {
  // Skip these tests if not on chromium
  test.skip(({ browserName }) => browserName !== 'chromium', 'JavaScript tools tests require chromium');
});

test('browser_evaluate - executes simple JavaScript', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'javascript'] 
    } 
  });

  // Navigate to a simple page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Execute JavaScript
  const result = await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: 'return 2 + 2;',
    },
  });

  expect(result.content?.[0]).toMatchObject({
    type: 'text',
    text: '4',
  });
});

test('browser_evaluate - executes JavaScript with arguments', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'javascript'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: 'return arg0 + arg1;',
      args: [5, 3],
    },
  });

  expect(result.content?.[0]).toMatchObject({
    type: 'text',
    text: '8',
  });
});

test('browser_eval_on_selector - executes JavaScript on element', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'javascript'] 
    } 
  });

  server.setContent('/', `
    <title>Title</title>
    <h1 id="title">Hello World</h1>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'mcp__playwright__browser_eval_on_selector',
    arguments: {
      selector: '#title',
      code: 'return element.textContent;',
    },
  });

  expect(result.content?.[0]).toMatchObject({
    type: 'text',
    text: '"Hello World"',
  });
});

test('browser_eval_on_selector_all - executes JavaScript on multiple elements', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'javascript'] 
    } 
  });

  server.setContent('/', `
    <title>Title</title>
    <ul>
      <li>One</li>
      <li>Two</li>
      <li>Three</li>
    </ul>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'mcp__playwright__browser_eval_on_selector_all',
    arguments: {
      selector: 'li',
      code: 'return elements.map(el => el.textContent);',
    },
  });

  expect(result.content?.[0]).toMatchObject({
    type: 'text',
    text: '["One","Two","Three"]',
  });
});

test('browser_add_script_tag - adds inline script', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'javascript'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Add inline script
  await client.callTool({
    name: 'mcp__playwright__browser_add_script_tag',
    arguments: {
      content: 'window.testValue = 42;',
    },
  });

  // Verify script was executed
  const result = await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: 'return window.testValue;',
    },
  });

  expect(result.content?.[0]).toMatchObject({
    type: 'text',
    text: '42',
  });
});

test('browser_add_style_tag - adds inline styles', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'javascript'] 
    } 
  });

  server.setContent('/', `
    <title>Title</title>
    <h1 id="title">Hello World</h1>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate', 
    arguments: { url: server.PREFIX },
  });

  // Add inline styles
  await client.callTool({
    name: 'mcp__playwright__browser_add_style_tag',
    arguments: {
      content: '#title { color: rgb(255, 0, 0); }',
    },
  });

  // Verify styles were applied
  const result = await client.callTool({
    name: 'mcp__playwright__browser_eval_on_selector',
    arguments: {
      selector: '#title',
      code: 'return window.getComputedStyle(element).color;',
    },
  });

  expect(result.content?.[0]).toMatchObject({
    type: 'text',
    text: '"rgb(255, 0, 0)"',
  });
});

test('browser_add_init_script - runs on navigation', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'javascript'] 
    } 
  });

  // Add init script before navigation
  await client.callTool({
    name: 'mcp__playwright__browser_add_init_script',
    arguments: {
      script: 'window.initValue = "initialized";',
    },
  });

  // Navigate to page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Verify init script ran
  const result = await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: 'return window.initValue;',
    },
  });

  expect(result.content?.[0]).toMatchObject({
    type: 'text',
    text: '"initialized"',
  });
});

test('browser_remove_scripts - removes scripts by selector', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'javascript'] 
    } 
  });

  server.setContent('/', `
    <title>Title</title>
    <script id="script1">window.value1 = 1;</script>
    <script id="script2">window.value2 = 2;</script>
    <script>window.value3 = 3;</script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Remove scripts with id attribute
  const result = await client.callTool({
    name: 'mcp__playwright__browser_remove_scripts',
    arguments: {
      selector: 'script[id]',
    },
  });

  expect(result.content?.[0]).toMatchObject({
    type: 'text', 
    text: 'Removed 2 script(s) matching selector: script[id]',
  });

  // Verify only the script without id remains
  const countResult = await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: 'return document.querySelectorAll("script").length;',
    },
  });

  expect(countResult.content?.[0]).toMatchObject({
    type: 'text',
    text: '1',
  });
});

test('browser_evaluate_handle - returns handle info', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'javascript'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'mcp__playwright__browser_evaluate_handle',
    arguments: {
      code: 'return { foo: "bar", nested: { value: 42 } };',
    },
  });

  // Should return handle info
  const content = JSON.parse(result.content?.[0].text);
  expect(content).toMatchObject({
    type: 'object',
    isElement: false,
    info: 'Handle created for future use',
  });
  expect(content.handleId).toMatch(/^handle_\d+_[a-z0-9]+$/);
});