import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, TextInput,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
    Animated, PanResponder, Modal, Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { createWooClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
// @ts-ignore
import ViewShot from 'react-native-view-shot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 🌟 بهینه‌سازی عمیق با React.memo: جلوگیری از افت فریم در زمان اضافه کردن ده‌ها متن
const DraggableText = React.memo(({ item, onPress, onDragStart, onDragEnd }: any) => {
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const panRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const listener = pan.addListener((value) => {
            panRef.current = value;
        });
        return () => { pan.removeListener(listener); };
    }, []);
    
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                onDragStart && onDragStart(); 
                pan.setOffset({ x: panRef.current.x, y: panRef.current.y });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
            onPanResponderRelease: (e, gestureState) => {
                pan.flattenOffset();
                onDragEnd && onDragEnd(); 
                
                if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
                    onPress();
                }
            }
        })
    ).current;

    // 🌟 منطق هوشمند رنگ پس‌زمینه متن
    let textColor = item.color;
    let bgColor = 'transparent';
    let paddingVal = 0;
    let borderRadiusVal = 0;

    if (item.bgMode === 1) {
        bgColor = item.color;
        textColor = (item.color === '#ffffff') ? '#0f172a' : '#ffffff';
        paddingVal = 10;
        borderRadiusVal = 12;
    } else if (item.bgMode === 2) {
        bgColor = (item.color === '#ffffff') ? 'rgba(0,0,0,0.6)' : '#ffffff';
        textColor = item.color;
        paddingVal = 10;
        borderRadiusVal = 12;
    }

    return (
        <Animated.View {...panResponder.panHandlers} style={[
            { transform: pan.getTranslateTransform() },
            { position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 100 }
        ]}>
            <View style={{ backgroundColor: bgColor, paddingHorizontal: paddingVal, paddingVertical: paddingVal / 2, borderRadius: borderRadiusVal }}>
                <Text style={{
                    color: textColor,
                    fontSize: item.size,
                    fontFamily: item.font,
                    fontWeight: '900',
                    textAlign: item.align || 'center',
                    textShadowColor: item.bgMode === 0 ? 'rgba(0,0,0,0.85)' : 'transparent',
                    textShadowOffset: { width: 0, height: item.bgMode === 0 ? 1 : 0 },
                    textShadowRadius: item.bgMode === 0 ? 8 : 0,
                }}>
                    {item.text}
                </Text>
            </View>
        </Animated.View>
    );
});

