/* ================= MARKET ================= */
import { state } from "../state.js";
import { PRODUCT_STATUS, REQUEST_TYPES, REQUEST_STATUS } from "../constants.js";
import { esc, qs, qsa, fmtDate } from "../utils.js";
import { icon } from "../icons.js";
import {
  getAllProducts, productById, addProduct, updateProduct, deleteProduct,
  getAvailableStock, getAvailability, AVAILABILITY,
  getAllRequests, requestsByUser, createRequest, updateRequestStatus,
} from "../market.js";
import { render } from "../app.js";

/* ---------------- helpers compartidos ---------------- */
function getFilteredProducts() {
  const f = state.ui.market;
  const q = (f.query || "").trim().toLowerCase();
  const min = parseFloat(f.minPrice);
  const max = parseFloat(f.maxPrice);
  return getAllProducts()
    .filter((p) => state.isAdmin || p.status === PRODUCT_STATUS.ACTIVE)
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .filter((p) => !f.brand || p.brand === f.brand)
    .filter((p) => isNaN(min) || p.price >= min)
    .filter((p) => isNaN(max) || p.price <= max);
}

const AVAILABILITY_STYLE = {
  [AVAILABILITY.AVAILABLE]: { color: "var(--green)", bg: "var(--green-bg)", label: "Disponible" },
  [AVAILABILITY.LOW_STOCK]: { color: "var(--gold-dark)", bg: "var(--gold-bg)", label: "Pocas unidades" },
  [AVAILABILITY.RESERVED]: { color: "var(--muted)", bg: "var(--surface-2)", label: "Apartado" },
  [AVAILABILITY.OUT_OF_STOCK]: { color: "var(--rust)", bg: "var(--rust-bg)", label: "Sin stock" },
};
function renderAvailabilityBadge(av) {
  const m = AVAILABILITY_STYLE[av] || AVAILABILITY_STYLE[AVAILABILITY.AVAILABLE];
  return `<span class="availability-badge" style="color:${m.color};background:${m.bg}">${m.label}</span>`;
}

const REQUEST_STATUS_STYLE = {
  [REQUEST_STATUS.PENDING]: { color: "var(--gold-dark)", bg: "var(--gold-bg)", label: "Pendiente" },
  [REQUEST_STATUS.CONFIRMED]: { color: "var(--green)", bg: "var(--green-bg)", label: "Confirmado" },
  [REQUEST_STATUS.REJECTED]: { color: "var(--rust)", bg: "var(--rust-bg)", label: "Rechazado" },
  [REQUEST_STATUS.COMPLETED]: { color: "var(--ink)", bg: "var(--hairline)", label: "Completado" },
};
function renderRequestStatusBadge(status) {
  const m = REQUEST_STATUS_STYLE[status] || REQUEST_STATUS_STYLE[REQUEST_STATUS.PENDING];
  return `<span class="availability-badge" style="color:${m.color};background:${m.bg}">${m.label}</span>`;
}

function renderFilters() {
  const brands = [...new Set(getAllProducts().map((p) => p.brand).filter(Boolean))].sort();
  const f = state.ui.market;
  return `
    <div class="search-row">
      ${icon("search", 14, "var(--muted)")}
      <input id="market-search" class="search-input" placeholder="Buscar por nombre" value="${esc(f.query)}" />
    </div>
    <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
      <select id="market-brand" class="select-input" style="flex:1;min-width:140px">
        <option value="">Todas las marcas</option>
        ${brands.map((b) => `<option value="${esc(b)}" ${f.brand === b ? "selected" : ""}>${esc(b)}</option>`).join("")}
      </select>
      <input id="market-min" type="number" class="small-num-input" style="width:80px" placeholder="mín $" value="${esc(f.minPrice)}" />
      <input id="market-max" type="number" class="small-num-input" style="width:80px" placeholder="máx $" value="${esc(f.maxPrice)}" />
    </div>
  `;
}

/* ---------------- vista de usuario ---------------- */
function renderProductCard(p) {
  const availability = getAvailability(p);
  return `
    <button class="product-card" data-action="open-product" data-id="${p.id}">
      ${p.image
        ? `<img src="${esc(p.image)}" class="product-card-img" alt="${esc(p.name)}" />`
        : `<div class="product-card-img product-card-img-placeholder">${icon("box", 22, "var(--muted-2)")}</div>`}
      <div class="product-card-body">
        <p class="product-card-name">${esc(p.name)}</p>
        <p class="product-card-brand">${esc(p.brand)}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:6px">
          <span class="product-card-price">$${p.price.toLocaleString("es-ES")}</span>
          ${renderAvailabilityBadge(availability)}
        </div>
      </div>
    </button>
  `;
}

