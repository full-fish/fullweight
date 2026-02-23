import { WeightRecord } from "@/types";
import { loadRecords } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height: screenHeight } = Dimensions.get("window");
const THUMB_GAP = 6;
const THUMB_COLS = 3;
const THUMB_SIZE = Math.floor(
  (width - 40 - THUMB_GAP * (THUMB_COLS - 1)) / THUMB_COLS
);

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${y}.${m}.${day}`;
}

function fmtDateShort(d: string) {
  return d.slice(2).replace(/-/g, ".");
}

export default function PhotosScreen() {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [compareViewerVisible, setCompareViewerVisible] = useState(false);
  const [compareViewerIndex, setCompareViewerIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const compareFlatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      loadRecords().then(setRecords);
    }, [])
  );

  const photoRecords = useMemo(
    () =>
      records
        .filter((r) => r.photoUri)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [records]
  );

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const handleCompareSelect = (index: number) => {
    if (compareA === null) {
      setCompareA(index);
    } else if (compareB === null) {
      if (index === compareA) {
        setCompareA(null);
        return;
      }
      // ensure A is earlier date, B is later date
      const aDate = photoRecords[compareA].date;
      const bDate = photoRecords[index].date;
      if (aDate < bDate) {
        setCompareB(compareA);
        setCompareA(index);
      } else {
        setCompareB(index);
      }
    } else {
      // reset, select new
      setCompareA(index);
      setCompareB(null);
    }
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setCompareA(null);
    setCompareB(null);
  };

  const recordA = compareA !== null ? photoRecords[compareA] : null;
  const recordB = compareB !== null ? photoRecords[compareB] : null;

  const comparePhotos = useMemo(() => {
    if (!recordA || !recordB) return [];
    return [recordA, recordB];
  }, [recordA, recordB]);

  const openCompareViewer = (index: number) => {
    setCompareViewerIndex(index);
    setCompareViewerVisible(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.container}>
        <View style={s.header}>
          {photoRecords.length > 0 && (
            <TouchableOpacity
              onPress={() =>
                compareMode ? exitCompareMode() : setCompareMode(true)
              }
              style={[s.compareToggle, compareMode && s.compareToggleActive]}
            >
              <Text
                style={[
                  s.compareToggleText,
                  compareMode && s.compareToggleTextActive,
                ]}
              >
                {compareMode ? "취소" : "비교"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {photoRecords.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}></Text>
            <Text style={s.emptyTitle}>아직 사진이 없습니다</Text>
            <Text style={s.emptyDesc}>
              기록 탭에서 바디 사진을 추가해보세요
            </Text>
          </View>
        ) : (
          <>
            {/* 비교 모드 안내 / 결과 */}
            {compareMode && (
              <View style={s.compareBar}>
                {compareA === null ? (
                  <Text style={s.compareBarText}>
                    첫 번째 사진을 선택하세요
                  </Text>
                ) : compareB === null ? (
                  <Text style={s.compareBarText}>
                    두 번째 사진을 선택하세요
                  </Text>
                ) : (
                  <Text style={s.compareBarText}>
                    아래에서 비교 결과를 확인하세요
                  </Text>
                )}
              </View>
            )}

            {/* 비교 결과 패널 */}
            {compareMode && recordA && recordB && (
              <View style={s.comparePanel}>
                <TouchableOpacity
                  style={s.compareSide}
                  activeOpacity={0.8}
                  onPress={() => openCompareViewer(0)}
                >
                  <Image
                    source={{ uri: recordA.photoUri }}
                    style={s.compareImage}
                  />
                  <Text style={s.compareDate}>
                    {fmtDateShort(recordA.date)}
                  </Text>
                  <Text style={s.compareWeight}>{recordA.weight}kg</Text>
                </TouchableOpacity>
                <View style={s.compareArrow}>
                  <Text style={{ fontSize: 20, color: "#A0AEC0" }}>→</Text>
                  {(() => {
                    const diff = recordB.weight - recordA.weight;
                    return (
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: diff <= 0 ? "#38A169" : "#E53E3E",
                          marginTop: 4,
                        }}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)}kg
                      </Text>
                    );
                  })()}
                </View>
                <TouchableOpacity
                  style={s.compareSide}
                  activeOpacity={0.8}
                  onPress={() => openCompareViewer(1)}
                >
                  <Image
                    source={{ uri: recordB.photoUri }}
                    style={s.compareImage}
                  />
                  <Text style={s.compareDate}>
                    {fmtDateShort(recordB.date)}
                  </Text>
                  <Text style={s.compareWeight}>{recordB.weight}kg</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 사진 그리드 */}
            <FlatList
              data={photoRecords}
              keyExtractor={(item) => item.id}
              numColumns={THUMB_COLS}
              contentContainerStyle={s.gridContent}
              columnWrapperStyle={{ gap: THUMB_GAP }}
              ItemSeparatorComponent={() => (
                <View style={{ height: THUMB_GAP }} />
              )}
              renderItem={({ item, index }) => {
                const isSelectedA = compareMode && compareA === index;
                const isSelectedB = compareMode && compareB === index;
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      compareMode
                        ? handleCompareSelect(index)
                        : openViewer(index)
                    }
                    style={[
                      s.thumbWrap,
                      (isSelectedA || isSelectedB) && s.thumbSelected,
                    ]}
                  >
                    <Image
                      source={{ uri: item.photoUri }}
                      style={s.thumbImage}
                      resizeMode="cover"
                      fadeDuration={0}
                      key={item.photoUri}
                    />
                    <View style={s.thumbOverlay}>
                      <Text style={s.thumbDate}>{fmtDateShort(item.date)}</Text>
                    </View>
                    {isSelectedA && (
                      <View style={s.thumbBadge}>
                        <Text style={s.thumbBadgeText}>전</Text>
                      </View>
                    )}
                    {isSelectedB && (
                      <View
                        style={[s.thumbBadge, { backgroundColor: "#4CAF50" }]}
                      >
                        <Text style={s.thumbBadgeText}>후</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </>
        )}

        {/* 전체 화면 뷰어 (드래그 넘기기) */}
        <Modal
          visible={viewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerVisible(false)}
        >
          <View style={s.viewerBg}>
            <TouchableOpacity
              style={s.viewerClose}
              onPress={() => setViewerVisible(false)}
            >
              <Text style={s.viewerCloseText}>✕</Text>
            </TouchableOpacity>

            <FlatList
              ref={flatListRef}
              data={photoRecords}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              keyExtractor={(item) => item.id}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                setViewerIndex(idx);
              }}
              renderItem={({ item }) => (
                <View style={s.viewerSlide}>
                  <Image
                    source={{ uri: item.photoUri }}
                    style={s.viewerImage}
                    resizeMode="contain"
                  />
                  <View style={s.viewerInfo}>
                    <Text style={s.viewerDate}>{fmtDate(item.date)}</Text>
                    <Text style={s.viewerWeight}>{item.weight} kg</Text>
                    {item.muscleMass != null && (
                      <Text style={s.viewerMeta}>{item.muscleMass}kg</Text>
                    )}
                    {item.bodyFatPercent != null && (
                      <Text style={s.viewerMeta}>{item.bodyFatPercent}%</Text>
                    )}
                  </View>
                </View>
              )}
            />

            <Text style={s.viewerCounter}>
              {viewerIndex + 1} / {photoRecords.length}
            </Text>
          </View>
        </Modal>

        {/* 비교 전체 화면 뷰어 (2장 드래그) */}
        <Modal
          visible={compareViewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCompareViewerVisible(false)}
        >
          <View style={s.viewerBg}>
            <TouchableOpacity
              style={s.viewerClose}
              onPress={() => setCompareViewerVisible(false)}
            >
              <Text style={s.viewerCloseText}>✕</Text>
            </TouchableOpacity>

            <FlatList
              ref={compareFlatListRef}
              data={comparePhotos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={compareViewerIndex}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              keyExtractor={(item) => item.id}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                setCompareViewerIndex(idx);
              }}
              renderItem={({ item, index }) => (
                <View style={s.viewerSlide}>
                  <Image
                    source={{ uri: item.photoUri }}
                    style={s.viewerImage}
                    resizeMode="contain"
                  />
                  <View style={s.viewerInfo}>
                    <View style={s.compareBadgeViewer}>
                      <Text style={s.compareBadgeViewerText}>
                        {index === 0 ? "전 (Before)" : "후 (After)"}
                      </Text>
                    </View>
                    <Text style={s.viewerDate}>{fmtDate(item.date)}</Text>
                    <Text style={s.viewerWeight}>{item.weight} kg</Text>
                    {item.muscleMass != null && (
                      <Text style={s.viewerMeta}>{item.muscleMass}kg</Text>
                    )}
                    {item.bodyFatPercent != null && (
                      <Text style={s.viewerMeta}>{item.bodyFatPercent}%</Text>
                    )}
                  </View>
                </View>
              )}
            />

            <Text style={s.viewerCounter}>
              {compareViewerIndex === 0 ? "전" : "후"} · 좌우로 넘기세요
            </Text>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A202C",
  },
  compareToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    backgroundColor: "#fff",
  },
  compareToggleActive: {
    backgroundColor: "#4CAF50",
  },
  compareToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50",
  },
  compareToggleTextActive: {
    color: "#fff",
  },

  /* empty */
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#4A5568" },
  emptyDesc: { fontSize: 13, color: "#A0AEC0", marginTop: 4 },

  /* compare bar */
  compareBar: {
    backgroundColor: "#EBF8FF",
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    alignItems: "center",
  },
  compareBarText: { fontSize: 13, fontWeight: "500", color: "#2B6CB0" },

  /* compare panel */
  comparePanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  compareSide: { alignItems: "center", flex: 1 },
  compareImage: {
    width: (width - 100) / 2,
    height: (width - 100) / 2,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  compareDate: {
    fontSize: 12,
    color: "#718096",
    marginTop: 6,
    fontWeight: "500",
  },
  compareWeight: { fontSize: 15, fontWeight: "700", color: "#2D3748" },
  compareArrow: { alignItems: "center", paddingHorizontal: 8 },

  /* thumbnail grid */
  gridContent: { paddingHorizontal: 20, paddingBottom: 40 },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    borderWidth: 3,
    borderColor: "transparent",
  },
  thumbSelected: {
    borderColor: "#4CAF50",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  thumbDate: { fontSize: 10, color: "#fff", fontWeight: "600" },
  thumbBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#3182CE",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  thumbBadgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  /* viewer */
  viewerBg: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewerClose: {
    position: "absolute",
    top: 56,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerCloseText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  viewerSlide: {
    width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: {
    width: width,
    height: screenHeight * 0.65,
    borderRadius: 0,
  },
  viewerInfo: {
    position: "absolute",
    bottom: 100,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  viewerDate: { color: "#E2E8F0", fontSize: 14, fontWeight: "500" },
  viewerWeight: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  viewerMeta: { color: "#CBD5E0", fontSize: 13, marginTop: 2 },
  compareBadgeViewer: {
    backgroundColor: "rgba(76,175,80,0.8)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  compareBadgeViewerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  viewerCounter: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "500",
  },
});
