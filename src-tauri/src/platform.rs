//! Platform checks that core cannot do itself.

/// True when this process runs with an elevated Windows administrator token
/// (granted through the Windows UAC prompt). Always false elsewhere.
#[cfg(windows)]
pub fn is_elevated_admin() -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token: HANDLE = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut len = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut core::ffi::c_void,
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut len,
        );
        CloseHandle(token);
        ok != 0 && elevation.TokenIsElevated != 0
    }
}

#[cfg(not(windows))]
pub fn is_elevated_admin() -> bool {
    false
}

/// Command-line flag the app passes to itself when relaunching elevated for
/// administrator recovery.
pub const RECOVER_ADMIN_FLAG: &str = "--recover-admin";

/// Starts a second copy of the app through the Windows UAC prompt, so a
/// Windows administrator can approve the PickWorks administrator recovery.
/// Returns an error if the prompt was declined or this isn't Windows.
#[cfg(windows)]
pub fn relaunch_elevated() -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    fn wide(s: &std::ffi::OsStr) -> Vec<u16> {
        s.encode_wide().chain(Some(0)).collect()
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let verb = wide("runas".as_ref());
    let file = wide(exe.as_os_str());
    let params = wide(RECOVER_ADMIN_FLAG.as_ref());
    let result = unsafe {
        ShellExecuteW(std::ptr::null_mut(), verb.as_ptr(), file.as_ptr(), params.as_ptr(), std::ptr::null(), SW_SHOWNORMAL)
    };
    // ShellExecuteW reports success with a value greater than 32.
    if result as isize > 32 {
        Ok(())
    } else {
        Err("Windows administrator approval was not given.".into())
    }
}

#[cfg(not(windows))]
pub fn relaunch_elevated() -> Result<(), String> {
    Err("Administrator recovery with system approval is only available on Windows.".into())
}

/// "recover-admin" when the app was relaunched for recovery and really is
/// elevated; otherwise "normal".
pub fn launch_mode() -> &'static str {
    if std::env::args().any(|a| a == RECOVER_ADMIN_FLAG) && is_elevated_admin() {
        "recover-admin"
    } else {
        "normal"
    }
}

/// Only the app's own pages may load in the window; external links are
/// refused (offline-first: no browsing out of the app).
pub fn is_allowed_navigation(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    let mut origins = vec!["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];
    if cfg!(debug_assertions) {
        origins.extend(["http://localhost:1420", "http://127.0.0.1:1420"]);
    }
    origins.iter().any(|o| {
        lower.strip_prefix(o).is_some_and(|rest| rest.is_empty() || rest.starts_with('/') || rest.starts_with('?') || rest.starts_with('#'))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn external_links_are_refused() {
        assert!(is_allowed_navigation("tauri://localhost/tuner"));
        assert!(is_allowed_navigation("http://tauri.localhost/"));
        assert!(!is_allowed_navigation("https://example.com/"));
        assert!(!is_allowed_navigation("http://tauri.localhost.evil.com/"));
        assert!(!is_allowed_navigation("file:///C:/Windows"));
    }
}
