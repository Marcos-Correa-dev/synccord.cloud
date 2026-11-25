#![windows_subsystem = "windows"]

use single_instance::SingleInstance;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    platform::windows::{IconExtWindows, WindowBuilderExtWindows},
    window::WindowBuilder,
};
use tray_icon::{
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    MouseButton, TrayIconBuilder, TrayIconEvent,
};
use wry::{
    PermissionKind, PermissionResponse, WebContext, WebViewBuilder, WebViewBuilderExtWindows,
};

#[link(name = "user32")]
extern "system" {
    fn FindWindowW(lp_class_name: *const u16, lp_window_name: *const u16) -> isize;
    fn ShowWindow(hwnd: isize, n_cmd_show: i32) -> i32;
    fn SetForegroundWindow(hwnd: isize) -> i32;
}

#[link(name = "shell32")]
extern "system" {
    fn SetCurrentProcessExplicitAppUserModelID(AppID: *const u16) -> i32;
}

/// Custom internal events sent to the Tao EventLoop
#[derive(Debug, Clone)]
enum AppEvent {
    UpdateTitle(String),
    SyncVoiceState {
        is_muted: bool,
        is_deafened: bool,
        channel_name: String,
    },
    RestoreWindow,
    Quit,
}

/// Restores an existing SyncCord window from tray or minimized state
fn restore_existing_window() {
    let wide_title: Vec<u16> = "SyncCord\0".encode_utf16().collect();
    unsafe {
        let hwnd = FindWindowW(std::ptr::null(), wide_title.as_ptr());
        if hwnd != 0 {
            const SW_RESTORE: i32 = 9;
            ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
        }
    }
}

/// Generates RGBA icon for SyncCord with purple gradient (#6e7bff to #5865F2) and SCD logo
fn create_discord_icon_rgba(size: u32) -> (Vec<u8>, u32, u32) {
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let radius = (size as f32 * 0.22) as i32;
    let s = size as i32;

    for y in 0..s {
        for x in 0..s {
            let idx = ((y * s + x) * 4) as usize;

            let dx = if x < radius {
                radius - x
            } else if x >= s - radius {
                x - (s - radius - 1)
            } else {
                0
            };

            let dy = if y < radius {
                radius - y
            } else if y >= s - radius {
                y - (s - radius - 1)
            } else {
                0
            };

            let dist_sq = dx * dx + dy * dy;
            if dist_sq <= radius * radius {
                // Purple Gradient: #6e7bff (top-left) to #5865F2 (bottom-right)
                let factor = ((x + y) as f32 / (2.0 * size as f32)).clamp(0.0, 1.0);
                let r = (110.0 + factor * (88.0 - 110.0)) as u8;
                let g = (123.0 + factor * (101.0 - 123.0)) as u8;
                let b = (255.0 + factor * (242.0 - 255.0)) as u8;

                rgba[idx] = r;
                rgba[idx + 1] = g;
                rgba[idx + 2] = b;
                rgba[idx + 3] = 255;

                // Scale letter positions relative to 32px baseline
                let scale = size as f32 / 32.0;
                let sx = x as f32 / scale;
                let sy = y as f32 / scale;

                // Letter 'S' (sx: 6..=11, sy: 10..=21)
                let is_s_top = (6.0..=11.0).contains(&sx) && (10.0..=12.5).contains(&sy);
                let is_s_left_top = (6.0..=8.0).contains(&sx) && (12.0..=16.0).contains(&sy);
                let is_s_mid = (6.0..=11.0).contains(&sx) && (15.0..=17.0).contains(&sy);
                let is_s_right_bot = (9.0..=11.0).contains(&sx) && (16.0..=20.0).contains(&sy);
                let is_s_bot = (6.0..=11.0).contains(&sx) && (19.0..=21.0).contains(&sy);

                // Letter 'C' (sx: 14..=19, sy: 10..=21)
                let is_c_left = (14.0..=16.0).contains(&sx) && (10.0..=21.0).contains(&sy);
                let is_c_top = (14.0..=19.0).contains(&sx) && (10.0..=12.5).contains(&sy);
                let is_c_bot = (14.0..=19.0).contains(&sx) && (19.0..=21.0).contains(&sy);

                // Letter 'D' (sx: 22..=26, sy: 10..=21)
                let is_d_left = (22.0..=24.0).contains(&sx) && (10.0..=21.0).contains(&sy);
                let is_d_top = (22.0..=25.0).contains(&sx) && (10.0..=12.5).contains(&sy);
                let is_d_bot = (22.0..=25.0).contains(&sx) && (19.0..=21.0).contains(&sy);
                let is_d_right = (25.0..=26.5).contains(&sx) && (12.5..=18.5).contains(&sy);

                if is_s_top
                    || is_s_left_top
                    || is_s_mid
                    || is_s_right_bot
                    || is_s_bot
                    || is_c_left
                    || is_c_top
                    || is_c_bot
                    || is_d_left
                    || is_d_top
                    || is_d_bot
                    || is_d_right
                {
                    rgba[idx] = 255;
                    rgba[idx + 1] = 255;
                    rgba[idx + 2] = 255;
                }
            } else {
                rgba[idx + 3] = 0;
            }
        }
    }

    (rgba, size, size)
}

