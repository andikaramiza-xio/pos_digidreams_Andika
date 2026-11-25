"use client";

import { useEffect, useState } from "react";
import { checkout, getCategories, getProducts, previewPromo } from "./actions";

type Category = Awaited<ReturnType<typeof getCategories>>[number];
type Product = Awaited<ReturnType<typeof getProducts>>[number];
type Order = Extract<Awaited<ReturnType<typeof checkout>>, { ok: true }>["order"];
type Line = { product: Product; qty: number };

const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function Home() {
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cat, setCat] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoMsg, setPromoMsg] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Order | null>(null);

  useEffect(() => { getCategories().then(setCats); }, []);
  useEffect(() => { getProducts(cat, search).then(setProducts); }, [cat, search]);

  const subtotal = cart.reduce((s, l) => s + l.product.price * l.qty, 0);
  const tax = Math.round((subtotal - discount) * 0.1);
  const total = subtotal - discount + tax;

  useEffect(() => {
    if (!applied) return;
    previewPromo(applied, subtotal).then((r) => {
      setDiscount(r.discount);
      setPromoMsg(r.message);
    });
  }, [applied, subtotal]);

  function add(p: Product) {
    setCart((c) => {
      const f = c.find((l) => l.product.id === p.id);
      if (!f) return [...c, { product: p, qty: 1 }];
      return c.map((l) =>
        l.product.id === p.id ? { ...l, qty: Math.min(l.qty + 1, p.stock) } : l
      );
    });
  }
  function change(id: number, d: number) {
    setCart((c) =>
      c
        .map((l) =>
          l.product.id === id
            ? { ...l, qty: Math.min(l.qty + d, l.product.stock) }
            : l
        )
        .filter((l) => l.qty > 0)
    );
  }
  function remove(id: number) {
    setCart((c) => c.filter((l) => l.product.id !== id));
  }

  async function pay(method: "CASH" | "QRIS") {
    setError("");
    const res = await checkout(
      cart.map((l) => ({ productId: l.product.id, quantity: l.qty })),
      method,
      applied || undefined
    );
    if (!res.ok) return setError(res.error);
    setReceipt(res.order);
    setCart([]); setCode(""); setApplied(""); setDiscount(0); setPromoMsg("");
    getProducts(cat, search).then(setProducts);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari menu..."
            className="mb-3 w-full rounded-lg border bg-white p-2"
          />
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {[{ id: undefined as number | undefined, name: "All" }, ...cats].map((c) => (
              <button
                key={c.name}
                onClick={() => setCat(c.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-1 text-sm ${
                  cat === c.id ? "bg-black text-white" : "bg-white"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="rounded-xl border bg-white p-3">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-gray-500">{rp(p.price)}</p>
                <p className={`text-xs ${p.stock <= 5 ? "text-red-500" : "text-gray-400"}`}>
                  Stok: {p.stock}
                </p>
                <button
                  disabled={p.stock === 0}
                  onClick={() => add(p)}
                  className="mt-2 w-full rounded-lg bg-black py-1 text-sm text-white disabled:opacity-40"
                >
                  + Tambah
                </button>
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">Keranjang</h2>
          {cart.length === 0 && <p className="text-sm text-gray-400">Belum ada item</p>}
          {cart.map((l) => (
            <div key={l.product.id} className="mb-2 flex items-center justify-between text-sm">
              <div>
                <p>{l.product.name}</p>
                <p className="text-gray-500">{rp(l.product.price * l.qty)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => change(l.product.id, -1)} className="rounded border px-2">-</button>
                <span>{l.qty}</span>
                <button onClick={() => change(l.product.id, 1)} className="rounded border px-2">+</button>
                <button onClick={() => remove(l.product.id)} className="text-red-500">🗑</button>
              </div>
            </div>
          ))}

          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Kode promo"
              className="w-full rounded-lg border p-2 text-sm"
            />
            <button
              onClick={() => setApplied(code.trim().toUpperCase())}
              className="rounded-lg border px-3 text-sm"
            >
              Apply
            </button>
          </div>
          {promoMsg && <p className="mt-1 text-xs text-gray-500">{promoMsg}</p>}

          <div className="mt-4 space-y-1 border-t pt-3 text-sm">
            <Row label="Subtotal" value={rp(subtotal)} />
            <Row label="Diskon" value={"- " + rp(discount)} />
            <Row label="PPN 10%" value={rp(tax)} />
            <Row label="Total" value={rp(total)} bold />
          </div>

          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={!cart.length} onClick={() => pay("CASH")}
              className="rounded-lg bg-black py-2 text-sm text-white disabled:opacity-40">
              Bayar Tunai
            </button>
            <button disabled={!cart.length} onClick={() => pay("QRIS")}
              className="rounded-lg bg-black py-2 text-sm text-white disabled:opacity-40">
              Bayar QRIS
            </button>
          </div>
        </aside>
      </div>

      {receipt && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="w-80 rounded bg-white p-5 font-mono text-xs">
            <p className="text-center text-base font-bold">DigiDreams Space</p>
            <p className="text-center">{new Date(receipt.createdAt).toLocaleString("id-ID")}</p>
            <p className="text-center">{receipt.invoiceNumber}</p>
            <hr className="my-2 border-dashed" />
            {receipt.items.map((i) => (
              <div key={i.id} className="mb-1">
                <p>{i.product.name}</p>
                <div className="flex justify-between">
                  <span>{i.quantity} x {i.unitPrice.toLocaleString("id-ID")}</span>
                  <span>{i.subtotal.toLocaleString("id-ID")}</span>
                </div>
              </div>
            ))}
            <hr className="my-2 border-dashed" />
            <Row label="Subtotal" value={rp(receipt.subtotal)} />
            <Row label="Diskon" value={"- " + rp(receipt.discount)} />
            <Row label="PPN 10%" value={rp(receipt.tax)} />
            <Row label="TOTAL" value={rp(receipt.total)} bold />
            <p className="mt-1">Bayar: {receipt.paymentMethod}</p>
            <p className="mt-3 text-center">Terima kasih!</p>
            <button onClick={() => setReceipt(null)}
              className="mt-3 w-full rounded bg-black py-2 text-white">
              Tutup
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}