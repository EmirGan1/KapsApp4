import { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl, getAuthHeaders } from "../../utils/api";
import { TRAVEL_API } from "../../shared/travel";
import type {
  TravelMember,
  TravelTrip,
  TripSnapshot,
} from "../../shared/travel";

export class TravelError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function travelRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(getApiUrl(TRAVEL_API + path), {
      method: body === undefined ? "GET" : "POST",
      headers: getAuthHeaders(
        body === undefined ? undefined : { "Content-Type": "application/json" },
      ),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new TravelError(
      "Bağlantı kurulamadı. Açık penceredeki taslağın korundu; bağlantı geri geldiğinde tekrar kaydet.",
      0,
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new TravelError(
      data?.error ??
        (response.status === 403
          ? "Bu alan için erişim yetkin bulunmuyor."
          : response.status === 401
            ? "Oturumun sona erdi. Yeniden giriş yap."
            : "Gezi bilgileri alınamadı. Tekrar dene."),
      response.status,
    );
  }
  return response.json();
}
export function useTravel(tripId: string | undefined) {
  const [access, setAccess] = useState<{
    userId: number;
    members: TravelMember[];
  } | null>(null);
  const [denied, setDenied] = useState("");
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [snapshot, setSnapshot] = useState<TripSnapshot | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const revision = useRef<number | undefined>(undefined);
  const sequence = useRef(0);
  const refresh = useCallback(
    async (force = false) => {
      const call = ++sequence.current;
      setSyncing(true);
      try {
        if (tripId) {
          const query =
            !force && revision.current !== undefined
              ? "?revision=" + revision.current
              : "";
          const result = await travelRequest<
            TripSnapshot | { unchanged: true }
          >("/trip/" + tripId + query);
          if (call !== sequence.current) return;
          if (!("unchanged" in result)) {
            revision.current = result.trip.revision;
            setSnapshot(result);
          }
        } else {
          const result = await travelRequest<{ trips: TravelTrip[] }>("/trips");
          if (call !== sequence.current) return;
          setTrips(result.trips);
        }
        setError("");
        setLastSync(new Date());
      } catch (e) {
        if (call !== sequence.current) return;
        const failure = e as TravelError;
        if (failure.status === 401 || failure.status === 403) {
          setAccess(null);
          setSnapshot(null);
          setTrips([]);
          setDenied(failure.message);
        } else
          setError(
            failure.message ||
              "Bağlantı yenilenemedi. Kaydedilmiş değişiklikler sunucuda korunuyor.",
          );
      } finally {
        if (call === sequence.current) setSyncing(false);
      }
    },
    [tripId],
  );
  useEffect(() => {
    let disposed = false;
    travelRequest<{ userId: number; members: TravelMember[] }>("/access")
      .then((data) => {
        if (!disposed) setAccess(data);
      })
      .catch((e) => {
        if (!disposed) setDenied(e.message);
      });
    return () => {
      disposed = true;
      sequence.current++;
    };
  }, []);
  useEffect(() => {
    revision.current = undefined;
    setSnapshot(null);
    setError("");
    if (!access) return;
    void refresh(true);
    const check = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void refresh();
    };
    const timer = setInterval(check, 4000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      sequence.current++;
    };
  }, [access, refresh]);
  const mutate = async (body: unknown) => {
    if (!tripId) throw new Error("Önce bir gezi aç.");
    try {
      await travelRequest("/trip/" + tripId + "/mutate", body);
      await refresh(true);
    } catch (e) {
      if (e instanceof TravelError && e.status === 409) await refresh(true);
      throw e;
    }
  };
  return {
    access,
    denied,
    trips,
    snapshot,
    error,
    syncing,
    lastSync,
    refresh,
    mutate,
  };
}
