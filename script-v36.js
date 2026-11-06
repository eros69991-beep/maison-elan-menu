"use strict";

const menuData = window.MENU_DATA || {};
const CART_STORAGE_KEY = "maison-elan-cart-v2";
const APP_VERSION = "3.6.0";
const cloudBridge = window.MAISON_CLOUD || {};
const cloudClient = cloudBridge.client || null;
const CLOUD_MODE = Boolean(cloudBridge.isConfigured && cloudClient);
const ORDER_STORAGE_KEY = "maison-elan-orders-v1";
const ORDER_CHANNEL_NAME = "maison-elan-orders";
const TABLE_CODE = readTableCodeFromURL();
const orderChannel = "BroadcastChannel" in window
  ? new BroadcastChannel(ORDER_CHANNEL_NAME)
  : null;

function loadOrders() {
  try {
    const savedOrders = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY));
    return Array.isArray(savedOrders) ? savedOrders : [];
  } catch (error) {
    console.warn("订单列表读取失败，已使用空列表。", error);
    return [];
  }
}

function saveOrderToDesk(order) {
  const orders = loadOrders();
  const nextOrders = [order, ...orders.filter((item) => item?.orderNumber !== order.orderNumber)]
    .slice(0, 200);

  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(nextOrders));
    orderChannel?.postMessage({ type: "order-created", orderNumber: order.orderNumber });
    return true;
  } catch (error) {
    console.warn("订单无法写入本机订单台。", error);
    return false;
  }
}

function toCloudOrder(order) {
  return {
    order_number: order.orderNumber,
    table_number: order.tableNumber,
    note: order.note,
    status: order.status,
    item_count: order.itemCount,
    items: order.items,
    total: order.total,
    created_at: order.createdAt,
    updated_at: order.updatedAt
  };
}

async function sendOrder(order) {
  // 无论是否启用云端，都保留一份本机备份，方便断网排查。
  const localSaved = saveOrderToDesk(order);

  if (!CLOUD_MODE) {
    return { ok: localSaved, mode: "local" };
  }

  try {
    const { error } = await cloudClient
      .from("orders")
      .insert(toCloudOrder(order));

    if (error) {
      throw error;
    }

    return { ok: true, mode: "cloud" };
  } catch (error) {
    console.error("云端订单提交失败。", error);
    return { ok: false, mode: "cloud", error, localSaved };
  }
}

const cart = loadCart();
const productIndex = buildProductIndex();

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "¥0";
  }

  return `¥${Number.isInteger(number) ? number : number.toFixed(2)}`;
}

function normalizeTableCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\u4E00-\u9FFF_-]/g, "")
    .slice(0, 12);
}

function readTableCodeFromURL() {
  try {
    const params = new URLSearchParams(window.location.search);
    return normalizeTableCode(params.get("table") || params.get("t") || "");
  } catch (error) {
    console.warn("桌号参数读取失败。", error);
    return "";
  }
}

function buildProductIndex() {
  const index = new Map();

  Object.entries(menuData).forEach(([sectionId, items]) => {
    if (!Array.isArray(items)) {
      return;
    }

    items.forEach((item) => {
      if (sectionId === "wines") {
        index.set(`${String(item.id)}::glass`, {
          key: `${String(item.id)}::glass`,
          id: item.id,
          name: `${item.name} · 单杯`,
          englishName: `${item.englishName} · Glass`,
          image: item.image,
          price: Number(item.glassPrice),
          option: "glass"
        });

        index.set(`${String(item.id)}::bottle`, {
          key: `${String(item.id)}::bottle`,
          id: item.id,
          name: `${item.name} · 整瓶`,
          englishName: `${item.englishName} · Bottle`,
          image: item.image,
          price: Number(item.bottlePrice),
          option: "bottle"
        });
        return;
      }

      index.set(String(item.id), {
        key: String(item.id),
        id: item.id,
        name: item.name,
        englishName: item.englishName,
        image: item.image,
        price: Number(item.price),
        option: "dish"
      });
    });
  });

  return index;
}

function loadCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));

    if (!savedCart || typeof savedCart !== "object" || Array.isArray(savedCart)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(savedCart)
        .map(([key, quantity]) => [key, Math.max(0, Math.floor(Number(quantity)))])
        .filter(([, quantity]) => Number.isFinite(quantity) && quantity > 0)
    );
  } catch (error) {
    console.warn("购物车数据读取失败，已使用空购物车。", error);
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    // 某些浏览器或隐私设置会限制本地存储。
    // 即使保存失败，也不能影响本次页面里的加购操作。
    console.warn("购物车暂时无法保存，但本次加购仍可正常使用。", error);
  }
}

function getQuantity(key) {
  return Math.max(0, Number(cart[key]) || 0);
}

function setQuantity(key, quantity) {
  if (!productIndex.has(key)) {
    return;
  }

  const safeQuantity = Math.max(0, Math.min(99, Math.floor(Number(quantity) || 0)));

  if (safeQuantity === 0) {
    delete cart[key];
  } else {
    cart[key] = safeQuantity;
  }

  updateCartUI();
  saveCart();
}

function changeQuantity(key, amount) {
  setQuantity(key, getQuantity(key) + amount);
}

function getCartEntries() {
  return Object.entries(cart)
    .map(([key, quantity]) => ({
      product: productIndex.get(key),
      quantity
    }))
    .filter(({ product, quantity }) => product && quantity > 0);
}

function getCartSummary() {
  return getCartEntries().reduce(
    (summary, { product, quantity }) => {
      summary.count += quantity;
      summary.total += product.price * quantity;
      return summary;
    },
    { count: 0, total: 0 }
  );
}

function createQuantityControl(key, light = false) {
  const quantity = getQuantity(key);
  const lightClass = light ? " quantity-control--light" : "";

  if (quantity === 0) {
    return `
      <button class="add-item-button${lightClass}" type="button" data-cart-action="add" data-cart-key="${escapeHTML(key)}">
        <span aria-hidden="true">＋</span>
        加入订单
      </button>
    `;
  }

  return `
    <div class="quantity-control${lightClass}" aria-label="数量控制">
      <button type="button" data-cart-action="decrease" data-cart-key="${escapeHTML(key)}" aria-label="减少数量">−</button>
      <strong>${quantity}</strong>
      <button type="button" data-cart-action="increase" data-cart-key="${escapeHTML(key)}" aria-label="增加数量">＋</button>
    </div>
  `;
}

function createDishCard(item) {
  const cardClass = item.featured
    ? "dish-card dish-card--featured"
    : "dish-card";

  const badgeHTML = item.badge
    ? `<span class="dish-card__badge">${escapeHTML(item.badge)}</span>`
    : "";

  const descriptionHTML = item.description
    ? `<p class="dish-card__description">${escapeHTML(item.description)}</p>`
    : "";

  return `
    <article class="${cardClass}" data-menu-item-id="${escapeHTML(item.id)}">
      <div class="dish-card__image-wrap">
        <img
          class="dish-card__image"
          src="${escapeHTML(item.image)}"
          alt="${escapeHTML(item.name)}"
          loading="lazy"
          decoding="async"
        />
        ${badgeHTML}
      </div>

      <div class="dish-card__body">
        <div class="dish-card__heading">
          <div>
            <h3>${escapeHTML(item.name)}</h3>
            <p>${escapeHTML(item.englishName)}</p>
          </div>

          <strong>${formatPrice(item.price)}</strong>
        </div>

        ${descriptionHTML}
        <div class="dish-card__action" data-quantity-slot="${escapeHTML(item.id)}">
          ${createQuantityControl(item.id)}
        </div>
      </div>
    </article>
  `;
}

