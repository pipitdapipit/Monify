export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-mute">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
