import { useState, useEffect, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';
import toast, { Toaster } from 'react-hot-toast';
import { createAvatar } from '@dicebear/core';
import { identicon } from '@dicebear/collection';
import * as StellarSdk from 'stellar-sdk';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  emitCreateRoom,
  emitJoinRoom,
  emitSendMessage,
  emitGetRooms,
  onNewMessage,
  onJoinedRoom,
  onRoomError,
  onAvailableRooms,
  onUserJoined,
  onUserLeft,
  onRoomDeleted,
  onRoomMessage,
  onRoomInfoUpdate,
  emitGetMessageHistory, // Yeni eklendi
  onMessageHistory,     // Yeni eklendi
} from './socket';
import {
  connectWallet as connectFreighterWallet,
  disconnectWallet as disconnectFreighterWallet,
  sendPayment,
  checkConnection,
  getBalance
} from './utils/freighterUtils';

// Soroban Contract ID (Deploy sonrası güncellenecek)
const CONTRACT_ID = 'CC3D5HEWNTBGTTNGIGT7EEY44WHGB3IMWYCVPSZGZSGLLUGAXGV4TKTN';
const STELLAR_NETWORK = StellarSdk.Networks.TESTNET;
const ROOM_CREATION_FEE = 0.1; // XLM cinsinden cüzi bir miktar