function createWineOption(item, option) {
  const isGlass = option === "glass";
  const key = `${item.id}::${option}`;
  const label = isGlass ? "单杯" : "整瓶";
  const price = isGlass ? item.glassPrice : item.bottlePrice;

  return `
    <div class="wine-option">
      <div>
        <span>${label}</span>
        <strong>${formatPrice(price)}</strong>
      </div>
      <div data-quantity-slot="${escapeHTML(key)}">
        ${createQuantityControl(key, true)}
      </div>
    </div>
  `;
}

function createWineCard(item) {
  return `
    <article class="wine-card" data-menu-item-id="${escapeHTML(item.id)}">
      <div class="wine-card__image-wrap">
        <img
          class="wine-card__image"
          src="${escapeHTML(item.image)}"
          alt="${escapeHTML(item.name)}"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div class="wine-card__body">
        <p class="wine-card__region">${escapeHTML(item.region)}</p>
        <h3>${escapeHTML(item.name)}</h3>
        <p class="wine-card__english">${escapeHTML(item.englishName)}</p>
        <div class="wine-card__options">
          ${createWineOption(item, "glass")}
          ${createWineOption(item, "bottle")}
        </div>
      </div>
    </article>
  `;
}

function renderDishSection(sectionId, containerSelector) {
  const section = document.getElementById(sectionId);
  const container = section?.querySelector(containerSelector);
  const items = menuData[sectionId];

  if (!container) {
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = '<p class="menu-empty">该分类暂时没有菜品。</p>';
    return;
  }

  container.innerHTML = items.map(createDishCard).join("");
}

function renderWineSection() {
  const section = document.getElementById("wines");
  const container = section?.querySelector(".wine-grid");
  const items = menuData.wines;

  if (!container) {
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = '<p class="menu-empty">暂时没有葡萄酒。</p>';
    return;
  }

  container.innerHTML = items.map(createWineCard).join("");
}

function renderMenu() {
  renderDishSection("recommendations", ".featured-grid");
  renderDishSection("appetizers", ".dish-grid");
  renderDishSection("soups", ".dish-grid");
  renderDishSection("mains", ".dish-grid");
  renderDishSection("desserts", ".dish-grid");
  renderDishSection("drinks", ".dish-grid");
  renderWineSection();
}

renderMenu();

const scrollButtons = document.querySelectorAll("[data-scroll-target]");
const menuButtons = document.querySelectorAll("[data-menu-target]");
const menuSections = document.querySelectorAll("[data-menu-section]");
const revealSections = document.querySelectorAll(".reveal-section");
const menuNav = document.querySelector(".menu-nav");
const cartBar = document.getElementById("cartBar");
const openCartButton = document.getElementById("openCartButton");
const closeCartButton = document.getElementById("closeCartButton");
const continueBrowsingButton = document.getElementById("continueBrowsingButton");
const cartOverlay = document.getElementById("cartOverlay");
const cartDrawer = document.getElementById("cartDrawer");
const cartItems = document.getElementById("cartItems");
const cartEmpty = document.getElementById("cartEmpty");
const orderFields = document.getElementById("orderFields");
const cartFooter = document.getElementById("cartFooter");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const drawerCartCount = document.getElementById("drawerCartCount");
const drawerCartTotal = document.getElementById("drawerCartTotal");
const submitOrderButton = document.getElementById("submitOrderButton");
const heroTableChip = document.getElementById("heroTableChip");
const heroTableNumber = document.getElementById("heroTableNumber");
const boundTable = document.getElementById("boundTable");
const boundTableNumber = document.getElementById("boundTableNumber");
const tableBindingHint = document.getElementById("tableBindingHint");
const orderDemoNotice = document.getElementById("orderDemoNotice");
const orderNoteInput = document.getElementById("orderNote");
const orderSuccess = document.getElementById("orderSuccess");
const successOrderNumber = document.getElementById("successOrderNumber");
const successOrderDetail = document.getElementById("successOrderDetail");
const finishOrderButton = document.getElementById("finishOrderButton");

