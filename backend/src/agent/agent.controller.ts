import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AgentService, ChatMessage } from './agent.service';

const MAX_MESSAGES = 30; // conversation length limit
const MAX_MESSAGE_LENGTH = 4000; // characters per message

@Controller('chat')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  // POST /chat  { "messages": [{ "role": "user", "content": "..." }] }
  @Post()
  chat(@Body() body: { messages?: unknown }) {
    return this.agent.chat(validateMessages(body?.messages));
  }
}

/**
 * Never trust the client. Only plain-text user/assistant messages are allowed,
 * so a client can't inject fake tool calls or tool results into the history.
 */
function validateMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('messages must be a non-empty array');
  }
  if (input.length > MAX_MESSAGES) {
    throw new BadRequestException(
      `Conversation too long (max ${MAX_MESSAGES} messages). Please start a new chat.`,
    );
  }

  const messages = input as Array<Partial<ChatMessage> | null>;
  for (const m of messages) {
    if (
      !m ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string'
    ) {
      throw new BadRequestException(
        'Each message needs role "user" or "assistant" and text content',
      );
    }
    if (m.content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
      );
    }
  }
  if (messages[messages.length - 1]!.role !== 'user') {
    throw new BadRequestException('The last message must be from the user');
  }

  // Rebuild each message so no extra fields get through.
  return messages.map((m) => ({ role: m!.role!, content: m!.content! }));
}