import React, { createContext, useContext, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  StyleProp,
  TextProps,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export const light = {
  bg: '#f8fbfc',
  card: '#ffffff',
  text: '#0f172a',
  strong: '#020617',
  muted: '#475569',
  border: '#bae6f0',
  field: '#ffffff',
  cyan: '#0891b2',
  pale: '#ecfeff',
  active: '#cffafe',
  dim: '#64748b',
};
export const dark = {
  bg: '#0f172a',
  card: '#1e293b',
  text: '#e2e8f0',
  strong: '#f8fafc',
  muted: '#a7b6c9',
  border: '#334155',
  field: '#0f172a',
  cyan: '#67e8f9',
  pale: '#102f3e',
  active: '#164e63',
  dim: '#94a3b8',
};
export const Theme = createContext(light);
export const useTheme = () => useContext(Theme);
export const palette: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  green: { bg: '#ecfdf5', text: '#047857', border: '#6ee7b7' },
  slate: { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
  amber: { bg: '#fffbeb', text: '#b45309', border: '#fcd34d' },
  sky: { bg: '#f0f9ff', text: '#0369a1', border: '#7dd3fc' },
  violet: { bg: '#f5f3ff', text: '#6d28d9', border: '#c4b5fd' },
  rose: { bg: '#fff1f2', text: '#be123c', border: '#fda4af' },
};
const nightPalette: typeof palette = {
  green: { bg: '#022c22', text: '#a7f3d0', border: '#047857' },
  slate: { bg: '#1e293b', text: '#cbd5e1', border: '#475569' },
  amber: { bg: '#451a03', text: '#fde68a', border: '#b45309' },
  sky: { bg: '#082f49', text: '#bae6fd', border: '#0369a1' },
  violet: { bg: '#2e1065', text: '#ddd6fe', border: '#6d28d9' },
  rose: { bg: '#4c0519', text: '#fecdd3', border: '#be123c' },
};
export function statusColors(key: string | undefined, theme: typeof light) {
  const colors = theme.bg === dark.bg ? nightPalette : palette;
  return colors[key || 'violet'] || colors.violet;
}
export function Avatar({ name, uri }: { name: string; uri?: string | null }) {
  const t = useTheme();
  const [zoom, setZoom] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Pressable
        disabled={!uri || failed}
        accessibilityRole="button"
        accessibilityLabel={`عرض صورة ${name}`}
        onPress={() => setZoom(true)}
        style={{
          height: 40,
          width: 40,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.active,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {uri && !failed ? (
          <Image
            source={{ uri }}
            onError={() => setFailed(true)}
            style={{ width: 40, height: 40 }}
          />
        ) : (
          <Txt style={{ color: t.cyan }}>{name[0]}</Txt>
        )}
      </Pressable>
      <Sheet visible={zoom} title={name} onClose={() => setZoom(false)}>
        <Image
          source={{ uri: uri || '' }}
          resizeMode="contain"
          style={{ width: '100%', height: 300 }}
        />
      </Sheet>
    </>
  );
}
export function Txt({
  bold,
  muted,
  style,
  ...props
}: TextProps & { bold?: boolean; muted?: boolean }) {
  const t = useTheme();
  const flat = StyleSheet.flatten(style);
  return (
    <Text
      {...props}
      style={[
        s.text,
        {
          color: muted ? t.muted : t.text,
          fontFamily: bold ? 'Cairo-Bold' : 'Cairo-Regular',
        },
        flat?.fontSize && !flat.lineHeight
          ? { lineHeight: Math.ceil(flat.fontSize * 1.6) }
          : undefined,
        style,
      ]}
    />
  );
}
export type IconName =
  | 'sessions'
  | 'attendance'
  | 'settings'
  | 'back'
  | 'down'
  | 'search'
  | 'sun'
  | 'moon'
  | 'logout'
  | 'sync'
  | 'check'
  | 'close'
  | 'plus'
  | 'wifi'
  | 'home'
  | 'more';
export function Icon({
  name,
  color,
  size = 22,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  const t = useTheme();
  const paths: Record<IconName, React.ReactNode> = {
    sessions: (
      <>
        <Rect x="4" y="5.5" width="16" height="14" rx="2" />
        <Path d="M8 3v5M16 3v5M4 10h16M8 14h3M8 17h7" />
      </>
    ),
    attendance: (
      <>
        <Path d="M9 5H6a2 2 0 0 0-2 2v12h13v-3M9 3h6v4H9zM9 12l2.2 2.2L20 6" />
      </>
    ),
    settings: (
      <>
        <Circle cx="12" cy="12" r="3" />
        <Path d="m10 3-.7 2.2-2 .9-2.1-.9-2 3.5L5 10v2l-1.8 1.4 2 3.5 2.1-.9 2 .9L10 21h4l.7-2.2 2-.9 2.1.9 2-3.5L19 14v-2l1.8-1.4-2-3.5-2.1.9-2-.9L14 3z" />
      </>
    ),
    back: <Path d="m9 5 7 7-7 7" />,
    down: <Path d="m6 9 6 6 6-6" />,
    search: (
      <>
        <Circle cx="10.5" cy="10.5" r="6.5" />
        <Path d="m16 16 4.5 4.5" />
      </>
    ),
    sun: (
      <>
        <Circle cx="12" cy="12" r="4" />
        <Path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <Path d="M20.4 15.4A9 9 0 0 1 8.6 3.6 9 9 0 1 0 20.4 15.4Z" />,
    logout: (
      <Path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
    ),
    sync: (
      <Path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2" />
    ),
    check: <Path d="m5 12 4 4L19 6" />,
    close: <Path d="m6 6 12 12M6 18 18 6" />,
    plus: <Path d="M12 5v14M5 12h14" />,
    wifi: (
      <>
        <Path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0" />
        <Circle cx="12" cy="20" r=".7" />
      </>
    ),
    home: <Path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9.5 20v-6h5v6" />,
    more: (
      <>
        <Circle cx="5" cy="12" r="1" />
        <Circle cx="12" cy="12" r="1" />
        <Circle cx="19" cy="12" r="1" />
      </>
    ),
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || t.muted}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </Svg>
  );
}
export function Button({
  title,
  onPress,
  secondary,
  danger,
  busy,
  disabled,
  small,
  icon,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
  icon?: IconName;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const color = danger ? '#be123c' : secondary ? t.cyan : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      testID={testID}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: danger ? '#fff1f2' : secondary ? t.field : '#0891b2',
          borderColor: danger ? '#fda4af' : secondary ? t.border : '#0891b2',
        },
        small && s.smallButton,
        { opacity: disabled || busy ? 0.45 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} size="small" />
      ) : icon ? (
        <Icon name={icon} color={color} size={18} />
      ) : null}
      <Txt bold style={[s.buttonText, { color }, small && { fontSize: 12 }]}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  testID,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.iconButton, pressed && { opacity: 0.5 }]}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: t.card, borderColor: t.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View style={s.fieldWrap}>
      {label && <Txt style={s.label}>{label}</Txt>}
      <TextInput
        {...props}
        accessibilityLabel={
          props.accessibilityLabel || label || props.placeholder
        }
        placeholderTextColor={t.dim}
        style={[
          s.input,
          { color: t.text, backgroundColor: t.field, borderColor: t.border },
          props.multiline && { minHeight: 80, textAlignVertical: 'top' },
          style,
        ]}
      />
    </View>
  );
}
export function Notice({
  message,
  error,
  onRetry,
}: {
  message: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        s.notice,
        {
          backgroundColor: error ? '#fff1f2' : t.pale,
          borderColor: error ? '#fda4af' : t.border,
        },
      ]}
    >
      <Txt style={{ color: error ? '#be123c' : t.cyan, flex: 1, fontSize: 12 }}>
        {message}
      </Txt>
      {onRetry && (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Txt bold style={{ color: error ? '#be123c' : t.cyan }}>
            إعادة المحاولة
          </Txt>
        </Pressable>
      )}
    </View>
  );
}
export function Empty({
  title,
  detail,
  retry,
}: {
  title: string;
  detail?: string;
  retry?: () => void;
}) {
  return (
    <Card style={s.empty}>
      <Txt style={s.drop}>💧</Txt>
      <Txt bold style={{ fontSize: 17, textAlign: 'center' }}>
        {title}
      </Txt>
      {detail && (
        <Txt muted style={{ textAlign: 'center', marginTop: 8 }}>
          {detail}
        </Txt>
      )}
      {retry && <Button secondary title="إعادة المحاولة" onPress={retry} />}
    </Card>
  );
}
export function Sheet({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.modalRoot}>
        <Pressable
          accessibilityLabel="إغلاق النافذة"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[s.modal, { backgroundColor: t.card, borderColor: t.border }]}
        >
          <View style={s.row}>
            <Txt bold style={[s.heading, { flex: 1 }]}>
              {title}
            </Txt>
            <IconButton name="close" label="إغلاق" onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}
