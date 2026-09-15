import type { Exporter } from './types';
import { jsonExporter } from './json';
import { discordJsExporter } from './discordjs';
import { discordPyExporter } from './discordpy';
import { curlExporter } from './curl';

export const EXPORTERS: Exporter[] = [jsonExporter, discordJsExporter, discordPyExporter, curlExporter];
