import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testFileSaving() {
  console.log('Starting playwright-mcp client test...\n');
  
  // Start the MCP server
  const proc = spawn('node', ['lib/program.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['lib/program.js'],
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  console.log('Connected to MCP server\n');

  try {
    // Navigate to the Warriors demo page
    console.log('1. Navigating to Warriors demo page...');
    await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'http://localhost:8090/demo/warriors'
      }
    });
    console.log('✓ Navigation complete\n');

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 1: Take a snapshot (should use standardized path)
    console.log('2. Testing snapshot with default filename...');
    const snapshotResult = await client.callTool({
      name: 'browser_snapshot',
      arguments: {
        filename: '-tmp-widget-current-state.html'
      }
    });
    console.log('Snapshot result:', snapshotResult.content[0].text);
    console.log('');

    // Test 2: Take a screenshot (should use standardized path)
    console.log('3. Testing screenshot...');
    const screenshotResult = await client.callTool({
      name: 'browser_take_screenshot',
      arguments: {
        filename: 'warriors-screenshot.png',
        fullPage: true
      }
    });
    console.log('Screenshot result:', screenshotResult.content[0].text);
    console.log('');

    // Test 3: Save HTML (should use standardized path)
    console.log('4. Testing HTML save...');
    const htmlResult = await client.callTool({
      name: 'browser_save_html',
      arguments: {
        filename: 'warriors-page-save.html',
        includeStyles: true
      }
    });
    console.log('HTML save result:', htmlResult.content[0].text);
    console.log('');

    // Test 4: Save PDF (should use standardized path when no filename)
    console.log('5. Testing PDF save without filename...');
    const pdfResult = await client.callTool({
      name: 'browser_pdf_save',
      arguments: {}
    });
    console.log('PDF save result:', pdfResult.content[0].text);
    console.log('');

    // List the created files
    console.log('6. Checking created files...');
    const { execSync } = await import('child_process');
    const files = execSync('ls -la /tmp/playwright-mcp/', { encoding: 'utf-8' });
    console.log('Files in /tmp/playwright-mcp/:\n', files);

  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await client.close();
    proc.kill();
  }
}

testFileSaving().catch(console.error);