import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Module-level singleton so all panels share one connection per session
let _socket = null;

export function useRoomSocket(roomCode) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomCode) return;
    if (!_socket || _socket.disconnected) {
      const socketUrl =
        import.meta.env.VITE_SOCKET_URL ||
        import.meta.env.VITE_API_BASE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');
      _socket = io(socketUrl);
    }
    socketRef.current = _socket;
    _socket.emit('room:join', roomCode);
  }, [roomCode]);

  return socketRef;
}
