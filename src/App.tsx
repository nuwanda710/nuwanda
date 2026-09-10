import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Bookshelf from './pages/Bookshelf'
import Reader from './pages/Reader'
import { loadSettings } from './lib/storage'

export default function App() {
  useEffect(() => {
    document.documentElement.dataset.theme = loadSettings().theme
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Bookshelf />} />
        <Route path="/read/:id" element={<Reader />} />
      </Routes>
    </HashRouter>
  )
}
