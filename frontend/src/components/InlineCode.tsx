export function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g).filter(Boolean);

  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
          <code
            key={i}
            className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.9em]"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
