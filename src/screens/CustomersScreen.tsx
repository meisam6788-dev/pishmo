import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
    TextInput, RefreshControl, Platform, Linking, Alert, Image, Share, Modal, ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createWooClient } from '../api/client';
import { useAppConfig } from '../store/appConfigStore';

import { CustomerProfileModal } from '../components/CustomerProfileModal';
import { WalletActionModal } from '../components/WalletActionModal';

type SegmentType = 'all' | 'vip' | 'loyal' | 'new' | 'at_risk' | 'hibernating';

export const CustomersScreen: React.FC = () => {
    const isDark = useAppConfig(state => state.isDarkMode);
    const theme = {
        bg: isDark ? '#0f172a' : '#f1f5f9',
        card: isDark ? '#1e293b' : '#ffffff',
        text: isDark ? '#f8fafc' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        input: isDark ? '#334155' : '#f8fafc',
        primary: '#10b981',
    };

    const [customers, setCustomers] = useState<any[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [activeSegment, setActiveSegment] = useState<SegmentType>('all');
    const [totalCustomersCount, setTotalCustomersCount] = useState(0);

    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [selectedProfileCustomer, setSelectedProfileCustomer] = useState<any>(null);
    const [profileInitialTab, setProfileInitialTab] = useState<'overview' | 'orders' | 'notes'>('overview');

    const [walletModalVisible, setWalletModalVisible] = useState(false);
    const [selectedWalletCustomer, setSelectedWalletCustomer] = useState<any>(null);
    const [messageMenuVisible, setMessageMenuVisible] = useState(false);
    const [selectedPhone, setSelectedPhone] = useState('');
    const [filterMenuVisible, setFilterMenuVisible] = useState(false);

    // استیت‌های مربوط به فیلتر پیشرفته
    const [minOrders, setMinOrders] = useState('');
    const [maxOrders, setMaxOrders] = useState('');
    const [minSpent, setMinSpent] = useState('');
    const [maxSpent, setMaxSpent] = useState('');
    const [daysFrom, setDaysFrom] = useState('');
    const [daysTo, setDaysTo] = useState('');

    const formatPrice = (price: number | string) => {
        const num = typeof price === 'string' ? parseFloat(price) : price;
        return isNaN(num) ? '۰' : Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const processCustomers = (rawData: any[]) => {
        const now = new Date().getTime();
        return rawData.map(c => {
            const totalSpent = parseFloat(c.total_spent || '0');
            const ordersCount = parseInt(c.orders_count || '0', 10);
            
            let segment: SegmentType = 'hibernating'; let badgeTitle = 'غیرفعال'; let badgeColor = '#64748b'; let badgeBg = isDark ? 'rgba(100, 116, 139, 0.15)' : '#f1f5f9';

            if (ordersCount >= 4 && totalSpent > 2000000) { segment = 'vip'; badgeTitle = '💎 الماس VIP'; badgeColor = '#8b5cf6'; badgeBg = isDark ? 'rgba(139, 92, 246, 0.15)' : '#f3e8ff'; }
            else if (ordersCount >= 2) { segment = 'loyal'; badgeTitle = '🥇 وفادار'; badgeColor = '#10b981'; badgeBg = isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7';}
            else if (ordersCount <= 1) { segment = 'new'; badgeTitle = '🌱 تازه‌وارد'; badgeColor = '#3b82f6'; badgeBg = isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe';}
            if (c.recencyDays > 90 && ordersCount >= 2) { segment = 'at_risk'; badgeTitle = '⚠️ در خطر ریزش'; badgeColor = '#ef4444'; badgeBg = isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2'; }

            return { ...c, totalSpent, ordersCount, segment, badgeTitle, badgeColor, badgeBg, notesCount: c.notes_count || 0 };
        });
    };

    const fetchCustomers = async (pageNum = 1, search = '', isRefresh = false) => {
        if (!isRefresh && pageNum === 1) setLoading(true);
        if (pageNum > 1) setLoadingMore(true);

        try {
            const client = createWooClient();
            
            // پارامترهای فیلتر پیشرفته برای ارسال به سرور
            const params: any = { page: pageNum, per_page: 50, search: search };
            if (minOrders) params.min_orders = minOrders;
            if (maxOrders) params.max_orders = maxOrders;
            if (minSpent) params.min_spent = minSpent;
            if (maxSpent) params.max_spent = maxSpent;
            if (daysFrom) params.days_from = daysFrom;
            if (daysTo) params.days_to = daysTo;

            const response = await client.get('pishmo/v1/crm', { params });
            const processed = processCustomers(response.data?.data || response.data || []);
            
            if (response.data?.total !== undefined) setTotalCustomersCount(response.data.total);

            let allData = processed;
            if (isRefresh || pageNum === 1) setCustomers(processed);
            else { allData = [...customers, ...processed]; setCustomers(allData); }

            applySegmentFilter(activeSegment, allData);
            setHasMore(processed.length === 50);
        } catch (error) { Alert.alert('خطا', 'در دریافت لیست مشتریان مشکلی پیش آمد.'); }
        finally { setLoading(false); setLoadingMore(false); setRefreshing(false); }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => { setPage(1); fetchCustomers(1, searchQuery); }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleRefresh = useCallback(() => { setRefreshing(true); setPage(1); fetchCustomers(1, searchQuery, true); }, [searchQuery, activeSegment]);

    const handleLoadMore = () => { if (!loading && !loadingMore && hasMore) { const nextPage = page + 1; setPage(nextPage); fetchCustomers(nextPage, searchQuery); } };

    const applySegmentFilter = (seg: SegmentType, dataList = customers) => {
        setActiveSegment(seg);
        if (seg === 'all') setFilteredCustomers(dataList);
        else setFilteredCustomers(dataList.filter(c => c.segment === seg));
        setFilterMenuVisible(false);
    };

    // تابع اعمال فیلتر پیشرفته
    const applyAdvancedFilters = () => {
        setFilterMenuVisible(false);
        setPage(1);
        fetchCustomers(1, searchQuery, true);
    };

    const clearAdvancedFilters = () => {
        setMinOrders(''); setMaxOrders(''); setMinSpent(''); setMaxSpent(''); setDaysFrom(''); setDaysTo('');
        setPage(1); fetchCustomers(1, searchQuery, true);
    };

    const exportToCSV = async () => { /* اکسل */ };
    const handleCall = (phone: string) => { if (phone) Linking.openURL(`tel:${phone}`); else Alert.alert('خطا', 'شماره ثبت نشده است.'); };
    const handleOpenApp = async (appType: string) => {
        if (!selectedPhone) return;
        let fPhone = selectedPhone.replace(/^0/, '+98').replace(/\D/g, ''); fPhone = fPhone.startsWith('98') ? '+' + fPhone : fPhone;
        setMessageMenuVisible(false);
        setTimeout(async () => {
            try {
                if (appType === 'sms') { const separator = Platform.OS === 'ios' ? '&' : '?'; await Linking.openURL(`sms:${separator}addresses=${selectedPhone}`); }
                else if (appType === 'whatsapp') { await Linking.openURL(`whatsapp://send?phone=${fPhone}`); }
                else if (appType === 'telegram') { await Linking.openURL(`https://t.me/${fPhone}`); }
            } catch (error) {}
        }, 300);
    };

    const renderCustomerItem = ({ item }: { item: any }) => {
        const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username || 'کاربر بدون نام';
        const phone = item.billing?.phone || item.phone || '';
        const city = item.billing?.city || 'شهر نامشخص';
        const avatar = item.avatar_url;

        return (
            <View style={[styles.customerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatarContainer}>
                        {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: theme.input }]}><Feather name="user" size={20} color={theme.textMuted} /></View>}
                    </View>
                    <View style={styles.customerInfo}>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 2 }}>
                            <Text style={[styles.customerName, { color: theme.text }]} numberOfLines={1}>{fullName}</Text>
                            <Text style={[styles.clubBadge, { color: item.badgeColor, backgroundColor: item.badgeBg, borderColor: item.badgeColor }]}>{item.badgeTitle}</Text>
                        </View>
                        <View style={styles.detailsRow}>
                            <Text style={[styles.customerPhone, { color: theme.textMuted }]}>{phone || 'بدون شماره'}</Text>
                            <Text style={{ color: theme.border, marginHorizontal: 6 }}>|</Text>
                            <Feather name="map-pin" size={10} color={theme.textMuted} style={{ marginLeft: 2 }} />
                            <Text style={[styles.customerCity, { color: theme.textMuted }]}>{city}</Text>
                        </View>
                    </View>
                </View>

                <View style={[styles.statsGrid, { backgroundColor: theme.input, borderColor: theme.border }]}>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: theme.text }]}>{item.ordersCount}</Text>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>سفارش</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: theme.text }]}>{formatPrice(item.totalSpent)} <Text style={{ fontSize: 9 }}>تومان</Text></Text>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>مجموع خرید</Text>
                    </View>
                </View>

                <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff' }]} onPress={() => handleCall(phone)}><Feather name="phone-call" size={18} color="#3b82f6" /></TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7' }]} onPress={() => { if (!phone) { Alert.alert('خطا', 'شماره‌ای نیست'); return; } setSelectedPhone(phone); setMessageMenuVisible(true); }}>
                        <Feather name="message-circle" size={18} color="#10b981" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', position: 'relative' }]} onPress={() => { setProfileInitialTab('notes'); setSelectedProfileCustomer(item); setProfileModalVisible(true); }}>
                        <Feather name="file-text" size={18} color="#f59e0b" />
                        {item.notesCount > 0 && (<View style={styles.noteCountBadge}><Text style={styles.noteCountTxt}>{item.notesCount}</Text></View>)}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.input }]} onPress={() => { setProfileInitialTab('overview'); setSelectedProfileCustomer(item); setProfileModalVisible(true); }}>
                        <Feather name="user" size={18} color={theme.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <View style={[styles.topBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <View style={[styles.searchContainer, { backgroundColor: theme.input, borderColor: theme.border }]}><Feather name="search" size={18} color={theme.textMuted} style={styles.searchIcon} /><TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="جستجوی نام یا موبایل..." placeholderTextColor={theme.textMuted} value={searchQuery} onChangeText={setSearchQuery} />{searchQuery.length > 0 && (<TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}><Feather name="x" size={16} color={theme.textMuted} /></TouchableOpacity>)}</View>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterMenuVisible(true)}><Feather name="filter" size={20} color="#fff" /></TouchableOpacity>
            </View>
            
            <View style={[styles.summaryBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.textMuted }}>تعداد کل مشتریان: <Text style={{ color: theme.text, fontSize: 14 }}>{totalCustomersCount}</Text> نفر</Text>
            </View>

            {loading && page === 1 ? (
                <View style={styles.centerContainer}><ActivityIndicator size="large" color={theme.primary} /><Text style={[styles.loadingTxt, { color: theme.textMuted }]}>در حال پردازش داده‌های CRM...</Text></View>
            ) : filteredCustomers.length === 0 ? (
                <View style={styles.centerContainer}><Feather name="users" size={48} color={theme.border} /><Text style={[styles.emptyTxt, { color: theme.textMuted }]}>مشتری یافت نشد!</Text></View>
            ) : (
                <FlatList
                    data={filteredCustomers}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderCustomerItem}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} />}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? (<View style={styles.footerLoader}><ActivityIndicator size="small" color={theme.primary} /></View>) : <View style={{ height: 40 }} />}
                />
            )}

            {/* --- منوی کشویی فیلتر (شامل LRFM و فیلترهای پیشرفته) --- */}
            <Modal visible={filterMenuVisible} transparent animationType="fade" onRequestClose={() => setFilterMenuVisible(false)}>
                <View style={{ flex: 1, flexDirection: 'row-reverse' }}>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setFilterMenuVisible(false)} />
                    <View style={[styles.drawerContainer, { backgroundColor: theme.card }]}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.drawerTitle, { color: theme.text }]}>فیلتر گروه‌ها</Text>
                            <TouchableOpacity style={[styles.drawerItem, activeSegment === 'all' && styles.drawerItemActive]} onPress={() => applySegmentFilter('all')}><Feather name="users" size={18} color={activeSegment === 'all' ? '#10b981' : theme.textMuted} /><Text style={[styles.drawerItemTxt, { color: activeSegment === 'all' ? '#10b981' : theme.text }]}>همه مشتریان</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.drawerItem, activeSegment === 'vip' && styles.drawerItemActive]} onPress={() => applySegmentFilter('vip')}><Text style={{ fontSize: 18 }}>💎</Text><Text style={[styles.drawerItemTxt, { color: activeSegment === 'vip' ? '#10b981' : theme.text }]}>الماس VIP</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.drawerItem, activeSegment === 'loyal' && styles.drawerItemActive]} onPress={() => applySegmentFilter('loyal')}><Text style={{ fontSize: 18 }}>🥇</Text><Text style={[styles.drawerItemTxt, { color: activeSegment === 'loyal' ? '#10b981' : theme.text }]}>وفادار</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.drawerItem, activeSegment === 'new' && styles.drawerItemActive]} onPress={() => applySegmentFilter('new')}><Text style={{ fontSize: 18 }}>🌱</Text><Text style={[styles.drawerItemTxt, { color: activeSegment === 'new' ? '#10b981' : theme.text }]}>تازه‌وارد</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.drawerItem, activeSegment === 'at_risk' && styles.drawerItemActive]} onPress={() => applySegmentFilter('at_risk')}><Text style={{ fontSize: 18 }}>⚠️</Text><Text style={[styles.drawerItemTxt, { color: activeSegment === 'at_risk' ? '#10b981' : theme.text }]}>در خطر ریزش</Text></TouchableOpacity>

                            <Text style={[styles.drawerTitle, { color: theme.text, marginTop: 30 }]}>فیلترهای پیشرفته</Text>
                            
                            <View style={styles.advFilterBox}>
                                <Text style={[styles.advLabel, { color: theme.textMuted }]}>تعداد خرید</Text>
                                <View style={styles.advRow}>
                                    <TextInput style={[styles.advInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="از" placeholderTextColor={theme.textMuted} keyboardType="numeric" value={minOrders} onChangeText={setMinOrders} />
                                    <TextInput style={[styles.advInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="تا" placeholderTextColor={theme.textMuted} keyboardType="numeric" value={maxOrders} onChangeText={setMaxOrders} />
                                </View>
                            </View>

                            <View style={styles.advFilterBox}>
                                <Text style={[styles.advLabel, { color: theme.textMuted }]}>مبلغ خرید (تومان)</Text>
                                <View style={styles.advRow}>
                                    <TextInput style={[styles.advInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="از" placeholderTextColor={theme.textMuted} keyboardType="numeric" value={minSpent} onChangeText={setMinSpent} />
                                    <TextInput style={[styles.advInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="تا" placeholderTextColor={theme.textMuted} keyboardType="numeric" value={maxSpent} onChangeText={setMaxSpent} />
                                </View>
                            </View>

                            <View style={styles.advFilterBox}>
                                <Text style={[styles.advLabel, { color: theme.textMuted }]}>روزهای گذشته از خرید</Text>
                                <View style={styles.advRow}>
                                    <TextInput style={[styles.advInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="از" placeholderTextColor={theme.textMuted} keyboardType="numeric" value={daysFrom} onChangeText={setDaysFrom} />
                                    <TextInput style={[styles.advInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="تا" placeholderTextColor={theme.textMuted} keyboardType="numeric" value={daysTo} onChangeText={setDaysTo} />
                                </View>
                            </View>

                            <TouchableOpacity style={styles.applyFilterBtn} onPress={applyAdvancedFilters}><Text style={styles.applyFilterTxt}>اعمال فیلتر پیشرفته</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.clearFilterBtn} onPress={clearAdvancedFilters}><Text style={[styles.clearFilterTxt, { color: theme.textMuted }]}>پاک کردن فیلترها</Text></TouchableOpacity>
                            
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={messageMenuVisible} animationType="slide" transparent onRequestClose={() => setMessageMenuVisible(false)}>
                <TouchableOpacity style={styles.bottomSheetOverlay} activeOpacity={1} onPress={() => setMessageMenuVisible(false)}>
                    <View style={[styles.bottomSheetContainer, { backgroundColor: theme.card }]}>
                        <View style={styles.bottomSheetDragHandle} />
                        <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>ارسال پیام به: {selectedPhone}</Text>
                        <TouchableOpacity style={[styles.appOptionBtn, { borderBottomColor: theme.border }]} onPress={() => handleOpenApp('whatsapp')}><Feather name="message-circle" size={22} color="#10b981" /><Text style={[styles.appOptionTxt, { color: theme.text }]}>ارسال در واتس‌اپ</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.appOptionBtn, { borderBottomColor: theme.border }]} onPress={() => handleOpenApp('telegram')}><Feather name="send" size={22} color="#3b82f6" /><Text style={[styles.appOptionTxt, { color: theme.text }]}>ارسال در تلگرام</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.appOptionBtn, { borderBottomColor: theme.border }]} onPress={() => handleOpenApp('sms')}><Feather name="message-square" size={22} color="#f59e0b" /><Text style={[styles.appOptionTxt, { color: theme.text }]}>پیامک عادی گوشی</Text></TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <CustomerProfileModal
                visible={profileModalVisible}
                onClose={() => { setProfileModalVisible(false); fetchCustomers(1, searchQuery, true); }}
                customer={selectedProfileCustomer}
                initialTab={profileInitialTab}
                onOpenWallet={(c) => { setProfileModalVisible(false); setSelectedWalletCustomer(c); setWalletModalVisible(true); }}
            />
            <WalletActionModal visible={walletModalVisible} onClose={() => setWalletModalVisible(false)} customer={selectedWalletCustomer} onSuccess={() => fetchCustomers(1, searchQuery, true)} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: { flexDirection: 'row-reverse', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, elevation: 1, gap: 10 },
    searchContainer: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 42 },
    searchIcon: { marginLeft: 8 },
    searchInput: { flex: 1, height: '100%', fontSize: 13, textAlign: 'right', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
    clearSearchBtn: { padding: 8 },
    filterBtn: { width: 42, height: 42, backgroundColor: '#10b981', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    summaryBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, alignItems: 'center' },
    
    drawerContainer: { width: 280, height: '100%', padding: 20, paddingTop: 40, elevation: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
    drawerTitle: { fontSize: 15, fontWeight: '900', marginBottom: 15, textAlign: 'right' },
    drawerItem: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'transparent' },
    drawerItemActive: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, paddingHorizontal: 10 },
    drawerItemTxt: { fontSize: 13, fontWeight: 'bold', marginRight: 15 },
    
    // استایل‌های فیلتر پیشرفته
    advFilterBox: { marginBottom: 15 },
    advLabel: { fontSize: 11, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
    advRow: { flexDirection: 'row-reverse', gap: 10 },
    advInput: { flex: 1, height: 40, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 12 },
    applyFilterBtn: { backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    applyFilterTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    clearFilterBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 5 },
    clearFilterTxt: { fontWeight: 'bold', fontSize: 12 },

    listContainer: { padding: 12 },
    customerCard: { borderRadius: 14, padding: 10, marginBottom: 10, borderWidth: 1, elevation: 0.5 },
    cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
    avatarContainer: { marginLeft: 10 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    customerInfo: { flex: 1, alignItems: 'flex-end' },
    customerName: { fontSize: 13, fontWeight: '900', textAlign: 'right' },
    clubBadge: { fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    detailsRow: { flexDirection: 'row-reverse', alignItems: 'center' },
    customerCity: { fontSize: 10, fontWeight: 'bold' },
    customerPhone: { fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
    statsGrid: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
    statBox: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 13, fontWeight: '900', marginBottom: 2 },
    statLabel: { fontSize: 9, fontWeight: 'bold' },
    statDivider: { width: 1, height: 25 },
    cardFooter: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 15, borderTopWidth: 1, paddingTop: 10, paddingBottom: 2 },
    actionBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    noteCountBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
    noteCountTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },
    bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheetContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    bottomSheetDragHandle: { width: 40, height: 4, backgroundColor: '#cbd5e1', borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
    bottomSheetTitle: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
    appOptionBtn: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
    appOptionTxt: { fontSize: 14, fontWeight: 'bold', marginRight: 15 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTxt: { marginTop: 12, fontSize: 13, fontWeight: 'bold' },
    emptyTxt: { marginTop: 12, fontSize: 14, fontWeight: 'bold' },
    footerLoader: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
});