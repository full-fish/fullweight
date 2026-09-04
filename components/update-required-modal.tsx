import React from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.choimanseon.fullweight";

interface UpdateRequiredModalProps {
  visible: boolean;
  onClose?: () => void;
  forceUpdate?: boolean;
}

export default function UpdateRequiredModal({
  visible,
  onClose,
  forceUpdate = false,
}: UpdateRequiredModalProps) {
  if (!visible) return null;

  const openStore = async () => {
    const canOpen = await Linking.canOpenURL("market://");
    const url = canOpen
      ? `market://details?id=com.choimanseon.fullweight`
      : PLAY_STORE_URL;
    Linking.openURL(url).catch(() =>
      Alert.alert("오류", "플레이 스토어를 열 수 없습니다.")
    );
  };

  React.useEffect(() => {
    if (forceUpdate) {
      openStore();
    }
  }, [forceUpdate]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {
        if (!forceUpdate) onClose?.();
      }}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>업데이트가 필요합니다</Text>
          <Text style={styles.subtitle}>
            {forceUpdate
              ? "최신 앱으로 업데이트해야 계속 사용할 수 있습니다.\n플레이 스토어로 이동해 업데이트를 완료해 주세요."
              : "안정적인 이용을 위해 최신 버전으로 업데이트해 주세요."}
          </Text>
          <Pressable style={styles.button} onPress={openStore}>
            <Text style={styles.buttonText}>플레이 스토어에서 업데이트</Text>
          </Pressable>
          {!forceUpdate && (
            <Pressable style={styles.skip} onPress={onClose}>
              <Text style={styles.skipText}>나중에 하기</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 22,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#4CAF50",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  skip: {
    paddingVertical: 8,
    alignItems: "center",
  },
  skipText: {
    fontSize: 13,
    color: "#9ca3af",
  },
});
