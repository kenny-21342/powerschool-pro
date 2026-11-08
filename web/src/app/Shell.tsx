import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight, LogOut, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { signOut } from '@/features/auth/session'
import { ago, clockTime, formatDate, schoolDate } from '@/lib/dates'
import { useSnapshot } from '@/lib/queries'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'
import { NAV, titleFor } from './nav'

export function Backdrop() {
  return (
    <div className="mesh" aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}

function isActive(to: string, pathname: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

const SLIDE = 'transition-transform duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none'

function Rail() {
  const { pathname } = useLocation()
  const active = NAV.findIndex((n) => isActive(n.to, pathname))
  return (
    <nav aria-label="Main" className="no-print sticky top-5 hidden self-start rail:block lg:top-8">
      <div className="glass relative flex flex-col items-center gap-1.5 rounded-full p-1.5">
        {/* The selection bead slides between items: 44px item + 6px gap. */}
        {active >= 0 && (
          <span aria-hidden className={cn('bead pointer-events-none absolute top-1.5 left-1.5 size-11 rounded-full bg-primary', SLIDE)} style={{ transform: `translateY(${active * 50}px)` }} />
        )}
        {NAV.map(({ to, label, icon: Icon }) => (
          <Tooltip key={to}>
            <TooltipTrigger asChild>
              <NavLink
                to={to}
                aria-label={label}
                className={cn(
                  'relative grid size-11 place-items-center rounded-full text-muted-foreground transition duration-200 hover:bg-accent hover:text-foreground active:scale-[0.94]',
                  isActive(to, pathname) && 'text-primary-foreground hover:bg-transparent hover:text-primary-foreground',
                )}
              >
                <Icon className="size-5" strokeWidth={1.8} />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
        <span className="my-1 h-px w-6 bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-5" strokeWidth={1.8} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  )
}

/** Five whole items fill the bar at rest (20% of its inner width); the rest are a swipe away.
    Container units keep that true at any phone width, up to the bar's max width. */
const DOCK_ITEM = 'w-[20cqw] shrink-0'
const DOCK_VISIBLE = 5

/** Phone dock: every section in one bar that swipes sideways, snapping so no label is ever
    cut in half. The lens slides to the open section, and the bar pages to keep it on screen. */
function Dock() {
  const { pathname } = useLocation()
  const active = NAV.findIndex((n) => isActive(n.to, pathname))
  const scroller = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const measure = () => {
    const el = scroller.current
    if (el) setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 4 })
  }
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const item = el.querySelector('a')?.getBoundingClientRect().width ?? el.clientWidth / DOCK_VISIBLE
    const first = Math.round(el.scrollLeft / item)
    // Only move when the open section is off screen; centre it when it is.
    if (active >= 0 && (active < first || active >= first + DOCK_VISIBLE)) {
      const target = Math.min(Math.max(active - 2, 0), NAV.length - DOCK_VISIBLE)
      el.scrollTo({ left: target * item, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
    measure()
    const raf = requestAnimationFrame(measure) // after the snap point has settled
    return () => cancelAnimationFrame(raf)
  }, [active])

  return (
    <nav aria-label="Main" className="no-print fixed inset-x-3 bottom-[max(0.5rem,calc(env(safe-area-inset-bottom)-0.5rem))] z-40 rail:hidden">
      <div className="glass dock relative mx-auto max-w-lg rounded-full">
        <div ref={scroller} onScroll={measure} className="dock-scroll overflow-x-auto rounded-full p-1 [container-type:inline-size]">
          <div className="relative flex w-max">
            {active >= 0 && (
              <span
                aria-hidden
                className={cn('dock-bead pointer-events-none absolute inset-y-0 left-0 rounded-full', DOCK_ITEM, SLIDE)}
                style={{ transform: `translateX(${active * 100}%)` }}
              />
            )}
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  DOCK_ITEM,
                  'relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition duration-200 active:scale-[0.94]',
                  isActive(to, pathname) ? 'text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" strokeWidth={1.8} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
        {/* Hints that there is more: a small chevron on whichever side still has items. */}
        {!edges.start && <ChevronLeft aria-hidden className="pointer-events-none absolute top-1/2 left-0.5 size-3.5 -translate-y-1/2 text-faint" />}
        {!edges.end && <ChevronRight aria-hidden className="pointer-events-none absolute top-1/2 right-0.5 size-3.5 -translate-y-1/2 text-faint" />}
      </div>
    </nav>
  )
}

function Freshness() {
  const qc = useQueryClient()
  const fetching = useIsFetching() > 0
  const { dataUpdatedAt, error, data } = useSnapshot()
  const now = useNow(60_000)
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {data && (
        <span className={cn('hidden sm:inline', error && 'text-warn')} title={error?.message}>
          {error ? 'Couldn’t refresh · saved ' : 'Updated '}
          {ago(dataUpdatedAt, now.getTime())}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 rounded-full md:pointer-fine:size-9"
        aria-label="Refresh"
        disabled={fetching}
        onClick={() => void qc.invalidateQueries()}
      >
        <RotateCw className={cn('size-4', fetching && 'animate-spin')} />
      </Button>
    </div>
  )
}

function greeting(hour: number) {
  return hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

function Title({ pathname }: { pathname: string }) {
  const { data: snap } = useSnapshot()
  const now = useNow(60_000)
  if (/^\/classes\/[^/]+/.test(pathname)) {
    return (
      <Link to="/classes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Classes
      </Link>
    )
  }
  if (pathname !== '/' || !snap) return <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{titleFor(pathname) || 'Home'}</h1>
  const date = schoolDate(now, snap.timeZone)
  const hour = Number(clockTime(now.toISOString(), snap.timeZone).slice(0, 2))
  const cycle = snap.schedule.days.find((d) => d.date === date)
  return (
    <div className="min-w-0">
      <h1 className="line-clamp-2 text-xl leading-tight font-semibold tracking-tight md:truncate md:text-2xl">
        {greeting(hour)}
        {snap.profile.firstName && `, ${snap.profile.firstName}`}
      </h1>
      <p className="text-[13px] text-muted-foreground md:text-sm">
        {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        {cycle?.day && ` · Day ${cycle.day}`}
      </p>
    </div>
  )
}

export function Shell() {
  const { pathname } = useLocation()
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1500px] items-start gap-5 md:p-5 lg:gap-6 lg:p-8">
      <Rail />
      <div className="min-w-0 flex-1 md:glass md:min-h-[calc(100dvh-2.5rem)] md:rounded-2xl lg:min-h-[calc(100dvh-4rem)]">
        <header className="flex min-h-14 items-center justify-between gap-2 px-4 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.25rem))] pb-2 sm:px-6 md:min-h-[5.5rem] md:gap-3 md:pt-6 md:pb-3">
          <Title pathname={pathname} />
          <Freshness />
        </header>
        <main key={pathname} className="settle px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 rail:pb-6">
          <Outlet />
        </main>
      </div>
      <Dock />
      {/* New pages open at the top; back/forward restores where you were. */}
      <ScrollRestoration />
    </div>
  )
}
