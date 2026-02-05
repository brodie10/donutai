import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const conversations = await prisma.conversation.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        const formatted = conversations.map((c) => ({
            id: c.id,
            createdAt: c.createdAt,
            title: c.messages[0]?.content.substring(0, 30) || 'Empty Conversation',
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Failed to fetch conversations:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // Verify ownership before deleting
        const conversation = await prisma.conversation.findUnique({
            where: { id },
        });

        if (!conversation || conversation.userId !== userId) {
            return NextResponse.json({ error: 'Not found or Unauthorized' }, { status: 404 });
        }

        await prisma.conversation.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete conversation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
