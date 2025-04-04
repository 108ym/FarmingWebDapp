// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/Farming.sol";

contract AddPools is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address farmingAddress = 0x22575a2f08fb2BC328717E0a903B2Cb0e8077274;  
        address mDAIAddress    = 0x789492C8c1445a795a3C4439579A0Df89B557791;         
        address mUSDCAddress   = 0xA5F25C6A6C1ae1Dc0941CfB3c7541F18C868572c;        
        address mETHAddress    = 0xe8aa95A994987cA850ae35443b39ed1deB52aA0f;        

        Farming farming = Farming(farmingAddress);

        // Call addPool for each LP token with allocation points 50, 30, and 20 respectively.
        farming.addPool(IERC20(mDAIAddress), 50);
        farming.addPool(IERC20(mUSDCAddress), 30);
        farming.addPool(IERC20(mETHAddress), 20);

        vm.stopBroadcast();

        console.log("Pools added successfully:");
        console.log(" - mDAI with 50 allocation points");
        console.log(" - mUSDC with 30 allocation points");
        console.log(" - mETH with 20 allocation points");
    }
}
