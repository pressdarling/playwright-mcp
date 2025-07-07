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

test.describe('Network Interception Tools', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Network interception tests require chromium');
});

test('browser_route - abort requests', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'network', 'javascript'] 
    } 
  });

  server.setContent('/api/data', '{"message": "Should not see this"}', 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set up route to abort API calls
  await client.callTool({
    name: 'mcp__playwright__browser_route',
    arguments: {
      pattern: '**/api/**',
      handler: {
        abort: true,
      },
    },
  });

  // Try to fetch data - should fail
  const result = await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: `
        return fetch('/api/data')
          .then(() => 'success')
          .catch(() => 'aborted');
      `,
    },
  });

  expect(result.content?.[0]).toMatchObject({
    type: 'text',
    text: '"aborted"',
  });
});

test('browser_route - fulfill with custom response', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'network', 'javascript'] 
    } 
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set up route to return custom response
  await client.callTool({
    name: 'mcp__playwright__browser_route',
    arguments: {
      pattern: '**/api/custom',
      handler: {
        fulfill: {
          status: 200,
          body: '{"custom": true, "message": "Intercepted!"}',
          contentType: 'application/json',
        },
      },
    },
  });

  // Fetch data - should get custom response
  const result = await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: `
        return fetch('/api/custom')
          .then(r => r.json());
      `,
    },
  });

  expect(JSON.parse(result.content?.[0].text)).toEqual({
    custom: true,
    message: 'Intercepted!',
  });
});

test('browser_wait_for_request', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'network', 'javascript'] 
    } 
  });

  server.setContent('/api/delayed', '{"status": "ok"}', 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Start waiting for request in parallel
  const waitPromise = client.callTool({
    name: 'mcp__playwright__browser_wait_for_request',
    arguments: {
      urlPattern: '**/api/delayed',
      timeout: 5000,
    },
  });

  // Trigger the request after a small delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: `fetch('/api/delayed')`,
    },
  });

  // Wait should complete and return request info
  const result = await waitPromise;
  const requestInfo = JSON.parse(result.content?.[0].text);
  
  expect(requestInfo).toMatchObject({
    url: expect.stringContaining('/api/delayed'),
    method: 'GET',
  });
});

test('browser_wait_for_response', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'network', 'javascript'] 
    } 
  });

  server.setContent('/api/response-test', '{"result": "success"}', 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Start waiting for response in parallel
  const waitPromise = client.callTool({
    name: 'mcp__playwright__browser_wait_for_response',
    arguments: {
      urlPattern: '**/api/response-test',
    },
  });

  // Trigger the request
  await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: `fetch('/api/response-test')`,
    },
  });

  // Wait should complete and return response info
  const result = await waitPromise;
  const responseInfo = JSON.parse(result.content?.[0].text);
  
  expect(responseInfo).toMatchObject({
    url: expect.stringContaining('/api/response-test'),
    status: 200,
    ok: true,
    body: '{"result": "success"}',
  });
});

test('browser_get_requests - with filtering', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'network', 'javascript'] 
    } 
  });

  server.setContent('/api/endpoint1', '{"id": 1}', 'application/json');
  server.setContent('/api/endpoint2', '{"id": 2}', 'application/json');
  server.setContent('/other/endpoint', '{"id": 3}', 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Make multiple requests
  await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: `
        return Promise.all([
          fetch('/api/endpoint1'),
          fetch('/api/endpoint2'),
          fetch('/other/endpoint', { method: 'POST', body: 'test' }),
        ]);
      `,
    },
  });

  // Get only API requests
  const apiRequests = await client.callTool({
    name: 'mcp__playwright__browser_get_requests',
    arguments: {
      filter: {
        url: '*/api/*',
      },
    },
  });

  const requests = JSON.parse(apiRequests.content?.[0].text);
  expect(requests).toHaveLength(2);
  expect(requests.every((r: any) => r.url.includes('/api/'))).toBe(true);

  // Get only POST requests
  const postRequests = await client.callTool({
    name: 'mcp__playwright__browser_get_requests',
    arguments: {
      filter: {
        method: 'POST',
      },
    },
  });

  const postReqs = JSON.parse(postRequests.content?.[0].text);
  expect(postReqs).toHaveLength(1);
  expect(postReqs[0].method).toBe('POST');
});

test('browser_get_responses - with status filtering', async ({ startClient, server }) => {
  const { client } = await startClient({ 
    config: { 
      capabilities: ['core', 'network', 'javascript'] 
    } 
  });

  server.setContent('/success', 'OK', 'text/plain');
  server.route('/notfound', (req, res) => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
  server.route('/error', (req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server Error');
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Make requests with different status codes
  await client.callTool({
    name: 'mcp__playwright__browser_evaluate',
    arguments: {
      code: `
        return Promise.all([
          fetch('/success'),
          fetch('/notfound'),
          fetch('/error'),
        ]);
      `,
    },
  });

  // Get only error responses (400-599)
  const errorResponses = await client.callTool({
    name: 'mcp__playwright__browser_get_responses',
    arguments: {
      filter: {
        statusRange: {
          min: 400,
          max: 599,
        },
      },
    },
  });

  const responses = JSON.parse(errorResponses.content?.[0].text);
  expect(responses).toHaveLength(2);
  expect(responses.every((r: any) => r.status >= 400)).toBe(true);
});