use super::*;
use crate::{
    clock,
    store::{testing::temp_dir, Paragraph},
};

fn server() -> Server {
    let mut config = Config::default();
    config.capture.max_edge = 16;
    Server {
        store: Store::open(temp_dir("mcp"), "시험").unwrap(),
        config,
        initialized: false,
        ready: false,
        autostart: false,
    }
}
fn req(method: &str, params: Value) -> Value {
    json!({"jsonrpc":"2.0","id":1,"method":method,"params":params})
}
fn init(server: &mut Server) {
    let response=server.dispatch(req("initialize",json!({"protocolVersion":"2099-01-01","capabilities":{},"clientInfo":{"name":"test","version":"1"}}))).unwrap();
    assert_eq!(response["result"]["protocolVersion"], PROTOCOL);
    assert!(response["result"]["instructions"]
        .as_str()
        .unwrap()
        .contains("session_log"));
    assert!(server
        .dispatch(json!({"jsonrpc":"2.0","method":"notifications/initialized"}))
        .is_none());
}
fn call(server: &mut Server, name: &str, args: Value) -> Value {
    server
        .dispatch(req("tools/call", json!({"name":name,"arguments":args})))
        .unwrap()
}

#[test]
fn lifecycle_errors_and_notifications() {
    let mut s = server();
    assert_eq!(
        s.dispatch(req("tools/list", json!({}))).unwrap()["error"]["code"],
        -32000
    );
    assert_eq!(s.dispatch(json!([])).unwrap()["error"]["code"], -32600);
    assert_eq!(
        s.dispatch(req("initialize", json!({}))).unwrap()["error"]["code"],
        -32602
    );
    init(&mut s);
    assert_eq!(
        s.dispatch(req("missing", json!({}))).unwrap()["error"]["code"],
        -32601
    );
    assert!(s.dispatch(json!({"jsonrpc":"2.0","method":"tools/call","params":{"name":"session_log","arguments":{"question":"no","answer":"no","kind":"explain"}}})).is_none());
    assert_eq!(
        s.store
            .qa_count(s.store.current_bundle().unwrap().id)
            .unwrap(),
        0
    );
}

#[test]
fn schemas_validate_all_known_inputs_without_side_effects() {
    let mut s = server();
    init(&mut s);
    let defs = tools::definitions();
    let root: Value = serde_json::from_str(include_str!(
        "../../../../packages/contracts/schemas/core-tools.schema.json"
    ))
    .unwrap();
    assert_eq!(
        defs.iter().map(|v| v["name"].clone()).collect::<Vec<_>>(),
        root["x-tool-names"].as_array().unwrap().clone()
    );
    for (name, args) in [
        ("moment_latest", json!({"max_age_sec":0})),
        ("moment_latest", json!({"max_age_sec":86401})),
        ("session_summary", json!({"recent":1.5})),
        ("transcript_recent", json!({"until":"bad"})),
        ("moment_get", json!({"moment_id":"../../secret"})),
        ("moment_capture", json!({"note":"가".repeat(501)})),
        (
            "session_log",
            json!({"question":"q","answer":"a","kind":"shell"}),
        ),
        ("core_status", json!({"extra":true})),
        ("moment_capture", json!({"paragraph_uuid":null})),
    ] {
        assert_eq!(call(&mut s, name, args)["error"]["code"], -32602, "{name}");
    }
    assert_eq!(
        s.store
            .frame_count(s.store.current_bundle().unwrap().id)
            .unwrap(),
        0
    );
}

#[test]
fn transcripts_qa_reopen_and_stale_moment() {
    let mut s = server();
    init(&mut s);
    let now = clock::now_epoch_millis();
    let bundle = s.store.current_bundle().unwrap().id;
    s.store
        .upsert_paragraphs(
            bundle,
            &[Paragraph {
                uuid: "paragraph-one".into(),
                note_guid: "note-test".into(),
                text: "의존성을 주입합니다.".into(),
                summary_md: None,
                time_from: clock::epoch_millis_to_rfc3339(now - 20_000),
                time_to: clock::epoch_millis_to_rfc3339(now - 1_000),
                locked: true,
            }],
        )
        .unwrap();
    let recent = call(&mut s, "transcript_recent", json!({}));
    assert_eq!(
        recent["result"]["structuredContent"]["paragraphs"][0]["uuid"],
        "paragraph-one"
    );
    assert_eq!(
        call(&mut s, "moment_latest", json!({}))["result"]["structuredContent"]["found"],
        false
    );
    let missing = call(
        &mut s,
        "session_log",
        json!({"question":"q","answer":"a","kind":"explain","moment_id":"m-1"}),
    );
    assert_eq!(missing["result"]["isError"], true);
    let logged = call(
        &mut s,
        "session_log",
        json!({"question":"주입은?","answer":"  값을 건넵니다.\n","kind":"explain","paragraph_uuid":"paragraph-one"}),
    );
    assert_eq!(logged["result"]["structuredContent"]["ok"], true);
    let dir = s.store.data_dir().to_owned();
    drop(s);
    let reopened = Store::open(dir, "ignored").unwrap();
    let summary =
        tools::call(&reopened, &Config::default(), "session_summary", &json!({})).unwrap();
    assert_eq!(
        summary["structuredContent"]["recentQa"][0]["answer"],
        "  값을 건넵니다.\n"
    );
    assert_eq!(summary["structuredContent"]["counts"]["qa"], 1);
}

#[test]
fn capture_get_image_and_invalid_paragraph_preflight() {
    let mut s = server();
    init(&mut s);
    assert_eq!(
        call(
            &mut s,
            "moment_capture",
            json!({"paragraph_uuid":"missing"})
        )["result"]["isError"],
        true
    );
    assert_eq!(
        s.store
            .frame_count(s.store.current_bundle().unwrap().id)
            .unwrap(),
        0
    );
    let captured = call(&mut s, "moment_capture", json!({"note":"test"}));
    let result = &captured["result"];
    assert_eq!(result["isError"], false, "{captured}");
    assert_eq!(result["content"][1]["type"], "image");
    let id = result["structuredContent"]["moment_id"].clone();
    let fetched = call(&mut s, "moment_get", json!({"moment_id":id}));
    assert_eq!(fetched["result"]["content"][1], result["content"][1]);
    assert_eq!(
        call(&mut s, "moment_latest", json!({}))["result"]["structuredContent"]["moment"]["id"],
        id
    );
    assert_eq!(
        s.store
            .latest_moment(
                s.store.current_bundle().unwrap().id,
                1000,
                clock::now_epoch_millis() + 2000
            )
            .unwrap(),
        None
    );
}

#[test]
fn stream_eof_parse_error_and_size_cap() {
    let mut s = server();
    let mut out = Vec::new();
    run_stream(
        &mut s,
        std::io::Cursor::new(b"not-json\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"ping\"}\n"),
        &mut out,
    )
    .unwrap();
    let responses: Vec<Value> = String::from_utf8(out)
        .unwrap()
        .lines()
        .map(|l| serde_json::from_str(l).unwrap())
        .collect();
    assert_eq!(responses.len(), 2);
    assert_eq!(responses[0]["error"]["code"], -32700);
    assert_eq!(responses[1]["result"], json!({}));
    assert!(run_stream(
        &mut s,
        std::io::Cursor::new(vec![b'x'; MAX_REQUEST + 10]),
        Vec::new()
    )
    .is_err());
}
