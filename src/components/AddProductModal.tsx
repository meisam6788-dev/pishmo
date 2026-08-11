import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, Image, StyleSheet, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { createWooClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import RichEditorToolbar from './RichEditorToolbar';

interface AddProductModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    productToEdit?: any;
}

const gregorianToJalali = (gy: number, gm: number, gd: number) => {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979; gy -= (gy <= 1600) ? 621 : 1600; const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053; jy += 4 * Math.floor(days / 1461); days %= 1461; jy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy, jm, jd };
};

const jalaliToGregorian = (jy: number, jm: number, jd: number) => {
    let gy = (jy <= 979) ? 621 : 1600; jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor((jy % 33) + 3) / 4 + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * Math.floor(days / 146097); days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
    gy += 4 * Math.floor(days / 1461); days %= 1461; gy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    let gd = days + 1;
    let sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm; for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
    return { gy, gm, gd };
};

const formatToJalali = (gDateString: string) => {
    if (!gDateString) return '';
    const parts = gDateString.split('T')[0].split('-');
    if (parts.length !== 3) return '';
    const j = gregorianToJalali(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
    return `${j.jy}-${String(j.jm).padStart(2, '0')}-${String(j.jd).padStart(2, '0')}`;
};

const formatToGregorian = (jDateString: string) => {
    if (!jDateString) return '';
    const parts = jDateString.split('-');
    if (parts.length !== 3) return '';
    const g = jalaliToGregorian(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
};

export const AddProductModal: React.FC<AddProductModalProps> = ({ visible, onClose, onSuccess, productToEdit }) => {
    const siteUrl = useAuthStore((state: any) => state.siteUrl || state.url || state.domain);
    const [isModalReady, setIsModalReady] = useState(false);

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [sku, setSku] = useState('');
    const [type, setType] = useState<'simple' | 'variable'>('simple');

    const [featuredImage, setFeaturedImage] = useState<{ uri: string, id?: number } | null>(null);
    const [galleryImages, setGalleryImages] = useState<{ uri: string, id?: number }[]>([]);

    const [regularPrice, setRegularPrice] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [stock, setStock] = useState('');

    const [saleDateFrom, setSaleDateFrom] = useState('');
    const [saleDateTo, setSaleDateTo] = useState('');
    const [showSaleDates, setShowSaleDates] = useState(false);

    const [dateModalVisible, setDateModalVisible] = useState(false);
    const [dateTarget, setDateTarget] = useState('');
    const [dYear, setDYear] = useState('');
    const [dMonth, setDMonth] = useState('');
    const [dDay, setDDay] = useState('');

    const [categoriesList, setCategoriesList] = useState<any[]>([]);
    const [tagsList, setTagsList] = useState<any[]>([]);
    const [selectedCats, setSelectedCats] = useState<number[]>([]);
    const [selectedTags, setSelectedTags] = useState<number[]>([]);
    const [showCatAccordion, setShowCatAccordion] = useState(false);
    const [showTagAccordion, setShowTagAccordion] = useState(false);

    const [attributesList, setAttributesList] = useState<any[]>([]);
    const [termsData, setTermsData] = useState<{ [attrId: number]: any[] }>({});
    const [expandedAttributes, setExpandedAttributes] = useState<number[]>([]);
    const [selectedTerms, setSelectedTerms] = useState<{ [key: number]: string[] }>({});
    const [loadingTermsFor, setLoadingTermsFor] = useState<number | null>(null);
    const [showMoreAttrs, setShowMoreAttrs] = useState(false);

    const [variationCombinations, setVariationCombinations] = useState<string[][]>([]);
    const [variationsData, setVariationsData] = useState<{ [comboKey: string]: { id?: number, price: string; salePrice: string; stock: string; enabled: boolean; date_on_sale_from?: string; date_on_sale_to?: string } }>({});
    const [defaultVariation, setDefaultVariation] = useState<string | null>(null);
    const [showBulkEdit, setShowBulkEdit] = useState(false);

    const [bulkPrice, setBulkPrice] = useState('');
    const [bulkSalePrice, setBulkSalePrice] = useState('');
    const [bulkStock, setBulkStock] = useState('');
    const [bulkSaleDateFrom, setBulkSaleDateFrom] = useState('');
    const [bulkSaleDateTo, setBulkSaleDateTo] = useState('');

    const [shortDesc, setShortDesc] = useState('');
    const [fullDesc, setFullDesc] = useState('');

    const [showSeoAccordion, setShowSeoAccordion] = useState(false);
    const [seoTitle, setSeoTitle] = useState('');
    const [seoDesc, setSeoDesc] = useState('');

    const [loading, setLoading] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);

    const [isGalleryVisible, setIsGalleryVisible] = useState(false);
    const [wpMedia, setWpMedia] = useState<any[]>([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [mediaPage, setMediaPage] = useState(1);
    const [galleryTarget, setGalleryTarget] = useState<'featured' | 'gallery' | null>(null);

    const formatPrice = (val: string | number) => { if (!val) return ''; return val.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
    const cleanNumber = (val: string) => val.toString().replace(/\D/g, '');

    useEffect(() => {
        if (visible) {
            const timer = setTimeout(() => {
                setIsModalReady(true);
                fetchTaxonomiesAndAttributes();
                if (productToEdit) loadProductData(productToEdit);
                else resetForm();
            }, 350); 
            return () => clearTimeout(timer);
        } else {
            setIsModalReady(false);
        }
    }, [visible, productToEdit]);

    const loadProductData = async (p: any) => {
        setName(p.name || ''); setSlug(p.slug || ''); setSku(p.sku || ''); setType(p.type || 'simple');
        setRegularPrice(formatPrice(p.regular_price || '')); setSalePrice(formatPrice(p.sale_price || ''));
        setStock(p.stock_quantity !== null && p.stock_quantity !== undefined ? String(p.stock_quantity) : '');
        setShortDesc(p.short_description || ''); setFullDesc(p.description || '');
        setSelectedCats(p.categories ? p.categories.map((c: any) => c.id) : []); setSelectedTags(p.tags ? p.tags.map((t: any) => t.id) : []);

        setSaleDateFrom(formatToJalali(p.date_on_sale_from));
        setSaleDateTo(formatToJalali(p.date_on_sale_to));

        if (p.type === 'variable' && p.attributes && p.attributes.length > 0) {
            const termsMap: { [key: number]: string[] } = {};
            p.attributes.forEach((attr: any) => { if (attr.variation) termsMap[attr.id] = attr.options; });
            setSelectedTerms(termsMap);
            try {
                const client = createWooClient();
                const res = await client.get(`products/${p.id}/variations`, { params: { per_page: 50 } });
                const fetchedVars = res.data || [];
                const newVarData: any = {};
                fetchedVars.forEach((v: any) => {
                    const comboParts = Object.keys(termsMap).map(attrIdStr => { const attrId = parseInt(attrIdStr, 10); const foundAttr = v.attributes.find((a: any) => a.id === attrId); return foundAttr ? foundAttr.option : ''; });
                    const comboKey = comboParts.join(' - ');
                    newVarData[comboKey] = {
                        id: v.id, price: formatPrice(v.regular_price || ''), salePrice: formatPrice(v.sale_price || ''),
                        stock: v.stock_quantity !== null ? String(v.stock_quantity) : '', enabled: v.status !== 'private',
                        date_on_sale_from: formatToJalali(v.date_on_sale_from),
                        date_on_sale_to: formatToJalali(v.date_on_sale_to)
                    };
                });
                setVariationsData(prev => ({ ...prev, ...newVarData }));
                if (p.default_attributes && p.default_attributes.length > 0) {
                    const defParts = Object.keys(termsMap).map(attrIdStr => { const defAttr = p.default_attributes.find((a: any) => a.id === parseInt(attrIdStr)); return defAttr ? defAttr.option : ''; });
                    setDefaultVariation(defParts.join(' - '));
                }
            } catch (error) { }
        } else { setSelectedTerms({}); setDefaultVariation(null); }

        if (p.images && p.images.length > 0) {
            setFeaturedImage({ uri: p.images[0].src, id: p.images[0].id });
            setGalleryImages(p.images.length > 1 ? p.images.slice(1).map((img: any) => ({ uri: img.src, id: img.id })) : []);
        } else { setFeaturedImage(null); setGalleryImages([]); }
    };

    useEffect(() => {
        if (type === 'variable') {
            const activeTermArrays = Object.values(selectedTerms).filter(arr => arr.length > 0);
            if (activeTermArrays.length === 0) { setVariationCombinations([]); return; }
            const generateCombinations = (arrays: string[][]): string[][] => arrays.reduce<string[][]>((acc, curr) => {
                const res: string[][] = []; acc.forEach(a => curr.forEach(c => res.push([...a, c]))); return res;
            }, [[]]);
            const combos = generateCombinations(activeTermArrays);
            setVariationCombinations(combos);
            const newVarData = { ...variationsData };
            combos.forEach(combo => { const key = combo.join(' - '); if (!newVarData[key]) newVarData[key] = { price: regularPrice || '', salePrice: salePrice || '', stock: stock || '', enabled: true }; });
            setVariationsData(newVarData);
        }
    }, [selectedTerms, type]);

    const fetchTaxonomiesAndAttributes = async () => {
        try {
            const client = createWooClient();
            const [catsRes, tagsRes, attrsRes] = await Promise.all([client.get('products/categories', { params: { per_page: 50 } }), client.get('products/tags', { params: { per_page: 50 } }), client.get('products/attributes')]);
            setCategoriesList(catsRes.data || []); setTagsList(tagsRes.data || []); setAttributesList(attrsRes.data || []);
        } catch (e) { }
    };

    const toggleAttributeAccordion = async (attrId: number) => {
        if (expandedAttributes.includes(attrId)) { setExpandedAttributes(expandedAttributes.filter(id => id !== attrId)); }
        else {
            setExpandedAttributes([...expandedAttributes, attrId]);
            if (!termsData[attrId]) {
                setLoadingTermsFor(attrId);
                try { const client = createWooClient(); const res = await client.get(`products/attributes/${attrId}/terms`, { params: { per_page: 100 } }); setTermsData(prev => ({ ...prev, [attrId]: res.data || [] })); } catch (e) { }
                setLoadingTermsFor(null);
            }
        }
    };

    const toggleTermSelection = (attrId: number, termName: string) => {
        const currentTerms = selectedTerms[attrId] || [];
        if (currentTerms.includes(termName)) setSelectedTerms({ ...selectedTerms, [attrId]: currentTerms.filter(t => t !== termName) });
        else setSelectedTerms({ ...selectedTerms, [attrId]: [...currentTerms, termName] });
    };

    const updateVariationField = (comboKey: string, field: string, val: any) => { setVariationsData({ ...variationsData, [comboKey]: { ...variationsData[comboKey], [field]: val } }); };

    const applyBulkEdit = () => {
        const newVarData = { ...variationsData };
        Object.keys(newVarData).forEach(key => {
            if (bulkPrice) newVarData[key].price = formatPrice(cleanNumber(bulkPrice));
            if (bulkSalePrice) newVarData[key].salePrice = formatPrice(cleanNumber(bulkSalePrice));
            if (bulkStock) newVarData[key].stock = cleanNumber(bulkStock);
            if (bulkSaleDateFrom) newVarData[key].date_on_sale_from = bulkSaleDateFrom;
            if (bulkSaleDateTo) newVarData[key].date_on_sale_to = bulkSaleDateTo;
        });
        setVariationsData(newVarData);
        setBulkPrice(''); setBulkSalePrice(''); setBulkStock(''); setBulkSaleDateFrom(''); setBulkSaleDateTo(''); setShowBulkEdit(false);
        Alert.alert('اعمال شد', 'تغییرات روی تمام ترکیب‌ها اعمال شد.');
    };

    const requestImagePermission = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('دسترسی مسدود است', 'برای انتخاب تصویر، باید به گالری گوشی دسترسی بدهید.');
            return false;
        }
        return true;
    };

    const pickFeaturedImage = async () => {
        if (!(await requestImagePermission())) return;
        const result = await ImagePicker.launchImageLibraryAsync({ 
            mediaTypes: 'images' as any, 
            allowsEditing: true, 
            aspect: [1, 1], 
            quality: 1 
        });
        if (!result.canceled && result.assets.length > 0) setFeaturedImage({ uri: result.assets[0].uri });
    };

    const pickGalleryImages = async () => {
        if (!(await requestImagePermission())) return;
        const result = await ImagePicker.launchImageLibraryAsync({ 
            mediaTypes: 'images' as any, 
            allowsMultipleSelection: true, 
            quality: 1 
        });
        if (!result.canceled && result.assets.length > 0) {
            const newImages = result.assets.map(a => ({ uri: a.uri }));
            setGalleryImages([...galleryImages, ...newImages]);
        }
    };

    const toggleSelection = (id: number, list: number[], setter: (val: number[]) => void) => { list.includes(id) ? setter(list.filter(item => item !== id)) : setter([...list, id]); };

    const resetForm = () => {
        setName(''); setSlug(''); setSku(''); setType('simple'); setRegularPrice(''); setSalePrice(''); setStock('');
        setSaleDateFrom(''); setSaleDateTo(''); setShowSaleDates(false);
        setShortDesc(''); setFullDesc(''); setShowSeoAccordion(false); setSeoTitle(''); setSeoDesc('');
        setFeaturedImage(null); setGalleryImages([]); setSelectedTerms({}); setExpandedAttributes([]);
        setVariationsData({}); setVariationCombinations([]); setDefaultVariation(null); setShowMoreAttrs(false);
    };

    // 🌟 ارتباط امن و بی‌واسطه با گالری سایت از طریق ووکامرس (عبور از فایروال)
    const fetchWordPressMedia = async (pageNum = 1) => {
        if (pageNum === 1) { setIsGalleryVisible(true); setWpMedia([]); }
        setLoadingMedia(true);
        try {
            const client = createWooClient();
            // استفاده از مسیر جدید در فضای امنیتی ووکامرس
            const res = await client.get('pishmo/media', { params: { page: pageNum } });
            
            if (Array.isArray(res.data)) { 
                if (pageNum === 1) setWpMedia(res.data); 
                else setWpMedia((prev) => [...prev, ...res.data]); 
                setMediaPage(pageNum); 
            } else {
                Alert.alert('خطا', 'اطلاعات گالری به درستی دریافت نشد.');
            }
        } catch (error) { 
            if (pageNum === 1) Alert.alert('خطا', 'عدم ارتباط با رسانه سایت. لطفاً وضعیت اینترنت را بررسی کنید.'); 
            console.log(error);
        } finally { 
            setLoadingMedia(false); 
        }
    };

    const openImagePicker = (target: 'featured' | 'gallery') => {
        Alert.alert('انتخاب تصویر', 'از کدام منبع می‌خواهید تصویر را انتخاب کنید؟', [
            { text: 'گالری گوشی', onPress: () => target === 'featured' ? pickFeaturedImage() : pickGalleryImages() },
            { text: 'رسانه سایت وردپرس', onPress: () => { setGalleryTarget(target); fetchWordPressMedia(1); } },
            { text: 'انصراف', style: 'cancel' }
        ]);
    };

    const handleSelectWpMedia = (item: any) => {
        if (galleryTarget === 'featured') setFeaturedImage({ uri: item.source_url, id: item.id });
        else if (galleryTarget === 'gallery') setGalleryImages(prev => [...prev, { uri: item.source_url, id: item.id }]);
        setIsGalleryVisible(false);
    };

    // 🌟 آپلود امن و قدرتمند عکس از طریق تونل ووکامرس
    const uploadImageToWordPress = async (uri: string): Promise<any | null> => {
        try {
            const manipulated = await (ImageManipulator as any).manipulateAsync(
                uri,
                [{ resize: { width: 1000, height: 1000 } }],
                { compress: 0.3, format: (ImageManipulator as any).SaveFormat.WEBP, base64: true }
            );

            const client = createWooClient();
            const res = await client.post('pishmo/upload-image', {
                image_base64: manipulated.base64,
                file_name: `product-${Date.now()}.webp`
            });
            
            if (res.data && res.data.success && res.data.attachment_id) {
                return { id: res.data.attachment_id };
            }
            return null;
        } catch (e: any) {
            console.log('Upload error', e);
            return null;
        }
    };

    const openDatePicker = (target: string, currentValue: string) => {
        setDateTarget(target);
        if (currentValue) {
            const parts = currentValue.split('-');
            if (parts.length === 3) { setDYear(parts[0]); setDMonth(parts[1]); setDDay(parts[2]); }
        } else {
            const today = new Date();
            const j = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
            setDYear(String(j.jy)); setDMonth(String(j.jm).padStart(2, '0')); setDDay(String(j.jd).padStart(2, '0'));
        }
        setDateModalVisible(true);
    };

    const confirmDate = () => {
        const formatted = `${dYear}-${dMonth.padStart(2, '0')}-${dDay.padStart(2, '0')}`;
        if (dateTarget === 'simpleFrom') setSaleDateFrom(formatted);
        if (dateTarget === 'simpleTo') setSaleDateTo(formatted);
        if (dateTarget === 'bulkFrom') setBulkSaleDateFrom(formatted);
        if (dateTarget === 'bulkTo') setBulkSaleDateTo(formatted);
        setDateModalVisible(false);
    };

    const handleSubmit = async () => {
        if (!name.trim()) { Alert.alert('خطا', 'نام محصول الزامی است'); return; }
        const rawRegular = parseInt(cleanNumber(regularPrice), 10) || 0;
        const rawSale = parseInt(cleanNumber(salePrice), 10) || 0;

        setLoading(true);
        try {
            const client = createWooClient();
            let imageObjects: any[] = [];

            if (featuredImage || galleryImages.length > 0) {
                setUploadingMedia(true);
                const uploadPromises = [];

                if (featuredImage) {
                    if (featuredImage.id) uploadPromises.push(Promise.resolve({ id: featuredImage.id, isFeatured: true }));
                    else uploadPromises.push(uploadImageToWordPress(featuredImage.uri).then(res => { if (res) res.isFeatured = true; return res; }));
                }

                galleryImages.forEach(img => {
                    if (img.id) uploadPromises.push(Promise.resolve({ id: img.id, isFeatured: false }));
                    else uploadPromises.push(uploadImageToWordPress(img.uri).then(res => { if (res) res.isFeatured = false; return res; }));
                });

                const uploadedResults = await Promise.all(uploadPromises);
                uploadedResults.forEach(img => {
                    if (img) {
                        if (img.isFeatured) imageObjects.unshift({ id: img.id });
                        else imageObjects.push({ id: img.id });
                    }
                });
                setUploadingMedia(false);
            }

            const formattedAttributes: any[] = [];
            if (type === 'variable') {
                Object.keys(selectedTerms).forEach((attrIdStr) => {
                    const attrId = parseInt(attrIdStr, 10);
                    const terms = selectedTerms[attrId];
                    const attrObj = attributesList.find(a => a.id === attrId);
                    if (attrObj && terms && terms.length > 0) formattedAttributes.push({ id: attrObj.id, name: attrObj.name, position: 0, visible: true, variation: true, options: terms });
                });
            }

            const metaData: any[] = [];
            if (seoTitle) { metaData.push({ key: 'rank_math_title', value: seoTitle }); metaData.push({ key: '_yoast_wpseo_title', value: seoTitle }); }
            if (seoDesc) { metaData.push({ key: 'rank_math_description', value: seoDesc }); metaData.push({ key: '_yoast_wpseo_metadesc', value: seoDesc }); }

            const productPayload: any = {
                name: name.trim(), type: type, sku: sku.trim(),
                regular_price: type === 'simple' ? (rawRegular ? rawRegular.toString() : '0') : '',
                sale_price: type === 'simple' ? (rawSale ? rawSale.toString() : '') : '',
                manage_stock: type === 'simple' ? true : false,
                stock_quantity: type === 'simple' ? parseInt(stock, 10) || undefined : undefined,
                stock_status: type === 'simple' ? ((parseInt(stock, 10) || 0) > 0 ? 'instock' : 'outofstock') : 'instock',
                short_description: shortDesc, description: fullDesc, slug: slug.trim(),
                categories: selectedCats.map(id => ({ id })), tags: selectedTags.map(id => ({ id })),
                attributes: formattedAttributes, status: 'publish',
            };

            if (type === 'simple' && rawSale) {
                productPayload.date_on_sale_from = saleDateFrom ? `${formatToGregorian(saleDateFrom)}T00:00:00` : '';
                productPayload.date_on_sale_to = saleDateTo ? `${formatToGregorian(saleDateTo)}T23:59:59` : '';
            }

            if (imageObjects.length > 0) productPayload.images = imageObjects;

            if (type === 'variable' && defaultVariation) {
                const activeAttrIds = Object.keys(selectedTerms).map(id => parseInt(id, 10));
                const parts = defaultVariation.split(' - ');
                productPayload.default_attributes = activeAttrIds.map((attrId, idx) => ({ id: attrId, name: attributesList.find(a => a.id === attrId)?.name, option: parts[idx] }));
            }

            let parentId;
            if (productToEdit) { const res = await client.put(`products/${productToEdit.id}`, productPayload); parentId = res.data.id; }
            else { const res = await client.post('products', productPayload); parentId = res.data.id; }

            if (type === 'variable' && parentId && variationCombinations.length > 0) {
                const activeAttrIds = Object.keys(selectedTerms).map(id => parseInt(id, 10));
                const createBatch: any[] = [];
                const updateBatch: any[] = [];

                for (const combo of variationCombinations) {
                    const comboKey = combo.join(' - '); const varInfo = variationsData[comboKey];
                    const cleanVarPrice = cleanNumber(varInfo.price) || '0';
                    const cleanVarSale = cleanNumber(varInfo.salePrice) || '';
                    const cleanVarStock = parseInt(varInfo.stock, 10) || 0;

                    const varPayload: any = {
                        regular_price: cleanVarPrice, sale_price: cleanVarSale, manage_stock: true,
                        stock_quantity: cleanVarStock, stock_status: cleanVarStock > 0 ? 'instock' : 'outofstock',
                        attributes: combo.map((termName, index) => ({ id: activeAttrIds[index] || 0, option: termName })),
                        status: varInfo.enabled ? 'publish' : 'private'
                    };

                    if (cleanVarSale) {
                        varPayload.date_on_sale_from = varInfo.date_on_sale_from ? `${formatToGregorian(varInfo.date_on_sale_from)}T00:00:00` : '';
                        varPayload.date_on_sale_to = varInfo.date_on_sale_to ? `${formatToGregorian(varInfo.date_on_sale_to)}T23:59:59` : '';
                    }

                    if (varInfo.id) {
                        varPayload.id = varInfo.id;
                        updateBatch.push(varPayload);
                    } else {
                        createBatch.push(varPayload);
                    }
                }

                if (createBatch.length > 0 || updateBatch.length > 0) {
                    await client.post(`products/${parentId}/variations/batch`, {
                        create: createBatch.length > 0 ? createBatch : undefined,
                        update: updateBatch.length > 0 ? updateBatch : undefined
                    });
                }
            }

            Alert.alert('تبریک 🎉', productToEdit ? `کالا بروزرسانی شد!` : `کالا منتشر شد!`);
            resetForm(); onSuccess();
        } catch (error: any) {
            Alert.alert('خطا در ارتباط', 'لطفاً اینترنت خود را بررسی کنید.');
        } finally { setLoading(false); setUploadingMedia(false); }
    };

    const activeAttributes = attributesList.filter(attr => selectedTerms[attr.id] && selectedTerms[attr.id].length > 0);
    const inactiveAttributes = attributesList.filter(attr => !selectedTerms[attr.id] || selectedTerms[attr.id].length === 0);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { resetForm(); onClose(); }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'flex-end' }}>
                <StatusBar barStyle="light-content" />
                <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '88%', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20, elevation: 15, flex: 1 }}>

                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingHorizontal: 20 }}>
                        <View style={{ flex: 1, paddingLeft: 15 }}>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a', textAlign: 'right', lineHeight: 22 }} numberOfLines={2}>
                                {productToEdit ? `ویرایش: ${productToEdit.name}` : 'افزودن کالا جدید'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => { resetForm(); onClose(); }} style={{ padding: 6 }}>
                            <Feather name="x" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {!isModalReady ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#10b981" />
                            <Text style={{ marginTop: 15, fontSize: 14, fontWeight: 'bold', color: '#64748b' }}>در حال آماده‌سازی محیط ویرایش...</Text>
                        </View>
                    ) : (
                        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 20 }}>

                            <View style={{ marginBottom: 18 }}>
                                <Text style={styles.sectionLabel}>تصویر شاخص و گالری:</Text>
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <View style={{ flex: 1, marginLeft: 6 }}>
                                        {featuredImage ? (
                                            <View style={styles.imgBox}><Image source={{ uri: featuredImage.uri }} style={styles.img} /><TouchableOpacity onPress={() => setFeaturedImage(null)} style={styles.delImg}><Feather name="trash-2" size={14} color="#ffffff" /></TouchableOpacity></View>
                                        ) : (
                                            <TouchableOpacity onPress={() => openImagePicker('featured')} style={styles.imgPlaceholder}>
                                                <Feather name="camera" size={26} color="#96588a" />
                                                <Text style={styles.imgTxt}>+ تصویر شاخص</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <View style={{ flex: 1, marginRight: 6 }}>
                                        <TouchableOpacity onPress={() => openImagePicker('gallery')} style={[styles.imgPlaceholder, { borderColor: '#cbd5e1' }]}>
                                            <Feather name="copy" size={26} color="#475569" />
                                            <Text style={[styles.imgTxt, { color: '#475569' }]}>+ گالری</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                {galleryImages.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse' }}>
                                        {galleryImages.map((imgObj, idx) => (
                                            <View key={idx} style={styles.galBox}><Image source={{ uri: imgObj.uri }} style={styles.img} /><TouchableOpacity onPress={() => setGalleryImages(galleryImages.filter((_, i) => i !== idx))} style={styles.delGal}><Feather name="x" size={12} color="#ffffff" /></TouchableOpacity></View>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>

                            <View style={styles.inputGroup}><Text style={styles.label}>نام کالا *</Text><TextInput style={styles.input} value={name} onChangeText={setName} /></View>
                            <View style={styles.inputGroup}><Text style={styles.label}>پیوند یکتا (سئو)</Text><TextInput style={[styles.input, { textAlign: 'left' }]} value={slug} onChangeText={setSlug} /></View>
                            <View style={styles.inputGroup}><Text style={styles.label}>شناسه انبار (SKU)</Text><TextInput style={[styles.input, { textAlign: 'left' }]} value={sku} onChangeText={setSku} /></View>

                            <View style={styles.typeContainer}>
                                <TouchableOpacity onPress={() => setType('simple')} style={[styles.typeBtn, type === 'simple' && styles.typeBtnActive]}>
                                    <Text style={[styles.typeBtnTxt, type === 'simple' && { color: '#fff' }]} numberOfLines={1} adjustsFontSizeToFit>محصول ساده</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setType('variable')} style={[styles.typeBtn, type === 'variable' && styles.typeBtnActive]}>
                                    <Text style={[styles.typeBtnTxt, type === 'variable' && { color: '#fff' }]} numberOfLines={1} adjustsFontSizeToFit>محصول‌متغیر</Text>
                                </TouchableOpacity>
                            </View>

                            {type === 'simple' && (
                                <View style={styles.simpleContainer}>
                                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 14 }}>
                                        <View style={{ flex: 1, marginLeft: 6 }}><Text style={styles.label}>قیمت عادی</Text><TextInput style={[styles.input, { textAlign: 'left' }]} value={regularPrice} onChangeText={(val) => setRegularPrice(formatPrice(cleanNumber(val)))} keyboardType="numeric" /></View>
                                        <View style={{ flex: 1, marginRight: 6 }}><Text style={styles.label}>موجودی</Text><TextInput style={[styles.input, { textAlign: 'left' }]} value={stock} onChangeText={setStock} keyboardType="numeric" /></View>
                                    </View>

                                    <View style={styles.saleBox}>
                                        <Text style={styles.saleTitle}>🔥 قیمت حراج ویژه</Text>
                                        <TextInput style={[styles.input, { borderColor: '#fda4af', color: '#e11d48', textAlign: 'left', marginBottom: 10 }]} value={salePrice} onChangeText={(val) => setSalePrice(formatPrice(cleanNumber(val)))} keyboardType="numeric" />
                                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 }}>
                                            <TouchableOpacity style={styles.dateInputBox} onPress={() => openDatePicker('simpleFrom', saleDateFrom)}>
                                                <Feather name="calendar" size={16} color="#475569" />
                                                <Text style={styles.dateInputTxt}>{saleDateFrom || 'شروع حراج'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.dateInputBox} onPress={() => openDatePicker('simpleTo', saleDateTo)}>
                                                <Feather name="calendar" size={16} color="#475569" />
                                                <Text style={styles.dateInputTxt}>{saleDateTo || 'پایان حراج'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {type === 'variable' && (
                                <View style={styles.varContainer}>
                                    <Text style={styles.sectionLabel}>⚙️ ویژگی‌های فعال:</Text>
                                    {activeAttributes.length === 0 ? <Text style={styles.emptyTxt}>هیچ ویژگی فعالی ندارید.</Text> : (
                                        activeAttributes.map((attr) => {
                                            const isExpanded = expandedAttributes.includes(attr.id);
                                            const selectedCount = (selectedTerms[attr.id] || []).length;
                                            const sortedTerms = [...(termsData[attr.id] || [])].sort((a, b) => {
                                                const aSel = (selectedTerms[attr.id] || []).includes(a.name);
                                                const bSel = (selectedTerms[attr.id] || []).includes(b.name);
                                                if (aSel && !bSel) return -1; if (!aSel && bSel) return 1; return 0;
                                            });
                                            return (
                                                <View key={attr.id} style={styles.accordionBox}>
                                                    <TouchableOpacity onPress={() => toggleAttributeAccordion(attr.id)} style={styles.accordionHeader}>
                                                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                                                            <Text style={styles.accordionTitle}>{attr.name}</Text>
                                                            {selectedCount > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{selectedCount} انتخاب</Text></View>}
                                                        </View>
                                                        <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#475569" />
                                                    </TouchableOpacity>
                                                    {isExpanded && (
                                                        <View style={styles.accordionBody}>
                                                            {loadingTermsFor === attr.id ? <ActivityIndicator color="#96588a" /> : (
                                                                <View style={styles.termsGrid}>
                                                                    {sortedTerms.map((term: any) => {
                                                                        const isChecked = (selectedTerms[attr.id] || []).includes(term.name);
                                                                        return (
                                                                            <TouchableOpacity key={term.id} onPress={() => toggleTermSelection(attr.id, term.name)} style={[styles.termBtn, isChecked && styles.termBtnActive]}>
                                                                                <Text style={[styles.termTxt, isChecked && styles.termTxtActive]}>{term.name}</Text>
                                                                        </TouchableOpacity>
                                                                        );
                                                                    })}
                                                                </View>
                                                            )}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })
                                    )}
                                    {inactiveAttributes.length > 0 && (
                                        <TouchableOpacity onPress={() => setShowMoreAttrs(!showMoreAttrs)} style={styles.moreAttrsBtn}>
                                            <Text style={styles.moreAttrsTxt}>{showMoreAttrs ? "بستن ویژگی‌های دیگر" : "+ سایر ویژگی‌ها (رنگ، سایز و...)"}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {showMoreAttrs && inactiveAttributes.map((attr) => {
                                        const isExpanded = expandedAttributes.includes(attr.id);
                                        return (
                                            <View key={attr.id} style={[styles.accordionBox, { opacity: 0.8 }]}>
                                                <TouchableOpacity onPress={() => toggleAttributeAccordion(attr.id)} style={styles.accordionHeader}>
                                                    <Text style={styles.accordionTitle}>{attr.name}</Text>
                                                    <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#475569" />
                                                </TouchableOpacity>
                                                {isExpanded && (
                                                    <View style={styles.accordionBody}>
                                                        {loadingTermsFor === attr.id ? <ActivityIndicator color="#96588a" /> : (
                                                            <View style={styles.termsGrid}>
                                                                {(termsData[attr.id] || []).map((term: any) => {
                                                                    const isChecked = (selectedTerms[attr.id] || []).includes(term.name);
                                                                    return (
                                                                        <TouchableOpacity key={term.id} onPress={() => toggleTermSelection(attr.id, term.name)} style={[styles.termBtn, isChecked && styles.termBtnActive]}>
                                                                            <Text style={[styles.termTxt, isChecked && styles.termTxtActive]}>{term.name}</Text>
                                                                        </TouchableOpacity>
                                                                    );
                                                                })}
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                    {variationCombinations.length > 0 && (
                                        <View style={{ marginTop: 20 }}>
                                            <Text style={[styles.sectionLabel, { color: '#6b21a8' }]}>💰 تنظیم ترکیب‌ها ({variationCombinations.length} تنوع):</Text>
                                            <View style={styles.accordionBox}>
                                                <TouchableOpacity onPress={() => setShowBulkEdit(!showBulkEdit)} style={[styles.accordionHeader, { backgroundColor: '#f1f5f9' }]}>
                                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#475569' }}>⚡ ویرایش هم‌زمان (Bulk Edit)</Text>
                                                    <Feather name={showBulkEdit ? 'chevron-up' : 'chevron-down'} size={18} color="#475569" />
                                                </TouchableOpacity>
                                                {showBulkEdit && (
                                                    <View style={[styles.accordionBody, { backgroundColor: '#f8fafc' }]}>
                                                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
                                                            <TextInput style={[styles.miniInput, { flex: 1, marginLeft: 4 }]} placeholder="قیمت عادی" value={bulkPrice} onChangeText={setBulkPrice} keyboardType="numeric" />
                                                            <TextInput style={[styles.miniInput, { flex: 1, marginHorizontal: 4, borderColor: '#fda4af' }]} placeholder="حراج" value={bulkSalePrice} onChangeText={setBulkSalePrice} keyboardType="numeric" />
                                                            <TextInput style={[styles.miniInput, { flex: 0.8, marginRight: 4 }]} placeholder="موجودی" value={bulkStock} onChangeText={setBulkStock} keyboardType="numeric" />
                                                        </View>

                                                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
                                                            <TouchableOpacity style={styles.dateInputBox} onPress={() => openDatePicker('bulkFrom', bulkSaleDateFrom)}>
                                                                <Feather name="calendar" size={16} color="#475569" />
                                                                <Text style={styles.dateInputTxt}>{bulkSaleDateFrom || 'شروع حراج'}</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity style={styles.dateInputBox} onPress={() => openDatePicker('bulkTo', bulkSaleDateTo)}>
                                                                <Feather name="calendar" size={16} color="#475569" />
                                                                <Text style={styles.dateInputTxt}>{bulkSaleDateTo || 'پایان حراج'}</Text>
                                                            </TouchableOpacity>
                                                        </View>

                                                        <TouchableOpacity onPress={applyBulkEdit} style={styles.bulkBtn}><Text style={styles.bulkBtnTxt}>اعمال روی همه</Text></TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                            {variationCombinations.map((combo, idx) => {
                                                const comboKey = combo.join(' - ');
                                                const varInfo = variationsData[comboKey] || { price: '', salePrice: '', stock: '', enabled: true };
                                                const isDefault = defaultVariation === comboKey;
                                                return (
                                                    <View key={idx} style={[styles.compactRow, !varInfo.enabled && { opacity: 0.6, backgroundColor: '#f1f5f9' }]}>
                                                        <View style={styles.compactHeader}>
                                                            <Text style={styles.compactTitle} numberOfLines={1}>{comboKey}</Text>
                                                            <View style={{ flexDirection: 'row-reverse' }}>
                                                                <TouchableOpacity onPress={() => setDefaultVariation(isDefault ? null : comboKey)} style={{ marginLeft: 10 }}>
                                                                    <Feather name="star" size={16} color={isDefault ? '#f59e0b' : '#cbd5e1'} />
                                                                </TouchableOpacity>
                                                                <TouchableOpacity onPress={() => updateVariationField(comboKey, 'enabled', !varInfo.enabled)}>
                                                                    <Feather name={varInfo.enabled ? "eye" : "eye-off"} size={16} color={varInfo.enabled ? "#10b981" : "#ef4444"} />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <TextInput style={[styles.miniInput, { flex: 1.2, marginLeft: 4 }]} value={varInfo.price} onChangeText={(val) => updateVariationField(comboKey, 'price', formatPrice(cleanNumber(val)))} keyboardType="numeric" placeholder="قیمت" />
                                                            <TextInput style={[styles.miniInput, { flex: 1.2, marginHorizontal: 4, borderColor: '#fda4af', color: '#e11d48' }]} value={varInfo.salePrice} onChangeText={(val) => updateVariationField(comboKey, 'salePrice', formatPrice(cleanNumber(val)))} keyboardType="numeric" placeholder="حراج" />
                                                            <TextInput style={[styles.miniInput, { flex: 0.8, marginRight: 4, textAlign: 'center' }]} value={varInfo.stock} onChangeText={(val) => updateVariationField(comboKey, 'stock', cleanNumber(val))} keyboardType="numeric" placeholder="تعداد" />
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            )}

                            <View style={styles.accordionBox}>
                                <TouchableOpacity onPress={() => setShowCatAccordion(!showCatAccordion)} style={styles.accordionHeader}>
                                    <Text style={styles.accordionTitle}>📂 انتخاب دسته‌بندی‌ها ({selectedCats.length})</Text>
                                    <Feather name={showCatAccordion ? 'chevron-up' : 'chevron-down'} size={18} color="#475569" />
                                </TouchableOpacity>
                                {showCatAccordion && (
                                    <View style={styles.accordionBody}>
                                        {categoriesList.map((cat) => (
                                            <TouchableOpacity key={cat.id} onPress={() => toggleSelection(cat.id, selectedCats, setSelectedCats)} style={styles.checkRow}>
                                                <Feather name={selectedCats.includes(cat.id) ? 'check-square' : 'square'} size={18} color={selectedCats.includes(cat.id) ? '#10b981' : '#94a3b8'} style={{ marginLeft: 8 }} />
                                                <Text style={styles.checkTxt}>{cat.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={styles.accordionBox}>
                                <TouchableOpacity onPress={() => setShowTagAccordion(!showTagAccordion)} style={styles.accordionHeader}>
                                    <Text style={styles.accordionTitle}>🏷️ انتخاب برچسب‌ها ({selectedTags.length})</Text>
                                    <Feather name={showTagAccordion ? 'chevron-up' : 'chevron-down'} size={18} color="#475569" />
                                </TouchableOpacity>
                                {showTagAccordion && (
                                    <View style={styles.accordionBody}>
                                        {tagsList.map((tag) => (
                                            <TouchableOpacity key={tag.id} onPress={() => toggleSelection(tag.id, selectedTags, setSelectedTags)} style={styles.checkRow}>
                                                <Feather name={selectedTags.includes(tag.id) ? 'check-square' : 'square'} size={18} color={selectedTags.includes(tag.id) ? '#10b981' : '#94a3b8'} style={{ marginLeft: 8 }} />
                                                <Text style={styles.checkTxt}>{tag.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={{ marginBottom: 24, marginTop: 10 }}>
                                <Text style={styles.sectionLabel}>توضیحات کوتاه محصول:</Text>
                                <RichEditorToolbar title="توضیحات کوتاه" content={shortDesc} onChange={setShortDesc} siteUrl={siteUrl} />
                                
                                <View style={{ height: 15 }} />
                                
                                <Text style={styles.sectionLabel}>توضیحات کامل محصول:</Text>
                                <RichEditorToolbar title="توضیحات کامل" content={fullDesc} onChange={setFullDesc} siteUrl={siteUrl} />
                            </View>

                            <View style={{ backgroundColor: '#ecfdf5', borderRadius: 16, borderWidth: 1, borderColor: '#a7f3d0', marginBottom: 24, overflow: 'hidden' }}>
                                <TouchableOpacity onPress={() => setShowSeoAccordion(!showSeoAccordion)} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#d1fae5' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#065f46' }}>🚀 تنظیمات سئو</Text>
                                    <Feather name={showSeoAccordion ? 'chevron-up' : 'chevron-down'} size={18} color="#065f46" />
                                </TouchableOpacity>
                                {showSeoAccordion && (
                                    <View style={{ padding: 12 }}>
                                        <Text style={{ fontSize: 11, color: '#047857', textAlign: 'right', marginBottom: 6 }}>عنوان سئو:</Text>
                                        <TextInput style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#6ee7b7', borderRadius: 10, padding: 10, fontSize: 13, textAlign: 'right', marginBottom: 10 }} value={seoTitle} onChangeText={setSeoTitle} />
                                        <Text style={{ fontSize: 11, color: '#047857', textAlign: 'right', marginBottom: 6 }}>توضیحات متا:</Text>
                                        <TextInput style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#6ee7b7', borderRadius: 10, padding: 10, fontSize: 13, textAlign: 'right', height: 65, textAlignVertical: 'top' }} value={seoDesc} onChangeText={setSeoDesc} multiline />
                                    </View>
                                )}
                            </View>

                            <View style={styles.submitContainer}>
                                <TouchableOpacity onPress={handleSubmit} disabled={loading} style={styles.submitBtnNarrow}>
                                    {loading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.submitBtnTxtNarrow}>{uploadingMedia ? 'آپلود تصاویر...' : 'تایید'}</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { resetForm(); onClose(); }} disabled={loading} style={styles.cancelBtnNarrow}>
                                    <Text style={styles.cancelBtnTxtNarrow}>انصراف</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    )}

                    <Modal visible={dateModalVisible} animationType="fade" transparent>
                        <View style={styles.modalOverlayDate}>
                            <View style={styles.datePickerBox}>
                                <Text style={{ fontSize: 15, fontWeight: '900', textAlign: 'center', marginBottom: 20, color: '#0f172a' }}>انتخاب تاریخ شمسی</Text>
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 25, paddingHorizontal: 10 }}>
                                    <View style={{ alignItems: 'center' }}><Text style={styles.miniLabel}>روز</Text><TextInput style={[styles.input, { width: 60, textAlign: 'center', padding: 8 }]} value={dDay} onChangeText={setDDay} keyboardType="numeric" maxLength={2} /></View>
                                    <Text style={{ fontSize: 24, color: '#cbd5e1', marginTop: 15 }}>/</Text>
                                    <View style={{ alignItems: 'center' }}><Text style={styles.miniLabel}>ماه</Text><TextInput style={[styles.input, { width: 60, textAlign: 'center', padding: 8 }]} value={dMonth} onChangeText={setDMonth} keyboardType="numeric" maxLength={2} /></View>
                                    <Text style={{ fontSize: 24, color: '#cbd5e1', marginTop: 15 }}>/</Text>
                                    <View style={{ alignItems: 'center' }}><Text style={styles.miniLabel}>سال</Text><TextInput style={[styles.input, { width: 80, textAlign: 'center', padding: 8 }]} value={dYear} onChangeText={setDYear} keyboardType="numeric" maxLength={4} /></View>
                                </View>
                                <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                                    <TouchableOpacity style={[styles.submitBtnNarrow, { flex: 1 }]} onPress={confirmDate}><Text style={styles.submitBtnTxtNarrow}>تایید تاریخ</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.cancelBtnNarrow, { flex: 1 }]} onPress={() => { setDateModalVisible(false); setDateTarget(''); }}><Text style={styles.cancelBtnTxtNarrow}>بستن</Text></TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    <Modal visible={isGalleryVisible} animationType="slide" onRequestClose={() => setIsGalleryVisible(false)}>
                        <View style={styles.galleryContainer}>
                            <View style={styles.galleryHeader}>
                                <TouchableOpacity onPress={() => setIsGalleryVisible(false)} style={styles.galleryCloseBtn}><Feather name="x" size={24} color="#334155" /></TouchableOpacity>
                                <Text style={styles.galleryTitle}>گالری رسانه سایت شما</Text>
                            </View>
                            {loadingMedia && wpMedia.length === 0 ? (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color="#10b981" />
                                    <Text style={{ marginTop: 10, color: '#64748b', fontWeight: 'bold' }}>در حال دریافت تصاویر سایت...</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={wpMedia}
                                    keyExtractor={(item, index) => `${item.id}-${index}`}
                                    numColumns={3}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity style={styles.galleryImageBtn} onPress={() => handleSelectWpMedia(item)}>
                                            <Image source={{ uri: item.source_url }} style={styles.galleryImage} />
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: '#94a3b8' }}>هیچ تصویری یافت نشد.</Text>}
                                    ListFooterComponent={
                                        wpMedia.length >= mediaPage * 40 ? (
                                            <TouchableOpacity onPress={() => fetchWordPressMedia(mediaPage + 1)} style={styles.loadMoreBtn}>
                                                {loadingMedia ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.loadMoreTxt}>نمایش تصاویر بیشتر...</Text>}
                                            </TouchableOpacity>
                                        ) : null
                                    }
                                />
                            )}
                        </View>
                    </Modal>

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    sectionLabel: { fontSize: 13, fontWeight: '900', color: '#1e293b', textAlign: 'right', marginBottom: 10 },
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 6 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, textAlign: 'right', fontWeight: 'bold', color: '#0f172a' },
    imgBox: { height: 110, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#cbd5e1' },
    img: { width: '100%', height: '100%', resizeMode: 'cover' },
    delImg: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 6, borderRadius: 10 },
    imgPlaceholder: { height: 110, backgroundColor: '#f3e8ff', borderRadius: 16, borderWidth: 2, borderColor: '#d8b4fe', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    imgTxt: { color: '#6b21a8', fontWeight: 'bold', fontSize: 11, marginTop: 6 },
    galBox: { width: 65, height: 65, borderRadius: 12, overflow: 'hidden', marginLeft: 8, borderWidth: 1, borderColor: '#cbd5e1' },
    delGal: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 4, borderRadius: 6 },

    simpleContainer: { marginBottom: 16 },
    saleBox: { backgroundColor: '#fff1f2', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#fecdd3' },
    saleTitle: { fontSize: 12, fontWeight: 'bold', color: '#e11d48', marginBottom: 8, textAlign: 'right' },

    dateInputBox: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, justifyContent: 'space-between' },
    dateInputTxt: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
    modalOverlayDate: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 20 },
    datePickerBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, elevation: 10 },

    varContainer: { backgroundColor: '#f5f3ff', padding: 12, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#ddd6fe' },
    emptyTxt: { fontSize: 12, color: '#64748b', textAlign: 'center' },
    accordionBox: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 10, overflow: 'hidden' },
    accordionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc' },
    accordionTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
    accordionBody: { padding: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    badge: { backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
    badgeTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    termsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
    termBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 8, marginBottom: 8, borderWidth: 1, borderColor: '#cbd5e1' },
    termBtnActive: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
    termTxt: { fontSize: 12, color: '#475569', fontWeight: 'bold' },
    termTxtActive: { color: '#6b21a8' },

    moreAttrsBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 10, marginTop: 4, marginBottom: 10, backgroundColor: '#f3e8ff', borderRadius: 8 },
    moreAttrsTxt: { color: '#6b21a8', fontSize: 11, fontWeight: 'bold' },

    compactRow: { backgroundColor: '#ffffff', padding: 10, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e9d5ff' },
    compactHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    compactTitle: { fontSize: 12, fontWeight: '900', color: '#0f172a', flex: 1, textAlign: 'right' },
    miniInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 12, textAlign: 'left', fontWeight: 'bold', color: '#0f172a' },
    miniLabel: { fontSize: 10, color: '#64748b', fontWeight: 'bold', marginBottom: 4 },
    bulkBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 15 },
    bulkTitle: { fontSize: 11, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 8 },
    bulkBtn: { backgroundColor: '#94a3b8', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    bulkBtnTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    checkRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    checkTxt: { fontSize: 13, color: '#334155', fontWeight: 'bold' },

    submitContainer: { flexDirection: 'row-reverse', marginTop: 10, marginBottom: 20, gap: 10 },
    submitBtnNarrow: { flex: 2, backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center', elevation: 1 },
    submitBtnTxtNarrow: { color: '#ffffff', fontWeight: '900', fontSize: 14 },
    cancelBtnNarrow: { flex: 1, backgroundColor: '#fef2f2', paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
    cancelBtnTxtNarrow: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },

    galleryContainer: { flex: 1, backgroundColor: '#f8fafc', paddingBottom: 20 },
    galleryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    galleryTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    galleryCloseBtn: { padding: 4 },
    galleryImageBtn: { flex: 1, aspectRatio: 1, margin: 4, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#cbd5e1' },
    galleryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    loadMoreBtn: { backgroundColor: '#10b981', padding: 12, borderRadius: 12, margin: 16, alignItems: 'center', elevation: 2 },
    loadMoreTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    typeContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 16, backgroundColor: '#f8fafc', padding: 6, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    typeBtnActive: { backgroundColor: '#10b981' },
    typeBtnTxt: { color: '#475569', fontWeight: 'bold', fontSize: 13 }
});