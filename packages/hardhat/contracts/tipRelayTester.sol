pragma solidity 0.8.15;

import {SafeTransferLib} from "@rari-capital/solmate/src/utils/SafeTransferLib.sol";

contract TipRelayTester {
    using SafeTransferLib for address payable;
    
    address payable relayer;
    
    constructor(address payable _relayer) {
      relayer = _relayer;
    }
    
    function distribute() external {
      relayer.safeTransferETH(address(this).balance);
    }

    receive() external payable {
    }
}
