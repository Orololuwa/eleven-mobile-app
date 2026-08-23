import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors, typography } from '@/theme';
import { avatarUrlWithCacheBust } from '@/features/profile/display';

type AvatarPickerProps = {
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | null;
  editable?: boolean;
  busy?: boolean;
  onUpload: (uri: string) => void;
  onRemove?: () => void;
};

const prepareAvatarUri = async (uri: string) => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
};

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  avatarUrl,
  avatarUpdatedAt,
  editable = false,
  busy = false,
  onUpload,
  onRemove,
}) => {
  const [picking, setPicking] = useState(false);
  const resolvedUrl = avatarUrlWithCacheBust({
    avatar_url: avatarUrl,
    avatar_updated_at: avatarUpdatedAt,
  });
  const isBusy = busy || picking;

  const pickImage = async (source: 'library' | 'camera') => {
    if (!editable || isBusy) return;
    setPicking(true);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) return;

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 1,
            });

      if (result.canceled || !result.assets[0]?.uri) return;
      const prepared = await prepareAvatarUri(result.assets[0].uri);
      onUpload(prepared);
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.circle}>
        {resolvedUrl ? (
          <Image source={{ uri: resolvedUrl }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>PHOTO</Text>
        )}
        {isBusy ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.brand.primary} />
          </View>
        ) : null}
      </View>

      {editable ? (
        <View style={styles.copy}>
          <TouchableOpacity disabled={isBusy} onPress={() => void pickImage('library')}>
            <Text style={styles.action}>UPLOAD PHOTO</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={isBusy} onPress={() => void pickImage('camera')}>
            <Text style={styles.secondaryAction}>TAKE PHOTO</Text>
          </TouchableOpacity>
          {resolvedUrl && onRemove ? (
            <TouchableOpacity disabled={isBusy} onPress={onRemove}>
              <Text style={styles.removeAction}>REMOVE PHOTO</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.hint}>Used on your match cards.</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  circle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 7, 6, 0.55)',
  },
  copy: {
    flex: 1,
    gap: 8,
  },
  action: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.14 * 12,
    color: colors.brand.primary,
  },
  secondaryAction: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.text.secondary,
  },
  removeAction: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.accent.danger,
  },
  hint: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 14,
    color: colors.text.secondary,
  },
});
