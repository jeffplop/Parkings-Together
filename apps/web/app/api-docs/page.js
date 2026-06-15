import SwaggerWrapper from './SwaggerWrapper'

export const metadata = {
  title: 'API Docs — Parkings Together',
  description: 'Documentación interactiva de la API REST de Parkings Together',
}

export default function ApiDocsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#fff' }}>
      <SwaggerWrapper />
    </main>
  )
}
