import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
    RefreshControl, Alert, ScrollView, Platform, Linking, Modal, TextInput, KeyboardAvoidingView, Switch
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createWooClient } from '../api/client';
import { useAppConfig } from '../store/appConfigStore';
import { SmsSettingsScreen } from './SmsSettingsScreen';
import { WalletActionModal } from '../components/WalletActionModal';

export type SegmentType = string;

interface SavedGroup {
    id: string;
    name: string;
    customerIds: number[];
    couponCode?: string;
    couponAmount?: string;
    couponType?: 'percent' | 'fixed_cart';
    couponDays?: string;
    couponMinAmount?: string;
    couponMaxDiscount?: string;
}

export const CustomerClubScreen: React.FC = () => {
    const isDark = useAppConfig(state => state.isDarkMode);
    const theme = {
        bg: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : '#ffffff',
        text: isDark ? '#f8fafc' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        input: isDark ? '#334155' : '#f1f5f9',
        primary: '#10b981',
    };

    const [activeTab, setActiveTab] = useState<'list' | 'groups'>('list');
    const [showSmsSettings, setShowSmsSettings] = useState(false);
    
    // وضعیت کیف پول
    const [isWalletEnabled, setIsWalletEnabled] = useState(true);
    const [walletModalVisible, setWalletModalVisible] = useState(false);
    const [selectedWalletCustomer, setSelectedWalletCustomer] = useState<any>(null);
    const [isBulkWalletMode, setIsBulkWalletMode] = useState(false);

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSavingGroup, setIsSavingGroup] = useState(false);

    const [customers, setCustomers] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalServerCount, setTotalServerCount] = useState(0);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [activeSegments, setActiveSegments] = useState<SegmentType[]>(['all']);
    const [fMinOrders, setFMinOrders] = useState('');
    const [fMaxOrders, setFMaxOrders] = useState('');
    const [fMinSpent, setFMinSpent] = useState('');
    const [fMaxSpent, setFMaxSpent] = useState('');
    const [fDaysFrom, setFDaysFrom] = useState('');
    const [fDaysTo, setFDaysTo] = useState('');

    const [catMode, setCatMode] = useState<'in' | 'not_in'>('in');
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

    const hasActiveFilters = (!activeSegments.includes('all') && activeSegments.length > 0) || fMinOrders !== '' || fMaxOrders !== '' || fMinSpent !== '' || fMaxSpent !== '' || fDaysFrom !== '' || fDaysTo !== '' || selectedCategories.length > 0;

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
    const [groupModalVisible, setGroupModalVisible] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [groupNameInput, setGroupNameInput] = useState('');

    const [couponCodeInput, setCouponCodeInput] = useState('');
    const [couponAmountInput, setCouponAmountInput] = useState('');
    const [couponType, setCouponType] = useState<'percent' | 'fixed_cart'>('percent');
    const [couponDaysInput, setCouponDaysInput] = useState('');
    const [couponMinAmountInput, setCouponMinAmountInput] = useState('');
    const [couponMaxDiscountInput, setCouponMaxDiscountInput] = useState('');

    const [patternModalVisible, setPatternModalVisible] = useState(false);
    const [patternCode, setPatternCode] = useState('');
    const [patternVars, setPatternVars] = useState('');
    const [targetPhonesForPattern, setTargetPhonesForPattern] = useState<string[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            const groups = await AsyncStorage.getItem('@pishmo_customer_groups');
            if (groups) setSavedGroups(JSON.parse(groups));
            
            const walletStatus = await AsyncStorage.getItem('@pishmo_wallet_enabled');
            if (walletStatus !== null) setIsWalletEnabled(walletStatus === 'true');

            try {
                const client = createWooClient();
                const resCats = await client.get('products/categories', { params: { per_page: 100 } });
                setCategories(resCats.data || []);
            } catch (e) { }
        };
        loadInitialData();
    }, []);

    const toggleWalletStatus = async (value: boolean) => {
        setIsWalletEnabled(value);
        await AsyncStorage.setItem('@pishmo_wallet_enabled', String(value));
    };

    const formatPrice = (price: number | string) => {
        const num = typeof price === 'string' ? parseFloat(price) : price;
        return isNaN(num) ? '۰' : Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const processLRFMData = (rawData: any[]) => {
        const now = new Date().getTime();
        return rawData.map(c => {
            const totalSpent = parseFloat(c.total_spent || '0');
            const ordersCount = parseInt(c.orders_count || '0', 10);
            const phone = c.phone || '';
            const lastOrderDate = c.date_last_order ? new Date(c.date_last_order).getTime() : new Date(c.date_created || Date.now()).getTime();
            const recencyDays = Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24));

            let segment: SegmentType = 'hibernating'; let segmentTitle = 'غیرفعال'; let badgeColor = '#94a3b8'; let badgeBg = isDark ? 'rgba(148, 163, 184, 0.15)' : '#f1f5f9';

            if (ordersCount >= 4 && totalSpent > 2000000) { segment = 'vip'; segmentTitle = '💎 الماس VIP'; badgeColor = '#8b5cf6'; badgeBg = isDark ? 'rgba(139, 92, 246, 0.15)' : '#f3e8ff'; }
            else if (ordersCount >= 2 && recencyDays <= 90) { segment = 'loyal'; segmentTitle = '🥇 وفادار'; badgeColor = '#10b981'; badgeBg = isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7'; }
            else if (ordersCount <= 1 && recencyDays <= 30) { segment = 'new'; segmentTitle = '🌱 تازه‌وارد'; badgeColor = '#3b82f6'; badgeBg = isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe'; }
            else if (ordersCount >= 2 && recencyDays > 90) { segment = 'at_risk'; segmentTitle = '⚠️ درخطرریزش'; badgeColor = '#ef4444'; badgeBg = isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2'; }

            return { ...c, phone, recencyDays, totalSpent, ordersCount, segment, segmentTitle, badgeColor, badgeBg };
        });
    };

    const fetchClubData = async (pageNum = 1, isRefresh = false) => {
        if (!isRefresh && pageNum === 1) setLoading(true);
        if (pageNum > 1) setLoadingMore(true);

        try {
            const client = createWooClient();
            const segmentParam = activeSegments.includes('all') ? 'all' : activeSegments.join(',');
            const catIn = catMode === 'in' ? selectedCategories.join(',') : '';
            const catNotIn = catMode === 'not_in' ? selectedCategories.join(',') : '';

            const response = await client.get('pishmo/v1/crm', {
                params: {
                    page: pageNum, per_page: 50, search: searchQuery, segment: segmentParam,
                    min_orders: fMinOrders, max_orders: fMaxOrders, min_spent: fMinSpent, max_spent: fMaxSpent,
                    days_from: fDaysFrom, days_to: fDaysTo, cat_in: catIn, cat_not_in: catNotIn
                }
            });

            const newCustomers = response.data?.data || [];
            const totalCount = response.data?.total || 0;
            const processedData = processLRFMData(newCustomers);

            if (isRefresh || pageNum === 1) setCustomers(processedData);
            else setCustomers([...customers, ...processedData]);

            setTotalServerCount(totalCount); setHasMore(newCustomers.length === 50);
        } catch (error) { Alert.alert('خطا', 'در دریافت داده‌های باشگاه مشتریان مشکلی پیش آمد.'); }
        finally { setLoading(false); setLoadingMore(false); setRefreshing(false); }
    };

    useEffect(() => { if (activeTab === 'list') fetchClubData(1); }, [activeSegments, activeTab]);

    const handleSearchSubmit = () => { setPage(1); fetchClubData(1, true); };
    const handleRefresh = useCallback(() => { setRefreshing(true); setPage(1); fetchClubData(1, true); }, [activeSegments, searchQuery, fMinOrders, fMaxOrders, fMinSpent, fMaxSpent, fDaysFrom, fDaysTo, selectedCategories, catMode]);
    const handleLoadMore = () => { if (!loading && !loadingMore && hasMore) { const nextPage = page + 1; setPage(nextPage); fetchClubData(nextPage); } };

    const toggleSegment = (seg: SegmentType) => {
        if (seg === 'all') { setActiveSegments(['all']); return; }
        let newSegs = activeSegments.filter(s => s !== 'all');
        if (newSegs.includes(seg)) { newSegs = newSegs.filter(s => s !== seg); if (newSegs.length === 0) newSegs = ['all']; }
        else newSegs.push(seg);
        setActiveSegments(newSegs);
    };

    const toggleCategory = (id: number) => {
        if (selectedCategories.includes(id)) setSelectedCategories(selectedCategories.filter(catId => catId !== id));
        else setSelectedCategories([...selectedCategories, id]);
    };

    const applyFilters = () => { setFilterModalVisible(false); setPage(1); fetchClubData(1); };
    const clearFilters = () => {
        setFMinOrders(''); setFMaxOrders(''); setFMinSpent(''); setFMaxSpent(''); setFDaysFrom(''); setFDaysTo('');
        setSelectedCategories([]); setActiveSegments(['all']); setFilterModalVisible(false); setPage(1);
        setTimeout(() => fetchClubData(1), 100);
    };

    const exportDataToFile = async (specificIds?: number[]) => {
        try {
            setLoading(true);
            const client = createWooClient();
            const segmentParam = activeSegments.includes('all') ? 'all' : activeSegments.join(',');
            const catIn = catMode === 'in' ? selectedCategories.join(',') : '';
            const catNotIn = catMode === 'not_in' ? selectedCategories.join(',') : '';

            const response = await client.get('pishmo/v1/crm', {
                params: { return_type: 'export', include_ids: specificIds ? specificIds.join(',') : '', search: searchQuery, segment: segmentParam, min_orders: fMinOrders, max_orders: fMaxOrders, min_spent: fMinSpent, max_spent: fMaxSpent, days_from: fDaysFrom, days_to: fDaysTo, cat_in: catIn, cat_not_in: catNotIn }
            });

            const dataToExport = processLRFMData(response.data?.data || []);
            if (dataToExport.length === 0) { Alert.alert('خطا', 'مشتری برای خروجی یافت نشد.'); setLoading(false); return; }

            let csvContent = '\uFEFFنام مشتری,شماره تماس,تعداد سفارش,مجموع خرید (تومان),دسته بندی\n';
            dataToExport.forEach(c => {
                const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || 'بدون نام';
                const phone = c.phone || 'ندارد';
                csvContent += `${name},${phone},${c.ordersCount},${c.totalSpent},${c.segmentTitle}\n`;
            });

            if (Platform.OS === 'android') {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (permissions.granted) {
                    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, `Pishmo_Customers_${Date.now()}.csv`, 'text/csv');
                    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
                    Alert.alert('موفقیت 🎉', 'فایل اکسل ذخیره شد!');
                }
            } else {
                const fileUri = FileSystem.cacheDirectory + `Pishmo_Customers_${Date.now()}.csv`;
                await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) { await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' }); }
            }
        } catch (error: any) { Alert.alert('خطای ذخیره‌سازی', error?.message || 'مشکلی پیش آمد.'); } finally { setLoading(false); }
    };

    const toggleSelection = (id: number) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(selId => selId !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const handleSelectAll = () => {
        if (selectedIds.length > 0) { setSelectedIds([]); return; }
        Alert.alert('انتخاب مشتریان', `آیا می‌خواهید فقط مشتریان لود شده را انتخاب کنید یا تمام ${totalServerCount} مشتری پیدا شده را؟`, [
            { text: `لود شده‌ها (${customers.length})`, onPress: () => setSelectedIds(customers.map(c => c.id)) },
            {
                text: `انتخاب همه (${totalServerCount})`, onPress: async () => {
                    setLoading(true);
                    try {
                        const client = createWooClient();
                        const segmentParam = activeSegments.includes('all') ? 'all' : activeSegments.join(',');
                        const catIn = catMode === 'in' ? selectedCategories.join(',') : '';
                        const catNotIn = catMode === 'not_in' ? selectedCategories.join(',') : '';
                        const response = await client.get('pishmo/v1/crm', { params: { return_type: 'ids', search: searchQuery, segment: segmentParam, min_orders: fMinOrders, max_orders: fMaxOrders, min_spent: fMinSpent, max_spent: fMaxSpent, days_from: fDaysFrom, days_to: fDaysTo, cat_in: catIn, cat_not_in: catNotIn } });
                        setSelectedIds(response.data?.ids || []);
                        Alert.alert('موفق', `${response.data?.ids?.length || 0} مشتری انتخاب شدند.`);
                    } catch (e) { Alert.alert('خطا', 'در دریافت لیست مشکلی پیش آمد.'); }
                    finally { setLoading(false); }
                }
            }
        ]);
    };

    const handleBulkSMS = (phoneListArray: string[]) => {
        const validPhones = phoneListArray.filter(p => p && p.length >= 10);
        if (validPhones.length === 0) { Alert.alert('خطا', 'شماره موبایل معتبری یافت نشد.'); return; }
        const phoneList = validPhones.join(',');
        const separator = Platform.OS === 'ios' ? '&' : '?';
        Linking.openURL(`sms:${separator}addresses=${phoneList}`).catch(() => Alert.alert('خطا', 'باز کردن برنامه پیامک با مشکل مواجه شد.'));
    };

    const openPatternModal = (phoneListArray: string[]) => {
        const validPhones = phoneListArray.filter(p => p && p.length >= 10);
        if (validPhones.length === 0) { Alert.alert('خطا', 'شماره موبایل معتبری یافت نشد.'); return; }
        setTargetPhonesForPattern(validPhones); setPatternCode(''); setPatternVars(''); setPatternModalVisible(true);
    };

    const sendPatternSMS = () => {
        if (!patternCode) { Alert.alert('خطا', 'شناسه پترن (کد الگو) الزامی است.'); return; }
        Alert.alert('درحال ارسال', `درخواست ارسال به صف اضافه شد.\nتعداد گیرنده: ${targetPhonesForPattern.length} نفر\nکد پترن: ${patternCode}`);
        setPatternModalVisible(false);
    };

    const openGroupModal = (idToEdit?: string) => {
        if (!idToEdit && selectedIds.length === 0) return;
        if (idToEdit) {
            const group = savedGroups.find(g => g.id === idToEdit);
            if (group) {
                setEditingGroupId(idToEdit); setGroupNameInput(group.name); setCouponCodeInput(group.couponCode || '');
                setCouponAmountInput(group.couponAmount || ''); setCouponDaysInput(group.couponDays || '');
                setCouponMinAmountInput(group.couponMinAmount || ''); setCouponMaxDiscountInput(group.couponMaxDiscount || '');
                setCouponType(group.couponType || 'percent'); setSelectedIds(group.customerIds); setGroupModalVisible(true);
            }
        } else {
            setEditingGroupId(null); setGroupNameInput(''); setCouponCodeInput(''); setCouponAmountInput(''); setCouponDaysInput('');
            setCouponMinAmountInput(''); setCouponMaxDiscountInput(''); setCouponType('percent'); setGroupModalVisible(true);
        }
    };

    const handleSaveGroup = async () => {
        if (!groupNameInput.trim()) { Alert.alert('خطا', 'لطفاً نام گروه را وارد کنید.'); return; }
        if (isSavingGroup) return;
        setIsSavingGroup(true);

        try {
            let createdCouponMsg = '';
            if (couponCodeInput.trim() && couponAmountInput.trim()) {
                const client = createWooClient();
                const payload: any = { code: couponCodeInput.trim(), discount_type: couponType, amount: couponAmountInput.trim(), description: `گروه: ${groupNameInput.trim()}` };
                if (couponDaysInput.trim()) {
                    const days = parseInt(couponDaysInput.trim(), 10);
                    if (!isNaN(days)) { const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + days); payload.date_expires = futureDate.toISOString(); }
                }
                if (couponMinAmountInput.trim()) payload.minimum_amount = couponMinAmountInput.trim();
                if (couponMaxDiscountInput.trim()) { payload.meta_data = [{ key: '_wc_max_discount', value: couponMaxDiscountInput.trim() }, { key: 'maximum_amount', value: couponMaxDiscountInput.trim() }]; }
                try {
                    await client.post('coupons', payload);
                    createdCouponMsg = `\n🎁 کد تخفیف "${couponCodeInput}" ساخته شد.`;
                } catch (apiError: any) {
                    if (apiError.response?.data?.code === 'woocommerce_rest_coupon_code_already_exists') { Alert.alert('خطا', 'کد تخفیف تکراری است!'); setIsSavingGroup(false); return; }
                }
            }

            let updatedGroups = [...savedGroups];
            const groupData: SavedGroup = {
                id: editingGroupId || Date.now().toString(), name: groupNameInput.trim(), customerIds: [...selectedIds],
                couponCode: couponCodeInput.trim(), couponAmount: couponAmountInput.trim(), couponType: couponType,
                couponDays: couponDaysInput.trim(), couponMinAmount: couponMinAmountInput.trim(), couponMaxDiscount: couponMaxDiscountInput.trim()
            };

            if (editingGroupId) updatedGroups = updatedGroups.map(g => g.id === editingGroupId ? groupData : g);
            else updatedGroups.push(groupData);

            setSavedGroups(updatedGroups);
            await AsyncStorage.setItem('@pishmo_customer_groups', JSON.stringify(updatedGroups));
            Alert.alert('عملیات موفق', `گروه ذخیره شد.${createdCouponMsg}`);
            setIsSelectMode(false); setSelectedIds([]); setGroupModalVisible(false);
        } catch (error: any) { Alert.alert('خطا', 'مشکلی در ذخیره گروه پیش آمد.'); }
        finally { setIsSavingGroup(false); }
    };

    const deleteGroup = (id: string) => {
        Alert.alert('حذف گروه', 'از حذف این گروه مطمئن هستید؟', [
            { text: 'انصراف', style: 'cancel' },
            { text: 'حذف', style: 'destructive', onPress: async () => { const updated = savedGroups.filter(g => g.id !== id); setSavedGroups(updated); await AsyncStorage.setItem('@pishmo_customer_groups', JSON.stringify(updated)); } }
        ]);
    };

    const renderCustomerCard = ({ item }: { item: any }) => {
        const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username || 'مشتری ناشناس';
        const isSelected = selectedIds.includes(item.id);

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => isSelectMode ? toggleSelection(item.id) : null}
                onLongPress={() => { setIsSelectMode(true); toggleSelection(item.id); }}
                style={[styles.customerCard, { backgroundColor: isSelected ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5') : theme.card, borderColor: isSelected ? '#10b981' : theme.border }]}
            >
                <View style={styles.cardTopRow}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }}>
                        {isSelectMode && (
                            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                                {isSelected && <Feather name="check" size={14} color="#fff" />}
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.customerName, { color: theme.text }]} numberOfLines={1}>{fullName}</Text>
                            {item.phone ? <Text style={[styles.customerPhone, { color: theme.textMuted }]}>{item.phone}</Text> : null}
                        </View>
                        {isWalletEnabled && (
                            <TouchableOpacity 
                                style={{ padding: 8, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5', borderRadius: 8, marginLeft: 10 }}
                                onPress={() => { setIsBulkWalletMode(false); setSelectedWalletCustomer(item); setWalletModalVisible(true); }}
                            >
                                <Feather name="credit-card" size={16} color="#10b981" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={[styles.badgePill, { backgroundColor: item.badgeBg }]}><Text style={[styles.badgeTxt, { color: item.badgeColor }]}>{item.segmentTitle}</Text></View>
                </View>

                <View style={[styles.lrfmGrid, { backgroundColor: isSelected ? 'transparent' : theme.input, borderColor: theme.border }]}>
                    <View style={styles.lrfmItem}>
                        <Text style={[styles.lrfmVal, { color: theme.text }]}>{formatPrice(item.totalSpent)}</Text>
                        <Text style={[styles.lrfmLabel, { color: theme.textMuted }]}>ارزش (M)</Text>
                    </View>
                    <View style={[styles.lrfmDivider, { backgroundColor: theme.border }]} />
                    <View style={styles.lrfmItem}>
                        <Text style={[styles.lrfmVal, { color: theme.text }]}>{item.ordersCount} خرید</Text>
                        <Text style={[styles.lrfmLabel, { color: theme.textMuted }]}>تکرار (F)</Text>
                    </View>
                    <View style={[styles.lrfmDivider, { backgroundColor: theme.border }]} />
                    <View style={styles.lrfmItem}>
                        <Text style={[styles.lrfmVal, { color: theme.text }]}>{item.recencyDays} روز</Text>
                        <Text style={[styles.lrfmLabel, { color: theme.textMuted }]}>تازگی (R)</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            
            {showSmsSettings && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
                    <SmsSettingsScreen onBack={() => setShowSmsSettings(false)} />
                </View>
            )}

            <View style={[styles.topTabs, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity style={[styles.topTabBtn, activeTab === 'list' && styles.topTabBtnActive, { borderColor: theme.primary }]} onPress={() => setActiveTab('list')}><Text style={[styles.topTabTxt, { color: activeTab === 'list' ? theme.primary : theme.textMuted }]}>لیست مشتریان</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.topTabBtn, activeTab === 'groups' && styles.topTabBtnActive, { borderColor: theme.primary }]} onPress={() => setActiveTab('groups')}><Text style={[styles.topTabTxt, { color: activeTab === 'groups' ? theme.primary : theme.textMuted }]}>گروه‌های من</Text></TouchableOpacity>
            </View>

            {activeTab === 'groups' ? (
                <ScrollView contentContainerStyle={{ padding: 16 }}>
                    {savedGroups.length === 0 ? (
                        <View style={styles.centerContainer}>
                            <Feather name="folder" size={48} color={theme.border} />
                            <Text style={[styles.emptyTxt, { color: theme.textMuted }]}>هیچ گروهی ذخیره نکرده‌اید.</Text>
                            <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 20 }}>برای ساخت گروه، در لیست مشتریان روی کارت مشتری انگشت خود را نگه دارید، افراد را تیک بزنید و دکمه فولدر را انتخاب کنید.</Text>
                        </View>
                    ) : (
                        savedGroups.map((group, index) => (
                            <View key={group.id || index.toString()} style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', justifyContent: 'center', alignItems: 'center', marginLeft: 12 }}><Feather name="users" size={20} color="#3b82f6" /></View>
                                        <View>
                                            <Text style={[styles.groupName, { color: theme.text }]}>{group.name}</Text>
                                            <Text style={[styles.groupCount, { color: theme.textMuted }]}>{group.customerIds.length} مشتری {group.couponCode ? `(تخفیف: ${group.couponCode})` : ''}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row-reverse' }}>
                                        <TouchableOpacity onPress={() => openGroupModal(group.id)} style={{ padding: 8 }}><Feather name="edit-2" size={16} color={theme.textMuted} /></TouchableOpacity>
                                        <TouchableOpacity onPress={() => deleteGroup(group.id)} style={{ padding: 8 }}><Feather name="trash-2" size={16} color="#ef4444" /></TouchableOpacity>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                                    <TouchableOpacity style={styles.groupActionBtn} onPress={() => { const groupPhones = customers.filter(c => group.customerIds.includes(c.id)).map(c => c.phone); openPatternModal(groupPhones); }}>
                                        <Feather name="mail" size={14} color="#fff" />
                                        <Text style={styles.groupActionTxt}>پترن پیامک</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.groupActionBtn, { backgroundColor: '#10b981' }]} onPress={() => { const groupPhones = customers.filter(c => group.customerIds.includes(c.id)).map(c => c.phone); handleBulkSMS(groupPhones); }}>
                                        <Feather name="message-square" size={14} color="#fff" />
                                        <Text style={styles.groupActionTxt}>ارسال عادی</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            ) : (
                <>
                    <View style={[styles.topBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                            <Text style={[styles.topBarTitle, { color: theme.text }]}>باشگاه LRFM</Text>
                            <View style={[styles.countBadge, { backgroundColor: theme.input }]}><Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: 'bold' }}>{totalServerCount} نفر</Text></View>
                            <TouchableOpacity style={{ padding: 5, marginRight: 10 }} onPress={() => setShowSmsSettings(true)}><Feather name="settings" size={18} color={theme.textMuted} /></TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                            {!isSelectMode ? (
                                <>
                                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.input, borderColor: theme.border, borderWidth: 1 }]} onPress={() => exportDataToFile()}><Feather name="download" size={16} color="#3b82f6" /></TouchableOpacity>
                                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.input, borderColor: theme.border, borderWidth: 1, marginHorizontal: 8 }]} onPress={() => setIsSelectMode(true)}><Feather name="check-square" size={16} color={theme.textMuted} /></TouchableOpacity>
                                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.input, borderColor: theme.border, borderWidth: 1, position: 'relative' }]} onPress={() => setFilterModalVisible(true)}><Feather name="filter" size={16} color="#10b981" />{hasActiveFilters && <View style={styles.filterDot} />}</TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#fee2e2', borderColor: '#fca5a5', borderWidth: 1 }]} onPress={() => { setIsSelectMode(false); setSelectedIds([]); }}><Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 11 }}>لغو انتخاب</Text></TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={[styles.searchRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                        <View style={[styles.searchBox, { backgroundColor: theme.input, borderColor: theme.border }]}>
                            <Feather name="search" size={16} color={theme.textMuted} style={{ marginLeft: 5 }} />
                            <TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="جستجوی نام، موبایل یا آیدی..." placeholderTextColor={theme.textMuted} value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearchSubmit} returnKeyType="search" />
                            {searchQuery.length > 0 && (<TouchableOpacity onPress={() => { setSearchQuery(''); setTimeout(() => { setPage(1); fetchClubData(1); }, 100); }}><Feather name="x-circle" size={14} color={theme.textMuted} /></TouchableOpacity>)}
                        </View>
                        <View style={styles.walletToggleBox}>
                            <Text style={[styles.walletToggleTxt, { color: theme.textMuted }]}>کیف‌پول</Text>
                            <Switch value={isWalletEnabled} onValueChange={toggleWalletStatus} trackColor={{ false: '#cbd5e1', true: '#a7f3d0' }} thumbColor={isWalletEnabled ? '#10b981' : '#f8fafc'} style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                        </View>
                    </View>

                    {loading && page === 1 ? (
                        <View style={styles.centerContainer}><ActivityIndicator size="large" color={theme.primary} /><Text style={[styles.loadingTxt, { color: theme.textMuted }]}>در حال جستجو و پردازش...</Text></View>
                    ) : customers.length === 0 ? (
                        <View style={styles.centerContainer}>
                            <Feather name="search" size={48} color={theme.border} />
                            <Text style={[styles.emptyTxt, { color: theme.textMuted }]}>هیچ مشتری با این مشخصات یافت نشد.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={customers}
                            keyExtractor={(item, index) => item.id.toString() + index}
                            renderItem={renderCustomerCard}
                            contentContainerStyle={styles.listContainer}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} />}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={loadingMore ? (<View style={styles.footerLoader}><ActivityIndicator size="small" color={theme.primary} /></View>) : <View style={{ height: isSelectMode ? 100 : 40 }} />}
                        />
                    )}

                    {isSelectMode && (
                        <View style={[styles.bulkActionBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                                <TouchableOpacity style={styles.selectAllBtn} onPress={handleSelectAll}><Text style={styles.selectAllBtnTxt}>{selectedIds.length > 0 ? 'حذف همه' : 'انتخاب همه'}</Text></TouchableOpacity>
                                <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: 'bold', marginRight: 8 }}>{selectedIds.length} مورد</Text>
                            </View>
                            <View style={{ flexDirection: 'row-reverse' }}>
                                <TouchableOpacity style={[styles.bulkActionBtn, { backgroundColor: '#f59e0b' }]} onPress={() => openGroupModal()}><Feather name="folder-plus" size={18} color="#fff" /></TouchableOpacity>
                                <TouchableOpacity style={[styles.bulkActionBtn, { backgroundColor: '#10b981', marginHorizontal: 2 }]} onPress={() => openPatternModal(customers.filter(c => selectedIds.includes(c.id)).map(c => c.phone))}><Feather name="mail" size={16} color="#fff" /></TouchableOpacity>
                                {isWalletEnabled && (<TouchableOpacity style={[styles.bulkActionBtn, { backgroundColor: '#3b82f6', marginRight: 1 }]} onPress={() => { setIsBulkWalletMode(true); setWalletModalVisible(true); }}><Feather name="credit-card" size={16} color="#fff" /></TouchableOpacity>)}
                                <TouchableOpacity style={[styles.bulkActionBtn, { backgroundColor: '#475569' }]} onPress={() => exportDataToFile(selectedIds)}><Feather name="download" size={16} color="#fff" /></TouchableOpacity>
                            </View>
                        </View>
                    )}
                </>
            )}

            <WalletActionModal visible={walletModalVisible} onClose={() => setWalletModalVisible(false)} customer={isBulkWalletMode ? null : selectedWalletCustomer} selectedIds={isBulkWalletMode ? selectedIds : undefined} onSuccess={() => fetchClubData(1, true)} />

            {/* Modal های اصلی شما */}
            <Modal visible={groupModalVisible} animationType="fade" transparent onRequestClose={() => setGroupModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centerModalOverlay}>
                    <View style={[styles.centerModalContainer, { backgroundColor: theme.card, maxHeight: '90%' }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>{editingGroupId ? 'ویرایش گروه و تخفیف' : 'ذخیره گروه و ساخت تخفیف'}</Text>
                            <TouchableOpacity onPress={() => setGroupModalVisible(false)} disabled={isSavingGroup}><Feather name="x" size={24} color={theme.textMuted} /></TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.filterGroupTitle, { color: theme.text }]}>نام گروه (الزامی)</Text>
                            <TextInput style={[styles.groupInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border, marginBottom: 15 }]} placeholder="مثال: مشتریان VIP تهران..." placeholderTextColor={theme.textMuted} value={groupNameInput} onChangeText={setGroupNameInput} textAlign="right" />
                            <View style={[styles.filterDivider, { backgroundColor: theme.border }]} />
                            <Text style={[styles.filterGroupTitle, { color: theme.text }]}>کد تخفیف اختصاصی (اختیاری)</Text>
                            <TextInput style={[styles.groupInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border, marginBottom: 10 }]} placeholder="کد کوپن (مثال: YALDA99)" placeholderTextColor={theme.textMuted} value={couponCodeInput} onChangeText={setCouponCodeInput} textAlign="left" />
                            <View style={[styles.catModeToggle, { backgroundColor: theme.input, borderColor: theme.border }]}>
                                <TouchableOpacity style={[styles.catModeBtn, couponType === 'percent' && { backgroundColor: '#10b981' }]} onPress={() => setCouponType('percent')}><Text style={[styles.catModeTxt, couponType === 'percent' && { color: '#fff' }]}>درصدی (%)</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.catModeBtn, couponType === 'fixed_cart' && { backgroundColor: '#3b82f6' }]} onPress={() => setCouponType('fixed_cart')}><Text style={[styles.catModeTxt, couponType === 'fixed_cart' && { color: '#fff' }]}>مبلغ ثابت (تومان)</Text></TouchableOpacity>
                            </View>
                            <View style={styles.inputRow}>
                                <TextInput style={[styles.filterInput, { backgroundColor: theme.input, color: theme.text }]} placeholder="ارزش تخفیف..." placeholderTextColor={theme.textMuted} keyboardType="numeric" value={couponAmountInput} onChangeText={setCouponAmountInput} />
                                <Text style={{ marginHorizontal: 10, color: theme.textMuted }}>-</Text>
                                <TextInput style={[styles.filterInput, { backgroundColor: theme.input, color: theme.text }]} placeholder="اعتبار (تعداد روز)..." placeholderTextColor={theme.textMuted} keyboardType="numeric" value={couponDaysInput} onChangeText={setCouponDaysInput} />
                            </View>
                            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 }}>
                                <View style={{ flex: 1, marginLeft: 5 }}>
                                    <Text style={[styles.filterGroupTitle, { color: theme.text, fontSize: 11, marginBottom: 4 }]}>حداقل خرید</Text>
                                    <TextInput style={[styles.groupInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="مثال: 500000" placeholderTextColor={theme.textMuted} keyboardType="numeric" value={couponMinAmountInput} onChangeText={setCouponMinAmountInput} textAlign="right" />
                                </View>
                                <View style={{ flex: 1, marginRight: 5 }}>
                                    <Text style={[styles.filterGroupTitle, { color: theme.text, fontSize: 11, marginBottom: 4 }]}>سقف تخفیف</Text>
                                    <TextInput style={[styles.groupInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="مثال: 100000" placeholderTextColor={theme.textMuted} keyboardType="numeric" value={couponMaxDiscountInput} onChangeText={setCouponMaxDiscountInput} textAlign="right" />
                                </View>
                            </View>
                            <TouchableOpacity style={[styles.btnApply, { marginTop: 25, marginBottom: 10, opacity: isSavingGroup ? 0.7 : 1 }]} onPress={handleSaveGroup} disabled={isSavingGroup}>
                                {isSavingGroup ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnApplyTxt}>ذخیره و اعمال تنظیمات</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={patternModalVisible} animationType="fade" transparent onRequestClose={() => setPatternModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centerModalOverlay}>
                    <View style={[styles.centerModalContainer, { backgroundColor: theme.card }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>ارسال پیامک پترن‌دار</Text>
                            <TouchableOpacity onPress={() => setPatternModalVisible(false)}><Feather name="x" size={24} color={theme.textMuted} /></TouchableOpacity>
                        </View>
                        <Text style={{ textAlign: 'right', fontSize: 12, color: theme.textMuted, marginBottom: 15 }}>گیرندگان معتبر: {targetPhonesForPattern.length} نفر</Text>
                        <Text style={[styles.filterGroupTitle, { color: theme.text }]}>شناسه پترن</Text>
                        <TextInput style={[styles.groupInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border, marginBottom: 15 }]} placeholder="مثال: 12345" placeholderTextColor={theme.textMuted} value={patternCode} onChangeText={setPatternCode} textAlign="left" keyboardType="numeric" />
                        <Text style={[styles.filterGroupTitle, { color: theme.text }]}>متغیرها</Text>
                        <TextInput style={[styles.groupInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="مثال: code:VIP90, discount:20" placeholderTextColor={theme.textMuted} value={patternVars} onChangeText={setPatternVars} textAlign="left" />
                        <TouchableOpacity style={[styles.btnApply, { marginTop: 25, backgroundColor: '#3b82f6' }]} onPress={sendPatternSMS}><Text style={styles.btnApplyTxt}>ثبت در صف ارسال</Text></TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={filterModalVisible} animationType="fade" transparent onRequestClose={() => setFilterModalVisible(false)}>
                <View style={styles.drawerOverlay}>
                    <TouchableOpacity style={styles.drawerCloseArea} onPress={() => setFilterModalVisible(false)} />
                    <View style={[styles.drawerContainer, { backgroundColor: theme.card }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>فیلترهای پیشرفته</Text>
                            <TouchableOpacity onPress={() => setFilterModalVisible(false)}><Feather name="arrow-left" size={24} color={theme.textMuted} /></TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                            <Text style={[styles.filterGroupTitle, { color: theme.text }]}>وضعیت وفاداری</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10, paddingHorizontal: 5 }}>
                                <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegments.includes('all') && styles.segmentChipActive]} onPress={() => toggleSegment('all')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegments.includes('all') && styles.segmentChipTxtActive]}>همه</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegments.includes('vip') && styles.segmentChipActive]} onPress={() => toggleSegment('vip')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegments.includes('vip') && styles.segmentChipTxtActive]}>💎 VIP</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegments.includes('loyal') && styles.segmentChipActive]} onPress={() => toggleSegment('loyal')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegments.includes('loyal') && styles.segmentChipTxtActive]}>🥇 وفادار</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegments.includes('new') && styles.segmentChipActive]} onPress={() => toggleSegment('new')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegments.includes('new') && styles.segmentChipTxtActive]}>🌱 تازه‌وارد</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegments.includes('at_risk') && styles.segmentChipActive]} onPress={() => toggleSegment('at_risk')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegments.includes('at_risk') && styles.segmentChipTxtActive]}>⚠️ در خطر</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.segmentChip, { backgroundColor: theme.input, borderColor: theme.border }, activeSegments.includes('hibernating') && styles.segmentChipActive]} onPress={() => toggleSegment('hibernating')}><Text style={[styles.segmentChipTxt, { color: theme.textMuted }, activeSegments.includes('hibernating') && styles.segmentChipTxtActive]}>😴 خوابیده</Text></TouchableOpacity>
                            </ScrollView>
                            <View style={[styles.filterDivider, { backgroundColor: theme.border }]} />
                            <Text style={[styles.filterGroupTitle, { color: theme.text }]}>محصولات</Text>
                            <View style={[styles.catModeToggle, { backgroundColor: theme.input, borderColor: theme.border }]}>
                                <TouchableOpacity style={[styles.catModeBtn, catMode === 'in' && { backgroundColor: '#10b981' }]} onPress={() => setCatMode('in')}><Text style={[styles.catModeTxt, catMode === 'in' && { color: '#fff' }]}>خرید از این دسته‌ها</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.catModeBtn, catMode === 'not_in' && { backgroundColor: '#ef4444' }]} onPress={() => setCatMode('not_in')}><Text style={[styles.catModeTxt, catMode === 'not_in' && { color: '#fff' }]}>بجز این دسته‌ها</Text></TouchableOpacity>
                            </View>
                            <View style={styles.catGrid}>
                                {categories.map(cat => (
                                    <TouchableOpacity key={cat.id} style={[styles.catChip, { backgroundColor: theme.input, borderColor: theme.border }, selectedCategories.includes(cat.id) && { borderColor: catMode === 'in' ? '#10b981' : '#ef4444', backgroundColor: catMode === 'in' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]} onPress={() => toggleCategory(cat.id)}>
                                        <Text style={[styles.catChipTxt, { color: theme.textMuted }, selectedCategories.includes(cat.id) && { color: catMode === 'in' ? '#059669' : '#b91c1c' }]}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={[styles.filterDivider, { backgroundColor: theme.border }]} />
                            <Text style={[styles.filterGroupTitle, { color: theme.text }]}>تعداد خرید</Text>
                            <View style={styles.inputRow}>
                                <TextInput style={[styles.filterInput, { backgroundColor: theme.input, color: theme.text }]} placeholder="از..." placeholderTextColor={theme.textMuted} keyboardType="numeric" value={fMinOrders} onChangeText={setFMinOrders} />
                                <Text style={{ marginHorizontal: 10, color: theme.textMuted }}>-</Text>
                                <TextInput style={[styles.filterInput, { backgroundColor: theme.input, color: theme.text }]} placeholder="تا..." placeholderTextColor={theme.textMuted} keyboardType="numeric" value={fMaxOrders} onChangeText={setFMaxOrders} />
                            </View>
                            <View style={[styles.filterDivider, { backgroundColor: theme.border }]} />
                            <Text style={[styles.filterGroupTitle, { color: theme.text }]}>مجموع خرید (تومان)</Text>
                            <View style={styles.inputRow}>
                                <TextInput style={[styles.filterInput, { backgroundColor: theme.input, color: theme.text }]} placeholder="از..." placeholderTextColor={theme.textMuted} keyboardType="numeric" value={fMinSpent} onChangeText={setFMinSpent} />
                                <Text style={{ marginHorizontal: 10, color: theme.textMuted }}>-</Text>
                                <TextInput style={[styles.filterInput, { backgroundColor: theme.input, color: theme.text }]} placeholder="تا..." placeholderTextColor={theme.textMuted} keyboardType="numeric" value={fMaxSpent} onChangeText={setFMaxSpent} />
                            </View>
                            <View style={[styles.filterDivider, { backgroundColor: theme.border }]} />
                            <Text style={[styles.filterGroupTitle, { color: theme.text }]}>روزهای گذشته از خرید (R)</Text>
                            <View style={styles.inputRow}>
                                <TextInput style={[styles.filterInput, { backgroundColor: theme.input, color: theme.text }]} placeholder="از..." placeholderTextColor={theme.textMuted} keyboardType="numeric" value={fDaysFrom} onChangeText={setFDaysFrom} />
                                <Text style={{ marginHorizontal: 10, color: theme.textMuted }}>-</Text>
                                <TextInput style={[styles.filterInput, { backgroundColor: theme.input, color: theme.text }]} placeholder="تا..." placeholderTextColor={theme.textMuted} keyboardType="numeric" value={fDaysTo} onChangeText={setFDaysTo} />
                            </View>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                        <View style={{ flexDirection: 'row-reverse', paddingTop: 15, borderTopWidth: 1, borderTopColor: theme.border, gap: 10 }}>
                            <TouchableOpacity style={[styles.btnApply, { flex: 2 }]} onPress={applyFilters}><Text style={styles.btnApplyTxt}>اعمال فیلترها</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.btnApply, { flex: 1, backgroundColor: theme.input }]} onPress={clearFilters}><Text style={[styles.btnApplyTxt, { color: '#ef4444' }]}>پاک کردن</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    topTabs: { flexDirection: 'row-reverse', borderBottomWidth: 1, elevation: 1 },
    topTabBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 3, borderColor: 'transparent' },
    topTabBtnActive: {},
    topTabTxt: { fontSize: 13, fontWeight: '900' },
    topBar: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, elevation: 1 },
    topBarTitle: { fontSize: 15, fontWeight: '900' },
    countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 8 },
    iconBtn: { padding: 8, borderRadius: 10 },
    filterDot: { position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#fff' },
    searchRow: { flexDirection: 'row-reverse', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, alignItems: 'center' },
    searchBox: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 40 },
    searchInput: { flex: 1, textAlign: 'right', fontSize: 12 },
    walletToggleBox: { flexDirection: 'row-reverse', alignItems: 'center', marginRight: 10 },
    walletToggleTxt: { fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
    listContainer: { paddingHorizontal: 16, paddingTop: 10 },
    customerCard: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, elevation: 1 },
    cardTopRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    customerName: { fontSize: 14, fontWeight: '900', textAlign: 'right' },
    customerPhone: { fontSize: 11, fontWeight: 'bold', textAlign: 'right', marginTop: 4, letterSpacing: 1 },
    badgePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeTxt: { fontSize: 10, fontWeight: '900' },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
    checkboxActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    lrfmGrid: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1 },
    lrfmItem: { flex: 1, alignItems: 'center' },
    lrfmVal: { fontSize: 12, fontWeight: '900', marginBottom: 2 },
    lrfmLabel: { fontSize: 9, fontWeight: 'bold' },
    lrfmDivider: { width: 1, height: 22 },
    bulkActionBar: { position: 'absolute', bottom: 85, left: 16, right: 16, borderRadius: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
    selectAllBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: '#3b82f6', elevation: 2 },
    selectAllBtnTxt: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
    bulkActionBtn: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTxt: { marginTop: 12, fontSize: 13, fontWeight: 'bold' },
    emptyTxt: { marginTop: 12, fontSize: 14, fontWeight: 'bold' },
    footerLoader: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
    drawerOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', flexDirection: 'row-reverse' },
    drawerCloseArea: { flex: 1 },
    drawerContainer: { width: '82%', height: '100%', padding: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: -5, height: 0 }, shadowOpacity: 0.1, shadowRadius: 10 },
    centerModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 20 },
    centerModalContainer: { borderRadius: 20, padding: 20, elevation: 5 },
    groupInput: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 13, fontWeight: 'bold' },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 12, borderBottomWidth: 1 },
    modalTitle: { fontSize: 16, fontWeight: '900' },
    filterGroupTitle: { fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 },
    catModeToggle: { flexDirection: 'row-reverse', borderRadius: 10, borderWidth: 1, padding: 4, marginBottom: 10, marginTop: 5 },
    catModeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    catModeTxt: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    catGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
    catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    catChipTxt: { fontSize: 10, fontWeight: 'bold' },
    segmentChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    segmentChipActive: { backgroundColor: '#10b981', borderColor: '#059669' },
    segmentChipTxt: { fontSize: 12, fontWeight: 'bold' },
    segmentChipTxtActive: { color: '#ffffff' },
    filterDivider: { height: 1, marginVertical: 15 },
    inputRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
    filterInput: { flex: 1, height: 44, borderRadius: 10, paddingHorizontal: 12, textAlign: 'center', fontSize: 13 },
    btnApply: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnApplyTxt: { color: '#ffffff', fontWeight: '900', fontSize: 14 },
    groupCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, elevation: 1 },
    groupName: { fontSize: 15, fontWeight: '900', textAlign: 'right' },
    groupCount: { fontSize: 11, fontWeight: 'bold', marginTop: 2, textAlign: 'right' },
    groupActionBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 10 },
    groupActionTxt: { color: '#fff', fontWeight: 'bold', fontSize: 11, marginRight: 6 },
});