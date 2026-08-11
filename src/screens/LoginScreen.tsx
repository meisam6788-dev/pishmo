import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, StatusBar, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>(); 

  // استیت‌های فرم ورود دستی
  const [siteUrl, setSiteUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  
  // استیت‌های کنترلی
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [secureAppPass, setSecureAppPass] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);

  // مجوزهای دوربین برای اسکنر QR
  const [permission, requestPermission] = useCameraPermissions();

  const addNewSite = useAuthStore((state: any) => state.addNewSite);
  // فراخوانی لیست سایت‌ها برای دکمه بازگشت هوشمند
  const sites = useAuthStore((state: any) => state.sites);

  // ۱. منطق پردازش بارکد اسکن شده
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setShowScanner(false);

    try {
      const parsedData = JSON.parse(data);
      
      if (parsedData.url && parsedData.ck && parsedData.cs) {
        setSiteUrl(parsedData.url);
        setConsumerKey(parsedData.ck);
        setConsumerSecret(parsedData.cs);
        if (parsedData.user) setWpUsername(parsedData.user);
        if (parsedData.pass) setAppPassword(parsedData.pass);

        Alert.alert('اسکن موفقیت‌آمیز ⚡', 'اطلاعات دریافت شد. در حال بررسی اتصال...');
        executeLogin(parsedData.url, parsedData.ck, parsedData.cs, parsedData.user || '', parsedData.pass || '');
      } else {
        Alert.alert('خطا', 'بارکد اسکن شده نامعتبر است.');
      }
    } catch (e) {
      Alert.alert('خطا', 'فرمت QR Code اسکن شده صحیح نیست.');
    }
  };

  // ۲. منطق اصلی احراز هویت
  const executeLogin = async (url: string, ck: string, cs: string, user: string, pass: string) => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = ck.trim();
    const cleanSecret = cs.trim();
    const cleanWpUser = user.trim();
    const cleanAppPass = pass.trim();

    if (!cleanUrl || !cleanKey || !cleanSecret) {
      Alert.alert('توجه ⚠️', 'لطفاً آدرس سایت، کلید مصرف‌کننده (ck) و راز مصرف‌کننده (cs) را وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      let baseUrl = cleanUrl;
      if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;

      const testClient = axios.create({
          baseURL: `${baseUrl}/wp-json/wc/v3/`,
          timeout: 15000,
          params: {
              consumer_key: cleanKey,
              consumer_secret: cleanSecret,
          },
          headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          }
      });

      const response = await testClient.get('products', { params: { per_page: 1 } });

      if (response.status === 200) {
        const siteDomain = cleanUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        
        await addNewSite({
            id: cleanUrl,
            url: cleanUrl,
            ck: cleanKey,
            cs: cleanSecret,
            name: siteDomain,
            wpUsername: cleanWpUser,
            appPassword: cleanAppPass
        });

        Alert.alert('تبریک 🎉', 'سایت با موفقیت اضافه شد!');
        
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('MainTabs');
        }
      }
    } catch (error: any) {
      console.log('Login Error Details:', error.response?.data || error.message);
      Alert.alert(
        'خطای اتصال ❌', 
        'کلیدهای وارد شده معتبر نیستند یا سرور سایت پاسخ نمی‌دهد.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogin = () => {
    executeLogin(siteUrl, consumerKey, consumerSecret, wpUsername, appPassword);
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('دسترسی دوربین', 'برای اسکن بارکد ورود، نیاز به دسترسی دوربین است.');
        return;
      }
    }
    setScanned(false);
    setShowScanner(true);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* اضافه شدن دکمه بازگشت دستی در بالای صفحه (فقط اگر از داخل اپلیکیشن باز شده باشد) */}
        {navigation.canGoBack() && (
          <TouchableOpacity 
            style={styles.goBackBtn} 
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-right" size={24} color="#0f172a" />
            <Text style={{ marginLeft: 8, fontWeight: '900', color: '#0f172a' }}>بازگشت به داشبورد</Text>
          </TouchableOpacity>
        )}

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Feather name="shopping-bag" size={40} color="#ffffff" />
          </View>
          <Text style={styles.title}>Pishmo App</Text>
          <Text style={styles.subtitle}>مدیریت حرفه‌ای و هوشمند فروشگاه ووکامرس</Text>
        </View>

        {/* 🚀 دکمه هوشمند ورود به داشبورد (اگر سایت از قبل متصل باشد) */}
        {sites && sites.length > 0 && (
          <TouchableOpacity 
            style={styles.activeSitesBtn} 
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.activeSitesTitle}>ورود به فروشگاه‌های من</Text>
              <Text style={styles.activeSitesSub}>شما {sites.length} فروشگاه متصل دارید</Text>
            </View>
            <View style={styles.activeSitesIcon}>
                <Feather name="arrow-right" size={20} color="#10b981" />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.qrSection}>
          <TouchableOpacity style={styles.qrButton} onPress={openScanner}>
            <Feather name="maximize" size={24} color="#10b981" />
            <View style={{ marginRight: 12, flex: 1 }}>
              <Text style={styles.qrButtonTitle}>ورود سریع با بارکد (پلاگین رابط)</Text>
              <Text style={styles.qrButtonSubtitle}>اسکن QR Code از پیشخوان وردپرس بدون نیاز به تایپ</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>یا ورود دستی</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>🔗 اطلاعات اتصال ووکامرس</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>آدرس سایت فروشگاه:</Text>
            <View style={styles.inputWrapper}>
              <Feather name="globe" size={18} color="#64748b" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="https://example.com"
                placeholderTextColor="#94a3b8"
                value={siteUrl}
                onChangeText={setSiteUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>کلید مصرف‌کننده (Consumer Key):</Text>
            <View style={styles.inputWrapper}>
              <Feather name="key" size={18} color="#64748b" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor="#94a3b8"
                value={consumerKey}
                onChangeText={setConsumerKey}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>رمز مصرف‌کننده (Consumer Secret):</Text>
            <View style={styles.inputWrapper}>
              <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.icon}>
                <Feather name={secureText ? "eye-off" : "eye"} size={18} color="#64748b" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor="#94a3b8"
                value={consumerSecret}
                onChangeText={setConsumerSecret}
                secureTextEntry={secureText}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>🖼️ اطلاعات آپلود رسانه (برای انتشار عکس)</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>نام کاربری وردپرس (مدیر سایت):</Text>
            <View style={styles.inputWrapper}>
              <Feather name="user" size={18} color="#64748b" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Username / Email"
                placeholderTextColor="#94a3b8"
                value={wpUsername}
                onChangeText={setWpUsername}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>رمز عبور برنامه (Application Password):</Text>
            <View style={styles.inputWrapper}>
              <TouchableOpacity onPress={() => setSecureAppPass(!secureAppPass)} style={styles.icon}>
                <Feather name={secureAppPass ? "eye-off" : "eye"} size={18} color="#64748b" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                placeholderTextColor="#94a3b8"
                value={appPassword}
                onChangeText={setAppPassword}
                secureTextEntry={secureAppPass}
                autoCapitalize="none"
              />
            </View>
          </View>

          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleManualLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                <Feather name="log-in" size={20} color="#ffffff" style={{ marginLeft: 8 }} />
                <Text style={styles.loginButtonText}>اتصال به فروشگاه</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* مدال اسکنر دوربین */}
      <Modal visible={showScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView 
            style={StyleSheet.absoluteFillObject} 
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerText}>دوربین را روی QR Code پلاگین در سایت بگیرید</Text>
            <View style={styles.scannerBox} />
            <TouchableOpacity style={styles.closeScannerBtn} onPress={() => setShowScanner(false)}>
              <Feather name="x" size={24} color="#ffffff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>انصراف و بازگشت</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    justifyContent: 'center',
  },
  goBackBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 20,
  },
  activeSitesBtn: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    backgroundColor: '#10b981', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderRadius: 16, 
    marginBottom: 20, 
    elevation: 3, 
    shadowColor: '#10b981', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 6 
  },
  activeSitesTitle: { 
    fontSize: 14, 
    fontWeight: '900', 
    color: '#ffffff', 
    textAlign: 'right', 
    marginBottom: 2 
  },
  activeSitesSub: { 
    fontSize: 11, 
    fontWeight: 'bold', 
    color: '#d1fae5', 
    textAlign: 'right' 
  },
  activeSitesIcon: { 
    width: 36, 
    height: 36, 
    borderRadius: 12, 
    backgroundColor: '#ffffff', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    width: 70,
    height: 70,
    backgroundColor: '#10b981',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  qrSection: {
    marginBottom: 20,
  },
  qrButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 16,
  },
  qrButtonTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#065f46',
    textAlign: 'right',
  },
  qrButtonSubtitle: {
    fontSize: 11,
    color: '#047857',
    textAlign: 'right',
    marginTop: 2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: '#64748b',
    fontWeight: 'bold',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#334155',
    textAlign: 'right',
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  icon: {
    padding: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'left',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
  },
  loginButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    elevation: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scannerBox: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
  closeScannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 40,
  },
});