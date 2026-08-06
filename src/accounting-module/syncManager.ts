// services/syncManager.ts

import { fetchOrdersSince } from './wooCommerceApi';
import { getSettings, getSyncStatus, saveSyncStatus } from '../storage/settingsStorage';
import { upsertSaleFromOrder } from '../storage/accountingStorage';

const NIGHTLY_THRESHOLD_HOURS = 20; // اگه از آخرین sync بیشتر از این گذشته، دوباره sync کن

/**
 * سینک اصلی: سفارش‌های جدید ووکامرس رو می‌گیره و در حسابداری (به‌عنوان فروش) ثبت می‌کنه.
 * برای جلوگیری از اجرای هم‌زمان دوباره، فلگ isSyncing چک می‌شه.
 */
export async function performSync(): Promise<{ success: boolean; count: number; error?: string }> {
  const status = await getSyncStatus();
  if (status.isSyncing) {
    return { success: false, count: 0, error: 'یک Sync دیگر در حال اجراست' };
  }

  await saveSyncStatus({ isSyncing: true, lastSyncError: null });

  try {
    const settings = await getSettings();
    const orders = await fetchOrdersSince(settings, status.lastSyncAt);

    let addedCount = 0;
    for (const order of orders) {
      const sale = await upsertSaleFromOrder({
        id: order.id,
        total: order.total,
        date_created: order.date_created_gmt || order.date_created,
      });
      if (sale) addedCount += 1;
    }

    await saveSyncStatus({
      isSyncing: false,
      lastSyncAt: new Date().toISOString(),
      lastSyncCount: addedCount,
      lastSyncError: null,
    });

    return { success: true, count: addedCount };
  } catch (e: any) {
    const message = e?.message || 'خطای نامشخص در Sync';
    await saveSyncStatus({ isSyncing: false, lastSyncError: message });
    return { success: false, count: 0, error: message };
  }
}

/**
 * این تابع رو هم موقع باز شدن اپ (App foreground) و هم داخل background task
 * صدا بزنید. اگر مدت‌زمان کافی از sync قبلی گذشته باشه، خودکار sync می‌کنه؛
 * در غیر این‌صورت کاری انجام نمی‌ده (برای جلوگیری از درخواست‌های اضافی).
 */
export async function autoSyncIfDue(): Promise<void> {
  const settings = await getSettings();
  if (!settings.autoNightlySync) return;

  const status = await getSyncStatus();
  if (!status.lastSyncAt) {
    await performSync();
    return;
  }

  const hoursSinceLastSync =
    (Date.now() - new Date(status.lastSyncAt).getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastSync >= NIGHTLY_THRESHOLD_HOURS) {
    await performSync();
  }
}
