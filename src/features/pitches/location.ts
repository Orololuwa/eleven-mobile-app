import * as Location from 'expo-location';
import type { LocationIn } from './types';

export type DeviceLocation = LocationIn & {
  accuracy: number | null;
};

export const getCurrentDeviceLocation = async (): Promise<DeviceLocation | null> => {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;

  const current = await Location.getCurrentPositionAsync({});
  return {
    lat: current.coords.latitude,
    lng: current.coords.longitude,
    accuracy: current.coords.accuracy,
  };
};
