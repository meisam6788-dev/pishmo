import React, { useState, useEffect } from 'react';
import {
    I18nManager, StyleSheet, View, Text, TouchableOpacity, ScrollView,
    StatusBar, Platform, Alert, ActivityIndicator, Image, Modal, TextInput
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';

import { useAuthStore } from './src/store/authStore';
import { useAppConfig } from './src/store/appConfigStore';
import { createWooClient } from './src/api/client';

import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { ProductsScreen } from './src/screens/ProductsScreen';
import { CustomersScreen } from './src/screens/CustomersScreen';
import { CustomerClubScreen } from './src/screens/CustomerClubScreen'; // 🚀 صفحه باشگاه مشتریان اضافه شد
import { CouponsScreen } from './src/screens/CouponsScreen';
import { TaxonomyScreen } from './src/screens/TaxonomyScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StoryCreatorScreen } from './src/screens/StoryCreatorScreen';
import { MediaGalleryScreen } from './src/screens/MediaGalleryScreen';
import { PostsScreen } from './src/screens/PostsScreen';
import { BulkEditScreen } from './src/screens/BulkEditScreen';
import { SmsSettingsScreen } from './src/screens/SmsSettingsScreen';

I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 35) : 45;

const styles = StyleSheet.create({
    globalWrapper: { flex: 1 },
    toolsHeader: { backgroundColor: '#ffffff', paddingTop: 15, paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    toolsTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    toolsSubtitle: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 'bold', textAlign: 'right' },
    subHeader: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', paddingTop: 10, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2, alignItems: 'center' },
    backButton: { flexDirection: 'row-reverse', alignItems: 'center' },
    backButtonText: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
    toolsList: { padding: 16, paddingBottom: 130 },
    multiSiteBtn: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 12 },
    langWidgetCard: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#d8b4fe', borderRadius: 16, padding: 14, marginBottom: 14 },
    langWidgetInfo: { flex: 1, alignItems: 'flex-end' },
    langWidgetTitle: { fontSize: 14, fontWeight: '900', color: '#581c87', marginBottom: 2 },
    langWidgetDesc: { fontSize: 10, color: '#7e22ce', fontWeight: 'bold' },
    langSwitchRow: { flexDirection: 'row-reverse' },
    langChoiceBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginRight: 6, borderWidth: 1, borderColor: '#e9d5ff' },
    langChoiceActive: { backgroundColor: '#8b5cf6', borderColor: '#7c3aed' },
    langEmoji: { fontSize: 14, marginLeft: 4 },
    langChoiceTxt: { fontSize: 11, fontWeight: 'bold', color: '#6b21a8' },
    langChoiceTxtActive: { color: '#ffffff', fontWeight: '900' },
    toolCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9', elevation: 1 },
    toolIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
    toolInfo: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', marginRight: 10 },
    toolName: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 2, textAlign: 'right' },
    toolDesc: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textAlign: 'right', lineHeight: 18 },
});

