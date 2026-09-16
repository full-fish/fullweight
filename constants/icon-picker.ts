import { Dimensions } from "react-native";

/* ───── 아이콘/색상 피커 공용 레이아웃 상수 ───── */

const SCREEN_WIDTH = Dimensions.get("window").width;
const ICON_GRID_COLS = 6;
export const ICON_GRID_GAP = 8;
const ICON_CARD_CONTENT_W = SCREEN_WIDTH * 0.85 - 48;
export const ICON_ITEM_SIZE = Math.floor(
  (ICON_CARD_CONTENT_W - (ICON_GRID_COLS - 1) * ICON_GRID_GAP) / ICON_GRID_COLS
);
export const CP_W = ICON_CARD_CONTENT_W; // color picker width
export const SV_H = Math.round(CP_W * 0.55); // SV panel height
export const HUE_H = 24; // hue bar height

/* ───── 아이콘 선택 목록 ───── */
export const POPULAR_ICONS: { name: string; label: string; library?: "mci" }[] =
  [
    { name: "fitness-outline", label: "운동" },
    { name: "barbell-outline", label: "바벨" },
    { name: "bicycle-outline", label: "자전거" },
    { name: "walk-outline", label: "걷기" },
    { name: "water-outline", label: "물" },
    { name: "cafe-outline", label: "커피" },
    { name: "restaurant-outline", label: "식사" },
    { name: "bed-outline", label: "수면" },
    { name: "moon-outline", label: "달" },
    { name: "sunny-outline", label: "태양" },
    { name: "heart-outline", label: "하트" },
    { name: "medkit-outline", label: "약" },
    { name: "bandage-outline", label: "반창고" },
    { name: "book-outline", label: "책" },
    { name: "school-outline", label: "학교" },
    { name: "musical-notes-outline", label: "음악" },
    { name: "game-controller-outline", label: "게임" },
    { name: "happy-outline", label: "행복" },
    { name: "sad-outline", label: "슬픔" },
    { name: "flash-outline", label: "번개" },
    { name: "leaf-outline", label: "잎" },
    { name: "flower-outline", label: "꽃" },
    { name: "paw-outline", label: "발자국" },
    { name: "timer-outline", label: "타이머" },
    { name: "alarm-outline", label: "알람" },
    { name: "brush-outline", label: "브러시" },
    { name: "color-palette-outline", label: "팔레트" },
    { name: "camera-outline", label: "카메라" },
    { name: "beer-outline", label: "맥주" },
    { name: "wine-outline", label: "와인" },
    { name: "pizza-outline", label: "피자" },
    { name: "ice-cream-outline", label: "아이스크림" },
    { name: "star-outline", label: "별" },
    { name: "trophy-outline", label: "트로피" },
    { name: "flag-outline", label: "깃발" },
    { name: "checkmark-circle-outline", label: "체크" },
    { name: "snow-outline", label: "눈" },
    { name: "sparkles", label: "반짝" },
    { name: "rocket-outline", label: "로켓" },
    { name: "body-outline", label: "몸" },
    { name: "eye-outline", label: "눈(eye)" },
    { name: "thumbs-up-outline", label: "좋아요" },
    { name: "globe-outline", label: "지구" },
    { name: "smoking", label: "담배", library: "mci" },
    { name: "smoking-off", label: "금연", library: "mci" },
    { name: "pill", label: "알약", library: "mci" },
    { name: "meditation", label: "명상", library: "mci" },
    { name: "yoga", label: "요가", library: "mci" },
  ];
