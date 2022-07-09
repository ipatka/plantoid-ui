import { Button, Col, Menu, Row, Input, Divider, List, Image } from "antd";
import "antd/dist/antd.css";
import {
  useBalance,
  useContractLoader,
  useContractReader,
  useGasPrice,
  useOnBlock,
  useUserProviderAndSigner,
} from "eth-hooks";
import { useEventListener } from "eth-hooks/events/useEventListener";
import { useExchangeEthPrice } from "eth-hooks/dapps/dex";
import React, { useCallback, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "react-router-dom";
import "./App.css";
import {
  Account,
  Contract,
  Address,
  Faucet,
  GasGauge,
  Header,
  Ramp,
  ThemeSwitch,
  NetworkDisplay,
  FaucetHint,
  NetworkSwitch,
  AddressInput,
  EtherInput,
  Events,
  BytesStringInput,
  Proposals,
} from "./components";
import { NETWORKS, ALCHEMY_KEY } from "./constants";
import externalContracts from "./contracts/external_contracts";
import GnosisSafeABI from "./contracts/gnosisSafe";
import PlantoidABI from "./contracts/plantoid";
import MultisendABI from "./contracts/multisend";
import TipRelayerABI from "./contracts/relayer";
import SignatureDbABI from "./contracts/signaturedb";
// contracts
import deployedContracts from "./contracts/hardhat_contracts.json";
import { Transactor, Web3ModalSetup } from "./helpers";
import { Home, ExampleUI, Hints, Subgraph } from "./views";
import { useStaticJsonRPC } from "./hooks";
import { ZERO_ADDRESS } from "./components/Swap";

import { safeSignTypedData, encodeMultiSend, MetaTransaction } from "@gnosis.pm/safe-contracts";

const { ethers, BigNumber } = require("ethers");


/*
    Welcome to 🏗 scaffold-eth !

    Code:
    https://github.com/scaffold-eth/scaffold-eth

    Support:
    https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA
    or DM @austingriffith on twitter or telegram

    You should get your own Alchemy.com & Infura.io ID and put it in `constants.js`
    (this is your connection to the main Ethereum network for ENS etc.)


    🌏 EXTERNAL CONTRACTS:
    You can also bring in contract artifacts in `constants.js`
    (and then use the `useExternalContractLoader()` hook!)
*/

/// 📡 What chain are your contracts deployed to?
const initialNetwork = NETWORKS.localhost; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;
const NETWORKCHECK = true;
const USE_BURNER_WALLET = false; // toggle burner wallet feature
const USE_NETWORK_SELECTOR = false;

const web3Modal = Web3ModalSetup();

// 🛰 providers
const providers = [
  "https://eth-mainnet.gateway.pokt.network/v1/lb/611156b4a585a20035148406",
  `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
  "https://rpc.scaffoldeth.io:48544",
];

const encodeMultiAction = (multisend, metatransactions) => {
  console.log({ metatransactions });
  const encodedMetatransactions = encodeMultiSend(metatransactions);
  const multi_action = multisend.interface.encodeFunctionData("multiSend", [encodedMetatransactions]);
  return multi_action;
};

function App(props) {
  // specify all the chains your app is available on. Eg: ['localhost', 'mainnet', ...otherNetworks ]
  // reference './constants.js' for other networks
  const networkOptions = [initialNetwork.name, "mainnet", "rinkeby"];

  const [injectedProvider, setInjectedProvider] = useState();
  const [address, setAddress] = useState();
  const [toAddress, setToAddress] = useState();
  const [gnosisAddress, setGnosisAddress] = useState();
  const [txData, setTxData] = useState();
  const [txComment, setTxComment] = useState();
  const [txs, setTxs] = useState([]);
  const [txValue, setTxValue] = useState();
  const [signatures, setSignatures] = useState([]);
  const [encodedTx, setEncodedTx] = useState();
  const [multisendAction, setMultisendAction] = useState();
  const [txHash, setTxHash] = useState();
  const [tipValue, setTipValue] = useState();
  const [selectedNetwork, setSelectedNetwork] = useState(networkOptions[0]);



  const location = useLocation();

  const addTx = async () => {
    const newTxs = [...txs];
    newTxs.push({
      to: toAddress,
      data: txData,
      value: txValue,
      operation: 0,
    });
    console.log({ newTxs });
    setTxs(newTxs);
  };

  const encodeTransaction = (
    to,
    value,
    data,
    operation,
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
    nonce,
    comment,
  ) => {
    return ethers.utils.defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "address",
        "address",
        "uint256",
        "string",
      ],
      [to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce, comment],
    );
  };

  const submitSignature = async () => {
    try {
      console.log({ gnosisAddress, txHash, encodedTx, signatures });
      await writeContracts.SignatureDb.addSignatures(gnosisAddress, txHash, signatures[0]);
    } catch (error) {
      console.log({ error });
    }
  };

  const feedPlantoid = async plantoidAddress => {
    try {
      await userSigner.sendTransaction({ to: plantoidAddress, value: ethers.utils.parseEther(txValue) });
    } catch (error) {
      console.log({ error });
    }
  };

  const createAndSign = async () => {
    const gnosisAddressChecksum = ethers.utils.getAddress(gnosisAddress);
    const toAddressChecksum = ethers.utils.getAddress(toAddress);
    console.log({ gnosisAddress, gnosisAddressChecksum, toAddress, toAddressChecksum });
    try {
      const multisendContract = new ethers.Contract(
        "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
        MultisendABI,
        localProvider,
      );
      // TODO fix address
      const relayerContract = new ethers.Contract(
        "0xda945d66170849d6eef90df09cd1f235d83efa66", // Rinkeby
        TipRelayerABI,
        localProvider,
      );
      const gnosisSafe = new ethers.Contract(gnosisAddressChecksum, GnosisSafeABI, localProvider);

      txs.push({
        to: relayerContract.address,
        data: "0x",
        value: ethers.utils.parseEther(tipValue),
        operation: 0,
      });

      const nonce = await gnosisSafe.nonce();

      const multisendAction = encodeMultiAction(multisendContract, txs);

      console.log({ nonce, multisendAction });

      // todo abi encode the arguments into bytes for storage

      const abiEncoded = encodeTransaction(
        multisendContract.address,
        0,
        multisendAction,
        1,
        0,
        0,
        0,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        nonce,
        txComment,
      );

      setEncodedTx(abiEncoded);
      setMultisendAction(multisendAction);
      const newTxHash = await gnosisSafe.callStatic.getTransactionHash(
        multisendContract.address,
        0,
        multisendAction,
        1,
        0,
        0,
        0,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        nonce,
      );
      setTxHash(newTxHash);
      console.log({ newTxHash, abiEncoded });
      const signed = await safeSignTypedData(userSigner, gnosisSafe, {
        to: multisendContract.address,
        value: 0,
        data: multisendAction,
        operation: 1,
        safeTxGas: 0,
        baseGas: 0,
        gasPrice: 0,
        gasToken: ZERO_ADDRESS,
        refundReceiver: ZERO_ADDRESS,
        nonce,
      });
      const newSigs = [...signatures];
      newSigs.push(signed.data);
      console.log({ newSigs });
      setSignatures(newSigs);
    } catch (error) {
      console.log({ error });
    }
  };

  const targetNetwork = NETWORKS[selectedNetwork];

  // 🔭 block explorer URL
  const blockExplorer = targetNetwork.blockExplorer;

  // load all your providers
  const localProvider = useStaticJsonRPC([
    process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : targetNetwork.rpcUrl,
  ]);
  const mainnetProvider = useStaticJsonRPC(providers);

  if (DEBUG) console.log(`Using ${selectedNetwork} network`);

  // 🛰 providers
  if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangeEthPrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProviderAndSigner = useUserProviderAndSigner(injectedProvider, localProvider, USE_BURNER_WALLET);
  const userSigner = userProviderAndSigner.signer;

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);

  // You can warn the user if you would like them to be on a specific network
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId =
    userSigner && userSigner.provider && userSigner.provider._network && userSigner.provider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userSigner, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);


  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  // const contractConfig = useContractConfig();

  const contractConfig = { deployedContracts: deployedContracts || {}, externalContracts: externalContracts || {} };

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider, contractConfig);

  // If you want to make 🔐 write transactions to your contracts, use the userSigner:
  const writeContracts = useContractLoader(userSigner, contractConfig, localChainId);

  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  const mainnetContracts = useContractLoader(mainnetProvider, contractConfig);

  // If you want to call a function on a new block
  useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

  // Then read your DAI balance like:
  const myMainnetDAIBalance = useContractReader(mainnetContracts, "DAI", "balanceOf", [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  ]);

  // keep track of a variable from the contract in the local React state:
  const purpose = useContractReader(readContracts, "YourContract", "purpose");

  const artist = useContractReader(readContracts, "plantoid", "artist");

  const spawnCount = useContractReader(readContracts, "plantoid", "spawnCount");
  const loggedCount = useContractReader(readContracts, "plantoid", "proposalCounter", [0]);

  const tokenIDs = useContractReader(readContracts, "plantoid", "_tokenIds");
  console.log("NUMBER OF IDss---------- " + tokenIDs)

  const [proposalCount, setProposalCount] = useState(0);

  useEffect(() => {
    if(loggedCount) {
      let num = Number(loggedCount);
      console.log(proposalCount, 'count set')
      setProposalCount(num)
      console.log(proposalCount, 'count set2')
      
    }
  },[loggedCount])

  const [proposalsList, setProposalsList] = useState([[0,"",""]]);


  useEffect(() => {
    async function getProposals() {  
        console.log(proposalCount, 'COUNT!')
        console.log("PROP 0 ==== " + proposalsList[0])
        let tempPropsList = [[0,"",""]];
      for (var i = 1; i <= proposalCount; i++) {
        let tempProp = await readContracts.plantoid.proposals(0, i);
        tempPropsList.push([i, tempProp[0], tempProp[1]]);
      }
      setProposalsList(tempPropsList)
    }
    getProposals();
  }, [proposalCount]);

  console.log({ proposalCount });

  

  



  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance &&
      yourMainnetBalance &&
      readContracts &&
      writeContracts &&
      mainnetContracts
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? ethers.utils.formatEther(yourLocalBalance) : "...");
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? ethers.utils.formatEther(yourMainnetBalance) : "...");
      console.log("📝 readContracts", readContracts);
      console.log("🌍 DAI contract on mainnet:", mainnetContracts);
      console.log("💵 yourMainnetDAIBalance", myMainnetDAIBalance);
      console.log("🔐 writeContracts", writeContracts);
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance,
    yourMainnetBalance,
    readContracts,
    writeContracts,
    mainnetContracts,
    localChainId,
    myMainnetDAIBalance,
  ]);

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new ethers.providers.Web3Provider(provider));

    provider.on("chainChanged", chainId => {
      console.log(`chain changed to ${chainId}! updating providers`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    provider.on("accountsChanged", () => {
      console.log(`account changed!`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
    // eslint-disable-next-line
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name.indexOf("local") !== -1;

  const plantoidAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
  const plantoidBalance = useBalance(localProvider, plantoidAddress);


  const events = useEventListener(readContracts, "plantoid", "Deposit", localProvider, 10983913);

  return (
    <div className="App">
      {/* ✏️ Edit the header and change the title to your project name */}
      <Header title="🥀 Plantoid" link="https://github.com/wpapper/multisig-mempool/" subTitle="Feed me">
        {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flex: 1 }}>
            {USE_NETWORK_SELECTOR && (
              <div style={{ marginRight: 20 }}>
                <NetworkSwitch
                  networkOptions={networkOptions}
                  selectedNetwork={selectedNetwork}
                  setSelectedNetwork={setSelectedNetwork}
                />
              </div>
            )}
            <Account
              useBurner={USE_BURNER_WALLET}
              address={address}
              localProvider={localProvider}
              userSigner={userSigner}
              mainnetProvider={mainnetProvider}
              price={price}
              web3Modal={web3Modal}
              loadWeb3Modal={loadWeb3Modal}
              logoutOfWeb3Modal={logoutOfWeb3Modal}
              blockExplorer={blockExplorer}
            />
          </div>
        </div>
      </Header>
      {yourLocalBalance.lte(ethers.BigNumber.from("0")) && (
        <FaucetHint localProvider={localProvider} targetNetwork={targetNetwork} address={address} />
      )}
      <NetworkDisplay
        NETWORKCHECK={NETWORKCHECK}
        localChainId={localChainId}
        selectedChainId={selectedChainId}
        targetNetwork={targetNetwork}
        logoutOfWeb3Modal={logoutOfWeb3Modal}
        USE_NETWORK_SELECTOR={USE_NETWORK_SELECTOR}
      />
      <Menu style={{ textAlign: "center", marginTop: 20 }} selectedKeys={[location.pathname]} mode="horizontal">
        <Menu.Item key="/">
          <Link to="/">Feed</Link>
        </Menu.Item>
        <Menu.Item key="/claim">
          <Link to="/claim">Claim</Link>
        </Menu.Item>
      </Menu>

      <Switch>
        <Route exact path="/">
          {/* pass in any web3 props to this Home component. For example, yourLocalBalance */}
          <div>
            <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
              <h2>Plantoid feeder:</h2>
              <Divider />
              <div style={{ margin: 8 }}></div>
              Plantoid
              <Address
                address={plantoidAddress}
                ensProvider={mainnetProvider}
                blockExplorer={blockExplorer}
                fontSize={20}
              />
              <Image
                width={200}
                height={200}
                src="https://logos.mypinata.cloud/ipfs/Qma6gg82b2WXYwKNt8Jmu9sBg5dEZqo67nV18SA4P2iDrS"
                fallback="data:image/png;base64,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"
              />
              <Address address={artist} ensProvider={mainnetProvider} blockExplorer={blockExplorer} fontSize={20} />
              <Divider />
              Current balance: { plantoidBalance.toString() }
              <Divider />
              Amount
              <EtherInput
                price={price}
                value={txValue}
                onChange={value => {
                  setTxValue(value);
                }}
              />
              <Button
                onClick={() => {
                  /* look how we call setPurpose AND send some value along */
                  feedPlantoid(plantoidAddress);
                  /* this will fail until you make the setPurpose function payable */
                }}
              >
                Feed
              </Button>

              <Divider />
              # of Seeds : { spawnCount?.toString() }
              # of Proposals : { proposalCount?.toString() }

              <Divider />
                  {console.log(proposalsList, 'list check')}
                {(100000000000000001 > 10000000000000000) && <Proposals plantoidAddress={plantoidAddress} localProvider={userSigner} proposalsList={proposalsList} proposalCount={proposalCount} /> } 


            </div>
            <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <h2>Events:</h2>
              <List
                bordered
                dataSource={events}
                renderItem={item => {
                  console.log({ item });
                  return (
                    <List.Item key={item.blockNumber + "_" + item.args.sender + "_" + item.args.depositIndex}>
                      {item.args[0].toString()}
                      <Address address={item.args[1]} ensProvider={mainnetProvider} fontSize={16} />
                      {item.args[2].toString()}
                    </List.Item>
                  );
                }}
              />
            </div>
          </div>
        </Route>
        <Route exact path="/claim">
          {/* pass in any web3 props to this Home component. For example, yourLocalBalance */}
          <div>
            <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
              <h2>Tx Signer:</h2>
              <Divider />
              <div style={{ margin: 8 }}></div>
              Gnosis Safe
              <AddressInput onChange={setGnosisAddress} value={gnosisAddress}></AddressInput>
              TX Hash
              <Input onChange={e => setTxHash(e.target.value)} value={txData}></Input>
              <Divider />
              <Button
                onClick={() => {
                  /* look how we call setPurpose AND send some value along */
                  addTx();
                  /* this will fail until you make the setPurpose function payable */
                }}
              >
                Load transaction
              </Button>
              <Divider />
              Comments
              <Input onChange={e => setTxComment(e.target.value)} value={txComment}></Input>
              <Divider />
              <Button
                onClick={() => {
                  /* look how we call setPurpose AND send some value along */
                  createAndSign();
                  /* this will fail until you make the setPurpose function payable */
                }}
              >
                Sign transactions
              </Button>
              <Button
                onClick={() => {
                  /* look how we call setPurpose AND send some value along */
                  submitSignature();
                  /* this will fail until you make the setPurpose function payable */
                }}
              >
                Save transactions
              </Button>
            </div>
            <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <h2>Txs:</h2>
              <List
                bordered
                dataSource={txs}
                renderItem={item => {
                  return (
                    <List.Item key={(Math.random() + 1).toString(36).substring(7)}>
                      <Address address={item.to} ensProvider={mainnetProvider} fontSize={16} />
                      {item.data.slice(0, 15)}...
                    </List.Item>
                  );
                }}
              />
            </div>
          </div>
        </Route>
      </Switch>

      <ThemeSwitch />

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>

          <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col>
        </Row>

        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {
              /*  if the local provider has a signer, let's show the faucet:  */
              faucetAvailable ? (
                <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
              ) : (
                ""
              )
            }
          </Col>
        </Row>
      </div>
    </div>
  );
}

export default App;
