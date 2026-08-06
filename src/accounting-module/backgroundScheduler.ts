// services/backgroundScheduler.ts
//
// این فایل Sync واقعی در پس‌زمینه (وقتی اپ بسته/مینیمایز هست) رو با
// کتابخانه react-native-background-fetch فعال می‌کنه. این کتابخانه از
// Android JobScheduler و iOS BGTaskScheduler استفاده می‌کنه.
//
// نکته مهم درباره iOS: سیستم‌عامل زمان دقیق اجرا رو گارانتی نمی‌کنه (نه فقط
// اپل، هر اپی همینه) — یعنی "شب به شب راس ساعت مشخص" ممکنه با چند ساعت
// اختلاف اجرا بشه. برای دقت بیشتر، ترکیب این روش با autoSyncIfDue (که موقع
// باز شدن اپ چک می‌کنه) باعث می‌شه داده همیشه حداکثر با یک روز تاخیر
// به‌روز باشه، حتی اگه background fetch دیر اجرا بشه.
//
// نصب:
//   npm install react-native-background-fetch
//   cd ios && pod install
// تنظیمات native (Android/iOS) در README توضیح داده شده.

import BackgroundFetch from 'react-native-background-fetch';
import { performSync } from './syncManager';
import { getSettings } from '../storage/settingsStorage';

let isConfigured = false;

export async function initBackgroundSync(): Promise<void> {
  if (isConfigured) return;
  isConfigured = true;

  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15, // دقیقه — حداقل فاصله بین اجراها؛ سیستم‌عامل زمان دقیق رو خودش انتخاب می‌کنه
      stopOnTerminate: false,   // بعد از بسته شدن کامل اپ هم فعال بمونه (اندروید)
      startOnBoot: true,        // بعد از ریستارت گوشی دوباره فعال بشه
      enableHeadless: true,     // اجرای بدون UI روی اندروید
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async (taskId) => {
      try {
        const settings = await getSettings();
        if (settings.autoNightlySync) {
          await performSync();
        }
      } finally {
        BackgroundFetch.finish(taskId);
      }
    },
    (taskId) => {
      // timeout - سیستم‌عامل زمان کافی نداده
      BackgroundFetch.finish(taskId);
    }
  );
}

/**
 * برای اندروید: این تابع باید در index.js به‌عنوان Headless Task ثبت بشه
 * تا وقتی اپ کاملاً بسته‌ست هم اجرا بشه. نمونه استفاده در README هست.
 */
export async function headlessSyncTask(event: { taskId: string }): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.autoNightlySync) {
      await performSync();
    }
  } finally {
    BackgroundFetch.finish(event.taskId);
  }
}
