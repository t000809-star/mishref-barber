import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type VerifyResult = {
  ok: true
  bookingId: string
  chargeId: string
  status: string
  paid: boolean
}

export default function PaymentReturn() {
  const [params] = useSearchParams()
  const bookingId = params.get('bookingId') ?? ''
  const chargeId = params.get('tap_id') ?? ''
  const [state, setState] = useState<'verifying' | 'paid' | 'failed'>('verifying')
  const [detail, setDetail] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    if (!bookingId || !chargeId) {
      setState('failed')
      setDetail('Missing booking or charge reference.')
      return
    }
    ;(async () => {
      const { data, error } = await supabase.functions.invoke<VerifyResult>('payment-verify', {
        body: { bookingId, chargeId },
      })
      if (cancelled) return
      if (error || !data) {
        setState('failed')
        setDetail(error?.message ?? 'Could not verify payment.')
        return
      }
      if (data.paid) {
        setState('paid')
      } else {
        setState('failed')
        setDetail(`Charge status: ${data.status}`)
      }
    })()
    return () => { cancelled = true }
  }, [bookingId, chargeId])

  if (state === 'verifying') {
    return <p className="pt-10 text-sm text-muted">Verifying payment…</p>
  }
  if (state === 'paid') {
    return (
      <div className="pt-10 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-brand text-cream flex items-center justify-center text-2xl">✓</div>
        <h1 className="font-display text-3xl text-brand-dark mt-4">Payment received.</h1>
        <p className="text-muted text-sm mt-1">Booking ref {bookingId}</p>
        <Link to={`/confirmed/${bookingId}`} className="mt-6 inline-block underline text-brand">
          View booking
        </Link>
      </div>
    )
  }
  return (
    <div className="pt-10 text-center">
      <h1 className="font-display text-2xl text-brand-dark">Payment didn't go through</h1>
      <p className="text-muted text-sm mt-2">{detail}</p>
      <p className="text-muted text-sm mt-1">Your booking is still held — you can pay in chair.</p>
      {bookingId && (
        <Link to={`/confirmed/${bookingId}`} className="mt-6 inline-block underline text-brand">
          Back to booking
        </Link>
      )}
    </div>
  )
}
