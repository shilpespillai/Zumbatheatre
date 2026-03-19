import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { vi, describe, it, expect } from 'vitest'
import React from 'react'

const TestComponent = () => {
  const { loading, user } = useAuth()
  if (loading) return <div>Loading...</div>
  return <div>{user ? 'Authenticated' : 'Guest'}</div>
}

describe('AuthContext', () => {
  it('shows guest state when no user is logged in', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Guest')).toBeInTheDocument())
  })
})
