// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/RewardToken.sol";

contract DeployRewardToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);


        vm.startBroadcast(deployerPrivateKey);

        // Deploy RewardToken with an initial supply (1,000,000 tokens) and deployer as owner
        RewardToken rewardToken = new RewardToken(0, deployer);

        vm.stopBroadcast();

        console.log("RewardToken deployed at:", address(rewardToken));
    }
}
