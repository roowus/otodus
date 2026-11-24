import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli/cli-argument-boundary'

export const PORTS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['ports'],
    summary: 'List the listening ports Otodus detected for a workspace',
    usage: 'orca ports [--worktree <selector>] [--all] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'all'],
    notes: [
      'Defaults to the Otodus workspace that contains the current directory.',
      'Scans the host the workspace runs on and lists the ports Otodus tied to it, by process working directory (match=cwd) or command line (match=command).',
      '--all lists every listener found on that host, including other workspaces and processes Otodus could not tie to one. A native folder workspace needs --all, because Otodus does not tie ports to folders.',
      'url is the address the dev server printed in an Otodus terminal; it is missing when Otodus did not see one.'
    ],
    examples: [
      'orca ports',
      'orca ports --worktree branch:feature/login --json',
      'orca ports --all',
      "orca ports --json | jq -r '.result.ports[0].advertisedUrl'"
    ]
  }
]
