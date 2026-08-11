import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * بررسی وضعیت اشتراک کاربر برای یک اپلیکیشن و قابلیت خاص
 * @param {string} appSlug - نام اپلیکیشن (مثلاً 'pishmo')
 * @param {string} featureSlug - نام قابلیت (مثلاً 'full_access' یا 'woocommerce_manager')
 * @returns {boolean} - true اگر دسترسی مجاز باشد، false اگر منقضی یا نامعتبر باشد
 */
export const checkUserLicense = async (appSlug, featureSlug) => {
  try {
    // ۱. دریافت توکن امنیتی کاربر که هنگام لاگین در گوشی ذخیره شده است
    const userToken = await AsyncStorage.getItem('userToken');

    if (!userToken) {
      console.warn('کاربر لاگین نکرده است. دسترسی به API مسدود است.');
      return false;
    }

    // ۲. ارسال درخواست امن به API سفارشی وردپرس
    const response = await fetch('https://fitla.ir/wp-json/fitla/v1/check-access/', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}` // توکن امنیتی برای عبور از فیلتر وردپرس
      },
      body: JSON.stringify({
        app_slug: appSlug,
        feature_slug: featureSlug
      })
    });

    const result = await response.json();

    // ۳. بررسی نتیجه برگشتی از سمت سرور
    if (response.ok && result.has_access) {
      console.log('وضعیت اشتراک: فعال', result.message);
      return true; 
    } else {
      console.log('وضعیت اشتراک: نامعتبر یا منقضی شده', result.message);
      return false; 
    }

  } catch (error) {
    console.error('خطا در ارتباط با سرور لایسنس:', error);
    return false;
  }
};