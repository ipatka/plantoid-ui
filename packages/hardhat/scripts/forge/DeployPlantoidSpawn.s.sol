// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";

import {Plantoid, PlantoidSpawn} from "../../contracts/Plantoid.sol";

contract Deploy is Script {
    function setUp() public {}

    function run() public {
    vm.startBroadcast();
    
    
    Plantoid template = new Plantoid();
    
    new PlantoidSpawn(payable(address(template)));

    vm.stopBroadcast();
    }
}
