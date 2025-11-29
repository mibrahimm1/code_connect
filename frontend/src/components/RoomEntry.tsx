import React, { useState } from 'react';
import { Socket } from 'socket.io-client';

interface RoomEntryProps {
    socket: Socket | null;
    onJoin: (roomId: string) => void;
}

export const RoomEntry: React.FC<RoomEntryProps> = ({ socket, onJoin }) => {
    const [mode, setMode] = useState<'create' | 'join'>('create');
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!socket) {
            setError('Not connected to server');
            return;
        }

        if (!roomId.trim()) {
            setError('Room ID is required');
            return;
        }

        const event = mode === 'create' ? 'create-room' : 'join-room';

        socket.emit(event, { roomId, password }, (response: { success: boolean; message?: string }) => {
            if (response.success) {
                onJoin(roomId);
            } else {
                setError(response.message || 'Unknown error');
            }
        });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">
                    {mode === 'create' ? 'Create a Room' : 'Join a Room'}
                </h1>

                <div className="flex gap-4 mb-6 justify-center">
                    <button
                        onClick={() => setMode('create')}
                        className={`px-4 py-2 rounded ${mode === 'create' ? 'bg-blue-600' : 'bg-gray-700'}`}
                    >
                        Create
                    </button>
                    <button
                        onClick={() => setMode('join')}
                        className={`px-4 py-2 rounded ${mode === 'join' ? 'bg-blue-600' : 'bg-gray-700'}`}
                    >
                        Join
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Room ID</label>
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            className="w-full bg-gray-700 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. room-1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Password {mode === 'create' && '(Optional)'}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-700 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter password"
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm text-center">{error}</div>}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-medium transition-colors"
                    >
                        {mode === 'create' ? 'Create & Join' : 'Join Room'}
                    </button>
                </form>
            </div>
        </div>
    );
};
