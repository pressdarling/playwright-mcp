import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function testKeepBrowserOpen() {
  console.log('Testing --keep-browser-open functionality...');
  
  const client = new Client({ name: 'test-keep-browser', version: '1.0.0' });
  const transport = new SSEClientTransport(new URL('http://localhost:8931/sse'));
  await client.connect(transport);

  try {
    console.log('1. Navigating to a page...');
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });

    console.log('2. Opening a second tab...');
    await client.callTool({
      name: 'browser_tab_new',
      arguments: { url: 'https://www.google.com' }
    });

    console.log('3. Listing tabs...');
    const tabsList = await client.callTool({
      name: 'browser_tab_list',
      arguments: {}
    });
    console.log('Tabs:', tabsList.content[0].text);

    console.log('4. Closing first tab...');
    await client.callTool({
      name: 'browser_tab_close',
      arguments: { index: 1 }
    });

    console.log('5. Closing second tab (last tab)...');
    await client.callTool({
      name: 'browser_tab_close',
      arguments: { index: 1 }
    });

    console.log('6. All tabs closed. Browser should still be running due to --keep-browser-open flag.');
    
    // Wait a bit to observe the browser
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('7. Opening a new tab to verify browser is still alive...');
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://playwright.dev' }
    });

    console.log('✅ Success! Browser stayed open and we could create a new tab.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Just close the client connection, leave browser open
    console.log('8. Closing client connection (browser stays open)...');
    await client.close();
  }
}

testKeepBrowserOpen().catch(console.error);