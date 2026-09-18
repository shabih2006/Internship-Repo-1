import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding columns to document table...');

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "markdown" TEXT;`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "blocks_json" TEXT;`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "page_dimensions_json" TEXT;`
  );

  console.log('Done. Verifying...');

  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'document' ORDER BY ordinal_position;`
  );
  console.log('Columns in document table:', cols.map((c) => c.column_name));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());