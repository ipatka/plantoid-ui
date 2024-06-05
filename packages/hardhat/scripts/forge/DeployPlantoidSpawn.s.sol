// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";

import {Plantoid, PlantoidSpawn} from "../../contracts/Plantoid.sol";

contract Deploy is Script {
    function setUp() public {}

    function run() public {
    vm.startBroadcast();
    
    if (msg.sender != 0x1f028f240A90414211425bFa38eB4917Cb32c39C) {
        revert("only owner can deploy");
    }
    
    Plantoid template = new Plantoid();
    
    new PlantoidSpawn(payable(address(template)));

    vm.stopBroadcast();
    }
}
