import React, { useEffect, useRef, useState } from 'react'
import { auth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged } from '../lib/firebase'
import { useNavigate } from 'react-router-dom'

export default function App() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<'enter-phone'|'enter-code'>('enter-phone')
  const [msg, setMsg] = useState('')
  const recaptchaDivRef = useRef<HTMLDivElement>(null)
  const nav = useNavigate()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) nav('/home')
    })
    return () => unsub()
  }, [nav])

  async function sendCode() {
    try {
      setMsg('')
      if (!recaptchaDivRef.current) return
      const verifier = new RecaptchaVerifier(auth, recaptchaDivRef.current, { size: 'normal' })
      await verifier.render()
      const result = await signInWithPhoneNumber(auth, phone.trim(), verifier)
      ;(window as any).__conf = result
      setPhase('enter-code')
      setMsg('Code sent. Check your SMS.')
    } catch (e: any) {
      setMsg(e.message || String(e))
    }
  }

  async function verifyCode() {
    try {
      setMsg('')
      const conf = (window as any).__conf
      if (!conf) { setMsg('No confirmation found. Please re-send code.'); return }
      await conf.confirm(code.trim())
      setMsg('Login successful')
      nav('/home')
    } catch (e: any) {
      setMsg(e.message || String(e))
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <div className="card bg-base-100 shadow-md p-6 gap-4">
        <h1 className="text-2xl font-bold">Twitan</h1>
        {phase === 'enter-phone' && (
          <>
            <label className="label" htmlFor="phone">Phone (E.164)</label>
            <input id="phone" className="input input-bordered w-full" placeholder="+1 555 555 5555" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div ref={recaptchaDivRef} />
            <button className="btn btn-primary" onClick={sendCode}>Send code</button>
          </>
        )}
        {phase === 'enter-code' && (
          <>
            <label className="label" htmlFor="code">Verification code</label>
            <input id="code" className="input input-bordered w-full" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-primary" onClick={verifyCode}>Verify</button>
          </>
        )}
        {msg && <p className="text-sm opacity-80">{msg}</p>}
      </div>
    </div>
  )
}
