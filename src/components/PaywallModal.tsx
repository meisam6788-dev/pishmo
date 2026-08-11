import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface PaywallProps {
    visible: boolean;
    onClose: () => void;
}

export const PaywallModal: React.FC<PaywallProps> = ({ visible, onClose }) => {
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.icon}>💎</Text>
                    <Text style={styles.title}>ارتقا به نسخه PRO</Text>
                    <Text style={styles.description}>
                        این قابلیت مخصوص کاربران نسخه PRO است. برای دسترسی به CRM، پنل پیامک و امکانات پیشرفته، اشتراک خود را ارتقا دهید.
                    </Text>
                    <TouchableOpacity style={styles.btnPrimary}>
                        <Text style={styles.btnText}>خرید اشتراک حرفه‌ای</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
                        <Text style={styles.btnSecondaryText}>شاید بعداً</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    container: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
    icon: { fontSize: 40, marginBottom: 10 },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    description: { textAlign: 'center', color: '#666', marginBottom: 20, lineHeight: 22 },
    btnPrimary: { backgroundColor: '#10b981', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 10 },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    btnSecondary: { padding: 15, width: '100%', alignItems: 'center' },
    btnSecondaryText: { color: '#64748b', fontWeight: 'bold' }
});