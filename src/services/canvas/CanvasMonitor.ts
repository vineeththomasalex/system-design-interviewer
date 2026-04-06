/**
 * CanvasMonitor — tracks YAML, notes, and SVG changes.
 * Only sends updates when content has actually changed (hash-based diff).
 * Periodically force-sends all channels for context reinforcement.
 */

// Fast string hash (djb2)
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export interface CanvasState {
  yaml: string;
  notes: string;
  svgElement: SVGSVGElement | null;
}

export interface CanvasUpdate {
  yamlChanged: boolean;
  notesChanged: boolean;
  svgChanged: boolean;
  yaml?: string;
  notes?: string;
  jpegData?: ArrayBuffer;
}

export class CanvasMonitor {
  private lastYamlHash = 0;
  private lastNotesHash = 0;
  private lastSvgHash = 0;
  private lastForceSync = 0;
  private forceSyncIntervalMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Check for changes and return only what changed.
   * Returns null if nothing changed and force-sync isn't due.
   */
  checkForChanges(state: CanvasState, forceAll = false): CanvasUpdate | null {
    const yamlHash = hashString(state.yaml);
    const notesHash = hashString(state.notes);

    // SVG hash: serialize the SVG DOM (includes drawing layer strokes)
    let svgHash = 0;
    let svgString = '';
    if (state.svgElement) {
      svgString = new XMLSerializer().serializeToString(state.svgElement);
      svgHash = hashString(svgString);
    }

    const now = Date.now();
    const isForceSync = forceAll || (now - this.lastForceSync >= this.forceSyncIntervalMs);

    const yamlChanged = yamlHash !== this.lastYamlHash;
    const notesChanged = notesHash !== this.lastNotesHash;
    const svgChanged = svgHash !== this.lastSvgHash;

    if (!yamlChanged && !notesChanged && !svgChanged && !isForceSync) {
      return null; // Nothing changed, skip
    }

    const update: CanvasUpdate = {
      yamlChanged: yamlChanged || isForceSync,
      notesChanged: notesChanged || isForceSync,
      svgChanged: svgChanged || isForceSync,
    };

    if (update.yamlChanged) {
      update.yaml = state.yaml;
      this.lastYamlHash = yamlHash;
    }
    if (update.notesChanged) {
      update.notes = state.notes;
      this.lastNotesHash = notesHash;
    }

    if (isForceSync) {
      this.lastForceSync = now;
    }

    return update;
  }

  /**
   * Render the SVG element to a JPEG ArrayBuffer.
   * Clones the SVG (including drawing-layer strokes), renders to canvas, exports as JPEG.
   */
  async captureCanvasJpeg(svgElement: SVGSVGElement, width = 400): Promise<ArrayBuffer | null> {
    try {
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Get viewBox for aspect ratio
      const vb = svgElement.getAttribute('viewBox');
      if (!vb) return null;
      const [, , vbW, vbH] = vb.split(' ').map(Number);
      const height = Math.round(width * (vbH / vbW));

      // Set explicit dimensions on clone
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clone);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      return new Promise<ArrayBuffer | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }

          // Dark background
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) { resolve(null); return; }
            blob.arrayBuffer().then(resolve).catch(() => resolve(null));
          }, 'image/jpeg', 0.6);

          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    } catch {
      return null;
    }
  }

  reset(): void {
    this.lastYamlHash = 0;
    this.lastNotesHash = 0;
    this.lastSvgHash = 0;
    this.lastForceSync = 0;
  }
}
