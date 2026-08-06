# ماژول حسابداری - راهنمای ادغام

## نصب پکیج مورد نیاز
```bash
npm install @react-native-async-storage/async-storage
cd ios && pod install   # فقط برای iOS
```

## ساختار فایل‌ها
کل پوشه `accounting-module` را داخل `src/` پروژه‌تون کپی کنید:
```
src/
  types/accounting.ts        # تایپ‌ها
  storage/accountingStorage.ts # ذخیره‌سازی محلی (AsyncStorage)
  utils/calculations.ts      # محاسبه سود و سرمایه
  screens/PurchaseInvoiceScreen.tsx
  screens/ExpenseScreen.tsx
  screens/ReportScreen.tsx
```

## اضافه کردن به Navigation
با هر navigator که استفاده می‌کنید (پیشنهاد: `@react-navigation/bottom-tabs`
برای دسترسی سریع با یک لمس به هر سه بخش):

```tsx
<Tab.Navigator>
  <Tab.Screen name="فاکتور خرید" component={PurchaseInvoiceScreen} />
  <Tab.Screen name="هزینه‌ها" component={ExpenseScreen} />
  <Tab.Screen name="گزارش سود" component={ReportScreen} />
</Tab.Navigator>
```

## اتصال به فروش ووکامرس (مرحله بعدی)
وقتی ماژول Sync ووکامرس (Polling) رو ساختیم، برای هر سفارش جدید فقط کافیه
این تابع صدا زده بشه — هیچ تغییری در صفحات بالا لازم نیست:

```ts
import { upsertSaleFromOrder } from './storage/accountingStorage';

// نمونه: داخل تابع polling که هر N دقیقه سفارش‌های جدید ووکامرس رو می‌گیره
await upsertSaleFromOrder({
  id: order.id,
  total: order.total,          // ووکامرس رشته برمی‌گردونه، مثل "150000"
  date_created: order.date_created,
});
```

## نکات مهم درباره سرعت
- تمام داده‌ها به‌صورت محلی (AsyncStorage) ذخیره می‌شن → باز شدن صفحات و
  ثبت فاکتور/هزینه بدون تاخیر شبکه انجام می‌شه.
- محاسبات گزارش (`calculateProfitReport`) کاملاً سمت کلاینت و آنی هستن.
- اگر تعداد رکوردها به چند هزار در ماه برسه و لگ حس شد، مهاجرت به SQLite
  (`react-native-sqlite-storage` یا `expo-sqlite`) با حفظ همین ساختار
  توابع (`get...`, `add...`, `delete...`) خیلی راحت انجام می‌شه.

---

## ماژول Sync ووکامرس (اضافه شد ✅)

فایل‌های جدید:
```
theme/theme.ts                     # تم مشترک (رنگ، فاصله، تایپوگرافی) - مدرن/مینیمال
types/sync.ts
storage/settingsStorage.ts         # ذخیره آدرس سایت + کلیدهای API
services/wooCommerceApi.ts         # فراخوانی REST API ووکامرس
services/syncManager.ts            # performSync + autoSyncIfDue
services/backgroundScheduler.ts    # Sync واقعی در پس‌زمینه (شب‌به‌شب)
screens/SyncSettingsScreen.tsx     # صفحه تنظیمات + دکمه Sync
```

### نصب پکیج‌های جدید
```bash
npm install react-native-background-fetch
cd ios && pod install
```

### چطور اضافه‌اش کنید به پروژه‌ی خودتون در VS Code
۱. پوشه‌ی `accounting-module` رو کامل کپی کنید داخل `src/` پروژه RN موجودتون
   (مثلا با drag & drop در VS Code Explorer، یا از ترمینال:
   `cp -r accounting-module/* your-project/src/`).

۲. مطمئن بشید پکیج‌های زیر نصب هستن:
```bash
npm install @react-native-async-storage/async-storage react-native-background-fetch
npx pod-install   # فقط iOS
```

۳. صفحات رو به Navigator اضافه کنید (نمونه پایین‌تر، بخش Navigation).

۴. فایل `App.tsx` پروژه اصلی‌تون رو اینطوری آپدیت کنید تا موقع باز شدن اپ
   هم چک اتوماتیک انجام بشه (پوشش برای وقتی background fetch دیر اجرا میشه):

```tsx
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { autoSyncIfDue } from './src/services/syncManager';
import { initBackgroundSync } from './src/services/backgroundScheduler';

export default function App() {
  useEffect(() => {
    initBackgroundSync();
    autoSyncIfDue(); // چک سریع موقع باز شدن اپ

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') autoSyncIfDue();
    });
    return () => sub.remove();
  }, []);

  // ... بقیه اپ شما
}
```

۵. برای اجرای Sync حتی وقتی اپ کاملاً بسته‌ست (فقط اندروید نیاز به این مرحله
   داره)، در `index.js` ریشه پروژه این خط‌ها رو اضافه کنید:

```js
// index.js
import BackgroundFetch from 'react-native-background-fetch';
import { headlessSyncTask } from './src/services/backgroundScheduler';

BackgroundFetch.registerHeadlessTask(headlessSyncTask);
```

### تنظیمات Native لازم (یک‌بار)
- **Android**: چیز خاصی لازم نیست، کتابخانه خودش JobScheduler رو مدیریت
  می‌کنه. فقط `minSdkVersion` باید ۲۱ یا بالاتر باشه (پیش‌فرض RN همینه).
- **iOS**: در Xcode → پروژه → Signing & Capabilities → `+ Capability` →
  **Background Modes** رو اضافه کنید و تیک **Background fetch** رو بزنید.
  همچنین در `Info.plist`:
```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
  <string>com.transistorsoft.fetch</string>
</array>
```

### درباره دقت "شب به شب"
iOS و اندروید هر دو زمان اجرای دقیق background task رو تضمین نمی‌کنن (برای
صرفه‌جویی باتری). یعنی سینک ممکنه ساعت ۲ شب اجرا بشه یا ساعت ۶ صبح. اگر
`autoSyncIfDue` (مرحله ۴) رو هم فعال کنید، حداکثر با باز کردن بعدی اپ سفارش‌ها
به‌روز می‌شن — پس در عمل داده هیچ‌وقت بیشتر از یک روز عقب نمی‌مونه.

### نمونه Navigation کامل (۴ تب)
```tsx
<Tab.Navigator screenOptions={{ headerShown: false }}>
  <Tab.Screen name="گزارش" component={ReportScreen} />
  <Tab.Screen name="خرید" component={PurchaseInvoiceScreen} />
  <Tab.Screen name="هزینه" component={ExpenseScreen} />
  <Tab.Screen name="تنظیمات" component={SyncSettingsScreen} />
</Tab.Navigator>
```

### امنیت کلید API
فعلاً کلید/سکرت ووکامرس با AsyncStorage (بدون رمزنگاری) ذخیره می‌شه. برای
نسخه‌ای که منتشر می‌کنید، پیشنهاد می‌کنم `react-native-keychain` رو جایگزین
کنید — فقط کافیه توابع `getSettings`/`saveSettings` در
`storage/settingsStorage.ts` رو عوض کنید، بقیه اپ دست‌نخورده می‌مونه.

## قدم بعدی پیشنهادی
- یکدست کردن ظاهر سه صفحه قبلی (فاکتور خرید/هزینه/گزارش) با فایل تم جدید
  `theme/theme.ts` تا کل اپ کاملاً یکپارچه به نظر برسه.
- افزودن رمزنگاری کلید API با react-native-keychain.
