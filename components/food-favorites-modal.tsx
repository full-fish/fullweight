/**
 * 즐겨찾기 음식 모달
 * 자주 먹는 음식을 저장해두고 빠르게 불러올 수 있도록 지원
 */
import { foodFavoritesModalStyles as fs } from "@/constants/common-styles";
import { useKeyboardOffset } from "@/hooks/use-keyboard-offset";
import { FavoriteFood, FavoriteSortMode } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  LayoutAnimation,
  Modal,
  PanResponder,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const WINDOW_HEIGHT = Dimensions.get("window").height;

const DEFAULT_FAVORITE_FOODS = (
  require("@/utils/data.json") as {
    name: string;
    carb: number;
    protein: number;
    fat: number;
    kcal?: number;
  }[]
).filter((food) => food && typeof food.name === "string");

type FoodFavoritesModalProps = {
  visible: boolean;
  favorites: FavoriteFood[];
  onClose: () => void;
  onSelect: (food: FavoriteFood) => void;
  onAdd: (food: {
    name: string;
    carb: number;
    protein: number;
    fat: number;
  }) => void;
  onDelete: (id: string) => void;
  onBulkAdd: (
    foods: {
      name: string;
      carb: number;
      protein: number;
      fat: number;
    }[]
  ) => void;
  onClearAll: () => void;
  onToggleFavorite: (id: string) => void;
  onReorder: (next: FavoriteFood[]) => void;
};

