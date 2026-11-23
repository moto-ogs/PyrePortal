import { useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useShallow } from 'zustand/react/shallow';

import { KioskNotice } from './components/KioskNotice';
import ProtectedRoute from './components/ProtectedRoute';
import { RfidServiceInitializer } from './components/RfidServiceInitializer';
import NetworkStatus from './components/ui/NetworkStatus';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import ActivityScanningPage from './pages/ActivityScanningPage';
import CreateActivityPage from './pages/CreateActivityPage';
import HomeViewPage from './pages/HomeViewPage';
import LandingPage from './pages/LandingPage';
import PinPage from './pages/PinPage';
import RoomSelectionPage from './pages/RoomSelectionPage';
import SessionHistoryPage from './pages/SessionHistoryPage';
import StaffClockPage from './pages/StaffClockPage';
import StaffSelectionPage from './pages/StaffSelectionPage';
import StudentSelectionPage from './pages/StudentSelectionPage';
import TagAssignmentPage from './pages/TagAssignmentPage';
import TeamManagementPage from './pages/TeamManagementPage';
import { setApiErrorCallback, setNetworkStatusCallback } from './services/api';
import { useUserStore } from './store/userStore';
import ErrorBoundary from './utils/errorBoundary';
import { createLogger, getRuntimeConfig, logger } from './utils/logger';

/**
 * Runs the health-check monitoring and shows the indicator when the connection
 * is poor or offline. The network status changes with every API call, so it is
 * read here and not in App: App would re-render every routed page with it.
 */
function NetworkStatusOverlay() {
  const { networkStatus } = useNetworkStatus();
  if (networkStatus.quality !== 'poor' && networkStatus.quality !== 'offline') return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '8px',
        right: '8px',
        zIndex: 1000,
        pointerEvents: 'none', // Doesn't interfere with interactions
      }}
    >
      <NetworkStatus status={networkStatus} />
    </div>
  );
}

function App() {
  const { selectedRoom, selectedActivity, updateNetworkQuality, handleAccessError } = useUserStore(
    useShallow(state => ({
      selectedRoom: state.selectedRoom,
      selectedActivity: state.selectedActivity,
      updateNetworkQuality: state.updateNetworkQuality,
      handleAccessError: state.handleAccessError,
    }))
  );
  const appLogger = useMemo(() => createLogger('App'), []);

  // Initialize logger with runtime config
  useEffect(() => {
    const config = getRuntimeConfig();
    logger.updateConfig(config);

    appLogger.info('Application initialized', {
      version: __APP_VERSION__,
      environment: import.meta.env.MODE,
    });
  }, [appLogger]);

  // Register API callback to update network status on every API call
  useEffect(() => {
    setNetworkStatusCallback(updateNetworkQuality);
    return () => setNetworkStatusCallback(null);
  }, [updateNetworkQuality]);

  // Every refused request can end the login centrally (PIN changed, device
  // without access, module not booked).
  useEffect(() => {
    setApiErrorCallback(handleAccessError);
    return () => setApiErrorCallback(null);
  }, [handleAccessError]);

  // Conditions for protected routes with additional requirements
  // Note: Authentication is handled by ProtectedRoute component
  const hasActiveSession = !!selectedActivity && !!selectedRoom;

  return (
    <ErrorBoundary>
      <RfidServiceInitializer />
      <KioskNotice />
      <NetworkStatusOverlay />
      <main className="relative z-[1] m-0 flex h-screen flex-col items-center justify-center text-center">
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/pin" element={<PinPage />} />

            {/* Protected routes - require authentication */}
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <HomeViewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tag-assignment"
              element={
                <ProtectedRoute>
                  <TagAssignmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff-clock"
              element={
                <ProtectedRoute>
                  <StaffClockPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student-selection"
              element={
                <ProtectedRoute>
                  <StudentSelectionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity-selection"
              element={
                <ProtectedRoute>
                  <CreateActivityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff-selection"
              element={
                <ProtectedRoute>
                  <StaffSelectionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/session-history"
              element={
                <ProtectedRoute>
                  <SessionHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team-management"
              element={
                <ProtectedRoute>
                  <TeamManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms"
              element={
                <ProtectedRoute>
                  <RoomSelectionPage />
                </ProtectedRoute>
              }
            />

            {/* Protected routes with additional conditions */}
            <Route
              path="/nfc-scanning"
              element={
                <ProtectedRoute condition={hasActiveSession}>
                  <ActivityScanningPage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </main>
      <span
        style={{
          position: 'fixed',
          bottom: 16,
          right: 20,
          fontSize: 16,
          color: 'rgba(0, 0, 0, 0.4)',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 999,
        }}
      >
        v{__APP_VERSION__}
      </span>
    </ErrorBoundary>
  );
}

export default App;
