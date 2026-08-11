import React from 'react';
import { router } from 'expo-router';
import { PrivacyDataScreen } from '@/screens';

export default function PrivacyDataRoute() {
  return <PrivacyDataScreen onBack={() => router.back()} />;
}
