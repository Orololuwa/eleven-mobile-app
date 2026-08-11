import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';

type SessionDetailTab = 'HEATMAP' | 'SPRINTS' | 'SPEED' | 'STATS';

type SessionDetailData = {
  title: string;
  date: string;
  location: string;
  duration: number;
  distance: number;
  topSpeed: number;
  sprints: number;
  calories: number;
  longestSprint: number;
  sprintDistance: number;
  recoveryTime: number;
  hasHeatmap: boolean;
};

type SessionDetailScreenProps = {
  sessionData: SessionDetailData;
  onBack: () => void;
  onShare: () => void;
  onNavigateToHome: () => void;
};

const MOCK_DATA: SessionDetailData = {
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
};

const TABS: SessionDetailTab[] = ['HEATMAP', 'SPRINTS', 'SPEED', 'STATS'];

export const SessionDetailScreen: React.FC<SessionDetailScreenProps> = ({
  sessionData = MOCK_DATA,
  onBack,
  onShare,
  onNavigateToHome,
}) => {
  const [activeTab, setActiveTab] = useState<SessionDetailTab>('HEATMAP');

  return (
    <SafeAreaView style={styles.container}>
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.time}>12:04</Text>
        <Text style={styles.statusIcons}>▮▮▮ ⌁ ▰</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.sessionTitle}>{sessionData.title}</Text>
            <Text style={styles.sessionMeta}>{sessionData.date}</Text>
          </View>
          <TouchableOpacity onPress={onShare}>
            <Text style={styles.shareButton}>SHARE</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Pills */}
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabPillText, activeTab === tab && styles.tabPillTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'HEATMAP' && <HeatmapTab data={sessionData} />}
        {activeTab === 'SPRINTS' && <SprintsTab data={sessionData} />}
        {activeTab === 'SPEED' && <SpeedTab data={sessionData} />}
        {activeTab === 'STATS' && <StatsTab data={sessionData} />}
      </ScrollView>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.navTab} onPress={onNavigateToHome}>
          <Text style={styles.navTabText}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navTab}>
          <Text style={styles.navTabTextActive}>HISTORY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navTab}>
          <Text style={styles.navTabText}>PROFILE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ── Heatmap Tab ─────────────────────────────────────────────────────────────

