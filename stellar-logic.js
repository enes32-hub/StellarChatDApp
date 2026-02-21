import * as StellarSdk from 'stellar-sdk';

// Stellar network configuration.
// Use StellarSdk.Networks.PUBLIC for public network.
// Use StellarSdk.Networks.TESTNET for test network.
const STELLAR_NETWORK = StellarSdk.Networks.TESTNET;
StellarSdk.Network.use(new StellarSdk.Network(STELLAR_NETWORK));

// Stellar Horizon server.
// Use 'https://horizon.stellar.org' for public network.
// Use 'https://horizon-testnet.stellar.org' for test network.
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');

/**
 * Generate a new Stellar keypair.
 * @returns {{publicKey: string, secretKey: string}} Newly generated keypair.
 */
export function generateKeyPair() {
  const pair = StellarSdk.Keypair.random();
  return {
    publicKey: pair.publicKey(),
    secretKey: pair.secretKey(),
  };
}

/**
 * Fetch account details for a given public key.
 * @param {string} publicKey - Stellar public key.
 * @returns {Promise<StellarSdk.AccountResponse|null>} Account details or null if not found.
 */
export async function getAccountDetails(publicKey) {
  try {
    const account = await server.loadAccount(publicKey);
    return account;
  } catch (error) {
    console.error('Error while fetching account details:', error);
    return null;
  }
}

/**
 * Fund an account on testnet (for development/testing only).
 * @param {string} publicKey - Public key of account to fund.
 * @returns {Promise<boolean>} true on success, false on failure.
 */
export async function fundTestAccount(publicKey) {
  try {
    const response = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
    const responseJson = await response.json();
    console.log('Friendbot response:', responseJson);
    return true;
  } catch (error) {
    console.error('Error while funding test account:', error);
    return false;
  }
}

/**
 * Send payment transaction on Stellar network.
 * WARNING: secretKey should never be stored/used directly on frontend.
 * In production, handle signing on backend or secure wallet integrations.
 *
 * @param {string} sourceSecretKey - Secret key of sender account.
 * @param {string} destinationPublicKey - Public key of destination account.
 * @param {string} amount - Amount to send as string.
 * @param {string} [assetCode='XLM'] - Asset code (e.g. XLM, USD).
 * @param {string} [issuerPublicKey] - Issuer public key for non-native asset.
 * @returns {Promise<StellarSdk.TransactionResponse|null>} Transaction response or null on error.
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
        throw new Error('issuerPublicKey is required when sending a custom asset.');
      }
      asset = new StellarSdk.Asset(assetCode, issuerPublicKey);
    }

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destinationPublicKey,
          asset,
          amount,
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);

    const result = await server.submitTransaction(transaction);
    console.log('Payment successful:', result);
    return result;
  } catch (error) {
    console.error('Error during payment transaction:', error);
    return null;
  }
}

/**
 * Create a trustline for an asset on a Stellar account.
 *
 * @param {string} sourceSecretKey - Secret key of account that sets trustline.
 * @param {string} assetCode - Asset code to trust (e.g. USD).
 * @param {string} issuerPublicKey - Issuer public key.
 * @returns {Promise<StellarSdk.TransactionResponse|null>} Transaction response or null on error.
 */
export async function setupTrustline(sourceSecretKey, assetCode, issuerPublicKey) {
  try {
    const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset,
          limit: '1000000000', // Maximum accepted amount for this asset
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);

    const result = await server.submitTransaction(transaction);
    console.log('Trustline setup successful:', result);
    return result;
  } catch (error) {
    console.error('Error while setting up trustline:', error);
    return null;
  }
}

// Additional helper functions can be added as needed.
