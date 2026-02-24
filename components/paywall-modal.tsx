/**
 * 페이월(구독 구매) 모달
 * 설정 화면의 "PRO 업그레이드" 버튼에서 열립니다.
 */
import { usePro } from "@/hooks/use-pro";
import {
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
} from "@/utils/purchases";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRO_FEATURES = [
  { emoji: "🤖", text: "AI 음식 분석 무제한" },
  { emoji: "🍽️", text: "식사 기록 무제한" },
  { emoji: "🏆", text: "챌린지 무제한 생성" },
  { emoji: "🚫", text: "광고 제거" },
  { emoji: "☁️", text: "클라우드 백업 자동화" },
  { emoji: "📊", text: "상세 통계 및 분석" },
];

export function PaywallModal({ visible, onClose }: PaywallModalProps) {
  const { refresh } = usePro();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadingOffering(true);
    getCurrentOffering()
      .then(setOffering)
      .finally(() => setLoadingOffering(false));
  }, [visible]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(true);
    const result = await purchasePackage(pkg);
    setPurchasing(false);
    if (result.success) {
      await refresh();
      Alert.alert(
        "🎉 업그레이드 완료!",
        "PRO 기능을 모두 사용할 수 있습니다.",
        [{ text: "확인", onPress: onClose }]
      );
    } else if (result.error) {
      Alert.alert("구매 실패", result.error);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const restored = await restorePurchases();
    setRestoring(false);
    await refresh();
    if (restored) {
      Alert.alert("복원 완료", "PRO 구독이 복원되었습니다.", [
        { text: "확인", onPress: onClose },
      ]);
    } else {
      Alert.alert("복원 실패", "복원할 구매 내역이 없습니다.");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={st.overlay}>
        <View style={st.sheet}>
          {/* 헤더 */}
          <View style={st.header}>
            <Text style={st.headerEmoji}>⭐</Text>
            <Text style={st.headerTitle}>fullweight PRO</Text>
            <Text style={st.headerSub}>광고 없이, 제한 없이</Text>
            <TouchableOpacity style={st.closeBtn} onPress={onClose}>
              <Text style={st.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* 혜택 목록 */}
            <View style={st.featureList}>
              {PRO_FEATURES.map((f) => (
                <View key={f.text} style={st.featureRow}>
                  <Text style={st.featureEmoji}>{f.emoji}</Text>
                  <Text style={st.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            {/* 상품 목록 */}
            <View style={st.packagesSection}>
              {loadingOffering ? (
                <ActivityIndicator
                  size="large"
                  color="#4CAF50"
                  style={{ marginVertical: 24 }}
                />
              ) : offering?.availablePackages.length ? (
                offering.availablePackages.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[st.packageBtn, purchasing && st.packageBtnDisabled]}
                    onPress={() => handlePurchase(pkg)}
                    disabled={purchasing}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={st.packageTitle}>
                          {pkg.packageType === "MONTHLY"
                            ? "월간 구독"
                            : pkg.packageType === "ANNUAL"
                              ? "연간 구독"
                              : pkg.packageType === "LIFETIME"
                                ? "평생 이용권"
                                : pkg.product.title}
                        </Text>
                        <Text style={st.packagePrice}>
                          {pkg.product.priceString}
                          {pkg.packageType === "MONTHLY"
                            ? " / 월"
                            : pkg.packageType === "ANNUAL"
                              ? " / 년"
                              : ""}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                /* 아직 RevenueCat에 상품 등록 전 — 개발 중 표시용 */
                <View style={st.noProductBox}>
                  <Text style={st.noProductText}>
                    🛠️ 현재 개발 중입니다.{"\n"}곧 출시될 예정이에요!
                  </Text>
                </View>
              )}
            </View>

            {/* 구매 복원 */}
            <TouchableOpacity
              style={st.restoreBtn}
              onPress={handleRestore}
              disabled={restoring}
            >
              {restoring ? (
                <ActivityIndicator size="small" color="#718096" />
              ) : (
                <Text style={st.restoreBtnText}>구매 내역 복원</Text>
              )}
            </TouchableOpacity>

            <Text style={st.legalText}>
              구독은 언제든지 취소할 수 있습니다.{"\n"}
              결제는 구글 플레이 / 앱스토어 계정으로 청구됩니다.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
    backgroundColor: "#F7FFFB",
  },
  headerEmoji: { fontSize: 40, marginBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#1A202C" },
  headerSub: { fontSize: 15, color: "#718096", marginTop: 4 },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EDF2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 14, color: "#718096", fontWeight: "700" },
  featureList: { paddingHorizontal: 24, paddingTop: 20, gap: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureEmoji: { fontSize: 22, width: 30, textAlign: "center" },
  featureText: { fontSize: 15, color: "#2D3748", fontWeight: "500", flex: 1 },
  packagesSection: { paddingHorizontal: 20, paddingTop: 24, gap: 12 },
  packageBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  packageBtnDisabled: { opacity: 0.7 },
  packageTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  packagePrice: { fontSize: 14, color: "rgba(255,255,255,0.85)" },
  noProductBox: {
    backgroundColor: "#F7FAFC",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  noProductText: {
    fontSize: 14,
    color: "#718096",
    textAlign: "center",
    lineHeight: 22,
  },
  restoreBtn: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 8,
  },
  restoreBtnText: {
    fontSize: 14,
    color: "#718096",
    textDecorationLine: "underline",
  },
  legalText: {
    fontSize: 11,
    color: "#A0AEC0",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 16,
    marginBottom: 8,
  },
});
