import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from './i18n/i18n'
import { Cargador } from './carga/Cargador'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Cargador />
    </I18nProvider>
  </StrictMode>,
)
