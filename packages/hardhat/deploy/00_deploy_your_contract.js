// deploy/00_deploy_your_contract.js

const { ethers } = require("hardhat");

const getNewPlantoidAddress = async (tx) => {
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  let plantoidSummonAbi = [
    "event PlantoidSpawned(address indexed plantoid, address indexed artist)",
  ];
  let iface = new ethers.utils.Interface(plantoidSummonAbi);
  let log = iface.parseLog(receipt.logs[0]);
  const { plantoid } = log.args;
  return plantoid;
};

// const sleep = (ms) =>
//   new Promise((r) =>
//     setTimeout(() => {
//       console.log(`waited for ${(ms / 1000).toFixed(3)} seconds`);
//       r();
//     }, ms)
//   );
const zeroAddress = "0x0000000000000000000000000000000000000000";

const config = {
  plantoidOracleAddress: "0x775aF9b7c214Fe8792aB5f5da61a8708591d517E",
  artistAddress: "0x775aF9b7c214Fe8792aB5f5da61a8708591d517E",
  parentAddress: zeroAddress,
  depositThreshold: ethers.utils.parseEther("0.0001"),
  threshold: ethers.utils.parseEther("1"),
  name: "Plantoid",
  prereveal: "preveal",
  symbol: "LIFE",
  votingPeriod: 1000,
  gracePeriod: 500,
  settlePeriod: 300,
  extPeriod: 200,
};

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const tx = await deploy("Plantoid", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 0,
  });
  console.log({ tx });
  const tx2 = await deploy("PlantoidSpawn", {
    from: deployer,
    args: [tx.receipt.contractAddress],
    log: true,
    waitConfirmations: 0,
  });
  const plantoidSpawn = await ethers.getContractAt(
    "PlantoidSpawn",
    tx2.receipt.contractAddress
  ); //<-- if you want to instantiate a version of a contract at a specific address!
  const tx3 = await plantoidSpawn.spawnPlantoid(
    config.plantoidOracleAddress,
    config.artistAddress,
    config.parentAddress,
    [config.depositThreshold, config.threshold],
    [
      config.votingPeriod,
      config.gracePeriod,
      config.settlePeriod,
      config.extPeriod,
    ],
    config.name,
    config.symbol,
    config.prereveal
  );
  const plantoidAddress = await getNewPlantoidAddress(tx3);
  // const tx = await deploy("TipRelayer", {
  //   from: deployer,
  //   args: [
  //   ],
  //   log: true,
  //   waitConfirmations: 5,
  // });

  console.log({ plantoidAddress });
  /*  await YourContract.setPurpose("Hello");
  
    To take ownership of yourContract using the ownable library uncomment next line and add the 
    address you want to be the owner. 
    // await yourContract.transferOwnership(YOUR_ADDRESS_HERE);

    //const yourContract = await ethers.getContractAt('YourContract', "0xaAC799eC2d00C013f1F11c37E654e59B0429DF6A") //<-- if you want to instantiate a version of a contract at a specific address!
  */

  /*
  //If you want to send value to an address from the deployer
  const deployerWallet = ethers.provider.getSigner()
  await deployerWallet.sendTransaction({
    to: "0x34aA3F359A9D614239015126635CE7732c18fDF3",
    value: ethers.utils.parseEther("0.001")
  })
  */

  /*
  //If you want to send some ETH to a contract on deploy (make your constructor payable!)
  const yourContract = await deploy("YourContract", [], {
  value: ethers.utils.parseEther("0.05")
  });
  */

  /*
  //If you want to link a library into your contract:
  // reference: https://github.com/austintgriffith/scaffold-eth/blob/using-libraries-example/packages/hardhat/scripts/deploy.js#L19
  const yourContract = await deploy("YourContract", [], {}, {
   LibraryName: **LibraryAddress**
  });
  */

  // Verify from the command line by running `yarn verify`

  // You can also Verify your contracts with Etherscan here...
  // You don't want to verify on localhost
  // try {
  //   if (chainId !== localChainId) {
  //     await run("verify:verify", {
  //       address: YourContract.address,
  //       contract: "contracts/YourContract.sol:YourContract",
  //       constructorArguments: [],
  //     });
  //   }
  // } catch (error) {
  //   console.error(error);
  // }
};
module.exports.tags = ["Relayer"];
