import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { WooOrder } from '../types/woo';
import { Feather } from '@expo/vector-icons';

interface OrderCardProps {
    order: WooOrder;
    onPress: (order: WooOrder) => void;
}

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'completed':
            return { label: 'تکمیل شده', bg: '#d1fae5', text: '#065f46' };
        case 'processing':
            return { label: 'در حال پردازش', bg: '#dbeafe', text: '#1e40af' };
        case 'on-hold':
            return { label: 'در انتظار بررسی', bg: '#fef3c7', text: '#92400e' };
        case 'cancelled':
            return { label: 'لغو شده', bg: '#ffe4e6', text: '#9f1239' };
        default:
            return { label: status, bg: '#f1f5f9', text: '#334155' };
    }
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, onPress }) => {
    const badge = getStatusBadge(order.status);
    const fullName = `${order.billing.first_name} ${order.billing.last_name}`.trim() || 'مشتری بدون نام';

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPress(order)}
            style={{
                backgroundColor: '#ffffff',
                padding: 16,
                borderRadius: 20,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#f1f5f9',
                elevation: 2,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
            }}
        >
            {/* سطر اول: شناسه و وضعیت */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginRight: 4 }}>#{order.id}</Text>
                    <Feather name="hash" size={16} color="#64748b" />
                </View>
                <View style={{ backgroundColor: badge.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: badge.text }}>{badge.label}</Text>
                </View>
            </View>

            {/* سطر دوم: نام مشتری و شهر */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>{fullName}</Text>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <Feather name="map-pin" size={14} color="#94a3b8" />
                    <Text style={{ fontSize: 13, color: '#64748b', marginRight: 4 }}>{order.billing.city || 'شهر نامشخص'}</Text>
                </View>
            </View>

            {/* سطر سوم: مبلغ و تعداد کالا */}
            <View style={{ borderTopWidth: 1, borderTopColor: '#f8fafc', paddingTop: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <Feather name="package" size={14} color="#64748b" />
                    <Text style={{ fontSize: 13, color: '#64748b', marginRight: 4 }}>{order.line_items.length} کالا</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#96588a' }}>
                        {Number(order.total).toLocaleString('fa-IR')}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginRight: 4 }}> تومان</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};