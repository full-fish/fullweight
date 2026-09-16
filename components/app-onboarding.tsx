import AddCustomMetric, { AddCustomBool } from "@/components/add-custom-item";
import {
  BUILTIN_OPTIONAL_METRICS,
  CustomBoolMetric,
  CustomMetric,
} from "@/types";
import { loadUserSettings, saveUserSettings } from "@/utils/storage";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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
  const [step, setStep] = useState<"welcome" | "config">("welcome");
  const [metricVisibility, setMetricVisibility] = useState<
    Record<string, boolean>
  >({});
  const [boolVisibility, setBoolVisibility] = useState<Record<string, boolean>>(
    {}
  );
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [customBools, setCustomBools] = useState<CustomBoolMetric[]>([]);

  useEffect(() => {
    if (!visible) return;
    setStep("welcome");
    (async () => {
      const s = await loadUserSettings();
      // 기본 값: 내장 수치들은 true, 체크 항목도 true
      const mv: Record<string, boolean> = { ...s.metricInputVisibility } as any;
      BUILTIN_OPTIONAL_METRICS.forEach((m) => {
        if (mv[m.key] === undefined) mv[m.key] = true;
      });
      // 기존 커스텀 항목도 기본 true로 표시
      (s.customMetrics ?? []).forEach((c) => {
        if (mv[c.key] === undefined) mv[c.key] = true;
      });
      // 기본 체크(운동/음주)
      const bv: Record<string, boolean> = { ...s.metricInputVisibility } as any;
      if (bv["exercised"] === undefined) bv["exercised"] = true;
      if (bv["drank"] === undefined) bv["drank"] = true;
      (s.customBoolMetrics ?? []).forEach((c) => {
        if (bv[c.key] === undefined) bv[c.key] = true;
      });

      setMetricVisibility(mv);
      setBoolVisibility(bv);

      setCustomMetrics(s.customMetrics ?? []);
      setCustomBools(s.customBoolMetrics ?? []);
    })();
  }, [visible]);

  if (!visible) return null;

  const toggleMetric = (key: string) => {
    setMetricVisibility((p) => ({ ...p, [key]: !p[key] }));
  };

  const toggleBool = (key: string) => {
    setBoolVisibility((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleSave = async () => {
    const s = await loadUserSettings();
    const next: any = { ...s };
    next.metricInputVisibility = {
      ...(next.metricInputVisibility ?? {}),
      ...metricVisibility,
    };
    next.metricDisplayVisibility = {
      ...(next.metricDisplayVisibility ?? {}),
      ...metricVisibility,
    };
    await saveUserSettings(next);
    onStart();
  };

  // 1단계: 환영 모달
  if (step === "welcome") {
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
                • AI가 음식 사진으로 칼로리와 영양소를 계산해줘요
              </Text>
              <Text style={styles.bullet}>
                • 사용자 정의 수치와 체크항목으로 나만의 기록 기준을
                추가해보세요
              </Text>
              <Text style={styles.bullet}>
                • 그래프·캘린더·챌린지로 꾸준함을 이어가세요
              </Text>
              <Text style={styles.bullet}>• 설정에서 도움말을 확인해세요</Text>
            </View>

            <Pressable style={styles.button} onPress={() => setStep("config")}>
              <Text style={styles.buttonText}>시작하기</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // 2단계: 기본 항목 설정
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>기본 항목 설정</Text>
          <Text style={styles.subtitle}>
            나중에 설정에서 언제든 변경할 수 있습니다.
          </Text>

          <ScrollView style={{ maxHeight: 360 }}>
            <Text style={styles.sectionTitle}>수치 항목</Text>
            {BUILTIN_OPTIONAL_METRICS.map((m) => (
              <View key={m.key} style={styles.row}>
                <Text style={styles.rowLabel}>{m.label}</Text>
                <Switch
                  value={!!metricVisibility[m.key]}
                  onValueChange={() => toggleMetric(m.key)}
                />
              </View>
            ))}
            {customMetrics.map((c) => (
              <View key={c.key} style={styles.row}>
                <Text style={styles.rowLabel}>{c.label}</Text>
                <Switch
                  value={!!metricVisibility[c.key]}
                  onValueChange={() => toggleMetric(c.key)}
                />
              </View>
            ))}

            <View style={{ marginTop: 8 }}>
              <AddCustomMetric
                onAdded={(next) => {
                  setCustomMetrics(next ?? []);
                  setMetricVisibility((p) => {
                    const n = { ...p };
                    (next ?? []).forEach((c) => {
                      if (n[c.key] === undefined) n[c.key] = true;
                    });
                    return n;
                  });
                }}
              />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
              체크 항목
            </Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>운동</Text>
              <Switch
                value={!!boolVisibility["exercised"]}
                onValueChange={() => toggleBool("exercised")}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>음주</Text>
              <Switch
                value={!!boolVisibility["drank"]}
                onValueChange={() => toggleBool("drank")}
              />
            </View>
            {customBools.map((c) => (
              <View key={c.key} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {!c.iconName && c.emoji ? `${c.emoji} ` : ""}
                  {c.label}
                </Text>
                <Switch
                  value={!!boolVisibility[c.key]}
                  onValueChange={() => toggleBool(c.key)}
                />
              </View>
            ))}

            <View>
              <AddCustomBool
                onAdded={(next) => {
                  setCustomBools(next ?? []);
                  setBoolVisibility((p) => {
                    const n = { ...p };
                    (next ?? []).forEach((c) => {
                      if (n[c.key] === undefined) n[c.key] = true;
                    });
                    return n;
                  });
                }}
              />
            </View>
          </ScrollView>

          <Pressable style={styles.button} onPress={handleSave}>
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
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#1f2937", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#4b5563", marginBottom: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 8,
  },
  bullets: { gap: 8, marginBottom: 24 },
  bullet: { fontSize: 15, color: "#374151", lineHeight: 22 },
  button: {
    backgroundColor: "#4CAF50",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 15, color: "#1f2937" },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  smallButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  smallButtonText: { color: "#fff", fontWeight: "600" },
});
