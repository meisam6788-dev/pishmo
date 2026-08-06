// storage/settingsStorage.ts
//
// توجه امنیتی: AsyncStorage رمزنگاری نمی‌شه. برای کلید/سکرت API که حساس
// هستن، توصیه می‌شه در نسخه نهایی از react-native-keychain (Secure
// Enclave/Keystore) استفاده کنید. ساختار توابع زیر (get/save) طوری نوشته
// شده که جایگزینی storage بدون تغییر بقیه اپ ممکنه.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { WooCommerceSettings, SyncStatus } from '../types/sync';

const KEYS = {
  SETTINGS: '@sync/woocommerce_settings',
  STATUS: '@sync/status',
};

const DEFAULT_SETTINGS: WooCommerceSettings = {
  siteUrl: '',
  consumerKey: '',
  consumerSecret: '',
  autoNightlySync: true,
};

const DEFAULT_STATUS: SyncStatus = {
  lastSyncAt: null,
  lastSyncCount: 0,
  lastSyncError: null,
  isSyncing: false,
};

export async function getSettings(): Promise<WooCommerceSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: WooCommerceSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function getSyncStatus(): Promise<SyncStatus> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STATUS);
    return raw ? { ...DEFAULT_STATUS, ...JSON.parse(raw) } : DEFAULT_STATUS;
  } catch {
    return DEFAULT_STATUS;
  }
}

export async function saveSyncStatus(status: Partial<SyncStatus>): Promise<SyncStatus> {
  const current = await getSyncStatus();
  const next = { ...current, ...status };
  await AsyncStorage.setItem(KEYS.STATUS, JSON.stringify(next));
  return next;
}
