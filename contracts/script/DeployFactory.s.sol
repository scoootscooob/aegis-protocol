// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PlimsollVaultFactory.sol";

/**
 * @title DeployFactory — Deploy PlimsollVaultFactory to any chain
 *
 * Usage:
 *   forge script script/DeployFactory.s.sol:DeployFactory \
 *     --rpc-url $SEPOLIA_RPC_URL \
 *     --broadcast \
 *     -vvvv
 *
 * Environment Variables:
 *   DEPLOYER_PRIVATE_KEY — Private key of the deployer
 */
contract DeployFactory is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("=== PlimsollVaultFactory Deployment ===");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerKey);

        PlimsollVaultFactory factory = new PlimsollVaultFactory();
        console.log("Factory deployed at:", address(factory));

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("PlimsollVaultFactory:", address(factory));
        console.log("\nUpdate dapp/src/lib/contracts.ts with this address.");
    }
}
