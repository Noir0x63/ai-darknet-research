/**
 * ReAct (Reasoning + Action) Agent Engine.
 * Highly decoupled and implements Dependency Injection.
 */
export class TorAgentEngine {
  #llmService;
  #tools;
  #maxIterations;
  #customSystemPrompt;

  /**
   * @param {Object} params
   * @param {Object} params.llmService Service instance to query the LLM
   * @param {Array<Object>} params.tools List of available tools
   * @param {number} [params.maxIterations] Max reasoning loops to prevent runaway runs
   * @param {string} [params.systemPrompt] Custom system instructions base
   */
  constructor({ llmService, tools, maxIterations = 5, systemPrompt = null }) {
    if (!llmService) {
      throw new Error('TorAgentEngine: llmService is required.');
    }
    if (!Array.isArray(tools)) {
      throw new Error('TorAgentEngine: tools must be an array.');
    }

    this.#llmService = llmService;
    this.#tools = tools;
    this.#maxIterations = maxIterations;
    this.#customSystemPrompt = systemPrompt;
  }

  /**
   * Builds the system instructions prompt detailing available tools and ReAct format.
   * Pure function.
   * 
   * @returns {string}
   */
  #buildSystemPrompt() {
    const toolsDescription = this.#tools
      .map(tool => `- **${tool.name}**: ${tool.description}\n  Parameters: ${JSON.stringify(tool.parameters)}`)
      .join('\n\n');

    const basePrompt = this.#customSystemPrompt && this.#customSystemPrompt.trim() !== ''
      ? this.#customSystemPrompt
      : `You are a cybersecurity research agent specialized in investigating onion websites and resources on the Tor Network.
You must solve the user's query by gathering information from the dark web using your tools.`;

