type PromptComposerProps = {
  value: string;
  busy?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function PromptComposer(props: PromptComposerProps) {
  return (
    <div className="canvagent-prompt-composer">
      <label className="canvagent-prompt-label">
        <span className="sr-only">Message draft</span>
        <textarea
          aria-label="Message draft"
          value={props.value}
          placeholder="描述编辑"
          rows={1}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </label>
      <button
        type="button"
        aria-label="Submit annotations"
        onClick={props.onSubmit}
        disabled={props.busy || props.value.trim().length === 0}
      >
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M12 19V6m0 0-4.5 4.5M12 6l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
