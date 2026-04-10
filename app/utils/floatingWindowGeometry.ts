export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export type CanvasMetrics = {
  canvasRect: DOMRect;
  toolTop: number;
  toolAreaHeight: number;
  termWidth: number;
  termHeight: number;
};

export function getCanvasMetrics(canvas: HTMLElement | null): CanvasMetrics | null {
  if (!canvas) return null;
  const canvasRect = canvas.getBoundingClientRect();
  const styles = getComputedStyle(canvas);
  const toolTop = Number.parseFloat(styles.getPropertyValue('--tool-top-offset')) || 0;
  const toolAreaValue = styles.getPropertyValue('--tool-area-height').trim();
  const parsedToolArea = Number.parseFloat(toolAreaValue);
  const toolAreaHeight =
    toolAreaValue.endsWith('px') && Number.isFinite(parsedToolArea) && parsedToolArea > 0
      ? parsedToolArea
      : canvasRect.height - toolTop;
  const widthValue = styles.getPropertyValue('--term-width');
  const heightValue = styles.getPropertyValue('--term-height');
  const parsedWidth = Number.parseFloat(widthValue);
  const parsedHeight = Number.parseFloat(heightValue);
  const termWidth = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 640;
  const termHeight = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 350;
  return { canvasRect, toolTop, toolAreaHeight, termWidth, termHeight };
}

export function getRandomWindowPosition(
  metrics: CanvasMetrics,
  size?: { width?: number; height?: number },
): { x: number; y: number } {
  const { canvasRect, toolAreaHeight, termWidth, termHeight } = metrics;
  const targetWidth = size?.width ?? termWidth;
  const targetHeight = size?.height ?? termHeight;
  const maxLeft = Math.max(0, canvasRect.width - targetWidth);
  const maxTop = Math.max(0, toolAreaHeight - targetHeight);
  return {
    x: Math.round(Math.random() * maxLeft),
    y: Math.round(Math.random() * maxTop),
  };
}

export function getFileViewerPosition(
  metrics: CanvasMetrics,
  windowWidth: number,
  windowHeight: number,
  factorX = 0.16,
  factorY = 0.1,
): { x: number; y: number } {
  const x = clamp(
    metrics.canvasRect.width * factorX,
    16,
    Math.max(16, metrics.canvasRect.width - windowWidth - 16),
  );
  const y = clamp(
    metrics.toolAreaHeight * factorY,
    16,
    Math.max(16, metrics.toolAreaHeight - windowHeight - 16),
  );
  return { x, y };
}
