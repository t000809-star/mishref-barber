import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BookingProvider } from './store/BookingContext'

import CustomerLayout from './customer/Layout'
import Home from './customer/Home'
import Services from './customer/Services'
import SlotPicker from './customer/SlotPicker'
import BookingForm from './customer/BookingForm'
import Confirmation from './customer/Confirmation'

import AdminLayout from './admin/Layout'
import Dashboard from './admin/Dashboard'
import Bookings from './admin/Bookings'
import BookingDetail from './admin/BookingDetail'
import SlotsManager from './admin/Slots'

export default function App() {
  return (
    <BookingProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<CustomerLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/slots" element={<SlotPicker />} />
            <Route path="/book" element={<BookingForm />} />
            <Route path="/confirmed/:id" element={<Confirmation />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="bookings/:id" element={<BookingDetail />} />
            <Route path="slots" element={<SlotsManager />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </BookingProvider>
  )
}
