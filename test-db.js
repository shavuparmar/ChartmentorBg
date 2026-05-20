

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
    try {
        const users = await prisma.user.findMany();
        console.log("DB Connected ✔", users);
    } catch (err) {
        console.log("DB Error ❌", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

test();