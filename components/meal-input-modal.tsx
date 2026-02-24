/**
 * 식사 입력 바텀시트 모달 (공용 컴포넌트)
 * index.tsx / calendar.tsx에서 동일하게 사용되던 식사 추가 모달을 통합
 */
import { mealInputModalStyles as ms } from "@/constants/common-styles";
import { MEAL_LABELS, MealType } from "@/types";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type MealInputModalProps = {
  visible: boolean;
  mealType: MealType;
  photoUri?: string;
  desc: string;
  carb: string;
  protein: string;
  fat: string;
  kcal: string;
  aiAnalyzing: boolean;
  kbOffset: number;
  onClose: () => void;
  onPhotoSelect: (source: "camera" | "gallery") => void;
  onRemovePhoto: () => void;
  onChangeDesc: (v: string) => void;
  onChangeMacro: (key: "carb" | "protein" | "fat", v: string) => void;
  onSave: () => void;
};

export const MealInputModal = React.memo(function MealInputModal({
  visible,
  mealType,
  photoUri,
  desc,
  carb,
  protein,
  fat,
  kcal,
  aiAnalyzing,
  kbOffset,
  onClose,
  onPhotoSelect,
  onRemovePhoto,
  onChangeDesc,
  onChangeMacro,
  onSave,
}: MealInputModalProps) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={[ms.sheet, { transform: [{ translateY: kbOffset }] }]}>
          {/* 헤더 */}
          <View style={ms.header}>
            <Text style={ms.title}>{MEAL_LABELS[mealType]} 추가</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={ms.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 45 }}
          >
            {/* 사진 선택 */}
            <View style={ms.photoRow}>
              {photoUri ? (
                <View style={{ position: "relative" }}>
                  <Image source={{ uri: photoUri }} style={ms.photoPreview} />
                  {aiAnalyzing && (
                    <View style={ms.photoAnalyzingOverlay}>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={ms.photoAnalyzingText}>AI 분석 중...</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={ms.photoRemove}
                    onPress={onRemovePhoto}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={ms.photoBtn}
                    onPress={() => onPhotoSelect("camera")}
                  >
                    <Text style={ms.photoBtnText}>촬영</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={ms.photoBtn}
                    onPress={() => onPhotoSelect("gallery")}
                  >
                    <Text style={ms.photoBtnText}>갤러리</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* 음식 이름 */}
            <Text style={ms.label}>음식 이름 *</Text>
            <TextInput
              style={ms.input}
              value={desc}
              onChangeText={onChangeDesc}
              placeholder="예: 닭가슴살 볶음밥"
              placeholderTextColor="#CBD5E0"
            />

            {/* 영양소 입력 */}
            <Text style={ms.label}>영양소 (먹은 양 전체)</Text>
            <View style={ms.macroGrid}>
              {(
                [
                  {
                    label: "탄수화물(g)",
                    key: "carb" as const,
                    value: carb,
                    color: "#E53E3E",
                  },
                  {
                    label: "단백질(g)",
                    key: "protein" as const,
                    value: protein,
                    color: "#3182CE",
                  },
                  {
                    label: "지방(g)",
                    key: "fat" as const,
                    value: fat,
                    color: "#D69E2E",
                  },
                ] as const
              ).map(({ label, key, value, color }) => (
                <View key={label} style={ms.macroField}>
                  <Text style={[ms.macroLabel, { color }]}>{label}</Text>
                  <TextInput
                    style={ms.macroInput}
                    value={value}
                    onChangeText={(v) => onChangeMacro(key, v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#CBD5E0"
                  />
                </View>
              ))}
              <View style={ms.macroField}>
                <Text style={[ms.macroLabel, { color: "#718096" }]}>
                  칼로리(kcal)
                </Text>
                <TextInput
                  style={[ms.macroInput, { backgroundColor: "#F0F4F8" }]}
                  value={kcal}
                  editable={false}
                  placeholder="자동 계산"
                  placeholderTextColor="#CBD5E0"
                />
              </View>
            </View>
            <Text style={ms.kcalHint}>
              * 칼로리는 탄단지 입력 시 자동 계산됩니다
            </Text>

            <TouchableOpacity style={ms.saveBtn} onPress={onSave}>
              <Text style={ms.saveBtnText}>저장</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});
