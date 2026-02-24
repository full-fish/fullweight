/**
 * 공통 스타일 정의
 * index.tsx / calendar.tsx 등 여러 화면에서 중복 사용되던 스타일을 한곳에 모음
 */
import { Dimensions, StyleSheet } from "react-native";

const { width } = Dimensions.get("window");

/** 식사 카드 & 목록 스타일 (기록탭 / 캘린더 공용) */
export const mealCardStyles = StyleSheet.create({
  section: { marginBottom: 24 },
  mealCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mealTitle: { fontSize: 16, fontWeight: "600", color: "#2D3748" },
  mealKcalBadge: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4CAF50",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  mealItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFC",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  mealPhoto: {
    width: 52,
    height: 52,
    borderRadius: 8,
    marginRight: 10,
  },
  mealInfo: { flex: 1 },
  mealDesc: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 4,
  },
  macroRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  macroText: { fontSize: 12, fontWeight: "500" },
  macroKcal: { fontSize: 12, color: "#718096", fontWeight: "500" },
  mealDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FED7D7",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  mealDeleteText: { fontSize: 12, color: "#E53E3E", fontWeight: "700" },
  addBtn: {
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: "600", color: "#4A5568" },

  /* 섭취 vs 권장 비교 */
  compCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginTop: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  compTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 10,
  },
  compTotalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },
  compTotalKcal: { fontSize: 28, fontWeight: "700", color: "#2D3748" },
  compTotalUnit: { fontSize: 14, color: "#718096" },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EDF2F7",
    marginBottom: 16,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 5 },
  macroCompRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  macroCompLabel: {
    flexDirection: "row",
    alignItems: "center",
    width: 70,
  },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  macroCompText: { fontSize: 12, color: "#4A5568", fontWeight: "500" },
  macroBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EDF2F7",
    marginHorizontal: 8,
    overflow: "hidden",
  },
  macroBarFill: { height: "100%", borderRadius: 4 },
  macroCompValue: {
    fontSize: 12,
    color: "#718096",
    width: 80,
    textAlign: "right",
  },
});

/** 식사 입력 바텀시트 모달 스타일 (기록탭 / 캘린더 공용) */
export const mealInputModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#2D3748" },
  closeBtn: { fontSize: 18, color: "#718096", padding: 4 },
  photoRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  photoPreview: { width: 120, height: 90, borderRadius: 10 },
  photoAnalyzingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoAnalyzingText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBtn: {
    flex: 1,
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  photoBtnText: { fontSize: 14, fontWeight: "600", color: "#4A5568" },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4A5568",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
    marginBottom: 4,
  },
  macroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  macroField: { width: "47%" },
  macroLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  macroInput: {
    height: 40,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
  },
  kcalHint: { fontSize: 11, color: "#A0AEC0", marginBottom: 16 },
  saveBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

/** 사진 확대 모달 스타일 (공용) */
export const zoomModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width,
    height: width,
  },
});

/** 카드 공통 그림자 스타일 */
export const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
} as const;

/** 메모 섹션 스타일 (공용) */
export const memoStyles = StyleSheet.create({
  section: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F4F8",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A5568",
    marginBottom: 6,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardText: {
    fontSize: 13,
    color: "#4A5568",
    lineHeight: 18,
  },
});
