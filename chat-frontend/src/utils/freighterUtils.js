import { isConnected, requestAccess, getAddress, signTransaction as _freighterSignTransaction } from '@stellar/freighter-api';
import * as StellarSdk from 'stellar-sdk';
import { Horizon } from 'stellar-sdk';
// 'react-hot-toast' buraya dahil edilmeli, ancak bu dosya içinde değil ChatApp.jsx içinde kullanılacak
// Bu utils dosyası sadece bağlantı mantigini icecek

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const STELLAR_NETWORK = StellarSdk.Networks.TESTNET;

/**
 * 🔗 Cuzdan baglanti akisi
 * Kullanicinin cuzdaninin yuklu olup olmadigini kontrol eder,
 * erisim izni ister ve Public Key'i dondurur.
 * Hata durumunda uygun mesaji konsola yazar ve hata nesnesi dondurur.
 */
export const connectWallet = async () => {
  try {
    const isAvailable = await isConnected();
    if (!isAvailable) {
      return { success: false, publicKey: null, error: "Freighter eklentisi bulunamadi veya etkin degil. Lutfen kurun/etkinlestirin." };
    }

    const { address, error } = await requestAccess();

    if (error) {
      let errorMessage = "Cuzdan baglantisi sirasinda bilinmeyen bir hata olustu.";
      if (error.message?.includes("User declined access")) {
        errorMessage = "Cuzdan baglantisi kullanici tarafindan reddedildi.";
      } else if (error.message?.includes("Wallet is locked")) {
        errorMessage = "Freighter eklentisi kilitli. Lutfen sifrenizi girin.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      console.error("❌ Cuzdan baglanti hatasi:", error);
      return { success: false, publicKey: null, error: errorMessage };
    }

    if (address) {
      console.log("✅ Cuzdan Baglandi:", address);
      return { success: true, publicKey: address, error: null };
    }

    return { success: false, publicKey: null, error: "Cuzdan baglantisi basarisiz oldu." };

  } catch (err) {
    console.error("❌ Cuzdan baglanti islemi sirasinda beklenmeyen hata:", err);
    return { success: false, publicKey: null, error: `Beklenmeyen hata: ${err.message}` };
  }
};

/**
 * 🔍 Mevcut cuzdan baglantisini kontrol eder ve public key'i dondurur.
 * Sayfa yenilendiginde cuzdanin bagli kalmasi icin kullanilir.
 * @returns {Promise<{success: boolean, publicKey: string|null, error: string|null}>}
 */
export const checkConnection = async () => {
  try {
    const isAvailable = await isConnected();
    if (!isAvailable) {
      return { success: false, publicKey: null, error: "Freighter eklentisi bulunamadi veya etkin degil." };
    }

    const { address, error } = await getAddress();

    if (error) {
      console.warn("ℹ️ Mevcut cuzdan baglantisi kontrol edilirken hata:", error.message);
      // Kullanici baglantiyi reddettiyse veya cuzdan kilitliyse hata mesaji dondurmeyebiliriz, sadece baglanti yok deriz.
      return { success: false, publicKey: null, error: null }; // Hata yerine sadece baglanti yok diyelim
    }

    if (address) {
      console.log("✅ Mevcut cuzdan baglantisi bulundu:", address);
      return { success: true, publicKey: address, error: null };
    }

    return { success: false, publicKey: null, error: null }; // Baglanti yok

  } catch (err) {
    console.error("❌ Mevcut cuzdan baglantisi kontrol edilirken beklenmeyen hata:", err);
    return { success: false, publicKey: null, error: null };
  }
};

/**
 * 💰 Public Key icin XLM bakiyesini getir
 * @param {string} publicKey
 * @returns {Promise<string>}
 */
export async function getBalance(publicKey) {
  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(publicKey);
    const xlmBalance = account.balances.find(b => b.asset_type === 'native');
    const balance = xlmBalance ? parseFloat(xlmBalance.balance).toFixed(2) : '0.00';
    return balance;
  } catch (error) {
    console.error('❌ [Stellar] Bakiye getirilirken hata:', error);
    // Fonlanmamış hesaplar 404 hatası verir, bu normal bir durum.
    if (error.response && error.response.status === 404) {
      console.warn("Hesap agda bulunamadi (fonlanmamis olabilir). Bakiye 0 olarak gosteriliyor.");
      return '0.00';
    }
    return '0.00';
  }
}

/**
 * 🔌 Cuzdan baglantisini kes (sadece loglama amacli)
 * Freighter API'da dogrudan "disconnect" fonksiyonu olmadigi icin
 * sadece client tarafindaki durumu sifirlariz.
 */
export function disconnectWallet() {
  console.log('🔌 [Freighter] Cuzdan baglantisi kesildi (client tarafi)');
  // Freighter API'da setAllowed(false) veya benzeri bir mekanizma yok.
  // Bu nedenle sadece client tarafindaki state'i temizlemek yeterlidir.
  return { success: true, message: 'Wallet disconnected' };
}

/**
 * 📡 Freighter ile islem imzala
 *
 * @param {string} xdr
 * @returns {Promise<{success: boolean, signedXDR: string|null, error: string|null}>}
 */
export async function signTransactionXDR(xdr) {
  try {
    const signedXDR = await _freighterSignTransaction(xdr, {
      network: 'TESTNET',
      networkPassphrase: StellarSdk.Networks.TESTNET, // StellarSdk.Networks.TESTNET kullanildi
    });
    return {
      success: true,
      signedXDR,
      error: null
    };
  } catch (error) {
    let errorMessage = 'Islem imzalama basarisiz oldu.';
    if (error.message?.includes('User declined transaction')) {
      errorMessage = 'Islemi reddettiniz.';
    } else if (error.message?.includes('Wallet is locked')) {
      errorMessage = 'Freighter eklentisi kilitli. Lutfen kilidini acin.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    return {
      success: false,
      signedXDR: null,
      error: errorMessage
    };
  }
}

/**
 * 💸 Odeme islemi gonder
 *
 * @param {string} fromPublicKey
 * @param {string} toPublicKey
 *
 * @param {string} amount
 * @returns {Promise<{success: boolean, txHash: string|null, error: string|null}>}
 */
export async function sendPayment(fromPublicKey, toPublicKey, amount) {
  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(fromPublicKey);

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: STELLAR_NETWORK,
    })
      .addOperation(StellarSdk.Operation.payment({
        destination: toPublicKey,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString(),
      }))
      .setTimeout(30)
      .build();

    const signResult = await signTransactionXDR(transaction.toXDR());
    if (!signResult.success) {
      return { success: false, txHash: null, error: signResult.error };
    }

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signResult.signedXDR,
      StellarSdk.Networks.TESTNET
    );
    console.log('Signed XDR from Freighter:', signResult.signedXDR); // Debugging line
    const result = await server.submitTransaction(signedTx);

    return { success: true, txHash: result.hash, error: null };
  } catch (error) {
    let errorMessage = 'Odeme basarisiz oldu.';
    if (error.message?.includes('insufficient')) {
      errorMessage = 'Yetersiz bakiye.';
    } else if (error.message?.includes('account not found')) {
      errorMessage = 'Hesap fonlanmamis. Lutfen once hesabiniza fon aktarin.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, txHash: null, error: errorMessage };
  }
}

// Tum fonksiyonlari export ediyoruz
export default {
  connectWallet,
  getBalance,
  disconnectWallet,
  checkConnection, // Yeni eklenen fonksiyon
  signTransaction: signTransactionXDR,
  sendPayment
};