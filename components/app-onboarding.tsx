import React from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface AppOnboardingProps {
  visible: boolean;
  onStart: () => void;
}

export default function AppOnboarding({
  visible,
  onStart,
}: AppOnboardingProps) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>FullWeight에 오신 걸 환영해요</Text>
          <Text style={styles.subtitle}>
            몸무게, 식사, 눈바디를 한 곳에서 기록하고, AI가 음식 사진으로
            칼로리와 영양소를 계산해줘요.
          </Text>

          <View style={styles.bullets}>
            <Text style={styles.bullet}>
              • 체중·허리·체지방을 기록해 변화 추이를 확인해요
            </Text>
            <Text style={styles.bullet}>
              • 사용자 정의 수치와 체크항목으로 나만의 기록 기준을 추가해보세요
            </Text>
            <Text style={styles.bullet}>
              • 그래프·캘린더·챌린지로 꾸준함을 이어가세요
            </Text>
          </View>

          <Pressable style={styles.button} onPress={onStart}>
            <Text style={styles.buttonText}>시작하기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 22,
    marginBottom: 18,
  },
  bullets: {
    gap: 8,
    marginBottom: 24,
  },
  bullet: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },
  button: {
    backgroundColor: "#4CAF50",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
