import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { WooProduct } from '../types/woo';
import { Feather } from '@expo/vector-icons';

interface ProductCardProps {
    product: WooProduct;
    onQuickEdit: (product: WooProduct) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onQuickEdit }) => {
    const imageUrl = product.images && product.images.length > 0 ? product.images[0].src : null;
    const isVariable = product.type === 'variable';

    // بررسی دقیق وضعیت موجودی بر اساس نوع محصول و پاسخ ووکامرس
    const inStock = product.stock_status === 'instock' || (product.stock_quantity !== null && product.stock_quantity > 0);

    return (
        <View
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
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>

                {/* تصویر، نام کالا و نوع آن */}
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }}>
                    {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={{ width: 56, height: 56, borderRadius: 14, marginLeft: 12, backgroundColor: '#f8fafc' }} />
                    ) : (
                        <View style={{ width: 56, height: 56, borderRadius: 14, marginLeft: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="box" size={24} color="#94a3b8" />
                        </View>
                    )}

                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#0f172a', textAlign: 'right', flexShrink: 1 }} numberOfLines={1}>
                                {product.name || 'محصول بدون نام'}
                            </Text>
                            {isVariable && (
                                <View style={{ backgroundColor: '#f3e8ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginRight: 6 }}>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#6b21a8' }}>متغیر</Text>
                                </View>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: inStock ? '#10b981' : '#ef4444', marginLeft: 6 }} />
                            <Text style={{ fontSize: 12, color: '#64748b' }}>
                                {product.manage_stock && product.stock_quantity !== null
                                    ? `موجودی: ${product.stock_quantity} عدد`
                                    : (inStock ? 'موجود در انبار' : 'ناموجود (تمام شده)')}
                            </Text>
                        </View>
                    </View>
                </View>

            </View>

            {/* خط جداکننده، بخش قیمت و دکمه ویرایش */}
            <View style={{ borderTopWidth: 1, borderTopColor: '#f8fafc', marginTop: 12, paddingTop: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#96588a' }}>
                        {product.price ? Number(product.price).toLocaleString('fa-IR') : '۰'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginRight: 4 }}> تومان</Text>
                </View>

                <TouchableOpacity
                    onPress={() => onQuickEdit(product)}
                    style={{
                        backgroundColor: '#f8fafc',
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 12,
                        flexDirection: 'row-reverse',
                        alignItems: 'center'
                    }}
                >
                    <Feather name="edit-2" size={14} color="#475569" style={{ marginLeft: 6 }} />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155' }}>
                        {isVariable ? 'مشاهده وضعیت' : 'ویرایش سریع'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};