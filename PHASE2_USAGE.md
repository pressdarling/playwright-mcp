# Phase 2 Tools Usage Guide

## Overview

Phase 2 adds powerful network interception and storage management capabilities to the Playwright MCP server.

## Starting the Server

To use the Phase 2 tools, start the server with the appropriate capabilities:

```bash
node cli.js --port 8931 --browser chrome --caps "core,javascript,network,storage"
```

## Network Interception Tools

### 1. Route Network Requests
```javascript
// Intercept and modify network requests
await client.callTool({
  name: 'mcp__playwright__browser_route',
  arguments: {
    pattern: '**/api/**',
    handler: {
      // Option 1: Abort requests
      abort: true,
      
      // Option 2: Fulfill with custom response
      fulfill: {
        status: 200,
        body: '{"custom": true}',
        contentType: 'application/json'
      },
      
      // Option 3: Continue with modifications
      continue: {
        headers: { 'X-Custom': 'header' }
      }
    }
  }
});
```

### 2. Wait for Requests/Responses
```javascript
// Wait for specific request
await client.callTool({
  name: 'mcp__playwright__browser_wait_for_request',
  arguments: {
    urlPattern: '**/api/data',
    timeout: 5000
  }
});

// Wait for specific response
await client.callTool({
  name: 'mcp__playwright__browser_wait_for_response',
  arguments: {
    urlPattern: '**/api/data'
  }
});
```

### 3. Get Network Activity
```javascript
// Get all requests with filtering
await client.callTool({
  name: 'mcp__playwright__browser_get_requests',
  arguments: {
    filter: {
      url: '*/api/*',
      method: 'POST'
    }
  }
});

// Get responses with status filtering
await client.callTool({
  name: 'mcp__playwright__browser_get_responses',
  arguments: {
    filter: {
      statusRange: { min: 400, max: 599 }
    }
  }
});
```

## Storage Management Tools

### 1. Local/Session Storage
```javascript
// Set storage
await client.callTool({
  name: 'mcp__playwright__browser_set_storage',
  arguments: {
    type: 'local', // or 'session'
    data: {
      'user.id': '12345',
      'app.theme': 'dark'
    },
    clear: true // Optional: clear existing storage first
  }
});

// Get storage
await client.callTool({
  name: 'mcp__playwright__browser_get_storage',
  arguments: {
    type: 'local'
  }
});

// Clear storage
await client.callTool({
  name: 'mcp__playwright__browser_clear_storage',
  arguments: {
    type: 'local',
    keys: ['user.id'] // Optional: specific keys to remove
  }
});
```

### 2. Cookie Management
```javascript
// Set cookies
await client.callTool({
  name: 'mcp__playwright__browser_set_cookies',
  arguments: {
    cookies: [{
      name: 'session_id',
      value: 'abc123',
      domain: 'example.com',
      path: '/',
      httpOnly: true
    }]
  }
});

// Get cookies
await client.callTool({
  name: 'mcp__playwright__browser_get_cookies',
  arguments: {
    name: 'session_id', // Optional filter
    domain: 'example.com' // Optional filter
  }
});

// Delete cookies
await client.callTool({
  name: 'mcp__playwright__browser_delete_cookies',
  arguments: {
    name: 'session_id'
  }
});
```

## Testing

The Phase 2 implementation includes comprehensive test files:
- `tests/network-interception.spec.ts` - Network interception tests
- `tests/storage.spec.ts` - Storage management tests

To run tests:
```bash
npm test -- tests/network-interception.spec.ts tests/storage.spec.ts
```

## Implementation Files

- `src/tools/networkInterception.ts` - Network interception tools
- `src/tools/storage.ts` - Storage management tools
- Updated `config.d.ts` with new capabilities: 'network', 'storage'