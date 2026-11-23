import { act, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { useUserStore } from '../store/userStore';

import ProtectedRoute from './ProtectedRoute';

beforeEach(() => {
  useUserStore.setState({ authenticatedUser: null });
});

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/test']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    useUserStore.setState({
      authenticatedUser: {
        staffId: 1,
        staffName: 'Test',
        deviceName: 'Dev',
        pin: '1234',
      },
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to landing when not authenticated', () => {
    const { container } = renderWithRouter(
      <ProtectedRoute>
        <div>Should not see this</div>
      </ProtectedRoute>
    );

    expect(container.textContent).not.toContain('Should not see this');
  });

  it('redirects when condition is false', () => {
    useUserStore.setState({
      authenticatedUser: {
        staffId: 1,
        staffName: 'Test',
        deviceName: 'Dev',
        pin: '1234',
      },
    });

    const { container } = renderWithRouter(
      <ProtectedRoute condition={false}>
        <div>Conditional Content</div>
      </ProtectedRoute>
    );

    expect(container.textContent).not.toContain('Conditional Content');
  });

  it('renders when condition is true', () => {
    useUserStore.setState({
      authenticatedUser: {
        staffId: 1,
        staffName: 'Test',
        deviceName: 'Dev',
        pin: '1234',
      },
    });

    renderWithRouter(
      <ProtectedRoute condition={true}>
        <div>Allowed</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  // Every API call updates the network status. That must not re-render the routed page.
  it('does not render again when unrelated store state changes', () => {
    useUserStore.setState({
      authenticatedUser: { staffId: 1, staffName: 'Test', deviceName: 'Dev', pin: '1234' },
    });
    const onRender = vi.fn();
    renderWithRouter(
      <Profiler id="route" onRender={onRender}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </Profiler>
    );
    onRender.mockClear();

    act(() => useUserStore.getState().updateNetworkQuality('poor', 900));

    expect(onRender).not.toHaveBeenCalled();
  });
});