    return `${basePrompt}

Available tools:
${toolsDescription}

Format rules:
You must think step-by-step. In each step, you must output EXACTLY one of the following formats:

Format 1: For calling a tool
Thought: <Describe your reasoning on what to find next>
Action: <ToolName>({ "arg1": "value1" })

Format 2: For providing the final conclusion
Thought: <Describe your final reasoning or summary of observations>
Final Answer: <Your comprehensive answer to the user query>

CRITICAL RULES:
1. ONLY use the tools provided.
2. DO NOT hallucinate tool outputs.
3. Every Action call must be a valid tool name followed by the argument object in JSON format.
4. Only call ONE tool per turn.
5. All traffic from these tools routes through Tor. Treat the Tor network as slow and unstable.
6. **Efficiency Rule**: Stop researching as soon as you have sufficient information to answer the user's query. Do not perform extra tool calls, queries, or page visits if you can already construct a valid answer. Give your Final Answer immediately when you have enough data.
`;
  }

  /**
   * Parses the LLM response to extract thoughts, actions, or final answers.
   * Fail-Fast guard clauses implemented.
   * 
   * @param {string} text 
   * @returns {Object} { thought, action, args, finalAnswer }
   */
  #parseResponse(text) {
    // Robust Thought parsing handling optional markdown asterisks and colon placements
    const thoughtRegex = /(?:\*?\*?Thought\*?\*?\s*:?\s*\*?\*?)\s*([\s\S]*?)(?=(?:\*?\*?Action\*?\*?\s*:?\s*\*?\*?)|(?:\*?\*?Final Answer\*?\*?\s*:?\s*\*?\*?)|$)/i;
    const thoughtMatch = text.match(thoughtRegex);
    const thought = thoughtMatch ? thoughtMatch[1].trim() : '';

    // Robust Final Answer parsing
    const finalAnswerRegex = /(?:\*?\*?Final\s+Answer\*?\*?\s*:?\s*\*?\*?)/i;
    if (finalAnswerRegex.test(text)) {
      const finalAnswerParts = text.split(finalAnswerRegex);
      const finalAnswer = finalAnswerParts[finalAnswerParts.length - 1].trim();
      return { thought, finalAnswer };
    }

    // Robust Action parsing
    const actionRegex = /(?:\*?\*?Action\*?\*?\s*:?\s*\*?\*?)\s*(\w+)\s*\(([\s\S]*?)\)/i;
    const actionMatch = text.match(actionRegex);
    if (!actionMatch) {
      // If we cannot parse a structured action and there is no Final Answer, treat the entire block as the answer
      return { thought, finalAnswer: text };
    }

    const actionName = actionMatch[1].trim();
    const actionArgsRaw = actionMatch[2].trim();

    let args = {};
    try {
      args = JSON.parse(actionArgsRaw);
    } catch (e) {
      // Attempt to clean or wrap raw string if JSON parsing fails
      console.warn(`[Agent Engine] Failed parsing args JSON: "${actionArgsRaw}". Retrying fallback.`);
      if (actionArgsRaw.startsWith('"') && actionArgsRaw.endsWith('"')) {
        args = { query: actionArgsRaw.slice(1, -1) };
      } else {
        args = { query: actionArgsRaw };
      }
    }

    return { thought, action: actionName, args };
  }

  /**
   * Runs the main reasoning loop.
   * 
   * @param {string} userQuery 
   * @param {Array<Object>} [chatHistory] Past conversation history of { role, content }
   * @param {Function} [onEvent] Event callback for streaming agent actions
   * @returns {Promise<string>} Final response
   */
  async run(userQuery, chatHistory = [], onEvent = () => {}) {
    // Check if the second parameter is the callback (to support backward compatibility)
    let actualHistory = chatHistory;
    let actualCallback = onEvent;
    if (typeof chatHistory === 'function') {
      actualCallback = chatHistory;
      actualHistory = [];
    }
    onEvent = actualCallback;

    if (!userQuery) {
      throw new Error('TorAgentEngine.run: userQuery is required.');
    }

    console.log(`[Tor Agent] Starting research for query: "${userQuery}"`);

    const systemPrompt = this.#buildSystemPrompt();
    const history = [...actualHistory, { role: 'user', content: userQuery }];

    for (let iteration = 1; iteration <= this.#maxIterations; iteration++) {
      console.log(`\n--- Loop Iteration ${iteration} of ${this.#maxIterations} ---`);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history
      ];

      // If it is the final turn, append a warning to the last user message
      if (iteration === this.#maxIterations && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'user') {
          messages[messages.length - 1] = {
            ...lastMsg,
            content: lastMsg.content + '\n\n**CRITICAL WARNING**: This is your final turn. You must NOT perform another Tool Action. Summarize all the data you gathered in previous steps and output your Final Answer now.'
          };
        }
      }

      const llmOutput = await this.#llmService.generateCompletion(messages);
      console.log(`[LLM Response]:\n${llmOutput}`);

      const { thought, action, args, finalAnswer } = this.#parseResponse(llmOutput);

      if (thought) {
        onEvent({ type: 'thought', content: thought });
      }

      if (finalAnswer) {
        console.log('\n[Tor Agent] Research Complete.');
        onEvent({ type: 'finalAnswer', content: finalAnswer });
        return finalAnswer;
      }

      if (action) {
        onEvent({ type: 'action', tool: action, args });

        const tool = this.#tools.find(t => t.name === action);
        if (!tool) {
          const errMsg = `Observation: Tool "${action}" does not exist. Choose from: ${this.#tools.map(t => t.name).join(', ')}`;
          history.push({ role: 'assistant', content: llmOutput });
          history.push({ role: 'user', content: errMsg });
          onEvent({ type: 'observation', content: errMsg });
          continue;
        }

        console.log(`[Agent Engine] Executing Tool "${action}" with args:`, args);
        
        let observation;
        try {
          observation = await tool.execute(args);
        } catch (error) {
          observation = `Error executing tool: ${error.message}`;
        }

        console.log(`[Tool Output (Sample)]: ${observation.substring(0, 300)}...`);
        onEvent({ type: 'observation', content: observation });

        // Record the reasoning step and the tool result in alternating role order
        history.push({ role: 'assistant', content: llmOutput });
        history.push({ role: 'user', content: `Observation: ${observation}` });
      } else {
        // Fallback for unrecognized formats
        const formatMsg = `Observation: Your response did not follow the required Format 1 or Format 2. Make sure you use 'Thought:' and either 'Action: ToolName({"arg": "val"})' or 'Final Answer: <conclusion>'.`;
        history.push({ role: 'assistant', content: llmOutput });
        history.push({ role: 'user', content: formatMsg });
        onEvent({ type: 'observation', content: formatMsg });
      }
    }

    throw new Error(`Agent failed to resolve the query within ${this.#maxIterations} iterations.`);
  }
}
