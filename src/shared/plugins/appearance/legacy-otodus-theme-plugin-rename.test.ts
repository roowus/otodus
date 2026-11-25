import { describe, expect, it } from 'vitest'
import {
  LEGACY_OTODUS_THEME_PLUGIN_KEY,
  OTODUS_THEME_PLUGIN_KEY,
  migrateLegacyOtodusThemePluginKey
} from './legacy-otodus-theme-plugin-rename'

const OLD = `plugin:${LEGACY_OTODUS_THEME_PLUGIN_KEY}/`
const NEW = `plugin:${OTODUS_THEME_PLUGIN_KEY}/`

describe('migrateLegacyOtodusThemePluginKey', () => {
  it('moves every theme selection onto the renamed plugin', () => {
    expect(
      migrateLegacyOtodusThemePluginKey({
        pluginAppThemeDark: `${OLD}abyss`,
        pluginAppThemeLight: `${OLD}shoal`,
        editorThemeDark: `${OLD}megalodon`,
        editorThemeLight: `${OLD}coral`,
        pluginIconTheme: `${OLD}icons`,
        terminalThemeDark: `${OLD}abyss`,
        terminalThemeLight: `${OLD}shoal`
      })
    ).toEqual({
      pluginAppThemeDark: `${NEW}abyss`,
      pluginAppThemeLight: `${NEW}shoal`,
      editorThemeDark: `${NEW}megalodon`,
      editorThemeLight: `${NEW}coral`,
      pluginIconTheme: `${NEW}icons`,
      terminalThemeDark: `${NEW}abyss`,
      terminalThemeLight: `${NEW}shoal`
    })
  })

  it('rewrites palette snapshots so headless hosts resolve the same colors', () => {
    const colors = { background: '#0d0d0d', foreground: '#e6e6e6', red: '#e0645c' }
    expect(
      migrateLegacyOtodusThemePluginKey({
        terminalPluginPalettes: [{ id: `${OLD}abyss`, colors }]
      })
    ).toEqual({ terminalPluginPalettes: [{ id: `${NEW}abyss`, colors }] })
  })

  it('keeps consent, grants and the disabled flag on the same plugin', () => {
    expect(
      migrateLegacyOtodusThemePluginKey({
        pluginConsents: { [LEGACY_OTODUS_THEME_PLUGIN_KEY]: 'fingerprint' },
        pluginExternalHostGrants: { [LEGACY_OTODUS_THEME_PLUGIN_KEY]: ['example.com'] },
        disabledPlugins: [LEGACY_OTODUS_THEME_PLUGIN_KEY, 'stablyai.orca-github-vscode-theme']
      })
    ).toEqual({
      pluginConsents: { [OTODUS_THEME_PLUGIN_KEY]: 'fingerprint' },
      pluginExternalHostGrants: { [OTODUS_THEME_PLUGIN_KEY]: ['example.com'] },
      disabledPlugins: [OTODUS_THEME_PLUGIN_KEY, 'stablyai.orca-github-vscode-theme']
    })
  })

  it('never lets a stale record replace the renamed plugin’s own consent', () => {
    expect(
      migrateLegacyOtodusThemePluginKey({
        pluginConsents: {
          [LEGACY_OTODUS_THEME_PLUGIN_KEY]: 'legacy',
          [OTODUS_THEME_PLUGIN_KEY]: 'current'
        },
        disabledPlugins: [LEGACY_OTODUS_THEME_PLUGIN_KEY, OTODUS_THEME_PLUGIN_KEY]
      })
    ).toEqual({
      pluginConsents: { [OTODUS_THEME_PLUGIN_KEY]: 'current' },
      disabledPlugins: [OTODUS_THEME_PLUGIN_KEY]
    })
  })

  it('leaves another plugin’s themes and built-in choices alone', () => {
    expect(
      migrateLegacyOtodusThemePluginKey({
        pluginAppThemeDark: 'plugin:stablyai.orca-github-vscode-theme/github-dark-default',
        pluginAppThemeLight: 'match-terminal',
        terminalThemeDark: 'Ghostty Default Style Dark',
        disabledPlugins: ['stablyai.orca-github-vscode-theme']
      })
    ).toEqual({})
  })

  it('returns nothing for a profile that never picked the plugin, so no save is queued', () => {
    expect(migrateLegacyOtodusThemePluginKey({ pluginAppThemeDark: null })).toEqual({})
  })
})
