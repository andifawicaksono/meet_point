import { Outlet, useLocation } from 'react-router-dom';
import ExportButton from './ExportButton';

// Matches /room/<uuid> — room pages get the export button
const ROOM_PATTERN = /^\/room\/[^/]+/;

/**
 * Shared layout wrapper for all authenticated pages.
 * Renders the matched child route via <Outlet> and conditionally
 * mounts <ExportButton> on room pages.
 *
 * ExportButton is fixed-positioned and reads roomId + roomName
 * from useParams / roomStore internally, so no props are needed here.
 */
export default function Layout() {
  const { pathname } = useLocation();
  const isRoomPage = ROOM_PATTERN.test(pathname);

  return (
    <>
      <Outlet />
      {isRoomPage && <ExportButton />}
    </>
  );
}
