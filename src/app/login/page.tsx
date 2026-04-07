'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirect: false,
    })

    if (result?.error) {
      setError('Identifiants incorrects. Vérifiez votre email et mot de passe.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-6">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="18" height="18" fill="black" />
              <path
                d="M4 9h10M9 4v10"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-semibold text-black tracking-[0.15em] uppercase">
              Médéré
            </span>
          </div>
          <h1 className="text-xl font-semibold text-black leading-tight">
            Connexion
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Accédez à votre tableau de bord campagnes email.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-gray-600 mb-1.5 tracking-wide uppercase"
            >
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 border border-gray-300 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black transition-colors"
              placeholder="prenom.nom@medere.fr"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-gray-600 mb-1.5 tracking-wide uppercase"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 border border-gray-300 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 py-3 px-3 border border-gray-200 bg-gray-50">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="6" stroke="#111" strokeWidth="1.25" />
                <path
                  d="M7 4v3.5M7 9.5v.5"
                  stroke="#111"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xs text-gray-800 leading-relaxed">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-black text-white text-sm font-medium tracking-wide hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-8 text-xs text-gray-400 text-center">
          Accès réservé aux membres de l&apos;équipe Médéré.
        </p>
      </div>
    </div>
  )
}
