import type { CommandSpec } from '../discovery/command-spec'
import { LOCAL_COMMAND_FLAGS } from '../arguments/args'

export const UNINSTALL_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['uninstall'],
    destructive: true,
    summary: 'Remove what Otodus added outside its own folders before you delete the app',
    usage: 'orca uninstall [--yes] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'yes'],
    notes: [
      'Removes agent status hooks, the orca command on PATH, the orca serve background service and ~/.orca/agent-hooks. Projects, worktrees, chat history and Otodus settings stay.',
      'Hooks shared with another installed Otodus build stay. Asks before changing anything unless --yes is passed.',
      'Run it on each SSH host the Otodus app could not reach.'
    ],
    examples: ['orca uninstall', 'orca uninstall --yes --json']
  }
]
