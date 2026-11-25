"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CartInput = { productId: number; quantity: number };

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { id: "asc" } });
}

export async function getProducts(categoryId?: number, search?: string) {
  return prisma.product.findMany({
    where: {
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { name: { contains: search } } : {}),
    },
    orderBy: { name: "asc" },
  });
}

async function calcDiscount(
  db: Prisma.TransactionClient,
  code: string | undefined,
  subtotal: number
) {
  if (!code) return 0;
  const promo = await db.promo.findUnique({ where: { code } });
  if (!promo || !promo.isActive) throw new Error("Kode promo tidak valid");
  if (promo.expiresAt && promo.expiresAt < new Date())
    throw new Error("Kode promo sudah kedaluwarsa");
  if (subtotal < promo.minOrder)
    throw new Error(`Minimal belanja Rp ${promo.minOrder.toLocaleString("id-ID")}`);
  const raw =
    promo.type === "PERCENT"
      ? Math.round((subtotal * promo.value) / 100)
      : promo.value;
  return Math.min(raw, subtotal);
}

export async function previewPromo(code: string, subtotal: number) {
  try {
    const discount = await calcDiscount(prisma, code.toUpperCase(), subtotal);
    return { discount, message: "Promo berhasil dipakai" };
  } catch (e) {
    return { discount: 0, message: (e as Error).message };
  }
}

export async function checkout(
  cart: CartInput[],
  paymentMethod: "CASH" | "QRIS",
  promoCode?: string
) {
  try {
    if (cart.length === 0) throw new Error("Keranjang kosong");

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: cart.map((c) => c.productId) } },
      });

      const lines = cart.map((c) => {
        const p = products.find((x) => x.id === c.productId);
        if (!p) throw new Error("Produk tidak ditemukan");
        if (c.quantity < 1) throw new Error("Jumlah tidak valid");
        if (p.stock < c.quantity) throw new Error(`Stok ${p.name} tidak cukup`);
        return {
          productId: p.id,
          quantity: c.quantity,
          unitPrice: p.price,
          subtotal: p.price * c.quantity,
        };
      });

      const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
      const discount = await calcDiscount(tx, promoCode?.toUpperCase(), subtotal);
      const tax = Math.round((subtotal - discount) * 0.1);
      const total = subtotal - discount + tax;

      const count = await tx.order.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

      const created = await tx.order.create({
        data: {
          invoiceNumber, subtotal, discount, tax, total,
          paymentMethod, status: "PAID",
          items: { create: lines },
        },
        include: { items: { include: { product: true } } },
      });
      for (const l of lines) {
        await tx.product.update({
          where: { id: l.productId },
          data: { stock: { decrement: l.quantity } },
        });
      }
      return created;
    });

    return { ok: true as const, order };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function getOrderByInvoice(invoiceNumber: string) {
  return prisma.order.findUnique({
    where: { invoiceNumber },
    include: { items: { include: { product: true } } },
  });
}