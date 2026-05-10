import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BookingProvider } from './store/BookingContext'

import CustomerLayout from './customer/Layout'
import Home from './customer/Home'
import Services from './customer/Services'
import SlotPicker from './customer/SlotPicker'
import BookingForm from './customer/BookingForm'
import Confirmation from './customer/Confirmation'
import PaymentReturn from './customer/PaymentReturn'

import AdminLayout from './admin/Layout'
import Dashboard from './admin/Dashboard'
import Bookings from './admin/Bookings'
import BookingDetail from './admin/BookingDetail'
import SlotsManager from './admin/Slots'
import Login from './admin/Login'
import RequireAuth from './admin/RequireAuth'

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
            <Route path="/payment/return" element={<PaymentReturn />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route index element={<Dashboard />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="bookings/:id" element={<BookingDetail />} />
              <Route path="slots" element={<SlotsManager />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </BookingProvider>
  )
}
