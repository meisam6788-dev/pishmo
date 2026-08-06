// types/sync.ts

export interface WooCommerceSettings {
  siteUrl: string;        // مثال: https://mystore.com
  consumerKey: string;
  consumerSecret: string;
  autoNightlySync: boolean; // سینک خودکار شب به شب فعال/غیرفعال
}

export interface SyncStatus {
  lastSyncAt: string | null;   // ISO date
  lastSyncCount: number;       // تعداد سفارش جدیدی که آخرین بار sync شد
  lastSyncError: string | null;
  isSyncing: boolean;
}
