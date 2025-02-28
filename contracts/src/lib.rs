// contracts/src/lib.rs
use cosmwasm_std::{
    to_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError, StdResult, Addr,
    Storage, entry_point,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

// Define contract state
#[derive(Serialize, Deserialize, Clone, JsonSchema)]
pub struct State {
    pub owner: Addr,
    pub draft_count: u64,
}

// Define draft structure
#[derive(Serialize, Deserialize, Clone, JsonSchema)]
pub struct Draft {
    pub encrypted_content: String,
    pub encrypted_metadata: String,
    pub timestamp: u64,
}

// Define init message
#[derive(Serialize, Deserialize, Clone, JsonSchema)]
pub struct InstantiateMsg {
    pub owner: Option<Addr>,
}

// Define handle messages
#[derive(Serialize, Deserialize, Clone, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    StoreDraft {
        encrypted_content: String,
        encrypted_metadata: String,
    },
    DeleteDraft {},
}

// Define query messages
#[derive(Serialize, Deserialize, Clone, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetDraft {
        address: Addr,
    },
    GetConfig {},
}

// Define query responses
#[derive(Serialize, Deserialize, Clone, JsonSchema)]
pub struct DraftResponse {
    pub encrypted_content: String,
    pub encrypted_metadata: String,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize, Clone, JsonSchema)]
pub struct ConfigResponse {
    pub owner: Addr,
    pub draft_count: u64,
}

// Simple storage helpers
pub fn config_store(storage: &mut dyn Storage, state: &State) -> StdResult<()> {
    storage.set(b"config", &cosmwasm_std::to_vec(state)?);
    Ok(())
}

pub fn read_config(storage: &dyn Storage) -> StdResult<State> {
    let data = storage.get(b"config").ok_or(StdError::not_found("State"))?;
    cosmwasm_std::from_slice(&data)
}

pub fn store_draft(storage: &mut dyn Storage, address: &Addr, draft: &Draft) -> StdResult<()> {
    let key = format!("draft:{}", address.to_string());
    storage.set(key.as_bytes(), &cosmwasm_std::to_vec(draft)?);
    Ok(())
}

pub fn delete_draft(storage: &mut dyn Storage, address: &Addr) -> StdResult<()> {
    let key = format!("draft:{}", address.to_string());
    storage.remove(key.as_bytes());
    Ok(())
}

pub fn has_draft(storage: &dyn Storage, address: &Addr) -> bool {
    let key = format!("draft:{}", address.to_string());
    storage.get(key.as_bytes()).is_some()
}

pub fn read_draft(storage: &dyn Storage, address: &Addr) -> StdResult<Draft> {
    let key = format!("draft:{}", address.to_string());
    let data = storage.get(key.as_bytes()).ok_or(StdError::not_found("Draft"))?;
    cosmwasm_std::from_slice(&data)
}

// Initialize contract
#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    // Set initial state
    let owner = msg.owner.unwrap_or_else(|| info.sender.clone());
    
    let state = State {
        owner,
        draft_count: 0,
    };
    
    // Save state
    config_store(deps.storage, &state)?;
    
    Ok(Response::new().add_attribute("action", "instantiate"))
}

// Handle incoming messages
#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> StdResult<Response> {
    match msg {
        ExecuteMsg::StoreDraft {
            encrypted_content,
            encrypted_metadata,
        } => store_draft_handler(deps, env, info, encrypted_content, encrypted_metadata),
        ExecuteMsg::DeleteDraft {} => delete_draft_handler(deps, env, info),
    }
}

// Handle function to store a draft
fn store_draft_handler(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    encrypted_content: String,
    encrypted_metadata: String,
) -> StdResult<Response> {
    // Create draft object
    let draft = Draft {
        encrypted_content,
        encrypted_metadata,
        timestamp: env.block.time.seconds(),
    };
    
    // Save draft
    store_draft(deps.storage, &info.sender, &draft)?;
    
    // Update draft count
    let mut state = read_config(deps.storage)?;
    state.draft_count += 1;
    config_store(deps.storage, &state)?;
    
    Ok(Response::new()
        .add_attribute("action", "store_draft")
        .add_attribute("sender", info.sender))
}

// Handle function to delete a draft
fn delete_draft_handler(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
) -> StdResult<Response> {
    // Check if draft exists
    if !has_draft(deps.storage, &info.sender) {
        return Err(StdError::generic_err("Draft not found"));
    }
    
    // Remove draft
    delete_draft(deps.storage, &info.sender)?;
    
    // Update draft count
    let mut state = read_config(deps.storage)?;
    state.draft_count = state.draft_count.saturating_sub(1);
    config_store(deps.storage, &state)?;
    
    Ok(Response::new()
        .add_attribute("action", "delete_draft")
        .add_attribute("sender", info.sender))
}

// Query contract state
#[entry_point]
pub fn query(
    deps: Deps,
    _env: Env,
    msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetDraft { address } => to_binary(&query_draft(deps, address)?),
        QueryMsg::GetConfig {} => to_binary(&query_config(deps)?),
    }
}

// Query function to get a draft
fn query_draft(
    deps: Deps,
    address: Addr,
) -> StdResult<DraftResponse> {
    // Get draft
    if !has_draft(deps.storage, &address) {
        return Err(StdError::generic_err("Draft not found"));
    }
    
    let draft = read_draft(deps.storage, &address)?;
    
    Ok(DraftResponse {
        encrypted_content: draft.encrypted_content,
        encrypted_metadata: draft.encrypted_metadata,
        timestamp: draft.timestamp,
    })
}

// Query function to get config
fn query_config(
    deps: Deps,
) -> StdResult<ConfigResponse> {
    let state = read_config(deps.storage)?;
    
    Ok(ConfigResponse {
        owner: state.owner,
        draft_count: state.draft_count,
    })
}