function renderMyRequests() {
  const userId = state.userEmail || "invitado";
  const mine = [...requestsByUser(userId)].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!mine.length) return "";
  return `
    <p class="eyebrow" style="margin-top:26px">Mis solicitudes</p>
    ${mine.map((r) => {
      const p = productById(r.productId);
      return `
        <div class="card" style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span style="font-size:14px">${esc(p?.name || "Producto eliminado")} × ${r.quantity}</span>
            ${renderRequestStatusBadge(r.status)}
          </div>
          <p style="color:var(--muted);font-size:12px;margin:6px 0 0">
            ${r.type === REQUEST_TYPES.PURCHASE ? "Compra" : "Apartado"} · ${fmtDate(r.createdAt.slice(0, 10))}
          </p>
        </div>
      `;
    }).join("")}
  `;
}

function renderProductModal() {
  const product = productById(state.ui.market.selectedProductId);
  if (!product) return "";
  const availability = getAvailability(product);
  const available = getAvailableStock(product);
  const err = state.ui.market.requestError;
  return `
    <div class="modal-overlay" data-action="close-product">
      <div class="modal-card" style="max-width:440px" onclick="event.stopPropagation()">
        <div class="modal-head-row">
          <p style="font-family:'Fraunces',serif;font-size:18px;margin:0">${esc(product.name)}</p>
          <button class="icon-btn" data-action="close-product">${icon("x", 16)}</button>
        </div>
        ${product.image
          ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:4px;margin-top:12px" />`
          : ""}
        <p style="color:var(--muted);font-size:12px;margin:12px 0 0">${esc(product.brand)}</p>
        <p style="font-size:14px;margin:6px 0 0;white-space:pre-wrap">${esc(product.description || "Sin descripción.")}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
          <span style="font-family:'Fraunces',serif;font-size:20px">$${product.price.toLocaleString("es-ES")}</span>
          ${renderAvailabilityBadge(availability)}
        </div>
        <p style="color:var(--muted);font-size:12px;margin-top:4px">
          ${available} unidad${available === 1 ? "" : "es"} disponible${available === 1 ? "" : "s"}
        </p>
        ${available > 0 ? `
          <div class="input-row" style="margin-top:14px">
            <input id="request-qty" type="number" min="1" max="${available}" class="small-num-input" value="${state.ui.market.requestQty || 1}" />
            <button class="btn-primary-sm" data-action="request-purchase">${icon("cart", 14)}Comprar</button>
            <button class="btn-ghost-sm" data-action="request-reserve">Apartar</button>
          </div>
        ` : `<p class="error-text" style="margin-top:14px">No hay unidades disponibles en este momento.</p>`}
        ${err ? `<p class="error-text">${esc(err)}</p>` : ""}
      </div>
    </div>
  `;
}

function renderMarketUser() {
  const filtered = getFilteredProducts();
  return `
    <p class="eyebrow">Market</p>
    <h2 class="page-title">Artículos deportivos</h2>
    ${renderFilters()}
    <div class="market-grid" id="market-grid" style="margin-top:16px">
      ${filtered.length
        ? filtered.map(renderProductCard).join("")
        : `<p style="color:var(--muted);font-size:13px">No se encontraron productos con esos filtros.</p>`}
    </div>
    ${renderMyRequests()}
  `;
}

/* ---------------- vista de administrador ---------------- */
function renderAddProductForm() {
  const err = state.ui.market.formError;
  return `
    <div class="card" style="margin-top:10px">
      <div class="input-row"><input id="new-prod-name" class="num-input" placeholder="Nombre del producto" /></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <input id="new-prod-brand" class="num-input" placeholder="Marca" />
        <input id="new-prod-price" type="number" class="num-input" placeholder="Precio" />
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <input id="new-prod-stock" type="number" class="num-input" placeholder="Stock inicial" />
        <input id="new-prod-image" class="num-input" placeholder="URL de imagen (opcional)" />
      </div>
      <textarea id="new-prod-desc" class="textarea-input" style="margin-top:8px" rows="2" placeholder="Descripción"></textarea>
      ${err ? `<p class="error-text">${esc(err)}</p>` : ""}
      <button class="btn-primary-sm" style="margin-top:10px" data-action="save-product">${icon("check", 14)}Guardar producto</button>
    </div>
  `;
}

function renderEditProductForm(p) {
  return `
    <div class="card" style="margin-top:10px">
      <div class="input-row"><input id="edit-prod-name" class="num-input" value="${esc(p.name)}" /></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <input id="edit-prod-brand" class="num-input" value="${esc(p.brand)}" />
        <input id="edit-prod-price" type="number" class="num-input" value="${p.price}" />
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <input id="edit-prod-stock" type="number" class="num-input" value="${p.stock}" />
        <input id="edit-prod-image" class="num-input" value="${esc(p.image || "")}" placeholder="URL de imagen" />
      </div>
      <textarea id="edit-prod-desc" class="textarea-input" style="margin-top:8px" rows="2">${esc(p.description || "")}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-primary-sm" data-action="save-edit-product" data-id="${p.id}">Guardar cambios</button>
        <button class="btn-ghost-sm" data-action="cancel-edit-product">Cancelar</button>
      </div>
    </div>
  `;
}

function renderAdminProductRow(p) {
  if (state.ui.market.editingProductId === p.id) return renderEditProductForm(p);
  const availability = getAvailability(p);
  return `
    <div class="card" style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="display:flex;gap:10px">
          ${p.image
            ? `<img src="${esc(p.image)}" style="width:52px;height:52px;object-fit:cover;border-radius:4px" />`
            : `<div style="width:52px;height:52px;background:var(--surface-2);border-radius:4px;display:flex;align-items:center;justify-content:center">${icon("box", 18, "var(--muted-2)")}</div>`}
          <div>
            <p style="font-family:'Fraunces',serif;font-size:15px;margin:0">${esc(p.name)}</p>
            <p style="color:var(--muted);font-size:12px;margin:2px 0 0">${esc(p.brand)} · $${p.price.toLocaleString("es-ES")} · stock ${p.stock}</p>
          </div>
        </div>
        <span style="display:flex;align-items:center;gap:8px">
          ${renderAvailabilityBadge(availability)}
          <button class="icon-btn" data-action="edit-product" data-id="${p.id}">${icon("edit", 14, "var(--muted)")}</button>
          <button class="icon-btn" data-action="delete-product" data-id="${p.id}">${icon("trash", 14, "var(--rust)")}</button>
        </span>
      </div>
      ${p.status === PRODUCT_STATUS.INACTIVE ? `<p style="color:var(--rust);font-size:12px;margin:8px 0 0">Oculto del Market para usuarios</p>` : ""}
      <button class="btn-link" data-action="toggle-product-status" data-id="${p.id}">
        ${p.status === PRODUCT_STATUS.ACTIVE ? "Ocultar del Market" : "Publicar en Market"}
      </button>
    </div>
  `;
}

function renderAdminProducts() {
  return `
    ${renderFilters()}
    <button class="btn-ghost-sm" style="margin-top:10px" data-action="toggle-add-product">${icon("plus", 14)}Agregar producto</button>
    <div id="add-product-form">${state.ui.market.adding ? renderAddProductForm() : ""}</div>
    <div id="market-admin-list" style="margin-top:16px">
      ${getFilteredProducts().map(renderAdminProductRow).join("")}
    </div>
  `;
}

function renderRequestActions(r) {
  if (r.status === REQUEST_STATUS.PENDING) {
    return `
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-primary-sm" data-action="confirm-request" data-id="${r.id}">${icon("check", 14)}Confirmar</button>
        <button class="btn-ghost-sm" data-action="reject-request" data-id="${r.id}">Rechazar</button>
      </div>
    `;
  }
  if (r.status === REQUEST_STATUS.CONFIRMED) {
    return `<div style="margin-top:10px"><button class="btn-ghost-sm" data-action="complete-request" data-id="${r.id}">Marcar como completado</button></div>`;
  }
  return "";
}

function renderAdminRequests() {
  const sorted = [...getAllRequests()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!sorted.length) {
    return `<p style="color:var(--muted);font-size:13px;margin-top:16px">Aún no hay solicitudes de usuarios.</p>`;
  }
  return `
    <div style="margin-top:16px">
      ${sorted.map((r) => {
        const p = productById(r.productId);
        return `
          <div class="card" style="margin-top:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <p style="font-family:'Fraunces',serif;font-size:15px;margin:0">${esc(p?.name || "Producto eliminado")} × ${r.quantity}</p>
                <p style="color:var(--muted);font-size:12px;margin:2px 0 0">${esc(r.userId)} · ${r.type === REQUEST_TYPES.PURCHASE ? "Compra" : "Apartado"} · ${fmtDate(r.createdAt.slice(0, 10))}</p>
              </div>
              ${renderRequestStatusBadge(r.status)}
            </div>
            ${renderRequestActions(r)}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderMarketAdmin() {
  const tab = state.ui.market.adminTab;
  return `
    <p class="eyebrow">Market</p>
    <h2 class="page-title">Panel de Market</h2>
    <div class="binder-tabs">
      <button class="binder-tab ${tab === "productos" ? "active" : ""}" data-action="market-admin-tab" data-tab="productos">Productos</button>
      <button class="binder-tab ${tab === "solicitudes" ? "active" : ""}" data-action="market-admin-tab" data-tab="solicitudes">Solicitudes</button>
    </div>
    ${tab === "productos" ? renderAdminProducts() : renderAdminRequests()}
  `;
}

/* ---------------- entrada principal ---------------- */
export function renderMarket() {
  return `
    ${state.isAdmin ? renderMarketAdmin() : renderMarketUser()}
    ${state.ui.market.selectedProductId ? renderProductModal() : ""}
  `;
}

/* ---------------- eventos ---------------- */
function refreshMarketList() {
  if (state.isAdmin) {
    const list = qs("#market-admin-list");
    if (list) { list.innerHTML = getFilteredProducts().map(renderAdminProductRow).join(""); bindAdminProductRowEvents(); }
  } else {
    const grid = qs("#market-grid");
    if (grid) {
      const filtered = getFilteredProducts();
      grid.innerHTML = filtered.length
        ? filtered.map(renderProductCard).join("")
        : `<p style="color:var(--muted);font-size:13px">No se encontraron productos con esos filtros.</p>`;
      bindProductCardEvents();
    }
  }
}

function bindFilterEvents() {
  const search = qs("#market-search");
  if (search) search.addEventListener("input", () => { state.ui.market.query = search.value; refreshMarketList(); });
  const brand = qs("#market-brand");
  if (brand) brand.addEventListener("change", () => { state.ui.market.brand = brand.value; refreshMarketList(); });
  const min = qs("#market-min");
  if (min) min.addEventListener("change", () => { state.ui.market.minPrice = min.value; refreshMarketList(); });
  const max = qs("#market-max");
  if (max) max.addEventListener("change", () => { state.ui.market.maxPrice = max.value; refreshMarketList(); });
}

function bindProductCardEvents() {
  qsa('[data-action="open-product"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.market.selectedProductId = b.dataset.id;
    state.ui.market.requestQty = 1;
    state.ui.market.requestError = "";
    render();
  }));
}

function submitRequest(type) {
  const product = productById(state.ui.market.selectedProductId);
  if (!product) return;
  const qtyInput = qs("#request-qty");
  const qty = parseInt(qtyInput?.value, 10);
  if (!qtyInput?.value || isNaN(qty) || qty <= 0) {
    state.ui.market.requestError = "Ingresa una cantidad válida";
    render();
    return;
  }
  const userId = state.userEmail || "invitado";
  const result = createRequest({ userId, productId: product.id, quantity: qty, type });
  if (!result.ok) {
    state.ui.market.requestError = result.error;
    render();
    return;
  }
  state.ui.market.selectedProductId = null;
  state.ui.market.requestError = "";
  render();
}

function bindProductModalEvents() {
  qsa('[data-action="close-product"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.market.selectedProductId = null;
    render();
  }));
  const buyBtn = qs('[data-action="request-purchase"]');
  if (buyBtn) buyBtn.addEventListener("click", () => submitRequest(REQUEST_TYPES.PURCHASE));
  const reserveBtn = qs('[data-action="request-reserve"]');
  if (reserveBtn) reserveBtn.addEventListener("click", () => submitRequest(REQUEST_TYPES.RESERVATION));
}

function bindAdminTabEvents() {
  qsa('[data-action="market-admin-tab"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.market.adminTab = b.dataset.tab;
    render();
  }));
}

function bindAddProductForm() {
  const toggleBtn = qs('[data-action="toggle-add-product"]');
  if (toggleBtn) toggleBtn.addEventListener("click", () => {
    state.ui.market.adding = !state.ui.market.adding;
    state.ui.market.formError = "";
    qs("#add-product-form").innerHTML = state.ui.market.adding ? renderAddProductForm() : "";
    bindSaveProductButton();
  });
  bindSaveProductButton();
}

function bindSaveProductButton() {
  const saveBtn = qs('[data-action="save-product"]');
  if (!saveBtn) return;
  saveBtn.addEventListener("click", () => {
    const name = qs("#new-prod-name").value.trim();
    if (!name) {
      state.ui.market.formError = "Dale un nombre al producto";
      qs("#add-product-form").innerHTML = renderAddProductForm();
      bindSaveProductButton();
      return;
    }
    const price = parseFloat(qs("#new-prod-price").value);
    const stock = parseInt(qs("#new-prod-stock").value, 10);
    if (isNaN(price) || price < 0) {
      state.ui.market.formError = "Ingresa un precio válido";
      qs("#add-product-form").innerHTML = renderAddProductForm();
      bindSaveProductButton();
      return;
    }
    if (isNaN(stock) || stock < 0) {
      state.ui.market.formError = "Ingresa una cantidad de stock válida";
      qs("#add-product-form").innerHTML = renderAddProductForm();
      bindSaveProductButton();
      return;
    }
    addProduct({
      name,
      brand: qs("#new-prod-brand").value.trim(),
      description: qs("#new-prod-desc").value.trim(),
      price,
      stock,
      image: qs("#new-prod-image").value.trim(),
    });
    state.ui.market.adding = false;
    state.ui.market.formError = "";
    render();
  });
}

function bindAdminProductRowEvents() {
  qsa('[data-action="edit-product"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.market.editingProductId = b.dataset.id;
    render();
  }));
  qsa('[data-action="cancel-edit-product"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.market.editingProductId = null;
    render();
  }));
  qsa('[data-action="save-edit-product"]').forEach((b) => b.addEventListener("click", () => {
    const name = qs("#edit-prod-name").value.trim();
    if (!name) return;
    const price = parseFloat(qs("#edit-prod-price").value);
    const stock = parseInt(qs("#edit-prod-stock").value, 10);
    updateProduct(b.dataset.id, {
      name,
      brand: qs("#edit-prod-brand").value.trim(),
      description: qs("#edit-prod-desc").value.trim(),
      price: isNaN(price) ? 0 : price,
      stock: isNaN(stock) ? 0 : stock,
      image: qs("#edit-prod-image").value.trim(),
    });
    state.ui.market.editingProductId = null;
    render();
  }));
  qsa('[data-action="delete-product"]').forEach((b) => b.addEventListener("click", () => {
    if (!confirm("¿Eliminar este producto del Market? Las solicitudes históricas se conservarán.")) return;
    deleteProduct(b.dataset.id);
    render();
  }));
  qsa('[data-action="toggle-product-status"]').forEach((b) => b.addEventListener("click", () => {
    const p = productById(b.dataset.id);
    if (!p) return;
    updateProduct(p.id, { status: p.status === PRODUCT_STATUS.ACTIVE ? PRODUCT_STATUS.INACTIVE : PRODUCT_STATUS.ACTIVE });
    render();
  }));
}

function bindRequestActionEvents() {
  qsa('[data-action="confirm-request"]').forEach((b) => b.addEventListener("click", () => {
    const result = updateRequestStatus(b.dataset.id, REQUEST_STATUS.CONFIRMED);
    if (!result.ok) alert(result.error);
    render();
  }));
  qsa('[data-action="reject-request"]').forEach((b) => b.addEventListener("click", () => {
    updateRequestStatus(b.dataset.id, REQUEST_STATUS.REJECTED);
    render();
  }));
  qsa('[data-action="complete-request"]').forEach((b) => b.addEventListener("click", () => {
    updateRequestStatus(b.dataset.id, REQUEST_STATUS.COMPLETED);
    render();
  }));
}

export function bindMarketEvents() {
  bindFilterEvents();
  if (state.isAdmin) {
    bindAdminTabEvents();
    bindAddProductForm();
    bindAdminProductRowEvents();
    bindRequestActionEvents();
  } else {
    bindProductCardEvents();
  }
  bindProductModalEvents();
}
