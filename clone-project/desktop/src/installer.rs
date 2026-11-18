#![windows_subsystem = "windows"]

use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;

const DESKTOP_EXE_BYTES: &[u8] = include_bytes!("../target/release/synccord-desktop.exe");

#[link(name = "user32")]
extern "system" {
    fn MessageBoxW(
        hwnd: isize,
        lp_text: *const u16,
        lp_caption: *const u16,
        u_type: u32,
    ) -> i32;
}

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn show_message_box(title: &str, message: &str) {
    let wide_title = to_wide(title);
    let wide_message = to_wide(message);
    const MB_OK: u32 = 0x00000000;
    const MB_ICONINFORMATION: u32 = 0x00000040;
    unsafe {
        MessageBoxW(0, wide_message.as_ptr(), wide_title.as_ptr(), MB_OK | MB_ICONINFORMATION);
    }
}

fn main() {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Local".to_string());
    let target_dir = PathBuf::from(&local_app_data).join("SyncCord");

    // 1. Create install directory
    if let Err(e) = std::fs::create_dir_all(&target_dir) {
        show_message_box(
            "Erro de Instalação - SyncCord",
            &format!("Não foi possível criar a pasta de instalação:\n{}", e),
        );
        return;
    }

    // 2. Write the executable
    let exe_path = target_dir.join("synccord-desktop.exe");
    if let Err(e) = std::fs::write(&exe_path, DESKTOP_EXE_BYTES) {
        show_message_box(
            "Erro de Instalação - SyncCord",
            &format!("Não foi possível gravar os arquivos da aplicação:\n{}", e),
        );
        return;
    }

    // 3. Create Windows Shortcuts (Desktop & Start Menu)
    let powershell_script = format!(
        r#"
        $ws = New-Object -ComObject WScript.Shell;
        $desktopPath = [Environment]::GetFolderPath('Desktop');
        $startMenuPath = [Environment]::GetFolderPath('Programs');

        try {{
            $s1 = $ws.CreateShortcut("$desktopPath\SyncCord.lnk");
            $s1.TargetPath = '{0}';
            $s1.WorkingDirectory = '{1}';
            $s1.IconLocation = '{0},0';
            $s1.Description = 'SyncCord Desktop';
            $s1.Save();
        }} catch {{}}

        try {{
            $s2 = $ws.CreateShortcut("$startMenuPath\SyncCord.lnk");
            $s2.TargetPath = '{0}';
            $s2.WorkingDirectory = '{1}';
            $s2.IconLocation = '{0},0';
            $s2.Description = 'SyncCord Desktop';
            $s2.Save();
        }} catch {{}}
        "#,
        exe_path.to_string_lossy().replace('\\', "\\\\"),
        target_dir.to_string_lossy().replace('\\', "\\\\"),
    );

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &powershell_script])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .status();

    // 4. Launch the application
    let _ = Command::new(&exe_path).spawn();

    // 5. Success Notification
    show_message_box(
        "Instalação Concluída - SyncCord",
        "O SyncCord foi instalado com sucesso!\n\nAtalhos foram adicionados à sua Área de Trabalho e ao Menu Iniciar.\nO aplicativo já foi iniciado.",
    );
}
