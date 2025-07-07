#!/bin/bash

echo "Testing Phase 2 tools with fresh server..."

# Kill any existing server on port 8931
lsof -ti:8931 | xargs kill -9 2>/dev/null || true

# Start the server in background
echo "Starting MCP server..."
node cli.js --port 8931 --browser chrome &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Run the test
echo "Running Phase 2 tests..."
node test-phase2-simple.js

# Kill the server
kill $SERVER_PID 2>/dev/null || true

echo "Test complete."