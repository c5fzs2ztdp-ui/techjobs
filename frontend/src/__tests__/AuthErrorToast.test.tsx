import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AuthErrorToast from '@/components/AuthErrorToast';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'sonner';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthErrorToast />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('AuthErrorToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error toast and strips authError, keeping other params', async () => {
    renderAt('/?authError=1&city=tel-aviv');
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('?city=tel-aviv'),
    );
  });

  it('does nothing without the authError param', () => {
    renderAt('/?city=tel-aviv');
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('?city=tel-aviv');
  });

  it('does not re-fire the toast after the param is stripped', async () => {
    renderAt('/?authError=1');
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(''),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
