import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
  wpUsername: string;
  appPassword: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (url: string, key: string, secret: string, wpUser: string, appPass: string) => void;
  setIsAuthenticated: (status: boolean) => void;
  checkAuth: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      siteUrl: '',
      consumerKey: '',
      consumerSecret: '',
      wpUsername: '',
      appPassword: '',
      isAuthenticated: false,
      isLoading: false,

      setAuth: (url, key, secret, wpUser, appPass) => set({ 
        siteUrl: url, 
        consumerKey: key, 
        consumerSecret: secret, 
        wpUsername: wpUser, 
        appPassword: appPass 
      }),

      setIsAuthenticated: (status) => set({ isAuthenticated: status }),

      checkAuth: () => {
        const { siteUrl, consumerKey, consumerSecret } = get();
        if (siteUrl && consumerKey && consumerSecret) {
          set({ isAuthenticated: true });
        } else {
          set({ isAuthenticated: false });
        }
      },

      logout: () => set({ 
        siteUrl: '', 
        consumerKey: '', 
        consumerSecret: '', 
        wpUsername: '', 
        appPassword: '', 
        isAuthenticated: false 
      }),
    }),
    {
      name: 'womo-auth-storage', // نام کلید ذخیره‌سازی در حافظه گوشی
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);