import { useState } from 'react';
import type { ValidationIssue } from '../../validation/rules';
import { Badge } from '../ui/primitives';

export function ValidationBanner({
  issues,
  onSelectNode,
}: {
  issues: ValidationIssue[];
  onSelectNode: (key: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (issues.length === 0) return null;
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const tone = errors.length > 0 ? 'error' : 'warning';

  return (
    <div
      className={`border-b px-3 py-2 text-xs ${
        tone === 'error'
          ? 'border-discord-red/40 bg-discord-red/10 text-discord-red'
          : 'border-discord-yellow/40 bg-discord-yellow/10 text-discord-yellow'
      }`}
    >
      <div className="flex items-center gap-2">
        <Badge tone={tone}>{tone === 'error' ? `${errors.length} error${errors.length === 1 ? '' : 's'}` : 'warning'}</Badge>
        <span className="font-semibold">
          {errors.length > 0
            ? `${errors.length} issue${errors.length === 1 ? '' : 's'} will make Discord reject this payload`
            : `${warnings.length} heads-up${warnings.length === 1 ? '' : 's'}`}
        </span>
        {warnings.length > 0 && errors.length > 0 && (
          <span className="text-discord-muted">+{warnings.length} warning{warnings.length === 1 ? '' : 's'}</span>
        )}
        <button
          type="button"
          className="ml-auto text-[11px] underline opacity-70 hover:opacity-100"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? 'show' : 'hide'}
        </button>
      </div>
      {!collapsed && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span aria-hidden>{issue.severity === 'error' ? '⛔' : '⚠️'}</span>
              {issue.nodeKey ? (
                <button
                  type="button"
                  className="text-left underline decoration-dotted underline-offset-2 hover:opacity-80"
                  onClick={() => onSelectNode(issue.nodeKey!)}
                >
                  {issue.message}
                </button>
              ) : (
                <span>{issue.message}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