const HeatmapTab: React.FC<{ data: SessionDetailData }> = ({ data }) => {
  const [half, setHalf] = useState<'1ST' | '2ND' | 'FULL'>('1ST');

  return (
    <View style={styles.tabContent}>
      {/* Pitch with heatmap */}
      <View style={styles.pitchContainer}>
        {/* Pitch markings */}
        <View style={styles.pitchCentreLine} />
        <View style={styles.pitchCentreCircle} />
        <View style={[styles.pitchBox, styles.pitchBoxLeft]} />
        <View style={[styles.pitchBox, styles.pitchBoxRight]} />
        <View style={[styles.pitchPost, styles.pitchPostLeft]} />
        <View style={[styles.pitchPost, styles.pitchPostRight]} />

        {/* Heat blobs */}
        <HeatBlobs half={half} />

        <Text style={styles.pitchHalfLabel}>
          {half === '1ST' ? '1ST HALF ▶' : half === '2ND' ? '2ND HALF ▶' : 'FULL MATCH'}
        </Text>
        <Text style={styles.pitchSize}>64 × 42 M</Text>
      </View>

      {/* Legend + flip */}
      <View style={styles.legendRow}>
        <View style={styles.legend}>
          <Text style={styles.legendLabel}>LOW</Text>
          <View style={styles.legendBar}>
            {[0.14, 0.34, 0.58, 0.80, 1].map((op, i) => (
              <View
                key={i}
                style={[styles.legendSegment, { backgroundColor: `rgba(200,242,78,${op})` }]}
              />
            ))}
          </View>
          <Text style={styles.legendLabel}>HIGH</Text>
        </View>
        <TouchableOpacity>
          <Text style={styles.flipPitchButton}>⇄ FLIP PITCH</Text>
        </TouchableOpacity>
      </View>

      {/* Half selector */}
      <View style={styles.halfSelector}>
        {(['1ST', '2ND', 'FULL'] as const).map((h) => (
          <TouchableOpacity
            key={h}
            style={styles.halfOption}
            onPress={() => setHalf(h)}
          >
            <Text style={styles.halfOptionLabel}>{h} HALF</Text>
            <Text style={[styles.halfOptionAction, half === h && styles.halfOptionShowing]}>
              {half === h ? 'SHOWING' : 'SHOW'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Analysis */}
      <View style={styles.analysis}>
        <Text style={styles.analysisText}>
          You held the{' '}
          <Text style={{ color: colors.brand.primary }}>left half-space</Text>
          {' '}— 41% of your minutes in the middle third, drifting wide when the ball turned over.
        </Text>
      </View>
    </View>
  );
};

const HeatBlobs: React.FC<{ half: string }> = ({ half }) => {
  const blobs =
    half === '1ST'
      ? [
          { left: '15%', top: '30%', size: 80, opacity: 0.9 },
          { left: '25%', top: '55%', size: 60, opacity: 0.7 },
          { left: '40%', top: '40%', size: 50, opacity: 0.6 },
          { left: '10%', top: '65%', size: 45, opacity: 0.5 },
        ]
      : half === '2ND'
      ? [
          { left: '55%', top: '30%', size: 80, opacity: 0.9 },
          { left: '65%', top: '55%', size: 60, opacity: 0.7 },
          { left: '45%', top: '45%', size: 50, opacity: 0.6 },
          { left: '70%', top: '25%', size: 45, opacity: 0.5 },
        ]
      : [
          { left: '20%', top: '35%', size: 90, opacity: 0.9 },
          { left: '50%', top: '50%', size: 70, opacity: 0.7 },
          { left: '35%', top: '60%', size: 55, opacity: 0.6 },
          { left: '65%', top: '30%', size: 50, opacity: 0.5 },
        ];

  return (
    <>
      {blobs.map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: b.left as any,
            top: b.top as any,
            width: b.size,
            height: b.size,
            borderRadius: b.size / 2,
            backgroundColor: `rgba(200,242,78,${b.opacity * 0.55})`,
          }}
        />
      ))}
    </>
  );
};

// ── Sprints Tab ──────────────────────────────────────────────────────────────

const SprintsTab: React.FC<{ data: SessionDetailData }> = ({ data }) => (
  <View style={styles.tabContent}>
    {/* Sprint pitch */}
    <View style={styles.pitchContainer}>
      <View style={styles.pitchCentreLine} />
      <View style={styles.pitchCentreCircle} />
      <View style={[styles.pitchBox, styles.pitchBoxLeft]} />
      <View style={[styles.pitchBox, styles.pitchBoxRight]} />
      <SprintLines />
      <Text style={styles.pitchHalfLabel}>{data.sprints} SPRINTS ▶ 20+ KM/H</Text>
    </View>

    {/* Time by third */}
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>TIME BY THIRD</Text>
      <ZoneBar label="DEFENSIVE" percent={27} />
      <ZoneBar label="MIDDLE" percent={41} isHighlight />
      <ZoneBar label="ATTACKING" percent={32} />
    </View>

    {/* Sprint stats */}
    <View style={styles.statsGrid}>
      <View style={styles.statsRow}>
        <StatBox label="LONGEST SPRINT" value={`${data.longestSprint}`} unit="M" />
        <StatBox label="SPRINT DIST." value={`${data.sprintDistance}`} unit="KM" />
        <StatBox label="RECOVERY" value={`${data.recoveryTime}`} unit="S" />
      </View>
    </View>

    {/* Analysis */}
    <View style={styles.analysis}>
      <Text style={styles.analysisText}>
        Most of your sprints came in the{' '}
        <Text style={{ color: colors.brand.primary }}>second half</Text>
        {' '}— 17 of {data.sprints}. You finished stronger than you started.
      </Text>
    </View>
  </View>
);

