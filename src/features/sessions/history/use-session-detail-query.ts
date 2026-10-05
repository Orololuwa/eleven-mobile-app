import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { fetchSessionDetail } from '../session-api';
import { historyQueryKey } from '../query-keys';
import { getPendingDeletions, getPendingRenames, initTrackingDb } from '../tracking/db';
import {
  fromServerDetail,
  loadLocalSessionDetail,
  type SessionDetailModel,
} from '../summary/session-detail-model';

const loadSessionDetail = async ({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}): Promise<(SessionDetailModel & { pendingTitle: string | null | undefined }) | null> => {
  await initTrackingDb();
  const deletions = await getPendingDeletions(userId);
  if (deletions.some((row) => row.session_id === sessionId)) return null;
  const renames = await getPendingRenames(userId);
  const pending = renames.find((row) => row.session_id === sessionId);
  const pendingTitle = pending ? pending.title : undefined;
  const local = await loadLocalSessionDetail({ sessionId, userId });
  if (local) return { ...local, pendingTitle };
  const detail = await fetchSessionDetail(sessionId);
  return { ...fromServerDetail(detail), pendingTitle };
};

/** Local copy first (instant, offline); the server only when this phone has none. */
export const useSessionDetailQuery = (sessionId: string) => {
  const userId = useAppStore((state) => state.authUser?.id ?? '');
  return useQuery({
    queryKey: historyQueryKey.detail({ userId, sessionId }),
    queryFn: () => loadSessionDetail({ sessionId, userId }),
    enabled: userId !== '' && sessionId !== '',
    staleTime: 0,
    retry: 1,
  });
};
