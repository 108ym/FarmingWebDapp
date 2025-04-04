// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/Farming.sol";
import "../src/RewardToken.sol";

contract DeployFarming is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Replace with your deployed RewardToken contract address
        address rewardTokenAddress = 0x51af42917eB1551958A89CE65edd5be0b1cE4240; 
        uint256 startBlock = block.number + 1;

        vm.startBroadcast(deployerPrivateKey);

        // Cast rewardTokenAddress as RewardToken instead of IERC20
        Farming farming = new Farming(RewardToken(rewardTokenAddress), startBlock, deployer);

        vm.stopBroadcast();

        console.log("Farming deployed at:", address(farming));
    }
}
