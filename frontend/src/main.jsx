import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { applyTheme } from './utils/theme'
import './styles/theme-palette.css'
import './index.css'
import './styles/ambient.css'

// Clear legacy seed data on first load after this version
const DATA_VERSION = '3';
if (localStorage.getItem('nexmeet_data_version') !== DATA_VERSION) {
  localStorage.removeItem('nexmeet_upcoming_meetings');
  localStorage.removeItem('nexmeet_saved_recordings');
  localStorage.removeItem('nexmeet_async_messages');
  localStorage.removeItem('nexmeet_notifications');
  localStorage.setItem('nexmeet_data_version', DATA_VERSION);
}

applyTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
