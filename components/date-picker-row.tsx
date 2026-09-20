/**
 * DatePickerRow — 날짜 입력 행 (라벨 + TextInput + 캘린더 아이콘)
 * CalendarModal을 내장하여 캘린더 팝업도 함께 제공
 */
import { CalendarModal } from "@/components/calendar-modal";
import { normalizeDateString } from "@/utils/format";
import Entypo from "@expo/vector-icons/Entypo";
import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  maxDate?: string;
  /** 연도 선택 목록 범위 (기본 1950~올해) */
  yearRange?: { from: number; to: number };
  /** 라벨 위치 — left: 입력칸 왼쪽, top: 입력칸 위 */
  labelPosition?: "left" | "top";
};

export function DatePickerRow({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  yearRange,
  labelPosition = "left",
}: Props) {
  const [showCal, setShowCal] = useState(false);
  const isTop = labelPosition === "top";

  return (
    <>
      <View style={isTop ? s.dateColumn : s.dateRow}>
        <Text style={isTop ? s.dateLabelTop : s.dateLabel}>{label}</Text>
        <TouchableOpacity
          style={[s.dateInputWrap, isTop && s.dateInputWrapTop]}
          onPress={() => setShowCal(true)}
        >
          <TextInput
            style={[s.dateInput, isTop && s.dateInputTop]}
            value={value}
            // YYYYMMDD 8자리가 채워지면 YYYY-MM-DD로 바로 정규화
            onChangeText={(t) => onChange(normalizeDateString(t) ?? t)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#aaa"
            maxLength={10}
            keyboardType={
              Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
            }
          />
          <Entypo name="calendar" size={24} color="black" />
        </TouchableOpacity>
      </View>
      <CalendarModal
        visible={showCal}
        value={value}
        onChange={onChange}
        onClose={() => setShowCal(false)}
        minDate={minDate}
        maxDate={maxDate}
        yearRange={yearRange}
      />
    </>
  );
}

const s = StyleSheet.create({
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  dateColumn: {
    marginBottom: 8,
  },
  dateLabel: {
    width: 50,
    fontSize: 13,
    fontWeight: "600",
    color: "#4A5568",
  },
  dateLabelTop: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4A5568",
    marginTop: 12,
    marginBottom: 4,
  },
  dateInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    backgroundColor: "#F7FAFC",
    paddingHorizontal: 10,
    height: 36,
  },
  dateInputWrapTop: {
    height: 44,
    borderRadius: 10,
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: "#2D3748",
  },
  dateInputTop: {
    height: 44,
    paddingHorizontal: 4,
    fontSize: 15,
  },
});
