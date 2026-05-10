export const metadata = {
  title: 'Heed — The agent that remembers what you forget.',
  description: 'Agentic personal assistant for forgetful adults. Built on Azure OpenAI + Cosmos DB.',
}

// Without this, mobile browsers default to a 980px virtual viewport and
// shrink-fit the page — every layout looks subtly wrong on every phone.
//   - width: device-width  → CSS px = device px, so 390px iPhone gets 390px
//   - initialScale: 1      → no auto-zoom on first paint
//   - viewportFit: cover   → env(safe-area-inset-*) actually returns the
//     real notch/home-indicator insets instead of 0, so fixed bars stop
//     cutting off behind them on notched iPhones.
// We deliberately don't set maximumScale — pinch-zoom must stay enabled
// for accessibility (Apple HIG).
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
