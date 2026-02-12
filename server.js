const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Oda yönetimi için merkezi bir obje
const rooms = {
    'lobby': {
        type: 'permanent',
        password: null,
        lastActivity: Date.now(),
        users: new Set(), // Her odada kimlerin olduğunu takip etmek için
        messages: [] // Add messages array
    },
    'Genel': {
        type: 'permanent',
        password: null,
        lastActivity: Date.now(),
        users: new Set(),
        messages: [] // Add messages array
    },
    'Teknoloji': {
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

// Yardımcı fonksiyon: Kullanıcıyı odadan çıkar
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

// Yardımcı fonksiyon: Kullanıcıyı odaya ekle
function addUserToRoom(socket, roomName) {
    if (rooms[roomName]) {
        removeUserFromRoom(socket, socket.currentRoom); // Mevcut odadan çıkar
        rooms[roomName].users.add(socket.id);
        socket.join(roomName);
        socket.currentRoom = roomName;
        rooms[roomName].lastActivity = Date.now(); // Oda aktivitesini güncelle
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

    // Her yeni bağlantıda kullanıcıyı lobiye al
    addUserToRoom(socket, 'lobby');

    // Oda oluşturma eventi
    socket.on('create_room', ({ roomName, roomType, password }) => {
        if (rooms[roomName]) {
            socket.emit('room_error', 'Bu isimde bir oda zaten mevcut.');
            return;
        }

        rooms[roomName] = {
            type: roomType || 'ephemeral', // Varsayılan ephemeral
            password: password || null,
            lastActivity: Date.now(),
            users: new Set(),
            messages: [] // Add messages array
        };
        console.log(`Room ${roomName} created with type ${roomType}`);
        socket.emit('room_created', roomName);
        addUserToRoom(socket, roomName); // Odayı oluşturan kullanıcıyı yeni odaya al
        io.emit('available_rooms', Object.keys(rooms).map(name => ({
            name,
            type: rooms[name].type,
            hasPassword: !!rooms[name].password,
            users: rooms[name].users.size
        })));
    });

    // Odaya katılma eventi
    socket.on('join_room', ({ roomName, password }) => {
        if (!rooms[roomName]) {
            socket.emit('room_error', 'Bu isimde bir oda mevcut değil.');
            return;
        }

        if (rooms[roomName].password && rooms[roomName].password !== password) {
            socket.emit('room_error', 'Yanlış şifre.');
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

    // Mesaj gönderme eventi
    socket.on('send_message', ({ roomName, message, nickname }) => { // Destructure nickname
        if (rooms[roomName]) {
            rooms[roomName].lastActivity = Date.now(); // Aktiviteyi güncelle
            const messageData = { sender: socket.id, message, roomName, nickname, timestamp: Date.now() }; // Include nickname
            
            // Store the message
            rooms[roomName].messages.push(messageData);
            if (rooms[roomName].messages.length > 10) {
                rooms[roomName].messages.shift(); // Keep only the last 10 messages
            }

            io.to(roomName).emit('new_message', messageData);
            console.log(`Message from ${nickname || socket.id} in ${roomName}: ${message}`);
        } else {
            socket.emit('room_error', 'Mesaj gönderilen oda mevcut değil.');
        }
    });

    // Bağlantı kesilmesi
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

    // Mevcut odaları listeleme isteği
    socket.on('get_available_rooms', () => {
        socket.emit('available_rooms', Object.keys(rooms).map(name => ({
            name,
            type: rooms[name].type,
            hasPassword: !!rooms[name].password,
            users: rooms[name].users.size
        })));
    });

    // Mesaj geçmişini gönderme eventi
    socket.on('get_message_history', ({ roomName }) => {
        if (rooms[roomName]) {
            socket.emit('message_history', rooms[roomName].messages);
            console.log(`Sent message history for room ${roomName} to ${socket.id}`);
        }
    });
});

// The 30-Second Reaper: Her 10 saniyede bir çalışan bir setInterval (TEST MODE)
setInterval(() => {
    const now = Date.now();
    const thirtySecondsAgo = now - (30 * 1000); // 30 saniye = 30.000 ms
    const roomsToDelete = [];

    for (const roomName in rooms) {
        if (roomName === 'lobby') continue; // Lobi odası silinmez

        const room = rooms[roomName];
        if (room.type === 'ephemeral' && room.lastActivity < thirtySecondsAgo) {
            console.log(`Ephemeral room '${roomName}' has been inactive for 30 seconds. Deleting.`);
            roomsToDelete.push(roomName);
        }
    }

    roomsToDelete.forEach(roomName => {
        // Odadaki tüm kullanıcıları lobiye taşı
        io.sockets.in(roomName).sockets.forEach(socketId => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('room_message', `Oda '${roomName}' etkinlik olmadığından silindi. Lobiye yönlendirildiniz.`);
                removeUserFromRoom(socket, roomName); // Eski odadan çıkar
                addUserToRoom(socket, 'lobby'); // Lobiye ekle
            }
        });
        delete rooms[roomName]; // Odayı sil
        io.emit('room_deleted', roomName);
        console.log(`Room '${roomName}' deleted.`);
    });

    // Odalar listesini güncelleyelim
    io.emit('available_rooms', Object.keys(rooms).map(name => ({
        name,
        type: rooms[name].type,
        hasPassword: !!rooms[name].password,
        users: rooms[name].users.size
    })));

}, 10 * 1000); // Her 10 saniyede bir çalışır (TEST MODE)

app.get('/', (req, res) => {
    res.send('Ephemeral Chat Backend is running.');
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
