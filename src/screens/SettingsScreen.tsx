import React from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useAppConfig } from '../store/appConfigStore';

export const SettingsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const logout = useAuthStore(state => state.logout);
    const { isProUser, setProUser } = useAppConfig();

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

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>⚙️ تنظیمات و امکانات</Text>
                <Text style={styles.headerSubtitle}>مدیریت ابزارها، لایسنس و حافظه</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* 🚀 کادرهای جدید: باشگاه مشتریان و CRM */}
                <View style={styles.card}>
                    <Text style={[styles.cardTitle, { marginBottom: 15 }]}>امکانات ویژه و مدیریت مشتریان</Text>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                        
                        <TouchableOpacity 
                            activeOpacity={0.8} 
                            onPress={() => navigation.navigate('CustomerClub')} 
                            style={styles.featureBtnGold}
                        >
                            <View style={styles.featureIconGold}>
                                <Feather name="gift" size={24} color="#d97706" />
                            </View>
                            <Text style={styles.featureBtnTitleGold}>باشگاه مشتریان</Text>
                            <Text style={styles.featureBtnDescGold}>سطح‌بندی و امتیازات</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            activeOpacity={0.8} 
                            onPress={() => navigation.navigate('Customers')} 
                            style={styles.featureBtnBlue}
                        >
                            <View style={styles.featureIconBlue}>
                                <Feather name="users" size={24} color="#2563eb" />
                            </View>
                            <Text style={styles.featureBtnTitleBlue}>سیستم CRM</Text>
                            <Text style={styles.featureBtnDescBlue}>تحلیل رفتار خریدار</Text>
                        </TouchableOpacity>

                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: '#fefce8', borderColor: '#fde047' }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                            <Feather name="star" size={20} color="#ca8a04" style={{ marginLeft: 8 }} />
                            <Text style={[styles.cardTitle, { color: '#854d0e' }]}>نسخه حرفه‌ای (Pro)</Text>
                        </View>
                        <Switch value={isProUser} onValueChange={setProUser} thumbColor="#fff" trackColor={{ true: '#eab308', false: '#cbd5e1' }} />
                    </View>
                    <Text style={{ fontSize: 11, color: '#a16207', textAlign: 'right', fontWeight: 'bold' }}>
                        با فعال‌سازی این گزینه، محدودیت‌های ثبت دستی سفارشات، انتخاب تاریخ دلخواه و ابزارهای پیشرفته برداشته می‌شود.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={[styles.cardTitle, { marginBottom: 15 }]}>ابزارهای نگهداری</Text>
                    
                    <TouchableOpacity style={styles.sysBtn} onPress={clearAppCache}>
                        <View style={styles.sysBtnIcon}><Feather name="trash-2" size={20} color="#f59e0b" /></View>
                        <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 15 }}>
                            <Text style={styles.sysBtnTitle}>پاکسازی حافظه کش (Cache)</Text>
                            <Text style={styles.sysBtnDesc}>رفع کندی و مشکلات گرافیکی احتمالی</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.sysBtn, { borderBottomWidth: 0, marginBottom: 0 }]} onPress={() => logout()}>
                        <View style={[styles.sysBtnIcon, { backgroundColor: '#ffe4e6' }]}><Feather name="log-out" size={20} color="#e11d48" /></View>
                        <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 15 }}>
                            <Text style={[styles.sysBtnTitle, { color: '#be123c' }]}>خروج کامل از حساب کاربری</Text>
                            <Text style={styles.sysBtnDesc}>قطع اتصال سایت از اپلیکیشن</Text>
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
    cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    cardTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    sysBtn: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 5 },
    sysBtnIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center' },
    sysBtnTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
    sysBtnDesc: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },

    // 🚀 استایل دکمه‌های امکانات
    featureBtnGold: { width: '48%', backgroundColor: '#fefce8', paddingVertical: 20, paddingHorizontal: 10, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#fde047', elevation: 1 },
    featureIconGold: { backgroundColor: '#fef3c7', width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    featureBtnTitleGold: { color: '#b45309', fontWeight: '900', fontSize: 13, marginBottom: 4 },
    featureBtnDescGold: { color: '#d97706', fontSize: 10, fontWeight: 'bold' },

    featureBtnBlue: { width: '48%', backgroundColor: '#eff6ff', paddingVertical: 20, paddingHorizontal: 10, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe', elevation: 1 },
    featureIconBlue: { backgroundColor: '#dbeafe', width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    featureBtnTitleBlue: { color: '#1d4ed8', fontWeight: '900', fontSize: 13, marginBottom: 4 },
    featureBtnDescBlue: { color: '#3b82f6', fontSize: 10, fontWeight: 'bold' },
});