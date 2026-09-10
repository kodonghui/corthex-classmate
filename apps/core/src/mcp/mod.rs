//! stdio MCP 서버 (커밋 단위 5 · 인수인계 §4.5).
//!
//! 공식 rust-sdk(`rmcp`)는 tokio → mio → windows-sys 0.61(raw-dylib) 때문에 이 툴체인에서 링크되지
//! 않는다(DECISIONS 2026-09-10 (4)). 그래서 JSON-RPC 2.0 · 줄 단위 stdio 전송 · `initialize` ·
//! `tools/list` · `tools/call` · `ping` 만 여기서 직접 만든다(2단계 MCP App 리소스는 그때 더한다).
//!
//! 툴 와이어 이름(밑줄)과 입력 · 출력 모양은 `packages/contracts/schemas/core-tools.schema.json` 이 정본이다.
//! 이미지는 `{"type":"image","data":"<base64>","mimeType":"image/webp"}` content 로 낸다.
//!
//! 브리지는 SQLite 를 직접 읽고 쓴다. 데몬이 없으면(heartbeat 없음) 데몬을 창 없이 띄운다.
//! `moment_capture` 는 브리지가 직접 캡처한다.

mod panel;
#[cfg(test)]
mod tests;
mod tools;
use crate::{
    config::Config,
    error::{CoreError, Result},
    paths,
    store::Store,
};
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
use std::process::{Command, Stdio};
pub use tools::status;
const MAX_REQUEST: usize = 1024 * 1024;
const PROTOCOL: &str = "2025-06-18";
pub const INSTRUCTIONS: &str =
    include_str!("../../../../plugins/classmate/skills/classmate/SKILL.md");

pub fn serve(args: &[String]) -> Result<()> {
    // The bridge can capture independently of the DPI-aware daemon.
    use windows::Win32::UI::HiDpi::{
        SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
    };
    let _ = unsafe { SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) };
    let autostart = match args
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>()
        .as_slice()
    {
        [] => true,
        ["--no-daemon"] => false,
        _ => return Err(CoreError::InvalidValue("MCP 인자")),
    };
    let dir = paths::data_dir()?;
    let config = Config::load_or_create(&dir)?;
    let store = Store::open(&dir, &config.bundle_name)?;
    let mut server = Server {
        store,
        config,
        initialized: false,
        ready: false,
        autostart,
    };
    run_stream(&mut server, io::stdin().lock(), io::stdout().lock())
}

fn run_stream(server: &mut Server, mut input: impl BufRead, mut output: impl Write) -> Result<()> {
    loop {
        let mut line = Vec::new();
        let n = std::io::Read::take(&mut input, (MAX_REQUEST + 1) as u64)
            .read_until(b'\n', &mut line)
            .map_err(|e| CoreError::Io("MCP 입력", e.kind()))?;
        if n == 0 {
            return Ok(());
        }
        if n > MAX_REQUEST {
            return Err(CoreError::InvalidValue("MCP 요청 크기"));
        }
        let response = match serde_json::from_slice::<Value>(&line) {
            Ok(request) => server.dispatch(request),
            Err(_) => Some(rpc_error(Value::Null, -32700, "Invalid JSON")),
        };
        if let Some(response) = response {
            serde_json::to_writer(&mut output, &response)
                .map_err(|_| CoreError::Json("MCP 응답"))?;
            output
                .write_all(b"\n")
                .and_then(|_| output.flush())
                .map_err(|e| CoreError::Io("MCP 출력", e.kind()))?;
        }
    }
}

