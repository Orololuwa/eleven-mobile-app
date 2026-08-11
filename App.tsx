import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  SignInScreen,
  EmailSignInScreen,
  ProfileSetupScreen,
  HomeScreen,
  SessionTypeSheet,
  PitchSetupScreen,
  ActiveSessionScreen,
  SessionSummaryScreen,
  HistoryScreen,
  SessionDetailScreen,
} from '@/screens';
import type { ProfileData } from '@/screens/profile/profile-setup-screen';

type AppState = 'signIn' | 'emailSignIn' | 'profileSetup' | 'home' | 'pitchSetup' | 'activeSession' | 'summary' | 'history' | 'sessionDetail';

export default function App() {
  const [appState, setAppState] = useState<AppState>('signIn');
  const [showSessionSheet, setShowSessionSheet] = useState(false);
  const [userData, setUserData] = useState<ProfileData | null>(null);
  const [sessionType, setSessionType] = useState<string>('match');
  const [sessionCount, setSessionCount] = useState(0);

  // Mock session data
  const mockLastSession = sessionCount > 0 ? {
    title: 'Sunday Match',
    date: '03 AUG',
    location: 'Lekki',
    type: '7-A-SIDE',
    distance: 8.4,
    topSpeed: 31,
  } : undefined;

  const mockWeeklyStats = {
    sessions: sessionCount > 0 ? 4 : 0,
    distance: sessionCount > 0 ? 27.1 : 0,
    minutes: sessionCount > 0 ? 312 : 0,
  };

  const mockSessionData = {
    title: 'Sunday Match',
    date: '09 AUG 2026',
    location: 'Lekki',
    type: '7-A-SIDE',
    brickNumber: sessionCount + 1,
    distance: 8.4,
    topSpeed: 31.2,
    sprints: 28,
    calories: 842,
    duration: 94,
    isNewRecord: true,
  };

  const handleSignIn = () => {
    setAppState('profileSetup');
  };

  const handleProfileSetup = (data: ProfileData) => {
    setUserData(data);
    setAppState('home');
  };

  const handleStartSession = () => {
    setShowSessionSheet(true);
  };

  const handleSelectSessionType = (type: string) => {
    setSessionType(type);
    setShowSessionSheet(false);
    setAppState('pitchSetup');
  };

  const handlePitchSetupComplete = () => {
    setAppState('activeSession');
  };

  const handleEndSession = () => {
    setAppState('summary');
  };

  const handleSessionComplete = () => {
    setSessionCount((prev) => prev + 1);
    setAppState('home');
  };

  const handleSelectHistorySession = (_session: any) => {
    setAppState('sessionDetail');
  };

  const renderScreen = () => {
    switch (appState) {
      case 'signIn':
        return (
          <SignInScreen
            onContinueWithApple={handleSignIn}
            onContinueWithGoogle={handleSignIn}
            onUseEmail={() => setAppState('emailSignIn')}
          />
        );

      case 'emailSignIn':
        return (
          <EmailSignInScreen
            onBack={() => setAppState('signIn')}
            onVerified={() => setAppState('profileSetup')}
          />
        );

      case 'profileSetup':
        return (
          <ProfileSetupScreen
            onComplete={handleProfileSetup}
            onSkip={() => {
              setUserData({
                firstName: 'Player',
                position: 'MID',
                preferredFoot: 'LEFT',
              });
              setAppState('home');
            }}
          />
        );

      case 'home':
        return (
          <>
            <HomeScreen
              userName={userData?.firstName || 'Player'}
              sessionCount={sessionCount}
              onStartSession={handleStartSession}
              onNavigateToHistory={() => setAppState('history')}
              onNavigateToProfile={() => {}}
              weeklyStats={mockWeeklyStats}
              lastSession={mockLastSession}
              streak={sessionCount > 0 ? 18 : undefined}
            />
            <SessionTypeSheet
              visible={showSessionSheet}
              onClose={() => setShowSessionSheet(false)}
              onSelectType={handleSelectSessionType}
            />
          </>
        );

      case 'pitchSetup':
        return (
          <PitchSetupScreen
            sessionType={sessionType}
            onComplete={handlePitchSetupComplete}
            onSkip={handlePitchSetupComplete}
          />
        );

      case 'activeSession':
        return (
          <ActiveSessionScreen
            sessionType={sessionType}
            onPause={() => {}}
            onEnd={handleEndSession}
          />
        );

      case 'summary':
        return (
          <SessionSummaryScreen
            sessionData={mockSessionData}
            totalBricks={sessionCount + 1}
            onShare={() => {}}
            onDone={handleSessionComplete}
          />
        );

      case 'history':
        return (
          <HistoryScreen
            sessions={sessionCount > 0 ? [] : []}
            onSelectSession={handleSelectHistorySession}
            onStartSession={handleStartSession}
            onNavigateToHome={() => setAppState('home')}
            onNavigateToProfile={() => {}}
          />
        );

      case 'sessionDetail':
        return (
          <SessionDetailScreen
            sessionData={{
              title: 'SUNDAY MATCH',
              date: '09 AUG · LEKKI ASTRO · 94 MIN',
              location: 'Lekki Astro',
              duration: 94,
              distance: 8.4,
              topSpeed: 31.2,
              sprints: 28,
              calories: 842,
              longestSprint: 42,
              sprintDistance: 0.9,
              recoveryTime: 48,
              hasHeatmap: true,
            }}
            onBack={() => setAppState('history')}
            onShare={() => {}}
            onNavigateToHome={() => setAppState('home')}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {renderScreen()}
    </SafeAreaProvider>
  );
}
