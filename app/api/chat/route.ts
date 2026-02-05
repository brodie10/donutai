import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { rateLimit } from '@/lib/ratelimit';

// Force Node.js runtime for Vercel
export const runtime = 'nodejs';

// Validation Schema
const chatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message is too long'),
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

    const { message, conversationId } = validation.data;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY');
      return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 });
    }

    let currentConversationId = conversationId;

    // 1. Create/Get conversation
    if (!currentConversationId) {
      const conversation = await prisma.conversation.create({
        data: {
          userId,
          title: message.substring(0, 30),
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

    // 2. Save User Message
    await prisma.message.create({
      data: {
        role: 'user',
        content: message,
        conversationId: currentConversationId,
      },
    });

    // 3. Fetch History
    const history = await prisma.message.findMany({
      where: { conversationId: currentConversationId },
      orderBy: { createdAt: 'asc' },
    });

    const apiMessages = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // 4. Call OpenAI API
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!openAiResponse.ok) {
      const errorData = await openAiResponse.json();
      console.error('OpenAI API Error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch from OpenAI' }, { status: 500 });
    }

    const data = await openAiResponse.json();
    const replyContent = data.choices[0].message.content;

    // 5. Save Assistant Message
    await prisma.message.create({
      data: {
        role: 'assistant',
        content: replyContent,
        conversationId: currentConversationId,
      },
    });

    return NextResponse.json({
      reply: replyContent,
      conversationId: currentConversationId,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