struct Server {
    store: Store,
    config: Config,
    initialized: bool,
    ready: bool,
    autostart: bool,
}
impl Server {
    fn dispatch(&mut self, request: Value) -> Option<Value> {
        let id = request.get("id").cloned();
        let valid_id = id
            .as_ref()
            .map_or(true, |v| v.is_string() || v.is_i64() || v.is_u64());
        let method = request.get("method").and_then(Value::as_str);
        if !request.is_object() || request["jsonrpc"] != "2.0" || method.is_none() || !valid_id {
            return Some(rpc_error(Value::Null, -32600, "Invalid request"));
        }
        let method = method.unwrap();
        if id.is_none() {
            if method == "notifications/initialized" && self.initialized {
                self.ready = true;
            }
            return None; // Notifications cannot invoke tools or write data.
        }
        let id = id.unwrap();
        let params = request.get("params").cloned().unwrap_or(json!({}));
        if !params.is_object() {
            return Some(rpc_error(id, -32602, "Parameters must be an object"));
        }
        let result = match method {
            "initialize" if !self.initialized => {
                if !params["protocolVersion"].is_string()
                    || !params["capabilities"].is_object()
                    || !params["clientInfo"]["name"].is_string()
                    || !params["clientInfo"]["version"].is_string()
                {
                    return Some(rpc_error(id, -32602, "Invalid initialize parameters"));
                }
                if self.autostart {
                    if let Err(error) = ensure_daemon(&self.store) {
                        eprintln!("데몬 자동 시작 실패: {}", safe_error(&error));
                    }
                }
                self.initialized = true;
                json!({"protocolVersion":PROTOCOL,"capabilities":{"tools":{"listChanged":false},"resources":{"listChanged":false}},
                    "serverInfo":{"name":crate::NAME,"version":crate::VERSION},"instructions":INSTRUCTIONS})
            }
            "ping" => json!({}),
            _ if !self.ready => return Some(rpc_error(id, -32000, "Initialize connection first")),
            "tools/list" => {
                if params.get("cursor").is_some() {
                    return Some(rpc_error(id, -32602, "No pagination cursor"));
                }
                json!({"tools":tools::definitions()})
            }
            "resources/list" => {
                if params.get("cursor").is_some() {
                    return Some(rpc_error(id, -32602, "No pagination cursor"));
                }
                json!({"resources":[panel::descriptor()]})
            }
            "resources/templates/list" => json!({"resourceTemplates":[]}),
            "resources/read" => {
                if params["uri"] != panel::URI {
                    return Some(rpc_error(id, -32002, "Resource not found"));
                }
                panel::resource()
            }
            "tools/call" => {
                let Some(name) = params["name"].as_str() else {
                    return Some(rpc_error(id, -32602, "Tool name required"));
                };
                let arguments = params.get("arguments").cloned().unwrap_or(json!({}));
                if !tools::valid_input(name, &arguments) {
                    return Some(rpc_error(id, -32602, "Unknown tool or invalid arguments"));
                }
                match tools::call(&self.store, &self.config, name, &arguments) {
                    Ok(result) => result,
                    Err(error) => {
                        json!({"isError":true,"content":[{"type":"text","text":safe_error(&error)}]})
                    }
                }
            }
            _ => return Some(rpc_error(id, -32601, "Method not found")),
        };
        Some(json!({"jsonrpc":"2.0","id":id,"result":result}))
    }
}

fn rpc_error(id: Value, code: i32, message: &str) -> Value {
    json!({"jsonrpc":"2.0","id":id,"error":{"code":code,"message":message}})
}
fn safe_error(error: &CoreError) -> String {
    match error {
        CoreError::Sqlite(_) | CoreError::Message(_) => {
            "코어 처리에 실패했습니다. doctor로 점검하세요.".into()
        }
        _ => error.to_string(),
    }
}
fn ensure_daemon(store: &Store) -> Result<()> {
    if store.daemon_alive(crate::clock::now_epoch_millis())? {
        return Ok(());
    }
    let exe = std::env::current_exe().map_err(|e| CoreError::Io("실행 파일 확인", e.kind()))?;
    let mut command = Command::new(exe);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let mut child = command
        .spawn()
        .map_err(|e| CoreError::Io("데몬 시작", e.kind()))?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}
