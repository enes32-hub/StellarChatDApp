import { io } from 'socket.io-client';

// Socket instance
let socket = null;

// Backend URL
const SERVER_URL = 'http://localhost:3000';

/**
 * Socket bağlantısını başlat
 */
export const connectSocket = () => {
  if (!socket || !socket.connected) {
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  return socket;
};

/**
 * Socket bağlantısını kes
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket disconnected manually');
  }
};

/**
 * Socket instance'ını döndür
 */
export const getSocket = () => {
  if (!socket) {
    throw new Error('Socket not initialized. Call connectSocket() first.');
  }
  return socket;
};

// ==================== EMITTERS ====================

/**
 * Yeni oda oluştur
 */
export const emitCreateRoom = (roomName, roomType = 'ephemeral', password = null) => {
  if (socket) {
    socket.emit('create_room', { roomName, roomType, password });
  }
};

/**
 * Odaya katıl
 */
export const emitJoinRoom = (roomName, password = null) => {
  if (socket) {
    socket.emit('join_room', { roomName, password });
  }
};

/**
 * Mesaj gönder
 */
export const emitSendMessage = (roomName, message, nickname) => {
  if (socket) {
    socket.emit('send_message', { roomName, message, nickname });
  }
};

/**
 * Mevcut odaları getir
 */
export const emitGetRooms = () => {
  if (socket) {
    socket.emit('get_available_rooms');
  }
};

/**
 * Oda mesaj geçmişini talep et
 */
export const emitGetMessageHistory = (roomName) => {
  if (socket) {
    socket.emit('get_message_history', { roomName });
  }
};

// ==================== LISTENERS ====================

/**
 * Yeni mesaj event'ini dinle
 */
export const onNewMessage = (callback) => {
  if (socket) {
    socket.on('new_message', callback);
  }
};

/**
 * Oda oluşturuldu event'ini dinle
 */
export const onRoomCreated = (callback) => {
  if (socket) {
    socket.on('room_created', callback);
  }
};

/**
 * Odaya katıldın event'ini dinle
 */
export const onJoinedRoom = (callback) => {
  if (socket) {
    socket.on('joined_room', callback);
  }
};

/**
 * Oda hata event'ini dinle
 */
export const onRoomError = (callback) => {
  if (socket) {
    socket.on('room_error', callback);
  }
};

/**
 * Mevcut odalar listesi event'ini dinle
 */
export const onAvailableRooms = (callback) => {
  if (socket) {
    socket.on('available_rooms', callback);
  }
};

/**
 * Kullanıcı odaya katıldı event'ini dinle
 */
export const onUserJoined = (callback) => {
  if (socket) {
    socket.on('user_joined', callback);
  }
};

/**
 * Kullanıcı odadan ayrıldı event'ini dinle
 */
export const onUserLeft = (callback) => {
  if (socket) {
    socket.on('user_left', callback);
  }
};

/**
 * Oda silindi event'ini dinle
 */
export const onRoomDeleted = (callback) => {
  if (socket) {
    socket.on('room_deleted', callback);
  }
};

/**
 * Oda bilgisi güncellendi event'ini dinle
 */
export const onRoomInfoUpdate = (callback) => {
  if (socket) {
    socket.on('room_info_update', callback);
  }
};

/**
 * Oda mesajı event'ini dinle (sistem mesajları)
 */
export const onRoomMessage = (callback) => {
  if (socket) {
    socket.on('room_message', callback);
  }
};

/**
 * Oda mesaj geçmişi event'ini dinle
 */
export const onMessageHistory = (callback) => {
  if (socket) {
    socket.on('message_history', callback);
  }
};
