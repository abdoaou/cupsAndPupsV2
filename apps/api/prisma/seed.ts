import { PrismaClient, UserRole, PetSpecies, ProductCategory, MenuCategory, AppointmentStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

type RailwayMenuItem = {
  name: string;
  description?: string | null;
  category: MenuCategory;
  price: number;
  isPetFriendly?: boolean;
  sortOrder?: number;
};
async function main() {
  const passwordHash = await argon2.hash('Password123!');

  const location = await prisma.location.upsert({
    where: { slug: 'main' },
    update: {},
    create: {
      name: 'Cups & Pups Main',
      slug: 'main',
      address: '123 Paw Street',
      city: 'Neighborhood',
      phone: '+1-555-0100',
      email: 'hello@cupsandpups.local',
      timezone: 'America/New_York',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'owner@cupsandpups.local' },
    update: {},
    create: {
      email: 'owner@cupsandpups.local',
      passwordHash,
      firstName: 'Ava',
      lastName: 'Owner',
      role: UserRole.ADMIN,
      phone: '+15550101',
    },
  });

  await prisma.staffMember.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      locationId: location.id,
      title: 'Owner / Manager',
      colorHex: '#6B4F3A',
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash,
      firstName: 'Sam',
      lastName: 'Customer',
      role: UserRole.CUSTOMER,
      phone: '+15550102',
      loyaltyAccount: { create: { pointsBalance: 120, lifetimePoints: 120 } },
    },
  });

  await prisma.pet.upsert({
    where: { id: 'seed-pet-buddy' },
    update: {},
    create: {
      id: 'seed-pet-buddy',
      ownerId: customer.id,
      name: 'Buddy',
      species: PetSpecies.DOG,
      breed: 'Golden Retriever',
      weightKg: 28,
      sizeCategory: 'large',
      temperamentNotes: 'Friendly, loves belly rubs',
      allergies: 'Chicken',
      vaccinationStatus: 'Up to date',
    },
  });

  const services = [
    {
      name: 'Bath & Brush',
      description: 'Gentle bath, blow-dry, and brush-out',
      basePrice: 45,
      durationMinutes: 60,
      bufferMinutes: 15,
    },
    {
      name: 'Full Groom',
      description: 'Bath, haircut, nails, ears, and finish',
      basePrice: 75,
      durationMinutes: 90,
      bufferMinutes: 20,
    },
    {
      name: 'Nail Trim',
      description: 'Quick nail trim and file',
      basePrice: 20,
      durationMinutes: 20,
      bufferMinutes: 10,
    },
  ];

  for (const [index, service] of services.entries()) {
    const existing = await prisma.service.findFirst({
      where: { locationId: location.id, name: service.name },
    });
    if (!existing) {
      await prisma.service.create({
        data: {
          locationId: location.id,
          ...service,
          sizeModifiers: { small: 0, medium: 10, large: 20, xl: 35 },
          sortOrder: index,
        },
      });
    }
  }

  const products = [
    {
      name: 'Grain-Free Salmon Kibble',
      slug: 'grain-free-salmon-kibble',
      category: ProductCategory.FOOD,
      brand: 'PawPure',
      petType: 'dog',
      sku: 'FOOD-001',
      price: 28.99,
      stockQty: 24,
      variants: [
        { name: 'Small (2kg)', sku: 'FOOD-001-S', price: 28.99, stockQty: 14 },
        { name: 'Large (5kg)', sku: 'FOOD-001-L', price: 48.99, stockQty: 10 },
      ],
    },
    {
      name: 'Squeaky Bone Toy',
      slug: 'squeaky-bone-toy',
      category: ProductCategory.TOYS,
      brand: 'PlayPaws',
      petType: 'dog',
      sku: 'TOY-001',
      price: 9.5,
      stockQty: 40,
      variants: [
        { name: 'Small', sku: 'TOY-001-S', price: 9.5, stockQty: 22 },
        { name: 'Large', sku: 'TOY-001-L', price: 12.5, stockQty: 18 },
      ],
    },
    {
      name: 'Catnip Mouse Duo',
      slug: 'catnip-mouse-duo',
      category: ProductCategory.TOYS,
      brand: 'WhiskerJoy',
      petType: 'cat',
      sku: 'TOY-002',
      price: 8.99,
      stockQty: 3,
      lowStockThreshold: 5,
      variants: [
        { name: 'Single pack', sku: 'TOY-002-S', price: 8.99, stockQty: 2 },
        { name: 'Twin pack', sku: 'TOY-002-T', price: 14.99, stockQty: 1 },
      ],
    },
  ];

  for (const product of products) {
    const { variants, ...productData } = product;
    const saved = await prisma.product.upsert({
      where: { locationId_slug: { locationId: location.id, slug: product.slug } },
      update: {
        stockQty: product.stockQty,
        lowStockThreshold: product.lowStockThreshold ?? 5,
        price: product.price,
      },
      create: { locationId: location.id, ...productData },
    });

    for (const variant of variants) {
      const existingVariant = await prisma.productVariant.findFirst({
        where: {
          productId: saved.id,
          OR: [{ sku: variant.sku }, { name: variant.name }],
        },
      });
      if (existingVariant) {
        await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            name: variant.name,
            sku: variant.sku,
            price: variant.price,
            stockQty: variant.stockQty,
            isActive: true,
          },
        });
      } else {
        await prisma.productVariant.create({
          data: {
            productId: saved.id,
            name: variant.name,
            sku: variant.sku,
            price: variant.price,
            stockQty: variant.stockQty,
            isActive: true,
          },
        });
      }
    }
  }

  const menu = [
    {
      name: 'House Latte',
      category: MenuCategory.COFFEE,
      price: 4.75,
      description: 'Espresso with steamed milk',
    },
    {
      name: 'Puppuccino',
      category: MenuCategory.PET_TREATS,
      price: 2.5,
      description: 'Whipped cream treat for dogs',
      isPetFriendly: true,
    },
    {
      name: 'Avocado Toast',
      category: MenuCategory.FOOD,
      price: 9.5,
      description: 'Sourdough, avocado, chili flakes',
    },
  ];

  // Prefer the live Railway coffee menu export when present
  const railwayMenuPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'scripts',
    'railway-menu.json',
  );
  let menuItems: RailwayMenuItem[] = menu;
  if (fs.existsSync(railwayMenuPath)) {
    menuItems = JSON.parse(
      fs.readFileSync(railwayMenuPath, 'utf8').replace(/^\uFEFF/, ''),
    ) as RailwayMenuItem[];
  }

  // Replace seeded café items with the imported menu (keeps admin CRUD clean)
  await prisma.menuItem.deleteMany({ where: { locationId: location.id } });
  for (const [index, item] of menuItems.entries()) {
    await prisma.menuItem.create({
      data: {
        locationId: location.id,
        name: item.name,
        description: item.description || undefined,
        category: item.category,
        price: item.price,
        isPetFriendly: item.isPetFriendly ?? false,
        isAvailable: true,
        sortOrder: item.sortOrder ?? index,
      },
    });
  }

  await prisma.register.upsert({
    where: { id: 'seed-register-1' },
    update: {},
    create: {
      id: 'seed-register-1',
      locationId: location.id,
      name: 'Front Counter',
    },
  });

  await prisma.siteContent.upsert({
    where: {
      locationId_key: { locationId: location.id, key: 'homepage_hero' },
    },
    update: {},
    create: {
      locationId: location.id,
      key: 'homepage_hero',
      title: 'Coffee for you. Care for them.',
      body: 'Grooming, café, and pet shop — under one roof.',
    },
  });

  const staff = await prisma.staffMember.findUnique({ where: { userId: admin.id } });
  const serviceList = await prisma.service.findMany({
    where: { locationId: location.id },
    orderBy: { sortOrder: 'asc' },
  });
  const bath = serviceList.find((s) => s.name === 'Bath & Brush') ?? serviceList[0];
  const full = serviceList.find((s) => s.name === 'Full Groom') ?? serviceList[0];

  if (staff && bath && full) {
    const slots = [
      { id: 'seed-appt-1', hoursFromNow: 2, service: bath, status: AppointmentStatus.CONFIRMED, price: 45 },
      { id: 'seed-appt-2', hoursFromNow: 5, service: full, status: AppointmentStatus.PENDING, price: 75 },
      { id: 'seed-appt-3', hoursFromNow: 28, service: bath, status: AppointmentStatus.CONFIRMED, price: 45 },
    ];

    for (const slot of slots) {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + slot.hoursFromNow);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + slot.service.durationMinutes);

      await prisma.appointment.upsert({
        where: { id: slot.id },
        update: {
          startTime: start,
          endTime: end,
          status: slot.status,
          priceCharged: slot.price,
        },
        create: {
          id: slot.id,
          locationId: location.id,
          customerId: customer.id,
          petId: 'seed-pet-buddy',
          staffId: staff.id,
          startTime: start,
          endTime: end,
          status: slot.status,
          priceCharged: slot.price,
          notes: 'Seeded demo booking',
          services: {
            create: {
              serviceId: slot.service.id,
              price: slot.price,
              durationMinutes: slot.service.durationMinutes,
            },
          },
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log('  Admin:    owner@cupsandpups.local / Password123!');
  console.log('  Customer: customer@example.com / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
