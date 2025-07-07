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

test.describe('Storage Management Tools', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Storage tests require chromium');
});

test('browser_set_storage and browser_get_storage - localStorage', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'storage'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set localStorage data
  await client.callTool({
    name: 'mcp__playwright__browser_set_storage',
    arguments: {
      type: 'local',
      data: {
        'user.name': 'John Doe',
        'user.id': '12345',
        'app.theme': 'dark',
      },
    },
  });

  // Get localStorage data
  const result = await client.callTool({
    name: 'mcp__playwright__browser_get_storage',
    arguments: {
      type: 'local',
    },
  });

  const storage = JSON.parse(result.content?.[0].text);
  expect(storage).toEqual({
    'user.name': 'John Doe',
    'user.id': '12345',
    'app.theme': 'dark',
  });
});

test('browser_set_storage with clear option', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'storage'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set initial data
  await client.callTool({
    name: 'mcp__playwright__browser_set_storage',
    arguments: {
      type: 'local',
      data: {
        'old.key': 'should be removed',
      },
    },
  });

  // Set new data with clear option
  await client.callTool({
    name: 'mcp__playwright__browser_set_storage',
    arguments: {
      type: 'local',
      data: {
        'new.key': 'should exist',
      },
      clear: true,
    },
  });

  // Verify only new data exists
  const result = await client.callTool({
    name: 'mcp__playwright__browser_get_storage',
    arguments: {
      type: 'local',
    },
  });

  const storage = JSON.parse(result.content?.[0].text);
  expect(storage).toEqual({
    'new.key': 'should exist',
  });
});

test('browser_clear_storage - specific keys', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'storage'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set multiple items
  await client.callTool({
    name: 'mcp__playwright__browser_set_storage',
    arguments: {
      type: 'local',
      data: {
        'keep.this': 'value1',
        'remove.this': 'value2',
        'remove.that': 'value3',
      },
    },
  });

  // Clear specific keys
  const clearResult = await client.callTool({
    name: 'mcp__playwright__browser_clear_storage',
    arguments: {
      type: 'local',
      keys: ['remove.this', 'remove.that'],
    },
  });

  expect(clearResult.content?.[0].text).toBe('Removed 2 item(s)');

  // Verify remaining data
  const result = await client.callTool({
    name: 'mcp__playwright__browser_get_storage',
    arguments: {
      type: 'local',
    },
  });

  const storage = JSON.parse(result.content?.[0].text);
  expect(storage).toEqual({
    'keep.this': 'value1',
  });
});

test('browser_clear_storage - all storage', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'storage'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set data in both storages
  await client.callTool({
    name: 'mcp__playwright__browser_set_storage',
    arguments: {
      type: 'local',
      data: { 'local.key': 'value' },
    },
  });

  await client.callTool({
    name: 'mcp__playwright__browser_set_storage',
    arguments: {
      type: 'session',
      data: { 'session.key': 'value' },
    },
  });

  // Clear all storage
  const clearResult = await client.callTool({
    name: 'mcp__playwright__browser_clear_storage',
    arguments: {
      type: 'all',
    },
  });

  expect(clearResult.content?.[0].text).toContain('Cleared all storage');

  // Verify both are empty
  const localStorage = await client.callTool({
    name: 'mcp__playwright__browser_get_storage',
    arguments: { type: 'local' },
  });
  expect(JSON.parse(localStorage.content?.[0].text)).toEqual({});

  const sessionStorage = await client.callTool({
    name: 'mcp__playwright__browser_get_storage',
    arguments: { type: 'session' },
  });
  expect(JSON.parse(sessionStorage.content?.[0].text)).toEqual({});
});

test('browser_set_cookies and browser_get_cookies', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'storage'] 
    } 
  });

  server.setContent('/', 'Test page', 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set cookies
  await client.callTool({
    name: 'mcp__playwright__browser_set_cookies',
    arguments: {
      cookies: [
        {
          name: 'session_id',
          value: 'abc123',
          domain: new URL(server.PREFIX).hostname,
          path: '/',
        },
        {
          name: 'user_pref',
          value: 'dark_mode',
          domain: new URL(server.PREFIX).hostname,
          path: '/',
          httpOnly: true,
        },
      ],
    },
  });

  // Get all cookies
  const result = await client.callTool({
    name: 'mcp__playwright__browser_get_cookies',
    arguments: {},
  });

  const cookies = JSON.parse(result.content?.[0].text);
  expect(cookies).toHaveLength(2);
  
  const sessionCookie = cookies.find((c: any) => c.name === 'session_id');
  expect(sessionCookie).toMatchObject({
    name: 'session_id',
    value: 'abc123',
  });

  const prefCookie = cookies.find((c: any) => c.name === 'user_pref');
  expect(prefCookie).toMatchObject({
    name: 'user_pref',
    value: 'dark_mode',
    httpOnly: true,
  });
});

test('browser_get_cookies - with filtering', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'storage'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set multiple cookies
  await client.callTool({
    name: 'mcp__playwright__browser_set_cookies',
    arguments: {
      cookies: [
        {
          name: 'cookie1',
          value: 'value1',
          domain: new URL(server.PREFIX).hostname,
        },
        {
          name: 'cookie2',
          value: 'value2',
          domain: new URL(server.PREFIX).hostname,
        },
        {
          name: 'other_cookie',
          value: 'value3',
          domain: new URL(server.PREFIX).hostname,
        },
      ],
    },
  });

  // Get cookies by name
  const result = await client.callTool({
    name: 'mcp__playwright__browser_get_cookies',
    arguments: {
      name: 'cookie1',
    },
  });

  const cookies = JSON.parse(result.content?.[0].text);
  expect(cookies).toHaveLength(1);
  expect(cookies[0].name).toBe('cookie1');
});

test('browser_delete_cookies', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'storage'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set cookies
  await client.callTool({
    name: 'mcp__playwright__browser_set_cookies',
    arguments: {
      cookies: [
        {
          name: 'keep_this',
          value: 'value1',
          domain: new URL(server.PREFIX).hostname,
        },
        {
          name: 'delete_this',
          value: 'value2',
          domain: new URL(server.PREFIX).hostname,
        },
      ],
    },
  });

  // Delete specific cookie
  const deleteResult = await client.callTool({
    name: 'mcp__playwright__browser_delete_cookies',
    arguments: {
      name: 'delete_this',
    },
  });

  expect(deleteResult.content?.[0].text).toBe('Deleted 1 cookie(s)');

  // Verify remaining cookies
  const result = await client.callTool({
    name: 'mcp__playwright__browser_get_cookies',
    arguments: {},
  });

  const cookies = JSON.parse(result.content?.[0].text);
  expect(cookies).toHaveLength(1);
  expect(cookies[0].name).toBe('keep_this');
});