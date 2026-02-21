import { isConnected, requestAccess, getAddress, signTransaction as _freighterSignTransaction } from '@stellar/freighter-api';
import * as StellarSdk from 'stellar-sdk';
import { Horizon } from 'stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const SOROBAN_RPC_URL = (import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org').trim();
const STELLAR_NETWORK = StellarSdk.Networks.TESTNET;

/**
 * Wallet connection flow:
 * checks extension availability, requests access, and returns public key.
 */
export const connectWallet = async () => {
  try {
    const { isConnected: walletConnected, error: isConnectedError } = await isConnected();
    if (isConnectedError) {
      return { success: false, publicKey: null, error: isConnectedError.message || 'Freighter check failed.' };
    }
    if (!walletConnected) {
      return { success: false, publicKey: null, error: 'Freighter extension not found or not enabled. Please install/enable it.' };
    }

    const { address, error } = await requestAccess();

    if (error) {
      let errorMessage = 'Unknown error occurred during wallet connection.';
      if (error.message?.includes('User declined access')) {
        errorMessage = 'Wallet connection was declined by the user.';
      } else if (error.message?.includes('Wallet is locked')) {
        errorMessage = 'Freighter extension is locked. Please unlock it.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      console.error('Wallet connection error:', error);
      return { success: false, publicKey: null, error: errorMessage };
    }

    if (address) {
      console.log('Wallet connected:', address);
      return { success: true, publicKey: address, error: null };
    }

    return { success: false, publicKey: null, error: 'Wallet connection failed.' };
  } catch (err) {
    console.error('Unexpected error during wallet connection:', err);
    return { success: false, publicKey: null, error: `Unexpected error: ${err.message}` };
  }
};

/**
 * Check current wallet connection and return public key.
 * Useful for restoring session state on page refresh.
 */
export const checkConnection = async () => {
  try {
    const { isConnected: walletConnected, error: isConnectedError } = await isConnected();
    if (isConnectedError) {
      return { success: false, publicKey: null, error: 'Freighter extension not found or not enabled.' };
    }
    if (!walletConnected) {
      return { success: false, publicKey: null, error: 'Freighter extension not found or not enabled.' };
    }

    const { address, error } = await getAddress();

    if (error) {
      console.warn('Error while checking existing wallet connection:', error.message);
      return { success: false, publicKey: null, error: null };
    }

    if (address) {
      console.log('Existing wallet connection found:', address);
      return { success: true, publicKey: address, error: null };
    }

    return { success: false, publicKey: null, error: null };
  } catch (err) {
    console.error('Unexpected error while checking existing wallet connection:', err);
    return { success: false, publicKey: null, error: null };
  }
};

/**
 * Fetch XLM balance for public key
 */
export async function getBalance(publicKey) {
  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(publicKey);
    const xlmBalance = account.balances.find((b) => b.asset_type === 'native');
    return xlmBalance ? parseFloat(xlmBalance.balance).toFixed(2) : '0.00';
  } catch (error) {
    console.error('[Stellar] Error while fetching balance:', error);
    if (error.response && error.response.status === 404) {
      console.warn('Account not found on network (may be unfunded). Displaying 0 balance.');
      return '0.00';
    }
    return '0.00';
  }
}

/**
 * Disconnect wallet on client state.
 * Freighter API does not expose a direct disconnect method.
 */
export function disconnectWallet() {
  console.log('[Freighter] Wallet disconnected on client state');
  return { success: true, message: 'Wallet disconnected' };
}

/**
 * Sign transaction XDR with Freighter
 */
export async function signTransactionXDR(xdr) {
  try {
    const { signedTxXdr, error } = await _freighterSignTransaction(xdr, {
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });
    if (error || !signedTxXdr) {
      return {
        success: false,
        signedXDR: null,
        error: error?.message || 'Transaction signing failed.',
      };
    }
    return {
      success: true,
      signedXDR: signedTxXdr,
      error: null,
    };
  } catch (error) {
    let errorMessage = 'Transaction signing failed.';
    if (error.message?.includes('User declined transaction')) {
      errorMessage = 'You declined the transaction.';
    } else if (error.message?.includes('Wallet is locked')) {
      errorMessage = 'Freighter extension is locked. Please unlock it.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    return {
      success: false,
      signedXDR: null,
      error: errorMessage,
    };
  }
}

