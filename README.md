# Ephemeral Chat Application

This project is a full-stack ephemeral chat application featuring real-time communication, room management, and integration with the Stellar blockchain (Testnet). It includes a Node.js backend, a React frontend, and a deployed Soroban smart contract used by the donation flow.

## Features

*   **Real-time Chat:** Powered by Socket.io for instant messaging.
*   **Room Management:** Create and join ephemeral (temporary) or permanent chat rooms, with optional password protection.
*   **Ephemeral Rooms:** Inactive temporary rooms are automatically cleaned up.
*   **Message History:** Retains the last 10 messages per room.
*   **Stellar Integration:**
    *   Utilizes `stellar-sdk` for blockchain interactions.
    *   Frontend integrates with `@stellar/freighter-api` for wallet connectivity.
    *   Likely supports functionalities like account creation, funding (Testnet only via Friendbot), payments, and trustline setup.
*   **User Interface:** Modern UI built with React, Vite, and Tailwind CSS, featuring user avatars (DiceBear) and emoji support.

## Project Structure

*   `ephemeral-chat-backend/` (root directory, implied by `package.json`):
    *   `server.js`: Node.js, Express, and Socket.io backend for chat room management and real-time communication.
    *   `stellar-logic.js`: Utility functions for interacting with the Stellar Test Network.
*   `chat-frontend/`:
    *   A React application built with Vite and Tailwind CSS, providing the user interface.
    *   Connects to the backend via Socket.io and interacts with Stellar via Freighter API.
*   `chat_support_contract/`: Soroban smart contract source code used for on-chain donation logic.

## Technologies Used

### Backend
*   Node.js
*   Express.js
*   Socket.io
*   Stellar SDK

### Frontend
*   React
*   Vite
*   Tailwind CSS
*   Socket.io Client
*   Stellar Freighter API
*   Stellar SDK
*   DiceBear (for avatars)
*   Emoji Picker React

## Getting Started

This guide will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   **Node.js & npm:** Make sure you have Node.js (LTS version recommended) and npm installed. You can download it from [nodejs.org](https://nodejs.org/).
*   **Rust & Cargo:** Required for building the Soroban smart contract. Install it using `rustup` from [rust-lang.org](https://www.rust-lang.org/tools/install).
*   **Soroban CLI:** A command-line tool for interacting with Soroban smart contracts. Install it by running `cargo install soroban-cli` after installing Rust.
*   **Git:** For cloning the repository.
*   **Stellar Wallet:** A Stellar wallet that supports Testnet, like [Freighter](https://www.freighter.app/), for interacting with the dApp.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/enes32-hub/StellarChatDApp.git
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd StellarChatDApp
    ```

### Running the Application

The application consists of two main parts: a backend server and a frontend client. You will need to run them in separate terminals.

#### 1. Run the Backend

*   In the project root directory (`StellarChatDApp/`), install the dependencies and start the server:

    ```bash
    # Install dependencies
    npm install

    # Start the backend server
    npm start
    ```
*   The backend will be running on `http://localhost:3000`.

#### 2. Run the Frontend

*   Open a **new terminal**.
*   Navigate to the frontend directory, install its dependencies, and start the development server:

    ```bash
    # Navigate to the frontend directory
    cd chat-frontend

    # Install dependencies
    npm install

    # Start the frontend development server
    npm run dev
    ```
*   The frontend application will be available at `http://localhost:5173`. Open this URL in your browser to use the chat application.

### Frontend Environment

The frontend supports an optional environment variable for Socket.IO backend URL:

```bash
# chat-frontend/.env
VITE_SOCKET_URL=https://your-backend-domain.com
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_CONTRACT_ID=CC3D5HEWNTBGTTNGIGT7EEY44WHGB3IMWYCVPSZGZSGLLUGAXGV4TKTN
VITE_ADMIN_ADDRESS=GAH3WM7BDRBYGFTRPLI6DHYO2GREMTILTN4NYBAHYLIWK4JLLRO2HJBH
```

Behavior:
*   If `VITE_SOCKET_URL` is set, frontend connects to that backend.
*   If not set in production, frontend uses same-origin (`window.location.origin`).
*   If not set in development, frontend uses `http://localhost:3000`.
*   `VITE_SOROBAN_RPC_URL` is used for contract simulation/submission.
*   `VITE_CONTRACT_ID` and `VITE_ADMIN_ADDRESS` configure the on-chain donation flow.

## Deployment Checklist

1.  Deploy backend (`server.js`) to a public URL (Render/Railway/Fly/etc.).
2.  Deploy frontend (`chat-frontend`) to Vercel/Netlify.
3.  Set `VITE_SOCKET_URL` in frontend deployment environment to your backend URL (if frontend and backend are on different domains).
4.  Make sure your Freighter wallet is on Stellar Testnet and funded.

## Soroban Contract

The smart contract source code is located in the `chat_support_contract` directory.

**Contract ID:** The contract has been deployed to the Stellar Testnet with the following ID:
`CC3D5HEWNTBGTTNGIGT7EEY44WHGB3IMWYCVPSZGZSGLLUGAXGV4TKTN`

The frontend invokes `donate_to_admin` on this contract during donations.
Method signature in contract:
- `donate_to_admin(from: Address, amount: i128, admin_address: Address, native_token_id: Address)`

To rebuild and redeploy the contract, you would typically use the Soroban CLI commands within the `chat_support_contract` directory:
```bash
# Build the contract
soroban contract build

# Deploy the contract (requires a funded account)
soroban contract deploy --wasm target/wasm32v1-none/release/chat_support_contract.wasm --source <YOUR_ACCOUNT>
```
