export interface GitReleaseState {
  readonly commit: string;
  readonly porcelain: string;
}

export function readGitReleaseState(cwd: string | URL): GitReleaseState;
