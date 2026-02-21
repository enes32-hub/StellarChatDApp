#![no_std]
use soroban_sdk::{
    contract, contractimpl, log, token, Address, Env, String, Symbol,
};

// Constants can be removed or kept as references since values are now method arguments.
// const ADMIN_ADDRESS_STR_DEFAULT: &str = "GAH3WM7BDRBYGFTRPLI6DHYO2GREMTILTN4NYBAHYLIWK4JLLRO2HJBH";

#[contract]
pub struct ChatSupportContract;

#[contractimpl]
impl ChatSupportContract {
    pub fn log_room_creation(env: Env, room_name: Symbol) {
        log!(&env, "Room created: {}", room_name);
        env.events().publish(
            (Symbol::new(&env, "Room"), Symbol::new(&env, "Created")),
            room_name,
        );
    }

    // Function signature updated
    pub fn donate_to_admin(env: Env, from: Address, amount: i128, admin_address: Address, native_token_id: Address) {
        from.require_auth();

        if amount <= 0 {
            panic!("Donation amount must be positive.");
        }

        // admin address is now passed as an argument
        // native token address is now passed as an argument
        
        // Execute transfer
        let client = token::Client::new(&env, &native_token_id);
        client.transfer(&from, &admin_address, &amount);

        log!(&env, "Donation of {} stroops received from {} for admin {}", amount, from, admin_address.clone());

        env.events().publish(
            (Symbol::new(&env, "Donation"), Symbol::new(&env, "Received")),
            (from, amount, admin_address),
        );
    }
}
