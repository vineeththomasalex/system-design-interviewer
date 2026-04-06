import { useRef, useEffect, useCallback } from 'react';
import { CanvasMonitor } from '../services/canvas/CanvasMonitor';

interface UseCanvasMonitorOptions {
  yaml: string;
  notes: string;
  svgRef: React.RefObject<SVGSVGElement | null>;
  enabled: boolean;
  intervalMs: number;
  imageEnabled: boolean;
  onYamlUpdate: (yaml: string) => void;
  onNotesUpdate: (notes: string) => void;
  onImageUpdate: (jpegData: ArrayBuffer) => void;
}

export function useCanvasMonitor(options: UseCanvasMonitorOptions) {
  const monitor = useRef(new CanvasMonitor());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTime = useRef(Date.now());

  const checkAndSend = useCallback(async () => {
    if (!options.enabled) return;

    const state = {
      yaml: options.yaml,
      notes: options.notes,
      svgElement: options.svgRef.current,
    };

    const update = monitor.current.checkForChanges(state);
    if (!update) return;

    if (update.yamlChanged && update.yaml) {
      options.onYamlUpdate(update.yaml);
    }
    if (update.notesChanged && update.notes) {
      options.onNotesUpdate(update.notes);
    }
    if (update.svgChanged && options.imageEnabled && options.svgRef.current) {
      const jpeg = await monitor.current.captureCanvasJpeg(options.svgRef.current);
      if (jpeg) {
        options.onImageUpdate(jpeg);
      }
    }

    lastSyncTime.current = Date.now();
  }, [options]);

  useEffect(() => {
    if (!options.enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(checkAndSend, options.intervalMs * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [options.enabled, options.intervalMs, checkAndSend]);

  const getSecondsSinceLastSync = useCallback(() => {
    return Math.floor((Date.now() - lastSyncTime.current) / 1000);
  }, []);

  const reset = useCallback(() => {
    monitor.current.reset();
    lastSyncTime.current = Date.now();
  }, []);

  return { getSecondsSinceLastSync, reset, forceSync: () => checkAndSend() };
}
