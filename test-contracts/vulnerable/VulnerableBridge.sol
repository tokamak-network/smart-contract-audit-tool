// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol"; // VULN-8: Debug import in production

/**
 * @title VulnerableBridge
 * @notice INTENTIONALLY VULNERABLE - For testing audit tool detection
 * @dev This contract contains multiple security vulnerabilities for regression testing
 */

interface ICrossDomainMessenger {
    function sendMessage(address _target, bytes calldata _message, uint32 _minGasLimit) external;
    function xDomainMessageSender() external view returns (address);
}

contract VulnerableBridgeStorage {
    address public messenger;
    address public otherBridge;
    address public l1Token;
    address public l2Token;
    mapping(address => mapping(address => uint256)) public deposits;
}

contract VulnerableBridge is VulnerableBridgeStorage {
    using SafeERC20 for IERC20;

    event DepositInitiated(address indexed from, address indexed to, uint256 amount);
    event WithdrawalFinalized(address indexed from, address indexed to, uint256 amount);

    // VULN-1: Empty constructor - storage variables never initialized
    constructor() {}

    // VULN-5: Weak EOA check - bypassable via constructor
    modifier onlyEOA() {
        require(msg.sender.code.length == 0, "Only EOA");
        _;
    }

    modifier onlyOtherBridge() {
        require(
            msg.sender == messenger &&
            ICrossDomainMessenger(messenger).xDomainMessageSender() == otherBridge,
            "Not authorized"
        );
        _;
    }

    // VULN-2: No token validation - accepts ANY ERC20 token
    function deposit(
        address _l1Token,
        address _l2Token,
        uint256 _amount,
        uint32 _minGasLimit
    ) external onlyEOA {
        // VULN-3: No zero address validation
        // Missing: require(_l1Token != address(0), "Invalid token");
        
        IERC20(_l1Token).safeTransferFrom(msg.sender, address(this), _amount);
        deposits[_l1Token][_l2Token] += _amount;

        ICrossDomainMessenger(messenger).sendMessage(
            otherBridge,
            abi.encodeWithSignature(
                "finalizeDeposit(address,address,address,uint256)",
                _l1Token,
                _l2Token,
                msg.sender,
                _amount
            ),
            _minGasLimit  // VULN-6: No gas limit validation
        );

        emit DepositInitiated(msg.sender, msg.sender, _amount);
    }

    // VULN-4: Integer underflow DoS - if _amount > deposits, reverts permanently
    function finalizeWithdrawal(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount
    ) external onlyOtherBridge {
        // Missing check: require(deposits[_l1Token][_l2Token] >= _amount, "Insufficient deposits");
        deposits[_l1Token][_l2Token] = deposits[_l1Token][_l2Token] - _amount;
        
        // VULN-3 continued: _to could be address(0)
        IERC20(_l1Token).safeTransfer(_to, _amount);
        
        emit WithdrawalFinalized(_from, _to, _amount);
    }

    // VULN-7: No replay protection - same message can be processed multiple times
    // Missing: mapping(bytes32 => bool) public processedMessages;

    // FALSE POSITIVE TEST: This function follows CEI pattern correctly with SafeERC20
    // The auditor should NOT flag this as reentrancy vulnerable
    function safeWithdraw(address _token, uint256 _amount) external {
        require(deposits[_token][_token] >= _amount, "Insufficient");
        
        // Effects BEFORE interactions (correct CEI)
        deposits[_token][_token] -= _amount;
        
        // Interaction AFTER effects
        IERC20(_token).safeTransfer(msg.sender, _amount);
    }
}
