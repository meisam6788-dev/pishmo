import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
    Alert, RefreshControl, Modal, ScrollView, TextInput, Image, Linking, Share, Platform, Animated, PanResponder
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
// @ts-ignore
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { createWooClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

import { AddProductModal } from '../components/AddProductModal';

// 🌟 کامپوننت نقطه چشمک‌زن برای سفارشات در حال انجام
const BlinkingDot = () => {
    const opacity = useRef(new Animated.Value(0.2)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true })
            ])
        ).start();
    }, []);
    return (
        <Animated.View style={[styles.blinkingDot, { opacity }]} />
    );
};

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

export const toShamsi = (dateInput: string | Date | undefined, includeTime: boolean = false) => {
    if (!dateInput) return '---';
    try {
        let dateString = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
        const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return 'تاریخ نامعتبر';
        const gy = parseInt(match[1], 10); const gm = parseInt(match[2], 10); const gd = parseInt(match[3], 10);
        const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
        let result = `${jy}/${jm < 10 ? '0' + jm : jm}/${jd < 10 ? '0' + jd : jd}`;
        
        if (includeTime && dateString.includes('T')) {
            const timePart = dateString.split('T')[1];
            const hm = timePart.substring(0, 5);
            result += ` - ساعت ${hm}`;
        }
        return result;
    } catch (e) { return '---'; }
};

const formatPrice = (price: string | number) => {
    if (!price && price !== 0) return '۰';
    return price.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const renderStatusBadge = (status: string) => {
    switch (status) {
        case 'completed': return { label: 'تکمیل شده', color: '#10b981', bg: '#dcfce7' };
        case 'processing': return { label: 'در حال انجام', color: '#3b82f6', bg: '#dbeafe' };
        case 'pending': return { label: 'در انتظار پرداخت', color: '#f59e0b', bg: '#fef3c7' };
        case 'on-hold': return { label: 'در انتظار بررسی', color: '#8b5cf6', bg: '#ede9fe' };
        case 'cancelled': return { label: 'لغو شده', color: '#ef4444', bg: '#fee2e2' };
        case 'failed': return { label: 'ناموفق', color: '#be123c', bg: '#ffe4e6' };
        default: return { label: status, color: '#475569', bg: '#e2e8f0' };
    }
};

const getShippingBadge = (order: any) => {
    const title = order.shipping_lines?.[0]?.method_title || order.shipping_lines?.[0]?.title || '';
    if (!title) return null;
    let bgColor = '#f1f5f9'; let textColor = '#475569'; let shortName = 'سایر';
    if (title.includes('پست')) { bgColor = '#fef08a'; textColor = '#854d0e'; shortName = 'پست'; }
    else if (title.includes('پیک') || title.includes('موتور')) { bgColor = '#bbf7d0'; textColor = '#166534'; shortName = 'پیک موتوری'; }
    else if (title.includes('تیپاکس')) { bgColor = '#fed7aa'; textColor = '#9a3412'; shortName = 'تیپاکس'; }
    else if (title.includes('باربری') || title.includes('ترمینال')) { bgColor = '#bfdbfe'; textColor = '#1e40af'; shortName = 'باربری'; }
    else if (title.includes('رایگان')) { bgColor = '#ccfbf1'; textColor = '#0f766e'; shortName = 'رایگان'; }
    return (
        <View style={[styles.shippingMiniBadge, { backgroundColor: bgColor }]}><Text style={[styles.shippingMiniTxt, { color: textColor }]}>{shortName}</Text></View>
    );
};

const getOrderOriginData = (order: any) => {
    if (!order) return { origin: 'نامشخص', pages: 'نامشخص', device: 'نامشخص' };
    const meta = order.meta_data || [];
    const utmSource = meta.find((m: any) => m.key === '_wc_order_attribution_utm_source')?.value;
    const sourceType = meta.find((m: any) => m.key === '_wc_order_attribution_source_type')?.value;
    const pages = meta.find((m: any) => m.key === '_wc_order_attribution_session_pages')?.value;
    const device = meta.find((m: any) => m.key === '_wc_order_attribution_device_type')?.value;

    let origin = utmSource || sourceType || order.created_via || 'مستقیم';
    if (origin === 'admin') origin = 'مدیریت سایت (دستی)';
    if (origin === 'checkout') origin = 'سایت (مستقیم)';
    if (origin === 'typein') origin = 'ورود مستقیم آدرس';
    if (origin === 'organic') origin = 'جستجوی ارگانیک (گوگل)';

    return {
        origin,
        pages: pages ? `${pages} صفحه بازدید شده` : 'ثبت نشده',
        device: device === 'Mobile' ? 'موبایل' : device === 'Desktop' ? 'کامپیوتر' : device || 'نامشخص'
    };
};

const SwipeableOrderCard = React.memo(({ item, onOpenModal, onLongPress, onCompleteSwipe, isSelected }: any) => {
    const pan = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 && Math.abs(gestureState.dx) > 15,
            onPanResponderMove: (evt, gestureState) => { if (gestureState.dx < 0) pan.setValue(gestureState.dx); },
            onPanResponderRelease: (evt, gestureState) => {
                if (gestureState.dx < -100) {
                    Animated.timing(pan, { toValue: -120, duration: 200, useNativeDriver: true }).start(() => {
                        onCompleteSwipe(item);
                        Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
                    });
                } else { Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start(); }
            }
        })
    ).current;

    const badge = renderStatusBadge(item.status);
    const itemsCount = item.line_items?.reduce((acc: number, cur: any) => acc + (cur.quantity || 1), 0) || 0;

    return (
        <View style={{ marginBottom: 6, position: 'relative' }}>
            <View style={styles.swipeBackground}><Feather name="check-circle" size={20} color="#fff" /><Text style={styles.swipeTxt}>تکمیل سریع</Text></View>
            <Animated.View style={{ transform: [{ translateX: pan }] }} {...panResponder.panHandlers}>
                <TouchableOpacity style={[styles.orderCard, isSelected && { borderColor: '#3b82f6', borderWidth: 2 }]} onPress={onOpenModal} onLongPress={onLongPress} activeOpacity={0.9}>
                    
                    <View style={styles.cardRow}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }}>
                            <Text style={styles.customerNameTxt} numberOfLines={1}>👤 {item.billing?.first_name} {item.billing?.last_name}</Text>
                            {item.status === 'processing' && <BlinkingDot />}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.itemsCountBadge}><Text style={styles.itemsCountTxt}>{itemsCount} کالا</Text></View>
                            <Text style={[styles.orderIdTxt, { marginLeft: 8 }]}>#{item.id}</Text>
                        </View>
                    </View>
                    
                    <View style={[styles.cardRow, { marginBottom: 6 }]}><View style={[styles.statusBadge, { backgroundColor: badge.bg }]}><Text style={[styles.statusTxt, { color: badge.color }]}>{badge.label}</Text></View><Text style={styles.orderDateTxt}>{toShamsi(item.date_created)}</Text></View>
                    
                    <View style={styles.cardFooter}>
                        <Text style={styles.totalPriceTxt}>{formatPrice(item.total)} تومان</Text>
                        {getShippingBadge(item)}
                    </View>

                    {isSelected && <View style={styles.selectedOverlay}><Feather name="check-circle" size={32} color="#3b82f6" /></View>}
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
});

const filterTabs = [
    { id: 'all', label: 'همه سفارشات' },
    { id: 'completed', label: 'تکمیل شده' },
    { id: 'processing', label: 'در حال انجام' },
    { id: 'pending', label: 'در انتظار پرداخت' },
    { id: 'on-hold', label: 'در انتظار بررسی' },
    { id: 'cancelled', label: 'لغو شده' },
];

