import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
    TextInput, RefreshControl, Platform, Linking, Alert, KeyboardAvoidingView, Image, Share, Modal, ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWooClient } from '../api/client';
import { useAppConfig } from '../store/appConfigStore';

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

    const [notes, setNotes] = useState<Record<string, string>>({});
    const [noteModalVisible, setNoteModalVisible] = useState(false);
    const [selectedCustomerForNote, setSelectedCustomerForNote] = useState<any>(null);
    const [currentNoteText, setCurrentNoteText] = useState('');

    const formatPrice = (price: number | string) => {
        const num = typeof price === 'string' ? parseFloat(price) : price;
        return isNaN(num) ? '۰' : Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    useEffect(() => {
        const loadNotes = async () => {
            const savedNotes = await AsyncStorage.getItem('@pishmo_crm_notes');
            if (savedNotes) setNotes(JSON.parse(savedNotes));
        };
        loadNotes();
    }, []);

    const processCustomers = (rawData: any[]) => {
        const now = new Date().getTime();
        return rawData.map(c => {
            const totalSpent = parseFloat(c.total_spent || '0');
            const ordersCount = parseInt(c.orders_count || '0', 10);

            const lastOrderDate = c.date_last_order ? new Date(c.date_last_order).getTime() : new Date(c.date_registered || Date.now()).getTime();
            const recencyDays = Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24));

            let segment: SegmentType = 'hibernating';
            let badgeTitle = 'غیرفعال';
            let badgeColor = '#64748b';

            if (ordersCount >= 4 && totalSpent > 2000000) { segment = 'vip'; badgeTitle = '💎 الماس VIP'; badgeColor = '#8b5cf6'; }
            else if (ordersCount >= 2 && recencyDays <= 90) { segment = 'loyal'; badgeTitle = '🥇 وفادار'; badgeColor = '#10b981'; }
            else if (ordersCount <= 1 && recencyDays <= 30) { segment = 'new'; badgeTitle = '🌱 تازه‌وارد'; badgeColor = '#3b82f6'; }
            else if (ordersCount >= 2 && recencyDays > 90) { segment = 'at_risk'; badgeTitle = '⚠️ در خطر ریزش'; badgeColor = '#ef4444'; }

            return { ...c, totalSpent, ordersCount, recencyDays, segment, badgeTitle, badgeColor };
        });
    };

    const fetchCustomers = async (pageNum = 1, search = '', isRefresh = false) => {
        if (!isRefresh && pageNum === 1) setLoading(true);
        if (pageNum > 1) setLoadingMore(true);

        try {
            const client = createWooClient();
            // 🚀 دریافت مستقیم از موتور CRM اختصاصی پیشمو
            const response = await client.get('pishmo/v1/crm', {
                params: { page: pageNum, per_page: 20, search: search }
            });

            const processed = processCustomers(response.data || []);

            let allData = processed;
            if (isRefresh || pageNum === 1) {
                setCustomers(processed);
            } else {
                allData = [...customers, ...processed];
                setCustomers(allData);
            }

            applySegmentFilter(activeSegment, allData);
            setHasMore(response.data && response.data.length === 20);
        } catch (error) { Alert.alert('خطا', 'در دریافت لیست مشتریان مشکلی پیش آمد.'); }
        finally { setLoading(false); setLoadingMore(false); setRefreshing(false); }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => { setPage(1); fetchCustomers(1, searchQuery); }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleRefresh = useCallback(() => { setRefreshing(true); setPage(1); fetchCustomers(1, searchQuery, true); }, [searchQuery, activeSegment]);

    const handleLoadMore = () => {
        if (!loading && !loadingMore && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchCustomers(nextPage, searchQuery);
        }
    };

    const applySegmentFilter = (seg: SegmentType, dataList = customers) => {
        setActiveSegment(seg);
        if (seg === 'all') setFilteredCustomers(dataList);
        else setFilteredCustomers(dataList.filter(c => c.segment === seg));
    };

    const exportToCSV = async () => {
        if (customers.length === 0) { Alert.alert('خطا', 'لیست مشتریان خالی است.'); return; }
        try {
            let csvData = 'نام مشتری,شماره موبایل,شهر,تعداد سفارش,مجموع خرید (تومان),دسته بندی\n';
            customers.forEach(c => {
                const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || 'بدون نام';
                const phone = c.billing?.phone || 'ندارد';
                const city = c.billing?.city || 'نامشخص';
                csvData += `${name},${phone},${city},${c.ordersCount},${c.totalSpent},${c.badgeTitle}\n`;
            });
            await Share.share({ title: 'خروجی مشتریان', message: csvData });
        } catch (error) { Alert.alert('خطا', 'مشکلی در خروجی گرفتن پیش آمد.'); }
    };

    const openNoteModal = (customer: any) => {
        setSelectedCustomerForNote(customer);
        setCurrentNoteText(notes[customer.id.toString()] || '');
        setNoteModalVisible(true);
    };

    const saveNote = async () => {
        if (!selectedCustomerForNote) return;
        const newNotes = { ...notes, [selectedCustomerForNote.id.toString()]: currentNoteText };
        setNotes(newNotes);
        await AsyncStorage.setItem('@pishmo_crm_notes', JSON.stringify(newNotes));
        setNoteModalVisible(false);
    };

    const handleCall = (phone: string) => { if (phone) Linking.openURL(`tel:${phone}`); else Alert.alert('خطا', 'شماره‌ای ثبت نشده است.'); };
    const handleSMS = (phone: string) => { if (phone) Linking.openURL(`sms:${phone}`); else Alert.alert('خطا', 'شماره‌ای ثبت نشده است.'); };
    const handleWhatsApp = (phone: string) => {
        if (!phone) { Alert.alert('خطا', 'شماره‌ای ثبت نشده است.'); return; }
        let fPhone = phone.replace(/^0/, '+98').replace(/\D/g, '');
        fPhone = fPhone.startsWith('98') ? '+' + fPhone : fPhone;
        Linking.openURL(`whatsapp://send?phone=${fPhone}`).catch(() => Alert.alert('خطا', 'واتس‌اپ نصب نیست.'));
    };

    const renderCustomerItem = ({ item }: { item: any }) => {
        const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username || 'کاربر بدون نام';
        const phone = item.billing?.phone || '';
        const city = item.billing?.city || 'شهر نامشخص';
        const avatar = item.avatar_url;
        const hasNote = !!notes[item.id.toString()];

        return (
            <View style={[styles.customerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatarContainer}>
                        {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: theme.input }]}><Feather name="user" size={24} color={theme.textMuted} /></View>}
                        {hasNote && <View style={styles.noteBadgeIndicator}><Feather name="file-text" size={10} color="#fff" /></View>}
                    </View>
                    <View style={styles.customerInfo}>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 4 }}>
                            <Text style={[styles.customerName, { color: theme.text }]} numberOfLines={1}>{fullName}</Text>
                            <Text style={[styles.clubBadge, { color: item.badgeColor, backgroundColor: isDark ? 'transparent' : `${item.badgeColor}15`, borderColor: item.badgeColor }]}>{item.badgeTitle}</Text>
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
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>تعداد سفارش</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: theme.text }]}>{formatPrice(item.totalSpent)} <Text style={{ fontSize: 9 }}>تومان</Text></Text>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>مجموع خرید</Text>
                    </View>
                </View>

                <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff' }]} onPress={() => handleCall(phone)}>
                        <Feather name="phone-call" size={14} color="#3b82f6" />
                        <Text style={[styles.actionBtnTxt, { color: '#3b82f6' }]}>تماس</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7', marginHorizontal: 6 }]} onPress={() => handleWhatsApp(phone)}>
                        <Feather name="message-circle" size={14} color="#10b981" />
                        <Text style={[styles.actionBtnTxt, { color: '#10b981' }]}>واتس‌اپ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', marginRight: 6 }]} onPress={() => handleSMS(phone)}>
                        <Feather name="mail" size={14} color="#f59e0b" />
                        <Text style={[styles.actionBtnTxt, { color: '#f59e0b' }]}>پیامک</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.input, flex: 0.7 }]} onPress={() => openNoteModal(item)}>
                        <Feather name="edit-3" size={14} color={theme.textMuted} />
                        <Text style={[styles.actionBtnTxt, { color: theme.textMuted }]}>یادداشت</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <View style={[styles.topBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <View style={[styles.searchContainer, { backgroundColor: theme.input, borderColor: theme.border }]}>
                    <Feather name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
                    <TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="جستجوی نام یا موبایل..." placeholderTextColor={theme.textMuted} value={searchQuery} onChangeText={setSearchQuery} />
                    {searchQuery.length > 0 && (<TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}><Feather name="x" size={16} color={theme.textMuted} /></TouchableOpacity>)}
                </View>
                <TouchableOpacity style={styles.exportBtn} onPress={exportToCSV}>
                    <Feather name="download" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: theme.card, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegment === 'all' && styles.segmentChipActive]} onPress={() => applySegmentFilter('all')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegment === 'all' && styles.segmentChipTxtActive]}>همه</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegment === 'vip' && styles.segmentChipActive]} onPress={() => applySegmentFilter('vip')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegment === 'vip' && styles.segmentChipTxtActive]}>💎 الماس VIP</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegment === 'loyal' && styles.segmentChipActive]} onPress={() => applySegmentFilter('loyal')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegment === 'loyal' && styles.segmentChipTxtActive]}>🥇 وفادار</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegment === 'new' && styles.segmentChipActive]} onPress={() => applySegmentFilter('new')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegment === 'new' && styles.segmentChipTxtActive]}>🌱 تازه‌وارد</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegment === 'at_risk' && styles.segmentChipActive]} onPress={() => applySegmentFilter('at_risk')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegment === 'at_risk' && styles.segmentChipTxtActive]}>⚠️ در خطر</Text></TouchableOpacity>
                </ScrollView>
            </View>

            {loading && page === 1 ? (
                <View style={styles.centerContainer}><ActivityIndicator size="large" color={theme.primary} /><Text style={[styles.loadingTxt, { color: theme.textMuted }]}>در حال پردازش داده‌های CRM...</Text></View>
            ) : filteredCustomers.length === 0 ? (
                <View style={styles.centerContainer}><Feather name="users" size={48} color={theme.border} /><Text style={[styles.emptyTxt, { color: theme.textMuted }]}>هیچ مشتری یافت نشد!</Text></View>
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
                    ListFooterComponent={loadingMore ? (<View style={styles.footerLoader}><ActivityIndicator size="small" color={theme.primary} /></View>) : <View style={{ height: 80 }} />}
                />
            )}

            <Modal visible={noteModalVisible} animationType="fade" transparent onRequestClose={() => setNoteModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>📝 یادداشت مشتری</Text>
                            <TouchableOpacity onPress={() => setNoteModalVisible(false)}><Feather name="x" size={24} color={theme.textMuted} /></TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.noteInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]}
                            placeholder="مثال: مشتری خوش‌حساب..."
                            placeholderTextColor={theme.textMuted}
                            multiline
                            textAlignVertical="top"
                            value={currentNoteText}
                            onChangeText={setCurrentNoteText}
                        />
                        <TouchableOpacity style={styles.saveNoteBtn} onPress={saveNote}>
                            <Text style={styles.saveNoteBtnTxt}>ذخیره یادداشت</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: { flexDirection: 'row-reverse', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, elevation: 1, gap: 10 },
    searchContainer: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
    searchIcon: { marginLeft: 8 },
    searchInput: { flex: 1, height: '100%', fontSize: 13, textAlign: 'right', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
    clearSearchBtn: { padding: 8 },
    exportBtn: { width: 46, height: 46, backgroundColor: '#10b981', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },

    filterScroll: { flexDirection: 'row-reverse', paddingHorizontal: 16, paddingTop: 10 },
    segmentChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginLeft: 8 },
    segmentChipActive: { backgroundColor: '#10b981', borderColor: '#059669' },
    segmentChipTxt: { fontSize: 11, fontWeight: 'bold' },
    segmentChipTxtActive: { color: '#ffffff' },

    listContainer: { padding: 16 },
    customerCard: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, elevation: 1 },
    cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
    avatarContainer: { marginLeft: 12, position: 'relative' },
    avatar: { width: 46, height: 46, borderRadius: 23 },
    avatarPlaceholder: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
    noteBadgeIndicator: { position: 'absolute', top: -4, right: -4, backgroundColor: '#f59e0b', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },

    customerInfo: { flex: 1, alignItems: 'flex-end' },
    customerName: { fontSize: 14, fontWeight: '900', textAlign: 'right' },
    clubBadge: { fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    detailsRow: { flexDirection: 'row-reverse', alignItems: 'center' },
    customerCity: { fontSize: 11, fontWeight: 'bold' },
    customerPhone: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },

    statsGrid: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
    statBox: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 15, fontWeight: '900', marginBottom: 2 },
    statLabel: { fontSize: 10, fontWeight: 'bold' },
    statDivider: { width: 1, height: 30 },

    cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12 },
    actionBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
    actionBtnTxt: { fontSize: 11, fontWeight: '900', marginRight: 4 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 20 },
    modalContainer: { borderRadius: 20, padding: 20, elevation: 5 },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 12, borderBottomWidth: 1 },
    modalTitle: { fontSize: 15, fontWeight: '900' },
    noteInput: { height: 120, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 13, textAlign: 'right', marginBottom: 20 },
    saveNoteBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    saveNoteBtnTxt: { color: '#ffffff', fontWeight: '900', fontSize: 14 },

    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTxt: { marginTop: 12, fontSize: 13, fontWeight: 'bold' },
    emptyTxt: { marginTop: 12, fontSize: 14, fontWeight: 'bold' },
    footerLoader: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
});