// screens/SyncSettingsScreen.tsx

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WooCommerceSettings, SyncStatus } from '../types/sync';
import { getSettings, saveSettings, getSyncStatus } from '../storage/settingsStorage';
import { performSync } from '../services/syncManager';
import { testConnection } from '../services/wooCommerceApi';
import { colors, spacing, radius, typography, shadow } from '../theme/theme';

export default function SyncSettingsScreen() {
  const [settings, setSettings] = useState<WooCommerceSettings>({
    siteUrl: '',
    consumerKey: '',
    consumerSecret: '',
    autoNightlySync: true,
  });
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setSettings(await getSettings());
    setStatus(await getSyncStatus());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      Alert.alert('ذخیره شد', 'تنظیمات اتصال ثبت شد');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await saveSettings(settings); // قبل از تست، آخرین تغییرات رو ذخیره کن
      await testConnection(settings);
      Alert.alert('موفق', 'اتصال به ووکامرس برقرار شد ✓');
    } catch (e: any) {
      Alert.alert('ناموفق', e?.message || 'اتصال برقرار نشد');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await performSync();
      if (result.success) {
        Alert.alert('Sync انجام شد', `${result.count} سفارش جدید ثبت شد`);
      } else {
        Alert.alert('خطا در Sync', result.error || 'دوباره تلاش کنید');
      }
    } finally {
      setSyncing(false);
      setStatus(await getSyncStatus());
    }
  };

  const toggleNightlySync = async (value: boolean) => {
    const next = { ...settings, autoNightlySync: value };
    setSettings(next);
    await saveSettings(next);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>اتصال به ووکامرس</Text>
      <Text style={styles.subtitleText}>
        کلید API رو از سایت خودتون بسازید: ووکامرس ← تنظیمات ← پیشرفته ← REST API
      </Text>

      <View style={styles.card}>
        <Field
          label="آدرس سایت"
          placeholder="https://example.com"
          value={settings.siteUrl}
          onChangeText={(v) => setSettings((s) => ({ ...s, siteUrl: v }))}
          autoCapitalize="none"
        />
        <Field
          label="Consumer Key"
          placeholder="ck_xxxxxxxxxxxxxxxx"
          value={settings.consumerKey}
          onChangeText={(v) => setSettings((s) => ({ ...s, consumerKey: v }))}
          autoCapitalize="none"
          secure
        />
        <Field
          label="Consumer Secret"
          placeholder="cs_xxxxxxxxxxxxxxxx"
          value={settings.consumerSecret}
          onChangeText={(v) => setSettings((s) => ({ ...s, consumerSecret: v }))}
          autoCapitalize="none"
          secure
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.secondaryBtn, testing && styles.disabledBtn]}
            onPress={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.secondaryBtnText}>تست اتصال</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.disabledBtn]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>ذخیره</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Switch
            value={settings.autoNightlySync}
            onValueChange={toggleNightlySync}
            trackColor={{ false: colors.border, true: colors.primaryMuted }}
            thumbColor={settings.autoNightlySync ? colors.primary : '#fff'}
          />
          <View style={styles.switchTextWrap}>
            <Text style={styles.subtitle}>Sync خودکار شب‌به‌شب</Text>
            <Text style={styles.caption}>
              هر شب یک‌بار به‌صورت خودکار سفارش‌های جدید همگام‌سازی می‌شن
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.caption}>آخرین Sync</Text>
          <Text style={styles.statusValue}>
            {status?.lastSyncAt
              ? new Date(status.lastSyncAt).toLocaleString('fa-IR')
              : 'هنوز انجام نشده'}
          </Text>
        </View>
        {status?.lastSyncCount != null && status.lastSyncAt && (
          <View style={styles.statusRow}>
            <Text style={styles.caption}>سفارش‌های جدید آخرین بار</Text>
            <Text style={styles.statusValue}>{status.lastSyncCount}</Text>
          </View>
        )}
        {status?.lastSyncError && (
          <Text style={styles.errorText}>خطا: {status.lastSyncError}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.syncBtn, syncing && styles.disabledBtn]}
        onPress={handleSyncNow}
        disabled={syncing}
      >
        {syncing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.syncBtnText}>⟳  Sync کن</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label,
  secure,
  ...props
}: {
  label: string;
  secure?: boolean;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secure}
        textAlign="right"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.textPrimary, textAlign: 'right' },
  subtitle: { ...typography.subtitle, color: colors.textPrimary, textAlign: 'right' },
  subtitleText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  caption: { ...typography.caption, color: colors.textSecondary, textAlign: 'right' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: spacing.xs,
  },
  fieldInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
  },

  buttonRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  disabledBtn: { opacity: 0.6 },

  switchRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  switchTextWrap: { flex: 1, marginRight: spacing.md },

  statusCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statusValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  syncBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    ...shadow,
  },
  syncBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
