import React from 'react'
import ReactDOM from 'react-dom/client'
import TolkienRPG from './App.tsx'
import './index.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TolkienRPG />
  </React.StrictMode>,
)