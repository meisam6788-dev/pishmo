import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { sendCrashLog } from './CrashLogger';

export const createWooClient = () => {
    // 👇 تغییرات جدید برای پشتیبانی از چند سایتی: خواندن اطلاعات از activeSite
    const { activeSite } = useAuthStore.getState();

    if (!activeSite) {
        throw new Error('هیچ سایتی برای اتصال یافت نشد.');
    }

    const { url: siteUrl, ck: consumerKey, cs: consumerSecret } = activeSite;
    // 👆 پایان تغییرات --------------------------------------------------------

    // ۱. تمیزکاری آدرس سایت: حذف فاصله‌ها و اسلش‌های اضافی در انتهای آدرس
    let cleanUrl = siteUrl ? siteUrl.trim().replace(/\/+$/, '') : '';
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
    }

    // ۲. تمیزکاری کلیدهای وب‌سرویس از فاصله‌های نامرئی موبایل
    const cleanKey = consumerKey ? consumerKey.trim() : '';
    const cleanSecret = consumerSecret ? consumerSecret.trim() : '';

    // ۳. ساخت کلاینت اکسيوس با تنظیمات عبور از مد-سکوریتی و فایروال هاست
    const client = axios.create({
        baseURL: `${cleanUrl}/wp-json/wc/v3/`,
        timeout: 20000, // افزایش زمان به ۲۰ ثانیه برای پایداری در شبکه‌های داخلی
        params: {
            consumer_key: cleanKey,
            consumer_secret: cleanSecret,
        },
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            // 🛡️ حیاتی‌ترین خط: معرفی اپلیکیشن به عنوان مرورگر واقعی کروم جهت عبور از Imunify360 هاست
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
    });

    // ۴. لاگر هوشمند: نمایش آدرس دقیق درخواست و وضعیت خطا در ترمینال VS Code
    client.interceptors.request.use((config) => {
        console.log(`📡 [Sending Request] -> ${config.baseURL}${config.url}`);
        return config;
    });

    client.interceptors.response.use(
        (response) => {
            console.log(`✅ [Response OK] -> Status: ${response.status}`);
            return response;
        },
        (error) => {
            if (error.message === 'Network Error') {
                console.log('🚨 [Network Error Detected] 🚨');
                console.log('👉 بررسی ۱: آیا آدرس وارد شده در برنامه، دقیقا با آدرس "تنظیمات > عمومی" وردپرس (از لحاظ داشتن یا نداشتن www) یکی است؟');
                console.log('👉 بررسی ۲: آیا پیوند یکتا (Permalinks) در وردپرس روی حالت "نام نوشته" (Post name) قرار دارد؟');
            } else if (error.response) {
                console.log(`❌ [Server Error] -> Status: ${error.response.status}`, JSON.stringify(error.response.data));
            }
            return Promise.reject(error);
        }
    );

    // 🌟 شنود جهانی: ثبت اتوماتیک ارور در فیتلا
    client.interceptors.response.use(
        (response: any) => response,
        (error: any) => {
            if (error.response) {
                sendCrashLog(`خطای سرور: ${error.response.status} - مسیر: ${error.config.url}`);
            } else if (error.request) {
                sendCrashLog(`خطای شبکه (تایم اوت یا قطعی): مسیر ${error.config.url}`);
            } else {
                sendCrashLog(`خطای نامشخص اپلیکیشن: ${error.message}`);
            }
            return Promise.reject(error);
        }
    );
    return client;
};