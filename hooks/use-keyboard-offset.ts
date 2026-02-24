import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * 키보드가 올라올 때 모달 카드를 위로 밀어올리기 위한 offset 값을 반환합니다.
 * iOS: keyboardWillShow/Hide 사용 (부드러운 애니메이션)
 * Android: keyboardDidShow/Hide 사용
 */
export function useKeyboardOffset(ratio = 1) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvent, (e) => {
      setOffset(-e.endCoordinates.height * ratio);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setOffset(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [ratio]);

  return offset;
}
