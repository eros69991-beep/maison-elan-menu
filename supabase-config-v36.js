"use strict";

// 只需要修改下面两行。
// Project URL 示例：https://abcdefghijk.supabase.co
// Publishable key 示例：sb_publishable_xxxxxxxxxxxxxxxxx
// 旧项目的 anon key（通常以 eyJ 开头）也可以使用。
const MAISON_SUPABASE_URL = "https://qjvimnhuvulfxwyiedri.supabase.co";
const MAISON_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nZqDOEHXAIBpwQAtyzLw0w_jL16y59B";

(function initializeMaisonCloud() {
  const url = String(MAISON_SUPABASE_URL || "").trim();
  const publishableKey = String(
    MAISON_SUPABASE_PUBLISHABLE_KEY || ""
  ).trim();

  const sdk = window.supabase;

  const hasRealUrl =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) &&
    !url.includes("YOUR_");

  const hasRealKey =
    publishableKey.length > 30 &&
    !publishableKey.includes("YOUR_");

  const isConfigured = Boolean(
    hasRealUrl &&
    hasRealKey &&
    sdk?.createClient
  );

  let client = null;

  if (isConfigured) {
    const isAdminPage =
      /(^|\/)admin\.html$/i.test(window.location.pathname);

    client = sdk.createClient(url, publishableKey, {
      auth: {
        // 顾客菜单不读取员工登录状态；
        // 只有 admin.html 保存员工登录会话。
        persistSession: isAdminPage,
        autoRefreshToken: isAdminPage,
        detectSessionInUrl: isAdminPage,
        storageKey: "maison-elan-staff-auth-v1"
      }
    });
  }

  window.MAISON_CLOUD = Object.freeze({
    version: "3.7.0",
    isConfigured,
    client,
    url: isConfigured ? url : "",
    mode: isConfigured ? "cloud" : "local"
  });

  if (!isConfigured) {
    console.info(
      "MAISON ÉLAN：Supabase 尚未配置，当前使用本机演示模式。"
    );
  }
})();