/// Determines the starting SyncCord target URL with smart fallback
fn resolve_target_url() -> String {
    // 1. Explicit CLI argument: synccord-desktop.exe http://localhost:3000
    if let Some(arg) = std::env::args().nth(1) {
        if !arg.trim().is_empty() {
            return arg.trim().to_string();
        }
    }

    // 2. Explicit environment variables
    if let Ok(url) = std::env::var("SYNCCORD_URL") {
        if !url.trim().is_empty() {
            return url.trim().to_string();
        }
    }
    if let Ok(url) = std::env::var("DISCORD_URL") {
        if !url.trim().is_empty() {
            return url.trim().to_string();
        }
    }

    // 3. Check if local development server is active on 127.0.0.1:3000
    if let Ok(addr) = "127.0.0.1:3000".parse() {
        if std::net::TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(150)).is_ok()
        {
            println!("[SyncCord Desktop] Servidor local detectado em 127.0.0.1:3000");
            return "http://localhost:3000".to_string();
        }
    }

    // 4. Production Cloud URL
    "https://synccord.cloud".to_string()
}

fn main() {
    // Register explicit Windows Application User Model ID for the Taskbar group and icon
    let app_id: Vec<u16> = "SyncCord.Desktop.App\0".encode_utf16().collect();
    unsafe {
        let _ = SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr());
    }

    // Single instance protection: ensure only one SyncCord desktop client runs at a time
    let instance = SingleInstance::new("synccord_desktop_app_mutex")
        .expect("Failed to create single-instance mutex");

    if !instance.is_single() {
        println!("[SyncCord Desktop] Outra instância do aplicativo já está em execução. Restaurando janela existente...");
        restore_existing_window();
        return;
    }

    // Dedicated WebView2 User Data Directory in %LOCALAPPDATA%\SyncCord\WebView2
    // Ensures logins, tokens, localStorage, cookies, and audio devices are permanently preserved
    let local_app_data = std::env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Local".to_string());
    let data_dir = PathBuf::from(local_app_data).join("SyncCord").join("WebView2");
    let _ = std::fs::create_dir_all(&data_dir);
    let mut web_context = WebContext::new(Some(data_dir));

    let event_loop = EventLoopBuilder::<AppEvent>::with_user_event().build();
    let event_proxy = event_loop.create_proxy();

    // Prepare SyncCord icons for Window, Taskbar and System Tray
    let (icon_rgba_64, icon_w_64, icon_h_64) = create_discord_icon_rgba(64);
    let fallback_icon_64 = tao::window::Icon::from_rgba(icon_rgba_64, icon_w_64, icon_h_64).ok();

    let (icon_rgba_32, icon_w_32, icon_h_32) = create_discord_icon_rgba(32);
    let fallback_icon_32 = tao::window::Icon::from_rgba(icon_rgba_32.clone(), icon_w_32, icon_h_32).ok();

    // Load icons from the embedded PE resource (ordinal 1) compiled via rc.exe
    // Ordinal 1 is the default icon resource embedded in the .exe
    let window_icon = tao::window::Icon::from_resource(1, Some(tao::dpi::PhysicalSize::new(32, 32)))
        .ok()
        .or(fallback_icon_32);

    let taskbar_icon = tao::window::Icon::from_resource(1, Some(tao::dpi::PhysicalSize::new(256, 256)))
        .ok()
        .or(fallback_icon_64);

    let tray_icon_data = tray_icon::Icon::from_rgba(icon_rgba_32, icon_w_32, icon_h_32)
        .expect("Failed to initialize tray icon bytes");

    // Build the native desktop window matching Discord's default dimensions and taskbar icon
    let window = WindowBuilder::new()
        .with_title("SyncCord")
        .with_inner_size(LogicalSize::new(1280.0, 720.0))
        .with_min_inner_size(LogicalSize::new(940.0, 500.0))
        .with_window_icon(window_icon)
        .with_taskbar_icon(taskbar_icon)
        .build(&event_loop)
        .expect("Failed to build desktop window");

    let synccord_url = resolve_target_url();

    // Native Windows System Tray Menu
    let tray_menu = Menu::new();
    let open_item = MenuItem::new("Abrir SyncCord", true, None);
    let sep1 = PredefinedMenuItem::separator();
    let mute_item = CheckMenuItem::new("Desativar Microfone", true, false, None);
    let deafen_item = CheckMenuItem::new("Desativar Áudio", true, false, None);
    let krisp_item = CheckMenuItem::new("Supressão de Ruído Krisp", true, true, None);
    let voice_iso_item = CheckMenuItem::new("Flag: Isolamento de Voz", true, true, None);
    let sep2 = PredefinedMenuItem::separator();
    let reload_item = MenuItem::new("Recarregar Aplicativo (F5)", true, None);
    let sep3 = PredefinedMenuItem::separator();
    let quit_item = MenuItem::new("Sair do SyncCord", true, None);

    let _ = tray_menu.append_items(&[
        &open_item,
        &sep1,
        &mute_item,
        &deafen_item,
        &krisp_item,
        &voice_iso_item,
        &sep2,
        &reload_item,
        &sep3,
        &quit_item,
    ]);

    let version_tooltip = format!("SyncCord v{} (Rust Native)", env!("CARGO_PKG_VERSION"));
    let tray_icon = TrayIconBuilder::new()
        .with_menu(Box::new(tray_menu))
        .with_tooltip(&version_tooltip)
        .with_icon(tray_icon_data)
        .build()
        .expect("Failed to initialize system tray");

    // Initialization script injected into every frame
    let init_script = r#"
        window.__IS_NATIVE_DESKTOP__ = true;
        window.__DESKTOP_PLATFORM__ = 'rust-wry';
        window.__DESKTOP_VERSION__ = '0.1.21';
        console.log('[SyncCord Desktop v0.1.21] Rust native client initialized (Wry / Tao / WebView2).');

        // Bidirectional IPC Bridge to Rust Native Host
        window.__desktopNotify = function(type, payload) {
            try {
                if (window.ipc && typeof window.ipc.postMessage === 'function') {
                    if (type === 'voice') {
                        const m = payload.isMuted ? '1' : '0';
                        const d = payload.isDeaf ? '1' : '0';
                        const ch = encodeURIComponent(payload.channelName || '');
                        window.ipc.postMessage('voice:muted:' + m + ',deaf:' + d + ',ch:' + ch);
                    } else if (type === 'title') {
                        window.ipc.postMessage('title:' + payload);
                    } else if (type === 'restore') {
                        window.ipc.postMessage('restore');
                    } else if (type === 'quit') {
                        window.ipc.postMessage('quit');
                    }
                }
            } catch (err) {
                console.warn('[SyncCord Desktop IPC] Error posting message:', err);
            }
        };

        // Desktop Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // F5 or Ctrl+R: Reload
            if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
                e.preventDefault();
                window.location.reload();
            }
            // F11: Fullscreen toggle
            if (e.key === 'F11') {
                e.preventDefault();
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            }
        });

        // Prevent unwanted navigation when dropping files outside drop zones
        window.addEventListener('dragover', (e) => e.preventDefault(), false);
        window.addEventListener('drop', (e) => {
            if (!e.target.closest('input[type="file"]') && !e.target.closest('.chat-input-wrapper')) {
                e.preventDefault();
            }
        }, false);
    "#;

    // Chromium command line flags for WebView2:
    // Enables WebRTC screensharing, audio sink selection (headphones/bluetooth/speakers),
    // hardware-accelerated WebGL for 3D Three.js experiences, and unrestricted audio autoplay
    let browser_args = "--enable-features=WebRTCPipeWireCapturer,MediaStreamTrackSetSinkId \
                        --autoplay-policy=no-user-gesture-required \
                        --enable-usermedia-screen-capturing \
                        --allow-http-screen-capture \
                        --ignore-gpu-blocklist \
                        --enable-gpu-rasterization \
                        --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

    let proxy_ipc = event_proxy.clone();
    let proxy_title = event_proxy.clone();

    let webview = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_url(&synccord_url)
        .with_devtools(true)
        .with_autoplay(true)
        .with_browser_accelerator_keys(true)
        .with_additional_browser_args(browser_args)
        // Automatically grant all media & usability permissions:
        // Microphone, Camera, Screen Sharing (DisplayCapture), Audio, Notifications, Clipboard
        .with_permission_handler(|kind| {
            match kind {
                PermissionKind::Microphone
                | PermissionKind::Camera
                | PermissionKind::DisplayCapture
                | PermissionKind::Notifications
                | PermissionKind::ClipboardRead
                | PermissionKind::Autoplay
                | PermissionKind::FileSystemAccess
                | PermissionKind::AutomaticDownloads => PermissionResponse::Allow,
                _ => PermissionResponse::Allow,
            }
        })
        .with_ipc_handler(move |request| {
            let msg = request.body();
            if msg == "voice:join" {
                println!("[SyncCord Desktop Audio] Usuário conectou ao canal de voz");
            } else if msg == "voice:leave" {
                println!("[SyncCord Desktop Audio] Usuário desconectou do canal de voz");
            } else if let Some(rest) = msg.strip_prefix("title:") {
                let _ = proxy_ipc.send_event(AppEvent::UpdateTitle(rest.to_string()));
            } else if let Some(rest) = msg.strip_prefix("voice:") {
                let mut is_muted = false;
                let mut is_deaf = false;
                let mut ch_name = String::new();
                for part in rest.split(',') {
                    if let Some(val) = part.strip_prefix("muted:") {
                        is_muted = val == "1";
                    } else if let Some(val) = part.strip_prefix("deaf:") {
                        is_deaf = val == "1";
                    } else if let Some(val) = part.strip_prefix("ch:") {
                        ch_name = val.to_string();
                    }
                }
                let _ = proxy_ipc.send_event(AppEvent::SyncVoiceState {
                    is_muted,
                    is_deafened: is_deaf,
                    channel_name: ch_name,
                });
            } else if msg == "restore" {
                let _ = proxy_ipc.send_event(AppEvent::RestoreWindow);
            } else if msg == "quit" {
                let _ = proxy_ipc.send_event(AppEvent::Quit);
            }
        })
        .with_document_title_changed_handler(move |title| {
            let _ = proxy_title.send_event(AppEvent::UpdateTitle(title));
        })
        .with_initialization_script(init_script)
        .build(&window)
        .expect("Failed to initialize WebView2");

    let is_quitting = Arc::new(AtomicBool::new(false));
    let is_quitting_clone = is_quitting.clone();

    let menu_channel = MenuEvent::receiver();
    let tray_channel = TrayIconEvent::receiver();

    println!("[SyncCord Desktop] Cliente nativo em Rust inicializado com sucesso.");
    println!("[SyncCord Desktop] Carregando: {}", synccord_url);

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        // Process Custom Application Events (IPC & Title sync)
        if let Event::UserEvent(app_event) = &event {
            match app_event {
                AppEvent::UpdateTitle(new_title) => {
                    let formatted = if new_title.contains("SyncCord") {
                        new_title.clone()
                    } else if new_title.trim().is_empty() {
                        "SyncCord".to_string()
                    } else {
                        format!("{} - SyncCord", new_title)
                    };
                    window.set_title(&formatted);
                }
                AppEvent::SyncVoiceState {
                    is_muted,
                    is_deafened,
                    channel_name,
                } => {
                    mute_item.set_checked(*is_muted);
                    deafen_item.set_checked(*is_deafened);
                    let tip = if channel_name.is_empty() {
                        format!("SyncCord v{} (Rust Native)", env!("CARGO_PKG_VERSION"))
                    } else {
                        format!("SyncCord v{} - Conectado: {}", env!("CARGO_PKG_VERSION"), channel_name)
                    };
                    let _ = tray_icon.set_tooltip(Some(tip));
                }
                AppEvent::RestoreWindow => {
                    window.set_visible(true);
                    window.set_focus();
                }
                AppEvent::Quit => {
                    is_quitting_clone.store(true, Ordering::SeqCst);
                    *control_flow = ControlFlow::Exit;
                }
            }
        }

        // Process Tray Menu actions
        if let Ok(menu_event) = menu_channel.try_recv() {
            if menu_event.id == quit_item.id() {
                is_quitting_clone.store(true, Ordering::SeqCst);
                *control_flow = ControlFlow::Exit;
            } else if menu_event.id == open_item.id() {
                window.set_visible(true);
                window.set_focus();
            } else if menu_event.id == mute_item.id() {
                let _ = webview.evaluate_script(
                    "if (typeof window.__toggleMic === 'function') { window.__toggleMic(); }",
                );
            } else if menu_event.id == deafen_item.id() {
                let _ = webview.evaluate_script(
                    "if (typeof window.__toggleDeaf === 'function') { window.__toggleDeaf(); }",
                );
            } else if menu_event.id == krisp_item.id() {
                let _ = webview.evaluate_script(
                    "if (typeof window.__toggleKrisp === 'function') { window.__toggleKrisp(); }",
                );
            } else if menu_event.id == voice_iso_item.id() {
                let _ = webview.evaluate_script(
                    "if (typeof window.__toggleVoiceIsolation === 'function') { window.__toggleVoiceIsolation(); }",
                );
            } else if menu_event.id == reload_item.id() {
                let _ = webview.evaluate_script("window.location.reload();");
            }
        }

        // Process Tray Icon clicks (left click / double click restores window)
        if let Ok(tray_event) = tray_channel.try_recv() {
            match tray_event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    ..
                }
                | TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    window.set_visible(true);
                    window.set_focus();
                }
                _ => {}
            }
        }

        // Handle Window Events
        match event {
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                // Like Discord Desktop, clicking "X" minimizes to system tray instead of terminating
                if !is_quitting.load(Ordering::SeqCst) {
                    window.set_visible(false);
                } else {
                    *control_flow = ControlFlow::Exit;
                }
            }
            _ => {}
        }
    });
}
