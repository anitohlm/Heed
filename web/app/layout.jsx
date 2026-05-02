export const metadata = {
  title: 'Heed — The agent that remembers what you forget.',
  description: 'Agentic personal assistant for forgetful adults. Built on Azure OpenAI + Cosmos DB.',
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
