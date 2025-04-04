// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/RewardToken.sol";

contract TransferOwnership is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Replace these with your actual deployed contract addresses:
        address rewardTokenAddress = 0x51af42917eB1551958A89CE65edd5be0b1cE4240; 
        address farmingAddress = 0x22575a2f08fb2BC328717E0a903B2Cb0e8077274;  

        // Instantiate the RewardToken contract
        RewardToken rewardToken = RewardToken(rewardTokenAddress);
        
        // Transfer ownership of RewardToken to the Farming contract
        rewardToken.transferOwnership(farmingAddress);

        vm.stopBroadcast();

        console.log("Ownership of RewardToken has been transferred to Farming contract at:", farmingAddress);
    }
}
