import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import { auth, db, functions, httpsCallable } from '../lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { EventNames, EventTypes } from '../../../shared/events'

export default function Profile() {
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState<'Male'|'Female'|'Other'>('Male')
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [photoURL, setPhotoURL] = useState<string>('')
  const [msg, setMsg] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { nav('/'); return }
      const snap = await getDoc(doc(db, 'users', u.uid))
      const data: any = snap.data() || {}
      setName(data.name || '')
      setDob(data.dob || '')
      setGender((data.gender as any) || 'Male')
      setPhoneNumber(data.phoneNumber || u.phoneNumber || '')
      setPhotoURL(data.photoURL || '')
    })
    return () => unsub()
  }, [nav])

  async function saveProfile() {
    try {
      setMsg('')
      if (!name.trim() || !dob || !gender) { setMsg('Name, DOB and Gender are required'); return }
      const call = httpsCallable(functions, 'addEvent')
      await call({ eventType: EventTypes.User, eventName: EventNames.User.UpdateProfile, eventPayload: { name, dob, gender, phoneNumber: phoneNumber || null } })
      setMsg('Saved')
    } catch (e: any) { setMsg(e.message || String(e)) }
  }

  async function setPhoto(url: string) {
    const call = httpsCallable(functions, 'addEvent')
    await call({ eventType: EventTypes.User, eventName: EventNames.User.UpdateProfilePhoto, eventPayload: { photoURL: url } })
    setPhotoURL(url)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="max-w-xl w-full mx-auto p-4 flex-1">
        <div className="card bg-base-100 shadow p-4 space-y-3">
          <div className="font-medium">My profile</div>
          <div className="form-control gap-2">
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input input-bordered" value={name} onChange={(e)=>setName(e.target.value)} />
            <label className="label" htmlFor="dob">Date of birth</label>
            <input id="dob" type="date" className="input input-bordered" value={dob} onChange={(e)=>setDob(e.target.value)} />
            <label className="label" htmlFor="gender">Gender</label>
            <select id="gender" className="select select-bordered" value={gender} onChange={(e)=>setGender(e.target.value as any)}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
            <label className="label" htmlFor="phone">Mobile number (optional)</label>
            <input id="phone" className="input input-bordered" value={phoneNumber} onChange={(e)=>setPhoneNumber(e.target.value)} placeholder="+1 555 555 5555" />
          </div>
          <div className="space-y-2">
            <div className="avatar">
              <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoURL || 'https://via.placeholder.com/96'} alt="profile" />
              </div>
            </div>
            <PhotoUpload onUploaded={setPhoto} />
          </div>
          <button className="btn btn-primary" onClick={saveProfile}>Save</button>
          {msg && <p className="text-sm opacity-80">{msg}</p>}
        </div>
      </main>
    </div>
  )
}

function PhotoUpload({ onUploaded }: Readonly<{ onUploaded: (url: string) => void }>) {
  const [uploading, setUploading] = useState(false)
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // Minimal anonymous upload via Firebase Storage public bucket path
      // For now, we use Firestore users doc to store URL; assume upload served via hosting or external service.
      // Placeholder: convert to data URL for quick demo
      const reader = new FileReader()
      reader.onload = () => { onUploaded(String(reader.result)); setUploading(false) }
      reader.readAsDataURL(file)
    } catch {
      setUploading(false)
    }
  }
  return (
    <label className="btn">
      <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      {uploading ? 'Uploading…' : 'Upload photo'}
    </label>
  )
}