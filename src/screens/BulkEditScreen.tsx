import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, 
    Alert, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createWooClient } from '../api/client';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const BulkEditScreen: React.FC = () => {
    const authStore = useAuthStore() as any;
    const siteUrl = authStore.siteUrl || authStore.url || '';

    const [targetMode, setTargetMode] = useState<'categories' | 'products'>('categories');
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [isCatAccordionOpen, setIsCatAccordionOpen] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [stockFilter, setStockFilter] = useState<'any' | 'instock' | 'outofstock'>('any');
    const [searchedProducts, setSearchedProducts] = useState<any[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // 🚀 استیت‌های جدید و تفکیک‌شده برای قیمت اصلی و حراج
    const [actionType, setActionType] = useState<'price_regular' | 'price_sale' | 'stock' | 'status'>('price_regular');
    const [valueType, setValueType] = useState<'percent' | 'fixed'>('percent');
    const [priceDirection, setPriceDirection] = useState<'inc' | 'dec'>('inc');
    
    const [numericValue, setNumericValue] = useState('');
    const [statusValue, setStatusValue] = useState<'publish' | 'draft'>('publish');
    
    const [loading, setLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => { fetchCategories(); }, []);
    
    useEffect(() => {
        if (targetMode === 'products') {
            if (searchQuery.length >= 3) handleProductSearch(searchQuery);
            else fetchInitialProducts();
        }
    }, [targetMode, stockFilter]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const client = createWooClient();
            const res = await client.get('products/categories', { params: { per_page: 100, hide_empty: false } });
            setCategories(res.data);
        } catch (error) { console.log(error); } finally { setLoading(false); }
    };

    const fetchInitialProducts = async () => {
        setIsSearching(true);
        try {
            const client = createWooClient();
            const params: any = { per_page: 30, status: 'any' };
            if (stockFilter !== 'any') params.stock_status = stockFilter;
            const res = await client.get('products', { params });
            setSearchedProducts(res.data);
        } catch (error) { console.log(error); } finally { setIsSearching(false); }
    };

    const handleProductSearch = (text: string) => {
        setSearchQuery(text);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (text.length === 0) return fetchInitialProducts();
        if (text.length < 3) return;
        
        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const client = createWooClient();
                const params: any = { search: text, per_page: 30, status: 'any' };
                if (stockFilter !== 'any') params.stock_status = stockFilter;
                const res = await client.get('products', { params });
                setSearchedProducts(res.data);
            } catch (error) { console.log(error); } finally { setIsSearching(false); }
        }, 800);
    };

    const toggleCategory = (id: number) => {
        if (selectedCategories.includes(id)) setSelectedCategories(selectedCategories.filter(catId => catId !== id));
        else setSelectedCategories([...selectedCategories, id]);
    };

    const toggleSelectAllCats = () => {
        if (selectedCategories.length === categories.length) setSelectedCategories([]);
        else setSelectedCategories(categories.map(c => c.id));
    };

    const toggleProduct = (product: any) => {
        if (selectedProducts.find(p => p.id === product.id)) setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
        else setSelectedProducts([...selectedProducts, product]);
    };

    const toggleSelectAllProducts = () => {
        const allSelected = searchedProducts.every(p => selectedProducts.find(sp => sp.id === p.id));
        if (allSelected) {
            setSelectedProducts(selectedProducts.filter(sp => !searchedProducts.find(p => p.id === sp.id)));
        } else {
            const newSelection = [...selectedProducts];
            searchedProducts.forEach(p => { if (!newSelection.find(sp => sp.id === p.id)) newSelection.push(p); });
            setSelectedProducts(newSelection);
        }
    };

    const scrollToInput = () => { setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 250); };

    const executeBulkAction = async () => {
        if (targetMode === 'categories' && selectedCategories.length === 0) return Alert.alert('توجه', 'لطفاً دسته‌بندی را انتخاب کنید.');
        if (targetMode === 'products' && selectedProducts.length === 0) return Alert.alert('توجه', 'لطفاً محصولی را انتخاب کنید.');
        if (!numericValue && actionType !== 'status') return Alert.alert('توجه', 'لطفاً مقدار عددی را وارد کنید.');

        Alert.alert('تایید اجرا', 'تغییرات روی تمامی سایزها و رنگ‌ها اعمال خواهد شد و قیمت‌ها هوشمندانه رند می‌شوند. مطمئن هستید؟', [
            { text: 'انصراف', style: 'cancel' },
            { 
                text: 'اعمال تغییرات', style: 'destructive', 
                onPress: async () => {
                    setIsExecuting(true);
                    try {
                        const payload = {
                            target_mode: targetMode,
                            category_ids: selectedCategories,
                            product_ids: selectedProducts.map(p => p.id),
                            action_type: actionType,
                            value_type: valueType,
                            direction: priceDirection,
                            value: numericValue,
                            status_value: statusValue
                        };

                        const res = await axios.post(`${siteUrl}/wp-json/pishmo/v1/bulk-edit`, payload);
                        
                        if (res.data && res.data.success) {
                            Alert.alert('موفق', `عملیات روی ${res.data.updated_count} محصول (و تمام متغیرهای آن‌ها) با موفقیت اعمال شد!`);
                            setNumericValue('');
                        } else {
                            Alert.alert('توجه', res.data.message || 'عملیات ناموفق بود.');
                        }
                    } catch (error) {
                        Alert.alert('خطا', 'مشکلی در اجرای عملیات رخ داد.');
                    } finally {
                        setIsExecuting(false);
                    }
                } 
            }
        ]);
    };

    const formatPrice = (price: string | number) => price ? price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '۰';

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
            <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 300 }} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Feather name="layers" size={18} color="#8b5cf6" />
                    <Text style={styles.title}>ویرایشگر گروهی محصولات</Text>
                </View>

                {/* ۱. تب‌های انتخاب هدف */}
                <View style={styles.card}>
                    <Text style={styles.label}>۱. تغییرات روی چه چیزی اعمال شود؟</Text>
                    <View style={styles.tabRow}>
                        <TouchableOpacity style={[styles.tabBtn, targetMode === 'categories' && styles.tabBtnActive]} onPress={() => setTargetMode('categories')}>
                            <Text style={[styles.tabTxt, targetMode === 'categories' && styles.tabTxtActive]}>دسته‌بندی‌ها</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, targetMode === 'products' && styles.tabBtnActive]} onPress={() => setTargetMode('products')}>
                            <Text style={[styles.tabTxt, targetMode === 'products' && styles.tabTxtActive]}>محصولات خاص</Text>
                        </TouchableOpacity>
                    </View>

                    {targetMode === 'categories' && (
                        <View style={styles.accordionWrap}>
                            <TouchableOpacity style={styles.accordionHeader} onPress={() => setIsCatAccordionOpen(!isCatAccordionOpen)}>
                                <Text style={styles.accordionTitle}>انتخاب دسته‌ها ({selectedCategories.length} مورد)</Text>
                                <Feather name={isCatAccordionOpen ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
                            </TouchableOpacity>
                            {isCatAccordionOpen && (
                                <View style={styles.accordionBody}>
                                    <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAllCats}>
                                        <Text style={styles.selectAllTxt}>{selectedCategories.length === categories.length ? 'لغو انتخاب همه' : 'انتخاب همه'}</Text>
                                    </TouchableOpacity>
                                    <View style={styles.chipWrap}>
                                        {categories.map(cat => (
                                            <TouchableOpacity key={cat.id} style={[styles.chip, selectedCategories.includes(cat.id) && styles.chipActive]} onPress={() => toggleCategory(cat.id)}>
                                                <Text style={[styles.chipTxt, selectedCategories.includes(cat.id) && styles.chipTxtActive]}>{cat.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {targetMode === 'products' && (
                        <View style={{ marginTop: 8 }}>
                            <View style={styles.stockFilterRow}>
                                <TouchableOpacity style={[styles.stockFilterBtn, stockFilter === 'any' && styles.stockFilterBtnActive]} onPress={() => setStockFilter('any')}><Text style={[styles.stockFilterTxt, stockFilter === 'any' && styles.stockFilterTxtActive]}>همه</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.stockFilterBtn, stockFilter === 'instock' && styles.stockFilterBtnActive]} onPress={() => setStockFilter('instock')}><Text style={[styles.stockFilterTxt, stockFilter === 'instock' && styles.stockFilterTxtActive]}>موجود</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.stockFilterBtn, stockFilter === 'outofstock' && styles.stockFilterBtnActive]} onPress={() => setStockFilter('outofstock')}><Text style={[styles.stockFilterTxt, stockFilter === 'outofstock' && styles.stockFilterTxtActive]}>ناموجود</Text></TouchableOpacity>
                            </View>

                            <View style={styles.searchBox}>
                                <TextInput style={styles.searchInput} placeholder="جستجو نام محصول..." value={searchQuery} onChangeText={handleProductSearch} textAlign="right" />
                                {isSearching ? <ActivityIndicator size="small" color="#8b5cf6" /> : <Feather name="search" size={14} color="#94a3b8" />}
                            </View>
                            
                            <View style={styles.productListWrap}>
                                <View style={styles.productListHeader}>
                                    <Text style={styles.selectedCountTxt}>انتخاب شده: {selectedProducts.length} محصول</Text>
                                    <TouchableOpacity style={styles.selectAllBtnSmall} onPress={toggleSelectAllProducts}>
                                        <Text style={styles.selectAllTxt}>{searchedProducts.length > 0 && searchedProducts.every(p => selectedProducts.find(sp => sp.id === p.id)) ? 'لغو همه' : 'انتخاب همه'}</Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.productListScroll} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                                    {searchedProducts.map(p => {
                                        const isSelected = !!selectedProducts.find(sp => sp.id === p.id);
                                        return (
                                            <TouchableOpacity key={p.id} style={[styles.productRow, isSelected && styles.productRowSelected]} onPress={() => toggleProduct(p)}>
                                                <View style={styles.productRowRight}>
                                                    <Feather name={isSelected ? "check-square" : "square"} size={16} color={isSelected ? "#8b5cf6" : "#cbd5e1"} />
                                                    <Text style={[styles.productRowTxt, isSelected && styles.productRowTxtSelected]} numberOfLines={2}>{p.name}</Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.productPriceTxt}>{formatPrice(p.price)} تومان</Text>
                                                    <Text style={[styles.stockTxt, p.stock_status === 'instock' ? {color: '#10b981'} : {color: '#ef4444'}]}>
                                                        {p.stock_status === 'instock' ? 'موجود' : 'ناموجود'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </View>
                    )}
                </View>

                {/* ۲. نوع عملیات */}
                <View style={styles.card}>
                    <Text style={styles.label}>۲. چه تغییری اعمال شود؟</Text>
                    <View style={styles.actionGrid}>
                        <TouchableOpacity style={[styles.actionBtn, actionType === 'price_regular' && styles.actionBtnActive]} onPress={() => { setActionType('price_regular'); setNumericValue(''); }}>
                            <Text style={[styles.actionBtnTxt, actionType === 'price_regular' && styles.actionBtnTxtActive]}>قیمت اصلی (عادی)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, actionType === 'price_sale' && styles.actionBtnActive]} onPress={() => { setActionType('price_sale'); setNumericValue(''); }}>
                            <Text style={[styles.actionBtnTxt, actionType === 'price_sale' && styles.actionBtnTxtActive]}>قیمت حراج (تخفیف)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, actionType === 'stock' && styles.actionBtnActive]} onPress={() => { setActionType('stock'); setNumericValue(''); }}>
                            <Text style={[styles.actionBtnTxt, actionType === 'stock' && styles.actionBtnTxtActive]}>موجودی انبار</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, actionType === 'status' && styles.actionBtnActive]} onPress={() => setActionType('status')}>
                            <Text style={[styles.actionBtnTxt, actionType === 'status' && styles.actionBtnTxtActive]}>وضعیت انتشار</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ۳. مقادیر و جهت تغییر */}
                <View style={styles.card}>
                    <Text style={styles.label}>۳. مقدار تغییر:</Text>
                    
                    {(actionType === 'price_regular' || actionType === 'price_sale') && (
                        <View style={styles.directionRow}>
                            <TouchableOpacity style={[styles.dirBtn, valueType === 'percent' && styles.dirBtnActive]} onPress={() => setValueType('percent')}>
                                <Text style={[styles.dirTxt, valueType === 'percent' && {color: '#fff'}]}>درصدی (%)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.dirBtn, valueType === 'fixed' && styles.dirBtnActive]} onPress={() => setValueType('fixed')}>
                                <Text style={[styles.dirTxt, valueType === 'fixed' && {color: '#fff'}]}>مبلغ ثابت (تومان)</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {actionType === 'price_regular' && (
                        <View style={styles.directionRow}>
                            <TouchableOpacity style={[styles.dirBtn, priceDirection === 'inc' && styles.dirBtnInc]} onPress={() => setPriceDirection('inc')}>
                                <Feather name="arrow-up-circle" size={14} color={priceDirection === 'inc' ? '#fff' : '#059669'} style={{marginLeft: 4}} />
                                <Text style={[styles.dirTxt, priceDirection === 'inc' && {color: '#fff'}]}>افزایش دهد</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.dirBtn, priceDirection === 'dec' && styles.dirBtnDec]} onPress={() => setPriceDirection('dec')}>
                                <Feather name="arrow-down-circle" size={14} color={priceDirection === 'dec' ? '#fff' : '#dc2626'} style={{marginLeft: 4}} />
                                <Text style={[styles.dirTxt, priceDirection === 'dec' && {color: '#fff'}]}>کاهش دهد</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {(actionType === 'price_regular' || actionType === 'price_sale' || actionType === 'stock') && (
                        <TextInput 
                            style={styles.input} 
                            placeholder={
                                actionType === 'stock' ? "موجودی جدید (مثلاً 50 یا 0)" : 
                                actionType === 'price_sale' ? "تخفیف از قیمت اصلی (عدد 0 = لغو حراج)" : "مقدار عدد را وارد کنید..."
                            } 
                            keyboardType="numeric" 
                            value={numericValue} 
                            onChangeText={setNumericValue} 
                            textAlign="right" 
                            onFocus={scrollToInput} 
                        />
                    )}

                    {actionType === 'status' && (
                        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 4 }}>
                            <TouchableOpacity style={[styles.statusBtn, statusValue === 'draft' && {backgroundColor: '#ef4444', borderColor: '#ef4444'}]} onPress={() => setStatusValue('draft')}>
                                <Text style={[styles.statusBtnTxt, statusValue === 'draft' && {color: '#fff'}]}>پیش‌نویس (مخفی)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.statusBtn, statusValue === 'publish' && {backgroundColor: '#10b981', borderColor: '#10b981'}]} onPress={() => setStatusValue('publish')}>
                                <Text style={[styles.statusBtnTxt, statusValue === 'publish' && {color: '#fff'}]}>منتشر شده</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <TouchableOpacity style={styles.executeBtn} onPress={executeBulkAction} disabled={isExecuting}>
                    {isExecuting ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <Text style={styles.executeBtnTxt}>اعمال سریع تغییرات</Text>
                            <Feather name="zap" size={16} color="#fff" style={{ marginLeft: 6 }} />
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default BulkEditScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingTop: 10 },
    header: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginRight: 6 },
    card: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8, elevation: 1 },
    label: { fontSize: 11, fontWeight: '900', color: '#1e293b', textAlign: 'right', marginBottom: 6 },
    tabRow: { flexDirection: 'row-reverse', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 3, marginBottom: 8 },
    tabBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
    tabBtnActive: { backgroundColor: '#fff', elevation: 1 },
    tabTxt: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    tabTxtActive: { color: '#8b5cf6', fontWeight: '900' },
    accordionWrap: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' },
    accordionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 8, backgroundColor: '#f8fafc' },
    accordionTitle: { fontSize: 10, fontWeight: 'bold', color: '#334155' },
    accordionBody: { padding: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
    chipWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 },
    chip: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    chipActive: { backgroundColor: '#8b5cf6', borderColor: '#7c3aed' },
    chipTxt: { fontSize: 9, fontWeight: 'bold', color: '#475569', maxWidth: 100 },
    chipTxtActive: { color: '#fff' },
    
    stockFilterRow: { flexDirection: 'row-reverse', gap: 4, marginBottom: 8 },
    stockFilterBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 6, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    stockFilterBtnActive: { backgroundColor: '#3b82f6', borderColor: '#2563eb' },
    stockFilterTxt: { fontSize: 9, fontWeight: 'bold', color: '#64748b' },
    stockFilterTxtActive: { color: '#fff' },

    searchBox: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 8 },
    searchInput: { flex: 1, paddingVertical: 6, fontSize: 11, color: '#0f172a' },
    
    productListWrap: { marginTop: 8, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' },
    productListHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 8, backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    selectedCountTxt: { fontSize: 10, fontWeight: 'bold', color: '#3b82f6' },
    selectAllBtnSmall: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    selectAllTxt: { fontSize: 9, color: '#475569', fontWeight: 'bold' },
    
    productListScroll: { maxHeight: 280 },
    productRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    productRowSelected: { backgroundColor: '#f3e8ff' }, 
    productRowRight: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1 },
    productRowTxt: { fontSize: 11, color: '#334155', marginRight: 8, flexShrink: 1, textAlign: 'right', lineHeight: 16 },
    productRowTxtSelected: { color: '#581c87', fontWeight: 'bold' },
    productPriceTxt: { fontSize: 10, color: '#64748b', fontWeight: 'bold' },
    stockTxt: { fontSize: 8, fontWeight: 'bold', textAlign: 'right', marginTop: 2 },

    actionGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
    actionBtn: { width: '48%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    actionBtnActive: { backgroundColor: '#8b5cf6', borderColor: '#7c3aed' },
    actionBtnTxt: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
    actionBtnTxtActive: { color: '#fff' },

    directionRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 6 },
    dirBtn: { flex: 1, flexDirection: 'row-reverse', paddingVertical: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    dirBtnActive: { backgroundColor: '#3b82f6', borderColor: '#2563eb' },
    dirBtnInc: { backgroundColor: '#10b981', borderColor: '#059669' },
    dirBtnDec: { backgroundColor: '#ef4444', borderColor: '#dc2626' },
    dirTxt: { fontSize: 10, fontWeight: 'bold', color: '#475569' },

    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, fontSize: 12, color: '#0f172a' },
    
    statusBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    statusBtnTxt: { fontSize: 10, fontWeight: 'bold', color: '#475569' },

    executeBtn: { flexDirection: 'row-reverse', backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 5, elevation: 1 },
    executeBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
});