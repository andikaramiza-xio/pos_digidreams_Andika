import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.promo.deleteMany();

  const id: Record<string, number> = {};
  for (const name of ["Coffee", "Non-Coffee", "Food", "Coworking Space"]) {
    id[name] = (await prisma.category.create({ data: { name } })).id;
  }

  await prisma.product.createMany({
    data: [
      { name: "Americano", price: 20000, stock: 50, categoryId: id["Coffee"] },
      { name: "Cafe Latte", price: 25000, stock: 50, categoryId: id["Coffee"] },
      { name: "Matcha Latte", price: 28000, stock: 40, categoryId: id["Non-Coffee"] },
      { name: "Lemon Tea", price: 18000, stock: 40, categoryId: id["Non-Coffee"] },
      { name: "Nasi Goreng", price: 30000, stock: 30, categoryId: id["Food"] },
      { name: "Croissant", price: 22000, stock: 30, categoryId: id["Food"] },
      { name: "Day Pass", price: 50000, stock: 20, categoryId: id["Coworking Space"] },
      { name: "Meeting Room 1 Jam", price: 100000, stock: 10, categoryId: id["Coworking Space"] },
    ],
  });

  await prisma.promo.create({
    data: { code: "DIGIZEN10", type: "PERCENT", value: 10, minOrder: 50000 },
  });
}

main().finally(() => prisma.$disconnect());