export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed -top-16 left-4 focus-visible:top-4 z-[100] px-4 py-2 rounded-lg text-sm font-medium bg-white shadow-lg border border-gray-200 transition-all duration-150"
      style={{ color: 'var(--cpt-color)' }}
    >
      Skip to main content
    </a>
  )
}
