/**
 * 구독 상태를 앱 전역에서 관리하는 Context + Hook
 * _layout.tsx에서 Provider로 감싸고, 필요한 곳에서 usePro() 호출
 */
import { isPro } from "@/utils/purchases";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface ProContextValue {
  /** PRO 구독 여부 */
  isPro: boolean;
  /** 로딩 중 여부 (초기 확인 전) */
  loading: boolean;
  /** 구매/복원 후 수동으로 상태 갱신 */
  refresh: () => Promise<void>;
}

const ProContext = createContext<ProContextValue>({
  isPro: false,
  loading: true,
  refresh: async () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [pro, setPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await isPro();
    setPro(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ProContext.Provider value={{ isPro: pro, loading, refresh }}>
      {children}
    </ProContext.Provider>
  );
}

/**
 * 구독 상태 읽기
 * @example
 * const { isPro, refresh } = usePro();
 */
export function usePro() {
  return useContext(ProContext);
}
