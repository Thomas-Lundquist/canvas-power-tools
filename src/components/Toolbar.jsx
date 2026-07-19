/**
 * Toolbar — the layout shell that sits between a PageHeader and the content
 * (a .card or table) and arranges a screen's controls in two regions.
 *
 * Tier 2 composition. Per the component ledger (Decision 3) this is a *layout
 * shell you arrange bricks on, never a props-configured vending machine*: it
 * owns no controls and grows no props when a screen needs a new one. Each Tool
 * composes its own SearchInput / SortControl / SegmentedToggle / count text
 * into the <Toolbar.Start> and <Toolbar.End> slots.
 *
 * Responsive by wrapping: Start and End are pushed apart by `justify-between`,
 * and `flex-wrap` lets End drop to its own row below a narrow width instead of
 * crushing Start — a graceful stack with no breakpoint props to configure.
 *
 * @example
 *   <Toolbar>
 *     <Toolbar.Start><SearchInput … /></Toolbar.Start>
 *     <Toolbar.End><SortControl … /><SegmentedToggle … /></Toolbar.End>
 *   </Toolbar>
 *
 * @param {React.ReactNode} children  Expected to be <Toolbar.Start> / <Toolbar.End>.
 * @param {object} [rest]  Passed to the wrapper (aria-*, data-*, etc.).
 */
export default function Toolbar({ children, ...rest }) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3"
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Left region — the primary controls for acting on the current view
 * (search, filters). Its own items also wrap so a crowded Start never
 * overflows horizontally.
 */
function Start({ children, ...rest }) {
  return (
    <div className="flex flex-wrap items-center gap-3" {...rest}>
      {children}
    </div>
  )
}

/**
 * Right region — secondary controls and status (sort, view toggle, result
 * counts). Ends up right-aligned via the wrapper's justify-between, and drops
 * to its own row before it would squeeze Start.
 */
function End({ children, ...rest }) {
  return (
    <div className="flex flex-wrap items-center gap-3" {...rest}>
      {children}
    </div>
  )
}

Toolbar.Start = Start
Toolbar.End = End