const GlobalScreenWrapper: React.FC<{ children: React.ReactNode; defaultBgColor?: string }> = ({ children, defaultBgColor = '#ffffff' }) => {
    const isDark = useAppConfig(state => state.isDarkMode);
    const themeBgColor = isDark ? '#0f172a' : defaultBgColor;

    return (
        <View style={[styles.globalWrapper, { backgroundColor: themeBgColor, paddingTop: STATUS_BAR_HEIGHT }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            {children}
        </View>
    );
};

const ToolsMenuScreen: React.FC = () => {
    const isDark = useAppConfig(state => state.isDarkMode);
    const theme = {
        bg: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : '#ffffff',
        text: isDark ? '#f8fafc' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#f1f5f9',
        borderHeader: isDark ? '#334155' : '#e2e8f0',
        input: isDark ? '#334155' : '#f1f5f9',
    };

    // 🚀 اضافه شدن club به لیست مسیرهای فعال
    const [activeTool, setActiveTool] = useState<'customers' | 'club' | 'coupons' | 'taxonomy' | 'reports' | 'settings' | 'gallery' | 'posts' | 'bulk' | 'sms' | null>(null);
    const logout = useAuthStore((state) => state.logout);
    const { language, setLanguage } = useAppConfig();

    const handleLogout = () => { Alert.alert('خروج از حساب', 'آیا مطمئن هستید؟', [{ text: 'انصراف', style: 'cancel' }, { text: 'خروج', style: 'destructive', onPress: () => logout() }]); };

    if (activeTool === 'customers') return <GlobalScreenWrapper defaultBgColor={theme.bg}><View style={[styles.subHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderHeader }]}><TouchableOpacity style={styles.backButton} onPress={() => setActiveTool(null)}><Text style={[styles.backButtonText, { color: theme.text }]}>بازگشت</Text><Feather name="arrow-right" size={22} color={theme.text} style={{ marginLeft: 8 }} /></TouchableOpacity></View><CustomersScreen /></GlobalScreenWrapper>;
    // 🚀 مسیر صفحه باشگاه مشتریان فعال شد
    if (activeTool === 'club') return <GlobalScreenWrapper defaultBgColor={theme.bg}><View style={[styles.subHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderHeader }]}><TouchableOpacity style={styles.backButton} onPress={() => setActiveTool(null)}><Text style={[styles.backButtonText, { color: theme.text }]}>بازگشت</Text><Feather name="arrow-right" size={22} color={theme.text} style={{ marginLeft: 8 }} /></TouchableOpacity></View><CustomerClubScreen /></GlobalScreenWrapper>;
    if (activeTool === 'coupons') return <GlobalScreenWrapper defaultBgColor={theme.bg}><View style={[styles.subHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderHeader }]}><TouchableOpacity style={styles.backButton} onPress={() => setActiveTool(null)}><Text style={[styles.backButtonText, { color: theme.text }]}>بازگشت</Text><Feather name="arrow-right" size={22} color={theme.text} style={{ marginLeft: 8 }} /></TouchableOpacity></View><CouponsScreen /></GlobalScreenWrapper>;
    if (activeTool === 'taxonomy') return <GlobalScreenWrapper defaultBgColor={theme.bg}><View style={[styles.subHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderHeader }]}><TouchableOpacity style={styles.backButton} onPress={() => setActiveTool(null)}><Text style={[styles.backButtonText, { color: theme.text }]}>بازگشت</Text><Feather name="arrow-right" size={22} color={theme.text} style={{ marginLeft: 8 }} /></TouchableOpacity></View><TaxonomyScreen /></GlobalScreenWrapper>;
    if (activeTool === 'settings') return <GlobalScreenWrapper defaultBgColor={theme.bg}><View style={[styles.subHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderHeader }]}><TouchableOpacity style={styles.backButton} onPress={() => setActiveTool(null)}><Text style={[styles.backButtonText, { color: theme.text }]}>بازگشت</Text><Feather name="arrow-right" size={22} color={theme.text} style={{ marginLeft: 8 }} /></TouchableOpacity></View><SettingsScreen /></GlobalScreenWrapper>;
    if (activeTool === 'gallery') return <GlobalScreenWrapper defaultBgColor={theme.bg}><View style={[styles.subHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderHeader }]}><TouchableOpacity style={styles.backButton} onPress={() => setActiveTool(null)}><Text style={[styles.backButtonText, { color: theme.text }]}>بازگشت</Text><Feather name="arrow-right" size={22} color={theme.text} style={{ marginLeft: 8 }} /></TouchableOpacity></View><MediaGalleryScreen /></GlobalScreenWrapper>;
    if (activeTool === 'posts') return <GlobalScreenWrapper defaultBgColor={theme.bg}><View style={[styles.subHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderHeader }]}><TouchableOpacity style={styles.backButton} onPress={() => setActiveTool(null)}><Text style={[styles.backButtonText, { color: theme.text }]}>بازگشت</Text><Feather name="arrow-right" size={22} color={theme.text} style={{ marginLeft: 8 }} /></TouchableOpacity></View><PostsScreen /></GlobalScreenWrapper>;
    if (activeTool === 'bulk') return <GlobalScreenWrapper defaultBgColor={theme.bg}><View style={[styles.subHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderHeader }]}><TouchableOpacity style={styles.backButton} onPress={() => setActiveTool(null)}><Text style={[styles.backButtonText, { color: theme.text }]}>بازگشت</Text><Feather name="arrow-right" size={22} color={theme.text} style={{ marginLeft: 8 }} /></TouchableOpacity></View><BulkEditScreen /></GlobalScreenWrapper>;
    if (activeTool === 'sms') return <GlobalScreenWrapper defaultBgColor={theme.bg}><SmsSettingsScreen onBack={() => setActiveTool(null)} /></GlobalScreenWrapper>;

    return (
        <GlobalScreenWrapper defaultBgColor={theme.bg}>
            <View style={[styles.toolsHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderHeader }]}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={[styles.toolsTitle, { color: theme.text }]}>امکانات و مدیریت</Text>
                        <Text style={[styles.toolsSubtitle, { color: theme.textMuted }]}>ابزارهای پیشرفته فروشگاه</Text>
                    </View>
                    <TouchableOpacity style={[styles.multiSiteBtn, { backgroundColor: theme.input }]} onPress={() => Alert.alert('مدیریت سایت‌ها', 'امکان تغییر سایت در اینجا به زودی فعال می‌شود')}>
                        <Feather name="globe" size={22} color={theme.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.toolsList} showsVerticalScrollIndicator={false}>
                <View style={[styles.langWidgetCard, isDark && { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: '#7c3aed' }]}>
                    <View style={styles.langWidgetInfo}>
                        <Text style={[styles.langWidgetTitle, isDark && { color: '#c4b5fd' }]}>زبان برنامه / Language</Text>
                        <Text style={[styles.langWidgetDesc, isDark && { color: '#a78bfa' }]}>انتخاب زبان نمایش محیط مدیریت</Text>
                    </View>
                    <View style={styles.langSwitchRow}>
                        <TouchableOpacity style={[styles.langChoiceBtn, { backgroundColor: theme.card, borderColor: theme.border }, language === 'fa' && styles.langChoiceActive]} onPress={() => setLanguage('fa')}><Text style={styles.langEmoji}>🇮🇷</Text><Text style={[styles.langChoiceTxt, { color: isDark ? '#c4b5fd' : '#6b21a8' }, language === 'fa' && styles.langChoiceTxtActive]}>FA</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.langChoiceBtn, { backgroundColor: theme.card, borderColor: theme.border }, language === 'en' && styles.langChoiceActive]} onPress={() => setLanguage('en')}><Text style={styles.langEmoji}>🇬🇧</Text><Text style={[styles.langChoiceTxt, { color: isDark ? '#c4b5fd' : '#6b21a8' }, language === 'en' && styles.langChoiceTxtActive]}>EN</Text></TouchableOpacity>
                    </View>
                </View>

                {/* 🚀 دکمه ورود به باشگاه مشتریان (LRFM) */}
                <TouchableOpacity style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setActiveTool('club')}>
                    <Feather name="chevron-left" size={20} color={theme.textMuted} />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: theme.text }]}>باشگاه مشتریان (VIP)</Text><Text style={[styles.toolDesc, { color: theme.textMuted }]}>تحلیل LRFM، سطح‌بندی و وفادارسازی</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : '#f3e8ff' }]}><Feather name="award" size={24} color={isDark ? '#a78bfa' : '#8b5cf6'} /></View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setActiveTool('customers')}>
                    <Feather name="chevron-left" size={20} color={theme.textMuted} />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: theme.text }]}>مدیریت مشتریان (CRM)</Text><Text style={[styles.toolDesc, { color: theme.textMuted }]}>لیست خریداران، یادداشت‌گذاری و خروجی اکسل</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.1)' : '#fef3c7' }]}><Feather name="users" size={24} color={isDark ? '#fcd34d' : '#d97706'} /></View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setActiveTool('bulk')}>
                    <Feather name="chevron-left" size={20} color={theme.textMuted} />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: theme.text }]}>ویرایشگر گروهی محصولات</Text><Text style={[styles.toolDesc, { color: theme.textMuted }]}>تغییر قیمت، موجودی و وضعیت با یک کلیک</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: isDark ? 'rgba(234, 179, 8, 0.1)' : '#fef9c3' }]}><Feather name="zap" size={24} color={isDark ? '#fde047' : '#eab308'} /></View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setActiveTool('sms')}>
                    <Feather name="chevron-left" size={20} color={theme.textMuted} />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: theme.text }]}>پنل پیامک هوشمند (SMS)</Text><Text style={[styles.toolDesc, { color: theme.textMuted }]}>اتصال به تمامی پنل‌ها، ساخت الگو و تست</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.1)' : '#e0e7ff' }]}><Feather name="message-circle" size={24} color={isDark ? '#818cf8' : '#4f46e5'} /></View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setActiveTool('gallery')}>
                    <Feather name="chevron-left" size={20} color={theme.textMuted} />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: theme.text }]}>گالری رسانه (Media)</Text><Text style={[styles.toolDesc, { color: theme.textMuted }]}>مدیریت تصاویر، آپلود فایل جدید و حذف عکس‌ها</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: isDark ? 'rgba(20, 184, 166, 0.1)' : '#ccfbf1' }]}><Feather name="image" size={24} color={isDark ? '#5eead4' : '#14b8a6'} /></View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setActiveTool('posts')}>
                    <Feather name="chevron-left" size={20} color={theme.textMuted} />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: theme.text }]}>نوشته‌ها و مقالات (Blog)</Text><Text style={[styles.toolDesc, { color: theme.textMuted }]}>افزودن مطلب جدید، ویرایش و مدیریت دسته‌بندی‌ها</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.1)' : '#fce7f3' }]}><Feather name="edit-3" size={24} color={isDark ? '#f472b6' : '#ec4899'} /></View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setActiveTool('coupons')}>
                    <Feather name="chevron-left" size={20} color={theme.textMuted} />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: theme.text }]}>کدهای تخفیف (کوپن‌ها)</Text><Text style={[styles.toolDesc, { color: theme.textMuted }]}>مدیریت کمپین‌های فروش، ساخت و تعیین سقف تخفیف</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#dcfce7' }]}><Feather name="tag" size={24} color={isDark ? '#34d399' : '#10b981'} /></View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setActiveTool('taxonomy')}>
                    <Feather name="chevron-left" size={20} color={theme.textMuted} />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: theme.text }]}>ساختار محصولات (دسته‌ها)</Text><Text style={[styles.toolDesc, { color: theme.textMuted }]}>افزودن و مدیریت دسته‌بندی‌ها و تنوع رنگ/سایز</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#dbeafe' }]}><Feather name="layers" size={24} color={isDark ? '#93c5fd' : '#3b82f6'} /></View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setActiveTool('settings')}>
                    <Feather name="chevron-left" size={20} color={theme.textMuted} />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: theme.text }]}>تنظیمات حساب و سیستم</Text><Text style={[styles.toolDesc, { color: theme.textMuted }]}>مدیریت نسخه ویژه (Pro) و پاکسازی حافظه کش</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: theme.input }]}><Feather name="settings" size={24} color={theme.textMuted} /></View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toolCard, { borderColor: isDark ? '#9f1239' : '#fecdd3', backgroundColor: isDark ? 'rgba(225, 29, 72, 0.1)' : '#fff1f2', marginTop: 10 }]} onPress={handleLogout}>
                    <Feather name="chevron-left" size={20} color="#f43f5e" />
                    <View style={styles.toolInfo}><Text style={[styles.toolName, { color: isDark ? '#fb7185' : '#be123c' }]}>خروج از حساب کاربری</Text><Text style={[styles.toolDesc, { color: '#f43f5e' }]}>پاک شدن اطلاعات ورود و تغییر آدرس فروشگاه</Text></View>
                    <View style={[styles.toolIconBox, { backgroundColor: isDark ? 'rgba(225, 29, 72, 0.2)' : '#ffe4e6' }]}><Feather name="log-out" size={24} color={isDark ? '#fda4af' : '#e11d48'} /></View>
                </TouchableOpacity>
            </ScrollView>
        </GlobalScreenWrapper>
    );
};

