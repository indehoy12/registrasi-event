import React from 'react'; import { createRoot } from 'react-dom/client'; import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'; import 'bootstrap-icons/font/bootstrap-icons.css'; import './styles.css'; import { DialogProvider } from './ui.jsx'; import App from './App.jsx'
createRoot(document.getElementById('root')).render(<BrowserRouter><DialogProvider><App/></DialogProvider></BrowserRouter>)
