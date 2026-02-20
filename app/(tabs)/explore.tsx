import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { loadRecords } from '@/utils/storage';
import { WeightRecord } from '@/types';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;

type ChartMode = 'weight' | 'waist';

function formatLabel(dateStr: string) {
  const [, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}`;
}

const CHART_CONFIG = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(113, 128, 150, ${opacity})`,
  strokeWidth: 2.5,
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#4CAF50',
    fill: '#fff',
  },
  propsForBackgroundLines: {
    stroke: '#F0F4F8',
  },
  decimalPlaces: 1,
};

export default function ChartScreen() {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [mode, setMode] = useState<ChartMode>('weight');

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => {
        setRecords([...data].sort((a, b) => a.date.localeCompare(b.date)));
      });
    }, [])
  );

  const weightRecords = records.filter((r) => r.weight > 0);
  const waistRecords = records.filter((r) => r.waist != null);

  const chartRecords = (mode === 'weight' ? weightRecords : waistRecords).slice(-20);
  const hasData = chartRecords.length >= 2;

  // 라벨이 너무 많으면 일부만 표시
  const labelStep = chartRecords.length > 10 ? Math.ceil(chartRecords.length / 6) : 1;
  const labels = chartRecords.map((r, i) =>
    i % labelStep === 0 ? formatLabel(r.date) : ''
  );

  const dataValues = chartRecords.map((r) =>
    mode === 'weight' ? r.weight : (r.waist as number)
  );

  const stats =
    weightRecords.length > 0
      ? {
          current: weightRecords[weightRecords.length - 1].weight,
          max: Math.max(...weightRecords.map((r) => r.weight)),
          min: Math.min(...weightRecords.map((r) => r.weight)),
          avg:
            weightRecords.reduce((s, r) => s + r.weight, 0) / weightRecords.length,
          diff:
            weightRecords.length >= 2
              ? weightRecords[weightRecords.length - 1].weight -
                weightRecords[0].weight
              : null,
        }
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📊 기록 그래프</Text>

      {/* 모드 토글 */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'weight' && styles.toggleActive]}
          onPress={() => setMode('weight')}
        >
          <Text style={[styles.toggleText, mode === 'weight' && styles.toggleTextActive]}>
            ⚖️ 몸무게
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'waist' && styles.toggleActive]}
          onPress={() => setMode('waist')}
        >
          <Text style={[styles.toggleText, mode === 'waist' && styles.toggleTextActive]}>
            📏 허리둘레
          </Text>
        </TouchableOpacity>
      </View>

      {/* 차트 */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>
          {mode === 'weight' ? '몸무게 추이 (kg)' : '허리둘레 추이 (cm)'}
        </Text>
        {hasData ? (
          <LineChart
            data={{ labels, datasets: [{ data: dataValues }] }}
            width={CHART_WIDTH}
            height={220}
            chartConfig={CHART_CONFIG}
            bezier
            style={styles.chart}
            withVerticalLines={false}
            withShadow={false}
            formatYLabel={(v) => parseFloat(v).toFixed(1)}
          />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyIcon}>📈</Text>
            <Text style={styles.emptyText}>
              {mode === 'waist'
                ? '허리둘레 데이터가 2개 이상 필요합니다.'
                : '데이터가 2개 이상 필요합니다.'}
            </Text>
          </View>
        )}
      </View>

      {/* 몸무게 통계 */}
      {stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>몸무게 통계</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>최근</Text>
              <Text style={styles.statValue}>{stats.current.toFixed(1)}</Text>
              <Text style={styles.statUnit}>kg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>최고</Text>
              <Text style={[styles.statValue, { color: '#E53E3E' }]}>
                {stats.max.toFixed(1)}
              </Text>
              <Text style={styles.statUnit}>kg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>최저</Text>
              <Text style={[styles.statValue, { color: '#38A169' }]}>
                {stats.min.toFixed(1)}
              </Text>
              <Text style={styles.statUnit}>kg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>평균</Text>
              <Text style={styles.statValue}>{stats.avg.toFixed(1)}</Text>
              <Text style={styles.statUnit}>kg</Text>
            </View>
          </View>
          {stats.diff !== null && (
            <View style={styles.diffRow}>
              <Text style={styles.diffLabel}>첫 기록 대비</Text>
              <Text
                style={[
                  styles.diffValue,
                  { color: stats.diff <= 0 ? '#38A169' : '#E53E3E' },
                ]}
              >
                {stats.diff > 0 ? '+' : ''}
                {stats.diff.toFixed(1)} kg
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 활동 요약 */}
      {records.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>활동 요약</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>📅</Text>
              <Text style={styles.summaryCount}>{records.length}</Text>
              <Text style={styles.summaryLabel}>총 기록일</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>🏃</Text>
              <Text style={styles.summaryCount}>
                {records.filter((r) => r.exercised).length}
              </Text>
              <Text style={styles.summaryLabel}>운동일</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>🍺</Text>
              <Text style={styles.summaryCount}>
                {records.filter((r) => r.drank).length}
              </Text>
              <Text style={styles.summaryLabel}>음주일</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>💪</Text>
              <Text style={styles.summaryCount}>
                {records.length > 0
                  ? Math.round(
                      (records.filter((r) => r.exercised).length / records.length) * 100
                    )
                  : 0}
                %
              </Text>
              <Text style={styles.summaryLabel}>운동율</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#2D3748',
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  chart: {
    borderRadius: 8,
    marginLeft: -10,
  },
  emptyChart: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#A0AEC0',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#A0AEC0',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
  },
  statUnit: {
    fontSize: 11,
    color: '#A0AEC0',
    marginTop: 2,
  },
  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  diffLabel: {
    fontSize: 14,
    color: '#718096',
  },
  diffValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryEmoji: {
    fontSize: 26,
    marginBottom: 6,
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 2,
  },
});