export const StoryCreatorScreen: React.FC = () => {
    const navigation = useNavigation();
    
    const [media, setMedia] = useState<any>(null);
    const [caption, setCaption] = useState(''); 
    const [link, setLink] = useState('');
    const [isScrollEnabled, setIsScrollEnabled] = useState(true);
    
    const [texts, setTexts] = useState<any[]>([]);
    const [editingIndex, setEditingIndex] = useState<number>(-1);

    // 🌟 استیت‌های حرفه‌ای ادیتور متن
    const [isEditingText, setIsEditingText] = useState(false);
    const [storyText, setStoryText] = useState('');
    const [storyTextColor, setStoryTextColor] = useState('#ffffff');
    const [storyTextSize, setStoryTextSize] = useState(28); 
    const [fontIndex, setFontIndex] = useState(0);
    const [storyTextBgMode, setStoryTextBgMode] = useState<number>(0); // 0: None, 1: Solid, 2: Inverted
    const [storyTextAlign, setStoryTextAlign] = useState<'center' | 'left' | 'right'>('center');

    const fonts = Platform.OS === 'ios' ? ['System', 'Georgia', 'Courier New', 'Trebuchet MS'] : ['sans-serif', 'serif', 'monospace', 'sans-serif-condensed'];
    const colors = ['#ffffff', '#0f172a', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];
    
    const viewShotRef = useRef<any>(null);
    const [uploading, setUploading] = useState(false);
    const [autoExpire, setAutoExpire] = useState(true);
    const [activeStories, setActiveStories] = useState<any[]>([]);
    const [loadingStories, setLoadingStories] = useState(true);

    const authStore = useAuthStore() as any;
    const siteUrl = authStore.siteUrl || authStore.url || '';

    const fetchActiveStories = useCallback(async () => {
        setLoadingStories(true);
        try {
            const client = createWooClient();
            const response = await client.get('pishmo/active-stories');
            if (response.data.success) setActiveStories(response.data.data);
        } catch (error) {
            console.log('Error fetching stories');
        } finally {
            setLoadingStories(false);
        }
    }, []);

    useEffect(() => {
        if (siteUrl) fetchActiveStories();
    }, [siteUrl, fetchActiveStories]);

    const pickMedia = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return Alert.alert('خطا', 'لطفا دسترسی به گالری را مجاز کنید.');
        try {
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images' as any, 
                allowsEditing: true, 
                aspect: [9, 16], 
                quality: 0.9
            });
            if (!result.canceled && result.assets[0]) {
                setMedia(result.assets[0]);
                setTexts([]); 
            }
        } catch (error) {
            Alert.alert('خطا', 'برنامه را کامل ببندید و دوباره باز کنید.');
        }
    };

    const handleUploadStory = async () => {
        if (!media) return Alert.alert('توجه', 'ابتدا یک عکس برای استوری انتخاب کنید.');
        setUploading(true);
        try {
            let capturedUri = media.uri;
            
            if (viewShotRef.current) {
                capturedUri = await viewShotRef.current.capture();
            }

            const manipulated = await (ImageManipulator as any).manipulateAsync(
                capturedUri, [{ resize: { width: 1080 } }], { compress: 0.7, format: (ImageManipulator as any).SaveFormat.JPEG, base64: true }
            );

            const client = createWooClient();
            const response = await client.post('pishmo/upload-story', {
                image_base64: manipulated.base64,
                caption: caption,
                link: link,
                auto_expire: autoExpire ? 1 : 0
            });

            if (response.data.success) {
                Alert.alert('موفق', 'استوری شما با موفقیت منتشر شد.');
                setMedia(null); setCaption(''); setLink(''); setTexts([]); setAutoExpire(true);
                fetchActiveStories();
            }
        } catch (error) {
            Alert.alert('خطا', 'آپلود انجام نشد. وضعیت اینترنت را بررسی کنید.');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteStory = (id: number) => {
        Alert.alert('حذف استوری', 'آیا از حذف این استوری مطمئن هستید؟', [
            { text: 'انصراف', style: 'cancel' },
            { text: 'بله، حذف شود', style: 'destructive', onPress: async () => {
                try {
                    const client = createWooClient();
                    await client.delete(`pishmo/delete-story/${id}`);
                    fetchActiveStories();
                } catch (error) {
                    Alert.alert('خطا', 'حذف انجام نشد.');
                }
            }}
        ]);
    };

    const openNewTextEditor = () => {
        setStoryText(''); setStoryTextColor('#ffffff'); setStoryTextSize(28); 
        setStoryTextBgMode(0); setStoryTextAlign('center');
        setEditingIndex(-1); setIsEditingText(true);
    };

    const editExistingText = useCallback((index: number) => {
        const t = texts[index];
        setStoryText(t.text); setStoryTextColor(t.color); setStoryTextSize(t.size); 
        setFontIndex(fonts.indexOf(t.font) >= 0 ? fonts.indexOf(t.font) : 0);
        setStoryTextBgMode(t.bgMode || 0); setStoryTextAlign(t.align || 'center');
        setEditingIndex(index); setIsEditingText(true);
    }, [texts, fonts]);

    const confirmTextEditing = () => {
        if (storyText.trim()) {
            if (editingIndex >= 0) {
                const newTexts = [...texts];
                newTexts[editingIndex] = { 
                    ...newTexts[editingIndex], 
                    text: storyText, color: storyTextColor, size: storyTextSize, 
                    font: fonts[fontIndex], bgMode: storyTextBgMode, align: storyTextAlign 
                };
                setTexts(newTexts);
            } else {
                setTexts([...texts, { 
                    id: Date.now().toString(), 
                    text: storyText, color: storyTextColor, size: storyTextSize, 
                    font: fonts[fontIndex], bgMode: storyTextBgMode, align: storyTextAlign 
                }]);
            }
        } else if (editingIndex >= 0) {
            const newTexts = texts.filter((_, i) => i !== editingIndex);
            setTexts(newTexts);
        }
        setIsEditingText(false);
    };

    // توابع کمکی ادیتور
    const increaseSize = () => setStoryTextSize(s => Math.min(s + 4, 60));
    const decreaseSize = () => setStoryTextSize(s => Math.max(s - 4, 14));
    const toggleFont = () => setFontIndex(prev => (prev + 1) % fonts.length);
    const toggleBgMode = () => setStoryTextBgMode(prev => (prev + 1) % 3);
    const toggleAlign = () => {
        const aligns: ('center'|'left'|'right')[] = ['center', 'left', 'right'];
        setStoryTextAlign(prev => aligns[(aligns.indexOf(prev) + 1) % 3]);
    };

    // محاسبات رنگ ادیتور
    let editorTextColor = storyTextColor;
    let editorBgColor = 'transparent';
    if (storyTextBgMode === 1) {
        editorBgColor = storyTextColor;
        editorTextColor = (storyTextColor === '#ffffff') ? '#0f172a' : '#ffffff';
    } else if (storyTextBgMode === 2) {
        editorBgColor = (storyTextColor === '#ffffff') ? 'rgba(0,0,0,0.6)' : '#ffffff';
        editorTextColor = storyTextColor;
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

            <ScrollView scrollEnabled={isScrollEnabled} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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
                                    <Image source={{ uri: story.image || 'https://via.placeholder.com/150' }} style={styles.storyImg} />
                                    <TouchableOpacity style={styles.deleteBtnTopRight} onPress={() => handleDeleteStory(story.id)}>
                                        <Feather name="trash-2" size={14} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>

                <View style={styles.uploadSection}>
                    <Text style={styles.sectionTitle}>✨ ساخت استوری جدید</Text>

                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                        {media ? (
                            <View>
                                <View style={styles.topImageTools}>
                                    <TouchableOpacity onPress={openNewTextEditor} style={styles.iconCircleBtn}>
                                        <Text style={{fontWeight: '900', color: '#fff', fontSize: 16}}>Aa</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { setMedia(null); setTexts([]); }} style={styles.iconCircleBtn}>
                                        <Feather name="x" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>

                                <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 1 }} style={styles.storyCanvas}>
                                    <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
                                    
                                    {texts.map((t, index) => (
                                        <DraggableText 
                                            key={index} 
                                            item={t} 
                                            onPress={() => editExistingText(index)} 
                                            onDragStart={() => setIsScrollEnabled(false)} 
                                            onDragEnd={() => setIsScrollEnabled(true)}    
                                        />
                                    ))}
                                </ViewShot>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.storyCanvasPlaceholder} onPress={pickMedia}>
                                <Feather name="plus-circle" size={40} color="#94a3b8" />
                                <Text style={styles.emptyMediaTxt}>انتخاب تصویر از گالری</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.inputLabel}>عنوان زیر استوری (اختیاری):</Text>
                    <TextInput style={styles.input} placeholder="مثال: تخفیف ویژه پاییزی..." value={caption} onChangeText={setCaption} textAlign="right" />

                    <Text style={styles.inputLabel}>لینک کشویی (برای بالا کشیدن استوری):</Text>
                    <View style={styles.linkWrapper}>
                        <TextInput style={styles.linkInput} placeholder="https://..." value={link} onChangeText={setLink} textAlign="left" autoCapitalize="none" keyboardType="url" />
                        <Feather name="link" size={16} color="#64748b" style={{ marginLeft: 8 }} />
                    </View>

                    <TouchableOpacity style={styles.settingToggle} onPress={() => setAutoExpire(!autoExpire)} activeOpacity={0.8}>
                        <Feather name={autoExpire ? 'check-circle' : 'circle'} size={20} color={autoExpire ? '#ee2a7b' : '#94a3b8'} />
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.settingToggleTxt}>حذف خودکار پس از ۲۴ ساعت</Text>
                            <Text style={styles.settingToggleSubTxt}>{autoExpire ? 'استوری پس از ۲۴ ساعت محو می‌شود.' : 'استوری برای همیشه در سایت می‌ماند.'}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleUploadStory} disabled={uploading}>
                        <LinearGradient colors={['#f9ce34', '#ee2a7b', '#6228d7']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.submitBtn, uploading && { opacity: 0.7 }]}>
                            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnTxt}>🚀 انتشار استوری</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* 🌟 مدال ادیتور متن */}
            <Modal visible={isEditingText} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.textEditorOverlay}>
                    
                    <View style={styles.textEditorHeader}>
                        <TouchableOpacity style={styles.textEditorDoneBtn} onPress={confirmTextEditing}>
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>تایید</Text>
                        </TouchableOpacity>
                        
                        {/* 🌟 دکمه‌های جدید چیدمان و هایلایت */}
                        <View style={{ flexDirection: 'row-reverse', gap: 15 }}>
                            <TouchableOpacity onPress={toggleBgMode} style={styles.topToolBtn}>
                                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>A✨</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={toggleAlign} style={styles.topToolBtn}>
                                <Feather name={`align-${storyTextAlign}` as any} size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ backgroundColor: editorBgColor, paddingHorizontal: storyTextBgMode === 0 ? 0 : 10, borderRadius: 12 }}>
                            <TextInput
                                autoFocus
                                style={{
                                    color: editorTextColor,
                                    fontSize: storyTextSize,
                                    fontFamily: fonts[fontIndex],
                                    fontWeight: '900',
                                    textAlign: storyTextAlign,
                                    textShadowColor: storyTextBgMode === 0 ? 'rgba(0, 0, 0, 0.85)' : 'transparent',
                                    textShadowOffset: { width: 0, height: storyTextBgMode === 0 ? 1 : 0 },
                                    textShadowRadius: storyTextBgMode === 0 ? 10 : 0,
                                    minWidth: '50%',
                                    maxWidth: SCREEN_WIDTH - 40,
                                }}
                                multiline
                                value={storyText}
                                onChangeText={setStoryText}
                                placeholder="متن خود را بنویسید..."
                                placeholderTextColor="rgba(255,255,255,0.4)"
                            />
                        </View>
                    </View>

                    <View style={styles.textEditorTools}>
                        <View style={styles.toolRow}>
                            <TouchableOpacity style={styles.toolBtn} onPress={toggleFont}>
                                <Feather name="type" size={20} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.toolBtn} onPress={increaseSize}>
                                <Feather name="zoom-in" size={20} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.toolBtn} onPress={decreaseSize}>
                                <Feather name="zoom-out" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                            {colors.map(color => (
                                <TouchableOpacity 
                                    key={color} 
                                    style={[styles.colorCircle, { backgroundColor: color }, storyTextColor === color && styles.colorCircleActive]} 
                                    onPress={() => setStoryTextColor(color)} 
                                />
                            ))}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </KeyboardAvoidingView>
    );
};

