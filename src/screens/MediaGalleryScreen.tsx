import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
    ActivityIndicator, Alert, Dimensions, StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = (width - 24) / COLUMN_COUNT;

export const MediaGalleryScreen: React.FC = () => {
    const [media, setMedia] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // استیت‌های حالت انتخاب و آپلود
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<number[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const authStore = useAuthStore() as any;
    const siteUrl = authStore.siteUrl || authStore.url || '';

    // دریافت لیست تصاویر از وردپرس
    const fetchMedia = useCallback(async (pageNum = 1) => {
        if (pageNum === 1) setLoading(true);
        try {
            const response = await axios.get(`${siteUrl}/wp-json/wp/v2/media`, {
                params: { per_page: 24, page: pageNum, media_type: 'image' }
            });
            const fetchedData = response.data || [];
            if (pageNum === 1) setMedia(fetchedData);
            else setMedia(prev => [...prev, ...fetchedData]);

            setHasMore(fetchedData.length === 24);
        } catch (error) {
            console.log('Media Fetch Error', error);
        } finally {
            setLoading(false);
        }
    }, [siteUrl]);

    useEffect(() => {
        if (siteUrl) fetchMedia(1);
    }, [siteUrl, fetchMedia]);

    const loadMore = () => {
        if (!loading && hasMore) {
            setPage(prev => prev + 1);
            fetchMedia(page + 1);
        }
    };

    // 🚀 انتخاب عکس از گالری گوشی و آپلود در سایت (اخطار زرد رفع شد)
    const pickAndUploadImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images' as any, // جایگزینِ نسخه قدیمی برای رفع وارنینگ
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            uploadImageToWP(asset.uri);
        }
    };

    const uploadImageToWP = async (uri: string) => {
        setIsUploading(true);
        const filename = uri.split('/').pop() || 'upload.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        const formData = new FormData();
        formData.append('file', { uri, name: filename, type } as any);

        try {
            const res = await axios.post(`${siteUrl}/wp-json/pishmo/v1/media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                Alert.alert('موفق', 'تصویر با موفقیت در سایت آپلود شد.');
                setPage(1);
                fetchMedia(1); // بروزرسانی گالری
            } else {
                Alert.alert('خطا', 'آپلود انجام نشد.');
            }
        } catch (error) {
            Alert.alert('خطا', 'مشکلی در اتصال برای آپلود تصویر پیش آمد.');
        } finally {
            setIsUploading(false);
        }
    };

    // مدیریت انتخاب دسته‌جمعی
    const toggleSelectMode = (id: number) => {
        setIsSelectMode(true);
        setSelectedItems([id]);
    };

    const toggleItemSelection = (id: number) => {
        if (selectedItems.includes(id)) {
            const newSelection = selectedItems.filter(itemId => itemId !== id);
            setSelectedItems(newSelection);
            if (newSelection.length === 0) setIsSelectMode(false);
        } else {
            setSelectedItems([...selectedItems, id]);
        }
    };

    // 🚀 حذف گروهی از هاست سایت
    const bulkDelete = () => {
        if (selectedItems.length === 0) return;
        Alert.alert('حذف دائم تصاویر', `آیا از حذف دائم ${selectedItems.length} تصویر از هاست سایت مطمئن هستید؟ (غیرقابل برگشت)`, [
            { text: 'انصراف', style: 'cancel' },
            {
                text: 'حذف کن',
                style: 'destructive',
                onPress: async () => {
                    setIsDeleting(true);
                    try {
                        await axios.delete(`${siteUrl}/wp-json/pishmo/v1/media`, {
                            data: { ids: selectedItems }
                        });
                        setMedia(prev => prev.filter(item => !selectedItems.includes(item.id)));
                        setIsSelectMode(false);
                        setSelectedItems([]);
                        Alert.alert('موفق', 'تصاویر با موفقیت از هاست پاک شدند.');
                    } catch (error) {
                        Alert.alert('خطا', 'مشکلی در حذف تصاویر پیش آمد.');
                    } finally {
                        setIsDeleting(false);
                    }
                }
            }
        ]);
    };

    const renderMediaItem = ({ item }: { item: any }) => {
        const imageUrl = item.media_details?.sizes?.thumbnail?.source_url || item.source_url;
        const isSelected = selectedItems.includes(item.id);

        return (
            <TouchableOpacity
                style={[styles.imageContainer, isSelected && styles.imageContainerSelected]}
                activeOpacity={0.8}
                onLongPress={() => !isSelectMode && toggleSelectMode(item.id)}
                onPress={() => {
                    if (isSelectMode) toggleItemSelection(item.id);
                }}
            >
                <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" />

                {isSelectMode && (
                    <View style={styles.checkboxContainer}>
                        {isSelected && <Feather name="check-circle" size={24} color="#8b5cf6" />}
                        {!isSelected && <Feather name="circle" size={24} color="rgba(255,255,255,0.8)" />}
                    </View>
                )}
                {isSelected && <View style={styles.selectedOverlay} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* هدر هوشمند: تغییر حالت در زمان انتخاب عکس */}
            {isSelectMode ? (
                <View style={[styles.header, { backgroundColor: '#f3e8ff' }]}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => { setIsSelectMode(false); setSelectedItems([]); }}>
                                <Feather name="x" size={24} color="#0f172a" />
                            </TouchableOpacity>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#581c87', marginRight: 15 }}>
                                {selectedItems.length} مورد انتخاب شد
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.deleteBtn} onPress={bulkDelete} disabled={isDeleting}>
                            {isDeleting ? <ActivityIndicator color="#fff" size="small" /> : (
                                <>
                                    <Feather name="trash-2" size={16} color="#ffffff" />
                                    <Text style={styles.deleteBtnTxt}>حذف از هاست</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>رسانه سایت (Media)</Text>
                        <TouchableOpacity style={styles.uploadBtn} onPress={pickAndUploadImage} disabled={isUploading}>
                            {isUploading ? <ActivityIndicator color="#fff" size="small" /> : (
                                <>
                                    <Feather name="plus-square" size={16} color="#ffffff" />
                                    <Text style={styles.uploadBtnTxt}>آپلود عکس جدید</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {loading && page === 1 ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /><Text style={styles.loadingTxt}>در حال دریافت تصاویر...</Text></View>
            ) : media.length === 0 ? (
                <View style={styles.center}><Feather name="image" size={48} color="#cbd5e1" /><Text style={styles.emptyTxt}>گالری سایت خالی است.</Text></View>
            ) : (
                <FlatList
                    data={media}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderMediaItem}
                    numColumns={COLUMN_COUNT}
                    contentContainerStyle={styles.list}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={loading && page > 1 ? <ActivityIndicator size="small" color="#8b5cf6" style={{ margin: 20 }} /> : null}
                />
            )}
        </View>
    );
};

export default MediaGalleryScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { backgroundColor: '#fff', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    uploadBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, elevation: 2 },
    uploadBtnTxt: { fontSize: 12, fontWeight: 'bold', color: '#ffffff', marginRight: 6 },
    deleteBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, elevation: 2 },
    deleteBtnTxt: { fontSize: 12, fontWeight: 'bold', color: '#ffffff', marginRight: 6 },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTxt: { marginTop: 10, fontSize: 13, color: '#64748b', fontWeight: 'bold' },
    emptyTxt: { marginTop: 10, fontSize: 14, color: '#94a3b8', fontWeight: 'bold' },

    list: { padding: 8 },
    imageContainer: { width: IMAGE_SIZE, height: IMAGE_SIZE, margin: 4, borderRadius: 12, backgroundColor: '#e2e8f0', overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
    imageContainerSelected: { borderColor: '#8b5cf6', borderWidth: 3 },
    thumbnail: { width: '100%', height: '100%' },

    // 🚀 ارور قرمز رنگ با تبدیل به استایل دستی رفع شد
    selectedOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(139, 92, 246, 0.3)' },
    checkboxContainer: { position: 'absolute', top: 8, right: 8, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12 },
});