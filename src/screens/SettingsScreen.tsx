import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native'; // 👈 کتابخانه نویگیشن اضافه شد
import { useAuthStore } from '../store/authStore';

export const SettingsScreen: React.FC = () => {
    const navigation = useNavigation<any>(); // 👈 فعال‌سازی کنترلر مسیر

    const activeSite = useAuthStore((state: any) => state.activeSite);
    const removeSite = useAuthStore((state: any) => state.removeSite);

    const clearAppCache = async () => {
        Alert.alert('پاکسازی حافظه', 'آیا مطمئن هستید؟ اطلاعات ذخیره شده موقت پاک می‌شوند.', [
            { text: 'انصراف', style: 'cancel' },
            {
                text: 'پاکسازی', style: 'destructive', onPress: async () => {
                    await AsyncStorage.removeItem('@pishmo_w_chart');
                    await AsyncStorage.removeItem('@pishmo_filter');
                    Alert.alert('موفق', 'حافظه پنهان اپلیکیشن (کش) پاک شد.');
                }
            }
        ]);
    };

    // 🚀 تابع اختصاصی و هوشمند برای خروج از سایت
    const handleLogoutSite = () => {
        if (!activeSite) return;

        Alert.alert(
            'خروج از فروشگاه',
            `آیا مطمئن هستید که می‌خواهید فروشگاه "${activeSite.name}" را از برنامه حذف کنید؟`,
            [
                { text: 'انصراف', style: 'cancel' },
                {
                    text: 'بله، خارج می‌شوم',
                    style: 'destructive',
                    onPress: async () => {
                        const siteName = activeSite.name;
                        await removeSite(activeSite.id); // پاک کردن سایت فعلی از حافظه

                        // چک کردن اینکه آیا سایت دیگری در گوشی مانده یا نه
                        const remainingSites = useAuthStore.getState().sites;

                        if (remainingSites && remainingSites.length > 0) {
                            Alert.alert('موفق', `فروشگاه "${siteName}" حذف شد. شما به سایت بعدی منتقل شدید.`);
                            // پرتاب فوری کاربر به داشبورد تا تغییر را ببیند
                            navigation.navigate('DashboardTab');
                        }
                        // اگر سایت دیگری نمانده باشد، سیستم خودکار او را به صفحه لاگین می‌برد
                    }
                }
            ]
        );
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>⚙️ تنظیمات سیستم</Text>
                <Text style={styles.headerSubtitle}>مدیریت حافظه و حساب کاربری</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <Text style={[styles.cardTitle, { marginBottom: 15 }]}>ابزارهای نگهداری</Text>

                    <TouchableOpacity style={styles.sysBtn} onPress={clearAppCache}>
                        <View style={styles.sysBtnIcon}><Feather name="trash-2" size={20} color="#f59e0b" /></View>
                        <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 15 }}>
                            <Text style={styles.sysBtnTitle}>پاکسازی حافظه کش (Cache)</Text>
                            <Text style={styles.sysBtnDesc}>رفع کندی و مشکلات گرافیکی احتمالی</Text>
                        </View>
                    </TouchableOpacity>

                    {/* دکمه خروج متصل شده به تابع هوشمند جدید */}
                    <TouchableOpacity style={[styles.sysBtn, { borderBottomWidth: 0, marginBottom: 0 }]} onPress={handleLogoutSite}>
                        <View style={[styles.sysBtnIcon, { backgroundColor: '#ffe4e6' }]}><Feather name="log-out" size={20} color="#e11d48" /></View>
                        <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 15 }}>
                            <Text style={[styles.sysBtnTitle, { color: '#be123c' }]}>خروج از حساب کاربری</Text>
                            <Text style={styles.sysBtnDesc}>قطع اتصال این فروشگاه از اپلیکیشن</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default SettingsScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { backgroundColor: '#ffffff', padding: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    headerSubtitle: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textAlign: 'right', marginTop: 4 },
    scrollContent: { padding: 16, paddingBottom: 100 },
    card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
    cardTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    sysBtn: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 5 },
    sysBtnIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center' },
    sysBtnTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
    sysBtnDesc: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },
});