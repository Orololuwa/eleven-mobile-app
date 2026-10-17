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
import { typography, type Colors, useThemedStyles, useColors } from '@/theme';
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
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [holdProgress, setHoldProgress] = useState(0);
  const progressRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHold = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    progressRef.current = 0;
    setHoldProgress(0);
  };

  const confirmedRef = useRef(false);

  /** `onConfirm` runs from the timer, never inside a state updater (updaters can run twice). */
  const handlePressIn = (_event: GestureResponderEvent) => {
    if (disabled) return;
    confirmedRef.current = false;
    clearHold();
    const stepMs = 100;
    const increment = (stepMs / HOLD_CONFIRM_MS) * 100;
    intervalRef.current = setInterval(() => {
      if (progressRef.current >= 100) {
        if (confirmedRef.current) {
          clearHold();
          return;
        }
        confirmedRef.current = true;
        clearHold();
        onConfirm();
        return;
      }
      progressRef.current += increment;
      setHoldProgress(progressRef.current);
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

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
