import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components';
import { colors, spacing, typography } from '@/theme';
import type { DistanceUnit } from '@/types/profile';
import type { SyncStatus } from '@/features/sessions/tracking/types';
import {
  distanceUnitLabel,
  estimatedSignalCopy,
  formatActiveMinutes,
  formatSprintSeconds,
  formatSummaryDistance,
  formatSummarySpeed,
  formatZoneClock,
  sizeLabel,
  speedUnitLabel,
  sprintCaption,
  zoneRows,
} from '@/features/sessions/summary/display';
import type { DataQuality, SpeedSource, ZoneSeconds } from '@/features/sessions/summary/types';
import type { SpeedBandBoundaries, SpeedBandBucket } from '@/features/sessions/summary/speed-bands';

export type SummarySegmentView = {
  label: string;
  distanceM: number;
  activeDurationSeconds: number;
  sprintCount: number;
  topSpeedKmh: number | null;
  zones: ZoneSeconds;
};

export type SummarySprintView = {
  rank: number;
  distanceM: number;
  durationS: number;
  peakSpeedKmh: number;
};

type SessionSummaryScreenProps = {
  title: string;
  dateLabel: string;
  placeLabel: string;
  contextLabel: string;
  brickNumber: number;
  syncStatus: SyncStatus;
  distanceUnit: DistanceUnit;
  dataQuality: DataQuality;
  speedSource: SpeedSource;
  activeDurationSeconds: number;
  distanceM: number;
  topSpeedKmh: number | null;
  sprintCount: number;
  caloriesKcal: number | null;
  gapSeconds: number;
  acceptedFixCount: number;
  boundaries: SpeedBandBoundaries;
  bucket: SpeedBandBucket;
  pitchLongAxisM: number | null;
  zones: ZoneSeconds;
  segmentHeading: string;
  segments: SummarySegmentView[];
  sprints: SummarySprintView[];
  showRejectedWhy: boolean;
  onOpenRejectedWhy: () => void;
  onCloseRejectedWhy: () => void;
  onDone: () => void;
};

const ZONE_COLORS = {
  walk: '#3E433D',
  jog: '#5C615B',
  run: '#1E4D33',
  high_run: '#8FA36A',
  sprint: '#C8F24E',
} as const;

const approx = (marked: boolean, value: string) => (marked ? `≈ ${value}` : value);

const walkShare = (zones: ZoneSeconds) => {
  const total = zones.walk + zones.jog + zones.run + zones.high_run + zones.sprint;
  if (total <= 0) return 0;
  return zones.walk / total;
};

const fadeLine = (segments: SummarySegmentView[], unit: DistanceUnit) => {
  if (segments.length !== 2) return null;
  const [first, second] = segments;
  if (!first || !second) return null;
  const delta = first.distanceM - second.distanceM;
  if (delta < 100) return null;
  if (Math.abs(first.activeDurationSeconds - second.activeDurationSeconds) > 90) return null;
  const less = formatSummaryDistance({ metres: delta, unit });
  const walking =
    walkShare(second.zones) > walkShare(first.zones) + 0.05
      ? ' — and more of it at walking pace'
      : '';
  return `${less} ${distanceUnitLabel(unit).toLowerCase()} less after the break${walking}.`;
};

