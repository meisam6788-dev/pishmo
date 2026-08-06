import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Alert, StatusBar, RefreshControl, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { createWooClient } from '../api/client';

export const CouponsScreen: React.FC = () => {
    const [coupons, setCoupons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [showAddModal, setShowAddModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCouponId, setEditingCouponId] = useState<number | null>(null);

    const [couponCode, setCouponCode] = useState('');
    const [couponAmount, setCouponAmount] = useState('');
    const [maxDiscount, setMaxDiscount] = useState('');
    const [discountType, setDiscountType] = useState<'percent' | 'fixed_cart'>('percent');

    const fetchCoupons = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const client = createWooClient();
            const response = await client.get('coupons', { params: { per_page: 50 } });
            setCoupons(response.data || []);
        } catch (error) {
            console.log('Error fetching coupons:', error);
            Alert.alert('خطا', 'دریافت لیست کدهای تخفیف با مشکل مواجه شد.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchCoupons();
    }, [fetchCoupons]);

    const handleCopyCode = async (code: string) => {
        await Clipboard.setStringAsync(code);
        Alert.alert('کپی شد', `کد تخفیف "${code}" در حافظه کپی شد.`);
    };

    const openEditModal = (coupon: any) => {
        setEditingCouponId(coupon.id);
        setCouponCode(coupon.code);
        setCouponAmount(parseFloat(coupon.amount || '0').toString());
        setDiscountType(coupon.discount_type === 'fixed_cart' ? 'fixed_cart' : 'percent');
        setMaxDiscount(coupon.maximum_amount ? parseFloat(coupon.maximum_amount).toString() : '');
        setShowAddModal(true);
    };

    const handleSubmitCoupon = async () => {
        if (!couponCode.trim() || !couponAmount.trim()) {
            Alert.alert('خطا', 'لطفاً کد تخفیف و مبلغ/درصد آن را وارد کنید.');
            return;
        }

        setIsSubmitting(true);
        try {
            const client = createWooClient();
            const payload: any = {
                code: couponCode.trim().toUpperCase(),
                amount: couponAmount.trim(),
                discount_type: discountType,
            };

            if (discountType === 'percent') {
                payload.maximum_amount = maxDiscount.trim() ? maxDiscount.trim() : '';
            } else {
                payload.maximum_amount = '';
            }

            if (editingCouponId) {
                await client.put(`coupons/${editingCouponId}`, payload);
                Alert.alert('موفق', 'تغییرات کد تخفیف با موفقیت ذخیره شد.');
            } else {
                await client.post('coupons', payload);
                Alert.alert('موفق', 'کد تخفیف با موفقیت ایجاد شد.');
            }

            setShowAddModal(false);
            setEditingCouponId(null);
            setCouponCode(''); setCouponAmount(''); setMaxDiscount('');
            fetchCoupons(true);
        } catch (error) {
            Alert.alert('خطا', 'عملیات با شکست مواجه شد. (ممکن است این کد از قبل وجود داشته باشد).');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCoupon = async (id: number, code: string) => {
        Alert.alert(
            'تایید حذف',
            `آیا از حذف کد تخفیف "${code}" مطمئن هستید؟`,
            [
                { text: 'انصراف', style: 'cancel' },
                {
                    text: 'حذف کن',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const client = createWooClient();
                            await client.delete(`coupons/${id}`, { params: { force: true } });
                            fetchCoupons(true);
                        } catch (error) {
                            Alert.alert('خطا', 'حذف کد تخفیف با مشکل مواجه شد.');
                        }
                    }
                }
            ]
        );
    };

    const formatCouponAmount = (amount: string, type: string) => {
        const num = parseFloat(amount || '0');
        if (type === 'percent') return num.toString();
        return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const renderCouponType = (type: string) => {
        if (type === 'percent') return 'درصدی (%)';
        if (type === 'fixed_cart') return 'مبلغ ثابت (تومان)';
        if (type === 'fixed_product') return 'ثابت برای محصول';
        return type;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>کدهای تخفیف</Text>
                    <Text style={styles.headerSubtitle}>مدیریت کمپین‌ها، کوپن‌ها و سقف تخفیف</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => {
                    setEditingCouponId(null);
                    setCouponCode(''); setCouponAmount(''); setMaxDiscount(''); setDiscountType('percent');
                    setShowAddModal(true);
                }}>
                    <Feather name="plus" size={20} color="#fff" />
                    <Text style={styles.addBtnTxt}>کد جدید</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerContainer}><ActivityIndicator size="large" color="#10b981" /></View>
            ) : coupons.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Feather name="tag" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyTxt}>هیچ کد تخفیفی یافت نشد.</Text>
                </View>
            ) : (
                <FlatList
                    data={coupons}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCoupons(true)} colors={['#10b981']} />}
                    renderItem={({ item }) => (
                        <View style={styles.couponCard}>
                            <View style={styles.couponInfo}>
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.couponType}>{renderCouponType(item.discount_type)}</Text>
                                    <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                                        <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionIcon}>
                                            <Feather name="edit-2" size={16} color="#3b82f6" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDeleteCoupon(item.id, item.code)} style={styles.actionIcon}>
                                            <Feather name="trash-2" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <Text style={styles.couponAmount}>
                                    {formatCouponAmount(item.amount, item.discount_type)} {item.discount_type === 'percent' ? '%' : 'تومان'}
                                </Text>

                                {item.maximum_amount ? (
                                    <Text style={styles.maxLimitTxt}>تا سقف {formatCouponAmount(item.maximum_amount, 'fixed')} تومان</Text>
                                ) : null}

                                <View style={styles.usageBox}>
                                    <Feather name="users" size={12} color="#64748b" />
                                    <Text style={styles.usageTxt}>استفاده شده: {item.usage_count || 0} بار</Text>
                                </View>
                            </View>

                            <View style={styles.dashedLine} />

                            <TouchableOpacity style={styles.couponCodeBox} onPress={() => handleCopyCode(item.code)}>
                                <Text style={styles.couponCode} numberOfLines={1}>{item.code}</Text>
                                <View style={styles.copyBadge}>
                                    <Feather name="copy" size={12} color="#3b82f6" />
                                    <Text style={styles.copyBadgeTxt}>کپی</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}

            <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.addModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingCouponId ? 'ویرایش کد تخفیف' : 'ساخت کد تخفیف جدید'}</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}><Feather name="x" size={24} color="#64748b" /></TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>متن کد تخفیف (انگلیسی)</Text>
                                <TextInput
                                    style={[styles.input, { textAlign: 'left', fontWeight: '900', color: '#3b82f6' }]}
                                    placeholder="مثال: SUMMER99"
                                    placeholderTextColor="#94a3b8"
                                    value={couponCode}
                                    onChangeText={setCouponCode}
                                    autoCapitalize="characters"
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>نوع تخفیف</Text>
                                <View style={styles.typeSelector}>
                                    <TouchableOpacity style={[styles.typeBtn, discountType === 'percent' && styles.typeBtnActive]} onPress={() => setDiscountType('percent')}>
                                        <Text style={[styles.typeBtnTxt, discountType === 'percent' && styles.typeBtnTxtActive]}>درصدی (%)</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.typeBtn, discountType === 'fixed_cart' && styles.typeBtnActive]} onPress={() => setDiscountType('fixed_cart')}>
                                        <Text style={[styles.typeBtnTxt, discountType === 'fixed_cart' && styles.typeBtnTxtActive]}>مبلغ ثابت</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>
                                    {discountType === 'percent' ? 'درصد تخفیف (مثال: 20 برای ۲۰٪)' : 'مبلغ تخفیف به تومان (مثال: 50000)'}
                                </Text>
                                <TextInput style={[styles.input, { textAlign: 'left' }]} placeholder="0" placeholderTextColor="#94a3b8" value={couponAmount} onChangeText={setCouponAmount} keyboardType="numeric" />
                            </View>

                            {discountType === 'percent' && (
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>سقف مبلغ تخفیف (به تومان - اختیاری)</Text>
                                    <TextInput style={[styles.input, { textAlign: 'left' }]} placeholder="مثال: 100000 (حداکثر ۱۰۰ هزار تومان)" placeholderTextColor="#94a3b8" value={maxDiscount} onChangeText={setMaxDiscount} keyboardType="numeric" />
                                    <Text style={styles.hintTxt}>در صورت خالی گذاشتن، تخفیف درصدی بدون محدودیت مبلغ اعمال می‌شود.</Text>
                                </View>
                            )}

                            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitCoupon} disabled={isSubmitting}>
                                {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnTxt}>{editingCouponId ? 'ثبت تغییرات' : 'ایجاد کد تخفیف'}</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', paddingTop: 20, paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 'bold', textAlign: 'right' },
    addBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    addBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginRight: 6 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyTxt: { marginTop: 12, fontSize: 14, color: '#94a3b8', fontWeight: 'bold' },
    listContainer: { padding: 16, paddingBottom: 80 },
    couponCard: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', borderRadius: 16, marginBottom: 15, elevation: 2, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
    couponInfo: { flex: 2, padding: 16, justifyContent: 'center' },
    couponType: { fontSize: 11, color: '#64748b', fontWeight: 'bold', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-end' },
    actionIcon: { padding: 4, backgroundColor: '#f8fafc', borderRadius: 6 },
    couponAmount: { fontSize: 22, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginTop: 10, marginBottom: 4 },
    maxLimitTxt: { fontSize: 11, color: '#e11d48', fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
    usageBox: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 },
    usageTxt: { fontSize: 11, color: '#64748b', fontWeight: 'bold', marginRight: 4 },
    dashedLine: { width: 1, borderStyle: 'dashed', borderColor: '#cbd5e1', borderWidth: 1, marginVertical: 10 },
    couponCodeBox: { flex: 1, backgroundColor: '#eff6ff', padding: 16, justifyContent: 'center', alignItems: 'center' },
    couponCode: { fontSize: 16, fontWeight: '900', color: '#3b82f6', marginBottom: 8, textAlign: 'center' },
    copyBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    copyBadgeTxt: { fontSize: 10, color: '#3b82f6', fontWeight: 'bold', marginRight: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    addModal: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
    formGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, textAlign: 'right' },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a' },
    hintTxt: { fontSize: 11, color: '#64748b', marginTop: 6, textAlign: 'right', lineHeight: 18 },
    typeSelector: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    typeBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, alignItems: 'center', marginHorizontal: 4 },
    typeBtnActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
    typeBtnTxt: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    typeBtnTxtActive: { color: '#3b82f6', fontWeight: '900' },
    submitBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 20 },
    submitBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
});