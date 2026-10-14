import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Button } from '@/components';
import { SessionSummaryScreen } from '@/screens/session/session-summary';
import { SessionRenameSheet } from '@/screens/session/session-rename-sheet';
import { SessionDeleteSheet } from '@/screens/session/session-delete-sheet';
import { formatSummaryDate, sizeLabel } from '@/features/sessions/summary/display';
import {
  deriveSessionTitle,
  displaySessionTitle,
} from '@/features/sessions/summary/session-presentation';
import { useSessionDetailQuery } from '@/features/sessions/history/use-session-detail-query';
import { useRenameSessionMutation } from '@/features/sessions/history/use-rename-session-mutation';
import { useDeleteSessionMutation } from '@/features/sessions/history/use-delete-session-mutation';
import { retrySessionSync } from '@/features/sessions/tracking/sync';
import { useAppStore } from '@/stores/app-store';
import { useColors } from '@/theme';

const laidBricks = new Set<string>();

const SEGMENT_HEADING = {
  halves: 'BY HALF',
  sets: 'BY SET',
  training_activities: 'BY ACTIVITY',
} as const;

export default function SessionSummaryRoute() {
  const navigation = useNavigation();
  const colors = useColors();
  const { sessionId = '', from } = useLocalSearchParams<{ sessionId?: string; from?: string }>();
  const fromHistory = from === 'history';
  const units = useAppStore((state) => state.units);
  const sessionCount = useAppStore((state) => state.sessionCount);
  const incrementSessionCount = useAppStore((state) => state.incrementSessionCount);
  const distanceUnit = units.distance === 'mi' ? 'mi' : 'km';
  const [showWhy, setShowWhy] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const detail = useSessionDetailQuery(sessionId);
  const rename = useRenameSessionMutation();
  const remove = useDeleteSessionMutation();

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: fromHistory, headerShown: false });
  }, [navigation, fromHistory]);

  useEffect(() => {
    if (fromHistory || !sessionId || laidBricks.has(sessionId)) return;
    laidBricks.add(sessionId);
    incrementSessionCount();
  }, [fromHistory, incrementSessionCount, sessionId]);

  const leave = () => (fromHistory ? router.back() : router.replace('/(app)/(tabs)'));

  if (detail.isPending) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.background.secondary, justifyContent: 'center' }}
      >
        <ActivityIndicator color={colors.brand.ink} />
      </View>
    );
  }

  const model = detail.data;
  if (!model) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background.secondary,
          justifyContent: 'center',
          padding: 24,
          gap: 16,
        }}
      >
        <Text style={{ color: colors.text.primary, fontSize: 18 }}>
          {fromHistory
            ? "Couldn't load this session."
            : "This session's numbers aren't on the phone."}
        </Text>
        {fromHistory ? <Button title="Try again" onPress={() => void detail.refetch()} /> : null}
        <Button title="Done" variant="secondary" onPress={leave} />
      </View>
    );
  }

  const brickNumber = fromHistory
    ? null
    : sessionId && laidBricks.has(sessionId)
      ? sessionCount
      : sessionCount + 1;

  const derivedTitle = deriveSessionTitle({
    startedAt: model.startedAt,
    sessionType: model.sessionType,
  });
  const overrideTitle = model.pendingTitle === undefined ? model.storedTitle : model.pendingTitle;
  const title = displaySessionTitle({
    startedAt: model.startedAt,
    sessionType: model.sessionType,
    title: model.storedTitle,
    pendingTitle: model.pendingTitle,
  });

  const contextLabel =
    model.playStructure === 'training_activities'
      ? model.segmentCount === 1
        ? '1 ACTIVITY'
        : `${model.segmentCount} ACTIVITIES`
      : sizeLabel(model.metrics?.bucket ?? 'full');

  return (
    <>
      <SessionSummaryScreen
        title={title}
        dateLabel={formatSummaryDate(model.startedAt)}
        placeLabel={model.pitchName?.toUpperCase() ?? 'NO PITCH'}
        contextLabel={contextLabel}
        brickNumber={brickNumber}
        syncStatus={model.syncStatus}
        distanceUnit={distanceUnit}
        metrics={model.metrics}
        segmentHeading={SEGMENT_HEADING[model.playStructure]}
        segments={model.segments}
        sprints={model.sprints}
        backLabel={fromHistory ? '← HISTORY' : null}
        showRejectedWhy={showWhy}
        onBack={leave}
        onOpenRejectedWhy={() => setShowWhy(true)}
        onCloseRejectedWhy={() => setShowWhy(false)}
        onResync={() => {
          setShowWhy(false);
          void retrySessionSync(model.id);
        }}
        onRename={() => setShowRename(true)}
        onDelete={() => setShowDelete(true)}
        onOpenHistory={fromHistory ? null : () => router.replace('/(app)/(tabs)/history')}
        onDone={leave}
      />
      <SessionRenameSheet
        visible={showRename}
        currentTitle={overrideTitle}
        derivedTitle={derivedTitle}
        busy={rename.isPending}
        onDismiss={() => setShowRename(false)}
        onSave={(next) =>
          rename.mutate(
            { sessionId: model.id, title: next },
            { onSuccess: () => setShowRename(false) },
          )
        }
      />
      <SessionDeleteSheet
        visible={showDelete}
        isOnlyCopy={model.syncStatus === 'rejected'}
        busy={remove.isPending}
        onDismiss={() => setShowDelete(false)}
        onConfirm={() =>
          remove.mutate(
            { sessionId: model.id, sessionType: model.sessionType },
            {
              onSuccess: () => {
                setShowDelete(false);
                leave();
              },
            },
          )
        }
      />
    </>
  );
}
