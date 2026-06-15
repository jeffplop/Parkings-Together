'use client'
import dynamic from 'next/dynamic'

const SwaggerUI = dynamic(() => import('./SwaggerUI'), { ssr: false })

export default function SwaggerWrapper() {
  return <SwaggerUI />
}
