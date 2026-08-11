import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
    TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, FlatList, Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createWooClient } from '../api/client';
import { useAppConfig } from '../store/appConfigStore';

interface CustomerProfileModalProps {
    visible: boolean;
    onClose: () => void;
    customer: any | null;
    onOpenWallet: (customer: any) => void;
    initialTab?: 'overview' | 'orders' | 'notes';
}

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({ visible, onClose, customer, onOpenWallet, initialTab = 'overview' }) => {
    const isDark = useAppConfig(state => state.isDarkMode);
    const theme = {
        bg: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : '#ffffff',
        text: isDark ? '#f8fafc' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        input: isDark ? '#334155' : '#f1f5f9',
        primary: '#3b82f6',
    };

    const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'notes'>(initialTab);
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [notesList, setNotesList] = useState<any[]>([]);
    const [newNote, setNewNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    useEffect(() => {
        if (visible && customer) {
            setActiveTab(initialTab);
            fetchCustomerDetails();
        }
    }, [visible, customer, initialTab]);

    const fetchCustomerDetails = async () => {
        setLoading(true);
        try {
            const client = createWooClient();
            const response = await client.get(`pishmo/v1/crm/customer/${customer.id}`);
            if (response.data) {
                setOrders(response.data.orders || []);
                setNotesList(response.data.notes || []);
            }
        } catch (error) {
            console.log('Error fetching CRM profile');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveNote = async () => {
        if (!newNote.trim()) return;
        setSavingNote(true);
        try {
            const client = createWooClient();
            const response = await client.post(`pishmo/v1/crm/customer/${customer.id}/note`, { note: newNote });
            if (response.data?.success) {
                setNotesList([response.data.new_note, ...notesList]);
                setNewNote('');
            }
        } catch (error) {
            Alert.alert('خطا', 'مشکلی در ذخیره یادداشت پیش آمد.');
        } finally {
            setSavingNote(false);
        }
    };

    const formatPrice = (price: number | string) => {
        const num = typeof price === 'string' ? parseFloat(price) : price;
        return isNaN(num) ? '۰' : Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const renderOrderItem = ({ item }: { item: any }) => (
        <View style={[styles.orderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.orderHeader, { borderBottomColor: theme.border }]}>
                <View style={[styles.orderStatus, { backgroundColor: item.status === 'completed' ? '#dcfce7' : theme.input }]}>
                    <Text style={{ color: item.status === 'completed' ? '#16a34a' : theme.textMuted, fontSize: 10, fontWeight: 'bold' }}>{item.status_name}</Text>
                </View>
                <Text style={[styles.orderId, { color: theme.text }]}>سفارش #{item.id}</Text>
            </View>
            <View style={styles.orderBody}>
                <View>
                    <Text style={[styles.orderDate, { color: theme.textMuted }]}>{item.date}</Text>
                    <Text style={[styles.orderPrice, { color: theme.text }]}>{formatPrice(item.total)} تومان</Text>
                </View>
            </View>
            
            {/* لیست محصولات به همراه قیمت هر کدام */}
            <View style={{ marginTop: 15, borderTopWidth: 1, borderTopColor: theme.input }}>
                {Array.isArray(item.items) && item.items.map((prod: any, index: number) => (
                    <View key={index} style={[styles.productRow, { borderBottomColor: theme.bg, borderBottomWidth: index === item.items.length - 1 ? 0 : 1 }]}>
                        {prod.image ? (
                            <Image source={{ uri: prod.image }} style={[styles.productImg, { borderColor: theme.border }]} />
                        ) : (
                            <View style={[styles.productImgPlaceholder, { backgroundColor: theme.input }]}><Feather name="image" size={16} color={theme.textMuted} /></View>
                        )}
                        <View style={styles.productDetails}>
                            <Text style={[styles.prodName, { color: theme.text }]} numberOfLines={2}>{prod.name}</Text>
                            {prod.attributes ? <Text style={[styles.prodAttr, { color: theme.textMuted }]}>{prod.attributes}</Text> : null}
                            
                            {/* ردیف تعداد و قیمت */}
                            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                <Text style={[styles.prodQty, { color: theme.primary }]}>{prod.qty} عدد</Text>
                                {prod.price !== undefined && (
                                    <Text style={{ fontSize: 12, fontWeight: '900', color: theme.text }}>
                                        {formatPrice(prod.price)} <Text style={{ fontSize: 9, color: theme.textMuted, fontWeight: 'normal' }}>تومان</Text>
                                    </Text>
                                )}
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );

    if (!customer) return null;
    const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.username || 'بدون نام';

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.bg }]}>
                    
                    <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Feather name="chevron-down" size={28} color={theme.textMuted} /></TouchableOpacity>
                        <View style={styles.headerProfile}>
                            <View style={[styles.avatar, { backgroundColor: customer.badgeBg }]}><Text style={[styles.avatarTxt, { color: customer.badgeColor }]}>{fullName.substring(0, 1)}</Text></View>
                            <Text style={[styles.name, { color: theme.text }]}>{fullName}</Text>
                        </View>
                    </View>

                    <View style={[styles.tabs, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'notes' && styles.tabBtnActive, { borderColor: theme.primary }]} onPress={() => setActiveTab('notes')}>
                            <Feather name="file-text" size={16} color={activeTab === 'notes' ? theme.primary : theme.textMuted} />
                            <Text style={[styles.tabTxt, { color: activeTab === 'notes' ? theme.primary : theme.textMuted }]}>پرونده یادداشت</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'orders' && styles.tabBtnActive, { borderColor: theme.primary }]} onPress={() => setActiveTab('orders')}>
                            <Feather name="shopping-bag" size={16} color={activeTab === 'orders' ? theme.primary : theme.textMuted} />
                            <Text style={[styles.tabTxt, { color: activeTab === 'orders' ? theme.primary : theme.textMuted }]}>تاریخچه خرید</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive, { borderColor: theme.primary }]} onPress={() => setActiveTab('overview')}>
                            <Feather name="user" size={16} color={activeTab === 'overview' ? theme.primary : theme.textMuted} />
                            <Text style={[styles.tabTxt, { color: activeTab === 'overview' ? theme.primary : theme.textMuted }]}>خلاصه وضعیت</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {loading ? (
                            <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
                        ) : (
                            <>
                                {activeTab === 'overview' && (
                                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
                                        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                            <View style={[styles.infoRow, { borderBottomColor: theme.border }]}><Text style={[styles.infoVal, { color: theme.text }]}>{customer.phone || 'ثبت نشده'}</Text><Text style={[styles.infoLabel, { color: theme.textMuted }]}>موبایل</Text></View>
                                            <View style={[styles.infoRow, { borderBottomColor: theme.border }]}><Text style={[styles.infoVal, { color: theme.text }]}>{customer.date_created_shamsi || 'نامشخص'}</Text><Text style={[styles.infoLabel, { color: theme.textMuted }]}>عضویت</Text></View>
                                            <View style={styles.infoRow}><Text style={[styles.infoVal, { color: theme.text }]}>{customer.date_last_order_shamsi || 'نامشخص'}</Text><Text style={[styles.infoLabel, { color: theme.textMuted }]}>آخرین خرید</Text></View>
                                        </View>
                                        <View style={[styles.statsGrid]}>
                                            <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.statVal, { color: theme.text }]}>{customer.ordersCount}</Text><Text style={[styles.statLabel, { color: theme.textMuted }]}>سفارش</Text></View>
                                            <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.statVal, { color: theme.text }]}>{formatPrice(customer.totalSpent)}</Text><Text style={[styles.statLabel, { color: theme.textMuted }]}>ارزش (تومان)</Text></View>
                                        </View>
                                    </ScrollView>
                                )}

                                {activeTab === 'orders' && (
                                    orders.length === 0 ? (
                                        <View style={styles.center}><Feather name="shopping-bag" size={40} color={theme.border} /><Text style={{ color: theme.textMuted, marginTop: 15, fontWeight: 'bold' }}>سفارشی یافت نشد.</Text></View>
                                    ) : (
                                        <FlatList data={orders} keyExtractor={item => item.id.toString()} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} renderItem={renderOrderItem} />
                                    )
                                )}

                                {activeTab === 'notes' && (
                                    <View style={{ flex: 1 }}>
                                        <View style={[styles.addNoteBox, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                                            <View style={styles.noteInputRow}>
                                                <TouchableOpacity style={[styles.saveNoteBtn, { backgroundColor: theme.primary }]} onPress={handleSaveNote} disabled={savingNote}>
                                                    {savingNote ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
                                                </TouchableOpacity>
                                                <TextInput style={[styles.noteInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="یادداشت جدید..." placeholderTextColor={theme.textMuted} value={newNote} onChangeText={setNewNote} multiline />
                                            </View>
                                        </View>
                                        
                                        <FlatList
                                            data={notesList}
                                            keyExtractor={item => item.id.toString()}
                                            contentContainerStyle={{ padding: 16 }}
                                            renderItem={({ item }) => (
                                                <View style={styles.timelineRow}>
                                                    <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                                                    <View style={[styles.timelineContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                                        <Text style={[styles.timelineDate, { color: theme.textMuted }]}>{item.date}</Text>
                                                        <Text style={[styles.timelineText, { color: theme.text }]}>{item.text}</Text>
                                                    </View>
                                                </View>
                                            )}
                                            ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 40 }}><Text style={{ color: theme.textMuted }}>هنوز یادداشتی ثبت نشده است.</Text></View>}
                                        />
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { height: '92%', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', elevation: 20 },
    header: { alignItems: 'center', paddingTop: 10, paddingBottom: 15, borderBottomWidth: 1 },
    closeBtn: { width: 50, height: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
    headerProfile: { alignItems: 'center' },
    avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: '#fff' },
    avatarTxt: { fontSize: 24, fontWeight: '900' },
    name: { fontSize: 16, fontWeight: '900' },
    tabs: { flexDirection: 'row-reverse', borderBottomWidth: 1 },
    tabBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderBottomWidth: 2, borderColor: 'transparent', gap: 6 },
    tabBtnActive: {},
    tabTxt: { fontSize: 12, fontWeight: 'bold' },
    content: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    infoCard: { borderRadius: 16, padding: 15, borderWidth: 1, marginBottom: 15 },
    infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 12, fontWeight: 'bold' },
    infoVal: { fontSize: 13, fontWeight: '900' },
    statsGrid: { flexDirection: 'row-reverse', gap: 15 },
    statBox: { flex: 1, borderRadius: 16, padding: 20, borderWidth: 1, alignItems: 'center' },
    statVal: { fontSize: 16, fontWeight: '900', marginTop: 10, marginBottom: 5 },
    statLabel: { fontSize: 11, fontWeight: 'bold' },
    orderCard: { borderRadius: 12, padding: 15, borderWidth: 1, marginBottom: 12 },
    orderHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, marginBottom: 10 },
    orderId: { fontSize: 13, fontWeight: '900' },
    orderStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    orderBody: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    orderPrice: { fontSize: 14, fontWeight: '900', marginTop: 4 },
    orderDate: { fontSize: 11 },

    productRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12 },
    productImg: { width: 50, height: 50, borderRadius: 8, borderWidth: 1, marginLeft: 12 },
    productImgPlaceholder: { width: 50, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
    productDetails: { flex: 1, alignItems: 'flex-end' },
    prodName: { fontSize: 12, fontWeight: 'bold', textAlign: 'right', lineHeight: 18 },
    prodAttr: { fontSize: 10, marginTop: 4, textAlign: 'right' },
    prodQty: { fontSize: 11, fontWeight: '900', marginTop: 0, textAlign: 'right' },
    
    addNoteBox: { padding: 16, borderBottomWidth: 1, elevation: 2 },
    noteInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    noteInput: { flex: 1, minHeight: 46, maxHeight: 100, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, fontSize: 13, textAlign: 'right' },
    saveNoteBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    timelineRow: { flexDirection: 'row-reverse', marginBottom: 15, paddingRight: 10 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', right: -6, top: 20, zIndex: 2, borderWidth: 2, borderColor: '#fff' },
    timelineContent: { flex: 1, borderRadius: 12, padding: 15, borderWidth: 1, borderRightWidth: 4, borderRightColor: '#3b82f6', marginRight: 20 },
    timelineDate: { fontSize: 10, marginBottom: 6, fontWeight: 'bold' },
    timelineText: { fontSize: 13, lineHeight: 22, textAlign: 'right' },
});