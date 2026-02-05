import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
            },
        });

        await createSession(user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Registration failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
