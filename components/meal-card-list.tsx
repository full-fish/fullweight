/**
 * 식사 카드 목록 컴포넌트 (공용)
 * 기록 목록 / 편집 모달에서 식사 타입별 카드를 렌더링
 */
import { mealCardStyles as mc } from "@/constants/common-styles";
import { MEAL_LABELS, MealEntry, MealType } from "@/types";
import React from "react";
import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";

/** 읽기 전용 식사 카드 (기록 목록 표시용) */
type MealCardListProps = {
  meals: MealEntry[];
  onPhotoPress?: (uri: string) => void;
  /** true면 삭제 버튼 표시 */
  showDelete?: boolean;
  onDelete?: (meal: MealEntry) => void;
  /** true면 음식 추가 버튼 표시 */
  showAdd?: boolean;
  onAdd?: (mealType: MealType) => void;
  /** true면 음식 이름 편집 가능 */
  editable?: boolean;
  onFieldEdit?: (mealId: string, field: keyof MealEntry, value: string) => void;
};

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MealCardList = React.memo(function MealCardList({
  meals,
  onPhotoPress,
  showDelete = false,
  onDelete,
  showAdd = false,
  onAdd,
  editable = false,
  onFieldEdit,
}: MealCardListProps) {
  return (
    <>
      {MEAL_TYPES.map((mealType) => {
        const items = meals.filter((m) => m.mealType === mealType);
        if (!showAdd && items.length === 0) return null;

        return (
          <View key={mealType} style={mc.mealCard}>
            <View style={mc.mealHeader}>
              <Text style={mc.mealTitle}>{MEAL_LABELS[mealType]}</Text>
              {items.length > 0 && (
                <Text style={mc.mealKcalBadge}>
                  {items.reduce((sum, m) => sum + m.kcal, 0)} kcal
                </Text>
              )}
            </View>

            {items.map((meal) => (
              <View key={meal.id} style={mc.mealItem}>
                {meal.photoUri && (
                  <TouchableOpacity
                    onPress={() => onPhotoPress?.(meal.photoUri!)}
                  >
                    <Image
                      source={{ uri: meal.photoUri }}
                      style={mc.mealPhoto}
                    />
                  </TouchableOpacity>
                )}
                <View style={mc.mealInfo}>
                  {editable && onFieldEdit ? (
                    <TextInput
                      style={[mc.mealDesc, { padding: 0, marginBottom: 2 }]}
                      value={meal.description ?? ""}
                      onChangeText={(v) =>
                        onFieldEdit(meal.id, "description", v)
                      }
                      placeholder="음식 이름"
                      placeholderTextColor="#CBD5E0"
                    />
                  ) : (
                    <Text style={mc.mealDesc} numberOfLines={1}>
                      {meal.description || "음식"}
                    </Text>
                  )}
                  <View style={mc.macroRow}>
                    <Text style={[mc.macroText, { color: "#E53E3E" }]}>
                      탄 {meal.carb}g
                    </Text>
                    <Text style={[mc.macroText, { color: "#3182CE" }]}>
                      단 {meal.protein}g
                    </Text>
                    <Text style={[mc.macroText, { color: "#D69E2E" }]}>
                      지 {meal.fat}g
                    </Text>
                    <Text style={mc.macroKcal}>{meal.kcal}kcal</Text>
                  </View>
                </View>
                {showDelete && onDelete && (
                  <TouchableOpacity
                    style={mc.mealDeleteBtn}
                    onPress={() => onDelete(meal)}
                  >
                    <Text style={mc.mealDeleteText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {showAdd && onAdd && (
              <TouchableOpacity
                style={mc.addBtn}
                onPress={() => onAdd(mealType)}
              >
                <Text style={mc.addBtnText}>+ 음식 추가</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </>
  );
});
