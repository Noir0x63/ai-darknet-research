import dotenv from 'dotenv';
import readline from 'readline';
import { createTorFetch } from './utils/tor-client.js';
import { VeniceLlmService } from './services/llm.js';
import { createSearchAhmiaTool } from './tools/search-ahmia.js';
import { createSearchTordexTool } from './tools/search-tordex.js';
import { createSearchDuckDuckGoTool } from './tools/search-duckduckgo.js';
import { createFetchOnionTool } from './tools/fetch-onion.js';
import { TorAgentEngine } from './agent.js';

dotenv.config();

/**
 * Bootstrap the application.
 * Wiring dependencies explicitly (Dependency Injection).
 */
async function bootstrap() {
  const apiKey = process.env.VENICE_API_KEY;
  const model = process.env.VENICE_MODEL || 'deepseek-v4-flash';
  const proxyUrl = process.env.TOR_PROXY_URL || 'socks5h://127.0.0.1:9150';

  if (!apiKey) {
    console.error('\n[Error] VENICE_API_KEY is not defined in your .env file.');
    console.error('Please open .env and add your Venice AI API key first.');
    process.exit(1);
  }

  console.log('==================================================');
  console.log('       TOR DARK WEB AGENT (VENICE AI + DEEPSEEK)  ');
  console.log('==================================================');
  console.log(`Model:      ${model}`);
  console.log(`Tor Proxy:  ${proxyUrl}`);
  console.log('==================================================\n');

  // 1. Initialize Tor Fetch Client
  let torFetch;
  try {
    torFetch = createTorFetch({ proxyUrl });
  } catch (error) {
    console.error(`Failed to initialize Tor client: ${error.message}`);
    process.exit(1);
  }

  // 2. Initialize Venice LLM service
  const llmService = new VeniceLlmService({
    apiKey,
    model,
    fetchInstance: fetch // Native global fetch for LLM requests (clearnet)
  });

  // 3. Initialize Tools
  const searchTool = createSearchAhmiaTool({ torFetch });
  const tordexTool = createSearchTordexTool({ torFetch });
  const duckduckgoTool = createSearchDuckDuckGoTool({ torFetch });
  const fetchTool = createFetchOnionTool({ torFetch });
  const tools = [searchTool, tordexTool, duckduckgoTool, fetchTool];

  // 4. Initialize Agent Engine
  const agent = new TorAgentEngine({
    llmService,
    tools,
    maxIterations: 6
  });

  // 5. Start CLI loop
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = () => {
    rl.question('\nEnter research prompt (or type "exit" to quit): ', async (query) => {
      if (query.trim().toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      if (query.trim() === '') {
        askQuestion();
        return;
      }

      try {
        const result = await agent.run(query);
        console.log('\n==================================================');
        console.log('                RESEARCH RESULT                   ');
        console.log('==================================================');
        console.log(result);
        console.log('==================================================');
      } catch (error) {
        console.error(`\n[Agent Error]: ${error.message}`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

bootstrap();
