import { ref, type Ref } from 'vue';
import { clamp } from '../utils/floatingWindowGeometry';

export function useAppLayout(deps: {
  outputEl: Ref<HTMLElement | null>;
  inputEl: Ref<HTMLElement | null>;
  appBodyEl: Ref<HTMLElement | null>;
  sidePanelAreaEl: Ref<HTMLElement | null>;
  toolWindowCanvasEl: Ref<HTMLDivElement | null>;
  fw: { setExtent: (width: number, height: number) => void };
  shellManager: { scheduleShellFitAll: () => void };
}) {
  const { outputEl, inputEl, appBodyEl, sidePanelAreaEl, toolWindowCanvasEl, fw, shellManager } = deps;
  const inputResizeState = ref<{ startY: number; startHeight: number; minHeight: number; maxHeight: number } | null>(null);
  const inputHeight = ref<number | null>(null);
  const sidePanelResizeState = ref<{ startX: number; startWidth: number; minWidth: number; maxWidth: number } | null>(null);
  const sidePanelWidth = ref<number | null>(null);

  function syncFloatingExtent() {
    const canvas = toolWindowCanvasEl.value;
    const header = document.querySelector('.app-header') as HTMLElement | null;
    const input = inputEl.value;
    if (!canvas || !header || !input) return;
    const headerRect = header.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const topOffset = Math.max(0, headerRect.bottom);
    const availableHeight = Math.max(0, inputRect.top - headerRect.bottom);
    canvas.style.setProperty('--canvas-top', `${topOffset}px`);
    canvas.style.setProperty('--canvas-height', `${availableHeight}px`);
    const rect = canvas.getBoundingClientRect();
    fw.setExtent(rect.width, rect.height);
  }

  function startInputResize(event: PointerEvent) {
    if (event.button !== 0) return;
    const output = outputEl.value;
    const input = inputEl.value;
    if (!output || !input) return;
    const outputRect = output.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const totalHeight = Math.max(0, outputRect.height + inputRect.height);
    const minOutputHeight = 180;
    const maxInputHeight = Math.max(120, totalHeight - minOutputHeight);
    const minInputHeight = Math.min(200, maxInputHeight);
    inputResizeState.value = {
      startY: event.clientY,
      startHeight: inputRect.height,
      minHeight: minInputHeight,
      maxHeight: maxInputHeight,
    };
    inputHeight.value = inputRect.height;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function startSidePanelResize(event: PointerEvent) {
    if (event.button !== 0) return;
    const body = appBodyEl.value;
    const panel = sidePanelAreaEl.value;
    if (!body || !panel) return;
    const bodyRect = body.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const style = getComputedStyle(body);
    const gap = parseFloat(style.getPropertyValue('--todo-panel-gap')) || 10;
    const currentWidth = panelRect.width;
    const minW = 160;
    const maxW = Math.max(minW, bodyRect.width * 0.5 - gap);
    sidePanelResizeState.value = {
      startX: event.clientX,
      startWidth: currentWidth,
      minWidth: minW,
      maxWidth: maxW,
    };
    sidePanelWidth.value = currentWidth;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent) {
    if (sidePanelResizeState.value) {
      const { startX, startWidth, minWidth, maxWidth } = sidePanelResizeState.value;
      const dx = event.clientX - startX;
      sidePanelWidth.value = clamp(startWidth + dx, minWidth, maxWidth);
      syncFloatingExtent();
      shellManager.scheduleShellFitAll();
      return;
    }
    if (inputResizeState.value) {
      const { startY, startHeight, minHeight, maxHeight } = inputResizeState.value;
      const dy = event.clientY - startY;
      inputHeight.value = clamp(startHeight - dy, minHeight, maxHeight);
      syncFloatingExtent();
      shellManager.scheduleShellFitAll();
      return;
    }
  }

  function handlePointerUp() {
    if (inputResizeState.value) shellManager.scheduleShellFitAll();
    inputResizeState.value = null;
    if (sidePanelResizeState.value) shellManager.scheduleShellFitAll();
    sidePanelResizeState.value = null;
  }

  const api = {
    startInputResize,
    startSidePanelResize,
    handlePointerMove,
    handlePointerUp,
    inputHeight,
    sidePanelWidth,
    syncFloatingExtent,
    shellManager: null as any,
  };
  return api;
}
