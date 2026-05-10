export const metadata = {
  title: 'Heed — The agent that remembers what you forget.',
  description: 'Agentic personal assistant for forgetful adults. Built on Azure OpenAI + Cosmos DB.',
}

// Without this, mobile browsers default to a 980px virtual viewport and
// shrink-fit the page — every layout looks subtly wrong on every phone.
//   - width: device-width  → CSS px = device px, so 390px iPhone gets 390px
//   - initialScale: 1      → no auto-zoom on first paint
// Intentionally NOT setting viewportFit: 'cover'. With cover, the visual
// viewport extends into the iOS notch/home-indicator zone and
// env(safe-area-inset-*) starts returning real insets — but every fixed
// bar in the app was already authored against the default behaviour
// (insets always 0), so cover throws off the bottom nav, AskTab dock,
// and modal positioning. If we ever want true edge-to-edge rendering
// later, that's a coordinated layout pass, not a one-line viewport flip.
// Pinch-zoom stays enabled for accessibility (Apple HIG).
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F5F0E6',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
