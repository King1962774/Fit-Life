/* ============================================================
   Market: capa de datos (antes vivía embebida en el `data` de
   localStorage; ahora son tablas reales y compartidas en Supabase:
   `products` y `market_requests`. Así el catálogo y las solicitudes
   son de verdad los mismos para todas las personas y el admin, en vez
   de una copia distinta por navegador.
   ============================================================ */
import { supabase } from "./supabaseClient.js";
import { state } from "./state.js";
import { PRODUCT_STATUS, REQUEST_STATUS, LOW_STOCK_THRESHOLD } from "./constants.js";

export const AVAILABILITY = {
  AVAILABLE: "disponible",
  LOW_STOCK: "pocas_unidades",
  RESERVED: "apartado",
  OUT_OF_STOCK: "sin_stock",
};

/* Caché local en memoria: las vistas leen estas listas de forma
   síncrona (igual que antes), y loadMarketData()/las mutaciones de
   abajo la mantienen sincronizada con la base de datos. */
let products = [];
let requests = [];

export function getAllProducts() { return products; }
export function productById(id) { return products.find((p) => p.id === id); }
export function getAllRequests() { return requests; }
/* El admin ve todas las solicitudes; una persona normal solo ve las
   propias sin importar qué userId le pasen (ya no existen invitados:
   hace falta sesión real para llegar aquí). */
export function requestsByUser() { return requests.filter((r) => r.userId === state.userId); }

function pendingQtyFor(productId) {
  return requests
    .filter((r) => r.productId === productId && r.status === REQUEST_STATUS.PENDING)
    .reduce((sum, r) => sum + r.quantity, 0);
}

export function getAvailableStock(p) {
  return Math.max(0, p.stock - pendingQtyFor(p.id));
}

export function getAvailability(p) {
  const available = getAvailableStock(p);
  if (available === 0) return p.stock > 0 ? AVAILABILITY.RESERVED : AVAILABILITY.OUT_OF_STOCK;
  if (available <= LOW_STOCK_THRESHOLD) return AVAILABILITY.LOW_STOCK;
  return AVAILABILITY.AVAILABLE;
}

function mapProductRow(r) {
  return {
    id: r.id, name: r.name, brand: r.brand || "", description: r.description || "",
    price: Number(r.price), stock: r.stock, image: r.image || "", status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapRequestRow(r) {
  return {
    id: r.id, userId: r.user_id, userEmail: r.user_email, productId: r.product_id,
    quantity: r.quantity, type: r.type, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/* Trae del servidor el catálogo y las solicitudes que le corresponden
   ver a la persona actual (RLS ya filtra: admin ve todas, el resto
   solo las suyas). Se llama al iniciar sesión y al entrar a la
   pestaña Market. */
export async function loadMarketData() {
  const { data: prodRows, error: pErr } = await supabase
    .from("products").select("*").order("created_at", { ascending: true });
  if (pErr) { console.error(pErr.message); } else { products = prodRows.map(mapProductRow); }

  const { data: reqRows, error: rErr } = await supabase
    .from("market_requests").select("*").order("created_at", { ascending: false });
  if (rErr) { console.error(rErr.message); } else { requests = reqRows.map(mapRequestRow); }
}

/* ---------------- mutaciones de admin sobre productos ----------------
   Actualizan la caché local al instante (para que la UI, que sigue
   siendo síncrona, se sienta igual de rápida) y en paralelo escriben
   en Supabase. Si la escritura falla, se revierte la caché. */
export function addProduct({ name, brand, description, price, stock, image }) {
  const now = new Date().toISOString();
  const optimistic = {
    id: `tmp-${Date.now()}`, name, brand, description, price, stock, image: image || "",
    status: PRODUCT_STATUS.ACTIVE, createdAt: now, updatedAt: now,
  };
  products = [optimistic, ...products];
  supabase.from("products")
    .insert({ name, brand, description, price, stock, image, status: PRODUCT_STATUS.ACTIVE })
    .select().single()
    .then(({ data, error }) => {
      if (error) { console.error(error.message); products = products.filter((p) => p.id !== optimistic.id); return; }
      products = products.map((p) => (p.id === optimistic.id ? mapProductRow(data) : p));
    });
  return optimistic;
}

export function updateProduct(id, patch) {
  const prev = productById(id);
  if (!prev) return;
  products = products.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
  supabase.from("products").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id)
    .then(({ error }) => {
      if (error) { console.error(error.message); products = products.map((p) => (p.id === id ? prev : p)); }
    });
}

export function deleteProduct(id) {
  const prev = products;
  products = products.filter((p) => p.id !== id);
  supabase.from("products").delete().eq("id", id).then(({ error }) => {
    if (error) { console.error(error.message); products = prev; }
  });
}

/* ---------------- solicitudes de compra/apartado ---------------- */
export function createRequest({ productId, quantity, type }) {
  const product = productById(productId);
  if (!product) return { ok: false, error: "Producto no encontrado" };
  if (quantity <= 0) return { ok: false, error: "Ingresa una cantidad válida" };
  if (quantity > getAvailableStock(product)) return { ok: false, error: "No hay suficientes unidades disponibles" };

  const now = new Date().toISOString();
  const optimistic = {
    id: `tmp-${Date.now()}`, userId: state.userId, userEmail: state.userEmail,
    productId, quantity, type, status: REQUEST_STATUS.PENDING, createdAt: now, updatedAt: now,
  };
  requests = [optimistic, ...requests];
  supabase.from("market_requests")
    .insert({
      user_id: state.userId, user_email: state.userEmail, product_id: productId,
      quantity, type, status: REQUEST_STATUS.PENDING,
    })
    .select().single()
    .then(({ data, error }) => {
      if (error) { console.error(error.message); requests = requests.filter((r) => r.id !== optimistic.id); return; }
      requests = requests.map((r) => (r.id === optimistic.id ? mapRequestRow(data) : r));
    });
  return { ok: true };
}

export function updateRequestStatus(id, status) {
  const prev = requests;
  requests = requests.map((r) => (r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r));
  supabase.from("market_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id)
    .then(({ error }) => {
      if (error) { console.error(error.message); requests = prev; }
    });
  return { ok: true };
}