export const SessionSummaryScreen: React.FC<SessionSummaryScreenProps> = ({
  title,
  dateLabel,
  placeLabel,
  contextLabel,
  brickNumber,
  syncStatus,
  distanceUnit,
  dataQuality,
  speedSource,
  activeDurationSeconds,
  distanceM,
  topSpeedKmh,
  sprintCount,
  caloriesKcal,
  gapSeconds,
  acceptedFixCount,
  boundaries,
  bucket,
  pitchLongAxisM,
  zones,
  segmentHeading,
  segments,
  sprints,
  showRejectedWhy,
  onOpenRejectedWhy,
  onCloseRejectedWhy,
  onDone,
}) => {
  const [showSprints, setShowSprints] = React.useState(false);
  const estimated = dataQuality === 'estimated';
  const noSpeed = speedSource === 'none';
  const insufficient = dataQuality === 'insufficient';
  const longest = sprints[0];
  const zoneTotal = zones.walk + zones.jog + zones.run + zones.high_run + zones.sprint;
  const caption = sprintCaption({ count: sprintCount, boundaries, bucket, unit: distanceUnit });

  if (showSprints) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.sprintHeader}>
          <TouchableOpacity onPress={() => setShowSprints(false)}>
            <Text style={styles.back}>← SUMMARY</Text>
          </TouchableOpacity>
          <Text style={styles.sprintTitle}>Sprints</Text>
          <Text style={styles.caption}>{approx(estimated, caption)}</Text>
          <Text style={styles.meta}>
            {title} · {Math.round(sprints.reduce((sum, sprint) => sum + sprint.distanceM, 0))} M AT
            SPRINT PACE
          </Text>
        </View>
        <View style={styles.tableHead}>
          <Text style={[styles.tableCell, styles.rankCol]}>#</Text>
          <Text style={[styles.tableCell, styles.grow]}>DISTANCE ▼</Text>
          <Text style={styles.tableCell}>DURATION</Text>
          <Text style={styles.tableCell}>PEAK {speedUnitLabel(distanceUnit)}</Text>
        </View>
        <ScrollView>
          {sprints.map((sprint) => (
            <View key={sprint.rank} style={styles.tableRow}>
              <Text style={[styles.tableValue, styles.rankCol]}>
                {String(sprint.rank).padStart(2, '0')}
              </Text>
              <Text style={[styles.tableValue, styles.grow]}>{Math.round(sprint.distanceM)} M</Text>
              <Text style={styles.tableValue}>{formatSprintSeconds(sprint.durationS)} S</Text>
              <Text style={styles.tableValue}>
                {formatSummarySpeed({ kmh: sprint.peakSpeedKmh, unit: distanceUnit })}
              </Text>
            </View>
          ))}
          <Text style={styles.rankNote}>
            RANKED BY DISTANCE
            {topSpeedKmh != null && longest
              ? ` · FASTEST (${formatSummarySpeed({ kmh: topSpeedKmh, unit: distanceUnit })}) ISN'T THE LONGEST (${Math.round(longest.distanceM)} M)`
              : ''}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <SyncBanner status={syncStatus} onWhy={onOpenRejectedWhy} />
        <Text style={styles.brick}>BRICK {brickNumber} LAID</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {dateLabel} · {placeLabel} · {contextLabel}
        </Text>

        {insufficient ? (
          <View style={styles.insufficient}>
            <Text style={styles.insufficientTitle}>We couldn't track this one properly.</Text>
            <Text style={styles.body}>
              We only had a clear signal for about {acceptedFixCount} seconds. Rather than show
              numbers we can't stand behind, we're showing none.
            </Text>
            <Text style={styles.label}>STILL SAVED</Text>
            <Text style={styles.body}>
              The date, place and type. It'll sit in your history like any other session.
            </Text>
            <Text style={styles.label}>NEXT TIME</Text>
            <Text style={styles.body}>
              Start before you walk on. The phone needs a few seconds in open sky to lock on.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroValue}>
                {approx(
                  estimated,
                  formatSummaryDistance({ metres: distanceM, unit: distanceUnit }),
                )}
              </Text>
              <Text style={styles.heroUnit}>{distanceUnitLabel(distanceUnit)}</Text>
            </View>
            <Text style={styles.heroLabel}>DISTANCE COVERED</Text>

            <View style={styles.grid}>
              <Metric
                label="ACTIVE"
                value={formatActiveMinutes(activeDurationSeconds)}
                unit="MIN"
              />
              <Metric
                label="TOP SPEED"
                value={
                  noSpeed || topSpeedKmh == null
                    ? '—'
                    : formatSummarySpeed({ kmh: topSpeedKmh, unit: distanceUnit })
                }
                unit={speedUnitLabel(distanceUnit)}
              />
              <Metric
                label="SPRINTS"
                value={noSpeed ? '—' : approx(estimated, String(sprintCount))}
                unit="COUNT"
              />
              <Metric
                label="CALORIES"
                value={
                  caloriesKcal == null ? '—' : approx(estimated || noSpeed, String(caloriesKcal))
                }
                unit="KCAL"
              />
            </View>

            {noSpeed ? (
              <Text style={styles.body}>
                Your phone didn't record speed during this session, so we couldn't work out your top
                speed or sprints. Your distance and time are still accurate.
              </Text>
            ) : (
              <>
                <Text style={styles.caption}>{approx(estimated, caption)}</Text>
                <ZoneBar zones={zones} total={zoneTotal} />
                <Text style={styles.zoneNames}>WALK · JOG · RUN · HIGH RUN · SPRINT</Text>
                {longest ? (
                  <TouchableOpacity style={styles.longest} onPress={() => setShowSprints(true)}>
                    <View>
                      <Text style={styles.label}>LONGEST SPRINT</Text>
                      <Text style={styles.longestValue}>
                        {approx(
                          estimated,
                          `${Math.round(longest.distanceM)} M OVER ${formatSprintSeconds(longest.durationS)} S`,
                        )}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.body}>No sprint cleared the line.</Text>
                )}
                {estimated ? (
                  <Text style={styles.body}>
                    {estimatedSignalCopy({ gapSeconds, activeSeconds: activeDurationSeconds })}
                  </Text>
                ) : null}
              </>
            )}

            <Text style={styles.section}>{segmentHeading}</Text>
            <View style={styles.tableHead}>
              <Text style={[styles.tableCell, styles.grow]} />
              <Text style={styles.tableCell}>{distanceUnitLabel(distanceUnit)}</Text>
              <Text style={styles.tableCell}>MIN</Text>
              <Text style={styles.tableCell}>SPR</Text>
              <Text style={styles.tableCell}>TOP</Text>
            </View>
            {segments.map((segment, index) => (
              <View key={`${segment.label}-${index}`} style={styles.tableRow}>
                <Text style={[styles.tableValue, styles.grow]}>{segment.label}</Text>
                <Text style={styles.tableValue}>
                  {formatSummaryDistance({ metres: segment.distanceM, unit: distanceUnit })}
                </Text>
                <Text style={styles.tableValue}>
                  {formatActiveMinutes(segment.activeDurationSeconds)}
                </Text>
                <Text style={styles.tableValue}>{noSpeed ? '—' : segment.sprintCount}</Text>
                <Text style={styles.tableValue}>
                  {noSpeed || segment.topSpeedKmh == null
                    ? '—'
                    : formatSummarySpeed({ kmh: segment.topSpeedKmh, unit: distanceUnit })}
                </Text>
              </View>
            ))}
            {fadeLine(segments, distanceUnit) ? (
              <Text style={styles.body}>{fadeLine(segments, distanceUnit)}</Text>
            ) : null}

            <Text style={styles.section}>SPEED ZONES</Text>
            <Text style={styles.meta}>
              {sizeLabel(bucket)}
              {pitchLongAxisM != null ? ` · ${Math.round(pitchLongAxisM)} M PITCH` : ''}
            </Text>
            {noSpeed ? (
              <>
                <Text style={styles.body}>SPEED ZONES —</Text>
                <Text style={styles.body}>LONGEST SPRINT —</Text>
              </>
            ) : (
              zoneRows(boundaries).map((zone) => (
                <View key={zone.key} style={styles.zoneRow}>
                  <Text style={styles.zoneLabel}>{zone.label}</Text>
                  <Text style={styles.zoneRange}>{zone.range}</Text>
                  <Text style={styles.zoneTime}>{formatZoneClock(zones[zone.key])}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.soon}>SHARE CARD SOON</Text>
        <Text style={styles.soon}>HISTORY SOON</Text>
        <Button title="Done" onPress={onDone} />
      </View>

      {showRejectedWhy ? (
        <View style={styles.whyBackdrop}>
          <View style={styles.whySheet}>
            <Text style={styles.whyTitle}>ON THIS PHONE ONLY</Text>
            <Text style={styles.body}>
              Something in this session didn't pass our checks, so it can't upload. It's kept safe
              on this phone, and we've stopped trying so it won't drain your battery or data.
            </Text>
            <Text style={styles.body}>
              Your numbers above are still yours — they were worked out on the phone.
            </Text>
            <Button title="Got it" onPress={onCloseRejectedWhy} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const Metric = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
  <View style={styles.metric}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricUnit}>{unit}</Text>
  </View>
);

const ZoneBar = ({ zones, total }: { zones: ZoneSeconds; total: number }) => {
  if (total <= 0) return null;
  return (
    <View style={styles.bar}>
      {(Object.keys(ZONE_COLORS) as (keyof typeof ZONE_COLORS)[]).map((key) => (
        <View
          key={key}
          style={{
            flex: zones[key] / total,
            backgroundColor: ZONE_COLORS[key],
            minWidth: zones[key] > 0 ? 2 : 0,
          }}
        />
      ))}
    </View>
  );
};

const SyncBanner = ({ status, onWhy }: { status: SyncStatus; onWhy: () => void }) => {
  if (status === 'synced') {
    return <Text style={styles.synced}>✓ SAFE IN YOUR ACCOUNT</Text>;
  }
  if (status === 'rejected') {
    return (
      <TouchableOpacity onPress={onWhy} style={styles.rejectedRow}>
        <Text style={styles.rejected}>ON THIS PHONE ONLY</Text>
        <Text style={styles.whyLink}>WHY?</Text>
      </TouchableOpacity>
    );
  }
  if (status === 'failed') {
    return (
      <View>
        <Text style={styles.pending}>ON THIS PHONE · NO SIGNAL</Text>
        <Text style={styles.retrying}>RETRYING</Text>
      </View>
    );
  }
  return <Text style={styles.pending}>↑ SAVING TO YOUR ACCOUNT</Text>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    gap: 8,
  },
  brick: {
    marginTop: spacing[4],
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.brand.primary,
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 34,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -1,
    color: colors.text.primary,
  },
  meta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text.secondary,
  },
  hero: {
    marginTop: spacing[6],
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  heroValue: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 64,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
    letterSpacing: -2,
  },
  heroUnit: {
    marginBottom: 12,
    fontFamily: typography.fontFamily.mono,
    fontSize: 14,
    letterSpacing: 1.4,
    color: colors.text.secondary,
  },
  heroLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.secondary,
  },
  grid: {
    marginTop: spacing[4],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    backgroundColor: colors.border.subtle,
  },
  metric: {
    width: '49.6%',
    backgroundColor: colors.background.secondary,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
  },
  label: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.secondary,
  },
  metricValue: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 28,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
  },
  metricUnit: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text.tertiary,
  },
  caption: {
    marginTop: spacing[4],
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.brand.primary,
  },
  bar: {
    marginTop: 8,
    height: 10,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  zoneNames: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text.tertiary,
  },
  longest: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
  longestValue: {
    marginTop: 4,
    fontFamily: typography.fontFamily.primary,
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  chevron: {
    fontSize: 28,
    color: colors.text.secondary,
  },
  body: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
  },
  section: {
    marginTop: spacing[6],
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.primary,
  },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: colors.border.subtle,
  },
  tableCell: {
    width: 52,
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text.tertiary,
    textAlign: 'right',
  },
  tableValue: {
    width: 52,
    fontFamily: typography.fontFamily.primary,
    fontSize: 14,
    color: colors.text.primary,
    textAlign: 'right',
  },
  grow: {
    flex: 1,
    width: undefined,
    textAlign: 'left',
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: colors.border.subtle,
  },
  zoneLabel: {
    width: 90,
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    color: colors.text.primary,
  },
  zoneRange: {
    flex: 1,
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    color: colors.text.secondary,
  },
  zoneTime: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    color: colors.text.primary,
  },
  insufficient: {
    marginTop: spacing[7],
    gap: 8,
  },
  insufficientTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 28,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
    gap: 8,
  },
  soon: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.disabled,
  },
  synced: {
    marginTop: spacing[3],
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.brand.primary,
  },
  pending: {
    marginTop: spacing[3],
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.secondary,
  },
  retrying: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.accent.warning,
  },
  rejectedRow: {
    marginTop: spacing[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rejected: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent.danger,
  },
  whyLink: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.primary,
  },
  whyBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.medium,
  },
  whySheet: {
    backgroundColor: colors.background.elevated,
    padding: spacing[6],
    gap: 12,
  },
  whyTitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.accent.danger,
  },
  sprintHeader: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    gap: 6,
  },
  back: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text.secondary,
  },
  sprintTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 34,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
  },
  rankCol: {
    width: 36,
  },
  rankNote: {
    margin: spacing[6],
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text.secondary,
  },
});