function updateTableBindingUI() {
  const hasTable = Boolean(TABLE_CODE);

  if (heroTableChip) heroTableChip.hidden = !hasTable;
  if (heroTableNumber) heroTableNumber.textContent = TABLE_CODE || "--";
  if (boundTableNumber) boundTableNumber.textContent = TABLE_CODE || "未识别";

  if (boundTable) {
    boundTable.classList.toggle("is-missing", !hasTable);
  }

  if (tableBindingHint) {
    tableBindingHint.textContent = hasTable
      ? "桌号已由二维码自动识别，客人无法手动修改。"
      : "未识别桌号，请扫描桌面二维码重新进入菜单。";
  }

  if (orderDemoNotice) {
    if (!hasTable) {
      orderDemoNotice.textContent = "未绑定桌号时可以浏览和加购，但不能确认下单。";
    } else if (CLOUD_MODE) {
      orderDemoNotice.textContent = "订单将实时发送到云端商家订单台，请确认网络连接正常。";
    } else {
      orderDemoNotice.textContent = "当前为本机演示模式；填写 Supabase 配置后可实现不同设备实时接单。";
    }
  }

  if (hasTable) {
    document.title = `${TABLE_CODE}桌 · MAISON ÉLAN`;
  }
}

function getMenuNavHeight() {
  if (!menuNav) {
    return 0;
  }

  return menuNav.getBoundingClientRect().height;
}

function scrollToElement(element, useMenuOffset = false) {
  if (!element) {
    return;
  }

  const offset = useMenuOffset ? getMenuNavHeight() + 14 : 0;
  const targetTop = element.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({
    top: targetTop,
    behavior: "smooth"
  });
}

scrollButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.scrollTarget;
    const targetElement = document.getElementById(targetId);
    scrollToElement(targetElement, targetId !== "top");
  });
});

menuButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.menuTarget;
    const targetSection = document.getElementById(targetId);
    scrollToElement(targetSection, true);
  });
});

function setActiveMenuButton(sectionId) {
  menuButtons.forEach((button) => {
    const isActive = button.dataset.menuTarget === sectionId;
    button.classList.toggle("is-active", isActive);

    if (isActive) {
      button.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    }
  });
}

if ("IntersectionObserver" in window) {
  const menuSectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort(
          (firstEntry, secondEntry) =>
            secondEntry.intersectionRatio - firstEntry.intersectionRatio
        );

      if (visibleEntries.length === 0) {
        return;
      }

      const activeSection = visibleEntries[0].target.dataset.menuSection;
      setActiveMenuButton(activeSection);
    },
    {
      root: null,
      rootMargin: "-20% 0px -60% 0px",
      threshold: [0.05, 0.2, 0.5]
    }
  );

  menuSections.forEach((section) => {
    menuSectionObserver.observe(section);
  });

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.08,
      rootMargin: "0px 0px -50px 0px"
    }
  );

  revealSections.forEach((section) => {
    revealObserver.observe(section);
  });
} else {
  revealSections.forEach((section) => {
    section.classList.add("is-visible");
  });
}

function installImageFallbacks() {
  document
    .querySelectorAll(".dish-card__image, .wine-card__image")
    .forEach((image) => {
      const imageWrapper = image.parentElement;

      if (!imageWrapper) {
        return;
      }

      imageWrapper.dataset.fallback = image.alt || "图片暂未加载";

      image.addEventListener("error", () => {
        image.style.display = "none";
        imageWrapper.classList.add("image-missing");
      });
    });
}

