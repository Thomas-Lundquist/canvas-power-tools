export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed top-0 left-0 -translate-y-full focus-visible:translate-y-0 z-[100] m-3 px-4 py-2 rounded-lg text-sm font-medium bg-white shadow-lg border border-gray-200 transition-transform duration-150"
      style={{ color: 'var(--cpt-color)' }}
    >
      Skip to main content
    </a>
  )
}
