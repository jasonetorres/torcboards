import 'regenerator-runtime/runtime';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter as Router } from 'react-router-dom'; // Import BrowserRouter
import { Provider } from 'react-redux'; // Import Provider
import { store } from './store'; // Import your Redux store

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Provider store={store}> {/* Wrap App with Provider */}
        <App />
      </Provider>
    </Router>
  </StrictMode>
);