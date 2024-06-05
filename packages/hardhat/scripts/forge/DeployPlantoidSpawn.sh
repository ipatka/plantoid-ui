#!/usr/bin/env bash
set -euo pipefail

verify_flag=""
if [ -n "${DEPLOY_VERIFY:-}" ]; then
  verify_flag="--verify"
fi


echo "> Deploying Plantoid"
forge script -vvvv scripts/forge/DeployPlantoidSpawn.s.sol:Deploy --rpc-url "$DEPLOY_ETH_RPC_URL" --legacy --gas-estimate-multiplier 200 --broadcast --private-key "$DEPLOY_PRIVATE_KEY" $verify_flag

