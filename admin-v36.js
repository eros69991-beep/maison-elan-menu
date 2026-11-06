"use strict";

const APP_VERSION = "3.7.0";
const ORDER_STORAGE_KEY = "maison-elan-orders-v1";
const ORDER_CHANNEL_NAME = "maison-elan-orders";
const cloudBridge = window.MAISON_CLOUD || {};
const cloudClient = cloudBridge.client || null;
const CLOUD_MODE = Boolean(cloudBridge.isConfigured && cloudClient);

const STATUS_META = {
  pending: { label: "待接单", className: "status-pending" },
  preparing: { label: "制作中", className: "status-preparing" },
  ready: { label: "待上菜", className: "status-ready" },
  completed: { label: "已完成", className: "status-completed" },
  cancelled: { label: "已取消", className: "status-cancelled" }
};
const ACTIVE_STATUSES = new Set(["pending", "preparing", "ready"]);

let activeFilter = "active";
let soundEnabled = false;
let audioContext = null;
let hasLoadedOnce = false;
let knownOrderNumbers = new Set();
let toastTimer = null;
let currentOrders = [];
let currentSession = null;
let realtimeChannel = null;
let pollTimer = null;
let renderRequestId = 0;
let logoutJustCompleted = false;

const orderChannel = "BroadcastChannel" in window
  ? new BroadcastChannel(ORDER_CHANNEL_NAME)
  : null;

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const passwordToggle = document.getElementById("passwordToggle");
const capsLockHint = document.getElementById("capsLockHint");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const adminWorkspace = document.getElementById("adminWorkspace");
const adminUser = document.getElementById("adminUser");
const logoutButton = document.getElementById("logoutButton");
const modeBadge = document.getElementById("modeBadge");
const demoNoticeTitle = document.getElementById("demoNoticeTitle");
const demoNoticeText = document.getElementById("demoNoticeText");
const ordersGrid = document.getElementById("ordersGrid");
const emptyState = document.getElementById("emptyState");
const filterTabs = document.getElementById("filterTabs");
const syncStatus = document.getElementById("syncStatus");
const soundButton = document.getElementById("soundButton");
const refreshButton = document.getElementById("refreshButton");
const clearCompletedButton = document.getElementById("clearCompletedButton");
const newOrderToast = document.getElementById("newOrderToast");
const newOrderToastText = document.getElementById("newOrderToastText");
const pendingCount = document.getElementById("pendingCount");
const preparingCount = document.getElementById("preparingCount");
const readyCount = document.getElementById("readyCount");
const completedCount = document.getElementById("completedCount");
const todayRevenue = document.getElementById("todayRevenue");
const activeBadge = document.getElementById("activeBadge");

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
  if (!Number.isFinite(number)) return "$0";
  return `$${Number.isInteger(number) ? number : number.toFixed(2)}`;
}

function normalizeOrder(raw) {
  if (!raw || typeof raw !== "object") return null;

  const orderNumber = raw.orderNumber ?? raw.order_number;
  if (!orderNumber) return null;

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems
    .map((item) => ({
      key: String(item?.key || ""),
      name: String(item?.name || "未命名菜品"),
      englishName: String(item?.englishName || item?.english_name || ""),
      price: Number(item?.price) || 0,
      quantity: Math.max(1, Math.floor(Number(item?.quantity) || 1)),
      subtotal: Number(item?.subtotal)
        || (Number(item?.price) || 0) * Math.max(1, Math.floor(Number(item?.quantity) || 1))
    }))
    .filter((item) => item.name);

  const createdAt = raw.createdAt ?? raw.created_at ?? new Date().toISOString();
  const updatedAt = raw.updatedAt ?? raw.updated_at ?? createdAt;
  const status = STATUS_META[raw.status] ? raw.status : "pending";

  return {
    id: raw.id ? String(raw.id) : "",
    orderNumber: String(orderNumber),
    tableNumber: String(raw.tableNumber ?? raw.table_number ?? "--"),
    note: String(raw.note || "无备注"),
    createdAt,
    updatedAt,
    status,
    itemCount: Number(raw.itemCount ?? raw.item_count)
      || items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    total: Number(raw.total)
      || items.reduce((sum, item) => sum + item.subtotal, 0)
  };
}

