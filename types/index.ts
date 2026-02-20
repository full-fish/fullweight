export type WeightRecord = {
  id: string;
  date: string; // YYYY-MM-DD (로컬 날짜)
  weight: number; // kg
  waist?: number; // cm (선택)
  exercised: boolean;
  drank: boolean;
};
