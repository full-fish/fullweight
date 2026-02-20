import { clearAllRecords, loadRecords, seedDummyData } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsScreen() {
  const [recordCount, setRecordCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => setRecordCount(data.length));
    }, [])
  );

  const handleSeedDummy = () => {
    Alert.alert(
      "더미 데이터 삽입",
      "약 1년치 랜덤 데이터를 생성합니다.\n기존 데이터는 모두 지워집니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "생성",
          onPress: async () => {
            const updated = await seedDummyData();
            setRecordCount(updated.length);
            Alert.alert(
              "완료 ✅",
              `${updated.length}개의 더미 데이터가 생성됐습니다.`
            );
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      "전체 데이터 삭제",
      "모든 기록이 영구적으로 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            await clearAllRecords();
            setRecordCount(0);
            Alert.alert("삭제 완료", "모든 기록이 삭제되었습니다.");
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>⚙️ 설정</Text>

      {/* 데이터 정보 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>데이터 정보</Text>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>총 기록 수</Text>
          <Text style={s.infoValue}>{recordCount}개</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>저장 위치</Text>
          <Text style={s.infoValue}>로컬 (AsyncStorage)</Text>
        </View>
      </View>

      {/* 개발자 도구 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>개발자 도구</Text>
        <TouchableOpacity style={s.actionBtn} onPress={handleSeedDummy}>
          <Text style={s.actionIcon}>🎲</Text>
          <View style={s.actionTextWrap}>
            <Text style={s.actionTitle}>더미 데이터 생성</Text>
            <Text style={s.actionDesc}>약 1년치 랜덤 테스트 데이터 삽입</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={handleClearAll}>
          <Text style={s.actionIcon}>🗑</Text>
          <View style={s.actionTextWrap}>
            <Text style={[s.actionTitle, { color: "#E53E3E" }]}>
              전체 데이터 삭제
            </Text>
            <Text style={s.actionDesc}>모든 기록을 영구 삭제합니다</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 앱 정보 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>앱 정보</Text>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>앱 이름</Text>
          <Text style={s.infoValue}>Full Weight</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>버전</Text>
          <Text style={s.infoValue}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A202C",
    marginBottom: 24,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 16,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  infoLabel: { fontSize: 15, color: "#4A5568" },
  infoValue: { fontSize: 15, fontWeight: "500", color: "#2D3748" },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  actionIcon: { fontSize: 24, marginRight: 14 },
  actionTextWrap: { flex: 1 },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 2,
  },
  actionDesc: { fontSize: 12, color: "#A0AEC0" },
});
