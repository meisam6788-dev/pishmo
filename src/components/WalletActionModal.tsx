import React, { useState } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createWooClient } from '../api/client';
import { useAppConfig } from '../store/appConfigStore';

interface WalletActionModalProps {
    visible: boolean;
    onClose: () => void;
    customer?: any | null;       // برای زمانی که روی کارت یک نفر کلیک می‌شود
    selectedIds?: number[];      // برای زمانی که گروهی از افراد انتخاب شده‌اند
    onSuccess: () => void;
}

export const WalletActionModal: React.FC<WalletActionModalProps> = ({ visible, onClose, customer, selectedIds, onSuccess }) => {
    const isDark = useAppConfig(state => state.isDarkMode);
    const theme = {
        card: isDark ? '#1e293b' : '#ffffff',
        text: isDark ? '#f8fafc' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        input: isDark ? '#334155' : '#f1f5f9',
    };

    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [actionType, setActionType] = useState<'credit' | 'debit'>('credit');
    const [loading, setLoading] = useState(false);

    const isBulk = selectedIds && selectedIds.length > 0;

    if (!customer && !isBulk) return null;

    const handleTransaction = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert('خطا', 'لطفاً مبلغ معتبری را وارد کنید.');
            return;
        }

        setLoading(true);
        try {
            const client = createWooClient();
            
            // ارسال به وردپرس (وردپرس باید بررسی کند اگر customer_ids بود، برای همه اعمال کند)
            await client.post('pishmo/v1/wallet/transaction', {
                customer_id: isBulk ? null : customer.id,
                customer_ids: isBulk ? selectedIds : null,
                amount: amount,
                type: actionType, // 'credit' برای واریز، 'debit' برای کسر
                note: note || (actionType === 'credit' ? 'شارژ دستی کیف پول' : 'کسر دستی از کیف پول')
            });

            Alert.alert('عملیات موفق 🎉', `تراکنش با موفقیت برای ${isBulk ? selectedIds.length + ' کاربر' : 'مشتری'} ثبت شد.`);
            
            setAmount('');
            setNote('');
            setActionType('credit');
            
            onSuccess();
            onClose();
        } catch (error: any) {
            Alert.alert('خطای اتصال', 'ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
                <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
                    
                    <View style={[styles.header, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>مدیریت کیف پول</Text>
                        <TouchableOpacity onPress={onClose} disabled={loading}>
                            <Feather name="x" size={24} color={theme.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.customerInfo, { color: theme.text }]}>
                        مخاطب تراکنش: {isBulk ? `${selectedIds.length} کاربر انتخاب شده` : `${customer?.first_name || ''} ${customer?.last_name || ''}`}
                    </Text>

                    <View style={[styles.toggleContainer, { backgroundColor: theme.input, borderColor: theme.border }]}>
                        <TouchableOpacity style={[styles.toggleBtn, actionType === 'credit' && { backgroundColor: '#10b981' }]} onPress={() => setActionType('credit')}>
                            <Text style={[styles.toggleTxt, actionType === 'credit' && { color: '#fff' }]}>واریز (شارژ)</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={[styles.toggleBtn, actionType === 'debit' && { backgroundColor: '#ef4444' }]} onPress={() => setActionType('debit')}>
                            <Text style={[styles.toggleTxt, actionType === 'debit' && { color: '#fff' }]}>برداشت (کسر)</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.label, { color: theme.text }]}>مبلغ (تومان):</Text>
                    <TextInput style={[styles.input, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} placeholder="مثال: 50000" placeholderTextColor={theme.textMuted} keyboardType="numeric" value={amount} onChangeText={setAmount} />

                    <Text style={[styles.label, { color: theme.text }]}>یادداشت تراکنش (اختیاری):</Text>
                    <TextInput style={[styles.input, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border, height: 80, textAlignVertical: 'top' }]} placeholder="مثلاً: هدیه تولد مشتری..." placeholderTextColor={theme.textMuted} multiline value={note} onChangeText={setNote} />

                    <TouchableOpacity style={[styles.submitBtn, { backgroundColor: actionType === 'credit' ? '#10b981' : '#ef4444' }]} onPress={handleTransaction} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnTxt}>{isBulk ? 'ثبت تراکنش گروهی' : 'ثبت تراکنش'}</Text>}
                    </TouchableOpacity>

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 20 },
    modalContainer: { borderRadius: 20, padding: 20, elevation: 5 },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, marginBottom: 15 },
    headerTitle: { fontSize: 16, fontWeight: '900' },
    customerInfo: { fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 15, color: '#3b82f6' },
    toggleContainer: { flexDirection: 'row-reverse', borderRadius: 10, borderWidth: 1, padding: 4, marginBottom: 15 },
    toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    toggleTxt: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
    label: { fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 13, fontWeight: 'bold', marginBottom: 15, textAlign: 'right' },
    submitBtn: { paddingVertical: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    submitBtnTxt: { color: '#ffffff', fontWeight: '900', fontSize: 14 },
});