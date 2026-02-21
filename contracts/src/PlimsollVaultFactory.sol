// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PlimsollVault} from "./PlimsollVault.sol";
import {VelocityLimitModule} from "./modules/VelocityLimitModule.sol";
import {TargetWhitelistModule} from "./modules/TargetWhitelistModule.sol";
import {DrawdownGuardModule} from "./modules/DrawdownGuardModule.sol";

/**
 * @title PlimsollVaultFactory — One-Click Vault Deployment
 * @notice Deploys a complete PlimsollVault stack (vault + 3 physics modules)
 *         in a single transaction. Tracks all deployments per owner for
 *         dashboard auto-discovery.
 *
 * Ownership Flow:
 *   1. Factory deploys vault with itself as temporary owner.
 *   2. Factory calls setModules() to wire physics modules.
 *   3. Factory forwards any ETH as initial deposit.
 *   4. Factory calls transferOwnership(msg.sender).
 *   5. Caller must call vault.acceptOwnership() to finalize.
 */
contract PlimsollVaultFactory {
    // ── State ───────────────────────────────────────────────────

    /// @notice All vaults deployed by a given owner.
    mapping(address => address[]) public ownerVaults;

    /// @notice All vaults ever deployed through this factory.
    address[] public allVaults;

    // ── Events ──────────────────────────────────────────────────

    event VaultCreated(
        address indexed owner,
        address indexed vault,
        address velocity,
        address whitelist,
        address drawdown
    );

    // ── Core ────────────────────────────────────────────────────

    /**
     * @notice Deploy a complete PlimsollVault with physics modules.
     * @param maxPerHour   Maximum spend rate in wei per hour (VelocityLimitModule).
     * @param maxSingleTx  Maximum spend per single transaction in wei.
     * @param maxDrawdownBps Maximum drawdown in basis points (500 = 5%).
     * @return vault     The deployed PlimsollVault address.
     * @return velocity  The deployed VelocityLimitModule address.
     * @return whitelist The deployed TargetWhitelistModule address.
     * @return drawdown  The deployed DrawdownGuardModule address.
     *
     * @dev After calling this function, the caller MUST call
     *      vault.acceptOwnership() to finalize ownership transfer.
     *      Module owners (whitelist, drawdown) are set to msg.sender directly.
     */
    function createVault(
        uint256 maxPerHour,
        uint256 maxSingleTx,
        uint256 maxDrawdownBps
    ) external payable returns (
        address vault,
        address velocity,
        address whitelist,
        address drawdown
    ) {
        // 1. Deploy vault with factory as temporary owner
        PlimsollVault v = new PlimsollVault(address(this));

        // 2. Deploy modules — user (msg.sender) is the module owner
        VelocityLimitModule vel = new VelocityLimitModule(
            address(v),
            msg.sender,
            maxPerHour,
            maxSingleTx,
            3600 // 1-hour window
        );
        TargetWhitelistModule wl = new TargetWhitelistModule(msg.sender);
        DrawdownGuardModule dd = new DrawdownGuardModule(msg.sender, maxDrawdownBps);

        // 3. Wire modules (factory is owner, so this succeeds)
        v.setModules(address(vel), address(wl), address(dd));

        // 4. Forward initial deposit if provided
        if (msg.value > 0) {
            v.deposit{value: msg.value}();
        }

        // 5. Initiate ownership transfer to caller
        v.transferOwnership(msg.sender);

        // 6. Track deployment
        ownerVaults[msg.sender].push(address(v));
        allVaults.push(address(v));

        emit VaultCreated(msg.sender, address(v), address(vel), address(wl), address(dd));

        return (address(v), address(vel), address(wl), address(dd));
    }

    // ── View Functions ──────────────────────────────────────────

    /// @notice Get all vaults deployed by a given owner.
    function getVaultsByOwner(address owner_) external view returns (address[] memory) {
        return ownerVaults[owner_];
    }

    /// @notice Get the total number of vaults deployed through this factory.
    function getVaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice Get all vault addresses.
    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }
}
