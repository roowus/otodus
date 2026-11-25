/**
 * The GitHub repository this build takes its updates from.
 *
 * Otodus is a fork, so the upstream owner's releases are the wrong feed twice over: their
 * builds are Orca, and installing one would replace this app with a different product. Every
 * update URL resolves through here so a fork only has to change this one constant.
 */
export const RELEASE_REPOSITORY_OWNER = 'roowus'

/** Main releases for the stable and RC channels. */
export const MAIN_RELEASE_REPOSITORY = `${RELEASE_REPOSITORY_OWNER}/otodus`

/** Dev channels publish to their own repositories, keeping hourlies out of the stable feed. */
export const HOURLY_RELEASE_REPOSITORY = `${RELEASE_REPOSITORY_OWNER}/otodus-hourly`
export const DAILY_RELEASE_REPOSITORY = `${RELEASE_REPOSITORY_OWNER}/otodus-daily`
export const ADHOC_RELEASE_REPOSITORY = `${RELEASE_REPOSITORY_OWNER}/otodus-adhoc`
