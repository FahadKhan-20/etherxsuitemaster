import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Module-level singleton so all panels share one connection per session
let _socket = null;

export function useRoomSocket(roomCode) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomCode) return;
    if (!_socket || _socket.disconnected) {
      _socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000');
    }
    socketRef.current = _socket;
    _socket.emit('room:join', roomCode);
  }, [roomCode]);

  return socketRef;
}
