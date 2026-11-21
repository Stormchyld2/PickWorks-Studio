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
