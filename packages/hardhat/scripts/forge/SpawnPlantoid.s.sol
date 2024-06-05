// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";

import {Plantoid, PlantoidSpawn} from "../../contracts/Plantoid.sol";

contract Deploy is Script {
    address plantoidSpawnAddress;

    function setUp() public {
        plantoidSpawnAddress = vm.envAddress("PLANTOID_SPAWN_ADDRESS");
        if (plantoidSpawnAddress == address(0)) {
            revert("PLANTOID_SPAWN_ADDRESS not set");
        }
    }

    function run() public {
        vm.startBroadcast();

        address plantoidOracleAddress = 0x7e6ce11beE2AB7F84eF0D1955CE1F546D897aB98;
        address payable artistAddress = payable(
            0x2D3C242d2C074D523112093C67d1c01Bb27ca40D
        );
        address payable parentAddress = payable(address(0));
        uint256 depositThreshold = 0.001 ether;
        uint256 threshold = 5 ether;
        string memory name = "Plantoid 13";
        string
            memory prereveal = "ipfs://QmXTzn3ZMvsYnfJKXcKQ2PVHH2YNbdUDED1GM2DEuMHmzH";
        string memory symbol = "PLANTOID";
        uint256 proposalPeriod = 1209600; // 2 weeks
        uint256 votingPeriod = 604800;
        uint256 gracePeriod = 604800;

        bytes memory thresholdsAndPeriods = abi.encode(
            depositThreshold,
            threshold,
            proposalPeriod,
            votingPeriod,
            gracePeriod
        );
        bytes memory initAction = abi.encodeCall(
            Plantoid.init,
            (
                plantoidOracleAddress,
                artistAddress,
                parentAddress,
                name,
                symbol,
                prereveal,
                thresholdsAndPeriods
            )
        );

        bytes32 salt = keccak256(abi.encodePacked("salt", block.number));

        PlantoidSpawn spawner = PlantoidSpawn(
            payable(address(plantoidSpawnAddress))
        );
        spawner.spawnPlantoid(salt, initAction);

        vm.stopBroadcast();
    }
}
