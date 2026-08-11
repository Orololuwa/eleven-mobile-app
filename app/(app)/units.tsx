import React from 'react';
import { router } from 'expo-router';
import { UnitsScreen } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function UnitsRoute() {
  const units = useAppStore((state) => state.units);
  const setUnits = useAppStore((state) => state.setUnits);

  return <UnitsScreen units={units} onBack={() => router.back()} onChange={setUnits} />;
}
