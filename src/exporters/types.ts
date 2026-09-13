import type { TopLevelComponent } from '../model/discord-components-v2-schema';
import type { BotIdentity } from '../model/node';

/**
 * One exporter per target language. Exporters are pure functions of the
 * payload — they never import canvas/store code, so new targets are
 * drop-in: write the module, register it in index.ts.
 */
export interface Exporter {
  id: string;
  label: string;
  language?: string;
  /** Generate the code/payload text for the export tab. */
  generate: (payload: TopLevelComponent[], context: ExportContext) => string;
  /** Optional file extension for the download button. */
  fileExtension?: string;
}

export interface ExportContext {
  /** Bot identity for webhook snippets that include username/avatar overrides. */
  bot: BotIdentity;
  /** Message flags (always includes IS_COMPONENTS_V2). */
  flags: number;
}
