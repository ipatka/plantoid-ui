#!/usr/bin/env bash
set -euo pipefail

echo "> Spawning Plantoid"
forge script -vvvv scripts/forge/SpawnPlantoid.s.sol:Deploy --rpc-url "$DEPLOY_ETH_RPC_URL" --legacy --gas-estimate-multiplier 200 --broadcast --private-key "$DEPLOY_PRIVATE_KEY"

