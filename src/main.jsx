import React from 'react'
import { createRoot } from 'react-dom/client'
import AuthShell from './AuthShell.jsx'
import './styles.css'
createRoot(document.getElementById('root')).render(<React.StrictMode><AuthShell /></React.StrictMode>)
