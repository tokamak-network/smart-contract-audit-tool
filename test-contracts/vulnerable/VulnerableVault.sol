// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title VulnerableVault
 * @notice INTENTIONALLY VULNERABLE - For testing audit tool detection
 * @dev ERC4626-style vault with multiple security vulnerabilities
 */
contract VulnerableVault is ERC20 {
    IERC20 public immutable asset;
    
    address public owner;
    bool public paused;
    
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);

    // VULN-1: No zero address check for asset
    constructor(address _asset) ERC20("Vault Shares", "vSHARE") {
        asset = IERC20(_asset);
        owner = msg.sender;
    }

    // VULN-2: First depositor attack - share price manipulation
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        // Missing: require(assets >= MINIMUM_DEPOSIT, "Too small");
        
        shares = convertToShares(assets);
        
        // VULN-3: No slippage protection
        // Missing: require(shares >= minShares, "Slippage too high");
        
        asset.transferFrom(msg.sender, address(this), assets); // VULN-7: Not using SafeERC20
        _mint(receiver, shares);
        
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    // VULN-4: Division before multiplication - precision loss
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return assets; // First deposit: 1:1
        }
        // BAD: Division before multiplication
        return (assets / totalAssets()) * supply;
        // GOOD would be: return (assets * supply) / totalAssets();
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return shares;
        }
        return (shares * totalAssets()) / supply;
    }

    function withdraw(uint256 assets, address receiver, address owner_) external returns (uint256 shares) {
        shares = convertToShares(assets);
        
        if (msg.sender != owner_) {
            uint256 allowed = allowance(owner_, msg.sender);
            if (allowed != type(uint256).max) {
                // VULN-5: No check that allowed >= shares before subtraction
                _approve(owner_, msg.sender, allowed - shares);
            }
        }
        
        _burn(owner_, shares);
        
        // VULN-3 continued: receiver could be address(0)
        asset.transfer(receiver, assets); // VULN-7 continued: Not using SafeERC20
        
        emit Withdraw(msg.sender, receiver, assets, shares);
    }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    // VULN-6: Centralization - owner can drain all funds
    function emergencyWithdraw(address to) external {
        require(msg.sender == owner, "Not owner");
        // No timelock, no multisig, instant drain capability
        uint256 balance = asset.balanceOf(address(this));
        asset.transfer(to, balance);
    }

    // FALSE POSITIVE TEST: Proper access control with documented admin function
    // Should NOT be flagged as "unexpected admin privilege" - it's clearly intentional
    function pause() external {
        require(msg.sender == owner, "Not owner");
        paused = true;
    }

    function unpause() external {
        require(msg.sender == owner, "Not owner");
        paused = false;
    }
}
