// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPayoutSink} from "./IPayoutSink.sol";
import {IPayoutRouterWriter} from "./IPayoutRouterWriter.sol";

/// @title IPayoutRouter
/// @notice The complete pool-facing surface of the payout router: the `base()` the pool validates against
///         its asset (`IPayoutSink`) AND the `setPending` push the pool uses to bind a released tranche
///         (`IPayoutRouterWriter`). `CharityPool.setPayoutRouter` type-demands this composite, so a router
///         missing either facet fails at wiring time rather than at `releaseTranche` runtime.
/// @dev Deliberately excludes the operator surface (`recordAndPay`/`recoverToPool`) — the pool never calls
///      those, so the decoupling (pool depends only on what it uses) is preserved.
interface IPayoutRouter is IPayoutSink, IPayoutRouterWriter {}
