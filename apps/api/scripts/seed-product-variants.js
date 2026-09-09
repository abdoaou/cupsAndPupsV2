const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const VARIANT_MAP = {
  'grain-free-salmon-kibble': [
    { name: 'Small (2kg)', sku: 'FOOD-001-S', price: 28.99, stockQty: 14 },
    { name: 'Large (5kg)', sku: 'FOOD-001-L', price: 48.99, stockQty: 10 },
  ],
  'squeaky-bone-toy': [
    { name: 'Small', sku: 'TOY-001-S', price: 9.5, stockQty: 22 },
    { name: 'Large', sku: 'TOY-001-L', price: 12.5, stockQty: 18 },
  ],
  'catnip-mouse-duo': [
    { name: 'Single pack', sku: 'TOY-002-S', price: 8.99, stockQty: 2 },
    { name: 'Twin pack', sku: 'TOY-002-T', price: 14.99, stockQty: 1 },
  ],
};

async function upsertVariant(productId, variant) {
  const existing = await prisma.productVariant.findFirst({
    where: {
      productId,
      OR: [{ sku: variant.sku }, { name: variant.name }],
    },
  });

  if (existing) {
    return prisma.productVariant.update({
      where: { id: existing.id },
      data: {
        name: variant.name,
        sku: variant.sku,
        price: variant.price,
        stockQty: variant.stockQty,
        isActive: true,
      },
    });
  }

  return prisma.productVariant.create({
    data: {
      productId,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      stockQty: variant.stockQty,
      isActive: true,
    },
  });
}

async function main() {
  const products = await prisma.product.findMany();
  let created = 0;

  for (const product of products) {
    const variants = VARIANT_MAP[product.slug] || [];
    if (!variants.length) continue;

    for (const variant of variants) {
      await upsertVariant(product.id, variant);
      created += 1;
    }

    const cheapest = Math.min(...variants.map((v) => v.price));
    await prisma.product.update({
      where: { id: product.id },
      data: {
        price: cheapest,
        stockQty: variants.reduce((sum, v) => sum + v.stockQty, 0),
      },
    });
  }

  console.log(`Synced ${created} product variants`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
