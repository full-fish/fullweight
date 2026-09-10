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
  LayoutAnimation,
  Modal,
  PanResponder,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
        return a.name.localeCompare(b.name, "ko");
      });
      return next;
    }
    if (sortMode === "nameDesc") {
      next.sort(function (a, b) {
        return b.name.localeCompare(a.name, "ko");
      });
      return next;
    }
    if (sortMode === "created") {
      next.sort(function (a, b) {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
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

  function toggleAddForm() {
    setShowAddForm(function (v) {
      return !v;
    });
  }

  if (!props.visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <View style={fs.overlay}>
        <View style={[fs.sheet, { transform: [{ translateY: kbOffset }] }]}>
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
              <TouchableOpacity onPress={toggleSortMenu}>
                <Text style={fs.sortBtn}>☰</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleAddForm}>
                <Text style={fs.addHeaderBtn}>＋</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={props.onClose}>
                <Text style={fs.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {sortMenuVisible && (
            <View style={fs.sortMenu}>
              {[
                ["사용자 정의", "custom"],
                ["오름차순", "nameAsc"],
                ["내림차순", "nameDesc"],
                ["생성순", "created"],
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
            </View>
          )}

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
