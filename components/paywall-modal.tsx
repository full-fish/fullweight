/**
 * 페이월(구매) 모달 — 3개 상품 섹션
 * 1. 배너 광고 제거 ($1.49 lifetime)
 * 2. AI 모델 구독 ($1.99/mo, $19.9/yr) — 무제한 AI + gpt-4o + 모든 광고 제거
 * 3. 개발자에게 맥주 사주기 (consumable)
 */
import { usePro } from "@/hooks/use-pro";
import {
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
} from "@/utils/purchases";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
type PurchasesOffering = any;
type PurchasesPackage = any;

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  /** 특정 섹션으로 스크롤 (선택) */
  initialSection?: "banner" | "ai" | "beer";
}

export function PaywallModal({
  visible,
  onClose,
  initialSection,
}: PaywallModalProps) {
  const { refresh, aiPro, bannerRemoved } = usePro();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [offeringError, setOfferingError] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setPurchased(false);
      setPurchaseMessage("");
      return;
    }
    setLoadingOffering(true);
    setOfferingError(null);
    getCurrentOffering()
      .then((result) => {
        setOffering(result);
        // null은 dev 모드에서는 정상(결제 스킵) — 예외 발생 시만 오류 표시
      })
      .catch(() => {
        setOfferingError(
          "스토어 연결에 실패했습니다. 잠시 후 다시 시도해 주세요."
        );
      })
      .finally(() => setLoadingOffering(false));
  }, [visible]);

  useEffect(() => {
    if (!purchased) return;
    scaleAnim.setValue(0.5);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 7,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [purchased, scaleAnim, opacityAnim]);

  const handlePurchase = async (pkg: PurchasesPackage, successMsg?: string) => {
    setPurchasing(true);
    const result = await purchasePackage(pkg);
    setPurchasing(false);
    if (result.success) {
      await refresh();
      setPurchaseMessage(successMsg || "구매가 완료되었습니다!");
      setPurchased(true);
    } else if (result.error) {
      Alert.alert("구매 실패", result.error);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const status = await restorePurchases();
    setRestoring(false);
    await refresh();
    if (status.bannerRemoved || status.aiPro) {
      setPurchaseMessage("구매 내역이 복원되었습니다!");
      setPurchased(true);
    } else {
      Alert.alert("복원 실패", "복원할 구매 내역이 없습니다.");
    }
  };

  /* ─── 패키지 분류 ─── */
  const bannerPkg = offering?.availablePackages.find(
    (p) =>
      p.packageType === "LIFETIME" ||
      p.identifier.toLowerCase().includes("banner")
  );
  const aiMonthlyPkg = offering?.availablePackages.find(
    (p) =>
      p.packageType === "MONTHLY" ||
      p.identifier.toLowerCase().includes("monthly")
  );
  const aiAnnualPkg = offering?.availablePackages.find(
    (p) =>
      p.packageType === "ANNUAL" ||
      p.identifier.toLowerCase().includes("annual")
  );
  const beerPkgs = (
    offering?.availablePackages.filter(
      (p) =>
        p.identifier.toLowerCase().includes("beer") ||
        p.identifier.toLowerCase().includes("tip") ||
        p.identifier.toLowerCase().includes("donate")
    ) ?? []
  ).sort((a, b) => a.product.price - b.product.price);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={st.overlay}>
        <View style={st.sheet}>
          {purchased ? (
            /* ─── 구매 성공 화면 ─── */
            <Animated.View
              style={[
                st.successContainer,
                { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
              ]}
            >
              <View style={st.successCircle}>
                <Ionicons name="checkmark" size={52} color="#fff" />
              </View>
              <Text style={st.successTitle}>구매 완료!</Text>
              <Text style={st.successSub}>{purchaseMessage}</Text>
              <TouchableOpacity
                style={[
                  st.successBtn,
                  { flexDirection: "row", alignItems: "center", gap: 8 },
                ]}
                onPress={onClose}
              >
                <Text style={st.successBtnText}>확인</Text>
                <Ionicons name="sparkles" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              {/* ─── 헤더 ─── */}
              <View style={st.header}>
                <Text style={st.headerTitle}>스토어</Text>
                <Text style={st.headerSub}>필요한 기능만 골라 구매하세요</Text>
                <TouchableOpacity style={st.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={18} color="#718096" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                {loadingOffering ? (
                  <ActivityIndicator
                    size="large"
                    color="#4CAF50"
                    style={{ marginVertical: 40 }}
                  />
                ) : offeringError ? (
                  <View
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: "#FFF7ED",
                      marginVertical: 16,
                    }}
                  >
                    <Text style={{ color: "#C2410C", fontSize: 14 }}>
                      {offeringError}
                    </Text>
                    <Text
                      style={{ color: "#9A2C2C", fontSize: 12, marginTop: 6 }}
                    >
                      잠시 후 다시 시도하거나 앱을 다시 실행해 주세요.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* ═══ 1. 배너 광고 제거 ═══ */}
                    <View style={st.section}>
                      <View style={st.sectionHeader}>
                        <View style={{ width: 36, alignItems: "center" }}>
                          <Ionicons
                            name="eye-off-outline"
                            size={26}
                            color="#4A5568"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.sectionTitle}>배너 광고 제거</Text>
                          <Text style={st.sectionDesc}>
                            하단 배너 광고를 영구적으로 제거합니다
                          </Text>
                        </View>
                      </View>

                      {bannerRemoved ? (
                        <View
                          style={[
                            st.purchasedBadge,
                            { flexDirection: "row", gap: 6 },
                          ]}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#38A169"
                          />
                          <Text style={st.purchasedText}>구매 완료</Text>
                        </View>
                      ) : bannerPkg ? (
                        <TouchableOpacity
                          style={[st.buyBtn, st.buyBtnGray]}
                          onPress={() =>
                            handlePurchase(
                              bannerPkg,
                              "배너 광고가 제거되었습니다!"
                            )
                          }
                          disabled={purchasing}
                        >
                          {purchasing ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <>
                              <Text style={st.buyBtnTitle}>평생 이용권</Text>
                              <Text style={st.buyBtnPrice}>
                                {bannerPkg.product.priceString}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <View
                          style={[st.buyBtn, st.buyBtnGray, { opacity: 0.5 }]}
                        >
                          <Text style={st.buyBtnTitle}>평생 이용권</Text>
                          <Text style={st.buyBtnPrice}>$1.49</Text>
                        </View>
                      )}
                    </View>

                    {/* ═══ 2. AI 모델 구독 ═══ */}
                    <View style={st.section}>
                      <View style={st.sectionHeader}>
                        <View style={{ width: 36, alignItems: "center" }}>
                          <Ionicons
                            name="sparkles-outline"
                            size={26}
                            color="#667EEA"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.sectionTitle}>AI 모델 구독</Text>
                          <Text style={st.sectionDesc}>
                            모든 기능의 프리미엄 경험
                          </Text>
                        </View>
                        {aiPro && (
                          <View style={st.activeBadge}>
                            <Text style={st.activeBadgeText}>구독 중</Text>
                          </View>
                        )}
                      </View>

                      <View style={st.featureList}>
                        {[
                          {
                            icon: "lock-open-outline",
                            text: "AI 음식 분석 무제한 (일 2회 → 무제한)",
                          },
                          {
                            icon: "hardware-chip-outline",
                            text: "고성능 모델 gpt-4o 잠금 해제",
                          },
                          {
                            icon: "eye-off-outline",
                            text: "모든 광고 제거 (배너 + 전면)",
                          },
                        ].map((f) => (
                          <View
                            key={f.text}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Ionicons
                              name={f.icon as any}
                              size={15}
                              color="#2B6CB0"
                            />
                            <Text style={st.featureItem}>{f.text}</Text>
                          </View>
                        ))}
                      </View>

                      {aiPro ? (
                        <View
                          style={[
                            st.purchasedBadge,
                            { flexDirection: "row", gap: 6 },
                          ]}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#38A169"
                          />
                          <Text style={st.purchasedText}>구독 중</Text>
                        </View>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {aiMonthlyPkg && (
                            <TouchableOpacity
                              style={[st.buyBtn, st.buyBtnGreen]}
                              onPress={() =>
                                handlePurchase(
                                  aiMonthlyPkg,
                                  "AI PRO 구독이 활성화되었습니다!\n모든 프리미엄 기능을 사용할 수 있어요."
                                )
                              }
                              disabled={purchasing}
                            >
                              {purchasing ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <>
                                  <Text style={st.buyBtnTitle}>월간 구독</Text>
                                  <Text style={st.buyBtnPrice}>
                                    {aiMonthlyPkg.product.priceString} / 월
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                          {aiAnnualPkg && (
                            <TouchableOpacity
                              style={[st.buyBtn, st.buyBtnPurple]}
                              onPress={() =>
                                handlePurchase(
                                  aiAnnualPkg,
                                  "AI PRO 연간 구독이 활성화되었습니다!\n모든 프리미엄 기능을 사용할 수 있어요."
                                )
                              }
                              disabled={purchasing}
                            >
                              {purchasing ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <Text style={st.buyBtnTitle}>
                                      연간 구독
                                    </Text>
                                    <View style={st.saveBadge}>
                                      <Text style={st.saveBadgeText}>
                                        17% 할인
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={st.buyBtnPrice}>
                                    {aiAnnualPkg.product.priceString} / 년
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                          {!aiMonthlyPkg && !aiAnnualPkg && (
                            <View style={{ gap: 10 }}>
                              <View
                                style={[
                                  st.buyBtn,
                                  st.buyBtnGreen,
                                  { opacity: 0.5 },
                                ]}
                              >
                                <Text style={st.buyBtnTitle}>월간 구독</Text>
                                <Text style={st.buyBtnPrice}>$1.99 / 월</Text>
                              </View>
                              <View
                                style={[
                                  st.buyBtn,
                                  st.buyBtnPurple,
                                  { opacity: 0.5 },
                                ]}
                              >
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <Text style={st.buyBtnTitle}>연간 구독</Text>
                                  <View style={st.saveBadge}>
                                    <Text style={st.saveBadgeText}>
                                      17% 할인
                                    </Text>
                                  </View>
                                </View>
                                <Text style={st.buyBtnPrice}>$19.9 / 년</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* ═══ 3. 개발자에게 맥주 사주기 ═══ */}
                    <View style={st.section}>
                      <View style={st.sectionHeader}>
                        <View style={{ width: 36, alignItems: "center" }}>
                          <Ionicons
                            name="beer-outline"
                            size={26}
                            color="#D69E2E"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.sectionTitle}>
                            개발자에게 맥주 사주기
                          </Text>
                          <Text style={st.sectionDesc}>
                            앱 개발을 응원해 주세요!
                          </Text>
                        </View>
                      </View>

                      {beerPkgs.length > 0 ? (
                        <View style={{ gap: 10 }}>
                          {beerPkgs.map((pkg) => (
                            <TouchableOpacity
                              key={pkg.identifier}
                              style={[st.buyBtn, st.buyBtnBeer]}
                              onPress={() =>
                                handlePurchase(
                                  pkg,
                                  "맥주 한 잔 감사히 마시겠습니다! 🍻"
                                )
                              }
                              disabled={purchasing}
                            >
                              {purchasing ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <>
                                  <Text style={st.buyBtnTitle}>
                                    {(pkg.product.title || pkg.identifier)
                                      .replace(/\s*\([^)]*\)\s*$/, "")
                                      .trim()}
                                  </Text>
                                  <Text style={st.buyBtnPrice}>
                                    {pkg.product.priceString}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {/* RevenueCat에 상품 등록 전 표시용 */}
                          {[
                            { label: "🍺 330ml", price: "$1.49" },
                            { label: "🍺 500ml", price: "$1.99" },
                            { label: "🍺 1000ml", price: "$3.49" },
                          ].map((item) => (
                            <View
                              key={item.label}
                              style={[
                                st.buyBtn,
                                st.buyBtnBeer,
                                { opacity: 0.5 },
                              ]}
                            >
                              <Text style={st.buyBtnTitle}>{item.label}</Text>
                              <Text style={st.buyBtnPrice}>{item.price}</Text>
                            </View>
                          ))}
                          <Text
                            style={{
                              fontSize: 12,
                              color: "#A0AEC0",
                              textAlign: "center",
                            }}
                          >
                            곧 출시 예정입니다
                          </Text>
                        </View>
                      )}
                    </View>
                  </>
                )}

                {/* ─── 복원 & 법적 고지 ─── */}
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
                  {
                    "구독은 언제든지 취소할 수 있습니다.\n결제는 구글 플레이 / 앱스토어 계정으로 청구됩니다."
                  }
                </Text>
              </ScrollView>
            </>
          )}
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
    backgroundColor: "#FAFBFC",
  },
  headerEmoji: { fontSize: 36, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1A202C" },
  headerSub: { fontSize: 14, color: "#718096", marginTop: 4 },
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

  /* ─── 섹션 ─── */
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#F7FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sectionEmoji: { fontSize: 28, width: 36, textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1A202C" },
  sectionDesc: { fontSize: 13, color: "#718096", marginTop: 2 },

  /* ─── 기능 목록 ─── */
  featureList: {
    backgroundColor: "#EBF8FF",
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 14,
  },
  featureItem: { fontSize: 13, color: "#2B6CB0", lineHeight: 20 },

  /* ─── 구매 버튼 ─── */
  buyBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buyBtnGray: { backgroundColor: "#4A5568" },
  buyBtnGreen: { backgroundColor: "#38A169" },
  buyBtnPurple: { backgroundColor: "#667EEA" },
  buyBtnBeer: { backgroundColor: "#D69E2E" },
  buyBtnTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  buyBtnPrice: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },

  /* ─── 할인 뱃지 ─── */
  saveBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },

  /* ─── 구매 완료 뱃지 ─── */
  purchasedBadge: {
    backgroundColor: "#F0FFF4",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C6F6D5",
  },
  purchasedText: { fontSize: 14, fontWeight: "600", color: "#38A169" },

  /* ─── 활성 뱃지 ─── */
  activeBadge: {
    backgroundColor: "#38A169",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activeBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },

  /* ─── 준비 중 ─── */
  comingSoon: {
    backgroundColor: "#F7FAFC",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  comingSoonText: { fontSize: 13, color: "#A0AEC0" },

  /* ─── 복원 ─── */
  restoreBtn: { alignItems: "center", paddingVertical: 16, marginTop: 16 },
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

  /* ─── 성공 화면 ─── */
  successContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  successCheckmark: { fontSize: 48, color: "#fff", fontWeight: "700" },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1A202C",
    marginBottom: 8,
  },
  successSub: {
    fontSize: 15,
    color: "#718096",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  successBtn: {
    backgroundColor: "#1A202C",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  successBtnText: { fontSize: 17, fontWeight: "700", color: "#fff" },
});
