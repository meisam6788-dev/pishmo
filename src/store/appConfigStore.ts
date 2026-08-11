import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppConfigState {
    isProUser: boolean;
    isDarkMode: boolean; // متغیر سراسری حالت شب
    language: string;
    toggleDarkMode: (val: boolean) => void;
    setLanguage: (lang: string) => void;
    initTheme: () => Promise<void>;
}

export const useAppConfig = create<AppConfigState>((set) => ({
    isProUser: false,
    isDarkMode: false,
    language: 'fa',
    
    // تابع تغییر تم و ذخیره در حافظه
    toggleDarkMode: async (val: boolean) => {
        set({ isDarkMode: val });
        await AsyncStorage.setItem('@pishmo_dark_mode', String(val));
    },

    setLanguage: (lang: string) => {
        set({ language: lang });
    },
    
    // تابعی که موقع باز شدن اپلیکیشن، تم ذخیره شده را می‌خواند
    initTheme: async () => {
        const savedDark = await AsyncStorage.getItem('@pishmo_dark_mode');
        if (savedDark !== null) {
            set({ isDarkMode: savedDark === 'true' });
        }
    }
}));