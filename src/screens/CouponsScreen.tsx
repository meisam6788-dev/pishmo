import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Alert, StatusBar, RefreshControl, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { createWooClient } from '../api/client';

// توابع مبدل تاریخ میلادی به شمسی و بالعکس
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
    jy += 1595;
    let days = -355668 + (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * Math.floor(days / 146097); days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
    gy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    let gd = days + 1;
    const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm; for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
    return { gy, gm, gd };
};

const formatJalaliDisplay = (dateString?: string) => {
    if (!dateString) return 'بدون انقضا';
    try {
        const [y, m, d] = dateString.split('T')[0].split('-').map(Number);
        if (!y || !m || !d) return 'بدون انقضا';
        const { jy, jm, jd } = gregorianToJalali(y, m, d);
        return `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`;
    } catch { return 'نامشخص'; }
};

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

    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [minAmount, setMinAmount] = useState('');
    const [usageLimit, setUsageLimit] = useState('');
    const [description, setDescription] = useState('');
    
    // استیت‌های مربوط به تاریخ شمسی
    const [expYear, setExpYear] = useState('');
    const [expMonth, setExpMonth] = useState('');
    const [expDay, setExpDay] = useState('');

    const fetchCoupons = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const client = createWooClient();
            const response = await client.get('coupons', { params: { per_page: 50 } });
            setCoupons(response.data || []);
        } catch (error) {
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
        Alert.alert('کپی شد', `کد تخفیف "${code}" کپی شد.`);
    };

    const openEditModal = (coupon: any) => {
        setEditingCouponId(coupon.id);
        setCouponCode(coupon.code);
        setCouponAmount(parseFloat(coupon.amount || '0').toString());
        setDiscountType(coupon.discount_type === 'fixed_cart' ? 'fixed_cart' : 'percent');
        setMaxDiscount(coupon.maximum_amount ? parseFloat(coupon.maximum_amount).toString() : '');
        
        setMinAmount(coupon.minimum_amount ? parseFloat(coupon.minimum_amount).toString() : '');
        setUsageLimit(coupon.usage_limit ? coupon.usage_limit.toString() : '');
        setDescription(coupon.description || '');
        
        // استخراج و تبدیل تاریخ میلادی سرور به شمسی برای فرم ویرایش
        if (coupon.date_expires) {
            const [y, m, d] = coupon.date_expires.split('T')[0].split('-').map(Number);
            if (y && m && d) {
                const { jy, jm, jd } = gregorianToJalali(y, m, d);
                setExpYear(jy.toString());
                setExpMonth(jm.toString().padStart(2, '0'));
                setExpDay(jd.toString().padStart(2, '0'));
            }
        } else {
            setExpYear(''); setExpMonth(''); setExpDay('');
        }
        
        setAdvancedOpen(false);
        setShowAddModal(true);
    };

    const resetForm = () => {
        setCouponCode(''); setCouponAmount(''); setMaxDiscount(''); setDiscountType('percent');
        setMinAmount(''); setUsageLimit(''); setExpYear(''); setExpMonth(''); setExpDay(''); setDescription(''); 
        setAdvancedOpen(false);
    };

    const handleSubmitCoupon = async () => {
        if (!couponCode.trim() || !couponAmount.trim()) {
            Alert.alert('خطا', 'لطفاً کد تخفیف و مبلغ/درصد آن را وارد کنید.');
            return;
        }

        // بررسی و تبدیل تاریخ شمسی به میلادی
        let date_expires = '';
        if (expYear || expMonth || expDay) {
            if (!expYear || !expMonth || !expDay) {
                Alert.alert('خطا', 'لطفاً سال، ماه و روز انقضا را کامل وارد کنید یا فیلدها را خالی بگذارید.');
                return;
            }
            const jy = parseInt(expYear, 10); const jm = parseInt(expMonth, 10); const jd = parseInt(expDay, 10);
            if (jy > 1300 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31) {
                const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
                date_expires = `${gy}-${gm.toString().padStart(2, '0')}-${gd.toString().padStart(2, '0')}T00:00:00`;
            } else {
                Alert.alert('خطا', 'تاریخ شمسی وارد شده معتبر نیست.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const client = createWooClient();
            const payload: any = {
                code: couponCode.trim().toUpperCase(),
                amount: couponAmount.trim(),
                discount_type: discountType,
                description: description.trim(),
            };

            if (discountType === 'percent') { payload.maximum_amount = maxDiscount.trim() ? maxDiscount.trim() : ''; } 
            else { payload.maximum_amount = ''; }

            if (minAmount.trim()) payload.minimum_amount = minAmount.trim();
            if (usageLimit.trim()) payload.usage_limit = parseInt(usageLimit.trim(), 10);
            if (date_expires) payload.date_expires = date_expires;

            if (editingCouponId) {
                await client.put(`coupons/${editingCouponId}`, payload);
            } else {
                await client.post('coupons', payload);
            }

            setShowAddModal(false);
            setEditingCouponId(null);
            resetForm();
            fetchCoupons(true);
        } catch (error) {
            Alert.alert('خطا', 'عملیات با شکست مواجه شد. ممکن است این کد از قبل وجود داشته باشد.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCoupon = async (id: number, code: string) => {
        Alert.alert('تایید حذف', `آیا از حذف کد "${code}" مطمئن هستید؟`, [
            { text: 'انصراف', style: 'cancel' },
            {
                text: 'حذف کن', style: 'destructive',
                onPress: async () => {
                    try {
                        const client = createWooClient();
                        await client.delete(`coupons/${id}`, { params: { force: true } });
                        fetchCoupons(true);
                    } catch (error) { Alert.alert('خطا', 'حذف با مشکل مواجه شد.'); }
                }
            }
        ]);
    };

    const formatCouponAmount = (amount: string, type: string) => {
        const num = parseFloat(amount || '0');
        if (type === 'percent') return num.toString();
        return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const renderCouponType = (type: string) => {
        if (type === 'percent') return 'درصدی (%)';
        if (type === 'fixed_cart') return 'مبلغ ثابت (تومان)';
        if (type === 'fixed_product') return 'ثابت محصول';
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
                <TouchableOpacity style={styles.addBtnOnlyIcon} onPress={() => {
                    setEditingCouponId(null);
                    resetForm();
                    setShowAddModal(true);
                }}>
                    <Feather name="plus" size={24} color="#fff" />
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
                                    <Text style={styles.maxLimitTxt}>سقف تخفیف: {formatCouponAmount(item.maximum_amount, 'fixed')} تومان</Text>
                                ) : null}

                                {item.minimum_amount ? (
                                    <Text style={styles.metaLimitTxt}>حداقل خرید: {formatCouponAmount(item.minimum_amount, 'fixed')} تومان</Text>
                                ) : null}

                                <View style={styles.statsWrapper}>
                                    <View style={styles.usageBox}>
                                        <Feather name="pie-chart" size={12} color="#f59e0b" />
                                        <Text style={[styles.usageTxt, { color: '#b45309' }]}>
                                            استفاده: {item.usage_count || 0} از {item.usage_limit || 'بی‌نهایت'}
                                        </Text>
                                    </View>
                                    <View style={[styles.usageBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                                        <Feather name="calendar" size={12} color="#10b981" />
                                        <Text style={[styles.usageTxt, { color: '#047857' }]}>
                                            انقضا: {formatJalaliDisplay(item.date_expires)}
                                        </Text>
                                    </View>
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
                            <TouchableOpacity onPress={() => setShowAddModal(false)}><Feather name="x" size={24} color="#64748b" /></TouchableOpacity>
                            <Text style={styles.modalTitle}>{editingCouponId ? 'ویرایش کد تخفیف' : 'ساخت کد تخفیف جدید'}</Text>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
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
                                    {discountType === 'percent' ? 'درصد تخفیف (مثال: 20)' : 'مبلغ تخفیف به تومان (مثال: 50000)'}
                                </Text>
                                <TextInput style={[styles.input, { textAlign: 'center', fontSize: 16, fontWeight: 'bold' }]} placeholder="0" placeholderTextColor="#94a3b8" value={couponAmount} onChangeText={setCouponAmount} keyboardType="numeric" />
                            </View>

                            {discountType === 'percent' && (
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>سقف مبلغ تخفیف (به تومان - اختیاری)</Text>
                                    <TextInput style={[styles.input, { textAlign: 'center' }]} placeholder="بدون محدودیت" placeholderTextColor="#94a3b8" value={maxDiscount} onChangeText={setMaxDiscount} keyboardType="numeric" />
                                </View>
                            )}

                            <View style={styles.accordionCard}>
                                <TouchableOpacity style={styles.accordionHeader} onPress={() => setAdvancedOpen(!advancedOpen)}>
                                    <Feather name={advancedOpen ? "chevron-up" : "chevron-down"} size={20} color="#475569" />
                                    <Text style={styles.accordionTitle}>تنظیمات پیشرفته و محدودیت‌ها</Text>
                                </TouchableOpacity>
                                
                                {advancedOpen && (
                                    <View style={styles.accordionContent}>
                                        
                                        <View style={styles.formGroup}>
                                            <View style={styles.labelWithIconRow}>
                                                <Text style={[styles.label, { marginBottom: 0 }]}>تاریخ انقضا (شمسی)</Text>
                                                <Feather name="calendar" size={16} color="#64748b" style={{ marginLeft: 6 }} />
                                            </View>
                                            <View style={styles.datePickerRow}>
                                                <TextInput style={[styles.input, styles.dateInput]} placeholder="روز" keyboardType="numeric" maxLength={2} value={expDay} onChangeText={setExpDay} />
                                                <Text style={styles.dateSlash}>/</Text>
                                                <TextInput style={[styles.input, styles.dateInput]} placeholder="ماه" keyboardType="numeric" maxLength={2} value={expMonth} onChangeText={setExpMonth} />
                                                <Text style={styles.dateSlash}>/</Text>
                                                <TextInput style={[styles.input, styles.dateInputYear]} placeholder="سال (1403)" keyboardType="numeric" maxLength={4} value={expYear} onChangeText={setExpYear} />
                                            </View>
                                            <Text style={styles.hintTxt}>در صورت خالی گذاشتن، کد تخفیف منقضی نمی‌شود.</Text>
                                        </View>

                                        <View style={styles.formGroup}>
                                            <Text style={styles.label}>حداقل مبلغ خرید (تومان)</Text>
                                            <TextInput style={[styles.input, { textAlign: 'center' }]} placeholder="مثال: 300000" placeholderTextColor="#94a3b8" value={minAmount} onChangeText={setMinAmount} keyboardType="numeric" />
                                        </View>

                                        <View style={styles.formGroup}>
                                            <Text style={styles.label}>حداکثر تعداد مجاز استفاده</Text>
                                            <TextInput style={[styles.input, { textAlign: 'center' }]} placeholder="مثال: 100 (نفر)" placeholderTextColor="#94a3b8" value={usageLimit} onChangeText={setUsageLimit} keyboardType="numeric" />
                                        </View>

                                        <View style={styles.formGroup}>
                                            <Text style={styles.label}>یادداشت مدیریت (محرمانه)</Text>
                                            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="توضیحاتی برای خودتان..." placeholderTextColor="#94a3b8" value={description} onChangeText={setDescription} multiline />
                                        </View>

                                    </View>
                                )}
                            </View>

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
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', paddingTop: Platform.OS === 'ios' ? 45 : 20, paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 'bold', textAlign: 'right' },
    addBtnOnlyIcon: { width: 42, height: 42, backgroundColor: '#10b981', borderRadius: 10, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyTxt: { marginTop: 12, fontSize: 14, color: '#94a3b8', fontWeight: 'bold' },
    listContainer: { padding: 16, paddingBottom: 80 },
    couponCard: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', borderRadius: 16, marginBottom: 15, elevation: 2, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
    couponInfo: { flex: 2, padding: 16, justifyContent: 'center' },
    couponType: { fontSize: 11, color: '#64748b', fontWeight: 'bold', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-end' },
    actionIcon: { padding: 4, backgroundColor: '#f8fafc', borderRadius: 6 },
    couponAmount: { fontSize: 22, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginTop: 10, marginBottom: 4 },
    maxLimitTxt: { fontSize: 11, color: '#e11d48', fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
    metaLimitTxt: { fontSize: 10, color: '#0f766e', fontWeight: 'bold', textAlign: 'right', marginBottom: 6 },
    
    // استایل‌های جدید برای نمایش تاریخ و تعداد مصرف
    statsWrapper: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    usageBox: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#fde68a' },
    usageTxt: { fontSize: 10, fontWeight: 'bold', marginRight: 4 },
    
    dashedLine: { width: 1, borderStyle: 'dashed', borderColor: '#cbd5e1', borderWidth: 1, marginVertical: 10 },
    couponCodeBox: { flex: 1, backgroundColor: '#eff6ff', padding: 16, justifyContent: 'center', alignItems: 'center' },
    couponCode: { fontSize: 16, fontWeight: '900', color: '#3b82f6', marginBottom: 8, textAlign: 'center' },
    copyBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    copyBadgeTxt: { fontSize: 10, color: '#3b82f6', fontWeight: 'bold', marginRight: 4 },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    addModal: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', textAlign: 'right', flex: 1 },
    formGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, textAlign: 'right' },
    labelWithIconRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 14, color: '#0f172a', textAlign: 'right' },
    hintTxt: { fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'right', lineHeight: 18 },
    
    // استایل‌های تاریخ ساز (سال، ماه، روز)
    datePickerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
    dateInput: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 'bold', paddingVertical: 12 },
    dateInputYear: { flex: 1.5, textAlign: 'center', fontSize: 15, fontWeight: 'bold', paddingVertical: 12 },
    dateSlash: { fontSize: 18, color: '#94a3b8', fontWeight: 'bold' },

    typeSelector: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    typeBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, alignItems: 'center', marginHorizontal: 4 },
    typeBtnActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
    typeBtnTxt: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    typeBtnTxtActive: { color: '#3b82f6', fontWeight: '900' },
    
    accordionCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },
    accordionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#f8fafc' },
    accordionTitle: { fontSize: 13, fontWeight: '900', color: '#334155', textAlign: 'right', flex: 1 },
    accordionContent: { padding: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#ffffff' },

    submitBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 2 },
    submitBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
});