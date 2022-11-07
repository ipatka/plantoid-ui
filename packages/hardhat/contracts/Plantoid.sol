// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./base/ERC721Checkpointable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {SafeTransferLib} from "@rari-capital/solmate/src/utils/SafeTransferLib.sol";
import {IPlantoid, IPlantoidSpawner} from "./IPlantoid.sol";

/// @title Plantoid
/// @dev Blockchain based lifeform
///
///
contract Plantoid is IPlantoid, ERC721Checkpointable, Initializable {
    using SafeTransferLib for address payable;
    using ECDSA for bytes32; /*ECDSA for signature recovery for license mints*/

    function viewProposals(uint256 _round, uint256 _proposal)
        public
        view
        returns (
            uint256 votes,
            address proposer,
            bool vetoed,
            string memory uri
        )
    {
        votes = rounds[_round].proposals[_proposal].votes;
        proposer = rounds[_round].proposals[_proposal].proposer;
        vetoed = rounds[_round].proposals[_proposal].vetoed;
        uri = rounds[_round].proposals[_proposal].uri;
    }

    function currentRoundState()
        public
        view
        returns (uint256 _round, RoundState _state)
    {
        _round = round;
        _state = roundState(_round);
    }

    function roundState(uint256 _round) public view returns (RoundState state) {
        if (rounds[_round].roundState == RoundState.Pending)
            return RoundState.Pending;
        else if (rounds[_round].roundState == RoundState.Proposal) {
            if (rounds[_round].proposalEnd > block.timestamp)
                return RoundState.Proposal;
            else return RoundState.NeedsAdvancement;
        } else if (rounds[_round].roundState == RoundState.Voting) {
            if (rounds[_round].votingEnd > block.timestamp)
                return RoundState.Voting;
            else return RoundState.NeedsAdvancement;
        } else if (rounds[_round].roundState == RoundState.Grace) {
            if (rounds[_round].graceEnd > block.timestamp)
                return RoundState.Grace;
            else return RoundState.NeedsSettlement;
        } else return rounds[_round].roundState;
    }

    mapping(uint256 => bool) public revealed; /*Track if plantoid has revealed the NFT*/

    string public prerevealUri; /*Before reveal, render a default NFT image*/

    /*****************
    Reproduction state mgmt
    *****************/
    uint256 public threshold; /*Threshold of received ETH to trigger a spawning round*/
    uint256 public depositThreshold; /*Threshold of received ETH to trigger an NFT to mint*/

    mapping(uint256 => uint256) public votingEnd; /*Voting round => time when voting ends*/
    uint256 public escrow; /*ETH locked until voting is concluded*/

    mapping(uint256 => Round) public rounds; /* round => round state*/

    uint256 public round; /* Track active voting round*/
    address payable public parent; /* Parent plantoid contract*/
    address payable public artist; /* Store artist for this plantoid*/

    uint256 public proposalPeriod; /*Time during which artists can submit proposals*/
    uint256 public votingPeriod; /*Time during which holders can vote for active proposals*/
    uint256 public gracePeriod; /*Time between voting ended and when vote can settle*/

    uint256 public salt;

    /*****************
    Minting state mgmt
    *****************/
    address public plantoidAddress; /* Plantoid oracle TODO make changeable by creator? */
    uint256 _tokenIds; /* Track minted seed token IDS*/
    mapping(uint256 => string) private _tokenUris; /*Track token URIs for each seed*/

    /*****************
    Config state mgmt
    *****************/
    string private _name; /*Token name override*/
    string private _symbol; /*Token symbol override*/
    string public contractURI; /*contractURI contract metadata json*/

    IPlantoidSpawner public spawner; /*Contract to spawn new plantoids*/

    /*****************
    Configuration
    *****************/

    /// @dev contructor creates an unusable plantoid for future spawn templates
    constructor() ERC721("", "") initializer {
        /* initializer modifier makes it so init cannot be called on template*/
        plantoidAddress = address(0xdead); /*Set address to dead so receive fallback of template fails*/
    }

    /// @dev Initialize
    function init(
        address _plantoid,
        address payable _artist,
        address payable _parent,
        string calldata name_,
        string calldata symbol_,
        string calldata _prerevealUri,
        bytes calldata _thresholdsAndPeriods
    ) external initializer {
        plantoidAddress = _plantoid;
        artist = _artist;
        parent = _parent;
        _name = name_;
        _symbol = symbol_;
        prerevealUri = _prerevealUri;
        spawner = IPlantoidSpawner(msg.sender); /*Initialize interface to spawner*/
        _setParameters(_thresholdsAndPeriods);
        emit NewPlantoid(_plantoid);
    }

    function _setParameters(bytes calldata _thresholdsAndPeriods) internal {
        (
            uint256 _depositThreshold,
            uint256 _threshold,
            uint256 _proposalPeriod,
            uint256 _votingPeriod,
            uint256 _gracePeriod
        ) = abi.decode(
                _thresholdsAndPeriods,
                (uint256, uint256, uint256, uint256, uint256)
            );
        depositThreshold = _depositThreshold;
        threshold = _threshold;
        proposalPeriod = _proposalPeriod;
        votingPeriod = _votingPeriod;
        gracePeriod = _gracePeriod;
    }

    /*****************
    External Data
    *****************/
    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /// @notice return the URI if a token exists
    ///     If not revealed, return pre-reveal URI
    /// @param _tokenId Token URI to query
    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        if (!_exists(_tokenId)) {
            revert URIQueryForNonexistentToken();
        }

        if (!revealed[_tokenId]) return prerevealUri;
        return _tokenUris[_tokenId];
    }

    /*****************
    Reproductive functions
    *****************/

    /// @notice Once threshold is reached, begin the proposal period
    /// @dev New rounds cannot begin until this one concludes
    function startProposals() external {
        if ((rounds[round].roundState != RoundState.Pending))
            revert StillProposing();
        if ((address(this).balance - escrow) < threshold)
            revert ThresholdNotReached();
        escrow += threshold; /*Mark portion of balance as escrow so threshold resets*/
        Round storage newRound = rounds[round];

        newRound.roundStart = block.number;
        newRound.proposalEnd = block.timestamp + proposalPeriod;
        newRound.roundState = RoundState.Proposal;
        emit ProposalStarted(round, rounds[round].proposalEnd);
    }

    function advanceRound() external {
        Round storage currentRound = rounds[round];
        RoundState currentState = roundState(round);
        if (
            (currentRound.roundState == RoundState.Proposal) &&
            (currentState == RoundState.NeedsAdvancement)
        ) {
            // If no proposals were received, complete round and return escrow;
            if (currentRound.proposalCount == 0) {
                invalidateRound();
            } else {
                currentRound.roundState = RoundState.Voting;
                currentRound.votingEnd = block.timestamp + votingPeriod;
                emit VotingStarted(round, currentRound.votingEnd);
            }
        } else if (
            (currentRound.roundState == RoundState.Voting) &&
            (currentState == RoundState.NeedsAdvancement)
        ) {
            // If no votes were received, complete round and return escrow;
            if (currentRound.totalVotes == 0) {
                invalidateRound();
            } else {
                currentRound.roundState = RoundState.Grace;
                currentRound.graceEnd = block.timestamp + gracePeriod;
                emit GraceStarted(round, currentRound.votingEnd);
            }
        } else {
            revert CannotAdvance();
        }
    }

    function invalidateRound() internal {
        Round storage currentRound = rounds[round];
        currentRound.roundState = RoundState.Invalid;
        escrow -= threshold;
        emit RoundInvalidated(round);
        round++;
    }

    function vetoProposal(uint256 _proposal) external {
        Round storage currentRound = rounds[round];
        if ((msg.sender != artist)) revert NotArtist(); /*Only artist can veto*/
        RoundState currentState = roundState(round);
        if (
            (currentState != RoundState.Voting) &&
            (currentState != RoundState.Grace)
        ) revert CannotVeto();
        if (_proposal >= currentRound.proposalCount) revert InvalidProposal();
        currentRound.proposals[_proposal].vetoed = true;
        emit ProposalVetoed(round, _proposal);
    }

    function settleRound() external {
        Round storage currentRound = rounds[round];
        if (
            (currentRound.roundState == RoundState.Grace) &&
            (block.timestamp > currentRound.graceEnd)
        ) {
            // Find winning proposal
            uint256 maxVotes;
            for (
                uint256 index = 0;
                index < currentRound.proposalCount;
                index++
            ) {
                if (
                    (currentRound.proposals[index].votes > maxVotes) &&
                    (!currentRound.proposals[index].vetoed)
                ) {
                    maxVotes = currentRound.proposals[index].votes;
                    currentRound.winningProposal = index;
                }
            }

            // If no winning proposal (all vetoed) return escrow and complete
            if (maxVotes == 0) {
                invalidateRound();
            } else {
                currentRound.roundState = RoundState.Completed;
                emit ProposalAccepted(round, currentRound.winningProposal);
                _transferFundsToArtist(round);
                round++;
            }
        } else {
            revert CannotAdvance();
        }
    }

    function _transferFundsToArtist(uint256 _round) internal {
        Round storage currentRound = rounds[_round];
        if (currentRound.fundsDistributed) revert AlreadyDistributed();
        else {
            currentRound.fundsDistributed = true;
            uint256 _fundsToDistribute = escrow;
            escrow -= threshold; /*Reduce escrow balance*/

            uint256 _toParentOrArtist = (threshold * 10) / 100;
            _fundsToDistribute -= _toParentOrArtist;
            artist.safeTransferETH(_toParentOrArtist);
            if (parent != address(0)) {
                _fundsToDistribute -= _toParentOrArtist;
                parent.safeTransferETH(_toParentOrArtist);
            }
            payable(
                currentRound.proposals[currentRound.winningProposal].proposer
            ).safeTransferETH(_fundsToDistribute);
        }
    }

    /// @dev Propose reproduction if threshold is reached
    /// @param _proposalUri Link to artist proposal
    function submitProposal(string memory _proposalUri) external {
        Round storage currentRound = rounds[round];
        if (currentRound.proposalEnd < block.timestamp)
            revert CannotSubmitProposal(); /*Revert if voting period is over*/
        currentRound.proposals[currentRound.proposalCount].uri = _proposalUri;
        currentRound.proposals[currentRound.proposalCount].proposer = msg
            .sender;
        currentRound.proposalCount++;

        emit ProposalSubmitted(
            msg.sender,
            _proposalUri,
            round,
            currentRound.proposalCount - 1
        );
    }

    /// @notice Submit vote on round proposal
    /// @dev Must be within voting period
    /// @param _proposal ID of proposal
    function submitVote(uint256 _proposal) external {
        Round storage currentRound = rounds[round];
        if (currentRound.votingEnd < block.timestamp) revert NotInVoting(); /*Revert if voting period is over*/
        if (_proposal >= currentRound.proposalCount) revert InvalidProposal(); /*Revert if proposal is blank*/
        if (currentRound.proposals[_proposal].vetoed) revert Vetoed(); /*Revert if proposal is vetoed*/
        if (currentRound.hasVoted[msg.sender]) revert AlreadyVoted();
        uint256 eligibleVotes = getPriorVotes(
            msg.sender,
            currentRound.roundStart
        );
        if (eligibleVotes == 0) revert NoVotingTokens(); /*Revert if no balance when round started*/
        currentRound.hasVoted[msg.sender] = true;
        currentRound.totalVotes += eligibleVotes;
        currentRound.proposals[_proposal].votes += eligibleVotes;
        emit Voted(msg.sender, eligibleVotes, round, _proposal);
    }

    /// @dev Spawn new plantoid by winning artist
    /// @param _round Settled round
    /// @param _newPlantoid address of new plantoid oracle
    /// @param _plantoidName token name of new plantoid
    /// @param _plantoidSymbol token symbol
    function spawn(
        uint256 _round,
        address _newPlantoid,
        uint256 _depositThreshold,
        uint256 _roundThreshold,
        uint256 _proposalPeriod,
        uint256 _votingPeriod,
        uint256 _gracePeriod,
        string memory _plantoidName,
        string memory _plantoidSymbol,
        string memory _prerevealUri
    ) external returns (address _plantoid){
        _plantoid = _spawn(
            _round,
            spawner,
            _newPlantoid,
            _plantoidName,
            _plantoidSymbol,
            _prerevealUri,
            abi.encode(
                _depositThreshold,
                _roundThreshold,
                _proposalPeriod,
                _votingPeriod,
                _gracePeriod
            )
        );
    }

    /// @dev Spawn new plantoid using custom contract by winning artist
    /// @param _round Settled round
    /// @param _newPlantoidSpawner address of new plantoid spawner
    /// @param _newPlantoid address of new plantoid oracle
    /// @param _plantoidName token name of new plantoid
    /// @param _plantoidSymbol token symbol
    function spawnCustom(
        uint256 _round,
        IPlantoidSpawner _newPlantoidSpawner,
        address _newPlantoid,
        uint256 _depositThreshold,
        uint256 _roundThreshold,
        uint256 _proposalPeriod,
        uint256 _votingPeriod,
        uint256 _gracePeriod,
        string memory _plantoidName,
        string memory _plantoidSymbol,
        string memory _prerevealUri
    ) external returns (address _plantoid){
        _plantoid = _spawn(
            _round,
            _newPlantoidSpawner,
            _newPlantoid,
            _plantoidName,
            _plantoidSymbol,
            _prerevealUri,
            abi.encode(
                _depositThreshold,
                _roundThreshold,
                _proposalPeriod,
                _votingPeriod,
                _gracePeriod
            )
        );
    }

    /// @dev Spawn new plantoid by winning artist
    /// @param _round Settled round
    /// @param _newPlantoid address of new plantoid oracle
    /// @param _plantoidName token name of new plantoid
    /// @param _plantoidSymbol token symbol
    function _spawn(
        uint256 _round,
        IPlantoidSpawner _spawner,
        address _newPlantoid,
        string memory _plantoidName,
        string memory _plantoidSymbol,
        string memory _prerevealUri,
        bytes memory _periodsAndThresholds
    ) internal returns (address _plantoid){
        Round storage currentRound = rounds[_round];
        if (
            (currentRound.proposals[currentRound.winningProposal].proposer !=
                msg.sender) || (currentRound.roundState != RoundState.Completed)
        ) revert NotWinner();
        bytes memory initData = abi.encodeWithSignature(
            "init(address,address,address,string,string,string,bytes)",
            _newPlantoid,
            payable(msg.sender),
            payable(address(this)),
            _plantoidName,
            _plantoidSymbol,
            _prerevealUri,
            _periodsAndThresholds
        );
        salt++;
        _plantoid = _spawner.spawnPlantoid(bytes32(salt), initData);
        emit NewSpawn(
            _round,
            address(_spawner),
            _plantoid,
            _plantoidName,
            _plantoidSymbol
        );
    }

    /*****************
    Supporter functions
    *****************/
    receive() external payable {
        require(
            plantoidAddress != address(0xdead),
            "Cannot send ETH to dead plantoid"
        );

        if (msg.value >= depositThreshold) {
            _tokenIds += 1;

            emit Deposit(msg.value, msg.sender, _tokenIds);
            _mint(address(this), msg.sender, _tokenIds); /*Mint unrevealed token to sender*/
        }
    }

    /// @dev Reveal NFT content for a supporter NFT
    /// @param _tokenId Token ID
    /// @param _tokenUri URI of metadata for plantoid interaction
    /// @param _signature Permission sig from plantoid
    function revealContent(
        uint256 _tokenId,
        string memory _tokenUri,
        bytes memory _signature
    ) external {
        if (!_exists(_tokenId)) {
            revert NotMinted();
        }
        if (revealed[_tokenId]) revert AlreadyRevealed();
        bytes32 _digest = keccak256(
            abi.encodePacked(_tokenId, _tokenUri, address(this))
        );

        require(_verify(_digest, _signature, plantoidAddress), "Not signer");

        _tokenUris[_tokenId] = _tokenUri;
        revealed[_tokenId] = true;

        emit Revealed(_tokenId, _tokenUri);
    }

    /*****************
    Internal utils
    *****************/
    /// @dev Internal util to confirm seed sig
    /// @param data Message hash
    /// @param signature Sig from primary token holder
    /// @param account address to compare with recovery
    function _verify(
        bytes32 data,
        bytes memory signature,
        address account
    ) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == account;
    }
}

