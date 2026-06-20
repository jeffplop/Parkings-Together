'use client'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function SwaggerUIComponent() {
  return (
    <SwaggerUI
      url="/openapi.yaml"
      docExpansion="list"
      defaultModelsExpandDepth={1}
      tryItOutEnabled={true}
    />
  )
}
