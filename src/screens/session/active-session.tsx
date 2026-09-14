import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, HoldToConfirmButton, StatusPill } from '@/components';
import { colors, typography, spacing } from '@/theme';
import type { ActivityKind, AttackDirection, PlayStructure } from '@/features/sessions/types';
import {
  activityKindLabel,
  canAddExtraTime,
  canSwitchHalf,
  halvesPhaseLabelLong,
  plannedMinutesForSegment,
} from '@/features/sessions/segment-display';
import {
  formatDistance,
  formatElapsed,
  formatElapsedLong,
  formatSpeed,
} from '@/features/sessions/tracking/live-metrics';
import {
  isExtraTimeEnabled,
  parseTrainingActivityOptions,
} from '@/features/sessions/tracking/types';
import { useTrackingHudStore } from '@/features/sessions/tracking/tracking-store';
import { useTrackingSession } from '@/features/sessions/tracking/use-tracking-session';
import { HOLD_CONFIRM_SECONDS } from '@/features/sessions/tracking/constants';

type ActiveSessionScreenProps = {
  sessionType: string;
  sessionId: string;
  distanceUnit: 'km' | 'mi';
  onEnd: () => void;
};

const halvesCtaLabel = ({
  playStructure,
  extraTimeEnabled,
  segmentIndex,
}: {
  playStructure: PlayStructure;
  extraTimeEnabled: boolean;
  segmentIndex: number;
}): string => {
  if (playStructure !== 'halves') return '';
  if (canSwitchHalf({ playStructure, currentSegmentIndex: segmentIndex })) return 'HALF TIME';
  if (canAddExtraTime({ playStructure, extraTimeEnabled, currentSegmentIndex: segmentIndex })) {
    return 'ADD EXTRA TIME';
  }
  return '';
};

const nextHalvesConfirmTitle = (closedSegmentIndex: number): string => {
  const next = closedSegmentIndex + 1;
  if (next === 2) return 'START SECOND HALF';
  if (next === 3) return 'START ET 1';
  if (next === 4) return 'START ET 2';
  return `START SEGMENT ${next}`;
};

const PermissionScreen: React.FC<{
  onAlways: () => void;
  onWhenInUse: () => void;
  busy?: boolean;
}> = ({ onAlways, onWhenInUse, busy }) => (
  <ScrollView style={styles.content} contentContainerStyle={styles.permissionContent}>
    <Text style={styles.eyebrow}>BEFORE KICKOFF</Text>
    <Text style={styles.permissionTitle}>
      Your phone goes in your pocket.{'\n'}We keep counting.
    </Text>
    <Text style={styles.permissionBody}>
      iOS asks twice for location — corner marking first, then tracking while locked. This is the
      second ask.
    </Text>
    <View style={styles.systemDialog}>
      <Text style={styles.systemDialogText}>
        Allow &quot;Eleven&quot; to use your location even when you&apos;re not using the app?
      </Text>
      <Text style={styles.systemDialogSub}>
        Eleven needs to track your session even while your phone is locked in your pocket.
      </Text>
      <Button title="CHANGE TO ALWAYS ALLOW" onPress={onAlways} loading={busy} />
      <Button title="KEEP WHILE USING" onPress={onWhenInUse} variant="secondary" disabled={busy} />
    </View>
    <Text style={styles.permissionFoot}>
      Keeping While Using still works — tracking pauses when the screen locks and resumes when you
      open the app again.
    </Text>
  </ScrollView>
);

const AndroidPermissionScreen: React.FC<{
  onAllow: () => void;
  busy?: boolean;
}> = ({ onAllow, busy }) => (
  <ScrollView style={styles.content} contentContainerStyle={styles.permissionContent}>
    <Text style={styles.eyebrow}>BEFORE KICKOFF</Text>
    <Text style={styles.permissionTitle}>Allow location to start tracking.</Text>
    <Text style={styles.permissionBody}>
      Android uses a persistent notification — no &quot;All the time&quot; permission needed.
    </Text>
    <Button title="ALLOW LOCATION" onPress={onAllow} loading={busy} />
  </ScrollView>
);

