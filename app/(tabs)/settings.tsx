import { SwipeableTab } from "@/components/swipeable-tab";
import {
  clearAllRecords,
  loadRecords,
  loadUserSettings,
  saveUserSettings,
  seedDummyData,
} from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsScreen() {
  const [recordCount, setRecordCount] = useState(0);
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => setRecordCount(data.length));
      loadUserSettings().then((settings) => {
        setHeight(settings.height != null ? String(settings.height) : "");
        setAge(settings.age != null ? String(settings.age) : "");
      });
    }, [])
  );

  const handleSaveProfile = async () => {
    const h = height.trim() ? parseFloat(height) : undefined;
    const a = age.trim() ? parseInt(age, 10) : undefined;

    if (h !== undefined && (isNaN(h) || h < 50 || h > 300)) {
      Alert.alert("입력 오류", "키는 50~300cm 사이의 숫자를 입력해주세요.");
      return;
    }
    if (a !== undefined && (isNaN(a) || a < 1 || a > 150)) {
      Alert.alert("입력 오류", "나이는 1~150 사이의 숫자를 입력해주세요.");
      return;
    }

    await saveUserSettings({ height: h, age: a });
    Alert.alert("저장 완료", "프로필 정보가 저장되었습니다.");
  };

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
    <SwipeableTab currentIndex={4}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.title}>⚙️ 설정</Text>

        {/* 프로필 정보 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>프로필 정보</Text>
          <View style={s.inputRow}>
            <Text style={s.inputLabel}>키 (cm)</Text>
            <TextInput
              style={s.input}
              value={height}
              onChangeText={setHeight}
              placeholder="예: 175"
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>
          <View style={s.inputRow}>
            <Text style={s.inputLabel}>나이</Text>
            <TextInput
              style={s.input}
              value={age}
              onChangeText={setAge}
              placeholder="예: 28"
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>
          <TouchableOpacity style={s.saveBtn} onPress={handleSaveProfile}>
            <Text style={s.saveBtnText}>저장</Text>
          </TouchableOpacity>
        </View>

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
    </SwipeableTab>
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

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  inputLabel: { fontSize: 15, color: "#4A5568" },
  input: {
    fontSize: 15,
    fontWeight: "500",
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 120,
    textAlign: "right",
  },
  saveBtn: {
    backgroundColor: "#4299E1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
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
