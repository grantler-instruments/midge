fn main() {
    watch_icons_dir(std::path::Path::new("icons"));
    tauri_build::build();
}

fn watch_icons_dir(dir: &std::path::Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            watch_icons_dir(&path);
        } else {
            println!("cargo:rerun-if-changed={}", path.display());
        }
    }
}
