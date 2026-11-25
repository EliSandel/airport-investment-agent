import { AgentService, ChatMessage } from './agent.service';
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

@Controller('chat')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  // POST /chat  { "messages": [{ "role": "user", "content": "..." }] }
  @Post()
  chat(@Body() body: { messages?: ChatMessage[] }) {
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('messages must be a non-empty array');
    }
    return this.agent.chat(messages);
  }
}