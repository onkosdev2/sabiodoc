import { useEffect, useId, useState } from 'react'

import { Input } from './ui/Field'
import { localizedCountryName } from '../utils/locations'

interface CountryOption {
  isoCode: string
  name: string
}

interface CountrySelectProps {
  label?: string
  value: string
  onChange: (isoCode: string) => void
  countries: CountryOption[]
  required?: boolean
  error?: string
  hint?: string
  id?: string
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/**
 * Selector de país con búsqueda por nombre o código ISO.
 *
 * Usa un input con datalist para que el usuario pueda escribir “Perú”,
 * “Colombia” o “PE” sin recorrer la lista completa. El valor enviado sigue
 * siendo el código ISO.
 */
export default function CountrySelect({
  label = 'País',
  value,
  onChange,
  countries,
  required,
  error,
  hint = 'Escribe el nombre o el código del país.',
  id,
}: CountrySelectProps) {
  const listId = useId()
  const selected = countries.find((country) => country.isoCode === value)
  const selectedName = selected ? localizedCountryName(selected.isoCode, selected.name) : ''
  const [query, setQuery] = useState(selectedName)

  useEffect(() => {
    setQuery(selectedName)
  }, [selectedName])

  const findMatch = (text: string) =>
    countries.find(
      (country) =>
        country.isoCode.toLowerCase() === text.trim().toLowerCase() ||
        normalize(localizedCountryName(country.isoCode, country.name)) === normalize(text),
    )

  return (
    <>
      <Input
        id={id}
        label={label}
        list={listId}
        value={query}
        onChange={(event) => {
          const text = event.target.value
          setQuery(text)
          if (!text.trim()) {
            onChange('')
            return
          }
          const match = findMatch(text)
          if (match) onChange(match.isoCode)
        }}
        onBlur={() => {
          const match = findMatch(query)
          if (!match) setQuery(selectedName)
        }}
        autoComplete="off"
        placeholder="Ej: Perú, Colombia, PE"
        required={required}
        error={error}
        hint={hint}
      />
      <datalist id={listId}>
        {countries.map((country) => (
          <option key={country.isoCode} value={localizedCountryName(country.isoCode, country.name)} />
        ))}
      </datalist>
    </>
  )
}
