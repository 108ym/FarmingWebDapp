// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/LPToken.sol";

contract DeployLPTokens is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy three LP tokens with an initial supply of 1,000,000 tokens each.
        LPToken mDAI = new LPToken("Mock DAI", "mDAI", 1_000_000 * 1e18);
        LPToken mUSDC = new LPToken("Mock USDC", "mUSDC", 1_000_000 * 1e18);
        LPToken mETH  = new LPToken("Mock ETH", "mETH", 1_000_000 * 1e18);

        vm.stopBroadcast();

        console.log("mDAI deployed at:", address(mDAI));
        console.log("mUSDC deployed at:", address(mUSDC));
        console.log("mETH deployed at:", address(mETH));
    }
}
