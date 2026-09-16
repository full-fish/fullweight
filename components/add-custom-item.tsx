import {
  CP_W,
  HUE_H,
  ICON_GRID_GAP,
  ICON_ITEM_SIZE,
  POPULAR_ICONS,
  SV_H,
} from "@/constants/icon-picker";
import {
  CUSTOM_BOOL_COLORS,
  CUSTOM_METRIC_COLORS,
  CustomBoolMetric,
  CustomMetric,
} from "@/types";
import { hexToHsv, hexToRgb, hsvToHex, rgbToHex } from "@/utils/color";
import { loadUserSettings, saveUserSettings } from "@/utils/storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Defs,
  Stop,
  Circle as SvgCircle,
  LinearGradient as SvgLinearGradient,
  Rect as SvgRect,
} from "react-native-svg";

export function AddCustomMetric({
  onAdded,
}: {
  onAdded?: (next: CustomMetric[]) => void;
}) {
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");

  return (
    <>
      <TouchableOpacity
        style={{
          marginTop: 8,
          backgroundColor: "#EBF8FF",
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: "center",
        }}
        onPress={() => {
          setLabel("");
          setUnit("");
          setShow(true);
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#3182CE" }}>
          + 수치 추가
        </Text>
      </TouchableOpacity>

      {show && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShow(false)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.45)",
              padding: 24,
            }}
            activeOpacity={1}
            onPress={() => setShow(false)}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 520,
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 18,
              }}
              onStartShouldSetResponder={() => true}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#1f2937",
                  marginBottom: 6,
                }}
              >
                수치 추가
              </Text>
              <Text
                style={{ fontSize: 13, color: "#4A5568", marginBottom: 12 }}
              >
                기록할 수치의 이름과 단위를 입력하세요
              </Text>

              <View style={{ width: "100%", marginBottom: 12 }}>
                <Text
                  style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}
                >
                  이름
                </Text>
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="예: 악력, 혈압, 혈당"
                  placeholderTextColor="#A0AEC0"
                  style={{
                    width: "100%",
                    height: 40,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                  }}
                />
              </View>

              <View style={{ width: "100%", marginBottom: 20 }}>
                <Text
                  style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}
                >
                  단위
                </Text>
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="예: kg, mmHg, mg/dL"
                  placeholderTextColor="#A0AEC0"
                  style={{
                    width: "100%",
                    height: 40,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                  }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#38A169",
                    borderRadius: 999,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                  onPress={async () => {
                    const l = label.trim();
                    const u = unit.trim();
                    if (!l) {
                      Alert.alert("입력 오류", "수치 이름을 입력해주세요.");
                      return;
                    }
                    if (!u) {
                      Alert.alert("입력 오류", "단위를 입력해주세요.");
                      return;
                    }
                    const cur = await loadUserSettings();
                    const existing: CustomMetric[] = cur.customMetrics ?? [];
                    const key = `custom_${l}`;
                    if (existing.some((c) => c.key === key)) {
                      Alert.alert(
                        "입력 오류",
                        "같은 이름의 수치가 이미 존재합니다."
                      );
                      return;
                    }
                    const colorIdx =
                      existing.length % CUSTOM_METRIC_COLORS.length;
                    const color = CUSTOM_METRIC_COLORS[colorIdx];
                    const newCm: CustomMetric = {
                      key,
                      label: l,
                      unit: u,
                      color,
                    };
                    const next = [...existing, newCm];
                    // ensure new metric is visible by default
                    const nextSettings = {
                      ...cur,
                      customMetrics: next,
                      metricInputVisibility: {
                        ...(cur.metricInputVisibility ?? {}),
                        [key]: true,
                      },
                      metricDisplayVisibility: {
                        ...(cur.metricDisplayVisibility ?? {}),
                        [key]: true,
                      },
                    };
                    await saveUserSettings(nextSettings);
                    setShow(false);
                    Alert.alert("추가 완료", `"${l}" 수치가 추가되었습니다.`);
                    onAdded?.(next);
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>추가</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#EDF2F7",
                    borderRadius: 999,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                  onPress={() => setShow(false)}
                >
                  <Text style={{ color: "#718096", fontWeight: "700" }}>
                    취소
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

/**
 * 체크항목 추가 버튼 + 모달.
 * 설정 화면의 "체크항목 추가"와 동일한 이모지/아이콘/색상 피커 UI를 공유한다.
 */
export function AddCustomBool({
  onAdded,
}: {
  onAdded?: (next: CustomBoolMetric[]) => void;
}) {
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("");
  const [iconName, setIconName] = useState<string | undefined>(undefined);
  const [iconColor, setIconColor] = useState("#718096");
  const [color, setColor] = useState(CUSTOM_BOOL_COLORS[0]);
  const [pickerHue, setPickerHue] = useState(0);
  const [pickerSat, setPickerSat] = useState(1);
  const [pickerVal, setPickerVal] = useState(1);
  const [hexInput, setHexInput] = useState("E91E63");
  const [rInput, setRInput] = useState("233");
  const [gInput, setGInput] = useState("30");
  const [bInput, setBInput] = useState("99");

  const openModal = async () => {
    setLabel("");
    setEmoji("");
    setIconName(undefined);
    const cur = await loadUserSettings();
    const existing: CustomBoolMetric[] = cur.customBoolMetrics ?? [];
    const initColor =
      CUSTOM_BOOL_COLORS[existing.length % CUSTOM_BOOL_COLORS.length];
    setIconColor(initColor);
    setColor(initColor);
    const [h, s, v] = hexToHsv(initColor);
    setPickerHue(h);
    setPickerSat(s);
    setPickerVal(v);
    setHexInput(initColor.slice(1));
    const [r0, g0, b0] = hexToRgb(initColor);
    setRInput(String(r0));
    setGInput(String(g0));
    setBInput(String(b0));
    setShow(true);
  };

  const applyHex = (hex: string) => {
    setIconColor(hex);
    setColor(hex);
    setHexInput(hex.slice(1));
    const [r0, g0, b0] = hexToRgb(hex);
    setRInput(String(r0));
    setGInput(String(g0));
    setBInput(String(b0));
  };

  return (
    <>
      <TouchableOpacity
        style={{
          marginTop: 8,
          backgroundColor: "#FFF5F5",
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: "center",
        }}
        onPress={openModal}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#E53E3E" }}>
          + 체크항목 추가
        </Text>
      </TouchableOpacity>

      {show && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShow(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              activeOpacity={1}
              onPress={() => setShow(false)}
            />
            <View
              style={{
                width: "85%",
                maxHeight: "85%",
                backgroundColor: "#fff",
                borderRadius: 20,
                padding: 24,
                alignItems: "center",
              }}
              onStartShouldSetResponder={() => true}
            >
              <ScrollView
                style={{ width: "100%" }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#2D3748",
                    marginBottom: 4,
                  }}
                >
                  체크항목 추가
                </Text>
                <Text
                  style={{ fontSize: 13, color: "#718096", marginBottom: 20 }}
                >
                  체크로 기록할 항목의 이름을 입력하세요
                </Text>

                {/* 미리보기 */}
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: (iconName ? iconColor : color) + "22",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {iconName ? (
                      POPULAR_ICONS.find((i) => i.name === iconName)
                        ?.library === "mci" ? (
                        <MaterialCommunityIcons
                          name={iconName as any}
                          size={28}
                          color={iconColor}
                        />
                      ) : (
                        <Ionicons
                          name={iconName as any}
                          size={28}
                          color={iconColor}
                        />
                      )
                    ) : emoji ? (
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                    ) : (
                      <Text style={{ fontSize: 28, color: "#CBD5E0" }}>?</Text>
                    )}
                  </View>
                </View>

                {/* 이름 */}
                <View style={{ width: "100%", marginBottom: 12 }}>
                  <Text
                    style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}
                  >
                    이름
                  </Text>
                  <TextInput
                    style={{
                      width: "100%",
                      height: 40,
                      borderWidth: 1,
                      borderColor: "#E2E8F0",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      backgroundColor: "#F7FAFC",
                      color: "#2D3748",
                    }}
                    value={label}
                    onChangeText={setLabel}
                    placeholder="예: 스트레칭, 명상, 금연"
                    placeholderTextColor="#A0AEC0"
                    returnKeyType="next"
                  />
                </View>

                {/* 이모지 직접 입력 */}
                <View style={{ width: "100%", marginBottom: 12 }}>
                  <Text
                    style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}
                  >
                    이모지 직접 입력 (선택)
                  </Text>
                  <TextInput
                    style={{
                      width: "100%",
                      height: 40,
                      borderWidth: 1,
                      borderColor: "#E2E8F0",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      backgroundColor: "#F7FAFC",
                      color: "#2D3748",
                    }}
                    value={emoji}
                    onChangeText={(t) => {
                      setEmoji(t.slice(0, 2));
                      if (t.trim()) setIconName(undefined);
                    }}
                    placeholder="예: 🧘 💊 🚭"
                    placeholderTextColor="#A0AEC0"
                    returnKeyType="done"
                  />
                </View>

                {/* 아이콘 선택 */}
                <View style={{ width: "100%", marginBottom: 12 }}>
                  <Text
                    style={{ fontSize: 13, color: "#4A5568", marginBottom: 8 }}
                  >
                    또는 아이콘 선택
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: ICON_GRID_GAP,
                    }}
                  >
                    {POPULAR_ICONS.map((icon) => (
                      <TouchableOpacity
                        key={icon.name}
                        onPress={() => {
                          setIconName(icon.name);
                          setEmoji("");
                        }}
                        style={{
                          width: ICON_ITEM_SIZE,
                          height: ICON_ITEM_SIZE,
                          borderRadius: 12,
                          backgroundColor:
                            iconName === icon.name
                              ? iconColor + "22"
                              : "#F7FAFC",
                          borderWidth: iconName === icon.name ? 2 : 1,
                          borderColor:
                            iconName === icon.name ? iconColor : "#E2E8F0",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        {icon.library === "mci" ? (
                          <MaterialCommunityIcons
                            name={icon.name as any}
                            size={22}
                            color={
                              iconName === icon.name ? iconColor : "#718096"
                            }
                          />
                        ) : (
                          <Ionicons
                            name={icon.name as any}
                            size={22}
                            color={
                              iconName === icon.name ? iconColor : "#718096"
                            }
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 색상 선택 — 컬러 피커 */}
                <View style={{ width: "100%", marginBottom: 20 }}>
                  <Text
                    style={{ fontSize: 13, color: "#4A5568", marginBottom: 8 }}
                  >
                    색상
                  </Text>
                  {/* SV 패널 */}
                  <View
                    style={{
                      width: CP_W,
                      height: SV_H,
                      borderRadius: 10,
                      overflow: "hidden",
                      marginBottom: 12,
                    }}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(e) => {
                      const { locationX, locationY } = e.nativeEvent;
                      const s2 = Math.max(0, Math.min(1, locationX / CP_W));
                      const v2 = Math.max(0, Math.min(1, 1 - locationY / SV_H));
                      setPickerSat(s2);
                      setPickerVal(v2);
                      applyHex(hsvToHex(pickerHue, s2, v2));
                    }}
                    onResponderMove={(e) => {
                      const { locationX, locationY } = e.nativeEvent;
                      const s2 = Math.max(0, Math.min(1, locationX / CP_W));
                      const v2 = Math.max(0, Math.min(1, 1 - locationY / SV_H));
                      setPickerSat(s2);
                      setPickerVal(v2);
                      applyHex(hsvToHex(pickerHue, s2, v2));
                    }}
                  >
                    <Svg width={CP_W} height={SV_H}>
                      <Defs>
                        <SvgLinearGradient
                          id="addBoolSat"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <Stop offset="0" stopColor="#FFFFFF" />
                          <Stop
                            offset="1"
                            stopColor={`hsl(${pickerHue}, 100%, 50%)`}
                          />
                        </SvgLinearGradient>
                        <SvgLinearGradient
                          id="addBoolVal"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <Stop
                            offset="0"
                            stopColor="rgba(0,0,0,0)"
                            stopOpacity="0"
                          />
                          <Stop offset="1" stopColor="#000" stopOpacity="1" />
                        </SvgLinearGradient>
                      </Defs>
                      <SvgRect
                        width={CP_W}
                        height={SV_H}
                        fill="url(#addBoolSat)"
                      />
                      <SvgRect
                        width={CP_W}
                        height={SV_H}
                        fill="url(#addBoolVal)"
                      />
                      <SvgCircle
                        cx={pickerSat * CP_W}
                        cy={(1 - pickerVal) * SV_H}
                        r={9}
                        fill="none"
                        stroke="#fff"
                        strokeWidth={3}
                      />
                    </Svg>
                  </View>
                  {/* 휴 슬라이더 */}
                  <View
                    style={{
                      width: CP_W,
                      height: HUE_H,
                      borderRadius: HUE_H / 2,
                      overflow: "hidden",
                      marginBottom: 12,
                    }}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(e) => {
                      const h2 = Math.max(
                        0,
                        Math.min(360, (e.nativeEvent.locationX / CP_W) * 360)
                      );
                      setPickerHue(h2);
                      applyHex(hsvToHex(h2, pickerSat, pickerVal));
                    }}
                    onResponderMove={(e) => {
                      const h2 = Math.max(
                        0,
                        Math.min(360, (e.nativeEvent.locationX / CP_W) * 360)
                      );
                      setPickerHue(h2);
                      applyHex(hsvToHex(h2, pickerSat, pickerVal));
                    }}
                  >
                    <Svg width={CP_W} height={HUE_H}>
                      <Defs>
                        <SvgLinearGradient
                          id="addBoolHue"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <Stop offset="0" stopColor="hsl(0,100%,50%)" />
                          <Stop offset="0.167" stopColor="hsl(60,100%,50%)" />
                          <Stop offset="0.333" stopColor="hsl(120,100%,50%)" />
                          <Stop offset="0.5" stopColor="hsl(180,100%,50%)" />
                          <Stop offset="0.667" stopColor="hsl(240,100%,50%)" />
                          <Stop offset="0.833" stopColor="hsl(300,100%,50%)" />
                          <Stop offset="1" stopColor="hsl(360,100%,50%)" />
                        </SvgLinearGradient>
                      </Defs>
                      <SvgRect
                        width={CP_W}
                        height={HUE_H}
                        rx={HUE_H / 2}
                        fill="url(#addBoolHue)"
                      />
                      <SvgCircle
                        cx={Math.max(
                          HUE_H / 2,
                          Math.min(CP_W - HUE_H / 2, (pickerHue / 360) * CP_W)
                        )}
                        cy={HUE_H / 2}
                        r={HUE_H / 2 - 2}
                        fill="none"
                        stroke="#fff"
                        strokeWidth={3}
                      />
                    </Svg>
                  </View>
                  {/* 미리보기 + Hex + RGB 입력 */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: iconColor,
                        borderWidth: 2,
                        borderColor: "#E2E8F0",
                      }}
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        height: 36,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#E2E8F0",
                        paddingHorizontal: 8,
                        width: 100,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: "#718096",
                          fontFamily: "monospace",
                        }}
                      >
                        #
                      </Text>
                      <TextInput
                        style={{
                          flex: 1,
                          height: 36,
                          fontSize: 13,
                          fontFamily: "monospace",
                          color: "#2D3748",
                          paddingVertical: 0,
                        }}
                        value={hexInput}
                        onChangeText={(text) => {
                          const cleaned = text
                            .replace(/[^0-9A-Fa-f]/g, "")
                            .slice(0, 6);
                          setHexInput(cleaned);
                          if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
                            const full = "#" + cleaned;
                            const [h, s2, v2] = hexToHsv(full);
                            setPickerHue(h);
                            setPickerSat(s2);
                            setPickerVal(v2);
                            applyHex(full.toUpperCase());
                          }
                        }}
                        onBlur={() => setHexInput(iconColor.slice(1))}
                        placeholder="RRGGBB"
                        placeholderTextColor="#A0AEC0"
                        autoCapitalize="characters"
                        maxLength={6}
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(
                      [
                        { label: "R", val: rInput, set: setRInput, ch: 0 },
                        { label: "G", val: gInput, set: setGInput, ch: 1 },
                        { label: "B", val: bInput, set: setBInput, ch: 2 },
                      ] as {
                        label: string;
                        val: string;
                        set: (v: string) => void;
                        ch: number;
                      }[]
                    ).map(({ label: chLabel, val, set, ch }) => (
                      <View
                        key={chLabel}
                        style={{ flex: 1, alignItems: "center" }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#718096",
                            marginBottom: 2,
                          }}
                        >
                          {chLabel}
                        </Text>
                        <TextInput
                          style={{
                            width: "100%",
                            height: 40,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: "#E2E8F0",
                            textAlign: "center",
                            fontSize: 13,
                            color: "#2D3748",
                            paddingVertical: 0,
                          }}
                          value={val}
                          onChangeText={(t) => {
                            set(t);
                            const n = parseInt(t, 10);
                            if (!isNaN(n) && n >= 0 && n <= 255) {
                              const rgb: [number, number, number] = [
                                ch === 0 ? n : parseInt(rInput, 10),
                                ch === 1 ? n : parseInt(gInput, 10),
                                ch === 2 ? n : parseInt(bInput, 10),
                              ];
                              if (rgb.every((v) => !isNaN(v))) {
                                const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
                                const [h, s2, v2] = hexToHsv(hex);
                                setPickerHue(h);
                                setPickerSat(s2);
                                setPickerVal(v2);
                                applyHex(hex);
                              }
                            }
                          }}
                          onBlur={() => {
                            const [r0, g0, b0] = hexToRgb(iconColor);
                            setRInput(String(r0));
                            setGInput(String(g0));
                            setBInput(String(b0));
                          }}
                          keyboardType="number-pad"
                          maxLength={3}
                        />
                      </View>
                    ))}
                  </View>
                </View>

                {/* 버튼 */}
                <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: "#4299E1",
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: "center",
                    }}
                    onPress={async () => {
                      const l = label.trim();
                      if (!l) {
                        Alert.alert("입력 오류", "항목 이름을 입력해주세요.");
                        return;
                      }
                      const key = `bool_${l}`;
                      const cur = await loadUserSettings();
                      const existing: CustomBoolMetric[] =
                        cur.customBoolMetrics ?? [];
                      if (existing.some((c) => c.key === key)) {
                        Alert.alert(
                          "입력 오류",
                          "같은 이름의 항목이 이미 존재합니다."
                        );
                        return;
                      }
                      const finalEmoji = emoji.trim() || undefined;
                      const finalIconName = iconName || undefined;
                      const finalIconColor = iconName ? iconColor : undefined;
                      const finalIconLibrary = iconName
                        ? POPULAR_ICONS.find((i) => i.name === iconName)
                            ?.library || undefined
                        : undefined;
                      const newCbm: CustomBoolMetric = {
                        key,
                        label: l,
                        color,
                        emoji: finalIconName ? undefined : finalEmoji,
                        iconName: finalIconName,
                        iconColor: finalIconColor,
                        iconLibrary: finalIconLibrary,
                      };
                      const next = [...existing, newCbm];
                      // 새 항목은 기본적으로 표시(true) 상태로 저장
                      const nextSettings = {
                        ...cur,
                        customBoolMetrics: next,
                        metricInputVisibility: {
                          ...(cur.metricInputVisibility ?? {}),
                          [key]: true,
                        },
                        metricDisplayVisibility: {
                          ...(cur.metricDisplayVisibility ?? {}),
                          [key]: true,
                        },
                      };
                      await saveUserSettings(nextSettings);
                      setShow(false);
                      Alert.alert("추가 완료", `"${l}" 항목이 추가되었습니다.`);
                      onAdded?.(next);
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}
                    >
                      추가
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: "#EDF2F7",
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: "center",
                    }}
                    onPress={() => setShow(false)}
                  >
                    <Text
                      style={{
                        color: "#718096",
                        fontSize: 15,
                        fontWeight: "600",
                      }}
                    >
                      취소
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

export default AddCustomMetric;