function MainTabs() {
    const isDark = useAppConfig(state => state.isDarkMode);
    const initTheme = useAppConfig(state => state.initTheme);

    useEffect(() => {
        initTheme();
    }, [initTheme]);

    return (
        <Tab.Navigator
            initialRouteName="DashboardTab"
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: true,
                tabBarActiveTintColor: '#00c689',
                tabBarInactiveTintColor: isDark ? '#ffffff' : '#000000',
                tabBarStyle: {
                    position: 'absolute',
                    marginHorizontal: 25,
                    marginBottom: 25,
                    height: 55,
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 35,
                    borderTopWidth: 0,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 5, height: 10 },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                    paddingBottom: Platform.OS === 'ios' ? 25 : 20,
                    paddingTop: 2,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '900',
                    marginBottom: Platform.OS === 'ios' ? 0 : 5,
                }
            }}
        >
            <Tab.Screen
                name="ToolsTab"
                component={ToolsMenuScreen}
                options={{
                    tabBarLabel: 'امکانات',
                    tabBarIcon: ({ color }) => <Feather name="sliders" size={21} color={color} />
                }}
            />

            <Tab.Screen
                name="ProductsTab"
                options={{
                    tabBarLabel: 'محصولات',
                    tabBarIcon: ({ color }) => <Feather name="package" size={23} color={color} />
                }}
            >
                {() => <GlobalScreenWrapper defaultBgColor={isDark ? '#0f172a' : '#f1f5f9'}><ProductsScreen /></GlobalScreenWrapper>}
            </Tab.Screen>

            <Tab.Screen
                name="OrdersTab"
                options={{
                    tabBarLabel: 'سفارشات',
                    tabBarIcon: ({ color }) => <Feather name="shopping-bag" size={21} color={color} />
                }}
            >
                {() => <GlobalScreenWrapper defaultBgColor={isDark ? '#0f172a' : '#f1f5f9'}><OrdersScreen /></GlobalScreenWrapper>}
            </Tab.Screen>

            <Tab.Screen
                name="DashboardTab"
                options={{
                    tabBarLabel: 'پیشمو',
                    tabBarIcon: ({ color }) => <Feather name="home" size={21} color={color} />
                }}
            >
                {() => <GlobalScreenWrapper defaultBgColor={isDark ? '#0f172a' : '#f8fafc'}><DashboardScreen /></GlobalScreenWrapper>}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

export default function App() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const siteUrl = useAuthStore((state) => state.siteUrl);
    const isDark = useAppConfig(state => state.isDarkMode);

    if (!isAuthenticated || !siteUrl) {
        return (
            <GlobalScreenWrapper defaultBgColor={isDark ? '#0f172a' : '#ffffff'}>
                <NavigationContainer><LoginScreen /></NavigationContainer>
            </GlobalScreenWrapper>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen name="StoryCreator">
                    {() => <GlobalScreenWrapper defaultBgColor={isDark ? '#0f172a' : '#f8fafc'}><StoryCreatorScreen /></GlobalScreenWrapper>}
                </Stack.Screen>
            </Stack.Navigator>
        </NavigationContainer>
    );
}