function loadLocalOrders() {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved
      .map(normalizeOrder)
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.warn("本机订单列表读取失败。", error);
    return [];
  }
}

function saveLocalOrders(orders, message = { type: "orders-updated" }) {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders.slice(0, 200)));
    orderChannel?.postMessage(message);
    return true;
  } catch (error) {
    console.error("本机订单列表保存失败。", error);
    window.alert("订单状态保存失败，请检查浏览器是否允许本地存储。");
    return false;
  }
}

async function fetchCloudOrders() {
  if (!CLOUD_MODE || !currentSession) return [];

  const { data, error } = await cloudClient
    .from("orders")
    .select("id, order_number, table_number, note, status, item_count, items, total, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map(normalizeOrder)
    .filter(Boolean);
}

function isToday(value) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function filterOrders(orders) {
  if (activeFilter === "all") return orders;
  if (activeFilter === "active") {
    return orders.filter((order) => ACTIVE_STATUSES.has(order.status));
  }
  return orders.filter((order) => order.status === activeFilter);
}

function createActionButtons(order) {
  if (order.status === "pending") {
    return `
      <button class="primary-action" type="button" data-order-action="preparing" data-order-number="${escapeHTML(order.orderNumber)}">接单并开始制作</button>
      <button class="secondary-action" type="button" data-order-action="cancelled" data-order-number="${escapeHTML(order.orderNumber)}">取消</button>
    `;
  }

  if (order.status === "preparing") {
    return `<button class="primary-action" type="button" data-order-action="ready" data-order-number="${escapeHTML(order.orderNumber)}">制作完成</button>`;
  }

  if (order.status === "ready") {
    return `<button class="primary-action" type="button" data-order-action="completed" data-order-number="${escapeHTML(order.orderNumber)}">确认已上菜</button>`;
  }

  return `<button class="secondary-action" type="button" data-order-action="pending" data-order-number="${escapeHTML(order.orderNumber)}">恢复为待接单</button>`;
}

function createOrderCard(order) {
  const status = STATUS_META[order.status];
  const itemLines = order.items.map((item) => `
    <div class="order-line">
      <strong title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</strong>
      <span>×${item.quantity}</span>
      <small>${formatPrice(item.subtotal)}</small>
    </div>
  `).join("");

  const note = order.note && order.note !== "无备注"
    ? `<p class="order-card__note"><strong>备注：</strong>${escapeHTML(order.note)}</p>`
    : "";

  const isNew = order.status === "pending"
    && Date.now() - new Date(order.createdAt).getTime() < 5 * 60 * 1000;

  return `
    <article class="order-card${isNew ? " is-new" : ""}" data-order-number="${escapeHTML(order.orderNumber)}">
      <div class="order-card__top">
        <div class="order-card__table">
          <span>TABLE</span>
          <div>
            <h2>${escapeHTML(order.tableNumber)}</h2>
            <p>${escapeHTML(order.orderNumber)}</p>
          </div>
        </div>
        <div class="order-card__meta">
          <span class="status-pill ${status.className}">${status.label}</span>
          <p>${formatDateTime(order.createdAt)}</p>
        </div>
      </div>
      <div class="order-card__items">${itemLines || '<div class="order-line"><strong>无菜品明细</strong></div>'}</div>
      ${note}
      <footer class="order-card__footer">
        <div class="order-total">
          <span>${order.itemCount} 件菜品</span>
          <strong>${formatPrice(order.total)}</strong>
        </div>
        <div class="order-actions">${createActionButtons(order)}</div>
      </footer>
    </article>
  `;
}

function renderStats(orders) {
  const pending = orders.filter((order) => order.status === "pending").length;
  const preparing = orders.filter((order) => order.status === "preparing").length;
  const ready = orders.filter((order) => order.status === "ready").length;
  const completedTodayOrders = orders.filter(
    (order) => order.status === "completed" && isToday(order.updatedAt)
  );
  const revenue = orders
    .filter((order) => order.status !== "cancelled" && isToday(order.createdAt))
    .reduce((sum, order) => sum + order.total, 0);

  pendingCount.textContent = String(pending);
  preparingCount.textContent = String(preparing);
  readyCount.textContent = String(ready);
  completedCount.textContent = String(completedTodayOrders.length);
  activeBadge.textContent = String(pending + preparing + ready);
  todayRevenue.textContent = formatPrice(revenue);
}

function detectNewOrders(orders) {
  const current = new Set(orders.map((order) => order.orderNumber));

  if (hasLoadedOnce) {
    const newOrders = orders.filter(
      (order) => order.status === "pending" && !knownOrderNumbers.has(order.orderNumber)
    );

    if (newOrders.length > 0) {
      const latest = newOrders[0];
      showNewOrderToast(
        `${latest.tableNumber}桌 · ${latest.itemCount}件 · ${formatPrice(latest.total)}`
      );
      playNewOrderSound();
    }
  }

  knownOrderNumbers = current;
  hasLoadedOnce = true;
}

function paintOrders(orders, { detectNew = false } = {}) {
  currentOrders = orders;

  if (detectNew) {
    detectNewOrders(orders);
  } else if (!hasLoadedOnce) {
    knownOrderNumbers = new Set(orders.map((order) => order.orderNumber));
    hasLoadedOnce = true;
  }

  renderStats(orders);
  const visibleOrders = filterOrders(orders);
  ordersGrid.innerHTML = visibleOrders.map(createOrderCard).join("");
  emptyState.hidden = visibleOrders.length > 0;
  ordersGrid.hidden = visibleOrders.length === 0;

  const modeText = CLOUD_MODE ? "云端实时" : "本机演示";
  syncStatus.textContent = `已同步 · ${formatTime(new Date())} · ${modeText} · 共 ${orders.length} 笔订单`;
  syncStatus.classList.remove("is-error", "is-loading");
}

async function renderOrders({ detectNew = false } = {}) {
  const requestId = ++renderRequestId;
  syncStatus.textContent = CLOUD_MODE ? "正在同步云端订单…" : "正在读取本机订单…";
  syncStatus.classList.add("is-loading");
  syncStatus.classList.remove("is-error");

  try {
    const orders = CLOUD_MODE ? await fetchCloudOrders() : loadLocalOrders();
    if (requestId !== renderRequestId) return;
    paintOrders(orders, { detectNew });
  } catch (error) {
    console.error("订单同步失败。", error);
    syncStatus.textContent = `同步失败：${error?.message || "请检查网络或数据库权限"}`;
    syncStatus.classList.remove("is-loading");
    syncStatus.classList.add("is-error");
  }
}

async function updateOrderStatus(orderNumber, status, button) {
  if (!STATUS_META[status]) return;

  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = "处理中…";
  }

  try {
    if (CLOUD_MODE) {
      const { error } = await cloudClient
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("order_number", orderNumber);

      if (error) throw error;
    } else {
      const orders = loadLocalOrders();
      const target = orders.find((order) => order.orderNumber === orderNumber);
      if (!target) return;
      target.status = status;
      target.updatedAt = new Date().toISOString();
      if (!saveLocalOrders(orders, { type: "order-status-changed", orderNumber, status })) {
        return;
      }
    }

    await renderOrders();
  } catch (error) {
    console.error("订单状态更新失败。", error);
    window.alert(`订单状态更新失败：${error?.message || "请检查网络或权限"}`);
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || "重试";
    }
  }
}

