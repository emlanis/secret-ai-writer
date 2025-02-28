[package]
name = "secret-ai-writer"
version = "0.1.0"
authors = ["emlanis <emlanis@scrt.network"]
edition = "2018"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
cosmwasm-std = { git = "https://github.com/scrtlabs/cosmwasm", branch = "secret" }
cosmwasm-storage = { git = "https://github.com/scrtlabs/cosmwasm", branch = "secret" }
schemars = "0.8.1"
serde = { version = "1.0.114", default-features = false, features = ["derive"] }
snafu = { version = "0.6.3" }
secret-toolkit = { git = "https://github.com/scrtlabs/secret-toolkit", branch = "master" }

[dev-dependencies]
cosmwasm-schema = { git = "https://github.com/scrtlabs/cosmwasm", branch = "secret" }

[profile.release]
opt-level = 3
debug = false
rpath = false
lto = true
debug-assertions = false
codegen-units = 1
panic = 'abort'
incremental = false
overflow-checks = true