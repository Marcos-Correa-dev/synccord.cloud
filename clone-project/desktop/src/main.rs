#![windows_subsystem = "windows"]

use single_instance::SingleInstance;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::WindowBuilder,
};
use tray_icon::{
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    MouseButton, TrayIconBuilder, TrayIconEvent,
};
use wry::WebViewBuilder;

/// Generates a 32x32 RGBA icon for SyncCord (Blurple #5865F2 with rounded corners and SCD logo)
fn create_discord_icon_rgba(size: u32) -> (Vec<u8>, u32, u32) {
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let radius = (size as f32 * 0.22) as i32;
    let s = size as i32;

    for y in 0..s {
        for x in 0..s {
            let idx = ((y * s + x) * 4) as usize;

            // Check rounded rectangle bounds
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
                // Background: SyncCord Blurple #5865F2
                rgba[idx] = 88;
                rgba[idx + 1] = 101;
                rgba[idx + 2] = 242;
                rgba[idx + 3] = 255;

                // Draw "SCD" branding in white
                // Letter 'S' (x: 6..=11, y: 10..=21)
                let is_s_top = (6..=11).contains(&x) && (10..=12).contains(&y);
                let is_s_left_top = (6..=8).contains(&x) && (12..=16).contains(&y);
                let is_s_mid = (6..=11).contains(&x) && (15..=17).contains(&y);
                let is_s_right_bot = (9..=11).contains(&x) && (16..=20).contains(&y);
                let is_s_bot = (6..=11).contains(&x) && (19..=21).contains(&y);

                // Letter 'C' (x: 14..=19, y: 10..=21)
                let is_c_left = (14..=16).contains(&x) && (10..=21).contains(&y);
                let is_c_top = (14..=19).contains(&x) && (10..=12).contains(&y);
                let is_c_bot = (14..=19).contains(&x) && (19..=21).contains(&y);

                // Letter 'D' (x: 22..=26, y: 10..=21)
                let is_d_left = (22..=24).contains(&x) && (10..=21).contains(&y);
                let is_d_top = (22..=25).contains(&x) && (10..=12).contains(&y);
                let is_d_bot = (22..=25).contains(&x) && (19..=21).contains(&y);
                let is_d_right = (25..=26).contains(&x) && (13..=18).contains(&y);

                if is_s_top || is_s_left_top || is_s_mid || is_s_right_bot || is_s_bot
                    || is_c_left || is_c_top || is_c_bot
                    || is_d_left || is_d_top || is_d_bot || is_d_right {
                    rgba[idx] = 255;
                    rgba[idx + 1] = 255;
                    rgba[idx + 2] = 255;
                }
            } else {
                // Transparent pixel outside rounded corners
                rgba[idx + 3] = 0;
            }
        }
    }

    (rgba, size, size)
}

fn main() {
    // Single instance protection: ensure only one SyncCord desktop client runs at a time
    let instance = SingleInstance::new("synccord_desktop_app_mutex")
        .expect("Failed to create single-instance mutex");

    if !instance.is_single() {
        eprintln!("[SyncCord Desktop] Outra instância do aplicativo já está em execução.");
        return;
    }

    let event_loop = EventLoop::new();

    // Prepare SyncCord icons for Window and System Tray
    let (icon_rgba, icon_w, icon_h) = create_discord_icon_rgba(32);
    let window_icon = tao::window::Icon::from_rgba(icon_rgba.clone(), icon_w, icon_h).ok();
    let tray_icon_data = tray_icon::Icon::from_rgba(icon_rgba, icon_w, icon_h)
        .expect("Failed to initialize tray icon bytes");

    // Build the native desktop window (mirroring SyncCord dimensions & styling)
    let window = WindowBuilder::new()
        .with_title("SyncCord")
        .with_inner_size(LogicalSize::new(1280.0, 720.0))
        .with_min_inner_size(LogicalSize::new(940.0, 500.0))
        .with_window_icon(window_icon)
        .build(&event_loop)
        .expect("Failed to build desktop window");

    let synccord_url = std::env::args()
        .nth(1)
        .or_else(|| std::env::var("SYNCCORD_URL").ok())
        .or_else(|| std::env::var("DISCORD_URL").ok())
        .unwrap_or_else(|| "https://synccord.cloud".to_string());

    let init_script = r#"
        window.__IS_NATIVE_DESKTOP__ = true;
        window.__DESKTOP_PLATFORM__ = 'rust-wry';
        console.log('[SyncCord Desktop] Rust native client initialized.');

        // Allow keyboard refresh in native desktop window
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
                e.preventDefault();
                window.location.reload();
            }
        });
    "#;

    let webview = WebViewBuilder::new()
        .with_url(&synccord_url)
        .with_devtools(true)
        .with_initialization_script(init_script)
        .build(&window)
        .expect("Failed to initialize WebView2");

    // Native Windows System Tray Menu
    let tray_menu = Menu::new();
    let open_item = MenuItem::new("Abrir SyncCord", true, None);
    let sep1 = PredefinedMenuItem::separator();
    let mute_item = CheckMenuItem::new("Desativar Microfone", true, false, None);
    let deafen_item = CheckMenuItem::new("Desativar Áudio", true, false, None);
    let sep2 = PredefinedMenuItem::separator();
    let quit_item = MenuItem::new("Sair do SyncCord", true, None);

    let _ = tray_menu.append_items(&[
        &open_item,
        &sep1,
        &mute_item,
        &deafen_item,
        &sep2,
        &quit_item,
    ]);

    let _tray_icon = TrayIconBuilder::new()
        .with_menu(Box::new(tray_menu))
        .with_tooltip("SyncCord (Rust Native)")
        .with_icon(tray_icon_data)
        .build()
        .expect("Failed to initialize system tray");

    let is_quitting = Arc::new(AtomicBool::new(false));
    let is_quitting_clone = is_quitting.clone();

    let menu_channel = MenuEvent::receiver();
    let tray_channel = TrayIconEvent::receiver();

    println!("[SyncCord Desktop] Cliente nativo em Rust rodando com sucesso.");
    println!("[SyncCord Desktop] Conectado a: {}", synccord_url);

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

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
                    "if (typeof window.__toggleMic === 'function') { window.__toggleMic(); }"
                );
            } else if menu_event.id == deafen_item.id() {
                let _ = webview.evaluate_script(
                    "if (typeof window.__toggleDeaf === 'function') { window.__toggleDeaf(); }"
                );
            }
        }

        // Process Tray Icon clicks (left click / double click restores window)
        if let Ok(tray_event) = tray_channel.try_recv() {
            match tray_event {
                TrayIconEvent::Click { button: MouseButton::Left, .. }
                | TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => {
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
                // Like Discord Desktop, clicking "X" minimizes to system tray instead of exiting
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