async function clearCompletedOrders() {
  const removableCount = currentOrders.filter(
    (order) => order.status === "completed" || order.status === "cancelled"
  ).length;

  if (removableCount === 0) {
    window.alert("目前没有可清理的已完成或已取消订单。");
    return;
  }

  if (!window.confirm(`确定清理 ${removableCount} 笔已完成/已取消订单吗？`)) {
    return;
  }

  clearCompletedButton.disabled = true;
  clearCompletedButton.textContent = "清理中…";

  try {
    if (CLOUD_MODE) {
      const { error } = await cloudClient
        .from("orders")
        .delete()
        .in("status", ["completed", "cancelled"]);

      if (error) throw error;
    } else {
      const remaining = loadLocalOrders().filter(
        (order) => order.status !== "completed" && order.status !== "cancelled"
      );
      if (!saveLocalOrders(remaining, { type: "orders-cleared" })) return;
    }

    await renderOrders();
  } catch (error) {
    console.error("订单清理失败。", error);
    window.alert(`订单清理失败：${error?.message || "请检查网络或权限"}`);
  } finally {
    clearCompletedButton.disabled = false;
    clearCompletedButton.textContent = "清理已完成";
  }
}

function showNewOrderToast(text) {
  if (!newOrderToast || !newOrderToastText) return;
  newOrderToastText.textContent = text;
  newOrderToast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    newOrderToast.hidden = true;
  }, 4200);
}

