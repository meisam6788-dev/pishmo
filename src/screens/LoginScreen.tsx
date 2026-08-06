import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, StatusBar, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '../store/authStore';
import { createWooClient } from '../api/client';

export const LoginScreen: React.FC = () => {
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

  // فراخوانی توابع استیت منیجر
  const setAuth = useAuthStore((state: any) => state.setAuth);
  const setIsAuthenticated = useAuthStore((state: any) => state.setIsAuthenticated);
  const logout = useAuthStore((state: any) => state.logout);

  // ۱. منطق پردازش بارکد اسکن شده از پلاگین وردپرس
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setShowScanner(false);

    try {
      // فرض بر این است که پلاگین وردپرس اطلاعات را به صورت JSON در بارکد قرار داده است
      const parsedData = JSON.parse(data);
      
      if (parsedData.url && parsedData.ck && parsedData.cs) {
        setSiteUrl(parsedData.url);
        setConsumerKey(parsedData.ck);
        setConsumerSecret(parsedData.cs);
        if (parsedData.user) setWpUsername(parsedData.user);
        if (parsedData.pass) setAppPassword(parsedData.pass);

        Alert.alert('اسکن موفقیت‌آمیز ⚡', 'اطلاعات از پلاگین دریافت شد. در حال بررسی اتصال...');
        // اجرای خودکار ورود بعد از اسکن
        executeLogin(parsedData.url, parsedData.ck, parsedData.cs, parsedData.user || '', parsedData.pass || '');
      } else {
        Alert.alert('خطا', 'بارکد اسکن شده نامعتبر است یا مربوط به پلاگین فروشگاه نیست.');
      }
    } catch (e) {
      Alert.alert('خطا', 'فرمت QR Code اسکن شده صحیح نیست.');
    }
  };

  // ۲. منطق اصلی احراز هویت و اتصال به فروشگاه
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
      // ذخیره در حافظه اپلیکیشن
      setAuth(cleanUrl, cleanKey, cleanSecret, cleanWpUser, cleanAppPass);
      
      const client = createWooClient();
      // تست صحت اتصال با وب‌سرویس
      const response = await client.get('products', { params: { per_page: 1 } });

      if (response.status === 200) {
        Alert.alert('تبریک 🎉', 'اتصال با موفقیت برقرار شد!');
        setIsAuthenticated(true); // 👈 انتقال فوری به صفحه داشبورد!
      }
    } catch (error: any) {
      console.log('Login Error Details:', error.response?.data || error.message);
      logout();
      Alert.alert(
        'خطای اتصال ❌', 
        'کلیدهای وارد شده معتبر نیستند یا سرور سایت پاسخ نمی‌دهد.\n\nلطفاً مطمئن شوید:\n۱. دسترسی کلیدها روی Read/Write باشد.\n۲. آدرس سایت با https:// شروع شود.'
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
        
        {/* هدر و لوگوی اپلیکیشن */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Feather name="shopping-bag" size={40} color="#ffffff" />
          </View>
          <Text style={styles.title}>Womo App</Text>
          <Text style={styles.subtitle}>مدیریت حرفه‌ای و هوشمند فروشگاه ووکامرس</Text>
        </View>

        {/* دکمه ورود سریع با پلاگین (QR Code) */}
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

        {/* فرم ورود دستی */}
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
            <Text style={styles.label}>راز مصرف‌کننده (Consumer Secret):</Text>
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
    paddingVertical: 40,
    justifyContent: 'center',
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