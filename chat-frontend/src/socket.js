import { io } from 'socket.io-client';

// Socket instance
let socket = null;

// Backend URL
const SERVER_URL = 'http://localhost:3000';

/**
 * Initialize socket connection
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
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  return socket;
};

/**
 * Close socket connection
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket disconnected manually');
  }
};

/**
 * Get socket instance
 */
export const getSocket = () => {
  if (!socket) {
    throw new Error('Socket not initialized. Call connectSocket() first.');
  }
  return socket;
};

// ==================== EMITTERS ====================

/**
 * Create a new room
 */
export const emitCreateRoom = (roomName, roomType = 'ephemeral', password = null) => {
  if (socket) {
    socket.emit('create_room', { roomName, roomType, password });
  }
};

/**
 * Join a room
 */
export const emitJoinRoom = (roomName, password = null) => {
  if (socket) {
    socket.emit('join_room', { roomName, password });
  }
};

/**
 * Send a message
 */
export const emitSendMessage = (roomName, message, nickname) => {
  if (socket) {
    socket.emit('send_message', { roomName, message, nickname });
  }
};

/**
 * Request available rooms
 */
export const emitGetRooms = () => {
  if (socket) {
    socket.emit('get_available_rooms');
  }
};

/**
 * Request room message history
 */
export const emitGetMessageHistory = (roomName) => {
  if (socket) {
    socket.emit('get_message_history', { roomName });
  }
};

// ==================== LISTENERS ====================

/**
 * Listen for new messages
 */
export const onNewMessage = (callback) => {
  if (socket) {
    socket.on('new_message', callback);
  }
};

/**
 * Listen for room created event
 */
export const onRoomCreated = (callback) => {
  if (socket) {
    socket.on('room_created', callback);
  }
};

/**
 * Listen for joined room event
 */
export const onJoinedRoom = (callback) => {
  if (socket) {
    socket.on('joined_room', callback);
  }
};

/**
 * Listen for room error event
 */
export const onRoomError = (callback) => {
  if (socket) {
    socket.on('room_error', callback);
  }
};

/**
 * Listen for available rooms event
 */
export const onAvailableRooms = (callback) => {
  if (socket) {
    socket.on('available_rooms', callback);
  }
};

/**
 * Listen for user joined event
 */
export const onUserJoined = (callback) => {
  if (socket) {
    socket.on('user_joined', callback);
  }
};

/**
 * Listen for user left event
 */
export const onUserLeft = (callback) => {
  if (socket) {
    socket.on('user_left', callback);
  }
};

/**
 * Listen for room deleted event
 */
export const onRoomDeleted = (callback) => {
  if (socket) {
    socket.on('room_deleted', callback);
  }
};

/**
 * Listen for room info updates
 */
export const onRoomInfoUpdate = (callback) => {
  if (socket) {
    socket.on('room_info_update', callback);
  }
};

/**
 * Listen for room system messages
 */
export const onRoomMessage = (callback) => {
  if (socket) {
    socket.on('room_message', callback);
  }
};

/**
 * Listen for room message history
 */
export const onMessageHistory = (callback) => {
  if (socket) {
    socket.on('message_history', callback);
  }
};
