import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import AlertSubscribe from '../components/jobs/AlertSubscribe';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('AlertSubscribe', () => {
  it('rejects a malformed address without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<AlertSubscribe />);
    fireEvent.change(screen.getByLabelText(/Daily new-jobs email/), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /Subscribe/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the trimmed email and confirms on success', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    render(<AlertSubscribe />);
    fireEvent.change(screen.getByLabelText(/Daily new-jobs email/), { target: { value: '  user@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: /Subscribe/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain("You're subscribed"));
    expect(fetchMock).toHaveBeenCalledWith('/api/alerts/subscribe', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
    }));
  });

  it('shows an error when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));
    render(<AlertSubscribe />);
    fireEvent.change(screen.getByLabelText(/Daily new-jobs email/), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Subscribe/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
