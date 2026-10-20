## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy (Base Sepolia, chainId 84532)

Requires `packages/contracts/.env` (copy from `.env.example`) with `BASE_SEPOLIA_RPC_URL`
and a **dedicated testnet-only** `DEPLOYER_PRIVATE_KEY` (its address must hold Base Sepolia
ETH for gas). forge auto-loads `.env`.

```shell
# Deploy all contracts + structural wiring, then export addresses/ABIs into @amanah/shared:
$ pnpm deploy:contracts            # = :run (forge broadcast) then :export (codegen + shared build)

# Re-export @amanah/shared from the committed ledger WITHOUT a redeploy (e.g. after recompile):
$ pnpm deploy:contracts:export
```

`script/Deploy.s.sol` deploys in dependency order, wires everything (demo posture:
`releaseDelay=0`, `bufferBps=2000`, standard mode, swap allowlist mXSGD+mIDRX), reads back
every wire, and writes the labeled ledger `deployments/84532.json` (committed — public
addresses only). `script/export-shared.mjs` turns that ledger + `out/*.abi` into
`packages/shared/src/{addresses.ts,abis/*}`.

### Verify on Basescan (optional)

Verification is off the deploy path. A single Etherscan V2 key (`ETHERSCAN_API_KEY` in
`.env`) covers Base Sepolia via `--chain 84532`. Do **not** pass the key on the CLI — forge
auto-reads it from `.env` (avoids process-list/history leak). Per address, with its own
constructor args, e.g.:

```shell
$ forge verify-contract --chain 84532 --watch \
    <ADDR> src/mocks/MockStablecoin.sol:MockStablecoin \
    --constructor-args $(cast abi-encode "constructor(string,string)" "Mock USDC" "mUSDC")
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