export function Select({
  label,
  value,
  options,
  onChange,
  disabled,
  testID,
}: {
  label?: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={s.fieldWrap}>
      {label && <Txt style={s.label}>{label}</Txt>}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label || 'اختيار'}: ${
          options.find(o => o.value === value)?.label || value
        }`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          s.select,
          {
            borderColor: t.border,
            backgroundColor: t.field,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Txt numberOfLines={1} style={{ flex: 1 }}>
          {options.find(o => o.value === value)?.label || value || 'اختر'}
        </Txt>
        <Icon name="down" size={16} />
      </Pressable>
      <Sheet
        visible={open}
        title={label || 'اختر'}
        onClose={() => setOpen(false)}
      >
        {options.map(option => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{
              checked: option.value === value,
              disabled: option.disabled,
            }}
            disabled={option.disabled}
            onPress={() => {
              setOpen(false);
              onChange(option.value);
            }}
            style={[
              s.option,
              {
                backgroundColor: option.value === value ? t.active : t.field,
                opacity: option.disabled ? 0.4 : 1,
              },
            ]}
          >
            <Txt style={{ flex: 1 }} bold={option.value === value}>
              {option.label}
            </Txt>
            {option.value === value && (
              <Icon name="check" color={t.cyan} size={20} />
            )}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
export function Toggle({
  title,
  detail,
  value,
  onChange,
  disabled,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[s.row, { paddingVertical: 8 }]}>
      <View style={{ flex: 1 }}>
        <Txt bold>{title}</Txt>
        {detail && (
          <Txt muted style={{ fontSize: 12, marginTop: 4 }}>
            {detail}
          </Txt>
        )}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: '#0891b2', false: t.border }}
        thumbColor="#fff"
      />
    </View>
  );
}
export function Heading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={[s.row, { alignItems: 'flex-start', marginBottom: 4 }]}>
      <View style={{ flex: 1 }}>
        <Txt bold style={s.title}>
          {title}
        </Txt>
        {detail && (
          <Txt muted style={{ fontSize: 13, marginTop: 4 }}>
            {detail}
          </Txt>
        )}
      </View>
      {action}
    </View>
  );
}
export const s = StyleSheet.create({
  text: {
    fontSize: 14,
    lineHeight: 25,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  page: { padding: 16, gap: 16, paddingBottom: 28 },
  title: { fontSize: 24, lineHeight: 36 },
  heading: { fontSize: 18, lineHeight: 30 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    shadowOpacity: 0.04,
  },
  button: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  buttonText: { fontSize: 14, textAlign: 'center' },
  smallButton: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 5 },
  iconButton: {
    width: 40,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldWrap: { gap: 5 },
  label: { fontSize: 12, lineHeight: 21 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  select: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  notice: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  empty: { paddingVertical: 36, alignItems: 'stretch' },
  drop: { fontSize: 36, lineHeight: 50, textAlign: 'center', marginBottom: 8 },
  modalRoot: {
    flex: 1,
    backgroundColor: '#02061788',
    justifyContent: 'center',
    padding: 20,
    direction: 'ltr',
  },
  modal: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 10,
  },
  option: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    fontSize: 11,
    lineHeight: 21,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export function StatGrid({
  items,
}: {
  items: { label: string; value: string; tone?: string; testID?: string }[];
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
      {items.map(item => (
        <View
          key={item.label}
          style={{
            flexGrow: 1,
            flexBasis: '46%',
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
          }}
        >
          <Txt muted style={{ fontSize: 11 }}>
            {item.label}
          </Txt>
          <Txt
            bold
            testID={item.testID}
            style={{
              fontSize: 16,
              color:
                item.tone === 'good'
                  ? '#059669'
                  : item.tone === 'bad'
                  ? '#e11d48'
                  : t.text,
            }}
          >
            {item.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}
