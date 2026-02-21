const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // Allow frontend requests from different development hosts
        // (localhost, 127.0.0.1, LAN IP, etc.).
        origin: true,
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const ROOM_INACTIVITY_MS = 60 * 60 * 1000; // 1 hour
const REAPER_INTERVAL_MS = 10 * 1000; // Check every 10 seconds

// Central object for room management
const rooms = {
    'lobby': {
        type: 'permanent',
        password: null,
        lastActivity: Date.now(),
        users: new Set(), // Track users in each room
        messages: [] // Add messages array
    },
    'General': {
        type: 'permanent',
        password: null,
        lastActivity: Date.now(),
        users: new Set(),
        messages: [] // Add messages array
    },
    'Technology': {
        type: 'permanent',
        password: null,
        lastActivity: Date.now(),
        users: new Set(),
        messages: [] // Add messages array
    },
    'Gaming': {
        type: 'permanent',
        password: null,
        lastActivity: Date.now(),
        users: new Set(),
        messages: [] // Add messages array
    }
};

// Helper: remove user from room
function removeUserFromRoom(socket, roomName) {
    if (rooms[roomName]) {
        rooms[roomName].users.delete(socket.id);
        socket.leave(roomName);
        socket.to(roomName).emit('user_left', socket.id);
        io.to(roomName).emit('room_info_update', {
            room: roomName,
            users: Array.from(rooms[roomName].users).length
        });
        console.log(`User ${socket.id} left room ${roomName}`);
    }
}

// Helper: add user to room
function addUserToRoom(socket, roomName) {
    if (rooms[roomName]) {
        removeUserFromRoom(socket, socket.currentRoom); // Leave current room
        rooms[roomName].users.add(socket.id);
        socket.join(roomName);
        socket.currentRoom = roomName;
        rooms[roomName].lastActivity = Date.now(); // Update room activity
        socket.emit('joined_room', roomName);
        socket.to(roomName).emit('user_joined', socket.id);
        io.to(roomName).emit('room_info_update', {
            room: roomName,
            users: Array.from(rooms[roomName].users).length
        });
        console.log(`User ${socket.id} joined room ${roomName}`);
    }
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Put every new connection into lobby
    addUserToRoom(socket, 'lobby');

    // Room creation event
    socket.on('create_room', ({ roomName, roomType, password }) => {
        if (rooms[roomName]) {
            socket.emit('room_error', 'A room with this name already exists.');
            return;
        }

        rooms[roomName] = {
            type: roomType || 'ephemeral', // Default to ephemeral
            password: password || null,
            lastActivity: Date.now(),
            users: new Set(),
            messages: [] // Add messages array
        };
        console.log(`Room ${roomName} created with type ${roomType}`);
        socket.emit('room_created', roomName);
        addUserToRoom(socket, roomName); // Move creator to the new room
        io.emit('available_rooms', Object.keys(rooms).map(name => ({
            name,
            type: rooms[name].type,
            hasPassword: !!rooms[name].password,
            users: rooms[name].users.size
        })));
    });

    // Join room event
    socket.on('join_room', ({ roomName, password }) => {
        if (!rooms[roomName]) {
            socket.emit('room_error', 'No room exists with this name.');
            return;
        }

        if (rooms[roomName].password && rooms[roomName].password !== password) {
            socket.emit('room_error', 'Incorrect password.');
            return;
        }

        addUserToRoom(socket, roomName);
        io.emit('available_rooms', Object.keys(rooms).map(name => ({
            name,
            type: rooms[name].type,
            hasPassword: !!rooms[name].password,
            users: rooms[name].users.size
        })));
    });

    // Send message event
    socket.on('send_message', ({ roomName, message, nickname }) => { // Destructure nickname
        if (rooms[roomName]) {
            rooms[roomName].lastActivity = Date.now(); // Update activity
            const messageData = { sender: socket.id, message, roomName, nickname, timestamp: Date.now() }; // Include nickname
            
            // Store the message
            rooms[roomName].messages.push(messageData);
            if (rooms[roomName].messages.length > 10) {
                rooms[roomName].messages.shift(); // Keep only the last 10 messages
            }

            io.to(roomName).emit('new_message', messageData);
            console.log(`Message from ${nickname || socket.id} in ${roomName}: ${message}`);
        } else {
            socket.emit('room_error', 'The room for this message does not exist.');
        }
    });

    // Disconnect event
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.currentRoom) {
            removeUserFromRoom(socket, socket.currentRoom);
            io.emit('available_rooms', Object.keys(rooms).map(name => ({
                name,
                type: rooms[name].type,
                hasPassword: !!rooms[name].password,
                users: rooms[name].users.size
            })));
        }
    });

    // Request available rooms
    socket.on('get_available_rooms', () => {
        socket.emit('available_rooms', Object.keys(rooms).map(name => ({
            name,
            type: rooms[name].type,
            hasPassword: !!rooms[name].password,
            users: rooms[name].users.size
        })));
    });

    // Send message history event
    socket.on('get_message_history', ({ roomName }) => {
        if (rooms[roomName]) {
            socket.emit('message_history', rooms[roomName].messages);
            console.log(`Sent message history for room ${roomName} to ${socket.id}`);
        }
    });
});

// Reaper for inactive ephemeral rooms
setInterval(() => {
    const now = Date.now();
    const cutoff = now - ROOM_INACTIVITY_MS;
    const roomsToDelete = [];

    for (const roomName in rooms) {
        if (roomName === 'lobby') continue; // Never delete lobby

        const room = rooms[roomName];
        if (room.type === 'ephemeral' && room.lastActivity < cutoff) {
            console.log(`Ephemeral room '${roomName}' has been inactive for ${ROOM_INACTIVITY_MS} ms. Deleting.`);
            roomsToDelete.push(roomName);
        }
    }

    roomsToDelete.forEach(roomName => {
        // Move all room users to lobby
        const roomSockets = io.sockets.adapter.rooms.get(roomName);
        if (roomSockets) {
            roomSockets.forEach(socketId => {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.emit('room_message', `Room '${roomName}' was deleted due to inactivity. You were moved to the lobby.`);
                    removeUserFromRoom(socket, roomName); // Leave old room
                    addUserToRoom(socket, 'lobby'); // Lobiye ekle
                }
            });
        }
        delete rooms[roomName]; // Delete room
        io.emit('room_deleted', roomName);
        console.log(`Room '${roomName}' deleted.`);
    });

    // Broadcast updated room list
    io.emit('available_rooms', Object.keys(rooms).map(name => ({
        name,
        type: rooms[name].type,
        hasPassword: !!rooms[name].password,
        users: rooms[name].users.size
    })));

}, REAPER_INTERVAL_MS);

app.get('/', (req, res) => {
    res.send('Ephemeral Chat Backend is running.');
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
