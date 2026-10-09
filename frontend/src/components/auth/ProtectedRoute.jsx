import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../../utils/auth';
import { ROUTES } from '../../utils/constants';
import MeetingReminders from '../layout/MeetingReminders';

export default function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  return (
    <>
      <MeetingReminders />
      <Outlet />
    </>
  );
}
