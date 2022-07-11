// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SafeTransferLib} from "@rari-capital/solmate/src/utils/SafeTransferLib.sol";

interface IPlantoidSpawner {
    function spawnPlantoid(
        address,
        address payable,
        address payable,
        uint256[2] memory,
        uint256[4] memory,
        string memory,
        string memory,
        string memory
    ) external returns (bool, address);
}
error StillVoting();
error NotInVoting();
error AlreadyVoting();
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

/// @title Plantoid
/// @dev Blockchain based lifeform
///
///
contract Plantoid is ERC721Enumerable, Initializable {
    using SafeTransferLib for address payable;
    using ECDSA for bytes32; /*ECDSA for signature recovery for license mints*/

    event Deposit(uint256 amount, address sender, uint256 indexed tokenId);
    event ProposalSubmitted(
        address proposer,
        string proposalUri,
        uint256 proposalId
    );
    event VotingStarted(uint256 round, uint256 end);
    event Voted(address voter, uint256 round, uint256 choice);
    event ProposalVetoed(
        uint256 round,
        address settler,
        uint256 proposal,
        uint256 end
    );
    event ProposalAccepted(address settler, uint256 proposal);
    event NewSpawn(
        uint256 round,
        address spawner,
        address newPlantoid,
        address fundDestination,
        string name,
        string symbol
    );

    /* 
        proposer: address of prospective artist
        proposalUri: link to proposal details
        vetoed: mark if proposal won but was vetoed by current artist
    */
    struct Proposal {
        address proposer;
        string proposalUri;
        bool vetoed;
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

    mapping(uint256 => uint256) public proposalCounter; /* round => proposal count*/
    mapping(uint256 => mapping(uint256 => Proposal)) public proposals; /* round => proposal Id => Proposal */
    mapping(uint256 => uint256) public winningProposal; /* round => winning proposal Id */

    mapping(uint256 => mapping(uint256 => uint256)) public voted; /* spawn count => token ID => chosen proposalId */
    /*NOTE proposal IDs start at 1 so 0 counts as not voted*/
    mapping(uint256 => mapping(uint256 => uint256)) public votes; /* spawn count => proposal Id => votes*/

    uint256 public round; /* Track active voting round*/
    address payable public parent; /* Parent plantoid contract*/
    address payable public artist; /* Store artist for this plantoid*/

    uint256 votingPeriod; /*Time during which holders can vote for active proposals*/
    uint256 votingExt; /*How long to extend a vote if the winner is vetoed*/
    uint256 gracePeriod; /*Time between voting ended and when vote can settle*/
    uint256 settlePeriod; /*Time artist has to settle or veto, before anyone can settle*/

    /*****************
    Minting state mgmt
    *****************/
    mapping(bytes32 => bool) public signatureUsed; /* track if minting signature has been used */
    address public plantoidAddress; /* Plantoid oracle TODO make changeable by creator? */
    uint256 _tokenIds; /* Track minted seed token IDS*/
    mapping(uint256 => string) private _tokenUris; /*Track token URIs for each seed*/

    /*****************
    Config state mgmt
    *****************/
    string private _name; /*Token name override*/
    string private _symbol; /*Token symbol override*/
    string public contractURI; /*contractURI contract metadata json*/

    IPlantoidSpawner spawner; /*Contract to spawn new plantoids*/

    /*****************
    Configuration
    *****************/

    /// @dev contructor creates an unusable plantoid for future spawn templates
    constructor() ERC721("", "") initializer {
        /* initializer modifier makes it so init cannot be called on template*/
        plantoidAddress = address(0xdead); /*Set address to dead so receive fallback of template fails*/
    }

    /// @dev Initialize
    /// @param _plantoid Address of plantoid oracle on physical sculpture
    /// @param _artist Address of creator of this plantoid
    /// @param name_ Token name for supporter seeds
    /// @param symbol_ Token symbol for supporter seeds
    function init(
        address _plantoid,
        address payable _artist,
        address payable _parent,
        uint256[2] memory _thresholds,
        uint256[4] calldata _periods,
        string calldata name_,
        string calldata symbol_,
        string calldata _prerevealUri
    ) external initializer {
        plantoidAddress = _plantoid;
        artist = _artist;
        parent = _parent;
        depositThreshold = _thresholds[0];
        threshold = _thresholds[1];
        _name = name_;
        _symbol = symbol_;
        votingPeriod = _periods[0];
        gracePeriod = _periods[1];
        votingExt = _periods[2];
        settlePeriod = _periods[3];
        prerevealUri = _prerevealUri;
        spawner = IPlantoidSpawner(msg.sender); /*Initialize interface to spawner*/
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

    /// @notice Get max number of votes a proposal received in a round
    /// @param _round Round to query
    function maxVotes(uint256 _round) public view returns (uint256 _maxVotes) {
        // Proposal IDs start at 1
        for (uint256 _i = 1; _i <= proposalCounter[_round]; _i++) {
            if (votes[_round][_i] > _maxVotes) _maxVotes = votes[_round][_i]; // Detect max amount of votes received in a round
        }
    }

    /// @notice Once threshold is reached, begin the voting process
    /// @dev Next round starts when non-escrow balance is over threshold
    function startVoting() external {
        if ((address(this).balance - escrow) < threshold)
            revert ThresholdNotReached();
        escrow += threshold; /*Mark portion of balance as escrow so threshold resets*/
        votingEnd[round] = block.timestamp + votingPeriod; /*Allow voting until now + period*/
        emit VotingStarted(round, votingEnd[round]);

        round++; /*Increment round*/
    }

    /// @dev Propose reproduction if threshold is reached
    /// @param _round Round to propose for - round is same as spawn count for this plantoid
    /// @param _proposalUri Link to artist proposal
    function submitProposal(uint256 _round, string memory _proposalUri)
        external
    {
        if (votingEnd[_round] < block.timestamp) revert NotInVoting();
        proposalCounter[_round] += 1; /*Increment number of proposals in a round*/
        proposals[_round][proposalCounter[_round]] = Proposal(
            msg.sender,
            _proposalUri,
            false
        ); /*Initiate a new proposal*/
        emit ProposalSubmitted(
            msg.sender,
            _proposalUri,
            proposalCounter[_round]
        );
    }

    /// @notice Submit vote on round proposal
    /// @dev Must be within voting period
    /// @param _round Round to vote for
    /// @param _proposal ID of proposal
    /// @param _votingTokenIds IDs of tokens to use for vote
    function submitVote(
        uint256 _round,
        uint256 _proposal,
        uint256[] memory _votingTokenIds
    ) external {
        if (votingEnd[_round] < block.timestamp) revert NotInVoting(); /*Revert if voting period is over*/
        if (proposals[_round][_proposal].proposer == address(0))
            revert InvalidProposal(); /*Revert if proposal is blank*/
        if (proposals[_round][_proposal].vetoed) revert Vetoed(); /*Revert if proposal is vetoed*/
        if (_votingTokenIds.length == 0) revert NoVotingTokens(); /*Revert if empty array*/
        for (uint256 index = 0; index < _votingTokenIds.length; index++) {
            if (ownerOf(_votingTokenIds[index]) != msg.sender)
                revert NotOwner(); /*Revert if not owner of selected token*/
            if (
                voted[_round][_votingTokenIds[index]] != 0 &&
                !proposals[_round][_votingTokenIds[index]].vetoed
            ) revert AlreadyVoted(); /*Revert if already voted and not vetoed*/

            voted[_round][_votingTokenIds[index]] = _proposal; /*Mark votes per token*/
        }
        votes[_round][_proposal] += _votingTokenIds.length; /*Increment total votes for a proposal*/
        emit Voted(msg.sender, _round, _proposal);
    }

    /// @notice Accept winner by the artist, or veto the winner and extend the voting period
    /// @dev If 2 proposals are tied, artist can pick winner from the ties
    ///     If settle period passes, anyone can settle and pick a winner from a tie if relevant
    /// @param _round Round to settle
    /// @param _veto Proposal ID
    function settle(
        uint256 _round,
        uint256 _winningProposal,
        bool _veto
    ) external {
        if ((votingEnd[_round] + gracePeriod) > block.timestamp)
            revert StillVoting();
        if (
            (msg.sender != artist) &&
            ((votingEnd[_round] + settlePeriod) < block.timestamp)
        ) revert NotArtist(); /*Only artist can settle, unless settle period has passed*/
        if ((msg.sender != artist) && _veto) revert NotArtist(); /*Only artist can veto*/
        if (proposals[_round][_winningProposal].proposer == address(0))
            revert InvalidProposal(); /*Revert if proposal is blank*/
        if (votes[_round][_winningProposal] != maxVotes(_round))
            revert NotWinner(); /*Allow artist to select a tiebreaker*/
        /*If proposal is vetoed, extend voting period and allow people to vote for a different proposal*/
        if (_veto) {
            votingEnd[_round] = block.timestamp + votingExt;
            proposals[_round][_winningProposal].vetoed = true;
            votes[_round][_winningProposal] = 0;
            emit ProposalVetoed(
                _round,
                msg.sender,
                _winningProposal,
                votingEnd[_round]
            );
        } else {
            winningProposal[_round] = _winningProposal; /*If not vetoed, mark winner*/
            emit ProposalAccepted(msg.sender, _winningProposal);
        }
    }

    /// @dev Spawn new plantoid by winning artist
    /// @param _round Settled round
    /// @param _newPlantoid address of new plantoid oracle
    /// @param _plantoidName token name of new plantoid
    /// @param _plantoidSymbol token symbol
    function spawn(
        uint256 _round,
        address _newPlantoid,
        address payable _fundDestination,
        uint256[2] memory _thresholds,
        uint256[4] memory _periods,
        string memory _plantoidName,
        string memory _plantoidSymbol,
        string memory _prerevealUri
    ) external {
        _spawn(
            _round,
            spawner,
            _newPlantoid,
            _fundDestination,
            _thresholds,
            _periods,
            _plantoidName,
            _plantoidSymbol,
            _prerevealUri
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
        address payable _fundDestination,
        uint256[2] memory _thresholds,
        uint256[4] memory _periods,
        string memory _plantoidName,
        string memory _plantoidSymbol,
        string memory _prerevealUri
    ) external {
        _spawn(
            _round,
            _newPlantoidSpawner,
            _newPlantoid,
            _fundDestination,
            _thresholds,
            _periods,
            _plantoidName,
            _plantoidSymbol,
            _prerevealUri
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
        address payable _fundDestination,
        uint256[2] memory _thresholds,
        uint256[4] memory _periods,
        string memory _plantoidName,
        string memory _plantoidSymbol,
        string memory _prerevealUri
    ) internal {
        if (proposals[_round][winningProposal[_round]].proposer != msg.sender)
            revert NotWinner();
        escrow -= threshold; /*Reduce escrow balance*/
        uint256 _toParentOrArtist = (threshold * 10) / 100;
        artist.safeTransferETH(_toParentOrArtist);
        if (parent != address(0)) parent.safeTransferETH(_toParentOrArtist);
        _fundDestination.safeTransferETH(threshold - (2 * _toParentOrArtist));
        (bool _success, address _plantoid) = _spawner.spawnPlantoid(
            _newPlantoid,
            payable(msg.sender),
            payable(address(this)),
            _thresholds,
            _periods,
            _plantoidName,
            _plantoidSymbol,
            _prerevealUri
        );
        if (!_success) revert FailedToSpawn();
        emit NewSpawn(
            _round,
            address(_spawner),
            _plantoid,
            _fundDestination,
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

        if (msg.value < depositThreshold) revert ThresholdNotReached();
        _tokenIds += 1;

        emit Deposit(msg.value, msg.sender, _tokenIds);
        _mint(msg.sender, _tokenIds); /*Mint unrevealed token to sender*/
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

contract CloneFactory {
    function createClone(address payable target)
        internal
        returns (address payable result)
    {
        // eip-1167 proxy pattern adapted for payable platoid spawner
        bytes20 targetBytes = bytes20(address(target));
        assembly {
            let clone := mload(0x40)
            mstore(
                clone,
                0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000
            )
            mstore(add(clone, 0x14), targetBytes)
            mstore(
                add(clone, 0x28),
                0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000
            )
            result := create(0, clone, 0x37)
        }
    }
}

contract PlantoidSpawn is CloneFactory, IPlantoidSpawner {
    address payable public immutable template; // fixed template using eip-1167 proxy pattern

    event PlantoidSpawned(address indexed plantoid, address indexed artist);

    constructor(address payable _template) {
        template = _template;
    }

    // add a generic data bytes field so people can make new templates
    function spawnPlantoid(
        address _plantoidAddr,
        address payable _artist,
        address payable _parent,
        uint256[2] memory _thresholds,
        uint256[4] calldata _periods,
        string memory _name,
        string memory _symbol,
        string memory _prerevealUri
    ) external override returns (bool, address) {
        Plantoid _plantoid = Plantoid(createClone(template));
        _plantoid.init(
            _plantoidAddr,
            _artist,
            _parent,
            _thresholds,
            _periods,
            _name,
            _symbol,
            _prerevealUri
        );
        emit PlantoidSpawned(address(_plantoid), _artist);
        return (true, address(_plantoid));
    }
}
