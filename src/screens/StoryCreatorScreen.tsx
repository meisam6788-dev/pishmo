import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, TextInput,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

export const StoryCreatorScreen: React.FC = () => {
    const navigation = useNavigation();
    const [media, setMedia] = useState<any>(null);
    const [caption, setCaption] = useState('');
    const [link, setLink] = useState('');
    const [uploading, setUploading] = useState(false);

    const [activeStories, setActiveStories] = useState<any[]>([]);
    const [loadingStories, setLoadingStories] = useState(true);

    const authStore = useAuthStore() as any;
    const siteUrl = authStore.siteUrl || authStore.url || '';
    const ck = authStore.consumerKey || authStore.ck || '';
    const cs = authStore.consumerSecret || authStore.cs || '';

    const fetchActiveStories = async () => {
        setLoadingStories(true);
        try {
            const response = await axios.get(`${siteUrl}/wp-json/pishmo/v1/active-stories`);
            if (response.data.success) setActiveStories(response.data.data);
        } catch (error) {
            console.log('Error fetching stories');
        } finally {
            setLoadingStories(false);
        }
    };

    useEffect(() => {
        if (siteUrl) fetchActiveStories();
    }, [siteUrl]);

    const pickMedia = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'], // پشتیبانی از عکس و ویدیو
            allowsEditing: true, aspect: [9, 16], quality: 0.8
        });
        if (!result.canceled && result.assets[0]) setMedia(result.assets[0]);
    };

    const handleUploadStory = async () => {
        if (!media) return Alert.alert('توجه', 'یک عکس یا ویدیو انتخاب کنید.');
        setUploading(true);
        try {
            // استفاده از FormData برای پشتیبانی از ویدیو و فایل‌های حجیم
            const formData = new FormData();
            const fileExt = media.uri.split('.').pop();
            const mimeType = media.type === 'video' ? `video/${fileExt}` : `image/${fileExt}`;

            formData.append('media', {
                uri: Platform.OS === 'ios' ? media.uri.replace('file://', '') : media.uri,
                name: `story_${Date.now()}.${fileExt}`,
                type: mimeType
            } as any);

            formData.append('caption', caption);
            formData.append('link', link);
            formData.append('consumer_key', ck);
            formData.append('consumer_secret', cs);

            const response = await axios.post(`${siteUrl}/wp-json/pishmo/v1/upload-story`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                Alert.alert('موفق', 'استوری با موفقیت در سایت منتشر شد.');
                setMedia(null); setCaption(''); setLink('');
                fetchActiveStories();
            }
        } catch (error) {
            Alert.alert('خطا', 'آپلود انجام نشد. وضعیت اینترنت را چک کنید.');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteStory = (id: number) => {
        Alert.alert('حذف استوری', 'آیا از حذف این استوری مطمئن هستید؟', [
            { text: 'انصراف', style: 'cancel' },
            {
                text: 'حذف', style: 'destructive', onPress: async () => {
                    try {
                        await axios.delete(`${siteUrl}/wp-json/pishmo/v1/delete-story/${id}`);
                        fetchActiveStories();
                    } catch (error) {
                        Alert.alert('خطا', 'حذف انجام نشد.');
                    }
                }
            }
        ]);
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

            <View style={styles.header}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginLeft: 10 }}>
                        <Feather name="arrow-right" size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>استوری‌ها</Text>
                </View>
                <Feather name="instagram" size={24} color="#ee2a7b" />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* استوری‌های فعال */}
                <View style={styles.activeStoriesSection}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={styles.sectionTitle}>📱 استوری‌های فعال سایت</Text>
                        <TouchableOpacity onPress={fetchActiveStories}>
                            <Feather name="refresh-cw" size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {loadingStories ? (
                        <ActivityIndicator color="#ee2a7b" />
                    ) : activeStories.length === 0 ? (
                        <Text style={styles.noStoryTxt}>هیچ استوری فعالی وجود ندارد.</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row-reverse' }}>
                            {activeStories.map(story => (
                                <View key={story.id} style={styles.storyCard}>
                                    {story.is_video ? (
                                        <View style={[styles.storyImg, { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' }]}>
                                            <Feather name="video" size={30} color="#fff" />
                                        </View>
                                    ) : (
                                        <Image source={{ uri: story.image || 'https://via.placeholder.com/150' }} style={styles.storyImg} />
                                    )}
                                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteStory(story.id)}>
                                        <Feather name="trash-2" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>

                {/* آپلود جدید */}
                <View style={styles.uploadSection}>
                    <Text style={styles.sectionTitle}>✨ افزودن استوری جدید</Text>

                    <TouchableOpacity style={styles.mediaPickerContainer} onPress={pickMedia}>
                        {media ? (
                            <>
                                <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
                                {media.type === 'video' && <View style={styles.videoOverlay}><Feather name="video" size={40} color="#fff" /></View>}
                            </>
                        ) : (
                            <View style={styles.emptyMediaBox}>
                                <Feather name="plus-circle" size={40} color="#94a3b8" />
                                <Text style={styles.emptyMediaTxt}>انتخاب عکس یا ویدیو</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TextInput style={styles.input} placeholder="توضیحات (اختیاری)..." value={caption} onChangeText={setCaption} textAlign="right" />

                    <View style={styles.linkWrapper}>
                        <TextInput style={styles.linkInput} placeholder="https://..." value={link} onChangeText={setLink} textAlign="left" autoCapitalize="none" keyboardType="url" />
                        <Text style={styles.linkLabel}>لینک:</Text>
                        <Feather name="link" size={16} color="#64748b" style={{ marginLeft: 8 }} />
                    </View>

                    <TouchableOpacity onPress={handleUploadStory} disabled={uploading}>
                        <LinearGradient colors={['#f9ce34', '#ee2a7b', '#6228d7']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.submitBtn, uploading && { opacity: 0.7 }]}>
                            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnTxt}>🚀 انتشار استوری</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default StoryCreatorScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
    scrollContent: { padding: 16, paddingBottom: 40 },

    activeStoriesSection: { backgroundColor: '#fff', padding: 16, borderRadius: 16, elevation: 1, marginBottom: 20 },
    noStoryTxt: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginVertical: 15, fontWeight: 'bold' },
    storyCard: { width: 90, height: 160, borderRadius: 12, overflow: 'hidden', marginLeft: 10, position: 'relative', borderWidth: 2, borderColor: '#ee2a7b' },
    storyImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    deleteBtn: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(225, 29, 72, 0.9)', padding: 6, borderRadius: 8 },

    uploadSection: { backgroundColor: '#fff', padding: 16, borderRadius: 16, elevation: 1 },
    sectionTitle: { fontSize: 15, fontWeight: '900', color: '#334155', textAlign: 'right', marginBottom: 12 },

    mediaPickerContainer: { width: 150, height: 266, backgroundColor: '#f8fafc', borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', alignSelf: 'center', marginBottom: 20, position: 'relative' },
    mediaPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    videoOverlay: { position: 'absolute', top: '40%', left: '35%', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 30 },
    emptyMediaBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyMediaTxt: { marginTop: 12, fontSize: 12, fontWeight: 'bold', color: '#64748b' },

    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 13, marginBottom: 15, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
    linkWrapper: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, marginBottom: 20 },
    linkLabel: { fontSize: 13, fontWeight: 'bold', color: '#334155', marginLeft: 8 },
    linkInput: { flex: 1, paddingVertical: 14, fontSize: 13, color: '#2563eb', textAlign: 'left' },

    submitBtn: { padding: 16, borderRadius: 14, alignItems: 'center', elevation: 2 },
    submitBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },
});