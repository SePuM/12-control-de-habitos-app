import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import LoginScreen from '../app/login';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
}));

global.fetch = jest.fn();

describe('LoginScreen (login.tsx)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles login success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'mock-token' }),
    });

    render(<LoginScreen />);
    
    fireEvent.changeText(screen.getByPlaceholderText(/correo/i), 'test@test.com');
    fireEvent.changeText(screen.getByPlaceholderText(/contraseña/i), 'password');
    fireEvent.press(screen.getByText('Ingresar'));

    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'mock-token');
    });
  });

  it('handles login failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 401,
      json: async () => ({ message: 'Invalid credentials' }),
    });

    render(<LoginScreen />);
    
    fireEvent.changeText(screen.getByPlaceholderText(/correo/i), 'test@test.com');
    fireEvent.changeText(screen.getByPlaceholderText(/contraseña/i), 'wrong');
    fireEvent.press(screen.getByText('Ingresar'));

    const errorMsg = await screen.findByText('Invalid credentials');
    expect(errorMsg).toBeTruthy();
  });
});
