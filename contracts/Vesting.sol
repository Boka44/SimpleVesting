// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Vesting is ReentrancyGuard {
    // State variables
    address public token;
    address public owner;
    address public beneficiary;
    
    uint256 public startTime;
    uint256 public cliffDuration;
    uint256 public fullVestingPeriod;
    uint256 public balance;
    
    uint256 public releasedAmount;
    
    // Events
    event TokensReleased(address indexed beneficiary, uint256 amount, uint256 timestamp);
    
    // Custom errors
    error NotBeneficiary();
    error CliffNotReached();
    error NoTokensToRelease();
    error TransferFailed();
    error InvalidParameters();

    constructor(
        address _token,
        address _beneficiary,
        uint256 _startTime,
        uint256 _cliffDuration,
        uint256 _fullVestingPeriod,
        uint256 _balance
    ) {
        if (_token == address(0) || _beneficiary == address(0)) revert InvalidParameters();
        if (_cliffDuration >= _fullVestingPeriod) revert InvalidParameters();
        if (_balance == 0) revert InvalidParameters();


        owner = msg.sender;
        token = _token;
        beneficiary = _beneficiary;
        startTime = _startTime;
        cliffDuration = _cliffDuration;
        fullVestingPeriod = _fullVestingPeriod;
        balance = _balance;
    }

    function getVestingAmount() public view returns (uint256) {
        uint256 currentTime = block.timestamp;
        if (currentTime < startTime + cliffDuration) {
            return 0;
        }
        if (currentTime >= startTime + fullVestingPeriod) {
            return balance;
        }
        uint256 timeFromCliff = currentTime - (startTime + cliffDuration);
        uint256 vestingDuration = fullVestingPeriod - cliffDuration;
        // Vesting amount is calculated linearly, taking the time from the cliff to the current time and dividing it by the total vesting period
        // then multiplying it by the total balance
        // for example, if half of the vesting period has passed, the vested amount is half of the total balance
        return (balance * timeFromCliff) / vestingDuration;
    }

    function release() public {
        uint256 currentTime = block.timestamp;
        if(msg.sender != beneficiary) revert NotBeneficiary();
        if (currentTime < startTime + cliffDuration) {
            revert CliffNotReached();
        }
        
        uint256 amountToUnlock = getVestingAmount();
        uint256 releasable = amountToUnlock - releasedAmount;
        
        if(releasable == 0) revert NoTokensToRelease();
        
        releasedAmount += releasable;
        bool success = IERC20(token).transfer(beneficiary, releasable);
        if(!success) revert TransferFailed();
        
        emit TokensReleased(beneficiary, releasable, block.timestamp);
    }

}
