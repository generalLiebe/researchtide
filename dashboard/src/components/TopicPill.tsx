export function TopicPill({ text }: { text: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'rgba(70, 91, 141, 0.05)',
        color: 'var(--text-primary)',
        border: '1px solid rgba(70, 91, 141, 0.1)',
        padding: '3px 8px',
        fontSize: 'var(--fs-tag)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      {text}
    </span>
  )
}
