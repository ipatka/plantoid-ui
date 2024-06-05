#!/usr/bin/env bash
set -euo pipefail


echo "> Deploying Plantoid"
forge script -vvvv scripts/forge/DeployPlantoidSpawn.s.sol:Deploy --rpc-url "$SEPOLIA_RPC_URL" --legacy --gas-estimate-multiplier 500 --broadcast --private-key "$DEPLOY_PRIVATE_KEY" --verify

