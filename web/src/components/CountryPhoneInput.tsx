import React from 'react'

type Country = { code: string; dial: string; name: string }
const COUNTRIES: Country[] = [
  { code: 'IN', dial: '+91', name: 'India' },
  { code: 'US', dial: '+1', name: 'United States' },
  { code: 'GB', dial: '+44', name: 'United Kingdom' },
  { code: 'CA', dial: '+1', name: 'Canada' },
  { code: 'AU', dial: '+61', name: 'Australia' },
  { code: 'SG', dial: '+65', name: 'Singapore' },
  { code: 'AE', dial: '+971', name: 'UAE' },
  { code: 'DE', dial: '+49', name: 'Germany' },
  { code: 'FR', dial: '+33', name: 'France' },
  { code: 'ES', dial: '+34', name: 'Spain' },
  { code: 'IT', dial: '+39', name: 'Italy' },
  { code: 'BR', dial: '+55', name: 'Brazil' },
  { code: 'ZA', dial: '+27', name: 'South Africa' },
  { code: 'JP', dial: '+81', name: 'Japan' },
  { code: 'NZ', dial: '+64', name: 'New Zealand' },
]

export default function CountryPhoneInput({ value, onChange, defaultCountry = 'IN', label, placeholder }: Readonly<{ value: string; onChange: (e164: string) => void; defaultCountry?: string; label?: string; placeholder?: string }>) {
  const [country, setCountry] = React.useState<string>(defaultCountry)
  const [local, setLocal] = React.useState<string>('')

  React.useEffect(() => {
    const c = COUNTRIES.find(c => c.code === country) || COUNTRIES[0]
    const e164 = local ? `${c.dial}${local.replace(/\D/g, '')}` : ''
    onChange(e164)
  }, [country, local])

  const c = COUNTRIES.find(c => c.code === country) || COUNTRIES[0]
  return (
    <div className="flex gap-2 items-end w-full">
      {label && <label className="label w-0 sm:w-auto"><span className="label-text">{label}</span></label>}
      <select className="select select-bordered w-28" value={country} onChange={(e) => setCountry(e.target.value)}>
        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.code} {c.dial}</option>)}
      </select>
      <div className="flex-1 flex items-center gap-2">
        <span className="badge badge-ghost hidden sm:inline">{c.dial}</span>
        <input className="input input-bordered w-full" placeholder={placeholder ?? 'Phone number'} value={local} onChange={(e) => setLocal(e.target.value)} />
      </div>
    </div>
  )
}

export { COUNTRIES }
