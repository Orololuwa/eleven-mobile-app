import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  SignInScreen,
  ProfileSetupScreen,
  HomeScreen,
  SessionTypeSheet,
  ActiveSessionScreen,
  SessionSummaryScreen,
} from './src/screens';
import type { ProfileData } from './src/screens/ProfileSetupScreen';

type AppState = 'signIn' | 'profileSetup' | 'home' | 'activeSession' | 'summary';

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
    setAppState('activeSession');
  };

  const handleEndSession = () => {
    setAppState('summary');
  };

  const handleSessionComplete = () => {
    setSessionCount((prev) => prev + 1);
    setAppState('home');
  };

  const renderScreen = () => {
    switch (appState) {
      case 'signIn':
        return (
          <SignInScreen
            onContinueWithApple={handleSignIn}
            onContinueWithGoogle={handleSignIn}
            onUseEmail={handleSignIn}
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
              onNavigateToHistory={() => {}}
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

      default:
        return null;
    }
  };

  return (
    <>
      <StatusBar style="light" />
      {renderScreen()}
    </>
  );
}