export const OrdersScreen: React.FC = () => {
    const navigation = useNavigation<any>(); 
    const isMounted = useRef(false);
    const hasCachedData = useRef(false);

    // 🌟 متغیرهای داینامیک نام و دامنه سایت
    const rawSiteUrl = useAuthStore((state: any) => state.siteUrl || state.url || state.domain || '');
    const cleanDomain = rawSiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const storeName = cleanDomain ? cleanDomain.split('.')[0].toUpperCase() : 'فروشگاه';
    const storeInitial = storeName.charAt(0).toUpperCase();

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSilentUpdating, setIsSilentUpdating] = useState(false);

    const [globalProcessingCount, setGlobalProcessingCount] = useState(0);

    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const globalSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [activeCustomerFilter, setActiveCustomerFilter] = useState<{id?: number, email?: string, name: string} | null>(null);

    const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
    const isSelectionMode = selectedOrders.length > 0;

    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [invoiceVisible, setInvoiceVisible] = useState(false);
    const invoiceViewRef = useRef<any>(null);

    const [editProductModalVisible, setEditProductModalVisible] = useState(false);
    const [productToEditData, setProductToEditData] = useState<any>(null);
    const [loadingProductEditId, setLoadingProductEditId] = useState<number | null>(null);

    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [statusAccordionOpen, setStatusAccordionOpen] = useState(false);
    const [customerStats, setCustomerStats] = useState({ loading: false, count: 0, total: '0', isGuest: false });

    const [tickedItems, setTickedItems] = useState<number[]>([]);

    const [billingAccordionOpen, setBillingAccordionOpen] = useState(true);
    const [shippingAccordionOpen, setShippingAccordionOpen] = useState(true);
    
    const [noteAccordionOpen, setNoteAccordionOpen] = useState(false);
    const [orderNotes, setOrderNotes] = useState<any[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [newNoteText, setNewNoteText] = useState('');
    const [addingNote, setAddingNote] = useState(false);
    const [noteToCustomer, setNoteToCustomer] = useState(false);

    const [isEditingBilling, setIsEditingBilling] = useState(false);
    const [isEditingShipping, setIsEditingShipping] = useState(false);
    const [billingForm, setBillingForm] = useState<any>({});
    const [shippingForm, setShippingForm] = useState<any>({});
    const [savingAddress, setSavingAddress] = useState(false);

    const [trackingCode, setTrackingCode] = useState('');
    const [sendSmsNotification, setSendSmsNotification] = useState(true);
    const [savingTracking, setSavingTracking] = useState(false);

    const [createOrderVisible, setCreateOrderVisible] = useState(false);
    const [newOrderCustomer, setNewOrderCustomer] = useState({ first_name: '', last_name: '', phone: '', state: '', city: '', address_1: '', postcode: '' });
    
    const [posCustomerNote, setPosCustomerNote] = useState('');
    const [posPaymentMethod, setPosPaymentMethod] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [cart, setCart] = useState<any[]>([]);
    
    const [posDiscount, setPosDiscount] = useState('');
    const [posDiscountType, setPosDiscountType] = useState<'fixed' | 'percent'>('fixed');
    const [posShippingTitle, setPosShippingTitle] = useState('');
    const [posShippingCost, setPosShippingCost] = useState('');
    const [posFeeTitle, setPosFeeTitle] = useState('');
    const [posFeeCost, setPosFeeCost] = useState('');

    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
    const filterScrollRef = useRef<ScrollView>(null);

    const fetchGlobalProcessingCount = async () => {
        try {
            const client = createWooClient();
            const res = await client.get('orders', { params: { status: 'processing', per_page: 1 } });
            const total = res.headers['x-wp-total'] || 0;
            setGlobalProcessingCount(Number(total));
        } catch (e) {}
    };

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            const initScreen = async () => {
                try {
                    const cachedData = await AsyncStorage.getItem('@pishmo_orders_cache');
                    if (cachedData) {
                        const parsedData = JSON.parse(cachedData);
                        if (parsedData && parsedData.length > 0) {
                            setOrders(parsedData);
                            hasCachedData.current = true;
                            setLoading(false);
                        }
                    }
                } catch (e) {}
                
                // 🌟 جایگزینی setTimeout به جای InteractionManager (رفع اخطار)
                setTimeout(() => {
                    fetchGlobalProcessingCount();
                }, 400);
            };
            initScreen();
        }
    }, []);

    const fetchOrders = useCallback(async (pageNum = 1, isRefresh = false, searchStr = globalSearchQuery, cusFilter = activeCustomerFilter) => {
        if (!isRefresh && pageNum === 1) {
            if (hasCachedData.current) setIsSilentUpdating(true);
            else setLoading(true);
        }
        if (pageNum > 1) setLoadingMore(true);

        try {
            const client = createWooClient();
            const params: any = { per_page: 15, page: pageNum };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (cusFilter?.id) params.customer = cusFilter.id;
            else if (cusFilter?.email) params.search = cusFilter.email;
            let query = searchStr.trim();
            if (query !== '' && !cusFilter?.email) { query = query.replace('#', ''); params.search = query; }
            
            const response = await client.get('orders', { params });
            const fetchedOrders = response.data || [];
            
            if (pageNum === 1 || isRefresh) { 
                setOrders(fetchedOrders); 
                hasCachedData.current = true;
                if (query === '' && statusFilter === 'all' && !cusFilter) {
                    await AsyncStorage.setItem('@pishmo_orders_cache', JSON.stringify(fetchedOrders));
                }
            } else { 
                setOrders(prev => [...prev, ...fetchedOrders]); 
            }
            setHasMore(fetchedOrders.length === 15);
            if (isRefresh || pageNum === 1) fetchGlobalProcessingCount();
        } catch (error) { 
        } finally { 
            setLoading(false); setLoadingMore(false); setRefreshing(false); setIsSilentUpdating(false);
        }
    }, [statusFilter, globalSearchQuery, activeCustomerFilter]);

    useEffect(() => { setPage(1); setSelectedOrders([]); fetchOrders(1, false, globalSearchQuery, activeCustomerFilter); }, [statusFilter, activeCustomerFilter]);

    const handleGlobalSearch = (text: string) => {
        setGlobalSearchQuery(text); setPage(1); setSelectedOrders([]);
        if (globalSearchTimeout.current) clearTimeout(globalSearchTimeout.current);
        globalSearchTimeout.current = setTimeout(() => fetchOrders(1, false, text, activeCustomerFilter), 800);
    };

    const handleLoadMore = () => { 
        if (!loading && !loadingMore && hasMore && !isSilentUpdating) { 
            const nextPage = page + 1; setPage(nextPage); fetchOrders(nextPage, false, globalSearchQuery, activeCustomerFilter); 
        } 
    };

    const clearCustomerFilter = () => { setActiveCustomerFilter(null); };

    const handleQuickSwipeComplete = async (order: any) => {
        if (order.status === 'completed') return;
        try {
            const client = createWooClient();
            await client.put(`orders/${order.id}`, { status: 'completed' });
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'completed' } : o));
            if (selectedOrder?.id === order.id) setSelectedOrder({ ...selectedOrder, status: 'completed' });
            fetchGlobalProcessingCount();
        } catch (error) { Alert.alert('خطا', 'تغییر وضعیت انجام نشد.'); }
    };

    const toggleOrderSelection = (id: number) => { setSelectedOrders(prev => { if (prev.includes(id)) return prev.filter(oId => oId !== id); return [...prev, id]; }); };

    const handleBulkComplete = () => {
        Alert.alert('تکمیل گروهی', 'آیا تمام سفارشات انتخاب شده "تکمیل" شوند؟', [
            { text: 'انصراف', style: 'cancel' },
            { text: 'بله', onPress: async () => {
                    setLoading(true);
                    try {
                        const client = createWooClient();
                        await client.post('orders/batch', { update: selectedOrders.map(id => ({ id, status: 'completed' })) });
                        setSelectedOrders([]); setPage(1); fetchOrders(1, true);
                    } catch (e) { Alert.alert('خطا', 'مشکلی پیش آمد.'); setLoading(false); }
                }
            }
        ]);
    };

    const handleBulkDelete = () => {
        Alert.alert('حذف گروهی', 'سفارشات انتخاب شده برای همیشه حذف خواهند شد. مطمئن هستید؟', [
            { text: 'انصراف', style: 'cancel' },
            { text: 'حذف شوند', style: 'destructive', onPress: async () => {
                    setLoading(true);
                    try {
                        const client = createWooClient();
                        await client.post('orders/batch', { delete: selectedOrders });
                        setSelectedOrders([]); setPage(1); fetchOrders(1, true);
                    } catch (e) { Alert.alert('خطا', 'مشکلی پیش آمد.'); setLoading(false); }
                }
            }
        ]);
    };

    const confirmUpdateStatus = (orderId: number, newStatus: string, statusLabel: string) => {
        Alert.alert('تایید تغییر وضعیت', `وضعیت این سفارش به "${statusLabel}" تغییر کند؟`, [
            { text: 'انصراف', style: 'cancel' },
            { text: 'بله', style: 'default', onPress: async () => {
                    setUpdatingStatus(true);
                    try {
                        const client = createWooClient();
                        await client.put(`orders/${orderId}`, { status: newStatus });
                        Alert.alert('موفق', 'وضعیت با موفقیت به‌روزرسانی شد.');
                        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
                        if (selectedOrder && selectedOrder.id === orderId) setSelectedOrder({ ...selectedOrder, status: newStatus });
                        setStatusAccordionOpen(false);
                        fetchGlobalProcessingCount();
                    } catch (error) { Alert.alert('خطا', 'تغییر وضعیت انجام نشد.'); } finally { setUpdatingStatus(false); }
                }
            }
        ]);
    };

    const confirmDeleteSingleOrder = (orderId: number) => {
        Alert.alert('حذف سفارش', 'آیا از حذف کامل این سفارش مطمئن هستید؟', [
            { text: 'انصراف', style: 'cancel' },
            { text: 'حذف شود', style: 'destructive', onPress: async () => {
                    setUpdatingStatus(true);
                    try {
                        const client = createWooClient();
                        await client.delete(`orders/${orderId}`, { params: { force: true } });
                        setModalVisible(false);
                        setOrders(prev => prev.filter(o => o.id !== orderId));
                        fetchGlobalProcessingCount();
                    } catch (e) { Alert.alert('خطا', 'حذف سفارش انجام نشد.'); } finally { setUpdatingStatus(false); }
                }
            }
        ]);
    };

    const getShippingInfo = (order: any) => { return { title: order.shipping_lines?.[0]?.method_title || order.shipping_lines?.[0]?.title || 'ارسال استاندارد', total: order.shipping_lines?.[0]?.total || '0' }; };

    const handleCopyText = async (text: string, title: string) => { if (!text) return; await Clipboard.setStringAsync(text); Alert.alert('کپی شد', `${title} کپی شد.`); };

    const handleAction = async (url: string, errorMsg: string) => { 
        try { await Linking.openURL(url); } catch (error) { Alert.alert('خطا', errorMsg); }
    };

    const shareInvoiceAsImage = async () => {
        try {
            if (invoiceViewRef.current && invoiceViewRef.current.capture) {
                const uri = await invoiceViewRef.current.capture();
                if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri, { UTI: 'image/jpeg', mimeType: 'image/jpeg', dialogTitle: `فاکتور سفارش #${selectedOrder?.id}` }); } else Alert.alert('خطا', 'اشتراک‌گذاری پشتیبانی نمی‌شود.');
            }
        } catch (error) { Alert.alert('خطا', 'تولید تصویر با مشکل مواجه شد.'); }
    };

    const handleShareInvoiceText = async () => {
        if (!selectedOrder) return;
        try {
            const buyerName = `${selectedOrder.billing?.first_name || ''} ${selectedOrder.billing?.last_name || ''}`.trim();
            const dateStr = toShamsi(selectedOrder.date_created, true);
            const itemsList = selectedOrder.line_items?.map((item: any) => `▪️ ${item.name} (${item.quantity} عدد) - ${formatPrice(item.total)} تومان`).join('\n') || '';
            const discountTotal = parseFloat(selectedOrder.discount_total || '0');
            const discountTxt = discountTotal > 0 ? `\n🎁 تخفیف اعمال شده: ${formatPrice(discountTotal)} تومان` : '';
            const message = `🛍️ فاکتور فروشگاه آنلاین\n----------------------------------\n🧾 شماره فاکتور: #${selectedOrder.id}\n📅 تاریخ: ${dateStr}\n👤 خریدار: ${buyerName || 'مشتری'}\n📞 تلفن: ${selectedOrder.billing?.phone || '---'}\n📍 آدرس: ${selectedOrder.billing?.state || ''}، ${selectedOrder.billing?.city || ''}، ${selectedOrder.billing?.address_1 || ''}\n----------------------------------\n📦 اقلام سفارش:\n${itemsList}\n----------------------------------\n🚚 روش ارسال: ${getShippingInfo(selectedOrder).title}${discountTxt}\n💳 درگاه پرداخت: ${selectedOrder.payment_method_title || '---'}\n💰 مبلغ کل پرداختی: ${formatPrice(selectedOrder.total)} تومان\n----------------------------------\n💜 با تشکر از خرید شما`;
            await Share.share({ message: message, title: `فاکتور سفارش #${selectedOrder.id}` });
        } catch (error) { Alert.alert('خطا', 'اشتراک‌گذاری فاکتور با مشکل مواجه شد.'); }
    };

    const handleOpenModal = (order: any) => {
        setSelectedOrder(order);
        setTickedItems([]); 
        setBillingForm(order.billing || {});
        setShippingForm(order.shipping || {});
        setIsEditingBilling(false); setIsEditingShipping(false);
        setBillingAccordionOpen(true);
        setShippingAccordionOpen(true);
        setStatusAccordionOpen(false);
        setNoteAccordionOpen(false);
        
        const existingTracking = order.meta_data?.find((m: any) => m.key === '_pishmo_tracking_code');
        setTrackingCode(existingTracking?.value || '');
        
        setModalVisible(true);
        setCustomerStats({ loading: true, count: 0, total: '0', isGuest: false });
        
        const client = createWooClient();
        const searchParam = order.customer_id > 0 ? { customer: order.customer_id } : { search: order.billing?.email };
        client.get('orders', { params: { ...searchParam, per_page: 30, _fields: 'id,status,total' } }).then(res => {
            const validOrders = res.data.filter((o: any) => o.status === 'completed' || o.status === 'processing');
            const count = validOrders.length;
            const totalSpent = validOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total || '0'), 0);
            setCustomerStats({ loading: false, count: count > 0 ? count : 0, total: totalSpent > 0 ? totalSpent : '0', isGuest: order.customer_id === 0 });
        }).catch(() => { setCustomerStats({ loading: false, count: 0, total: '0', isGuest: order.customer_id === 0 }); });
    };

    const handleDirectEditProduct = async (productId: number) => {
        setLoadingProductEditId(productId);
        try {
            const client = createWooClient();
            const res = await client.get(`products/${productId}`);
            setProductToEditData(res.data);
            setModalVisible(false);
            setTimeout(() => { setEditProductModalVisible(true); }, 200);
        } catch (error) {
            Alert.alert('خطا', 'دریافت اطلاعات این محصول از سایت با مشکل مواجه شد.');
        } finally {
            setLoadingProductEditId(null);
        }
    };

    const fetchOrderNotes = async (orderId: number) => {
        setLoadingNotes(true);
        try {
            const client = createWooClient();
            const res = await client.get(`orders/${orderId}/notes`);
            setOrderNotes(res.data || []);
        } catch (e) {
            console.log(e);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleAddNote = async () => {
        if(!newNoteText.trim()) return;
        setAddingNote(true);
        try {
            const client = createWooClient();
            const res = await client.post(`orders/${selectedOrder.id}/notes`, {
                note: newNoteText,
                customer_note: noteToCustomer
            });
            setOrderNotes([res.data, ...orderNotes]);
            setNewNoteText('');
        } catch(e) { Alert.alert('خطا', 'ثبت یادداشت ناموفق بود.'); }
        finally { setAddingNote(false); }
    };

    const handleDeleteNote = (noteId: number) => {
        Alert.alert('حذف یادداشت', 'مطمئن هستید؟', [
            { text: 'انصراف', style: 'cancel' },
            { text: 'حذف', style: 'destructive', onPress: async () => {
                try {
                    const client = createWooClient();
                    await client.delete(`orders/${selectedOrder.id}/notes/${noteId}`, { params: { force: true } });
                    setOrderNotes(orderNotes.filter(n => n.id !== noteId));
                } catch(e) { Alert.alert('خطا', 'حذف ناموفق بود.'); }
            }}
        ]);
    };

    const sendSmsAsync = async (order: any, tCode: string) => {
        const smsEnabled = await AsyncStorage.getItem('@sms_enabled');
        if (smsEnabled !== 'true') return;
        const apiUrl = await AsyncStorage.getItem('@sms_api_url') || '';
        const apiKey = await AsyncStorage.getItem('@sms_api_key') || '';
        const username = await AsyncStorage.getItem('@sms_username') || '';
        const password = await AsyncStorage.getItem('@sms_password') || '';
        const sender = await AsyncStorage.getItem('@sms_sender_num') || '';
        const authMethod = await AsyncStorage.getItem('@sms_auth_method') || 'apikey';
        const patternsStr = await AsyncStorage.getItem('@sms_patterns');

        if (!apiUrl || !patternsStr) throw new Error('تنظیمات پیامک کامل نیست');

        const parsedPatterns = JSON.parse(patternsStr);
        const trackingPattern = parsedPatterns[0]; 

        if (trackingPattern) {
            let testVars = trackingPattern.variables
                .replace(/\[first_name\]/g, encodeURIComponent(order.billing.first_name || 'مشتری'))
                .replace(/\[last_name\]/g, encodeURIComponent(order.billing.last_name || ''))
                .replace(/\[order_id\]/g, encodeURIComponent(order.id.toString()))
                .replace(/\[tracking_code\]/g, encodeURIComponent(tCode));

            let finalUrl = apiUrl
                .replace(/\[phone\]/g, encodeURIComponent(order.billing.phone))
                .replace(/\[sender\]/g, encodeURIComponent(sender));

            if (authMethod === 'apikey') {
                finalUrl = finalUrl.replace(/\[apikey\]/g, encodeURIComponent(apiKey)).replace(/\[username\]/g, encodeURIComponent(username));
            } else {
                finalUrl = finalUrl.replace(/\[username\]/g, encodeURIComponent(username)).replace(/\[password\]/g, encodeURIComponent(password));
            }

            finalUrl = finalUrl.replace(/\[pattern\]/g, encodeURIComponent(trackingPattern.code)).replace(/\[variables\]/g, testVars);

            const reqMethod = (finalUrl.toLowerCase().includes('.asmx') || finalUrl.toLowerCase().includes('post')) ? 'POST' : 'GET';
            let reqUrl = finalUrl;
            let reqData = null;

            if (reqMethod === 'POST' && finalUrl.includes('?')) {
                const parts = finalUrl.split('?');
                reqUrl = parts[0];
                reqData = parts[1];
            }

            const response = await axios({
                method: reqMethod,
                url: reqUrl,
                data: reqData,
                headers: reqMethod === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined
            });

            const responseDataStr = String(response.data).toLowerCase();
            let isMeliError = false;
            let meliErrorStr = '';
            if (responseDataStr.includes('http://tempuri.org/')) {
                const match = responseDataStr.match(/>([^<]+)<\/string>/);
                if (match && match[1].trim().length < 10) { isMeliError = true; meliErrorStr = match[1].trim(); }
            }

            if (response.status !== 200 || responseDataStr.includes('false') || responseDataStr.includes('error') || isMeliError) {
                let niceError = meliErrorStr;
                if(meliErrorStr === '11') niceError = '11 (متغیرها همخوانی ندارند)';
                if(meliErrorStr === '0' || meliErrorStr === '2') niceError = '0 (نام کاربری/رمز اشتباه است)';
                if(meliErrorStr === '6') niceError = '6 (موجودی پنل کافی نیست)';
                throw new Error(`خطای پنل پیامک: ${niceError || 'نامشخص'}`);
            }
        }
    };

    const handleSaveTrackingCode = async () => {
        if (!selectedOrder || !trackingCode.trim()) return Alert.alert('خطا', 'لطفا کد پیگیری پستی را وارد کنید.');
        setSavingTracking(true);
        try {
            const authState = useAuthStore.getState();
            const tCode = trackingCode.trim();
            const updatedMeta = [...(selectedOrder.meta_data || []).filter((m: any) => m.key !== '_pishmo_tracking_code'), { key: '_pishmo_tracking_code', value: tCode }];
            const updatedOrder = { ...selectedOrder, status: 'completed', meta_data: updatedMeta };
            setSelectedOrder(updatedOrder); setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o));
            fetchGlobalProcessingCount();

            let smsStatusMessage = '';
            if (sendSmsNotification && selectedOrder.billing?.phone) {
                try {
                    await sendSmsAsync(selectedOrder, tCode);
                    smsStatusMessage = '\n📩 پیامک با موفقیت ارسال شد.';
                } catch (smsError: any) { smsStatusMessage = `\n\n⚠️ پیامک ارسال نشد!\nدلیل: ${smsError.message}`; }
            }
            await axios.post(`${authState.siteUrl}/wp-json/pishmo/v1/submit-tracking`, { order_id: selectedOrder.id, tracking_code: tCode, status: 'completed' });
            Alert.alert('وضعیت ثبت', `کد رهگیری پستی ثبت شد.${smsStatusMessage}`);
        } catch (error) { Alert.alert('اخطار', 'مشکلی در ارتباط با سایت پیش آمد.'); } finally { setSavingTracking(false); }
    };

    const handleSaveAddress = async (type: 'billing' | 'shipping') => {
        if (!selectedOrder) return;
        setSavingAddress(true);
        try {
            const client = createWooClient();
            const payload = type === 'billing' ? { billing: billingForm } : { shipping: shippingForm };
            await client.put(`orders/${selectedOrder.id}`, payload);
            Alert.alert('موفق', `آدرس به‌روزرسانی شد.`);
            const updatedOrder = { ...selectedOrder, [type]: type === 'billing' ? billingForm : shippingForm };
            setSelectedOrder(updatedOrder); setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o));
            if (type === 'billing') setIsEditingBilling(false); if (type === 'shipping') setIsEditingShipping(false);
        } catch (error) { Alert.alert('خطا', 'به‌روزرسانی با شکست مواجه شد.'); } finally { setSavingAddress(false); }
    };

    const handleSearchProduct = (text: string) => {
        setSearchQuery(text);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (!text.trim()) { setSearchResults([]); return; }
        setIsSearching(true);
        searchTimeout.current = setTimeout(async () => {
            try { const client = createWooClient(); const res = await client.get('products', { params: { search: text, per_page: 15 } }); setSearchResults(res.data || []); } catch (error) { } finally { setIsSearching(false); }
        }, 800);
    };

    const addProductToCart = (product: any) => {
        const exist = cart.find(c => c.product_id === product.id);
        if (exist) setCart(cart.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
        else setCart([...cart, { product_id: product.id, name: product.name, price: product.price, quantity: 1, image: product.images?.[0]?.src }]);
        setSearchQuery(''); setSearchResults([]);
    };
    const updateCartQty = (id: number, delta: number) => { setCart(cart.map(c => { if (c.product_id === id) { const newQty = c.quantity + delta; return newQty > 0 ? { ...c, quantity: newQty } : c; } return c; })); };
    const removeProductFromCart = (id: number) => { setCart(cart.filter(c => c.product_id !== id)); };
    const updateCartPrice = (id: number, newPrice: string) => { setCart(cart.map(c => { if (c.product_id === id) { return { ...c, price: newPrice }; } return c; })); };

    const cartTotalRaw = cart.reduce((sum, c) => sum + (Number(c.price || 0) * c.quantity), 0);
    let discountAmountRaw = 0;
    if (posDiscount && parseFloat(posDiscount) > 0) {
        if (posDiscountType === 'percent') { discountAmountRaw = (cartTotalRaw * parseFloat(posDiscount)) / 100; } 
        else { discountAmountRaw = parseFloat(posDiscount); }
    }
    const shippingAmountRaw = Number(posShippingCost) || 0;
    const feeAmountRaw = Number(posFeeCost) || 0;
    const finalGrandTotal = cartTotalRaw - discountAmountRaw + shippingAmountRaw + feeAmountRaw;

    const submitManualOrder = async () => {
        if (!newOrderCustomer.first_name || cart.length === 0) return;
        setIsSubmittingOrder(true);
        try {
            const client = createWooClient();
            
            const fee_lines = [];
            if (discountAmountRaw > 0) fee_lines.push({ name: 'تخفیف مدیریت', total: `-${discountAmountRaw}` });
            if (feeAmountRaw > 0) fee_lines.push({ name: posFeeTitle || 'هزینه خدمات', total: String(feeAmountRaw) });

            const shipping_lines = [];
            if (shippingAmountRaw > 0) shipping_lines.push({ method_id: 'flat_rate', method_title: posShippingTitle || 'حمل و نقل', total: String(shippingAmountRaw) });

            const orderPayload: any = { 
                payment_method: 'bacs', 
                payment_method_title: posPaymentMethod.trim() ? posPaymentMethod : 'ثبت دستی توسط مدیر', 
                set_paid: false, 
                customer_note: posCustomerNote,
                billing: { ...newOrderCustomer }, 
                shipping: { ...newOrderCustomer }, 
                line_items: cart.map(c => ({ product_id: c.product_id, quantity: c.quantity, total: String(Number(c.price || 0) * c.quantity) })),
                fee_lines: fee_lines.length > 0 ? fee_lines : undefined,
                shipping_lines: shipping_lines.length > 0 ? shipping_lines : undefined,
            };
            
            await client.post('orders', orderPayload);
            Alert.alert('موفقیت 🎉', 'سفارش دستی با موفقیت ثبت شد!');
            
            setCreateOrderVisible(false); setCart([]); setPosDiscount(''); setPosDiscountType('fixed'); 
            setPosShippingTitle(''); setPosShippingCost(''); setPosFeeTitle(''); setPosFeeCost('');
            setPosCustomerNote(''); setPosPaymentMethod('');
            setNewOrderCustomer({ first_name: '', last_name: '', phone: '', state: '', city: '', address_1: '', postcode: '' }); 
            setPage(1); fetchOrders(1, true);
        } catch (error) { Alert.alert('خطا', 'ثبت سفارش با مشکل مواجه شد.'); } finally { setIsSubmittingOrder(false); }
    };

    return (
        <View style={styles.container}>

            {loadingProductEditId && (
                <Modal transparent visible={true} animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#fff', padding: 25, borderRadius: 16, alignItems: 'center', elevation: 10 }}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={{ marginTop: 15, fontWeight: '900', color: '#0f172a', fontSize: 13 }}>در حال دریافت اطلاعات کالا...</Text>
                            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 5, fontWeight: 'bold' }}>لطفا چند لحظه صبر کنید</Text>
                        </View>
                    </View>
                </Modal>
            )}

            {editProductModalVisible && (
                <AddProductModal 
                    visible={editProductModalVisible} 
                    onClose={() => setEditProductModalVisible(false)} 
                    onSuccess={() => {
                        setEditProductModalVisible(false);
                        Alert.alert('موفق', 'ویرایش محصول ثبت شد.');
                    }} 
                    productToEdit={productToEditData} 
                />
            )}

            {isSelectionMode ? (
                <View style={styles.bulkHeader}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => setSelectedOrders([])} style={{ marginLeft: 15 }}><Feather name="x" size={24} color="#64748b" /></TouchableOpacity>
                        <Text style={{ fontWeight: '900', fontSize: 16, color: '#0f172a' }}>{selectedOrders.length} مورد انتخاب شده</Text>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', gap: 15 }}>
                        <TouchableOpacity style={styles.bulkActionBtn} onPress={handleBulkDelete}><Feather name="trash-2" size={18} color="#ef4444" /></TouchableOpacity>
                        <TouchableOpacity style={styles.bulkActionBtn} onPress={handleBulkComplete}><Feather name="check-circle" size={18} color="#10b981" /></TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>سفارشات فروشگاه</Text>
                </View>
            )}

            <View style={styles.globalSearchContainer}>
                <View style={styles.searchRowWrapper}>
                    <View style={styles.globalSearchBox}>
                        <Feather name="search" size={18} color="#64748b" style={styles.globalSearchIcon} />
                        <TextInput style={styles.globalSearchInput} placeholder="جستجو با کد، نام..." placeholderTextColor="#94a3b8" value={globalSearchQuery} onChangeText={handleGlobalSearch} textAlign="right" returnKeyType="search" />
                    </View>
                    
                    {!isSelectionMode && (
                        <TouchableOpacity style={styles.addOrderBtnOnlyIcon} onPress={() => setCreateOrderVisible(true)}>
                            <Feather name="plus" size={24} color="#ffffff" />
                        </TouchableOpacity>
                    )}
                </View>

                {isSilentUpdating && (
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
                        <ActivityIndicator size="small" color="#EC5B38" style={{ marginLeft: 5 }} />
                        <Text style={{ fontSize: 10, color: '#EC5B38' }}>درحال دریافت سفارشات جدید...</Text>
                    </View>
                )}
            </View>

            {activeCustomerFilter && (
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: 10, borderBottomWidth: 1, borderBottomColor: '#bfdbfe' }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1d4ed8' }}>🛍️ فیلتر خریدهای: {activeCustomerFilter.name}</Text>
                    <TouchableOpacity onPress={clearCustomerFilter} style={{ padding: 4, backgroundColor: '#dbeafe', borderRadius: 8 }}>
                        <Feather name="x" size={18} color="#1e40af" />
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={filterScrollRef} onLayout={() => { setTimeout(() => filterScrollRef.current?.scrollToEnd({ animated: true }), 100); }} contentContainerStyle={styles.filterScroll}>
                    {[...filterTabs].reverse().map((tab) => {
                        return (
                            <TouchableOpacity key={tab.id} style={[styles.filterBtn, statusFilter === tab.id && styles.filterBtnActive]} onPress={() => setStatusFilter(tab.id)}>
                                {tab.id === 'processing' && globalProcessingCount > 0 && (
                                    <View style={[styles.tabBadgeOverlapping, { backgroundColor: '#bbf7d0', borderColor: '#f8fafc' }]}>
                                        <Text style={[styles.tabBadgeTxt, { color: '#166534' }]}>{globalProcessingCount}</Text>
                                    </View>
                                )}
                                <Text style={[styles.filterBtnTxt, statusFilter === tab.id && styles.filterBtnTxtActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {loading && page === 1 && orders.length === 0 ? (
                <View style={styles.centerContainer}><ActivityIndicator size="large" color="#0f172a" /></View>
            ) : orders.length === 0 ? (
                <View style={styles.centerContainer}><Feather name="shopping-bag" size={48} color="#cbd5e1" /><Text style={styles.emptyTxt}>سفارشی یافت نشد.</Text></View>
            ) : (
                <FlatList
                    data={orders}
                    extraData={selectedOrders}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setPage(1); fetchOrders(1, true); }} colors={['#0f172a']} />}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.1}
                    ListFooterComponent={loadingMore ? (
                        <View style={styles.footerLoader}>
                            <ActivityIndicator size="large" color="#EC5B38" />
                            <Text style={styles.footerLoaderTxt}>در حال دریافت سفارشات بیشتر...</Text>
                        </View>
                    ) : <View style={{ height: 60 }} />}
                    renderItem={({ item }) => {
                        const isSelected = selectedOrders.includes(item.id);
                        return (
                            <TouchableOpacity
                                activeOpacity={1}
                                onPress={() => isSelectionMode ? toggleOrderSelection(item.id) : null}
                                onLongPress={() => {
                                    if (!isSelectionMode) toggleOrderSelection(item.id);
                                }}
                            >
                                <View pointerEvents={isSelectionMode ? 'none' : 'auto'}>
                                    <SwipeableOrderCard item={item} onOpenModal={() => handleOpenModal(item)} onLongPress={() => toggleOrderSelection(item.id)} onCompleteSwipe={handleQuickSwipeComplete} isSelected={isSelected} />
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            <Modal visible={createOrderVisible} animationType="slide" onRequestClose={() => setCreateOrderVisible(false)}>
                <View style={styles.posContainer}>
                    <View style={styles.posHeader}>
                        <Text style={styles.posHeaderTitle}>ثبت سفارش ‌جدید (مدیر)</Text>
                        <TouchableOpacity onPress={() => setCreateOrderVisible(false)}><Feather name="x" size={24} color="#64748b" /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
                        <View style={styles.posSection}>
                            <Text style={styles.posSectionTitle}>۱. مشخصات مشتری</Text>
                            <TextInput style={styles.posInput} placeholder="نام مشتری (الزامی)" value={newOrderCustomer.first_name} onChangeText={(t) => setNewOrderCustomer({ ...newOrderCustomer, first_name: t })} textAlign="right" />
                            <TextInput style={styles.posInput} placeholder="نام خانوادگی" value={newOrderCustomer.last_name} onChangeText={(t) => setNewOrderCustomer({ ...newOrderCustomer, last_name: t })} textAlign="right" />
                            <TextInput style={styles.posInput} placeholder="شماره موبایل" value={newOrderCustomer.phone} onChangeText={(t) => setNewOrderCustomer({ ...newOrderCustomer, phone: t })} keyboardType="phone-pad" textAlign="right" />
                            <TextInput style={styles.posInput} placeholder="استان" value={newOrderCustomer.state} onChangeText={(t) => setNewOrderCustomer({ ...newOrderCustomer, state: t })} textAlign="right" />
                            <TextInput style={styles.posInput} placeholder="شهر" value={newOrderCustomer.city} onChangeText={(t) => setNewOrderCustomer({ ...newOrderCustomer, city: t })} textAlign="right" />
                            <TextInput style={[styles.posInput, { height: 60 }]} multiline placeholder="آدرس کامل" value={newOrderCustomer.address_1} onChangeText={(t) => setNewOrderCustomer({ ...newOrderCustomer, address_1: t })} textAlign="right" />
                            <TextInput style={styles.posInput} placeholder="کد پستی" value={newOrderCustomer.postcode} onChangeText={(t) => setNewOrderCustomer({ ...newOrderCustomer, postcode: t })} keyboardType="numeric" textAlign="right" />
                            <TextInput style={[styles.posInput, { height: 60 }]} multiline placeholder="یادداشت سفارش (اختیاری)" value={posCustomerNote} onChangeText={setPosCustomerNote} textAlign="right" />
                        </View>
                        
                        <View style={styles.posSection}>
                            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={styles.posSectionTitle}>۲. افزودن محصول</Text>
                                {isSearching && <ActivityIndicator size="small" color="#3b82f6" />}
                            </View>
                            <TextInput style={[styles.posInput, { borderColor: '#3b82f6', borderWidth: 1 }]} placeholder="نام محصول..." value={searchQuery} onChangeText={handleSearchProduct} textAlign="right" />
                            
                            {searchResults.length > 0 && (
                                <ScrollView style={styles.posSearchResults} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                                    {searchResults.map((prod) => (
                                        <TouchableOpacity key={prod.id} style={styles.posResultItem} onPress={() => addProductToCart(prod)}>
                                            <Text style={styles.posResultTxt} numberOfLines={1}>{prod.name}</Text>
                                            <Feather name="plus-circle" size={18} color="#10b981" />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>

                        <View style={styles.posSection}>
                            <Text style={styles.posSectionTitle}>۳. سبد خرید (تخفیف تکی)</Text>
                            {cart.length === 0 ? <Text style={styles.emptyCartTxt}>سبد خالی است.</Text> : (
                                cart.map((c, i) => (
                                    <View key={i} style={styles.posCartItem}>
                                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text style={styles.posCartName} numberOfLines={1}>{c.name}</Text>
                                            <TouchableOpacity onPress={() => removeProductFromCart(c.product_id)}><Feather name="trash-2" size={16} color="#ef4444" /></TouchableOpacity>
                                        </View>
                                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }}>
                                                <Text style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>فی:</Text>
                                                <TextInput 
                                                    style={styles.posCartPriceInput} 
                                                    value={String(c.price)} 
                                                    onChangeText={(t) => updateCartPrice(c.product_id, t)} 
                                                    keyboardType="numeric" 
                                                    textAlign="center" 
                                                />
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 4 }}>
                                                <TouchableOpacity style={{ padding: 6 }} onPress={() => updateCartQty(c.product_id, 1)}><Feather name="plus" size={14} color="#0f172a" /></TouchableOpacity>
                                                <Text style={{ marginHorizontal: 8, fontWeight: 'bold', fontSize: 13 }}>{c.quantity}</Text>
                                                <TouchableOpacity style={{ padding: 6 }} onPress={() => updateCartQty(c.product_id, -1)}><Feather name="minus" size={14} color="#0f172a" /></TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                        
                        <View style={styles.posMaliCard}>
                            <Text style={styles.posSectionTitle}>۴. فاکتور مالی و ارسال</Text>
                            
                            <View style={styles.posMaliRow}>
                                <TextInput style={[styles.posInput, styles.posMaliInputHalf, {marginLeft: 8}]} placeholder="هزینه (تومان)" value={posShippingCost} onChangeText={setPosShippingCost} keyboardType="numeric" textAlign="right" />
                                <TextInput style={[styles.posInput, styles.posMaliInputHalf]} placeholder="روش ارسال (مثلاً پست)" value={posShippingTitle} onChangeText={setPosShippingTitle} textAlign="right" />
                            </View>

                            <View style={styles.posMaliRow}>
                                <TextInput style={[styles.posInput, styles.posMaliInputHalf, {marginLeft: 8}]} placeholder="مبلغ هزینه (تومان)" value={posFeeCost} onChangeText={setPosFeeCost} keyboardType="numeric" textAlign="right" />
                                <TextInput style={[styles.posInput, styles.posMaliInputHalf]} placeholder="هزینه اضافه (مثلاً بسته‌بندی)" value={posFeeTitle} onChangeText={setPosFeeTitle} textAlign="right" />
                            </View>

                            <TextInput style={[styles.posInput, { marginTop: 10 }]} placeholder="نحوه پرداخت (مثال: کارت به کارت، کیف پول)" value={posPaymentMethod} onChangeText={setPosPaymentMethod} textAlign="right" />

                            <View style={styles.discountContainer}>
                                <Text style={{fontSize: 12, fontWeight: 'bold', color: '#be123c', textAlign: 'right', marginBottom: 8}}>تخفیف روی کل فاکتور</Text>
                                <View style={styles.discountTypeTabs}>
                                    <TouchableOpacity style={[styles.discountTab, posDiscountType === 'fixed' && styles.discountTabActive]} onPress={() => setPosDiscountType('fixed')}><Text style={[styles.discountTabTxt, posDiscountType === 'fixed' && styles.discountTabTxtActive]}>مبلغی (تومان)</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.discountTab, posDiscountType === 'percent' && styles.discountTabActive]} onPress={() => setPosDiscountType('percent')}><Text style={[styles.discountTabTxt, posDiscountType === 'percent' && styles.discountTabTxtActive]}>درصدی (%)</Text></TouchableOpacity>
                                </View>
                                <TextInput style={[styles.posInput, { borderColor: '#fecdd3', backgroundColor: '#fff', marginBottom: 0 }]} placeholder={posDiscountType === 'fixed' ? "مبلغ تخفیف را وارد کنید" : "درصد تخفیف را وارد کنید"} value={posDiscount} onChangeText={setPosDiscount} keyboardType="numeric" textAlign="center" />
                            </View>
                        </View>

                        <View style={styles.liveCalculatorBox}>
                            <View style={styles.liveRow}><Text style={styles.liveLabel}>مبلغ کالاها:</Text><Text style={styles.liveValue}>{formatPrice(cartTotalRaw)} تومان</Text></View>
                            {shippingAmountRaw > 0 && <View style={styles.liveRow}><Text style={styles.liveLabel}>هزینه ارسال:</Text><Text style={styles.liveValue}>+ {formatPrice(shippingAmountRaw)}</Text></View>}
                            {feeAmountRaw > 0 && <View style={styles.liveRow}><Text style={styles.liveLabel}>هزینه اضافه:</Text><Text style={styles.liveValue}>+ {formatPrice(feeAmountRaw)}</Text></View>}
                            {discountAmountRaw > 0 && <View style={styles.liveRow}><Text style={[styles.liveLabel, {color:'#e11d48'}]}>تخفیف کسر شده:</Text><Text style={[styles.liveValue, {color:'#e11d48'}]}>- {formatPrice(discountAmountRaw)}</Text></View>}
                            <View style={styles.liveTotalDivider} />
                            <View style={styles.liveRow}><Text style={styles.liveTotalLabel}>مبلغ نهایی قابل پرداخت:</Text><Text style={styles.liveTotalValue}>{formatPrice(finalGrandTotal > 0 ? finalGrandTotal : 0)} تومان</Text></View>
                        </View>

                        <TouchableOpacity style={[styles.posSubmitBtn, isSubmittingOrder && { opacity: 0.7 }]} onPress={submitManualOrder} disabled={isSubmittingOrder}>
                            {isSubmittingOrder ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.posSubmitTxt}>ثبت نهایی سفارش</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setModalVisible(false)}><Feather name="x" size={24} color="#64748b" /></TouchableOpacity>
                            <Text style={styles.modalTitle}>جزئیات فاکتور #{selectedOrder?.id}</Text>
                        </View>

                        {selectedOrder && (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                                <View style={styles.attractiveHeaderBox}>
                                    <View style={styles.headerBoxRow}>
                                        <Text style={styles.headerBoxBuyer}>👤 {selectedOrder.billing?.first_name} {selectedOrder.billing?.last_name}</Text>
                                        <Text style={styles.headerBoxId}>#{selectedOrder.id}</Text>
                                    </View>
                                    <View style={[styles.headerBoxRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                                        <Text style={styles.headerBoxDate}>📅 {toShamsi(selectedOrder.date_created, true)}</Text>
                                        <View style={[styles.statusBadgeMini, { backgroundColor: renderStatusBadge(selectedOrder.status).bg }]}><Text style={[styles.statusTxtMini, { color: renderStatusBadge(selectedOrder.status).color }]}>{renderStatusBadge(selectedOrder.status).label}</Text></View>
                                    </View>
                                </View>

                                <View style={styles.accordionCard}>
                                    <TouchableOpacity style={styles.accordionHeader} onPress={() => setStatusAccordionOpen(!statusAccordionOpen)}>
                                        <Feather name={statusAccordionOpen ? "chevron-up" : "chevron-down"} size={20} color="#475569" />
                                        <Text style={styles.accordionTitle}>تغییر وضعیت و تنظیمات سفارش</Text>
                                    </TouchableOpacity>
                                    {statusAccordionOpen && (
                                        <View style={styles.accordionContent}>
                                            <View style={styles.statusActionBox}>
                                                {[{ id: 'processing', label: 'در حال انجام' }, { id: 'completed', label: 'تکمیل شده' }, { id: 'pending', label: 'در انتظار پرداخت' }, { id: 'on-hold', label: 'در انتظار بررسی' }, { id: 'failed', label: 'ناموفق' }, { id: 'cancelled', label: 'لغو شده' }].map((st) => {
                                                    const bgInfo = renderStatusBadge(st.id);
                                                    const isCurrent = selectedOrder.status === st.id;
                                                    return (
                                                        <TouchableOpacity key={st.id} style={[styles.statusActionBtn, isCurrent ? { backgroundColor: bgInfo.color } : { borderColor: bgInfo.color, borderWidth: 1 }]} onPress={() => confirmUpdateStatus(selectedOrder.id, st.id, st.label)}>
                                                            <Text style={[styles.statusActionTxt, isCurrent ? { color: '#fff' } : { color: bgInfo.color }]}>{st.label}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                            {updatingStatus && <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 5, marginBottom: 10 }} />}
                                            <TouchableOpacity style={styles.singleDeleteBtn} onPress={() => confirmDeleteSingleOrder(selectedOrder.id)}><Feather name="trash-2" size={16} color="#ef4444" /><Text style={styles.singleDeleteTxt}>حذف کامل این سفارش</Text></TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                <Text style={styles.sectionMainTitle}>🛒 اقلام خریداری شده (برای تیک زدن کلیک کنید):</Text>
                                {selectedOrder.line_items?.map((item: any, idx: number) => {
                                    const qtyNum = parseInt(item.quantity) || 1;
                                    const isTicked = tickedItems.includes(item.id); 
                                    return (
                                        <TouchableOpacity 
                                            key={idx} 
                                            activeOpacity={0.8}
                                            onPress={() => setTickedItems(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])}
                                            style={[styles.singleProductCard, isTicked && { backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 2 }]}
                                        >
                                            {isTicked && <View style={styles.tickedIconFloat}><Feather name="check" size={20} color="#16a34a" /></View>}
                                            
                                            <View style={styles.productTopArea}>
                                                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }}>
                                                    <TouchableOpacity 
                                                        style={styles.directEditBtn}
                                                        onPress={() => handleDirectEditProduct(item.product_id)}
                                                    >
                                                        {loadingProductEditId === item.product_id ? (
                                                            <ActivityIndicator size="small" color="#3b82f6" />
                                                        ) : (
                                                            <Feather name="edit-2" size={14} color="#3b82f6" />
                                                        )}
                                                    </TouchableOpacity>
                                                    
                                                    <View style={styles.productInfoBox}>
                                                        <Text style={[styles.productNameTxt, isTicked && { color: '#166534' }]} numberOfLines={2}>{item.name}</Text>
                                                        {item.meta_data?.map((m: any, mIdx: number) => { if (m.key.startsWith('_')) return null; return <Text key={mIdx} style={styles.productMetaTxt}>{m.display_key}: {m.display_value}</Text>; })}
                                                    </View>
                                                </View>
                                                {item.image?.src ? <Image source={{ uri: item.image.src }} style={styles.productImg} /> : <View style={styles.productImgPlaceholder}><Feather name="box" size={20} color="#94a3b8" /></View>}
                                            </View>
                                            <View style={styles.thinDivider} />
                                            <View style={styles.productBottomArea}>
                                                <Text style={styles.productPriceTxt}>قیمت واحد: {formatPrice(item.price)} تومان</Text>
                                                <View style={[styles.productQtyBadge, qtyNum > 1 && styles.productQtyBadgeDanger]}><Text style={[styles.productQtyTxt, qtyNum > 1 && styles.productQtyTxtDanger]}>{item.quantity} عدد</Text></View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}

                                {selectedOrder.customer_note ? (
                                    <View style={styles.customerNoteCard}>
                                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 6 }}><Feather name="message-square" size={16} color="#ca8a04" /><Text style={styles.customerNoteTitle}>یادداشت مشتری در سفارش:</Text></View>
                                        <Text style={styles.customerNoteTxt}>{selectedOrder.customer_note}</Text>
                                    </View>
                                ) : null}

                                <View style={styles.accordionCard}>
                                    <TouchableOpacity style={styles.accordionHeader} onPress={() => setBillingAccordionOpen(!billingAccordionOpen)}>
                                        <Feather name={billingAccordionOpen ? "chevron-up" : "chevron-down"} size={20} color="#475569" />
                                        <Text style={styles.accordionTitle}>🧾 صورت‌حساب و مشخصات</Text>
                                    </TouchableOpacity>
                                    {billingAccordionOpen && (
                                        <View style={styles.accordionContent}>
                                            {!isEditingBilling ? (
                                                <>
                                                    <Text style={styles.addressTxt}>خریدار: {selectedOrder.billing?.first_name} {selectedOrder.billing?.last_name}</Text>
                                                    <Text style={styles.addressTxt}>شهر: {selectedOrder.billing?.state}، {selectedOrder.billing?.city}</Text>
                                                    <Text style={styles.addressTxt}>آدرس: {selectedOrder.billing?.address_1}</Text>
                                                    <Text style={styles.addressTxt}>کد پستی: {selectedOrder.billing?.postcode || 'ندارد'}</Text>
                                                    <Text style={styles.addressTxt}>تلفن: {selectedOrder.billing?.phone || 'ندارد'}</Text>

                                                    {selectedOrder.billing?.phone && (
                                                        <View style={styles.actionsBar}>
                                                            <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#dcfce7' }]} onPress={() => handleAction(`tel:${selectedOrder.billing.phone.replace(/[^0-9+]/g, '')}`, 'تماس برقرار نشد')}><Text style={[styles.actionIconTxt, { color: '#16a34a' }]}>تماس</Text></TouchableOpacity>
                                                            <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#e0f2fe' }]} onPress={() => handleAction(`sms:${selectedOrder.billing.phone.replace(/[^0-9+]/g, '')}`, 'پیامک باز نشد')}><Text style={[styles.actionIconTxt, { color: '#0284c7' }]}>پیامک</Text></TouchableOpacity>
                                                            <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#dbeafe' }]} onPress={() => handleAction(`https://t.me/+98${selectedOrder.billing.phone.replace(/^0/, '').replace(/[^0-9]/g, '')}`, 'تلگرام باز نشد')}><Text style={[styles.actionIconTxt, { color: '#2563eb' }]}>تلگرام</Text></TouchableOpacity>
                                                        </View>
                                                    )}

                                                    <View style={styles.editCopyBar}>
                                                        <TouchableOpacity style={styles.btnOutline} onPress={() => handleCopyText(selectedOrder.billing?.phone, 'شماره تلفن')}><Text style={styles.btnOutlineTxt}>کپی تلفن</Text><Feather name="phone" size={13} color="#475569" style={{ marginLeft: 4 }} /></TouchableOpacity>
                                                        <TouchableOpacity style={styles.btnOutline} onPress={() => handleCopyText(`${selectedOrder.billing?.state}، ${selectedOrder.billing?.city}، ${selectedOrder.billing?.address_1} - کدپستی: ${selectedOrder.billing?.postcode}`, 'آدرس')}><Text style={styles.btnOutlineTxt}>کپی آدرس</Text><Feather name="map-pin" size={13} color="#475569" style={{ marginLeft: 4 }} /></TouchableOpacity>
                                                        <TouchableOpacity style={styles.btnOutline} onPress={() => setIsEditingBilling(true)}><Text style={[styles.btnOutlineTxt, { color: '#3b82f6' }]}>ویرایش</Text><Feather name="edit-2" size={13} color="#3b82f6" style={{ marginLeft: 4 }} /></TouchableOpacity>
                                                    </View>
                                                </>
                                            ) : (
                                                <View style={styles.editForm}>
                                                    <TextInput style={styles.input} placeholder="نام" value={billingForm.first_name} onChangeText={(t) => setBillingForm({ ...billingForm, first_name: t })} />
                                                    <TextInput style={styles.input} placeholder="نام خانوادگی" value={billingForm.last_name} onChangeText={(t) => setBillingForm({ ...billingForm, last_name: t })} />
                                                    <TextInput style={styles.input} placeholder="استان" value={billingForm.state} onChangeText={(t) => setBillingForm({ ...billingForm, state: t })} />
                                                    <TextInput style={styles.input} placeholder="شهر" value={billingForm.city} onChangeText={(t) => setBillingForm({ ...billingForm, city: t })} />
                                                    <TextInput style={[styles.input, { height: 60 }]} placeholder="آدرس پستی" multiline value={billingForm.address_1} onChangeText={(t) => setBillingForm({ ...billingForm, address_1: t })} />
                                                    <TextInput style={styles.input} placeholder="کد پستی" keyboardType="numeric" value={billingForm.postcode} onChangeText={(t) => setBillingForm({ ...billingForm, postcode: t })} />
                                                    <TextInput style={styles.input} placeholder="شماره تلفن" keyboardType="phone-pad" value={billingForm.phone} onChangeText={(t) => setBillingForm({ ...billingForm, phone: t })} />
                                                    <View style={styles.editFormActions}>
                                                        <TouchableOpacity style={[styles.btnSave, savingAddress && { opacity: 0.7 }]} onPress={() => handleSaveAddress('billing')} disabled={savingAddress}>{savingAddress ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnSaveTxt}>ذخیره</Text>}</TouchableOpacity>
                                                        <TouchableOpacity style={styles.btnCancel} onPress={() => setIsEditingBilling(false)}><Text style={styles.btnCancelTxt}>انصراف</Text></TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>

                                <View style={styles.accordionCard}>
                                    <TouchableOpacity style={styles.accordionHeader} onPress={() => setShippingAccordionOpen(!shippingAccordionOpen)}>
                                        <Feather name={shippingAccordionOpen ? "chevron-up" : "chevron-down"} size={20} color="#475569" />
                                        <Text style={styles.accordionTitle}>📦 آدرس حمل‌ونقل (ارسال)</Text>
                                    </TouchableOpacity>
                                    {shippingAccordionOpen && (
                                        <View style={styles.accordionContent}>
                                            {!isEditingShipping ? (
                                                <>
                                                    <Text style={styles.addressTxt}>گیرنده: {selectedOrder.shipping?.first_name} {selectedOrder.shipping?.last_name}</Text>
                                                    <Text style={styles.addressTxt}>شهر: {selectedOrder.shipping?.state}، {selectedOrder.shipping?.city}</Text>
                                                    <Text style={styles.addressTxt}>آدرس: {selectedOrder.shipping?.address_1}</Text>
                                                    <Text style={styles.addressTxt}>کد پستی: {selectedOrder.shipping?.postcode || 'ندارد'}</Text>
                                                    <Text style={styles.addressTxt}>تلفن: {selectedOrder.shipping?.phone || selectedOrder.billing?.phone || 'ندارد'}</Text>
                                                    <View style={styles.editCopyBar}>
                                                        <TouchableOpacity style={styles.btnOutline} onPress={() => handleCopyText(selectedOrder.shipping?.phone || selectedOrder.billing?.phone, 'شماره تلفن')}><Text style={styles.btnOutlineTxt}>کپی تلفن</Text><Feather name="phone" size={13} color="#475569" style={{ marginLeft: 4 }} /></TouchableOpacity>
                                                        <TouchableOpacity style={styles.btnOutline} onPress={() => handleCopyText(`${selectedOrder.shipping?.state}، ${selectedOrder.shipping?.city}، ${selectedOrder.shipping?.address_1} - کدپستی: ${selectedOrder.shipping?.postcode}`, 'آدرس ارسال')}><Text style={styles.btnOutlineTxt}>کپی آدرس ارسال</Text><Feather name="map-pin" size={13} color="#475569" style={{ marginLeft: 4 }} /></TouchableOpacity>
                                                        <TouchableOpacity style={styles.btnOutline} onPress={() => setIsEditingShipping(true)}><Text style={[styles.btnOutlineTxt, { color: '#3b82f6' }]}>ویرایش</Text></TouchableOpacity>
                                                    </View>
                                                </>
                                            ) : (
                                                <View style={styles.editForm}>
                                                    <TextInput style={styles.input} placeholder="نام گیرنده" value={shippingForm.first_name} onChangeText={(t) => setShippingForm({ ...shippingForm, first_name: t })} />
                                                    <TextInput style={[styles.input, { height: 60 }]} placeholder="آدرس پستی ارسال" multiline value={shippingForm.address_1} onChangeText={(t) => setShippingForm({ ...shippingForm, address_1: t })} />
                                                    <TextInput style={styles.input} placeholder="کد پستی" keyboardType="numeric" value={shippingForm.postcode} onChangeText={(t) => setShippingForm({ ...shippingForm, postcode: t })} />
                                                    <View style={styles.editFormActions}>
                                                        <TouchableOpacity style={[styles.btnSave]} onPress={() => handleSaveAddress('shipping')}><Text style={styles.btnSaveTxt}>ذخیره</Text></TouchableOpacity>
                                                        <TouchableOpacity style={styles.btnCancel} onPress={() => setIsEditingShipping(false)}><Text style={styles.btnCancelTxt}>انصراف</Text></TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>

                                <View style={styles.compactShippingBox}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.compactShippingVal}>{getShippingInfo(selectedOrder).title} ({formatPrice(getShippingInfo(selectedOrder).total)} تومان)</Text>
                                    </View>
                                    <Feather name="truck" size={22} color="#166534" style={{ marginLeft: 10 }} />
                                </View>

                                {parseFloat(selectedOrder.discount_total || '0') > 0 && (
                                    <View style={styles.discountHighlightBox}>
                                        <Text style={styles.discountHighlightLabel}>تخفیف سفارش: 🎁</Text>
                                        <View style={{ alignItems: 'flex-start' }}>
                                            <Text style={styles.discountHighlightValue}>{formatPrice(selectedOrder.discount_total)} تومان</Text>
                                            {selectedOrder.coupon_lines?.length > 0 && <Text style={styles.discountHighlightCode}>کد: {selectedOrder.coupon_lines.map((c: any) => c.code).join(' ، ')}</Text>}
                                        </View>
                                    </View>
                                )}

                                {selectedOrder.fee_lines && selectedOrder.fee_lines.length > 0 && selectedOrder.fee_lines.map((fee: any, idx: number) => {
                                    const feeTotal = parseFloat(fee.total || '0');
                                    const isDiscount = feeTotal < 0; 
                                    return (
                                        <View key={idx} style={[styles.discountHighlightBox, { backgroundColor: isDiscount ? '#fdf2f8' : '#f8fafc', borderColor: isDiscount ? '#fbcfe8' : '#e2e8f0' }]}>
                                            <Text style={[styles.discountHighlightLabel, { color: isDiscount ? '#be123c' : '#475569' }]}>{fee.name || 'هزینه جانبی / کیف پول'}</Text>
                                            <Text style={[styles.discountHighlightValue, { color: isDiscount ? '#e11d48' : '#0f172a' }]}>
                                                {isDiscount ? '' : '+'} {formatPrice(Math.abs(feeTotal))} تومان
                                            </Text>
                                        </View>
                                    );
                                })}

                                <View style={styles.totalSummaryBox}>
                                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                        <Text style={styles.totalSummaryLabel}>مبلغ کل پرداختی:</Text>
                                        <Text style={styles.totalSummaryValue}>{formatPrice(selectedOrder.total)} تومان</Text>
                                    </View>
                                    <View style={{ width: '100%', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'right', fontWeight: 'bold' }}>درگاه پرداخت: {selectedOrder.payment_method_title || 'نامشخص'}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    activeOpacity={0.8}
                                    style={styles.customerStatsBox}
                                    onPress={() => {
                                        setActiveCustomerFilter({
                                            id: selectedOrder.customer_id > 0 ? selectedOrder.customer_id : undefined,
                                            email: selectedOrder.billing?.email,
                                            name: `${selectedOrder.billing?.first_name || ''} ${selectedOrder.billing?.last_name || ''}`.trim() || 'مشتری بدون نام'
                                        });
                                        setModalVisible(false); 
                                    }}
                                >
                                    {customerStats.loading ? <ActivityIndicator size="small" color="#3b82f6" /> : (
                                        <>
                                            <View style={{ alignItems: 'center', flex: 1 }}>
                                                <Text style={styles.customerStatsLabel}>مجموع خرید مشتری</Text>
                                                <Text style={styles.customerStatsValue}>{formatPrice(customerStats.total)} تومان</Text>
                                            </View>
                                            <View style={{ height: '100%', width: 1, backgroundColor: '#cbd5e1' }} />
                                            <View style={{ alignItems: 'center', flex: 1 }}>
                                                <Text style={styles.customerStatsLabel}>سفارشات موفق</Text>
                                                <Text style={styles.customerStatsValue}>{customerStats.isGuest ? 'مهمان' : `${customerStats.count} بار`}</Text>
                                            </View>
                                            <View style={{ position: 'absolute', top: 8, left: 8 }}>
                                                <Feather name="filter" size={14} color="#3b82f6" />
                                            </View>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.trackingCard}>
                                    <Text style={styles.trackingTitle}>📮 ثبت کد پیگیری پستی</Text>
                                    <TextInput style={styles.trackingInput} placeholder="شماره مرسوله را وارد کنید..." placeholderTextColor="#94a3b8" value={trackingCode} onChangeText={setTrackingCode} textAlign="right" />
                                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setSendSmsNotification(!sendSmsNotification)} activeOpacity={0.8}>
                                        <Text style={styles.checkboxLabel}>ارسال پیامک اطلاع‌رسانی</Text>
                                        <Feather name={sendSmsNotification ? "check-square" : "square"} size={18} color={sendSmsNotification ? "#10b981" : "#94a3b8"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.trackingSubmitBtn} onPress={handleSaveTrackingCode} disabled={savingTracking}>
                                        {savingTracking ? <ActivityIndicator color="#fff" size="small" /> : (
                                            <><Text style={styles.trackingSubmitTxt}>ثبت سریع و تکمیل سفارش  </Text><Feather name="zap" size={14} color="#fff" style={{ marginLeft: 6 }} /></>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity style={styles.invoiceBtn} onPress={() => setInvoiceVisible(true)}>
                                    <Text style={styles.invoiceBtnTxt}> چاپ‌فاکتور  </Text>
                                    <Feather name="printer" size={16} color="#ffffff" style={{ marginLeft: 8 }} />
                                </TouchableOpacity>

                                <View style={styles.originMainCard}>
                                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#fef08a', paddingBottom: 8 }}>
                                        <Feather name="bar-chart-2" size={18} color="#a16207" />
                                        <Text style={styles.originMainTitle}>آمار و منبع ورود مشتری</Text>
                                    </View>
                                    <View style={styles.originRow}>
                                        <Text style={styles.originLabel}>نحوه ورود به سایت:</Text>
                                        <Text style={styles.originValue}>{getOrderOriginData(selectedOrder).origin}</Text>
                                    </View>
                                    <View style={styles.originRow}>
                                        <Text style={styles.originLabel}>تعداد بازدید:</Text>
                                        <Text style={styles.originValue}>{getOrderOriginData(selectedOrder).pages}</Text>
                                    </View>
                                    <View style={styles.originRow}>
                                        <Text style={styles.originLabel}>دستگاه مشتری:</Text>
                                        <Text style={styles.originValue}>{getOrderOriginData(selectedOrder).device}</Text>
                                    </View>
                                </View>

                                {/* 🌟 یادداشت‌های سیستمی مدیر و ووکامرس (مثل سایت) */}
                                <View style={[styles.accordionCard, { marginBottom: 40 }]}>
                                    <TouchableOpacity style={styles.accordionHeader} onPress={() => {
                                        const nextState = !noteAccordionOpen;
                                        setNoteAccordionOpen(nextState);
                                        if (nextState && orderNotes.length === 0) fetchOrderNotes(selectedOrder.id);
                                    }}>
                                        <Feather name={noteAccordionOpen ? "chevron-up" : "chevron-down"} size={20} color="#475569" />
                                        <Text style={styles.accordionTitle}>یادداشت‌های سفارش</Text>
                                    </TouchableOpacity>
                                    {noteAccordionOpen && (
                                        <View style={styles.accordionContent}>
                                            <View style={{marginBottom: 15}}>
                                                <Text style={{fontSize: 11, fontWeight: 'bold', color: '#64748b', textAlign: 'right', marginBottom: 6}}>افزودن یادداشت</Text>
                                                <TextInput 
                                                    style={[styles.input, {height: 80, textAlignVertical: 'top', borderColor: '#cbd5e1'}]} 
                                                    multiline 
                                                    value={newNoteText} 
                                                    onChangeText={setNewNoteText} 
                                                />
                                                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                                                    <TouchableOpacity 
                                                        style={{flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0'}}
                                                        onPress={() => setNoteToCustomer(!noteToCustomer)}
                                                    >
                                                        <Feather name={noteToCustomer ? "check-circle" : "circle"} size={16} color={noteToCustomer ? "#3b82f6" : "#64748b"} />
                                                        <Text style={{fontSize: 11, color: '#334155', marginRight: 6, fontWeight: 'bold'}}>{noteToCustomer ? 'به مشتری ارسال شود' : 'یادداشت خصوصی'}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={{backgroundColor: '#fff', borderWidth: 1, borderColor: '#4f46e5', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8}} onPress={handleAddNote} disabled={addingNote}>
                                                        {addingNote ? <ActivityIndicator color="#4f46e5" size="small"/> : <Text style={{color: '#4f46e5', fontSize: 11, fontWeight: 'bold'}}>افزودن یادداشت</Text>}
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            
                                            {loadingNotes ? <ActivityIndicator size="small" color="#3b82f6" style={{marginVertical: 20}} /> : (
                                                orderNotes.length === 0 ? <Text style={styles.emptyTxt}>یادداشتی ثبت نشده است.</Text> :
                                                orderNotes.map(note => (
                                                    <View key={note.id} style={{backgroundColor: note.customer_note ? '#f0f9ff' : '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: note.customer_note ? '#bae6fd' : '#e2e8f0'}}>
                                                        {note.customer_note && <Text style={{fontSize: 10, fontWeight: '900', color: '#1d4ed8', textAlign: 'right', marginBottom: 4}}>به مشتری ارسال شد</Text>}
                                                        <Text style={{fontSize: 12, color: '#334155', textAlign: 'right', lineHeight: 20, fontWeight: 'bold'}}>
                                                            {note.note.replace(/<[^>]+>/g, '')}
                                                        </Text>
                                                        <View style={{flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: note.customer_note ? '#dbeafe' : '#f1f5f9'}}>
                                                            <TouchableOpacity onPress={() => handleDeleteNote(note.id)}>
                                                                <Text style={{fontSize: 11, color: '#ef4444', fontWeight: 'bold'}}>حذف</Text>
                                                            </TouchableOpacity>
                                                            <Text style={{fontSize: 10, color: '#94a3b8'}}>{toShamsi(note.date_created, true)}</Text>
                                                        </View>
                                                    </View>
                                                ))
                                            )}
                                        </View>
                                    )}
                                </View>

                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal visible={invoiceVisible} animationType="slide" onRequestClose={() => setInvoiceVisible(false)}>
                <View style={styles.invoiceContainer}>
                    <View style={styles.invoiceActions}>
                        <TouchableOpacity style={styles.shareBtn} onPress={shareInvoiceAsImage}>
                            <Feather name="camera" size={14} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.shareBtnTxt}>اشتراک عکس</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: '#10b981', marginRight: 10 }]} onPress={handleShareInvoiceText}>
                            <Feather name="file-text" size={14} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.shareBtnTxt}>ارسال متنی</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setInvoiceVisible(false)} style={styles.invoiceCloseBtn}>
                            <Feather name="x" size={24} color="#0f172a" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        <ViewShot ref={invoiceViewRef} options={{ format: "jpg", quality: 0.9 }}>
                            <View style={styles.invoicePaper}>
                                <View style={styles.invoiceModernHeader}>
                                    <View style={styles.invoiceLogoPlaceholder}><Text style={styles.invoiceLogoTxt}>{storeInitial}</Text></View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.invoiceStoreName}>فروشگاه {storeName}</Text>
                                        <Text style={styles.invoiceStoreDomain}>{cleanDomain}</Text>
                                    </View>
                                </View>
                                <View style={styles.invoiceMetaRow}>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.invoiceMetaLabel}>شماره فاکتور</Text>
                                        <Text style={[styles.invoiceMetaValue, { color: '#4f46e5' }]}>#{selectedOrder?.id}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.invoiceMetaLabel}>تاریخ سفارش</Text>
                                        <Text style={styles.invoiceMetaValue}>{selectedOrder ? toShamsi(selectedOrder.date_created, true) : ''}</Text>
                                    </View>
                                </View>
                                <View style={styles.invoiceCustomerBox}>
                                    <View style={styles.invoiceCustomerHeader}>
                                        <Text style={styles.invoiceCustomerTitle}>مشخصات خریدار</Text>
                                        <Feather name="user" size={16} color="#6366f1" />
                                    </View>
                                    <Text style={styles.invoiceCustomerTxt}>نام: {selectedOrder?.billing?.first_name} {selectedOrder?.billing?.last_name}</Text>
                                    <Text style={styles.invoiceCustomerTxt}>شماره تماس: {selectedOrder?.billing?.phone}</Text>
                                    <Text style={styles.invoiceCustomerTxt}>کد پستی: {selectedOrder?.billing?.postcode}</Text>
                                    <Text style={styles.invoiceCustomerTxt}>آدرس: {selectedOrder?.billing?.state}، {selectedOrder?.billing?.city}، {selectedOrder?.billing?.address_1}</Text>
                                </View>

                                <View style={styles.invoiceItemsWrapper}>
                                    {selectedOrder?.line_items?.map((item: any, index: number) => (
                                        <View key={index} style={styles.invoiceItemCard}>
                                            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.invoiceCustomerTxt, { fontWeight: '900', color: '#0f172a' }]}>{item.name}</Text>
                                                    {item.meta_data?.map((m: any, mIdx: number) => {
                                                        if (m.key.startsWith('_')) return null;
                                                        return <Text key={mIdx} style={[styles.invoiceCustomerTxt, { fontSize: 9, color: '#64748b' }]}>{m.display_key}: {m.display_value}</Text>;
                                                    })}
                                                </View>
                                                {item.image?.src ? <Image source={{ uri: item.image.src }} style={styles.invoiceItemImg} /> : <View style={styles.invoiceItemImgPlaceholder}><Feather name="image" size={14} color="#94a3b8" /></View>}
                                            </View>
                                            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#4f46e5' }}>{formatPrice(item.total)} تومان</Text>
                                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b' }}>تعداد: {item.quantity}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                {parseFloat(selectedOrder?.discount_total || '0') > 0 && (
                                    <View style={styles.invoiceDiscountBox}>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.invoiceDiscountValue}>{formatPrice(selectedOrder.discount_total)} تومان</Text>
                                            {selectedOrder.coupon_lines?.length > 0 && <Text style={styles.invoiceDiscountCode}>کد: {selectedOrder.coupon_lines.map((c: any) => c.code).join(' ، ')}</Text>}
                                        </View>
                                        <Text style={styles.invoiceDiscountLabel}>تخفیف 🎁</Text>
                                    </View>
                                )}

                                <View style={styles.invoiceTotalBox}>
                                    <View style={styles.invoiceTotalIcon}><Feather name="credit-card" size={20} color="#ffffff" /></View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.invoiceTotalLabel}>مبلغ قابل پرداخت</Text>
                                        <Text style={styles.invoiceTotalValue}>{formatPrice(selectedOrder?.total)} <Text style={{ fontSize: 13, textAlign: 'right' }}>تومان</Text></Text>
                                    </View>
                                </View>
                                <Text style={styles.invoiceFooterMsg}>با تشکر از خرید شما از {storeName} 💜</Text>
                            </View>
                        </ViewShot>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    blinkingDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#f97316', marginLeft: 8, marginRight: 5, elevation: 3, shadowColor: '#f97316', shadowOffset: { width: 0, height: 0 }, shadowRadius: 5, shadowOpacity: 0.8 },
    
    header: { backgroundColor: '#ffffff', paddingBottom: 10, paddingTop: Platform.OS === 'ios' ? 40 : 15, paddingHorizontal: 16 },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    bulkHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', backgroundColor: '#e0f2fe', paddingBottom: 15, paddingTop: Platform.OS === 'ios' ? 40 : 15, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#bae6fd', alignItems: 'center' },
    bulkActionBtn: { backgroundColor: '#fff', padding: 8, borderRadius: 8, marginLeft: 10, elevation: 1 },
    globalSearchContainer: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    searchRowWrapper: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, width: '100%' },
    globalSearchBox: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12 },
    globalSearchInput: { flex: 1, height: 42, fontSize: 12, color: '#0f172a', textAlign: 'right', fontWeight: 'bold' },
    globalSearchIcon: { marginLeft: 8 },
    addOrderBtnOnlyIcon: { width: 42, height: 42, backgroundColor: '#EC5B38', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    filterContainer: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: 6 },
    filterScroll: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row' },
    filterBtn: { position: 'relative', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f1f5f9', marginLeft: 14 },
    filterBtnActive: { backgroundColor: '#EC5B38' },
    filterBtnTxt: { fontSize: 11, fontWeight: 'bold', color: '#64748b', textAlign: 'center' },
    filterBtnTxtActive: { color: '#ffffff', fontWeight: '900' },
    tabBadgeOverlapping: { position: 'absolute', top: -8, right: -4, backgroundColor: '#bbf7d0', borderRadius: 10, paddingHorizontal: 5, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 1.5, borderColor: '#f8fafc' },
    tabBadgeTxt: { color: '#166534', fontSize: 9, fontWeight: '900' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyTxt: { marginTop: 12, fontSize: 13, color: '#94a3b8', fontWeight: 'bold', textAlign: 'center' },
    listContainer: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 100 },
    footerLoader: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
    footerLoaderTxt: { marginTop: 8, fontSize: 9, color: '#EC5B38', fontWeight: 'bold' },
    swipeBackground: { position: 'absolute', width: '100%', height: '100%', backgroundColor: '#10b981', borderRadius: 16, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20 },
    swipeTxt: { color: '#fff', fontWeight: 'bold', fontSize: 11, marginTop: 4 },
    selectedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(239, 246, 255, 0.6)', borderRadius: 16, borderWidth: 2, borderColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
    orderCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 0, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
    cardRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    customerNameTxt: { fontSize: 14, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    orderIdTxt: { fontSize: 13, fontWeight: '900', color: '#64748b', textAlign: 'left' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusTxt: { fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
    orderDateTxt: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold', textAlign: 'right' },
    cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, marginTop: 4 },
    itemsCountBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    itemsCountTxt: { fontSize: 10, color: '#475569', fontWeight: 'bold' },
    totalPriceTxt: { fontSize: 15, fontWeight: '900', color: '#10b981', textAlign: 'left' },
    shippingMiniBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
    shippingMiniTxt: { fontSize: 9, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '92%' },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right', flex: 1 },
    modalBody: { paddingBottom: 30 },
    attractiveHeaderBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    headerBoxRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    headerBoxBuyer: { fontSize: 13, fontWeight: '900', color: '#0f172a', textAlign: 'right', flex: 1 },
    headerBoxId: { fontSize: 13, fontWeight: '900', color: '#3b82f6', textAlign: 'left' },
    headerBoxDate: { fontSize: 11, fontWeight: 'bold', color: '#64748b', textAlign: 'right' },
    statusBadgeMini: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusTxtMini: { fontSize: 10, fontWeight: '900', textAlign: 'center' },
    customerStatsBox: { flexDirection: 'row-reverse', backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 12, padding: 12, marginBottom: 12, marginTop: 6, position: 'relative' },
    customerStatsLabel: { fontSize: 11, color: '#1e40af', fontWeight: 'bold', marginBottom: 4 },
    customerStatsValue: { fontSize: 13, fontWeight: '900', color: '#1d4ed8' },
    originMainCard: { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fef08a', borderRadius: 12, padding: 12, marginBottom: 12, marginTop: 12 },
    originMainTitle: { fontSize: 13, fontWeight: '900', color: '#854d0e', textAlign: 'right', marginRight: 6 },
    originRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    originLabel: { fontSize: 11, color: '#a16207', fontWeight: 'bold' },
    originValue: { fontSize: 12, color: '#713f12', fontWeight: '900' },
    accordionCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginBottom: 12 },
    accordionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 12 },
    accordionTitle: { fontSize: 12, fontWeight: '900', color: '#334155', textAlign: 'right', flex: 1 },
    accordionContent: { padding: 12 },
    statusActionBox: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' },
    statusActionBtn: { width: '48%', paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
    statusActionTxt: { fontSize: 11, fontWeight: '900', textAlign: 'center' },
    singleDeleteBtn: { flexDirection: 'row-reverse', backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12, elevation: 1 },
    singleDeleteTxt: { color: '#b91c1c', fontWeight: '900', fontSize: 13, marginRight: 6 },
    customerNoteCard: { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fef08a', borderRadius: 12, padding: 12, marginBottom: 12 },
    customerNoteTitle: { fontSize: 12, fontWeight: '900', color: '#a16207', textAlign: 'right', marginRight: 4 },
    customerNoteTxt: { fontSize: 12, color: '#854d0e', textAlign: 'right', lineHeight: 20 },
    addressTxt: { fontSize: 12, color: '#334155', textAlign: 'right', width: '100%', marginBottom: 6, fontWeight: 'bold' },
    actionsBar: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    actionIconBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, alignItems: 'center', flex: 1, marginHorizontal: 2 },
    actionIconTxt: { fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
    editCopyBar: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10 },
    btnOutline: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 6, borderRadius: 6, marginHorizontal: 2 },
    btnOutlineTxt: { fontSize: 10, color: '#475569', fontWeight: 'bold', marginLeft: 4, textAlign: 'right' },
    editForm: { marginTop: 6 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, textAlign: 'right', marginBottom: 8, fontSize: 12, color: '#0f172a' },
    editFormActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
    btnSave: { backgroundColor: '#10b981', paddingVertical: 8, borderRadius: 6, flex: 1, alignItems: 'center', marginRight: 6 },
    btnSaveTxt: { color: '#ffffff', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
    btnCancel: { backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' },
    btnCancelTxt: { color: '#64748b', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
    sectionMainTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 10, textAlign: 'right', width: '100%' },
    singleProductCard: { position: 'relative', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, marginBottom: 12, elevation: 1 },
    tickedIconFloat: { position: 'absolute', top: -8, left: -8, backgroundColor: '#dcfce7', borderRadius: 12, padding: 4, zIndex: 10, borderWidth: 1, borderColor: '#86efac' },
    directEditBtn: { backgroundColor: '#eff6ff', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', marginLeft: 10 },
    productTopArea: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    productInfoBox: { flex: 1, marginLeft: 10 },
    productNameTxt: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', textAlign: 'right', marginBottom: 4 },
    productMetaTxt: { fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 },
    productImg: { width: 50, height: 50, borderRadius: 8 },
    productImgPlaceholder: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    thinDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 10, width: '100%' },
    productBottomArea: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    productPriceTxt: { fontSize: 12, fontWeight: '900', color: '#3b82f6', textAlign: 'right' },
    productQtyBadge: { backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    productQtyBadgeDanger: { backgroundColor: '#ef4444', borderColor: '#dc2626', borderWidth: 1 },
    productQtyTxt: { fontSize: 11, fontWeight: 'bold', color: '#475569', textAlign: 'center' },
    productQtyTxtDanger: { color: '#ffffff', fontWeight: '900' },
    compactShippingBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row-reverse', justifyContent: 'flex-start', alignItems: 'center' },
    compactShippingVal: { fontSize: 13, fontWeight: '900', color: '#15803d', textAlign: 'right', marginBottom: 4 },
    discountHighlightBox: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fdf2f8', padding: 14, borderRadius: 12, marginBottom: 4, borderWidth: 1, borderColor: '#fbcfe8' },
    discountHighlightLabel: { fontSize: 13, fontWeight: '900', color: '#be123c', textAlign: 'right' },
    discountHighlightValue: { fontSize: 16, fontWeight: '900', color: '#e11d48', textAlign: 'left', marginBottom: 2 },
    discountHighlightCode: { fontSize: 11, color: '#f43f5e', textAlign: 'left', fontWeight: 'bold' },
    totalSummaryBox: { backgroundColor: '#0f172a', padding: 14, borderRadius: 12, marginBottom: 12 },
    totalSummaryLabel: { fontSize: 13, fontWeight: '900', color: '#f8fafc', textAlign: 'right' },
    totalSummaryValue: { fontSize: 18, fontWeight: '900', color: '#10b981', textAlign: 'left', marginBottom: 2 },
    paymentMethodTxt: { fontSize: 12, color: '#93c5fd', textAlign: 'left', fontWeight: '900' },
    posContainer: { flex: 1, backgroundColor: '#f1f5f9', paddingTop: Platform.OS === 'ios' ? 50 : 45 },
    posHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'center' },
    posHeaderTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', textAlign: 'right', flex: 1, marginRight: 15 },
    posSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    posSectionTitle: { fontSize: 14, fontWeight: '900', color: '#3b82f6', textAlign: 'right', marginBottom: 12 },
    posInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 12, color: '#0f172a', marginBottom: 10 },
    posSearchBtn: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center' },
    posSearchResults: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, maxHeight: 180 },
    posResultItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    posResultTxt: { fontSize: 11, fontWeight: 'bold', color: '#334155', textAlign: 'right', flex: 1 },
    posCartItem: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    posCartName: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
    posCartPriceInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, fontSize: 12, width: 80, fontWeight: 'bold', color: '#10b981' },
    emptyCartTxt: { textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: 'bold', marginVertical: 10 },
    posMaliCard: { backgroundColor: '#fefce8', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#fef08a' },
    posMaliRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    posMaliInputHalf: { flex: 1 },
    discountContainer: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginTop: 5, borderWidth: 1, borderColor: '#fbcfe8' },
    discountTypeTabs: { flexDirection: 'row-reverse', backgroundColor: '#fce7f3', borderRadius: 6, padding: 4, marginBottom: 10 },
    discountTab: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 4 },
    discountTabActive: { backgroundColor: '#e11d48' },
    discountTabTxt: { fontSize: 11, fontWeight: 'bold', color: '#be123c' },
    discountTabTxtActive: { color: '#ffffff' },
    liveCalculatorBox: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 16 },
    liveRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    liveLabel: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
    liveValue: { color: '#e2e8f0', fontSize: 13, fontWeight: '900' },
    liveTotalDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
    liveTotalLabel: { color: '#f8fafc', fontSize: 13, fontWeight: '900' },
    liveTotalValue: { color: '#10b981', fontSize: 16, fontWeight: '900' },
    posSubmitBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 10, alignItems: 'center', elevation: 2 },
    posSubmitTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
    invoiceActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 16, paddingTop: Platform.OS === 'ios' ? 40 : 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    invoiceCloseBtn: { flexDirection: 'row-reverse', alignItems: 'center' },
    shareBtn: { flexDirection: 'row-reverse', backgroundColor: '#4f46e5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    shareBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 11, textAlign: 'right' },
    invoicePaper: { backgroundColor: '#ffffff', margin: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    invoiceModernHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#4f46e5', padding: 20, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
    invoiceStoreName: { fontSize: 18, fontWeight: '900', color: '#ffffff', marginBottom: 4, textAlign: 'right' },
    invoiceStoreDomain: { fontSize: 11, color: '#c7d2fe', fontWeight: 'bold', textAlign: 'right' },
    invoiceLogoPlaceholder: { width: 40, height: 40, backgroundColor: '#ffffff', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    invoiceLogoTxt: { fontSize: 20, fontWeight: '900', color: '#4f46e5', textAlign: 'center' },
    invoiceMetaRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 16, backgroundColor: '#fafafa', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    invoiceMetaLabel: { fontSize: 10, color: '#64748b', fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
    invoiceMetaValue: { fontSize: 13, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    invoiceCustomerBox: { margin: 16, backgroundColor: '#f8fafc', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    invoiceCustomerHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 6 },
    invoiceCustomerTitle: { fontSize: 12, fontWeight: '900', color: '#6366f1', textAlign: 'right' },
    invoiceCustomerTxt: { fontSize: 11, color: '#334155', textAlign: 'right', marginBottom: 4, fontWeight: 'bold' },
    invoiceItemsWrapper: { marginHorizontal: 16, marginBottom: 16 },
    invoiceItemCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: '#fff' },
    invoiceItemImg: { width: 40, height: 40, borderRadius: 6, marginLeft: 10 },
    invoiceItemImgPlaceholder: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    invoiceTotalBox: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#4f46e5', marginHorizontal: 16, padding: 14, borderRadius: 10, marginBottom: 16 },
    invoiceTotalLabel: { fontSize: 12, fontWeight: 'bold', color: '#c7d2fe', marginBottom: 4, textAlign: 'right' },
    invoiceTotalValue: { fontSize: 18, fontWeight: '900', color: '#ffffff', textAlign: 'right' },
    invoiceTotalIcon: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10 },
    invoiceFooterMsg: { textAlign: 'center', color: '#818cf8', fontSize: 11, marginBottom: 20, fontWeight: '900' },
    invoiceContainer: { flex: 1, backgroundColor: '#f8fafc' },
    trackingCard: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 12, padding: 12, marginBottom: 12 },
    trackingTitle: { fontSize: 13, fontWeight: '900', color: '#166534', textAlign: 'right', marginBottom: 8 },
    trackingInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#86efac', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right', color: '#0f172a', marginBottom: 8, fontWeight: 'bold' },
    checkboxRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 10 },
    checkboxLabel: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginRight: 6 },
    trackingSubmitBtn: { flexDirection: 'row-reverse', backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    trackingSubmitTxt: { color: '#ffffff', fontWeight: '900', fontSize: 12 },
    invoiceBtn: { flexDirection: 'row-reverse', backgroundColor: '#4f46e5', padding: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12, elevation: 1 },
    invoiceBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '900', textAlign: 'right' },
});