function ChatApp() {
  // ==================== STATE ====================

  // Wallet State
  const [publicKey, setPublicKey] = useState(null);
  const [balance, setBalance] = useState('0');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [nickname, setNickname] = useState(() => {
    const savedNickname = localStorage.getItem('nickname');
    return savedNickname || '';
  });
  const [pendingNickname, setPendingNickname] = useState(nickname); // Initialize pendingNickname

  // Chat State
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('lobby');
  const [messages, setMessages] = useState([]);
  const [roomExpirationTime, setRoomExpirationTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // UI State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [messageInput, setMessageInput] = useState('');

  // Create Room Modal State
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState('ephemeral');
  const [newRoomPassword, setNewRoomPassword] = useState('');

  // Join Room Password State
  const [pendingRoomName, setPendingRoomName] = useState('');
  const [joinRoomPassword, setJoinRoomPassword] = useState('');

  // Donate Modal State
  const [donateAmount, setDonateAmount] = useState('');

  // Refs
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);

  // ==================== SOCKET HANDLERS ====================

  function handleNewMessage(data) {
    setMessages(prev => [...prev, data]);

    // Play notification sound if not my message
    try {
      const socket = getSocket();
      if (socket && data.sender !== socket.id) {
        playNotificationSound();
      }
    } catch (error) {
      console.error('Error in handleNewMessage:', error);
    }
  }

  function handleRoomsUpdate(roomsList) {
    setRooms(roomsList);
  }

  function handleJoinedRoom(roomName) {
    setCurrentRoom(roomName);
    setMessages([]); // Odaya katılırken mevcut mesajları temizle
    emitGetMessageHistory(roomName); // Mesaj geçmişini talep et
    toast.success(`${roomName} odasına katıldınız!`);
  }

  function handleRoomError(errorMessage) {
    toast.error(errorMessage);
  }

  function handleUserJoined(userId) {
    console.log('User joined:', userId);
  }

  function handleUserLeft(userId) {
    console.log('User left:', userId);
  }

  function handleRoomDeleted(roomName) {
    toast.error(`${roomName} odası silindi!`);
    if (currentRoom === roomName) {
      setCurrentRoom('lobby');
    }
  }

  function handleRoomSystemMessage(message) {
    toast(message, { icon: 'ℹ️' });
  }

  function handleRoomInfoUpdate(data) {
    setRooms(prevRooms =>
      prevRooms.map(room =>
        room.name === data.room
          ? { ...room, users: data.users }
          : room
      )
    );
    if (data.room === currentRoom && data.expiresAt) {
      setRoomExpirationTime(data.expiresAt);
    }
  }

  function handleMessageHistory(messagesHistory) {
    // Mesaj geçmişini yüklerken mevcut mesajları temizle
    setMessages(messagesHistory);
  }

  // ==================== WALLET FUNCTIONS ====================

  // ==================== WALLET FUNCTIONS (Using freighterUtils) ====================

  async function checkFreighterConnection() {
    try {
      console.log('='.repeat(60));
      console.log('🚀 [ChatApp] Component mounted, checking Freighter...');

      const connectionResult = await checkConnection(); // Use the new checkConnection function

      if (connectionResult.publicKey) {
        setPublicKey(connectionResult.publicKey);
        setBalance(await getBalance(connectionResult.publicKey));
        setIsWalletConnected(true);
        toast.success('🎉 Cüzdan otomatik olarak bağlandı!');
        console.log('✅ [ChatApp] Wallet auto-connected');
      } else if (connectionResult.error) {
        toast.error(`Cüzdan kontrolü sırasında hata oluştu: ${connectionResult.error}`);
        console.error('❌ [ChatApp] Error in checkFreighterConnection:', connectionResult.error);
      } else {
        console.log('ℹ️ [ChatApp] User not connected, waiting for manual connect');
      }

      console.log('='.repeat(60));
    } catch (error) {
      console.error('❌ [ChatApp] Unexpected error in checkFreighterConnection:', error);
      toast.error(`Beklenmeyen hata: ${error.message}`);
    }
  }

  const connectWallet = async () => {
    try {
      console.log('='.repeat(60));
      console.log('🔗 [ChatApp] User clicked Connect Wallet button');
      console.log('='.repeat(60));

      const loadingToast = toast.loading('Cüzdan bağlanıyor...');
      const result = await connectFreighterWallet();
      toast.dismiss(loadingToast);

      if (result.success) {
        setPublicKey(result.publicKey);
        setBalance(await getBalance(result.publicKey));
        setIsWalletConnected(true);
        toast.success('🎉 Cüzdan başarıyla bağlandı!');
        console.log('✅ [ChatApp] Wallet connected successfully');
      } else {
        console.error('❌ [ChatApp] Wallet connection failed:', result.error);
        toast.error(`Cüzdan bağlantısı başarısız: ${result.error}`, { duration: 5000 });
      }

      console.log('='.repeat(60));
    } catch (error) {
      console.error('❌ [ChatApp] Unexpected error in connectWallet:', error);
      toast.error(`Beklenmeyen hata: ${error.message}`, { duration: 5000 });
    }
  };

  const disconnectWallet = () => {
    console.log('🔌 [ChatApp] Disconnecting wallet...');

    setPublicKey(null);
    setBalance('0.00');
    setIsWalletConnected(false);

    disconnectFreighterWallet();
    toast.success('Cüzdan bağlantısı kesildi');
    console.log('✅ [ChatApp] Wallet disconnected, state cleared');
  };

  // ==================== CHAT FUNCTIONS ====================

  const handleCreateRoom = async () => { // Make it async
    if (!newRoomName.trim()) {
      toast.error('Oda adı gerekli!');
      return;
    }

    if (!isWalletConnected) {
      toast.error('Oda oluşturmak için cüzdanınızı bağlamalısınız!');
      return;
    }

    const adminAddress = 'GAH3WM7BDRBYGFTRPLI6DHYO2GREMTILTN4NYBAHYLIWK4JLLRO2HJBH'; // Oda ücreti alıcısı

    toast.loading(`Oda oluşturma ücreti (${ROOM_CREATION_FEE} XLM) ödeniyor...`, { id: 'room-fee' });

    try {
      const paymentResult = await sendPayment(publicKey, adminAddress, ROOM_CREATION_FEE.toString());

      if (paymentResult.success) {
        toast.success('Oda ücreti başarıyla ödendi. Oda oluşturuluyor...', { id: 'room-fee' });
        emitCreateRoom(newRoomName.trim(), newRoomType, newRoomPassword || null);

        setNewRoomName('');
        setNewRoomType('ephemeral');
        setNewRoomPassword('');
        setShowCreateRoomModal(false);
      } else {
        toast.error(`Oda ücreti ödemesi başarısız: ${paymentResult.error}`, { id: 'room-fee' });
      }
    } catch (error) {
      console.error('Oda ücreti ödemesi sırasında beklenmeyen hata:', error);
      toast.error(`Beklenmeyen hata: ${error.message}`, { id: 'room-fee' });
    }
  };

  const handleJoinRoom = (roomName, hasPassword) => {
    if (hasPassword && roomName !== 'lobby') {
      setPendingRoomName(roomName);
      setShowPasswordModal(true);
    } else {
      emitJoinRoom(roomName, null);
    }
  };

  const handleJoinWithPassword = () => {
    if (!joinRoomPassword.trim()) {
      toast.error('Şifre gerekli!');
      return;
    }

    emitJoinRoom(pendingRoomName, joinRoomPassword);
    setJoinRoomPassword('');
    setShowPasswordModal(false);
    setPendingRoomName('');
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    // Pass the current nickname to emitSendMessage
    emitSendMessage(currentRoom, messageInput.trim(), nickname);
    setMessageInput('');
    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiSelect = (emojiData) => {
    setMessageInput(prev => prev + emojiData.emoji);
  };

  // ==================== SOROBAN CONTRACT FUNCTIONS ====================

  const handleDonateToAdmin = async () => {
    console.log('='.repeat(60));
    console.log('💰 [ChatApp] User clicked Donate button');
    console.log('='.repeat(60));

    // Validation
    if (!isWalletConnected) {
      toast.error('Önce cüzdanınızı bağlayın!');
      console.warn('⚠️ [ChatApp] Wallet not connected, cannot donate');
      return;
    }

    if (!donateAmount || parseFloat(donateAmount) <= 0) {
      toast.error('Geçerli bir miktar girin!');
      console.warn('⚠️ [ChatApp] Invalid donation amount:', donateAmount);
      return;
    }

    try {
      const amount = parseFloat(donateAmount);
      const adminAddress = 'GAH3WM7BDRBYGFTRPLI6DHYO2GREMTILTN4NYBAHYLIWK4JLLRO2HJBH';

      console.log('📊 [ChatApp] Donation details:', {
        from: publicKey,
        to: adminAddress,
        amount: amount + ' XLM'
      });

      // Show loading
      toast.loading('Bağış işlemi hazırlanıyor...', { id: 'donate' });

      // Use utility function to send payment
      const result = await sendPayment(publicKey, adminAddress, amount.toString());

      if (result.success) {
        // Success!
        toast.success('🎉 Bağış başarılı! Teşekkürler!', { id: 'donate' });
        console.log('✅ [ChatApp] Donation successful!');
        console.log('Transaction hash:', result.txHash);
        console.log('Explorer:', `https://stellar.expert/explorer/testnet/tx/${result.txHash}`);

        // Refresh balance by reconnecting
        const refreshResult = await connectFreighterWallet();
        if (refreshResult.success) {
          setBalance(await getBalance(refreshResult.publicKey));
          console.log('💰 [ChatApp] Balance refreshed:', refreshResult.balance, 'XLM');
        }

        // Close modal
        setDonateAmount('');
        setShowDonateModal(false);
      } else {
        // Error
        toast.error(`Bağış başarısız: ${result.error}`, { id: 'donate' });
        console.error('❌ [ChatApp] Donation failed:', result.error);
      }

      console.log('='.repeat(60));
    } catch (error) {
      console.error('❌ [ChatApp] Unexpected error in donation:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      toast.error(`Beklenmeyen hata: ${error.message}`, { id: 'donate' });
    }
  };

  // ==================== UTILITY FUNCTIONS ====================

  const generateAvatar = (address) => {
    if (!address) return ''; // Adres yoksa boş bir string döndürerek hatayı önle
    const avatar = createAvatar(identicon, {
      seed: address,
      size: 40,
    });
    // SVG'yi bir veri URI'sine dönüştür. Bu, <img> etiketlerinde doğrudan kullanım için gereklidir.
    const svg = avatar.toString();
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => console.log('Audio play error:', err));
    }
  };

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // ==================== EFFECTS ====================

  // Socket Setup
  // Socket listeners are registered once at mount.
  useEffect(() => {
    connectSocket();

    onNewMessage(handleNewMessage);
    onAvailableRooms(handleRoomsUpdate);
    onJoinedRoom(handleJoinedRoom);
    onRoomError(handleRoomError);
    onUserJoined(handleUserJoined);
    onUserLeft(handleUserLeft);
    onRoomDeleted(handleRoomDeleted);
    onRoomMessage(handleRoomSystemMessage);
    onRoomInfoUpdate(handleRoomInfoUpdate);
    onMessageHistory(handleMessageHistory);

    emitGetRooms();

    return () => {
      disconnectSocket();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wallet Check
  useEffect(() => {
    const timeout = setTimeout(() => {
      checkFreighterConnection();
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  // Auto Scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Nickname Save Effect
  useEffect(() => {
    localStorage.setItem('nickname', nickname);
  }, [nickname]);

  // Room Expiration Countdown Effect
  useEffect(() => {
    if (!roomExpirationTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      const remaining = roomExpirationTime - now;

      if (remaining <= 0) {
        setRoomExpirationTime(null);
        if (currentRoom !== 'lobby') {
          toast.error(`${currentRoom} odasının süresi doldu ve kapatıldı.`);
          setCurrentRoom('lobby');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomExpirationTime, currentRoom]);

  const formatRemainingTime = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // ==================== RENDER ====================

  const permanentRooms = ['Genel', 'Teknoloji', 'Gaming'];
  const ephemeralRooms = rooms.filter(r => r.type === 'ephemeral');
  const currentRoomMessages = messages.filter(m => m.roomName === currentRoom);

  return (
    <div className="flex h-screen">
      <Toaster position="top-right" />

      {/* Notification Audio */}
      <audio ref={audioRef} src="/notification.mp3" />

      {/* LEFT SIDEBAR */}
      <div className="w-80 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">⭐ Stellar Chat</h1>

        </div>

        {/* Wallet Section */}
        <div className="p-4 border-b border-gray-300 dark:border-gray-700">
          {isWalletConnected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img
                  src={generateAvatar(publicKey)}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-white truncate">
                    {formatAddress(publicKey)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {balance} XLM
                  </div>
                </div>
              </div>
              <button
                onClick={disconnectWallet}
                className="w-full px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="w-full px-4 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-medium transition"
            >
              🔗 Connect Freighter
            </button>
          )}
        </div>

        {/* Nickname Section */}
        <div className="p-4 border-b border-gray-300">
          <label htmlFor="nickname" className="block text-xs font-semibold text-gray-500 uppercase mb-2">
            Takma Adınız
          </label>
          <div className="flex gap-2"> {/* Added flex container for input and button */}
            <input
              id="nickname"
              type="text"
              value={pendingNickname} // Use pendingNickname here
              onChange={(e) => setPendingNickname(e.target.value)} // Update pendingNickname
              placeholder="Takma adınızı girin"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={20} // Limit nickname length
            />
            <button
              onClick={() => {
                setNickname(pendingNickname); // Update actual nickname state
                toast.success('Takma adınız güncellendi!');
              }}
              className="px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg font-medium transition"
              disabled={pendingNickname === nickname} // Disable if no change
            >
              Kaydet
            </button>
          </div>
        </div>

        {/* Rooms List */}
        <div className="flex-1 overflow-y-auto">
          {/* Permanent Rooms */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
              Kalıcı Odalar
            </h3>
            {permanentRooms.map(roomName => {
              const room = rooms.find(r => r.name === roomName) || { users: 0 };
              return (
                <button
                  key={roomName}
                  onClick={() => handleJoinRoom(roomName, false)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition ${
                    currentRoom === roomName
                      ? 'bg-primary text-white'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium"># {roomName}</span>
                    {room.users > 0 && (
                      <span className="text-xs opacity-70">{room.users}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Ephemeral Rooms */}
          <div className="p-4 border-t border-gray-300 dark:border-gray-700 relative">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
              Geçici Odalar
            </h3>
            {ephemeralRooms.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Henüz geçici oda yok</p>
            ) : (
              ephemeralRooms.map(room => (
                <button
                  key={room.name}
                  onClick={() => handleJoinRoom(room.name, room.hasPassword)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition ${
                    currentRoom === room.name
                      ? 'bg-primary text-white'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-1">
                      {room.hasPassword && '🔒'} # {room.name}
                    </span>
                    <span className="text-xs opacity-70">{room.users}</span>
                  </div>
                </button>
              ))
            )}
            <div className="relative">
              <button
                onClick={() => { setShowCreateRoomModal(true); setShowDonateModal(false); }}
                className="w-full px-3 py-2 mt-2 bg-secondary hover:bg-green-600 text-white rounded-lg font-medium transition"
              >
                + Yeni Oda
              </button>
              {showCreateRoomModal && (
                <div className="absolute top-full left-0 mt-2 z-50">
                  <div className="bg-white border-4 border-black p-6 w-96">
                    <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Yeni Oda Oluştur</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                          Oda Adı
                        </label>
                        <input
                          type="text"
                          value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                          placeholder="örn: Web3 Sohbet"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                          Oda Türü
                        </label>
                        <select
                          value={newRoomType}
                          onChange={(e) => setNewRoomType(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:focus:ring-primary"
                        >
                          <option value="ephemeral">Geçici (10 dk sonra silinir)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                          Şifre (Opsiyonel)
                        </label>
                        <input
                          type="password"
                          value={newRoomPassword}
                          onChange={(e) => setNewRoomPassword(e.target.value)}
                          placeholder="Boş bırakabilirsiniz"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                      <button
                        onClick={() => setShowCreateRoomModal(false)}
                        className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg transition"
                      >
                        İptal
                      </button>
                      <button
                        onClick={handleCreateRoom}
                        className="flex-1 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition"
                      >
                        Oluştur
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">

        {/* Chat Header */}
        <div className="p-4 border-b border-gray-300 flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">
            # {currentRoom}
          </h2>
          {roomExpirationTime && (
            <span className="text-sm text-gray-600">
              Kalan Süre: {formatRemainingTime(roomExpirationTime - currentTime)}
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => { setShowDonateModal(true); setShowCreateRoomModal(false); }}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition flex items-center gap-2"
              disabled={!isWalletConnected}
              title={!isWalletConnected ? 'Önce cüzdan bağlayın' : ''}
            >
              💰 Support Admin
            </button>
            {showDonateModal && (
              <div className="absolute top-full left-0 mt-2 z-50">
                <div className="relative z-10 !bg-white border-4 border-black p-6 w-96" style={{ backgroundColor: 'white', zIndex: 9999 }}>
                  <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                    💰 Admin'e Bağış Yap
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Stellar Chat'i destekleyin! Bağışınız admin hesabına gönderilecek.
                  </p>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Miktar (XLM)
                    </label>
                    <input
                      type="number"
                      value={donateAmount}
                      onChange={(e) => setDonateAmount(e.target.value)}
                      placeholder="örn: 10"
                      min="0.1"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Bakiyeniz: {balance} XLM
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowDonateModal(false);
                        setDonateAmount('');
                      }}
                      className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg transition"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleDonateToAdmin}
                      className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition"
                    >
                      Bağış Yap
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentRoomMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400">Henüz mesaj yok. İlk mesajı siz gönderin!</p>
            </div>
          ) : (
            currentRoomMessages.map((msg, idx) => {
              let isMine = false;
              try {
                const socket = getSocket();
                isMine = socket && msg.sender === socket.id;
              } catch {
                // Socket not ready
              }

              return (
                                  <div
                                    key={idx}
                                    className={`flex ${isMine ? 'justify-end' : 'flex-col items-start'}`}
                                  >                  {!isMine && msg.nickname && (
                    <span className="text-xs !font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {msg.nickname}
                    </span>
                  )}
                  <div className="flex items-start"> {/* New wrapper for avatar and message bubble */}
                    {!isMine && (
                      <img
                        src={generateAvatar(msg.sender)}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full mr-2 flex-shrink-0"
                      />
                    )}
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        isMine
                          ? 'bg-primary text-white rounded-br-none'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none'
                      }`}
                    >
                      {/* Nickname removed from inside for !isMine, it's now above avatar */}
                      <div className="break-words">{msg.message}</div>
                      <div className={`text-xs mt-1 ${isMine ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                        {formatTimestamp(msg.timestamp)}
                      </div>
                    </div>
                  </div> {/* End of new wrapper */}
                  {isMine && (
                    <img
                      src={generateAvatar(msg.sender)}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full ml-2 flex-shrink-0"
                    />
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {showEmojiPicker && (
            <div className="mb-2">
              <EmojiPicker
                onEmojiClick={handleEmojiSelect}
                width="100%"
                theme="light"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
              title="Emoji"
            >
              😊
            </button>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Mesajınızı yazın..."
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleSendMessage}
              className="px-6 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg font-medium transition"
            >
              Send
            </button>
          </div>
        </div>
      </div>


      {/* PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              Şifreli Oda
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <strong>{pendingRoomName}</strong> odası şifre korumalı. Lütfen şifreyi girin:
            </p>

            <input
              type="password"
              value={joinRoomPassword}
              onChange={(e) => setJoinRoomPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinWithPassword()}
              placeholder="Oda şifresi"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPendingRoomName('');
                  setJoinRoomPassword('');
                }}
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg transition"
              >
                İptal
              </button>
              <button
                onClick={handleJoinWithPassword}
                className="flex-1 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition"
              >
                Katıl
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ChatApp;