export const FoodFavoritesModal = React.memo(function FoodFavoritesModal(
  props: FoodFavoritesModalProps
) {
  const [name, setName] = useState("");
  const [carb, setCarb] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [favoritePriorityEnabled, setFavoritePriorityEnabled] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<FavoriteSortMode>("custom");
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [sheetLayout, setSheetLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [menuAnchorLayout, setMenuAnchorLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [menuDirection, setMenuDirection] = useState<"down" | "up">("down");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reorderActiveId, setReorderActiveId] = useState<string | null>(null);

  const dragRef = useRef<{ id: string; from: number; current: number } | null>(
    null
  );
  const kbOffset = useKeyboardOffset();

  function sortGroup(group: FavoriteFood[]) {
    const next = [...group];
    if (sortMode === "nameAsc") {
      next.sort(function (a, b) {
        return a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id);
      });
      return next;
    }
    if (sortMode === "nameDesc") {
      next.sort(function (a, b) {
        return b.name.localeCompare(a.name, "ko") || a.id.localeCompare(b.id);
      });
      return next;
    }
    if (sortMode === "newest") {
      next.sort(function (a, b) {
        const timeDiff =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id);
      });
      return next;
    }
    if (sortMode === "oldest") {
      next.sort(function (a, b) {
        const timeDiff =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id);
      });
      return next;
    }
    return next;
  }

  const sortedFavorites = favoritePriorityEnabled
    ? [
        ...sortGroup(
          props.favorites.filter(function (food) {
            return food.isFavorite;
          })
        ),
        ...sortGroup(
          props.favorites.filter(function (food) {
            return !food.isFavorite;
          })
        ),
      ]
    : sortGroup(props.favorites);

  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleFavorites = normalizedSearch
    ? sortedFavorites.filter(function (food) {
        return food.name.toLowerCase().includes(normalizedSearch);
      })
    : sortedFavorites;

  // PanResponder 내부에서 최신 상태를 참조하기 위한 Ref
  const stateRef = useRef({
    sortedFavorites: sortedFavorites,
    sortMode: sortMode,
    reorderActiveId: reorderActiveId,
    onReorder: props.onReorder,
  });
  stateRef.current = {
    sortedFavorites: sortedFavorites,
    sortMode: sortMode,
    reorderActiveId: reorderActiveId,
    onReorder: props.onReorder,
  };

  const panResponders = useRef(new Map());

  function getPanResponder(id: string) {
    if (!panResponders.current.has(id)) {
      const pr = PanResponder.create({
        onStartShouldSetPanResponder: function () {
          const state = stateRef.current;
          return state.sortMode === "custom" && state.reorderActiveId === id;
        },
        onMoveShouldSetPanResponder: function (_, gestureState) {
          const state = stateRef.current;
          return (
            state.sortMode === "custom" &&
            state.reorderActiveId === id &&
            Math.abs(gestureState.dy) > 6
          );
        },
        onPanResponderGrant: function () {
          const state = stateRef.current;
          const fromIndex = state.sortedFavorites.findIndex(function (item) {
            return item.id === id;
          });
          if (fromIndex < 0) return;
          dragRef.current = { id: id, from: fromIndex, current: fromIndex };
          setDraggingId(id);
        },
        onPanResponderMove: function (_, gestureState) {
          if (!dragRef.current || dragRef.current.id !== id) return;
          const state = stateRef.current;
          const fromIndex = dragRef.current.from;
          const currentIndex = dragRef.current.current;

          const deltaIndex = Math.round(gestureState.dy / 52);
          const nextIndex = Math.min(
            state.sortedFavorites.length - 1,
            Math.max(0, fromIndex + deltaIndex)
          );

          if (nextIndex === currentIndex) return;

          const reordered = [...state.sortedFavorites];
          const item = reordered.splice(currentIndex, 1)[0];
          reordered.splice(nextIndex, 0, item);

          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          dragRef.current.current = nextIndex;
          state.onReorder(reordered);
        },
        onPanResponderRelease: function () {
          dragRef.current = null;
          setDraggingId(null);
          setReorderActiveId(null);
        },
        onPanResponderTerminate: function () {
          dragRef.current = null;
          setDraggingId(null);
          setReorderActiveId(null);
        },
      });
      panResponders.current.set(id, pr);
    }
    return panResponders.current.get(id);
  }

  function handleAdd() {
    if (!name.trim()) return;
    props.onAdd({
      name: name.trim(),
      carb: parseFloat(carb) || 0,
      protein: parseFloat(protein) || 0,
      fat: parseFloat(fat) || 0,
    });
    setName("");
    setCarb("");
    setProtein("");
    setFat("");
    setShowAddForm(false);
  }

  function handleSortChange(mode: FavoriteSortMode) {
    setSortMode(mode);
    setSortMenuVisible(false);
  }

  function handleAddDefaultFavorites() {
    const existing = new Set(
      props.favorites.map((food) => food.name.trim().toLowerCase())
    );
    const toAdd = DEFAULT_FAVORITE_FOODS.filter(
      (food) => !existing.has(food.name.trim().toLowerCase())
    );

    if (toAdd.length === 0) {
      Alert.alert("알림", "기본 즐겨찾기 음식이 모두 이미 등록되어 있습니다.");
      return;
    }

    Alert.alert(
      "기본 음식 추가",
      `${toAdd.length}개의 음식이 즐겨찾기에 등록 됩니다. 계속할까요?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "확인",
          style: "default",
          onPress: function () {
            props.onBulkAdd(
              toAdd.map((food) => ({
                name: food.name,
                carb: Number(food.carb) || 0,
                protein: Number(food.protein) || 0,
                fat: Number(food.fat) || 0,
              }))
            );

            setSortMenuVisible(false);
            Alert.alert(
              "기본 음식 추가",
              `${toAdd.length}개의 음식이 즐겨찾기에 등록 됩니다`
            );
          },
        },
      ]
    );
  }

  function handleClearAllFavorites() {
    if (props.favorites.length === 0) {
      Alert.alert("알림", "삭제할 즐겨찾기가 없습니다.");
      return;
    }

    Alert.alert(
      "즐겨찾기 전체 삭제",
      `저장된 ${props.favorites.length}개의 모든 즐겨찾기를 삭제할까요?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: function () {
            props.onClearAll();
            setSortMenuVisible(false);
          },
        },
      ]
    );
  }

  function toggleFavoritePriority() {
    setFavoritePriorityEnabled(function (v) {
      return !v;
    });
  }

  function toggleSortMenu() {
    setSortMenuVisible(function (v) {
      return !v;
    });
  }

  function handleSheetLayout(event: {
    nativeEvent: {
      layout: { x: number; y: number; width: number; height: number };
    };
  }) {
    const nextLayout = event.nativeEvent.layout;
    setSheetLayout(nextLayout);

    const triggerBottomY =
      nextLayout.y + menuAnchorLayout.y + menuAnchorLayout.height;
    const dropdownNeededHeight = 260;
    const availableBelow =
      WINDOW_HEIGHT - (triggerBottomY + 36 + dropdownNeededHeight);
    const availableAbove = triggerBottomY - 36 - dropdownNeededHeight;

    const shouldOpenUp = availableBelow < 0 && availableAbove > 0;

    setMenuDirection(shouldOpenUp ? "up" : "down");
  }

  function handleMenuAnchorLayout(event: {
    nativeEvent: {
      layout: { x: number; y: number; width: number; height: number };
    };
  }) {
    const nextLayout = event.nativeEvent.layout;
    setMenuAnchorLayout(nextLayout);

    const triggerBottomY = sheetLayout.y + nextLayout.y + nextLayout.height;
    const dropdownNeededHeight = 260;
    const availableBelow =
      WINDOW_HEIGHT - (triggerBottomY + 36 + dropdownNeededHeight);
    const availableAbove = triggerBottomY - 36 - dropdownNeededHeight;

    const shouldOpenUp = availableBelow < 0 && availableAbove > 0;

    setMenuDirection(shouldOpenUp ? "up" : "down");
  }

  function toggleAddForm() {
    setShowAddForm(function (v) {
      return !v;
    });
  }

  if (!props.visible) return null;

  const dropdownStyle =
    menuDirection === "up" ? [fs.sortMenu, fs.sortMenuUp] : fs.sortMenu;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <View style={fs.overlay}>
        <View
          style={[fs.sheet, { transform: [{ translateY: kbOffset }] }]}
          onLayout={handleSheetLayout}
        >
          <View style={fs.header}>
            <Text style={fs.title}>즐겨찾기</Text>
            <View style={fs.headerActions}>
              <TouchableOpacity
                style={[
                  fs.filterBtn,
                  favoritePriorityEnabled && fs.filterBtnActive,
                ]}
                onPress={toggleFavoritePriority}
              >
                <Ionicons
                  name={favoritePriorityEnabled ? "heart" : "heart-outline"}
                  size={17}
                  color={favoritePriorityEnabled ? "#ef0d0d" : "#94A3B8"}
                />
              </TouchableOpacity>

              <View style={fs.filterMenuWrap} onLayout={handleMenuAnchorLayout}>
                <TouchableOpacity
                  onPress={toggleSortMenu}
                  style={fs.sortTrigger}
                >
                  <Text style={fs.sortTriggerText}>☰</Text>
                </TouchableOpacity>

                {sortMenuVisible && (
                  <View style={dropdownStyle}>
                    {[
                      ["사용자 정의", "custom"],
                      ["오름차순", "nameAsc"],
                      ["내림차순", "nameDesc"],
                      ["최신순", "newest"],
                      ["오래된순", "oldest"],
                    ].map(function (menuItem) {
                      const label = menuItem[0];
                      const value = menuItem[1];
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[
                            fs.sortMenuItem,
                            sortMode === value && fs.sortMenuItemActive,
                          ]}
                          onPress={function () {
                            handleSortChange(value as FavoriteSortMode);
                          }}
                        >
                          <Text style={fs.sortMenuText}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}

                    <View style={fs.sortMenuDivider} />

                    <TouchableOpacity
                      style={fs.sortMenuItem}
                      onPress={handleClearAllFavorites}
                    >
                      <Text style={fs.sortMenuText}>전체 삭제</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={fs.sortMenuItem}
                      onPress={handleAddDefaultFavorites}
                    >
                      <Text style={fs.sortMenuText}>기본 음식 추가</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TouchableOpacity onPress={toggleAddForm}>
                <Text style={fs.addHeaderBtn}>＋</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={props.onClose}>
                <Text style={fs.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={fs.searchBox}>
            <Ionicons name="search-outline" size={15} color="#94A3B8" />
            <TextInput
              style={fs.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="음식 이름 검색"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {showAddForm && (
            <View style={fs.addForm}>
              <TextInput
                style={fs.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="음식 이름"
                placeholderTextColor="#94A3B8"
              />
              <View style={fs.addMacroRow}>
                <TextInput
                  style={fs.macroInput}
                  value={carb}
                  onChangeText={setCarb}
                  keyboardType="numeric"
                  placeholder="탄수화물(g)"
                  placeholderTextColor="#94A3B8"
                />
                <TextInput
                  style={fs.macroInput}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="numeric"
                  placeholder="단백질(g)"
                  placeholderTextColor="#94A3B8"
                />
                <TextInput
                  style={fs.macroInput}
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="numeric"
                  placeholder="지방(g)"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity
                  style={[fs.addBtn, !name.trim() && fs.addBtnDisabled]}
                  onPress={handleAdd}
                  disabled={!name.trim()}
                >
                  <Text style={fs.addBtnText}>추가</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ScrollView
            style={fs.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 45 }}
            scrollEnabled={sortMode !== "custom" || !reorderActiveId}
          >
            {visibleFavorites.length === 0 ? (
              <Text style={fs.emptyText}>
                {normalizedSearch
                  ? "일치하는 즐겨찾기가 없습니다."
                  : "저장된 즐겨찾기가 없습니다."}
              </Text>
            ) : (
              visibleFavorites.map(function (food) {
                return (
                  <View
                    key={food.id}
                    style={[
                      fs.item,
                      (draggingId === food.id ||
                        dragRef.current?.id === food.id) &&
                        fs.itemDragging,
                    ]}
                    {...getPanResponder(food.id).panHandlers}
                  >
                    <TouchableOpacity
                      style={fs.favoriteToggle}
                      onPress={function () {
                        props.onToggleFavorite(food.id);
                      }}
                      onLongPress={function () {
                        if (sortMode === "custom") {
                          setReorderActiveId(food.id);
                          setDraggingId(food.id);
                        }
                      }}
                      delayLongPress={220}
                    >
                      <Ionicons
                        name={food.isFavorite ? "heart" : "heart-outline"}
                        size={18}
                        color={food.isFavorite ? "#ef0d0d" : "#94A3B8"}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={function () {
                        props.onSelect(food);
                      }}
                      onLongPress={function () {
                        if (sortMode === "custom") {
                          setReorderActiveId(food.id);
                          setDraggingId(food.id);
                        }
                      }}
                      delayLongPress={220}
                    >
                      <Text style={fs.itemName}>{food.name}</Text>
                      <Text style={fs.itemMacro}>
                        탄 {food.carb}g · 단 {food.protein}g · 지 {food.fat}g ·{" "}
                        {food.kcal}kcal
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={fs.deleteBtn}
                      onPress={function () {
                        props.onDelete(food.id);
                      }}
                    >
                      <Text style={fs.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});
