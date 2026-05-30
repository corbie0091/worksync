/**
 * WorkSync — AppCore
 * Supabase 클라이언트 및 공통 유틸리티
 *
 * 환경변수 주입 방식:
 *   빌드 도구(Vite, webpack 등) 사용 시 → import.meta.env.VITE_SUPABASE_URL
 *   정적 배포(Netlify, Vercel 등) 사용 시 → window.__ENV__ 객체 주입 or 직접 입력
 *
 * ⚠️  프로덕션 배포 전 반드시 아래 상수를 실제 값으로 교체하세요.
 *     또는 index.html의 <head>에 아래 스크립트를 추가하세요:
 *     <script>
 *       window.__SUPABASE_URL__  = 'https://xxxx.supabase.co';
 *       window.__SUPABASE_KEY__  = 'your-anon-key';
 *     </script>
 */

(function (global) {
  'use strict';

  /* ── 환경 설정 ─────────────────────────────────────────────────────── */
  const SUPABASE_URL = (
    global.__SUPABASE_URL__ ||
    'https://rniwiiduygeugercoweq.supabase.co'           // ← 실제 URL로 교체
  );
  const SUPABASE_ANON_KEY = (
    global.__SUPABASE_KEY__ ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuaXdpaWR1eWdldWdlcmNvd2VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTM4NTMsImV4cCI6MjA5NTcyOTg1M30.8vQI1PkZKk_NRaOeWsoXshDx7s_qvJBsthMpjO07N5s'      // ← 실제 anon key로 교체
  );

  /* 설정 누락 경고 (개발 환경) */
  if (
    SUPABASE_URL === 'YOUR_SUPABASE_URL' ||
    SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY'
  ) {
    console.warn(
      '[WorkSync] ⚠️  Supabase 환경변수가 설정되지 않았습니다.\n' +
      'js/app.js 상단의 SUPABASE_URL과 SUPABASE_ANON_KEY를 실제 값으로 교체하거나,\n' +
      'window.__SUPABASE_URL__ 및 window.__SUPABASE_KEY__를 HTML에서 주입하세요.'
    );
  }

  /* ── Supabase 클라이언트 생성 ──────────────────────────────────────── */
  // @supabase/supabase-js v2 UMD 빌드에서 supabase.createClient 노출됨
  if (!global.supabase) {
    console.error('[WorkSync] supabase-js 라이브러리가 로드되지 않았습니다.');
    return;
  }

  const supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession:    true,           // 세션 localStorage 유지
      autoRefreshToken:  true,           // 토큰 자동 갱신
      detectSessionInUrl: true,          // 매직링크/OAuth 콜백 처리
      storageKey: 'worksync-auth',       // 앱별 고유 스토리지 키
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
    global: {
      headers: {
        'X-App-Name': 'WorkSync-PWA',
      },
    },
  });

  /* ── 세션 헬퍼 ─────────────────────────────────────────────────────── */

  /**
   * 현재 세션을 반환합니다.
   * 세션이 없으면 null을 반환합니다.
   * 네트워크 오류 등 예외가 발생하면 null을 반환합니다.
   * @returns {Promise<Session|null>}
   */
  async function getSession() {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error('[AppCore] getSession error:', error.message);
        return null;
      }
      return session;
    } catch (e) {
      console.error('[AppCore] getSession unexpected error:', e);
      return null;
    }
  }

  /**
   * 현재 유저를 반환합니다.
   * @returns {Promise<User|null>}
   */
  async function getUser() {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error) {
        console.error('[AppCore] getUser error:', error.message);
        return null;
      }
      return user;
    } catch (e) {
      console.error('[AppCore] getUser unexpected error:', e);
      return null;
    }
  }

  /* ── 날짜 유틸 ─────────────────────────────────────────────────────── */

  /**
   * 오늘 날짜를 'YYYY-MM-DD' 형식으로 반환합니다.
   * @returns {string}
   */
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * ISO 날짜 문자열을 로컬 시간 포맷으로 변환합니다.
   * @param {string|null} iso
   * @returns {string}
   */
  function fmtTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  /**
   * 두 ISO 시각 사이의 근무 시간을 계산합니다.
   * @param {string|null} start
   * @param {string|null} end
   * @returns {string}
   */
  function calcDuration(start, end) {
    if (!start || !end) return '—';
    const diff = Math.floor((new Date(end) - new Date(start)) / 1000);
    if (diff < 0) return '—';
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}시간 ${m}분`;
  }

  /* ── XSS 방지 유틸 ─────────────────────────────────────────────────── */

  /**
   * HTML 특수문자를 이스케이프합니다.
   * @param {*} str
   * @returns {string}
   */
  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ── 오프라인 감지 ─────────────────────────────────────────────────── */

  function isOnline() {
    return navigator.onLine !== false;
  }

  function onNetworkChange(onOnline, onOffline) {
    global.addEventListener('online',  onOnline);
    global.addEventListener('offline', onOffline);
    return () => {
      global.removeEventListener('online',  onOnline);
      global.removeEventListener('offline', onOffline);
    };
  }

  /* ── 이미지 리사이즈 (업로드 전처리) ──────────────────────────────── */

  /**
   * File 객체를 canvas를 통해 최대 width/height 이내로 리사이즈합니다.
   * iOS EXIF 회전 문제는 브라우저가 자동 처리한다고 가정합니다.
   * @param {File} file
   * @param {number} maxPx - 최대 픽셀 (기본 1200)
   * @param {number} quality - JPEG 품질 (기본 0.82)
   * @returns {Promise<Blob>}
   */
  async function resizeImage(file, maxPx = 800, quality = 0.5) {
    // HEIC/HEIF 변환
    let processFile = file;
    if (file.type === 'image/heic' || file.type === 'image/heif' ||
        file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      try {
        console.log('[resizeImage] HEIC 변환 중...');
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
        processFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
        console.log('[resizeImage] HEIC 변환 완료:', processFile.size);
      } catch (e) {
        console.warn('[resizeImage] HEIC 변환 실패:', e);
      }
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(processFile);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;

        if (width > maxPx || height > maxPx) {
          if (width >= height) {
            height = Math.round(height * maxPx / width);
            width = maxPx;
          } else {
            width = Math.round(width * maxPx / height);
            height = maxPx;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('[resizeImage] 변환 완료:', blob.size, 'bytes, type:', blob.type);
              if (typeof showToast === 'function') showToast(`압축완료: ${Math.round(blob.size/1024)}KB`, 'info', 5000);
              resolve(blob);
            } else {
              reject(new Error('이미지 변환에 실패했습니다.'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn('[resizeImage] canvas 로드 실패, 원본 사용');
        resolve(processFile);
      };
      img.src = url;
    });
  }

  /* ── PWA 업데이트 감지 ─────────────────────────────────────────────── */
  if ('serviceWorker' in navigator) {
    // 페이지 로드 완료 후 서비스워커 등록
    global.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('service-worker.js', {
          scope: './',
          updateViaCache: 'none',
        });

        // 백그라운드 업데이트 감지
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 업데이트 알림 (선택적 — 필요 시 UI 배너로 교체)
              console.info('[ServiceWorker] 새 버전이 설치되었습니다. 새로고침하면 적용됩니다.');
            }
          });
        });

        console.info('[ServiceWorker] 등록 완료:', reg.scope);
      } catch (e) {
        console.warn('[ServiceWorker] 등록 실패:', e.message);
      }
    });
  }

  /* ── AppCore 노출 ──────────────────────────────────────────────────── */
  global.AppCore = {
    supabase:      supabaseClient,
    getSession,
    getUser,
    todayStr,
    fmtTime,
    calcDuration,
    escHtml,
    isOnline,
    onNetworkChange,
    resizeImage,
  };

  console.info('[WorkSync] AppCore 초기화 완료');

})(window);
