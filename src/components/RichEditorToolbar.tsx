import React, { useRef, useState } from 'react';
import {
    View, StyleSheet, Text, TouchableOpacity, FlatList, Image,
    ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
    Modal, Alert, StatusBar
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';

interface RichEditorProps {
    title: string; // 🚀 اضافه شدن پراپرتی عنوان
    content: string;
    onChange: (text: string) => void;
    siteUrl: string;
}

const RichEditorToolbar: React.FC<RichEditorProps> = ({ title, content, onChange, siteUrl }) => {
    const richText = useRef<RichEditor>(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [initialText, setInitialText] = useState('');

    const [activeOverlay, setActiveOverlay] = useState<'none' | 'gallery' | 'link' | 'color' | 'table' | 'element_settings'>('none');

    const [media, setMedia] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [mediaPage, setMediaPage] = useState(1);
    const [hasMoreMedia, setHasMoreMedia] = useState(true);

    const [linkUrl, setLinkUrl] = useState('');
    const [linkText, setLinkText] = useState('');
    const [elementLinkUrl, setElementLinkUrl] = useState('');
    const colors = ['#0f172a', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

    const [tableRows, setTableRows] = useState('2');
    const [tableCols, setTableCols] = useState('2');

    const openEditor = () => { setInitialText(content); setIsFullScreen(true); };
    const cancelEditing = () => { setIsFullScreen(false); };

    // 🚀 حل مشکل کُندی: ذخیره اطلاعات فقط با زدن دکمه تیک سبز انجام می‌شود
    const confirmEditing = async () => {
        const html = await richText.current?.getContentHtml();
        onChange(html || '');
        setIsFullScreen(false);
    };

    const fetchMedia = async (pageNum = 1) => {
        if (pageNum === 1) setLoading(true); else setLoadingMore(true);
        try {
            let cleanUrl = siteUrl.trim().replace(/\/+$/, '');
            if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;

            const res = await axios.get(`${cleanUrl}/wp-json/wp/v2/media`, {
                params: { media_type: 'image', per_page: 15, page: pageNum, _fields: 'id,source_url,media_details' }
            });

            if (pageNum === 1) setMedia(res.data); else setMedia([...media, ...res.data]);
            setHasMoreMedia(res.data.length === 15);
        } catch (error) { setHasMoreMedia(false); } finally { setLoading(false); setLoadingMore(false); }
    };

    const pickLocalImage = async () => {
        setActiveOverlay('none');
        const result = await ImagePicker.launchImageLibraryAsync({ 
            mediaTypes: ImagePicker.MediaTypeOptions.Images, // 🚀 رفع باگ باز نشدن گالری 
            quality: 0.8 
        });
        if (!result.canceled && result.assets.length > 0) { richText.current?.insertImage(result.assets[0].uri); }
    };

    const openGalleryPicker = () => {
        Alert.alert('انتخاب تصویر', 'منبع تصویر را انتخاب کنید:', [
            { text: 'گالری گوشی', onPress: pickLocalImage },
            { text: 'رسانه سایت وردپرس', onPress: () => { setActiveOverlay('gallery'); if (media.length === 0) { setMediaPage(1); fetchMedia(1); } } },
            { text: 'انصراف', style: 'cancel' }
        ]);
    };

    const loadMoreMedia = () => { if (!loading && !loadingMore && hasMoreMedia) { const next = mediaPage + 1; setMediaPage(next); fetchMedia(next); } };
    const insertSelectedWPMedia = (url: string) => { richText.current?.insertImage(url); setActiveOverlay('none'); };

    const insertLinkToEditor = () => {
        if (linkUrl && linkText) {
            richText.current?.insertHTML(`<a href="${linkUrl}" target="_blank" style="color: #10b981; text-decoration: underline;">${linkText}</a>`);
            setActiveOverlay('none'); setLinkUrl(''); setLinkText('');
        }
    };

    const insertCustomTable = () => {
        const r = parseInt(tableRows) || 2; const c = parseInt(tableCols) || 2;
        let tableHTML = `<br><div style="overflow-x:auto; width:100%; margin: 10px 0;"><table border="1" cellpadding="8" class="pishmo-table" style="width:100%; border-collapse: collapse; border-color: #cbd5e1; text-align: right; background-color: #fff;"><tbody>`;
        for (let i = 0; i < r; i++) { tableHTML += `<tr>`; for (let j = 0; j < c; j++) { tableHTML += `<td style="border: 1px solid #cbd5e1;">متن...</td>`; } tableHTML += `</tr>`; }
        tableHTML += `</tbody></table></div><p>&#8203;</p>`;
        richText.current?.insertHTML(tableHTML); setActiveOverlay('none');
    };

    const handleMessage = (message: any) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'PISHMO_SELECT') { setActiveOverlay('element_settings'); }
        } catch (e) { }
    };

    const handleEditorInitialized = () => {
        richText.current?.injectJavascript(`
            document.addEventListener('click', function(e) {
                var prevs = document.querySelectorAll('.pishmo-selected');
                for(var i=0; i<prevs.length; i++) { prevs[i].style.boxShadow = 'none'; prevs[i].classList.remove('pishmo-selected'); }
                var target = e.target;
                if(target.tagName === 'IMG' || target.closest('table')) {
                    var el = target.tagName === 'IMG' ? target : target.closest('table');
                    el.classList.add('pishmo-selected'); 
                    el.style.boxShadow = '0 0 0 3px #10b981';
                    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'PISHMO_SELECT'}));
                }
            });
        `);
    };

    const applyElementSize = (sizePx: string) => {
        richText.current?.injectJavascript(`
            var el = document.querySelector('.pishmo-selected');
            if(el && el.tagName === 'IMG') {
                el.style.width = '${sizePx}'; el.style.display = '${sizePx === '100%' ? 'block' : 'inline-block'}'; el.style.margin = '${sizePx === '100%' ? '10px auto' : '1%'}';
            }
        `);
        setActiveOverlay('none');
    };

    const applyElementLink = () => {
        if (!elementLinkUrl) return;
        richText.current?.injectJavascript(`
            var el = document.querySelector('.pishmo-selected');
            if(el && el.tagName === 'IMG') {
                var parent = el.parentNode;
                if(parent.tagName === 'A') { parent.href = '${elementLinkUrl}'; } 
                else { var a = document.createElement('a'); a.href = '${elementLinkUrl}'; a.target = '_blank'; parent.insertBefore(a, el); a.appendChild(el); }
            }
        `);
        setActiveOverlay('none'); setElementLinkUrl('');
    };

    const deleteSelectedElement = () => {
        richText.current?.injectJavascript(`
            var el = document.querySelector('.pishmo-selected');
            if(el) { var aParent = el.closest('a'); if(aParent) { aParent.remove(); } else { el.remove(); } }
        `);
        setActiveOverlay('none');
    };

    const applyColor = (colorCode: string) => { richText.current?.injectJavascript(`document.execCommand('foreColor', false, '${colorCode}'); true;`); setActiveOverlay('none'); };

    const plainTextPreview = content.replace(/<[^>]+>/g, '').trim();

    return (
        <View style={styles.wrapper}>
            <TouchableOpacity style={styles.inlinePreviewBtn} onPress={openEditor}>
                <View style={styles.inlineIconBox}><Feather name="edit-3" size={18} color="#10b981" /></View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.inlineTitle}>ویرایش {title}</Text>
                    <Text style={styles.inlineDesc} numberOfLines={1}>{plainTextPreview.length > 0 ? plainTextPreview : 'برای نوشتن کلیک کنید...'}</Text>
                </View>
                <Feather name="maximize-2" size={18} color="#94a3b8" />
            </TouchableOpacity>

            <Modal visible={isFullScreen} animationType="slide" onRequestClose={cancelEditing} hardwareAccelerated={true}>
                <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 40 }}>

                    <View style={styles.fullScreenHeader}>
                        <TouchableOpacity style={styles.confirmBtn} onPress={confirmEditing}><Feather name="check" size={20} color="#fff" /></TouchableOpacity>
                        <Text style={styles.fullScreenTitle}>{title}</Text>
                        <TouchableOpacity style={styles.cancelEditorBtn} onPress={cancelEditing}><Feather name="x" size={20} color="#ef4444" /></TouchableOpacity>
                    </View>

                    {/* 🚀 حل مشکل رفتن زیر کیبورد در اندروید */}
                    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'android' ? 25 : 0} style={{ flex: 1 }}>
                        <RichEditor
                            ref={richText}
                            initialContentHTML={content}
                            // onChange حذف شد تا از کُندی شدید جلوگیری شود
                            editorInitializedCallback={handleEditorInitialized}
                            onMessage={handleMessage}
                            placeholder="شروع به نوشتن کنید..."
                            editorStyle={{
                                backgroundColor: '#f8fafc',
                                color: '#0f172a',
                                placeholderColor: '#94a3b8',
                                contentCSSText: 'font-family: sans-serif; font-size: 15px; text-align: right; direction: rtl; line-height: 1.8;'
                            }}
                            style={{ flex: 1 }}
                        />

                        <RichToolbar
                            editor={richText}
                            actions={[
                                actions.undo, actions.redo, 'wp_gallery', 'element_settings',
                                'insert_custom_table', 'text_color', actions.heading1,
                                actions.heading2, actions.heading3, actions.heading4,
                                actions.setParagraph, actions.setBold, actions.alignRight,
                                actions.alignCenter, actions.alignLeft, actions.insertBulletsList,
                                'custom_link'
                            ]}
                            iconMap={{
                                [actions.undo]: ({ tintColor }: any) => <Feather name="rotate-ccw" size={18} color={tintColor} />,
                                [actions.redo]: ({ tintColor }: any) => <Feather name="rotate-cw" size={18} color={tintColor} />,
                                wp_gallery: ({ tintColor }: any) => <Feather name="image" size={18} color="#10b981" />,
                                element_settings: ({ tintColor }: any) => <Feather name="sliders" size={18} color="#f59e0b" />,
                                insert_custom_table: ({ tintColor }: any) => <Feather name="grid" size={18} color="#0ea5e9" />,
                                text_color: ({ tintColor }: any) => <Feather name="type" size={18} color="#8b5cf6" />,
                                [actions.heading1]: ({ tintColor }: any) => <Text style={[styles.iconText, { color: tintColor }]}>H1</Text>,
                                [actions.heading2]: ({ tintColor }: any) => <Text style={[styles.iconText, { color: tintColor }]}>H2</Text>,
                                [actions.heading3]: ({ tintColor }: any) => <Text style={[styles.iconText, { color: tintColor }]}>H3</Text>,
                                [actions.heading4]: ({ tintColor }: any) => <Text style={[styles.iconText, { color: tintColor }]}>H4</Text>,
                                [actions.setParagraph]: ({ tintColor }: any) => <Text style={[styles.iconText, { color: tintColor }]}>P</Text>,
                                [actions.alignRight]: ({ tintColor }: any) => <Feather name="align-right" size={18} color={tintColor} />,
                                [actions.alignCenter]: ({ tintColor }: any) => <Feather name="align-center" size={18} color={tintColor} />,
                                [actions.alignLeft]: ({ tintColor }: any) => <Feather name="align-left" size={18} color={tintColor} />,
                                custom_link: ({ tintColor }: any) => <Feather name="link" size={18} color={tintColor} />,
                            }}
                            wp_gallery={openGalleryPicker}
                            element_settings={() => setActiveOverlay('element_settings')}
                            insert_custom_table={() => setActiveOverlay('table')}
                            text_color={() => setActiveOverlay('color')}
                            custom_link={() => setActiveOverlay('link')}
                            iconTint="#64748b"
                            selectedIconTint="#10b981"
                            style={styles.toolbar}
                        />
                    </KeyboardAvoidingView>

                    {activeOverlay !== 'none' && (
                        <View style={styles.absoluteOverlay}>

                            {activeOverlay === 'element_settings' && (
                                <View style={styles.popupBox}>
                                    <Text style={styles.popupTitle}>تنظیمات رسانه / جدول</Text>
                                    <Text style={styles.popupSubtitle}>برای پاک کردن جدول یا تغییر عکس.</Text>

                                    <Text style={styles.popupLabel}>تغییر سایز عکس:</Text>
                                    <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 15 }}>
                                        <TouchableOpacity style={styles.sizeBtn} onPress={() => applyElementSize('150px')}><Text style={styles.sizeBtnTxt}>کوچک</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.sizeBtn} onPress={() => applyElementSize('300px')}><Text style={styles.sizeBtnTxt}>متوسط</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.sizeBtn} onPress={() => applyElementSize('100%')}><Text style={styles.sizeBtnTxt}>کامل</Text></TouchableOpacity>
                                    </View>

                                    <Text style={styles.popupLabel}>لینک دادن به عکس:</Text>
                                    <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 15 }}>
                                        <TextInput style={[styles.popupInput, { flex: 1, marginBottom: 0 }]} placeholder="آدرس لینک" value={elementLinkUrl} onChangeText={setElementLinkUrl} textAlign="left" keyboardType="url" />
                                        <TouchableOpacity style={[styles.sizeBtn, { backgroundColor: '#10b981', width: 60 }]} onPress={applyElementLink}><Text style={[styles.sizeBtnTxt, { color: '#fff' }]}>ثبت</Text></TouchableOpacity>
                                    </View>

                                    <TouchableOpacity style={styles.deleteElementBtn} onPress={deleteSelectedElement}><Feather name="trash-2" size={16} color="#ef4444" /><Text style={{ color: '#ef4444', fontWeight: 'bold', marginRight: 6 }}>حذف این تصویر / پاک کردن جدول</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveOverlay('none')}><Text style={styles.cancelBtnTxt}>بستن</Text></TouchableOpacity>
                                </View>
                            )}

                            {activeOverlay === 'table' && (
                                <View style={styles.popupBox}>
                                    <Text style={styles.popupTitle}>رسم جدول جدید</Text>
                                    <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                                        <View style={{ flex: 1 }}><Text style={styles.popupLabel}>تعداد سطر:</Text><TextInput style={styles.popupInput} keyboardType="numeric" value={tableRows} onChangeText={setTableRows} textAlign="center" /></View>
                                        <View style={{ flex: 1 }}><Text style={styles.popupLabel}>تعداد ستون:</Text><TextInput style={styles.popupInput} keyboardType="numeric" value={tableCols} onChangeText={setTableCols} textAlign="center" /></View>
                                    </View>
                                    <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 15 }}>
                                        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: '#10b981' }]} onPress={insertCustomTable}><Text style={{ color: '#fff', fontWeight: 'bold' }}>رسم جدول</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveOverlay('none')}><Text style={styles.cancelBtnTxt}>انصراف</Text></TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {activeOverlay === 'color' && (
                                <View style={styles.popupBox}>
                                    <Text style={styles.popupTitle}>رنگ متن</Text>
                                    <View style={styles.colorGrid}>{colors.map(color => (<TouchableOpacity key={color} style={[styles.colorCircle, { backgroundColor: color }]} onPress={() => applyColor(color)} />))}</View>
                                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveOverlay('none')}><Text style={styles.cancelBtnTxt}>بستن</Text></TouchableOpacity>
                                </View>
                            )}

                            {activeOverlay === 'link' && (
                                <View style={styles.popupBox}>
                                    <Text style={styles.popupTitle}>درج لینک</Text>
                                    <TextInput style={styles.popupInput} placeholder="متن نمایشی" value={linkText} onChangeText={setLinkText} textAlign="right" />
                                    <TextInput style={[styles.popupInput, { textAlign: 'left' }]} placeholder="https://..." value={linkUrl} onChangeText={setLinkUrl} keyboardType="url" />
                                    <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 10 }}>
                                        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: '#10b981' }]} onPress={insertLinkToEditor}><Text style={{ color: '#fff', fontWeight: 'bold' }}>تایید</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveOverlay('none')}><Text style={styles.cancelBtnTxt}>انصراف</Text></TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {activeOverlay === 'gallery' && (
                                <View style={[styles.popupBox, { height: '85%', padding: 0, overflow: 'hidden' }]}>
                                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                                        <Text style={styles.popupTitle}>رسانه سایت</Text>
                                        <TouchableOpacity onPress={() => setActiveOverlay('none')}><Feather name="x" size={20} color="#64748b" /></TouchableOpacity>
                                    </View>

                                    {loading && mediaPage === 1 ? <ActivityIndicator size="large" color="#10b981" style={{ margin: 20 }} /> : (
                                        <FlatList
                                            data={media}
                                            numColumns={3}
                                            keyExtractor={(item) => item.id.toString()}
                                            contentContainerStyle={{ padding: 10 }}
                                            renderItem={({ item }) => (
                                                <TouchableOpacity style={styles.imageBtn} onPress={() => insertSelectedWPMedia(item.media_details?.sizes?.large?.source_url || item.source_url)}>
                                                    <Image source={{ uri: item.media_details?.sizes?.thumbnail?.source_url || item.source_url }} style={styles.imageThumb} />
                                                </TouchableOpacity>
                                            )}
                                            ListFooterComponent={() => (
                                                hasMoreMedia ? (
                                                    <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreMedia}>
                                                        {loadingMore ? <ActivityIndicator size="small" color="#10b981" /> : <Text style={styles.loadMoreTxt}>بیشتر...</Text>}
                                                    </TouchableOpacity>
                                                ) : <View style={{ height: 20 }} />
                                            )}
                                        />
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: { width: '100%', marginBottom: 10 },
    inlinePreviewBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12 },
    inlineIconBox: { backgroundColor: '#ecfdf5', padding: 8, borderRadius: 8, marginLeft: 10 },
    inlineTitle: { fontSize: 13, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginBottom: 4 },
    inlineDesc: { fontSize: 11, color: '#64748b', textAlign: 'right' },
    fullScreenHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    fullScreenTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
    confirmBtn: { backgroundColor: '#10b981', padding: 10, borderRadius: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    cancelEditorBtn: { backgroundColor: '#fef2f2', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    toolbar: { backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0', elevation: 5 },
    iconText: { fontWeight: '900', fontSize: 14 },
    absoluteOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 },
    popupBox: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 5 },
    popupTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginBottom: 5 },
    popupSubtitle: { fontSize: 10, color: '#64748b', textAlign: 'right', marginBottom: 15 },
    popupLabel: { fontSize: 11, fontWeight: 'bold', color: '#334155', textAlign: 'right', marginBottom: 5 },
    popupInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 12, color: '#0f172a', marginBottom: 10 },
    sizeBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    sizeBtnTxt: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
    deleteElementBtn: { flexDirection: 'row-reverse', backgroundColor: '#fef2f2', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#fecaca' },
    colorGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 15, justifyContent: 'center' },
    colorCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    cancelBtnTxt: { color: '#64748b', fontWeight: 'bold', fontSize: 12 },
    imageBtn: { flex: 1, margin: 4, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
    imageThumb: { width: '100%', height: '100%' },
    loadMoreBtn: { backgroundColor: '#ecfdf5', padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 15, borderWidth: 1, borderColor: '#a7f3d0' },
    loadMoreTxt: { color: '#10b981', fontWeight: 'bold', fontSize: 12 },
});

export default RichEditorToolbar;