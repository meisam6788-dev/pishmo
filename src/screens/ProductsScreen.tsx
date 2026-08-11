import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Modal, Alert, KeyboardAvoidingView, Platform, StatusBar, Linking, ScrollView, InteractionManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWooClient } from '../api/client';
import { AddProductModal } from '../components/AddProductModal';

export const ProductsScreen: React.FC = () => {
    const isMounted = useRef(false);

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // استیت برای نمایش یک لودینگ کوچک در پس‌زمینه وقتی دیتای کش در حال نمایش است
    const [isSilentUpdating, setIsSilentUpdating] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const [categories, setCategories] = useState<any[]>([]);
    const [stockFilter, setStockFilter] = useState('all');
    const [selectedCatFilters, setSelectedCatFilters] = useState<number[]>([]);

    const [isFilterSidebarVisible, setIsFilterSidebarVisible] = useState(false);
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [fullEditProduct, setFullEditProduct] = useState<any>(null);

    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [editName, setEditName] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editSalePrice, setEditSalePrice] = useState('');
    const [editStock, setEditStock] = useState('');

    const [showSaleDates, setShowSaleDates] = useState(false);
    const [saleDateFrom, setSaleDateFrom] = useState('');
    const [saleDateTo, setSaleDateTo] = useState('');

    const [variationsList, setVariationsList] = useState<any[]>([]);
    const [loadingVariations, setLoadingVariations] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchCategories = async () => {
        try {
            const client = createWooClient();
            const res = await client.get('products/categories', { params: { per_page: 50, hide_empty: true } });
            setCategories(res.data);
        } catch (e) { }
    };

    const fetchProducts = async (pageNum = 1, search = '', stockFlt = stockFilter, catFltArray = selectedCatFilters, isRefresh = false) => {
        // 🚀 مدیریت هوشمند لودینگ: اگر محصولی در صفحه بود (از کش آمده بود)، کل صفحه را سفید نکن، فقط لودینگ کوچک نشان بده
        if (!isRefresh && pageNum === 1) {
            if (products.length === 0) setLoading(true);
            else setIsSilentUpdating(true);
        }
        if (pageNum > 1) setLoadingMore(true);
        
        try {
            const client = createWooClient();
            const params: any = { page: pageNum, per_page: 15, search: search, status: 'any' };
            if (stockFlt !== 'all') params.stock_status = stockFlt;
            if (catFltArray.length > 0) params.category = catFltArray.join(',');

            const response = await client.get('products', { params });
            const fetchedProducts = response.data;
            
            if (isRefresh || pageNum === 1) {
                setProducts(fetchedProducts);
                // 🚀 جادوی کش: اگر سرچ و فیلتر خالی است (صفحه اصلی محصولات)، آن را برای دفعه بعد در گوشی ذخیره کن
                if (search === '' && stockFlt === 'all' && catFltArray.length === 0) {
                    await AsyncStorage.setItem('@pishmo_products_cache', JSON.stringify(fetchedProducts));
                }
            } else {
                setProducts(prev => [...prev, ...fetchedProducts]);
            }
            setHasMore(fetchedProducts.length === 15);
        } catch (error) { 
            Alert.alert('خطا', 'در دریافت لیست کالاها مشکلی پیش آمد.'); 
        } finally { 
            setLoading(false); 
            setLoadingMore(false); 
            setRefreshing(false);
            setIsSilentUpdating(false);
        }
    };

    // 🚀 راه‌اندازی اولیه بی‌نهایت سریع با AsyncStorage و InteractionManager
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            
            const initScreen = async () => {
                // ۱. خواندن آنی از حافظه گوشی (در ۰.۱ ثانیه اجرا می‌شود)
                try {
                    const cachedData = await AsyncStorage.getItem('@pishmo_products_cache');
                    if (cachedData) {
                        setProducts(JSON.parse(cachedData));
                        setLoading(false); // چون دیتا داریم، صفحه فوراً نمایش داده می‌شود
                    }
                } catch (e) {}

                // ۲. منتظر ماندن برای پایان یافتن انیمیشن باز شدن منو برای جلوگیری از لگ
                InteractionManager.runAfterInteractions(() => {
                    fetchCategories();
                    // در اینجا ما نمی‌خواهیم دستی fetchProducts را صدا بزنیم، 
                    // چون useEffect پایینی (سیستم Debounce) خودکار این کار را انجام می‌دهد.
                });
            };
            initScreen();
        }
    }, []);

    // سیستم تاخیر هوشمند برای سرچ و فیلترها
    useEffect(() => {
        if (isMounted.current) {
            const delayDebounceFn = setTimeout(() => {
                setPage(1);
                fetchProducts(1, searchQuery, stockFilter, selectedCatFilters);
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        }
    }, [searchQuery, stockFilter, selectedCatFilters]);

    const handleRefresh = useCallback(() => { setRefreshing(true); setPage(1); fetchProducts(1, searchQuery, stockFilter, selectedCatFilters, true); }, [searchQuery, stockFilter, selectedCatFilters]);

    const handleLoadMore = () => {
        if (!loading && !loadingMore && hasMore && !isSilentUpdating) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchProducts(nextPage, searchQuery, stockFilter, selectedCatFilters);
        }
    };

    const toggleCatFilter = (id: number) => {
        if (selectedCatFilters.includes(id)) {
            setSelectedCatFilters(selectedCatFilters.filter(catId => catId !== id));
        } else {
            setSelectedCatFilters([...selectedCatFilters, id]);
        }
    };

    const formatPrice = (price: string | number) => { if (!price) return ''; return price.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
    const cleanNumber = (val: string) => val.replace(/\D/g, '');
    const openProductUrl = (url: string) => { if (url) { Linking.openURL(url).catch(() => Alert.alert('خطا', 'مرورگر گوشی شما قادر به باز کردن این لینک نیست.')); } };

    const openQuickEdit = async (item: any) => {
        setEditingProduct(item); setEditName(item.name); setVariationsList([]);
        setShowSaleDates(false);
        if (item.type === 'simple') {
            setEditPrice(formatPrice(item.regular_price));
            setEditSalePrice(formatPrice(item.sale_price));
            setEditStock(item.stock_quantity !== null && item.stock_quantity !== undefined ? String(item.stock_quantity) : '');
            setSaleDateFrom(item.date_on_sale_from ? item.date_on_sale_from.split('T')[0] : '');
            setSaleDateTo(item.date_on_sale_to ? item.date_on_sale_to.split('T')[0] : '');
        } else if (item.type === 'variable') {
            setLoadingVariations(true);
            try {
                const client = createWooClient();
                const res = await client.get(`products/${item.id}/variations`, { params: { per_page: 50 } });
                setVariationsList(res.data || []);
            } catch (e) { Alert.alert('خطا', 'دریافت لیست تنوع‌های محصول با شکست مواجه شد.'); } finally { setLoadingVariations(false); }
        }
    };

    const updateVariationRow = (id: number, field: 'regular_price' | 'sale_price' | 'stock_quantity', val: string) => {
        setVariationsList(prev => prev.map(v => {
            if (v.id === id) {
                if (field === 'regular_price' || field === 'sale_price') return { ...v, [field]: cleanNumber(val) };
                else return { ...v, [field]: val === '' ? null : parseInt(cleanNumber(val), 10) };
            }
            return v;
        }));
    };

    const submitQuickEdit = async () => {
        if (!editingProduct) return;
        if (!editName.trim()) { Alert.alert('خطا', 'نام محصول نمی‌تواند خالی باشد.'); return; }
        setIsUpdating(true);
        try {
            const client = createWooClient();
            const payload: any = { name: editName.trim() };

            if (editingProduct.type === 'simple') {
                const rawPrice = cleanNumber(editPrice); const rawSale = cleanNumber(editSalePrice); const rawStock = parseInt(editStock, 10);
                payload.regular_price = rawPrice || '';
                payload.sale_price = rawSale || '';

                if (showSaleDates && rawSale) {
                    payload.date_on_sale_from = saleDateFrom ? `${saleDateFrom}T00:00:00` : '';
                    payload.date_on_sale_to = saleDateTo ? `${saleDateTo}T23:59:59` : '';
                } else if (!rawSale) {
                    payload.date_on_sale_from = '';
                    payload.date_on_sale_to = '';
                }

                if (!isNaN(rawStock)) { payload.manage_stock = true; payload.stock_quantity = rawStock; payload.stock_status = rawStock > 0 ? 'instock' : 'outofstock'; }
                const response = await client.put(`products/${editingProduct.id}`, payload);
                if (response.status === 200) setProducts(products.map(p => p.id === editingProduct.id ? response.data : p));
            } else if (editingProduct.type === 'variable') {
                await client.put(`products/${editingProduct.id}`, payload);
                const batchUpdates = variationsList.map(v => ({
                    id: v.id, regular_price: String(v.regular_price || ''), sale_price: String(v.sale_price || ''), manage_stock: true,
                    stock_quantity: v.stock_quantity !== null && !isNaN(v.stock_quantity) ? v.stock_quantity : 0, stock_status: (v.stock_quantity || 0) > 0 ? 'instock' : 'outofstock',
                }));
                await client.post(`products/${editingProduct.id}/variations/batch`, { update: batchUpdates });
            }

            setEditingProduct(null);
            handleRefresh(); // رفرش لیست بعد از ادیت
            Alert.alert('موفقیت 🎉', 'تغییرات ذخیره شد.');
        } catch (error) { Alert.alert('خطا', 'بروزرسانی انجام نشد. لطفاً دوباره تلاش کنید.'); } finally { setIsUpdating(false); }
    };

    const renderProductItem = ({ item }: { item: any }) => {
        const hasImage = item.images && item.images.length > 0;
        const isVariable = item.type === 'variable';
        const isOutOfStock = item.stock_status === 'outofstock';
        const isDraft = item.status !== 'publish';
        const isOnSale = item.on_sale;

        let stockText = '';
        if (isOutOfStock) stockText = 'ناموجود';
        else if (item.stock_quantity !== null && item.stock_quantity !== undefined) stockText = `موجودی: ${item.stock_quantity}`;
        else stockText = 'موجود';

        return (
            <View style={[styles.productCard, isDraft && styles.productCardDraft]}>
                <View style={styles.cardHeader}>
                    <View style={styles.productInfo}>
                        <Text style={styles.productTitle} numberOfLines={2}>{item.name}</Text>
                        <View style={styles.badgesContainer}>
                            <Text style={[styles.badge, isVariable ? styles.badgeVariable : styles.badgeSimple]}>{isVariable ? 'متغیر' : 'ساده'}</Text>
                            <Text style={[styles.badge, isOutOfStock ? styles.badgeDanger : styles.badgeSuccess]}>{stockText}</Text>
                            {isDraft && <Text style={[styles.badge, styles.badgeDraft]}>پیش‌نویس</Text>}
                        </View>

                        <View style={styles.priceRow}>
                            <View style={styles.priceContainer}>
                                {item.sale_price ? (
                                    <>
                                        <Text style={styles.salePrice}>{formatPrice(item.sale_price)} <Text style={styles.currency}>تومان</Text></Text>
                                        <Text style={styles.regularPriceStrike}>{formatPrice(item.regular_price)}</Text>
                                    </>
                                ) : (<Text style={styles.price}>{formatPrice(item.price || item.regular_price)} <Text style={styles.currency}>تومان</Text></Text>)}
                            </View>
                            {isOnSale && (
                                <View style={styles.inlineSaleBadge}>
                                    <Feather name="percent" size={10} color="#fff" style={{ marginRight: 2 }} />
                                    <Text style={styles.inlineSaleBadgeTxt}>حراج</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.imageContainer}>
                        {hasImage ? (<Image source={{ uri: item.images[0].src }} style={styles.productImage} />) : (<View style={styles.noImagePlaceholder}><Feather name="image" size={24} color="#94a3b8" /></View>)}
                    </View>
                </View>
                <View style={styles.cardFooter}>
                    <TouchableOpacity style={styles.footerBtn} onPress={() => openQuickEdit(item)}><Feather name="edit-3" size={13} color="#475569" /><Text style={styles.footerBtnTxt}>ویرایش سریع</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.footerBtn, styles.footerBtnCenter]} onPress={() => setFullEditProduct(item)}><Feather name="sliders" size={13} color="#96588a" /><Text style={[styles.footerBtnTxt, { color: '#96588a' }]}>ویرایش کامل</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.footerBtn} onPress={() => openProductUrl(item.permalink)}><Feather name="external-link" size={13} color="#10b981" /><Text style={[styles.footerBtnTxt, { color: '#10b981' }]}>مشاهده</Text></TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsFilterSidebarVisible(true)}>
                        <Feather name="filter" size={20} color="#475569" />
                        {(selectedCatFilters.length > 0 || stockFilter !== 'all') && (
                            <View style={styles.activeFilterDot} />
                        )}
                    </TouchableOpacity>

                    <View style={styles.searchContainer}>
                        <Feather name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="جستجوی هوشمند..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                                <Feather name="x" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: '#10b981', borderColor: '#059669' }]} onPress={() => { setFullEditProduct(null); setIsAddModalVisible(true); }}>
                        <Feather name="plus" size={22} color="#ffffff" />
                    </TouchableOpacity>
                </View>

                {/* نشانگر آپدیت بی‌صدا در پس‌زمینه */}
                {isSilentUpdating && (
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
                        <ActivityIndicator size="small" color="#94a3b8" style={{ marginLeft: 5 }} />
                        <Text style={{ fontSize: 10, color: '#94a3b8' }}>درحال دریافت محصولات جدید...</Text>
                    </View>
                )}
            </View>

            {loading && page === 1 && products.length === 0 ? (
                <View style={styles.centerContainer}><ActivityIndicator size="large" color="#10b981" /><Text style={styles.loadingTxt}>در حال دریافت کالاها...</Text></View>
            ) : products.length === 0 ? (
                <View style={styles.centerContainer}><Feather name="box" size={48} color="#cbd5e1" /><Text style={styles.emptyTxt}>هیچ محصولی یافت نشد!</Text></View>
            ) : (
                <FlatList
                    data={products} keyExtractor={(item, index) => item.id.toString() + index} renderItem={renderProductItem} contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#10b981']} />} onEndReached={handleLoadMore} onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? (
                        <View style={styles.footerLoader}>
                            <ActivityIndicator size="large" color="#10b981" />
                            <Text style={styles.footerLoaderTxt}>در حال دریافت...</Text>
                        </View>
                    ) : <View style={{ height: 40 }} />}
                />
            )}

            <Modal visible={isFilterSidebarVisible} animationType="fade" transparent onRequestClose={() => setIsFilterSidebarVisible(false)}>
                <View style={styles.sidebarOverlay}>
                    <View style={styles.sidebarContent}>
                        <View style={styles.sidebarHeader}>
                            <Text style={styles.sidebarTitle}>فیلتر و دسته‌بندی</Text>
                            <TouchableOpacity onPress={() => setIsFilterSidebarVisible(false)}>
                                <Feather name="chevron-right" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                            <Text style={styles.sidebarSectionTitle}>وضعیت موجودی:</Text>
                            <View style={styles.stockFiltersCol}>
                                <TouchableOpacity style={[styles.sidebarFilterBtn, stockFilter === 'all' && styles.sidebarFilterBtnActive]} onPress={() => setStockFilter('all')}>
                                    <Feather name={stockFilter === 'all' ? "check-circle" : "circle"} size={16} color={stockFilter === 'all' ? "#10b981" : "#cbd5e1"} />
                                    <Text style={[styles.sidebarFilterBtnTxt, stockFilter === 'all' && styles.sidebarFilterBtnTxtActive]}>همه وضعیت‌ها</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sidebarFilterBtn, stockFilter === 'instock' && styles.sidebarFilterBtnActive]} onPress={() => setStockFilter('instock')}>
                                    <Feather name={stockFilter === 'instock' ? "check-circle" : "circle"} size={16} color={stockFilter === 'instock' ? "#10b981" : "#cbd5e1"} />
                                    <Text style={[styles.sidebarFilterBtnTxt, stockFilter === 'instock' && styles.sidebarFilterBtnTxtActive]}>فقط کالاهای موجود</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sidebarFilterBtn, stockFilter === 'outofstock' && styles.sidebarFilterBtnActive]} onPress={() => setStockFilter('outofstock')}>
                                    <Feather name={stockFilter === 'outofstock' ? "check-circle" : "circle"} size={16} color={stockFilter === 'outofstock' ? "#10b981" : "#cbd5e1"} />
                                    <Text style={[styles.sidebarFilterBtnTxt, stockFilter === 'outofstock' && styles.sidebarFilterBtnTxtActive]}>فقط ناموجود</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.sidebarDivider} />

                            <Text style={styles.sidebarSectionTitle}>دسته‌بندی‌ها:</Text>
                            {categories.map(c => {
                                const isSelected = selectedCatFilters.includes(c.id);
                                return (
                                    <TouchableOpacity key={c.id} style={styles.sidebarCatRow} onPress={() => toggleCatFilter(c.id)}>
                                        <Feather name={isSelected ? "check-square" : "square"} size={18} color={isSelected ? "#10b981" : "#cbd5e1"} />
                                        <Text style={styles.sidebarCatTxt}>{c.name}</Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </ScrollView>

                        <View style={styles.sidebarFooter}>
                            <TouchableOpacity style={styles.sidebarApplyBtn} onPress={() => setIsFilterSidebarVisible(false)}>
                                <Text style={styles.sidebarApplyTxt}>مشاهده نتایج</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sidebarClearBtn} onPress={() => { setSelectedCatFilters([]); setStockFilter('all'); }}>
                                <Text style={styles.sidebarClearTxt}>حذف همه</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.sidebarCloseArea} onPress={() => setIsFilterSidebarVisible(false)} />
                </View>
            </Modal>

            <AddProductModal visible={isAddModalVisible || !!fullEditProduct} productToEdit={fullEditProduct} onClose={() => { setIsAddModalVisible(false); setFullEditProduct(null); }} onSuccess={() => { setIsAddModalVisible(false); setFullEditProduct(null); handleRefresh(); }} />

            <Modal visible={!!editingProduct} animationType="fade" transparent onRequestClose={() => setEditingProduct(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.quickEditModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>ویرایش سریع: {editingProduct?.name}</Text>
                            <TouchableOpacity onPress={() => setEditingProduct(null)} style={{ padding: 4 }}><Feather name="x" size={22} color="#64748b" /></TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                            <View style={styles.inputGroup}><Text style={styles.label}>نام محصول:</Text><TextInput style={styles.input} value={editName} onChangeText={setEditName} textAlign="right" /></View>

                            {editingProduct?.type === 'simple' && (
                                <>
                                    <View style={styles.inputGroup}><Text style={styles.label}>قیمت عادی (تومان):</Text><TextInput style={styles.input} value={editPrice} onChangeText={(val) => setEditPrice(formatPrice(cleanNumber(val)))} keyboardType="numeric" /></View>
                                    <View style={styles.inputGroup}><Text style={styles.label}>قیمت حراج (تومان):</Text><TextInput style={[styles.input, { borderColor: '#fda4af', backgroundColor: '#fff1f2' }]} value={editSalePrice} onChangeText={(val) => setEditSalePrice(formatPrice(cleanNumber(val)))} keyboardType="numeric" /></View>

                                    <View style={styles.dateAccordion}>
                                        <TouchableOpacity style={styles.dateAccordionHeader} onPress={() => setShowSaleDates(!showSaleDates)}>
                                            <Feather name={showSaleDates ? "chevron-up" : "chevron-down"} size={18} color="#e11d48" />
                                            <Text style={styles.dateAccordionTitle}>برنامه‌ریزی تاریخ حراجی</Text>
                                        </TouchableOpacity>
                                        {showSaleDates && (
                                            <View style={styles.dateAccordionContent}>
                                                <View style={styles.dateRow}>
                                                    <Text style={styles.miniLabel}>از تاریخ (مثلاً 2024-05-12):</Text>
                                                    <TextInput style={styles.miniInput} placeholder="YYYY-MM-DD" value={saleDateFrom} onChangeText={setSaleDateFrom} textAlign="center" />
                                                </View>
                                                <View style={styles.dateRow}>
                                                    <Text style={styles.miniLabel}>تا تاریخ (مثلاً 2024-06-12):</Text>
                                                    <TextInput style={styles.miniInput} placeholder="YYYY-MM-DD" value={saleDateTo} onChangeText={setSaleDateTo} textAlign="center" />
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.inputGroup}><Text style={styles.label}>موجودی انبار (عدد):</Text><TextInput style={styles.input} value={editStock} onChangeText={setEditStock} keyboardType="numeric" /></View>
                                </>
                            )}

                            {editingProduct?.type === 'variable' && (
                                <View style={styles.variableSection}>
                                    <Text style={[styles.label, { color: '#6b21a8', marginBottom: 10 }]}>⚡ تنظیم سریع تنوع‌ها (هر مدل در یک لاین):</Text>
                                    {loadingVariations ? (<ActivityIndicator color="#96588a" style={{ marginVertical: 20 }} />) : variationsList.length === 0 ? (<Text style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>هیچ تنوعی یافت نشد.</Text>) : (
                                        variationsList.map((varItem) => {
                                            const varTitle = varItem.attributes.map((a: any) => a.option).join(' | ');
                                            return (
                                                <View key={varItem.id} style={styles.variationRow}>
                                                    <Text style={styles.variationTitle} numberOfLines={1}>🔸 {varTitle}</Text>
                                                    <View style={styles.variationInputsContainer}>
                                                        <View style={{ flex: 1.2, marginLeft: 4 }}><Text style={styles.miniLabel}>قیمت عادی:</Text><TextInput style={styles.miniInput} value={formatPrice(varItem.regular_price || '')} onChangeText={(val) => updateVariationRow(varItem.id, 'regular_price', val)} keyboardType="numeric" placeholder="۰" /></View>
                                                        <View style={{ flex: 1.2, marginHorizontal: 4 }}><Text style={[styles.miniLabel, { color: '#e11d48' }]}>🔥 حراج:</Text><TextInput style={[styles.miniInput, { backgroundColor: '#fff1f2', borderColor: '#fda4af', color: '#e11d48' }]} value={formatPrice(varItem.sale_price || '')} onChangeText={(val) => updateVariationRow(varItem.id, 'sale_price', val)} keyboardType="numeric" placeholder="ندارد" /></View>
                                                        <View style={{ flex: 0.8, marginRight: 4 }}><Text style={styles.miniLabel}>تعداد:</Text><TextInput style={[styles.miniInput, { textAlign: 'center' }]} value={varItem.stock_quantity !== null && varItem.stock_quantity !== undefined ? String(varItem.stock_quantity) : ''} onChangeText={(val) => updateVariationRow(varItem.id, 'stock_quantity', val)} keyboardType="numeric" placeholder="۰" /></View>
                                                    </View>
                                                </View>
                                            );
                                        })
                                    )}
                                </View>
                            )}
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.submitBtn} onPress={submitQuickEdit} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnTxt}>ذخیره تغییرات</Text>}</TouchableOpacity>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingProduct(null)}><Text style={styles.cancelBtnTxt}>انصراف</Text></TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { backgroundColor: '#ffffff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 10 : 45, paddingBottom: 15, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    headerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    headerIconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    activeFilterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e11d48', position: 'absolute', top: -2, right: -2, borderWidth: 1, borderColor: '#fff' },
    searchContainer: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 10, height: 44 },
    searchIcon: { marginLeft: 6 },
    searchInput: { flex: 1, height: '100%', fontSize: 13, textAlign: 'right', color: '#0f172a', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
    clearSearchBtn: { padding: 8 },
    sidebarOverlay: { flex: 1, flexDirection: 'row-reverse', backgroundColor: 'rgba(15, 23, 42, 0.6)' },
    sidebarContent: { width: '70%', height: '100%', backgroundColor: '#f8fafc', padding: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 20 : 50, elevation: 10 },
    sidebarCloseArea: { flex: 1 },
    sidebarHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 15 },
    sidebarTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
    sidebarSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 12 },
    stockFiltersCol: { flexDirection: 'column' },
    sidebarFilterBtn: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#ffffff', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    sidebarFilterBtnActive: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
    sidebarFilterBtnTxt: { fontSize: 12, color: '#475569', fontWeight: 'bold', marginRight: 8 },
    sidebarFilterBtnTxtActive: { color: '#047857' },
    sidebarDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 15 },
    sidebarCatRow: { flexDirection: 'row-reverse', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 4, borderRadius: 8 },
    sidebarCatTxt: { fontSize: 12, color: '#334155', fontWeight: 'bold', marginRight: 8 },
    sidebarFooter: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 15, gap: 8 },
    sidebarApplyBtn: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    sidebarApplyTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    sidebarClearBtn: { backgroundColor: '#fef2f2', paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
    sidebarClearTxt: { color: '#ef4444', fontWeight: 'bold', fontSize: 13 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTxt: { marginTop: 12, fontSize: 13, color: '#64748b', fontWeight: 'bold' },
    emptyTxt: { marginTop: 12, fontSize: 14, color: '#94a3b8', fontWeight: 'bold' },
    listContainer: { padding: 16, paddingBottom: 80 },
    footerLoader: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
    footerLoaderTxt: { marginTop: 8, fontSize: 11, color: '#10b981', fontWeight: 'bold' },
    productCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
    productCardDraft: { opacity: 0.8, backgroundColor: '#f8fafc', borderStyle: 'dashed' },
    cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    productInfo: { flex: 1, marginLeft: 10 },
    productTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 6, textAlign: 'right', lineHeight: 20 },
    badgesContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginBottom: 8 },
    badge: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, marginLeft: 5, marginBottom: 4 },
    badgeSimple: { backgroundColor: '#f1f5f9', color: '#475569' },
    badgeVariable: { backgroundColor: '#f3e8ff', color: '#6b21a8' },
    badgeSuccess: { backgroundColor: '#ecfdf5', color: '#059669' },
    badgeDanger: { backgroundColor: '#fef2f2', color: '#e11d48' },
    badgeDraft: { backgroundColor: '#fef9c3', color: '#d97706' },
    priceRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start' },
    priceContainer: { flexDirection: 'row-reverse', alignItems: 'center' },
    price: { fontSize: 13, fontWeight: '900', color: '#0f172a' },
    salePrice: { fontSize: 13, fontWeight: '900', color: '#e11d48', marginLeft: 6 },
    regularPriceStrike: { fontSize: 11, color: '#94a3b8', textDecorationLine: 'line-through' },
    currency: { fontSize: 9, fontWeight: 'normal' },
    inlineSaleBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#e11d48', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
    inlineSaleBadgeTxt: { color: '#ffffff', fontSize: 9, fontWeight: '900' },
    imageContainer: { width: 70, height: 70, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9', position: 'relative' },
    productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    noImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    cardFooter: { flexDirection: 'row-reverse', borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 10, paddingTop: 8 },
    footerBtn: { flexDirection: 'row-reverse', flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 4 },
    footerBtnCenter: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#e2e8f0' },
    footerBtnTxt: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginRight: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 16 },
    quickEditModal: { backgroundColor: '#ffffff', borderRadius: 20, padding: 18, elevation: 10, maxHeight: '88%' },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 },
    modalTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right', flex: 1, paddingLeft: 10 },
    modalBody: { marginBottom: 10 },
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 6 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, fontSize: 13, textAlign: 'left', fontWeight: 'bold', color: '#0f172a' },
    dateAccordion: { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#ffe4e6', borderRadius: 10, marginBottom: 14, overflow: 'hidden' },
    dateAccordionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
    dateAccordionTitle: { fontSize: 11, fontWeight: 'bold', color: '#e11d48' },
    dateAccordionContent: { padding: 10, borderTopWidth: 1, borderTopColor: '#ffe4e6' },
    dateRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    variableSection: { backgroundColor: '#f5f3ff', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#ddd6fe', marginTop: 4 },
    variationRow: { backgroundColor: '#ffffff', padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e9d5ff' },
    variationTitle: { fontSize: 12, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 8 },
    variationInputsContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    miniLabel: { fontSize: 10, color: '#64748b', textAlign: 'right', marginBottom: 4, fontWeight: 'bold' },
    miniInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 6, fontSize: 11, textAlign: 'left', fontWeight: 'bold', color: '#0f172a' },
    modalFooter: { flexDirection: 'row-reverse', marginTop: 10 },
    submitBtn: { flex: 2, backgroundColor: '#10b981', padding: 13, borderRadius: 12, alignItems: 'center', marginLeft: 8 },
    submitBtnTxt: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
    cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 13, borderRadius: 12, alignItems: 'center' },
    cancelBtnTxt: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
});