import { Server, Socket } from 'socket.io';

interface Room {
    id: string;
    password?: string;
    participants: string[];
}

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
