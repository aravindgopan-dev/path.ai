import { io, Socket } from "socket.io-client";

// Create a singleton socket instance
let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io("http://localhost:3001", {
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });
    }
    return socket;
};

export default getSocket;