export default StoryCreatorScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
    scrollContent: { padding: 16, paddingBottom: 150 },

    activeStoriesSection: { backgroundColor: '#fff', padding: 16, borderRadius: 16, elevation: 1, marginBottom: 20 },
    noStoryTxt: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginVertical: 15, fontWeight: 'bold' },
    storyCard: { width: 80, height: 140, borderRadius: 12, overflow: 'hidden', marginLeft: 12, position: 'relative', borderWidth: 2, borderColor: '#ee2a7b' },
    storyImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    deleteBtnTopRight: { position: 'absolute', top: 5, right: 5, backgroundColor: '#ef4444', padding: 6, borderRadius: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5 },

    uploadSection: { backgroundColor: '#fff', padding: 16, borderRadius: 16, elevation: 1 },
    sectionTitle: { fontSize: 15, fontWeight: '900', color: '#334155', textAlign: 'right', marginBottom: 20 },

    storyCanvas: { 
        width: SCREEN_WIDTH * 0.85, 
        aspectRatio: 9 / 16,        
        backgroundColor: '#000', 
        borderRadius: 20, 
        overflow: 'hidden', 
        position: 'relative', 
        elevation: 3 
    },
    storyCanvasPlaceholder: {
        width: SCREEN_WIDTH * 0.85, 
        aspectRatio: 9 / 16,        
        backgroundColor: '#f8fafc', 
        borderRadius: 20, 
        borderWidth: 2,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        alignItems: 'center', 
        justifyContent: 'center', 
    },
    mediaPreview: { width: '100%', height: '100%', resizeMode: 'cover', position: 'absolute', top: 0, left: 0 },
    emptyMediaTxt: { marginTop: 12, fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    
    topImageTools: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: SCREEN_WIDTH * 0.85, marginBottom: 10 },
    iconCircleBtn: { backgroundColor: '#0f172a', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 2 },

    inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, fontSize: 13, color: '#0f172a', fontWeight: 'bold' },
    
    linkWrapper: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, marginBottom: 20 },
    linkInput: { flex: 1, paddingVertical: 12, fontSize: 13, color: '#2563eb', textAlign: 'left', fontWeight: 'bold' },

    settingToggle: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fdf2f8', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fbcfe8', marginBottom: 20 },
    settingToggleTxt: { fontSize: 13, fontWeight: '900', color: '#be185d', textAlign: 'right' },
    settingToggleSubTxt: { fontSize: 10, color: '#f43f5e', textAlign: 'right', marginTop: 2, fontWeight: 'bold' },

    submitBtn: { padding: 16, borderRadius: 14, alignItems: 'center', elevation: 2 },
    submitBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },

    textEditorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', paddingVertical: Platform.OS === 'ios' ? 50 : 20 },
    textEditorHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    textEditorDoneBtn: { backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    topToolBtn: { padding: 5 },
    textEditorTools: { alignItems: 'center', paddingBottom: 20 },
    toolRow: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 20, marginBottom: 20 },
    toolBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 25, width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
    colorCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff', marginHorizontal: 8 },
    colorCircleActive: { borderColor: '#ee2a7b', transform: [{ scale: 1.2 }] },
});