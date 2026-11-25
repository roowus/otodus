import type { GlobalSettings } from '../../settings/global-settings-types'

// The Otodus theme plugin shipped as `stablyai.otodus-blues` before it grew a second pair; its
// key is baked into saved selections, consents and grants, so moving it needs a one-time rewrite.
export const LEGACY_OTODUS_THEME_PLUGIN_KEY = 'stablyai.otodus-blues'
export const OTODUS_THEME_PLUGIN_KEY = 'stablyai.otodus-themes'

const LEGACY_CONTENT_PREFIX = `plugin:${LEGACY_OTODUS_THEME_PLUGIN_KEY}/`

type PluginContentId = `plugin:${string}`

type PluginKeyedSettings = Pick<
  GlobalSettings,
  | 'pluginAppTheme'
  | 'pluginAppThemeLight'
  | 'pluginAppThemeDark'
  | 'editorThemeLight'
  | 'editorThemeDark'
  | 'pluginIconTheme'
  | 'terminalThemeDark'
  | 'terminalThemeLight'
  | 'terminalPluginPalettes'
  | 'pluginConsents'
  | 'disabledPlugins'
  | 'pluginExternalHostGrants'
>

function isPluginContentId(value: unknown): value is PluginContentId {
  return typeof value === 'string' && value.startsWith('plugin:')
}

/** True for a content id this plugin used to own, e.g. `plugin:stablyai.otodus-blues/abyss`. */
function isLegacyThemeId(value: string): value is PluginContentId {
  return value.startsWith(LEGACY_CONTENT_PREFIX)
}

function renamedThemeId(id: PluginContentId): PluginContentId {
  return `plugin:${OTODUS_THEME_PLUGIN_KEY}/${id.slice(LEGACY_CONTENT_PREFIX.length)}`
}

// Why prefer the new key: a profile that already ran once must not lose its newer record.
function moveKey<V>(record: Record<string, V>): Record<string, V> {
  if (!(LEGACY_OTODUS_THEME_PLUGIN_KEY in record)) {
    return record
  }
  const { [LEGACY_OTODUS_THEME_PLUGIN_KEY]: carried, ...rest } = record
  return OTODUS_THEME_PLUGIN_KEY in rest ? rest : { ...rest, [OTODUS_THEME_PLUGIN_KEY]: carried }
}

/** Rewrites every saved reference to the theme plugin's former key; settings that hold none come
 *  back absent, so a profile that never picked the plugin saves nothing. */
export function migrateLegacyOtodusThemePluginKey(
  settings: Partial<PluginKeyedSettings>
): Partial<PluginKeyedSettings> {
  const update: Partial<PluginKeyedSettings> = {}
  for (const setting of [
    'pluginAppTheme',
    'pluginAppThemeLight',
    'pluginAppThemeDark',
    'editorThemeLight',
    'editorThemeDark',
    'pluginIconTheme'
  ] as const) {
    const selected = settings[setting]
    if (isPluginContentId(selected) && isLegacyThemeId(selected)) {
      update[setting] = renamedThemeId(selected)
    }
  }
  for (const setting of ['terminalThemeDark', 'terminalThemeLight'] as const) {
    const selected = settings[setting]
    if (typeof selected === 'string' && isLegacyThemeId(selected)) {
      update[setting] = renamedThemeId(selected)
    }
  }
  const palettes = settings.terminalPluginPalettes
  if (Array.isArray(palettes)) {
    // Why the guard: a palette may name a plugin that is not this one, and only the legacy id moves.
    const renamed = palettes.map((palette) =>
      isLegacyThemeId(palette.id) ? { ...palette, id: renamedThemeId(palette.id) } : palette
    )
    if (renamed.some((palette, index) => palette.id !== palettes[index]?.id)) {
      update.terminalPluginPalettes = renamed
    }
  }
  if (settings.pluginConsents) {
    const renamed = moveKey(settings.pluginConsents)
    if (renamed !== settings.pluginConsents) {
      update.pluginConsents = renamed
    }
  }
  if (settings.pluginExternalHostGrants) {
    const renamed = moveKey(settings.pluginExternalHostGrants)
    if (renamed !== settings.pluginExternalHostGrants) {
      update.pluginExternalHostGrants = renamed
    }
  }
  if (Array.isArray(settings.disabledPlugins)) {
    const disabled = settings.disabledPlugins
    const renamed = disabled.map((key) =>
      key === LEGACY_OTODUS_THEME_PLUGIN_KEY ? OTODUS_THEME_PLUGIN_KEY : key
    )
    if (renamed.some((key, index) => key !== disabled[index])) {
      // Why dedupe: a profile that disabled both keys keeps one entry.
      update.disabledPlugins = [...new Set(renamed)]
    }
  }
  return update
}
