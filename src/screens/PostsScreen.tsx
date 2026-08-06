import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
// ایمپورت ادیتور اختصاصی شما. اگر مسیرش فرق دارد آن را تنظیم کنید.
import RichEditorToolbar from '../components/RichEditorToolbar';

export const PostsScreen: React.FC = () => {
    const [posts, setPosts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const [modalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPost, setSelectedPost] = useState<any>(null);
    
    // فیلدهای نوشته و سئو
    const [postTitle, setPostTitle] = useState('');
    const [postContent, setPostContent] = useState('');
    const [postStatus, setPostStatus] = useState<'publish' | 'draft'>('publish');
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [seoTitle, setSeoTitle] = useState('');
    const [seoDesc, setSeoDesc] = useState('');
    const [seoKeyword, setSeoKeyword] = useState('');

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const authStore = useAuthStore() as any;
    const siteUrl = authStore.siteUrl || authStore.url || '';

    const fetchCategories = useCallback(async () => {
        try {
            const res = await axios.get(`${siteUrl}/wp-json/wp/v2/categories`, { params: { per_page: 100, hide_empty: false } });
            setCategories(res.data);
        } catch (error) { console.log(error); }
    }, [siteUrl]);

    const fetchPosts = useCallback(async (pageNum = 1, search = '') => {
        if (pageNum === 1) setLoading(true);
        try {
            const response = await axios.get(`${siteUrl}/wp-json/wp/v2/posts`, { params: { per_page: 15, page: pageNum, search: search } });
            const fetchedData = response.data || [];
            if (pageNum === 1) setPosts(fetchedData); else setPosts(prev => [...prev, ...fetchedData]);
            setHasMore(fetchedData.length === 15);
        } catch (error) { console.log(error); } finally { setLoading(false); }
    }, [siteUrl]);

    useEffect(() => { if (siteUrl) { fetchCategories(); fetchPosts(1, ''); } }, [siteUrl, fetchCategories, fetchPosts]);

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => { setPage(1); fetchPosts(1, text); }, 600);
    };

    const loadMore = () => { if (!loading && hasMore) { setPage(prev => prev + 1); fetchPosts(page + 1, searchQuery); } };

    const openPostModal = (post: any = null) => {
        if (post) {
            setSelectedPost(post);
            setPostTitle(post.title.rendered);
            setPostContent(post.content.rendered);
            setPostStatus(post.status);
            setSelectedCategories(post.categories || []);
            // بازیابی متادیتاهای سئو
            const meta = post.meta || {};
            setSeoTitle(meta._yoast_wpseo_title || meta.rank_math_title || '');
            setSeoDesc(meta._yoast_wpseo_metadesc || meta.rank_math_description || '');
            setSeoKeyword(meta._yoast_wpseo_focuskw || meta.rank_math_focus_keyword || '');
        } else {
            setSelectedPost(null); setPostTitle(''); setPostContent(''); setPostStatus('publish'); setSelectedCategories([]);
            setSeoTitle(''); setSeoDesc(''); setSeoKeyword('');
        }
        setModalVisible(true);
    };

    const savePost = async () => {
        if (!postTitle.trim()) return Alert.alert('توجه', 'عنوان نوشته نمی‌تواند خالی باشد.');
        setIsSaving(true);
        
        // 🚀 ذخیره اطلاعات سئو به عنوان متادیتا (همگام با Yoast و RankMath)
        const payload = {
            title: postTitle,
            content: postContent,
            status: postStatus,
            categories: selectedCategories,
            meta: {
                _yoast_wpseo_title: seoTitle,
                _yoast_wpseo_metadesc: seoDesc,
                _yoast_wpseo_focuskw: seoKeyword,
                rank_math_title: seoTitle,
                rank_math_description: seoDesc,
                rank_math_focus_keyword: seoKeyword
            }
        };

        try {
            if (selectedPost) {
                await axios.post(`${siteUrl}/wp-json/wp/v2/posts/${selectedPost.id}`, payload);
                Alert.alert('موفق', 'نوشته و اطلاعات سئو با موفقیت ویرایش شد.');
            } else {
                await axios.post(`${siteUrl}/wp-json/wp/v2/posts`, payload);
                Alert.alert('موفق', 'نوشته جدید با موفقیت منتشر شد.');
            }
            setModalVisible(false);
            setPage(1); fetchPosts(1, searchQuery);
        } catch (error) {
            Alert.alert('خطا', 'مشکلی در ذخیره نوشته پیش آمد.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderPostCard = ({ item }: { item: any }) => {
        const isPublished = item.status === 'publish';
        const postCatNames = item.categories.map((catId: number) => categories.find(c => c.id === catId)?.name).filter(Boolean).join('، ');

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={styles.postTitle} numberOfLines={2}>{item.title.rendered || 'بدون عنوان'}</Text>
                        <Text style={styles.postDate}>{item.date.split('T')[0]}</Text>
                    </View>
                    <View style={[styles.statusBadge, isPublished ? styles.statusPub : styles.statusDraft]}>
                        <Text style={[styles.statusTxt, isPublished ? { color: '#16a34a' } : { color: '#d97706' }]}>{isPublished ? 'منتشر شده' : 'پیش‌نویس'}</Text>
                    </View>
                </View>

                {postCatNames ? (
                    <View style={styles.catRow}>
                        <Feather name="folder" size={14} color="#64748b" style={{ marginLeft: 6 }} />
                        <Text style={styles.catTxt} numberOfLines={1}>{postCatNames}</Text>
                    </View>
                ) : null}

                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]} onPress={() => openPostModal(item)}>
                        <Feather name="edit-3" size={16} color="#475569" /><Text style={[styles.actionTxt, { color: '#475569' }]}>ویرایش و سئو</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>مدیریت وبلاگ و مقالات</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => openPostModal()}>
                        <Feather name="plus" size={16} color="#ffffff" /><Text style={styles.addBtnTxt}>نوشته جدید</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.searchBox}>
                    <TextInput style={styles.searchInput} placeholder="جستجو در مقالات..." value={searchQuery} onChangeText={handleSearchChange} textAlign="right" />
                    <Feather name="search" size={18} color="#94a3b8" />
                </View>
            </View>

            {loading && page === 1 ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /><Text style={styles.loadingTxt}>در حال دریافت مقالات...</Text></View>
            ) : (
                <FlatList data={posts} keyExtractor={(item) => item.id.toString()} renderItem={renderPostCard} contentContainerStyle={styles.list} onEndReached={loadMore} onEndReachedThreshold={0.3} showsVerticalScrollIndicator={false} />
            )}

            {/* مودال افزودن / ویرایش نوشته و سئو */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedPost ? 'ویرایش نوشته و SEO' : 'افزودن مقاله جدید'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}><Feather name="x" size={24} color="#64748b" /></TouchableOpacity>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>عنوان نوشته:</Text>
                            <TextInput style={styles.input} placeholder="عنوان مقاله" value={postTitle} onChangeText={setPostTitle} textAlign="right" />

                            <Text style={styles.inputLabel}>محتوای متن (ویرایشگر):</Text>
                            {/* 🚀 فراخوانی ادیتوری که قبلاً ساختید */}
                            <View style={styles.editorContainer}>
                                <RichEditorToolbar content={postContent} onChange={setPostContent} />
                            </View>

                            <View style={styles.seoBox}>
                                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 }}>
                                    <Feather name="target" size={18} color="#0f172a" />
                                    <Text style={[styles.inputLabel, { marginTop: 0, marginRight: 8, color: '#0f172a' }]}>تنظیمات سئو (SEO)</Text>
                                </View>
                                
                                <Text style={styles.inputLabel}>کلمه کلیدی کانونی:</Text>
                                <TextInput style={styles.input} placeholder="مثال: خرید لباس زنانه" value={seoKeyword} onChangeText={setSeoKeyword} textAlign="right" />
                                
                                <Text style={styles.inputLabel}>عنوان سئو (متا تایتل):</Text>
                                <TextInput style={styles.input} placeholder="عنوانی که در گوگل نمایش داده می‌شود" value={seoTitle} onChangeText={setSeoTitle} textAlign="right" />

                                <Text style={styles.inputLabel}>توضیحات متا (Meta Description):</Text>
                                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="یک پاراگراف جذاب برای نمایش در گوگل..." value={seoDesc} onChangeText={setSeoDesc} multiline textAlign="right" />
                            </View>

                            <Text style={styles.inputLabel}>وضعیت انتشار:</Text>
                            <View style={styles.statusSelectRow}>
                                <TouchableOpacity style={[styles.statusSelectBtn, postStatus === 'publish' && styles.statusSelectActive]} onPress={() => setPostStatus('publish')}><Text style={[styles.statusSelectTxt, postStatus === 'publish' && styles.statusSelectTxtActive]}>انتشار فوری</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.statusSelectBtn, postStatus === 'draft' && styles.statusSelectActive]} onPress={() => setPostStatus('draft')}><Text style={[styles.statusSelectTxt, postStatus === 'draft' && styles.statusSelectTxtActive]}>پیش‌نویس</Text></TouchableOpacity>
                            </View>

                            <Text style={styles.inputLabel}>دسته‌بندی‌ها:</Text>
                            <View style={styles.categoriesWrap}>
                                {categories.map(cat => {
                                    const isSelected = selectedCategories.includes(cat.id);
                                    return (
                                        <TouchableOpacity key={cat.id} style={[styles.catChip, isSelected && styles.catChipActive]} onPress={() => toggleCategory(cat.id)}>
                                            <Text style={[styles.catChipTxt, isSelected && styles.catChipTxtActive]}>{cat.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity style={styles.saveBtn} onPress={savePost} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>ذخیره نوشته و سئو</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

export default PostsScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { backgroundColor: '#fff', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    searchBox: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: '#0f172a', textAlign: 'right' },
    addBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#8b5cf6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, elevation: 2 },
    addBtnTxt: { fontSize: 12, fontWeight: 'bold', color: '#ffffff', marginRight: 6 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTxt: { marginTop: 10, fontSize: 13, color: '#64748b', fontWeight: 'bold' },
    emptyTxt: { marginTop: 10, fontSize: 14, color: '#94a3b8', fontWeight: 'bold' },
    list: { padding: 16 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
    cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
    postTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right', lineHeight: 22 },
    postDate: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 6, fontWeight: 'bold' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    statusPub: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
    statusDraft: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
    statusTxt: { fontSize: 10, fontWeight: '900' },
    catRow: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 10, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, alignSelf: 'flex-end' },
    catTxt: { fontSize: 11, color: '#475569', fontWeight: 'bold', maxWidth: 200 },
    actionRow: { flexDirection: 'row-reverse', marginTop: 15, gap: 10 },
    actionBtn: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    actionTxt: { fontSize: 12, fontWeight: 'bold', marginRight: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, elevation: 5, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 15 },
    modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
    inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#334155', textAlign: 'right', marginBottom: 8, marginTop: 15 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, color: '#0f172a' },
    editorContainer: { height: 250, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, overflow: 'hidden', backgroundColor: '#f8fafc' },
    seoBox: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde047', borderRadius: 16, padding: 15, marginTop: 20, marginBottom: 10 },
    statusSelectRow: { flexDirection: 'row-reverse', gap: 10 },
    statusSelectBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    statusSelectActive: { backgroundColor: '#8b5cf6', borderColor: '#7c3aed' },
    statusSelectTxt: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    statusSelectTxtActive: { color: '#ffffff' },
    categoriesWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 5 },
    catChip: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    catChipActive: { backgroundColor: '#8b5cf6', borderColor: '#7c3aed' },
    catChipTxt: { fontSize: 12, color: '#475569', fontWeight: 'bold' },
    catChipTxtActive: { color: '#ffffff', fontWeight: '900' },
    saveBtn: { backgroundColor: '#8b5cf6', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 30, marginBottom: 20 },
    saveBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
});