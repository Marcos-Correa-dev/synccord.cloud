// SyncCord Web Client - Full Frontend Logic, Multi-Screen Share & Status Duration System
(function () {
  const API_BASE = '/api/v10';
  let token = localStorage.getItem('synccord_token') || localStorage.getItem('discord_token');
  let refreshToken = localStorage.getItem('synccord_refresh_token') || localStorage.getItem('discord_refresh_token');
  let currentUser = JSON.parse(localStorage.getItem('synccord_user') || localStorage.getItem('discord_user') || 'null');
  let currentGuild = null;
  let currentChannel = null;
  let socket = null;

  // Appearance & Theme Settings State
  let savedAppearance = null;
  try {
    savedAppearance = JSON.parse(localStorage.getItem('synccord_appearance_settings') || localStorage.getItem('discord_appearance_settings') || 'null');
  } catch {
    savedAppearance = null;
  }
  let currentTheme = savedAppearance?.theme || localStorage.getItem('synccord_theme') || localStorage.getItem('discord_theme') || 'dark';
  let currentAccentColor = savedAppearance?.accent || '#5865f2';
  let pendingAppearanceTheme = currentTheme;
  let pendingAppearanceAccent = currentAccentColor;

  // Server Folders State (Persisted across reloads)
  let guildFolders = [];
  try {
    guildFolders = JSON.parse(localStorage.getItem('synccord_guild_folders') || localStorage.getItem('discord_guild_folders') || '[]');
  } catch {
    guildFolders = [];
  }
  let draggedGuildId = null;
  let wasDroppedOnValidTarget = false;
  let pendingGuildIconData = null;

  // i18n Internationalization State
  const SUPPORTED_LOCALES = {
    'pt-BR': { name: 'Português (Brasil)', flag: '🇧🇷', file: '/i18n/i18n-pt-br.json' },
    'en-US': { name: 'English (US)', flag: '🇺🇸', file: '/i18n/i18n-en-us.json' },
    'es-ES': { name: 'Español', flag: '🇪🇸', file: '/i18n/i18n-es-es.json' },
    'fr-FR': { name: 'Français', flag: '🇫🇷', file: '/i18n/i18n-fr-fr.json' },
  };
  let currentLocale = localStorage.getItem('synccord_locale') || localStorage.getItem('discord_locale') || 'pt-BR';
  let pendingLocale = currentLocale;
  let translations = {};

  async function loadTranslations(locale) {
    const loc = SUPPORTED_LOCALES[locale] ? locale : 'pt-BR';
    try {
      const res = await fetch(SUPPORTED_LOCALES[loc].file);
      if (res.ok) {
        translations = await res.json();
        currentLocale = loc;
        localStorage.setItem('synccord_locale', loc);
      }
    } catch (err) {
      console.warn('[i18n] Falha ao carregar arquivo de idioma:', err);
    }
    applyTranslationsToUI();
  }
  window.loadTranslations = loadTranslations;

  function t(keyPath, params = {}) {
    const parts = keyPath.split('.');
    let val = translations;
    for (const p of parts) {
      if (val && typeof val === 'object' && p in val) {
        val = val[p];
      } else {
        return keyPath;
      }
    }
    if (typeof val === 'string') {
      let str = val;
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`{${k}}`, 'g'), v);
      }
      return str;
    }
    return val || keyPath;
  }
  window.t = t;

  function applyTranslationsToUI() {
    // 1. User Settings Sidebar Section Headers
    const headers = document.querySelectorAll('.settings-nav-header');
    if (headers.length >= 4) {
      if (headers[0]) headers[0].textContent = t('settings.userSettings');
      if (headers[1]) headers[1].textContent = t('settings.billingSettings');
      if (headers[2]) headers[2].textContent = t('settings.appSettings');
      if (headers[3]) headers[3].textContent = t('settings.activitySettings');
    }

    // 2. User Settings Navigation Items
    const navItems = {
      'my-account': t('settings.myAccount'),
      'profiles': t('settings.profiles'),
      'privacy-safety': t('settings.privacySafety'),
      'authorized-apps': t('settings.authorizedApps'),
      'devices': t('settings.devices'),
      'connections': t('settings.connections'),
      'nitro': t('settings.nitro'),
      'server-boost': t('settings.serverBoost'),
      'subscriptions': t('settings.subscriptions'),
      'gift-inventory': t('settings.giftInventory'),
      'billing': t('settings.billing'),
      'appearance': t('settings.appearance'),
      'accessibility': t('settings.accessibility'),
      'voice-video': t('settings.voiceVideo'),
      'text-images': t('settings.textImages'),
      'notifications': t('settings.notifications'),
      'keybinds': t('settings.keybinds'),
      'language': t('settings.language'),
      'windows-settings': t('settings.windowsSettings'),
      'streamer-mode': t('settings.streamerMode'),
      'advanced': t('settings.advanced'),
      'activity-privacy': t('settings.activityPrivacy'),
      'registered-games': t('settings.registeredGames'),
    };
    Object.entries(navItems).forEach(([tab, label]) => {
      const el = document.querySelector(`.settings-nav-item[data-tab="${tab}"]`);
      if (el) {
        const subSpan = el.querySelector('span > span:first-child');
        if (subSpan) {
          subSpan.textContent = label;
        } else {
          el.textContent = label;
        }
      }
    });

    const logoutEl = document.querySelector('.settings-nav-item.logout-nav-item span span');
    if (logoutEl) logoutEl.textContent = t('settings.logout');

    // 3. Mini Profile Popover Quick Action Items
    const popoverActions = document.querySelectorAll('.popover-action-item');
    if (popoverActions.length >= 3) {
      const editProfileSpan = popoverActions[0].querySelector('span');
      if (editProfileSpan) editProfileSpan.textContent = t('profile.editProfile');
      const myAccountSpan = popoverActions[1].querySelector('span');
      if (myAccountSpan) myAccountSpan.textContent = t('profile.myAccount');
      const logoutSpan = popoverActions[2].querySelector('span');
      if (logoutSpan) logoutSpan.textContent = t('common.logout');
    }

    // 4. Chat input placeholder
    if (chatInputEl) {
      chatInputEl.placeholder = t('chat.placeholder', {
        channel: currentChannel ? currentChannel.name : 'geral',
      });
    }

    // 5. User Popover labels
    const popoverStatusLabel = document.querySelector('.popover-section-label');
    if (popoverStatusLabel) popoverStatusLabel.textContent = t('status.title');

    const popoverCustomStatus = document.getElementById('popover-status-text');
    if (popoverCustomStatus && (!currentUser || !currentUser.bio)) {
      popoverCustomStatus.textContent = t('profile.customStatus');
    }

    // 6. Update online status option titles & durations
    const onlineTitle = document.querySelector('.status-menu-item:first-child .status-title');
    if (onlineTitle) onlineTitle.textContent = t('status.online');
    const onlineDesc = document.querySelector('.status-menu-item:first-child .status-desc');
    if (onlineDesc) onlineDesc.textContent = t('status.onlineDesc');

    const dndTitle = document.querySelector('#status-item-dnd .status-title');
    if (dndTitle) dndTitle.textContent = t('status.dnd');
    const dndDesc = document.querySelector('#status-item-dnd .status-desc');
    if (dndDesc) dndDesc.textContent = t('status.dndDesc');

    const idleTitle = document.getElementById('status-item-idle')?.querySelector('.status-title');
    if (idleTitle) idleTitle.textContent = t('status.idle');
    const idleDesc = document.getElementById('status-item-idle')?.querySelector('.status-desc');
    if (idleDesc) idleDesc.textContent = t('status.idleDesc');

    const invTitle = document.getElementById('status-item-invisible')?.querySelector('.status-title');
    if (invTitle) invTitle.textContent = t('status.invisible');
    const invDesc = document.getElementById('status-item-invisible')?.querySelector('.status-desc');
    if (invDesc) invDesc.textContent = t('status.invisibleDesc');

    document.querySelectorAll('.status-duration-submenu').forEach((submenu) => {
      const header = submenu.querySelector('.submenu-header');
      if (header) header.textContent = t('status.durationHeader');
      const options = submenu.querySelectorAll('.duration-option');
      if (options.length >= 6) {
        options[0].textContent = t('status.duration15m');
        options[1].textContent = t('status.duration30m');
        options[2].textContent = t('status.duration1h');
        options[3].textContent = t('status.duration8h');
        options[4].textContent = t('status.duration24h');
        options[5].textContent = t('status.durationForever');
      }
    });

    // 7. Update Edit Username Modal texts
    const editModalTitle = document.getElementById('modal-edit-username-title');
    if (editModalTitle) editModalTitle.textContent = t('editUsername.title');
    const editModalSubtitle = document.getElementById('modal-edit-username-subtitle');
    if (editModalSubtitle) editModalSubtitle.textContent = t('editUsername.subtitle');
    const editModalLabel = document.getElementById('modal-edit-username-label');
    if (editModalLabel) editModalLabel.textContent = t('editUsername.label');
    const editModalInput = document.getElementById('modal-new-username-input');
    if (editModalInput) editModalInput.placeholder = t('editUsername.placeholder');
    const editModalCancelBtn = document.getElementById('modal-edit-username-cancel-btn');
    if (editModalCancelBtn) editModalCancelBtn.textContent = t('editUsername.cancel');
    const editModalDoneBtn = document.getElementById('modal-edit-username-confirm-btn') || document.getElementById('modal-edit-username-submit-btn');
    if (editModalDoneBtn) editModalDoneBtn.textContent = t('editUsername.done');

    // 8. If Settings modal is currently open, refresh the active tab immediately
    const settingsModal = document.getElementById('user-settings-modal');
    if (settingsModal && settingsModal.style.display !== 'none') {
      const activeTabEl = document.querySelector('.settings-nav-item.active');
      const activeTab = activeTabEl ? activeTabEl.getAttribute('data-tab') : 'my-account';
      const pane = document.getElementById('settings-tab-pane');
      if (pane && activeTab) {
        pane.innerHTML = renderSettingsTabContent(activeTab);
      }
    }
  }

  // Silent Refresh Token & 10-Minute Renewal State
  let isRefreshing = false;
  let refreshSubscribers = [];

  function subscribeTokenRefresh(cb) {
    refreshSubscribers.push(cb);
  }

  function onRefreshed(newToken) {
    refreshSubscribers.forEach((cb) => cb(newToken));
    refreshSubscribers = [];
  }

  async function attemptTokenRefresh() {
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        throw new Error('Refresh failed');
      }
      const data = await res.json();
      token = data.token;
      if (data.refreshToken) {
        refreshToken = data.refreshToken;
        localStorage.setItem('synccord_refresh_token', refreshToken);
      }
      if (data.user) {
        currentUser = data.user;
        localStorage.setItem('synccord_user', JSON.stringify(currentUser));
        updateUserPanel();
      }
      localStorage.setItem('synccord_token', token);
      console.log('[Auth] Token JWT renovado com sucesso via Refresh Token!');
      return token;
    } catch (err) {
      console.warn('[Auth] Falha ao renovar token silenciosamente:', err);
      return null;
    }
  }

  // Timer de Renovação Automática a cada 10 minutos (Regra de negócio solicitada)
  setInterval(async () => {
    if (token && refreshToken) {
      console.log('[Auth] Renovação periódica de 10 minutos iniciada...');
      await attemptTokenRefresh();
    }
  }, 10 * 60 * 1000);

  // User Presence & Status Duration State
  let savedStatus = null;
  try {
    savedStatus = JSON.parse(localStorage.getItem('synccord_user_status') || localStorage.getItem('discord_user_status') || 'null');
  } catch {
    savedStatus = null;
  }
  let userStatus = savedStatus?.status || 'online';
  let userStatusDuration = savedStatus?.durationMinutes || null;
  let statusTimeout = null;
  const memberPresences = {};
  let guildMembers = [];

  // Voice & Video / Screen Share State
  let connectedVoiceChannel = null;
  let voiceStates = [];
  let localAudioStream = null;
  let audioContext = null;
  let analyserNode = null;
  let isMuted = false;
  let isDeafened = false;
  let screenStream = null;
  let cameraStream = null;
  let selectedAudioInputId = 'default';
  let selectedAudioOutputId = 'default';
  let isChatOpenInVoice = false;
  let selectedChannelType = 0;

  // Multi-stream Map: streamKey (`${userId}:screen` or `${userId}:cam`) -> { stream, username, isLocal, type, userId }
  const activeStreams = new Map();
  // Max simultaneous sharers (screen + cam combined across all users)
  const MAX_CONCURRENT_STREAMS = 4;
  // Mixed audio context for screen audio + mic mixing
  let mixedAudioContext = null;
  let mixedAudioStream = null;
  // WebRTC Peer Connections: userId -> RTCPeerConnection
  const peerConnections = new Map();
  // Remote audio elements for direct audio output: userId -> HTMLAudioElement
  const remoteAudioElements = new Map();
  // Queued ICE candidates awaiting remote description: userId -> RTCIceCandidate[]
  const iceCandidateQueues = new Map();
  // Renegotiation / offer locking per peer to prevent collisions
  const isMakingOffer = new Map();

  // Redundant public STUN servers for WebRTC NAT Traversal
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
    iceCandidatePoolSize: 10,
  };

  // SyncCord Official Vector SVGs
  const SVGS = {
    HASH: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.5C2.22386 17 2 16.7761 2 16.5V14.5C2 14.2239 2.22386 14 2.5 14H6.52932L7.2352 10H3.5C3.22386 10 3 9.77614 3 9.5V7.5C3 7.22386 3 7 3.5 7H7.76451L8.37025 3.58735C8.42461 3.28108 8.66019 3 8.97129 3H10.9755C11.2866 3 11.5222 3.28108 11.4678 3.58735L10.8621 7H14.8621L15.4678 3.58735C15.5222 3.28108 15.7578 3 16.0689 3H18.0731C18.3842 3 18.6198 3.28108 18.5654 3.58735L17.9597 7H21.5C21.7761 7 22 7.22386 22 7.5V9.5C22 9.77614 21.7761 10 21.5 10H17.4304L16.7245 14H20.5C20.7761 14 21 14.2239 21 14.5V16.5C21 16.7761 20.7761 17 20.5 17H16.1952L15.5895 20.4126C15.5351 20.7189 15.2995 21 14.9884 21H12.9842C12.6731 21 12.4375 20.7189 12.4919 20.4126L13.0976 17H9.09763L8.49189 20.4126C8.43753 20.7189 8.20195 21 7.89085 21H5.88657ZM9.45057 14H13.4506L14.1565 10H10.1565L9.45057 14Z"/></svg>',
    VOICE: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 7.58904H3C2.45 7.58904 2 8.03904 2 8.58904V15.411C2 15.961 2.45 16.411 3 16.411H6L10.293 20.704C10.579 20.99 11.009 21.075 11.383 20.921C11.757 20.767 12 20.404 12 20V4.00004C12 3.59604 11.757 3.23304 11.383 3.07904ZM14 5V7.07C16.89 7.97 19 10.74 19 14C19 17.26 16.89 20.03 14 20.93V23C18.01 22.05 21 18.38 21 14C21 9.62 18.01 5.95 14 5ZM14 9.53V14C14 15.54 14.82 16.88 16.03 17.58C16.63 16.61 17 15.35 17 14C17 12.65 16.63 11.39 16.03 10.42C14.82 11.12 14 12.46 14 14V9.53Z"/></svg>',
    INVITE: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    CHAT: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.486 2 2 6.486 2 12c0 1.837.5 3.557 1.369 5.032L2.094 21.26a1 1 0 0 0 1.218 1.218l4.228-1.275A9.948 9.948 0 0 0 12 22c5.514 0 10-4.486 10-10S17.514 2 12 2zm-5 9a1 1 0 1 1 0-2h10a1 1 0 1 1 0 2H7zm0 4a1 1 0 1 1 0-2h7a1 1 0 1 1 0 2H7z"/></svg>',
    MIC_ON: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>',
    MIC_OFF: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="color: var(--red);"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.24-5.3-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c1.33-.19 2.53-.78 3.53-1.62l3.2 3.2 1.27-1.27L4.27 3z"/></svg>',
    DEAF_ON: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h3a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H5v-1a7 7 0 1 1 14 0v1h-3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z"/></svg>',
    DEAF_OFF: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="color: var(--red);"><path d="M12 4a8 8 0 0 0-8 8v7a2 2 0 0 0 2 2h2a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H6v-2a6 6 0 0 1 11.66-2l1.6-1.6A7.96 7.96 0 0 0 12 4zm6 9a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2a2 2 0 0 0 2-2v-7a8 8 0 0 0-.58-3l-1.53 1.53c.07.47.11.96.11 1.47v2h-2zM3.27 2L2 3.27 20.73 22 22 20.73 3.27 2z"/></svg>',
    HOME: '<svg width="26" height="26" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="scdHomeG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6e7bff"/><stop offset="100%" stop-color="#5865F2"/></linearGradient></defs><rect width="100" height="100" rx="26" fill="url(#scdHomeG)"/><text x="50" y="65" font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial Black,sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle" letter-spacing="-1">SCD</text></svg>',
  };

  // DOM Elements
  const guildListEl = document.getElementById('guild-list');
  const serverNameEl = document.getElementById('server-name');
  const channelListEl = document.getElementById('channel-list');
  const chatHeaderTitleEl = document.getElementById('chat-header-title');
  const chatHeaderIconEl = document.getElementById('chat-header-icon');
  const chatMessagesEl = document.getElementById('chat-messages');
  const chatInputWrapperEl = document.querySelector('.chat-input-wrapper');
  const chatInputEl = document.getElementById('chat-input');
  const sendBtnEl = document.getElementById('send-btn');
  const currentUsernameEl = document.getElementById('current-username');
  const currentDiscriminatorEl = document.getElementById('current-discriminator');
  const currentAvatarEl = document.getElementById('current-avatar');
  const currentStatusDotEl = document.getElementById('current-status-dot');
  const authModalEl = document.getElementById('auth-modal');
  const createGuildModalEl = document.getElementById('create-guild-modal');
  const voiceConnectedBarEl = document.getElementById('voice-connected-bar');
  const connectedChannelNameEl = document.getElementById('connected-channel-name');
  const connectedGuildNameEl = document.getElementById('connected-guild-name');
  const voiceDisconnectBtnEl = document.getElementById('voice-disconnect-btn');
  const voiceChatBannerEl = document.getElementById('voice-chat-banner');
  const voiceChatBannerNameEl = document.getElementById('voice-chat-banner-name');
  const voiceJoinQuickBtnEl = document.getElementById('voice-join-quick-btn');
  const btnToggleMicEl = document.getElementById('btn-toggle-mic');
  const btnToggleDeafEl = document.getElementById('btn-toggle-deaf');
  const btnToggleScreenshareEl = document.getElementById('btn-toggle-screenshare');
  const btnToggleCameraEl = document.getElementById('btn-toggle-camera');

  // Stage & Video Grid Elements
  const voiceCallStageEl = document.getElementById('voice-call-stage');
  const voiceParticipantsGridEl = document.getElementById('voice-participants-grid');
  const voiceVideoGridEl = document.getElementById('voice-video-grid');

  // Dock Buttons
  const dockBtnCameraEl = document.getElementById('dock-btn-camera');
  const dockBtnScreenshareEl = document.getElementById('dock-btn-screenshare');
  const dockBtnMicEl = document.getElementById('dock-btn-mic');
  const dockBtnDeafEl = document.getElementById('dock-btn-deaf');
  const dockBtnSoundboardEl = document.getElementById('dock-btn-soundboard');
  const dockBtnAudioSettingsEl = document.getElementById('dock-btn-audio-settings');
  const dockBtnToggleChatEl = document.getElementById('dock-btn-toggle-chat');
  const dockBtnDisconnectEl = document.getElementById('dock-btn-disconnect');
  const soundboardPopoverEl = document.getElementById('soundboard-popover');
  const closeSoundboardBtnEl = document.getElementById('close-soundboard-btn');

  // Audio Device Settings Elements
  const audioInputSelectEl = document.getElementById('audio-input-select');
  const audioOutputSelectEl = document.getElementById('audio-output-select');
  const btnTestSpeakerEl = document.getElementById('btn-test-speaker');
  const speakerTestStatusEl = document.getElementById('speaker-test-status');
  const micMeterFillEl = document.getElementById('mic-meter-fill');

  // Initialize
  function init() {
    setupEventListeners();
    updateAudioButtons();
    refreshAudioDevices();
    applyAppearanceSettings(currentTheme, currentAccentColor);

    // Check expiration of saved status
    if (savedStatus?.expiresAt && Date.now() > savedStatus.expiresAt) {
      userStatus = 'online';
      userStatusDuration = null;
      localStorage.removeItem('discord_user_status');
    } else if (savedStatus?.expiresAt) {
      const remainingMs = savedStatus.expiresAt - Date.now();
      statusTimeout = setTimeout(() => {
        setUserStatus('online');
      }, remainingMs);
    }

    if (currentStatusDotEl) {
      currentStatusDotEl.className = `status-dot ${userStatus}`;
    }

    // Load active locale translations on app startup
    loadTranslations(currentLocale);

    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset') || urlParams.get('token');

    if (resetToken) {
      openResetPasswordModal(resetToken);
    } else if (!token && !refreshToken) {
      showAuthModal(true);
    } else {
      updateUserPanel();
      initWebSocket();
      loadGuilds()
        .then(() => {
          checkUrlInvites();
        })
        .catch(async () => {
          // Em caso de F5 com access token expirado, tenta refresh silencioso
          if (refreshToken) {
            const newToken = await attemptTokenRefresh();
            if (newToken) {
              loadGuilds().then(() => checkUrlInvites());
            } else {
              showAuthModal(true);
            }
          } else {
            showAuthModal(true);
          }
        });

      // Synchronize latest user profile (username, avatar, etc.) directly from PostgreSQL backend
      if (token) {
        api('/auth/me')
          .then((freshUser) => {
            if (freshUser && freshUser.id) {
              currentUser = { ...(currentUser || {}), ...freshUser };
              localStorage.setItem('discord_user', JSON.stringify(currentUser));
              updateUserPanel();
              syncUserProfileAcrossApp();
            }
          })
          .catch((err) => {
            console.warn('[Auth] Não foi possível sincronizar perfil do servidor no início:', err);
          });
      }
    }
  }

  // Check URL parameters for invites & password reset
  let pendingInviteChannelId = null;
  function checkUrlInvites() {
    const params = new URLSearchParams(window.location.search);
    const inviteGuild = params.get('guild') || params.get('joinGuild') || params.get('invite');
    pendingInviteChannelId = params.get('channel');
    if (inviteGuild && token && currentUser && /^\d+$/.test(inviteGuild)) {
      api(`/guilds/${inviteGuild}/members`, { method: 'POST' })
        .then(() => loadGuilds())
        .catch(() => {});
    }
    const resetToken = params.get('reset') || params.get('token');
    if (resetToken) {
      openResetPasswordModal(resetToken);
    }
  }

  // Initialize WebSocket Gateway Connection
  function initWebSocket() {
    if (typeof io === 'undefined') return;

    socket = io('/', { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      console.log('Connected to SyncCord WebSocket Gateway! ID:', socket.id);
      socket.emit('voice:get_states');
      socket.emit('presence:get_all');

      if (currentUser) {
        socket.emit('presence:update', {
          userId: currentUser.id,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
          avatar: currentUser.avatar,
          status: userStatus,
          duration: userStatusDuration,
        });
      }
    });

    socket.on('packet', (packet) => {
      if (!packet) return;

      if (packet.op === 10) {
        const interval = packet.d.heartbeat_interval || 41250;
        setInterval(() => {
          socket.emit('heartbeat', { op: 1 });
        }, interval);
      } else if (packet.op === 0 && packet.t === 'MESSAGE_CREATE') {
        const msg = packet.d;
        if (currentChannel && msg.channel_id === currentChannel.id) {
          appendMessage({
            id: msg.id,
            authorId: msg.author_id,
            authorName: msg.author_name,
            authorAvatar: msg.author_avatar,
            content: msg.content,
            createdAt: msg.timestamp,
          });
        }
        if (activeVoiceChatChannel && msg.channel_id === activeVoiceChatChannel.id) {
          appendVoiceChatMessage({
            id: msg.id,
            authorId: msg.author_id,
            author_id: msg.author_id,
            authorName: msg.author_name,
            author_name: msg.author_name,
            authorAvatar: msg.author_avatar,
            author_avatar: msg.author_avatar,
            content: msg.content,
            createdAt: msg.timestamp,
            timestamp: msg.timestamp,
          });
        }
      } else if (packet.op === 0 && packet.t === 'VOICE_STATES_SYNC') {
        voiceStates = packet.d || [];
        renderVoiceUsers();
        renderVoiceCallStage();
        if (connectedVoiceChannel) {
          syncVoiceConnections();
        }
      } else if (packet.op === 0 && packet.t === 'VOICE_STATE_UPDATE') {
        handleVoiceStateUpdate(packet.d);
      } else if (packet.op === 0 && packet.t === 'VOICE_SPEAKING') {
        const { userId, speaking } = packet.d;
        updateUserSpeakingUI(userId, speaking);
      } else if (packet.op === 0 && packet.t === 'VOICE_STREAM_UPDATE') {
        handleVoiceStreamUpdate(packet.d);
      } else if (packet.op === 0 && packet.t === 'VOICE_SIGNAL') {
        handleRemoteVoiceSignal(packet.d);
      } else if (packet.op === 0 && packet.t === 'VOICE_SOUND') {
        handleRemoteVoiceSound(packet.d);
      } else if (packet.op === 0 && packet.t === 'VOICE_REACTION') {
        triggerFloatingReaction(packet.d.userId, packet.d.emoji);
      } else if (packet.op === 0 && packet.t === 'PRESENCE_UPDATE') {
        memberPresences[packet.d.userId] = packet.d;
        renderMembersList();
      } else if (packet.op === 0 && packet.t === 'PRESENCES_SYNC') {
        (packet.d || []).forEach((p) => {
          memberPresences[p.userId] = p;
        });
        renderMembersList();
      } else if (packet.op === 0 && packet.t === 'USER_UPDATE') {
        const data = packet.d;
        if (currentUser && data.userId === currentUser.id) {
          currentUser.username = data.username;
          if (data.avatar !== undefined) currentUser.avatar = data.avatar;
          localStorage.setItem('discord_user', JSON.stringify(currentUser));
        }
        const m = guildMembers.find((mem) => mem.id === data.userId);
        if (m) {
          m.username = data.username;
          if (data.avatar !== undefined) m.avatar = data.avatar;
        }
        voiceStates.forEach((s) => {
          if (s.user && s.user.id === data.userId) {
            s.user.username = data.username;
            if (data.avatar !== undefined) s.user.avatar = data.avatar;
          }
        });
        if (activeStreams.has(data.userId)) {
          activeStreams.get(data.userId).username = data.username;
        }
        updateUserPanel();
        renderVoiceUsers();
        renderVoiceCallStage();
        renderVideoGrid();
        renderMembersList();
      }
    });
  }

  function handleVoiceStateUpdate(state) {
    if (!state.channelId) {
      voiceStates = voiceStates.filter((s) => s.user.id !== state.userId);
      activeStreams.delete(state.userId);
      closePeerConnection(state.userId);
      renderVideoGrid();
      if (currentUser && state.userId === currentUser.id && connectedVoiceChannel) {
        handleVoiceDisconnectedUI();
      }
    } else {
      const idx = voiceStates.findIndex((s) => s.user.id === state.user.id);
      if (idx >= 0) {
        voiceStates[idx] = { ...voiceStates[idx], ...state };
      } else {
        voiceStates.push(state);
      }

      // When another user is in or joins our voice channel, establish WebRTC peer connection
      if (
        connectedVoiceChannel &&
        state.channelId === connectedVoiceChannel.id &&
        state.user &&
        currentUser &&
        state.user.id !== currentUser.id
      ) {
        const isInitiator = currentUser.id > state.user.id;
        connectToVoicePeer(state.user.id, isInitiator);
      }
    }
    renderVoiceUsers();
    renderVoiceCallStage();
  }

  // Handle Multi-stream updates for simultaneous screensharing (keyed by `${userId}:screen`)
  function handleVoiceStreamUpdate(data) {
    const state = voiceStates.find((s) => s.user.id === data.userId);
    if (state) {
      state.streaming = data.streaming;
      state.video = data.video;
    }

    const streamKey = `${data.userId}:screen`;
    if (data.streaming) {
      const existing = activeStreams.get(streamKey);
      const isMe = currentUser && data.userId === currentUser.id;
      activeStreams.set(streamKey, {
        stream: isMe ? screenStream : (existing?.stream || null),
        username: data.username || state?.user?.username || 'Membro',
        isLocal: isMe,
        type: 'screen',
        userId: data.userId,
      });
    } else {
      activeStreams.delete(streamKey);
    }

    renderVoiceUsers();
    renderVoiceCallStage();
    renderVideoGrid();
  }

  function handleRemoteVoiceSound(data) {
    if (currentUser && data.userId === currentUser.id) return;
    synthesizeSound(data.sound);
    triggerFloatingReaction(data.userId, data.emoji);
  }

  // Status & Presence Management (Disponível, Não Perturbar, Ausente, Invisível)
  function setUserStatus(status, durationMinutes) {
    userStatus = status;
    userStatusDuration = durationMinutes;

    document.querySelectorAll('.status-menu-item.has-submenu').forEach((el) => {
      el.classList.remove('active-submenu');
    });

    if (statusTimeout) {
      clearTimeout(statusTimeout);
      statusTimeout = null;
    }

    let expiresAt = null;
    if (typeof durationMinutes === 'number' && durationMinutes > 0) {
      expiresAt = Date.now() + durationMinutes * 60 * 1000;
      statusTimeout = setTimeout(() => {
        setUserStatus('online');
      }, durationMinutes * 60 * 1000);
    }

    localStorage.setItem(
      'discord_user_status',
      JSON.stringify({ status, durationMinutes, expiresAt }),
    );

    if (currentStatusDotEl) {
      currentStatusDotEl.className = `status-dot ${status}`;
    }

    if (socket && currentUser) {
      socket.emit('presence:update', {
        userId: currentUser.id,
        username: currentUser.username,
        discriminator: currentUser.discriminator,
        status,
        duration: durationMinutes,
        expiresAt,
      });
    }

    toggleStatusMenu(false);
    renderMembersList();
  }
  window.setUserStatus = setUserStatus;

  function toggleStatusSubmenu(event, statusKey) {
    if (event) {
      if (event.target && event.target.closest('.status-duration-submenu')) {
        return;
      }
      event.stopPropagation();
    }
    const itemEl = document.getElementById(`status-item-${statusKey}`);
    if (!itemEl) return;

    const isAlreadyActive = itemEl.classList.contains('active-submenu');
    document.querySelectorAll('.status-menu-item.has-submenu').forEach((el) => {
      el.classList.remove('active-submenu');
    });

    if (!isAlreadyActive) {
      itemEl.classList.add('active-submenu');
    }
  }
  window.toggleStatusSubmenu = toggleStatusSubmenu;

  function toggleStatusMenu(forceState) {
    const popover = document.getElementById('status-menu-popover');
    if (!popover) return;
    const shouldShow = typeof forceState === 'boolean' ? forceState : popover.style.display === 'none';
    popover.style.display = shouldShow ? 'block' : 'none';
    if (!shouldShow) {
      document.querySelectorAll('.status-menu-item.has-submenu').forEach((el) => {
        el.classList.remove('active-submenu');
      });
    }
  }
  window.toggleStatusMenu = toggleStatusMenu;

  // Render dynamic Members List categorized by status
  function renderMembersList() {
    const container = document.getElementById('members-list-container');
    if (!container) return;

    container.innerHTML = '';

    // 1. System Admin (Requested by user)
    const adminCategory = document.createElement('div');
    adminCategory.className = 'member-category';
    adminCategory.textContent = 'ADMINISTRADORES — 1';
    container.appendChild(adminCategory);

    const adminItem = document.createElement('div');
    adminItem.className = 'member-item';
    adminItem.innerHTML = `
      <div class="avatar-wrapper">
        <div class="avatar" style="background-color: var(--accent);">ADM</div>
        <div class="status-dot online"></div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="member-name">System Admin</span>
        <span class="bot-badge" style="background: #5865f2; color: white; font-size: 10px; font-weight: 700; padding: 1px 4px; border-radius: 3px;">ADMIN</span>
      </div>
    `;
    container.appendChild(adminItem);

    // 2. Members categorized by presence
    const membersMap = new Map();
    guildMembers.forEach((m) => membersMap.set(m.id, { ...m }));

    if (currentUser) {
      membersMap.set(currentUser.id, {
        ...(membersMap.get(currentUser.id) || {}),
        id: currentUser.id,
        username: currentUser.username,
        discriminator: currentUser.discriminator,
        avatar: currentUser.avatar,
      });
    }

    const grouped = {
      online: [],
      dnd: [],
      idle: [],
      invisible: [],
    };

    membersMap.forEach((m) => {
      let status = 'invisible';
      let durationText = '';

      if (currentUser && m.id === currentUser.id) {
        status = userStatus || 'online';
        if (userStatusDuration && userStatus !== 'online') {
          durationText = typeof userStatusDuration === 'number' ? `${userStatusDuration}m` : '';
        }
      } else if (memberPresences[m.id]) {
        status = memberPresences[m.id].status || 'online';
        if (memberPresences[m.id].duration && status !== 'online') {
          durationText = typeof memberPresences[m.id].duration === 'number' ? `${memberPresences[m.id].duration}m` : '';
        }
      } else if (voiceStates.some((s) => s.user.id === m.id)) {
        status = 'online';
      }

      const memberObj = { ...m, status, durationText };
      if (grouped[status]) {
        grouped[status].push(memberObj);
      } else {
        grouped.invisible.push(memberObj);
      }
    });

    const categoryConfigs = [
      { key: 'online', label: 'DISPONÍVEL', dotClass: 'online', title: 'Disponível' },
      { key: 'dnd', label: 'NÃO PERTURBAR', dotClass: 'dnd', title: 'Não Perturbar' },
      { key: 'idle', label: 'AUSENTE', dotClass: 'idle', title: 'Ausente' },
      { key: 'invisible', label: 'OFFLINE / INVISÍVEL', dotClass: 'invisible', title: 'Invisível / Offline' },
    ];

    categoryConfigs.forEach((cfg) => {
      const list = grouped[cfg.key];
      if (list && list.length > 0) {
        const catHeader = document.createElement('div');
        catHeader.className = 'member-category';
        catHeader.textContent = `${cfg.label} — ${list.length}`;
        container.appendChild(catHeader);

        list.forEach((m) => {
          const initials = (m.username || '??').substring(0, 2).toUpperCase();
          const item = document.createElement('div');
          item.className = 'member-item';
          item.style.cursor = 'pointer';
          item.title = 'Clique para gerenciar cargos deste membro';
          item.onclick = () => openMemberRolesModal(m.id, m.username, m.avatar);
          item.innerHTML = `
            <div class="avatar-wrapper">
              ${m.avatar ? `<img src="${escapeHtml(m.avatar)}" class="avatar" style="object-fit: cover; border-radius: 50%; width: 32px; height: 32px;" />` : `<div class="avatar">${initials}</div>`}
              <div class="status-dot ${cfg.dotClass}"></div>
            </div>
            <div style="display: flex; flex-direction: column;">
              <span class="member-name">${escapeHtml(m.username)}</span>
              ${m.durationText ? `<span style="font-size: 10px; color: var(--text-muted);">${escapeHtml(cfg.title)} (${m.durationText})</span>` : ''}
            </div>
          `;
          container.appendChild(item);
        });
      }
    });
  }

  // Active state for Member Roles modal
  let activeRoleModalMember = null;

  async function openMemberRolesModal(userId, username, avatar) {
    if (!currentGuild) {
      alert('Selecione um servidor primeiro.');
      return;
    }

    activeRoleModalMember = { userId, username, avatar };
    const modal = document.getElementById('member-roles-modal');
    if (!modal) return;

    const nameEl = document.getElementById('role-modal-member-name');
    const avatarEl = document.getElementById('role-modal-member-avatar');
    if (nameEl) nameEl.textContent = username;
    if (avatarEl) {
      if (avatar) {
        avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
      } else {
        avatarEl.textContent = (username || '??').substring(0, 2).toUpperCase();
      }
    }

    modal.classList.add('open');
    await loadMemberRolesList(userId);
  }
  window.openMemberRolesModal = openMemberRolesModal;

  async function loadMemberRolesList(userId) {
    const listEl = document.getElementById('member-roles-list');
    if (!listEl || !currentGuild) return;

    listEl.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 16px;">Carregando cargos...</div>';

    try {
      const [allRoles, memberRoleIds] = await Promise.all([
        api(`/guilds/${currentGuild.id}/roles`).catch(() => []),
        api(`/guilds/${currentGuild.id}/members/${userId}/roles`).catch(() => []),
      ]);

      const assignedSet = new Set(memberRoleIds || []);

      if (!allRoles || allRoles.length === 0) {
        listEl.innerHTML = `
          <div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 16px; background: var(--bg-tertiary); border-radius: 6px;">
            Nenhum cargo criado neste servidor ainda.<br>
            Crie seu primeiro cargo abaixo (ex: <strong>Moderador</strong>, <strong>VIP</strong>, <strong>Membro</strong>).
          </div>
        `;
        return;
      }

      listEl.innerHTML = '';
      allRoles.forEach((role) => {
        const isAssigned = assignedSet.has(role.id);
        const colorHex = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-secondary); border-radius: 6px; cursor: pointer; transition: background 0.15s;';
        row.onmouseenter = () => { row.style.background = 'var(--bg-tertiary)'; };
        row.onmouseleave = () => { row.style.background = 'var(--bg-secondary)'; };

        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 14px; height: 14px; border-radius: 50%; background-color: ${colorHex}; flex-shrink: 0; box-shadow: 0 0 6px ${colorHex}88;"></div>
            <span style="font-size: 14px; font-weight: 600; color: ${colorHex !== '#99aab5' ? colorHex : 'var(--text-normal)'};">${escapeHtml(role.name)}</span>
            ${role.hoist ? '<span style="font-size: 10px; color: var(--text-muted); background: rgba(255,255,255,0.06); padding: 1px 4px; border-radius: 3px;">Destacado</span>' : ''}
          </div>
          <input type="checkbox" ${isAssigned ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent);" />
        `;

        const checkbox = row.querySelector('input[type="checkbox"]');
        row.onclick = (e) => {
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
          }
          toggleMemberRole(userId, role.id, checkbox.checked);
        };
        checkbox.onclick = (e) => e.stopPropagation();
        checkbox.onchange = () => toggleMemberRole(userId, role.id, checkbox.checked);

        listEl.appendChild(row);
      });
    } catch (err) {
      listEl.innerHTML = `<div style="color: var(--red); font-size: 13px; padding: 12px;">Erro ao carregar cargos: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function toggleMemberRole(userId, roleId, shouldAssign) {
    if (!currentGuild) return;
    try {
      if (shouldAssign) {
        await api(`/guilds/${currentGuild.id}/members/${userId}/roles/${roleId}`, { method: 'POST' });
      } else {
        await api(`/guilds/${currentGuild.id}/members/${userId}/roles/${roleId}`, { method: 'DELETE' });
      }
    } catch (err) {
      alert(`Erro ao alterar cargo: ${err.message}`);
      if (activeRoleModalMember) loadMemberRolesList(activeRoleModalMember.userId);
    }
  }
  window.toggleMemberRole = toggleMemberRole;

  async function quickCreateRole() {
    if (!currentGuild) {
      alert('Selecione um servidor primeiro.');
      return;
    }
    const nameInput = document.getElementById('quick-role-name');
    const colorInput = document.getElementById('quick-role-color');
    const name = nameInput ? nameInput.value.trim() : '';
    const colorHex = colorInput ? colorInput.value : '#5865F2';

    if (!name) {
      alert('Informe o nome do cargo (ex: Moderador, VIP, Membro)');
      return;
    }

    const colorInt = parseInt(colorHex.replace('#', ''), 16) || 0;

    try {
      const newRole = await api(`/guilds/${currentGuild.id}/roles`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          color: colorInt,
          hoist: true,
          mentionable: true,
        }),
      });

      if (nameInput) nameInput.value = '';

      // If active member, assign this newly created role immediately to them!
      if (activeRoleModalMember && newRole && newRole.id) {
        await toggleMemberRole(activeRoleModalMember.userId, newRole.id, true);
        await loadMemberRolesList(activeRoleModalMember.userId);
      }
    } catch (err) {
      alert(`Erro ao criar cargo: ${err.message}`);
    }
  }
  window.quickCreateRole = quickCreateRole;

  async function loadGuildMembers(guildId) {
    try {
      guildMembers = (await api(`/guilds/${guildId}/members`)) || [];
      renderMembersList();
    } catch {
      guildMembers = currentUser ? [{ id: currentUser.id, username: currentUser.username, discriminator: currentUser.discriminator, avatar: currentUser.avatar }] : [];
      renderMembersList();
    }
  }

  // Circular Server Icon Upload Helpers (SyncCord Style)
  function triggerGuildIconUpload() {
    const input = document.getElementById('guild-icon-file-input');
    if (input) input.click();
  }
  window.triggerGuildIconUpload = triggerGuildIconUpload;

  function handleGuildIconFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert('A imagem não pode ultrapassar 20MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 512;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        pendingGuildIconData = canvas.toDataURL('image/jpeg', 0.92);

        const displayContainer = document.getElementById('guild-icon-display-container');
        const removeBtn = document.getElementById('btn-remove-guild-icon');
        if (displayContainer) {
          displayContainer.innerHTML = `<img id="guild-icon-preview-img" src="${escapeHtml(pendingGuildIconData)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
        }
        if (removeBtn) {
          removeBtn.style.display = 'inline-flex';
        }
      };
      img.onerror = () => {
        pendingGuildIconData = rawDataUrl;
        const displayContainer = document.getElementById('guild-icon-display-container');
        const removeBtn = document.getElementById('btn-remove-guild-icon');
        if (displayContainer) {
          displayContainer.innerHTML = `<img id="guild-icon-preview-img" src="${escapeHtml(pendingGuildIconData)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
        }
        if (removeBtn) {
          removeBtn.style.display = 'inline-flex';
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  }
  window.handleGuildIconFileSelected = handleGuildIconFileSelected;

  function handleRemoveGuildIcon() {
    pendingGuildIconData = null;
    const fileInput = document.getElementById('guild-icon-file-input');
    if (fileInput) fileInput.value = '';
    const displayContainer = document.getElementById('guild-icon-display-container');
    const removeBtn = document.getElementById('btn-remove-guild-icon');
    if (displayContainer) {
      displayContainer.innerHTML = `
        <div id="guild-icon-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); font-size: 11px; text-align: center; gap: 4px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/>
            <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
          </svg>
          <span style="font-weight: 700; font-size: 10px;">UPLOAD</span>
        </div>
      `;
    }
    if (removeBtn) {
      removeBtn.style.display = 'none';
    }
  }
  window.handleRemoveGuildIcon = handleRemoveGuildIcon;

  // Server Folder Grouping Handlers (Drag & Drop)
  function handleGuildDrop(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    let targetFolder = guildFolders.find((f) => f.guildIds.includes(targetId));
    let sourceFolder = guildFolders.find((f) => f.guildIds.includes(sourceId));

    if (sourceFolder && sourceFolder === targetFolder) {
      // Reordena dentro da mesma pasta
      const fromIdx = sourceFolder.guildIds.indexOf(sourceId);
      const toIdx = sourceFolder.guildIds.indexOf(targetId);
      sourceFolder.guildIds.splice(fromIdx, 1);
      sourceFolder.guildIds.splice(toIdx, 0, sourceId);
    } else {
      // Se a fonte estava em uma pasta, remove dela
      if (sourceFolder) {
        sourceFolder.guildIds = sourceFolder.guildIds.filter((id) => id !== sourceId);
      }

      if (targetFolder) {
        // Adiciona à pasta de destino
        targetFolder.guildIds.push(sourceId);
      } else {
        // Cria um novo agrupamento com ambos os servidores (target e source)
        const newFolder = {
          id: `folder-${Date.now()}`,
          name: 'Pasta de Servidores',
          color: '#5865f2',
          guildIds: [targetId, sourceId],
          expanded: false,
        };
        guildFolders.push(newFolder);
      }
    }

    // Regra do SyncCord: Se sobrar apenas 1 servidor ou nenhum na pasta, dissolve a pasta (o servidor restante torna-se independente)
    guildFolders = guildFolders.filter((f) => f.guildIds.length > 1);
    localStorage.setItem('discord_guild_folders', JSON.stringify(guildFolders));
    loadGuilds();
  }

  function removeGuildFromFolder(guildId) {
    guildFolders.forEach((f) => {
      f.guildIds = f.guildIds.filter((id) => id !== guildId);
    });
    // Se sobrar apenas 1 servidor ou nenhum na pasta, dissolve a pasta (o servidor restante torna-se independente)
    guildFolders = guildFolders.filter((f) => f.guildIds.length > 1);
    localStorage.setItem('discord_guild_folders', JSON.stringify(guildFolders));
    loadGuilds();
  }
  window.removeGuildFromFolder = removeGuildFromFolder;

  function toggleFolderExpanded(folderId) {
    const folder = guildFolders.find((f) => f.id === folderId);
    if (folder) {
      folder.expanded = !folder.expanded;
      localStorage.setItem('discord_guild_folders', JSON.stringify(guildFolders));
      loadGuilds();
    }
  }
  window.toggleFolderExpanded = toggleFolderExpanded;

  function createGuildIconElement(g) {
    const icon = document.createElement('div');
    icon.className = `guild-icon ${currentGuild && currentGuild.id === g.id ? 'active' : ''}`;
    icon.title = g.name;
    icon.draggable = true;

    if (g.icon) {
      icon.innerHTML = `<img src="${escapeHtml(g.icon)}" style="width: 100%; height: 100%; border-radius: inherit; object-fit: cover;" />`;
    } else {
      icon.textContent = getInitials(g.name);
    }

    icon.onclick = () => selectGuild(g);

    icon.ondragstart = (e) => {
      draggedGuildId = g.id;
      wasDroppedOnValidTarget = false;
      e.dataTransfer.setData('text/plain', g.id);
      icon.classList.add('dragging');
    };
    icon.ondragend = (e) => {
      // Se não foi solto em um servidor ou pasta, e estava em uma pasta, e foi arrastado para fora (e.clientX > 72 ou fora da tela)
      if (draggedGuildId && !wasDroppedOnValidTarget) {
        const inFolder = guildFolders.some((f) => f.guildIds.includes(draggedGuildId));
        if (inFolder && (e.clientX > 72 || e.clientX < 0 || e.clientY < 0 || e.clientY > window.innerHeight)) {
          removeGuildFromFolder(draggedGuildId);
        }
      }
      draggedGuildId = null;
      wasDroppedOnValidTarget = false;
      icon.classList.remove('dragging');
      document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    };
    icon.ondragover = (e) => {
      e.preventDefault();
      if (draggedGuildId && draggedGuildId !== g.id) {
        icon.classList.add('drag-over');
      }
    };
    icon.ondragleave = () => {
      icon.classList.remove('drag-over');
    };
    icon.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      wasDroppedOnValidTarget = true;
      icon.classList.remove('drag-over');
      handleGuildDrop(draggedGuildId, g.id);
    };

    return icon;
  }

  function renderFolderElement(folder, guildMap) {
    const folderGuilds = folder.guildIds.map((id) => guildMap.get(id)).filter(Boolean);
    if (folderGuilds.length === 0) return;

    if (!folder.expanded) {
      // Pasta Recolhida: grid 2x2 com miniaturas
      const folderWrapper = document.createElement('div');
      folderWrapper.className = 'guild-folder-wrapper';

      const folderBtn = document.createElement('div');
      folderBtn.className = 'guild-icon guild-folder-collapsed';
      folderBtn.title = `${folder.name || 'Pasta de Servidores'} (${folderGuilds.length} servidores) - Clique para abrir`;

      const grid = document.createElement('div');
      grid.className = 'guild-folder-preview-grid';
      folderGuilds.slice(0, 4).forEach((g) => {
        const cell = document.createElement('div');
        cell.className = 'guild-folder-preview-item';
        if (g.icon) {
          cell.innerHTML = `<img src="${escapeHtml(g.icon)}" />`;
        } else {
          cell.textContent = g.name.charAt(0).toUpperCase();
        }
        grid.appendChild(cell);
      });
      folderBtn.appendChild(grid);

      folderBtn.onclick = () => toggleFolderExpanded(folder.id);

      folderBtn.ondragover = (e) => {
        e.preventDefault();
        folderBtn.classList.add('drag-over');
      };
      folderBtn.ondragleave = () => folderBtn.classList.remove('drag-over');
      folderBtn.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        wasDroppedOnValidTarget = true;
        folderBtn.classList.remove('drag-over');
        if (draggedGuildId && !folder.guildIds.includes(draggedGuildId)) {
          guildFolders.forEach((f) => {
            f.guildIds = f.guildIds.filter((id) => id !== draggedGuildId);
          });
          folder.guildIds.push(draggedGuildId);
          guildFolders = guildFolders.filter((f) => f.guildIds.length > 1);
          localStorage.setItem('discord_guild_folders', JSON.stringify(guildFolders));
          loadGuilds();
        }
      };

      folderWrapper.appendChild(folderBtn);
      guildListEl.appendChild(folderWrapper);
    } else {
      // Pasta Expandida: container vertical com botão de recolher
      const expandedContainer = document.createElement('div');
      expandedContainer.className = 'guild-folder-expanded-container';

      const collapseBtn = document.createElement('div');
      collapseBtn.className = 'guild-folder-collapse-btn';
      collapseBtn.title = 'Recolher pasta';
      collapseBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>
        </svg>
      `;
      collapseBtn.onclick = () => toggleFolderExpanded(folder.id);
      expandedContainer.appendChild(collapseBtn);

      folderGuilds.forEach((g) => {
        const icon = createGuildIconElement(g);
        icon.oncontextmenu = (e) => {
          e.preventDefault();
          showConfirmDialog({
            title: 'Remover da Pasta?',
            message: `Deseja remover o servidor <strong>${escapeHtml(g.name)}</strong> desta pasta?`,
            confirmText: 'Remover',
            cancelText: 'Cancelar',
            onConfirm: () => {
              removeGuildFromFolder(g.id);
            },
          });
        };
        expandedContainer.appendChild(icon);
      });

      const ungroupHint = document.createElement('div');
      ungroupHint.className = 'guild-folder-ungroup-hint';
      ungroupHint.title = 'Arraste para fora para desagrupar';
      ungroupHint.textContent = 'Arraste p/ fora';
      expandedContainer.appendChild(ungroupHint);

      guildListEl.appendChild(expandedContainer);
    }
  }

  // API helper with JWT Authorization and Refresh Token Handling
  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/register')) {
      if (refreshToken) {
        if (!isRefreshing) {
          isRefreshing = true;
          const newToken = await attemptTokenRefresh();
          isRefreshing = false;
          if (newToken) {
            onRefreshed(newToken);
            return api(path, options);
          } else {
            logout();
            throw new Error('Unauthorized');
          }
        } else {
          return new Promise((resolve, reject) => {
            subscribeTokenRefresh((newToken) => {
              if (newToken) {
                resolve(api(path, options));
              } else {
                reject(new Error('Unauthorized'));
              }
            });
          });
        }
      } else {
        logout();
        throw new Error('Unauthorized');
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'API Error');
    }

    return res.json().catch(() => null);
  }

  // Load User Guilds with Folders and Drag & Drop
  async function loadGuilds() {
    try {
      const guilds = (await api('/guilds/@me')) || [];
      guildListEl.innerHTML = '';

      // Suporte a soltar servidor na barra lateral para desagrupar
      guildListEl.ondragover = (e) => {
        if (draggedGuildId) {
          e.preventDefault();
        }
      };
      guildListEl.ondrop = (e) => {
        if (draggedGuildId) {
          const inFolder = guildFolders.some((f) => f.guildIds.includes(draggedGuildId));
          if (inFolder && (e.target === guildListEl || e.target.classList.contains('guild-separator'))) {
            e.preventDefault();
            removeGuildFromFolder(draggedGuildId);
          }
        }
      };

      const homeBtn = document.createElement('div');
      homeBtn.className = 'guild-icon home';
      homeBtn.innerHTML = SVGS.HOME;
      homeBtn.title = 'Mensagens Diretas (Solte aqui para desagrupar)';
      homeBtn.onclick = () => selectHome();
      homeBtn.ondragover = (e) => {
        e.preventDefault();
        homeBtn.classList.add('drag-over');
      };
      homeBtn.ondragleave = () => homeBtn.classList.remove('drag-over');
      homeBtn.ondrop = (e) => {
        e.preventDefault();
        homeBtn.classList.remove('drag-over');
        if (draggedGuildId) {
          removeGuildFromFolder(draggedGuildId);
        }
      };
      guildListEl.appendChild(homeBtn);

      const sep = document.createElement('div');
      sep.className = 'guild-separator';
      guildListEl.appendChild(sep);

      // Limpa dados de pastas com servidores que não existem mais
      const guildMap = new Map(guilds.map((g) => [g.id, g]));
      guildFolders.forEach((f) => {
        f.guildIds = f.guildIds.filter((id) => guildMap.has(id));
      });
      guildFolders = guildFolders.filter((f) => f.guildIds.length > 0);

      const renderedFolders = new Set();

      guilds.forEach((g) => {
        const folder = guildFolders.find((f) => f.guildIds.includes(g.id));
        if (folder) {
          if (!renderedFolders.has(folder.id)) {
            renderedFolders.add(folder.id);
            renderFolderElement(folder, guildMap);
          }
        } else {
          // Servidor individual (não agrupado)
          guildListEl.appendChild(createGuildIconElement(g));
        }
      });

      const addBtn = document.createElement('div');
      addBtn.className = 'guild-icon add-guild';
      addBtn.innerHTML = '+';
      addBtn.title = 'Criar ou Entrar em um Servidor (Solte aqui para desagrupar)';
      addBtn.onclick = () => showCreateGuildModal(true);
      addBtn.ondragover = (e) => {
        if (draggedGuildId) {
          e.preventDefault();
          addBtn.classList.add('drag-over');
        }
      };
      addBtn.ondragleave = () => addBtn.classList.remove('drag-over');
      addBtn.ondrop = (e) => {
        e.preventDefault();
        addBtn.classList.remove('drag-over');
        if (draggedGuildId) {
          removeGuildFromFolder(draggedGuildId);
        }
      };
      guildListEl.appendChild(addBtn);

      if (guilds && guilds.length > 0 && !currentGuild) {
        selectGuild(guilds[0]);
      } else if (!guilds || guilds.length === 0) {
        serverNameEl.textContent = 'Nenhum servidor';
        channelListEl.innerHTML = '<div style="padding: 16px; font-size: 13px; color: var(--text-muted);">Clique no "+" para criar seu primeiro servidor!</div>';
      }
    } catch (err) {
      console.error('Error loading guilds:', err);
    }
  }

  // Select a Guild
  async function selectGuild(guild) {
    currentGuild = guild;
    if (guild.icon) {
      serverNameEl.innerHTML = `<img src="${escapeHtml(guild.icon)}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; margin-right: 8px; vertical-align: middle; display: inline-block;" /><span>${escapeHtml(guild.name)}</span>`;
    } else {
      serverNameEl.textContent = guild.name;
    }
    loadGuilds();
    loadGuildMembers(guild.id);

    try {
      const channels = await api(`/guilds/${guild.id}/channels`);
      renderChannels(channels);
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  }

  function selectHome() {
    currentGuild = null;
    serverNameEl.textContent = 'Mensagens Diretas';
    channelListEl.innerHTML = '<div style="padding: 16px; font-size: 13px; color: var(--text-muted);">Amigos & DMs</div>';
    chatHeaderTitleEl.textContent = 'Início';
    if (chatHeaderIconEl) chatHeaderIconEl.innerHTML = SVGS.HASH;
    chatMessagesEl.innerHTML = '<div style="padding: 32px; text-align: center; color: var(--text-muted);">Selecione um servidor à esquerda ou crie um novo clicando no "+".</div>';
    if (voiceChatBannerEl) voiceChatBannerEl.style.display = 'none';
    if (voiceCallStageEl) voiceCallStageEl.style.display = 'none';
    renderMembersList();
  }

  // Render Channel list with Create buttons on categories
  function renderChannels(channels) {
    channelListEl.innerHTML = '';
    const safeChannels = channels || [];

    const textChannels = safeChannels.filter((c) => c.type === 0);
    const voiceChannels = safeChannels.filter((c) => c.type === 2);

    // 1. Text Channels Category Header with "+" Button
    const textCat = document.createElement('div');
    textCat.className = 'channel-category';
    textCat.innerHTML = `
      <span>▼ CANAIS DE TEXTO</span>
      <button class="channel-category-add-btn" title="Criar Canal de Texto">+</button>
    `;
    textCat.querySelector('.channel-category-add-btn').onclick = (e) => {
      e.stopPropagation();
      openCreateChannelModal(0);
    };
    channelListEl.appendChild(textCat);

    textChannels.forEach((c) => {
      const item = document.createElement('div');
      item.className = `channel-item ${currentChannel && currentChannel.id === c.id ? 'active' : ''}`;
      item.innerHTML = `
        <div class="channel-main">
          <span class="channel-icon">${SVGS.HASH}</span>
          <span>${escapeHtml(c.name)}</span>
        </div>
      `;
      item.onclick = () => selectChannel(c);
      channelListEl.appendChild(item);
    });

    // 2. Voice Channels Category Header with "+" Button
    const voiceCat = document.createElement('div');
    voiceCat.className = 'channel-category';
    voiceCat.innerHTML = `
      <span>▼ CANAIS DE VOZ</span>
      <button class="channel-category-add-btn" title="Criar Canal de Voz">+</button>
    `;
    voiceCat.querySelector('.channel-category-add-btn').onclick = (e) => {
      e.stopPropagation();
      openCreateChannelModal(2);
    };
    channelListEl.appendChild(voiceCat);

    voiceChannels.forEach((c) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'channel-wrapper';

      const isVoiceConnected = connectedVoiceChannel && connectedVoiceChannel.id === c.id;
      const isCurrentChat = currentChannel && currentChannel.id === c.id;

      const item = document.createElement('div');
      item.className = `channel-item ${isVoiceConnected || isCurrentChat ? 'active' : ''}`;
      item.innerHTML = `
        <div class="channel-main" title="Entrar no canal de voz ${escapeHtml(c.name)}">
          <span class="channel-icon">${SVGS.VOICE}</span>
          <span class="channel-name">${escapeHtml(c.name)}</span>
        </div>
        <div class="channel-actions">
          <button class="channel-action-btn invite-btn" title="Criar Convite para Servidor/Voz">${SVGS.INVITE}</button>
          <button class="channel-action-btn chat-btn" title="Abrir Chat de Texto">${SVGS.CHAT}</button>
        </div>
      `;

      item.querySelector('.channel-main').onclick = (e) => {
        e.stopPropagation();
        joinVoiceChannel(c);
      };

      item.querySelector('.invite-btn').onclick = (e) => {
        e.stopPropagation();
        openInviteModal(c);
      };

      item.querySelector('.chat-btn').onclick = (e) => {
        e.stopPropagation();
        openVoiceChannelChat(c);
      };

      wrapper.appendChild(item);

      const usersList = document.createElement('div');
      usersList.className = 'voice-users-list';
      usersList.id = `voice-users-${c.id}`;
      wrapper.appendChild(usersList);

      channelListEl.appendChild(wrapper);
    });

    renderVoiceUsers();

    if (pendingInviteChannelId) {
      const targetCh = safeChannels.find((c) => c.id === pendingInviteChannelId);
      if (targetCh) {
        pendingInviteChannelId = null;
        if (targetCh.type === 2) {
          joinVoiceChannel(targetCh);
        } else {
          selectChannel(targetCh);
        }
        return;
      }
    }

    if (textChannels.length > 0 && (!currentChannel || currentChannel.guildId !== currentGuild.id)) {
      selectChannel(textChannels[0]);
    }
  }

  // Render Voice Users in Channels Sidebar
  function renderVoiceUsers() {
    const containers = document.querySelectorAll('.voice-users-list');
    containers.forEach((container) => {
      const channelId = container.id.replace('voice-users-', '');
      container.innerHTML = '';

      const usersInChannel = voiceStates.filter((s) => s.channelId === channelId);
      usersInChannel.forEach((s) => {
        const u = s.user;
        const isMe = currentUser && u.id === currentUser.id;
        const username = isMe ? currentUser.username : u.username;
        const avatar = isMe ? currentUser.avatar : u.avatar;
        const initials = (username || '??').substring(0, 2).toUpperCase();

        const row = document.createElement('div');
        row.className = 'voice-user-item';
        row.id = `voice-user-${u.id}`;
        row.innerHTML = `
          <div class="voice-avatar-wrapper">
            <div class="voice-avatar ${s.speaking ? 'speaking' : ''}" id="voice-avatar-${u.id}">
              ${avatar ? `<img src="${escapeHtml(avatar)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" />` : initials}
            </div>
          </div>
          <span class="voice-username">${escapeHtml(username)}</span>
          ${s.streaming ? '<span class="live-badge" title="Transmitindo Tela">AO VIVO</span>' : ''}
          ${s.selfMute ? '<span class="voice-user-badge" title="Microfone Desativado">🔇</span>' : ''}
        `;
        container.appendChild(row);
      });
    });
  }

  // Render Voice Call Stage
  function renderVoiceCallStage() {
    if (!voiceCallStageEl) return;

    const isInVoice = connectedVoiceChannel && currentChannel && currentChannel.id === connectedVoiceChannel.id;

    if (!isInVoice) {
      voiceCallStageEl.style.display = 'none';
      if (chatMessagesEl) chatMessagesEl.style.display = 'flex';
      if (chatInputWrapperEl) chatInputWrapperEl.style.display = 'block';
      return;
    }

    voiceCallStageEl.style.display = 'flex';
    if (chatMessagesEl) chatMessagesEl.style.display = 'none';
    if (chatInputWrapperEl) chatInputWrapperEl.style.display = 'none';

    const voiceChatSidebarEl = document.getElementById('voice-text-chat-sidebar');
    const membersSidebarEl = document.getElementById('members-sidebar');
    if (isVoiceChatSidebarOpen && activeVoiceChatChannel) {
      if (voiceChatSidebarEl) voiceChatSidebarEl.style.display = 'flex';
      if (membersSidebarEl) membersSidebarEl.style.display = 'none';
    } else {
      if (voiceChatSidebarEl) voiceChatSidebarEl.style.display = 'none';
      if (membersSidebarEl) membersSidebarEl.style.display = 'flex';
    }

    if (voiceParticipantsGridEl) {
      if (activeStreams.size > 0) {
        // Bug 3 Fix: When screen/video stream is active, hide participant card squares
        voiceParticipantsGridEl.style.display = 'none';
        voiceParticipantsGridEl.innerHTML = '';
      } else {
        voiceParticipantsGridEl.style.display = 'grid';
        voiceParticipantsGridEl.innerHTML = '';
        const participants = voiceStates.filter((s) => s.channelId === connectedVoiceChannel.id);

        participants.forEach((s) => {
          const u = s.user;
          const isMe = currentUser && u.id === currentUser.id;
          const username = isMe ? currentUser.username : u.username;
          const avatar = isMe ? currentUser.avatar : u.avatar;
          const initials = (username || '??').substring(0, 2).toUpperCase();

          const card = document.createElement('div');
          card.className = `voice-participant-card ${s.speaking ? 'speaking' : ''}`;
          card.id = `participant-card-${u.id}`;

          card.innerHTML = `
            <div class="card-reaction-overlay" id="reaction-overlay-${u.id}"></div>
            <div class="card-avatar-wrapper">
              <div class="card-avatar ${s.speaking ? 'speaking' : ''}" id="card-avatar-${u.id}">
                ${avatar ? `<img src="${escapeHtml(avatar)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" />` : initials}
              </div>
            </div>
            <div class="card-nameplate">
              <span>${escapeHtml(username)}</span>
              ${s.streaming ? '<span class="live-badge">AO VIVO</span>' : ''}
              ${s.selfMute ? '<span>🔇</span>' : ''}
            </div>
          `;

          voiceParticipantsGridEl.appendChild(card);
        });
      }
    }

    renderVideoGrid();
    updateDockButtonsState();
  }

  // Render Multi-Stream Video Grid (Simultaneous Multi-Screen Sharing with PiP overlay)
  function renderVideoGrid() {
    if (!voiceVideoGridEl) return;

    if (activeStreams.size === 0) {
      voiceVideoGridEl.style.display = 'none';
      voiceVideoGridEl.innerHTML = '';
      return;
    }

    voiceVideoGridEl.style.display = 'grid';
    if (activeStreams.size === 1) {
      voiceVideoGridEl.style.gridTemplateColumns = '1fr';
    } else if (activeStreams.size === 2) {
      voiceVideoGridEl.style.gridTemplateColumns = '1fr 1fr';
    } else {
      voiceVideoGridEl.style.gridTemplateColumns = 'repeat(auto-fit, minmax(360px, 1fr))';
    }

    // Remove obsolete cards that are no longer in activeStreams
    const currentCardElements = Array.from(voiceVideoGridEl.children);
    currentCardElements.forEach((cardEl) => {
      const domKey = cardEl.getAttribute('data-stream-key');
      if (domKey && !activeStreams.has(domKey)) {
        cardEl.remove();
      }
    });

    activeStreams.forEach((item, streamKey) => {
      const sanitizedKey = String(streamKey).replace(/[^a-zA-Z0-9_-]/g, '_');
      const ownerUserId = item.userId || (String(streamKey).includes(':') ? String(streamKey).split(':')[0] : String(streamKey));
      const userState = voiceStates.find((s) => s.user && s.user.id === ownerUserId);
      const isMe = currentUser && ownerUserId === currentUser.id;
      const avatar = isMe ? currentUser.avatar : userState?.user?.avatar;
      const displayUsername = item.username || (isMe ? currentUser.username : (userState?.user?.username || 'Membro'));
      const initials = (displayUsername || '??').substring(0, 2).toUpperCase();
      const isCurrentlySpeaking = isMe ? (!isMuted && micMeterFillEl && parseFloat(micMeterFillEl.style.width || '0') > 0) : !!userState?.speaking;

      let card = document.getElementById(`video-grid-item-${sanitizedKey}`);
      let videoEl = document.getElementById(`stream-player-${sanitizedKey}`);

      if (!card) {
        card = document.createElement('div');
        card.className = 'video-grid-item';
        card.id = `video-grid-item-${sanitizedKey}`;
        card.setAttribute('data-stream-key', streamKey);
        card.setAttribute('data-user-id', ownerUserId);

        videoEl = document.createElement('video');
        videoEl.className = 'voice-video-element';
        videoEl.id = `stream-player-${sanitizedKey}`;
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        // Local screen is muted to avoid loopback
        videoEl.muted = true;

        const isCam = item.type === 'camera';
        const bar = document.createElement('div');
        bar.className = 'stream-floating-bar';
        bar.innerHTML = `
          <span class="live-badge">AO VIVO</span>
          <span class="stream-title-label" style="font-weight: 600;">${isCam ? 'Câmera de' : 'Tela de'} ${escapeHtml(displayUsername)}</span>
          ${item.isLocal ? '<button class="stage-action-btn stop-stream-btn" style="margin-left: auto;">Parar Transmissão</button>' : ''}
          <button class="stage-action-btn fullscreen-stream-btn" title="Tela Cheia" style="${item.isLocal ? '' : 'margin-left: auto;'}">⛶</button>
        `;

        if (item.isLocal) {
          bar.querySelector('.stop-stream-btn').onclick = (e) => {
            e.stopPropagation();
            if (item.type === 'camera') stopCamera();
            else stopScreenShare();
          };
        }

        bar.querySelector('.fullscreen-stream-btn').onclick = (e) => {
          e.stopPropagation();
          if (videoEl.requestFullscreen) videoEl.requestFullscreen();
        };

        // Bug 3 Fix: Picture-in-Picture badge in bottom-left corner of the stream card
        const pipBadge = document.createElement('div');
        pipBadge.className = 'stream-pip-badge';
        pipBadge.id = `stream-pip-${sanitizedKey}`;
        pipBadge.innerHTML = `
          <div class="stream-pip-avatar ${isCurrentlySpeaking ? 'speaking' : ''}" id="stream-pip-avatar-${sanitizedKey}" data-user-id="${ownerUserId}">
            ${avatar ? `<img src="${escapeHtml(avatar)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" />` : initials}
          </div>
          <span class="stream-pip-name">${escapeHtml(displayUsername)}</span>
        `;

        card.appendChild(videoEl);
        card.appendChild(bar);
        card.appendChild(pipBadge);
        voiceVideoGridEl.appendChild(card);
      } else {
        const titleEl = card.querySelector('.stream-title-label');
        if (titleEl) {
          const isCam = item.type === 'camera';
          titleEl.textContent = `${isCam ? 'Câmera de' : 'Tela de'} ${displayUsername}`;
        }
        const pipNameEl = card.querySelector('.stream-pip-name');
        if (pipNameEl) pipNameEl.textContent = displayUsername;
      }

      if (videoEl && item.stream && videoEl.srcObject !== item.stream) {
        videoEl.srcObject = item.stream;
        videoEl.play().catch((err) => {
          console.warn('Video playback autoplay warning:', err);
        });
      }
    });
  }

  function updateDockButtonsState() {
    if (dockBtnMicEl) {
      dockBtnMicEl.innerHTML = isMuted ? SVGS.MIC_OFF : SVGS.MIC_ON;
      dockBtnMicEl.classList.toggle('muted', isMuted);
    }
    if (dockBtnDeafEl) {
      dockBtnDeafEl.innerHTML = isDeafened ? SVGS.DEAF_OFF : SVGS.DEAF_ON;
      dockBtnDeafEl.classList.toggle('muted', isDeafened);
    }
    if (dockBtnScreenshareEl) {
      dockBtnScreenshareEl.classList.toggle('active', !!screenStream);
    }
    if (dockBtnCameraEl) {
      dockBtnCameraEl.classList.toggle('active', !!cameraStream);
    }
    if (dockBtnToggleChatEl) {
      dockBtnToggleChatEl.classList.toggle('active', isChatOpenInVoice);
    }
  }

  // Join Voice Channel
  async function joinVoiceChannel(channel) {
    if (!currentUser || !currentGuild) return;

    if (connectedVoiceChannel && connectedVoiceChannel.id !== channel.id) {
      leaveVoiceChannel(false);
    }

    connectedVoiceChannel = channel;

    if (socket) {
      socket.emit('voice:join', {
        guildId: currentGuild.id,
        channelId: channel.id,
        user: {
          id: currentUser.id,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
          avatar: currentUser.avatar,
        },
        selfMute: isMuted,
        selfDeaf: isDeafened,
      });
    }

    if (voiceConnectedBarEl) {
      voiceConnectedBarEl.style.display = 'flex';
      if (connectedChannelNameEl) connectedChannelNameEl.textContent = channel.name;
      if (connectedGuildNameEl) connectedGuildNameEl.textContent = `/ ${currentGuild.name}`;
    }

    selectChannel(channel);
    await startAudioCapture(channel.id);
    syncVoiceConnections();
  }

  // Leave Voice Channel
  function leaveVoiceChannel(updateGateway = true) {
    if (!connectedVoiceChannel) return;

    stopScreenShare();
    stopCamera();

    const channelId = connectedVoiceChannel.id;
    connectedVoiceChannel = null;

    if (updateGateway && socket && currentUser) {
      socket.emit('voice:leave', {
        guildId: currentGuild ? currentGuild.id : undefined,
        channelId,
        userId: currentUser.id,
      });
    }

    closeAllPeerConnections();
    handleVoiceDisconnectedUI();
    stopAudioCapture();
  }

  function handleVoiceDisconnectedUI() {
    connectedVoiceChannel = null;
    activeStreams.clear();
    renderVideoGrid();
    if (voiceConnectedBarEl) voiceConnectedBarEl.style.display = 'none';
    if (voiceCallStageEl) voiceCallStageEl.style.display = 'none';
    if (chatMessagesEl) chatMessagesEl.style.display = 'flex';
    if (chatInputWrapperEl) chatInputWrapperEl.style.display = 'block';

    const headerVoiceChatBtn = document.getElementById('header-btn-toggle-voice-chat');
    if (headerVoiceChatBtn && (!currentChannel || currentChannel.type !== 2)) {
      headerVoiceChatBtn.style.display = 'none';
    }

    updateVoiceChatBanner();
    renderVoiceUsers();
  }

  // Audio Device Enumeration & Selection
  async function refreshAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      if (audioInputSelectEl) {
        audioInputSelectEl.innerHTML = '';
        audioInputs.forEach((d, idx) => {
          const opt = document.createElement('option');
          opt.value = d.deviceId;
          opt.textContent = d.label || `Microfone ${idx + 1}`;
          if (d.deviceId === selectedAudioInputId) opt.selected = true;
          audioInputSelectEl.appendChild(opt);
        });
      }

      if (audioOutputSelectEl) {
        audioOutputSelectEl.innerHTML = '';
        audioOutputs.forEach((d, idx) => {
          const opt = document.createElement('option');
          opt.value = d.deviceId;
          opt.textContent = d.label || `Alto-falante / Fone ${idx + 1}`;
          if (d.deviceId === selectedAudioOutputId) opt.selected = true;
          audioOutputSelectEl.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn('Error enumerating audio devices:', err);
    }
  }

  function switchAudioInput(deviceId) {
    selectedAudioInputId = deviceId;
    if (connectedVoiceChannel) {
      stopAudioCapture();
      startAudioCapture(connectedVoiceChannel.id);
    }
  }

  async function switchAudioOutput(deviceId) {
    selectedAudioOutputId = deviceId;
    const mediaElements = document.querySelectorAll('video, audio');
    for (const el of mediaElements) {
      if (el && typeof el.setSinkId === 'function') {
        try {
          await el.setSinkId(deviceId);
        } catch (err) {
          console.warn('Error setting sinkId:', err);
        }
      }
    }
  }

  function testSpeakerSound() {
    if (speakerTestStatusEl) {
      speakerTestStatusEl.style.display = 'inline';
      setTimeout(() => {
        if (speakerTestStatusEl) speakerTestStatusEl.style.display = 'none';
      }, 1500);
    }
    synthesizeSound('join');
  }

  // Web Audio Synthesizer
  function synthesizeSound(soundKey) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (soundKey === 'airhorn') {
        [233, 466, 699].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        });
      } else if (soundKey === 'join') {
        [587.33, 880].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
          gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.12);
          osc.stop(ctx.currentTime + i * 0.12 + 0.3);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (err) {
      console.warn('Web Audio error:', err);
    }
  }

  function triggerFloatingReaction(userId, emoji) {
    const overlay = document.getElementById(`reaction-overlay-${userId}`);
    if (!overlay) return;

    const el = document.createElement('div');
    el.className = 'floating-reaction';
    el.textContent = emoji;
    overlay.appendChild(el);

    setTimeout(() => {
      if (overlay.contains(el)) overlay.removeChild(el);
    }, 1800);
  }

  window.playSound = function (soundKey, emoji, soundName) {
    synthesizeSound(soundKey);
    if (currentUser) triggerFloatingReaction(currentUser.id, emoji);
    if (socket && connectedVoiceChannel && currentUser) {
      socket.emit('voice:sound', {
        channelId: connectedVoiceChannel.id,
        userId: currentUser.id,
        sound: soundKey,
        emoji,
        soundName,
      });
    }
  };

  window.sendReaction = function (emoji) {
    if (currentUser) triggerFloatingReaction(currentUser.id, emoji);
    if (socket && connectedVoiceChannel && currentUser) {
      socket.emit('voice:reaction', {
        channelId: connectedVoiceChannel.id,
        userId: currentUser.id,
        emoji,
      });
    }
  };

  window.toggleSoundboard = function (forceState) {
    if (!soundboardPopoverEl) return;
    const shouldShow = typeof forceState === 'boolean' ? forceState : soundboardPopoverEl.style.display === 'none';
    soundboardPopoverEl.style.display = shouldShow ? 'block' : 'none';
  };

  // Real-time Screen Sharing (Supports Multiple People Sharing Simultaneously, up to 4)
  async function toggleScreenShare() {
    if (!connectedVoiceChannel) {
      alert('Você precisa entrar em um canal de voz para compartilhar a tela.');
      return;
    }

    if (screenStream) {
      stopScreenShare();
      return;
    }

    // Bug 1: Concurrency limit - max 4 simultaneous streams
    if (activeStreams.size >= MAX_CONCURRENT_STREAMS && !activeStreams.has(`${currentUser.id}:screen`)) {
      alert('Limite máximo de 4 transmissões simultâneas atingido.');
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Seu navegador não suporta compartilhamento de tela.');
        return;
      }

      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor' },
        audio: true,
      });

      // Add local screen to multi-stream activeStreams map with composite key
      activeStreams.set(`${currentUser.id}:screen`, {
        stream: screenStream,
        username: currentUser.username,
        isLocal: true,
        type: 'screen',
        userId: currentUser.id,
      });

      renderVideoGrid();

      // Bug 2: If screen audio was selected, seamlessly mix mic + screen audio dynamically
      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        screenAudioTracks[0].onended = () => {
          updateOutgoingAudioOnAllPeers();
        };
      }
      updateOutgoingAudioOnAllPeers();

      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      if (socket && currentUser) {
        socket.emit('voice:stream_update', {
          channelId: connectedVoiceChannel.id,
          userId: currentUser.id,
          username: currentUser.username,
          streaming: true,
          video: !!cameraStream,
        });

        // Broadcast WebRTC screen video tracks to all peers in this call
        broadcastScreenStreamToPeers();
      }

      const myState = voiceStates.find((s) => s.user.id === currentUser.id);
      if (myState) myState.streaming = true;

      renderVoiceUsers();
      renderVoiceCallStage();
    } catch (err) {
      console.warn('Error starting screen share:', err);
      stopScreenShare();
    }
  }

  function stopScreenShare() {
    if (screenStream) {
      const screenTracks = screenStream.getTracks();
      screenTracks.forEach((track) => track.stop());

      // Cleanly remove video senders from each peer connection & renegotiate
      peerConnections.forEach(async (pc, targetUserId) => {
        try {
          const senders = pc.getSenders();
          let removed = false;
          senders.forEach((sender) => {
            if (sender.track && screenTracks.some((st) => st.id === sender.track.id && st.kind === 'video')) {
              try {
                pc.removeTrack(sender);
                removed = true;
              } catch (e) {}
            }
          });
          if (removed) {
            renegotiateWithPeer(targetUserId, pc);
          }
        } catch (err) {
          console.warn('Error cleaning screen sender:', err);
        }
      });

      screenStream = null;
    }

    // Bug 2: Revert outgoing audio to raw mic cleanly
    if (mixedAudioContext) {
      mixedAudioContext.close().catch(() => {});
      mixedAudioContext = null;
      mixedAudioStream = null;
    }
    updateOutgoingAudioOnAllPeers();

    if (currentUser) {
      activeStreams.delete(`${currentUser.id}:screen`);
    }
    renderVideoGrid();

    if (socket && currentUser && connectedVoiceChannel) {
      socket.emit('voice:stream_update', {
        channelId: connectedVoiceChannel.id,
        userId: currentUser.id,
        username: currentUser.username,
        streaming: false,
        video: !!cameraStream,
      });
    }

    if (currentUser) {
      const myState = voiceStates.find((s) => s.user.id === currentUser.id);
      if (myState) myState.streaming = false;
      renderVoiceUsers();
      renderVoiceCallStage();
    }
  }

  async function broadcastScreenStreamToPeers() {
    if (!screenStream || !connectedVoiceChannel) return;

    // Ensure all peers in voice channel have connection and senders
    const participants = voiceStates.filter((s) => s.channelId === connectedVoiceChannel.id);
    for (const p of participants) {
      if (p.user.id === currentUser?.id) continue;
      const pc = getOrCreatePeerConnection(p.user.id);
      syncLocalTracksWithPeer(pc);
      renegotiateWithPeer(p.user.id, pc);
    }
  }

  // Real-time Webcam Video (Supports up to 4 concurrent video streams)
  async function toggleCamera() {
    if (!connectedVoiceChannel) {
      alert('Você precisa entrar em um canal de voz para ativar a câmera.');
      return;
    }

    if (cameraStream) {
      stopCamera();
      return;
    }

    // Bug 1: Concurrency limit - max 4 simultaneous streams
    if (activeStreams.size >= MAX_CONCURRENT_STREAMS && !activeStreams.has(`${currentUser.id}:cam`)) {
      alert('Limite máximo de 4 transmissões simultâneas atingido.');
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Seu navegador não suporta captura de câmera.');
        return;
      }

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false,
      });

      activeStreams.set(`${currentUser.id}:cam`, {
        stream: cameraStream,
        username: `${currentUser.username} (Câmera)`,
        isLocal: true,
        type: 'camera',
        userId: currentUser.id,
      });
      renderVideoGrid();

      cameraStream.getVideoTracks()[0].onended = () => {
        stopCamera();
      };

      if (socket && currentUser) {
        socket.emit('voice:stream_update', {
          channelId: connectedVoiceChannel.id,
          userId: currentUser.id,
          username: currentUser.username,
          streaming: !!screenStream,
          video: true,
        });

        broadcastCameraStreamToPeers();
      }

      const myState = voiceStates.find((s) => s.user.id === currentUser.id);
      if (myState) myState.video = true;

      renderVoiceUsers();
      renderVoiceCallStage();
    } catch (err) {
      console.warn('Error starting camera:', err);
      stopCamera();
    }
  }

  function stopCamera() {
    if (cameraStream) {
      const camTracks = cameraStream.getTracks();
      camTracks.forEach((track) => track.stop());

      peerConnections.forEach(async (pc, targetUserId) => {
        try {
          const senders = pc.getSenders();
          let removed = false;
          senders.forEach((sender) => {
            if (sender.track && camTracks.some((ct) => ct.id === sender.track.id)) {
              try {
                pc.removeTrack(sender);
                removed = true;
              } catch (e) {}
            }
          });
          if (removed) {
            renegotiateWithPeer(targetUserId, pc);
          }
        } catch (err) {
          console.warn('Error cleaning camera sender:', err);
        }
      });

      cameraStream = null;
    }

    if (currentUser) {
      activeStreams.delete(`${currentUser.id}:cam`);
    }
    renderVideoGrid();

    if (socket && currentUser && connectedVoiceChannel) {
      socket.emit('voice:stream_update', {
        channelId: connectedVoiceChannel.id,
        userId: currentUser.id,
        username: currentUser.username,
        streaming: !!screenStream,
        video: false,
      });
    }

    if (currentUser) {
      const myState = voiceStates.find((s) => s.user.id === currentUser.id);
      if (myState) myState.video = false;
      renderVoiceUsers();
      renderVoiceCallStage();
    }
  }

  async function broadcastCameraStreamToPeers() {
    if (!cameraStream || !connectedVoiceChannel) return;

    const participants = voiceStates.filter((s) => s.channelId === connectedVoiceChannel.id);
    for (const p of participants) {
      if (p.user.id === currentUser?.id) continue;
      const pc = getOrCreatePeerConnection(p.user.id);
      syncLocalTracksWithPeer(pc);
      renegotiateWithPeer(p.user.id, pc);
    }
  }

  // Bug 2: Get active outgoing audio track (mixes mic + screen audio into one seamless track)
  function getActiveOutgoingAudioTrack() {
    const screenAudioTracks = screenStream ? screenStream.getAudioTracks() : [];
    const micAudioTrack = localAudioStream ? localAudioStream.getAudioTracks()[0] : null;

    if (screenAudioTracks.length > 0 && micAudioTrack) {
      try {
        if (!mixedAudioContext || mixedAudioContext.state === 'closed') {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          mixedAudioContext = new AudioCtx();
        }
        if (mixedAudioContext.state === 'suspended') {
          mixedAudioContext.resume().catch(() => {});
        }

        const mixedDestination = mixedAudioContext.createMediaStreamDestination();
        const micSource = mixedAudioContext.createMediaStreamSource(new MediaStream([micAudioTrack]));
        micSource.connect(mixedDestination);

        const screenSource = mixedAudioContext.createMediaStreamSource(new MediaStream([screenAudioTracks[0]]));
        screenSource.connect(mixedDestination);

        mixedAudioStream = mixedDestination.stream;
        return mixedAudioStream.getAudioTracks()[0];
      } catch (err) {
        console.warn('[WebAudio] Audio mixing fallback to microphone:', err);
        return micAudioTrack;
      }
    }

    if (screenAudioTracks.length > 0) {
      return screenAudioTracks[0];
    }

    return micAudioTrack || null;
  }

  // Bug 2: Propagate outgoing audio track change to all peers without dropping connection
  function updateOutgoingAudioOnAllPeers() {
    const outgoingTrack = getActiveOutgoingAudioTrack();
    if (!outgoingTrack) return;

    peerConnections.forEach((pc, targetUserId) => {
      const senders = pc.getSenders();
      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
      if (audioSender) {
        if (audioSender.track?.id !== outgoingTrack.id) {
          audioSender.replaceTrack(outgoingTrack).catch((err) => {
            console.warn(`[WebRTC] Error replacing audio track for ${targetUserId}:`, err);
          });
        }
      } else {
        try {
          pc.addTrack(outgoingTrack, new MediaStream([outgoingTrack]));
          renegotiateWithPeer(targetUserId, pc);
        } catch (err) {}
      }
    });
  }

  // Sync local tracks (mic/mixed-audio, screen video, cam video) to RTCPeerConnection avoiding duplicates
  function syncLocalTracksWithPeer(pc) {
    const senders = pc.getSenders();

    // 1. Microphone + Screen Mixed Audio Track
    const outgoingAudioTrack = getActiveOutgoingAudioTrack();
    if (outgoingAudioTrack) {
      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
      if (!audioSender) {
        try {
          pc.addTrack(outgoingAudioTrack, new MediaStream([outgoingAudioTrack]));
        } catch (e) {
          console.warn('Error adding audio track to peer connection:', e);
        }
      } else if (audioSender.track?.id !== outgoingAudioTrack.id) {
        audioSender.replaceTrack(outgoingAudioTrack).catch(() => {});
      }
    }

    // 2. Screen Share Video Track (Video ONLY, audio is mixed into outgoing audio track)
    if (screenStream) {
      screenStream.getVideoTracks().forEach((track) => {
        const alreadyAdded = senders.some((s) => s.track && s.track.id === track.id);
        if (!alreadyAdded) {
          try {
            pc.addTrack(track, screenStream);
          } catch (e) {
            console.warn('Error adding screen video track to peer connection:', e);
          }
        }
      });
    }

    // 3. Camera Video Track
    if (cameraStream) {
      cameraStream.getVideoTracks().forEach((track) => {
        const alreadyAdded = senders.some((s) => s.track && s.track.id === track.id);
        if (!alreadyAdded) {
          try {
            pc.addTrack(track, cameraStream);
          } catch (e) {
            console.warn('Error adding camera video track to peer connection:', e);
          }
        }
      });
    }
  }

  // Play remote audio through dedicated HTMLAudioElement
  function playRemoteAudio(userId, stream) {
    let audioEl = remoteAudioElements.get(userId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `remote-audio-${userId}`;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      remoteAudioElements.set(userId, audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.muted = isDeafened;

    if (selectedAudioOutputId && selectedAudioOutputId !== 'default' && typeof audioEl.setSinkId === 'function') {
      audioEl.setSinkId(selectedAudioOutputId).catch(() => {});
    }

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`Autoplay audio for user ${userId} waiting for interaction:`, err);
        const retryAudioPlay = () => {
          audioEl.play().catch(() => {});
          document.removeEventListener('click', retryAudioPlay);
        };
        document.addEventListener('click', retryAudioPlay, { once: true });
      });
    }
  }

  // WebRTC Mesh Peer Connection Factory
  function getOrCreatePeerConnection(targetUserId) {
    if (peerConnections.has(targetUserId)) {
      return peerConnections.get(targetUserId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && currentUser) {
        socket.emit('voice:signal', {
          to: targetUserId,
          from: currentUser.id,
          signal: { candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const remoteStream = event.streams[0] || new MediaStream([track]);

      if (track.kind === 'audio') {
        // High fidelity incoming voice audio playback
        playRemoteAudio(targetUserId, remoteStream);
      } else if (track.kind === 'video') {
        // Incoming screenshare or camera stream
        const remoteUser = voiceStates.find((s) => s.user.id === targetUserId)?.user;
        const username = remoteUser ? remoteUser.username : 'Membro';

        let streamKey = `${targetUserId}:screen`;
        let streamType = 'screen';
        let streamLabel = username;

        if (activeStreams.has(`${targetUserId}:screen`)) {
          streamKey = `${targetUserId}:cam`;
          streamType = 'camera';
          streamLabel = `${username} (Câmera)`;
        } else {
          const userState = voiceStates.find((s) => s.user.id === targetUserId);
          if (userState && userState.video && !userState.streaming) {
            streamKey = `${targetUserId}:cam`;
            streamType = 'camera';
            streamLabel = `${username} (Câmera)`;
          }
        }

        activeStreams.set(streamKey, {
          stream: remoteStream,
          trackId: track.id,
          username: streamLabel,
          isLocal: false,
          type: streamType,
          userId: targetUserId,
        });
        renderVideoGrid();

        track.onended = () => {
          activeStreams.delete(streamKey);
          renderVideoGrid();
        };
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection with ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        pc.restartIce();
      }
    };

    // Attach currently active tracks
    syncLocalTracksWithPeer(pc);

    peerConnections.set(targetUserId, pc);
    return pc;
  }

  // Renegotiate with a peer safely
  async function renegotiateWithPeer(targetUserId, pc) {
    if (isMakingOffer.get(targetUserId)) return;
    try {
      isMakingOffer.set(targetUserId, true);
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      if (socket && currentUser) {
        socket.emit('voice:signal', {
          to: targetUserId,
          from: currentUser.id,
          signal: { sdp: pc.localDescription },
        });
      }
    } catch (err) {
      console.warn(`Error creating WebRTC offer for ${targetUserId}:`, err);
    } finally {
      isMakingOffer.set(targetUserId, false);
    }
  }

  // Connect to a voice peer
  async function connectToVoicePeer(targetUserId, shouldCreateOffer = false) {
    if (!currentUser || targetUserId === currentUser.id) return;
    const pc = getOrCreatePeerConnection(targetUserId);
    syncLocalTracksWithPeer(pc);

    if (shouldCreateOffer) {
      renegotiateWithPeer(targetUserId, pc);
    }
  }

  // Connect to all peers currently in the connected voice channel
  function syncVoiceConnections() {
    if (!connectedVoiceChannel || !currentUser) return;
    const participants = voiceStates.filter(
      (s) => s.channelId === connectedVoiceChannel.id && s.user && s.user.id !== currentUser.id,
    );

    participants.forEach((p) => {
      // Deterministic initiator: member with greater string ID sends initial offer
      const isInitiator = currentUser.id > p.user.id;
      connectToVoicePeer(p.user.id, isInitiator);
    });
  }

  // Attach local audio to all active peers once microphone is captured
  function attachAudioToAllPeers() {
    if (!localAudioStream) return;
    peerConnections.forEach((pc, targetUserId) => {
      syncLocalTracksWithPeer(pc);
      renegotiateWithPeer(targetUserId, pc);
    });
  }

  // Process WebRTC Signaling Messages (SDP offers/answers and ICE candidates)
  async function handleRemoteVoiceSignal(data) {
    if (!currentUser || (data.to && data.to !== currentUser.id) || data.from === currentUser.id) return;

    const fromUserId = data.from;
    const pc = getOrCreatePeerConnection(fromUserId);

    if (data.signal?.sdp) {
      try {
        const sdp = new RTCSessionDescription(data.signal.sdp);
        await pc.setRemoteDescription(sdp);

        // Apply any ICE candidates that arrived before remoteDescription was set
        const queue = iceCandidateQueues.get(fromUserId) || [];
        while (queue.length > 0) {
          const candidate = queue.shift();
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            console.warn('Error applying queued ICE candidate:', err);
          }
        }

        if (sdp.type === 'offer') {
          syncLocalTracksWithPeer(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (socket && currentUser) {
            socket.emit('voice:signal', {
              to: fromUserId,
              from: currentUser.id,
              signal: { sdp: pc.localDescription },
            });
          }
        }
      } catch (err) {
        console.warn(`Error handling SDP signal from ${fromUserId}:`, err);
      }
    } else if (data.signal?.candidate) {
      try {
        const candidate = new RTCIceCandidate(data.signal.candidate);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(candidate);
        } else {
          if (!iceCandidateQueues.has(fromUserId)) {
            iceCandidateQueues.set(fromUserId, []);
          }
          iceCandidateQueues.get(fromUserId).push(candidate);
        }
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    }
  }

  // Close peer connection cleanly
  function closePeerConnection(userId) {
    const pc = peerConnections.get(userId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      peerConnections.delete(userId);
    }

    const audioEl = remoteAudioElements.get(userId);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch (e) {}
      remoteAudioElements.delete(userId);
    }

    iceCandidateQueues.delete(userId);
    isMakingOffer.delete(userId);
  }

  // Close all peer connections and remote audio elements on voice channel disconnect
  function closeAllPeerConnections() {
    peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    peerConnections.clear();

    remoteAudioElements.forEach((audioEl) => {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch (e) {}
    });
    remoteAudioElements.clear();

    iceCandidateQueues.clear();
    isMakingOffer.clear();
  }

  // Audio Capture with Device Selection & Volume VU Meter
  async function startAudioCapture(channelId) {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const audioConstraints = selectedAudioInputId !== 'default'
          ? { deviceId: { exact: selectedAudioInputId } }
          : true;

        localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        refreshAudioDevices();
        attachAudioToAllPeers();

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioContext = new AudioContextClass();
          const source = audioContext.createMediaStreamSource(localAudioStream);
          analyserNode = audioContext.createAnalyser();
          analyserNode.fftSize = 256;
          source.connect(analyserNode);

          const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
          let wasSpeaking = false;

          const checkSpeaking = () => {
            if (!connectedVoiceChannel || !localAudioStream) return;
            analyserNode.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const speaking = !isMuted && average > 25;

            if (micMeterFillEl) {
              const meterPercent = isMuted ? 0 : Math.min(100, (average / 70) * 100);
              micMeterFillEl.style.width = `${meterPercent}%`;
            }

            if (speaking !== wasSpeaking) {
              wasSpeaking = speaking;
              updateUserSpeakingUI(currentUser.id, speaking);
              if (socket) {
                socket.emit('voice:speaking', {
                  channelId,
                  userId: currentUser.id,
                  speaking,
                });
              }
            }
            requestAnimationFrame(checkSpeaking);
          };
          checkSpeaking();
        }
      }
    } catch {
      // Audio capture failed or ignored
    }
  }

  function stopAudioCapture() {
    if (localAudioStream) {
      localAudioStream.getTracks().forEach((track) => track.stop());
      localAudioStream = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    if (micMeterFillEl) {
      micMeterFillEl.style.width = '0%';
    }
  }

  function updateUserSpeakingUI(userId, speaking) {
    const avatarEl = document.getElementById(`voice-avatar-${userId}`);
    if (avatarEl) avatarEl.classList.toggle('speaking', speaking);
    const cardEl = document.getElementById(`participant-card-${userId}`);
    if (cardEl) cardEl.classList.toggle('speaking', speaking);
    const cardAvatarEl = document.getElementById(`card-avatar-${userId}`);
    if (cardAvatarEl) cardAvatarEl.classList.toggle('speaking', speaking);

    // Bug 3: Update speaking ring on PiP overlay inside active stream cards
    document.querySelectorAll(`.stream-pip-avatar[data-user-id="${userId}"]`).forEach((pip) => {
      pip.classList.toggle('speaking', speaking);
    });
  }

  // Select Channel
  async function selectChannel(channel) {
    if (currentChannel && socket) {
      socket.emit('channel:leave', currentChannel.id);
    }

    currentChannel = channel;
    const isVoice = channel.type === 2;

    const headerVoiceChatBtn = document.getElementById('header-btn-toggle-voice-chat');

    if (isVoice) {
      if (chatHeaderIconEl) chatHeaderIconEl.innerHTML = SVGS.VOICE;
      chatHeaderTitleEl.innerHTML = `${escapeHtml(channel.name)} <span style="font-size: 11px; background: rgba(88,101,242,0.3); color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Canal de Voz</span>`;
      chatInputEl.placeholder = `Conversar em #${channel.name} (Chat de Voz)`;
      if (headerVoiceChatBtn) headerVoiceChatBtn.style.display = 'flex';
    } else {
      if (chatHeaderIconEl) chatHeaderIconEl.innerHTML = SVGS.HASH;
      chatHeaderTitleEl.textContent = channel.name;
      chatInputEl.placeholder = `Conversar em #${channel.name}`;
      if (headerVoiceChatBtn && !connectedVoiceChannel) headerVoiceChatBtn.style.display = 'none';
      if (!connectedVoiceChannel) closeVoiceChannelChat();
    }

    updateVoiceChatBanner();
    renderVoiceCallStage();

    if (socket) {
      socket.emit('channel:join', channel.id);
    }

    try {
      const messages = await api(`/channels/${channel.id}/messages?limit=50`);
      chatMessagesEl.innerHTML = '';
      (messages || []).forEach(appendMessage);
      scrollToBottom();
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }

  function updateVoiceChatBanner() {
    if (!voiceChatBannerEl) return;

    if (currentChannel && currentChannel.type === 2) {
      voiceChatBannerEl.style.display = 'flex';
      if (voiceChatBannerNameEl) voiceChatBannerNameEl.textContent = currentChannel.name;
      if (voiceJoinQuickBtnEl) {
        if (connectedVoiceChannel && connectedVoiceChannel.id === currentChannel.id) {
          voiceJoinQuickBtnEl.textContent = 'Conectado na Voz ✅';
          voiceJoinQuickBtnEl.style.backgroundColor = 'var(--accent)';
        } else {
          voiceJoinQuickBtnEl.textContent = 'Entrar na Voz';
          voiceJoinQuickBtnEl.style.backgroundColor = 'var(--green)';
        }
      }
    } else {
      voiceChatBannerEl.style.display = 'none';
    }
  }

  function appendMessage(msg) {
    const el = document.createElement('div');
    el.className = 'message-item';
    const authorId = msg.authorId || msg.author_id;
    if (authorId) el.setAttribute('data-author-id', authorId);

    const isMine = currentUser && authorId === currentUser.id;
    const member = guildMembers ? guildMembers.find((m) => m.id === authorId) : null;

    const rawName = (isMine && currentUser.username)
      ? currentUser.username
      : (msg.authorName || msg.author_name || (member ? member.username : 'Membro'));
    const authorName = escapeHtml(rawName);

    const rawAvatar = (isMine && currentUser.avatar)
      ? currentUser.avatar
      : (msg.authorAvatar || msg.author_avatar || (member ? member.avatar : null));
    const authorAvatar = rawAvatar ? escapeHtml(rawAvatar) : null;

    const initials = authorName.substring(0, 2).toUpperCase();
    const timeRaw = msg.createdAt || msg.timestamp;
    const timeStr = timeRaw ? new Date(timeRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Agora';

    el.innerHTML = `
      ${authorAvatar ? `<img src="${authorAvatar}" class="message-avatar" style="object-fit: cover; border-radius: 50%; width: 40px; height: 40px;" />` : `<div class="message-avatar">${initials}</div>`}
      <div class="message-content-wrapper">
        <div class="message-header">
          <span class="author-name">${authorName}</span>
          <span class="message-time">${timeStr}</span>
        </div>
        <div class="message-text">${escapeHtml(msg.content)}</div>
      </div>
    `;

    chatMessagesEl.appendChild(el);
    scrollToBottom();
  }

  async function sendMessage() {
    const text = chatInputEl.value.trim();
    if (!text || !currentChannel) return;

    chatInputEl.value = '';

    try {
      await api(`/channels/${currentChannel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
    } catch (err) {
      alert(`Erro ao enviar mensagem: ${err.message}`);
    }
  }

  // Open Invite Modal
  function openInviteModal(channel) {
    const modal = document.getElementById('invite-voice-modal');
    const title = document.getElementById('invite-modal-title');
    const input = document.getElementById('invite-link-input');
    const copyBtn = document.getElementById('copy-invite-btn');

    if (!modal || !input) return;

    const targetChannel = channel || connectedVoiceChannel || currentChannel;
    const channelId = targetChannel?.id || '';
    const guildId = currentGuild?.id || '';

    if (title) {
      if (targetChannel && targetChannel.name) {
        title.textContent = `Convidar amigos para #${targetChannel.name}`;
      } else {
        title.textContent = `Convidar amigos para ${currentGuild?.name || 'Servidor'}`;
      }
    }

    const queryParts = [];
    if (guildId) queryParts.push(`guild=${encodeURIComponent(guildId)}`);
    if (channelId) queryParts.push(`channel=${encodeURIComponent(channelId)}`);
    const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    input.value = `${window.location.origin}/${qs}`;

    if (copyBtn) {
      copyBtn.textContent = 'Copiar';
      copyBtn.style.backgroundColor = 'var(--accent)';
    }

    modal.classList.add('open');
  }

  // Expose for inline onclick handlers
  window.openInviteModal = openInviteModal;

  function updateAudioButtons() {
    if (btnToggleMicEl) {
      btnToggleMicEl.innerHTML = isMuted ? SVGS.MIC_OFF : SVGS.MIC_ON;
      btnToggleMicEl.title = isMuted ? 'Ativar Microfone' : 'Desativar Microfone';
    }
    if (btnToggleDeafEl) {
      btnToggleDeafEl.innerHTML = isDeafened ? SVGS.DEAF_OFF : SVGS.DEAF_ON;
      btnToggleDeafEl.title = isDeafened ? 'Ativar Áudio' : 'Desativar Áudio';
    }
    updateDockButtonsState();
  }

  function toggleMic() {
    isMuted = !isMuted;
    updateAudioButtons();
    if (localAudioStream) {
      localAudioStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
    if (connectedVoiceChannel && socket && currentUser) {
      socket.emit('voice:join', {
        guildId: currentGuild.id,
        channelId: connectedVoiceChannel.id,
        user: {
          id: currentUser.id,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
          avatar: currentUser.avatar,
        },
        selfMute: isMuted,
        selfDeaf: isDeafened,
      });
    }
    const myState = voiceStates.find((s) => s.user.id === currentUser.id);
    if (myState) myState.selfMute = isMuted;
    renderVoiceUsers();
    renderVoiceCallStage();
  }

  function toggleDeaf() {
    isDeafened = !isDeafened;
    updateAudioButtons();
    // Update all remote audio playback elements immediately
    remoteAudioElements.forEach((audioEl) => {
      audioEl.muted = isDeafened;
    });
    if (connectedVoiceChannel && socket && currentUser) {
      socket.emit('voice:join', {
        guildId: currentGuild.id,
        channelId: connectedVoiceChannel.id,
        user: {
          id: currentUser.id,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
          avatar: currentUser.avatar,
        },
        selfMute: isMuted,
        selfDeaf: isDeafened,
      });
    }
    const myState = voiceStates.find((s) => s.user.id === currentUser.id);
    if (myState) myState.selfDeaf = isDeafened;
    renderVoiceUsers();
    renderVoiceCallStage();
  }

  // Expose audio toggles for native desktop client tray actions
  window.__toggleMic = toggleMic;
  window.__toggleDeaf = toggleDeaf;

  // Channel Creation Modal Logic
  function openCreateChannelModal(defaultType) {
    if (!currentGuild) {
      alert('Selecione um servidor primeiro.');
      return;
    }
    selectedChannelType = typeof defaultType === 'number' ? defaultType : 0;
    const modal = document.getElementById('create-channel-modal');
    const guildNameSpan = document.getElementById('create-channel-guild-name');
    const input = document.getElementById('channel-name-input');
    const prefix = document.getElementById('channel-prefix-icon');
    const textCard = document.getElementById('channel-type-text-card');
    const voiceCard = document.getElementById('channel-type-voice-card');

    if (guildNameSpan) guildNameSpan.textContent = currentGuild.name;
    if (input) {
      input.value = '';
      input.placeholder = selectedChannelType === 2 ? 'Lounge VIP' : 'novo-canal';
    }
    if (prefix) prefix.textContent = selectedChannelType === 2 ? '🔊' : '#';

    if (textCard && voiceCard) {
      textCard.classList.toggle('active', selectedChannelType === 0);
      voiceCard.classList.toggle('active', selectedChannelType === 2);
    }

    if (modal) modal.classList.add('open');
  }
  window.openCreateChannelModal = openCreateChannelModal;

  // Guild Creation / Join Tabs
  window.setGuildTab = function (tab) {
    const isCreate = tab === 'create';
    const tabCreate = document.getElementById('guild-tab-create');
    const tabJoin = document.getElementById('guild-tab-join');
    const formCreate = document.getElementById('create-guild-form');
    const formJoin = document.getElementById('join-guild-form');

    if (tabCreate) tabCreate.classList.toggle('active', isCreate);
    if (tabJoin) tabJoin.classList.toggle('active', !isCreate);
    if (formCreate) formCreate.style.display = isCreate ? 'flex' : 'none';
    if (formJoin) formJoin.style.display = isCreate ? 'none' : 'flex';
  };

  // UI Event Listeners
  function setupEventListeners() {
    // Suporte global para arrastar servidor para fora da pasta e desagrupar
    window.addEventListener('dragover', (e) => {
      if (draggedGuildId) {
        const inFolder = guildFolders.some((f) => f.guildIds.includes(draggedGuildId));
        if (inFolder) {
          e.preventDefault();
        }
      }
    });

    window.addEventListener('drop', (e) => {
      if (draggedGuildId && !wasDroppedOnValidTarget) {
        const inFolder = guildFolders.some((f) => f.guildIds.includes(draggedGuildId));
        if (inFolder) {
          const inServerTarget = e.target && e.target.closest && (e.target.closest('.guild-icon') || e.target.closest('.guild-folder-wrapper'));
          if (!inServerTarget) {
            e.preventDefault();
            removeGuildFromFolder(draggedGuildId);
          }
        }
      }
    });

    chatInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtnEl.addEventListener('click', sendMessage);

    if (voiceDisconnectBtnEl) {
      voiceDisconnectBtnEl.addEventListener('click', () => leaveVoiceChannel(true));
    }
    if (dockBtnDisconnectEl) {
      dockBtnDisconnectEl.addEventListener('click', () => leaveVoiceChannel(true));
    }

    if (voiceJoinQuickBtnEl) {
      voiceJoinQuickBtnEl.addEventListener('click', () => {
        if (currentChannel && currentChannel.type === 2) {
          joinVoiceChannel(currentChannel);
        }
      });
    }

    if (btnToggleScreenshareEl) btnToggleScreenshareEl.addEventListener('click', toggleScreenShare);
    if (dockBtnScreenshareEl) dockBtnScreenshareEl.addEventListener('click', toggleScreenShare);

    if (btnToggleCameraEl) btnToggleCameraEl.addEventListener('click', toggleCamera);
    if (dockBtnCameraEl) dockBtnCameraEl.addEventListener('click', toggleCamera);

    if (btnToggleMicEl) btnToggleMicEl.addEventListener('click', toggleMic);
    if (dockBtnMicEl) dockBtnMicEl.addEventListener('click', toggleMic);

    if (btnToggleDeafEl) btnToggleDeafEl.addEventListener('click', toggleDeaf);
    if (dockBtnDeafEl) dockBtnDeafEl.addEventListener('click', toggleDeaf);

    if (dockBtnSoundboardEl) {
      dockBtnSoundboardEl.addEventListener('click', () => window.toggleSoundboard());
    }
    if (closeSoundboardBtnEl) {
      closeSoundboardBtnEl.addEventListener('click', () => window.toggleSoundboard(false));
    }

    if (dockBtnToggleChatEl) {
      dockBtnToggleChatEl.addEventListener('click', () => {
        toggleVoiceChannelChat(connectedVoiceChannel || currentChannel);
      });
    }

    const headerBtnToggleVoiceChatEl = document.getElementById('header-btn-toggle-voice-chat');
    if (headerBtnToggleVoiceChatEl) {
      headerBtnToggleVoiceChatEl.addEventListener('click', () => {
        toggleVoiceChannelChat(connectedVoiceChannel || activeVoiceChatChannel || currentChannel);
      });
    }

    const headerBtnInviteMembersEl = document.getElementById('header-btn-invite-members');
    if (headerBtnInviteMembersEl) {
      headerBtnInviteMembersEl.addEventListener('click', () => {
        openInviteModal(connectedVoiceChannel || currentChannel);
      });
    }

    const voiceChatSidebarCloseBtnEl = document.getElementById('voice-chat-sidebar-close-btn');
    if (voiceChatSidebarCloseBtnEl) {
      voiceChatSidebarCloseBtnEl.addEventListener('click', closeVoiceChannelChat);
    }

    const voiceChatSidebarSendBtnEl = document.getElementById('voice-chat-sidebar-send-btn');
    const voiceChatSidebarInputEl = document.getElementById('voice-chat-sidebar-input');
    if (voiceChatSidebarSendBtnEl && voiceChatSidebarInputEl) {
      voiceChatSidebarSendBtnEl.addEventListener('click', sendVoiceChatMessage);
      voiceChatSidebarInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendVoiceChatMessage();
        }
      });
    }

    if (dockBtnAudioSettingsEl) {
      dockBtnAudioSettingsEl.addEventListener('click', () => {
        refreshAudioDevices();
        document.getElementById('audio-devices-modal').classList.add('open');
      });
    }

    if (audioInputSelectEl) {
      audioInputSelectEl.addEventListener('change', (e) => {
        switchAudioInput(e.target.value);
      });
    }
    if (audioOutputSelectEl) {
      audioOutputSelectEl.addEventListener('change', (e) => {
        switchAudioOutput(e.target.value);
      });
    }

    if (btnTestSpeakerEl) {
      btnTestSpeakerEl.addEventListener('click', testSpeakerSound);
    }

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        refreshAudioDevices();
      });
    }

    // Confirmation Action Modal Buttons
    const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');
    if (confirmModalCancelBtn) {
      confirmModalCancelBtn.addEventListener('click', closeConfirmModal);
    }
    const confirmModalConfirmBtn = document.getElementById('confirm-modal-confirm-btn');
    if (confirmModalConfirmBtn) {
      confirmModalConfirmBtn.addEventListener('click', () => {
        const cb = activeConfirmCallback;
        closeConfirmModal();
        if (typeof cb === 'function') cb();
      });
    }

    // Modal backdrops & keyboard listeners
    const confirmModalEl = document.getElementById('confirm-action-modal');
    if (confirmModalEl) {
      confirmModalEl.addEventListener('click', (e) => {
        if (e.target === confirmModalEl) closeConfirmModal();
      });
    }
    const editUsernameModalEl = document.getElementById('edit-username-modal');
    if (editUsernameModalEl) {
      editUsernameModalEl.addEventListener('click', (e) => {
        if (e.target === editUsernameModalEl) closeEditUsernameModal();
      });
    }
    const modalNewUsernameInput = document.getElementById('modal-new-username-input');
    if (modalNewUsernameInput) {
      modalNewUsernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitEditUsernameModal();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeEditUsernameModal();
        }
      });
    }

    // Status Selector Popover toggle on User Panel
    const userInfoBtn = document.getElementById('user-info-btn');
    if (userInfoBtn) {
      userInfoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStatusMenu();
      });
    }

    // Close popover and active submenus when clicking outside
    document.addEventListener('click', (e) => {
      const popover = document.getElementById('status-menu-popover');
      if (popover && popover.style.display !== 'none' && !popover.contains(e.target) && !e.target.closest('#user-info-btn')) {
        popover.style.display = 'none';
        document.querySelectorAll('.status-menu-item.has-submenu').forEach((el) => {
          el.classList.remove('active-submenu');
        });
      }
    });

    const statusPopoverEl = document.getElementById('status-menu-popover');
    if (statusPopoverEl) {
      statusPopoverEl.addEventListener('click', (e) => {
        if (!e.target.closest('.status-menu-item.has-submenu')) {
          document.querySelectorAll('.status-menu-item.has-submenu').forEach((el) => {
            el.classList.remove('active-submenu');
          });
        }
      });
    }

    // Close User Settings modal when ESC key is pressed
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('user-settings-modal');
        if (modal && modal.style.display !== 'none') {
          closeUserSettingsModal();
        }
      }
    });

    // Copy Invite Button
    const copyInviteBtn = document.getElementById('copy-invite-btn');
    const inviteInput = document.getElementById('invite-link-input');
    if (copyInviteBtn && inviteInput) {
      copyInviteBtn.addEventListener('click', () => {
        inviteInput.select();
        navigator.clipboard.writeText(inviteInput.value).then(() => {
          copyInviteBtn.textContent = 'Copiado! ✅';
          copyInviteBtn.style.backgroundColor = 'var(--green)';
          setTimeout(() => {
            copyInviteBtn.textContent = 'Copiar';
            copyInviteBtn.style.backgroundColor = 'var(--accent)';
          }, 2000);
        });
      });
    }

    // Channel type selector cards
    const textCard = document.getElementById('channel-type-text-card');
    const voiceCard = document.getElementById('channel-type-voice-card');
    if (textCard && voiceCard) {
      textCard.onclick = () => {
        selectedChannelType = 0;
        textCard.classList.add('active');
        voiceCard.classList.remove('active');
        const prefix = document.getElementById('channel-prefix-icon');
        const nameInput = document.getElementById('channel-name-input');
        if (prefix) prefix.textContent = '#';
        if (nameInput) nameInput.placeholder = 'novo-canal';
      };
      voiceCard.onclick = () => {
        selectedChannelType = 2;
        voiceCard.classList.add('active');
        textCard.classList.remove('active');
        const prefix = document.getElementById('channel-prefix-icon');
        const nameInput = document.getElementById('channel-name-input');
        if (prefix) prefix.textContent = '🔊';
        if (nameInput) nameInput.placeholder = 'Lounge VIP';
      };
    }

    // Create Channel Form
    const createChannelForm = document.getElementById('create-channel-form');
    if (createChannelForm) {
      createChannelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentGuild) return;
        const nameInput = document.getElementById('channel-name-input');
        const name = nameInput.value.trim();
        if (!name) return;

        try {
          const newChan = await api(`/guilds/${currentGuild.id}/channels`, {
            method: 'POST',
            body: JSON.stringify({ name, type: selectedChannelType }),
          });
          closeModal('create-channel-modal');
          const channels = await api(`/guilds/${currentGuild.id}/channels`);
          renderChannels(channels);
          if (newChan) selectChannel(newChan);
        } catch (err) {
          alert(`Erro ao criar canal: ${err.message}`);
        }
      });
    }

    // Create Guild Form
    const createGuildForm = document.getElementById('create-guild-form');
    if (createGuildForm) {
      createGuildForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('guild-name-input').value;
        if (!name) return;

        try {
          const guild = await api('/guilds', {
            method: 'POST',
            body: JSON.stringify({
              name,
              icon: pendingGuildIconData || null,
            }),
          });

          handleRemoveGuildIcon();
          showCreateGuildModal(false);
          await loadGuilds();
          selectGuild(guild);
        } catch (err) {
          alert(`Erro ao criar servidor: ${err.message}`);
        }
      });
    }

    // Join Guild Form (Invite Link or Guild ID)
    const joinGuildForm = document.getElementById('join-guild-form');
    if (joinGuildForm) {
      joinGuildForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawInput = document.getElementById('join-guild-input').value.trim();
        if (!rawInput) return;

        let guildId = rawInput;
        if (rawInput.includes('?')) {
          try {
            const urlObj = new URL(rawInput, window.location.origin);
            guildId = urlObj.searchParams.get('guild') || urlObj.searchParams.get('joinGuild') || rawInput;
          } catch {
            guildId = rawInput;
          }
        }

        try {
          const guild = await api(`/guilds/${guildId}/members`, {
            method: 'POST',
          });
          closeModal('create-guild-modal');
          await loadGuilds();
          if (guild) selectGuild(guild);
        } catch (err) {
          alert(`Erro ao entrar no servidor: ${err.message}`);
        }
      });
    }

    // Auth Form (Login / Register)
    const authForm = document.getElementById('auth-form');
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const isLogin = document.getElementById('auth-tab-login').classList.contains('active');
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      const username = document.getElementById('auth-username').value;

      try {
        let res;
        if (isLogin) {
          res = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });
        } else {
          res = await api('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, username }),
          });
        }

        token = res.token;
        refreshToken = res.refreshToken || '';
        currentUser = res.user;
        localStorage.setItem('synccord_token', token);
        if (refreshToken) {
          localStorage.setItem('synccord_refresh_token', refreshToken);
        }
        localStorage.setItem('synccord_user', JSON.stringify(currentUser));

        showAuthModal(false);
        updateUserPanel();
        initWebSocket();
        loadGuilds();
      } catch (err) {
        alert(`Erro de autenticação: ${err.message}`);
      }
    });
  }

  function updateUserPanel() {
    if (!currentUser) return;
    const username = currentUser.username || 'Visitante';
    const discriminator = currentUser.discriminator || '0001';

    currentUsernameEl.textContent = username;
    currentUsernameEl.title = username;
    currentDiscriminatorEl.textContent = `#${discriminator}`;

    if (currentUser.avatar) {
      currentAvatarEl.innerHTML = `<img src="${escapeHtml(currentUser.avatar)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
    } else {
      currentAvatarEl.textContent = username.substring(0, 2).toUpperCase();
    }
    if (currentStatusDotEl) {
      currentStatusDotEl.className = `status-dot ${userStatus}`;
    }

    // Sync Mini Profile Flyout Popover
    const popoverBanner = document.getElementById('popover-banner');
    if (popoverBanner) {
      popoverBanner.style.backgroundColor = currentUser.bannerColor || '#5865F2';
    }

    const popoverAvatar = document.getElementById('popover-avatar');
    if (popoverAvatar) {
      if (currentUser.avatar) {
        popoverAvatar.innerHTML = `<img src="${escapeHtml(currentUser.avatar)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
      } else {
        popoverAvatar.textContent = username.substring(0, 2).toUpperCase();
      }
    }

    const popoverStatusDot = document.getElementById('popover-status-dot');
    if (popoverStatusDot) {
      popoverStatusDot.className = `status-dot ${userStatus}`;
    }

    const popoverDisplayName = document.getElementById('popover-display-name');
    if (popoverDisplayName) {
      popoverDisplayName.textContent = username;
    }

    const popoverUsername = document.getElementById('popover-username');
    if (popoverUsername) {
      popoverUsername.textContent = `@${username.toLowerCase().replace(/\s+/g, '')}`;
    }

    const popoverDiscriminator = document.getElementById('popover-discriminator');
    if (popoverDiscriminator) {
      popoverDiscriminator.textContent = `#${discriminator}`;
    }

    const pronounsBadge = document.getElementById('popover-pronouns-badge');
    if (pronounsBadge) {
      if (currentUser.pronouns) {
        pronounsBadge.textContent = currentUser.pronouns;
        pronounsBadge.style.display = 'inline-block';
      } else {
        pronounsBadge.style.display = 'none';
      }
    }

    const popoverStatusText = document.getElementById('popover-status-text');
    if (popoverStatusText) {
      if (currentUser.bio) {
        popoverStatusText.textContent = currentUser.bio.length > 36 ? currentUser.bio.substring(0, 36) + '...' : currentUser.bio;
      } else {
        popoverStatusText.textContent = 'Definir um recado no perfil...';
      }
    }
  }

  function openUserSettingsTab(tabKey) {
    const popover = document.getElementById('status-menu-popover');
    if (popover) popover.style.display = 'none';
    openUserSettingsModal();
    switchSettingsTab(tabKey);
  }
  window.openUserSettingsTab = openUserSettingsTab;

  function showAuthModal(show) {
    authModalEl.classList.toggle('open', show);
  }

  function showCreateGuildModal(show) {
    if (!show) {
      handleRemoveGuildIcon();
    }
    createGuildModalEl.classList.toggle('open', show);
  }

  function logout() {
    leaveVoiceChannel(true);
    localStorage.removeItem('synccord_token');
    localStorage.removeItem('synccord_refresh_token');
    localStorage.removeItem('synccord_user');
    localStorage.removeItem('synccord_user_status');
    localStorage.removeItem('discord_token');
    localStorage.removeItem('discord_refresh_token');
    localStorage.removeItem('discord_user');
    localStorage.removeItem('discord_user_status');
    token = null;
    refreshToken = null;
    currentUser = null;
    window.location.reload();
  }

  window.setAuthTab = function (tab) {
    const isLogin = tab === 'login';
    document.getElementById('auth-tab-login').classList.toggle('active', isLogin);
    document.getElementById('auth-tab-register').classList.toggle('active', !isLogin);
    document.getElementById('auth-username-group').style.display = isLogin ? 'none' : 'flex';
    document.getElementById('auth-submit-btn').textContent = isLogin ? 'Entrar' : 'Criar Conta';
  };

  // ==========================================================================
  // VOICE CHANNEL DEDICATED TEXT CHAT (Right Lateral Menu - Discord.exe)
  // ==========================================================================
  let activeVoiceChatChannel = null;
  let isVoiceChatSidebarOpen = false;

  async function openVoiceChannelChat(channel) {
    if (!channel) return;
    activeVoiceChatChannel = channel;
    isVoiceChatSidebarOpen = true;

    const voiceChatEl = document.getElementById('voice-text-chat-sidebar');
    const membersEl = document.getElementById('members-sidebar');
    const titleEl = document.getElementById('voice-chat-sidebar-title-text');
    const inputEl = document.getElementById('voice-chat-sidebar-input');
    const dockChatBtn = document.getElementById('dock-btn-toggle-chat');
    const headerVoiceChatBtn = document.getElementById('header-btn-toggle-voice-chat');

    if (voiceChatEl) voiceChatEl.style.display = 'flex';
    if (membersEl) membersEl.style.display = 'none';
    if (titleEl) titleEl.textContent = channel.name;
    if (inputEl) {
      inputEl.placeholder = `Conversar em #${channel.name}`;
      inputEl.focus();
    }
    if (dockChatBtn) dockChatBtn.classList.add('active');
    if (headerVoiceChatBtn) {
      headerVoiceChatBtn.style.display = 'flex';
      headerVoiceChatBtn.classList.add('active');
    }

    if (socket) {
      socket.emit('channel:join', channel.id);
    }

    await loadVoiceChannelMessages(channel.id);
  }
  window.openVoiceChannelChat = openVoiceChannelChat;

  function closeVoiceChannelChat() {
    isVoiceChatSidebarOpen = false;
    const voiceChatEl = document.getElementById('voice-text-chat-sidebar');
    const membersEl = document.getElementById('members-sidebar');
    const dockChatBtn = document.getElementById('dock-btn-toggle-chat');
    const headerVoiceChatBtn = document.getElementById('header-btn-toggle-voice-chat');

    if (voiceChatEl) voiceChatEl.style.display = 'none';
    if (membersEl) membersEl.style.display = 'flex';
    if (dockChatBtn) dockChatBtn.classList.remove('active');
    if (headerVoiceChatBtn) headerVoiceChatBtn.classList.remove('active');
  }
  window.closeVoiceChannelChat = closeVoiceChannelChat;

  function toggleVoiceChannelChat(channel) {
    const targetChannel = channel || connectedVoiceChannel || (currentChannel && currentChannel.type === 2 ? currentChannel : null);
    if (!targetChannel) return;

    if (isVoiceChatSidebarOpen && activeVoiceChatChannel && activeVoiceChatChannel.id === targetChannel.id) {
      closeVoiceChannelChat();
    } else {
      openVoiceChannelChat(targetChannel);
    }
  }
  window.toggleVoiceChannelChat = toggleVoiceChannelChat;

  async function loadVoiceChannelMessages(channelId) {
    const container = document.getElementById('voice-chat-sidebar-messages');
    if (!container) return;

    container.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Carregando mensagens...</div>';

    if (currentGuild && (!guildMembers || guildMembers.length === 0)) {
      guildMembers = (await api(`/guilds/${currentGuild.id}/members`).catch(() => [])) || [];
    }

    try {
      const messages = await api(`/channels/${channelId}/messages?limit=50`);
      container.innerHTML = '';
      if (!messages || messages.length === 0) {
        container.innerHTML = `
          <div class="voice-chat-empty-state">
            <div class="voice-chat-empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.486 2 2 6.486 2 12c0 1.837.5 3.557 1.369 5.032L2.094 21.26a1 1 0 0 0 1.218 1.218l4.228-1.275A9.948 9.948 0 0 0 12 22c5.514 0 10-4.486 10-10S17.514 2 12 2zm-5 9a1 1 0 1 1 0-2h10a1 1 0 1 1 0 2H7zm0 4a1 1 0 1 1 0-2h7a1 1 0 1 1 0 2H7z"/>
              </svg>
            </div>
            <div style="font-weight: 700; color: var(--text-header); font-size: 15px; margin-bottom: 4px;">Bem-vindo ao chat do canal de voz!</div>
            <div style="font-size: 12px; line-height: 16px;">Este é o início do histórico de mensagens deste canal de voz. Envie uma mensagem abaixo para começar.</div>
          </div>
        `;
        return;
      }

      messages.forEach(appendVoiceChatMessage);
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      console.error('Error loading voice channel messages:', err);
      container.innerHTML = '<div style="color: var(--red); font-size: 12px; text-align: center; padding: 20px;">Erro ao carregar mensagens do canal de voz.</div>';
    }
  }

  function appendVoiceChatMessage(msg) {
    const container = document.getElementById('voice-chat-sidebar-messages');
    if (!container) return;

    if (msg.id && container.querySelector(`[data-msg-id="${msg.id}"]`)) return;

    const emptyState = container.querySelector('.voice-chat-empty-state');
    if (emptyState) emptyState.remove();

    const authorId = msg.authorId || msg.author_id;
    const isMine = currentUser && authorId === currentUser.id;
    const member = guildMembers ? guildMembers.find((m) => m.id === authorId) : null;

    const rawName = (isMine && currentUser.username)
      ? currentUser.username
      : (msg.authorName || msg.author_name || (member ? member.username : 'Membro'));
    const authorName = escapeHtml(rawName);

    const rawAvatar = (isMine && currentUser.avatar)
      ? currentUser.avatar
      : (msg.authorAvatar || msg.author_avatar || (member ? member.avatar : null));
    const authorAvatar = rawAvatar ? escapeHtml(rawAvatar) : null;

    const initials = authorName.substring(0, 2).toUpperCase();
    const timeRaw = msg.createdAt || msg.timestamp;
    const time = timeRaw
      ? new Date(timeRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const item = document.createElement('div');
    item.className = 'voice-message-item';
    if (msg.id) item.setAttribute('data-msg-id', msg.id);
    if (authorId) item.setAttribute('data-author-id', authorId);

    item.innerHTML = `
      <div class="message-avatar" style="width: 32px; height: 32px; font-size: 11px; flex-shrink: 0; background-color: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; overflow: hidden;">
        ${authorAvatar ? `<img src="${authorAvatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" />` : initials}
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
        <div style="display: flex; align-items: baseline; gap: 8px;">
          <span class="message-author" style="font-size: 13px; font-weight: 600; color: var(--text-header);">${authorName}</span>
          <span class="message-timestamp" style="font-size: 10px; color: var(--text-muted);">${time}</span>
        </div>
        <div class="message-text" style="font-size: 13px; margin-top: 2px; color: var(--text-normal); word-break: break-word;">${escapeHtml(msg.content)}</div>
      </div>
    `;
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
  }

  async function sendVoiceChatMessage() {
    const inputEl = document.getElementById('voice-chat-sidebar-input');
    if (!inputEl || !activeVoiceChatChannel) return;
    const content = inputEl.value.trim();
    if (!content) return;

    inputEl.value = '';

    try {
      const savedMsg = await api(`/channels/${activeVoiceChatChannel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });

      if (savedMsg) {
        appendVoiceChatMessage({
          id: savedMsg.id,
          authorId: currentUser ? currentUser.id : 'me',
          authorName: currentUser ? currentUser.username : 'Eu',
          authorAvatar: currentUser ? currentUser.avatar : null,
          content: savedMsg.content,
          createdAt: savedMsg.createdAt || new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error sending voice channel message:', err);
    }
  }
  window.sendVoiceChatMessage = sendVoiceChatMessage;

  // ==========================================================================
  // SYNCCORD USER SETTINGS FULL OVERLAY & LATERAL MENU LOGIC
  // ==========================================================================
  function openUserSettingsModal(defaultTab = 'my-account') {
    const modal = document.getElementById('user-settings-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    switchSettingsTab(defaultTab);
  }
  window.openUserSettingsModal = openUserSettingsModal;

  function closeUserSettingsModal() {
    const modal = document.getElementById('user-settings-modal');
    if (!modal) return;
    modal.style.display = 'none';
  }
  window.closeUserSettingsModal = closeUserSettingsModal;

  let activeConfirmCallback = null;
  let pendingAvatarData = null;
  let toastTimer = null;

  function showToastNotification(message) {
    let toast = document.getElementById('discord-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'discord-toast';
      toast.className = 'discord-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
      <span>${escapeHtml(message)}</span>
    `;
    toast.style.display = 'flex';
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.style.display = 'none';
      }, 250);
    }, 3000);
  }
  window.showToastNotification = showToastNotification;

  function showConfirmDialog({
    title,
    message = 'Você confirma que deseja prosseguir com esta alteração?',
    confirmText,
    cancelText,
    danger = false,
    onConfirm,
  }) {
    const finalTitle = title || t('common.areYouSure');
    const finalConfirm = confirmText || t('common.confirm');
    const finalCancel = cancelText || t('common.cancel');

    const modal = document.getElementById('confirm-action-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const confirmBtn = document.getElementById('confirm-modal-confirm-btn');
    const cancelBtn = document.getElementById('confirm-modal-cancel-btn');

    if (titleEl) titleEl.textContent = finalTitle;
    if (msgEl) msgEl.innerHTML = message;
    if (confirmBtn) {
      confirmBtn.textContent = finalConfirm;
      confirmBtn.style.backgroundColor = danger ? '#da373c' : '#5865f2';
    }
    if (cancelBtn) cancelBtn.textContent = finalCancel;

    activeConfirmCallback = onConfirm;
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('open');
    }
  }
  window.showConfirmDialog = showConfirmDialog;

  function closeConfirmModal() {
    const modal = document.getElementById('confirm-action-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('open');
    }
    activeConfirmCallback = null;
  }
  window.closeConfirmModal = closeConfirmModal;

  function openEditUsernameModal() {
    const modal = document.getElementById('edit-username-modal');
    const input = document.getElementById('modal-new-username-input');
    const errorEl = document.getElementById('modal-edit-username-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
    if (input) {
      input.value = currentUser?.username || '';
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
    }
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('open');
    }
  }
  window.openEditUsernameModal = openEditUsernameModal;
  window.editUsernamePrompt = openEditUsernameModal;

  function closeEditUsernameModal() {
    const modal = document.getElementById('edit-username-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('open');
    }
  }
  window.closeEditUsernameModal = closeEditUsernameModal;

  function submitEditUsernameModal() {
    const input = document.getElementById('modal-new-username-input');
    const errorEl = document.getElementById('modal-edit-username-error');
    const newName = input ? input.value.trim() : '';

    if (!newName) {
      if (errorEl) {
        errorEl.textContent = 'O nome de usuário não pode estar em branco.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (newName === currentUser?.username) {
      closeEditUsernameModal();
      return;
    }

    closeEditUsernameModal();

    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: `Tem certeza de que deseja alterar seu nome de usuário para <strong>${escapeHtml(newName)}</strong>?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        await executeUpdateUsername(newName);
      },
    });
  }
  window.submitEditUsernameModal = submitEditUsernameModal;

  function handleSettingsLogout() {
    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: 'Você confirma que deseja desconectar e sair da sua conta?',
      confirmText: 'Sair',
      cancelText: 'Permanecer Conectado',
      danger: true,
      onConfirm: () => {
        closeUserSettingsModal();
        logout();
      },
    });
  }
  window.handleSettingsLogout = handleSettingsLogout;

  function triggerProfilePhotoUpload() {
    const input = document.getElementById('profile-avatar-file-input');
    if (input) input.click();
  }
  window.triggerProfilePhotoUpload = triggerProfilePhotoUpload;

  function handleProfileAvatarFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP ou GIF).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert('A imagem não pode ultrapassar 20MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to high-quality lightweight JPEG (~15-25 KB)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        pendingAvatarData = compressedDataUrl;

        // Update the round preview mold immediately
        const container = document.getElementById('profile-avatar-display-container');
        if (container) {
          container.innerHTML = `<img src="${compressedDataUrl}" id="profile-avatar-img-preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" />`;
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  }
  window.handleProfileAvatarFileSelected = handleProfileAvatarFileSelected;

  function handleRemoveAvatar() {
    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: 'Você confirma que deseja remover sua foto de perfil e voltar a exibir suas iniciais?',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: () => {
        pendingAvatarData = '';
        const container = document.getElementById('profile-avatar-display-container');
        if (container && currentUser) {
          container.innerHTML = `<div id="profile-avatar-initials-preview" style="font-size: 28px; font-weight: 700; color: white;">${(currentUser.username || 'MC').substring(0, 2).toUpperCase()}</div>`;
        }
      },
    });
  }
  window.handleRemoveAvatar = handleRemoveAvatar;

  function promptSaveProfileChanges() {
    const nameInput = document.getElementById('profile-display-name');
    const newName = nameInput ? nameInput.value.trim() : currentUser?.username;
    if (!newName) {
      alert('O nome de exibição não pode estar em branco.');
      return;
    }

    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: `Tem certeza de que deseja salvar as alterações do seu perfil com o nome <strong>${escapeHtml(newName)}</strong>?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        await executeSaveProfile();
      },
    });
  }
  window.promptSaveProfileChanges = promptSaveProfileChanges;

  function syncUserProfileAcrossApp() {
    if (!currentUser) return;

    // 1. User Panel at Bottom-left (photo / initials + username)
    updateUserPanel();

    // 2. Synchronize voiceStates in-memory array
    voiceStates.forEach((s) => {
      if (s.user && s.user.id === currentUser.id) {
        s.user.username = currentUser.username;
        s.user.avatar = currentUser.avatar;
      }
    });

    // 3. Synchronize activeStreams in-memory map
    if (activeStreams.has(currentUser.id)) {
      activeStreams.get(currentUser.id).username = currentUser.username;
    }
    if (activeStreams.has(`${currentUser.id}_cam`)) {
      activeStreams.get(`${currentUser.id}_cam`).username = `${currentUser.username} (Câmera)`;
    }

    // 4. Synchronize guildMembers in-memory list
    const memIdx = guildMembers.findIndex((m) => m.id === currentUser.id);
    if (memIdx >= 0) {
      guildMembers[memIdx].username = currentUser.username;
      guildMembers[memIdx].avatar = currentUser.avatar;
    }

    // 5. Re-render Voice Channels Sidebar (under voice channel name)
    renderVoiceUsers();

    // 6. Re-render Central Call Stage (square participant cards with avatar and username)
    renderVoiceCallStage();

    // 7. Re-render Video Streams (if any)
    renderVideoGrid();

    // 8. Re-render Server Members List (right sidebar)
    renderMembersList();

    // 9. Update Messages in main chat belonging to currentUser
    if (chatMessagesEl) {
      const messageItems = chatMessagesEl.querySelectorAll('.message-item');
      messageItems.forEach((el) => {
        if (el.getAttribute('data-author-id') === currentUser.id) {
          const nameEl = el.querySelector('.author-name');
          if (nameEl) nameEl.textContent = currentUser.username;
          const avatarWrap = el.querySelector('.message-avatar');
          if (avatarWrap) {
            if (currentUser.avatar) {
              avatarWrap.outerHTML = `<img src="${escapeHtml(currentUser.avatar)}" class="message-avatar" style="object-fit: cover; border-radius: 50%; width: 40px; height: 40px;" />`;
            } else {
              avatarWrap.outerHTML = `<div class="message-avatar">${(currentUser.username || '??').substring(0, 2).toUpperCase()}</div>`;
            }
          }
        }
      });
    }

    // 10. Update Voice Chat text messages if voice chat sidebar is open
    const voiceChatMsgs = document.getElementById('voice-chat-sidebar-messages');
    if (voiceChatMsgs) {
      const vItems = voiceChatMsgs.querySelectorAll('.voice-message-item');
      vItems.forEach((vItem) => {
        if (vItem.getAttribute('data-author-id') === currentUser.id) {
          const authorEl = vItem.querySelector('.message-author');
          if (authorEl) authorEl.textContent = currentUser.username;
          const avatarEl = vItem.querySelector('.message-avatar');
          if (avatarEl) {
            if (currentUser.avatar) {
              avatarEl.innerHTML = `<img src="${escapeHtml(currentUser.avatar)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" />`;
            } else {
              avatarEl.textContent = (currentUser.username || '??').substring(0, 2).toUpperCase();
            }
          }
        }
      });
    }

    // 11. Broadcast to Gateway via WebSocket so other peers update in real time
    if (socket && socket.connected) {
      socket.emit('user:update_profile', {
        userId: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
      });
    }
  }
  window.syncUserProfileAcrossApp = syncUserProfileAcrossApp;

  async function executeSaveProfile() {
    if (!currentUser) return;
    const nameInput = document.getElementById('profile-display-name');
    const pronounsInput = document.getElementById('profile-pronouns');
    const bioInput = document.getElementById('profile-bio');
    const bannerColorInput = document.getElementById('profile-banner-color');

    const newName = nameInput ? nameInput.value.trim() : currentUser.username;
    const newPronouns = pronounsInput ? pronounsInput.value.trim() : '';
    const newBio = bioInput ? bioInput.value.trim() : '';
    const newBannerColor = bannerColorInput ? bannerColorInput.value : '#5865f2';

    const avatarToSave = pendingAvatarData !== null ? (pendingAvatarData === '' ? null : pendingAvatarData) : currentUser.avatar;

    try {
      const res = await api('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          username: newName,
          avatar: avatarToSave,
        }),
      });
      if (res && res.username) {
        currentUser.username = res.username;
      } else {
        currentUser.username = newName;
      }
      if (res && res.avatar !== undefined) {
        currentUser.avatar = res.avatar;
      }
      pendingAvatarData = currentUser.avatar;
    } catch (err) {
      console.warn('Backend update notice:', err);
      currentUser.username = newName;
      currentUser.avatar = avatarToSave;
    }

    currentUser.pronouns = newPronouns;
    currentUser.bio = newBio;
    currentUser.bannerColor = newBannerColor;

    try {
      localStorage.setItem('discord_user', JSON.stringify(currentUser));
    } catch (e) {
      console.warn('LocalStorage save notice:', e);
    }

    // Synchronize across all components: voice sidebar, central call stage, member list, and user panel
    syncUserProfileAcrossApp();

    const saveStatus = document.getElementById('profile-save-status');
    if (saveStatus) {
      saveStatus.style.display = 'inline';
      setTimeout(() => {
        if (saveStatus) saveStatus.style.display = 'none';
      }, 3000);
    }
    showToastNotification('Perfil salvo com sucesso!');
  }
  window.executeSaveProfile = executeSaveProfile;

  function editUsernamePrompt() {
    openEditUsernameModal();
  }
  window.editUsernamePrompt = editUsernamePrompt;

  async function executeUpdateUsername(newName) {
    if (!currentUser) return;
    try {
      const res = await api('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ username: newName }),
      });
      if (res && res.username) {
        currentUser.username = res.username;
      } else {
        currentUser.username = newName;
      }
    } catch (err) {
      console.warn('Backend update notice:', err);
      currentUser.username = newName;
    }
    localStorage.setItem('discord_user', JSON.stringify(currentUser));

    // Synchronize across all components: voice sidebar, central call stage, member list, and user panel
    syncUserProfileAcrossApp();

    switchSettingsTab('my-account');
    showToastNotification('Nome de usuário alterado com sucesso!');
  }
  window.executeUpdateUsername = executeUpdateUsername;

  function promptChangePassword() {
    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: 'Você confirma que deseja solicitar o link de redefinição de senha para seu e-mail cadastrado?',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        showToastNotification('Instruções de redefinição de senha enviadas para seu e-mail!');
      },
    });
  }
  window.promptChangePassword = promptChangePassword;

  function promptDeactivateAccount() {
    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: 'Você confirma que deseja desativar sua conta temporariamente? Você poderá reativá-la quando quiser fazendo login.',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: () => {
        logout();
      },
    });
  }
  window.promptDeactivateAccount = promptDeactivateAccount;

  function promptDeleteAccount() {
    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: '<strong>ATENÇÃO:</strong> Esta ação é definitiva e irreversível! Todos os seus dados serão apagados permanentemente.<br><br>Tem certeza de que deseja excluir sua conta?',
      confirmText: 'Confirmar Exclusão',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: () => {
        logout();
      },
    });
  }
  window.promptDeleteAccount = promptDeleteAccount;

  function promptDisconnectSession() {
    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: 'Você confirma que deseja desconectar esta sessão ativa?',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: () => {
        switchSettingsTab('devices');
        showToastNotification('Sessão desconectada com sucesso!');
      },
    });
  }
  window.promptDisconnectSession = promptDisconnectSession;

  function promptDisconnectAllSessions() {
    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: 'Você confirma que deseja desconectar todas as outras sessões ativas desta conta em todos os dispositivos?',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: () => {
        switchSettingsTab('devices');
        showToastNotification('Todas as outras sessões foram desconectadas.');
      },
    });
  }
  window.promptDisconnectAllSessions = promptDisconnectAllSessions;

  function promptRevokeApp() {
    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: 'Você confirma que deseja revogar as permissões deste aplicativo autorizado?',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: () => {
        switchSettingsTab('authorized-apps');
        showToastNotification('Permissões do aplicativo revogadas com sucesso.');
      },
    });
  }
  window.promptRevokeApp = promptRevokeApp;

  function switchSettingsTab(tabKey) {
    if (tabKey === 'profiles') {
      pendingAvatarData = currentUser?.avatar || null;
    }
    if (tabKey === 'appearance') {
      pendingAppearanceTheme = currentTheme;
      pendingAppearanceAccent = currentAccentColor;
    }
    if (tabKey === 'language') {
      pendingLocale = currentLocale;
    }
    document.querySelectorAll('.settings-nav-item').forEach((el) => {
      if (el.getAttribute('data-tab') === tabKey) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    const pane = document.getElementById('settings-tab-pane');
    if (!pane) return;

    pane.innerHTML = renderSettingsTabContent(tabKey);

    if (tabKey === 'voice-video') {
      bindSettingsVoiceVideo();
    }
  }
  window.switchSettingsTab = switchSettingsTab;

  function renderSettingsTabContent(tabKey) {
    const username = escapeHtml(currentUser?.username || 'marcos.correa');
    const discriminator = escapeHtml(currentUser?.discriminator || '0000');
    const email = escapeHtml(currentUser?.email || 'marcos.correa@empresa.com');

    switch (tabKey) {
      case 'my-account':
        return `
          <div class="settings-pane-title">${t('myAccount.title')}</div>
          
          <div class="settings-card" style="padding-top: 0; overflow: hidden;">
            <div class="settings-profile-banner" style="${currentUser?.bannerColor ? `background: ${escapeHtml(currentUser.bannerColor)};` : ''}">
              <div class="settings-profile-avatar-wrapper" style="overflow: hidden; cursor: pointer;" onclick="switchSettingsTab('profiles')" title="${t('myAccount.editUserProfile')}">
                ${currentUser?.avatar ?
                  `<img src="${escapeHtml(currentUser.avatar)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />` :
                  username.substring(0, 2).toUpperCase()
                }
                <div class="status-dot ${userStatus}" style="width: 16px; height: 16px; border: 3px solid var(--bg-tertiary); bottom: 0; right: 0;"></div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
              <div>
                <div style="font-size: 20px; font-weight: 700; color: var(--text-header);">${username}</div>
                <div style="font-size: 13px; color: var(--text-muted);">#${discriminator}</div>
              </div>
              <button class="btn-primary" style="padding: 6px 14px; font-size: 13px;" onclick="switchSettingsTab('profiles')">
                ${t('myAccount.editUserProfile')}
              </button>
            </div>

            <div class="settings-user-info-row">
              <div>
                <div class="settings-info-label">${t('myAccount.username')}</div>
                <div class="settings-info-value">${username}#${discriminator}</div>
              </div>
              <button class="settings-btn-inline" onclick="openEditUsernameModal()">${t('common.edit')}</button>
            </div>

            <div class="settings-user-info-row">
              <div>
                <div class="settings-info-label">${t('myAccount.email')}</div>
                <div class="settings-info-value">${email}</div>
              </div>
              <button class="settings-btn-inline" onclick="alert('${t('myAccount.email')}: ' + '${email}')">${t('myAccount.reveal')}</button>
            </div>

            <div class="settings-user-info-row">
              <div>
                <div class="settings-info-label">${t('myAccount.phone')}</div>
                <div class="settings-info-value" style="color: var(--text-muted);">${t('myAccount.noPhone')}</div>
              </div>
              <button class="settings-btn-inline" onclick="alert('${t('myAccount.noPhone')}')">${t('myAccount.add')}</button>
            </div>
          </div>

          <div class="settings-section-subtitle">${t('myAccount.passwordAuth')}</div>
          <div class="settings-card">
            <button class="btn-primary" style="margin-bottom: 16px;" onclick="promptChangePassword()">${t('myAccount.changePassword')}</button>
            <div class="discord-toggle-row" style="border: none; padding: 0;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">${t('myAccount.twoFactor')}</div>
                <div class="discord-toggle-desc">${t('myAccount.twoFactorDesc')}</div>
              </div>
              <button class="settings-btn-inline" style="color: var(--green);" onclick="alert('${t('myAccount.enabled')}')">${t('myAccount.enabled')}</button>
            </div>
          </div>

          <div class="settings-section-subtitle">${t('myAccount.accountRemoval')}</div>
          <div class="settings-card" style="border: 1px solid rgba(242, 63, 66, 0.3);">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
              ${t('myAccount.accountRemovalDesc')}
            </div>
            <div style="display: flex; gap: 12px;">
              <button class="settings-btn-inline" style="background-color: var(--red); color: white;" onclick="promptDeactivateAccount()">${t('myAccount.deactivateAccount')}</button>
              <button class="settings-btn-inline" style="border: 1px solid var(--red); color: var(--red);" onclick="promptDeleteAccount()">${t('myAccount.deleteAccount')}</button>
            </div>
          </div>
        `;

      case 'profiles':
        return `
          <div class="settings-pane-title">${t('profiles.title')}</div>
          <div class="settings-section-subtitle">${t('profiles.subtitle')}</div>
          
          <div class="settings-card">
            <!-- AVATAR PHOTO & MOLD SECTION -->
            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label" style="margin-bottom: 8px;">${t('profiles.avatarLabel')}</label>
              <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">
                ${t('profiles.avatarDesc')}
              </div>

              <div style="display: flex; align-items: center; gap: 20px;">
                <!-- Circular Avatar Mold with Hover Effect -->
                <div class="avatar-mold-container" id="profile-avatar-mold-btn" onclick="triggerProfilePhotoUpload()" title="${t('profiles.choosePhoto')}">
                  <div id="profile-avatar-display-container" style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    ${currentUser?.avatar ? 
                      `<img src="${escapeHtml(currentUser.avatar)}" id="profile-avatar-img-preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" />` : 
                      `<div id="profile-avatar-initials-preview" style="font-size: 28px; font-weight: 700; color: white;">${username.substring(0, 2).toUpperCase()}</div>`
                    }
                  </div>
                  <!-- Camera Hover Overlay -->
                  <div class="avatar-mold-overlay">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/>
                      <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                    </svg>
                    <span class="avatar-mold-overlay-text">${t('profile.changeAvatar')}</span>
                  </div>
                </div>

                <!-- Hidden Native Windows File Input -->
                <input type="file" id="profile-avatar-file-input" accept="image/*" style="display: none;" onchange="handleProfileAvatarFileSelected(event)" />

                <!-- Action buttons beside the mold -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <button type="button" class="btn-primary" style="padding: 8px 16px; font-size: 13px; font-weight: 600;" onclick="triggerProfilePhotoUpload()">
                    ${t('profiles.choosePhoto')}
                  </button>
                  <button type="button" class="btn-secondary" style="padding: 6px 14px; font-size: 12px;" onclick="handleRemoveAvatar()">
                    ${t('profiles.removePhoto')}
                  </button>
                </div>
              </div>
            </div>

            <!-- Profile Info Fields -->
            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label">${t('profiles.displayName')}</label>
              <input type="text" class="form-input" id="profile-display-name" value="${username}" placeholder="${t('profiles.displayNamePlaceholder')}" onkeydown="if(event.key==='Enter') promptSaveProfileChanges()" />
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label">${t('profiles.pronouns')}</label>
              <input type="text" class="form-input" id="profile-pronouns" value="${escapeHtml(currentUser?.pronouns || '')}" placeholder="${t('profiles.pronounsPlaceholder')}" />
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label">${t('profiles.bio')}</label>
              <textarea class="form-input" id="profile-bio" rows="3" placeholder="${t('profiles.bioPlaceholder')}">${escapeHtml(currentUser?.bio || '')}</textarea>
            </div>

            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label">${t('profiles.bannerColor')}</label>
              <div style="display: flex; align-items: center; gap: 12px;">
                <input type="color" id="profile-banner-color" value="${escapeHtml(currentUser?.bannerColor || '#5865f2')}" style="border: none; width: 44px; height: 36px; border-radius: 4px; cursor: pointer; background: transparent;" />
                <span style="font-size: 13px; color: var(--text-muted);">${t('profiles.bannerColorDesc')}</span>
              </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: center;">
              <button class="btn-primary" style="padding: 10px 24px; font-size: 14px; font-weight: 700;" onclick="promptSaveProfileChanges()">
                ${t('profiles.saveChanges')}
              </button>
              <span id="profile-save-status" style="font-size: 13px; color: var(--green); display: none;">${t('profiles.savedSuccess')}</span>
            </div>
          </div>
        `;

      case 'privacy-safety':
        return `
          <div class="settings-pane-title">${t('settings.privacySafety')}</div>
          
          <div class="settings-section-subtitle">MENSAGENS DIRETAS SEGURAS</div>
          <div class="settings-card">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
              Analise automaticamente mensagens diretas para proteger sua conta contra spam e mídias indesejadas.
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 10px; background-color: var(--bg-secondary); border-radius: 6px;">
                <input type="radio" name="dm-filter" checked />
                <div>
                  <div style="font-size: 14px; font-weight: 600; color: var(--text-header);">🛡️ Mantenha-me em segurança</div>
                  <div style="font-size: 12px; color: var(--text-muted);">Verificar mensagens diretas de todos os usuários.</div>
                </div>
              </label>
              
              <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 10px; background-color: var(--bg-secondary); border-radius: 6px;">
                <input type="radio" name="dm-filter" />
                <div>
                  <div style="font-size: 14px; font-weight: 600; color: var(--text-header);">👥 Meus amigos são confiáveis</div>
                  <div style="font-size: 12px; color: var(--text-muted);">Verificar mensagens de todos, exceto de amigos adicionados.</div>
                </div>
              </label>
            </div>
          </div>

          <div class="settings-section-subtitle">QUEM PODE TE ENVIAR SOLICITAÇÕES DE AMIZADE</div>
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Todos</div>
                <div class="discord-toggle-desc">Qualquer pessoa na plataforma pode enviar pedidos de amizade.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Amigos de Amigos</div>
                <div class="discord-toggle-desc">Apenas conexões mútuas podem solicitar amizade.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Membros de Servidores</div>
                <div class="discord-toggle-desc">Usuários que compartilham servidores com você.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>
        `;

      case 'authorized-apps':
        return `
          <div class="settings-pane-title">${t('settings.authorizedApps')}</div>
          <div class="settings-section-subtitle">APLICAÇÕES OAUTH2 E BOTS CONECTADOS</div>
          
          <div class="settings-card">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #5865f2; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white;">ADM</div>
                <div>
                  <div style="font-size: 14px; font-weight: 600; color: var(--text-header);">System Admin Bot</div>
                  <div style="font-size: 12px; color: var(--text-muted);">Permissões: Conectar em voz, Transmitir áudio, Gerenciar presença</div>
                </div>
              </div>
              <button class="settings-btn-inline" style="color: var(--red);" onclick="promptRevokeApp()">Revogar</button>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #23a55a; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white;">API</div>
                <div>
                  <div style="font-size: 14px; font-weight: 600; color: var(--text-header);">SyncCord Webhook Integrator</div>
                  <div style="font-size: 12px; color: var(--text-muted);">Permissões: Enviar mensagens de status e chamadas</div>
                </div>
              </div>
              <button class="settings-btn-inline" style="color: var(--red);" onclick="promptRevokeApp()">Revogar</button>
            </div>
          </div>
        `;

      case 'devices':
        return `
          <div class="settings-pane-title">${t('settings.devices')}</div>
          <div class="settings-section-subtitle">SESSÕES ATIVAS CONECTADAS</div>
          
          <div class="settings-card">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-header);">💻 SyncCord Desktop (Windows 11)</div>
                <div style="font-size: 12px; color: var(--green); font-weight: 600; margin-top: 2px;">● Ativo agora (Sessão Atual)</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">IP: 127.0.0.1 • Cliente Rust Nativo (Wry / Tao)</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
              <div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-header);">🌐 Google Chrome / Web App</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Última sincronização há 18 minutos</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">São Paulo, Brasil • Navegador Web</div>
              </div>
              <button class="settings-btn-inline" onclick="promptDisconnectSession()">Desconectar</button>
            </div>
          </div>

          <button class="settings-btn-inline" style="background-color: var(--red); color: white;" onclick="promptDisconnectAllSessions()">
            Desconectar de todas as outras sessões
          </button>
        `;

      case 'connections':
        return `
          <div class="settings-pane-title">${t('settings.connections')}</div>
          <div class="settings-section-subtitle">VINCULE SUAS CONTAS AO PERFIL DO SYNCCORD</div>
          
          <div class="settings-card">
            <div class="connections-grid">
              <button class="connection-item-btn" onclick="window.alert('Conta Steam vinculada com sucesso!')">
                <span style="font-size: 20px;">🎮</span>
                <span>Steam</span>
              </button>
              <button class="connection-item-btn" onclick="window.alert('Conta Spotify vinculada com sucesso!')">
                <span style="font-size: 20px;">🎵</span>
                <span>Spotify</span>
              </button>
              <button class="connection-item-btn" onclick="window.alert('Conta GitHub vinculada com sucesso!')">
                <span style="font-size: 20px;">🐙</span>
                <span>GitHub</span>
              </button>
              <button class="connection-item-btn" onclick="window.alert('Conta YouTube vinculada com sucesso!')">
                <span style="font-size: 20px;">📺</span>
                <span>YouTube</span>
              </button>
              <button class="connection-item-btn" onclick="window.alert('Conta Twitch vinculada com sucesso!')">
                <span style="font-size: 20px;">🟣</span>
                <span>Twitch</span>
              </button>
              <button class="connection-item-btn" onclick="window.alert('Conta Xbox vinculada com sucesso!')">
                <span style="font-size: 20px;">🟩</span>
                <span>Xbox</span>
              </button>
              <button class="connection-item-btn" onclick="window.alert('Conta PlayStation vinculada com sucesso!')">
                <span style="font-size: 20px;">🟦</span>
                <span>PlayStation</span>
              </button>
              <button class="connection-item-btn" onclick="window.alert('Conta Reddit vinculada com sucesso!')">
                <span style="font-size: 20px;">🤖</span>
                <span>Reddit</span>
              </button>
              <button class="connection-item-btn" onclick="window.alert('Conta X (Twitter) vinculada com sucesso!')">
                <span style="font-size: 20px;">✖️</span>
                <span>X / Twitter</span>
              </button>
              <button class="connection-item-btn" onclick="window.alert('Conta Epic Games vinculada com sucesso!')">
                <span style="font-size: 20px;">🕹️</span>
                <span>Epic Games</span>
              </button>
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">
              As contas vinculadas podem exibir sua atividade, músicas e jogos em execução no seu cartão de perfil.
            </div>
          </div>
        `;

      case 'nitro':
      case 'server-boost':
      case 'subscriptions':
      case 'gift-inventory':
      case 'billing':
        return `
          <div class="settings-pane-title">SyncCord Nitro & Faturamento</div>
          
          <div class="settings-card" style="background: linear-gradient(135deg, rgba(138,35,135,0.4), rgba(233,64,87,0.4)); border: 1px solid rgba(233,64,87,0.6);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 22px; font-weight: 800; color: white;">SyncCord Nitro</div>
                <div style="font-size: 13px; color: #dbdee1; margin-top: 4px;">Desbloqueie benefícios premium em todos os servidores.</div>
              </div>
              <button class="btn-primary" style="background: #f27121; padding: 8px 18px; font-weight: 700;" onclick="window.alert('Simulação de Assinatura Nitro ativada!')">
                Assinar Nitro
              </button>
            </div>
          </div>

          <div class="settings-section-subtitle">VANTAGENS EXCLUSIVAS DO NITRO</div>
          <div class="settings-card">
            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
              <div style="display: flex; align-items: center; gap: 10px;">✨ <strong>Transmissão em Tela Cheia HD:</strong> Compartilhe telas em 1080p a 60 FPS ou 4K.</div>
              <div style="display: flex; align-items: center; gap: 10px;">📦 <strong>Upload de Arquivos Gigantes:</strong> Envie arquivos, vídeos e mídias de até 500 MB.</div>
              <div style="display: flex; align-items: center; gap: 10px;">🚀 <strong>2 Impulsos de Servidor:</strong> Aumente o nível do servidor da sua comunidade.</div>
              <div style="display: flex; align-items: center; gap: 10px;">🎨 <strong>Temas e Perfis Exclusivos:</strong> Cores customizadas e banners animados.</div>
            </div>
          </div>

          <div class="settings-section-subtitle">MÉTODOS DE PAGAMENTO E HISTÓRICO</div>
          <div class="settings-card">
            <div class="settings-user-info-row" style="margin-bottom: 0;">
              <div>
                <div class="settings-info-label">Método Padrão</div>
                <div class="settings-info-value">💳 Cartão de Crédito com final •••• 4242</div>
              </div>
              <button class="settings-btn-inline" onclick="window.alert('Gerenciar pagamentos')">Gerenciar</button>
            </div>
          </div>
        `;

      case 'appearance': {
        const themeList = [
          { id: 'dark', name: 'Escuro (Padrão)', previewClass: 'theme-preview-dark', previewText: 'Escuro' },
          { id: 'light', name: 'Claro', previewClass: 'theme-preview-light', previewText: 'Claro' },
          { id: 'midnight', name: 'Meia-noite (AMOLED)', previewClass: 'theme-preview-midnight', previewText: 'Meia-noite' },
          { id: 'navy', name: 'Azul Marinho', previewClass: 'theme-preview-navy', previewText: 'Marinho' },
          { id: 'ruby', name: 'Rubi', previewClass: 'theme-preview-ruby', previewText: 'Rubi' },
          { id: 'forest', name: 'Floresta', previewClass: 'theme-preview-forest', previewText: 'Floresta' },
        ];

        const accentList = [
          { color: '#5865f2', name: 'Blurple' },
          { color: '#23a55a', name: 'Esmeralda' },
          { color: '#f23f43', name: 'Coral' },
          { color: '#f0b232', name: 'Âmbar' },
          { color: '#00b0f4', name: 'Ciano' },
          { color: '#eb459e', name: 'Magenta' },
        ];

        const activeAccentObj = accentList.find((a) => a.color.toLowerCase() === pendingAppearanceAccent.toLowerCase());
        const activeAccentName = activeAccentObj ? activeAccentObj.name : 'Personalizada';

        return `
          <div class="settings-pane-title">${t('settings.appearance')}</div>
          
          <div class="settings-section-subtitle">TEMA DO APLICATIVO</div>
          <div class="theme-selector-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
            ${themeList.map((theme) => `
              <div class="theme-card ${pendingAppearanceTheme === theme.id ? 'active' : ''}" id="theme-card-${theme.id}" onclick="selectAppearanceTheme('${theme.id}')">
                <div class="theme-preview-box ${theme.previewClass}">${theme.previewText}</div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-header); margin-top: 8px;">${theme.name}</div>
              </div>
            `).join('')}
          </div>

          <div class="settings-section-subtitle">CORES DE DESTAQUE</div>
          <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 24px; padding: 14px 18px; background-color: var(--bg-secondary); border-radius: 8px;">
            ${accentList.map((a) => `
              <div class="accent-color-circle ${pendingAppearanceAccent.toLowerCase() === a.color.toLowerCase() ? 'active' : ''}" 
                   id="accent-circle-${a.name.toLowerCase()}" 
                   style="background-color: ${a.color};" 
                   title="${a.name} (${a.color})"
                   onclick="selectAccentColor('${a.color}')">
                ${pendingAppearanceAccent.toLowerCase() === a.color.toLowerCase() ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
              </div>
            `).join('')}
            <div style="font-size: 13px; color: var(--text-muted); margin-left: 8px;">
              Cor Selecionada: <strong id="current-accent-label" style="color: var(--text-header);">${activeAccentName}</strong>
            </div>
          </div>

          <div class="settings-section-subtitle">EXIBIÇÃO DE MENSAGENS</div>
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Modo Confortável</div>
                <div class="discord-toggle-desc">Visual moderno com avatares grandes e espaçamento agradável entre mensagens.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Modo Compacto</div>
                <div class="discord-toggle-desc">Acomoda mais mensagens na tela simultaneamente em formato condensado.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" id="toggle-compact-mode" onchange="toggleCompactMode(this.checked)" /><span class="discord-slider"></span></label>
            </div>
          </div>

          <div class="settings-section-subtitle">ESCALA DE FONTE DO CHAT</div>
          <div class="settings-card" style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 13px; color: var(--text-muted);">Tamanho do Texto</span>
              <span id="font-scale-indicator" style="font-weight: 700; color: var(--text-header);">15px</span>
            </div>
            <input type="range" min="12" max="20" value="15" style="width: 100%; accent-color: var(--accent);" oninput="document.getElementById('font-scale-indicator').textContent = this.value + 'px'; document.documentElement.style.fontSize = (this.value / 16 * 100) + '%';" />
          </div>

          <!-- BOTÃO SALVAR ALTERAÇÕES NA PARTE INFERIOR -->
          <div style="padding: 18px 24px; background-color: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; margin-top: 20px;">
            <div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-header);">Salvar Alterações de Aparência</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Persista sua escolha de temas e paleta de cores para sessões futuras.</div>
            </div>
            <button class="btn-primary" style="padding: 10px 26px; font-weight: 700; font-size: 14px; cursor: pointer;" onclick="promptSaveAppearanceSettings()">Salvar Alterações</button>
          </div>
        `;
      }

      case 'accessibility':
        return `
          <div class="settings-pane-title">${t('settings.accessibility')}</div>
          
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Reduzir Movimento</div>
                <div class="discord-toggle-desc">Reduz a intensidade das animações e transições na interface.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Reprodução Automática de GIFs</div>
                <div class="discord-toggle-desc">Executar animações de GIFs sem precisar clicar neles.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Reprodução Automática de Stickers</div>
                <div class="discord-toggle-desc">Animar figurinhas enviadas no chat automaticamente.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Leitor de Tela e Conversão de Texto em Fala (TTS)</div>
                <div class="discord-toggle-desc">Permite sintetizar mensagens com o comando /tts.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>
        `;

      case 'voice-video':
        return `
          <div class="settings-pane-title">${t('settings.voiceVideo')}</div>
          
          <div class="settings-section-subtitle">DISPOSITIVOS DE ÁUDIO</div>
          <div class="settings-card">
            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label">DISPOSITIVO DE ENTRADA (MICROFONE)</label>
              <select class="form-input" id="settings-audio-input-select"></select>
              <div style="margin-top: 8px;">
                <label style="font-size: 11px; color: var(--text-muted); font-weight: 600;">VOLUME DE ENTRADA</label>
                <input type="range" min="0" max="100" value="100" style="width: 100%; accent-color: var(--accent); margin-top: 4px;" />
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label">DISPOSITIVO DE SAÍDA (FONES / ALTO-FALANTES / BLUETOOTH)</label>
              <select class="form-input" id="settings-audio-output-select"></select>
              <div style="margin-top: 8px;">
                <label style="font-size: 11px; color: var(--text-muted); font-weight: 600;">VOLUME DE SAÍDA</label>
                <input type="range" min="0" max="100" value="100" style="width: 100%; accent-color: var(--accent); margin-top: 4px;" />
              </div>
            </div>

            <div class="device-test-container" style="margin-top: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 12px; font-weight: 700; color: var(--text-header);">TESTE DE MICROFONE</span>
                <button type="button" class="btn-secondary" id="settings-btn-test-mic" style="font-size: 12px; padding: 4px 10px;">
                  Testar Mic
                </button>
              </div>
              <div class="mic-meter-bar" style="height: 10px;">
                <div class="mic-meter-fill" id="settings-mic-meter-fill"></div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
              <button type="button" class="btn-secondary" id="settings-btn-test-speaker" style="font-size: 12px; padding: 6px 14px;">
                🔊 Testar Som de Saída
              </button>
              <span id="settings-speaker-status" style="font-size: 12px; color: var(--green); display: none;">Tocando som de teste...</span>
            </div>
          </div>

          <div class="settings-section-subtitle">MODO DE ENTRADA</div>
          <div class="settings-card">
            <div style="display: flex; gap: 20px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="input-mode" checked />
                <span style="font-size: 14px; font-weight: 600; color: var(--text-header);">Ativação por Voz</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="input-mode" />
                <span style="font-size: 14px; font-weight: 600; color: var(--text-header);">Pressionar para Falar (PTT)</span>
              </label>
            </div>
          </div>

          <div class="settings-section-subtitle">PROCESSAMENTO DE VOZ AVANÇADO</div>
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Supressão de Ruído Krisp</div>
                <div class="discord-toggle-desc">Filtro baseado em inteligência artificial para eliminar ruídos de fundo como teclado e vento.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Cancelamento de Eco</div>
                <div class="discord-toggle-desc">Impede que o áudio que sai do alto-falante seja recapturado pelo microfone.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Controle Automático de Ganho</div>
                <div class="discord-toggle-desc">Equaliza automaticamente o volume da sua fala para que todos ouçam com clareza.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>
        `;

      case 'text-images':
        return `
          <div class="settings-pane-title">${t('settings.textImages')}</div>
          
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Exibir Imagens e Mídias no Chat</div>
                <div class="discord-toggle-desc">Carrega imagens e vídeos enviados diretamente na conversa.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Converter Emoticons em Emojis</div>
                <div class="discord-toggle-desc">Converte caracteres como :) automaticamente para 🙂.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Prévia de Links da Web</div>
                <div class="discord-toggle-desc">Exibir cartões ricos com título, descrição e thumbnail ao colar links.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>
        `;

      case 'notifications':
        return `
          <div class="settings-pane-title">${t('settings.notifications')}</div>
          
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Notificações na Área de Trabalho</div>
                <div class="discord-toggle-desc">Exibir notificações nativas do Windows quando novas mensagens chegarem.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Sons de Mensagem</div>
                <div class="discord-toggle-desc">Tocar o som oficial do SyncCord quando uma mensagem for recebida.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Sons de Conexão em Voz</div>
                <div class="discord-toggle-desc">Tocar alertas sonoros quando membros entram ou saem da chamada.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Notificações Não Lidas na Barra de Tarefas</div>
                <div class="discord-toggle-desc">Pede atenção piscando o ícone do aplicativo quando houver menções.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>
        `;

      case 'keybinds':
        return `
          <div class="settings-pane-title">${t('settings.keybinds')}</div>
          <div class="settings-section-subtitle">ATALHOS GLOBAIS DO SYNCCORD</div>
          
          <div class="settings-card">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <span style="font-weight: 600; color: var(--text-header);">Ativar / Desativar Mudo do Microfone</span>
              <kbd style="background: #2b2d31; border: 1px solid #1e1f22; padding: 4px 10px; border-radius: 4px; font-weight: 700; color: white;">Ctrl + Shift + M</kbd>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <span style="font-weight: 600; color: var(--text-header);">Ativar / Desativar Áudio (Enfraquecer)</span>
              <kbd style="background: #2b2d31; border: 1px solid #1e1f22; padding: 4px 10px; border-radius: 4px; font-weight: 700; color: white;">Ctrl + Shift + D</kbd>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <span style="font-weight: 600; color: var(--text-header);">Pressionar para Falar (Push-to-Talk)</span>
              <kbd style="background: #2b2d31; border: 1px solid #1e1f22; padding: 4px 10px; border-radius: 4px; font-weight: 700; color: white;">Shift Direito</kbd>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0;">
              <span style="font-weight: 600; color: var(--text-header);">Abrir / Fechar Configurações</span>
              <kbd style="background: #2b2d31; border: 1px solid #1e1f22; padding: 4px 10px; border-radius: 4px; font-weight: 700; color: white;">ESC / Ctrl + ,</kbd>
            </div>
          </div>

          <button class="btn-primary" onclick="window.alert('Atalho customizado adicionado com sucesso!')">Adicionar Atalho</button>
        `;

      case 'language': {
        const localeKeys = ['pt-BR', 'en-US', 'es-ES', 'fr-FR'];
        const selectedKey = pendingLocale || currentLocale;

        return `
          <div class="settings-pane-title">${t('language.title')}</div>
          <div class="settings-section-subtitle">${t('language.subtitle')}</div>
          
          <div class="settings-card" style="margin-bottom: 24px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">
              ${localeKeys
                .map((loc) => {
                  const info = SUPPORTED_LOCALES[loc];
                  const isSelected = selectedKey === loc;
                  return `
                    <div onclick="selectLanguageOption('${loc}')" style="padding: 14px 16px; border-radius: 8px; background: ${isSelected ? 'rgba(88,101,242,0.18)' : 'var(--bg-secondary)'}; border: 1.5px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.06)'}; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.15s ease;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 22px;">${info.flag}</span>
                        <span style="font-size: 15px; font-weight: ${isSelected ? '700' : '600'}; color: ${isSelected ? '#fff' : 'var(--text-normal)'};">${info.name}</span>
                      </div>
                      <div style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${isSelected ? 'var(--accent)' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; background: ${isSelected ? 'var(--accent)' : 'transparent'};">
                        ${isSelected ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>

          <!-- Bottom Save Actions Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); padding: 14px 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); margin-top: 10px;">
            <div style="font-size: 13px; color: var(--text-muted);">
              ${selectedKey !== currentLocale
                ? `<span>${t('language.title')}: <strong style="color: #fff;">${SUPPORTED_LOCALES[selectedKey].name}</strong> (pendente)</span>`
                : `<span>${t('language.title')} ativo: <strong style="color: var(--green);">${SUPPORTED_LOCALES[currentLocale].name}</strong></span>`
              }
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
              ${selectedKey !== currentLocale ? `
                <button type="button" class="btn-secondary" style="padding: 8px 16px; font-size: 13px;" onclick="cancelLanguageSelection()">
                  ${t('common.cancel')}
                </button>
              ` : ''}
              <button type="button" class="btn-primary" style="padding: 8px 24px; font-size: 14px; font-weight: 700;" onclick="promptSaveLanguageChanges()">
                ${t('common.save')}
              </button>
            </div>
          </div>
        `;
      }

      case 'windows-settings':
        return `
          <div class="settings-pane-title">${t('settings.windowsSettings')}</div>
          <div class="settings-section-subtitle">COMPORTAMENTO DO APLICATIVO DO SISTEMA OPERACIONAL</div>
          
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Abrir SyncCord ao Inicializar</div>
                <div class="discord-toggle-desc">Inicia o aplicativo automaticamente assim que você faz login no Windows.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Iniciar Minimizado</div>
                <div class="discord-toggle-desc">Inicia silenciosamente na bandeja do sistema sem abrir a janela principal.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Minimizar para a Bandeja do Sistema</div>
                <div class="discord-toggle-desc">Ao clicar no botão fechar (X), mantém o SyncCord executando em segundo plano.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>
        `;

      case 'streamer-mode':
        return `
          <div class="settings-pane-title">${t('settings.streamerMode')}</div>
          
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Habilitar Modo Streamer Automaticamente</div>
                <div class="discord-toggle-desc">Detecta automaticamente softwares de streaming como OBS Studio e Streamlabs.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Ocultar Dados Pessoais</div>
                <div class="discord-toggle-desc">Protege e-mail, conexões, notas e tags de serem exibidos na live.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Ocultar Links de Convite de Servidores</div>
                <div class="discord-toggle-desc">Evita invasões de pessoas desconhecidas nos servidores em que você está.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>
        `;

      case 'advanced':
        return `
          <div class="settings-pane-title">${t('settings.advanced')}</div>
          
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Modo de Desenvolvedor</div>
                <div class="discord-toggle-desc">Expõe IDs de usuários, canais e mensagens no menu de contexto (clique com botão direito).</div>
              </div>
              <label class="discord-switch"><input type="checkbox" id="toggle-developer-mode" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Aceleração de Hardware por GPU</div>
                <div class="discord-toggle-desc">Utiliza a placa de vídeo do computador para acelerar a renderização do SyncCord.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Diagnósticos de Rede WebRTC</div>
                <div class="discord-toggle-desc">Gera logs detalhados de pacotes, jitter e ping em chamadas de voz.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>
        `;

      case 'activity-privacy':
      case 'registered-games':
        return `
          <div class="settings-pane-title">${t('settings.activityPrivacy')}</div>
          
          <div class="settings-card">
            <div class="discord-toggle-row">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Exibir Atividade em Execução no Status</div>
                <div class="discord-toggle-desc">Atualiza seu status automaticamente mostrando o jogo, código ou música que estiver aberta.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>

            <div class="discord-toggle-row" style="border: none;">
              <div class="discord-toggle-info">
                <div class="discord-toggle-title">Compartilhar Atividade na Chamada</div>
                <div class="discord-toggle-desc">Permite que outros participantes da call vejam o que você está jogando ou assistindo.</div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>

          <div class="settings-section-subtitle">JOGOS DETECTADOS NESTA MÁQUINA</div>
          <div class="settings-card">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">🎮</span>
                <div>
                  <div style="font-size: 14px; font-weight: 600; color: var(--text-header);">SyncCord Desktop Client</div>
                  <div style="font-size: 11px; color: var(--green);">Em execução agora</div>
                </div>
              </div>
              <span class="settings-badge-nitro" style="background: var(--green);">OVERLAY ATIVO</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">💻</span>
                <div>
                  <div style="font-size: 14px; font-weight: 600; color: var(--text-header);">Visual Studio Code</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Detectado no Windows</div>
                </div>
              </div>
              <label class="discord-switch"><input type="checkbox" checked /><span class="discord-slider"></span></label>
            </div>
          </div>
        `;

      default:
        return `<div class="settings-pane-title">Configurações</div>`;
    }
  }

  function selectLanguageOption(loc) {
    pendingLocale = loc;
    const pane = document.getElementById('settings-tab-pane');
    if (pane) pane.innerHTML = renderSettingsTabContent('language');
  }
  window.selectLanguageOption = selectLanguageOption;

  function cancelLanguageSelection() {
    pendingLocale = currentLocale;
    const pane = document.getElementById('settings-tab-pane');
    if (pane) pane.innerHTML = renderSettingsTabContent('language');
  }
  window.cancelLanguageSelection = cancelLanguageSelection;

  function promptSaveLanguageChanges() {
    const targetLoc = pendingLocale || currentLocale;
    const langInfo = SUPPORTED_LOCALES[targetLoc] || SUPPORTED_LOCALES['pt-BR'];

    showConfirmDialog({
      title: t('common.areYouSure'),
      message: t('language.confirmMessage', { lang: langInfo.name }),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        await loadTranslations(targetLoc);
        pendingLocale = targetLoc;
        localStorage.setItem('discord_locale', targetLoc);

        if (currentUser) {
          currentUser.locale = targetLoc;
          try {
            localStorage.setItem('discord_user', JSON.stringify(currentUser));
          } catch (e) {
            console.warn('Storage save notice:', e);
          }
        }

        const pane = document.getElementById('settings-tab-pane');
        if (pane) pane.innerHTML = renderSettingsTabContent('language');

        showToastNotification(t('language.saved', { lang: langInfo.name }));
      },
    });
  }
  window.promptSaveLanguageChanges = promptSaveLanguageChanges;

  function bindSettingsVoiceVideo() {
    const inputSelect = document.getElementById('settings-audio-input-select');
    const outputSelect = document.getElementById('settings-audio-output-select');
    const testMicBtn = document.getElementById('settings-btn-test-mic');
    const testSpeakerBtn = document.getElementById('settings-btn-test-speaker');
    const speakerStatus = document.getElementById('settings-speaker-status');
    const meterFill = document.getElementById('settings-mic-meter-fill');

    if (inputSelect && audioInputSelectEl) {
      inputSelect.innerHTML = audioInputSelectEl.innerHTML;
      inputSelect.value = selectedAudioInputId;
      inputSelect.onchange = (e) => switchAudioInput(e.target.value);
    }
    if (outputSelect && audioOutputSelectEl) {
      outputSelect.innerHTML = audioOutputSelectEl.innerHTML;
      outputSelect.value = selectedAudioOutputId;
      outputSelect.onchange = (e) => switchAudioOutput(e.target.value);
    }
    if (testSpeakerBtn) {
      testSpeakerBtn.onclick = () => {
        testSpeakerSound();
        if (speakerStatus) {
          speakerStatus.style.display = 'inline';
          setTimeout(() => { speakerStatus.style.display = 'none'; }, 2000);
        }
      };
    }
    if (testMicBtn) {
      testMicBtn.onclick = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedAudioInputId } });
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const src = ctx.createMediaStreamSource(stream);
          const an = ctx.createAnalyser();
          an.fftSize = 64;
          src.connect(an);
          const data = new Uint8Array(an.frequencyBinCount);
          let running = true;
          testMicBtn.textContent = 'Parar Teste';
          const update = () => {
            if (!running) return;
            an.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            if (meterFill) meterFill.style.width = Math.min(100, (avg / 128) * 100) + '%';
            window.requestAnimationFrame(update);
          };
          update();
          testMicBtn.onclick = () => {
            running = false;
            stream.getTracks().forEach((t) => t.stop());
            ctx.close();
            testMicBtn.textContent = 'Testar Mic';
            if (meterFill) meterFill.style.width = '0%';
            bindSettingsVoiceVideo();
          };
        } catch (err) {
          window.alert('Erro ao testar microfone: ' + err.message);
        }
      };
    }
  }

  function selectAppearanceTheme(theme) {
    pendingAppearanceTheme = theme;
    document.querySelectorAll('.theme-card').forEach((el) => el.classList.remove('active'));
    const card = document.getElementById(`theme-card-${theme}`);
    if (card) card.classList.add('active');
  }
  window.selectAppearanceTheme = selectAppearanceTheme;

  function selectAccentColor(color) {
    pendingAppearanceAccent = color;
    const accents = [
      { color: '#5865f2', name: 'Blurple' },
      { color: '#23a55a', name: 'Esmeralda' },
      { color: '#f23f43', name: 'Coral' },
      { color: '#f0b232', name: 'Âmbar' },
      { color: '#00b0f4', name: 'Ciano' },
      { color: '#eb459e', name: 'Magenta' },
    ];
    accents.forEach((a) => {
      const circle = document.getElementById(`accent-circle-${a.name.toLowerCase()}`);
      if (circle) {
        if (a.color.toLowerCase() === color.toLowerCase()) {
          circle.classList.add('active');
          circle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        } else {
          circle.classList.remove('active');
          circle.innerHTML = '';
        }
      }
    });
    const label = document.getElementById('current-accent-label');
    if (label) {
      label.textContent = accents.find((a) => a.color.toLowerCase() === color.toLowerCase())?.name || color;
    }
  }
  window.selectAccentColor = selectAccentColor;

  function applyAppearanceSettings(theme, accent) {
    currentTheme = theme || 'dark';
    currentAccentColor = accent || '#5865f2';
    pendingAppearanceTheme = currentTheme;
    pendingAppearanceAccent = currentAccentColor;

    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);
    document.documentElement.style.setProperty('--accent', currentAccentColor);
    document.documentElement.style.setProperty('--accent-hover', adjustColorBrightness(currentAccentColor, -15));
  }
  window.applyAppearanceSettings = applyAppearanceSettings;

  function adjustColorBrightness(hex, percent) {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00ff) + percent;
    let b = (num & 0x0000ff) + percent;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return '#' + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
  }

  function promptSaveAppearanceSettings() {
    const themeNames = {
      dark: 'Escuro',
      light: 'Claro',
      midnight: 'Meia-noite (AMOLED)',
      navy: 'Azul Marinho',
      ruby: 'Rubi',
      forest: 'Floresta',
    };
    const tName = themeNames[pendingAppearanceTheme] || pendingAppearanceTheme;

    showConfirmDialog({
      title: 'Tem certeza disso?',
      message: `Deseja salvar e aplicar o tema <strong>${escapeHtml(tName)}</strong> com a cor de destaque selecionada?`,
      confirmText: 'Salvar Alterações',
      cancelText: 'Cancelar',
      onConfirm: () => {
        applyAppearanceSettings(pendingAppearanceTheme, pendingAppearanceAccent);
        localStorage.setItem(
          'discord_appearance_settings',
          JSON.stringify({
            theme: pendingAppearanceTheme,
            accent: pendingAppearanceAccent,
          }),
        );
        localStorage.setItem('discord_theme', pendingAppearanceTheme);
        showToastNotification('Configurações de aparência salvas e persistidas com sucesso!');
      },
    });
  }
  window.promptSaveAppearanceSettings = promptSaveAppearanceSettings;

  function applySettingsTheme(theme) {
    selectAppearanceTheme(theme);
  }
  window.applySettingsTheme = applySettingsTheme;

  function toggleCompactMode(isCompact) {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
      chatMessages.classList.toggle('compact', isCompact);
    }
  }
  window.toggleCompactMode = toggleCompactMode;

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('open');
      if (id === 'forgot-password-modal' || id === 'reset-password-modal') {
        el.style.display = 'none';
      }
    }
    if (id === 'create-guild-modal') {
      handleRemoveGuildIcon();
    }
  }
  window.closeModal = closeModal;

  // Password Reset Functions (Bug 4)
  function openForgotPasswordModal() {
    showAuthModal(false);
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('open');
      const emailInput = document.getElementById('forgot-password-email');
      const authEmail = document.getElementById('auth-email');
      if (emailInput && authEmail && authEmail.value) {
        emailInput.value = authEmail.value;
      }
      const feedback = document.getElementById('forgot-password-feedback');
      if (feedback) feedback.style.display = 'none';
    }
  }
  window.openForgotPasswordModal = openForgotPasswordModal;

  async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('forgot-password-email');
    const submitBtn = document.getElementById('forgot-password-submit-btn');
    const feedback = document.getElementById('forgot-password-feedback');
    if (!emailInput || !emailInput.value) return;

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }
      const res = await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: emailInput.value.trim() }),
      });

      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(35, 165, 90, 0.15)';
        feedback.style.border = '1px solid #23a55a';
        feedback.style.color = '#23a55a';
        feedback.innerHTML = `<strong>Sucesso:</strong> ${res.message || 'Instruções enviadas!'}${res.token ? `<br><br><button type="button" class="btn-primary" style="margin-top: 6px; padding: 6px 14px; font-size: 13px;" onclick="openResetPasswordModal('${res.token}')">Abrir Tela de Redefinição Agora</button>` : ''}`;
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(242, 63, 67, 0.15)';
        feedback.style.border = '1px solid #f23f43';
        feedback.style.color = '#f23f43';
        feedback.textContent = err.message || 'Falha ao solicitar redefinição.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar Link';
      }
    }
  }
  window.handleForgotPasswordSubmit = handleForgotPasswordSubmit;

  function openResetPasswordModal(tokenVal) {
    closeModal('forgot-password-modal');
    showAuthModal(false);
    const modal = document.getElementById('reset-password-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('open');
      const tokenInput = document.getElementById('reset-password-token');
      if (tokenInput) tokenInput.value = tokenVal || '';
      const feedback = document.getElementById('reset-password-feedback');
      if (feedback) feedback.style.display = 'none';
      const pw1 = document.getElementById('reset-new-password');
      const pw2 = document.getElementById('reset-confirm-password');
      if (pw1) pw1.value = '';
      if (pw2) pw2.value = '';
    }
  }
  window.openResetPasswordModal = openResetPasswordModal;

  async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    const tokenInput = document.getElementById('reset-password-token');
    const pw1 = document.getElementById('reset-new-password');
    const pw2 = document.getElementById('reset-confirm-password');
    const submitBtn = document.getElementById('reset-password-submit-btn');
    const feedback = document.getElementById('reset-password-feedback');

    const tokenVal = (tokenInput?.value || '').trim();
    const val1 = pw1?.value || '';
    const val2 = pw2?.value || '';

    if (!tokenVal) {
      alert('Token de redefinição não encontrado. Solicite um novo link.');
      return;
    }

    if (val1.length < 6) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(242, 63, 67, 0.15)';
        feedback.style.border = '1px solid #f23f43';
        feedback.style.color = '#f23f43';
        feedback.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
      }
      return;
    }

    if (val1 !== val2) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(242, 63, 67, 0.15)';
        feedback.style.border = '1px solid #f23f43';
        feedback.style.color = '#f23f43';
        feedback.textContent = 'As senhas não coincidem. Digite novamente.';
      }
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Atualizando...';
      }
      const res = await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: tokenVal, password: val1 }),
      });

      alert(res.message || 'Senha alterada com sucesso! Faça login com sua nova senha.');
      closeModal('reset-password-modal');
      // Clean query params from URL
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
      showAuthModal(true);
      if (typeof window.setAuthTab === 'function') {
        window.setAuthTab('login');
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(242, 63, 67, 0.15)';
        feedback.style.border = '1px solid #f23f43';
        feedback.style.color = '#f23f43';
        feedback.textContent = err.message || 'Erro ao redefinir senha.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar Nova Senha';
      }
    }
  }
  window.handleResetPasswordSubmit = handleResetPasswordSubmit;

  function togglePasswordVisibility(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  }
  window.togglePasswordVisibility = togglePasswordVisibility;

  window.logout = logout;

  function scrollToBottom() {
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function getInitials(str) {
    return str.split(' ').map((n) => n[0]).join('').substring(0, 3).toUpperCase();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function openDownloadModal() {
    const modal = document.getElementById('download-desktop-modal');
    if (modal) {
      modal.classList.add('open');
      const statusEl = document.getElementById('download-progress-status');
      if (statusEl) statusEl.style.display = 'none';
    }
  }
  window.openDownloadModal = openDownloadModal;

  function handleDownloadStarted() {
    const statusEl = document.getElementById('download-progress-status');
    if (statusEl) {
      statusEl.style.display = 'flex';
    }
  }
  window.handleDownloadStarted = handleDownloadStarted;

  window.addEventListener('DOMContentLoaded', init);
})();
