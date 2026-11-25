import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { SYSTEM_PROMPT } from './system-prompt';
import { compact, runTool, TOOLS } from './tools';
import { Injectable, Logger } from '@nestjs/common';
import { AirportsService } from '../airports/airports.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCallLog {
  name: string;
  input: unknown;
}

export interface ChatResponse {
  reply: string;
  toolCalls: ToolCallLog[]; // shown in the UI for transparency
}

/** Safety limit: stop if the model keeps calling tools without answering. */
const MAX_STEPS = 6;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(
    config: ConfigService,
    private readonly airports: AirportsService,
  ) {
    this.client = new Anthropic({
      apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
    this.model = config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5';
  }

  async chat(history: ChatMessage[]): Promise<ChatResponse> {
    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const toolCalls: ToolCallLog[] = [];

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      // No tool requested: this is the final answer.
      if (response.stop_reason !== 'tool_use') {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        return { reply, toolCalls };
      }

      // The model wants tools: record its turn, run each tool, send results back.
      messages.push({ role: 'assistant', content: response.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        this.logger.log(`Tool call: ${block.name} ${JSON.stringify(block.input)}`);
        toolCalls.push({ name: block.name, input: block.input });

        try {
          const output = runTool(block.name, block.input, this.airports);
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(compact(output)),
          });
        } catch (err) {
          // e.g. unknown airport code: let the model see the error and explain it.
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: err instanceof Error ? err.message : String(err),
            is_error: true,
          });
        }
      }
      messages.push({ role: 'user', content: results });
    }

    return {
      reply:
        'Sorry, I could not complete that request (too many steps). Try a more specific question.',
      toolCalls,
    };
  }
}