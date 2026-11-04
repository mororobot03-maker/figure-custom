import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './fetchMock.js';
import '../app/globals.css';
import Main from '../app/page.js';
import Order from '../app/order/page.js';
import { currentView, subscribe } from './nav.js';

function App() {
  const [view, setView] = useState(currentView());
  useEffect(() => subscribe(setView), []);
  return view === 'order' ? <Order key="order" /> : <Main key="main" />;
}
createRoot(document.getElementById('root')).render(<App />);
