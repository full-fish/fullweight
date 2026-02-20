import { WeightRecord } from "@/types";
import { deletePhoto, pickPhoto, takePhoto } from "@/utils/photo";
import {
  deleteRecord,
  getLocalDateString,
  loadRecords,
  upsertRecord,
} from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
}

export default function HomeScreen() {
  const [today] = useState(() => getLocalDateString());
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [bodyFatMass, setBodyFatMass] = useState("");
  const [exercised, setExercised] = useState(false);
  const [drank, setDrank] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => {
        const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
        setRecords(sorted);
        const todayRecord = data.find((r) => r.date === today);
        if (todayRecord) {
          setWeight(todayRecord.weight.toString());
          setWaist(todayRecord.waist?.toString() ?? "");
          setMuscleMass(todayRecord.muscleMass?.toString() ?? "");
          setBodyFatPercent(todayRecord.bodyFatPercent?.toString() ?? "");
          setBodyFatMass(todayRecord.bodyFatMass?.toString() ?? "");
          setExercised(todayRecord.exercised);
          setDrank(todayRecord.drank);
          setPhotoUri(todayRecord.photoUri);
        }
      });
    }, [today])
  );

  const handleSave = async () => {
    const w = parseFloat(weight);
    if (!weight || isNaN(w) || w <= 0) {
      Alert.alert("입력 오류", "올바른 몸무게를 입력해주세요.");
      return;
    }
    const record: WeightRecord = {
      id: today,
      date: today,
      weight: w,
      waist: waist ? parseFloat(waist) : undefined,
      muscleMass: muscleMass ? parseFloat(muscleMass) : undefined,
      bodyFatPercent: bodyFatPercent ? parseFloat(bodyFatPercent) : undefined,
      bodyFatMass: bodyFatMass ? parseFloat(bodyFatMass) : undefined,
      exercised,
      drank,
      photoUri,
    };
    const updated = await upsertRecord(record);
    setRecords([...updated].sort((a, b) => b.date.localeCompare(a.date)));
    Alert.alert("저장 완료 ✅", "오늘의 기록이 저장되었습니다.");
  };

  const handleDelete = (date: string) => {
    Alert.alert("기록 삭제", "이 기록을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const updated = await deleteRecord(date);
          setRecords([...updated].sort((a, b) => b.date.localeCompare(a.date)));
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>💪 몸무게 트래커</Text>
        <Text style={styles.dateText}>{formatDate(today)}</Text>

        {/* 입력 카드 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>오늘의 기록</Text>

          <Text style={styles.label}>몸무게</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="0.0"
              placeholderTextColor="#aaa"
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>kg</Text>
          </View>

          <Text style={styles.label}>허리둘레 (선택)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={waist}
              onChangeText={setWaist}
              placeholder="0.0"
              placeholderTextColor="#aaa"
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>cm</Text>
          </View>

          <Text style={styles.label}>골격근량 (선택)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={muscleMass}
              onChangeText={setMuscleMass}
              placeholder="0.0"
              placeholderTextColor="#aaa"
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>kg</Text>
          </View>

          <Text style={styles.label}>체지방률 (선택)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={bodyFatPercent}
              onChangeText={setBodyFatPercent}
              placeholder="0.0"
              placeholderTextColor="#aaa"
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>%</Text>
          </View>

          <Text style={styles.label}>체지방량 (선택)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={bodyFatMass}
              onChangeText={setBodyFatMass}
              placeholder="0.0"
              placeholderTextColor="#aaa"
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>kg</Text>
          </View>

          {/* 사진 */}
          <Text style={styles.label}>바디 사진 (선택)</Text>
          <View style={styles.photoSection}>
            {photoUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={styles.photoRemoveBtn}
                  onPress={async () => {
                    await deletePhoto(photoUri);
                    setPhotoUri(undefined);
                  }}
                >
                  <Text style={styles.photoRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.photoBtnRow}>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={async () => {
                  const uri = await takePhoto();
                  if (uri) setPhotoUri(uri);
                }}
              >
                <Text style={styles.photoBtnText}>📸 촬영</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={async () => {
                  const uri = await pickPhoto();
                  if (uri) setPhotoUri(uri);
                }}
              >
                <Text style={styles.photoBtnText}>🖼 갤러리</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.switchGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>🏃 오늘 운동했나요?</Text>
              <Switch
                value={exercised}
                onValueChange={setExercised}
                trackColor={{ true: "#4CAF50", false: "#ddd" }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>🍺 오늘 음주했나요?</Text>
              <Switch
                value={drank}
                onValueChange={setDrank}
                trackColor={{ true: "#FF9800", false: "#ddd" }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>저장하기</Text>
          </TouchableOpacity>
        </View>

        {/* 기록 목록 */}
        <Text style={styles.sectionTitle}>기록 목록</Text>
        {records.length === 0 ? (
          <Text style={styles.emptyText}>
            아직 기록이 없습니다.{"\n"}첫 번째 기록을 추가해보세요! 🎯
          </Text>
        ) : (
          records.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              <View style={styles.recordTop}>
                <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                <TouchableOpacity onPress={() => handleDelete(record.date)}>
                  <Text style={styles.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.recordWeight}>{record.weight} kg</Text>
              {record.waist != null && (
                <Text style={styles.recordSub}>허리: {record.waist} cm</Text>
              )}
              {record.muscleMass != null && (
                <Text style={styles.recordSub}>
                  골격근: {record.muscleMass} kg
                </Text>
              )}
              {record.bodyFatPercent != null && (
                <Text style={styles.recordSub}>
                  체지방률: {record.bodyFatPercent} %
                </Text>
              )}
              {record.bodyFatMass != null && (
                <Text style={styles.recordSub}>
                  체지방량: {record.bodyFatMass} kg
                </Text>
              )}
              {record.photoUri && (
                <Image
                  source={{ uri: record.photoUri }}
                  style={styles.recordPhoto}
                />
              )}
              <View style={styles.badgeRow}>
                {record.exercised && (
                  <View style={[styles.badge, styles.badgeExercise]}>
                    <Text style={styles.badgeText}>🏃 운동</Text>
                  </View>
                )}
                {record.drank && (
                  <View style={[styles.badge, styles.badgeDrank]}>
                    <Text style={styles.badgeText}>🍺 음주</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A202C",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: "#718096",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4A5568",
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
  },
  unit: {
    marginLeft: 8,
    fontSize: 16,
    color: "#718096",
    fontWeight: "500",
    width: 24,
  },
  switchGroup: {
    marginBottom: 16,
    gap: 4,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F7FAFC",
  },
  switchLabel: {
    fontSize: 15,
    color: "#4A5568",
  },
  saveBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 12,
  },
  emptyText: {
    textAlign: "center",
    color: "#A0AEC0",
    fontSize: 15,
    lineHeight: 26,
    marginTop: 40,
  },
  recordCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recordTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  recordDate: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "500",
  },
  deleteBtn: {
    fontSize: 15,
    color: "#CBD5E0",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  recordWeight: {
    fontSize: 26,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 4,
  },
  recordSub: {
    fontSize: 14,
    color: "#718096",
    marginBottom: 2,
  },
  recordPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  photoSection: {
    marginBottom: 16,
  },
  photoPreviewWrap: {
    position: "relative",
    marginBottom: 8,
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  photoRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  photoBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  photoBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A5568",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeExercise: {
    backgroundColor: "#E8F5E9",
  },
  badgeDrank: {
    backgroundColor: "#FFF3E0",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4A5568",
  },
});
