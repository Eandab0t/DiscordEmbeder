import type { Exporter } from './types';

export const jsonExporter: Exporter = {
  id: 'json',
  label: 'JSON',
  language: 'json',
  fileExtension: 'json',
  generate: (payload, context) =>
    JSON.stringify({ flags: context.flags, components: payload }, null, 2),
};
