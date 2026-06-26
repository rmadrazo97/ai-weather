// ---------------------------------------------------------------------------
// Light Markdown → plain-text cleanup for chat bubbles.
//
// The chat renders raw text in a <Text>, so any Markdown the model emits shows
// up as literal symbols (e.g. "* **Wednesday:**"). The system prompt asks the
// model to avoid Markdown, but small models slip; this is the display-side
// safety net so users never see stray markup. Kept intentionally conservative —
// it strips formatting markers, not content.
// ---------------------------------------------------------------------------

export function stripMarkdown(input: string): string {
  if (!input) return input;

  return input
    .split('\n')
    .map((line) => {
      let l = line;
      // Leading list markers ("* ", "- ", "+ ") → a clean bullet.
      l = l.replace(/^(\s*)[*+-]\s+/, '$1• ');
      // Leading "1. " ordered markers keep their number (already natural).
      // Leading heading hashes ("## ") → drop the hashes.
      l = l.replace(/^(\s*)#{1,6}\s+/, '$1');
      // Blockquote markers.
      l = l.replace(/^(\s*)>\s+/, '$1');
      return l;
    })
    .join('\n')
    // Bold / italic emphasis wrappers — unwrap, keep the inner text.
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, '$1$2')
    // Inline code backticks.
    .replace(/`([^`]+)`/g, '$1')
    // Any stray leftover bold markers.
    .replace(/\*\*/g, '');
}
