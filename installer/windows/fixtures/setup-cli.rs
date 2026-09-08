// Synthetic standalone executable for official-login launcher verification.
// No network, real account, credential file, or AI client is accessed.
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let marker = std::env::var_os("CLASSMATE_SETUP_FIXTURE").expect("isolated marker required");
    if args == ["--version"] { println!("2.1.252 (Claude Code)"); }
    else if args == ["auth", "--help"] { println!("Manage authentication login status"); }
    else if args == ["auth", "status", "--json"] {
        let logged = std::path::Path::new(&marker).exists();
        println!("{{\"loggedIn\":{logged}}}");
        if !logged { std::process::exit(1); }
    }
    else if args == ["auth", "login"] { std::fs::write(marker, "synthetic-login-only").unwrap(); }
    else if args.iter().any(|arg| arg == "-p") {
        assert!(args.windows(2).any(|w| w == ["--tools", ""]));
        assert!(args.iter().any(|arg| arg == "--no-session-persistence"));
        assert!(args.last().unwrap().contains("CLASSMATE_CONNECTED"));
        println!("{{\"is_error\":false,\"result\":\"CLASSMATE_CONNECTED\"}}");
    } else { std::process::exit(2); }
}
