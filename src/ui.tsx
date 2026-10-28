import { ComponentProps, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** One place for every icon in the app (Ionicons, bundled with Expo Go). */
export function Icon(props: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  return <Ionicons name={props.name} size={props.size ?? 20} color={props.color ?? t.text} />;
}

export function Chevron() {
  const t = useTheme();
  return <Icon name="chevron-forward" size={18} color={t.muted} />;
}

/** A person's picture: their emoji (or initials) in a soft circle. */
export function Avatar(props: { emoji: string; size?: number }) {
  const t = useTheme();
  const size = props.size ?? 48;
  const isLetters = /^[A-Za-z0-9 .]+$/.test(props.emoji); // initials like "MK"
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isLetters ? t.accentSoft : t.chip,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: isLetters ? size * 0.38 : size * 0.56,
          fontWeight: isLetters ? '800' : '400',
          color: t.accent,
        }}
        numberOfLines={1}
      >
        {props.emoji || '?'}
      </Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 10 }}>
      <Text
        style={{ fontSize: 13, fontWeight: '700', color: t.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}
      >
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Button(props: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
  disabled?: boolean;
  icon?: IconName;
}) {
  const t = useTheme();
  const kind = props.kind ?? 'primary';
  const bg = kind === 'primary' ? t.accent : t.card;
  const fg = kind === 'primary' ? t.onAccent : kind === 'danger' ? t.bad : t.text;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: 14,
          paddingVertical: 15,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          borderWidth: kind === 'primary' ? 0 : 1,
          borderColor: t.line,
          opacity: props.disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        props.style,
      ]}
    >
      {props.icon ? <Icon name={props.icon} size={19} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{props.title}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.muted}
        {...rest}
        style={[
          {
            backgroundColor: t.card,
            borderWidth: 1,
            borderColor: t.line,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 16,
            color: t.text,
          },
          style,
        ]}
      />
    </View>
  );
}

export function Stepper(props: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const t = useTheme();
  const btn: ViewStyle = {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.line,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: t.muted }}>{props.label}</Text>
        <Text style={{ fontSize: 18, color: t.text, fontWeight: '600', marginTop: 2 }}>{props.value}</Text>
      </View>
      <Pressable onPress={props.onMinus} style={btn} hitSlop={6} accessibilityLabel={`Decrease ${props.label}`}>
        <Icon name="remove" size={22} />
      </Pressable>
      <Pressable onPress={props.onPlus} style={btn} hitSlop={6} accessibilityLabel={`Increase ${props.label}`}>
        <Icon name="add" size={22} />
      </Pressable>
    </View>
  );
}

export function Chip(props: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: props.selected ? t.accent : t.chip,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: props.selected ? t.onAccent : t.text, fontWeight: '600', fontSize: 14 }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function Checkbox(props: {
  checked: boolean;
  onPress: () => void;
  label: string;
  sub?: string;
  /** Cross out ticked items (to-do style). Turn off for plain selection lists. */
  strike?: boolean;
}) {
  const strike = props.strike ?? true;
  const t = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 12 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.checked }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: props.checked ? t.accent : t.muted,
          backgroundColor: props.checked ? t.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {props.checked ? <Icon name="checkmark" size={16} color={t.onAccent} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            color: props.checked && strike ? t.muted : t.text,
            textDecorationLine: props.checked && strike ? 'line-through' : 'none',
          }}
        >
          {props.label}
        </Text>
        {props.sub ? <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{props.sub}</Text> : null}
      </View>
    </Pressable>
  );
}

/** A slide-up page with Cancel / title / action header. */
export function Sheet(props: {
  visible: boolean;
  title: string;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <Modal visible={props.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: t.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 10,
          }}
        >
          <Pressable onPress={props.onClose} hitSlop={12} style={{ minWidth: 60 }}>
            <Text style={{ fontSize: 17, color: t.muted }}>{props.onAction ? 'Cancel' : 'Close'}</Text>
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: t.text }}>{props.title}</Text>
          <Pressable onPress={props.onAction} hitSlop={12} style={{ minWidth: 60, alignItems: 'flex-end' }}>
            {props.onAction ? (
              <Text style={{ fontSize: 17, fontWeight: '700', color: t.accent }}>{props.actionLabel ?? 'Save'}</Text>
            ) : null}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {props.children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const base = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});

/** A short list of icon + text lines (used for "Before you call" talking points). */
export function PointList(props: { points: { icon: IconName; text: string }[]; color: string; textColor: string }) {
  return (
    <View style={{ gap: 8 }}>
      {props.points.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ marginTop: 1 }}>
            <Icon name={p.icon} size={17} color={props.color} />
          </View>
          <Text style={{ flex: 1, color: props.textColor, fontSize: 15, lineHeight: 20 }} numberOfLines={3}>
            {p.text}
          </Text>
        </View>
      ))}
    </View>
  );
}
