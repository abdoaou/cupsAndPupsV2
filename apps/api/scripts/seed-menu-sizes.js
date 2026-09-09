const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Drinks get Small/Large. Base menu price = Small.
// Large is typically +$0.75 for coffee/iced drinks.
const SIZEABLE_CATEGORIES = ['COFFEE', 'BEVERAGES'];
const SKIP_NAMES = new Set(['Espresso', 'Double Espresso']);

async function main() {
  const items = await prisma.menuItem.findMany({
    where: { category: { in: SIZEABLE_CATEGORIES } },
    include: { variants: true },
    orderBy: { name: 'asc' },
  });

  let synced = 0;
  for (const item of items) {
    if (SKIP_NAMES.has(item.name)) continue;

    const base = Number(item.price);
    const sizes = [
      { name: 'Small', price: base, sortOrder: 0 },
      { name: 'Large', price: Number((base + 0.75).toFixed(2)), sortOrder: 1 },
    ];

    for (const size of sizes) {
      const existing = item.variants.find((v) => v.name === size.name);
      if (existing) {
        await prisma.menuItemVariant.update({
          where: { id: existing.id },
          data: {
            price: size.price,
            sortOrder: size.sortOrder,
            isActive: true,
          },
        });
      } else {
        await prisma.menuItemVariant.create({
          data: {
            menuItemId: item.id,
            name: size.name,
            price: size.price,
            sortOrder: size.sortOrder,
            isActive: true,
          },
        });
      }
      synced += 1;
    }
  }

  console.log(`Synced ${synced} café size variants across ${items.length} drinks`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
