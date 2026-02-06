import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { rateLimit } from '@/lib/ratelimit';
import { streamText, StreamData } from 'ai';
import { openai } from '@ai-sdk/openai';

// Force Node.js runtime for Vercel
export const runtime = 'nodejs';

// Validation Schema
const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
  conversationId: z.string().uuid().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Verify ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ error: 'Not found or Unauthorized' }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success } = rateLimit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();

    // Validation
    const validation = chatSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const { messages, conversationId } = validation.data;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY');
      return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 });
    }

    let currentConversationId = conversationId;

    // 1. Create/Get conversation
    if (!currentConversationId) {
      // Get the last user message to use as title
      const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user');
      const title = lastUserMessage ? lastUserMessage.content.substring(0, 30) : 'New Conversation';

      const conversation = await prisma.conversation.create({
        data: {
          userId,
          title,
        },
      });
      currentConversationId = conversation.id;
    } else {
      // Verify ownership of existing conversation
      const existing = await prisma.conversation.findUnique({
        where: { id: currentConversationId },
      });
      if (!existing || existing.userId !== userId) {
        return NextResponse.json({ error: 'Not found or Unauthorized' }, { status: 404 });
      }
    }

    // 2. Save User Message (the last one in the array)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user') {
      await prisma.message.create({
        data: {
          role: 'user',
          content: lastMessage.content,
          conversationId: currentConversationId,
        },
      });
    }

    // 3. Prepare StreamData to return conversationId
    const data = new StreamData();
    data.append({ conversationId: currentConversationId });

    // 4. Stream response
    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages,
      onFinish: async ({ text }) => {
        // 5. Save Assistant Message
        await prisma.message.create({
          data: {
            role: 'assistant',
            content: text,
            conversationId: currentConversationId!,
          },
        });
        await data.close();
      },
    });

    return result.toDataStreamResponse({ data });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