const SegmentSwitchScreen: React.FC<{
  playStructure: PlayStructure;
  segmentIndex: number;
  closedElapsed: number;
  closedDistanceKm: number;
  attackDirection: AttackDirection | null;
  distanceUnit: 'km' | 'mi';
  pendingActivityKind: ActivityKind | null;
  onFlip: () => void;
  onConfirm: () => void;
  busy?: boolean;
}> = ({
  playStructure,
  segmentIndex,
  closedElapsed,
  closedDistanceKm,
  attackDirection,
  distanceUnit,
  pendingActivityKind,
  onFlip,
  onConfirm,
  busy,
}) => {
  const attackingEndA = attackDirection === 'end_a';
  const closedLabel =
    playStructure === 'halves'
      ? halvesPhaseLabelLong(segmentIndex)
      : playStructure === 'sets'
        ? `SET ${segmentIndex}`
        : pendingActivityKind
          ? activityKindLabel(pendingActivityKind)
          : `SEGMENT ${segmentIndex}`;

  const confirmTitle =
    playStructure === 'halves'
      ? nextHalvesConfirmTitle(segmentIndex)
      : playStructure === 'sets'
        ? `START SET ${segmentIndex + 1}`
        : pendingActivityKind
          ? `START ${activityKindLabel(pendingActivityKind)}`
          : 'START NEXT';

  const segmentMeta =
    playStructure === 'halves'
      ? segmentIndex + 1 <= 2
        ? `SEGMENT ${segmentIndex + 1} OF 2`
        : `ET ${segmentIndex - 1}`
      : playStructure === 'sets'
        ? `SET ${segmentIndex + 1}`
        : pendingActivityKind
          ? activityKindLabel(pendingActivityKind)
          : `SEGMENT ${segmentIndex + 1}`;

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.segmentSwitchContent}>
      <Text style={styles.eyebrow}>
        {closedLabel} CLOSED · {formatElapsedLong(closedElapsed)}
      </Text>
      <Text style={styles.permissionTitle}>Swapped ends?</Text>
      <Text style={styles.permissionBody}>
        Compass read against your marked corners. Check before kickoff again.
      </Text>
      <View style={styles.directionPitch}>
        <Text style={styles.endLabelLeft}>HOME END</Text>
        <Text style={styles.endLabelRight}>AWAY END</Text>
        <View style={styles.centreLine} />
        <View style={styles.centreCircle} />
        <View style={[styles.goalBox, styles.goalBoxLeft]} />
        <View style={[styles.goalBox, styles.goalBoxRight]} />
        <Text style={[styles.directionArrows, { color: colors.brand.primary }]}>
          {attackingEndA ? '◀◀◀' : '▶▶▶'}
        </Text>
        <Text style={styles.compassSays}>COMPASS SAYS</Text>
        <Text style={styles.compassResult}>
          ATTACKING {attackingEndA ? 'HOME END' : 'AWAY END'}
        </Text>
      </View>
      <View style={styles.segmentMetaRow}>
        <Text style={styles.segmentMetaChip}>{segmentMeta}</Text>
        <Text style={styles.segmentMetaChip}>
          {closedLabel} {formatDistance({ km: closedDistanceKm, unit: distanceUnit })}{' '}
          {distanceUnit === 'mi' ? 'MI' : 'KM'}
        </Text>
      </View>
      <TouchableOpacity onPress={onFlip}>
        <Text style={styles.flipLink}>FLIP DIRECTION</Text>
      </TouchableOpacity>
      <Button title={confirmTitle} onPress={onConfirm} loading={busy} />
      <Text style={styles.permissionFoot}>
        NO PITCH MARKED? THIS STEP IS SKIPPED — THE SEGMENT STILL COUNTS, THE DIRECTION STAYS BLANK.
      </Text>
    </ScrollView>
  );
};

