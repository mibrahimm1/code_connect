import { Server, Socket } from 'socket.io';

interface Room {
    id: string;
    password?: string;
    participants: string[];
}

const rooms: Record<string, Room> = {};

export function setupSignaling(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log('User connected to signaling:', socket.id);

        socket.on('create-room', (payload: { roomId: string; password?: string }, callback: (response: { success: boolean; message?: string }) => void) => {
            const { roomId, password } = payload;

            if (rooms[roomId]) {
                callback({ success: false, message: 'Room already exists' });
                return;
            }

            rooms[roomId] = { id: roomId, password, participants: [socket.id] };
            socket.join(roomId);
            console.log(`User ${socket.id} created room ${roomId}`);
            callback({ success: true });
        });

        socket.on('join-room', (payload: { roomId: string; password?: string }, callback: (response: { success: boolean; message?: string }) => void) => {
            const { roomId, password } = payload;
            const room = rooms[roomId];

            if (!room) {
                callback({ success: false, message: 'Room does not exist' });
                return;
            }

            if (room.password && room.password !== password) {
                callback({ success: false, message: 'Incorrect password' });
                return;
            }

            if (room.participants.length >= 2) {
                callback({ success: false, message: 'Room is full' });
                return;
            }

            room.participants.push(socket.id);
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);

            // Notify existing participant
            socket.to(roomId).emit('user-connected', socket.id);

            callback({ success: true });
        });

        socket.on('offer', (payload: { target: string; sdp: any }) => {
            io.to(payload.target).emit('offer', { sdp: payload.sdp, caller: socket.id });
        });

        socket.on('answer', (payload: { target: string; sdp: any }) => {
            io.to(payload.target).emit('answer', { sdp: payload.sdp, caller: socket.id });
        });

        socket.on('ice-candidate', (payload: { target: string; candidate: any }) => {
            io.to(payload.target).emit('ice-candidate', { candidate: payload.candidate, caller: socket.id });
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            // Remove from rooms
            for (const roomId in rooms) {
                const room = rooms[roomId];
                const index = room.participants.indexOf(socket.id);
                if (index !== -1) {
                    room.participants.splice(index, 1);
                    socket.to(roomId).emit('user-disconnected', socket.id);
                    if (room.participants.length === 0) {
                        delete rooms[roomId];
                    }
                }
            }
        });
    });
}
