import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface LicenseContextType {
    isPro: boolean;
    gracePeriod: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isPro, setIsPro] = useState(false);
    const [gracePeriod, setGracePeriod] = useState(false);

    // تولید/دریافت شناسه یکتای دستگاه
    const getDeviceId = async () => {
        if (Platform.OS === 'android') {
            return Application.getAndroidId();
        } else {
            return await Application.getIosIdForVendorAsync();
        }
    };

    // بررسی وضعیت لایسنس در پس‌زمینه
    const checkLicenseAccess = async (token: string) => {
        try {
            const deviceId = await getDeviceId();
            const response = await fetch('https://fitla.ir/wp-json/fitla/v1/check-access/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    app_slug: 'pishmo',
                    device_id: deviceId,
                }),
            });

            const data = await response.json();

            if (data.status === 'success') {
                setIsPro(true);
                setGracePeriod(!!data.grace_period);
                await AsyncStorage.setItem('@pishmo_isPro', 'true');
                await AsyncStorage.setItem('@pishmo_last_check', Date.now().toString());
            } else {
                // لایسنس نامعتبر یا منقضی شده
                setIsPro(false);
                setGracePeriod(false);
                await AsyncStorage.setItem('@pishmo_isPro', 'false');
            }
        } catch (error) {
            console.error('License check failed:', error);
        }
    };

    // مقداردهی اولیه سیستم کش ۲۴ ساعته
    useEffect(() => {
        const initApp = async () => {
            const cachedIsPro = await AsyncStorage.getItem('@pishmo_isPro');
            if (cachedIsPro === 'true') {
                setIsPro(true); // ورود فوری کاربر
            }

            const token = await SecureStore.getItemAsync('jwt_token');
            if (token) {
                const lastCheck = await AsyncStorage.getItem('@pishmo_last_check');
                const now = Date.now();
                const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

                // اگر کش خالی بود یا بیش از ۲۴ ساعت گذشته بود، در پس‌زمینه چک کن
                if (!lastCheck || now - parseInt(lastCheck) > TWENTY_FOUR_HOURS) {
                    checkLicenseAccess(token); // اجرا بدون await برای عدم توقف UI
                }
            }
        };

        initApp();
    }, []);

    // سیستم لاگین و دریافت JWT
    const login = async (username: string, password: string) => {
        try {
            const response = await fetch('https://fitla.ir/wp-json/jwt-auth/v1/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();

            if (data.token) {
                await SecureStore.setItemAsync('jwt_token', data.token);
                await checkLicenseAccess(data.token); // بلافاصله بعد از لاگین سطح دسترسی را بگیریم
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login Error:', error);
            return false;
        }
    };

    const logout = async () => {
        await SecureStore.deleteItemAsync('jwt_token');
        await AsyncStorage.multiRemove(['@pishmo_isPro', '@pishmo_last_check']);
        setIsPro(false);
    };

    return (
        <LicenseContext.Provider value={{ isPro, gracePeriod, login, logout }}>
            {children}
        </LicenseContext.Provider>
    );
};

export const useLicense = () => {
    const context = useContext(LicenseContext);
    if (!context) throw new Error('useLicense must be used within a LicenseProvider');
    return context;
};