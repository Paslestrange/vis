import { ref, readonly, onMounted, onUnmounted } from 'vue';

const MOBILE_BREAKPOINT = 768;

function checkIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches || 
         window.matchMedia('(pointer: coarse)').matches;
}

const isMobile = ref(false);
let mediaQueryList: MediaQueryList | null = null;

function updateMobileState() {
  isMobile.value = checkIsMobile();
}

export function useMobile() {
  onMounted(() => {
    updateMobileState();
    mediaQueryList = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    mediaQueryList.addEventListener('change', updateMobileState);
    const pointerMedia = window.matchMedia('(pointer: coarse)');
    pointerMedia.addEventListener('change', updateMobileState);
  });

  onUnmounted(() => {
    mediaQueryList?.removeEventListener('change', updateMobileState);
  });

  return {
    isMobile: readonly(isMobile),
  };
}

export function getIsMobile(): boolean {
  return isMobile.value;
}

export function checkMobile(): boolean {
  return checkIsMobile();
}