contract PlantoidSpawn is IPlantoidSpawner {
    address payable public immutable template; // fixed template using eip-1167 proxy pattern

    event PlantoidSpawned(address indexed plantoid);

    constructor(address payable _template) {
        template = _template;
    }

    function plantoidAddress(address by, bytes32 salt)
        external
        view
        returns (address addr, bool exists)
    {
        addr = Clones.predictDeterministicAddress(
            template,
            _saltedSalt(by, salt),
            address(this)
        );
        exists = addr.code.length > 0;
    }

    function spawnPlantoid(bytes32 salt, bytes calldata initData)
        external
        returns (address payable newPlantoid)
    {
        // Create Plantoid proxy
        newPlantoid = payable(
            Clones.cloneDeterministic(template, _saltedSalt(msg.sender, salt))
        );

        // Initialize proxy.
        assembly {
            // Grab the free memory pointer.
            let m := mload(0x40)
            // Copy the `initData` to the free memory.
            calldatacopy(m, initData.offset, initData.length)
            // Call the initializer, and revert if the call fails.
            if iszero(
                call(
                    gas(), // Gas remaining.
                    newPlantoid, // Address of the plantoid.
                    0, // `msg.value` of the call: 0 ETH.
                    m, // Start of input.
                    initData.length, // Length of input.
                    0x00, // Start of output. Not used.
                    0x00 // Size of output. Not used.
                )
            ) {
                // Bubble up the revert if the call reverts.
                returndatacopy(0x00, 0x00, returndatasize())
                revert(0x00, returndatasize())
            }
        }

        emit PlantoidSpawned(newPlantoid);
    }

    /**
     * @dev Returns the salted salt.
     *      To prevent griefing and accidental collisions from clients that don't
     *      generate their salt properly.
     * @param by   The caller of the {createSoundAndMints} function.
     * @param salt The salt, generated on the client side.
     * @return result The computed value.
     */
    function _saltedSalt(address by, bytes32 salt)
        internal
        pure
        returns (bytes32 result)
    {
        assembly {
            // Store the variables into the scratch space.
            mstore(0x00, by)
            mstore(0x20, salt)
            // Equivalent to `keccak256(abi.encode(by, salt))`.
            result := keccak256(0x00, 0x40)
        }
    }
}
