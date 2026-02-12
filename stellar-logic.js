import * as StellarSdk from 'stellar-sdk';

// Stellar ağ yapılandırması
// Public ağı için StellarSdk.Network.current().passphrase yerine StellarSdk.Networks.PUBLIC kullanın
// Test ağı için StellarSdk.Networks.TESTNET kullanın.
const STELLAR_NETWORK = StellarSdk.Networks.TESTNET; 
StellarSdk.Network.use(new StellarSdk.Network(STELLAR_NETWORK));

// Stellar Horizon sunucusu
// Public ağı için 'https://horizon.stellar.org' kullanın
// Test ağı için 'https://horizon-testnet.stellar.org' kullanın
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');

/**
 * Yeni bir Stellar anahtar çifti (keypair) oluşturur.
 * @returns {{publicKey: string, secretKey: string}} Yeni oluşturulan anahtar çifti.
 */
export function generateKeyPair() {
    const pair = StellarSdk.Keypair.random();
    return {
        publicKey: pair.publicKey(),
        secretKey: pair.secretKey(),
    };
}

/**
 * Belirtilen herkese açık anahtar için hesap detaylarını getirir.
 * @param {string} publicKey - Stellar herkese açık anahtarı.
 * @returns {Promise<StellarSdk.AccountResponse|null>} Hesap detayları veya null eğer bulunamazsa.
 */
export async function getAccountDetails(publicKey) {
    try {
        const account = await server.loadAccount(publicKey);
        return account;
    } catch (error) {
        console.error('Hesap detayları alınırken hata oluştu:', error);
        return null;
    }
}

/**
 * Test ağında bir hesaba fon sağlar. Sadece geliştirme/test amaçlıdır.
 * @param {string} publicKey - Fon sağlanacak hesabın herkese açık anahtarı.
 * @returns {Promise<boolean>} İşlem başarılı olursa true, aksi halde false.
 */
export async function fundTestAccount(publicKey) {
    try {
        const response = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
        const responseJson = await response.json();
        console.log('Friendbot yanıtı:', responseJson);
        return true;
    } catch (error) {
        console.error('Test hesabı fonlanırken hata oluştu:', error);
        return false;
    }
}

/**
 * Stellar ağında bir ödeme işlemi gönderir.
 * UYARI: secretKey asla doğrudan frontend'de saklanmamalı veya kullanılmamalıdır.
 * Bu fonksiyon sadece örnek amaçlıdır. Gerçek uygulamalarda secretKey sunucu tarafında işlenmeli veya bir donanım cüzdanı/tarayıcı eklentisi aracılığıyla kullanılmalıdır.
 *
 * @param {string} sourceSecretKey - Gönderen hesabın gizli anahtarı.
 * @param {string} destinationPublicKey - Alıcı hesabın herkese açık anahtarı.
 * @param {string} amount - Gönderilecek miktar (string olarak).
 * @param {string} [assetCode='XLM'] - Gönderilecek varlığın kodu (örn: 'XLM', 'USD').
 * @param {string} [issuerPublicKey] - Özel bir varlık gönderiliyorsa, varlığın çıkaran hesabının herkese açık anahtarı.
 * @returns {Promise<StellarSdk.TransactionResponse|null>} İşlem yanıtı veya null eğer hata oluşursa.
 */
export async function sendPayment(sourceSecretKey, destinationPublicKey, amount, assetCode = 'XLM', issuerPublicKey) {
    try {
        const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
        const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

        let asset;
        if (assetCode === 'XLM') {
            asset = StellarSdk.Asset.native();
        } else {
            if (!issuerPublicKey) {
                throw new Error('Özel varlık gönderirken issuerPublicKey gereklidir.');
            }
            asset = new StellarSdk.Asset(assetCode, issuerPublicKey);
        }

        const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE
        })
            .addOperation(StellarSdk.Operation.payment({
                destination: destinationPublicKey,
                asset: asset,
                amount: amount,
            }))
            .setTimeout(30) // 30 saniye sonra zaman aşımı
            .build();

        transaction.sign(sourceKeypair);

        const result = await server.submitTransaction(transaction);
        console.log('Ödeme işlemi başarılı:', result);
        return result;
    } catch (error) {
        console.error('Ödeme işlemi sırasında hata oluştu:', error);
        return null;
    }
}

/**
 * Bir Stellar hesabında bir varlık için trustline (güven çizgisi) oluşturur.
 *
 * @param {string} sourceSecretKey - Trustline oluşturacak hesabın gizli anahtarı.
 * @param {string} assetCode - Güvenilecek varlığın kodu (örn: 'USD').
 * @param {string} issuerPublicKey - Güvenilecek varlığın çıkaran hesabının herkese açık anahtarı.
 * @returns {Promise<StellarSdk.TransactionResponse|null>} İşlem yanıtı veya null eğer hata oluşursa.
 */
export async function setupTrustline(sourceSecretKey, assetCode, issuerPublicKey) {
    try {
        const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
        const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

        const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);

        const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE
        })
            .addOperation(StellarSdk.Operation.changeTrust({
                asset: asset,
                limit: '1000000000', // Varlığın kabul edilebilecek maksimum miktarı
            }))
            .setTimeout(30)
            .build();

        transaction.sign(sourceKeypair);

        const result = await server.submitTransaction(transaction);
        console.log('Trustline oluşturma başarılı:', result);
        return result;
    } catch (error) {
        console.error('Trustline oluşturulurken hata oluştu:', error);
        return null;
    }
}

// Daha fazla fonksiyon (örneğin DEX işlemleri, multisig, data işlemleri) eklenebilir.
