import { loadUserSettings } from "@/utils/storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

type LockScreenProps = {
  onUnlock: () => void;
};

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState("");
  const [useBiometric, setUseBiometric] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);

  useEffect(() => {
    loadUserSettings().then((s) => {
      setStoredPin(s.lockPin ?? "");
      setUseBiometric(s.lockBiometric ?? false);
    });
    LocalAuthentication.hasHardwareAsync().then((has) => {
      if (has) {
        LocalAuthentication.isEnrolledAsync().then(setHasBiometric);
      }
    });
  }, []);

  const tryBiometric = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "앱 잠금 해제",
        cancelLabel: "PIN 입력",
        fallbackLabel: "PIN 입력",
        disableDeviceFallback: true,
      });
      if (result.success) {
        onUnlock();
      }
    } catch {
      // ignore
    }
  }, [onUnlock]);

  useEffect(() => {
    if (useBiometric && hasBiometric) {
      tryBiometric();
    }
  }, [useBiometric, hasBiometric, tryBiometric]);

  const handlePress = (digit: string) => {
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      if (next === storedPin) {
        onUnlock();
      } else {
        Alert.alert("오류", "PIN이 일치하지 않습니다.");
        setPin("");
      }
    }
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
  };

  const dots = Array.from({ length: 4 }, (_, i) => i < pin.length);

  return (
    <View style={ls.container}>
      <Text style={ls.lockIcon}>🔒</Text>
      <Text style={ls.title}>앱 잠금</Text>
      <Text style={ls.subtitle}>PIN을 입력해주세요</Text>

      <View style={ls.dotsRow}>
        {dots.map((filled, i) => (
          <View key={i} style={[ls.dot, filled && ls.dotFilled]} />
        ))}
      </View>

      <View style={ls.padContainer}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          ["bio", "0", "del"],
        ].map((row, ri) => (
          <View key={ri} style={ls.padRow}>
            {row.map((key) => {
              if (key === "bio") {
                if (useBiometric && hasBiometric) {
                  return (
                    <TouchableOpacity
                      key={key}
                      style={ls.padKey}
                      onPress={tryBiometric}
                    >
                      <Text style={ls.padKeySpecial}>👆</Text>
                    </TouchableOpacity>
                  );
                }
                return <View key={key} style={ls.padKey} />;
              }
              if (key === "del") {
                return (
                  <TouchableOpacity
                    key={key}
                    style={ls.padKey}
                    onPress={handleDelete}
                  >
                    <Text style={ls.padKeySpecial}>⌫</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={key}
                  style={ls.padKey}
                  onPress={() => handlePress(key)}
                >
                  <Text style={ls.padKeyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const ls = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A202C",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#A0AEC0",
    marginBottom: 32,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 40,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#A0AEC0",
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  padContainer: {
    gap: 12,
  },
  padRow: {
    flexDirection: "row",
    gap: 20,
    justifyContent: "center",
  },
  padKey: {
    width: Math.min(width * 0.2, 80),
    height: Math.min(width * 0.2, 80),
    borderRadius: Math.min(width * 0.1, 40),
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  padKeyText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
  },
  padKeySpecial: {
    fontSize: 24,
    color: "#A0AEC0",
  },
});
