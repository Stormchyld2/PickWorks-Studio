use serde::Serialize;

/// Errors carry a stable `code` for the interface; messages stay generic and
/// never include passwords, hashes or file contents.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("file error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid name: {0}")]
    InvalidName(String),
    #[error("invalid data: {0}")]
    InvalidData(String),
    #[error("damaged file: {0}")]
    Corrupt(String),
    #[error("saved by a newer version of PickWorks Studio (file version {found}, this app supports {supported})")]
    NewerVersion { found: u32, supported: u32 },
    #[error("setup has already been completed")]
    AlreadySetUp,
    #[error("setup has not been completed")]
    NotSetUp,
    #[error("password must be at least {0} characters")]
    WeakPassword(usize),
    #[error("incorrect password")]
    WrongPassword,
    #[error("too many attempts; try again in {0} seconds")]
    Throttled(u64),
    #[error("account is not active")]
    Inactive,
    #[error("unknown student")]
    UnknownStudent,
    #[error("not signed in or session has ended")]
    NoSession,
    #[error("this action needs the administrator")]
    Forbidden,
    #[error("a new password must be set first")]
    PasswordChangeRequired,
    #[error("Windows administrator approval is required")]
    ElevationRequired,
}

impl CoreError {
    pub fn code(&self) -> &'static str {
        match self {
            CoreError::Io(_) => "io",
            CoreError::InvalidName(_) => "invalid-name",
            CoreError::InvalidData(_) => "invalid-data",
            CoreError::Corrupt(_) => "corrupt",
            CoreError::NewerVersion { .. } => "newer-version",
            CoreError::AlreadySetUp => "already-set-up",
            CoreError::NotSetUp => "not-set-up",
            CoreError::WeakPassword(_) => "weak-password",
            CoreError::WrongPassword => "wrong-password",
            CoreError::Throttled(_) => "throttled",
            CoreError::Inactive => "inactive",
            CoreError::UnknownStudent => "unknown-student",
            CoreError::NoSession => "no-session",
            CoreError::Forbidden => "forbidden",
            CoreError::PasswordChangeRequired => "password-change-required",
            CoreError::ElevationRequired => "elevation-required",
        }
    }

    pub fn retry_after_secs(&self) -> Option<u64> {
        match self {
            CoreError::Throttled(s) => Some(*s),
            _ => None,
        }
    }
}

/// What the interface receives for an error.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorPayload {
    pub code: &'static str,
    pub message: String,
    pub retry_after_secs: Option<u64>,
}

impl From<CoreError> for ErrorPayload {
    fn from(e: CoreError) -> Self {
        ErrorPayload { code: e.code(), message: e.to_string(), retry_after_secs: e.retry_after_secs() }
    }
}

pub type Result<T> = std::result::Result<T, CoreError>;
