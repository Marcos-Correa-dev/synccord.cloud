use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=app.rc");
    println!("cargo:rerun-if-changed=app.ico");

    let rc_paths = [
        "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\rc.exe",
        "rc.exe",
    ];

    let mut compiled = false;
    for rc in &rc_paths {
        let status = Command::new(rc)
            .args(["/fo", "app.res", "app.rc"])
            .status();
        if let Ok(s) = status {
            if s.success() {
                compiled = true;
                break;
            }
        }
    }

    if compiled || std::path::Path::new("app.res").exists() {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let res_path = std::path::Path::new(&manifest_dir).join("app.res");
        println!("cargo:rustc-link-arg={}", res_path.display());
    }
}
