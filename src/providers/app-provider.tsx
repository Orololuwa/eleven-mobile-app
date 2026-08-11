import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ProfileData } from '@/screens/profile/profile-setup-screen';

type AppContextValue = {
  user: ProfileData | null;
  sessionCount: number;
  setUser: (user: ProfileData | null) => void;
  completeOnboarding: (user: ProfileData) => void;
  incrementSessionCount: () => void;
  isAuthenticated: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<ProfileData | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      sessionCount,
      setUser,
      completeOnboarding: (nextUser) => {
        setUser(nextUser);
      },
      incrementSessionCount: () => {
        setSessionCount((count) => count + 1);
      },
      isAuthenticated: user !== null,
    }),
    [user, sessionCount],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
