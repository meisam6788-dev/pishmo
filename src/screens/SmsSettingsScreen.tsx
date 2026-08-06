import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import axios from 'axios';

export const SmsSettingsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const [smsEnabled, setSmsEnabled] = useState(true);
    const [apiUrl, setApiUrl] = useState('');
    const [authMethod, setAuthMethod] = useState<'apikey' | 'userpass'>('apikey');
    const [apiKey, setApiKey] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [senderNumber, setSenderNumber] = useState('');

    const [patterns, setPatterns] = useState<any[]>([
        { id: 'complete_order', title: 'تکمیل سفارش', code: '', variables: 'name=[first_name]&order_id=[order_id]' }
    ]);

    const [testPhone, setTestPhone] = useState('');
    const [guideAccordion, setGuideAccordion] = useState(false);
    const [activePreset, setActivePreset] = useState<string>('');

    useEffect(() => {
        const loadSmsSettings = async () => {
            try {
                const s_enabled = await AsyncStorage.getItem('@sms_enabled'); if (s_enabled !== null) setSmsEnabled(s_enabled === 'true');
                const s_url = await AsyncStorage.getItem('@sms_api_url'); if (s_url) setApiUrl(s_url);
                const s_method = await AsyncStorage.getItem('@sms_auth_method'); if (s_method) setAuthMethod(s_method as any);
                const s_key = await AsyncStorage.getItem('@sms_api_key'); if (s_key) setApiKey(s_key);
                const s_user = await AsyncStorage.getItem('@sms_username'); if (s_user) setUsername(s_user);
                const s_pass = await AsyncStorage.getItem('@sms_password'); if (s_pass) setPassword(s_pass);
                const s_sender = await AsyncStorage.getItem('@sms_sender_num'); if (s_sender) setSenderNumber(s_sender);
                const s_patterns = await AsyncStorage.getItem('@sms_patterns'); if (s_patterns) setPatterns(JSON.parse(s_patterns));
                const s_preset = await AsyncStorage.getItem('@sms_active_preset'); if (s_preset) setActivePreset(s_preset);
            } catch (error) { } finally { setLoading(false); }
        };
        loadSmsSettings();
    }, []);

    const saveSettings = async () => {
        setSaving(true);
        try {
            await AsyncStorage.setItem('@sms_enabled', String(smsEnabled));
            await AsyncStorage.setItem('@sms_api_url', apiUrl);
            await AsyncStorage.setItem('@sms_auth_method', authMethod);
            await AsyncStorage.setItem('@sms_api_key', apiKey);
            await AsyncStorage.setItem('@sms_username', username);
            await AsyncStorage.setItem('@sms_password', password);
            await AsyncStorage.setItem('@sms_sender_num', senderNumber);
            await AsyncStorage.setItem('@sms_patterns', JSON.stringify(patterns));
            await AsyncStorage.setItem('@sms_active_preset', activePreset);
            Alert.alert('موفقیت', 'تنظیمات پیامک و پترن‌ها با موفقیت ذخیره شد.');
        } catch (error) { Alert.alert('خطا', 'مشکلی در ذخیره تنظیمات پیش آمد.'); } finally { setSaving(false); }
    };

    const addPattern = () => { setPatterns([...patterns, { id: Date.now().toString(), title: '', code: '', variables: '' }]); };
    const updatePattern = (index: number, field: string, value: string) => { const newPatterns = [...patterns]; newPatterns[index][field] = value; setPatterns(newPatterns); };
    const removePattern = (index: number) => { const newPatterns = [...patterns]; newPatterns.splice(index, 1); setPatterns(newPatterns); };

    const applyPreset = (panel: string) => {
        setActivePreset(panel);
        if (panel === 'kavenegar') {
            setApiUrl('https://api.kavenegar.com/v1/[apikey]/verify/lookup.json?receptor=[phone]&template=[pattern]&token=[variables]');
            setAuthMethod('apikey');
            Alert.alert('راهنمایی کاوه نگار', 'در کادر متغیرهای الگو فقط تگ را قرار دهید. مثال:\n[tracking_code]');
        } else if (panel === 'ippanel') {
            setApiUrl('https://ippanel.com/patterns/pattern?username=[username]&password=[password]&from=[sender]&to=[phone]&shared=[pattern]&p1=code&v1=[variables]');
            setAuthMethod('userpass');
            Alert.alert('راهنمایی IPPanel / فراز', 'در کادر متغیرهای الگو فقط تگ را قرار دهید. مثال:\n[tracking_code]');
        } else if (panel === 'melipayamak') {
            setApiUrl('https://api.payamak-panel.com/post/Send.asmx/SendByBaseNumber2?username=[username]&password=[apikey]&to=[phone]&bodyId=[pattern]&[variables]');
            setAuthMethod('apikey');
            Alert.alert('راهنمایی ملی پیامک', 'در ملی پیامک متغیرها با text= شروع می‌شوند. در کادر الگو اینگونه بنویسید:\n\ntext=[first_name]&text=[tracking_code]');
        }
    };

    const handleTestSms = async () => {
        if (!testPhone) return Alert.alert('خطا', 'شماره موبایل تستی را وارد کنید.');
        if (!apiUrl) return Alert.alert('خطا', 'آدرس API وب‌سرویس را وارد کنید.');
        
        setTesting(true);
        let finalUrl = '';
        try {
            const testPattern = patterns[0] || { code: '', variables: '' };
            
            let testVars = testPattern.variables
                .replace(/\[first_name\]/g, encodeURIComponent('تست'))
                .replace(/\[last_name\]/g, encodeURIComponent('تست'))
                .replace(/\[order_id\]/g, encodeURIComponent('1234'))
                .replace(/\[tracking_code\]/g, encodeURIComponent('1020304050'));

            finalUrl = apiUrl
                .replace(/\[phone\]/g, encodeURIComponent(testPhone))
                .replace(/\[sender\]/g, encodeURIComponent(senderNumber));

            if (authMethod === 'apikey') {
                finalUrl = finalUrl.replace(/\[apikey\]/g, encodeURIComponent(apiKey)).replace(/\[username\]/g, encodeURIComponent(username));
            } else {
                finalUrl = finalUrl.replace(/\[username\]/g, encodeURIComponent(username)).replace(/\[password\]/g, encodeURIComponent(password));
            }

            finalUrl = finalUrl.replace(/\[pattern\]/g, encodeURIComponent(testPattern.code)).replace(/\[variables\]/g, testVars);

            const reqMethod = (finalUrl.toLowerCase().includes('.asmx') || finalUrl.toLowerCase().includes('post')) ? 'POST' : 'GET';
            let reqUrl = finalUrl;
            let reqData = null;

            if (reqMethod === 'POST' && finalUrl.includes('?')) {
                const parts = finalUrl.split('?');
                reqUrl = parts[0];
                reqData = parts[1];
            }

            const response = await axios({
                method: reqMethod,
                url: reqUrl,
                data: reqData,
                headers: reqMethod === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined
            });

            const responseDataStr = String(response.data).toLowerCase();
            
            // 🚀 سیستم مچ‌گیری از ارورهای مخفی ملی پیامک (کدهای زیر 10 رقم)
            let isMeliError = false;
            let meliErrorDesc = '';
            
            if (responseDataStr.includes('http://tempuri.org/')) {
                const match = responseDataStr.match(/>([^<]+)<\/string>/);
                if (match && match[1].trim().length < 10) {
                    isMeliError = true;
                    const errCode = match[1].trim();
                    if (errCode === '0' || errCode === '2') meliErrorDesc = '0 (نام کاربری یا رمز API اشتباه است)';
                    else if (errCode === '11') meliErrorDesc = '11 (متغیرهایی که در کادر پایین نوشتید با متغیرهای این پترن در ملی پیامک همخوانی ندارد)';
                    else if (errCode === '6') meliErrorDesc = '6 (موجودی پنل پیامک شما کافی نیست)';
                    else meliErrorDesc = errCode + ' (خطای ساختاری)';
                }
            }
            
            if (response.status === 200 && !responseDataStr.includes('false') && !responseDataStr.includes('error') && !isMeliError) {
                Alert.alert('✅ موفقیت', `ارسال شد! کد پیگیری سرور پیامک:\n${String(response.data).substring(0, 80)}`);
            } else {
                Alert.alert('❌ خطا در ارسال پیامک', `سرور پیامک درخواست را رد کرد.\nدلیل خطا: ${meliErrorDesc || 'نامشخص'}\n\nلینک ارسالی جهت بررسی:\n${finalUrl}`);
            }
        } catch (error: any) {
            Alert.alert('خطای اتصال به سرور', `ارتباط با سرور پیامک قطع شد.\n\nخطا: ${error.message}`);
        } finally { 
            setTesting(false); 
        }
    };

    const copyTag = async (tag: string) => {
        await Clipboard.setStringAsync(tag);
        Alert.alert('کپی شد', `تگ ${tag} ذخیره شد.`);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /></View>;

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnTxt}>بازگشت</Text>
                    <Feather name="arrow-right" size={22} color="#0f172a" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>پنل پیامک هوشمند</Text>
                    <Text style={styles.headerSubtitle}>اتصال به تمامی وب‌سرویس‌ها</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                
                <View style={[styles.card, { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                        <Feather name="power" size={20} color={smsEnabled ? "#10b981" : "#94a3b8"} style={{ marginLeft: 8 }} />
                        <Text style={styles.cardTitle}>وضعیت سیستم پیامک</Text>
                    </View>
                    <Switch value={smsEnabled} onValueChange={setSmsEnabled} thumbColor="#fff" trackColor={{ true: '#10b981', false: '#cbd5e1' }} />
                </View>

                <View pointerEvents={smsEnabled ? 'auto' : 'none'} style={{ opacity: smsEnabled ? 1 : 0.5 }}>
                    
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>۱. آدرس وب‌سرویس (API URL)</Text>
                        <Text style={[styles.inputLabel, { color: '#8b5cf6', marginBottom: 10 }]}>انتخاب سریع (خودکار پر می‌شود):</Text>
                        <View style={{ flexDirection: 'row-reverse', marginBottom: 15, gap: 8 }}>
                            <TouchableOpacity style={[styles.presetBtn, activePreset === 'kavenegar' && styles.presetBtnActive]} onPress={() => applyPreset('kavenegar')}><Text style={[styles.presetBtnTxt, activePreset === 'kavenegar' && styles.presetBtnTxtActive]}>کاوه نگار</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, activePreset === 'ippanel' && styles.presetBtnActive]} onPress={() => applyPreset('ippanel')}><Text style={[styles.presetBtnTxt, activePreset === 'ippanel' && styles.presetBtnTxtActive]}>فراز / IPPanel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, activePreset === 'melipayamak' && styles.presetBtnActive]} onPress={() => applyPreset('melipayamak')}><Text style={[styles.presetBtnTxt, activePreset === 'melipayamak' && styles.presetBtnTxtActive]}>ملی پیامک</Text></TouchableOpacity>
                        </View>
                        <Text style={styles.inputLabel}>لینک ارسال وب‌سرویس شما:</Text>
                        <TextInput style={[styles.input, { height: 90, textAlign: 'left', lineHeight: 22 }]} multiline placeholder="مثال: https://api.sms.com/send?to=[phone]&pattern=[pattern]&text=[variables]" value={apiUrl} onChangeText={setApiUrl} />
                        <Text style={styles.inputLabel}>شماره خط اختصاصی (Sender):</Text>
                        <TextInput style={styles.input} placeholder="مثال: 10008686" value={senderNumber} onChangeText={setSenderNumber} textAlign="right" keyboardType="numeric" />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>۲. روش احراز هویت پنل شما</Text>
                        <View style={styles.authTabs}>
                            <TouchableOpacity style={[styles.authTab, authMethod === 'apikey' && styles.authTabActive]} onPress={() => setAuthMethod('apikey')}><Text style={[styles.authTabTxt, authMethod === 'apikey' && styles.authTabTxtActive]}>با توکن (API)</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.authTab, authMethod === 'userpass' && styles.authTabActive]} onPress={() => setAuthMethod('userpass')}><Text style={[styles.authTabTxt, authMethod === 'userpass' && styles.authTabTxtActive]}>با رمز عبور</Text></TouchableOpacity>
                        </View>
                        {authMethod === 'apikey' ? (
                            <View>
                                <View style={{ marginBottom: 15 }}><Text style={styles.inputLabel}>نام کاربری (الزامی برای برخی پنل‌ها):</Text><TextInput style={[styles.input, { textAlign: 'left', marginBottom: 0 }]} placeholder="Username" value={username} onChangeText={setUsername} /></View>
                                <View style={{ marginBottom: 10 }}><Text style={styles.inputLabel}>کلید دسترسی (API Key):</Text><TextInput style={[styles.input, { textAlign: 'left', marginBottom: 0 }]} placeholder="API Key" value={apiKey} onChangeText={setApiKey} /></View>
                            </View>
                        ) : (
                            <View>
                                <View style={{ marginBottom: 15 }}><Text style={styles.inputLabel}>نام کاربری پنل:</Text><TextInput style={[styles.input, { textAlign: 'left', marginBottom: 0 }]} placeholder="Username" value={username} onChangeText={setUsername} /></View>
                                <View style={{ marginBottom: 10 }}><Text style={styles.inputLabel}>رمز عبور پنل:</Text><TextInput style={[styles.input, { textAlign: 'left', marginBottom: 0 }]} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={false} /></View>
                            </View>
                        )}
                    </View>

                    <View style={styles.accordionCard}>
                        <TouchableOpacity style={styles.accordionHeader} onPress={() => setGuideAccordion(!guideAccordion)} activeOpacity={0.8}>
                            <Feather name={guideAccordion ? "chevron-up" : "chevron-down"} size={20} color="#a16207" />
                            <Text style={styles.guideTitle}>💡 راهنمای متغیرهای مجاز (تگ‌ها)</Text>
                        </TouchableOpacity>
                        {guideAccordion && (
                            <View style={styles.accordionContent}>
                                <Text style={styles.guideTxt}>برای کپی شدن کد، کافیست روی هر تگ لمس کنید:</Text>
                                <View style={styles.tagsContainer}>
                                    <TouchableOpacity onPress={() => copyTag('[phone]')}>
                                        <Text style={styles.tagItem}>شماره مشتری = <Text style={styles.tagHigh}>[phone]</Text></Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => copyTag('[first_name]')}>
                                        <Text style={styles.tagItem}>نام مشتری = <Text style={styles.tagHigh}>[first_name]</Text></Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => copyTag('[last_name]')}>
                                        <Text style={styles.tagItem}>نام خانوادگی = <Text style={styles.tagHigh}>[last_name]</Text></Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => copyTag('[order_id]')}>
                                        <Text style={styles.tagItem}>شماره سفارش = <Text style={styles.tagHigh}>[order_id]</Text></Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => copyTag('[price]')}>
                                        <Text style={styles.tagItem}>مبلغ کل = <Text style={styles.tagHigh}>[price]</Text></Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => copyTag('[tracking_code]')}>
                                        <Text style={styles.tagItem}>کد پیگیری پستی = <Text style={styles.tagHigh}>[tracking_code]</Text></Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.card}>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                            <Text style={styles.cardTitle}>۳. الگوها (Patterns)</Text>
                            <TouchableOpacity style={styles.addPatternBtn} onPress={addPattern}><Feather name="plus" size={14} color="#fff" /><Text style={styles.addPatternTxt}>افزودن الگو</Text></TouchableOpacity>
                        </View>
                        {patterns.map((item, index) => (
                            <View key={item.id} style={styles.patternBox}>
                                <View style={styles.patternHeader}>
                                    <Text style={styles.patternIndex}>الگوی {index + 1}</Text>
                                    {patterns.length > 1 && (<TouchableOpacity onPress={() => removePattern(index)}><Feather name="trash-2" size={16} color="#ef4444" /></TouchableOpacity>)}
                                </View>
                                <TextInput style={styles.input} placeholder="نام الگو (مثلاً: ثبت کد رهگیری)" value={item.title} onChangeText={(t) => updatePattern(index, 'title', t)} textAlign="right" />
                                <TextInput style={[styles.input, { textAlign: 'left' }]} placeholder="کد الگو (مثلاً: 8585)" value={item.code} onChangeText={(t) => updatePattern(index, 'code', t)} />
                                <Text style={styles.inputLabel}>متغیرهای این الگو:</Text>
                                <TextInput style={[styles.input, { textAlign: 'left', backgroundColor: '#f1f5f9' }]} placeholder="مثال: text=[first_name]&text=[tracking_code]" value={item.variables} onChangeText={(t) => updatePattern(index, 'variables', t)} />
                            </View>
                        ))}
                    </View>

                    <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                        <Text style={[styles.cardTitle, { color: '#166534', marginBottom: 15 }]}>آزمایش ارسال پیامک</Text>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                            <TextInput style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: '#fff', borderColor: '#86efac' }]} placeholder="شماره موبایل تست (0912...)" keyboardType="phone-pad" value={testPhone} onChangeText={setTestPhone} textAlign="right" />
                            <TouchableOpacity style={styles.testBtn} onPress={handleTestSms} disabled={testing}>{testing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.testBtnTxt}>ارسال تست</Text>}</TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color="#fff" /> : (<><Feather name="save" size={18} color="#fff" style={{ marginLeft: 8 }} /><Text style={styles.saveBtnTxt}>ذخیره و اعمال تنظیمات</Text></>)}
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
    headerSubtitle: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textAlign: 'right', marginTop: 2 },
    backBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    backBtnTxt: { fontSize: 13, fontWeight: '900', color: '#0f172a' },
    scrollContent: { padding: 16, paddingBottom: 250 }, 
    card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
    cardTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginBottom: 10 },
    presetBtn: { flex: 1, backgroundColor: '#f8fafc', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
    presetBtnActive: { backgroundColor: '#8b5cf6', borderColor: '#7c3aed' },
    presetBtnTxt: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
    presetBtnTxtActive: { color: '#ffffff' },
    accordionCard: { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fef08a', borderRadius: 16, marginBottom: 16 },
    accordionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    accordionContent: { padding: 16, paddingTop: 0 },
    guideTitle: { fontSize: 14, fontWeight: '900', color: '#a16207', textAlign: 'right', flex: 1 },
    guideTxt: { fontSize: 12, color: '#854d0e', textAlign: 'right', lineHeight: 22, marginBottom: 10 },
    tagsContainer: { backgroundColor: '#fffbeb', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#fde047' },
    tagItem: { fontSize: 13, color: '#475569', textAlign: 'right', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(253,224,71,0.5)', fontWeight: 'bold' },
    tagHigh: { color: '#0f172a', fontWeight: '900', backgroundColor: '#fef08a', paddingHorizontal: 6, borderRadius: 4 },
    inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 8, marginTop: 5 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 13, color: '#0f172a', fontWeight: 'bold', marginBottom: 10 },
    authTabs: { flexDirection: 'row-reverse', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 15 },
    authTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    authTabActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    authTabTxt: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
    authTabTxtActive: { color: '#8b5cf6', fontWeight: '900' },
    hintTxt: { fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: -5, marginBottom: 10 },
    addPatternBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    addPatternTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginRight: 4 },
    patternBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 15, marginBottom: 15 },
    patternHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    patternIndex: { fontSize: 12, fontWeight: '900', color: '#3b82f6', backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    testBtn: { backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 14, borderRadius: 12, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
    testBtnTxt: { color: '#ffffff', fontWeight: '900', fontSize: 13 },
    saveBtn: { flexDirection: 'row-reverse', backgroundColor: '#8b5cf6', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10, elevation: 2 },
    saveBtnTxt: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
});