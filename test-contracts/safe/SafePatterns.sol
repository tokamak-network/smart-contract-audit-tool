// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SafePatterns
 * @notice INTENTIONALLY SAFE - For testing false positive detection
 * @dev This contract contains patterns that LOOK suspicious but are actually safe
 * @dev The auditor should NOT flag these as Critical or High vulnerabilities
 */
contract SafePatterns is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    mapping(address => uint256) public balances;
    
    bool public paused;
    uint256 public constant WITHDRAWAL_DELAY = 1 days;
    mapping(address => uint256) public withdrawalRequests;

    event Deposited(address indexed user, uint256 amount);
    event WithdrawalRequested(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token");
        token = IERC20(_token);
    }

    // SAFE-1: Proper CEI pattern with SafeERC20
    // Should NOT be flagged as reentrancy
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        // Effects BEFORE interactions
        balances[msg.sender] += amount;
        
        // Safe external call with SafeERC20
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        emit Deposited(msg.sender, amount);
    }

    // SAFE-2: CEI pattern WITHOUT ReentrancyGuard but still safe
    // Standard ERC20 (no callbacks) + state update before transfer = SAFE
    // Should NOT be flagged as Critical/High reentrancy
    function withdrawDirect(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // Effects BEFORE interactions (CEI pattern)
        balances[msg.sender] -= amount;
        
        // SafeERC20 transfer - no reentrancy vector with standard ERC20
        token.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }

    // SAFE-3: Intentional admin function with proper access control
    // Should NOT be flagged as "unexpected privilege" - it's documented
    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    // SAFE-4: Using Solidity 0.8.x built-in overflow protection
    // Should NOT be flagged as arithmetic overflow vulnerability
    function safeArithmetic(uint256 a, uint256 b) external pure returns (uint256) {
        // These operations have built-in overflow checks in 0.8.x
        uint256 sum = a + b;      // Safe: reverts on overflow
        uint256 diff = a - b;     // Safe: reverts on underflow
        uint256 product = a * b;  // Safe: reverts on overflow
        return sum + diff + product;
    }

    // SAFE-5: Proper two-step withdrawal pattern
    // Should NOT be flagged as missing access control
    function requestWithdrawal(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        withdrawalRequests[msg.sender] = block.timestamp;
        emit WithdrawalRequested(msg.sender, amount);
    }

    function executeWithdrawal(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(withdrawalRequests[msg.sender] != 0, "No request");
        require(
            block.timestamp >= withdrawalRequests[msg.sender] + WITHDRAWAL_DELAY,
            "Delay not passed"
        );
        
        // Clear request first
        delete withdrawalRequests[msg.sender];
        
        // Then update balance
        balances[msg.sender] -= amount;
        
        // Finally transfer
        token.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
}