/**
 * Send payment transaction
 */
export async function sendPayment(fromPublicKey, toPublicKey, amount) {
  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(fromPublicKey);

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: STELLAR_NETWORK,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: toPublicKey,
          asset: StellarSdk.Asset.native(),
          amount: amount.toString(),
        })
      )
      .setTimeout(30)
      .build();

    const signResult = await signTransactionXDR(transaction.toXDR());
    if (!signResult.success) {
      return { success: false, txHash: null, error: signResult.error };
    }

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signResult.signedXDR, StellarSdk.Networks.TESTNET);
    console.log('Signed XDR from Freighter:', signResult.signedXDR);
    const result = await server.submitTransaction(signedTx);

    return { success: true, txHash: result.hash, error: null };
  } catch (error) {
    let errorMessage = 'Payment failed.';
    if (error.message?.includes('insufficient')) {
      errorMessage = 'Insufficient balance.';
    } else if (error.message?.includes('account not found')) {
      errorMessage = 'Account is not funded. Please fund your account first.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, txHash: null, error: errorMessage };
  }
}

function parseXlmToStroops(amountXlm) {
  const input = String(amountXlm).trim();
  if (!/^\d+(\.\d+)?$/.test(input)) {
    throw new Error('Invalid amount format.');
  }

  const [whole, fracRaw = ''] = input.split('.');
  const frac = (fracRaw + '0000000').slice(0, 7);
  return BigInt(whole) * 10000000n + BigInt(frac);
}

async function pollSorobanResult(server, hash, maxAttempts = 20, delayMs = 1500) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const tx = await server.getTransaction(hash);
    if (tx.status === 'SUCCESS') {
      return { success: true, tx };
    }
    if (tx.status === 'FAILED') {
      return { success: false, error: 'Contract transaction failed on chain.' };
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { success: false, error: 'Transaction is still pending. Please check explorer in a moment.' };
}

/**
 * Invoke deployed Soroban contract method: donate_to_admin
 */
export async function donateToAdminViaContract(fromPublicKey, amountXlm, adminAddress, contractId) {
  try {
    const stroops = parseXlmToStroops(amountXlm);
    if (stroops <= 0n) {
      return { success: false, txHash: null, error: 'Donation amount must be greater than 0.' };
    }

    const rpcServer = new StellarSdk.rpc.Server(SOROBAN_RPC_URL, { allowHttp: false });
    const sourceAccount = await rpcServer.getAccount(fromPublicKey);
    const nativeTokenId = StellarSdk.Asset.native().contractId(STELLAR_NETWORK);

    const contract = new StellarSdk.Contract(contractId);
    const operation = contract.call(
      'donate_to_admin',
      new StellarSdk.Address(fromPublicKey).toScVal(),
      StellarSdk.nativeToScVal(stroops, { type: 'i128' }),
      new StellarSdk.Address(adminAddress).toScVal(),
      new StellarSdk.Address(nativeTokenId).toScVal()
    );

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '100000',
      networkPassphrase: STELLAR_NETWORK,
    })
      .addOperation(operation)
      .setTimeout(60)
      .build();

    const preparedTx = await rpcServer.prepareTransaction(tx);
    const signResult = await signTransactionXDR(preparedTx.toXDR());
    if (!signResult.success || !signResult.signedXDR) {
      return { success: false, txHash: null, error: signResult.error || 'Signing failed.' };
    }

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signResult.signedXDR, STELLAR_NETWORK);
    const sendResult = await rpcServer.sendTransaction(signedTx);

    if (sendResult.status === 'ERROR') {
      return { success: false, txHash: sendResult.hash || null, error: 'Soroban RPC rejected transaction.' };
    }

    const finalResult = await pollSorobanResult(rpcServer, sendResult.hash);
    if (!finalResult.success) {
      return { success: false, txHash: sendResult.hash || null, error: finalResult.error };
    }

    return { success: true, txHash: sendResult.hash, error: null };
  } catch (error) {
    return { success: false, txHash: null, error: error.message || 'Contract invocation failed.' };
  }
}

export default {
  connectWallet,
  getBalance,
  disconnectWallet,
  checkConnection,
  signTransaction: signTransactionXDR,
  sendPayment,
  donateToAdminViaContract,
};
