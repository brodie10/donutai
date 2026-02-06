
const { PrismaClient } = require('@prisma/client');

async function runTest() {
    const prisma = new PrismaClient();
    try {
        const user = await prisma.user.findFirst();
        let userId;
        if (user) {
            userId = user.id;
        } else {
            const newUser = await prisma.user.create({
                data: {
                    username: 'debug_user_' + Date.now(),
                    password: 'hashed_password_placeholder'
                }
            });
            userId = newUser.id;
        }

        console.log('Testing with User ID:', userId);

        // Use global fetch (Node 18+)
        const response = await fetch('http://localhost:3002/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Hello integration test' }]
            })
        });

        console.log('Status:', response.status);

        if (response.ok) {
            const text = await response.text();
            console.log('Response length:', text.length);
            console.log('Response excerpt:', text.substring(0, 100));
        } else {
            const text = await response.text();
            console.log('Error Body:', text);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
