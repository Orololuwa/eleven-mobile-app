import React, { useRef, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors, typography } from '@/theme';
import { HOLD_CONFIRM_MS } from '@/features/sessions/tracking/constants';

type HoldToConfirmButtonProps = {
  title: string;
  hint?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
  title,
  hint,
  onConfirm,
  variant = 'danger',
  disabled = false,
  style,
  textStyle,
}) => {
  const [holdProgress, setHoldProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHold = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setHoldProgress(0);
  };

  const handlePressIn = (_event: GestureResponderEvent) => {
    if (disabled) return;
    clearHold();
    const stepMs = 100;
    const increment = (stepMs / HOLD_CONFIRM_MS) * 100;
    intervalRef.current = setInterval(() => {
      setHoldProgress((prev) => {
        if (prev >= 100) {
          clearHold();
          onConfirm();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);
  };

  const borderColor = variant === 'danger' ? colors.accent.danger : colors.border.strong;
  const textColor = variant === 'danger' ? colors.accent.danger : colors.text.primary;
  const fillColor =
    variant === 'danger' ? `${colors.accent.danger}22` : `${colors.border.strong}44`;

  return (
    <>
      <TouchableOpacity
        style={[styles.button, { borderColor, opacity: disabled ? 0.5 : 1 }, style]}
        onPressIn={handlePressIn}
        onPressOut={clearHold}
        activeOpacity={1}
        disabled={disabled}
      >
        <View
          style={[styles.progress, { width: `${holdProgress}%`, backgroundColor: fillColor }]}
        />
        <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
      </TouchableOpacity>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  text: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.22 * 12,
    fontWeight: typography.fontWeight.semibold,
    position: 'relative',
  },
  hint: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: 4,
  },
});
