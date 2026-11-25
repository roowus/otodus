#!/usr/bin/env node
// Launches the dev build under the plain "Otodus" dock name, sharing one profile, so the app someone
// actually uses both looks like the product and keeps every edit live. A packaged .app is a frozen
// copy: it cannot show a change until it is rebuilt, so this is the only shape that stays current.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const runner = fileURLToPath(new URL('./run-electron-vite-dev.mjs', import.meta.url))

const child = spawn(process.execPath, [runner, '--stable-name', '--shared-profile'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Both together: the dock/instance label is the product name, and every launch shares the
    // profile a normal Otodus uses, so projects and themes carry across restarts.
    ORCA_DEV_DOCK_TITLE: process.env.ORCA_DEV_DOCK_TITLE ?? 'Otodus',
    ORCA_DEV_INSTANCE_KEY: process.env.ORCA_DEV_INSTANCE_KEY ?? 'otodus-live'
  }
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0))
})