function playNewOrderSound() {
  if (!soundEnabled) return;

  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;

    [0, 0.18].forEach((delay, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = index === 0 ? 740 : 980;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.16, now + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.14);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 0.16);
    });
  } catch (error) {
    console.warn("提示音播放失败。", error);
  }
}

function setLoginMessage(message, type = "") {
  loginMessage.textContent = message;
  loginMessage.className = "login-message";
  if (type) loginMessage.classList.add(`is-${type}`);
}

function setPasswordVisibility(visible, shouldFocus = true) {
  if (!loginPassword || !passwordToggle) return;

  const start = loginPassword.selectionStart;
  const end = loginPassword.selectionEnd;
  loginPassword.type = visible ? "text" : "password";
  passwordToggle.textContent = visible ? "隐藏" : "显示";
  passwordToggle.setAttribute("aria-label", visible ? "隐藏密码" : "显示密码");
  passwordToggle.setAttribute("aria-pressed", String(visible));

  if (shouldFocus) {
    loginPassword.focus({ preventScroll: true });
    if (Number.isInteger(start) && Number.isInteger(end)) {
      loginPassword.setSelectionRange(start, end);
    }
  }
}

function updateCapsLockHint(event) {
  if (!capsLockHint || typeof event?.getModifierState !== "function") return;
  capsLockHint.hidden = !event.getModifierState("CapsLock");
}

function updateModeCopy() {
  if (CLOUD_MODE) {
    modeBadge.textContent = "CLOUD LIVE";
    modeBadge.classList.add("is-cloud");
    demoNoticeTitle.textContent = "云端实时接单";
    demoNoticeText.textContent = "不同手机、平板和餐厅电脑可通过 Supabase 实时同步订单；商家操作需要登录。";
  } else {
    modeBadge.textContent = "LOCAL DEMO";
    modeBadge.classList.remove("is-cloud");
    demoNoticeTitle.textContent = "本机联动演示";
    demoNoticeText.textContent = "当前尚未填写 Supabase 配置，顾客菜单和订单台需在同一个浏览器里测试。";
  }
}

function showWorkspace(session = null) {
  currentSession = session;
  loginScreen.hidden = true;
  adminWorkspace.hidden = false;
  logoutButton.hidden = !CLOUD_MODE;
  adminUser.hidden = !CLOUD_MODE;

  if (CLOUD_MODE) {
    adminUser.textContent = session?.user?.email || "已登录员工";
  }
}

function showLogin() {
  currentSession = null;
  adminWorkspace.hidden = true;
  loginScreen.hidden = false;
  logoutButton.hidden = true;
  adminUser.hidden = true;
  stopCloudSync();
  if (logoutJustCompleted) {
    setLoginMessage("已安全退出订单台。", "success");
  } else {
    setLoginMessage("请输入在 Supabase Auth 中创建的员工账号。", "info");
  }
}

function stopCloudSync() {
  if (realtimeChannel && CLOUD_MODE) {
    cloudClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startCloudSync() {
  if (!CLOUD_MODE || !currentSession) return;
  stopCloudSync();

  realtimeChannel = cloudClient
    .channel("maison-orders-v36")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => renderOrders({ detectNew: true })
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        syncStatus.textContent = "云端实时连接已建立，正在读取订单…";
      }
    });

  // Realtime 断线时仍有轮询兜底。
  pollTimer = window.setInterval(() => {
    renderOrders({ detectNew: true });
  }, 15000);
}

async function handleSession(session) {
  if (!CLOUD_MODE) {
    showWorkspace(null);
    await renderOrders();
    return;
  }

  if (!session) {
    showLogin();
    return;
  }

  showWorkspace(session);
  startCloudSync();
  await renderOrders();
}

