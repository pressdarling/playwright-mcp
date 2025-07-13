# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building the Project
```bash
npm install              # Install dependencies
npm run build           # Compile TypeScript to JavaScript
npm run watch           # Watch mode for development
```

### Running Tests
```bash
npm test                # Run all tests
npm run ctest           # Run Chrome tests only
npm run ftest           # Run Firefox tests only
npm run wtest           # Run WebKit tests only
npm run etest           # Run extension tests

# Run specific test file
npx playwright test tests/core.spec.ts
npx playwright test tests/javascript.spec.ts

# Run tests with UI mode
npx playwright test --ui

# Run tests in debug mode
npx playwright test --debug
```

### Linting and Type Checking
```bash
npm run lint            # Run ESLint and TypeScript type checking
```

### Running the Server Locally
```bash
# Build first
npm run build

# Run as standalone server with SSE transport
node lib/browserServer.js --port 8931

# Or run directly after building
node cli.js --port 8931

# With specific options
node cli.js --port 8931 --headless --browser chrome
node cli.js --port 8931 --keep-browser-open --vision
```

## High-Level Architecture

### Core Components

1. **Server Architecture** (`src/server.ts`, `src/connection.ts`, `src/context.ts`)
   - The `Server` class manages MCP protocol implementation and tool registration
   - `Connection` handles individual client connections and manages browser contexts
   - `Context` wraps Playwright's BrowserContext with additional functionality for tabs and tools

2. **Transport Layer** (`src/transport.ts`, `src/httpServer.ts`)
   - Supports both stdio (default) and SSE (Server-Sent Events) transports
   - SSE transport enables running the server standalone for headless environments

3. **Tool System** (`src/tools.ts`, `src/tools/`)
   - Tools are organized by category in separate files under `src/tools/`
   - Each tool extends the base `Tool` class and implements `execute()` method
   - Tools are registered based on enabled capabilities

4. **Browser Management** (`src/browserContextFactory.ts`)
   - `BrowserContextFactory` handles browser launching and context creation
   - Supports persistent profiles, isolated contexts, and CDP connections
   - `PersistentContextFactory` manages browser reuse with `--keep-browser-open`

5. **Page Snapshots** (`src/pageSnapshot.ts`)
   - Two modes: Accessibility tree (default) or Vision mode (screenshots)
   - Snapshots provide structured data for LLM interaction without requiring vision models

### Recent Enhancements

The fork has added significant functionality in three phases:

1. **Phase 1: JavaScript Execution & Script Injection**
   - Direct JavaScript execution in page context
   - Script and style tag injection
   - Evaluation on specific DOM elements

2. **Phase 2: Network Interception & Storage Management**
   - Request/response interception and modification
   - Cookie and storage manipulation
   - Network monitoring capabilities

3. **Phase 3: Advanced DOM, Frames, Waiting & Accessibility**
   - DOM query and manipulation tools
   - Frame context management
   - Custom wait conditions
   - Accessibility tree analysis

### Key Features Added by Fork

- **Token Optimization**: Auto-saves large snapshots (>5000 tokens) to files to prevent token limit errors
- **E-commerce Tools**: Specialized extraction tools for product listings and filters
  - `filterExtraction`: Extract and analyze filter/facet containers from e-commerce sites
  - `htmlExtraction`: Save full page HTML to files, avoiding token limits
  - `productExtraction`: Extract structured product data from listings
- **Persistent Browser**: `--keep-browser-open` flag maintains browser across connections
- **File-based Output**: Screenshot and snapshot tools save to files instead of inline responses

### Configuration

- CLI arguments are parsed in `src/program.ts`
- Configuration is resolved in `src/config.ts`
- Supports JSON config files with comprehensive browser and server options

### Testing Approach

- Uses Playwright Test framework with custom fixtures
- Tests are organized by feature area in `tests/`
- Test server in `tests/testserver/` provides mock endpoints
- Extension tests use a custom Chrome extension for CDP relay

## Development Notes

- The project uses ES modules (`"type": "module"` in package.json)
- TypeScript compilation outputs to `lib/` directory
- The fork maintains backward compatibility while adding new tools
- Browser persistence is achieved through context caching in `PersistentContextFactory`

### Testing Fork Features

The root directory contains several test files for validating fork-specific features:

- `test-simple.js`: Basic connectivity and tool availability test
- `test-keep-browser-open.js`: Tests persistent browser functionality
- `test-all-features.js`: Comprehensive test of all Phase 1-3 enhancements
- `test-phase2-simple.js`: Tests network and storage management tools
- `test-phase3-features.js`: Tests DOM, frames, and accessibility tools
- `demo-new-features.js`: Interactive demonstration of key capabilities

### Debugging Tips

- Use `--headless=false` (or omit --headless) to see the browser during development
- Check `--output-dir` for saved snapshots and screenshots when debugging token issues
- Use `DEBUG=*` environment variable for verbose logging
- The `--save-trace` flag enables Playwright trace viewer for debugging