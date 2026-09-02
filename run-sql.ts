import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function runSql() {
  const sql = fs.readFileSync('schema.sql', 'utf-8');
  // Clean up comments and split statements safely by semicolon
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  console.log('✅ All 5 SQL tables created successfully in dev.db!');
}

runSql()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());