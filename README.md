# Ephemeral Chat Application

This project is a full-stack ephemeral chat application featuring real-time communication, room management, and integration with the Stellar blockchain (Testnet). It consists of a Node.js backend, a React-based frontend, and potentially a Soroban smart contract for on-chain functionalities.

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
*   `chat_support_contract/`: (Directory) Contains the Soroban smart contract code, likely for on-chain chat features.

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

## Soroban Contract

The smart contract source code is located in the `chat_support_contract` directory.

**Contract ID:** The contract has been deployed to the Stellar Testnet with the following ID:
`CC3D5HEWNTBGTTNGIGT7EEY44WHGB3IMWYCVPSZGZSGLLUGAXGV4TKTN`

To rebuild and redeploy the contract, you would typically use the Soroban CLI commands within the `chat_support_contract` directory:
```bash
# Build the contract
soroban contract build

# Deploy the contract (requires a funded account)
soroban contract deploy --wasm target/wasm32v1-none/release/chat_support_contract.wasm --source <YOUR_ACCOUNT>
```

