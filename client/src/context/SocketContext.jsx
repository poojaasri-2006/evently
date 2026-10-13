import { SOCKET_ORIGIN, SOCKET_PATH } from '../utils/config.js';
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return;
    }

    const newSocket = io(SOCKET_ORIGIN, {
      auth: { token },
      path: SOCKET_PATH,
      transports: ['websocket'],
      reconnectionDelay: 2000
    });

    let connectedOnce = false;
    newSocket.on('connect', () => {
      if (connectedOnce) { window.dispatchEvent(new Event('api-data-invalidated')); window.dispatchEvent(new Event('notifications-updated')); }
      connectedOnce = true;
    });
    newSocket.on('notification', (data) => {
      if (data?.title) {
        showToast(data.content ? `${data.title} — ${data.content}` : data.title, 'info');
      }
      // Refresh the Topbar unread badge (it listens for this event)
      window.dispatchEvent(new Event('api-data-invalidated'));
      window.dispatchEvent(new Event('notifications-updated'));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, showToast]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
