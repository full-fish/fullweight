/**
 * 구독/멤버십 상태를 앱 전역에서 관리하는 Context + Hook
 *
 * 멤버십 구조:
 * - 무료 유저: 배너 광고 표시, AI 하루 2회, 체중 저장 3회마다 전면 광고
 * - 배너 제거: 배너 광고만 제거 ($1.49 lifetime)
 * - AI PRO 구독: 무제한 AI + gpt-4o + 모든 광고 제거 ($1.99/mo, $19.9/yr)
 */
import { getMembershipStatus, type MembershipStatus } from "@/utils/purchases";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface ProContextValue {
  /** 배너 광고 제거 여부 (lifetime 구매 또는 AI PRO 구독 포함) */
  bannerRemoved: boolean;
  /** AI PRO 구독 여부 (무제한 AI + gpt-4o + 모든 광고 제거) */
  aiPro: boolean;
  /** 어떤 유료 구매든 있는지 (하위호환) */
  isPro: boolean;
  /** 로딩 중 여부 */
  loading: boolean;
  /** 구매/복원 후 수동으로 상태 갱신 */
  refresh: () => Promise<void>;
}

const ProContext = createContext<ProContextValue>({
  bannerRemoved: false,
  aiPro: false,
  isPro: false,
  loading: true,
  refresh: async () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<MembershipStatus>({
    bannerRemoved: false,
    aiPro: false,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await getMembershipStatus();
    setStatus(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ProContext.Provider
      value={{
        bannerRemoved: status.bannerRemoved,
        aiPro: status.aiPro,
        isPro: status.bannerRemoved || status.aiPro,
        loading,
        refresh,
      }}
    >
      {children}
    </ProContext.Provider>
  );
}

/**
 * 멤버십 상태 읽기
 * @example
 * const { aiPro, bannerRemoved, refresh } = usePro();
 */
export function usePro() {
  return useContext(ProContext);
}
