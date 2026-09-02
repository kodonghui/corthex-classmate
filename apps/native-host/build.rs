//! windows-gnu 타깃에서 `winsqlite3` 를 링크할 수 있게 준비하는 빌드 스크립트.
//!
//! 왜 필요한가
//! -----------
//! `libsqlite3-sys` 의 `winsqlite3` 기능은 `cargo:rustc-link-lib=dylib=winsqlite3` 한 줄만
//! 내보낸다. MSVC 툴체인이라면 Windows SDK 의 `winsqlite3.lib` 를 찾아 끝나지만, 이 PC 는
//! GNU 툴체인(`stable-x86_64-pc-windows-gnu`)이라 SDK 가 없다. GNU ld 는 `-L` 로 준 폴더에서
//! `libwinsqlite3.dll.a` · `winsqlite3.lib` · `winsqlite3.dll` 순서로 찾아 보고, **DLL 을 직접**
//! 링크할 수 있다. 그래서 System32 의 `winsqlite3.dll` 하나만 복사해 그 폴더를 `-L` 로 준다.
//!
//! System32 폴더 전체를 `-L` 로 주면 안 된다
//! ----------------------------------------
//! 그러면 `kernel32` · `advapi32` 같은 기본 라이브러리까지 툴체인의 import 라이브러리 대신
//! System32 의 DLL 로 잡혀 링크가 깨진다. 그래서 파일 하나만 따로 떠 놓는다.
//!
//! 실행할 때는 아무것도 배포하지 않아도 된다. `winsqlite3.dll` 은 Windows 10 1709+ 에
//! 들어 있고, 로더가 System32 에서 자동으로 찾는다.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-env-changed=SystemRoot");

    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    if target_os != "windows" || target_env != "gnu" {
        // MSVC 나 다른 OS 에서는 툴체인이 알아서 찾는다. 아무것도 하지 않는다.
        return;
    }

    let system_root = env::var("SystemRoot").unwrap_or_else(|_| "C:/Windows".to_string());
    let source = Path::new(&system_root)
        .join("System32")
        .join("winsqlite3.dll");
    if !source.is_file() {
        println!(
            "cargo:warning=winsqlite3.dll 을 System32 에서 찾지 못했습니다. \
             Windows 10 1709 이상인지 확인하세요."
        );
        return;
    }

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR 은 cargo 가 넣어 준다"));
    let link_dir = out_dir.join("winsqlite3-link");
    fs::create_dir_all(&link_dir).expect("링크용 폴더를 만들지 못했습니다");

    let destination = link_dir.join("winsqlite3.dll");
    fs::copy(&source, &destination).expect("winsqlite3.dll 을 복사하지 못했습니다");

    println!("cargo:rustc-link-search=native={}", link_dir.display());
}
