use serde::Serialize;
use std::path::PathBuf;

#[cfg(any(target_os = "windows", target_os = "macos"))]
use tauri::Manager;

use tauri::{
    Emitter,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
};

#[tauri::command]
fn read_text_file(path: PathBuf) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderEntry {
    name: String,
    path: PathBuf,
    is_directory: bool,
    children: Vec<FolderEntry>,
}

fn collect_algo_entries(path: &std::path::Path) -> Result<Vec<FolderEntry>, String> {
    let mut entries = Vec::new();
    let directory = std::fs::read_dir(path)
        .map_err(|error| format!("Cannot read {}: {error}", path.display()))?;
    for entry in directory {
        let entry = entry.map_err(|error| error.to_string())?;
        let kind = entry.file_type().map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        let children = if kind.is_dir() {
            collect_algo_entries(&entry_path)?
        } else if kind.is_file()
            && entry_path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("algo"))
        {
            Vec::new()
        } else {
            continue;
        };
        entries.push(FolderEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: entry_path,
            is_directory: kind.is_dir(),
            children,
        });
    }
    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(entries)
}

#[tauri::command]
async fn list_algo_folder(path: PathBuf) -> Result<Vec<FolderEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || collect_algo_entries(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn create_folder(parent: PathBuf, name: String) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\', ':', '\0']) {
        return Err("Enter a folder name without path separators.".into());
    }
    std::fs::create_dir(parent.join(name)).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_text_file(path: PathBuf, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_text_file(current_path: PathBuf, new_path: PathBuf) -> Result<(), String> {
    if current_path.parent() != new_path.parent() {
        return Err("Files can only be renamed within their current folder.".into());
    }

    if current_path != new_path && new_path.exists() {
        return Err("A file with that name already exists.".into());
    }

    std::fs::rename(current_path, new_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .menu(|app| {
            let new_file = MenuItemBuilder::with_id("new_file", "New File")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let open_file = MenuItemBuilder::with_id("open_file", "Open…")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let open_folder = MenuItemBuilder::with_id("open_folder", "Open Folder…").build(app)?;
            let save_file = MenuItemBuilder::with_id("save_file", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let save_as = MenuItemBuilder::with_id("save_as", "Save As…")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;
            let save_all = MenuItemBuilder::with_id("save_all", "Save All")
                .accelerator("CmdOrCtrl+Alt+S")
                .build(app)?;
            let rename_file = MenuItemBuilder::with_id("rename_file", "Rename…")
                .accelerator("F2")
                .build(app)?;
            let close_tab = MenuItemBuilder::with_id("close_tab", "Close Editor")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;
            let close_all_tabs =
                MenuItemBuilder::with_id("close_all_tabs", "Close All Editors").build(app)?;
            let close_window = MenuItemBuilder::with_id("close_window", "Close Window")
                .accelerator("CmdOrCtrl+Shift+W")
                .build(app)?;
            let next_editor = MenuItemBuilder::with_id("next_editor", "Next Editor")
                .accelerator("Ctrl+Tab")
                .build(app)?;
            let previous_editor = MenuItemBuilder::with_id("previous_editor", "Previous Editor")
                .accelerator("Ctrl+Shift+Tab")
                .build(app)?;
            let toggle_inspector =
                MenuItemBuilder::with_id("toggle_inspector", "Toggle Inspector Panel")
                    .accelerator("CmdOrCtrl+J")
                    .build(app)?;
            let run_algorithm = MenuItemBuilder::with_id("run_algorithm", "Run Algorithm…")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let stop_algorithm = MenuItemBuilder::with_id("stop_algorithm", "Stop")
                .accelerator("CmdOrCtrl+.")
                .build(app)?;
            let quit_app = MenuItemBuilder::with_id("quit_app", "Quit UNNC AlgoLab")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;

            let app_menu = SubmenuBuilder::new(app, "UNNC AlgoLab")
                .about(None)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .item(&quit_app)
                .build()?;
            let file_menu = SubmenuBuilder::new(app, "File")
                .items(&[
                    &new_file,
                    &open_file,
                    &open_folder,
                    &save_file,
                    &save_as,
                    &save_all,
                    &rename_file,
                ])
                .separator()
                .items(&[&close_tab, &close_all_tabs, &close_window])
                .build()?;
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let view_menu = SubmenuBuilder::new(app, "View")
                .items(&[&next_editor, &previous_editor])
                .separator()
                .item(&toggle_inspector)
                .build()?;
            let run_menu = SubmenuBuilder::new(app, "Run")
                .items(&[&run_algorithm, &stop_algorithm])
                .build()?;
            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .maximize()
                .fullscreen()
                .separator()
                .bring_all_to_front()
                .build()?;

            MenuBuilder::new(app)
                .items(&[
                    &app_menu,
                    &file_menu,
                    &edit_menu,
                    &view_menu,
                    &run_menu,
                    &window_menu,
                ])
                .build()
        })
        .setup(|_app| {
            #[cfg(any(target_os = "windows", target_os = "macos"))]
            if let Some(window) = _app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                window.set_decorations(false)?;
                #[cfg(target_os = "macos")]
                window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)))?;
                #[cfg(target_os = "windows")]
                window.remove_menu()?;
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            let action = event.id().0.clone();
            if matches!(
                action.as_str(),
                "new_file"
                    | "open_file"
                    | "open_folder"
                    | "save_file"
                    | "save_as"
                    | "save_all"
                    | "rename_file"
                    | "close_tab"
                    | "close_all_tabs"
                    | "close_window"
                    | "next_editor"
                    | "previous_editor"
                    | "toggle_inspector"
                    | "run_algorithm"
                    | "stop_algorithm"
                    | "quit_app"
            ) {
                let _ = app.emit("menu-action", action);
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            list_algo_folder,
            create_folder,
            write_text_file,
            rename_text_file,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{collect_algo_entries, create_folder};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn folder_tree_contains_only_algo_files_and_directories() {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root =
            std::env::temp_dir().join(format!("unnc-algolab-folder-{}-{id}", std::process::id()));
        fs::create_dir_all(root.join("nested")).unwrap();
        fs::create_dir_all(root.join("empty")).unwrap();
        fs::write(root.join("main.algo"), "").unwrap();
        fs::write(root.join("notes.txt"), "").unwrap();
        fs::write(root.join("nested").join("child.ALGO"), "").unwrap();
        fs::write(root.join("empty").join("notes.txt"), "").unwrap();

        let result = collect_algo_entries(&root).unwrap();
        create_folder(root.clone(), "created".into()).unwrap();
        assert!(root.join("created").is_dir());
        assert!(create_folder(root.clone(), "../outside".into()).is_err());
        assert!(create_folder(root.clone(), "nested".into()).is_err());
        fs::remove_dir_all(&root).unwrap();

        assert_eq!(result.len(), 3);
        assert!(result[0].is_directory);
        assert_eq!(result[0].name, "empty");
        assert!(result[0].children.is_empty());
        assert_eq!(result[1].name, "nested");
        assert_eq!(result[1].children.len(), 1);
        assert_eq!(result[1].children[0].name, "child.ALGO");
        assert_eq!(result[2].name, "main.algo");
        assert!(!result[2].is_directory);
    }
}
