pragma solidity 0.8.15;

import {SafeTransferLib} from "@rari-capital/solmate/src/utils/SafeTransferLib.sol";

contract TipRelayer {
    using SafeTransferLib for address payable;

    receive() external payable {
        address payable tipReceiver = payable(tx.origin);
        tipReceiver.safeTransferETH(msg.value);
    }
}
