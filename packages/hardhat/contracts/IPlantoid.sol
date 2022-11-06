// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

interface IPlantoidSpawner {
    function spawnPlantoid(bytes32, bytes calldata)
        external
        returns (address payable);
}

/// @title Plantoid
/// @dev Blockchain based lifeform
///
///
contract IPlantoid {
    error StillProposing();
    error CannotAdvance();
    error CannotSubmitProposal();
    error StillVoting();
    error NotInVoting();
    error AlreadyVoting();
    error CannotVeto();
    error NotMinted();
    error NotOwner();
    error AlreadyRevealed();
    error InvalidProposal();
    error Vetoed();
    error NoVotingTokens();
    error URIQueryForNonexistentToken();
    error ThresholdNotReached();
    error AlreadyVoted();
    error NotArtist();
    error NotWinner();
    error FailedToSendETH();
    error FailedToSpawn();
}
