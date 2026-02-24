/**
 * 사진 확대 모달 (공용 컴포넌트)
 * index.tsx / calendar.tsx에서 동일하게 사용
 */
import { zoomModalStyles } from "@/constants/common-styles";
import React from "react";
import { Image, Modal, TouchableOpacity } from "react-native";

type PhotoZoomModalProps = {
  uri: string | null;
  onClose: () => void;
};

export const PhotoZoomModal = React.memo(function PhotoZoomModal({
  uri,
  onClose,
}: PhotoZoomModalProps) {
  if (!uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={zoomModalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Image
          source={{ uri }}
          style={zoomModalStyles.image}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </Modal>
  );
});