const SprintLines: React.FC = () => {
  const lines = [
    { x1: 10, y1: 30, x2: 65, y2: 28 },
    { x1: 20, y1: 60, x2: 80, y2: 55 },
    { x1: 30, y1: 80, x2: 85, y2: 75 },
    { x1: 50, y1: 20, x2: 95, y2: 22 },
    { x1: 5, y1: 90, x2: 60, y2: 85 },
  ];
  return (
    <>
      {lines.map((l, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${l.x1}%` as any,
            top: `${l.y1}%` as any,
            width: `${l.x2 - l.x1}%` as any,
            height: 2,
            backgroundColor: colors.brand.primary,
            opacity: 0.7,
          }}
        />
      ))}
    </>
  );
};

const ZoneBar: React.FC<{ label: string; percent: number; isHighlight?: boolean }> = ({
  label,
  percent,
  isHighlight,
}) => (
  <View style={styles.zoneRow}>
    <Text style={styles.zoneLabel}>{label}</Text>
    <View style={styles.zoneTrack}>
      <View
        style={[
          styles.zoneFill,
          { width: `${percent}%` },
          isHighlight
            ? { backgroundColor: colors.brand.primary }
            : { backgroundColor: 'rgba(200,242,78,0.45)' },
        ]}
      />
    </View>
    <Text style={[styles.zonePercent, isHighlight && { color: colors.brand.primary }]}>
      {percent}%
    </Text>
  </View>
);

// ── Speed Tab ────────────────────────────────────────────────────────────────

const SpeedTab: React.FC<{ data: SessionDetailData }> = ({ data }) => {
  // Generate speed trace bars
  const bars = Array.from({ length: 46 }, (_, i) => {
    const v = 18 + Math.round(52 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.31))) + (i % 7 === 0 ? 44 : 0);
    const height = Math.min(v, 118);
    const hot = height > 80;
    return { height, hot };
  });

  return (
    <View style={styles.tabContent}>
      {/* Speed trace */}
      <View style={styles.section}>
        <View style={styles.speedHeader}>
          <Text style={styles.sectionLabel}>SPEED TRACE</Text>
          <Text style={styles.topSpeedLabel}>TOP {data.topSpeed} KM/H</Text>
        </View>
        <View style={styles.speedTrace}>
          {bars.map((bar, i) => (
            <View
              key={i}
              style={[
                styles.speedBar,
                {
                  height: bar.height,
                  backgroundColor: bar.hot
                    ? colors.brand.primary
                    : 'rgba(242,241,236,0.22)',
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Speed zones */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SPEED ZONES</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatBox label="WALKING" value="22" unit="%" />
            <StatBox label="JOGGING" value="45" unit="%" />
            <StatBox label="RUNNING" value="24" unit="%" />
          </View>
          <View style={styles.statsRow}>
            <StatBox label="HIGH RUN" value="7" unit="%" />
            <StatBox label="SPRINT" value="2" unit="%" />
            <StatBox label="TOP KM/H" value={`${data.topSpeed}`} unit="" />
          </View>
        </View>
      </View>

      <View style={styles.analysis}>
        <Text style={styles.analysisText}>
          Your peak speed of{' '}
          <Text style={{ color: colors.brand.primary }}>{data.topSpeed} km/h</Text>
          {' '}was hit in the second half — consistent with your sprint data.
        </Text>
      </View>
    </View>
  );
};

// ── Stats Tab ────────────────────────────────────────────────────────────────

const StatsTab: React.FC<{ data: SessionDetailData }> = ({ data }) => (
  <View style={styles.tabContent}>
    <View style={styles.statsGrid}>
      <View style={styles.statsRow}>
        <StatBox label="DISTANCE" value={`${data.distance}`} unit="KM" isLarge />
        <StatBox label="TOP SPEED" value={`${data.topSpeed}`} unit="KM/H" isLarge />
      </View>
      <View style={styles.statsRow}>
        <StatBox label="DURATION" value={`${data.duration}`} unit="MIN" />
        <StatBox label="SPRINTS" value={`${data.sprints}`} unit="" />
        <StatBox label="CALORIES" value={`${data.calories}`} unit="KCAL" />
      </View>
      <View style={styles.statsRow}>
        <StatBox label="LONGEST SPRINT" value={`${data.longestSprint}`} unit="M" />
        <StatBox label="SPRINT DIST." value={`${data.sprintDistance}`} unit="KM" />
        <StatBox label="RECOVERY" value={`${data.recoveryTime}`} unit="S" />
      </View>
    </View>
  </View>
);

// ── Shared Components ────────────────────────────────────────────────────────

const StatBox: React.FC<{
  label: string;
  value: string;
  unit: string;
  isLarge?: boolean;
}> = ({ label, value, unit, isLarge }) => (
  <View style={[styles.statBox, isLarge && styles.statBoxLarge]}>
    <Text style={styles.statBoxLabel}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
      <Text style={[styles.statBoxValue, isLarge && styles.statBoxValueLarge]}>{value}</Text>
      {!!unit && <Text style={styles.statBoxUnit}>{unit}</Text>}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  statusBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
  },
  time: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    color: colors.text.primary,
  },
  statusIcons: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.text.secondary,
  },
  scroll: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    gap: 6,
  },
  sessionTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 24,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.03 * 24,
    color: colors.text.primary,
  },
  sessionMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  shareButton: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.brand.primary,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
    gap: 8,
  },
  tabPill: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabPillActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary,
  },
  tabPillText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  tabPillTextActive: {
    color: colors.background.secondary,
    fontWeight: typography.fontWeight.semibold,
  },
  tabContent: {
    gap: 0,
  },
  // Pitch
  pitchContainer: {
    marginHorizontal: spacing[6],
    height: 200,
    backgroundColor: colors.background.pitch,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: 'hidden',
    position: 'relative',
  },
  pitchCentreLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(242,241,236,0.30)',
  },
  pitchCentreCircle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 56,
    height: 56,
    marginLeft: -28,
    marginTop: -28,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(242,241,236,0.30)',
  },
  pitchBox: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 90,
    marginTop: -45,
    borderWidth: 1,
    borderColor: 'rgba(242,241,236,0.30)',
  },
  pitchBoxLeft: {
    left: 0,
    borderLeftWidth: 0,
  },
  pitchBoxRight: {
    right: 0,
    borderRightWidth: 0,
  },
  pitchPost: {
    position: 'absolute',
    top: '50%',
    width: 8,
    height: 34,
    marginTop: -17,
    backgroundColor: 'rgba(242,241,236,0.2)',
  },
  pitchPostLeft: {
    left: 0,
  },
  pitchPostRight: {
    right: 0,
  },
  pitchHalfLabel: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.text.primary,
  },
  pitchSize: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.text.primary,
  },
  // Heatmap
  legendRow: {
    paddingHorizontal: spacing[6],
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.14 * 9,
    color: colors.text.secondary,
  },
  legendBar: {
    flexDirection: 'row',
  },
  legendSegment: {
    width: 20,
    height: 8,
  },
  flipPitchButton: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.brand.primary,
  },
  halfSelector: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: colors.border.subtle,
    marginTop: spacing[5],
  },
  halfOption: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    padding: 14,
    gap: 5,
  },
  halfOptionLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.text.secondary,
  },
  halfOptionAction: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.text.secondary,
  },
  halfOptionShowing: {
    color: colors.brand.primary,
  },
  analysis: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
  },
  analysisText: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 19,
    lineHeight: 19 * 1.4,
    color: colors.text.primary,
  },
  // Sprints
  section: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    gap: 14,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.secondary,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  zoneLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
    width: 74,
  },
  zoneTrack: {
    flex: 1,
    height: 16,
    backgroundColor: 'rgba(242,241,236,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  zoneFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  zonePercent: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    width: 38,
    textAlign: 'right',
    color: colors.text.primary,
  },
  // Stats grid
  statsGrid: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    gap: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: colors.border.subtle,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    padding: 14,
    gap: 6,
  },
  statBoxLarge: {
    padding: 16,
  },
  statBoxLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.text.secondary,
  },
  statBoxValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 22,
    color: colors.text.primary,
  },
  statBoxValueLarge: {
    fontSize: 26,
  },
  statBoxUnit: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    color: colors.text.secondary,
  },
  // Speed tab
  speedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  topSpeedLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: colors.brand.primary,
  },
  speedTrace: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 120,
  },
  speedBar: {
    flex: 1,
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: 16,
    height: 76,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
  },
  navTabText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.disabled,
  },
  navTabTextActive: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.brand.primary,
  },
});
