import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTorFetch } from './utils/tor-client.js';
import { VeniceLlmService } from './services/llm.js';
import { createSearchAhmiaTool } from './tools/search-ahmia.js';
import { createSearchTordexTool } from './tools/search-tordex.js';
import { createSearchDuckDuckGoTool } from './tools/search-duckduckgo.js';
import { createFetchOnionTool } from './tools/fetch-onion.js';
import { TorAgentEngine } from './agent.js';
import { initDatabase, saveMessage, getLastMessages, clearHistory, createThread, getThreads, deleteThread, renameThread } from './utils/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Explicit Dependency Injection setup
const apiKey = process.env.VENICE_API_KEY;
const model = process.env.VENICE_MODEL || 'deepseek-v4-flash';
const proxyUrl = process.env.TOR_PROXY_URL || 'socks5h://127.0.0.1:9150';

if (!apiKey) {
  console.error('\n[Error] VENICE_API_KEY is not defined in .env file.');
  console.error('Please open .env and write your Venice API key.\n');
  process.exit(1);
}

// Instantiate agent dependencies
const torFetch = createTorFetch({ proxyUrl });
const searchAhmia = createSearchAhmiaTool({ torFetch });
const searchTordex = createSearchTordexTool({ torFetch });
const searchDuckDuckGo = createSearchDuckDuckGoTool({ torFetch });
const fetchOnion = createFetchOnionTool({ torFetch });
const tools = [searchAhmia, searchTordex, searchDuckDuckGo, fetchOnion];

/**
 * Endpoint to retrieve all chat threads.
 */
app.get('/api/threads', async (req, res) => {
  try {
    const threads = await getThreads();
    res.json({ threads });
  } catch (error) {
    console.error(`[Threads API Error]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint to create a new thread.
 */
app.post('/api/threads', async (req, res) => {
  const { id, title } = req.body;
  if (!id || !title) {
    return res.status(400).json({ error: 'id and title are required.' });
  }

  try {
    await createThread(id, title);
    res.json({ success: true });
  } catch (error) {
    console.error(`[Create Thread API Error]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint to delete a specific thread and its history.
 */
app.delete('/api/threads/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await deleteThread(id);
    res.json({ success: true });
  } catch (error) {
    console.error(`[Delete Thread API Error]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint to rename a specific thread.
 */
app.put('/api/threads/:id', async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required.' });
  }

  try {
    await renameThread(id, title);
    res.json({ success: true });
  } catch (error) {
    console.error(`[Rename Thread API Error]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});


/**
 * Endpoint to retrieve chat history from SQLite for a specific thread.
 */
app.get('/api/chat/history', async (req, res) => {
  const { threadId } = req.query;
  if (!threadId) {
    return res.status(400).json({ error: 'threadId is required.' });
  }

  try {
    const messages = await getLastMessages(threadId, 50); // Fetch up to 50 previous messages
    res.json({ messages });
  } catch (error) {
    console.error(`[History API Error]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint to clear SQLite history for a specific thread.
 */
app.post('/api/chat/clear', async (req, res) => {
  const { threadId } = req.body;
  if (!threadId) {
    return res.status(400).json({ error: 'threadId is required.' });
  }

  try {
    await clearHistory(threadId);
    res.json({ success: true });
  } catch (error) {
    console.error(`[Clear API Error]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint for Real-time Streaming of Agent reasoning (SSE).
 */
app.post('/api/chat/stream', async (req, res) => {
  const { query, settings, threadId } = req.body;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Query is required.' });
  }
  if (!threadId) {
    return res.status(400).json({ error: 'threadId is required.' });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  console.log(`[HTTP Server] Starting stream for: "${query}" in thread "${threadId}"`);
  
  // Extract and apply AI Studio parameters dynamically
  const requestModel = settings?.model || model;
  const requestTemp = settings?.temperature !== undefined ? Number(settings.temperature) : 0.1;
  const requestIterations = settings?.maxIterations !== undefined ? Number(settings.maxIterations) : 6;
  const requestSystemPrompt = settings?.systemPrompt || null;

  const requestLlmService = new VeniceLlmService({
    apiKey,
    model: requestModel,
    temperature: requestTemp,
    fetchInstance: fetch
  });

  // Re-instantiate agent engine per-request to apply dynamic configuration
  const agent = new TorAgentEngine({
    llmService: requestLlmService,
    tools,
    maxIterations: requestIterations,
    systemPrompt: requestSystemPrompt
  });

  try {
    // 1. Fetch last 5 messages from SQLite database to feed LLM context
    const pastMessages = await getLastMessages(threadId, 5);
    const formattedHistory = pastMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // 2. Save user query in SQLite database (encrypted)
    await saveMessage(threadId, 'user', query);

    // 3. Run ReAct engine passing history
    const finalAnswer = await agent.run(query, formattedHistory, (event) => {
      // Stream each step (thought, action, observation, finalAnswer)
      if (event.type === 'action') {
        sendEvent(event.type, { tool: event.tool, args: event.args });
      } else {
        sendEvent(event.type, event.content ?? event);
      }
    });
    
    // 4. Save agent's final response in SQLite database (encrypted)
    await saveMessage(threadId, 'assistant', finalAnswer);

    sendEvent('done', 'Success');
  } catch (error) {
    console.error(`[HTTP Server Error]: ${error.message}`);
    sendEvent('error', error.message);
  } finally {
    res.end();
  }
});

// Initialize DB and start listening
async function startServer() {
  try {
    console.log('[SQLite] Initializing local encrypted database...');
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log('==================================================');
      console.log(`  Tor Dark Web Agent - Server Running!`);
      console.log(`  Access the GUI at: http://localhost:${PORT}`);
      console.log('==================================================');
    });
  } catch (error) {
    console.error(`Failed to initialize server: ${error.message}`);
    process.exit(1);
  }
}

startServer();
