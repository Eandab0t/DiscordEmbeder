import CodeMirror from '@uiw/react-codemirror';
import { json as jsonLang } from '@codemirror/lang-json';

/** Read-only code viewer. Owns all CodeMirror imports so the editor bundle
 *  loads lazily via React.lazy in ExportPanel. */
export default function CodeEditor({ value, language }: { value: string; language?: string }) {
  return (
    <CodeMirror
      value={value}
      theme="dark"
      editable={false}
      extensions={language === 'json' ? [jsonLang()] : []}
      basicSetup={{ foldGutter: true, highlightActiveLine: false }}
    />
  );
}
