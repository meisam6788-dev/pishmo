import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, 
    Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { createWooClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import RichEditorToolbar from '../components/RichEditorToolbar';

type MainType = 'product' | 'post';
type TabType = 'product_cat' | 'product_tag' | 'product_attr' | 'post_cat' | 'post_tag';

export const TaxonomyScreen: React.FC = () => {
    const authStore = useAuthStore() as any;
    const siteUrl = authStore.siteUrl || authStore.url || '';

    const [mainType, setMainType] = useState<MainType>('product');
    const [activeTab, setActiveTab] = useState<TabType>('product_cat');
    
    const [dataList, setDataList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [modalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const [itemName, setItemName] = useState('');
    const [itemSlug, setItemSlug] = useState('');
    const [itemDesc, setItemDesc] = useState('');
    
    // 🚀 استیت باز و بسته بودن آکاردئون سئو
    const [isSeoOpen, setIsSeoOpen] = useState(false);
    const [seoTitle, setSeoTitle] = useState('');
    const [seoDesc, setSeoDesc] = useState('');
    const [seoKeyword, setSeoKeyword] = useState('');

    const [termsModalVisible, setTermsModalVisible] = useState(false);
    const [attributeTerms, setAttributeTerms] = useState<any[]>([]);
    const [termsLoading, setTermsLoading] = useState(false);
    const [newTermName, setNewTermName] = useState('');
    const [newTermSlug, setNewTermSlug] = useState('');
    const [selectedAttribute, setSelectedAttribute] = useState<any>(null);

    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (mainType === 'product' && !activeTab.startsWith('product_')) setActiveTab('product_cat');
        if (mainType === 'post' && !activeTab.startsWith('post_')) setActiveTab('post_cat');
    }, [mainType]);

    useEffect(() => { fetchData(); }, [activeTab]);

    const fetchData = async () => {
        setLoading(true); setDataList([]);
        try {
            const client = createWooClient();
            let res;
            if (activeTab === 'product_cat') res = await client.get('products/categories', { params: { per_page: 100 } });
            else if (activeTab === 'product_tag') res = await client.get('products/tags', { params: { per_page: 100 } });
            else if (activeTab === 'product_attr') res = await client.get('products/attributes', { params: { per_page: 100 } });
            else if (activeTab === 'post_cat') res = await axios.get(`${siteUrl}/wp-json/wp/v2/categories`, { params: { per_page: 100 } });
            else if (activeTab === 'post_tag') res = await axios.get(`${siteUrl}/wp-json/wp/v2/tags`, { params: { per_page: 100 } });
            setDataList(res?.data || []);
        } catch (error) { console.log(error); } finally { setLoading(false); }
    };

    const openModal = (item: any = null) => {
        setIsSeoOpen(false); // 🚀 همیشه هنگام باز شدن فرم جدید، سئو بسته باشد
        if (item) {
            setSelectedItem(item); setItemName(item.name); setItemSlug(item.slug); setItemDesc(item.description || '');
            let metaTitle = '', metaDesc = '', metaKw = '';
            if (activeTab === 'product_cat' || activeTab === 'product_tag') {
                const md = item.meta_data || [];
                metaTitle = md.find((m:any) => m.key === '_yoast_wpseo_title' || m.key === 'rank_math_title')?.value || '';
                metaDesc = md.find((m:any) => m.key === '_yoast_wpseo_metadesc' || m.key === 'rank_math_description')?.value || '';
                metaKw = md.find((m:any) => m.key === '_yoast_wpseo_focuskw' || m.key === 'rank_math_focus_keyword')?.value || '';
            } else if (activeTab === 'post_cat' || activeTab === 'post_tag') {
                const meta = item.meta || {};
                metaTitle = meta._yoast_wpseo_title || meta.rank_math_title || '';
                metaDesc = meta._yoast_wpseo_metadesc || meta.rank_math_description || '';
                metaKw = meta._yoast_wpseo_focuskw || meta.rank_math_focus_keyword || '';
            }
            setSeoTitle(metaTitle); setSeoDesc(metaDesc); setSeoKeyword(metaKw);
        } else {
            setSelectedItem(null); setItemName(''); setItemSlug(''); setItemDesc('');
            setSeoTitle(''); setSeoDesc(''); setSeoKeyword('');
        }
        setModalVisible(true);
    };

    const saveItem = async () => {
        if (!itemName.trim()) return Alert.alert('توجه', 'نام الزامی است.');
        setIsSaving(true);
        try {
            if (activeTab === 'post_cat' || activeTab === 'post_tag') {
                const payload = {
                    name: itemName, slug: itemSlug || undefined, description: itemDesc,
                    meta: { _yoast_wpseo_title: seoTitle, _yoast_wpseo_metadesc: seoDesc, _yoast_wpseo_focuskw: seoKeyword, rank_math_title: seoTitle, rank_math_description: seoDesc, rank_math_focus_keyword: seoKeyword }
                };
                const endpoint = activeTab === 'post_cat' ? 'categories' : 'tags';
                if (selectedItem) await axios.post(`${siteUrl}/wp-json/wp/v2/${endpoint}/${selectedItem.id}`, payload);
                else await axios.post(`${siteUrl}/wp-json/wp/v2/${endpoint}`, payload);
            } else {
                const client = createWooClient();
                const payload: any = { name: itemName, slug: itemSlug || undefined, description: itemDesc };
                if (activeTab !== 'product_attr') {
                    payload.meta_data = [
                        { key: '_yoast_wpseo_title', value: seoTitle }, { key: 'rank_math_title', value: seoTitle },
                        { key: '_yoast_wpseo_metadesc', value: seoDesc }, { key: 'rank_math_description', value: seoDesc },
                        { key: '_yoast_wpseo_focuskw', value: seoKeyword }, { key: 'rank_math_focus_keyword', value: seoKeyword }
                    ];
                }
                let endpoint = activeTab === 'product_cat' ? 'products/categories' : (activeTab === 'product_tag' ? 'products/tags' : 'products/attributes');
                if (selectedItem) await client.put(`${endpoint}/${selectedItem.id}`, payload);
                else await client.post(endpoint, payload);
            }
            Alert.alert('موفق', 'اطلاعات با موفقیت ذخیره شد.');
            setModalVisible(false); fetchData();
        } catch (error) { Alert.alert('خطا', 'مشکلی در ذخیره اطلاعات پیش آمد.'); } finally { setIsSaving(false); }
    };

    const deleteItem = (id: number) => {
        Alert.alert('حذف دائم', 'آیا از حذف مطمئن هستید؟', [
            { text: 'انصراف', style: 'cancel' },
            { 
                text: 'حذف', style: 'destructive', 
                onPress: async () => {
                    setLoading(true);
                    try {
                        if (activeTab === 'post_cat' || activeTab === 'post_tag') {
                            const ep = activeTab === 'post_cat' ? 'categories' : 'tags';
                            await axios.delete(`${siteUrl}/wp-json/wp/v2/${ep}/${id}`, { params: { force: true } });
                        } else {
                            const client = createWooClient();
                            const ep = activeTab === 'product_cat' ? 'products/categories' : (activeTab === 'product_tag' ? 'products/tags' : 'products/attributes');
                            await client.delete(`${ep}/${id}`, { force: true });
                        }
                        fetchData();
                    } catch (error) { Alert.alert('خطا', 'حذف امکان‌پذیر نیست.'); } finally { setLoading(false); }
                } 
            }
        ]);
    };

    const openTermsModal = async (attribute: any) => {
        setSelectedAttribute(attribute);
        setTermsModalVisible(true);
        setTermsLoading(true);
        try {
            const client = createWooClient();
            const res = await client.get(`products/attributes/${attribute.id}/terms`, { params: { per_page: 100 } });
            setAttributeTerms(res.data);
        } catch (error) { Alert.alert('خطا', 'مشکلی در دریافت تنوع‌ها پیش آمد.'); } finally { setTermsLoading(false); }
    };

    const addTerm = async () => {
        if (!newTermName.trim()) return;
        setTermsLoading(true);
        try {
            const client = createWooClient();
            await client.post(`products/attributes/${selectedAttribute.id}/terms`, { name: newTermName, slug: newTermSlug || undefined });
            setNewTermName(''); setNewTermSlug('');
            const res = await client.get(`products/attributes/${selectedAttribute.id}/terms`, { params: { per_page: 100 } });
            setAttributeTerms(res.data);
        } catch (error) { Alert.alert('خطا', 'مشکلی در افزودن تنوع پیش آمد.'); } finally { setTermsLoading(false); }
    };

    const deleteTerm = (termId: number) => {
        Alert.alert('حذف', 'تنوع حذف شود؟', [
            { text: 'انصراف', style: 'cancel' },
            { 
                text: 'حذف', style: 'destructive', 
                onPress: async () => {
                    setTermsLoading(true);
                    try {
                        const client = createWooClient();
                        await client.delete(`products/attributes/${selectedAttribute.id}/terms/${termId}`, { force: true });
                        setAttributeTerms(prev => prev.filter(t => t.id !== termId));
                    } catch (error) { console.log(error); } finally { setTermsLoading(false); }
                }
            }
        ]);
    };

    const scrollToInput = () => { setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 250); };

    const filteredData = dataList.filter(c => c.name.includes(searchQuery));

    const renderCard = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSlug}>نامک: {item.slug}</Text>
                {activeTab !== 'product_attr' && (
                    <View style={styles.countBadge}><Text style={styles.countTxt}>{item.count} مورد</Text></View>
                )}
            </View>
            <View style={styles.actionCol}>
                {activeTab === 'product_attr' && (
                    <TouchableOpacity style={[styles.editBtn, {backgroundColor: '#10b981', flexDirection: 'row-reverse', marginBottom: 6}]} onPress={() => openTermsModal(item)}>
                        <Feather name="layers" size={14} color="#fff" />
                        <Text style={{color: '#fff', fontSize: 11, fontWeight: 'bold', marginRight: 6}}>مدیریت تنوع</Text>
                    </TouchableOpacity>
                )}
                <View style={{flexDirection: 'row-reverse', gap: 8, justifyContent: 'flex-end'}}>
                    <TouchableOpacity style={[styles.editBtn, {paddingHorizontal: 12}]} onPress={() => openModal(item)}>
                        <Feather name="edit-2" size={14} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.deleteBtn, {paddingHorizontal: 12}]} onPress={() => deleteItem(item.id)}>
                        <Feather name="trash-2" size={14} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>ساختار و طبقه‌بندی</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}><Feather name="plus" size={12} color="#fff" /><Text style={styles.addBtnTxt}>افزودن</Text></TouchableOpacity>
            </View>

            <View style={styles.mainToggleBox}>
                <TouchableOpacity style={[styles.mainToggleBtn, mainType === 'product' && styles.mainToggleActive]} onPress={() => setMainType('product')}>
                    <Text style={[styles.mainToggleTxt, mainType === 'product' && styles.mainToggleTxtActive]}>بخش محصولات</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mainToggleBtn, mainType === 'post' && styles.mainToggleActive]} onPress={() => setMainType('post')}>
                    <Text style={[styles.mainToggleTxt, mainType === 'post' && styles.mainToggleTxtActive]}>بخش مقالات</Text>
                </TouchableOpacity>
            </View>

            <View style={{ borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
                    {mainType === 'product' && (
                        <>
                            <TouchableOpacity style={[styles.tabBtn, activeTab === 'product_cat' && styles.tabBtnActive]} onPress={() => setActiveTab('product_cat')}><Text style={[styles.tabTxt, activeTab === 'product_cat' && styles.tabTxtActive]}>دسته‌بندی</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.tabBtn, activeTab === 'product_tag' && styles.tabBtnActive]} onPress={() => setActiveTab('product_tag')}><Text style={[styles.tabTxt, activeTab === 'product_tag' && styles.tabTxtActive]}>برچسب‌ها</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.tabBtn, activeTab === 'product_attr' && styles.tabBtnActive]} onPress={() => setActiveTab('product_attr')}><Text style={[styles.tabTxt, activeTab === 'product_attr' && styles.tabTxtActive]}>ویژگی‌ها</Text></TouchableOpacity>
                        </>
                    )}
                    {mainType === 'post' && (
                        <>
                            <TouchableOpacity style={[styles.tabBtn, activeTab === 'post_cat' && styles.tabBtnActive]} onPress={() => setActiveTab('post_cat')}><Text style={[styles.tabTxt, activeTab === 'post_cat' && styles.tabTxtActive]}>دسته‌بندی مقالات</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.tabBtn, activeTab === 'post_tag' && styles.tabBtnActive]} onPress={() => setActiveTab('post_tag')}><Text style={[styles.tabTxt, activeTab === 'post_tag' && styles.tabTxtActive]}>برچسب مقالات</Text></TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </View>

            <View style={styles.searchBox}><TextInput style={styles.searchInput} placeholder="جستجو..." value={searchQuery} onChangeText={setSearchQuery} textAlign="right" /><Feather name="search" size={14} color="#94a3b8" /></View>

            {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /></View> : filteredData.length === 0 ? <View style={styles.center}><Text style={styles.emptyTxt}>موردی یافت نشد.</Text></View> : (
                <FlatList data={filteredData} keyExtractor={item => item.id.toString()} renderItem={renderCard} contentContainerStyle={{ padding: 10, paddingBottom: 100 }} showsVerticalScrollIndicator={false} />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedItem ? 'ویرایش اطلاعات' : 'افزودن مورد جدید'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}><Feather name="x" size={20} color="#64748b" /></TouchableOpacity>
                        </View>
                        <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 50 }}>
                            <Text style={styles.inputLabel}>عنوان:</Text>
                            <TextInput style={styles.inputSlim} value={itemName} onChangeText={setItemName} textAlign="right" />
                            <Text style={styles.inputLabel}>نامک (انگلیسی):</Text>
                            <TextInput style={styles.inputSlim} value={itemSlug} onChangeText={setItemSlug} textAlign="left" />

                            {activeTab !== 'product_attr' && (
                                <>
                                    <Text style={styles.inputLabel}>توضیحات (دیداری):</Text>
                                    <RichEditorToolbar content={itemDesc} onChange={setItemDesc} siteUrl={siteUrl} />
                                    
                                    {/* 🚀 آکاردئون سبز رنگ سئو */}
                                    <View style={styles.seoBox}>
                                        <TouchableOpacity style={styles.seoHeader} onPress={() => setIsSeoOpen(!isSeoOpen)} activeOpacity={0.7}>
                                            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                                                <Feather name="target" size={16} color="#16a34a" />
                                                <Text style={styles.seoHeaderTxt}>تنظیمات سئو (SEO)</Text>
                                            </View>
                                            <Feather name={isSeoOpen ? "chevron-up" : "chevron-down"} size={18} color="#16a34a" />
                                        </TouchableOpacity>

                                        {isSeoOpen && (
                                            <View style={styles.seoBody}>
                                                <Text style={styles.inputLabel}>کلمه کلیدی کانونی:</Text>
                                                <TextInput style={styles.inputSlim} value={seoKeyword} onChangeText={setSeoKeyword} textAlign="right" onFocus={scrollToInput} />
                                                <Text style={styles.inputLabel}>عنوان سئو (متا تایتل):</Text>
                                                <TextInput style={styles.inputSlim} value={seoTitle} onChangeText={setSeoTitle} textAlign="right" onFocus={scrollToInput} />
                                                <Text style={styles.inputLabel}>توضیحات متا (گوگل):</Text>
                                                <TextInput style={[styles.inputSlim, { height: 60, textAlignVertical: 'top' }]} value={seoDesc} onChangeText={setSeoDesc} textAlign="right" multiline onFocus={scrollToInput} />
                                            </View>
                                        )}
                                    </View>
                                </>
                            )}
                            <TouchableOpacity style={styles.saveBtn} onPress={saveItem} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnTxt}>ذخیره اطلاعات</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={termsModalVisible} animationType="fade" transparent onRequestClose={() => setTermsModalVisible(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>ایجاد تنوع برای: {selectedAttribute?.name}</Text>
                            <TouchableOpacity onPress={() => setTermsModalVisible(false)}><Feather name="x" size={20} color="#64748b" /></TouchableOpacity>
                        </View>
                        
                        <View style={{ flexDirection: 'row-reverse', marginBottom: 15, gap: 6 }}>
                            <TextInput style={[styles.inputSlim, { flex: 1 }]} placeholder="عنوان تنوع (مثل: آبی)" value={newTermName} onChangeText={setNewTermName} textAlign="right" />
                            <TextInput style={[styles.inputSlim, { flex: 1 }]} placeholder="نامک (مثل: blue)" value={newTermSlug} onChangeText={setNewTermSlug} textAlign="left" />
                            <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 8 }} onPress={addTerm}>
                                <Feather name="plus" size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {termsLoading ? <ActivityIndicator size="small" color="#8b5cf6" /> : (
                            <ScrollView style={{ maxHeight: 300 }}>
                                {attributeTerms.map(term => (
                                    <View key={term.id} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                        <View>
                                            <Text style={{ fontSize: 12, color: '#334155', fontWeight: 'bold' }}>{term.name}</Text>
                                            <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>نامک: {term.slug}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => deleteTerm(term.id)}><Feather name="trash-2" size={14} color="#ef4444" /></TouchableOpacity>
                                    </View>
                                ))}
                                {attributeTerms.length === 0 && <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 11, marginTop: 20 }}>تنوعی ثبت نشده است.</Text>}
                            </ScrollView>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

