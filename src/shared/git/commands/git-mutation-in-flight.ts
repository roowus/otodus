/** Whether the execution host is running or has queued an Otodus Git command that can change this worktree. */
export type GitMutationInFlight = {
  inFlight: boolean
}
