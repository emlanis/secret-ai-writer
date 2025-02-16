use cosmwasm_std::{Storage, Api, Env, Querier, StdResult};
use secret_toolkit::storage::{Item, Keymap};

// Encrypted writing session storage
pub static DRAFTS: Keymap<String, Vec<u8>> = Keymap::new(b"drafts");

pub fn store_draft(
    storage: &mut dyn Storage,
    user: &str,  // Secret address
    encrypted_draft: &[u8],
) -> StdResult<()> {
    DRAFTS.add_smart(storage, user, encrypted_draft)
}

pub fn retrieve_draft(
    storage: &dyn Storage,
    user: &str,
) -> StdResult<Option<Vec<u8>>> {
    DRAFTS.get(storage, user)
}