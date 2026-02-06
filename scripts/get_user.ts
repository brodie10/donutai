
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst();
    if (user) {
        console.log('USER_ID=' + user.id);
    } else {
        // Create one
        const newUser = await prisma.user.create({
            data: {
                username: 'debug_user_' + Date.now(),
                password: 'hashed_password_placeholder'
            }
        });
        console.log('USER_ID=' + newUser.id);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
