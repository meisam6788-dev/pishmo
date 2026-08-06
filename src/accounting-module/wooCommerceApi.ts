// services/wooCommerceApi.ts
//
// کلاینت سبک برای WooCommerce REST API v3. از Basic Auth با
// Consumer Key/Secret استفاده می‌کنه (نیازمند HTTPS روی سایت).

import { WooCommerceSettings } from '../types/sync';

export interface WooOrder {
  id: number;
  status: string;
  total: string;
  date_created: string;
  date_created_gmt: string;
}

function buildAuthHeader(key: string, secret: string): string {
  // React Native's global `btoa` معمولا موجوده؛ اگر نبود از Buffer استفاده کنید.
  const token = `${key}:${secret}`;
  return `Basic ${typeof btoa === 'function' ? btoa(token) : global.Buffer.from(token).toString('base64')}`;
}

/**
 * سفارش‌های ایجاد/به‌روزشده بعد از یک تاریخ مشخص رو برمی‌گردونه.
 * از پارامتر after ووکامرس استفاده می‌کنیم (ISO8601، GMT).
 */
export async function fetchOrdersSince(
  settings: WooCommerceSettings,
  afterIso: string | null
): Promise<WooOrder[]> {
  if (!settings.siteUrl || !settings.consumerKey || !settings.consumerSecret) {
    throw new Error('تنظیمات اتصال به ووکامرس کامل نیست');
  }

  const baseUrl = settings.siteUrl.replace(/\/+$/, '');
  const perPage = 50;
  let page = 1;
  const allOrders: WooOrder[] = [];

  // صفحه‌بندی می‌کنیم تا اگر تعداد سفارش‌های جدید زیاد بود، همه رو بگیریم
  while (true) {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      orderby: 'date',
      order: 'asc',
      status: 'processing,completed,on-hold', // فقط سفارش‌های معتبر مالی
    });
    if (afterIso) params.set('after', afterIso);

    const url = `${baseUrl}/wp-json/wc/v3/orders?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: buildAuthHeader(settings.consumerKey, settings.consumerSecret),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`خطای ووکامرس (${response.status}): ${text.slice(0, 200)}`);
    }

    const orders: WooOrder[] = await response.json();
    allOrders.push(...orders);

    if (orders.length < perPage) break; // صفحه آخر
    page += 1;
    if (page > 20) break; // ایمنی در برابر لوپ بی‌نهایت
  }

  return allOrders;
}

/** تست اتصال سریع، برای دکمه "تست اتصال" در صفحه تنظیمات */
export async function testConnection(settings: WooCommerceSettings): Promise<boolean> {
  const orders = await fetchOrdersSince(settings, null);
  return Array.isArray(orders);
}
