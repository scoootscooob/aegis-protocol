// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PlimsollVaultFactory.sol";
import "../src/PlimsollVault.sol";
import "../src/modules/VelocityLimitModule.sol";
import "../src/modules/TargetWhitelistModule.sol";
import "../src/modules/DrawdownGuardModule.sol";

/// @title PlimsollVaultFactory Test Suite
contract PlimsollVaultFactoryTest is Test {
    PlimsollVaultFactory factory;

    address user1 = address(0xA11CE);
    address user2 = address(0xB0B);
    address agent = address(0xA6E1);
    address target = address(0xC0DE);

    function setUp() public {
        vm.warp(1700000000);
        factory = new PlimsollVaultFactory();
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
    }

    // ── Deployment ─────────────────────────────────────────────

    function test_createVault_deploys_all_contracts() public {
        vm.prank(user1);
        (address vault, address velocity, address whitelist, address drawdown) =
            factory.createVault(10 ether, 5 ether, 500);

        assertTrue(vault != address(0));
        assertTrue(velocity != address(0));
        assertTrue(whitelist != address(0));
        assertTrue(drawdown != address(0));
    }

    function test_createVault_emits_VaultCreated() public {
        vm.prank(user1);
        vm.expectEmit(true, false, false, false);
        emit PlimsollVaultFactory.VaultCreated(user1, address(0), address(0), address(0), address(0));
        factory.createVault(10 ether, 5 ether, 500);
    }

    // ── Registry Tracking ──────────────────────────────────────

    function test_createVault_tracks_ownerVaults() public {
        vm.prank(user1);
        (address vault,,, ) = factory.createVault(10 ether, 5 ether, 500);

        address[] memory vaults = factory.getVaultsByOwner(user1);
        assertEq(vaults.length, 1);
        assertEq(vaults[0], vault);
    }

    function test_createVault_tracks_allVaults() public {
        vm.prank(user1);
        (address vault1,,, ) = factory.createVault(10 ether, 5 ether, 500);

        vm.prank(user2);
        (address vault2,,, ) = factory.createVault(20 ether, 10 ether, 1000);

        assertEq(factory.getVaultCount(), 2);
        address[] memory all = factory.getAllVaults();
        assertEq(all[0], vault1);
        assertEq(all[1], vault2);
    }

    function test_multiple_vaults_same_owner() public {
        vm.startPrank(user1);
        (address v1,,, ) = factory.createVault(10 ether, 5 ether, 500);
        (address v2,,, ) = factory.createVault(20 ether, 10 ether, 1000);
        vm.stopPrank();

        address[] memory vaults = factory.getVaultsByOwner(user1);
        assertEq(vaults.length, 2);
        assertEq(vaults[0], v1);
        assertEq(vaults[1], v2);
    }

    function test_different_owners_separate_registries() public {
        vm.prank(user1);
        factory.createVault(10 ether, 5 ether, 500);

        vm.prank(user2);
        factory.createVault(20 ether, 10 ether, 1000);

        assertEq(factory.getVaultsByOwner(user1).length, 1);
        assertEq(factory.getVaultsByOwner(user2).length, 1);
    }

    // ── Module Wiring ──────────────────────────────────────────

    function test_createVault_modules_wired() public {
        vm.prank(user1);
        (address vault, address velocity, address whitelist, address drawdown) =
            factory.createVault(10 ether, 5 ether, 500);

        PlimsollVault v = PlimsollVault(payable(vault));
        assertEq(address(v.velocityModule()), velocity);
        assertEq(address(v.whitelistModule()), whitelist);
        assertEq(address(v.drawdownModule()), drawdown);
    }

    function test_velocity_module_params() public {
        vm.prank(user1);
        (, address velocity,, ) = factory.createVault(10 ether, 5 ether, 500);

        VelocityLimitModule vel = VelocityLimitModule(velocity);
        assertEq(vel.maxPerHour(), 10 ether);
        assertEq(vel.maxSingleTx(), 5 ether);
        assertEq(vel.windowSeconds(), 3600);
    }

    function test_drawdown_module_params() public {
        vm.prank(user1);
        (,,, address drawdown) = factory.createVault(10 ether, 5 ether, 500);

        DrawdownGuardModule dd = DrawdownGuardModule(drawdown);
        assertEq(dd.maxDrawdownBps(), 500);
    }

    // ── Module Ownership ───────────────────────────────────────

    function test_velocity_module_owner_is_caller() public {
        vm.prank(user1);
        (, address velocity,, ) = factory.createVault(10 ether, 5 ether, 500);

        VelocityLimitModule vel = VelocityLimitModule(velocity);
        assertEq(vel.owner(), user1);
    }

    function test_whitelist_module_owner_is_caller() public {
        vm.prank(user1);
        (,, address whitelist, ) = factory.createVault(10 ether, 5 ether, 500);

        TargetWhitelistModule wl = TargetWhitelistModule(whitelist);
        assertEq(wl.owner(), user1);
    }

    function test_drawdown_module_owner_is_caller() public {
        vm.prank(user1);
        (,,, address drawdown) = factory.createVault(10 ether, 5 ether, 500);

        DrawdownGuardModule dd = DrawdownGuardModule(drawdown);
        assertEq(dd.owner(), user1);
    }

    // ── Ownership Transfer ─────────────────────────────────────

    function test_vault_pending_owner_is_caller() public {
        vm.prank(user1);
        (address vault,,, ) = factory.createVault(10 ether, 5 ether, 500);

        PlimsollVault v = PlimsollVault(payable(vault));
        assertEq(v.pendingOwner(), user1);
    }

    function test_vault_owner_is_factory_before_accept() public {
        vm.prank(user1);
        (address vault,,, ) = factory.createVault(10 ether, 5 ether, 500);

        PlimsollVault v = PlimsollVault(payable(vault));
        assertEq(v.owner(), address(factory));
    }

    function test_accept_ownership_completes_transfer() public {
        vm.prank(user1);
        (address vault,,, ) = factory.createVault(10 ether, 5 ether, 500);

        PlimsollVault v = PlimsollVault(payable(vault));
        vm.prank(user1);
        v.acceptOwnership();

        assertEq(v.owner(), user1);
        assertEq(v.pendingOwner(), address(0));
    }

    // ── Deposit Forwarding ─────────────────────────────────────

    function test_createVault_with_deposit() public {
        vm.prank(user1);
        (address vault,,, ) = factory.createVault{value: 5 ether}(10 ether, 5 ether, 500);

        PlimsollVault v = PlimsollVault(payable(vault));
        assertEq(v.vaultBalance(), 5 ether);
        assertEq(v.initialBalance(), 5 ether);
    }

    function test_createVault_without_deposit() public {
        vm.prank(user1);
        (address vault,,, ) = factory.createVault(10 ether, 5 ether, 500);

        PlimsollVault v = PlimsollVault(payable(vault));
        assertEq(v.vaultBalance(), 0);
    }

    // ── Functional After Deploy ────────────────────────────────

    function test_vault_functional_after_factory_deploy() public {
        // Use 5000 bps (50%) drawdown so floor = 5 ETH for 10 ETH deposit
        vm.prank(user1);
        (address vault,,, ) = factory.createVault{value: 10 ether}(10 ether, 5 ether, 5000);

        PlimsollVault v = PlimsollVault(payable(vault));

        // Accept ownership
        vm.prank(user1);
        v.acceptOwnership();

        // Add whitelist target
        TargetWhitelistModule wl = TargetWhitelistModule(address(v.whitelistModule()));
        vm.prank(user1);
        wl.addTarget(target);

        // Issue session key
        vm.prank(user1);
        v.issueSessionKey(agent, 86400, 5 ether, 8 ether);

        // Execute as agent
        vm.prank(agent);
        v.execute(target, 1 ether, "");
        assertEq(target.balance, 1 ether);
    }

    // ── View Functions ─────────────────────────────────────────

    function test_getVaultCount_empty() public view {
        assertEq(factory.getVaultCount(), 0);
    }

    function test_getVaultsByOwner_empty() public view {
        address[] memory vaults = factory.getVaultsByOwner(user1);
        assertEq(vaults.length, 0);
    }

    function test_getAllVaults_empty() public view {
        address[] memory vaults = factory.getAllVaults();
        assertEq(vaults.length, 0);
    }
}
