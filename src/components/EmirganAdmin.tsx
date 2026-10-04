import React from 'react';
import AdminPanel from './AdminPanel';
import { Socket } from 'socket.io-client';

export interface EmirganAdminProps {
  socket: Socket | null;
  currentUsername: string;
  onUserClick?: (userId: number) => void;
  onPendingCountChange?: (count: number) => void;
}

export { AdminPanel };

export default function EmirganAdmin(props: EmirganAdminProps) {
  return <AdminPanel {...props} />;
}
