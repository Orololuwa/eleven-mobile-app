import { router } from 'expo-router';
import { useStartSessionDraftStore } from './start-session-draft-store';
import type { SessionType } from './types';

const toSessionType = (type: string): SessionType =>
  type === 'training' || type === 'futsal' || type === 'match' ? type : 'match';

/** Starts the Start Session wizard for the type picked in `SessionTypeSheet`. */
export const beginSessionSetup = (type: string) => {
  const sessionType = toSessionType(type);
  const { reset, setSessionType } = useStartSessionDraftStore.getState();
  reset();
  setSessionType(sessionType);
  router.push({ pathname: '/(app)/play-structure', params: { sessionType } });
};
