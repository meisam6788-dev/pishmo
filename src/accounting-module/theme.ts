// theme/theme.ts
//
// یک فایل تم واحد برای کل اپ. هر رنگ/فاصله/فونت از اینجا خونده می‌شه تا
// ظاهر همه صفحات یکدست و مدرن/مینیمال بمونه. برای تغییر پالت رنگی، فقط
// همین فایل کافیه.

export const colors = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F3F5',
  border: '#ECECEE',

  textPrimary: '#1A1A1E',
  textSecondary: '#6B6F76',
  textMuted: '#9BA0A8',

  primary: '#3D5AFE',       // آبی مدرن برای اکشن‌های اصلی
  primaryMuted: '#EEF0FF',

  success: '#1FAA59',
  successMuted: '#E8F8EF',

  danger: '#E5484D',
  dangerMuted: '#FDECEC',

  warning: '#F5A623',
  warningMuted: '#FEF3E2',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  subtitle: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  numeric: { fontSize: 20, fontWeight: '800' as const },
};

// سایه بسیار ملایم، همسو با استایل مینیمال (بدون بوردر پررنگ)
export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
};
