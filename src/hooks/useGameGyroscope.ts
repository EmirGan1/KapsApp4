import { useState, useEffect, useRef, useCallback } from "react";
import { GyroStatus, GyroSample, GyroDelta, checkGyroSupport } from "../utils/gameGyroscope";

export function useGameGyroscope(
  enabled: boolean,
  onDelta?: (delta: GyroDelta) => void,
  onSample?: (sample: GyroSample) => void
) {
  const [status, setStatus] = useState<GyroStatus>(() => {
    if (!checkGyroSupport()) return "unsupported";
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === "function") {
      return "needs_permission";
    }
    return "idle";
  });

  const [permissionGranted, setPermissionGranted] = useState<boolean>(() => {
    return typeof (DeviceOrientationEvent as any)?.requestPermission !== "function";
  });

  const lastSampleRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);
  const onDeltaRef = useRef(onDelta);
  const onSampleRef = useRef(onSample);

  useEffect(() => {
    onDeltaRef.current = onDelta;
    onSampleRef.current = onSample;
  }, [onDelta, onSample]);

  const recenter = useCallback(() => {
    lastSampleRef.current = null;
  }, []);

  const request = useCallback(async (): Promise<boolean> => {
    if (!checkGyroSupport()) {
      setStatus("unsupported");
      return false;
    }

    if (typeof (DeviceOrientationEvent as any)?.requestPermission === "function") {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === "granted") {
          setPermissionGranted(true);
          setStatus("active");
          return true;
        } else {
          setPermissionGranted(false);
          setStatus("permission_denied");
          return false;
        }
      } catch (err) {
        setStatus("permission_denied");
        return false;
      }
    } else {
      setPermissionGranted(true);
      setStatus("active");
      return true;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !permissionGranted) {
      if (status === "active") setStatus("idle");
      return;
    }

    setStatus("active");

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const alpha = e.alpha ?? 0;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;

      const sample: GyroSample = { alpha, beta, gamma };
      onSampleRef.current?.(sample);

      if (lastSampleRef.current) {
        let deltaAlpha = alpha - lastSampleRef.current.alpha;
        if (deltaAlpha > 180) deltaAlpha -= 360;
        if (deltaAlpha < -180) deltaAlpha += 360;

        let deltaBeta = beta - lastSampleRef.current.beta;
        let deltaGamma = gamma - lastSampleRef.current.gamma;

        // Radians conversion
        const yaw = (deltaAlpha * Math.PI) / 180;
        const pitch = (deltaBeta * Math.PI) / 180;
        const roll = (deltaGamma * Math.PI) / 180;

        onDeltaRef.current?.({ yaw, pitch, roll });
      }

      lastSampleRef.current = { alpha, beta, gamma };
    };

    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [enabled, permissionGranted]);

  return {
    status,
    permissionGranted,
    request,
    recenter
  };
}