function renderCartItems() {
  const entries = getCartEntries();

  if (!cartItems) {
    return;
  }

  cartItems.innerHTML = entries
    .map(({ product, quantity }) => `
      <article class="cart-item">
        <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async" />
        <div class="cart-item__main">
          <div class="cart-item__heading">
            <div>
              <h3>${escapeHTML(product.name)}</h3>
              <p>${escapeHTML(product.englishName)}</p>
            </div>
            <strong>${formatPrice(product.price * quantity)}</strong>
          </div>
          <div class="cart-item__bottom">
            <span>${formatPrice(product.price)} / 份</span>
            <div class="quantity-control quantity-control--compact">
              <button type="button" data-cart-action="decrease" data-cart-key="${escapeHTML(product.key)}" aria-label="减少数量">−</button>
              <strong>${quantity}</strong>
              <button type="button" data-cart-action="increase" data-cart-key="${escapeHTML(product.key)}" aria-label="增加数量">＋</button>
            </div>
          </div>
        </div>
        <button class="cart-item__remove" type="button" data-cart-action="remove" data-cart-key="${escapeHTML(product.key)}" aria-label="移除${escapeHTML(product.name)}">×</button>
      </article>
    `)
    .join("");
}

function updateQuantitySlots() {
  document.querySelectorAll("[data-quantity-slot]").forEach((slot) => {
    const key = slot.dataset.quantitySlot;
    const light = Boolean(slot.closest(".wine-card"));
    slot.innerHTML = createQuantityControl(key, light);
  });
}

function updateCartUI() {
  const { count, total } = getCartSummary();
  const hasItems = count > 0;

  updateQuantitySlots();
  renderCartItems();

  if (cartCount) cartCount.textContent = String(count);
  if (cartTotal) cartTotal.textContent = formatPrice(total);
  if (drawerCartCount) drawerCartCount.textContent = String(count);
  if (drawerCartTotal) drawerCartTotal.textContent = formatPrice(total);

  if (cartBar) {
    cartBar.classList.toggle("is-visible", hasItems);
    cartBar.setAttribute("aria-hidden", String(!hasItems));
  }

  document.body.classList.toggle("has-cart", hasItems);

  if (cartEmpty) cartEmpty.hidden = hasItems;
  if (cartItems) cartItems.hidden = !hasItems;
  if (orderFields) orderFields.hidden = !hasItems;
  if (cartFooter) cartFooter.hidden = !hasItems;
  if (submitOrderButton) {
    submitOrderButton.disabled = !hasItems || !TABLE_CODE;
    submitOrderButton.textContent = TABLE_CODE ? "确认下单" : "请扫描桌上二维码";
  }

  // 每次更新数量控件或订单列表后，重新绑定新生成的按钮。
  bindCartButtons();
}

function handleCartButtonClick(event) {
  event.preventDefault();
  event.stopPropagation();

  const button = event.currentTarget;
  const key = String(button?.dataset?.cartKey || "");
  const action = String(button?.dataset?.cartAction || "");

  if (!key || !productIndex.has(key)) {
    console.warn("未找到对应菜品，无法加购：", key);
    return;
  }

  if (action === "add" || action === "increase") {
    changeQuantity(key, 1);
  } else if (action === "decrease") {
    changeQuantity(key, -1);
  } else if (action === "remove") {
    setQuantity(key, 0);
  }
}

function bindCartButtons() {
  document.querySelectorAll("[data-cart-action]").forEach((button) => {
    if (button.dataset.cartBound === "true") {
      return;
    }

    button.dataset.cartBound = "true";
    button.addEventListener("click", handleCartButtonClick, { passive: false });
  });
}

function openCart() {
  if (!cartDrawer || !cartOverlay) {
    return;
  }

  cartOverlay.hidden = false;
  requestAnimationFrame(() => {
    cartOverlay.classList.add("is-visible");
    cartDrawer.classList.add("is-open");
  });

  cartDrawer.setAttribute("aria-hidden", "false");
  openCartButton?.setAttribute("aria-expanded", "true");
  document.body.classList.add("cart-open");
  closeCartButton?.focus();
}

function closeCart() {
  if (!cartDrawer || !cartOverlay) {
    return;
  }

  cartOverlay.classList.remove("is-visible");
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  openCartButton?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("cart-open");

  window.setTimeout(() => {
    if (!cartOverlay.classList.contains("is-visible")) {
      cartOverlay.hidden = true;
    }
  }, 280);
}

