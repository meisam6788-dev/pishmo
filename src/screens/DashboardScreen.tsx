import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
    RefreshControl, Dimensions, Modal, TextInput, Switch, Platform, Alert, Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWooClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useAppConfig } from '../store/appConfigStore';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');
type DateFilter = 'custom' | 'month' | 'week' | 'today';

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, paddingTop: Platform.OS === 'ios' ? 40 : 15, paddingHorizontal: 20, borderBottomWidth: 1, elevation: 1 },
    headerTitle: { fontSize: 20, fontWeight: '900', textAlign: 'right' },
    headerSubtitle: { fontSize: 11, fontWeight: 'bold', textAlign: 'right', maxWidth: 150 },
    iconBtn: { padding: 8, borderRadius: 10 },

    mediaRow: { flexDirection: 'row-reverse', paddingHorizontal: 16, marginTop: 15, gap: 10 },
    mediaBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, elevation: 2 },
    mediaBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 12, marginRight: 6 },

    loadingBox: { padding: 40, alignItems: 'center' },
    loadingTxt: { marginTop: 8, fontWeight: 'bold', fontSize: 12 },

    chartCard: { marginHorizontal: 16, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 16, marginTop: 15, borderWidth: 1, elevation: 1 },

    // 🚀 ایجاد گپ استاندارد بین فیلتر و دکمه رفرش
    filterRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15, gap: 8 },
    filterTabs: { flexDirection: 'row-reverse', flex: 1, borderRadius: 10, padding: 4, borderWidth: 1 },
    filterBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 3, borderRadius: 6 },
    filterBtnCustom: { flex: 0.6 },
    filterBtnActive: { backgroundColor: '#10b981' },
    filterTxt: { fontSize: 11, fontWeight: 'bold' },
    filterTxtActive: { color: '#ffffff' },
    refreshBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

    priceContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 15, position: 'relative' },
    priceSymbol: { fontSize: 13, fontWeight: 'bold', marginRight: 4, marginBottom: 4 },
    bigPriceTxt: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },

    statsRow: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    statItem: { alignItems: 'center', paddingHorizontal: 20 },
    statVal: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
    statLabel: { fontSize: 11, fontWeight: 'bold' },
    statDivider: { width: 1, height: 30 },
    tooltipBox: { backgroundColor: '#d1fae5', padding: 8, borderRadius: 8, alignSelf: 'center', marginTop: 10, borderWidth: 1, borderColor: '#34d399' },
    tooltipTxt: { fontSize: 11, color: '#064e3b', fontWeight: 'bold', textAlign: 'center' },
    updateTime: { textAlign: 'center', fontSize: 10, marginTop: 5, fontWeight: 'bold' },
    chartXLabel: { fontSize: 10, fontWeight: 'bold', marginTop: -5 },

    sectionTitle: { fontSize: 14, fontWeight: '900', textAlign: 'right', marginBottom: 12 },
    statusSection: { marginHorizontal: 16, marginBottom: 16 },
    statusCardsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    statusCard: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', marginHorizontal: 4 },
    statusCardNum: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
    statusCardLabel: { fontSize: 10, fontWeight: 'bold', textAlign: 'center' },

    recentOrdersBox: { marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, elevation: 1 },
    recentOrderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
    roName: { fontSize: 13, fontWeight: '900', textAlign: 'right' },
    roPrice: { fontSize: 14, fontWeight: '900', color: '#10b981', textAlign: 'left' },
    roDate: { fontSize: 11, textAlign: 'left', marginTop: 4, fontWeight: 'bold' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 20 },
    modalContainer: { borderRadius: 20, padding: 20, elevation: 5 },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 12, borderBottomWidth: 1 },
    modalTitle: { fontSize: 16, fontWeight: '900' },
    toggleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1 },
    toggleTxt: { fontSize: 13, fontWeight: 'bold' },
    btnApply: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    btnApplyTxt: { color: '#ffffff', fontWeight: '900', fontSize: 14 },
    dateInput: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, textAlign: 'center', fontSize: 14, fontWeight: 'bold' },
    slash: { fontSize: 18, fontWeight: 'bold', color: '#94a3b8', marginHorizontal: 6 }
});