async function initializeAuth() {
  updateModeCopy();

  if (!CLOUD_MODE) {
    await handleSession(null);
    return;
  }

  const { data, error } = await cloudClient.auth.getSession();

  if (error) {
    console.error("员工登录状态读取失败。", error);
    showLogin();
    setLoginMessage(`登录状态读取失败：${error.message}`, "error");
  } else {
    await handleSession(data.session);
  }

  cloudClient.auth.onAuthStateChange((_event, session) => {
    // 避免在 Auth 回调里直接执行异步 Supabase 请求。
    window.setTimeout(() => handleSession(session), 0);
  });
}

passwordToggle?.addEventListener("click", () => {
  setPasswordVisibility(loginPassword.type === "password");
});

["keydown", "keyup", "click"].forEach((eventName) => {
  loginPassword?.addEventListener(eventName, updateCapsLockHint);
});

loginPassword?.addEventListener("blur", () => {
  if (capsLockHint) capsLockHint.hidden = true;
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!CLOUD_MODE) return;

  logoutJustCompleted = false;
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    setLoginMessage("请输入邮箱和密码。", "error");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "正在登录…";
  setLoginMessage("正在验证员工账号…", "info");

  const { error } = await cloudClient.auth.signInWithPassword({ email, password });

  if (error) {
    setLoginMessage(`登录失败：${error.message}`, "error");
    loginButton.disabled = false;
    loginButton.textContent = "登录订单台";
    return;
  }

  loginPassword.value = "";
  setPasswordVisibility(false, false);
  if (capsLockHint) capsLockHint.hidden = true;
  loginButton.disabled = false;
  loginButton.textContent = "登录订单台";
});

logoutButton?.addEventListener("click", async () => {
  if (!CLOUD_MODE) return;

  const signedInEmail = currentSession?.user?.email || loginEmail?.value || "";
  logoutButton.disabled = true;
  logoutButton.textContent = "退出中…";
  logoutJustCompleted = true;

  try {
    const { error } = await cloudClient.auth.signOut();
    if (error) throw error;

    stopCloudSync();
    currentOrders = [];
    knownOrderNumbers = new Set();
    loginPassword.value = "";
    setPasswordVisibility(false, false);
    if (capsLockHint) capsLockHint.hidden = true;
    if (signedInEmail) loginEmail.value = signedInEmail;
    showLogin();
  } catch (error) {
    logoutJustCompleted = false;
    console.error("退出登录失败。", error);
    window.alert(`退出登录失败：${error?.message || "请检查网络后重试"}`);
  } finally {
    logoutButton.disabled = false;
    logoutButton.textContent = "退出登录";
  }
});

filterTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;

  activeFilter = button.dataset.filter;
  filterTabs.querySelectorAll("[data-filter]").forEach((item) => {
    item.classList.toggle("is-active", item === button);
  });

  paintOrders(currentOrders);
});

ordersGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-order-action]");
  if (!button) return;

  updateOrderStatus(
    button.dataset.orderNumber,
    button.dataset.orderAction,
    button
  );
});

soundButton?.addEventListener("click", async () => {
  soundEnabled = !soundEnabled;
  soundButton.classList.toggle("is-on", soundEnabled);
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
  soundButton.textContent = soundEnabled ? "新单提示音已开启" : "开启新单提示音";

  if (soundEnabled) {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
      playNewOrderSound();
    } catch (error) {
      console.warn("无法开启提示音。", error);
    }
  }
});

refreshButton?.addEventListener("click", () => renderOrders({ detectNew: true }));
clearCompletedButton?.addEventListener("click", clearCompletedOrders);

if (!CLOUD_MODE) {
  window.addEventListener("storage", (event) => {
    if (event.key === ORDER_STORAGE_KEY) {
      renderOrders({ detectNew: true });
    }
  });
  orderChannel?.addEventListener("message", () => renderOrders({ detectNew: true }));
  pollTimer = window.setInterval(() => renderOrders({ detectNew: true }), 5000);
}

window.addEventListener("beforeunload", stopCloudSync);

initializeAuth();
console.info(`MAISON ÉLAN 商家订单台已启动，版本 ${APP_VERSION}，模式：${CLOUD_MODE ? "Supabase 云端" : "本机演示"}`);