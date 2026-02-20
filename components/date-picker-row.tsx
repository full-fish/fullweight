/**
 * DatePickerRow — 날짜 입력 행 (라벨 + TextInput + 캘린더 아이콘)
 * CalendarModal을 내장하여 캘린더 팝업도 함께 제공
 */
import { CalendarModal } from "@/components/calendar-modal";
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
};

export function DatePickerRow({ label, value, onChange }: Props) {
  const [showCal, setShowCal] = useState(false);

  return (
    <>
      <View style={s.dateRow}>
        <Text style={s.dateLabel}>{label}</Text>
        <TouchableOpacity
          style={s.dateInputWrap}
          onPress={() => setShowCal(true)}
        >
          <TextInput
            style={s.dateInput}
            value={value}
            onChangeText={onChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#aaa"
            maxLength={10}
            keyboardType={
              Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
            }
          />
          <Text style={s.dateCalIcon}>📅</Text>
        </TouchableOpacity>
      </View>
      <CalendarModal
        visible={showCal}
        value={value}
        onChange={onChange}
        onClose={() => setShowCal(false)}
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
  dateLabel: {
    width: 50,
    fontSize: 13,
    fontWeight: "600",
    color: "#4A5568",
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
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: "#2D3748",
  },
  dateCalIcon: { fontSize: 16 },
});