function createOrderNumber() {
  const now = new Date();
  const datePart = [
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const randomPart = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `ME${datePart}${randomPart}`;
}

async function submitOrder() {
  const entries = getCartEntries();
  const summary = getCartSummary();

  if (entries.length === 0 || summary.count === 0) {
    return;
  }

  if (!TABLE_CODE) {
    boundTable?.classList.remove("is-alert");
    requestAnimationFrame(() => boundTable?.classList.add("is-alert"));
    window.setTimeout(() => boundTable?.classList.remove("is-alert"), 650);
    return;
  }

  const orderNumber = createOrderNumber();
  const tableNumber = TABLE_CODE;
  const note = orderNoteInput?.value.trim() || "无备注";
  const now = new Date().toISOString();
  const order = {
    orderNumber,
    tableNumber,
    note,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    itemCount: summary.count,
    items: entries.map(({ product, quantity }) => ({
      key: product.key,
      name: product.name,
      englishName: product.englishName,
      price: product.price,
      quantity,
      subtotal: product.price * quantity
    })),
    total: summary.total
  };

  const originalButtonText = submitOrderButton?.textContent || "确认下单";
  if (submitOrderButton) {
    submitOrderButton.disabled = true;
    submitOrderButton.textContent = CLOUD_MODE ? "正在发送到餐厅…" : "正在提交…";
  }

  const result = await sendOrder(order);

  if (!result.ok && result.mode === "cloud") {
    if (submitOrderButton) {
      submitOrderButton.disabled = false;
      submitOrderButton.textContent = originalButtonText;
    }

    window.alert("订单暂时无法发送到餐厅，请检查网络后重试，或直接联系服务员。购物车内容仍然保留。");
    return;
  }

  if (successOrderNumber) successOrderNumber.textContent = orderNumber;
  if (successOrderDetail) {
    successOrderDetail.textContent = result.mode === "cloud"
      ? `${tableNumber} · ${summary.count} 件 · ${formatPrice(summary.total)} · 已实时发送到餐厅`
      : `${tableNumber} · ${summary.count} 件 · ${formatPrice(summary.total)} · 已进入本机演示订单台`;
  }

  if (submitOrderButton) {
    submitOrderButton.textContent = originalButtonText;
  }

  closeCart();
  if (orderSuccess) {
    orderSuccess.hidden = false;
    requestAnimationFrame(() => orderSuccess.classList.add("is-visible"));
  }
}

function finishOrder() {
  Object.keys(cart).forEach((key) => delete cart[key]);
  saveCart();

  if (orderNoteInput) orderNoteInput.value = "";

  orderSuccess?.classList.remove("is-visible");
  window.setTimeout(() => {
    if (orderSuccess) orderSuccess.hidden = true;
  }, 260);

  updateCartUI();
}

openCartButton?.addEventListener("click", openCart);
closeCartButton?.addEventListener("click", closeCart);
continueBrowsingButton?.addEventListener("click", closeCart);
cartOverlay?.addEventListener("click", closeCart);
submitOrderButton?.addEventListener("click", submitOrder);
finishOrderButton?.addEventListener("click", finishOrder);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (orderSuccess && !orderSuccess.hidden) {
      finishOrder();
      return;
    }

    closeCart();
  }
});

installImageFallbacks();
updateTableBindingUI();
updateCartUI();

document.documentElement.dataset.cartReady = "true";
window.MAISON_CART = {
  version: APP_VERSION,
  table: TABLE_CODE || null,
  add(key) {
    changeQuantity(String(key), 1);
  },
  getCart() {
    return { ...cart };
  }
};
console.info(`MAISON ÉLAN 购物车已启动，版本 ${APP_VERSION}，模式：${CLOUD_MODE ? "Supabase 云端" : "本机演示"}`);

window.addEventListener("load", () => {
  revealSections.forEach((section) => {
    const sectionTop = section.getBoundingClientRect().top;

    if (sectionTop < window.innerHeight * 1.08) {
      section.classList.add("is-visible");
    }
  });
});