export const ActiveSessionScreen: React.FC<ActiveSessionScreenProps> = ({
  sessionType,
  sessionId,
  distanceUnit: distanceUnitProp,
  onEnd,
}) => {
  const {
    ready,
    session,
    phase,
    trackingStatus,
    gps,
    distanceUnit: distanceUnitFromHook,
    playStructure: playStructureFromHook,
    pendingActivityKind,
    grantPermissionAndStart,
    pause,
    resume,
    stopCurrentActivity,
    beginSegmentSwitch,
    confirmSegmentSwitch,
    flipPendingDirection,
    endSession,
  } = useTrackingSession({ sessionId });

  const distanceUnit = distanceUnitProp ?? distanceUnitFromHook;

  const elapsedSeconds = useTrackingHudStore((s) => s.elapsedSeconds);
  const extraSeconds = useTrackingHudStore((s) => s.extraSeconds);
  const metrics = useTrackingHudStore((s) => s.metrics);
  const segmentLabel = useTrackingHudStore((s) => s.segmentLabel);
  const pendingAttackDirection = useTrackingHudStore((s) => s.pendingAttackDirection);
  const closedSegmentElapsed = useTrackingHudStore((s) => s.closedSegmentElapsed);
  const closedSegmentDistanceKm = useTrackingHudStore((s) => s.closedSegmentDistanceKm);
  const closedSegmentIndex = useTrackingHudStore((s) => s.closedSegmentIndex);
  const gpsSearchSeconds = useTrackingHudStore((s) => s.gpsSearchSeconds);
  const segmentIndex = useTrackingHudStore((s) => s.segmentIndex);
  const activityKind = useTrackingHudStore((s) => s.activityKind);
  const closedSegmentLabel = useTrackingHudStore((s) => s.closedSegmentLabel);

  const [busy, setBusy] = React.useState(false);

  if (!ready) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.brand.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  const playStructure = playStructureFromHook;
  const plannedMinutes = plannedMinutesForSegment({
    session: session ?? {
      session_type: 'match',
      play_structure: playStructure,
      planned_segment_length_minutes: null,
      planned_extra_time_segment_length_minutes: null,
    },
    segment: { segment_index: segmentIndex },
  });
  const plannedSeconds = plannedMinutes ? plannedMinutes * 60 : null;
  const displayElapsed =
    plannedSeconds != null && extraSeconds > 0 ? plannedSeconds : elapsedSeconds;
  const isOverrun = plannedSeconds != null && extraSeconds > 0;
  const isTraining = playStructure === 'training_activities';
  const trainingOptions = parseTrainingActivityOptions(session?.training_activity_options);
  const extraTimeEnabled = isExtraTimeEnabled(session?.extra_time_enabled);
  const halvesCta = halvesCtaLabel({
    playStructure,
    extraTimeEnabled,
    segmentIndex,
  });
  const setsCta = playStructure === 'sets' ? 'START NEW SET' : '';
  const isActivityLive = isTraining && activityKind != null;
  const trainingIdle = isTraining && !isActivityLive;
  const activityNoun = activityKind ? activityKindLabel(activityKind) : 'ACTIVITY';
  const statusLabel = trainingIdle
    ? 'REST · TRAINING'
    : trackingStatus === 'manual_pause'
      ? `PAUSED · ${sessionType.toUpperCase()} · ${segmentLabel}`
      : trackingStatus === 'auto_pause'
        ? `HOLDING · ${segmentLabel}`
        : `LIVE · ${sessionType.toUpperCase()} · ${segmentLabel}`;

  const statusPillStatus =
    trackingStatus === 'manual_pause'
      ? 'paused'
      : trackingStatus === 'auto_pause'
        ? 'holding'
        : 'live';

  const handleEnd = async () => {
    setBusy(true);
    try {
      await endSession();
      onEnd();
    } finally {
      setBusy(false);
    }
  };

  const handleEndActivity = async () => {
    setBusy(true);
    try {
      await stopCurrentActivity();
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'permission') {
    return (
      <SafeAreaView style={styles.container}>
        {Platform.OS === 'ios' ? (
          <PermissionScreen
            busy={busy}
            onAlways={async () => {
              setBusy(true);
              const ok = await grantPermissionAndStart(true);
              setBusy(false);
              if (!ok) return;
            }}
            onWhenInUse={async () => {
              setBusy(true);
              const ok = await grantPermissionAndStart(false);
              setBusy(false);
              if (!ok) return;
            }}
          />
        ) : (
          <AndroidPermissionScreen
            busy={busy}
            onAllow={async () => {
              setBusy(true);
              const ok = await grantPermissionAndStart(false);
              setBusy(false);
              if (!ok) return;
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  if (phase === 'segment-switch') {
    return (
      <SafeAreaView style={styles.container}>
        <SegmentSwitchScreen
          playStructure={playStructure}
          segmentIndex={closedSegmentIndex}
          closedElapsed={closedSegmentElapsed}
          closedDistanceKm={closedSegmentDistanceKm}
          attackDirection={pendingAttackDirection}
          distanceUnit={distanceUnit}
          pendingActivityKind={pendingActivityKind}
          onFlip={flipPendingDirection}
          onConfirm={async () => {
            setBusy(true);
            await confirmSegmentSwitch(pendingAttackDirection);
            setBusy(false);
          }}
          busy={busy}
        />
      </SafeAreaView>
    );
  }

  const isPaused = trackingStatus !== 'live';
  const metricsDimmed = trackingStatus === 'auto_pause';
  const displayTime = trainingIdle ? closedSegmentElapsed : displayElapsed;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <StatusPill label={statusLabel} status={trainingIdle ? 'paused' : statusPillStatus} />
          <Text style={[styles.gpsStatus, metricsDimmed && styles.dimmed]}>
            {trackingStatus === 'auto_pause' ? 'GPS ▮ WEAK' : gps.label}
          </Text>
        </View>

        {isTraining ? (
          <View style={styles.activityHero}>
            <Text style={styles.activityEyebrow}>
              {trainingIdle
                ? 'BETWEEN ACTIVITIES'
                : trackingStatus === 'manual_pause'
                  ? `${segmentLabel} · PAUSED`
                  : `${segmentLabel} · IN PROGRESS`}
            </Text>
            <Text style={styles.activityTitle}>
              {trainingIdle
                ? closedSegmentLabel
                  ? `${closedSegmentLabel} done.`
                  : 'Ready when you are.'
                : segmentLabel}
            </Text>
            <Text style={styles.activityHint}>
              {trainingIdle
                ? 'GPS is holding. Start the next run, drill, or set when you are ready.'
                : `Clock and distance count this ${activityNoun.toLowerCase()} only. End it when you stop.`}
            </Text>
          </View>
        ) : null}

        <View style={styles.timeSection}>
          <Text style={styles.timeLabel}>
            {trainingIdle
              ? closedSegmentLabel
                ? `${closedSegmentLabel} · LAST`
                : 'ELAPSED'
              : trackingStatus === 'manual_pause'
                ? 'ELAPSED · YOU STOPPED IT'
                : trackingStatus === 'auto_pause'
                  ? 'ELAPSED · CLOCK STOPPED'
                  : plannedMinutes
                    ? `ELAPSED · PLANNED ${formatElapsed(plannedMinutes * 60)}`
                    : isActivityLive
                      ? `THIS ${activityNoun}`
                      : 'ELAPSED'}
          </Text>
          <Text style={[styles.timeValue, (isOverrun || trainingIdle) && styles.timeValueMuted]}>
            {formatElapsed(displayTime)}
          </Text>
        </View>

        {isOverrun && trackingStatus === 'live' ? (
          <View style={styles.extraTimeCard}>
            <View>
              <Text style={styles.extraTimeLabel}>EXTRA TIME</Text>
              <Text style={styles.extraTimeHint}>Ref hasn&apos;t blown yet</Text>
            </View>
            <Text style={styles.extraTimeValue}>+{formatElapsed(extraSeconds)}</Text>
          </View>
        ) : null}

        {trackingStatus === 'auto_pause' ? (
          <View style={styles.autoPauseBlock}>
            <Text style={styles.autoPauseTitle}>Lost you for a second.</Text>
            <Text style={styles.autoPauseSub}>SEARCHING {gpsSearchSeconds}S</Text>
            <Text style={styles.autoPauseFoot}>RESUMES ON ITS OWN — NOTHING TO TAP</Text>
          </View>
        ) : null}

        {trackingStatus === 'manual_pause' ? (
          <View style={styles.manualPauseBlock}>
            <Text style={styles.autoPauseTitle}>Take your time.</Text>
            <Text style={styles.pauseListLabel}>
              BREAKS THIS{' '}
              {playStructure === 'halves'
                ? 'HALF'
                : playStructure === 'sets'
                  ? 'SET'
                  : activityNoun}
            </Text>
            <Text style={styles.pauseListItem}>YOUR PAUSE · RUNNING</Text>
          </View>
        ) : null}

        <View style={[styles.primaryStats, metricsDimmed && styles.dimmed]}>
          <View style={styles.primaryStat}>
            <Text style={styles.primaryStatLabel}>
              {trainingIdle ? 'LAST DISTANCE' : 'DISTANCE'}
            </Text>
            <Text style={styles.primaryStatValue}>
              {formatDistance({
                km: trainingIdle ? closedSegmentDistanceKm : metrics.distanceKm,
                unit: distanceUnit,
              })}
              <Text style={styles.primaryStatUnit}> {distanceUnit === 'mi' ? 'MI' : 'KM'}</Text>
            </Text>
          </View>
          {trainingIdle ? null : (
            <View style={[styles.primaryStat, styles.primaryStatBorder]}>
              <Text style={styles.primaryStatLabel}>TOP SPEED</Text>
              <Text style={[styles.primaryStatValue, styles.speedHighlight]}>
                {formatSpeed({ kmh: metrics.topSpeedKmh, unit: distanceUnit })}
                <Text style={styles.primaryStatUnit}>
                  {' '}
                  {distanceUnit === 'mi' ? 'MPH' : 'KM/H'}
                </Text>
              </Text>
            </View>
          )}
        </View>

        {isOverrun && trackingStatus === 'live' ? (
          <Text style={styles.helperCopy}>
            The clock keeps running past the planned mark. Eleven never auto-switches halves — you
            decide when to switch.
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {trackingStatus === 'manual_pause' ? (
          <>
            <Button title="RESUME" onPress={() => void resume()} />
            {isActivityLive ? (
              <HoldToConfirmButton
                title={`HOLD TO END CURRENT ${activityNoun}`}
                variant="secondary"
                onConfirm={() => void handleEndActivity()}
                disabled={busy}
                style={styles.holdFullWidth}
              />
            ) : null}
            <HoldToConfirmButton
              title="HOLD TO END SESSION"
              onConfirm={() => void handleEnd()}
              disabled={busy}
              style={styles.holdFullWidth}
            />
          </>
        ) : trackingStatus === 'auto_pause' ? null : (
          <>
            {isActivityLive ? (
              <HoldToConfirmButton
                title={`HOLD TO END CURRENT ${activityNoun}`}
                variant="secondary"
                onConfirm={() => void handleEndActivity()}
                disabled={busy}
                style={styles.holdFullWidth}
              />
            ) : null}
            {trainingIdle
              ? trainingOptions.map((kind) => (
                  <Button
                    key={kind}
                    title={`START ${activityKindLabel(kind)}`}
                    onPress={() => void beginSegmentSwitch({ activityKind: kind })}
                    disabled={busy}
                    variant="secondary"
                  />
                ))
              : null}
            {!isTraining && !isPaused && halvesCta ? (
              <Button title={halvesCta} onPress={() => void beginSegmentSwitch()} disabled={busy} />
            ) : null}
            {!isTraining && !isPaused && setsCta ? (
              <Button title={setsCta} onPress={() => void beginSegmentSwitch()} disabled={busy} />
            ) : null}
            <View style={styles.holdRow}>
              {trainingIdle ? null : (
                <HoldToConfirmButton
                  title="HOLD TO PAUSE"
                  onConfirm={() => void pause()}
                  variant="secondary"
                  disabled={busy}
                />
              )}
              <HoldToConfirmButton
                title="HOLD TO END"
                onConfirm={() => void handleEnd()}
                variant="danger"
                disabled={busy}
              />
            </View>
            <Text style={styles.endHint}>
              {`HOLD ${HOLD_CONFIRM_SECONDS} SECONDS · NO ACCIDENTAL STOPS`}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpsStatus: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  dimmed: {
    opacity: 0.45,
  },
  activityHero: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    gap: 10,
  },
  activityEyebrow: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.2 * 11,
    color: colors.brand.primary,
  },
  activityTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.025 * 30,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text.primary,
  },
  activityHint: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
  },
  timeSection: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[11],
    gap: 6,
  },
  timeLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: colors.text.secondary,
  },
  timeValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 82,
    lineHeight: 82,
    letterSpacing: -0.03 * 82,
    color: colors.text.primary,
  },
  timeValueMuted: {
    color: colors.text.secondary,
  },
  extraTimeCard: {
    marginHorizontal: spacing[6],
    marginTop: spacing[6],
    borderWidth: 1,
    borderColor: colors.brand.primary,
    padding: spacing[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  extraTimeLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: colors.brand.primary,
  },
  extraTimeHint: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  extraTimeValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 46,
    color: colors.brand.primary,
  },
  primaryStats: {
    marginTop: spacing[9],
    flexDirection: 'row',
    gap: 1,
    backgroundColor: colors.border.subtle,
  },
  primaryStat: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 8,
    paddingVertical: spacing[4],
    gap: 8,
  },
  primaryStatBorder: {
    paddingLeft: 20,
  },
  primaryStatLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: colors.text.secondary,
  },
  primaryStatValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 38,
    lineHeight: 38,
    letterSpacing: -0.03 * 38,
    color: colors.text.primary,
  },
  speedHighlight: {
    color: colors.brand.primary,
  },
  primaryStatUnit: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  helperCopy: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    fontFamily: typography.fontFamily.primary,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    paddingBottom: spacing[9],
    gap: 12,
  },
  holdRow: {
    flexDirection: 'row',
    gap: 12,
  },
  holdFullWidth: {
    flex: 0,
    alignSelf: 'stretch',
  },
  endHint: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.disabled,
    textAlign: 'center',
  },
  autoPauseBlock: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    gap: 8,
  },
  autoPauseTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 24,
    color: colors.text.primary,
  },
  autoPauseSub: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.accent.danger,
    letterSpacing: 0.16 * 11,
  },
  autoPauseFoot: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    color: colors.text.disabled,
    letterSpacing: 0.14 * 10,
    marginTop: spacing[4],
  },
  manualPauseBlock: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    gap: 8,
  },
  pauseListLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    color: colors.text.secondary,
    letterSpacing: 0.18 * 10,
    marginTop: spacing[4],
  },
  pauseListItem: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    color: colors.text.primary,
  },
  permissionContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[12],
    gap: spacing[5],
  },
  eyebrow: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.2 * 10,
    color: colors.text.secondary,
  },
  permissionTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  permissionBody: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
  },
  systemDialog: {
    backgroundColor: colors.background.tertiary,
    padding: spacing[5],
    gap: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  systemDialogText: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    color: colors.text.primary,
  },
  systemDialogSub: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 14,
    color: colors.text.secondary,
  },
  permissionFoot: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    color: colors.text.disabled,
    lineHeight: 16,
    letterSpacing: 0.12 * 10,
  },
  segmentSwitchContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[12],
    gap: spacing[5],
  },
  directionPitch: {
    height: 180,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    position: 'relative',
    overflow: 'hidden',
  },
  endLabelLeft: {
    position: 'absolute',
    left: 12,
    top: 8,
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    color: colors.text.secondary,
  },
  endLabelRight: {
    position: 'absolute',
    right: 12,
    top: 8,
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    color: colors.text.secondary,
  },
  centreLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border.default,
  },
  centreCircle: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border.default,
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -24,
  },
  goalBox: {
    position: 'absolute',
    top: '30%',
    height: '40%',
    width: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  goalBoxLeft: { left: 0, borderLeftWidth: 0 },
  goalBoxRight: { right: 0, borderRightWidth: 0 },
  directionArrows: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -10,
    fontSize: 16,
  },
  compassSays: {
    position: 'absolute',
    bottom: 28,
    left: 12,
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    color: colors.text.secondary,
  },
  compassResult: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.brand.primary,
  },
  segmentMetaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentMetaChip: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    color: colors.text.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  flipLink: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    letterSpacing: 0.16 * 12,
  },
});