export default TaxonomyScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, elevation: 1 },
    title: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
    addBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#8b5cf6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    addBtnTxt: { fontSize: 10, fontWeight: 'bold', color: '#fff', marginRight: 4 },
    mainToggleBox: { flexDirection: 'row-reverse', backgroundColor: '#f1f5f9', padding: 6, margin: 10, borderRadius: 10 },
    mainToggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    mainToggleActive: { backgroundColor: '#fff', elevation: 1 },
    mainToggleTxt: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    mainToggleTxtActive: { color: '#8b5cf6', fontWeight: '900' },
    tabScroll: { paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row-reverse', gap: 6 },
    tabBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    tabBtnActive: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
    tabTxt: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    tabTxtActive: { color: '#8b5cf6', fontWeight: '900' },
    searchBox: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 10, marginBottom: 10, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, paddingVertical: 6, fontSize: 11, color: '#0f172a' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyTxt: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold' },
    card: { flexDirection: 'row-reverse', backgroundColor: '#fff', padding: 10, borderRadius: 10, marginHorizontal: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    itemName: { fontSize: 12, fontWeight: '900', color: '#1e293b', textAlign: 'right' },
    itemSlug: { fontSize: 9, color: '#64748b', textAlign: 'right', marginTop: 2 },
    countBadge: { alignSelf: 'flex-end', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 6 },
    countTxt: { fontSize: 8, fontWeight: 'bold', color: '#475569' },
    actionCol: { flexDirection: 'column', marginRight: 15 },
    editBtn: { backgroundColor: '#eff6ff', padding: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    deleteBtn: { backgroundColor: '#fef2f2', padding: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '92%' },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 13, fontWeight: '900', color: '#0f172a' },
    inputLabel: { fontSize: 10, fontWeight: 'bold', color: '#334155', textAlign: 'right', marginBottom: 4, marginTop: 8 },
    inputSlim: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 11, color: '#0f172a' },
    
    // 🚀 استایل‌های آکاردئون سبز رنگ سئو
    seoBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, marginTop: 15, overflow: 'hidden' },
    seoHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#dcfce7' },
    seoHeaderTxt: { fontSize: 12, fontWeight: '900', color: '#16a34a', marginRight: 6 },
    seoBody: { padding: 12, borderTopWidth: 1, borderTopColor: '#bbf7d0', backgroundColor: '#f0fdf4' },

    saveBtn: { backgroundColor: '#8b5cf6', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
    saveBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
});