const gregorianToJalali = (gy: number, gm: number, gd: number) => {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979; gy -= (gy <= 1600) ? 621 : 1600; const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053; jy += 4 * Math.floor(days / 1461); days %= 1461; jy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy, jm, jd };
};

const jalaliToGregorian = (jy: number, jm: number, jd: number) => {
    let gy = (jy <= 979) ? 621 : 1600; jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor((jy % 33) + 3) / 4 + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * Math.floor(days / 146097); days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
    gy += 4 * Math.floor(days / 1461); days %= 1461; gy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    let gd = days + 1;
    let sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm; for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
    return { gy, gm, gd };
};

const formatDateStandard = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DashboardScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const siteUrl = useAuthStore(state => state.siteUrl);
    const cleanSiteName = siteUrl ? siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'فروشگاه من';

    const isDark = useAppConfig(state => state.isDarkMode);
    const toggleDarkTheme = useAppConfig(state => state.toggleDarkMode);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState<DateFilter>('month');

    const [chartData, setChartData] = useState({ labels: [' '], datasets: [{ data: [0] }] });
    const [activeDaysList, setActiveDaysList] = useState<any[]>([]);
    const [selectedPoint, setSelectedPoint] = useState<any>(null);

    const [totalSales, setTotalSales] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const [lastUpdateTime, setLastUpdateTime] = useState('');

    const [processingCount, setProcessingCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);

    const [widgetModalVisible, setWidgetModalVisible] = useState(false);
    const [showChart, setShowChart] = useState(true);
    const [showStatus, setShowStatus] = useState(true);
    const [showRecentOrders, setShowRecentOrders] = useState(true);

    const currentDate = new Date();
    const currentJalali = gregorianToJalali(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());

    const [dateModal, setDateModal] = useState(false);
    const [startYear, setStartYear] = useState(currentJalali.jy.toString());
    const [startMonth, setStartMonth] = useState(currentJalali.jm.toString().padStart(2, '0'));
    const [startDay, setStartDay] = useState('01');
    const [endYear, setEndYear] = useState(currentJalali.jy.toString());
    const [endMonth, setEndMonth] = useState(currentJalali.jm.toString().padStart(2, '0'));
    const [endDay, setEndDay] = useState(currentJalali.jd.toString().padStart(2, '0'));

    const formatPrice = (price: number) => Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    const theme = {
        bg: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : '#ffffff',
        text: isDark ? '#f8fafc' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        input: isDark ? '#334155' : '#f8fafc',
    };

    useEffect(() => {
        const initPrefs = async () => {
            const savedFilter = await AsyncStorage.getItem('@pishmo_filter');
            const filterToUse = (savedFilter === 'week' || savedFilter === 'month' || savedFilter === 'today' || savedFilter === 'custom') ? savedFilter : 'month';
            setActiveFilter(filterToUse as DateFilter);

            const wChart = await AsyncStorage.getItem('@pishmo_w_chart'); if (wChart !== null) setShowChart(wChart === 'true');
            const wStatus = await AsyncStorage.getItem('@pishmo_w_status'); if (wStatus !== null) setShowStatus(wStatus === 'true');
            const wOrders = await AsyncStorage.getItem('@pishmo_w_orders'); if (wOrders !== null) setShowRecentOrders(wOrders === 'true');

            fetchData(filterToUse as DateFilter, false);
        };
        initPrefs();
    }, []);

    const fetchData = async (filter: DateFilter, isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setSelectedPoint(null);

        try {
            const client = createWooClient();
            let tSales = 0; let tOrders = 0; let daysTemplate: any[] = [];
            const todayDate = new Date(); const todayStr = formatDateStandard(todayDate);

            if (filter === 'today') {
                const afterDate = `${todayStr}T00:00:00Z`;
                const res = await client.get('orders', { params: { after: afterDate, per_page: 100 } });
                const orders = res.data || [];
                const hourlyData: { [key: number]: { sales: number, orders: number } } = {};

                orders.forEach((o: any) => {
                    if (o.status === 'completed' || o.status === 'processing' || o.status === 'on-hold') {
                        const orderDate = new Date(o.date_created);
                        const h = orderDate.getHours();
                        const orderTotal = parseFloat(o.total || 0);
                        if (!hourlyData[h]) hourlyData[h] = { sales: 0, orders: 0 };
                        hourlyData[h].sales += orderTotal; hourlyData[h].orders += 1;
                        tSales += orderTotal; tOrders += 1;
                    }
                });

                const sortedHours = Object.keys(hourlyData).map(Number).sort((a, b) => a - b);
                if (sortedHours.length === 0) { daysTemplate.push({ label: 'بدون خرید', jalaliDay: 'خالی', sales: 0, orders: 0 }); }
                else { sortedHours.forEach(h => { daysTemplate.push({ label: `${h}:00`, jalaliDay: `${h}:00`, sales: hourlyData[h].sales, orders: hourlyData[h].orders }); }); }
            }
            else {
                let dateMinStr = ''; let dateMaxStr = todayStr;
                if (filter === 'custom') {
                    const sG = jalaliToGregorian(parseInt(startYear, 10), parseInt(startMonth, 10), parseInt(startDay, 10));
                    const eG = jalaliToGregorian(parseInt(endYear, 10), parseInt(endMonth, 10), parseInt(endDay, 10));
                    let dMin = new Date(sG.gy, sG.gm - 1, sG.gd); let dMax = new Date(eG.gy, eG.gm - 1, eG.gd);
                    const todayNoTime = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
                    if (dMax > todayNoTime) dMax = todayNoTime; if (dMin > dMax) dMin = dMax;

                    dateMinStr = formatDateStandard(dMin); dateMaxStr = formatDateStandard(dMax);
                    let curr = new Date(dMin.getFullYear(), dMin.getMonth(), dMin.getDate());
                    while (curr <= dMax) {
                        const strG = formatDateStandard(curr); const j = gregorianToJalali(curr.getFullYear(), curr.getMonth() + 1, curr.getDate());
                        daysTemplate.push({ jalaliDay: j.jd.toString(), dateKey: strG, sales: 0, orders: 0 });
                        curr.setDate(curr.getDate() + 1);
                    }
                }
                else if (filter === 'month') {
                    const minG = jalaliToGregorian(currentJalali.jy, currentJalali.jm, 1);
                    dateMinStr = formatDateStandard(new Date(minG.gy, minG.gm - 1, minG.gd)); dateMaxStr = todayStr;
                    let curr = new Date(minG.gy, minG.gm - 1, minG.gd);
                    const todayNoTime = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
                    while (curr <= todayNoTime) {
                        const strG = formatDateStandard(curr); const j = gregorianToJalali(curr.getFullYear(), curr.getMonth() + 1, curr.getDate());
                        daysTemplate.push({ jalaliDay: j.jd.toString(), dateKey: strG, sales: 0, orders: 0 });
                        curr.setDate(curr.getDate() + 1);
                    }
                }
                else if (filter === 'week') {
                    const diffToSat = todayDate.getDay() === 6 ? 0 : todayDate.getDay() + 1;
                    const satDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - diffToSat);
                    dateMinStr = formatDateStandard(satDate); dateMaxStr = todayStr;
                    let curr = new Date(satDate.getFullYear(), satDate.getMonth(), satDate.getDate());
                    const todayNoTime = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
                    while (curr <= todayNoTime) {
                        const strG = formatDateStandard(curr); const j = gregorianToJalali(curr.getFullYear(), curr.getMonth() + 1, curr.getDate());
                        daysTemplate.push({ jalaliDay: j.jd.toString(), dateKey: strG, sales: 0, orders: 0 });
                        curr.setDate(curr.getDate() + 1);
                    }
                }

                try {
                    const salesRes = await client.get('reports/sales', { params: { date_min: dateMinStr, date_max: dateMaxStr } });
                    if (salesRes.data && salesRes.data.length > 0) {
                        const apiTotals = salesRes.data[0].totals || {};
                        daysTemplate.forEach(day => {
                            const dayData = apiTotals[day.dateKey];
                            if (dayData) {
                                day.sales = parseFloat(dayData.sales || 0); day.orders = parseInt(dayData.orders || 0, 10);
                                tSales += day.sales; tOrders += day.orders;
                            }
                        });
                    }
                } catch (apiError) { }
            }

            setActiveDaysList(daysTemplate); setTotalSales(tSales); setTotalOrders(tOrders);
            const now = new Date(); setLastUpdateTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);

            const salesData = daysTemplate.map(d => d.sales);

            // 🚀 الگوریتم هوشمند نمایش لیبل‌ها: استفاده از Space برای جلوگیری از باگ کتابخانه
            const labels = daysTemplate.map((d, index) => {
                const totalDays = daysTemplate.length;
                let step = Math.ceil(totalDays / 6);
                if (filter === 'today') {
                    step = Math.ceil(totalDays / 5);
                }

                // اگر روز اول، روز آخر، یا مضربی از قدم (Step) بود، آن را نشان بده
                if (index === 0 || index === totalDays - 1 || index % step === 0) {
                    return d.jalaliDay;
                }
                // در غیر این صورت یک فاصله بفرست تا نقاط چارت سر جای خودشان بمانند
                return ' ';
            });

            if (salesData.length === 0 || salesData.every(val => val === 0)) {
                setChartData({ labels: [' ', 'ابتدای دوره', 'امروز'], datasets: [{ data: [0, 0, 0] }] });
            } else {
                setChartData({ labels, datasets: [{ data: salesData }] });
            }

            Promise.all([
                client.get('reports/orders/totals').catch(() => null),
                client.get('orders', { params: { status: 'processing', per_page: 3, orderby: 'date', order: 'desc' } }).catch(() => null)
            ]).then(([totalsRes, procRes]) => {
                if (totalsRes && totalsRes.data) {
                    setProcessingCount(totalsRes.data.find((t: any) => t.slug === 'processing')?.total || 0);
                    setPendingCount(totalsRes.data.find((t: any) => t.slug === 'pending')?.total || 0);
                }
                if (procRes && procRes.data) setRecentOrders(procRes.data);
            });

        } catch (error) { console.log(error); } finally { setLoading(false); setRefreshing(false); }
    };

    const handleFilterChange = async (filter: DateFilter) => {
        if (filter === 'custom') { setDateModal(true); }
        else { setActiveFilter(filter); await AsyncStorage.setItem('@pishmo_filter', filter); fetchData(filter, false); }
    };

    const fetchCustomDateData = async () => {
        if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) { Alert.alert('خطا', 'لطفاً تاریخ را کامل وارد کنید.'); return; }
        setDateModal(false); setActiveFilter('custom'); await AsyncStorage.setItem('@pishmo_filter', 'custom'); fetchData('custom', false);
    };

    const toggleWidget = async (widget: string, value: boolean) => {
        if (widget === 'chart') { setShowChart(value); await AsyncStorage.setItem('@pishmo_w_chart', String(value)); }
        if (widget === 'status') { setShowStatus(value); await AsyncStorage.setItem('@pishmo_w_status', String(value)); }
        if (widget === 'orders') { setShowRecentOrders(value); await AsyncStorage.setItem('@pishmo_w_orders', String(value)); }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                    <TouchableOpacity style={{ flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: theme.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.border }}>
                        <Text style={[styles.headerTitle, { color: theme.text, fontSize: 14 }]}>{cleanSiteName}</Text>
                        <Feather name="chevron-down" size={16} color={theme.textMuted} style={{ marginRight: 6 }} />
                    </TouchableOpacity>
                    <Text style={[styles.headerSubtitle, { color: theme.textMuted, marginTop: 4 }]} numberOfLines={1}>نسخه پیشمو پرو 👑</Text>
                </View>

                <View style={{ flexDirection: 'row-reverse' }}>
                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.input, borderColor: theme.border, borderWidth: 1, marginLeft: 8 }]} onPress={() => toggleDarkTheme(!isDark)}>
                        <Feather name={isDark ? "sun" : "moon"} size={18} color={isDark ? "#f59e0b" : "#64748b"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.input, borderColor: theme.border, borderWidth: 1, marginLeft: 8 }]} onPress={() => setWidgetModalVisible(true)}>
                        <Feather name="sliders" size={18} color="#10b981" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(activeFilter, true)} colors={['#10b981']} />}>

                <View style={styles.mediaRow}>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('StoryCreator')} style={{ flex: 1 }}>
                        <LinearGradient colors={['#f9ce34', '#ee2a7b', '#6228d7']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.mediaBtn}>
                            <Text style={styles.mediaBtnTxt}>استوری‌ساز <Feather name="instagram" size={13} color="#ffffff" /></Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => Alert.alert('به زودی...', 'بخش جذاب ریلز در آپدیت‌های بعدی فعال خواهد شد.')} style={{ flex: 1 }}>
                        <LinearGradient colors={isDark ? ['#334155', '#1e293b'] : ['#94a3b8', '#64748b']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.mediaBtn}>
                            <Text style={styles.mediaBtnTxt}>ریـلز (به زودی) <Feather name="video" size={13} color="#ffffff" /></Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}><ActivityIndicator size="large" color="#10b981" /><Text style={[styles.loadingTxt, { color: theme.textMuted }]}>در حال آماده‌سازی...</Text></View>
                ) : (
                    <>
                        {showChart && (
                            <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                {/* 🚀 هدر نمودار حذف شد و فقط نوار فیلتر و رفرش قرار گرفت */}
                                <View style={styles.filterRow}>
                                    <View style={[styles.filterTabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <TouchableOpacity style={[styles.filterBtn, styles.filterBtnCustom, activeFilter === 'custom' && styles.filterBtnActive]} onPress={() => handleFilterChange('custom')}>
                                            <Feather name="calendar" size={14} color={activeFilter === 'custom' ? '#fff' : theme.textMuted} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.filterBtn, activeFilter === 'today' && styles.filterBtnActive]} onPress={() => handleFilterChange('today')}><Text style={[styles.filterTxt, { color: theme.textMuted }, activeFilter === 'today' && styles.filterTxtActive]}>امروز</Text></TouchableOpacity>
                                        <TouchableOpacity style={[styles.filterBtn, activeFilter === 'week' && styles.filterBtnActive]} onPress={() => handleFilterChange('week')}><Text style={[styles.filterTxt, { color: theme.textMuted }, activeFilter === 'week' && styles.filterTxtActive]}>هفته</Text></TouchableOpacity>
                                        <TouchableOpacity style={[styles.filterBtn, activeFilter === 'month' && styles.filterBtnActive]} onPress={() => handleFilterChange('month')}><Text style={[styles.filterTxt, { color: theme.textMuted }, activeFilter === 'month' && styles.filterTxtActive]}>ماه</Text></TouchableOpacity>
                                    </View>

                                    <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: theme.input, borderColor: theme.border }]} onPress={() => fetchData(activeFilter, true)}>
                                        <Feather name="refresh-cw" size={14} color="#10b981" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.priceContainer}>
                                    <Text style={[styles.priceSymbol, { color: theme.textMuted }]}>تومان</Text>
                                    <Text style={[styles.bigPriceTxt, { color: theme.text }]}>{formatPrice(totalSales)}</Text>
                                </View>

                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}><Text style={[styles.statVal, { color: theme.text }]}>{totalOrders}</Text><Text style={[styles.statLabel, { color: theme.textMuted }]}>تعداد سفارش</Text></View>
                                    <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                                    <View style={styles.statItem}><Feather name="bar-chart-2" size={20} color="#10b981" /><Text style={[styles.statLabel, { color: theme.textMuted }]}>فروش کل</Text></View>
                                </View>

                                <Text style={[styles.updateTime, { color: theme.textMuted }]}>آخرین بروزرسانی: {lastUpdateTime} 🕒</Text>

                                {selectedPoint && (
                                    <View style={[styles.tooltipBox, isDark && { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981' }]}>
                                        <Text style={[styles.tooltipTxt, isDark && { color: '#10b981' }]}>
                                            {selectedPoint.jalaliDay === 'بازه انتخابی' ? 'بازه انتخابی' : (activeFilter === 'today' ? `ساعت ${selectedPoint.jalaliDay}` : `روز ${selectedPoint.jalaliDay}`)} : <Text style={{ color: '#10b981', fontWeight: '900' }}>{formatPrice(selectedPoint.sales)} تومان</Text> ({selectedPoint.orders} خرید)
                                        </Text>
                                    </View>
                                )}

                                <View style={{ marginTop: 10, alignItems: 'center', marginLeft: -15 }}>
                                    {/* 🚀 ارتفاع نمودار به 160 افزایش یافت تا اعداد زیر آن بریده نشوند */}
                                    <LineChart
                                        data={chartData} width={width - 20} height={160} yAxisLabel="" yAxisSuffix=""
                                        withDots={true} withInnerLines={true} withOuterLines={false} withVerticalLines={false}
                                        onDataPointClick={({ index }) => setSelectedPoint(activeDaysList[index])}
                                        chartConfig={{
                                            backgroundColor: theme.card, backgroundGradientFrom: theme.card, backgroundGradientTo: theme.card, decimalPlaces: 0,
                                            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, labelColor: (opacity = 1) => isDark ? `rgba(148, 163, 184, ${opacity})` : `rgba(100, 116, 139, ${opacity})`,
                                            style: { borderRadius: 16 }, propsForBackgroundLines: { strokeWidth: 1, stroke: theme.border, strokeDasharray: '' },
                                            propsForLabels: { fontSize: 10, fontWeight: 'bold' }
                                        }}
                                        bezier style={{ marginVertical: 8, borderRadius: 16 }}
                                        formatYLabel={(y) => {
                                            const num = parseInt(y, 10);
                                            if (isNaN(num) || num === 0) return '0';
                                            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
                                            if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
                                            return num.toString();
                                        }}
                                        hidePointsAtIndex={[]}
                                    />
                                    <Text style={[styles.chartXLabel, { color: theme.textMuted }]}>{activeFilter === 'today' ? 'بازه زمانی (ساعتی)' : 'بازه زمانی (روزانه)'}</Text>
                                </View>
                            </View>
                        )}

                        {showStatus && (
                            <View style={styles.statusSection}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>وضعیت سریع سفارشات</Text>
                                <View style={styles.statusCardsRow}>
                                    <TouchableOpacity style={[styles.statusCard, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#eff6ff', borderColor: isDark ? '#1e40af' : '#bfdbfe' }]} onPress={() => navigation.navigate('OrdersTab', { targetStatus: 'processing' })}>
                                        <Text style={[styles.statusCardNum, { color: '#3b82f6' }]}>{processingCount}</Text>
                                        <Text style={[styles.statusCardLabel, { color: isDark ? '#93c5fd' : '#1e40af' }]}>در حال انجام</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.statusCard, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.1)' : '#fef3c7', borderColor: isDark ? '#b45309' : '#fde68a' }]} onPress={() => navigation.navigate('OrdersTab', { targetStatus: 'pending' })}>
                                        <Text style={[styles.statusCardNum, { color: '#f59e0b' }]}>{pendingCount}</Text>
                                        <Text style={[styles.statusCardLabel, { color: isDark ? '#fcd34d' : '#b45309' }]}>در انتظار پرداخت</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {showRecentOrders && (
                            <View style={[styles.recentOrdersBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                                    <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>📦 جدیدترین سفارشات</Text>
                                    <TouchableOpacity onPress={() => navigation.navigate('OrdersTab', { targetStatus: 'processing' })}><Text style={{ fontSize: 11, color: '#10b981', fontWeight: 'bold' }}>مشاهده همه</Text></TouchableOpacity>
                                </View>
                                {recentOrders.length === 0 ? <Text style={{ textAlign: 'center', fontSize: 12, color: theme.textMuted, marginVertical: 10 }}>سفارشی وجود ندارد.</Text> : (
                                    recentOrders.map((order, index) => {
                                        return (
                                            <View key={order.id} style={[styles.recentOrderRow, { borderBottomColor: theme.border }, index === recentOrders.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}>
                                                <View><Text style={styles.roPrice}>{formatPrice(parseFloat(order.total || 0))} تومان</Text><Text style={[styles.roDate, { color: theme.textMuted }]}># {order.id}</Text></View>
                                                <View style={{ alignItems: 'flex-end' }}><Text style={[styles.roName, { color: theme.text }]}>{order.billing?.first_name} {order.billing?.last_name}</Text></View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            <Modal visible={widgetModalVisible} animationType="slide" transparent onRequestClose={() => setWidgetModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>⚙️ مدیریت ویجت‌ها</Text>
                            <TouchableOpacity onPress={() => setWidgetModalVisible(false)}><Feather name="x" size={24} color={theme.textMuted} /></TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: '70%' }} showsVerticalScrollIndicator={false}>
                            <View style={[styles.toggleRow, { backgroundColor: theme.input, borderColor: theme.border }]}><Switch value={showChart} onValueChange={(val) => toggleWidget('chart', val)} thumbColor="#fff" trackColor={{ true: '#10b981', false: '#cbd5e1' }} /><Text style={[styles.toggleTxt, { color: theme.text }]}>نمودار گرافیکی فروش</Text></View>
                            <View style={[styles.toggleRow, { backgroundColor: theme.input, borderColor: theme.border }]}><Switch value={showStatus} onValueChange={(val) => toggleWidget('status', val)} thumbColor="#fff" trackColor={{ true: '#10b981', false: '#cbd5e1' }} /><Text style={[styles.toggleTxt, { color: theme.text }]}>کارت‌های وضعیت سریع</Text></View>
                            <View style={[styles.toggleRow, { backgroundColor: theme.input, borderColor: theme.border }]}><Switch value={showRecentOrders} onValueChange={(val) => toggleWidget('orders', val)} thumbColor="#fff" trackColor={{ true: '#10b981', false: '#cbd5e1' }} /><Text style={[styles.toggleTxt, { color: theme.text }]}>جدیدترین سفارشات</Text></View>
                        </ScrollView>
                        <TouchableOpacity style={styles.btnApply} onPress={() => setWidgetModalVisible(false)}><Text style={styles.btnApplyTxt}>تایید و ذخیره</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={dateModal} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
                        <Text style={{ fontSize: 16, fontWeight: '900', textAlign: 'right', marginBottom: 20, color: theme.text }}>انتخاب تاریخ شمسی</Text>

                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.textMuted, textAlign: 'right', marginBottom: 8 }}>شروع:</Text>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20 }}>
                            <TextInput style={[styles.dateInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]} placeholder="روز" placeholderTextColor={theme.textMuted} value={startDay} onChangeText={setStartDay} keyboardType="numeric" maxLength={2} />
                            <Text style={styles.slash}>/</Text>
                            <TextInput style={[styles.dateInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]} placeholder="ماه" placeholderTextColor={theme.textMuted} value={startMonth} onChangeText={setStartMonth} keyboardType="numeric" maxLength={2} />
                            <Text style={styles.slash}>/</Text>
                            <TextInput style={[styles.dateInput, { flex: 1.5, backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]} placeholder="سال" placeholderTextColor={theme.textMuted} value={startYear} onChangeText={setStartYear} keyboardType="numeric" maxLength={4} />
                        </View>

                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.textMuted, textAlign: 'right', marginBottom: 8 }}>پایان:</Text>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 30 }}>
                            <TextInput style={[styles.dateInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]} placeholder="روز" placeholderTextColor={theme.textMuted} value={endDay} onChangeText={setEndDay} keyboardType="numeric" maxLength={2} />
                            <Text style={styles.slash}>/</Text>
                            <TextInput style={[styles.dateInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]} placeholder="ماه" placeholderTextColor={theme.textMuted} value={endMonth} onChangeText={setEndMonth} keyboardType="numeric" maxLength={2} />
                            <Text style={styles.slash}>/</Text>
                            <TextInput style={[styles.dateInput, { flex: 1.5, backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]} placeholder="سال" placeholderTextColor={theme.textMuted} value={endYear} onChangeText={setEndYear} keyboardType="numeric" maxLength={4} />
                        </View>

                        <TouchableOpacity style={styles.btnApply} onPress={fetchCustomDateData}><Text style={styles.btnApplyTxt}>دریافت گزارش</Text></TouchableOpacity>
                        <TouchableOpacity style={{ padding: 14, alignItems: 'center', marginTop: 5 }} onPress={() => setDateModal(false)}><Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>انصراف</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export { DashboardScreen };
export default DashboardScreen;