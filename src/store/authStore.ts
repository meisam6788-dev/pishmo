import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SiteData {
    id: string;       // معمولاً همان آدرس سایت (بدون https) به عنوان آیدی یکتا
    url: string;      // آدرس کامل سایت
    ck: string;       // کلید مصرف‌کننده
    cs: string;       // راز مصرف‌کننده
    name: string;     // نام سایت (برای نمایش در منو)
}

interface AuthState {
    sites: SiteData[];           // لیست تمام سایت‌های ذخیره شده
    activeSite: SiteData | null; // سایتی که در حال حاضر باز است
    isLoggedIn: boolean;         // آیا کاربر لاگین است؟

    // اکشن‌ها
    addNewSite: (site: SiteData) => Promise<void>;
    switchSite: (siteId: string) => Promise<void>;
    removeSite: (siteId: string) => Promise<void>;
    logoutAll: () => Promise<void>;
    checkLoginStatus: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    sites: [],
    activeSite: null,
    isLoggedIn: false,

    // بررسی اولیه هنگام باز شدن اپلیکیشن
    checkLoginStatus: async () => {
        try {
            const storedSites = await AsyncStorage.getItem('@pishmo_sites');
            const storedActiveId = await AsyncStorage.getItem('@pishmo_active_site_id');
            
            if (storedSites) {
                const parsedSites: SiteData[] = JSON.parse(storedSites);
                if (parsedSites.length > 0) {
                    // پیدا کردن سایتی که آخرین بار باز بوده
                    const active = parsedSites.find(s => s.id === storedActiveId) || parsedSites[0];
                    set({ sites: parsedSites, activeSite: active, isLoggedIn: true });
                    return;
                }
            }
            set({ sites: [], activeSite: null, isLoggedIn: false });
        } catch (e) {
            set({ sites: [], activeSite: null, isLoggedIn: false });
        }
    },

    // اضافه کردن سایت جدید (یا اولین سایت)
    addNewSite: async (site: SiteData) => {
        try {
            const { sites } = get();
            // جلوگیری از اضافه شدن سایت تکراری
            const filteredSites = sites.filter(s => s.id !== site.id);
            const newSites = [...filteredSites, site];
            
            await AsyncStorage.setItem('@pishmo_sites', JSON.stringify(newSites));
            await AsyncStorage.setItem('@pishmo_active_site_id', site.id);
            
            set({ sites: newSites, activeSite: site, isLoggedIn: true });
        } catch (e) {
            console.error("Error saving site:", e);
        }
    },

    // سوئیچ کردن بین سایت‌ها با تضمین عدم تداخل دیتا
    switchSite: async (siteId: string) => {
        const { sites, activeSite } = get();
        if (activeSite?.id === siteId) return; // اگر روی همین سایت بود، کاری نکن

        const targetSite = sites.find(s => s.id === siteId);
        if (targetSite) {
            // نکته امنیتی مهم: پاک کردن کش‌های موقت هنگام سوئیچ
            await AsyncStorage.removeItem('@pishmo_orders_cache');
            await AsyncStorage.setItem('@pishmo_active_site_id', siteId);
            
            set({ activeSite: targetSite });
        }
    },

    // حذف یک سایت از لیست
    removeSite: async (siteId: string) => {
        const { sites, activeSite } = get();
        const updatedSites = sites.filter(s => s.id !== siteId);
        
        await AsyncStorage.setItem('@pishmo_sites', JSON.stringify(updatedSites));
        
        if (updatedSites.length === 0) {
            // اگر همه سایت‌ها حذف شدند، کلاً خروج بزن
            await get().logoutAll();
        } else if (activeSite?.id === siteId) {
            // اگر سایتی که حذف شد همان سایتِ فعال بود، سایت اول را باز کن
            await AsyncStorage.setItem('@pishmo_active_site_id', updatedSites[0].id);
            set({ sites: updatedSites, activeSite: updatedSites[0] });
        } else {
            set({ sites: updatedSites });
        }
    },

    // خروج کامل و پاکسازی کل دیتاها
    logoutAll: async () => {
        await AsyncStorage.removeItem('@pishmo_sites');
        await AsyncStorage.removeItem('@pishmo_active_site_id');
        await AsyncStorage.removeItem('@pishmo_orders_cache');
        // ... (هر کش دیگری که در آینده بسازیم اینجا پاک می‌شود)
        
        set({ sites: [], activeSite: null, isLoggedIn: false });
    }
}));