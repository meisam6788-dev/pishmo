import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

const exportCustomersToExcel = async (customersData) => {
  try {
    // ۱. ساخت ساختار استاندارد فایل CSV (که در اکسل به راحتی باز می‌شود)
    // فرض می‌کنیم دیتا شامل نام، موبایل و امتیاز مشتریان است
    const headerString = '\uFEFFنام,موبایل,امتیاز باشگاه\n'; // \uFEFF برای پشتیبانی کامل اکسل از زبان فارسی است
    
    const rowString = customersData.map(customer => 
      `${customer.name},${customer.phone},${customer.points}`
    ).join('\n');
    
    const csvContent = `${headerString}${rowString}`;

    // ۲. تعیین یک مسیر مجاز در حافظه موقت اپلیکیشن
    const fileName = 'Pishmo_Customers.csv';
    const fileUri = FileSystem.cacheDirectory + fileName;

    // ۳. نوشتن و ایجاد فایل در حافظه بدون نیاز به مجوز
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // ۴. باز کردن پنجره ذخیره‌سازی/اشتراک‌گذاری خودِ گوشی
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'ذخیره فایل اکسل مشتریان', // عنوان پنجره در اندروید
        UTI: 'public.comma-separated-values-text' // برای پشتیبانی iOS
      });
    } else {
      Alert.alert('خطا', 'قابلیت اشتراک‌گذاری و ذخیره فایل در این دستگاه فعال نیست.');
    }

  } catch (error) {
    console.error('خطا در ساخت فایل خروجی:', error);
    Alert.alert('خطا', 'متاسفانه در ساخت فایل اکسل مشکلی پیش آمد.');
  }
};