import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Button } from '@/components';
import { colors, typography, spacing } from '@/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type SessionType = {
  id: string;
  title: string;
  subtitle: string;
  icon: 'match' | 'training' | 'futsal';
};

const SESSION_TYPES: SessionType[] = [
  {
    id: 'match',
    title: 'Match',
    subtitle: '11-A-SIDE · 7-A-SIDE · 5-A-SIDE',
    icon: 'match',
  },
  {
    id: 'training',
    title: 'Training',
    subtitle: 'DRILLS · CONDITIONING · SOLO WORK',
    icon: 'training',
  },
  {
    id: 'futsal',
    title: 'Futsal',
    subtitle: 'INDOOR · HARD COURT',
    icon: 'futsal',
  },
];

type SessionTypeSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelectType: (type: string) => void;
};

export const SessionTypeSheet: React.FC<SessionTypeSheetProps> = ({
  visible,
  onClose,
  onSelectType,
}) => {
  const [selectedType, setSelectedType] = useState<string>('match');

  const handleStartSession = () => {
    onSelectType(selectedType);
    onClose();
  };

  const renderIcon = (icon: string, isSelected: boolean) => {
    const iconColor = isSelected ? colors.brand.primary : colors.text.primary;

    switch (icon) {
      case 'match':
        return <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]} />;
      case 'training':
        return (
          <View style={styles.iconTraining}>
            <View style={[styles.iconBar, { height: 22, backgroundColor: iconColor }]} />
            <View style={[styles.iconBar, { height: 34, backgroundColor: iconColor }]} />
          </View>
        );
      case 'futsal':
        return (
          <View
            style={[
              styles.iconFutsal,
              {
                borderColor: iconColor,
              },
            ]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>What are you playing?</Text>
          <View style={styles.options}>
            {SESSION_TYPES.map((type) => {
              const isSelected = selectedType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => setSelectedType(type.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconContainer}>{renderIcon(type.icon, isSelected)}</View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>{type.title}</Text>
                    <Text style={styles.optionSubtitle}>{type.subtitle}</Text>
                  </View>
                  <Text style={[styles.optionArrow, isSelected && styles.optionArrowSelected]}>
                    ▶
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Button title={`Start ${selectedType}`} onPress={handleStartSession} size="large" />
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay.light,
  },
  sheet: {
    backgroundColor: colors.background.tertiary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[7],
    paddingBottom: spacing[9],
    gap: 16,
  },
  handle: {
    width: 44,
    height: 4,
    backgroundColor: colors.border.strong,
    alignSelf: 'center',
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 26,
    fontWeight: typography.fontWeight.extrabold,
    letterSpacing: -0.025 * 26,
    color: colors.text.primary,
  },
  options: {
    gap: 10,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  optionSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: `${colors.brand.primary}10`,
  },
  iconContainer: {
    width: 34,
    height: 34,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.text.primary,
  },
  iconCircleSelected: {
    backgroundColor: colors.brand.primary,
  },
  iconTraining: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  iconBar: {
    width: 9,
    transform: [{ skewX: '-9deg' }],
  },
  iconFutsal: {
    width: 34,
    height: 34,
    borderWidth: 3,
  },
  optionText: {
    flex: 1,
    gap: 5,
  },
  optionTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 20,
    fontWeight: typography.fontWeight.extrabold,
    letterSpacing: -0.01 * 20,
    color: colors.text.primary,
  },
  optionSubtitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  optionArrow: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 16,
    color: colors.text.disabled,
  },
  optionArrowSelected: {
    color: colors.brand.primary,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.18 * 11,
    color: colors.text.secondary,
  },
});
